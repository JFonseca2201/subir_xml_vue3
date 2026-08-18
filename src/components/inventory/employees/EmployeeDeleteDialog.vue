<script setup>
import { ref, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  employee: {
    type: Object,
    default: () => ({}),
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'employee-deleted'])

// Estado
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Métodos
const confirmDelete = async () => {
  if (!props.employee?.id) return

  try {
    loader.start()
        
    await $api(`employees/${props.employee.id}`, {
      method: 'DELETE',
    })

    showNotification('Empleado eliminado exitosamente', 'success')
        
    // Cerrar diálogo
    emit('update:modelValue', false)
        
    // Emitir evento de empleado eliminado
    emit('employee-deleted', props.employee)
        
  } catch (error) {
    console.error('Error al eliminar empleado:', error)
    showNotification('Error al eliminar empleado', 'error')
  } finally {
    loader.stop()
  }
}

const closeDialog = () => {
  emit('update:modelValue', false)
}
</script>

<template>
  <VDialog
    scrollable
    :model-value="modelValue"
    max-width="400"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <VCard class="custom-dialog-card elevation-24">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-line" />
        </div>
        <h3 class="custom-dialog-title">
          Confirmar Eliminación
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción cambiará el estado del empleado
        </p>
      </div>
            
      <VCardText>
        ¿Está seguro que desea eliminar al empleado
        <strong>{{ employee?.first_name }} {{ employee?.last_name }}</strong>?
        <br><br>
        <small class="text-warning">
          <VIcon icon="ri-information-line" />
          El empleado será marcado como inactivo pero no se eliminará permanentemente.
        </small>
      </VCardText>

      <VDivider />
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
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          @click="confirmDelete"
        >
          Eliminar Empleado
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
