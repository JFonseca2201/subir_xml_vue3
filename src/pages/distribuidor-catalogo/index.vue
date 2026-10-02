<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { usePermissions } from '@/composables/usePermissions'
import DistributorCatalogImportDialog from '@/components/distribuidor-catalogo/DistributorCatalogImportDialog.vue'

const { showNotification } = useGlobalToast()
const { can } = usePermissions()

// Data
const items = ref([])
const suppliers = ref([])
const categories = ref([])
const isLoading = ref(false)
const isCategoriesLoading = ref(false)

// Pagination
const currentPage = ref(1)
const perPage = ref(25)
const totalItems = ref(0)
const totalPages = ref(1)

// Filters
const selectedSupplierId = ref('all')
const selectedCategory = ref('ALL')
const selectedStockStatus = ref('ALL')
const searchQuery = ref('')
const debouncedSearch = ref('')

// KPIs / Stats
const stats = ref({
  total_products: 0,
  total_categories: 0,
  total_available: 0,
  total_low_stock: 0,
  total_transit: 0,
})

// Dialog
const isImportDialogVisible = ref(false)

const stockOptions = [
  { title: 'Todos los estados', value: 'ALL' },
  { title: 'Disponible', value: 'Disponible' },
  { title: 'Stock bajo (<= 10)', value: 'Stock <= 10' },
  { title: 'En tránsito', value: 'En tránsito y Stock > 0' },
]

const supplierOptions = computed(() => {
  const active = suppliers.value.filter(s => Number(s.total_items) > 0)
  
  return [
    { title: 'Todos los Distribuidores con Catálogo', value: 'all', name: 'Todos los Distribuidores', count: stats.value.total_products, ruc: null },
    ...active.map(s => ({
      title: `${s.name} (${s.total_items} items)`,
      value: s.id,
      name: s.name,
      count: s.total_items,
      ruc: s.ruc,
    })),
  ]
})

const selectedSupplierData = computed(() => {
  if (selectedSupplierId.value === 'all') {
    return { name: 'Todos los Distribuidores', total_items: stats.value.total_products, ruc: null }
  }
  
  return suppliers.value.find(s => s.id === selectedSupplierId.value) || { name: 'Distribuidor', total_items: 0, ruc: null }
})

const categoryOptions = computed(() => {
  return [
    { title: `Todas las Categorías (${stats.value.total_products || 0})`, value: 'ALL' },
    ...categories.value.map(c => ({
      title: `${c.category_name} (${c.total_items})`,
      value: c.category_name,
      count: c.total_items,
    })),
  ]
})

// Cargar distribuidores disponibles
const loadSuppliers = async () => {
  try {
    const response = await $api('distributor-catalog/suppliers')

    suppliers.value = response?.data || []

    // Si hay distribuidores con catálogo y no está seteado, seleccionar el primero
    const active = suppliers.value.filter(s => Number(s.total_items) > 0)
    if (active.length > 0 && selectedSupplierId.value === 'all') {
      selectedSupplierId.value = active[0].id
    }
  } catch (err) {
    console.error('Error al cargar distribuidores:', err)
  }
}

// Cargar categorías según distribuidor
const loadCategories = async () => {
  isCategoriesLoading.value = true
  try {
    const params = {}
    if (selectedSupplierId.value && selectedSupplierId.value !== 'all') {
      params.supplier_id = selectedSupplierId.value
    }

    const response = await $api('distributor-catalog/categories', { params })

    categories.value = response?.data || []
  } catch (err) {
    console.error('Error al cargar categorías:', err)
  } finally {
    isCategoriesLoading.value = false
  }
}

// Cargar productos del catálogo
const loadCatalog = async () => {
  isLoading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: perPage.value,
    }

    if (selectedSupplierId.value && selectedSupplierId.value !== 'all') {
      params.supplier_id = selectedSupplierId.value
    }
    if (selectedCategory.value && selectedCategory.value !== 'ALL') {
      params.category = selectedCategory.value
    }
    if (selectedStockStatus.value && selectedStockStatus.value !== 'ALL') {
      params.stock_status = selectedStockStatus.value
    }
    if (debouncedSearch.value && debouncedSearch.value.trim()) {
      params.search = debouncedSearch.value.trim()
    }

    const response = await $api('distributor-catalog', { params })
    if (response) {
      items.value = response.data || []
      totalItems.value = response.total || 0
      totalPages.value = response.last_page || 1
      if (response.stats) {
        stats.value = response.stats
      }
    }
  } catch (err) {
    console.error('Error al cargar catálogo:', err)
    showNotification('Error al cargar catálogo de distribuidor', 'error')
  } finally {
    isLoading.value = false
  }
}

// Watchers de búsqueda con debounce
let debounceTimeout = null
watch(searchQuery, val => {
  clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    debouncedSearch.value = val
    currentPage.value = 1
    loadCatalog()
  }, 350)
})

watch([selectedSupplierId, selectedCategory, selectedStockStatus], () => {
  currentPage.value = 1
  loadCatalog()
})

watch(selectedSupplierId, () => {
  selectedCategory.value = 'ALL'
  loadCategories()
})

watch(currentPage, () => {
  loadCatalog()
})

const handleImported = async supplierId => {
  await loadSuppliers()
  if (supplierId) {
    selectedSupplierId.value = supplierId
  }
  await loadCategories()
  await loadCatalog()
}

const copyToClipboard = async text => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const el = document.createElement('textarea')

      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    showNotification(`Código "${text}" copiado al portapapeles`, 'info')
  } catch (e) {
    console.error('Error al copiar:', e)
  }
}

const formatCurrency = val => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(val) || 0)
}

const getStockPillClass = status => {
  if (!status) return 'status-canceled'
  const s = status.toLowerCase()
  if (s.includes('disponible')) return 'status-paid'
  if (s.includes('stock <=') || s.includes('bajo') || s.includes('10')) return 'status-partial'
  if (s.includes('tránsito') || s.includes('transito')) return 'status-transfer'
  
  return 'status-primary'
}

const resetFilters = () => {
  searchQuery.value = ''
  debouncedSearch.value = ''
  selectedCategory.value = 'ALL'
  selectedStockStatus.value = 'ALL'
  currentPage.value = 1
  loadCatalog()
}

const hasActiveFilters = computed(() => {
  return !!(
    (searchQuery.value && searchQuery.value.trim()) ||
    (selectedCategory.value && selectedCategory.value !== 'ALL') ||
    (selectedStockStatus.value && selectedStockStatus.value !== 'ALL')
  )
})

onMounted(async () => {
  await loadSuppliers()
  await loadCategories()
  await loadCatalog()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 distributor-catalog-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar
            size="42"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="me-3"
          >
            <VIcon
              icon="ri-book-read-line"
              size="26"
            />
          </VAvatar>
          Catálogo de Distribuidores
        </h1>
        <p class="text-medium-emphasis mb-0">
          Consulta de listas de precios, existencias y aplicaciones de repuestos por distribuidor
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          color="primary"
          prepend-icon="ri-upload-cloud-2-line"
          class="elevation-2 font-weight-bold"
          @click="isImportDialogVisible = true"
        >
          Subir / Importar Lista
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow
      class="mb-4"
      dense
    >
      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-box-3-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Total Productos
            </div>
            <div class="text-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ stats.total_products }} <span class="text-caption text-disabled font-weight-regular">ítems</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="info"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-folder-2-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Categorías
            </div>
            <div class="text-h6 font-weight-bold text-info text-truncate">
              {{ stats.total_categories }} <span class="text-caption text-disabled font-weight-regular">grupos</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="success"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-checkbox-circle-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              En Stock / Disponibles
            </div>
            <div class="text-h6 font-weight-bold text-success text-truncate">
              {{ stats.total_available }} <span class="text-caption text-disabled font-weight-regular">ítems</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="warning"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-error-warning-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Stock Bajo / Tránsito
            </div>
            <div class="text-h6 font-weight-bold text-warning text-truncate">
              {{ stats.total_low_stock + stats.total_transit }} <span class="text-caption text-disabled font-weight-regular">críticos</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon
              icon="ri-filter-3-line"
              size="18"
              color="primary"
            />
            <span>Filtros de Catálogo</span>
          </div>

          <VBtn
            variant="text"
            color="error"
            size="small"
            prepend-icon="ri-filter-off-line"
            class="font-weight-semibold"
            @click="resetFilters"
          >
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow
          dense
          class="gap-y-3"
        >
          <!-- 3. Búsqueda -->
          <VCol
            cols="12"
            sm="6"
            md="5"
          >
            <VTextField
              v-model="searchQuery"
              label="Buscar en catálogo"
              placeholder="Código o aplicación vehicular..."
              prepend-inner-icon="ri-search-2-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
            />
          </VCol>
          <!-- 1. Distribuidor Activo -->
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="selectedSupplierId"
              :items="supplierOptions"
              item-title="title"
              item-value="value"
              label="Distribuidor Activo"
              placeholder="Seleccionar distribuidor"
              prepend-inner-icon="ri-truck-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              color="primary"
            >
              <template #selection="{ item }">
                <span class="font-weight-semibold text-truncate">{{ item.raw.name }}</span>
              </template>
              <template #item="{ props: itemProps, item }">
                <VListItem v-bind="itemProps">
                  <template #title>
                    <div class="d-flex align-center justify-space-between w-100">
                      <span class="font-weight-semibold text-body-2">{{ item.raw.name }}</span>
                      <VChip
                        size="x-small"
                        :color="item.raw.count > 0 ? 'primary' : 'default'"
                        variant="tonal"
                        class="ms-2 font-mono font-weight-bold"
                      >
                        {{ item.raw.count }}
                      </VChip>
                    </div>
                  </template>
                  <template
                    v-if="item.raw.ruc"
                    #subtitle
                  >
                    <span class="text-caption font-mono text-disabled">RUC: {{ item.raw.ruc }}</span>
                  </template>
                </VListItem>
              </template>
            </VSelect>
          </VCol>


          <!-- 2. Categoría -->
          <VCol
            cols="12"
            sm="6"
            md="2"
          >
            <VAutocomplete
              v-model="selectedCategory"
              :items="categoryOptions"
              item-title="title"
              item-value="value"
              label="Categoría de Repuesto"
              placeholder="Todas las Categorías"
              prepend-inner-icon="ri-price-tag-3-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              color="primary"
              :loading="isCategoriesLoading"
            />
          </VCol>

          <!-- 4. Disponibilidad -->
          <VCol
            cols="12"
            sm="6"
            md="2"
          >
            <VSelect
              v-model="selectedStockStatus"
              :items="stockOptions"
              item-title="title"
              item-value="value"
              label="Disponibilidad"
              placeholder="Todos los estados"
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

    <!-- ESTADO DE CARGA SKELETON -->
    <VCard
      v-if="isLoading"
      class="rounded-xl border overflow-hidden elevation-0 bg-surface"
    >
      <VTable class="distributor-catalog-table">
        <thead>
          <tr class="bg-grey-lighten-5">
            <th
              class="text-left font-weight-bold text-uppercase py-3"
              style="width: 140px; min-width: 130px;"
            >
              Código
            </th>
            <th
              class="text-left font-weight-bold text-uppercase py-3"
              style="min-width: 280px;"
            >
              Descripción / Aplicación Vehicular
            </th>
            <th
              class="text-left font-weight-bold text-uppercase py-3"
              style="width: 130px; min-width: 110px;"
            >
              Referencia
            </th>
            <th
              class="text-left font-weight-bold text-uppercase py-3"
              style="min-width: 200px;"
            >
              Categoría
            </th>
            <th
              class="text-right font-weight-bold text-uppercase py-3"
              style="width: 130px; min-width: 110px;"
            >
              Precio
            </th>
            <th
              class="text-center font-weight-bold text-uppercase py-3"
              style="width: 160px; min-width: 140px;"
            >
              Disponibilidad
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="n in 6"
            :key="n"
            class="skeleton-row align-middle"
          >
            <td
              class="py-4"
              style="width: 140px;"
            >
              <div class="shimmer-line w-75" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-80 mb-2" />
              <div class="shimmer-line w-50" />
            </td>
            <td
              class="py-4"
              style="width: 130px;"
            >
              <div class="shimmer-line w-60" />
            </td>
            <td
              class="py-4"
              style="min-width: 200px;"
            >
              <div class="shimmer-line w-60" />
            </td>
            <td
              class="py-4 text-right"
              style="width: 130px;"
            >
              <div class="shimmer-line w-60 ms-auto" />
            </td>
            <td
              class="py-4 text-center"
              style="width: 160px;"
            >
              <div class="shimmer-chip mx-auto" />
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="items.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface"
    >
      <VAvatar
        size="72"
        color="primary"
        variant="tonal"
        class="mb-3"
      >
        <VIcon
          size="36"
          icon="ri-search-line"
        />
      </VAvatar>
      <h3 class="text-h6 font-weight-bold mb-1">
        No se encontraron productos en el catálogo
      </h3>
      <p
        class="text-body-2 text-medium-emphasis mb-4"
        style="max-width: 480px; margin: 0 auto;"
      >
        Prueba con otros términos de búsqueda o sube una nueva lista de precios para este distribuidor.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn
          v-if="hasActiveFilters"
          variant="outlined"
          color="secondary"
          @click="resetFilters"
        >
          Restablecer Filtros
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-upload-2-line"
          @click="isImportDialogVisible = true"
        >
          Importar Catálogo
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA PRINCIPAL DE DATOS -->
    <VCard
      v-else
      class="rounded-xl border overflow-hidden elevation-0 bg-surface"
    >
      <VTable
        hover
        class="distributor-catalog-table overflow-x-auto"
      >
        <thead>
          <tr class="bg-grey-lighten-5">
            <th
              class="text-left font-weight-bold text-uppercase py-3"
              style="width: 140px; min-width: 130px;"
            >
              Código
            </th>
            <th
              class="text-left font-weight-bold text-uppercase py-3"
              style="min-width: 280px;"
            >
              Descripción / Aplicación Vehicular
            </th>
            <th
              class="text-left font-weight-bold text-uppercase py-3"
              style="width: 130px; min-width: 110px;"
            >
              Referencia
            </th>
            <th
              class="text-left font-weight-bold text-uppercase py-3"
              style="min-width: 200px;"
            >
              Categoría
            </th>
            <th
              class="text-right font-weight-bold text-uppercase py-3"
              style="width: 130px; min-width: 110px;"
            >
              Precio
            </th>
            <th
              class="text-center font-weight-bold text-uppercase py-3"
              style="width: 160px; min-width: 140px;"
            >
              Disponibilidad
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="catalog-row"
          >
            <!-- Código -->
            <td
              class="py-3"
              style="white-space: nowrap;"
            >
              <div
                class="d-inline-flex align-center cursor-pointer code-copy-action text-primary"
                title="Clic para copiar código"
                @click="copyToClipboard(item.code)"
              >
                <VIcon
                  icon="ri-file-copy-line"
                  size="16"
                  class="me-1.5 copy-action-icon"
                />
                <span class="font-mono font-weight-bold text-body-2">
                  {{ item.code }}
                </span>
              </div>
            </td>

            <!-- Descripción -->
            <td class="py-3">
              <div
                class="font-weight-semibold text-high-emphasis text-body-2"
                :title="item.description"
              >
                {{ item.description }}
              </div>
            </td>

            <!-- Referencia -->
            <td
              class="py-3"
              style="white-space: nowrap;"
            >
              <span
                v-if="item.reference"
                class="font-mono text-caption px-2 py-0.5 rounded bg-slate-100 font-weight-bold text-slate-700"
              >
                {{ item.reference }}
              </span>
              <span
                v-else
                class="text-disabled text-caption"
              >-</span>
            </td>

            <!-- Categoría (Nombre de la categoría) -->
            <td class="py-3">
              <span class="font-weight-bold text-high-emphasis text-body-2">
                {{ item.category_name || item.category_code || '-' }}
              </span>
            </td>

            <!-- Precio -->
            <td
              class="py-3 text-right"
              style="white-space: nowrap;"
            >
              <span class="font-weight-black font-mono text-body-1 text-emerald-700">
                {{ formatCurrency(item.price) }}
              </span>
            </td>

            <!-- Disponibilidad (Estilo Status Cliente con punto) -->
            <td
              class="py-3 text-center"
              style="white-space: nowrap;"
            >
              <div
                class="status-pill-clean"
                :class="getStockPillClass(item.stock_status)"
              >
                <span class="status-dot" />
                <span>{{ item.stock_status }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </VTable>

      <!-- Paginación -->
      <div class="pa-4 border-t bg-surface d-flex flex-column flex-sm-row align-center justify-space-between gap-3">
        <div class="text-body-2 text-medium-emphasis">
          Mostrando <strong>{{ items.length }}</strong> de <strong>{{ totalItems }}</strong> productos
        </div>
        <VPagination
          v-model="currentPage"
          :length="totalPages"
          rounded="circle"
          :total-visible="7"
          color="primary"
        />
      </div>
    </VCard>

    <!-- Modal de Importación -->
    <DistributorCatalogImportDialog
      v-model:is-dialog-visible="isImportDialogVisible"
      :suppliers="suppliers"
      :selected-supplier-id="selectedSupplierId"
      @imported="handleImported"
    />
  </div>
</template>

<style scoped lang="scss">
.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.distributor-catalog-table {
  tbody tr {
    transition: background-color 0.15s ease;

    &:hover {
      background-color: rgba(var(--v-theme-primary), 0.04);
    }
  }
}

.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
  }
}

// Code Copy Action (Icon at start, no chip)
.code-copy-action {
  transition: opacity 0.15s ease, transform 0.15s ease;
  user-select: all;

  .copy-action-icon {
    opacity: 0.65;
    transition: transform 0.15s ease, opacity 0.15s ease;
  }

  &:hover {
    .copy-action-icon {
      opacity: 1;
      transform: scale(1.18);
    }

    span {
      text-decoration: underline;
    }
  }
}

// Skeleton Loading Shimmer
.skeleton-row {
  td {
    border-bottom: 1px solid rgba(var(--v-border-color), 0.08) !important;
  }
}

.shimmer-line {
  height: 14px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.04) 25%, rgba(var(--v-theme-on-surface), 0.09) 37%, rgba(var(--v-theme-on-surface), 0.04) 63%);
  background-size: 400% 100%;
  animation: shimmer-anim 1.4s ease infinite;
  border-radius: 4px;

  &.w-80 {
    width: 80%;
  }

  &.w-75 {
    width: 75%;
  }

  &.w-60 {
    width: 60%;
  }

  &.w-50 {
    width: 50%;
  }

  &.w-40 {
    width: 40%;
  }
}

.shimmer-chip {
  height: 24px;
  width: 90px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.04) 25%, rgba(var(--v-theme-on-surface), 0.09) 37%, rgba(var(--v-theme-on-surface), 0.04) 63%);
  background-size: 400% 100%;
  animation: shimmer-anim 1.4s ease infinite;
  border-radius: 9999px;
}

@keyframes shimmer-anim {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

// Status Pills (Estilo Clientes/Socios con Punto)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-partial {
  background-color: #fffbeb !important;
  color: #92400e !important;
  border: 1px solid #fde68a !important;

  .status-dot {
    background-color: #f59e0b !important;
  }
}

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}

.status-transfer {
  background-color: #eff6ff !important;
  color: #1e40af !important;
  border: 1px solid #bfdbfe !important;

  .status-dot {
    background-color: #3b82f6 !important;
  }
}

.status-primary {
  background-color: #f5f3ff !important;
  color: #5b21b6 !important;
  border: 1px solid #ddd6fe !important;

  .status-dot {
    background-color: #7c3aed !important;
  }
}

.status-canceled {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  border: 1px solid #cbd5e1 !important;

  .status-dot {
    background-color: #94a3b8 !important;
  }
}
</style>
