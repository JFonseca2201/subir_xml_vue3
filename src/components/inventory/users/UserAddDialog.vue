<script setup>
import { ref, onMounted, computed } from 'vue';
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    roles: {
        type: Object,
        required: true,
    },

});

const emit = defineEmits([
    'update:isDialogVisible',
    'addUser',
]);

const newUser = ref({
    name: null,
    surname: null,
    email: null,
    identification: null,
    type_document: 'CI',
    phone: null,
    address: null,
    gender: null,
    avatar: null,
    role_id: null,
    status: '1',
    sucursale_id: '1',
    password: null,
    confirmPassword: null
})


const avatarPreview = ref(null); // Para previsualización del avatar

const formRef = ref(null);

// Reglas de validación
const requiredRule = v => !!v || 'Campo obligatorio';
const emailRule = v => {
    if (!v) return 'Campo obligatorio';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(v) || 'Correo inválido';
}

const identificationRules = [

    requiredRule,
    v => {
        const val = String(v || '').trim();
        if (!/^\d{10,13}$/.test(val)) return 'Solo se permiten entre 10 y 13 números';
        return true;
    },
    v => isValidEcuadorianID(String(v || '')) || 'Cédula/RUC inválida',
];

const nameRules = [requiredRule];
const emailRules = [emailRule];
const phoneRule = v => {
    if (!v) return 'Campo obligatorio';
    const val = String(v).trim();
    if (!/^\d{1,10}$/.test(val)) return 'Solo se permiten hasta 10 números';
    return true;
}
const phoneRules = [phoneRule];
const passwordRules = [
    requiredRule,
    v => (v && v.length >= 6) || 'Mínimo 6 caracteres'
];
const confirmPasswordRules = [
    requiredRule,
    v => v === newUser.value.password || 'Las contraseñas no coinciden'
];

// Validador para cédula / RUC ecuatoriano
function isValidEcuadorianID(id) {

    if (!id) return false;
    // Solo dígitos
    if (!/^\d+$/.test(id)) return false;
    // Cédula: 10 dígitos
    if (id.length === 10) {
        const province = parseInt(id.substring(0, 2), 10);
        if (!((province >= 1 && province <= 24) || province >= 30)) return false;
        const digits = id.split('').map(Number);
        const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        let sum = 0;
        for (let i = 0; i < coef.length; i++) {
            let val = digits[i] * coef[i];
            if (val >= 10) val -= 9;
            sum += val;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === digits[9];
    }
    if (id.length === 13) {
        const rucSuffix = parseInt(id.substring(10, 13), 10);
        if (rucSuffix < 1) return false;
        return isValidEcuadorianID(id.substring(0, 10));
    }
    return false;
}

const warning = ref(null);
const error_exist = ref(null);
const loader = useLoaderStore()

// Notificaciones
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

// Función para manejar la selección de archivo
const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    
    console.log('Archivo seleccionado:', file);
    console.log('Tipo de archivo:', file?.type);
    console.log('¿Empieza con image/?', file?.type?.startsWith('image/'));
    
    // Validar que sea una imagen
    if (file && file.type && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            avatarPreview.value = e.target.result;
        };
        reader.readAsDataURL(file);
    } else if (file) {
        // Si no es una imagen, limpiar el campo y mostrar error
        warning.value = 'El archivo seleccionado no es una imagen válida. Por favor selecciona un archivo de imagen.';
        avatarPreview.value = null;
    }
};

// Función para convertir cualquier imagen a formato compatible
const convertImageToCompatibleFormat = async (file) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
                const convertedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                resolve(convertedFile);
            }, 'image/jpeg', 0.9);
        };
        
        img.src = URL.createObjectURL(file);
    });
};

// Función para manejar la limpieza del archivo
const handleAvatarClear = (file) => {
    if (!file) {
        avatarPreview.value = null;
    }
};

const store = async () => {
    error_exist.value = null;
    warning.value = null;
    loader.start();

    // Validar formulario antes de enviar
    if (formRef.value && typeof formRef.value.validate === 'function') {
        const valid = await formRef.value.validate();
        if (!valid.valid) {
            loader.stop();
            warning.value = 'Por favor, completa todos los campos obligatorios.';
            return;
        }
    }

    // Validación manual de campos requeridos
    const requiredFields = [
        { field: 'name', label: 'Nombre' },
        { field: 'surname', label: 'Apellido' },
        { field: 'email', label: 'Correo electrónico' },
        { field: 'identification', label: 'Número de documento' },
        { field: 'phone', label: 'Teléfono' },
        { field: 'role_id', label: 'Rol de usuario' },
        { field: 'status', label: 'Estado' },
        { field: 'password', label: 'Contraseña' },
        { field: 'confirmPassword', label: 'Confirmar contraseña' }
    ];

    for (const { field, label } of requiredFields) {
        if (!newUser.value[field] || (typeof newUser.value[field] === 'string' && newUser.value[field].trim() === '')) {
            loader.stop();
            warning.value = `El campo "${label}" es obligatorio`;
            return;
        }
    }

    // Validar que las contraseñas coincidan
    if (newUser.value.password !== newUser.value.confirmPassword) {
        loader.stop();
        warning.value = 'Las contraseñas no coinciden';
        return;
    }

    const runFieldRules = (value, rules) => {
        for (let i = 0; i < rules.length; i++) {
            const res = rules[i](value);
            if (res !== true) return res;
        }
        return true;
    }

    const idCheck = runFieldRules(newUser.value.identification, identificationRules);
    if (idCheck !== true) {
        loader.stop();
        warning.value = typeof idCheck === 'string' ? idCheck : 'Cédula/RUC inválida';
        return;
    }

    const phoneCheck = runFieldRules(newUser.value.phone, phoneRules);
    if (phoneCheck !== true) {
        loader.stop();
        warning.value = typeof phoneCheck === 'string' ? phoneCheck : 'Teléfono no válido';
        return;
    }

    try {
        let formData = new FormData();
        formData.append("name", newUser.value.name);
        formData.append("surname", newUser.value.surname);
        formData.append("email", newUser.value.email);
        formData.append("role_id", newUser.value.role_id);
        formData.append("sucursale_id", newUser.value.sucursale_id);
        formData.append("gender", newUser.value.gender);
        formData.append("password", newUser.value.password);
        formData.append("phone", newUser.value.phone);
        formData.append("address", newUser.value.address);
        formData.append("identification", newUser.value.identification);
        formData.append("status", newUser.value.status);
        if (newUser.value.type_document) {
            formData.append("type_document", newUser.value.type_document);
        }
        if (newUser.value.avatar) {
            // Convertir imagen a formato compatible si es necesario
            const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            
            if (!supportedFormats.includes(newUser.value.avatar.type)) {
                console.log('Convirtiendo imagen de formato:', newUser.value.avatar.type);
                try {
                    const convertedFile = await convertImageToCompatibleFormat(newUser.value.avatar);
                    formData.append("avatar", convertedFile);
                    console.log('Imagen convertida a:', convertedFile.type);
                } catch (error) {
                    console.error('Error al convertir imagen:', error);
                    warning.value = 'No se pudo convertir la imagen a un formato compatible.';
                    return;
                }
            } else {
                formData.append("avatar", newUser.value.avatar);
            }
        }

        const resp = await $api("users", {
            method: "POST",
            body: formData,
            onResponseError({ response }) {
                console.error('Error completo del backend:', response);
                console.error('Data del error:', response._data);
                console.error('Status:', response.status);
                console.error('StatusText:', response.statusText);
                console.error('Errors específicos:', response._data?.errors);

                // Extraer mensaje de error de forma más robusta
                let errorMessage = 'Error desconocido';

                if (response._data) {
                    // Manejar errores específicos de base de datos
                    if (response._data.message && response._data.message.includes('SQLSTATE[23000]')) {
                        if (response._data.message.includes('users_identification_unique')) {
                            errorMessage = 'La cédula de identidad ya esta registrada.';
                        } else if (response._data.message.includes('users_email_unique')) {
                            errorMessage = 'El correo electrónico ya esta registrado.';
                        } else {
                            errorMessage = 'Registro duplicado. El dato ya existe en el sistema.';
                        }
                    } else if (response._data.message && response._data.message.includes('avatar')) {
                        // Errores específicos del avatar
                        errorMessage = 'El archivo de avatar no es válido. Debe ser una imagen (JPG, PNG, GIF).';
                    } else if (response._data.errors) {
                        // Errores de validación Laravel
                        const firstErrorKey = Object.keys(response._data.errors)[0];
                        if (firstErrorKey) {
                            errorMessage = response._data.errors[firstErrorKey][0];
                        }
                    } else {
                        errorMessage = response._data.error ||
                            response._data.message ||
                            response._data.msg ||
                            JSON.stringify(response._data);
                    }
                } else if (response.statusText) {
                    errorMessage = response.statusText;
                } else if (response.status) {
                    errorMessage = `Error HTTP ${response.status}`;
                }

                error_exist.value = errorMessage;
            },
        });

        showNotification('Usuario creado con éxito', 'success');

        const user = {
            id: resp.user.id,
            name: newUser.value.name.toUpperCase() + ' ' + newUser.value.surname.toUpperCase(),
            email: newUser.value.email,
            identification: newUser.value.identification,
            phone: newUser.value.phone,
            role: { name: props.roles.find(r => r.id === newUser.value.role_id)?.name || 'Usuario' },
            role_id: newUser.value.role_id,
            status: newUser.value.status,
            sucursale: { name: 'Sucursal Principal' },
            sucursale_id: newUser.value.sucursale_id,
            address: newUser.value.address.toUpperCase(),
            created_at: resp.user.created_at
        };

        emit('addUser', user);

        setTimeout(() => {
            onFormReset();
        }, 500);
    } catch (error) {
        console.error('Error al crear usuario:', error);
        showNotification('Error al crear usuario', 'error');
    } finally {
        loader.stop();
    }
}

const onFormReset = () => {
    newUser.value = {
        name: null,
        surname: null,
        email: null,
        identification: null,
        type_document: 'CI',
        phone: null,
        address: null,
        gender: null,
        avatar: null,
        role_id: null,
        status: '1',
        sucursale_id: '1',
        password: null,
        confirmPassword: null
    };
    // Limpiar también la previsualización del avatar
    avatarPreview.value = null;
    warning.value = null;
    error_exist.value = null;
    emit('update:isDialogVisible', false)
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
                <VIcon icon="ri-user-add-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Crear nuevo usuario
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Completa los datos del nuevo usuario para registrarlo en el sistema
                </p>
            </div>

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="store">
                <VRow>
                    <!-- Nombre y Apellido -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newUser.name" :rules="nameRules" label="Nombre" placeholder="Ej. Juan"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line"
                            hide-details="auto" required />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VTextField v-model="newUser.surname" :rules="nameRules" label="Apellido"
                            placeholder="Ej. Pérez" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-user-line" hide-details="auto" required />
                    </VCol>

                    <!-- Correo y Teléfono -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newUser.email" :rules="emailRules" label="Correo Electrónico"
                            placeholder="ejemplo@dominio.com" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-mail-line" hide-details="auto" type="email" required />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VTextField v-model="newUser.phone" :rules="phoneRules" label="Teléfono"
                            placeholder="Ej. 0991234567" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-phone-line" hide-details="auto" type="tel" required maxlength="10"
                            @input="e => { newUser.phone = e.target.value.replace(/\D/g, '').slice(0, 10) }" />
                    </VCol>

                    <!-- Tipo de Documento y Número de Documento -->
                    <VCol cols="12" sm="6">
                        <VSelect v-model="newUser.type_document" :items="[
                            { title: 'Cédula', value: 'CI' },
                            { title: 'RUC', value: 'RUC' },
                            { title: 'Pasaporte', value: 'PASS' }
                        ]" label="Tipo de Documento" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-file-list-line" hide-details="auto" required />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VTextField v-model="newUser.identification" :rules="identificationRules"
                            label="Número de Documento" placeholder="Ej. 1700000001" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-user-line" hide-details="auto" required
                            maxlength="13"
                            @input="e => { newUser.identification = e.target.value.replace(/\D/g, '').slice(0, 13) }" />
                    </VCol>

                    <!-- Dirección (toda la fila) -->
                    <VCol cols="12">
                        <VTextField v-model="newUser.address" label="Dirección" placeholder="Ej. Calle Abc 123"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-map-pin-line"
                            hide-details="auto" />
                    </VCol>

                    <!-- Género y Rol -->
                    <VCol cols="12" sm="6">
                        <VSelect v-model="newUser.gender" :items="[
                            { title: 'Masculino', value: 'M' },
                            { title: 'Femenino', value: 'F' },
                            { title: 'Otro', value: 'O' }
                        ]" label="Género" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-men-women-line" hide-details="auto" />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VSelect :items="props.roles" item-title="name" item-value="id" v-model="newUser.role_id"
                            density="comfortable" variant="outlined" label="Rol de usuario" placeholder="Selecciona"
                            prepend-inner-icon="ri-shield-user-line" eager outlined dense required />
                    </VCol>

                    <!-- Avatar y Previsualización -->
                    <VCol cols="12" sm="6">
                        <VFileInput v-model="newUser.avatar" label="Avatar" accept="image/*" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-image-line" hide-details="auto" show-size
                            @change="handleAvatarChange" @update:model-value="handleAvatarClear" />


                    </VCol>
                    <VCol cols="12" sm="6">
                        <!-- Previsualización siempre en el mismo espacio -->
                        <div v-if="avatarPreview" class="text-center d-flex flex-column align-center mt-3">
                            <VAvatar :image="avatarPreview" size="50" class="elevation-3 mb-1" />
                            <div class="text-caption text-medium-emphasis"> {{ newUser.name }}</div>
                        </div>
                    </VCol>

                </VRow>
                <VRow>
                    <!-- Validación de avatar -->
                    <VCol cols="12" v-if="newUser.avatar && !newUser.avatar.type?.startsWith('image/')">
                        <VAlert color="error" variant="tonal" closable>
                            El archivo seleccionado no es una imagen válida. Por favor selecciona un archivo de imagen
                            (JPG, PNG, GIF, etc.).
                        </VAlert>
                    </VCol>
                </VRow>
                <VRow>
                    <!-- Contraseña y Confirmar Contraseña (siempre en la misma posición) -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newUser.password" :rules="passwordRules" label="Contraseña"
                            placeholder="Mínimo 6 caracteres" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-lock-line" hide-details="auto" type="password" required />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VTextField v-model="newUser.confirmPassword" :rules="confirmPasswordRules"
                            label="Confirmar Contraseña" placeholder="Repite la contraseña" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-lock-line" hide-details="auto" type="password"
                            required />
                    </VCol>
                </VRow>
                <VRow>
                    <!-- Alertas de Error/Éxito -->
                    <VCol cols="12" v-if="warning">
                        <VAlert color="warning" variant="tonal" closable> {{ warning }}</VAlert>
                    </VCol>

                    <VCol cols="12" v-if="error_exist">
                        <VAlert color="error" variant="tonal" closable> {{ error_exist }}</VAlert>
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
                            Crear Usuario
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>

        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
