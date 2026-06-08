<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'

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

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Form data
const form = ref({
  type: 0, // TYPE_INCOME
  account_id: null,
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

// Mapping para rastrear IDs originales de distribuciones
const paymentIdMap = ref(new Map())

// Watch for editing movement
watch(() => props.editingMovement, newVal => {
  console.log('IncomeDialog - editingMovement:', JSON.stringify(newVal, null, 2))
  if (newVal) {
    let payments = []
    paymentIdMap.value.clear() // Limpiar mapa anterior

    console.log('IncomeDialog - payment_distributions length:', newVal.payment_distributions?.length || 0)
    console.log('IncomeDialog - payment_distributions:', JSON.stringify(newVal.payment_distributions, null, 2))

    if (newVal.payment_distributions && newVal.payment_distributions.length > 0) {
      console.log('IncomeDialog - Using payment_distributions')
      payments = newVal.payment_distributions.map((dist, index) => {
        // Guardar el ID original en el mapa usando el índice como clave
        paymentIdMap.value.set(index, dist.id)
        
        return {
          account_id: dist.account_id,
          amount: dist.amount.toString(),
        }
      })
      console.log('Payment ID Map:', Array.from(paymentIdMap.value.entries()))
    } else if (newVal.payments && newVal.payments.length > 0) {
      console.log('IncomeDialog - Using old payments system')
      payments = newVal.payments.map(payment => ({
        account_id: payment.account_id,
        amount: payment.amount.toString(),
      }))
    } else {
      payments = [{ account_id: newVal.account_id || null, amount: (newVal.amount || 0).toString() }]
    }

    console.log('IncomeDialog - final payments:', JSON.stringify(payments, null, 2))

    form.value = {
      type: newVal.type,
      work_order_number: newVal.work_order_number || '',
      invoice_number: newVal.invoice_number || '',
      description: newVal.description || '',
      entry_date: new Date(newVal.entry_date).toISOString().split('T')[0],
      payments: payments,
    }

    console.log('IncomeDialog - final form:', JSON.stringify(form.value, null, 2))
  } else {
    resetForm()
    paymentIdMap.value.clear()
  }
})

const resetForm = () => {
  form.value = {
    type: 0, // TYPE_INCOME
    account_id: null,
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


const saveIncome = async () => {
  try {
    // Validar que el total sea mayor a 0
    if (totalToRegister.value <= 0) {
      showNotification('El total a registrar debe ser mayor a 0', 'error')
      
      return
    }

    // Validar que todos los pagos tengan cuenta seleccionada
    const hasInvalidPayments = form.value.payments.some(p => !p.account_id)
    if (hasInvalidPayments) {
      showNotification('Debe seleccionar una cuenta para cada método de pago', 'warning')
      return
    }

    const payload = { ...form.value }

    // No enviar work_order_number si está vacío
    if (!payload.work_order_number || payload.work_order_number.trim() === '') {
      delete payload.work_order_number
    }

    emit('saved', payload)
    closeDialog()
    resetForm() // Limpiar formulario después de guardar

    showNotification('Ingreso guardado exitosamente', 'success')
  } catch (error) {
    console.error('Error al guardar ingreso:', error)
    showNotification('Error al guardar ingreso', 'error')
  }
}

const addPayment = () => {
  if (!form.value.payments) {
    form.value.payments = []
  }
  form.value.payments.push({ account_id: null, amount: 0 })
}

const removePayment = async index => {
  console.log('removePayment called with index:', index)
  console.log('form.payments:', JSON.stringify(form.value.payments, null, 2))
  console.log('Payment ID Map:', Array.from(paymentIdMap.value.entries()))

  if (form.value.payments.length <= 1) {
    showNotification('Debe haber al menos un método de pago', 'error')
    
    return
  }

  // Obtener el ID original del mapa
  const originalPaymentId = paymentIdMap.value.get(index)

  console.log('Original payment ID for index', index, ':', originalPaymentId)

  // Si es un movimiento existente y tenemos el ID original, eliminar de la base de datos
  if (props.editingMovement && originalPaymentId) {
    loader.start()
    console.log('Attempting to delete payment distribution with ID:', originalPaymentId)
    try {
      const response = await $api(`payment-distributions/${originalPaymentId}`, {
        method: 'DELETE',
      })

      console.log('Delete response:', response)
      showNotification('Método de pago eliminado correctamente', 'success')
    } catch (error) {
      console.error('Error al eliminar método de pago:', error)
      showNotification('Error al eliminar método de pago', 'error')
      
      return
    } finally {
      loader.stop()
    }
  } else {
    console.log('No payment ID found or not editing, just removing from form')
  }

  // Eliminar del formulario
  form.value.payments.splice(index, 1)

  // Actualizar el mapa de IDs - reindexar después del splice
  const newMap = new Map()

  paymentIdMap.value.forEach((id, mapIndex) => {
    if (mapIndex < index) {
      newMap.set(mapIndex, id)
    } else if (mapIndex > index) {
      newMap.set(mapIndex - 1, id)
    }
  })
  paymentIdMap.value = newMap

  console.log('Payment removed from form, new payments:', JSON.stringify(form.value.payments, null, 2))
  console.log('Updated Payment ID Map:', Array.from(paymentIdMap.value.entries()))
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}
</script>

<template>
  <VDialog
    :model-value="props.modelValue"
    max-width="600"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <VCard class="income-dialog">
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center gap-2">
          <VIcon
            color="success"
            size="24"
          >
            ri-arrow-up-circle-line
          </VIcon>
          <span>{{ props.editingMovement ? 'Editar Ingreso' : 'Nuevo Ingreso' }}</span>
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-4">
        <VForm @submit.prevent="saveIncome">
          <VRow>
            <VCol cols="12">
              <VTextField
                v-model="form.work_order_number"
                label="Número de Orden de Trabajo"
                placeholder="OT-001"
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
                placeholder="Describe el ingreso..."
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
              v-for="(payment, index) in (form.payments || [])"
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
              <div v-if="(form.payments && form.payments.length > 1)" class="mt-2 mb-2">
              <VAlert type="info" variant="tonal">
              <div class="d-flex align-center gap-2">
              <VIcon>ri-bank-card-line</VIcon>
              <span>
              <strong>Resumen:</strong>
              <span v-for="(payment, idx) in form.payments" :key="idx">
              {{(accountOptions || []).find(a => a.value === payment.account_id)?.title
              || payment.account_id}}: {{ formatCurrency(payment.amount) }}<span
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
                  <strong>Total:</strong>
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
              color="success"
              :disabled="totalToRegister <= 0"
              @click="saveIncome"
            >
              {{ props.editingMovement ? 'Actualizar' : 'Guardar' }}
            </VBtn>
          </VCardActions>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
