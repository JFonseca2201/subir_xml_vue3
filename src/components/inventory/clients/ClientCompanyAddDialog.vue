<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
})

const emit = defineEmits(['update:isDialogVisible', 'addClientCompany'])

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

// Formulario de cliente empresa (mismos campos que ClientFinalAddDialog)
const clientForm = ref({
    full_name: '', // Se llenará manualmente
    phone: '',
    email: '',
    type_client: 2, // Cliente empresa = Jurídico
    type_document: 2, // RUC por defecto
    n_document: '',
    birth_date: '', // Fecha de constitución
    user_id: 1, // ID de usuario por defecto (no nulo)
    sucursale_id: 1, // Por defecto 1
    state: 1, // Activo por defecto
    gender: '', // No aplica para empresas
    ubigeo_region: '',
    ubigeo_provincia: '',
    ubigeo_ciudad: '',
    region: '',
    provincia: '',
    distrito: '',
    address: '',
    razon_social: '', // Razón social principal
    nombre_comercial: '', // Nombre comercial
    representante_legal: '', // Representante legal
    actividad_economica: '', // Actividad económica
    capital_social: '', // Capital social
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

const actividadEconomicaOptions = ref([
    { title: 'Comercio', value: 'comercio' },
    { title: 'Servicios', value: 'servicios' },
    { title: 'Industria', value: 'industria' },
    { title: 'Construcción', value: 'construccion' },
    { title: 'Agricultura', value: 'agricultura' },
    { title: 'Tecnología', value: 'tecnologia' },
    { title: 'Transporte', value: 'transporte' },
    { title: 'Otros', value: 'otros' }
])

// Referencias del formulario
const formRef = ref(null)

// Validación para RUC ecuatoriano
const validateEcuadorianRUC = (ruc) => {
    if (!ruc) return true; // Permitir vacío si no es requerido

    // Eliminar espacios y guiones
    const cleanRUC = ruc.replace(/[\s-]/g, '');

    // Verificar que tenga 13 dígitos
    if (!/^\d{13}$/.test(cleanRUC)) {
        return false;
    }

    // Los dos primeros dígitos deben ser válidos para provincia
    const provincia = parseInt(cleanRUC.substring(0, 2));
    if (provincia < 1 || provincia > 24) {
        return false;
    }

    // El tercer dígito debe ser 6, 7, 8 o 9 para personas jurídicas
    const tercerDigito = parseInt(cleanRUC.substring(2, 3));
    if (![6, 7, 8, 9].includes(tercerDigito)) {
        return false;
    }

    return true;
};

// Reglas de validación
const rules = {
    full_name: [
        v => !!v || 'El nombre completo es requerido',
        v => (v && v.length >= 3) || 'El nombre completo debe tener al menos 3 caracteres'
    ],
    razon_social: [
        v => !!v || 'La razón social es requerida',
        v => (v && v.length >= 3) || 'La razón social debe tener al menos 3 caracteres'
    ],
    nombre_comercial: [
        v => !!v || 'El nombre comercial es requerido',
        v => (v && v.length >= 2) || 'El nombre comercial debe tener al menos 2 caracteres'
    ],
    representante_legal: [
        v => !!v || 'El representante legal es requerido',
        v => (v && v.length >= 5) || 'El representante legal debe tener al menos 5 caracteres'
    ],
    actividad_economica: [
        v => !!v || 'La actividad económica es requerida'
    ],
    n_document: [
        v => !!v || 'El número de documento es requerido',
        v => (v && v.length >= 13) || 'El RUC debe tener 13 dígitos',
        v => validateEcuadorianRUC(v) || 'RUC ecuatoriano inválido'
    ],
    email: [
        v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email inválido'
    ],
    phone: [
        v => !v || /^[0-9+\-\s()]+$/.test(v) || 'Teléfono inválido'
    ],
    capital_social: [
        v => !v || /^\d+(\.\d{1,2})?$/.test(v) || 'Capital social inválido'
    ],
    state: [
        v => !!v || 'El estado es requerido',
        v => [1, 2].includes(v) || 'El estado debe ser 1 (Activo) o 2 (Inactivo)'
    ]
}

// Generar full_name automáticamente
const generateFullName = () => {
    if (clientForm.value.name) {
        clientForm.value.full_name = clientForm.value.name;
        // surname se mantiene vacío para empresas
    }
}

// Guardar cliente empresa
const saveClient = async () => {
    const { valid } = await formRef.value?.validate();
    if (!valid) return;

    loading.value = true;
    error.value = '';
    success.value = '';

    try {
        console.log('Datos del cliente empresa a guardar:', clientForm.value);

        // Convertir campos a strings para validación del backend
        const clientData = {
            ...clientForm.value,
            type_client: clientForm.value.type_client.toString(),
            type_document: clientForm.value.type_document.toString(),
            state: clientForm.value.state.toString(),
            name: clientForm.value.razon_social, // Usar razón social como name
            surname: '', // Las empresas no tienen apellido
        };

        console.log('Datos corregidos para enviar:', clientData);

        const resp = await $api("clients", {
            method: "POST",
            body: clientData,
            onResponseError({ response }) {
                error.value = response._data?.message || 'Error al guardar cliente';
                console.error('Error response:', response._data);
            },
        });

        console.log('Respuesta del servidor:', resp);

        if (resp.status === 200 || resp.status === 201) {
            success.value = 'Cliente empresa guardado correctamente';
            showNotification('Cliente empresa guardado correctamente', 'success');

            // Limpiar formulario
            resetForm();

            // Cerrar diálogo después de un momento
            setTimeout(() => {
                emit('update:isDialogVisible', false);
                // Emitir datos actualizados (usar resp.data o clientForm.value como fallback)
                const updatedData = resp.data || clientForm.value;
                console.log('Datos emitidos:', updatedData);
                emit('addClientCompany', updatedData);
            }, 1500);
        } else {
            error.value = resp.message || 'Error al guardar cliente';
            showNotification(resp.message || 'Error al guardar cliente', 'error');
        }
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        error.value = 'Error al guardar cliente. Intente nuevamente.';
        showNotification('Error al guardar cliente. Intente nuevamente.', 'error');
    } finally {
        loading.value = false;
    }
}

// Resetear formulario
const resetForm = () => {
    clientForm.value = {
        name: '',
        surname: '',
        full_name: '',
        phone: '',
        email: '',
        type_client: 2,
        type_document: 2,
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
        razon_social: '',
        nombre_comercial: '',
        representante_legal: '',
        actividad_economica: '',
        capital_social: '',
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
    clientForm.value.user_id = userStore.id;
});
</script>

<template>
    <VDialog max-width="900" :model-value="props.isDialogVisible" @update:model-value="closeDialog" persistent>
        <VCard class="pa-sm-10 pa-5">
            <!-- 👉 Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <!-- 👉 Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-building-2-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Nuevo Cliente Empresa</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Registro de un nuevo cliente jurídico o compañía
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- 👉 Form -->
            <VForm ref="formRef" @submit.prevent="saveClient">
                <VRow dense>
                    <!-- 👉 Datos Personales -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Datos de la Empresa</h5>
                    </VCol>

                    <VCol cols="12" md="12">
                        <VTextField v-model="clientForm.full_name" label="Nombre Completo *"
                            placeholder="Ingrese nombre completo de la empresa" prepend-inner-icon="ri-building-2-line"
                            :rules="rules.full_name" required clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="clientForm.type_document" :items="typeDocumentOptions" item-title="title"
                            item-value="value" label="Tipo de Documento *" prepend-inner-icon="ri-file-text-line"
                            required clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="clientForm.n_document" label="Número de Documento *"
                            placeholder="Ingrese número de RUC (13 dígitos)" prepend-inner-icon="ri-numbers-line"
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
                        <VTextField v-model="clientForm.birth_date" label="Fecha de Constitución" type="date"
                            prepend-inner-icon="ri-calendar-event-line" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="clientForm.state" :items="stateOptions" item-title="title" item-value="value"
                            label="Estado" prepend-inner-icon="ri-toggle-line" placeholder="Seleccione estado"
                            clearable />
                    </VCol>

                    <VDivider class="my-6" />

                    <!-- 👉 Contacto y Ubicación -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Contacto y Ubicación</h5>
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

                    <VDivider class="my-6" />

                    <!-- 👉 Alerts -->
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

                    <!-- 👉 Actions -->
                    <VCol cols="12" class="d-flex justify-center gap-4">
                        <VBtn type="submit" color="primary" prepend-icon="ri-save-3-line" :loading="loading"
                            :disabled="loading">
                            Guardar Empresa
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