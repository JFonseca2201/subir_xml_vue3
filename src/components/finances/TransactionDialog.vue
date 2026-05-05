<template>
  <VDialog v-model="dialog" max-width="650" persistent scrollable>
    <VCard class="transaction-dialog">
      <!-- Header -->
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-2">
            <VIcon :icon="getTransactionIcon(form.type || props.transactionType)" color="primary" size="24" />
            <div>
              <h3 class="text-h6 font-weight-medium">
                Nuevo {{ getTransactionTypeName() }}
              </h3>
              <span class="text-medium-emphasis text-caption">
                Registrar {{ getTransactionTypeName().toLowerCase() }} 
              </span>
            </div>
          </div>
          <VBtn icon="ri-close-line" variant="text" size="small" @click="closeDialog" />
        </div>
      </VCardTitle>

      <VDivider />

      <!-- Formulario -->
      <VCardText class="pa-4">
        <VForm ref="formRef" @submit.prevent="handleSubmit">
          <VRow dense>
            <!-- Select de Cuenta -->
            <VCol cols="12">
              <VSelect v-model="form.account_id" :items="groupedAccounts" label="Cuenta"
                placeholder="Seleccione una cuenta" :rules="[v => !!v || 'La cuenta es requerida']"
                :loading="loadingAccounts" :disabled="loading" prepend-inner-icon="ri-bank-line" variant="outlined"
                density="comfortable" hint="Cuenta desde donde se realizará el movimiento" persistent-hint
                item-title="name" item-value="id">
                <template #item="{ item, props }">
                  <VListItem v-bind="props" class="account-select-item">
                    <VListItemSubtitle>
                      Saldo: ${{ formatCurrency(item.raw.current_balance) }}
                    </VListItemSubtitle>
                  </VListItem>
                </template>
                <template #selection="{ item }">
                  <div class="d-flex align-center">
                    <span class="font-weight-medium">{{ item.name }}</span>
                    <span class="text-medium-emphasis ms-2">
                      Saldo: ${{ formatCurrency(item.raw.current_balance) }}
                    </span>
                  </div>
                </template>
              </VSelect>
            </VCol>

            <!-- Select de Tipo -->
            <VCol v-if="!props.transactionType" cols="12" md="6">
              <VSelect v-model="form.type" :items="transactionTypes" item-title="label" item-value="value"
                label="Tipo de Movimiento" placeholder="Seleccione el tipo"
                :rules="[v => !!v || 'El tipo es requerido']" :disabled="loading" prepend-inner-icon="ri-exchange-line"
                variant="outlined" density="comfortable" hint="Tipo de transacción a realizar" persistent-hint>
                <template #item="{ item, props }">
                  <VListItem v-bind="props">
                    <template #prepend>
                      <i :class="getTransactionIcon(item.raw.value)" class="me-3"></i>
                    </template>
                    <VListItemTitle>{{ item.raw.label }}</VListItemTitle>
                  </VListItem>
                </template>
              </VSelect>
            </VCol>
            <VCol v-else cols="12" md="6">
              <VTextField :model-value="getTransactionTypeName()" label="Tipo de Movimiento" readonly variant="outlined"
                density="comfortable" prepend-inner-icon="getTransactionIcon(props.transactionType)"
                hint="Tipo predefinido para este movimiento" persistent-hint />
            </VCol>

            <!-- Campo Amount -->
            <VCol cols="12" md="6">
              <VTextField v-model="form.amount" label="Monto" type="number" step="0.01" min="0.01" prefix="$"
                placeholder="0.00" :rules="[
                  v => !!v || 'El monto es requerido',
                  v => v > 0 || 'El monto debe ser mayor a 0'
                ]" :disabled="loading" prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined"
                density="comfortable" hint="Cantidad monetaria del movimiento" persistent-hint />
            </VCol>

            <!-- Campo Description -->
            <VCol cols="12">
              <VTextarea v-model="form.description" label="Descripción"
                placeholder="Ingrese una descripción detallada del movimiento"
                :rules="[v => !!v || 'La descripción es requerida']" :disabled="loading" rows="3"
                prepend-inner-icon="ri-file-text-line" variant="outlined" density="comfortable" counter="255"
                hint="Detalles adicionales sobre la transacción" persistent-hint />
            </VCol>
          </VRow>

          <!-- Campos Dinámicos por Tipo -->
          <div v-if="form.type && form.type !== 3" class="mt-4">
            <!-- Ingreso -->
            <div v-if="form.type === 1" class="income-section">
              <VRow dense>
                <VCol cols="12">
                  <VSelect v-model="form.income_type" :items="incomeTypes" item-title="label" item-value="value"
                    label="Tipo de Ingreso" placeholder="Seleccione el tipo de ingreso"
                    :rules="[v => !!v || 'El tipo de ingreso es requerido']" :disabled="loading"
                    prepend-inner-icon="ri-funds-line" variant="outlined" density="compact"
                    hint="Seleccione si es por orden de trabajo o aporte de capital" persistent-hint />
                </VCol>
                
                <!-- Capital -->
                <VCol v-if="form.income_type === 'capital'" cols="12">
                  <VSelect v-model="form.partner_id" :items="partners" item-title="name" item-value="id"
                    label="Socio" placeholder="Seleccione el socio"
                    :rules="[v => !!v || 'El socio es requerido para aporte de capital']" :disabled="loading"
                    prepend-inner-icon="ri-group-line" variant="outlined" density="compact"
                    hint="Socio que realiza el aporte" persistent-hint />
                </VCol>
                
                <!-- Work Order -->
                <VCol v-if="form.income_type === 'work_order'" cols="12">
                  <div class="work-order-field">
                    <VTextField v-if="workOrders.length === 0" v-model="form.manual_work_order"
                      label="Orden de Trabajo" placeholder="Ingrese número de orden"
                      :rules="[v => !!v || 'La orden de trabajo es requerida']" prepend-inner-icon="ri-clipboard-line"
                      variant="outlined" density="compact" hint="Ingrese manualmente la orden"
                      persistent-hint :disabled="loading" />
                    <VSelect v-else v-model="form.work_order_id" :items="workOrders" item-title="description"
                      item-value="id" label="Orden de Trabajo" placeholder="Seleccione orden"
                      :rules="[v => !!v || 'La orden de trabajo es requerida']" :disabled="loading"
                      prepend-inner-icon="ri-clipboard-line" variant="outlined" density="compact"
                      hint="Orden asociada a la venta" persistent-hint />
                  </div>
                </VCol>
              </VRow>
            </div>

            <!-- Egreso -->
            <div v-if="form.type === 2" class="expense-section">
              <VRow dense>
                <VCol cols="12" md="6">
                  <VSelect v-model="form.employee_id" :items="employees" item-title="name" item-value="id"
                    label="Empleado" placeholder="Seleccione empleado (opcional)" clearable
                    :disabled="loading" prepend-inner-icon="ri-user-tie-line" variant="outlined" density="compact"
                    hint="Empleado que recibe el pago" persistent-hint />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField v-model="form.invoice_number" label="Factura"
                    placeholder="Número de factura (opcional)" :disabled="loading"
                    prepend-inner-icon="ri-file-text-line" variant="outlined" density="compact"
                    hint="Número de factura de compra" persistent-hint />
                </VCol>
              </VRow>
            </div>
          </div>

          <!-- Resumen del Movimiento -->
          <div v-if="form.amount && form.type" class="mt-6">
            <VAlert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <i :class="getTransactionIcon(form.type)"></i>
              </template>
              <div class="text-body-2">
                <strong>Resumen:</strong> {{ getTransactionPrefix(form.type) }}${{ formatCurrency(form.amount) }} -
                {{ getTransactionTypeName(form.type) }}
                <span v-if="form.description"> - {{ form.description }}</span>
              </div>
            </VAlert>
          </div>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Acciones -->
      <VCardActions class="pa-4">
        <VSpacer />
        <VBtn variant="outlined" size="small" @click="closeDialog" :disabled="loading">
          Cancelar
        </VBtn>
        <VBtn 
          :color="form.type === 1 ? 'success' : form.type === 2 ? 'error' : 'info'" 
          variant="elevated" 
          size="small"
          @click="handleSubmit" 
          :loading="loading" 
          :disabled="loading"
          prepend-icon="ri-check-line">
          Registrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'

// Props y Emits
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  transactionType: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'refresh'])

// Reactive data
const formRef = ref()
const loading = ref(false)
const loadingAccounts = ref(false)
const accounts = ref([])
const partners = ref([])
const employees = ref([])
const workOrders = ref([])

// Form data
const form = ref({
  account_id: null,
  type: props.transactionType || 1, // Default to income if no transactionType provided
  amount: null,
  description: '',
  account_destination_id: null,
  income_type: null,
  partner_id: null,
  employee_id: null,
  work_order_id: null,
  invoice_number: '',
  manual_work_order: ''
})

// Dialog v-model
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Transaction types
const transactionTypes = [
  { value: 1, label: 'Ingreso', icon: 'mdi-cash-plus', color: 'success' },
  { value: 2, label: 'Egreso', icon: 'mdi-cash-minus', color: 'error' },
  { value: 3, label: 'Transferencia', icon: 'mdi-bank-transfer', color: 'info' }
]

// Income types
const incomeTypes = [
  { label: 'Aporte de Capital', value: 'capital' },
  { label: 'Venta por Orden de Trabajo', value: 'work_order' }
]

// Computed properties
const groupedAccounts = computed(() => {
  console.log('🔍 accounts.value:', accounts.value)
  console.log('📋 groupedAccounts items:', accounts.value.map(acc => ({
    name: acc.name,
    id: acc.id,
    current_balance: acc.current_balance
  })))
  return accounts.value
})

const destinationAccounts = computed(() => {
  return accounts.value.filter(account => account.id !== form.value.account_id)
})

// Methods
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const getTransactionTypeColor = (type) => {
  const colors = {
    1: 'success',
    2: 'error',
    3: 'info'
  }
  return colors[type] || 'grey'
}

const getTransactionIcon = (type) => {
  const icons = {
    1: 'ri-add-line',
    2: 'ri-subtract-line',
    3: 'ri-exchange-line'
  }
  return icons[type] || 'ri-receipt-line'
}

const getTransactionTextColor = (type) => {
  const colors = {
    1: 'text-success',
    2: 'text-error',
    3: 'text-info'
  }
  return colors[type] || 'text-grey'
}

const getTransactionPrefix = (type) => {
  const prefixes = {
    1: '+',
    2: '-',
    3: ''
  }
  return prefixes[type] || ''
}

const getTransactionTypeName = (type = null) => {
  const typeToUse = type || form.value.type || props.transactionType
  const names = {
    1: 'Ingreso',
    2: 'Egreso',
    3: 'Transferencia'
  }
  return names[typeToUse] || 'Desconocido'
}

const getDynamicSectionClass = () => {
  const classes = {
    1: 'success-bg',
    2: 'warning-bg'
  }
  return classes[form.value.type] || 'info-bg'
}

const getDynamicSectionIcon = () => {
  const icons = {
    1: 'ri-group-line',
    2: 'ri-user-tie-line'
  }
  return icons[form.value.type] || 'ri-information-line'
}

const getDynamicSectionTitle = () => {
  const titles = {
    1: 'Detalles del Ingreso',
    2: 'Detalles del Egreso'
  }
  return titles[form.value.type] || 'Información Adicional'
}

const getAccountName = (accountId) => {
  if (!accountId) return 'Sin cuenta'

  const account = accounts.value.find(acc => acc.id === accountId)
  if (account) return account.name

  return `Cuenta ${accountId}`
}

const loadAccounts = async () => {
  try {
    loadingAccounts.value = true
    const response = await axios.get('/api/accounts')
    accounts.value = response.data.data || []
  } catch (error) {
    console.error('Error loading accounts:', error)
  } finally {
    loadingAccounts.value = false
  }
}

const loadPartners = async () => {
  try {
    const response = await axios.get('/api/partners')
    partners.value = response.data.data || []
  } catch (error) {
    console.error('Error loading partners:', error)
  }
}

const loadEmployees = async () => {
  try {
    const response = await axios.get('/api/employees')
    employees.value = response.data.data || []
  } catch (error) {
    console.error('Error loading employees:', error)
  }
}

const loadWorkOrders = async () => {
  try {
    const response = await axios.get('/api/work-orders')
    workOrders.value = response.data.data || []
  } catch (error) {
    console.error('Error loading work orders:', error)
  }
}

const handleSubmit = async () => {
  const { valid } = await formRef.value?.validate()

  if (!valid) {
    return
  }

  loading.value = true

  try {
    // Preparar datos según tipo de transacción
    const formData = {
      account_id: form.value.account_id,
      type: form.value.type,
      amount: form.value.amount,
      description: form.value.description,
      invoice_number: form.value.invoice_number || null,
      work_order_id: null,
      manual_work_order: null,
      partner_id: null,
      employee_id: null,
      income_type: null
    }

    // Si es ingreso, establecer income_type y campos relacionados
    if (form.value.type === 1) {
      formData.income_type = form.value.income_type
      
      if (form.value.income_type === 'work_order') {
        if (form.value.work_order_id) {
          formData.work_order_id = form.value.work_order_id
        } else if (form.value.manual_work_order) {
          formData.manual_work_order = form.value.manual_work_order
        }
      }
      
      if (form.value.income_type === 'capital') {
        formData.partner_id = form.value.partner_id
      }
    }

    // Si es egreso, establecer campos relacionados
    if (form.value.type === 2) {
      formData.employee_id = form.value.employee_id
      formData.invoice_number = form.value.invoice_number
    }

    console.log('📤 Formulario completo:', form.value)
    console.log('📤 Enviando datos:', formData)
    console.log('📤 income_type:', formData.income_type)
    const response = await axios.post('/api/transactions', formData)
    console.log('📥 Respuesta del servidor:', response.data)

    emit('refresh')
    closeDialog()
  } catch (error) {
    console.error('Error submitting transaction:', error)
    if (error.response) {
      console.error('📋 Error del servidor:', error.response.data)
      console.error('📋 Status:', error.response.status)
    }
  } finally {
    loading.value = false
  }
}

const closeDialog = () => {
  dialog.value = false
  resetForm()
}

const resetForm = () => {
  form.value = {
    account_id: null,
    type: props.transactionType || 1,
    amount: null,
    description: '',
    account_destination_id: null,
    income_type: null,
    partner_id: null,
    employee_id: null,
    invoice_number: '',
    work_order_id: null,
    manual_work_order: ''
  }

  if (formRef.value) {
    formRef.value.resetValidation()
  }
}

// Watch para establecer el tipo cuando se pasa como prop
watch(() => props.transactionType, (newType) => {
  if (newType) {
    form.value.type = newType
  }
}, { immediate: true })

// Watch para limpiar campos cuando cambia el tipo
watch(() => form.value.type, (newType, oldType) => {
  if (oldType !== null && newType !== oldType) {
    // Limpiar campos específicos del tipo anterior
    form.value.account_destination_id = null
    form.value.partner_id = null
    form.value.employee_id = null
    form.value.work_order_id = null
    form.value.invoice_number = ''
  }
})

// Watch para abrir el diálogo
watch(dialog, (isOpen) => {
  if (isOpen) {
    loadAccounts()
    loadPartners()
    loadEmployees()
    loadWorkOrders()
  }
})

// Lifecycle
onMounted(() => {
  if (dialog.value) {
    loadAccounts()
    loadPartners()
    loadEmployees()
    loadWorkOrders()
  }
})
</script>

<style scoped>
.transaction-dialog {
  overflow: hidden;
}

.dialog-header {
  position: relative;
}

.header-gradient {
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
  position: relative;
}

.header-gradient::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.15"/><circle cx="10" cy="50" r="0.5" fill="white" opacity="0.15"/><circle cx="90" cy="30" r="0.5" fill="white" opacity="0.15"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.header-avatar {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.header-content h2 {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.text-white-80 {
  color: rgba(255, 255, 255, 0.8) !important;
}

.form-section,
.dynamic-section {
  position: relative;
}

.form-section::before,
.dynamic-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #1a237e, #3949ab, #1a237e);
  border-radius: 3px 3px 0 0;
}

.account-select-item:hover {
  background-color: #f5f5f5;
}

.account-select-item.group-header {
  background-color: #f8f9fa;
  font-weight: bold;
  pointer-events: none;
  opacity: 1 !important;
}

.account-select-item.group-header:hover {
  background-color: #f8f9fa;
}

.account-select-item[disabled] {
  opacity: 1 !important;
  pointer-events: none;
  background-color: #f8f9fa;
  font-weight: bold;
}

.account-select-item[disabled]:hover {
  background-color: #f8f9fa;
}

.summary-section {
  border-left: 4px solid #1a237e;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

/* Sección de Transferencias */
.transfer-section {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid #3b82f6;
}

.transfer-visual {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.account-box {
  flex: 1;
  max-width: 45%;
}

.account-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
  color: #495057;
}

.account-header i {
  color: #6c757d;
}

.origin-box .account-header i {
  color: #dc3545;
}

.destination-box .account-header i {
  color: #28a745;
}

.transfer-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}

.transfer-arrow i {
  animation: pulse 2s infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }
}

/* Estilos Mejorados */
.transaction-dialog {
  overflow: hidden;
  border-radius: 16px !important;
}

/* Header */
.header-gradient {
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
  position: relative;
  overflow: hidden;
}

.header-gradient::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.3;
}

.header-avatar {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border: 3px solid rgba(255, 255, 255, 0.2);
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: rotate(90deg);
  transition: all 0.3s ease;
}

.divider-opacity {
  opacity: 0.1;
}

/* Secciones */
.section-header {
  position: relative;
}

.section-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  color: #1a237e;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.section-icon.success-bg {
  background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
  color: #2e7d32;
}

.section-icon.warning-bg {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  color: #f57c00;
}

.section-icon.info-bg {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
}

/* Campos */
.field-group {
  margin-bottom: 8px;
}

.field-label {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.875rem;
  color: #424242;
  margin-bottom: 8px;
}

.enhanced-select :deep(.v-field),
.enhanced-field :deep(.v-field),
.enhanced-textarea :deep(.v-field) {
  border-radius: 12px;
  transition: all 0.3s ease;
}

.enhanced-select :deep(.v-field:hover),
.enhanced-field :deep(.v-field:hover),
.enhanced-textarea :deep(.v-field:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(26, 35, 126, 0.15);
}

.enhanced-select :deep(.v-field--focused),
.enhanced-field :deep(.v-field--focused),
.enhanced-textarea :deep(.v-field--focused) {
  box-shadow: 0 8px 24px rgba(26, 35, 126, 0.2);
}

/* Resumen */
.summary-section {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 16px;
  border-left: 4px solid #1a237e;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.summary-icon.success {
  background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
}

.summary-icon.error {
  background: linear-gradient(135deg, #f44336 0%, #ef5350 100%);
}

.summary-icon.info {
  background: linear-gradient(135deg, #2196f3 0%, #42a5f5 100%);
}

.summary-item {
  margin-bottom: 8px;
}

.summary-label {
  font-weight: 500;
  color: #616161;
  margin-right: 8px;
}

.summary-value {
  font-weight: 600;
}

.amount-display {
  text-align: right;
}

.amount-prefix {
  font-size: 1.2rem;
  font-weight: 600;
  margin-right: 4px;
}

.amount-value {
  font-size: 1.8rem;
  font-weight: 700;
}

/* Botones */
.cancel-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
  transition: all 0.3s ease;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(26, 35, 126, 0.3);
  transition: all 0.3s ease;
}

/* Grids */
.form-grid>* {
  padding-bottom: 16px;
}

.dynamic-grid>* {
  padding-bottom: 16px;
}

/* Animaciones */
.transaction-dialog :deep(.v-card) {
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 600px) {
  .header-gradient {
    padding: 24px !important;
  }

  .header-content h2 {
    font-size: 1.5rem !important;
  }

  .header-content p {
    font-size: 0.875rem !important;
  }

  .section-header .d-flex {
    flex-direction: column;
    text-align: center;
  }

  .section-icon {
    margin-bottom: 16px;
  }
}
</style>
