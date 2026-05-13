<script setup>
import { ref, computed, onMounted } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
    type: {
        type: Number,
        default: 0 // 0 = ingresos, 1 = egresos
    }
})

const loading = ref(false)
const groupedMovements = ref([])
const expandedWorkOrders = ref({})

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value)
}

const formatDate = (date) => {
    if (!date) return 'N/A'

    try {
        const dateObj = new Date(date)
        if (isNaN(dateObj.getTime())) {
            return 'Fecha inválida'
        }

        const day = String(dateObj.getDate()).padStart(2, '0')
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const year = dateObj.getFullYear()

        return `${day}/${month}/${year}`
    } catch (error) {
        console.error('Error al formatear fecha:', error, date)
        return 'Error fecha'
    }
}

const toggleWorkOrder = (workOrderNumber) => {
    expandedWorkOrders.value[workOrderNumber] = !expandedWorkOrders.value[workOrderNumber]
}

const totalAmount = computed(() => {
    return groupedMovements.value.reduce((total, group) => total + group.total_amount, 0)
})

const totalWorkOrders = computed(() => {
    return groupedMovements.value.length
})

const loadGroupedMovements = async () => {
    loading.value = true
    try {
        // Usar endpoint existente y procesar datos en frontend
        const response = await $api('finance-records')
        const allMovements = Array.isArray(response) ? response : (response?.data || [])

        // Filtrar por tipo y agrupar por orden de trabajo
        const filteredMovements = allMovements.filter(movement => movement.type === props.type)
        const grouped = {}

        filteredMovements.forEach(movement => {
            if (movement.work_order_number) {
                if (!grouped[movement.work_order_number]) {
                    grouped[movement.work_order_number] = {
                        work_order_number: movement.work_order_number,
                        description: movement.description,
                        entry_date: movement.entry_date,
                        total_amount: 0,
                        movements_count: 0,
                        movements: []
                    }
                }

                grouped[movement.work_order_number].total_amount += parseFloat(movement.amount)
                grouped[movement.work_order_number].movements_count++
                grouped[movement.work_order_number].movements.push({
                    id: movement.id,
                    account_name: movement.account_name || 'N/A',
                    payment_method: movement.payment_method,
                    amount: movement.amount,
                    entry_date: movement.entry_date,
                    created_at: movement.created_at
                })
            }
        })

        groupedMovements.value = Object.values(grouped).sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))
        loading.value = false
    } catch (error) {
        console.error('Error al cargar movimientos agrupados:', error)
        loading.value = false
    }
}

const deleteMovement = async (movementId) => {
    try {
        await $api(`finance-records/${movementId}`, {
            method: 'DELETE'
        })

        // Recargar los datos
        await loadGroupedMovements()

        // Emitir evento para notificar al padre
        emit('movement-deleted', movementId)
    } catch (error) {
        console.error('Error al eliminar movimiento:', error)
    }
}

const emit = defineEmits(['movement-deleted'])

onMounted(() => {
    loadGroupedMovements()
})
</script>

<template>
    <div>
        <!-- Resumen General -->
        <VCard class="rounded-lg elevation-4 mb-6">
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center gap-2">
                    <VIcon :color="type === 0 ? 'success' : 'error'" size="24">
                        {{ type === 0 ? 'ri-arrow-up-circle-line' : 'ri-arrow-down-circle-line' }}
                    </VIcon>
                    <span class="text-h6 font-weight-medium">
                        {{ type === 0 ? 'Ingresos' : 'Egresos' }} por Orden de Trabajo
                    </span>
                </div>
            </VCardTitle>
            <VDivider />
            <VCardText class="pa-4">
                <VRow>
                    <VCol cols="12" md="4">
                        <VCard variant="outlined" class="pa-3">
                            <div class="text-center">
                                <VIcon size="32" color="primary" class="mb-2">ri-file-list-3-line</VIcon>
                                <div class="text-h4 font-weight-bold">{{ totalWorkOrders }}</div>
                                <div class="text-medium-emphasis">Órdenes de Trabajo</div>
                            </div>
                        </VCard>
                    </VCol>
                    <VCol cols="12" md="4">
                        <VCard variant="outlined" class="pa-3">
                            <div class="text-center">
                                <VIcon size="32" :color="type === 0 ? 'success' : 'error'" class="mb-2">
                                    {{ type === 0 ? 'ri-money-dollar-circle-line' : 'ri-money-dollar-circle-line' }}
                                </VIcon>
                                <div class="text-h4 font-weight-bold"
                                    :class="type === 0 ? 'text-success' : 'text-error'">
                                    {{ formatCurrency(totalAmount) }}
                                </div>
                                <div class="text-medium-emphasis">Monto Total</div>
                            </div>
                        </VCard>
                    </VCol>
                    <VCol cols="12" md="4">
                        <VCard variant="outlined" class="pa-3">
                            <div class="text-center">
                                <VIcon size="32" color="info" class="mb-2">ri-refresh-line</VIcon>
                                <VBtn size="small" color="primary" @click="loadGroupedMovements" :loading="loading">
                                    Actualizar
                                </VBtn>
                                <div class="text-medium-emphasis mt-2">Actualizar Datos</div>
                            </div>
                        </VCard>
                    </VCol>
                </VRow>
            </VCardText>
        </VCard>

        <!-- Tabla de Movimientos Agrupados -->
        <VCard class="rounded-lg elevation-4">
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center gap-2">
                    <VIcon size="24">ri-table-line</VIcon>
                    <span class="text-h6 font-weight-medium">Movimientos Detallados</span>
                </div>
            </VCardTitle>
            <VDivider />
            <VCardText class="pa-0">
                <!-- Loading State -->
                <div v-if="loading" class="d-flex justify-center pa-12">
                    <VProgressCircular indeterminate color="primary" size="48" />
                    <p class="text-medium-emphasis mt-3">Cargando movimientos...</p>
                </div>

                <!-- Tabla de Datos -->
                <div v-else-if="groupedMovements.length > 0">
                    <VTable class="grouped-movements-table">
                        <thead>
                            <tr>
                                <th class="text-left">Orden de Trabajo</th>
                                <th class="text-left">Descripción</th>
                                <th class="text-left">Fecha</th>
                                <th class="text-center">Monto Total</th>
                                <th class="text-center">Movimientos</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="(group, index) in groupedMovements" :key="group.work_order_number">
                                <tr>
                                    <!-- Fila Principal de la Orden de Trabajo -->
                                    <td class="font-weight-bold">
                                        <div class="d-flex align-center gap-2">
                                            <VBtn icon size="small" variant="text"
                                                @click="toggleWorkOrder(group.work_order_number)">
                                                <VIcon>
                                                    {{ expandedWorkOrders[group.work_order_number] ?
                                                        'ri-arrow-down-s-line'
                                                    : 'ri-arrow-right-s-line' }}
                                                </VIcon>
                                            </VBtn>
                                            {{ group.work_order_number }}
                                        </div>
                                    </td>
                                    <td>{{ group.description }}</td>
                                    <td>{{ formatDate(group.entry_date) }}</td>
                                    <td class="text-center">
                                        <span class="font-weight-bold"
                                            :class="type === 0 ? 'text-success' : 'text-error'">
                                            {{ formatCurrency(group.total_amount) }}
                                        </span>
                                    </td>
                                    <td class="text-center">
                                        <VChip size="small" color="primary">
                                            {{ group.movements_count }} movimiento{{ group.movements_count !== 1 ? 's' :
                                                ''
                                            }}
                                        </VChip>
                                    </td>
                                    <td class="text-center">
                                        <VBtn size="small" color="info" variant="outlined">
                                            <VIcon start>ri-eye-line</VIcon>
                                            Ver Detalles
                                        </VBtn>
                                    </td>
                                </tr>

                                <!-- Filas Detalladas (expandidas) -->
                                <tr v-if="expandedWorkOrders[group.work_order_number]"
                                    :key="`details-${group.work_order_number}`">
                                    <td colspan="6" class="pa-0">
                                        <VCard variant="outlined" class="ma-3">
                                            <VCardTitle class="pa-3 pb-2">
                                                <div class="d-flex align-center gap-2">
                                                    <VIcon size="20" color="primary">ri-file-list-3-line</VIcon>
                                                    <span class="text-subtitle-1">Movimientos de {{
                                                        group.work_order_number
                                                        }}</span>
                                                </div>
                                            </VCardTitle>
                                            <VDivider />
                                            <VTable class="detailed-movements-table">
                                                <thead>
                                                    <tr>
                                                        <th class="text-left">Cuenta</th>
                                                        <th class="text-left">Método de Pago</th>
                                                        <th class="text-right">Monto</th>
                                                        <th class="text-center">Acciones</th>
                                                    </tr>
                                                </thead>
                        <tbody>
                            <tr v-for="movement in group.movements" :key="movement.id">
                                <td>{{ movement.account_name }}</td>
                                <td>
                                    <VChip size="small"
                                        :color="movement.payment_method === 'cash' ? 'success' : 'info'">
                                        {{ movement.payment_method === 'cash' ? 'Efectivo' : 'Transferencia' }}
                                    </VChip>
                                </td>
                                <td class="text-right">
                                    <span class="font-weight-bold" :class="type === 0 ? 'text-success' : 'text-error'">
                                        {{ formatCurrency(movement.amount) }}
                                    </span>
                                </td>
                                <td class="text-center">
                                    <VBtn size="small" color="error" variant="outlined"
                                        @click="deleteMovement(movement.id)">
                                        <VIcon start>ri-delete-bin-line</VIcon>
                                        Eliminar
                                    </VBtn>
                                </td>
                            </tr>
                        </tbody>
                    </VTable>
        </VCard>
        </td>
        </tr>
</template>
</tbody>
</VTable>
</div>

<!-- Empty State -->
<div v-else class="text-center pa-12">
    <VIcon size="64" color="medium-emphasis" class="mb-4">ri-inbox-line</VIcon>
    <h3 class="text-h5 mb-2">No hay movimientos para mostrar</h3>
    <p class="text-medium-emphasis">
        {{ type === 0 ? 'No hay ingresos registrados' : 'No hay egresos registrados' }}
    </p>
</div>
</VCardText>
</VCard>
</div>
</template>

<style scoped>
.grouped-movements-table {
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.grouped-movements-table th {
    background-color: #f5f5f5;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.025em;
}

.grouped-movements-table td {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    padding: 12px 8px;
}

.grouped-movements-table tr:hover td {
    background-color: #f8f9fa;
}

.detailed-movements-table {
    background-color: transparent;
}

.detailed-movements-table th {
    background-color: #fafafa;
    font-weight: 500;
    font-size: 0.875rem;
}

.detailed-movements-table td {
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    padding: 8px;
}
</style>
