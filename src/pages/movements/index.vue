<script setup>
import { ref, onMounted, computed, watch } from 'vue'
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
const transfersList = ref([])
const accounts = ref([])
const editingMovement = ref(null)
const showDeleteDialog = ref(false)
const movementToDelete = ref(null)

// Búsqueda
const searchWorkOrder = ref('')
const searchStartDate = ref('')
const searchEndDate = ref('')

let searchTimeout = null
watch([searchWorkOrder, searchStartDate, searchEndDate], () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
        loadMovements()
        loadTransfers()
    }, 500)
})

// Filtrar movimientos por Ingreso / Egreso
const incomeMovements = computed(() => {
    return movements.value.filter(m => m.type === 0)
})

const expenseMovements = computed(() => {
    return movements.value.filter(m => m.type === 1)
})

// Total de transferencias acumulado
const totalTransfersAmount = computed(() => {
    return transfersList.value.reduce((acc, t) => acc + parseFloat(t.amount || 0), 0)
})

// Computados de totales generales
const totals = computed(() => {
    const income = incomeMovements.value.reduce((acc, m) => acc + parseFloat(m.amount || 0), 0)
    const expenses = expenseMovements.value.reduce((acc, m) => acc + parseFloat(m.amount || 0), 0)
    return {
        income,
        expenses,
        balance: income - expenses
    }
})

// Agrupar movimientos por día (ingresos y egresos)
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
            groups[date].dailyIncome += parseFloat(movement.amount || 0)
        } else {
            groups[date].dailyExpenses += parseFloat(movement.amount || 0)
        }

        groups[date].dailyBalance = groups[date].dailyIncome - groups[date].dailyExpenses
    })

    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date))
})

// Total de movimientos
const totalMovementsCount = computed(() => movements.value.length)

// Funciones de formato
const formatDate = (date) => {
    if (!date) return 'N/A'

    try {
        if (typeof date === 'string' && date.includes('-')) {
            const dateParts = date.split('T')[0]
            const [year, month, day] = dateParts.split('-')

            if (year && month && day) {
                return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
            }
        }

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

const formatDateHeader = dateStr => {
    if (!dateStr) return 'Movimientos'
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const todayObj = new Date()
        const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
        if (dateStr === today) return 'Hoy'

        const [year, month, day] = dateStr.split('-')
        const date = new Date(year, month - 1, day)

        return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            .replace(/^\w/, c => c.toUpperCase())
    }
    return formatDate(dateStr)
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value || 0)
}

const cleanAccountName = name => {
    if (!name) return 'N/A'
    return name
        .replace(/\(EFECTIVO\)/gi, '')
        .replace(/\(TRANSFERENCIA\)/gi, '')
        .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
        .trim()
}

// Determinar con precisión si el método de pago es TRANSFERENCIA o EFECTIVO
const getPaymentMethod = (movement, accountsList = []) => {
    const rawMethod = (
        movement.method ||
        movement.payment_method ||
        movement.metodo_pago ||
        movement.movable?.metodo_pago ||
        movement.movable?.payment_method ||
        movement.metadata?.metodo ||
        movement.metadata?.payment_method ||
        ''
    ).toString().toUpperCase()

    if (rawMethod.includes('TRANS') || rawMethod.includes('TRANSFER') || rawMethod.includes('BANCO') || rawMethod.includes('DEPOSITO')) {
        return 'TRANSFERENCIA'
    }

    let accountId = movement.account_id
    if (movement.payment_distributions && movement.payment_distributions.length > 0) {
        accountId = movement.payment_distributions[0].account_id || movement.payment_distributions[0].account || accountId
    }

    if (accountId && accountsList.length > 0) {
        const account = accountsList.find(acc => String(acc.id) === String(accountId))
        if (account) {
            const accType = (account.type || '').toLowerCase()
            const bankName = (account.bank_name || '').toLowerCase()
            const accName = (account.name || '').toLowerCase()

            if (accType === 'bank' || (bankName && !bankName.includes('efectivo') && !bankName.includes('caja'))) {
                return 'TRANSFERENCIA'
            }
            if (accName.includes('transferencia') || accName.includes('banco') || accName.includes('pichincha') || accName.includes('guayaquil') || accName.includes('produbanco') || accName.includes('pacifico')) {
                return 'TRANSFERENCIA'
            }
            if (accType === 'cash' || bankName.includes('efectivo') || bankName.includes('caja') || accName.includes('efectivo') || accName.includes('caja')) {
                return 'EFECTIVO'
            }
        }
    }

    const accLabel = (movement.account_name || movement.account_label || '').toLowerCase()
    if (accLabel.includes('transferencia') || accLabel.includes('banco') || accLabel.includes('pichincha') || accLabel.includes('guayaquil') || accLabel.includes('produbanco') || accLabel.includes('pacifico')) {
        return 'TRANSFERENCIA'
    }

    if (rawMethod === 'CASH') return 'EFECTIVO'

    return 'EFECTIVO'
}

const isGeneratingPDF = ref(false)

// Generar PDF DIRECTAMENTE EN EL BACKEND (Separado por tipo de movimiento)
const generatePDF = async () => {
    isGeneratingPDF.value = true
    try {
        const todayISO = new Date().toISOString().split('T')[0]
        const params = {
            group_by_type: true,
            separate_sections: true,
            include_transfers: true,
            include_incomes: true,
            include_expenses: true,
            search: searchWorkOrder.value || undefined,
            start_date: searchStartDate.value || undefined,
            end_date: searchEndDate.value || undefined,
        }

        let response
        try {
            response = await $api('financial-movements/pdf', {
                method: 'POST',
                body: params,
                responseType: 'blob'
            })
        } catch (postErr) {
            console.warn('POST a financial-movements/pdf falló, reintentando con GET:', postErr)
            response = await $api('financial-movements/pdf', {
                method: 'GET',
                params: params,
                responseType: 'blob'
            })
        }

        const blob = new Blob([response], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Reporte_Movimientos_${todayISO}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        showNotification('Reporte PDF (separado por tipos) generado exitosamente desde el servidor', 'success')
    } catch (error) {
        console.error('Error al generar PDF en el backend:', error)
        showNotification('Error al solicitar el reporte PDF al servidor.', 'error')
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
    let movementForEdit = { ...movement }
    if (movement.paymentDistributions) {
        movementForEdit.payment_distributions = movement.paymentDistributions
    }
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
            showNotification('Ingreso creado exitosamente', 'success')

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

const loadMovements = async () => {
    loader.start()
    try {
        const params = {}
        if (searchWorkOrder.value) {
            params.search = searchWorkOrder.value
        }
        if (searchStartDate.value) {
            params.start_date = searchStartDate.value
        }
        if (searchEndDate.value) {
            params.end_date = searchEndDate.value
        }

        const response = await $api('finance-records', {
            params
        })

        movements.value = response?.data || []
    } catch (error) {
        console.error('Error al cargar movimientos:', error)
        showNotification('Error al cargar movimientos', 'error')
        movements.value = []
    } finally {
        loader.stop()
    }
}

const loadTransfers = async () => {
    try {
        const response = await $api('transfers')
        let dataArray = []
        if (response?.data) {
            dataArray = response.data
        } else if (Array.isArray(response)) {
            dataArray = response
        }

        const flatTransfers = []
        dataArray.forEach(group => {
            const items = group.transfers || [group]
            items.forEach(t => flatTransfers.push(t))
        })

        transfersList.value = flatTransfers
    } catch (e) {
        console.error('Error al cargar transferencias:', e)
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
            const name = account.bank_name || account.name || account.account_name || account.description || `Cuenta ${accountId}`
            return cleanAccountName(name)
        }
    }

    const fallbackName = movement.account_label || movement.account_name || (accountId ? `Cuenta ${accountId}` : 'Desconocida')
    return cleanAccountName(fallbackName)
}

onMounted(() => {
    loadAccounts()
    loadMovements()
    loadTransfers()
})
</script>

<template>
    <div class="pa-4 pa-sm-6 movements-page">
        <!-- Header Principal -->
        <VCard class="mb-6 rounded-xl border-light pa-5 elevation-1">
            <div class="d-flex align-center justify-space-between flex-wrap gap-4">
                <div class="d-flex align-center gap-4">
                    <VAvatar color="primary" variant="tonal" rounded="lg" size="56" class="elevation-1">
                        <VIcon icon="ri-exchange-dollar-line" size="32" />
                    </VAvatar>
                    <div>
                        <div class="d-flex align-center gap-2">
                            <h1 class="text-h4 font-weight-bold text-high-emphasis mb-0">Ingresos y Egresos</h1>
                            <VChip size="small" color="primary" variant="tonal" class="font-weight-bold">
                                {{ totalMovementsCount }} {{ totalMovementsCount === 1 ? 'registro' : 'registros' }}
                            </VChip>
                        </div>
                        <p class="text-body-1 text-medium-emphasis mb-0 mt-1">
                            Administración financiera y control de movimientos de caja y cuentas
                        </p>
                    </div>
                </div>

                <div class="d-flex align-center gap-3 flex-wrap">
                    <VBtn color="secondary" variant="tonal" prepend-icon="ri-file-pdf-line" class="font-weight-semibold"
                        :loading="isGeneratingPDF" @click="generatePDF">
                        Exportar PDF
                    </VBtn>
                    <VBtn color="success" variant="elevated" prepend-icon="ri-add-circle-line"
                        class="font-weight-semibold elevation-2" @click="openIncomeDialog">
                        Nuevo Ingreso
                    </VBtn>
                    <VBtn color="error" variant="elevated" prepend-icon="ri-indeterminate-circle-line"
                        class="font-weight-semibold elevation-2" @click="openExpenseDialog">
                        Nuevo Egreso
                    </VBtn>
                </div>
            </div>
        </VCard>

        <!-- Tarjetas de Resumen KPI con colores tonales -->
        <VRow class="mb-6">
            <!-- Total Ingresos -->
            <VCol cols="12" sm="6" md="4">
                <VCard class="pa-5 rounded-xl tonal-card bg-success-tonal border-success" elevation="0">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <span class="text-overline font-weight-bold text-success text-uppercase tracking-wider">
                                Total Ingresos
                            </span>
                            <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                                {{ formatCurrency(totals.income) }}
                            </div>
                            <span class="text-caption text-medium-emphasis font-weight-medium">
                                Suma total de ingresos registrados
                            </span>
                        </div>
                        <VAvatar color="success" variant="elevated" size="52" class="elevation-3">
                            <VIcon size="28" icon="ri-arrow-right-up-line" color="white" />
                        </VAvatar>
                    </div>
                </VCard>
            </VCol>

            <!-- Total Egresos -->
            <VCol cols="12" sm="6" md="4">
                <VCard class="pa-5 rounded-xl tonal-card bg-error-tonal border-error" elevation="0">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <span class="text-overline font-weight-bold text-error text-uppercase tracking-wider">
                                Total Egresos
                            </span>
                            <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                                {{ formatCurrency(totals.expenses) }}
                            </div>
                            <span class="text-caption text-medium-emphasis font-weight-medium">
                                Suma total de egresos registrados
                            </span>
                        </div>
                        <VAvatar color="error" variant="elevated" size="52" class="elevation-3">
                            <VIcon size="28" icon="ri-arrow-right-down-line" color="white" />
                        </VAvatar>
                    </div>
                </VCard>
            </VCol>

            <!-- Balance Neto -->
            <VCol cols="12" sm="12" md="4">
                <VCard class="pa-5 rounded-xl tonal-card bg-primary-tonal border-primary" elevation="0">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <span class="text-overline font-weight-bold text-primary text-uppercase tracking-wider">
                                Balance Neto
                            </span>
                            <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                                {{ formatCurrency(totals.balance) }}
                            </div>
                            <span class="text-caption text-medium-emphasis font-weight-medium">
                                Diferencia Ingresos - Egresos
                            </span>
                        </div>
                        <VAvatar color="primary" variant="elevated" size="52" class="elevation-3">
                            <VIcon size="28" icon="ri-scales-3-line" color="white" />
                        </VAvatar>
                    </div>
                </VCard>
            </VCol>
        </VRow>

        <!-- Barra de Filtros de Búsqueda -->
        <VCard class="pa-4 mb-6 rounded-xl border-light elevation-1">
            <VRow align="center" density="comfortable">
                <VCol cols="12" md="4">
                    <VTextField v-model="searchWorkOrder" prepend-inner-icon="ri-search-2-line"
                        placeholder="Buscar por OT, Factura o descripción..." hide-details clearable variant="outlined"
                        density="compact" />
                </VCol>

                <VCol cols="12" sm="6" md="4">
                    <VTextField v-model="searchStartDate" type="date" label="Fecha Inicio"
                        prepend-inner-icon="ri-calendar-line" hide-details clearable variant="outlined"
                        density="compact" />
                </VCol>

                <VCol cols="12" sm="6" md="4">
                    <VTextField v-model="searchEndDate" type="date" label="Fecha Fin"
                        prepend-inner-icon="ri-calendar-line" hide-details clearable variant="outlined"
                        density="compact" />
                </VCol>
            </VRow>
        </VCard>

        <!-- Cargando -->
        <div v-if="loader.loading" class="text-center pa-12">
            <VProgressCircular indeterminate color="primary" size="54" width="4" />
            <div class="text-subtitle-1 mt-4 font-weight-medium text-medium-emphasis">
                Cargando movimientos...
            </div>
        </div>

        <!-- Sin registros -->
        <VCard v-else-if="groupedMovements.length === 0" class="text-center pa-12 rounded-xl border-light elevation-1">
            <VAvatar color="primary" variant="tonal" size="80" class="mb-4">
                <VIcon icon="ri-inbox-line" size="42" color="primary" />
            </VAvatar>
            <h3 class="text-h6 font-weight-bold text-high-emphasis">
                No hay movimientos para mostrar
            </h3>
            <p class="text-body-2 text-medium-emphasis max-w-md mx-auto mt-1 mb-6">
                Intenta ajustar los filtros de búsqueda o registra un nuevo ingreso o egreso.
            </p>
            <div class="d-flex justify-center gap-3">
                <VBtn color="success" variant="elevated" prepend-icon="ri-add-line" class="font-weight-semibold"
                    @click="openIncomeDialog">
                    Agregar Ingreso
                </VBtn>
                <VBtn color="error" variant="elevated" prepend-icon="ri-subtract-line" class="font-weight-semibold"
                    @click="openExpenseDialog">
                    Agregar Egreso
                </VBtn>
            </div>
        </VCard>

        <!-- Lista de Movimientos Unificada en una sola Card (sin sub-cards por día) -->
        <VCard v-else class="rounded-xl border-light overflow-hidden elevation-1 transfer-table-container">
            <VTable hover class="transfer-table text-no-wrap">
                <thead>
                    <tr>
                        <th class="text-left py-3" style="width: 140px;">
                            OT / FACTURA
                        </th>
                        <th class="text-left py-3" style="width: 140px;">
                            TIPO
                        </th>
                        <th class="text-left py-3">
                            DESCRIPCIÓN & FECHA
                        </th>
                        <th class="text-left py-3">
                            CUENTA & MÉTODO
                        </th>
                        <th class="text-right py-3" style="width: 160px;">
                            MONTO
                        </th>
                        <th class="text-center py-3" style="width: 140px;">
                            ACCIONES
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="day in groupedMovements" :key="day.date">
                        <!-- Fila de Encabezado por Fecha -->
                        <tr class="transfer-date-header-row">
                            <td colspan="6">
                                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                                    <div class="d-flex align-center gap-3">
                                        <VAvatar color="primary" variant="tonal" size="32" rounded="lg">
                                            <VIcon icon="ri-calendar-event-line" size="18" color="primary" />
                                        </VAvatar>
                                        <div class="d-flex align-center gap-2">
                                            <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
                                                {{ formatDateHeader(day.date) }}
                                            </span>
                                            <span class="text-caption text-medium-emphasis">
                                                • {{ day.movements.length }} {{ day.movements.length === 1 ?
                                                    'movimiento' : 'movimientos' }}
                                            </span>
                                        </div>
                                    </div>

                                    <div class="d-flex align-center gap-3 me-2">
                                        <span class="text-caption text-success font-weight-bold">
                                            Ingresos: +{{ formatCurrency(day.dailyIncome) }}
                                        </span>
                                        <span class="text-caption text-error font-weight-bold">
                                            Egresos: -{{ formatCurrency(day.dailyExpenses) }}
                                        </span>
                                        <VChip size="small" :color="day.dailyBalance >= 0 ? 'primary' : 'error'"
                                            variant="tonal" class="font-weight-bold px-3">
                                            Balance: {{ formatCurrency(day.dailyBalance) }}
                                        </VChip>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        <!-- Filas de Movimientos para ese día -->
                        <tr v-for="movement in day.movements" :key="movement.id" class="transfer-row">
                            <!-- OT / Factura -->
                            <td class="py-3">
                                <span class="text-body-2 font-weight-bold text-high-emphasis">
                                    {{ movement.work_order_number || movement.invoice_number || '-' }}
                                </span>
                            </td>

                            <!-- Tipo (Ingreso vs Egreso) con chips tonales -->
                            <td class="py-3">
                                <VChip :color="movement.type === 0 ? 'success' : 'error'" variant="tonal" size="small"
                                    class="font-weight-semibold">
                                    <VIcon start size="14"
                                        :icon="movement.type === 0 ? 'ri-arrow-up-circle-line' : 'ri-arrow-down-circle-line'" />
                                    {{ movement.type === 0 ? 'INGRESO' : 'EGRESO' }}
                                </VChip>
                            </td>

                            <!-- Descripción & Fecha -->
                            <td class="py-3">
                                <div class="d-flex flex-column">
                                    <span class="text-body-2 font-weight-medium text-high-emphasis">
                                        {{ movement.description || 'Sin descripción' }}
                                    </span>
                                    <span class="text-caption text-medium-emphasis">
                                        {{ formatDate(movement.entry_date) }}
                                    </span>
                                </div>
                            </td>

                            <!-- Cuenta & Método -->
                            <td class="py-3">
                                <div class="d-flex align-center gap-2 flex-wrap">
                                    <div class="d-flex align-center gap-1">
                                        <VIcon size="16" color="primary">ri-bank-line</VIcon>
                                        <span class="text-body-2 font-weight-medium text-high-emphasis">
                                            {{ getAccountName(movement) }}
                                        </span>
                                    </div>
                                    <VChip size="x-small"
                                        :color="getPaymentMethod(movement, accounts) === 'TRANSFERENCIA' ? 'info' : 'secondary'"
                                        variant="tonal" class="font-weight-bold">
                                        {{ getPaymentMethod(movement, accounts) }}
                                    </VChip>
                                </div>
                            </td>

                            <!-- Monto -->
                            <td class="py-3 text-right">
                                <span class="text-subtitle-1 font-weight-extrabold me-1"
                                    :class="movement.type === 0 ? 'text-success' : 'text-error'">
                                    {{ movement.type === 0 ? '+' : '-' }}{{ formatCurrency(movement.amount) }}
                                </span>
                            </td>

                            <!-- Acciones -->
                            <td class="py-3 text-center">
                                <div class="d-flex justify-center gap-1">
                                    <VBtn title="Comprobante PDF" size="small" variant="tonal" color="info"
                                        icon="ri-file-pdf-line" class="action-btn"
                                        :loading="generatingSingleId === movement.id"
                                        @click="generateSinglePDF(movement)" />
                                    <VBtn title="Editar" size="small" variant="tonal" color="primary"
                                        icon="ri-edit-line" class="action-btn" @click="editMovement(movement)" />
                                    <VBtn title="Eliminar" size="small" variant="tonal" color="error"
                                        icon="ri-delete-bin-line" class="action-btn"
                                        @click="deleteMovement(movement)" />
                                </div>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </VTable>
        </VCard>

        <!-- Diálogos -->
        <IncomeDialog v-model="showIncomeDialog" :editing-movement="editingMovement" @saved="saveIncome" />
        <ExpenseDialog v-model="showExpenseDialog" :editing-movement="editingMovement" @saved="saveExpense" />
        <DeleteDialog v-model="showDeleteDialog" :movement="movementToDelete" @confirm="confirmDelete" />
    </div>
</template>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
