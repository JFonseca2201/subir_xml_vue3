<script setup>
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
    } else {
      success.value = "La categoria se ha registrado correctamente";
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
              prepend-inner-icon="tabler-tag" clearable />
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
          <VCol cols="12" md="6">
            <VFileInput label="Imagen de la categoría" prepend-inner-icon="tabler-photo" accept="image/*"
              @change="loadFile($event)" />

            <VImg v-if="PREVIZUALIZA_IMAGEN" :src="PREVIZUALIZA_IMAGEN" class="mt-3 rounded-lg elevation-2" height="170"
              cover />
          </VCol>

          <VDivider class="my-6" />

          <!-- 👉 Actions -->
          <VCol cols="12" class="d-flex justify-center gap-4">
            <VBtn type="submit" color="primary" prepend-icon="tabler-device-floppy">
              Guardar
            </VBtn>

            <VBtn variant="outlined" color="secondary" prepend-icon="tabler-x" @click="onFormReset">
              Cancelar
            </VBtn>
          </VCol>
        </VRow>
      </VForm>
    </VCard>
  </VDialog>
</template>
