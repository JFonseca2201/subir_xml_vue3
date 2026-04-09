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
    clientSelected: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits([
    'update:isDialogVisible',
    'deleteClient',
]);

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Computed properties para obtener labels
const typeClientOptions = ref([
    { title: 'Natural', value: 1 },
    { title: 'Jurídico o Compañía', value: 2 }
])

const stateOptions = ref([
    { title: 'Activo', value: 1 },
    { title: 'Inactivo', value: 2 }
])

const getClientTypeLabel = computed(() => {
    if (!props.clientSelected?.type_client) return 'No especificado'
    const option = typeClientOptions.value.find(opt => opt.value.toString() === props.clientSelected.type_client.toString())
    return option ? option.title : 'No especificado'
})

const getStateLabel = computed(() => {
    if (!props.clientSelected?.state) return 'No especificado'
    const option = stateOptions.value.find(opt => opt.value.toString() === props.clientSelected.state.toString())
    return option ? option.title : 'No especificado'
})

const isCompanyClient = computed(() => {
    return props.clientSelected?.type_client?.toString() === '2'
})

const fullName = computed(() => {
    if (!props.clientSelected) return ''

    if (isCompanyClient.value) {
        return props.clientSelected.full_name || props.clientSelected.name || ''
    } else {
        // Cliente final - combinar name y surname
        const name = props.clientSelected.name || ''
        const surname = props.clientSelected.surname || ''
        return name && surname ? `${name} ${surname}` : name || surname || ''
    }
})

const confirmDelete = async () => {
    if (!props.clientSelected || !props.clientSelected.id) {
        console.error('No hay cliente seleccionado para eliminar')
        showNotification('Error: no se puede eliminar, cliente no seleccionado', 'error')
        return
    }

    loader.start()

    try {
        const resp = await $api(`clients/${props.clientSelected.id}`, {
            method: "DELETE",
            onResponseError({ response }) {
                console.error('Error al eliminar cliente:', response);
                console.error('Data del error:', response._data);
                console.error('Status:', response.status);
                console.error('StatusText:', response.statusText);

                let errorMessage = 'Error desconocido';

                if (response._data) {
                    // Manejar errores específicos
                    if (response._data.message) {
                        if (response._data.message.includes('SQLSTATE[23000]')) {
                            if (response._data.message.includes('foreign key constraint')) {
                                errorMessage = 'No se puede eliminar el cliente. Tiene facturas u otros registros asociados.';
                            } else {
                                errorMessage = 'Error de base de datos al eliminar cliente.';
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

        showNotification('Cliente eliminado con éxito', 'success');
        emit('deleteClient', props.clientSelected);

        // Cerrar diálogo
        emit('update:isDialogVisible', false);

    } catch (error) {
        console.error('Error al eliminar cliente:', error);

        // Si hay error de red o servidor, pero el cliente fue eliminado del backend
        // aún así eliminarlo de la lista local
        if (props.clientSelected) {
            emit('deleteClient', props.clientSelected)
            emit('update:isDialogVisible', false)
            showNotification('Cliente eliminado (verificar en servidor)', 'warning')
        } else {
            showNotification('Error al eliminar cliente', 'error');
        }
    } finally {
        loader.stop();
    }
};

const cancelDelete = () => {
    emit('update:isDialogVisible', false);
};
</script>

<template>
    <VDialog :model-value="props.isDialogVisible" @update:model-value="val => emit('update:isDialogVisible', val)"
        max-width="600px" persistent :closable="!loader.loading">
        <VCard class="rounded-xl elevation-8">
            <!-- Header -->
            <VCardTitle class="d-flex align-center justify-space-between pa-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-delete-bin-line" color="error" />
                    <span class="text-h6 font-weight-bold">Eliminar Cliente</span>
                </div>
                <VBtn icon variant="text" @click="emit('update:isDialogVisible', false)" :disabled="loader.loading">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VDivider />

            <!-- Content -->
            <VCardText class="pa-4">
                <div class="text-center">
                    <!-- Avatar -->
                    <VAvatar size="80" :color="isCompanyClient ? 'primary' : 'secondary'" variant="tonal" class="mb-4">
                        <VIcon :icon="isCompanyClient ? 'ri-building-line' : 'ri-user-3-line'" size="40" />
                    </VAvatar>

                    <!-- Client Info -->
                    <div class="mb-4">
                        <h4 class="text-h6 font-weight-bold mb-2">
                            {{ fullName || 'Cliente sin nombre' }}
                        </h4>

                        <div class="d-flex flex-column gap-1">
                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-briefcase-line" size="16" />
                                <span class="text-body-2">
                                    <strong>Tipo:</strong> {{ getClientTypeLabel }}
                                </span>
                            </div>

                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-id-card-line" size="16" />
                                <span class="text-body-2">
                                    <strong>Documento:</strong> {{ props.clientSelected?.n_document || 'Sin documento'
                                    }}
                                </span>
                            </div>

                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon icon="ri-hashtag" size="16" />
                                <span class="text-body-2">
                                    <strong>ID:</strong> {{ props.clientSelected?.id || 'Sin ID' }}
                                </span>
                            </div>

                            <div class="d-flex align-center justify-center gap-2">
                                <VIcon
                                    :icon="props.clientSelected?.state?.toString() === '1' ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'"
                                    size="16"
                                    :color="props.clientSelected?.state?.toString() === '1' ? 'success' : 'error'" />
                                <span class="text-body-2">
                                    <strong>Estado:</strong> {{ getStateLabel }}
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </VCardText>

            <VDivider />

            <!-- Actions -->
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn color="default" variant="outlined" @click="emit('update:isDialogVisible', false)"
                    :disabled="loader.loading">
                    <VIcon start icon="ri-close-line" />
                    Cancelar
                </VBtn>
                <VBtn color="error" variant="elevated" @click="confirmDelete" :loading="loader.loading"
                    :disabled="loader.loading">
                    <VIcon start icon="ri-delete-bin-line" />
                    Eliminar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>