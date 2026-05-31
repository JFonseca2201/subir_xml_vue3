<script setup>
import { onUnmounted, ref, watch, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'
import NotificationToast from '@/components/common/NotificationToast.vue'
import UnitDeleteConversionDialog from './UnitDeleteConversionDialog.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  unitSelected: {
    type: Object,
    required: false,
    default: null,
  },
  units: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(["update:isDialogVisible", "addConversion", "editConversion", "deleteConversion"])
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const unit_to_id = ref(null)
const unit_from_id = ref(null)
const warning = ref(null)
const error_exits = ref(null)
const success = ref(null)
const list_units = ref([])
const list_units_conversions = ref([])
const isLoadingConversions = ref(false)

// Variables para diálogo de eliminación
const isDeleteDialogVisible = ref(false)
const conversionToDelete = ref(null)

// Variables para NotificationToast
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const store = async () => {
  warning.value = null
  error_exits.value = null
  success.value = null
  loader.start()

  // Usar unitSelected si está disponible, si no usar unit_from_id del selector
  const selectedUnitId = props.unitSelected ? props.unitSelected.id : unit_from_id.value

  if (!selectedUnitId) {
    error_exits.value = "Debe seleccionar una unidad origen"
    showNotification('Debe seleccionar una unidad origen', 'error')
    loader.stop()
    return
  }

  if (!unit_to_id.value) {
    error_exits.value = "Debe seleccionar una unidad destino"
    showNotification('Debe seleccionar una unidad destino', 'error')
    loader.stop()
    return
  }

  let data = {
    unit_id: selectedUnitId,
    unit_to_id: unit_to_id.value,
  }

  try {
    const resp = await $api("unit-conversions", {
      method: "POST",
      body: data,
      onResponseError({ response }) {
        console.log('Error completo:', response._data)
        console.log('Errors específicos:', response._data.errors)
        error_exits.value = response._data.error
      },
    })

    console.log(resp)
    if (resp.message == 403 || resp.status == 403) {
      error_exits.value = resp.message_text || resp.message || 'Error de permisos'
      showNotification(resp.message_text || resp.message || 'Error de permisos', 'error')
    } else {
      success.value = "La conversión de unidad se ha registrado correctamente"
      showNotification('La conversión de unidad se a registrado correctamente', 'success')

      emit("addConversion", resp.unit_conversion)
      list_units_conversions.value.unshift(resp.unit_conversion)
      unit_to_id.value = null
      unit_from_id.value = null
      warning.value = null
      error_exits.value = null
      success.value = null

      //onFormReset();
    }
  } catch (error) {
    console.log(error)
    error_exits.value = "Error al registrar conversión"
    showNotification('Error al registrar conversión', 'error')
  } finally {
    loader.stop()
  }
}

const cleanFields = () => {
  unit_to_id.value = null
  unit_from_id.value = null
  warning.value = null
  error_exits.value = null
  success.value = null
}

const onFormReset = () => {
  cleanFields
  emit("update:isDialogVisible", false)
}

const dialogVisibleUpdate = val => {
  emit("update:isDialogVisible", val)
  if (!val) {
    onFormReset()
  }
}

// Cargar conversiones existentes de la unidad seleccionada
const loadUnitConversions = async () => {
  if (!props.unitSelected) return

  isLoadingConversions.value = true
  try {
    const resp = await $api(`unit-conversions?unit_id=${props.unitSelected.id}`, {
      method: "GET",
      onResponseError({ response }) {
        console.log('Error al cargar conversiones:', response._data.error)
        showNotification('Error al cargar conversiones existentes', 'error')
      },
    })

    console.log('Conversiones cargadas:', resp)
    list_units_conversions.value = resp.unit_conversions || []
  } catch (error) {
    console.log(error)
    list_units_conversions.value = []
    showNotification('Error al cargar conversiones existentes', 'error')
  } finally {
    isLoadingConversions.value = false
  }
}

// Cargar unidades desde props cuando el componente se monta
const loadUnits = () => {
  list_units.value = props.units || []
}

// Cargar unidades inmediatamente
loadUnits()

// Watch para actualizar las unidades cuando cambian los props
watch(() => props.units, newUnits => {
  list_units.value = newUnits || []
}, { immediate: true })

// Watch para cargar conversiones cuando cambia la unidad seleccionada
watch(() => props.unitSelected, newUnit => {
  if (newUnit) {
    loadUnitConversions()
  }
}, { immediate: true })

// Computed para filtrar unidades (excluir la unidad actual si hay unitSelected)
const filteredUnits = computed(() => {
  if (!list_units.value) return []

  // Si hay unitSelected, excluir esa unidad del selector de destino
  if (props.unitSelected) {
    return list_units.value.filter(unit => unit.id !== props.unitSelected.id)
  }

  // Si no hay unitSelected, mostrar todas las unidades para el selector de destino
  return list_units.value
})

// Función para abrir el diálogo de eliminar conversión
const deleteConversion = conversion => {
  conversionToDelete.value = conversion
  isDeleteDialogVisible.value = true
}

// Función para manejar la eliminación después de la confirmación
const handleConversionDeleted = conversionId => {
  // Eliminar de la lista local
  list_units_conversions.value = list_units_conversions.value.filter(item => item.id !== conversionId)
  showNotification('Conversión eliminada correctamente', 'success')
}

// Función para obtener el nombre de la unidad hacia la que se convierte
const getUnitToName = conversion => {
  // Intentar diferentes campos donde podría estar el nombre
  if (conversion.unit_to_name) return conversion.unit_to_name
  if (conversion.unit_to?.name) return conversion.unit_to.name
  if (conversion.unit?.name) return conversion.unit.name

  // Si no encontramos el nombre, buscar en la lista de unidades por ID
  const unitTo = list_units.value.find(unit => unit.id === conversion.unit_to_id)

  return unitTo ? unitTo.name : 'Unidad desconocida'
}

// Función helper para truncar texto
const truncateText = (text, maxLength = 25) => {
  if (!text) return 'N/A'

  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}
</script>

<template>
  <VDialog max-width="600" :model-value="props.isDialogVisible" persistent @update:model-value="dialogVisibleUpdate">
    <VCard class="pa-sm-10 pa-5">
      <!-- 👉 Botón cerrar -->
      <DialogCloseBtn variant="text" size="default" @click="onFormReset" />

      <!-- 👉 Header -->
      <VCardTitle class="d-flex align-center gap-2">
        <VIcon icon="ri-git-repository-commits-line" />
        <span>Agregar Conversión</span>
      </VCardTitle>

      <VDivider class="mb-6" />

      <!-- 👉 Form -->
      <VForm @submit.prevent="store">
        <VRow dense>
          <!-- UNIDAD ORIGEN (solo si no hay unitSelected) -->
          <VCol v-if="!props.unitSelected" cols="12">
            <VSelect v-model="unit_from_id" :items="list_units" item-title="name" item-value="id" label="Unidad Origen"
              variant="outlined" density="comfortable" prepend-inner-icon="ri-ruler-line" hide-details="auto" required
              placeholder="Selecciona la unidad de origen" />
          </VCol>

          <!-- UNITS TO -->
          <VCol cols="10">
            <VSelect v-model="unit_to_id" :items="filteredUnits" item-title="name" item-value="id"
              label="Unidad Destino" variant="outlined" density="comfortable" prepend-inner-icon="ri-ruler-line"
              hide-details="auto" required placeholder="Selecciona una unidad para convertir" />

            <div v-if="props.unitSelected" class="mt-2 text-caption text-medium-emphasis">
              <strong>Unidad actual:</strong>
              <h2>{{ props.unitSelected.name }}</h2>
            </div>
          </VCol>
          <VCol cols="2">
            <!-- 👉 Botón Agregar -->
            <VBtn type="submit" color="primary" prepend-icon="ri-add-line" :loading="loader.loading" />
          </VCol>
          <!-- Alertas -->
          <VCol v-if="warning" cols="12">
            <VAlert color="warning" variant="tonal" closable>
              {{ warning }}
            </VAlert>
          </VCol>

          <VCol v-if="error_exits" cols="12">
            <VAlert color="error" variant="tonal" closable>
              {{ error_exits }}
            </VAlert>
          </VCol>

          <VCol v-if="success" cols="12">
            <VAlert color="success" variant="tonal" closable>
              {{ success }}
            </VAlert>
          </VCol>

          <VDivider class="my-6" />
          <VCol cols="12">
            <VCol cols="12">
              <!-- Loader para conversiones -->
              <VCard v-if="isLoadingConversions" class="pa-4 text-center">
                <VProgressCircular indeterminate size="32" width="3" color="primary" />
                <div class="mt-2 text-body-2 text-medium-emphasis">
                  Cargando conversiones...
                </div>
              </VCard>

              <!-- Tabla de conversiones -->
              <VTable v-else-if="list_units_conversions.length > 0" class="table">
                <thead>
                  <tr>
                    <th>Unidad de medida</th>
                    <!-- <th>Factor</th> -->
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in list_units_conversions" :key="item.id">
                    <td>{{ getUnitToName(item) }}</td>
                    <!-- <td>{{ props.unitSelected.name }}</td> -->
                    <td style=" display: flex; justify-content: center; align-items: center; padding: 0;">
                      <VBtn icon variant="text" color="error" size="small" @click="deleteConversion(item)">
                        <VIcon icon="ri-delete-bin-line" />
                      </VBtn>
                    </td>
                  </tr>
                </tbody>
              </VTable>
              <div v-else class="text-center text-medium-emphasis pa-4">
                <VIcon icon="ri-information-line" size="32" class="mb-2" />
                <p>No hay conversiones registradas para esta unidad</p>
              </div>
            </VCol>
          </VCol>

          <!-- 👉 Actions -->
          <VCol cols="12" class="d-flex justify-center gap-4">
            <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" :disabled="loader.loading"
              @click="onFormReset">
              Cerrar
            </VBtn>
          </VCol>
        </VRow>
      </VForm>
    </VCard>
  </VDialog>

  <!-- Diálogo de Eliminar Conversión -->
  <UnitDeleteConversionDialog v-if="conversionToDelete" v-model:isDialogVisible="isDeleteDialogVisible"
    :conversion="conversionToDelete" :unit-selected="props.unitSelected" :units="list_units"
    @conversion-deleted="handleConversionDeleted" />

  <!-- NotificationToast -->
  <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>