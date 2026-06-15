<script setup>
import { ref, computed, onMounted } from 'vue'
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
  'addInvoice',
])

// Global Toast
const { showNotification } = useGlobalToast()

// Definir el estado reactivo para almacenar los datos XML
const xmlData = ref(null)
const error_exist = ref("")  // Para mostrar errores si es necesario

// Variables reactivas para el desglose matemático
const totalAsumidoTerceros = ref(0)
const isSharedInvoice = ref(false)

// Extraemos los totales limpios del XML
const xmlTotals = computed(() => {
  if (!xmlData.value?.infoFactura) return { subtotal: 0, iva: 0, total: 0 }

  const subtotalRaw = parseFloat(xmlData.value.infoFactura.totalSinImpuestos || 0)

  let ivaRaw = 0
  const impuestos = xmlData.value.infoFactura.totalConImpuestos?.totalImpuesto
  if (Array.isArray(impuestos)) {
    ivaRaw = impuestos.reduce((sum, imp) => sum + parseFloat(imp.valor || 0), 0)
  } else if (impuestos) {
    ivaRaw = parseFloat(impuestos.valor || 0)
  }

  const totalRaw = parseFloat(xmlData.value.infoFactura.importeTotal || 0)

  return {
    subtotal: Number(subtotalRaw.toFixed(2)),
    iva: Number(ivaRaw.toFixed(2)),
    total: Number(totalRaw.toFixed(2))
  }
})

// Cálculo para Terceros (Basado en el input del usuario)
const tercerosMath = computed(() => {
  const total = Number((parseFloat(totalAsumidoTerceros.value) || 0).toFixed(2))
  const subtotal = Number((total / 1.15).toFixed(2))
  const iva = Number((total - subtotal).toFixed(2))

  return { subtotal, iva, total }
})

// Cálculo Gasto Real Taller (Por diferencia para asegurar cuadre matemático)
const tallerMath = computed(() => {
  const total = Number((xmlTotals.value.total - tercerosMath.value.total).toFixed(2))
  const subtotal = Number((xmlTotals.value.subtotal - tercerosMath.value.subtotal).toFixed(2))
  const iva = Number((xmlTotals.value.iva - tercerosMath.value.iva).toFixed(2))

  return { subtotal, iva, total }
})

// Validación estricta
const isMathValid = computed(() => {
  if (!xmlData.value) return true

  const assumedTotal = Number((parseFloat(totalAsumidoTerceros.value) || 0).toFixed(2))

  if (assumedTotal < 0 || assumedTotal > xmlTotals.value.total) return false

  const sumSubtotals = Number((tallerMath.value.subtotal + tercerosMath.value.subtotal).toFixed(2))
  const sumIvas = Number((tallerMath.value.iva + tercerosMath.value.iva).toFixed(2))

  return sumSubtotals === xmlTotals.value.subtotal && sumIvas === xmlTotals.value.iva
})

// Drag and drop state
const isDragging = ref(false)
const fileInputRef = ref(null)
const selectedFile = ref(null)

const handleFileUpload = event => {
  const file = event.target.files ? event.target.files[0] : null

  if (file) {
    console.log("Archivo seleccionado:", file.name)
    const isXmlFile = file.type === "application/xml" || file.type === "text/xml" || file.name.toLowerCase().endsWith(".xml")
    if (isXmlFile) {
      const reader = new FileReader()
      reader.onload = function (e) {
        let xmlString = e.target.result

        // 1. Decodificar entidades HTML si el XML viene escapado (muy común en correos de ERPs)
        if (xmlString.includes('&lt;factura') || xmlString.includes('&lt;Factura')) {
          const txt = document.createElement("textarea")
          txt.innerHTML = xmlString
          xmlString = txt.value
        }

        let facturaData = null

        // 2. Extraer estrictamente el nodo <factura> ignorando sobres Autorización, CDATA, SOAP, etc.
        const match = xmlString.match(/<factura[\s\S]*?<\/factura>/i)

        const parser = new XMLParser({
          ignoreAttributes: false,
          cdataPropName: '#cdata-section',
          textNodeName: '#text',
          ignoreDeclaration: true,
        })

        if (match) {
          const cleanXml = match[0].trim()
          try {
            const parsed = parser.parse(cleanXml)
            facturaData = parsed.factura || parsed.Factura
          } catch (parseError) {
            console.error('Error parsing extracted XML:', parseError)
          }
        } else {
          // Fallback tradicional por si acaso
          try {
            const parsed = parser.parse(xmlString)
            if (parsed.factura) {
              facturaData = parsed.factura
            } else if (parsed.autorizacion && parsed.autorizacion.comprobante) {
              let comp = parsed.autorizacion.comprobante
              if (typeof comp === 'string') {
                comp = comp.replace('<![CDATA[', '').replace(']]>', '')
                const innerParsed = parser.parse(comp)
                facturaData = innerParsed.factura || innerParsed.Factura
              } else if (comp['#cdata-section'] || comp['#text']) {
                let inner = comp['#cdata-section'] || comp['#text'] || ''
                inner = inner.replace('<![CDATA[', '').replace(']]>', '')
                const innerParsed = parser.parse(inner)
                facturaData = innerParsed.factura || innerParsed.Factura
              }
            } else if (parsed.comprobante && parsed.comprobante.factura) {
              facturaData = parsed.comprobante.factura
            }
          } catch (e) {
            console.error('Error in fallback parsing:', e)
          }
        }

        if (facturaData) {
          xmlData.value = facturaData
          error_exist.value = ''
        } else {
          error_exist.value = 'No se pudo extraer la factura del XML. Asegúrate de enviar un comprobante SRI válido o un XML de factura directo.'
          clearSelectedFile(true)
        }
      }

      // Leer el archivo como texto
      reader.readAsText(file)
    } else {
      error_exist.value = "Por favor, selecciona un archivo XML válido."
      clearSelectedFile(true)
    }
  } else {
    error_exist.value = "No se ha seleccionado ningún archivo."
  }
}

// Radios con iconos (tipo string para compatibilidad)
const radioContent = [
  { title: 'Productos', value: '1', icon: 'ri-rocket-line' },
  { title: 'Gastos/Insumos', value: '2', icon: 'ri-user-line' },
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

  let items = []
  // Manejar diferentes estructuras posibles
  if (Array.isArray(xmlData.value.detalles.detalle)) {
    items = xmlData.value.detalles.detalle
  } else if (xmlData.value.detalles.detalle && typeof xmlData.value.detalles.detalle === 'object') {
    items = [xmlData.value.detalles.detalle]
  } else if (Array.isArray(xmlData.value.detalles)) {
    items = xmlData.value.detalles
  }

  // Inicializar estado de selección
  items.forEach(item => {
    if (item._selectedForInventory === undefined) {
      item._selectedForInventory = true
    }
  })

  return items
}

const calculateTercerosFromUnchecked = () => {
  let autoTotal = 0
  const items = getDetallesArray()
  items.forEach(item => {
    if (item._selectedForInventory === false) {
      let itemTotal = parseFloat(item.precioTotalSinImpuesto || 0)
      let itemIva = 0
      if (item.impuestos && item.impuestos.impuesto) {
        let imp = item.impuestos.impuesto
        if (Array.isArray(imp)) {
          itemIva = imp.reduce((s, i) => s + parseFloat(i.valor || 0), 0)
        } else {
          itemIva = parseFloat(imp.valor || 0)
        }
      }
      autoTotal += itemTotal + itemIva
    }
  })
  totalAsumidoTerceros.value = Number(autoTotal.toFixed(2))
}

const toggleSharedInvoice = () => {
  if (!isSharedInvoice.value) {
    totalAsumidoTerceros.value = 0
    getDetallesArray().forEach(i => i._selectedForInventory = true)
  }
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
    if (file.name.toLowerCase().endsWith('.xml')) {
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

const formatFileSize = bytes => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const clearSelectedFile = (preserveError = false) => {
  selectedFile.value = null
  xmlData.value = null
  if (!preserveError) {
    error_exist.value = ''
  }
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

    if (isSharedInvoice.value) {
      formData.append('taller_subtotal', tallerMath.value.subtotal)
      formData.append('taller_iva', tallerMath.value.iva)
      formData.append('taller_total', tallerMath.value.total)

      formData.append('terceros_subtotal', tercerosMath.value.subtotal)
      formData.append('terceros_iva', tercerosMath.value.iva)
      formData.append('terceros_total', tercerosMath.value.total)

      const selectedIndices = [];
      getDetallesArray().forEach((item, index) => {
        if (item._selectedForInventory) {
          selectedIndices.push(index);
        }
      });
      formData.append('selected_indices', JSON.stringify(selectedIndices));
    }

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
  isSharedInvoice.value = false
  totalAsumidoTerceros.value = 0
  emit('update:isDialogVisible', false)
}

onMounted(() => {
  error_exist.value = null
  success.value = null
})
</script>

<template>
  <VDialog v-model="props.isDialogVisible" max-width="1100" scrollable persistent transition="dialog-bottom-transition">
    <VCard class="rounded-xl overflow-hidden elevation-24 d-flex flex-column" style="max-height: 90vh;">
      <VOverlay :model-value="loader.loading" class="align-center justify-center" contained persistent>
        <VProgressCircular color="primary" indeterminate size="64" />
      </VOverlay>

      <!-- Header con Gradiente Premium -->
      <div class="gradient-header px-6 py-4 d-flex align-center justify-space-between text-white flex-shrink-0">
        <div class="d-flex align-center gap-3">
          <VAvatar color="rgba(255,255,255,0.15)" size="38">
            <VIcon color="white" size="22">
              ri-file-upload-line
            </VIcon>
          </VAvatar>
          <div>
            <div class="text-h6 font-weight-bold leading-tight" style="color: white !important;">
              Importar Factura XML
            </div>
            <div class="text-caption text-white opacity-80" style="color: white !important;">
              Carga comprobantes
              autorizados por el SRI
            </div>
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
          <input ref="fileInputRef" type="file" accept=".xml" class="d-none" @change="onFileSelected">

          <template v-if="!selectedFile">
            <VIcon size="56" color="primary" class="mb-3 pulse-icon">
              ri-upload-cloud-2-line
            </VIcon>
            <div class="text-body-1 font-weight-bold text-high-emphasis">
              Arrastra tu archivo XML aquí
            </div>
            <div class="text-caption text-medium-emphasis mt-1">
              o haz clic para explorar en tu ordenador (.xml)
            </div>
          </template>
          <template v-else>
            <div class="d-flex align-center gap-3 w-100 pa-2 bg-white rounded-lg border shadow-sm">
              <VAvatar color="primary-lighten-5" size="44" rounded class="mr-1">
                <VIcon color="primary" size="24">
                  ri-file-code-fill
                </VIcon>
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
        <!-- Alerta de Error removida de aquí para evitar duplicación -->

        <!-- Selector de Categoría de Destino -->
        <div class="category-section pa-4 rounded-xl border bg-white shadow-sm">
          <div class="d-flex align-center gap-2 mb-3">
            <VIcon color="info" size="20">
              ri-folder-shared-line
            </VIcon>
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
              <VIcon color="primary" size="22">
                ri-file-list-3-line
              </VIcon>
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Detalles de la Factura Encontrada
              </span>
            </div>
            <VChip color="success" size="small" variant="tonal" class="font-weight-bold">
              SRI Válido
            </VChip>
          </div>

          <!-- Tipo de Factura (Normal vs Compartida) -->
          <div class="category-section pa-4 rounded-xl border bg-white shadow-sm mb-4">
            <div class="d-flex align-center justify-space-between mb-1">
              <div class="d-flex align-center gap-2">
                <VIcon color="primary" size="20">ri-pie-chart-2-line</VIcon>
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
                  ¿Es una Factura Compartida?
                </span>
              </div>
              <VSwitch v-model="isSharedInvoice" color="primary" density="compact" hide-details
                @update:model-value="toggleSharedInvoice" />
            </div>
            <div class="text-caption text-medium-emphasis">
              Activa esta opción si solo una parte de la factura corresponde al taller. Podrás elegir qué ítems son de
              terceros.
            </div>
          </div>

          <!-- Datos de Cabecera planos -->
          <VRow class="mb-4 bg-white rounded-lg pa-4 border shadow-sm">
            <VCol cols="12" sm="4" class="py-2">
              <div class="d-flex align-start gap-2">
                <VAvatar color="primary-lighten-5" size="32">
                  <VIcon color="primary" size="18">
                    ri-building-line
                  </VIcon>
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis font-weight-bold">
                    Proveedor
                  </div>
                  <div class="text-body-2 font-weight-black text-truncate" style="max-width: 200px;"
                    :title="xmlData.infoTributaria?.razonSocial">
                    {{ xmlData.infoTributaria?.razonSocial || 'N/A' }}
                  </div>
                  <div v-if="xmlData.infoTributaria?.ruc" class="text-caption text-medium-emphasis">
                    RUC: {{ xmlData.infoTributaria.ruc }}
                  </div>
                </div>
              </div>
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <div class="d-flex align-start gap-2">
                <VAvatar color="success-lighten-5" size="32">
                  <VIcon color="success" size="18">
                    ri-hashtag
                  </VIcon>
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis font-weight-bold">
                    Número de Factura
                  </div>
                  <div class="text-body-2 font-weight-black text-success">
                    {{ (String(xmlData.infoTributaria?.secuencial || '0')).padStart(9, '0') }}
                  </div>
                  <div v-if="xmlData.infoTributaria?.estab" class="text-caption text-medium-emphasis">
                    {{ xmlData.infoTributaria.estab }}-{{ xmlData.infoTributaria.ptoEmi }}
                  </div>
                </div>
              </div>
            </VCol>
            <!-- abc -->
            <VCol cols="12" sm="4" class="py-2">
              <div class="d-flex align-start gap-2">
                <VAvatar color="info-lighten-5" size="32">
                  <VIcon color="info" size="18">
                    ri-calendar-line
                  </VIcon>
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis font-weight-bold">
                    Fecha Emisión
                  </div>
                  <div class="text-body-2 font-weight-black">
                    {{ xmlData.infoFactura?.fechaEmision || 'N/A' }}
                  </div>
                </div>
              </div>
            </VCol>
          </VRow>

          <!-- Tabla de Items Plana, sin bordes laterales ni contenedores adicionales -->
          <div class="d-flex align-center justify-space-between mb-3">
            <div class="text-subtitle-2 font-weight-bold d-flex align-center gap-2">
              <VIcon size="18" color="primary">ri-shopping-cart-2-line</VIcon>
              <span>Productos / Ítems</span>
              <VChip size="x-small" color="primary" class="font-weight-bold">
                {{ getDetallesArray()?.length || 0 }} items
              </VChip>
            </div>
          </div>

          <div class="preview-table-wrap">
            <VTable density="compact" class="preview-table clean-table mb-4">
              <thead>
                <tr>
                  <th v-if="isSharedInvoice" class="text-center font-weight-bold py-2 border-b" style="width: 50px;">
                    <VIcon size="16">ri-store-2-line</VIcon>
                  </th>
                  <th class="text-left font-weight-bold py-2 border-b" style="width: 150px;">
                    Código
                  </th>
                  <th class="text-left font-weight-bold py-2 border-b">
                    Descripción
                  </th>
                  <th class="text-center font-weight-bold py-2 border-b" style="width: 70px;">
                    Cant.
                  </th>
                  <th class="text-right font-weight-bold py-2 border-b" style="width: 100px;">
                    Unit.
                  </th>
                  <th class="text-right font-weight-bold py-2 border-b" style="width: 110px;">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in getDetallesArray()" :key="index"
                  :class="{ 'opacity-50': isSharedInvoice && !item._selectedForInventory }">
                  <td v-if="isSharedInvoice" class="text-center">
                    <VCheckbox v-model="item._selectedForInventory" color="success" density="compact" hide-details
                      class="d-inline-flex mt-1" @update:model-value="calculateTercerosFromUnchecked" />
                  </td>
                  <td class="text-truncate font-weight-bold text-caption" style="max-width: 150px;">
                    {{ item.codigoPrincipal || item.codigoAuxiliar || '-' }}
                  </td>
                  <td class="text-truncate font-weight-medium" style="max-width: 350px;">
                    <VTooltip location="top" open-on-hover v-if="item.descripcion && item.descripcion.length > 45">
                      <template #activator="{ props: tooltipProps }">
                        <span v-bind="tooltipProps">{{ item.descripcion.substring(0, 45) + '...' }}</span>
                      </template>
                      <span>{{ item.descripcion }}</span>
                    </VTooltip>
                    <span v-else>{{ item.descripcion || 'Sin descripción' }}</span>
                  </td>
                  <td class="text-center">
                    <VChip color="grey-darken-2" variant="tonal" size="x-small" class="font-weight-bold">
                      {{ parseFloat(item.cantidad || 0).toFixed(0) }}
                    </VChip>
                  </td>
                  <td class="text-right text-caption">
                    ${{ parseFloat(item.precioUnitario || 0).toFixed(2) }}
                  </td>
                  <td class="text-right font-weight-bold text-info">
                    ${{ parseFloat(item.precioTotalSinImpuesto ||
                      0).toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>

          <!-- Resumen Total -->
          <div class="d-flex justify-end pt-2">
            <div class="summary-card pa-4 rounded-xl border bg-white shadow-sm" style="min-width: 280px;">
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-caption text-medium-emphasis">Subtotal:</span>
                <span class="text-body-2 font-weight-bold">${{ (parseFloat(xmlData.infoFactura?.totalSinImpuestos || 0)
                  +
                  parseFloat(xmlData.infoFactura?.totalDescuento || 0)).toFixed(2) }}</span>
              </div>
              <div v-if="parseFloat(xmlData.infoFactura?.totalDescuento || 0) > 0"
                class="d-flex justify-space-between align-center mb-2">
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

          <!-- División de Pago (Taller vs Terceros) -->
          <div v-if="isSharedInvoice" class="mt-6 border-t pt-4">
            <div class="d-flex align-center gap-2 mb-4">
              <VIcon color="primary" size="22">ri-pie-chart-2-line</VIcon>
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                División de Gasto (Taller vs Terceros)
              </span>
            </div>

            <VRow>
              <VCol cols="12" md="4">
                <VTextField v-model.number="totalAsumidoTerceros" type="number" label="Total Asumido por Terceros"
                  prefix="$" variant="outlined" density="comfortable" hint="Monto pagado por la otra compañía"
                  persistent-hint :max="xmlTotals.total" min="0" step="0.01" />
              </VCol>

              <VCol cols="12" md="8">
                <VRow>
                  <!-- Gasto Taller -->
                  <VCol cols="12" sm="6">
                    <VCard class="elevation-0 border bg-success-lighten-5" :class="{ 'border-error': !isMathValid }">
                      <VCardText class="pa-4">
                        <div class="text-subtitle-2 font-weight-bold text-success mb-2">
                          <VIcon icon="ri-store-2-line" size="18" class="mr-1" /> Gasto Real Taller
                        </div>
                        <div class="d-flex justify-space-between text-caption">
                          <span>Subtotal:</span>
                          <span class="font-weight-bold">${{ tallerMath.subtotal.toFixed(2) }}</span>
                        </div>
                        <div class="d-flex justify-space-between text-caption">
                          <span>IVA:</span>
                          <span class="font-weight-bold">${{ tallerMath.iva.toFixed(2) }}</span>
                        </div>
                        <VDivider class="my-1" />
                        <div class="d-flex justify-space-between text-body-2 font-weight-bold text-success">
                          <span>TOTAL:</span>
                          <span>${{ tallerMath.total.toFixed(2) }}</span>
                        </div>
                      </VCardText>
                    </VCard>
                  </VCol>

                  <!-- Gasto Terceros -->
                  <VCol cols="12" sm="6">
                    <VCard class="elevation-0 border bg-warning-lighten-5">
                      <VCardText class="pa-4">
                        <div class="text-subtitle-2 font-weight-bold text-warning mb-2">
                          <VIcon icon="ri-user-shared-line" size="18" class="mr-1" /> Gasto Terceros
                        </div>
                        <div class="d-flex justify-space-between text-caption">
                          <span>Subtotal:</span>
                          <span class="font-weight-bold">${{ tercerosMath.subtotal.toFixed(2) }}</span>
                        </div>
                        <div class="d-flex justify-space-between text-caption">
                          <span>IVA:</span>
                          <span class="font-weight-bold">${{ tercerosMath.iva.toFixed(2) }}</span>
                        </div>
                        <VDivider class="my-1" />
                        <div class="d-flex justify-space-between text-body-2 font-weight-bold text-warning">
                          <span>TOTAL:</span>
                          <span>${{ tercerosMath.total.toFixed(2) }}</span>
                        </div>
                      </VCardText>
                    </VCard>
                  </VCol>
                </VRow>
              </VCol>
            </VRow>

            <VAlert v-if="!isMathValid" type="error" variant="tonal" class="mt-4" density="compact">
              Error: El total asumido por terceros no puede ser mayor al total de la factura. Revisa los valores
              ingresados.
            </VAlert>
          </div>
        </div>
      </VCardText>

      <!-- Alertas de Error Global del Modal -->
      <div v-if="error_exist" class="px-6 pb-2">
        <VAlert type="error" variant="tonal"
          class="rounded-xl border border-error bg-error-lighten-5 d-flex align-center" icon="ri-error-warning-fill"
          closable @click:close="error_exist = ''">
          <span class="text-body-2 font-weight-bold">{{ error_exist }}</span>
        </VAlert>
      </div>
      <!-- Footer -->
      <VCardActions class="justify-end px-6 pb-6 pt-2 bg-grey-lighten-4 border-t gap-2">
        <VBtn color="secondary" variant="tonal" rounded="lg" prepend-icon="ri-close-line" @click="onFormReset">
          Cancelar
        </VBtn>

        <VBtn color="primary" variant="flat" rounded="lg" prepend-icon="ri-upload-cloud-2-line"
          :loading="loader.loading" :disabled="!selectedFile || !isMathValid" @click="storeXml">
          Importar XML
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
