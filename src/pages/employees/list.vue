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

// Helper para saber si un empleado está activo (en base de datos usa deleted_at soft delete)
const isEmployeeActive = employee => {
  if (!employee) return false
  if (employee.deleted_at) return false
  if (employee.status !== undefined && employee.status !== null) {
    return employee.status === 'active' || employee.status === 1 || employee.status === '1'
  }
  
  return true
}

// Métricas computadas
const activeEmployeesCount = computed(() => {
  return employees.value.filter(e => isEmployeeActive(e)).length
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

// Métodos de diálogo
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

const restoreEmployee = async employee => {
  try {
    await $api(`employees/${employee.id}/restore`, {
      method: 'POST',
    })
    showNotification('Empleado restaurado exitosamente', 'success')
    searchEmployees()
  } catch (error) {
    console.error('Error al restaurar empleado:', error)
    showNotification('Error al restaurar empleado', 'error')
  }
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
          <VAvatar
            size="42"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="me-3"
          >
            <VIcon
              icon="ri-user-settings-line"
              size="26"
            />
          </VAvatar>
          Gestión de Empleados
        </h1>
        <p class="text-medium-emphasis mb-0 d-none d-sm-block">
          Directorio de personal operativo y administrativo del taller
        </p>
      </div>

      <div class="d-flex gap-2 flex-wrap w-100 w-md-auto align-center">
        <VBtn
          v-if="can('register_employee')"
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold flex-grow-1 flex-md-grow-0"
          @click="openCreateDialog"
        >
          Nuevo Empleado
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow
      class="mb-4 d-none d-sm-flex"
      dense
    >
      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-user-star-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Total Empleados
            </div>
            <div class="text-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ totalItems }} <span class="text-caption text-disabled font-weight-regular">en sistema</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="success"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-user-follow-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Empleados Activos
            </div>
            <div class="text-h6 font-weight-bold text-success text-truncate">
              {{ activeEmployeesCount }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="warning"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-briefcase-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Cargos / Especialidades
            </div>
            <div class="text-h6 font-weight-bold text-warning text-truncate">
              {{ uniquePositionsCount }} <span class="text-caption text-disabled font-weight-regular">distintos</span>
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
            <VIcon
              icon="ri-filter-3-line"
              size="18"
              color="primary"
            />
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

        <VRow
          dense
          class="gap-y-3"
        >
          <VCol
            cols="12"
            md="8"
          >
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

          <VCol
            cols="12"
            md="4"
          >
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

    <!-- ESTADO VACÍO (Solo si no está cargando y no hay empleados) -->
    <VCard
      v-if="!loading && (!employees || employees.length === 0)"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar
        size="76"
        color="primary"
        variant="tonal"
        class="mb-4"
      >
        <VIcon
          size="38"
          icon="ri-user-unfollow-line"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron empleados
      </h3>
      <p
        class="text-body-1 text-medium-emphasis mb-5 mx-auto"
        style="max-width: 480px;"
      >
        Intenta ajustar los filtros de búsqueda o registra un nuevo empleado al personal.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn
          v-if="hasActiveFilters"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="resetFilters"
        >
          Restablecer Filtros
        </VBtn>
        <VBtn
          v-if="can('register_employee')"
          color="primary"
          prepend-icon="ri-add-line"
          @click="openCreateDialog"
        >
          Nuevo Empleado
        </VBtn>
      </div>
    </VCard>

    <!-- LISTADO DE EMPLEADOS (MÓVIL Y ESCRITORIO CON SKELETON INTEGRADO) -->
    <div v-else>
      <!-- VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-3 mb-4">
        <!-- Skeleton Móvil mientras carga -->
        <template v-if="loading">
          <VCard
            v-for="n in 4"
            :key="'mob-skel-emp-' + n"
            class="mobile-employee-card elevation-0 pa-4"
          >
            <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b">
              <div
                class="shimmer-line"
                style="width: 100px; height: 16px;"
              />
              <div class="d-flex gap-1">
                <div
                  class="shimmer-button rounded"
                  style="width: 28px; height: 28px;"
                />
                <div
                  class="shimmer-button rounded"
                  style="width: 28px; height: 28px;"
                />
              </div>
            </div>
            <div class="d-flex align-center gap-3 mb-3">
              <div
                class="shimmer-circle"
                style="width: 40px; height: 40px; border-radius: 8px;"
              />
              <div class="flex-grow-1">
                <div
                  class="shimmer-line w-75 mb-2"
                  style="height: 16px;"
                />
                <div
                  class="shimmer-line w-40"
                  style="height: 12px;"
                />
              </div>
            </div>
            <div class="d-flex justify-space-between pt-2 border-t">
              <div
                class="shimmer-line"
                style="width: 70px; height: 16px;"
              />
              <div
                class="shimmer-chip"
                style="width: 70px; height: 24px;"
              />
            </div>
          </VCard>
        </template>

        <!-- Tarjetas reales de empleados -->
        <template v-else>
          <VCard
            v-for="item in employees"
            :key="'mob-emp-' + item.id"
            class="mobile-employee-card elevation-0"
          >
          <!-- Cabecera Móvil: Identificación + Acciones Rápidas -->
          <div class="d-flex align-center justify-space-between gap-2 mb-2 pb-2 border-b">
            <div class="d-flex align-center gap-1.5 min-w-0">
              <span class="text-caption text-disabled text-uppercase font-weight-bold">Cédula:</span>
              <span class="font-mono font-weight-bold text-high-emphasis text-body-2">
                {{ item.identification || 'Sin cédula' }}
              </span>
            </div>

            <!-- Botones de Acción Móvil -->
            <div class="d-flex align-center gap-1 flex-shrink-0">
              <VBtn
                size="x-small"
                color="info"
                variant="tonal"
                icon="ri-eye-line"
                title="Ver Ficha"
                @click="openViewDialog(item)"
              />
              <VBtn
                v-if="can('edit_employee')"
                size="x-small"
                color="warning"
                variant="tonal"
                icon="ri-pencil-line"
                title="Editar Empleado"
                @click="openEditDialog(item)"
              />
              <VBtn
                v-if="!isEmployeeActive(item) && can('edit_employee')"
                size="x-small"
                color="success"
                variant="tonal"
                icon="ri-refresh-line"
                title="Restaurar Empleado"
                @click="restoreEmployee(item)"
              />
              <VBtn
                v-else-if="can('delete_employee')"
                size="x-small"
                color="error"
                variant="tonal"
                icon="ri-delete-bin-line"
                title="Eliminar Empleado"
                @click="openDeleteDialog(item)"
              />
            </div>
          </div>

          <!-- Empleado y Cargo -->
          <div class="d-flex align-start gap-3 mb-2">
            <VAvatar
              size="40"
              color="primary"
              variant="tonal"
              rounded="lg"
              class="font-weight-bold elevation-0 flex-shrink-0 mt-0.5"
            >
              <span>{{ getEmployeeInitials(item.first_name, item.last_name) }}</span>
            </VAvatar>
            <div class="min-w-0 flex-grow-1">
              <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                {{ item.first_name }} {{ item.last_name }}
              </div>
              <div class="text-caption text-primary font-weight-medium text-uppercase mt-0.5">
                {{ item.position || 'Sin cargo asignado' }}
              </div>
            </div>
          </div>

          <!-- Email -->
          <div
            v-if="item.email"
            class="mb-2 text-caption text-medium-emphasis d-flex align-center gap-1"
          >
            <VIcon
              icon="ri-mail-line"
              size="14"
              color="medium-emphasis"
            />
            <span class="text-truncate">{{ item.email }}</span>
          </div>

          <!-- Pie Móvil: Estado -->
          <div class="d-flex align-center justify-space-between pt-1.5 border-t">
            <span class="text-caption text-disabled font-weight-medium">Estado del personal</span>
            <div
              class="status-pill-clean"
              :class="isEmployeeActive(item) ? 'status-paid' : 'status-pending'"
            >
              <span class="status-dot" />
              <span>{{ isEmployeeActive(item) ? 'Activo' : 'Inactivo' }}</span>
            </div>
          </div>
        </VCard>
        </template>
      </div>

      <!-- VISTA ESCRITORIO: TABLA MODERNA (d-none d-md-block) -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable
          hover
          class="employees-modern-table overflow-x-auto"
        >
          <thead>
            <tr class="bg-grey-lighten-5">
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 160px;"
              >
                Identificación
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="min-width: 250px;"
              >
                Empleado
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 240px;"
              >
                Email
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 180px;"
              >
                Cargo / Puesto
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 120px;"
              >
                Estado
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 130px;"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr
                v-for="n in 5"
                :key="'skel-emp-row-' + n"
                class="skeleton-row align-middle"
              >
                <td class="py-4" style="width: 160px;">
                  <div class="shimmer-line" style="width: 100px; height: 16px;" />
                </td>
                <td class="py-4">
                  <div class="d-flex align-center gap-3">
                    <div class="shimmer-circle" style="width: 38px; height: 38px; border-radius: 8px;" />
                    <div class="flex-grow-1">
                      <div class="shimmer-line mb-1.5" style="width: 150px; height: 16px;" />
                    </div>
                  </div>
                </td>
                <td class="py-4" style="width: 240px;">
                  <div class="shimmer-line" style="width: 160px; height: 14px;" />
                </td>
                <td class="py-4" style="width: 180px;">
                  <div class="shimmer-line" style="width: 110px; height: 14px;" />
                </td>
                <td class="py-4 text-center" style="width: 120px;">
                  <div class="shimmer-chip mx-auto" style="width: 70px; height: 24px;" />
                </td>
                <td class="py-4 text-center" style="width: 130px;">
                  <div class="d-flex justify-center align-center gap-1">
                    <div class="shimmer-button rounded" style="width: 32px; height: 32px;" />
                    <div class="shimmer-button rounded" style="width: 32px; height: 32px;" />
                  </div>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr
                v-for="item in employees"
                :key="item.id"
                class="employee-table-row"
              >
                <!-- Identificación -->
                <td class="py-3">
                  <span class="font-weight-bold text-high-emphasis font-mono">
                    {{ item.identification || 'Sin cédula' }}
                  </span>
                </td>

                <!-- Empleado -->
                <td class="py-3">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="38"
                      color="primary"
                      variant="tonal"
                      rounded="lg"
                      class="font-weight-bold elevation-0"
                    >
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
                  <span
                    class="text-body-2 text-medium-emphasis text-truncate"
                    style="max-width: 230px;"
                    :title="item.email"
                  >
                    {{ item.email || '-' }}
                  </span>
                </td>

                <!-- Cargo (Texto limpio, sin vchip) -->
                <td class="py-3">
                  <span class="text-body-2 font-weight-medium text-high-emphasis text-uppercase">
                    {{ item.position || 'No especificado' }}
                  </span>
                </td>

                <!-- Estado (Pill limpia aceituna / pastel con punto) -->
                <td
                  class="text-center py-3"
                  style="white-space: nowrap;"
                >
                  <div
                    class="status-pill-clean"
                    :class="isEmployeeActive(item) ? 'status-paid' : 'status-pending'"
                  >
                    <span class="status-dot" />
                    <span>{{ isEmployeeActive(item) ? 'Activo' : 'Inactivo' }}</span>
                  </div>
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
                      v-if="can('edit_employee')"
                      size="small"
                      color="warning"
                      variant="tonal"
                      icon="ri-pencil-line"
                      title="Editar Empleado"
                      @click="openEditDialog(item)"
                    />
                    <VBtn
                      v-if="!isEmployeeActive(item) && can('edit_employee')"
                      size="small"
                      color="success"
                      variant="tonal"
                      icon="ri-refresh-line"
                      title="Restaurar Empleado"
                      @click="restoreEmployee(item)"
                    />
                    <VBtn
                      v-else-if="can('delete_employee')"
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
            </template>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard
        v-if="totalPages > 0"
        class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface"
      >
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100 text-center text-sm-start">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ employees.length }}</strong> de <strong class="text-high-emphasis">{{ totalItems }}</strong> empleados
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            :disabled="loading"
            rounded="circle"
            :total-visible="$vuetify.display.xs ? 4 : 7"
            :size="$vuetify.display.xs ? 'small' : 'default'"
            density="comfortable"
            color="primary"
            class="my-0"
            @update:model-value="searchEmployees"
          />
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <EmployeeCreateDialog
      v-model="createDialog"
      @employee-created="onEmployeeCreated"
    />
    <EmployeeEditDialog
      v-model="editDialog"
      :employee="employeeToEdit"
      @employee-updated="onEmployeeUpdated"
    />
    <EmployeeViewDialog
      v-model="viewDialog"
      :employee="employeeToView"
    />
    <EmployeeDeleteDialog
      v-model="deleteDialog"
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

// Status Pills (Estilo listado de clientes/vehículos/compras)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}
</style>
