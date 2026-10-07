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

// Helper de estado del proveedor
const isProviderActive = provider => {
  if (!provider) return false
  if (provider.is_active !== undefined && provider.is_active !== null) {
    return provider.is_active === true || provider.is_active === 1 || String(provider.is_active) === '1'
  }
  if (provider.status !== undefined && provider.status !== null) {
    return provider.status === 'active' || provider.status === 1 || String(provider.status) === '1' || provider.status === 'activo'
  }
  
  return true
}

// Métricas computadas
const activeProvidersCount = computed(() => {
  return list_providers.value.filter(p => isProviderActive(p)).length
})

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
  if (!dateStr) return '-'
  const clean = String(dateStr).split('T')[0].split(' ')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`
  }
  let d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    
    return `${y}/${m}/${day}`
  }
  
  return dateStr
}

const list = async (silent = false) => {
  if (!silent) {
    isLoading.value = true
  }
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
    if (!silent) {
      isLoading.value = false
    }
  }
}

const addNewProvider = async newProvider => {
  if (newProvider) {
    const isInactive = newProvider.is_active === false || 
                       newProvider.is_active === 0 || 
                       newProvider.is_active === '0' ||
                       newProvider.status === 'inactive'

    const providerToSave = {
      ...newProvider,
      name: newProvider.name ? newProvider.name.toUpperCase() : '',
      address: newProvider.address ? newProvider.address.toUpperCase() : '',
      is_active: !isInactive,
      status: isInactive ? 'inactive' : 'active',
      created_at: newProvider.created_at || new Date().toISOString(),
    }

    list_providers.value.unshift(providerToSave)
    list_providers.value = [...list_providers.value]
  }
  currentPage.value = 1
  await list(true)
}

const addEditProvider = async editProvider => {
  if (editProvider && editProvider.id) {
    const index = list_providers.value.findIndex(p => String(p.id) === String(editProvider.id))
    if (index !== -1) {
      const isInactive = editProvider.is_active === false || 
                         editProvider.is_active === 0 || 
                         editProvider.is_active === '0' ||
                         editProvider.status === 'inactive'

      list_providers.value[index] = {
        ...list_providers.value[index],
        ...editProvider,
        name: editProvider.name ? editProvider.name.toUpperCase() : list_providers.value[index].name,
        address: editProvider.address ? editProvider.address.toUpperCase() : list_providers.value[index].address,
        is_active: !isInactive,
        status: isInactive ? 'inactive' : 'active',
      }
      list_providers.value = [...list_providers.value]
    }
  }
  await list(true)
}

const addDeleteProvider = async deletedProvider => {
  if (deletedProvider && deletedProvider.id) {
    const index = list_providers.value.findIndex(p => String(p.id) === String(deletedProvider.id))
    if (index !== -1) {
      list_providers.value.splice(index, 1)
      list_providers.value = [...list_providers.value]
    }
  }
  await list(true)
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
          <VAvatar
            size="42"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="me-3"
          >
            <VIcon
              icon="ri-truck-line"
              size="26"
            />
          </VAvatar>
          Gestión de Proveedores
        </h1>
        <p class="text-medium-emphasis mb-0 d-none d-sm-block">
          Directorio de distribuidores de repuestos, insumos y compras del taller
        </p>
      </div>

      <div class="d-flex gap-2 flex-wrap w-100 w-md-auto align-center">
        <VBtn
          v-if="can('register_supplier')"
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold flex-grow-1 flex-md-grow-0"
          @click="isProviderAddDialogVisible = true"
        >
          Nuevo Proveedor
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
        sm="6"
        md="3"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="46"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-store-2-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">
              Total Proveedores
            </div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_providers.length }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="46"
            color="success"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-checkbox-circle-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">
              Proveedores Activos
            </div>
            <div class="text-h6 font-weight-bold text-success">
              {{ activeProvidersCount }} <span class="text-caption text-disabled font-weight-regular">activos</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="46"
            color="info"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-id-card-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">
              Con RUC Identificado
            </div>
            <div class="text-h6 font-weight-bold text-info">
              {{ providersWithRucCount }} <span class="text-caption text-disabled font-weight-regular">proveedores</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="46"
            color="warning"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-phone-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">
              Con Teléfono Comercial
            </div>
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
    <div v-if="isLoading">
      <!-- Skeleton Móvil -->
      <div class="d-md-none d-flex flex-column gap-3">
        <VCard
          v-for="n in 4"
          :key="'mob-skel-prov-' + n"
          class="mobile-provider-card elevation-0 pa-4"
        >
          <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b">
            <div
              class="shimmer-line"
              style="width: 80px; height: 16px;"
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
            </div>
          </div>
          <div class="d-flex align-center gap-3 mb-3">
            <div
              class="shimmer-circle"
              style="width: 38px; height: 38px; border-radius: 8px;"
            />
            <div class="flex-grow-1">
              <div
                class="shimmer-line w-75 mb-2"
                style="height: 16px;"
              />
              <div
                class="shimmer-line w-40"
                style="height: 12px;"
              />
            </div>
          </div>
          <div
            class="shimmer-line w-100 mb-2"
            style="height: 14px;"
          />
          <div class="d-flex justify-space-between pt-2 border-t">
            <div
              class="shimmer-line"
              style="width: 70px; height: 16px;"
            />
            <div
              class="shimmer-chip"
              style="width: 70px; height: 24px;"
            />
          </div>
        </VCard>
      </div>

      <!-- Skeleton Escritorio -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable class="providers-modern-table overflow-x-auto">
          <tbody>
            <tr
              v-for="n in 5"
              :key="n"
              class="skeleton-row align-middle"
            >
              <td
                class="py-4"
                style="width: 70px;"
              >
                <div class="shimmer-line w-40" />
              </td>
              <td
                class="py-4"
                style="min-width: 240px;"
              >
                <div class="shimmer-line w-75 mb-2" />
                <div class="shimmer-line w-40" />
              </td>
              <td
                class="py-4"
                style="width: 150px;"
              >
                <div class="shimmer-line w-75" />
              </td>
              <td
                class="py-4"
                style="width: 130px;"
              >
                <div class="shimmer-line w-60" />
              </td>
              <td
                class="py-4"
                style="min-width: 220px;"
              >
                <div class="shimmer-line w-70" />
              </td>
              <td
                class="py-4 text-center"
                style="width: 120px;"
              >
                <div class="shimmer-line w-50 mx-auto" />
              </td>
              <td
                class="py-4"
                style="width: 130px;"
              >
                <div class="shimmer-line w-50" />
              </td>
              <td
                class="py-4 text-center"
                style="width: 120px;"
              >
                <div class="shimmer-button rounded mx-auto" />
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </div>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_providers || list_providers.length === 0"
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
          icon="ri-truck-line"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron proveedores
      </h3>
      <p
        class="text-body-1 text-medium-emphasis mb-5 mx-auto"
        style="max-width: 480px;"
      >
        Intenta ajustar los criterios de búsqueda o registra un nuevo proveedor en el sistema.
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
          v-if="can('register_supplier')"
          color="primary"
          prepend-icon="ri-add-line"
          @click="isProviderAddDialogVisible = true"
        >
          Nuevo Proveedor
        </VBtn>
      </div>
    </VCard>

    <!-- LISTADO DE PROVEEDORES (MÓVIL Y ESCRITORIO) -->
    <div v-else>
      <!-- VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-3 mb-4">
        <VCard
          v-for="item in list_providers"
          :key="'mob-prov-' + item.id"
          class="mobile-provider-card elevation-0"
        >
          <!-- Cabecera Móvil: ID + RUC + Acciones Rápidas -->
          <div class="d-flex align-center justify-space-between gap-2 mb-2 pb-2 border-b">
            <div class="d-flex align-center gap-1.5 min-w-0">
              <span class="text-caption text-disabled font-weight-bold">#{{ item.id }}</span>
              <span class="text-caption text-disabled text-uppercase font-weight-bold">RUC:</span>
              <span class="font-mono font-weight-bold text-high-emphasis text-body-2">
                {{ item.ruc || 'Sin RUC' }}
              </span>
            </div>

            <!-- Botones de Acción Móvil -->
            <div class="d-flex align-center gap-1 flex-shrink-0">
              <VBtn
                size="x-small"
                color="info"
                variant="tonal"
                icon="ri-eye-line"
                title="Ver Ficha"
                @click="viewItem(item)"
              />
              <VBtn
                v-if="can('edit_supplier')"
                size="x-small"
                color="warning"
                variant="tonal"
                icon="ri-pencil-line"
                title="Editar Proveedor"
                @click="editItem(item)"
              />
              <VBtn
                v-if="can('delete_supplier')"
                size="x-small"
                color="error"
                variant="tonal"
                icon="ri-delete-bin-line"
                title="Eliminar Proveedor"
                @click="deleteItem(item)"
              />
            </div>
          </div>

          <!-- Proveedor Nombre / Razón Social -->
          <div class="d-flex align-start gap-3 mb-2">
            <VAvatar
              color="primary"
              variant="tonal"
              size="38"
              rounded="lg"
              class="elevation-0 flex-shrink-0 mt-0.5"
            >
              <VIcon
                icon="ri-store-2-line"
                size="20"
              />
            </VAvatar>
            <div class="min-w-0 flex-grow-1">
              <div
                class="font-weight-bold text-high-emphasis text-uppercase text-body-1"
                style="line-height: 1.25;"
              >
                {{ item.name }}
              </div>
              <div
                v-if="item.phone"
                class="text-caption text-medium-emphasis mt-0.5 d-flex align-center gap-1"
              >
                <VIcon
                  icon="ri-phone-line"
                  size="14"
                  color="primary"
                />
                <span>{{ item.phone }}</span>
              </div>
            </div>
          </div>

          <!-- Dirección -->
          <div
            v-if="item.address"
            class="mb-2 text-caption text-medium-emphasis d-flex align-center gap-1"
          >
            <VIcon
              icon="ri-map-pin-line"
              size="14"
              color="medium-emphasis"
              class="flex-shrink-0"
            />
            <span class="text-truncate">{{ item.address }}</span>
          </div>

          <!-- Pie Móvil: Fecha y Estado -->
          <div class="d-flex align-center justify-space-between pt-1.5 border-t">
            <span class="text-caption text-disabled font-weight-medium">
              Reg: {{ formatDate(item.created_at) }}
            </span>
            <div
              class="status-pill-clean"
              :class="isProviderActive(item) ? 'status-paid' : 'status-pending'"
            >
              <span class="status-dot" />
              <span>{{ isProviderActive(item) ? 'Activo' : 'Inactivo' }}</span>
            </div>
          </div>
        </VCard>
      </div>

      <!-- VISTA ESCRITORIO: TABLA MODERNA (d-none d-md-block) -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable
          hover
          class="providers-modern-table overflow-x-auto"
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
                style="min-width: 240px;"
              >
                Proveedor / Razón Social
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 150px;"
              >
                RUC
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 130px;"
              >
                Teléfono
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="min-width: 220px;"
              >
                Dirección
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 120px;"
              >
                Estado
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 130px;"
              >
                Fecha Reg.
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 120px;"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in list_providers"
              :key="item.id"
              class="provider-table-row"
            >
              <td class="font-weight-bold text-disabled py-3">
                #{{ item.id }}
              </td>

              <!-- Proveedor con Avatar -->
              <td class="py-3">
                <div class="d-flex align-center">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    size="36"
                    rounded="lg"
                    class="elevation-0 flex-shrink-0 me-3"
                  >
                    <VIcon
                      icon="ri-store-2-line"
                      size="20"
                    />
                  </VAvatar>
                  <div class="min-w-0">
                    <div
                      class="font-weight-bold text-high-emphasis text-uppercase text-body-2 text-truncate"
                      style="max-width: 250px;"
                      :title="item.name"
                    >
                      {{ item.name }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- RUC (Monoespaciado sin chip) -->
              <td class="py-3">
                <span class="font-weight-bold text-high-emphasis font-mono text-body-2">
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
                  <VIcon
                    icon="ri-map-pin-line"
                    size="16"
                    class="text-disabled flex-shrink-0"
                  />
                  <span
                    class="text-truncate"
                    style="max-width: 230px;"
                    :title="item.address"
                  >
                    {{ item.address || 'Sin dirección' }}
                  </span>
                </div>
              </td>

              <!-- Estado -->
              <td
                class="text-center py-3"
                style="white-space: nowrap;"
              >
                <div
                  class="status-pill-clean"
                  :class="isProviderActive(item) ? 'status-paid' : 'status-pending'"
                >
                  <span class="status-dot" />
                  <span>{{ isProviderActive(item) ? 'Activo' : 'Inactivo' }}</span>
                </div>
              </td>

              <!-- Fecha -->
              <td class="py-3">
                <span class="text-caption text-medium-emphasis">
                  {{ formatDate(item.created_at) }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="text-center py-3">
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
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100 text-center text-sm-start">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_providers.length }}</strong> proveedores registrados
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPage"
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
      @edit-provider="addEditProvider"
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
