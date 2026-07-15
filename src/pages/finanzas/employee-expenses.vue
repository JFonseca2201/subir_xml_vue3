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
  return currentUser.value && [1, 2].includes(roleId) // Asumiendo Admin/Gerente
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
        account_name: payment.account_name || 'N/A',
        raw_date: payment.date ? payment.date.split('/').reverse().join('-') : '1970-01-01',
      })),
      ...(expensesResponse.advances || []).map(advance => ({
        ...advance,
        employee_name: advance.employee_name || 'N/A',
        account_name: advance.account_name || 'N/A',
        raw_date: advance.date ? advance.date.split('/').reverse().join('-') : '1970-01-01',
      })),
    ]

    // Ordenar por fecha descendente (más reciente primero)
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
  }).format(value)
}

const generatePDF = async item => {
  try {
    const response = await $api(`employee-expenses/${item.type}/${item.id}/pdf`, {
      responseType: 'blob',
    })

    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')

    // Formatear nombre del empleado (quitar espacios o dejarlos)
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
  <div>
    <!-- Pantalla de Bloqueo -->
    <div v-if="!canAccessEmployeeExpenses" class="d-flex justify-center align-center" style="height: 400px">
      <VCard class="pa-6 text-center" elevation="4" rounded="xl">
        <VIcon size="64" color="error" class="mb-4">ri-lock-line</VIcon>
        <h3 class="text-h5 mb-2">Acceso Restringido</h3>
        <p class="text-medium-emphasis">No tienes permisos para acceder a esta sección.</p>
        <VBtn color="primary" class="mt-4" @click="router.push('/dashboard')">Volver al Dashboard</VBtn>
      </VCard>
    </div>

    <div v-else>
      <!-- Cabecera Estandarizada -->
      <VRow class="mb-4">
        <VCol>
          <div class="d-flex align-center justify-space-between flex-wrap gap-4">
            <div class="d-flex align-center gap-3">
              <VAvatar color="primary" variant="tonal" rounded size="48">
                <VIcon icon="ri-user-3-line" size="28" />
              </VAvatar>
              <div>
                <h4 class="text-h5 font-weight-bold mb-1">Pagos de Nómina</h4>
                <span class="text-body-2 text-medium-emphasis">Gestiona los pagos y adelantos a empleados</span>
              </div>
            </div>
            <div class="d-flex gap-3">
              <VBtn color="primary" variant="elevated" prepend-icon="ri-money-dollar-circle-line"
                @click="openAddPaymentDialog">
                Nuevo Pago
              </VBtn>
              <VBtn color="info" variant="elevated" prepend-icon="ri-hand-coin-line" @click="openAddAdvanceDialog">
                Nuevo Adelanto
              </VBtn>
            </div>
          </div>
        </VCol>
      </VRow>

      <!-- Tarjetas de Resumen Estandarizadas -->
      <VRow class="mb-6">
        <VCol cols="12" md="4">
          <VCard elevation="2" class="rounded-lg h-100">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-money-dollar-circle-line" color="primary" />
                  <span class="font-weight-bold text-h6">Total Pagos</span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-5">
              <div class="d-flex justify-space-between align-center">
                <span class="text-body-1 text-medium-emphasis">Suma de pagos</span>
                <span class="text-h5 font-weight-black text-primary">{{ formatCurrency(summary.total_payments) }}</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" md="4">
          <VCard elevation="2" class="rounded-lg h-100">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-hand-coin-line" color="success" />
                  <span class="font-weight-bold text-h6">Total Adelantos</span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-5">
              <div class="d-flex justify-space-between align-center">
                <span class="text-body-1 text-medium-emphasis">Suma de adelantos</span>
                <span class="text-h5 font-weight-black text-success">{{ formatCurrency(summary.total_advances) }}</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" md="4">
          <VCard elevation="2" class="rounded-lg h-100">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-funds-line" color="warning" />
                  <span class="font-weight-bold text-h6">Total General</span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-5">
              <div class="d-flex justify-space-between align-center">
                <span class="text-body-1 text-medium-emphasis">Suma total de egresos</span>
                <span class="text-h5 font-weight-black text-warning">{{ formatCurrency(summary.total_general) }}</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Tabla de Datos -->
      <VCard elevation="2" class="rounded-lg">
        <VCardItem class="pa-4 border-b">
          <div class="d-flex justify-space-between align-center flex-wrap gap-4">
            <div class="d-flex gap-2">
              <VBtn :variant="selectedType === 'all' ? 'elevated' : 'tonal'"
                :color="selectedType === 'all' ? 'primary' : 'secondary'" size="small" @click="selectedType = 'all'">
                Todos
              </VBtn>
              <VBtn :variant="selectedType === 'payments' ? 'elevated' : 'tonal'"
                :color="selectedType === 'payments' ? 'primary' : 'secondary'" size="small"
                @click="selectedType = 'payments'">
                Pagos
              </VBtn>
              <VBtn :variant="selectedType === 'advances' ? 'elevated' : 'tonal'"
                :color="selectedType === 'advances' ? 'primary' : 'secondary'" size="small"
                @click="selectedType = 'advances'">
                Adelantos
              </VBtn>
            </div>
            <div style="width: 250px;">
              <VTextField v-model="searchQuery" prepend-inner-icon="ri-search-line" label="Buscar..." density="compact"
                variant="outlined" hide-details />
            </div>
          </div>
        </VCardItem>

        <VDataTable :headers="headers" :items="filteredExpenses" :search="searchQuery" :loading="loader.loading"
          :sort-by="[{ key: 'raw_date', order: 'desc' }]" class="elevation-0" hover>
          <template #item.type="{ item }">
            <VChip :color="item.type === 'payment' ? 'success' : (item.is_deducted ? 'grey' : 'info')" variant="tonal"
              size="small" class="font-weight-bold">
              <VIcon start size="14">{{ item.type === 'payment' ? 'ri-money-dollar-circle-line' : (item.is_deducted ?
                'ri-check-line' : 'ri-hand-coin-line') }}</VIcon>
              {{ item.type === 'payment' ? 'PAGO' : (item.is_deducted ? 'ADELANTO PAGADO' : 'ADELANTO') }}
            </VChip>
          </template>

          <template #item.employee_name="{ item }">
            <div class="d-flex align-center gap-2 font-weight-medium">
              <VIcon color="primary" size="18">ri-user-line</VIcon>
              {{ item.employee_name }}
            </div>
          </template>

          <template #item.account_name="{ item }">
            <div class="d-flex align-center gap-2">
              <VIcon color="primary" size="18">ri-bank-line</VIcon>
              {{ item.account_name }}
            </div>
          </template>

          <template #item.amount="{ item }">
            <span class="font-weight-bold" :class="item.type === 'payment' ? 'text-success' : 'text-info'">
              {{ formatCurrency(item.amount) }}
            </span>
          </template>

          <template #item.raw_date="{ item }">
            <span class="text-body-2 text-medium-emphasis">{{ item.date }}</span>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex gap-2 justify-center">
              <VBtn title="Descargar PDF" icon="ri-file-pdf-line" variant="tonal" size="small" color="info"
                @click="generatePDF(item)" />
              <VBtn title="Editar" icon="ri-edit-line" variant="tonal" size="small" color="primary"
                :disabled="item.type === 'advance' && item.is_deducted"
                @click="item.type === 'payment' ? openEditPaymentDialog(item) : openEditAdvanceDialog(item)" />
              <VBtn title="Eliminar" icon="ri-delete-bin-line" variant="tonal" size="small" color="error"
                :disabled="item.type === 'advance' && item.is_deducted"
                @click="item.type === 'payment' ? openDeletePaymentDialog(item) : openDeleteAdvanceDialog(item)" />
            </div>
          </template>

          <template #no-data>
            <div class="text-center pa-12 text-medium-emphasis">
              <VAvatar color="grey-lighten-3" size="72" class="mb-4">
                <VIcon icon="ri-inbox-line" size="36" color="grey" />
              </VAvatar>
              <h3 class="text-h6 font-weight-medium">No hay registros</h3>
              <p class="text-body-2 mt-1">No se encontraron pagos ni adelantos registrados.</p>
            </div>
          </template>
        </VDataTable>
      </VCard>

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
    </div>
  </div>
</template>



<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
