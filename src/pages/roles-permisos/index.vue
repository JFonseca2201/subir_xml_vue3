<script setup>
import RoleDeleteDialog from '@/components/inventory/role/RoleDeleteDialog.vue';
import { useLoaderStore } from '@/stores/loader'
const loader = useLoaderStore();
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
        title: 'permisos',
        key: 'permissions_pluck',
    },
    {
        title: 'Acción',
        key: 'action',
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

    try {
        const resp = await $api("role?search=" + (seachQuery.value ? seachQuery.value : ''), {
            method: 'GET',
            onResponseError({ response }) {
                console.log(response._data.error);
            }
        });

        list_roles.value = resp.roles;

        console.log(resp);

    } catch (error) {
        console.log(error);

    } finally {

    }
}

const addNewRole = (NewRole) => {
    console.log(NewRole);
    let backup = list_roles.value;
    list_roles.value = [];
    backup.unshift(NewRole);
    setTimeout(() => {
        list_roles.value = backup;
    }, 50);
}

const addEditRole = (EditRole) => {
    console.log(EditRole);
    let backup = list_roles.value;
    list_roles.value = [];
    let INDEX = backup.findIndex((rol) => rol.id == EditRole.id);
    if (INDEX != -1) {
        backup[INDEX] = EditRole;
    }
    setTimeout(() => {
        list_roles.value = backup;
    }, 50);
}

const addDeleteRole = (Role) => {
    console.log(Role);
    let backup = list_roles.value;
    list_roles.value = [];
    let INDEX = backup.findIndex((rol) => rol.id == Role.id);
    if (INDEX != -1) {
        backup.splice[INDEX];
    }
    setTimeout(() => {
        list_roles.value = backup;
    }, 50);

}

const permissionColor = (permission) => {

    if (permission.includes('create')) return 'success'
    if (permission.includes('edit')) return 'warning'
    if (permission.includes('delete')) return 'error'
    if (permission.includes('view') || permission.includes('read')) return 'info'

    return 'primary'
}

const editItem = (item) => {
    console.log(item);
    isRoleEditDialogVisible.value = true;
    role_selected_edit.value = item;

}
const deleteItem = (item) => {
    console.log(item);
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
                        <VIcon icon="ri-shield-user-line" color="primary" size="28" />
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
                    <VTextField label="Buscar rol" placeholder="Ej: Administrador" prepend-inner-icon="ri-search-line"
                        clearable density="comfortable" variant="outlined" hide-details @keyup.enter="list"
                        v-model="seachQuery" />
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
                class="text-no-wrap elevation-1 rounded-lg">
                <template #item.id="{ item }">
                    <span color="primary" variant="tonal" size="small">
                        {{ item.id }}
                    </span>
                </template>

                <template #item.permissions_pluck="{ item }">
                    <div class="d-flex flex-wrap gap-2">
                        <VChip v-for="permission in item.permissions_pluck" :key="permission"
                            :color="permissionColor(permission)" variant="tonal" size="small" class="text-capitalize">
                            {{ permission }}
                        </VChip>
                    </div>
                </template>


                <template #no-data>
                    <div class="text-center text-medium-emphasis py-6">
                        <VIcon icon="ri-database-2-line" size="36" class="mb-2" />
                        <div>No hay registros disponibles</div>
                    </div>
                </template>

                <!-- Actions -->
                <template #item.action="{ item }">
                    <div class="d-flex align-center gap-2">
                        <VTooltip text="Editar">
                            <template #activator="{ props }">
                                <IconBtn v-bind="props" size="small" color="primary" variant="text"
                                    @click="editItem(item)">
                                    <VIcon icon="ri-pencil-line" />
                                </IconBtn>
                            </template>
                        </VTooltip>

                        <VTooltip text="Eliminar">
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
