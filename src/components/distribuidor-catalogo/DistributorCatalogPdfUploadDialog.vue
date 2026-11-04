<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  suppliers: {
    type: Array,
    default: () => [],
  },
  selectedSupplierId: {
    type: [Number, String, null],
    default: null,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'uploaded'])

const { showNotification } = useGlobalToast()

// Estado del formulario
const selectedSupplier = ref(null)
const catalogTitle = ref('')
const selectedFile = ref(null)
const fileInputRef = ref(null)
const isDragging = ref(false)

// Estados de subida y procesamiento
const isUploading = ref(false)
const uploadProgress = ref(0)
const isProcessing = ref(false)
const processingStatus = ref('')
const processedPages = ref(0)
let statusPollingTimer = null

// Opciones de proveedores normalizadas
const supplierOptions = computed(() => {
  return props.suppliers.filter(s => s && s.id !== 'all').map(s => ({
    title: s.name,
    value: s.id,
    ruc: s.ruc,
  }))
})

watch(() => props.isDialogVisible, isOpen => {
  if (isOpen) {
    // Si viene un proveedor seleccionado válido, usarlo; sino el primero
    if (props.selectedSupplierId && props.selectedSupplierId !== 'all') {
      selectedSupplier.value = props.selectedSupplierId
    } else if (supplierOptions.value.length > 0) {
      selectedSupplier.value = supplierOptions.value[0].value
    } else {
      selectedSupplier.value = null
    }

    catalogTitle.value = ''
    selectedFile.value = null
    uploadProgress.value = 0
    isUploading.value = false
    isProcessing.value = false
    processingStatus.value = ''
    processedPages.value = 0
  } else {
    stopPolling()
  }
})

const validatePdfFile = file => {
  if (!file) return false

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    showNotification('Formato no válido. Solo se admiten archivos PDF.', 'error')
    return false
  }

  // Límite de 100 MB
  if (file.size > 100 * 1024 * 1024) {
    showNotification('El archivo excede el tamaño máximo permitido (100 MB).', 'error')
    return false
  }

  return true
}

const onFileSelected = event => {
  const file = event.target.files?.[0]
  if (validatePdfFile(file)) {
    selectedFile.value = file
    if (!catalogTitle.value) {
      catalogTitle.value = file.name.replace(/\.[^/.]+$/, '')
    }
  }
}

const onFileDropped = event => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (validatePdfFile(file)) {
    selectedFile.value = file
    if (!catalogTitle.value) {
      catalogTitle.value = file.name.replace(/\.[^/.]+$/, '')
    }
  }
}

const removeSelectedFile = () => {
  selectedFile.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const stopPolling = () => {
  if (statusPollingTimer) {
    clearInterval(statusPollingTimer)
    statusPollingTimer = null
  }
}

const startStatusPolling = catalogId => {
  stopPolling()

  statusPollingTimer = setInterval(async () => {
    try {
      const response = await $api(`distributor-catalog-pdf/${catalogId}/status`)
      const catalogData = response?.data

      if (catalogData) {
        if (catalogData.status === 'completed') {
          stopPolling()
          isProcessing.value = false
          processedPages.value = catalogData.total_pages || 0
          showNotification(
            `Catálogo "${catalogData.title}" indexado con éxito (${catalogData.total_pages} páginas).`,
            'success',
          )
          emit('uploaded', catalogData.supplier_id)
          emit('update:isDialogVisible', false)
        } else if (catalogData.status === 'failed') {
          stopPolling()
          isProcessing.value = false
          showNotification(
            catalogData.error_message || 'Ocurrió un error al extraer el texto del PDF.',
            'error',
          )
        } else {
          processingStatus.value = 'Indexando texto plano de las páginas...'
        }
      }
    } catch (err) {
      console.warn('Error al consultar estado de procesamiento:', err)
    }
  }, 2500)
}

const submitUpload = async () => {
  if (!selectedSupplier.value) {
    showNotification('Por favor selecciona un proveedor o distribuidor.', 'warning')
    return
  }

  if (!selectedFile.value) {
    showNotification('Debes adjuntar un archivo de catálogo en formato PDF.', 'warning')
    return
  }

  isUploading.value = true
  uploadProgress.value = 10
  processingStatus.value = 'Subiendo archivo al servidor...'

  try {
    const formData = new FormData()
    formData.append('supplier_id', selectedSupplier.value)
    formData.append('title', catalogTitle.value.trim() || selectedFile.value.name)
    formData.append('file', selectedFile.value)

    const response = await $api('distributor-catalog-pdf/upload', {
      method: 'POST',
      body: formData,
    })

    uploadProgress.value = 100
    isUploading.value = false

    if (response?.catalog?.id) {
      isProcessing.value = true
      processingStatus.value = 'PDF recibido. Extrayendo e indexando texto en archivo independiente...'
      startStatusPolling(response.catalog.id)
    } else {
      showNotification('Catálogo recibido exitosamente.', 'success')
      emit('uploaded', selectedSupplier.value)
      emit('update:isDialogVisible', false)
    }
  } catch (error) {
    isUploading.value = false
    isProcessing.value = false
    const msg = error?.response?._data?.message || 'Error al subir catálogo PDF.'
    showNotification(msg, 'error')
  }
}

const closeDialog = () => {
  if (isUploading.value || isProcessing.value) {
    if (!confirm('Hay un proceso de subida en curso. ¿Deseas cerrar el diálogo?')) {
      return
    }
  }
  stopPolling()
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="580"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="rounded-xl overflow-hidden elevation-12">
      <!-- Header Banner Primary -->
      <VCardTitle class="pa-4 bg-primary text-white d-flex align-center justify-space-between flex-none">
        <div class="d-flex align-center gap-2.5">
          <VAvatar color="white" variant="tonal" size="38" class="rounded-lg flex-shrink-0">
            <VIcon icon="ri-file-pdf-2-line" size="22" color="white" />
          </VAvatar>
          <div class="overflow-hidden">
            <div class="text-subtitle-1 font-weight-bold text-white leading-tight">
              Subir Catálogo PDF de Proveedor
            </div>
            <div class="text-caption text-white opacity-80 text-truncate" style="font-size: 11px;">
              Extracción e indexación de texto plano para búsqueda por páginas
            </div>
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          color="white"
          :disabled="isUploading || isProcessing"
          @click="closeDialog"
        />
      </VCardTitle>

      <VCardText class="pa-5">
        <!-- 1. Selector de Distribuidor -->
        <div class="mb-4">
          <label class="text-caption font-weight-bold text-slate-700 mb-1 d-block">
            Distribuidor / Proveedor *
          </label>
          <VAutocomplete
            v-model="selectedSupplier"
            :items="supplierOptions"
            item-title="title"
            item-value="value"
            placeholder="Seleccionar distribuidor..."
            density="compact"
            variant="outlined"
            prepend-inner-icon="ri-truck-line"
            :disabled="isUploading || isProcessing"
            no-data-text="No hay distribuidores registrados"
          >
            <template #item="{ props: itemProps, item }">
              <VListItem v-bind="itemProps">
                <template #title>
                  <span class="font-weight-semibold text-body-2">{{ item.raw.title }}</span>
                </template>
                <template v-if="item.raw.ruc" #subtitle>
                  <span class="text-caption font-mono text-disabled">RUC: {{ item.raw.ruc }}</span>
                </template>
              </VListItem>
            </template>
          </VAutocomplete>
        </div>

        <!-- 2. Título o Identificador de la Lista -->
        <div class="mb-4">
          <label class="text-caption font-weight-bold text-slate-700 mb-1 d-block">
            Título o Descripción del Catálogo
          </label>
          <VTextField
            v-model="catalogTitle"
            placeholder="Ej. Lista Oficial Repuestos Mayo 2026 / Catálogo Suspensión"
            density="compact"
            variant="outlined"
            prepend-inner-icon="ri-file-text-line"
            :disabled="isUploading || isProcessing"
          />
        </div>

        <!-- 3. Dropzone o Archivo Seleccionado -->
        <div class="mb-3">
          <label class="text-caption font-weight-bold text-slate-700 mb-1 d-block">
            Archivo PDF Oficial *
          </label>

          <!-- Input oculto -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".pdf,application/pdf"
            class="d-none"
            @change="onFileSelected"
          />

          <!-- Área Drag and Drop si no hay archivo -->
          <div
            v-if="!selectedFile"
            class="pdf-upload-box pa-6 text-center rounded-xl border border-dashed cursor-pointer"
            :class="{ 'dropzone-active': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onFileDropped"
            @click="fileInputRef?.click()"
          >
            <VAvatar color="primary" variant="tonal" size="52" class="mb-2">
              <VIcon icon="ri-upload-cloud-2-line" size="26" />
            </VAvatar>
            <div class="text-subtitle-2 font-weight-bold text-slate-800">
              Haz clic o arrastra el catálogo PDF aquí
            </div>
            <div class="text-caption text-medium-emphasis mt-1">
              Archivos en formato PDF (listas de precios, catálogos hasta 100 MB)
            </div>
          </div>

          <!-- Tarjeta de Archivo Adjunto -->
          <div
            v-else
            class="pa-3.5 rounded-xl border bg-slate-50 d-flex align-center justify-space-between elevation-1"
          >
            <div class="d-flex align-center gap-3 overflow-hidden">
              <VAvatar color="error" variant="tonal" size="42" class="rounded-lg flex-shrink-0">
                <VIcon icon="ri-file-pdf-fill" size="24" color="error" />
              </VAvatar>
              <div class="overflow-hidden">
                <div class="text-caption font-weight-bold text-slate-900 text-truncate" :title="selectedFile.name">
                  {{ selectedFile.name }}
                </div>
                <div class="text-caption text-disabled font-mono">
                  {{ (selectedFile.size / (1024 * 1024)).toFixed(2) }} MB • Documento PDF
                </div>
              </div>
            </div>

            <VBtn
              v-if="!isUploading && !isProcessing"
              icon="ri-delete-bin-line"
              size="small"
              color="error"
              variant="text"
              title="Quitar archivo"
              @click="removeSelectedFile"
            />
          </div>
        </div>

        <!-- 4. Indicador de Progreso y Estado Asíncrono -->
        <div v-if="isUploading || isProcessing" class="mt-4 pa-3 rounded-lg bg-primary-lighten-5 border">
          <div class="d-flex justify-space-between align-center mb-1.5">
            <span class="text-caption font-weight-bold text-primary d-flex align-center gap-1">
              <VIcon icon="ri-loader-4-line" size="16" class="spin-icon" />
              {{ processingStatus }}
            </span>
            <span v-if="isUploading" class="text-caption font-mono font-weight-bold text-primary">
              {{ uploadProgress }}%
            </span>
          </div>
          <VProgressLinear
            :model-value="isUploading ? uploadProgress : undefined"
            :indeterminate="isProcessing"
            color="primary"
            height="7"
            rounded
          />
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 d-flex justify-end align-center gap-2">
        <VBtn
          color="secondary"
          variant="outlined"
          class="rounded-lg px-4 font-weight-medium"
          :disabled="isUploading || isProcessing"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-upload-2-line"
          class="rounded-lg px-5 font-weight-bold"
          :loading="isUploading || isProcessing"
          :disabled="!selectedFile"
          @click="submitUpload"
        >
          Subir e Indexar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.pdf-upload-box {
  background-color: #f8fafc;
  border: 2px dashed #cbd5e1;
  transition: all 0.2s ease;
}

.pdf-upload-box:hover,
.dropzone-active {
  border-color: #6366f1;
  background-color: rgba(99, 102, 241, 0.04);
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

