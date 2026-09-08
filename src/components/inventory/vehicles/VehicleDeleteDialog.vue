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
    scrollable
    :model-value="props.isDialogVisible"
    max-width="520"
    persistent
    :closable="!loader.loading"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card pa-0 rounded-xl overflow-hidden elevation-10">
      <!-- Header Banner Danger -->
      <div class="custom-dialog-header-danger bg-error text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-2-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Vehículo
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá el vehículo de la base de datos
        </p>
      </div>

      <!-- Content -->
      <VCardText class="pa-sm-6 pa-4">
        <div class="d-flex flex-column align-center text-center">
          <!-- Placa Ecuatoriana Estilizada -->
          <div class="ecuador-delete-plate mb-3">
            <div class="plate-top">
              <span class="stripe-y"></span>
              <span class="stripe-b"></span>
              <span class="stripe-r"></span>
              <span class="country-text">ECUADOR</span>
            </div>
            <div class="plate-code">
              {{ props.vehicleSelected?.license_plate || 'SIN PLACA' }}
            </div>
          </div>

          <h4 class="text-h6 font-weight-bold text-high-emphasis mb-1">
            {{ props.vehicleSelected?.brand || '' }} {{ props.vehicleSelected?.model || '' }}
          </h4>
          <p class="text-caption text-medium-emphasis mb-4">
            {{ getVehicleTypeLabel }} • Año {{ props.vehicleSelected?.year || 'N/A' }}
          </p>

          <!-- Resumen del Vehículo en Tarjeta -->
          <div class="w-100 pa-3 rounded-lg border mb-4 text-start" style="background: rgba(var(--v-theme-on-surface), 0.02);">
            <div class="d-flex justify-space-between py-1 border-b text-body-2">
              <span class="text-medium-emphasis">ID Vehículo:</span>
              <span class="font-weight-bold font-mono">#{{ props.vehicleSelected?.id || 'N/A' }}</span>
            </div>
            <div class="d-flex justify-space-between py-1 border-b text-body-2">
              <span class="text-medium-emphasis">Color:</span>
              <span class="font-weight-semibold text-capitalize">{{ props.vehicleSelected?.color || 'No especificado' }}</span>
            </div>
            <div v-if="props.vehicleSelected?.client" class="d-flex justify-space-between py-1 text-body-2">
              <span class="text-medium-emphasis">Propietario:</span>
              <span class="font-weight-semibold">{{ props.vehicleSelected.client.full_name || 'N/A' }}</span>
            </div>
          </div>

          <!-- Warning Alert -->
          <VAlert
            type="warning"
            variant="tonal"
            class="rounded-lg text-start w-100"
            icon="ri-error-warning-line"
          >
            <div class="text-caption font-weight-medium">
              <strong>Advertencia:</strong> Esta acción no se puede deshacer. Se desvinculará este vehículo de futuros registros del taller.
            </div>
          </VAlert>
        </div>
      </VCardText>

      <VDivider />

      <!-- Actions -->
      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-surface"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-5 font-weight-medium"
          height="40"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
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
          Eliminar Vehículo
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.ecuador-delete-plate {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 2px solid #0f172a;
  border-radius: 8px;
  padding: 3px 14px 2px 14px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  min-width: 120px;
}

.plate-top {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 2px;
}

.stripe-y { width: 3px; height: 6px; background: #facc15; border-radius: 1px; }
.stripe-b { width: 3px; height: 6px; background: #2563eb; border-radius: 1px; }
.stripe-r { width: 3px; height: 6px; background: #dc2626; border-radius: 1px; }

.country-text {
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.2px;
  color: #1e293b;
  margin-left: 2px;
  line-height: 1;
}

.plate-code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 16px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: 1.5px;
  line-height: 1.1;
}
</style>
