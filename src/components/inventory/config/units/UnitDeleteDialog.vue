<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import NotificationToast from '@/components/common/NotificationToast.vue'

const loader = useLoaderStore()

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  unitSelected: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits([
  'update:isDialogVisible',
  'deleteUnit',
]);

const warning = ref(null);
const error_exist = ref(null);

// Variables para NotificationToast
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message;
  notificationType.value = type;
  notificationShow.value = true;
};

const confirmDelete = async () => {
    if (!props.unitSelected) return;
    
    loader.start();
    warning.value = null;
    error_exist.value = null;

    try {
        const resp = await $api("units/" + props.unitSelected.id, {
            method: 'DELETE',
            onResponseError({ response }) {
                error_exist.value = response._data.error;
                showNotification('Error al eliminar unidad', 'error');
            },
        });
        
        console.log(resp);
        showNotification('Unidad eliminada correctamente', 'success');
        
        // Emitir evento para eliminar de la tabla
        emit('deleteUnit', props.unitSelected);
        
        // Cerrar diálogo
        emit('update:isDialogVisible', false);
        
        loader.stop();
    } catch (error) {
        console.error('Error al eliminar unidad:', error);
        showNotification('Error al eliminar unidad', 'error');
        loader.stop();
    }
};

const cancelDelete = () => {
    emit('update:isDialogVisible', false);
};
</script>

<template>
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 500" :model-value="props.isDialogVisible"
        @update:model-value="val => emit('update:isDialogVisible', val)" transition="dialog-bottom-transition">
        <VCard class="pa-6 pa-sm-8 rounded-xl elevation-10">

            <!-- Close -->
            <DialogCloseBtn variant="text" size="small" class="position-absolute top-0 end-0 ma-4"
                @click="cancelDelete" />

            <!-- Header -->
            <div class="text-center mb-6">
                <VIcon icon="ri-delete-bin-6-line" size="48" color="error" class="mb-4" />
                <h4 class="text-h4 font-weight-bold mb-2">
                    Eliminar Unidad
                </h4>
                <p class="text-body-1 text-medium-emphasis mb-4">
                    ¿Estás seguro de que deseas eliminar esta unidad?
                </p>
                <div class="text-body-2 text-error font-weight-medium mb-2">
                    <strong>{{ props.unitSelected?.name }}</strong>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                    <strong>ID:</strong> {{ props.unitSelected?.id }}<br>
                    <strong>Estado:</strong> {{ props.unitSelected?.state === 1 ? 'Activo' : 'Inactivo' }}
                </div>
            </div>

            <!-- Alertas de Error -->
            <VAlert v-if="warning" color="warning" variant="tonal" closable class="mb-4">
                {{ warning }}
            </VAlert>

            <VAlert v-if="error_exist" color="error" variant="tonal" closable class="mb-4">
                {{ error_exist }}
            </VAlert>

            <!-- Acciones -->
            <VCardActions class="pa-4 justify-center gap-3">
                <VBtn variant="outlined" color="secondary" class="text-none px-6" @click="cancelDelete"
                    :disabled="loader.loading">
                    <VIcon start icon="ri-close-line" />
                    Cancelar
                </VBtn>

                <VBtn color="error" variant="elevated" class="text-none px-6" @click="confirmDelete"
                    :loading="loader.loading" :disabled="loader.loading">
                    <VIcon start icon="ri-delete-bin-6-line" />
                    Eliminar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
