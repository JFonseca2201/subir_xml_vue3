<script setup>
import { ref } from 'vue';
import { useLoaderStore } from '@/stores/loader'
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

// Notificaciones
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

// Obtener initials para el avatar si no hay imagen
const getUserInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Corregir URL de la imagen
const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    
    // Si ya es una URL completa, retornarla tal cual
    if (avatar.startsWith('http')) {
        return avatar;
    }
    
    // Si empieza con users/, agregar el storage completo
    if (avatar.startsWith('users/')) {
        return `http://127.0.0.1:8000/storage/${avatar}`;
    }
    
    // Si empieza con /storage, corregir el doble slash
    if (avatar.startsWith('/storage')) {
        return avatar.replace('//storage', '/storage');
    }
    
    // Si empieza con storage/, agregar el slash inicial
    if (avatar.startsWith('storage/')) {
        return `http://127.0.0.1:8000/${avatar}`;
    }
    
    // Si no empieza con slash, agregarlo
    if (!avatar.startsWith('/')) {
        return `http://127.0.0.1:8000/storage/${avatar}`;
    }
    
    return avatar;
};

// Determinar color de estado
const getStatusColor = (status) => {
    return status === '1' ? 'success' : 'error';
};

// Determinar texto de estado
const getStatusText = (status) => {
    return status === '1' ? 'Activo' : 'Inactivo';
};

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
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 500" :model-value="props.isDialogVisible"
        @update:model-value="val => emit('update:isDialogVisible', val)" transition="dialog-bottom-transition">
        <VCard class="pa-6 pa-sm-8 rounded-xl elevation-10">
            
            <!-- Header -->
            <div class="text-center mb-6">
                <VIcon icon="ri-delete-bin-line" size="42" color="error" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Eliminar Usuario
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    ¿Estás seguro de que deseas eliminar este usuario?
                </p>
            </div>

            <!-- Información del usuario a eliminar -->
            <div class="d-flex align-center gap-4 mb-6 pa-4 bg-error-light rounded-lg">
                <VAvatar 
                    :image="getAvatarUrl(props.userSelected.avatar)" 
                    size="60" 
                    class="elevation-3"
                    v-if="props.userSelected.avatar"
                />
                <VAvatar 
                    size="60" 
                    color="error" 
                    class="elevation-3"
                    v-else
                >
                    <span class="text-h6 font-weight-bold text-white">
                        {{ getUserInitials(props.userSelected.name) }}
                    </span>
                </VAvatar>
                
                <div class="flex-grow-1">
                    <h5 class="text-h6 font-weight-bold mb-1">
                        {{ props.userSelected.name || 'Sin nombre' }}
                    </h5>
                    <p class="text-body-2 text-medium-emphasis mb-1">
                        {{ props.userSelected.email || 'Sin email' }}
                    </p>
                    <div class="d-flex align-center gap-2">
                        <VChip 
                            :color="getStatusColor(props.userSelected.status)" 
                            variant="tonal" 
                            size="small"
                            class="font-weight-medium"
                        >
                            {{ getStatusText(props.userSelected.status) }}
                        </VChip>
                        <VChip color="primary" variant="tonal" size="small" v-if="props.userSelected.role?.name">
                            {{ props.userSelected.role.name }}
                        </VChip>
                    </div>
                </div>
            </div>

            <!-- Alerta de advertencia -->
            <VAlert color="warning" variant="tonal" class="mb-6">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-error-warning-line" size="20" />
                    <div>
                        <strong>Advertencia:</strong> Esta acción no se puede deshacer. 
                        El usuario será eliminado permanentemente del sistema.
                    </div>
                </div>
            </VAlert>

            <!-- Alerta especial para Super-Admin -->
            <VAlert color="error" variant="tonal" class="mb-6" 
                v-if="props.userSelected.id === 1">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-shield-cross-line" size="20" />
                    <div>
                        <strong>Protegido:</strong> El usuario con ID 1 (Super-Admin) no puede ser eliminado 
                        por seguridad del sistema.
                    </div>
                </div>
            </VAlert>

            <!-- Acciones -->
            <VCol cols="12" class="d-flex justify-end gap-3">
                <VBtn variant="outlined" color="secondary" class="text-none px-6" 
                    @click="cancelDelete" :disabled="loader.loading">
                    <VIcon start icon="ri-close-line" />
                    Cancelar
                </VBtn>

                <VBtn color="error" variant="elevated" class="text-none px-6"
                    @click="confirmDelete" :loading="loader.loading" :disabled="loader.loading || 
                        props.userSelected.id === 1">
                    <VIcon start icon="ri-delete-bin-line" />
                    Eliminar Usuario
                </VBtn>
            </VCol>
        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>

<style scoped>
.bg-error-light {
    background-color: rgba(239, 83, 80, 0.08);
}
</style>
