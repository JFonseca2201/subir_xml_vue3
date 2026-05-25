<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'imported',
])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

let selectedFile = null
const error_exist = ref(null)


const importExcel = async () => {
  error_exist.value = null

  if (!selectedFile) {
    error_exist.value = 'Por favor selecciona un archivo Excel (.xlsx, .xls o .csv)'
    
    return
  }

  loader.start()
  try {
    const formData = new FormData()


    // Nota: Asegúrate de que 'file' coincida con el nombre de parámetro que espera tu backend
    formData.append('excel', selectedFile)

    const resp = await $api('products/import-excel', {
      method: 'POST',
      body: formData,
      onResponseError({ response }) {
        const data = response._data || {}

        error_exist.value = data.message || data.error || 'Error al importar el archivo Excel'
      },
    })

    if (!error_exist.value) {
      showNotification(resp?.message || 'Productos importados correctamente', 'success')
      emit('imported')
      closeDialog()
    }
  } catch (error) {
    console.error('Error importing Excel:', error)
    if (!error_exist.value) {
      error_exist.value = 'Error de conexión al procesar el archivo.'
    }
  } finally {
    loader.stop()
  }
}


const loadFile = $event => {
  if ($event.target.files[0].type.indexOf('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') < 0) {
    error_exist.value = "Archivo no válido. Por favor selecciona un archivo Excel (.xlsx, .xls o .csv)"
    selectedFile = null
    
    return
  }
  error_exist.value = null
  selectedFile = $event.target.files[0]
}

const closeDialog = () => {
  selectedFile.value = null
  error_exist.value = null
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="600"
    persistent
    transition="dialog-bottom-transition"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="rounded-xl">
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <div class="d-flex align-center gap-2">
          <VIcon
            size="24"
            color="success"
          >
            ri-file-excel-2-line
          </VIcon>
          <span class="text-h6 font-weight-bold">Importar Productos</span>
        </div>
        <VBtn
          icon
          variant="text"
          :disabled="loader.loading"
          @click="closeDialog"
        >
          <VIcon>ri-close-line</VIcon>
        </VBtn>
      </VCardTitle>
      <VDivider />
      <VCardText class="pt-6">
        <p class="text-body-2 mb-4">
          Selecciona un archivo Excel (.xlsx, .xls o .csv) con la lista de productos que deseas importar.
        </p>
        <VFileInput
          accept=".xlsx, .xls, .csv"
          label="Seleccionar archivo Excel"
          variant="outlined"
          clearable
          prepend-inner-icon="ri-upload-cloud-2-line"
          :disabled="loader.loading"
          @change="loadFile($event)"
        />
        <VAlert
          v-if="error_exist"
          type="error"
          variant="tonal"
          class="mt-4"
        >
          {{ error_exist }}
        </VAlert>
      </VCardText>
      <VDivider />
      <VCardActions class="pa-4 justify-end gap-3">
        <VBtn
          variant="tonal"
          color="error"
          :disabled="loader.loading"
          @click="closeDialog"
        >
          <VIcon left>
            ri-close-circle-line
          </VIcon> &nbsp; Cancelar
        </VBtn>
        <VBtn
          variant="elevated"
          color="success"
          :loading="loader.loading"
          @click="importExcel"
        >
          <VIcon left>
            ri-file-excel-2-line
          </VIcon> &nbsp; Importar Data
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
