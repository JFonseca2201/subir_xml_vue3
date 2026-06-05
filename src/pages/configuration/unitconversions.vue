<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'
import UnitAddConversionDialog from '@/components/inventory/config/unit_conversions/UnitAddConversionDialog.vue'
import UnitDeleteConversionDialog from '@/components/inventory/config/unit_conversions/UnitDeleteConversionDialog.vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

const headers = [
  {
    title: "Unidad Origen",
    key: "from_unit",
  },
  {
    title: "Unidad Destino",
    key: "to_unit",
  },
  {
    title: "Factor",
    key: "factor",
  },
  {
    title: "Acciones",
    key: "action",
  },
]

const isUnitAddConversionDialogVisible = ref(false)
const isUnitDeleteConversionDialogVisible = ref(false)

const list_conversions = ref([])
const list_units = ref([])
const conversion_selected_edit = ref(null)
const conversion_selected_delete = ref(null)

const isLoading = ref(false)

const list = async () => {
  isLoading.value = true
  try {
    const [conversionsResp, unitsResp] = await Promise.all([
      $api("unit-conversions", {
        method: "GET",
        onResponseError({ response }) {
          console.log(response._data.error)
          showNotification('Error al cargar las conversiones', 'error')
        },
      }),
      $api("units", {
        method: "GET",
        params: { per_page: 1000 },
        onResponseError({ response }) {
          console.log(response._data.error)
          showNotification('Error al cargar las unidades', 'error')
        },
      }),
    ])

    console.log(conversionsResp)
    list_conversions.value = conversionsResp.conversions || []
    list_units.value = unitsResp.units || []
    showNotification('Lista de conversiones cargada correctamente', 'success')
  } catch (error) {
    console.log(error)
    showNotification('Error al cargar la lista de conversiones', 'error')
  } finally {
    isLoading.value = false
  }
}

const addNewConversion = newConversion => {
  console.log(newConversion)
  let backup = list_conversions.value
  list_conversions.value = []
  backup.unshift(newConversion)
  setTimeout(() => {
    list_conversions.value = backup
  }, 50)
  showNotification('Conversión agregada correctamente', 'success')
}

const addEditConversion = editConversion => {
  console.log(editConversion)
  let backup = list_conversions.value
  list_conversions.value = []
  let INDEX = backup.findIndex(conv => conv.id == editConversion.id)
  if (INDEX != -1) {
    backup[INDEX] = editConversion
  }
  setTimeout(() => {
    list_conversions.value = backup
  }, 50)
  showNotification('Conversión actualizada correctamente', 'success')
}

const addDeleteConversion = deletedConversion => {
  console.log('Conversión eliminada:', deletedConversion)

  if (!deletedConversion || !deletedConversion.id) {
    console.error('Conversión eliminada no válida:', deletedConversion)
    showNotification('Error: datos de la conversión no válidos', 'error')
    return
  }

  let backup = list_conversions.value
  list_conversions.value = []
  let INDEX = backup.findIndex(conv => conv.id == deletedConversion.id)

  if (INDEX !== -1) {
    backup.splice(INDEX, 1)
    console.log('Conversión eliminada de la lista en índice:', INDEX)
  } else {
    console.warn('No se encontró la conversión en la lista local')
    list()
    return
  }

  setTimeout(() => {
    list_conversions.value = backup
    showNotification('Conversión eliminada correctamente', 'success')
  }, 50)
}

const editItem = item => {
  console.log(item)
  isUnitAddConversionDialogVisible.value = true
  conversion_selected_edit.value = item
}

const deleteItem = item => {
  isUnitDeleteConversionDialogVisible.value = true
  conversion_selected_delete.value = item
}

onMounted(() => {
  list()
})

definePage({ meta: { permission: "settings" } })
</script>

<template>
  <div class="pa-4 pa-sm-6 unit-conversions-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-file-ppt-2-line" color="primary" class="me-2" size="28" />
          Conversiones de Unidades
        </h1>
        <p class="text-medium-emphasis mb-0">
          Administración de conversiones entre unidades de medida
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="primary" prepend-icon="ri-add-line"
          @click="isUnitAddConversionDialogVisible = !isUnitAddConversionDialogVisible">
          Nueva Conversión
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Tabla de Conversiones -->
      <div class="position-relative">
        <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />
        <div class="overflow-x-auto">
          <VTable hover class="conversions-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">UNIDAD ORIGEN</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">UNIDAD DESTINO</th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 120px;">FACTOR</th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 120px;">ACCIONES</th>
              </tr>
            </thead>
            <tbody v-if="isLoading">
              <tr>
                <td colspan="4" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">Cargando registros...</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!list_conversions || list_conversions.length === 0">
              <tr>
                <td colspan="4" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">ri-file-ppt-2-line</VIcon>
                  <div class="text-h6">No hay conversiones registradas</div>
                  <div class="text-body-2">Agrega conversiones entre unidades de medida</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="item in list_conversions" :key="item.id" class="conversions-row align-middle">
                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4">
                    {{ item.from_unit?.name || 'Sin nombre' }}
                  </span>
                  <VChip size="x-small" class="ml-2" :color="item.from_unit?.category === 'volume' ? 'info' : 'success'"
                    variant="tonal">
                    {{ item.from_unit?.code || '' }}
                  </VChip>
                </td>
                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4">
                    {{ item.to_unit?.name || 'Sin nombre' }}
                  </span>
                  <VChip size="x-small" class="ml-2" :color="item.to_unit?.category === 'volume' ? 'info' : 'success'"
                    variant="tonal">
                    {{ item.to_unit?.code || '' }}
                  </VChip>
                </td>
                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3 font-weight-medium">
                    {{ item.factor }}
                  </span>
                </td>
                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <VBtn class="action-btn" variant="text" icon size="small" color="primary" title="Editar"
                      @click="editItem(item)">
                      <VIcon icon="ri-pencil-line" size="20" />
                    </VBtn>
                    <VBtn class="action-btn" variant="text" icon size="small" color="error" title="Eliminar"
                      @click="deleteItem(item)">
                      <VIcon icon="ri-delete-bin-line" size="20" />
                    </VBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>
    </VCard>

    <!-- DIALOGS -->
    <UnitAddConversionDialog v-model:isDialogVisible="isUnitAddConversionDialogVisible"
      :unit-selected="conversion_selected_edit" :units="list_units" @add-conversion="addNewConversion"
      @edit-conversion="addEditConversion" />

    <UnitDeleteConversionDialog v-if="conversion_selected_delete && isUnitDeleteConversionDialogVisible"
      v-model:isDialogVisible="isUnitDeleteConversionDialogVisible" :conversion-selected="conversion_selected_delete"
      @delete-conversion="addDeleteConversion" />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de conversiones */
.conversions-table :deep(thead) {
  background-color: #f8fafc !important;
}

.conversions-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.conversions-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.conversions-row:hover {
  background-color: #f8fafc !important;
}

.action-btn {
  transition: all 0.2s ease;
  border-radius: 6px !important;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}
</style>
