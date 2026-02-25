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

const emit = defineEmits(["update:isDialogVisible", "deleteCategorie"]);
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

const deleteCategorie = async () => {
  warning.value = null;
  error_exits.value = null;
  success.value = null;

  loader.start();

  try {
    const resp = await $api("categories/" + props.categorieSelected.id, {
      method: "DELETE",
      onResponseError({ response }) {
        error_exits.value = response._data.error;
      },
    });
    console.log(resp);
    showNotification("Categoría eliminada correctamente", 'success');
    emit("deleteCategorie", props.categorieSelected);
    onFormReset();
  } catch (error) {
    console.log(error);
    showNotification('Error al eliminar la categoría', 'error');
  } finally {
    loader.stop();
  }
};

onMounted(() => {
  console.log(props.categorieSelected);
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
  <VDialog
    max-width="650"
    :model-value="props.isDialogVisible"
    @update:model-value="dialogVisibleUpdate"
  >
    <VCard class="pa-sm-11 pa-3">
      <!-- 👉 dialog close btn -->
      <DialogCloseBtn variant="text" size="default" @click="onFormReset" />

      <VCardText class="pt-5">
        <div class="text-center pb-6">
          <VIcon icon="ri-delete-bin-line" size="42" color="error" class="mb-3" />
          <h4 class="text-h4 mb-2">
            Eliminar categoria : {{ props.categorieSelected.title }}
          </h4>
        </div>

        <!-- 👉 Imagen de la categoría -->
        <div class="text-center mb-6">
          <VAvatar v-if="props.categorieSelected.imagen" :image="props.categorieSelected.imagen" 
            size="100" class="elevation-3 mb-3" />
          <VIcon v-else icon="ri-image-line" size="100" color="medium-emphasis" class="mb-3" />
        </div>

        <!-- 👉 Form -->
        <VForm class="mt-4" @submit.prevent="deleteCategorie">
          <VRow>
            <!-- 👉 First Name -->
            <VCol cols="12">
              <p>
                ¿Estas seguro de eliminar la categoria
                {{ props.categorieSelected.title }}?
              </p>
            </VCol>
            <VCol cols="12" v-if="warning">
              <VAlert closable close-label="Close Alert" color="warning">
                {{ warning }}
              </VAlert>
            </VCol>
            <VCol cols="12" v-if="error_exits">
              <VAlert closable close-label="Close Alert" color="error">
                {{ error_exits }}
              </VAlert>
            </VCol>
            <VCol cols="12" v-if="success">
              <VAlert closable close-label="Close Alert" color="success">
                {{ success }}
              </VAlert>
            </VCol>
            <!-- 👉 Submit and Cancel -->
            <VCol cols="12" class="d-flex flex-wrap justify-center gap-4">
              <VBtn type="submit" color="error" prepend-icon="ri-delete-bin-line"
                :loading="loader.loading" :disabled="loader.loading">
                Eliminar
              </VBtn>

              <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line" @click="onFormReset"
                :disabled="loader.loading">
                Cancelar
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <!-- Notificación Toast -->
  <VSnackbar v-model="notificationShow" :color="notificationType" :timeout="3000" location="top">
    {{ notificationMessage }}
  </VSnackbar>
</template>
