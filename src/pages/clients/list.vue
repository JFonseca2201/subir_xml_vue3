<script setup>
/* eslint-disable camelcase */
import { ref, onMounted, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import ClientFinalAddDialog from '@/components/inventory/clients/ClientFinalAddDialog.vue'
import ClientCompanyAddDialog from '@/components/inventory/clients/ClientCompanyAddDialog.vue'
import ClientFinalEditDialog from '@/components/inventory/clients/ClientFinalEditDialog.vue'
import ClientCompanyEditDialog from '@/components/inventory/clients/ClientCompanyEditDialog.vue'
import ClientShowDialog from '@/components/inventory/clients/ClientShowDialog.vue'
import ClientDeleteDialog from '@/components/inventory/clients/ClientDeleteDialog.vue'
import ImportData from '@/components/inventory/import/ImportData.vue'
import SalesHistoryDialog from '@/components/dialogs/SalesHistoryDialog.vue'
import { usePermissions } from '@/composables/usePermissions'

// Router
const router = useRouter()
const loader = useLoaderStore()
const { can } = usePermissions()

// Estado
const loading = ref(false)
const clients = ref([])
const clientDialog = ref(false)
const selectedClient = ref(null)
const deleteDialog = ref(false)
const clientToDelete = ref(null)
const isClientFinalAddDialogVisible = ref(false)
const isClientCompanyAddDialogVisible = ref(false)
const isClientFinalEditDialogVisible = ref(false)
const clientToEdit = ref(null)
const isClientCompanyEditDialogVisible = ref(false)
const companyToEdit = ref(null)
const isClientShowDialogVisible = ref(false)
const clientToShow = ref(null)
const isImportDialogVisible = ref(false)
const isHistoryDialogVisible = ref(false)
const historyClientId = ref(null)

// Formulario de búsqueda
const searchForm = ref({
  search: '',
  type_client: null,
  type_document: null,
  state: null,
  gender: null,
  sucursale_id: null,
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(12)
const totalItems = ref(0)
const totalPages = ref(0)

// Opciones para selects
const typeClientOptions = ref([
  { title: 'Natural', value: 1 },
  { title: 'Jurídico o compañía', value: 2 },
])

const stateOptions = ref([
  { title: 'Activo', value: 1 },
  { title: 'Inactivo', value: 2 },
])

// Métricas computadas
const naturalClientsCount = computed(() => {
  return clients.value.filter(c => c.type_client === 1 || c.type_client === '1').length
})

const companyClientsCount = computed(() => {
  return clients.value.filter(c => c.type_client === 2 || c.type_client === '2').length
})

const hasActiveFilters = computed(() => {
  return !!(
    (searchForm.value.search && searchForm.value.search.trim()) ||
    searchForm.value.type_client ||
    searchForm.value.state
  )
})

const resetFilters = () => {
  searchForm.value = {
    search: '',
    type_client: null,
    type_document: null,
    state: null,
    gender: null,
    sucursale_id: null,
  }
  currentPage.value = 1
  loadClients()
}

// Helpers de visualización de clientes
const getClientInitials = client => {
  const name = client.full_name || `${client.name || ''} ${client.surname || ''}`.trim()
  if (!name) return 'CL'
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const isCompanyClient = client => {
  return client.type_client === 2 || client.type_client === '2' || client.type_document === 2 || client.type_document === '2'
}

let clientsAbortController = null

// Cargar clientes
const loadClients = async () => {
  if (clientsAbortController) {
    clientsAbortController.abort()
  }
  clientsAbortController = new AbortController()

  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage.value,
    }

    if (searchForm.value.search) {
      params.search = searchForm.value.search
    }
    if (searchForm.value.type_client) {
      params.type_client = searchForm.value.type_client
    }
    if (searchForm.value.state) {
      params.state = searchForm.value.state
    }

    const resp = await $api("clients", {
      method: "GET",
      params: params,
      signal: clientsAbortController.signal,
    })

    clients.value = resp.clients || resp.data || []
    totalPages.value = resp.total_pages || resp.last_page || 1
    totalItems.value = resp.total || resp.data?.length || 0

  } catch (error) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
    console.error('❌ Error al cargar clientes:', error)
  } finally {
    loading.value = false
  }
}

// Watch con debounce
const debouncedLoadClients = useDebounceFn(() => {
  currentPage.value = 1
  loadClients()
}, 350)

watch(searchForm, () => {
  debouncedLoadClients()
}, { deep: true })

watch(currentPage, () => {
  loadClients()
})

// Métodos de clientes
const showClient = client => {
  clientToShow.value = client
  isClientShowDialogVisible.value = true
}

const showHistory = client => {
  historyClientId.value = client.id
  isHistoryDialogVisible.value = true
}

const deleteClient = client => {
  clientToDelete.value = client
  deleteDialog.value = true
}

const handleClientDeleted = deletedClient => {
  const index = clients.value.findIndex(client => client.id === deletedClient.id)
  if (index > -1) {
    clients.value.splice(index, 1)
    totalItems.value = Math.max(0, totalItems.value - 1)
  }
  deleteDialog.value = false
  clientToDelete.value = null
}

const addNewClientFinal = () => {
  isClientFinalAddDialogVisible.value = true
}

const handleClientFinalAdded = clientData => {
  loadClients()
}

const addClient = () => {
  isClientCompanyAddDialogVisible.value = true
}

const handleClientCompanyAdded = clientData => {
  loadClients()
}

const editClient = client => {
  if (client.type_client === '2' || client.type_client === 2) {
    companyToEdit.value = client
    isClientCompanyEditDialogVisible.value = true
  } else {
    clientToEdit.value = client
    isClientFinalEditDialogVisible.value = true
  }
}

const handleClientFinalUpdated = clientData => {
  loadClients()
}

const handleClientCompanyUpdated = clientData => {
  loadClients()
}

onMounted(() => {
  loadClients()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 client-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-user-3-line" size="26" />
          </VAvatar>
          Gestión de Clientes
        </h1>
        <p class="text-medium-emphasis mb-0">
          Directorio comercial, cédulas, RUCs y registros de facturación de personas y empresas
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          v-if="can('import_xml') || can('register_client')"
          color="secondary"
          variant="tonal"
          prepend-icon="ri-upload-cloud-2-line"
          class="font-weight-medium"
          @click="isImportDialogVisible = true"
        >
          Importar
        </VBtn>

        <VBtn
          v-if="can('register_client')"
          color="primary"
          variant="outlined"
          prepend-icon="ri-user-add-line"
          class="font-weight-medium"
          @click="addNewClientFinal"
        >
          Cliente Final
        </VBtn>

        <VBtn
          v-if="can('register_client')"
          color="primary"
          prepend-icon="ri-building-line"
          class="elevation-2 font-weight-bold"
          @click="addClient"
        >
          Cliente Empresa
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-team-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Total Clientes</div>
            <div class="text-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ totalItems }} <span class="text-caption text-disabled font-weight-regular">en sistema</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="info" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-user-smile-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Personas Naturales</div>
            <div class="text-h6 font-weight-bold text-info text-truncate">
              {{ naturalClientsCount }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="warning" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-building-2-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Empresas / Jurídicos</div>
            <div class="text-h6 font-weight-bold text-warning text-truncate">
              {{ companyClientsCount }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <VForm ref="searchFormRef">
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
            <VCol cols="12" md="6">
              <VTextField
                v-model="searchForm.search"
                label="Buscar cliente"
                placeholder="Nombre, email, RUC o cédula..."
                clearable
                hide-details
                variant="outlined"
                density="comfortable"
                color="primary"
                :loading="loading"
                prepend-inner-icon="ri-search-2-line"
              />
            </VCol>

            <VCol cols="12" sm="6" md="3">
              <VSelect
                v-model="searchForm.type_client"
                :items="typeClientOptions"
                item-title="title"
                item-value="value"
                label="Tipo de Cliente"
                placeholder="Todos"
                clearable
                hide-details
                variant="outlined"
                density="comfortable"
                color="primary"
                prepend-inner-icon="ri-user-star-line"
              />
            </VCol>

            <VCol cols="12" sm="6" md="3">
              <VSelect
                v-model="searchForm.state"
                :items="stateOptions"
                item-title="title"
                item-value="value"
                label="Estado"
                placeholder="Todos"
                clearable
                hide-details
                variant="outlined"
                density="comfortable"
                color="primary"
                prepend-inner-icon="ri-toggle-line"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>

    <!-- ESTADO DE CARGA -->
    <VCard v-if="loading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 70px;"><div class="shimmer-line w-40" /></td>
            <td class="py-4" style="width: 160px;"><div class="shimmer-line w-75" /></td>
            <td class="py-4">
              <div class="shimmer-line w-75 mb-2" />
              <div class="shimmer-line w-50" />
            </td>
            <td class="py-4"><div class="shimmer-line w-60" /></td>
            <td class="py-4"><div class="shimmer-line w-50" /></td>
            <td class="py-4" style="width: 110px;"><div class="shimmer-chip" /></td>
            <td class="py-4 text-center" style="width: 140px;">
              <div class="d-flex justify-center gap-2">
                <div class="shimmer-button rounded" />
                <div class="shimmer-button rounded" />
              </div>
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!clients.length"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-user-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron clientes
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar tus criterios de búsqueda o registra un nuevo cliente al sistema.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_client')" color="primary" prepend-icon="ri-add-line" @click="addNewClientFinal">
          Registrar Cliente
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA MODERNA DE CLIENTES -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="client-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 170px;">
                Identificación
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Cliente / Razón Social
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 240px;">
                Contacto
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 140px;">
                Tipo
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Estado
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 140px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="client in clients" :key="client.id" class="client-table-row">
              <td class="font-weight-bold text-disabled">
                #{{ client.id }}
              </td>

              <!-- Identificación -->
              <td>
                <div class="text-caption text-disabled text-uppercase font-weight-bold">
                  {{ client.type_document === 2 || client.type_document === '2' ? 'RUC' : (client.type_document === 3 || client.type_document === '3' ? 'Pasaporte' : 'Cédula') }}
                </div>
                <div class="font-weight-bold text-high-emphasis font-mono">
                  {{ client.n_document || 'Sin documento' }}
                </div>
              </td>

              <!-- Cliente / Razón Social -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="38"
                    :color="isCompanyClient(client) ? 'warning' : 'primary'"
                    variant="tonal"
                    rounded="lg"
                    class="font-weight-bold elevation-0"
                  >
                    <VIcon v-if="isCompanyClient(client)" icon="ri-building-line" size="20" />
                    <span v-else class="text-caption font-weight-bold">{{ getClientInitials(client) }}</span>
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1 text-truncate" style="max-width: 280px;" :title="client.full_name || `${client.name} ${client.surname}`">
                      {{ client.full_name || `${client.name} ${client.surname}` }}
                    </div>
                    <div v-if="client.address" class="text-caption text-disabled text-uppercase text-truncate" style="max-width: 280px;">
                      {{ client.address }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Contacto -->
              <td class="py-3">
                <div class="d-flex flex-column">
                  <div class="text-body-2 text-medium-emphasis text-truncate" style="max-width: 220px;" :title="client.email">
                    <VIcon icon="ri-mail-line" size="14" class="me-1" />
                    {{ client.email || '-' }}
                  </div>
                  <div class="text-caption text-disabled">
                    <VIcon icon="ri-phone-line" size="14" class="me-1" />
                    {{ client.phone || '-' }}
                  </div>
                </div>
              </td>

              <!-- Tipo -->
              <td>
                <VChip
                  size="small"
                  :color="isCompanyClient(client) ? 'warning' : 'primary'"
                  variant="tonal"
                  class="font-weight-medium"
                >
                  {{ isCompanyClient(client) ? 'Jurídico / Empresa' : 'Natural' }}
                </VChip>
              </td>

              <!-- Estado (Pill limpia aceituna / pastel con punto) -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <div
                  class="status-pill-clean"
                  :class="parseInt(client.state) === 1 ? 'status-paid' : 'status-pending'"
                >
                  <span class="status-dot" />
                  <span>{{ parseInt(client.state) === 1 ? 'Activo' : 'Inactivo' }}</span>
                </div>
              </td>

              <!-- Acciones -->
              <td class="text-center">
                <div class="d-flex justify-center align-center gap-1">
                  <VBtn
                    size="small"
                    color="info"
                    variant="tonal"
                    icon="ri-eye-line"
                    title="Ver Ficha"
                    @click="showClient(client)"
                  />

                  <VBtn
                    v-if="can('edit_client')"
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Cliente"
                    @click="editClient(client)"
                  />

                  <!-- Menú Más Opciones -->
                  <VBtn size="small" color="secondary" variant="tonal" icon="ri-more-2-line" title="Más Opciones">
                    <VIcon icon="ri-more-2-line" size="18" />
                    <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                      <VList density="compact" class="py-1 rounded-lg elevation-3 border">
                        <VListItem prepend-icon="ri-history-line" title="Ver Historial" class="text-info text-body-2" @click="showHistory(client)" />
                        <VDivider v-if="can('delete_client')" class="my-1" />
                        <VListItem v-if="can('delete_client')" prepend-icon="ri-delete-bin-6-line" title="Eliminar Cliente" class="text-error text-body-2" @click="deleteClient(client)" />
                      </VList>
                    </VMenu>
                  </VBtn>
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
            Mostrando <strong class="text-high-emphasis">{{ clients.length }}</strong> de <strong class="text-high-emphasis">{{ totalItems }}</strong> clientes
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            color="primary"
            @update:model-value="loadClients"
          />
        </div>
      </VCard>
    </div>

    <!-- Diálogos -->
    <ClientFinalAddDialog
      v-if="isClientFinalAddDialogVisible"
      v-model:isDialogVisible="isClientFinalAddDialogVisible"
      @add-client-final="handleClientFinalAdded"
    />

    <ClientCompanyAddDialog
      v-if="isClientCompanyAddDialogVisible"
      v-model:isDialogVisible="isClientCompanyAddDialogVisible"
      @add-client-company="handleClientCompanyAdded"
    />

    <ClientFinalEditDialog
      v-if="isClientFinalEditDialogVisible"
      v-model:isDialogVisible="isClientFinalEditDialogVisible"
      :client-data="clientToEdit"
      @client-updated="handleClientFinalUpdated"
    />

    <ClientCompanyEditDialog
      v-if="isClientCompanyEditDialogVisible"
      v-model:isDialogVisible="isClientCompanyEditDialogVisible"
      :client-data="companyToEdit"
      @client-updated="handleClientCompanyUpdated"
    />

    <ClientShowDialog
      v-if="isClientShowDialogVisible"
      v-model:isDialogVisible="isClientShowDialogVisible"
      :client-data="clientToShow"
    />

    <ClientDeleteDialog
      v-if="deleteDialog"
      v-model:isDialogVisible="deleteDialog"
      :client-selected="clientToDelete"
      @delete-client="handleClientDeleted"
    />

    <SalesHistoryDialog v-model="isHistoryDialogVisible" :client-id="historyClientId" />

    <ImportData
      v-model:is-dialog-visible="isImportDialogVisible"
      default-tab="clients"
      @import-success="loadClients"
    />
  </div>
</template>

<style scoped lang="scss">
.client-grid-card {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-color: rgba(var(--v-border-color), 0.12) !important;
  background-color: rgb(var(--v-theme-surface)) !important;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(var(--v-theme-primary), 0.08) !important;
    border-color: rgba(var(--v-theme-primary), 0.3) !important;
  }
}

.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.client-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.text-xxs {
  font-size: 0.68rem !important;
}

// Status Pills (Estilo listado de compras)
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
