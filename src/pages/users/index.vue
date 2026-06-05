<script setup>
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import UserAddDialog from '@/components/inventory/users/UserAddDialog.vue'
import UserViewDialog from '@/components/inventory/users/UserViewDialog.vue'
import UserEditDialog from '@/components/inventory/users/UserEditDialog.vue'
import UserDeleteDialog from '@/components/inventory/users/UserDeleteDialog.vue'

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const roles = ref([])

const headers = [
  { title: 'ID', key: 'id' },
  { title: 'Imagen', key: 'avatar', sortable: false },
  { title: 'Nombre', key: 'name' },
  { title: 'Email', key: 'email' },
  { title: 'Rol', key: 'role.name' },
  { title: 'Fecha Reg.', key: 'created_at' },
  { title: 'Acción', key: 'action' },
]

const isUserAddDialogVisible = ref(false)
const isUserEditDialogVisible = ref(false)
const isUserDeleteDialogVisible = ref(false)
const isUserViewDialogVisible = ref(false)

const isLoading = ref(false)
const list_users = ref([])
const seachQuery = ref(null)
const user_selected_edit = ref(null)
const user_selected_delete = ref(null)
const user_selected_view = ref(null)
const viewLoading = ref(false)

const normalizeAvatarUrl = avatar => {
  if (!avatar) return null
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar

  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') || 'http://127.0.0.1:8000'

  return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar.replace(/^\//, '')}`
}

const list = async () => {
  loader.start()
  try {
    // Endpoint provisional 'users'
    const resp = await $api("users?search=" + (seachQuery.value ? seachQuery.value : ''), {
      method: 'GET',
      onResponseError({ response }) {
        console.log(response._data.error)
        showNotification('Error al cargar los usuarios', 'error')
      },
    })

    // Ajustar según la estructura de respuesta real
    list_users.value = resp.users || []

    list_users.value = list_users.value.map(user => ({
      ...user,
      avatar: normalizeAvatarUrl(user.avatar),
    }))

    // Depurar estructura de usuarios
    if (list_users.value.length > 0) {
      console.log('Estructura de usuario:', list_users.value[0])
      console.log('Campos disponibles:', Object.keys(list_users.value[0]))
      console.log('Avatar procesado:', list_users.value[0].avatar)
    }

    showNotification('Lista de usuarios cargada correctamente', 'success')
    console.log(resp)

  } catch (error) {
    console.log(error)
    showNotification('Error al cargar la lista de usuarios', 'error')
  } finally {
    loader.stop()
  }
}

const addNewUser = newUser => {
  // Crear una copia del usuario para evitar problemas de reactividad
  const userToAdd = {
    ...newUser,
    role: { ...newUser.role }, // Asegurar que role sea un objeto plano
  }

  list_users.value.unshift(userToAdd)
  showNotification('Usuario agregado correctamente', 'success')
}

const addEditUser = updatedUser => {
  console.log('Actualizando usuario:', updatedUser)

  const index = list_users.value.findIndex(user => user.id === updatedUser.id)
  if (index !== -1) {
    // Preservar el avatar existente si no se proporciona uno nuevo
    const currentUser = list_users.value[index]

    const userToUpdate = {
      ...updatedUser,

      // Mantener el avatar original si el actualizado no tiene avatar
      avatar: updatedUser.avatar || currentUser.avatar,

      // Mantener el rol original si el actualizado no tiene objeto role
      role: updatedUser.role || currentUser.role,

      // Asegurar que role_id se mantenga
      role_id: updatedUser.role_id || currentUser.role_id,
    }

    console.log('Usuario actualizado:', userToUpdate)
    console.log('Rol del usuario:', userToUpdate.role)
    console.log('Role ID del usuario:', userToUpdate.role_id)

    list_users.value[index] = userToUpdate
    showNotification('Usuario actualizado correctamente', 'success')
  } else {
    list()
  }
}

const addDeleteUser = deletedUser => {
  console.log('Eliminando usuario:', deletedUser)

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
  console.log('Editando usuario:', item)
  user_selected_edit.value = item
  isUserEditDialogVisible.value = true
}

const deleteItem = item => {
  // Proteger al usuario con ID = 1 (Super-Admin)
  if (item.id === 1) {
    showNotification('No se puede eliminar al usuario con ID 1 (Super-Admin)', 'error')

    return
  }

  console.log(item)
  user_selected_delete.value = item
  isUserDeleteDialogVisible.value = true
}

const loadRoles = async () => {
  try {
    const resp = await $api("role", {
      method: "GET",
      onResponseError({ response }) {
        console.error('Error al cargar roles:', response._data.error)
      },
    })

    roles.value = resp.roles
    console.log('Roles cargados:', roles.value)

  } catch (error) {
    console.error('Error al cargar roles:', error)
  }
}



// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch(seachQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    list()
  }, 500)
})

onMounted(() => {
  // Descomentar cuando exista el endpoint real
  loadRoles()
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 users-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-group-line" color="primary" class="me-2" size="28" />
          Usuarios
        </h1>
        <p class="text-medium-emphasis mb-0">
          Gestión de usuarios del sistema
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn color="primary" prepend-icon="ri-add-line" @click="isUserAddDialogVisible = !isUserAddDialogVisible">
          Nuevo Usuario
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12">
            <VTextField v-model="seachQuery" label="Buscar usuario" placeholder="Nombre, email, identificación..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto" clearable
              color="primary" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Usuarios -->
      <div class="position-relative">
        <VProgressLinear v-if="loader.loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />
        <div class="overflow-x-auto">
          <VTable hover class="users-table">
            <thead>
              <tr>
                <th class="text-center font-weight-bold text-uppercase" style="width: 60px;">#</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">IMAGEN</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">NOMBRE</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">EMAIL</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">ROL</th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">FECHA REG.</th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">ACCIONES</th>
              </tr>
            </thead>
            <tbody v-if="loader.loading">
              <tr>
                <td colspan="7" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">Cargando registros...</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!list_users || list_users.length === 0">
              <tr>
                <td colspan="7" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">ri-database-2-line</VIcon>
                  <div class="text-h6">No hay usuarios registrados</div>
                  <div class="text-body-2">Intenta ajustar los filtros de búsqueda</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="item in list_users" :key="item.id" class="users-row align-middle">
                <td class="text-center py-3">
                  <span class="font-weight-bold text-subtitle-1 text-primary">{{ item.id }}</span>
                </td>
                <td class="text-left py-3">
                  <div class="d-flex justify-center">
                    <div class="cursor-pointer position-relative" @click="viewItem(item)">
                      <img v-if="item.avatar" :src="item.avatar" class="rounded-circle elevation-2"
                        style="width: 40px; height: 40px; object-fit: cover;">
                      <VAvatar v-else size="40" class="elevation-2">
                        <VIcon icon="ri-user-line" size="20" />
                      </VAvatar>
                      <div class="position-absolute" style="bottom: 0; right: 0;">
                        <VIcon v-if="item.status == '1'" icon="ri-checkbox-blank-circle-fill" size="12" color="success"
                          class="elevation-1" />
                        <VIcon v-else icon="ri-close-circle-fill" size="12" color="error" class="elevation-1" />
                      </div>
                    </div>
                  </div>
                </td>
                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4">
                    {{ item.name || '' }}{{ item.surname ? ' ' + item.surname : '' }}
                  </span>
                </td>
                <td class="text-left py-3" style="max-width: 250px;">
                  <span class="text-body-2 text-grey-darken-3 text-truncate" :title="item.email">{{ item.email }}</span>
                </td>
                <td class="text-left py-3">
                  <VChip color="primary" variant="tonal" size="small">
                    {{ item.role?.name || 'Sin rol' }}
                  </VChip>
                </td>
                <td class="text-no-wrap text-left py-3">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                    <span class="text-body-2 text-medium-emphasis">
                      {{ new Date(item.created_at).toLocaleDateString('es-EC', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }) }}
                    </span>
                  </div>
                </td>
                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver detalle"
                      @click="viewItem(item)">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>
                    <VBtn v-if="item.id !== 1" class="action-btn" variant="text" icon size="small" color="primary"
                      title="Editar" @click="editItem(item)">
                      <VIcon icon="ri-pencil-line" size="20" />
                    </VBtn>
                    <VBtn v-if="item.id !== 1" class="action-btn" variant="text" icon size="small" color="error"
                      title="Eliminar" @click="deleteItem(item)">
                      <VIcon icon="ri-delete-bin-line" size="20" />
                    </VBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>

      <VDivider />

      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ list_users.length }}</span> registros
          </div>
        </div>
      </VCardActions>
    </VCard>

    <!-- Dialogs -->
    <UserAddDialog v-if="roles && roles.length > 0" v-model:isDialogVisible="isUserAddDialogVisible" :roles="roles"
      @add-user="addNewUser" />
    <UserViewDialog v-if="isUserViewDialogVisible" v-model:is-dialog-visible="isUserViewDialogVisible"
      :user="user_selected_view || {}" :loading="viewLoading" />
    <UserEditDialog v-if="user_selected_edit" v-model:isDialogVisible="isUserEditDialogVisible"
      :user-selected="user_selected_edit" :roles="roles" @edit-user="addEditUser" />
    <UserDeleteDialog v-if="user_selected_delete" v-model:isDialogVisible="isUserDeleteDialogVisible"
      :user-selected="user_selected_delete" @delete-user="addDeleteUser" />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de usuarios */
.users-table :deep(thead) {
  background-color: #f8fafc !important;
}

.users-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.users-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.users-row:hover {
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
