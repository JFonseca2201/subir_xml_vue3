<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import NotificationToast from '@/components/common/NotificationToast.vue'

const loader = useLoaderStore()

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(["update:isDialogVisible", "addUnit"]);
const name = ref(null);
const description = ref(null);
const warning = ref(null);
const error_exits = ref(null);
const success = ref(null);

// Variables para NotificationToast
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message;
  notificationType.value = type;
  notificationShow.value = true;
};

const store = async () => {
  warning.value = null;
  error_exits.value = null;
  success.value = null;
  loader.start();

  if (!name.value) {
    setTimeout(() => {
      warning.value = "Se debe llenar un nombre para la unidad";
    }, 50);
    loader.stop();
    return;
  }

  let data = {
    name: name.value,
    description: description.value,
    state: 1,
  };

  console.log('Data a enviar:', data);

  try {
    const resp = await $api("units", {
      method: "POST",
      body: data,
      onResponseError({ response }) {
        console.log('Error completo:', response._data);
        console.log('Errors específicos:', response._data.errors);
        error_exits.value = response._data.error;
      },
    });
    console.log(resp);
    if (resp.message == 403) {
      error_exits.value = resp.message_text;
      showNotification('Error de permisos', 'error');
    } else {
      success.value = "La unidad se ha registrado correctamente";
      showNotification('Unidad registrada correctamente', 'success');
      emit("addUnit", resp.unit);
      name.value = null;
      description.value = null;
      warning.value = null;
      error_exits.value = null;
      success.value = null;
      onFormReset();
    }
  } catch (error) {
    console.log(error);
    showNotification('Error al registrar unidad', 'error');
    loader.stop();
  } finally {
    loader.stop();
  }
};

const onFormReset = () => {
  name.value = null;
  description.value = null;
  warning.value = null;
  error_exits.value = null;
  success.value = null;
  emit("update:isDialogVisible", false);
};

const dialogVisibleUpdate = (val) => {
  emit("update:isDialogVisible", val);
};
</script>

<template>
  <VDialog max-width="500" :model-value="props.isDialogVisible" @update:model-value="dialogVisibleUpdate" persistent>
    <VCard class="pa-sm-10 pa-5">
      <!-- 👉 Botón cerrar -->
      <DialogCloseBtn variant="text" size="default" @click="onFormReset" />

      <!-- 👉 Header -->
      <VCardText class="text-center pb-6">
        <VIcon icon="ri-ruler-line" size="42" color="primary" class="mb-3" />
        <h4 class="text-h4 font-weight-bold mb-1">Nueva Unidad</h4>
        <p class="text-body-2 text-medium-emphasis">
          Agrega una nueva unidad de medida
        </p>
      </VCardText>

      <VDivider class="mb-6" />

      <!-- 👉 Form -->
      <VForm @submit.prevent="store">
        <VRow dense>
          <!-- Nombre -->
          <VCol cols="12">
            <VTextField v-model="name" label="Nombre de la unidad" placeholder="ej. Kilogramos, Litros, Unidades"
              variant="outlined" density="comfortable" prepend-inner-icon="ri-ruler-line" hide-details="auto"
              required />
          </VCol>

          <!-- Descripción -->
          <VCol cols="12">
            <VTextarea v-model="description" label="Descripción"
              placeholder="ej. Unidad de medida para peso, volumen, etc." variant="outlined" density="comfortable"
              prepend-inner-icon="ri-file-text-line" hide-details="auto" rows="3" />
          </VCol>

          <!-- Alertas -->
          <VCol cols="12" v-if="warning">
            <VAlert color="warning" variant="tonal" closable>
              {{ warning }}
            </VAlert>
          </VCol>

          <VCol cols="12" v-if="error_exits">
            <VAlert color="error" variant="tonal" closable>
              {{ error_exits }}
            </VAlert>
          </VCol>

          <VCol cols="12" v-if="success">
            <VAlert color="success" variant="tonal" closable>
              {{ success }}
            </VAlert>
          </VCol>

          <VDivider class="my-6" />

          <!-- 👉 Actions -->
          <VCol cols="12" class="d-flex justify-center gap-4">
            <VBtn type="submit" color="primary" prepend-icon="ri-save-3-line" :loading="loader.loading"
              :disabled="loader.loading">
              Guardar
            </VBtn>

            <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" @click="onFormReset"
              :disabled="loader.loading">
              Cancelar
            </VBtn>
          </VCol>
        </VRow>
      </VForm>
    </VCard>
  </VDialog>

  <!-- NotificationToast -->
  <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>
