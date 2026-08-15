<script setup>
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  roleSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'editRole',
])

const isLoading = ref(false)
const loader = useLoaderStore()
const name = ref(null)
const permissions = ref([])
const warning = ref(null)
const error_exist = ref(null)
const success = ref(null)

// Notificaciones
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message
  notificationType.value = type
  notificationShow.value = true
}

const AddEditPermissionDialog = permission => {
  let INDEX = permissions.value.findIndex(perm => perm == permission)
  if (INDEX != -1) {
    permissions.value.splice(INDEX, 1)
  } else {
    permissions.value.push(permission)
  }
  console.log(permissions)
}


const update = async () => {
  loader.start()
  warning.value = null
  error_exist.value = null
  success.value = null

  if (!name.value) {
    setTimeout(() => {
      warning.value = "Se debe ingresar un nombre de rol"
    }, 50)
    loader.stop()
    
    return
  }
  if (permissions.value.length == 0) {
    setTimeout(() => {
      warning.value = "Seleccione uno o más permisos."
    }, 50)
    loader.stop()
    
    return
  }

  let data = {
    name: name.value,
    permissions: permissions.value,
  }

  try {
    const resp = await $api("role/" + props.roleSelected.id, {
      method: 'PATCH',
      body: data,
      onResponseError({ response }) {
        error_exist.value = response._data.errors.name[0]
      },
    })

    console.log(resp)
    showNotification(resp.message || 'Rol actualizado con éxito', 'success')
    emit("editRole", resp.data)

    // Cerrar el diálogo después de un breve delay para mostrar el mensaje de éxito
    setTimeout(() => {
      onFormReset()
    }, 1500)

  } catch (error) {
    console.log(error)
    showNotification('Error al actualizar el rol', 'error')
  } finally {
    loader.stop()
  }
}




const onFormSubmit = () => {
  emit('update:isDialogVisible', false)
}

const onFormReset = () => {
  name.value = null
  permissions.value = []
  warning.value = null
  error_exist.value = null
  success.value = null

  emit('update:isDialogVisible', false)
}

const dialogVisibleUpdate = val => {
  emit('update:isDialogVisible', val)
}

onMounted(() => {
  isLoading.value = true
  console.log(props.roleSelected)
  name.value = props.roleSelected.name
  permissions.value = props.roleSelected.permissions_pluck
  isLoading.value = false
})
</script>

<template>
  <!-- Overlay global -->
  <!-- Global loader in use -->
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 720"
    :model-value="props.isDialogVisible"
    transition="dialog-bottom-transition"
    @update:model-value="dialogVisibleUpdate"
  >
    <VCard class="custom-dialog-card elevation-24">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="onFormReset"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-shield-user-line" />
        </div>
        <h3 class="custom-dialog-title">
          Editar Rol
        </h3>
        <p class="custom-dialog-subtitle">
          Define permisos y accesos para el sistema
        </p>
      </div>

      <!-- Form Body Scrollable -->
      <VCardText class="pa-6">
        <VForm
          id="roleEditForm"
          @submit.prevent="update"
        >
          <VRow>
            <!-- Nombre -->
            <VCol cols="12">
              <VTextField
                v-model="name"
                label="Nombre del rol"
                placeholder="Ej. Administrador"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-user-settings-line"
                hide-details
              />
            </VCol>
            <!-- Roles y permisos -->
            <VCol cols="12">
              <VTable class="elevation-0 permissions-table border rounded-lg">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th class="px-6 py-4 text-body-2 text-medium-emphasis">
                      Módulo
                    </th>
                    <th class="px-6 py-4 text-body-2 text-medium-emphasis">
                      Acciones permitidas
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr
                    v-for="(item, index) in PERMISOS"
                    :key="(typeof item !== 'undefined' ? (item.id || item.product_id || index) : (typeof dist !== 'undefined' ? (dist.id || index) : index))"
                    class="permissions-row"
                  >
                    <!-- MÓDULO -->
                    <td class="px-6 py-6 align-top module-cell">
                      <div class="module-name font-weight-bold">
                        {{ item.name }}
                      </div>
                      <div class="module-subtitle text-caption text-medium-emphasis">
                        Gestión del módulo
                      </div>
                    </td>

                    <!-- PERMISOS -->
                    <td class="px-6 py-6">
                      <div class="permissions-wrap d-flex flex-wrap gap-2">
                        <VChip
                          v-for="(permiso, index2) in item.permisos"
                          :key="index2"
                          :color="permissions.includes(permiso.permiso) ? 'primary' : 'default'"
                          :variant="permissions.includes(permiso.permiso) ? 'tonal' : 'outlined'"
                          class="cursor-pointer font-weight-medium"
                          :prepend-icon="permissions.includes(permiso.permiso) ? 'ri-checkbox-circle-line' : 'ri-checkbox-blank-circle-line'"
                          @click="AddEditPermissionDialog(permiso.permiso)"
                        >
                          {{ permiso.name }}
                        </VChip>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </VCol>

            <VCol
              v-if="warning"
              cols="12"
            >
              <VAlert
                color="warning"
                variant="tonal"
                closable
                class="mb-2"
              >
                <template #prepend>
                  <VIcon icon="ri-alert-line" />
                </template>
                {{ warning }}
              </VAlert>
            </VCol>
            <VCol
              v-if="error_exist"
              cols="12"
            >
              <VAlert
                color="error"
                variant="tonal"
                closable
                class="mb-2"
              >
                <template #prepend>
                  <VIcon icon="ri-error-warning-line" />
                </template>
                {{ error_exist }}
              </VAlert>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Fixed Actions Footer -->
      <VCardActions class="pa-4 justify-end bg-white">
        <VBtn
          variant="outlined"
          color="secondary"
          class="text-none px-6"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          type="submit"
          form="roleEditForm"
          color="primary"
          variant="elevated"
          class="text-none px-6"
          :loading="loader.loading"
          :disabled="loader.loading"
        >
          <VIcon
            start
            icon="ri-check-line"
          />
          Modificar Rol
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Notificación Toast -->
  <NotificationToast
    v-model:show="notificationShow"
    :message="notificationMessage"
    :type="notificationType"
  />
</template>
