<script setup>
import { ref, computed } from 'vue'
import { getBrandNameById } from '@/data/vehicleBrands.js'
import { getVehicleTypeNameById, getVehicleTypeColor as getTypeColor } from '@/data/vehicleTypes.js'

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

// Computed properties para obtener labels
const getVehicleTypeLabel = computed(() => {
  if (!props.vehicleData?.vehicle_type) return 'No especificado'
  
  return getVehicleTypeNameById(props.vehicleData.vehicle_type)
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
  if (!colorName) return '#9e9e9e'
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

  return colors[colorName.toLowerCase()] || '#9e9e9e'
}

// Función para obtener color de contraste
const getContrastColor = colorName => {
  if (!colorName) return '#000000'
  const darkColors = ['negro', 'morado', 'azul', 'café']
  
  return darkColors.includes(colorName.toLowerCase()) ? '#ffffff' : '#000000'
}

// Computed para obtener icono según tipo de vehículo
const getVehicleIcon = computed(() => {
  if (!props.vehicleData?.vehicle_type) return 'ri-car-line'
  
  // Soporte para IDs numéricos del catálogo centralizado
  const numericId = parseInt(props.vehicleData.vehicle_type)
  const iconsMap = {
    1: 'ri-car-line',       // Sedan
    2: 'ri-car-line',       // Hatchback
    3: 'ri-truck-line',     // Camioneta
    4: 'ri-roadster-line',  // SUV
    5: 'ri-van-line',       // Furgoneta
    6: 'ri-truck-line',     // Camion
    7: 'ri-roadster-line',  // Jeep
    8: 'ri-car-line',       // Coupe
    9: 'ri-car-line',       // Convertible
    10: 'ri-van-line',      // Minivan
    11: 'ri-truck-line',    // Pickup
    12: 'ri-van-line'       // Van
  }
  
  if (iconsMap[numericId]) return iconsMap[numericId]

  // Compatibilidad con texto
  const typeStr = String(props.vehicleData.vehicle_type).toLowerCase()
  const textIcons = {
    'automovil': 'ri-car-line',
    'camioneta': 'ri-truck-line',
    'motocicleta': 'ri-motorbike-line',
    'camion': 'ri-truck-line',
    'bus': 'ri-bus-line',
    'van': 'ri-van-line',
    'sedan': 'ri-car-line',
    'hatchback': 'ri-car-line',
    'suv': 'ri-roadster-line',
    'furgoneta': 'ri-van-line',
    'jeep': 'ri-roadster-line',
    'coupe': 'ri-car-line',
    'convertible': 'ri-car-line',
    'minivan': 'ri-van-line',
    'pickup': 'ri-truck-line',
    'otro': 'ri-car-line',
  }

  return textIcons[typeStr] || 'ri-car-line'
})

// computed para color
const getVehicleTypeColor = computed(() => {
  if (!props.vehicleData?.vehicle_type) return 'grey'
  
  return getTypeColor(props.vehicleData.vehicle_type)
})

// Cerrar diálogo
const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    max-width="650"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="vehicle-dialog-card pa-0 elevation-12">
      <!-- Header con gradiente elegante -->
      <div class="modal-header-hero">
        <VBtn
          icon="ri-close-line"
          variant="text"
          class="position-absolute close-modal-btn"
          style="top: 16px; right: 16px;"
          @click="closeDialog"
        />

        <!-- Avatar con icono del tipo de vehiculo -->
        <div class="vehicle-avatar-wrapper">
          <VIcon :icon="getVehicleIcon" size="36" color="white" />
        </div>

        <!-- Placa Realista -->
        <div class="d-block mb-2">
          <div class="license-plate-hero">
            <div class="plate-header-flag"></div>
            <div class="plate-content">
              <span class="plate-text-large">{{ vehicleData.license_plate?.toUpperCase() || 'SIN PLACA' }}</span>
              <span class="plate-country">ECUADOR</span>
            </div>
          </div>
        </div>

        <!-- Marca y Modelo subtitulo -->
        <h2 class="text-h5 font-weight-bold text-white mb-1 text-uppercase">
          {{ getBrandName }} {{ vehicleData.model || '' }}
        </h2>
        <p class="text-caption text-grey-lighten-2 mb-0 opacity-75 tracking-wider text-uppercase">
          Ficha del Vehículo
        </p>
      </div>

      <!-- Contenido principal -->
      <VCardText class="pa-6">
        <!-- Grid de Especificaciones (Brochure Style) -->
        <div class="specs-container">
          <div class="spec-badge-card">
            <span class="spec-label">Marca</span>
            <span class="spec-value">{{ getBrandName }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Modelo</span>
            <span class="spec-value">{{ vehicleData.model || 'N/A' }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Año</span>
            <span class="spec-value">{{ vehicleData.year || 'N/A' }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Tipo</span>
            <span class="spec-value">{{ getVehicleTypeLabel }}</span>
          </div>
        </div>

        <VRow>
          <!-- Tarjeta de Información Principal -->
          <VCol cols="12" md="6">
            <VCard class="pa-4 h-100 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title">
                <VIcon icon="ri-information-line" color="primary" class="me-2" size="20" />
                Registro
              </VCardTitle>

              <VRow no-gutters>
                <VCol cols="12" class="mb-3">
                  <div class="text-caption text-medium-emphasis">Placa Oficial</div>
                  <div class="text-body-1 font-weight-bold text-grey-darken-3">
                    {{ vehicleData.license_plate || 'Sin placa' }}
                  </div>
                </VCol>

                <VCol cols="12" class="mb-3">
                  <div class="text-caption text-medium-emphasis">Estado en el Sistema</div>
                  <div class="mt-1">
                    <VChip
                      :color="getVehicleStatus.color"
                      variant="tonal"
                      size="small"
                      class="font-weight-bold"
                    >
                      {{ getVehicleStatus.label }}
                    </VChip>
                  </div>
                </VCol>

                <VCol cols="12" class="mb-1">
                  <div class="text-caption text-medium-emphasis">Color Exterior</div>
                  <div class="d-flex align-center mt-1">
                    <span class="color-indicator-circle" :style="{ backgroundColor: getColorHex(vehicleData.color) }"></span>
                    <span class="text-body-2 font-weight-bold text-capitalize text-grey-darken-3">
                      {{ vehicleData.color || 'No especificado' }}
                    </span>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Descripción -->
          <VCol cols="12" md="6">
            <VCard class="pa-4 h-100 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title">
                <VIcon icon="ri-file-text-line" color="success" class="me-2" size="20" />
                Observaciones
              </VCardTitle>
              <div class="desc-box text-pre-wrap">
                {{ vehicleData.description || 'Sin observaciones registradas para este vehículo.' }}
              </div>
            </VCard>
          </VCol>

          <!-- Tarjeta de Información del Sistema -->
          <VCol cols="12" class="pt-4">
            <VCard class="pa-4 bg-grey-lighten-5 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-3 section-title text-grey-darken-2">
                <VIcon icon="ri-settings-5-line" color="grey-darken-2" class="me-2" size="18" />
                Detalles del Sistema
              </VCardTitle>

              <VRow no-gutters class="gap-y-2">
                <VCol cols="12" sm="4">
                  <div class="text-caption text-medium-emphasis">ID Vehículo</div>
                  <div class="text-body-2 font-weight-medium text-grey-darken-3">
                    #{{ vehicleData.id }}
                  </div>
                </VCol>

                <VCol cols="12" sm="4">
                  <div class="text-caption text-medium-emphasis">Fecha de Registro</div>
                  <div class="text-body-2 font-weight-medium text-grey-darken-3">
                    {{ vehicleData.created_at ? new Date(vehicleData.created_at).toLocaleDateString() : 'N/A' }}
                  </div>
                </VCol>

                <VCol cols="12" sm="4">
                  <div class="text-caption text-medium-emphasis">Última Modificación</div>
                  <div class="text-body-2 font-weight-medium text-grey-darken-3">
                    {{ vehicleData.updated_at ? new Date(vehicleData.updated_at).toLocaleDateString() : 'N/A' }}
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Footer con botones -->
      <VDivider />
      <VCardActions class="pa-4 justify-end">
        <VBtn
          color="secondary"
          variant="tonal"
          prepend-icon="ri-close-line"
          class="px-5"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.vehicle-dialog-card {
  border-radius: 16px !important;
  overflow: hidden;
}

.modal-header-hero {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: white;
  padding: 32px 24px !important;
  position: relative;
  text-align: center;
}

.close-modal-btn {
  color: rgba(255, 255, 255, 0.7) !important;
  transition: all 0.2s ease;
}

.close-modal-btn:hover {
  color: white !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* Placa Física Realista */
.license-plate-hero {
  display: inline-flex;
  flex-direction: column;
  background: #fcfcfc;
  border: 2px solid #1e293b;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  margin-bottom: 8px;
  width: auto;
  min-width: 170px;
}

.plate-header-flag {
  height: 4px;
  background: linear-gradient(to right, #ffeb3b 0%, #ffeb3b 50%, #0d47a1 50%, #0d47a1 75%, #d32f2f 75%, #d32f2f 100%);
}

.plate-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
}

.plate-text-large {
  font-family: 'Outfit', 'Segoe UI', Arial, sans-serif;
  font-weight: 800;
  font-size: 1.4rem;
  letter-spacing: 1.5px;
  color: #0f172a;
  line-height: 1.2;
}

.plate-country {
  font-size: 0.6rem;
  font-weight: 700;
  color: #475569;
  letter-spacing: 1px;
}

/* Avatar de Tipo de Vehículo */
.vehicle-avatar-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.vehicle-avatar-wrapper:hover {
  transform: scale(1.05);
  background: rgba(255, 255, 255, 0.12);
}

/* Grid de Especificaciones (Brochure Style) */
.specs-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

@media (max-width: 500px) {
  .specs-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

.spec-badge-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  text-align: center;
  transition: all 0.2s ease;
}

.spec-badge-card:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.spec-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  display: block;
}

.spec-value {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  margin-top: 2px;
  display: block;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.color-indicator-circle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.15);
  display: inline-block;
  vertical-align: middle;
  margin-right: 6px;
}

.section-title {
  font-size: 0.82rem !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #475569;
}

.info-card-flat {
  border: 1px solid #e2e8f0 !important;
  border-radius: 8px !important;
}

.desc-box {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  font-size: 0.85rem;
  color: #334155;
  line-height: 1.4;
  height: calc(100% - 28px);
  min-height: 110px;
}
</style>
