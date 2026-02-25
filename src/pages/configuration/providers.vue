<script setup>
import ProviderAddDialog from '@/components/inventory/config/providers/ProviderAddDialog.vue';
import ProviderEditDialog from '@/components/inventory/config/providers/ProviderEditDialog.vue';
import ProviderDeleteDialog from '@/components/inventory/config/providers/ProviderDeleteDialog.vue';
import { useGlobalToast } from '@/composables/useGlobalToast';

const headers = [

    {
        title: "Proveedor",
        key: "name",
    },
    {
        title: "RUC",
        key: "ruc",
    },
    {
        title: "Dirección",
        key: "address",
    },
    {
        title: "Fecha de registro",
        key: "created_at",
    },
    {
        title: "Acción",
        key: "action",
    },
];

const isProviderAddDialogVisible = ref(false);
const isProviderEditDialogVisible = ref(false);
const isProviderDeleteDialogVisible = ref(false);

const list_providers = ref([]);
const searchQuery = ref(null);
const provider_selected_edit = ref(null);
const provider_selected_delete = ref(null);

const isLoading = ref(false);

const { showNotification } = useGlobalToast();

const list = async () => {
    isLoading.value = true;
    try {
        const resp = await $api(
            "suppliers?search=" + (searchQuery.value ? searchQuery.value : ""),
            {
                method: "GET",
                onResponseError({ response }) {
                    console.log(response._data.error);
                    showNotification('Error al cargar los proveedores', 'error');
                },
            },
        );
        console.log(resp);
        list_providers.value = resp.suppliers || [];
        showNotification('Lista de proveedores cargada correctamente', 'success');
    } catch (error) {
        console.log(error);
        showNotification('Error al cargar la lista de proveedores', 'error');
    } finally {
        isLoading.value = false;
    }
};

const addNewProvider = (newProvider) => {
    console.log(newProvider);
    let backup = list_providers.value;
    list_providers.value = [];
    
    // Asegurar que los datos se guarden en mayúsculas
    const providerToSave = {
        ...newProvider,
        name: newProvider.name ? newProvider.name.toUpperCase() : '',
        address: newProvider.address ? newProvider.address.toUpperCase() : ''
    };
    
    backup.unshift(providerToSave);
    setTimeout(() => {
        list_providers.value = backup;
    }, 50);
    showNotification('Proveedor agregado correctamente', 'success');
};

const addEditProvider = (editProvider) => {
    console.log(editProvider);
    let backup = list_providers.value;
    list_providers.value = [];
    let INDEX = backup.findIndex((provider) => provider.id == editProvider.id);
    if (INDEX != -1) {
        // Asegurar que los datos se guarden en mayúsculas
        backup[INDEX] = {
            ...editProvider,
            name: editProvider.name ? editProvider.name.toUpperCase() : '',
            address: editProvider.address ? editProvider.address.toUpperCase() : ''
        };
    }
    setTimeout(() => {
        list_providers.value = backup;
    }, 50);
    showNotification('Proveedor actualizado correctamente', 'success');
};

const addDeleteProvider = (deletedProvider) => {
    console.log('Proveedor eliminado:', deletedProvider)

    if (!deletedProvider || !deletedProvider.id) {
        console.error('Proveedor eliminado no válido:', deletedProvider)
        showNotification('Error: datos del proveedor no válidos', 'error')
        return
    }

    let backup = list_providers.value
    list_providers.value = []
    let INDEX = backup.findIndex((provider) => provider.id == deletedProvider.id)

    if (INDEX !== -1) {
        backup.splice(INDEX, 1)
        console.log('Proveedor eliminado de la lista en índice:', INDEX)
    } else {
        console.warn('No se encontró el proveedor en la lista local')
        // Si no se encuentra en la lista, recargar desde el servidor
        list()
        return
    }

    setTimeout(() => {
        list_providers.value = backup
        showNotification('Proveedor eliminado correctamente', 'success')
    }, 50)
};

const editItem = (item) => {
    console.log(item);
    isProviderEditDialogVisible.value = true;
    provider_selected_edit.value = item;
};

const deleteItem = (item) => {
    isProviderDeleteDialogVisible.value = true;
    provider_selected_delete.value = item;
};

onMounted(() => {
    list();
});

definePage({ meta: { permission: "settings" } });
</script>
<template>
    <div class="pa-4">
        <VCard elevation="4" rounded="lg">
            <!-- HEADER -->
            <VCardTitle class="d-flex align-center gap-2">
                <VIcon icon="ri-truck-line" color="primary" />
                <span class="text-h6 font-weight-bold">Proveedores</span>
            </VCardTitle>

            <!-- OVERLAY -->
            <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
                <VProgressCircular indeterminate size="42" width="4" color="primary" />
            </VOverlay>

            <VDivider />

            <!-- TOOLBAR -->
            <VCardText>
                <VRow align="center">
                    <VCol cols="12" md="4">
                        <VTextField placeholder="Buscar proveedores..." density="compact" variant="outlined"
                            prepend-inner-icon="ri-search-line" v-model="searchQuery" @keyup.enter="list" clearable />
                    </VCol>

                    <VCol cols="12" md="8">
                        <div class="d-flex justify-end">
                            <VBtn color="primary" variant="flat"
                                @click="isProviderAddDialogVisible = !isProviderAddDialogVisible">
                                <VIcon start icon="ri-add-line" />
                                Nuevo proveedor
                            </VBtn>
                        </div>
                    </VCol>
                </VRow>
            </VCardText>

            <!-- TABLE -->
            <VDataTable :headers="headers" :items="list_providers" :items-per-page="10" class="text-no-wrap">
                <!-- Nombre -->
                <template #item.name="{ item }">
                    <div class="d-flex align-center">
                        <VAvatar size="32" color="primary" variant="tonal">
                            <VIcon icon="ri-building-line" />
                        </VAvatar>

                        <div class="d-flex flex-column ms-3">
                            <span class="font-weight-medium text-high-emphasis" style="text-transform: uppercase">
                                {{ item.name }}
                            </span>
                            <span class="text-caption text-medium-emphasis">
                                ID: PROV-00{{ item.id }}
                            </span>
                        </div>
                    </div>
                </template>
                <!-- RUC -->
                <template #item.ruc="{ item }">
                    {{ item.ruc || 'Sin RUC' }}
                </template>

                <!-- Dirección -->
                <template #item.address="{ item }">
                    <VTooltip>
                        <template #activator="{ props }">
                            <div class="d-flex align-center" v-bind="props" style="text-transform: uppercase">
                                <VIcon icon="ri-map-pin-line" size="16" class="me-2" />
                                <span class="text-body-2" style="text-transform: uppercase">
                                    {{ item.address ? (item.address.length > 20 ? item.address.substring(0, 25) + '...'
                                        : item.address) : 'Sin dirección' }}
                                </span>
                            </div>
                        </template>
                        <span style="text-transform: uppercase">{{ item.address || 'Sin dirección' }}</span>
                    </VTooltip>
                </template>

                <!-- Fecha -->
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

                <!-- Acciones -->
                <template #item.action="{ item }">
                    <div class="d-flex gap-1">
                        <IconBtn size="small" color="primary" @click="editItem(item)">
                            <VIcon icon="ri-pencil-line" />
                        </IconBtn>
                        <IconBtn size="small" color="error" @click="deleteItem(item)">
                            <VIcon icon="ri-delete-bin-line" />
                        </IconBtn>
                    </div>
                </template>

                <!-- No data -->
                <template #no-data>
                    <div class="text-center text-medium-emphasis py-6">
                        <VIcon icon="ri-truck-line" size="36" class="mb-2" />
                        <div>No hay proveedores disponibles</div>
                    </div>
                </template>
            </VDataTable>
        </VCard>
    </div>

    <!-- DIALOGS -->
    <ProviderAddDialog v-model:isDialogVisible="isProviderAddDialogVisible" :providers="list_providers"
        @addProvider="addNewProvider" />

    <ProviderEditDialog v-if="provider_selected_edit && isProviderEditDialogVisible"
        v-model:isDialogVisible="isProviderEditDialogVisible" :providerSelected="provider_selected_edit"
        @editProvider="addEditProvider" />

    <ProviderDeleteDialog v-if="provider_selected_delete && isProviderDeleteDialogVisible"
        v-model:isDialogVisible="isProviderDeleteDialogVisible" :providerSelected="provider_selected_delete"
        @deleteProvider="addDeleteProvider" />
</template>
