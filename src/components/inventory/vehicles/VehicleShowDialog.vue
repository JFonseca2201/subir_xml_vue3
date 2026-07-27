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

// computed para obtener color en hexadecimal
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

// Computed para obtener icono según tipo de vehículo
const getVehicleIcon = computed(() => {
  if (!props.vehicleData?.vehicle_type) return 'ri-car-line'
  
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

// Cerrar diálogo
const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    max-width="680"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="vehicle-dialog-card pa-0 elevation-8" style="overflow: hidden;">
      <!-- Header sobrio y limpio alineado con el sistema -->
      <VCardTitle class="d-flex align-center justify-space-between pa-6 border-bottom-light bg-grey-lighten-5">
        <!-- Parte izquierda: Icono e información del vehículo -->
        <div class="d-flex align-center min-w-0">
          <VAvatar size="48" color="primary" variant="tonal" class="me-3 flex-shrink-0">
            <VIcon :icon="getVehicleIcon" size="24" />
          </VAvatar>
          <div class="min-w-0">
            <span class="text-h6 font-weight-bold text-grey-darken-3 block">Ficha de Vehículo</span>
            <div class="text-subtitle-2 text-grey-darken-1 font-weight-medium mt-0.5 text-truncate">
              {{ getBrandName }} {{ vehicleData.model || '' }} <span class="text-grey-lighten-1 mx-1">•</span> Año {{ vehicleData.year || 'N/A' }}
            </div>
          </div>
        </div>

        <!-- Parte derecha: Matrícula grande y botón de cerrar -->
        <div class="d-flex align-center gap-4 flex-shrink-0">
          <span v-if="vehicleData.license_plate" class="ecuadorian-plate">
            <span class="plate-top-text">ECUADOR</span>
            <span class="plate-number">{{ vehicleData.license_plate.toUpperCase() }}</span>
          </span>
          <VBtn
            icon="ri-close-line"
            variant="text"
            density="comfortable"
            color="grey-darken-1"
            @click="closeDialog"
          />
        </div>
      </VCardTitle>

      <!-- Contenido principal -->
      <VCardText class="pa-6">
        <!-- Grid de Especificaciones Rápidas (Brochure Style sin redundancia de Modelo/Año) -->
        <div class="specs-container mb-6">
          <div class="spec-badge-card">
            <span class="spec-label">Marca</span>
            <span class="spec-value text-uppercase font-weight-bold">{{ getBrandName }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Tipo</span>
            <span class="spec-value text-uppercase font-weight-bold">{{ getVehicleTypeLabel }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Color</span>
            <span class="spec-value text-uppercase d-flex align-center justify-center gap-1.5 font-weight-bold">
              <span class="color-indicator-circle" :style="{ backgroundColor: getColorHex(vehicleData.color) }"></span>
              {{ vehicleData.color || 'N/A' }}
            </span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Estado</span>
            <span class="spec-value">
              <VChip
                :color="getVehicleStatus.color"
                variant="tonal"
                size="x-small"
                class="font-weight-bold px-2 py-0.5"
                style="height: auto;"
              >
                {{ getVehicleStatus.label }}
              </VChip>
            </span>
          </div>
        </div>

        <VRow>
          <!-- Tarjeta de Especificaciones Técnicas y Sistema (Consolidada) -->
          <VCol cols="12" md="6">
            <VCard class="pa-4 h-100 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title text-primary">
                <VIcon icon="ri-information-line" color="primary" class="me-2" size="20" />
                Especificaciones
              </VCardTitle>

              <VRow no-gutters class="gap-y-3">
                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">Modelo Completo</div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 text-uppercase mt-0.5">
                    {{ vehicleData.model || 'No especificado' }}
                  </div>
                </VCol>

                <VCol cols="6">
                  <div class="text-caption text-medium-emphasis">Año Fab.</div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 mt-0.5">
                    {{ vehicleData.year || 'N/A' }}
                  </div>
                </VCol>

                <VCol cols="6">
                  <div class="text-caption text-medium-emphasis">ID Vehículo</div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 mt-0.5">
                    #{{ vehicleData.id }}
                  </div>
                </VCol>

                <VCol cols="6">
                  <div class="text-caption text-medium-emphasis">Fecha Registro</div>
                  <div class="text-body-2 font-weight-medium text-grey-darken-3 mt-0.5">
                    {{ vehicleData.created_at ? new Date(vehicleData.created_at).toLocaleDateString() : 'N/A' }}
                  </div>
                </VCol>

                <VCol cols="6">
                  <div class="text-caption text-medium-emphasis">Última Modif.</div>
                  <div class="text-body-2 font-weight-medium text-grey-darken-3 mt-0.5">
                    {{ vehicleData.updated_at ? new Date(vehicleData.updated_at).toLocaleDateString() : 'N/A' }}
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Observaciones -->
          <VCol cols="12" md="6">
            <VCard class="pa-4 h-100 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title text-success">
                <VIcon icon="ri-file-text-line" color="success" class="me-2" size="20" />
                Observaciones
              </VCardTitle>
              <div class="desc-box text-pre-wrap text-body-2 text-grey-darken-3">
                {{ vehicleData.description || 'Sin observaciones registradas para este vehículo.' }}
              </div>
            </VCard>
          </VCol>

          <!-- Tarjeta de Información del Propietario / Cliente -->
          <VCol cols="12" class="pt-4">
            <VCard class="pa-4 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title text-secondary">
                <VIcon icon="ri-user-line" color="secondary" class="me-2" size="20" />
                Información del Propietario
              </VCardTitle>

              <div v-if="vehicleData.client">
                <VRow>
                  <VCol cols="12" sm="6" class="py-1">
                    <div class="text-caption text-medium-emphasis">Nombre Completo</div>
                    <div class="text-body-2 font-weight-bold text-grey-darken-3 text-uppercase mt-0.5">
                      {{ vehicleData.client.full_name || `${vehicleData.client.name || ''} ${vehicleData.client.surname || ''}`.trim() || 'N/A' }}
                    </div>
                  </VCol>

                  <VCol cols="12" sm="6" class="py-1">
                    <div class="text-caption text-medium-emphasis">Identificación (DNI / RUC)</div>
                    <div class="text-body-2 font-weight-bold text-grey-darken-3 mt-0.5">
                      {{ vehicleData.client.n_document || 'N/A' }}
                    </div>
                  </VCol>

                  <VCol cols="12" sm="6" class="py-1">
                    <div class="text-caption text-medium-emphasis">Teléfono / Celular</div>
                    <div class="text-body-2 font-weight-medium text-grey-darken-3 mt-0.5">
                      {{ vehicleData.client.phone || 'N/A' }}
                    </div>
                  </VCol>

                  <VCol cols="12" sm="6" class="py-1">
                    <div class="text-caption text-medium-emphasis">Correo Electrónico</div>
                    <div class="text-body-2 font-weight-medium text-grey-darken-3 mt-0.5" style="word-break: break-all;">
                      {{ vehicleData.client.email || 'N/A' }}
                    </div>
                  </VCol>

                  <VCol cols="12" class="py-1">
                    <div class="text-caption text-medium-emphasis">Dirección Domiciliaria</div>
                    <div class="text-body-2 font-weight-medium text-grey-darken-3 mt-0.5">
                      {{ vehicleData.client.address || 'No registrada' }}
                    </div>
                  </VCol>
                </VRow>
              </div>
              <div v-else class="text-body-2 text-medium-emphasis pa-4 text-center bg-grey-lighten-5 rounded border border-dashed">
                Este vehículo no tiene un propietario asociado en el sistema.
              </div>
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
.ecuadorian-plate {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 2px solid #0f172a;
  border-radius: 6px;
  padding: 4px 16px 2px 16px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 
    inset 0 1px 0 rgba(255,255,255,0.9),
    0 6px 10px -2px rgba(0,0,0,0.12), 
    0 2px 6px -2px rgba(0,0,0,0.08);
  min-width: 125px;
  text-align: center;
}

.ecuadorian-plate::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(to right, #ffcc00 50%, #00247d 50%, #00247d 75%, #cf142b 75%);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.plate-top-text {
  font-size: 9px;
  font-weight: 800;
  color: #475569;
  letter-spacing: 2.5px;
  line-height: 1;
  margin-top: 3px;
  margin-bottom: 2px;
  font-family: system-ui, -apple-system, sans-serif;
}

.plate-number {
  font-family: 'Lucida Console', Monaco, monospace;
  font-weight: 900;
  font-size: 18px;
  color: #020617;
  letter-spacing: 1.5px;
  line-height: 1.2;
}

.border-bottom-light {
  border-bottom: 1px solid #e0e0e0;
}

.color-indicator-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.desc-box {
  background-color: #fafafa;
  border: 1px dashed #e0e0e0;
  padding: 12px;
  border-radius: 6px;
  min-height: 125px;
  line-height: 1.5;
}

.info-card-flat {
  border-color: #e0e0e0 !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}

.section-title {
  font-size: 0.85rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
</style>
