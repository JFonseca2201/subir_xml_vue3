<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  maxFiles: {
    type: Number,
    default: 10,
  },
  maxSizeMb: {
    type: Number,
    default: 15,
  },
  label: {
    type: String,
    default: 'Comprobantes de Pago / Soportes',
  },
  hint: {
    type: String,
    default: 'Formatos admitidos: JPG, PNG, WEBP, PDF (Máx. 15MB por archivo)',
  },
  compact: {
    type: Boolean,
    default: false,
  },
  allowPdf: {
    type: Boolean,
    default: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'error'])

const fileInputRef = ref(null)
const cameraInputRef = ref(null)
const isDragging = ref(false)
const previewList = ref([])

// Diálogo de previsualización en grande
const isPreviewOpen = ref(false)
const previewItem = ref(null)

// Generar previews reactivas de los archivos
const updatePreviews = files => {
  // Liberar URLs anteriores de memoria
  previewList.value.forEach(item => {
    if (item.url && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url)
    }
  })

  previewList.value = (files || []).map((file, index) => {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    const url = isImage || isPdf ? URL.createObjectURL(file) : null
    const extension = file.name.split('.').pop().toUpperCase()

    return {
      id: `${file.name}-${file.size}-${index}`,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      isImage,
      isPdf,
      url,
      extension,
    }
  })
}

watch(
  () => props.modelValue,
  newFiles => {
    updatePreviews(newFiles)
  },
  { immediate: true, deep: true }
)

onUnmounted(() => {
  // Limpiar memoria
  previewList.value.forEach(item => {
    if (item.url && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url)
    }
  })
})

const formatFileSize = bytes => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const handleFileSelection = rawFiles => {
  if (props.disabled) return

  const incomingFiles = Array.from(rawFiles)
  const validFiles = []
  const maxBytes = props.maxSizeMb * 1024 * 1024
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
  if (props.allowPdf) allowedMimes.push('application/pdf')

  for (const file of incomingFiles) {
    if (!allowedMimes.includes(file.type)) {
      emit('error', `El archivo ${file.name} no tiene un formato permitido.`)
      continue
    }

    if (file.size > maxBytes) {
      emit('error', `El archivo ${file.name} supera el límite de ${props.maxSizeMb}MB.`)
      continue
    }

    validFiles.push(file)
  }

  const combined = [...props.modelValue, ...validFiles]
  if (combined.length > props.maxFiles) {
    emit('error', `Puedes adjuntar un máximo de ${props.maxFiles} comprobantes.`)
    emit('update:modelValue', combined.slice(0, props.maxFiles))
  } else {
    emit('update:modelValue', combined)
  }
}

const onFilesChosen = event => {
  if (event.target.files) {
    handleFileSelection(event.target.files)
    event.target.value = '' // Reset input
  }
}

const triggerFileInput = () => {
  if (fileInputRef.value && !props.disabled) {
    fileInputRef.value.click()
  }
}

const triggerCameraInput = () => {
  if (cameraInputRef.value && !props.disabled) {
    cameraInputRef.value.click()
  }
}

const onDrop = event => {
  isDragging.value = false
  if (props.disabled) return
  if (event.dataTransfer && event.dataTransfer.files) {
    handleFileSelection(event.dataTransfer.files)
  }
}

const removeFile = index => {
  if (props.disabled) return
  const current = [...props.modelValue]
  current.splice(index, 1)
  emit('update:modelValue', current)
}

const openPreview = item => {
  previewItem.value = item
  isPreviewOpen.value = true
}
</script>

<template>
  <div class="receipt-uploader-wrapper">
    <!-- Input oculto para selección de archivos -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      :accept="allowPdf ? 'image/jpeg,image/png,image/jpg,image/webp,application/pdf' : 'image/jpeg,image/png,image/jpg,image/webp'"
      class="d-none"
      :disabled="disabled"
      @change="onFilesChosen"
    />

    <!-- Input oculto para captura directa de cámara en smartphones -->
    <input
      ref="cameraInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="d-none"
      :disabled="disabled"
      @change="onFilesChosen"
    />

    <!-- Cabecera del componente -->
    <div class="d-flex align-center justify-space-between mb-2">
      <div class="d-flex align-center gap-1.5 flex-wrap">
        <VIcon
          icon="ri-attachment-2"
          size="18"
          color="primary"
        />
        <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
          {{ label }}
        </span>
        <span
          v-if="required"
          class="text-error font-weight-bold text-caption"
          style="font-size: 11px;"
        >
          * Obligatorio
        </span>
        <VChip
          v-if="modelValue.length > 0"
          size="x-small"
          color="primary"
          variant="tonal"
          class="font-weight-bold"
        >
          {{ modelValue.length }} / {{ maxFiles }}
        </VChip>
      </div>

      <!-- Botones de Acción Rápida -->
      <div class="d-flex gap-2">
        <VBtn
          size="x-small"
          variant="tonal"
          color="secondary"
          prepend-icon="ri-camera-line"
          class="camera-btn"
          :disabled="disabled || modelValue.length >= maxFiles"
          @click="triggerCameraInput"
        >
          Cámara
        </VBtn>
        <VBtn
          size="x-small"
          variant="tonal"
          color="primary"
          prepend-icon="ri-upload-cloud-2-line"
          :disabled="disabled || modelValue.length >= maxFiles"
          @click="triggerFileInput"
        >
          Adjuntar
        </VBtn>
      </div>
    </div>

    <!-- Zona Drag & Drop cuando NO hay archivos -->
    <div
      v-if="modelValue.length === 0"
      class="drop-zone"
      :class="{
        'drop-zone-active': isDragging,
        'drop-zone-disabled': disabled,
        'drop-zone-compact': compact,
      }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="triggerFileInput"
    >
      <div class="drop-zone-content py-2.5 px-3 text-center">
        <VIcon
          icon="ri-image-add-line"
          size="26"
          class="mb-0.5 drop-zone-icon text-primary"
        />
        <div class="text-caption font-weight-medium text-high-emphasis">
          Arrastra comprobantes o <span class="text-primary font-weight-bold text-decoration-underline">examina tus archivos</span>
        </div>
        <div class="text-caption text-medium-emphasis mt-0.5" style="font-size: 11px;">
          {{ hint }}
        </div>
      </div>
    </div>

    <!-- Barra compacta cuando ya hay archivos cargados -->
    <div
      v-else-if="modelValue.length < maxFiles"
      class="drop-zone-mini pa-2 px-3 d-flex align-center justify-space-between mb-2 rounded-lg border border-dashed cursor-pointer"
      :class="{ 'drop-zone-active': isDragging }"
      style="border-color: rgba(var(--v-theme-primary), 0.4); background: rgba(var(--v-theme-primary), 0.03);"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="triggerFileInput"
    >
      <div class="d-flex align-center gap-2">
        <VIcon icon="ri-add-circle-line" size="16" color="primary" />
        <span class="text-caption font-weight-semibold text-primary" style="font-size: 11px;">
          Haz clic o arrastra para adjuntar más fotos / documentos
        </span>
      </div>
      <span class="text-caption text-medium-emphasis font-weight-bold" style="font-size: 10px;">
        {{ modelValue.length }}/{{ maxFiles }}
      </span>
    </div>

    <!-- Grid de Miniaturas / Thumbnails -->
    <div
      v-if="previewList.length > 0"
      class="thumbnails-grid mt-2"
    >
      <div
        v-for="(item, idx) in previewList"
        :key="item.id"
        class="thumbnail-card elevation-1"
      >
        <!-- Imagen Preview -->
        <div
          v-if="item.isImage"
          class="thumbnail-media"
          @click="openPreview(item)"
        >
          <img
            :src="item.url"
            :alt="item.name"
            class="thumbnail-img"
          />
          <div class="thumbnail-overlay">
            <VIcon
              icon="ri-zoom-in-line"
              color="white"
              size="20"
            />
          </div>
        </div>

        <!-- PDF Preview -->
        <div
          v-else-if="item.isPdf"
          class="thumbnail-media pdf-media"
          @click="openPreview(item)"
        >
          <VIcon
            icon="ri-file-pdf-2-fill"
            size="38"
            color="error"
          />
          <span class="pdf-tag">PDF</span>
        </div>

        <!-- Otros archivos -->
        <div
          v-else
          class="thumbnail-media generic-media"
        >
          <VIcon
            icon="ri-file-3-line"
            size="32"
            color="primary"
          />
        </div>

        <!-- Info del Archivo -->
        <div class="thumbnail-info px-2 py-1.5">
          <div
            class="text-caption font-weight-medium text-truncate text-high-emphasis"
            :title="item.name"
          >
            {{ item.name }}
          </div>
          <div class="d-flex align-center justify-space-between text-caption text-disabled mt-0.5">
            <span>{{ item.size }}</span>
            <VChip
              size="x-small"
              :color="item.isPdf ? 'error' : 'primary'"
              variant="tonal"
              class="font-weight-bold px-1"
              style="height: 16px; font-size: 9px;"
            >
              {{ item.extension }}
            </VChip>
          </div>
        </div>

        <!-- Botón Eliminar -->
        <VBtn
          v-if="!disabled"
          icon="ri-close-line"
          size="x-small"
          variant="flat"
          color="error"
          class="thumbnail-remove-btn"
          @click.stop="removeFile(idx)"
        />
      </div>
    </div>

    <!-- Modal Lightbox para Previsualización en Grande -->
    <VDialog
      v-model="isPreviewOpen"
      max-width="750"
      scrollable
    >
      <VCard
        v-if="previewItem"
        class="rounded-lg overflow-hidden"
      >
        <VCardTitle class="d-flex align-center justify-space-between bg-primary text-white pa-4">
          <div class="d-flex align-center gap-2 text-truncate">
            <VIcon :icon="previewItem.isPdf ? 'ri-file-pdf-2-line' : 'ri-image-line'" />
            <span class="text-subtitle-1 font-weight-bold text-truncate">{{ previewItem.name }}</span>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            color="white"
            @click="isPreviewOpen = false"
          />
        </VCardTitle>

        <VCardText class="pa-4 text-center bg-grey-lighten-4">
          <img
            v-if="previewItem.isImage"
            :src="previewItem.url"
            :alt="previewItem.name"
            class="lightbox-img rounded elevation-2"
          />
          <iframe
            v-else-if="previewItem.isPdf"
            :src="previewItem.url"
            class="lightbox-iframe rounded elevation-2"
          />
        </VCardText>

        <VCardActions class="pa-3 justify-space-between bg-white border-t">
          <span class="text-caption text-medium-emphasis">
            Tamaño: {{ previewItem.size }}
          </span>
          <VBtn
            color="primary"
            variant="tonal"
            prepend-icon="ri-download-2-line"
            :href="previewItem.url"
            :download="previewItem.name"
            target="_blank"
          >
            Descargar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.receipt-uploader-wrapper {
  width: 100%;
}

.drop-zone {
  border: 2px dashed rgba(var(--v-theme-primary), 0.35);
  background-color: rgba(var(--v-theme-primary), 0.02);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.drop-zone:hover {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.05);
  transform: translateY(-1px);
}

.drop-zone-active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
  transform: scale(1.01);
}

.drop-zone-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  border-color: rgba(0, 0, 0, 0.12);
}

.drop-zone-has-files {
  padding-top: 4px;
  padding-bottom: 4px;
}

.drop-zone-icon {
  transition: transform 0.25s ease;
}

.drop-zone:hover .drop-zone-icon {
  transform: scale(1.1);
}

.thumbnails-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.thumbnail-card {
  position: relative;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.thumbnail-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

.thumbnail-media {
  height: 72px;
  width: 100%;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.thumbnail-media:hover .thumbnail-img {
  transform: scale(1.06);
}

.thumbnail-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.thumbnail-media:hover .thumbnail-overlay {
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

.thumbnail-info {
  background: white;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.thumbnail-remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px !important;
  height: 20px !important;
  min-width: 20px !important;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
}

.lightbox-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.lightbox-iframe {
  width: 100%;
  height: 70vh;
  border: none;
}
</style>
