<script setup>
import RoleDeleteDialog from '@/components/inventory/role/RoleDeleteDialog.vue';
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const loader = useLoaderStore();
const { showNotification } = useGlobalToast();

const data = ref([]);
const headers = [
    {
        title: 'ID',
        key: 'id',
    },
    {
        title: 'Rol',
        key: 'name',
    },
    {
        title: 'Fecha Reg.',
        key: 'created_at',
    },
    {
        title: 'Permisos',
        key: 'permissions_pluck',
    },
    {
        title: 'Acción',
        key: 'action',
        sortable: false,
    },
];
const isRoleAddDialogVisible = ref(false);
const isRoleEditDialogVisible = ref(false);
const isRoleDeleteDialogVisible = ref(false);

const list_roles = ref([]);
const seachQuery = ref(null);
const role_selected_edit = ref(null);
const role_selected_delete = ref(null);

const list = async () => {
    loader.start();
    try {
        const resp = await $api("role?search=" + (seachQuery.value ? seachQuery.value : ''), {
            method: 'GET',
            onResponseError({ response }) {
                console.log(response._data.error);
                showNotification('Error al cargar los roles', 'error');
            }
        });

        list_roles.value = resp.roles.filter(role => role.id !== 1);
        showNotification('Lista de roles cargada correctamente', 'success');
        console.log(resp);

    } catch (error) {
        console.log(error);
        showNotification('Error al cargar la lista de roles', 'error');
    } finally {
        loader.stop();
    }
}

const addNewRole = (newRole) => {
    list_roles.value.unshift(newRole);
    showNotification('Rol agregado correctamente a la tabla', 'success');
}

const addEditRole = (updatedRole) => {
    const index = list_roles.value.findIndex(role => role.id === updatedRole.id);
    if (index !== -1) {
        list_roles.value[index] = updatedRole;
        showNotification('Rol actualizado correctamente en la tabla', 'success');
    } else {
        list();
    }
}

const addDeleteRole = (deletedRole) => {
    const index = list_roles.value.findIndex(role => role.id === deletedRole.id);
    if (index !== -1) {
        list_roles.value.splice(index, 1);
        showNotification('Rol eliminado correctamente de la tabla', 'success');
    } else {
        list();
    }
}

const permissionColor = (permission) => {
    if (permission.startsWith('list_')) return 'success'
    if (permission.startsWith('edit_')) return 'primary'
    if (permission.startsWith('register_')) return 'info'
    if (permission.startsWith('delete_')) return 'error'
    return 'warning'
}

const getRoleColor = (roleName) => {
    const name = roleName.toLowerCase()
    if (name.includes('admin')) return 'warning'
    if (name.includes('vendedor') || name.includes('seller')) return 'success'
    if (name.includes('gerente') || name.includes('manager')) return 'primary'
    return 'secondary'
}

const getRoleIcon = (roleName) => {
    const name = roleName.toLowerCase()
    if (name.includes('admin')) return 'ri-vip-crown-line'
    if (name.includes('vendedor') || name.includes('seller')) return 'ri-shopping-cart-line'
    if (name.includes('gerente') || name.includes('manager')) return 'ri-briefcase-4-line'
    return 'ri-shield-user-line'
}

const editItem = (item) => {
    isRoleEditDialogVisible.value = true;
    role_selected_edit.value = item;
}

const deleteItem = (item) => {
    isRoleDeleteDialogVisible.value = true;
    role_selected_delete.value = item;
}

onMounted(() => {
    list();
});
</script>

<template>
    <div class="pa-4 pa-sm-6 roles-management-page">
        <!-- Encabezado de la página -->
        <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
            <div>
                <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
                    <VIcon icon="ri-shield-keyhole-line" color="primary" class="me-2" size="28" />
                    Roles y Permisos
                </h1>
                <p class="text-medium-emphasis mb-0">
                    Administración de accesos del sistema
                </p>
            </div>
            <div class="d-flex gap-2 flex-wrap">
                <VBtn color="primary" prepend-icon="ri-add-line"
                    @click="isRoleAddDialogVisible = !isRoleAddDialogVisible">
                    Nuevo Rol
                </VBtn>
            </div>
        </div>

        <!-- Contenedor Principal (Filtros y Tabla) -->
        <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
            <!-- Filtros y Búsqueda -->
            <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
                <VRow class="align-center">
                    <VCol cols="12" md="8">
                        <VTextField v-model="seachQuery" label="Buscar rol" placeholder="Ej: Administrador, Cajero..."
                            prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable"
                            hide-details="auto" clearable color="primary" @keyup.enter="list" />
                    </VCol>
                    <VCol cols="12" sm="6" md="2">
                        <VBtn color="secondary" variant="tonal" prepend-icon="ri-refresh-line" @click="list" block>
                            Limpiar
                        </VBtn>
                    </VCol>
                    <VCol cols="12" sm="6" md="2">
                        <VBtn color="primary" variant="tonal" prepend-icon="ri-search-line" :loading="loader.loading"
                            @click="list" block>
                            Buscar
                        </VBtn>
                    </VCol>
                </VRow>
            </VCardText>

            <!-- Tabla de Roles -->
            <div class="position-relative">
                <VProgressLinear v-if="loader.loading" indeterminate color="primary" height="3"
                    class="position-absolute" style="top: 0; left: 0; right: 0; z-index: 10;" />
                <div class="overflow-x-auto">
                    <VTable hover class="roles-table">
                        <thead>
                            <tr>
                                <th class="text-center font-weight-bold text-uppercase" style="width: 60px;">#</th>
                                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">ROL</th>
                                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">FECHA REG.
                                </th>
                                <th class="text-left font-weight-bold text-uppercase" style="min-width: 300px;">PERMISOS
                                </th>
                                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">ACCIONES
                                </th>
                            </tr>
                        </thead>
                        <tbody v-if="loader.loading">
                            <tr>
                                <td colspan="5" class="text-center pa-6">
                                    <VProgressCircular indeterminate color="primary" size="40" />
                                    <div class="mt-2 text-medium-emphasis">Cargando registros...</div>
                                </td>
                            </tr>
                        </tbody>
                        <tbody v-else-if="!list_roles || list_roles.length === 0">
                            <tr>
                                <td colspan="5" class="text-center pa-8 text-medium-emphasis">
                                    <VIcon size="48" class="mb-3" color="grey-lighten-1">ri-folder-info-line</VIcon>
                                    <div class="text-h6">No hay roles registrados</div>
                                    <div class="text-body-2">Intenta ajustar los filtros de búsqueda</div>
                                </td>
                            </tr>
                        </tbody>
                        <tbody v-else>
                            <tr v-for="item in list_roles" :key="item.id" class="roles-row align-middle">
                                <td class="text-center py-3">
                                    <span class="font-weight-bold text-subtitle-1 text-primary">{{ item.id }}</span>
                                </td>
                                <td class="text-left py-3">
                                    <div class="d-flex align-center gap-3">
                                        <VAvatar :color="getRoleColor(item.name)" variant="tonal" size="36">
                                            <VIcon :icon="getRoleIcon(item.name)" size="20" />
                                        </VAvatar>
                                        <span
                                            class="font-weight-semibold text-body-1 text-grey-darken-4 text-capitalize">
                                            {{ item.name }}
                                        </span>
                                    </div>
                                </td>
                                <td class="text-no-wrap text-left py-3">
                                    <div class="d-flex align-center">
                                        <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                                        <span class="text-body-2 text-medium-emphasis">
                                            {{ new Date(item.created_at).toLocaleDateString('es-EC', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit'
                                            }) }}
                                        </span>
                                    </div>
                                </td>
                                <td class="text-left py-3">
                                    <div class="d-flex flex-wrap gap-2">
                                        <VChip v-for="(permission, index) in item.permissions_pluck" :key="index"
                                            :color="permissionColor(typeof permission === 'object' ? permission.name : permission)"
                                            variant="flat" size="small"
                                            class="text-capitalize elevation-1 font-weight-medium">
                                            {{ (typeof permission === 'object' ? permission.name :
                                                permission).replace('_', ' ') }}
                                        </VChip>
                                    </div>
                                </td>
                                <td class="text-no-wrap text-center py-3">
                                    <div class="d-flex justify-center align-center">
                                        <VBtn v-if="item.id !== 1" class="action-btn" variant="text" icon size="small"
                                            color="primary" title="Editar Rol" @click="editItem(item)">
                                            <VIcon icon="ri-pencil-line" size="20" />
                                        </VBtn>
                                        <VBtn v-if="item.id !== 1" class="action-btn" variant="text" icon size="small"
                                            color="error" title="Eliminar Rol" @click="deleteItem(item)">
                                            <VIcon icon="ri-delete-bin-line" size="20" />
                                        </VBtn>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </VTable>
                </div>
            </div>

            <VDivider />

            <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
                <div class="d-flex flex-column align-center gap-3 w-100">
                    <div class="text-caption text-grey-darken-1">
                        Mostrando <span class="font-weight-bold">{{ list_roles.length }}</span> registros
                    </div>
                </div>
            </VCardActions>
        </VCard>

        <RoleAddDialog v-model:isDialogVisible="isRoleAddDialogVisible" @addRole="addNewRole"></RoleAddDialog>
        <RoleEditDialog v-if="role_selected_edit && isRoleEditDialogVisible"
            v-model:isDialogVisible="isRoleEditDialogVisible" @editRole="addEditRole"
            :roleSelected="role_selected_edit">
        </RoleEditDialog>
        <RoleDeleteDialog v-if="role_selected_delete && isRoleDeleteDialogVisible"
            v-model:isDialogVisible="isRoleDeleteDialogVisible" @deleteRole="addDeleteRole"
            :roleSelected="role_selected_delete">
        </RoleDeleteDialog>
    </div>
</template>

<style scoped>
.border-light {
    border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
    border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de roles */
.roles-table :deep(thead) {
    background-color: #f8fafc !important;
}

.roles-table :deep(thead th) {
    color: #475569 !important;
    font-weight: 700 !important;
    font-size: 0.72rem !important;
    letter-spacing: 0.6px;
    border-bottom: 1px solid #e2e8f0 !important;
    height: 48px !important;
}

.roles-row {
    height: 52px;
    transition: background-color 0.2s ease;
}

.roles-row:hover {
    background-color: #f8fafc !important;
}

.action-btn {
    transition: all 0.2s ease;
    border-radius: 6px !important;
}

.action-btn:hover {
    background-color: rgba(0, 0, 0, 0.04) !important;
}
</style>
