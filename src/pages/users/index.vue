<script setup>
import { useLoaderStore } from '@/stores/loader'
import UserAddDialog from '@/components/inventory/users/UserAddDialog.vue';
import UserViewDialog from '@/components/inventory/users/UserViewDialog.vue';
import UserEditDialog from '@/components/inventory/users/UserEditDialog.vue';
import UserDeleteDialog from '@/components/inventory/users/UserDeleteDialog.vue';

const loader = useLoaderStore();

// Notificaciones
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');
const roles = ref([]);
const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

const headers = [
    { title: 'ID', key: 'id' },
    { title: 'Nombre', key: 'name' },
    { title: 'Email', key: 'email' },
    { title: 'Rol', key: 'role.name' },
    { title: 'Fecha Reg.', key: 'created_at' },
    { title: 'Acción', key: 'action' },
];

const isUserAddDialogVisible = ref(false);
const isUserEditDialogVisible = ref(false);
const isUserDeleteDialogVisible = ref(false);
const isUserViewDialogVisible = ref(false);

const isLoading = ref(false);
const list_users = ref([]);
const seachQuery = ref(null);
const user_selected_edit = ref(null);
const user_selected_delete = ref(null);
const user_selected_view = ref(null);

const list = async () => {
    isLoading.value = true;
    try {
        // Endpoint provisional 'users'
        const resp = await $api("users?search=" + (seachQuery.value ? seachQuery.value : ''), {
            method: 'GET',
            onResponseError({ response }) {
                console.log(response._data.error);
                showNotification('Error al cargar los usuarios', 'error');
            }
        });

        // Ajustar según la estructura de respuesta real
        list_users.value = resp.users || [];
        showNotification('Lista de usuarios cargada correctamente', 'success');
        console.log(resp);

    } catch (error) {
        console.log(error);
        showNotification('Error al cargar la lista de usuarios', 'error');
    } finally {
        isLoading.value = false;
    }
}

const addNewUser = (newUser) => {
    // Crear una copia del usuario para evitar problemas de reactividad
    const userToAdd = {
        ...newUser,
        role: { ...newUser.role } // Asegurar que role sea un objeto plano
    };

    list_users.value.unshift(userToAdd);
    showNotification('Usuario agregado correctamente', 'success');
}

const addEditUser = (updatedUser) => {
    console.log('Actualizando usuario:', updatedUser);
    const index = list_users.value.findIndex(user => user.id === updatedUser.id);
    if (index !== -1) {
        list_users.value[index] = updatedUser;
        showNotification('Usuario actualizado correctamente', 'success');
    } else {
        list();
    }
}

const addDeleteUser = (deletedUser) => {
    console.log('Eliminando usuario:', deletedUser);
    const index = list_users.value.findIndex(user => user.id === deletedUser.id);
    if (index !== -1) {
        list_users.value.splice(index, 1);
        showNotification('Usuario eliminado correctamente', 'success');
    } else {
        list();
    }
}

const editItem = (item) => {
    console.log(item);
    user_selected_edit.value = item;
    isUserEditDialogVisible.value = true;
}

const deleteItem = (item) => {
    // Proteger al usuario con ID = 1 (Super-Admin)
    if (item.id === 1) {
        showNotification('No se puede eliminar al usuario con ID 1 (Super-Admin)', 'error');
        return;
    }
    
    console.log(item);
    user_selected_delete.value = item;
    isUserDeleteDialogVisible.value = true;
}

const viewItem = (item) => {
    console.log(item);
    user_selected_view.value = item;
    isUserViewDialogVisible.value = true;
}
const loadRoles = async () => {
    try {
        const resp = await $api("role", {
            method: "GET",
            onResponseError({ response }) {
                console.error('Error al cargar roles:', response._data.error);
            },
        });

        roles.value = resp.roles;
        console.log('Roles cargados:', roles.value);

    } catch (error) {
        console.error('Error al cargar roles:', error);
    }
}



onMounted(() => {
    // Descomentar cuando exista el endpoint real
    loadRoles();
    list();
});
</script>

<template>
    <div>
        <!-- Overlay global -->
        <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
            <VProgressCircular indeterminate size="48" width="4" color="primary" />
        </VOverlay>
        <VCard elevation="8" class="pa-6 rounded-xl border-thin">
            <!-- Título -->
            <VRow class="mb-4">
                <VCol>
                    <div class="d-flex align-center gap-3">
                        <VIcon icon="ri-group-line" color="primary" size="28" />
                        <div>
                            <h4 class="text-h5 font-weight-bold mb-1">
                                Usuarios
                            </h4>
                            <span class="text-body-2 text-medium-emphasis">
                                Gestión de usuarios del sistema
                            </span>
                        </div>
                    </div>
                </VCol>
            </VRow>

            <!-- Acciones -->
            <VRow align="center" justify="space-between" class="mb-6">
                <VCol cols="12" md="5">
                    <VTextField label="Buscar usuario" placeholder="Ej: Juan Perez" prepend-inner-icon="ri-search-line"
                        clearable density="comfortable" variant="outlined" hide-details @keyup.enter="list"
                        v-model="seachQuery" />
                </VCol>

                <VCol cols="12" md="4" class="d-flex justify-end gap-3">
                    <VBtn color="primary" variant="elevated" size="large" class="text-none px-6"
                        @click="isUserAddDialogVisible = !isUserAddDialogVisible">
                        <VIcon start icon="ri-add-line" />
                        Nuevo usuario
                    </VBtn>
                </VCol>
            </VRow>

            <VDivider class="mb-4" />

            <!-- Tabla -->
            <VDataTable :headers="headers" :items="list_users" :items-per-page="10"
                class="text-no-wrap elevation-1 rounded-lg">
                <template #item.id="{ item }">
                    <span color="primary" variant="tonal" size="small">
                        {{ item.id }}
                    </span>
                </template>

                <template #item.name="{ item }">
                    <span>
                        {{ item.name || '' }}{{ item.surname ? ' ' + item.surname : '' }}
                    </span>
                </template>

                <template #item.role.name="{ item }">
                    <VChip color="primary" variant="tonal" size="small">
                        {{ item.role?.name || 'Sin rol' }}
                    </VChip>
                </template>

                <template #item.created_at="{ item }">
                    <span>
                        {{ new Date(item.created_at).toLocaleDateString('es-EC', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        }) }}
                    </span>
                </template>

                <template #no-data>
                    <div class="text-center text-medium-emphasis py-6">
                        <VIcon icon="ri-database-2-line" size="36" class="mb-2" />
                        <div>No hay usuarios disponibles</div>
                    </div>
                </template>

                <!-- Actions -->
                <template #item.action="{ item }">
                    <div class="d-flex align-center gap-2">
                        <VTooltip text="Ver">
                            <template #activator="{ props }">
                                <IconBtn v-bind="props" size="small" color="info" variant="text"
                                    @click="viewItem(item)">
                                    <VIcon icon="ri-eye-line" />
                                </IconBtn>
                            </template>
                        </VTooltip>

                        <VTooltip text="Editar">
                            <template #activator="{ props }">
                                <IconBtn v-bind="props" size="small" color="primary" variant="text"
                                    @click="editItem(item)">
                                    <VIcon icon="ri-pencil-line" />
                                </IconBtn>
                            </template>
                        </VTooltip>

                        <VTooltip text="Eliminar" v-if="item.id !== 1">
                            <template #activator="{ props }">
                                <IconBtn v-bind="props" size="small" color="error" variant="text"
                                    @click="deleteItem(item)">
                                    <VIcon icon="ri-delete-bin-line" />
                                </IconBtn>
                            </template>
                        </VTooltip>
                    </div>
                </template>

            </VDataTable>
        </VCard>

        <!-- Dialogs -->
        <UserAddDialog v-if="roles && roles.length > 0" v-model:isDialogVisible="isUserAddDialogVisible" :roles="roles"
            @addUser="addNewUser" />
        <UserViewDialog v-if="user_selected_view" v-model:isDialogVisible="isUserViewDialogVisible" :user="user_selected_view" />
        <UserEditDialog v-if="user_selected_edit" v-model:isDialogVisible="isUserEditDialogVisible" :userSelected="user_selected_edit" :roles="roles" @editUser="addEditUser" />
        <UserDeleteDialog v-if="user_selected_delete" v-model:isDialogVisible="isUserDeleteDialogVisible" :userSelected="user_selected_delete" @deleteUser="addDeleteUser" />

        <!-- Notificación Toast -->
        <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />

    </div>
</template>

<style scoped>
:deep(.v-data-table__tr td) {
    padding-top: 15px !important;
    padding-bottom: 15px !important;
}
</style>
