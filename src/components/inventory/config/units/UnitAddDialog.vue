<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import NotificationToast from '@/components/common/NotificationToast.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(["update:isDialogVisible", "addUnit"])

const loader = useLoaderStore()

const name = ref(null)
const description = ref(null)
const warning = ref(null)
const error_exits = ref(null)
const success = ref(null)

// Variables para NotificationToast
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
  loader.start()

  if (!name.value) {
    setTimeout(() => {
      warning.value = "Se debe llenar un nombre para la unidad"
    }, 50)
    loader.stop()
    
    return
  }

  let data = {
    name: name.value,
    description: description.value,
    state: 1,
  }

  console.log('Data a enviar:', data)

  try {
    const resp = await $api("units", {
      method: "POST",
      body: data,
      onResponseError({ response }) {
        console.log('Error completo:', response._data)
        console.log('Errors específicos:', response._data.errors)
        error_exits.value = response._data.error
      },
    })

    console.log(resp)
    if (resp.message == 403) {
      error_exits.value = resp.message_text
      showNotification('Error de permisos', 'error')
    } else {
      success.value = "La unidad se ha registrado correctamente"
      showNotification('Unidad registrada correctamente', 'success')
      emit("addUnit", resp.unit)
      name.value = null
      description.value = null
      warning.value = null
      error_exits.value = null
      success.value = null
      onFormReset()
    }
  } catch (error) {
    console.log(error)
    showNotification('Error al registrar unidad', 'error')
    loader.stop()
  } finally {
    loader.stop()
  }
}

const onFormReset = () => {
  name.value = null
  description.value = null
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
    max-width="500"
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
          <VIcon icon="ri-ruler-line" />
        </div>
        <h3 class="custom-dialog-title">
          Nueva Unidad
        </h3>
        <p class="custom-dialog-subtitle">
          Agrega una nueva unidad de medida para el inventario
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8">
        <!-- 👉 Form -->
        <VForm
          id="unitAddForm"
          @submit.prevent="store"
        >
          <VRow dense>
            <!-- Nombre -->
            <VCol cols="12">
              <VTextField
                v-model="name"
                label="Nombre de la unidad"
                placeholder="ej. Kilogramos, Litros, Unidades"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-ruler-line"
                hide-details="auto"
                required
              />
            </VCol>

            <!-- Descripción -->
            <VCol cols="12">
              <VTextarea
                v-model="description"
                label="Descripción"
                placeholder="ej. Unidad de medida para peso, volumen, etc."
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-file-text-line"
                hide-details="auto"
                rows="3"
              />
            </VCol>

            <!-- Alertas -->
            <VCol
              v-if="warning"
              cols="12"
            >
              <VAlert
                color="warning"
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
                color="error"
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
                color="success"
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
      <VCardActions class="pa-4 justify-end bg-white">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="text-none px-6"
          :disabled="loader.loading"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          type="submit"
          form="unitAddForm"
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-3-line"
          class="text-none px-6"
          :loading="loader.loading"
          :disabled="loader.loading"
        >
          Guardar Unidad
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- NotificationToast -->
  <NotificationToast
    v-model:show="notificationShow"
    :message="notificationMessage"
    :type="notificationType"
  />
</template>
