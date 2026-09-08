<script setup>
import { ref, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  saleSelected: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'mail-sent',
])

const { showNotification } = useGlobalToast()
const isMailSending = ref(false)

const getClientName = client => {
  if (!client) return 'Cliente no disponible'
  return client.full_name || `${client.name || ''} ${client.surname || ''}`.trim() || client.n_document || 'Cliente sin nombre'
}

const getDocumentTypeInfo = type => {
  const map = {
    invoice: { color: 'primary', text: 'Factura' },
    quote: { color: 'info', text: 'Cotización' },
    sale_note: { color: 'warning', text: 'Nota de Venta' },
  }
  return map[type] || { color: 'grey', text: type || 'Documento' }
}

const closeDialog = () => {
  if (isMailSending.value) return
  emit('update:isDialogVisible', false)
}

const confirmSendMail = async () => {
  if (!props.saleSelected?.id) return

  isMailSending.value = true
  try {
    const isInvoice = props.saleSelected.document_type === 'invoice'
    const endpoint = isInvoice
      ? `sales/${props.saleSelected.id}/sri/enviar-email`
      : `sales/${props.saleSelected.id}/enviar-cotizacion`

    const response = await $api(endpoint, { method: 'POST' })
    if (response?.success) {
      showNotification(response.message || 'Factura y comprobantes enviados exitosamente por correo.', 'success')
      emit('mail-sent', response)
      closeDialog()
    } else {
      showNotification(response?.message || 'Error al despachar el correo.', 'error')
    }
  } catch (error) {
    console.error('Error al enviar correo:', error)
    showNotification('Error al despachar el correo.', 'error')
  } finally {
    isMailSending.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="isDialogVisible"
    scrollable
    max-width="480"
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
          :disabled="isMailSending"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-mail-send-line" />
        </div>
        <h3 class="custom-dialog-title">
          Confirmar Envío
        </h3>
        <p class="custom-dialog-subtitle">
          Se enviará el documento por correo electrónico
        </p>
      </div>

      <VCardText class="pa-6">
        <div class="text-center mb-6">
          <p class="text-body-2 text-medium-emphasis mb-2">
            ¿Estás seguro de enviar este documento a:
          </p>
          <div class="text-h6 font-weight-bold text-grey-darken-4 mb-1">
            {{ getClientName(saleSelected?.client) }}
          </div>
          <div
            class="d-flex align-center justify-center text-body-2"
            :class="saleSelected?.client?.email ? 'text-medium-emphasis' : 'text-error font-weight-medium'"
          >
            <VIcon
              :icon="saleSelected?.client?.email ? 'ri-mail-line' : 'ri-error-warning-line'"
              size="16"
              class="mr-2"
            />
            {{ saleSelected?.client?.email || 'El cliente no tiene correo registrado' }}
          </div>
        </div>

        <!-- Tarjeta interna de detalles -->
        <VCard
          variant="tonal"
          color="primary"
          class="rounded-lg border-opacity-25"
        >
          <VCardText class="pa-4 d-flex justify-space-between align-center">
            <div class="d-flex flex-column">
              <span
                class="text-caption font-weight-bold text-primary text-uppercase mb-1"
                style="letter-spacing: 0.5px;"
              >Documento</span>
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="ri-file-text-line"
                  size="18"
                  color="primary"
                />
                <span class="font-weight-bold text-grey-darken-4 text-subtitle-1">
                  {{ saleSelected?.document_number }}
                </span>
              </div>
            </div>
            <div class="text-right">
              <VChip
                size="small"
                :color="getDocumentTypeInfo(saleSelected?.document_type)?.color"
                variant="elevated"
                elevation="1"
                class="font-weight-medium text-capitalize px-3"
              >
                {{ getDocumentTypeInfo(saleSelected?.document_type)?.text }}
              </VChip>
            </div>
          </VCardText>
        </VCard>
      </VCardText>

      <VDivider class="border-opacity-25" />

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
          :disabled="isMailSending"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-send-plane-fill"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="isMailSending"
          :disabled="!saleSelected?.client?.email"
          @click="confirmSendMail"
        >
          Enviar Ahora
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
