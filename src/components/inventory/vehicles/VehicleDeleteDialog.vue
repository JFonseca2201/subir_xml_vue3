<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { getVehicleTypeNameById } from '@/data/vehicleTypes.js'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  vehicleSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'deleteVehicle'])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Computed properties para obtener labels
const getVehicleTypeLabel = computed(() => {
  if (!props.vehicleSelected?.vehicle_type) return 'No especificado'
  
  return getVehicleTypeNameById(props.vehicleSelected.vehicle_type)
})

// Computed para obtener icono según tipo de vehículo
const getVehicleIcon = computed(() => {
  const type = props.vehicleSelected?.vehicle_type

  const icons = {
    'automovil': 'ri-car-line',
    'camioneta': 'ri-truck-line',
    'motocicleta': 'ri-motorbike-line',
    'camion': 'ri-truck-line',
    'bus': 'ri-bus-line',
    'van': 'ri-van-line',
    'otro': 'ri-car-line',
  }

  
  return icons[type] || 'ri-car-line'
})

const confirmDelete = async () => {
  if (!props.vehicleSelected || !props.vehicleSelected.id) {
    console.error('No hay vehículo seleccionado para eliminar')
    showNotification('Error: no se puede eliminar, vehículo no seleccionado', 'error')
    
    return
  }

  loader.start()

  try {
    const resp = await $api(`vehicles/${props.vehicleSelected.id}`, {
      method: 'DELETE',
      onResponseError({ response }) {
        console.error('Error del servidor:', response._data)

        const errorMessage = response._data?.message || 'Error al eliminar el vehículo'

        showNotification(errorMessage, 'error')
      },
    })

    console.log('Vehículo eliminado del servidor:', resp.vehicle || resp)

    // Emitir el vehículo eliminado (usar el original si no hay respuesta)
    const deletedVehicle = resp.vehicle || props.vehicleSelected

    emit('deleteVehicle', deletedVehicle)
    emit('update:isDialogVisible', false)
    showNotification('Vehículo eliminado con éxito', 'success')

  } catch (error) {
    console.error('Error al eliminar vehículo:', error)

    // Si hay error de red o servidor, pero el vehículo fue eliminado del backend
    // aún así eliminarlo de la lista local
    if (props.vehicleSelected) {
      emit('deleteVehicle', props.vehicleSelected)
      emit('update:isDialogVisible', false)
      showNotification('Vehículo eliminado (verificar en servidor)', 'warning')
    } else {
      showNotification('Error al eliminar vehículo', 'error')
    }
  } finally {
    loader.stop()
  }
}

const cancelDelete = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="600px"
    persistent
    :closable="!loader.loading"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="rounded-xl elevation-8">
      <!-- Header -->
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <div class="d-flex align-center gap-2">
          <VIcon
            icon="ri-delete-bin-line"
            color="error"
          />
          <span class="text-h6 font-weight-bold">Eliminar Vehículo</span>
        </div>
        <VBtn
          icon
          variant="text"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
        >
          <VIcon icon="ri-close-line" />
        </VBtn>
      </VCardTitle>

      <VDivider />

      <!-- Content -->
      <VCardText class="pa-4">
        <div class="text-center">
          <!-- Avatar -->
          <VAvatar
            size="80"
            color="error"
            variant="tonal"
            class="mb-4"
          >
            <VIcon
              :icon="getVehicleIcon"
              size="40"
            />
          </VAvatar>

          <!-- Vehicle Info -->
          <div class="mb-4">
            <h4 class="text-h6 font-weight-bold mb-2">
              {{ props.vehicleSelected?.license_plate || 'Vehículo sin placa' }}
            </h4>

            <div class="d-flex flex-column gap-1">
              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-car-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Tipo:</strong> {{ getVehicleTypeLabel }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-building-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Marca:</strong> {{ props.vehicleSelected?.brand || 'Sin marca' }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-settings-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Modelo:</strong> {{ props.vehicleSelected?.model || 'Sin modelo' }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-calendar-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Año:</strong> {{ props.vehicleSelected?.year || 'No especificado' }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-palette-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Color:</strong> {{ props.vehicleSelected?.color || 'No especificado' }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-hashtag"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>ID:</strong> {{ props.vehicleSelected?.id || 'Sin ID' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Warning Alert -->
          <VAlert
            type="warning"
            variant="tonal"
            class="mb-4"
            icon="ri-alert-line"
          >
            <div class="text-body-2">
              <strong>¿Está seguro de eliminar este vehículo?</strong>
              <br>
              Esta acción es permanente y no se puede deshacer. Podría afectar registros asociados como
              facturas o servicios.
            </div>
          </VAlert>
        </div>
      </VCardText>

      <VDivider />

      <!-- Actions -->
      <VCardActions class="pa-4">
        <VSpacer />
        <VBtn
          color="default"
          variant="outlined"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
        >
          <VIcon
            start
            icon="ri-close-line"
          />
          Cancelar
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          :loading="loader.loading"
          :disabled="loader.loading"
          @click="confirmDelete"
        >
          <VIcon
            start
            icon="ri-delete-bin-line"
          />
          Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
