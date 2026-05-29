<script setup>
import { ref, onMounted, watch, computed } from 'vue'
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

// Formulario de cliente empresa (mismos campos que ClientFinalAddDialog)
const clientForm = ref({
    id: '',
    name: '', // No se usa para empresas
    surname: '', // No se usa para empresas
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
})

const documentMaxLength = computed(() => {
    const type = Number(clientForm.value.type_document);
    if (type === 1) return 10;
    if (type === 2) return 13;
    return 20; // Pasaporte u otros
});

watch(() => clientForm.value.type_document, (newType) => {
    const type = Number(newType);
    const maxLen = type === 1 ? 10 : (type === 2 ? 13 : 20);
    if (clientForm.value.n_document && clientForm.value.n_document.length > maxLen) {
        clientForm.value.n_document = clientForm.value.n_document.substring(0, maxLen);
    }
});

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

// Validación para RUC ecuatoriano
const validateEcuadorianRUC = (ruc) => {
    if (!ruc) return true;

    // Eliminar espacios y guiones
    let cleanRUC = ruc.replace(/[\s-]/g, '');

    // Si tiene 10 dígitos y el tercer dígito es 6 o 9, normalizar a RUC
    if (cleanRUC.length === 10) {
        const tercerDigit = parseInt(cleanRUC.substring(2, 3));
        if ([6, 9].includes(tercerDigit)) {
            cleanRUC += '001';
        }
    }

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
    n_document: [
        v => !!v || 'El número de documento es requerido',
        v => (v && (v.replace(/[\s-]/g, '').length === 10 || v.replace(/[\s-]/g, '').length === 13)) || 'El RUC debe tener 10 o 13 dígitos',
        v => validateEcuadorianRUC(v) || 'RUC ecuatoriano inválido'
    ],
    email: [
        v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email inválido'
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
            // Convertir string a número para que el VSelect funcione correctamente
            type_client: parseInt(props.clientData.type_client) || 2,
            type_document: parseInt(props.clientData.type_document) || 2,
            state: parseInt(props.clientData.state) || 1,
        };
    }
}

// Actualizar cliente empresa
const updateClient = async () => {
    if (clientForm.value.n_document) {
        const cleanDoc = clientForm.value.n_document.replace(/[\s-]/g, '');
        if (cleanDoc.length === 10) {
            const thirdDigit = parseInt(cleanDoc.substring(2, 3));
            if ([6, 9].includes(thirdDigit)) {
                clientForm.value.n_document = cleanDoc + '001';
            }
        }
    }

    const { valid } = await formRef.value?.validate();
    if (!valid) return;

    loading.value = true;
    error.value = '';
    success.value = '';

    try {
        console.log('Datos del cliente empresa a actualizar:', clientForm.value);

        // Convertir campos a strings para validación del backend
        const clientData = {
            ...clientForm.value,
            type_client: clientForm.value.type_client.toString(),
            type_document: clientForm.value.type_document.toString(),
            state: clientForm.value.state.toString(),
            name: clientForm.value.full_name, // Usar full_name como name
            surname: '', // Las empresas no tienen apellido
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
            success.value = 'Cliente empresa actualizado correctamente';
            showNotification('Cliente empresa actualizado correctamente', 'success');

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

watch(() => clientForm.value.n_document, (newVal) => {
    if (newVal) {
        const cleanDoc = newVal.replace(/[\s-]/g, '');
        if (cleanDoc.length === 10) {
            const thirdDigit = parseInt(cleanDoc.substring(2, 3));
            if ([6, 9].includes(thirdDigit)) {
                clientForm.value.n_document = cleanDoc + '001';
            }
        }
    }
});

const filterDocumentKey = (event) => {
    if (event.key && event.key.length > 1) return;
    const type = Number(clientForm.value.type_document);
    const charStr = event.key || String.fromCharCode(event.keyCode || event.which);
    if (type === 1 || type === 2) {
        if (!/^[0-9]$/.test(charStr)) {
            event.preventDefault();
        }
    } else if (type === 3) {
        if (!/^[a-zA-Z0-9]$/.test(charStr)) {
            event.preventDefault();
        }
    }
};

const filterPhoneKey = (event) => {
    if (event.key && event.key.length > 1) return;
    const charStr = event.key || String.fromCharCode(event.keyCode || event.which);
    if (!/^[0-9+\-\s()]$/.test(charStr)) {
        event.preventDefault();
    }
};

const regions = ref([])
const provinces = ref([])
const districts = ref([])

const loadRegions = async () => {
    try {
        const resp = await $api('geographic/regions', { method: 'GET' })
        regions.value = resp
    } catch (e) {
        console.error(e)
    }
}

watch(() => clientForm.value.ubigeo_region, async (newVal) => {
    if (newVal) {
        try {
            const resp = await $api(`geographic/provinces/${newVal}`, { method: 'GET' })
            provinces.value = resp
            clientForm.value.region = regions.value.find(r => r.id === newVal)?.name || ''
        } catch (e) {
            console.error(e)
        }
    } else {
        provinces.value = []
        districts.value = []
        clientForm.value.ubigeo_provincia = ''
        clientForm.value.ubigeo_distrito = ''
        clientForm.value.region = ''
    }
})

watch(() => clientForm.value.ubigeo_provincia, async (newVal) => {
    if (newVal) {
        try {
            const resp = await $api(`geographic/cities/${newVal}`, { method: 'GET' })
            districts.value = resp
            clientForm.value.provincia = provinces.value.find(p => p.id === newVal)?.name || ''
        } catch (e) {
            console.error(e)
        }
    } else {
        districts.value = []
        clientForm.value.ubigeo_distrito = ''
        clientForm.value.provincia = ''
    }
})

watch(() => clientForm.value.ubigeo_distrito, (newVal) => {
    if (newVal) {
        clientForm.value.distrito = districts.value.find(d => d.id === newVal)?.name || ''
    } else {
        clientForm.value.distrito = ''
    }
})

// Montar componente
onMounted(() => {
    loadRegions()
    clientForm.value.user_id = userStore.id;
    loadClientData();
    if (props.clientData) {
        setTimeout(async () => {
            if (props.clientData.ubigeo_region) {
                provinces.value = await $api(`geographic/provinces/${props.clientData.ubigeo_region}`, { method: 'GET' })
            }
            if (props.clientData.ubigeo_provincia) {
                districts.value = await $api(`geographic/cities/${props.clientData.ubigeo_provincia}`, { method: 'GET' })
            }
        }, 100)
    }
});
</script>

<template>
    <VDialog max-width="800" :model-value="props.isDialogVisible" @update:model-value="closeDialog" persistent>
        <VCard class="pa-sm-10 pa-5">
            <!-- Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-building-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Editar Cliente Empresa</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Modificación de datos del cliente jurídico o compañía
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="updateClient">
                <VRow>
                    <!-- Datos de la Empresa -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Datos de la Empresa</h5>
                    </VCol>

                    <VCol cols="12" md="12" class="mb-3">
                        <VTextField v-model="clientForm.full_name" label="Nombre Completo *"
                            placeholder="Ingrese nombre completo de la empresa" prepend-inner-icon="ri-building-2-line"
                            :rules="rules.full_name" required clearable class="v-input--density-comfortable"
                            maxlength="255" />
                    </VCol>

                    <VCol cols="12" md="6" class="mb-3">
                        <VSelect v-model="clientForm.type_document" :items="typeDocumentOptions" item-title="title"
                            item-value="value" label="Tipo de Documento *" prepend-inner-icon="ri-file-text-line"
                            required clearable class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="6" class="mb-3">
                        <VTextField v-model="clientForm.n_document" label="Número de Documento *"
                            placeholder="Ingrese número de RUC (13 dígitos)" prepend-inner-icon="ri-numbers-line"
                            :rules="rules.n_document" required clearable class="v-input--density-comfortable"
                            @keypress="filterDocumentKey" :maxlength="documentMaxLength" />
                    </VCol>

                    <VCol cols="12" md="6" class="mb-3">
                        <VTextField v-model="clientForm.phone" label="Teléfono" placeholder="Ingrese teléfono"
                            prepend-inner-icon="ri-phone-line" :rules="rules.phone" clearable
                            class="v-input--density-comfortable" @keypress="filterPhoneKey" maxlength="20" />
                    </VCol>

                    <VCol cols="12" md="6" class="mb-3">
                        <VTextField v-model="clientForm.email" label="Email" placeholder="Ingrese email"
                            prepend-inner-icon="ri-mail-line" :rules="rules.email" clearable
                            class="v-input--density-comfortable" maxlength="100" />
                    </VCol>

                    <VCol cols="12" md="6" class="mb-3">
                        <VTextField v-model="clientForm.birth_date" label="Fecha de Constitución" type="date"
                            prepend-inner-icon="ri-calendar-event-line" clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="6" class="mb-3">
                        <VSelect v-model="clientForm.state" :items="stateOptions" item-title="title" item-value="value"
                            label="Estado" prepend-inner-icon="ri-toggle-line" placeholder="Seleccione estado" clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VDivider class="my-6" />

                    <!-- Contacto y Ubicación -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Contacto y Ubicación</h5>
                    </VCol>

                    <VCol cols="12" class="mb-3">
                        <VTextField v-model="clientForm.address" label="Dirección"
                            placeholder="Ingrese dirección completa" prepend-inner-icon="ri-map-pin-line" clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="4" class="mb-3">
                        <VSelect v-model="clientForm.ubigeo_region" :items="regions" item-title="name" item-value="id"
                            label="Región" placeholder="Seleccione Región" prepend-inner-icon="ri-map-2-line" clearable
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="4" class="mb-3">
                        <VSelect v-model="clientForm.ubigeo_provincia" :items="provinces" item-title="name"
                            item-value="id" label="Provincia" placeholder="Seleccione Provincia"
                            prepend-inner-icon="ri-map-2-line" clearable :disabled="!clientForm.ubigeo_region"
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VCol cols="12" md="4" class="mb-3">
                        <VSelect v-model="clientForm.ubigeo_distrito" :items="districts" item-title="name"
                            item-value="id" label="Cantón / Ciudad" placeholder="Seleccione Cantón / Ciudad"
                            prepend-inner-icon="ri-map-2-line" clearable :disabled="!clientForm.ubigeo_provincia"
                            class="v-input--density-comfortable" />
                    </VCol>

                    <VDivider class="my-6" />

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
                            Actualizar Empresa
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