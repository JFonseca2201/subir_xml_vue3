<script setup>
import { ref } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  requestSelected: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'deleteSuccess',
])

const { showNotification } = useGlobalToast()
const loading = ref(false)

const confirmDelete = async () => {
  if (!props.requestSelected || !props.requestSelected.id) return

  loading.value = true
  try {
    const response = await $api(`spare-part-requests/${props.requestSelected.id}`, {
      method: 'DELETE',
    })

    showNotification(response?.message || 'Registro eliminado correctamente', 'success')
    emit('deleteSuccess', props.requestSelected)
    emit('update:isDialogVisible', false)
  } catch (error) {
    console.error('Error al eliminar registro:', error)
    const errorMsg = error?.response?._data?.message || 'Error al eliminar el registro'
    showNotification(errorMsg, 'error')
  } finally {
    loading.value = false
  }
}

const cancelDelete = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    scrollable
    :model-value="props.isDialogVisible"
    max-width="500"
    persistent
    :closable="!loading"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card elevation-8">
      <!-- Header Banner Primary (Estilo unificado con cliente y vehículo) -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="loading"
          @click="cancelDelete"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-car-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Repuestos de Vehículo
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá el vehículo y sus repuestos compatibles
        </p>
      </div>

      <!-- Content -->
      <VCardText class="pa-4">
        <div class="text-center">
          <!-- Avatar Icono -->
          <VAvatar
            size="80"
            color="error"
            variant="tonal"
            class="mb-4"
          >
            <VIcon
              icon="ri-delete-bin-line"
              size="40"
            />
          </VAvatar>

          <!-- Información del Vehículo -->
          <div class="mb-4">
            <h4 class="text-h6 font-weight-bold mb-2">
              {{ props.requestSelected?.brand }} {{ props.requestSelected?.model }}
            </h4>

            <div class="d-flex flex-column gap-1">
              <div v-if="props.requestSelected?.year" class="d-flex align-center justify-center gap-2">
                <VIcon icon="ri-calendar-line" size="16" />
                <span class="text-body-2">
                  <strong>Año:</strong> {{ props.requestSelected.year }}
                </span>
              </div>

              <div v-if="props.requestSelected?.traction" class="d-flex align-center justify-center gap-2">
                <VIcon icon="ri-compass-3-line" size="16" />
                <span class="text-body-2">
                  <strong>Tracción:</strong> {{ props.requestSelected.traction }}
                </span>
              </div>

              <div v-if="props.requestSelected?.origin_country" class="d-flex align-center justify-center gap-2">
                <VIcon icon="ri-earth-line" size="16" />
                <span class="text-body-2">
                  <strong>País de Origen:</strong> {{ props.requestSelected.origin_country }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon icon="ri-tools-line" size="16" />
                <span class="text-body-2">
                  <strong>Repuestos Asociados:</strong> {{ (props.requestSelected?.items || []).length }}
                </span>
              </div>

              <div v-if="props.requestSelected?.id" class="d-flex align-center justify-center gap-2">
                <VIcon icon="ri-hashtag" size="16" />
                <span class="text-body-2">
                  <strong>ID:</strong> {{ props.requestSelected.id }}
                </span>
              </div>
            </div>
          </div>

          <!-- Alerta de Advertencia -->
          <VAlert
            type="warning"
            variant="tonal"
            class="mb-2 text-start"
            icon="ri-alert-line"
          >
            <div class="text-body-2">
              <strong>¿Está seguro de eliminar este registro?</strong>
              <br>
              Esta acción es permanente y no se puede deshacer. Se eliminará el vehículo y su lista de repuestos compatibles.
            </div>
          </VAlert>
        </div>
      </VCardText>

      <VDivider />

      <!-- Acciones -->
      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loading"
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
          :loading="loading"
          :disabled="loading"
          @click="confirmDelete"
        >
          Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
