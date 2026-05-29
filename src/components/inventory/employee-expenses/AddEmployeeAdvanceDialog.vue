<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  accounts: {
    type: Array,
    default: () => [],
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'created'])

// Estado
const formRef = ref(null)
const employees = ref([])
const accounts = ref([])
const loading = ref(false)

const paymentMethods = [
  { text: 'Efectivo', value: 'EFECTIVO' },
  { text: 'Transferencia', value: 'TRANSFERENCIA' },
]

// Computed
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const filteredAccounts = computed(() => {
  if (form.value.payment_method === 'TRANSFERENCIA') {
    return accounts.value.filter(acc => acc.id !== 1)
  }
  return accounts.value
})

// Formulario reactivo
const form = ref({
  employee_id: null,
  account_id: null,
  amount: null,
  description: '',
  advance_date: new Date().toISOString().split('T')[0],
  payment_date: new Date().toISOString().split('T')[0],
  payment_method: 'TRANSFERENCIA',
  employee_name: '',
  account_name: '',
})

// Funciones
const resetForm = () => {
  form.value = {
    employee_id: null,
    account_id: null,
    amount: null,
    description: '',
    advance_date: new Date().toISOString().split('T')[0],
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'TRANSFERENCIA',
    employee_name: '',
    account_name: '',
  }
  formRef.value?.reset()
}

const closeDialog = () => {
  show.value = false
  setTimeout(() => {
    resetForm()
  }, 300)
}

const loadEmployees = async () => {
  try {
    console.log('Cargando empleados...')

    const response = await $api('employees')

    console.log('Respuesta completa:', response)
    console.log('Empleados:', response.employees)

    // Transformar empleados para agregar propiedad 'name' combinada
    employees.value = (response.employees || []).map(emp => ({
      ...emp,
      name: `${emp.first_name} ${emp.last_name}`,
    }))
  } catch (error) {
    console.error('Error al cargar empleados:', error)
  }
}

const loadAccounts = async () => {
  try {
    console.log('Cargando cuentas...')

    const response = await $api('accounts')

    // Asegurar que las cuentas tengan propiedad 'name'
    accounts.value = (response || []).map(account => ({
      ...account,
      name: account.name || account.account_name || account.description || `Cuenta ${account.id}`,
    }))
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
  }
}


watch(() => form.value.employee_id, async employeeId => {
  if (employeeId) {
    // Encontrar el empleado seleccionado para obtener su nombre
    const selectedEmployee = employees.value.find(emp => emp.id === employeeId)

    // Actualizar el nombre del empleado en el formulario
    if (selectedEmployee) {
      form.value.employee_name = selectedEmployee.name
    }
  }
})

watch(() => form.value.account_id, accountId => {
  if (accountId) {
    // Encontrar la cuenta seleccionada para obtener su nombre
    const selectedAccount = accounts.value.find(acc => acc.id === accountId)

    // Actualizar el nombre de la cuenta en el formulario
    if (selectedAccount) {
      form.value.account_name = selectedAccount.name
    }
  }
})

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true

  try {
    // Preparar el payload para la API
    const payload = {
      employee_id: form.value.employee_id,
      account_id: form.value.payment_method === 'EFECTIVO' ? 1 : form.value.account_id,
      amount: parseFloat(form.value.amount),
      description: form.value.description,
      advance_date: form.value.advance_date,
      payment_date: form.value.payment_date,
      payment_method: form.value.payment_method,
      type: 'advance',
    }

    // Hacer la llamada real a la API
    const response = await $api('employee-expenses/advance', {
      method: 'POST',
      body: payload,
    })

    console.log('Adelanto creado:', response)

    // Emitir el evento con la respuesta
    emit('created', response)
    closeDialog()
  } catch (error) {
    console.error('Error al crear adelanto:', error)

    // Mostrar mensaje de error al usuario
    const errorMessage = error?.data?.message || error?.message || 'Error al crear el adelanto'

    console.error('Detalle del error:', errorMessage)
  } finally {
    loading.value = false
  }
}

watch(() => form.value.payment_method, method => {
  if (method === 'EFECTIVO') {
    form.value.account_id = 1
  } else if (form.value.account_id === 1 || !form.value.account_id) {
    form.value.account_id = null
  }
})

// Watchers
watch(() => show.value, newVal => {
  if (newVal && !props.expense) {
    resetForm()
    loadEmployees()
    loadAccounts()
  }
})

// Lifecycle
onMounted(() => {
  loadEmployees()
  loadAccounts()
})
</script>


<template>
  <VDialog
    v-model="show"
    max-width="600"
    persistent
  >
    <VCard>
      <!-- Header -->
      <VCardTitle class="pa-6 pb-4">
        <DialogCloseBtn
          variant="text"
          size="default"
          @click="closeDialog"
        />
        <div class="d-flex align-center gap-3">
          <VIcon
            icon="ri-add-circle-line"
            color="info"
            size="28"
          />
          <div>
            <h3 class="text-h5 font-weight-bold">
              Nuevo Adelanto
            </h3>
            <span class="text-medium-emphasis text-body-2">
              Registra un nuevo adelanto para empleado
            </span>
          </div>
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-4">
        <VForm
          ref="formRef"
          @submit.prevent="handleSubmit"
        >
          <VCardText>
            <VRow>
              <VCol cols="12">
                <VSelect
                  v-model="form.employee_id"
                  :items="employees"
                  item-title="name"
                  item-value="id"
                  label="Empleado"
                  placeholder="Seleccionar empleado"
                  :rules="[v => !!v]"
                  required
                />
              </VCol>

              <VCol cols="6">
                <VSelect
                  v-model="form.payment_method"
                  :items="paymentMethods"
                  item-title="text"
                  item-value="value"
                  label="Método de Pago"
                  placeholder="Seleccionar método de pago"
                  :rules="[v => !!v]"
                  required
                />
              </VCol>

              <VCol v-if="form.payment_method === 'TRANSFERENCIA'" cols="6">
                <VSelect
                  v-model="form.account_id"
                  :items="filteredAccounts"
                  item-title="name"
                  item-value="id"
                  label="Cuenta"
                  placeholder="Seleccionar cuenta"
                  :rules="[v => !!v]"
                  required
                />
              </VCol>

              <VCol cols="12">
                <VTextField
                  v-model="form.amount"
                  label="Monto"
                  type="number"
                  prefix="$"
                  placeholder="0.00"
                  :rules="[v => !!v && v > 0]"
                  required
                />
              </VCol>

              <VCol cols="12">
                <VTextField
                  v-model="form.description"
                  label="Descripción"
                  placeholder="Descripción del adelanto"
                  :rules="[v => !!v]"
                />
              </VCol>

              <VCol cols="6">
                <VTextField
                  v-model="form.advance_date"
                  label="Fecha"
                  type="date"
                  :rules="[v => !!v]"
                  required
                />
              </VCol>

              <VCol cols="6">
                <VTextField
                  v-model="form.payment_date"
                  label="Fecha de Pago"
                  type="date"
                  :rules="[v => !!v]"
                  required
                />
              </VCol>
            </VRow>
          </VCardText>
          <VDivider />
          <VCardActions class="pa-6 d-flex justify-end">
            <VBtn
              color="default"
              prepend-icon="ri-close-line"
              variant="outlined"
              @click="closeDialog"
            >
              Cancelar
            </VBtn>
            <VBtn
              color="primary"
              type="submit"
              :style="{ '--color': 'var(--vscode-editor-foreground) !important' }"
              prepend-icon="ri-save-line"
              :loading="loading"
              :disabled="loading"
            >
              Crear Adelanto
            </VBtn>
          </VCardActions>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
