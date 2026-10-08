<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRouter, useRoute } from 'vue-router'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getBrandNameById } from '@/data/vehicleBrands'
import WorkOrderTimelineDialog from '@/components/dialogs/WorkOrderTimelineDialog.vue'
import WorkOrderAdvanceDialog from '@/components/dialogs/WorkOrderAdvanceDialog.vue'
import AttachReceiptsDialog from '@/components/common/AttachReceiptsDialog.vue'
import { useLoaderStore } from '@/stores/loader'
import { usePermissions } from '@/composables/usePermissions'

const router = useRouter()
const route = useRoute()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()
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

// Abonos / Anticipos
const showAdvanceDialog = ref(false)
const selectedAdvanceOrder = ref(null)

const openAdvanceDialog = workOrder => {
  selectedAdvanceOrder.value = workOrder
  showAdvanceDialog.value = true
}

const handleAdvanceUpdated = () => {
  loadWorkOrders()
}

const getWorkOrderAdvances = item => {
  if (!item) return 0
  if (item.total_advances !== undefined && item.total_advances !== null) {
    return parseFloat(item.total_advances) || 0
  }
  if (Array.isArray(item.advances)) {
    return item.advances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
  }
  
  return 0
}

const isLoading = ref(false)
const workOrders = ref([])
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const isSearching = ref(false)
const statusFilter = ref('all')
const startDate = ref(null)
const endDate = ref(null)
const selectedWorkOrder = ref(null)
const showDetailsDialog = ref(false)
const loadingOrders = ref(null)
const showDeleteDialog = ref(false)
const workOrderToDelete = ref(null)
const isDeleting = ref(false)

const currentPage = ref(1)
const itemsPerPage = ref(10)

const statusOptions = [
  { title: 'Todos los estados', value: 'all' },
  { title: 'Activas / En Taller', value: 'active' },
  { title: 'Borrador', value: 'draft' },
  { title: 'Recibido', value: 'received' },
  { title: 'En Progreso', value: 'in_progress' },
  { title: 'Listo para entrega', value: 'ready' },
  { title: 'Entregado', value: 'delivered' },
]

const statusColors = {
  active: 'warning',
  draft: 'secondary',
  received: 'info',
  in_progress: 'warning',
  ready: 'success',
  delivered: 'default',
}

const statusIcons = {
  active: 'ri-tools-line',
  draft: 'ri-draft-line',
  received: 'ri-file-list-3-line',
  in_progress: 'ri-tools-line',
  ready: 'ri-checkbox-circle-fill',
  delivered: 'ri-truck-line',
}

const statusLabels = {
  active: 'Activa',
  draft: 'Borrador',
  received: 'Recibido',
  in_progress: 'En Progreso',
  ready: 'Listo',
  delivered: 'Entregado',
}

const filteredWorkOrders = computed(() => {
  let filtered = workOrders.value

  if (statusFilter.value === 'active') {
    filtered = filtered.filter(wo => ['received', 'in_progress', 'ready'].includes(wo.status))
  } else if (statusFilter.value !== 'all') {
    filtered = filtered.filter(wo => wo.status === statusFilter.value)
  }

  if (startDate.value) {
    filtered = filtered.filter(wo => {
      const d = (wo.date || wo.created_at || '').split('T')[0].split(' ')[0]
      
      return d >= startDate.value
    })
  }

  if (endDate.value) {
    filtered = filtered.filter(wo => {
      const d = (wo.date || wo.created_at || '').split('T')[0].split(' ')[0]
      
      return d <= endDate.value
    })
  }

  if (debouncedSearchQuery.value) {
    const query = debouncedSearchQuery.value.toLowerCase()
    const cleanQuery = query.replace(/[^a-z0-9]/g, '')

    filtered = filtered.filter(wo => {
      const cleanNumber = wo.number?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
      const formattedNumber = formatWorkOrderNumber(wo.number).toLowerCase()
      const cleanClientName = wo.client?.full_name?.toLowerCase() || ''
      const cleanClientDoc = wo.client?.n_document?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
      const cleanLicensePlate = wo.vehicle?.license_plate?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

      return cleanNumber.includes(cleanQuery) ||
        formattedNumber.includes(query) ||
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

const readyWorkOrdersCount = computed(() => {
  return workOrders.value.filter(wo => wo.status === 'ready').length
})

const isPendingFinish = workOrder => {
  return workOrder?.status === 'ready'
}

const hasActiveFilters = computed(() => {
  return !!(
    (searchQuery.value && searchQuery.value.trim()) ||
    (statusFilter.value && statusFilter.value !== 'all') ||
    startDate.value ||
    endDate.value
  )
})

const resetFilters = () => {
  searchQuery.value = ''
  debouncedSearchQuery.value = ''
  statusFilter.value = 'all'
  startDate.value = null
  endDate.value = null
  currentPage.value = 1
}

const paginatedWorkOrders = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  
  return filteredWorkOrders.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredWorkOrders.value.length / itemsPerPage.value) || 1
})

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

    const index = workOrders.value.findIndex(wo => wo.id === workOrderId)
    if (index !== -1) {
      if (response && response.data) {
        Object.assign(workOrders.value[index], response.data)
      } else {
        workOrders.value[index].status = newStatus
      }
    }

    if (selectedTimelineOrder.value && selectedTimelineOrder.value.id === workOrderId) {
      if (response && response.data) {
        Object.assign(selectedTimelineOrder.value, response.data)
      } else {
        selectedTimelineOrder.value.status = newStatus
      }
    }
  } catch (error) {
    console.error('Error al actualizar estado:', error)
    showNotification('Error al actualizar el estado', 'error')
  } finally {
    loadingOrders.value = null
  }
}

const hasSriAuthorizedInvoice = workOrder => {
  if (!workOrder) return false
  const sale = workOrder.sale
  if (!sale) return false
  
  return sale.document_type === 'invoice' && ['AUTORIZADA', 'AUTORIZADO'].includes(sale.sri_status)
}

const deleteWorkOrder = workOrder => {
  if (hasSriAuthorizedInvoice(workOrder)) {
    showNotification('No se puede eliminar la orden de trabajo porque tiene una factura autorizada por el SRI.', 'error')
    
    return
  }
  workOrderToDelete.value = workOrder
  showDeleteDialog.value = true
}

const confirmDeleteWorkOrder = async () => {
  if (!workOrderToDelete.value) return

  if (hasSriAuthorizedInvoice(workOrderToDelete.value)) {
    showNotification('No se puede eliminar una orden de trabajo con factura autorizada por el SRI', 'error')
    showDeleteDialog.value = false
    
    return
  }

  isDeleting.value = true
  try {
    await $api(`work-orders/${workOrderToDelete.value.id}`, {
      method: 'DELETE',
      onResponseError({ response }) {
        const errorMsg = response?._data?.message || 'Error al eliminar la orden de trabajo'

        showNotification(errorMsg, 'error')
      },
    })

    showNotification('Orden de trabajo eliminada exitosamente', 'success')
    showDeleteDialog.value = false
    workOrderToDelete.value = null
    loadWorkOrders()
  } catch (error) {
    console.error('Error al eliminar orden de trabajo:', error)
  } finally {
    isDeleting.value = false
  }
}

const handleStatusClick = workOrder => {
  openTimeline(workOrder)
}

const isWorkOrderInvoiced = workOrder => {
  return !!(workOrder?.sale && workOrder.sale.document_type !== 'quote' && workOrder.sale.status !== 'canceled')
}

const getDynamicIcon = workOrder => {
  if (['ready', 'delivered'].includes(workOrder.status) && !isWorkOrderInvoiced(workOrder)) return 'ri-shopping-cart-line'
  if (['ready', 'delivered'].includes(workOrder.status) && isWorkOrderInvoiced(workOrder)) return 'ri-check-double-line'

  return statusIcons[workOrder.status] || 'ri-tools-line'
}

const getDynamicLegend = workOrder => {
  if (['ready', 'delivered'].includes(workOrder.status) && !isWorkOrderInvoiced(workOrder)) return 'Facturar'
  if (['ready', 'delivered'].includes(workOrder.status) && isWorkOrderInvoiced(workOrder)) return 'Facturado'

  return statusLabels[workOrder.status] || workOrder.status
}

const getStatusPillClass = workOrder => {
  if (['ready', 'delivered'].includes(workOrder.status) && isWorkOrderInvoiced(workOrder)) {
    return 'status-paid'
  }
  if (['ready', 'delivered'].includes(workOrder.status) && !isWorkOrderInvoiced(workOrder)) {
    return 'status-partial'
  }

  switch (workOrder.status) {
  case 'ready':
    return 'status-paid'
  case 'in_progress':
    return 'status-partial'
  case 'received':
    return 'status-transfer'
  case 'delivered':
    return 'status-paid'
  case 'draft':
  default:
    return 'status-canceled'
  }
}

const viewDetails = workOrder => {
  selectedWorkOrder.value = workOrder
  showDetailsDialog.value = true
}

const goToSale = workOrderId => {
  router.push({ path: '/sales/add', query: { work_order_id: workOrderId } })
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

const openPdfPreview = workOrder => {
  try {
    isPdfLoading.value = true

    const token = localStorage.getItem('token')
    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
    
    pdfPreviewUrl.value = `${apiBaseUrl}/work-orders/${workOrder.id}/pdf?token=${token}`
    pdfPreviewTitle.value = `Orden de Trabajo #${workOrder.number || workOrder.id}`
    isPdfPreviewDialogVisible.value = true
  } catch (error) {
    console.error('Error al abrir previsualización de PDF:', error)
    showNotification('Error al generar la previsualización del PDF', 'error')
  } finally {
    isPdfLoading.value = false
  }
}

const downloadPDF = async workOrderId => {
  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
    const workOrder = workOrders.value.find(wo => wo.id === workOrderId)

    const response = await fetch(`${apiBaseUrl}/work-orders/${workOrderId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
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

const getClientName = client => {
  if (!client) return 'N/A'
  
  return client.full_name || `${client.name || ''} ${client.surname || ''}`.trim() || 'N/A'
}

const getClientInitials = client => {
  const name = getClientName(client)
  if (!name || name === 'N/A') return 'CL'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  
  return name.slice(0, 2).toUpperCase()
}

const getVehicleInfo = vehicle => {
  if (!vehicle) return 'N/A'
  const brandVal = vehicle.brand?.name || vehicle.brand || vehicle.brand_id
  const brandName = brandVal ? (getBrandNameById(brandVal) || brandVal) : ''
  const model = (vehicle.model || '').trim()
  const year = vehicle.year ? String(vehicle.year).trim() : ''
  const hasYearInModel = year && model.includes(year)
  const details = hasYearInModel ? model : [model, year].filter(Boolean).join(' ')

  return `${brandName} ${details}`.trim() || 'Vehículo sin modelo'
}

const getTotalAmount = workOrder => {
  if (!workOrder.items || !Array.isArray(workOrder.items)) return 0
  
  return workOrder.items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0)
}

const formatDate = dateString => {
  if (!dateString) return '-'
  const clean = String(dateString).split('T')[0].split(' ')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    
    return `${year}/${month}/${day}`
  }
  const date = new Date(dateString)
  if (!isNaN(date.getTime())) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    
    return `${y}/${m}/${d}`
  }
  
  return dateString
}

// Formateador estándar de numeración
const formatWorkOrderNumber = (num, fallbackId = null) => {
  if (num && String(num).trim()) {
    const s = String(num).trim()
    if (s.startsWith('#')) return s
    if (s.includes('-')) return s
    if (/^\d+$/.test(s)) return '#' + s
    
    return s
  }
  if (fallbackId) {
    return '#' + String(fallbackId).padStart(6, '0')
  }
  
  return '-'
}

onMounted(() => {
  if (route.query.search) {
    searchQuery.value = String(route.query.search)
    debouncedSearchQuery.value = String(route.query.search)
  }
  loadWorkOrders()
})

watch(() => route.query.search, newSearch => {
  if (newSearch) {
    searchQuery.value = String(newSearch)
    debouncedSearchQuery.value = String(newSearch)
  }
})
</script>

<template>
  <div class="pa-4 pa-sm-6 work-orders-management-page">
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
              icon="ri-tools-line"
              size="26"
            />
          </VAvatar>
          Órdenes de Trabajo
        </h1>
        <p class="text-medium-emphasis mb-0 d-none d-sm-block">
          Control de servicios mecánicos, inspección técnica y entregas en taller
        </p>
      </div>

      <div class="d-flex gap-2 flex-wrap w-100 w-md-auto align-center">
        <VBtn
          v-if="can('register_sale')"
          color="primary"
          prepend-icon="ri-add-line"
          to="/work-orders/add"
          class="elevation-2 font-weight-bold flex-grow-1 flex-md-grow-0"
        >
          Nueva Orden
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs / Pestañas de Filtro Interactivas) -->
    <VRow
      class="mb-4 d-none d-sm-flex"
      dense
    >
      <VCol
        cols="12"
        sm="4"
      >
        <VCard
          class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100 cursor-pointer"
          :class="{ 'active-kpi-card': statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          <VAvatar
            size="44"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-file-list-3-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Total Órdenes
            </div>
            <div class="text-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ stats.total }} <span class="text-caption text-disabled font-weight-regular">en historial</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard
          class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100 cursor-pointer"
          :class="{ 'active-kpi-card-warning': statusFilter === 'active' || statusFilter === 'in_progress' || statusFilter === 'received' }"
          @click="statusFilter = (statusFilter === 'active' ? 'all' : 'active')"
        >
          <VAvatar
            size="44"
            color="warning"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-tools-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              En Taller (Operativas)
            </div>
            <div class="text-h6 font-weight-bold text-warning text-truncate">
              {{ stats.received + stats.inProgress + stats.ready }} <span class="text-caption text-disabled font-weight-regular">activas</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard
          class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100 cursor-pointer"
          :class="{ 'active-kpi-card-success': statusFilter === 'ready' }"
          @click="statusFilter = (statusFilter === 'ready' ? 'all' : 'ready')"
        >
          <VAvatar
            size="44"
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
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Listas para Entrega
            </div>
            <div class="text-h6 font-weight-bold text-success text-truncate">
              {{ stats.ready }} <span class="text-caption text-disabled font-weight-regular">listas</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Alarma de Órdenes Por Finalizar / Listas -->
    <VAlert
      v-if="readyWorkOrdersCount > 0"
      color="warning"
      variant="tonal"
      class="mb-4 rounded-xl border border-warning elevation-0 alert-ready-banner"
      icon="ri-alarm-warning-fill"
    >
      <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center w-100 gap-2">
        <div class="d-flex align-center gap-2 flex-wrap">
          <span class="font-weight-bold text-body-1">
            ¡Alerta de Taller! Hay {{ readyWorkOrdersCount }} {{ readyWorkOrdersCount === 1 ? 'orden de trabajo lista por finalizar' : 'órdenes de trabajo listas por finalizar' }}.
          </span>
          <span class="text-caption text-medium-emphasis">
            (Vehículos con servicio técnico completado pendientes de entrega y/o facturación al cliente)
          </span>
        </div>
        <VBtn
          v-if="statusFilter !== 'ready'"
          size="small"
          color="warning"
          variant="flat"
          class="font-weight-bold flex-shrink-0"
          prepend-icon="ri-filter-3-line"
          @click="statusFilter = 'ready'"
        >
          Ver {{ readyWorkOrdersCount === 1 ? 'Orden Lista' : 'Órdenes Listas' }} ({{ readyWorkOrdersCount }})
        </VBtn>
      </div>
    </VAlert>

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
            <span>Filtros de Órdenes</span>
          </div>

          <VBtn
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
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="searchQuery"
              label="Buscar orden"
              placeholder="Número de orden, cliente, documento o placa..."
              prepend-inner-icon="ri-search-2-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              :loading="isLoading || isSearching"
            />
          </VCol>

          <VCol
            cols="12"
            sm="6"
            md="2"
          >
            <VSelect
              v-model="statusFilter"
              :items="statusOptions"
              item-title="title"
              item-value="value"
              label="Estado de la Orden"
              placeholder="Todos los estados"
              prepend-inner-icon="ri-toggle-line"
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
            md="2"
          >
            <VTextField
              v-model="startDate"
              type="date"
              label="Desde"
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
            md="2"
          >
            <VTextField
              v-model="endDate"
              type="date"
              label="Hasta"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ESTADO VACÍO (Solo si no está cargando y no hay órdenes) -->
    <VCard
      v-if="!isLoading && !filteredWorkOrders.length"
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
          icon="ri-file-text-line"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron órdenes de trabajo
      </h3>
      <p
        class="text-body-1 text-medium-emphasis mb-5 mx-auto"
        style="max-width: 480px;"
      >
        Intenta ajustar los filtros de búsqueda o registra una nueva orden técnica.
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
          v-if="can('register_sale')"
          color="primary"
          prepend-icon="ri-add-line"
          to="/work-orders/add"
        >
          Nueva Orden
        </VBtn>
      </div>
    </VCard>

    <!-- LISTADO DE ÓRDENES DE TRABAJO (MÓVIL Y ESCRITORIO CON SKELETON INTEGRADO) -->
    <div v-else>
      <!-- VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-3 mb-4">
        <!-- Skeleton Móvil mientras carga -->
        <template v-if="isLoading">
          <VCard
            v-for="n in 4"
            :key="'mob-skel-wo-' + n"
            class="mobile-wo-card elevation-0 pa-4"
          >
            <div class="d-flex justify-space-between mb-2">
              <div class="shimmer-line w-40" />
              <div
                class="shimmer-button rounded"
                style="width: 24px; height: 24px;"
              />
            </div>
            <div class="d-flex align-center gap-2 mb-3">
              <div
                class="shimmer-button rounded-lg"
                style="width: 34px; height: 34px;"
              />
              <div class="flex-grow-1">
                <div class="shimmer-line w-60 mb-1" />
                <div class="shimmer-line w-35" />
              </div>
            </div>
            <div class="d-flex justify-space-between align-center pt-2 border-t">
              <div class="shimmer-line w-30" />
              <div
                class="shimmer-chip"
                style="width: 70px;"
              />
            </div>
          </VCard>
        </template>

        <!-- Tarjetas reales de órdenes de trabajo -->
        <template v-else>
          <VCard
            v-for="item in paginatedWorkOrders"
            :key="'mob-wo-' + item.id"
            class="mobile-wo-card elevation-0"
            :class="{
              'wo-row-pending-finish': isPendingFinish(item),
            }"
          >
          <!-- Fila superior: N° Orden + Alerta + Acciones -->
          <div class="d-flex align-center justify-space-between gap-2 mb-2 pb-1 border-b">
            <div class="d-flex align-center gap-1.5 min-w-0">
              <VIcon
                v-if="isPendingFinish(item)"
                icon="ri-alarm-warning-fill"
                color="warning"
                size="16"
                class="pulse-alarm-icon flex-shrink-0"
                title="¡Orden lista por finalizar!"
              />
              <span
                class="font-mono font-weight-bold text-primary cursor-pointer text-body-1 hover-underline"
                title="Ver Secuencia e Historial"
                @click="openTimeline(item)"
              >
                {{ formatWorkOrderNumber(item.number, item.id) }}
              </span>
            </div>

            <!-- Acciones rápidas de cabecera -->
            <div class="d-flex align-center gap-1">
              <VBtn
                v-if="item.status !== 'draft'"
                size="x-small"
                color="info"
                variant="tonal"
                icon="ri-eye-line"
                title="Ver Detalles"
                @click="viewDetails(item)"
              />
              <VBtn
                size="x-small"
                color="secondary"
                variant="tonal"
                icon="ri-more-2-line"
                title="Más Opciones"
              >
                <VIcon
                  icon="ri-more-2-line"
                  size="16"
                />
                <VMenu
                  activator="parent"
                  transition="slide-y-transition"
                  align="end"
                  location="bottom end"
                >
                  <VList
                    density="compact"
                    class="py-1 rounded-lg elevation-4 border"
                    min-width="190"
                  >
                    <VListItem
                      v-if="item.status === 'draft' || (can('edit_sale') && !isWorkOrderInvoiced(item))"
                      prepend-icon="ri-pencil-line"
                      title="Editar Orden"
                      class="text-warning font-weight-medium"
                      @click="goToEdit(item.id, item)"
                    />
                    <VListItem
                      v-if="item.status !== 'draft' && !isWorkOrderInvoiced(item)"
                      prepend-icon="ri-hand-coin-line"
                      :title="getWorkOrderAdvances(item) > 0 ? `Abonos ($${getWorkOrderAdvances(item).toFixed(2)})` : 'Registrar Abono'"
                      class="text-success font-weight-medium"
                      @click="openAdvanceDialog(item)"
                    />
                    <VListItem
                      v-if="['ready', 'delivered'].includes(item.status) && !isWorkOrderInvoiced(item)"
                      prepend-icon="ri-shopping-cart-2-line"
                      title="Facturar / Generar Venta"
                      class="text-success font-weight-semibold"
                      @click="goToSale(item.id)"
                    />
                    <VListItem
                      v-if="item.status !== 'draft'"
                      prepend-icon="ri-file-pdf-line"
                      title="Ver / Imprimir PDF"
                      class="text-primary font-weight-medium"
                      @click="openPdfPreview(item)"
                    />
                    <VListItem
                      v-if="item.status !== 'draft'"
                      prepend-icon="ri-download-2-line"
                      title="Descargar PDF"
                      class="text-secondary font-weight-medium"
                      @click="downloadPDF(item.id)"
                    />
                    <VListItem
                      v-if="item.status !== 'draft'"
                      prepend-icon="ri-attachment-2"
                      title="Comprobantes / Soportes"
                      class="text-primary font-weight-medium"
                      @click="openReceiptsDialog(item)"
                    />
                    <VListItem
                      v-if="item.status !== 'delivered' && item.status !== 'draft'"
                      prepend-icon="ri-truck-line"
                      title="Marcar como Entregado"
                      class="text-info font-weight-medium"
                      @click="markAsDelivered(item)"
                    />
                    <VDivider
                      v-if="can('cancel_sale')"
                      class="my-1"
                    />
                    <VListItem
                      v-if="can('cancel_sale')"
                      prepend-icon="ri-close-circle-line"
                      title="Anular Orden"
                      class="text-error font-weight-medium"
                      @click="cancelOrder(item)"
                    />
                  </VList>
                </VMenu>
              </VBtn>
            </div>
          </div>

          <!-- Cliente -->
          <div class="d-flex align-center gap-2 mb-2">
            <VAvatar
              size="32"
              color="primary"
              variant="tonal"
              rounded="lg"
              class="font-weight-bold flex-shrink-0"
            >
              <span style="font-size: 0.75rem;">{{ getClientInitials(item.client) }}</span>
            </VAvatar>
            <div class="min-w-0 flex-grow-1">
              <div
                class="font-weight-bold text-high-emphasis text-body-2 text-truncate"
                :title="getClientName(item.client)"
              >
                {{ getClientName(item.client) }}
              </div>
              <div
                v-if="item.client?.n_document"
                class="text-caption text-medium-emphasis font-mono text-truncate"
              >
                {{ item.client.n_document }}
              </div>
            </div>
          </div>

          <!-- Vehículo -->
          <div
            v-if="item.vehicle"
            class="d-flex align-center gap-1.5 mb-2.5 text-caption min-w-0"
          >
            <VIcon
              icon="ri-roadster-line"
              size="15"
              color="primary"
              class="flex-shrink-0"
            />
            <span
              v-if="item.vehicle.license_plate"
              class="font-mono font-weight-bold text-primary flex-shrink-0"
            >
              {{ item.vehicle.license_plate.toUpperCase() }}
            </span>
            <span
              v-if="item.vehicle.license_plate"
              class="text-disabled"
            >•</span>
            <span class="text-medium-emphasis text-truncate font-weight-medium">
              {{ getVehicleInfo(item.vehicle) }}
            </span>
          </div>

          <!-- Fila inferior: Fecha (Izquierda) + Total y Estado (Derecha) -->
          <div class="d-flex align-end justify-space-between gap-2 pt-1 border-t">
            <!-- Fecha -->
            <div class="d-flex align-center text-caption text-medium-emphasis">
              <VIcon
                icon="ri-calendar-line"
                size="13"
                class="me-1 text-disabled"
              />
              <span class="font-weight-medium">{{ formatDate(item.date || item.created_at) }}</span>
            </div>

            <!-- Total y Estado -->
            <div class="d-flex flex-column align-end gap-1">
              <div class="d-flex align-center gap-2">
                <div
                  v-if="getWorkOrderAdvances(item) > 0"
                  class="status-pill-clean status-paid"
                  style="font-size: 0.65rem !important; padding: 1.5px 6px !important;"
                  :class="{'cursor-pointer': !isWorkOrderInvoiced(item)}"
                  @click.stop="!isWorkOrderInvoiced(item) ? openAdvanceDialog(item) : null"
                >
                  <span class="status-dot" />
                  <span>Abono: ${{ getWorkOrderAdvances(item).toFixed(2) }}</span>
                </div>
                <span
                  class="font-mono font-weight-bold text-h6 text-high-emphasis"
                  style="line-height: 1.1;"
                >
                  ${{ getTotalAmount(item).toFixed(2) }}
                </span>
              </div>

              <!-- Estado -->
              <div
                class="status-pill-clean"
                :class="[getStatusPillClass(item), item.status !== 'draft' ? 'cursor-pointer' : '']"
                title="Clic para ver secuencia de la orden"
                @click="item.status !== 'draft' ? handleStatusClick(item) : null"
              >
                <VProgressCircular
                  v-if="loadingOrders === item.id"
                  indeterminate
                  size="10"
                  width="1.5"
                />
                <span
                  v-else
                  class="status-dot"
                />
                <span>{{ getDynamicLegend(item) }}</span>
              </div>
            </div>
          </div>
        </VCard>
      </template>
    </div>

      <!-- VISTA ESCRITORIO: TABLA MODERNA (d-none d-md-block) -->
      <VCard class="rounded-xl border elevation-0 bg-surface table-card-responsive d-none d-md-block">
        <VTable
          hover
          class="work-orders-modern-table"
        >
          <thead>
            <tr class="bg-grey-lighten-5">
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 13%; white-space: nowrap;"
              >
                N° Orden
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 27%;"
              >
                Cliente
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 23%;"
              >
                Vehículo
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 12%; white-space: nowrap;"
              >
                Fecha
              </th>
              <th
                class="text-right font-weight-bold text-uppercase py-3"
                style="width: 10%; white-space: nowrap;"
              >
                Total
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 10%; white-space: nowrap;"
              >
                Estado
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 5%; white-space: nowrap;"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Skeleton Rows en tabla de escritorio -->
            <template v-if="isLoading">
              <tr
                v-for="n in 5"
                :key="'skel-row-wo-' + n"
                class="skeleton-row align-middle"
              >
                <td
                  class="py-4"
                  style="width: 13%;"
                >
                  <div class="shimmer-line w-75" />
                </td>
                <td
                  class="py-4"
                  style="width: 27%;"
                >
                  <div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" />
                </td>
                <td
                  class="py-4"
                  style="width: 23%;"
                >
                  <div class="shimmer-line w-60 mb-2" /><div class="shimmer-line w-40" />
                </td>
                <td
                  class="py-4"
                  style="width: 12%;"
                >
                  <div class="shimmer-line w-50" />
                </td>
                <td
                  class="py-4 text-right"
                  style="width: 10%;"
                >
                  <div class="shimmer-line w-60 ms-auto" />
                </td>
                <td
                  class="py-4 text-center"
                  style="width: 10%;"
                >
                  <div class="shimmer-chip mx-auto" />
                </td>
                <td
                  class="py-4 text-center"
                  style="width: 5%;"
                >
                  <div class="shimmer-button rounded mx-auto" />
                </td>
              </tr>
            </template>

            <!-- Filas reales de órdenes -->
            <template v-else>
              <tr
                v-for="item in paginatedWorkOrders"
                :key="item.id"
                class="wo-table-row"
                :class="{
                  'wo-row-pending-finish': isPendingFinish(item),
                }"
              >
              <!-- N° Orden -->
              <td
                class="py-3"
                style="white-space: nowrap;"
              >
                <div class="d-flex align-center gap-1.5">
                  <VIcon
                    v-if="isPendingFinish(item)"
                    icon="ri-alarm-warning-fill"
                    color="warning"
                    size="18"
                    class="pulse-alarm-icon flex-shrink-0"
                    title="¡Orden lista por finalizar!"
                  />
                  <div
                    class="font-mono font-weight-bold text-primary cursor-pointer text-body-1 hover-underline"
                    title="Ver Secuencia e Historial de la Orden"
                    @click="openTimeline(item)"
                  >
                    {{ formatWorkOrderNumber(item.number, item.id) }}
                  </div>
                </div>
              </td>

              <!-- Cliente -->
              <td
                class="py-3"
                style="overflow: hidden;"
              >
                <div class="d-flex align-center gap-2 overflow-hidden w-100">
                  <VAvatar
                    size="34"
                    color="primary"
                    variant="tonal"
                    rounded="lg"
                    class="font-weight-bold elevation-0 flex-shrink-0"
                  >
                    <span style="font-size: 0.8rem;">{{ getClientInitials(item.client) }}</span>
                  </VAvatar>
                  <div
                    class="min-w-0 flex-grow-1 overflow-hidden"
                    style="width: 0;"
                  >
                    <span
                      class="font-weight-bold text-high-emphasis text-body-2"
                      style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;"
                      :title="getClientName(item.client)"
                    >
                      {{ getClientName(item.client) }}
                    </span>
                    <span
                      v-if="item.client?.n_document"
                      class="text-caption text-medium-emphasis font-mono"
                      style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;"
                      :title="item.client.n_document"
                    >
                      {{ item.client.n_document }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Vehículo -->
              <td
                class="py-3"
                style="overflow: hidden;"
              >
                <div
                  v-if="item.vehicle"
                  class="d-flex align-center gap-2 overflow-hidden w-100"
                >
                  <VAvatar
                    size="34"
                    color="secondary"
                    variant="tonal"
                    rounded="lg"
                    class="elevation-0 flex-shrink-0"
                  >
                    <VIcon
                      icon="ri-car-line"
                      size="18"
                      color="secondary"
                    />
                  </VAvatar>
                  <div
                    class="min-w-0 flex-grow-1 overflow-hidden"
                    style="width: 0;"
                  >
                    <span
                      class="font-mono"
                      :class="item.vehicle.license_plate ? 'vehicle-plate-large text-high-emphasis' : 'text-body-2 font-weight-medium text-disabled'"
                      style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;"
                      :title="item.vehicle.license_plate ? item.vehicle.license_plate.toUpperCase() : 'Sin placa'"
                    >
                      {{ item.vehicle.license_plate ? item.vehicle.license_plate.toUpperCase() : 'SIN PLACA' }}
                    </span>
                    <span
                      class="text-uppercase font-weight-medium text-medium-emphasis vehicle-model-small"
                      style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;"
                      :title="getVehicleInfo(item.vehicle)"
                    >
                      {{ getVehicleInfo(item.vehicle) }}
                    </span>
                  </div>
                </div>
                <div
                  v-else
                  class="d-flex align-center gap-2 text-disabled text-caption overflow-hidden w-100"
                >
                  <VAvatar
                    size="34"
                    color="secondary"
                    variant="tonal"
                    rounded="lg"
                    class="elevation-0 flex-shrink-0 opacity-40"
                  >
                    <VIcon
                      icon="ri-car-line"
                      size="18"
                    />
                  </VAvatar>
                  <span class="text-truncate">Sin vehículo</span>
                </div>
              </td>

              <!-- Fecha -->
              <td
                class="py-3"
                style="white-space: nowrap;"
              >
                <div
                  class="d-flex align-center text-body-2 text-medium-emphasis text-no-wrap"
                  style="white-space: nowrap;"
                >
                  <VIcon
                    icon="ri-calendar-line"
                    size="16"
                    color="medium-emphasis"
                    class="me-1 flex-shrink-0"
                  />
                  <span
                    class="text-no-wrap font-weight-medium"
                    style="white-space: nowrap;"
                  >{{ formatDate(item.date || item.created_at) }}</span>
                </div>
              </td>

              <!-- Total -->
              <td
                class="py-3 text-right"
                style="white-space: nowrap;"
              >
                <span class="font-weight-bold font-mono text-body-1 text-high-emphasis">
                  ${{ getTotalAmount(item).toFixed(2) }}
                </span>
                <div
                  v-if="getWorkOrderAdvances(item) > 0"
                  class="mt-1 d-flex justify-end"
                >
                  <div
                    class="status-pill-clean status-paid"
                    style="font-size: 0.68rem !important; padding: 2px 8px !important;"
                    :class="{'cursor-pointer': !isWorkOrderInvoiced(item)}"
                    :title="isWorkOrderInvoiced(item) ? 'Abonos registrados (Orden ya facturada)' : 'Abonos registrados. Clic para gestionar'"
                    @click.stop="!isWorkOrderInvoiced(item) ? openAdvanceDialog(item) : null"
                  >
                    <span class="status-dot" />
                    <span>Abonado: ${{ getWorkOrderAdvances(item).toFixed(2) }}</span>
                  </div>
                </div>
              </td>

              <!-- Estado (Píldora limpia estilo socios con punto) -->
              <td
                class="text-center py-3"
                style="white-space: nowrap;"
              >
                <div
                  class="status-pill-clean"
                  :class="[getStatusPillClass(item), item.status !== 'draft' ? 'cursor-pointer' : '']"
                  title="Clic para ver secuencia de la orden"
                  @click="item.status !== 'draft' ? handleStatusClick(item) : null"
                >
                  <VProgressCircular
                    v-if="loadingOrders === item.id"
                    indeterminate
                    size="10"
                    width="1.5"
                  />
                  <span
                    v-else
                    class="status-dot"
                  />
                  <span>{{ getDynamicLegend(item) }}</span>
                </div>
              </td>

              <!-- Acciones -->
              <td
                class="text-center py-3"
                style="white-space: nowrap;"
              >
                <div class="d-flex justify-center align-center gap-1">
                  <!-- Ver detalles -->
                  <VBtn
                    v-if="item.status !== 'draft'"
                    size="small"
                    color="info"
                    variant="tonal"
                    icon="ri-eye-line"
                    title="Ver Detalles de la Orden"
                    @click="viewDetails(item)"
                  />

                  <!-- Menú Más Opciones -->
                  <VBtn
                    size="small"
                    color="secondary"
                    variant="tonal"
                    icon="ri-more-2-line"
                    title="Más Opciones"
                  >
                    <VIcon
                      icon="ri-more-2-line"
                      size="18"
                    />
                    <VMenu
                      activator="parent"
                      transition="slide-y-transition"
                      align="end"
                      location="bottom end"
                    >
                      <VList
                        density="compact"
                        class="py-1 rounded-lg elevation-4 border"
                        min-width="190"
                      >
                        <!-- Editar Orden -->
                        <VListItem
                          v-if="item.status === 'draft' || (can('edit_sale') && !isWorkOrderInvoiced(item))"
                          prepend-icon="ri-pencil-line"
                          title="Editar Orden"
                          class="text-warning font-weight-medium"
                          @click="goToEdit(item.id, item)"
                        />

                        <!-- Abonos / Anticipos (Solo si no ha sido facturada) -->
                        <VListItem
                          v-if="item.status !== 'draft' && !isWorkOrderInvoiced(item)"
                          prepend-icon="ri-hand-coin-line"
                          :title="getWorkOrderAdvances(item) > 0 ? `Abonos ($${getWorkOrderAdvances(item).toFixed(2)})` : 'Registrar Abono'"
                          class="text-success font-weight-medium"
                          @click="openAdvanceDialog(item)"
                        />

                        <!-- Facturar / Generar Venta -->
                        <VListItem
                          v-if="['ready', 'delivered'].includes(item.status) && !isWorkOrderInvoiced(item)"
                          prepend-icon="ri-shopping-cart-2-line"
                          title="Facturar / Generar Venta"
                          class="text-success font-weight-semibold"
                          @click="goToSale(item.id)"
                        />

                        <!-- Ver / Imprimir PDF -->
                        <VListItem
                          v-if="item.status !== 'draft'"
                          prepend-icon="ri-file-pdf-line"
                          title="Ver / Imprimir PDF"
                          class="text-primary font-weight-medium"
                          @click="openPdfPreview(item)"
                        />

                        <!-- Descargar PDF -->
                        <VListItem
                          v-if="item.status !== 'draft'"
                          prepend-icon="ri-download-2-line"
                          title="Descargar PDF"
                          class="text-secondary font-weight-medium"
                          @click="downloadPDF(item.id)"
                        />

                        <!-- Comprobantes / Soportes -->
                        <VListItem
                          v-if="item.status !== 'draft'"
                          prepend-icon="ri-attachment-2"
                          title="Comprobantes / Soportes"
                          class="text-primary font-weight-medium"
                          @click="openReceiptsDialog(item)"
                        />

                        <!-- Marcar como Entregado -->
                        <VListItem
                          v-if="item.status !== 'delivered' && item.status !== 'draft'"
                          prepend-icon="ri-truck-line"
                          title="Marcar como Entregado"
                          class="text-primary font-weight-medium"
                          @click="updateStatus(item.id, 'delivered')"
                        />

                        <VDivider
                          v-if="can('delete_sale') && !hasSriAuthorizedInvoice(item)"
                          class="my-1"
                        />

                        <!-- Eliminar Orden -->
                        <VListItem
                          v-if="can('delete_sale') && !hasSriAuthorizedInvoice(item)"
                          prepend-icon="ri-delete-bin-line"
                          title="Eliminar Orden"
                          class="text-error font-weight-medium"
                          @click="deleteWorkOrder(item)"
                        />
                      </VList>
                    </VMenu>
                  </VBtn>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </VTable>
    </VCard>

    <!-- Paginación -->
    <VCard
      v-if="totalPages > 0"
      class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface"
    >
      <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100 text-center text-sm-start">
        <div class="text-body-2 text-medium-emphasis">
          Mostrando <strong class="text-high-emphasis">{{ paginatedWorkOrders.length }}</strong> de <strong class="text-high-emphasis">{{ filteredWorkOrders.length }}</strong> órdenes
        </div>
        <VPagination
          v-model="currentPage"
          :length="totalPages"
          :disabled="isLoading"
          rounded="circle"
          :total-visible="$vuetify.display.xs ? 4 : 7"
          :size="$vuetify.display.xs ? 'small' : 'default'"
          density="comfortable"
          color="primary"
          class="my-0"
        />
      </div>
    </VCard>
  </div>

    <!-- DIÁLOGOS -->
    <!-- Details Dialog -->
    <VDialog
      v-model="showDetailsDialog"
      scrollable
      max-width="820"
      persistent
      transition="dialog-bottom-transition"
    >
      <VCard
        v-if="selectedWorkOrder"
        class="custom-dialog-card elevation-12"
      >
        <!-- Header Banner Primary (Estilo unificado del sistema) -->
        <div class="custom-dialog-header-primary bg-primary text-white">
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
            Detalles de Orden {{ formatWorkOrderNumber(selectedWorkOrder.number, selectedWorkOrder.id) }}
          </h3>
          <p class="custom-dialog-subtitle">
            Información técnica de servicios, repuestos y montos asignados
          </p>
        </div>

        <VCardText class="pa-6">
          <!-- Tarjetas Resumen de Cliente y Vehículo -->
          <VRow
            dense
            class="mb-4"
          >
            <VCol
              cols="12"
              sm="6"
            >
              <div
                class="pa-3 rounded-xl border info-card-flat h-100"
                style="background-color: #f8fafc;"
              >
                <div class="d-flex align-center gap-2 mb-1.5">
                  <VIcon
                    icon="ri-user-3-line"
                    size="18"
                    color="primary"
                  />
                  <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Cliente</span>
                </div>
                <div class="text-body-1 font-weight-bold text-slate-900">
                  {{ getClientName(selectedWorkOrder.client) }}
                </div>
                <div
                  v-if="selectedWorkOrder.client?.n_document"
                  class="text-caption text-medium-emphasis font-mono mt-0.5"
                >
                  Doc: {{ selectedWorkOrder.client.n_document }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <div
                class="pa-3 rounded-xl border info-card-flat h-100"
                style="background-color: #f8fafc;"
              >
                <div class="d-flex align-center justify-space-between mb-1.5">
                  <div class="d-flex align-center gap-2">
                    <VIcon
                      icon="ri-car-line"
                      size="18"
                      color="primary"
                    />
                    <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Vehículo</span>
                  </div>
                  <span
                    v-if="selectedWorkOrder.vehicle?.license_plate"
                    class="license-plate-badge"
                  >
                    {{ selectedWorkOrder.vehicle.license_plate.toUpperCase() }}
                  </span>
                </div>
                <div class="text-body-1 font-weight-bold text-slate-900">
                  {{ getVehicleInfo(selectedWorkOrder.vehicle) }}
                </div>
                <div class="d-flex align-center gap-3 text-caption text-medium-emphasis mt-1">
                  <span>KM: <strong class="font-mono text-high-emphasis">{{ selectedWorkOrder.mileage || 'N/A' }}</strong></span>
                  <span>•</span>
                  <span>Combustible: <strong class="text-high-emphasis">{{ selectedWorkOrder.fuel_level || 'N/A' }}</strong></span>
                </div>
              </div>
            </VCol>
          </VRow>

          <!-- Tabla de Items de la Orden -->
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-subtitle-2 font-weight-bold text-slate-900 d-flex align-center gap-1.5">
              <VIcon
                icon="ri-tools-line"
                size="18"
                color="primary"
              />
              Servicios y Repuestos Asignados
            </span>
            <VChip
              size="small"
              variant="tonal"
              color="primary"
              class="font-weight-bold"
            >
              {{ (selectedWorkOrder.items || []).length }} ítem(s)
            </VChip>
          </div>

          <div class="rounded-xl border overflow-hidden mb-4">
            <VTable density="comfortable">
              <thead>
                <tr class="bg-grey-lighten-5">
                  <th class="text-left py-3 font-weight-bold text-uppercase text-caption">
                    Descripción
                  </th>
                  <th
                    class="text-center py-3 font-weight-bold text-uppercase text-caption"
                    style="width: 90px;"
                  >
                    Cant.
                  </th>
                  <th
                    class="text-right py-3 font-weight-bold text-uppercase text-caption"
                    style="width: 120px;"
                  >
                    P. Unit
                  </th>
                  <th
                    class="text-right py-3 font-weight-bold text-uppercase text-caption"
                    style="width: 120px;"
                  >
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in (selectedWorkOrder.items || [])"
                  :key="idx"
                  class="border-b"
                >
                  <td class="py-2.5 font-weight-medium text-body-2 text-slate-900">
                    {{ item.description || item.product?.title || '-' }}
                  </td>
                  <td class="py-2.5 text-center font-mono text-body-2">
                    {{ item.quantity || 1 }}
                  </td>
                  <td class="py-2.5 text-right font-mono text-body-2 text-medium-emphasis">
                    ${{ parseFloat(item.unit_price || item.price_unit || item.price || 0).toFixed(2) }}
                  </td>
                  <td class="py-2.5 text-right font-mono font-weight-bold text-body-2 text-slate-900">
                    ${{ parseFloat(item.subtotal || ((item.quantity || 1) * (item.unit_price || 0))).toFixed(2) }}
                  </td>
                </tr>
                <tr v-if="!selectedWorkOrder.items || !selectedWorkOrder.items.length">
                  <td
                    colspan="4"
                    class="text-center py-6 text-medium-emphasis"
                  >
                    <VIcon
                      icon="ri-inbox-line"
                      size="24"
                      class="d-block mx-auto mb-1 text-disabled"
                    />
                    No hay ítems registrados en la orden
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>

          <!-- Total de la Orden -->
          <div
            class="pa-4 rounded-xl border d-flex justify-space-between align-center"
            style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);"
          >
            <div class="d-flex align-center gap-2.5">
              <VAvatar
                size="38"
                color="primary"
                variant="tonal"
                class="rounded-lg"
              >
                <VIcon
                  icon="ri-money-dollar-circle-line"
                  size="22"
                  color="primary"
                />
              </VAvatar>
              <div>
                <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
                  Total de la Orden
                </div>
                <div class="text-caption text-medium-emphasis">
                  Monto acumulado de servicios y repuestos
                </div>
              </div>
            </div>
            <span class="text-h5 font-weight-black font-mono text-primary">
              ${{ getTotalAmount(selectedWorkOrder).toFixed(2) }}
            </span>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions
          class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="showDetailsDialog = false"
          >
            Cerrar
          </VBtn>
          <VBtn
            v-if="['ready', 'delivered'].includes(selectedWorkOrder?.status) && !isWorkOrderInvoiced(selectedWorkOrder)"
            color="success"
            variant="elevated"
            prepend-icon="ri-shopping-cart-2-line"
            class="rounded-lg px-6 font-weight-bold elevation-2"
            height="40"
            @click="goToSale(selectedWorkOrder.id)"
          >
            Facturar / Vender
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            prepend-icon="ri-printer-line"
            class="rounded-lg px-6 font-weight-bold elevation-2"
            height="40"
            @click="printPDF(selectedWorkOrder.id)"
          >
            Imprimir PDF
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal Confirmar Eliminación Estándar del Sistema -->
    <VDialog
      v-model="showDeleteDialog"
      scrollable
      max-width="500"
      persistent
      transition="dialog-bottom-transition"
    >
      <VCard
        v-if="workOrderToDelete"
        class="custom-dialog-card elevation-12"
      >
        <!-- Header Banner Primary (Color del sistema) -->
        <div class="custom-dialog-header-primary bg-primary text-white">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            :disabled="isDeleting"
            @click="showDeleteDialog = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-delete-bin-line" />
          </div>
          <h3 class="custom-dialog-title">
            Eliminar Orden de Trabajo
          </h3>
          <p class="custom-dialog-subtitle">
            Esta acción removerá permanentemente la orden seleccionada
          </p>
        </div>

        <VCardText class="pa-6">
          <div class="text-center">
            <!-- Work Order Avatar -->
            <VAvatar
              size="72"
              color="primary"
              variant="tonal"
              class="mb-3"
            >
              <VIcon
                icon="ri-file-settings-line"
                size="36"
              />
            </VAvatar>

            <!-- Info Summary -->
            <div class="mb-2">
              <h4 class="text-h6 font-weight-bold mb-1 text-high-emphasis">
                ¿Eliminar permanentemente esta orden?
              </h4>
              <p class="text-caption text-medium-emphasis mb-3">
                Orden <strong class="font-mono text-error font-weight-bold">{{ formatWorkOrderNumber(workOrderToDelete.number, workOrderToDelete.id) }}</strong>
              </p>

              <!-- Detalles en Card Plana -->
              <div
                class="pa-3 rounded-xl border d-flex flex-column gap-2 text-start info-card-flat"
                style="background-color: #f8fafc;"
              >
                <div
                  v-if="workOrderToDelete.client"
                  class="d-flex justify-space-between align-center"
                >
                  <span class="text-caption text-medium-emphasis">Cliente:</span>
                  <span
                    class="text-caption font-weight-bold text-slate-900 text-truncate"
                    style="max-width: 220px;"
                  >
                    {{ getClientName(workOrderToDelete.client) }}
                  </span>
                </div>

                <div
                  v-if="workOrderToDelete.vehicle"
                  class="d-flex justify-space-between align-center"
                >
                  <span class="text-caption text-medium-emphasis">Vehículo:</span>
                  <span class="text-caption font-mono font-weight-bold text-primary">
                    {{ workOrderToDelete.vehicle.license_plate ? workOrderToDelete.vehicle.license_plate.toUpperCase() : 'SIN PLACA' }}
                  </span>
                </div>

                <div class="d-flex justify-space-between align-center">
                  <span class="text-caption text-medium-emphasis">Fecha:</span>
                  <span class="text-caption font-mono font-weight-medium">
                    {{ formatDate(workOrderToDelete.date || workOrderToDelete.created_at) }}
                  </span>
                </div>

                <div
                  v-if="workOrderToDelete.total"
                  class="d-flex justify-space-between align-center"
                >
                  <span class="text-caption text-medium-emphasis">Total:</span>
                  <span class="text-caption font-mono font-weight-bold text-slate-900">
                    ${{ parseFloat(workOrderToDelete.total || 0).toFixed(2) }}
                  </span>
                </div>
              </div>

              <VAlert
                v-if="hasSriAuthorizedInvoice(workOrderToDelete)"
                type="error"
                variant="tonal"
                class="mt-4 text-start rounded-lg"
                border="start"
              >
                <template #prepend>
                  <VIcon icon="ri-shield-cross-line" />
                </template>
                <div class="text-caption font-weight-medium">
                  <strong>Factura Autorizada por el SRI:</strong> Esta orden de trabajo ya cuenta con una factura autorizada por el SRI. Por regulaciones fiscales y tributarias, no puede ser eliminada.
                </div>
              </VAlert>

              <div
                v-else
                class="mt-4 d-flex align-center justify-center gap-1 text-error text-caption font-weight-medium text-center"
              >
                <VIcon
                  icon="ri-error-warning-line"
                  size="16"
                />
                <span>Esta acción es irreversible y eliminará todos los registros asociados.</span>
              </div>
            </div>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions
          class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            :disabled="isDeleting"
            @click="showDeleteDialog = false"
          >
            {{ hasSriAuthorizedInvoice(workOrderToDelete) ? 'Cerrar' : 'Cancelar' }}
          </VBtn>
          <VBtn
            v-if="!hasSriAuthorizedInvoice(workOrderToDelete)"
            color="error"
            variant="elevated"
            prepend-icon="ri-delete-bin-line"
            class="rounded-lg px-6 font-weight-bold elevation-2"
            height="40"
            :loading="isDeleting"
            @click="confirmDeleteWorkOrder"
          >
            Sí, Eliminar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal PDF Preview -->
    <VDialog
      v-model="isPdfPreviewDialogVisible"
      max-width="960"
      scrollable
      transition="dialog-bottom-transition"
    >
      <VCard class="custom-dialog-card elevation-12">
        <div class="custom-dialog-header-primary bg-primary text-white py-3 px-5 d-flex align-center justify-space-between position-relative">
          <div class="d-flex align-center gap-3">
            <VAvatar
              size="38"
              color="white"
              variant="tonal"
              class="rounded-lg"
            >
              <VIcon
                icon="ri-file-pdf-line"
                size="22"
                color="white"
              />
            </VAvatar>
            <div class="text-start">
              <h3 class="text-subtitle-1 font-weight-bold text-white mb-0">
                {{ pdfPreviewTitle }}
              </h3>
              <p class="text-caption text-white opacity-80 mb-0">
                Vista previa del documento oficial para impresión
              </p>
            </div>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isPdfPreviewDialogVisible = false"
          />
        </div>
        <VCardText
          class="pa-0"
          style="height: 720px; overflow: hidden;"
        >
          <iframe
            v-if="pdfPreviewUrl"
            :src="pdfPreviewUrl"
            width="100%"
            height="100%"
            style="border: none;"
          />
        </VCardText>
        <VDivider />
        <VCardActions
          class="pa-3 px-5 d-flex justify-end align-center bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="38"
            @click="isPdfPreviewDialogVisible = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Diálogo Timeline (Secuencia de la Orden de Trabajo) -->
    <WorkOrderTimelineDialog
      v-model:is-dialog-visible="showTimelineDialog"
      :work-order="selectedTimelineOrder"
      :is-updating="!!loadingOrders"
      @change-status="(newStatus) => selectedTimelineOrder && updateStatus(selectedTimelineOrder.id, newStatus)"
      @generate-sale="() => selectedTimelineOrder && goToSale(selectedTimelineOrder.id)"
      @close="showTimelineDialog = false"
    />

    <!-- Diálogo Comprobantes -->
    <AttachReceiptsDialog
      v-if="isReceiptsDialogVisible && selectedReceiptsOrder"
      v-model:is-dialog-visible="isReceiptsDialogVisible"
      attachable-type="work_order"
      :attachable-id="selectedReceiptsOrder.id"
      :identifier="selectedReceiptsOrder.order_number ? '#' + selectedReceiptsOrder.order_number : '#' + selectedReceiptsOrder.id"
      :party-name="selectedReceiptsOrder.client?.full_name || selectedReceiptsOrder.client?.name || ''"
    />

    <!-- Diálogo de Abonos / Anticipos -->
    <WorkOrderAdvanceDialog
      v-model:is-dialog-visible="showAdvanceDialog"
      :work-order="selectedAdvanceOrder"
      @advance-saved="handleAdvanceUpdated"
      @advance-deleted="handleAdvanceUpdated"
    />
  </div>
</template>

