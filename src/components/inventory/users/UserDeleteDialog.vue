<script setup>
import { ref } from 'vue';
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    userSelected: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits([
    'update:isDialogVisible',
    'deleteUser',
]);

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const confirmDelete = async () => {
    // Verificar si el usuario es super-admin (ID = 1)
    if (props.userSelected.id === 1) {
        showNotification('No se puede eliminar al usuario con ID 1 (Super-Admin)', 'error');
        return;
    }

    loader.start();

    try {
        const resp = await $api(`users/${props.userSelected.id}`, {
            method: "DELETE",
            onResponseError({ response }) {
                console.error('Error al eliminar usuario:', response);
                console.error('Data del error:', response._data);
                console.error('Status:', response.status);
                console.error('StatusText:', response.statusText);

                let errorMessage = 'Error desconocido';

                if (response._data) {
                    // Manejar errores específicos
                    if (response._data.message) {
                        if (response._data.message.includes('SQLSTATE[23000]')) {
                            if (response._data.message.includes('foreign key constraint')) {
                                errorMessage = 'No se puede eliminar el usuario. Tiene registros asociados.';
                            } else {
                                errorMessage = 'Error de base de datos al eliminar usuario.';
                            }
                        } else {
                            errorMessage = response._data.message;
                        }
                    } else if (response._data.error) {
                        errorMessage = response._data.error;
                    } else if (response._data.errors) {
                        // Errores de validación Laravel
                        const firstErrorKey = Object.keys(response._data.errors)[0];
                        if (firstErrorKey) {
                            errorMessage = response._data.errors[firstErrorKey][0];
                        }
                    } else {
                        errorMessage = JSON.stringify(response._data);
                    }
                } else if (response.statusText) {
                    errorMessage = response.statusText;
                } else if (response.status) {
                    errorMessage = `Error HTTP ${response.status}`;
                }

                showNotification(errorMessage, 'error');
            },
        });

        showNotification('Usuario eliminado con éxito', 'success');
        emit('deleteUser', props.userSelected);

        // Cerrar diálogo
        emit('update:isDialogVisible', false);

    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        showNotification('Error al eliminar usuario', 'error');
    } finally {
        loader.stop();
    }
};

const cancelDelete = () => {
    emit('update:isDialogVisible', false);
};
</script>

<template>
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 450" :model-value="props.isDialogVisible"
        @update:model-value="val => emit('update:isDialogVisible', val)" transition="dialog-bottom-transition">
        <VCard class="pa-6 rounded-xl elevation-8">
            <!-- Close Button -->
            <DialogCloseBtn variant="text" size="small" class="position-absolute top-0 end-0 ma-4"
                @click="cancelDelete" />

            <!-- Header -->
            <div class="text-center mb-6">
                <VIcon icon="ri-delete-bin-line" size="48" color="error" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-2">
                    Eliminar Usuario
                </h4>
                <p class="text-body-1 text-medium-emphasis">
                    ¿Estás seguro que deseas eliminar a <strong>{{ props.userSelected.name + ' ' +
                        props.userSelected.surname || 'este usuario'
                    }}</strong>?
                </p>
            </div>

            <!-- Alerta especial para Super-Admin -->
            <VAlert color="error" variant="tonal" class="mb-6" v-if="props.userSelected.id === 1">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-shield-cross-line" size="20" />
                    <span>
                        <strong>Usuario Protegido:</strong> El Super-Admin no puede ser eliminado
                    </span>
                </div>
            </VAlert>

            <!-- Alerta general -->
            <VAlert color="warning" variant="tonal" class="mb-6" v-else>
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-error-warning-line" size="20" />
                    <span>
                        Esta acción es permanente y no se puede deshacer
                    </span>
                </div>
            </VAlert>

            <!-- Acciones -->
            <div class="d-flex justify-end gap-3">
                <VBtn variant="outlined" color="secondary" class="text-none px-6" @click="cancelDelete"
                    :disabled="loader.loading">
                    Cancelar
                </VBtn>

                <VBtn color="error" variant="elevated" class="text-none px-6" @click="confirmDelete"
                    :loading="loader.loading" :disabled="loader.loading ||
                        props.userSelected.id === 1">
                    <VIcon start icon="ri-delete-bin-line" />
                    Eliminar
                </VBtn>
            </div>
        </VCard>
    </VDialog>
</template>
