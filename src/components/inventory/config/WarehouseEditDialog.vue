<script setup>
import { ref, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    warehouseSelected: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits([
    'update:isDialogVisible',
    'updateWarehouse',
]);

const warehouse = ref({
    name: '',
    address: '',
    state: 0, // 0 = Activo, 1 = Inactivo
});

const formRef = ref(null);

// Reglas de validación según backend
const requiredRule = v => !!v || 'Campo obligatorio';
const nameRules = [
    requiredRule,
    v => {
        if (!v) return 'Campo obligatorio';
        if (v.length < 3) return 'El nombre debe tener al menos 3 caracteres';
        if (v.length > 255) return 'El nombre no puede exceder 255 caracteres';
        return true;
    }
];
const addressRules = [
    v => {
        if (v && v.length > 1000) return 'La dirección no puede exceder 1000 caracteres';
        return true;
    }
];

const warning = ref(null);
const error_exist = ref(null);
const loader = useLoaderStore();

// Notificaciones
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

onMounted(() => {
    console.log('Almacén seleccionado:', props.warehouseSelected);
    const warehouseSelected = props.warehouseSelected;
});

const update = async () => {
    error_exist.value = null;
    warning.value = null;
    loader.start();

    // Validar formulario antes de enviar
    if (formRef.value && typeof formRef.value.validate === 'function') {
        const valid = await formRef.value.validate();
        if (!valid) {
            loader.stop();
            warning.value = 'Corrige los campos obligatorios.';
            return;
        }
    }

    try {
        let data = {
            name: props.warehouseSelected.name,
            address: props.warehouseSelected.address,
            state: warehouse.value.state, // Permitir editar estado
            sucursale_id: 1, // Mantener sucursal
        };
        console.log('Actualizando almacén:', data);

        const resp = await $api(`warehouses/${props.warehouseSelected.id}`, {
            method: "PUT",
            body: data,
            onResponseError({ response }) {
                error_exist.value = response._data.error;
            },
        });
        console.log(resp);
        showNotification('Almacén actualizado con éxito', 'success');

        // Crear objeto del almacén actualizado
        const updatedWarehouse = {
            id: props.warehouseSelected.id,
            name: props.warehouseSelected.name,
            address: props.warehouseSelected.address,
            state: props.warehouseSelected.state,
            created_at: props.warehouseSelected.created_at
        };

        // Emitir el evento para actualizar el almacén en la tabla
        emit('updateWarehouse', updatedWarehouse);

        // Cerrar el diálogo después de un breve delay para mostrar el mensaje de éxito
        setTimeout(() => {
            onFormReset();
        }, 1500);

        loader.stop();

    } catch (error) {
        console.log(error);
        showNotification('Error al actualizar almacén', 'error');
        loader.stop();
    } finally {
        loader.stop();
    }
};

const onFormReset = () => {
    warehouse.value = {
        name: '',
        address: '',
        state: 0,
    };
    warning.value = null;
    error_exist.value = null;
    emit('update:isDialogVisible', false);
};
</script>

<template>
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 720" :model-value="props.isDialogVisible"
        @update:model-value="val => emit('update:isDialogVisible', val)" transition="dialog-bottom-transition">
        <VCard class="pa-6 pa-sm-10 rounded-xl elevation-10">

            <!-- Close -->
            <DialogCloseBtn variant="text" size="small" class="position-absolute top-0 end-0 ma-4"
                @click="onFormReset" />

            <!-- Header -->
            <div class="text-center mb-8">
                <VIcon icon="ri-edit-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Editar almacén
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Modifica los datos del almacén seleccionado
                </p>
            </div>

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="update">
                <VRow>
                    <!-- Nombre -->
                    <VCol cols="12" sm="12">
                        <VTextField v-model="warehouseSelected.name" :rules="nameRules" label="Nombre"
                            placeholder="ej. Almacén Central" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-store-line" hide-details="auto" required closable />
                    </VCol>

                    <!-- Dirección -->
                    <VCol cols="12" sm="12">
                        <VTextField v-model="warehouseSelected.address" :rules="addressRules" label="Dirección"
                            placeholder="ej. Calle Ficticia 123" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-map-pin-line" hide-details="auto" required />
                    </VCol>

                    <!-- Estado -->
                    <VCol cols="12" sm="12">
                        <VSelect v-model="warehouseSelected.state" label="Estado" prepend-inner-icon="ri-toggle-line"
                            variant="outlined" density="comfortable" :items="[
                                { title: 'Activo', value: 0 },
                                { title: 'Inactivo', value: 1 }
                            ]" required />
                    </VCol>

                    <!-- Alertas de Error/Éxito -->
                    <VCol cols="12" v-if="warning">
                        <VAlert color="warning" variant="tonal" closable> {{ warning }}</VAlert>
                    </VCol>

                    <!-- Acciones -->
                    <VCol cols="12" class="d-flex justify-end gap-3 mt-4">
                        <VBtn variant="outlined" color="secondary" class="text-none px-6" @click="onFormReset">
                            <VIcon start icon="ri-close-line" />
                            Cancelar
                        </VBtn>

                        <VBtn type="submit" color="primary" variant="elevated" class="text-none px-6"
                            :loading="loader.loading" :disabled="loader.loading">
                            <VIcon start icon="ri-save-3-line" />
                            Actualizar Almacén
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>
        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
