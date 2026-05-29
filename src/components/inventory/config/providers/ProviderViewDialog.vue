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
  <VDialog :model-value="props.isDialogVisible" max-width="600px"
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard>
      <!-- Header -->
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <div class="d-flex align-center gap-2">
          <VAvatar color="primary" variant="tonal" size="40">
            <VIcon icon="ri-building-4-line" />
          </VAvatar>
          <span class="text-h6 font-weight-bold">Detalles del Proveedor</span>
        </div>
        <VBtn icon variant="text" @click="closeDialog" color="secondary">
          <VIcon icon="ri-close-line" />
        </VBtn>
      </VCardTitle>

      <VDivider />

      <!-- Content -->
      <VCardText class="pa-5">
        <div class="mb-5 d-flex align-center gap-4">
          <VAvatar size="64" color="primary" variant="tonal" rounded>
            <span class="text-h4 font-weight-bold">{{ props.providerSelected.name ? props.providerSelected.name.charAt(0).toUpperCase() : 'P' }}</span>
          </VAvatar>
          <div>
            <h3 class="text-h5 font-weight-bold mb-1">{{ props.providerSelected.name || 'Sin nombre' }}</h3>
            <div class="d-flex align-center gap-1 text-medium-emphasis">
              <VIcon icon="ri-map-pin-line" size="small" />
              <span>{{ props.providerSelected.address || 'Sin dirección' }}</span>
            </div>
          </div>
        </div>

        <VRow>
          <VCol cols="12" sm="6">
            <VCard variant="outlined" class="h-100 pa-4 rounded-lg d-flex align-center gap-3">
              <VAvatar color="info" variant="tonal" rounded size="40">
                <VIcon icon="ri-hashtag" />
              </VAvatar>
              <div>
                <div class="text-caption text-medium-emphasis">Código</div>
                <div class="font-weight-bold text-body-1">PROV-{{ String(props.providerSelected.id).padStart(3, '0') }}</div>
              </div>
            </VCard>
          </VCol>

          <VCol cols="12" sm="6">
            <VCard variant="outlined" class="h-100 pa-4 rounded-lg d-flex align-center gap-3">
              <VAvatar color="warning" variant="tonal" rounded size="40">
                <VIcon icon="ri-file-list-3-line" />
              </VAvatar>
              <div>
                <div class="text-caption text-medium-emphasis">RUC</div>
                <div class="font-weight-bold text-body-1">{{ props.providerSelected.ruc || 'Sin RUC' }}</div>
              </div>
            </VCard>
          </VCol>

          <VCol cols="12">
            <VCard variant="outlined" class="pa-4 rounded-lg d-flex align-center gap-3">
              <VAvatar color="success" variant="tonal" rounded size="40">
                <VIcon icon="ri-calendar-line" />
              </VAvatar>
              <div>
                <div class="text-caption text-medium-emphasis">Fecha de Registro</div>
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
      <VCardActions class="pa-4 justify-end">
        <VBtn color="secondary" variant="tonal" @click="closeDialog" class="px-6">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
