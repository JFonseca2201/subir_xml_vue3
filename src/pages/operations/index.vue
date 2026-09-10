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

// Filtros de movimientos
const movementFilter = ref('all') // 'all' | 'income' | 'expense' | 'transfer'
const movementSearch = ref('')

// Órdenes de trabajo
const workOrdersStats = ref({
  in_progress: 0,
  ready_to_invoice: 0,
  total_month: 0,
})
const activeWorkOrders = ref([])
const workOrderFilter = ref('all') // 'all' | 'in_progress' | 'ready'

const financialSummary = ref({
  monthlyIncome: 0,
  monthlyExpense: 0,
  currentBalance: 0,
  incomeCount: 0,
  expenseCount: 0,
  lastTransfer: { amount: 0, from: 'N/A', to: 'N/A', date: '-' },
  alerts: [],
})

// Clasificar método de pago con banco específico
const getPaymentMethodInfo = (movement, accountsList = []) => {
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

  let accountId = movement.account_id
  if (movement.payment_distributions && movement.payment_distributions.length > 0) {
    accountId = movement.payment_distributions[0].account_id || movement.payment_distributions[0].account || accountId
  }

  let targetAccount = null
  if (accountId && accountsList.length > 0) {
    targetAccount = accountsList.find(acc => String(acc.id) === String(accountId))
  }

  const accName = (targetAccount?.name || movement.account_name || movement.account_label || '').toLowerCase()
  const bankName = (targetAccount?.bank_name || '').toLowerCase()

  if (accName.includes('pichincha') || bankName.includes('pichincha') || rawMethod.includes('PICHINCHA')) {
    return { type: 'PICHINCHA', label: 'B. Pichincha', icon: 'ri-bank-line', badgeClass: 'method-badge-pichincha' }
  }

  if (accName.includes('guayaquil') || bankName.includes('guayaquil') || rawMethod.includes('GUAYAQUIL')) {
    return { type: 'GUAYAQUIL', label: 'B. Guayaquil', icon: 'ri-bank-line', badgeClass: 'method-badge-guayaquil' }
  }

  if (rawMethod.includes('TRANS') || rawMethod.includes('BANCO') || rawMethod.includes('DEPOSITO') || (targetAccount && targetAccount.type === 'bank')) {
    return { type: 'TRANSFERENCIA', label: 'Transferencia', icon: 'ri-arrow-left-right-line', badgeClass: 'method-badge-transfer' }
  }

  return { type: 'EFECTIVO', label: 'Efectivo', icon: 'ri-bill-line', badgeClass: 'method-badge-cash' }
}

// Extraer OT y Vehículo asociados al movimiento
const extractWorkOrderAndVehicle = m => {
  let workOrderNumber = null
  let workOrderId = null
  let licensePlate = null
  let clientName = null

  // Desde movable (Sale)
  if (m.movable) {
    if (m.movable.work_order_number) workOrderNumber = m.movable.work_order_number
    if (m.movable.work_order_id) workOrderId = m.movable.work_order_id
    if (m.movable.workOrder) {
      workOrderNumber = workOrderNumber || m.movable.workOrder.number
      workOrderId = workOrderId || m.movable.workOrder.id
      if (m.movable.workOrder.vehicle?.license_plate) {
        licensePlate = m.movable.workOrder.vehicle.license_plate
      }
    }

    if (!licensePlate && m.movable.vehicle?.license_plate) {
      licensePlate = m.movable.vehicle.license_plate
    }

    if (m.movable.client) {
      clientName = m.movable.client.full_name || `${m.movable.client.name || ''} ${m.movable.client.surname || ''}`.trim()
    }

    // Si es PaymentDistribution
    if (m.movable.finance_record) {
      if (m.movable.finance_record.work_order_number) {
        workOrderNumber = workOrderNumber || m.movable.finance_record.work_order_number
      }
    }
  }

  // Desde metadata
  if (m.metadata) {
    if (!workOrderNumber && (m.metadata.work_order_number || m.metadata.work_order || m.metadata.ot)) {
      workOrderNumber = m.metadata.work_order_number || m.metadata.work_order || m.metadata.ot
    }
    if (!licensePlate && (m.metadata.license_plate || m.metadata.placa)) {
      licensePlate = m.metadata.license_plate || m.metadata.placa
    }
  }

  // Si el número de OT no tiene prefijo "OT-", formatearlo
  if (workOrderNumber && !String(workOrderNumber).toUpperCase().startsWith('OT')) {
    workOrderNumber = `OT-${workOrderNumber}`
  }

  return { workOrderNumber, workOrderId, licensePlate, clientName }
}

// Agrupar movimientos por fecha
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
      groups[dateKey] = {
        dateKey,
        date: displayDate,
        totalIncome: 0,
        totalExpense: 0,
        movements: [],
      }
    }

    let finalDesc = m.description || m.movable?.descripcion || 'Movimiento General'
    if (finalDesc.trim().endsWith(':') && m.movable?.descripcion) {
      finalDesc = `${finalDesc.trim()} ${m.movable.descripcion}`
    }

    let moduleName = 'General'
    if (m.movable_type) {
      const type = m.movable_type.split('\\').pop()
      const typeMap = {
        'AporteCapital': 'Aporte Socio',
        'EmployeeExpense': 'Gasto Personal',
        'EmployeePayment': 'Nómina',
        'EmployeeAdvance': 'Adelanto',
        'PaymentDistribution': 'Egreso / Pago',
        'Income': 'Ingreso',
        'Expense': 'Egreso',
        'FinanceRecord': 'Registro Financiero',
        'Sale': 'Venta',
        'Purchase': 'Compra',
      }
      moduleName = typeMap[type] || type.replace(/([A-Z])/g, ' $1').trim()
    }

    const methodInfo = getPaymentMethodInfo(m, accounts.value)
    const { workOrderNumber, workOrderId, licensePlate, clientName } = extractWorkOrderAndVehicle(m)
    const amountVal = parseFloat(m.amount || 0)

    // Limpieza y formateo del título principal y subtítulo
    let displayTitle = finalDesc
    let displaySubtitle = clientName || null

    const saleMatch = finalDesc.match(/Venta:\s*(invoice|factura|nota_venta|sale|quote)?\s*[-–]?\s*(\d+)/i)
    if (saleMatch) {
      const docType = (saleMatch[1] || '').toLowerCase()
      const docNum = saleMatch[2]
      const label = (docType === 'invoice' || docType === 'factura') ? 'Factura' : (docType === 'quote' ? 'Cotización' : 'Nota de Venta')
      displayTitle = `${label} #${docNum}`
    } else if (finalDesc.toLowerCase().startsWith('venta:')) {
      displayTitle = finalDesc.replace(/Venta:\s*/i, '').replace(/-\s*(Transferencia|Efectivo|Transfer|Cash)/gi, '').trim()
    } else if (finalDesc.toLowerCase().startsWith('pago por compra a proveedor')) {
      displayTitle = finalDesc.replace(/Pago por Compra a Proveedor/i, 'Compra:').trim()
    }

    if (m.type === 'income') {
      groups[dateKey].totalIncome += amountVal
    } else if (m.type === 'expense') {
      groups[dateKey].totalExpense += amountVal
    }

    groups[dateKey].movements.push({
      id: m.id,
      type: m.type, // 'income' | 'expense' | 'transfer'
      description: finalDesc,
      displayTitle: displayTitle,
      displaySubtitle: displaySubtitle,
      module: moduleName,
      methodInfo: methodInfo,
      workOrderNumber: workOrderNumber,
      workOrderId: workOrderId,
      licensePlate: licensePlate,
      clientName: clientName,
      entry_date: m.entry_date || m.created_at,
      time: m.created_at ? new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '--:--',
      amount: amountVal,
    })
  })

  return Object.values(groups).sort((a, b) => {
    if (a.dateKey === 'Sin fecha') return 1
    if (b.dateKey === 'Sin fecha') return -1
    return new Date(b.dateKey) - new Date(a.dateKey)
  })
}

// Movimientos filtrados por búsqueda y tipo
const filteredGroupedMovements = computed(() => {
  let groups = recentMovements.value

  const query = movementSearch.value.toLowerCase().trim()
  const filterType = movementFilter.value

  return groups.map(group => {
    const filteredMovements = group.movements.filter(m => {
      // Filtro por tipo
      if (filterType !== 'all' && m.type !== filterType) {
        return false
      }

      // Filtro por texto
      if (query) {
        const matchesDesc = (m.description || '').toLowerCase().includes(query)
        const matchesTitle = (m.displayTitle || '').toLowerCase().includes(query)
        const matchesSub = (m.displaySubtitle || '').toLowerCase().includes(query)
        const matchesModule = (m.module || '').toLowerCase().includes(query)
        const matchesMethod = (m.methodInfo?.label || '').toLowerCase().includes(query)
        const matchesOT = (m.workOrderNumber || '').toLowerCase().includes(query)
        const matchesPlate = (m.licensePlate || '').toLowerCase().includes(query)
        const matchesClient = (m.clientName || '').toLowerCase().includes(query)

        return matchesDesc || matchesTitle || matchesSub || matchesModule || matchesMethod || matchesOT || matchesPlate || matchesClient
      }

      return true
    })

    return {
      ...group,
      movements: filteredMovements,
    }
  }).filter(group => group.movements.length > 0)
})

// Cargar datos
const dashboardOptions = async () => {
  loading.value = true
  try {
    const [response, accountsRes] = await Promise.all([
      $api('/dashboard-financiero'),
      $api('accounts').catch(() => []),
    ])

    if (accountsRes && Array.isArray(accountsRes)) {
      accounts.value = accountsRes
    } else if (response.accountsSummary && Array.isArray(response.accountsSummary)) {
      accounts.value = response.accountsSummary
    }

    if (response.summary) {
      financialSummary.value = {
        ...financialSummary.value,
        monthlyIncome: response.summary.monthlyIncome || 0,
        monthlyExpense: response.summary.monthlyExpense || 0,
        currentBalance: response.summary.currentBalance || 0,
        incomeCount: response.summary.incomeCount || 0,
        expenseCount: response.summary.expenseCount || 0,
      }
    }

    if (response.workOrdersStats) {
      workOrdersStats.value = response.workOrdersStats
    }

    if (response.activeWorkOrders) {
      activeWorkOrders.value = response.activeWorkOrders
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

// Formatear moneda
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Helper de estados de OT
const getWorkOrderStatusProps = status => {
  switch (status) {
  case 'ready':
  case 'delivered':
    return { label: 'Listo p/ Facturar', colorClass: 'status-paid', dotColor: '#10b981', icon: 'ri-checkbox-circle-line' }
  case 'in_progress':
    return { label: 'En Progreso', colorClass: 'status-partial', dotColor: '#f59e0b', icon: 'ri-tools-line' }
  case 'received':
  case 'diagnosis':
    return { label: 'Recibido', colorClass: 'status-transfer', dotColor: '#3b82f6', icon: 'ri-file-list-3-line' }
  default:
    return { label: status || 'Borrador', colorClass: 'status-canceled', dotColor: '#94a3b8', icon: 'ri-draft-line' }
  }
}

// OTs filtradas para el widget
const filteredActiveWorkOrders = computed(() => {
  if (workOrderFilter.value === 'in_progress') {
    return activeWorkOrders.value.filter(wo => ['received', 'in_progress', 'diagnosis'].includes(wo.status))
  }
  if (workOrderFilter.value === 'ready') {
    return activeWorkOrders.value.filter(wo => ['ready', 'delivered'].includes(wo.status))
  }
  return activeWorkOrders.value
})

// Generar PDF del backend
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

    showNotification('Reporte PDF generado exitosamente', 'success')
  } catch (error) {
    console.error('Error al generar PDF en el backend:', error)
    showNotification('Error al solicitar el reporte PDF.', 'error')
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

      <!-- Tarjetas de Métricas Principales (KPI Cards) -->
      <VRow class="mb-5">
        <!-- Ingresos del Mes -->
        <VCol cols="12" sm="6" lg="3">
          <VCard class="kpi-metric-card kpi-income border elevation-0 rounded-2xl h-100">
            <div class="pa-4 d-flex flex-column justify-space-between h-100">
              <div class="d-flex align-center justify-space-between mb-3">
                <span class="kpi-label">Ingresos del Mes</span>
                <div class="kpi-icon-badge kpi-icon-income">
                  <VIcon icon="ri-arrow-down-circle-line" size="22" />
                </div>
              </div>
              <div>
                <div class="kpi-value text-emerald">
                  {{ formatCurrency(financialSummary.monthlyIncome) }}
                </div>
                <div class="d-flex align-center gap-1 mt-1 text-caption text-slate-500 font-weight-medium">
                  <VIcon icon="ri-file-list-line" size="13" />
                  <span>{{ financialSummary.incomeCount }} movimientos registrados</span>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Egresos del Mes -->
        <VCol cols="12" sm="6" lg="3">
          <VCard class="kpi-metric-card kpi-expense border elevation-0 rounded-2xl h-100">
            <div class="pa-4 d-flex flex-column justify-space-between h-100">
              <div class="d-flex align-center justify-space-between mb-3">
                <span class="kpi-label">Egresos del Mes</span>
                <div class="kpi-icon-badge kpi-icon-expense">
                  <VIcon icon="ri-arrow-up-circle-line" size="22" />
                </div>
              </div>
              <div>
                <div class="kpi-value text-rose">
                  {{ formatCurrency(financialSummary.monthlyExpense) }}
                </div>
                <div class="d-flex align-center gap-1 mt-1 text-caption text-slate-500 font-weight-medium">
                  <VIcon icon="ri-file-list-line" size="13" />
                  <span>{{ financialSummary.expenseCount }} movimientos registrados</span>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Balance Neto Actual -->
        <VCol cols="12" sm="6" lg="3">
          <VCard class="kpi-metric-card kpi-balance border elevation-0 rounded-2xl h-100">
            <div class="pa-4 d-flex flex-column justify-space-between h-100">
              <div class="d-flex align-center justify-space-between mb-3">
                <span class="kpi-label">Balance Neto Actual</span>
                <div class="kpi-icon-badge kpi-icon-balance">
                  <VIcon icon="ri-wallet-3-line" size="22" />
                </div>
              </div>
              <div>
                <div
                  class="kpi-value"
                  :class="financialSummary.currentBalance >= 0 ? 'text-primary' : 'text-rose'"
                >
                  {{ formatCurrency(financialSummary.currentBalance) }}
                </div>
                <div class="d-flex align-center gap-1 mt-1 text-caption text-slate-500 font-weight-medium">
                  <VIcon :icon="financialSummary.currentBalance >= 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line'" size="13" />
                  <span>Diferencia acumulada</span>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Órdenes de Trabajo Activas -->
        <VCol cols="12" sm="6" lg="3">
          <VCard
            class="kpi-metric-card kpi-workorders border elevation-0 rounded-2xl h-100 cursor-pointer"
            @click="router.push('/work-orders')"
          >
            <div class="pa-4 d-flex flex-column justify-space-between h-100">
              <div class="d-flex align-center justify-space-between mb-3">
                <span class="kpi-label">Órdenes de Trabajo</span>
                <div class="kpi-icon-badge kpi-icon-ot">
                  <VIcon icon="ri-tools-line" size="22" />
                </div>
              </div>
              <div>
                <div class="d-flex align-baseline gap-2">
                  <span class="kpi-value text-indigo">
                    {{ (workOrdersStats.in_progress || 0) + (workOrdersStats.ready_to_invoice || 0) }}
                  </span>
                  <span class="text-caption font-weight-bold text-slate-500">en taller</span>
                </div>
                <div class="d-flex align-center gap-2 mt-1 text-caption font-weight-semibold">
                  <span class="ot-badge-mini ot-badge-progress">
                    {{ workOrdersStats.in_progress || 0 }} en proceso
                  </span>
                  <span class="ot-badge-mini ot-badge-ready">
                    {{ workOrdersStats.ready_to_invoice || 0 }} p/ facturar
                  </span>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Layout Principal: 2 Columnas -->
      <VRow>
        <!-- Columna Izquierda: Movimientos Recientes & Flujo -->
        <VCol cols="12" lg="8">
          <VCard elevation="0" class="border rounded-2xl h-100 position-relative overflow-hidden bg-white">
            <VProgressLinear
              v-if="loading"
              indeterminate
              color="primary"
              height="3"
              class="position-absolute"
              style="top: 0; left: 0; right: 0; z-index: 10;"
            />

            <!-- Encabezado de la Tarjeta de Movimientos -->
            <div class="pa-4 pa-sm-5 border-b d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center gap-3">
              <div class="d-flex align-center gap-3">
                <div class="section-icon-box">
                  <VIcon icon="ri-history-line" size="22" color="primary" />
                </div>
                <div>
                  <div class="d-flex align-center gap-2">
                    <h2 class="text-h6 font-weight-bold text-slate-900 mb-0">
                      Movimientos Recientes
                    </h2>
                    <span class="badge-count">
                      {{ rawMovementsList.length }} registros
                    </span>
                  </div>
                  <p class="text-caption text-slate-500 mb-0">
                    Historial cronológico de ingresos, egresos y facturación
                  </p>
                </div>
              </div>

              <div class="d-flex align-center gap-2 w-100 w-sm-auto">
                <VBtn
                  color="success"
                  prepend-icon="ri-file-pdf-line"
                  :loading="pdfLoading"
                  size="small"
                  variant="flat"
                  class="font-weight-semibold rounded-lg flex-grow-1 flex-sm-grow-0"
                  @click="generatePDF"
                >
                  Generar PDF
                </VBtn>

                <VBtn
                  icon
                  size="small"
                  variant="tonal"
                  color="secondary"
                  class="rounded-lg"
                  title="Actualizar datos"
                  @click="dashboardOptions"
                >
                  <VIcon icon="ri-refresh-line" size="18" />
                </VBtn>
              </div>
            </div>

            <!-- Barra de Filtros y Búsqueda de Movimientos -->
            <div class="px-4 py-3 bg-slate-50 border-b d-flex flex-column flex-sm-row align-stretch align-sm-center justify-space-between gap-3">
              <!-- Filtros de Segmento -->
              <div class="movement-filter-pills d-flex align-center">
                <button
                  type="button"
                  class="filter-pill-btn"
                  :class="{ active: movementFilter === 'all' }"
                  @click="movementFilter = 'all'"
                >
                  Todos
                </button>
                <button
                  type="button"
                  class="filter-pill-btn"
                  :class="{ active: movementFilter === 'income' }"
                  @click="movementFilter = 'income'"
                >
                  <span class="pill-dot dot-income" />
                  Ingresos
                </button>
                <button
                  type="button"
                  class="filter-pill-btn"
                  :class="{ active: movementFilter === 'expense' }"
                  @click="movementFilter = 'expense'"
                >
                  <span class="pill-dot dot-expense" />
                  Egresos
                </button>
                <button
                  type="button"
                  class="filter-pill-btn"
                  :class="{ active: movementFilter === 'transfer' }"
                  @click="movementFilter = 'transfer'"
                >
                  <span class="pill-dot dot-transfer" />
                  Transferencias
                </button>
              </div>

              <!-- Input de Búsqueda Rápida -->
              <div class="movement-search-input">
                <VTextField
                  v-model="movementSearch"
                  density="compact"
                  variant="outlined"
                  placeholder="Buscar movimiento, OT, placa..."
                  prepend-inner-icon="ri-search-line"
                  hide-details
                  clearable
                  class="search-field"
                />
              </div>
            </div>

            <!-- Contenido de Movimientos -->
            <div class="pa-0">
              <!-- Skeleton Loader -->
              <div v-if="loading" class="pa-4">
                <div
                  v-for="n in 5"
                  :key="n"
                  class="pa-3 mb-2 border rounded-xl d-flex align-center gap-3 shimmer-row"
                >
                  <div class="shimmer-circle" />
                  <div class="flex-grow-1">
                    <div class="shimmer-line w-50 mb-2" />
                    <div class="shimmer-line w-75" />
                  </div>
                  <div class="shimmer-line w-25" />
                </div>
              </div>

              <!-- Sin Resultados -->
              <div
                v-else-if="filteredGroupedMovements.length === 0"
                class="pa-10 text-center text-slate-500"
              >
                <VAvatar color="primary" variant="tonal" size="64" class="mb-3">
                  <VIcon icon="ri-folder-open-line" size="32" />
                </VAvatar>
                <h3 class="text-subtitle-1 font-weight-bold text-slate-800">
                  No se encontraron movimientos
                </h3>
                <p class="text-body-2 text-slate-500 mt-1 max-w-sm mx-auto">
                  {{ movementSearch ? 'No hay registros que coincidan con la búsqueda.' : 'No hay movimientos registrados para este período.' }}
                </p>
                <VBtn
                  v-if="movementSearch || movementFilter !== 'all'"
                  size="small"
                  variant="tonal"
                  color="primary"
                  class="mt-2"
                  @click="movementSearch = ''; movementFilter = 'all'"
                >
                  Limpiar Filtros
                </VBtn>
              </div>

              <!-- Lista de Movimientos Agrupada -->
              <div
                v-else
                class="overflow-y-auto movements-scroll-container pa-4 pa-sm-5"
              >
                <template
                  v-for="day in filteredGroupedMovements"
                  :key="day.dateKey"
                >
                  <!-- Cabecera de Fecha Separada y Espaciosa -->
                  <div class="operations-date-header d-flex align-center justify-space-between px-3 py-2 mb-3 mt-2">
                    <div class="d-flex align-center gap-2">
                      <VIcon icon="ri-calendar-event-line" size="16" class="text-primary" />
                      <span class="text-caption font-weight-bold text-uppercase text-slate-800 tracking-wider">
                        {{ day.date }}
                      </span>
                    </div>

                    <div class="d-flex align-center gap-2">
                      <!-- Balance del día -->
                      <span
                        v-if="day.totalIncome > 0"
                        class="day-subtotal day-subtotal-income"
                      >
                        +{{ formatCurrency(day.totalIncome) }}
                      </span>
                      <span
                        v-if="day.totalExpense > 0"
                        class="day-subtotal day-subtotal-expense"
                      >
                        -{{ formatCurrency(day.totalExpense) }}
                      </span>
                      <div class="status-pill-clean status-transfer">
                        <span class="status-dot" />
                        <span>{{ day.movements.length }} mov.</span>
                      </div>
                    </div>
                  </div>

                  <!-- Tarjetas de Movimiento Espaciosas -->
                  <div
                    v-for="movement in day.movements"
                    :key="movement.id"
                    class="operations-movement-item d-flex align-center justify-space-between gap-4 pa-4 mb-3 rounded-xl border bg-white"
                  >
                    <!-- Izquierda: Avatar Icono + Información -->
                    <div class="d-flex align-center gap-3.5 overflow-hidden flex-grow-1">
                      <div
                        class="movement-direction-avatar shrink-0"
                        :class="`avatar-${movement.type}`"
                      >
                        <VIcon
                          :icon="movement.type === 'transfer' ? 'ri-arrow-left-right-line' : (movement.type === 'income' ? 'ri-arrow-down-line' : 'ri-arrow-up-line')"
                          size="20"
                        />
                      </div>

                      <div class="d-flex flex-column text-left min-w-0 flex-grow-1">
                        <!-- Línea 1: Título claro y espacioso -->
                        <div class="d-flex align-center flex-wrap gap-2 mb-2">
                          <span class="text-body-1 font-weight-bold text-slate-900">
                            {{ movement.displayTitle }}
                          </span>
                          <span v-if="movement.displaySubtitle" class="text-caption text-slate-500 font-weight-semibold text-truncate" style="max-width: 320px;">
                            · {{ movement.displaySubtitle }}
                          </span>
                        </div>

                        <!-- Línea 2: Badges ordenados con amplio espacio -->
                        <div class="d-flex align-center flex-wrap gap-2.5 text-caption">
                          <!-- Módulo Origen -->
                          <span class="status-pill-clean status-canceled">
                            <span class="status-dot" />
                            <span>{{ movement.module }}</span>
                          </span>

                          <!-- Badge de Orden de Trabajo si existe -->
                          <span
                            v-if="movement.workOrderNumber"
                            class="ot-chip-badge d-inline-flex align-center gap-1"
                            title="Orden de Trabajo Asociada"
                          >
                            <VIcon icon="ri-tools-line" size="12" />
                            <span>{{ movement.workOrderNumber }}</span>
                          </span>

                          <!-- Badge de Placa Vehicular si existe -->
                          <span
                            v-if="movement.licensePlate"
                            class="license-plate-badge"
                            title="Vehículo"
                          >
                            {{ movement.licensePlate.toUpperCase() }}
                          </span>

                          <!-- Método de Pago / Banco Específico -->
                          <span
                            class="payment-method-chip d-inline-flex align-center gap-1"
                            :class="movement.methodInfo.badgeClass"
                          >
                            <VIcon :icon="movement.methodInfo.icon" size="13" />
                            <span>{{ movement.methodInfo.label }}</span>
                          </span>

                          <!-- Hora -->
                          <span class="text-slate-400 d-inline-flex align-center gap-1 font-weight-medium">
                            <VIcon icon="ri-time-line" size="13" />
                            {{ movement.time }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Derecha: Monto Destacado con Holgura -->
                    <div class="text-right shrink-0 ps-3">
                      <span
                        class="text-h6 font-weight-black amount-display"
                        :class="movement.type === 'transfer' ? 'text-info' : (movement.type === 'income' ? 'text-emerald' : 'text-rose')"
                      >
                        {{ movement.type === 'transfer' ? '' : (movement.type === 'income' ? '+' : '-') }}
                        {{ formatCurrency(movement.amount) }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Columna Derecha: Órdenes de Trabajo en Curso & Cajas -->
        <VCol cols="12" lg="4" class="d-flex flex-column gap-5">
          <!-- Widget: Órdenes de Trabajo en Operación -->
          <VCard elevation="0" class="border rounded-2xl bg-white overflow-hidden">
            <!-- Header del Widget de OTs -->
            <div class="pa-4 border-b d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-2.5">
                <div class="ot-widget-icon">
                  <VIcon icon="ri-tools-fill" size="18" color="indigo" />
                </div>
                <div>
                  <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                    Órdenes de Trabajo
                  </h3>
                  <span class="text-caption text-slate-500">Operaciones de taller</span>
                </div>
              </div>

              <VBtn
                size="small"
                variant="text"
                color="primary"
                append-icon="ri-arrow-right-s-line"
                class="text-caption font-weight-bold pa-1"
                to="/work-orders"
              >
                Ver todas
              </VBtn>
            </div>

            <!-- Filtros de OTs en widget -->
            <div class="px-4 py-2 bg-slate-50 border-b d-flex align-center gap-2">
              <button
                type="button"
                class="ot-filter-btn"
                :class="{ active: workOrderFilter === 'all' }"
                @click="workOrderFilter = 'all'"
              >
                Todas ({{ activeWorkOrders.length }})
              </button>
              <button
                type="button"
                class="ot-filter-btn"
                :class="{ active: workOrderFilter === 'in_progress' }"
                @click="workOrderFilter = 'in_progress'"
              >
                En Taller ({{ workOrdersStats.in_progress || 0 }})
              </button>
              <button
                type="button"
                class="ot-filter-btn"
                :class="{ active: workOrderFilter === 'ready' }"
                @click="workOrderFilter = 'ready'"
              >
                Por Facturar ({{ workOrdersStats.ready_to_invoice || 0 }})
              </button>
            </div>

            <!-- Lista de Órdenes de Trabajo -->
            <div class="pa-3 ot-widget-scroll">
              <div
                v-if="filteredActiveWorkOrders.length === 0"
                class="pa-6 text-center text-slate-400"
              >
                <VIcon icon="ri-tools-line" size="28" class="mb-1 text-slate-300" />
                <p class="text-caption mb-0">No hay órdenes de trabajo activas</p>
              </div>

              <div
                v-for="wo in filteredActiveWorkOrders"
                :key="wo.id"
                class="ot-card-item pa-3 mb-2 rounded-xl border d-flex flex-column gap-2"
              >
                <div class="d-flex align-center justify-space-between">
                  <!-- OT Number y Status -->
                  <div class="d-flex align-center gap-2">
                    <span class="ot-number-badge">
                      {{ wo.number?.startsWith('OT-') ? wo.number : `OT-${wo.number || '---'}` }}
                    </span>

                    <span
                      class="status-pill-clean"
                      :class="getWorkOrderStatusProps(wo.status).colorClass"
                    >
                      <span class="status-dot" />
                      <span>{{ getWorkOrderStatusProps(wo.status).label }}</span>
                    </span>
                  </div>

                  <!-- Monto Calculado -->
                  <span class="font-weight-black text-body-2 text-slate-900">
                    {{ formatCurrency(wo.calculated_total || 0) }}
                  </span>
                </div>

                <!-- Cliente y Vehículo -->
                <div class="d-flex align-center justify-space-between text-caption">
                  <div class="text-truncate text-slate-700 font-weight-medium" style="max-width: 170px;">
                    <VIcon icon="ri-user-line" size="13" class="me-1 text-slate-400" />
                    {{ wo.client?.full_name || `${wo.client?.name || ''} ${wo.client?.surname || ''}`.trim() || 'Cliente' }}
                  </div>

                  <span
                    v-if="wo.vehicle?.license_plate"
                    class="license-plate-badge"
                  >
                    {{ wo.vehicle.license_plate.toUpperCase() }}
                  </span>
                </div>

                <!-- Botones de Acción de la OT -->
                <div class="d-flex align-center justify-end gap-2 pt-1 border-t mt-1">
                  <!-- Si está lista, botón Facturar directo -->
                  <VBtn
                    v-if="['ready', 'delivered'].includes(wo.status) && !wo.sale"
                    size="x-small"
                    color="success"
                    variant="flat"
                    prepend-icon="ri-file-add-line"
                    class="font-weight-bold rounded-lg"
                    :to="`/sales/add?work_order_id=${wo.id}`"
                  >
                    Facturar
                  </VBtn>

                  <!-- Botón Ver/Editar OT -->
                  <VBtn
                    size="x-small"
                    color="secondary"
                    variant="tonal"
                    prepend-icon="ri-eye-line"
                    class="font-weight-semibold rounded-lg"
                    :to="`/work-orders/edit/${wo.id}`"
                  >
                    Ver OT
                  </VBtn>
                </div>
              </div>
            </div>
          </VCard>

          <!-- Tarjeta: Disponibilidad de Cajas y Bancos -->
          <VCard elevation="0" class="border rounded-2xl bg-white overflow-hidden">
            <div class="pa-4 border-b d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-2.5">
                <div class="account-widget-icon">
                  <VIcon icon="ri-bank-card-fill" size="18" color="cyan" />
                </div>
                <div>
                  <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                    Cuentas & Cajas
                  </h3>
                  <span class="text-caption text-slate-500">Saldos disponibles actuales</span>
                </div>
              </div>

              <VBtn
                size="small"
                variant="text"
                color="primary"
                append-icon="ri-arrow-right-s-line"
                class="text-caption font-weight-bold pa-1"
                to="/accounts"
              >
                Cuentas
              </VBtn>
            </div>

            <div class="pa-3">
              <div
                v-for="acc in accounts.slice(0, 4)"
                :key="acc.id"
                class="d-flex align-center justify-space-between pa-2.5 mb-2 rounded-xl bg-slate-50 border"
              >
                <div class="d-flex align-center gap-2.5 overflow-hidden">
                  <div
                    class="account-type-indicator"
                    :class="acc.type === 'bank' ? 'acc-bank' : 'acc-cash'"
                  >
                    <VIcon :icon="acc.type === 'bank' ? 'ri-bank-line' : 'ri-bill-line'" size="16" />
                  </div>
                  <div class="text-truncate">
                    <div class="text-body-2 font-weight-bold text-slate-900 text-truncate">
                      {{ acc.name }}
                    </div>
                    <div class="text-caption text-slate-400">
                      {{ acc.bank_name || (acc.type === 'cash' ? 'Caja Efectivo' : 'Bancaria') }}
                    </div>
                  </div>
                </div>

                <div class="text-right shrink-0 ps-2">
                  <span class="text-body-2 font-weight-black text-slate-900">
                    {{ formatCurrency(acc.saldo_actual || acc.balance || 0) }}
                  </span>
                </div>
              </div>

              <!-- Última Transferencia Resumen -->
              <div
                v-if="financialSummary.lastTransfer && financialSummary.lastTransfer.amount > 0"
                class="mt-3 pa-3 rounded-xl bg-info-tonal border-info d-flex align-center justify-space-between"
              >
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-arrow-left-right-line" color="info" size="18" />
                  <div>
                    <div class="text-caption text-info font-weight-bold text-uppercase">
                      Última Transferencia
                    </div>
                    <div class="text-caption text-slate-500">
                      {{ financialSummary.lastTransfer.date }}
                    </div>
                  </div>
                </div>
                <span class="text-subtitle-2 font-weight-black text-info">
                  {{ formatCurrency(financialSummary.lastTransfer.amount) }}
                </span>
              </div>
            </div>
          </VCard>

          <!-- Acciones Rápidas Operativas -->
          <VCard elevation="0" class="border rounded-2xl bg-white pa-4">
            <h4 class="text-caption font-weight-bold text-slate-400 text-uppercase tracking-wider mb-3">
              Acciones Rápidas
            </h4>
            <div class="d-flex flex-column gap-2">
              <VBtn
                color="primary"
                variant="tonal"
                prepend-icon="ri-tools-line"
                class="justify-start rounded-xl font-weight-semibold"
                to="/work-orders/add"
              >
                Nueva Orden de Trabajo
              </VBtn>

              <VBtn
                color="secondary"
                variant="tonal"
                prepend-icon="ri-arrow-left-right-line"
                class="justify-start rounded-xl font-weight-semibold"
                @click="isTransferDialogVisible = true"
              >
                Transferencia Interna
              </VBtn>

              <VBtn
                color="secondary"
                variant="tonal"
                prepend-icon="ri-user-star-line"
                class="justify-start rounded-xl font-weight-semibold"
                @click="isAporteDialogVisible = true"
              >
                Registrar Aporte de Socio
              </VBtn>
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Diálogos Globales -->
      <TransferDialog v-model="isTransferDialogVisible" />
      <AporteCreateDialog v-model="isAporteDialogVisible" />
    </div>
  </div>
</template>

<style scoped lang="scss">
// Colores y Tipografía Semántica
.text-emerald {
  color: #059669 !important;
}

.text-rose {
  color: #e11d48 !important;
}

.text-indigo {
  color: #4f46e5 !important;
}

.bg-slate-50 {
  background-color: #f8fafc !important;
}

// KPI Metric Cards
.kpi-metric-card {
  background: #ffffff !important;
  border-color: rgba(226, 232, 240, 0.9) !important;
  box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.04) !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.08) !important;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
  }

  &.kpi-income::before {
    background: linear-gradient(90deg, #10b981, #059669);
  }

  &.kpi-expense::before {
    background: linear-gradient(90deg, #f43f5e, #e11d48);
  }

  &.kpi-balance::before {
    background: linear-gradient(90deg, #4f46e5, #3b82f6);
  }

  &.kpi-workorders::before {
    background: linear-gradient(90deg, #8b5cf6, #6366f1);
  }
}

.kpi-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-value {
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.kpi-icon-badge {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.kpi-icon-income {
    background-color: #ecfdf5;
    color: #059669;
  }

  &.kpi-icon-expense {
    background-color: #fff1f2;
    color: #e11d48;
  }

  &.kpi-icon-balance {
    background-color: #eff6ff;
    color: #3b82f6;
  }

  &.kpi-icon-ot {
    background-color: #f5f3ff;
    color: #7c3aed;
  }
}

.ot-badge-mini {
  padding: 2px 7px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 700;

  &.ot-badge-progress {
    background-color: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  &.ot-badge-ready {
    background-color: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }
}

// Icon Boxes
.section-icon-box {
  width: 42px;
  height: 42px;
  background-color: #eef2ff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ot-widget-icon {
  width: 32px;
  height: 32px;
  background-color: #eef2ff;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.account-widget-icon {
  width: 32px;
  height: 32px;
  background-color: #ecfeff;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-count {
  padding: 2px 8px;
  background-color: #f1f5f9;
  color: #475569;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 700;
}

// Movement Filter Pills
.movement-filter-pills {
  background-color: #e2e8f0;
  padding: 3px;
  border-radius: 10px;
  gap: 2px;
}

.filter-pill-btn {
  border: none;
  background: transparent;
  padding: 5px 12px;
  border-radius: 7px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s ease;

  &:hover:not(.active) {
    color: #1e293b;
    background-color: rgba(255, 255, 255, 0.6);
  }

  &.active {
    background-color: #ffffff;
    color: #0f172a;
    font-weight: 700;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;

    &.dot-income {
      background-color: #10b981;
    }

    &.dot-expense {
      background-color: #ef4444;
    }

    &.dot-transfer {
      background-color: #3b82f6;
    }
  }
}

.movement-search-input {
  min-width: 240px;

  .search-field :deep(.v-field) {
    background-color: #ffffff !important;
    border-radius: 8px !important;
    font-size: 0.85rem;
  }
}

// Movements Scroll & Items
.movements-scroll-container {
  max-height: 640px;
  background-color: #f8fafc;
}

.operations-date-header {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.day-subtotal {
  font-size: 0.75rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 6px;

  &.day-subtotal-income {
    background-color: #ecfdf5;
    color: #047857;
  }

  &.day-subtotal-expense {
    background-color: #fff1f2;
    color: #be123c;
  }
}

.operations-movement-item {
  background-color: #ffffff;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.07) !important;
    border-color: #cbd5e1 !important;
  }
}

.movement-direction-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.avatar-income {
    background-color: #ecfdf5;
    color: #059669;
  }

  &.avatar-expense {
    background-color: #fff1f2;
    color: #e11d48;
  }

  &.avatar-transfer {
    background-color: #eff6ff;
    color: #2563eb;
  }
}

.amount-display {
  font-size: 1.15rem;
  letter-spacing: -0.02em;
}

// OT Badge en Movimientos
.ot-chip-badge {
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  color: #4338ca;
  border: 1px solid #c7d2fe;
  padding: 3px 9px;
  border-radius: 7px;
  font-size: 0.74rem;
  font-weight: 800;
  font-family: 'Consolas', 'Monaco', monospace;
  box-shadow: 0 1px 2px rgba(67, 56, 202, 0.06);
}

.license-plate-badge {
  display: inline-block;
  padding: 2px 8px;
  background-color: #f8fafc;
  color: #0f172a;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-weight: 800;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  border: 1.5px solid #0f172a;
  border-radius: 5px;
  line-height: 1.2;
}

// Badges de Métodos de Pago
.payment-method-chip {
  padding: 3px 10px;
  border-radius: 7px;
  font-size: 0.74rem;
  font-weight: 700;

  &.method-badge-cash {
    background-color: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  &.method-badge-pichincha {
    background-color: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  &.method-badge-guayaquil {
    background-color: #fdf2f8;
    color: #c026d3;
    border: 1px solid #fbcfe8;
  }

  &.method-badge-transfer {
    background-color: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }
}

// OT Widget Cards
.ot-filter-btn {
  border: none;
  background: transparent;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;

  &.active {
    background-color: #ffffff;
    color: #4f46e5;
    font-weight: 700;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
}

.ot-widget-scroll {
  max-height: 380px;
  overflow-y: auto;
}

.ot-card-item {
  background-color: #ffffff;
  border-color: #f1f5f9 !important;
  transition: all 0.15s ease;

  &:hover {
    border-color: #cbd5e1 !important;
    background-color: #f8fafc;
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.04);
  }
}

.ot-number-badge {
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 800;
  font-size: 0.78rem;
  color: #1e293b;
}

// Status Pills
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 3px 8px !important;
  border-radius: 9999px !important;
  font-size: 0.7rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.02em !important;
  text-transform: uppercase !important;

  .status-dot {
    width: 5px !important;
    height: 5px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-partial {
  background-color: #fffbeb !important;
  color: #92400e !important;
  border: 1px solid #fde68a !important;

  .status-dot {
    background-color: #f59e0b !important;
  }
}

.status-transfer {
  background-color: #eff6ff !important;
  color: #1e40af !important;
  border: 1px solid #bfdbfe !important;

  .status-dot {
    background-color: #3b82f6 !important;
  }
}

.status-canceled {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  border: 1px solid #cbd5e1 !important;

  .status-dot {
    background-color: #94a3b8 !important;
  }
}

// Account Type Indicators
.account-type-indicator {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.acc-bank {
    background-color: #eff6ff;
    color: #2563eb;
  }

  &.acc-cash {
    background-color: #ecfdf5;
    color: #059669;
  }
}

// Shimmer Loader
.shimmer-row {
  background: #f8fafc;
}

.shimmer-circle {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #e2e8f0;
}

.shimmer-line {
  height: 12px;
  background: #e2e8f0;
  border-radius: 4px;
}
</style>
