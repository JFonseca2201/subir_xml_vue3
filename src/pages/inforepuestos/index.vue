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

// Matching helpers for highlighting in table
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
    <!-- Header y Filtros Fijos (Sticky Top) -->
    <div class="sticky-page-header-wrapper">
      <!-- Título y botón superior -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4 relative-header">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
            <VIcon icon="ri-file-list-3-line" color="primary" class="me-2" size="28" />
            Gestión y Búsqueda de Repuestos por Vehículo
          </h1>
          <p class="text-medium-emphasis mb-0">
            Administra el historial de repuestos y compatibilidades por marca, modelo, año, categoría y precio.
          </p>
        </div>

        <VBtn v-if="can('register_product')" color="primary" prepend-icon="ri-add-line" class="elevation-2"
          @click="openCreate">
          Registrar Búsqueda
        </VBtn>
      </div>

      <!-- Filtros de Búsqueda -->
      <VCard class="mb-4 elevation-0 border-light border rounded-lg sticky-filter-card">
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
                class="w-100"
                @click="resetFilters"
              >
                Limpiar Filtros
              </VBtn>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </div>

    <!-- Listado principal -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <VCardText class="pa-0">
        <VTable class="custom-catalog-table">
          <thead>
            <tr>
              <th class="text-left font-weight-bold" style="width: 35%;">
                Información de Vehículo
              </th>
              <th class="text-left font-weight-bold">
                Repuestos Compatibles Registrados
              </th>
              <th class="text-center font-weight-bold" style="width: 150px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Skeleton Loader -->
            <tr v-for="i in 5" v-if="loading" :key="'skeleton-' + i" class="skeleton-row align-middle">
              <!-- Columna Vehículo -->
              <td class="py-4">
                <div class="vehicle-info-cell">
                  <div class="shimmer-line w-75 mb-2" style="height: 16px;" />
                  <div class="d-flex align-center gap-1 mt-1">
                    <div class="shimmer-chip" style="width: 42px; height: 18px;" />
                    <div class="shimmer-chip" style="width: 48px; height: 18px;" />
                    <div class="shimmer-chip" style="width: 56px; height: 18px;" />
                  </div>
                  <div class="d-flex align-center gap-1 mt-2">
                    <div class="shimmer-line w-40" style="height: 10px;" />
                  </div>
                </div>
              </td>

              <!-- Columna Repuestos Compatibles -->
              <td class="py-3">
                <div class="spare-part-list-wrapper">
                  <div v-for="j in 2" :key="j" class="spare-part-row-item">
                    <div class="shimmer-circle" style="width: 18px; height: 18px; min-width: 18px;" />
                    <div class="item-info">
                      <div class="shimmer-line w-75 mb-1" style="height: 12px;" />
                      <div class="shimmer-line w-40" style="height: 10px;" />
                    </div>
                    <div class="item-category">
                      <div class="shimmer-chip" style="width: 60px; height: 18px;" />
                    </div>
                    <div class="item-pricing">
                      <div class="shimmer-line w-75 mb-1" style="height: 12px;" />
                      <div class="shimmer-line w-50" style="height: 10px;" />
                    </div>
                  </div>
                </div>
              </td>

              <!-- Columna Acciones -->
              <td class="py-4 text-center">
                <div class="d-flex justify-center gap-1">
                  <div class="shimmer-button rounded" />
                  <div class="shimmer-button rounded" />
                  <div class="shimmer-button rounded" />
                </div>
              </td>
            </tr>

            <!-- No Data -->
            <tr v-else-if="requests.length === 0">
              <td colspan="3" class="text-center py-8">
                <VIcon icon="ri-inbox-line" size="48" class="text-grey-lighten-1 mb-2" />
                <h4 class="text-h6 font-weight-bold">
                  No se encontraron registros
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                  Prueba cambiando los filtros o agrega una nueva búsqueda arriba.
                </p>
              </td>
            </tr>

            <!-- Table Rows -->
            <tr v-for="item in requests" v-else :key="item.id" class="catalog-row">
              <td>
                <div class="vehicle-info-cell">
                  <div class="vehicle-title text-uppercase font-weight-bold">
                    {{ item.brand }} {{ item.model }}
                  </div>
                  <div class="vehicle-meta-chips d-flex align-center gap-1 mt-1">
                    <VChip size="x-small" color="secondary" variant="tonal" class="font-weight-bold">
                      {{ item.year }}
                    </VChip>
                    <VChip v-if="item.traction" size="x-small" color="info" variant="tonal" class="font-weight-bold">
                      {{ item.traction }}
                    </VChip>
                    <VChip v-if="item.origin_country" size="x-small" color="warning" variant="tonal"
                      class="font-weight-bold">
                      {{ item.origin_country }}
                    </VChip>
                  </div>
                  <div class="vehicle-user text-caption text-disabled mt-2 d-flex align-center gap-1">
                    <VIcon icon="ri-user-smile-line" size="12" />
                    <span>Por: {{ item.user ? (item.user.name + ' ' + (item.user.surname || '')) : 'Sistema' }}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="spare-part-list-wrapper">
                  <div v-for="(subItem, idx) in (item.items || [])" :key="idx" class="spare-part-row-item">
                    <!-- Icon or Index Badge -->
                    <div style="font-size: 10px;">
                      #{{ idx + 1 }}
                    </div>

                    <!-- Description & Brand -->
                    <div class="item-info">
                      <div class="item-name text-uppercase">
                        {{ subItem.spare_parts_detail }}
                      </div>
                      <div class="item-brand">
                        Marca: {{ subItem.spare_part_brand }}
                      </div>
                    </div>

                    <!-- Category -->
                    <div class="item-category">
                      <VChip
                        size="x-small"
                        :color="isMatchingCategory(subItem.category) ? 'primary' : 'default'"
                        :variant="isMatchingCategory(subItem.category) ? 'elevated' : 'tonal'"
                        class="font-weight-medium text-uppercase"
                      >
                        {{ subItem.category }}
                      </VChip>
                    </div>

                    <!-- Pricing -->
                    <div class="item-pricing">
                      <span
                        class="price-sell"
                        :class="{ 'text-primary font-weight-bold': isMatchingPrice(subItem.public_price) }"
                      >
                        PVP: ${{ parseFloat(subItem.public_price || 0).toFixed(2) }}
                      </span>
                      <span class="price-buy">
                        Compra: ${{ parseFloat(subItem.purchase_price || 0).toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <div class="d-flex justify-center gap-1">
                  <!-- Ver Detalle -->
                  <VBtn size="small" color="info" variant="text" icon="ri-eye-line" @click="openDetail(item)" />
                  <!-- Editar -->
                  <VBtn v-if="can('edit_product')" size="small" color="warning" variant="text" icon="ri-edit-line"
                    @click="openEdit(item)" />
                  <!-- Eliminar -->
                  <VBtn v-if="can('delete_product')" size="small" color="error" variant="text" icon="ri-delete-bin-line"
                    @click="deleteRequest(item)" />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ requests.length }}</span> de <span class="font-weight-bold">{{
              totalItems }}</span> registros
          </div>
          <VPagination v-model="page" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="handlePageChange" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Formulario modal de Creación/Edición -->
    <InfoRepuestoFormDialog v-model:isDialogVisible="isFormDialogOpen" :request-selected="requestSelected"
      @save-success="handleSaveSuccess" />

    <!-- Detalle modal -->
    <InfoRepuestoDetailDialog v-model:isDialogVisible="isDetailDialogOpen" :request-selected="requestSelected" />
  </div>
</template>
