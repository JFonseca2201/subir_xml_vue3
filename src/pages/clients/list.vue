<script setup>
/* eslint-disable camelcase */
import { ref, onMounted, watch } from 'vue'
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
  state: null,  // Cambiar a null para mostrar todos por defecto
  gender: null,
  sucursale_id: null,
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalItems = ref(0)
const totalPages = ref(0)

const pagination = ref({
  total: 0,
  per_page: 10,
  current_page: 1,
  last_page: 1,
  from: 0,
  to: 0,
})

// Opciones para selects
const sucursales = ref([])

const typeClientOptions = ref([
  { title: 'Natural', value: 1 },
  { title: 'Jurídico o compañía', value: 2 },
])

const typeDocumentOptions = ref([
  { title: 'Cédula', value: 1 },
  { title: 'RUC', value: 2 },
  { title: 'Pasaporte', value: 3 },
])

const stateOptions = ref([
  { title: 'Activo', value: 1 },
  { title: 'Inactivo', value: 2 },
])

const genderOptions = ref([
  { title: 'Masculino', value: 'M' },
  { title: 'Femenino', value: 'F' },
  { title: 'Otro', value: 'O' },
])

let clientsAbortController = null

// Cargar clientes
const loadClients = async () => {
  if (clientsAbortController) {
    clientsAbortController.abort()
  }
  clientsAbortController = new AbortController()

  loading.value = true
  try {
    // Primero probar sin filtros para ver si hay datos
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage.value,
    }

    // Agregar filtros solo si tienen valores
    if (searchForm.value.search) {
      params.search = searchForm.value.search
    }
    if (searchForm.value.type_client) {
      params.type_client = searchForm.value.type_client
    }
    if (searchForm.value.type_document) {
      params.type_document = searchForm.value.type_document
    }
    if (searchForm.value.state) {
      params.state = searchForm.value.state
    }

    console.log('Parámetros enviados:', params)

    const resp = await $api("clients", {
      method: "GET",
      params: params,
      signal: clientsAbortController.signal,
      onResponseError({ response }) {
        console.log(response._data.error)
      },
    })

    console.log('Respuesta completa de la API:', resp)
    console.log('Estructura de datos:', Object.keys(resp))
    console.log('clients en respuesta:', resp.clients)
    console.log('data en respuesta:', resp.data)

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

// Watch con debounce para resetear página cuando cambia el filtro
const debouncedLoadClients = useDebounceFn(() => {
  currentPage.value = 1
  loadClients()
}, 350)

watch(searchForm, () => {
  debouncedLoadClients()
}, { deep: true })

// Watch para paginación
watch(currentPage, () => {
  loadClients()
})

// Métodos
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
  // Eliminar el cliente de la lista local
  const index = clients.value.findIndex(client => client.id === deletedClient.id)
  if (index > -1) {
    clients.value.splice(index, 1)

    // Actualizar el total de items
    totalItems.value = Math.max(0, totalItems.value - 1)
  }

  // Cerrar el diálogo
  deleteDialog.value = false
  clientToDelete.value = null
}

const addNewClientFinal = () => {
  console.log("Agregar cliente final")
  isClientFinalAddDialogVisible.value = true
}

const handleClientFinalAdded = clientData => {
  console.log("Cliente final agregado:", clientData)
  loadClients()
}

const addClient = () => {
  console.log("Agregar cliente empresa")
  isClientCompanyAddDialogVisible.value = true
}

const handleClientCompanyAdded = clientData => {
  console.log("Cliente empresa agregado:", clientData)
  loadClients()
}

const editClient = client => {
  console.log("Editar cliente:", client)

  // Determinar tipo de cliente y abrir diálogo correspondiente
  if (client.type_client === '2' || client.type_client === 2) {
    // Cliente empresa
    companyToEdit.value = client
    isClientCompanyEditDialogVisible.value = true
  } else {
    // Cliente final
    clientToEdit.value = client
    isClientFinalEditDialogVisible.value = true
  }
}

const handleClientFinalUpdated = clientData => {
  console.log("Cliente final actualizado:", clientData)

  if (!clientData || !clientData.id) {
    console.error("Datos del cliente inválidos:", clientData)

    return
  }

  loadClients()
}

const handleClientCompanyUpdated = clientData => {
  console.log("Cliente empresa actualizado:", clientData)

  if (!clientData || !clientData.id) {
    console.error("Datos del cliente inválidos:", clientData)

    return
  }

  loadClients()
}

// Truncar texto
const truncate = (text, length = 50) => {
  if (!text) return ''

  return text.length > length ? text.slice(0, length) + '…' : text
}

// Montar componente
onMounted(() => {
  loadClients()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 client-management-page">
    <!-- Header y Filtros Fijos (Sticky Top) -->
    <div class="sticky-page-header-wrapper">
      <!-- Encabezado de la página -->
      <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-4 gap-4">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
            <VIcon icon="ri-user-3-line" color="primary" class="me-2" size="28" />
            Gestión de Clientes
          </h1>
          <p class="text-medium-emphasis mb-0">
            Registra, administra e importa la información de los clientes del taller
          </p>
        </div>
        <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
          <VBtn v-if="can('import_xml') || can('register_client')" color="secondary" variant="tonal"
            prepend-icon="ri-upload-cloud-2-line" @click="isImportDialogVisible = true">
            Importar
          </VBtn>
          <VBtn v-if="can('register_client')" color="primary" variant="outlined" prepend-icon="ri-user-add-line"
            @click="addNewClientFinal">
            Cliente Final
          </VBtn>
          <VBtn v-if="can('register_client')" color="primary" prepend-icon="ri-building-line" @click="addClient">
            Cliente Empresa
          </VBtn>
        </div>
      </div>

      <!-- Filtros y Búsqueda -->
      <VCard class="rounded-lg border-light border elevation-0 sticky-filter-card">
        <VCardText class="pa-4 bg-grey-lighten-5">
          <VForm ref="searchFormRef">
            <VRow class="gap-y-3">
              <VCol cols="12" md="6">
                <VTextField v-model="searchForm.search" label="Buscar cliente"
                  placeholder="Nombre, email, RUC o cédula..." clearable hide-details
                  variant="outlined" density="comfortable" color="primary" :loading="loading">
                  <template #prepend-inner>
                    <VProgressCircular v-if="loading" indeterminate color="primary" size="18" width="2" class="me-1" />
                    <VIcon v-else icon="ri-search-line" />
                  </template>
                </VTextField>
              </VCol>
              <VCol cols="12" sm="6" md="3">
                <VSelect v-model="searchForm.type_client" :items="typeClientOptions" item-title="title" item-value="value"
                  label="Tipo de Cliente" placeholder="Todos" clearable hide-details variant="outlined"
                  density="comfortable" color="primary" />
              </VCol>
              <VCol cols="12" sm="6" md="3">
                <VSelect v-model="searchForm.state" :items="stateOptions" item-title="title" item-value="value"
                  label="Estado" placeholder="Todos" clearable hide-details variant="outlined" density="comfortable"
                  color="primary" />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </div>

    <!-- Contenedor Principal (Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Tabla de clientes -->
      <div class="position-relative">
        <VTable hover class="client-table overflow-x-auto">
          <thead>
            <tr>
              <th class="text-left font-weight-bold text-uppercase" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase" style="width: 160px;">
                Cédula / RUC
              </th>
              <th class="text-left font-weight-bold text-uppercase" style="min-width: 250px;">
                Cliente / Razón Social
              </th>
              <th class="text-left font-weight-bold text-uppercase" style="width: 250px;">
                Email
              </th>
              <th class="text-left font-weight-bold text-uppercase" style="width: 140px;">
                Teléfono
              </th>
              <th class="text-left font-weight-bold text-uppercase" style="width: 110px;">
                Estado
              </th>
              <th class="text-center font-weight-bold text-uppercase" style="width: 120px;">
                Acciones
              </th>
            </tr>
          </thead>
          <!-- Cargando (Skeleton Rows) -->
          <tbody v-if="loading">
            <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
              <td class="py-4">
                <div class="shimmer-line w-40" />
              </td>
              <td class="py-4">
                <div class="shimmer-line w-60" />
              </td>
              <td class="py-4">
                <div class="shimmer-line w-75 mb-2" />
                <div class="shimmer-line w-50" />
              </td>
              <td class="py-4">
                <div class="shimmer-line w-60" />
              </td>
              <td class="py-4">
                <div class="shimmer-line w-80" />
              </td>
              <td class="py-4">
                <div class="shimmer-chip" />
              </td>
              <td class="py-4 text-center">
                <div class="d-flex justify-center gap-2">
                  <div class="shimmer-button" />
                  <div class="shimmer-button" />
                  <div class="shimmer-button" />
                </div>
              </td>
            </tr>
          </tbody>

          <!-- Sin resultados -->
          <tbody v-else-if="!clients.length">
            <tr>
              <td colspan="7" class="text-center text-medium-emphasis py-12">
                <VAvatar size="64" color="grey-lighten-4" class="mb-3">
                  <VIcon size="32" color="grey" icon="ri-user-line" />
                </VAvatar>
                <div class="text-h6 font-weight-semibold text-grey-darken-1">
                  No se encontraron clientes
                </div>
                <div class="text-body-2 text-grey">
                  Intenta ajustar tus criterios de búsqueda o agrega uno nuevo.
                </div>
              </td>
            </tr>
          </tbody>

          <!-- Datos Reales -->
          <tbody v-else>
            <tr v-for="client in clients" :key="client.id" class="client-row transition">
              <td class="font-weight-medium text-grey-darken-1">
                #{{ client.id }}
              </td>

              <!-- Documento (Cédula / RUC) -->
              <td>
                <div class="text-caption text-grey text-uppercase font-weight-bold">
                  {{ client.type_document === '1' || client.type_document === 1 ? 'Cédula' : client.type_document ===
                    '2' || client.type_document === 2 ? 'RUC' : (client.type_document === '3' || client.type_document ===
                      3 ? 'Pasaporte' : 'Identificación') }}
                </div>
                <div class="font-weight-bold text-grey-darken-3 font-mono">
                  {{ client.n_document || 'Sin documento' }}
                </div>
              </td>

              <!-- Nombre Completo / Razón Social -->
              <td>
                <div class="font-weight-bold text-grey-darken-4 text-uppercase">
                  {{ client.full_name || `${client.name} ${client.surname}` }}
                </div>
                <div v-if="client.address" class="text-caption text-grey text-uppercase mt-0.5"
                  style="line-height: 1.2;">
                  {{ client.address }}
                </div>
              </td>
              <!-- Email -->
              <td class="text-lowercase text-grey-darken-2 text-truncate" style="max-width: 250px;"
                :title="client.email">
                {{ client.email || '-' }}
              </td>
              <!-- Teléfono -->
              <td class="text-grey-darken-1 font-weight-medium">
                {{ client.phone || '-' }}
              </td>



              <!-- Estado -->
              <td>
                <VChip :color="parseInt(client.state) === 1 ? 'success' : 'error'" variant="tonal" size="small"
                  class="font-weight-semibold">
                  {{ parseInt(client.state) === 1 ? 'ACTIVO' : 'INACTIVO' }}
                </VChip>
              </td>

              <!-- Acciones -->
              <td class="text-center">
                <div class="d-flex justify-center align-center gap-1">
                  <IconBtn class="action-btn text-info" title="Ver Ficha" size="small" @click="showClient(client)">
                    <VIcon icon="ri-eye-line" size="18" />
                  </IconBtn>
                  <IconBtn v-if="can('edit_client')" class="action-btn text-warning" title="Editar Cliente" size="small"
                    @click="editClient(client)">
                    <VIcon icon="ri-pencil-line" size="18" />
                  </IconBtn>

                  <!-- Menú Más Opciones -->
                  <IconBtn class="action-btn text-secondary" title="Más Opciones" size="small">
                    <VIcon icon="ri-more-2-line" size="18" />
                    <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                      <VList density="compact" class="py-1 rounded elevation-3 border">
                        <VListItem prepend-icon="ri-history-line" title="Ver Historial" class="text-info text-body-2"
                          @click="showHistory(client)" />
                        <VDivider v-if="can('delete_client')" class="my-1" />
                        <VListItem v-if="can('delete_client')" prepend-icon="ri-delete-bin-6-line"
                          title="Eliminar Cliente" class="text-error text-body-2" @click="deleteClient(client)" />
                      </VList>
                    </VMenu>
                  </IconBtn>
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ clients.length }}</span> de <span class="font-weight-bold">{{
              totalItems }}</span> clientes
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="loadClients" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Diálogos -->
    <ClientFinalAddDialog v-if="isClientFinalAddDialogVisible" v-model:isDialogVisible="isClientFinalAddDialogVisible"
      @add-client-final="handleClientFinalAdded" />

    <ClientCompanyAddDialog v-if="isClientCompanyAddDialogVisible"
      v-model:isDialogVisible="isClientCompanyAddDialogVisible" @add-client-company="handleClientCompanyAdded" />

    <ClientFinalEditDialog v-if="isClientFinalEditDialogVisible"
      v-model:isDialogVisible="isClientFinalEditDialogVisible" :client-data="clientToEdit"
      @client-updated="handleClientFinalUpdated" />

    <ClientCompanyEditDialog v-if="isClientCompanyEditDialogVisible"
      v-model:isDialogVisible="isClientCompanyEditDialogVisible" :client-data="companyToEdit"
      @client-updated="handleClientCompanyUpdated" />

    <ClientShowDialog v-if="isClientShowDialogVisible" v-model:isDialogVisible="isClientShowDialogVisible"
      :client-data="clientToShow" />

    <ClientDeleteDialog v-if="deleteDialog" v-model:isDialogVisible="deleteDialog" :client-selected="clientToDelete"
      @delete-client="handleClientDeleted" />

    <SalesHistoryDialog v-model="isHistoryDialogVisible" :client-id="historyClientId" />

    <ImportData v-model:is-dialog-visible="isImportDialogVisible" default-tab="clients" @import-success="loadClients" />
  </div>
</template>
