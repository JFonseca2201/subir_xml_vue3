<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import AddEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/AddEmployeeAdvanceDialog.vue'
import EditEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/EditEmployeeAdvanceDialog.vue'
import DeleteEmployeeAdvanceDialog from '@/components/inventory/employee-expenses/DeleteEmployeeAdvanceDialog.vue'

// Reactive state
const expenses = ref([])
const employees = ref([])
const accounts = ref([])
const summary = ref({
    total_payments: 0,
    total_advances: 0,
    total_general: 0
})
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const selectedType = ref('all')

// Dialog state
const showAddPaymentDialog = ref(false)
const showEditPaymentDialog = ref(false)
const showDeletePaymentDialog = ref(false)
const showAddAdvanceDialog = ref(false)
const showEditAdvanceDialog = ref(false)
const showDeleteAdvanceDialog = ref(false)
const selectedAdvance = ref(null)
const selectedPayment = ref(null)

// Authorization
const currentUser = computed(() => ({
    role: 'admin',
    permissions: ['admin', 'gerente', 'superadmin']
}))

const canAccessEmployeeExpenses = computed(() => {
    return currentUser.value && (
        currentUser.value.role === 'admin' ||
        currentUser.value.role === 'gerente' ||
        currentUser.value.role === 'superadmin'
    )
})

// Functions
const getEmployeeName = (employeeId) => {
    if (!employeeId) return 'N/A'
    if (!employees.value || employees.value.length === 0) return 'N/A'

    console.log('Buscando empleado con ID:', employeeId, 'Tipo:', typeof employeeId)
    console.log('Empleados disponibles:', employees.value)

    // Convertir a número para comparación si es string
    const searchId = parseInt(employeeId)
    const employee = employees.value.find(emp => parseInt(emp.id) === searchId)

    const name = employee ? `${employee.first_name} ${employee.last_name}` : 'N/A'
    console.log('Nombre encontrado:', name)
    return name
}

const getAccountName = (accountId) => {
    if (!accountId) return 'N/A'
    if (!accounts.value || accounts.value.length === 0) return 'N/A'

    console.log('Buscando cuenta con ID:', accountId, 'Tipo:', typeof accountId)
    console.log('Cuentas disponibles:', accounts.value)

    // Convertir a número para comparación si es string
    const searchId = parseInt(accountId)
    const account = accounts.value.find(acc => parseInt(acc.id) === searchId)

    const name = account ? account.name : 'N/A'
    console.log('Nombre de cuenta encontrado:', name)
    return name
}

const loadExpenses = async () => {
    loader.start()

    try {
        // Cargar datos reales de la API
        const [expensesResponse, accountsResponse, employeesResponse] = await Promise.all([
            $api('employee-expenses'),
            $api('accounts'),
            $api('employees')
        ])

        console.log('Respuesta completa de gastos:', expensesResponse)
        console.log('Respuesta completa de cuentas:', accountsResponse)
        console.log('Respuesta completa de empleados:', employeesResponse)

        // Cargar cuentas con sus saldos
        accounts.value = accountsResponse || []

        // Cargar empleados
        employees.value = (employeesResponse.employees || []).map(emp => ({
            ...emp,
            name: `${emp.first_name} ${emp.last_name}`
        }))

        console.log('Empleados cargados:', employees.value)
        console.log('Cuentas cargadas:', accounts.value)


        // Combinar pagos y adelantos en una sola lista y agregar nombres solo si faltan
        const allExpenses = [
            ...(expensesResponse.payments || []).map(payment => ({
                ...payment,
                employee_name: payment.employee_name || getEmployeeName(payment.employee_id),
                account_name: payment.account_name || getAccountName(payment.account_id)
            })),
            ...(expensesResponse.advances || []).map(advance => {
                // Mantener los datos originales del adelanto
                // El backend ya envía employee_name y account_name, solo usar si faltan
                const employeeName = advance.employee_name ||
                    (advance.employee_id ? getEmployeeName(advance.employee_id) : 'N/A')

                const accountName = advance.account_name ||
                    (advance.account_id ? getAccountName(advance.account_id) : 'N/A')

                return {
                    ...advance,
                    employee_name: employeeName,
                    account_name: accountName
                }
            })
        ]

        console.log('Todos los gastos con nombres:', allExpenses)

        expenses.value = allExpenses
        summary.value.total_payments = parseFloat(expensesResponse.summary?.total_payments) || 0
        summary.value.total_advances = parseFloat(expensesResponse.summary?.total_advances) || 0
        summary.value.total_general = parseFloat(expensesResponse.summary?.total_general) || 0

        console.log('Gastos cargados:', allExpenses.length, 'items')
        console.log('Cuentas cargadas:', accounts.value.length, 'cuentas')
        console.log('Resumen:', summary.value)

    } catch (error) {
        console.error('Error al cargar gastos de empleados:', error)
        showNotification('Error al cargar los gastos de empleados. Por favor, intenta nuevamente.', 'error')

        const allExpenses = [
            ...(fallbackData.payments || []),
            ...(fallbackData.advances || [])
        ]

        expenses.value = allExpenses
        summary.value.total_payments = parseFloat(fallbackData.summary.total_payments) || 0
        summary.value.total_advances = parseFloat(fallbackData.summary.total_advances) || 0
        summary.value.total_general = parseFloat(fallbackData.summary.total_general) || 0
    } finally {
        loader.stop()
    }
}
const openAddAdvanceDialog = () => {
    showAddAdvanceDialog.value = true
}

const openAddPaymentDialog = () => {
    showAddPaymentDialog.value = true
}

const openEditAdvanceDialog = (advance) => {
    console.log('Abriendo diálogo de edición con adelanto:', advance)
    console.log('employee_id:', advance.employee_id, 'Tipo:', typeof advance.employee_id)
    console.log('account_id:', advance.account_id, 'Tipo:', typeof advance.account_id)

    selectedAdvance.value = advance
    showEditAdvanceDialog.value = true
}

const openDeleteAdvanceDialog = (advance) => {
    selectedAdvance.value = advance
    showDeleteAdvanceDialog.value = true
}

const openEditPaymentDialog = (payment) => {
    selectedPayment.value = payment
    showEditPaymentDialog.value = true
}

const openDeletePaymentDialog = (payment) => {
    selectedPayment.value = payment
    showDeletePaymentDialog.value = true
}

const handleAdvanceCreated = (newAdvance) => {
    if (!newAdvance) return

    // Obtener el nombre del empleado usando el employee_id
    const employee = employees.value.find(emp => emp.id === newAdvance.employee_id)
    const account = accounts.value.find(acc => acc.id === newAdvance.account_id)

    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : newAdvance.employee_name || 'N/A'
    const accountName = account ? account.name : newAdvance.account_name || 'N/A'

    const advanceWithId = {
        ...newAdvance,
        employee_name: employeeName,
        account_name: accountName,
        date: newAdvance.advance_date || new Date().toLocaleDateString(),
        type: 'advance',
        // Asegurar que los campos necesarios para eliminación estén presentes
        employee_id: newAdvance.employee_id,
        account_id: newAdvance.account_id
    }

    // Actualizar saldo de la cuenta localmente
    updateAccountBalance(newAdvance.account_id, newAdvance.amount, 'advance')

    expenses.value.unshift(advanceWithId)
    summary.value.total_advances += Number(advanceWithId.amount)
    summary.value.total_general += Number(advanceWithId.amount)
    showAddAdvanceDialog.value = false
    console.log('Adelanto creado:', advanceWithId)
}

const handlePaymentCreated = (newPayment) => {
    if (!newPayment) return

    // Usar el nombre del empleado y cuenta que vienen del formulario directamente
    const employeeName = newPayment.employee_name || 'Empleado'
    const accountName = newPayment.account_name || 'Cuenta'

    const paymentWithId = {
        id: Date.now(),
        employee_name: employeeName,
        amount: newPayment.amount || 0,
        description: newPayment.description || 'Sin descripción',
        account_name: accountName,
        date: newPayment.payment_date || new Date().toLocaleDateString(),
        created_by: 'Usuario',
        type: 'payment'
    }

    // Actualizar saldo de la cuenta localmente
    updateAccountBalance(newPayment.account_id, newPayment.amount, 'payment')

    expenses.value.unshift(paymentWithId)
    summary.value.total_payments += Number(paymentWithId.amount)
    summary.value.total_general += Number(paymentWithId.amount)
    showAddPaymentDialog.value = false
    console.log('Pago creado:', paymentWithId)
}

const handleAdvanceUpdated = (updatedAdvance) => {
    if (!updatedAdvance) return

    // Recargar los datos para obtener la información actualizada
    loadExpenses()
    showEditAdvanceDialog.value = false
    selectedAdvance.value = null
}

const handleAdvanceDeleted = (advanceId) => {
    if (!advanceId) return

    const index = expenses.value.findIndex(item => item.id === advanceId)
    if (index !== -1) {
        const deletedAdvance = expenses.value[index]
        expenses.value.splice(index, 1)

        // Recargar los datos para obtener los totales correctos del backend
        loadExpenses()

        console.log('Adelanto eliminado:', deletedAdvance)
        console.log('Recargando datos para actualizar totales...')
    }
    showDeleteAdvanceDialog.value = false
}

const handlePaymentUpdated = (updatedPayment) => {
    if (!updatedPayment) return

    const index = expenses.value.findIndex(item => item.id === updatedPayment.id)
    if (index !== -1) {
        // Preservar los datos existentes y solo actualizar los campos modificados
        const existingPayment = expenses.value[index]
        const mergedPayment = {
            ...existingPayment, // Mantener todos los datos existentes
            ...updatedPayment, // Sobreescribir con los datos actualizados
            type: 'payment',
            // Asegurar que estos campos no se pierdan
            employee_name: updatedPayment.employee_name || existingPayment.employee_name,
            date: updatedPayment.payment_date || updatedPayment.date || existingPayment.date
        }

        expenses.value[index] = mergedPayment
        console.log('Pago actualizado:', mergedPayment)
    }
    showEditPaymentDialog.value = false
}

const handlePaymentDeleted = (paymentId) => {
    if (!paymentId) return

    const index = expenses.value.findIndex(item => item.id === paymentId)
    if (index !== -1) {
        const deletedPayment = expenses.value[index]
        expenses.value.splice(index, 1)

        // Recargar los datos para obtener los totales correctos del backend
        loadExpenses()

        console.log('Pago eliminado:', deletedPayment)
        console.log('Recargando datos para actualizar totales...')
    }
    showDeletePaymentDialog.value = false
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value)
}

const getAccountBalance = (accountId) => {
    const account = accounts.value.find(acc => acc.id === accountId)
    return account ? account.balance || 0 : 0
}

const getAccountWithBalance = (accountId) => {
    const account = accounts.value.find(acc => acc.id === accountId)
    if (!account) return { name: 'Cuenta', balance: 0 }

    return {
        name: account.name,
        balance: account.balance || 0
    }
}

const updateAccountBalance = (accountId, amount, type) => {
    const accountIndex = accounts.value.findIndex(acc => acc.id === accountId)
    if (accountIndex !== -1) {
        if (type === 'payment') {
            // Los pagos reducen el saldo de la cuenta
            accounts.value[accountIndex].balance -= parseFloat(amount)
        } else if (type === 'advance') {
            // Los adelantos también reducen el saldo de la cuenta
            accounts.value[accountIndex].balance -= parseFloat(amount)
        }
    }
}

const filteredExpenses = computed(() => {
    if (selectedType.value === 'all') return expenses.value
    if (selectedType.value === 'payments') return expenses.value.filter(e => e.type === 'payment')
    if (selectedType.value === 'advances') return expenses.value.filter(e => e.type === 'advance')
    return expenses.value
})

// Montar componente
onMounted(() => {
    if (canAccessEmployeeExpenses.value) {
        loadExpenses()
    }
})
</script>
<template>
    <div v-if="!canAccessEmployeeExpenses" class="d-flex justify-center align-center" style="height: 400px">
        <VCard class="pa-6 text-center">
            <VIcon size="64" color="error" class="mb-4">ri-lock-line</VIcon>
            <h3 class="text-h5 mb-2">Acceso Restringido</h3>
            <p class="text-medium-emphasis">No tienes permisos para acceder a esta sección.</p>
        </VCard>
    </div>

    <div v-else>
        <!-- Header -->
        <div class="d-flex justify-space-between align-center mb-6">
            <div>
                <h2 class="text-h4 font-weight-bold">Pagos</h2>
                <p class="text-medium-emphasis mb-0">Gestiona los pagos y adelantos a empleados</p>
            </div>
            <div class="d-flex gap-3">
                <VBtn color="primary" prepend-icon="ri-money-dollar-circle-line" @click="openAddPaymentDialog">
                    Nuevo Pago
                </VBtn>
                <VBtn color="info" prepend-icon="ri-hand-coin-line" @click="openAddAdvanceDialog">
                    Nuevo Adelanto
                </VBtn>
            </div>
        </div>

        <!-- Summary Cards -->
        <VRow class="mb-6">
            <VCol cols="12" md="4">
                <VCard class="bg-blue-lighten-4 rounded-lg pa-4 h-100">
                    <VCardItem>
                        <VCardTitle class="d-flex align-center gap-3 mb-3">
                            <VIcon size="32">ri-money-dollar-circle-line</VIcon>
                            <div>
                                <h3 class="text-h5 font-weight-bold mb-1">Total Pagos</h3>
                                <p class="text-medium-emphasis text-body-2 mb-0">Suma de todos los pagos realizados</p>
                            </div>
                        </VCardTitle>
                        <VCardText class="text-h4 font-weight-bold text-primary">
                            {{ formatCurrency(summary.total_payments) }}
                        </VCardText>
                    </VCardItem>
                </VCard>
            </VCol>

            <VCol cols="12" md="4">
                <VCard class="bg-green-lighten-4 rounded-lg pa-4 h-100">
                    <VCardItem>
                        <VCardTitle class="d-flex align-center gap-3 mb-3">
                            <VIcon size="32">ri-hand-coin-line</VIcon>
                            <div>
                                <h3 class="text-h5 font-weight-bold mb-1">Total Adelantos</h3>
                                <p class="text-medium-emphasis text-body-2 mb-0">Suma de todos los adelantos otorgados
                                </p>
                            </div>
                        </VCardTitle>
                        <VCardText class="text-h4 font-weight-bold text-success">
                            {{ formatCurrency(summary.total_advances) }}
                        </VCardText>
                    </VCardItem>
                </VCard>
            </VCol>

            <VCol cols="12" md="4">
                <VCard class="bg-orange-lighten-4 rounded-lg pa-4 h-100">
                    <VCardItem>
                        <VCardTitle class="d-flex align-center gap-3 mb-3">
                            <VIcon size="32">ri-funds-line</VIcon>
                            <div>
                                <h3 class="text-h5 font-weight-bold mb-1">Total General</h3>
                                <p class="text-medium-emphasis text-body-2 mb-0">Suma total de todos los movimientos</p>
                            </div>
                        </VCardTitle>
                        <VCardText class="text-h4 font-weight-bold text-orange-darken-2">
                            {{ formatCurrency(summary.total_general) }}
                        </VCardText>
                    </VCardItem>
                </VCard>
            </VCol>
        </VRow>

        <!-- Filter Buttons -->
        <div class="d-flex gap-2 mb-4">
            <VBtn :variant="selectedType === 'all' ? 'flat' : 'outlined'"
                :color="selectedType === 'all' ? 'primary' : 'default'" @click="selectedType = 'all'">
                <VIcon class="mr-2">ri-list-check</VIcon>
                Todos
            </VBtn>
            <VBtn :variant="selectedType === 'payments' ? 'flat' : 'outlined'"
                :color="selectedType === 'payments' ? 'primary' : 'default'" @click="selectedType = 'payments'">
                <VIcon class="mr-2">ri-money-dollar-circle-line</VIcon>
                Pagos
            </VBtn>
            <VBtn :variant="selectedType === 'advances' ? 'flat' : 'outlined'"
                :color="selectedType === 'advances' ? 'primary' : 'default'" @click="selectedType = 'advances'">
                <VIcon class="mr-2">ri-hand-coin-line</VIcon>
                Adelantos
            </VBtn>
        </div>

        <!-- Simple HTML Table -->
        <VCard class="mb-6">

            <VCardText class="pa-4">
                <!-- Loading State -->
                <div v-if="loader.loading" class="d-flex justify-center pa-12">
                    <VProgressCircular indeterminate color="primary" size="48" />
                </div>

                <!-- Simple HTML Table -->
                <div v-else-if="filteredExpenses.length > 0">
                    <table class="w-100 expense-table">
                        <thead>
                            <tr>
                                <th>Tipo</th>
                                <th>Empleado</th>
                                <th>Descripción</th>
                                <th>Cuenta</th>
                                <th>Monto</th>
                                <th>Fecha</th>

                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody style="text-transform: uppercase;">
                            <tr v-for="item in filteredExpenses" :key="`${item.type}-${item.id}`" class="expense-row">
                                <td>
                                    <VChip
                                        :color="item.type === 'payment' ? 'success' : (item.is_deducted ? 'grey' : 'info')"
                                        variant="tonal" size="small">
                                        <VIcon class="mr-1" size="14">
                                            {{ item.type === 'payment' ? 'ri-money-dollar-circle-line' :
                                                (item.is_deducted ? 'ri-check-line' : 'ri-hand-coin-line') }}
                                        </VIcon>
                                        {{ item.type === 'payment' ? 'PAGO' : (item.is_deducted ? 'ADELANTO PAGADO' :
                                            'ADELANTO') }}
                                    </VChip>
                                </td>
                                <td>
                                    <div class="d-flex align-center gap-1">
                                        <VIcon color="primary" size="16">ri-user-line</VIcon>
                                        <span>{{ item.employee_name }}</span>
                                    </div>
                                </td>
                                <td>{{ item.description || 'Sin descripción' }}</td>
                                <td>
                                    <div class="d-flex flex-column align-center gap-1">
                                        <div class="d-flex align-center gap-1">
                                            <VIcon color="primary" size="16">ri-bank-line</VIcon>
                                            <span>{{ item.account_name }}</span>
                                        </div>
                                    </div>
                                </td>
                                <td class="text-center">
                                    <span class="font-weight-bold"
                                        :class="item.type === 'payment' ? 'text-success' : 'text-info'">
                                        {{ formatCurrency(item.amount) }}
                                    </span>
                                </td>
                                <td>
                                    <VChip size="x-small" variant="tonal" color="grey-lighten-2">
                                        {{ item.date }}
                                    </VChip>
                                </td>

                                <td>
                                    <div class="d-flex gap-1">
                                        <VBtn v-if="item.type === 'advance' && !item.is_deducted" icon="ri-edit-line"
                                            variant="text" size="small" color="primary" title="Editar adelanto"
                                            @click="openEditAdvanceDialog(item)" />
                                        <VBtn v-if="item.type === 'advance' && !item.is_deducted"
                                            icon="ri-delete-bin-line" variant="text" size="small" color="error"
                                            title="Eliminar adelanto" @click="openDeleteAdvanceDialog(item)" />
                                        <VBtn v-if="item.type === 'advance' && item.is_deducted" icon="ri-edit-line"
                                            variant="text" size="small" color="grey-lighten-2"
                                            title="Adelanto ya pagado - no se puede editar" disabled />
                                        <VBtn v-if="item.type === 'advance' && item.is_deducted"
                                            icon="ri-delete-bin-line" variant="text" size="small" color="grey-lighten-2"
                                            title="Adelanto ya pagado - no se puede eliminar" disabled />
                                        <VBtn v-if="item.type === 'payment'" icon="ri-edit-line" variant="text"
                                            size="small" color="primary" title="Editar pago"
                                            @click="openEditPaymentDialog(item)" />
                                        <VBtn v-if="item.type === 'payment'" icon="ri-delete-bin-line" variant="text"
                                            size="small" color="error" title="Eliminar pago"
                                            @click="openDeletePaymentDialog(item)" />
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Empty State -->
                <div v-else class="text-center pa-12">
                    <VIcon size="64" color="medium-emphasis" class="mb-4">ri-inbox-line</VIcon>
                    <h3 class="text-h5 mb-2">No hay gastos registrados</h3>
                    <p class="text-medium-emphasis">No se encontraron {{ selectedType === 'all' ? 'gastos' :
                        selectedType === 'payments' ? 'pagos' : 'adelantos' }} para mostrar.</p>
                </div>
            </VCardText>
        </VCard>

        <!-- Diálogos -->
        <AddEmployeeAdvanceDialog v-if="showAddAdvanceDialog" v-model="showAddAdvanceDialog" :accounts="[]"
            @created="handleAdvanceCreated" />
        <AddEmployeePaymentDialog v-if="showAddPaymentDialog" v-model="showAddPaymentDialog" :accounts="[]"
            @created="handlePaymentCreated" />
        <EditEmployeeAdvanceDialog v-if="showEditAdvanceDialog" v-model="showEditAdvanceDialog"
            :expense="selectedAdvance" @updated="handleAdvanceUpdated" />
        <DeleteEmployeeAdvanceDialog v-if="showDeleteAdvanceDialog" :advance="selectedAdvance"
            v-model="showDeleteAdvanceDialog" @deleted="handleAdvanceDeleted" />
        <EditEmployeePaymentDialog v-if="showEditPaymentDialog" v-model="showEditPaymentDialog"
            :expense="selectedPayment" @updated="handlePaymentUpdated" />
        <DeleteEmployeePaymentDialog v-if="showDeletePaymentDialog" v-model="showDeletePaymentDialog"
            :payment="selectedPayment" @deleted="handlePaymentDeleted" />
    </div>
</template>

<style scoped>
.expense-table {
    border-collapse: collapse;
    width: 100%;
}

.expense-table th {
    padding: 16px 12px;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.expense-table td {
    padding: 18px 12px;
    /* Mayor separación vertical (arriba y abajo) */
    vertical-align: middle;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.expense-row:hover td {
    background-color: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
