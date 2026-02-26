<script setup>
import { onUnmounted, ref, watch, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import UnitDeleteConversionDialog from './UnitDeleteConversionDialog.vue'

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    unitSelected: {
        type: Object,
        required: true,
    },
    units: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits(["update:isDialogVisible", "addConversion", "deleteConversion"]);
const unit_to_id = ref(null);
const warning = ref(null);
const error_exits = ref(null);
const success = ref(null);
const list_units = ref([]);
const list_units_conversions = ref([]);

// Variables para diálogo de eliminación
const isDeleteDialogVisible = ref(false);
const conversionToDelete = ref(null);

const store = async () => {
    warning.value = null;
    error_exits.value = null;
    success.value = null;
    loader.start();


    let data = {
        unit_id: props.unitSelected.id,
        unit_to_id: unit_to_id.value,
    };

    console.log('Data a enviar:', data);

    try {
        const resp = await $api("unit-conversions", {
            method: "POST",
            body: data,
            onResponseError({ response }) {
                console.log('Error completo:', response._data);
                console.log('Errors específicos:', response._data.errors);
                error_exits.value = response._data.error || response._data.message || 'Error al registrar conversión';
                
                // Mostrar mensaje específico del API en el toast
                if (response._data.message) {
                    showNotification(response._data.message, 'error');
                } else if (response._data.error) {
                    showNotification(response._data.error, 'error');
                } else {
                    showNotification('Error al registrar conversión', 'error');
                }
            },
        });
        console.log(resp);
        if (resp.message == 403 || resp.status == 403) {
            error_exits.value = resp.message_text || resp.message || 'Error de permisos';
            showNotification(resp.message_text || resp.message || 'Error de permisos', 'error');
        } else {
            success.value = "La conversión de unidad se ha registrado correctamente";
            showNotification('La conversión de unidad se ha registrado correctamente', 'success');
            emit("addConversion", resp.unit_conversion);
            list_units_conversions.value.unshift(resp.unit_conversion);
            unit_to_id.value = null;
            warning.value = null;
            error_exits.value = null;
            success.value = null;
        }
    } catch (error) {
        console.log(error);
        showNotification('Error al registrar unidad', 'error');
        loader.stop();
    } finally {
        loader.stop();
    }
};

const deleteConversion = async (conversionId) => {
    loader.start();
    try {
        await $api(`unit-conversions/${conversionId}`, {
            method: "DELETE"
        });
        
        // Eliminar de la lista local
        list_units_conversions.value = list_units_conversions.value.filter(conv => conv.id !== conversionId);
        
        showNotification('Conversión eliminada correctamente', 'success');
        emit("deleteConversion", conversionId);
    } catch (error) {
        console.error('Error al eliminar conversión:', error);
        showNotification('Error al eliminar conversión', 'error');
    } finally {
        loader.stop();
    }
};

const openDeleteDialog = (conversion) => {
    conversionToDelete.value = conversion;
    isDeleteDialogVisible.value = true;
};

const handleDeleteConversion = (deletedConversion) => {
    // Eliminar de la lista local
    list_units_conversions.value = list_units_conversions.value.filter(conv => conv.id !== deletedConversion.id);
    emit("deleteConversion", deletedConversion.id);
};

const onFormReset = () => {
    unit_to_id.value = null;
    warning.value = null;
    error_exits.value = null;
    success.value = null;
    emit("update:isDialogVisible", false);
};

const dialogVisibleUpdate = (val) => {
    emit("update:isDialogVisible", val);
};

// Cargar unidades desde props cuando el componente se monta
const loadUnits = () => {
    list_units.value = props.units || [];
    console.log('Unidades cargadas:', list_units.value);
};

// Cargar unidades inmediatamente
loadUnits();

// Watch para actualizar las unidades cuando cambien los props
watch(() => props.units, (newUnits) => {
    list_units.value = newUnits || [];
    console.log('Unidades actualizadas:', list_units.value);
}, { immediate: true });

// Cargar conversiones existentes de la unidad seleccionada
const loadExistingConversions = async () => {
    if (!props.unitSelected?.id) return;
    
    try {
        // Intentar diferentes endpoints posibles
        let resp;
        try {
            // Opción 1: endpoint específico por unidad
            resp = await $api(`unit-conversions?unit_id=${props.unitSelected.id}`);
        } catch (error1) {
            console.log('Endpoint 1 falló, intentando endpoint 2...');
            try {
                // Opción 2: endpoint general y filtrar localmente
                resp = await $api('unit-conversions');
                // Filtrar conversiones donde la unidad sea la seleccionada
                if (resp.unit_conversions) {
                    resp.unit_conversions = resp.unit_conversions.filter(conv => 
                        conv.unit_id === props.unitSelected.id || 
                        conv.unit?.id === props.unitSelected.id
                    );
                }
            } catch (error2) {
                console.log('Endpoint 2 falló, intentando endpoint 3...');
                try {
                    // Opción 3: endpoint con diferentes parámetros
                    resp = await $api(`unit-conversions?from_unit_id=${props.unitSelected.id}`);
                } catch (error3) {
                    console.log('Todos los endpoints fallaron, usando array vacío');
                    resp = { unit_conversions: [] };
                }
            }
        }
        
        list_units_conversions.value = resp.unit_conversions || [];
        console.log('Conversiones cargadas:', list_units_conversions.value);
    } catch (error) {
        console.error('Error al cargar conversiones:', error);
        list_units_conversions.value = [];
    }
};

// Watch para cargar conversiones cuando cambia la unidad seleccionada
watch(() => props.unitSelected, (newUnit) => {
    if (newUnit) {
        loadExistingConversions();
    }
}, { immediate: true });

// Computed para filtrar unidades (excluir la unidad actual)
const filteredUnits = computed(() => {
    if (!props.unitSelected || !list_units.value) return [];
    return list_units.value.filter(unit => unit.id !== props.unitSelected.id);
});

// Función helper para truncar texto
const truncateText = (text, maxLength = 25) => {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};
</script>

<template>
    <VDialog max-width="700" :model-value="props.isDialogVisible" @update:model-value="dialogVisibleUpdate" persistent>
        <VCard class="pa-sm-10 pa-5">
            <!-- 👉 Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="onFormReset" />

            <!-- 👉 Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-ruler-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Nueva Conversión</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Agrega una nueva conversión de unidad
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- 👉 Form -->
            <VForm @submit.prevent="store">
                <VRow dense>
                    <!-- UNITS TO -->
                    <VCol cols="10">
                        <VSelect v-model="unit_to_id" :items="filteredUnits" item-title="name" item-value="id"
                            label="Unidad de medida" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-ruler-line" hide-details="auto" required
                            placeholder="Selecciona una unidad para convertir" />

                        <div v-if="props.unitSelected" class="mt-2 text-caption text-medium-emphasis">
                            <strong>Unidad actual:</strong> {{ props.unitSelected.name }}
                        </div>
                    </VCol>
                    <VCol cols="2">
                        <VBtn type="submit" color="primary" prepend-icon="ri-add-line" :loading="loader.loading"
                            :disabled="loader.loading">

                        </VBtn>
                    </VCol>
                    <!-- Alertas -->
                    <VCol cols="12" v-if="warning">
                        <VAlert color="warning" variant="tonal" closable>
                            {{ warning }}
                        </VAlert>
                    </VCol>

                    <VCol cols="12" v-if="error_exits">
                        <VAlert color="error" variant="tonal" closable>
                            {{ error_exits }}
                        </VAlert>
                    </VCol>

                    <VCol cols="12" v-if="success">
                        <VAlert color="success" variant="tonal" closable>
                            {{ success }}
                        </VAlert>
                    </VCol>

                    <VDivider class="my-6" />
                    <VCol cols="12">

                        <VCol cols="12">
                            <VTable class="table" v-if="list_units_conversions.length > 0">
                                <thead>
                                    <tr>
                                        <th>De Unidad</th>
                                        <th>A Unidad</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="item in list_units_conversions" :key="item.id">
                                        <td>{{ truncateText(props.unitSelected.name) }}</td>
                                        <td>{{ truncateText(item.unit_to?.name || item.unit?.name) }}</td>
                                        <td>
                                            <VBtn icon variant="text" color="error" size="small" @click="openDeleteDialog(item)">
                                                <VIcon icon="ri-delete-bin-line" />
                                            </VBtn>
                                        </td>
                                    </tr>
                                </tbody>
                            </VTable>
                            <div v-else class="text-center text-medium-emphasis pa-4">
                                <VIcon icon="ri-information-line" size="32" class="mb-2" />
                                <p>No hay conversiones registradas para esta unidad</p>
                            </div>
                        </VCol>

                    </VCol>



                    <!-- 👉 Actions -->
                    <VCol cols="12" class="d-flex justify-center gap-4">


                        <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" @click="onFormReset"
                            :disabled="loader.loading">
                            Cancelar
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>
        </VCard>
    </VDialog>

    <!-- Diálogo de eliminación -->
    <UnitDeleteConversionDialog 
        v-if="conversionToDelete && isDeleteDialogVisible"
        v-model:isDialogVisible="isDeleteDialogVisible" 
        :conversionToDelete="conversionToDelete"
        @deleteConversion="handleDeleteConversion" 
    />
</template>
