<script setup>
import { ref, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import NotificationToast from '@/components/common/NotificationToast.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  conversion: {
    type: Object,
    required: false,
    default: null,
  },
  conversionSelected: {
    type: Object,
    required: false,
    default: null,
  },
  unitSelected: {
    type: Object,
    required: false,
    default: null,
  },
  units: {
    type: [Array, Object],
    required: false,
    default: () => [],
  },
  listUnits: {
    type: [Array, Object],
    required: false,
    default: () => [],
  },
})

const emit = defineEmits([
  "update:isDialogVisible",
  "conversionDeleted",
  "deleteConversion",
])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const currentConversion = computed(() => props.conversion || props.conversionSelected || {})

// Variables para NotificationToast
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

// Nombre de la unidad base
const unitBaseName = computed(() => {
  if (props.unitSelected?.name) return props.unitSelected.name
  if (currentConversion.value.unit?.name) return currentConversion.value.unit.name
  if (currentConversion.value.unit_name) return currentConversion.value.unit_name
  return 'Unidad Base'
})

// Función para obtener el nombre de la unidad hacia la que se convierte
const getUnitToName = conversion => {
  if (!conversion) return 'Unidad desconocida'
  if (conversion.unit_to_name) return conversion.unit_to_name
  if (conversion.unit_to?.name) return conversion.unit_to.name
  if (conversion.unit?.name) return conversion.unit.name

  const unitsList = Array.isArray(props.units) ? props.units : (Array.isArray(props.listUnits) ? props.listUnits : [])
  const unitTo = unitsList.find(unit => unit.id === conversion.unit_to_id)

  return unitTo ? unitTo.name : 'Unidad desconocida'
}

const deleteConversion = async () => {
  const conv = currentConversion.value
  if (!conv || !conv.id) {
    showNotification('No se ha especificado la conversión a eliminar', 'error')
    return
  }

  loader.start()
  try {
    await $api(`unit-conversions/${conv.id}`, {
      method: "DELETE",
      onResponseError({ response }) {
        console.log('Error al eliminar conversión:', response._data?.error)
        showNotification('Error al eliminar conversión', 'error')
      },
    })

    showNotification('Conversión eliminada correctamente', 'success')
    emit("conversionDeleted", conv.id)
    emit("deleteConversion", conv)
    closeDialog()
  } catch (error) {
    console.log(error)
    showNotification('Error al eliminar conversión', 'error')
  } finally {
    loader.stop()
  }
}

const closeDialog = () => {
  emit("update:isDialogVisible", false)
}

const dialogVisibleUpdate = val => {
  emit("update:isDialogVisible", val)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="500"
    scrollable
    persistent
    transition="dialog-bottom-transition"
    @update:model-value="dialogVisibleUpdate"
  >
    <VCard class="custom-dialog-card elevation-12">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
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
          Eliminar Conversión
        </h3>
        <p class="custom-dialog-subtitle">
          Confirmación de eliminación de equivalencia
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8 text-center">
        <!-- Avatar y Título -->
        <VAvatar
          size="72"
          color="error"
          variant="tonal"
          class="mb-3"
        >
          <VIcon
            icon="ri-scales-3-line"
            size="36"
          />
        </VAvatar>

        <h3 class="text-h6 font-weight-bold text-high-emphasis mb-2">
          ¿Eliminar esta regla de conversión?
        </h3>

        <!-- Ficha Resumen de la Conversión -->
        <div class="bg-grey-lighten-4 rounded-lg pa-4 mb-4 text-left border">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                size="16"
                icon="ri-arrow-left-right-line"
              />
              Equivalencia:
            </span>
            <span class="text-body-2 font-weight-bold text-primary font-mono">
              1 {{ unitBaseName }} = {{ currentConversion.conversion_factor || currentConversion.factor || 1 }} {{ getUnitToName(currentConversion) }}
            </span>
          </div>

          <div
            v-if="currentConversion.id"
            class="d-flex align-center justify-space-between"
          >
            <span class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                size="16"
                icon="ri-hashtag"
              />
              ID Registro:
            </span>
            <span class="text-body-2 font-weight-medium text-high-emphasis">
              #{{ currentConversion.id }}
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
          Esta acción removerá permanentemente la regla de conversión del sistema y no se podrá deshacer.
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- Actions -->
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
          :loading="loader.loading"
          :disabled="loader.loading"
          @click="deleteConversion"
        >
          Sí, Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Notification Toast -->
  <NotificationToast
    v-model:show="notificationShow"
    :message="notificationMessage"
    :type="notificationType"
  />
</template>
