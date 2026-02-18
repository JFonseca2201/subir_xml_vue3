<script setup>
import { useLoaderStore } from '@/stores/loader'
const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
})

const emit = defineEmits([
    'update:isDialogVisible',
    'addRole'
]);

const loader = useLoaderStore();
const name = ref(null);
const permissions = ref([]);
const warning = ref(null);
const error_exist = ref(null);
const success = ref(null);

// Notificaciones
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

const AddEditPermissionDialog = (permission) => {
    let INDEX = permissions.value.findIndex((perm) => perm == permission);
    if (INDEX != -1) {
        permissions.value.splice(INDEX, 1);
    } else {
        permissions.value.push(permission);
    }
    console.log(permissions);
}


const store = async () => {
    loader.start();
    warning.value = null;
    error_exist.value = null;
    success.value = null;

    if (!name.value) {
        setTimeout(() => {
            warning.value = "Se debe ingresar un nombre de rol";
        }, 50);
        loader.stop();
        return;
    }
    if (permissions.value.length == 0) {
        setTimeout(() => {
            warning.value = "Seleccione uno o más permisos.";
        }, 50);
        loader.stop();
        return;
    }

    let data = {
        name: name.value,
        permissions: permissions.value
    }

    try {
        const resp = await $api("role", {
            method: 'POST',
            body: data,
            onResponseError({ response }) {
                error_exist.value = response._data.errors.name[0];
            }
        });
        console.log(resp);
        showNotification(resp.message || 'Rol creado con éxito', 'success');
        emit("addRole", resp.data);

        // Cerrar el diálogo después de un breve delay para mostrar el mensaje de éxito
        setTimeout(() => {
            onFormReset();
        }, 1500);

    } catch (error) {
        console.log(error);
        showNotification('Error al crear el rol', 'error');
    } finally {
        loader.stop();
    }
}




const onFormSubmit = () => {
    emit('update:isDialogVisible', false)
}

const onFormReset = () => {
    name.value = null;
    permissions.value = [];
    warning.value = null;
    error_exist.value = null;
    success.value = null;

    emit('update:isDialogVisible', false)
}

const dialogVisibleUpdate = val => {
    emit('update:isDialogVisible', val)
}

onMounted(() => {
    loader.stop();
    warning.value = null;
    error_exist.value = null;
    success.value = null;
});

</script>

<template>
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 720" :model-value="props.isDialogVisible"
        @update:model-value="dialogVisibleUpdate" transition="dialog-bottom-transition">
        <VCard class="pa-6 pa-sm-10 rounded-xl elevation-10">

            <!-- Close -->
            <DialogCloseBtn variant="text" size="small" class="position-absolute top-0 end-0 ma-4"
                @click="onFormReset" />

            <!-- Header -->
            <div class="text-center mb-8">
                <VIcon icon="ri-shield-user-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Crear nuevo rol
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Define permisos y accesos para el sistema
                </p>
            </div>

            <!-- Form -->
            <VForm @submit.prevent="store()">
                <VRow>
                    <!-- Nombre -->
                    <VCol cols="12">
                        <VTextField v-model="name" label="Nombre del rol" placeholder="Ej. Administrador"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-user-settings-line"
                            hide-details />
                    </VCol>
                    <!-- Roles y permisos -->
                    <VCol cols="12">
                        <VTable class="elevation-0 permissions-table">

                            <thead>
                                <tr>
                                    <th class="px-6 py-4 text-body-2 text-medium-emphasis">
                                        Módulo
                                    </th>
                                    <th class="px-6 py-4 text-body-2 text-medium-emphasis">
                                        Acciones permitidas
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                <tr v-for="(item, index) in PERMISOS" :key="index" class="permissions-row">
                                    <!-- MÓDULO -->
                                    <td class="px-6 py-6 align-top module-cell">
                                        <div class="module-name">
                                            {{ item.name }}
                                        </div>
                                        <div class="module-subtitle">
                                            Gestión del módulo
                                        </div>
                                    </td>

                                    <!-- PERMISOS -->
                                    <td class="px-6 py-6">
                                        <div class="permissions-wrap">
                                            <label v-for="(permiso, index2) in item.permisos" :key="index2"
                                                class="permission-chip">
                                                <VCheckbox :value="permiso.permiso" hide-details density="compact"
                                                    @click="AddEditPermissionDialog(permiso.permiso)" />
                                                <span>{{ permiso.name }}</span>
                                            </label>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>

                        </VTable>
                    </VCol>

                    <VCol cols="12" v-if="warning">
                        <VAlert color="warning" variant="tonal" closable> {{ warning }}</VAlert>
                    </VCol>

                    <!-- Actions -->
                    <VCol cols="12" class="d-flex justify-end gap-3 mt-4">
                        <VBtn variant="outlined" color="secondary" class="text-none px-6" @click="onFormReset">
                            <VIcon start icon="ri-close-line" />
                            Cancelar
                        </VBtn>

                        <VBtn type="submit" color="primary" variant="elevated" class="text-none px-6"
                            :loading="loader.loading" :disabled="loader.loading">
                            <VIcon start icon="ri-save-3-line" />
                            Guardar rol
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>

        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
<style>
.permissions-table {
    border-radius: 12px;
    overflow: hidden;
}

.permissions-row {
    border-bottom: 1px solid rgba(150, 11, 11, 0.06);
}

.permissions-row:last-child {
    border-bottom: none;
}

.module-cell {
    width: 260px;
}

.module-name {
    font-weight: 600;
    font-size: 1rem;
}

.module-subtitle {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.55);
    margin-top: 4px;
}

.permissions-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 14px;
}

.permission-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    background-color: rgba(0, 0, 0, 0.03);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.permission-chip:hover {
    background-color: rgba(0, 0, 0, 0.07);
}
</style>