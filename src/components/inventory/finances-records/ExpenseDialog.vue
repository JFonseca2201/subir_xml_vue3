<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  editingMovement: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

// Form data
const form = ref({
  type: 1, // TYPE_EXPENSE
  work_order_number: '',
  invoice_number: '',
  description: '',
  entry_date: new Date().toISOString().split('T')[0],
  payments: [
    { account_id: null, amount: 0 },
  ],
})

// Account options
const accountOptions = ref([])

// Load accounts from API
const loadAccounts = async () => {
  try {
    const response = await $api('accounts')

    accountOptions.value = response.map(account => ({
      title: account.name,
      value: account.id,
    }))
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
    showNotification('Error al cargar cuentas', 'error')
  }
}

onMounted(() => {
  loadAccounts()
})

// Watch for editing movement
watch(() => props.editingMovement, newVal => {
  if (newVal) {
    let payments = []

    if (newVal.payment_distributions && newVal.payment_distributions.length > 0) {
      payments = newVal.payment_distributions.map(dist => ({
        account_id: dist.account_id,
        amount: dist.amount.toString(),
      }))
    } else if (newVal.payments && newVal.payments.length > 0) {
      payments = newVal.payments.map(payment => ({
        account_id: payment.account_id,
        amount: payment.amount.toString(),
      }))
    } else {
      payments = [{ account_id: newVal.account_id || null, amount: (newVal.amount || 0).toString() }]
    }

    form.value = {
      type: newVal.type,
      work_order_number: newVal.work_order_number || '',
      invoice_number: newVal.invoice_number || '',
      description: newVal.description || '',
      entry_date: new Date(newVal.entry_date).toISOString().split('T')[0],
      payments: payments,
    }
  } else {
    resetForm()
  }
})

const resetForm = () => {
  form.value = {
    type: 1,
    work_order_number: '',
    invoice_number: '',
    description: '',
    entry_date: new Date().toISOString().split('T')[0],
    payments: [
      { account_id: null, amount: 0 },
    ],
  }
}

const closeDialog = () => {
  emit('update:modelValue', false)
}

// Computed properties
const totalToRegister = computed(() => {
  if (!form.value.payments || form.value.payments.length === 0) return 0
  
  return form.value.payments.reduce((total, payment) => total + parseFloat(payment.amount || 0), 0)
})

const canAddMorePayments = computed(() => {
  if (!form.value.payments || form.value.payments.length === 0) return false
  
  return form.value.payments[form.value.payments.length - 1].amount > 0
})


const saveExpense = async () => {
  try {
    // Validar que el total sea mayor a 0
    if (totalToRegister.value <= 0) {
      showNotification('El total a registrar debe ser mayor a 0', 'error')
      
      return
    }

    const payload = { ...form.value }

    // No enviar work_order_number si está vacío
    if (!payload.work_order_number || payload.work_order_number.trim() === '') {
      delete payload.work_order_number
    }

    // Asegurar que payments sea un array válido
    if (!payload.payments || payload.payments.length === 0) {
      showNotification('Debes agregar al menos un método de pago', 'error')
      
      return
    }

    // Validar que todos los pagos tengan cuenta seleccionada
    const hasInvalidPayments = payload.payments.some(p => !p.account_id)
    if (hasInvalidPayments) {
      showNotification('Debe seleccionar una cuenta para cada método de pago', 'warning')
      return
    }

    console.log('Payload to send:', payload)
    emit('saved', payload)
    closeDialog()
    resetForm() // Limpiar formulario después de guardar

    showNotification('Egreso guardado exitosamente', 'success')
  } catch (error) {
    console.error('Error al guardar egreso:', error)
    showNotification('Error al guardar egreso', 'error')
  }
}

const addPayment = () => {
  if (!form.value.payments) {
    form.value.payments = []
  }
  form.value.payments.push({ account_id: null, amount: 0 })
}

const removePayment = async index => {
  if (form.value.payments.length <= 1) {
    showNotification('Debe haber al menos un método de pago', 'error')
    
    return
  }

  const payment = form.value.payments[index]

  // Si es un movimiento existente con payment_distributions, eliminar de la base de datos
  if (props.editingMovement && payment.id) {
    loader.start()
    try {
      await $api(`payment-distributions/${payment.id}`, {
        method: 'DELETE',
      })
      showNotification('Método de pago eliminado correctamente', 'success')
    } catch (error) {
      console.error('Error al eliminar método de pago:', error)
      showNotification('Error al eliminar método de pago', 'error')
      
      return
    } finally {
      loader.stop()
    }
  }

  // Eliminar del formulario
  form.value.payments.splice(index, 1)
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

const openDialog = () => {
  emit('update:modelValue', true)
}
</script>

<template>
  <VDialog
    :model-value="props.modelValue"
    max-width="600"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <VCard class="expense-dialog">
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center gap-2">
          <VIcon
            color="error"
            size="24"
          >
            ri-arrow-down-circle-line
          </VIcon>
          <span>{{ props.editingMovement ? 'Editar Egreso' : 'Nuevo Egreso' }}</span>
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-4">
        <VForm @submit.prevent="saveExpense">
          <VRow>
            <VCol cols="12">
              <VTextField
                v-model="form.invoice_number"
                label="Número de Factura"
                placeholder="FAC-001"
              />
            </VCol>

            <VCol cols="12">
              <VTextField
                v-model="form.entry_date"
                label="Fecha"
                type="date"
                required
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="form.description"
                label="Descripción"
                placeholder="Describe el egreso..."
                required
              />
            </VCol>
          </VRow>

          <!-- Métodos de Pago -->
          <VDivider class="my-4" />
          <div class="pa-4">
            <div class="d-flex justify-space-between align-center mb-3">
              <span class="text-h6 font-weight-medium">Métodos de Pago</span>
              <VBtn
                size="small"
                color="primary"
                :disabled="!canAddMorePayments"
                @click="addPayment"
              >
                <VIcon start>
                  ri-add-line
                </VIcon>
                Agregar Método
              </VBtn>
            </div>

            <!-- Lista de Métodos de Pago -->
            <div
              v-for="(payment, index) in form.payments"
              :key="index"
              class="mb-3"
            >
              <VCard
                variant="outlined"
                class="pa-3"
              >
                <VCardText class="pa-0">
                  <VRow>
                    <VCol
                      cols="12"
                      md="5"
                    >
                      <VSelect
                        v-model="payment.account_id"
                        :items="accountOptions"
                        item-title="title"
                        item-value="value"
                        label="Cuenta"
                        required
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      md="5"
                    >
                      <VTextField
                        v-model="payment.amount"
                        label="Monto"
                        type="number"
                        prefix="$"
                        placeholder="0.00"
                        required
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      md="2"
                    >
                      <VBtn
                        color="error"
                        variant="outlined"
                        :disabled="form.payments.length <= 1"
                        @click="removePayment(index)"
                      >
                        <VIcon start>
                          ri-delete-bin-line
                        </VIcon>
                      </VBtn>
                    </VCol>
                  </VRow>
                </VCardText>
              </VCard>
            </div>

            <!-- Resumen de Métodos de Pago -->
            <!--
              <div v-if="form.payments.length > 1" class="mt-2 mb-2">
              <VAlert type="info" variant="tonal">
              <div class="d-flex align-center gap-2">
              <VIcon>ri-bank-card-line</VIcon>
              <span>
              <strong>Resumen:</strong>
              <span v-for="(payment, idx) in form.payments" :key="idx">
              {{accountOptions.find(a => a.value === payment.account_id)?.title ||
              payment.account_id}}: {{ formatCurrency(payment.amount) }}<span
              v-if="idx < form.payments.length - 1">,&nbsp;</span>
              </span>
              </span>
              </div>
              </VAlert>
              </div> 
            -->

            <!-- Total a Registrar -->
            <VAlert
              type="info"
              variant="tonal"
              class="mt-3"
            >
              <div class="d-flex align-center gap-2">
                <VIcon>ri-calculator-line</VIcon>
                <span>
                  <strong>Total a Registrar:</strong>
                  {{ formatCurrency(totalToRegister) }}
                </span>
              </div>
            </VAlert>
          </div>
          <VDivider />
          <VCardActions class="pa-4 justify-end">
            <VBtn
              variant="outlined"
              @click="closeDialog"
            >
              Cancelar
            </VBtn>
            <VBtn
              color="error"
              :disabled="totalToRegister <= 0"
              @click="saveExpense"
            >
              {{ props.editingMovement ? 'Actualizar' : 'Guardar' }}
            </VBtn>
          </VCardActions>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
