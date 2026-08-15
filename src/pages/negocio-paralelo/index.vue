<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

// Data State
const transactions = ref([])
const loading = ref(false)

const getCurrentDateEC = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
}

// Initial mock balances (burned data that can be adjusted)
const initialCash = ref(0.00)
const initialTransfer = ref(0.00)

// Filters State
const searchQuery = ref('')
const typeFilter = ref('ALL')
const accountFilter = ref('ALL')

// Dialog States
const isIncomeDialogOpen = ref(false)
const isExpenseDialogOpen = ref(false)
const isEditing = ref(false)
const editingId = ref(null)

// PDF Report Dialog State
const isPdfDialogOpen = ref(false)
const pdfRange = ref('month')
const pdfStartDate = ref('')
const pdfEndDate = ref('')
const pdfAccount = ref('ALL')

// Form Refs
const incomeFormRef = ref(null)
const expenseFormRef = ref(null)

// Form Objects
const incomeForm = ref({
  description: '',
  quantity: 1,
  unitCost: null,
  account: 'EFECTIVO',
  date: getCurrentDateEC(),
})

const expenseForm = ref({
  description: '',
  category: '',
  unitCost: null,
  quantity: 1,
  unit: '',
  account: 'EFECTIVO',
  date: getCurrentDateEC(),
})

const showIncomeDatePicker = ref(false)
const showExpenseDatePicker = ref(false)

// Constants and Refs for Income Products
const incomeProductMap = ref({})
const incomeProductList = computed(() => Object.keys(incomeProductMap.value))

const incomeProductSelect = ref('')

const onIncomeProductChange = val => {
  if (val && incomeProductMap.value[val] !== undefined) {
    incomeForm.value.unitCost = incomeProductMap.value[val]
  }
}

// Summary Modal Refs
const isSummaryDialogOpen = ref(false)
const summaryDate = ref(getCurrentDateEC())


// Rules
const rules = {
  required: v => !!v || 'Este campo es obligatorio',
  positive: v => (v && parseFloat(v) > 0) || 'Debe ser un valor positivo',
  number: v => !isNaN(parseFloat(v)) || 'Debe ser un número válido',
}

// Load transactions from backend API
const loadTransactions = async () => {
  loading.value = true
  try {    const resp = await $api('parallel-transactions')
    transactions.value = resp || []
  } catch (err) {
    console.error('Error al cargar transacciones:', err)
    showNotification('Error al cargar transacciones desde la base de datos', 'error')
  } finally {
    loading.value = false
  }
}

// Opciones de Búsqueda y Filtro (Frontend)
const filteredTransactions = computed(() => {
  return transactions.value.filter(t => {
    if (searchQuery.value && searchQuery.value.trim()) {
      const search = searchQuery.value.toLowerCase().trim()
      const desc = (t.description || '').toLowerCase()
      const amount = (t.amount || '').toString()
      const unit = (t.unit || '').toLowerCase()
      const unitCost = (t.unit_cost || '').toString()
      
      if (!desc.includes(search) && !amount.includes(search) && !unit.includes(search) && !unitCost.includes(search)) {
        return false
      }
    }
    if (typeFilter.value !== 'ALL' && t.type.toLowerCase() !== typeFilter.value.toLowerCase()) {
      return false
    }
    if (accountFilter.value !== 'ALL' && t.account.toUpperCase() !== accountFilter.value.toUpperCase()) {
      return false
    }
    return true
  })
})

// Options state
const expenseCategories = ref([])
const expenseUnits = ref([])

const loadOptions = async () => {
  try {
    const [catResp, unitResp, incomeResp] = await Promise.all([
      $api('parallel-categories'),
      $api('parallel-unit-types'),
      $api('parallel-income-products'),
    ])

    expenseCategories.value = catResp || []
    expenseUnits.value = unitResp || []

    const productsMap = {}
    if (incomeResp && Array.isArray(incomeResp)) {
      incomeResp.forEach(prod => {
        productsMap[prod.name] = parseFloat(prod.default_price)
      })
    }
    incomeProductMap.value = productsMap
  } catch (error) {
    console.error('Error cargando opciones:', error)
  }
}


// Computed Balances based on DB records
const totalIncomes = computed(() => {
  return transactions.value
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
})

const totalExpenses = computed(() => {
  return transactions.value
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
})

const netBalance = computed(() => {
  return totalIncomes.value - totalExpenses.value
})

const currentCashBalance = computed(() => {
  const cashIn = transactions.value
    .filter(t => t.type === 'income' && t.account === 'EFECTIVO')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)

  const cashOut = transactions.value
    .filter(t => t.type === 'expense' && t.account === 'EFECTIVO')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)

  return initialCash.value + cashIn - cashOut
})

const currentTransferBalance = computed(() => {
  const transIn = transactions.value
    .filter(t => t.type === 'income' && t.account === 'TRANSFERENCIA')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)

  const transOut = transactions.value
    .filter(t => t.type === 'expense' && t.account === 'TRANSFERENCIA')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)

  return initialTransfer.value + transIn - transOut
})

// Summary Modal Computed Properties
const summaryTransactions = computed(() => {
  return transactions.value.filter(t => {
    // If the transaction has a full datetime, extract just the date part for comparison
    const tDate = t.date ? t.date.substr(0, 10) : ''
    
    return tDate === summaryDate.value
  })
})

const summaryIncomesGrouped = computed(() => {
  const incomes = summaryTransactions.value.filter(t => t.type === 'income')
  const grouped = {}

  incomes.forEach(t => {
    const key = `${t.description}_${t.unit_cost}`
    if (!grouped[key]) {
      grouped[key] = {
        description: t.description,
        unit_cost: parseFloat(t.unit_cost) || 0,
        total_quantity: 0,
        total_amount: 0,
      }
    }
    grouped[key].total_quantity += parseInt(t.quantity || 1)
    grouped[key].total_amount += parseFloat(t.amount || 0)
  })

  return Object.values(grouped).sort((a, b) => b.total_amount - a.total_amount)
})

const summaryTotalIncome = computed(() => {
  return summaryTransactions.value.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
})

const summaryTotalExpense = computed(() => {
  return summaryTransactions.value.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
})

const summaryNetBalance = computed(() => summaryTotalIncome.value - summaryTotalExpense.value)

const summaryCash = computed(() => {
  return summaryTransactions.value.filter(t => t.type === 'income' && t.account === 'EFECTIVO').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
})

const summaryTransfer = computed(() => {
  return summaryTransactions.value.filter(t => t.type === 'income' && t.account === 'TRANSFERENCIA').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
})



const incomeTransactions = computed(() => {
  return filteredTransactions.value.filter(t => t.type === 'income')
})

const expenseTransactions = computed(() => {
  return filteredTransactions.value.filter(t => t.type === 'expense')
})

// Add Income Action
const openIncome = () => {
  isEditing.value = false
  editingId.value = null
  incomeProductSelect.value = ''
  incomeForm.value = {
    quantity: 1,
    unitCost: null,
    account: 'EFECTIVO',
    date: getCurrentDateEC(),
  }
  showIncomeDatePicker.value = false
  isIncomeDialogOpen.value = true
}

const saveIncome = async () => {
  const { valid } = await incomeFormRef.value.validate()
  if (!valid) return

  if (!incomeProductSelect.value) {
    showNotification('Debe seleccionar o escribir un producto', 'error')
    
    return
  }

  let finalDescription = incomeProductSelect.value.trim()

  try {
    // Dynamic Income Product Creation / Update
    // Si no existe, o si existe pero el precio es diferente, lo actualizamos/creamos
    if (finalDescription) {
      if (
        !incomeProductMap.value[finalDescription] ||
        incomeProductMap.value[finalDescription] !== incomeForm.value.unitCost
      ) {
        await $api('parallel-income-products', {
          method: 'POST',
          body: {
            name: finalDescription,
            default_price: incomeForm.value.unitCost || 0,
          },
        })
        incomeProductMap.value[finalDescription] = parseFloat(incomeForm.value.unitCost || 0)
      }
    }

    const endpoint = isEditing.value ? `parallel-transactions/${editingId.value}` : 'parallel-transactions'
    const method = isEditing.value ? 'PUT' : 'POST'

    const response = await $api(endpoint, {
      method,
      body: {
        type: 'income',
        description: finalDescription,
        quantity: incomeForm.value.quantity,
        unit_cost: incomeForm.value.unitCost,
        account: incomeForm.value.account,
        date: incomeForm.value.date,
      },
    })

    if (response) {
      loadTransactions()
      isIncomeDialogOpen.value = false
      showNotification(isEditing.value ? 'Ingreso actualizado correctamente' : 'Ingreso registrado correctamente', 'success')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al guardar el ingreso en la base de datos', 'error')
  }
}

// Add Expense Action
const openExpense = () => {
  isEditing.value = false
  editingId.value = null
  expenseForm.value = {
    description: '',
    category: '',
    unitCost: null,
    quantity: 1,
    unit: '',
    account: 'EFECTIVO',
    date: getCurrentDateEC(),
  }
  showExpenseDatePicker.value = false
  isExpenseDialogOpen.value = true
}

const saveExpense = async () => {
  const { valid } = await expenseFormRef.value.validate()
  if (!valid) return

  try {
    // Dynamic Category Creation
    if (expenseForm.value.category && !expenseCategories.value.includes(expenseForm.value.category)) {
      await $api('parallel-categories', {
        method: 'POST',
        body: { name: expenseForm.value.category },
      })
      expenseCategories.value.push(expenseForm.value.category)
    }

    // Dynamic Unit Creation
    if (expenseForm.value.unit && !expenseUnits.value.includes(expenseForm.value.unit)) {
      await $api('parallel-unit-types', {
        method: 'POST',
        body: { name: expenseForm.value.unit },
      })
      expenseUnits.value.push(expenseForm.value.unit)
    }
    const endpoint = isEditing.value ? `parallel-transactions/${editingId.value}` : 'parallel-transactions'
    const method = isEditing.value ? 'PUT' : 'POST'

    const response = await $api(endpoint, {
      method,
      body: {
        type: 'expense',
        description: expenseForm.value.description,
        category: expenseForm.value.category,
        cost: expenseForm.value.unitCost * expenseForm.value.quantity,
        unit_cost: expenseForm.value.unitCost,
        quantity: expenseForm.value.quantity,
        unit: expenseForm.value.unit,
        account: expenseForm.value.account,
        date: expenseForm.value.date,
      },
    })

    if (response) {
      loadTransactions()
      isExpenseDialogOpen.value = false
      showNotification(isEditing.value ? 'Egreso actualizado correctamente' : 'Egreso registrado correctamente', 'success')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al guardar el egreso en la base de datos', 'error')
  }
}

// Edit Transaction Action
const editTransaction = item => {
  isEditing.value = true
  editingId.value = item.id

  if (item.type === 'income') {
    incomeProductSelect.value = item.description

    incomeForm.value = {
      quantity: item.quantity,
      unitCost: item.unit_cost,
      account: item.account,
      date: item.date,
    }
    showIncomeDatePicker.value = false
    isIncomeDialogOpen.value = true
  } else {
    expenseForm.value = {
      description: item.description,
      category: item.category || '',
      unitCost: item.unit_cost ? parseFloat(item.unit_cost) : (parseFloat(item.amount) / (item.quantity || 1)),
      quantity: item.quantity || 1,
      unit: item.unit || '',
      account: item.account,
      date: item.date,
    }
    showExpenseDatePicker.value = false
    isExpenseDialogOpen.value = true
  }
}

// Delete Transaction
const deleteTransaction = async item => {
  const result = await Swal.fire({
    title: '¿Eliminar registro?',
    text: `¿Estás seguro de eliminar "${item.description}"? Se borrará permanentemente de la base de datos.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#fb7578',
    cancelButtonColor: '#90a4ae',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })

  if (result.isConfirmed) {
    try {
      const response = await $api(`parallel-transactions/${item.id}`, {
        method: 'DELETE',
      })

      if (response && response.success) {
        loadTransactions()
        showNotification('Registro eliminado de la base de datos', 'success')
      }
    } catch (error) {
      console.error(error)
      showNotification('Error al eliminar el registro', 'error')
    }
  }
}

// PDF Report Action
const openPdfDialog = () => {
  pdfRange.value = 'month'
  pdfStartDate.value = ''
  pdfEndDate.value = ''
  pdfAccount.value = 'ALL'
  isPdfDialogOpen.value = true
}

const generatePdfReport = () => {
  const token = localStorage.getItem('token') || ''
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')

  let url = `${apiBaseUrl}/parallel-transactions/pdf?token=${token}&range=${pdfRange.value}&account=${pdfAccount.value}`

  if (pdfRange.value === 'custom') {
    if (!pdfStartDate.value || !pdfEndDate.value) {
      showNotification('Por favor ingresa ambas fechas para el rango personalizado', 'warning')
      
      return
    }
    url += `&start_date=${pdfStartDate.value}&end_date=${pdfEndDate.value}`
  }

  window.open(url, '_blank')
  isPdfDialogOpen.value = false
}

onMounted(() => {
  loadOptions()
  loadTransactions()
})
</script>

<template>
  <VContainer
    fluid
    class="negocio-paralelo-container pa-6"
  >
    <!-- Header visual -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-6">
      <div class="d-flex align-center gap-3">
        <VAvatar
          color="success"
          variant="tonal"
          size="50"
          class="elevation-1"
        >
          <VIcon
            icon="ri-store-2-line"
            size="28"
          />
        </VAvatar>
        <div>
          <h3 class="text-h4 font-weight-bold text-high-emphasis mb-1">
            Negocio Paralelo
          </h3>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Control de cuentas rápido y simplificado en base de datos. Registra ingresos y egresos de tu actividad
            comercial independiente.
          </p>
        </div>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn
          variant="tonal"
          color="info"
          prepend-icon="ri-calendar-check-line"
          @click="isSummaryDialogOpen = true"
        >
          Resumen del Día
        </VBtn>
        <VBtn
          variant="outlined"
          color="primary"
          prepend-icon="ri-file-pdf-line"
          @click="openPdfDialog"
        >
          Reporte PDF
        </VBtn>
      </div>
    </div>

    <div class="d-flex justify-space-between align-center mb-6 px-2">
      <div class="text-subtitle-2 font-weight-medium">
        <span class="text-success mr-4">
          <VIcon
            icon="ri-money-dollar-circle-line"
            class="mr-1"
          />Efectivo en Caja: ${{ currentCashBalance.toFixed(2)
          }}
        </span>
        <span class="text-primary">
          <VIcon
            icon="ri-bank-card-line"
            class="mr-1"
          />Transferencia: ${{ currentTransferBalance.toFixed(2) }}
        </span>
      </div>
    </div>

    <!-- Metricas de Saldos y Cuentas -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        sm="4"
      >
        <VCard
          class="rounded-lg elevation-2 border pa-4 h-100 d-flex flex-column justify-center"
          style="border-left: 5px solid rgb(var(--v-theme-success)) !important;"
        >
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
            Total Ingresos
          </div>
          <h3 class="text-h4 font-weight-bold text-success">
            <VSkeletonLoader
              v-if="loading"
              type="text"
              width="120"
              style="margin: 0;"
            />
            <span v-else>${{ totalIncomes.toFixed(2) }}</span>
          </h3>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard
          class="rounded-lg elevation-2 border pa-4 h-100 d-flex flex-column justify-center"
          style="border-left: 5px solid rgb(var(--v-theme-error)) !important;"
        >
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
            Total Egresos
          </div>
          <h3 class="text-h4 font-weight-bold text-error">
            <VSkeletonLoader
              v-if="loading"
              type="text"
              width="120"
              style="margin: 0;"
            />
            <span v-else>${{ totalExpenses.toFixed(2) }}</span>
          </h3>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard
          class="rounded-lg elevation-2 border pa-4 h-100 d-flex flex-column justify-center"
          :style="`border-left: 5px solid ${netBalance >= 0 ? 'rgb(var(--v-theme-success))' : 'rgb(var(--v-theme-error))'} !important;`"
        >
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
            Balance Neto
          </div>
          <h3
            class="text-h4 font-weight-bold"
            :class="[netBalance >= 0 ? 'text-success' : 'text-error']"
          >
            <VSkeletonLoader
              v-if="loading"
              type="text"
              width="120"
              style="margin: 0;"
            />
            <span v-else>{{ netBalance >= 0 ? '' : '-' }}${{ Math.abs(netBalance).toFixed(2) }}</span>
          </h3>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros de Búsqueda -->
    <VCard
      class="mb-6 elevation-2"
      variant="outlined"
      color="rgba(var(--v-border-color), 0.12)"
    >
      <VCardText class="pa-4">
        <VRow
          dense
          align="center"
        >
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="searchQuery"
              label="Buscar por concepto o monto..."
              placeholder="Ej: Fritada, 5.00..."
              clearable
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              prepend-inner-icon="ri-search-2-line"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="typeFilter"
              label="Tipo de Registro"
              :items="[
                { title: 'Todos', value: 'ALL' },
                { title: 'Ingresos (+)', value: 'INCOME' },
                { title: 'Egresos (-)', value: 'EXPENSE' }
              ]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="accountFilter"
              label="Cuenta de Pago"
              :items="[
                { title: 'Todas las Cuentas', value: 'ALL' },
                { title: 'Efectivo', value: 'EFECTIVO' },
                { title: 'Transferencia', value: 'TRANSFERENCIA' }
              ]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Listados de Movimientos (Ingresos y Egresos en Dos Columnas) -->
    <VRow>
      <!-- Columna de Ingresos -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard
          class="elevation-2"
          variant="outlined"
          color="rgba(var(--v-border-color), 0.12)"
        >
          <VCardItem class="bg-success-lighten-5 py-3 border-b">
            <VCardTitle class="d-flex align-center justify-space-between text-success">
              <div class="d-flex align-center gap-2">
                <VIcon icon="ri-add-circle-line" />
                <span class="font-weight-bold">INGRESOS</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VBtn
                  color="success"
                  size="small"
                  variant="flat"
                  prepend-icon="ri-add-circle-line"
                  @click="openIncome"
                >
                  Registrar Ingreso
                </VBtn>
                <VChip
                  color="success"
                  size="small"
                  class="font-weight-bold"
                >
                  <span v-if="loading">...</span>
                  <span v-else>${{ totalIncomes.toFixed(2) }}</span>
                </VChip>
              </div>
            </VCardTitle>
          </VCardItem>
          <VCardText class="pa-0">
            <VTable class="negocio-table">
              <thead>
                <tr>
                  <th class="text-left font-weight-bold">
                    Concepto
                  </th>
                  <th
                    class="text-left font-weight-bold"
                    style="width: 120px;"
                  >
                    Detalle
                  </th>
                  <th
                    class="text-right font-weight-bold"
                    style="width: 130px; color: rgb(var(--v-theme-on-surface));"
                  >
                    Monto
                  </th>
                  <th
                    class="text-center font-weight-bold"
                    style="width: 50px;"
                  />
                </tr>
              </thead>
              <tbody>
                <template v-if="loading">
                  <tr
                    v-for="i in 3"
                    :key="'sk-inc-' + i"
                  >
                    <td
                      colspan="4"
                      class="pa-3"
                    >
                      <VSkeletonLoader type="list-item-two-line" />
                    </td>
                  </tr>
                </template>
                <template v-else>
                  <tr v-if="incomeTransactions.length === 0">
                    <td
                      colspan="4"
                      class="text-center py-6 text-disabled text-caption"
                    >
                      Sin ingresos registrados
                    </td>
                  </tr>
                  <tr
                    v-for="item in incomeTransactions"
                    v-else
                    :key="item.id"
                  >
                    <td>
                      <div
                        class="font-weight-medium text-high-emphasis text-uppercase text-truncate"
                        style="max-width: 200px;"
                      >
                        {{ item.description }}
                      </div>
                    </td>
                    <td class="text-caption text-medium-emphasis">
                      {{ item.quantity }} x ${{ parseFloat(item.unit_cost).toFixed(2) }}
                    </td>
                    <td class="text-right py-2">
                      <div class="text-success text-subtitle-2 font-weight-bold">
                        +${{ parseFloat(item.amount).toFixed(2) }}
                      </div>
                      <div class="mt-1">
                        <small
                          :class="item.account === 'EFECTIVO' ? 'text-warning font-weight-bold' : 'text-primary font-weight-bold'"
                          style="font-size: 0.65rem;"
                        >
                          {{ item.account }}
                        </small>
                      </div>
                    </td>
                    <td
                      class="text-center pa-0"
                      style="white-space: nowrap;"
                    >
                      <VBtn
                        size="x-small"
                        color="primary"
                        variant="text"
                        icon="ri-pencil-line"
                        class="me-1"
                        @click="editTransaction(item)"
                      />
                      <VBtn
                        size="x-small"
                        color="error"
                        variant="text"
                        icon="ri-delete-bin-line"
                        @click="deleteTransaction(item)"
                      />
                    </td>
                  </tr>
                </template>
              </tbody>
            </VTable>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Columna de Egresos -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard
          class="elevation-2"
          variant="outlined"
          color="rgba(var(--v-border-color), 0.12)"
        >
          <VCardItem class="bg-error-lighten-5 py-3 border-b">
            <VCardTitle class="d-flex align-center justify-space-between text-error">
              <div class="d-flex align-center gap-2">
                <VIcon icon="ri-indent-decrease" />
                <span class="font-weight-bold">EGRESOS</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VBtn
                  color="error"
                  size="small"
                  variant="flat"
                  prepend-icon="ri-indent-decrease"
                  @click="openExpense"
                >
                  Registrar Egreso
                </VBtn>
                <VChip
                  color="error"
                  size="small"
                  class="font-weight-bold"
                >
                  <span v-if="loading">...</span>
                  <span v-else>${{ totalExpenses.toFixed(2) }}</span>
                </VChip>
              </div>
            </VCardTitle>
          </VCardItem>
          <VCardText class="pa-0">
            <VTable class="negocio-table">
              <thead>
                <tr>
                  <th class="text-left font-weight-bold">
                    Concepto
                  </th>
                  <th
                    class="text-left font-weight-bold"
                    style="width: 120px;"
                  >
                    Unidad
                  </th>
                  <th
                    class="text-right font-weight-bold"
                    style="width: 130px; color: rgb(var(--v-theme-error));"
                  >
                    Monto
                  </th>
                  <th
                    class="text-center font-weight-bold"
                    style="width: 50px;"
                  />
                </tr>
              </thead>
              <tbody>
                <template v-if="loading">
                  <tr
                    v-for="i in 3"
                    :key="'sk-exp-' + i"
                  >
                    <td
                      colspan="4"
                      class="pa-3"
                    >
                      <VSkeletonLoader type="list-item-two-line" />
                    </td>
                  </tr>
                </template>
                <template v-else>
                  <tr v-if="expenseTransactions.length === 0">
                    <td
                      colspan="4"
                      class="text-center py-6 text-disabled text-caption"
                    >
                      Sin egresos registrados
                    </td>
                  </tr>
                  <tr
                    v-for="item in expenseTransactions"
                    v-else
                    :key="item.id"
                  >
                    <td>
                      <div
                        class="font-weight-medium text-high-emphasis text-uppercase text-truncate"
                        style="max-width: 200px;"
                      >
                        {{ item.description }}
                      </div>
                      <div
                        v-if="item.category"
                        class="text-caption text-disabled text-truncate"
                        style="max-width: 200px; font-size: 0.65rem;"
                      >
                        {{ item.category }}
                      </div>
                    </td>
                    <td class="text-caption text-medium-emphasis">
                      <template v-if="item.unit">
                        {{ item.quantity || 1 }} {{ item.unit }} <br>
                        <span style="font-size: 0.7rem; opacity: 0.8">x ${{ item.unit_cost ?
                          parseFloat(item.unit_cost).toFixed(2) : (parseFloat(item.amount) / (item.quantity ||
                            1)).toFixed(2) }} c/u</span>
                      </template>
                      <template v-else-if="item.quantity > 1">
                        {{ item.quantity }} <br>
                        <span style="font-size: 0.7rem; opacity: 0.8">x ${{ item.unit_cost ?
                          parseFloat(item.unit_cost).toFixed(2) : (parseFloat(item.amount) / (item.quantity ||
                            1)).toFixed(2) }} c/u</span>
                      </template>
                      <template v-else>
                        -
                      </template>
                    </td>
                    <td class="text-right py-2">
                      <div class="text-error text-subtitle-2 font-weight-bold">
                        -${{ parseFloat(item.amount).toFixed(2) }}
                      </div>
                      <div class="mt-1">
                        <small
                          :class="item.account === 'EFECTIVO' ? 'text-warning font-weight-bold' : 'text-primary font-weight-bold'"
                          style="font-size: 0.65rem;"
                        >
                          {{ item.account }}
                        </small>
                      </div>
                    </td>
                    <td
                      class="text-center pa-0"
                      style="white-space: nowrap;"
                    >
                      <VBtn
                        size="x-small"
                        color="primary"
                        variant="text"
                        icon="ri-pencil-line"
                        class="me-1"
                        @click="editTransaction(item)"
                      />
                      <VBtn
                        size="x-small"
                        color="error"
                        variant="text"
                        icon="ri-delete-bin-line"
                        @click="deleteTransaction(item)"
                      />
                    </td>
                  </tr>
                </template>
              </tbody>
            </VTable>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Dialogo de Registrar Ingresos -->
    <VDialog
      v-model="isIncomeDialogOpen"
      max-width="500"
      scrollable
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isIncomeDialogOpen = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-add-circle-line" />
          </div>
          <h3 class="custom-dialog-title">
            {{ isEditing ? 'Editar Ingreso' : 'Registrar Ingreso' }}
          </h3>
          <p class="custom-dialog-subtitle">
            Gestión de ingresos para la caja de negocio independiente
          </p>
        </div>

        <VCardText
          class="pa-5"
          style="max-height: 65vh;"
        >
          <VForm
            ref="incomeFormRef"
            @submit.prevent="saveIncome"
          >
            <VRow dense>
              <VCol
                cols="12"
                class="pb-3"
              >
                <VCombobox
                  v-model="incomeProductSelect"
                  label="Concepto / Producto *"
                  placeholder="Seleccione o escriba un producto"
                  :items="incomeProductList"
                  variant="outlined"
                  :rules="[rules.required]"
                  clearable
                  @update:model-value="onIncomeProductChange"
                />
              </VCol>

              <VCol
                cols="6"
                class="pb-3"
              >
                <VTextField
                  v-model.number="incomeForm.quantity"
                  label="Cantidad *"
                  type="number"
                  min="1"
                  variant="outlined"
                  :rules="[rules.required, rules.positive, rules.number]"
                />
              </VCol>

              <VCol
                cols="6"
                class="pb-3"
              >
                <VTextField
                  v-model.number="incomeForm.unitCost"
                  label="Precio Unitario ($) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  variant="outlined"
                  prefix="$"
                  :rules="[rules.required, rules.positive, rules.number]"
                />
              </VCol>

              <VCol
                cols="12"
                class="pb-3"
              >
                <VSelect
                  v-model="incomeForm.account"
                  label="Cuenta de Destino *"
                  :items="['EFECTIVO', 'TRANSFERENCIA']"
                  variant="outlined"
                  :rules="[rules.required]"
                />
              </VCol>

              <VCol
                cols="12"
                class="pb-1"
              >
                <VSwitch
                  v-model="showIncomeDatePicker"
                  label="Editar fecha del registro"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </VCol>

              <VCol
                v-if="showIncomeDatePicker"
                cols="12"
                class="pb-3"
              >
                <VTextField
                  v-model="incomeForm.date"
                  label="Fecha de Registro *"
                  type="date"
                  variant="outlined"
                  :rules="[rules.required]"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="isIncomeDialogOpen = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="success"
            variant="elevated"
            prepend-icon="ri-save-3-line"
            class="rounded-lg px-6 font-weight-bold"
            height="40"
            @click="saveIncome"
          >
            {{ isEditing ? 'Actualizar Ingreso' : 'Guardar Ingreso' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Dialogo de Registrar Egresos -->
    <VDialog
      v-model="isExpenseDialogOpen"
      max-width="500"
      scrollable
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isExpenseDialogOpen = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-indent-decrease" />
          </div>
          <h3 class="custom-dialog-title">
            {{ isEditing ? 'Editar Egreso' : 'Registrar Egreso' }}
          </h3>
          <p class="custom-dialog-subtitle">
            Gestión de egresos para la caja de negocio independiente
          </p>
        </div>

        <VCardText
          class="pa-5"
          style="max-height: 60vh;"
        >
          <VForm
            ref="expenseFormRef"
            @submit.prevent="saveExpense"
          >
            <VRow dense>
              <VCol
                cols="12"
                class="pb-3"
              >
                <VCombobox
                  v-model="expenseForm.category"
                  label="Categoría de Egreso *"
                  :items="expenseCategories"
                  variant="outlined"
                  clearable
                  placeholder="Seleccione o escriba una categoría"
                  :rules="[rules.required]"
                />
              </VCol>

              <VCol
                cols="12"
                class="pb-3"
              >
                <VTextField
                  v-model="expenseForm.description"
                  label="Concepto / Gasto *"
                  placeholder="Ej: Gasto ingredientes o pago"
                  variant="outlined"
                  :rules="[rules.required]"
                />
              </VCol>

              <VCol
                cols="6"
                class="pb-3"
              >
                <VTextField
                  v-model.number="expenseForm.unitCost"
                  label="Costo Unitario ($) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  variant="outlined"
                  prefix="$"
                  :rules="[rules.required, rules.positive, rules.number]"
                />
              </VCol>

              <VCol
                cols="6"
                class="pb-3"
              >
                <VTextField
                  v-model.number="expenseForm.quantity"
                  label="Cantidad de compra *"
                  type="number"
                  min="1"
                  variant="outlined"
                  :rules="[rules.required, rules.positive, rules.number]"
                />
              </VCol>

              <VCol
                cols="12"
                class="pb-3"
              >
                <VCombobox
                  v-model="expenseForm.unit"
                  label="Unidad de medida *"
                  :items="expenseUnits"
                  variant="outlined"
                  placeholder="Seleccione o escriba la unidad"
                  :rules="[rules.required]"
                />
              </VCol>

              <VCol
                cols="12"
                class="pb-3"
              >
                <VSelect
                  v-model="expenseForm.account"
                  label="Cuenta de Pago *"
                  :items="['EFECTIVO', 'TRANSFERENCIA']"
                  variant="outlined"
                  :rules="[rules.required]"
                />
              </VCol>

              <VCol
                cols="12"
                class="pb-1"
              >
                <VSwitch
                  v-model="showExpenseDatePicker"
                  label="Editar fecha del registro"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </VCol>

              <VCol
                v-if="showExpenseDatePicker"
                cols="12"
                class="pb-3"
              >
                <VTextField
                  v-model="expenseForm.date"
                  label="Fecha de Registro *"
                  type="date"
                  variant="outlined"
                  :rules="[rules.required]"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="isExpenseDialogOpen = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            prepend-icon="ri-save-3-line"
            class="rounded-lg px-6 font-weight-bold"
            height="40"
            @click="saveExpense"
          >
            {{ isEditing ? 'Actualizar Egreso' : 'Guardar Egreso' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Dialogo de Resumen del Día -->
    <VDialog
      v-model="isSummaryDialogOpen"
      max-width="600"
      scrollable
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isSummaryDialogOpen = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-calendar-check-line" />
          </div>
          <h3 class="custom-dialog-title">
            Resumen Consolidado del Día
          </h3>
          <p class="custom-dialog-subtitle">
            Desglose de balance y movimientos financieros del día
          </p>
        </div>

        <VCardText
          class="pa-5"
          style="max-height: 65vh;"
        >
          <VRow class="mb-4">
            <VCol cols="12">
              <VTextField
                v-model="summaryDate"
                label="Consultar Fecha"
                type="date"
                variant="outlined"
                hide-details
              />
            </VCol>
          </VRow>

          <VRow
            dense
            class="mb-4 text-center"
          >
            <VCol
              cols="12"
              sm="4"
            >
              <div class="text-caption text-medium-emphasis">
                Ingresos Totales
              </div>
              <div class="text-h6 text-success font-weight-bold">
                +${{ summaryTotalIncome.toFixed(2) }}
              </div>
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <div class="text-caption text-medium-emphasis">
                Egresos Totales
              </div>
              <div class="text-h6 text-error font-weight-bold">
                -${{ summaryTotalExpense.toFixed(2) }}
              </div>
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <div class="text-caption text-medium-emphasis">
                Balance Neto
              </div>
              <div
                class="text-h6 font-weight-bold"
                :class="[summaryNetBalance >= 0 ? 'text-success' : 'text-error']"
              >
                {{ summaryNetBalance >= 0 ? '' : '-' }}${{ Math.abs(summaryNetBalance).toFixed(2) }}
              </div>
            </VCol>
          </VRow>

          <VRow
            dense
            class="mb-4 bg-background rounded-lg pa-3"
            style="background-color: rgba(var(--v-theme-on-surface), 0.04);"
          >
            <VCol
              cols="6"
              class="text-center border-e"
            >
              <VIcon
                icon="ri-money-dollar-circle-line"
                color="success"
                class="mb-1"
              />
              <div class="text-caption">
                Efectivo
              </div>
              <div class="text-subtitle-2 font-weight-bold">
                ${{ summaryCash.toFixed(2) }}
              </div>
            </VCol>
            <VCol
              cols="6"
              class="text-center"
            >
              <VIcon
                icon="ri-bank-card-line"
                color="primary"
                class="mb-1"
              />
              <div class="text-caption">
                Transferencias
              </div>
              <div class="text-subtitle-2 font-weight-bold">
                ${{ summaryTransfer.toFixed(2) }}
              </div>
            </VCol>
          </VRow>

          <div class="text-subtitle-1 font-weight-bold mb-2">
            Desglose de Ventas
          </div>
          <VTable
            density="compact"
            class="border rounded-lg"
            style="background: transparent;"
          >
            <thead>
              <tr>
                <th class="text-left font-weight-bold">
                  Producto
                </th>
                <th class="text-center font-weight-bold">
                  Cant.
                </th>
                <th class="text-right font-weight-bold">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="summaryIncomesGrouped.length === 0">
                <td
                  colspan="3"
                  class="text-center py-4 text-disabled"
                >
                  No hay ventas registradas
                </td>
              </tr>
              <tr
                v-for="(item, index) in summaryIncomesGrouped"
                :key="index"
              >
                <td>
                  <div class="font-weight-medium">
                    {{ item.description }}
                  </div>
                  <div
                    v-if="item.unit_cost"
                    class="text-caption text-disabled"
                  >
                    x ${{ item.unit_cost.toFixed(2) }}
                  </div>
                </td>
                <td class="text-center">
                  {{ item.total_quantity }}
                </td>
                <td class="text-right text-success font-weight-bold">
                  ${{ item.total_amount.toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>

        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
          <VBtn
            color="secondary"
            variant="outlined"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="isSummaryDialogOpen = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Dialogo de Generar Reporte PDF -->
    <VDialog
      v-model="isPdfDialogOpen"
      max-width="450"
      scrollable
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isPdfDialogOpen = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-file-pdf-line" />
          </div>
          <h3 class="custom-dialog-title">
            Reporte PDF
          </h3>
          <p class="custom-dialog-subtitle">
            Exporta el reporte detallado de operaciones
          </p>
        </div>

        <VCardText
          class="pa-5"
          style="max-height: 60vh;"
        >
          <VRow dense>
            <VCol
              cols="12"
              class="pb-3"
            >
              <VSelect
                v-model="pdfRange"
                :items="[
                  { title: 'Día de Hoy', value: 'today' },
                  { title: 'Esta Semana', value: 'week' },
                  { title: 'Este Mes', value: 'month' },
                  { title: 'Rango Personalizado', value: 'custom' }
                ]"
                label="Período de Reporte *"
                variant="outlined"
              />
            </VCol>

            <VCol
              v-if="pdfRange === 'custom'"
              cols="6"
              class="pb-3"
            >
              <VTextField
                v-model="pdfStartDate"
                label="Fecha Inicio *"
                type="date"
                variant="outlined"
              />
            </VCol>

            <VCol
              v-if="pdfRange === 'custom'"
              cols="6"
              class="pb-3"
            >
              <VTextField
                v-model="pdfEndDate"
                label="Fecha Fin *"
                type="date"
                variant="outlined"
              />
            </VCol>

            <VCol
              cols="12"
              class="pb-3"
            >
              <VSelect
                v-model="pdfAccount"
                :items="[
                  { title: 'Todas las Cuentas', value: 'ALL' },
                  { title: 'Efectivo', value: 'EFECTIVO' },
                  { title: 'Transferencia', value: 'TRANSFERENCIA' }
                ]"
                label="Filtrar por Cuenta"
                variant="outlined"
              />
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="isPdfDialogOpen = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            prepend-icon="ri-download-line"
            class="rounded-lg px-6 font-weight-bold"
            height="40"
            @click="generatePdfReport"
          >
            Generar Reporte
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VContainer>
</template>

<style lang="scss" scoped>
.negocio-paralelo-container {
  max-width: 1280px;
  margin: 0 auto;
}

.negocio-table {
  background: transparent !important;
  width: 100% !important;
}

.gap-2 {
  gap: 8px;
}

.gap-3 {
  gap: 12px;
}

.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12) !important;
}
</style>
