<script setup>
import { computed } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  providerSelected: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const providerData = computed(() => props.providerSelected || {})

const formattedCode = computed(() => {
  const id = providerData.value.id
  if (!id) return 'PROV-000'
  return `PROV-${String(id).padStart(3, '0')}`
})

const isProviderActive = computed(() => {
  const p = providerData.value
  if (!p) return false
  if (p.is_active !== undefined && p.is_active !== null) {
    return p.is_active === true || p.is_active === 1 || String(p.is_active) === '1'
  }
  if (p.status !== undefined && p.status !== null) {
    return p.status === 'active' || p.status === 1 || String(p.status) === '1' || p.status === 'activo'
  }
  return true
})

const formatDate = dateStr => {
  if (!dateStr) return 'Sin fecha'
  const normalized = String(dateStr).replace(' ', 'T')
  const d = new Date(normalized)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return dateStr
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    scrollable
    :model-value="props.isDialogVisible"
    max-width="620px"
    @update:model-value="closeDialog"
  >
    <VCard class="custom-dialog-card rounded-xl overflow-hidden elevation-10">
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
          <VIcon icon="ri-truck-line" />
        </div>
        <h3 class="custom-dialog-title">
          Ficha del Proveedor
        </h3>
        <p class="custom-dialog-subtitle">
          Información comercial y de contacto registrada
        </p>
      </div>

      <!-- Main Content -->
      <VCardText class="pa-4 pa-sm-6 dialog-body-content">
        <!-- Hero Header del Proveedor -->
        <div class="provider-hero-card pa-4 rounded-xl border mb-5 d-flex flex-column flex-sm-row align-center gap-4 bg-surface">
          <VAvatar
            size="64"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="elevation-1 flex-shrink-0"
          >
            <span class="text-h4 font-weight-bold text-uppercase">
              {{ providerData.name ? providerData.name.trim().charAt(0) : 'P' }}
            </span>
          </VAvatar>

          <div class="text-center text-sm-start flex-grow-1 min-w-0" style="width: 100%;">
            <div class="d-flex flex-wrap align-center justify-center justify-sm-start gap-2 mb-1">
              <span class="provider-code-chip">
                {{ formattedCode }}
              </span>
              <div
                class="status-pill-clean"
                :class="isProviderActive ? 'status-paid' : 'status-pending'"
              >
                <span class="status-dot" />
                <span>{{ isProviderActive ? 'Activo' : 'Inactivo' }}</span>
              </div>
            </div>

            <h3 class="text-h6 font-weight-bold text-high-emphasis text-uppercase text-break mb-0">
              {{ providerData.name || 'Sin Nombre Comercial' }}
            </h3>
          </div>
        </div>

        <!-- Grid de Información -->
        <VRow dense class="gap-y-3">
          <!-- RUC -->
          <VCol cols="12" sm="6">
            <VCard variant="outlined" class="info-metric-card h-100 pa-3.5 rounded-xl border">
              <div class="d-flex align-center gap-3">
                <VAvatar color="info" variant="tonal" rounded="lg" size="42" class="flex-shrink-0">
                  <VIcon icon="ri-file-list-3-line" size="22" />
                </VAvatar>
                <div class="min-w-0 flex-grow-1">
                  <div class="text-caption text-medium-emphasis font-weight-medium">
                    RUC / Identificación
                  </div>
                  <div class="font-weight-bold text-body-1 text-high-emphasis font-mono text-truncate" :title="providerData.ruc">
                    {{ providerData.ruc || 'Sin RUC' }}
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Teléfono -->
          <VCol cols="12" sm="6">
            <VCard variant="outlined" class="info-metric-card h-100 pa-3.5 rounded-xl border">
              <div class="d-flex align-center gap-3">
                <VAvatar color="warning" variant="tonal" rounded="lg" size="42" class="flex-shrink-0">
                  <VIcon icon="ri-phone-line" size="22" />
                </VAvatar>
                <div class="min-w-0 flex-grow-1">
                  <div class="text-caption text-medium-emphasis font-weight-medium">
                    Teléfono Comercial
                  </div>
                  <div class="font-weight-bold text-body-1 text-high-emphasis text-truncate" :title="providerData.phone">
                    {{ providerData.phone || 'Sin teléfono' }}
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Correo Electrónico -->
          <VCol cols="12" sm="6">
            <VCard variant="outlined" class="info-metric-card h-100 pa-3.5 rounded-xl border">
              <div class="d-flex align-center gap-3">
                <VAvatar color="primary" variant="tonal" rounded="lg" size="42" class="flex-shrink-0">
                  <VIcon icon="ri-mail-line" size="22" />
                </VAvatar>
                <div class="min-w-0 flex-grow-1">
                  <div class="text-caption text-medium-emphasis font-weight-medium">
                    Correo Electrónico
                  </div>
                  <div class="font-weight-bold text-body-2 text-high-emphasis text-truncate" :title="providerData.email">
                    {{ providerData.email || 'Sin correo registrado' }}
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Fecha de Registro -->
          <VCol cols="12" sm="6">
            <VCard variant="outlined" class="info-metric-card h-100 pa-3.5 rounded-xl border">
              <div class="d-flex align-center gap-3">
                <VAvatar color="success" variant="tonal" rounded="lg" size="42" class="flex-shrink-0">
                  <VIcon icon="ri-calendar-line" size="22" />
                </VAvatar>
                <div class="min-w-0 flex-grow-1">
                  <div class="text-caption text-medium-emphasis font-weight-medium">
                    Fecha de Registro
                  </div>
                  <div class="font-weight-bold text-body-2 text-high-emphasis text-truncate" :title="formatDate(providerData.created_at)">
                    {{ formatDate(providerData.created_at) }}
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Dirección Comercial (Full Width) -->
          <VCol cols="12">
            <VCard variant="outlined" class="info-metric-card pa-4 rounded-xl border">
              <div class="d-flex align-start gap-3">
                <VAvatar color="secondary" variant="tonal" rounded="lg" size="42" class="flex-shrink-0 mt-0.5">
                  <VIcon icon="ri-map-pin-line" size="22" />
                </VAvatar>
                <div class="min-w-0 flex-grow-1">
                  <div class="text-caption text-medium-emphasis font-weight-medium mb-0.5">
                    Dirección Comercial
                  </div>
                  <div class="font-weight-medium text-body-2 text-high-emphasis text-break">
                    {{ providerData.address || 'Sin dirección física registrada' }}
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <!-- Footer Actions -->
      <VCardActions class="pa-4 d-flex justify-end align-center bg-surface">
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-semibold"
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
.provider-hero-card {
  background-color: rgba(var(--v-theme-on-surface), 0.02) !important;
  border-color: rgba(var(--v-border-color), 0.12) !important;
}

.provider-code-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  background-color: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.info-metric-card {
  border-color: rgba(var(--v-border-color), 0.12) !important;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(var(--v-theme-on-surface), 0.04);
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.text-break {
  word-break: break-word !important;
  overflow-wrap: break-word !important;
}

/* Pastillas de Estado */
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
