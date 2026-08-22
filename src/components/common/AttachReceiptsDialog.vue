<script setup>
import { ref, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'
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
    if (visible && (id || ident)) {
      newFiles.value = []
      fetchAttachments()
    }
  },
  { immediate: true }
)

const closeDialog = () => {
  emit('update:isDialogVisible', false)
  newFiles.value = []
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
  if (typeof path === 'object' && path.url) return path.url
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const base = isLocal
    ? (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : 'http://127.0.0.1:8000')
    : `http://${hostname}:8000`
  
  const cleanPath = path.replace(/^\/?storage\/?/, '')
  return `${base}/storage/${cleanPath}`
}

const openAttachment = att => {
  const url = att?.url || getFullUrl(att?.file_path)
  if (url) window.open(url, '_blank')
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="700"
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
        <!-- Sección 1: Comprobantes Ya Guardados en el Servidor -->
        <div class="mb-5">
          <div class="d-flex align-center justify-space-between mb-2">
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
            class="text-center py-6"
          >
            <VProgressCircular
              indeterminate
              color="primary"
              size="32"
            />
            <div class="text-caption text-medium-emphasis mt-2">
              Cargando comprobantes...
            </div>
          </div>

          <div
            v-else-if="existingAttachments.length === 0"
            class="empty-attachments-box pa-4 text-center rounded border border-dashed text-medium-emphasis"
          >
            <VIcon
              icon="ri-file-cloud-line"
              size="32"
              class="mb-1 text-disabled"
            />
            <div class="text-caption">
              No hay comprobantes guardados todavía para este registro.
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
                />
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

        <VDivider class="my-4" />

        <!-- Sección 2: Subir Nuevos Comprobantes -->
        <ReceiptUploader
          v-model="newFiles"
          label="Adjuntar Nuevos Comprobantes"
          hint="Arrastra o toma foto del comprobante de transferencia / depósito"
          :disabled="isSaving"
          @error="msg => showNotification(msg, 'error')"
        />
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 d-flex justify-space-between align-center bg-grey-lighten-5">
        <VBtn
          color="secondary"
          variant="outlined"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>

        <VBtn
          v-if="newFiles.length > 0"
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
  background: #f8fafc;
  border-color: #cbd5e1 !important;
}

.existing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

.existing-card {
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.existing-media {
  height: 85px;
  width: 100%;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  overflow: hidden;
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
  background: #fef2f2;
  flex-direction: column;
  gap: 2px;
}

.pdf-tag {
  font-size: 9px;
  font-weight: 800;
  color: #dc2626;
  letter-spacing: 0.5px;
}

.existing-info {
  background: white;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
