<script setup>
import { ref, onMounted, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import WarehouseAddDialog from '@/components/inventory/config/warehouses/WarehouseAddDialog.vue'
import WarehouseEditDialog from '@/components/inventory/config/warehouses/WarehouseEditDialog.vue'
import WarehouseDeleteDialog from '@/components/inventory/config/warehouses/WarehouseDeleteDialog.vue'

const warehouseSelected = ref(null)

const { showNotification } = useGlobalToast()

const list_warehouses = ref([])
const search = ref(null)
const isLoading = ref(false)

const isWarehouseAddDialogVisible = ref(false)
const isWarehouseShowDialogVisible = ref(false)
const isWarehouseEditDialogVisible = ref(false)
const isWarehouseDeleteDialogVisible = ref(false)

// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    list()
  }, 500)
})

const list = async () => {
  isLoading.value = true

  try {
    const resp = await $api("warehouses?search=" + (search.value ? search.value : ""), {
      method: "GET",
      onResponseError({ response }) {
        console.log(response._data.error)
      },
    })

    list_warehouses.value = resp.warehouses
    console.log(list_warehouses.value)

    // Manejar diferentes estructuras de respuesta
    if (resp.warehouses) {
      list_warehouses.value = resp.warehouses
    } else {
      list_warehouses.value = []
    }

    showNotification('Lista de almacenes cargada correctamente', 'success')
  } catch (error) {
    console.error(error)
    showNotification('Error al cargar la lista de almacenes', 'error')
  } finally {
    isLoading.value = false
  }
}

const showItem = showWarehouse => {
  console.log(showWarehouse)
  isWarehouseShowDialogVisible.value = true
  warehouseSelected.value = showWarehouse
}

const editWarehouse = editWarehouse => {
  console.log(editWarehouse)
  isWarehouseEditDialogVisible.value = true
  warehouseSelected.value = editWarehouse
}

const deleteWarehouse = DeleteWarehouse => {
  warehouseSelected.value = DeleteWarehouse
  isWarehouseDeleteDialogVisible.value = true
  console.log(DeleteWarehouse)
}

const confirmDeleteWarehouse = async warehouse => {
  console.log(warehouse)
  let backup = list_warehouses.value
  list_warehouses.value = []
  let INDEX = backup.findIndex(wh => wh.id == warehouse.id)
  if (INDEX != -1) {
    backup.splice(INDEX, 1)
  }
  setTimeout(() => {
    list_warehouses.value = backup
  }, 50)
}


const addWarehouse = newWarehouse => {
  console.log('Almacén:', newWarehouse)
  list_warehouses.value.unshift(newWarehouse)
  showNotification('Almacén agregado correctamente a la tabla', 'success')
}

const updateWarehouse = updatedWarehouse => {
  console.log('Actualizando almacén:', updatedWarehouse)

  const index = list_warehouses.value.findIndex(warehouse => warehouse.id === updatedWarehouse.id)

  if (index !== -1) {
    list_warehouses.value[index] = updatedWarehouse
    showNotification('Almacén actualizado correctamente en la tabla', 'success')
  } else {
    console.warn('Almacén no encontrado en la lista, recargando...')
    list()
  }
}

const refresh = () => {
  search.value = null
  list()
}

const formatDate = date => {
  if (!date) return '-'
  const d = new Date(date)

  return isNaN(d) ? '-' : d.toISOString().slice(0, 10)
}

onMounted(() => {
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 warehouses-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-store-2-line" color="primary" class="me-2" size="28" />
          Almacenes
        </h1>
        <p class="text-medium-emphasis mb-0">
          Administración y control de almacenes
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="primary" prepend-icon="ri-add-circle-line"
          @click="isWarehouseAddDialogVisible = !isWarehouseAddDialogVisible">
          Nuevo Almacén
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12">
            <VTextField v-model="search" label="Buscar almacén" placeholder="Nombre, dirección..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto" clearable
              color="primary" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Almacenes -->
      <div class="position-relative">
        <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />
        <div class="overflow-x-auto">
          <VTable hover class="warehouses-table">
            <thead>
              <tr>
                <th class="text-center font-weight-bold text-uppercase" style="width: 60px;">#</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">NOMBRE</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 250px;">DIRECCIÓN</th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 120px;">ESTADO</th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">FECHA REG.</th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">ACCIONES</th>
              </tr>
            </thead>
            <tbody v-if="isLoading">
              <tr>
                <td colspan="6" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">Cargando registros...</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!list_warehouses || list_warehouses.length === 0">
              <tr>
                <td colspan="6" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">ri-inbox-line</VIcon>
                  <div class="text-h6">No hay almacenes registrados</div>
                  <div class="text-body-2">Intenta ajustar los filtros de búsqueda</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="warehouse in list_warehouses" :key="warehouse.id" class="warehouses-row align-middle">
                <td class="text-center py-3">
                  <span class="font-weight-bold text-subtitle-1 text-primary">{{ warehouse.id }}</span>
                </td>
                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4 text-uppercase">
                    {{ warehouse.name }}
                  </span>
                </td>
                <td class="text-left py-3" style="max-width: 250px;">
                  <span class="text-body-2 text-grey-darken-3 text-truncate" :title="warehouse.address">
                    {{ warehouse.address }}
                  </span>
                </td>
                <td class="text-left py-3">
                  <VChip :color="Number(warehouse.state) === 0 ? 'success' : 'error'" variant="tonal" size="small">
                    {{ Number(warehouse.state) === 0 ? 'Activo' : 'Inactivo' }}
                  </VChip>
                </td>
                <td class="text-no-wrap text-left py-3">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                    <span class="text-body-2 text-medium-emphasis">
                      {{ formatDate(warehouse.created_at) }}
                    </span>
                  </div>
                </td>
                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver detalle"
                      @click="showItem(warehouse)">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>
                    <VBtn class="action-btn" variant="text" icon size="small" color="primary" title="Editar"
                      @click="editWarehouse(warehouse)">
                      <VIcon icon="ri-pencil-line" size="20" />
                    </VBtn>
                    <VBtn class="action-btn" variant="text" icon size="small" color="error" title="Eliminar"
                      @click="deleteWarehouse(warehouse)">
                      <VIcon icon="ri-delete-bin-6-line" size="20" />
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
            Mostrando <span class="font-weight-bold">{{ list_warehouses.length }}</span> registros
          </div>
        </div>
      </VCardActions>
    </VCard>

    <!-- DIALOG -->
    <WarehouseAddDialog v-model:isDialogVisible="isWarehouseAddDialogVisible" @add-warehouse="addWarehouse" />
    <WarehouseEditDialog v-if="isWarehouseEditDialogVisible && warehouseSelected"
      v-model:isDialogVisible="isWarehouseEditDialogVisible" :warehouse-selected="warehouseSelected"
      @update-warehouse="updateWarehouse" />
    <WarehouseDeleteDialog v-if="isWarehouseDeleteDialogVisible && warehouseSelected"
      v-model:isDialogVisible="isWarehouseDeleteDialogVisible" :warehouse-selected="warehouseSelected"
      @delete-warehouse="confirmDeleteWarehouse" />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de almacenes */
.warehouses-table :deep(thead) {
  background-color: #f8fafc !important;
}

.warehouses-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.warehouses-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.warehouses-row:hover {
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
