<script setup>
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(["update:isDialogVisible", "addCategorie"]);
const name = ref(null);
const FILE_IMAGEN = ref(null);
const PREVIZUALIZA_IMAGEN = ref(null);
const warning = ref(null);
const error_exits = ref(null);
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

const store = async () => {
  warning.value = null;
  error_exits.value = null;
  success.value = null;
  if (!name.value) {
    setTimeout(() => {
      warning.value = "Se debe llenar un nombre para la categoria";
    }, 50);
    return;
  }
  if (!FILE_IMAGEN.value) {
    setTimeout(() => {
      warning.value = "Se debe subir una imagen para la categoria";
    }, 50);
    return;
  }

  loader.start();

  let formData = new FormData();
  formData.append("title", name.value);
  formData.append("image", FILE_IMAGEN.value);
  formData.append("state", 1);
  try {
    const resp = await $api("categories", {
      method: "POST",
      body: formData,
      onResponseError({ response }) {
        error_exits.value = response._data.error;
      },
    });
    console.log(resp);
    if (resp.message == 403) {
      error_exits.value = resp.message_text;
      showNotification(resp.message_text, 'error');
    } else {
      success.value = "La categoria se ha registrado correctamente";
      showNotification("La categoría se ha registrado correctamente", 'success');
      emit("addCategorie", resp.categorie);
      name.value = null;
      FILE_IMAGEN.value = null;
      PREVIZUALIZA_IMAGEN.value = null;
      warning.value = null;
      error_exits.value = null;
      success.value = null;
      onFormReset();
    }
  } catch (error) {
    console.log(error);
    showNotification('Error al registrar la categoría', 'error');
  } finally {
    loader.stop();
  }
};

const loadFile = ($event) => {
  if ($event.target.files[0].type.indexOf("image") < 0) {
    error_exits.value = "SOLAMENTE PUEDEN SER ARCHIVOS DE TIPO IMAGEN";
    return;
  }
  error_exits.value = "";
  FILE_IMAGEN.value = $event.target.files[0];
  let reader = new FileReader();
  reader.readAsDataURL(FILE_IMAGEN.value);
  reader.onloadend = () => (PREVIZUALIZA_IMAGEN.value = reader.result);
};

const clearImage = () => {
  FILE_IMAGEN.value = null;
  PREVIZUALIZA_IMAGEN.value = null;
  error_exits.value = "";
};

const onFormSubmit = () => {
  emit("update:isDialogVisible", false);
  emit("submit", userData.value);
};

const onFormReset = () => {
  name.value = null;
  FILE_IMAGEN.value = null;
  PREVIZUALIZA_IMAGEN.value = null;

  emit("update:isDialogVisible", false);
};

const dialogVisibleUpdate = (val) => {
  emit("update:isDialogVisible", val);
};
</script>

<template>
  <VDialog max-width="650" :model-value="props.isDialogVisible" @update:model-value="dialogVisibleUpdate" persistent>
    <VCard class="pa-sm-10 pa-5">
      <!-- 👉 Botón cerrar -->
      <DialogCloseBtn variant="text" size="default" @click="onFormReset" />

      <!-- 👉 Header -->
      <VCardText class="text-center pb-6">
        <VIcon icon="ri-file-chart-line" size="42" color="primary" class="mb-3" />
        <h4 class="text-h4 font-weight-bold mb-1">Nueva Categoría</h4>
        <p class="text-body-2 text-medium-emphasis">
          Registro de una nueva categoría
        </p>
      </VCardText>

      <VDivider class="mb-6" />

      <!-- 👉 Form -->
      <VForm @submit.prevent="store">
        <VRow dense>
          <!-- 👉 Nombre -->
          <VCol cols="12">
            <VTextField v-model="name" label="Nombre de la categoría" placeholder="Ej: Repuestos"
              prepend-inner-icon="ri-store-line" clearable />
          </VCol>

          <!-- 👉 Imagen -->
          <VCol cols="12" md="12">
            <VRow align="center">
              <VCol cols="12" md="6">
                <VFileInput label="Imagen de la categoría" prepend-inner-icon="ri-image-line" accept="image/*"
                  @change="loadFile($event)" @click:clear="clearImage" clearable />
              </VCol>
              <VCol cols="12" md="6" class="d-flex justify-center">
                <VAvatar v-if="PREVIZUALIZA_IMAGEN" :image="PREVIZUALIZA_IMAGEN" 
                  size="80" class="elevation-3" />
              </VCol>
            </VRow>
          </VCol>

          <VDivider class="my-6" />

          <!-- 👉 Alerts -->
          <VCol cols="12" v-if="warning">
            <VAlert type="warning" variant="tonal" closable>
              {{ warning }}
            </VAlert>
          </VCol>

          <VCol cols="12" v-if="error_exits">
            <VAlert type="error" variant="tonal" closable>
              {{ error_exits }}
            </VAlert>
          </VCol>

          <VCol cols="12" v-if="success">
            <VAlert type="success" variant="tonal" closable>
              {{ success }}
            </VAlert>
          </VCol>

          <!-- 👉 Actions -->
          <VCol cols="12" class="d-flex justify-center gap-4">
            <VBtn type="submit" color="primary" prepend-icon="ri-save-3-line"
              :loading="loader.loading" :disabled="loader.loading">
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

  <!-- Notificación Toast -->
  <VSnackbar v-model="notificationShow" :color="notificationType" :timeout="3000" location="top">
    {{ notificationMessage }}
  </VSnackbar>
</template>
