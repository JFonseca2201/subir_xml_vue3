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

const emit = defineEmits(["update:isDialogVisible", "deleteRole"])

const loader = useLoaderStore()

const warning = ref(null)
const error_exits = ref(null)
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

const deleteRol = async () => {
  loader.start()
  warning.value = null
  error_exits.value = null
  success.value = null
  try {
    const resp = await $api("role/" + props.roleSelected.id, {
      method: "DELETE",
      onResponseError({ response }) {
        error_exits.value = response._data.error
      },
    })

    console.log(resp)
    showNotification('Rol eliminado correctamente', 'success')
    emit("deleteRole", props.roleSelected)
    onFormReset()
  } catch (error) {
    console.log(error)
    showNotification('Error al eliminar el rol', 'error')
  } finally {
    loader.stop()
  }
}

onMounted(() => {
  console.log(props.roleSelected)
})

const onFormSubmit = () => {
  emit("update:isDialogVisible", false)
  emit("submit", userData.value)
}

const onFormReset = () => {
  emit("update:isDialogVisible", false)
}

const dialogVisibleUpdate = val => {
  emit("update:isDialogVisible", val)
}
</script>

<template>
  <VDialog scrollable
    :model-value="props.isDialogVisible"
    max-width="520"
    persistent
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
          <VIcon icon="ri-delete-bin-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Rol
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá los accesos asignados al rol
        </p>
      </div>

      <!-- Body -->
      <VCardText class="pa-6">
        <p class="mb-4 d-flex align-center gap-2 text-body-1">
          <VIcon
            icon="ri-alert-line"
            size="20"
            color="warning"
          />
          ¿Deseas eliminar el rol <strong>{{ props.roleSelected.name }}</strong>?
        </p>

        <!-- Alerts -->
        <VAlert
          v-if="warning"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          <VIcon
            start
            icon="ri-information-line"
          />
          {{ warning }}
        </VAlert>

        <VAlert
          v-if="error_exits"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          <VIcon
            start
            icon="ri-close-circle-line"
          />
          {{ error_exits }}
        </VAlert>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loader.loading"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loader.loading"
          @click="deleteRol"
        >
          Eliminar
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
