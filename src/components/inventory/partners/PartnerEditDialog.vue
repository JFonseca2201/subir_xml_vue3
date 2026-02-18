<script setup>
import { ref, watch } from 'vue';
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    partnerSelected: {
        type: Object,
        required: true,
    }
});

const emit = defineEmits([
    'update:isDialogVisible',
    'updatePartner'
]);

const editMember = ref({
    email: '',
    identification: '',
    fullName: '',
    phone: '',
    address: '',
});

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
const fullNameRules = [requiredRule];
const emailRules = [emailRule];
const phoneRule = v => {
    if (!v) return 'Campo obligatorio';
    const val = String(v).trim();
    if (!/^\d{1,10}$/.test(val)) return 'Solo se permiten hasta 10 números';
    return true;
}
const phoneRules = [phoneRule];
const addressRules = [requiredRule];

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

const warning = ref(null);
const error_exist = ref(null);
const success = ref(null);
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

// Cargar datos iniciales
watch(() => props.partnerSelected, (val) => {
    if (val) {
        editMember.value = {
            email: val.email || '',
            identification: val.identification || '',
            fullName: val.name || '',
            phone: val.phone || '',
            address: val.address || '',
        };
    }
}, { immediate: true });

const onFormReset = () => {
    warning.value = null;
    error_exist.value = null;
    success.value = null;
    emit('update:isDialogVisible', false);
};

const updatePartner = async () => {
    error_exist.value = null;
    warning.value = null;
    success.value = null;
    loader.start();
    if (formRef.value && typeof formRef.value.validate === 'function') {
        const valid = await formRef.value.validate();
        if (!valid) {
            loader.stop();
            warning.value = 'Corrige los campos obligatorios.';
            return;
        }
    }
    // Validación explícita adicional
    const runFieldRules = (value, rules) => {
        for (let i = 0; i < rules.length; i++) {
            const res = rules[i](value);
            if (res !== true) return res;
        }
        return true;
    };
    const idCheck = runFieldRules(editMember.value.identification, identificationRules);
    if (idCheck !== true) {
        loader.stop();
        warning.value = typeof idCheck === 'string' ? idCheck : 'Cédula/RUC inválida';
        return;
    }
    const phoneCheck = runFieldRules(editMember.value.phone, phoneRules);
    if (phoneCheck !== true) {
        loader.stop();
        warning.value = typeof phoneCheck === 'string' ? phoneCheck : 'Teléfono no válido';
        return;
    }
    try {
        let data = {
            email: editMember.value.email,
            identification: editMember.value.identification,
            name: editMember.value.fullName,
            phone: editMember.value.phone,
            address: editMember.value.address,
        };
        console.log(data);
        const resp = await $api("partners/" + props.partnerSelected.id, {
            method: "PUT",
            body: data,
            onResponseError({ response }) {
                error_exist.value = response._data.error;
                showNotification(response._data.error, 'error');
            },
        });
        console.log(resp);
        showNotification('Socio actualizado con éxito', 'success');

        // Crear objeto del socio actualizado para actualizar la tabla
        const updatedPartner = {
            id: props.partnerSelected.id,
            identification: editMember.value.identification,
            name: editMember.value.fullName,
            email: editMember.value.email,
            phone: editMember.value.phone,
            address: editMember.value.address,
            created_at: props.partnerSelected.created_at // Mantener la fecha de creación original
        };

        // Emitir el evento para actualizar el socio en la tabla
        emit('updatePartner', updatedPartner);

        // Cerrar el diálogo después de un breve delay para mostrar el mensaje de éxito
        setTimeout(() => {
            onFormReset();
        }, 1500);

        loader.stop();
    } catch (error) {
        showNotification('Error al actualizar socio', 'error');
        loader.stop();
    } finally {
        loader.stop();
    }
};
</script>

<template>
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 720" :model-value="props.isDialogVisible"
        @update:model-value="val => emit('update:isDialogVisible', val)" transition="dialog-bottom-transition">
        <VCard class="pa-6 pa-sm-10 rounded-xl elevation-10">
            <DialogCloseBtn variant="text" size="small" class="position-absolute top-0 end-0 ma-4"
                @click="onFormReset" />
            <div class="text-center mb-8">
                <VIcon icon="ri-user-follow-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">
                    Editar socio
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Modifica los datos del socio seleccionado
                </p>
            </div>
            <VForm ref="formRef" @submit.prevent="updatePartner">
                <VRow>
                    <VCol cols="12" sm="12">
                        <VTextField v-model="editMember.identification" :rules="identificationRules"
                            label="Cédula o RUC" placeholder="Ej. 1700000001" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-user-line" hide-details="auto" required maxlength="13"
                            @input="e => { editMember.identification = e.target.value.replace(/\D/g, '').slice(0, 13) }" />
                    </VCol>
                    <VCol cols="12" sm="12">
                        <VTextField v-model="editMember.fullName" :rules="fullNameRules" label="Nombres y Apellidos"
                            placeholder="Ej. Juan Pérez" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-user-line" hide-details="auto" required />
                    </VCol>
                    <VCol cols="12" sm="6">
                        <VTextField v-model="editMember.email" :rules="emailRules" label="Correo Electrónico"
                            placeholder="ejemplo@dominio.com" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-mail-line" hide-details="auto" type="email" required />
                    </VCol>
                    <VCol cols="12" sm="6">
                        <VTextField v-model="editMember.phone" :rules="phoneRules" label="Teléfono"
                            placeholder="Ej. 0991234567" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-phone-line" hide-details="auto" type="tel" required maxlength="10"
                            @input="e => { editMember.phone = e.target.value.replace(/\D/g, '').slice(0, 10) }" />
                    </VCol>
                    <VCol cols="12">
                        <VTextField v-model="editMember.address" :rules="addressRules" label="Dirección"
                            placeholder="Ej. Calle Ficticia 123" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-map-pin-line" hide-details="auto" required />
                    </VCol>
                    <VCol cols="12" v-if="warning">
                        <VAlert color="warning" variant="tonal" closable> {{ warning }} </VAlert>
                    </VCol>
                    <VCol cols="12" v-if="error_exist">
                        <VAlert color="error" variant="tonal" closable> {{ error_exist }} </VAlert>
                    </VCol>
                    <VCol cols="12" class="d-flex justify-end gap-3 mt-4">
                        <VBtn variant="outlined" color="secondary" class="text-none px-6" @click="onFormReset">
                            <VIcon start icon="ri-close-line" />
                            Cancelar
                        </VBtn>
                        <VBtn type="submit" color="primary" variant="elevated" class="text-none px-6"
                            :loading="loader.loading" :disabled="loader.loading">
                            <VIcon start icon="ri-save-3-line" />
                            Guardar Cambios
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>
        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
