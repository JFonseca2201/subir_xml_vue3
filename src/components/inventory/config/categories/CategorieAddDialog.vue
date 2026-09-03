<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(["update:isDialogVisible", "addCategorie"])
const name = ref('')
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
  if (!name.value || !name.value.trim()) {
    setTimeout(() => {
      warning.value = "Se debe llenar un nombre para la categoría"
    }, 50)
    
    return
  }

  loader.start()

  let formData = new FormData()
  formData.append("title", name.value.trim())
  if (FILE_IMAGEN.value) {
    formData.append("image", FILE_IMAGEN.value)
  }
  formData.append("state", 1)
  try {
    const resp = await $api("categories", {
      method: "POST",
      body: formData,
      onResponseError({ response }) {
        error_exits.value = response._data?.message_text || response._data?.message || response._data?.error || 'Error al registrar la categoría'
      },
    })

    console.log('Respuesta crear categoría:', resp)
    if (resp?.message == 403) {
      error_exits.value = resp.message_text
      showNotification(resp.message_text, 'error')
    } else if (resp?.categorie) {
      success.value = "La categoría se ha registrado correctamente"
      showNotification("La categoría se ha registrado correctamente", 'success')
      emit("addCategorie", resp.categorie)
      onFormReset()
    } else {
      showNotification("Categoría registrada", 'success')
      emit("addCategorie", {
        title: name.value.toUpperCase(),
        state: 1,
        created_at: new Date().toISOString(),
      })
      onFormReset()
    }
  } catch (error) {
    console.error('Error al registrar categoría:', error)
    showNotification('Error al registrar la categoría', 'error')
  } finally {
    loader.stop()
  }
}

const loadFile = $event => {
  if (!$event.target.files || !$event.target.files[0]) return
  const file = $event.target.files[0]
  if (file.type.indexOf("image") < 0) {
    error_exits.value = "SOLAMENTE PUEDEN SER ARCHIVOS DE TIPO IMAGEN (PNG, JPG, JPEG, WEBP)"
    
    return
  }
  if (file.size > 3 * 1024 * 1024) {
    error_exits.value = "LA IMAGEN NO DEBE SUPERAR LOS 3MB"
    
    return
  }
  error_exits.value = null
  FILE_IMAGEN.value = file
  let reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onloadend = () => (PREVIZUALIZA_IMAGEN.value = reader.result)
}

const clearImage = () => {
  FILE_IMAGEN.value = null
  PREVIZUALIZA_IMAGEN.value = null
  error_exits.value = null
}

const onFormReset = () => {
  name.value = ''
  FILE_IMAGEN.value = null
  PREVIZUALIZA_IMAGEN.value = null
  warning.value = null
  error_exits.value = null
  success.value = null
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
                label="Nombre de la categoría *"
                placeholder="Ej: Repuestos, Accesorios, Lubricantes"
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
                    label="Imagen (Opcional)"
                    prepend-inner-icon="ri-image-add-line"
                    accept="image/*"
                    clearable
                    @change="loadFile($event)"
                    @click:clear="clearImage"
                  />
                </VCol>

                <VCol
                  cols="12"
                  md="6"
                  class="d-flex justify-center"
                >
                  <VAvatar
                    v-if="PREVIZUALIZA_IMAGEN"
                    :image="PREVIZUALIZA_IMAGEN"
                    size="80"
                    rounded="lg"
                    class="elevation-2 border"
                  />
                  <div
                    v-else
                    class="d-flex flex-column align-center justify-center border border-dashed rounded-lg pa-3 text-disabled"
                    style="width: 80px; height: 80px;"
                  >
                    <VIcon icon="ri-image-line" size="28" />
                    <span style="font-size: 0.65rem;">Sin imagen</span>
                  </div>
                </VCol>
              </VRow>
            </VCol>

            <!-- 👉 Alerts -->
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
          prepend-icon="ri-save-line"
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
