<script setup>
import { ref, onMounted, watch } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    clientData: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:isDialogVisible', 'clientUpdated'])

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

// Formulario de cliente final
const clientForm = ref({
    id: '',
    name: '',
    surname: '',
    full_name: '',
    phone: '',
    email: '',
    type_client: 1,
    type_document: 1,
    n_document: '',
    birth_date: '',
    user_id: 1,
    sucursale_id: 1,
    state: 1,
    gender: '',
    ubigeo_region: '',
    ubigeo_provincia: '',
    ubigeo_ciudad: '',
    region: '',
    provincia: '',
    distrito: '',
    address: '',
})

// Opciones para selects
const typeDocumentOptions = ref([
    { title: 'Cédula', value: 1 },
    { title: 'RUC', value: 2 },
    { title: 'Pasaporte', value: 3 }
])

const genderOptions = ref([
    { title: 'Masculino', value: '1' },
    { title: 'Femenino', value: '2' },
])

// Opciones para estado (1 = Activo, 2 = Inactivo)
const stateOptions = ref([
    { title: 'Activo', value: 1 },
    { title: 'Inactivo', value: 2 }
])

const sucursales = ref([])

// Referencias del formulario
const formRef = ref(null)

// Validación para cédulas ecuatorianas
const validateEcuadorianCedula = (cedula) => {
    if (!cedula) return true;

    const cleanCedula = cedula.replace(/[\s-]/g, '');

    if (!/^\d{10}$/.test(cleanCedula)) {
        return false;
    }

    const provincia = parseInt(cleanCedula.substring(0, 2));
    if (provincia < 1 || provincia > 24) {
        return false;
    }

    const tercerDigito = parseInt(cleanCedula.substring(2, 3));
    if (tercerDigito < 0 || tercerDigito > 5) {
        return false;
    }

    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;

    for (let i = 0; i < 9; i++) {
        let valor = parseInt(cleanCedula.charAt(i)) * coeficientes[i];
        if (valor >= 10) {
            valor = valor - 9;
        }
        suma += valor;
    }

    const digitoVerificador = parseInt(cleanCedula.charAt(9));
    const modulo = suma % 10;
    const resultado = modulo === 0 ? 0 : 10 - modulo;

    return resultado === digitoVerificador;
};

// Reglas de validación
const rules = {
    name: [
        v => !!v || 'El nombre es requerido',
        v => (v && v.length >= 2) || 'El nombre debe tener al menos 2 caracteres'
    ],
    surname: [
        v => !!v || 'El apellido es requerido',
        v => (v && v.length >= 2) || 'El apellido debe tener al menos 2 caracteres'
    ],
    email: [
        v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email inválido'
    ],
    n_document: [
        v => !!v || 'El número de documento es requerido',
        v => (v && v.length >= 5) || 'El documento debe tener al menos 5 caracteres',
        v => validateEcuadorianCedula(v) || 'Cédula ecuatoriana inválida'
    ],
    phone: [
        v => !v || /^[0-9+\-\s()]+$/.test(v) || 'Teléfono inválido'
    ],
    state: [
        v => !!v || 'El estado es requerido',
        v => [1, 2].includes(v) || 'El estado debe ser 1 (Activo) o 2 (Inactivo)'
    ]
}

// Cargar datos del cliente al montar
const loadClientData = () => {
    if (props.clientData) {
        clientForm.value = {
            ...props.clientData,
            user_id: userStore.id || 1,
        };
    }
}

// Generar full_name automáticamente
const generateFullName = () => {
    if (clientForm.value.name && clientForm.value.surname) {
        clientForm.value.full_name = `${clientForm.value.name} ${clientForm.value.surname}`;
    }
}

// Actualizar cliente
const updateClient = async () => {
    const { valid } = await formRef.value?.validate();
    if (!valid) return;

    loading.value = true;
    error.value = '';
    success.value = '';

    try {
        console.log('Datos del cliente a actualizar:', clientForm.value);

        // Convertir campos a strings para validación del backend
        const clientData = {
            ...clientForm.value,
            type_client: clientForm.value.type_client.toString(),
            type_document: clientForm.value.type_document.toString(),
            state: clientForm.value.state.toString(),
        };

        console.log('Datos corregidos para enviar:', clientData);

        const resp = await $api(`clients/${clientForm.value.id}`, {
            method: "PUT",
            body: clientData,
            onResponseError({ response }) {
                error.value = response._data?.message || 'Error al actualizar cliente';
                console.error('Error response:', response._data);
            },
        });

        console.log('Respuesta del servidor:', resp);

        if (resp.status === 200 || resp.status === 201) {
            success.value = 'Cliente actualizado correctamente';
            showNotification('Cliente actualizado correctamente', 'success');

            // Emitir datos actualizados (usar resp.data o clientForm.value como fallback)
            const updatedData = resp.data ?? clientForm.value;
            console.log('Datos emitidos:', updatedData);

            // Cerrar diálogo después de un momento
            setTimeout(() => {
                emit('update:isDialogVisible', false);
                emit('clientUpdated', updatedData);
            }, 1500);
        } else {
            error.value = resp.message || 'Error al actualizar cliente';
            showNotification(resp.message || 'Error al actualizar cliente', 'error');
        }
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        error.value = 'Error al actualizar cliente. Intente nuevamente.';
        showNotification('Error al actualizar cliente. Intente nuevamente.', 'error');
    } finally {
        loading.value = false;
    }
}

// Resetear formulario
const resetForm = () => {
    if (formRef.value) {
        formRef.value.resetValidation();
    }
}

// Cerrar diálogo
const closeDialog = () => {
    emit('update:isDialogVisible', false);
    resetForm();
}

// Watch para cambios en clientData
watch(() => props.clientData, (newData) => {
    if (newData) {
        loadClientData();
    }
}, { immediate: true });

// Watch para generar full_name
watch(() => clientForm.value.name, () => {
    generateFullName();
});

watch(() => clientForm.value.surname, () => {
    generateFullName();
});

// Montar componente
onMounted(() => {
    clientForm.value.user_id = userStore.id;
    loadClientData();
});
</script>

<template>
    <VDialog max-width="800" :model-value="props.isDialogVisible" @update:model-value="closeDialog" persistent>
        <VCard class="pa-sm-10 pa-5">
            <!-- Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-user-edit-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Editar Cliente Final</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Modificación de datos del cliente
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="updateClient">
                <VRow dense>
                    <!-- Datos Personales -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Datos Personales</h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="clientForm.name" label="Nombres *" placeholder="Ingrese nombres"
                            prepend-inner-icon="ri-user-3-line" :rules="rules.name" required @input="generateFullName"
                            clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="clientForm.surname" label="Apellidos *" placeholder="Ingrese apellidos"
                            prepend-inner-icon="ri-user-3-line" :rules="rules.surname" required
                            @input="generateFullName" clearable />
                    </VCol>

                    <VCol cols="12">
                        <VTextField v-model="clientForm.full_name" label="Nombre Completo"
                            placeholder="Se genera automáticamente" prepend-inner-icon="ri-user-smile-line" readonly
                            disabled />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="clientForm.type_document" :items="typeDocumentOptions" item-title="title"
                            item-value="value" label="Tipo de Documento *" prepend-inner-icon="ri-file-text-line"
                            required clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="clientForm.n_document" label="Número de Documento *"
                            placeholder="Ingrese número de documento" prepend-inner-icon="ri-numbers-line"
                            :rules="rules.n_document" required clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="clientForm.phone" label="Teléfono" placeholder="Ingrese teléfono"
                            prepend-inner-icon="ri-phone-line" :rules="rules.phone" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="clientForm.email" label="Email" placeholder="Ingrese email"
                            prepend-inner-icon="ri-mail-line" :rules="rules.email" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="clientForm.gender" :items="genderOptions" item-title="title"
                            item-value="value" label="Género" prepend-inner-icon="ri-user-settings-line"
                            placeholder="Seleccione género" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="clientForm.state" :items="stateOptions" item-title="title" item-value="value"
                            label="Estado" prepend-inner-icon="ri-toggle-line" placeholder="Seleccione estado"
                            clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="clientForm.birth_date" label="Fecha de Nacimiento" type="date"
                            prepend-inner-icon="ri-calendar-event-line" clearable />
                    </VCol>

                    <VDivider class="my-6" />

                    <!-- Ubicación -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Ubicación</h5>
                    </VCol>

                    <VCol cols="12">
                        <VTextField v-model="clientForm.address" label="Dirección"
                            placeholder="Ingrese dirección completa" prepend-inner-icon="ri-map-pin-line" clearable />
                    </VCol>

                    <VCol cols="12" md="4">
                        <VTextField v-model="clientForm.region" label="Región" placeholder="Región"
                            prepend-inner-icon="ri-map-2-line" clearable />
                    </VCol>

                    <VCol cols="12" md="4">
                        <VTextField v-model="clientForm.provincia" label="Provincia" placeholder="Provincia"
                            prepend-inner-icon="ri-map-2-line" clearable />
                    </VCol>

                    <VCol cols="12" md="4">
                        <VTextField v-model="clientForm.distrito" label="Distrito" placeholder="Distrito"
                            prepend-inner-icon="ri-map-2-line" clearable />
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
                            Actualizar Cliente
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
</style>