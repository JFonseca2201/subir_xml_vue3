<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

// Importar diálogos de empleados
import EmployeeAddDialog from '@/components/inventory/employee/EmployeeAddDialog.vue'
import EmployeeEditDialog from '@/components/inventory/employee/EmployeeEditDialog.vue'
import EmployeeShowDialog from '@/components/inventory/employee/EmployeeShowDialog.vue'
import EmployeeListDialog from '@/components/inventory/employee/EmployeeListDialog.vue'
import EmployeeDeleteDialog from '@/components/inventory/employee/EmployeeDeleteDialog.vue'

// Estado
const loading = ref(false)
const selectedPeriod = ref('today')
const transactionType = ref('payroll')
const employees = ref([]);

// Estado de diálogos
const isAddDialogVisible = ref(false)
const isEditDialogVisible = ref(false)
const isShowDialogVisible = ref(false)
const isListDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const selectedEmployee = ref(null)

// Opciones de período
const periodOptions = [
    { title: 'Hoy', value: 'today' },
    { title: 'Esta semana', value: 'week' },
    { title: 'Este mes', value: 'month' },
    { title: 'Año', value: 'year' }
]

// Datos de adelantos, pagos y nómina
const advances = ref([])
const payments = ref([])
const payroll = ref([])

// Computed properties
const totalAdvances = computed(() => {
    return advances.value.reduce((sum, advance) => sum + advance.amount, 0)
})

const totalPayments = computed(() => {
    return payments.value.reduce((sum, payment) => sum + payment.amount, 0)
})

const totalPayroll = computed(() => {
    return payroll.value.reduce((sum, item) => sum + item.amount, 0)
})

const netEmployeeCost = computed(() => {
    return totalPayments.value - totalAdvances.value
})

// Métodos
const loadEmployeeData = async () => {
    loading.value = true
    try {
        // Cargar datos de empleados desde la API real
        const resp = await $api("employees", {
            method: "GET",
            onResponseError({ response }) {
                console.error('Error response:', response._data);
            },
        });


        if (resp.status === 200) {
            employees.value = resp.employees || [];
            console.log('Response:', resp);
        }

        // Mantener datos simulados para adelantos y pagos (pueden agregarse APIs más tarde)
        const mockAdvances = [
            { id: 1, description: 'Adelanto de sueldo', amount: 200.00, date: '2024-01-15', employee: 'Carlos Rodríguez', department: 'Ventas', reason: 'Emergencia médica', status: 'pending' },
            { id: 2, description: 'Adelanto para gastos', amount: 150.00, date: '2024-01-14', employee: 'Ana Martínez', department: 'Administración', reason: 'Viaje de trabajo', status: 'approved' }
        ]

        const mockPayments = [
            { id: 1, description: 'Pago de nómina', amount: 1500.00, date: '2024-01-15', employee: 'Carlos Rodríguez', department: 'Ventas', type: 'Quincenal', method: 'transferencia' },
            { id: 2, description: 'Pago de bono', amount: 250.00, date: '2024-01-15', employee: 'Ana Martínez', department: 'Administración', type: 'Bono productividad', method: 'efectivo' }
        ]

        advances.value = mockAdvances
        payments.value = mockPayments

    } catch (error) {
        console.error('Error al cargar datos de empleados:', error)
        // En caso de error crítico, usar datos simulados
        const mockPayroll = [
            { id: 1, name: 'Carlos Rodríguez', department: 'Ventas', position: 'Vendedor Senior', salary: 1500.00, type: 'Quincenal', status: 'Activo', hireDate: '2022-03-15', bankAccount: '0012345678' }
        ]
        payroll.value = mockPayroll
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

const getStatusColor = (status) => {
    const colors = {
        pending: 'warning',
        approved: 'success',
        rejected: 'error'
    }
    return colors[status] || 'grey'
}

const getStatusText = (status) => {
    const texts = {
        pending: 'Pendiente',
        approved: 'Aprobado',
        rejected: 'Rechazado'
    }
    return texts[status] || 'Desconocido'
}

const getPaymentMethodIcon = (method) => {
    const icons = {
        efectivo: 'ri-money-dollar-circle-line text-success',
        transferencia: 'ri-bank-line text-primary',
        cheque: 'ri-file-text-line text-info'
    }
    return icons[method] || 'ri-money-dollar-line'
}

// Métodos para manejar diálogos
const openAddDialog = () => {
    console.log("Dialog de agregar empleado abierto");
    isAddDialogVisible.value = true
}

const openEditDialog = (employee) => {
    selectedEmployee.value = employee
    isEditDialogVisible.value = true
}

const openShowDialog = (employee) => {
    selectedEmployee.value = employee
    isShowDialogVisible.value = true
}

const openListDialog = () => {
    isListDialogVisible.value = true
}

const openDeleteDialog = (employee) => {
    selectedEmployee.value = employee
    isDeleteDialogVisible.value = true
}

// Event handlers para los diálogos
const handleAddEmployee = (newEmployee) => {
    // Recargar datos después de agregar
    loadEmployeeData()
    console.log('Empleado agregado:', newEmployee)
}

const handleEditEmployee = (updatedEmployee) => {
    // Recargar datos después de editar
    loadEmployeeData()
    console.log('Empleado actualizado:', updatedEmployee)
}

const handleSelectEmployee = (employee) => {
    selectedEmployee.value = employee
    console.log('Empleado seleccionado:', employee)
}

const handleDeleteEmployee = (employeeId) => {
    // Recargar datos después de eliminar
    loadEmployeeData()
    console.log('Empleado eliminado:', employeeId)
}

// Montar componente
onMounted(() => {
    loadEmployeeData()
})
</script>

<template>
    <div class="employees-dashboard">
        <!-- Header -->
        <VCard class="mb-6" elevation="2">
            <VCardTitle class="d-flex align-center justify-space-between pa-4">
                <div class="d-flex align-center">
                    <VIcon icon="ri-group-line" size="32" color="primary" class="me-3" />
                    <div>
                        <h1 class="text-h4 font-weight-bold mb-1">Gestión de Empleados</h1>
                        <p class="text-body-2 text-medium-emphasis">Adelantos, pagos y control de nómina</p>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <VSelect v-model="selectedPeriod" :items="periodOptions" item-title="title" item-value="value"
                        label="Período" variant="outlined" density="compact" style="width: 150px" />
                    <VBtn color="primary" prepend-icon="ri-refresh-line" @click="loadEmployeeData" :loading="loading">
                        Actualizar
                    </VBtn>
                </div>
            </VCardTitle>
        </VCard>

        <!-- Resumen General -->
        <VRow class="mb-6">
            <VCol cols="12" md="4">
                <VCard class="elevation-2" variant="tonal" color="warning">
                    <VCardText class="text-center pa-4">
                        <VIcon icon="ri-hand-coin-line" size="32" color="warning" class="mb-2" />
                        <div class="text-h6 font-weight-bold mb-1">Total Adelantos</div>
                        <div class="text-h4 font-weight-bold text-warning">
                            {{ formatCurrency(totalAdvances) }}
                        </div>
                        <div class="text-caption">{{ advances.length }} solicitudes</div>
                    </VCardText>
                </VCard>
            </VCol>
            <VCol cols="12" md="4">
                <VCard class="elevation-2" variant="tonal" color="success">
                    <VCardText class="text-center pa-4">
                        <VIcon icon="ri-money-dollar-box-line" size="32" color="success" class="mb-2" />
                        <div class="text-h6 font-weight-bold mb-1">Total Pagos</div>
                        <div class="text-h4 font-weight-bold text-success">
                            {{ formatCurrency(totalPayments) }}
                        </div>
                        <div class="text-caption">{{ payments.length }} pagos realizados</div>
                    </VCardText>
                </VCard>
            </VCol>
            <VCol cols="12" md="4">
                <VCard class="elevation-2" variant="tonal" color="primary">
                    <VCardText class="text-center pa-4">
                        <VIcon icon="ri-calculator-line" size="32" color="primary" class="mb-2" />
                        <div class="text-h6 font-weight-bold mb-1">Costo Neto</div>
                        <div class="text-h4 font-weight-bold text-primary">
                            {{ formatCurrency(netEmployeeCost) }}
                        </div>
                        <div class="text-caption">Pagos - Adelantos</div>
                    </VCardText>
                </VCard>
            </VCol>
        </VRow>

        <!-- Contenido Principal -->
        <VCard class="elevation-2">
            <VCardTitle class="pa-3">
                <div class="d-flex align-center">
                    <VIcon icon="ri-exchange-line" size="20" class="me-2" />
                    <span class="text-h6">Operaciones de Empleados</span>
                </div>
            </VCardTitle>

            <VCardText class="pa-4">
                <!-- Tabs -->
                <VTabs v-model="transactionType" class="mb-4">
                    <VTab value="payroll">
                        <VIcon icon="ri-file-list-3-line" class="me-1" />
                        Nómina
                    </VTab>
                    <VTab value="advances">
                        <VIcon icon="ri-hand-coin-line" class="me-1" />
                        Adelantos
                    </VTab>
                    <VTab value="payments">
                        <VIcon icon="ri-money-dollar-box-line" class="me-1" />
                        Pagos
                    </VTab>
                </VTabs>

                <!-- Contenido de los tabs -->
                <VWindow v-model="transactionType">
                    <!-- Tab de Adelantos -->
                    <VWindowItem value="advances">
                        <div class="mb-3">
                            <div class="d-flex align-center justify-space-between mb-2">
                                <h3 class="text-h6 font-weight-bold">Solicitudes de Adelanto</h3>
                                <VBtn color="warning" variant="tonal" size="small" prepend-icon="ri-add-line">
                                    Nuevo Adelanto
                                </VBtn>
                            </div>
                            <VCard variant="outlined">
                                <VList>
                                    <VListItem v-for="advance in advances" :key="advance.id">
                                        <template #prepend>
                                            <VIcon icon="ri-hand-coin-line text-warning" size="20" />
                                        </template>
                                        <VListItemTitle>
                                            {{ advance.description }}
                                        </VListItemTitle>
                                        <VListItemSubtitle>
                                            {{ advance.employee }} · {{ advance.department }} · {{ advance.date }}
                                        </VListItemSubtitle>
                                        <template #append>
                                            <div class="text-right">
                                                <div class="d-flex justify-end gap-1 mb-1">
                                                    <VChip :color="getStatusColor(advance.status)" size="small">
                                                        {{ getStatusText(advance.status) }}
                                                    </VChip>
                                                    <VChip color="warning" size="small" variant="tonal">
                                                        {{ advance.reason }}
                                                    </VChip>
                                                </div>
                                                <div class="text-warning font-weight-bold mb-1">
                                                    -{{ formatCurrency(advance.amount) }}
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

                    <!-- Tab de Pagos -->
                    <VWindowItem value="payments">
                        <div class="mb-3">
                            <div class="d-flex align-center justify-space-between mb-2">
                                <h3 class="text-h6 font-weight-bold">Pagos Realizados</h3>
                                <VBtn color="success" variant="tonal" size="small" prepend-icon="ri-add-line">
                                    Nuevo Pago
                                </VBtn>
                            </div>
                            <VCard variant="outlined">
                                <VList>
                                    <VListItem v-for="payment in payments" :key="payment.id">
                                        <template #prepend>
                                            <VIcon :icon="getPaymentMethodIcon(payment.method)" size="20" />
                                        </template>
                                        <VListItemTitle>
                                            {{ payment.description }}
                                        </VListItemTitle>
                                        <VListItemSubtitle>
                                            {{ payment.employee }} · {{ payment.department }} · {{ payment.date }}
                                        </VListItemSubtitle>
                                        <template #append>
                                            <div class="text-right">
                                                <div class="d-flex justify-end gap-1 mb-1">
                                                    <VChip color="primary" size="small">
                                                        {{ payment.type }}
                                                    </VChip>
                                                    <VChip :color="payment.method === 'efectivo' ? 'success' : 'info'"
                                                        size="small" variant="tonal">
                                                        {{ payment.method }}
                                                    </VChip>
                                                </div>
                                                <div class="text-error font-weight-bold mb-1">
                                                    -{{ formatCurrency(payment.amount) }}
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
                    <!-- Tab de Empleados -->
                    <VWindowItem value="payroll">
                        <div class="mb-3">
                            <div class="d-flex align-center justify-space-between mb-2">
                                <h3 class="text-h6 font-weight-bold">Listado de Empleados</h3>
                                <VBtn color="primary" variant="tonal" size="small" prepend-icon="ri-user-add-line"
                                    @click="openAddDialog">
                                    Agregar Empleado
                                </VBtn>
                            </div>
                            <VCard variant="outlined">
                                <VList>
                                    <VListItem v-if="employees && employees.length > 0" v-for="employee in employees"
                                        :key="employee.id">
                                        <template #prepend>
                                            <VIcon icon="ri-user-3-line text-primary" size="20" />
                                        </template>
                                        <VListItemTitle>
                                            {{ employee.name }} {{ employee.surname }}
                                        </VListItemTitle>
                                        <VListItemSubtitle>
                                            <div>
                                                {{ employee.position || 'N/A' }}
                                            </div>
                                            <div>
                                                {{ employee.sucursal?.name || 'N/A' }}
                                            </div>
                                            <div>
                                                {{ employee.hire_date ? employee.hire_date.split('T')[0] : 'N/A' }}
                                            </div>
                                        </VListItemSubtitle>
                                        <template #append>
                                            <div class="text-right">
                                                <div class="d-flex justify-end gap-1 mb-1">
                                                    <VChip :color="employee.status === 1 ? 'success' : 'error'"
                                                        size="small">
                                                        {{ employee.status === 1 ? 'Activo' : 'Inactivo' }}
                                                    </VChip>
                                                    <VChip color="info" size="small" variant="tonal">
                                                        Mensual
                                                    </VChip>
                                                </div>
                                                <div class="text-primary font-weight-bold mb-1">
                                                    {{ employee.bank_name }}
                                                </div>
                                                <div class="text-caption text-medium-emphasis mb-1">
                                                    Cta: {{ employee.account_number }}
                                                </div>
                                                <div class="d-flex gap-1">
                                                    <VBtn color="primary" variant="tonal" size="x-small"
                                                        icon="ri-edit-line" @click="openEditDialog(employee)" />
                                                    <VBtn color="error" variant="tonal" size="x-small"
                                                        icon="ri-delete-bin-line" @click="openDeleteDialog(employee)" />
                                                </div>
                                            </div>
                                        </template>
                                    </VListItem>

                                    <!-- Mensaje cuando no hay empleados -->
                                    <VListItem v-if="!employees || employees.length === 0">
                                        <template #prepend>
                                            <VIcon icon="ri-user-unfollow-line text-warning" size="20" />
                                        </template>
                                        <VListItemTitle class="text-warning">
                                            No existe nómina registrada
                                        </VListItemTitle>
                                        <VListItemSubtitle>
                                            No hay empleados registrados en el sistema.
                                            Haga clic en "Agregar Empleado" para comenzar.
                                        </VListItemSubtitle>
                                    </VListItem>
                                </VList>
                            </VCard>
                        </div>
                    </VWindowItem>
                </VWindow>
            </VCardText>
        </VCard>
    </div>

    <!-- Diálogos de Empleados -->
    <EmployeeAddDialog v-if="isAddDialogVisible" v-model:isDialogVisible="isAddDialogVisible"
        @addEmployee="handleAddEmployee" />

    <EmployeeEditDialog v-if="selectedEmployee" v-model:isDialogVisible="isEditDialogVisible"
        :employeeData="selectedEmployee" @editEmployee="handleEditEmployee" />

    <EmployeeShowDialog v-if="selectedEmployee" v-model:isDialogVisible="isShowDialogVisible"
        :employeeData="selectedEmployee" />

    <EmployeeListDialog v-if="isListDialogVisible" v-model:isDialogVisible="isListDialogVisible"
        @selectEmployee="handleSelectEmployee" />

    <EmployeeDeleteDialog v-if="selectedEmployee" v-model:isDialogVisible="isDeleteDialogVisible"
        :employeeData="selectedEmployee" @deleteEmployee="handleDeleteEmployee" />
</template>

<style scoped>
.employees-dashboard {
    padding: 0;
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

.text-primary {
    color: #1976d2 !important;
}

/* Responsive */
@media (max-width: 1280px) {
    .employees-dashboard .v-row>.v-col {
        margin-bottom: 16px;
    }
}
</style>
