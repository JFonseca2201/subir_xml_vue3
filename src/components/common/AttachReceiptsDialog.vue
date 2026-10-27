<script setup>
import { ref, watch, onMounted } from 'vue'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import ReceiptUploader from '@/components/common/ReceiptUploader.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  attachableType: {
    type: String,
    required: true, // 'sale', 'work_order', 'expense', 'invoice', etc.
  },
  attachableId: {
    type: [Number, String],
    required: true,
  },
  title: {
    type: String,
    default: 'Comprobantes y Soportes de Pago',
  },
  identifier: {
    type: String,
    default: '',
  },
  partyName: {
    type: String,
    default: '',
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'updated'])

const { showNotification } = useGlobalToast()

const isLoading = ref(false)
const isSaving = ref(false)
const existingAttachments = ref([])
const newFiles = ref([])

// Cargar adjuntos existentes desde el backend
const fetchAttachments = async () => {
  if (!props.attachableId && !props.identifier) return

  isLoading.value = true
  try {
    const params = {
      attachable_type: props.attachableType || 'expense',
      attachable_id: props.attachableId || 0,
    }

    if (props.identifier) {
      params.identifier = props.identifier
    }

    const res = await $api('attachments', {
      method: 'GET',
      params,
    })

    if (res && res.status === 'success') {
      existingAttachments.value = res.data || []
    }
  } catch (error) {
    console.error('Error al cargar comprobantes:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (props.isDialogVisible) {
    fetchAttachments()
  }
})

watch(
  () => [props.isDialogVisible, props.attachableId, props.identifier],
  ([visible, id, ident]) => {
    newFiles.value = []
    if (visible && (id || ident)) {
      existingAttachments.value = []
      fetchAttachments()
    } else {
      existingAttachments.value = []
    }
  },
  { immediate: true },
)

const closeDialog = () => {
  emit('update:isDialogVisible', false)
  newFiles.value = []
  existingAttachments.value = []
}

// Guardar nuevos comprobantes
const saveReceipts = async () => {
  if (newFiles.value.length === 0) {
    showNotification('No has seleccionado nuevos comprobantes para subir', 'warning')
    
    return
  }

  isSaving.value = true
  try {
    const formData = new FormData()

    formData.append('attachable_type', props.attachableType)
    formData.append('attachable_id', props.attachableId)
    if (props.identifier) formData.append('identifier', props.identifier)
    if (props.partyName) formData.append('party_name', props.partyName)

    newFiles.value.forEach(file => {
      formData.append('receipts[]', file)
    })

    const res = await $api('attachments/upload', {
      method: 'POST',
      body: formData,
    })

    if (res && res.status === 'success') {
      showNotification(res.message || 'Comprobantes guardados exitosamente', 'success')
      newFiles.value = []
      await fetchAttachments()
      emit('updated', existingAttachments.value)
    }
  } catch (error) {
    console.error('Error al subir comprobantes:', error)
    showNotification('Error al guardar los comprobantes', 'error')
  } finally {
    isSaving.value = false
  }
}

// Eliminar un adjunto existente
const deleteAttachment = async attachment => {
  if (!confirm(`¿Estás seguro de eliminar el comprobante "${attachment.file_name}"?`)) {
    return
  }

  try {
    const res = await $api(`attachments/${attachment.id}`, {
      method: 'DELETE',
    })

    if (res && res.status === 'success') {
      showNotification('Comprobante eliminado', 'success')
      await fetchAttachments()
      emit('updated', existingAttachments.value)
    }
  } catch (error) {
    console.error('Error al eliminar:', error)
    showNotification('Error al eliminar el comprobante', 'error')
  }
}

const getFullUrl = path => {
  if (!path) return ''
  let raw = ''
  if (typeof path === 'object' && path !== null) {
    raw = path.file_path || path.url || ''
  } else {
    raw = String(path)
  }
  if (!raw) return ''

  let cleanPath = raw
  if (cleanPath.includes('/storage/')) {
    cleanPath = cleanPath.substring(cleanPath.indexOf('/storage/') + '/storage/'.length)
  } else {
    cleanPath = cleanPath.replace(/^\/?storage\/?/, '')
  }

  cleanPath = cleanPath.replace(/^https?:\/\/[^\/]+\/storage\//, '')
  cleanPath = cleanPath.replace(/^\/+/, '')

  const apiBase = getApiBaseUrl().replace(/\/api\/?$/, '')
  const encodedSegments = cleanPath.split('/').map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/')

  return `${apiBase}/storage/${encodedSegments}`
}

const openAttachment = att => {
  const url = att?.url || getFullUrl(att?.file_path)
  if (url) window.open(url, '_blank')
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="580"
    :fullscreen="$vuetify.display.smAndDown"
    scrollable
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="rounded-lg overflow-hidden elevation-10">
      <!-- Header Banner -->
      <VCardTitle class="d-flex align-center justify-space-between bg-primary text-white pa-4">
        <div class="d-flex align-center gap-2">
          <VIcon icon="ri-folder-shield-2-line" />
          <div>
            <div class="text-subtitle-1 font-weight-bold text-white">
              {{ title }}
            </div>
            <div
              v-if="identifier || partyName"
              class="text-caption text-white opacity-80"
            >
              {{ identifier }} {{ partyName ? '— ' + partyName : '' }}
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

      <VCardText class="pa-5">
        <!-- Sección 1: Subir Nuevos Comprobantes (Modo Edición / Adjuntar) -->
        <template v-if="!props.readOnly">
          <div class="mb-5">
            <ReceiptUploader
              v-model="newFiles"
              label="Adjuntar Nuevos Comprobantes"
              hint="Arrastra o toma foto del comprobante de transferencia / depósito"
              :disabled="isSaving"
              @error="msg => showNotification(msg, 'error')"
            />
          </div>
          <VDivider class="my-5" />
        </template>

        <!-- Sección 2: Comprobantes Ya Guardados en el Servidor -->
        <div>
          <div class="d-flex align-center justify-space-between mb-3">
            <span class="text-subtitle-2 font-weight-bold text-high-emphasis d-flex align-center gap-1">
              <VIcon
                icon="ri-check-double-line"
                size="18"
                color="success"
              />
              Archivos Guardados en Servidor
            </span>
            <VChip
              size="x-small"
              color="success"
              variant="tonal"
              class="font-weight-bold"
            >
              {{ existingAttachments.length }} archivo(s)
            </VChip>
          </div>

          <div
            v-if="isLoading"
            class="py-3"
          >
            <VRow dense>
              <VCol cols="6">
                <VSkeletonLoader
                  type="card"
                  height="120"
                  class="rounded-lg"
                />
              </VCol>
              <VCol cols="6">
                <VSkeletonLoader
                  type="card"
                  height="120"
                  class="rounded-lg"
                />
              </VCol>
            </VRow>
          </div>

          <div
            v-else-if="existingAttachments.length === 0"
            class="empty-attachments-box pa-5 text-center rounded-lg border border-dashed"
          >
            <VIcon
              icon="ri-file-cloud-line"
              size="38"
              class="mb-2 empty-box-icon"
            />
            <div class="text-body-2 font-weight-medium empty-box-text">
              No hay comprobantes guardados todavía para este registro.
            </div>
            <div class="text-caption empty-box-subtext mt-1">
              Los comprobantes guardados aparecerán aquí para consultarlos o descargarlos
            </div>
          </div>

          <!-- Grid de Archivos Existentes -->
          <div
            v-else
            class="existing-grid"
          >
            <div
              v-for="att in existingAttachments"
              :key="att.id"
              class="existing-card elevation-1"
            >
              <!-- Imagen Thumbnail -->
              <div
                v-if="att.is_image"
                class="existing-media"
                @click="openAttachment(att)"
              >
                <img
                  :src="getFullUrl(att.file_path)"
                  :alt="att.file_name"
                  class="existing-img"
                >
                <div class="existing-overlay">
                  <VIcon
                    icon="ri-external-link-line"
                    color="white"
                    size="18"
                  />
                </div>
              </div>

              <!-- PDF Thumbnail -->
              <div
                v-else-if="att.is_pdf"
                class="existing-media pdf-media"
                @click="openAttachment(att)"
              >
                <VIcon
                  icon="ri-file-pdf-2-fill"
                  size="36"
                  color="error"
                />
                <span class="pdf-tag">PDF</span>
              </div>

              <!-- General Media -->
              <div
                v-else
                class="existing-media"
                @click="openAttachment(att)"
              >
                <VIcon
                  icon="ri-file-3-line"
                  size="32"
                  color="primary"
                />
              </div>

              <!-- Info -->
              <div class="existing-info pa-2">
                <div
                  class="text-caption font-weight-medium text-truncate text-high-emphasis"
                  :title="att.file_name"
                >
                  {{ att.file_name }}
                </div>
                <div class="d-flex align-center justify-space-between text-caption text-disabled mt-1">
                  <span style="font-size: 10px;">{{ att.created_at ? new Date(att.created_at).toLocaleDateString() : '' }}</span>
                  <div class="d-flex gap-1">
                    <VBtn
                      icon="ri-download-2-line"
                      size="x-small"
                      variant="text"
                      color="primary"
                      title="Descargar"
                      @click.stop="openAttachment(att)"
                    />
                    <VBtn
                      v-if="!props.readOnly"
                      icon="ri-delete-bin-line"
                      size="x-small"
                      variant="text"
                      color="error"
                      title="Eliminar"
                      @click.stop="deleteAttachment(att)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 d-flex justify-space-between align-center">
        <VBtn
          color="secondary"
          variant="outlined"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>

        <VBtn
          v-if="!props.readOnly && newFiles.length > 0"
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-3-line"
          :loading="isSaving"
          @click="saveReceipts"
        >
          Guardar Comprobantes ({{ newFiles.length }})
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.empty-attachments-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.16) !important;
  transition: all 0.25s ease;
}

.empty-box-icon {
  color: rgba(255, 255, 255, 0.40);
}

.empty-box-text {
  color: rgba(255, 255, 255, 0.85);
}

.empty-box-subtext {
  color: rgba(255, 255, 255, 0.45);
}

:global([data-theme="light"]) .empty-attachments-box,
:global(.v-theme--light) .empty-attachments-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1 !important;
}

:global([data-theme="light"]) .empty-box-icon,
:global(.v-theme--light) .empty-box-icon {
  color: #94a3b8;
}

:global([data-theme="light"]) .empty-box-text,
:global(.v-theme--light) .empty-box-text {
  color: #334155;
}

:global([data-theme="light"]) .empty-box-subtext,
:global(.v-theme--light) .empty-box-subtext {
  color: #64748b;
}

.existing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

.existing-card {
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.existing-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}

:global([data-theme="light"]) .existing-card,
:global(.v-theme--light) .existing-card {
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
}

.existing-media {
  height: 85px;
  width: 100%;
  background: rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

:global([data-theme="light"]) .existing-media,
:global(.v-theme--light) .existing-media {
  background: #f8fafc;
}

.existing-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.existing-media:hover .existing-img {
  transform: scale(1.06);
}

.existing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.existing-media:hover .existing-overlay {
  opacity: 1;
}

.pdf-media {
  background: rgba(239, 68, 68, 0.12);
  flex-direction: column;
  gap: 2px;
}

:global([data-theme="light"]) .pdf-media,
:global(.v-theme--light) .pdf-media {
  background: #fef2f2;
}

.pdf-tag {
  font-size: 9px;
  font-weight: 800;
  color: #ef4444;
  letter-spacing: 0.5px;
}

:global([data-theme="light"]) .pdf-tag,
:global(.v-theme--light) .pdf-tag {
  color: #dc2626;
}

.existing-info {
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

:global([data-theme="light"]) .existing-info,
:global(.v-theme--light) .existing-info {
  background: #ffffff;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
