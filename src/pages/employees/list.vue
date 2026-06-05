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
  status: 'active', // active, inactive, all
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
  to: 0,
})

// Opciones de estado
const statusOptions = [
  { label: 'Activos', value: 'active' },
  { label: 'Inactivos', value: 'inactive' },
  { label: 'Todos', value: 'all' },
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
  { title: 'Acciones', key: 'actions', sortable: false, width: '120px' },
]

// Métodos
const openCreateDialog = () => {
  createDialog.value = true
}

const openEditDialog = employee => {
  employeeToEdit.value = employee
  editDialog.value = true
}

const openViewDialog = employee => {
  employeeToView.value = employee
  viewDialog.value = true
}

const onEmployeeCreated = createdEmployee => {
  // Recargar la lista para mostrar el nuevo empleado
  searchEmployees()
}

const onEmployeeUpdated = updatedEmployee => {
  // Recargar la lista para mostrar los cambios
  searchEmployees()
}

const searchEmployees = async () => {
  loader.start()
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage.value,
      ...searchForm.value,
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
        to: response.to || 0,
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
    status: 'active',
  }
  currentPage.value = 1
  searchEmployees()
}

const addEmployee = () => {
  openCreateDialog()
}

const editEmployee = employee => {
  openEditDialog(employee)
}

const viewEmployee = employee => {
  openViewDialog(employee)
}

const deleteEmployee = employee => {
  openDeleteDialog(employee)
}

const restoreEmployee = async employee => {
  try {
    await $api(`employees/${employee.id}/restore`, {
      method: 'POST',
    })

    // Recargar la lista para reflejar los cambios
    searchEmployees()

    console.log('Empleado restaurado exitosamente')
  } catch (error) {
    console.error('Error al restaurar empleado:', error)
  }
}

const onEmployeeDeleted = deletedEmployee => {
  // Recargar la lista para mostrar los cambios
  searchEmployees()
}

const formatSalary = salary => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
  }).format(salary)
}

const closeCreateDialog = () => {
  createDialog.value = false
}

const openDeleteDialog = employee => {
  employeeToDelete.value = employee
  deleteDialog.value = true
}

const getStatusColor = status => {
  return status === 'active' ? 'success' : 'error'
}

const getStatusText = status => {
  return status === 'active' ? 'Activo' : 'Inactivo'
}

// Watcher para resetear página cuando los filtros cambian (con debounce)
let searchTimeout = null
watch([() => searchForm.value.search, () => searchForm.value.status], () => {
  currentPage.value = 1
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchEmployees()
  }, 500)
}, { deep: true })

// Montar componente
onMounted(() => {
  searchEmployees()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 employees-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-user-settings-line" color="primary" class="me-2" size="28" />
          Empleados
        </h1>
        <p class="text-medium-emphasis mb-0">
          Gestión de empleados y personal del taller
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn color="primary" prepend-icon="ri-add-line" @click="addEmployee">
          Agregar Empleado
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12" md="8">
            <VTextField v-model="searchForm.search" label="Búsqueda General"
              placeholder="Identificación, nombre, email, cargo..." prepend-inner-icon="ri-search-line"
              variant="outlined" density="comfortable" hide-details="auto" clearable color="primary" />
          </VCol>

          <VCol cols="12" md="4">
            <VSelect v-model="searchForm.status" :items="statusOptions" item-title="label" item-value="value"
              label="Estado" placeholder="Todos" prepend-inner-icon="ri-filter-line" variant="outlined"
              density="comfortable" hide-details="auto" clearable color="primary" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Empleados -->
      <div class="position-relative">
        <VProgressLinear v-if="loader.loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div class="overflow-x-auto">
          <VTable hover class="employees-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">
                  IDENTIFICACIÓN
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 180px;">
                  NOMBRE
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 180px;">
                  APELLIDO
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">
                  EMAIL
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">
                  CARGO
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 120px;">
                  ESTADO
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody v-if="loader.loading">
              <tr>
                <td colspan="7" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">
                    Cargando registros...
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!employees || employees.length === 0">
              <tr>
                <td colspan="7" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">
                    ri-user-unfollow-line
                  </VIcon>
                  <div class="text-h6">
                    No se encontraron empleados
                  </div>
                  <div class="text-body-2">
                    Intenta ajustar los filtros de búsqueda
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="item in employees" :key="item.id" class="employees-row align-middle">
                <!-- Identificación -->
                <td class="text-no-wrap text-left py-3">
                  <span class="font-weight-bold text-subtitle-1 text-primary">{{ item.identification }}</span>
                </td>

                <!-- Nombre -->
                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4">{{ item.first_name }}</span>
                </td>

                <!-- Apellido -->
                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3">{{ item.last_name }}</span>
                </td>

                <!-- Email -->
                <td class="text-left py-3" style="max-width: 250px;">
                  <span class="text-body-2 text-grey-darken-3 text-truncate" :title="item.email">{{ item.email }}</span>
                </td>

                <!-- Cargo -->
                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3">{{ item.position || '-' }}</span>
                </td>

                <!-- Estado -->
                <td class="text-no-wrap text-center py-3">
                  <VChip :color="getStatusColor(item.deleted_at ? 'inactive' : 'active')" variant="tonal" size="small">
                    {{ getStatusText(item.deleted_at ? 'inactive' : 'active') }}
                  </VChip>
                </td>

                <!-- Acciones -->
                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <!-- Ver Detalle -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver Detalle"
                      @click="viewEmployee(item)">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>

                    <!-- Editar -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="warning" title="Editar"
                      @click="editEmployee(item)">
                      <VIcon icon="ri-edit-line" size="20" />
                    </VBtn>

                    <!-- Eliminar o Restaurar -->
                    <VBtn v-if="searchForm.status === 'active'" class="action-btn" variant="text" icon size="small"
                      color="error" title="Eliminar" @click="deleteEmployee(item)">
                      <VIcon icon="ri-delete-bin-line" size="20" />
                    </VBtn>
                    <VBtn v-else class="action-btn" variant="text" icon size="small" color="success"
                      title="Restaurar empleado" @click="restoreEmployee(item)">
                      <VIcon icon="ri-refresh-line" size="20" />
                    </VBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ employees.length }}</span> de <span class="font-weight-bold">{{
              totalItems }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="searchEmployees" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Diálogo de Eliminación de Empleado -->
    <EmployeeDeleteDialog v-model="deleteDialog" :employee="employeeToDelete" @employee-deleted="onEmployeeDeleted" />

    <!-- Diálogo de Vista de Empleado -->
    <EmployeeViewDialog v-model="viewDialog" :employee="employeeToView" />

    <!-- Diálogo de Creación de Empleado -->
    <EmployeeCreateDialog v-model="createDialog" @employee-created="onEmployeeCreated" />

    <!-- Diálogo de Edición de Empleado -->
    <EmployeeEditDialog v-model="editDialog" :employee="employeeToEdit" @employee-updated="onEmployeeUpdated" />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de empleados */
.employees-table :deep(thead) {
  background-color: #f8fafc !important;
}

.employees-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.employees-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.employees-row:hover {
  background-color: #f8fafc !important;
}

.action-btn {
  transition: all 0.2s ease;
  border-radius: 6px !important;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}
</style>
