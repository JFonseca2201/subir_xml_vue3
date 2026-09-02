<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import Swal from 'sweetalert2'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import InfoRepuestoFormDialog from '@/components/inforepuestos/InfoRepuestoFormDialog.vue'
import InfoRepuestoDetailDialog from '@/components/inforepuestos/InfoRepuestoDetailDialog.vue'
import { usePermissions } from '@/composables/usePermissions'

const { showNotification } = useGlobalToast()
const { can } = usePermissions()

// Data
const requests = ref([])
const loading = ref(false)
const page = ref(1)
const perPage = ref(12)
const totalPages = ref(1)
const totalItems = ref(0)

// View mode: 'cards' or 'table'
const viewMode = ref(localStorage.getItem('inforepuestos_view_mode') || 'cards')
watch(viewMode, val => {
  localStorage.setItem('inforepuestos_view_mode', val)
})

// Filters
const searchQuery = ref('')
const categoryFilter = ref('ALL')
const minPriceFilter = ref(null)
const maxPriceFilter = ref(null)
const tractionFilter = ref('ALL')
const yearFilter = ref(null)

// Dynamic Categories
const availableCategories = ref([])
const categoryOptions = computed(() => {
  return [
    { title: 'Todas las Categorías', value: 'ALL' },
    ...availableCategories.value.map(cat => ({
      title: cat,
      value: cat,
    })),
  ]
})

// KPI Computeds
const totalSparePartsCount = computed(() => {
  return requests.value.reduce((acc, r) => acc + (r.items ? r.items.length : 0), 0)
})

const uniqueBrandsCount = computed(() => {
  const brands = new Set(requests.value.map(r => (r.brand || '').trim().toUpperCase()).filter(Boolean))
  return brands.size
})

// Brand Aesthetics Helpers
const getBrandColor = brand => {
  const b = (brand || '').toUpperCase()
  if (b.includes('CHEVROLET')) return 'warning'
  if (b.includes('TOYOTA')) return 'error'
  if (b.includes('HYUNDAI') || b.includes('KIA')) return 'info'
  if (b.includes('NISSAN') || b.includes('RENAULT')) return 'secondary'
  if (b.includes('FORD') || b.includes('MAZDA')) return 'primary'
  if (b.includes('VOLKSWAGEN') || b.includes('AUDI')) return 'success'
  return 'primary'
}

const getVehicleAccent = brand => {
  const colorKey = getBrandColor(brand)
  if (colorKey === 'warning') return 'linear-gradient(90deg, #ff9800, #ffb74d)'
  if (colorKey === 'error') return 'linear-gradient(90deg, #f44336, #e57373)'
  if (colorKey === 'info') return 'linear-gradient(90deg, #00bcd4, #4dd0e1)'
  if (colorKey === 'secondary') return 'linear-gradient(90deg, #607d8b, #90a4ae)'
  if (colorKey === 'success') return 'linear-gradient(90deg, #4caf50, #81c784)'
  return 'linear-gradient(90deg, #7367f0, #9e95f5)'
}

const loadCategories = async () => {
  try {
    const response = await $api('spare-part-requests/categories')
    if (response && response.data) {
      availableCategories.value = response.data
    }
  } catch (err) {
    console.warn('Error al cargar categorías de repuestos:', err)
  }
}

// Dialog states
const isFormDialogOpen = ref(false)
const isDetailDialogOpen = ref(false)
const requestSelected = ref(null)

// Load requests from backend with pagination
const loadRequests = async () => {
  loading.value = true
  try {
    const params = {
      page: page.value,
      per_page: perPage.value,
    }

    if (searchQuery.value && searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }
    if (tractionFilter.value && tractionFilter.value !== 'ALL') {
      params.traction = tractionFilter.value
    }
    if (yearFilter.value) {
      params.year = yearFilter.value
    }
    if (categoryFilter.value && categoryFilter.value !== 'ALL') {
      params.category = categoryFilter.value
    }
    if (minPriceFilter.value !== null && minPriceFilter.value !== '' && !isNaN(minPriceFilter.value)) {
      params.min_price = minPriceFilter.value
    }
    if (maxPriceFilter.value !== null && maxPriceFilter.value !== '' && !isNaN(maxPriceFilter.value)) {
      params.max_price = maxPriceFilter.value
    }

    const response = await $api('spare-part-requests', { params })
    if (response) {
      requests.value = response.data || []
      totalItems.value = response.total || 0
      totalPages.value = response.last_page || 1
    }
  } catch (error) {
    console.error('Error al cargar búsquedas de repuestos:', error)
    showNotification('Error al cargar el listado de repuestos', 'error')
  } finally {
    loading.value = false
  }
}

// Watch filters with debounce for inputs and immediate for dropdowns
let searchDebounceTimer = null
watch([searchQuery, minPriceFilter, maxPriceFilter], () => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    page.value = 1
    loadRequests()
  }, 350)
})

watch([tractionFilter, yearFilter, categoryFilter], () => {
  page.value = 1
  loadRequests()
})

const hasActiveFilters = computed(() => {
  return !!(
    (searchQuery.value && searchQuery.value.trim()) ||
    (categoryFilter.value && categoryFilter.value !== 'ALL') ||
    (minPriceFilter.value !== null && minPriceFilter.value !== '') ||
    (maxPriceFilter.value !== null && maxPriceFilter.value !== '') ||
    (tractionFilter.value && tractionFilter.value !== 'ALL') ||
    yearFilter.value
  )
})

const resetFilters = () => {
  searchQuery.value = ''
  categoryFilter.value = 'ALL'
  minPriceFilter.value = null
  maxPriceFilter.value = null
  tractionFilter.value = 'ALL'
  yearFilter.value = null
  page.value = 1
  loadRequests()
}

// Matching helpers for highlighting
const isMatchingCategory = cat => {
  if (!categoryFilter.value || categoryFilter.value === 'ALL') return false
  return (cat || '').toUpperCase().trim() === categoryFilter.value.toUpperCase().trim()
}

const isMatchingPrice = price => {
  const p = parseFloat(price) || 0
  const hasMin = minPriceFilter.value !== null && minPriceFilter.value !== '' && !isNaN(minPriceFilter.value)
  const hasMax = maxPriceFilter.value !== null && maxPriceFilter.value !== '' && !isNaN(maxPriceFilter.value)
  if (!hasMin && !hasMax) return false
  if (hasMin && p < parseFloat(minPriceFilter.value)) return false
  if (hasMax && p > parseFloat(maxPriceFilter.value)) return false
  return true
}

const handlePageChange = newPage => {
  page.value = newPage
  loadRequests()
}

// Reactively reload on save/edit/delete (no page reload)
const handleSaveSuccess = () => {
  loadCategories()
  loadRequests()
}

const openCreate = () => {
  requestSelected.value = null
  isFormDialogOpen.value = true
}

const openEdit = item => {
  requestSelected.value = item
  isFormDialogOpen.value = true
}

const openDetail = item => {
  requestSelected.value = item
  isDetailDialogOpen.value = true
}

const deleteRequest = async item => {
  const result = await Swal.fire({
    title: '¿Estás seguro?',
    text: `Vas a eliminar el registro del vehículo ${item.brand} ${item.model}. Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#fb7578',
    cancelButtonColor: '#90a4ae',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })

  if (result.isConfirmed) {
    try {
      const response = await $api(`spare-part-requests/${item.id}`, {
        method: 'DELETE',
      })

      if (response && response.success) {
        showNotification(response.message || 'Registro eliminado correctamente', 'success')
        loadRequests()
      }
    } catch (error) {
      console.error('Error al eliminar registro:', error)
      showNotification('Error al eliminar el registro', 'error')
    }
  }
}

onMounted(() => {
  loadCategories()
  loadRequests()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 inforepuestos-page">
    <!-- Header y Filtros Fijos -->
    <div class="sticky-page-header-wrapper">
      <!-- Título, Controles de Vista y Botón Superior -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-4 relative-header">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
            <VAvatar size="40" color="primary" variant="tonal" rounded="lg" class="me-3">
              <VIcon icon="ri-roadster-line" size="24" />
            </VAvatar>
            Gestión y Catálogo de Repuestos por Vehículo
          </h1>
          <p class="text-medium-emphasis mb-0">
            Consulta rápida de compatibilidades técnicas, marcas y precios (PVP / Costo) clasificados por modelo de vehículo.
          </p>
        </div>

        <div class="d-flex align-center gap-3">
          <!-- Toggle Vista Tarjetas / Vista Tabla -->
          <VBtnToggle
            v-model="viewMode"
            mandatory
            color="primary"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="bg-surface elevation-0"
          >
            <VBtn value="cards" prepend-icon="ri-grid-fill">
              <span class="d-none d-sm-inline">Tarjetas</span>
            </VBtn>
            <VBtn value="table" prepend-icon="ri-table-line">
              <span class="d-none d-sm-inline">Tabla</span>
            </VBtn>
          </VBtnToggle>

          <!-- Botón de Registro -->
          <VBtn
            v-if="can('register_product')"
            color="primary"
            prepend-icon="ri-add-line"
            class="elevation-2 font-weight-bold"
            @click="openCreate"
          >
            Registrar Búsqueda
          </VBtn>
        </div>
      </div>

      <!-- Barra de Métricas Rápidas (KPIs) -->
      <VRow class="mb-4" dense>
        <VCol cols="12" sm="4">
          <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3 bg-surface d-flex align-center gap-3">
            <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
              <VIcon icon="ri-car-line" size="24" />
            </VAvatar>
            <div>
              <div class="text-caption text-medium-emphasis font-weight-medium">Modelos de Vehículo</div>
              <div class="text-h6 font-weight-bold text-high-emphasis">
                {{ totalItems }} <span class="text-caption text-disabled">registrados</span>
              </div>
            </div>
          </VCard>
        </VCol>

        <VCol cols="12" sm="4">
          <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3 bg-surface d-flex align-center gap-3">
            <VAvatar size="46" color="success" variant="tonal" rounded="lg">
              <VIcon icon="ri-tools-line" size="24" />
            </VAvatar>
            <div>
              <div class="text-caption text-medium-emphasis font-weight-medium">Repuestos en Pantalla</div>
              <div class="text-h6 font-weight-bold text-success">
                {{ totalSparePartsCount }} <span class="text-caption text-disabled">compatibles</span>
              </div>
            </div>
          </VCard>
        </VCol>

        <VCol cols="12" sm="4">
          <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3 bg-surface d-flex align-center gap-3">
            <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
              <VIcon icon="ri-price-tag-3-line" size="24" />
            </VAvatar>
            <div>
              <div class="text-caption text-medium-emphasis font-weight-medium">Categorías del Sistema</div>
              <div class="text-h6 font-weight-bold text-warning">
                {{ availableCategories.length }} <span class="text-caption text-disabled">activas</span>
              </div>
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Filtros de Búsqueda -->
      <VCard class="mb-4 elevation-0 border rounded-xl sticky-filter-card">
        <VCardText class="pa-4 bg-grey-lighten-5">
          <VRow dense class="gap-y-2 align-center">
            <!-- Fila 1: Búsqueda General, Categoría y Tracción -->
            <VCol cols="12" md="5">
              <VTextField
                v-model="searchQuery"
                label="Búsqueda por Palabra Clave o Código"
                placeholder="Ej: Chevrolet, Vitara, Amortiguador, 45.00..."
                clearable
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                prepend-inner-icon="ri-search-2-line"
              />
            </VCol>

            <!-- Categoría de Repuesto -->
            <VCol cols="12" sm="6" md="4">
              <VAutocomplete
                v-model="categoryFilter"
                label="Categoría de Repuesto"
                :items="categoryOptions"
                item-title="title"
                item-value="value"
                clearable
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                prepend-inner-icon="ri-price-tag-3-line"
                placeholder="Todas las Categorías"
              />
            </VCol>

            <!-- Tracción / Suspensión -->
            <VCol cols="12" sm="6" md="3">
              <VSelect
                v-model="tractionFilter"
                label="Tracción / Suspensión"
                :items="[
                  { title: 'Todas', value: 'ALL' },
                  { title: '4x4', value: '4X4' },
                  { title: '4x2', value: '4X2' },
                  { title: 'AWD', value: 'AWD' },
                  { title: 'FWD', value: 'FWD' },
                  { title: 'RWD', value: 'RWD' }
                ]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
              />
            </VCol>

            <!-- Fila 2: Rango de Precios, Año y Limpiar -->
            <VCol cols="6" sm="4" md="3">
              <VTextField
                v-model.number="minPriceFilter"
                label="Precio Mínimo"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                clearable
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                prefix="$"
                prepend-inner-icon="ri-money-dollar-circle-line"
              />
            </VCol>

            <VCol cols="6" sm="4" md="3">
              <VTextField
                v-model.number="maxPriceFilter"
                label="Precio Máximo"
                type="number"
                min="0"
                step="any"
                placeholder="100.00"
                clearable
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                prefix="$"
                prepend-inner-icon="ri-money-dollar-circle-line"
              />
            </VCol>

            <!-- Año -->
            <VCol cols="12" sm="4" md="3">
              <VTextField
                v-model.number="yearFilter"
                label="Año del Vehículo"
                type="number"
                placeholder="Ej: 2012"
                clearable
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                prepend-inner-icon="ri-calendar-line"
              />
            </VCol>

            <!-- Botón Limpiar Filtros -->
            <VCol cols="12" md="3" class="d-flex align-center">
              <VBtn
                v-if="hasActiveFilters"
                variant="tonal"
                color="secondary"
                size="default"
                prepend-icon="ri-filter-off-line"
                class="w-100 font-weight-medium"
                @click="resetFilters"
              >
                Limpiar Filtros
              </VBtn>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </div>

    <!-- SKELETON LOADERS -->
    <div v-if="loading">
      <!-- Skeleton para vista Tarjetas -->
      <VRow v-if="viewMode === 'cards'" class="match-height">
        <VCol v-for="i in 6" :key="'sk-card-' + i" cols="12" sm="6" lg="4" xl="3">
          <VCard class="rounded-xl border pa-4 h-100 elevation-0 bg-surface">
            <div class="d-flex align-center gap-3 mb-3">
              <div class="shimmer-circle" style="width: 46px; height: 46px; border-radius: 12px;" />
              <div class="flex-grow-1">
                <div class="shimmer-line w-40 mb-1" style="height: 12px;" />
                <div class="shimmer-line w-75" style="height: 18px;" />
              </div>
            </div>
            <div class="d-flex gap-1 mb-4">
              <div class="shimmer-chip" style="width: 50px; height: 20px;" />
              <div class="shimmer-chip" style="width: 50px; height: 20px;" />
            </div>
            <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
            <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
          </VCard>
        </VCol>
      </VRow>

      <!-- Skeleton para vista Tabla -->
      <VCard v-else class="rounded-xl border overflow-hidden elevation-0">
        <VCardText class="pa-0">
          <VTable>
            <tbody>
              <tr v-for="i in 5" :key="'sk-row-' + i">
                <td class="py-4" style="width: 35%;">
                  <div class="d-flex align-center gap-3">
                    <div class="shimmer-circle" style="width: 40px; height: 40px; border-radius: 8px;" />
                    <div class="flex-grow-1">
                      <div class="shimmer-line w-75 mb-2" style="height: 16px;" />
                      <div class="shimmer-line w-40" style="height: 12px;" />
                    </div>
                  </div>
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-100 mb-2" style="height: 28px; border-radius: 6px;" />
                  <div class="shimmer-line w-100" style="height: 28px; border-radius: 6px;" />
                </td>
                <td class="py-4 text-center" style="width: 140px;">
                  <div class="shimmer-button rounded mx-auto" />
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>
    </div>

    <!-- ESTADO VACÍO (NO DATA) -->
    <VCard
      v-else-if="requests.length === 0"
      class="rounded-xl border elevation-0 pa-8 text-center bg-surface"
    >
      <VAvatar size="72" color="primary" variant="tonal" class="mb-4">
        <VIcon icon="ri-search-eye-line" size="36" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-1">
        No se encontraron vehículos o repuestos
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-4 mx-auto" style="max-width: 500px;">
        No hay registros que coincidan con los filtros aplicados. Intenta ajustar los términos de búsqueda o registra una nueva búsqueda.
      </p>
      <div class="d-flex justify-center gap-2">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_product')" color="primary" prepend-icon="ri-add-line" @click="openCreate">
          Registrar Repuesto para Vehículo
        </VBtn>
      </div>
    </VCard>

    <!-- LISTADO CON DATOS -->
    <div v-else>
      <!-- ================= VISTA 1: TARJETAS MODERNAS (SHOWCASE GRID) ================= -->
      <VRow v-if="viewMode === 'cards'" class="match-height">
        <VCol
          v-for="item in requests"
          :key="'card-' + item.id"
          cols="12"
          sm="6"
          lg="4"
          xl="3"
        >
          <VCard class="vehicle-catalog-card h-100 d-flex flex-column rounded-xl border elevation-0 position-relative overflow-hidden">
            <!-- Barra superior con gradiente de color de la marca -->
            <div class="card-accent-bar" :style="{ background: getVehicleAccent(item.brand) }" />

            <VCardText class="pa-5 flex-grow-1 d-flex flex-column">
              <!-- Encabezado de Vehículo: Avatar y Nombre -->
              <div class="d-flex align-start justify-space-between gap-2 mb-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="46"
                    rounded="lg"
                    class="elevation-0"
                    :color="getBrandColor(item.brand)"
                    variant="tonal"
                  >
                    <VIcon icon="ri-car-line" size="24" />
                  </VAvatar>
                  <div>
                    <div class="text-caption font-weight-bold text-uppercase text-primary letter-spacing-1">
                      {{ item.brand }}
                    </div>
                    <h3 class="text-h6 font-weight-bold text-high-emphasis text-truncate mb-0" style="max-width: 180px;">
                      {{ item.model }}
                    </h3>
                  </div>
                </div>

                <!-- Cantidad de repuestos registrados -->
                <VChip
                  size="small"
                  color="primary"
                  variant="tonal"
                  class="font-weight-bold flex-shrink-0"
                >
                  {{ (item.items || []).length }} rep.
                </VChip>
              </div>

              <!-- Chips de Especificaciones (Año, Tracción, Origen) -->
              <div class="d-flex flex-wrap gap-1 mb-3">
                <VChip
                  size="x-small"
                  color="secondary"
                  variant="tonal"
                  prepend-icon="ri-calendar-line"
                  class="font-weight-medium"
                >
                  {{ item.year }}
                </VChip>
                <VChip
                  v-if="item.traction"
                  size="x-small"
                  color="info"
                  variant="tonal"
                  prepend-icon="ri-compass-3-line"
                  class="font-weight-medium"
                >
                  {{ item.traction }}
                </VChip>
                <VChip
                  v-if="item.origin_country"
                  size="x-small"
                  color="warning"
                  variant="tonal"
                  prepend-icon="ri-earth-line"
                  class="font-weight-medium"
                >
                  {{ item.origin_country }}
                </VChip>
              </div>

              <VDivider class="mb-3" />

              <!-- Lista de Repuestos Compatibles Destacados -->
              <div class="flex-grow-1">
                <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-2 d-flex align-center justify-space-between">
                  <span>Repuestos Compatibles</span>
                  <span class="text-disabled" style="font-size: 11px;">PVP / Compra</span>
                </div>

                <div class="d-flex flex-column gap-2">
                  <div
                    v-for="(subItem, sIdx) in (item.items || []).slice(0, 3)"
                    :key="sIdx"
                    class="card-spare-item pa-2.5 rounded-lg"
                    :class="{
                      'highlighted-match': isMatchingCategory(subItem.category) || isMatchingPrice(subItem.public_price)
                    }"
                  >
                    <div class="d-flex align-center justify-space-between gap-2">
                      <div class="min-w-0 flex-grow-1">
                        <div class="text-body-2 font-weight-semibold text-truncate text-high-emphasis">
                          {{ subItem.spare_parts_detail }}
                        </div>
                        <div class="d-flex align-center gap-1 mt-0.5">
                          <VChip
                            size="20"
                            density="compact"
                            :color="isMatchingCategory(subItem.category) ? 'primary' : 'default'"
                            :variant="isMatchingCategory(subItem.category) ? 'elevated' : 'tonal'"
                            class="text-xxs px-1.5 font-weight-medium text-uppercase"
                          >
                            {{ subItem.category }}
                          </VChip>
                          <span class="text-caption text-disabled text-truncate ms-1" style="font-size: 10px;">
                            {{ subItem.spare_part_brand }}
                          </span>
                        </div>
                      </div>

                      <div class="text-right flex-shrink-0">
                        <div
                          class="text-body-2 font-weight-bold"
                          :class="isMatchingPrice(subItem.public_price) ? 'text-primary' : 'text-success'"
                        >
                          ${{ parseFloat(subItem.public_price || 0).toFixed(2) }}
                        </div>
                        <div class="text-caption text-disabled" style="font-size: 10px; font-family: monospace;">
                          C: ${{ parseFloat(subItem.purchase_price || 0).toFixed(2) }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Botón Ver más repuestos si son más de 3 -->
                  <div
                    v-if="(item.items || []).length > 3"
                    class="text-center pt-1"
                  >
                    <VBtn
                      variant="text"
                      size="x-small"
                      color="primary"
                      class="font-weight-bold"
                      @click="openDetail(item)"
                    >
                      + {{ item.items.length - 3 }} repuestos adicionales (Ver Ficha)
                    </VBtn>
                  </div>
                </div>
              </div>
            </VCardText>

            <VDivider />

            <!-- Pie de Tarjeta: Usuario y Botones de Acción -->
            <VCardActions class="pa-3 px-4 bg-card-footer d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-1 text-caption text-disabled text-truncate me-2" style="font-size: 11px;">
                <VIcon icon="ri-user-smile-line" size="14" />
                <span class="text-truncate">
                  {{ item.user ? (item.user.name + ' ' + (item.user.surname || '')) : 'Sistema' }}
                </span>
              </div>

              <div class="d-flex align-center gap-1 flex-shrink-0">
                <VTooltip text="Ver Ficha Técnica Completa" location="top">
                  <template #activator="{ props: tProps }">
                    <VBtn
                      v-bind="tProps"
                      size="small"
                      variant="tonal"
                      color="info"
                      icon="ri-eye-line"
                      @click="openDetail(item)"
                    />
                  </template>
                </VTooltip>

                <VTooltip v-if="can('edit_product')" text="Editar Registro" location="top">
                  <template #activator="{ props: tProps }">
                    <VBtn
                      v-bind="tProps"
                      size="small"
                      variant="tonal"
                      color="warning"
                      icon="ri-edit-line"
                      @click="openEdit(item)"
                    />
                  </template>
                </VTooltip>

                <VTooltip v-if="can('delete_product')" text="Eliminar" location="top">
                  <template #activator="{ props: tProps }">
                    <VBtn
                      v-bind="tProps"
                      size="small"
                      variant="tonal"
                      color="error"
                      icon="ri-delete-bin-line"
                      @click="deleteRequest(item)"
                    />
                  </template>
                </VTooltip>
              </div>
            </VCardActions>
          </VCard>
        </VCol>
      </VRow>

      <!-- ================= VISTA 2: TABLA MODERNA ESTILIZADA ================= -->
      <VCard v-else class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VCardText class="pa-0">
          <VTable class="custom-catalog-table">
            <thead>
              <tr class="bg-grey-lighten-5">
                <th class="text-left font-weight-bold py-3" style="width: 32%;">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-roadster-line" size="18" color="primary" />
                    <span>Vehículo y Modelo</span>
                  </div>
                </th>
                <th class="text-left font-weight-bold py-3">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-tools-line" size="18" color="primary" />
                    <span>Repuestos Compatibles Registrados</span>
                  </div>
                </th>
                <th class="text-center font-weight-bold py-3" style="width: 140px;">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in requests" :key="'table-' + item.id" class="catalog-table-row">
                <!-- Columna Vehículo -->
                <td class="py-4 align-top">
                  <div class="d-flex align-start gap-3">
                    <VAvatar
                      size="44"
                      rounded="lg"
                      :color="getBrandColor(item.brand)"
                      variant="tonal"
                      class="mt-1"
                    >
                      <VIcon icon="ri-car-line" size="22" />
                    </VAvatar>
                    <div>
                      <div class="text-caption font-weight-bold text-uppercase text-primary">
                        {{ item.brand }}
                      </div>
                      <div class="text-body-1 font-weight-bold text-high-emphasis">
                        {{ item.model }}
                      </div>
                      <div class="d-flex flex-wrap gap-1 mt-1">
                        <VChip size="x-small" color="secondary" variant="tonal" class="font-weight-medium">
                          {{ item.year }}
                        </VChip>
                        <VChip v-if="item.traction" size="x-small" color="info" variant="tonal" class="font-weight-medium">
                          {{ item.traction }}
                        </VChip>
                        <VChip v-if="item.origin_country" size="x-small" color="warning" variant="tonal" class="font-weight-medium">
                          {{ item.origin_country }}
                        </VChip>
                      </div>
                      <div class="text-caption text-disabled mt-2 d-flex align-center gap-1" style="font-size: 11px;">
                        <VIcon icon="ri-user-smile-line" size="12" />
                        <span>Por: {{ item.user ? (item.user.name + ' ' + (item.user.surname || '')) : 'Sistema' }}</span>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Columna Repuestos Compatibles -->
                <td class="py-3">
                  <div class="spare-part-list-table">
                    <div
                      v-for="(subItem, idx) in (item.items || [])"
                      :key="idx"
                      class="table-spare-item"
                      :class="{
                        'highlighted-match': isMatchingCategory(subItem.category) || isMatchingPrice(subItem.public_price)
                      }"
                    >
                      <!-- Badge Numerador -->
                      <div class="item-index-badge">
                        {{ idx + 1 }}
                      </div>

                      <!-- Descripción y Marca -->
                      <div class="min-w-0">
                        <div class="text-body-2 font-weight-semibold text-uppercase text-truncate text-high-emphasis">
                          {{ subItem.spare_parts_detail }}
                        </div>
                        <div class="text-caption text-medium-emphasis text-truncate" style="font-size: 11px;">
                          Marca: <span class="font-weight-medium text-high-emphasis">{{ subItem.spare_part_brand }}</span>
                        </div>
                      </div>

                      <!-- Categoría -->
                      <div>
                        <VChip
                          size="x-small"
                          :color="isMatchingCategory(subItem.category) ? 'primary' : 'default'"
                          :variant="isMatchingCategory(subItem.category) ? 'elevated' : 'tonal'"
                          class="font-weight-medium text-uppercase text-truncate"
                        >
                          {{ subItem.category }}
                        </VChip>
                      </div>

                      <!-- Precios -->
                      <div class="text-right">
                        <div
                          class="text-body-2 font-weight-bold"
                          :class="isMatchingPrice(subItem.public_price) ? 'text-primary' : 'text-success'"
                        >
                          PVP: ${{ parseFloat(subItem.public_price || 0).toFixed(2) }}
                        </div>
                        <div class="text-caption text-disabled" style="font-size: 11px; font-family: monospace;">
                          Compra: ${{ parseFloat(subItem.purchase_price || 0).toFixed(2) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Columna Acciones -->
                <td class="text-center py-4 align-top">
                  <div class="d-flex justify-center gap-1 mt-2">
                    <VTooltip text="Ver Ficha Técnica" location="top">
                      <template #activator="{ props: tProps }">
                        <VBtn
                          v-bind="tProps"
                          size="small"
                          color="info"
                          variant="tonal"
                          icon="ri-eye-line"
                          @click="openDetail(item)"
                        />
                      </template>
                    </VTooltip>

                    <VTooltip v-if="can('edit_product')" text="Editar" location="top">
                      <template #activator="{ props: tProps }">
                        <VBtn
                          v-bind="tProps"
                          size="small"
                          color="warning"
                          variant="tonal"
                          icon="ri-edit-line"
                          @click="openEdit(item)"
                        />
                      </template>
                    </VTooltip>

                    <VTooltip v-if="can('delete_product')" text="Eliminar" location="top">
                      <template #activator="{ props: tProps }">
                        <VBtn
                          v-bind="tProps"
                          size="small"
                          color="error"
                          variant="tonal"
                          icon="ri-delete-bin-line"
                          @click="deleteRequest(item)"
                        />
                      </template>
                    </VTooltip>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>

      <!-- ================= PAGINACIÓN ================= -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-caption text-medium-emphasis">
            Mostrando <span class="font-weight-bold text-high-emphasis">{{ requests.length }}</span> de <span class="font-weight-bold text-high-emphasis">{{ totalItems }}</span> registros
          </div>
          <VPagination
            v-model="page"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            color="primary"
            @update:model-value="handlePageChange"
          />
        </div>
      </VCard>
    </div>

    <!-- Formulario modal de Creación/Edición -->
    <InfoRepuestoFormDialog
      v-model:isDialogVisible="isFormDialogOpen"
      :request-selected="requestSelected"
      @save-success="handleSaveSuccess"
    />

    <!-- Detalle modal -->
    <InfoRepuestoDetailDialog
      v-model:isDialogVisible="isDetailDialogOpen"
      :request-selected="requestSelected"
    />
  </div>
</template>

<style scoped lang="scss">
.vehicle-catalog-card {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-color: rgba(var(--v-border-color), 0.12) !important;
  background-color: rgb(var(--v-theme-surface)) !important;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(var(--v-theme-primary), 0.1) !important;
    border-color: rgba(var(--v-theme-primary), 0.35) !important;
  }
}

.card-accent-bar {
  height: 4px;
  width: 100%;
}

.card-spare-item {
  background-color: rgba(var(--v-theme-on-surface), 0.025);
  border: 1px solid rgba(var(--v-border-color), 0.08);
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.045);
    border-color: rgba(var(--v-theme-primary), 0.2);
    transform: translateX(2px);
  }
}

.highlighted-match {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
  border-color: rgba(var(--v-theme-primary), 0.35) !important;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.12);
}

.text-xxs {
  font-size: 0.65rem !important;
}

.letter-spacing-1 {
  letter-spacing: 0.5px;
}

.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.spare-part-list-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.table-spare-item {
  display: grid;
  grid-template-columns: 26px 1fr 120px 140px;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  border: 1px solid rgba(var(--v-border-color), 0.08);
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.04);
    border-color: rgba(var(--v-theme-primary), 0.2);
  }
}

.item-index-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
}

.catalog-table-row {
  transition: background-color 0.2s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.015) !important;
  }
}
</style>
