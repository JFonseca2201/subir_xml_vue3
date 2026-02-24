<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'
import WarehouseAddDialog from '@/components/inventory/config/warehouses/WarehouseAddDialog.vue'
import WarehouseEditDialog from '@/components/inventory/config/warehouses/WarehouseEditDialog.vue'
import WarehouseDeleteDialog from '@/components/inventory/config/warehouses/WarehouseDeleteDialog.vue'
import NotificationToast from '@/components/common/NotificationToast.vue'

const warehouseSelected = ref(null)

// Notificaciones
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message
    notificationType.value = type
    notificationShow.value = true
}

const list_warehouses = ref([])
const search = ref(null)
const isLoading = ref(false)

const isWarehouseAddDialogVisible = ref(false)
const isWarehouseShowDialogVisible = ref(false)
const isWarehouseEditDialogVisible = ref(false)
const isWarehouseDeleteDialogVisible = ref(false)

const list = async () => {
    isLoading.value = true

    try {
        const resp = await $api("warehouses?search=" + (search.value ? search.value : ""), {
            method: "GET",
            onResponseError({ response }) {
                console.log(response._data.error)
            },
        })
        list_warehouses.value = resp.warehouses;
        console.log(list_warehouses.value);
        // Manejar diferentes estructuras de respuesta
        if (resp.warehouses) {
            list_warehouses.value = resp.warehouses
        } else {
            list_warehouses.value = []
        }

        showNotification('Lista de almacenes cargada correctamente', 'success')
    } catch (error) {
        console.error(error)
        showNotification('Error al cargar la lista de almacenes', 'error')
    } finally {
        isLoading.value = false
    }
}

const showItem = (showWarehouse) => {
    console.log(showWarehouse)
    isWarehouseShowDialogVisible.value = true
    warehouseSelected.value = showWarehouse
}

const editWarehouse = (editWarehouse) => {
    console.log(editWarehouse)
    isWarehouseEditDialogVisible.value = true
    warehouseSelected.value = editWarehouse
}

const deleteWarehouse = (DeleteWarehouse) => {
    warehouseSelected.value = DeleteWarehouse
    isWarehouseDeleteDialogVisible.value = true
    console.log(DeleteWarehouse)
}

const confirmDeleteWarehouse = async (warehouse) => {
    console.log(warehouse);
    let backup = list_warehouses.value;
    list_warehouses.value = [];
    let INDEX = backup.findIndex((wh) => wh.id == warehouse.id);
    if (INDEX != -1) {
        backup.splice(INDEX, 1);
    }
    setTimeout(() => {
        list_warehouses.value = backup;
    }, 50);
};


const addWarehouse = (newWarehouse) => {
    console.log('Almacén:', newWarehouse);
    list_warehouses.value.unshift(newWarehouse);
    showNotification('Almacén agregado correctamente a la tabla', 'success');
}

const updateWarehouse = (updatedWarehouse) => {
    console.log('Actualizando almacén:', updatedWarehouse)
    const index = list_warehouses.value.findIndex(warehouse => warehouse.id === updatedWarehouse.id)

    if (index !== -1) {
        list_warehouses.value[index] = updatedWarehouse
        showNotification('Almacén actualizado correctamente en la tabla', 'success')
    } else {
        console.warn('Almacén no encontrado en la lista, recargando...')
        list()
    }
}

const refresh = () => {
    search.value = null
    list()
}

const formatDate = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    return isNaN(d) ? '-' : d.toISOString().slice(0, 10)
}

onMounted(() => {
    list()
})
</script>

<template>
    <div class="pa-6">
        <!-- Overlay global -->
        <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
            <VProgressCircular indeterminate size="56" width="5" color="primary" />
        </VOverlay>

        <!-- CARD MAESTRA -->
        <VCard class="elevation-4 rounded-xl">

            <!-- HEADER -->
            <VCardText>
                <VRow class="align-center justify-space-between">
                    <VCol cols="12" md="8">
                        <div class="d-flex align-center gap-3">
                            <VIcon size="40" color="primary">ri-store-2-line</VIcon>
                            <div>
                                <h2 class="text-h4 font-weight-bold mb-1">
                                    Gestión de Almacenes
                                </h2>
                                <span class="text-medium-emphasis">
                                    Administración y control de almacenes
                                </span>
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="4" class="d-flex justify-end align-center">
                        <VBtn color="primary" size="large" elevation="5"
                            @click="isWarehouseAddDialogVisible = !isWarehouseAddDialogVisible">
                            <VIcon start>ri-add-circle-line</VIcon>
                            Nuevo Almacén
                        </VBtn>
                    </VCol>
                </VRow>
            </VCardText>

            <VDivider />

            <!-- FILTROS Y BOTÓN FILTRAR -->
            <VCardText>

                <div class="d-flex align-center gap-2 mb-4">
                    <VIcon color="primary">ri-filter-3-line</VIcon>
                    <span class="text-h6 font-weight-bold">
                        Filtros de búsqueda
                    </span>
                </div>

                <!-- Filtros de búsqueda alineados con el botón Filtrar -->
                <VRow dense>
                    <VCol cols="12" md="6">
                        <VTextField v-model="search" @keyup.enter="list" label="Buscar almacén" variant="outlined"
                            density="comfortable" clearable prepend-inner-icon="ri-search-line" />
                    </VCol>

                    <!-- Botón Filtrar alineado con los filtros -->
                    <VCol cols="12" md="6" class="d-flex align-end justify-end gap-4">
                        <VBtn color="primary" size="large" rounded="" @click="list" variant="tonal">
                            <VIcon start>ri-search-line</VIcon>
                            Buscar
                        </VBtn>
                        <VBtn color="secondary" size="large" rounded="" @click="refresh" variant="tonal">
                            <VIcon start>ri-refresh-line</VIcon>
                            Refrescar
                        </VBtn>
                    </VCol>
                </VRow>
            </VCardText>

            <VDivider />

            <!-- TABLA -->
            <VCardText class="pa-0">
                <VTable hover class="text-no-wrap">
                    <thead class="bg-primary text-white">
                        <tr>
                            <th>#</th>
                            <th>Nombre</th>
                            <th>Dirección</th>
                            <th>Estado</th>
                            <th>Fecha registro</th>
                            <th class="text-center">Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="warehouse in (list_warehouses || [])" :key="warehouse"
                            class="hover:bg-grey-lighten-4 transition">
                            <td class="font-weight-medium">{{ warehouse?.id }}</td>
                            <td class="uppercase">{{ warehouse?.name }}</td>
                            <td class="uppercase">{{ warehouse?.address }}</td>
                            <td>
                                <VChip :color="Number(warehouse?.state) === 0 ? 'success' : 'error'" variant="tonal"
                                    size="small">
                                    {{ Number(warehouse?.state) === 0 ? 'Activo' : 'Inactivo' }}
                                </VChip>
                            </td>
                            <td>{{ formatDate(warehouse?.created_at) }}</td>

                            <td class="text-center">
                                <div class="d-flex justify-center gap-1">
                                    <IconBtn @click="showItem(warehouse)">
                                        <VIcon icon="ri-eye-line" />
                                    </IconBtn>
                                    <IconBtn @click="editWarehouse(warehouse)">
                                        <VIcon icon="ri-pencil-line" />
                                    </IconBtn>
                                    <IconBtn @click="deleteWarehouse(warehouse)">
                                        <VIcon icon="ri-delete-bin-6-line" color="error" />
                                    </IconBtn>
                                </div>
                            </td>
                        </tr>

                        <tr v-if="!list_warehouses || !list_warehouses.length">
                            <td colspan="6" class="text-center text-medium-emphasis py-6">
                                <VIcon size="32" class="mb-2">ri-inbox-line</VIcon>
                                <div>No hay almacenes registrados</div>
                            </td>
                        </tr>
                    </tbody>
                </VTable>
            </VCardText>
        </VCard>

        <!-- DIALOG -->
        <WarehouseAddDialog v-model:isDialogVisible="isWarehouseAddDialogVisible" @addWarehouse="addWarehouse" />
        <WarehouseEditDialog v-if="isWarehouseEditDialogVisible && warehouseSelected"
            v-model:isDialogVisible="isWarehouseEditDialogVisible" :warehouseSelected="warehouseSelected"
            @updateWarehouse="updateWarehouse" />
        <WarehouseDeleteDialog v-if="isWarehouseDeleteDialogVisible && warehouseSelected"
            v-model:isDialogVisible="isWarehouseDeleteDialogVisible" :warehouseSelected="warehouseSelected"
            @deleteWarehouse="confirmDeleteWarehouse" /> <!-- Notificación Toast -->
        <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />

    </div>
</template>
