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
  <VDialog
    max-width="920"
    :model-value="props.isDialogVisible"
    scrollable
    transition="dialog-bottom-transition"
    @update:model-value="closeDialog"
  >
    <VCard
      v-if="props.requestSelected"
      class="custom-dialog-card overflow-hidden elevation-12"
    >
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
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
        <h3 class="custom-dialog-title text-uppercase">
          {{ props.requestSelected.brand }} {{ props.requestSelected.model }} {{ props.requestSelected.year ? `(${props.requestSelected.year})` : '' }}
        </h3>
        <p class="custom-dialog-subtitle mb-2">
          Ficha técnica y catálogo de repuestos compatibles
        </p>

        <!-- Header Pills -->
        <div class="d-flex flex-wrap justify-center gap-2 mt-2">
          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-bold"
            style="background: rgba(255, 255, 255, 0.22); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.35);"
          >
            <VIcon
              icon="ri-roadster-line"
              size="14"
              class="me-1"
            />
            <span>{{ props.requestSelected.brand }} {{ props.requestSelected.model }}</span>
          </div>

          <div
            v-if="props.requestSelected.year"
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.28);"
          >
            <VIcon
              icon="ri-calendar-line"
              size="14"
              class="me-1"
            />
            <span>Año: <strong>{{ props.requestSelected.year }}</strong></span>
          </div>

          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-bold"
            style="background: rgba(16, 185, 129, 0.25); color: #ffffff; border: 1px solid rgba(16, 185, 129, 0.5);"
          >
            <VIcon
              icon="ri-settings-3-line"
              size="14"
              class="me-1"
            />
            <span>{{ props.requestSelected.items ? props.requestSelected.items.length : 0 }} Repuestos Registrados</span>
          </div>
        </div>
      </div>

      <VCardText class="pa-6">
        <VRow dense>
          <!-- Ficha Técnica del Vehículo (Grid box de 5 items) -->
          <VCol
            cols="12"
            class="mb-6"
          >
            <div class="technical-spec-grid">
              <div class="spec-badge-card">
                <div class="spec-label">
                  <VIcon
                    icon="ri-roadster-line"
                    size="13"
                    class="me-1 text-primary"
                  />
                  MARCA
                </div>
                <div class="spec-value text-uppercase font-weight-bold">
                  {{ props.requestSelected.brand || 'N/A' }}
                </div>
              </div>

              <div class="spec-badge-card">
                <div class="spec-label">
                  <VIcon
                    icon="ri-car-line"
                    size="13"
                    class="me-1 text-primary"
                  />
                  MODELO
                </div>
                <div class="spec-value text-uppercase font-weight-bold">
                  {{ props.requestSelected.model || 'N/A' }}
                </div>
              </div>

              <div class="spec-badge-card">
                <div class="spec-label">
                  <VIcon
                    icon="ri-calendar-line"
                    size="13"
                    class="me-1 text-info"
                  />
                  AÑO
                </div>
                <div class="spec-value font-weight-bold font-mono">
                  {{ props.requestSelected.year || 'N/A' }}
                </div>
              </div>

              <div class="spec-badge-card">
                <div class="spec-label">
                  <VIcon
                    icon="ri-compass-3-line"
                    size="13"
                    class="me-1 text-warning"
                  />
                  TRACCIÓN
                </div>
                <div class="spec-value text-uppercase font-weight-bold">
                  {{ props.requestSelected.traction || 'N/A' }}
                </div>
              </div>

              <div class="spec-badge-card">
                <div class="spec-label">
                  <VIcon
                    icon="ri-earth-line"
                    size="13"
                    class="me-1 text-success"
                  />
                  PROCEDENCIA
                </div>
                <div class="spec-value text-uppercase font-weight-bold">
                  {{ props.requestSelected.origin_country || 'N/A' }}
                </div>
              </div>
            </div>
          </VCol>

          <!-- Sección de Repuestos Compatibles -->
          <VCol
            cols="12"
            class="mb-4"
          >
            <div class="d-flex align-center justify-space-between mb-2">
              <div class="font-weight-bold text-subtitle-1 text-primary d-flex align-center gap-2">
                <VIcon
                  icon="ri-settings-3-line"
                  color="primary"
                />
                Repuestos Compatibles Registrados
              </div>
              <VChip size="small" color="primary" variant="tonal" class="font-weight-bold">
                {{ props.requestSelected.items ? props.requestSelected.items.length : 0 }} items
              </VChip>
            </div>
            <VDivider />
          </VCol>

          <!-- Listado de items de repuesto en tarjetas independientes -->
          <VCol
            cols="12"
            class="d-flex flex-column gap-4"
          >
            <div
              v-for="(item, idx) in (props.requestSelected.items || [])"
              :key="idx"
              class="detail-spare-card pa-4 rounded-xl border info-card-flat"
            >
              <!-- Card Header -->
              <div class="d-flex align-center justify-space-between mb-3 border-b pb-2 flex-wrap gap-2">
                <div class="d-flex align-center gap-2">
                  <VChip
                    size="small"
                    color="primary"
                    variant="flat"
                    class="font-weight-bold elevation-1"
                  >
                    #{{ idx + 1 }}
                  </VChip>
                  <span class="text-subtitle-1 font-weight-bold text-high-emphasis text-uppercase">
                    {{ item.category }}
                  </span>
                </div>
                <div class="d-flex align-center gap-1">
                  <span class="text-caption text-medium-emphasis">Marca Repuesto:</span>
                  <VChip size="x-small" color="secondary" variant="tonal" class="font-weight-bold text-uppercase ms-1">
                    {{ item.spare_part_brand || 'Genérico' }}
                  </VChip>
                </div>
              </div>

              <!-- Descripcion -->
              <div class="mb-3">
                <div class="text-caption text-medium-emphasis font-weight-bold mb-1">
                  DETALLE / DESCRIPCIÓN
                </div>
                <div
                  class="text-body-2 text-high-emphasis pa-3 rounded-lg text-pre-wrap"
                  style="background-color: #f8fafc; border: 1px solid #f1f5f9; line-height: 1.5;"
                >
                  {{ item.spare_parts_detail || 'Sin descripción adicional' }}
                </div>
              </div>

              <!-- Precios -->
              <div class="d-flex justify-end gap-6 pt-2 border-t mt-2 align-center">
                <div class="text-right">
                  <div
                    class="text-caption text-medium-emphasis font-weight-semibold"
                    style="font-size: 0.72rem !important;"
                  >
                    PVP (VENTA)
                  </div>
                  <div class="text-h6 font-weight-black text-primary font-mono">
                    ${{ parseFloat(item.public_price || 0).toFixed(2) }}
                  </div>
                </div>
                <div
                  v-if="item.purchase_price !== undefined && item.purchase_price !== null"
                  class="text-right pl-4 border-l"
                >
                  <div
                    class="text-caption text-medium-emphasis"
                    style="font-size: 0.68rem !important; opacity: 0.75;"
                  >
                    COSTO COMPRA
                  </div>
                  <div
                    class="text-body-2 font-weight-medium text-medium-emphasis font-mono"
                  >
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
      <div class="bg-card-footer py-3 px-6 d-flex align-center justify-space-between text-caption text-medium-emphasis bg-slate-50">
        <div class="d-flex align-center gap-1">
          <VIcon
            icon="ri-user-smile-line"
            size="14"
          />
          <span>Registrado por: <strong>{{ props.requestSelected.user ? (props.requestSelected.user.name + ' ' +
            (props.requestSelected.user.surname || '')) : 'Sistema' }}</strong></span>
        </div>
        <div v-if="props.requestSelected.created_at">
          <strong>Fecha:</strong> {{ new Date(props.requestSelected.created_at).toLocaleDateString() }}
        </div>
      </div>

      <!-- Sticky Close Button -->
      <VDivider />
      <VCardActions
        class="pa-4 justify-end bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="px-6 rounded-lg font-weight-medium"
          height="40"
          @click="closeDialog"
        >
          Cerrar Ficha
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
