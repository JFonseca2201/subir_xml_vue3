<script setup>
import { computed } from 'vue'
import { copyToClipboard } from '@/utils/clipboard'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getApiBaseUrl } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  saleData: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const { showNotification } = useGlobalToast()

const sale = computed(() => props.saleData || {})
const client = computed(() => sale.value.client || {})

const cancellationReason = computed(() => {
  return (
    sale.value.cancellation_reason ||
    sale.value.motivo_anulacion ||
    sale.value.anulacion_motivo ||
    ''
  ).trim()
})

const accessKey = computed(() => {
  return (
    sale.value.sri_access_key ||
    sale.value.access_key ||
    sale.value.clave_acceso ||
    ''
  ).trim()
})

const clientFullName = computed(() => {
  if (!client.value) return 'Consumidor Final'
  return (
    client.value.full_name ||
    client.value.name ||
    `${client.value.first_name || ''} ${client.value.last_name || ''}`.trim() ||
    'Consumidor Final'
  )
})

const clientDocument = computed(() => {
  return client.value.n_document || client.value.dni || client.value.identification || ''
})

const clientEmail = computed(() => {
  return client.value.email || client.value.correo || ''
})

const formatDocumentNumber = num => {
  if (!num) return 'S/N'
  const clean = String(num).replace(/[^0-9]/g, '')
  if (!clean) return String(num)
  const val = parseInt(clean, 10)
  if (isNaN(val)) return String(num)
  return '#' + String(val).padStart(6, '0')
}

const copyData = async (text, label) => {
  if (!text) {
    showNotification(`No hay ${label.toLowerCase()} disponible para copiar`, 'warning')
    return
  }
  const ok = await copyToClipboard(text)
  if (ok) {
    showNotification(`${label} copiado al portapapeles`, 'success')
  } else {
    showNotification(`No se pudo copiar el ${label.toLowerCase()}`, 'error')
  }
}

const downloadRide = () => {
  if (!sale.value?.id) return
  const token = localStorage.getItem('token')
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
  window.open(`${apiBaseUrl}/sales/${sale.value.id}/ride?token=${token}`, '_blank')
}
</script>

<template>
  <VDialog :model-value="props.isDialogVisible" max-width="650" scrollable
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="custom-dialog-card elevation-10">
      <!-- Header Banner Estándar del Sistema (Alineado 100% al Tema Activo) -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn"
          @click="emit('update:isDialogVisible', false)" />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-file-close-line" />
        </div>
        <h3 class="custom-dialog-title">
          Factura Anulada
        </h3>
        <p class="custom-dialog-subtitle">
          {{ formatDocumentNumber(sale.document_number || sale.id) }} · {{ clientFullName }}
        </p>
      </div>

      <!-- Contenido Simple, Completo y Fácil de Copiar -->
      <VCardText class="pa-4 pa-sm-5">
        <div v-if="props.loading" class="py-8 text-center">
          <VProgressCircular indeterminate color="primary" size="40" class="mb-2" />
          <div class="text-caption text-medium-emphasis">Cargando datos...</div>
        </div>

        <div v-else class="d-flex flex-column gap-3.5">
          <!-- 1. Motivo de Anulación (Siempre Visible y con Botón Copiar) -->
          <div class="reason-box pa-3.5 rounded-xl border d-flex align-start justify-space-between gap-3">
            <div class="d-flex align-start gap-2.5 min-w-0 flex-grow-1">
              <VAvatar color="error" variant="tonal" size="28" rounded="sm" class="flex-shrink-0 mt-0.5">
                <VIcon icon="ri-chat-delete-line" color="error" size="16" />
              </VAvatar>
              <div class="min-w-0 flex-grow-1">
                <span class="text-caption font-weight-bold text-error text-uppercase tracking-wider d-block">
                  Motivo de Anulación
                </span>
                <p class="text-body-2 font-weight-bold text-high-emphasis mb-0 mt-1" style="white-space: pre-wrap;">
                  {{ cancellationReason || 'Sin motivo específico registrado al momento de anular.' }}
                </p>
              </div>
            </div>

            <VBtn v-if="cancellationReason" size="small" color="error" variant="tonal" prepend-icon="ri-file-copy-line"
              class="font-weight-bold flex-shrink-0" @click="copyData(cancellationReason, 'Motivo de anulación')">
              Copiar
            </VBtn>
          </div>

          <!-- 2. Clave de Acceso SRI (49 Dígitos) (Copiar) -->
          <div class="copy-field-card pa-3 rounded-xl border">
            <div class="d-flex align-center justify-space-between mb-1.5 flex-wrap gap-1">
              <div class="d-flex align-center gap-1.5">
                <span class="text-caption text-medium-emphasis font-weight-medium">
                  Clave de Acceso SRI
                </span>
                <span v-if="accessKey" class="text-caption text-disabled font-mono">
                  ({{ accessKey.length }} dígitos)
                </span>
              </div>

              <!-- Status Pill estándar -->
              <div v-if="sale.sri_status" class="status-pill-clean"
                :class="sale.sri_status === 'AUTORIZADA' ? 'status-paid' : 'status-pending'">
                <span class="status-dot" />
                <span>SRI {{ sale.sri_status }}</span>
              </div>
            </div>

            <div v-if="accessKey" class="d-flex align-center justify-space-between gap-2 mt-1">
              <span class="font-mono text-body-2 font-weight-bold text-high-emphasis flex-grow-1 text-break"
                style="letter-spacing: 0.8px; word-break: break-all; line-height: 1.45;">
                {{ accessKey }}
              </span>
              <VBtn size="small" color="primary" variant="tonal" prepend-icon="ri-file-copy-line"
                class="font-weight-bold flex-shrink-0 ms-2" @click="copyData(accessKey, 'Clave SRI')">
                Copiar
              </VBtn>
            </div>
            <div v-else class="text-caption text-medium-emphasis font-italic py-1">
              No cuenta con clave de acceso electrónica registrada.
            </div>
          </div>

          <!-- 3. Documento y Mail en una sola fila (dos columnas) -->
          <VRow density="compact" class="ma-0">
            <!-- Documento (RUC / Cédula) -->
            <VCol cols="12" sm="6" class="pa-1">
              <div class="copy-field-card pa-3 rounded-xl border d-flex align-center justify-space-between gap-2 h-100">
                <div class="min-w-0 flex-grow-1">
                  <span class="text-caption text-medium-emphasis d-block font-weight-medium">
                    RUC / Cédula
                  </span>
                  <span class="font-mono font-weight-bold text-body-1 text-high-emphasis text-truncate d-block">
                    {{ clientDocument || '9999999999999 (Consumidor Final)' }}
                  </span>
                </div>
                <VBtn size="small" color="primary" variant="tonal" prepend-icon="ri-file-copy-line"
                  class="font-weight-bold flex-shrink-0" :disabled="!clientDocument"
                  @click="copyData(clientDocument, 'Documento')">

                </VBtn>
              </div>
            </VCol>

            <!-- Correo Electrónico (Mail) -->
            <VCol cols="12" sm="6" class="pa-1">
              <div class="copy-field-card pa-3 rounded-xl border d-flex align-center justify-space-between gap-2 h-100">
                <div class="min-w-0 flex-grow-1">
                  <span class="text-caption text-medium-emphasis d-block font-weight-medium">
                    Correo Electrónico
                  </span>
                  <span class="font-weight-bold text-body-2 text-high-emphasis text-truncate d-block"
                    :title="clientEmail">
                    {{ clientEmail || 'Sin correo registrado' }}
                  </span>
                </div>
                <VBtn size="small" color="primary" variant="tonal" prepend-icon="ri-file-copy-line"
                  class="font-weight-bold flex-shrink-0" :disabled="!clientEmail"
                  @click="copyData(clientEmail, 'Correo')">

                </VBtn>
              </div>
            </VCol>
          </VRow>
        </div>
      </VCardText>

      <VDivider />

      <!-- Acciones de Cierre -->
      <VCardActions class="pa-3 px-4 d-flex justify-end gap-2 bg-surface">


        <VBtn color="secondary" variant="outlined" class="font-weight-bold px-5 rounded-lg"
          @click="emit('update:isDialogVisible', false)">
          <VIcon icon="ri-close-line" size="small" class="me-1" /> Cerrar
        </VBtn>

        <VBtn v-if="sale.sri_status === 'AUTORIZADA' || sale.pdf_path" size="small" color="primary" variant="elevated"
          prepend-icon="ri-file-shield-2-line" @click="downloadRide">
          RIDE SRI
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.reason-box {
  background-color: rgba(var(--v-theme-error), 0.07);
  border-color: rgba(var(--v-theme-error), 0.25) !important;
}

.copy-field-card {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
  border-color: rgba(var(--v-theme-on-surface), 0.08) !important;
  transition: border-color 0.2s ease;
}

.copy-field-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.3) !important;
}
</style>
