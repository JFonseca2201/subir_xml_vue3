<script setup>
import { useLoaderStore } from '@/stores/loader';
const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    roleSelected: {
        type: Object,
        required: true,
    },
});

const loader = useLoaderStore();

const emit = defineEmits(["update:isDialogVisible", "deleteRole"]);
const warning = ref(null);
const error_exits = ref(null);
const success = ref(null);

const deleteRol = async () => {
    loader.start();
    warning.value = null;
    error_exits.value = null;
    success.value = null;
    try {
        const resp = await $api("role/" + props.roleSelected.id, {
            method: "DELETE",
            onResponseError({ response }) {
                error_exits.value = response._data.error;
            },
        });
        console.log(resp);
        emit("deleteRole", props.roleSelected);
        onFormReset();
    } catch (error) {
        console.log(error);
    } finally {
        loader.stop();
    }
};

onMounted(() => {
    console.log(props.roleSelected);
});

const onFormSubmit = () => {
    emit("update:isDialogVisible", false);
    emit("submit", userData.value);
};

const onFormReset = () => {
    emit("update:isDialogVisible", false);
};

const dialogVisibleUpdate = (val) => {
    emit("update:isDialogVisible", val);
};
</script>

<template>
    <VDialog :model-value="props.isDialogVisible" max-width="520" persistent @update:model-value="dialogVisibleUpdate">
        <VCard class="pa-6">
            <!-- Close -->
            <DialogCloseBtn variant="text" size="small" @click="onFormReset" />

            <!-- Header -->
            <VCardText class="pb-4">
                <div class="d-flex align-center gap-2 mb-1">
                    <VIcon icon="ri-delete-bin-line" size="20" class="text-medium-emphasis" />
                    <h4 class="text-h5 font-weight-medium">
                        Eliminar rol
                    </h4>
                </div>

                <p class="text-body-2 text-medium-emphasis">
                    Esta acción no se puede deshacer.
                </p>
            </VCardText>

            <!-- Body -->
            <VCardText>
                <p class="mb-4 d-flex align-center gap-2">
                    <VIcon icon="ri-alert-line" size="18" class="text-medium-emphasis" />
                    ¿Deseas eliminar el rol
                    <strong>{{ props.roleSelected.name }}</strong>?
                </p>

                <!-- Alerts -->
                <VAlert v-if="warning" type="warning" variant="outlined" density="compact" class="mb-3">
                    <VIcon start icon="ri-information-line" />
                    {{ warning }}
                </VAlert>

                <VAlert v-if="error_exits" type="error" variant="outlined" density="compact" class="mb-3">
                    <VIcon start icon="ri-close-circle-line" />
                    {{ error_exits }}
                </VAlert>

                <VAlert v-if="success" type="success" variant="outlined" density="compact" class="mb-3">
                    <VIcon start icon="ri-check-line" />
                    {{ success }}
                </VAlert>

                <!-- Actions -->
                <div class="d-flex justify-end gap-3 mt-6">
                    <VBtn variant="text" :disabled="loader.loading" @click="onFormReset">
                        <VIcon start icon="ri-close-line" />
                        Cancelar
                    </VBtn>

                    <VBtn color="error" variant="outlined" :loading="loader.loading" @click="deleteRol">
                        <VIcon start icon="ri-delete-bin-line" />
                        Eliminar
                    </VBtn>
                </div>
            </VCardText>
        </VCard>
    </VDialog>
</template>
