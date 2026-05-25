<script setup>
import { ref, computed } from 'vue'
import { getBrandNameById } from '@/data/vehicleBrands.js'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  vehicleData: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:isDialogVisible'])

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
  { title: 'Otro', value: 'otro' },
])

// Computed properties para obtener labels
const getVehicleTypeLabel = computed(() => {
  if (!props.vehicleData?.vehicle_type) return 'No especificado'
  const option = vehicleTypeOptions.value.find(opt => opt.value === props.vehicleData.vehicle_type)
  
  return option ? option.title : props.vehicleData.vehicle_type
})

// Computed para obtener nombre de marca
const getBrandName = computed(() => {
  if (!props.vehicleData?.brand) return 'No especificada'
  
  return getBrandNameById(props.vehicleData.brand)
})

// Computed para obtener estado
const getVehicleStatus = computed(() => {
  if (!props.vehicleData?.status) return { label: 'No especificado', color: 'grey' }
  
  return parseInt(props.vehicleData.status) === 1
    ? { label: 'ACTIVO', color: 'success' }
    : { label: 'INACTIVO', color: 'error' }
})

// Computed para obtener el color con estilo
const getColorStyle = computed(() => {
  if (!props.vehicleData?.color) return {}
  const color = props.vehicleData.color.toLowerCase()
  
  return {
    backgroundColor: getColorHex(color),
    color: getContrastColor(color),
  }
})

// Función para obtener color hexadecimal (simulado)
const getColorHex = colorName => {
  const colors = {
    'rojo': '#f44336',
    'azul': '#2196f3',
    'verde': '#4caf50',
    'amarillo': '#ffeb3b',
    'negro': '#212121',
    'blanco': '#ffffff',
    'gris': '#9e9e9e',
    'plateado': '#c0c0c0',
    'dorado': '#ffd700',
    'morado': '#9c27b0',
    'naranja': '#ff9800',
    'café': '#795548',
    'rosado': '#e91e63',
    'celeste': '#87ceeb',
    'beige': '#f5f5dc',
  }

  
  return colors[colorName] || '#9e9e9e'
}

// Función para obtener color de contraste
const getContrastColor = colorName => {
  const darkColors = ['negro', 'morado', 'azul', 'café']
  
  return darkColors.includes(colorName.toLowerCase()) ? '#ffffff' : '#000000'
}

// Computed para obtener icono según tipo de vehículo
const getVehicleIcon = computed(() => {
  const type = props.vehicleData?.vehicle_type

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

// Computed para obtener color según tipo
const getVehicleTypeColor = computed(() => {
  const type = props.vehicleData?.vehicle_type

  const colors = {
    'automovil': 'primary',
    'camioneta': 'success',
    'motocicleta': 'warning',
    'camion': 'error',
    'bus': 'info',
    'van': 'secondary',
    'otro': 'grey',
  }

  
  return colors[type] || 'grey'
})

// Cerrar diálogo
const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    max-width="700"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard
      class="pa-0"
      elevation="8"
    >
      <!-- Header con gradiente -->
      <VCardTitle
        class="pa-8 text-center position-relative"
        :color="getVehicleTypeColor"
        dark
      >
        <VBtn
          icon="ri-close-line"
          variant="text"
          class="position-absolute"
          style="top: 16px; right: 16px;"
          @click="closeDialog"
        />

        <!-- Icono y tipo de vehículo -->
        <div class="d-flex flex-column align-center mb-4">
          <div class="mb-4">
            <VIcon
              :icon="getVehicleIcon"
              size="64"
              class="mb-3"
            />
            <div class="text-h5 font-weight-bold ">
              {{ getVehicleTypeLabel }}
            </div>
          </div>
        </div>

        <!-- Placa principal -->
        <h2 class="text-h4 font-weight-bold mb-2">
          {{ vehicleData.license_plate || 'Sin placa' }}
        </h2>
        <p class="text-h6 font-weight-regular mb-4">
          {{ getBrandName }} {{ vehicleData.model }} {{ vehicleData.year }}
        </p>
      </VCardTitle>

      <!-- Contenido principal -->
      <VCardText class="pa-6">
        <VRow>
          <!-- Tarjeta de Información Principal -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4 h-100"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-information-line"
                  color="primary"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Información Principal</span>
              </VCardTitle>

              <VRow>
                <VCol
                  cols="12"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Placa
                    </div>
                    <div class="text-body-1 font-weight-bold">
                      {{ vehicleData.license_plate }}
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="6"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Marca
                    </div>
                    <div class="text-body-2 font-weight-medium">
                      {{ getBrandName }}
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="6"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Modelo
                    </div>
                    <div class="text-body-2 font-weight-medium">
                      {{ vehicleData.model }}
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="6"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Año
                    </div>
                    <div class="text-body-2">
                      {{ vehicleData.year }}
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="6"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Tipo
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        :icon="getVehicleIcon"
                        size="16"
                        class="me-1"
                      />
                      <span class="text-body-2">{{ getVehicleTypeLabel }}</span>
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Estado
                    </div>
                    <VChip
                      :color="getVehicleStatus.color"
                      variant="tonal"
                      size="small"
                    >
                      {{ getVehicleStatus.label }}
                    </VChip>
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Color
                    </div>
                    <div class="d-flex align-center gap-2">
                      <div
                        class="color-preview"
                        :style="getColorStyle"
                      >
                        {{ vehicleData.color || 'No especificado' }}
                      </div>
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Descripción -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4 h-100"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-file-text-line"
                  color="success"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Descripción</span>
              </VCardTitle>

              <VRow>
                <VCol
                  cols="12"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-body-2 text-pre-wrap">
                      {{ vehicleData.description || 'No hay descripción disponible' }}
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Información del Sistema -->
          <VCol cols="12">
            <VCard
              class="pa-4"
              elevation="2"
              rounded="lg"
              color="grey-lighten-5"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-time-line"
                  color="grey-darken-2"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Información del Sistema</span>
              </VCardTitle>

              <VRow>
                <VCol
                  cols="12"
                  md="4"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      ID del Vehículo
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-hashtag"
                        size="16"
                        class="me-1 text-grey-darken-2"
                      />
                      <span class="text-body-2 font-family-monospace">{{ vehicleData.id }}</span>
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  md="4"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Fecha de Creación
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-calendar-line"
                        size="16"
                        class="me-1 text-grey-darken-2"
                      />
                      <span class="text-body-2">{{ vehicleData.created_at ? new
                        Date(vehicleData.created_at).toLocaleDateString() : 'No especificado'
                      }}</span>
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  md="4"
                  class="mb-3"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Última Actualización
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-refresh-line"
                        size="16"
                        class="me-1 text-grey-darken-2"
                      />
                      <span class="text-body-2">{{ vehicleData.updated_at ? new
                        Date(vehicleData.updated_at).toLocaleDateString() : 'No especificado'
                      }}</span>
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Footer con botones -->
      <VDivider />
      <VCardActions class="pa-4 justify-center">
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-close-line"
          class="px-6"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
