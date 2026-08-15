<script setup>
import { computed } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  requestSelected: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

// Encabezado estructurado generado automáticamente
const vehicleHeader = computed(() => {
  if (!props.requestSelected) return ''
  const brand = (props.requestSelected.brand || '').toUpperCase().trim()
  const model = (props.requestSelected.model || '').toUpperCase().trim()
  const traction = (props.requestSelected.traction || '').toUpperCase().trim()
  const year = props.requestSelected.year || ''

  return `VEHÍCULO: ${brand} ${model} ${traction ? traction + ' ' : ''}DEL ${year}`.trim()
})
</script>

<template>
  <VDialog max-width="900" :model-value="props.isDialogVisible" scrollable @update:model-value="closeDialog">
    <VCard v-if="props.requestSelected" class="custom-dialog-card overflow-hidden relative">
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
          <VIcon icon="ri-file-list-3-line" />
        </div>
        <h3 class="custom-dialog-title">
          Ficha de Compatibilidad
        </h3>
        <p class="custom-dialog-subtitle">
          Información técnica y catálogo de compatibilidad de repuestos
        </p>
      </div>

      <VCardText class="pa-6" style="max-height: 70vh;">
        <VRow dense>
          <!-- Ficha Técnica del Vehículo (Grid box) -->
          <VCol cols="12" class="mb-5">
            <div class="technical-spec-grid">
              <div class="spec-item">
                <div class="spec-label">
                  <VIcon icon="ri-roadster-line" size="14" class="me-1" />
                  MARCA
                </div>
                <div class="spec-value text-uppercase">
                  {{ props.requestSelected.brand }}
                </div>
              </div>

              <div class="spec-item">
                <div class="spec-label">
                  <VIcon icon="ri-car-line" size="14" class="me-1" />
                  MODELO
                </div>
                <div class="spec-value text-uppercase">
                  {{ props.requestSelected.model }}
                </div>
              </div>

              <div class="spec-item">
                <div class="spec-label">
                  <VIcon icon="ri-calendar-line" size="14" class="me-1" />
                  AÑO
                </div>
                <div class="spec-value">
                  {{ props.requestSelected.year }}
                </div>
              </div>

              <div class="spec-item">
                <div class="spec-label">
                  <VIcon icon="ri-compass-3-line" size="14" class="me-1" />
                  TRACCIÓN
                </div>
                <div class="spec-value text-uppercase">
                  {{ props.requestSelected.traction || 'N/A' }}
                </div>
              </div>

              <div class="spec-item">
                <div class="spec-label">
                  <VIcon icon="ri-earth-line" size="14" class="me-1" />
                  PROCEDENCIA
                </div>
                <div class="spec-value text-uppercase">
                  {{ props.requestSelected.origin_country || 'N/A' }}
                </div>
              </div>
            </div>
          </VCol>

          <!-- Sección de Repuestos Compatibles -->
          <VCol cols="12" class="mb-4">
            <div class="font-weight-bold text-subtitle-1 text-primary d-flex align-center gap-2 mb-2">
              <VIcon icon="ri-settings-3-line" color="primary" />
              Repuestos Compatibles Registrados ({{ props.requestSelected.items ? props.requestSelected.items.length : 0
              }})
            </div>
            <VDivider />
          </VCol>

          <!-- Listado de items de repuesto en tarjetas independientes -->
          <VCol cols="12" class="d-flex flex-column gap-4">
            <div v-for="(item, idx) in (props.requestSelected.items || [])" :key="idx"
              class="detail-spare-card pa-4 rounded-xl border"
              style="border-color: rgba(var(--v-border-color), 0.12) !important; background-color: rgb(var(--v-theme-surface));">
              <!-- Card Header -->
              <div class="d-flex align-center justify-space-between mb-3 border-b pb-2">
                <div class="d-flex align-center gap-2">
                  <VChip size="small" color="primary" variant="flat" class="font-weight-bold">
                    #{{ idx + 1 }}
                  </VChip>
                  <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase">
                    {{ item.category }}
                  </span>
                </div>
                <div>
                  <span class="text-caption text-medium-emphasis">Marca:</span>
                  <span class="text-body-2 font-weight-bold text-uppercase ms-1 text-high-emphasis">
                    {{ item.spare_part_brand }}
                  </span>
                </div>
              </div>

              <!-- Descripcion -->
              <div class="mb-3">
                <div class="text-caption text-medium-emphasis font-weight-bold mb-1">
                  DETALLE / DESCRIPCIÓN
                </div>
                <div class="text-body-1 text-high-emphasis bg-light pa-3 rounded-lg text-pre-wrap"
                  style="background-color: rgba(var(--v-theme-on-surface), 0.02); line-height: 1.5;">
                  {{ item.spare_parts_detail }}
                </div>
              </div>

              <!-- Precios -->
              <div class="d-flex justify-end gap-6 pt-2 border-t mt-2 align-center">
                <div class="text-right">
                  <div class="text-caption text-high-emphasis font-weight-medium" style="font-size: 0.75rem !important;">
                    PVP (VENTA)
                  </div>
                  <div class="text-h5 font-weight-regular text-high-emphasis">
                    ${{ parseFloat(item.public_price || 0).toFixed(2) }}
                  </div>
                </div>
                <div class="text-right pl-4 border-l">
                  <div class="text-caption text-medium-emphasis" style="font-size: 0.68rem !important; opacity: 0.75;">
                    COSTO COMPRA
                  </div>
                  <div class="text-body-2 font-weight-regular text-medium-emphasis" style="font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important; opacity: 0.8;">
                    ${{ parseFloat(item.purchase_price || 0).toFixed(2) }}
                  </div>
                </div>
              </div>
            </div>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Footer Metadata -->
      <VDivider />
      <VCardText
        class="bg-card-footer py-3 px-6 d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <div class="d-flex align-center gap-1">
          <VIcon icon="ri-user-smile-line" size="14" />
          <span>Registrado por: <strong>{{ props.requestSelected.user ? (props.requestSelected.user.name + ' ' +
            (props.requestSelected.user.surname || '')) : 'Sistema' }}</strong></span>
        </div>
        <div>
          <strong>Fecha:</strong> {{ new Date(props.requestSelected.created_at).toLocaleDateString() }}
        </div>
      </VCardText>

      <!-- Sticky Close Button -->
      <VDivider />
      <VCardActions class="pa-4 justify-end bg-white">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="px-6 rounded-lg"
          @click="closeDialog"
        >
          Cerrar Ficha
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
