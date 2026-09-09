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
    12: 'ri-van-line',       // Van
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
    scrollable
    max-width="720"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard
      class="custom-dialog-card vehicle-dialog-card pa-0 rounded-xl overflow-hidden elevation-10"
    >
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon :icon="getVehicleIcon" />
        </div>
        <h3 class="custom-dialog-title">
          Ficha del Vehículo
        </h3>
        <p class="custom-dialog-subtitle mb-1">
          {{ getBrandName }} {{ vehicleData.model || '' }} ({{ vehicleData.year || 'N/A' }})
        </p>
      </div>

      <!-- Contenido principal -->
      <VCardText class="pa-sm-6 pa-4">
        <!-- Hero: Placa Ecuatoriana + Estado -->
        <div class="d-flex flex-wrap align-center justify-space-between gap-3 pa-4 mb-4 rounded-xl border bg-surface" style="border-color: rgba(var(--v-theme-primary), 0.15) !important;">
          <div class="d-flex align-center gap-3">
            <!-- Placa Ecuatoriana Realista -->
            <div class="ecuador-hero-plate">
              <div class="plate-top">
                <span class="stripe-y"></span>
                <span class="stripe-b"></span>
                <span class="stripe-r"></span>
                <span class="country-text">ECUADOR</span>
              </div>
              <div class="plate-code">
                {{ vehicleData.license_plate ? vehicleData.license_plate.toUpperCase() : 'SIN PLACA' }}
              </div>
            </div>

            <div>
              <div class="text-h6 font-weight-bold text-high-emphasis">
                {{ getBrandName }} {{ vehicleData.model || '' }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ getVehicleTypeLabel }} • Año {{ vehicleData.year || 'N/A' }}
              </div>
            </div>
          </div>

          <div class="d-flex align-center gap-2">
            <VChip
              :color="getVehicleStatus.color"
              variant="elevated"
              size="small"
              class="font-weight-bold text-uppercase px-3"
            >
              <VBadge dot :color="getVehicleStatus.color === 'success' ? '#ffffff' : '#ffffff'" inline class="me-1" />
              {{ getVehicleStatus.label }}
            </VChip>
          </div>
        </div>

        <!-- Grid de Métricas Rápidas -->
        <div class="vehicle-metrics-grid mb-4">
          <div class="metric-box">
            <VIcon icon="ri-building-line" size="18" class="text-primary mb-1" />
            <span class="metric-label">Marca</span>
            <span class="metric-val text-uppercase">{{ getBrandName }}</span>
          </div>

          <div class="metric-box">
            <VIcon icon="ri-car-line" size="18" class="text-info mb-1" />
            <span class="metric-label">Tipo</span>
            <span class="metric-val text-uppercase">{{ getVehicleTypeLabel }}</span>
          </div>

          <div class="metric-box">
            <VIcon icon="ri-calendar-line" size="18" class="text-warning mb-1" />
            <span class="metric-label">Año Fab.</span>
            <span class="metric-val">{{ vehicleData.year || 'N/A' }}</span>
          </div>

          <div class="metric-box">
            <VIcon icon="ri-palette-line" size="18" class="text-error mb-1" />
            <span class="metric-label">Color</span>
            <span class="metric-val text-uppercase d-flex align-center justify-center gap-1.5">
              <span
                class="color-dot-small"
                :style="{ backgroundColor: getColorHex(vehicleData.color) }"
              />
              {{ vehicleData.color || 'N/A' }}
            </span>
          </div>

          <div class="metric-box">
            <VIcon icon="ri-dashboard-3-line" size="18" class="text-success mb-1" />
            <span class="metric-label">Uso</span>
            <span class="metric-val text-capitalize">{{ vehicleData.usage_type || 'Particular' }}</span>
          </div>
        </div>

        <VRow>
          <!-- Tarjeta de Especificaciones Técnicas -->
          <VCol cols="12" md="6" class="py-2">
            <VCard class="pa-4 h-100 rounded-lg border info-card-flat" variant="flat">
              <div class="d-flex align-center gap-2 mb-3 text-primary font-weight-bold text-subtitle-2 text-uppercase">
                <VIcon icon="ri-file-info-line" size="18" />
                Especificaciones del Registro
              </div>

              <div class="d-flex flex-column gap-2 text-body-2">
                <div class="d-flex justify-space-between py-1 border-b">
                  <span class="text-medium-emphasis">ID de Registro:</span>
                  <span class="font-weight-bold font-mono">#{{ vehicleData.id }}</span>
                </div>
                <div class="d-flex justify-space-between py-1 border-b">
                  <span class="text-medium-emphasis">Modelo:</span>
                  <span class="font-weight-semibold text-uppercase">{{ vehicleData.model || 'No especificado' }}</span>
                </div>
                <div class="d-flex justify-space-between py-1 border-b">
                  <span class="text-medium-emphasis">Fecha Registro:</span>
                  <span class="font-weight-medium">
                    {{ vehicleData.created_at ? new Date(vehicleData.created_at).toLocaleDateString() : 'N/A' }}
                  </span>
                </div>
                <div class="d-flex justify-space-between py-1">
                  <span class="text-medium-emphasis">Última Modificación:</span>
                  <span class="font-weight-medium">
                    {{ vehicleData.updated_at ? new Date(vehicleData.updated_at).toLocaleDateString() : 'N/A' }}
                  </span>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Tarjeta de Observaciones -->
          <VCol cols="12" md="6" class="py-2">
            <VCard class="pa-4 h-100 rounded-lg border info-card-flat" variant="flat">
              <div class="d-flex align-center gap-2 mb-3 text-success font-weight-bold text-subtitle-2 text-uppercase">
                <VIcon icon="ri-chat-check-line" size="18" />
                Observaciones y Notas
              </div>
              <div
                class="pa-3 rounded-lg text-body-2"
                style="background: rgba(var(--v-theme-on-surface), 0.03); min-height: 110px; line-height: 1.5; white-space: pre-wrap;"
              >
                {{ vehicleData.description || 'Sin observaciones adicionales registradas para este vehículo.' }}
              </div>
            </VCard>
          </VCol>

          <!-- Tarjeta de Información del Propietario / Cliente -->
          <VCol cols="12" class="py-2">
            <VCard class="pa-4 rounded-lg border info-card-flat" variant="flat">
              <div class="d-flex align-center gap-2 mb-3 text-secondary font-weight-bold text-subtitle-2 text-uppercase">
                <VIcon icon="ri-user-star-line" size="18" />
                Información del Propietario
              </div>

              <div v-if="vehicleData.client">
                <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-3 pa-3 rounded-lg" style="background: rgba(var(--v-theme-primary), 0.04);">
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="40" color="primary" variant="tonal" class="rounded-circle">
                      <VIcon size="22" icon="ri-user-3-line" />
                    </VAvatar>
                    <div>
                      <div class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase">
                        {{ vehicleData.client.full_name || `${vehicleData.client.name || ''} ${vehicleData.client.surname || ''}`.trim() || 'N/A' }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        Cliente Registrado
                      </div>
                    </div>
                  </div>

                  <div class="d-flex flex-wrap align-center gap-2">
                    <VChip size="small" variant="tonal" color="primary" class="font-weight-medium px-2.5">
                      <VIcon size="14" icon="ri-id-card-line" class="me-1" />
                      Doc: {{ vehicleData.client.n_document || 'N/A' }}
                    </VChip>
                    <VChip v-if="vehicleData.client.phone" size="small" variant="tonal" color="secondary" class="font-weight-medium px-2.5">
                      <VIcon size="14" icon="ri-phone-line" class="me-1" />
                      {{ vehicleData.client.phone }}
                    </VChip>
                  </div>
                </div>

                <VRow no-gutters class="pt-1">
                  <VCol cols="12" sm="6" class="py-1">
                    <div class="text-caption text-medium-emphasis">Correo Electrónico</div>
                    <div class="text-body-2 font-weight-medium text-high-emphasis">
                      {{ vehicleData.client.email || 'No registrado' }}
                    </div>
                  </VCol>

                  <VCol cols="12" sm="6" class="py-1">
                    <div class="text-caption text-medium-emphasis">Dirección Domiciliaria</div>
                    <div class="text-body-2 font-weight-medium text-high-emphasis">
                      {{ vehicleData.client.address || 'No registrada' }}
                    </div>
                  </VCol>
                </VRow>
              </div>
              <div
                v-else
                class="text-body-2 text-medium-emphasis pa-4 text-center rounded-lg border border-dashed"
                style="background: rgba(var(--v-theme-on-surface), 0.02);"
              >
                <VIcon icon="ri-user-unfollow-line" size="24" class="mb-1 text-grey" /><br>
                Este vehículo no tiene un propietario asociado en el sistema.
              </div>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Footer con botones -->
      <VDivider />
      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-surface"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.ecuador-hero-plate {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 2.5px solid #0f172a;
  border-radius: 8px;
  padding: 4px 16px 3px 16px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.12);
  min-width: 140px;
}

.plate-top {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 2px;
}

.stripe-y { width: 4px; height: 8px; background: #facc15; border-radius: 1px; }
.stripe-b { width: 4px; height: 8px; background: #2563eb; border-radius: 1px; }
.stripe-r { width: 4px; height: 8px; background: #dc2626; border-radius: 1px; }

.country-text {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #1e293b;
  margin-left: 2px;
  line-height: 1;
}

.plate-code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 19px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: 2px;
  line-height: 1.1;
}

.vehicle-metrics-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

@media (max-width: 680px) {
  .vehicle-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.metric-box {
  background: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 10px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: transform 0.2s ease;
}

.metric-box:hover {
  transform: translateY(-2px);
}

.metric-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.metric-val {
  font-size: 0.85rem;
  font-weight: 700;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

.color-dot-small {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
  display: inline-block;
}

.info-card-flat {
  border-color: rgba(var(--v-theme-on-surface), 0.1) !important;
  background: rgba(var(--v-theme-on-surface), 0.015);
}
</style>
