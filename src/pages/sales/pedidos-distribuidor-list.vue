<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import Swal from 'sweetalert2'

const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

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

const formatShortDate = dateString => {
  if (!dateString) return '-'
  const cleanDateStr = dateString.split(' ')[0]
  const parts = cleanDateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
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
    customClass: {
      confirmButton: 'text-white',
      cancelButton: 'text-white'
    }
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

// Historial de repuestos
const isRepuestosDialogVisible = ref(false)
const repuestosHistorial = ref([])
const loadingRepuestos = ref(false)
const searchRepuesto = ref('')

// Filtros adicionales del diálogo
const filterCategory = ref('TODAS')
const filterRangeDate = ref(null)
const categoriesList = ref(['TODAS'])

const loadCategories = async () => {
  try {
    const response = await $api('categories?per_page=1000')
    const dbCats = response.categories || []
    const titles = dbCats.map(c => c.title).filter(Boolean)
    categoriesList.value = ['TODAS', ...titles]
  } catch (error) {
    console.error('Error al cargar categorías desde el backend:', error)
  }
}

const loadRepuestosHistorial = async () => {
  loadingRepuestos.value = true
  try {
    const response = await $api('sales/repuestos/historial')
    if (response.success || response.status === 200) {
      repuestosHistorial.value = response.data || []
    }
  } catch (error) {
    console.error('Error al cargar historial de repuestos:', error)
    showNotification('Error al cargar el historial de repuestos', 'error')
  } finally {
    loadingRepuestos.value = false
  }
}

const openRepuestosDialog = () => {
  isRepuestosDialogVisible.value = true
  loadRepuestosHistorial()
}

const resetFilters = () => {
  searchRepuesto.value = ''
  filterCategory.value = 'TODAS'
  filterRangeDate.value = null
}

const filteredRepuestos = computed(() => {
  let list = repuestosHistorial.value

  // 1. Filtro por categoría
  if (filterCategory.value && filterCategory.value !== 'TODAS') {
    list = list.filter(item => item.categoria === filterCategory.value)
  }

  // 2. Filtro por rango de fechas
  if (filterRangeDate.value) {
    const parts = filterRangeDate.value.split(" to ")
    const startDateStr = parts[0] ? parts[0].trim() : ""
    const endDateStr = parts[1] ? parts[1].trim() : ""

    if (startDateStr) {
      const start = new Date(startDateStr)
      list = list.filter(item => {
        if (!item.fecha) return false
        const itemDate = new Date(item.fecha.split(' ')[0])
        return itemDate >= start
      })
    }
    if (endDateStr) {
      const end = new Date(endDateStr)
      list = list.filter(item => {
        if (!item.fecha) return false
        const itemDate = new Date(item.fecha.split(' ')[0])
        return itemDate <= end
      })
    }
  }

  // 3. Filtro de búsqueda por texto
  const q = (searchRepuesto.value || '').toLowerCase().trim()
  if (q) {
    list = list.filter(item => {
      return (
        (item.cliente && item.cliente.toLowerCase().includes(q)) ||
        (item.cliente_dni && item.cliente_dni.toLowerCase().includes(q)) ||
        (item.vehiculo_placa && item.vehiculo_placa.toLowerCase().includes(q)) ||
        (item.vehiculo_modelo && item.vehiculo_modelo.toLowerCase().includes(q)) ||
        (item.repuesto && item.repuesto.toLowerCase().includes(q)) ||
        (item.categoria && item.categoria.toLowerCase().includes(q))
      )
    })
  }

  return list
})

const getCategoryColor = category => {
  const colors = {
    'Aceite': 'amber-darken-2',
    'Pastillas de Freno': 'deep-orange',
    'Amortiguadores': 'blue',
    'Filtros': 'teal',
    'Aire Acondicionado': 'cyan',
    'Otros Repuestos': 'grey',
  }
  return colors[category] || 'primary'
}

const getSuggestionColor = category => {
  const colors = {
    'Aceite': 'warning',
    'Pastillas de Freno': 'error',
    'Amortiguadores': 'indigo',
    'Filtros': 'success',
    'Aire Acondicionado': 'info',
  }
  return colors[category] || 'primary'
}

onMounted(() => {
  loadPedidos()
  loadCategories()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 pedidos-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-truck-line" color="primary" class="me-2" size="28" />
          Pedidos a Distribuidor
        </h1>
        <p class="text-medium-emphasis mb-0">
          Historial y estado de los pedidos solicitados a distribuidores
        </p>
      </div>
      <div class="d-flex gap-2 align-self-md-center align-self-end">
        <VBtn color="info" variant="outlined" prepend-icon="ri-history-line" @click="openRepuestosDialog">
          Historial Repuestos
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" to="/sales/pedidos-distribuidor">
          Nuevo Pedido
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow>
          <VCol cols="12" sm="6" md="4">
            <VTextField v-model="search" label="Buscar pedidos" placeholder="Buscar por distribuidor, RUC o ID..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto" clearable
              color="primary" @click:clear="clearSearch" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Pedidos -->
      <div class="position-relative bg-white rounded-xl border-light overflow-hidden">
        <VProgressLinear
          v-if="loading"
          indeterminate
          color="primary"
          height="3"
          class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;"
        />

        <div class="overflow-x-auto">
          <VTable hover class="pedidos-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase" style="width: 100px;">
                  ID
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 160px;">
                  FECHA / HORA
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">
                  DISTRIBUIDOR
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">
                  USUARIO
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 140px;">
                  ESTADO
                </th>
                <th class="text-right font-weight-bold text-uppercase" style="width: 110px;">
                  TOTAL
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 140px;">
                  ACCIONES
                </th>
              </tr>
            </thead>

            <!-- Cargando (Skeleton Rows) -->
            <tbody v-if="loading">
              <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
                <td class="py-4">
                  <div class="shimmer-line w-50"></div>
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-75"></div>
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-80"></div>
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-60"></div>
                </td>
                <td class="py-4 text-center">
                  <div class="shimmer-chip mx-auto"></div>
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-50 ms-auto"></div>
                </td>
                <td class="py-4 text-center">
                  <div class="d-flex justify-center gap-1">
                    <div class="shimmer-button"></div>
                    <div class="shimmer-button"></div>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else-if="pedidos.length === 0">
              <tr>
                <td colspan="7" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3 color-grey-lighten-1">
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

            <tbody v-else style="text-transform: uppercase;">
              <tr v-for="item in pedidos" :key="item.id" class="pedidos-row align-middle">
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
                  <div v-if="item.distribuidor?.ruc" class="text-caption text-medium-emphasis mt-0.5">
                    RUC: {{ item.distribuidor.ruc }}
                  </div>
                </td>
                <td>{{ item.usuario?.name || 'S/N' }}</td>
                <td class="text-center">
                  <VMenu close-on-content-click>
                    <template #activator="{ props }">
                      <div v-bind="props"
                        class="d-inline-flex align-center gap-2 px-3 py-1 rounded-pill cursor-pointer status-indicator"
                        :class="`text-${getStatusInfo(item.estado).color} border-${getStatusInfo(item.estado).color}`">
                        <div class="status-dot" :class="`bg-${getStatusInfo(item.estado).color}`" />
                        <span class="font-weight-bold text-caption text-uppercase" style="letter-spacing: 0.5px;">
                          {{ getStatusInfo(item.estado).text }}
                        </span>
                        <VIcon icon="ri-arrow-down-s-line" size="14" />
                      </div>
                    </template>
                    <VList density="compact">
                      <VListItem v-for="status in statusOptions" :key="status.value"
                        @click="updateStatus(item, status.value)">
                        <template #prepend>
                          <VIcon :icon="status.icon" :color="status.color" class="mr-2" size="20" />
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
                    <VBtn class="action-btn" icon="ri-printer-line" variant="text" size="small" color="info"
                      title="Imprimir" @click="printPedido(item.id)" />

                    <VBtn class="action-btn" icon="ri-file-pdf-line" variant="text" size="small" color="success"
                      title="Ver PDF (Sin Precios)" @click="generateSinglePDF(item)" />
                    <VBtn class="action-btn" icon="ri-eye-line" variant="text" size="small" color="info"
                      title="Ver Detalle" :loading="viewLoading && selectedPedido?.id === item.id"
                      @click="viewPedidoDetails(item)" />
                    <VBtn class="action-btn" icon="ri-edit-line" variant="text" size="small" color="warning"
                      title="Editar Pedido" @click="editPedido(item)" />
                    <VBtn class="action-btn" icon="ri-delete-bin-line" variant="text" size="small" color="error"
                      title="Eliminar Pedido" @click="deletePedido(item)" />
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
            Mostrando <span class="font-weight-bold">{{ pedidos.length }}</span> de <span class="font-weight-bold">{{
              totalItems }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Dialogo de Detalle de Pedido -->
    <VDialog v-model="isViewDialogVisible" max-width="800">
      <VCard v-if="selectedPedido" class="rounded-lg">
        <VCardTitle class="pa-6 d-flex align-center justify-space-between border-bottom-light">
          <div class="d-flex align-center">
            <VIcon icon="ri-truck-line" color="primary" class="mr-2" />
            <span class="text-h6 font-weight-bold">Detalle de Pedido #{{ String(selectedPedido.id).padStart(5, '0')
              }}</span>
          </div>
          <VMenu close-on-content-click>
            <template #activator="{ props }">
              <div v-bind="props"
                class="d-inline-flex align-center gap-2 px-3 py-1 rounded-pill cursor-pointer status-indicator"
                :class="`text-${getStatusInfo(selectedPedido.estado).color} border-${getStatusInfo(selectedPedido.estado).color}`">
                <div class="status-dot" :class="`bg-${getStatusInfo(selectedPedido.estado).color}`" />
                <span class="font-weight-bold text-caption text-uppercase" style="letter-spacing: 0.5px;">
                  {{ getStatusInfo(selectedPedido.estado).text }}
                </span>
                <VIcon icon="ri-arrow-down-s-line" size="14" />
              </div>
            </template>
            <VList density="compact">
              <VListItem v-for="status in statusOptions" :key="status.value"
                @click="updateStatus(selectedPedido, status.value)">
                <template #prepend>
                  <VIcon :icon="status.icon" :color="status.color" class="mr-2" size="20" />
                </template>
                <VListItemTitle>{{ status.label }}</VListItemTitle>
              </VListItem>
            </VList>
          </VMenu>
        </VCardTitle>

        <VCardText class="pa-6">
          <VRow class="mb-4">
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">
                Distribuidor / Proveedor:
              </div>
              <div class="text-body-1 font-weight-bold">
                {{ selectedPedido.distribuidor?.name || 'DESCONOCIDO' }}
              </div>
              <div v-if="selectedPedido.distribuidor?.ruc" class="text-body-2 mt-1">
                RUC: {{ selectedPedido.distribuidor.ruc }}
              </div>
              <div v-if="selectedPedido.distribuidor?.address" class="text-body-2">
                Dirección: {{ selectedPedido.distribuidor.address }}
              </div>
            </VCol>
            <VCol cols="12" sm="6">
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
                  <th class="font-weight-bold text-left text-grey-darken-3"
                    style="font-size: 0.72rem; letter-spacing: 0.6px;">
                    PRODUCTO
                  </th>
                  <th class="font-weight-bold text-center text-grey-darken-3"
                    style="width: 100px; font-size: 0.72rem; letter-spacing: 0.6px;">
                    CANTIDAD
                  </th>
                  <th class="font-weight-bold text-right text-grey-darken-3"
                    style="width: 160px; font-size: 0.72rem; letter-spacing: 0.6px;">
                    PRECIO COMPRA EST.
                  </th>
                  <th class="font-weight-bold text-right text-grey-darken-3"
                    style="width: 130px; font-size: 0.72rem; letter-spacing: 0.6px;">
                    SUBTOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in selectedPedido.detalles" :key="item.id">
                  <td>
                    <div class="font-weight-medium text-grey-darken-4 text-wrap">
                      {{ item.description }}
                    </div>
                    <div v-if="item.producto?.sku" class="text-caption text-medium-emphasis mt-0.5">
                      SKU: {{ item.producto.sku }}
                    </div>
                    <VChip v-if="!item.producto_id" size="x-small" color="orange" variant="tonal" class="mt-1">
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
          <VBtn color="info" prepend-icon="ri-printer-line" @click="printPedido(selectedPedido.id)">
            Imprimir
          </VBtn>

          <VBtn color="success" prepend-icon="ri-file-pdf-line" @click="generateSinglePDF(selectedPedido)">
            Generar PDF
          </VBtn>
          <VBtn color="secondary" variant="tonal" @click="isViewDialogVisible = false">
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Diálogo de Historial de Repuestos Vendidos -->
    <VDialog v-model="isRepuestosDialogVisible" max-width="1200px" scrollable>
      <VCard class="rounded-lg">
        <!-- Encabezado del diálogo acorde al sistema -->
        <VCardTitle class="pa-6 d-flex align-center justify-space-between border-bottom-light">
          <div class="d-flex align-center">
            <VIcon icon="ri-history-line" color="primary" class="mr-2" />
            <span class="text-h6 font-weight-bold">Historial de Repuestos & Mantenimiento</span>
          </div>
          <VBtn icon="ri-close-line" color="grey-darken-1" variant="text" size="small"
            @click="isRepuestosDialogVisible = false" />
        </VCardTitle>

        <VCardText class="pa-6 bg-grey-lighten-5">
          <!-- Filtros de búsqueda locales -->
          <div class="d-flex flex-wrap align-center gap-3 mb-5 bg-white pa-4 rounded-lg border">
            <VTextField v-model="searchRepuesto" label="Buscar por repuesto, placa, marca..."
              placeholder="Ej. Aceite, GSM-1234..." prepend-inner-icon="ri-search-line" variant="outlined"
              density="compact" hide-details clearable style="min-width: 240px; flex: 1 1 200px;" color="primary" />

            <VSelect v-model="filterCategory" :items="categoriesList" label="Categoría" variant="outlined"
              density="compact" hide-details style="min-width: 160px; flex: 1 1 120px;" color="primary" />

            <AppDateTimePicker v-model="filterRangeDate" label="Rango de Fechas" placeholder="Seleccionar rango"
              :config="{ mode: 'range' }" variant="outlined" density="compact" hide-details
              style="min-width: 240px; flex: 1 1 200px;" color="primary" />

            <div class="d-flex gap-2 ms-auto">
              <VBtn color="secondary" variant="outlined" prepend-icon="ri-filter-off-line" @click="resetFilters"
                size="comfortable">
                Limpiar
              </VBtn>
              <VBtn color="primary" variant="tonal" prepend-icon="ri-refresh-line" @click="loadRepuestosHistorial"
                :loading="loadingRepuestos" size="comfortable">
                Actualizar
              </VBtn>
            </div>
          </div>

          <!-- Loader de carga -->
          <div v-if="loadingRepuestos" class="d-flex flex-column align-center justify-center py-12">
            <VProgressCircular indeterminate color="primary" size="64" width="6" class="mb-4" />
            <span class="text-subtitle-1 text-medium-emphasis">Cargando historial de repuestos...</span>
          </div>

          <!-- Tabla de Resultados -->
          <div v-else-if="filteredRepuestos.length > 0" class="rounded-lg border bg-white overflow-hidden elevation-0">
            <VTable hover class="pedidos-table">
              <thead class="bg-grey-lighten-4">
                <tr>
                  <th class="text-left font-weight-bold text-grey-darken-3">FECHA</th>
                  <th class="text-left font-weight-bold text-grey-darken-3">COMPROBANTE</th>
                  <th class="text-left font-weight-bold text-grey-darken-3">CATEGORÍA</th>
                  <th class="text-center font-weight-bold text-grey-darken-3">CANT.</th>
                  <th class="text-left font-weight-bold text-grey-darken-3">REPUESTO</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredRepuestos" :key="item.id" class="align-middle">
                  <td class="text-no-wrap text-caption text-grey-darken-3">
                    {{ formatShortDate(item.fecha) }}
                  </td>
                  <td class="text-no-wrap text-caption text-grey-darken-3">
                    {{ item.comprobante }}
                  </td>
                  <td>
                    <VChip size="small" :color="getCategoryColor(item.categoria)" variant="tonal"
                      class="font-weight-bold">
                      {{ item.categoria }}
                    </VChip>
                  </td>
                  <td class="text-center font-weight-bold">
                    {{ item.cantidad }}
                  </td>
                  <td>
                    <div class="text-wrap font-weight-medium max-w-200">
                      {{ item.repuesto }}
                    </div>
                    <div class="text-caption text-medium-emphasis mt-0" v-if="item.sku">
                      SKU: {{ item.sku }}
                    </div>
                  </td>

                </tr>
              </tbody>
            </VTable>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12 bg-white rounded-xl border">
            <VAvatar size="80" color="grey-lighten-3" class="mb-4">
              <VIcon icon="ri-file-history-line" size="40" class="text-grey-darken-1" />
            </VAvatar>
            <h4 class="text-h6 font-weight-bold text-grey-darken-3 mb-1">Sin registros encontrados</h4>
            <p class="text-body-2 text-medium-emphasis mb-0 max-w-400 mx-auto">
              No se encontraron repuestos vendidos que coincidan con la búsqueda o no hay ventas registradas con estos
              componentes.
            </p>
          </div>
        </VCardText>

        <VCardActions class="pa-5 bg-grey-lighten-4 border-top-light justify-end">
          <VBtn color="secondary" variant="tonal" @click="isRepuestosDialogVisible = false" class="px-5">
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.shimmer-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-chip {
  width: 60px;
  height: 20px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-button {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
