<script setup>
import { ref, watch } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  defaultTab: {
    type: String,
    default: 'clients', // 'clients' o 'vehicles'
  },
})

const emit = defineEmits(['update:isDialogVisible', 'importSuccess'])

const currentTab = ref(props.defaultTab)
const file = ref(null)
const isLoading = ref(false)
const error = ref('')
const result = ref(null)
const isDragging = ref(false)

// Watchers
watch(() => props.defaultTab, newVal => {
  currentTab.value = newVal
})

watch(() => props.isDialogVisible, newVal => {
  if (newVal) {
    file.value = null
    error.value = ''
    result.value = null
    isDragging.value = false
  }
})

const downloadTemplate = () => {
  let csvContent = "data:text/csv;charset=utf-8,"
  if (currentTab.value === 'clients') {
    csvContent += "ci_ruc,full_name,direccion,email,telefono\n"
  } else {
    csvContent += "Placa,Marca,Modelo,Tipo de Vehículo,Color,Año\n"
  }

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", `Plantilla_Importacion_${currentTab.value === 'clients' ? 'Clientes' : 'Vehiculos'}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const onDragOver = (e) => {
  e.preventDefault()
  isDragging.value = true
}

const onDragLeave = (e) => {
  e.preventDefault()
  isDragging.value = false
}

const onDrop = (e) => {
  e.preventDefault()
  isDragging.value = false
  const droppedFiles = e.dataTransfer.files
  if (droppedFiles.length) {
    handleFileSelect(droppedFiles[0])
  }
}

const handleFileSelect = (selectedFile) => {
  const validExtensions = ['.xlsx', '.xls', '.csv']
  const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase()

  if (!validExtensions.includes(fileExt)) {
    error.value = 'Formato no soportado. Sube un archivo .xlsx, .xls o .csv'
    return
  }
  file.value = selectedFile
  error.value = ''
  result.value = null
}

const handleFileInput = (e) => {
  if (e.target.files.length) {
    handleFileSelect(e.target.files[0])
  }
}

const triggerFileInput = () => {
  document.getElementById('hiddenFileInput').click()
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const removeFile = () => {
  file.value = null
  document.getElementById('hiddenFileInput').value = ''
}

const importFile = async () => {
  if (!file.value) {
    error.value = 'Por favor, selecciona un archivo'
    return
  }

  isLoading.value = true
  error.value = ''
  result.value = null

  const formData = new FormData()
  formData.append('file', file.value)

  const endpoint = currentTab.value === 'clients' ? 'import/clients' : 'import/vehicles'

  try {
    const response = await $api(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    })

    result.value = response
    if (response.success) {
      emit('importSuccess')
    }
  } catch (err) {
    console.error('Error importing:', err)
    let errorMsg = err?.data?.message || err?.response?.data?.message || err?.message || 'Hubo un error al procesar el archivo.'
    if (err?.data?.errors) {
      errorMsg += '\nDetalles:\n' + err.data.errors.join('\n')
    }
    error.value = errorMsg
  } finally {
    isLoading.value = false
  }
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog :model-value="props.isDialogVisible" max-width="650" @update:model-value="closeDialog" persistent>
    <VCard class="pa-sm-8 pa-5 rounded-xl premium-card">
      <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

      <VCardText class="text-center pb-6">
        <div class="header-icon-container mb-4 mx-auto">
          <VIcon icon="ri-file-excel-2-line" size="48" color="primary" />
        </div>
        <h4 class="text-h4 font-weight-bold mb-1">
          Importación Masiva
        </h4>
        <p class="text-body-2 text-medium-emphasis">
          Sube tu archivo Excel o CSV para agilizar el registro
        </p>
      </VCardText>

      <VTabs v-model="currentTab" align-tabs="center" color="primary" class="mb-6 border-b tabs-premium">
        <VTab value="clients" class="text-button font-weight-medium">
          <VIcon start icon="ri-user-add-line" />
          Clientes
        </VTab>
        <VTab value="vehicles" class="text-button font-weight-medium">
          <VIcon start icon="ri-roadster-line" />
          Vehículos
        </VTab>
      </VTabs>

      <VWindow v-model="currentTab" class="mb-6">
        <!-- Tab: Clientes -->
        <VWindowItem value="clients">

          <div class="mt-2 text-right">
            <VBtn variant="text" color="primary" size="small" prepend-icon="ri-download-line" @click="downloadTemplate">
              Descargar Plantilla
            </VBtn>
          </div>
        </VWindowItem>

        <!-- Tab: Vehículos -->
        <VWindowItem value="vehicles">
          <div class="mt-2 text-right">
            <VBtn variant="text" color="primary" size="small" prepend-icon="ri-download-line" @click="downloadTemplate">
              Descargar Plantilla
            </VBtn>
          </div>
        </VWindowItem>
      </VWindow>

      <!-- Zona Drag & Drop -->
      <input type="file" id="hiddenFileInput" class="d-none" accept=".xlsx, .xls, .csv" @change="handleFileInput">

      <div v-if="!file"
        class="drag-drop-zone rounded-xl d-flex flex-column align-center justify-center cursor-pointer mb-6"
        :class="{ 'is-dragging': isDragging }" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop"
        @click="triggerFileInput">
        <div class="icon-circle mb-4">
          <VIcon icon="ri-upload-cloud-2-line" size="48" color="primary" />
        </div>
        <h5 class="text-h6 font-weight-bold mb-1">Arrastra y suelta tu archivo aquí</h5>
        <p class="text-body-2 text-medium-emphasis mb-0">o haz clic para buscar en tus carpetas</p>
        <div class="mt-5 d-flex gap-2">
          <VChip size="small" color="primary" variant="tonal">.xlsx</VChip>
          <VChip size="small" color="primary" variant="tonal">.xls</VChip>
          <VChip size="small" color="primary" variant="tonal">.csv</VChip>
        </div>
      </div>

      <!-- Tarjeta de Archivo Seleccionado -->
      <VExpandTransition>
        <div v-if="file" class="file-preview-card rounded-xl pa-5 mb-6 d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-4">
            <div class="file-icon rounded-lg pa-3 d-flex align-center justify-center">
              <VIcon icon="ri-file-excel-2-fill" color="success" size="36" />
            </div>
            <div>
              <h6 class="text-subtitle-1 font-weight-bold mb-0 text-truncate" style="max-width: 320px;">{{ file.name }}
              </h6>
              <span class="text-caption text-medium-emphasis d-flex align-center gap-1 mt-1">
                <VIcon icon="ri-hard-drive-2-line" size="14" />
                {{ formatFileSize(file.size) }}
              </span>
            </div>
          </div>
          <VBtn icon="ri-delete-bin-line" variant="tonal" color="error" size="small" class="rounded-lg"
            @click="removeFile" />
        </div>
      </VExpandTransition>

      <!-- Errores -->
      <VExpandTransition>
        <div v-if="error" class="mb-4">
          <VAlert type="error" variant="tonal" border="start" prominent class="rounded-lg">
            <div class="d-flex flex-column">
              <span class="text-subtitle-1 font-weight-bold mb-1">Error de Importación</span>
              <span style="white-space: pre-wrap; font-size: 0.85rem;">{{ error }}</span>
            </div>
          </VAlert>
        </div>
      </VExpandTransition>

      <!-- Éxito -->
      <VExpandTransition>
        <div v-if="result && result.success">
          <VAlert type="success" variant="tonal" class="mb-4 rounded-lg">
            <div class="d-flex flex-column">
              <span class="text-subtitle-1 font-weight-bold mb-1">¡Importación Exitosa!</span>
              <span>{{ result.message }}</span>
            </div>
            <template v-if="result.data && result.data.errors && result.data.errors.length > 0">
              <div class="mt-3 text-caption error-list-container pa-3 rounded-lg bg-surface">
                <strong class="text-error d-flex align-center gap-1 mb-2">
                  <VIcon icon="ri-error-warning-line" size="16" />
                  Algunas filas no pudieron ser procesadas y fueron omitidas:
                </strong>
                <ul class="ml-4 mt-1 text-medium-emphasis" style="max-height: 120px; overflow-y: auto;">
                  <li v-for="(err, idx) in result.data.errors" :key="idx" class="mb-1">
                    {{ err }}
                  </li>
                </ul>
              </div>
            </template>
          </VAlert>
        </div>
      </VExpandTransition>

      <VCardActions class="d-flex justify-center gap-4 mt-2 pa-0">
        <VBtn color="secondary" variant="outlined" @click="closeDialog" :disabled="isLoading" class="rounded-lg px-6"
          height="44">
          Cancelar
        </VBtn>
        <VBtn color="primary" variant="elevated" prepend-icon="ri-upload-cloud-2-line" @click="importFile"
          :loading="isLoading" class="rounded-lg px-8 font-weight-bold" height="44">
          Procesar Importación
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
