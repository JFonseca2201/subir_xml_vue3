<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import AddEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/AddEmployeeAdvanceDialog.vue'
import EditEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/EditEmployeeAdvanceDialog.vue'
import DeleteEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/DeleteEmployeeAdvanceDialog.vue'
import AddEmployeePaymentDialog from '@/components/inventory/employee-expenses/AddEmployeePaymentDialog.vue'
import EditEmployeePaymentDialog from '@/components/inventory/employee-expenses/EditEmployeePaymentDialog.vue'
import DeleteEmployeePaymentDialog from '@/components/inventory/employee-expenses/DeleteEmployeePaymentDialog.vue'
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

// Dialog state
const showAddPaymentDialog = ref(false)
const showEditPaymentDialog = ref(false)
const showDeletePaymentDialog = ref(false)
const showAddAdvanceDialog = ref(false)
const showEditAdvanceDialog = ref(false)
const showDeleteAdvanceDialog = ref(false)
const selectedAdvance = ref(null)
const selectedPayment = ref(null)

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
  { title: 'TIPO', key: 'type', sortable: true },
  { title: 'EMPLEADO', key: 'employee_name', sortable: true },
  { title: 'DESCRIPCIÓN', key: 'description' },
  { title: 'CUENTA', key: 'account_name', sortable: true },
  { title: 'MONTO', key: 'amount', sortable: true, align: 'end' },
  { title: 'FECHA', key: 'raw_date', sortable: true },
  { title: 'ACCIONES', key: 'actions', sortable: false, align: 'center' },
]

// Functions
const loadExpenses = async () => {
  loader.start()
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
      const parseDate = (d) => {
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
    loader.stop()
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

const generatePDF = async item => {
  try {
    const response = await $api(`employee-expenses/${item.type}/${item.id}/pdf`, {
      responseType: 'blob',
    })

    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')

    const safeName = item.employee_name ? item.employee_name.replace(/\s+/g, '_') : 'empleado'
    const dateStr = new Date().toISOString().split('T')[0]
    const fileName = `${item.type}_${item.id}_${safeName}_${dateStr}.pdf`

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
  return filtered
})

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
      <h3 class="text-h5 font-weight-bold mb-2 text-high-emphasis">Acceso Restringido</h3>
      <p class="text-body-1 text-medium-emphasis mb-6">No tienes permisos para acceder a la gestión de nómina.</p>
      <VBtn color="primary" size="large" variant="elevated" prepend-icon="ri-dashboard-line" class="font-weight-semibold" @click="router.push('/dashboard')">
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>

  <div v-else class="pa-4 pa-sm-6 employee-expenses-page">
    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-5 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-4">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="56" class="elevation-1">
            <VIcon icon="ri-user-3-line" size="32" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h4 font-weight-bold text-high-emphasis mb-0">Pagos de Nómina</h1>
              <VChip size="small" color="primary" variant="tonal" class="font-weight-bold">
                {{ filteredExpenses.length }} {{ filteredExpenses.length === 1 ? 'registro' : 'registros' }}
              </VChip>
            </div>
            <p class="text-body-1 text-medium-emphasis mb-0 mt-1">
              Gestiona los pagos y adelantos otorgados a los empleados
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-3 flex-wrap">
          <VBtn
            color="primary"
            variant="elevated"
            size="large"
            prepend-icon="ri-money-dollar-circle-line"
            class="font-weight-semibold elevation-2"
            @click="openAddPaymentDialog"
          >
            Nuevo Pago
          </VBtn>
          <VBtn
            color="info"
            variant="elevated"
            size="large"
            prepend-icon="ri-hand-coin-line"
            class="font-weight-semibold elevation-2"
            @click="openAddAdvanceDialog"
          >
            Nuevo Adelanto
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Tarjetas de Resumen KPI con colores tonales -->
    <VRow class="mb-6">
      <!-- Total Pagos -->
      <VCol cols="12" sm="6" md="4">
        <VCard class="pa-5 rounded-xl tonal-card bg-primary-tonal border-primary" elevation="0">
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-primary text-uppercase tracking-wider">
                Total Pagos
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(summary.total_payments) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma acumulada de pagos de nómina
              </span>
            </div>
            <VAvatar color="primary" variant="elevated" size="52" class="elevation-3">
              <VIcon size="28" icon="ri-money-dollar-circle-line" color="white" />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Total Adelantos -->
      <VCol cols="12" sm="6" md="4">
        <VCard class="pa-5 rounded-xl tonal-card bg-success-tonal border-success" elevation="0">
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-success text-uppercase tracking-wider">
                Total Adelantos
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(summary.total_advances) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma acumulada de adelantos
              </span>
            </div>
            <VAvatar color="success" variant="elevated" size="52" class="elevation-3">
              <VIcon size="28" icon="ri-hand-coin-line" color="white" />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Total General -->
      <VCol cols="12" sm="12" md="4">
        <VCard class="pa-5 rounded-xl tonal-card bg-info-tonal border-info" elevation="0">
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-info text-uppercase tracking-wider">
                Total General
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(summary.total_general) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma total de egresos por nómina
              </span>
            </div>
            <VAvatar color="info" variant="elevated" size="52" class="elevation-3">
              <VIcon size="28" icon="ri-funds-line" color="white" />
            </VAvatar>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Barra de Filtros de Búsqueda -->
    <VCard class="pa-4 mb-6 rounded-xl border-light elevation-1">
      <VRow align="center" density="comfortable">
        <VCol cols="12" md="6">
          <VTextField
            v-model="searchQuery"
            prepend-inner-icon="ri-search-2-line"
            placeholder="Buscar por empleado, descripción o cuenta..."
            hide-details
            clearable
            variant="outlined"
            density="compact"
          />
        </VCol>

        <VCol cols="12" md="6" class="d-flex justify-md-end align-center gap-2 flex-wrap">
          <span class="text-body-2 font-weight-medium text-medium-emphasis me-2">Filtrar:</span>
          <VBtn
            size="small"
            :variant="selectedType === 'all' ? 'elevated' : 'tonal'"
            :color="selectedType === 'all' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedType = 'all'"
          >
            Todos
          </VBtn>
          <VBtn
            size="small"
            :variant="selectedType === 'payments' ? 'elevated' : 'tonal'"
            :color="selectedType === 'payments' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedType = 'payments'"
          >
            Pagos
          </VBtn>
          <VBtn
            size="small"
            :variant="selectedType === 'advances' ? 'elevated' : 'tonal'"
            :color="selectedType === 'advances' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedType = 'advances'"
          >
            Adelantos
          </VBtn>
        </VCol>
      </VRow>
    </VCard>

    <!-- Tabla de Datos Unificada -->
    <VCard class="rounded-xl border-light overflow-hidden elevation-1 transfer-table-container">
      <VDataTable
        :headers="headers"
        :items="filteredExpenses"
        :search="searchQuery"
        :loading="loader.loading"
        :sort-by="[{ key: 'raw_date', order: 'desc' }]"
        class="transfer-table text-no-wrap"
        hover
      >
        <template #item.type="{ item }">
          <VChip
            :color="item.type === 'payment' ? 'success' : (item.is_deducted ? 'grey' : 'info')"
            variant="tonal"
            size="small"
            class="font-weight-bold"
          >
            <VIcon start size="14">
              {{ item.type === 'payment' ? 'ri-money-dollar-circle-line' : (item.is_deducted ? 'ri-check-line' : 'ri-hand-coin-line') }}
            </VIcon>
            {{ item.type === 'payment' ? 'PAGO' : (item.is_deducted ? 'ADELANTO PAGADO' : 'ADELANTO') }}
          </VChip>
        </template>

        <template #item.employee_name="{ item }">
          <div class="d-flex align-center gap-2 font-weight-medium text-high-emphasis">
            <VIcon color="primary" size="18">ri-user-line</VIcon>
            {{ item.employee_name }}
          </div>
        </template>

        <template #item.account_name="{ item }">
          <div class="d-flex align-center gap-2 font-weight-medium text-high-emphasis">
            <VIcon color="primary" size="18">ri-bank-line</VIcon>
            {{ cleanAccountName(item.account_name) }}
          </div>
        </template>

        <template #item.amount="{ item }">
          <span
            class="font-weight-extrabold"
            :class="item.type === 'payment' ? 'text-primary' : 'text-info'"
          >
            {{ formatCurrency(item.amount) }}
          </span>
        </template>

        <template #item.raw_date="{ item }">
          <span class="text-body-2 text-medium-emphasis">{{ item.date }}</span>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex gap-1 justify-center">
            <VBtn
              title="Descargar PDF"
              icon="ri-file-pdf-line"
              variant="tonal"
              size="small"
              color="info"
              class="action-btn"
              @click="generatePDF(item)"
            />
            <VBtn
              title="Editar"
              icon="ri-edit-line"
              variant="tonal"
              size="small"
              color="primary"
              class="action-btn"
              :disabled="item.type === 'advance' && item.is_deducted"
              @click="item.type === 'payment' ? openEditPaymentDialog(item) : openEditAdvanceDialog(item)"
            />
            <VBtn
              title="Eliminar"
              icon="ri-delete-bin-line"
              variant="tonal"
              size="small"
              color="error"
              class="action-btn"
              :disabled="item.type === 'advance' && item.is_deducted"
              @click="item.type === 'payment' ? openDeletePaymentDialog(item) : openDeleteAdvanceDialog(item)"
            />
          </div>
        </template>

        <template #no-data>
          <div class="text-center pa-12 text-medium-emphasis">
            <VAvatar color="primary" variant="tonal" size="80" class="mb-4">
              <VIcon icon="ri-inbox-line" size="42" color="primary" />
            </VAvatar>
            <h3 class="text-h6 font-weight-bold text-high-emphasis">No hay registros</h3>
            <p class="text-body-2 text-medium-emphasis mt-1">No se encontraron pagos ni adelantos registrados.</p>
          </div>
        </template>
      </VDataTable>
    </VCard>

    <!-- Diálogos -->
    <AddEmployeeAdvanceDialog
      v-if="showAddAdvanceDialog"
      v-model="showAddAdvanceDialog"
      :accounts="[]"
      @created="handleAdvanceCreated"
    />
    <AddEmployeePaymentDialog
      v-if="showAddPaymentDialog"
      v-model="showAddPaymentDialog"
      :accounts="[]"
      @created="handlePaymentCreated"
    />
    <EditEmployeeAdvanceDialog
      v-if="showEditAdvanceDialog"
      v-model="showEditAdvanceDialog"
      :expense="selectedAdvance"
      @updated="handleAdvanceUpdated"
    />
    <DeleteEmployeeAdvanceDialog
      v-if="showDeleteAdvanceDialog"
      v-model="showDeleteAdvanceDialog"
      :advance="selectedAdvance"
      @deleted="handleAdvanceDeleted"
    />
    <EditEmployeePaymentDialog
      v-if="showEditPaymentDialog"
      v-model="showEditPaymentDialog"
      :expense="selectedPayment"
      @updated="handlePaymentUpdated"
    />
    <DeleteEmployeePaymentDialog
      v-if="showDeletePaymentDialog"
      v-model="showDeletePaymentDialog"
      :payment="selectedPayment"
      @deleted="handlePaymentDeleted"
    />
  </div>
</template>

<style scoped>
.sticky-header {
  position: sticky;
  top: 62px;
  z-index: 99;
  background-color: rgb(var(--v-theme-surface)) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08) !important;
  transition: all 0.2s ease;
}
@media (min-width: 960px) {
  .sticky-header {
    top: 70px;
  }
}
</style>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
