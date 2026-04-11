<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

// Estado
const loading = ref(false)
const dailyCash = ref({
    opening_balance: 0,
    current_balance: 0,
    total_income: 0,
    total_expenses: 0,
    movements: []
})

const transactions = ref({
    income: [],
    expenses: [],
    transfers: []
})

const selectedPeriod = ref('today')
const showAddTransactionDialog = ref(false)
const transactionType = ref('income')

// Opciones de período
const periodOptions = [
    { title: 'Hoy', value: 'today' },
    { title: 'Esta semana', value: 'week' },
    { title: 'Este mes', value: 'month' },
    { title: 'Año', value: 'year' }
]

// Computed properties
const netCashFlow = computed(() => {
    return dailyCash.value.total_income - dailyCash.value.total_expenses
})

const cashFlowPercentage = computed(() => {
    if (dailyCash.value.total_income === 0) return 0
    return ((dailyCash.value.total_income - dailyCash.value.total_expenses) / dailyCash.value.total_income) * 100
})

// Métodos
const loadFinanceData = async () => {
    loading.value = true
    try {
        // Simulación de datos - reemplazar con llamada real a la API
        const mockDailyCash = {
            opening_balance: 2500.00,
            current_balance: 3250.75,
            total_income: 1250.75,
            total_expenses: 500.00,
            movements: [
                { id: 1, type: 'income', description: 'Venta de productos', amount: 750.50, time: '09:30', method: 'efectivo' },
                { id: 2, type: 'expense', description: 'Compra de insumos', amount: 200.00, time: '10:15', method: 'tarjeta' },
                { id: 3, type: 'income', description: 'Servicio técnico', amount: 500.25, time: '14:20', method: 'transferencia' },
                { id: 4, type: 'expense', description: 'Pago de servicios', amount: 150.00, time: '16:45', method: 'efectivo' },
                { id: 5, type: 'expense', description: 'Combustible', amount: 150.00, time: '17:30', method: 'efectivo' }
            ]
        }

        const mockTransactions = {
            income: [
                { id: 1, description: 'Venta de productos', amount: 750.50, date: '2024-01-15', category: 'ventas', client: 'Juan Pérez' },
                { id: 2, description: 'Servicio técnico', amount: 500.25, date: '2024-01-15', category: 'servicios', client: 'María García' },
                { id: 3, description: 'Venta de accesorios', amount: 125.00, date: '2024-01-14', category: 'ventas', client: 'Carlos López' }
            ],
            expenses: [
                { id: 1, description: 'Compra de insumos', amount: 200.00, date: '2024-01-15', category: 'insumos', provider: 'Distribuidora XYZ' },
                { id: 2, description: 'Pago de servicios', amount: 150.00, date: '2024-01-15', category: 'servicios', provider: 'Empresa Eléctrica' },
                { id: 3, description: 'Combustible', amount: 150.00, date: '2024-01-15', category: 'transporte', provider: 'Shell' },
                { id: 4, description: 'Alquiler', amount: 800.00, date: '2024-01-14', category: 'operativo', provider: 'Inmobiliaria ABC' }
            ],
            transfers: [
                { id: 1, description: 'Transferencia a cuenta de ahorros', amount: 500.00, date: '2024-01-15', from: 'Cuenta principal', to: 'Ahorros', reference: 'TR001' },
                { id: 2, description: 'Transferencia de proveedor', amount: -300.00, date: '2024-01-14', from: 'Proveedor A', to: 'Cuenta principal', reference: 'TR002' }
            ]
        }

        dailyCash.value = mockDailyCash
        transactions.value = mockTransactions

    } catch (error) {
        console.error('Error al cargar datos financieros:', error)
    } finally {
        loading.value = false
    }
}

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(amount)
}

const getTransactionIcon = (type) => {
    const icons = {
        income: 'ri-arrow-down-circle-line text-success',
        expense: 'ri-arrow-up-circle-line text-error',
        transfer: 'ri-arrow-left-right-line text-info'
    }
    return icons[type] || 'ri-file-list-line'
}

const getCategoryColor = (category) => {
    const colors = {
        ventas: 'success',
        servicios: 'primary',
        insumos: 'warning',
        servicios: 'error',
        transporte: 'info',
        operativo: 'secondary'
    }
    return colors[category] || 'grey'
}

// Montar componente
onMounted(() => {
    loadFinanceData()
})
</script>

<template>
    <div class="finances-dashboard">
        <!-- Header -->
        <VCard class="mb-6" elevation="2">
            <VCardTitle class="d-flex align-center justify-space-between pa-4">
                <div class="d-flex align-center">
                    <VIcon icon="ri-money-dollar-circle-line" size="32" color="primary" class="me-3" />
                    <div>
                        <h1 class="text-h4 font-weight-bold mb-1">Gestión de Finanzas</h1>
                        <p class="text-body-2 text-medium-emphasis">Gestión financiera y control de caja</p>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <VSelect v-model="selectedPeriod" :items="periodOptions" item-title="title" item-value="value"
                        label="Período" variant="outlined" density="compact" style="width: 150px" />
                    <VBtn color="primary" prepend-icon="ri-refresh-line" @click="loadFinanceData" :loading="loading">
                        Actualizar
                    </VBtn>
                </div>
            </VCardTitle>
        </VCard>

        <!-- Contenido Principal - Dos Columnas -->
        <VRow>
            <!-- Columna Izquierda - Caja Diaria -->
            <VCol cols="12" lg="6">
                <VCard class="h-100" elevation="2">
                    <VCardTitle class="pa-3">
                        <div class="d-flex align-center justify-space-between w-100">
                            <div class="d-flex align-center">
                                <VIcon icon="ri-safe-2-line" size="20" class="me-2" />
                                <span class="text-h6">Caja</span>
                            </div>
                            <div class="d-flex gap-2">
                                <VBtn color="success" variant="tonal" size="small" prepend-icon="ri-lock-unlock-line">
                                    Apertura
                                </VBtn>
                                <VBtn color="error" variant="tonal" size="small" prepend-icon="ri-lock-lock-line">
                                    Cierre
                                </VBtn>
                            </div>
                        </div>
                    </VCardTitle>

                    <VCardText class="pa-4">
                        <!-- Resumen de Caja -->
                        <VRow class="mb-4">
                            <VCol cols="6">
                                <VCard class="elevation-1" variant="tonal" color="success">
                                    <VCardText class="text-center pa-3">
                                        <VIcon icon="ri-arrow-down-line" size="20" color="success" />
                                        <div class="text-caption text-success">Ingresos</div>
                                        <div class="text-h6 font-weight-bold text-success">
                                            {{ formatCurrency(dailyCash.total_income) }}
                                        </div>
                                    </VCardText>
                                </VCard>
                            </VCol>
                            <VCol cols="6">
                                <VCard class="elevation-1" variant="tonal" color="error">
                                    <VCardText class="text-center pa-3">
                                        <VIcon icon="ri-arrow-up-line" size="20" color="error" />
                                        <div class="text-caption text-error">Egresos</div>
                                        <div class="text-h6 font-weight-bold text-error">
                                            {{ formatCurrency(dailyCash.total_expenses) }}
                                        </div>
                                    </VCardText>
                                </VCard>
                            </VCol>
                        </VRow>

                        <!-- Balance Actual -->
                        <VCard class="mb-4" :color="netCashFlow >= 0 ? 'success' : 'error'" variant="tonal">
                            <VCardText class="text-center pa-4">
                                <div class="text-h6 mb-2">
                                    <VIcon
                                        :icon="netCashFlow >= 0 ? 'ri-arrow-down-circle-line' : 'ri-arrow-up-circle-line'"
                                        size="24" />
                                </div>
                                <div class="text-overline">Balance Neto</div>
                                <div class="text-h4 font-weight-bold mb-2">
                                    {{ formatCurrency(netCashFlow) }}
                                </div>
                                <VChip :color="netCashFlow >= 0 ? 'white' : 'white'" variant="tonal" size="small">
                                    {{ cashFlowPercentage.toFixed(1) }}% {{ netCashFlow >= 0 ? 'positivo' : 'negativo'
                                    }}
                                </VChip>
                            </VCardText>
                        </VCard>

                        <!-- Saldo Actual -->
                        <VCard class="mb-4" color="primary" variant="tonal">
                            <VCardText class="text-center pa-4">
                                <div class="text-overline mb-1">Saldo Actual en Caja</div>
                                <div class="text-h3 font-weight-bold">
                                    {{ formatCurrency(dailyCash.current_balance) }}
                                </div>
                                <div class="text-caption">
                                    Saldo inicial: {{ formatCurrency(dailyCash.opening_balance) }}
                                </div>
                            </VCardText>
                        </VCard>

                        <!-- Movimientos Recientes -->
                        <div>
                            <h3 class="text-h6 font-weight-bold mb-3">Movimientos Recientes</h3>
                            <VCard variant="outlined" class="movement-list">
                                <VList density="compact">
                                    <VListItem v-for="movement in dailyCash.movements.slice(0, 5)" :key="movement.id">
                                        <template #prepend>
                                            <VIcon :icon="getTransactionIcon(movement.type)" size="20" />
                                        </template>
                                        <VListItemTitle class="text-body-2">
                                            {{ movement.description }}
                                        </VListItemTitle>
                                        <VListItemSubtitle class="text-caption">
                                            {{ movement.time }} · {{ movement.method }}
                                        </VListItemSubtitle>
                                        <template #append>
                                            <div class="text-right">
                                                <div :class="movement.type === 'income' ? 'text-success' : 'text-error'"
                                                    class="font-weight-bold">
                                                    {{ movement.type === 'income' ? '+' : '-' }}{{
                                                        formatCurrency(movement.amount) }}
                                                </div>
                                            </div>
                                        </template>
                                    </VListItem>
                                </VList>
                            </VCard>
                        </div>
                    </VCardText>
                </VCard>
            </VCol>

            <!-- Columna Derecha - Ingresos, Egresos y Transferencias -->
            <VCol cols="12" lg="6">
                <VCard class="h-100" elevation="2">
                    <VCardTitle class="pa-3">
                        <div class="d-flex align-center">
                            <VIcon icon="ri-exchange-line" size="20" class="me-2" />
                            <span class="text-h6">Operaciones</span>
                        </div>
                    </VCardTitle>

                    <VCardText class="pa-4">
                        <!-- Tabs para diferentes tipos de transacciones -->
                        <VTabs v-model="transactionType" class="mb-4">
                            <VTab value="income">
                                <VIcon icon="ri-arrow-down-circle-line" class="me-1" />
                                Ingresos
                            </VTab>
                            <VTab value="expenses">
                                <VIcon icon="ri-arrow-up-circle-line" class="me-1" />
                                Egresos
                            </VTab>
                            <VTab value="transfers">
                                <VIcon icon="ri-arrow-left-right-line" class="me-1" />
                                Transferencias
                            </VTab>
                        </VTabs>

                        <!-- Contenido de los tabs -->
                        <VWindow v-model="transactionType">
                            <!-- Tab de Ingresos -->
                            <VWindowItem value="income">
                                <div class="mb-3">
                                    <div class="d-flex align-center justify-space-between mb-2">
                                        <h3 class="text-h6 font-weight-bold">Ingresos Recientes</h3>
                                        <VBtn color="success" variant="tonal" size="small" prepend-icon="ri-add-line">
                                            Nuevo Ingreso
                                        </VBtn>
                                    </div>
                                    <VCard variant="outlined">
                                        <VList>
                                            <VListItem v-for="income in transactions.income" :key="income.id">
                                                <template #prepend>
                                                    <VIcon icon="ri-arrow-down-circle-line text-success" size="20" />
                                                </template>
                                                <VListItemTitle>
                                                    {{ income.description }}
                                                </VListItemTitle>
                                                <VListItemSubtitle>
                                                    {{ income.client }} · {{ income.date }}
                                                </VListItemSubtitle>
                                                <template #append>
                                                    <div class="text-right">
                                                        <VChip :color="getCategoryColor(income.category)" size="small"
                                                            class="mb-1">
                                                            {{ income.category }}
                                                        </VChip>
                                                        <div class="text-success font-weight-bold mb-1">
                                                            +{{ formatCurrency(income.amount) }}
                                                        </div>
                                                        <div class="d-flex gap-1">
                                                            <VBtn color="primary" variant="tonal" size="x-small"
                                                                icon="ri-edit-line" />
                                                            <VBtn color="error" variant="tonal" size="x-small"
                                                                icon="ri-delete-bin-line" />
                                                        </div>
                                                    </div>
                                                </template>
                                            </VListItem>
                                        </VList>
                                    </VCard>
                                </div>
                            </VWindowItem>

                            <!-- Tab de Egresos -->
                            <VWindowItem value="expenses">
                                <div class="mb-3">
                                    <div class="d-flex align-center justify-space-between mb-2">
                                        <h3 class="text-h6 font-weight-bold">Egresos Recientes</h3>
                                        <VBtn color="error" variant="tonal" size="small" prepend-icon="ri-add-line">
                                            Nuevo Egreso
                                        </VBtn>
                                    </div>
                                    <VCard variant="outlined">
                                        <VList>
                                            <VListItem v-for="expense in transactions.expenses" :key="expense.id">
                                                <template #prepend>
                                                    <VIcon icon="ri-arrow-up-circle-line text-error" size="20" />
                                                </template>
                                                <VListItemTitle>
                                                    {{ expense.description }}
                                                </VListItemTitle>
                                                <VListItemSubtitle>
                                                    {{ expense.provider }} · {{ expense.date }}
                                                </VListItemSubtitle>
                                                <template #append>
                                                    <div class="text-right">
                                                        <VChip :color="getCategoryColor(expense.category)" size="small"
                                                            class="mb-1">
                                                            {{ expense.category }}
                                                        </VChip>
                                                        <div class="text-error font-weight-bold mb-1">
                                                            -{{ formatCurrency(expense.amount) }}
                                                        </div>
                                                        <div class="d-flex gap-1">
                                                            <VBtn color="primary" variant="tonal" size="x-small"
                                                                icon="ri-edit-line" />
                                                            <VBtn color="error" variant="tonal" size="x-small"
                                                                icon="ri-delete-bin-line" />
                                                        </div>
                                                    </div>
                                                </template>
                                            </VListItem>
                                        </VList>
                                    </VCard>
                                </div>
                            </VWindowItem>

                            <!-- Tab de Transferencias -->
                            <VWindowItem value="transfers">
                                <div class="mb-3">
                                    <div class="d-flex align-center justify-space-between mb-2">
                                        <h3 class="text-h6 font-weight-bold">Transferencias Recientes</h3>
                                        <VBtn color="info" variant="tonal" size="small" prepend-icon="ri-add-line">
                                            Nueva Transferencia
                                        </VBtn>
                                    </div>
                                    <VCard variant="outlined">
                                        <VList>
                                            <VListItem v-for="transfer in transactions.transfers" :key="transfer.id">
                                                <template #prepend>
                                                    <VIcon icon="ri-arrow-left-right-line text-info" size="20" />
                                                </template>
                                                <VListItemTitle>
                                                    {{ transfer.description }}
                                                </VListItemTitle>
                                                <VListItemSubtitle>
                                                    {{ transfer.from }} {{ transfer.amount > 0 ? 'a' : 'de' }} {{
                                                        transfer.to }}
                                                </VListItemSubtitle>
                                                <template #append>
                                                    <div class="text-right">
                                                        <div class="text-caption text-medium-emphasis mb-1">
                                                            {{ transfer.reference }}
                                                        </div>
                                                        <div :class="transfer.amount > 0 ? 'text-info' : 'text-warning'"
                                                            class="font-weight-bold mb-1">
                                                            {{ transfer.amount > 0 ? '+' : '' }}{{
                                                                formatCurrency(transfer.amount) }}
                                                        </div>
                                                        <div class="d-flex gap-1">
                                                            <VBtn color="primary" variant="tonal" size="x-small"
                                                                icon="ri-edit-line" />
                                                            <VBtn color="error" variant="tonal" size="x-small"
                                                                icon="ri-delete-bin-line" />
                                                        </div>
                                                    </div>
                                                </template>
                                            </VListItem>
                                        </VList>
                                    </VCard>
                                </div>
                            </VWindowItem>
                        </VWindow>
                    </VCardText>
                </VCard>
            </VCol>
        </VRow>
    </div>
</template>

<style scoped>
.finances-dashboard {
    padding: 0;
}

.movement-list {
    max-height: 300px;
    overflow-y: auto;
}

.text-success {
    color: #4caf50 !important;
}

.text-error {
    color: #f44336 !important;
}

.text-info {
    color: #2196f3 !important;
}

.text-warning {
    color: #ff9800 !important;
}

/* Scrollbar personalizado */
.movement-list::-webkit-scrollbar {
    width: 6px;
}

.movement-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

.movement-list::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
}

.movement-list::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

/* Responsive */
@media (max-width: 1280px) {
    .finances-dashboard .v-row>.v-col {
        margin-bottom: 16px;
    }
}
</style>