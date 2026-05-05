<script setup>
<<<<<<< HEAD
import { ref, onMounted, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import EmployeeCreateDialog from '@/components/inventory/employees/EmployeeCreateDialog.vue'
import EmployeeEditDialog from '@/components/inventory/employees/EmployeeEditDialog.vue'
import EmployeeViewDialog from '@/components/inventory/employees/EmployeeViewDialog.vue'
import EmployeeDeleteDialog from '@/components/inventory/employees/EmployeeDeleteDialog.vue'

// Loader y notificaciones
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Estado
const loading = ref(false)
const employees = ref([])
const searchFormRef = ref(null)
const selectedEmployee = ref(null)

// Diálogos
const createDialog = ref(false)
const editDialog = ref(false)
const viewDialog = ref(false)
const deleteDialog = ref(false)
const employeeToEdit = ref(null)
const employeeToView = ref(null)
const employeeToDelete = ref(null)

// Formulario de búsqueda
const searchForm = ref({
    search: '',
    status: 'active' // active, inactive, all
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalItems = ref(0)
const totalPages = ref(0)
const pagination = ref({
    total: 0,
    per_page: 10,
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0
})

// Opciones de estado
const statusOptions = [
    { label: 'Activos', value: 'active' },
    { label: 'Inactivos', value: 'inactive' },
    { label: 'Todos', value: 'all' }
]

// Headers de la tabla
const headers = [
    { title: 'Identificación', key: 'identification', sortable: false },
    { title: 'Nombre', key: 'first_name', sortable: false },
    { title: 'Apellido', key: 'last_name', sortable: false },
    { title: 'Email', key: 'email', sortable: false },
    { title: 'Cargo', key: 'position', sortable: false },
    { title: 'Salario', key: 'salary', sortable: false, align: 'end' },
    { title: 'Estado', key: 'status', sortable: false, width: '100px' },
    { title: 'Acciones', key: 'actions', sortable: false, width: '120px' }
]

// Métodos
const openCreateDialog = () => {
    createDialog.value = true
}

const openEditDialog = (employee) => {
    employeeToEdit.value = employee
    editDialog.value = true
}

const openViewDialog = (employee) => {
    employeeToView.value = employee
    viewDialog.value = true
}

const onEmployeeCreated = (createdEmployee) => {
    // Recargar la lista para mostrar el nuevo empleado
    searchEmployees()
}

const onEmployeeUpdated = (updatedEmployee) => {
    // Recargar la lista para mostrar los cambios
    searchEmployees()
}

const searchEmployees = async () => {
    loader.start()
    try {
        const params = {
            page: currentPage.value,
            per_page: itemsPerPage.value,
            ...searchForm.value
        }

        // Eliminar parámetros nulos o vacíos
        Object.keys(params).forEach(key => {
            if (params[key] === null || params[key] === '') {
                delete params[key]
            }
        })

        const response = await $api('employees', { params })

        if (response.status === 200) {
            employees.value = response.employees || []
            totalItems.value = response.total || 0
            totalPages.value = response.total_pages || 0
            pagination.value = {
                total: response.total || 0,
                per_page: response.per_page || 10,
                current_page: response.current_page || 1,
                last_page: response.total_pages || 1,
                from: response.from || 0,
                to: response.to || 0
            }
        }
    } catch (error) {
        console.error('Error al buscar empleados:', error)
        showNotification('Error al cargar empleados', 'error')
    } finally {
        loader.stop()
    }
}

const clearSearch = () => {
    searchForm.value = {
        search: '',
        status: 'active'
    }
    currentPage.value = 1
    searchEmployees()
}

const addEmployee = () => {
    openCreateDialog()
}

const editEmployee = (employee) => {
    openEditDialog(employee)
}

const viewEmployee = (employee) => {
    openViewDialog(employee)
}

const deleteEmployee = (employee) => {
    openDeleteDialog(employee)
}

const restoreEmployee = async (employee) => {
    try {
        await $api(`employees/${employee.id}/restore`, {
            method: 'POST'
        })

        // Recargar la lista para reflejar los cambios
        searchEmployees()

        console.log('Empleado restaurado exitosamente')
    } catch (error) {
        console.error('Error al restaurar empleado:', error)
    }
}

const onEmployeeDeleted = (deletedEmployee) => {
    // Recargar la lista para mostrar los cambios
    searchEmployees()
}

const formatSalary = (salary) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
    }).format(salary)
}

const closeCreateDialog = () => {
    createDialog.value = false
}

const openDeleteDialog = (employee) => {
    employeeToDelete.value = employee
    deleteDialog.value = true
}

const getStatusColor = (status) => {
    return status === 'active' ? 'success' : 'error'
}

const getStatusText = (status) => {
    return status === 'active' ? 'Activo' : 'Inactivo'
}

// Watcher para resetear página cuando los filtros cambian
watch([() => searchForm.value.search, () => searchForm.value.status], () => {
    currentPage.value = 1
    searchEmployees()
}, { deep: true })

// Montar componente
onMounted(() => {
    searchEmployees()
=======
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
>>>>>>> 080ee9e2f24bd3319718de13730fec91b70fc55d
})
</script>

<template>
<<<<<<< HEAD
    <div class="pa-4 pa-sm-6">
        <!-- Formulario de Búsqueda -->
        <VCard class="pa-6 pa-sm-8 rounded-lg elevation-4 max-w-1200 mx-auto" elevation="2">
            <!-- Título y Botón Agregar -->
            <div class="d-flex justify-space-between align-center mb-6">
                <h1 class="text-h4 font-weight-bold">Gestión de Empleados</h1>
                <VBtn color="primary" prepend-icon="ri-add-line" @click="addEmployee">
                    Agregar Empleado
                </VBtn>
            </div>
            <VDivider />

            <VCardText class="pa-4">
                <VForm ref="searchFormRef" @submit.prevent="searchEmployees">
                    <VRow>
                        <!-- Búsqueda General -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="searchForm.search" label="Búsqueda General"
                                placeholder="Buscar por identificación, nombre, email, cargo..."
                                prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable"
                                hide-details="auto" clearable />
                        </VCol>

                        <!-- Estado -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="searchForm.status" :items="statusOptions" item-title="label"
                                item-value="value" label="Estado" placeholder="Seleccionar"
                                prepend-inner-icon="ri-filter-line" variant="outlined" density="comfortable"
                                hide-details="auto" />
                        </VCol>

                        <!-- Botones de Acción -->
                        <VCol cols="12" md="3" class="d-flex gap-2">
                            <VBtn type="submit" color="primary" variant="tonal" prepend-icon="ri-search-line"
                                :loading="loader.loading">
                                Buscar
                            </VBtn>
                            <VBtn variant="outlined" prepend-icon="ri-refresh-line" @click="clearSearch">
                                Limpiar
                            </VBtn>
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>

            <VDivider />

            <!-- Tabla de Empleados -->
            <VTable>
                <thead>
                    <tr>
                        <th>Identificación</th>
                        <th>Nombre</th>
                        <th>Apellido</th>
                        <th>Email</th>
                        <th>Cargo</th>
                        <!-- <th>Salario</th> -->
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loader.loading">
                        <td colspan="8" class="text-center pa-4">
                            <VProgressCircular indeterminate color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="employees.length === 0">
                        <td colspan="8" class="text-center pa-4 text-medium-emphasis">
                            <VIcon size="32" class="mb-2">ri-user-unfollow-line</VIcon>
                            <div>No se encontraron empleados</div>
                        </td>
                    </tr>
                    <tr v-for="item in employees" :key="item.id">
                        <!-- Identificación -->
                        <td>{{ item.identification }}</td>

                        <!-- Nombre -->
                        <td>
                            <div class="font-weight-medium">{{ item.first_name }}</div>
                        </td>

                        <!-- Apellido -->
                        <td>{{ item.last_name }}</td>

                        <!-- Email -->
                        <td>{{ item.email }}</td>

                        <!-- Cargo -->
                        <td>{{ item.position }}</td>

                        <!-- Salario -->
                        <!--  <td>
                            <div class="text-right">
                                <div class="font-weight-medium">
                                    {{ formatSalary(item.salary) }}
                                </div>
                            </div>
                        </td> -->

                        <!-- Estado -->
                        <td>
                            <VChip :color="getStatusColor(item.deleted_at ? 'inactive' : 'active')" variant="tonal"
                                size="small">
                                {{ getStatusText(item.deleted_at ? 'inactive' : 'active') }}
                            </VChip>
                        </td>

                        <!-- Acciones -->
                        <td>
                            <div class="d-flex gap-1">
                                <VBtn icon="ri-eye-line" variant="text" size="small" color="primary"
                                    @click="viewEmployee(item)" />
                                <VBtn icon="ri-edit-line" variant="text" size="small" color="warning"
                                    @click="editEmployee(item)" />

                                <!-- Botón de eliminar o restaurar según el estado -->
                                <VBtn v-if="searchForm.status === 'active'" icon="ri-delete-bin-line" variant="text"
                                    size="small" color="error" @click="deleteEmployee(item)" />
                                <VBtn v-else icon="ri-refresh-line" variant="text" size="small" color="success"
                                    @click="restoreEmployee(item)" title="Restaurar empleado" />
                            </div>
                        </td>
                    </tr>
                </tbody>
            </VTable>

            <!-- Paginación -->
            <VDivider />
            <div class="d-flex justify-center pa-4">
                <VPagination v-model="currentPage" :length="totalPages" :total-visible="7"
                    @update:model-value="searchEmployees" />
            </div>
        </VCard>

        <!-- Diálogo de Eliminación de Empleado -->
        <EmployeeDeleteDialog v-model="deleteDialog" :employee="employeeToDelete"
            @employee-deleted="onEmployeeDeleted" />

        <!-- Diálogo de Vista de Empleado -->
        <EmployeeViewDialog v-model="viewDialog" :employee="employeeToView" />

        <!-- Diálogo de Creación de Empleado -->
        <EmployeeCreateDialog v-model="createDialog" @employee-created="onEmployeeCreated" />

        <!-- Diálogo de Edición de Empleado -->
        <EmployeeEditDialog v-model="editDialog" :employee="employeeToEdit" @employee-updated="onEmployeeUpdated" />
=======
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
>>>>>>> 080ee9e2f24bd3319718de13730fec91b70fc55d
    </div>
</template>

<style scoped>
<<<<<<< HEAD
/* Estilos específicos si son necesarios */
</style>
=======
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
>>>>>>> 080ee9e2f24bd3319718de13730fec91b70fc55d
