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

const paymentMethods = [
  { title: 'Efectivo', value: 'Efectivo' },
  { title: 'Transferencia', value: 'Transferencia' },
  { title: 'Depósito', value: 'Depósito' },
  { title: 'Tarjeta de Débito/Crédito', value: 'Tarjeta' },
]

// Cargar cuentas disponibles
const loadAccounts = async () => {
  try {
    const response = await $api('accounts')

    accounts.value = response?.data || response || []
    
    // Default to Cash account (Caja Chica)
    if (!form.value.account_id && accounts.value.length > 0) {
      const cashAcc = accounts.value.find(a => a.type === 'cash' || a.name?.toLowerCase().includes('caja'))

      form.value.account_id = cashAcc ? cashAcc.id : accounts.value[0].id
    }
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
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

watch(() => props.isDialogVisible, val => {
  if (val && props.workOrder?.id) {
    form.value = {
      amount: '',
      account_id: form.value.account_id || (accounts.value[0]?.id ?? null),
      payment_method: 'Efectivo',
      advance_date: todayDate(),
      notes: '',
    }
    loadAccounts()
    loadAdvances()
  }
})

// Auto sync payment method with account type
watch(() => form.value.account_id, accId => {
  if (!accId) return
  const acc = accounts.value.find(a => a.id === accId)
  if (acc) {
    if (acc.type === 'cash' || acc.name?.toLowerCase().includes('caja')) {
      form.value.payment_method = 'Efectivo'
    } else if (acc.type === 'bank' || acc.name?.toLowerCase().includes('banco') || acc.name?.toLowerCase().includes('transferencia')) {
      form.value.payment_method = 'Transferencia'
    }
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
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="580"
    persistent
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="rounded-xl overflow-hidden border">
      <!-- Header -->
      <VCardItem class="bg-primary text-white py-4 px-6">
        <template #prepend>
          <VAvatar
            size="40"
            color="white"
            variant="tonal"
            class="rounded-lg me-2"
          >
            <VIcon
              icon="ri-hand-coin-line"
              size="24"
              color="white"
            />
          </VAvatar>
        </template>
        <VCardTitle class="text-h6 font-weight-bold text-white d-flex align-center gap-2 flex-wrap">
          <span>Gestión de Abonos / Anticipos</span>
          <VChip
            size="small"
            color="white"
            variant="flat"
            class="text-primary font-weight-bold font-mono"
          >
            {{ props.workOrder?.number || `OT #${props.workOrder?.id}` }}
          </VChip>
        </VCardTitle>
        <VCardSubtitle class="text-white text-opacity-90 text-caption mt-0.5">
          Cliente: <strong>{{ props.workOrder?.client?.full_name || props.workOrder?.client?.name || 'Cliente' }}</strong>
          <span
            v-if="props.workOrder?.vehicle?.license_plate"
            class="ms-2"
          >
            · Vehículo: <strong>{{ props.workOrder.vehicle.license_plate }}</strong> ({{ props.workOrder.vehicle.brand }} {{ props.workOrder.vehicle.model }})
          </span>
        </VCardSubtitle>
        <template #append>
          <VBtn
            icon="ri-close-line"
            variant="text"
            color="white"
            density="compact"
            @click="closeDialog"
          />
        </template>
      </VCardItem>

      <VCardText class="pa-5 bg-background">
        <!-- Tarjetas Resumen de Totales -->
        <VRow
          dense
          class="mb-4"
        >
          <VCol
            cols="12"
            sm="4"
          >
            <VCard class="border rounded-xl pa-3 bg-surface elevation-0 text-center">
              <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Presupuesto OT</span>
              <div class="text-h6 font-weight-bold text-slate-800 font-mono mt-1">
                {{ formatCurrency(totalAmount) }}
              </div>
            </VCard>
          </VCol>

          <VCol
            cols="12"
            sm="4"
          >
            <VCard class="border rounded-xl pa-3 bg-emerald-50 border-emerald-200 elevation-0 text-center">
              <span class="text-caption text-emerald-800 font-weight-medium text-uppercase">Abonos Realizados</span>
              <div class="text-h6 font-weight-bold text-emerald-700 font-mono mt-1">
                {{ formatCurrency(totalAdvances) }}
              </div>
            </VCard>
          </VCol>

          <VCol
            cols="12"
            sm="4"
          >
            <VCard
              class="border rounded-xl pa-3 elevation-0 text-center"
              :class="balanceDue > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50'"
            >
              <span class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Saldo Pendiente</span>
              <div
                class="text-h6 font-weight-bold font-mono mt-1"
                :class="balanceDue > 0 ? 'text-amber-900 font-weight-black' : 'text-slate-600'"
              >
                {{ formatCurrency(balanceDue) }}
              </div>
            </VCard>
          </VCol>
        </VRow>

        <!-- Banner si la orden ya está facturada -->
        <VAlert
          v-if="isInvoiced"
          type="info"
          variant="tonal"
          class="mb-4 rounded-xl border"
          icon="ri-information-line"
        >
          <div class="font-weight-bold">
            Orden de Trabajo Facturada
          </div>
          <div class="text-caption">
            Esta orden de trabajo ya ha sido convertida en venta/factura. No se pueden registrar nuevos abonos ni modificarlos.
          </div>
        </VAlert>

        <!-- Formulario de Nuevo Abono -->
        <VCard
          v-if="!isInvoiced"
          class="border rounded-xl mb-5 bg-surface elevation-0"
        >
          <div class="px-4 py-3 bg-slate-50 border-b d-flex align-center gap-2">
            <VIcon
              icon="ri-add-circle-line"
              color="primary"
              size="20"
            />
            <h4 class="text-subtitle-2 font-weight-bold text-slate-800 mb-0">
              Registrar Nuevo Abono
            </h4>
          </div>
          <VCardText class="pa-4">
            <VRow dense>
              <!-- Monto y botones rápidos -->
              <VCol
                cols="12"
                sm="4"
              >
                <VTextField
                  v-model="form.amount"
                  label="Monto a Abonar ($)"
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0.01"
                  prepend-inner-icon="ri-money-dollar-circle-line"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  autofocus
                  hide-details="auto"
                />
                <div class="d-flex gap-1 mt-1.5 flex-wrap">
                  <VBtn
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    @click="setQuickAmount(10)"
                  >
                    $10
                  </VBtn>
                  <VBtn
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    @click="setQuickAmount(20)"
                  >
                    $20
                  </VBtn>
                  <VBtn
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    @click="setQuickAmount(50)"
                  >
                    $50
                  </VBtn>
                  <VBtn
                    v-if="balanceDue > 0"
                    size="x-small"
                    variant="flat"
                    color="warning"
                    @click="setQuickAmount('full')"
                  >
                    Total ({{ formatCurrency(balanceDue) }})
                  </VBtn>
                </div>
              </VCol>

              <!-- Cuenta Destino -->
              <VCol
                cols="12"
                sm="4"
              >
                <VSelect
                  v-model="form.account_id"
                  :items="accounts"
                  item-title="name"
                  item-value="id"
                  label="Cuenta a Ingresar"
                  prepend-inner-icon="ri-bank-card-line"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  hide-details="auto"
                />
              </VCol>

              <!-- Método de Pago -->
              <VCol
                cols="12"
                sm="4"
              >
                <VSelect
                  v-model="form.payment_method"
                  :items="paymentMethods"
                  label="Método de Pago"
                  prepend-inner-icon="ri-wallet-3-line"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  hide-details="auto"
                />
              </VCol>

              <!-- Fecha -->
              <VCol
                cols="12"
                sm="4"
                class="mt-2"
              >
                <VTextField
                  v-model="form.advance_date"
                  type="date"
                  label="Fecha de Recepción"
                  prepend-inner-icon="ri-calendar-line"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  hide-details="auto"
                />
              </VCol>

              <!-- Detalle / Nota -->
              <VCol
                cols="12"
                sm="5"
                class="mt-2"
              >
                <VTextField
                  v-model="form.notes"
                  label="Detalle / Referencia (Opcional)"
                  placeholder="Ej: Separación amortiguadores, abono repuesto..."
                  prepend-inner-icon="ri-file-text-line"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  hide-details="auto"
                />
              </VCol>

              <!-- Botón Guardar -->
              <VCol
                cols="12"
                sm="3"
                class="mt-2 d-flex align-center"
              >
                <VBtn
                  color="primary"
                  variant="elevated"
                  block
                  size="large"
                  prepend-icon="ri-check-line"
                  :loading="isSubmitting"
                  class="font-weight-bold"
                  @click="submitAdvance"
                >
                  Registrar
                </VBtn>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <!-- Historial de Abonos Registrados -->
        <div class="d-flex align-center justify-space-between mb-2">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-slate-800">
            <VIcon
              icon="ri-history-line"
              color="info"
              size="18"
            />
            <span>Historial de Abonos en esta Orden ({{ advances.length }})</span>
          </div>
          <VBtn
            size="small"
            variant="text"
            color="info"
            prepend-icon="ri-refresh-line"
            :loading="isLoading"
            @click="loadAdvances"
          >
            Actualizar
          </VBtn>
        </div>

        <VCard class="border rounded-xl bg-surface elevation-0 overflow-hidden">
          <VTable
            v-if="advances.length > 0"
            hover
            density="comfortable"
            class="text-caption"
          >
            <thead>
              <tr class="bg-slate-50 text-uppercase font-weight-bold">
                <th class="py-2.5">
                  N° Recibo
                </th>
                <th class="py-2.5">
                  Fecha
                </th>
                <th class="py-2.5">
                  Cuenta & Método
                </th>
                <th class="py-2.5">
                  Detalle
                </th>
                <th class="py-2.5 text-right">
                  Monto
                </th>
                <th
                  class="py-2.5 text-center"
                  style="width: 100px;"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="adv in advances"
                :key="adv.id"
              >
                <td class="font-mono font-weight-bold text-primary py-2">
                  {{ adv.receipt_number || `REC-${adv.id}` }}
                </td>
                <td class="py-2">
                  {{ formatDate(adv.advance_date) }}
                </td>
                <td class="py-2">
                  <div class="font-weight-semibold text-slate-800">
                    {{ adv.account?.name || 'Caja' }}
                  </div>
                  <span
                    class="text-disabled"
                    style="font-size: 0.72rem;"
                  >{{ adv.payment_method }}</span>
                </td>
                <td class="py-2 text-medium-emphasis">
                  {{ adv.notes || 'Abono a cuenta' }}
                </td>
                <td
                  class="py-2 text-right font-weight-black font-mono text-emerald-700"
                  style="font-size: 0.9rem;"
                >
                  {{ formatCurrency(adv.amount) }}
                </td>
                <td class="py-2 text-center">
                  <div class="d-flex justify-center gap-1">
                    <VBtn
                      size="x-small"
                      color="info"
                      variant="tonal"
                      icon="ri-printer-line"
                      title="Imprimir Comprobante de Abono"
                      @click="printReceipt(adv.id)"
                    />
                    <VBtn
                      v-if="!isInvoiced"
                      size="x-small"
                      color="error"
                      variant="tonal"
                      icon="ri-delete-bin-line"
                      title="Anular Abono"
                      @click="deleteAdvance(adv.id)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>

          <div
            v-else
            class="pa-6 text-center text-medium-emphasis"
          >
            <VIcon
              icon="ri-coins-line"
              size="36"
              class="mb-2 text-disabled"
            />
            <div class="text-body-2 font-weight-medium">
              No se han registrado abonos en esta orden de trabajo todavía.
            </div>
            <p class="text-caption text-disabled mb-0">
              Usa el formulario superior para registrar anticipos en efectivo o transferencia.
            </p>
          </div>
        </VCard>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-surface d-flex justify-space-between align-center">
        <div class="text-caption text-medium-emphasis">
          <VIcon
            icon="ri-information-line"
            size="14"
            class="me-1"
          />
          Los abonos suman automáticamente al arqueo de caja del día y se descontarán al facturar.
        </div>
        <VBtn
          color="secondary"
          variant="outlined"
          @click="closeDialog"
        >
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
</style>
