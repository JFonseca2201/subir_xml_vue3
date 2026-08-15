<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  userSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'deleteUser',
])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const confirmDelete = async () => {
  // Verificar si el usuario es super-admin (ID = 1)
  if (props.userSelected.id === 1) {
    showNotification('No se puede eliminar al usuario con ID 1 (Super-Admin)', 'error')
    
    return
  }

  loader.start()

  try {
    const resp = await $api(`users/${props.userSelected.id}`, {
      method: "DELETE",
      onResponseError({ response }) {
        console.error('Error al eliminar usuario:', response)
        console.error('Data del error:', response._data)
        console.error('Status:', response.status)
        console.error('StatusText:', response.statusText)

        let errorMessage = 'Error desconocido'

        if (response._data) {
          // Manejar errores específicos
          if (response._data.message) {
            if (response._data.message.includes('SQLSTATE[23000]')) {
              if (response._data.message.includes('foreign key constraint')) {
                errorMessage = 'No se puede eliminar el usuario. Tiene registros asociados.'
              } else {
                errorMessage = 'Error de base de datos al eliminar usuario.'
              }
            } else {
              errorMessage = response._data.message
            }
          } else if (response._data.error) {
            errorMessage = response._data.error
          } else if (response._data.errors) {
            // Errores de validación Laravel
            const firstErrorKey = Object.keys(response._data.errors)[0]
            if (firstErrorKey) {
              errorMessage = response._data.errors[firstErrorKey][0]
            }
          } else {
            errorMessage = JSON.stringify(response._data)
          }
        } else if (response.statusText) {
          errorMessage = response.statusText
        } else if (response.status) {
          errorMessage = `Error HTTP ${response.status}`
        }

        showNotification(errorMessage, 'error')
      },
    })

    showNotification('Usuario eliminado con éxito', 'success')
    emit('deleteUser', props.userSelected)

    // Cerrar diálogo
    emit('update:isDialogVisible', false)

  } catch (error) {
    console.error('Error al eliminar usuario:', error)
    showNotification('Error al eliminar usuario', 'error')
  } finally {
    loader.stop()
  }
}

const cancelDelete = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog scrollable
    :width="$vuetify.display.smAndDown ? 'auto' : 450"
    :model-value="props.isDialogVisible"
    transition="dialog-bottom-transition"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card elevation-24">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="cancelDelete"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-user-unfollow-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Usuario
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá el acceso del usuario al sistema
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8">
        <p class="text-body-1 text-medium-emphasis mb-4 text-center">
          ¿Estás seguro que deseas eliminar a <strong>{{ props.userSelected.name + ' ' + props.userSelected.surname || 'este usuario' }}</strong>?
        </p>

      <!-- Alerta especial para Super-Admin -->
      <VAlert
        v-if="props.userSelected.id === 1"
        color="error"
        variant="tonal"
        class="mb-6"
      >
        <div class="d-flex align-center gap-2">
          <VIcon
            icon="ri-shield-cross-line"
            size="20"
          />
          <span>
            <strong>Usuario Protegido:</strong> El Super-Admin no puede ser eliminado
          </span>
        </div>
      </VAlert>

      <!-- Alerta general -->
      <VAlert
        v-else
        color="warning"
        variant="tonal"
        class="mb-6"
      >
        <div class="d-flex align-center gap-2">
          <VIcon
            icon="ri-error-warning-line"
            size="20"
          />
          <span>
            Esta acción es permanente y no se puede deshacer
          </span>
        </div>
      </VAlert>

      <!-- Acciones -->
      <div class="d-flex justify-end align-center gap-3">
        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loader.loading"
          :disabled="loader.loading ||
            props.userSelected.id === 1"
          @click="confirmDelete"
        >
          Eliminar
        </VBtn>

        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loader.loading"
          @click="cancelDelete"
        >
          Cancelar
        </VBtn>
      </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>
