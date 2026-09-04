<script setup>
/* eslint-disable camelcase */
import { ref, onMounted, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import UnitAddDialog from '@/components/inventory/config/units/UnitAddDialog.vue'
import UnitEditDialog from '@/components/inventory/config/units/UnitEditDialog.vue'
import UnitDeleteDialog from '@/components/inventory/config/units/UnitDeleteDialog.vue'
import UnitAddConversionDialog from '@/components/inventory/config/unit_conversions/UnitAddConversionDialog.vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const isUnitAddDialogVisible = ref(false)
const isUnitEditDialogVisible = ref(false)
const isUnitDeleteDialogVisible = ref(false)
const isUnitAddConversionDialogVisible = ref(false)

const list_units = ref([])
const searchQuery = ref(null)
const unit_selected_edit = ref(null)
const unit_selected_delete = ref(null)
const unit_selected_conversion = ref(null)

const isLoading = ref(false)
const currentPage = ref(1)
const totalPage = ref(1)
const itemsPerPage = 10

// Métricas computadas
const activeUnitsCount = computed(() => {
  return list_units.value.filter(u => parseInt(u.state) === 1).length
})

const unitsWithDescCount = computed(() => {
  return list_units.value.filter(u => !!u.description).length
})

const hasActiveFilters = computed(() => {
  return !!(searchQuery.value && searchQuery.value.trim())
})

const resetFilters = () => {
  searchQuery.value = null
  currentPage.value = 1
  list()
}

const list = async () => {
  isLoading.value = true
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
        console.log(response._data?.error)
      },
    })

    list_units.value = resp.units || []

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
  } catch (error) {
    console.log(error)
    showNotification('Error al cargar la lista de unidades', 'error')
  } finally {
    isLoading.value = false
  }
}

const addNewUnit = NewUnit => {
  list_units.value.unshift(NewUnit)
  showNotification('Unidad agregada correctamente', 'success')
}

const addEditUnit = editUnit => {
  const index = list_units.value.findIndex(unit => unit.id == editUnit.id)
  if (index !== -1) {
    list_units.value[index] = editUnit
    showNotification('Unidad actualizada correctamente', 'success')
  } else {
    list()
  }
}

const addDeleteUnit = Unit => {
  const index = list_units.value.findIndex(unit => unit.id == Unit.id)
  if (index !== -1) {
    list_units.value.splice(index, 1)
    showNotification('Unidad eliminada correctamente', 'success')
  }
}

const editItem = item => {
  isUnitEditDialogVisible.value = true
  unit_selected_edit.value = item
}

const deleteItem = item => {
  isUnitDeleteDialogVisible.value = true
  unit_selected_delete.value = item
}

const addConversion = item => {
  unit_selected_conversion.value = item
  isUnitAddConversionDialogVisible.value = true
}

let searchTimeout = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    list()
  }, 400)
})

onMounted(() => {
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 units-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-ruler-2-line" size="26" />
          </VAvatar>
          Unidades de Medida
        </h1>
        <p class="text-medium-emphasis mb-0">
          Catálogo de magnitudes, presentaciones y empaques de inventario
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="isUnitAddDialogVisible = true"
        >
          Nueva Unidad
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-ruler-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Unidades de Medida</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_units.length }} <span class="text-caption text-disabled font-weight-regular">en página</span>
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
            <div class="text-caption text-medium-emphasis font-weight-medium">Unidades Habilitadas</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ activeUnitsCount }} <span class="text-caption text-disabled font-weight-regular">activas</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-file-list-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Con Descripción Técnica</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ unitsWithDescCount }} <span class="text-caption text-disabled font-weight-regular">unidades</span>
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
              v-model="searchQuery"
              label="Buscar unidad"
              placeholder="Nombre, código o descripción..."
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
            <td class="py-4 text-center" style="width: 140px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_units || list_units.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-ruler-2-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron unidades
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los criterios de búsqueda o registra una nueva unidad de medida.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" @click="isUnitAddDialogVisible = true">
          Nueva Unidad
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE UNIDADES -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="units-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 200px;">
                Unidad
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Descripción
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Estado
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 140px;">
                Fecha Reg.
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 150px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list_units" :key="item.id" class="unit-table-row">
              <td class="font-weight-bold text-disabled">
                #{{ item.id }}
              </td>

              <!-- Unidad con Avatar -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar color="primary" variant="tonal" size="38" rounded="lg" class="elevation-0">
                    <VIcon icon="ri-ruler-2-line" size="22" />
                  </VAvatar>
                  <div>
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                      {{ item.name }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Descripción (Texto limpio sin vchip) -->
              <td class="py-3">
                <span class="text-body-2 text-medium-emphasis">
                  {{ item.description || '-' }}
                </span>
              </td>

              <!-- Estado (Pill limpia aceituna / pastel con punto) -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <div
                  class="status-pill-clean"
                  :class="item.state == 1 ? 'status-paid' : 'status-pending'"
                >
                  <span class="status-dot" />
                  <span>{{ item.state == 1 ? 'Activo' : 'Inactivo' }}</span>
                </div>
              </td>

              <!-- Fecha -->
              <td class="py-3">
                <span class="text-caption text-medium-emphasis">
                  {{ item.created_at ? new Date(item.created_at).toLocaleDateString() : '-' }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="text-center">
                <div class="d-flex justify-center align-center gap-1">
                  <VBtn
                    size="small"
                    color="info"
                    variant="tonal"
                    icon="ri-exchange-line"
                    title="Agregar Conversión"
                    @click="addConversion(item)"
                  />
                  <VBtn
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Unidad"
                    @click="editItem(item)"
                  />
                  <VBtn
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Unidad"
                    @click="deleteItem(item)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_units.length }}</strong> unidades de medida
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPage"
            rounded="circle"
            :total-visible="7"
            color="primary"
            @update:model-value="list"
          />
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <UnitAddDialog
      v-model:isDialogVisible="isUnitAddDialogVisible"
      @add-unit="addNewUnit"
    />

    <UnitEditDialog
      v-if="unit_selected_edit && isUnitEditDialogVisible"
      v-model:isDialogVisible="isUnitEditDialogVisible"
      :unit-selected="unit_selected_edit"
      @edit-unit="addEditUnit"
    />

    <UnitDeleteDialog
      v-if="unit_selected_delete && isUnitDeleteDialogVisible"
      v-model:isDialogVisible="isUnitDeleteDialogVisible"
      :unit-selected="unit_selected_delete"
      @delete-unit="addDeleteUnit"
    />

    <UnitAddConversionDialog
      v-if="unit_selected_conversion && isUnitAddConversionDialogVisible"
      v-model:isDialogVisible="isUnitAddConversionDialogVisible"
      :unit-selected="unit_selected_conversion"
      :units="list_units"
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

.unit-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

// Status Pills (Estilo listado de clientes/vehículos/compras)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}
</style>
