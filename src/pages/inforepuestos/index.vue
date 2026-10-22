<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import InfoRepuestoFormDialog from '@/components/inforepuestos/InfoRepuestoFormDialog.vue'
import InfoRepuestoDetailDialog from '@/components/inforepuestos/InfoRepuestoDetailDialog.vue'
import InfoRepuestoDeleteDialog from '@/components/inforepuestos/InfoRepuestoDeleteDialog.vue'
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
const isDeleteDialogOpen = ref(false)
const requestSelected = ref(null)
const requestToDelete = ref(null)

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

// Debounced watchers for text
let searchDebounceTimer = null
watch(searchQuery, () => {
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
    (tractionFilter.value && tractionFilter.value !== 'ALL') ||
    yearFilter.value
  )
})

const resetFilters = () => {
  searchQuery.value = ''
  categoryFilter.value = 'ALL'
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

const openDelete = item => {
  requestToDelete.value = item
  isDeleteDialogOpen.value = true
}

const handleDeleteSuccess = () => {
  loadCategories()
  loadRequests()
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
        <h1 class="text-h5 text-sm-h4 font-weight-bold mb-1 d-flex align-center flex-wrap">
          <VAvatar
            size="42"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="me-3 flex-shrink-0"
          >
            <VIcon
              icon="ri-roadster-line"
              size="26"
            />
          </VAvatar>
          <span>Gestión de Repuestos</span>
        </h1>
        <p class="text-caption text-sm-body-2 text-medium-emphasis mb-0 d-none d-sm-block">
          Encuentra repuestos compatibles por modelo de vehículo con sus categorías, marcas y precios.
        </p>
      </div>

      <div class="d-flex align-center justify-end gap-2 flex-wrap ms-auto crud-header-actions">
        <VBtn
          v-if="can('register_product')"
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          size="default"
          @click="openCreate"
        >
          Registrar Búsqueda
        </VBtn>
      </div>
    </div>

    <!-- Panel de Filtros -->
    <VCard class="mb-6 elevation-0 border rounded-xl bg-surface">
      <VCardText class="pa-5">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon icon="ri-filter-3-line" size="18" color="primary" />
            <span>Filtros de Búsqueda</span>
          </div>

          <VBtn v-if="hasActiveFilters" variant="text" color="error" size="small" prepend-icon="ri-filter-off-line"
            class="font-weight-semibold" @click="resetFilters">
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow dense class="gap-y-3">
          <!-- Búsqueda General -->
          <VCol cols="12" sm="6" md="4">
            <VTextField v-model="searchQuery" label="Buscar por Palabra Clave"
              placeholder="Ej: Chevrolet, Vitara, Amortiguador, Monroe..." clearable variant="outlined"
              density="comfortable" hide-details="auto" prepend-inner-icon="ri-search-2-line" />
          </VCol>

          <!-- Filtro Categoría -->
          <VCol cols="12" sm="6" md="3">
            <VAutocomplete v-model="categoryFilter" label="Categoría del Repuesto" :items="categoryOptions"
              item-title="title" item-value="value" clearable variant="outlined" density="comfortable"
              hide-details="auto" prepend-inner-icon="ri-price-tag-3-line" placeholder="Todas las Categorías" />
          </VCol>

          <!-- Tracción -->
          <VCol cols="12" sm="6" md="3">
            <VSelect v-model="tractionFilter" label="Tracción / Suspensión" :items="[
              { title: 'Todas las Tracciones', value: 'ALL' },
              { title: '4x4', value: '4X4' },
              { title: '4x2', value: '4X2' },
              { title: 'AWD', value: 'AWD' },
              { title: 'FWD', value: 'FWD' },
              { title: 'RWD', value: 'RWD' }
            ]" item-title="title" item-value="value" variant="outlined" density="comfortable" hide-details="auto" />
          </VCol>

          <!-- Año -->
          <VCol cols="12" sm="6" md="2">
            <VTextField v-model.number="yearFilter" label="Año" type="number" placeholder="Ej: 2010"
              clearable variant="outlined" density="comfortable" hide-details="auto"
              prepend-inner-icon="ri-calendar-line" />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Estado Vacío (Sin Resultados) -->
    <VCard v-if="!loading && (!requests || requests.length === 0)"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4">
      <VAvatar size="80" color="primary" variant="tonal" class="mb-4">
        <VIcon icon="ri-search-eye-line" size="40" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron vehículos ni repuestos
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 520px;">
        No hay registros que coincidan con los filtros aplicados. Puedes restablecer los filtros para ver todo el
        catálogo o registrar una nueva búsqueda.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line"
          @click="resetFilters">
          Limpiar Filtros
        </VBtn>
        <VBtn v-if="can('register_product')" color="primary" prepend-icon="ri-add-line" @click="openCreate">
          Registrar Repuesto
        </VBtn>
      </div>
    </VCard>

    <!-- LISTADO DE VEHÍCULOS Y REPUESTOS (DISEÑO CLARO Y ORDENADO) -->
    <div v-else class="vehicle-catalog-container d-flex flex-column gap-5 mobile-card-list-container">
      <!-- Skeletons durante la carga -->
      <template v-if="loading">
        <VCard v-for="i in 3" :key="'sk-' + i"
          class="vehicle-block-card rounded-xl border elevation-0 bg-surface overflow-hidden pa-5">
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
      </template>

      <template v-else>
        <VCard v-for="item in requests" :key="item.id"
          class="vehicle-block-card rounded-xl border elevation-0 bg-surface overflow-hidden">
          <!-- Cabecera del Vehículo (Responsive: perfecto en móvil y escritorio) -->
          <div class="vehicle-block-header pa-3 px-4 border-b">
            <div class="d-flex flex-column flex-sm-row align-sm-center justify-space-between gap-2.5">
              <!-- Bloque de Identificación del Vehículo (Marca, Modelo, Año, etc.) -->
              <div class="d-flex align-center flex-wrap gap-2 flex-grow-1">
                <!-- Icono del Vehículo -->
                <VAvatar
                  size="28"
                  rounded="md"
                  :color="getBrandColor(item.brand)"
                  variant="tonal"
                  class="elevation-0 flex-shrink-0"
                >
                  <VIcon
                    icon="ri-car-line"
                    size="16"
                  />
                </VAvatar>

                <!-- Marca (ej. KIA) -->
                <span class="brand-badge text-caption font-weight-bold text-uppercase flex-shrink-0">
                  {{ item.brand }}
                </span>

                <!-- Modelo / Nombre (ej. RIO R) -->
                <span class="text-body-1 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.3px;">
                  {{ item.model }}
                </span>

                <!-- Año -->
                <div class="status-pill-clean status-secondary flex-shrink-0">
                  <VIcon
                    icon="ri-calendar-line"
                    size="12"
                  />
                  <span>Año {{ item.year }}</span>
                </div>

                <!-- Tracción -->
                <div
                  v-if="item.traction"
                  class="status-pill-clean status-info flex-shrink-0"
                >
                  <VIcon
                    icon="ri-compass-3-line"
                    size="12"
                  />
                  <span>{{ item.traction }}</span>
                </div>

                <!-- Procedencia / País -->
                <div
                  v-if="item.origin_country"
                  class="status-pill-clean status-partial flex-shrink-0"
                >
                  <VIcon
                    icon="ri-earth-line"
                    size="12"
                  />
                  <span>{{ item.origin_country }}</span>
                </div>
              </div>

              <!-- Bloque de Acciones Rápidas (Organizado y sin distorsión) -->
              <div class="vehicle-header-actions d-flex align-center justify-end flex-nowrap gap-2 flex-shrink-0">
                <VBtn
                  size="small"
                  color="info"
                  variant="tonal"
                  prepend-icon="ri-file-list-3-line"
                  class="font-weight-medium px-2.5 flex-shrink-0"
                  title="Ver Ficha Técnica Completa"
                  @click="openDetail(item)"
                >
                  Ficha
                </VBtn>

                <VBtn
                  size="small"
                  color="warning"
                  variant="tonal"
                  icon="ri-edit-line"
                  class="flex-shrink-0"
                  title="Editar Registro"
                  @click="openEdit(item)"
                />

                <VBtn
                  size="small"
                  color="error"
                  variant="tonal"
                  icon="ri-delete-bin-line"
                  class="flex-shrink-0"
                  title="Eliminar Vehículo"
                  @click="openDelete(item)"
                />
              </div>
            </div>
          </div>

          <!-- Repuestos Compatibles -->
          <VCardText class="pa-0">
            <!-- VISTA MÓVIL: Repuestos en tarjetas compactas (d-md-none) -->
            <div class="d-md-none pa-3 d-flex flex-column gap-2.5">
              <div v-for="(subItem, idx) in (item.items || [])" :key="'mob-subitem-' + idx"
                class="pa-3 rounded-lg border bg-surface" :class="{
                  'row-highlighted': isMatchingCategory(subItem.category)
                }">
                <div class="d-flex align-start justify-space-between gap-2 mb-1.5">
                  <div class="text-body-2 font-weight-bold text-uppercase text-high-emphasis flex-grow-1" style="line-height: 1.35;">
                    {{ subItem.spare_parts_detail }}
                  </div>
                  <div class="status-pill-clean status-pill-compact flex-shrink-0 ms-1"
                    :class="isMatchingCategory(subItem.category) ? 'status-paid' : 'status-info'">
                    <span class="status-dot" />
                    <span>{{ subItem.category }}</span>
                  </div>
                </div>

                <div class="text-caption text-medium-emphasis mb-2">
                  Marca: <strong class="text-high-emphasis">{{ subItem.spare_part_brand || 'Genérica' }}</strong>
                </div>

                <div class="d-flex align-center justify-space-between pt-1.5 border-t">
                  <div class="text-caption text-medium-emphasis">
                    P. Compra: <span class="font-family-mono font-weight-medium text-high-emphasis">${{
                      parseFloat(subItem.purchase_price || 0).toFixed(2) }}</span>
                  </div>
                  <div class="text-right">
                    <span class="text-caption text-disabled me-1">PVP:</span>
                    <span class="font-weight-bold text-body-1 font-family-mono text-success">
                      ${{ parseFloat(subItem.public_price || 0).toFixed(2) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Si no tiene repuestos en móvil -->
              <div v-if="!item.items || item.items.length === 0" class="text-center py-4 text-disabled text-caption">
                No hay repuestos registrados para este vehículo.
              </div>
            </div>

            <!-- VISTA ESCRITORIO: Tabla Limpia (d-none d-md-block) -->
            <div class="d-none d-md-block table-responsive">
              <VTable class="spare-parts-clean-table">
                <thead>
                  <tr class="table-sub-header">
                    <th class="text-center font-weight-bold" style="width: 50px;">
                      #
                    </th>
                    <th class="text-left font-weight-bold">
                      Repuesto / Detalle Técnico
                    </th>
                    <th class="text-left font-weight-bold" style="width: 150px;">
                      Marca
                    </th>
                    <th class="text-left font-weight-bold" style="width: 160px;">
                      Categoría
                    </th>
                    <th class="text-right font-weight-bold" style="width: 120px;">
                      P. Compra
                    </th>
                    <th class="text-right font-weight-bold" style="width: 130px;">
                      PVP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(subItem, idx) in (item.items || [])" :key="idx" class="spare-part-table-row" :class="{
                    'row-highlighted': isMatchingCategory(subItem.category)
                  }">
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

                    <!-- Categoría (Estilo status-pill-clean con punto) -->
                    <td>
                      <div class="status-pill-clean"
                        :class="isMatchingCategory(subItem.category) ? 'status-paid' : 'status-info'">
                        <span class="status-dot" />
                        <span>{{ subItem.category }}</span>
                      </div>
                    </td>

                    <!-- Costo Compra -->
                    <td class="text-right">
                      <span class="text-body-2 text-medium-emphasis font-family-mono">
                        ${{ parseFloat(subItem.purchase_price || 0).toFixed(2) }}
                      </span>
                    </td>

                    <!-- Precio Venta (PVP) -->
                    <td class="text-right">
                      <div class="text-h6 font-weight-bold text-success">
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
          <div
            class="pa-3 px-5 bg-grey-lighten-5 border-t d-flex align-center justify-space-between text-caption text-medium-emphasis">
            <div class="d-flex align-center gap-1.5">
              <VIcon icon="ri-user-smile-line" size="14" />
              <span>Registrado por: <strong class="text-high-emphasis">{{ item.user ? (item.user.name + ' ' +
                (item.user.surname || '')) : 'Sistema' }}</strong></span>
            </div>

            <div v-if="item.created_at" class="text-disabled">
              Fecha: {{ new Date(item.created_at).toLocaleDateString() }}
            </div>
          </div>
        </VCard>
      </template>

      <!-- Paginación -->
      <VCard v-if="totalPages > 0" class="rounded-xl border elevation-0 pa-4 bg-surface mt-2">
        <div
          class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100 text-center text-sm-start">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ requests.length }}</strong> de <strong
              class="text-high-emphasis">{{ totalItems }}</strong> vehículos registrados
          </div>
          <VPagination v-model="page" :length="totalPages" :disabled="loading" rounded="circle"
            :total-visible="$vuetify.display.xs ? 4 : 7" :size="$vuetify.display.xs ? 'small' : 'default'"
            density="comfortable" color="primary" class="my-0" @update:model-value="handlePageChange" />
        </div>
      </VCard>
    </div>

    <!-- Modales -->
    <InfoRepuestoFormDialog v-model:isDialogVisible="isFormDialogOpen" :request-selected="requestSelected"
      @save-success="handleSaveSuccess" />

    <InfoRepuestoDetailDialog v-model:isDialogVisible="isDetailDialogOpen" :request-selected="requestSelected" />

    <InfoRepuestoDeleteDialog v-model:isDialogVisible="isDeleteDialogOpen" :request-selected="requestToDelete"
      @delete-success="handleDeleteSuccess" />
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

.vehicle-block-header {
  background-color: #f1f5f9 !important;
  border-bottom: 1.5px solid #e2e8f0 !important;
}

[data-theme="dark"] .vehicle-block-header,
[data-theme="dark-glass"] .vehicle-block-header,
[data-theme="semi-dark-glass"] .vehicle-block-header,
[data-theme="taller"] .vehicle-block-header,
.v-theme--dark .vehicle-block-header,
.v-theme--dark-glass .vehicle-block-header,
.v-theme--semi-dark-glass .vehicle-block-header,
.v-theme--taller .vehicle-block-header {
  background-color: rgba(var(--v-theme-surface), 0.95) !important;
  border-bottom: 1.5px solid rgba(var(--v-border-color), 0.25) !important;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 6px;
  background-color: rgba(var(--v-theme-primary), 0.12);
  border: 1px solid rgba(var(--v-theme-primary), 0.25);
  color: rgb(var(--v-theme-primary));
  font-weight: 800;
  font-size: 0.76rem;
  letter-spacing: 0.6px;
  line-height: 1.2;
}

.vehicle-title {
  font-size: 1.15rem !important;
  font-weight: 800 !important;
  letter-spacing: 0.3px !important;
  line-height: 1.25 !important;
  color: rgba(var(--v-theme-on-surface), 0.92) !important;
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

// Status Pills (Estilo listado de clientes / ventas)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1.2 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;
  margin: 1px 0 !important;

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

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
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

.status-info {
  background-color: #eff6ff !important;
  color: #1e40af !important;
  border: 1px solid #bfdbfe !important;

  .status-dot {
    background-color: #3b82f6 !important;
  }
}

.status-secondary {
  background-color: rgba(var(--v-theme-on-surface), 0.08) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;

  .status-dot {
    background-color: rgba(var(--v-theme-on-surface), 0.6) !important;
  }
}

.status-primary {
  background-color: #eef2ff !important;
  color: #4338ca !important;
  border: 1px solid #c7d2fe !important;

  .status-dot {
    background-color: #6366f1 !important;
  }
}

.status-pill-compact {
  padding: 2px 7px !important;
  font-size: 0.65rem !important;
  font-weight: 700 !important;
  gap: 4px !important;

  .status-dot {
    width: 5px !important;
    height: 5px !important;
  }
}

@media (max-width: 600px) {
  .vehicle-header-actions {
    width: 100%;
    justify-content: flex-end !important;
    padding-top: 6px;
    border-top: 1px dashed rgba(var(--v-border-color), 0.15);
  }
}
</style>
