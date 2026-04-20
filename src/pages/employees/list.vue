<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

// --- IMPORTACIÓN DE DIÁLOGOS ---
import EmployeeAddDialog from '@/components/inventory/employee/EmployeeAddDialog.vue'
import EmployeeEditDialog from '@/components/inventory/employee/EmployeeEditDialog.vue'
import EmployeeShowDialog from '@/components/inventory/employee/EmployeeShowDialog.vue'
import EmployeeAdvanceDialog from '@/components/inventory/employee/employee_advances/EmployeeAdvanceDialog.vue'
import EmployeeAdvanceDeleteDialog from '@/components/inventory/employee/employee_advances/EmployeeAdvanceDeleteDialog.vue'
import EmployeePaymentDialog from '@/components/inventory/employee/employee_payments/EmployeePaymentDialog.vue'
import EmployeePaymentDeleteDialog from '@/components/inventory/employee/employee_payments/EmployeePaymentDeleteDialog.vue'
import EmployeeDeleteDialog from '@/components/inventory/employee/EmployeeDeleteDialog.vue'

const { showNotification } = useGlobalToast()

// --- ESTADO ---
const loading = ref(false)
const selectedPeriod = ref('today')
const transactionType = ref('payroll')
const employees = ref([])
const advances = ref([])
const payments = ref([])

// --- ESTADO DE DIÁLOGOS ---
const isAddDialogVisible = ref(false)
const isEditDialogVisible = ref(false)
const isShowDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const selectedEmployee = ref(null)
const isAdvanceDialogVisible = ref(false)
const isAdvanceDeleteDialogVisible = ref(false)
const selectedAdvance = ref(null)
const isPaymentDialogVisible = ref(false)
const isPaymentDeleteDialogVisible = ref(false)
const selectedPayment = ref(null)

const periodOptions = [
    { title: 'Hoy', value: 'today' },
    { title: 'Esta semana', value: 'week' },
    { title: 'Este mes', value: 'month' },
    { title: 'Año', value: 'year' }
]

// --- COMPUTED PROPERTIES ---
const totalAdvances = computed(() => {
    return (advances.value || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
})

const totalPayments = computed(() => {
    return (payments.value || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
})

const netEmployeeCost = computed(() => {
    return totalPayments.value - totalAdvances.value
})

// --- MÉTODOS DE CARGA ---
const loadEmployeeData = async () => {
    loading.value = true
    try {
        const resp = await $api("employees", { method: "GET" })
        if (resp && resp.status === 200) {
            employees.value = (resp.employees || []).map(emp => ({
                ...emp,
                sucursal_display: emp.sucursal?.name || 'Luxury Evys',
                id_display: emp.dni || 'No asignada'
            }))

            if (employees.value.length === 0) {
                isAddDialogVisible.value = true
            }
        }

        const advancesResp = await $api("employee-advances", { method: "GET" })
        const rawAdvances = advancesResp.advances || advancesResp || []
        advances.value = Array.isArray(rawAdvances) ? rawAdvances.map(adv => ({
            ...adv,
            employee: adv.employee || { name: 'Desconocido', surname: '' },
            description: adv.concept || 'Sin descripción',
            status: adv.state === 1 ? 'pending' : adv.state === 2 ? 'approved' : 'rejected'
        })) : []

        const paymentsResp = await $api("employee-payments", { method: "GET" })
        const rawPayments = paymentsResp.payments || paymentsResp || []
        payments.value = Array.isArray(rawPayments) ? rawPayments.map(pay => ({
            ...pay,
            employee: pay.employee || { name: 'Desconocido', surname: '' },
            description: pay.concept || 'Sin descripción',
            status: pay.state === 1 ? 'active' : 'inactive'
        })) : []

    } catch (error) {
        console.error('Error al cargar datos:', error)
        showNotification('Error al conectar con el servidor', 'error')
    } finally {
        loading.value = false
    }
}

// --- HELPERS ---
const formatCurrency = (amount) => {
    const value = Number(amount || 0)
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value)
}

const getStatusColor = (status) => {
    const colors = { pending: 'warning', approved: 'success', rejected: 'error' }
    return colors[status] || 'grey'
}

const getStatusText = (status) => {
    const texts = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' }
    return texts[status] || 'Desconocido'
}

const getPaymentTypeText = (type) => {
    const types = { cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque' }
    return types[type] || 'Desconocido'
}

const getPaymentTypeColor = (type) => {
    const colors = { cash: 'success', transfer: 'primary', check: 'info' }
    return colors[type] || 'grey'
}

// --- MANEJO DE DIÁLOGOS ---
const openAddDialog = () => { isAddDialogVisible.value = true }
const openEditDialog = (employee) => { selectedEmployee.value = employee; isEditDialogVisible.value = true }
const openShowDialog = (employee) => { selectedEmployee.value = employee; isShowDialogVisible.value = true }
const openDeleteDialog = (employee) => { selectedEmployee.value = employee; isDeleteDialogVisible.value = true }
const openAdvanceDialog = (advance = null) => { selectedAdvance.value = advance; isAdvanceDialogVisible.value = true }
const openAdvanceDeleteDialog = (advance) => { selectedAdvance.value = advance; isAdvanceDeleteDialogVisible.value = true }
const openPaymentDialog = (payment = null) => { selectedPayment.value = payment; isPaymentDialogVisible.value = true }
const openPaymentDeleteDialog = (payment) => { selectedPayment.value = payment; isPaymentDeleteDialogVisible.value = true }
const onSuccessAction = () => { loadEmployeeData() }

onMounted(() => {
    loadEmployeeData()
})
</script>

<template>
    <div class="employees-dashboard pa-4">
        <VCard class="mb-6 rounded-lg elevation-1" border>
            <VCardTitle class="d-flex flex-column flex-sm-row align-sm-center justify-space-between pa-4 gap-4">
                <div class="d-flex align-center">
                    <VIcon icon="ri-group-line" size="32" color="primary" class="me-3" />
                    <div>
                        <h1 class="text-h4 font-weight-black color-title mb-0">Gestión de Empleados</h1>
                        <p class="text-body-2 text-medium-emphasis mb-0">Luxury Evys - Nómina y Pagos</p>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <VBtn color="primary" variant="tonal" prepend-icon="ri-refresh-line" @click="loadEmployeeData"
                        :loading="loading">
                        Actualizar
                    </VBtn>
                </div>
            </VCardTitle>
        </VCard>

        <VRow class="mb-6">
            <VCol cols="12" md="4">
                <VCard class="rounded-xl soft-warning-card" variant="flat" border>
                    <VCardText class="text-center pa-6">
                        <VIcon icon="ri-hand-coin-line" size="40" color="warning" class="mb-2" />
                        <div class="text-subtitle-1 font-weight-medium text-warning-dark">Total Adelantos</div>
                        <div class="text-h3 font-weight-black text-warning-dark">{{ formatCurrency(totalAdvances) }}
                        </div>
                    </VCardText>
                </VCard>
            </VCol>
            <VCol cols="12" md="4">
                <VCard class="rounded-xl soft-success-card" variant="flat" border>
                    <VCardText class="text-center pa-6">
                        <VIcon icon="ri-money-dollar-box-line" size="40" color="success" class="mb-2" />
                        <div class="text-subtitle-1 font-weight-medium text-success-dark">Total Pagos</div>
                        <div class="text-h3 font-weight-black text-success-dark">{{ formatCurrency(totalPayments) }}
                        </div>
                    </VCardText>
                </VCard>
            </VCol>
            <VCol cols="12" md="4">
                <VCard class="rounded-xl soft-primary-card" variant="flat" border>
                    <VCardText class="text-center pa-6">
                        <VIcon icon="ri-calculator-line" size="40" color="primary" class="mb-2" />
                        <div class="text-subtitle-1 font-weight-medium text-primary-dark">Costo Neto</div>
                        <div class="text-h3 font-weight-black text-primary-dark">{{ formatCurrency(netEmployeeCost) }}
                        </div>
                    </VCardText>
                </VCard>
            </VCol>
        </VRow>

        <VCard elevation="1" class="rounded-lg" border>
            <VTabs v-model="transactionType" color="primary" grow>
                <VTab value="payroll">
                    <VIcon icon="ri-file-list-3-line" class="me-2" />Nómina
                </VTab>
                <VTab value="advances">
                    <VIcon icon="ri-hand-coin-line" class="me-2" />Adelantos
                </VTab>
                <VTab value="payments">
                    <VIcon icon="ri-money-dollar-box-line" class="me-2" />Pagos
                </VTab>
            </VTabs>

            <VWindow v-model="transactionType" class="pa-4">
                <VWindowItem value="payroll">
                    <div class="d-flex align-center justify-space-between mb-4">
                        <h3 class="text-h6 font-weight-bold">Empleados Registrados</h3>
                        <VBtn color="primary" variant="elevated" prepend-icon="ri-user-add-line" @click="openAddDialog">
                            Agregar Empleado</VBtn>
                    </div>
                    <VList border class="rounded-lg">
                        <VListItem v-for="employee in employees" :key="employee.id" class="pa-4 transaction-row">
                            <template #prepend>
                                <VAvatar color="primary" variant="tonal" size="48">
                                    <VIcon icon="ri-user-3-line" />
                                </VAvatar>
                            </template>

                            <VListItemTitle class="text-subtitle-1 color-title text-uppercase">
                                {{ employee.name }} {{ employee.surname }}
                            </VListItemTitle>

                            <VListItemSubtitle class="mt-1">
                                <div
                                    class="d-flex flex-wrap align-center gap-x-4 gap-y-1 text-caption text-medium-emphasis">
                                    <span class="d-flex align-center text-uppercase">
                                        <VIcon icon="ri-briefcase-line" size="14" class="me-1" />
                                        {{ employee.position || 'MECÁNICO GENERAL' }}
                                    </span>
                                    <span class="d-flex align-center">
                                        <VIcon icon="ri-id-card-line" size="14" class="me-1" />
                                        {{ employee.id_display }}
                                    </span>
                                    <span class="d-flex align-center sucursal-text">
                                        <VIcon icon="ri-map-pin-line" size="14" class="me-1" />
                                        {{ employee.sucursal_display }}
                                    </span>

                                    <VChip v-if="Number(employee.pending_advances || 0) > 0" color="warning"
                                        size="x-small" variant="tonal" class="font-weight-bold">
                                        DEUDA: {{ formatCurrency(employee.pending_advances) }}
                                    </VChip>
                                </div>
                            </VListItemSubtitle>

                            <template #append>
                                <div class="d-flex align-center gap-1">
                                    <VBtn icon="ri-eye-line" variant="text" color="info" size="small"
                                        @click="openShowDialog(employee)" />
                                    <VBtn icon="ri-pencil-line" variant="text" color="primary" size="small"
                                        @click="openEditDialog(employee)" />
                                    <VBtn icon="ri-delete-bin-line" variant="text" color="error" size="small"
                                        @click="openDeleteDialog(employee)" />
                                </div>
                            </template>
                        </VListItem>
                    </VList>
                </VWindowItem>

                <VWindowItem value="advances">
                    <div class="d-flex align-center justify-space-between mb-4">
                        <h3 class="text-h6 font-weight-bold">Adelantos</h3>
                        <VBtn color="warning" variant="elevated" prepend-icon="ri-add-line"
                            @click="openAdvanceDialog()">Nuevo</VBtn>
                    </div>
                    <VList border class="rounded-lg">
                        <VListItem v-for="advance in advances" :key="advance.id" class="pa-4 transaction-row">
                            <VListItemTitle class="color-title text-h6 text-uppercase">{{
                                advance.description }}
                            </VListItemTitle>
                            <VListItemSubtitle class="text-caption">
                                {{ advance.employee?.name }} • {{ advance.advance_date?.split('T')[0] }}
                            </VListItemSubtitle>
                            <template #append>
                                <div class="text-right">
                                    <div class="text-h6 font-weight-black text-warning-dark">-{{
                                        formatCurrency(advance.amount) }}</div>
                                    <VChip :color="getStatusColor(advance.status)" size="x-small" variant="tonal">{{
                                        getStatusText(advance.status) }}</VChip>
                                    <div class="d-flex gap-1 justify-end mt-2">
                                        <VBtn icon="ri-pencil-line" size="x-small" variant="text" color="primary"
                                            @click="openAdvanceDialog(advance)" />
                                        <VBtn icon="ri-delete-bin-line" size="x-small" variant="text" color="error"
                                            @click="openAdvanceDeleteDialog(advance)" />
                                    </div>
                                </div>
                            </template>
                        </VListItem>
                    </VList>
                </VWindowItem>

                <VWindowItem value="payments">
                    <div class="d-flex align-center justify-space-between mb-4">
                        <h3 class="text-h6 font-weight-bold">Pagos</h3>
                        <VBtn color="success" variant="elevated" prepend-icon="ri-add-line"
                            @click="openPaymentDialog()">Nuevo</VBtn>
                    </div>
                    <VList border class="rounded-lg">
                        <VListItem v-for="payment in payments" :key="payment.id" class="pa-4 transaction-row">
                            <VListItemTitle class="color-title text-h6 text-uppercase">{{
                                payment.description }}
                            </VListItemTitle>
                            <VListItemSubtitle class="text-caption">
                                {{ payment.employee?.name }} • {{ payment.payment_date?.split('T')[0] }}
                            </VListItemSubtitle>
                            <template #append>
                                <div class="text-right">
                                    <div class="text-h6 font-weight-black text-success-dark">{{
                                        formatCurrency(payment.amount) }}</div>
                                    <VChip :color="getPaymentTypeColor(payment.payment_type)" size="x-small"
                                        variant="tonal">{{ getPaymentTypeText(payment.payment_type) }}</VChip>
                                    <div class="d-flex gap-1 justify-end mt-2">
                                        <VBtn icon="ri-pencil-line" size="x-small" variant="text" color="primary"
                                            @click="openPaymentDialog(payment)" />
                                        <VBtn icon="ri-delete-bin-line" size="x-small" variant="text" color="error"
                                            @click="openPaymentDeleteDialog(payment)" />
                                    </div>
                                </div>
                            </template>
                        </VListItem>
                    </VList>
                </VWindowItem>
            </VWindow>
        </VCard>

        <EmployeeAddDialog v-if="isAddDialogVisible" v-model:isDialogVisible="isAddDialogVisible"
            @addEmployee="onSuccessAction" />
        <EmployeeEditDialog v-if="selectedEmployee" v-model:isDialogVisible="isEditDialogVisible"
            :employeeData="selectedEmployee" @editEmployee="onSuccessAction" />
        <EmployeeShowDialog v-if="selectedEmployee" v-model:isDialogVisible="isShowDialogVisible"
            :employeeData="selectedEmployee" />
        <EmployeeDeleteDialog v-if="selectedEmployee" v-model:isDialogVisible="isDeleteDialogVisible"
            :employeeData="selectedEmployee" @deleteEmployee="onSuccessAction" />
        <EmployeeAdvanceDialog v-model="isAdvanceDialogVisible" :advanceData="selectedAdvance" :employees="employees"
            @success="onSuccessAction" />
        <EmployeeAdvanceDeleteDialog v-model="isAdvanceDeleteDialogVisible" :advanceData="selectedAdvance"
            @success="onSuccessAction" />
        <EmployeePaymentDialog v-model="isPaymentDialogVisible" :paymentData="selectedPayment" :employees="employees"
            @success="onSuccessAction" />
        <EmployeePaymentDeleteDialog v-model="isPaymentDeleteDialogVisible" :paymentData="selectedPayment"
            @success="onSuccessAction" />
    </div>
</template>

<style scoped>
.employees-dashboard {
    background-color: #f8fafc;
    min-height: 100vh;
}

.color-title {
    color: #0f172a;
}

/* Control de texto largo para la sucursal */
.sucursal-text {
    max-width: 350px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
}

/* Colores Pastel Suaves */
.soft-warning-card {
    background-color: #fff9e6 !important;
    border-color: #ffe082 !important;
}

.text-warning-dark {
    color: #b26a00 !important;
}

.soft-success-card {
    background-color: #e8f5e9 !important;
    border-color: #a5d6a7 !important;
}

.text-success-dark {
    color: #1b5e20 !important;
}

.soft-primary-card {
    background-color: #e3f2fd !important;
    border-color: #90caf9 !important;
}

.text-primary-dark {
    color: #0d47a1 !important;
}

.transaction-row {
    border-bottom: 1px solid #e2e8f0;
}

.transaction-row:last-child {
    border-bottom: none;
}

.gap-x-4 {
    column-gap: 16px;
}
</style>