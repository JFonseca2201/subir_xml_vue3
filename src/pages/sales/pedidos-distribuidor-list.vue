<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import Swal from 'sweetalert2'

const router = useRouter()
const { showNotification } = useGlobalToast()

const loading = ref(false)
const pedidos = ref([])
const search = ref('')

const statusOptions = [
  { value: 'draft', label: 'Borrador', color: 'secondary', icon: 'ri-file-edit-line' },
  { value: 'pendiente', label: 'Pendiente', color: 'warning', icon: 'ri-time-line' },
  { value: 'por_confirmar', label: 'Por Confirmar', color: 'info', icon: 'ri-checkbox-circle-line' },
  { value: 'completado', label: 'Completado', color: 'success', icon: 'ri-check-line' },
  { value: 'cancelado', label: 'Cancelado', color: 'error', icon: 'ri-close-circle-line' },
]

// Paginación
const currentPage = ref(1)
const totalItems = ref(0)
const totalPages = ref(0)

// Modal de Detalles
const isViewDialogVisible = ref(false)
const selectedPedido = ref(null)
const viewLoading = ref(false)

const loadPedidos = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      search: search.value,
    }

    // Limpiar vacíos
    if (!params.search) {
      delete params.search
    }

    const response = await $api('pedidos-distribuidor', { params })

    if (response.success || response.status === 200) {
      const paginator = response.data || {}

      pedidos.value = paginator.data || []
      totalItems.value = paginator.total || pedidos.value.length || 0
      totalPages.value = paginator.last_page || 1
    } else {
      pedidos.value = []
    }
  } catch (error) {
    console.error('Error al cargar pedidos:', error)
    showNotification('Error al cargar la lista de pedidos', 'error')
  } finally {
    loading.value = false
  }
}

const clearSearch = () => {
  search.value = ''
  currentPage.value = 1
  loadPedidos()
}

// Helpers de Formateo
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const formatDate = dateString => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

const getStatusInfo = status => {
  const map = {
    draft: { color: 'secondary', text: 'Borrador', icon: 'ri-file-edit-line' },
    pendiente: { color: 'warning', text: 'Pendiente', icon: 'ri-time-line' },
    por_confirmar: { color: 'info', text: 'Por Confirmar', icon: 'ri-checkbox-circle-line' },
    completado: { color: 'success', text: 'Completado', icon: 'ri-check-line' },
    cancelado: { color: 'error', text: 'Cancelado', icon: 'ri-close-circle-line' },
  }

  
  return map[status] || { color: 'grey', text: status, icon: 'ri-question-line' }
}

const viewPedidoDetails = async pedido => {
  try {
    viewLoading.value = true

    const response = await $api(`pedidos-distribuidor/${pedido.id}`)
    if (response.success || response.status === 200) {
      selectedPedido.value = response.data
      isViewDialogVisible.value = true
    } else {
      showNotification('Error al obtener detalles del pedido', 'error')
    }
  } catch (error) {
    console.error('Error al ver pedido:', error)
    showNotification('Error al obtener detalles del pedido', 'error')
  } finally {
    viewLoading.value = false
  }
}

const generateSinglePDF = pedido => {
  const token = localStorage.getItem('token')
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const pdfUrl = `${apiBaseUrl}/pedidos-distribuidor/${pedido.id}/pdf?token=${token}`
  
  const printWindow = window.open(pdfUrl, '_blank')
  if (printWindow) {
    printWindow.focus()
    showNotification('PDF cargado exitosamente', 'success')
  } else {
    showNotification('Permite las ventanas emergentes para abrir el PDF', 'warning')
  }
}

const printPedido = pedidoId => {
  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
    const pdfUrl = `${apiBaseUrl}/pedidos-distribuidor/${pedidoId}/pdf?token=${token}&print=true`
    
    const printWindow = window.open(pdfUrl, '_blank')
    if (printWindow) {
      printWindow.focus()
      showNotification('Previsualización de impresión cargada', 'info')
    } else {
      showNotification('Permite las ventanas emergentes para abrir el PDF', 'warning')
    }
  } catch (error) {
    console.error('Error al imprimir:', error)
    showNotification('Error al abrir la previsualización del pedido', 'error')
  }
}

const printDirectlyFromServer = async (id, type) => {
  try {
    const endpoint = type === 'pedido' ? `pedidos-distribuidor/${id}/print` : `work-orders/${id}/print`
    const response = await $api(endpoint, { method: 'POST' })
    if (response.success) {
      showNotification(response.message || 'Impresión directa enviada', 'success')
    } else {
      showNotification(response.message || 'Error en impresión directa', 'error')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al conectar con la impresora del servidor', 'error')
  }
}

const editPedido = pedido => {
  router.push(`/sales/pedidos-distribuidor?id=${pedido.id}`)
}

const deletePedido = async pedido => {
  const result = await Swal.fire({
    title: '¿Estás seguro?',
    text: `Vas a eliminar el pedido #${String(pedido.id).padStart(5, '0')}. Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#fb7578',
    cancelButtonColor: '#90a4ae',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })

  if (result.isConfirmed) {
    loading.value = true
    try {
      const response = await $api(`pedidos-distribuidor/${pedido.id}`, {
        method: 'DELETE',
      })

      if (response.success || response.status === 200) {
        showNotification('Pedido eliminado exitosamente', 'success')
        loadPedidos()
      } else {
        showNotification(response.message || 'Error al eliminar el pedido', 'error')
      }
    } catch (error) {
      console.error('Error al eliminar pedido:', error)
      showNotification('Error al eliminar el pedido', 'error')
    } finally {
      loading.value = false
    }
  }
}

const updateStatus = async (pedido, newStatus) => {
  if (pedido.estado === newStatus) return

  const result = await Swal.fire({
    title: '¿Confirmar cambio de estado?',
    text: `Vas a cambiar el estado del pedido a "${newStatus.replace('_', ' ').toUpperCase()}".`,
    icon: 'info',
    showCancelButton: true,
    confirmButtonColor: '#4f83cc',
    cancelButtonColor: '#90a4ae',
    confirmButtonText: 'Sí, cambiar',
    cancelButtonText: 'Cancelar',
  })

  if (result.isConfirmed) {
    loading.value = true
    try {
      const response = await $api(`pedidos-distribuidor/${pedido.id}/status`, {
        method: 'PUT',
        body: { estado: newStatus },
      })

      if (response.success || response.status === 200) {
        showNotification('Estado del pedido actualizado exitosamente', 'success')
        if (selectedPedido.value && selectedPedido.value.id === pedido.id) {
          selectedPedido.value.estado = newStatus
        }
        loadPedidos()
      } else {
        showNotification(response.message || 'Error al actualizar el estado', 'error')
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error)
      showNotification('Error al actualizar el estado del pedido', 'error')
    } finally {
      loading.value = false
    }
  }
}

// Watchers
watch(currentPage, () => {
  loadPedidos()
})

// Búsqueda en tiempo real (debounce simple)
let searchTimeout = null
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadPedidos()
  }, 500)
})

onMounted(() => {
  loadPedidos()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 pedidos-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon
            icon="ri-truck-line"
            color="primary"
            class="me-2"
            size="28"
          />
          Pedidos a Distribuidor
        </h1>
        <p class="text-medium-emphasis mb-0">
          Historial y estado de los pedidos solicitados a distribuidores
        </p>
      </div>
      <VBtn
        color="primary"
        prepend-icon="ri-add-line"
        to="/sales/pedidos-distribuidor"
        class="align-self-md-center align-self-end"
      >
        Nuevo Pedido
      </VBtn>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow>
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VTextField
              v-model="search"
              label="Buscar pedidos"
              placeholder="Buscar por distribuidor, RUC o ID..."
              prepend-inner-icon="ri-search-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              @click:clear="clearSearch"
            />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Pedidos -->
      <div class="position-relative">
        <VProgressLinear
          v-if="loading"
          indeterminate
          color="primary"
          height="3"
          class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;"
        />
        
        <div class="overflow-x-auto">
          <VTable
            hover
            class="pedidos-table"
          >
            <thead>
              <tr>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="width: 100px;"
                >
                  ID PEDIDO
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="width: 160px;"
                >
                  FECHA / HORA
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="min-width: 200px;"
                >
                  DISTRIBUIDOR
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="min-width: 150px;"
                >
                  USUARIO
                </th>
                <th
                  class="text-center font-weight-bold text-uppercase"
                  style="width: 140px;"
                >
                  ESTADO
                </th>
                <th
                  class="text-right font-weight-bold text-uppercase"
                  style="width: 110px;"
                >
                  TOTAL EST.
                </th>
                <th
                  class="text-center font-weight-bold text-uppercase"
                  style="width: 140px;"
                >
                  ACCIONES
                </th>
              </tr>
            </thead>

            <tbody v-if="loading">
              <tr>
                <td
                  colspan="7"
                  class="text-center pa-6"
                >
                  <VProgressCircular
                    indeterminate
                    color="primary"
                    size="40"
                  />
                  <div class="mt-2 text-medium-emphasis">
                    Cargando registros...
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else-if="pedidos.length === 0">
              <tr>
                <td
                  colspan="7"
                  class="text-center pa-8 text-medium-emphasis"
                >
                  <VIcon
                    size="48"
                    class="mb-3 color-grey-lighten-1"
                  >
                    ri-file-list-3-line
                  </VIcon>
                  <div class="text-h6">
                    No se encontraron pedidos
                  </div>
                  <div class="text-body-2">
                    Prueba cambiando el filtro de búsqueda o crea uno nuevo
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody
              v-else
              style="text-transform: uppercase;"
            >
              <tr
                v-for="item in pedidos"
                :key="item.id"
                class="pedidos-row align-middle"
              >
                <td class="font-weight-bold text-primary text-no-wrap">
                  #{{ String(item.id).padStart(5, '0') }}
                </td>
                <td class="text-no-wrap">
                  {{ formatDate(item.created_at) }}
                </td>
                <td>
                  <div class="font-weight-semibold text-grey-darken-4">
                    {{ item.distribuidor?.name || 'DESCONOCIDO' }}
                  </div>
                  <div
                    v-if="item.distribuidor?.ruc"
                    class="text-caption text-medium-emphasis mt-0.5"
                  >
                    RUC: {{ item.distribuidor.ruc }}
                  </div>
                </td>
                <td>{{ item.usuario?.name || 'S/N' }}</td>
                <td class="text-center">
                  <VMenu close-on-content-click>
                    <template #activator="{ props }">
                      <div 
                        v-bind="props" 
                        class="d-inline-flex align-center gap-2 px-3 py-1 rounded-pill cursor-pointer status-indicator"
                        :class="`text-${getStatusInfo(item.estado).color} border-${getStatusInfo(item.estado).color}`"
                      >
                        <div
                          class="status-dot"
                          :class="`bg-${getStatusInfo(item.estado).color}`"
                        />
                        <span
                          class="font-weight-bold text-caption text-uppercase"
                          style="letter-spacing: 0.5px;"
                        >
                          {{ getStatusInfo(item.estado).text }}
                        </span>
                        <VIcon
                          icon="ri-arrow-down-s-line"
                          size="14"
                        />
                      </div>
                    </template>
                    <VList density="compact">
                      <VListItem
                        v-for="status in statusOptions"
                        :key="status.value"
                        @click="updateStatus(item, status.value)"
                      >
                        <template #prepend>
                          <VIcon
                            :icon="status.icon"
                            :color="status.color"
                            class="mr-2"
                            size="20"
                          />
                        </template>
                        <VListItemTitle>{{ status.label }}</VListItemTitle>
                      </VListItem>
                    </VList>
                  </VMenu>
                </td>
                <td class="text-no-wrap text-right font-weight-bold text-subtitle-1 text-grey-darken-4">
                  {{ formatCurrency(item.total) }}
                </td>
                <td class="text-no-wrap text-center">
                  <div class="d-flex justify-center align-center gap-1">
                    <VBtn
                      class="action-btn"
                      icon="ri-printer-line"
                      variant="text"
                      size="small"
                      color="info"
                      title="Imprimir"
                      @click="printPedido(item.id)"
                    />

                    <VBtn
                      class="action-btn"
                      icon="ri-file-pdf-line"
                      variant="text"
                      size="small"
                      color="success"
                      title="Ver PDF (Sin Precios)"
                      @click="generateSinglePDF(item)"
                    />
                    <VBtn
                      class="action-btn"
                      icon="ri-eye-line"
                      variant="text"
                      size="small"
                      color="info"
                      title="Ver Detalle"
                      :loading="viewLoading && selectedPedido?.id === item.id"
                      @click="viewPedidoDetails(item)"
                    />
                    <VBtn
                      class="action-btn"
                      icon="ri-edit-line"
                      variant="text"
                      size="small"
                      color="warning"
                      title="Editar Pedido"
                      @click="editPedido(item)"
                    />
                    <VBtn
                      class="action-btn"
                      icon="ri-delete-bin-line"
                      variant="text"
                      size="small"
                      color="error"
                      title="Eliminar Pedido"
                      @click="deletePedido(item)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ pedidos.length }}</span> de <span class="font-weight-bold">{{ totalItems }}</span> registros
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            color="primary"
          />
        </div>
      </VCardActions>
    </VCard>

    <!-- Dialogo de Detalle de Pedido -->
    <VDialog
      v-model="isViewDialogVisible"
      max-width="800"
    >
      <VCard
        v-if="selectedPedido"
        class="rounded-lg"
      >
        <VCardTitle class="pa-6 d-flex align-center justify-space-between border-bottom-light">
          <div class="d-flex align-center">
            <VIcon
              icon="ri-truck-line"
              color="primary"
              class="mr-2"
            />
            <span class="text-h6 font-weight-bold">Detalle de Pedido #{{ String(selectedPedido.id).padStart(5, '0') }}</span>
          </div>
          <VMenu close-on-content-click>
            <template #activator="{ props }">
              <div 
                v-bind="props" 
                class="d-inline-flex align-center gap-2 px-3 py-1 rounded-pill cursor-pointer status-indicator"
                :class="`text-${getStatusInfo(selectedPedido.estado).color} border-${getStatusInfo(selectedPedido.estado).color}`"
              >
                <div
                  class="status-dot"
                  :class="`bg-${getStatusInfo(selectedPedido.estado).color}`"
                />
                <span
                  class="font-weight-bold text-caption text-uppercase"
                  style="letter-spacing: 0.5px;"
                >
                  {{ getStatusInfo(selectedPedido.estado).text }}
                </span>
                <VIcon
                  icon="ri-arrow-down-s-line"
                  size="14"
                />
              </div>
            </template>
            <VList density="compact">
              <VListItem
                v-for="status in statusOptions"
                :key="status.value"
                @click="updateStatus(selectedPedido, status.value)"
              >
                <template #prepend>
                  <VIcon
                    :icon="status.icon"
                    :color="status.color"
                    class="mr-2"
                    size="20"
                  />
                </template>
                <VListItemTitle>{{ status.label }}</VListItemTitle>
              </VListItem>
            </VList>
          </VMenu>
        </VCardTitle>

        <VCardText class="pa-6">
          <VRow class="mb-4">
            <VCol
              cols="12"
              sm="6"
            >
              <div class="text-caption text-medium-emphasis">
                Distribuidor / Proveedor:
              </div>
              <div class="text-body-1 font-weight-bold">
                {{ selectedPedido.distribuidor?.name || 'DESCONOCIDO' }}
              </div>
              <div
                v-if="selectedPedido.distribuidor?.ruc"
                class="text-body-2 mt-1"
              >
                RUC: {{ selectedPedido.distribuidor.ruc }}
              </div>
              <div
                v-if="selectedPedido.distribuidor?.address"
                class="text-body-2"
              >
                Dirección: {{ selectedPedido.distribuidor.address }}
              </div>
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <div class="text-caption text-medium-emphasis">
                Generado por:
              </div>
              <div class="text-body-1 font-weight-bold">
                {{ selectedPedido.usuario?.name || 'S/N' }}
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                Fecha y Hora:
              </div>
              <div class="text-body-2">
                {{ formatDate(selectedPedido.created_at) }}
              </div>
            </VCol>
          </VRow>

          <VDivider class="mb-4" />

          <div class="text-h6 font-weight-bold mb-3">
            Ítems Solicitados
          </div>

          <div class="pedido-items-table-wrap">
            <VTable class="pedido-items-table w-100">
              <thead class="bg-grey-lighten-5">
                <tr>
                  <th
                    class="font-weight-bold text-left text-grey-darken-3"
                    style="font-size: 0.72rem; letter-spacing: 0.6px;"
                  >
                    PRODUCTO
                  </th>
                  <th
                    class="font-weight-bold text-center text-grey-darken-3"
                    style="width: 100px; font-size: 0.72rem; letter-spacing: 0.6px;"
                  >
                    CANTIDAD
                  </th>
                  <th
                    class="font-weight-bold text-right text-grey-darken-3"
                    style="width: 160px; font-size: 0.72rem; letter-spacing: 0.6px;"
                  >
                    PRECIO COMPRA EST.
                  </th>
                  <th
                    class="font-weight-bold text-right text-grey-darken-3"
                    style="width: 130px; font-size: 0.72rem; letter-spacing: 0.6px;"
                  >
                    SUBTOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in selectedPedido.detalles"
                  :key="item.id"
                >
                  <td>
                    <div class="font-weight-medium text-grey-darken-4 text-wrap">
                      {{ item.description }}
                    </div>
                    <div
                      v-if="item.producto?.sku"
                      class="text-caption text-medium-emphasis mt-0.5"
                    >
                      SKU: {{ item.producto.sku }}
                    </div>
                    <VChip
                      v-if="!item.producto_id"
                      size="x-small"
                      color="orange"
                      variant="tonal"
                      class="mt-1"
                    >
                      Ingreso Manual
                    </VChip>
                  </td>
                  <td class="text-center">
                    {{ item.cantidad }}
                  </td>
                  <td class="text-right">
                    {{ formatCurrency(item.precio_compra_estimado) }}
                  </td>
                  <td class="text-right font-weight-bold text-primary">
                    {{ formatCurrency(item.cantidad * item.precio_compra_estimado) }}
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>

          <div class="d-flex justify-end pt-5">
            <div class="text-right">
              <span class="text-subtitle-1 text-medium-emphasis mr-4">Total Estimado del Pedido:</span>
              <span class="text-h5 font-weight-black text-primary">{{ formatCurrency(selectedPedido.total) }}</span>
            </div>
          </div>
        </VCardText>

        <VCardActions class="pa-6 border-top-light justify-end gap-2">
          <VBtn
            color="info"
            prepend-icon="ri-printer-line"
            @click="printPedido(selectedPedido.id)"
          >
            Imprimir
          </VBtn>

          <VBtn
            color="success"
            prepend-icon="ri-file-pdf-line"
            @click="generateSinglePDF(selectedPedido)"
          >
            Generar PDF
          </VBtn>
          <VBtn
            color="secondary"
            variant="tonal"
            @click="isViewDialogVisible = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
