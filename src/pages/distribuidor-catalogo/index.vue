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

// Lista de proveedores normalizada para selector
const supplierOptions = computed(() => {
  return [
    { title: 'Todos los Distribuidores', value: 'all', name: 'Todos los Distribuidores', ruc: null },
    ...suppliers.value.map(s => ({
      title: s.name + (s.ruc ? ` (${s.ruc})` : ''),
      value: s.id,
      name: s.name,
      ruc: s.ruc,
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
  const uniqueSuppliers = new Set(all.map(c => c.supplier_id)).size
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

// Watchers de búsqueda con debounce
let debounceTimer = null
watch(searchQuery, val => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = val
    if (val && val.trim().length >= 2) {
      searchPdfCatalogs(1)
    } else {
      pdfResults.value = []
      totalPdfResults.value = 0
    }
  }, 350)
})

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
  if (searchQuery.value) {
    await searchPdfCatalogs(1)
  }
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
      if (searchQuery.value) {
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
      dateStyle: 'medium',
      timeStyle: 'short',
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
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <div class="pa-3 pa-sm-6 distributor-catalog-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-5">
      <div class="min-w-0">
        <h1 class="text-h5 text-sm-h4 font-weight-bold mb-1 d-flex align-center flex-wrap gap-2 text-high-emphasis">
          <VAvatar size="40" color="error" variant="tonal" rounded="lg" class="me-1">
            <VIcon icon="ri-file-pdf-2-fill" size="24" />
          </VAvatar>
          <span>Catálogos de Distribuidores (PDF)</span>
        </h1>
        <p class="text-medium-emphasis mb-0 text-caption text-sm-body-2">
          Búsqueda de texto plano en índices independientes y gestión de catálogos oficiales en el servidor
        </p>
      </div>

      <div class="d-flex align-center justify-end gap-2 flex-wrap ms-auto">
        <VBtn
          color="error"
          prepend-icon="ri-upload-cloud-2-line"
          size="default"
          class="elevation-1 font-weight-bold rounded-lg text-none"
          @click="isImportDialogVisible = true"
        >
          Subir Catálogo PDF
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-5" dense>
      <VCol cols="12" sm="6" md="3">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3 pa-sm-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="42" color="error" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-file-pdf-line" size="22" />
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
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3 pa-sm-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-building-line" size="22" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1 overflow-hidden">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Distribuidores
            </div>
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ kpis.uniqueSuppliers }} <span class="text-caption text-disabled font-weight-regular">con catálogo</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" md="3">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3 pa-sm-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="42" color="info" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-pages-line" size="22" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1 overflow-hidden">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Páginas Indexadas
            </div>
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold text-info text-truncate">
              {{ kpis.totalPages }} <span class="text-caption text-disabled font-weight-regular">páginas</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" md="3">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3 pa-sm-4 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="42" :color="kpis.processing > 0 ? 'warning' : 'success'" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon :icon="kpis.processing > 0 ? 'ri-loader-4-line' : 'ri-checkbox-circle-line'" size="22" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1 overflow-hidden">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Estado de Indexación
            </div>
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold text-truncate" :class="kpis.processing > 0 ? 'text-warning' : 'text-success'">
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
            <VIcon icon="ri-search-eye-line" size="20" color="error" />
            <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
              Buscar dentro de los Catálogos PDF
            </span>
          </div>

          <VBtn
            v-if="searchQuery || selectedSupplierId !== 'all' || selectedStatus !== 'all'"
            variant="text"
            color="secondary"
            size="small"
            prepend-icon="ri-filter-off-line"
            class="text-none font-weight-semibold"
            @click="clearSearch(); selectedSupplierId = 'all'; selectedStatus = 'all'"
          >
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow dense class="gap-y-3 align-center">
          <!-- 1. VTextField de búsqueda en texto de los PDFs -->
          <VCol cols="12" md="6" lg="6">
            <VTextField
              v-model="searchQuery"
              label="Buscar palabras, modelos o códigos en los PDFs"
              placeholder="Ej: pastilla de freno, corolla, 04465, amortiguador, bujía..."
              prepend-inner-icon="ri-file-search-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="error"
              @keyup.enter="searchPdfCatalogs(1)"
              @click:clear="clearSearch"
            />
          </VCol>

          <!-- 2. Filtro por Distribuidor -->
          <VCol cols="12" sm="6" md="3" lg="3">
            <VSelect
              v-model="selectedSupplierId"
              :items="supplierOptions"
              item-title="title"
              item-value="value"
              label="Distribuidor"
              prepend-inner-icon="ri-building-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              color="primary"
            />
          </VCol>

          <!-- 3. Filtro por Estado -->
          <VCol cols="12" sm="6" md="3" lg="3">
            <VSelect
              v-model="selectedStatus"
              :items="statusOptions"
              item-title="title"
              item-value="value"
              label="Estado de Indexación"
              prepend-inner-icon="ri-shield-check-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              color="primary"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- SECCIÓN: RESULTADOS DE BÚSQUEDA DE TEXTO EN LOS PDFS (Si hay búsqueda activa) -->
    <VCard v-if="searchQuery && searchQuery.trim().length >= 2" class="rounded-xl border elevation-0 mb-5 bg-surface overflow-hidden">
      <div class="pa-4 border-b d-flex align-center justify-space-between flex-wrap gap-2" style="background-color: rgba(var(--v-theme-error), 0.06);">
        <div class="d-flex align-center gap-2">
          <VAvatar size="32" color="error" variant="tonal" rounded="lg">
            <VIcon icon="ri-search-2-line" size="18" />
          </VAvatar>
          <div>
            <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
              Resultados de búsqueda para: <span class="font-mono text-error">"{{ debouncedSearch }}"</span>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ isPdfSearching ? 'Buscando en los índices de texto...' : `${totalPdfResults} coincidencia(s) encontrada(s)` }}
            </div>
          </div>
        </div>

        <VBtn
          size="small"
          variant="tonal"
          color="error"
          prepend-icon="ri-close-line"
          class="text-none"
          @click="clearSearch"
        >
          Cerrar Resultados
        </VBtn>
      </div>

      <VCardText class="pa-4 pa-sm-5">
        <!-- Indicador de carga -->
        <div v-if="isPdfSearching" class="py-4">
          <VSkeletonLoader type="table-row@4" />
        </div>

        <!-- Coincidencias encontradas -->
        <div v-else-if="pdfResults.length > 0">
          <VTable class="text-no-wrap border rounded-xl overflow-hidden mb-4">
            <thead>
              <tr class="text-caption font-weight-bold bg-background">
                <th class="text-left py-3" style="width: 260px;">Distribuidor / Catálogo</th>
                <th class="text-left py-3">Fragmento Coincidente en el PDF</th>
                <th class="text-center py-3" style="width: 120px;">Página</th>
                <th class="text-center py-3" style="width: 150px;">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="res in pdfResults" :key="res.id" class="pdf-result-row">
                <td class="py-3">
                  <div class="d-flex align-center gap-2">
                    <VAvatar size="32" color="error" variant="tonal" rounded="md" class="flex-shrink-0">
                      <VIcon icon="ri-file-pdf-fill" size="18" />
                    </VAvatar>
                    <div class="min-w-0">
                      <div class="text-body-2 font-weight-bold text-high-emphasis text-truncate">
                        {{ res.supplier_name }}
                      </div>
                      <div class="text-caption text-medium-emphasis text-truncate" :title="res.catalog_title">
                        {{ res.catalog_title }}
                      </div>
                    </div>
                  </div>
                </td>

                <td class="py-3 text-wrap-break" style="white-space: normal; min-width: 300px;">
                  <div class="pdf-snippet-box text-caption text-high-emphasis" v-html="res.snippet" />
                </td>

                <td class="text-center py-3">
                  <VChip size="small" color="error" variant="tonal" class="font-weight-bold font-mono">
                    Pág. {{ res.page_number }}
                  </VChip>
                </td>

                <td class="text-center py-3">
                  <VBtn
                    size="small"
                    color="error"
                    variant="elevated"
                    prepend-icon="ri-external-link-line"
                    class="font-weight-bold rounded-lg text-none elevation-1"
                    :href="res.pdf_url"
                    target="_blank"
                  >
                    Abrir Pág. {{ res.page_number }}
                  </VBtn>
                </td>
              </tr>
            </tbody>
          </VTable>

          <!-- Paginación de resultados de búsqueda -->
          <div v-if="totalPdfPages > 1" class="d-flex justify-space-between align-center flex-wrap gap-2 pt-2">
            <span class="text-caption text-medium-emphasis">
              Mostrando página {{ pdfCurrentPage }} de {{ totalPdfPages }}
            </span>
            <VPagination
              v-model="pdfCurrentPage"
              :length="totalPdfPages"
              :disabled="isPdfSearching"
              rounded="circle"
              density="comfortable"
              size="small"
              color="error"
              @update:model-value="page => searchPdfCatalogs(page)"
            />
          </div>
        </div>

        <!-- Sin coincidencias -->
        <div v-else class="text-center pa-6">
          <VAvatar size="56" color="secondary" variant="tonal" class="mb-3">
            <VIcon icon="ri-file-search-line" size="28" />
          </VAvatar>
          <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
            No se encontraron coincidencias para "{{ debouncedSearch }}"
          </div>
          <p class="text-caption text-medium-emphasis mb-0" style="max-width: 420px; margin: 0 auto;">
            Verifica la ortografía o intenta buscar por número de parte, aplicación vehicular o nombre del repuesto.
          </p>
        </div>
      </VCardText>
    </VCard>

    <!-- LISTADO PRINCIPAL DE CATÁLOGOS PDF SUBIDOS EN EL SERVIDOR -->
    <div class="d-flex align-center justify-space-between mb-3 flex-wrap gap-2">
      <div class="d-flex align-center gap-2">
        <VIcon icon="ri-folder-open-line" size="20" color="primary" />
        <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
          Catálogos PDF en el Servidor ({{ filteredCatalogs.length }})
        </span>
      </div>

      <div class="d-flex align-center gap-2">
        <VBtn
          icon="ri-refresh-line"
          size="small"
          variant="tonal"
          color="secondary"
          :loading="isLoadingCatalogs"
          title="Recargar lista"
          @click="loadUploadedCatalogs"
        />
      </div>
    </div>

    <!-- Skeleton Loading -->
    <template v-if="isLoadingCatalogs && uploadedCatalogs.length === 0">
      <VCard class="rounded-xl border pa-6 bg-surface elevation-0">
        <VSkeletonLoader type="table-row@5" />
      </VCard>
    </template>

    <!-- Estado Vacío: No hay catálogos subidos -->
    <VCard
      v-else-if="filteredCatalogs.length === 0"
      class="rounded-xl border elevation-0 pa-8 pa-sm-10 text-center bg-surface"
    >
      <VAvatar size="64" color="error" variant="tonal" class="mb-3">
        <VIcon size="32" icon="ri-file-pdf-2-line" />
      </VAvatar>
      <h3 class="text-h6 font-weight-bold mb-1 text-high-emphasis">
        No hay catálogos PDF registrados
      </h3>
      <p class="text-body-2 text-medium-emphasis mb-4" style="max-width: 480px; margin: 0 auto;">
        Sube los catálogos en formato PDF de tus distribuidores. El sistema extraerá el texto plano de forma independiente para permitirte buscar rápidamente cualquier repuesto.
      </p>
      <VBtn
        color="error"
        prepend-icon="ri-upload-cloud-2-line"
        class="font-weight-bold rounded-lg text-none elevation-1"
        @click="isImportDialogVisible = true"
      >
        Subir Catálogo PDF Ahora
      </VBtn>
    </VCard>

    <!-- Contenedor de Catálogos (Tabla Desktop y Tarjetas Móvil) -->
    <div v-else>
      <!-- VISTA MÓVIL (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-3 mb-4">
        <VCard
          v-for="cat in filteredCatalogs"
          :key="`mob-cat-${cat.id}`"
          class="rounded-xl border elevation-0 pa-3.5 bg-surface"
        >
          <!-- Fila Superior: Distribuidor y Estado -->
          <div class="d-flex align-center justify-space-between pb-2 border-b mb-2.5">
            <div class="d-flex align-center gap-2 min-w-0">
              <VAvatar size="28" color="primary" variant="tonal" rounded="md">
                <VIcon icon="ri-building-line" size="16" />
              </VAvatar>
              <span class="text-caption font-weight-bold text-high-emphasis text-truncate">
                {{ cat.supplier_name }}
              </span>
            </div>
            <VChip
              size="x-small"
              :color="getStatusBadge(cat.status).color"
              variant="tonal"
              class="font-weight-bold"
            >
              <VIcon :icon="getStatusBadge(cat.status).icon" size="12" class="me-1" :class="cat.status === 'processing' ? 'rotate-animation' : ''" />
              {{ getStatusBadge(cat.status).text }}
            </VChip>
          </div>

          <!-- Fila Central: Título del Catálogo y Archivo -->
          <div class="d-flex align-start gap-3 mb-2.5">
            <VAvatar size="40" color="error" variant="tonal" rounded="lg" class="flex-shrink-0 mt-0.5">
              <VIcon icon="ri-file-pdf-fill" size="22" />
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
              <VBtn
                v-if="cat.file_url"
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="ri-eye-line"
                class="rounded-lg text-none"
                :href="cat.file_url"
                target="_blank"
              >
                Ver PDF
              </VBtn>

              <VBtn
                icon="ri-delete-bin-line"
                size="small"
                variant="tonal"
                color="error"
                class="rounded-lg"
                title="Eliminar catálogo"
                @click="openDeleteCatalogDialog(cat)"
              />
            </div>
          </div>
        </VCard>
      </div>

      <!-- VISTA ESCRITORIO: TABLA (d-none d-md-block) -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="text-no-wrap distributor-pdf-table">
          <thead>
            <tr class="bg-background text-caption font-weight-bold">
              <th class="text-left py-3.5" style="width: 240px;">
                Distribuidor
              </th>
              <th class="text-left py-3.5">
                Catálogo / Archivo PDF
              </th>
              <th class="text-center py-3.5" style="width: 140px;">
                Páginas
              </th>
              <th class="text-center py-3.5" style="width: 160px;">
                Estado
              </th>
              <th class="text-left py-3.5" style="width: 170px;">
                Fecha de Subida
              </th>
              <th class="text-center py-3.5" style="width: 150px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in filteredCatalogs" :key="cat.id" class="pdf-catalog-row">
              <!-- Distribuidor -->
              <td class="py-3">
                <div class="d-flex align-center gap-2.5">
                  <VAvatar size="34" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
                    <VIcon icon="ri-building-line" size="18" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="font-weight-bold text-high-emphasis text-body-2 text-truncate" :title="cat.supplier_name">
                      {{ cat.supplier_name }}
                    </div>
                    <div v-if="cat.supplier?.ruc" class="text-caption text-medium-emphasis font-mono">
                      RUC: {{ cat.supplier.ruc }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Catálogo / Archivo -->
              <td class="py-3">
                <div class="d-flex align-center gap-2.5">
                  <VAvatar size="34" color="error" variant="tonal" rounded="lg" class="flex-shrink-0">
                    <VIcon icon="ri-file-pdf-fill" size="20" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="font-weight-bold text-high-emphasis text-body-2 text-truncate" :title="cat.title">
                      {{ cat.title || cat.file_name }}
                    </div>
                    <div class="d-flex align-center gap-2 text-caption text-medium-emphasis font-mono">
                      <span class="text-truncate" style="max-width: 250px;">{{ cat.original_filename || cat.file_name }}</span>
                      <span class="text-disabled">•</span>
                      <span>{{ cat.formatted_file_size || 'PDF' }}</span>
                    </div>
                  </div>
                </div>
              </td>

              <!-- Páginas -->
              <td class="text-center py-3">
                <VChip
                  size="small"
                  color="info"
                  variant="tonal"
                  class="font-weight-bold font-mono"
                >
                  <VIcon icon="ri-pages-line" size="14" class="me-1" />
                  {{ cat.total_pages ? `${cat.total_pages} págs.` : '—' }}
                </VChip>
              </td>

              <!-- Estado -->
              <td class="text-center py-3">
                <VChip
                  size="small"
                  :color="getStatusBadge(cat.status).color"
                  variant="tonal"
                  class="font-weight-bold"
                >
                  <VIcon
                    :icon="getStatusBadge(cat.status).icon"
                    size="14"
                    class="me-1"
                    :class="cat.status === 'processing' ? 'rotate-animation' : ''"
                  />
                  <span>{{ getStatusBadge(cat.status).text }}</span>
                </VChip>
                <div v-if="cat.error_message" class="text-caption text-error text-truncate mt-0.5" style="max-width: 140px;" :title="cat.error_message">
                  {{ cat.error_message }}
                </div>
              </td>

              <!-- Fecha -->
              <td class="py-3 text-caption text-medium-emphasis">
                {{ formatDate(cat.created_at) }}
              </td>

              <!-- Acciones -->
              <td class="text-center py-3">
                <div class="d-inline-flex align-center gap-1.5">
                  <VBtn
                    v-if="cat.file_url"
                    icon="ri-eye-line"
                    size="small"
                    variant="tonal"
                    color="primary"
                    class="rounded-lg"
                    title="Ver PDF en pestaña nueva"
                    :href="cat.file_url"
                    target="_blank"
                  />

                  <VBtn
                    v-if="cat.file_url"
                    icon="ri-download-2-line"
                    size="small"
                    variant="tonal"
                    color="secondary"
                    class="rounded-lg"
                    title="Descargar PDF"
                    :href="cat.file_url"
                    :download="cat.file_name || 'catalogo.pdf'"
                  />

                  <VBtn
                    icon="ri-delete-bin-line"
                    size="small"
                    variant="tonal"
                    color="error"
                    class="rounded-lg"
                    title="Eliminar catálogo"
                    @click="openDeleteCatalogDialog(cat)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </div>

    <!-- Modal de Confirmación para Eliminar Catálogo PDF -->
    <VDialog
      v-model="isDeleteDialogVisible"
      max-width="460"
      persistent
      transition="dialog-bottom-transition"
    >
      <VCard class="custom-dialog-card rounded-xl elevation-16 overflow-hidden">
        <div class="custom-dialog-header-danger bg-error text-white pa-5 text-center position-relative">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            :disabled="isDeletingCatalog"
            @click="closeDeleteDialog"
          />
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
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-5 font-weight-medium text-none"
            height="40"
            :disabled="isDeletingCatalog"
            @click="closeDeleteDialog"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            prepend-icon="ri-delete-bin-line"
            class="rounded-lg px-5 font-weight-bold elevation-2 text-none"
            height="40"
            :loading="isDeletingCatalog"
            @click="confirmDeleteCatalog"
          >
            Eliminar Catálogo
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal para Subir Catálogo PDF (Componente exclusivo PDF) -->
    <DistributorCatalogImportDialog
      v-model:is-dialog-visible="isImportDialogVisible"
      :suppliers="suppliers"
      :selected-supplier-id="selectedSupplierId"
      @imported="handleCatalogUploaded"
    />
  </div>
</template>

<style scoped>
/* Resaltado de coincidencias adaptado a temas claro y oscuro */
:deep(.catalog-highlight) {
  background-color: rgba(var(--v-theme-warning), 0.3) !important;
  color: rgb(var(--v-theme-warning)) !important;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
}

/* Caja del extracto de texto del PDF con soporte para dark/light theme */
.pdf-snippet-box {
  line-height: 1.6;
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  font-family: inherit;
  word-break: break-word;
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

.custom-dialog-header-danger {
  position: relative;
}

.custom-dialog-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  color: white !important;
}

.custom-dialog-avatar {
  width: 54px;
  height: 54px;
  background-color: rgba(255, 255, 255, 0.2);
}

.pdf-catalog-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}
</style>
