<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const router = useRouter()
const { showNotification } = useGlobalToast()

const isLoading = ref(false)
const workOrders = ref([])
const searchQuery = ref('')
const statusFilter = ref('all')
const selectedWorkOrder = ref(null)
const showDetailsDialog = ref(false)

const statusOptions = [
    { title: 'Todos', value: 'all' },
    { title: 'Recibido', value: 'received' },
    { title: 'En Progreso', value: 'in_progress' },
    { title: 'Listo', value: 'ready' },
    { title: 'Entregado', value: 'delivered' },
]

const statusColors = {
    received: 'info',
    in_progress: 'warning',
    ready: 'success',
    delivered: 'grey',
}

const statusIcons = {
    received: 'ri-inbox-line',
    in_progress: 'ri-loader-4-line',
    ready: 'ri-check-double-line',
    delivered: 'ri-truck-line',
}

const statusLabels = {
    received: 'Recibido',
    in_progress: 'En Progreso',
    ready: 'Listo',
    delivered: 'Entregado',
}

const filteredWorkOrders = computed(() => {
    let filtered = workOrders.value

    if (statusFilter.value !== 'all') {
        filtered = filtered.filter(wo => wo.status === statusFilter.value)
    }

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(wo =>
            wo.number?.toLowerCase().includes(query) ||
            wo.client?.full_name?.toLowerCase().includes(query) ||
            wo.vehicle?.license_plate?.toLowerCase().includes(query)
        )
    }

    return filtered
})

const stats = computed(() => {
    const total = workOrders.value.length
    const received = workOrders.value.filter(wo => wo.status === 'received').length
    const inProgress = workOrders.value.filter(wo => wo.status === 'in_progress').length
    const ready = workOrders.value.filter(wo => wo.status === 'ready').length
    const delivered = workOrders.value.filter(wo => wo.status === 'delivered').length

    return { total, received, inProgress, ready, delivered }
})

const loadWorkOrders = async () => {
    isLoading.value = true
    try {
        const response = await $api('work-orders')
        workOrders.value = response.data || []
    } catch (error) {
        console.error('Error al cargar órdenes de trabajo:', error)
        showNotification('Error al cargar las órdenes de trabajo', 'error')
    } finally {
        isLoading.value = false
    }
}

const updateStatus = async (workOrderId, newStatus) => {
    try {
        await $api(`work-orders/${workOrderId}/status`, {
            method: 'PUT',
            body: { status: newStatus }
        })

        showNotification('Estado actualizado exitosamente', 'success')
        loadWorkOrders()
    } catch (error) {
        console.error('Error al actualizar estado:', error)
        showNotification('Error al actualizar el estado', 'error')
    }
}

const goToCreate = () => {
    router.push('/work-orders/add')
}

const viewDetails = (workOrder) => {
    selectedWorkOrder.value = workOrder
    showDetailsDialog.value = true
}

const goToSale = (workOrderId) => {
    router.push({ path: '/sales/add', query: { work_order_id: workOrderId } })
}

const getClientName = (client) => {
    if (!client) return 'N/A'
    return client.full_name || `${client.name || ''} ${client.surname || ''}`.trim() || 'N/A'
}

const getVehicleInfo = (vehicle) => {
    if (!vehicle) return 'N/A'
    return `${vehicle.brand || ''} ${vehicle.model || ''} - ${vehicle.license_plate || ''}`.trim() || 'N/A'
}

const getTotalAmount = (workOrder) => {
    if (!workOrder.items || !Array.isArray(workOrder.items)) return 0
    return workOrder.items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0)
}

onMounted(() => {
    loadWorkOrders()
})
</script>

<template>
    <VContainer class="pa-6">
        <VRow>
            <VCol cols="12">
                <div class="d-flex align-center justify-space-between mb-6">
                    <div>
                        <h1 class="text-h4 font-weight-bold mb-1">Órdenes de Trabajo</h1>
                        <p class="text-body-2 text-grey">Gestiona y da seguimiento a las órdenes de trabajo</p>
                    </div>
                    <VBtn color="primary" prepend-icon="ri-add-line" @click="goToCreate" size="large">
                        Nueva Orden
                    </VBtn>
                </div>

                <!-- Stats Cards -->
                <VRow class="mb-4">
                    <VCol cols="12" sm="6" md="3">
                        <VCard class="elevation-2 h-100">
                            <VCardText class="pa-4">
                                <div class="d-flex align-center justify-space-between">
                                    <div>
                                        <p class="text-body-2 text-grey mb-1">Total</p>
                                        <p class="text-h4 font-weight-bold">{{ stats.total }}</p>
                                    </div>
                                    <VAvatar size="48" color="primary" variant="tonal">
                                        <VIcon icon="ri-file-list-3-line" size="28" />
                                    </VAvatar>
                                </div>
                            </VCardText>
                        </VCard>
                    </VCol>
                    <VCol cols="12" sm="6" md="3">
                        <VCard class="elevation-2 h-100">
                            <VCardText class="pa-4">
                                <div class="d-flex align-center justify-space-between">
                                    <div>
                                        <p class="text-body-2 text-grey mb-1">Recibidos</p>
                                        <p class="text-h4 font-weight-bold">{{ stats.received }}</p>
                                    </div>
                                    <VAvatar size="48" color="info" variant="tonal">
                                        <VIcon icon="ri-inbox-line" size="28" />
                                    </VAvatar>
                                </div>
                            </VCardText>
                        </VCard>
                    </VCol>
                    <VCol cols="12" sm="6" md="3">
                        <VCard class="elevation-2 h-100">
                            <VCardText class="pa-4">
                                <div class="d-flex align-center justify-space-between">
                                    <div>
                                        <p class="text-body-2 text-grey mb-1">En Progreso</p>
                                        <p class="text-h4 font-weight-bold">{{ stats.inProgress }}</p>
                                    </div>
                                    <VAvatar size="48" color="warning" variant="tonal">
                                        <VIcon icon="ri-loader-4-line" size="28" />
                                    </VAvatar>
                                </div>
                            </VCardText>
                        </VCard>
                    </VCol>
                    <VCol cols="12" sm="6" md="3">
                        <VCard class="elevation-2 h-100">
                            <VCardText class="pa-4">
                                <div class="d-flex align-center justify-space-between">
                                    <div>
                                        <p class="text-body-2 text-grey mb-1">Listos</p>
                                        <p class="text-h4 font-weight-bold">{{ stats.ready }}</p>
                                    </div>
                                    <VAvatar size="48" color="success" variant="tonal">
                                        <VIcon icon="ri-check-double-line" size="28" />
                                    </VAvatar>
                                </div>
                            </VCardText>
                        </VCard>
                    </VCol>
                </VRow>

                <!-- Filters -->
                <VCard class="elevation-2 mb-4">
                    <VCardText class="pa-4">
                        <VRow>
                            <VCol cols="12" md="4">
                                <VTextField v-model="searchQuery" label="Buscar orden..." prepend-inner-icon="ri-search-line"
                                    variant="outlined" clearable hide-details placeholder="Número, cliente o vehículo" />
                            </VCol>
                            <VCol cols="12" md="4">
                                <VSelect v-model="statusFilter" :items="statusOptions" label="Filtrar por estado" variant="outlined"
                                    hide-details prepend-inner-icon="ri-filter-3-line" />
                            </VCol>
                        </VRow>
                    </VCardText>
                </VCard>

                <!-- Work Orders Grid -->
                <div v-if="!isLoading && filteredWorkOrders.length > 0" class="grid-container">
                    <VRow>
                        <VCol v-for="workOrder in filteredWorkOrders" :key="workOrder.id" cols="12" md="6" lg="4">
                            <VCard class="elevation-2 work-order-card h-100" hover>
                                <VCardText class="pa-4">
                                    <div class="d-flex align-start justify-space-between mb-3">
                                        <div class="d-flex align-center gap-2">
                                            <VChip :color="statusColors[workOrder.status]" size="small" label>
                                                <VIcon :icon="statusIcons[workOrder.status]" start size="16" />
                                                {{ statusLabels[workOrder.status] }}
                                            </VChip>
                                        </div>
                                        <VMenu>
                                            <template v-slot:activator="{ props }">
                                                <VBtn v-bind="props" icon="ri-more-2-fill" variant="text" size="small" />
                                            </template>
                                            <VList>
                                                <VListItem @click="viewDetails(workOrder)">
                                                    <template v-slot:prepend>
                                                        <VIcon icon="ri-eye-line" />
                                                    </template>
                                                    <VListItemTitle>Ver Detalles</VListItemTitle>
                                                </VListItem>
                                                <VListItem v-if="workOrder.status === 'ready' && !workOrder.sale" @click="goToSale(workOrder.id)">
                                                    <template v-slot:prepend>
                                                        <VIcon icon="ri-shopping-cart-line" />
                                                    </template>
                                                    <VListItemTitle>Generar Venta</VListItemTitle>
                                                </VListItem>
                                            </VList>
                                        </VMenu>
                                    </div>

                                    <div class="mb-3">
                                        <p class="text-h5 font-weight-bold mb-1">{{ workOrder.number }}</p>
                                        <p class="text-body-2 text-grey">{{ new Date(workOrder.created_at).toLocaleDateString() }}</p>
                                    </div>

                                    <VDivider class="mb-3" />

                                    <div class="mb-3">
                                        <div class="d-flex align-center gap-2 mb-2">
                                            <VIcon icon="ri-user-line" size="18" color="grey" />
                                            <span class="text-body-2 font-weight-medium">Cliente:</span>
                                        </div>
                                        <p class="text-body-2">{{ getClientName(workOrder.client) }}</p>
                                    </div>

                                    <div class="mb-3">
                                        <div class="d-flex align-center gap-2 mb-2">
                                            <VIcon icon="ri-car-line" size="18" color="grey" />
                                            <span class="text-body-2 font-weight-medium">Vehículo:</span>
                                        </div>
                                        <p class="text-body-2">{{ getVehicleInfo(workOrder.vehicle) }}</p>
                                    </div>

                                    <div class="d-flex align-center justify-space-between mb-3">
                                        <div>
                                            <p class="text-caption text-grey mb-1">Kilometraje</p>
                                            <p class="text-body-2 font-weight-medium">{{ workOrder.mileage || 'N/A' }} km</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-caption text-grey mb-1">Total</p>
                                            <p class="text-h6 font-weight-bold text-primary">${{ getTotalAmount(workOrder).toFixed(2) }}</p>
                                        </div>
                                    </div>

                                    <VDivider class="mb-3" />

                                    <div class="d-flex gap-2">
                                        <VBtn v-if="workOrder.status === 'received'" color="warning" variant="outlined" block
                                            @click="updateStatus(workOrder.id, 'in_progress')">
                                            <VIcon icon="ri-play-line" start /> Iniciar
                                        </VBtn>
                                        <VBtn v-if="workOrder.status === 'in_progress'" color="success" variant="outlined" block
                                            @click="updateStatus(workOrder.id, 'ready')">
                                            <VIcon icon="ri-check-line" start /> Terminar
                                        </VBtn>
                                        <VBtn v-if="workOrder.status === 'ready' && !workOrder.sale" color="primary" variant="elevated" block
                                            @click="goToSale(workOrder.id)">
                                            <VIcon icon="ri-shopping-cart-line" start /> Generar Venta
                                        </VBtn>
                                        <VChip v-if="workOrder.status === 'delivered'" color="grey" label block>
                                            <VIcon icon="ri-truck-line" start /> Entregado
                                        </VChip>
                                    </div>
                                </VCardText>
                            </VCard>
                        </VCol>
                    </VRow>
                </div>

                <div v-else-if="isLoading" class="text-center pa-12">
                    <VProgressCircular indeterminate color="primary" size="64" />
                    <p class="mt-4 text-body-2 text-grey">Cargando órdenes de trabajo...</p>
                </div>

                <div v-else class="text-center pa-12">
                    <VIcon icon="ri-file-list-3-line" size="96" color="grey-lighten-1" />
                    <p class="mt-4 text-h6 text-grey">No hay órdenes de trabajo registradas</p>
                    <p class="text-body-2 text-grey mb-4">Comienza creando una nueva orden de trabajo</p>
                    <VBtn color="primary" prepend-icon="ri-add-line" @click="goToCreate">
                        Crear Primera Orden
                    </VBtn>
                </div>
            </VCol>
        </VRow>

        <!-- Details Dialog -->
        <VDialog v-model="showDetailsDialog" max-width="800">
            <VCard v-if="selectedWorkOrder">
                <VCardTitle class="d-flex align-center justify-space-between pa-4">
                    <span>Detalles de Orden #{{ selectedWorkOrder.number }}</span>
                    <VBtn icon="ri-close-line" variant="text" @click="showDetailsDialog = false" />
                </VCardTitle>
                <VDivider />
                <VCardText class="pa-4">
                    <VRow>
                        <VCol cols="12" md="6">
                            <p class="text-body-2 text-grey mb-1">Cliente</p>
                            <p class="text-body-1 font-weight-medium">{{ getClientName(selectedWorkOrder.client) }}</p>
                        </VCol>
                        <VCol cols="12" md="6">
                            <p class="text-body-2 text-grey mb-1">Vehículo</p>
                            <p class="text-body-1 font-weight-medium">{{ getVehicleInfo(selectedWorkOrder.vehicle) }}</p>
                        </VCol>
                        <VCol cols="12" md="6">
                            <p class="text-body-2 text-grey mb-1">Kilometraje</p>
                            <p class="text-body-1 font-weight-medium">{{ selectedWorkOrder.mileage || 'N/A' }} km</p>
                        </VCol>
                        <VCol cols="12" md="6">
                            <p class="text-body-2 text-grey mb-1">Estado</p>
                            <VChip :color="statusColors[selectedWorkOrder.status]" size="small" label>
                                {{ statusLabels[selectedWorkOrder.status] }}
                            </VChip>
                        </VCol>
                    </VRow>

                    <VDivider class="my-4" />

                    <p class="text-h6 font-weight-bold mb-3">Items</p>
                    <VTable v-if="selectedWorkOrder.items && selectedWorkOrder.items.length > 0">
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th>Cantidad</th>
                                <th>Precio Unit.</th>
                                <th>Descuento</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in selectedWorkOrder.items" :key="item.id">
                                <td>{{ item.description }}</td>
                                <td>{{ item.quantity }}</td>
                                <td>${{ parseFloat(item.unit_price).toFixed(2) }}</td>
                                <td>${{ parseFloat(item.discount).toFixed(2) }}</td>
                                <td>${{ parseFloat(item.subtotal).toFixed(2) }}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" class="text-right font-weight-bold">Total:</td>
                                <td class="font-weight-bold">${{ getTotalAmount(selectedWorkOrder).toFixed(2) }}</td>
                            </tr>
                        </tfoot>
                    </VTable>
                    <p v-else class="text-body-2 text-grey">No hay items en esta orden</p>
                </VCardText>
                <VDivider />
                <VCardActions class="pa-4">
                    <VSpacer />
                    <VBtn color="grey" variant="text" @click="showDetailsDialog = false">Cerrar</VBtn>
                    <VBtn v-if="selectedWorkOrder.status === 'ready' && !selectedWorkOrder.sale" color="primary" @click="goToSale(selectedWorkOrder.id)">
                        Generar Venta
                    </VBtn>
                </VCardActions>
            </VCard>
        </VDialog>
    </VContainer>
</template>

<style scoped>
.work-order-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.work-order-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}
</style>
