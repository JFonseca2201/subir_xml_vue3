<script setup>
import { ref, computed, watch } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

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
  'creditNoteCreated',
])

const { showNotification } = useGlobalToast()

const isSubmitting = ref(false)
const reasonType = ref('ANULACIÓN TOTAL DE FACTURA')
const customReason = ref('')
const restoreStock = ref(true)
const reverseBalance = ref(true)

const reasonOptions = [
  'ANULACIÓN TOTAL DE FACTURA',
  'DEVOLUCIÓN DE MERCADERÍA / REPUESTOS',
  'ERROR EN DATOS DEL CLIENTE',
  'DESCUENTO POSTERIOR',
  'OTRO MOTIVO',
]

const finalReason = computed(() => {
  if (reasonType.value === 'OTRO MOTIVO') {
    return customReason.value.trim()
  }
  return reasonType.value
})

watch(() => props.isDialogVisible, (newVal) => {
  if (newVal) {
    reasonType.value = 'ANULACIÓN TOTAL DE FACTURA'
    customReason.value = ''
    restoreStock.value = true
    reverseBalance.value = true
  }
})

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const getClientName = computed(() => {
  if (!props.saleSelected?.client) return 'Cliente no disponible'
  return props.saleSelected.client.full_name || props.saleSelected.client.name || 'Cliente sin nombre'
})

const closeDialog = () => {
  if (isSubmitting.value) return
  emit('update:isDialogVisible', false)
}

const submitCreditNote = async () => {
  if (!props.saleSelected?.id) return

  if (!finalReason.value) {
    showNotification('Por favor ingrese el motivo de la Nota de Crédito', 'warning')
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      sale_id: props.saleSelected.id,
      reason: finalReason.value,
      restore_stock: restoreStock.value,
      reverse_balance: reverseBalance.value,
    }

    const response = await $api('credit-notes', {
      method: 'POST',
      body: payload,
    })

    if (response?.success) {
      showNotification(response.message || 'Nota de Crédito emitida y procesada ante el SRI exitosamente', 'success')
      emit('creditNoteCreated', response.data)
      emit('update:isDialogVisible', false)
    } else {
      showNotification(response?.message || 'Error al emitir Nota de Crédito', 'error')
    }
  } catch (error) {
    console.error('Error al emitir Nota de Crédito:', error)
    const msg = error?.data?.message || (error?.data?.errors ? Object.values(error.data.errors).flat().join(', ') : 'Error al procesar la Nota de Crédito ante el SRI')
    showNotification(msg, 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="620px"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="rounded-xl overflow-hidden shadow-2xl">
      <!-- Encabezado con estilo de alerta / comprobante -->
      <div class="bg-gradient-to-r from-red-600 to-rose-700 pa-5 text-white d-flex align-center gap-3">
        <div class="pa-2 bg-white bg-opacity-20 rounded-lg">
          <VIcon icon="ri-refund-2-line" size="28" color="white" />
        </div>
        <div>
          <h3 class="text-h6 font-weight-bold text-white mb-0">
            Emitir Nota de Crédito Electrónica
          </h3>
          <span class="text-caption text-white text-opacity-90">
            Comprobante Tributario Oficial SRI (Tipo 04)
          </span>
        </div>
      </div>

      <VCardText class="pa-5">
        <!-- Resumen de la Factura -->
        <VCard variant="tonal" color="grey-lighten-4" class="pa-4 mb-4 rounded-lg border border-slate-200">
          <div class="d-flex justify-space-between align-center mb-2">
            <span class="text-caption font-weight-bold text-slate-600 text-uppercase">Factura a Modificar / Anular:</span>
            <VChip size="small" color="primary" variant="flat" class="font-weight-bold">
              FAC {{ props.saleSelected?.document_number }}
            </VChip>
          </div>

          <div class="text-body-2 text-slate-800 mb-1">
            <strong>Cliente:</strong> {{ getClientName }}
            <span class="text-slate-500" v-if="props.saleSelected?.client?.n_document">({{ props.saleSelected.client.n_document }})</span>
          </div>

          <div class="d-flex justify-space-between align-center mt-3 pt-2 border-t border-slate-200">
            <span class="text-caption text-slate-500">Monto Total de la Factura:</span>
            <span class="text-subtitle-1 font-weight-bold text-slate-900">
              {{ formatCurrency(props.saleSelected?.total) }}
            </span>
          </div>

          <div v-if="props.saleSelected?.sri_access_key" class="mt-2 text-caption text-slate-500 font-monospace text-truncate">
            <strong>Clave Factura SRI:</strong> {{ props.saleSelected.sri_access_key }}
          </div>
        </VCard>

        <!-- Formulario -->
        <div class="mb-4">
          <label class="text-caption font-weight-bold text-slate-700 mb-1 d-block">
            Motivo de Emisión ante el SRI *
          </label>
          <VSelect
            v-model="reasonType"
            :items="reasonOptions"
            variant="outlined"
            density="compact"
            class="mb-3"
            hide-details="auto"
          />

          <VTextField
            v-if="reasonType === 'OTRO MOTIVO'"
            v-model="customReason"
            label="Especifique el motivo exacto *"
            variant="outlined"
            density="compact"
            placeholder="Ej: Corrección por acuerdo comercial"
            class="mb-3"
            hide-details="auto"
          />
        </div>

        <!-- Opciones de Reversión Interna -->
        <div class="bg-amber-50 border border-amber-200 pa-3 rounded-lg mb-4">
          <span class="text-caption font-weight-bold text-amber-900 d-block mb-2">
            Ajustes Automáticos en el Sistema:
          </span>
          <VCheckbox
            v-model="restoreStock"
            label="Reintegrar repuestos/productos al stock de inventario"
            density="compact"
            color="warning"
            hide-details
            class="mb-1"
          />
          <VCheckbox
            v-model="reverseBalance"
            label="Revertir el cobro en las cuentas de caja/banco (Balance financiero)"
            density="compact"
            color="warning"
            hide-details
          />
        </div>

        <div class="text-caption text-slate-500 d-flex align-start gap-2">
          <VIcon icon="ri-information-line" size="16" class="text-slate-400 mt-0.5" />
          <span>
            Al confirmar, el sistema generará y firmará digitalmente el XML de Nota de Crédito, enviándolo de inmediato al SRI.
          </span>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-slate-50 d-flex justify-end gap-2">
        <VBtn
          variant="tonal"
          color="secondary"
          :disabled="isSubmitting"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="error"
          variant="flat"
          :loading="isSubmitting"
          prepend-icon="ri-send-plane-fill"
          @click="submitCreditNote"
        >
          Emitir Nota de Crédito SRI
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.font-monospace {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
