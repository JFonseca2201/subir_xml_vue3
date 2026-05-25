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
    <div>
        <VCard elevation="8" class="pa-6 rounded-xl border-thin">
            <!-- Título -->
            <VRow class="mb-4">
                <VCol>
                    <div class="d-flex align-center gap-3">
                        <VAvatar color="primary" variant="tonal" rounded size="48">
                            <VIcon icon="ri-shield-keyhole-line" size="28" />
                        </VAvatar>
                        <div>
                            <h4 class="text-h5 font-weight-bold mb-1">
                                Roles y permisos
                            </h4>
                            <span class="text-body-2 text-medium-emphasis">
                                Administración de accesos del sistema
                            </span>
                        </div>
                    </div>
                </VCol>
            </VRow>

            <!-- Acciones -->
            <VRow align="center" justify="space-between" class="mb-6">
                <VCol cols="12" md="5">
                    <VTextField label="Buscar rol" placeholder="Ej: Administrador, Cajero..." prepend-inner-icon="ri-search-line"
                        clearable density="comfortable" variant="outlined" hide-details @keyup.enter="list"
                        v-model="seachQuery" :loading="loader.loading" />
                </VCol>

                <VCol cols="12" md="4" class="d-flex justify-end gap-3">
                    <VBtn color="primary" variant="elevated" size="large" class="text-none px-6"
                        @click="isRoleAddDialogVisible = !isRoleAddDialogVisible">
                        <VIcon start icon="ri-add-line" />
                        Nuevo rol
                    </VBtn>
                </VCol>
            </VRow>

            <VDivider class="mb-4" />

            <!-- Tabla -->
            <VDataTable :headers="headers" :items="list_roles" :items-per-page="10"
                class="text-no-wrap elevation-0" :loading="loader.loading" hover>
                
                <template #item.id="{ item }">
                    <span class="text-primary font-weight-medium">
                        #{{ item.id }}
                    </span>
                </template>

                <template #item.name="{ item }">
                    <div class="d-flex align-center gap-3">
                        <VAvatar :color="getRoleColor(item.name)" variant="tonal" size="36">
                            <VIcon :icon="getRoleIcon(item.name)" size="20" />
                        </VAvatar>
                        <span class="text-subtitle-1 font-weight-medium text-capitalize">
                            {{ item.name }}
                        </span>
                    </div>
                </template>

                <template #item.permissions_pluck="{ item }">
                    <div class="d-flex flex-wrap gap-2 py-2">
                        <VChip v-for="permission in item.permissions_pluck" :key="permission"
                            :color="permissionColor(permission)" variant="flat" size="small" class="text-capitalize elevation-1 font-weight-medium">
                            {{ permission.replace('_', ' ') }}
                        </VChip>
                    </div>
                </template>

                <template #no-data>
                    <div class="text-center text-medium-emphasis py-8">
                        <VAvatar color="grey-lighten-3" size="72" class="mb-4">
                            <VIcon icon="ri-folder-info-line" size="36" color="grey" />
                        </VAvatar>
                        <div class="text-h6">No hay registros disponibles</div>
                        <div class="text-body-2">Intenta buscar con otros términos</div>
                    </div>
                </template>

                <!-- Actions -->
                <template #item.action="{ item }">
                    <div v-if="item.id !== 1" class="d-flex align-center gap-2">
                        <VTooltip text="Editar Rol">
                            <template #activator="{ props }">
                                <IconBtn v-bind="props" size="small" color="primary" variant="tonal"
                                    @click="editItem(item)">
                                    <VIcon icon="ri-pencil-line" />
                                </IconBtn>
                            </template>
                        </VTooltip>

                        <VTooltip text="Eliminar Rol">
                            <template #activator="{ props }">
                                <IconBtn v-bind="props" size="small" color="error" variant="tonal"
                                    @click="deleteItem(item)">
                                    <VIcon icon="ri-delete-bin-line" />
                                </IconBtn>
                            </template>
                        </VTooltip>
                    </div>
                </template>

            </VDataTable>
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
:deep(.v-data-table__tr td) {
    padding-top: 12px !important;
    padding-bottom: 12px !important;
}
</style>
