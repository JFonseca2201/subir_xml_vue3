<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  roleSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(["update:isDialogVisible", "deleteRole"])

const loader = useLoaderStore()
const errorMessage = ref(null)

const deleteRol = async () => {
  if (!props.roleSelected?.id) return
  if (props.roleSelected.id === 1) return

  loader.start()
  errorMessage.value = null

  try {
    await $api(`role/${props.roleSelected.id}`, {
      method: "DELETE",
      onResponseError({ response }) {
        errorMessage.value = response._data?.error || response._data?.message || 'Error al eliminar el rol'
      },
    })

    emit("deleteRole", props.roleSelected)
    onFormReset()
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Ocurrió un error inesperado al intentar eliminar el rol'
  } finally {
    loader.stop()
  }
}

const onFormReset = () => {
  errorMessage.value = null
  emit("update:isDialogVisible", false)
}
</script>

<template>
  <VDialog
    scrollable
    :model-value="props.isDialogVisible"
    max-width="500"
    transition="dialog-bottom-transition"
    @update:model-value="onFormReset"
  >
    <VCard class="rounded-xl overflow-hidden border elevation-24 bg-surface">
      <!-- Header Alerta Suave -->
      <div class="pa-5 bg-grey-lighten-5 border-b position-relative">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="position-absolute"
          style="top: 12px; right: 12px;"
          @click="onFormReset"
        />

        <div class="d-flex align-center gap-3">
          <VAvatar size="48" color="error" variant="tonal" rounded="xl">
            <VIcon icon="ri-delete-bin-line" size="26" />
          </VAvatar>

          <div>
            <h3 class="text-h6 font-weight-bold text-high-emphasis mb-0">
              Eliminar Rol de Acceso
            </h3>
            <p class="text-caption text-medium-emphasis mb-0">
              Confirmación de eliminación de perfil de seguridad
            </p>
          </div>
        </div>
      </div>

      <!-- Contenido -->
      <VCardText class="pa-6">
        <div class="text-body-1 text-high-emphasis mb-3">
          ¿Estás seguro de que deseas eliminar permanentemente el rol <strong class="text-uppercase text-error">{{ props.roleSelected?.name }}</strong>?
        </div>

        <p class="text-caption text-medium-emphasis mb-0">
          Los usuarios que tengan asignado este rol perderán los accesos y permisos correspondientes inmediatamente.
        </p>

        <VAlert v-if="errorMessage" color="error" variant="tonal" closable class="mt-4">
          {{ errorMessage }}
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- Footer de Acciones -->
      <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-end align-center gap-3">
        <VBtn
          color="secondary"
          variant="outlined"
          class="rounded-lg px-5 font-weight-medium"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="rounded-lg px-6 font-weight-bold elevation-2"
          :loading="loader.loading"
          :disabled="loader.loading"
          @click="deleteRol"
        >
          Sí, Eliminar Rol
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
