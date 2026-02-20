<script setup>
import { ref, watch, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    userSelected: {
        type: Object,
        required: true,
    },
    roles: {
        type: Array,
        required: true,
    },
})

const emit = defineEmits([
    'update:isDialogVisible',
    'editUser',
])

const loader = useLoaderStore()
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message
    notificationType.value = type
    notificationShow.value = true
}

/* ======================================================
   🔥 ESTADO
====================================================== */

const editUser = ref({
    id: null,
    name: '',
    surname: '',
    email: '',
    identification: '',
    type_document: 'CI',
    phone: '',
    address: '',
    gender: null,
    avatar: null,
    role: null,
    status: '1',
    sucursale_id: null, // Cambiado de '1' a null para evitar el error
    password: null,
    confirmPassword: null,
})

const avatarPreview = ref(null)
const formRef = ref(null)
const originalAvatar = ref(null)
const warning = ref(null)
const error_exist = ref(null)

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
    v => !v || v.length >= 6 || 'Mínimo 6 caracteres'
];
const confirmPasswordRules = [
    v => !editUser.value.password || v === editUser.value.password || 'Las contraseñas no coinciden'
];

// Validador para cédula / RUC ecuatoriano
function isValidEcuadorianID(id) {
    if (!id) return false;
    if (!/^\d+$/.test(id)) return false;
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

// Función para manejar la limpieza del archivo
const handleAvatarClear = (file) => {
    if (!file) {
        avatarPreview.value = null;
        editUser.value.avatar = null;
    }
};

/* ======================================================
   🔥 COMPUTED NOMBRE DEL ROL
====================================================== */

const selectedRoleName = computed(() => {
    return editUser.value.role?.name || ''
})

/* ======================================================
   🔥 CARGAR DATOS DEL USUARIO
====================================================== */

const loadUserData = () => {
    if (!props.userSelected || !props.roles?.length) return

    // Buscar el objeto rol completo
    const selectedRole = props.roles.find(
        r => Number(r.id) === Number(props.userSelected.role_id)
    )

    editUser.value = {
        id: props.userSelected.id,
        name: props.userSelected.name || '',
        surname: props.userSelected.surname || '',
        email: props.userSelected.email || '',
        identification: props.userSelected.identification || '',
        type_document: props.userSelected.type_document || 'CI',
        phone: props.userSelected.phone || '',
        address: props.userSelected.address || '',
        gender: props.userSelected.gender || null,
        avatar: null,
        role: selectedRole || null,
        status: props.userSelected.status?.toString() || '1',
        sucursale_id: props.userSelected.sucursale_id || '1',
        password: null,
        confirmPassword: null,
    }

    // Guardar avatar original y establecer previsualización
    originalAvatar.value = props.userSelected.avatar
    if (props.userSelected.avatar) {
        const avatarUrl = props.userSelected.avatar.startsWith('http')
            ? props.userSelected.avatar
            : `http://127.0.0.1:8000/storage/${props.userSelected.avatar}`
        avatarPreview.value = avatarUrl
    } else {
        avatarPreview.value = null
    }
}

watch(() => props.userSelected, loadUserData, { immediate: true })
watch(() => props.isDialogVisible, val => {
    if (val) loadUserData()
})

/* ======================================================
   🔥 UPDATE
====================================================== */

const update = async () => {
    loader.start()

    try {
        const formData = new FormData()
        formData.append("_method", "PUT")
        formData.append("id", editUser.value.id)
        formData.append("name", editUser.value.name)
        formData.append("surname", editUser.value.surname)
        formData.append("email", editUser.value.email)
        formData.append("identification", editUser.value.identification)
        formData.append("phone", editUser.value.phone)
        formData.append("address", editUser.value.address)
        formData.append("status", editUser.value.status)
        formData.append("type_document", editUser.value.type_document)
        formData.append("role_id", editUser.value.role?.id || '')

        if (editUser.value.password) {
            formData.append("password", editUser.value.password)
        }

        const resp = await $api(`users/${editUser.value.id}`, {
            method: "POST",
            body: formData,
        })

        const updatedUser = {
            ...resp.user,
            role: editUser.value.role?.name || 'Usuario'
        }

        emit('editUser', updatedUser)
        emit('update:isDialogVisible', false)
        showNotification('Usuario actualizado con éxito', 'success')

    } catch (error) {
        console.error(error)
        showNotification('Error al actualizar usuario', 'error')
    } finally {
        loader.stop()
    }
}

/* ======================================================
   🔥 RESET
====================================================== */

const onFormReset = () => {
    editUser.value = {
        id: null,
        name: '',
        surname: '',
        email: '',
        identification: '',
        type_document: 'CI',
        phone: '',
        address: '',
        gender: null,
        avatar: null,
        role: null,
        status: '1',
        sucursale_id: '1',
        password: null,
        confirmPassword: null,
    }

    avatarPreview.value = null
    originalAvatar.value = null
    emit('update:isDialogVisible', false)
}
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
                <VIcon icon="ri-user-follow-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Editar usuario
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Modifica los datos del usuario seleccionado
                </p>
            </div>

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="update">
                <VRow>
                    <!-- Nombre y Apellido -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="editUser.name" :rules="nameRules" label="Nombre" placeholder="Ej. Juan"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line"
                            hide-details="auto" required />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VTextField v-model="editUser.surname" :rules="nameRules" label="Apellido"
                            placeholder="Ej. Pérez" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-user-line" hide-details="auto" required />
                    </VCol>

                    <!-- Correo y Teléfono -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="editUser.email" :rules="emailRules" label="Correo Electrónico"
                            placeholder="ejemplo@dominio.com" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-mail-line" hide-details="auto" type="email" required />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VTextField v-model="editUser.phone" :rules="phoneRules" label="Teléfono"
                            placeholder="Ej. 0991234567" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-phone-line" hide-details="auto" type="tel" required maxlength="10"
                            @input="e => { editUser.phone = e.target.value.replace(/\D/g, '').slice(0, 10) }" />
                    </VCol>

                    <!-- Tipo de Documento y Número de Documento -->
                    <VCol cols="12" sm="6">
                        <VSelect v-model="editUser.type_document" :items="[
                            { title: 'Cédula', value: 'CI' },
                            { title: 'RUC', value: 'RUC' },
                            { title: 'Pasaporte', value: 'PASS' }
                        ]" label="Tipo de Documento" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-file-list-line" hide-details="auto" required />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VTextField v-model="editUser.identification" :rules="identificationRules"
                            label="Número de Documento" placeholder="Ej. 1700000001" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-user-line" hide-details="auto" required
                            maxlength="13"
                            @input="e => { editUser.identification = e.target.value.replace(/\D/g, '').slice(0, 13) }" />
                    </VCol>

                    <!-- Dirección (toda la fila) -->
                    <VCol cols="12">
                        <VTextField v-model="editUser.address" label="Dirección" placeholder="Ej. Calle Abc 123"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-map-pin-line"
                            hide-details="auto" />
                    </VCol>

                    <!-- Género y Rol -->
                    <VCol cols="12" sm="6">
                        <VSelect v-model="editUser.gender" :items="[
                            { title: 'Masculino', value: 'M' },
                            { title: 'Femenino', value: 'F' },
                            { title: 'Otro', value: 'O' }
                        ]" label="Género" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-men-women-line" hide-details="auto" />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VSelect v-model="editUser.role" :items="props.roles" item-title="name" item-value="id"
                            return-object label="Rol de usuario" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-shield-user-line" />
                    </VCol>

                    <!-- Status -->
                    <VCol cols="12" sm="6">
                        <VSelect v-model="editUser.status" :items="[
                            { title: 'Activo', value: '1' },
                            { title: 'Inactivo', value: '0' }
                        ]" label="Estado" variant="outlined" density="comfortable" prepend-inner-icon="ri-toggle-line"
                            hide-details="auto" required />
                    </VCol>

                    <!-- <div v-if="selectedRoleName" class="text-caption text-medium-emphasis mt-1">
                        Rol actual: {{ selectedRoleName }}
                    </div> -->

                    <!-- Avatar y Previsualización -->
                    <VCol cols="12" sm="6">
                        <VFileInput v-model="editUser.avatar" label="Avatar (Opcional)" accept="image/*"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-image-line"
                            hide-details="auto" show-size @change="handleAvatarChange"
                            @update:model-value="handleAvatarClear" />
                    </VCol>
                    <VCol cols="12" sm="6">
                        <!-- Previsualización siempre en el mismo espacio -->
                        <div v-if="avatarPreview" class="text-center d-flex flex-column align-center mt-3">
                            <VAvatar :image="avatarPreview" size="50" class="elevation-3 mb-1" />
                            <div class="text-caption text-medium-emphasis"> {{ editUser.name }}</div>
                        </div>
                    </VCol>

                </VRow>
                <VRow>
                    <!-- Validación de avatar -->
                    <VCol cols="12" v-if="editUser.avatar && !editUser.avatar.type?.startsWith('image/')">
                        <VAlert color="error" variant="tonal" closable>
                            El archivo seleccionado no es una imagen válida. Por favor selecciona un archivo de imagen
                            (JPG, PNG, GIF, etc.).
                        </VAlert>
                    </VCol>
                </VRow>
                <VRow>
                    <!-- Contraseña y Confirmar Contraseña (opcional) -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="editUser.password" :rules="passwordRules" label="Contraseña (Opcional)"
                            placeholder="Dejar en blanco para no cambiar" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-lock-line" hide-details="auto" type="password" />
                    </VCol>

                    <VCol cols="12" sm="6">
                        <VTextField v-model="editUser.confirmPassword" :rules="confirmPasswordRules"
                            label="Confirmar Contraseña" placeholder="Repite la contraseña si la cambias"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-lock-line"
                            hide-details="auto" type="password" />
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
                            Actualizar Usuario
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>

        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
