<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import VehicleShowDialog from '@/components/inventory/vehicles/VehicleShowDialog.vue'
import VehicleAddDialog from '@/components/inventory/vehicles/VehicleAddDialog.vue'
import VehicleEditDialog from '@/components/inventory/vehicles/VehicleEditDialog.vue'
import VehicleDeleteDialog from '@/components/inventory/vehicles/VehicleDeleteDialog.vue'
import { getBrandNameById, getBrandOptions } from '@/data/vehicleBrands.js'
import { getVehicleTypeOptions, getVehicleTypeNameById, getVehicleTypeColor } from '@/data/vehicleTypes.js'
import ImportData from '@/components/inventory/import/ImportData.vue'
import SalesHistoryDialog from '@/components/dialogs/SalesHistoryDialog.vue'
import { usePermissions } from '@/composables/usePermissions'

// Router y notificaciones
const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()
const { can } = usePermissions()

// Estado
const loading = ref(false)
const vehicles = ref([])
const isVehicleShowDialogVisible = ref(false)
const vehicleToShow = ref(null)
const isVehicleAddDialogVisible = ref(false)
const isVehicleEditDialogVisible = ref(false)
const vehicleToEdit = ref(null)
const deleteDialog = ref(false)
const vehicleToDelete = ref(null)
const isImportDialogVisible = ref(false)
const isHistoryDialogVisible = ref(false)
const historyVehicleId = ref(null)

// Formulario de búsqueda
const searchForm = ref({
  search: '',
  vehicle_type: null,
  brand: null,
  year: null,
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(12)
const totalItems = ref(0)
const totalPages = ref(0)

// Opciones para selects
const vehicleTypeOptions = ref(getVehicleTypeOptions())
const brandOptions = ref(getBrandOptions())

// Generar opciones de años
const yearOptions = ref([])
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear()
  for (let i = currentYear; i >= currentYear - 25; i--) {
    yearOptions.value.push({ title: i.toString(), value: i })
  }
}

// Métricas / KPIs
const activeVehiclesCount = computed(() => {
  return vehicles.value.filter(v => parseInt(v.status) === 1).length
})

const uniqueBrandsCount = computed(() => {
  const brands = new Set(vehicles.value.map(v => getBrandNameById(v.brand) || v.brand).filter(Boolean))
  return brands.size
})

// Helper para colores según marca
const getBrandColor = brandId => {
  const brandName = (getBrandNameById(brandId) || '').toUpperCase()
  if (brandName.includes('CHEVROLET')) return 'warning'
  if (brandName.includes('TOYOTA')) return 'error'
  if (brandName.includes('HYUNDAI') || brandName.includes('KIA')) return 'info'
  if (brandName.includes('NISSAN') || brandName.includes('RENAULT')) return 'secondary'
  if (brandName.includes('FORD') || brandName.includes('MAZDA')) return 'primary'
  if (brandName.includes('VOLKSWAGEN') || brandName.includes('AUDI')) return 'success'
  return 'primary'
}

const hasActiveFilters = computed(() => {
  return !!(
    (searchForm.value.search && searchForm.value.search.trim()) ||
    searchForm.value.vehicle_type ||
    searchForm.value.brand ||
    searchForm.value.year
  )
})

const resetFilters = () => {
  searchForm.value = {
    search: '',
    vehicle_type: null,
    brand: null,
    year: null,
  }
  currentPage.value = 1
  loadVehicles()
}

let vehiclesAbortController = null

// Cargar vehículos
const loadVehicles = async () => {
  if (vehiclesAbortController) {
    vehiclesAbortController.abort()
  }
  vehiclesAbortController = new AbortController()

  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage.value,
    }

    if (searchForm.value.search) {
      params.search = searchForm.value.search
    }
    if (searchForm.value.vehicle_type) {
      params.vehicle_type = searchForm.value.vehicle_type
    }
    if (searchForm.value.brand) {
      params.brand = searchForm.value.brand
    }
    if (searchForm.value.year) {
      params.year = searchForm.value.year
    }

    const resp = await $api("vehicles", {
      method: "GET",
      params: params,
      signal: vehiclesAbortController.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      onResponseError({ response }) {
        console.error('Error de respuesta del servidor:', response)
      },
      onRequestError({ error }) {
        console.error('Error de solicitud:', error)
      },
    })

    let vehiclesData = []

    if (resp && typeof resp === 'object') {
      if (resp.vehicles && Array.isArray(resp.vehicles)) {
        vehiclesData = resp.vehicles
      } else if (Array.isArray(resp.data)) {
        vehiclesData = resp.data
      } else if (resp.data && Array.isArray(resp.data.data)) {
        vehiclesData = resp.data.data
      } else if (Array.isArray(resp)) {
        vehiclesData = resp
      } else {
        const possibleDataProps = ['vehicles', 'data', 'items', 'results', 'list']
        for (const prop of possibleDataProps) {
          if (resp[prop] && Array.isArray(resp[prop])) {
            vehiclesData = resp[prop]
            break
          }
        }
      }
    }

    vehicles.value = vehiclesData
    totalPages.value = resp.last_page || resp.total_pages || 1
    totalItems.value = resp.total || resp.total_items || resp.count || vehiclesData.length

  } catch (error) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
    console.error('❌ Error general al cargar vehículos:', error)
    vehicles.value = []
    totalPages.value = 0
    totalItems.value = 0
  } finally {
    loading.value = false
  }
}

// Watch con debounce
const debouncedLoadVehicles = useDebounceFn(() => {
  currentPage.value = 1
  loadVehicles()
}, 350)

watch(searchForm, () => {
  debouncedLoadVehicles()
}, { deep: true })

watch(currentPage, () => {
  loadVehicles()
})

// Métodos
const showVehicle = vehicle => {
  vehicleToShow.value = vehicle
  isVehicleShowDialogVisible.value = true
}

const showHistory = vehicle => {
  historyVehicleId.value = vehicle.id
  isHistoryDialogVisible.value = true
}

const addVehicle = () => {
  isVehicleAddDialogVisible.value = true
}

const editVehicle = vehicle => {
  vehicleToEdit.value = vehicle
  isVehicleEditDialogVisible.value = true
}

const deleteVehicle = vehicle => {
  vehicleToDelete.value = vehicle
  deleteDialog.value = true
}

const handleVehicleAdded = vehicleData => {
  loadVehicles()
  showNotification('Vehículo agregado correctamente', 'success')
}

const handleVehicleUpdated = vehicleData => {
  loadVehicles()
}

const handleVehicleDeleted = deletedVehicle => {
  const index = vehicles.value.findIndex(vehicle => vehicle.id === deletedVehicle.id)
  if (index > -1) {
    vehicles.value.splice(index, 1)
    totalItems.value = Math.max(0, totalItems.value - 1)
  }
  deleteDialog.value = false
  vehicleToDelete.value = null
}

const getVehicleTypeLabel = getVehicleTypeNameById

onMounted(() => {
  generateYearOptions()
  loadVehicles()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 vehicle-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-car-line" size="26" />
          </VAvatar>
          Gestión de Vehículos
        </h1>
        <p class="text-medium-emphasis mb-0">
          Control de parque automotor, información técnica de clientes y servicios en taller
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn v-if="can('import_xml') || can('register_car')" color="secondary" variant="tonal"
          prepend-icon="ri-upload-cloud-2-line" class="font-weight-medium" @click="isImportDialogVisible = true">
          Importar
        </VBtn>

        <VBtn v-if="can('register_car')" color="primary" prepend-icon="ri-add-line" class="elevation-2 font-weight-bold"
          @click="addVehicle">
          Agregar Vehículo
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-roadster-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Total Vehículos</div>
            <div class="text-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ totalItems }} <span class="text-caption text-disabled font-weight-regular">en sistema</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="success" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-checkbox-circle-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Vehículos Activos</div>
            <div class="text-h6 font-weight-bold text-success text-truncate">
              {{ activeVehiclesCount }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="warning" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-car-washing-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Marcas en Taller</div>
            <div class="text-h6 font-weight-bold text-warning text-truncate">
              {{ uniqueBrandsCount }} <span class="text-caption text-disabled font-weight-regular">distintas</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <VForm ref="searchFormRef">
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
            <VCol cols="12" md="4">
              <VTextField v-model="searchForm.search" label="Buscar vehículo"
                placeholder="Placa, marca, modelo o cliente..." clearable hide-details variant="outlined"
                density="comfortable" color="primary" :loading="loading" prepend-inner-icon="ri-search-2-line" />
            </VCol>

            <VCol cols="12" sm="4" md="3">
              <VSelect v-model="searchForm.vehicle_type" :items="vehicleTypeOptions" item-title="title"
                item-value="value" label="Tipo de Vehículo" placeholder="Todos" clearable hide-details
                variant="outlined" density="comfortable" color="primary" prepend-inner-icon="ri-truck-line" />
            </VCol>

            <VCol cols="12" sm="4" md="3">
              <VSelect v-model="searchForm.brand" :items="brandOptions" item-title="title" item-value="value"
                label="Marca" placeholder="Todas" clearable hide-details variant="outlined" density="comfortable"
                color="primary" prepend-inner-icon="ri-shield-star-line" />
            </VCol>

            <VCol cols="12" sm="4" md="2">
              <VSelect v-model="searchForm.year" :items="yearOptions" item-title="title" item-value="value" label="Año"
                placeholder="Todos" clearable hide-details variant="outlined" density="comfortable" color="primary"
                prepend-inner-icon="ri-calendar-line" />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>

    <!-- TABLA MODERNA DE VEHÍCULOS -->
    <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable hover class="vehicle-modern-table text-no-wrap overflow-x-auto">
        <thead>
          <tr class="bg-grey-lighten-5">
            <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
              ID
            </th>
            <th class="text-left font-weight-bold text-uppercase py-3" style="width: 160px; min-width: 150px;">
              Placa
            </th>
            <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
              Vehículo y Especificaciones
            </th>
            <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 220px;">
              Propietario / Cliente
            </th>
            <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px;">
              Estado
            </th>
            <th class="text-center font-weight-bold text-uppercase py-3" style="width: 160px;">
              Acciones
            </th>
          </tr>
        </thead>

        <!-- Estado de carga: Skeletons en tbody -->
        <tbody v-if="loading">
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 70px;">
              <div class="shimmer-line w-40" />
            </td>
            <td class="py-4" style="width: 160px;">
              <div class="shimmer-chip" style="width: 110px; height: 32px;" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-75 mb-2" />
              <div class="shimmer-line w-50" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-75 mb-2" />
              <div class="shimmer-line w-50" />
            </td>
            <td class="py-4" style="width: 130px;">
              <div class="shimmer-chip mx-auto" />
            </td>
            <td class="py-4 text-center" style="width: 160px;">
              <div class="d-flex justify-center gap-2">
                <div class="shimmer-button rounded" />
                <div class="shimmer-button rounded" />
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Estado vacío: Sin resultados -->
        <tbody v-else-if="!vehicles || !vehicles.length">
          <tr>
            <td colspan="6" class="pa-10 text-center bg-surface">
              <VAvatar size="64" color="primary" variant="tonal" class="mb-3">
                <VIcon size="32" icon="ri-car-line" />
              </VAvatar>
              <h3 class="text-h6 font-weight-bold text-high-emphasis mb-1">
                No se encontraron vehículos
              </h3>
              <p class="text-body-2 text-medium-emphasis mb-4 mx-auto" style="max-width: 420px;">
                Intenta ajustar tus criterios de búsqueda o agrega un nuevo vehículo al sistema.
              </p>
              <div class="d-flex justify-center gap-2">
                <VBtn v-if="hasActiveFilters" size="small" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line"
                  @click="resetFilters">
                  Restablecer Filtros
                </VBtn>
                <VBtn v-if="can('register_car')" size="small" color="primary" prepend-icon="ri-add-line" @click="addVehicle">
                  Agregar Vehículo
                </VBtn>
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Datos de Vehículos -->
        <tbody v-else>
          <tr v-for="vehicle in vehicles" :key="vehicle.id" class="vehicle-table-row">
            <td class="font-weight-bold text-disabled">
              #{{ vehicle.id }}
            </td>

            <!-- Placa -->
            <td class="py-3">
              <div v-if="vehicle.license_plate" class="vehicle-plate-badge font-mono">
                <span class="plate-text">{{ vehicle.license_plate.toUpperCase() }}</span>
              </div>
              <VChip v-else color="warning" size="small" variant="tonal" class="font-weight-bold text-uppercase">
                Sin placa
              </VChip>
            </td>

            <!-- Vehículo -->
            <td class="py-3">
              <div class="d-flex align-center gap-3">
                <VAvatar size="40" rounded="lg" :color="getBrandColor(vehicle.brand)" variant="tonal"
                  class="elevation-0">
                  <VIcon icon="ri-roadster-line" size="22" />
                </VAvatar>
                <div>
                  <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                    {{ getBrandNameById(vehicle.brand) || 'Sin marca' }} {{ vehicle.model || '' }}
                  </div>
                  <div class="d-flex align-center gap-1 text-caption text-medium-emphasis mt-0.5 flex-wrap">
                    <span v-if="vehicle.vehicle_type" class="font-weight-medium">
                      {{ getVehicleTypeLabel(vehicle.vehicle_type) }}
                    </span>
                    <span v-if="vehicle.vehicle_type && (vehicle.year || vehicle.color)" class="text-disabled">•</span>
                    <span v-if="vehicle.year">
                      Año {{ vehicle.year }}
                    </span>
                    <span v-if="vehicle.year && vehicle.color" class="text-disabled">•</span>
                    <span v-if="vehicle.color" class="text-uppercase">
                      {{ vehicle.color }}
                    </span>
                  </div>
                </div>
              </div>
            </td>

            <!-- Propietario -->
            <td class="py-3">
              <div class="d-flex align-center gap-2">
                <VAvatar size="32" color="primary" variant="tonal" rounded="circle">
                  <VIcon icon="ri-user-line" size="16" />
                </VAvatar>
                <div class="min-w-0">
                  <div class="font-weight-bold text-high-emphasis text-uppercase text-body-2 text-truncate"
                    style="max-width: 220px;" :title="vehicle.client?.full_name">
                    {{ vehicle.client?.full_name || 'Sin dueño asignado' }}
                  </div>
                  <div v-if="vehicle.client?.phone" class="text-caption text-medium-emphasis">
                    {{ vehicle.client.phone }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Estado (Pill limpia aceituna / pastel con punto) -->
            <td class="text-center py-3" style="white-space: nowrap;">
              <div
                class="status-pill-clean"
                :class="parseInt(vehicle.status) === 1 ? 'status-paid' : 'status-pending'"
              >
                <span class="status-dot" />
                <span>{{ parseInt(vehicle.status) === 1 ? 'Activo' : 'Inactivo' }}</span>
              </div>
            </td>

            <!-- Acciones -->
            <td class="text-center">
              <div class="d-flex justify-center align-center gap-1">
                <VBtn size="small" color="info" variant="tonal" icon="ri-eye-line" title="Ver Ficha"
                  @click="showVehicle(vehicle)" />

                <VBtn v-if="can('edit_car')" size="small" color="warning" variant="tonal" icon="ri-pencil-line"
                  title="Editar Vehículo" @click="editVehicle(vehicle)" />

                <!-- Menú Más Opciones -->
                <VBtn size="small" color="secondary" variant="tonal" icon="ri-more-2-line" title="Más Opciones">
                  <VIcon icon="ri-more-2-line" size="18" />
                  <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                    <VList density="compact" class="py-1 rounded-lg elevation-3 border">
                      <VListItem prepend-icon="ri-history-line" title="Ver Historial" class="text-info text-body-2"
                        @click="showHistory(vehicle)" />
                      <VDivider v-if="can('delete_car')" class="my-1" />
                      <VListItem v-if="can('delete_car')" prepend-icon="ri-delete-bin-6-line"
                        title="Eliminar Vehículo" class="text-error text-body-2" @click="deleteVehicle(vehicle)" />
                    </VList>
                  </VMenu>
                </VBtn>
              </div>
            </td>
          </tr>
        </tbody>
      </VTable>

      <VDivider v-if="totalPages > 1 || totalItems > 0" />

      <!-- Paginación persistente en Card Footer -->
      <VCardActions v-if="totalPages > 1 || totalItems > 0" class="pa-4 bg-grey-lighten-5 justify-space-between align-center flex-column flex-sm-row gap-3">
        <div class="text-body-2 text-medium-emphasis">
          Mostrando <strong class="text-high-emphasis">{{ vehicles.length }}</strong> de <strong
            class="text-high-emphasis">{{ totalItems }}</strong> vehículos
        </div>
        <VPagination
          v-if="totalPages > 1"
          v-model="currentPage"
          :length="totalPages"
          rounded="circle"
          :total-visible="7"
          color="primary"
        />
      </VCardActions>
    </VCard>

    <!-- Diálogos -->
    <VehicleShowDialog v-if="isVehicleShowDialogVisible" v-model:isDialogVisible="isVehicleShowDialogVisible"
      :vehicle-data="vehicleToShow" />

    <VehicleAddDialog v-if="isVehicleAddDialogVisible" v-model:isDialogVisible="isVehicleAddDialogVisible"
      @add-vehicle="handleVehicleAdded" />

    <VehicleEditDialog v-if="isVehicleEditDialogVisible" v-model:isDialogVisible="isVehicleEditDialogVisible"
      :vehicle-data="vehicleToEdit" @vehicle-updated="handleVehicleUpdated" />

    <VehicleDeleteDialog v-if="deleteDialog" v-model:isDialogVisible="deleteDialog" :vehicle-selected="vehicleToDelete"
      @delete-vehicle="handleVehicleDeleted" />

    <SalesHistoryDialog v-model="isHistoryDialogVisible" :vehicle-id="historyVehicleId" />

    <ImportData v-model:is-dialog-visible="isImportDialogVisible" default-tab="vehicles"
      @import-success="loadVehicles" />
  </div>
</template>

<style scoped lang="scss">
.vehicle-plate-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 12px;
  background-color: #f8fafc;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  transition: all 0.2s ease;

  &:hover {
    border-color: #94a3b8;
    background-color: #f1f5f9;
  }
}

.plate-text {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace !important;
  font-size: 1.05rem !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  letter-spacing: 0.07em !important;
  line-height: 1.2 !important;
  text-transform: uppercase;
}

.vehicle-grid-card {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-color: rgba(var(--v-border-color), 0.12) !important;
  background-color: rgb(var(--v-theme-surface)) !important;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(var(--v-theme-primary), 0.08) !important;
    border-color: rgba(var(--v-theme-primary), 0.3) !important;
  }
}

.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.vehicle-table-row {
  transition: background-color 0.15s ease;

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.text-xxs {
  font-size: 0.68rem !important;
}

.letter-spacing-1 {
  letter-spacing: 0.5px;
}

// Status Pills (Estilo listado de compras)
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
</style>
