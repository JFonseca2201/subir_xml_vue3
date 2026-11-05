<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDisplay } from 'vuetify'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import DistributorCatalogImportDialog from '@/components/distribuidor-catalogo/DistributorCatalogImportDialog.vue'

const { xs: isMobileScreen } = useDisplay()
const { showNotification } = useGlobalToast()

// ==================== ESTADO PRINCIPAL ====================
const suppliers = ref([])
const uploadedCatalogs = ref([])
const isLoadingCatalogs = ref(false)
const isLoadingSuppliers = ref(false)

// Filtros de listado
const selectedSupplierId = ref('all')
const selectedStatus = ref('all')

// Búsqueda de texto dentro de los catálogos PDF (Escenario 1)
const searchQuery = ref('')
const debouncedSearch = ref('')
const pdfResults = ref([])
const isPdfSearching = ref(false)
const totalPdfResults = ref(0)
const pdfCurrentPage = ref(1)
const pdfPerPage = ref(10)

// Modal flotante de resultados de búsqueda (v-dialog)
const isSearchDialogVisible = ref(false)

// Modal de subida de catálogo PDF
const isImportDialogVisible = ref(false)

// Modal de confirmación para eliminar catálogo
const isDeleteDialogVisible = ref(false)
const catalogToDelete = ref(null)
const isDeletingCatalog = ref(false)

// Timer para polling automático si hay archivos en estado 'processing' o 'pending'
let pollingTimer = null

// ==================== OPCIONES Y COMPUTADOS ====================
const statusOptions = [
  { title: 'Todos los estados', value: 'all' },
  { title: 'Indexados (Completados)', value: 'completed' },
  { title: 'En procesamiento', value: 'processing' },
  { title: 'Con error', value: 'failed' },
]

/**
 * REQUERIMIENTO 3: Filtro Estricto por Proveedores con PDF.
 * Solo lista a aquellos distribuidores que tengan un catálogo PDF
 * subido y procesado en el sistema ('completed'). Los demás quedan excluidos.
 */
const supplierOptions = computed(() => {
  const processedCatalogs = uploadedCatalogs.value.filter(
    c => c.status === 'completed' && c.supplier_id
  )

  const map = new Map()
  for (const cat of processedCatalogs) {
    const sid = String(cat.supplier_id)
    if (!map.has(sid)) {
      const sObj = suppliers.value.find(s => String(s.id) === sid)
      map.set(sid, {
        id: cat.supplier_id,
        name: cat.supplier_name || sObj?.name || `Distribuidor #${cat.supplier_id}`,
        ruc: cat.supplier?.ruc || sObj?.ruc || null,
        catalog_count: 1,
      })
    } else {
      map.get(sid).catalog_count += 1
    }
  }

  const list = Array.from(map.values())

  return [
    {
      title: `Todos los Distribuidores con PDF (${list.length})`,
      value: 'all',
      name: 'Todos los Distribuidores con PDF',
      ruc: null,
    },
    ...list.map(s => ({
      title: `${s.name}${s.ruc ? ` (${s.ruc})` : ''} — ${s.catalog_count} PDF${s.catalog_count > 1 ? 's' : ''}`,
      value: s.id,
      name: s.name,
      ruc: s.ruc,
      count: s.catalog_count,
    })),
  ]
})

// Catálogos filtrados para la tabla principal
const filteredCatalogs = computed(() => {
  let list = [...uploadedCatalogs.value]

  if (selectedSupplierId.value && selectedSupplierId.value !== 'all') {
    list = list.filter(c => String(c.supplier_id) === String(selectedSupplierId.value))
  }

  if (selectedStatus.value && selectedStatus.value !== 'all') {
    list = list.filter(c => c.status === selectedStatus.value)
  }

  return list
})

// KPIs / Métricas calculadas en base a los catálogos subidos
const kpis = computed(() => {
  const all = uploadedCatalogs.value
  const uniqueSuppliers = new Set(
    all.filter(c => c.status === 'completed').map(c => c.supplier_id)
  ).size
  const totalPages = all.reduce((sum, c) => sum + (Number(c.total_pages) || 0), 0)
  const completed = all.filter(c => c.status === 'completed').length
  const processing = all.filter(c => c.status === 'processing' || c.status === 'pending').length

  return {
    totalCatalogs: all.length,
    uniqueSuppliers,
    totalPages,
    completed,
    processing,
  }
})

// Total de páginas en resultados de búsqueda PDF
const totalPdfPages = computed(() => {
  return Math.ceil(totalPdfResults.value / pdfPerPage.value) || 1
})

/**
 * Función robusta para formatear / extraer precio referencial:
 * 1. Usa item.price retornado por el backend si está presente.
 * 2. Si no, extrae del snippet detectando números con 2 decimales (coma o punto: ej. 23,88 o 13.76).
 */
/**
 * Parsea y normaliza precios en cualquier formato:
 * - 1,500.00 / 12,450.50 (miles con coma, decimales con punto)
 * - 1.500,00 / 12.450,50 (miles con punto, decimales con coma)
 * - 23,88 / 23.88 / 0.50
 */
const parsePriceNumber = raw => {
  if (!raw) return null
  let str = String(raw).trim().replace(/[^\d,\.]/g, '')
  if (!str) return null

  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.')
    const lastComma = str.lastIndexOf(',')
    if (lastDot > lastComma) {
      str = str.replace(/,/g, '')
    } else {
      str = str.replace(/\./g, '').replace(',', '.')
    }
  } else if (str.includes(',')) {
    const parts = str.split(',')
    if (parts.length === 2 && parts[1].length === 2) {
      str = `${parts[0]}.${parts[1]}`
    } else {
      str = str.replace(/,/g, '')
    }
  }

  const val = parseFloat(str)
  return (!isNaN(val) && val >= 0.10 && val <= 99999) ? val.toFixed(2) : null
}

/**
 * REQUERIMIENTO 1: Extracción flexible de precios
 * Detecta precios con $ o USD o patrones numéricos decimales en cualquier posición
 */
const getItemPrice = item => {
  if (item?.price) {
    const parsed = parsePriceNumber(item.price)
    if (parsed) return parsed
  }

  // Fallback: extraer desde el snippet si el backend no lo devolvió
  if (item?.snippet) {
    const rawText = item.snippet.replace(/<[^>]+>/g, ' ')

    // 1. Con símbolo de moneda o prefijos (ej: $ 1,500.00 / USD 23.88 / PVP 45.00)
    const currencyMatch = rawText.match(/(?:[\$]|USD|US\$|U\$S|PVP|PRECIO)\s*:?\s*([0-9]{1,3}(?:[,\.][0-9]{3})*(?:[\.,][0-9]{2})|[0-9]+(?:[\.,][0-9]{2})?)/i)
    if (currencyMatch && currencyMatch[1]) {
      const p = parsePriceNumber(currencyMatch[1])
      if (p) return p
    }

    // 2. Número decimal cercano al término de búsqueda (después o antes)
    const searchTerm = debouncedSearch.value || searchQuery.value || ''
    if (searchTerm) {
      const words = searchTerm.trim().split(/\s+/).filter(w => w.length >= 2)
      for (const w of words) {
        const idx = rawText.toLowerCase().indexOf(w.toLowerCase())
        if (idx !== -1) {
          // Evaluar texto posterior (derecha)
          const afterSnippet = rawText.substring(idx)
          const matchAfter = afterSnippet.match(/(?:^|[\s\(\[\:\;\-])([0-9]{1,3}(?:[,.][0-9]{3})*(?:[.,][0-9]{2})|[0-9]{1,5}[.,][0-9]{2})(?=$|[\s\)\]\,\;\.\-])/)
          if (matchAfter && matchAfter[1]) {
            const p = parsePriceNumber(matchAfter[1])
            if (p) return p
          }
          // Evaluar texto anterior (izquierda: por si el precio precede a la descripción)
          const beforeSnippet = rawText.substring(Math.max(0, idx - 80), idx)
          const matchBefore = beforeSnippet.match(/(?:^|[\s\(\[\:\;\-])([0-9]{1,3}(?:[,.][0-9]{3})*(?:[.,][0-9]{2})|[0-9]{1,5}[.,][0-9]{2})(?=$|[\s\)\]\,\;\.\-])[^\d]*$/)
          if (matchBefore && matchBefore[1]) {
            const p = parsePriceNumber(matchBefore[1])
            if (p) return p
          }
        }
      }
    }

    // 3. Fallback general: cualquier número con formato de precio
    const matches = rawText.match(/(?:^|[\s\(\[\:\;\-])([0-9]{1,3}(?:[,.][0-9]{3})*(?:[.,][0-9]{2})|[0-9]{1,5}[.,][0-9]{2})(?=$|[\s\)\]\,\;\.\-])/g)
    if (matches && matches.length > 0) {
      for (const m of matches) {
        const p = parsePriceNumber(m)
        if (p) return p
      }
    }
  }

  return null
}

// ==================== MÉTODOS DE CARGA API ====================
const loadSuppliers = async () => {
  isLoadingSuppliers.value = true
  try {
    const res = await $api('suppliers', { params: { per_page: -1 } })
    if (res && res.suppliers) {
      suppliers.value = res.suppliers
    } else if (res && res.data) {
      suppliers.value = res.data
    } else if (Array.isArray(res)) {
      suppliers.value = res
    }
  } catch (err) {
    console.warn('Fallback al cargar proveedores de distributor-catalog/suppliers:', err)
    try {
      const fallback = await $api('distributor-catalog/suppliers')
      suppliers.value = fallback?.data || []
    } catch (e) {
      console.error('Error al cargar proveedores:', e)
    }
  } finally {
    isLoadingSuppliers.value = false
  }
}

const loadUploadedCatalogs = async () => {
  isLoadingCatalogs.value = true
  try {
    const params = {}
    if (selectedSupplierId.value && selectedSupplierId.value !== 'all') {
      params.supplier_id = selectedSupplierId.value
    }
    if (selectedStatus.value && selectedStatus.value !== 'all') {
      params.status = selectedStatus.value
    }

    const res = await $api('distributor-catalog-pdf/list', { params })
    if (res && res.success) {
      uploadedCatalogs.value = res.data || []
      checkPollingNeeded()
    }
  } catch (err) {
    console.error('Error al listar catálogos PDF:', err)
  } finally {
    isLoadingCatalogs.value = false
  }
}

// Polling suave si hay documentos procesándose en segundo plano
const checkPollingNeeded = () => {
  const hasProcessing = uploadedCatalogs.value.some(
    c => c.status === 'processing' || c.status === 'pending'
  )

  if (hasProcessing && !pollingTimer) {
    pollingTimer = setInterval(async () => {
      try {
        const res = await $api('distributor-catalog-pdf/list')
        if (res && res.success) {
          uploadedCatalogs.value = res.data || []
          const stillProcessing = uploadedCatalogs.value.some(
            c => c.status === 'processing' || c.status === 'pending'
          )
          if (!stillProcessing) {
            clearInterval(pollingTimer)
            pollingTimer = null
            showNotification('Procesamiento de catálogos PDF finalizado', 'success')
          }
        }
      } catch (e) {
        clearInterval(pollingTimer)
        pollingTimer = null
      }
    }, 4000)
  } else if (!hasProcessing && pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

// Búsqueda de texto plano en los índices independientes en disco
const searchPdfCatalogs = async (page = 1) => {
  const query = searchQuery.value ? searchQuery.value.trim() : ''
  if (!query || query.length < 2) {
    pdfResults.value = []
    totalPdfResults.value = 0
    return
  }

  isPdfSearching.value = true
  pdfCurrentPage.value = page
  debouncedSearch.value = query

  try {
    const params = {
      search: query,
      page: page,
      per_page: pdfPerPage.value,
    }
    if (selectedSupplierId.value && selectedSupplierId.value !== 'all') {
      params.supplier_id = selectedSupplierId.value
    }

    const response = await $api('distributor-catalog-pdf/search', { params })
    if (response && response.success) {
      pdfResults.value = response.data || []
      totalPdfResults.value = response.total || 0
      pdfCurrentPage.value = response.current_page || page
    }
  } catch (err) {
    console.error('Error al buscar en catálogos PDF:', err)
    showNotification('Error al buscar dentro de los PDFs', 'error')
  } finally {
    isPdfSearching.value = false
  }
}

/**
 * REQUERIMIENTO 1: Botón de Lupa y Apertura de v-dialog.
 * Abre el diálogo flotante con las coincidencias encontradas.
 */
const openSearchDialog = async () => {
  const query = searchQuery.value ? searchQuery.value.trim() : ''
  if (!query || query.length < 2) {
    showNotification('Ingresa al menos 2 caracteres para buscar en los catálogos PDF.', 'warning')
    return
  }

  isSearchDialogVisible.value = true
  await searchPdfCatalogs(1)
}

// ==================== REQUERIMIENTO 2: BÚSQUEDA EN TIEMPO REAL (INSTANT SEARCH) ====================
let searchDebounceTimer = null

// Observador reactivo con debounce de 300ms para ejecutar la búsqueda al instante mientras el usuario teclea
watch(searchQuery, newQuery => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  searchDebounceTimer = setTimeout(() => {
    const q = newQuery ? newQuery.trim() : ''
    if (q.length >= 2) {
      searchPdfCatalogs(1)
    } else {
      pdfResults.value = []
      totalPdfResults.value = 0
    }
  }, 300)
})

// Sincronizar cambios en el filtro de proveedor activo
watch([selectedSupplierId, selectedStatus], () => {
  loadUploadedCatalogs()
  if (searchQuery.value && searchQuery.value.trim().length >= 2) {
    searchPdfCatalogs(1)
  }
})

// Manejo de catálogo subido exitosamente
const handleCatalogUploaded = async () => {
  showNotification('Catálogo PDF registrado con éxito', 'success')
  await loadUploadedCatalogs()
}

// ==================== ELIMINACIÓN DE CATÁLOGO ====================
const openDeleteCatalogDialog = cat => {
  catalogToDelete.value = cat
  isDeleteDialogVisible.value = true
}

const closeDeleteDialog = () => {
  if (isDeletingCatalog.value) return
  isDeleteDialogVisible.value = false
  catalogToDelete.value = null
}

const confirmDeleteCatalog = async () => {
  if (!catalogToDelete.value) return
  isDeletingCatalog.value = true
  try {
    const res = await $api(`distributor-catalog-pdf/${catalogToDelete.value.id}`, { method: 'DELETE' })
    if (res && res.success) {
      showNotification('Catálogo PDF y su índice eliminados correctamente', 'success')
      closeDeleteDialog()
      await loadUploadedCatalogs()
      if (isSearchDialogVisible.value && searchQuery.value) {
        await searchPdfCatalogs(1)
      }
    } else {
      showNotification(res?.message || 'Error al eliminar catálogo', 'error')
    }
  } catch (err) {
    console.error('Error al eliminar catálogo PDF:', err)
    showNotification('Error al eliminar el archivo del servidor', 'error')
  } finally {
    isDeletingCatalog.value = false
  }
}

// ==================== FORMATEADORES ====================
const formatDate = dateStr => {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch (e) {
    return dateStr
  }
}

const getStatusBadge = status => {
  switch (status) {
    case 'completed':
      return { color: 'success', text: 'Indexado', icon: 'ri-checkbox-circle-line' }
    case 'processing':
      return { color: 'warning', text: 'Procesando...', icon: 'ri-loader-4-line' }
    case 'failed':
      return { color: 'error', text: 'Error', icon: 'ri-error-warning-line' }
    default:
      return { color: 'secondary', text: 'Pendiente', icon: 'ri-time-line' }
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  debouncedSearch.value = ''
  pdfResults.value = []
  totalPdfResults.value = 0
}

onMounted(async () => {
  await Promise.all([
    loadSuppliers(),
    loadUploadedCatalogs(),
  ])
})

onUnmounted(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
})
</script>

<template>
  <div class="pa-3 pa-sm-6 distributor-catalog-page">
    <!-- Encabezado Principal y Acciones (Rediseño Profesional y Moderno) -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-6">
      <div class="d-flex align-center gap-3.5 min-w-0">
        <VAvatar size="48" color="primary" variant="tonal" rounded="xl" class="flex-shrink-0 elevation-0">
          <VIcon icon="ri-file-pdf-2-line" size="26" color="primary" />
        </VAvatar>
        <div class="min-w-0">
          <h1 class="text-h5 text-sm-h4 font-weight-bold mb-0.5 text-high-emphasis text-truncate leading-tight">
            Catálogos de Distribuidores
          </h1>
          <p class="text-medium-emphasis mb-0 text-caption text-sm-body-2 text-truncate">
            Búsqueda instantánea de texto plano en índices independientes y gestión centralizada de PDFs
          </p>
        </div>
      </div>

      <div class="d-flex align-center justify-end gap-2 flex-wrap ms-auto">
        <VBtn color="primary" prepend-icon="ri-upload-cloud-2-line" size="default"
          class="elevation-1 font-weight-bold rounded-lg text-none px-4" @click="isImportDialogVisible = true">
          Subir Catálogo PDF
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-5" dense>
      <VCol cols="12" sm="6" md="3">
        <VCard
          class="kpi-stat-card elevation-0 border rounded-xl pa-3 pa-sm-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-file-pdf-2-line" size="22" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1 overflow-hidden">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Catálogos en Servidor
            </div>
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ kpis.totalCatalogs }} <span class="text-caption text-disabled font-weight-regular">archivos</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" md="3">
        <VCard
          class="kpi-stat-card elevation-0 border rounded-xl pa-3 pa-sm-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="42" color="info" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-building-line" size="22" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1 overflow-hidden">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Distribuidores con PDF
            </div>
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ kpis.uniqueSuppliers }} <span class="text-caption text-disabled font-weight-regular">activos</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" md="3">
        <VCard
          class="kpi-stat-card elevation-0 border rounded-xl pa-3 pa-sm-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="42" color="warning" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-pages-line" size="22" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1 overflow-hidden">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Páginas Indexadas
            </div>
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold text-warning text-truncate">
              {{ kpis.totalPages }} <span class="text-caption text-disabled font-weight-regular">páginas</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" md="3">
        <VCard
          class="kpi-stat-card elevation-0 border rounded-xl pa-3 pa-sm-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="42" :color="kpis.processing > 0 ? 'warning' : 'success'" variant="tonal" rounded="lg"
            class="flex-shrink-0">
            <VIcon :icon="kpis.processing > 0 ? 'ri-loader-4-line' : 'ri-checkbox-circle-line'" size="22" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1 overflow-hidden">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Estado de Indexación
            </div>
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold text-truncate"
              :class="kpis.processing > 0 ? 'text-warning' : 'text-success'">
              {{ kpis.processing > 0 ? `${kpis.processing} procesando...` : `${kpis.completed} listos` }}
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Tarjeta del Buscador en Catálogos PDF y Filtros -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4 pa-sm-5">
        <div class="d-flex align-center justify-space-between mb-3 flex-wrap gap-2">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-search-2-line" size="22" color="primary" />
            <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
              Buscar dentro de los Catálogos PDF
            </span>
          </div>

          <div class="d-flex align-center gap-2">

            <VBtn variant="text" color="error" size="small" prepend-icon="ri-filter-off-line"
              class="text-none font-weight-semibold"
              @click="clearSearch(); selectedSupplierId = 'all'; selectedStatus = 'all'">
              Limpiar Filtros
            </VBtn>
          </div>
        </div>

        <VRow dense class="gap-y-3 align-center">
          <!-- 1. VTextField con Botón de Lupa a la DERECHA y tecla Enter para abrir el v-dialog -->
          <VCol cols="12" md="8" lg="8">
            <VTextField v-model="searchQuery" label="Buscar palabras, modelos o códigos en los PDFs"
              prepend-inner-icon="ri-file-search-line" variant="outlined" density="comfortable" hide-details="auto"
              clearable color="primary" @keyup.enter="openSearchDialog" @click:clear="clearSearch">
              <!-- LUPA A LA DERECHA (append-inner) CON ACCIÓN DE APERTURA DE V-DIALOG -->
              <template #append-inner>
                <VBtn icon="ri-search-2-line" variant="tonal" size="small" color="primary" class="rounded-md"
                  title="Hacer clic en la lupa para buscar y abrir coincidencias" :loading="isPdfSearching"
                  @click="openSearchDialog" />
              </template>
            </VTextField>
          </VCol>

          <!-- 2. Filtro Estricto por Proveedores con PDF (Requerimiento 3) -->
          <VCol cols="12" sm="7" md="4" lg="4">
            <VSelect v-model="selectedSupplierId" :items="supplierOptions" item-title="title" item-value="value"
              label="Distribuidor con Catálogo" prepend-inner-icon="ri-store-2-line" variant="outlined"
              density="comfortable" hide-details="auto" color="primary" />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- LISTADO PRINCIPAL DE CATÁLOGOS PDF SUBIDOS EN EL SERVIDOR -->
    <div class="d-flex align-center justify-space-between mb-3 flex-wrap gap-2">
      <div class="d-flex align-center gap-2">
        <VIcon icon="ri-folder-open-line" size="20" color="primary" />
        <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
          Catálogos PDF en el Sistema ({{ filteredCatalogs.length }})
        </span>
      </div>

      <div class="d-flex align-center gap-2">
        <VBtn icon="ri-refresh-line" size="small" variant="tonal" color="secondary" :loading="isLoadingCatalogs"
          title="Recargar lista" @click="loadUploadedCatalogs" />
      </div>
    </div>

    <!-- Skeleton Loading -->
    <template v-if="isLoadingCatalogs && uploadedCatalogs.length === 0">
      <VCard class="rounded-xl border pa-6 bg-surface elevation-0">
        <VSkeletonLoader type="table-row@5" />
      </VCard>
    </template>

    <!-- Estado Vacío: No hay catálogos subidos -->
    <VCard v-else-if="filteredCatalogs.length === 0"
      class="rounded-xl border elevation-0 pa-8 pa-sm-10 text-center bg-surface">
      <VAvatar size="64" color="primary" variant="tonal" class="mb-3">
        <VIcon size="32" icon="ri-file-pdf-2-line" />
      </VAvatar>
      <h3 class="text-h6 font-weight-bold mb-1 text-high-emphasis">
        No hay catálogos PDF registrados
      </h3>
      <p class="text-body-2 text-medium-emphasis mb-4" style="max-width: 480px; margin: 0 auto;">
        Sube los catálogos en formato PDF de tus distribuidores. El sistema extraerá el texto plano de forma
        independiente
        para permitirte buscar rápidamente cualquier repuesto.
      </p>
      <VBtn color="primary" prepend-icon="ri-upload-cloud-2-line"
        class="font-weight-bold rounded-lg text-none elevation-1" @click="isImportDialogVisible = true">
        Subir Catálogo PDF Ahora
      </VBtn>
    </VCard>

    <!-- Contenedor de Catálogos (Tabla Desktop y Tarjetas Móvil) -->
    <div v-else>
      <!-- VISTA MÓVIL (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-3 mb-4">
        <VCard v-for="cat in filteredCatalogs" :key="`mob-cat-${cat.id}`"
          class="rounded-xl border elevation-0 pa-3.5 bg-surface">
          <!-- Fila Superior: Distribuidor y Estado -->
          <div class="d-flex align-center justify-space-between pb-2 border-b mb-2.5">
            <div class="d-flex align-center gap-2 min-w-0">
              <VAvatar size="28" color="primary" variant="tonal" rounded="md">
                <VIcon icon="ri-building-line" size="16" />
              </VAvatar>
              <span class="text-caption font-weight-bold text-high-emphasis text-truncate text-uppercase">
                {{ cat.supplier_name }}
              </span>
            </div>
            <VChip size="x-small" :color="getStatusBadge(cat.status).color" variant="tonal" class="font-weight-bold">
              <VIcon :icon="getStatusBadge(cat.status).icon" size="12" class="me-1"
                :class="cat.status === 'processing' ? 'rotate-animation' : ''" />
              {{ getStatusBadge(cat.status).text }}
            </VChip>
          </div>

          <!-- Fila Central: Título del Catálogo y Archivo -->
          <div class="d-flex align-start gap-3 mb-2.5">
            <VAvatar size="40" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0 mt-0.5">
              <VIcon icon="ri-file-pdf-2-line" size="22" />
            </VAvatar>
            <div class="min-w-0 flex-grow-1">
              <div class="font-weight-bold text-high-emphasis text-body-2 text-truncate" :title="cat.title">
                {{ cat.title || cat.file_name }}
              </div>
              <div class="text-caption text-medium-emphasis text-truncate font-mono">
                {{ cat.original_filename || cat.file_name }}
              </div>
              <div class="d-flex align-center gap-2 mt-1">
                <span class="text-caption text-medium-emphasis font-mono">
                  {{ cat.formatted_file_size || 'PDF' }}
                </span>
                <span class="text-disabled">•</span>
                <span class="text-caption text-primary font-weight-semibold">
                  {{ cat.total_pages ? `${cat.total_pages} págs.` : 'Procesando' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Fila Inferior: Fecha y Acciones -->
          <div class="d-flex align-center justify-space-between pt-2 border-t mt-2 flex-wrap gap-2">
            <span class="text-caption text-medium-emphasis">
              {{ formatDate(cat.created_at) }}
            </span>

            <div class="d-flex align-center gap-1 ms-auto">
              <VBtn v-if="cat.file_url" size="small" variant="tonal" color="primary" prepend-icon="ri-eye-line"
                class="rounded-lg text-none" :href="cat.file_url" target="_blank">
                Ver PDF
              </VBtn>

              <VBtn icon="ri-delete-bin-line" size="small" variant="tonal" color="error" class="rounded-lg"
                title="Eliminar catálogo" @click="openDeleteCatalogDialog(cat)" />
            </div>
          </div>
        </VCard>
      </div>

      <!-- VISTA ESCRITORIO: TABLA (d-none d-md-block) -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="distributor-pdf-table">
          <thead>
            <tr class="bg-background text-caption font-weight-bold text-uppercase">
              <th class="text-left py-4 px-4" style="width: 32%;">
                Distribuidor
              </th>
              <th class="text-left py-4 px-4" style="width: 32%;">
                Catálogo / Archivo PDF
              </th>
              <th class="text-center py-4 px-3" style="width: 100px;">
                Páginas
              </th>
              <th class="text-center py-4 px-3" style="width: 135px;">
                Estado
              </th>
              <th class="text-center py-4 px-3" style="width: 130px;">
                Fecha de Subida
              </th>
              <th class="text-center py-4 px-3" style="width: 125px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in filteredCatalogs" :key="cat.id" class="pdf-catalog-row">
              <!-- Distribuidor (Repartición 50% con Catálogo / text-truncate con title) -->
              <td class="py-4 px-4" style="width: 32%;">
                <div class="d-flex align-center gap-3 min-w-0">
                  <VAvatar size="36" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
                    <VIcon icon="ri-store-2-line" size="18" />
                  </VAvatar>
                  <div class="min-w-0 flex-grow-1 overflow-hidden">
                    <div class="font-weight-bold text-high-emphasis text-body-2 text-truncate"
                      :title="cat.supplier_name"
                      style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      {{ cat.supplier_name }}
                    </div>
                    <div v-if="cat.supplier?.ruc"
                      class="text-caption text-medium-emphasis font-mono text-truncate mt-0.5"
                      style="font-size: 0.72rem;" :title="`RUC: ${cat.supplier.ruc}`">
                      RUC: {{ cat.supplier.ruc }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Catálogo / Archivo PDF (Repartición 50% con Distribuidor / text-truncate con title) -->
              <td class="py-4 px-4" style="width: 32%;">
                <div class="d-flex align-center gap-3 min-w-0">
                  <VAvatar size="36" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
                    <VIcon icon="ri-file-pdf-2-line" size="18" />
                  </VAvatar>
                  <div class="min-w-0 flex-grow-1 overflow-hidden">
                    <div class="font-weight-bold text-high-emphasis text-body-2 text-truncate"
                      :title="cat.title || cat.file_name"
                      style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      {{ cat.title || cat.file_name }}
                    </div>
                    <div class="d-flex align-center gap-1.5 text-caption text-medium-emphasis font-mono mt-0.5"
                      style="font-size: 0.72rem;">
                      <span class="text-truncate"
                        style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;"
                        :title="cat.original_filename || cat.file_name">
                        {{ cat.original_filename || cat.file_name }}
                      </span>
                      <span class="text-disabled flex-shrink-0">•</span>
                      <span class="flex-shrink-0">{{ cat.formatted_file_size || 'PDF' }}</span>
                    </div>
                  </div>
                </div>
              </td>

              <!-- Páginas -->
              <td class="text-center py-4 px-3" style="width: 100px;">
                <VChip size="small" color="primary" variant="tonal" class="font-weight-bold font-mono px-2.5">
                  <VIcon icon="ri-pages-line" size="13" class="me-1" />
                  {{ cat.total_pages ? `${cat.total_pages} págs.` : '—' }}
                </VChip>
              </td>

              <!-- Estado -->
              <td class="text-center py-4 px-3" style="width: 135px;">
                <VChip size="small" :color="getStatusBadge(cat.status).color" variant="tonal"
                  class="font-weight-bold px-2.5" :title="getStatusBadge(cat.status).text">
                  <VIcon :icon="getStatusBadge(cat.status).icon" size="13" class="me-1"
                    :class="cat.status === 'processing' ? 'rotate-animation' : ''" />
                  <span>{{ getStatusBadge(cat.status).text }}</span>
                </VChip>
                <div v-if="cat.error_message" class="text-caption text-error text-truncate mt-1"
                  style="max-width: 125px; margin: 0 auto;" :title="cat.error_message">
                  {{ cat.error_message }}
                </div>
              </td>

              <!-- Fecha de Subida (Únicamente Fecha) -->
              <td class="text-center py-4 px-3 text-caption text-medium-emphasis font-mono" style="width: 130px;">
                <div class="d-flex align-center justify-center gap-1.5" :title="`Fecha: ${formatDate(cat.created_at)}`">
                  <VIcon icon="ri-calendar-line" size="14" class="text-disabled" />
                  <span>{{ formatDate(cat.created_at) }}</span>
                </div>
              </td>

              <!-- Acciones -->
              <td class="text-center py-4 px-3" style="width: 125px;">
                <div class="d-inline-flex align-center justify-center gap-1.5">
                  <VBtn v-if="cat.file_url" icon="ri-eye-line" size="small" variant="tonal" color="primary"
                    class="rounded-lg" title="Ver PDF en pestaña nueva" :href="cat.file_url" target="_blank" />

                  <VBtn v-if="cat.file_url" icon="ri-download-2-line" size="small" variant="tonal" color="secondary"
                    class="rounded-lg" title="Descargar PDF" :href="cat.file_url"
                    :download="cat.file_name || 'catalogo.pdf'" />

                  <VBtn icon="ri-delete-bin-line" size="small" variant="tonal" color="error" class="rounded-lg"
                    title="Eliminar catálogo" @click="openDeleteCatalogDialog(cat)" />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </div>

    <!-- ========================================================================= -->
    <!-- REQUERIMIENTOS 1, 2 Y 4: V-DIALOG FLOTANTE DE RESULTADOS DE BÚSQUEDA PDF -->
    <!-- ========================================================================= -->
    <VDialog v-model="isSearchDialogVisible" max-width="1140" scrollable transition="dialog-bottom-transition">
      <VCard class="custom-dialog-card rounded-xl elevation-16 overflow-hidden">
        <!-- Header Banner Primary (Estilo estándar de diálogos del sistema: Unified Dialog Headers System) -->
        <div class="custom-dialog-header-primary bg-primary text-white">
          <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn"
            title="Cerrar modal (Esc)" @click="isSearchDialogVisible = false" />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-search-eye-line" />
          </div>
          <h3 class="custom-dialog-title">
            Coincidencias en Catálogos PDF
          </h3>
          <p class="custom-dialog-subtitle">
            <span v-if="searchQuery || debouncedSearch">
              Resultados para: <strong>"{{ debouncedSearch || searchQuery }}"</strong> • {{ totalPdfResults }}
              coincidencia(s)
            </span>
            <span v-else>
              Búsqueda de texto plano e identificación de precios en catálogos oficiales
            </span>
          </p>
        </div>

        <!-- REQUERIMIENTO 2: Barra de Búsqueda Instantánea en Tiempo Real dentro del Modal -->
        <div class="pa-3 px-4 px-sm-5  border-b bg-background">
          <VRow dense align="center" class="gap-y-2 py-4">
            <VCol cols="12" sm="7" md="8">
              <VTextField v-model="searchQuery" label="Búsqueda instantánea en el texto de los PDFs"
                prepend-inner-icon="ri-search-2-line" variant="outlined" density="compact" hide-details="auto" clearable
                color="primary" placeholder="Escribe repuesto, modelo o código... (busca mientras tecleas)"
                @click:clear="clearSearch">
                <template #append-inner>
                  <VProgressCircular v-if="isPdfSearching" indeterminate size="18" width="2" color="primary"
                    class="me-1" />
                  <VChip v-else-if="searchQuery && searchQuery.trim().length >= 2" size="x-small" color="primary"
                    variant="tonal" class="font-mono font-weight-bold px-1.5">
                    Live
                  </VChip>
                </template>
              </VTextField>
            </VCol>

            <VCol cols="12" sm="5" md="4">
              <VSelect v-model="selectedSupplierId" :items="supplierOptions" item-title="title" item-value="value"
                label="Distribuidor con PDF" prepend-inner-icon="ri-store-2-line" variant="outlined" density="compact"
                hide-details="auto" color="primary" />
            </VCol>
          </VRow>
        </div>

        <!-- Cuerpo del Diálogo con Resultados Detallados -->
        <VCardText class="pa-4 pa-sm-5 overflow-y-auto" style="max-height: 65vh;">
          <!-- Indicador de Carga -->
          <div v-if="isPdfSearching" class="py-6">
            <VSkeletonLoader type="table-row@5" />
          </div>

          <!-- Listado de Coincidencias Encontradas -->
          <div v-else-if="pdfResults.length > 0">
            <!-- VISTA ESCRITORIO: TABLA DETALLADA (d-none d-md-table) -->
            <VTable hover class="d-none d-md-table border rounded-xl overflow-hidden mb-3 w-100">
              <thead>
                <tr class="text-caption font-weight-bold text-uppercase bg-background dialog-table-header">
                  <th class="text-left py-3 px-3" style="width: 210px;">Distribuidor / Catálogo</th>
                  <th class="text-left py-3 px-3">Fragmento del Texto en PDF</th>
                  <th class="text-center py-3 px-2" style="width: 125px;">Precio Ref.</th>
                  <th class="text-center py-3 px-2" style="width: 85px;">Página</th>
                  <th class="text-center py-3 px-2" style="width: 130px;">Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="res in pdfResults" :key="res.id" class="pdf-result-row">
                  <!-- Distribuidor y Catálogo -->
                  <td class="py-3 px-3" style="width: 210px;">
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-caption text-truncate"
                      :title="res.supplier_name">
                      {{ res.supplier_name }}
                    </div>
                    <div class="text-caption text-medium-emphasis text-truncate d-flex align-center gap-1 mt-0.5"
                      :title="res.catalog_title">
                      <VIcon icon="ri-file-pdf-2-line" size="13" class="text-primary flex-shrink-0" />
                      <span class="text-truncate" style="font-size: 0.73rem;">{{ res.catalog_title }}</span>
                    </div>
                  </td>

                  <!-- Fragmento Coincidente con Resaltado -->
                  <td class="py-3 px-3 text-wrap-break" style="white-space: normal;">
                    <div class="pdf-snippet-quote" v-html="res.snippet" />
                  </td>

                  <!-- Precio Asociado (Backend + Fallback Snippet con soporte coma decimal) -->
                  <td class="text-center py-3 px-2" style="width: 125px;">
                    <VChip v-if="getItemPrice(res)" size="small" color="success" variant="tonal"
                      class="font-weight-bold font-mono px-2.5">
                      <VIcon icon="ri-money-dollar-circle-line" size="14" class="me-1" />
                      ${{ getItemPrice(res) }}
                    </VChip>
                    <span v-else class="text-caption text-disabled font-mono">—</span>
                  </td>

                  <!-- Número de Página Exacto -->
                  <td class="text-center py-3 px-2" style="width: 85px;">
                    <VChip size="small" color="primary" variant="tonal" class="font-weight-bold font-mono px-2">
                      Pág. {{ res.page_number }}
                    </VChip>
                  </td>

                  <!-- Botón de Apertura Directa -->
                  <td class="text-center py-3 px-2" style="width: 130px;">
                    <VBtn size="small" color="primary" variant="tonal" prepend-icon="ri-external-link-line"
                      class="font-weight-bold rounded-lg text-none px-2.5" :href="res.pdf_url" target="_blank">
                      Abrir Pág. {{ res.page_number }}
                    </VBtn>
                  </td>
                </tr>
              </tbody>
            </VTable>

            <!-- VISTA MÓVIL: TARJETAS EN MODAL (d-md-none) -->
            <div class="d-md-none d-flex flex-column gap-3 mb-3">
              <VCard v-for="res in pdfResults" :key="`mob-res-${res.id}`" class="rounded-xl border pa-3 bg-surface">
                <div class="d-flex align-center justify-space-between mb-2 pb-1.5 border-b">
                  <div class="min-w-0">
                    <div class="font-weight-bold text-caption text-high-emphasis text-uppercase text-truncate">
                      {{ res.supplier_name }}
                    </div>
                    <div class="text-caption text-medium-emphasis text-truncate" style="font-size: 0.72rem;">
                      {{ res.catalog_title }}
                    </div>
                  </div>
                  <VChip size="x-small" color="primary" variant="tonal" class="font-weight-bold font-mono">
                    Pág. {{ res.page_number }}
                  </VChip>
                </div>

                <div class="pdf-snippet-quote mb-2" v-html="res.snippet" />

                <div class="d-flex align-center justify-space-between pt-1.5 border-t">
                  <div>
                    <VChip v-if="getItemPrice(res)" size="x-small" color="success" variant="tonal"
                      class="font-weight-bold font-mono">
                      <VIcon icon="ri-money-dollar-circle-line" size="12" class="me-1" />
                      ${{ getItemPrice(res) }}
                    </VChip>
                    <span v-else class="text-caption text-disabled">Sin precio ref.</span>
                  </div>

                  <VBtn size="small" color="primary" variant="tonal" prepend-icon="ri-external-link-line"
                    class="font-weight-bold rounded-lg text-none" :href="res.pdf_url" target="_blank">
                    Abrir Pág. {{ res.page_number }}
                  </VBtn>
                </div>
              </VCard>
            </div>

            <!-- Paginación dentro del Diálogo -->
            <div v-if="totalPdfPages > 1"
              class="d-flex justify-space-between align-center flex-wrap gap-2 pt-2 border-t">
              <span class="text-caption text-medium-emphasis">
                Página {{ pdfCurrentPage }} de {{ totalPdfPages }} ({{ totalPdfResults }} coincidencias)
              </span>
              <VPagination v-model="pdfCurrentPage" :length="totalPdfPages" :disabled="isPdfSearching" rounded="circle"
                density="comfortable" size="small" color="primary"
                @update:model-value="page => searchPdfCatalogs(page)" />
            </div>
          </div>

          <!-- Estado Vacío dentro del Modal -->
          <div v-else class="text-center pa-8">
            <VAvatar size="64" color="secondary" variant="tonal" class="mb-3">
              <VIcon icon="ri-search-line" size="32" />
            </VAvatar>
            <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
              No se encontraron coincidencias para "{{ debouncedSearch || searchQuery }}"
            </h4>
            <p class="text-caption text-medium-emphasis mb-3" style="max-width: 440px; margin: 0 auto;">
              Prueba buscando por número de parte, aplicación vehicular (ej: Corolla, Accent) o término de repuesto
              (bujía,
              pastilla, amortiguador).
            </p>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 d-flex justify-space-between align-center bg-surface">
          <div class="text-caption text-medium-emphasis d-none d-sm-block">
            Búsqueda en índices de texto plano en disco (Escenario 1)
          </div>
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line"
            class="rounded-lg px-5 font-weight-medium text-none ms-auto" height="38"
            @click="isSearchDialogVisible = false">
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal de Confirmación para Eliminar Catálogo PDF -->
    <VDialog v-model="isDeleteDialogVisible" max-width="460" persistent transition="dialog-bottom-transition">
      <VCard class="custom-dialog-card rounded-xl elevation-16 overflow-hidden">
        <div class="custom-dialog-header-danger bg-error text-white pa-5 text-center position-relative">
          <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn"
            :disabled="isDeletingCatalog" @click="closeDeleteDialog" />
          <div class="custom-dialog-avatar mx-auto mb-2 d-flex align-center justify-center rounded-circle">
            <VIcon icon="ri-delete-bin-line" size="30" />
          </div>
          <h3 class="custom-dialog-title font-weight-bold mb-1 text-white">
            Eliminar Catálogo PDF
          </h3>
          <p class="custom-dialog-subtitle text-caption mb-0 text-white opacity-80">
            Esta acción removerá el archivo PDF del servidor y su índice de texto plano
          </p>
        </div>

        <VCardText class="pa-5 text-center">
          <div v-if="catalogToDelete" class="d-flex flex-column align-center">
            <VAvatar color="error" variant="tonal" size="52" class="rounded-xl mb-3">
              <VIcon icon="ri-file-pdf-fill" size="30" color="error" />
            </VAvatar>

            <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
              {{ catalogToDelete.title || catalogToDelete.file_name }}
            </h4>
            <div class="text-caption text-medium-emphasis mb-3">
              Distribuidor: <strong>{{ catalogToDelete.supplier_name }}</strong>
            </div>

            <div class="pa-3 rounded-xl border d-flex flex-column gap-1.5 text-start w-100 mb-3 bg-background">
              <div class="d-flex justify-space-between align-center">
                <span class="text-caption text-medium-emphasis">Archivo físico:</span>
                <span class="text-caption font-mono font-weight-bold text-truncate" style="max-width: 220px;">
                  {{ catalogToDelete.original_filename || catalogToDelete.file_name }}
                </span>
              </div>
              <div class="d-flex justify-space-between align-center">
                <span class="text-caption text-medium-emphasis">Tamaño / Páginas:</span>
                <span class="text-caption font-mono">
                  {{ catalogToDelete.formatted_file_size }} • {{ catalogToDelete.total_pages }} págs.
                </span>
              </div>
            </div>

            <div class="d-flex align-center justify-center gap-1.5 text-error text-caption font-weight-medium">
              <VIcon icon="ri-error-warning-line" size="16" />
              <span>Esta acción es irreversible y no se puede deshacer.</span>
            </div>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-surface">
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line"
            class="rounded-lg px-5 font-weight-medium text-none" height="40" :disabled="isDeletingCatalog"
            @click="closeDeleteDialog">
            Cancelar
          </VBtn>
          <VBtn color="error" variant="elevated" prepend-icon="ri-delete-bin-line"
            class="rounded-lg px-5 font-weight-bold elevation-2 text-none" height="40" :loading="isDeletingCatalog"
            @click="confirmDeleteCatalog">
            Eliminar Catálogo
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal para Subir Catálogo PDF (Componente exclusivo PDF) -->
    <DistributorCatalogImportDialog v-model:is-dialog-visible="isImportDialogVisible" :suppliers="suppliers"
      :selected-supplier-id="selectedSupplierId" @imported="handleCatalogUploaded" />
  </div>
</template>

<style scoped>
.dialog-table-header {
  background-color: rgba(var(--v-theme-primary), 0.04) !important;
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.18) !important;
}

/* Resaltado de coincidencias integrado orgánicamente con el color primario del tema */
:deep(.catalog-highlight) {
  background-color: rgba(var(--v-theme-primary), 0.16) !important;
  color: rgb(var(--v-theme-primary)) !important;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
}

/* Extracto de texto del PDF con barra de acento primario y fondo sutil adaptativo */
.pdf-snippet-quote {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.88);
  border-inline-start: 3px solid rgb(var(--v-theme-primary));
  padding-inline-start: 10px;
  padding-block: 4px;
  background-color: rgba(var(--v-theme-on-surface), 0.025);
  border-radius: 0 6px 6px 0;
  word-break: break-word;
  white-space: normal;
}

/* Animación de rotación para cuando está procesando */
.rotate-animation {
  animation: spin 1.4s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* Modal personalizado */
.custom-dialog-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.pdf-catalog-row:hover,
.pdf-result-row:hover {
  background-color: rgba(var(--v-theme-primary), 0.035) !important;
}

/* Estilos de la tabla principal de catálogos en el servidor */
.distributor-pdf-table {
  table-layout: fixed !important;
  width: 100% !important;
}

.distributor-pdf-table th {
  padding-block: 14px !important;
  vertical-align: middle !important;
  letter-spacing: 0.4px;
}

.distributor-pdf-table td {
  padding-block: 16px !important;
  vertical-align: middle !important;
}
</style>
