<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getBrandNameById } from '@/data/vehicleBrands'
import WorkOrderTimelineDialog from '@/components/dialogs/WorkOrderTimelineDialog.vue'
import AttachReceiptsDialog from '@/components/common/AttachReceiptsDialog.vue'

const router = useRouter()
const { showNotification } = useGlobalToast()
import { useLoaderStore } from '@/stores/loader'

const loader = useLoaderStore()
import { usePermissions } from '@/composables/usePermissions'

const { can } = usePermissions()

// Comprobantes / Adjuntos
const isReceiptsDialogVisible = ref(false)
const selectedReceiptsOrder = ref(null)

const openReceiptsDialog = workOrder => {
  selectedReceiptsOrder.value = workOrder
  isReceiptsDialogVisible.value = true
}

const showTimelineDialog = ref(false)
const selectedTimelineOrder = ref(null)

const openTimeline = workOrder => {
  selectedTimelineOrder.value = workOrder
  showTimelineDialog.value = true
}

const isLoading = ref(false)
const workOrders = ref([])
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const isSearching = ref(false)
const statusFilter = ref('all')
const selectedWorkOrder = ref(null)
const showDetailsDialog = ref(false)
const loadingOrders = ref(null)
const showDeleteDialog = ref(false)
const workOrderToDelete = ref(null)

const currentPage = ref(1)
const itemsPerPage = ref(10)


const statusOptions = [
  { title: 'Todos', value: 'all' },
  { title: 'Borrador', value: 'draft' },
  { title: 'Recibido', value: 'received' },
  { title: 'En Progreso', value: 'in_progress' },
  { title: 'Listo', value: 'ready' },
  { title: 'Entregado', value: 'delivered' },
]

const statusColors = {
  draft: 'secondary',
  received: 'info',
  in_progress: 'warning',
  ready: 'success',
  delivered: 'grey',
}

const statusIcons = {
  draft: 'ri-draft-line',
  received: 'ri-file-list-3-line',
  in_progress: 'ri-tools-line',
  ready: 'ri-checkbox-circle-line',
  delivered: 'ri-truck-line',
}

const statusAnimations = {
  draft: '',
  received: '',
  in_progress: 'animate-pulse',
  ready: 'halo-active',
  delivered: '',
}

const statusBgClasses = {
  draft: 'bg-grey-lighten-3',
  received: 'bg-info-lighten-5',
  in_progress: 'bg-warning-lighten-5',
  ready: 'bg-success-lighten-5',
  delivered: 'bg-grey-lighten-4',
}

const statusLabels = {
  draft: 'Borrador',
  received: 'Recibido',
  in_progress: 'En Progreso',
  ready: 'Listo',
  delivered: 'Entregado',
}

const filteredWorkOrders = computed(() => {
  let filtered = workOrders.value

  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(wo => wo.status === statusFilter.value)
  }

  if (debouncedSearchQuery.value) {
    const query = debouncedSearchQuery.value.toLowerCase()
    const cleanQuery = query.replace(/[^a-z0-9]/g, '')

    filtered = filtered.filter(wo => {
      const cleanNumber = wo.number?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
      const cleanClientName = wo.client?.full_name?.toLowerCase() || ''
      const cleanClientDoc = wo.client?.n_document?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
      const cleanLicensePlate = wo.vehicle?.license_plate?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

      return cleanNumber.includes(cleanQuery) ||
        cleanClientName.includes(query) ||
        cleanClientDoc.includes(cleanQuery) ||
        cleanLicensePlate.includes(cleanQuery)
    })
  }

  return filtered
})

const stats = computed(() => {
  const total = workOrders.value.length
  const received = workOrders.value.filter(wo => wo.status === 'received').length
  const inProgress = workOrders.value.filter(wo => wo.status === 'in_progress').length
  const ready = workOrders.value.filter(wo => wo.status === 'ready').length
  const delivered = workOrders.value.filter(wo => wo.status === 'delivered').length

  return { total, received, inProgress, ready, delivered }
})

const paginatedWorkOrders = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  
  return filteredWorkOrders.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredWorkOrders.value.length / itemsPerPage.value)
})

const parseDateLocal = dateStr => {
  if (!dateStr) return null
  let cleanStr = dateStr.trim()
  
  if (!cleanStr.includes(':')) {
    const parts = cleanStr.split(/[-/]/)
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      
      return new Date(year, month, day)
    }
  } else {
    cleanStr = cleanStr.replace(' ', 'T')
  }
  
  return new Date(cleanStr)
}

const getLocalDateStr = dateObj => {
  if (!dateObj || isNaN(dateObj.getTime())) return 'N/A'
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

const groupedWorkOrders = computed(() => {
  const groups = {}

  paginatedWorkOrders.value.forEach(wo => {
    // Extraemos la fecha desde 'date' si existe, o si no 'created_at'
    const sourceDate = wo.date ? wo.date : wo.created_at
    const dateObj = parseDateLocal(sourceDate)
    const dateStr = getLocalDateStr(dateObj)
    if (!groups[dateStr]) {
      groups[dateStr] = []
    }
    groups[dateStr].push(wo)
  })
  
  return groups
})

const formatDateGroup = dateStr => {
  if (dateStr === 'N/A') return 'Sin Fecha'
  const date = new Date(dateStr + 'T00:00:00')
  
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

const debouncedSetSearch = useDebounceFn(val => {
  debouncedSearchQuery.value = val || ''
  isSearching.value = false
}, 350)

watch(searchQuery, val => {
  isSearching.value = true
  debouncedSetSearch(val)
})

watch([debouncedSearchQuery, statusFilter], () => {
  currentPage.value = 1
})

let workOrdersAbortController = null

const loadWorkOrders = async () => {
  if (workOrdersAbortController) {
    workOrdersAbortController.abort()
  }
  workOrdersAbortController = new AbortController()

  isLoading.value = true
  try {
    const response = await $api('work-orders', {
      signal: workOrdersAbortController.signal,
    })

    workOrders.value = response.data || []
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
    console.error('Error al cargar órdenes de trabajo:', error)
    showNotification('Error al cargar las órdenes de trabajo', 'error')
  } finally {
    isLoading.value = false
  }
}

const updateStatus = async (workOrderId, newStatus) => {
  loadingOrders.value = workOrderId
  try {
    const response = await $api(`work-orders/${workOrderId}/status`, {
      method: 'PUT',
      body: { status: newStatus },
    })

    showNotification('Estado actualizado exitosamente', 'success')

    // Actualizar el estado localmente para evitar recargar la lista y disparar el spinner global
    const index = workOrders.value.findIndex(wo => wo.id === workOrderId)
    if (index !== -1) {
      if (response && response.data) {
        Object.assign(workOrders.value[index], response.data)
      } else {
        workOrders.value[index].status = newStatus
      }
    }
  } catch (error) {
    console.error('Error al actualizar estado:', error)
    showNotification('Error al actualizar el estado', 'error')
  } finally {
    loadingOrders.value = null
  }
}

const deleteWorkOrder = workOrder => {
  workOrderToDelete.value = workOrder
  showDeleteDialog.value = true
}

const confirmDeleteWorkOrder = async () => {
  if (!workOrderToDelete.value) return

  try {
    await $api(`work-orders/${workOrderToDelete.value.id}`, {
      method: 'DELETE',
    })

    showNotification('Orden de trabajo eliminada exitosamente', 'success')
    showDeleteDialog.value = false
    workOrderToDelete.value = null
    loadWorkOrders()
  } catch (error) {
    console.error('Error al eliminar orden de trabajo:', error)
    showNotification('Error al eliminar la orden de trabajo', 'error')
  }
}

// Verifica si es un estado que permite avanzar haciendo clic en el icono
const canAdvance = workOrder => {
  return ['received', 'in_progress'].includes(workOrder.status) || (['ready', 'delivered'].includes(workOrder.status) && !workOrder.sale)
}

const handleStatusClick = workOrder => {
  openTimeline(workOrder)
}

// Obtiene el ícono dinámico basado en la venta de la orden
const getDynamicIcon = workOrder => {
  if (['ready', 'delivered'].includes(workOrder.status) && !workOrder.sale) return 'ri-shopping-cart-line'
  if (['ready', 'delivered'].includes(workOrder.status) && workOrder.sale) return 'ri-check-double-line'

  return statusIcons[workOrder.status]
}

// Obtiene la leyenda dinámica que va debajo del ícono
const getDynamicLegend = workOrder => {
  if (['ready', 'delivered'].includes(workOrder.status) && !workOrder.sale) return 'Facturar'
  if (['ready', 'delivered'].includes(workOrder.status) && workOrder.sale) return 'Facturado'

  return statusLabels[workOrder.status]
}

const goToCreate = () => {
  router.push('/work-orders/add')
}

const viewDetails = workOrder => {
  selectedWorkOrder.value = workOrder
  showDetailsDialog.value = true
}

const goToSale = workOrderId => {
  router.push({ path: '/sales/add', query: { work_order_id: workOrderId } })
}

const isWorkOrderInvoiced = workOrder => {
  return !!(workOrder?.sale && workOrder.sale.status !== 'canceled')
}

const goToEdit = (workOrderId, workOrder = null) => {
  if (workOrder && isWorkOrderInvoiced(workOrder)) {
    showNotification('Esta orden de trabajo ya ha sido facturada y no se puede editar', 'warning')
    return
  }
  router.push(`/work-orders/edit/${workOrderId}`)
}

// Estados para Vista Previa de PDF
const isPdfPreviewDialogVisible = ref(false)
const pdfPreviewUrl = ref('')
const pdfPreviewTitle = ref('')
const isPdfLoading = ref(false)
const selectedPdfWorkOrderId = ref(null)

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768
}

const getDirectPdfUrl = workOrderId => {
  const token = localStorage.getItem('token') || ''
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
  
  return `${apiBaseUrl}/work-orders/${workOrderId}/pdf?token=${token}`
}

const openPdfPreview = async workOrder => {
  if (!workOrder) return
  try {
    selectedPdfWorkOrderId.value = workOrder.id
    pdfPreviewTitle.value = `Orden de Trabajo #${workOrder.number || workOrder.id}`

    // En dispositivos móviles, abrir de forma directa e instantánea para evitar bloqueos del navegador
    if (isMobileDevice()) {
      const url = getDirectPdfUrl(workOrder.id)
      const a = document.createElement('a')

      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      return
    }

    isPdfLoading.value = true
    isPdfPreviewDialogVisible.value = true

    const token = localStorage.getItem('token')
    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')

    const response = await fetch(`${apiBaseUrl}/work-orders/${workOrder.id}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
      },
    })

    if (response.ok) {
      const blob = await response.blob()
      if (pdfPreviewUrl.value) {
        window.URL.revokeObjectURL(pdfPreviewUrl.value)
      }
      pdfPreviewUrl.value = window.URL.createObjectURL(blob)
    } else {
      showNotification('Error al cargar la previsualización del PDF', 'error')
    }
  } catch (error) {
    console.error('Error al cargar PDF:', error)
    showNotification('Error al cargar la previsualización del PDF', 'error')
  } finally {
    isPdfLoading.value = false
  }
}

const closePdfPreview = () => {
  isPdfPreviewDialogVisible.value = false
  if (pdfPreviewUrl.value) {
    window.URL.revokeObjectURL(pdfPreviewUrl.value)
    pdfPreviewUrl.value = ''
  }
}

const openPdfInNewTab = () => {
  if (!selectedPdfWorkOrderId.value) return
  const url = getDirectPdfUrl(selectedPdfWorkOrderId.value)
  const a = document.createElement('a')

  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const downloadPDF = async workOrderParam => {
  try {
    const workOrder = typeof workOrderParam === 'object' ? workOrderParam : workOrders.value.find(w => w.id === workOrderParam)
    const workOrderId = typeof workOrderParam === 'object' ? workOrderParam.id : workOrderParam

    const token = localStorage.getItem('token')
    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')

    const response = await fetch(`${apiBaseUrl}/work-orders/${workOrderId}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
      },
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      const rawClient = workOrder?.client?.full_name || getClientName(workOrder?.client) || 'Cliente'
      const clientName = rawClient
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').toUpperCase()
      const plate = (workOrder?.vehicle?.license_plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const docNumber = (workOrder?.number || workOrderId || 'OT').toString().replace(/[^a-zA-Z0-9\-_]/g, '')
      const parts = ['Orden_Trabajo', docNumber, clientName]
      if (plate) parts.push(plate)
      const fileName = parts.join('_') + '.pdf'

      const a = document.createElement('a')

      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showNotification('PDF descargado exitosamente', 'success')
    } else {
      showNotification('Error al descargar el PDF', 'error')
    }
  } catch (error) {
    console.error('Error al descargar PDF:', error)
    showNotification('Error al descargar el PDF', 'error')
  }
}

const printPDF = workOrderId => {
  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
    const pdfUrl = `${apiBaseUrl}/work-orders/${workOrderId}/pdf?token=${token}&print=true`

    const printWindow = window.open(pdfUrl, '_blank')
    if (printWindow) {
      printWindow.focus()
      showNotification('Previsualización de impresión cargada', 'info')
    } else {
      showNotification('Permite las ventanas emergentes para abrir el PDF', 'warning')
    }
  } catch (error) {
    console.error('Error al imprimir:', error)
    showNotification('Error al abrir la previsualización de la orden', 'error')
  }
}

const printDirectlyFromServer = async (id, type) => {
  try {
    const endpoint = type === 'sale' ? `sales/${id}/print` : `work-orders/${id}/print`
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


const getClientName = client => {
  if (!client) return 'N/A'

  return client.full_name || `${client.name || ''} ${client.surname || ''}`.trim() || 'N/A'
}

const getVehicleInfo = vehicle => {
  if (!vehicle) return 'N/A'
  const brandName = vehicle.brand ? getBrandNameById(vehicle.brand) : ''

  return `${brandName} ${vehicle.model || ''} - ${vehicle.license_plate || ''}`.trim() || 'N/A'
}

const getTotalAmount = workOrder => {
  if (!workOrder.items || !Array.isArray(workOrder.items)) return 0

  return workOrder.items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0)
}

onMounted(() => {
  loadWorkOrders()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 work-orders-management-page">
    <!-- Header y Filtros Fijos (Sticky Top) -->
    <div class="sticky-page-header-wrapper">
      <!-- Encabezado de la página -->
      <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-4 gap-4">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
            <VIcon
              icon="ri-draft-line"
              color="primary"
              class="me-2"
              size="28"
            />
            Órdenes de Trabajo
          </h1>
          <p class="text-medium-emphasis mb-0">
            Gestiona y da seguimiento a las órdenes de trabajo del taller
          </p>
        </div>
        <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
          <VBtn
            v-if="can('register_sale')"
            color="primary"
            prepend-icon="ri-add-line"
            to="/work-orders/add"
          >
            Nueva Orden
          </VBtn>
        </div>
      </div>

      <!-- Filtros y Búsqueda -->
      <VCard class="rounded-lg border-light border elevation-0 sticky-filter-card">
        <VCardText class="pa-4 bg-grey-lighten-5">
          <VForm @submit.prevent="loadWorkOrders">
            <VRow class="align-center">
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="searchQuery"
                  label="Buscar orden"
                  placeholder="Número, cliente o placa del vehículo..."
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  clearable
                  color="primary"
                  :loading="isLoading || isSearching"
                >
                  <template #prepend-inner>
                    <VProgressCircular v-if="isLoading || isSearching" indeterminate color="primary" size="18" width="2" class="me-1" />
                    <VIcon v-else icon="ri-search-line" />
                  </template>
                </VTextField>
              </VCol>

              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <VSelect
                  v-model="statusFilter"
                  :items="statusOptions"
                  item-title="title"
                  item-value="value"
                  label="Estado"
                  placeholder="Todos"
                  prepend-inner-icon="ri-filter-3-line"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  clearable
                  color="primary"
                />
              </VCol>

              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <VBtn
                  color="primary"
                  variant="tonal"
                  prepend-icon="ri-refresh-line"
                  block
                  @click="loadWorkOrders"
                >
                  Actualizar
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </div>

    <!-- Contenedor Principal (Tabla/Tarjetas) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Listado de Órdenes de Trabajo (Tarjetas Agrupadas por Día) -->
      <div class="position-relative bg-white rounded-xl border-light overflow-hidden">
        <VProgressLinear
          v-if="isLoading"
          indeterminate
          color="primary"
          height="3"
          class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;"
        />

        <!-- Shimmer Skeleton Grid -->
        <div
          v-if="isLoading"
          class="pa-5"
        >
          <div class="mb-6">
            <!-- Cabecera Shimmer -->
            <div class="d-flex align-center my-4">
              <div
                class="shimmer-circle me-2"
                style="width: 20px; height: 20px;"
              />
              <div class="shimmer-line w-25" />
              <VDivider class="ms-3" />
            </div>

            <!-- Grid de Tarjetas Shimmer -->
            <VRow>
              <VCol
                v-for="n in 6"
                :key="n"
                cols="12"
                sm="6"
                md="4"
                class="d-flex"
              >
                <VCard
                  class="w-100 rounded-lg border-light border overflow-hidden d-flex flex-column pa-4"
                  style="height: 230px;"
                >
                  <div class="d-flex justify-space-between align-center mb-3">
                    <div class="shimmer-line w-40" />
                    <div class="shimmer-chip" />
                  </div>
                  <VDivider class="mb-3" />
                  <div class="shimmer-line w-75 mb-2" />
                  <div class="shimmer-line w-60 mb-2" />
                  <div class="shimmer-line w-50 mb-4" />
                  <VSpacer />
                  <div class="d-flex gap-2">
                    <div
                      class="shimmer-button w-50"
                      style="height: 36px;"
                    />
                    <div
                      class="shimmer-button w-50"
                      style="height: 36px;"
                    />
                  </div>
                </VCard>
              </VCol>
            </VRow>
          </div>
        </div>

        <div
          v-else-if="!filteredWorkOrders || filteredWorkOrders.length === 0"
          class="text-center pa-12 text-medium-emphasis"
        >
          <VIcon
            size="48"
            class="mb-3"
            color="grey-lighten-1"
          >
            ri-file-text-line
          </VIcon>
          <div class="text-h6">
            No se encontraron órdenes de trabajo
          </div>
          <div class="text-body-2">
            Intenta ajustar los filtros de búsqueda
          </div>
        </div>

        <div
          v-else
          class="pa-5"
        >
          <div
            v-for="date in Object.keys(groupedWorkOrders)"
            :key="date"
            class="mb-6"
          >
            <!-- Cabecera de Grupo por Día -->
            <div class="date-group-header d-flex align-center my-4">
              <VIcon
                icon="ri-calendar-event-line"
                color="primary"
                class="me-2"
                size="20"
              />
              <span class="text-subtitle-1 font-weight-bold text-grey-darken-3 text-capitalize">
                {{ formatDateGroup(date) }}
              </span>
              <VDivider class="ms-3" />
            </div>

            <!-- Tarjetas del Día -->
            <VRow>
              <VCol
                v-for="workOrder in groupedWorkOrders[date]"
                :key="workOrder.id"
                cols="12"
                sm="6"
                md="4"
                class="d-flex"
              >
                <VCard class="w-100 rounded-lg border-light border overflow-hidden elevation-1 hover-shadow transition-all d-flex flex-column">
                  <!-- Cabecera de la Tarjeta -->
                  <VCardText class="pa-3 bg-grey-lighten-5 border-bottom-light d-flex justify-space-between align-center flex-wrap gap-2">
                    <div class="d-flex align-center gap-2">
                      <span
                        class="text-subtitle-2 font-weight-bold text-primary cursor-pointer hover-underline"
                        @click="workOrder.status !== 'draft' ? viewDetails(workOrder) : null"
                      >
                        {{ workOrder.number }}
                      </span>
                      <span class="text-caption text-medium-emphasis">
                        {{ workOrder.created_at ? parseDateLocal(workOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A' }}
                      </span>
                    </div>

                    <!-- Estado Interactivo -->
                    <div
                      class="cursor-pointer d-flex align-center"
                      style="user-select: none;"
                      @click="workOrder.status !== 'draft' ? handleStatusClick(workOrder) : null"
                    >
                      <VChip
                        :color="statusColors[workOrder.status]"
                        variant="tonal"
                        size="small"
                        class="font-weight-bold"
                        label
                      >
                        <VProgressCircular
                          v-if="loadingOrders === workOrder.id"
                          indeterminate
                          size="14"
                          width="2"
                          class="me-1"
                        />
                        <VIcon
                          v-else
                          :icon="getDynamicIcon(workOrder)"
                          size="14"
                          class="me-1"
                        />
                        {{ getDynamicLegend(workOrder) }}
                      </VChip>
                    </div>
                  </VCardText>

                  <!-- Cuerpo de la Tarjeta -->
                  <VCardText class="pa-3 flex-grow-1">
                    <div class="d-flex flex-column gap-2">
                      <!-- Cliente -->
                      <div class="d-flex align-start gap-2">
                        <VAvatar
                          color="info"
                          variant="tonal"
                          size="28"
                          class="mt-0"
                        >
                          <VIcon
                            icon="ri-user-line"
                            size="15"
                          />
                        </VAvatar>
                        <div class="overflow-hidden w-100">
                          <div
                            class="text-caption text-medium-emphasis text-uppercase font-weight-bold"
                            style="font-size: 0.65rem; letter-spacing: 0.5px;"
                          >
                            Cliente
                          </div>
                          <div
                            class="text-body-2 font-weight-semibold text-grey-darken-4 text-truncate"
                            :title="getClientName(workOrder.client)"
                          >
                            {{ getClientName(workOrder.client) }}
                          </div>
                          <div
                            v-if="workOrder.client?.n_document"
                            class="text-caption text-medium-emphasis"
                          >
                            Doc: {{ workOrder.client.n_document }}
                          </div>
                        </div>
                      </div>

                      <!-- Vehículo -->
                      <div
                        v-if="workOrder.vehicle"
                        class="d-flex align-start gap-2"
                      >
                        <VAvatar
                          color="primary"
                          variant="tonal"
                          size="28"
                          class="mt-0"
                        >
                          <VIcon
                            icon="ri-car-line"
                            size="15"
                          />
                        </VAvatar>
                        <div class="overflow-hidden w-100">
                          <div
                            class="text-caption text-medium-emphasis text-uppercase font-weight-bold"
                            style="font-size: 0.65rem; letter-spacing: 0.5px;"
                          >
                            Vehículo
                          </div>
                          <div class="text-body-2 font-weight-bold text-primary text-truncate">
                            {{ workOrder.vehicle.license_plate }}
                          </div>
                          <div
                            class="text-caption text-medium-emphasis text-truncate"
                            :title="getVehicleInfo(workOrder.vehicle)"
                          >
                            {{ getVehicleInfo(workOrder.vehicle) }}
                          </div>
                        </div>
                      </div>

                      <!-- Total -->
                      <div class="d-flex align-start gap-2">
                        <VAvatar
                          color="success"
                          variant="tonal"
                          size="28"
                          class="mt-0"
                        >
                          <VIcon
                            icon="ri-money-dollar-circle-line"
                            size="15"
                          />
                        </VAvatar>
                        <div>
                          <div
                            class="text-caption text-medium-emphasis text-uppercase font-weight-bold"
                            style="font-size: 0.65rem; letter-spacing: 0.5px;"
                          >
                            Total
                          </div>
                          <div class="text-subtitle-1 font-weight-bold text-success">
                            ${{ getTotalAmount(workOrder).toFixed(2) }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </VCardText>

                  <VDivider />

                  <!-- Acciones -->
                  <VCardActions
                    class="pa-2 justify-end bg-grey-lighten-5 mt-auto"
                    style="position: sticky; bottom: 0; z-index: 2;"
                  >
                    <VBtn
                      v-if="workOrder.status !== 'draft'"
                      variant="text"
                      color="info"
                      prepend-icon="ri-eye-line"
                      size="small"
                      class="text-none font-weight-bold action-btn"
                      @click="viewDetails(workOrder)"
                    >
                      Detalle
                    </VBtn>

                    <!-- Botón Editar / Facturada Bloqueado -->
                    <VTooltip
                      v-if="isWorkOrderInvoiced(workOrder)"
                      text="Esta orden ya fue facturada y no se puede editar"
                      location="top"
                    >
                      <template #activator="{ props: tooltipProps }">
                        <span
                          v-bind="tooltipProps"
                          class="d-inline-block"
                        >
                          <VBtn
                            variant="tonal"
                            color="secondary"
                            prepend-icon="ri-lock-line"
                            size="small"
                            disabled
                            class="text-none font-weight-bold action-btn opacity-60"
                          >
                            Facturada
                          </VBtn>
                        </span>
                      </template>
                    </VTooltip>

                    <VBtn
                      v-else-if="can('edit_sale')"
                      variant="text"
                      color="warning"
                      prepend-icon="ri-edit-line"
                      size="small"
                      class="text-none font-weight-bold action-btn"
                      @click="goToEdit(workOrder.id, workOrder)"
                    >
                      Editar
                    </VBtn>

                    <!-- Menú desplegable -->
                    <VBtn
                      v-if="workOrder.status !== 'draft'"
                      variant="text"
                      color="secondary"
                      prepend-icon="ri-more-2-line"
                      size="small"
                      class="text-none font-weight-bold action-btn"
                    >
                      Más
                      <VMenu
                        activator="parent"
                        transition="slide-y-transition"
                        align="end"
                        location="bottom end"
                      >
                        <VList
                          density="compact"
                          class="py-1 rounded elevation-3 border"
                        >
                          <VListItem
                            prepend-icon="ri-file-pdf-line"
                            title="Ver PDF"
                            class="text-primary text-body-2"
                            @click="openPdfPreview(workOrder)"
                          />
                          <VListItem
                            prepend-icon="ri-printer-line"
                            title="Imprimir Orden"
                            class="text-info text-body-2"
                            @click="printPDF(workOrder.id)"
                          />
                          <VListItem
                            prepend-icon="ri-download-2-line"
                            title="Descargar PDF"
                            class="text-secondary text-body-2"
                            @click="downloadPDF(workOrder.id)"
                          />
                          <VListItem
                            prepend-icon="ri-attachment-2"
                            title="Comprobantes / Soportes"
                            class="text-primary text-body-2 font-weight-medium"
                            @click="openReceiptsDialog(workOrder)"
                          />
                          <VDivider class="my-1" />
                          <VListItem
                            prepend-icon="ri-time-line"
                            title="Ver Secuencia"
                            class="text-secondary text-body-2"
                            @click="openTimeline(workOrder)"
                          />
                          <VListItem
                            v-if="['ready', 'delivered'].includes(workOrder.status) && !workOrder.sale"
                            prepend-icon="ri-shopping-cart-line"
                            title="Generar Venta"
                            class="text-success text-body-2 font-weight-semibold"
                            @click="goToSale(workOrder.id)"
                          />
                          <VListItem
                            v-if="workOrder.status !== 'delivered' && workOrder.status !== 'draft'"
                            prepend-icon="ri-truck-line"
                            title="Marcar como Entregado"
                            class="text-primary text-body-2"
                            @click="updateStatus(workOrder.id, 'delivered')"
                          />
                          <VDivider
                            v-if="can('delete_sale')"
                            class="my-1"
                          />
                          <VListItem
                            v-if="can('delete_sale')"
                            prepend-icon="ri-delete-bin-line"
                            title="Eliminar Orden"
                            class="text-error text-body-2"
                            @click="deleteWorkOrder(workOrder)"
                          />
                        </VList>
                      </VMenu>
                    </VBtn>
                  </VCardActions>
                </VCard>
              </VCol>
            </VRow>
          </div>
        </div>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ paginatedWorkOrders.length }}</span> de <span class="font-weight-bold">{{ filteredWorkOrders.length }}</span> registros
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

    <!-- Details Dialog -->
    <VDialog
      v-model="showDetailsDialog"
      scrollable
      max-width="800"
    >
      <VCard
        v-if="selectedWorkOrder"
        class="custom-dialog-card"
      >
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="showDetailsDialog = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-file-list-3-line" />
          </div>
          <h3 class="custom-dialog-title">
            Detalles de Orden #{{ selectedWorkOrder.number }}
          </h3>
          <p class="custom-dialog-subtitle">
            Información completa de servicios, repuestos y montos
          </p>
        </div>
        <VCardText class="pa-4">
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon
                  icon="ri-user-line"
                  size="18"
                />
                <span class="text-body-2">Cliente</span>
              </div>
              <p class="text-body-1 font-weight-medium">
                {{ getClientName(selectedWorkOrder.client) }}
              </p>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon
                  icon="ri-car-line"
                  size="18"
                />
                <span class="text-body-2">Vehículo</span>
              </div>
              <p class="text-body-1 font-weight-medium">
                {{ getVehicleInfo(selectedWorkOrder.vehicle) }}
              </p>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon
                  icon="ri-dashboard-3-line"
                  size="18"
                />
                <span class="text-body-2">Kilometraje</span>
              </div>
              <p class="text-body-1 font-weight-medium">
                {{ selectedWorkOrder.mileage || 'N/A' }} km
              </p>
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon
                  icon="ri-information-line"
                  size="18"
                />
                <span class="text-body-2">Estado</span>
              </div>
              <VChip
                :color="statusColors[selectedWorkOrder.status]"
                size="small"
                label
              >
                <VIcon
                  start
                  :icon="statusIcons[selectedWorkOrder.status]"
                  size="14"
                />
                {{ statusLabels[selectedWorkOrder.status] }}
              </VChip>
            </VCol>
          </VRow>

          <VDivider class="my-4" />

          <div class="d-flex align-center gap-2 mb-3">
            <VIcon
              icon="ri-list-check"
              size="24"
            />
            <span class="text-h6 font-weight-bold">Items</span>
          </div>
          <div
            v-if="selectedWorkOrder.items && selectedWorkOrder.items.length > 0"
            class="work-order-items-table-wrap"
          >
            <VTable class="work-order-items-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th>Precio Unit.</th>
                  <th>Descuento</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in selectedWorkOrder.items"
                  :key="item.id"
                >
                  <td>{{ item.description }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>${{ parseFloat(item.unit_price).toFixed(2) }}</td>
                  <td>${{ parseFloat(item.discount).toFixed(2) }}</td>
                  <td>${{ parseFloat(item.subtotal).toFixed(2) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colspan="4"
                    class="text-right font-weight-bold"
                  >
                    Total:
                  </td>
                  <td class="font-weight-bold">
                    ${{ getTotalAmount(selectedWorkOrder).toFixed(2) }}
                  </td>
                </tr>
              </tfoot>
            </VTable>
          </div>
          <p
            v-else
            class="text-body-2 text-grey"
          >
            No hay items en esta orden
          </p>
        </VCardText>
        <VDivider />
        <VCardActions
          class="pa-4 bg-white d-flex justify-end align-center gap-3 flex-wrap"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            v-if="['ready', 'delivered'].includes(selectedWorkOrder.status) && !selectedWorkOrder.sale"
            color="success"
            variant="elevated"
            prepend-icon="ri-shopping-cart-line"
            class="rounded-lg px-6 font-weight-bold"
            height="40"
            @click="goToSale(selectedWorkOrder.id)"
          >
            Generar Venta
          </VBtn>
          <VBtn
            v-if="selectedWorkOrder.status !== 'draft'"
            color="primary"
            variant="elevated"
            prepend-icon="ri-file-pdf-line"
            class="rounded-lg px-5 font-weight-bold"
            height="40"
            @click="openPdfPreview(selectedWorkOrder)"
          >
            Ver PDF
          </VBtn>
          <VBtn
            v-if="selectedWorkOrder.status !== 'draft'"
            color="secondary"
            variant="outlined"
            prepend-icon="ri-download-2-line"
            class="rounded-lg px-4 font-weight-medium"
            height="40"
            @click="downloadPDF(selectedWorkOrder.id)"
          >
            Descargar PDF
          </VBtn>
          <VBtn
            v-if="selectedWorkOrder.status !== 'draft'"
            color="info"
            variant="tonal"
            prepend-icon="ri-printer-line"
            class="rounded-lg px-4 font-weight-medium"
            height="40"
            @click="printPDF(selectedWorkOrder.id)"
          >
            Imprimir
          </VBtn>
          <VBtn
            color="secondary"
            variant="outlined"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="showDetailsDialog = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- PDF Preview Dialog -->
    <VDialog
      v-model="isPdfPreviewDialogVisible"
      scrollable
      max-width="950"
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="closePdfPreview"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-file-pdf-line" />
          </div>
          <h3 class="custom-dialog-title">
            {{ pdfPreviewTitle }}
          </h3>
          <p class="custom-dialog-subtitle">
            Previsualización del documento de la orden de trabajo
          </p>
        </div>

        <!-- Banner para Móviles -->
        <div
          v-if="isMobileDevice()"
          class="pa-3 bg-indigo-lighten-5 border-b d-flex align-center justify-space-between flex-wrap gap-2"
        >
          <div class="d-flex align-center gap-2">
            <VIcon
              icon="ri-smartphone-line"
              color="primary"
              size="20"
            />
            <span class="text-caption font-weight-medium text-grey-darken-3">
              ¿Problemas para visualizar en tu teléfono?
            </span>
          </div>
          <VBtn
            color="primary"
            variant="elevated"
            size="small"
            prepend-icon="ri-external-link-line"
            class="text-none font-weight-bold"
            @click="openPdfInNewTab"
          >
            Abrir PDF en Pantalla Completa
          </VBtn>
        </div>

        <VCardText
          class="pa-0 d-flex flex-column align-center justify-center bg-grey-lighten-4"
          style="min-height: 550px; height: 75vh;"
        >
          <div
            v-if="isPdfLoading"
            class="text-center pa-8"
          >
            <VProgressCircular
              indeterminate
              color="primary"
              size="50"
              class="mb-3"
            />
            <p class="text-body-1 font-weight-medium text-grey-darken-2">
              Generando y cargando documento PDF...
            </p>
          </div>
          <iframe
            v-else-if="pdfPreviewUrl"
            :src="pdfPreviewUrl"
            class="w-100 h-100"
            style="border: none; min-height: 550px;"
          />
          <div
            v-else
            class="text-center pa-8 text-error"
          >
            <VIcon
              icon="ri-error-warning-line"
              size="48"
              class="mb-2"
            />
            <p class="text-body-1">
              No se pudo cargar la vista previa del PDF.
            </p>
            <VBtn
              color="primary"
              variant="tonal"
              prepend-icon="ri-external-link-line"
              class="mt-3"
              @click="openPdfInNewTab"
            >
              Intentar abrir en nueva pestaña
            </VBtn>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions
          class="pa-4 d-flex justify-end align-center flex-wrap gap-2 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-4 font-weight-medium"
            height="40"
            @click="closePdfPreview"
          >
            Cerrar
          </VBtn>

          <VBtn
            color="info"
            variant="tonal"
            prepend-icon="ri-external-link-line"
            class="rounded-lg px-4 font-weight-medium"
            height="40"
            @click="openPdfInNewTab"
          >
            Abrir en Pestaña
          </VBtn>

          <VBtn
            color="info"
            variant="tonal"
            prepend-icon="ri-printer-line"
            class="rounded-lg px-4 font-weight-medium"
            height="40"
            @click="printPDF(selectedPdfWorkOrderId)"
          >
            Imprimir
          </VBtn>

          <VBtn
            color="primary"
            variant="elevated"
            prepend-icon="ri-download-2-line"
            class="rounded-lg px-5 font-weight-medium"
            height="40"
            @click="downloadPDF(selectedPdfWorkOrderId)"
          >
            Descargar PDF
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Delete Confirmation Dialog -->
    <VDialog
      v-model="showDeleteDialog"
      scrollable
      max-width="500"
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="showDeleteDialog = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-delete-bin-line" />
          </div>
          <h3 class="custom-dialog-title">
            Confirmar Eliminación
          </h3>
          <p class="custom-dialog-subtitle">
            Esta acción removerá la orden de trabajo del sistema
          </p>
        </div>
        <VCardText class="pa-4">
          <p class="text-body-1">
            ¿Estás seguro de eliminar la orden de trabajo <strong>#{{ workOrderToDelete?.number }}</strong>?
          </p>
          <p class="text-body-2 text-grey-darken-1 mt-2 mb-0">
            Esta acción no se puede deshacer.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions
          class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            color="secondary"
            variant="outlined"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="showDeleteDialog = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            prepend-icon="ri-delete-bin-line"
            class="rounded-lg px-6 font-weight-bold"
            height="40"
            @click="confirmDeleteWorkOrder"
          >
            Eliminar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal de Secuencia / Timeline -->
    <WorkOrderTimelineDialog
      :is-open="showTimelineDialog"
      :order="selectedTimelineOrder"
      :is-updating="loadingOrders === selectedTimelineOrder?.id"
      @close="showTimelineDialog = false"
      @change-status="(newStatus) => updateStatus(selectedTimelineOrder?.id, newStatus)"
      @generate-sale="() => goToSale(selectedTimelineOrder?.id)"
    />

    <!-- Modal Universal de Comprobantes y Soportes -->
    <AttachReceiptsDialog
      v-if="selectedReceiptsOrder"
      v-model:isDialogVisible="isReceiptsDialogVisible"
      attachable-type="work_order"
      :attachable-id="selectedReceiptsOrder.id"
      :identifier="selectedReceiptsOrder.number"
      :party-name="selectedReceiptsOrder.client?.full_name || selectedReceiptsOrder.client?.name || ''"
      title="Comprobantes de Pago / Soportes de Orden de Trabajo"
      @updated="loadWorkOrders"
    />
  </div>
</template>
