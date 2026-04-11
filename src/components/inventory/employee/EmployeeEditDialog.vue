<script setup>
import { ref, onMounted, watch } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    employeeData: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:isDialogVisible', 'editEmployee'])

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

// Formulario de empleado
const employeeForm = ref({
    id: null,
    name: '',
    surname: '',
    full_name: '',
    dni: '',
    phone: '',
    email: '',
    birth_date: '',
    address: '',
    gender: '',
    position: '',
    salary: '',
    hire_date: '',
    account_number: '',
    bank_name: '',
    status: 1,
    user_id: 1,
    sucursale_id: 1
})

// Opciones para selects
const genderOptions = ref([
    { title: 'Masculino', value: '1' },
    { title: 'Femenino', value: '2' },
    { title: 'Otro', value: '3' }
])

const statusOptions = ref([
    { title: 'Activo', value: 1 },
    { title: 'Inactivo', value: 2 }
])

const sucursalOptions = ref([
    { title: 'Sucursal Principal', value: 1 },
    { title: 'Sucursal Secundaria', value: 2 }
])

// Referencias del formulario
const formRef = ref(null)

// Validación para cédulas ecuatorianas
const validateEcuadorianCedula = (cedula) => {
    if (!cedula) return true; // Permitir vacío si no es requerido

    // Eliminar espacios y guiones
    const cleanCedula = cedula.replace(/[\s-]/g, '');

    // Verificar que tenga 10 dígitos
    if (!/^\d{10}$/.test(cleanCedula)) {
        return false;
    }

    // Verificar que los dos primeros dígitos estén entre 01 y 24 (provincias)
    const provincia = parseInt(cleanCedula.substring(0, 2));
    if (provincia < 1 || provincia > 24) {
        return false;
    }

    // Verificar el tercer dígito (debe ser 0-5 para personas naturales)
    const tercerDigito = parseInt(cleanCedula.substring(2, 3));
    if (tercerDigito < 0 || tercerDigito > 5) {
        return false;
    }

    // Algoritmo de validación Módulo 10
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
        v => (v && v.length >= 2) || 'El nombre debe tener al menos 2 caracteres',
        v => (v && v.length <= 100) || 'El nombre no puede exceder 100 caracteres'
    ],
    surname: [
        v => (v && v.length <= 100) || 'El apellido no puede exceder 100 caracteres'
    ],
    full_name: [
        v => !!v || 'El nombre completo es requerido',
        v => (v && v.length <= 200) || 'El nombre completo no puede exceder 200 caracteres'
    ],
    dni: [
        v => !!v || 'La identificación es requerida',
        v => (v && v.length <= 15) || 'La identificación no puede exceder 15 caracteres',
        v => validateEcuadorianCedula(v) || 'Cédula ecuatoriana inválida'
    ],
    phone: [
        v => !v || /^[0-9+\-\s()]+$/.test(v) || 'Teléfono inválido',
        v => !v || (v && v.length <= 20) || 'El teléfono no puede exceder 20 caracteres'
    ],
    email: [
        v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email inválido',
        v => !v || (v && v.length <= 150) || 'El email no puede exceder 150 caracteres'
    ],
    birth_date: [
        v => !v || !isNaN(Date.parse(v)) || 'Fecha de nacimiento inválida'
    ],
    address: [
        v => !v || (v && v.length <= 255) || 'La dirección no puede exceder 255 caracteres'
    ],
    gender: [
        v => !v || ['1', '2', '3'].includes(v) || 'El género debe ser 1 (Masculino), 2 (Femenino) o 3 (Otro)'
    ],
    position: [
        v => !v || (v && v.length <= 100) || 'El cargo no puede exceder 100 caracteres'
    ],
    salary: [
        v => !v || (v && v >= 0) || 'El salario debe ser mayor o igual a 0'
    ],
    hire_date: [
        v => !v || !isNaN(Date.parse(v)) || 'Fecha de contratación inválida'
    ],
    account_number: [
        v => !v || (v && v.length <= 50) || 'El número de cuenta no puede exceder 50 caracteres'
    ],
    bank_name: [
        v => !v || (v && v.length <= 100) || 'El nombre del banco no puede exceder 100 caracteres'
    ],
    status: [
        v => !!v || 'El estado es requerido',
        v => [1, 2].includes(v) || 'El estado debe ser 1 (Activo) o 2 (Inactivo)'
    ],
    sucursale_id: [
        v => !!v || 'La sucursal es requerida'
    ]
}

// Generar full_name automáticamente
const generateFullName = () => {
    if (employeeForm.value.name && employeeForm.value.surname) {
        employeeForm.value.full_name = `${employeeForm.value.name} ${employeeForm.value.surname}`;
    }
}

// Cargar datos del empleado
const loadEmployeeData = () => {
    if (props.employeeData && props.employeeData.id) {
        employeeForm.value = {
            ...props.employeeData,
            user_id: userStore.id,
            // Formatear fechas para input type="date"
            birth_date: props.employeeData.birth_date ? props.employeeData.birth_date.split('T')[0] : '',
            hire_date: props.employeeData.hire_date ? props.employeeData.hire_date.split('T')[0] : ''
        };
        console.log('Datos del empleado cargados:', employeeForm.value);
    }
}

// Actualizar empleado
const updateEmployee = async () => {
    const { valid } = await formRef.value?.validate();
    if (!valid) return;

    loading.value = true;
    error.value = '';
    success.value = '';

    try {
        console.log('Datos del empleado a actualizar:', employeeForm.value);

        const resp = await $api(`employees/${employeeForm.value.id}`, {
            method: "PUT",
            body: employeeForm.value,
            onResponseError({ response }) {
                if (response.status === 422) {
                    // Errores de validación del backend
                    const errors = response._data?.errors;
                    if (errors) {
                        const errorMessages = Object.values(errors).flat();
                        error.value = errorMessages.join(', ') || 'Error de validación';
                    } else {
                        error.value = response._data?.message || 'Error de validación';
                    }
                } else if (response.status === 404) {
                    error.value = response._data?.message || 'Empleado no encontrado';
                } else {
                    error.value = response._data?.message || 'Error al actualizar empleado';
                }
                console.error('Error response:', response._data);
            },
        });

        console.log('Respuesta del servidor:', resp);

        if (resp.status === 200) {
            success.value = resp.data?.message || 'Empleado actualizado exitosamente';
            showNotification(success.value, 'success');

            // Cerrar diálogo después de un momento
            setTimeout(() => {
                emit('update:isDialogVisible', false);
                // Emitir datos actualizados
                const updatedData = resp.data?.employee || employeeForm.value;
                console.log('Datos emitidos:', updatedData);
                emit('editEmployee', updatedData);
            }, 1500);
        } else {
            error.value = resp.data?.message || 'Error al actualizar empleado';
            showNotification(error.value, 'error');
        }
    } catch (error) {
        console.error('Error al actualizar empleado:', error);
        error.value = 'Error al actualizar empleado. Intente nuevamente.';
        showNotification('Error al actualizar empleado. Intente nuevamente.', 'error');
    } finally {
        loading.value = false;
    }
}

// Resetear formulario
const resetForm = () => {
    success.value = '';
    employeeForm.value = {
        id: null,
        name: '',
        surname: '',
        full_name: '',
        dni: '',
        phone: '',
        email: '',
        birth_date: '',
        address: '',
        gender: '',
        position: '',
        salary: 0,
        hire_date: '',
        account_number: '',
        bank_name: '',
        status: 1,
        user_id: 1,
        sucursale_id: 1
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

// Watch para cambios en employeeData
watch(() => props.employeeData, (newData) => {
    if (newData && newData.id) {
        loadEmployeeData();
    }
}, { immediate: true });

// Watch para generar full_name
watch(() => [employeeForm.value.name, employeeForm.value.surname], () => {
    generateFullName();
});

// Montar componente
onMounted(() => {
    success.value = '';
    employeeForm.value.user_id = userStore.id;
    if (props.employeeData && props.employeeData.id) {
        loadEmployeeData();
    }
});
</script>

<template>
    <VDialog max-width="800" v-model="props.isDialogVisible" persistent>
        <VCard class="pa-sm-10 pa-5">
            <!-- Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-user-edit-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Editar Empleado</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Actualización de datos del empleado
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="updateEmployee">
                <VRow dense>
                    <!-- Datos Personales -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Datos Personales</h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.name" label="Nombres *" placeholder="Ingrese nombres"
                            prepend-inner-icon="ri-user-3-line" :rules="rules.name" required @input="generateFullName"
                            clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.surname" label="Apellidos *" placeholder="Ingrese apellidos"
                            prepend-inner-icon="ri-user-3-line" :rules="rules.surname" required
                            @input="generateFullName" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.dni" label="DNI/Cédula de Identidad *"
                            placeholder="Ingrese DNI/Cédula" prepend-inner-icon="ri-id-card-line" :rules="rules.dni"
                            required clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.phone" label="Teléfono" placeholder="Ingrese teléfono"
                            prepend-inner-icon="ri-phone-line" :rules="rules.phone" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.email" label="Email" placeholder="Ingrese email"
                            prepend-inner-icon="ri-mail-line" :rules="rules.email" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="employeeForm.gender" :items="genderOptions" item-title="title"
                            item-value="value" label="Género" prepend-inner-icon="ri-user-settings-line"
                            placeholder="Seleccione género" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.birth_date" label="Fecha de Nacimiento" type="date"
                            prepend-inner-icon="ri-calendar-event-line" clearable />
                    </VCol>

                    <VCol cols="12">
                        <VTextField v-model="employeeForm.address" label="Dirección"
                            placeholder="Ingrese dirección completa" prepend-inner-icon="ri-map-pin-line" clearable />
                    </VCol>

                    <VDivider class="my-6" />

                    <!-- Datos Laborales -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Datos Laborales</h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.position" label="Cargo *" placeholder="Ingrese cargo"
                            prepend-inner-icon="ri-briefcase-line" :rules="rules.position" required clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.salary" label="Salario *" placeholder="0.00"
                            prepend-inner-icon="ri-money-dollar-circle-line" :rules="rules.salary" required clearable>
                            <template #append-inner>
                                <span class="text-medium-emphasis">USD</span>
                            </template>
                        </VTextField>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.hire_date" label="Fecha de Contratación" type="date"
                            prepend-inner-icon="ri-calendar-event-line" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.account_number" label="Número de Cuenta Bancaria"
                            placeholder="Número de cuenta" prepend-inner-icon="ri-bank-card-line"
                            :rules="rules.account_number" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="employeeForm.bank_name" label="Nombre del Banco"
                            placeholder="Nombre del banco" prepend-inner-icon="ri-bank-line" :rules="rules.bank_name"
                            clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="employeeForm.state" :items="statusOptions" item-title="title"
                            item-value="value" label="Estado" prepend-inner-icon="ri-toggle-line"
                            placeholder="Seleccione estado" clearable />
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
                            Actualizar Empleado
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
