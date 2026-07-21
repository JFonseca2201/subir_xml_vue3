<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'

// --- Router y Seguridad ---
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const currentUser = computed(() => {
  const userStr = localStorage.getItem('user')

  return userStr ? JSON.parse(userStr) : null
})

const canAccessOperations = computed(() => {
  const user = currentUser.value
  const roleId = user?.role?.id

  return user && roleId === 1
})

// --- Estado del Componente ---
const recentMovements = ref([]) // Datos agrupados para el template
const rawMovementsList = ref([]) // Datos planos de movimientos
const rawTransfersList = ref([]) // Datos planos de transferencias
const accounts = ref([]) // Cuentas bancarias del sistema
const loading = ref(true)
const isTransferDialogVisible = ref(false)
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
    color: 'success',
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
    title: 'Ingresos y Gastos',
    description: 'Registro de ingresos y egresos',
    icon: 'ri-exchange-dollar-line',
    color: 'warning',
    buttonText: 'Nuevo movimiento',
    action: 'movements-index',
  },
  {
    title: 'Transferencias internas',
    description: 'Transferencias entre cuentas',
    icon: 'ri-arrow-left-right-line',
    color: 'info',
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
      const typeMap = { 'AporteCapital': 'Aporte de Capital', 'EmployeeExpense': 'Gasto de Empleado', 'Income': 'Ingreso Manual', 'Expense': 'Egreso Manual' }

      moduleName = typeMap[type] || type
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
  loader.start()
  loading.value = true
  try {
    const [response, accountsRes] = await Promise.all([
      $api('/dashboard-financiero'),
      $api('accounts').catch(() => [])
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
            date: tDate || '-'
          }
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
    loader.stop()
  }
}

// --- Utilidades ---
const handleCardAction = action => {
  switch (action) {
    case 'employee-expenses': router.push('/finanzas/employee-expenses'); break
    case 'register-contribution': router.push({ name: 'aportes-index' }); break
    case 'movements-index': router.push({ name: 'movements-index' }); break
    case 'transfer': router.push('/transfers'); break
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
        responseType: 'blob'
      })
    } catch (postErr) {
      console.warn('POST a financial-movements/pdf falló, reintentando con GET:', postErr)
      response = await $api('financial-movements/pdf', {
        method: 'GET',
        params: params,
        responseType: 'blob'
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
  <div>
    <!-- Pantalla de Bloqueo -->
    <div v-if="!canAccessOperations" class="d-flex justify-center align-center" style="height: 400px">
      <VCard class="pa-6 text-center" elevation="4" rounded="xl">
        <VIcon size="64" color="error" class="mb-4">
          ri-lock-line
        </VIcon>
        <h3 class="text-h5 mb-2">
          Acceso Restringido
        </h3>
        <p class="text-medium-emphasis">
          No tienes permisos para acceder a la gestión de operaciones.
        </p>
        <VBtn color="primary" class="mt-4" @click="router.push('/dashboard')">
          Volver al Dashboard
        </VBtn>
      </VCard>
    </div>

    <!-- Dashboard Principal -->
    <div v-else>
      <!-- Cabecera -->
      <VRow class="mb-4">
        <VCol>
          <div class="d-flex align-center gap-3">
            <VAvatar color="primary" variant="tonal" rounded size="48">
              <VIcon icon="ri-exchange-funds-line" size="28" />
            </VAvatar>
            <div>
              <h4 class="text-h5 font-weight-bold mb-1">
                Gestión de Operaciones
              </h4>
              <span class="text-body-2 text-medium-emphasis">
                Control financiero integral para tu negocio
              </span>
            </div>
          </div>
        </VCol>
      </VRow>

      <!-- Cards de Acceso Rápido -->
      <VRow class="mb-6">
        <VCol v-for="card in mainCards" :key="card.title" cols="12" sm="6" md="3">
          <VCard
            elevation="2"
            class="h-100 rounded-lg cursor-pointer transition-swing"
            hover
            @click="handleCardAction(card.action)"
          >
            <VCardText class="d-flex flex-column align-center text-center pa-6">
              <VAvatar :color="card.color" variant="tonal" size="56" class="mb-4">
                <VIcon :icon="card.icon" size="28" />
              </VAvatar>
              <h5 class="text-subtitle-1 font-weight-bold mb-2">
                {{ card.title }}
              </h5>
              <span class="text-caption text-medium-emphasis">
                {{ card.description }}
              </span>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Estado de Carga -->
      <div v-if="loading" class="d-flex justify-center align-center py-12 my-12">
        <VProgressCircular indeterminate color="primary" size="48" width="5" />
      </div>

      <VRow v-else>
        <!-- Columna Movimientos -->
        <VCol cols="12" md="8">
          <VCard elevation="2" class="rounded-lg h-100">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-history-line" color="primary" />
                  <span class="font-weight-bold text-h6">Movimientos Recientes</span>
                </div>
              </template>
              <template #append>
                <VBtn
                  color="success"
                  prepend-icon="ri-file-pdf-line"
                  :loading="pdfLoading"
                  size="small"
                  variant="tonal"
                  @click="generatePDF"
                >
                  Generar PDF
                </VBtn>
              </template>
            </VCardItem>

            <VCardText class="pa-0">
              <div v-if="recentMovements.length === 0" class="pa-10 text-center text-medium-emphasis">
                <VAvatar color="grey-lighten-3" size="72" class="mb-4">
                  <VIcon icon="ri-folder-info-line" size="36" color="grey" />
                </VAvatar>
                <h3 class="text-h6 font-weight-medium">No hay movimientos</h3>
                <p class="text-body-2 mt-1">No se encontraron registros financieros para este mes.</p>
              </div>

              <VList v-else lines="two" class="bg-transparent" style="max-height: 550px; overflow-y: auto;">
                <template v-for="day in recentMovements" :key="day.dateKey">
                  <VListSubheader class="text-uppercase font-weight-bold text-primary bg-grey-50 pa-4 sticky-top">
                    {{ day.date }}
                  </VListSubheader>

                  <VListItem v-for="movement in day.movements" :key="movement.id" class="border-b movement-item">
                    <template #prepend>
                      <VAvatar
                        :color="movement.type === 'transfer' ? 'info' : (movement.type === 'income' ? 'success' : 'error')"
                        variant="tonal"
                        class="mr-4"
                      >
                        <VIcon :icon="movement.type === 'transfer' ? 'ri-arrow-left-right-line' : (movement.type === 'income' ? 'ri-arrow-down-line' : 'ri-arrow-up-line')" />
                      </VAvatar>
                    </template>

                    <VListItemTitle class="font-weight-medium mb-1">
                      {{ movement.description }}
                    </VListItemTitle>

                    <VListItemSubtitle>
                      <div class="d-flex align-center flex-wrap gap-2 text-caption">
                        <span class="d-flex align-center"><VIcon icon="ri-folder-open-line" size="14" class="mr-1"/>{{ movement.module }}</span>
                        <span class="opacity-50">•</span>
                        <span class="d-flex align-center"><VIcon :icon="movement.method === 'TRANSFERENCIA' ? 'ri-bank-card-line' : 'ri-money-dollar-circle-line'" size="14" class="mr-1"/>{{ movement.method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo' }}</span>
                        <span class="opacity-50">•</span>
                        <span class="d-flex align-center"><VIcon icon="ri-time-line" size="14" class="mr-1"/>{{ movement.time }}</span>
                      </div>
                    </VListItemSubtitle>

                    <template #append>
                      <div
                        class="font-weight-bold text-subtitle-1"
                        :class="movement.type === 'transfer' ? 'text-info' : (movement.type === 'income' ? 'text-success' : 'text-error')"
                      >
                        {{ movement.type === 'transfer' ? '' : (movement.type === 'income' ? '+' : '-') }}
                        {{ formatCurrency(movement.amount) }}
                      </div>
                    </template>
                  </VListItem>
                </template>
              </VList>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Lateral (Resumen) -->
        <VCol cols="12" md="4" class="d-flex flex-column gap-6">
          <VCard elevation="2" class="rounded-lg">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-pie-chart-line" color="primary" />
                  <span class="font-weight-bold text-h6">Resumen Financiero</span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-5">
              <div class="d-flex justify-space-between align-center mb-4">
                <span class="text-body-1 text-medium-emphasis">Ingresos del mes</span>
                <span class="text-success font-weight-bold text-subtitle-1">{{ formatCurrency(financialSummary.monthlyIncome) }}</span>
              </div>
              <div class="d-flex justify-space-between align-center mb-5">
                <span class="text-body-1 text-medium-emphasis">Egresos del mes</span>
                <span class="text-error font-weight-bold text-subtitle-1">{{ formatCurrency(financialSummary.monthlyExpense) }}</span>
              </div>
              <VDivider class="mb-5" />
              <div class="d-flex justify-space-between align-center">
                <span class="text-subtitle-1 font-weight-bold text-high-emphasis">Balance actual</span>
                <span class="text-h5 font-weight-black text-primary">{{ formatCurrency(financialSummary.currentBalance) }}</span>
              </div>
            </VCardText>
          </VCard>

          <VCard elevation="2" class="rounded-lg">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-information-line" color="primary" />
                  <span class="font-weight-bold text-h6">Info. Adicional</span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-5">
              <div class="d-flex align-start gap-4 mb-4">
                <VAvatar color="info" variant="tonal" rounded size="48">
                  <VIcon icon="ri-exchange-line" size="24" />
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis mb-1 text-uppercase font-weight-medium">Última transferencia</div>
                  <div class="font-weight-bold text-h6">{{ formatCurrency(financialSummary.lastTransfer.amount) }}</div>
                  <div class="text-caption text-medium-emphasis mt-1 d-flex align-center gap-1">
                    <VIcon icon="ri-calendar-event-line" size="14" />
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
                  class="mt-4"
                >
                  <template #prepend>
                    <VIcon icon="ri-alert-line" size="small" />
                  </template>
                  {{ alert }}
                </VAlert>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <TransferDialog v-model="isTransferDialogVisible" />
    </div>
  </div>
</template>
