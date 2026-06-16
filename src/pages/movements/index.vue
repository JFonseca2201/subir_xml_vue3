<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import IncomeDialog from '@/components/inventory/finances-records/IncomeDialog.vue'
import ExpenseDialog from '@/components/inventory/finances-records/ExpenseDialog.vue'
import DeleteDialog from '@/components/inventory/finances-records/DeleteDialog.vue'

// Composable instances
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Estado del diálogo
const showIncomeDialog = ref(false)
const showExpenseDialog = ref(false)

// Datos reactivos
const movements = ref([])
const accounts = ref([])
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

const isGeneratingPDF = ref(false)

const generatePDF = async () => {
    isGeneratingPDF.value = true
    try {
        const response = await $api('financial-movements/pdf', {
            method: 'POST',
            responseType: 'blob'
        })
        const blob = new Blob([response], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte_financiero_${new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        showNotification('Reporte PDF generado exitosamente', 'success')
    } catch (error) {
        console.error('Error al generar PDF:', error)
        showNotification('Error al generar el reporte PDF', 'error')
    } finally {
        isGeneratingPDF.value = false
    }
}

const generatingSingleId = ref(null)

const generateSinglePDF = async (movement) => {
    generatingSingleId.value = movement.id
    try {
        const response = await $api(`financial-movements/${movement.id}/pdf`, {
            method: 'GET',
            responseType: 'blob'
        })
        const blob = new Blob([response], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `comprobante_${movement.type === 0 ? 'ingreso' : 'egreso'}_${movement.id}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        showNotification('Comprobante PDF generado exitosamente', 'success')
    } catch (error) {
        console.error('Error al generar PDF individual:', error)
        showNotification('Error al generar el comprobante PDF', 'error')
    } finally {
        generatingSingleId.value = null
    }
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

const loadAccounts = async () => {
    try {
        const response = await $api('accounts')
        accounts.value = response || []
    } catch (error) {
        console.error('Error al cargar cuentas:', error)
    }
}

const getAccountName = (movement) => {
    if (movement.payment_distributions && movement.payment_distributions.length > 1) {
        return `${movement.payment_distributions.length} cuentas`
    }

    let accountId = movement.account_id
    if (movement.payment_distributions && movement.payment_distributions.length === 1) {
        accountId = movement.payment_distributions[0].account_id || movement.payment_distributions[0].account || accountId
    }

    if (accountId) {
        const account = accounts.value.find(acc => String(acc.id) === String(accountId))
        if (account) {
            return account.name || account.account_name || account.description || `Cuenta ${accountId}`
        }
    }

    return movement.account_label || movement.account_name || accountId || 'Desconocida'
}

onMounted(() => {
    loadAccounts()
    loadMovements()
})

</script>
<template>
    <div class="pa-4 pa-sm-6">
        <!-- Cabecera Estandarizada -->
        <VRow class="mb-4 mt-2">
            <VCol>
                <div class="d-flex align-center justify-space-between flex-wrap gap-4">
                    <div class="d-flex align-center gap-3">
                        <VAvatar color="primary" variant="tonal" rounded size="48">
                            <VIcon icon="ri-exchange-dollar-line" size="28" />
                        </VAvatar>
                        <div>
                            <h4 class="text-h5 font-weight-bold mb-1">Gestión de Ingresos y Egresos</h4>
                            <span class="text-body-2 text-medium-emphasis">Control financiero de movimientos</span>
                        </div>
                    </div>
                    <div class="d-flex gap-3">
                        <VBtn color="info" variant="elevated" prepend-icon="ri-file-pdf-line"
                            :loading="isGeneratingPDF"
                            @click="generatePDF">
                            Generar PDF
                        </VBtn>
                        <VBtn color="success" variant="elevated" prepend-icon="ri-add-circle-line"
                            @click="openIncomeDialog">
                            Nuevo Ingreso
                        </VBtn>
                        <VBtn color="error" variant="elevated" prepend-icon="ri-subtract-line"
                            @click="openExpenseDialog">
                            Nuevo Egreso
                        </VBtn>
                    </div>
                </div>
            </VCol>
        </VRow>

        <!-- Tarjetas de Resumen Estandarizadas -->
        <VRow class="mb-6">
            <VCol cols="12" md="4">
                <VCard elevation="2" class="rounded-lg h-100">
                    <VCardItem class="pa-4 border-b">
                        <template #title>
                            <div class="d-flex align-center gap-2">
                                <VIcon icon="ri-arrow-up-circle-line" color="success" />
                                <span class="font-weight-bold text-h6">Total Ingresos</span>
                            </div>
                        </template>
                    </VCardItem>
                    <VCardText class="pa-5">
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-body-1 text-medium-emphasis">Suma de ingresos</span>
                            <span class="text-h5 font-weight-black text-success">{{ formatCurrency(totals.income)
                                }}</span>
                        </div>
                    </VCardText>
                </VCard>
            </VCol>

            <VCol cols="12" md="4">
                <VCard elevation="2" class="rounded-lg h-100">
                    <VCardItem class="pa-4 border-b">
                        <template #title>
                            <div class="d-flex align-center gap-2">
                                <VIcon icon="ri-arrow-down-circle-line" color="error" />
                                <span class="font-weight-bold text-h6">Total Egresos</span>
                            </div>
                        </template>
                    </VCardItem>
                    <VCardText class="pa-5">
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-body-1 text-medium-emphasis">Suma de egresos</span>
                            <span class="text-h5 font-weight-black text-error">{{ formatCurrency(totals.expenses)
                                }}</span>
                        </div>
                    </VCardText>
                </VCard>
            </VCol>

            <VCol cols="12" md="4">
                <VCard elevation="2" class="rounded-lg h-100">
                    <VCardItem class="pa-4 border-b">
                        <template #title>
                            <div class="d-flex align-center gap-2">
                                <VIcon icon="ri-funds-line" color="primary" />
                                <span class="font-weight-bold text-h6">Balance Neto</span>
                            </div>
                        </template>
                    </VCardItem>
                    <VCardText class="pa-5">
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-body-1 text-medium-emphasis">Diferencia neta</span>
                            <span class="text-h5 font-weight-black"
                                :class="totals.balance >= 0 ? 'text-primary' : 'text-warning'">{{
                                    formatCurrency(totals.balance)
                                }}</span>
                        </div>
                    </VCardText>
                </VCard>
            </VCol>
        </VRow>

        <!-- Estado de carga -->
        <div v-if="loader.loading" class="text-center pa-12">
            <VProgressCircular indeterminate color="primary" size="48" width="4" />
        </div>

        <!-- Movimientos Agrupados por Día -->
        <div v-else-if="groupedMovements.length > 0">
            <VCard v-for="day in groupedMovements" :key="day.date" class="mb-6 rounded-lg elevation-2">
                <VCardTitle class="pa-4">
                    <div class="d-flex justify-space-between align-center flex-wrap gap-2">
                        <div class="d-flex align-center gap-2">
                            <VIcon icon="ri-calendar-event-line" color="primary" />
                            <h3 class="text-h6 font-weight-bold text-primary">{{ formatDate(day.date) }}</h3>
                            <VChip size="small" variant="tonal" color="secondary" class="ml-2 font-weight-bold">
                                {{ day.movements.length }} mov{{ day.movements.length !== 1 ? 's' : '' }}
                            </VChip>
                        </div>
                        <div class="d-flex gap-4">
                            <span class="text-success text-body-2 font-weight-bold">Ingresos: +{{
                                formatCurrency(day.dailyIncome) }}</span>
                            <span class="text-error text-body-2 font-weight-bold">Egresos: -{{
                                formatCurrency(day.dailyExpenses)
                                }}</span>
                            <VChip size="small" :color="day.dailyBalance >= 0 ? 'primary' : 'warning'" variant="tonal"
                                class="font-weight-bold">
                                Balance: {{ formatCurrency(day.dailyBalance) }}
                            </VChip>
                        </div>
                    </div>
                </VCardTitle>
                <VDivider />
                <VCardText class="pa-0">
                    <VTable hover class="expense-table bg-transparent">
                        <thead>
                            <tr>
                                <th class="font-weight-bold">OT/FACT</th>
                                <th class="font-weight-bold">TIPO</th>
                                <th class="font-weight-bold">DESCRIPCIÓN</th>
                                <th class="font-weight-bold">CUENTA</th>
                                <th class="font-weight-bold text-end">MONTO</th>
                                <th class="font-weight-bold text-center">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="movement in day.movements" :key="movement.id" class="border-b">
                                <td class="font-weight-medium">
                                    {{ movement.work_order_number || movement.invoice_number || '-' }}
                                </td>
                                <td>
                                    <VChip :color="movement.type === 0 ? 'success' : 'error'" variant="tonal"
                                        size="small" class="font-weight-bold">
                                        <VIcon start size="14">{{ movement.type === 0 ? 'ri-arrow-up-circle-line' :
                                            'ri-arrow-down-circle-line' }}</VIcon>
                                        {{ movement.type === 0 ? 'INGRESO' : 'EGRESO' }}
                                    </VChip>
                                </td>
                                <td class="text-body-2">{{ movement.description }}</td>
                                <td>
                                    <div class="d-flex align-center gap-1 font-weight-medium">
                                        <VIcon size="16" color="primary">ri-bank-line</VIcon>
                                        {{ getAccountName(movement) }}
                                    </div>
                                </td>
                                <td class="font-weight-bold text-end"
                                    :class="movement.type === 0 ? 'text-success' : 'text-error'">
                                    {{ movement.type === 0 ? '+' : '-' }}{{ formatCurrency(movement.amount) }}
                                </td>
                                <td class="text-center">
                                    <div class="d-flex justify-center gap-1">
                                        <VBtn title="Comprobante PDF" size="small" variant="tonal" color="info"
                                            icon="ri-file-pdf-line" @click="generateSinglePDF(movement)"
                                            :loading="generatingSingleId === movement.id" />
                                        <VBtn title="Editar" size="small" variant="tonal" color="primary"
                                            icon="ri-edit-line" @click="editMovement(movement)" />
                                        <VBtn title="Eliminar" size="small" variant="tonal" color="error"
                                            icon="ri-delete-bin-line" @click="deleteMovement(movement)" />
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </VTable>
                </VCardText>
            </VCard>
        </div>

        <!-- Empty State -->
        <div v-if="!loader.loading && groupedMovements.length === 0" class="text-center pa-12">
            <VAvatar color="grey-lighten-3" size="72" class="mb-4">
                <VIcon icon="ri-inbox-line" size="36" color="grey" />
            </VAvatar>
            <h3 class="text-h6 font-weight-medium">No hay movimientos registrados</h3>
            <p class="text-body-2 mt-1 text-medium-emphasis">Comienza registrando tu primer ingreso o egreso</p>
        </div>

        <!-- Diálogo de Ingreso -->
        <IncomeDialog v-model="showIncomeDialog" :editing-movement="editingMovement" @saved="saveIncome" />

        <!-- Diálogo de Egreso -->
        <ExpenseDialog v-model="showExpenseDialog" :editing-movement="editingMovement" @saved="saveExpense" />

        <!-- Delete Dialog -->
        <DeleteDialog v-model="showDeleteDialog" :movement="movementToDelete" @confirm="confirmDelete" />
    </div>
</template>
