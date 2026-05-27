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

// Watchers
watch(() => props.defaultTab, newVal => {
  currentTab.value = newVal
})

watch(() => props.isDialogVisible, newVal => {
  if (newVal) {
    file.value = null
    error.value = ''
    result.value = null
  }
})

const downloadTemplate = () => {
  // Crear CSV básico
  let csvContent = "data:text/csv;charset=utf-8,"
  if (currentTab.value === 'clients') {
    csvContent += "Identificación (Cédula/RUC),Nombre Completo,Dirección / Barrio,Correo Electrónico,Teléfono\n"
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

const importFile = async () => {
  if (!file.value || (Array.isArray(file.value) && file.value.length === 0)) {
    error.value = 'Por favor, selecciona un archivo'

    return
  }

  isLoading.value = true
  error.value = ''
  result.value = null

  const formData = new FormData()
  const fileToUpload = Array.isArray(file.value) ? file.value[0] : file.value
  formData.append('file', fileToUpload)

  const endpoint = currentTab.value === 'clients' ? 'import/clients' : 'import/vehicles'

  try {
    const response = await $api(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    })
    console.log(response)
    result.value = response
    if (response.success) {
      emit('importSuccess')
    }
  } catch (err) {
    console.error('Error importing:', err)
    let errorMsg = err?.data?.message || err?.response?.data?.message || err?.message || 'Hubo un error al procesar el archivo.'
    if (err?.data?.errors) {
      errorMsg += ' Detalles: ' + JSON.stringify(err.data.errors)
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
  <VDialog :model-value="props.isDialogVisible" max-width="600" @update:model-value="closeDialog" persistent>
    <VCard class="pa-sm-8 pa-5 rounded-lg">
      <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

      <VCardText class="text-center pb-6">
        <VIcon icon="ri-file-excel-2-line" size="42" color="success" class="mb-3" />
        <h4 class="text-h4 font-weight-bold mb-1">
          Importación Masiva
        </h4>
        <p class="text-body-2 text-medium-emphasis">
          Sube tu archivo Excel o CSV para importar registros
        </p>
      </VCardText>

      <VTabs v-model="currentTab" align-tabs="center" color="primary" class="mb-6 border-b">
        <VTab value="clients">
          <VIcon start icon="ri-user-add-line" />
          Clientes
        </VTab>
        <VTab value="vehicles">
          <VIcon start icon="ri-roadster-line" />
          Vehículos
        </VTab>
      </VTabs>

      <VWindow v-model="currentTab">
        <!-- Tab: Clientes -->
        <VWindowItem value="clients">
          <VAlert type="info" variant="tonal" class="mb-4 text-caption">
            Asegúrate de que tu archivo tenga las columnas: <strong>Identificación (Cédula/RUC), Nombre Completo,
              Dirección / Barrio, Correo Electrónico, Teléfono</strong>.
          </VAlert>
        </VWindowItem>

        <!-- Tab: Vehículos -->
        <VWindowItem value="vehicles">
          <VAlert type="info" variant="tonal" class="mb-4 text-caption">
            Asegúrate de que tu archivo tenga las columnas: <strong>Placa, Marca, Modelo, Tipo de Vehículo, Color,
              Año</strong>.
          </VAlert>
        </VWindowItem>
      </VWindow>

      <div class="mb-6 mt-2">
        <VFileInput v-model="file" label="Seleccionar archivo (.xlsx, .csv)" accept=".xlsx, .xls, .csv"
          prepend-icon="ri-file-upload-line" variant="outlined" color="primary" :error-messages="error" show-size
          clearable />
        <div class="text-right mt-2">
          <VBtn variant="text" color="primary" size="small" prepend-icon="ri-download-line" @click="downloadTemplate">
            Descargar Plantilla
          </VBtn>
        </div>
      </div>

      <VExpandTransition>
        <div v-if="error" class="mb-4">
          <VAlert type="error" variant="tonal" border="start" prominent>
            <div class="d-flex flex-column">
              <span class="text-subtitle-1 font-weight-bold mb-1">Error de Importación</span>
              <span style="white-space: pre-wrap;">{{ error }}</span>
            </div>
          </VAlert>
        </div>
      </VExpandTransition>

      <VExpandTransition>
        <div v-if="result && result.success">
          <VAlert type="success" variant="tonal" class="mb-4">
            {{ result.message }}
            <template v-if="result.data && result.data.errors && result.data.errors.length > 0">
              <div class="mt-2 text-caption">
                <strong>Algunas filas tuvieron errores:</strong>
                <ul class="ml-4 mt-1">
                  <li v-for="(err, idx) in result.data.errors" :key="idx">
                    {{ err }}
                  </li>
                </ul>
              </div>
            </template>
          </VAlert>
        </div>
      </VExpandTransition>

      <VCardActions class="d-flex justify-center gap-4 mt-4 pa-0">
        <VBtn color="secondary" variant="outlined" @click="closeDialog" :disabled="isLoading">
          Cerrar
        </VBtn>
        <VBtn color="primary" variant="elevated" prepend-icon="ri-upload-cloud-2-line" @click="importFile"
          :loading="isLoading">
          Importar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
