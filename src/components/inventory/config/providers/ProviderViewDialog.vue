<script setup>
import { computed } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  providerSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const isProviderActive = computed(() => {
  const p = props.providerSelected
  if (!p) return false
  if (p.is_active !== undefined && p.is_active !== null) {
    return p.is_active === true || p.is_active === 1 || String(p.is_active) === '1'
  }
  if (p.status !== undefined && p.status !== null) {
    return p.status === 'active' || p.status === 1 || String(p.status) === '1' || p.status === 'activo'
  }
  return true
})

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    scrollable
    :model-value="props.isDialogVisible"
    max-width="600px"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card">
      <!-- Header Banner Info -->
      <div class="custom-dialog-header-info">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-building-line" />
        </div>
        <h3 class="custom-dialog-title">
          Ficha del Proveedor
        </h3>
        <p class="custom-dialog-subtitle">
          Información comercial registrada
        </p>
      </div>

      <!-- Content -->
      <VCardText class="pa-4">
        <!-- Header con avatar y estado -->
        <div class="d-flex align-center justify-space-between mb-4 pb-3 border-b flex-wrap gap-2">
          <div class="d-flex align-center gap-3">
            <VAvatar
              size="52"
              color="primary"
              variant="tonal"
              rounded="lg"
            >
              <span class="text-h5 font-weight-bold">{{ props.providerSelected.name ? props.providerSelected.name.charAt(0).toUpperCase() : 'P' }}</span>
            </VAvatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0 text-high-emphasis">
                {{ props.providerSelected.name || 'Sin nombre' }}
              </h3>
              <div class="d-flex align-center gap-1 text-medium-emphasis text-caption mt-1">
                <VIcon
                  icon="ri-map-pin-line"
                  size="14"
                  class="text-disabled"
                />
                <span>{{ props.providerSelected.address || 'Sin dirección' }}</span>
              </div>
            </div>
          </div>

          <div
            class="status-pill-clean"
            :class="isProviderActive ? 'status-paid' : 'status-pending'"
          >
            <span class="status-dot" />
            <span>{{ isProviderActive ? 'Activo' : 'Inactivo' }}</span>
          </div>
        </div>

        <VRow dense>
          <VCol
            cols="12"
            sm="6"
          >
            <VCard
              variant="outlined"
              class="h-100 pa-3.5 rounded-lg d-flex align-center gap-3"
            >
              <VAvatar
                color="info"
                variant="tonal"
                rounded
                size="40"
              >
                <VIcon icon="ri-hashtag" />
              </VAvatar>
              <div>
                <div class="text-caption text-medium-emphasis">
                  Código
                </div>
                <div class="font-weight-bold text-body-1">
                  PROV-{{ String(props.providerSelected.id).padStart(3, '0') }}
                </div>
              </div>
            </VCard>
          </VCol>

          <VCol
            cols="12"
            sm="6"
          >
            <VCard
              variant="outlined"
              class="h-100 pa-3.5 rounded-lg d-flex align-center gap-3"
            >
              <VAvatar
                color="warning"
                variant="tonal"
                rounded
                size="40"
              >
                <VIcon icon="ri-file-list-3-line" />
              </VAvatar>
              <div>
                <div class="text-caption text-medium-emphasis">
                  RUC
                </div>
                <div class="font-weight-bold text-body-1 font-mono">
                  {{ props.providerSelected.ruc || 'Sin RUC' }}
                </div>
              </div>
            </VCard>
          </VCol>

          <VCol
            cols="12"
            sm="6"
          >
            <VCard
              variant="outlined"
              class="h-100 pa-3.5 rounded-lg d-flex align-center gap-3"
            >
              <VAvatar
                color="primary"
                variant="tonal"
                rounded
                size="40"
              >
                <VIcon icon="ri-phone-line" />
              </VAvatar>
              <div>
                <div class="text-caption text-medium-emphasis">
                  Teléfono
                </div>
                <div class="font-weight-bold text-body-1">
                  {{ props.providerSelected.phone || 'Sin teléfono' }}
                </div>
              </div>
            </VCard>
          </VCol>

          <VCol
            cols="12"
            sm="6"
          >
            <VCard
              variant="outlined"
              class="h-100 pa-3.5 rounded-lg d-flex align-center gap-3"
            >
              <VAvatar
                color="info"
                variant="tonal"
                rounded
                size="40"
              >
                <VIcon icon="ri-mail-line" />
              </VAvatar>
              <div>
                <div class="text-caption text-medium-emphasis">
                  Correo Electrónico
                </div>
                <div
                  class="font-weight-bold text-body-1 text-truncate"
                  style="max-width: 170px;"
                  :title="props.providerSelected.email"
                >
                  {{ props.providerSelected.email || 'Sin correo' }}
                </div>
              </div>
            </VCard>
          </VCol>

          <VCol cols="12">
            <VCard
              variant="outlined"
              class="pa-3.5 rounded-lg d-flex align-center gap-3"
            >
              <VAvatar
                color="success"
                variant="tonal"
                rounded
                size="40"
              >
                <VIcon icon="ri-calendar-line" />
              </VAvatar>
              <div>
                <div class="text-caption text-medium-emphasis">
                  Fecha de Registro
                </div>
                <div class="font-weight-bold text-body-1">
                  {{ props.providerSelected.created_at ? new Date(props.providerSelected.created_at).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha' }}
                </div>
              </div>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <!-- Actions -->
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
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped lang="scss">
.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}
</style>
