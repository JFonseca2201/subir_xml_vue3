<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'
import AporteCreateDialog from '@/components/inventory/aportes/AporteCreateDialog.vue'
import OperationsHeaderNav from '@/components/operations/OperationsHeaderNav.vue'

import { usePermissions } from '@/composables/usePermissions'

// --- Router y Seguridad ---
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const { can } = usePermissions()

const canAccessOperations = computed(() => {
  return can('list_transaction')
})

// --- Estado del Componente ---
const recentMovements = ref([]) // Datos agrupados para el template
const rawMovementsList = ref([]) // Datos planos de movimientos
const rawTransfersList = ref([]) // Datos planos de transferencias
const accounts = ref([]) // Cuentas bancarias del sistema
const loading = ref(true)
const isTransferDialogVisible = ref(false)
const isAporteDialogVisible = ref(false)
const pdfLoading = ref(false)

const financialSummary = ref({
  monthlyIncome: 0,
  monthlyExpense: 0,
  currentBalance: 0,
  lastTransfer: { amount: 0, from: 'N/A', to: 'N/A', date: '-' },
  alerts: [],
})

const mainCards = [
  {
    title: 'Socios',
    description: 'Aportes de capital',
    icon: 'ri-group-line',
    color: 'primary',
    buttonText: 'Registrar aporte',
    action: 'register-contribution',
  },
  {
    title: 'Gestión de pagos nómina',
    description: 'Pagos y adelantos al personal',
    icon: 'ri-user-3-line',
    color: 'primary',
    buttonText: 'Registrar pagos/adelantos',
    action: 'employee-expenses',
  },
  {
    title: 'Transferencias internas',
    description: 'Transferencias entre cuentas',
    icon: 'ri-arrow-left-right-line',
    color: 'primary',
    buttonText: 'Nueva transferencia',
    action: 'transfer',
  },
]

// Determinar método de pago real (TRANSFERENCIA vs EFECTIVO)
const getPaymentMethod = (movement, accountsList = []) => {
  const rawMethod = (
    movement.method ||
        movement.payment_method ||
        movement.metodo_pago ||
        movement.movable?.metodo_pago ||
        movement.movable?.payment_method ||
        movement.metadata?.metodo ||
        movement.metadata?.payment_method ||
        ''
  ).toString().toUpperCase()

  if (rawMethod.includes('TRANS') || rawMethod.includes('TRANSFER') || rawMethod.includes('BANCO') || rawMethod.includes('DEPOSITO')) {
    return 'TRANSFERENCIA'
  }

  let accountId = movement.account_id
  if (movement.payment_distributions && movement.payment_distributions.length > 0) {
    accountId = movement.payment_distributions[0].account_id || movement.payment_distributions[0].account || accountId
  }

  if (accountId && accountsList.length > 0) {
    const account = accountsList.find(acc => String(acc.id) === String(accountId))
    if (account) {
      const accType = (account.type || '').toLowerCase()
      const bankName = (account.bank_name || '').toLowerCase()
      const accName = (account.name || '').toLowerCase()

      if (accType === 'bank' || (bankName && !bankName.includes('efectivo') && !bankName.includes('caja'))) {
        return 'TRANSFERENCIA'
      }
      if (accName.includes('transferencia') || accName.includes('banco') || accName.includes('pichincha') || accName.includes('guayaquil') || accName.includes('produbanco') || accName.includes('pacifico')) {
        return 'TRANSFERENCIA'
      }
      if (accType === 'cash' || bankName.includes('efectivo') || bankName.includes('caja') || accName.includes('efectivo') || accName.includes('caja')) {
        return 'EFECTIVO'
      }
    }
  }

  const accLabel = (movement.account_name || movement.account_label || '').toLowerCase()
  if (accLabel.includes('transferencia') || accLabel.includes('banco') || accLabel.includes('pichincha') || accLabel.includes('guayaquil') || accLabel.includes('produbanco') || accLabel.includes('pacifico')) {
    return 'TRANSFERENCIA'
  }

  if (rawMethod === 'CASH') return 'EFECTIVO'

  return 'EFECTIVO'
}

// --- Lógica de Procesamiento ---

const groupMovementsByDate = movements => {
  if (!movements || !Array.isArray(movements)) return []

  const groups = {}

  movements.forEach(m => {
    const rawDate = m.entry_date || 'Sin fecha'
    const dateKey = rawDate !== 'Sin fecha' ? rawDate.split('T')[0] : 'Sin fecha'

    if (!groups[dateKey]) {
      let displayDate = 'Sin fecha'
      if (rawDate !== 'Sin fecha') {
        displayDate = new Intl.DateTimeFormat('es-EC', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(rawDate))

        displayDate = displayDate.charAt(0).toUpperCase() + displayDate.slice(1)
      }
      groups[dateKey] = { dateKey, date: displayDate, movements: [] }
    }

    let finalDesc = m.description || m.movable?.descripcion || 'Movimiento General'
    if (finalDesc.trim().endsWith(':') && m.movable?.descripcion) {
      finalDesc = `${finalDesc.trim()} ${m.movable.descripcion}`
    }

    let moduleName = 'General'
    if (m.movable_type) {
      const type = m.movable_type.split('\\').pop()
      const typeMap = {
        'AporteCapital': 'Aporte de Socio',
        'EmployeeExpense': 'Gasto de Personal',
        'EmployeePayment': 'Pago de Nómina',
        'EmployeeAdvance': 'Adelanto de Nómina',
        'PaymentDistribution': 'Egreso / Pago',
        'Income': 'Ingreso Manual',
        'Expense': 'Egreso Manual',
        'FinanceRecord': 'Registro Financiero',
        'Sale': 'Venta',
        'Purchase': 'Compra / Gasto',
      }

      moduleName = typeMap[type] || type.replace(/([A-Z])/g, ' $1').trim()
    }

    const method = getPaymentMethod(m, accounts.value)

    groups[dateKey].movements.push({
      id: m.id,
      type: m.type, // 'income' | 'expense'
      description: finalDesc,
      module: moduleName,
      method: method,
      entry_date: m.entry_date || m.created_at,
      time: m.created_at ? new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '--:--',
      amount: parseFloat(m.amount || 0),
    })
  })

  return Object.values(groups).sort((a, b) => {
    if (a.dateKey === 'Sin fecha') return 1
    if (b.dateKey === 'Sin fecha') return -1

    return new Date(b.dateKey) - new Date(a.dateKey)
  })
}

const dashboardOptions = async () => {
  loading.value = true
  try {
    const [response, accountsRes] = await Promise.all([
      $api('/dashboard-financiero'),
      $api('accounts').catch(() => []),
    ])

    if (accountsRes && Array.isArray(accountsRes)) {
      accounts.value = accountsRes
    }

    if (response.summary) {
      financialSummary.value = {
        ...financialSummary.value,
        monthlyIncome: response.summary.monthlyIncome,
        monthlyExpense: response.summary.monthlyExpense,
        currentBalance: response.summary.currentBalance,
      }
    }

    rawMovementsList.value = response.movements || []
    recentMovements.value = groupMovementsByDate(response.movements)

    try {
      const transfersResponse = await $api('transfers')
      let dataArray = []
      
      if (transfersResponse.data) {
        dataArray = transfersResponse.data
      } else if (Array.isArray(transfersResponse)) {
        dataArray = transfersResponse
      }

      const flatTransfers = []

      dataArray.forEach(group => {
        const items = group.transfers || [group]

        items.forEach(t => flatTransfers.push(t))
      })

      rawTransfersList.value = flatTransfers

      if (flatTransfers.length > 0) {
        const lastTransferObj = flatTransfers[0]
        const tDate = (lastTransferObj.transfer_date || lastTransferObj.created_at || '').split('T')[0]

        financialSummary.value = {
          ...financialSummary.value,
          lastTransfer: {
            amount: parseFloat(lastTransferObj.amount || 0),
            date: tDate || '-',
          },
        }
      }
    } catch (e) {
      console.warn('No se pudieron cargar las transferencias', e)
    }

  } catch (error) {
    console.error('Error al cargar datos del dashboard:', error)
    showNotification('No se pudieron cargar los datos financieros', 'error')
  } finally {
    loading.value = false
  }
}

// --- Utilidades ---
const handleCardAction = action => {
  switch (action) {
  case 'employee-expenses': router.push('/finanzas/employee-expenses'); break
  case 'register-contribution': isAporteDialogVisible.value = true; break
  case 'movements-index': router.push({ name: 'movements-index' }); break
  case 'transfer': isTransferDialogVisible.value = true; break
  }
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const cleanAccountName = name => {
  if (!name) return 'N/A'
  
  return name
    .replace(/\(EFECTIVO\)/gi, '')
    .replace(/\(TRANSFERENCIA\)/gi, '')
    .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
    .trim()
}

const formatDate = date => {
  if (!date) return 'N/A'
  try {
    const dStr = typeof date === 'string' ? date.split('T')[0] : date
    const [year, month, day] = dStr.split('-')
    if (year && month && day) return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
    
    return dStr
  } catch (e) {
    return 'N/A'
  }
}

// Generar PDF DIRECTAMENTE EN EL BACKEND (Separado por tipo de movimiento)
const generatePDF = async () => {
  pdfLoading.value = true
  try {
    const todayISO = new Date().toISOString().split('T')[0]

    const params = {
      group_by_type: true,
      separate_sections: true,
      include_transfers: true,
      include_incomes: true,
      include_expenses: true,
    }

    let response
    try {
      response = await $api('financial-movements/pdf', {
        method: 'POST',
        body: params,
        responseType: 'blob',
      })
    } catch (postErr) {
      console.warn('POST a financial-movements/pdf falló, reintentando con GET:', postErr)
      response = await $api('financial-movements/pdf', {
        method: 'GET',
        params: params,
        responseType: 'blob',
      })
    }

    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `Reporte_Operaciones_${todayISO}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    showNotification('Reporte PDF (separado por tipos) generado exitosamente desde el servidor', 'success')
  } catch (error) {
    console.error('Error al generar PDF en el backend:', error)
    showNotification('Error al solicitar el reporte PDF al servidor.', 'error')
  } finally {
    pdfLoading.value = false
  }
}

onMounted(() => {
  dashboardOptions()
})
</script>

<template>
  <div class="operations-dashboard-page">
    <!-- Pantalla de Bloqueo -->
    <div
      v-if="!canAccessOperations"
      class="d-flex justify-center align-center"
      style="height: 400px"
    >
      <VCard
        class="pa-6 text-center"
        elevation="4"
        rounded="xl"
      >
        <VIcon
          size="64"
          color="error"
          class="mb-4"
        >
          ri-lock-line
        </VIcon>
        <h3 class="text-h5 mb-2">
          Acceso Restringido
        </h3>
        <p class="text-medium-emphasis">
          No tienes permisos para acceder a la gestión de operaciones.
        </p>
        <VBtn
          color="primary"
          class="mt-4"
          @click="router.push('/dashboard')"
        >
          Volver al Dashboard
        </VBtn>
      </VCard>
    </div>

    <!-- Dashboard Principal -->
    <div v-else>
      <!-- Encabezado y Navegación de Operaciones Compartido -->
      <OperationsHeaderNav active-tab="dashboard" />

      <VRow class="mt-2">
        <!-- Columna Movimientos (Izquierda) -->
        <VCol
          cols="12"
          md="8"
        >
          <VCard
            elevation="1"
            class="rounded-xl border-light h-100 position-relative overflow-hidden"
          >
            <VProgressLinear
              v-if="loading"
              indeterminate
              color="primary"
              height="3"
              class="position-absolute"
              style="top: 0; left: 0; right: 0; z-index: 10;"
            />
            
            <VCardItem class="pa-4 border-b bg-white">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    size="36"
                    class="rounded-lg"
                  >
                    <VIcon
                      icon="ri-history-line"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <span class="font-weight-bold text-h6 text-slate-900">Movimientos Recientes</span>
                  </div>
                </div>
              </template>
              <template #append>
                <VBtn
                  color="success"
                  prepend-icon="ri-file-pdf-line"
                  :loading="pdfLoading"
                  size="small"
                  variant="elevated"
                  class="font-weight-semibold elevation-1"
                  @click="generatePDF"
                >
                  Generar PDF
                </VBtn>
              </template>
            </VCardItem>

            <VCardText class="pa-0">
              <!-- Cargando (Skeleton List) -->
              <VList
                v-if="loading"
                lines="two"
                class="bg-transparent pa-0"
              >
                <div
                  v-for="n in 4"
                  :key="n"
                  class="pa-4 border-b d-flex align-center"
                >
                  <div class="shimmer-circle mr-4" />
                  <div class="flex-grow-1">
                    <div class="shimmer-line w-50 mb-2" />
                    <div class="shimmer-line w-75" />
                  </div>
                  <div class="text-right">
                    <div class="shimmer-line w-40 ms-auto" />
                  </div>
                </div>
              </VList>

              <!-- Sin resultados -->
              <div
                v-else-if="recentMovements.length === 0"
                class="pa-10 text-center text-medium-emphasis"
              >
                <VAvatar
                  color="primary"
                  variant="tonal"
                  size="72"
                  class="mb-4"
                >
                  <VIcon
                    icon="ri-folder-info-line"
                    size="36"
                  />
                </VAvatar>
                <h3 class="text-h6 font-weight-bold text-high-emphasis">
                  No hay movimientos
                </h3>
                <p class="text-body-2 text-medium-emphasis mt-1">
                  No se encontraron registros financieros para este mes.
                </p>
              </div>

              <!-- Lista Agrupada por Día -->
              <div
                v-else
                class="overflow-y-auto"
                style="max-height: 600px;"
              >
                <template
                  v-for="day in recentMovements"
                  :key="day.dateKey"
                >
                  <!-- Subheader de Día -->
                  <div class="operations-date-header d-flex align-center justify-space-between px-4 py-2">
                    <div class="d-flex align-center gap-2">
                      <VIcon icon="ri-calendar-event-line" size="16" color="primary" />
                      <span class="text-caption font-weight-bold text-uppercase text-slate-700 tracking-wider">
                        {{ day.date }}
                      </span>
                    </div>
                    <VChip size="x-small" color="primary" variant="tonal" class="font-weight-bold">
                      {{ day.movements.length }} {{ day.movements.length === 1 ? 'movimiento' : 'movimientos' }}
                    </VChip>
                  </div>

                  <!-- Filas de Movimiento -->
                  <div
                    v-for="movement in day.movements"
                    :key="movement.id"
                    class="operations-movement-item d-flex align-center justify-space-between gap-3 px-4 py-3"
                  >
                    <!-- Izquierda: Avatar + Detalles -->
                    <div class="d-flex align-center gap-3">
                      <VAvatar
                        :color="movement.type === 'transfer' ? 'info' : (movement.type === 'income' ? 'success' : 'error')"
                        variant="tonal"
                        size="40"
                        class="rounded-lg shrink-0"
                      >
                        <VIcon
                          :icon="movement.type === 'transfer' ? 'ri-arrow-left-right-line' : (movement.type === 'income' ? 'ri-arrow-down-line' : 'ri-arrow-up-line')"
                          size="20"
                        />
                      </VAvatar>

                      <div class="d-flex flex-column text-left">
                        <span class="text-body-1 font-weight-bold text-slate-900 mb-1">
                          {{ movement.description }}
                        </span>

                        <div class="d-flex align-center flex-wrap gap-2 text-caption text-medium-emphasis">
                          <VChip
                            size="x-small"
                            variant="tonal"
                            color="secondary"
                            class="font-weight-medium"
                          >
                            <VIcon start icon="ri-folder-open-line" size="12" />
                            {{ movement.module }}
                          </VChip>

                          <span class="opacity-40">•</span>

                          <span class="d-flex align-center font-weight-medium text-slate-700">
                            <VIcon
                              :icon="movement.method === 'TRANSFERENCIA' ? 'ri-bank-card-line' : 'ri-money-dollar-circle-line'"
                              size="14"
                              class="me-1 text-slate-500"
                            />
                            {{ movement.method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo' }}
                          </span>

                          <span class="opacity-40">•</span>

                          <span class="d-flex align-center font-weight-medium text-slate-600">
                            <VIcon
                              icon="ri-time-line"
                              size="14"
                              class="me-1 text-slate-500"
                            />
                            {{ movement.time }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Derecha: Monto -->
                    <div class="text-right shrink-0 ps-2">
                      <span
                        class="text-subtitle-1 font-weight-black"
                        :class="movement.type === 'transfer' ? 'text-info' : (movement.type === 'income' ? 'text-success' : 'text-error')"
                      >
                        {{ movement.type === 'transfer' ? '' : (movement.type === 'income' ? '+' : '-') }}
                        {{ formatCurrency(movement.amount) }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Lateral (Resumen Financiero) -->
        <VCol
          cols="12"
          md="4"
          class="d-flex flex-column gap-5"
        >
          <!-- Resumen Financiero Card -->
          <VCard
            elevation="1"
            class="rounded-xl border-light overflow-hidden"
          >
            <VCardItem class="pa-4 border-b bg-white">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    size="36"
                    class="rounded-lg"
                  >
                    <VIcon
                      icon="ri-pie-chart-line"
                      size="20"
                    />
                  </VAvatar>
                  <span class="font-weight-bold text-h6 text-slate-900">Resumen Financiero</span>
                </div>
              </template>
            </VCardItem>
            
            <VCardText class="pa-4">
              <!-- Ingresos del Mes -->
              <div class="pa-3 rounded-lg bg-success-tonal border-success mb-3 d-flex justify-space-between align-center">
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-arrow-down-circle-line" color="success" size="20" />
                  <span class="text-body-2 font-weight-bold text-slate-700">Ingresos del mes</span>
                </div>
                <span class="text-success font-weight-black text-subtitle-1">{{ formatCurrency(financialSummary.monthlyIncome) }}</span>
              </div>

              <!-- Egresos del Mes -->
              <div class="pa-3 rounded-lg bg-error-tonal border-error mb-4 d-flex justify-space-between align-center">
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-arrow-up-circle-line" color="error" size="20" />
                  <span class="text-body-2 font-weight-bold text-slate-700">Egresos del mes</span>
                </div>
                <span class="text-error font-weight-black text-subtitle-1">{{ formatCurrency(financialSummary.monthlyExpense) }}</span>
              </div>

              <VDivider class="mb-4" />

              <!-- Balance Actual -->
              <div class="pa-4 rounded-xl bg-primary-tonal border-primary">
                <div class="text-caption text-uppercase font-weight-bold text-primary tracking-wider mb-1">
                  Balance Neto Actual
                </div>
                <div class="text-h5 font-weight-black text-primary">
                  {{ formatCurrency(financialSummary.currentBalance) }}
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                  Diferencia entre ingresos y egresos
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- Info Adicional Card -->
          <VCard
            elevation="1"
            class="rounded-xl border-light overflow-hidden"
          >
            <VCardItem class="pa-4 border-b bg-white">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    color="info"
                    variant="tonal"
                    size="36"
                    class="rounded-lg"
                  >
                    <VIcon
                      icon="ri-information-line"
                      size="20"
                    />
                  </VAvatar>
                  <span class="font-weight-bold text-h6 text-slate-900">Info. Adicional</span>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4">
              <div class="d-flex align-center gap-3 pa-3 rounded-lg bg-info-tonal border-info">
                <VAvatar
                  color="info"
                  variant="elevated"
                  size="40"
                  class="rounded-lg elevation-1"
                >
                  <VIcon
                    icon="ri-exchange-line"
                    size="20"
                    color="white"
                  />
                </VAvatar>
                <div>
                  <div class="text-caption text-info font-weight-bold text-uppercase tracking-wider">
                    Última transferencia
                  </div>
                  <div class="font-weight-black text-h6 text-slate-900">
                    {{ formatCurrency(financialSummary.lastTransfer.amount) }}
                  </div>
                  <div class="text-caption text-medium-emphasis d-flex align-center gap-1 mt-0">
                    <VIcon
                      icon="ri-calendar-event-line"
                      size="12"
                    />
                    {{ financialSummary.lastTransfer.date }}
                  </div>
                </div>
              </div>

              <div v-if="financialSummary.alerts && financialSummary.alerts.length > 0">
                <VAlert
                  v-for="alert in financialSummary.alerts"
                  :key="alert"
                  color="warning"
                  variant="tonal"
                  density="compact"
                  class="mt-3 rounded-lg"
                >
                  <template #prepend>
                    <VIcon
                      icon="ri-alert-line"
                      size="small"
                    />
                  </template>
                  {{ alert }}
                </VAlert>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <TransferDialog v-model="isTransferDialogVisible" />
      <AporteCreateDialog v-model="isAporteDialogVisible" />
    </div>
  </div>
</template>

