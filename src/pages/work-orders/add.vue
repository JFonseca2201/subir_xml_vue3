<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

import ClientFinalAddDialog from '@/components/inventory/clients/ClientFinalAddDialog.vue'
import VehicleAddDialog from '@/components/inventory/vehicles/VehicleAddDialog.vue'

const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()
const userId = ref(null)

const getUserId = () => {
    const userData = JSON.parse(localStorage.getItem('user'))
    userId.value = userData ? userData.id : null
}

const formRef = ref(null)
const isLoading = ref(false)
const showValidationError = ref(false)
const validationErrorMessage = ref('')

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const employees = ref([])

const workOrder = ref({
    client_id: null,
    vehicle_id: null,
    user_id: userId.value,
    mileage: null,
    fuel_level: '',
    observations: '',
    diagnostic: '',
    technicians: [],
    items: [],
})

const fuelLevels = [
    { title: '1/4', value: '1/4' },
    { title: '1/2', value: '1/2' },
    { title: '3/4', value: '3/4' },
    { title: 'Full', value: 'Full' },
    { title: 'Reserva', value: 'Reserva' },
]

const showClientDialog = ref(false)
const showVehicleDialog = ref(false)
const productSearch = ref('')
const filteredProducts = ref([])

const loadInitialData = async () => {
    isLoading.value = true
    try {
        getUserId()
        workOrder.value.user_id = userId.value

        const [clientsRes, vehiclesRes, productsRes, employeesRes] = await Promise.all([
            $api('clients', { params: { per_page: 100 } }),
            $api('vehicles', { params: { per_page: 100 } }),
            $api('products', { params: { per_page: 1000 } }),
            $api('employees', { params: { per_page: 100 } })
        ])

        console.log('Clients response:', clientsRes)
        console.log('Vehicles response:', vehiclesRes)
        console.log('Products response:', productsRes)
        console.log('Employees response:', employeesRes)

        clients.value = Array.isArray(clientsRes.clients) ? clientsRes.clients :
            Array.isArray(clientsRes.data) ? clientsRes.data : []
        vehicles.value = Array.isArray(vehiclesRes.vehicles) ? vehiclesRes.vehicles :
            Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []

        const productsArray = Array.isArray(productsRes.products?.data) ? productsRes.products.data :
            Array.isArray(productsRes.data) ? productsRes.data :
                Array.isArray(productsRes.products) ? productsRes.products : []
        products.value = productsArray
        filteredProducts.value = productsArray

        employees.value = Array.isArray(employeesRes.employees) ? employeesRes.employees :
            Array.isArray(employeesRes.data) ? employeesRes.data : []

        console.log('Clients loaded:', clients.value.length)
        console.log('Vehicles loaded:', vehicles.value.length)
        console.log('Products loaded:', products.value.length)
        console.log('Employees loaded:', employees.value.length)
    } catch (error) {
        console.error('Error al cargar datos:', error)
        showNotification('Error al cargar datos iniciales', 'error')
    } finally {
        isLoading.value = false
    }
}

const validateForm = () => {
    if (!workOrder.value.client_id) {
        validationErrorMessage.value = 'Debe seleccionar un cliente'
        showValidationError.value = true
        return false
    }
    return true
}

const saveWorkOrder = async () => {
    if (!validateForm()) return

    isLoading.value = true
    try {
        const response = await $api('work-orders', {
            method: 'POST',
            body: workOrder.value
        })

        showNotification('Orden de trabajo creada exitosamente', 'success')
        router.push('/work-orders')
    } catch (error) {
        console.error('Error al crear orden de trabajo:', error)
        showNotification('Error al crear la orden de trabajo', 'error')
    } finally {
        isLoading.value = false
    }
}

const cancel = () => {
    router.push('/work-orders')
}

const onClientAdded = (newClient) => {
    clients.value.push(newClient)
    workOrder.value.client_id = newClient.id
    showClientDialog.value = false
}

const onVehicleAdded = (newVehicle) => {
    vehicles.value.push(newVehicle)
    workOrder.value.vehicle_id = newVehicle.id
    showVehicleDialog.value = false
}

// Funciones para items
const addItem = (type = 'product') => {
    // Validar que el último item esté completo antes de agregar uno nuevo
    if (workOrder.value.items.length > 0) {
        const lastItem = workOrder.value.items[workOrder.value.items.length - 1]
        if (!lastItem.description || !lastItem.quantity || !lastItem.unit_price) {
            showNotification('Completa el item actual antes de agregar uno nuevo', 'warning')
            return
        }
    }
    
    workOrder.value.items.push({
        product_id: null,
        description: '',
        quantity: 1,
        unit_price: 0,
        discount: 0,
        type: type,
    })
}

const removeItem = (index) => {
    workOrder.value.items.splice(index, 1)
}

const calculateItemSubtotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0
    const unitPrice = parseFloat(item.unit_price) || 0
    const discount = parseFloat(item.discount) || 0
    return (quantity * unitPrice) - discount
}

const calculateTotal = () => {
    return workOrder.value.items.reduce((total, item) => {
        return total + calculateItemSubtotal(item)
    }, 0)
}

const getProductPrice = (productId) => {
    const product = products.value.find(p => p.id === productId)
    return product ? parseFloat(product.price) : 0
}

const onProductChanged = (item) => {
    if (item.product_id) {
        const product = products.value.find(p => p.id === item.product_id)
        if (product) {
            item.description = product.name || product.description || ''
            item.unit_price = parseFloat(product.price) || 0
        }
    }
}

// Filtrar productos basado en búsqueda
const filterProducts = () => {
    if (!productSearch.value) {
        filteredProducts.value = Array.isArray(products.value) ? products.value : []
        return
    }
    const query = productSearch.value.toLowerCase()
    const productsArray = Array.isArray(products.value) ? products.value : []
    filteredProducts.value = productsArray.filter(p =>
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.code && p.code.toLowerCase().includes(query))
    )
}

// Watch para filtrar productos cuando cambia la búsqueda
watch(productSearch, () => {
    filterProducts()
})

// Agregar producto desde búsqueda
const addProductFromSearch = (product) => {
    // Determinar si es servicio basado en item_type o categoría
    const isService = product.item_type === 2 ||
        (product.categorie && product.categorie.title && product.categorie.title.includes('SERVICIO'))

    workOrder.value.items.push({
        product_id: product.id,
        description: product.description || product.name || '',
        quantity: 1,
        unit_price: parseFloat(product.price_sale) || parseFloat(product.price) || 0,
        discount: 0,
        type: isService ? 'service' : 'product',
    })
    productSearch.value = ''
}

onMounted(() => {
    loadInitialData()
    filteredProducts.value = products.value
})
</script>

<template>
    <VContainer class="pa-6">
        <VRow>
            <VCol cols="12">
                <!-- Header -->
                <div class="d-flex align-center mb-6">
                    <VBtn icon="ri-arrow-left-line" variant="text" @click="cancel" class="mr-3" size="large" />
                    <div>
                        <h1 class="text-h4 font-weight-bold mb-1">Nueva Orden de Trabajo</h1>
                        <p class="text-body-2 text-grey">Completa la información para crear una orden de trabajo</p>
                    </div>
                </div>



                <!-- Información del Cliente y Vehículo -->
                <VCard class="elevation-2 mb-4">
                    <VCardText class="pa-6">
                        <div class="d-flex align-center mb-6">
                            <VAvatar size="48" color="primary" variant="tonal" class="mr-3">
                                <VIcon icon="ri-user-car-line" size="28" />
                            </VAvatar>
                            <div>
                                <h3 class="text-h5 font-weight-bold mb-0">Información del Cliente y Vehículo</h3>
                                <p class="text-caption text-grey mb-0">Selecciona el cliente y el vehículo para la orden</p>
                            </div>
                        </div>

                        <VRow>
                            <VCol cols="12" md="6">
                                <div class="mb-4">
                                    <VAutocomplete v-model="workOrder.client_id" :items="clients" item-title="full_name"
                                        item-value="id" label="Cliente *" prepend-inner-icon="ri-user-line" variant="outlined"
                                        clearable :loading="isLoading" :rules="[(v) => !!v || 'Cliente es requerido']">
                                        <template v-slot:append-outer>
                                            <VBtn icon="ri-add-line" size="small" variant="text"
                                                color="primary" @click="showClientDialog = true" />
                                        </template>
                                    </VAutocomplete>
                                </div>
                            </VCol>

                            <VCol cols="12" md="6">
                                <div class="mb-4">
                                    <VAutocomplete v-model="workOrder.vehicle_id" :items="vehicles"
                                        :item-title="(item) => `${item.brand} ${item.model} - ${item.license_plate}`"
                                        item-value="id" label="Vehículo" prepend-inner-icon="ri-car-line" variant="outlined"
                                        clearable :loading="isLoading">
                                        <template v-slot:append-outer>
                                            <VBtn icon="ri-add-line" size="small" variant="text"
                                                color="primary" @click="showVehicleDialog = true" />
                                        </template>
                                    </VAutocomplete>
                                </div>
                            </VCol>

                            <VCol cols="12" md="4">
                                <div class="mb-4">
                                    <VTextField v-model.number="workOrder.mileage" type="number" label="Kilometraje"
                                        prepend-inner-icon="ri-speed-line" variant="outlined" />
                                </div>
                            </VCol>

                            <VCol cols="12" md="4">
                                <div class="mb-4">
                                    <VSelect v-model="workOrder.fuel_level" :items="fuelLevels" label="Nivel de Combustible"
                                        prepend-inner-icon="ri-gas-station-line" variant="outlined" clearable />
                                </div>
                            </VCol>

                            <VCol cols="12" md="4">
                                <div class="mb-4">
                                    <VAutocomplete v-model="workOrder.technicians" :items="employees"
                                        :item-title="(item) => `${item.first_name} ${item.last_name} - ${item.position || ''}`"
                                        item-value="id" label="Técnicos (máximo 2)"
                                        prepend-inner-icon="ri-user-settings-line" variant="outlined" clearable
                                        :loading="isLoading" multiple chips
                                        :rules="[(v) => !v || v.length <= 2 || 'Máximo 2 técnicos']">
                                        <template v-slot:chip="{ props, item }">
                                            <VChip v-bind="props" :text="`${item.raw.first_name} ${item.raw.last_name}`" />
                                        </template>
                                    </VAutocomplete>
                                </div>
                            </VCol>
                        </VRow>
                    </VCardText>
                </VCard>

                <!-- Observaciones y Diagnóstico -->
                <VCard class="elevation-2 mb-4">
                    <VCardText class="pa-6">
                        <div class="d-flex align-center mb-4">
                            <VAvatar size="40" color="info" variant="tonal" class="mr-3">
                                <VIcon icon="ri-file-text-line" size="24" />
                            </VAvatar>
                            <div>
                                <h3 class="text-h6 font-weight-bold mb-0">Observaciones y Diagnóstico</h3>
                                <p class="text-caption text-grey mb-0">Detalles adicionales sobre el trabajo a realizar
                                </p>
                            </div>
                        </div>

                        <VRow>
                            <VCol cols="12" md="6">
                                <VTextarea v-model="workOrder.observations" label="Observaciones"
                                    prepend-inner-icon="ri-file-text-line" variant="outlined" rows="4"
                                    placeholder="Describe cualquier observación relevante..." />
                            </VCol>

                            <VCol cols="12" md="6">
                                <VTextarea v-model="workOrder.diagnostic" label="Diagnóstico"
                                    prepend-inner-icon="ri-stethoscope-line" variant="outlined" rows="4"
                                    placeholder="Describe el diagnóstico técnico..." />
                            </VCol>
                        </VRow>
                    </VCardText>
                </VCard>

                <!-- Productos y Servicios -->
                <VCard class="elevation-2 mb-4">
                    <VCardText class="pa-6">
                        <div class="d-flex align-center justify-space-between mb-4">
                            <div class="d-flex align-center">
                                <VAvatar size="40" color="success" variant="tonal" class="mr-3">
                                    <VIcon icon="ri-shopping-bag-3-line" size="24" />
                                </VAvatar>
                                <div>
                                    <h3 class="text-h6 font-weight-bold mb-0">Productos y Servicios</h3>
                                    <p class="text-caption text-grey mb-0">Agrega los items a la orden de trabajo</p>
                                </div>
                            </div>
                            <VBtn size="small" color="info" variant="outlined" prepend-icon="ri-tools-line"
                                @click="addItem('service')">
                                Agregar Servicio Manual
                            </VBtn>
                        </div>

                        <!-- Cuadro de búsqueda de productos -->
                        <VCard class="mb-4 elevation-1" color="grey-lighten-5">
                            <VCardText class="pa-4">
                                <VAutocomplete v-model="productSearch" :items="filteredProducts"
                                    item-title="description" item-value="id" label="Buscar producto..."
                                    prepend-inner-icon="ri-search-line" variant="outlined" clearable hide-details
                                    return-object @update:model-value="(val) => val && addProductFromSearch(val)">
                                    <template v-slot:item="{ props, item }">
                                        <VListItem v-bind="props">
                                            <template v-slot:prepend>
                                                <VAvatar size="32" color="primary" variant="tonal">
                                                    <VIcon icon="ri-box-3-line" />
                                                </VAvatar>
                                            </template>
                                            <VListItemSubtitle>{{ item.raw.sku || '' }}</VListItemSubtitle>
                                            <template v-slot:append>
                                                <VChip size="small" color="success">${{
                                                    parseFloat(item.raw.price).toFixed(2) }}</VChip>
                                            </template>
                                        </VListItem>
                                    </template>
                                </VAutocomplete>
                            </VCardText>
                        </VCard>

                        <!-- Tabla de items -->
                        <VCard v-if="workOrder.items.length > 0" class="elevation-1">
                            <VTable>
                                <thead>
                                    <tr class="bg-grey-lighten-4">
                                        <th class="text-left">Tipo</th>
                                        <th class="text-left">Descripción</th>
                                        <th class="text-center">Cantidad</th>
                                        <th class="text-center">Precio Unit.</th>
                                        <th class="text-center">Descuento</th>
                                        <th class="text-center">Subtotal</th>
                                        <th class="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(item, index) in workOrder.items" :key="index" class="hover-row">
                                        <td>
                                            <VChip :color="item.type === 'product' ? 'primary' : 'info'" size="small"
                                                label>
                                                <VIcon
                                                    :icon="item.type === 'product' ? 'ri-box-3-line' : 'ri-tools-line'"
                                                    start size="16" />
                                                {{ item.type === 'product' ? 'Producto' : 'Servicio' }}
                                            </VChip>
                                        </td>
                                        <td>
                                            <VTextField v-model="item.description" density="compact" variant="outlined"
                                                hide-details placeholder="Descripción" class="mt-2" />
                                        </td>
                                        <td>
                                            <VTextField v-model.number="item.quantity" type="number" density="compact"
                                                variant="outlined" hide-details min="1" style="width: 80px"
                                                class="mt-2" />
                                        </td>
                                        <td>
                                            <VTextField v-model.number="item.unit_price" type="number" density="compact"
                                                variant="outlined" hide-details min="0" step="0.01" style="width: 100px"
                                                class="mt-2" />
                                        </td>
                                        <td>
                                            <VTextField v-model.number="item.discount" type="number" density="compact"
                                                variant="outlined" hide-details min="0" step="0.01" style="width: 80px"
                                                class="mt-2" />
                                        </td>
                                        <td class="text-center">
                                            <span class="text-h6 font-weight-bold text-success">${{
                                                calculateItemSubtotal(item).toFixed(2) }}</span>
                                        </td>
                                        <td class="text-center">
                                            <VBtn icon="ri-delete-bin-line" size="small" color="error" variant="text"
                                                @click="removeItem(index)" />
                                        </td>
                                    </tr>
                                </tbody>
                            </VTable>
                        </VCard>

                        <div v-else class="text-center pa-8">
                            <VIcon icon="ri-shopping-bag-3-line" size="64" color="grey-lighten-1" />
                            <p class="mt-4 text-body-2 text-grey">No hay productos o servicios agregados</p>
                            <p class="text-caption text-grey">Usa el buscador para agregar items</p>
                        </div>

                        <!-- Total -->
                        <div class="d-flex justify-end mt-4">
                            <VCard class="pa-4 elevation-2" width="320" color="primary-lighten-5">
                                <div class="d-flex align-center mb-2">
                                    <VIcon icon="ri-money-dollar-circle-line" size="24" color="primary" class="mr-2" />
                                    <span class="text-body-1 font-weight-medium">Total de la Orden</span>
                                </div>
                                <div class="d-flex justify-space-between align-center">
                                    <span class="text-h4 font-weight-bold text-primary">${{ calculateTotal().toFixed(2)
                                        }}</span>
                                    <VChip size="small" color="primary" label>{{ workOrder.items.length }} items</VChip>
                                </div>
                            </VCard>
                        </div>
                    </VCardText>
                </VCard>
                <VAlert v-if="showValidationError" color="error" variant="tonal" class="mb-4" border="start" closable
                    @click:close="showValidationError = false">
                    <div class="d-flex align-center">
                        <VIcon icon="ri-error-warning-line" class="mr-2" />
                        <span class="text-body-2">{{ validationErrorMessage }}</span>
                    </div>
                </VAlert>
                <!-- Botones de acción -->
                <VCard class="elevation-2">
                    <VCardText class="pa-6">
                        <div class="d-flex justify-end gap-3">
                            <VBtn color="grey" variant="outlined" prepend-icon="ri-close-line" :disabled="isLoading"
                                @click="cancel">
                                Cancelar
                            </VBtn>
                            <VBtn type="submit" color="primary" variant="elevated" prepend-icon="ri-save-3-line"
                                :loading="isLoading" size="large" @click="saveWorkOrder">
                                Guardar Orden de Trabajo
                            </VBtn>
                        </div>
                    </VCardText>
                </VCard>
            </VCol>
        </VRow>

        <!-- Dialog para agregar cliente -->
        <ClientFinalAddDialog :is-dialog-visible="showClientDialog"
            @update:is-dialog-visible="showClientDialog = $event" @add-client-final="onClientAdded" />

        <!-- Dialog para agregar vehículo -->
        <VehicleAddDialog :is-dialog-visible="showVehicleDialog" @update:is-dialog-visible="showVehicleDialog = $event"
            @add-vehicle="onVehicleAdded" />
    </VContainer>
</template>

<style scoped>
.hover-row:hover {
    background-color: rgba(0, 0, 0, 0.02);
}
</style>
