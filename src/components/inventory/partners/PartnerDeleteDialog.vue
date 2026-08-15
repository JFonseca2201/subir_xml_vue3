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
    <VCard class="custom-dialog-card pa-0 elevation-10">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn" @click="onClose" />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-user-unfollow-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Socio
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá el registro del socio
        </p>
      </div>

      <div class="pa-6 pa-sm-8">
        <p class="text-body-2 text-medium-emphasis">
          ¿Estás seguro que deseas eliminar al siguiente socio?
        </p>
      </div>
      <VRow>
        <VCol cols="12">
          <VTextField :model-value="props.partnerSelected.name" label="Nombres y Apellidos" readonly variant="outlined"
            density="comfortable" prepend-inner-icon="ri-user-line" hide-details="auto" />
        </VCol>
        <VCol cols="12">
          <VTextField :model-value="props.partnerSelected.identification" label="Cédula o RUC" readonly
            variant="outlined" density="comfortable" prepend-inner-icon="ri-id-card-line" hide-details="auto" />
        </VCol>
        <VCol cols="12">
          <VTextField :model-value="props.partnerSelected.email" label="Correo Electrónico" readonly variant="outlined"
            density="comfortable" prepend-inner-icon="ri-mail-line" hide-details="auto" />
        </VCol>
        <VCol cols="12">
          <VTextField :model-value="props.partnerSelected.phone" label="Teléfono" readonly variant="outlined"
            density="comfortable" prepend-inner-icon="ri-phone-line" hide-details="auto" />
        </VCol>
        <VCol cols="12">
          <VTextField :model-value="props.partnerSelected.address" label="Dirección" readonly variant="outlined"
            density="comfortable" prepend-inner-icon="ri-map-pin-line" hide-details="auto" />
        </VCol>
      </VRow>
      <VCol cols="12" class="d-flex justify-end gap-3 mt-4">
        <VBtn variant="outlined" color="secondary" class="text-none px-6" @click="onClose">
          <VIcon start icon="ri-close-line" />
          Cancelar
        </VBtn>
        <VBtn color="error" variant="elevated" class="text-none px-6" @click="onDelete">
          <VIcon start icon="ri-delete-bin-7-line" />
          Eliminar
        </VBtn>
      </VCol>

    </VCard>
  </VDialog>
</template>