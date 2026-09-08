<script setup>
import { computed } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  errorMsg: {
    type: String,
    default: '',
  },
  sale: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'verify-sri',
  'sync-status',
  'resend',
])

const isSriNetworkError = computed(() => {
  if (!props.errorMsg) return false
  const err = props.errorMsg.toLowerCase()
  return (
    err.includes('curl') ||
    err.includes('timeout') ||
    err.includes('timed out') ||
    err.includes('conexión') ||
    err.includes('conexion') ||
    err.includes('503') ||
    err.includes('502') ||
    err.includes('504') ||
    err.includes('fuera de servicio') ||
    err.includes('servidor') ||
    err.includes('connection refused')
  )
})

const isSaleCanceled = computed(() => props.sale?.status === 'canceled')

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const onVerifySri = () => {
  emit('verify-sri')
}

const onSyncStatus = () => {
  if (props.sale) {
    emit('sync-status', props.sale)
    closeDialog()
  }
}

const onResend = () => {
  if (props.sale) {
    emit('resend', props.sale)
    closeDialog()
  }
}
</script>

<template>
  <VDialog :model-value="isDialogVisible" max-width="620"
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="rounded-xl border border-error border-opacity-25 overflow-hidden">
      <VCardItem class="bg-error-lighten-5 pa-4">
        <template #prepend>
          <VIcon icon="ri-alert-line" color="error" size="28" />
        </template>
        <VCardTitle class="text-h6 font-weight-bold text-error">
          Detalle de Respuesta SRI
        </VCardTitle>
        <VCardSubtitle v-if="sale?.document_number" class="text-caption text-medium-emphasis">
          Factura {{ sale.document_number }}
        </VCardSubtitle>
      </VCardItem>

      <VCardText class="pa-5">
        <p class="text-body-2 text-medium-emphasis mb-3">
          El Servicio de Rentas Internas (SRI) retornó la siguiente observación al procesar este comprobante:
        </p>
        <div
          class="bg-grey-lighten-4 pa-4 rounded-lg text-body-2 font-weight-medium text-grey-darken-3 text-wrap font-monospace border mb-4">
          {{ errorMsg || 'Sin detalle de error registrado por el SRI.' }}
        </div>

        <VAlert v-if="isSriNetworkError" type="warning" variant="tonal" border="start" class="rounded-lg">
          <template #prepend>
            <VIcon icon="ri-wifi-off-line" />
          </template>
          <div class="text-caption">
            <strong>Posible Caída del Servidor SRI:</strong> Este error indica problemas de conectividad o tiempo de
            espera
            agotado con los servidores del SRI. Puedes verificar el estado actual de los Web Services y reintentar el
            envío
            una vez que el SRI esté operativo.
          </div>
        </VAlert>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 d-flex justify-space-between flex-wrap gap-2 bg-white">
        <VBtn color="info" variant="tonal" prepend-icon="ri-wifi-line" @click="onVerifySri">
          Verificar Servidores SRI
        </VBtn>

        <div class="d-flex gap-2">
          <VBtn color="secondary" variant="outlined" @click="closeDialog">
            Cerrar
          </VBtn>
          <VBtn v-if="sale && !isSaleCanceled" color="info" variant="tonal" prepend-icon="ri-refresh-line"
            @click="onSyncStatus">
            Consultar Autorización SRI
          </VBtn>
          <VBtn v-if="sale && !isSaleCanceled" color="primary" variant="elevated" prepend-icon="ri-restart-line"
            @click="onResend">
            Reenviar al SRI
          </VBtn>
        </div>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
