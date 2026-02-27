<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'
import UnitAddDialog from '@/components/inventory/config/units/UnitAddDialog.vue'
import UnitEditDialog from '@/components/inventory/config/units/UnitEditDialog.vue'
import UnitDeleteDialog from '@/components/inventory/config/units/UnitDeleteDialog.vue'
import UnitAddConversionDialog from '@/components/inventory/config/unit_conversions/UnitAddConversionDialog.vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast();

const headers = [
    {
        title: "Unidad",
        key: "name",
    },
    {
        title: "Descripción",
        key: "description",
    },
    {
        title: "Estado",
        key: "state",
    },
    {
        title: "Fecha de registro",
        key: "created_at",
    },
    {
        title: "Acciones",
        key: "action",
    },
];

const isUnitAddDialogVisible = ref(false);
const isUnitEditDialogVisible = ref(false);
const isUnitDeleteDialogVisible = ref(false);
const isUnitAddConversionDialogVisible = ref(false);

const list_units = ref([]);
const searchQuery = ref(null);
const unit_selected_edit = ref(null);
const unit_selected_delete = ref(null);
const unit_selected_conversion = ref(null);

const isLoading = ref(false); // Loader global para la tabla

const list = async () => {
    isLoading.value = true; // Activar loader
    try {
        const resp = await $api(
            "units?search=" + (searchQuery.value ? searchQuery.value : ""),
            {
                method: "GET",
                onResponseError({ response }) {
                    console.log(response._data.error);
                    showNotification('Error al cargar unidades', 'error');
                },
            },
        );
        console.log(resp);
        list_units.value = resp.units;
        showNotification('Lista de unidades cargada correctamente', 'success');
    } catch (error) {
        console.log(error);
        showNotification('Error al cargar la lista de unidades', 'error');
    } finally {
        isLoading.value = false; // Ocultar overlay
    }
};

const addNewUnit = (NewUnit) => {
    console.log(NewUnit);
    let backup = list_units.value;
    list_units.value = [];
    backup.unshift(NewUnit);
    setTimeout(() => {
        list_units.value = backup;
        showNotification('Unidad agregada correctamente', 'success');
    }, 50);
};

const addEditUnit = (editUnit) => {
    console.log(editUnit);
    let backup = list_units.value;
    list_units.value = [];
    let INDEX = backup.findIndex((unit) => unit.id == editUnit.id);
    if (INDEX != -1) {
        backup[INDEX] = editUnit;
    }
    setTimeout(() => {
        list_units.value = backup;
        showNotification('Unidad actualizada correctamente', 'success');
    }, 50);
};

const addDeleteUnit = (Unit) => {
    console.log(Unit);
    let backup = list_units.value;
    list_units.value = [];
    let INDEX = backup.findIndex((unit) => unit.id == Unit.id);
    if (INDEX != -1) {
        backup.splice(INDEX, 1);
    }
    setTimeout(() => {
        list_units.value = backup;
        showNotification('Unidad eliminada correctamente', 'success');
    }, 50);
};

const editItem = (item) => {
    console.log(item);
    isUnitEditDialogVisible.value = true;
    unit_selected_edit.value = item;
};

const deleteItem = (item) => {
    isUnitDeleteDialogVisible.value = true;
    unit_selected_delete.value = item;
};
const addConversion = (item) => {
    isUnitAddConversionDialogVisible.value = true;
    unit_selected_conversion.value = item;
};

// Función helper para truncar texto
const truncateText = (text, maxLength = 25) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
                <VIcon icon="ri-ruler-line" />
                <span class="text-h6 font-weight-bold">Unidades</span>
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
                        <VTextField placeholder="Buscar unidades..." density="compact" variant="outlined"
                            prepend-inner-icon="ri-search-line" v-model="searchQuery" @keyup.enter="list" clearable />
                    </VCol>

                    <VCol cols="12" md="8">
                        <div class="d-flex justify-end">
                            <VBtn color="primary" variant="flat" @click="
                                isUnitAddDialogVisible = !isUnitAddDialogVisible
                                ">
                                <VIcon start icon="ri-add-line" />
                                Nueva unidad
                            </VBtn>
                        </div>
                    </VCol>
                </VRow>
            </VCardText>

            <!-- TABLE -->
            <VDataTable :headers="headers" :items="list_units" :items-per-page="10" class="text-no-wrap">
                <!-- Nombre -->
                <template #item.name="{ item }">
                    <div class="d-flex align-center">
                        <div class="d-flex flex-column ms-3">
                            <span class="font-weight-medium text-high-emphasis">
                                {{ item.name }}
                            </span>
                        </div>
                    </div>
                </template>
                <!-- DESCRIPTION -->
                <template #item.description="{ item }">
                    <VTooltip>
                        <template #activator="{ props }">
                            <span v-bind="props" class="font-weight-medium text-high-emphasis cursor-pointer">
                                {{ truncateText(item.description) }}
                            </span>
                        </template>
                        <span>{{ item.description || 'Sin descripción' }}</span>
                    </VTooltip>
                </template>

                <!-- Estado -->
                <template #item.state="{ item }">
                    <VChip v-if="item.state == 1" size="small" color="success" variant="tonal">
                        Activo
                    </VChip>
                    <VChip v-if="item.state == 2" size="small" color="error" variant="tonal">
                        Inactivo
                    </VChip>
                </template>

                <!-- Acciones  repository-commits-line-->
                <template #item.action="{ item }">
                    <div class="d-flex gap-1">
                        <IconBtn size="small" color="primary" @click="addConversion(item)">
                            <VIcon icon="ri-git-repository-commits-line" />
                        </IconBtn>
                        <IconBtn size="small" color="primary" @click="editItem(item)">
                            <VIcon icon="ri-pencil-line" />
                        </IconBtn>
                        <IconBtn size="small" color="error" @click="deleteItem(item)">
                            <VIcon icon="ri-delete-bin-line" />
                        </IconBtn>
                    </div>
                </template>
            </VDataTable>
        </VCard>

        <!-- DIALOGS -->
        <UnitAddDialog v-model:isDialogVisible="isUnitAddDialogVisible" @addUnit="addNewUnit" />
        <UnitAddConversionDialog v-if="unit_selected_conversion && isUnitAddConversionDialogVisible"
            v-model:isDialogVisible="isUnitAddConversionDialogVisible" :unitSelected="unit_selected_conversion"
            :units="list_units" />

        <UnitEditDialog v-if="unit_selected_edit && isUnitEditDialogVisible"
            v-model:isDialogVisible="isUnitEditDialogVisible" :unitSelected="unit_selected_edit"
            @editUnit="addEditUnit" />

        <UnitDeleteDialog v-if="unit_selected_delete && isUnitDeleteDialogVisible"
            v-model:isDialogVisible="isUnitDeleteDialogVisible" :unitSelected="unit_selected_delete"
            @deleteUnit="addDeleteUnit" />
    </div>
</template>
