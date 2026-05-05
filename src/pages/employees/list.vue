<script setup>
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
})
</script>

<template>
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
    </div>
</template>

<style scoped>
/* Estilos específicos si son necesarios */
</style>
