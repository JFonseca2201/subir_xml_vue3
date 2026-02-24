<script setup>
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

const deleteCategorie = async () => {
  warning.value = null;
  error_exits.value = null;
  success.value = null;
  try {
    const resp = await $api("categories/" + props.categorieSelected.id, {
      method: "DELETE",
      onResponseError({ response }) {
        error_exits.value = response._data.error;
      },
    });
    console.log(resp);
    emit("deleteCategorie", props.categorieSelected);
    onFormReset();
  } catch (error) {
    console.log(error);
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
          <h4 class="text-h4 mb-2">
            Eliminar categoria : {{ props.categorieSelected.title }}
          </h4>
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
              <VBtn type="submit" color="error"> Eliminar </VBtn>

              <VBtn color="secondary" variant="outlined" @click="onFormReset">
                Cancel
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
