<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import EmployeeCreateDialog from '@/components/inventory/employees/EmployeeCreateDialog.vue'
import EmployeeEditDialog from '@/components/inventory/employees/EmployeeEditDialog.vue'
import EmployeeViewDialog from '@/components/inventory/employees/EmployeeViewDialog.vue'
import EmployeeDeleteDialog from '@/components/inventory/employees/EmployeeDeleteDialog.vue'
import { usePermissions } from '@/composables/usePermissions'

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const { can } = usePermissions()

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
  status: 'active',
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalItems = ref(0)
const totalPages = ref(0)

// Opciones de estado
const statusOptions = [
  { label: 'Activos', value: 'active' },
  { label: 'Inactivos', value: 'inactive' },
  { label: 'Todos', value: 'all' },
]

// Métricas computadas
const activeEmployeesCount = computed(() => {
  return employees.value.filter(e => e.status === 'active' || e.status === 1 || e.status === '1').length
})

const uniquePositionsCount = computed(() => {
  const positions = new Set(employees.value.map(e => e.position).filter(Boolean))
  return positions.size
})

const hasActiveFilters = computed(() => {
  return !!(
    (searchForm.value.search && searchForm.value.search.trim()) ||
    (searchForm.value.status && searchForm.value.status !== 'active')
  )
})

const resetFilters = () => {
  searchForm.value = {
    search: '',
    status: 'active',
  }
  currentPage.value = 1
  searchEmployees()
}

const getEmployeeInitials = (first, last) => {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  return 'EM'
}

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

const openDeleteDialog = employee => {
  employeeToDelete.value = employee
  deleteDialog.value = true
}

const onEmployeeCreated = () => {
  searchEmployees()
}

const onEmployeeUpdated = () => {
  searchEmployees()
}

const onEmployeeDeleted = () => {
  searchEmployees()
}

const searchEmployees = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage.value,
      ...searchForm.value,
    }

    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === '') {
        delete params[key]
      }
    })

    const response = await $api('employees', { params })

    if (response.status === 200 || response.employees) {
      employees.value = response.employees || []
      totalItems.value = response.total || 0
      totalPages.value = response.total_pages || response.last_page || 1
    }
  } catch (error) {
    console.error('Error al buscar empleados:', error)
    showNotification('Error al cargar empleados', 'error')
  } finally {
    loading.value = false
  }
}

let searchTimeout = null
watch([() => searchForm.value.search, () => searchForm.value.status], () => {
  currentPage.value = 1
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchEmployees()
  }, 400)
}, { deep: true })

watch(currentPage, () => {
  searchEmployees()
})

onMounted(() => {
  searchEmployees()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 employees-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-user-settings-line" size="26" />
          </VAvatar>
          Gestión de Empleados
        </h1>
        <p class="text-medium-emphasis mb-0">
          Directorio de personal operativo y administrativo del taller
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          v-if="can('register_employee')"
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="openCreateDialog"
        >
          Nuevo Empleado
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-user-star-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Empleados Registrados</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ totalItems }} <span class="text-caption text-disabled font-weight-regular">en sistema</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-user-follow-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Empleados Activos</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ activeEmployeesCount }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-briefcase-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Cargos / Especialidades</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ uniquePositionsCount }} <span class="text-caption text-disabled font-weight-regular">cargos distintos</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon icon="ri-filter-3-line" size="18" color="primary" />
            <span>Filtros de Búsqueda</span>
          </div>

          <VBtn
            v-if="hasActiveFilters"
            variant="text"
            color="error"
            size="small"
            prepend-icon="ri-filter-off-line"
            class="font-weight-semibold"
            @click="resetFilters"
          >
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow dense class="gap-y-3">
          <VCol cols="12" md="8">
            <VTextField
              v-model="searchForm.search"
              label="Buscar empleado"
              placeholder="Identificación, nombre, apellido, cargo o email..."
              prepend-inner-icon="ri-search-2-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              :loading="loading"
            />
          </VCol>

          <VCol cols="12" md="4">
            <VSelect
              v-model="searchForm.status"
              :items="statusOptions"
              item-title="label"
              item-value="value"
              label="Estado Laboral"
              placeholder="Todos"
              prepend-inner-icon="ri-toggle-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              color="primary"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ESTADO DE CARGA -->
    <VCard v-if="loading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-75" /></td>
            <td class="py-4"><div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-60" /></td>
            <td class="py-4"><div class="shimmer-line w-50" /></td>
            <td class="py-4" style="width: 120px;"><div class="shimmer-chip mx-auto" /></td>
            <td class="py-4 text-center" style="width: 130px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!employees || employees.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-user-unfollow-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron empleados
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los filtros de búsqueda o registra un nuevo empleado al personal.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_employee')" color="primary" prepend-icon="ri-add-line" @click="openCreateDialog">
          Nuevo Empleado
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE EMPLEADOS -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="employees-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 160px;">
                Identificación
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Empleado
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 240px;">
                Email
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 180px;">
                Cargo / Puesto
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Estado
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in employees" :key="item.id" class="employee-table-row">
              <!-- Identificación -->
              <td class="py-3">
                <span class="font-weight-bold text-high-emphasis font-mono">
                  {{ item.identification || 'Sin cédula' }}
                </span>
              </td>

              <!-- Empleado -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar size="38" color="primary" variant="tonal" rounded="lg" class="font-weight-bold elevation-0">
                    <span>{{ getEmployeeInitials(item.first_name, item.last_name) }}</span>
                  </VAvatar>
                  <div>
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                      {{ item.first_name }} {{ item.last_name }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Email -->
              <td class="py-3">
                <span class="text-body-2 text-medium-emphasis text-truncate" style="max-width: 230px;" :title="item.email">
                  {{ item.email || '-' }}
                </span>
              </td>

              <!-- Cargo (Texto limpio, sin vchip) -->
              <td class="py-3">
                <span class="text-body-2 font-weight-medium text-high-emphasis text-uppercase">
                  {{ item.position || 'No especificado' }}
                </span>
              </td>

              <!-- Estado -->
              <td class="text-center">
                <VChip
                  :color="item.status === 'active' || item.status === 1 || item.status === '1' ? 'success' : 'error'"
                  size="small"
                  variant="tonal"
                  class="font-weight-semibold"
                >
                  <VIcon :icon="item.status === 'active' || item.status === 1 || item.status === '1' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'" size="14" class="me-1" />
                  {{ item.status === 'active' || item.status === 1 || item.status === '1' ? 'ACTIVO' : 'INACTIVO' }}
                </VChip>
              </td>

              <!-- Acciones -->
              <td class="text-center">
                <div class="d-flex justify-center align-center gap-1">
                  <VBtn
                    size="small"
                    color="info"
                    variant="tonal"
                    icon="ri-eye-line"
                    title="Ver Ficha de Empleado"
                    @click="openViewDialog(item)"
                  />
                  <VBtn
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Empleado"
                    @click="openEditDialog(item)"
                  />
                  <VBtn
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Empleado"
                    @click="openDeleteDialog(item)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ employees.length }}</strong> de <strong class="text-high-emphasis">{{ totalItems }}</strong> empleados
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            color="primary"
            @update:model-value="searchEmployees"
          />
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <EmployeeCreateDialog
      v-model:isDialogVisible="createDialog"
      @employee-created="onEmployeeCreated"
    />
    <EmployeeEditDialog
      v-model:isDialogVisible="editDialog"
      :employee="employeeToEdit"
      @employee-updated="onEmployeeUpdated"
    />
    <EmployeeViewDialog
      v-model:isDialogVisible="viewDialog"
      :employee="employeeToView"
    />
    <EmployeeDeleteDialog
      v-model:isDialogVisible="deleteDialog"
      :employee="employeeToDelete"
      @employee-deleted="onEmployeeDeleted"
    />
  </div>
</template>

<style scoped lang="scss">
.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.employee-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}
</style>
