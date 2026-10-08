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
          <VAvatar
            size="42"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="me-3"
          >
            <VIcon
              icon="ri-ruler-2-line"
              size="26"
            />
          </VAvatar>
          Unidades de Medida
        </h1>
        <p class="text-medium-emphasis mb-0 d-none d-sm-block">
          Catálogo de magnitudes, presentaciones y empaques de inventario
        </p>
      </div>

      <div class="d-flex gap-2 flex-wrap w-100 w-md-auto align-center">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold flex-grow-1 flex-md-grow-0"
          @click="isUnitAddDialogVisible = true"
        >
          Nueva Unidad
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow
      class="mb-4 d-none d-sm-flex"
      dense
    >
      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar
            size="46"
            color="primary"
            variant="tonal"
            rounded="lg"
          >
            <VIcon
              icon="ri-ruler-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">
              Total Unidades de Medida
            </div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_units.length }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar
            size="46"
            color="success"
            variant="tonal"
            rounded="lg"
          >
            <VIcon
              icon="ri-checkbox-circle-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">
              Unidades Habilitadas
            </div>
            <div class="text-h6 font-weight-bold text-success">
              {{ activeUnitsCount }} <span class="text-caption text-disabled font-weight-regular">activas</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar
            size="46"
            color="warning"
            variant="tonal"
            rounded="lg"
          >
            <VIcon
              icon="ri-file-list-3-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">
              Con Descripción Técnica
            </div>
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
            <VIcon
              icon="ri-filter-3-line"
              size="18"
              color="primary"
            />
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

        <VRow
          dense
          class="gap-y-3"
        >
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

    <!-- ESTADO VACÍO (Solo si no está cargando y no hay unidades) -->
    <VCard
      v-if="!isLoading && (!list_units || list_units.length === 0)"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar
        size="76"
        color="primary"
        variant="tonal"
        class="mb-4"
      >
        <VIcon
          size="38"
          icon="ri-ruler-2-line"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron unidades
      </h3>
      <p
        class="text-body-1 text-medium-emphasis mb-5 mx-auto"
        style="max-width: 480px;"
      >
        Intenta ajustar los criterios de búsqueda o registra una nueva unidad de medida.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn
          v-if="hasActiveFilters"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="resetFilters"
        >
          Restablecer Filtros
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          @click="isUnitAddDialogVisible = true"
        >
          Nueva Unidad
        </VBtn>
      </div>
    </VCard>

    <!-- LISTA DE UNIDADES (MÓVIL Y ESCRITORIO CON SKELETON INTEGRADO) -->
    <div v-else>
      <!-- VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-3 mb-4">
        <!-- Skeleton Móvil mientras carga -->
        <template v-if="isLoading">
          <div
            v-for="n in 4"
            :key="'mob-skel-unit-' + n"
            class="mobile-unit-card"
          >
            <div class="d-flex justify-space-between align-center pb-2 border-b mb-2">
              <div
                class="shimmer-line"
                style="width: 50px; height: 14px;"
              />
              <div class="d-flex gap-1">
                <div
                  class="shimmer-button rounded"
                  style="width: 28px; height: 28px;"
                />
                <div
                  class="shimmer-button rounded"
                  style="width: 28px; height: 28px;"
                />
                <div
                  class="shimmer-button rounded"
                  style="width: 28px; height: 28px;"
                />
              </div>
            </div>
            <div class="d-flex align-center gap-3 mb-2">
              <div
                class="shimmer-avatar rounded-lg"
                style="width: 40px; height: 40px;"
              />
              <div class="flex-grow-1">
                <div
                  class="shimmer-line w-50 mb-1"
                  style="height: 16px;"
                />
                <div
                  class="shimmer-line w-30"
                  style="height: 12px;"
                />
              </div>
            </div>
            <div class="pt-2 border-t d-flex justify-end">
              <div
                class="shimmer-chip"
                style="width: 70px; height: 24px;"
              />
            </div>
          </div>
        </template>

        <!-- Tarjetas reales de unidades -->
        <template v-else>
          <div
            v-for="item in list_units"
            :key="'mob-unit-' + item.id"
            class="mobile-unit-card"
          >
          <!-- Fila Superior: ID, Fecha y Acciones -->
          <div class="d-flex align-center justify-space-between pb-2 border-b mb-2">
            <div class="d-flex align-center gap-2">
              <span class="text-caption font-weight-bold text-disabled">#{{ item.id }}</span>
              <span class="text-caption text-medium-emphasis">
                {{ item.created_at ? new Date(item.created_at).toLocaleDateString() : '-' }}
              </span>
            </div>
            <div class="d-flex align-center gap-1">
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
          </div>

          <!-- Fila Central: Unidad y Descripción -->
          <div class="d-flex align-start gap-3 mb-2">
            <VAvatar
              color="primary"
              variant="tonal"
              size="40"
              rounded="lg"
              class="elevation-0 mt-0.5"
            >
              <VIcon
                icon="ri-ruler-2-line"
                size="22"
              />
            </VAvatar>
            <div class="min-w-0 flex-grow-1">
              <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1 text-truncate">
                {{ item.name }}
              </div>
              <div
                v-if="item.description"
                class="text-caption text-medium-emphasis mt-0.5 text-truncate"
              >
                {{ item.description }}
              </div>
            </div>
          </div>

          <!-- Fila Inferior: Estado -->
          <div class="pt-2 border-t d-flex align-center justify-end">
            <div
              class="status-pill-clean"
              :class="item.state == 1 ? 'status-paid' : 'status-pending'"
            >
              <span class="status-dot" />
              <span>{{ item.state == 1 ? 'Activo' : 'Inactivo' }}</span>
            </div>
          </div>
        </div>
        </template>
      </div>

      <!-- VISTA DESKTOP: TABLA (d-none d-md-block) -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable
          hover
          class="units-modern-table overflow-x-auto"
        >
          <thead>
            <tr class="bg-grey-lighten-5">
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 70px;"
              >
                ID
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="min-width: 200px;"
              >
                Unidad
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="min-width: 250px;"
              >
                Descripción
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 120px;"
              >
                Estado
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 140px;"
              >
                Fecha Reg.
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 150px;"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-if="isLoading">
              <tr
                v-for="n in 5"
                :key="'skel-unit-row-' + n"
                class="skeleton-row align-middle"
              >
                <td class="py-4" style="width: 70px;">
                  <div class="shimmer-line" style="width: 35px; height: 16px;" />
                </td>
                <td class="py-4">
                  <div class="d-flex align-center gap-3">
                    <div class="shimmer-circle" style="width: 38px; height: 38px; border-radius: 8px;" />
                    <div class="flex-grow-1">
                      <div class="shimmer-line mb-1.5" style="width: 140px; height: 16px;" />
                    </div>
                  </div>
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-60" style="height: 14px;" />
                </td>
                <td class="text-center py-4" style="width: 120px;">
                  <div class="shimmer-chip mx-auto" style="width: 70px; height: 24px;" />
                </td>
                <td class="py-4" style="width: 140px;">
                  <div class="shimmer-line" style="width: 80px; height: 14px;" />
                </td>
                <td class="text-center py-4" style="width: 150px;">
                  <div class="d-flex justify-center align-center gap-1">
                    <div class="shimmer-button rounded" style="width: 32px; height: 32px;" />
                    <div class="shimmer-button rounded" style="width: 32px; height: 32px;" />
                    <div class="shimmer-button rounded" style="width: 32px; height: 32px;" />
                  </div>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr
                v-for="item in list_units"
                :key="item.id"
                class="unit-table-row"
              >
                <td class="font-weight-bold text-disabled">
                  #{{ item.id }}
                </td>

                <!-- Unidad con Avatar -->
                <td class="py-3">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      size="38"
                      rounded="lg"
                      class="elevation-0"
                    >
                      <VIcon
                        icon="ri-ruler-2-line"
                        size="22"
                      />
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
                <td
                  class="text-center py-3"
                  style="white-space: nowrap;"
                >
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
            </template>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard
        v-if="totalPage > 0"
        class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface"
      >
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100 text-center text-sm-start">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_units.length }}</strong> unidades de medida
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPage"
            :disabled="isLoading"
            rounded="circle"
            :total-visible="$vuetify.display.xs ? 4 : 7"
            :size="$vuetify.display.xs ? 'small' : 'default'"
            density="comfortable"
            color="primary"
            class="my-0"
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
