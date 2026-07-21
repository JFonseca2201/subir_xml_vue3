<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  expense: {
    type: Object,
    default: () => ({}),
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'updated'])

// Estado
const formRef = ref(null)
const employees = ref([])
const accounts = ref([])

const paymentMethods = [
  { text: 'Efectivo', value: 'EFECTIVO' },
  { text: 'Transferencia', value: 'TRANSFERENCIA' },
]

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Computed
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const isEditing = computed(() => !!props.expense)

const dialogTitle = computed(() => isEditing.value ? 'Editar Adelanto' : 'Nuevo Adelanto')

const filteredAccounts = computed(() => {
  const method = form.value.payment_method
  if (!method) return accounts.value

  if (method === 'EFECTIVO') {
    return accounts.value.filter(acc => acc.type === 'cash')
  } else if (method === 'TRANSFERENCIA') {
    return accounts.value.filter(acc => acc.type === 'bank')
  }

  return accounts.value
})

// Formulario reactivo
const form = ref({
  employee_id: null,
  employee_name: '',
  account_id: null,
  account_name: '',
  amount: null,
  description: '',
  advance_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
  payment_method: 'TRANSFERENCIA',
})

// Funciones
const resetForm = () => {
  form.value = {
    employee_id: null,
    employee_name: '',
    account_id: null,
    account_name: '',
    amount: null,
    description: '',
    advance_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
    payment_method: 'TRANSFERENCIA',
  }
  formRef.value?.reset()
}

const closeDialog = () => {
  show.value = false
  setTimeout(() => {
    resetForm()
  }, 100)
}

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loader.start()

  try {
    const payload = {
      employee_id: form.value.employee_id,
      account_id: form.value.account_id,
      amount: parseFloat(form.value.amount),
      description: form.value.description,
      advance_date: form.value.advance_date,
      payment_method: form.value.payment_method,
      reason: form.value.description,
    }

    const response = await $api(`employee-expenses/${props.expense?.id}/advance`, {
      method: 'PUT',
      body: payload,
    })

    showNotification('Adelanto actualizado exitosamente', 'success')
    emit('updated', response)
    closeDialog()
  } catch (error) {
    console.error('Error al guardar adelanto:', error)

    // Manejar errores de validación específicos
    if (error.status === 422) {
      const errorData = error.data
      if (errorData.message && errorData.message.includes('Saldo insuficiente')) {
        // Mostrar mensaje amigable de saldo insuficiente
        showNotification('Saldo insuficiente en la cuenta.\nSaldo disponible: $' + errorData.saldo_disponible + '\nMonto solicitado: $' + errorData.monto_solicitado, 'error')
        
        return
      }

      // Manejar otros errores de validación
      if (errorData.message) {
        showNotification(errorData.message, 'error')
        
        return
      }
    }

    // Error genérico
    showNotification('Error al guardar el adelanto. Por favor, intente nuevamente.', 'error')
  } finally {
    loader.stop()
  }
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

    console.log('Respuesta completa:', response)
    console.log('Cuentas:', response)

    // Asegurar que las cuentas tengan propiedad 'name' limpia e incluyan el banco
    accounts.value = (response || []).map(account => {
      const rawName = account.name || account.account_name || account.description || `Cuenta ${account.id}`
      const cleanedName = rawName
        .replace(/\(EFECTIVO\)/gi, '')
        .replace(/\(TRANSFERENCIA\)/gi, '')
        .trim()

      return {
        ...account,
        name: account.bank_name ? `${account.bank_name} (${cleanedName})` : cleanedName,
      }
    })
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
  }
}

// Watchers
watch(() => show.value, newVal => {
  if (newVal) {
    loadEmployees()
  }
  loadAccounts()
})

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

watch(() => form.value.payment_method, method => {
  form.value.account_id = null
})

// Lifecycle
onMounted(async () => {
  // Cargar empleados primero
  await loadEmployees()

  if (props.expense) {
    // Load expense data when editing
    console.log('Cargando datos del adelanto:', props.expense)
    form.value.employee_id = props.expense.employee_id
    form.value.account_id = props.expense.account_id
    form.value.amount = props.expense.amount
    form.value.description = props.expense.description
    form.value.advance_date = props.expense.date ? props.expense.date.split('/').reverse().join('-') : (props.expense.advance_date ? props.expense.advance_date.split('T')[0] : new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0])
    form.value.payment_method = props.expense.payment_method || 'TRANSFERENCIA'

    console.log('Formulario cargado:', form.value)
  }
})

watch(() => show.value, async newVal => {
  if (newVal) {
    // Cargar empleados y cuentas cuando se abre el diálogo
    await loadEmployees()
    await loadAccounts()

    // Cargar datos del adelanto cuando se abre para editar
    console.log('Cargando datos del adelanto al abrir diálogo:', props.expense)
    console.log('employee_id:', props.expense.employee_id, 'Tipo:', typeof props.expense.employee_id)
    console.log('account_id:', props.expense.account_id, 'Tipo:', typeof props.expense.account_id)
    console.log('Empleados disponibles:', employees.value)
    console.log('Cuentas disponibles:', accounts.value)

    // Usar nextTick para asegurar que los datos se carguen después de que empleados y cuentas estén disponibles
    await nextTick()

    form.value.employee_id = props.expense.employee_id
    form.value.account_id = props.expense.account_id
    form.value.amount = props.expense.amount
    form.value.description = props.expense.description
    form.value.advance_date = props.expense.date ? props.expense.date.split('/').reverse().join('-') : (props.expense.advance_date ? props.expense.advance_date.split('T')[0] : new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0])
    form.value.payment_method = props.expense.payment_method || 'TRANSFERENCIA'

    console.log('Formulario cargado:', form.value)
    console.log('Empleado encontrado:', employees.value.find(emp => emp.id === props.expense.employee_id))
    console.log('Cuenta encontrada:', accounts.value.find(acc => acc.id === props.expense.account_id))
  }
})
</script>

<template>
  <VDialog
    v-model="show"
    max-width="500"
    persistent
  >
    <VCard class="employee-dialog">
      <!-- Header -->
      <VCardTitle class="employee-dialog__header">
        <div class="employee-dialog__title">
          <VIcon
            icon="ri-edit-line"
            color="info"
            size="28"
          />
          <div>
            <h3 class="text-h5 font-weight-bold">
              Editar Adelanto
            </h3>
            <span class="text-medium-emphasis text-body-2">
              Modifica los datos del adelanto
            </span>
          </div>
        </div>
      </VCardTitle>

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
                v-model="form.payment_method"
                :items="paymentMethods"
                item-title="text"
                item-value="value"
                label="Método de Pago"
                :rules="[v => !!v]"
                required
              />
            </VCol>
          </VRow>

          <VRow>
            <VCol cols="12">
              <VSelect
                v-model="form.account_id"
                :items="filteredAccounts"
                item-title="name"
                item-value="id"
                label="Cuenta"
                placeholder="Seleccionar cuenta"
                :rules="[v => !!v]"
                required
              >
                <template #prepend-inner>
                  <VIcon color="primary" size="20">
                    {{ form.payment_method === 'EFECTIVO' ? 'ri-money-dollar-circle-line' : 'ri-bank-line' }}
                  </VIcon>
                </template>
                <template #item="{ props, item }">
                  <VListItem v-bind="props" :title="undefined">
                    <template #prepend>
                      <VAvatar size="30" :color="item.raw.type === 'cash' ? 'success' : 'primary'" variant="tonal" class="me-2">
                        <VIcon :icon="item.raw.type === 'cash' ? 'ri-money-dollar-circle-line' : 'ri-bank-card-line'" size="18" />
                      </VAvatar>
                    </template>
                    <VListItemTitle class="font-weight-medium">
                      {{ item.raw.name }}
                    </VListItemTitle>
                    <VListItemSubtitle class="text-caption mt-1">
                      Saldo: <span class="font-weight-bold" :class="item.raw.saldo_actual >= 0 ? 'text-success' : 'text-error'">${{ parseFloat(item.raw.saldo_actual).toFixed(2) }}</span>
                    </VListItemSubtitle>
                  </VListItem>
                </template>
              </VSelect>
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
              <VTextField
                v-model="form.description"
                label="Descripción"
                placeholder="Descripción del adelanto"
                :rules="[v => !!v]"
              />
            </VCol>
          </VRow>

          <VRow>
            <VCol cols="12">
              <VTextField
                v-model="form.advance_date"
                label="Fecha"
                type="date"
                :rules="[v => !!v]"
                required
              />
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />
        <VCardText class="pa-4" />
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
            :loading="loader.loading"
            :disabled="loader.loading"
            prepend-icon="ri-edit-line"
          >
            Actualizar Adelanto
          </VBtn>
        </VCardActions>
      </VForm>
    </VCard>
  </VDialog>
</template>
