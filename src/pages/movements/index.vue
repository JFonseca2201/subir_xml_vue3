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

// Búsqueda y Filtros
const searchWorkOrder = ref('')
const rangeDate = ref(null)
const filterType = ref('')
const filterMonth = ref('')

const backendTotals = ref({
    income: 0,
    expense: 0,
    transfer: 0,
    balance: 0
})

let searchTimeout = null
watch([searchWorkOrder, rangeDate, filterType, filterMonth], () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
        loadMovements()
    }, 500)
})

// Filtrar movimientos por Ingreso / Egreso
const incomeMovements = computed(() => {
    return movements.value.filter(m => m.type === 0 || m.type === 'income')
})

const expenseMovements = computed(() => {
    return movements.value.filter(m => m.type === 1 || m.type === 'expense')
})

// Computados de totales generales (preferir backendTotals si existen)
const totals = computed(() => {
    if (backendTotals.value.income > 0 || backendTotals.value.expense > 0 || backendTotals.value.transfer > 0) {
        return {
            income: backendTotals.value.income,
            expense: backendTotals.value.expense,
            expenses: backendTotals.value.expense,
            balance: backendTotals.value.balance
        }
    }
    const income = incomeMovements.value.reduce((acc, m) => acc + parseFloat(m.amount || 0), 0)
    const expenses = expenseMovements.value.reduce((acc, m) => acc + parseFloat(m.amount || 0), 0)
    return {
        income,
        expense: expenses,
        expenses,
        balance: income - expenses
    }
})

// Agrupar movimientos por día (ingresos y egresos)
const groupedMovements = computed(() => {
    const groups = {}

    movements.value.forEach(movement => {
        const date = movement.entry_date ? movement.entry_date.split('T')[0] : 'Sin fecha'
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

        if (movement.type === 0 || movement.type === 'income') {
            groups[date].dailyIncome += parseFloat(movement.amount || 0)
        } else if (movement.type === 1 || movement.type === 'expense') {
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
    if (movement.type === 'transfer') {
        return 'TRANSFERENCIA'
    }
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
            start_date: rangeDate.value ? rangeDate.value.split(" to ")[0]?.trim() || undefined : undefined,
            end_date: rangeDate.value ? rangeDate.value.split(" to ")[1]?.trim() || undefined : undefined,
            type: filterType.value || undefined,
            month: filterMonth.value || undefined,
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
        await loadMovements(false)
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

        await loadMovements(false)
        closeIncomeDialog()
    } catch (error) {
        console.error('Error al guardar ingreso:', error)
        showNotification('Error al guardar ingreso', 'error')
    }
}

const saveExpense = async (data) => {
    try {
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

        await loadMovements(false)
        closeExpenseDialog()
    } catch (error) {
        console.error('Error al guardar egreso:', error)
        showNotification('Error al guardar egreso', 'error')
    }
}

const monthsOptions = computed(() => {
    const options = [{ title: 'Todos los meses', value: '' }]
    const date = new Date()
    for (let i = 0; i < 12; i++) {
        const y = date.getFullYear()
        const m = date.getMonth()
        const value = `${y}-${String(m + 1).padStart(2, '0')}`
        const title = new Date(y, m, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
        options.push({
            title: title.replace(/^\w/, c => c.toUpperCase()),
            value: value
        })
        date.setMonth(date.getMonth() - 1)
    }
    return options
})

const loadMovements = async (showOverlay = true) => {
    if (showOverlay) loader.start()
    try {
        const params = {}
        if (searchWorkOrder.value) {
            params.search = searchWorkOrder.value
        }
        if (rangeDate.value) {
            const parts = rangeDate.value.split(" to ")
            if (parts[0]) params.start_date = parts[0].trim()
            if (parts[1]) params.end_date = parts[1].trim()
        }
        if (filterType.value) {
            params.type = filterType.value
        }
        if (filterMonth.value) {
            params.month = filterMonth.value
        }

        const response = await $api('financial-movements', {
            params
        })

        movements.value = response?.movements || []
        if (response?.totals) {
            backendTotals.value = response.totals
        }
    } catch (error) {
        console.error('Error al cargar movimientos:', error)
        showNotification('Error al cargar movimientos', 'error')
        movements.value = []
    } finally {
        if (showOverlay) loader.stop()
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
    if (movement.type === 'transfer') {
        const fromName = movement.metadata?.from_account_name || 'Origen'
        const toName = movement.metadata?.to_account_name || 'Destino'
        return `${cleanAccountName(fromName)} → ${cleanAccountName(toName)}`
    }

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

const getMovementDocNumber = (movement) => {
    // 1. Verificar si existen propiedades directas
    if (movement.work_order_number) return movement.work_order_number
    if (movement.invoice_number) return movement.invoice_number

    // 2. Verificar metadata
    if (movement.metadata) {
        const metadata = movement.metadata
        const docNum = metadata.work_order || metadata.work_order_number || metadata.invoice || metadata.document_number || metadata.invoice_number
        if (docNum) return docNum
    }

    // 3. Verificar relación polimórfica movable
    if (movement.movable) {
        const movable = movement.movable
        if (movable.finance_record) {
            const fr = movable.finance_record
            if (fr.work_order_number) return fr.work_order_number
            if (fr.invoice_number) return fr.invoice_number
        }
        if (movable.work_order_number) return movable.work_order_number
        if (movable.invoice_number) return movable.invoice_number
        if (movable.document_number) return movable.document_number
    }

    return '-'
}

onMounted(() => {
    loadAccounts()
    loadMovements()
    loadTransfers()
})
</script>

<template>
    <div class="pa-4 pa-sm-6 movements-page">
        <!-- Header Principal Sticky -->
        <VCard class="mb-6 rounded-xl border-light pa-5 elevation-1 sticky-header">
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
                <VCard 
                    class="pa-5 rounded-xl tonal-card bg-success-tonal border-success cursor-pointer transition-all hover-scale" 
                    :class="{ 'active-card border-2 elevation-3': filterType === 'income', 'opacity-60': filterType && filterType !== 'income' }"
                    elevation="0"
                    @click="filterType = filterType === 'income' ? '' : 'income'"
                >
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
                <VCard 
                    class="pa-5 rounded-xl tonal-card bg-error-tonal border-error cursor-pointer transition-all hover-scale" 
                    :class="{ 'active-card border-2 elevation-3': filterType === 'expense', 'opacity-60': filterType && filterType !== 'expense' }"
                    elevation="0"
                    @click="filterType = filterType === 'expense' ? '' : 'expense'"
                >
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
                <VCard 
                    class="pa-5 rounded-xl tonal-card bg-primary-tonal border-primary cursor-pointer transition-all hover-scale" 
                    :class="{ 'active-card border-2 elevation-3': filterType === '', 'opacity-60': filterType }"
                    elevation="0"
                    @click="filterType = ''"
                >
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
                <!-- Buscar por texto -->
                <VCol cols="12" sm="6" md="3">
                    <VTextField v-model="searchWorkOrder" prepend-inner-icon="ri-search-2-line"
                        placeholder="Buscar por OT, Factura..." hide-details clearable variant="outlined"
                        density="compact" />
                </VCol>

                <!-- Filtrar por Mes -->
                <VCol cols="12" sm="6" md="3">
                    <VSelect v-model="filterMonth" :items="monthsOptions" item-title="title" item-value="value"
                        label="Filtrar por Mes" prepend-inner-icon="ri-calendar-event-line" hide-details variant="outlined"
                        density="compact" />
                </VCol>

                <!-- Filtrar por Tipo -->
                <VCol cols="12" sm="6" md="3">
                    <VSelect v-model="filterType" :items="[
                        { title: 'Todos los tipos', value: '' },
                        { title: 'Ingresos', value: 'income' },
                        { title: 'Egresos', value: 'expense' },
                        { title: 'Transferencias', value: 'transfer' }
                    ]" item-title="title" item-value="value" label="Tipo de Movimiento"
                        prepend-inner-icon="ri-equalizer-line" hide-details variant="outlined" density="compact" />
                </VCol>

                <!-- Rango de Fechas -->
                <VCol cols="12" sm="6" md="3">
                    <AppDateTimePicker v-model="rangeDate" label="Rango de fechas" placeholder="Seleccionar rango"
                        :config="{ mode: 'range' }" variant="outlined" density="compact" hide-details clearable />
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
            <VTable hover class="transfer-table">
                <thead>
                    <tr>
                        <th class="text-left py-3" style="width: 15%; min-width: 100px;">
                            OT / FACTURA
                        </th>
                        <th class="text-left py-3" style="width: 15%; min-width: 120px;">
                            TIPO
                        </th>
                        <th class="text-left py-3" style="width: 30%; min-width: 200px;">
                            DESCRIPCIÓN & FECHA
                        </th>
                        <th class="text-left py-3" style="width: 20%; min-width: 160px;">
                            CUENTA & MÉTODO
                        </th>
                        <th class="text-right py-3" style="width: 10%; min-width: 100px;">
                            MONTO
                        </th>
                        <th class="text-center py-3" style="width: 10%; min-width: 120px;">
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
                                        <span class="text-caption font-weight-bold" :class="day.dailyBalance >= 0 ? 'text-success' : 'text-error'">
                                            Balance: {{ formatCurrency(day.dailyBalance) }}
                                        </span>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        <!-- Filas de Movimientos para ese día -->
                        <tr v-for="movement in day.movements" :key="movement.id" class="transfer-row">
                            <!-- OT / Factura -->
                            <td class="py-3">
                                <span class="text-body-2 font-weight-bold text-high-emphasis">
                                    {{ getMovementDocNumber(movement) }}
                                </span>
                            </td>

                            <!-- Tipo (Ingreso vs Egreso) -->
                            <td class="py-3">
                                <span v-if="movement.type === 0 || movement.type === 'income'" class="text-success font-weight-bold text-caption text-uppercase">
                                    INGRESO
                                </span>
                                <span v-else-if="movement.type === 1 || movement.type === 'expense'" class="text-error font-weight-bold text-caption text-uppercase">
                                    EGRESO
                                </span>
                                <span v-else-if="movement.type === 'transfer'" class="text-info font-weight-bold text-caption text-uppercase">
                                    TRANSFERENCIA
                                </span>
                                <span v-else class="text-medium-emphasis font-weight-bold text-caption">
                                    {{ movement.type }}
                                </span>
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
                                <div class="d-flex flex-column gap-0.5">
                                    <div class="d-flex align-center gap-1">
                                        <VIcon size="16" color="primary">ri-bank-line</VIcon>
                                        <span class="text-body-2 font-weight-medium text-high-emphasis">
                                            {{ getAccountName(movement) }}
                                        </span>
                                    </div>
                                    <span class="text-medium-emphasis font-weight-medium ps-5 text-uppercase" style="font-size: 10px !important;">
                                        {{ getPaymentMethod(movement, accounts) }}
                                    </span>
                                </div>
                            </td>

                            <!-- Monto -->
                            <td class="py-3 text-right">
                                <span class="text-subtitle-1 font-weight-extrabold me-1"
                                    :class="(movement.type === 0 || movement.type === 'income') ? 'text-success' : ((movement.type === 1 || movement.type === 'expense') ? 'text-error' : 'text-info')">
                                    {{ (movement.type === 0 || movement.type === 'income') ? '+' : ((movement.type === 1 || movement.type === 'expense') ? '-' : '') }}{{ formatCurrency(movement.amount) }}
                                </span>
                            </td>

                            <!-- Acciones -->
                            <td class="py-3 text-center">
                                <div class="d-flex justify-center gap-1">
                                    <VBtn v-if="movement.type !== 'transfer'" title="Comprobante PDF" size="small" variant="tonal" color="info"
                                        icon="ri-file-pdf-line" class="action-btn"
                                        :loading="generatingSingleId === movement.id"
                                        @click="generateSinglePDF(movement)" />
                                    <VBtn v-if="movement.type !== 'transfer'" title="Editar" size="small" variant="tonal" color="primary"
                                        icon="ri-edit-line" class="action-btn" @click="editMovement(movement)" />
                                    <VBtn v-if="movement.type !== 'transfer'" title="Eliminar" size="small" variant="tonal" color="error"
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

<style scoped>
.sticky-header {
  position: sticky;
  top: 62px;
  z-index: 99;
  background-color: rgb(var(--v-theme-surface)) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08) !important;
  transition: all 0.2s ease;
}
@media (min-width: 960px) {
  .sticky-header {
    top: 70px;
  }
}
.cursor-pointer {
  cursor: pointer;
}
.transition-all {
  transition: all 0.25s ease-in-out;
}
.hover-scale {
  transition: all 0.25s ease-in-out;
}
.hover-scale:hover {
  transform: translateY(-2px);
}
.opacity-60 {
  opacity: 0.6;
}
.border-2 {
  border-width: 2px !important;
}
.active-card {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12) !important;
}
</style>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
