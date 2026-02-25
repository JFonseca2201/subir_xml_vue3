<script setup>
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  categorieSelected: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:isDialogVisible", "editCategorie"]);
const name = ref(null);
const FILE_IMAGEN = ref(null);
const PREVIZUALIZA_IMAGEN = ref(null);
const state = ref(1);
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

const update = async () => {
  warning.value = null;
  error_exits.value = null;
  success.value = null;
  if (!name.value) {
    setTimeout(() => {
      warning.value = "Se debe llenar un nombre para la categoria";
    }, 50);
    return;
  }
  //   if(!FILE_IMAGEN.value){
  //     setTimeout(() => {
  //       warning.value = "Se debe subir una imagen para la categoria";
  //     }, 50);
  //     return;
  //   }

  loader.start();

  let formData = new FormData();
  formData.append("title", name.value);
  if (FILE_IMAGEN.value) {
    formData.append("image", FILE_IMAGEN.value);
  }
  formData.append("state", state.value);
  try {
    const resp = await $api("categories/" + props.categorieSelected.id, {
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
      success.value = "La categoria se ha editado correctamente";
      showNotification("La categoría se ha editado correctamente", 'success');
      emit("editCategorie", resp.categorie);
      FILE_IMAGEN.value = "";
      warning.value = null;
      error_exits.value = null;
      //   success.value = null;
      //   onFormReset();
    }
  } catch (error) {
    console.log(error);
    showNotification('Error al editar la categoría', 'error');
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
  PREVIZUALIZA_IMAGEN.value = props.categorieSelected.imagen; // Restaurar imagen original
  error_exits.value = "";
};

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
onMounted(() => {
  name.value = props.categorieSelected.title;
  state.value = props.categorieSelected.state;
  PREVIZUALIZA_IMAGEN.value = props.categorieSelected.imagen;
});
</script>

<template>
  <VDialog max-width="650" :model-value="props.isDialogVisible" @update:model-value="dialogVisibleUpdate">
    <VCard class="pa-sm-10 pa-5">
      <!-- 👉 Botón cerrar -->
      <DialogCloseBtn variant="text" size="default" @click="onFormReset" />

      <!-- 👉 Header -->
      <VCardText class="text-center pb-6">
        <VIcon icon="ri-file-chart-line" size="42" color="primary" class="mb-3" />
        <h4 class="text-h4 font-weight-bold mb-1">Editar Categoría</h4>
        <p class="text-body-2 text-medium-emphasis">
          {{ props.categorieSelected.title }}
        </p>
      </VCardText>

      <VDivider class="mb-6" />

      <!-- 👉 Form -->
      <VForm @submit.prevent="update">
        <VRow dense>
          <!-- 👉 Nombre -->
          <VCol cols="12">
            <VTextField v-model="name" label="Nombre de la categoría" placeholder="Ej: Repuestos, Accesorios"
              prepend-inner-icon="ri-store-line" clearable />
          </VCol>

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

          <!-- 👉 Estado -->
          <VCol cols="12" md="6">
            <VSelect v-model="state" label="Estado" prepend-inner-icon="ri-toggle-line" :items="[
              { name: 'Activo', id: 1 },
              { name: 'Inactivo', id: 2 },
            ]" item-title="name" item-value="id" eager />
          </VCol>

          <VDivider class="my-6" />

          <!-- 👉 Actions -->
          <VCol cols="12" class="d-flex justify-center gap-4">
            <VBtn type="submit" color="primary" prepend-icon="ri-edit-line"
              :loading="loader.loading" :disabled="loader.loading">
              Actualizar
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
