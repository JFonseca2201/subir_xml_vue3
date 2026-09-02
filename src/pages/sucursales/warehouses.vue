<script setup>
import { ref, onMounted, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import WarehouseAddDialog from '@/components/inventory/config/warehouses/WarehouseAddDialog.vue'
import WarehouseEditDialog from '@/components/inventory/config/warehouses/WarehouseEditDialog.vue'
import WarehouseDeleteDialog from '@/components/inventory/config/warehouses/WarehouseDeleteDialog.vue'

const warehouseSelected = ref(null)

const { showNotification } = useGlobalToast()
import { useLoaderStore } from '@/stores/loader'

const loader = useLoaderStore()

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

    list_warehouses.value = resp.warehouses || []

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

  return isNaN(d) ? '-' : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

onMounted(() => {
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 warehouses-management-page">
    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="44" class="elevation-1">
            <VIcon icon="ri-store-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Almacenes
              </h1>
              <VChip size="small" color="primary" variant="tonal" class="font-weight-bold">
                {{ list_warehouses.length }} {{ list_warehouses.length === 1 ? 'registro' : 'registros' }}
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Administración y control de almacenes
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-3 flex-wrap">
          <VBtn
            color="primary"
            variant="elevated"
            size="small"
            prepend-icon="ri-add-line"
            class="font-weight-semibold elevation-2"
            @click="isWarehouseAddDialogVisible = !isWarehouseAddDialogVisible"
          >
            Nuevo Almacén
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Filtros y Búsqueda -->
    <VCard class="mb-5 rounded-xl border-light elevation-1">
      <VCardText class="pa-3 pa-sm-4 bg-white">
        <VRow class="align-center">
          <VCol cols="12">
            <VTextField
              v-model="search"
              label="Buscar almacén"
              placeholder="Nombre, dirección..."
              prepend-inner-icon="ri-search-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              :loading="isLoading"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Contenedor Principal (Tabla) -->
    <VCard class="rounded-xl border-light overflow-hidden elevation-1">
      <!-- Tabla de Almacenes -->
      <div class="position-relative">
        <div class="overflow-x-auto">
          <VTable
            hover
            class="warehouses-table"
          >
            <thead>
              <tr>
                <th
                  class="text-center font-weight-bold text-uppercase"
                  style="width: 60px;"
                >
                  #
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="min-width: 200px;"
                >
                  NOMBRE
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="min-width: 250px;"
                >
                  DIRECCIÓN
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="width: 120px;"
                >
                  ESTADO
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="width: 150px;"
                >
                  FECHA REG.
                </th>
                <th
                  class="text-center font-weight-bold text-uppercase"
                  style="width: 90px;"
                >
                  ACCIONES
                </th>
              </tr>
            </thead>

            <!-- Cargando (Skeleton Rows) -->
            <tbody v-if="isLoading">
              <tr
                v-for="n in 5"
                :key="n"
                class="skeleton-row align-middle"
              >
                <td class="text-center py-4">
                  <div class="shimmer-line w-40 mx-auto" />
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-75 mb-1" />
                  <div class="shimmer-line w-50" />
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-75" />
                </td>
                <td class="py-4">
                  <div class="shimmer-chip" />
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-60" />
                </td>
                <td class="text-center py-4">
                  <div class="d-flex justify-center gap-1">
                    <div class="shimmer-button rounded" />
                    <div class="shimmer-button rounded" />
                    <div class="shimmer-button rounded" />
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else-if="!list_warehouses || list_warehouses.length === 0">
              <tr>
                <td
                  colspan="6"
                  class="text-center pa-8 text-medium-emphasis"
                >
                  <VIcon
                    size="48"
                    class="mb-3"
                    color="grey-lighten-1"
                  >
                    ri-inbox-line
                  </VIcon>
                  <div class="text-h6">
                    No hay almacenes registrados
                  </div>
                  <div class="text-body-2">
                    Intenta ajustar los filtros de búsqueda
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr
                v-for="warehouse in list_warehouses"
                :key="warehouse.id"
                class="warehouses-row align-middle"
              >
                <td class="text-center py-3">
                  <span class="font-weight-bold text-subtitle-1 text-primary">{{ warehouse.id }}</span>
                </td>
                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4 text-uppercase">
                    {{ warehouse.name }}
                  </span>
                </td>
                <td
                  class="text-left py-3"
                  style="max-width: 250px;"
                >
                  <span
                    class="text-body-2 text-grey-darken-3 text-truncate"
                    :title="warehouse.address"
                  >
                    {{ warehouse.address }}
                  </span>
                </td>
                <td class="text-left py-3">
                  <VChip
                    :color="Number(warehouse.state) === 0 ? 'success' : 'error'"
                    variant="tonal"
                    size="small"
                  >
                    {{ Number(warehouse.state) === 0 ? 'Activo' : 'Inactivo' }}
                  </VChip>
                </td>
                <td class="text-no-wrap text-left py-3">
                  <div class="d-flex align-center">
                    <VIcon
                      icon="ri-calendar-line"
                      size="14"
                      class="mr-1 text-grey"
                    />
                    <span class="text-body-2 text-medium-emphasis">
                      {{ formatDate(warehouse.created_at) }}
                    </span>
                  </div>
                </td>
                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center gap-1">
                    <VBtn
                      class="action-btn"
                      variant="text"
                      icon="ri-eye-line"
                      size="small"
                      color="info"
                      title="Ver detalle"
                      @click="showItem(warehouse)"
                    />
                    <VBtn
                      class="action-btn"
                      variant="text"
                      icon="ri-pencil-line"
                      size="small"
                      color="primary"
                      title="Editar"
                      @click="editWarehouse(warehouse)"
                    />
                    <VBtn
                      class="action-btn"
                      variant="text"
                      icon="ri-delete-bin-line"
                      size="small"
                      color="error"
                      title="Eliminar"
                      @click="deleteWarehouse(warehouse)"
                    />
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
    <WarehouseAddDialog
      v-model:isDialogVisible="isWarehouseAddDialogVisible"
      @add-warehouse="addWarehouse"
    />
    <WarehouseEditDialog
      v-if="isWarehouseEditDialogVisible && warehouseSelected"
      v-model:isDialogVisible="isWarehouseEditDialogVisible"
      :warehouse-selected="warehouseSelected"
      @update-warehouse="updateWarehouse"
    />
    <WarehouseDeleteDialog
      v-if="isWarehouseDeleteDialogVisible && warehouseSelected"
      v-model:isDialogVisible="isWarehouseDeleteDialogVisible"
      :warehouse-selected="warehouseSelected"
      @delete-warehouse="confirmDeleteWarehouse"
    />
  </div>
</template>
