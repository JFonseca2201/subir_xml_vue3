<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import ProviderAddDialog from '@/components/inventory/config/providers/ProviderAddDialog.vue'
import ProviderViewDialog from '@/components/inventory/config/providers/ProviderViewDialog.vue'
import ProviderEditDialog from '@/components/inventory/config/providers/ProviderEditDialog.vue'
import ProviderDeleteDialog from '@/components/inventory/config/providers/ProviderDeleteDialog.vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { usePermissions } from '@/composables/usePermissions'

const loader = useLoaderStore()
const { can } = usePermissions()
const { showNotification } = useGlobalToast()

const isProviderAddDialogVisible = ref(false)
const isProviderViewDialogVisible = ref(false)
const isProviderEditDialogVisible = ref(false)
const isProviderDeleteDialogVisible = ref(false)

const list_providers = ref([])
const searchQuery = ref(null)
const provider_selected_view = ref(null)
const provider_selected_edit = ref(null)
const provider_selected_delete = ref(null)

const isLoading = ref(false)
const currentPage = ref(1)
const totalPage = ref(1)
const itemsPerPage = 10

// Métricas computadas
const providersWithRucCount = computed(() => {
  return list_providers.value.filter(p => !!p.ruc).length
})

const providersWithPhoneCount = computed(() => {
  return list_providers.value.filter(p => !!p.phone).length
})

const hasActiveFilters = computed(() => {
  return !!(searchQuery.value && searchQuery.value.trim())
})

const resetFilters = () => {
  searchQuery.value = null
  currentPage.value = 1
  list()
}

const formatDate = dateStr => {
  if (!dateStr) return 'N/A'
  let d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  const normalized = dateStr.replace(/-/g, '/')
  d = new Date(normalized)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  return 'N/A'
}

const list = async () => {
  isLoading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage,
      search: searchQuery.value || '',
    }

    const resp = await $api("suppliers", {
      method: "GET",
      params,
      onResponseError({ response }) {
        console.log(response._data?.error)
      },
    })

    list_providers.value = resp.suppliers || []

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
    showNotification('Error al cargar la lista de proveedores', 'error')
  } finally {
    isLoading.value = false
  }
}

const addNewProvider = newProvider => {
  const providerToSave = {
    ...newProvider,
    name: newProvider.name ? newProvider.name.toUpperCase() : '',
    address: newProvider.address ? newProvider.address.toUpperCase() : '',
  }
  list_providers.value.unshift(providerToSave)
  showNotification('Proveedor agregado correctamente', 'success')
}

const addEditProvider = editProvider => {
  const index = list_providers.value.findIndex(provider => provider.id == editProvider.id)
  if (index != -1) {
    list_providers.value[index] = {
      ...editProvider,
      name: editProvider.name ? editProvider.name.toUpperCase() : '',
      address: editProvider.address ? editProvider.address.toUpperCase() : '',
    }
    showNotification('Proveedor actualizado correctamente', 'success')
  } else {
    list()
  }
}

const addDeleteProvider = deletedProvider => {
  if (!deletedProvider || !deletedProvider.id) return
  const index = list_providers.value.findIndex(provider => provider.id == deletedProvider.id)
  if (index !== -1) {
    list_providers.value.splice(index, 1)
    showNotification('Proveedor eliminado correctamente', 'success')
  } else {
    list()
  }
}

const viewItem = item => {
  provider_selected_view.value = item
  isProviderViewDialogVisible.value = true
}

const editItem = item => {
  provider_selected_edit.value = item
  isProviderEditDialogVisible.value = true
}

const deleteItem = item => {
  provider_selected_delete.value = item
  isProviderDeleteDialogVisible.value = true
}

watch(currentPage, () => {
  list()
})

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

definePage({ meta: { permission: "settings" } })
</script>

<template>
  <div class="pa-4 pa-sm-6 providers-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-truck-line" size="26" />
          </VAvatar>
          Gestión de Proveedores
        </h1>
        <p class="text-medium-emphasis mb-0">
          Directorio de distribuidores de repuestos, insumos y compras del taller
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          v-if="can('register_supplier')"
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="isProviderAddDialogVisible = true"
        >
          Nuevo Proveedor
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-store-2-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Proveedores Registrados</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_providers.length }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-id-card-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Con RUC Identificado</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ providersWithRucCount }} <span class="text-caption text-disabled font-weight-regular">proveedores</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-phone-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Con Teléfono Comercial</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ providersWithPhoneCount }} <span class="text-caption text-disabled font-weight-regular">contactos</span>
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
              label="Buscar proveedor"
              placeholder="Nombre, RUC, teléfono o dirección..."
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
            <td class="py-4" style="width: 150px;"><div class="shimmer-line w-75" /></td>
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-60" /></td>
            <td class="py-4"><div class="shimmer-line w-70" /></td>
            <td class="py-4" style="width: 130px;"><div class="shimmer-line w-50" /></td>
            <td class="py-4 text-center" style="width: 130px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_providers || list_providers.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-truck-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron proveedores
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los criterios de búsqueda o registra un nuevo proveedor en el sistema.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_supplier')" color="primary" prepend-icon="ri-add-line" @click="isProviderAddDialogVisible = true">
          Nuevo Proveedor
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE PROVEEDORES -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="providers-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Proveedor / Razón Social
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 160px;">
                RUC
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 160px;">
                Teléfono
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 240px;">
                Dirección
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 130px;">
                Fecha Reg.
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list_providers" :key="item.id" class="provider-table-row">
              <td class="font-weight-bold text-disabled">
                #{{ item.id }}
              </td>

              <!-- Proveedor con Avatar -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar color="warning" variant="tonal" size="38" rounded="lg" class="elevation-0">
                    <VIcon icon="ri-building-line" size="22" />
                  </VAvatar>
                  <div>
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1 text-truncate" style="max-width: 260px;" :title="item.name">
                      {{ item.name }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- RUC (Monoespaciado sin chip) -->
              <td class="py-3">
                <span class="font-weight-bold text-high-emphasis font-mono">
                  {{ item.ruc || 'Sin RUC' }}
                </span>
              </td>

              <!-- Teléfono -->
              <td class="py-3">
                <span class="text-body-2 font-weight-medium text-high-emphasis">
                  {{ item.phone || '-' }}
                </span>
              </td>

              <!-- Dirección -->
              <td class="py-3">
                <div class="d-flex align-center gap-1.5 text-medium-emphasis text-body-2">
                  <VIcon icon="ri-map-pin-line" size="16" class="text-disabled flex-shrink-0" />
                  <span class="text-truncate" style="max-width: 240px;" :title="item.address">
                    {{ item.address || 'Sin dirección' }}
                  </span>
                </div>
              </td>

              <!-- Fecha -->
              <td class="py-3">
                <span class="text-caption text-medium-emphasis">
                  {{ formatDate(item.created_at) }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="text-center">
                <div class="d-flex justify-center align-center gap-1">
                  <VBtn
                    size="small"
                    color="info"
                    variant="tonal"
                    icon="ri-eye-line"
                    title="Ver Ficha de Proveedor"
                    @click="viewItem(item)"
                  />
                  <VBtn
                    v-if="can('edit_supplier')"
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Proveedor"
                    @click="editItem(item)"
                  />
                  <VBtn
                    v-if="can('delete_supplier')"
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Proveedor"
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
            Mostrando <strong class="text-high-emphasis">{{ list_providers.length }}</strong> proveedores registrados
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
    <ProviderAddDialog
      v-model:isDialogVisible="isProviderAddDialogVisible"
      @add-provider="addNewProvider"
    />

    <ProviderViewDialog
      v-if="provider_selected_view && isProviderViewDialogVisible"
      v-model:isDialogVisible="isProviderViewDialogVisible"
      :provider-selected="provider_selected_view"
    />

    <ProviderEditDialog
      v-if="provider_selected_edit && isProviderEditDialogVisible"
      v-model:isDialogVisible="isProviderEditDialogVisible"
      :provider-selected="provider_selected_edit"
      @update-provider="addEditProvider"
    />

    <ProviderDeleteDialog
      v-if="provider_selected_delete && isProviderDeleteDialogVisible"
      v-model:isDialogVisible="isProviderDeleteDialogVisible"
      :provider-selected="provider_selected_delete"
      @delete-provider="addDeleteProvider"
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

.provider-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}
</style>
