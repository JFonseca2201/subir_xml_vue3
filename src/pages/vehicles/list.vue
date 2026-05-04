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
const vehicleTypeOptions = ref([
    { title: 'Sedán', value: 'sedan' },
    { title: 'Hatchback', value: 'hatchback' },
    { title: 'Camioneta', value: 'camioneta' },
    { title: 'SUV', value: 'suv' },
    { title: 'Furgoneta', value: 'furgoneta' },
    { title: 'Camión', value: 'camion' },
    { title: 'Bus', value: 'bus' },
    { title: 'Van', value: 'van' },
    { title: 'Motocicleta', value: 'motocicleta' },
    { title: 'Pickup', value: 'pickup' },
    { title: 'Minivan', value: 'minivan' },
    { title: 'Deportivo', value: 'deportivo' },
    { title: 'Otro', value: 'otro' }
])

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
                'Content-Type': 'application/json'
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
            totalItems: totalItems.value
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
const showVehicle = (vehicle) => {
    vehicleToShow.value = vehicle
    isVehicleShowDialogVisible.value = true
}

const addVehicle = () => {
    isVehicleAddDialogVisible.value = true
}

const editVehicle = (vehicle) => {
    vehicleToEdit.value = vehicle
    isVehicleEditDialogVisible.value = true
}

const deleteVehicle = (vehicle) => {
    vehicleToDelete.value = vehicle
    deleteDialog.value = true
}

const handleVehicleAdded = (vehicleData) => {
    console.log("📤 Vehículo agregado (datos del diálogo):", vehicleData)

    // En lugar de agregar los datos localmente (que pueden estar vacíos),
    // recargamos la lista desde la API para obtener los datos correctos
    loadVehicles()

    // Mostrar notificación de éxito
    showNotification('Vehículo agregado correctamente', 'success')
}

const handleVehicleUpdated = (vehicleData) => {
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

const handleVehicleDeleted = (deletedVehicle) => {
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

// Funciones auxiliares para tipos de vehículos
const getVehicleTypeLabel = (vehicleType) => {
    if (!vehicleType) return 'No especificado'
    const option = vehicleTypeOptions.value.find(opt => opt.value === vehicleType)
    return option ? option.title : vehicleType
}

const getVehicleTypeColor = (vehicleType) => {
    const colors = {
        'sedan': 'primary',
        'hatchback': 'info',
        'camioneta': 'success',
        'suv': 'warning',
        'furgoneta': 'secondary',
        'camion': 'error',
        'bus': 'purple',
        'van': 'indigo',
        'motocicleta': 'orange',
        'pickup': 'teal',
        'minivan': 'cyan',
        'deportivo': 'red',
        'otro': 'grey'
    }
    return colors[vehicleType] || 'grey'
}



// Montar componente
onMounted(() => {
    generateYearOptions()
    loadVehicles()
})
</script>

<template>
    <VCard>
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
            <div class="d-flex align-center">
                <VIcon icon="ri-car-line" class="me-2" />
                <span class="text-h5">Gestión de Vehículos</span>
            </div>
            <div class="d-flex gap-2">
                <VBtn color="primary" @click="addVehicle" prepend-icon="ri-add-line">
                    Agregar Vehículo
                </VBtn>
            </div>
        </VCardTitle>

        <VDivider />

        <!-- Formulario de búsqueda -->
        <VCardText class="pa-4">
            <VForm ref="searchFormRef">
                <VRow>
                    <VCol cols="12" md="4">
                        <VTextField v-model="searchForm.search" label="Buscar vehículo"
                            placeholder="Placa, marca, modelo..." prepend-inner-icon="ri-search-line" clearable
                            hide-details />
                    </VCol>
                    <VCol cols="12" md="3">
                        <VSelect v-model="searchForm.vehicle_type" :items="vehicleTypeOptions" item-title="title"
                            item-value="value" label="Tipo de vehículo" placeholder="Todos" clearable hide-details />
                    </VCol>
                    <VCol cols="12" md="3">
                        <VSelect v-model="searchForm.brand" :items="brandOptions" item-title="title" item-value="value"
                            label="Marca" placeholder="Todas" clearable hide-details />
                    </VCol>
                    <VCol cols="12" md="2">
                        <VSelect v-model="searchForm.year" :items="yearOptions" item-title="title" item-value="value"
                            label="Año" placeholder="Todos" clearable hide-details />
                    </VCol>
                </VRow>
            </VForm>
        </VCardText>

        <VDivider />

        <!-- Tabla de vehículos -->
        <VCardText class="pa-0">
            <VTable hover class="vehicle-table">
                <thead class="bg-primary text-white">
                    <tr>
                        <th>#</th>
                        <th>Placa</th>
                        <th>Marca</th>
                        <th>Modelo</th>
                        <th>Año</th>
                        <th>Color</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th class="text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="8" class="text-center pa-4">
                            <VProgressCircular indeterminate color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="!vehicles.length">
                        <td colspan="8" class="text-center text-medium-emphasis py-6">
                            <VIcon size="32" class="mb-2">ri-car-line</VIcon>
                            <div>No hay vehículos registrados</div>
                        </td>
                    </tr>
                    <tr v-else v-for="vehicle in vehicles" :key="vehicle.id" class="hover:bg-grey-lighten-4 transition">
                        <!-- Debug: log del status -->
                        {{ console.log('🚗 Vehículo ID:', vehicle.id, 'Status:', vehicle.status, 'Tipo:', typeof
                            vehicle.status) }}
                        <td class="font-weight-medium">{{ vehicle.id }}</td>
                        <td>
                            <div class="font-weight-bold">
                                {{ vehicle.license_plate || 'Sin placa' }}
                                <VChip v-if="!vehicle.license_plate" color="warning" size="x-small" class="ml-2">
                                    Sin datos
                                </VChip>
                            </div>
                        </td>
                        <td style="text-transform: uppercase;">
                            {{ getBrandNameById(vehicle.brand) || 'Sin marca' }}
                        </td>
                        <td style="text-transform: uppercase;">
                            {{ vehicle.model || 'Sin modelo' }}
                            <VChip v-if="!vehicle.model" color="warning" size="x-small" class="ml-2">
                                Vacío
                            </VChip>
                        </td>
                        <td>{{ vehicle.year || 'N/A' }}</td>
                        <td>
                            {{ vehicle.color?.toUpperCase() || 'No especificado' }}
                        </td>
                        <td style="text-transform: uppercase;">
                            {{ getVehicleTypeLabel(vehicle.vehicle_type) }}
                        </td>
                        <td>
                            <VChip v-if="parseInt(vehicle.status) === 1" color="success" size="small">
                                ACTIVO
                            </VChip>
                            <VChip v-else color="error" size="small">
                                INACTIVO
                            </VChip>
                        </td>
                        <td class="text-center">
                            <div class="d-flex justify-center gap-1">
                                <IconBtn @click="showVehicle(vehicle)">
                                    <VIcon icon="ri-eye-line" />
                                </IconBtn>
                                <IconBtn @click="editVehicle(vehicle)">
                                    <VIcon icon="ri-pencil-line" />
                                </IconBtn>
                                <IconBtn @click="deleteVehicle(vehicle)">
                                    <VIcon icon="ri-delete-bin-6-line" color="error" />
                                </IconBtn>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </VTable>
        </VCardText>

        <VDivider />

        <!-- Paginación -->
        <VCardActions class="justify-center pa-4">
            <div class="d-flex flex-column align-center gap-2">
                <div class="text-caption text-medium-emphasis">
                    Mostrando {{ vehicles.length }} de {{ totalItems }} vehículos
                </div>
                <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7"
                    @update:modelValue="loadVehicles" />
            </div>
        </VCardActions>
    </VCard>

    <!-- Diálogos -->
    <VehicleShowDialog v-if="isVehicleShowDialogVisible" v-model:isDialogVisible="isVehicleShowDialogVisible"
        :vehicleData="vehicleToShow" />

    <VehicleAddDialog v-if="isVehicleAddDialogVisible" v-model:isDialogVisible="isVehicleAddDialogVisible"
        @addVehicle="handleVehicleAdded" />

    <VehicleEditDialog v-if="isVehicleEditDialogVisible" v-model:isDialogVisible="isVehicleEditDialogVisible"
        :vehicleData="vehicleToEdit" @vehicleUpdated="handleVehicleUpdated" />

    <VehicleDeleteDialog v-if="deleteDialog" v-model:isDialogVisible="deleteDialog" :vehicleSelected="vehicleToDelete"
        @deleteVehicle="handleVehicleDeleted" />
</template>

<style scoped>
.vehicle-table {
    border-collapse: collapse;
}

.vehicle-table th {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.5px;
}

.vehicle-table td {
    vertical-align: middle;
}

.hover\:bg-grey-lighten-4:hover {
    background-color: rgba(0, 0, 0, 0.04);
    transition: background-color 0.2s ease;
}
</style>
