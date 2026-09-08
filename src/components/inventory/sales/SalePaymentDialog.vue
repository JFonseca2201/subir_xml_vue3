<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  sale: {
    type: Object,
    default: null,
  },
  paymentMethodOptions: {
    type: Array,
    default: () => [
      { title: 'Efectivo', value: 'efectivo' },
      { title: 'Tarjeta', value: 'tarjeta' },
      { title: 'Transferencia', value: 'transferencia' },
      { title: 'Cheque', value: 'cheque' },
    ],
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'payment-registered',
])

const { showNotification } = useGlobalToast()

const isSubmitting = ref(false)
const paymentForm = ref({
  payment_method: 'efectivo',
  convert_to_invoice: false,
})

watch(() => props.isDialogVisible, val => {
  if (val) {
    paymentForm.value = {
      payment_method: 'efectivo',
      convert_to_invoice: false,
    }
  }
})

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const closeDialog = () => {
  if (isSubmitting.value) return
  emit('update:isDialogVisible', false)
}

const registerPayment = async () => {
  if (!props.sale?.id) return

  isSubmitting.value = true
  try {
    const response = await $api(`sales/${props.sale.id}/register-payment`, {
      method: 'POST',
      body: paymentForm.value,
    })

    if (response?.success) {
      showNotification('Pago registrado correctamente', 'success')
      emit('payment-registered', response)
      closeDialog()
    } else {
      showNotification(response?.message || 'Error al registrar el pago', 'error')
    }
  } catch (error) {
    console.error('Error al registrar pago:', error)
    showNotification('Error al registrar el pago', 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="isDialogVisible"
    scrollable
    max-width="450"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="isSubmitting"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-secure-payment-line" />
        </div>
        <h3 class="custom-dialog-title">
          Registrar Pago
        </h3>
        <p class="custom-dialog-subtitle">
          Selecciona el método de pago para la venta
        </p>
      </div>

      <VCardText class="pa-4">
        <div class="mb-4">
          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-body-2 text-medium-emphasis">Documento:</span>
            <span class="font-weight-medium text-grey-darken-4">{{ sale?.document_number }}</span>
          </div>
          <div class="d-flex justify-space-between align-center">
            <span class="text-body-2 text-medium-emphasis">Total a Pagar:</span>
            <span class="text-subtitle-1 font-weight-bold text-success">
              {{ formatCurrency(sale?.total) }}
            </span>
          </div>
        </div>

        <VSelect
          v-model="paymentForm.payment_method"
          :items="paymentMethodOptions"
          item-title="title"
          item-value="value"
          label="Método de Pago"
          variant="outlined"
          density="compact"
          color="primary"
          class="mb-2"
          :disabled="isSubmitting"
        />

        <VCheckbox
          v-model="paymentForm.convert_to_invoice"
          label="Convertir a Factura"
          class="mt-2"
          color="primary"
          density="compact"
          hide-details
          :disabled="isSubmitting"
        />
      </VCardText>

      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="isSubmitting"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-check-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="isSubmitting"
          @click="registerPayment"
        >
          Confirmar Pago
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
