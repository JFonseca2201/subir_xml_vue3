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
  <VDialog scrollable
    v-model="props.isDialogVisible"
    max-width="550"
    persistent
  >
    <VCard class="custom-dialog-card elevation-15">
      <!-- Overlay para bloquear la pantalla si está eliminando -->
      <VOverlay
        :model-value="loader.loading"
        class="align-center justify-center"
        contained
        persistent
      >
        <VProgressCircular
          color="white"
          indeterminate
          size="64"
        />
      </VOverlay>

      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="loader.loading"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-file-search-line" />
        </div>
        <h3 class="custom-dialog-title">
          Anular Factura
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción revertirá la factura comercial de compra
        </p>
      </div>

      <VCardText class="text-center pb-6">
        <p class="text-body-1 mb-2">
          Estás a punto de eliminar la factura <strong>{{ props.invoiceSelected.invoice_number }}</strong> del proveedor <strong>{{ props.invoiceSelected.supplier?.name || props.invoiceSelected.supplier?.trade_name }}</strong>.
        </p>
        
        <VAlert
          type="warning"
          variant="tonal"
          class="text-left mt-4"
        >
          <div class="text-subtitle-2 font-weight-bold mb-1">
            Impacto de esta acción:
          </div>
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

      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loader.loading"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loader.loading"
          @click="deleteInvoice"
        >
          Sí, Eliminar Factura
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
