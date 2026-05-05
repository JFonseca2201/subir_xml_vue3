<template>
  <VDialog v-model="dialog" max-width="650" persistent scrollable>
    <VCard class="transfer-dialog">
      <!-- Header -->
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-exchange-line" color="info" size="24" />
            <div>
              <h3 class="text-h6 font-weight-medium">
                Nueva Transferencia
              </h3>
              <span class="text-medium-emphasis text-caption">
                Luxury Evys Tecnicentro
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
            <!-- Select de Cuenta Origen -->
            <VCol cols="12" md="6">
              <VSelect 
                v-model="form.from_account_id" 
                :items="groupedAccounts" 
                label="Cuenta Origen"
                placeholder="Seleccione la cuenta de origen" 
                :rules="[v => !!v || 'La cuenta de origen es requerida']"
                :loading="loadingAccounts" 
                :disabled="loading" 
                prepend-inner-icon="ri-bank-line" 
                variant="outlined"
                density="comfortable" 
                hint="Cuenta desde donde se retirarán los fondos" 
                persistent-hint
                item-title="name" item-value="id"
                @update:model-value="onOriginAccountChange">
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

            <!-- Select de Cuenta Destino -->
            <VCol cols="12" md="6">
              <VSelect 
                v-model="form.to_account_id" 
                :items="groupedDestinationAccounts" 
                label="Cuenta Destino"
                placeholder="Seleccione la cuenta de destino" 
                :rules="[v => !!v || 'La cuenta de destino es requerida']"
                :loading="loadingAccounts" 
                :disabled="loading || !form.from_account_id" 
                prepend-inner-icon="ri-bank-line" 
                variant="outlined"
                density="comfortable" 
                hint="Cuenta donde se depositarán los fondos" 
                persistent-hint
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

            <!-- Campo Amount -->
            <VCol cols="12" md="6">
              <VTextField 
                v-model="form.amount" 
                label="Monto a Transferir" 
                type="number" 
                step="0.01" 
                min="0.01" 
                prefix="$"
                placeholder="0.00" 
                :rules="[
                  v => !!v || 'El monto es requerido',
                  v => v > 0 || 'El monto debe ser mayor a 0',
                  v => validateAmount(v)
                ]" 
                :disabled="loading || !form.from_account_id" 
                prepend-inner-icon="ri-money-dollar-circle-line" 
                variant="outlined"
                density="comfortable" 
                hint="Cantidad a transferir entre cuentas" 
                persistent-hint />
            </VCol>

            <!-- Campo Descripción -->
            <VCol cols="12">
              <VTextarea 
                v-model="form.description" 
                label="Descripción"
                placeholder="Ingrese una descripción de la transferencia"
                :rules="[v => !!v || 'La descripción es requerida']" 
                :disabled="loading" 
                rows="3"
                prepend-inner-icon="ri-file-text-line" 
                variant="outlined" 
                density="comfortable" 
                counter="255"
                hint="Detalles de la transferencia realizada" 
                persistent-hint />
            </VCol>
          </VRow>

          <!-- Visualización de la Transferencia -->
          <div v-if="form.from_account_id && form.to_account_id && form.amount" class="mt-6">
            <VCard class="transfer-visual" elevation="2">
              <VCardText class="pa-4">
                <div class="d-flex align-center justify-space-between">
                  <!-- Cuenta Origen -->
                  <div class="account-box origin-box">
                    <div class="account-header">
                      <i class="ri-arrow-left-up-line me-2"></i>
                      <span>Origen</span>
                    </div>
                    <div class="account-details">
                      <h4 class="font-weight-bold">{{ getAccountName(form.from_account_id) }}</h4>
                      <p class="text-error font-weight-medium">- ${{ formatCurrency(form.amount) }}</p>
                    </div>
                  </div>

                  <!-- Flecha -->
                  <div class="transfer-arrow">
                    <i class="ri-arrow-right-line text-24 text-info"></i>
                  </div>

                  <!-- Cuenta Destino -->
                  <div class="account-box destination-box">
                    <div class="account-header">
                      <i class="ri-arrow-right-down-line me-2"></i>
                      <span>Destino</span>
                    </div>
                    <div class="account-details">
                      <h4 class="font-weight-bold">{{ getAccountName(form.to_account_id) }}</h4>
                      <p class="text-success font-weight-medium">+ ${{ formatCurrency(form.amount) }}</p>
                    </div>
                  </div>
                </div>
              </VCardText>
            </VCard>
          </div>

          <!-- Resumen -->
          <div v-if="form.amount && form.from_account_id && form.to_account_id" class="mt-4">
            <VAlert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <i class="ri-exchange-line"></i>
              </template>
              <div class="text-body-2">
                <strong>Resumen de Transferencia:</strong><br>
                Se transferirá ${{ formatCurrency(form.amount) }} de {{ getAccountName(form.from_account_id) }} 
                a {{ getAccountName(form.to_account_id) }}
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
          color="info" 
          variant="elevated" 
          size="small"
          @click="handleSubmit" 
          :loading="loading" 
          :disabled="loading || !isFormValid"
          prepend-icon="ri-exchange-line">
          Realizar Transferencia
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
  }
})

const emit = defineEmits(['update:modelValue', 'refresh'])

// Reactive data
const formRef = ref()
const loading = ref(false)
const loadingAccounts = ref(false)
const accounts = ref([])

// Form data
const form = ref({
  from_account_id: null,
  to_account_id: null,
  amount: null,
  description: ''
})

// Dialog v-model
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Computed properties
const groupedAccounts = computed(() => {
  return accounts.value
})

const groupedDestinationAccounts = computed(() => {
  return accounts.value.filter(account => account.id !== form.value.from_account_id)
})

const destinationAccounts = computed(() => {
  return accounts.value.filter(account => account.id !== form.value.from_account_id)
})

const isFormValid = computed(() => {
  return form.value.from_account_id && 
         form.value.to_account_id && 
         form.value.amount && 
         form.value.amount > 0 &&
         form.value.description
})

// Methods
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const getAccountName = (accountId) => {
  if (!accountId) return 'Sin cuenta'
  
  const account = accounts.value.find(acc => acc.id === accountId)
  if (account) return account.name
  
  return `Cuenta ${accountId}`
}

const getOriginAccountBalance = () => {
  if (!form.value.from_account_id) return 0
  
  const account = accounts.value.find(acc => acc.id === form.value.from_account_id)
  return account ? account.current_balance : 0
}

const validateAmount = (amount) => {
  if (!amount || !form.value.from_account_id) return true
  
  const balance = getOriginAccountBalance()
  if (parseFloat(amount) > balance) {
    return `El monto no puede superar el saldo disponible ($${formatCurrency(balance)})`
  }
  
  return true
}

const onOriginAccountChange = () => {
  // Resetear cuenta destino si es la misma que la origen
  if (form.value.to_account_id === form.value.from_account_id) {
    form.value.to_account_id = null
  }
  
  // Resetear monto si excede el saldo disponible
  if (form.value.amount && parseFloat(form.value.amount) > getOriginAccountBalance()) {
    form.value.amount = null
  }
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

const handleSubmit = async () => {
  const { valid } = await formRef.value?.validate()

  if (!valid) {
    return
  }

  loading.value = true

  try {
    // Mapear campos para transferencias
    const transferData = {
      account_id: form.value.from_account_id,
      account_destination_id: form.value.to_account_id,
      type: 3, // Transfer type
      amount: form.value.amount,
      description: form.value.description,
      // Campos adicionales requeridos por el backend
      income_type: null,
      partner_id: null,
      employee_id: null,
      work_order_id: null,
      invoice_number: null,
      manual_work_order: null
    }

    console.log('📤 Enviando transferencia:', transferData)
    const response = await axios.post('/api/transactions', transferData)
    console.log('📥 Respuesta transferencia:', response.data)

    emit('refresh')
    closeDialog()
  } catch (error) {
    console.error('Error submitting transfer:', error)
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
    from_account_id: null,
    to_account_id: null,
    amount: null,
    description: ''
  }

  if (formRef.value) {
    formRef.value.resetValidation()
  }
}

// Watch para abrir el diálogo
watch(dialog, (isOpen) => {
  if (isOpen) {
    loadAccounts()
  }
})

// Lifecycle
onMounted(() => {
  if (dialog.value) {
    loadAccounts()
  }
})
</script>

<style scoped>
.transfer-dialog {
  overflow: hidden;
}

.account-select-item:hover {
  background-color: #f5f5f5;
}

.account-select-item.group-header {
  background-color: #f8f9fa;
  font-weight: bold;
  pointer-events: none;
}

.account-select-item.group-header:hover {
  background-color: #f8f9fa;
}

/* Sección de Transferencias */
.transfer-visual {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border-left: 4px solid #3b82f6;
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
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Animaciones */
.transfer-dialog :deep(.v-card) {
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
  .account-box {
    max-width: 100%;
    margin-bottom: 16px;
  }
  
  .transfer-arrow {
    transform: rotate(90deg);
    margin: 16px 0;
  }
}
</style>
