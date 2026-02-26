<script setup>

import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    conversionToDelete: {
        type: Object,
        required: true,
    },
})

const emit = defineEmits(["update:isDialogVisible", "deleteConversion"]);

const deleteConversion = async () => {
    loader.start();
    
    try {
        const resp = await $api(`unit-conversions/${props.conversionToDelete.id}`, {
            method: "DELETE"
        });
        
        console.log('Conversión eliminada:', resp);
        showNotification('Conversión eliminada correctamente', 'success');
        emit("deleteConversion", props.conversionToDelete);
        emit("update:isDialogVisible", false);
        
    } catch (error) {
        console.error('Error al eliminar conversión:', error);
        showNotification('Error al eliminar conversión', 'error');
    } finally {
        loader.stop();
    }
};

const onDialogClose = () => {
    emit("update:isDialogVisible", false);
};
</script>

<template>
    <VDialog max-width="400" :model-value="props.isDialogVisible" @update:model-value="onDialogClose" persistent>
        <VCard class="pa-4">
            <!-- Header -->
            <VCardText class="text-center pb-4">
                <VIcon icon="ri-delete-bin-line" size="32" color="error" class="mb-2" />
                <h5 class="text-h5 font-weight-bold mb-2">Eliminar Conversión</h5>
                <p class="text-body-2 text-medium-emphasis mb-3">
                    ¿Eliminar esta conversión?
                </p>
                <div class="d-flex align-center justify-center gap-2">
                    <VChip size="small" color="primary" variant="tonal">
                        {{ conversionToDelete.unit_from?.name || 'Origen' }}
                    </VChip>
                    <VIcon icon="ri-arrow-right-line" size="16" />
                    <VChip size="small" color="success" variant="tonal">
                        {{ conversionToDelete.unit_to?.name || conversionToDelete.unit?.name || 'Destino' }}
                    </VChip>
                </div>
            </VCardText>

            <!-- Actions -->
            <VCardActions class="pa-4 pt-0">
                <VSpacer />
                <VBtn variant="text" prepend-icon="ri-close-line" @click="onDialogClose" :disabled="loader.loading">
                    Cancelar
                </VBtn>
                <VBtn color="error" variant="elevated" prepend-icon="ri-delete-bin-line" @click="deleteConversion" 
                    :loading="loader.loading" :disabled="loader.loading">
                    Eliminar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>