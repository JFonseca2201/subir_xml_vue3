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

  if (targetAccount?.type === 'cash' || targetAccount?.code === 'CAJA_CHICA' || accName.includes('caja chica') || accName.includes('caja (efectivo)') || rawMethod === 'CASH' || rawMethod === 'EFECTIVO') {
    return { type: 'EFECTIVO', label: 'Efectivo', icon: 'ri-bill-line', badgeClass: 'method-badge-cash' }
  }

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

// Extraer OT, Vehículo y Cliente asociados al movimiento
const extractWorkOrderAndVehicle = m => {
  let workOrderNumber = null
  let workOrderId = null
  let licensePlate = null
  let clientName = null

  // Desde movable (Sale, PaymentDistribution, WorkOrder, etc.)
  if (m.movable) {
    if (m.movable.work_order_number) workOrderNumber = m.movable.work_order_number
    if (m.movable.work_order_id) workOrderId = m.movable.work_order_id
    if (m.movable.workOrder) {
      workOrderNumber = workOrderNumber || m.movable.workOrder.number
      workOrderId = workOrderId || m.movable.workOrder.id
      if (m.movable.workOrder.vehicle?.license_plate) {
        licensePlate = m.movable.workOrder.vehicle.license_plate
      }
      if (m.movable.workOrder.client) {
        clientName = clientName || m.movable.workOrder.client.full_name || `${m.movable.workOrder.client.name || ''} ${m.movable.workOrder.client.surname || ''}`.trim()
      }
    }

    if (!licensePlate && m.movable.vehicle?.license_plate) {
      licensePlate = m.movable.vehicle.license_plate
    }

    if (m.movable.client) {
      clientName = clientName || m.movable.client.full_name || `${m.movable.client.name || ''} ${m.movable.client.surname || ''}`.trim()
    }

    // Si es PaymentDistribution o FinanceRecord
    if (m.movable.finance_record) {
      if (m.movable.finance_record.work_order_number) {
        workOrderNumber = workOrderNumber || m.movable.finance_record.work_order_number
      }
      if (m.movable.finance_record.client_name) {
        clientName = clientName || m.movable.finance_record.client_name
      }
    }
  }

  // Desde objeto directo
  if (m.client) {
    clientName = clientName || m.client.full_name || `${m.client.name || ''} ${m.client.surname || ''}`.trim()
  }
  if (m.client_name) {
    clientName = clientName || m.client_name
  }

  // Desde metadata
  if (m.metadata) {
    if (!workOrderNumber && (m.metadata.work_order_number || m.metadata.work_order || m.metadata.ot)) {
      workOrderNumber = m.metadata.work_order_number || m.metadata.work_order || m.metadata.ot
    }
    if (!licensePlate && (m.metadata.license_plate || m.metadata.placa)) {
      licensePlate = m.metadata.license_plate || m.metadata.placa
    }
    if (!clientName && (m.metadata.client_name || m.metadata.client || m.metadata.cliente)) {
      clientName = m.metadata.client_name || m.metadata.client || m.metadata.cliente
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

    // Regex para detectar ventas, facturas, notas de venta, cotizaciones
    const saleMatch = finalDesc.match(/(?:Venta:\s*)?(invoice|factura|nota_venta|sale_note|nota\s*de\s*venta|sale|quote|cotizacion|cotización)\s*[-–#:\s]*(\d+)/i)
    if (saleMatch) {
      const docType = (saleMatch[1] || '').toLowerCase().replace(/[\s_]/g, '')
      const docNum = saleMatch[2]
      let label = 'Venta'
      if (docType === 'invoice' || docType === 'factura') {
        label = 'Factura'
      } else if (docType === 'quote' || docType.includes('cotiz')) {
        label = 'Cotización'
      } else if (docType.includes('note') || docType.includes('notadeventa') || docType === 'notaventa') {
        label = 'Nota de Venta'
      }

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
  <div class="pa-4 pa-sm-6 operations-dashboard-page">
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
      <VRow class="mb-5 d-none d-sm-flex">
        <!-- Ingresos del Mes -->
        <VCol
          cols="12"
          sm="6"
          lg="3"
        >
          <VCard class="kpi-metric-card kpi-income border elevation-0 rounded-2xl h-100">
            <div class="pa-4 d-flex flex-column justify-space-between h-100">
              <div class="d-flex align-center justify-space-between mb-3">
                <span class="kpi-label">Ingresos del Mes</span>
                <div class="kpi-icon-badge kpi-icon-income">
                  <VIcon
                    icon="ri-arrow-down-circle-line"
                    size="22"
                  />
                </div>
              </div>
              <div>
                <div class="kpi-value text-emerald">
                  {{ formatCurrency(financialSummary.monthlyIncome) }}
                </div>
                <div class="d-flex align-center gap-1 mt-1 text-caption text-slate-500 font-weight-medium">
                  <VIcon
                    icon="ri-file-list-line"
                    size="13"
                  />
                  <span>{{ financialSummary.incomeCount }} movimientos registrados</span>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Egresos del Mes -->
        <VCol
          cols="12"
          sm="6"
          lg="3"
        >
          <VCard class="kpi-metric-card kpi-expense border elevation-0 rounded-2xl h-100">
            <div class="pa-4 d-flex flex-column justify-space-between h-100">
              <div class="d-flex align-center justify-space-between mb-3">
                <span class="kpi-label">Egresos del Mes</span>
                <div class="kpi-icon-badge kpi-icon-expense">
                  <VIcon
                    icon="ri-arrow-up-circle-line"
                    size="22"
                  />
                </div>
              </div>
              <div>
                <div class="kpi-value text-rose">
                  {{ formatCurrency(financialSummary.monthlyExpense) }}
                </div>
                <div class="d-flex align-center gap-1 mt-1 text-caption text-slate-500 font-weight-medium">
                  <VIcon
                    icon="ri-file-list-line"
                    size="13"
                  />
                  <span>{{ financialSummary.expenseCount }} movimientos registrados</span>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Balance Neto Actual -->
        <VCol
          cols="12"
          sm="6"
          lg="3"
        >
          <VCard class="kpi-metric-card kpi-balance border elevation-0 rounded-2xl h-100">
            <div class="pa-4 d-flex flex-column justify-space-between h-100">
              <div class="d-flex align-center justify-space-between mb-3">
                <span class="kpi-label">Balance Neto Actual</span>
                <div class="kpi-icon-badge kpi-icon-balance">
                  <VIcon
                    icon="ri-wallet-3-line"
                    size="22"
                  />
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
                  <VIcon
                    :icon="financialSummary.currentBalance >= 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line'"
                    size="13"
                  />
                  <span>Diferencia acumulada</span>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Órdenes de Trabajo Activas -->
        <VCol
          cols="12"
          sm="6"
          lg="3"
        >
          <VCard
            class="kpi-metric-card kpi-workorders border elevation-0 rounded-2xl h-100 cursor-pointer"
            @click="router.push('/work-orders')"
          >
            <div class="pa-4 d-flex flex-column justify-space-between h-100">
              <div class="d-flex align-center justify-space-between mb-3">
                <span class="kpi-label">Órdenes de Trabajo</span>
                <div class="kpi-icon-badge kpi-icon-ot">
                  <VIcon
                    icon="ri-tools-line"
                    size="22"
                  />
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

      <!-- Layout Principal: Movimientos Recientes a Pantalla Completa -->
      <VRow>
        <VCol cols="12">
          <VCard
            elevation="0"
            class="border rounded-2xl h-100 position-relative overflow-hidden bg-white"
          >
            <VProgressLinear
              v-if="loading"
              indeterminate
              color="primary"
              height="3"
              class="position-absolute"
              style="top: 0; left: 0; right: 0; z-index: 10;"
            />

            <!-- Encabezado de la Tarjeta de Movimientos -->
            <div class="pa-3 pa-sm-4 border-b">
              <div class="d-flex align-center justify-space-between gap-3 w-100">
                <!-- Título + Avatar -->
                <div class="d-flex align-center gap-2.5 min-w-0 flex-grow-1">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    rounded="lg"
                    size="38"
                    class="elevation-0 shrink-0"
                  >
                    <VIcon
                      icon="ri-history-line"
                      size="22"
                    />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="d-flex align-center gap-2 flex-wrap">
                      <h2 class="text-subtitle-1 text-sm-h6 font-weight-bold text-high-emphasis mb-0">
                        Movimientos Recientes
                      </h2>
                      <span class="status-pill-clean status-primary shrink-0">
                        <span class="status-dot" />
                        <span>{{ rawMovementsList.length }} registros</span>
                      </span>
                    </div>
                    <p class="text-caption text-medium-emphasis mb-0 d-none d-sm-block text-truncate">
                      Historial cronológico de ingresos, egresos y facturación
                    </p>
                  </div>
                </div>

                <!-- Botones de Acción (PDF y Actualizar) -->
                <div class="d-flex align-center gap-1.5 shrink-0">
                  <VBtn
                    color="secondary"
                    variant="tonal"
                    size="small"
                    prepend-icon="ri-file-pdf-line"
                    class="font-weight-semibold d-none d-sm-inline-flex"
                    :loading="pdfLoading"
                    @click="generatePDF"
                  >
                    PDF
                  </VBtn>
                  <VBtn
                    icon="ri-file-pdf-line"
                    size="small"
                    variant="tonal"
                    color="secondary"
                    class="rounded-lg d-sm-none"
                    title="Exportar PDF"
                    :loading="pdfLoading"
                    @click="generatePDF"
                  />

                  <VBtn
                    icon="ri-refresh-line"
                    size="small"
                    variant="tonal"
                    color="secondary"
                    class="rounded-lg"
                    title="Actualizar datos"
                    @click="dashboardOptions"
                  />
                </div>
              </div>
            </div>

            <!-- Barra de Filtros y Búsqueda de Movimientos -->
            <div class="px-3 px-sm-4 py-2.5 py-sm-3 bg-slate-50 border-b d-flex flex-column flex-sm-row align-stretch align-sm-center justify-space-between gap-2.5">
              <!-- Filtros de Segmento -->
              <div class="movement-filter-pills">
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
                  Transf.
                </button>
              </div>

              <!-- Input de Búsqueda Rápida -->
              <div class="movement-search-input flex-grow-1 flex-sm-grow-0">
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
              <div
                v-if="loading"
                class="pa-4"
              >
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
                class="pa-8 pa-sm-10 text-center text-slate-500"
              >
                <VAvatar
                  color="primary"
                  variant="tonal"
                  size="64"
                  class="mb-3"
                >
                  <VIcon
                    icon="ri-folder-open-line"
                    size="32"
                  />
                </VAvatar>
                <h3 class="text-subtitle-1 font-weight-bold text-slate-800">
                  No se encontraron movimientos
                </h3>
                <p class="text-body-2 text-slate-500 mt-1 max-w-sm mx-auto">
                  {{ movementSearch ? 'No hay registros que coincidan con la búsqueda.' :
                    'No hay movimientos registrados para este período.' }}
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

              <!-- Lista de Movimientos Agrupada (Fluida sin scroll interno) -->
              <div
                v-else
                class="movements-scroll-container pa-3 pa-sm-5"
              >
                <template
                  v-for="(day, dayIdx) in filteredGroupedMovements"
                  :key="day.dateKey"
                >
                  <!-- Cabecera de Fecha Separada y Espaciosa -->
                  <div
                    class="operations-date-header d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between px-3 px-sm-4 py-2 mb-2.5 gap-2"
                    :class="dayIdx === 0 ? 'mt-1' : 'mt-4'"
                  >
                    <!-- Fecha y Calendario -->
                    <div class="d-flex align-center gap-2">
                      <div class="date-icon-box">
                        <VIcon
                          icon="ri-calendar-event-line"
                          size="15"
                        />
                      </div>
                      <span class="date-title-text font-weight-bold text-uppercase tracking-wider">
                        {{ day.date }}
                      </span>
                    </div>

                    <!-- Resumen del día: Subtotales + Conteo de Movimientos (Sin duplicados) -->
                    <div class="d-flex align-center gap-1.5 flex-wrap ms-auto ms-sm-0">
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
                      <span class="status-pill-clean status-transfer">
                        <span class="status-dot" />
                        <span>{{ day.movements.length }} mov.</span>
                      </span>
                    </div>
                  </div>

                  <!-- Tarjetas de Movimiento Espaciosas -->
                  <div
                    v-for="movement in day.movements"
                    :key="movement.id"
                    class="operations-movement-item d-flex align-center justify-space-between gap-3 mb-2.5 rounded-xl border bg-white"
                  >
                    <!-- Izquierda: Avatar Icono + Información -->
                    <div class="d-flex align-start gap-2.5 overflow-hidden flex-grow-1 min-w-0">
                      <div
                        class="movement-direction-avatar shrink-0 mt-0.5"
                        :class="`avatar-${movement.type}`"
                      >
                        <VIcon
                          :icon="movement.type === 'transfer' ? 'ri-arrow-left-right-line' : (movement.type === 'income' ? 'ri-arrow-down-line' : 'ri-arrow-up-line')"
                          size="18"
                        />
                      </div>

                      <div class="d-flex flex-column text-left min-w-0 flex-grow-1">
                        <!-- Línea 1: Título claro + Monto en Móvil -->
                        <div class="d-flex align-center justify-space-between gap-2">
                          <span class="text-body-2 font-weight-bold text-slate-900 text-truncate">
                            {{ movement.displayTitle }}
                          </span>
                          <!-- Monto en móvil arriba a la derecha -->
                          <span
                            class="text-body-2 font-weight-bold amount-display d-sm-none shrink-0"
                            :class="movement.type === 'transfer' ? 'text-info' : (movement.type === 'income' ? 'text-emerald' : 'text-rose')"
                          >
                            {{ movement.type === 'transfer' ? '' : (movement.type === 'income' ? '+' : '-') }}
                            {{ formatCurrency(movement.amount) }}
                          </span>
                        </div>

                        <!-- Línea 2: Datos del Cliente con Icono (si existen) -->
                        <div
                          v-if="movement.clientName"
                          class="movement-client-row d-flex align-center gap-1.5 text-caption font-weight-medium my-0.5 text-truncate"
                        >
                          <VIcon
                            icon="ri-user-3-line"
                            size="13"
                            class="text-slate-400 shrink-0"
                          />
                          <span class="text-slate-700 text-truncate font-weight-semibold">
                            {{ movement.clientName }}
                          </span>
                        </div>

                        <!-- Línea 3: Badges ordenados compactos -->
                        <div class="movement-badges-row d-flex align-center flex-wrap gap-1 mt-1 text-caption">
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
                            <VIcon
                              icon="ri-tools-line"
                              size="11"
                            />
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
                            <VIcon
                              :icon="movement.methodInfo.icon"
                              size="12"
                            />
                            <span>{{ movement.methodInfo.label }}</span>
                          </span>

                          <!-- Hora -->
                          <span class="movement-time-chip text-slate-400 d-inline-flex align-center gap-1 font-weight-medium">
                            <VIcon
                              icon="ri-time-line"
                              size="12"
                            />
                            {{ movement.time }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Derecha: Monto Destacado en Desktop -->
                    <div class="movement-amount-container text-right shrink-0 ps-3 d-none d-sm-block">
                      <span
                        class="text-body-1 font-weight-bold amount-display"
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
      </VRow>

      <!-- Diálogos Globales -->
      <TransferDialog v-model="isTransferDialogVisible" />
      <AporteCreateDialog v-model="isAporteDialogVisible" />
    </div>
  </div>
</template>

<style scoped lang="scss">
// Los estilos de esta vista, tarjetas KPI, widgets y lista de movimientos
// se encuentran centralizados en src/assets/styles/inventory.scss (Sección 13)
</style>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
