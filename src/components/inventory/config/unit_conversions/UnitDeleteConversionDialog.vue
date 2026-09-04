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
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Conversión
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá la equivalencia entre unidades
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8 text-center">
        <h3 class="text-h6 text-center mb-4">
          ¿Estás seguro de eliminar esta conversión?
        </h3>
        <p class="text-body-2 text-medium-emphasis text-center mb-0">
          Esta acción no se puede deshacer. La conversión será eliminada permanentemente del sistema.
        </p>
      </VCardText>

      <VDivider />

      <!-- 👉 Actions -->
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
          Eliminar Conversión
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
