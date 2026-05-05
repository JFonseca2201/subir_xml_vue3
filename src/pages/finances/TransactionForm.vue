<template>
  <VCard class="transaction-form" title="Registrar Movimiento - Luxury Evys Tecnicentro">
    <template #prepend>
      <VBtn
        icon
        variant="text"
        @click="$router.push({ name: 'finances-operations' })"
      >
        <VIcon>mdi-arrow-left</VIcon>
      </VBtn>
    </template>
    <VCardText>
      <VForm ref="formRef" @submit.prevent="handleSubmit">
        <!-- Select de Cuenta -->
        <VRow>
          <VCol cols="12">
            <VSelect v-model="form.account_id" :items="accounts" item-title="name" item-value="id" label="Cuenta"
              placeholder="Seleccione una cuenta" :rules="[v => !!v || 'La cuenta es requerida']"
              :loading="loadingAccounts" :disabled="loading">
              <template #item="{ item, props }">
                <VListItem v-bind="props">
                  <VListItemTitle>
                    {{ item.raw.name }} ({{ item.raw.code }})
                  </VListItemTitle>
                  <VListItemSubtitle>
                    Saldo: ${{ formatCurrency(item.raw.current_balance) }}
                  </VListItemSubtitle>
                </VListItem>
              </template>
              <template #selection="{ item }">
                {{ item.raw.name }} - ${{ formatCurrency(item.raw.current_balance) }}
              </template>
            </VSelect>
          </VCol>
        </VRow>

        <!-- Select de Tipo -->
        <VRow>
          <VCol cols="12">
            <VSelect v-model="form.type" :items="transactionTypes" item-title="label" item-value="value"
              label="Tipo de Movimiento" placeholder="Seleccione el tipo" :rules="[v => !!v || 'El tipo es requerido']"
              :disabled="loading" />
          </VCol>
        </VRow>

        <!-- Campo Amount -->
        <VRow>
          <VCol cols="12">
            <VTextField v-model="form.amount" label="Monto" type="number" step="0.01" min="0.01" prefix="$"
              placeholder="0.00" :rules="[
                v => !!v || 'El monto es requerido',
                v => v > 0 || 'El monto debe ser mayor a 0'
              ]" :disabled="loading" />
          </VCol>
        </VRow>

        <!-- Campo Description -->
        <VRow>
          <VCol cols="12">
            <VTextarea v-model="form.description" label="Descripción"
              placeholder="Ingrese una descripción del movimiento" :rules="[v => !!v || 'La descripción es requerida']"
              :disabled="loading" rows="2" />
          </VCol>
        </VRow>

        <!-- Campos Dinámicos por Tipo -->
        <!-- Transferencia -->
        <VRow v-if="form.type === 3">
          <VCol cols="12">
            <VSelect v-model="form.account_destination_id" :items="destinationAccounts" item-title="name"
              item-value="id" label="Cuenta Destino" placeholder="Seleccione la cuenta destino"
              :rules="[v => !!v || 'La cuenta destino es requerida para transferencias']" :disabled="loading">
              <template #item="{ item, props }">
                <VListItem v-bind="props">
                  <VListItemTitle>
                    {{ item.raw.name }} ({{ item.raw.code }})
                  </VListItemTitle>
                  <VListItemSubtitle>
                    Saldo: ${{ formatCurrency(item.raw.current_balance) }}
                  </VListItemSubtitle>
                </VListItem>
              </template>
              <template #selection="{ item }">
                {{ item.raw.name }} - ${{ formatCurrency(item.raw.current_balance) }}
              </template>
            </VSelect>
          </VCol>
        </VRow>

        <!-- Ingreso -->
        <VRow v-if="form.type === 1">
          <VCol cols="12" md="6">
            <VSelect v-model="form.partner_id" :items="partners" item-title="name" item-value="id"
              label="Socio (Aporte de Capital)" placeholder="Seleccione un socio (opcional)" clearable
              :disabled="loading" />
          </VCol>
          <VCol cols="12" md="6">
            <VSelect v-model="form.work_order_id" :items="workOrders" item-title="description" item-value="id"
              label="Orden de Trabajo (Venta)" placeholder="Seleccione orden de trabajo (opcional)" clearable
              :disabled="loading" />
          </VCol>
        </VRow>

        <!-- Egreso -->
        <VRow v-if="form.type === 2">
          <VCol cols="12" md="6">
            <VSelect v-model="form.employee_id" :items="employees" item-title="name" item-value="id"
              label="Empleado (Pago/Adelanto)" placeholder="Seleccione un empleado (opcional)" clearable
              :disabled="loading" />
          </VCol>
          <VCol cols="12" md="6">
            <VTextField v-model="form.invoice_number" label="Número de Factura (Compra)"
              placeholder="Ingrese número de factura (opcional)" :disabled="loading" />
          </VCol>
        </VRow>

        <!-- Botones -->
        <VRow class="mt-4">
          <VCol cols="12" class="d-flex gap-3">
            <VBtn type="submit" color="primary" :loading="loading" :disabled="loading" block>
              <VIcon start icon="mdi-cash-plus" />
              Registrar Movimiento
            </VBtn>
            <VBtn color="secondary" variant="outlined" @click="resetForm" :disabled="loading">
              <VIcon start icon="mdi-refresh" />
              Limpiar
            </VBtn>
          </VCol>
        </VRow>
      </VForm>
    </VCardText>
  </VCard>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

// Emits
const emit = defineEmits(['refresh'])

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
  type: null,
  amount: null,
  description: '',
  account_destination_id: null,
  partner_id: null,
  employee_id: null,
  work_order_id: null,
  invoice_number: ''
})

// Transaction types
const transactionTypes = [
  { value: 1, label: 'Ingreso' },
  { value: 2, label: 'Egreso' },
  { value: 3, label: 'Transferencia' }
]

// Computed properties
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

const loadAccounts = async () => {
  try {
    loadingAccounts.value = true
    const response = await axios.get('/api/accounts')
    accounts.value = response.data.data
  } catch (error) {
    console.error('Error loading accounts:', error)
    // Mostrar error con SweetAlert2 o alert
    alert('Error al cargar las cuentas. Por favor, recargue la página.')
  } finally {
    loadingAccounts.value = false
  }
}

const loadPartners = async () => {
  try {
    const response = await axios.get('/api/partners')
    partners.value = response.data.data
  } catch (error) {
    console.error('Error loading partners:', error)
  }
}

const loadEmployees = async () => {
  try {
    const response = await axios.get('/api/employees')
    employees.value = response.data.data
  } catch (error) {
    console.error('Error loading employees:', error)
  }
}

const loadWorkOrders = async () => {
  try {
    const response = await axios.get('/api/work-orders')
    workOrders.value = response.data.data
  } catch (error) {
    console.error('Error loading work orders:', error)
  }
}

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()

  if (!valid) {
    return
  }

  try {
    loading.value = true

    const payload = { ...form.value }

    // Remove empty fields
    Object.keys(payload).forEach(key => {
      if (payload[key] === null || payload[key] === '') {
        delete payload[key]
      }
    })

    const response = await axios.post('/api/transactions', payload)

    // Mostrar éxito con SweetAlert2 o alert
    if (response.data.status === 'success') {
      alert('✅ ' + response.data.message)
      resetForm()
      emit('refresh')
    } else {
      alert('❌ ' + response.data.message)
    }

  } catch (error) {
    console.error('Error submitting transaction:', error)

    let errorMessage = 'Error al registrar el movimiento. Por favor, intente nuevamente.'

    if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.errors) {
      // Mostrar errores de validación
      const errors = Object.values(error.response.data.errors).flat()
      errorMessage = errors.join('\n')
    }

    alert('❌ ' + errorMessage)

  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.value = {
    account_id: null,
    type: null,
    amount: null,
    description: '',
    account_destination_id: null,
    partner_id: null,
    employee_id: null,
    work_order_id: null,
    invoice_number: ''
  }

  if (formRef.value) {
    formRef.value.resetValidation()
  }
}

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

// Lifecycle
onMounted(() => {
  loadAccounts()
  loadPartners()
  loadEmployees()
  loadWorkOrders()
})
</script>

<style scoped>
.transaction-form {
  max-width: 800px;
  margin: 0 auto;
}

.v-card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a237e;
}

.v-field__input {
  font-size: 0.875rem;
}

.v-btn {
  font-weight: 500;
}

/* Estilos específicos para Luxury Evys Tecnicentro */
.transaction-form :deep(.v-field--focused .v-field__input) {
  color: #1a237e;
}

.transaction-form :deep(.v-btn--variant-elevated) {
  background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
  border: none;
}

.transaction-form :deep(.v-btn--variant-elevated:hover) {
  background: linear-gradient(135deg, #283593 0%, #3949ab 100%);
}
</style>
