<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { usePermissions } from '@/composables/usePermissions'
import UserAddDialog from '@/components/inventory/users/UserAddDialog.vue'
import UserViewDialog from '@/components/inventory/users/UserViewDialog.vue'
import UserEditDialog from '@/components/inventory/users/UserEditDialog.vue'
import UserDeleteDialog from '@/components/inventory/users/UserDeleteDialog.vue'

const { showNotification } = useGlobalToast()
const { can } = usePermissions()
const roles = ref([])

const isUserAddDialogVisible = ref(false)
const isUserEditDialogVisible = ref(false)
const isUserDeleteDialogVisible = ref(false)
const isUserViewDialogVisible = ref(false)

const isLoading = ref(false)
const isSearching = ref(false)
const list_users = ref([])
const seachQuery = ref(null)
const user_selected_edit = ref(null)
const user_selected_delete = ref(null)
const user_selected_view = ref(null)
const viewLoading = ref(false)

// Métricas computadas
const usersWithRoleCount = computed(() => {
  return list_users.value.filter(u => !!u.role?.name).length
})

const hasActiveFilters = computed(() => {
  return !!(seachQuery.value && seachQuery.value.trim())
})

const resetFilters = () => {
  seachQuery.value = null
  list()
}

const normalizeAvatarUrl = avatar => {
  if (!avatar) return null
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') || 'http://127.0.0.1:8000'
  return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar.replace(/^\//, '')}`
}

const getUserInitials = (name, surname) => {
  const n = (name || '').trim()
  const s = (surname || '').trim()
  if (n && s) return (n[0] + s[0]).toUpperCase()
  if (n) return n.slice(0, 2).toUpperCase()
  return 'US'
}

let usersAbortController = null

const list = async () => {
  if (usersAbortController) {
    usersAbortController.abort()
  }
  usersAbortController = new AbortController()

  isLoading.value = true
  try {
    const resp = await $api("users?search=" + (seachQuery.value ? seachQuery.value : ''), {
      method: 'GET',
      signal: usersAbortController.signal,
      onResponseError({ response }) {
        console.log(response._data?.error)
        showNotification('Error al cargar los usuarios', 'error')
      },
    })

    list_users.value = (resp.users || []).map(user => ({
      ...user,
      avatar: normalizeAvatarUrl(user.avatar),
    }))
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
    console.log(error)
    showNotification('Error al cargar la lista de usuarios', 'error')
  } finally {
    isLoading.value = false
    isSearching.value = false
  }
}

const debouncedList = useDebounceFn(() => {
  list()
}, 350)

const addNewUser = newUser => {
  const userToAdd = {
    ...newUser,
    role: { ...newUser.role },
  }
  list_users.value.unshift(userToAdd)
  showNotification('Usuario agregado correctamente', 'success')
}

const addEditUser = updatedUser => {
  const index = list_users.value.findIndex(user => user.id === updatedUser.id)
  if (index !== -1) {
    const currentUser = list_users.value[index]
    const userToUpdate = {
      ...updatedUser,
      avatar: updatedUser.avatar || currentUser.avatar,
      role: updatedUser.role || currentUser.role,
      role_id: updatedUser.role_id || currentUser.role_id,
    }
    list_users.value[index] = userToUpdate
    showNotification('Usuario actualizado correctamente', 'success')
  } else {
    list()
  }
}

const addDeleteUser = deletedUser => {
  const index = list_users.value.findIndex(user => user.id === deletedUser.id)
  if (index !== -1) {
    list_users.value.splice(index, 1)
    showNotification('Usuario eliminado correctamente', 'success')
  } else {
    list()
  }
}

const viewItem = async item => {
  isUserViewDialogVisible.value = true
  viewLoading.value = true
  user_selected_view.value = { ...item }

  try {
    const resp = await $api(`users/${item.id}`, {
      method: 'GET',
      onResponseError({ response }) {
        console.error('Error al cargar detalles del usuario:', response._data)
        showNotification('Error al cargar detalles del usuario', 'error')
      },
    })

    if (resp?.user) {
      user_selected_view.value = {
        ...resp.user,
        avatar: normalizeAvatarUrl(resp.user.avatar),
      }
    }
  } catch (error) {
    console.error('Error al cargar usuario:', error)
    showNotification('Error al cargar usuario', 'error')
    isUserViewDialogVisible.value = false
  } finally {
    viewLoading.value = false
  }
}

const editItem = item => {
  user_selected_edit.value = item
  isUserEditDialogVisible.value = true
}

const deleteItem = item => {
  if (item.id === 1) {
    showNotification('No se puede eliminar al usuario con ID 1 (Super-Admin)', 'error')
    return
  }
  user_selected_delete.value = item
  isUserDeleteDialogVisible.value = true
}

const loadRoles = async () => {
  try {
    const resp = await $api("role", {
      method: "GET",
      onResponseError({ response }) {
        console.error('Error al cargar roles:', response._data?.error)
      },
    })
    roles.value = resp.roles || []
  } catch (error) {
    console.error('Error al cargar roles:', error)
  }
}

watch(seachQuery, () => {
  isSearching.value = true
  debouncedList()
})

onMounted(() => {
  loadRoles()
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 users-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-shield-user-line" size="26" />
          </VAvatar>
          Gestión de Usuarios
        </h1>
        <p class="text-medium-emphasis mb-0">
          Cuentas de acceso, credenciales y asignación de roles en el sistema
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          v-if="can('register_user')"
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="isUserAddDialogVisible = true"
        >
          Nuevo Usuario
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-user-follow-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Usuarios Registrados</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_users.length }} <span class="text-caption text-disabled font-weight-regular">en sistema</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="info" variant="tonal" rounded="lg">
            <VIcon icon="ri-admin-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Con Rol Configurado</div>
            <div class="text-h6 font-weight-bold text-info">
              {{ usersWithRoleCount }} <span class="text-caption text-disabled font-weight-regular">usuarios</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-lock-password-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Roles Disponibles</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ roles.length }} <span class="text-caption text-disabled font-weight-regular">roles activos</span>
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
              label="Buscar usuario"
              placeholder="Nombre, email, identificación..."
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              :loading="isLoading || isSearching"
              prepend-inner-icon="ri-search-2-line"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ESTADO DE CARGA -->
    <VCard v-if="isLoading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 70px;"><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-60" /></td>
            <td class="py-4" style="width: 140px;"><div class="shimmer-chip" /></td>
            <td class="py-4" style="width: 130px;"><div class="shimmer-line w-50" /></td>
            <td class="py-4 text-center" style="width: 130px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_users || list_users.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-user-unfollow-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron usuarios
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los términos de búsqueda o registra un nuevo usuario al sistema.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_user')" color="primary" prepend-icon="ri-add-line" @click="isUserAddDialogVisible = true">
          Nuevo Usuario
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE USUARIOS -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="users-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Usuario
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 240px;">
                Email
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 180px;">
                Rol de Acceso
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 140px;">
                Fecha Reg.
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in list_users" :key="user.id" class="user-table-row">
              <td class="font-weight-bold text-disabled">
                #{{ user.id }}
              </td>

              <!-- Usuario con Foto / Avatar -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="40"
                    rounded="lg"
                    color="primary"
                    variant="tonal"
                    class="font-weight-bold elevation-0"
                  >
                    <VImg v-if="user.avatar" :src="user.avatar" />
                    <span v-else>{{ getUserInitials(user.name, user.surname) }}</span>
                  </VAvatar>
                  <div>
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                      {{ user.name }} {{ user.surname || '' }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Email -->
              <td class="py-3">
                <span class="text-body-2 text-medium-emphasis text-truncate" style="max-width: 230px;" :title="user.email">
                  {{ user.email }}
                </span>
              </td>

              <!-- Rol (Único VChip justificado) -->
              <td class="py-3">
                <VChip
                  size="small"
                  :color="user.role?.name?.toLowerCase().includes('admin') ? 'primary' : 'secondary'"
                  variant="tonal"
                  class="font-weight-semibold text-uppercase"
                >
                  <VIcon icon="ri-shield-keyhole-line" size="14" class="me-1" />
                  {{ user.role?.name || 'Sin rol' }}
                </VChip>
              </td>

              <!-- Fecha -->
              <td class="py-3">
                <span class="text-caption text-medium-emphasis">
                  {{ user.created_at ? new Date(user.created_at).toLocaleDateString() : '-' }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="text-center">
                <div class="d-flex justify-center align-center gap-1">
                  <VBtn
                    size="small"
                    color="info"
                    variant="tonal"
                    icon="ri-eye-line"
                    title="Ver Ficha de Usuario"
                    @click="viewItem(user)"
                  />
                  <VBtn
                    v-if="can('edit_user')"
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Usuario"
                    @click="editItem(user)"
                  />
                  <VBtn
                    v-if="can('delete_user') && user.id !== 1"
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Usuario"
                    @click="deleteItem(user)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación / Resumen -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_users.length }}</strong> usuarios registrados
          </div>
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <UserAddDialog
      v-if="isUserAddDialogVisible"
      v-model:isDialogVisible="isUserAddDialogVisible"
      :roles="roles"
      @add-user="addNewUser"
    />
    <UserViewDialog
      v-if="isUserViewDialogVisible"
      v-model:isDialogVisible="isUserViewDialogVisible"
      :user-data="user_selected_view"
      :roles="roles"
    />
    <UserEditDialog
      v-if="isUserEditDialogVisible"
      v-model:isDialogVisible="isUserEditDialogVisible"
      :user-data="user_selected_edit"
      :roles="roles"
      @edit-user="addEditUser"
    />
    <UserDeleteDialog
      v-if="isUserDeleteDialogVisible"
      v-model:isDialogVisible="isUserDeleteDialogVisible"
      :user-data="user_selected_delete"
      @delete-user="addDeleteUser"
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

.user-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}
</style>
