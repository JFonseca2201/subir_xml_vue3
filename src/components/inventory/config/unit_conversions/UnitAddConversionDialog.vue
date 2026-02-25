<script setup>
import { onUnmounted, ref, watch, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import NotificationToast from '@/components/common/NotificationToast.vue'

const loader = useLoaderStore()

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

const emit = defineEmits(["update:isDialogVisible", "addConversion"]);
const name = ref(null);
const unit_to_id = ref(null);
const warning = ref(null);
const error_exits = ref(null);
const success = ref(null);
const list_units = ref([]);
const list_units_conversions = ref([]);

// Variables para NotificationToast
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

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
                error_exits.value = response._data.error;
            },
        });
        console.log(resp);
        if (resp.message == 403) {
            error_exits.value = resp.message_text;
            showNotification('Error de permisos', 'error');
        } else {
            success.value = "La conversión de unidad se ha registrado correctamente";
            showNotification('La conversión de unidad se a registrado correctamente', 'success');
            //emit("addConversion", resp.unit);
            list_units_conversions.value.unshift(resp.unit_conversion);
            unit_to_id.value = null;
            warning.value = null;
            error_exits.value = null;
            success.value = null;
            //onFormReset();
        }
    } catch (error) {
        console.log(error);
        showNotification('Error al registrar unidad', 'error');
        loader.stop();
    } finally {
        loader.stop();
    }
};

const onFormReset = () => {
    name.value = null;
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

// Computed para filtrar unidades (excluir la unidad actual)
const filteredUnits = computed(() => {
    if (!props.unitSelected || !list_units.value) return [];
    return list_units.value.filter(unit => unit.id !== props.unitSelected.id);
});
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
                                        <th>Unidad</th>
                                        <th>Factor</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="item in list_units_conversions" :key="item.id">
                                        <td>{{ props.unitSelected.name }}</td>
                                        <td>{{ item.unit.name }}</td>
                                        <td>
                                            <VBtn icon variant="text" color="primary" size="small">
                                                <VIcon icon="ri-add-line" />
                                            </VBtn>
                                        </td>
                                    </tr>
                                </tbody>
                            </VTable>
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

    <!-- NotificationToast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
