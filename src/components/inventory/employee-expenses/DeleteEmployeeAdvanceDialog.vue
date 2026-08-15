<template>
  <VDialog scrollable
    v-model="show"
    max-width="500"
    persistent
  >
    <VCard class="custom-dialog-card">
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
          Eliminar Adelanto
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción no se puede deshacer
        </p>
      </div>

      <!-- Content -->
      <VCardText class="pa-6">
        <VAlert
          type="warning"
          variant="tonal"
          class="mb-4"
        >
          <template #prepend>
            <VIcon>ri-alert-line</VIcon>
          </template>
          <div class="text-body-1">
            ¿Estás seguro de que deseas eliminar este adelanto?
          </div>
        </VAlert>

        <!-- Advance Details -->
        <VCard
          v-if="advance && advance.id"
          class="bg-grey-lighten-5 rounded-lg pa-4 mb-4"
        >
          <VCardText class="pa-0">
            <div class="mb-3">
              <span class="text-body-2 text-medium-emphasis">Empleado:</span>
              <div class="text-body-1 font-weight-medium">
                {{ advance.employee_name || 'N/A' }}
              </div>
            </div>
            <div class="mb-3">
              <span class="text-body-2 text-medium-emphasis">Monto:</span>
              <div class="text-h6 font-weight-bold text-error">
                {{ formatCurrency(advance.amount || 0) }}
              </div>
            </div>
            <div class="mb-3">
              <span class="text-body-2 text-medium-emphasis">Descripción:</span>
              <div class="text-body-1">
                {{ advance.description || 'Sin descripción' }}
              </div>
            </div>
            <div>
              <span class="text-body-2 text-medium-emphasis">Fecha:</span>
              <div class="text-body-1">
                {{ advance.date || advance.advance_date || 'N/A' }}
              </div>
            </div>
          </VCardText>
        </VCard>

        <VAlert
          type="info"
          variant="tonal"
          density="compact"
        >
          <template #prepend>
            <VIcon>ri-information-line</VIcon>
          </template>
          <div class="text-body-2">
            Al eliminar este adelanto, se restaurará el monto a la cuenta correspondiente y se eliminará
            permanentemente del
            sistema.
          </div>
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- Actions -->
      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loading"
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
          :loading="loading"
          :disabled="loading || !advance?.id"
          @click="handleDelete"
        >
          Eliminar Adelanto
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  advance: {
    type: Object,
    default: null,
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'deleted'])

// Estado
const loading = ref(false)

// Computed
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const advanceData = computed(() => props.advance || {})

// Función para mostrar notificaciones toast
const showToast = (message, type = 'info') => {
  // Crear elemento toast
  const toast = document.createElement('div')

  toast.className = `toast toast-${type}`
  toast.textContent = message
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 9999;
        font-size: 14px;
        max-width: 300px;
        overflow-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `

  // Agregar al DOM
  document.body.appendChild(toast)

  // Remover automáticamente después de 4 segundos
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 4000)
}

// Agregar animación CSS si no existe
if (!document.querySelector('#toast-styles')) {
  const style = document.createElement('style')

  style.id = 'toast-styles'
  style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `
  document.head.appendChild(style)
}

const closeDialog = () => {
  show.value = false
}

const handleDelete = async () => {
  if (!advanceData.value?.id) return

  loading.value = true

  try {
    await $api(`employee-expenses/${advanceData.value.id}/advance`, {
      method: 'DELETE',
    })

    showToast('Adelanto eliminado exitosamente', 'success')
    emit('deleted', advanceData.value.id)
    closeDialog()
  } catch (error) {
    console.error('Error al eliminar adelanto:', error)

    // Manejar errores específicos
    if (error.status === 422 && error.data?.message) {
      showToast(error.data.message, 'error')
    } else {
      showToast('Error al eliminar el adelanto. Por favor, intente nuevamente.', 'error')
    }
  } finally {
    loading.value = false
  }
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}
</script>
