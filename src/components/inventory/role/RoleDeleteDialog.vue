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
    persistent
    transition="dialog-bottom-transition"
    @update:model-value="onFormReset"
  >
    <VCard class="custom-dialog-card elevation-12">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="onFormReset"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-shield-keyhole-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Rol de Acceso
        </h3>
        <p class="custom-dialog-subtitle">
          Confirmación de eliminación de perfil de seguridad
        </p>
      </div>

      <!-- Contenido -->
      <VCardText class="pa-6 pa-sm-8 text-center">
        <!-- Avatar y Nombre -->
        <VAvatar
          size="72"
          color="error"
          variant="tonal"
          class="mb-3"
        >
          <VIcon
            icon="ri-delete-bin-line"
            size="36"
          />
        </VAvatar>

        <h3 class="text-h6 font-weight-bold text-high-emphasis text-uppercase mb-1">
          {{ props.roleSelected?.name || 'Rol sin nombre' }}
        </h3>

        <div class="mb-4">
          <VChip
            size="small"
            color="primary"
            variant="tonal"
            class="font-weight-medium"
            prepend-icon="ri-hashtag"
          >
            ID #{{ props.roleSelected?.id }}
          </VChip>
        </div>

        <!-- Ficha Resumen de Información -->
        <div class="bg-grey-lighten-4 rounded-lg pa-4 mb-4 text-left border">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                size="16"
                icon="ri-shield-user-line"
              />
              Nombre del Rol:
            </span>
            <span class="text-body-2 font-weight-bold text-high-emphasis text-uppercase">
              {{ props.roleSelected?.name || 'N/A' }}
            </span>
          </div>

          <div class="d-flex align-center justify-space-between mb-2">
            <span class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                size="16"
                icon="ri-key-line"
              />
              Permisos Asignados:
            </span>
            <span class="text-body-2 font-weight-bold text-primary">
              {{ props.roleSelected?.permissions_pluck?.length || props.roleSelected?.permissions?.length || 0 }} permisos
            </span>
          </div>

          <div
            v-if="props.roleSelected?.created_at"
            class="d-flex align-center justify-space-between"
          >
            <span class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                size="16"
                icon="ri-calendar-line"
              />
              Fecha de Registro:
            </span>
            <span class="text-body-2 font-weight-medium text-high-emphasis">
              {{ String(props.roleSelected.created_at).split('T')[0] }}
            </span>
          </div>
        </div>

        <!-- Alerta de Advertencia -->
        <VAlert
          type="error"
          variant="tonal"
          class="text-left text-caption pa-3 mb-0"
        >
          <template #prepend>
            <VIcon icon="ri-error-warning-line" />
          </template>
          Los usuarios que tengan asignado este rol perderán inmediatamente sus accesos y privilegios en el sistema.
        </VAlert>

        <VAlert
          v-if="errorMessage"
          color="error"
          variant="tonal"
          closable
          class="mt-3 text-left text-caption"
        >
          {{ errorMessage }}
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- Footer de Acciones -->
      <VCardActions
        class="pa-4 bg-white d-flex justify-end align-center gap-3"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
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
