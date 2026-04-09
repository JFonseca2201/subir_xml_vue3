<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
})

const emit = defineEmits(['update:isDialogVisible', 'addVehicle'])

// Estado del formulario
const loading = ref(false)
const error = ref('')
const success = ref('')
const userStore = JSON.parse(localStorage.getItem('user'));

// Notificaciones
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

// Formulario de vehículo
const vehicleForm = ref({
    license_plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vehicle_type: '',
    description: '',
})

// Opciones para selects
const vehicleTypeOptions = ref([
    { title: 'Sedán', value: 'sedan' },
    { title: 'Hatchback', value: 'hatchback' },
    { title: 'Camioneta', value: 'camioneta' },
    { title: 'SUV', value: 'suv' },
    { title: 'Furgoneta', value: 'furgoneta' },
    { title: 'Camión', value: 'camion' },
    { title: 'Bus', value: 'bus' },
    { title: 'Van', value: 'van' },
    { title: 'Motocicleta', value: 'motocicleta' },
    { title: 'Pickup', value: 'pickup' },
    { title: 'Minivan', value: 'minivan' },
    { title: 'Deportivo', value: 'deportivo' },
    { title: 'Otro', value: 'otro' }
])

const brandOptions = ref([
    { title: 'Toyota', value: 'toyota' },
    { title: 'Honda', value: 'honda' },
    { title: 'Nissan', value: 'nissan' },
    { title: 'Chevrolet', value: 'chevrolet' },
    { title: 'Ford', value: 'ford' },
    { title: 'Hyundai', value: 'hyundai' },
    { title: 'Kia', value: 'kia' },
    { title: 'Volkswagen', value: 'volkswagen' },
    { title: 'Mazda', value: 'mazda' },
    { title: 'Suzuki', value: 'suzuki' },
    { title: 'Otro', value: 'otro' }
])

const colorOptions = ref([
    { title: 'Rojo', value: 'rojo' },
    { title: 'Azul', value: 'azul' },
    { title: 'Verde', value: 'verde' },
    { title: 'Amarillo', value: 'amarillo' },
    { title: 'Negro', value: 'negro' },
    { title: 'Blanco', value: 'blanco' },
    { title: 'Gris', value: 'gris' },
    { title: 'Plateado', value: 'plateado' },
    { title: 'Dorado', value: 'dorado' },
    { title: 'Morado', value: 'morado' },
    { title: 'Naranja', value: 'naranja' },
    { title: 'Café', value: 'café' },
    { title: 'Rosado', value: 'rosado' },
    { title: 'Celeste', value: 'celeste' },
    { title: 'Beige', value: 'beige' },
    { title: 'Otro', value: 'otro' }
])

// Generar opciones de años (últimos 20 años + 5 años futuros)
const yearOptions = ref([])
const generateYearOptions = () => {
    const currentYear = new Date().getFullYear()
    for (let i = currentYear + 5; i >= currentYear - 20; i--) {
        yearOptions.value.push({ title: i.toString(), value: i })
    }
}

// Referencias del formulario
const formRef = ref(null)

// Validación para placa ecuatoriana
const validateEcuadorianPlate = (plate) => {
    if (!plate) return true; // Permitir vacío si no es requerido

    // Formato: ABC-1234 (vehículos particulares) o XYZ-999 (comerciales)
    const plateRegex = /^[A-Z]{3}-\d{3,4}$/
    return plateRegex.test(plate.toUpperCase())
}

// Reglas de validación
const rules = {
    license_plate: [
        v => !!v || 'La placa es requerida',
        v => (v && v.length >= 7) || 'La placa debe tener al menos 7 caracteres',
        v => validateEcuadorianPlate(v) || 'Formato de placa inválido (ej: ABC-1234)'
    ],
    brand: [
        v => !!v || 'La marca es requerida',
        v => (v && v.length >= 2) || 'La marca debe tener al menos 2 caracteres'
    ],
    model: [
        v => !!v || 'El modelo es requerido',
        v => (v && v.length >= 2) || 'El modelo debe tener al menos 2 caracteres'
    ],
    year: [
        v => !!v || 'El año es requerido',
        v => (v >= 1900 && v <= new Date().getFullYear() + 5) || 'El año debe estar entre 1900 y ' + (new Date().getFullYear() + 5)
    ],
    color: [
        v => !!v || 'El color es requerido'
    ],
    vehicle_type: [
        v => !!v || 'El tipo de vehículo es requerido'
    ],
    description: [
        v => !v || v.length <= 500 || 'La descripción no puede exceder 500 caracteres'
    ]
}

// Guardar vehículo
const saveVehicle = async () => {
    const { valid } = await formRef.value?.validate();
    if (!valid) return;

    loading.value = true;
    error.value = '';
    success.value = '';

    try {
        // Validar que los campos no estén vacíos antes de enviar
        const formData = {
            license_plate: vehicleForm.value.license_plate?.trim() || '',
            brand: vehicleForm.value.brand?.trim() || '',
            model: vehicleForm.value.model?.trim() || '',
            year: vehicleForm.value.year || new Date().getFullYear(),
            color: vehicleForm.value.color?.trim() || '',
            vehicle_type: vehicleForm.value.vehicle_type?.trim() || '',
            description: vehicleForm.value.description?.trim() || ''
        };

        console.log('Datos del vehículo a guardar (limpios):', formData);
        console.log('Validación de campos vacíos:', {
            license_plate: !!formData.license_plate,
            brand: !!formData.brand,
            model: !!formData.model,
            color: !!formData.color,
            vehicle_type: !!formData.vehicle_type
        });

        const resp = await $api("vehicles", {
            method: "POST",
            body: formData,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            onResponseError({ response }) {
                console.error('Error response completo:', response);
                error.value = response._data?.message || 'Error al guardar vehículo';
                console.error('Error response:', response._data);
            },
        });

        console.log('Respuesta del servidor:', resp);

        if (resp.status === 200 || resp.status === 201) {
            success.value = 'Vehículo guardado correctamente';
            showNotification('Vehículo guardado correctamente', 'success');

            // Limpiar formulario
            resetForm();

            // Cerrar diálogo después de un momento
            setTimeout(() => {
                emit('update:isDialogVisible', false);
                // Emitir datos actualizados (usar resp.data o vehicleForm.value como fallback)
                const updatedData = resp.data || vehicleForm.value;
                console.log('Datos emitidos:', updatedData);
                emit('addVehicle', updatedData);
            }, 1500);
        } else {
            error.value = resp.message || 'Error al guardar vehículo';
            showNotification(resp.message || 'Error al guardar vehículo', 'error');
        }
    } catch (error) {
        console.error('Error al guardar vehículo:', error);
        error.value = 'Error al guardar vehículo. Intente nuevamente.';
        showNotification('Error al guardar vehículo. Intente nuevamente.', 'error');
    } finally {
        loading.value = false;
    }
}

// Resetear formulario
const resetForm = () => {
    vehicleForm.value = {
        license_plate: '',
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        vehicle_type: '',
        description: '',
    };

    if (formRef.value) {
        formRef.value.resetValidation();
    }
}

// Cerrar diálogo
const closeDialog = () => {
    emit('update:isDialogVisible', false);
    resetForm();
}

// Montar componente
onMounted(() => {
    generateYearOptions();
});
</script>

<template>
    <VDialog max-width="800" :model-value="props.isDialogVisible" @update:model-value="closeDialog" persistent>
        <VCard class="pa-sm-10 pa-5">
            <!-- Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-add-circle-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Nuevo Vehículo</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Registro de un nuevo vehículo
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="saveVehicle">
                <VRow dense>
                    <!-- Datos Principales -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Datos Principales</h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="vehicleForm.license_plate" label="Placa *" placeholder="Ej: ABC-1234"
                            prepend-inner-icon="ri-id-card-line" :rules="rules.license_plate" required clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.vehicle_type" :items="vehicleTypeOptions" item-title="title"
                            item-value="value" label="Tipo de Vehículo *" prepend-inner-icon="ri-car-line"
                            :rules="rules.vehicle_type" required clearable class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.brand" :items="brandOptions" item-title="title" item-value="value"
                            label="Marca *" prepend-inner-icon="ri-building-line" :rules="rules.brand" required
                            clearable class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="vehicleForm.model" label="Modelo *" placeholder="Ingrese modelo"
                            prepend-inner-icon="ri-car-line" :rules="rules.model" required clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.year" :items="yearOptions" item-title="title" item-value="value"
                            label="Año *" prepend-inner-icon="ri-calendar-line" :rules="rules.year" required clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.color" :items="colorOptions" item-title="title" item-value="value"
                            label="Color *" prepend-inner-icon="ri-palette-line" :rules="rules.color" required clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VDivider class="my-6" />

                    <!-- Descripción -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Descripción</h5>
                    </VCol>

                    <VCol cols="12">
                        <VTextarea v-model="vehicleForm.description" label="Descripción (opcional)"
                            placeholder="Ingrese detalles adicionales del vehículo..."
                            prepend-inner-icon="ri-file-text-line" :rules="rules.description" rows="4" clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VDivider class="my-4" />

                    <!-- Alerts -->
                    <VCol cols="12" v-if="error">
                        <VAlert type="error" variant="tonal" closable @click:close="error = ''">
                            {{ error }}
                        </VAlert>
                    </VCol>

                    <VCol cols="12" v-if="success">
                        <VAlert type="success" variant="tonal" closable @click:close="success = ''">
                            {{ success }}
                        </VAlert>
                    </VCol>

                    <!-- Actions -->
                    <VCol cols="12" class="d-flex justify-center gap-4">
                        <VBtn type="submit" color="primary" prepend-icon="ri-save-3-line" :loading="loading"
                            :disabled="loading">
                            Guardar Vehículo
                        </VBtn>

                        <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" @click="closeDialog"
                            :disabled="loading">
                            Cancelar
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>
        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <VSnackbar v-model="notificationShow" :color="notificationType" :timeout="3000" location="top">
        {{ notificationMessage }}
    </VSnackbar>
</template>

<style scoped>
.v-card-title {
    border-radius: 12px 12px 0 0;
}

.text-h6 {
    color: #1976D2;
    border-bottom: 2px solid #1976D2;
    padding-bottom: 8px;
    margin-bottom: 16px;
}

/* Estilos personalizados para campos más grandes */
.v-input--density-comfortable .v-field__input {
    min-height: 56px !important;
    padding: 16px 12px !important;
    font-size: 16px !important;
}

.v-input--density-comfortable .v-field {
    border-radius: 12px !important;
}

.v-input--density-comfortable .v-field__prepend-inner {
    padding-top: 16px !important;
    padding-bottom: 16px !important;
}

.v-input--density-comfortable .v-label {
    font-size: 14px !important;
    font-weight: 500 !important;
}

.v-input--density-comfortable.v-textarea .v-field__input {
    min-height: 80px !important;
    padding: 16px 12px !important;
}

.v-select .v-field__input {
    min-height: 56px !important;
    padding: 16px 12px !important;
    font-size: 16px !important;
}

.v-select .v-field__append-inner {
    padding-top: 16px !important;
    padding-bottom: 16px !important;
}

/* Aumentar espaciado entre filas */
.v-row>.v-col {
    padding: 12px !important;
}
</style>
