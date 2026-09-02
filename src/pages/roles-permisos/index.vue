<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import RoleAddDialog from '@/components/inventory/role/RoleAddDialog.vue'
import RoleEditDialog from '@/components/inventory/role/RoleEditDialog.vue'
import RoleDeleteDialog from '@/components/inventory/role/RoleDeleteDialog.vue'
import RoleViewDialog from '@/components/inventory/role/RoleViewDialog.vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { usePermissions } from '@/composables/usePermissions'

const { showNotification } = useGlobalToast()
const { can } = usePermissions()

const isRoleAddDialogVisible = ref(false)
const isRoleEditDialogVisible = ref(false)
const isRoleDeleteDialogVisible = ref(false)
const isRoleViewDialogVisible = ref(false)

const list_roles = ref([])
const seachQuery = ref(null)
const role_selected_edit = ref(null)
const role_selected_delete = ref(null)
const role_selected_view = ref(null)
const loading = ref(false)
const isSearching = ref(false)

// Métricas computadas
const totalPermissionsCount = computed(() => {
  return list_roles.value.reduce((acc, r) => acc + (r.permissions_pluck?.length || 0), 0)
})

const hasActiveFilters = computed(() => {
  return !!(seachQuery.value && seachQuery.value.trim())
})

const resetFilters = () => {
  seachQuery.value = null
  list()
}

let rolesAbortController = null

const list = async () => {
  if (rolesAbortController) {
    rolesAbortController.abort()
  }
  rolesAbortController = new AbortController()

  loading.value = true
  try {
    const resp = await $api("role?search=" + (seachQuery.value ? seachQuery.value : ''), {
      method: 'GET',
      signal: rolesAbortController.signal,
      onResponseError({ response }) {
        console.log(response._data?.error)
        showNotification('Error al cargar los roles', 'error')
      },
    })

    list_roles.value = (resp.roles || []).filter(role => role.id !== 1)
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
    console.log(error)
    showNotification('Error al cargar la lista de roles', 'error')
  } finally {
    loading.value = false
    isSearching.value = false
  }
}

const debouncedList = useDebounceFn(() => {
  list()
}, 350)

const addNewRole = newRole => {
  list_roles.value.unshift(newRole)
  showNotification('Rol agregado correctamente', 'success')
}

const addEditRole = updatedRole => {
  const index = list_roles.value.findIndex(role => role.id === updatedRole.id)
  if (index !== -1) {
    list_roles.value[index] = updatedRole
    showNotification('Rol actualizado correctamente', 'success')
  } else {
    list()
  }
}

const addDeleteRole = deletedRole => {
  const index = list_roles.value.findIndex(role => role.id === deletedRole.id)
  if (index !== -1) {
    list_roles.value.splice(index, 1)
    showNotification('Rol eliminado correctamente', 'success')
  } else {
    list()
  }
}

const getRoleColor = roleName => {
  const name = (roleName || '').toLowerCase()
  if (name.includes('admin')) return 'warning'
  if (name.includes('vendedor') || name.includes('seller')) return 'success'
  if (name.includes('gerente') || name.includes('manager')) return 'primary'
  return 'secondary'
}

const getRoleIcon = roleName => {
  const name = (roleName || '').toLowerCase()
  if (name.includes('admin')) return 'ri-vip-crown-line'
  if (name.includes('vendedor') || name.includes('seller')) return 'ri-shopping-cart-line'
  if (name.includes('gerente') || name.includes('manager')) return 'ri-briefcase-4-line'
  return 'ri-shield-user-line'
}

const viewItem = item => {
  role_selected_view.value = item
  isRoleViewDialogVisible.value = true
}

const editItem = item => {
  role_selected_edit.value = item
  isRoleEditDialogVisible.value = true
}

const deleteItem = item => {
  role_selected_delete.value = item
  isRoleDeleteDialogVisible.value = true
}

watch(seachQuery, () => {
  isSearching.value = true
  debouncedList()
})

onMounted(() => {
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 roles-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-shield-keyhole-line" size="26" />
          </VAvatar>
          Roles y Permisos
        </h1>
        <p class="text-medium-emphasis mb-0">
          Definición de perfiles de seguridad y asignación de accesos al sistema
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          v-if="can('register_role')"
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="isRoleAddDialogVisible = true"
        >
          Nuevo Rol
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-shield-check-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Roles Definidos</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_roles.length }} <span class="text-caption text-disabled font-weight-regular">roles activos</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-lock-unlock-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Permisos Asignados Totales</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ totalPermissionsCount }} <span class="text-caption text-disabled font-weight-regular">permisos</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-user-shared-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Seguridad del Sistema</div>
            <div class="text-h6 font-weight-bold text-warning">
              Activa <span class="text-caption text-disabled font-weight-regular">(Control granular)</span>
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
          <VCol cols="12">
            <VTextField
              v-model="seachQuery"
              label="Buscar rol"
              placeholder="Ej: Administrador, Vendedor, Mecánico..."
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              :loading="loading || isSearching"
              prepend-inner-icon="ri-search-2-line"
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
            <td class="py-4" style="width: 70px;"><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-60" /></td>
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-50" /></td>
            <td class="py-4"><div class="shimmer-line w-40" /></td>
            <td class="py-4 text-center" style="width: 120px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_roles || list_roles.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-shield-keyhole-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron roles
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los filtros de búsqueda o crea un nuevo rol de acceso.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_role')" color="primary" prepend-icon="ri-add-line" @click="isRoleAddDialogVisible = true">
          Nuevo Rol
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE ROLES -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="roles-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Perfil de Rol
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 150px;">
                Fecha Reg.
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 220px;">
                Permisos Asignados
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list_roles" :key="item.id" class="role-table-row">
              <td class="font-weight-bold text-disabled">
                #{{ item.id }}
              </td>

              <!-- Rol con Avatar e Icono -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar :color="getRoleColor(item.name)" variant="tonal" size="38" rounded="lg" class="elevation-0">
                    <VIcon :icon="getRoleIcon(item.name)" size="22" />
                  </VAvatar>
                  <div>
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                      {{ item.name }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Fecha Reg -->
              <td class="py-3">
                <span class="text-caption text-medium-emphasis">
                  {{ item.created_at ? new Date(item.created_at.replace(' ', 'T')).toLocaleDateString('es-EC') : 'N/A' }}
                </span>
              </td>

              <!-- Permisos Asignados (Limpio, sin saturar con 20 chips) -->
              <td class="py-3">
                <div v-if="!item.permissions_pluck || item.permissions_pluck.length === 0" class="text-caption text-disabled font-italic">
                  Sin permisos asignados
                </div>
                <div v-else class="d-flex align-center gap-2">
                  <VChip size="small" color="primary" variant="tonal" class="font-weight-semibold">
                    <VIcon icon="ri-checkbox-circle-line" size="14" class="me-1" />
                    {{ item.permissions_pluck.length }} permisos asignados
                  </VChip>
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
                    title="Ver Rol y Permisos"
                    @click="viewItem(item)"
                  />
                  <VBtn
                    v-if="item.id !== 1 && can('edit_role')"
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Rol"
                    @click="editItem(item)"
                  />
                  <VBtn
                    v-if="item.id !== 1 && can('delete_role')"
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Rol"
                    @click="deleteItem(item)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Resumen -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_roles.length }}</strong> perfiles de rol configurados
          </div>
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <RoleViewDialog
      v-if="role_selected_view && isRoleViewDialogVisible"
      v-model:isDialogVisible="isRoleViewDialogVisible"
      :role-selected="role_selected_view"
      @edit-role="editItem"
    />
    <RoleAddDialog
      v-model:isDialogVisible="isRoleAddDialogVisible"
      @add-role="addNewRole"
    />
    <RoleEditDialog
      v-if="role_selected_edit && isRoleEditDialogVisible"
      v-model:isDialogVisible="isRoleEditDialogVisible"
      :role-selected="role_selected_edit"
      @edit-role="addEditRole"
    />
    <RoleDeleteDialog
      v-if="role_selected_delete && isRoleDeleteDialogVisible"
      v-model:isDialogVisible="isRoleDeleteDialogVisible"
      :role-selected="role_selected_delete"
      @delete-role="addDeleteRole"
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

.role-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}
</style>
