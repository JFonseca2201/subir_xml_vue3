<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'
import NotificationToast from '@/components/common/NotificationToast.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  conversion: {
    type: Object,
    required: true,
  },
  unitSelected: {
    type: Object,
    required: true,
  },
  units: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(["update:isDialogVisible", "conversionDeleted"])

const loader = useLoaderStore()

// Variables para NotificationToast
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message
  notificationType.value = type
  notificationShow.value = true
}

// Función para obtener el nombre de la unidad hacia la que se convierte
const getUnitToName = conversion => {
  // Intentar diferentes campos donde podría estar el nombre
  if (conversion.unit_to_name) return conversion.unit_to_name
  if (conversion.unit_to?.name) return conversion.unit_to.name
  if (conversion.unit?.name) return conversion.unit.name

  // Si no encontramos el nombre, buscar en la lista de unidades por ID
  const unitTo = props.units.find(unit => unit.id === conversion.unit_to_id)
  
  return unitTo ? unitTo.name : 'Unidad desconocida'
}

const deleteConversion = async () => {
  loader.start()
  try {
    await $api(`unit-conversions/${props.conversion.id}`, {
      method: "DELETE",
      onResponseError({ response }) {
        console.log('Error al eliminar conversión:', response._data)
        showNotification('Error al eliminar conversión', 'error')
      },
    })

    showNotification('Conversión eliminada correctamente', 'success')
    emit("conversionDeleted", props.conversion.id)
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
      <VCardActions class="pa-4 justify-end bg-white">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="text-none px-6"
          :disabled="loader.loading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="text-none px-6"
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
