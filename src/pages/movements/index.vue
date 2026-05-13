<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import IncomeDialog from '@/components/inventory/finances-records/IncomeDialog.vue'
import ExpenseDialog from '@/components/inventory/finances-records/ExpenseDialog.vue'
import DeleteDialog from '@/components/inventory/finances-records/DeleteDialog.vue'
import GroupedMovementsTable from '@/components/inventory/finances-records/GroupedMovementsTable.vue'

// Composable instances
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Estado del diálogo
const showIncomeDialog = ref(false)
const showExpenseDialog = ref(false)

// Datos reactivos
const movements = ref([])
const editingMovement = ref(null)
const showDeleteDialog = ref(false)
const movementToDelete = ref(null)

// Filtrar movimientos
const incomeMovements = computed(() => {
    return movements.value.filter(m => m.type === 0)
})

const expenseMovements = computed(() => {
    return movements.value.filter(m => m.type === 1)
})

// Computados
const totals = computed(() => {
    const income = incomeMovements.value.reduce((acc, m) => acc + parseFloat(m.amount), 0)
    const expenses = expenseMovements.value.reduce((acc, m) => acc + parseFloat(m.amount), 0)
    return {
        income,
        expenses,
        balance: income - expenses
    }
})

// Agrupar movimientos por día (ambos ingresos y egresos)
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
    // Asegurarse de pasar las distribuciones de pago bajo el nombre correcto
    let movementForEdit = { ...movement }
    // Compatibilidad: si viene como paymentDistributions (camelCase) o payment_distributions (snake_case)
    if (movement.paymentDistributions) {
        movementForEdit.payment_distributions = movement.paymentDistributions
    }
    // Si no existe payment_distributions pero sí paymentDistributions, igualar
    if (!movementForEdit.payment_distributions && movement.payment_distributions) {
        movementForEdit.payment_distributions = movement.payment_distributions
    }
    editingMovement.value = movementForEdit
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

const deleteMovement = (movement) => {
    movementToDelete.value = movement
    showDeleteDialog.value = true
}

const confirmDelete = async () => {
    try {
        await $api(`finance-records/${movementToDelete.value.id}`, {
            method: 'DELETE'
        })

        showNotification(`${movementToDelete.value.type === 0 ? 'Ingreso' : 'Egreso'} eliminado exitosamente`, 'success')

        // Eliminar dinámicamente el movimiento
        const index = movements.value.findIndex(m => m.id === movementToDelete.value.id)
        if (index !== -1) {
            movements.value.splice(index, 1)
        }

        closeDeleteDialog()
    } catch (error) {
        console.error('Error al eliminar movimiento:', error)
        showNotification('Error al eliminar movimiento', 'error')
    }
}

const closeDeleteDialog = () => {
    showDeleteDialog.value = false
    movementToDelete.value = null
}

const saveIncome = async (data) => {
    try {
        if (editingMovement.value) {
            const response = await $api(`finance-records/${editingMovement.value.id}`, {
                method: 'PUT',
                body: data
            })
            showNotification('Ingreso actualizado exitosamente', 'success')

            // Actualizar dinámicamente el movimiento editado
            if (response?.data) {
                console.log('Updated movement data:', response.data)
                const index = movements.value.findIndex(m => m.id === editingMovement.value.id)
                console.log('Movement index found:', index)
                console.log('Old movement amount:', movements.value[index]?.amount)
                console.log('New movement amount:', response.data.amount)
                if (index !== -1) {
                    movements.value[index] = response.data
                    console.log('Movement updated in list, new amount:', movements.value[index].amount)
                }
            }
        } else {
            const response = await $api('finance-records', {
                method: 'POST',
                body: data
            })
            showNotification('Ingreso creado exitosamente', 'success')

            // Añadir dinámicamente el nuevo movimiento
            if (response?.data) {
                const newMovements = Array.isArray(response.data) ? response.data : [response.data]
                movements.value.unshift(...newMovements)
            }
        }

        closeIncomeDialog()
    } catch (error) {
        console.error('Error al guardar ingreso:', error)
        showNotification('Error al guardar ingreso', 'error')
    }
}

const saveExpense = async (data) => {
    try {
        if (editingMovement.value) {
            const response = await $api(`finance-records/${editingMovement.value.id}`, {
                method: 'PUT',
                body: data
            })
            showNotification('Egreso actualizado exitosamente', 'success')

            // Actualizar dinámicamente el movimiento editado
            if (response?.data) {
                const index = movements.value.findIndex(m => m.id === editingMovement.value.id)
                if (index !== -1) {
                    movements.value[index] = response.data
                }
            }
        } else {
            const response = await $api('finance-records', {
                method: 'POST',
                body: data
            })
            showNotification('Egreso creado exitosamente', 'success')

            // Añadir dinámicamente el nuevo movimiento
            if (response?.data) {
                const newMovements = Array.isArray(response.data) ? response.data : [response.data]
                movements.value.unshift(...newMovements)
            }
        }

        closeExpenseDialog()
    } catch (error) {
        console.error('Error al guardar egreso:', error)
        showNotification('Error al guardar egreso', 'error')
    }
}

const handleMovementDeleted = (movementId) => {
    console.log('Movement deleted:', movementId)
    // Eliminar dinámicamente el movimiento
    const index = movements.value.findIndex(m => m.id === movementId)
    if (index !== -1) {
        movements.value.splice(index, 1)
    }
}

const loadMovements = async () => {
    loader.start()
    try {
        const response = await $api('finance-records')
        console.log('API Response:', response)

        // Extraer el array de la propiedad data
        movements.value = response?.data || []
        console.log('Movements loaded:', movements.value)
    } catch (error) {
        console.error('Error al cargar movimientos:', error)
        showNotification('Error al cargar movimientos', 'error')
        movements.value = [] // Asegurar array vacío en caso de error
    } finally {
        loader.stop()
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


        <!-- Movimientos Agrupados por Día -->
        <div v-if="!loader.loading && groupedMovements.length > 0">
            <VCard v-for="day in groupedMovements" :key="day.date" class="mb-6">
                <VCardTitle class="pa-4 bg-grey-lighten-4">
                    <div class="d-flex justify-space-between align-center">
                        <div>
                            <h3 class="text-h6 font-weight-medium">{{ formatDate(day.date) }}</h3>
                            <p class="text-medium-emphasis text-body-2 mb-0">
                                {{ day.movements.length }} movimiento{{ day.movements.length !== 1 ? 's' : '' }}
                            </p>
                        </div>
                        <div class="text-end">
                            <div class="text-success text-body-2">
                                Ingresos: +{{ formatCurrency(day.dailyIncome) }}
                            </div>
                            <div class="text-error text-body-2">
                                Egresos: -{{ formatCurrency(day.dailyExpenses) }}
                            </div>
                            <div class="font-weight-bold"
                                :class="day.dailyBalance >= 0 ? 'text-primary' : 'text-warning'">
                                Balance: {{ formatCurrency(day.dailyBalance) }}
                            </div>
                        </div>
                    </div>
                </VCardTitle>
                <VDivider />
                <VCardText class="pa-0">
                    <VTable class="day-table">
                        <thead>
                            <tr>
                                <th>OT/FACT</th>
                                <th>Tipo</th>
                                <th>Descripción</th>
                                <th>Monto</th>
                                <th>Cuenta</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="movement in day.movements" :key="movement.id">
                                <td>
                                    {{ movement.work_order_number || movement.invoice_number }}
                                </td>
                                <td>
                                    <VChip :color="movement.type === 0 ? 'success' : 'error'" variant="tonal"
                                        size="small">
                                        {{ movement.type === 0 ? 'INGRESO' : 'EGRESO' }}
                                    </VChip>
                                </td>
                                <td>{{ movement.description }}</td>
                                <!-- Mostrar siempre el monto total -->
                                <td :class="movement.type === 0 ? 'text-success' : 'text-error'"
                                    class="font-weight-bold">
                                    {{ movement.type === 0 ? '+' : '-' }}{{ formatCurrency(movement.amount) }}
                                </td>
                                <!-- Mostrar cuenta principal o resumen de cuentas -->
                                <td>
                                    <span
                                        v-if="movement.payment_distributions && movement.payment_distributions.length > 1">
                                        {{ movement.payment_distributions.length }} cuentas
                                    </span>
                                    <span v-else>
                                        {{ movement.account_label || movement.account_id }}
                                    </span>
                                </td>
                                <td>
                                    <VBtn size="small" variant="text" color="primary" @click="editMovement(movement)">
                                        <VIcon size="20">ri-edit-line</VIcon>
                                    </VBtn>
                                    <VBtn size="small" variant="text" color="error" @click="deleteMovement(movement)">
                                        <VIcon size="20">ri-delete-bin-line</VIcon>
                                    </VBtn>
                                </td>
                            </tr>
                        </tbody>
                    </VTable>
                </VCardText>
            </VCard>
        </div>

        <!-- Empty State -->
        <div v-if="!loader.loading && incomeMovements.length === 0 && expenseMovements.length === 0"
            class="text-center pa-12">
            <VIcon size="64" color="medium-emphasis" class="mb-4">ri-inbox-line</VIcon>
            <h3 class="text-h5 mb-2">No hay movimientos registrados</h3>
            <p class="text-medium-emphasis">Comienza registrando tu primer ingreso o egreso</p>
        </div>
        <div v-if="!loader.loading && incomeMovements.length === 0 && expenseMovements.length === 0"
            class="text-center pa-12">
            <VIcon size="64" color="medium-emphasis" class="mb-4">ri-inbox-line</VIcon>
            <h3 class="text-h5 mb-2">No hay movimientos registrados</h3>
            <p class="text-medium-emphasis">Comienza registrando tu primer ingreso o egreso</p>
        </div>

        <!-- Diálogo de Ingreso -->
        <IncomeDialog v-model="showIncomeDialog" :editing-movement="editingMovement" @saved="saveIncome" />

        <!-- Diálogo de Egreso -->
        <ExpenseDialog v-model="showExpenseDialog" :editing-movement="editingMovement" @saved="saveExpense" />

        <!-- Delete Dialog -->
        <DeleteDialog v-model="showDeleteDialog" :movement="movementToDelete" @confirm="confirmDelete" />
    </div>
</template>
