<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import NotificationToast from '@/components/common/NotificationToast.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  unitSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'deleteUnit',
])

const loader = useLoaderStore()

const warning = ref(null)
const error_exist = ref(null)

// Variables para NotificationToast
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message
  notificationType.value = type
  notificationShow.value = true
}

const confirmDelete = async () => {
  if (!props.unitSelected) return

  loader.start()
  warning.value = null
  error_exist.value = null

  try {
    const resp = await $api("units/" + props.unitSelected.id, {
      method: 'DELETE',
      onResponseError({ response }) {
        error_exist.value = response._data.error
        showNotification('Error al eliminar unidad', 'error')
      },
    })

    console.log(resp)
    showNotification('Unidad eliminada correctamente', 'success')

    // Emitir evento para eliminar de la tabla
    emit('deleteUnit', props.unitSelected)

    // Cerrar diálogo
    emit('update:isDialogVisible', false)

    loader.stop()
  } catch (error) {
    console.error('Error al eliminar unidad:', error)
    showNotification('Error al eliminar unidad', 'error')
    loader.stop()
  }
}

const cancelDelete = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog scrollable :width="$vuetify.display.smAndDown ? 'auto' : 500" :model-value="props.isDialogVisible"
    transition="dialog-bottom-transition" @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="custom-dialog-card pa-0 elevation-10">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn" @click="cancelDelete" />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-6-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Unidad
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá la unidad de medida del sistema
        </p>
      </div>

      <div class="pa-6 pa-sm-8 text-center">
        <div class="text-body-2 text-error font-weight-medium mb-2">
          <strong>{{ props.unitSelected?.name }}</strong>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          <strong>ID:</strong> {{ props.unitSelected?.id }}<br>
          <strong>Estado:</strong> {{ props.unitSelected?.state === 1 ? 'Activo' : 'Inactivo' }}
        </div>
      </div>

      <!-- Alertas de Error -->
      <VAlert v-if="warning" color="warning" variant="tonal" closable class="mb-4">
        {{ warning }}
      </VAlert>

      <VAlert v-if="error_exist" color="error" variant="tonal" closable class="mb-4">
        {{ error_exist }}
      </VAlert>

      <VDivider />

      <!-- Acciones -->
      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loader.loading"
          @click="cancelDelete"
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
          :disabled="loader.loading"
          @click="confirmDelete"
        >
          Eliminar Unidad
        </VBtn>
      </VCardActions>

    </VCard>
  </VDialog>

  <!-- Notificación Toast -->
  <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
