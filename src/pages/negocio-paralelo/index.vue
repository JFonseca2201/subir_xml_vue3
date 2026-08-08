<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

// Data State
const transactions = ref([])
const loading = ref(false)

// Initial mock balances (burned data that can be adjusted)
const initialCash = ref(150.00)
const initialTransfer = ref(300.00)

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
  date: new Date().toISOString().substr(0, 10),
})

const expenseForm = ref({
  description: '',
  cost: null,
  unit: 'Unidades',
  account: 'EFECTIVO',
  date: new Date().toISOString().substr(0, 10),
})

// Rules
const rules = {
  required: v => !!v || 'Este campo es obligatorio',
  positive: v => (v && parseFloat(v) > 0) || 'Debe ser un valor positivo',
  number: v => !isNaN(parseFloat(v)) || 'Debe ser un número válido',
}

// Load transactions from backend API
const loadTransactions = async () => {
  loading.value = true
  try {
    const params = {}
    if (searchQuery.value && searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }
    if (typeFilter.value !== 'ALL') {
      params.type = typeFilter.value.toLowerCase()
    }
    if (accountFilter.value !== 'ALL') {
      params.account = accountFilter.value
    }
    const resp = await $api('parallel-transactions', { params })
    transactions.value = resp || []
  } catch (err) {
    console.error('Error al cargar transacciones:', err)
    showNotification('Error al cargar transacciones desde la base de datos', 'error')
  } finally {
    loading.value = false
  }
}

// Watch filters to reload transactions
watch([searchQuery, typeFilter, accountFilter], () => {
  loadTransactions()
})

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

const filteredTransactions = computed(() => transactions.value)

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
  incomeForm.value = {
    description: '',
    quantity: 1,
    unitCost: null,
    account: 'EFECTIVO',
    date: new Date().toISOString().substr(0, 10),
  }
  isIncomeDialogOpen.value = true
}

const saveIncome = async () => {
  const { valid } = await incomeFormRef.value.validate()
  if (!valid) return

  try {
    const endpoint = isEditing.value ? `parallel-transactions/${editingId.value}` : 'parallel-transactions'
    const method = isEditing.value ? 'PUT' : 'POST'

    const response = await $api(endpoint, {
      method,
      body: {
        type: 'income',
        description: incomeForm.value.description,
        quantity: incomeForm.value.quantity,
        unit_cost: incomeForm.value.unitCost,
        account: incomeForm.value.account,
        date: incomeForm.value.date
      }
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
    cost: null,
    unit: 'Unidades',
    account: 'EFECTIVO',
    date: new Date().toISOString().substr(0, 10),
  }
  isExpenseDialogOpen.value = true
}

const saveExpense = async () => {
  const { valid } = await expenseFormRef.value.validate()
  if (!valid) return

  try {
    const endpoint = isEditing.value ? `parallel-transactions/${editingId.value}` : 'parallel-transactions'
    const method = isEditing.value ? 'PUT' : 'POST'

    const response = await $api(endpoint, {
      method,
      body: {
        type: 'expense',
        description: expenseForm.value.description,
        cost: expenseForm.value.cost,
        unit: expenseForm.value.unit,
        account: expenseForm.value.account,
        date: expenseForm.value.date
      }
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
const editTransaction = (item) => {
  isEditing.value = true
  editingId.value = item.id

  if (item.type === 'income') {
    incomeForm.value = {
      description: item.description,
      quantity: item.quantity,
      unitCost: item.unit_cost,
      account: item.account,
      date: item.date,
    }
    isIncomeDialogOpen.value = true
  } else {
    expenseForm.value = {
      description: item.description,
      cost: item.amount,
      unit: item.unit || '',
      account: item.account,
      date: item.date,
    }
    isExpenseDialogOpen.value = true
  }
}

// Delete Transaction
const deleteTransaction = async (item) => {
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
        method: 'DELETE'
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

// Reset initial balances (optional capability to adjust initial values)
const editInitialBalances = async () => {
  const { value: formValues } = await Swal.fire({
    title: 'Establecer Saldos Iniciales',
    html:
      `<div class="d-flex flex-column gap-3 pa-2" style="font-family: inherit;">` +
      `<label class="text-left font-weight-bold text-caption mb-1">SALDO INICIAL EFECTIVO ($):</label>` +
      `<input id="swal-input-cash" type="number" step="0.01" class="swal2-input m-0 w-100" value="${initialCash.value}">` +
      `<label class="text-left font-weight-bold text-caption mt-2 mb-1">SALDO INICIAL TRANSFERENCIA ($):</label>` +
      `<input id="swal-input-transfer" type="number" step="0.01" class="swal2-input m-0 w-100" value="${initialTransfer.value}">` +
      `</div>`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Actualizar Saldos',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const cash = parseFloat(document.getElementById('swal-input-cash').value) || 0
      const transfer = parseFloat(document.getElementById('swal-input-transfer').value) || 0
      return { cash, transfer }
    }
  })

  if (formValues) {
    initialCash.value = formValues.cash
    initialTransfer.value = formValues.transfer
    showNotification('Saldos iniciales actualizados correctamente', 'success')
  }
}

onMounted(() => {
  loadTransactions()
})
</script>

<template>
  <VContainer fluid class="negocio-paralelo-container pa-6">
    <!-- Header visual -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-6">
      <div class="d-flex align-center gap-3">
        <VAvatar color="success" variant="tonal" size="50" class="elevation-1">
          <VIcon icon="ri-store-2-line" size="28" />
        </VAvatar>
        <div>
          <h3 class="text-h4 font-weight-bold text-high-emphasis mb-1">
            Negocio Paralelo
          </h3>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Control de cuentas rápido y simplificado en base de datos. Registra ingresos y egresos de tu actividad comercial independiente.
          </p>
        </div>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn variant="outlined" color="primary" prepend-icon="ri-file-pdf-line" @click="openPdfDialog">
          Reporte PDF
        </VBtn>
        <VBtn variant="outlined" color="secondary" prepend-icon="ri-settings-4-line" @click="editInitialBalances">
          Saldos Iniciales
        </VBtn>
        <VBtn color="success" prepend-icon="ri-add-circle-line" @click="openIncome">
          Registrar Ingreso
        </VBtn>
        <VBtn color="error" prepend-icon="ri-indent-decrease" @click="openExpense">
          Registrar Egreso
        </VBtn>
      </div>
    </div>

    <!-- Metricas de Saldos y Cuentas -->
    <VRow class="mb-6">
      <VCol cols="12" sm="6">
        <VCard class="rounded-lg elevation-2 border pa-4 h-100 d-flex flex-column justify-center"
          style="border-left: 5px solid rgb(var(--v-theme-success)) !important;">
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">Total Ingresos</div>
          <h3 class="text-h4 font-weight-bold text-success">
            ${{ totalIncomes.toFixed(2) }}
          </h3>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6">
        <VCard class="rounded-lg elevation-2 border pa-4 h-100 d-flex flex-column justify-center"
          style="border-left: 5px solid rgb(var(--v-theme-error)) !important;">
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">Total Egresos</div>
          <h3 class="text-h4 font-weight-bold text-error">
            ${{ totalExpenses.toFixed(2) }}
          </h3>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros de Búsqueda -->
    <VCard class="mb-6 elevation-2" variant="outlined" color="rgba(var(--v-border-color), 0.12)">
      <VCardText class="pa-4">
        <VRow dense align="center">
          <VCol cols="12" md="6">
            <VTextField v-model="searchQuery" label="Buscar por concepto..." placeholder="Ej: Fritada, ingredientes..."
              clearable variant="outlined" density="comfortable" hide-details="auto"
              prepend-inner-icon="ri-search-2-line" />
          </VCol>
          <VCol cols="12" sm="6" md="3">
            <VSelect v-model="typeFilter" label="Tipo de Registro" :items="[
              { title: 'Todos', value: 'ALL' },
              { title: 'Ingresos (+)', value: 'INCOME' },
              { title: 'Egresos (-)', value: 'EXPENSE' }
            ]" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details="auto" />
          </VCol>
          <VCol cols="12" sm="6" md="3">
            <VSelect v-model="accountFilter" label="Cuenta de Pago" :items="[
              { title: 'Todas las Cuentas', value: 'ALL' },
              { title: 'Efectivo', value: 'EFECTIVO' },
              { title: 'Transferencia', value: 'TRANSFERENCIA' }
            ]" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details="auto" />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Listados de Movimientos (Ingresos y Egresos en Dos Columnas) -->
    <VRow>
      <!-- Columna de Ingresos -->
      <VCol cols="12" md="6">
        <VCard class="elevation-2" variant="outlined" color="rgba(var(--v-border-color), 0.12)">
          <VCardItem class="bg-success-lighten-5 py-3 border-b">
            <VCardTitle class="d-flex align-center justify-space-between text-success">
              <div class="d-flex align-center gap-2">
                <VIcon icon="ri-add-circle-line" />
                <span class="font-weight-bold">INGRESOS</span>
              </div>
              <VChip color="success" size="small" class="font-weight-bold">
                ${{ totalIncomes.toFixed(2) }}
              </VChip>
            </VCardTitle>
          </VCardItem>
          <VCardText class="pa-0">
            <VTable class="negocio-table">
              <thead>
                <tr>
                  <th class="text-left font-weight-bold">Concepto</th>
                  <th class="text-left font-weight-bold" style="width: 120px;">Detalle</th>
                  <th class="text-right font-weight-bold" style="width: 130px; color: rgb(var(--v-theme-success));">Monto</th>
                  <th class="text-center font-weight-bold" style="width: 50px;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="incomeTransactions.length === 0">
                  <td colspan="4" class="text-center py-6 text-disabled text-caption">
                    Sin ingresos registrados
                  </td>
                </tr>
                <tr v-else v-for="item in incomeTransactions" :key="item.id">
                  <td>
                    <div class="font-weight-medium text-high-emphasis text-uppercase text-truncate" style="max-width: 200px;">
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
                    <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase mt-1" style="font-size: 0.65rem; letter-spacing: 0.3px;">
                      {{ item.account }}
                    </div>
                  </td>
                  <td class="text-center pa-0" style="white-space: nowrap;">
                    <VBtn size="x-small" color="primary" variant="text" icon="ri-pencil-line" class="me-1" @click="editTransaction(item)" />
                    <VBtn size="x-small" color="error" variant="text" icon="ri-delete-bin-line" @click="deleteTransaction(item)" />
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Columna de Egresos -->
      <VCol cols="12" md="6">
        <VCard class="elevation-2" variant="outlined" color="rgba(var(--v-border-color), 0.12)">
          <VCardItem class="bg-error-lighten-5 py-3 border-b">
            <VCardTitle class="d-flex align-center justify-space-between text-error">
              <div class="d-flex align-center gap-2">
                <VIcon icon="ri-indent-decrease" />
                <span class="font-weight-bold">EGRESOS</span>
              </div>
              <VChip color="error" size="small" class="font-weight-bold">
                ${{ totalExpenses.toFixed(2) }}
              </VChip>
            </VCardTitle>
          </VCardItem>
          <VCardText class="pa-0">
            <VTable class="negocio-table">
              <thead>
                <tr>
                  <th class="text-left font-weight-bold">Concepto</th>
                  <th class="text-left font-weight-bold" style="width: 120px;">Unidad</th>
                  <th class="text-right font-weight-bold" style="width: 130px; color: rgb(var(--v-theme-error));">Monto</th>
                  <th class="text-center font-weight-bold" style="width: 50px;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="expenseTransactions.length === 0">
                  <td colspan="4" class="text-center py-6 text-disabled text-caption">
                    Sin egresos registrados
                  </td>
                </tr>
                <tr v-else v-for="item in expenseTransactions" :key="item.id">
                  <td>
                    <div class="font-weight-medium text-high-emphasis text-uppercase text-truncate" style="max-width: 200px;">
                      {{ item.description }}
                    </div>
                  </td>
                  <td class="text-caption text-medium-emphasis">
                    {{ item.unit || 'Sin unidad' }}
                  </td>
                  <td class="text-right py-2">
                    <div class="text-error text-subtitle-2 font-weight-bold">
                      -${{ parseFloat(item.amount).toFixed(2) }}
                    </div>
                    <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase mt-1" style="font-size: 0.65rem; letter-spacing: 0.3px;">
                      {{ item.account }}
                    </div>
                  </td>
                  <td class="text-center pa-0" style="white-space: nowrap;">
                    <VBtn size="x-small" color="primary" variant="text" icon="ri-pencil-line" class="me-1" @click="editTransaction(item)" />
                    <VBtn size="x-small" color="error" variant="text" icon="ri-delete-bin-line" @click="deleteTransaction(item)" />
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Dialogo de Registrar Ingresos -->
    <VDialog v-model="isIncomeDialogOpen" max-width="500" scrollable>
      <VCard class="rounded-xl">
        <VCardTitle class="d-flex align-center justify-space-between pa-5 border-b">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-add-circle-line" color="success" />
            <span class="text-h5 font-weight-bold">{{ isEditing ? 'Editar Ingreso' : 'Registrar Ingreso' }}</span>
          </div>
          <DialogCloseBtn variant="text" @click="isIncomeDialogOpen = false" />
        </VCardTitle>

        <VCardText class="pa-5" style="max-height: 60vh;">
          <VForm ref="incomeFormRef" @submit.prevent="saveIncome">
            <VRow dense>
              <VCol cols="12" class="pb-3">
                <VTextField v-model="incomeForm.description" label="Concepto / Detalle de Venta *"
                  placeholder="Ej: Venta de Fritada Mediana" variant="outlined" :rules="[rules.required]" />
              </VCol>

              <VCol cols="6" class="pb-3">
                <VTextField v-model.number="incomeForm.quantity" label="Cantidad *" type="number" min="1"
                  variant="outlined" :rules="[rules.required, rules.positive, rules.number]" />
              </VCol>

              <VCol cols="6" class="pb-3">
                <VTextField v-model.number="incomeForm.unitCost" label="Precio Unitario ($) *" type="number" step="0.01"
                  min="0.01" variant="outlined" prefix="$" :rules="[rules.required, rules.positive, rules.number]" />
              </VCol>

              <VCol cols="12" class="pb-3">
                <VSelect v-model="incomeForm.account" label="Cuenta de Destino *" :items="['EFECTIVO', 'TRANSFERENCIA']"
                  variant="outlined" :rules="[rules.required]" />
              </VCol>

              <VCol cols="12" class="pb-3">
                <VTextField v-model="incomeForm.date" label="Fecha de Registro *" type="date" variant="outlined"
                  :rules="[rules.required]" />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end gap-2">
          <VBtn variant="outlined" color="secondary" class="rounded-lg" @click="isIncomeDialogOpen = false">
            Cancelar
          </VBtn>
          <VBtn color="success" class="rounded-lg px-4" @click="saveIncome">
            Guardar Ingreso
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Dialogo de Registrar Egresos -->
    <VDialog v-model="isExpenseDialogOpen" max-width="500" scrollable>
      <VCard class="rounded-xl">
        <VCardTitle class="d-flex align-center justify-space-between pa-5 border-b">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-indent-decrease" color="error" />
            <span class="text-h5 font-weight-bold">{{ isEditing ? 'Editar Egreso' : 'Registrar Egreso' }}</span>
          </div>
          <DialogCloseBtn variant="text" @click="isExpenseDialogOpen = false" />
        </VCardTitle>

        <VCardText class="pa-5" style="max-height: 60vh;">
          <VForm ref="expenseFormRef" @submit.prevent="saveExpense">
            <VRow dense>
              <VCol cols="12" class="pb-3">
                <VTextField v-model="expenseForm.description" label="Concepto / Gasto *"
                  placeholder="Ej: Gasto ingredientes o insumos" variant="outlined" :rules="[rules.required]" />
              </VCol>

              <VCol cols="6" class="pb-3">
                <VTextField v-model.number="expenseForm.cost" label="Costo Total ($) *" type="number" step="0.01"
                  min="0.01" variant="outlined" prefix="$" :rules="[rules.required, rules.positive, rules.number]" />
              </VCol>

              <VCol cols="6" class="pb-3">
                <VTextField v-model="expenseForm.unit" label="Cantidad/Unidad de compra *"
                  placeholder="Ej: 10 kg, 3 litros" variant="outlined" :rules="[rules.required]" />
              </VCol>

              <VCol cols="12" class="pb-3">
                <VSelect v-model="expenseForm.account" label="Cuenta de Pago *" :items="['EFECTIVO', 'TRANSFERENCIA']"
                  variant="outlined" :rules="[rules.required]" />
              </VCol>

              <VCol cols="12" class="pb-3">
                <VTextField v-model="expenseForm.date" label="Fecha de Registro *" type="date" variant="outlined"
                  :rules="[rules.required]" />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end gap-2">
          <VBtn variant="outlined" color="secondary" class="rounded-lg" @click="isExpenseDialogOpen = false">
            Cancelar
          </VBtn>
          <VBtn color="error" class="rounded-lg px-4" @click="saveExpense">
            Guardar Egreso
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Dialogo de Generar Reporte PDF -->
    <VDialog v-model="isPdfDialogOpen" max-width="450" scrollable>
      <VCard class="rounded-xl">
        <VCardTitle class="d-flex align-center justify-space-between pa-5 border-b">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-file-pdf-line" color="primary" />
            <span class="text-h5 font-weight-bold">Reporte PDF</span>
          </div>
          <DialogCloseBtn variant="text" @click="isPdfDialogOpen = false" />
        </VCardTitle>

        <VCardText class="pa-5" style="max-height: 60vh;">
          <VRow dense>
            <VCol cols="12" class="pb-3">
              <VSelect v-model="pdfRange" :items="[
                { title: 'Día de Hoy', value: 'today' },
                { title: 'Esta Semana', value: 'week' },
                { title: 'Este Mes', value: 'month' },
                { title: 'Rango Personalizado', value: 'custom' }
              ]" label="Período de Reporte *" variant="outlined" />
            </VCol>

            <VCol v-if="pdfRange === 'custom'" cols="6" class="pb-3">
              <VTextField v-model="pdfStartDate" label="Fecha Inicio *" type="date" variant="outlined" />
            </VCol>
            
            <VCol v-if="pdfRange === 'custom'" cols="6" class="pb-3">
              <VTextField v-model="pdfEndDate" label="Fecha Fin *" type="date" variant="outlined" />
            </VCol>

            <VCol cols="12" class="pb-3">
              <VSelect v-model="pdfAccount" :items="[
                { title: 'Todas las Cuentas', value: 'ALL' },
                { title: 'Efectivo', value: 'EFECTIVO' },
                { title: 'Transferencia', value: 'TRANSFERENCIA' }
              ]" label="Filtrar por Cuenta" variant="outlined" />
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end gap-2">
          <VBtn variant="outlined" color="secondary" class="rounded-lg" @click="isPdfDialogOpen = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" class="rounded-lg px-4" @click="generatePdfReport" prepend-icon="ri-download-line">
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
