<script setup>
import { ref, watch, onMounted } from 'vue'
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

const emit = defineEmits(["update:isDialogVisible", "editCategorie"])
const name = ref(null)
const FILE_IMAGEN = ref(null)
const PREVIZUALIZA_IMAGEN = ref(null)
const remove_image = ref(false)
const state = ref(1)
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

const syncData = () => {
  if (props.categorieSelected) {
    name.value = props.categorieSelected.title || ''
    state.value = parseInt(props.categorieSelected.state) === 1 ? 1 : 0
    PREVIZUALIZA_IMAGEN.value = props.categorieSelected.imagen || null
    FILE_IMAGEN.value = null
    remove_image.value = false
    warning.value = null
    error_exits.value = null
    success.value = null
  }
}

watch(
  () => props.categorieSelected,
  () => {
    syncData()
  },
  { immediate: true, deep: true },
)

const update = async () => {
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
  if (remove_image.value) {
    formData.append("remove_image", "1")
  } else if (FILE_IMAGEN.value) {
    formData.append("image", FILE_IMAGEN.value)
  }
  formData.append("state", state.value)
  try {
    const resp = await $api(`categories/${props.categorieSelected.id}`, {
      method: "POST",
      body: formData,
      onResponseError({ response }) {
        error_exits.value = response._data?.message_text || response._data?.message || response._data?.error || 'Error al actualizar la categoría'
      },
    })

    console.log('Respuesta actualizar categoría:', resp)
    if (resp?.message == 403) {
      error_exits.value = resp.message_text
      showNotification(resp.message_text, 'error')
    } else if (resp?.categorie) {
      success.value = "La categoría se ha editado correctamente"
      showNotification("La categoría se ha editado correctamente", 'success')
      emit("editCategorie", resp.categorie)
      FILE_IMAGEN.value = null
      remove_image.value = false
      warning.value = null
      error_exits.value = null

      setTimeout(() => {
        emit("update:isDialogVisible", false)
      }, 400)
    } else {
      showNotification("Categoría actualizada", 'success')
      emit("editCategorie", {
        ...props.categorieSelected,
        title: name.value.toUpperCase(),
        imagen: remove_image.value ? null : (PREVIZUALIZA_IMAGEN.value || props.categorieSelected.imagen),
        state: state.value,
      })
      emit("update:isDialogVisible", false)
    }
  } catch (error) {
    console.error('Error al actualizar categoría:', error)
    showNotification('Error al editar la categoría', 'error')
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
  remove_image.value = false
  FILE_IMAGEN.value = file
  let reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onloadend = () => (PREVIZUALIZA_IMAGEN.value = reader.result)
}

const clearImage = () => {
  FILE_IMAGEN.value = null
  PREVIZUALIZA_IMAGEN.value = null
  remove_image.value = true
  error_exits.value = null
}

const restoreOriginalImage = () => {
  FILE_IMAGEN.value = null
  PREVIZUALIZA_IMAGEN.value = props.categorieSelected.imagen || null
  remove_image.value = false
  error_exits.value = null
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
    scrollable
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
          <VIcon icon="ri-folder-2-line" />
        </div>
        <h3 class="custom-dialog-title">
          Editar Categoría
        </h3>
        <p class="custom-dialog-subtitle">
          {{ props.categorieSelected.title || 'Modifica la categoría seleccionada' }}
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8">
        <!-- 👉 Form -->
        <VForm
          id="categorieEditForm"
          @submit.prevent="update"
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
                    label="Cambiar Imagen"
                    prepend-inner-icon="ri-image-edit-line"
                    accept="image/*"
                    clearable
                    @change="loadFile($event)"
                    @click:clear="clearImage"
                  />
                  <div class="d-flex align-center gap-2 mt-2">
                    <VBtn
                      v-if="PREVIZUALIZA_IMAGEN"
                      size="x-small"
                      color="error"
                      variant="tonal"
                      prepend-icon="ri-delete-bin-line"
                      @click="clearImage"
                    >
                      Quitar imagen
                    </VBtn>
                    <VBtn
                      v-if="remove_image && props.categorieSelected.imagen"
                      size="x-small"
                      color="secondary"
                      variant="tonal"
                      prepend-icon="ri-arrow-go-back-line"
                      @click="restoreOriginalImage"
                    >
                      Restaurar
                    </VBtn>
                  </div>
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

            <!-- 👉 Estado -->
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="state"
                label="Estado"
                prepend-inner-icon="ri-toggle-line"
                :items="[
                  { name: 'Activo', id: 1 },
                  { name: 'Inactivo', id: 0 },
                ]"
                item-title="name"
                item-value="id"
                eager
              />
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
          form="categorieEditForm"
          color="primary"
          variant="elevated"
          prepend-icon="ri-refresh-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loader.loading"
          :disabled="loader.loading"
        >
          Actualizar Categoría
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
