<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import AddEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/AddEmployeeAdvanceDialog.vue'
import EditEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/EditEmployeeAdvanceDialog.vue'
import DeleteEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/DeleteEmployeeAdvanceDialog.vue'
import AddEmployeePaymentDialog from '@/components/inventory/employee-expenses/AddEmployeePaymentDialog.vue'
import EditEmployeePaymentDialog from '@/components/inventory/employee-expenses/EditEmployeePaymentDialog.vue'
import DeleteEmployeePaymentDialog from '@/components/inventory/employee-expenses/DeleteEmployeePaymentDialog.vue'
import OperationsHeaderNav from '@/components/operations/OperationsHeaderNav.vue'
import MovementReceiptNoteDialog from '@/components/inventory/finances-records/MovementReceiptNoteDialog.vue'
import AttachReceiptsDialog from '@/components/common/AttachReceiptsDialog.vue'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'

// Router
const router = useRouter()

// Reactive state
const expenses = ref([])
const employees = ref([])
const accounts = ref([])

const summary = ref({
  total_payments: 0,
  total_advances: 0,
  total_general: 0,
})

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const selectedType = ref('all')
const searchQuery = ref('')
const loading = ref(false)

// Dialog state
const showAddPaymentDialog = ref(false)
const showEditPaymentDialog = ref(false)
const showDeletePaymentDialog = ref(false)
const showAddAdvanceDialog = ref(false)
const showEditAdvanceDialog = ref(false)
const showDeleteAdvanceDialog = ref(false)
const selectedAdvance = ref(null)
const selectedPayment = ref(null)

const isNoteDialogVisible = ref(false)
const selectedItemForNote = ref(null)
const isReceiptsDialogVisible = ref(false)
const selectedItemForReceipts = ref(null)

const openEmployeeNoteDialog = item => {
  const isPayment = item.type === 'payment'
  const docCode = isPayment ? `PAGO-EMP-${String(item.id).padStart(5, '0')}` : `ADEL-EMP-${String(item.id).padStart(5, '0')}`
  const attachType = isPayment ? 'employee_payment' : 'employee_advance'

  selectedItemForNote.value = {
    ...item,
    id: item.id,
    attachable_type: attachType,
    referencia: attachType,
    amount: item.amount,
    entry_date: item.raw_date || item.date,
    description: `${isPayment ? 'Pago de Nómina' : 'Adelanto de Sueldo'} — ${item.employee_name}${item.description ? ': ' + item.description : ''}`,
    payment_method: item.payment_method || 'TRANSFERENCIA',
    account: { name: item.account_name },
    invoice_number: docCode,
    metadata: {
      document_number: docCode,
      employee_name: item.employee_name,
      user_name: item.created_by,
      payment_method: item.payment_method,
    },
    resolved_attachments: item.attachments || [],
  }
  isNoteDialogVisible.value = true
}

const openAttachDialog = item => {
  selectedItemForReceipts.value = item
  isReceiptsDialogVisible.value = true
}

// Authorization
const currentUser = computed(() => {
  const userStr = localStorage.getItem('user')

  return userStr ? JSON.parse(userStr) : null
})

const canAccessEmployeeExpenses = computed(() => {
  const roleId = currentUser.value?.role?.id

  return currentUser.value && [1, 2].includes(roleId)
})

const headers = [
  { title: 'TIPO / REGISTRO', key: 'type', sortable: true, width: '165px', minWidth: '160px' },
  { title: 'EMPLEADO', key: 'employee_name', sortable: true, width: '150px', minWidth: '140px' },
  { title: 'DESCRIPCIÓN', key: 'description', minWidth: '130px' },
  { title: 'CUENTA DE PAGO', key: 'account_name', sortable: true, width: '140px', minWidth: '130px' },
  { title: 'MONTO', key: 'amount', sortable: true, align: 'end', width: '110px', minWidth: '100px' },
  { title: 'FECHA', key: 'raw_date', sortable: true, width: '110px', minWidth: '105px' },
  { title: 'ACCIONES', key: 'actions', sortable: false, align: 'center', width: '130px', minWidth: '120px' },
]

// Functions
const loadExpenses = async () => {
  loading.value = true
  try {
    const [expensesResponse, accountsResponse, employeesResponse] = await Promise.all([
      $api('employee-expenses'),
      $api('accounts'),
      $api('employees'),
    ])

    accounts.value = accountsResponse || []
    employees.value = (employeesResponse.employees || []).map(emp => ({
      ...emp,
      name: `${emp.first_name} ${emp.last_name}`,
    }))

    const allExpenses = [
      ...(expensesResponse.payments || []).map(payment => ({
        ...payment,
        employee_name: payment.employee_name || 'N/A',
        account_name: cleanAccountName(payment.account_name),
        raw_date: payment.date ? payment.date.split('/').reverse().join('-') : '1970-01-01',
      })),
      ...(expensesResponse.advances || []).map(advance => ({
        ...advance,
        employee_name: advance.employee_name || 'N/A',
        account_name: cleanAccountName(advance.account_name),
        raw_date: advance.date ? advance.date.split('/').reverse().join('-') : '1970-01-01',
      })),
    ]

    allExpenses.sort((a, b) => {
      const parseDate = d => {
        if (!d) return 0
        const [day, month, year] = d.split('/')

        return new Date(year, month - 1, day).getTime()
      }


      return parseDate(b.date) - parseDate(a.date)
    })

    expenses.value = allExpenses
    summary.value.total_payments = parseFloat(expensesResponse.summary?.total_payments) || 0
    summary.value.total_advances = parseFloat(expensesResponse.summary?.total_advances) || 0
    summary.value.total_general = parseFloat(expensesResponse.summary?.total_general) || 0

  } catch (error) {
    console.error('Error al cargar gastos:', error)
    showNotification('Error al cargar los gastos de empleados.', 'error')
  } finally {
    loading.value = false
  }
}

const cleanAccountName = name => {
  if (!name) return 'N/A'

  return name
    .replace(/\(EFECTIVO\)/gi, '')
    .replace(/\(TRANSFERENCIA\)/gi, '')
    .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
    .trim()
}

const openAddAdvanceDialog = () => showAddAdvanceDialog.value = true
const openAddPaymentDialog = () => showAddPaymentDialog.value = true

const openEditAdvanceDialog = advance => {
  selectedAdvance.value = advance
  showEditAdvanceDialog.value = true
}

const openDeleteAdvanceDialog = advance => {
  selectedAdvance.value = advance
  showDeleteAdvanceDialog.value = true
}

const openEditPaymentDialog = payment => {
  selectedPayment.value = payment
  showEditPaymentDialog.value = true
}

const openDeletePaymentDialog = payment => {
  selectedPayment.value = payment
  showDeletePaymentDialog.value = true
}

const handleAdvanceCreated = newAdvance => {
  if (!newAdvance) return
  loadExpenses()
  showAddAdvanceDialog.value = false
}

const handlePaymentCreated = newPayment => {
  if (!newPayment) return
  loadExpenses()
  showAddPaymentDialog.value = false
}

const handleAdvanceUpdated = updatedAdvance => {
  if (!updatedAdvance) return
  loadExpenses()
  showEditAdvanceDialog.value = false
  selectedAdvance.value = null
}

const handleAdvanceDeleted = advanceId => {
  if (!advanceId) return
  loadExpenses()
  showDeleteAdvanceDialog.value = false
}

const handlePaymentUpdated = updatedPayment => {
  if (!updatedPayment) return
  loadExpenses()
  showEditPaymentDialog.value = false
}

const handlePaymentDeleted = paymentId => {
  if (!paymentId) return
  loadExpenses()
  showDeletePaymentDialog.value = false
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const formatMonthLabel = monthStr => {
  if (!monthStr) return ''
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const parts = String(monthStr).split('-')
  if (parts.length === 2) {
    const mIndex = parseInt(parts[1], 10) - 1
    if (mIndex >= 0 && mIndex < 12) {
      return `${monthNames[mIndex]} ${parts[0]}`
    }
  }
  return monthStr
}

const generatePDF = async item => {
  try {
    const response = await $api(`employee-expenses/${item.type}/${item.id}/pdf`, {
      responseType: 'blob',
    })

    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')

    const safeName = item.employee_name ? item.employee_name.replace(/\s+/g, '_') : 'empleado'
    const dateStr = item.payment_month || new Date().toISOString().split('T')[0]
    const prefix = item.type === 'payment' ? 'ROL_PAGOS' : 'ADELANTO'
    const fileName = `${prefix}_${item.id}_${safeName}_${dateStr}.pdf`

    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error al generar PDF:', error)
    showNotification('Error al generar el PDF del comprobante.', 'error')
  }
}

const filteredExpenses = computed(() => {
  let filtered = expenses.value
  if (selectedType.value === 'payments') filtered = filtered.filter(e => e.type === 'payment')
  if (selectedType.value === 'advances') filtered = filtered.filter(e => e.type === 'advance')

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(e => {
      const empName = (e.employee_name || '').toLowerCase()
      const desc = (e.description || e.reason || '').toLowerCase()
      const acc = (e.account_name || '').toLowerCase()
      const date = (e.date || '').toLowerCase()
      const month = formatMonthLabel(e.payment_month || '').toLowerCase()
      const typeStr = e.type === 'payment' ? 'pago rol liquidacion' : 'adelanto anticipo'
      const amount = String(e.amount || '')
      return (
        empName.includes(q) ||
        desc.includes(q) ||
        acc.includes(q) ||
        date.includes(q) ||
        month.includes(q) ||
        typeStr.includes(q) ||
        amount.includes(q)
      )
    })
  }

  return filtered
})

const currentPage = ref(1)
const itemsPerPage = ref(10)

const totalPages = computed(() => Math.ceil(filteredExpenses.value.length / itemsPerPage.value) || 1)

const paginatedExpenses = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredExpenses.value.slice(start, start + itemsPerPage.value)
})

watch([searchQuery, selectedType], () => {
  currentPage.value = 1
})

const getEmployeeInitials = name => {
  if (!name || name === 'N/A') return 'EM'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

onMounted(() => {
  if (canAccessEmployeeExpenses.value) {
    loadExpenses()
  }
})
</script>

<template>
  <!-- Pantalla de Bloqueo -->
  <div v-if="!canAccessEmployeeExpenses" class="d-flex justify-center align-center" style="min-height: 400px">
    <VCard class="pa-8 text-center rounded-xl elevation-4" max-width="460">
      <VAvatar color="error" variant="tonal" size="72" class="mb-4">
        <VIcon size="38" icon="ri-lock-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold mb-2 text-high-emphasis">
        Acceso Restringido
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-6">
        No tienes permisos para acceder a la gestión de nómina.
      </p>
      <VBtn color="primary" size="large" variant="elevated" prepend-icon="ri-dashboard-line"
        class="font-weight-semibold" @click="router.push('/dashboard')">
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>

  <div v-else class="pa-4 pa-sm-6 employee-expenses-page">
    <!-- Encabezado de Navegación de Operaciones -->
    <OperationsHeaderNav active-tab="nomina" />

    <!-- Header Principal -->
    <VCard class="mb-5 rounded-xl border elevation-0 pa-4 bg-surface">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="44" class="elevation-0 flex-shrink-0">
            <VIcon icon="ri-wallet-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0">
                Pagos de Nómina
              </h1>
              <VChip size="small" color="primary" variant="tonal" class="font-weight-bold">
                {{ filteredExpenses.length }} {{ filteredExpenses.length === 1 ? 'registro' : 'registros' }}
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0.5">
              Gestiona los roles de pago y adelantos concedidos a los empleados
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2.5 flex-wrap">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-refresh-line"
            size="default"
            class="font-weight-medium"
            :loading="loading"
            @click="loadExpenses"
          >
            Actualizar
          </VBtn>
          <VBtn
            color="info"
            variant="tonal"
            size="default"
            prepend-icon="ri-hand-coin-line"
            class="font-weight-semibold"
            @click="openAddAdvanceDialog"
          >
            Nuevo Adelanto
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            size="default"
            prepend-icon="ri-money-dollar-circle-line"
            class="font-weight-bold elevation-1"
            @click="openAddPaymentDialog"
          >
            Nuevo Pago
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-5" dense>
      <!-- Total Pagos -->
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-file-user-line" size="26" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Total Roles de Pago</div>
            <div class="text-h6 font-weight-bold text-primary font-mono text-truncate">
              {{ formatCurrency(summary.total_payments) }}
            </div>
            <div class="text-caption text-disabled text-truncate font-weight-regular">
              Suma acumulada de pagos de nómina
            </div>
          </div>
        </VCard>
      </VCol>

      <!-- Total Adelantos -->
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-hand-coin-line" size="26" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Total Adelantos</div>
            <div class="text-h6 font-weight-bold text-warning font-mono text-truncate">
              {{ formatCurrency(summary.total_advances) }}
            </div>
            <div class="text-caption text-disabled text-truncate font-weight-regular">
              Adelantos concedidos a empleados
            </div>
          </div>
        </VCard>
      </VCol>

      <!-- Total General -->
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="46" color="info" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-funds-line" size="26" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Total General Nómina</div>
            <div class="text-h6 font-weight-bold text-info font-mono text-truncate">
              {{ formatCurrency(summary.total_general) }}
            </div>
            <div class="text-caption text-disabled text-truncate font-weight-regular">
              Egresos totales acumulados
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Barra de Filtros y Búsqueda -->
    <VCard class="pa-4 mb-5 rounded-xl border elevation-0 bg-surface">
      <VRow align="center" dense class="gap-y-3">
        <VCol cols="12" md="6">
          <VTextField
            v-model="searchQuery"
            prepend-inner-icon="ri-search-2-line"
            placeholder="Buscar por empleado, mes, descripción o cuenta..."
            hide-details
            clearable
            variant="outlined"
            density="compact"
            :loading="loading"
          />
        </VCol>

        <VCol cols="12" md="6" class="d-flex justify-md-end align-center gap-2.5 flex-wrap">
          <span class="text-body-2 font-weight-medium text-medium-emphasis me-1">Filtrar:</span>
          <VBtn
            size="small"
            :variant="selectedType === 'all' ? 'elevated' : 'tonal'"
            :color="selectedType === 'all' ? 'primary' : 'secondary'"
            prepend-icon="ri-apps-2-line"
            class="font-weight-semibold px-3"
            @click="selectedType = 'all'"
          >
            Todos
          </VBtn>
          <VBtn
            size="small"
            :variant="selectedType === 'payments' ? 'elevated' : 'tonal'"
            :color="selectedType === 'payments' ? 'primary' : 'secondary'"
            prepend-icon="ri-file-user-line"
            class="font-weight-semibold px-3"
            @click="selectedType = 'payments'"
          >
            Pagos
          </VBtn>
          <VBtn
            size="small"
            :variant="selectedType === 'advances' ? 'elevated' : 'tonal'"
            :color="selectedType === 'advances' ? 'primary' : 'secondary'"
            prepend-icon="ri-hand-coin-line"
            class="font-weight-semibold px-3"
            @click="selectedType = 'advances'"
          >
            Adelantos
          </VBtn>
        </VCol>
      </VRow>
    </VCard>

    <!-- ESTADO DE CARGA -->
    <VCard v-if="loading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 190px;"><div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4" style="min-width: 250px;"><div class="shimmer-line w-60 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4" style="min-width: 280px;"><div class="shimmer-line w-80" /></td>
            <td class="py-4" style="width: 200px;"><div class="shimmer-line w-60" /></td>
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-50" /></td>
            <td class="py-4 text-right" style="width: 130px;"><div class="shimmer-line w-50 ms-auto" /></td>
            <td class="py-4 text-center" style="width: 120px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!filteredExpenses.length"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-wallet-3-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron registros de nómina
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los criterios de búsqueda o registra un nuevo pago de nómina o adelanto.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="searchQuery || selectedType !== 'all'" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="searchQuery = ''; selectedType = 'all'">
          Restablecer Filtros
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-money-dollar-circle-line" @click="openAddPaymentDialog">
          Nuevo Pago
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA MODERNA DE NÓMINA -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 190px; min-width: 180px; white-space: nowrap;">
                Tipo / Registro
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 240px; min-width: 200px;">
                Empleado
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 280px;">
                Descripción
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 200px; min-width: 180px; white-space: nowrap;">
                Cuenta de Pago
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 140px; min-width: 130px; white-space: nowrap;">
                Fecha
              </th>
              <th class="text-right font-weight-bold text-uppercase py-3" style="width: 130px; min-width: 120px; white-space: nowrap;">
                Monto
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px; min-width: 120px; white-space: nowrap;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedExpenses" :key="`${item.type}-${item.id}`" class="payroll-table-row">
              <!-- Tipo / Registro -->
              <td class="py-3" style="white-space: nowrap;">
                <!-- PAGO DE NÓMINA -->
                <div v-if="item.type === 'payment'" class="d-flex align-center gap-3">
                  <VAvatar size="34" color="success" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0">
                    <VIcon icon="ri-file-user-line" size="18" color="success" />
                  </VAvatar>
                  <div class="d-flex flex-column text-left">
                    <div class="font-weight-bold text-high-emphasis text-body-2 leading-tight">
                      Rol de Pagos
                    </div>
                    <div v-if="item.payment_month" class="text-caption font-weight-bold text-primary d-flex align-center mt-0.5" style="gap: 6px; font-size: 0.74rem;">
                      <VIcon icon="ri-calendar-event-line" size="13" />
                      <span>{{ formatMonthLabel(item.payment_month) }}</span>
                    </div>
                    <div v-else class="text-caption text-medium-emphasis mt-0.5" style="font-size: 0.74rem;">
                      Liquidación
                    </div>
                  </div>
                </div>

                <!-- ADELANTO DEDUCIDO -->
                <div v-else-if="item.is_deducted" class="d-flex align-center gap-3">
                  <VAvatar size="34" color="secondary" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0">
                    <VIcon icon="ri-checkbox-circle-line" size="18" color="success" />
                  </VAvatar>
                  <div class="d-flex flex-column text-left">
                    <div class="font-weight-bold text-high-emphasis text-body-2 leading-tight">
                      Adelanto
                    </div>
                    <div class="text-caption font-weight-semibold text-success d-flex align-center mt-0.5" style="gap: 6px; font-size: 0.74rem;">
                      <VIcon icon="ri-check-line" size="13" />
                      <span>Liquidado en Rol</span>
                    </div>
                  </div>
                </div>

                <!-- ADELANTO PENDIENTE -->
                <div v-else class="d-flex align-center gap-3">
                  <VAvatar size="34" color="warning" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0">
                    <VIcon icon="ri-hand-coin-line" size="18" color="warning" />
                  </VAvatar>
                  <div class="d-flex flex-column text-left">
                    <div class="font-weight-bold text-high-emphasis text-body-2 leading-tight">
                      Adelanto
                    </div>
                    <div class="text-caption font-weight-semibold text-warning d-flex align-center mt-0.5" style="gap: 6px; font-size: 0.74rem;">
                      <VIcon icon="ri-time-line" size="13" />
                      <span>Por Deducir</span>
                    </div>
                  </div>
                </div>
              </td>

              <!-- Empleado -->
              <td class="py-3" style="max-width: 240px;">
                <div class="d-flex align-center gap-3" style="min-width: 0;">
                  <VAvatar size="34" color="primary" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0 font-weight-bold">
                    <span style="font-size: 0.8rem;">{{ getEmployeeInitials(item.employee_name) }}</span>
                  </VAvatar>
                  <div class="d-flex flex-column text-left" style="min-width: 0; flex: 1 1 auto;">
                    <div
                      class="font-weight-bold text-high-emphasis text-body-2 text-truncate"
                      :title="item.employee_name"
                    >
                      {{ item.employee_name }}
                    </div>
                    <div class="text-caption text-medium-emphasis mt-0.5 font-weight-medium text-truncate" style="font-size: 0.74rem;">
                      {{ item.type === 'payment' ? 'Empleado / Sueldo' : 'Anticipo' }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Descripción -->
              <td class="py-3">
                <div
                  class="text-body-2 text-high-emphasis line-clamp-2"
                  :title="item.description || item.reason"
                  style="max-width: 320px;"
                >
                  {{ item.description || item.reason || 'Sin descripción adicional' }}
                </div>
              </td>

              <!-- Cuenta de Pago -->
              <td class="py-3" style="white-space: nowrap;">
                <div class="d-flex align-center gap-2.5">
                  <VAvatar size="28" :color="item.account_name && item.account_name.toLowerCase().includes('efectivo') ? 'success' : 'primary'" variant="tonal" rounded="lg" class="flex-shrink-0">
                    <VIcon :icon="item.account_name && item.account_name.toLowerCase().includes('efectivo') ? 'ri-money-dollar-circle-line' : 'ri-bank-line'" size="15" />
                  </VAvatar>
                  <span class="font-weight-medium text-high-emphasis text-body-2">
                    {{ cleanAccountName(item.account_name) }}
                  </span>
                </div>
              </td>

              <!-- Fecha -->
              <td class="py-3" style="white-space: nowrap;">
                <div class="d-flex align-center text-body-2 text-medium-emphasis">
                  <VIcon icon="ri-calendar-line" size="15" class="me-2 flex-shrink-0 text-disabled" />
                  <span class="font-weight-medium">{{ item.date }}</span>
                </div>
              </td>

              <!-- Monto -->
              <td class="py-3 text-right" style="white-space: nowrap;">
                <span class="font-weight-bold font-mono text-body-1 text-high-emphasis">
                  {{ formatCurrency(item.amount) }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <div class="d-flex justify-center align-center gap-3">
                  <VBtn
                    size="small"
                    color="primary"
                    variant="tonal"
                    icon="ri-eye-line"
                    title="Ver Nota y Comprobantes"
                    @click="openEmployeeNoteDialog(item)"
                  />

                  <VBtn
                    size="small"
                    color="secondary"
                    variant="tonal"
                    icon="ri-more-2-line"
                    title="Más Opciones"
                  >
                    <VMenu
                      activator="parent"
                      transition="slide-y-transition"
                      align="end"
                      location="bottom end"
                    >
                      <VList density="compact" class="py-1 rounded-lg elevation-4 border" min-width="200">
                        <VListItem
                          :prepend-icon="item.type === 'payment' ? 'ri-file-pdf-line' : 'ri-file-text-line'"
                          :title="item.type === 'payment' ? 'Descargar Rol de Pagos' : 'Descargar Comprobante'"
                          :class="item.type === 'payment' ? 'text-primary font-weight-medium' : 'text-info font-weight-medium'"
                          @click="generatePDF(item)"
                        />
                        <VListItem
                          prepend-icon="ri-attachment-2"
                          title="Adjuntar Comprobante"
                          class="text-secondary font-weight-medium"
                          @click="openAttachDialog(item)"
                        />
                        <VDivider class="my-1" />
                        <VListItem
                          prepend-icon="ri-edit-line"
                          title="Editar Registro"
                          class="text-warning font-weight-medium"
                          :disabled="item.type === 'advance' && item.is_deducted"
                          @click="item.type === 'payment' ? openEditPaymentDialog(item) : openEditAdvanceDialog(item)"
                        />
                        <VListItem
                          prepend-icon="ri-delete-bin-line"
                          title="Eliminar Registro"
                          class="text-error font-weight-medium"
                          :disabled="item.type === 'advance' && item.is_deducted"
                          @click="item.type === 'payment' ? openDeletePaymentDialog(item) : openDeleteAdvanceDialog(item)"
                        />
                      </VList>
                    </VMenu>
                  </VBtn>
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ paginatedExpenses.length }}</strong> de <strong class="text-high-emphasis">{{ filteredExpenses.length }}</strong> registros
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            color="primary"
          />
        </div>
      </VCard>
    </div>

    <!-- Diálogos -->
    <AddEmployeeAdvanceDialog v-if="showAddAdvanceDialog" v-model="showAddAdvanceDialog" :accounts="[]"
      @created="handleAdvanceCreated" />
    <AddEmployeePaymentDialog v-if="showAddPaymentDialog" v-model="showAddPaymentDialog" :accounts="[]"
      @created="handlePaymentCreated" />
    <EditEmployeeAdvanceDialog v-if="showEditAdvanceDialog" v-model="showEditAdvanceDialog" :expense="selectedAdvance"
      @updated="handleAdvanceUpdated" />
    <DeleteEmployeeAdvanceDialog v-if="showDeleteAdvanceDialog" v-model="showDeleteAdvanceDialog"
      :advance="selectedAdvance" @deleted="handleAdvanceDeleted" />
    <EditEmployeePaymentDialog v-if="showEditPaymentDialog" v-model="showEditPaymentDialog" :expense="selectedPayment"
      @updated="handlePaymentUpdated" />
    <DeleteEmployeePaymentDialog v-if="showDeletePaymentDialog" v-model="showDeletePaymentDialog"
      :payment="selectedPayment" @deleted="handlePaymentDeleted" />

    <!-- Diálogo de Nota de Pago / Adelanto y Comprobantes (VDialog) -->
    <MovementReceiptNoteDialog v-if="selectedItemForNote" v-model="isNoteDialogVisible" :movement="selectedItemForNote"
      @updated="loadExpenses" />

    <!-- Diálogo de Gestión de Comprobantes Adjuntos (VDialog) -->
    <AttachReceiptsDialog v-if="selectedItemForReceipts" :is-dialog-visible="isReceiptsDialogVisible"
      :attachable-type="selectedItemForReceipts.type === 'payment' ? 'employee_payment' : 'employee_advance'"
      :attachable-id="selectedItemForReceipts.id"
      :title="`Comprobantes de ${selectedItemForReceipts.type === 'payment' ? 'Pago' : 'Adelanto'} — ${selectedItemForReceipts.employee_name}`"
      :identifier="selectedItemForReceipts.type === 'payment' ? `PAGO-EMP-${String(selectedItemForReceipts.id).padStart(5, '0')}` : `ADEL-EMP-${String(selectedItemForReceipts.id).padStart(5, '0')}`"
      :party-name="selectedItemForReceipts.employee_name"
      @update:is-dialog-visible="val => { isReceiptsDialogVisible = val; if (!val) selectedItemForReceipts = null; }"
      @updated="loadExpenses" />
  </div>
</template>

<style scoped lang="scss">
.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.payroll-table-row {
  transition: background-color 0.15s ease;

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
  line-height: 1.35;
}

.shimmer-line {
  height: 12px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  border-radius: 6px;
  animation: shimmer 1.5s infinite;
}

.shimmer-button {
  width: 32px;
  height: 32px;
  background: #f0f0f0;
  border-radius: 8px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>

