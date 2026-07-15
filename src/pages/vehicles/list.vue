<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import VehicleShowDialog from '@/components/inventory/vehicles/VehicleShowDialog.vue'
import VehicleAddDialog from '@/components/inventory/vehicles/VehicleAddDialog.vue'
import VehicleEditDialog from '@/components/inventory/vehicles/VehicleEditDialog.vue'
import VehicleDeleteDialog from '@/components/inventory/vehicles/VehicleDeleteDialog.vue'
import { getBrandNameById, getBrandOptions } from '@/data/vehicleBrands.js'
import { getVehicleTypeOptions, getVehicleTypeNameById, getVehicleTypeColor } from '@/data/vehicleTypes.js'
import ImportData from '@/components/inventory/import/ImportData.vue'
import SalesHistoryDialog from '@/components/dialogs/SalesHistoryDialog.vue'

// Router y notificaciones
const router = useRouter()
const { showNotification } = useGlobalToast()

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
const itemsPerPage = ref(10)
const totalItems = ref(0)
const totalPages = ref(0)

// Opciones para selects
const vehicleTypeOptions = ref(getVehicleTypeOptions())

const brandOptions = ref(getBrandOptions())

// Generar opciones de años (últimos 20 años)
const yearOptions = ref([])

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear()
  for (let i = currentYear; i >= currentYear - 20; i--) {
    yearOptions.value.push({ title: i.toString(), value: i })
  }
}

// Cargar vehículos
const loadVehicles = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage.value,
    }

    // Agregar filtros solo si tienen valores
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

    console.log('🔍 Cargando vehículos con parámetros:', params)

    const resp = await $api("vehicles", {
      method: "GET",
      params: params,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      onResponseError({ response }) {
        console.error('❌ Error de respuesta del servidor:', response)
        console.error('❌ Datos del error:', response._data)
        console.error('❌ Status:', response.status)
        console.error('❌ StatusText:', response.statusText)
      },
      onRequestError({ error }) {
        console.error('❌ Error de solicitud:', error)
      },
    })

    console.log('✅ Respuesta completa de la API:', resp)
    console.log('✅ Estatus de la respuesta:', resp.status)
    console.log('✅ Datos recibidos (resp.data):', resp.data)
    console.log('✅ Datos recibidos (directo):', resp)
    console.log('✅ ¿Es array (resp.data)?', Array.isArray(resp.data))
    console.log('✅ ¿Es array (directo)?', Array.isArray(resp))

    // Manejar diferentes estructuras de respuesta
    let vehiclesData = []

    // Los datos están en resp.vehicles según la respuesta del servidor
    if (resp && typeof resp === 'object') {
      // Priorizar la propiedad 'vehicles' que es donde están los datos
      if (resp.vehicles && Array.isArray(resp.vehicles)) {
        vehiclesData = resp.vehicles
        console.log('✅ Vehículos cargados (resp.vehicles):', vehiclesData.length)
      } else if (Array.isArray(resp.data)) {
        vehiclesData = resp.data
        console.log('✅ Vehículos cargados (resp.data):', vehiclesData.length)
      } else if (resp.data && Array.isArray(resp.data.data)) {
        vehiclesData = resp.data.data
        console.log('✅ Vehículos cargados (resp.data.data):', vehiclesData.length)
      } else if (Array.isArray(resp)) {
        vehiclesData = resp
        console.log('✅ Vehículos cargados (resp directo):', vehiclesData.length)
      } else {
        // Si no hay array, buscar una propiedad que contenga los vehículos
        const possibleDataProps = ['vehicles', 'data', 'items', 'results', 'list']
        for (const prop of possibleDataProps) {
          if (resp[prop] && Array.isArray(resp[prop])) {
            vehiclesData = resp[prop]
            console.log(`✅ Vehículos cargados (resp.${prop}):`, vehiclesData.length)
            break
          }
        }

        if (vehiclesData.length === 0) {
          console.warn('⚠️ Estructura de respuesta no reconocida:', resp)
          console.warn('⚠️ Propiedades disponibles:', Object.keys(resp))
        }
      }
    } else {
      console.warn('⚠️ Respuesta no es un objeto válido:', resp)
    }

    vehicles.value = vehiclesData
    totalPages.value = resp.last_page || resp.total_pages || resp.total_pages || 1
    totalItems.value = resp.total || resp.total_items || resp.count || vehiclesData.length

    console.log('📊 Totales:', {
      vehicles: vehicles.value.length,
      totalPages: totalPages.value,
      totalItems: totalItems.value,
    })

  } catch (error) {
    console.error('❌ Error general al cargar vehículos:', error)
    console.error('❌ Stack trace:', error.stack)
    vehicles.value = []
    totalPages.value = 0
    totalItems.value = 0
  } finally {
    loading.value = false
  }
}

// Watch para resetear página cuando cambia el filtro
watch(searchForm, () => {
  currentPage.value = 1
  loadVehicles()
}, { deep: true })

// Watch para paginación
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
  console.log("📤 Vehículo agregado (datos del diálogo):", vehicleData)

  // En lugar de agregar los datos localmente (que pueden estar vacíos),
  // recargamos la lista desde la API para obtener los datos correctos
  loadVehicles()

  // Mostrar notificación de éxito
  showNotification('Vehículo agregado correctamente', 'success')
}

const handleVehicleUpdated = vehicleData => {
  console.log("Vehículo actualizado:", vehicleData)
  if (!vehicleData || !vehicleData.id) {
    console.error("Datos del vehículo inválidos:", vehicleData)

    return
  }

  const index = vehicles.value.findIndex(vehicle => vehicle.id === vehicleData.id)
  if (index !== -1) {
    vehicles.value.splice(index, 1, vehicleData)
    console.log("Vehículo actualizado en posición:", index)
  } else {
    console.warn("Vehículo no encontrado en el listado, recargando...")
    loadVehicles()
  }
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

// Truncar texto
const truncate = (text, length = 30) => {
  if (!text) return ''

  return text.length > length ? text.slice(0, length) + '...' : text
}

// Funciones auxiliares para tipos de vehículos (ahora centralizadas)
const getVehicleTypeLabel = getVehicleTypeNameById

// Montar componente
onMounted(() => {
  generateYearOptions()
  loadVehicles()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 vehicle-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-car-line" color="primary" class="me-2" size="28" />
          Gestión de Vehículos
        </h1>
        <p class="text-medium-emphasis mb-0">Registra, administra e importa la información de los vehículos del taller
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="secondary" variant="tonal" prepend-icon="ri-upload-cloud-2-line"
          @click="isImportDialogVisible = true">
          Importar
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" @click="addVehicle">
          Agregar Vehículo
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VForm ref="searchFormRef">
          <VRow class="gap-y-3">
            <VCol cols="12" md="4">
              <VTextField v-model="searchForm.search" label="Buscar vehículo" placeholder="Placa, marca, modelo..."
                prepend-inner-icon="ri-search-line" clearable hide-details variant="outlined" density="comfortable"
                color="primary" />
            </VCol>
            <VCol cols="12" sm="4" md="3">
              <VSelect v-model="searchForm.vehicle_type" :items="vehicleTypeOptions" item-title="title"
                item-value="value" label="Tipo de Vehículo" placeholder="Todos" clearable hide-details
                variant="outlined" density="comfortable" color="primary" />
            </VCol>
            <VCol cols="12" sm="4" md="3">
              <VSelect v-model="searchForm.brand" :items="brandOptions" item-title="title" item-value="value"
                label="Marca" placeholder="Todas" clearable hide-details variant="outlined" density="comfortable"
                color="primary" />
            </VCol>
            <VCol cols="12" sm="4" md="2">
              <VSelect v-model="searchForm.year" :items="yearOptions" item-title="title" item-value="value" label="Año"
                placeholder="Todos" clearable hide-details variant="outlined" density="comfortable" color="primary" />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <!-- Tabla de vehículos -->
      <div class="position-relative">
        <VProgressLinear v-if="loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <VTable hover class="vehicle-table text-no-wrap overflow-x-auto">
          <thead>
            <tr>
              <th class="text-left font-weight-bold text-uppercase" style="width: 80px;">ID</th>
              <th class="text-left font-weight-bold text-uppercase" style="width: 140px;">Placa</th>
              <th class="text-left font-weight-bold text-uppercase" style="min-width: 180px;">Propietario</th>
              <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">Vehículo</th>
              <th class="text-left font-weight-bold text-uppercase" style="width: 100px;">Año</th>
              <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">Color</th>
              <th class="text-left font-weight-bold text-uppercase" style="width: 130px;">Estado</th>
              <th class="text-center font-weight-bold text-uppercase" style="width: 160px;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loading && !vehicles.length">
              <td colspan="8" class="text-center text-medium-emphasis py-12">
                <VAvatar size="64" color="grey-lighten-4" class="mb-3">
                  <VIcon size="32" color="grey" icon="ri-car-line" />
                </VAvatar>
                <div class="text-h6 font-weight-semibold text-grey-darken-1">No se encontraron vehículos</div>
                <div class="text-body-2 text-grey">Intenta ajustar tus criterios de búsqueda o agrega uno nuevo.</div>
              </td>
            </tr>

            <tr v-for="vehicle in vehicles" :key="vehicle.id" class="vehicle-row transition"
              :class="{ 'opacity-50 pointer-events-none': loading }">
              <td class="font-weight-medium text-grey-darken-1">
                #{{ vehicle.id }}
              </td>
              <td>
                <div v-if="vehicle.license_plate" class="license-plate-badge">
                  {{ vehicle.license_plate.toUpperCase() }}
                </div>
                <VChip v-else color="warning" size="x-small" variant="tonal" class="font-weight-bold text-uppercase">
                  Sin placa
                </VChip>
              </td>
              <td>
                <div class="font-weight-semibold text-grey-darken-4 text-uppercase text-truncate"
                  style="max-width: 180px;" :title="vehicle.client?.full_name">
                  {{ vehicle.client?.full_name || 'Sin dueño' }}
                </div>
              </td>
              <td>
                <div class="font-weight-bold text-grey-darken-3 text-uppercase">
                  {{ getBrandNameById(vehicle.brand) || 'Sin marca' }} {{ vehicle.model || '' }}
                  <VChip v-if="!vehicle.model" color="warning" size="x-small" variant="tonal" class="ms-1">
                    Vacío
                  </VChip>
                </div>
                <div class="text-caption text-grey text-uppercase font-weight-medium mt-0.5">
                  {{ getVehicleTypeLabel(vehicle.vehicle_type) }}
                </div>
              </td>
              <td class="text-grey-darken-1">
                {{ vehicle.year || 'N/A' }}
              </td>
              <td>
                <VChip v-if="vehicle.color" size="x-small" variant="outlined" color="secondary"
                  class="text-uppercase font-weight-semibold">
                  {{ vehicle.color }}
                </VChip>
                <span v-else class="text-caption text-grey-lighten-1">No especificado</span>
              </td>
              <td>
                <VChip v-if="parseInt(vehicle.status) === 1" color="success" size="small" variant="tonal"
                  class="font-weight-semibold">
                  ACTIVO
                </VChip>
                <VChip v-else color="error" size="small" variant="tonal" class="font-weight-semibold">
                  INACTIVO
                </VChip>
              </td>
              <td class="text-center">
                <div class="d-flex justify-center gap-1">
                  <IconBtn class="action-btn text-info" @click="showHistory(vehicle)" title="Ver Historial">
                    <VIcon icon="ri-history-line" />
                  </IconBtn>
                  <IconBtn class="action-btn text-info" @click="showVehicle(vehicle)" title="Ver Ficha">
                    <VIcon icon="ri-eye-line" />
                  </IconBtn>
                  <IconBtn class="action-btn text-warning" @click="editVehicle(vehicle)" title="Editar Vehículo">
                    <VIcon icon="ri-pencil-line" />
                  </IconBtn>
                  <IconBtn class="action-btn text-error" @click="deleteVehicle(vehicle)" title="Eliminar Vehículo">
                    <VIcon icon="ri-delete-bin-6-line" />
                  </IconBtn>
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ vehicles.length }}</span> de <span class="font-weight-bold">{{
              totalItems }}</span> vehículos
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="loadVehicles" />
        </div>
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
