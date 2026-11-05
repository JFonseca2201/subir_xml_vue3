<script setup>
import { ref, computed, watch } from 'vue'
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

const emit = defineEmits(['update:isDialogVisible', 'imported'])

const { showNotification } = useGlobalToast()

// Estado del formulario
const selectedSupplier = ref(null)
const catalogTitle = ref('')
const selectedFile = ref(null)
const fileInputRef = ref(null)
const isDragging = ref(false)

// Estados de subida y procesamiento en segundo plano
const isSubmitting = ref(false)
const uploadProgress = ref(0)
const uploadStatusText = ref('')

// Opciones de proveedores normalizadas
const supplierOptions = computed(() => {
  return props.suppliers
    .filter(s => s && s.id !== 'all')
    .map(s => ({
      title: s.name,
      value: s.id,
      ruc: s.ruc,
    }))
})

// Al abrir el modal, inicializar campos
watch(
  () => props.isDialogVisible,
  isOpen => {
    if (isOpen) {
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
      isSubmitting.value = false
      uploadStatusText.value = ''
      if (fileInputRef.value) {
        fileInputRef.value.value = ''
      }
    }
  },
)

const formatFileSize = bytes => {
  if (!bytes || bytes <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, power)).toFixed(2)} ${units[power]}`
}

const validatePdfFile = file => {
  if (!file) return false

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    showNotification('Formato no válido. Debe adjuntar un archivo en formato PDF (.pdf)', 'error')
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
      // Usar nombre del archivo sin extensión como título inicial sugerido
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

const triggerFileInput = () => {
  if (isSubmitting.value) return
  fileInputRef.value?.click()
}

const removeFile = () => {
  if (isSubmitting.value) return
  selectedFile.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const closeDialog = () => {
  if (isSubmitting.value) {
    showNotification('Hay una subida en proceso, por favor espere...', 'warning')
    return
  }
  emit('update:isDialogVisible', false)
}

/**
 * Enviar el catálogo PDF al backend:
 * 1. Guarda el PDF físico en storage/app/public/catalogs/
 * 2. Guarda UN ÚNICO registro de metadatos ligero en distributor_catalogs
 * 3. NO inserta líneas de texto del PDF como productos en la BD relacional
 * 4. Lanza el Job en segundo plano (smalot/pdfparser) para indexar el texto plano
 */
const submitPdfCatalog = async () => {
  if (!selectedSupplier.value) {
    showNotification('Por favor, selecciona el distribuidor o proveedor del catálogo.', 'warning')
    return
  }

  if (!selectedFile.value) {
    showNotification('Debes adjuntar el archivo PDF del catálogo.', 'warning')
    return
  }

  isSubmitting.value = true
  uploadProgress.value = 25
  uploadStatusText.value = 'Subiendo archivo PDF al servidor...'

  try {
    const formData = new FormData()
    formData.append('supplier_id', selectedSupplier.value)
    formData.append('title', catalogTitle.value.trim() || selectedFile.value.name)
    formData.append('file', selectedFile.value)

    uploadProgress.value = 65
    uploadStatusText.value = 'Guardando metadatos y programando extracción...'

    const response = await $api('distributor-catalog-pdf/upload', {
      method: 'POST',
      body: formData,
    })

    uploadProgress.value = 100
    uploadStatusText.value = '¡Catálogo PDF registrado correctamente!'

    showNotification(
      response?.message || 'Catálogo PDF subido exitosamente. Indexación en proceso en segundo plano.',
      'success',
    )

    emit('imported', selectedSupplier.value)
    emit('update:isDialogVisible', false)
  } catch (error) {
    console.error('Error al subir catálogo PDF:', error)
    const backendData = error?.response?._data || error?.data || {}
    let errorMsg = backendData.message || error?.message || 'Error al procesar y subir el archivo PDF.'
    if (backendData.errors && typeof backendData.errors === 'object') {
      const details = Object.values(backendData.errors).flat().join(' ')
      if (details) errorMsg = `${errorMsg}: ${details}`
    }
    showNotification(errorMsg, 'error')
  } finally {
    isSubmitting.value = false
    uploadProgress.value = 0
    uploadStatusText.value = ''
  }
}
</script>

<template>
  <VDialog :model-value="props.isDialogVisible" max-width="620" persistent scrollable
    transition="dialog-bottom-transition" @update:model-value="closeDialog">
    <VCard class="rounded-xl overflow-hidden elevation-16">
      <!-- Header Banner Rojo / PDF -->
      <VCardTitle class="pa-4 bg-primary text-white d-flex align-center justify-space-between flex-none">
        <!-- bg-primary -->
        <div class="d-flex align-center gap-3">
          <VAvatar color="white" variant="tonal" size="42" rounded="lg">
            <VIcon icon="ri-file-pdf-2-fill" size="24" color="white" />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold text-white leading-tight">
              Subir Catálogo PDF de Proveedor
            </div>
            <div class="text-caption text-white opacity-80" style="font-size: 11px;">
              Escenario 1: Almacenamiento e indexación de texto plano en archivo independiente
            </div>
          </div>
        </div>
        <VBtn icon="ri-close-line" variant="text" size="small" color="white" :disabled="isSubmitting"
          @click="closeDialog" />
      </VCardTitle>

      <VCardText class="pa-5 overflow-y-auto" style="max-height: 75vh;">


        <!-- 1. Selección de Distribuidor -->
        <div class="mb-4">
          <label class="text-caption font-weight-bold text-medium-emphasis mb-1.5 d-block">
            Distribuidor / Proveedor <span class="text-error">*</span>
          </label>
          <VSelect v-model="selectedSupplier" :items="supplierOptions" item-title="title" item-value="value"
            placeholder="Selecciona el distribuidor del catálogo" prepend-inner-icon="ri-truck-line" variant="outlined"
            density="comfortable" hide-details="auto" color="primary" :disabled="isSubmitting">
            <template #item="{ props: itemProps, item }">
              <VListItem v-bind="itemProps">
                <template #title>
                  <span class="font-weight-medium text-body-2">{{ item.raw.title }}</span>
                </template>
                <template v-if="item.raw.ruc" #subtitle>
                  <span class="text-caption text-disabled font-mono">RUC: {{ item.raw.ruc }}</span>
                </template>
              </VListItem>
            </template>
          </VSelect>
        </div>

        <!-- 2. Título / Nombre Descriptivo del Catálogo -->
        <div class="mb-4">
          <label class="text-caption font-weight-bold text-medium-emphasis mb-1.5 d-block">
            Título o Identificador del Catálogo (Opcional)
          </label>
          <VTextField v-model="catalogTitle" placeholder="Ej: Catálogo General 2026 - Pastillas y Discos"
            prepend-inner-icon="ri-bookmark-3-line" variant="outlined" density="comfortable" hide-details="auto"
            color="primary" :disabled="isSubmitting" />
          <span class="text-caption text-disabled mt-1 d-block" style="font-size: 11px;">
            Si se deja en blanco, se usará el nombre original del archivo PDF.
          </span>
        </div>

        <!-- 3. Zona de Carga de Archivo PDF (Drag & Drop) -->
        <div class="mb-2">
          <label class="text-caption font-weight-bold text-medium-emphasis mb-1.5 d-block">
            Archivo PDF del Catálogo <span class="text-error">*</span>
          </label>

          <!-- Input oculto -->
          <input ref="fileInputRef" type="file" accept="application/pdf,.pdf" class="d-none" @change="onFileSelected">

          <!-- Zona Drag & Drop cuando no hay archivo -->
          <div v-if="!selectedFile" class="pdf-dropzone rounded-xl pa-6 text-center cursor-pointer border-dashed"
            :class="{ 'dropzone-active': isDragging, 'dropzone-disabled': isSubmitting }" @click="triggerFileInput"
            @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="onFileDropped">
            <VAvatar color="primary" variant="tonal" size="56" class="mb-3">
              <VIcon icon="ri-upload-cloud-2-line" size="30" />
            </VAvatar>
            <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-1">
              Haz clic para seleccionar o arrastra tu archivo PDF aquí
            </div>
            <div class="text-caption text-medium-emphasis">
              Solo formato <strong>.PDF</strong> (hasta 100 MB de tamaño)
            </div>
          </div>

          <!-- Card de Archivo PDF Seleccionado -->
          <div v-else
            class="selected-file-card rounded-xl pa-3.5 border d-flex align-center justify-space-between gap-3"
            style="background-color: rgba(var(--v-theme-primary), 0.05);">
            <div class="d-flex align-center gap-3 overflow-hidden min-w-0">
              <VAvatar color="primary" variant="tonal" size="42" rounded="lg" class="flex-shrink-0">
                <VIcon icon="ri-file-pdf-2-line" size="24" />
              </VAvatar>
              <div class="overflow-hidden min-w-0">
                <div class="text-body-2 font-weight-bold text-high-emphasis text-truncate" :title="selectedFile.name">
                  {{ selectedFile.name }}
                </div>
                <div class="text-caption text-medium-emphasis font-mono">
                  {{ formatFileSize(selectedFile.size) }} • Documento PDF
                </div>
              </div>
            </div>

            <div class="d-flex align-center gap-1 flex-shrink-0">
              <VBtn icon="ri-refresh-line" size="small" variant="text" color="primary" title="Cambiar archivo"
                :disabled="isSubmitting" @click.stop="triggerFileInput" />
              <VBtn icon="ri-delete-bin-line" size="small" variant="text" color="error" title="Quitar archivo"
                :disabled="isSubmitting" @click.stop="removeFile" />
            </div>
          </div>
        </div>

        <!-- Barra de Progreso durante la Subida -->
        <div v-if="isSubmitting" class="mt-4 pa-3 rounded-lg bg-surface border">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-medium text-high-emphasis">
              {{ uploadStatusText }}
            </span>
            <span class="text-caption font-weight-bold text-primary font-mono">
              {{ uploadProgress }}%
            </span>
          </div>
          <VProgressLinear :model-value="uploadProgress" color="primary" height="8" rounded striped indeterminate />
        </div>
      </VCardText>

      <VDivider />

      <!-- Footer de Acciones -->
      <VCardActions class="pa-4 d-flex justify-space-between align-center bg-surface">
        <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
          class="rounded-lg px-5 font-weight-medium text-none" :disabled="isSubmitting" @click="closeDialog">
          Cancelar
        </VBtn>

        <VBtn color="primary" variant="elevated" prepend-icon="ri-upload-cloud-2-line"
          class="rounded-lg px-6 font-weight-bold elevation-2 text-none" :loading="isSubmitting"
          :disabled="!selectedFile || !selectedSupplier" @click="submitPdfCatalog">
          Subir Catálogo PDF
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.pdf-dropzone {
  border: 2px dashed rgba(var(--v-theme-primary), 0.35);
  background-color: rgba(var(--v-theme-primary), 0.02);
  transition: all 0.25s ease;
}

.pdf-dropzone:hover {
  border-color: rgba(var(--v-theme-primary), 0.8);
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.dropzone-active {
  border-color: rgb(var(--v-theme-primary)) !important;
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
  transform: scale(0.99);
}

.dropzone-disabled {
  pointer-events: none;
  opacity: 0.6;
}

.selected-file-card {
  border-color: rgba(var(--v-theme-primary), 0.25) !important;
}
</style>
