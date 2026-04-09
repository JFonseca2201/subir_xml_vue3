<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

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

// Opciones para mostrar labels
const vehicleTypeOptions = ref([
    { title: 'Sedán', value: 'sedan' },
    { title: 'Hatchback', value: 'hatchback' },
    { title: 'Camioneta', value: 'camioneta' },
    { title: 'SUV', value: 'suv' },
    { title: 'Furgoneta', value: 'furgoneta' },
    { title: 'Camión', value: 'camion' },
    { title: 'Bus', value: 'bus' },
    { title: 'Van', value: 'van' },
    { title: 'Motocicleta', value: 'motocicleta' },
    { title: 'Pickup', value: 'pickup' },
    { title: 'Minivan', value: 'minivan' },
    { title: 'Deportivo', value: 'deportivo' },
    { title: 'Otro', value: 'otro' }
])

// Computed properties para obtener labels
const getVehicleTypeLabel = computed(() => {
    if (!props.vehicleSelected?.vehicle_type) return 'No especificado'
    const option = vehicleTypeOptions.value.find(opt => opt.value === props.vehicleSelected.vehicle_type)
    return option ? option.title : props.vehicleSelected.vehicle_type
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
        'otro': 'ri-car-line'
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
            }
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
    <VDialog :model-value="props.isDialogVisible" @update:model-value="val => emit('update:isDialogVisible', val)"
        max-width="600px" persistent :closable="!loader.loading">
        <VCard class="rounded-xl elevation-8">
            <!-- Header -->
            <VCardTitle class="d-flex align-center justify-space-between pa-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-delete-bin-line" color="error" />
                    <span class="text-h6 font-weight-bold">Eliminar Vehículo</span>
                </div>
                <VBtn icon variant="text" @click="emit('update:isDialogVisible', false)" :disabled="loader.loading">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VDivider />

            <!-- Content -->
            <VCardText class="pa-4">
                <div class="text-center">
                    <!-- Avatar -->
                    <VAvatar size="80" color="error" variant="tonal" class="mb-4">
                        <VIcon :icon="getVehicleIcon" size="40" />
                    </VAvatar>

                    <!-- Vehicle Info -->
                    <div class="mb-4">
                        <h4 class="text-h6 font-weight-bold mb-2">
                            {{ props.vehicleSelected?.license_plate || 'Vehículo sin placa' }}
                        </h4>

                        <div class="d-flex flex-column gap-1">
                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-car-line" size="16" />
                                <span class="text-body-2">
                                    <strong>Tipo:</strong> {{ getVehicleTypeLabel }}
                                </span>
                            </div>

                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-building-line" size="16" />
                                <span class="text-body-2">
                                    <strong>Marca:</strong> {{ props.vehicleSelected?.brand || 'Sin marca' }}
                                </span>
                            </div>

                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-settings-line" size="16" />
                                <span class="text-body-2">
                                    <strong>Modelo:</strong> {{ props.vehicleSelected?.model || 'Sin modelo' }}
                                </span>
                            </div>

                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-calendar-line" size="16" />
                                <span class="text-body-2">
                                    <strong>Año:</strong> {{ props.vehicleSelected?.year || 'No especificado' }}
                                </span>
                            </div>

                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-palette-line" size="16" />
                                <span class="text-body-2">
                                    <strong>Color:</strong> {{ props.vehicleSelected?.color || 'No especificado' }}
                                </span>
                            </div>

                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-hashtag" size="16" />
                                <span class="text-body-2">
                                    <strong>ID:</strong> {{ props.vehicleSelected?.id || 'Sin ID' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Warning Alert -->
                    <VAlert type="warning" variant="tonal" class="mb-4" icon="ri-alert-line">
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
                <VBtn color="default" variant="outlined" @click="emit('update:isDialogVisible', false)"
                    :disabled="loader.loading">
                    <VIcon start icon="ri-close-line" />
                    Cancelar
                </VBtn>
                <VBtn color="error" variant="elevated" @click="confirmDelete" :loading="loader.loading"
                    :disabled="loader.loading">
                    <VIcon start icon="ri-delete-bin-line" />
                    Eliminar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
.v-card {
    overflow: hidden;
}

.v-card-title {
    line-height: 1.2;
}

.text-caption {
    font-size: 0.75rem !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
}

/* Animaciones suaves */
.v-card {
    transition: all 0.3s ease;
}

.v-card:hover {
    transform: translateY(-2px);
}

/* Bordes redondeados */
.v-card.rounded-lg {
    border-radius: 12px !important;
}

/* Sombras personalizadas */
.v-card.elevation-8 {
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
</style>
