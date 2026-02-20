<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    user: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits([
    'update:isDialogVisible',
]);

// Formatear fecha
const formatDate = (dateString) => {
    if (!dateString) return 'No disponible';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Obtener initials para el avatar si no hay imagen
const getUserInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Corregir URL de la imagen
const getAvatarUrl = (avatar) => {
    console.log(avatar);

    if (!avatar) return null;

    // Si ya es una URL completa (http/https), retornarla tal cual
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        return avatar;
    }

    // Si no es URL completa, construir una
    return `http://127.0.0.1:8000/storage/${avatar}`;
};

// Determinar color de estado
const getStatusColor = (status) => {
    return status === '1' ? 'success' : 'error';
};

// Determinar texto de estado
const getStatusText = (status) => {
    return status === '1' ? 'Activo' : 'Inactivo';
};

// Determinar texto de género
const getGenderText = (gender) => {
    const genderMap = {
        'M': 'Masculino',
        'F': 'Femenino',
        'O': 'Otro'
    };
    return genderMap[gender] || 'No especificado';
};

// Función para cerrar el diálogo
const closeDialog = () => {
    emit('update:isDialogVisible', false);
};
</script>

<template>
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 600" :model-value="props.isDialogVisible"
        @update:model-value="val => emit('update:isDialogVisible', val)" transition="dialog-bottom-transition">
        <VCard class="pa-6 pa-sm-8 rounded-xl elevation-10">
            <!-- Close -->
            <DialogCloseBtn variant="text" size="small" class="position-absolute top-0 end-0 ma-4"
                @click="closeDialog" />

            <!-- Header -->
            <div class="text-center mb-6">
                <VIcon icon="ri-user-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Detalles del Usuario
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Información completa del usuario
                </p>
            </div>

            <!-- Avatar y Nombre Principal -->
            <div class="text-center mb-6">
                <VAvatar :image="getAvatarUrl(user.avatar)" size="120" class="elevation-6 mb-3"
                    v-if="getAvatarUrl(user.avatar)" />
                <VAvatar size="120" color="primary" class="elevation-6 mb-3" v-else>
                    <span class="text-h4 font-weight-bold text-white">
                        {{ getUserInitials(user.name) }}
                    </span>
                </VAvatar>
                <h3 class="text-h5 font-weight-bold mb-1">
                    {{ user.name || 'Sin nombre' }}
                </h3>
                <p class="text-body-2 text-medium-emphasis mb-2">
                    {{ user.email || 'Sin email' }}
                </p>
                <VChip :color="getStatusColor(user.status)" variant="tonal" size="small" class="font-weight-medium">
                    {{ getStatusText(user.status) }}
                </VChip>
            </div>

            <!-- Información Personal -->
            <VRow class="mb-4">
                <VCol cols="12">
                    <h5 class="text-h6 font-weight-bold mb-3 d-flex align-center">
                        <VIcon icon="ri-user-line" size="20" class="me-2" />
                        Información Personal
                    </h5>
                </VCol>

                <VCol cols="12" sm="6">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">Nombre Completo</p>
                        <p class="text-body-2 font-weight-medium">
                            {{ user.name || 'No disponible' }}
                        </p>
                    </div>
                </VCol>

                <VCol cols="12" sm="6">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">Cédula/RUC</p>
                        <p class="text-body-2 font-weight-medium">
                            {{ user.identification || 'No disponible' }}
                        </p>
                    </div>
                </VCol>

                <VCol cols="12" sm="6">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">Teléfono</p>
                        <p class="text-body-2 font-weight-medium">
                            {{ user.phone || 'No disponible' }}
                        </p>
                    </div>
                </VCol>

                <VCol cols="12" sm="6">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">Género</p>
                        <p class="text-body-2 font-weight-medium">
                            {{ getGenderText(user.gender) }}
                        </p>
                    </div>
                </VCol>

                <VCol cols="12">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">Dirección</p>
                        <p class="text-body-2 font-weight-medium">
                            {{ user.address || 'No disponible' }}
                        </p>
                    </div>
                </VCol>
            </VRow>

            <!-- Información del Sistema -->
            <VRow class="mb-4">
                <VCol cols="12">
                    <h5 class="text-h6 font-weight-bold mb-3 d-flex align-center">
                        <VIcon icon="ri-settings-3-line" size="20" class="me-2" />
                        Información del Sistema
                    </h5>
                </VCol>

                <VCol cols="12" sm="6">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">Rol</p>
                        <p class="text-body-2 font-weight-medium">
                            {{ user.role?.name || 'Sin rol asignado' }}
                        </p>
                    </div>
                </VCol>

                <VCol cols="12" sm="6">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">Sucursal</p>
                        <p class="text-body-2 font-weight-medium">
                            {{ user.sucursale?.name || 'Sucursal Principal' }}
                        </p>
                    </div>
                </VCol>

                <VCol cols="12" sm="6">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">Fecha de Creación</p>
                        <p class="text-body-2 font-weight-medium">
                            {{ formatDate(user.created_at) }}
                        </p>
                    </div>
                </VCol>

                <VCol cols="12" sm="6">
                    <div class="mb-3">
                        <p class="text-caption text-medium-emphasis mb-1">ID de Usuario</p>
                        <p class="text-body-2 font-weight-medium">
                            #{{ user.id || 'N/A' }}
                        </p>
                    </div>
                </VCol>
            </VRow>

            <!-- Acciones -->
            <VCol cols="12" class="d-flex justify-end gap-3 mt-4">
                <VBtn variant="outlined" color="secondary" class="text-none px-6"
                    @click="emit('update:isDialogVisible', false)">
                    <VIcon start icon="ri-close-line" />
                    Cerrar
                </VBtn>
            </VCol>
        </VCard>
    </VDialog>
</template>
