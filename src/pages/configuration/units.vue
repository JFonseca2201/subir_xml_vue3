<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'
import UnitAddDialog from '@/components/inventory/config/units/UnitAddDialog.vue'
import UnitEditDialog from '@/components/inventory/config/units/UnitEditDialog.vue'
import UnitDeleteDialog from '@/components/inventory/config/units/UnitDeleteDialog.vue'
import UnitAddConversionDialog from '@/components/inventory/config/unit_conversions/UnitAddConversionDialog.vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

const headers = [
  {
    title: "Unidad",
    key: "name",
  },
  {
    title: "Descripción",
    key: "description",
  },
  {
    title: "Estado",
    key: "state",
  },
  {
    title: "Fecha de registro",
    key: "created_at",
  },
  {
    title: "Acciones",
    key: "action",
  },
]

const isUnitAddDialogVisible = ref(false)
const isUnitEditDialogVisible = ref(false)
const isUnitDeleteDialogVisible = ref(false)
const isUnitAddConversionDialogVisible = ref(false)

const list_units = ref([])
const searchQuery = ref(null)
const unit_selected_edit = ref(null)
const unit_selected_delete = ref(null)
const unit_selected_conversion = ref(null)

const isLoading = ref(false) // Loader global para la tabla
const currentPage = ref(1)
const totalPage = ref(1)
const itemsPerPage = 5

const list = async () => {
  isLoading.value = true // Activar loader
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage,
      search: searchQuery.value || '',
    }

    const resp = await $api("units", {
      method: "GET",
      params,
      onResponseError({ response }) {
        console.log(response._data.error)
        showNotification('Error al cargar unidades', 'error')
      },
    })

    console.log(resp)
    list_units.value = resp.units || []

    // Manejar diferentes estructuras de respuesta de paginación
    if (resp.total_pages) {
      totalPage.value = resp.total_pages
    } else if (resp.total) {
      totalPage.value = Math.ceil(resp.total / itemsPerPage)
    } else {
      totalPage.value = 1
    }

    if (resp.current_page) {
      currentPage.value = resp.current_page
    }

    showNotification('Lista de unidades cargada correctamente', 'success')
  } catch (error) {
    console.log(error)
    showNotification('Error al cargar la lista de unidades', 'error')
  } finally {
    isLoading.value = false // Ocultar overlay
  }
}

const addNewUnit = NewUnit => {
  console.log(NewUnit)
  let backup = list_units.value
  list_units.value = []
  backup.unshift(NewUnit)
  setTimeout(() => {
    list_units.value = backup
    showNotification('Unidad agregada correctamente', 'success')
  }, 50)
}

const addEditUnit = editUnit => {
  console.log(editUnit)
  let backup = list_units.value
  list_units.value = []
  let INDEX = backup.findIndex(unit => unit.id == editUnit.id)
  if (INDEX != -1) {
    backup[INDEX] = editUnit
  }
  setTimeout(() => {
    list_units.value = backup
    showNotification('Unidad actualizada correctamente', 'success')
  }, 50)
}

const addDeleteUnit = Unit => {
  console.log(Unit)
  let backup = list_units.value
  list_units.value = []
  let INDEX = backup.findIndex(unit => unit.id == Unit.id)
  if (INDEX != -1) {
    backup.splice(INDEX, 1)
  }
  setTimeout(() => {
    list_units.value = backup
    showNotification('Unidad eliminada correctamente', 'success')
  }, 50)
}

const editItem = item => {
  console.log(item)
  isUnitEditDialogVisible.value = true
  unit_selected_edit.value = item
}

const deleteItem = item => {
  isUnitDeleteDialogVisible.value = true
  unit_selected_delete.value = item
}

const addConversion = item => {
  isUnitAddConversionDialogVisible.value = true
  unit_selected_conversion.value = item
}

const refresh = () => {
  searchQuery.value = null
  currentPage.value = 1
  list()
}

// Watcher para cambiar de página
watch(currentPage, () => {
  list()
})

// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    list()
  }, 500)
})

// Función helper para truncar texto
const truncateText = (text, maxLength = 25) => {
  if (!text) return ''

  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

onMounted(() => {
  list()
})

definePage({ meta: { permission: "settings" } })
</script>

<template>
  <div class="pa-4 pa-sm-6 units-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-ruler-line" color="primary" class="me-2" size="28" />
          Unidades
        </h1>
        <p class="text-medium-emphasis mb-0">
          Administración de unidades de medida
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn color="primary" prepend-icon="ri-add-line" @click="isUnitAddDialogVisible = !isUnitAddDialogVisible">
          Nueva Unidad
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12">
            <VTextField v-model="searchQuery" label="Buscar unidad" placeholder="Nombre, descripción..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto" clearable
              color="primary" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Unidades -->
      <div class="position-relative">
        <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />
        <div class="overflow-x-auto">
          <VTable hover class="units-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">UNIDAD</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 250px;">DESCRIPCIÓN</th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 120px;">ESTADO</th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">FECHA REG.</th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 120px;">ACCIONES</th>
              </tr>
            </thead>
            <tbody v-if="isLoading">
              <tr>
                <td colspan="5" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">Cargando registros...</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!list_units || list_units.length === 0">
              <tr>
                <td colspan="5" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">ri-ruler-line</VIcon>
                  <div class="text-h6">No hay unidades registradas</div>
                  <div class="text-body-2">Intenta ajustar los filtros de búsqueda</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="item in list_units" :key="item.id" class="units-row align-middle">
                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4">
                    {{ item.name }}
                  </span>
                </td>
                <td class="text-left py-3" style="max-width: 250px;">
                  <span class="text-body-2 text-grey-darken-3 text-truncate" :title="item.description">
                    {{ truncateText(item.description) }}
                  </span>
                </td>
                <td class="text-left py-3">
                  <VChip v-if="item.state == 1" size="small" color="success" variant="tonal">
                    Activo
                  </VChip>
                  <VChip v-if="item.state == 2" size="small" color="error" variant="tonal">
                    Inactivo
                  </VChip>
                </td>
                <td class="text-no-wrap text-left py-3">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                    <span class="text-body-2 text-medium-emphasis">
                      {{ new Date(item.created_at).toLocaleDateString('es-EC', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }) }}
                    </span>
                  </div>
                </td>
                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <VBtn class="action-btn" variant="text" icon size="small" color="primary" title="Conversiones"
                      @click="addConversion(item)">
                      <VIcon icon="ri-git-repository-commits-line" size="20" />
                    </VBtn>
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

      <VDivider />

      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ list_units.length }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPage" rounded="circle" :total-visible="7" color="primary" />
        </div>
      </VCardActions>
    </VCard>

    <!-- DIALOGS -->
    <UnitAddDialog v-model:isDialogVisible="isUnitAddDialogVisible" @add-unit="addNewUnit" />
    <UnitAddConversionDialog v-if="unit_selected_conversion && isUnitAddConversionDialogVisible"
      v-model:isDialogVisible="isUnitAddConversionDialogVisible" :unit-selected="unit_selected_conversion"
      :units="list_units" />

    <UnitEditDialog v-if="unit_selected_edit && isUnitEditDialogVisible"
      v-model:isDialogVisible="isUnitEditDialogVisible" :unit-selected="unit_selected_edit" @edit-unit="addEditUnit" />

    <UnitDeleteDialog v-if="unit_selected_delete && isUnitDeleteDialogVisible"
      v-model:isDialogVisible="isUnitDeleteDialogVisible" :unit-selected="unit_selected_delete"
      @delete-unit="addDeleteUnit" />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de unidades */
.units-table :deep(thead) {
  background-color: #f8fafc !important;
}

.units-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.units-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.units-row:hover {
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
