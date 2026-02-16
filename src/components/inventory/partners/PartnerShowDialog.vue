<script setup>
const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    partnerSelected: {
        type: Object,
        required: true,
    }
});

const emit = defineEmits([
    'update:isDialogVisible'
]);

const onClose = () => {
    emit('update:isDialogVisible', false);
};
</script>

<template>
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 720" :model-value="props.isDialogVisible"
        @update:model-value="val => emit('update:isDialogVisible', val)" transition="dialog-bottom-transition">
        <VCard class="pa-6 pa-sm-10 rounded-xl elevation-10">
            <DialogCloseBtn variant="text" size="small" class="position-absolute top-0 end-0 ma-4" @click="onClose" />
            <div class="text-center mb-8">
                <VIcon icon="ri-user-3-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Perfil del Socio
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Visualiza la información del socio seleccionado
                </p>
            </div>
            <VRow>
                <VCol cols="12" sm="12">
                    <VTextField :model-value="props.partnerSelected.name" label="Nombres y Apellidos" readonly
                        variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line"
                        hide-details="auto" />
                </VCol>
                <VCol cols="12" sm="12">
                    <VTextField :model-value="props.partnerSelected.identification" label="Cédula o RUC" readonly
                        variant="outlined" density="comfortable" prepend-inner-icon="ri-id-card-line"
                        hide-details="auto" />
                </VCol>
                <VCol cols="12" sm="6">
                    <VTextField :model-value="props.partnerSelected.email" label="Correo Electrónico" readonly
                        variant="outlined" density="comfortable" prepend-inner-icon="ri-mail-line"
                        hide-details="auto" />
                </VCol>
                <VCol cols="12" sm="6">
                    <VTextField :model-value="props.partnerSelected.phone" label="Teléfono" readonly variant="outlined"
                        density="comfortable" prepend-inner-icon="ri-phone-line" hide-details="auto" />
                </VCol>
                <VCol cols="12">
                    <VTextField :model-value="props.partnerSelected.address" label="Dirección" readonly
                        variant="outlined" density="comfortable" prepend-inner-icon="ri-map-pin-line"
                        hide-details="auto" />
                </VCol>
            </VRow>
            <VCol cols="12" class="d-flex justify-end gap-3 mt-4">
                <VBtn variant="outlined" color="secondary" class="text-none px-6" @click="onClose">
                    <VIcon start icon="ri-close-line" />
                    Cerrar
                </VBtn>
            </VCol>
        </VCard>
    </VDialog>
</template>