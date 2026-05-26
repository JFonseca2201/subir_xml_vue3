<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { XMLParser } from "fast-xml-parser"
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'addInvoice'
])

// Global Toast
const { showNotification } = useGlobalToast()

// Definir el estado reactivo para almacenar los datos XML
const xmlData = ref(null)
const error_exist = ref("")  // Para mostrar errores si es necesario

// Drag and drop state
const isDragging = ref(false)
const fileInputRef = ref(null)
const selectedFile = ref(null)

const handleFileUpload = event => {
  const file = event.target.files ? event.target.files[0] : null

  if (file) {
    console.log("Archivo seleccionado:", file.name)
    if (file.type === "application/xml" || file.type === "text/xml" || file.name.endsWith(".xml")) {
      const reader = new FileReader()

      reader.onload = function (e) {
        const xmlString = e.target.result
        const parser = new XMLParser()
        const result = parser.parse(xmlString)

        if (result.autorizacion && result.autorizacion.comprobante) {
          const innerXmlString = result.autorizacion.comprobante.replace("<![CDATA[", "").replace("]]>", "")
          const innerParser = new XMLParser()
          const innerResult = innerParser.parse(innerXmlString)

          if (innerResult.factura) {
            xmlData.value = innerResult.factura
            error_exist.value = ""
          } else {
            error_exist.value = "Error al parsear XML interno. No se encontró la factura."
            clearSelectedFile()
          }
        } else {
          error_exist.value = "Error al parsear XML. No se encontró el nodo de 'comprobante'."
          clearSelectedFile()
        }
      }

      // Leer el archivo como texto
      reader.readAsText(file)
    } else {
      error_exist.value = "Por favor, selecciona un archivo XML válido."
      clearSelectedFile()
    }
  } else {
    error_exist.value = "No se ha seleccionado ningún archivo."
  }
}

// Radios con iconos (tipo string para compatibilidad)
const radioContent = [
  { title: 'Productos', value: '1', icon: 'ri-rocket-line' },
  { title: 'Gastos', value: '2', icon: 'ri-user-line' },
  { title: 'Serv./Mant.', value: '3', icon: 'ri-vip-crown-line' },
  { title: 'Herramienta', value: '4', icon: 'ri-tools-line' },
]

const selectedRadio = ref('1') // siempre string para el componente

// Loader
const loader = useLoaderStore()
const success = ref(null)
const msg = ref(null)

// Función helper para obtener los detalles de forma segura
const getDetallesArray = () => {
  if (!xmlData.value || !xmlData.value.detalles) return []

  // Manejar diferentes estructuras posibles
  if (Array.isArray(xmlData.value.detalles.detalle)) {
    return xmlData.value.detalles.detalle
  } else if (xmlData.value.detalles.detalle && typeof xmlData.value.detalles.detalle === 'object') {
    return [xmlData.value.detalles.detalle]
  } else if (Array.isArray(xmlData.value.detalles)) {
    return xmlData.value.detalles
  }

  return []
}

// Selección de archivo
const onFileSelected = event => {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
    handleFileUpload(event)
  }
}

// Drag & Drop
const onFileDropped = event => {
  isDragging.value = false
  const file = event.dataTransfer.files[0]
  if (file) {
    if (file.name.endsWith('.xml')) {
      selectedFile.value = file
      const mockEvent = { target: { files: [file] } }
      handleFileUpload(mockEvent)
    } else {
      error_exist.value = "Por favor, selecciona un archivo XML válido."
    }
  }
}

const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const clearSelectedFile = () => {
  selectedFile.value = null
  xmlData.value = null
  error_exist.value = ''
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// Enviar XML al backend
const storeXml = async () => {
  error_exist.value = null
  success.value = null

  if (!selectedFile.value) {
    error_exist.value = "Selecciona un archivo XML primero"
    return
  }

  try {
    loader.start()

    const formData = new FormData()
    formData.append('xml', selectedFile.value)
    formData.append('item_type', selectedRadio.value)

    const resp = await $api('invoices/import-xml', {
      method: 'POST',
      body: formData,
      onResponseError({ response }) {
        const data = response._data || {}

        // 1. Extraer errores de validación específicos (Laravel errors array)
        if (data.errors && typeof data.errors === 'object') {
          const errorMessages = []
          for (const key in data.errors) {
            if (Array.isArray(data.errors[key])) {
              errorMessages.push(...data.errors[key])
            } else if (typeof data.errors[key] === 'string') {
              errorMessages.push(data.errors[key])
            }
          }
          if (errorMessages.length > 0) {
            error_exist.value = errorMessages.join(' | ')
            return
          }
        }

        // 2. Extraer detalle de excepción del backend (data.error)
        if (data.error && typeof data.error === 'string') {
          error_exist.value = `${data.message || 'Error'}: ${data.error}`
          return
        }

        // 3. Mostrar mensaje simple devuelto por el servidor
        error_exist.value = data.message || 'Error al importar XML'
      },
    })

    // Mensaje de éxito
    const successMessage = resp?._data?.message || resp?.message || 'Factura importada correctamente'
    showNotification(successMessage, 'success')

    // Refrescar formulario y emitir nueva factura
    onFormReset()
    emit('addInvoice', resp.data)

  } catch (error) {
    console.error('Error capturado en importación:', error)
    // Conservar el error específico extraído, o parsear el del error lanzado
    if (!error_exist.value) {
      const serverError = error.response?._data || {}
      if (serverError.errors && typeof serverError.errors === 'object') {
        const messages = []
        for (const key in serverError.errors) {
          if (Array.isArray(serverError.errors[key])) {
            messages.push(...serverError.errors[key])
          } else {
            messages.push(serverError.errors[key])
          }
        }
        error_exist.value = messages.join(' | ')
      } else {
        error_exist.value = serverError.error || serverError.message || 'Error de servidor o de conexión al intentar importar el XML.'
      }
    }
  } finally {
    loader.stop()
  }
}

// Reset del modal
const onFormReset = () => {
  error_exist.value = null
  success.value = null
  selectedFile.value = null
  xmlData.value = null  // Limpiar los datos de previsualización
  emit('update:isDialogVisible', false)
}

onMounted(() => {
  error_exist.value = null
  success.value = null
})
</script>

<template>
  <VDialog v-model="props.isDialogVisible" max-width="850" scrollable persistent transition="dialog-bottom-transition">
    <VCard class="rounded-xl overflow-hidden elevation-24 d-flex flex-column" style="max-height: 90vh;">
      <VOverlay :model-value="loader.loading" class="align-center justify-center" contained persistent>
        <VProgressCircular color="primary" indeterminate size="64" />
      </VOverlay>

      <!-- Header con Gradiente Premium -->
      <div class="gradient-header px-6 py-4 d-flex align-center justify-space-between text-white flex-shrink-0">
        <div class="d-flex align-center gap-3">
          <VAvatar color="rgba(255,255,255,0.15)" size="38">
            <VIcon color="white" size="22">ri-file-upload-line</VIcon>
          </VAvatar>
          <div>
            <div class="text-h6 font-weight-bold leading-tight" style="color: white !important;">Importar Factura XML
            </div>
            <div class="text-caption text-white opacity-80" style="color: white !important;">Carga comprobantes
              autorizados por el SRI</div>
          </div>
        </div>
        <VBtn icon="ri-close-line" variant="text" color="white" density="comfortable" @click="onFormReset" />
      </div>

      <!-- Contenido -->
      <VCardText class="pa-6 d-flex flex-column gap-5 bg-slate-50 flex-grow-1" style="overflow-y: auto;">

        <!-- Drag & Drop Zone Premium -->
        <div
          class="drag-drop-zone d-flex flex-column align-center justify-center border-dashed rounded-xl pa-8 cursor-pointer transition-all text-center"
          :class="{ 'drag-over': isDragging, 'has-file': selectedFile }" @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false" @drop.prevent="onFileDropped" @click="triggerFileInput">
          <!-- Hidden Input -->
          <input ref="fileInputRef" type="file" accept=".xml" class="d-none" @change="onFileSelected" />

          <template v-if="!selectedFile">
            <VIcon size="56" color="primary" class="mb-3 pulse-icon">ri-upload-cloud-2-line</VIcon>
            <div class="text-body-1 font-weight-bold text-high-emphasis">Arrastra tu archivo XML aquí</div>
            <div class="text-caption text-medium-emphasis mt-1">o haz clic para explorar en tu ordenador (.xml)</div>
          </template>
          <template v-else>
            <div class="d-flex align-center gap-3 w-100 pa-2 bg-white rounded-lg border shadow-sm">
              <VAvatar color="primary-lighten-5" size="44" rounded class="mr-1">
                <VIcon color="primary" size="24">ri-file-code-fill</VIcon>
              </VAvatar>
              <div class="flex-grow-1 text-left">
                <div class="text-body-1 font-weight-bold text-high-emphasis text-truncate" style="max-width: 450px;">
                  {{ selectedFile.name }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatFileSize(selectedFile.size) }}
                </div>
              </div>
              <VBtn icon="ri-close-line" variant="text" color="error" size="small" @click.stop="clearSelectedFile" />
            </div>
          </template>
        </div>

        <!-- Selector de Categoría de Destino -->
        <div class="category-section pa-4 rounded-xl border bg-white shadow-sm">
          <div class="d-flex align-center gap-2 mb-3">
            <VIcon color="info" size="20">ri-folder-shared-line</VIcon>
            <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
              Categoría de destino en Inventario
            </span>
          </div>
          <CustomRadiosWithIcon v-model:selected-radio="selectedRadio" :radio-content="radioContent"
            :grid-column="{ sm: '3', cols: '12' }" class="square-radio" />
        </div>

        <!-- Vista previa de Factura XML -->
        <div v-if="xmlData && xmlData.infoTributaria" class="animate-fade-in mt-2">
          <!-- Título principal de sección -->
          <div class="d-flex align-center justify-space-between mb-4 border-b pb-2">
            <div class="d-flex align-center gap-2">
              <VIcon color="primary" size="22">ri-file-list-3-line</VIcon>
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Detalles de la Factura Encontrada
              </span>
            </div>
            <VChip color="success" size="small" variant="tonal" class="font-weight-bold">
              SRI Válido
            </VChip>
          </div>

          <!-- Datos de Cabecera planos -->
          <VRow class="mb-4 bg-white rounded-lg pa-4 border shadow-sm">
            <VCol cols="12" sm="4" class="py-2">
              <div class="d-flex align-start gap-2">
                <VAvatar color="primary-lighten-5" size="32">
                  <VIcon color="primary" size="18">ri-building-line</VIcon>
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis font-weight-bold">Proveedor</div>
                  <div class="text-body-2 font-weight-black text-truncate" style="max-width: 200px;"
                    :title="xmlData.infoTributaria?.razonSocial">
                    {{ xmlData.infoTributaria?.razonSocial || 'N/A' }}
                  </div>
                  <div class="text-caption text-medium-emphasis" v-if="xmlData.infoTributaria?.ruc">
                    RUC: {{ xmlData.infoTributaria.ruc }}
                  </div>
                </div>
              </div>
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <div class="d-flex align-start gap-2">
                <VAvatar color="success-lighten-5" size="32">
                  <VIcon color="success" size="18">ri-hashtag</VIcon>
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis font-weight-bold">Número de Factura</div>
                  <div class="text-body-2 font-weight-black text-success">
                    {{ (String(xmlData.infoTributaria?.secuencial || '0')).padStart(9, '0') }}
                  </div>
                  <div class="text-caption text-medium-emphasis" v-if="xmlData.infoTributaria?.estab">
                    {{ xmlData.infoTributaria.estab }}-{{ xmlData.infoTributaria.ptoEmi }}
                  </div>
                </div>
              </div>
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <div class="d-flex align-start gap-2">
                <VAvatar color="info-lighten-5" size="32">
                  <VIcon color="info" size="18">ri-calendar-line</VIcon>
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis font-weight-bold">Fecha Emisión</div>
                  <div class="text-body-2 font-weight-black">
                    {{ xmlData.infoFactura?.fechaEmision || 'N/A' }}
                  </div>
                </div>
              </div>
            </VCol>
          </VRow>

          <!-- Tabla de Items Plana, sin bordes laterales ni contenedores adicionales -->
          <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center gap-2">
            <VIcon size="18" color="primary">ri-shopping-cart-2-line</VIcon>
            <span>Productos / Ítems</span>
            <VChip size="x-small" color="primary" class="font-weight-bold">{{ getDetallesArray()?.length || 0 }} items
            </VChip>
          </div>

          <VTable density="compact" class="preview-table clean-table mb-4">
            <thead>
              <tr>
                <th class="text-left font-weight-bold py-2 border-b">Descripción</th>
                <th class="text-center font-weight-bold py-2 border-b" style="width: 70px;">Cant.</th>
                <th class="text-right font-weight-bold py-2 border-b" style="width: 100px;">Unit.</th>
                <th class="text-right font-weight-bold py-2 border-b" style="width: 110px;">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in getDetallesArray()" :key="index">
                <td class="text-truncate font-weight-medium" style="max-width: 320px;">
                  {{ item.descripcion || 'Sin descripción' }}
                </td>
                <td class="text-center">
                  <VChip color="grey-darken-2" variant="tonal" size="x-small" class="font-weight-bold">
                    {{ parseFloat(item.cantidad || 0).toFixed(0) }}
                  </VChip>
                </td>
                <td class="text-right text-caption">${{ parseFloat(item.precioUnitario || 0).toFixed(2) }}</td>
                <td class="text-right font-weight-bold text-info">${{ parseFloat(item.precioTotalSinImpuesto ||
                  0).toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </VTable>

          <!-- Resumen Total -->
          <div class="d-flex justify-end pt-2">
            <div class="summary-card pa-4 rounded-xl border bg-white shadow-sm" style="min-width: 280px;">
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-caption text-medium-emphasis">Subtotal:</span>
                <span class="text-body-2 font-weight-bold">${{ (parseFloat(xmlData.infoFactura?.totalSinImpuestos || 0)
                  +
                  parseFloat(xmlData.infoFactura?.totalDescuento || 0)).toFixed(2) }}</span>
              </div>
              <div class="d-flex justify-space-between align-center mb-2"
                v-if="parseFloat(xmlData.infoFactura?.totalDescuento || 0) > 0">
                <span class="text-caption text-error">Descuento:</span>
                <span class="text-body-2 font-weight-bold text-error">-${{
                  parseFloat(xmlData.infoFactura?.totalDescuento ||
                    0).toFixed(2) }}</span>
              </div>
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-caption text-medium-emphasis">IVA (15%):</span>
                <span class="text-body-2 font-weight-bold">${{
                  parseFloat(xmlData.infoFactura?.totalConImpuestos?.totalImpuesto?.valor || 0).toFixed(2) }}</span>
              </div>
              <VDivider class="my-2" />
              <div class="d-flex justify-space-between align-center">
                <span class="text-subtitle-1 font-weight-bold text-high-emphasis font-weight-black">TOTAL
                  FACTURA:</span>
                <span class="text-h6 font-weight-black text-success">${{ parseFloat(xmlData.infoFactura?.importeTotal ||
                  0).toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>
      </VCardText>

      <!-- Alertas -->
      <br>
      <VAlert v-if="error_exist" type="error" variant="tonal" class="rounded-xl mt-2">
        {{ error_exist }}
      </VAlert>
      <br>
      <!-- Footer -->
      <VCardActions class="justify-end px-6 pb-6 pt-2 bg-grey-lighten-4 border-t gap-2">
        <VBtn color="secondary" variant="tonal" rounded="lg" prepend-icon="ri-close-line" @click="onFormReset">
          Cancelar
        </VBtn>

        <VBtn color="primary" variant="flat" rounded="lg" prepend-icon="ri-upload-cloud-2-line"
          :loading="loader.loading" :disabled="!selectedFile" @click="storeXml">
          Importar XML
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.gradient-header {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-info)));
}

.preview-card-header {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.85), rgba(var(--v-theme-info), 0.85));
}

.drag-drop-zone {
  border: 2px dashed rgba(var(--v-theme-primary), 0.35);
  background: rgba(var(--v-theme-primary), 0.02);
  transition: all 0.25s ease-in-out;
}

.drag-drop-zone:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
  transform: translateY(-2px);
}

.drag-drop-zone.drag-over {
  border-color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.05);
}

.drag-drop-zone.has-file {
  border: 1px solid rgba(var(--v-theme-success), 0.3);
  background: rgba(var(--v-theme-success), 0.02);
}

.pulse-icon {
  animation: pulse-animation 2s infinite;
}

@keyframes pulse-animation {
  0% {
    transform: scale(1);
    opacity: 0.9;
  }

  50% {
    transform: scale(1.08);
    opacity: 1;
  }

  100% {
    transform: scale(1);
    opacity: 0.9;
  }
}

.animate-fade-in {
  animation: fadeIn 0.35s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.preview-table th {
  font-size: 0.7rem !important;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.clean-table {
  background: transparent !important;
  border-collapse: collapse;
}

.clean-table th,
.clean-table td {
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
}

.clean-table th {
  border-bottom: 2px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}

.clean-table td {
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.5)) !important;
}

.backdrop-blur {
  backdrop-filter: blur(4px);
}

/* 🔹 Botones de radios cuadrados y compactos */
.square-radio button {
  padding: 0 !important;
  font-size: 0.6rem !important;
  width: 36px !important;
  height: 36px !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: unset !important;
  line-height: 1 !important;
}

.square-radio .icon-class {
  width: 16px !important;
  height: 16px !important;
  margin-bottom: 1px;
}

.square-radio {
  gap: 2px;
}
</style>
