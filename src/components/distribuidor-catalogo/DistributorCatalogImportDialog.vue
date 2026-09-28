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

const isSubmitting = ref(false)
const selectedSupplier = ref(null)
const customSupplierName = ref('')
const isNewSupplier = ref(false)
const importMode = ref('replace') // replace or append
const fileInput = ref(null)
const selectedFile = ref(null)
const parsedRows = ref([])
const previewRows = ref([])
const totalParsed = ref(0)
const detectedCategories = ref([])
const parseError = ref('')

watch(() => props.isDialogVisible, val => {
  if (val) {
    selectedSupplier.value = props.selectedSupplierId && props.selectedSupplierId !== 'all' ? props.selectedSupplierId : (props.suppliers[0]?.id || null)
    customSupplierName.value = ''
    isNewSupplier.value = false
    importMode.value = 'replace'
    selectedFile.value = null
    parsedRows.value = []
    previewRows.value = []
    totalParsed.value = 0
    detectedCategories.value = []
    parseError.value = ''
  }
})

// Parsear CSV en el navegador de manera robusta
const parseCSV = text => {
  if (!text) {
    throw new Error('El archivo está vacío.')
  }

  // Eliminar BOM (Byte Order Mark) de UTF-8 si existe
  const cleanText = text.replace(/^\uFEFF/, '')
  const rawLines = cleanText.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0)

  if (rawLines.length < 2) {
    throw new Error('El archivo no contiene suficientes filas de datos.')
  }

  // 1. Detectar delimitador inspeccionando las primeras 10 líneas
  const sample = rawLines.slice(0, Math.min(10, rawLines.length)).join('\n')
  const countCommas = (sample.match(/,/g) || []).length
  const countSemicolons = (sample.match(/;/g) || []).length
  const countTabs = (sample.match(/\t/g) || []).length

  let delimiter = ','
  if (countSemicolons > countCommas && countSemicolons > countTabs) {
    delimiter = ';'
  } else if (countTabs > countCommas && countTabs > countSemicolons) {
    delimiter = '\t'
  }

  // Función para parsear una línea respetando comillas y caracteres especiales (como comillas de pulgadas 14" o 1/2")
  const parseLine = line => {
    const values = []
    let current = ''
    let inQuotedField = false
    let i = 0

    while (i < line.length) {
      const char = line[i]

      if (!inQuotedField) {
        if (char === '"' && current.trim() === '') {
          inQuotedField = true
          current = ''
          i++
        } else if (char === delimiter) {
          values.push(current.trim().replace(/^"|"$/g, '').trim())
          current = ''
          i++
        } else {
          current += char
          i++
        }
      } else {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"'
            i += 2
          } else if (
            i + 1 === line.length ||
            line[i + 1] === delimiter ||
            line[i + 1] === '\r' ||
            line[i + 1] === '\n'
          ) {
            inQuotedField = false
            i++
          } else {
            current += '"'
            i++
          }
        } else {
          current += char
          i++
        }
      }
    }
    values.push(current.trim().replace(/^"|"$/g, '').trim())
    return values
  }

  // 2. Buscar la fila de cabeceras en las primeras 15 líneas
  let headerRowIndex = 0
  let rawHeaders = []
  let colMap = {
    code: -1,
    description: -1,
    reference: -1,
    price: -1,
    category_code: -1,
    category_name: -1,
    stock_status: -1,
  }

  const headerKeywords = ['code', 'codigo', 'cod', 'sku', 'descripcion', 'description', 'detalle', 'nombre', 'referencia', 'precio', 'price', 'costo']

  for (let r = 0; r < Math.min(15, rawLines.length); r++) {
    const cols = parseLine(rawLines[r]).map(h => h.toLowerCase().trim())
    const matches = cols.filter(c => headerKeywords.some(k => c.includes(k)))
    if (matches.length >= 2 || (matches.length >= 1 && (cols.includes('code') || cols.includes('codigo') || cols.includes('cod')))) {
      headerRowIndex = r
      rawHeaders = cols
      break
    }
  }

  if (rawHeaders.length === 0) {
    headerRowIndex = 0
    rawHeaders = parseLine(rawLines[0]).map(h => h.toLowerCase().trim())
  }

  const getColIndex = (exactMatches, partialMatches = []) => {
    for (const name of exactMatches) {
      const idx = rawHeaders.indexOf(name)
      if (idx !== -1) return idx
    }
    for (const part of partialMatches) {
      const idx = rawHeaders.findIndex(h => h.includes(part))
      if (idx !== -1) return idx
    }
    return -1
  }

  colMap = {
    code: getColIndex(['code', 'codigo', 'cod', 'sku', 'item', 'parte'], ['codigo', 'sku', 'cod']),
    description: getColIndex(['description', 'descripcion', 'nombre', 'detalle', 'articulo', 'producto'], ['desc', 'nom', 'detal']),
    reference: getColIndex(['reference', 'referencia', 'ref', 'oem', 'cod_oem', 'cross'], ['referencia', 'ref', 'oem']),
    price: getColIndex(['price', 'precio', 'costo', 'pvp', 'valor', 'p_publico'], ['prec', 'cost', 'pvp', 'val']),
    category_code: getColIndex(['category_code', 'cod_categoria', 'codigo_categoria', 'category_id', 'cod_cat', 'id_cat'], ['category_code', 'cod_cat', 'id_cat']),
    category_name: getColIndex(['category_name', 'nombre_categoria', 'categoria_nombre', 'category', 'categoria', 'grupo', 'linea', 'familia'], ['category_name', 'categoria', 'nom_cat', 'grup']),
    stock_status: getColIndex(['stock_status', 'stock', 'estado', 'disponibilidad', 'status', 'existencia', 'disp'], ['stock_status', 'estado', 'disponib', 'exist']),
  }

  // Fallbacks si no se encontraron columnas por nombre
  if (colMap.code === -1) colMap.code = 0
  if (colMap.description === -1) colMap.description = rawHeaders.length > 1 ? 1 : 0
  if (colMap.reference === -1 && rawHeaders.length > 2) colMap.reference = 2
  if (colMap.price === -1 && rawHeaders.length > 3) colMap.price = 3
  if (colMap.category_code === -1 && rawHeaders.length > 4) colMap.category_code = 4
  if (colMap.category_name === -1 && rawHeaders.length > 5) colMap.category_name = 5
  if (colMap.stock_status === -1 && rawHeaders.length > 6) colMap.stock_status = 6

  const items = []
  const catsSet = new Set()

  for (let i = headerRowIndex + 1; i < rawLines.length; i++) {
    const cols = parseLine(rawLines[i])
    if (!cols || cols.length === 0 || (cols.length === 1 && !cols[0])) continue

    const code = String(cols[colMap.code] || '').trim()
    const description = String(cols[colMap.description] || (cols[1] || '')).trim()
    
    // Si no tiene código ni descripción, ignorar fila vacía
    if (!code && !description) continue

    const refVal = colMap.reference !== -1 && cols[colMap.reference] ? String(cols[colMap.reference]).trim() : ''
    const rawPrice = colMap.price !== -1 && cols[colMap.price] !== undefined ? String(cols[colMap.price]) : '0'
    let catCode = colMap.category_code !== -1 && cols[colMap.category_code] ? String(cols[colMap.category_code]).trim() : ''
    let catName = colMap.category_name !== -1 && cols[colMap.category_name] ? String(cols[colMap.category_name]).trim().toUpperCase() : 'GENERAL'
    const stockVal = colMap.stock_status !== -1 && cols[colMap.stock_status] ? String(cols[colMap.stock_status]).trim() : 'Disponible'

    // Si la categoría detectada es un número y el category_code es texto, intercambiarlos
    if (catName && /^\d+$/.test(catName.trim()) && catCode && !/^\d+$/.test(catCode.trim())) {
      const temp = catName
      catName = catCode.toUpperCase()
      catCode = temp
    }

    if (!catName || catName === '0' || catName === '-') {
      catName = 'GENERAL'
    }

    catsSet.add(catName)

    // Formatear precio
    const cleanPrice = parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0

    items.push({
      code: code || description.slice(0, 20),
      description: description || code,
      reference: refVal || null,
      price: cleanPrice,
      category_code: catCode || null,
      category_name: catName,
      stock_status: stockVal || 'Disponible',
    })
  }

  return {
    items,
    categories: Array.from(catsSet),
  }
}

const handleFileUpload = event => {
  const file = event.target.files?.[0]
  if (!file) return
  processFile(file)
}

const handleDrop = event => {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  processFile(file)
}

const processFile = file => {
  selectedFile.value = file
  parseError.value = ''
  
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const text = e.target.result
      const { items, categories } = parseCSV(text)
      parsedRows.value = items
      previewRows.value = items.slice(0, 5)
      totalParsed.value = items.length
      detectedCategories.value = categories
    } catch (err) {
      console.error('Error al parsear archivo:', err)
      parseError.value = err.message || 'Error al procesar el archivo CSV.'
      parsedRows.value = []
      previewRows.value = []
      totalParsed.value = 0
    }
  }
  reader.readAsText(file, 'UTF-8')
}

const submitImport = async () => {
  if (parsedRows.value.length === 0) {
    showNotification('Por favor selecciona un archivo con datos válidos', 'warning')
    return
  }

  let supplierId = selectedSupplier.value
  let supplierName = ''

  if (isNewSupplier.value) {
    if (!customSupplierName.value.trim()) {
      showNotification('Ingresa el nombre del nuevo distribuidor', 'warning')
      return
    }
    supplierName = customSupplierName.value.trim().toUpperCase()
    supplierId = null
  } else {
    const found = props.suppliers.find(s => s.id === supplierId)
    supplierName = found ? found.name : 'DISTRIBUIDOR'
  }

  isSubmitting.value = true
  try {
    const response = await $api('distributor-catalog/import', {
      method: 'POST',
      body: {
        supplier_id: supplierId,
        supplier_name: supplierName,
        mode: importMode.value,
        items: parsedRows.value,
      },
    })

    if (response?.success) {
      showNotification(response.message || 'Catálogo importado exitosamente', 'success')
      emit('imported', response.data?.supplier_id || supplierId)
      emit('update:isDialogVisible', false)
    } else {
      showNotification(response?.message || 'Error al importar catálogo', 'error')
    }
  } catch (error) {
    console.error('Error en importación:', error)
    const msg = error?.response?.data?.message || 'Error al subir catálogo de distribuidor'
    showNotification(msg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

const formatCurrency = val => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(val) || 0)
}

const filterSupplier = (value, query, item) => {
  if (!query) return true
  const q = String(query).toLowerCase().trim()
  const name = String(item.raw?.name || '').toLowerCase()
  const ruc = String(item.raw?.ruc || '').toLowerCase()
  const phone = String(item.raw?.phone || '').toLowerCase()
  const id = String(item.raw?.id || '')
  return name.includes(q) || ruc.includes(q) || phone.includes(q) || id.includes(q)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="850"
    persistent
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="rounded-xl overflow-hidden border">
      <!-- Header -->
      <VCardItem class="bg-primary text-white py-4 px-6">
        <template #prepend>
          <VAvatar size="42" color="white" variant="tonal" class="rounded-lg me-2">
            <VIcon icon="ri-file-upload-line" size="26" color="white" />
          </VAvatar>
        </template>
        <VCardTitle class="text-h6 font-weight-bold text-white">
          Importar Catálogo / Lista de Precios de Distribuidor
        </VCardTitle>
        <VCardSubtitle class="text-white text-opacity-90 text-caption mt-0.5">
          Soporta archivos CSV con cabeceras: code, description, reference, price, category_name, stock_status
        </VCardSubtitle>
        <template #append>
          <VBtn icon="ri-close-line" variant="text" color="white" density="compact" @click="emit('update:isDialogVisible', false)" />
        </template>
      </VCardItem>

      <VCardText class="pa-6 bg-background">
        <!-- Paso 1: Distribuidor y Modo -->
        <VCard class="border rounded-xl mb-4 bg-surface elevation-0 pa-4">
          <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center gap-2 text-primary">
            <VIcon icon="ri-store-2-line" size="18" />
            <span>1. Seleccionar Distribuidor y Modo de Carga</span>
          </div>

          <VRow dense>
            <VCol cols="12" sm="7">
              <div v-if="!isNewSupplier">
                <VAutocomplete
                  v-model="selectedSupplier"
                  :items="props.suppliers"
                  item-title="name"
                  item-value="id"
                  :custom-filter="filterSupplier"
                  label="Buscar Proveedor / Distribuidor"
                  placeholder="Ingresa dígitos de RUC o nombre (ej: JAROMA)..."
                  prepend-inner-icon="ri-search-2-line"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  hide-details="auto"
                  clearable
                >
                  <template #item="{ props: itemProps, item }">
                    <VListItem v-bind="itemProps" :title="item.raw.name">
                      <template #subtitle>
                        <span class="text-caption text-medium-emphasis">
                          RUC: <strong class="font-mono text-primary">{{ item.raw.ruc || 'S/N' }}</strong> · {{ item.raw.total_items || 0 }} productos actuales
                        </span>
                      </template>
                    </VListItem>
                  </template>
                  <template #selection="{ item }">
                    <div class="d-flex align-center gap-2">
                      <span class="font-weight-semibold">{{ item.raw.name }}</span>
                      <span v-if="item.raw.ruc" class="text-caption font-mono text-medium-emphasis">({{ item.raw.ruc }})</span>
                    </div>
                  </template>
                </VAutocomplete>
              </div>

              <div v-else>
                <VTextField
                  v-model="customSupplierName"
                  label="Nombre del Nuevo Distribuidor"
                  placeholder="Ej: JAROMA, IMPORTADORA X, etc."
                  prepend-inner-icon="ri-add-box-line"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                  hide-details="auto"
                />
              </div>

              <div class="mt-1">
                <VBtn
                  variant="text"
                  size="small"
                  color="primary"
                  class="px-0 font-weight-medium"
                  @click="isNewSupplier = !isNewSupplier"
                >
                  {{ isNewSupplier ? '← Seleccionar distribuidor existente' : '+ Crear nuevo distribuidor' }}
                </VBtn>
              </div>
            </VCol>

            <VCol cols="12" sm="5">
              <VRadioGroup v-model="importMode" inline density="compact" hide-details="auto" class="mt-1">
                <div class="d-flex flex-column gap-1">
                  <VRadio
                    value="replace"
                    label="Reemplazar catálogo completo"
                    color="primary"
                  />
                  <VRadio
                    value="append"
                    label="Agregar / Actualizar a los existentes"
                    color="primary"
                  />
                </div>
              </VRadioGroup>
            </VCol>
          </VRow>
        </VCard>

        <!-- Paso 2: Zona de Carga de Archivo -->
        <VCard class="border rounded-xl mb-4 bg-surface elevation-0 pa-4">
          <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center gap-2 text-primary">
            <VIcon icon="ri-file-text-line" size="18" />
            <span>2. Subir Archivo CSV</span>
          </div>

          <div
            class="upload-dropzone rounded-xl pa-6 text-center cursor-pointer border-dashed"
            @dragover.prevent
            @drop.prevent="handleDrop"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".csv,.txt,.tsv"
              class="d-none"
              @change="handleFileUpload"
            />
            <VAvatar size="54" color="primary" variant="tonal" class="mb-2">
              <VIcon icon="ri-upload-cloud-2-line" size="28" />
            </VAvatar>
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis">
              {{ selectedFile ? selectedFile.name : 'Haz clic o arrastra tu archivo CSV aquí' }}
            </div>
            <p class="text-caption text-medium-emphasis mb-0 mt-1">
              Archivos delimitados por comas o punto y coma (.csv) con cabeceras estándar
            </p>
          </div>

          <VAlert v-if="parseError" type="error" variant="tonal" class="mt-3 rounded-lg" density="compact">
            {{ parseError }}
          </VAlert>
        </VCard>

        <!-- Paso 3: Previsualización de Datos -->
        <div v-if="totalParsed > 0">
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-subtitle-2 font-weight-bold d-flex align-center gap-2 text-success">
              <VIcon icon="ri-checkbox-circle-line" size="18" />
              <span>Vista previa ({{ totalParsed }} registros detectados, {{ detectedCategories.length }} categorías)</span>
            </div>
            <VChip size="small" color="success" variant="tonal" class="font-weight-bold">
              Listo para importar
            </VChip>
          </div>

          <VCard class="border rounded-xl bg-surface elevation-0 overflow-hidden mb-2">
            <VTable density="compact" class="text-caption preview-table">
              <thead>
                <tr class="bg-slate-50 text-uppercase font-weight-bold">
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Referencia</th>
                  <th>Categoría</th>
                  <th class="text-right">Precio</th>
                  <th class="text-center">Stock</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in previewRows" :key="idx">
                  <td class="font-mono font-weight-bold text-primary">{{ row.code }}</td>
                  <td class="text-truncate" style="max-width: 250px;">{{ row.description }}</td>
                  <td class="font-mono">{{ row.reference || '-' }}</td>
                  <td>
                    <VChip size="x-small" color="secondary" variant="tonal">{{ row.category_name }}</VChip>
                  </td>
                  <td class="text-right font-weight-bold font-mono">{{ formatCurrency(row.price) }}</td>
                  <td class="text-center">
                    <VChip size="x-small" :color="row.stock_status.includes('Disponible') ? 'success' : 'warning'" variant="flat">
                      {{ row.stock_status }}
                    </VChip>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VCard>
          <div class="text-caption text-disabled text-center">
            Mostrando las primeras 5 filas de {{ totalParsed }} productos
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-surface d-flex justify-space-between">
        <VBtn variant="outlined" color="secondary" @click="emit('update:isDialogVisible', false)">
          Cancelar
        </VBtn>

        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-check-line"
          :loading="isSubmitting"
          :disabled="totalParsed === 0"
          class="font-weight-bold px-6"
          @click="submitImport"
        >
          Confirmar e Importar {{ totalParsed > 0 ? `(${totalParsed} items)` : '' }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped lang="scss">
.upload-dropzone {
  border: 2px dashed rgba(var(--v-theme-primary), 0.35);
  background-color: rgba(var(--v-theme-primary), 0.02);
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.05);
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.preview-table {
  th, td {
    padding: 6px 12px !important;
  }
}
</style>
