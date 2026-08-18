<script setup>
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
          <VIcon icon="ri-building-4-line" />
        </div>
        <h3 class="custom-dialog-title">
          {{ props.provider?.company_name || 'Ficha del Proveedor' }}
        </h3>
        <p class="custom-dialog-subtitle">
          Información comercial y de contacto del proveedor
        </p>
      </div>

      <!-- Content -->
      <VCardText class="pa-5">
        <div class="mb-5 d-flex align-center gap-4">
          <VAvatar
            size="64"
            color="primary"
            variant="tonal"
            rounded
          >
            <span class="text-h4 font-weight-bold">{{ props.providerSelected.name ? props.providerSelected.name.charAt(0).toUpperCase() : 'P' }}</span>
          </VAvatar>
          <div>
            <h3 class="text-h5 font-weight-bold mb-1">
              {{ props.providerSelected.name || 'Sin nombre' }}
            </h3>
            <div class="d-flex align-center gap-1 text-medium-emphasis">
              <VIcon
                icon="ri-map-pin-line"
                size="small"
              />
              <span>{{ props.providerSelected.address || 'Sin dirección' }}</span>
            </div>
          </div>
        </div>

        <VRow>
          <VCol
            cols="12"
            sm="6"
          >
            <VCard
              variant="outlined"
              class="h-100 pa-4 rounded-lg d-flex align-center gap-3"
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
              class="h-100 pa-4 rounded-lg d-flex align-center gap-3"
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
                <div class="font-weight-bold text-body-1">
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
              class="h-100 pa-4 rounded-lg d-flex align-center gap-3"
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
              class="h-100 pa-4 rounded-lg d-flex align-center gap-3"
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
                  class="font-weight-bold text-body-1"
                  style="word-break: break-all;"
                >
                  {{ props.providerSelected.email || 'Sin correo' }}
                </div>
              </div>
            </VCard>
          </VCol>

          <VCol cols="12">
            <VCard
              variant="outlined"
              class="pa-4 rounded-lg d-flex align-center gap-3"
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
