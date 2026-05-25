<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  movement: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const loading = ref(false)

const closeDialog = () => {
  emit('update:modelValue', false)
}

const confirmDelete = async () => {
  loading.value = true
  try {
    emit('confirm', props.movement)
    closeDialog()
  } finally {
    loading.value = false
  }
}

// Cerrar con Escape key
const handleKeydown = event => {
  if (event.key === 'Escape') {
    closeDialog()
  }
}

watch(() => props.modelValue, newVal => {
  if (newVal) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <VDialog
    :model-value="props.modelValue"
    max-width="400" 
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <VCard>
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center gap-3">
          <VIcon
            icon="ri-delete-bin-line"
            color="error"
            size="28"
          />
          <div>
            <h3 class="text-h6 font-weight-bold mb-1">
              Confirmar Eliminación
            </h3>
            <p class="text-medium-emphasis text-body-2 mb-0">
              Esta acción no se puede deshacer
            </p>
          </div>
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-4">
        <div class="text-center mb-4">
          <VIcon 
            :icon="props.movement?.type === 0 ? 'ri-arrow-up-circle-line' : 'ri-arrow-down-circle-line'"
            :color="props.movement?.type === 0 ? 'success' : 'error'"
            size="48"
            class="mb-3"
          />
        </div>
                
        <div class="bg-grey-lighten-4 rounded-lg pa-3 mb-4">
          <div class="d-flex justify-space-between align-center mb-2">
            <span class="text-medium-emphasis">Tipo:</span>
            <VChip 
              :color="props.movement?.type === 0 ? 'success' : 'error'" 
              variant="tonal" 
              size="small"
            >
              {{ props.movement?.type === 0 ? 'INGRESO' : 'EGRESO' }}
            </VChip>
          </div>
                    
          <div class="d-flex justify-space-between align-center mb-2">
            <span class="text-medium-emphasis">Monto:</span>
            <span
              class="font-weight-bold" 
              :class="props.movement?.type === 0 ? 'text-success' : 'text-error'"
            >
              {{ props.movement?.type === 0 ? '+' : '-' }} ${{ props.movement?.amount }}
            </span>
          </div>
                    
          <div class="d-flex justify-space-between align-center">
            <span class="text-medium-emphasis">Descripción:</span>
            <span
              class="text-truncate"
              style="max-width: 200px;"
            >
              {{ props.movement?.description || 'Sin descripción' }}
            </span>
          </div>
        </div>
                
        <VAlert
          type="warning"
          variant="tonal"
          class="mb-4"
        >
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-alert-line" />
            <span>
              ¿Estás seguro de que quieres eliminar este {{ props.movement?.type === 0 ? 'ingreso' : 'egreso' }}?
            </span>
          </div>
        </VAlert>
      </VCardText>
      <VDivider />
      <VCardActions class="pa-4">
        <VBtn
          variant="outlined"
          :disabled="loading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VSpacer />
        <VBtn 
          color="error" 
          :loading="loading" 
          prepend-icon="ri-delete-bin-line"
          @click="confirmDelete"
        >
          Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
