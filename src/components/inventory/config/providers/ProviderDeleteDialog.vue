<script setup>
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  providerSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'deleteProvider'])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

/* ======================================================
   🔥 DELETE PROVIDER
====================================================== */

const deleteProvider = async () => {
  if (!props.providerSelected || !props.providerSelected.id) {
    console.error('No hay proveedor seleccionado para eliminar')
    showNotification('Error: no se puede eliminar, proveedor no seleccionado', 'error')
    
    return
  }

  loader.start()

  try {
    const resp = await $api(`suppliers/${props.providerSelected.id}`, {
      method: 'DELETE',
      onResponseError({ response }) {
        console.error('Error del servidor:', response._data)

        const errorMessage = response._data?.message || 'Error al eliminar el proveedor'

        showNotification(errorMessage, 'error')
      },
    })

    console.log('Proveedor eliminado del servidor:', resp.supplier || resp)
        
    // Emitir el proveedor eliminado (usar el original si no hay respuesta)
    const deletedProvider = resp.supplier || props.providerSelected

    emit('deleteProvider', deletedProvider)
    emit('update:isDialogVisible', false)
    showNotification('Proveedor eliminado con éxito', 'success')

  } catch (error) {
    console.error('Error al eliminar proveedor:', error)
        
    // Si hay error de red o servidor, pero el proveedor fue eliminado del backend
    // aún así eliminarlo de la lista local
    if (props.providerSelected) {
      emit('deleteProvider', props.providerSelected)
      emit('update:isDialogVisible', false)
      showNotification('Proveedor eliminado (verificar en servidor)', 'warning')
    } else {
      showNotification('Error al eliminar el proveedor', 'error')
    }
  } finally {
    loader.stop()
  }
}
</script>

<template>
  <VDialog
    scrollable 
    :model-value="props.isDialogVisible" 
    max-width="500"
    persistent
    :closable="!loader.loading"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Proveedor
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá el registro comercial del proveedor
        </p>
      </div>

      <!-- Content -->
      <VCardText class="pa-4">
        <div class="text-center">
          <!-- Avatar -->
          <VAvatar
            size="80"
            color="error"
            variant="tonal"
            class="mb-4"
          >
            <VIcon
              icon="ri-building-line"
              size="40"
            />
          </VAvatar>

          <!-- Provider Info -->
          <div class="mb-4">
            <h4 class="text-h6 font-weight-bold mb-2">
              {{ props.providerSelected?.name || 'Proveedor sin nombre' }}
            </h4>
                        
            <div class="d-flex flex-column gap-1">
              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-id-card-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>RUC:</strong> {{ props.providerSelected?.ruc || 'Sin RUC' }}
                </span>
              </div>
                            
              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-hashtag"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>ID:</strong> {{ props.providerSelected?.supplier_id || 'Sin ID' }}
                </span>
              </div>
                            
              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-map-pin-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Dirección:</strong> {{ props.providerSelected?.address || 'Sin dirección' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Warning Alert -->
          <VAlert 
            type="warning" 
            variant="tonal" 
            class="mb-4"
            icon="ri-alert-line"
          >
            <div class="text-body-2">
              <strong>¿Está seguro de eliminar este proveedor?</strong>
              <br>
              Esta acción no se puede deshacer y podría afectar facturas asociadas.
            </div>
          </VAlert>
        </div>
      </VCardText>

      <VDivider />

      <!-- Actions -->
      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn 
          color="secondary" 
          variant="outlined" 
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
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
          @click="deleteProvider"
        >
          Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
