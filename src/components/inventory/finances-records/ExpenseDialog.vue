<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import ReceiptUploader from '@/components/common/ReceiptUploader.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  editingMovement: {
    type: Object,
    default: null,
  },
  isSaving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const receiptFiles = ref([])

// Form data
const form = ref({
  type: 1, // TYPE_EXPENSE
  work_order_number: '',
  invoice_number: '',
  description: '',
  entry_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
  payments: [
    { account_id: null, amount: 0 },
  ],
})

// Account options
const accountOptions = ref([])

const isLoadingData = ref(false)

// Load accounts from API
const loadAccounts = async () => {
  isLoadingData.value = true
  try {
    const response = await $api('accounts')

    accountOptions.value = response.map(account => {
      const cleaned = (account.name || '')
        .replace(/\(EFECTIVO\)/gi, '')
        .replace(/\(TRANSFERENCIA\)/gi, '')
        .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
        .trim()

      return {
        title: account.bank_name ? `${account.bank_name} (${cleaned})` : cleaned,
        value: account.id,
      }
    })
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
    showNotification('Error al cargar cuentas', 'error')
  } finally {
    isLoadingData.value = false
  }
}

const formRef = ref(null)

// Mapping para rastrear IDs originales de distribuciones
const paymentIdMap = ref(new Map())

const generateAutoCode = dateStr => {
  const cleanDate = dateStr.replace(/-/g, '')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  
  return `EGR-${cleanDate}-${randomSuffix}`
}

const resetForm = () => {
  const currentDate = new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]

  receiptFiles.value = []
  form.value = {
    type: 1,
    work_order_number: '',
    invoice_number: generateAutoCode(currentDate),
    description: '',
    entry_date: currentDate,
    payments: [
      { account_id: null, amount: 0 },
    ],
  }
  paymentIdMap.value.clear()
  if (formRef.value) {
    formRef.value.resetValidation()
  }
}

watch(() => props.modelValue, async newVal => {
  if (newVal) {
    if (!props.editingMovement) {
      resetForm()
    }
    isLoadingData.value = true
    try {
      await loadAccounts()
      await nextTick()
    } finally {
      isLoadingData.value = false
    }
  } else {
    if (!props.editingMovement) {
      resetForm()
    }
  }
})

onMounted(() => {
  loadAccounts()
})

// Watch for editing movement
watch(() => props.editingMovement, newVal => {
  console.log('ExpenseDialog - editingMovement:', newVal)
  if (newVal) {
    paymentIdMap.value.clear()
    let payments = []
    if (newVal.payment_distributions && newVal.payment_distributions.length > 0) {
      payments = newVal.payment_distributions.map((dist, index) => {
        paymentIdMap.value.set(index, dist.id)
        return {
          account_id: dist.account_id,
          amount: dist.amount.toString(),
        }
      })
    } else if (newVal.payments && newVal.payments.length > 0) {
      payments = newVal.payments.map(payment => ({
        account_id: payment.account_id,
        amount: payment.amount.toString(),
      }))
    } else {
      payments = [{ account_id: newVal.account_id || null, amount: (newVal.amount || 0).toString() }]
    }

    form.value = {
      type: 1, // TYPE_EXPENSE
      work_order_number: newVal.work_order_number || '',
      invoice_number: newVal.invoice_number || '',
      description: newVal.description || '',
      entry_date: newVal.entry_date || new Date().toISOString().split('T')[0],
      payments: payments,
    }
  } else {
    resetForm()
  }
}, { immediate: true })

watch(() => form.value.entry_date, newDate => {
  if (!props.editingMovement && form.value) {
    const currentCode = form.value.invoice_number
    const pattern = /^EGR-\d{8}-\d{4}$/
    if (!currentCode || pattern.test(currentCode)) {
      const cleanDate = newDate.replace(/-/g, '')
      const randomSuffix = currentCode && currentCode.includes('-') ? currentCode.split('-')[2] : Math.floor(1000 + Math.random() * 9000)

      form.value.invoice_number = `EGR-${cleanDate}-${randomSuffix}`
    }
  }
})

const closeDialog = () => {
  emit('update:modelValue', false)
  if (!props.editingMovement) {
    resetForm()
  }
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
    if (totalToRegister.value <= 0) {
      showNotification('El total a registrar debe ser mayor a 0', 'error')
      return
    }

    const hasInvalidPayments = form.value.payments.some(p => !p.account_id)
    if (hasInvalidPayments) {
      showNotification('Debe seleccionar una cuenta para cada método de pago', 'warning')
      return
    }

    if (!props.editingMovement && (!receiptFiles.value || receiptFiles.value.length === 0)) {
      showNotification('Es obligatorio adjuntar la foto o comprobante de respaldo del egreso', 'warning')
      return
    }

    const payload = { 
      ...form.value,
      receipts: receiptFiles.value,
    }

    if (!payload.invoice_number || payload.invoice_number.trim() === '') {
      delete payload.invoice_number
    }

    emit('saved', payload)
  } catch (error) {
    console.error('Error al preparar egreso:', error)
    showNotification('Error al preparar egreso', 'error')
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

  const originalPaymentId = paymentIdMap.value.get(index)

  if (props.editingMovement && originalPaymentId) {
    try {
      await $api(`payment-distributions/${originalPaymentId}`, {
        method: 'DELETE',
      })
      showNotification('Método de pago eliminado correctamente', 'success')
    } catch (error) {
      console.error('Error al eliminar método de pago:', error)
      showNotification('Error al eliminar método de pago', 'error')
      return
    }
  }

  form.value.payments.splice(index, 1)

  const newMap = new Map()
  paymentIdMap.value.forEach((id, mapIndex) => {
    if (mapIndex < index) {
      newMap.set(mapIndex, id)
    } else if (mapIndex > index) {
      newMap.set(mapIndex - 1, id)
    }
  })
  paymentIdMap.value = newMap
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
    scrollable
    :model-value="props.modelValue"
    max-width="920"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <VCard class="rounded-xl overflow-hidden elevation-10 d-flex flex-column" style="max-height: 90vh;">
      <!-- Header Banner Fijo -->
      <VCardTitle class="pa-4 bg-primary text-white d-flex align-center justify-space-between flex-none">
        <div class="d-flex align-center gap-3">
          <VAvatar
            color="white"
            variant="tonal"
            size="38"
            rounded="lg"
          >
            <VIcon
              icon="ri-indeterminate-circle-line"
              color="white"
              size="22"
            />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold text-white leading-tight">
              {{ props.editingMovement ? 'Editar Egreso' : 'Nuevo Egreso' }}
            </div>
            <div class="text-caption text-white opacity-80" style="font-size: 11px;">
              Registra o modifica un egreso financiero en el sistema
            </div>
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          color="white"
          @click="closeDialog"
        />
      </VCardTitle>

      <!-- Cuerpo del Formulario con Scroll Interno -->
      <VCardText class="pa-5 overflow-y-auto" style="flex: 1 1 auto; max-height: calc(90vh - 140px);">
        <!-- Skeleton Loader mientras cargan datos -->
        <div v-if="isLoadingData" class="py-2">
          <VRow>
            <VCol cols="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="12"><VSkeletonLoader type="article" class="rounded-lg" /></VCol>
          </VRow>
        </div>

        <VForm v-else ref="formRef" @submit.prevent="saveExpense">
          <VRow dense>
            <VCol cols="12" md="6">
              <VTextField
                v-model="form.invoice_number"
                label="Número de Factura / Código"
                placeholder="EGR-001"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-hashtag"
              />
            </VCol>

            <VCol cols="12" md="6">
              <VTextField
                v-model="form.entry_date"
                label="Fecha *"
                type="date"
                required
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-calendar-line"
              />
            </VCol>

            <VCol cols="12">
              <VTextField
                v-model="form.description"
                label="Descripción *"
                placeholder="Describe el motivo del egreso..."
                required
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-file-text-line"
              />
            </VCol>
          </VRow>

          <!-- Sección Métodos de Pago -->
          <div class="mt-4">
            <div class="d-flex justify-space-between align-center mb-2">
              <span class="text-subtitle-2 font-weight-bold text-high-emphasis d-flex align-center gap-1">
                <VIcon icon="ri-bank-card-line" size="18" color="primary" />
                Métodos de Pago / Cuentas Origen
              </span>
              <VBtn
                size="x-small"
                variant="tonal"
                color="primary"
                prepend-icon="ri-add-line"
                :disabled="!canAddMorePayments"
                @click="addPayment"
              >
                Agregar Cuenta
              </VBtn>
            </div>

            <!-- Lista de Métodos de Pago -->
            <div
              v-for="(payment, index) in form.payments"
              :key="index"
              class="mb-2"
            >
              <VCard
                variant="outlined"
                class="pa-3 rounded-lg bg-grey-lighten-5 border"
              >
                <VRow dense class="align-center">
                  <VCol cols="12" sm="6">
                    <VSelect
                      v-model="payment.account_id"
                      :items="accountOptions"
                      item-title="title"
                      item-value="value"
                      label="Cuenta Origen *"
                      placeholder="Seleccionar cuenta..."
                      variant="outlined"
                      density="compact"
                      hide-details
                      required
                    />
                  </VCol>
                  <VCol cols="10" sm="5">
                    <VTextField
                      v-model="payment.amount"
                      label="Monto *"
                      type="number"
                      prefix="$"
                      placeholder="0.00"
                      variant="outlined"
                      density="compact"
                      hide-details
                      required
                    />
                  </VCol>
                  <VCol cols="2" sm="1" class="text-center">
                    <VBtn
                      icon="ri-delete-bin-line"
                      size="x-small"
                      variant="text"
                      color="error"
                      :disabled="form.payments.length <= 1"
                      @click="removePayment(index)"
                    />
                  </VCol>
                </VRow>
              </VCard>
            </div>
          </div>

          <!-- Total a Registrar Alert -->
          <VAlert
            type="info"
            variant="tonal"
            class="mt-3 py-2 px-3 rounded-lg"
          >
            <div class="d-flex align-center justify-space-between">
              <span class="d-flex align-center gap-1 font-weight-medium">
                <VIcon icon="ri-calculator-line" size="18" />
                Total a Registrar:
              </span>
              <span class="text-h6 font-weight-extrabold text-primary">
                {{ formatCurrency(totalToRegister) }}
              </span>
            </div>
          </VAlert>

          <!-- Foto / Comprobante de Respaldo -->
          <div class="mt-4">
            <ReceiptUploader
              v-model="receiptFiles"
              label="Foto / Comprobante de Respaldo del Egreso"
              hint="Adjunta foto del dinero entregado, factura física, nota de venta o comprobante (Obligatorio)"
              required
              :max-files="5"
              @error="msg => showNotification(msg, 'error')"
            />
          </div>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Footer Fijo de Acciones -->
      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-grey-lighten-5 flex-none">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-5 font-weight-medium"
          height="38"
          :disabled="props.isSaving"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          :prepend-icon="props.editingMovement ? 'ri-refresh-line' : 'ri-save-3-line'"
          class="rounded-lg px-6 font-weight-bold"
          height="38"
          :loading="props.isSaving"
          :disabled="props.isSaving || totalToRegister <= 0 || (!props.editingMovement && receiptFiles.length === 0)"
          @click="saveExpense"
        >
          {{ props.editingMovement ? 'Actualizar Egreso' : 'Guardar Egreso' }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
