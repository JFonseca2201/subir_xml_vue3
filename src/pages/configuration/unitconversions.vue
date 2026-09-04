<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import UnitAddConversionDialog from '@/components/inventory/config/unit_conversions/UnitAddConversionDialog.vue'
import UnitDeleteConversionDialog from '@/components/inventory/config/unit_conversions/UnitDeleteConversionDialog.vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const isUnitAddConversionDialogVisible = ref(false)
const isUnitDeleteConversionDialogVisible = ref(false)

const list_conversions = ref([])
const list_units = ref([])
const searchQuery = ref(null)
const conversion_selected_edit = ref(null)
const conversion_selected_delete = ref(null)

const isLoading = ref(false)

// Conversiones filtradas
const filteredConversions = computed(() => {
  if (!searchQuery.value || !searchQuery.value.trim()) return list_conversions.value
  const q = searchQuery.value.trim().toLowerCase()
  return list_conversions.value.filter(c => {
    const fromName = (c.from_unit?.name || '').toLowerCase()
    const toName = (c.to_unit?.name || '').toLowerCase()
    const fromCode = (c.from_unit?.code || '').toLowerCase()
    const toCode = (c.to_unit?.code || '').toLowerCase()
    return fromName.includes(q) || toName.includes(q) || fromCode.includes(q) || toCode.includes(q)
  })
})

const hasActiveFilters = computed(() => {
  return !!(searchQuery.value && searchQuery.value.trim())
})

const resetFilters = () => {
  searchQuery.value = null
}

const list = async () => {
  isLoading.value = true
  try {
    const [conversionsResp, unitsResp] = await Promise.all([
      $api("unit-conversions", {
        method: "GET",
        onResponseError({ response }) {
          console.log(response._data?.error)
        },
      }),
      $api("units", {
        method: "GET",
        params: { per_page: 1000 },
        onResponseError({ response }) {
          console.log(response._data?.error)
        },
      }),
    ])

    list_conversions.value = conversionsResp.conversions || []
    list_units.value = unitsResp.units || []
  } catch (error) {
    console.log(error)
    showNotification('Error al cargar la lista de conversiones', 'error')
  } finally {
    isLoading.value = false
  }
}

const addNewConversion = newConversion => {
  list_conversions.value.unshift(newConversion)
  showNotification('Conversión agregada correctamente', 'success')
}

const addEditConversion = editConversion => {
  const index = list_conversions.value.findIndex(conv => conv.id == editConversion.id)
  if (index !== -1) {
    list_conversions.value[index] = editConversion
    showNotification('Conversión actualizada correctamente', 'success')
  } else {
    list()
  }
}

const addDeleteConversion = deletedConversion => {
  if (!deletedConversion || !deletedConversion.id) return
  const index = list_conversions.value.findIndex(conv => conv.id == deletedConversion.id)
  if (index !== -1) {
    list_conversions.value.splice(index, 1)
    showNotification('Conversión eliminada correctamente', 'success')
  } else {
    list()
  }
}

const openNewConversionDialog = () => {
  conversion_selected_edit.value = null
  isUnitAddConversionDialogVisible.value = true
}

const editItem = item => {
  conversion_selected_edit.value = item
  isUnitAddConversionDialogVisible.value = true
}

const deleteItem = item => {
  conversion_selected_delete.value = item
  isUnitDeleteConversionDialogVisible.value = true
}

onMounted(() => {
  list()
})

definePage({ meta: { permission: "settings" } })
</script>

<template>
  <div class="pa-4 pa-sm-6 unit-conversions-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-exchange-line" size="26" />
          </VAvatar>
          Conversiones de Unidades
        </h1>
        <p class="text-medium-emphasis mb-0">
          Equivalencias y factores multiplicadores entre distintas unidades de inventario
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="openNewConversionDialog"
        >
          Nueva Conversión
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-scales-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Factores de Conversión</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_conversions.length }} <span class="text-caption text-disabled font-weight-regular">registrados</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-ruler-2-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Unidades Base Vinculadas</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ list_units.length }} <span class="text-caption text-disabled font-weight-regular">unidades</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-calculator-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Cálculo en Ventas y Compras</div>
            <div class="text-h6 font-weight-bold text-warning">
              Automático <span class="text-caption text-disabled font-weight-regular">(En tiempo real)</span>
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
              label="Buscar conversión"
              placeholder="Unidad origen o destino..."
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
            <td class="py-4"><div class="shimmer-line w-60" /></td>
            <td class="py-4"><div class="shimmer-line w-60" /></td>
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-50" /></td>
            <td class="py-4 text-center" style="width: 120px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!filteredConversions || filteredConversions.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-exchange-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron conversiones
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los criterios de búsqueda o registra una nueva regla de conversión de unidades.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" @click="openNewConversionDialog">
          Nueva Conversión
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE CONVERSIONES -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="conversions-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                #
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 240px;">
                Unidad Origen
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 60px;">
                
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 240px;">
                Unidad Destino
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 180px;">
                Factor Multiplicador
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in filteredConversions" :key="item.id" class="conversion-table-row">
              <td class="font-weight-bold text-disabled">
                #{{ index + 1 }}
              </td>

              <!-- Unidad Origen -->
              <td class="py-3">
                <div class="d-flex align-center gap-2">
                  <VAvatar size="32" color="primary" variant="tonal" rounded="lg">
                    <VIcon icon="ri-ruler-line" size="18" />
                  </VAvatar>
                  <div>
                    <span class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                      {{ item.from_unit?.name || 'Sin nombre' }}
                    </span>
                    <span v-if="item.from_unit?.code" class="text-caption text-disabled ms-1 font-mono">
                      ({{ item.from_unit.code }})
                    </span>
                  </div>
                </div>
              </td>

              <!-- Flecha Indicadora -->
              <td class="text-center py-3">
                <VIcon icon="ri-arrow-right-line" color="medium-emphasis" size="20" />
              </td>

              <!-- Unidad Destino -->
              <td class="py-3">
                <div class="d-flex align-center gap-2">
                  <VAvatar size="32" color="secondary" variant="tonal" rounded="lg">
                    <VIcon icon="ri-ruler-2-line" size="18" />
                  </VAvatar>
                  <div>
                    <span class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                      {{ item.to_unit?.name || 'Sin nombre' }}
                    </span>
                    <span v-if="item.to_unit?.code" class="text-caption text-disabled ms-1 font-mono">
                      ({{ item.to_unit.code }})
                    </span>
                  </div>
                </div>
              </td>

              <!-- Factor (Tipografía monoespaciada sin chip) -->
              <td class="py-3">
                <span class="text-body-1 font-weight-bold font-mono text-primary">
                  1 = {{ item.factor }}
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
                    title="Editar Conversión"
                    @click="editItem(item)"
                  />
                  <VBtn
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Conversión"
                    @click="deleteItem(item)"
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
            Mostrando <strong class="text-high-emphasis">{{ filteredConversions.length }}</strong> conversiones registradas
          </div>
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <UnitAddConversionDialog
      v-model:isDialogVisible="isUnitAddConversionDialogVisible"
      :unit-selected="conversion_selected_edit"
      :units="list_units"
      @add-conversion="addNewConversion"
      @edit-conversion="addEditConversion"
    />

    <UnitDeleteConversionDialog
      v-if="conversion_selected_delete && isUnitDeleteConversionDialogVisible"
      v-model:isDialogVisible="isUnitDeleteConversionDialogVisible"
      :conversion-selected="conversion_selected_delete"
      :conversion="conversion_selected_delete"
      :units="list_units"
      @delete-conversion="addDeleteConversion"
      @conversion-deleted="addDeleteConversion"
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

.conversion-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}
</style>
