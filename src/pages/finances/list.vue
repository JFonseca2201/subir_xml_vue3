<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import DailyCashFlowAddDialog from '@/components/inventory/daily-cash-flows/DailyCashFlowAddDialog.vue'
import DailyCashFlowEditDialog from '@/components/inventory/daily-cash-flows/DailyCashFlowEditDialog.vue'
import DailyCashFlowDeleteDialog from '@/components/inventory/daily-cash-flows/DailyCashFlowDeleteDialog.vue'

const { showNotification } = useGlobalToast()

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

// Estado para diálogos de flujo de caja
const isAddCashFlowDialogVisible = ref(false)
const isEditCashFlowDialogVisible = ref(false)
const isDeleteCashFlowDialogVisible = ref(false)
const selectedCashFlow = ref(null)
const selectedFlowType = ref('income')

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

const groupedByDay = computed(() => {
    return groupMovementsByDay(dailyCash.value.movements)
})

// Métodos
const formatDateLocal = (dateString) => {
    if (!dateString) return ''

    // Si la fecha ya viene formateada (ej: "22/04/2026"), usarla directamente
    if (dateString.includes('/')) {
        return dateString
    }

    // Si viene como ISO string (ej: "2026-04-22T14:30:00"), procesarla
    try {
        const date = new Date(dateString)

        // Obtener componentes locales sin problemas de zona horaria
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = date.getFullYear()

        return `${day}/${month}/${year}`
    } catch (error) {
        console.error('Error formatting date:', error)
        return dateString
    }
}

const loadFinanceData = async () => {
    loading.value = true
    try {
        // Cargar datos del backend con nueva estructura
        const today = new Date().toISOString().split('T')[0]
        const response = await $api('daily-cash-flows', {
            method: 'GET',
            params: {
                date_from: today,
                date_to: today,
                per_page: 50
            }
        })

        console.log('Respuesta completa del backend:', response)
        console.log('Tipo de respuesta:', typeof response)
        console.log('Claves de respuesta:', Object.keys(response))

        // Procesar estructura del backend
        let allMovements = []
        let totalIncome = 0
        let totalExpenses = 0

        // Extraer datos de la estructura actual del backend
        if (response.flows && Array.isArray(response.flows)) {
            console.log('Encontrado response.flows con', response.flows.length, 'elementos')
            allMovements = response.flows
            console.log('Primer flujo:', response.flows[0])
            console.log('Account IDs y payment methods de todos los flujos:')
            allMovements.forEach((flow, index) => {
                console.log(`Flujo ${index}: account_id=${flow.account_id}, payment_method=${flow.payment_method}, método mostrado=${getPaymentMethodDescription(flow.payment_method)}`)
            })

            // Calcular totales
            totalIncome = allMovements
                .filter(flow => flow.flow_type === 'income')
                .reduce((sum, flow) => sum + parseFloat(flow.total_amount || 0), 0)

            totalExpenses = allMovements
                .filter(flow => flow.flow_type === 'expense')
                .reduce((sum, flow) => sum + parseFloat(flow.total_amount || 0), 0)

            console.log('Totales calculados - Ingresos:', totalIncome, 'Egresos:', totalExpenses)
        } else if (response.daily_breakdown && Array.isArray(response.daily_breakdown)) {
            // Estructura anterior con daily_breakdown
            response.daily_breakdown.forEach(day => {
                if (day.flows && Array.isArray(day.flows)) {
                    day.flows.forEach(flow => {
                        allMovements.push({
                            ...flow,
                            flow_date: day.date,
                            formatted_date: day.formatted_date,
                            day_name: day.day_name
                        })

                        if (flow.flow_type === 'income') {
                            totalIncome += parseFloat(flow.total_amount || 0)
                        } else if (flow.flow_type === 'expense') {
                            totalExpenses += parseFloat(flow.total_amount || 0)
                        }
                    })
                }
            })
        } else if (response.summary) {
            // Usar datos del summary si no hay flows
            totalIncome = parseFloat(response.summary.total_income || 0)
            totalExpenses = parseFloat(response.summary.total_expense || 0)
        }

        console.log('Movimientos procesados:', allMovements)
        console.log('Totales calculados:', { totalIncome, totalExpenses })

        // Depurar tipos de movimientos
        console.log('Análisis de movimientos por tipo:')
        allMovements.forEach((movement, index) => {
            console.log(`Movimiento ${index}: type=${movement.type}, flow_type=${movement.flow_type}, amount=${movement.total_amount}`)
        })

        const netBalance = totalIncome - totalExpenses

        // Mapear datos al formato existente
        dailyCash.value = {
            opening_balance: 0,
            current_balance: netBalance,
            total_income: totalIncome,
            total_expenses: totalExpenses,
            movements: allMovements.map(flow => ({
                id: flow.id,
                type: flow.flow_type,
                order_number: flow.order_number ? `${getDocumentPrefix(flow.flow_type, flow.source_type)}${flow.order_number.padStart(5, '0')}` : null,
                description: flow.description,
                total_amount: flow.total_amount,
                date: flow.formatted_date || formatDateLocal(flow.flow_date),
                time: flow.created_at || new Date(flow.flow_date).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                method: getPaymentMethodDescription(flow.payment_method)
            }))
        }

        // Mantener la estructura existente para transactions
        transactions.value = {
            income: allMovements
                .filter(flow => flow.flow_type === 'income')
                .map(flow => ({
                    id: flow.id,
                    order_number: flow.order_number ? `${getDocumentPrefix(flow.flow_type, flow.source_type)}${flow.order_number.padStart(5, '0')}` : null,
                    description: flow.description,
                    amount: flow.total_amount,
                    date: flow.formatted_date || formatDateLocal(flow.flow_date),
                    time: flow.created_at || new Date(flow.flow_date).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    category: flow.source_type,
                    client: flow.order_number || 'N/A'
                })),
            expenses: allMovements
                .filter(flow => flow.flow_type === 'expense')
                .map(flow => ({
                    id: flow.id,
                    order_number: flow.order_number ? `${getDocumentPrefix(flow.flow_type, flow.source_type)}${flow.order_number.padStart(5, '0')}` : null,
                    description: flow.description,
                    amount: flow.total_amount,
                    date: flow.formatted_date || formatDateLocal(flow.flow_date),
                    time: flow.created_at || new Date(flow.flow_date).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    category: flow.source_type,
                    provider: flow.order_number || 'N/A'
                })),
            transfers: []
        }

        console.log('Resumen final:', {
            total_income: totalIncome,
            total_expenses: totalExpenses,
            net_balance: netBalance,
            movements_count: allMovements.length
        })

        console.log('dailyCash.value después de asignación:', dailyCash.value)
        console.log('transactions.value después de asignación:', transactions.value)
        console.log('groupedByDay calculado:', groupedByDay.value)

    } catch (error) {
        console.error('Error al cargar datos financieros:', error)
        showNotification?.('Error al cargar los datos financieros', 'error')
    } finally {
        loading.value = false
    }
}

const getAccountTypeName = (type) => {
    const types = {
        1: 'Caja Chica',
        2: 'Caja',
        3: 'Bancos'
    }
    return types[type] || 'Desconocido'
}

const getPaymentMethod = (accountType, accountTypeDescription) => {
    // Si hay account_type_description, usarlo. Si no, usar la lógica original
    if (accountTypeDescription) {
        return accountTypeDescription
    }
    // Caja Chica (1) = Efectivo, Caja (2) y Bancos (3) = Transferencia
    console.log('getPaymentMethod llamado con:', { accountType, accountTypeDescription })
    const result = accountType === 1 ? 'Efectivo' : 'Transferencia'
    console.log('Resultado:', result)
    return result
}

const getPaymentMethodDescription = (paymentMethod) => {
    // Mapear códigos de método de pago a descripciones en español
    // Solo dos métodos según account_id: 1 = cash, 2/3 = transfer
    const methods = {
        'cash': 'Efectivo',
        'transfer': 'Transferencia'
    }
    return methods[paymentMethod] || 'Desconocido'
}

const formatCurrency = (amount) => {
    // Si amount es null, undefined o string vacío, devolver $0.00
    if (amount === null || amount === undefined || amount === '') {
        return '$0.00'
    }

    // Si ya es un número, usarlo directamente
    if (typeof amount === 'number') {
        if (isNaN(amount) || !isFinite(amount)) {
            return '$0.00'
        }
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
    }

    // Si es string, convertir a número
    const numericAmount = parseFloat(amount.toString())

    if (isNaN(numericAmount) || !isFinite(numericAmount)) {
        return '$0.00'
    }

    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(numericAmount)
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

const getDocumentPrefix = (flowType, sourceType) => {
    if (flowType === 'income') {
        return 'OT-'
    } else if (flowType === 'expense') {
        // Para egresos, usar NV- para notas de venta o FACT- para facturas
        return sourceType === 'sale' ? 'FACT-' : 'NV-'
    }
    return ''
}

const groupMovementsByDay = (movements) => {
    console.log('🗂️ groupMovementsByDay llamado con movements:', movements)
    const grouped = {}

    movements.forEach(movement => {
        console.log('📋 Procesando movement:', movement)
        // Usar el campo date que ya está formateado
        const date = movement.date

        if (!grouped[date]) {
            grouped[date] = {
                date: date,
                income: [],
                expenses: [],
                totalIncome: 0,
                totalExpenses: 0
            }
        }

        if (movement.type === 'income') {
            console.log('✅ Movimiento de INGRESO detectado:', movement)
            grouped[date].income.push(movement)
            grouped[date].totalIncome += parseFloat(movement.total_amount || 0)
        } else if (movement.type === 'expense') {
            console.log('❌ Movimiento de EGRESO detectado:', movement)
            grouped[date].expenses.push(movement)
            grouped[date].totalExpenses += parseFloat(movement.total_amount || 0)
        } else {
            console.log('⚠️ Movimiento con tipo NO RECONOCIDO:', movement.type, movement)
        }
    })

    // Convertir a array y ordenar por fecha (más reciente primero)
    const result = Object.values(grouped).sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'))
        const dateB = new Date(b.date.split('/').reverse().join('-'))
        return dateB - dateA
    })

    console.log('📊 Resultado final de groupMovementsByDay:', result)
    return result
}

// Métodos para diálogos de flujo de caja
const openAddCashFlowDialog = (flowType = 'income') => {
    // Establecer el tipo de flujo seleccionado
    console.log('openAddCashFlowDialog llamado con flowType:', flowType)
    selectedFlowType.value = flowType
    console.log('selectedFlowType establecido a:', selectedFlowType.value)
    isAddCashFlowDialogVisible.value = true
}

const openEditCashFlowDialog = (flow) => {
    console.log('🔧 openEditCashFlowDialog llamado con flow:', flow)
    console.log('📋 flow completo:', JSON.stringify(flow, null, 2))

    selectedCashFlow.value = flow
    console.log('✅ selectedCashFlow.value asignado:', selectedCashFlow.value)

    isEditCashFlowDialogVisible.value = true
    console.log('🚀 isEditCashFlowDialogVisible.value establecido a true')
}

const openDeleteCashFlowDialog = (flow) => {
    selectedCashFlow.value = flow
    isDeleteCashFlowDialogVisible.value = true
}

const onCashFlowSuccess = (operation, data) => {
    selectedCashFlow.value = null

    if (operation === 'add' && data) {
        // Recargar todos los datos para mantener consistencia
        loadFinanceData()
        console.log('Flujo añadido, recargando datos:', data)
    } else if (operation === 'edit' && data) {
        // Recargar todos los datos para mantener consistencia
        loadFinanceData()
        console.log('Flujo actualizado, recargando datos:', data)
    } else if (operation === 'delete') {
        // Recargar todos los datos para mantener consistencia
        loadFinanceData()
        console.log('Flujo eliminado, recargando datos')
    }
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
                            <div v-if="dailyCash.movements && dailyCash.movements.length > 0">
                                <VCard variant="outlined" class="movement-list">
                                    <VList density="compact">
                                        <VListItem v-for="movement in dailyCash.movements.slice(0, 5)"
                                            :key="movement.id">
                                            <template #prepend>
                                                <VIcon :icon="getTransactionIcon(movement.type)" size="20" />
                                            </template>
                                            <VListItemTitle>
                                                <div v-if="movement.order_number" class="font-weight-bold text-body-2">
                                                    {{ movement.order_number }}
                                                </div>
                                                <div v-if="movement.description"
                                                    class="text-body-2 text-medium-emphasis">
                                                    {{ movement.description }}
                                                </div>
                                            </VListItemTitle>
                                            <VListItemSubtitle class="text-caption">
                                                {{ movement.date }} {{ movement.time }} · {{ movement.method }}
                                            </VListItemSubtitle>
                                            <template #append>
                                                <div class="text-right">
                                                    <div :class="movement.type === 'income' ? 'text-success' : 'text-error'"
                                                        class="font-weight-bold">
                                                        {{ movement.type === 'income' ? '+' : '-' }}{{
                                                            formatCurrency(movement.total_amount) }}
                                                    </div>
                                                </div>
                                            </template>
                                        </VListItem>
                                    </VList>
                                </VCard>
                            </div>
                            <div v-else class="text-center py-8 empty-state">
                                <VIcon icon="ri-money-dollar-circle-line" size="48" color="disabled" />
                                <p class="mt-2 text-h6">No hay movimientos aun</p>
                                <p class="text-body-2 text-medium-emphasis">No se han registrado movimientos de caja
                                    para el día de hoy</p>
                            </div>
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
                        </VTabs>

                        <!-- Contenido de los tabs -->
                        <VWindow v-model="transactionType">
                            <!-- Tab de Ingresos -->
                            <VWindowItem value="income">
                                <div class="mb-3">
                                    <div class="d-flex align-center justify-space-between mb-2">
                                        <h3 class="text-h6 font-weight-bold">Ingresos Recientes</h3>
                                        <VBtn color="success" variant="tonal" size="small" prepend-icon="ri-add-line"
                                            @click="openAddCashFlowDialog('income')">
                                            Nuevo Ingreso
                                        </VBtn>
                                    </div>
                                    <div v-if="groupedByDay && groupedByDay.length > 0">
                                        <div v-for="day in groupedByDay" :key="day.date">
                                            <VCard v-if="day.income && day.income.length > 0" variant="outlined"
                                                class="mb-3">
                                                <VCardSubtitle class="d-flex align-center justify-space-between pa-3">
                                                    <div class="d-flex align-center">
                                                        <VIcon icon="ri-calendar-line" size="20" class="me-2" />
                                                        <span class="text-body-2 font-weight-bold">{{ day.date }}</span>
                                                    </div>
                                                    <div class="text-success font-weight-bold">
                                                        {{ formatCurrency(day.totalIncome) }}
                                                    </div>
                                                </VCardSubtitle>
                                                <VDivider />
                                                <VList density="compact">
                                                    <VListItem v-for="income in day.income" :key="income.id">
                                                        <template #prepend>
                                                            <VIcon icon="ri-arrow-down-circle-line text-success"
                                                                size="20" />
                                                        </template>
                                                        <VListItemTitle>
                                                            <div v-if="income.order_number"
                                                                class="font-weight-bold text-body-2">
                                                                {{ income.order_number }}
                                                            </div>
                                                            <div v-if="income.description"
                                                                class="text-body-2 text-medium-emphasis">
                                                                {{ income.description }}
                                                            </div>
                                                        </VListItemTitle>
                                                        <VListItemSubtitle>
                                                            <VChip color="success" variant="tonal" size="small">
                                                                {{ income.category || 'Venta' }}
                                                            </VChip>
                                                        </VListItemSubtitle>
                                                        <template #append>
                                                            <div class="text-right">
                                                                <div class="text-success font-weight-bold mb-1">
                                                                    +{{ formatCurrency(income.total_amount) }}
                                                                </div>
                                                                <div class="d-flex gap-1">
                                                                    <VBtn color="primary" variant="tonal" size="x-small"
                                                                        icon="ri-edit-line"
                                                                        @click="openEditCashFlowDialog(income)" />
                                                                    <VBtn color="error" variant="tonal" size="x-small"
                                                                        icon="ri-delete-bin-line"
                                                                        @click="openDeleteCashFlowDialog(income)" />
                                                                </div>
                                                            </div>
                                                        </template>
                                                    </VListItem>
                                                </VList>
                                            </VCard>
                                        </div>
                                    </div>
                                    <div v-else class="text-center py-8 empty-state">
                                        <VIcon icon="ri-arrow-down-circle-line" size="48" color="disabled" />
                                        <p class="mt-2 text-h6">No hay ingresos aun</p>
                                        <p class="text-body-2 text-medium-emphasis">No se han registrado ingresos para
                                            el día de hoy</p>
                                    </div>
                                </div>
                            </VWindowItem>

                            <!-- Tab de Egresos -->
                            <VWindowItem value="expenses">
                                <div class="mb-3">
                                    <div class="d-flex align-center justify-space-between mb-2">
                                        <h3 class="text-h6 font-weight-bold">Egresos Recientes</h3>
                                        <VBtn color="error" variant="tonal" size="small" prepend-icon="ri-add-line"
                                            @click="openAddCashFlowDialog('expense')">
                                            Nuevo Egreso
                                        </VBtn>
                                    </div>
                                    <div v-if="groupedByDay && groupedByDay.length > 0">
                                        <div v-for="day in groupedByDay" :key="day.date">
                                            <VCard v-if="day.expenses && day.expenses.length > 0" variant="outlined"
                                                class="mb-3">
                                                <VCardSubtitle class="d-flex align-center justify-space-between pa-3">
                                                    <div class="d-flex align-center">
                                                        <VIcon icon="ri-calendar-line" size="20" class="me-2" />
                                                        <span class="text-body-2 font-weight-bold">{{ day.date }}</span>
                                                    </div>
                                                    <div class="text-error font-weight-bold">
                                                        {{ formatCurrency(day.totalExpenses) }}
                                                    </div>
                                                </VCardSubtitle>
                                                <VDivider />
                                                <VList density="compact">
                                                    <VListItem v-for="expense in day.expenses" :key="expense.id">
                                                        <template #prepend>
                                                            <VIcon icon="ri-arrow-up-circle-line text-error"
                                                                size="20" />
                                                        </template>
                                                        <VListItemTitle>
                                                            <div v-if="expense.order_number"
                                                                class="font-weight-bold text-body-2">
                                                                {{ expense.order_number }}
                                                            </div>
                                                            <div v-if="expense.description"
                                                                class="text-body-2 text-medium-emphasis">
                                                                {{ expense.description }}
                                                            </div>
                                                        </VListItemTitle>
                                                        <VListItemSubtitle>
                                                            <VChip :color="getCategoryColor(expense.category)"
                                                                size="small" class="mb-1">
                                                                {{ expense.category || 'Compra' }}
                                                            </VChip>
                                                        </VListItemSubtitle>
                                                        <template #append>
                                                            <div class="text-right">
                                                                <div class="text-error font-weight-bold mb-1">
                                                                    -{{ formatCurrency(expense.total_amount) }}
                                                                </div>
                                                                <div class="d-flex gap-1">
                                                                    <VBtn color="primary" variant="tonal" size="x-small"
                                                                        icon="ri-edit-line"
                                                                        @click="openEditCashFlowDialog(expense)" />
                                                                    <VBtn color="error" variant="tonal" size="x-small"
                                                                        icon="ri-delete-bin-line"
                                                                        @click="openDeleteCashFlowDialog(expense)" />
                                                                </div>
                                                            </div>
                                                        </template>
                                                    </VListItem>
                                                </VList>
                                            </VCard>
                                        </div>
                                    </div>
                                    <div v-else class="text-center py-8 empty-state">
                                        <VIcon icon="ri-arrow-up-circle-line" size="48" color="disabled" />
                                        <p class="mt-2 text-h6">No hay egresos aun</p>
                                        <p class="text-body-2 text-medium-emphasis">No se han registrado egresos para
                                            el día de hoy</p>
                                    </div>
                                </div>
                            </VWindowItem>
                        </VWindow>
                    </VCardText>
                </VCard>
            </VCol>
        </VRow>
    </div>

    <!-- Diálogos de Flujo de Caja -->
    <DailyCashFlowAddDialog v-if="isAddCashFlowDialogVisible" v-model="isAddCashFlowDialogVisible"
        :flow-type="selectedFlowType" @success="(data) => onCashFlowSuccess('add', data)" />

    <DailyCashFlowEditDialog v-if="isEditCashFlowDialogVisible" v-model="isEditCashFlowDialogVisible"
        :flow-data="selectedCashFlow" @success="(data) => onCashFlowSuccess('edit', data)" />

    <DailyCashFlowDeleteDialog v-if="isDeleteCashFlowDialogVisible" v-model="isDeleteCashFlowDialogVisible"
        :flow-data="selectedCashFlow" @success="() => onCashFlowSuccess('delete')" />
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
