<script setup>
import { ref, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'
import ProviderAddDialog from '@/components/inventory/config/providers/ProviderAddDialog.vue'
import ProviderViewDialog from '@/components/inventory/config/providers/ProviderViewDialog.vue'
import ProviderEditDialog from '@/components/inventory/config/providers/ProviderEditDialog.vue'
import ProviderDeleteDialog from '@/components/inventory/config/providers/ProviderDeleteDialog.vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

const headers = [

  {
    title: "Proveedor",
    key: "name",
  },
  {
    title: "RUC",
    key: "ruc",
  },
  {
    title: "Dirección",
    key: "address",
  },
  {
    title: "Fecha de registro",
    key: "created_at",
  },
  {
    title: "Acción",
    key: "action",
  },
]

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

const { showNotification } = useGlobalToast()

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
        console.log(response._data.error)
        showNotification('Error al cargar los proveedores', 'error')
      },
    })

    console.log(resp)
    list_providers.value = resp.suppliers || []

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

    showNotification('Lista de proveedores cargada correctamente', 'success')
  } catch (error) {
    console.log(error)
    showNotification('Error al cargar la lista de proveedores', 'error')
  } finally {
    isLoading.value = false
  }
}

const addNewProvider = newProvider => {
  console.log(newProvider)
  let backup = list_providers.value
  list_providers.value = []

  // Asegurar que los datos se guarden en mayúsculas
  const providerToSave = {
    ...newProvider,
    name: newProvider.name ? newProvider.name.toUpperCase() : '',
    address: newProvider.address ? newProvider.address.toUpperCase() : '',
  }

  backup.unshift(providerToSave)
  setTimeout(() => {
    list_providers.value = backup
  }, 50)
  showNotification('Proveedor agregado correctamente', 'success')
}

const addEditProvider = editProvider => {
  console.log(editProvider)
  let backup = list_providers.value
  list_providers.value = []
  let INDEX = backup.findIndex(provider => provider.id == editProvider.id)
  if (INDEX != -1) {
    // Asegurar que los datos se guarden en mayúsculas
    backup[INDEX] = {
      ...editProvider,
      name: editProvider.name ? editProvider.name.toUpperCase() : '',
      address: editProvider.address ? editProvider.address.toUpperCase() : '',
    }
  }
  setTimeout(() => {
    list_providers.value = backup
  }, 50)
  showNotification('Proveedor actualizado correctamente', 'success')
}

const addDeleteProvider = deletedProvider => {
  console.log('Proveedor eliminado:', deletedProvider)

  if (!deletedProvider || !deletedProvider.id) {
    console.error('Proveedor eliminado no válido:', deletedProvider)
    showNotification('Error: datos del proveedor no válidos', 'error')

    return
  }

  let backup = list_providers.value
  list_providers.value = []
  let INDEX = backup.findIndex(provider => provider.id == deletedProvider.id)

  if (INDEX !== -1) {
    backup.splice(INDEX, 1)
    console.log('Proveedor eliminado de la lista en índice:', INDEX)
  } else {
    console.warn('No se encontró el proveedor en la lista local')

    // Si no se encuentra en la lista, recargar desde el servidor
    list()

    return
  }

  setTimeout(() => {
    list_providers.value = backup
    showNotification('Proveedor eliminado correctamente', 'success')
  }, 50)
}

const viewItem = item => {
  provider_selected_view.value = item
  isProviderViewDialogVisible.value = true
}

const editItem = item => {
  console.log(item)
  isProviderEditDialogVisible.value = true
  provider_selected_edit.value = item
}

const deleteItem = item => {
  isProviderDeleteDialogVisible.value = true
  provider_selected_delete.value = item
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

onMounted(() => {
  list()
})
const formatName = (item) => {
  if (!item?.name) return 'Sin nombre';
  return item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name;
};

definePage({ meta: { permission: "settings" } })
</script>

<template>
  <div class="pa-4 pa-sm-6 providers-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-truck-line" color="primary" class="me-2" size="28" />
          Proveedores
        </h1>
        <p class="text-medium-emphasis mb-0">
          Administración de proveedores del sistema
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn color="primary" prepend-icon="ri-add-line"
          @click="isProviderAddDialogVisible = !isProviderAddDialogVisible">
          Nuevo Proveedor
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12" md="8">
            <VTextField v-model="searchQuery" label="Buscar proveedor" placeholder="Nombre, RUC, dirección..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto" clearable
              color="primary" @keyup.enter="list" />
          </VCol>
          <VCol cols="12" sm="6" md="2">
            <VBtn color="secondary" variant="tonal" prepend-icon="ri-refresh-line" @click="refresh" block>
              Limpiar
            </VBtn>
          </VCol>
          <VCol cols="12" sm="6" md="2">
            <VBtn color="primary" variant="tonal" prepend-icon="ri-search-line" :loading="isLoading" @click="list"
              block>
              Buscar
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Proveedores -->
      <div class="position-relative">
        <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />
        <div class="overflow-x-auto">
          <VTable hover class="providers-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 250px;">PROVEEDOR</th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">RUC</th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 250px;">DIRECCIÓN</th>
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
            <tbody v-else-if="!list_providers || list_providers.length === 0">
              <tr>
                <td colspan="5" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">ri-truck-line</VIcon>
                  <div class="text-h6">No hay proveedores registrados</div>
                  <div class="text-body-2">Intenta ajustar los filtros de búsqueda</div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="item in list_providers" :key="item.id" class="providers-row align-middle">
                <td class="text-left py-3">
                  <div class="d-flex align-center">
                    <VAvatar size="32" color="primary" variant="tonal">
                      <VIcon icon="ri-building-line" />
                    </VAvatar>
                    <div class="d-flex flex-column ms-3">
                      <span class="font-weight-semibold text-body-1 text-grey-darken-4 text-uppercase">
                        {{ formatName(item) }}
                      </span>
                      <span class="text-caption text-medium-emphasis">
                        ID: PROV-00{{ item.id }}
                      </span>
                    </div>
                  </div>
                </td>
                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3">
                    {{ item.ruc || 'Sin RUC' }}
                  </span>
                </td>
                <td class="text-left py-3" style="max-width: 250px;">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-map-pin-line" size="16" class="mr-2 text-grey" />
                    <span class="text-body-2 text-grey-darken-3 text-truncate text-uppercase" :title="item.address">
                      {{ item.address ? (item.address.length > 20 ? item.address.substring(0, 25) + '...' :
                        item.address) : 'Sin dirección' }}
                    </span>
                  </div>
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
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver detalle"
                      @click="viewItem(item)">
                      <VIcon icon="ri-eye-line" size="20" />
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
            Mostrando <span class="font-weight-bold">{{ list_providers.length }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPage" rounded="circle" :total-visible="7" color="primary" />
        </div>
      </VCardActions>
    </VCard>

    <!-- DIALOGS -->
    <ProviderAddDialog v-model:isDialogVisible="isProviderAddDialogVisible" :providers="list_providers"
      @add-provider="addNewProvider" />

    <ProviderViewDialog v-if="provider_selected_view && isProviderViewDialogVisible"
      v-model:isDialogVisible="isProviderViewDialogVisible" :provider-selected="provider_selected_view" />

    <ProviderEditDialog v-if="provider_selected_edit && isProviderEditDialogVisible"
      v-model:isDialogVisible="isProviderEditDialogVisible" :provider-selected="provider_selected_edit"
      @edit-provider="addEditProvider" />

    <ProviderDeleteDialog v-if="provider_selected_delete && isProviderDeleteDialogVisible"
      v-model:isDialogVisible="isProviderDeleteDialogVisible" :provider-selected="provider_selected_delete"
      @delete-provider="addDeleteProvider" />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de proveedores */
.providers-table :deep(thead) {
  background-color: #f8fafc !important;
}

.providers-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.providers-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.providers-row:hover {
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
