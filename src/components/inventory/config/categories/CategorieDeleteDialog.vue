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
})

const emit = defineEmits(["update:isDialogVisible", "deleteCategorie"])
const warning = ref(null)
const error_exits = ref(null)
const success = ref(null)
const loader = useLoaderStore()

// Notificaciones
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message
  notificationType.value = type
  notificationShow.value = true
}

const deleteCategorie = async () => {
  warning.value = null
  error_exits.value = null
  success.value = null

  loader.start()

  try {
    const resp = await $api("categories/" + props.categorieSelected.id, {
      method: "DELETE",
      onResponseError({ response }) {
        error_exits.value = response._data.error
      },
    })

    console.log(resp)
    showNotification("Categoría eliminada correctamente", 'success')
    emit("deleteCategorie", props.categorieSelected)
    onFormReset()
  } catch (error) {
    console.log(error)
    showNotification('Error al eliminar la categoría', 'error')
  } finally {
    loader.stop()
  }
}

onMounted(() => {
  console.log(props.categorieSelected)
})

const onFormSubmit = () => {
  emit("update:isDialogVisible", false)
  emit("submit", userData.value)
}

const onFormReset = () => {
  emit("update:isDialogVisible", false)
}

const dialogVisibleUpdate = val => {
  emit("update:isDialogVisible", val)
}
</script>

<template>
  <VDialog
    max-width="650"
    :model-value="props.isDialogVisible"
    @update:model-value="dialogVisibleUpdate"
  >
    <VCard class="custom-dialog-card pa-0">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="onFormReset"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Categoría
        </h3>
        <p class="custom-dialog-subtitle">
          {{ props.categorieSelected.title || 'Esta acción removerá la categoría' }}
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8 text-center">
        <!-- 👉 Imagen de la categoría -->
        <div class="text-center mb-6">
          <VAvatar
            v-if="props.categorieSelected.imagen"
            :image="props.categorieSelected.imagen" 
            size="100"
            class="elevation-3 mb-3"
          />
          <VIcon
            v-else
            icon="ri-image-line"
            size="100"
            color="medium-emphasis"
            class="mb-3"
          />
          <h4 class="text-h5 font-weight-bold text-high-emphasis">
            {{ props.categorieSelected.title || props.categorieSelected.name }}
          </h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            ¿Está seguro de que desea eliminar esta categoría?
          </p>
        </div>

        <!-- 👉 Form -->
        <VForm
          id="categorieDeleteForm"
          @submit.prevent="onFormSubmit"
        >
          <VRow dense>
            <VCol
              v-if="error_exits"
              cols="12"
            >
              <VAlert
                closable
                close-label="Close Alert"
                color="error"
              >
                {{ error_exits }}
              </VAlert>
            </VCol>
            <VCol
              v-if="success"
              cols="12"
            >
              <VAlert
                closable
                close-label="Close Alert"
                color="success"
              >
                {{ success }}
              </VAlert>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Fixed Actions Footer -->
      <VCardActions class="pa-4 justify-end bg-white">
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="text-none px-6"
          :disabled="loader.loading"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          type="submit"
          form="categorieDeleteForm"
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="text-none px-6"
          :loading="loader.loading"
          :disabled="loader.loading"
        >
          Eliminar Categoría
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Notificación Toast -->
  <VSnackbar
    v-model="notificationShow"
    :color="notificationType"
    :timeout="3000"
    location="top"
  >
    {{ notificationMessage }}
  </VSnackbar>
</template>
