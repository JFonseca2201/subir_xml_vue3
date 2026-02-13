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
})

const warning = ref(null);
const error_exist = ref(null);
const success = ref(null);
const loader = useLoaderStore()


const store = async () => {
    error_exist.value = null;
    success.value = null;
    loader.start();
    try {

        let data = {
            email: newMember.value.email,
            identification: newMember.value.identification,
            name: newMember.value.firstName + " " + newMember.value.lastName,
            phone: newMember.value.phone,
        }
        console.log(data)

        const resp = await $api("partners", {
            method: "POST",
            body: data,
            onResponseError({ response }) {
                error_exist.value = response._data.error;
                warning.value = 'No se pudo ingresar el socio.';
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
        email: null,
        identification: null,
        firstName: null,
        lastName: null,
        phone: null,
        address: null,
    };
    warning.value = null;
    error_exist.value = null;
    success.value = null;
    emit('update:isDialogVisible', false)
};
</script>
<template>
    <VDialog :width="$vuetify.display.smAndDown ? 'auto' : 720" :model-value="props.isDialogVisible"
        @update:model-value="props.isDialogVisible" transition="dialog-bottom-transition">
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
            <VForm @submit.prevent="store">
                <VRow>
                    <!-- Cédula o RUC -->
                    <VCol cols="12" sm="12">
                        <VTextField v-model="newMember.identification" label="Cédula o RUC" placeholder="Ej. 1700000001"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line" hide-details
                            required />
                    </VCol>
                    <!-- Nombre -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newMember.firstName" label="Nombre" placeholder="Ej. Juan"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line" hide-details
                            required />
                    </VCol>

                    <!-- Apellido -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newMember.lastName" label="Apellido" placeholder="Ej. Pérez"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line" hide-details
                            required />
                    </VCol>

                    <!-- Correo Electrónico -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newMember.email" label="Correo Electrónico"
                            placeholder="ejemplo@dominio.com" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-mail-line" hide-details type="email" required />
                    </VCol>

                    <!-- Teléfono -->
                    <VCol cols="12" sm="6">
                        <VTextField v-model="newMember.phone" label="Teléfono" placeholder="Ej. +593 99 123 4567"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-phone-line" hide-details
                            type="tel" required />
                    </VCol>

                    <!-- Dirección -->
                    <VCol cols="12">
                        <VTextField v-model="newMember.address" label="Dirección" placeholder="Ej. Calle Ficticia 123"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-map-pin-line" hide-details
                            required />
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