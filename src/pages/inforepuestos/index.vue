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
const perPage = ref(10)
const totalPages = ref(1)
const totalItems = ref(0)

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

// Debounced watchers for text/numbers
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

// Helpers for highlighting matching items
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

// Brand theme color
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

const handlePageChange = newPage => {
  page.value = newPage
  loadRequests()
}

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
    <!-- Encabezado Principal -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-5">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-roadster-line" size="26" />
          </VAvatar>
          Gestión y Búsqueda de Repuestos por Vehículo
        </h1>
        <p class="text-medium-emphasis mb-0">
          Encuentra repuestos compatibles por modelo de vehículo con sus categorías, marcas y precios de compra y venta.
        </p>
      </div>

      <VBtn
        v-if="can('register_product')"
        color="primary"
        prepend-icon="ri-add-line"
        size="large"
        class="elevation-2 font-weight-bold rounded-lg"
        @click="openCreate"
      >
        Registrar Búsqueda
      </VBtn>
    </div>

    <!-- Panel de Filtros -->
    <VCard class="mb-6 elevation-0 border rounded-xl bg-surface">
      <VCardText class="pa-5">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon icon="ri-filter-3-line" size="18" color="primary" />
            <span>Filtros de Búsqueda</span>
          </div>

          <VBtn
            v-if="hasActiveFilters"
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

        <VRow dense class="gap-y-3">
          <!-- Búsqueda General -->
          <VCol cols="12" md="4">
            <VTextField
              v-model="searchQuery"
              label="Buscar por Palabra Clave"
              placeholder="Ej: Chevrolet, Vitara, Amortiguador, Monroe..."
              clearable
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              prepend-inner-icon="ri-search-2-line"
            />
          </VCol>

          <!-- Filtro Categoría -->
          <VCol cols="12" sm="6" md="4">
            <VAutocomplete
              v-model="categoryFilter"
              label="Categoría del Repuesto"
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

          <!-- Tracción -->
          <VCol cols="12" sm="6" md="4">
            <VSelect
              v-model="tractionFilter"
              label="Tracción / Suspensión"
              :items="[
                { title: 'Todas las Tracciones', value: 'ALL' },
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

          <!-- Rango de Precios y Año -->
          <VCol cols="6" sm="4" md="4">
            <VTextField
              v-model.number="minPriceFilter"
              label="Precio Venta Mínimo"
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

          <VCol cols="6" sm="4" md="4">
            <VTextField
              v-model.number="maxPriceFilter"
              label="Precio Venta Máximo"
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

          <VCol cols="12" sm="4" md="4">
            <VTextField
              v-model.number="yearFilter"
              label="Año del Vehículo"
              type="number"
              placeholder="Ej: 2010"
              clearable
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              prepend-inner-icon="ri-calendar-line"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Estado de Carga (Skeleton) -->
    <div v-if="loading" class="d-flex flex-column gap-4">
      <VCard v-for="i in 3" :key="'sk-' + i" class="rounded-xl border pa-5 elevation-0 bg-surface">
        <div class="d-flex align-center gap-3 mb-4">
          <div class="shimmer-circle" style="width: 48px; height: 48px; border-radius: 12px;" />
          <div class="flex-grow-1">
            <div class="shimmer-line w-40 mb-2" style="height: 18px;" />
            <div class="shimmer-line w-25" style="height: 12px;" />
          </div>
        </div>
        <div class="shimmer-line w-100 mb-2" style="height: 36px; border-radius: 6px;" />
        <div class="shimmer-line w-100 mb-2" style="height: 36px; border-radius: 6px;" />
      </VCard>
    </div>

    <!-- Estado Vacío (Sin Resultados) -->
    <VCard
      v-else-if="requests.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="80" color="primary" variant="tonal" class="mb-4">
        <VIcon icon="ri-search-eye-line" size="40" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron vehículos ni repuestos
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 520px;">
        No hay registros que coincidan con los filtros aplicados. Puedes restablecer los filtros para ver todo el catálogo o registrar una nueva búsqueda.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Limpiar Filtros
        </VBtn>
        <VBtn v-if="can('register_product')" color="primary" prepend-icon="ri-add-line" @click="openCreate">
          Registrar Repuesto
        </VBtn>
      </div>
    </VCard>

    <!-- LISTADO DE VEHÍCULOS Y REPUESTOS (DISEÑO CLARO Y ORDENADO) -->
    <div v-else class="vehicle-catalog-container d-flex flex-column gap-5">
      <VCard
        v-for="item in requests"
        :key="item.id"
        class="vehicle-block-card rounded-xl border elevation-0 bg-surface overflow-hidden"
      >
        <!-- Cabecera del Vehículo -->
        <div class="vehicle-block-header pa-4 pa-sm-5 bg-grey-lighten-5 border-b d-flex flex-wrap align-center justify-space-between gap-4">
          <!-- Identificación del Vehículo -->
          <div class="d-flex align-center gap-3">
            <VAvatar size="50" rounded="lg" :color="getBrandColor(item.brand)" variant="tonal" class="elevation-0">
              <VIcon icon="ri-car-line" size="28" />
            </VAvatar>
            <div>
              <div class="text-caption font-weight-bold text-uppercase text-primary">
                {{ item.brand }}
              </div>
              <h2 class="text-h5 font-weight-bold text-high-emphasis mb-1">
                {{ item.model }}
              </h2>
              <div class="d-flex flex-wrap align-center gap-2">
                <VChip size="small" color="secondary" variant="tonal" prepend-icon="ri-calendar-line" class="font-weight-medium">
                  Año {{ item.year }}
                </VChip>
                <VChip v-if="item.traction" size="small" color="info" variant="tonal" prepend-icon="ri-compass-3-line" class="font-weight-medium">
                  {{ item.traction }}
                </VChip>
                <VChip v-if="item.origin_country" size="small" color="warning" variant="tonal" prepend-icon="ri-earth-line" class="font-weight-medium">
                  {{ item.origin_country }}
                </VChip>
              </div>
            </div>
          </div>

          <!-- Resumen y Acciones Rápidas -->
          <div class="d-flex align-center flex-wrap gap-3">
            <VChip color="primary" variant="flat" size="default" class="font-weight-bold">
              <VIcon icon="ri-tools-line" size="16" class="me-1.5" />
              {{ (item.items || []).length }} {{ (item.items || []).length === 1 ? 'Repuesto' : 'Repuestos' }}
            </VChip>

            <div class="d-flex align-center gap-1">
              <VTooltip text="Ver Ficha Técnica Completa" location="top">
                <template #activator="{ props: tProps }">
                  <VBtn
                    v-bind="tProps"
                    size="small"
                    color="info"
                    variant="tonal"
                    prepend-icon="ri-file-list-3-line"
                    class="font-weight-medium"
                    @click="openDetail(item)"
                  >
                    Ficha
                  </VBtn>
                </template>
              </VTooltip>

              <VTooltip v-if="can('edit_product')" text="Editar Registro" location="top">
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

              <VTooltip v-if="can('delete_product')" text="Eliminar Vehículo" location="top">
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
          </div>
        </div>

        <!-- Tabla Limpia de Repuestos Compatibles -->
        <VCardText class="pa-0">
          <div class="table-responsive">
            <VTable class="spare-parts-clean-table">
              <thead>
                <tr class="table-sub-header">
                  <th class="text-center font-weight-bold" style="width: 50px;">#</th>
                  <th class="text-left font-weight-bold">Repuesto / Detalle Técnico</th>
                  <th class="text-left font-weight-bold" style="width: 180px;">Marca del Repuesto</th>
                  <th class="text-left font-weight-bold" style="width: 180px;">Categoría</th>
                  <th class="text-right font-weight-bold" style="width: 140px;">Precio Compra</th>
                  <th class="text-right font-weight-bold" style="width: 160px;">Precio Venta (PVP)</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(subItem, idx) in (item.items || [])"
                  :key="idx"
                  class="spare-part-table-row"
                  :class="{
                    'row-highlighted': isMatchingCategory(subItem.category) || isMatchingPrice(subItem.public_price)
                  }"
                >
                  <!-- Número -->
                  <td class="text-center">
                    <span class="index-pill font-weight-bold text-medium-emphasis">
                      {{ idx + 1 }}
                    </span>
                  </td>

                  <!-- Detalle -->
                  <td>
                    <div class="text-body-1 font-weight-bold text-uppercase text-high-emphasis">
                      {{ subItem.spare_parts_detail }}
                    </div>
                  </td>

                  <!-- Marca del repuesto -->
                  <td>
                    <span class="text-body-2 font-weight-medium text-high-emphasis">
                      {{ subItem.spare_part_brand }}
                    </span>
                  </td>

                  <!-- Categoría -->
                  <td>
                    <VChip
                      size="small"
                      :color="isMatchingCategory(subItem.category) ? 'primary' : 'default'"
                      :variant="isMatchingCategory(subItem.category) ? 'elevated' : 'tonal'"
                      class="font-weight-semibold text-uppercase"
                    >
                      <VIcon icon="ri-price-tag-3-line" size="14" class="me-1" />
                      {{ subItem.category }}
                    </VChip>
                  </td>

                  <!-- Costo Compra -->
                  <td class="text-right">
                    <span class="text-body-2 text-medium-emphasis font-family-mono">
                      ${{ parseFloat(subItem.purchase_price || 0).toFixed(2) }}
                    </span>
                  </td>

                  <!-- Precio Venta (PVP) -->
                  <td class="text-right">
                    <div
                      class="text-h6 font-weight-bold"
                      :class="isMatchingPrice(subItem.public_price) ? 'text-primary' : 'text-success'"
                    >
                      ${{ parseFloat(subItem.public_price || 0).toFixed(2) }}
                    </div>
                  </td>
                </tr>

                <!-- Si no tiene repuestos -->
                <tr v-if="!item.items || item.items.length === 0">
                  <td colspan="6" class="text-center py-5 text-disabled">
                    No hay repuestos registrados para este vehículo.
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>
        </VCardText>

        <!-- Pie de la tarjeta: Creador -->
        <div class="pa-3 px-5 bg-grey-lighten-5 border-t d-flex align-center justify-space-between text-caption text-medium-emphasis">
          <div class="d-flex align-center gap-1.5">
            <VIcon icon="ri-user-smile-line" size="14" />
            <span>Registrado por: <strong class="text-high-emphasis">{{ item.user ? (item.user.name + ' ' + (item.user.surname || '')) : 'Sistema' }}</strong></span>
          </div>

          <div v-if="item.created_at" class="text-disabled">
            Fecha: {{ new Date(item.created_at).toLocaleDateString() }}
          </div>
        </div>
      </VCard>

      <!-- Paginación -->
      <VCard class="rounded-xl border elevation-0 pa-4 bg-surface mt-2">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ requests.length }}</strong> de <strong class="text-high-emphasis">{{ totalItems }}</strong> vehículos registrados
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

    <!-- Modales -->
    <InfoRepuestoFormDialog
      v-model:isDialogVisible="isFormDialogOpen"
      :request-selected="requestSelected"
      @save-success="handleSaveSuccess"
    />

    <InfoRepuestoDetailDialog
      v-model:isDialogVisible="isDetailDialogOpen"
      :request-selected="requestSelected"
    />
  </div>
</template>

<style scoped lang="scss">
.vehicle-block-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.12) !important;

  &:hover {
    box-shadow: 0 6px 20px rgba(var(--v-theme-on-surface), 0.06) !important;
  }
}

.table-sub-header {
  background-color: rgba(var(--v-theme-on-surface), 0.03);

  th {
    font-size: 0.8rem !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(var(--v-theme-on-surface), 0.7) !important;
    padding: 12px 16px !important;
  }
}

.spare-part-table-row {
  transition: background-color 0.15s ease;

  td {
    padding: 12px 16px !important;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.06) !important;
  }

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.025) !important;
  }
}

.row-highlighted {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
  border-left: 4px solid rgb(var(--v-theme-primary)) !important;
}

.index-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background-color: rgba(var(--v-theme-on-surface), 0.06);
  font-size: 0.75rem;
}

.font-family-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
}
</style>
