<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  warehouseSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'deleteWarehouse',
])

const warning = ref(null)
const error_exist = ref(null)
const loader = useLoaderStore()

// Notificaciones
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message
  notificationType.value = type
  notificationShow.value = true
}

const confirmDelete = async () => {
  console.log(props.warehouseSelected)

  if (!props.warehouseSelected) return

  loader.start()
  warning.value = null
  error_exist.value = null

  try {
    const resp = await $api("warehouses/" + props.warehouseSelected.id, {
      method: 'DELETE',
      onResponseError({ response }) {
        error_exist.value = response._data.error
        showNotification('Error al eliminar almacén', 'error')
      },
    })

    console.log(resp)

    showNotification('Almacén eliminado correctamente', 'success')

    // Emitir evento para eliminar de la tabla
    emit('deleteWarehouse', props.warehouseSelected)

    // Cerrar diálogo
    emit('update:isDialogVisible', false)

    loader.stop()
  } catch (error) {
    console.error('Error al eliminar almacén:', error)
    error_exist.value = error
    showNotification('Error al eliminar almacén', 'error')
    loader.stop()
  }
}

const cancelDelete = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 500" :model-value="props.isDialogVisible"
    transition="dialog-bottom-transition" @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="custom-dialog-card pa-0 elevation-10">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn" @click="cancelDelete" />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-6-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Almacén
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá la bodega del sistema
        </p>
      </div>

      <div class="pa-6 pa-sm-8 text-center">
        <div class="text-body-2 text-error font-weight-medium mb-2">
          <strong>{{ props.warehouseSelected?.name }}</strong>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          <strong>ID:</strong> {{ props.warehouseSelected?.id }}<br>
          <strong>Dirección:</strong> {{ props.warehouseSelected?.address }}
        </div>
      </div>

      <!-- Alertas de Error -->
      <VAlert v-if="warning" color="warning" variant="tonal" closable class="mb-4">
        {{ warning }}
      </VAlert>

      <!-- Alertas de Error -->
      <VAlert v-if="error_exist" color="error" variant="tonal" closable class="mb-4">
        {{ error_exist }}
      </VAlert>

      <VDivider />

      <!-- Acciones -->
      <VCardActions class="pa-4 justify-end bg-white">
        <VBtn
          variant="outlined"
          color="secondary"
          class="text-none px-6"
          prepend-icon="ri-close-line"
          :disabled="loader.loading"
          @click="cancelDelete"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="error"
          variant="elevated"
          class="text-none px-6"
          prepend-icon="ri-delete-bin-line"
          :loading="loader.loading"
          :disabled="loader.loading"
          @click="confirmDelete"
        >
          Eliminar Almacén
        </VBtn>
      </VCardActions>

    </VCard>
  </VDialog>

  <!-- Notificación Toast -->
  <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
