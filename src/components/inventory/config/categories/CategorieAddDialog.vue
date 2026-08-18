<script setup>
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(["update:isDialogVisible", "addCategorie"])
const name = ref(null)
const FILE_IMAGEN = ref(null)
const PREVIZUALIZA_IMAGEN = ref(null)
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

const store = async () => {
  warning.value = null
  error_exits.value = null
  success.value = null
  if (!name.value) {
    setTimeout(() => {
      warning.value = "Se debe llenar un nombre para la categoria"
    }, 50)
    
    return
  }
  if (!FILE_IMAGEN.value) {
    setTimeout(() => {
      warning.value = "Se debe subir una imagen para la categoria"
    }, 50)
    
    return
  }

  loader.start()

  let formData = new FormData()
  formData.append("title", name.value)
  formData.append("image", FILE_IMAGEN.value)
  formData.append("state", 1)
  try {
    const resp = await $api("categories", {
      method: "POST",
      body: formData,
      onResponseError({ response }) {
        error_exits.value = response._data.error
      },
    })

    console.log(resp)
    if (resp.message == 403) {
      error_exits.value = resp.message_text
      showNotification(resp.message_text, 'error')
    } else {
      success.value = "La categoria se ha registrado correctamente"
      showNotification("La categoría se ha registrado correctamente", 'success')
      emit("addCategorie", resp.categorie)
      name.value = null
      FILE_IMAGEN.value = null
      PREVIZUALIZA_IMAGEN.value = null
      warning.value = null
      error_exits.value = null
      success.value = null
      onFormReset()
    }
  } catch (error) {
    console.log(error)
    showNotification('Error al registrar la categoría', 'error')
  } finally {
    loader.stop()
  }
}

const loadFile = $event => {
  if ($event.target.files[0].type.indexOf("image") < 0) {
    error_exits.value = "SOLAMENTE PUEDEN SER ARCHIVOS DE TIPO IMAGEN"
    
    return
  }
  error_exits.value = ""
  FILE_IMAGEN.value = $event.target.files[0]
  let reader = new FileReader()
  reader.readAsDataURL(FILE_IMAGEN.value)
  reader.onloadend = () => (PREVIZUALIZA_IMAGEN.value = reader.result)
}

const clearImage = () => {
  FILE_IMAGEN.value = null
  PREVIZUALIZA_IMAGEN.value = null
  error_exits.value = ""
}

const onFormSubmit = () => {
  emit("update:isDialogVisible", false)
  emit("submit", userData.value)
}

const onFormReset = () => {
  name.value = null
  FILE_IMAGEN.value = null
  PREVIZUALIZA_IMAGEN.value = null

  emit("update:isDialogVisible", false)
}

const dialogVisibleUpdate = val => {
  emit("update:isDialogVisible", val)
}
</script>

<template>
  <VDialog
    scrollable
    max-width="650"
    :model-value="props.isDialogVisible"
    persistent
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
          <VIcon icon="ri-folder-2-line" />
        </div>
        <h3 class="custom-dialog-title">
          Nueva Categoría
        </h3>
        <p class="custom-dialog-subtitle">
          Registro de una nueva categoría de productos o servicios
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8">
        <!-- 👉 Form -->
        <VForm
          id="categorieAddForm"
          @submit.prevent="store"
        >
          <VRow dense>
            <!-- 👉 Nombre -->
            <VCol cols="12">
              <VTextField
                v-model="name"
                label="Nombre de la categoría"
                placeholder="Ej: Repuestos"
                prepend-inner-icon="ri-store-line"
                clearable
              />
            </VCol>

            <!-- 👉 Imagen -->
            <VCol
              cols="12"
              md="12"
            >
              <VRow align="center">
                <VCol
                  cols="12"
                  md="6"
                >
                  <VFileInput
                    label="Subir Imagen"
                    prepend-icon="ri-image-add-line"
                    accept="image/*"
                    @change="selectImagen"
                  />
                </VCol>

                <VCol
                  cols="12"
                  md="6"
                  class="d-flex justify-center"
                >
                  <VImg
                    v-if="PREVIZUALIZA_IMAGEN"
                    :src="PREVIZUALIZA_IMAGEN"
                    max-width="120"
                    max-height="120"
                    contain
                    class="rounded-lg border"
                  />
                </VCol>
              </VRow>
            </VCol>

            <!-- 👉 Alert Warning -->
            <VCol
              v-if="warning"
              cols="12"
            >
              <VAlert
                type="warning"
                variant="tonal"
                closable
              >
                {{ warning }}
              </VAlert>
            </VCol>

            <VCol
              v-if="error_exits"
              cols="12"
            >
              <VAlert
                type="error"
                variant="tonal"
                closable
              >
                {{ error_exits }}
              </VAlert>
            </VCol>

            <VCol
              v-if="success"
              cols="12"
            >
              <VAlert
                type="success"
                variant="tonal"
                closable
              >
                {{ success }}
              </VAlert>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Fixed Actions Footer -->
      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loader.loading"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          type="submit"
          form="categorieAddForm"
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-3-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loader.loading"
          :disabled="loader.loading"
        >
          Guardar Categoría
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
