<script setup>
const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  partnerSelected: {
    type: [Object, null],
    required: false,
    default: null,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'deletePartner',
])

const onClose = () => {
  emit('update:isDialogVisible', false)
}

const onDelete = () => {
  emit('deletePartner')
}
</script>

<template>
  <VDialog v-if="props.isDialogVisible && props.partnerSelected" :width="$vuetify.display.smAndDown ? 'auto' : 500"
    :model-value="props.isDialogVisible" transition="dialog-bottom-transition"
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="custom-dialog-card elevation-24">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="onClose"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-user-unfollow-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Socio
        </h3>
        <p class="custom-dialog-subtitle">
          Confirmación de eliminación de registro
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8 text-center">
        <!-- Avatar y Nombre -->
        <VAvatar
          size="72"
          color="error"
          variant="tonal"
          class="mb-3"
        >
          <VIcon
            icon="ri-user-unfollow-line"
            size="36"
          />
        </VAvatar>

        <h3 class="text-h6 font-weight-bold text-high-emphasis mb-1">
          {{ props.partnerSelected.name || 'Socio sin nombre' }}
        </h3>

        <div class="mb-5">
          <VChip
            size="small"
            color="primary"
            variant="tonal"
            class="font-weight-medium"
            prepend-icon="ri-id-card-line"
          >
            DNI/RUC: {{ props.partnerSelected.identification || 'N/A' }}
          </VChip>
        </div>

        <!-- Ficha Resumen de Información -->
        <div class="bg-grey-lighten-4 rounded-lg pa-4 mb-4 text-left border">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                size="16"
                icon="ri-mail-line"
              />
              Correo:
            </span>
            <span class="text-body-2 font-weight-medium text-high-emphasis text-truncate" style="max-width: 230px;">
              {{ props.partnerSelected.email || 'N/A' }}
            </span>
          </div>

          <div class="d-flex align-center justify-space-between mb-2">
            <span class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                size="16"
                icon="ri-phone-line"
              />
              Teléfono:
            </span>
            <span class="text-body-2 font-weight-medium text-high-emphasis">
              {{ props.partnerSelected.phone || 'N/A' }}
            </span>
          </div>

          <div class="d-flex align-center justify-space-between">
            <span class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                size="16"
                icon="ri-map-pin-line"
              />
              Dirección:
            </span>
            <span class="text-body-2 font-weight-medium text-high-emphasis text-truncate" style="max-width: 230px;">
              {{ props.partnerSelected.address || 'N/A' }}
            </span>
          </div>
        </div>

        <!-- Alerta de Advertencia -->
        <VAlert
          type="error"
          variant="tonal"
          class="text-left text-caption pa-3 mb-0"
        >
          <template #prepend>
            <VIcon icon="ri-error-warning-line" />
          </template>
          Esta acción eliminará al socio permanentemente del sistema y no se podrá deshacer.
        </VAlert>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 justify-end bg-white">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="text-none px-6"
          @click="onClose"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="text-none px-6"
          @click="onDelete"
        >
          Eliminar Socio
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>