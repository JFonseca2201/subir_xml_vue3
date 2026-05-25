<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  expense: {
    type: Object,
    default: null,
  },
  accounts: {
    type: Array,
    default: () => [],
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'updated'])

// Estado
const loading = ref(false)
const formRef = ref(null)
const employees = ref([])
const accounts = ref([])

// Métodos de pago
const paymentMethods = [
  { text: 'Efectivo', value: 'EFECTIVO' },
  { text: 'Transferencia', value: 'TRANSFERENCIA' },
]

// Función local para notificaciones (reemplaza el composable faltante)
const showNotification = (message, type = 'info') => {
  // Crear elemento toast
  const toast = document.createElement('div')

  toast.className = `toast toast-${type}`
  toast.textContent = message
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 9999;
        font-size: 14px;
        max-width: 300px;
        overflow-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `

  // Agregar al DOM
  document.body.appendChild(toast)

  // Remover automáticamente después de 4 segundos
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 4000)
}

// Agregar animación CSS si no existe
if (!document.querySelector('#toast-styles')) {
  const style = document.createElement('style')

  style.id = 'toast-styles'
  style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `
  document.head.appendChild(style)
}

// Computed
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const isEditing = computed(() => !!props.expense)

const dialogTitle = computed(() => isEditing.value ? 'Editar Pago' : 'Nuevo Pago')

// Formulario reactivo
const form = ref({
  employee_id: null,
  account_id: null,
  amount: null,
  description: '',
  payment_date: new Date().toISOString().split('T')[0],
})

// Funciones
const resetForm = () => {
  form.value = {
    employee_id: null,
    account_id: null,
    amount: null,
    description: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'TRANSFERENCIA',
  }
  formRef.value?.reset()
}

const closeDialog = () => {
  show.value = false
  setTimeout(() => {
    resetForm()
  }, 300)
}

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true

  try {
    if (!props.expense?.id) {
      throw new Error('ID de pago no proporcionado')
    }

    const payload = {
      ...form.value,
      type: 'payment',
    }

    console.log('🔍 EditPayment - Enviando actualización:', payload)

    const response = await $api(`employee-expenses/${props.expense.id}`, {
      method: 'PUT',
      body: payload,
    })

    console.log('🔍 EditPayment - Respuesta de actualización:', response)
    showNotification('Pago actualizado exitosamente', 'success')
    emit('updated', response)
    closeDialog()
  } catch (error) {
    console.error('Error al actualizar pago:', error)

    // Manejar errores específicos
    if (error.status === 422 && error.data?.message) {
      showNotification(error.data.message, 'error')
    } else if (error.status === 404) {
      showNotification('Pago no encontrado', 'error')
    } else {
      showNotification('Error al actualizar el pago. Por favor, intente nuevamente.', 'error')
    }
  } finally {
    loading.value = false
  }
}

const loadEmployees = async () => {
  try {
    console.log('Cargando empleados...')

    const response = await $api('employees')

    console.log('Respuesta completa:', response)
    console.log('Empleados:', response.employees)

    // Transform employee data to include a computed name field
    employees.value = response.employees?.map(emp => ({
      ...emp,
      name: `${emp.first_name} ${emp.last_name}`.trim(),
    })) || []
    console.log('Empleados cargados:', employees.value)
  } catch (error) {
    console.error('Error al cargar empleados:', error)
  }
}

const loadAccounts = async () => {
  try {
    console.log('Cargando cuentas...')

    const response = await $api('accounts')

    const transformAccounts = accounts => {
      return (accounts || []).map(account => ({
        ...account,
        display_name: `${account.bank_name} (${account.name})`,
      }))
    }

    accounts.value = transformAccounts(response)
    console.log('Cuentas cargadas:', accounts.value)
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
  }
}

// Watchers
watch(() => props.expense, newVal => {
  console.log('🔍 EditPayment - Props expense changed:', newVal)
  if (newVal) {
    console.log('🔍 EditPayment - Cargando datos del pago:', newVal)

    // Esperar un ciclo para asegurar que el formulario esté listo
    nextTick(() => {
      // Cargar todos los datos del pago
      form.value.amount = newVal.amount || null
      form.value.description = newVal.description || ''


      // Convertir fecha a formato yyyy-MM-dd para input date
      const dateValue = newVal.payment_date || newVal.date || new Date().toISOString().split('T')[0]
      if (dateValue && typeof dateValue === 'string') {
        // Si está en formato dd/MM/yyyy, convertirlo
        if (dateValue.includes('/')) {
          const [day, month, year] = dateValue.split('/')

          form.value.payment_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        } else {
          form.value.payment_date = dateValue
        }
      } else {
        form.value.payment_date = new Date().toISOString().split('T')[0]
      }
      form.value.payment_method = newVal.payment_method || 'TRANSFERENCIA'

      console.log('🔍 EditPayment - amount asignado:', form.value.amount)
      console.log('🔍 EditPayment - description asignado:', form.value.description)
      console.log('🔍 EditPayment - payment_date asignado:', form.value.payment_date)
      console.log('🔍 EditPayment - payment_method asignado:', form.value.payment_method)

      // Si ya tenemos empleados y cuentas cargados, asignar los IDs
      if (employees.value.length > 0 && accounts.value.length > 0) {
        assignEmployeeAndAccountIds(newVal)
      } else {
        // Si no, guardar los datos para asignar después de cargar
        console.log('🔍 EditPayment - Empleados/Cuentas no cargados, esperando...')
        setTimeout(() => assignEmployeeAndAccountIds(newVal), 100)
      }

      console.log('🔍 EditPayment - Formulario actualizado:', form.value)
    })
  }
}, { immediate: true })

// Función para asignar IDs de empleado y cuenta
const assignEmployeeAndAccountIds = paymentData => {
  console.log('🔍 EditPayment - Asignando IDs, empleados:', employees.value.length, 'cuentas:', accounts.value.length)

  // Buscar employee_id a partir de employee_name
  if (paymentData.employee_name && employees.value.length > 0) {
    const employee = employees.value.find(emp =>
      emp.name === paymentData.employee_name ||
            `${emp.first_name} ${emp.last_name}` === paymentData.employee_name,
    )

    if (employee) {
      form.value.employee_id = employee.id
      console.log('🔍 EditPayment - employee_id encontrado:', employee.id, 'para', paymentData.employee_name)
    } else {
      console.log('🔍 EditPayment - empleado no encontrado:', paymentData.employee_name)
      console.log('🔍 EditPayment - Empleados disponibles:', employees.value.map(e => e.name))
    }
  } else if (paymentData.employee_id) {
    form.value.employee_id = paymentData.employee_id
    console.log('🔍 EditPayment - employee_id directo:', paymentData.employee_id)
  }

  // Buscar account_id a partir de account_name
  if (paymentData.account_name && accounts.value.length > 0) {
    const account = accounts.value.find(acc =>
      acc.name === paymentData.account_name ||
            acc.display_name === paymentData.account_name,
    )

    if (account) {
      form.value.account_id = account.id
      console.log('🔍 EditPayment - account_id encontrado:', account.id, 'para', paymentData.account_name)
    } else {
      console.log('🔍 EditPayment - cuenta no encontrada:', paymentData.account_name)
      console.log('🔍 EditPayment - Cuentas disponibles:', accounts.value.map(a => a.display_name))
    }
  } else if (paymentData.account_id) {
    form.value.account_id = paymentData.account_id
    console.log('🔍 EditPayment - account_id directo:', paymentData.account_id)
  }

  // Asignar payment_method si existe
  if (paymentData.payment_method) {
    form.value.payment_method = paymentData.payment_method
    console.log('🔍 EditPayment - payment_method asignado:', paymentData.payment_method)
  }

  console.log('🔍 EditPayment - IDs asignados - employee_id:', form.value.employee_id, 'account_id:', form.value.account_id, 'payment_method:', form.value.payment_method)
}

watch(() => show.value, newVal => {
  console.log('🔍 EditPayment - Dialog show changed:', newVal)
  if (newVal) {
    console.log('🔍 EditPayment - Cargando empleados y cuentas...')
    loadEmployees()
    loadAccounts()
  }
})

// Watcher para reasignar IDs cuando se carguen empleados y cuentas
watch([employees, accounts], () => {
  if (props.expense && employees.value.length > 0 && accounts.value.length > 0) {
    console.log('🔍 EditPayment - Empleados/Cuentas cargados, reasignando IDs...')
    assignEmployeeAndAccountIds(props.expense)
  }
}, { immediate: true })

// Lifecycle
onMounted(() => {
  loadEmployees()
  loadAccounts()
})
</script>

<template>
  <VDialog
    v-model="show"
    max-width="500"
    persistent
  >
    <VCard>
      <!-- Header -->
      <VCardTitle class="pa-6 pb-4">
        <div class="d-flex align-center gap-3">
          <VIcon
            icon="ri-edit-line"
            color="info"
            size="28"
          />
          <div>
            <h3 class="text-h5 font-weight-bold">
              Editar Pago
            </h3>
            <span class="text-medium-emphasis text-body-2">
              Modifica los datos del pago
            </span>
          </div>
        </div>
      </VCardTitle>
      <VDivider />
      <VForm
        ref="formRef"
        @submit.prevent="handleSubmit"
      >
        <VCardText class="pa-4">
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
          </VRow>

          <VRow>
            <VCol cols="12">
              <VSelect
                v-model="form.account_id"
                :items="accounts"
                item-title="display_name"
                item-value="id"
                label="Cuenta"
                placeholder="Seleccionar cuenta"
                :rules="[v => !!v]"
                required
              />
            </VCol>
          </VRow>

          <VRow>
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
          </VRow>

          <VRow>
            <VCol cols="12">
              <VSelect
                v-model="form.payment_method"
                :items="paymentMethods"
                item-title="text"
                item-value="value"
                label="Método de Pago"
                placeholder="Seleccionar método"
                :rules="[v => !!v || 'El método de pago es requerido']"
                required
              />
            </VCol>
          </VRow>

          <VRow>
            <VCol cols="12">
              <VTextField
                v-model="form.description"
                label="Descripción"
                placeholder="Descripción del pago"
                :rules="[v => !!v]"
              />
            </VCol>
          </VRow>

          <VRow>
            <VCol cols="12">
              <VTextField
                v-model="form.payment_date"
                label="Fecha"
                type="date"
                :rules="[v => !!v]"
                required
              />
            </VCol>
          </VRow>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end">
          <VBtn
            color="default"
            variant="outlined"
            prepend-icon="ri-close-line"
            @click="closeDialog"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            type="submit"
            :loading="loading"
            :disabled="loading"
            prepend-icon="ri-edit-line"
          >
            Actualizar Pago
          </VBtn>
        </VCardActions>
      </VForm>
    </VCard>
  </VDialog>
</template>