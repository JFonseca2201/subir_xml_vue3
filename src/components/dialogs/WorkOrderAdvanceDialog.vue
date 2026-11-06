<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  workOrder: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'advance-saved',
  'advance-deleted',
])

const { showNotification } = useGlobalToast()

const isLoading = ref(false)
const isLoadingAccounts = ref(false)
const isSubmitting = ref(false)
const accounts = ref([])
const advances = ref([])
const totalAmount = ref(0)
const totalAdvances = ref(0)
const balanceDue = ref(0)

const isInvoiced = computed(() => {
  const wo = props.workOrder

  return !!(wo?.sale && wo.sale.document_type !== 'quote' && wo.sale.status !== 'canceled')
})

const clientDisplayName = computed(() => {
  const c = props.workOrder?.client
  if (!c) return 'Cliente no asignado'
  return c.full_name || `${c.name || ''} ${c.surname || ''}`.trim() || 'Cliente'
})

const vehicleDisplayInfo = computed(() => {
  const v = props.workOrder?.vehicle
  if (!v) return null
  const plate = (v.license_plate || '').toUpperCase()
  const details = [v.brand, v.model, v.year].filter(Boolean).join(' ')
  return {
    plate: plate || 'SIN PLACA',
    details: details || null,
  }
})

const workOrderNumberFormatted = computed(() => {
  const num = props.workOrder?.number
  if (!num) return `OT #${props.workOrder?.id || '---'}`
  return String(num).toUpperCase().startsWith('OT') ? num : `OT #${num}`
})

// Cuentas formateadas dinámicamente desde la BD sin ningún dato quemado
const formattedAccounts = computed(() => {
  return (accounts.value || [])
    .filter(a => a && a.is_active !== false && a.is_active !== 0 && a.is_active !== '0')
    .map(acc => {
      const isBank = acc.type === 'bank'
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        bank_name: acc.bank_name,
        code: acc.code,
        isBank,
        methodLabel: isBank ? 'Transferencia' : 'Efectivo',
        icon: isBank ? 'ri-bank-line' : 'ri-wallet-3-line',
        accountDisplay: acc.bank_name && acc.bank_name !== acc.name
          ? `${acc.name} (${acc.bank_name})`
          : acc.name,
      }
    })
})

const selectedAccount = computed(() => {
  if (!form.value.account_id) return null
  return formattedAccounts.value.find(a => a.id === form.value.account_id) || null
})

const selectAccount = acc => {
  if (!acc) return
  form.value.account_id = acc.id
  form.value.payment_method = acc.isBank ? 'Transferencia' : 'Efectivo'
}

const progressPercentage = computed(() => {
  if (!totalAmount.value || totalAmount.value <= 0) return 0
  return Math.min(100, Math.round((totalAdvances.value / totalAmount.value) * 100))
})

const suggestedAmounts = computed(() => {
  const base = [5, 10, 20, 50]
  if (balanceDue.value > 50 && balanceDue.value < 200) {
    base.push(100)
  }
  return base
})

const todayDate = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000

  return new Date(Date.now() - tzOffset).toISOString().split('T')[0]
}

const form = ref({
  amount: '',
  account_id: null,
  payment_method: 'Efectivo',
  advance_date: todayDate(),
  notes: '',
})

// Cargar cuentas disponibles
const loadAccounts = async () => {
  isLoadingAccounts.value = true
  try {
    const response = await $api('accounts')
    let list = []
    if (Array.isArray(response)) {
      list = response
    } else if (response && Array.isArray(response.data)) {
      list = response.data
    } else if (response && typeof response === 'object') {
      list = Object.values(response).filter(x => x && typeof x === 'object' && x.id)
    }
    accounts.value = list

    // Preseleccionar primera cuenta si no hay ninguna seleccionada
    if (!form.value.account_id && formattedAccounts.value.length > 0) {
      selectAccount(formattedAccounts.value[0])
    }
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
  } finally {
    isLoadingAccounts.value = false
  }
}

// Cargar historial de abonos de la OT
const loadAdvances = async () => {
  if (!props.workOrder?.id) return
  isLoading.value = true
  try {
    const response = await $api(`work-orders/${props.workOrder.id}/advances`)
    const data = response?.data || {}

    advances.value = data.advances || []
    totalAmount.value = parseFloat(data.total_amount) || 0
    totalAdvances.value = parseFloat(data.total_advances) || 0
    balanceDue.value = parseFloat(data.balance_due) || 0
  } catch (error) {
    console.error('Error al cargar abonos:', error)
    showNotification('Error al consultar abonos de la orden', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadAccounts()
})

watch(() => props.isDialogVisible, val => {
  if (val) {
    form.value.amount = ''
    form.value.notes = ''
    form.value.advance_date = todayDate()
    loadAccounts()
    if (props.workOrder?.id) {
      loadAdvances()
    }
  }
})

// Sincronizar automáticamente: si la cuenta es banco -> Transferencia; si es caja -> Efectivo (100% dinámico)
watch(() => form.value.account_id, accId => {
  if (!accId) return
  const acc = formattedAccounts.value.find(a => a.id === accId)
  if (acc) {
    form.value.payment_method = acc.isBank ? 'Transferencia' : 'Efectivo'
  }
})

const setQuickAmount = val => {
  if (val === 'full') {
    form.value.amount = balanceDue.value > 0 ? balanceDue.value.toFixed(2) : ''
  } else {
    form.value.amount = Number(val).toFixed(2)
  }
}

const submitAdvance = async () => {
  const numAmount = parseFloat(form.value.amount)
  if (!numAmount || numAmount <= 0) {
    showNotification('Ingresa un monto válido mayor a $0.00', 'warning')
    return
  }

  if (!form.value.account_id) {
    showNotification('Selecciona la cuenta de destino', 'warning')
    return
  }

  // Asegurar sincronización con la cuenta seleccionada
  const acc = formattedAccounts.value.find(a => a.id === form.value.account_id)
  if (acc) {
    form.value.payment_method = acc.isBank ? 'Transferencia' : 'Efectivo'
  }

  isSubmitting.value = true
  try {
    const response = await $api(`work-orders/${props.workOrder.id}/advances`, {
      method: 'POST',
      body: {
        amount: numAmount,
        account_id: form.value.account_id,
        payment_method: form.value.payment_method,
        advance_date: form.value.advance_date,
        notes: form.value.notes,
      },
    })

    if (response?.success) {
      showNotification(response.message || 'Abono registrado correctamente', 'success')
      form.value.amount = ''
      form.value.notes = ''
      await loadAdvances()
      emit('advance-saved', props.workOrder.id)
    } else {
      showNotification(response?.message || 'No se pudo registrar el abono', 'error')
    }
  } catch (error) {
    console.error('Error al guardar abono:', error)
    const msg = error?.response?.data?.message || 'Error al procesar el abono'
    showNotification(msg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

const deleteAdvance = async advanceId => {
  if (!confirm('¿Estás seguro de anular este abono? El dinero se restará de la cuenta correspondiente.')) return

  isLoading.value = true
  try {
    const response = await $api(`work-orders/${props.workOrder.id}/advances/${advanceId}`, {
      method: 'DELETE',
    })

    if (response?.success) {
      showNotification(response.message || 'Abono anulado exitosamente', 'success')
      await loadAdvances()
      emit('advance-deleted', props.workOrder.id)
    } else {
      showNotification(response?.message || 'Error al anular abono', 'error')
    }
  } catch (error) {
    console.error('Error al anular abono:', error)

    const msg = error?.response?.data?.message || 'No se pudo anular el abono'

    showNotification(msg, 'error')
  } finally {
    isLoading.value = false
  }
}

const printReceipt = advanceId => {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
  const baseUrl = getApiBaseUrl()
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const url = `${cleanBase}/work-orders/${props.workOrder.id}/advances/${advanceId}/receipt?token=${encodeURIComponent(token)}`

  window.open(url, '_blank')
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const formatCurrency = val => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(val) || 0)
}

const formatDate = dateStr => {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)

    return d.toLocaleDateString('es-EC', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch (e) {
    return dateStr
  }
}
</script>

<template>
  <VDialog :model-value="props.isDialogVisible" max-width="720" width="800" :fullscreen="$vuetify.display.smAndDown"
    persistent @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="rounded-xl overflow-hidden border advance-dialog-card elevation-10">
      <!-- Modern Gradient Header Banner -->
      <div class="advance-dialog-header">
        <!-- Close Button (Top Right) -->
        <VBtn icon="ri-close-line" variant="text" size="small" class="advance-header-close-btn" title="Cerrar ventana"
          @click="closeDialog" />

        <!-- Top Row: Icon Avatar + Eyebrow Tag + Main Title -->
        <div class="d-flex align-center gap-3">
          <div class="advance-header-avatar shrink-0">
            <VIcon icon="ri-hand-coin-line" size="24" color="white" />
          </div>

          <div class="min-w-0 flex-grow-1 pe-8">
            <div class="d-flex align-center gap-2 flex-wrap mb-1">
              <span class="advance-tag-label">
                Módulo de Tesorería · Taller
              </span>
              <span v-if="isInvoiced" class="advance-status-pill advance-status-invoiced">
                <span class="status-dot" />
                <span>Facturada</span>
              </span>
              <span v-else class="advance-status-pill advance-status-active">
                <span class="status-dot" />
                <span>En Proceso</span>
              </span>
            </div>

            <h2 class="advance-header-title">
              Gestión de Abonos / Anticipos
            </h2>
          </div>
        </div>

        <!-- Bottom Row: Meta Group with Glass Pills (OT, Placa & Vehículo, Cliente) -->
        <div class="advance-meta-row d-flex align-center flex-wrap gap-2 mt-3 pt-2">
          <!-- OT Pill -->
          <div class="advance-glass-pill pill-ot" title="Orden de Trabajo">
            <VIcon icon="ri-tools-line" size="13" class="me-1" />
            <span class="font-mono font-weight-bold">{{ workOrderNumberFormatted }}</span>
          </div>

          <!-- Placa / Vehículo Pill -->
          <div v-if="vehicleDisplayInfo" class="advance-glass-pill pill-vehicle" title="Vehículo asociado">
            <VIcon icon="ri-car-line" size="13" class="me-1" />
            <span class="font-weight-bold">{{ vehicleDisplayInfo.plate }}</span>
            <span v-if="vehicleDisplayInfo.details" class="ms-1 opacity-90 text-truncate" style="max-width: 180px;">
              · {{ vehicleDisplayInfo.details }}
            </span>
          </div>

          <!-- Cliente Pill -->
          <div class="advance-glass-pill pill-client" title="Cliente">
            <VIcon icon="ri-user-3-line" size="13" class="me-1" />
            <span class="text-truncate" style="max-width: 220px;">{{ clientDisplayName }}</span>
          </div>
        </div>
      </div>

      <VCardText class="pa-5 bg-background">
        <!-- Tarjetas Resumen de Totales -->
        <div class="advance-kpi-grid mb-3">
          <!-- Presupuesto OT -->
          <div class="advance-kpi-card kpi-budget">
            <div class="kpi-icon-wrap">
              <VIcon icon="ri-file-list-3-line" size="20" />
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Presupuesto OT</span>
              <div class="kpi-value">{{ formatCurrency(totalAmount) }}</div>
              <span class="kpi-sub">Total de la orden</span>
            </div>
          </div>

          <!-- Abonos Realizados -->
          <div class="advance-kpi-card kpi-advances">
            <div class="kpi-icon-wrap">
              <VIcon icon="ri-checkbox-circle-line" size="20" />
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Abonos Realizados</span>
              <div class="kpi-value text-emerald">{{ formatCurrency(totalAdvances) }}</div>
              <span class="kpi-sub">{{ advances.length }} abono(s) registrado(s)</span>
            </div>
          </div>

          <!-- Saldo Pendiente -->
          <div class="advance-kpi-card kpi-balance" :class="{ 'is-zero': balanceDue <= 0 }">
            <div class="kpi-icon-wrap">
              <VIcon :icon="balanceDue > 0 ? 'ri-time-line' : 'ri-check-double-line'" size="20" />
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Saldo Pendiente</span>
              <div class="kpi-value" :class="balanceDue > 0 ? 'text-amber' : 'text-emerald'">
                {{ formatCurrency(balanceDue) }}
              </div>
              <span class="kpi-sub">
                {{ balanceDue > 0 ? 'Por cobrar al cliente' : '¡Totalmente pagado!' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Barra de Progreso de Pago -->
        <div class="payment-progress-container mb-4">
          <div class="d-flex align-center justify-space-between mb-1.5 text-caption font-weight-medium">
            <span class="d-flex align-center gap-1.5 text-slate-700">
              <VIcon icon="ri-pie-chart-line" size="14" color="primary" />
              <span>Progreso de Pago</span>
            </span>
            <span class="font-weight-bold" :class="progressPercentage >= 100 ? 'text-emerald' : 'text-primary'">
              {{ progressPercentage }}% cubierto
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"
              :class="progressPercentage >= 100 ? 'bg-emerald-fill' : 'bg-primary-fill'" />
          </div>
        </div>

        <!-- Banner si la orden ya está facturada -->
        <VAlert v-if="isInvoiced" type="info" variant="tonal" class="mb-4 rounded-xl border" icon="ri-information-line">
          <div class="font-weight-bold">
            Orden de Trabajo Facturada
          </div>
          <div class="text-caption">
            Esta orden de trabajo ya ha sido convertida en venta/factura. No se pueden registrar nuevos abonos ni
            modificarlos.
          </div>
        </VAlert>

        <!-- Formulario de Nuevo Abono -->
        <VCard v-if="!isInvoiced" class="advance-form-card border rounded-2xl mb-5 elevation-0 bg-white">
          <!-- Encabezado del Formulario -->
          <div class="form-header px-4 py-3 border-b d-flex align-center justify-space-between bg-slate-50">
            <div class="d-flex align-center gap-2">
              <div class="form-header-badge">
                <VIcon icon="ri-add-circle-fill" color="primary" size="18" />
              </div>
              <div>
                <h4 class="text-subtitle-2 font-weight-bold text-slate-900 mb-0">
                  Registrar Nuevo Abono
                </h4>
                <p class="text-caption text-medium-emphasis mb-0">
                  Ingresa el valor recibido y el tipo de pago
                </p>
              </div>
            </div>

            <!-- Botón de Saldo Completo Rápido -->
            <VBtn v-if="balanceDue > 0" size="small" variant="tonal" color="primary"
              class="font-weight-bold rounded-lg text-none" prepend-icon="ri-flashlight-line"
              @click="setQuickAmount('full')">
              Abonar Todo ({{ formatCurrency(balanceDue) }})
            </VBtn>
          </div>

          <VCardText class="pa-4 pa-sm-5">
            <VRow dense>
              <!-- 1. Selector de Cuenta de Destino (Banco / Caja) -->
              <VCol cols="12" class="mb-2">
                <VSelect v-model="form.account_id" :items="formattedAccounts" item-value="id"
                  item-title="accountDisplay" label="Cuenta de Destino (Banco o Caja) *"
                  placeholder="Selecciona la cuenta donde ingresó el dinero" variant="outlined" density="comfortable"
                  color="primary" :loading="isLoadingAccounts" hide-details class="bg-white rounded-lg">
                  <template #selection="{ item }">
                    <div class="d-flex align-center gap-2 py-0.5">
                      <VIcon :icon="item.raw.icon" size="18"
                        :class="item.raw.isBank ? 'text-primary' : 'text-emerald'" />
                      <span class="font-weight-bold text-slate-800">{{ item.raw.name }}</span>
                      <span class="method-tag ms-2" :class="item.raw.isBank ? 'tag-transfer' : 'tag-cash'">
                        {{ item.raw.methodLabel }}
                      </span>
                    </div>
                  </template>
                  <template #item="{ item, props: itemProps }">
                    <VListItem v-bind="itemProps" :title="undefined">
                      <template #prepend>
                        <VIcon :icon="item.raw.icon" size="20"
                          :class="item.raw.isBank ? 'text-primary' : 'text-emerald'" class="me-2" />
                      </template>
                      <VListItemTitle class="font-weight-bold text-slate-900">
                        {{ item.raw.name }}
                      </VListItemTitle>
                      <VListItemSubtitle class="text-caption text-slate-500">
                        {{ item.raw.isBank ? (item.raw.bank_name || 'Cuenta Bancaria · Transferencia')
                          : 'Caja · Pago en Efectivo' }}
                      </VListItemSubtitle>
                      <template #append>
                        <span class="method-tag" :class="item.raw.isBank ? 'tag-transfer' : 'tag-cash'">
                          {{ item.raw.methodLabel }}
                        </span>
                      </template>
                    </VListItem>
                  </template>
                </VSelect>

                <!-- Indicador sutil y limpio debajo del selector -->
                <div v-if="selectedAccount"
                  class="d-flex align-center gap-1.5 mt-1.5 px-1 text-caption font-weight-medium"
                  :class="selectedAccount.isBank ? 'text-primary' : 'text-emerald'">
                  <VIcon :icon="selectedAccount.isBank ? 'ri-bank-line' : 'ri-wallet-3-line'" size="14" />
                  <span>Ingreso a <strong>{{ selectedAccount.name }}</strong> · Método: <strong>{{
                    selectedAccount.methodLabel
                      }}</strong></span>
                </div>
              </VCol>

              <VCol cols="12">
                <VDivider class="my-2" />
              </VCol>

              <!-- 2. Monto a Abonar + Botones Rápidos -->
              <VCol cols="12">
                <div class="form-group-label mb-1.5 d-flex align-center justify-space-between">
                  <span class="text-caption font-weight-bold text-slate-700">Monto del Abono *</span>
                  <span class="text-caption text-muted">En dólares (USD)</span>
                </div>

                <div class="d-flex align-center gap-3 flex-wrap flex-sm-nowrap">
                  <!-- Input Grande de Monto -->
                  <div class="amount-input-wrapper flex-grow-1" style="min-width: 200px;">
                    <span class="currency-symbol">$</span>
                    <input v-model="form.amount" type="number" step="0.01" min="0.01" placeholder="0.00"
                      class="amount-native-input" autofocus @keydown.enter.prevent="submitAdvance" />
                  </div>

                  <!-- Botones de montos sugeridos -->
                  <div class="quick-amounts-bar d-flex align-center gap-1.5 flex-wrap shrink-0">
                    <span class="text-caption text-slate-400 me-0.5 d-none d-sm-inline">Rápido:</span>
                    <button v-for="amt in suggestedAmounts" :key="amt" type="button" class="quick-amt-chip"
                      :class="{ active: Number(form.amount) === amt }" @click="setQuickAmount(amt)">
                      ${{ amt }}
                    </button>
                    <button v-if="balanceDue > 0" type="button" class="quick-amt-chip chip-total"
                      :class="{ active: Number(form.amount) === Number(balanceDue.toFixed(2)) }"
                      @click="setQuickAmount('full')">
                      Saldo (${{ balanceDue.toFixed(2) }})
                    </button>
                  </div>
                </div>
              </VCol>

              <VCol cols="12">
                <VDivider class="my-2" />
              </VCol>

              <!-- 3. Fecha de Recepción -->
              <VCol cols="12" sm="5">
                <div class="form-group-label mb-1.5">
                  <span class="text-caption font-weight-bold text-slate-700">Fecha de Recepción</span>
                </div>
                <VTextField v-model="form.advance_date" type="date" prepend-inner-icon="ri-calendar-line"
                  variant="outlined" density="compact" color="primary" hide-details class="bg-white rounded-lg" />
              </VCol>

              <!-- 4. Detalle / Referencia (Opcional) -->
              <VCol cols="12" sm="7">
                <div class="form-group-label mb-1.5">
                  <span class="text-caption font-weight-bold text-slate-700">
                    {{ selectedAccount?.isBank ? 'N° Comprobante / Referencia de Transferencia'
                      : 'Detalle u Observación (Opcional)'
                    }}
                  </span>
                </div>
                <VTextField v-model="form.notes"
                  :placeholder="selectedAccount?.isBank ? 'Ej: Transf. #12345678, comprobante bancario...' : 'Ej: Anticipo para repuestos, abono en efectivo...'"
                  :prepend-inner-icon="selectedAccount?.isBank ? 'ri-file-shield-line' : 'ri-chat-1-line'"
                  variant="outlined" density="compact" color="primary" hide-details class="bg-white rounded-lg" />
              </VCol>

              <!-- 5. Botón de Confirmación -->
              <VCol cols="12" class="mt-3">
                <VBtn color="primary" variant="elevated" block height="46" :loading="isSubmitting"
                  :disabled="!form.amount || Number(form.amount) <= 0"
                  class="register-advance-btn font-weight-bold rounded-xl elevation-2 text-none" @click="submitAdvance">
                  <VIcon icon="ri-hand-coin-line" class="me-2" size="20" />
                  <span>
                    {{ form.amount && Number(form.amount) > 0
                      ? `Registrar Abono de ${formatCurrency(form.amount)}`
                      : 'Registrar Abono' }}
                  </span>
                </VBtn>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <!-- Historial de Abonos Registrados -->
        <div class="d-flex align-center justify-space-between mb-2">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-slate-800">
            <VIcon icon="ri-history-line" color="primary" size="18" />
            <span>Historial de Abonos en esta Orden ({{ advances.length }})</span>
          </div>
          <VBtn size="small" variant="text" color="primary" prepend-icon="ri-refresh-line" :loading="isLoading"
            class="text-none font-weight-semibold" @click="loadAdvances">
            Actualizar
          </VBtn>
        </div>

        <VCard class="border rounded-2xl bg-white elevation-0 overflow-hidden mb-2">
          <VTable v-if="advances.length > 0" hover density="comfortable" class="advances-table text-caption">
            <thead>
              <tr class="bg-slate-50 text-uppercase font-weight-bold">
                <th class="py-2.5 ps-4">
                  N° Recibo
                </th>
                <th class="py-2.5">
                  Fecha
                </th>
                <th class="py-2.5">
                  Método & Cuenta
                </th>
                <th class="py-2.5">
                  Detalle / Referencia
                </th>
                <th class="py-2.5 text-right">
                  Monto
                </th>
                <th class="py-2.5 text-center pe-4" style="width: 95px;">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="adv in advances" :key="adv.id" class="advance-row">
                <td class="font-mono font-weight-bold text-primary py-2.5 ps-4">
                  {{ adv.receipt_number || `REC-${adv.id}` }}
                </td>
                <td class="py-2.5 text-slate-600">
                  <div class="d-flex align-center gap-1">
                    <VIcon icon="ri-calendar-line" size="13" class="text-slate-400" />
                    <span>{{ formatDate(adv.advance_date) }}</span>
                  </div>
                </td>
                <td class="py-2.5">
                  <div class="d-flex align-center gap-1.5 flex-wrap">
                    <span class="method-pill"
                      :class="adv.payment_method?.toLowerCase().includes('trans') ? 'method-transfer' : 'method-cash'">
                      <VIcon
                        :icon="adv.payment_method?.toLowerCase().includes('trans') ? 'ri-bank-line' : 'ri-money-dollar-box-line'"
                        size="12" class="me-1" />
                      <span>{{ adv.payment_method }}</span>
                    </span>
                    <span v-if="adv.account?.name" class="account-name-label text-slate-500">
                      {{ adv.account.name }}
                    </span>
                  </div>
                </td>
                <td class="py-2.5 text-slate-600">
                  <span v-if="adv.notes" class="text-truncate d-inline-block" style="max-width: 220px;"
                    :title="adv.notes">
                    {{ adv.notes }}
                  </span>
                  <span v-else class="text-slate-400 font-italic">
                    Abono general a cuenta
                  </span>
                </td>
                <td class="py-2.5 text-right font-weight-black font-mono text-emerald" style="font-size: 0.95rem;">
                  +{{ formatCurrency(adv.amount) }}
                </td>
                <td class="py-2.5 text-center pe-4">
                  <div class="d-flex justify-center gap-1">
                    <VBtn size="x-small" color="primary" variant="tonal" icon="ri-printer-line"
                      title="Imprimir Comprobante de Abono" class="rounded-lg" @click="printReceipt(adv.id)" />
                    <VBtn v-if="!isInvoiced" size="x-small" color="error" variant="tonal" icon="ri-delete-bin-line"
                      title="Anular Abono" class="rounded-lg" @click="deleteAdvance(adv.id)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>

          <!-- Empty State -->
          <div v-else class="pa-8 text-center">
            <div class="empty-state-avatar mx-auto mb-3">
              <VIcon icon="ri-coins-line" size="32" class="text-slate-400" />
            </div>
            <div class="text-body-1 font-weight-bold text-slate-800 mb-1">
              No hay abonos registrados todavía
            </div>
            <p class="text-caption text-slate-500 mb-0" style="max-width: 380px; margin: 0 auto;">
              Utiliza el formulario superior para registrar abonos en efectivo o transferencias bancarias aplicados a
              esta orden de trabajo.
            </p>
          </div>
        </VCard>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-surface d-flex justify-space-between align-center">
        <div class="text-caption text-medium-emphasis">
          <VIcon icon="ri-information-line" size="14" class="me-1" />
          Los abonos suman automáticamente al arqueo de caja del día y se descontarán al facturar.
        </div>
        <VBtn color="secondary" variant="plain" @click="closeDialog" prepend-icon="ri-close-line">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped lang="scss">
.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.advance-dialog-card {
  box-shadow: 0 15px 35px rgba(15, 23, 42, 0.15) !important;
}

.advance-dialog-header {
  position: relative !important;
  background: linear-gradient(135deg, #4f46e5 0%, #5b61eb 50%, #6366f1 75%, #7c3aed 100%) !important;
  color: #ffffff !important;
  padding: 18px 22px 16px 22px !important;
  border-top-left-radius: 12px !important;
  border-top-right-radius: 12px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.18) !important;
  box-shadow: 0 4px 20px rgba(79, 70, 229, 0.22) !important;

  .advance-header-close-btn {
    position: absolute !important;
    top: 14px !important;
    right: 14px !important;
    color: #ffffff !important;
    background: rgba(255, 255, 255, 0.16) !important;
    border: 1px solid rgba(255, 255, 255, 0.25) !important;
    border-radius: 50% !important;
    width: 32px !important;
    height: 32px !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;

    &:hover {
      background: rgba(255, 255, 255, 0.3) !important;
      transform: rotate(90deg);
    }
  }

  .advance-header-avatar {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .advance-tag-label {
    font-size: 0.67rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: rgba(255, 255, 255, 0.82);
  }

  .advance-header-title {
    font-size: 1.22rem;
    font-weight: 800;
    color: #ffffff !important;
    line-height: 1.25;
    margin: 0;
    letter-spacing: -0.2px;
  }

  .advance-meta-row {
    border-top: 1px solid rgba(255, 255, 255, 0.14);
  }

  .advance-glass-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(8px);
    font-size: 0.73rem;
    color: #ffffff !important;
    line-height: 1.4;

    .v-icon {
      color: rgba(255, 255, 255, 0.9) !important;
    }

    &.pill-ot {
      background: rgba(255, 255, 255, 0.24);
      border-color: rgba(255, 255, 255, 0.42);
      font-weight: 700;
      color: #ffffff !important;
    }

    &.pill-vehicle {
      background: rgba(255, 255, 255, 0.16);
    }

    &.pill-client {
      background: rgba(255, 255, 255, 0.12);
    }
  }

  .advance-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 0.67rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    &.advance-status-active {
      background: rgba(56, 189, 248, 0.25);
      border: 1px solid rgba(56, 189, 248, 0.5);
      color: #e0f2fe;

      .status-dot {
        background: #38bdf8;
        box-shadow: 0 0 6px #38bdf8;
      }
    }

    &.advance-status-invoiced {
      background: rgba(52, 211, 153, 0.25);
      border: 1px solid rgba(52, 211, 153, 0.5);
      color: #d1fae5;

      .status-dot {
        background: #34d399;
        box-shadow: 0 0 6px #34d399;
      }
    }
  }
}

// KPI Cards Grid
.advance-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

.advance-kpi-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  transition: all 0.2s ease;

  .kpi-icon-wrap {
    width: 38px;
    height: 38px;
    min-width: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kpi-content {
    min-width: 0;
    flex-grow: 1;
  }

  .kpi-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
    display: block;
    line-height: 1.2;
  }

  .kpi-value {
    font-size: 1.15rem;
    font-weight: 800;
    font-family: 'Consolas', 'Monaco', monospace;
    line-height: 1.25;
    margin-top: 2px;
    color: #0f172a;
  }

  .kpi-sub {
    font-size: 0.68rem;
    color: #94a3b8;
    display: block;
    line-height: 1.2;
    margin-top: 1px;
  }

  &.kpi-budget {
    background: #f8fafc;

    .kpi-icon-wrap {
      background: rgba(99, 102, 241, 0.12);
      color: #4f46e5;
    }
  }

  &.kpi-advances {
    background: #f0fdf4;
    border-color: #bbf7d0;

    .kpi-icon-wrap {
      background: rgba(16, 185, 129, 0.15);
      color: #059669;
    }
  }

  &.kpi-balance {
    background: #fffbeb;
    border-color: #fde68a;

    .kpi-icon-wrap {
      background: rgba(245, 158, 11, 0.15);
      color: #d97706;
    }

    &.is-zero {
      background: #f0fdf4;
      border-color: #bbf7d0;

      .kpi-icon-wrap {
        background: rgba(16, 185, 129, 0.15);
        color: #059669;
      }
    }
  }
}

// Payment Progress Bar
.payment-progress-container {
  padding: 8px 12px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;

  .progress-track {
    height: 7px;
    border-radius: 9999px;
    background: #e2e8f0;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.4s ease;

    &.bg-primary-fill {
      background: linear-gradient(90deg, #6366f1, #818cf8);
    }

    &.bg-emerald-fill {
      background: linear-gradient(90deg, #10b981, #34d399);
    }
  }
}

// Form Elements
.advance-form-card {
  .form-header-badge {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(99, 102, 241, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.amount-input-wrapper {
  display: flex;
  align-items: center;
  position: relative;
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 0 14px;
  transition: all 0.2s ease;

  &:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .currency-symbol {
    font-size: 1.3rem;
    font-weight: 800;
    color: #6366f1;
    margin-right: 6px;
  }

  .amount-native-input {
    width: 100%;
    height: 44px;
    border: none;
    outline: none;
    font-size: 1.35rem;
    font-weight: 800;
    font-family: 'Consolas', 'Monaco', monospace;
    color: #0f172a;
    background: transparent;

    &::placeholder {
      color: #cbd5e1;
      font-weight: 400;
    }
  }
}

.quick-amt-chip {
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.74rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #e0e7ff;
    border-color: #c7d2fe;
    color: #4338ca;
  }

  &.active {
    background: #4f46e5;
    border-color: #4f46e5;
    color: #ffffff;
  }

  &.chip-total {
    background: #fffbeb;
    border-color: #fde68a;
    color: #b45309;

    &:hover {
      background: #fef3c7;
      border-color: #fcd34d;
    }

    &.active {
      background: #d97706;
      border-color: #d97706;
      color: #ffffff;
    }
  }
}

// Grid de Selección de Cuentas (100% Dinámico y Escalable)
.accounts-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  width: 100%;
  box-sizing: border-box;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
}

.account-card-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;

  &:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
    transform: translateY(-1px);
  }

  &.active-bank {
    border-color: #6366f1;
    background: #f5f3ff;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.12);

    .account-card-name {
      color: #4338ca;
    }
  }

  &.active-cash {
    border-color: #10b981;
    background: #f0fdf4;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.12);

    .account-card-name {
      color: #065f46;
    }
  }

  .account-card-icon {
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.icon-bank {
      background: rgba(99, 102, 241, 0.12);
      color: #4f46e5;
    }

    &.icon-cash {
      background: rgba(16, 185, 129, 0.12);
      color: #059669;
    }
  }

  .account-card-info {
    flex-grow: 1;
    min-width: 0;

    .account-card-name {
      font-size: 0.85rem;
      font-weight: 800;
      color: #1e293b;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .account-card-method {
      margin-top: 3px;
    }
  }

  .account-card-check {
    margin-left: auto;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    .check-placeholder {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid #cbd5e1;
      background: transparent;
    }
  }
}

.account-quick-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  font-size: 0.74rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  &.active-bank {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1d4ed8;

    .chip-badge {
      background: #bfdbfe;
      color: #1e40af;
    }
  }

  &.active-cash {
    background: #ecfdf5;
    border-color: #10b981;
    color: #047857;

    .chip-badge {
      background: #a7f3d0;
      color: #065f46;
    }
  }

  .chip-badge {
    font-size: 0.65rem;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 4px;
    background: #f1f5f9;
    color: #64748b;
    text-transform: uppercase;
  }
}

.method-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 6px;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;

  &.tag-transfer {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  &.tag-cash {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }
}

.account-select-icon-pill {
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &.pill-bank {
    background: rgba(99, 102, 241, 0.12);
    color: #4f46e5;
  }

  &.pill-cash {
    background: rgba(16, 185, 129, 0.12);
    color: #059669;
  }
}

.account-summary-bar {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;

  .summary-icon {
    width: 24px;
    height: 24px;
    min-width: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;

    &.is-bank {
      background: rgba(99, 102, 241, 0.12);
      color: #4f46e5;
    }

    &.is-cash {
      background: rgba(16, 185, 129, 0.12);
      color: #059669;
    }
  }
}

.method-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;

  &.method-cash {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  &.method-transfer {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }
}

.empty-state-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-emerald {
  color: #059669 !important;
}

.text-amber {
  color: #d97706 !important;
}
</style>
