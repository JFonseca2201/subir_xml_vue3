<script setup>
import { ref } from 'vue';
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
});

const emit = defineEmits([
    'update:isDialogVisible',
    /* 'addRole' */
]);

const newMember = ref({
    email: '',
    identification: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
})

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
const firstNameRules = [requiredRule];
const lastNameRules = [requiredRule];
const emailRules = [emailRule];
// Validación: solo números y máximo 10 dígitos
const phoneRule = v => {
    if (!v) return 'Campo obligatorio';
    const val = String(v).trim();
    if (!/^\d{1,10}$/.test(val)) return 'Solo se permiten hasta 10 números';
    return true;
}
const phoneRules = [phoneRule];
const addressRules = [requiredRule];

// Validador para cédula / RUC ecuatoriano
function isValidEcuadorianID(id) {
    if (!id) return false;
    // Solo dígitos
    if (!/^\d+$/.test(id)) return false;
    // Cédula: 10 dígitos
    if (id.length === 10) {
        const province = parseInt(id.substring(0, 2), 10);
        // Permitir provincias 01-24 (nacional) o >=30 (especial/extranjero)
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
    // RUC natural: 13 dígitos y los 10 primeros forman una cédula válida y los últimos 3 >= 001
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
const loader = useLoaderStore()


const store = async () => {
    error_exist.value = null;
    warning.value = null;
    success.value = null;
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
    // Validación explícita adicional para asegurarnos que la cédula/ruc es válida
    const runFieldRules = (value, rules) => {
        for (let i = 0; i < rules.length; i++) {
            const res = rules[i](value);
            if (res !== true) return res;
        }
        return true;
    }
    const idCheck = runFieldRules(newMember.value.identification, identificationRules);
    if (idCheck !== true) {
        loader.stop();
        warning.value = typeof idCheck === 'string' ? idCheck : 'Cédula/RUC inválida';
        return;
    }
    const phoneCheck = runFieldRules(newMember.value.phone, phoneRules);
    if (phoneCheck !== true) {
        loader.stop();
        warning.value = typeof phoneCheck === 'string' ? phoneCheck : 'Teléfono no válido';
        return;
    }
    try {

        let data = {
            email: newMember.value.email,
            identification: newMember.value.identification,
            name: newMember.value.firstName + " " + newMember.value.lastName,
            phone: newMember.value.phone,
            address: newMember.value.address,
        }
        console.log(data)

        const resp = await $api("partners", {
            method: "POST",
            body: data,
            onResponseError({ response }) {
                error_exist.value = response._data.error;
                //warning.value = 'No se pudo ingresar el socio.';
            },
        });
        console.log(resp);
        success.value = "Socio ingresado con éxito"
        loader.stop();

    } catch (error) {
        console.log(error);
        error_exist.value = "Error al ingresar soscio"
        loader.stop();
    }
    finally {
        loader.stop();
    }

};

const onFormReset = () => {
    newMember.value = {
        email: '',
        identification: '',
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
    };
    warning.value = null;
    error_exist.value = null;
    success.value = null;
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
                    Ingreso de nuevo socio
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                    Completa los datos del nuevo socio para registrarlo en el sistema
                </p>
            </div>

            <!-- Form -->
            <VForm ref="formRef" @submit.prevent="store">
                <VRow>
                    <!-- Cédula o RUC -->
                    <VCol cols="12" sm="12">
                        <VTextField v-model="newMember.identification" :rules="identificationRules" label="Cédula o RUC"
                            placeholder="Ej. 1700000001" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-user-line" hide-details="auto" required maxlength="13"
                            @input="e => { newMember.identification = e.target.value.replace(/\D/g, '').slice(0, 13) }"
                            closable />
                    </VCol>
                    <!-- Nombre -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newMember.firstName" :rules="firstNameRules" label="Nombre"
                            placeholder="Ej. Juan" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-user-line" hide-details="auto" required closable />
                    </VCol>

                    <!-- Apellido -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newMember.lastName" :rules="lastNameRules" label="Apellido"
                            placeholder="Ej. Pérez" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-user-line" hide-details="auto" required closable />
                    </VCol>

                    <!-- Correo Electrónico -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newMember.email" :rules="emailRules" label="Correo Electrónico"
                            placeholder="ejemplo@dominio.com" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-mail-line" hide-details="auto" type="email" required />
                    </VCol>

                    <!-- Teléfono -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newMember.phone" :rules="phoneRules" label="Teléfono"
                            placeholder="Ej. 0991234567" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-phone-line" hide-details="auto" type="tel" required maxlength="10"
                            @input="e => { newMember.phone = e.target.value.replace(/\D/g, '').slice(0, 10) }" />
                    </VCol>

                    <!-- Dirección -->
                    <VCol cols="12">
                        <VTextField v-model="newMember.address" :rules="addressRules" label="Dirección"
                            placeholder="Ej. Calle Ficticia 123" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-map-pin-line" hide-details="auto" required />
                    </VCol>



                    <!-- Alertas de Error/Éxito -->
                    <VCol cols="12" v-if="warning">
                        <VAlert color="warning" variant="tonal" closable> {{ warning }}</VAlert>
                    </VCol>
                    <VCol cols="12" v-if="error_exist">
                        <VAlert color="error" variant="tonal" closable> {{ error_exist }}</VAlert>
                    </VCol>
                    <VCol cols="12" v-if="success">
                        <VAlert color="success" variant="tonal" closable> {{ success }}</VAlert>
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
                            Guardar Socio
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>

        </VCard>
    </VDialog>
</template>



<style>
.permissions-table {
    border-radius: 12px;
    overflow: hidden;
}

.permissions-row {
    border-bottom: 1px solid rgba(150, 11, 11, 0.06);
}

.permissions-row:last-child {
    border-bottom: none;
}

.module-cell {
    width: 260px;
}

.module-name {
    font-weight: 600;
    font-size: 1rem;
}

.module-subtitle {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.55);
    margin-top: 4px;
}

.permissions-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 14px;
}

.permission-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    background-color: rgba(0, 0, 0, 0.03);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.permission-chip:hover {
    background-color: rgba(0, 0, 0, 0.07);
}
</style>