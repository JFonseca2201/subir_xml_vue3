<script setup>
import { ref } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  invoiceSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'deleteInvoiceSuccess'])
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()
const error_msg = ref(null)

const onFormReset = () => {
  error_msg.value = null
  emit('update:isDialogVisible', false)
}

const deleteInvoice = async () => {
  error_msg.value = null
  loader.start()
  
  try {
    const resp = await $api('invoices/' + props.invoiceSelected.id, {
      method: 'DELETE',
      onResponseError({ response }) {
        error_msg.value = response._data?.message || 'Error al eliminar la factura'
      },
    })
    
    if (resp && resp.status === 200) {
      showNotification('Factura eliminada con éxito', 'success')
      emit('deleteInvoiceSuccess')
      onFormReset()
    } else if (error_msg.value) {
      showNotification(error_msg.value, 'error')
    }
  } catch (error) {
    console.error(error)
    showNotification(error_msg.value || 'Ocurrió un error inesperado al eliminar', 'error')
  } finally {
    loader.stop()
  }
}
</script>

<template>
  <VDialog
    v-model="props.isDialogVisible"
    max-width="550"
    persistent
  >
    <VCard class="rounded-xl elevation-15">
      <!-- Overlay para bloquear la pantalla si está eliminando -->
      <VOverlay
        :model-value="loader.loading"
        class="align-center justify-center"
        contained
        persistent
      >
        <VProgressCircular
          color="error"
          indeterminate
          size="64"
        />
      </VOverlay>

      <VCardTitle class="text-center pt-6">
        <VIcon
          icon="ri-alert-fill"
          color="error"
          size="48"
          class="mb-3"
        />
        <h3 class="text-h5 font-weight-bold text-error">
          ¿Eliminar Factura?
        </h3>
      </VCardTitle>

      <VCardText class="text-center pb-6">
        <p class="text-body-1 mb-2">
          Estás a punto de eliminar la factura <strong>{{ props.invoiceSelected.invoice_number }}</strong> del proveedor <strong>{{ props.invoiceSelected.supplier?.name || props.invoiceSelected.supplier?.trade_name }}</strong>.
        </p>
        
        <VAlert
          type="warning"
          variant="tonal"
          class="text-left mt-4"
        >
          <div class="text-subtitle-2 font-weight-bold mb-1">Impacto de esta acción:</div>
          <ul class="ml-4">
            <li>Se revertirán las cantidades de stock ingresadas.</li>
            <li>Se anularán los movimientos financieros y se repondrá el saldo.</li>
            <li>Si esta compra es a crédito y tiene <strong>abonos</strong>, no se podrá eliminar.</li>
          </ul>
        </VAlert>

        <VAlert
          v-if="error_msg"
          type="error"
          variant="tonal"
          class="mt-4 text-left"
        >
          {{ error_msg }}
        </VAlert>
      </VCardText>

      <VCardActions class="justify-center pb-6 px-6 gap-3">
        <VBtn
          variant="tonal"
          color="secondary"
          class="px-6 rounded-lg"
          :disabled="loader.loading"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>
        <VBtn
          variant="elevated"
          color="error"
          class="px-6 rounded-lg"
          :loading="loader.loading"
          @click="deleteInvoice"
        >
          Sí, Eliminar Factura
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
