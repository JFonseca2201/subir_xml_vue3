<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import IncomeDialog from '@/components/inventory/finances-records/IncomeDialog.vue'
import ExpenseDialog from '@/components/inventory/finances-records/ExpenseDialog.vue'

// Temporal inline notification function
const showNotification = (message, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`)
    // TODO: Replace with proper import when server restarts
}

// Estado del diálogo
const showIncomeDialog = ref(false)
const showExpenseDialog = ref(false)
const loading = ref(false)

// Datos reactivos
const movements = ref([])
const editingMovement = ref(null)

// Computados
const totals = computed(() => {
    const income = movements.value.filter(m => m.type === 0).reduce((acc, m) => acc + parseFloat(m.amount), 0)
    const expenses = movements.value.filter(m => m.type === 1).reduce((acc, m) => acc + parseFloat(m.amount), 0)
    return {
        income,
        expenses,
        balance: income - expenses
    }
})

// Agrupar movimientos por día
const groupedMovements = computed(() => {
    const groups = {}

    movements.value.forEach(movement => {
        const date = movement.entry_date
        if (!groups[date]) {
            groups[date] = {
                date: date,
                movements: [],
                dailyIncome: 0,
                dailyExpenses: 0,
                dailyBalance: 0
            }
        }

        groups[date].movements.push(movement)

        if (movement.type === 0) {
            groups[date].dailyIncome += parseFloat(movement.amount)
        } else {
            groups[date].dailyExpenses += parseFloat(movement.amount)
        }

        groups[date].dailyBalance = groups[date].dailyIncome - groups[date].dailyExpenses
    })

    // Ordenar fechas descendente
    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date))
})

// Funciones
const formatDate = (date) => {
    if (!date) return 'N/A'

    try {
        // Extraer día directamente del string para evitar problemas de timezone
        if (typeof date === 'string' && date.includes('-')) {
            const dateParts = date.split('T')[0] // Tomar solo la parte YYYY-MM-DD
            const [year, month, day] = dateParts.split('-')

            if (year && month && day) {
                // Formatear directamente sin conversión a Date
                return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
            }
        }

        // Fallback a conversión normal
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

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value)
}

const openIncomeDialog = () => {
    editingMovement.value = null
    showIncomeDialog.value = true
}

const openExpenseDialog = () => {
    editingMovement.value = null
    showExpenseDialog.value = true
}

const editMovement = (movement) => {
    editingMovement.value = movement
    if (movement.type === 0) {
        showIncomeDialog.value = true
    } else {
        showExpenseDialog.value = true
    }
}

const closeIncomeDialog = () => {
    showIncomeDialog.value = false
    editingMovement.value = null
}

const closeExpenseDialog = () => {
    showExpenseDialog.value = false
    editingMovement.value = null
}

const saveIncome = async (payload) => {
    try {
        const data = {
            ...payload,
            type: 0
        }

        if (editingMovement.value) {
            await $api(`finance-records/${editingMovement.value.id}`, {
                method: 'PUT',
                body: data
            })
            showNotification('Ingreso actualizado exitosamente', 'success')
        } else {
            await $api('finance-records', {
                method: 'POST',
                body: data
            })
            showNotification('Ingreso creado exitosamente', 'success')
        }

        await loadMovements()
        closeIncomeDialog()
    } catch (error) {
        console.error('Error al guardar ingreso:', error)
        showNotification('Error al guardar ingreso', 'error')
    }
}

const saveExpense = async (payload) => {
    try {
        const data = {
            ...payload,
            type: 1
        }

        if (editingMovement.value) {
            await $api(`finance-records/${editingMovement.value.id}`, {
                method: 'PUT',
                body: data
            })
            showNotification('Egreso actualizado exitosamente', 'success')
        } else {
            await $api('finance-records', {
                method: 'POST',
                body: data
            })
            showNotification('Egreso creado exitosamente', 'success')
        }

        await loadMovements()
        closeExpenseDialog()
    } catch (error) {
        console.error('Error al guardar egreso:', error)
        showNotification('Error al guardar egreso', 'error')
    }
}

const loadMovements = async () => {
    loading.value = true
    try {
        const response = await $api('finance-records')
        console.log('API Response:', response)

        // Asegurar que movements.value sea siempre un array
        movements.value = Array.isArray(response) ? response : (response?.data || [])
        console.log('Movements loaded:', movements.value)
    } catch (error) {
        console.error('Error al cargar movimientos:', error)
        showNotification('Error al cargar movimientos', 'error')
        movements.value = [] // Asegurar array vacío en caso de error
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    loadMovements()
})

</script>
<template>
    <div>
        <!-- Header -->
        <div class="d-flex justify-space-between align-center mb-6">
            <div>
                <h2 class="text-h4 font-weight-bold">Gestión de Ingresos y Egresos</h2>
                <p class="text-medium-emphasis mb-0">Control financiero de movimientos</p>
            </div>
            <div class="d-flex gap-3">
                <VBtn color="success" prepend-icon="ri-add-circle-line" @click="openIncomeDialog">
                    Nuevo Ingreso
                </VBtn>
                <VBtn color="error" prepend-icon="ri-subtract-line" @click="openExpenseDialog">
                    Nuevo Egreso
                </VBtn>
            </div>
        </div>

        <!-- Summary Cards -->
        <VRow class="mb-6">
            <VCol cols="12" md="4">
                <VCard class="bg-green-lighten-4 rounded-lg pa-4 h-100">
                    <VCardItem>
                        <VCardTitle class="d-flex align-center gap-3 mb-3">
                            <VIcon size="32">ri-arrow-up-circle-line</VIcon>
                            <div>
                                <h3 class="text-h5 font-weight-bold mb-1">Total Ingresos</h3>
                                <p class="text-medium-emphasis text-body-2 mb-0">Suma de todos los ingresos</p>
                            </div>
                        </VCardTitle>
                        <VCardText class="text-h4 font-weight-bold text-success">
                            {{ formatCurrency(totals.income) }}
                        </VCardText>
                    </VCardItem>
                </VCard>
            </VCol>

            <VCol cols="12" md="4">
                <VCard class="bg-red-lighten-4 rounded-lg pa-4 h-100">
                    <VCardItem>
                        <VCardTitle class="d-flex align-center gap-3 mb-3">
                            <VIcon size="32">ri-arrow-down-circle-line</VIcon>
                            <div>
                                <h3 class="text-h5 font-weight-bold mb-1">Total Egresos</h3>
                                <p class="text-medium-emphasis text-body-2 mb-0">Suma de todos los egresos</p>
                            </div>
                        </VCardTitle>
                        <VCardText class="text-h4 font-weight-bold text-error">
                            {{ formatCurrency(totals.expenses) }}
                        </VCardText>
                    </VCardItem>
                </VCard>
            </VCol>

            <VCol cols="12" md="4">
                <VCard class="bg-blue-lighten-4 rounded-lg pa-4 h-100">
                    <VCardItem>
                        <VCardTitle class="d-flex align-center gap-3 mb-3">
                            <VIcon size="32">ri-funds-line</VIcon>
                            <div>
                                <h3 class="text-h5 font-weight-bold mb-1">Balance Neto</h3>
                                <p class="text-medium-emphasis text-body-2 mb-0">Diferencia entre ingresos y egresos</p>
                            </div>
                        </VCardTitle>
                        <VCardText class="text-h4 font-weight-bold"
                            :class="totals.balance >= 0 ? 'text-primary' : 'text-warning'">
                            {{ formatCurrency(totals.balance) }}
                        </VCardText>
                    </VCardItem>
                </VCard>
            </VCol>
        </VRow>

        <!-- Tabla de Movimientos -->
        <VCard class="rounded-lg elevation-4">
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-exchange-line" />
                    <span class="text-h6 font-weight-medium">Movimientos Recientes</span>
                </div>
            </VCardTitle>
            <VDivider />
            <VCardText class="pa-0">
                <!-- Loading State -->
                <div v-if="loading" class="d-flex justify-center pa-12">
                    <VProgressCircular indeterminate color="primary" size="48" />
                </div>

                <!-- Tabla con Vuetify agrupada por día -->
                <div v-else class="movement-table">
                    <template v-for="group in groupedMovements" :key="group.date">
                        <!-- Encabezado del día con totales -->
                        <div class="day-header bg-light-grey-lighten-4 pa-3 mb-2 rounded-lg">
                            <div class="d-flex justify-space-between align-center">
                                <div class="d-flex align-center gap-3">
                                    <VIcon size="20" color="primary">ri-calendar-2-line</VIcon>
                                    <span class="text-h6 font-weight-bold">{{ formatDate(group.date) }}</span>
                                </div>
                                <div class="d-flex gap-4">
                                    <div class="text-center">
                                        <span class="text-caption text-medium-emphasis">Ingresos</span>
                                        <div class="text-success font-weight-bold">{{ formatCurrency(group.dailyIncome)
                                            }}</div>
                                    </div>
                                    <div class="text-center">
                                        <span class="text-caption text-medium-emphasis">Egresos</span>
                                        <div class="text-error font-weight-bold">{{ formatCurrency(group.dailyExpenses)
                                            }}</div>
                                    </div>
                                    <div class="text-center">
                                        <span class="text-caption text-medium-emphasis">Balance</span>
                                        <div class="font-weight-bold"
                                            :class="group.dailyBalance >= 0 ? 'text-primary' : 'text-warning'">
                                            {{ formatCurrency(group.dailyBalance) }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tabla de movimientos del día -->
                        <VTable class="day-table mb-6">
                            <thead>
                                <tr>
                                    <th class="text-left" style="width: 20px;">ID</th>
                                    <th class="text-left" style="width: 100px;">Orden</th>
                                    <th class="text-left" style="width: 80px;">Tipo</th>
                                    <th class="text-left" style="min-width: 80px;">Concepto</th>
                                    <th class="text-left" style="width: 100px;">Tipo</th>
                                    <th class="text-right" style="width: 140px;">Monto</th>
                                    <th class="text-center" style="width: 80px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody style="text-transform:uppercase">
                                <tr v-for="movement in group.movements" :key="movement.id"
                                    class="hover:bg-grey-lighten-4">
                                    <td>
                                        <VChip size="small" variant="tonal" color="grey-lighten-1">
                                            {{ movement.id }}
                                        </VChip>
                                    </td>
                                    <td>
                                        {{ movement.type === 0 ? ('OT-' + movement.work_order_number || '-') :
                                            ('G-' + movement.invoice_number || '-') }}
                                    </td>
                                    <td>
                                        <VChip :color="movement.type === 0 ? 'success' : 'error'" variant="tonal"
                                            size="small">
                                            <VIcon start>
                                                {{ movement.type === 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line' }}
                                            </VIcon>
                                            {{ movement.type === 0 ? 'INGRESO' : 'EGRESO' }}
                                        </VChip>
                                    </td>
                                    <td>
                                        <div class="d-flex flex-column">
                                            <span class="font-weight-medium">{{ movement.description }}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="d-flex flex-column align-left">
                                            <div class="d-flex align-left">
                                                <VIcon start size="16">
                                                    {{ movement.payment_method === 'transfer' ? 'ri-bank-line' :
                                                        'ri-money-dollar-circle-line' }}
                                                </VIcon>
                                                <span class="font-weight-medium">
                                                    {{ movement.payment_method === 'transfer' ? 'Transferencia' :
                                                        'Efectivo' }}
                                                </span>
                                            </div>
                                            <span class="text-medium-emphasis text-sm">{{ movement.account_label
                                                }}</span>
                                        </div>
                                    </td>
                                    <td class="text-right">
                                        <span class="font-weight-bold text-h6"
                                            :class="movement.type === 0 ? 'text-success' : 'text-error'">
                                            {{ movement.type === 0 ? '+' : '-' }} {{ formatCurrency(movement.amount) }}
                                        </span>
                                    </td>

                                    <td class="text-center">
                                        <VBtn icon="ri-edit-line" variant="text" size="small" color="primary"
                                            @click="editMovement(movement)" title="Editar movimiento" />
                                    </td>
                                </tr>
                            </tbody>
                        </VTable>
                    </template>
                </div>

                <!-- Empty State -->
                <div v-if="!loading && movements.length === 0" class="text-center pa-12">
                    <VIcon size="64" color="medium-emphasis" class="mb-4">ri-inbox-line</VIcon>
                    <h3 class="text-h5 mb-2">No hay movimientos registrados</h3>
                    <p class="text-medium-emphasis">Comienza registrando tu primer ingreso o egreso</p>
                </div>
            </VCardText>
        </VCard>

        <!-- Diálogo de Ingreso -->
        <IncomeDialog v-model="showIncomeDialog" :editing-movement="editingMovement" @saved="saveIncome" />

        <!-- Diálogo de Egreso -->
        <ExpenseDialog v-model="showExpenseDialog" :editing-movement="editingMovement" @saved="saveExpense" />
    </div>
</template>

<style scoped>
.bg-green-lighten-4 {
    background-color: rgba(76, 175, 80, 0.1) !important;
}

.bg-red-lighten-4 {
    background-color: rgba(244, 67, 54, 0.1) !important;
}

.bg-blue-lighten-4 {
    background-color: rgba(33, 150, 243, 0.1) !important;
}

.movement-table {
    border-radius: 12px;
    overflow: hidden;
}

.movement-table th {
    background-color: #f8f9fa;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.025em;
}

.movement-table td {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.movement-table tr:hover td {
    background-color: #f8f9fa;
}

.day-header {
    border: 1px solid rgba(0, 0, 0, 0.08);
    margin-bottom: 16px;
}

.day-table {
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.day-table th {
    background-color: #f5f5f5;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.025em;
}

.day-table td {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.day-table tr:hover td {
    background-color: #f8f9fa;
}
</style>
