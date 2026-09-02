<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import WarehouseAddDialog from '@/components/inventory/config/warehouses/WarehouseAddDialog.vue'
import WarehouseEditDialog from '@/components/inventory/config/warehouses/WarehouseEditDialog.vue'
import WarehouseDeleteDialog from '@/components/inventory/config/warehouses/WarehouseDeleteDialog.vue'
import { useLoaderStore } from '@/stores/loader'

const warehouseSelected = ref(null)
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const list_warehouses = ref([])
const search = ref(null)
const isLoading = ref(false)

const isWarehouseAddDialogVisible = ref(false)
const isWarehouseShowDialogVisible = ref(false)
const isWarehouseEditDialogVisible = ref(false)
const isWarehouseDeleteDialogVisible = ref(false)

// Métricas computadas
const activeWarehousesCount = computed(() => {
  return list_warehouses.value.filter(w => parseInt(w.state) === 1 || w.state === 'active').length
})

const warehousesWithAddressCount = computed(() => {
  return list_warehouses.value.filter(w => !!w.address).length
})

const hasActiveFilters = computed(() => {
  return !!(search.value && search.value.trim())
})

const resetFilters = () => {
  search.value = null
  list()
}

// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    list()
  }, 400)
})

const list = async () => {
  isLoading.value = true

  try {
    const resp = await $api("warehouses?search=" + (search.value ? search.value : ""), {
      method: "GET",
      onResponseError({ response }) {
        console.log(response._data?.error)
      },
    })

    list_warehouses.value = resp.warehouses || []
  } catch (error) {
    console.error(error)
    showNotification('Error al cargar la lista de almacenes', 'error')
  } finally {
    isLoading.value = false
  }
}

const editWarehouse = editWh => {
  warehouseSelected.value = editWh
  isWarehouseEditDialogVisible.value = true
}

const deleteWarehouse = delWh => {
  warehouseSelected.value = delWh
  isWarehouseDeleteDialogVisible.value = true
}

const confirmDeleteWarehouse = async warehouse => {
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
  list_warehouses.value.unshift(newWarehouse)
  showNotification('Almacén agregado correctamente', 'success')
}

const updateWarehouse = updatedWarehouse => {
  const index = list_warehouses.value.findIndex(warehouse => warehouse.id === updatedWarehouse.id)
  if (index !== -1) {
    list_warehouses.value[index] = updatedWarehouse
    showNotification('Almacén actualizado correctamente', 'success')
  } else {
    list()
  }
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
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-store-3-line" size="26" />
          </VAvatar>
          Gestión de Almacenes
        </h1>
        <p class="text-medium-emphasis mb-0">
          Control de bodegas, puntos de almacenamiento de stock e inventario
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="isWarehouseAddDialogVisible = true"
        >
          Nuevo Almacén
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-building-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Almacenes Registrados</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_warehouses.length }} <span class="text-caption text-disabled font-weight-regular">en sistema</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-checkbox-circle-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Almacenes Operativos</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ activeWarehousesCount }} <span class="text-caption text-disabled font-weight-regular">activos</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-map-pin-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Con Dirección Localizada</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ warehousesWithAddressCount }} <span class="text-caption text-disabled font-weight-regular">almacenes</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon icon="ri-filter-3-line" size="18" color="primary" />
            <span>Filtros de Búsqueda</span>
          </div>

          <VBtn
            v-if="hasActiveFilters"
            variant="text"
            color="error"
            size="small"
            prepend-icon="ri-filter-off-line"
            class="font-weight-semibold"
            @click="resetFilters"
          >
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow dense class="gap-y-3">
          <VCol cols="12">
            <VTextField
              v-model="search"
              label="Buscar almacén"
              placeholder="Nombre, dirección o referencia..."
              prepend-inner-icon="ri-search-2-line"
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

    <!-- ESTADO DE CARGA -->
    <VCard v-if="isLoading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 70px;"><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-60" /></td>
            <td class="py-4" style="width: 120px;"><div class="shimmer-chip" /></td>
            <td class="py-4" style="width: 130px;"><div class="shimmer-line w-50" /></td>
            <td class="py-4 text-center" style="width: 120px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_warehouses || list_warehouses.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-store-3-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron almacenes
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los criterios de búsqueda o registra un nuevo almacén en el sistema.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" @click="isWarehouseAddDialogVisible = true">
          Nuevo Almacén
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE ALMACENES -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="warehouses-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Almacén
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 280px;">
                Dirección
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px;">
                Estado
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 140px;">
                Fecha Reg.
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="warehouse in list_warehouses" :key="warehouse.id" class="warehouse-table-row">
              <td class="font-weight-bold text-disabled">
                #{{ warehouse.id }}
              </td>

              <!-- Almacén con Avatar -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar color="primary" variant="tonal" size="38" rounded="lg" class="elevation-0">
                    <VIcon icon="ri-store-3-line" size="22" />
                  </VAvatar>
                  <div>
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                      {{ warehouse.name }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Dirección (Texto limpio sin vchip) -->
              <td class="py-3">
                <div class="d-flex align-center gap-1.5 text-medium-emphasis text-body-2">
                  <VIcon icon="ri-map-pin-line" size="16" class="text-disabled flex-shrink-0" />
                  <span class="text-truncate" style="max-width: 280px;" :title="warehouse.address">
                    {{ warehouse.address || 'Sin dirección registrada' }}
                  </span>
                </div>
              </td>

              <!-- Estado -->
              <td class="text-center">
                <VChip
                  :color="parseInt(warehouse.state) === 1 || warehouse.state === 'active' ? 'success' : 'error'"
                  size="small"
                  variant="tonal"
                  class="font-weight-semibold"
                >
                  <VIcon :icon="parseInt(warehouse.state) === 1 || warehouse.state === 'active' ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'" size="14" class="me-1" />
                  {{ parseInt(warehouse.state) === 1 || warehouse.state === 'active' ? 'ACTIVO' : 'INACTIVO' }}
                </VChip>
              </td>

              <!-- Fecha -->
              <td class="py-3">
                <span class="text-caption text-medium-emphasis">
                  {{ formatDate(warehouse.created_at) }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="text-center">
                <div class="d-flex justify-center align-center gap-1">
                  <VBtn
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Almacén"
                    @click="editWarehouse(warehouse)"
                  />
                  <VBtn
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Almacén"
                    @click="deleteWarehouse(warehouse)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Resumen -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_warehouses.length }}</strong> almacenes registrados
          </div>
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <WarehouseAddDialog
      v-model:isDialogVisible="isWarehouseAddDialogVisible"
      @add-warehouse="addWarehouse"
    />
    <WarehouseEditDialog
      v-if="isWarehouseEditDialogVisible"
      v-model:isDialogVisible="isWarehouseEditDialogVisible"
      :warehouse-selected="warehouseSelected"
      @update-warehouse="updateWarehouse"
    />
    <WarehouseDeleteDialog
      v-if="isWarehouseDeleteDialogVisible"
      v-model:isDialogVisible="isWarehouseDeleteDialogVisible"
      :warehouse-selected="warehouseSelected"
      @delete-warehouse="confirmDeleteWarehouse"
    />
  </div>
</template>

<style scoped lang="scss">
.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.warehouse-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}
</style>
