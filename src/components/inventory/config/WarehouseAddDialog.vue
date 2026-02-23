<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
});

const emit = defineEmits([
    'update:isDialogVisible',
    'addWarehouse',
]);

const warehouse = ref({
    name: '',
    address: '',
});

const formRef = ref(null);

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

const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

const store = async () => {
    error_exist.value = null;
    warning.value = null;
    loader.start();

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
            name: warehouse.value.name,
            address: warehouse.value.address,
            sucursale_id: 1,  // Valor por defecto
            state: 0,           // Activo por defecto (0 = Activo)
        };
        console.log(data);

        const resp = await $api("warehouses", {
            method: "POST",
            body: data,
            onResponseError({ response }) {
                error_exist.value = response._data.error;
            },
        });
        console.log(resp);
        emit('addWarehouse', resp.warehouse);

        setTimeout(() => {
            onFormReset();
        }, 1500);

        loader.stop();

    } catch (error) {
        console.log(error);
        showNotification('Error al ingresar almacén', 'error');
        loader.stop();
    } finally {
        loader.stop();
    }
};

const onFormReset = () => {
    warehouse.value = {
        name: '',
        address: '',
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
                <VIcon icon="ri-store-2-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Ingreso de nuevo almacén
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Completa los datos del nuevo almacén para registrarlo en el sistema
                </p>
            </div>

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="store">
                <VRow>
                    <!-- Nombre -->
                    <VCol cols="12" sm="12">
                        <VTextField v-model="warehouse.name" :rules="nameRules" label="Nombre"
                            placeholder="ej. Almacén Central" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-store-line" hide-details="auto" required closable />
                    </VCol>

                    <!-- Dirección -->
                    <VCol cols="12" sm="12">
                        <VTextField v-model="warehouse.address" :rules="addressRules" label="Dirección"
                            placeholder="ej. Calle Ficticia 123" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-map-pin-line" hide-details="auto" required />
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
                            Guardar Almacén
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>
        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
