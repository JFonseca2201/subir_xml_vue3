<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getBrandNameById } from '@/data/vehicleBrands'
import WorkOrderTimelineDialog from '@/components/dialogs/WorkOrderTimelineDialog.vue'
import AttachReceiptsDialog from '@/components/common/AttachReceiptsDialog.vue'
import { useLoaderStore } from '@/stores/loader'
import { usePermissions } from '@/composables/usePermissions'

const router = useRouter()
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
  { title: 'Todos los estados', value: 'all' },
  { title: 'Borrador', value: 'draft' },
  { title: 'Recibido', value: 'received' },
  { title: 'En Progreso', value: 'in_progress' },
  { title: 'Listo para entrega', value: 'ready' },
  { title: 'Entregado', value: 'delivered' },
]

const statusColors = {
  draft: 'secondary',
  received: 'info',
  in_progress: 'warning',
  ready: 'success',
  delivered: 'default',
}

const statusIcons = {
  draft: 'ri-draft-line',
  received: 'ri-file-list-3-line',
  in_progress: 'ri-tools-line',
  ready: 'ri-checkbox-circle-fill',
  delivered: 'ri-truck-line',
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

const hasActiveFilters = computed(() => {
  return !!(
    (searchQuery.value && searchQuery.value.trim()) ||
    (statusFilter.value && statusFilter.value !== 'all')
  )
})

const resetFilters = () => {
  searchQuery.value = ''
  debouncedSearchQuery.value = ''
  statusFilter.value = 'all'
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

const handleStatusClick = workOrder => {
  openTimeline(workOrder)
}

const getDynamicIcon = workOrder => {
  if (['ready', 'delivered'].includes(workOrder.status) && !workOrder.sale) return 'ri-shopping-cart-line'
  if (['ready', 'delivered'].includes(workOrder.status) && workOrder.sale) return 'ri-check-double-line'

  return statusIcons[workOrder.status] || 'ri-tools-line'
}

const getDynamicLegend = workOrder => {
  if (['ready', 'delivered'].includes(workOrder.status) && !workOrder.sale) return 'Facturar'
  if (['ready', 'delivered'].includes(workOrder.status) && workOrder.sale) return 'Facturado'

  return statusLabels[workOrder.status] || workOrder.status
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
  loadWorkOrders()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 work-orders-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-tools-line" size="26" />
          </VAvatar>
          Órdenes de Trabajo
        </h1>
        <p class="text-medium-emphasis mb-0">
          Control de servicios mecánicos, inspección técnica y entregas en taller
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          v-if="can('register_sale')"
          color="primary"
          prepend-icon="ri-add-line"
          to="/work-orders/add"
          class="elevation-2 font-weight-bold"
        >
          Nueva Orden
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-file-list-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Órdenes Registradas</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ stats.total }} <span class="text-caption text-disabled font-weight-regular">en historial</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-tools-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">En Taller (Operativas)</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ stats.received + stats.inProgress }} <span class="text-caption text-disabled font-weight-regular">recibidas / en progreso</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-checkbox-circle-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Listas / Entregadas</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ stats.ready + stats.delivered }} <span class="text-caption text-disabled font-weight-regular">finalizadas</span>
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
            <span>Filtros de Órdenes</span>
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
          <VCol cols="12" md="8">
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

          <VCol cols="12" md="4">
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
              color="primary"
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
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-75" /></td>
            <td class="py-4"><div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-60 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-50" /></td>
            <td class="py-4" style="width: 120px;"><div class="shimmer-chip mx-auto" /></td>
            <td class="py-4 text-center" style="width: 140px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!filteredWorkOrders.length"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-file-text-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron órdenes de trabajo
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los filtros de búsqueda o registra una nueva orden técnica.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_sale')" color="primary" prepend-icon="ri-add-line" to="/work-orders/add">
          Nueva Orden
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA MODERNA DE ÓRDENES DE TRABAJO -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="work-orders-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 130px; min-width: 120px; white-space: nowrap;">
                N° Orden
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 220px; min-width: 180px; max-width: 240px;">
                Cliente
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 280px;">
                Vehículo
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 145px; min-width: 140px; white-space: nowrap;">
                Fecha
              </th>
              <th class="text-right font-weight-bold text-uppercase py-3" style="width: 110px; min-width: 100px; white-space: nowrap;">
                Total
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 150px; min-width: 140px; white-space: nowrap;">
                Estado
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px; min-width: 120px; white-space: nowrap;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedWorkOrders" :key="item.id" class="wo-table-row">
              <!-- N° Orden -->
              <td class="py-3" style="white-space: nowrap;">
                <div
                  class="font-mono font-weight-bold text-primary cursor-pointer text-body-1 hover-underline"
                  title="Ver Secuencia e Historial de la Orden"
                  @click="openTimeline(item)"
                >
                  {{ formatWorkOrderNumber(item.number, item.id) }}
                </div>
              </td>

              <!-- Cliente -->
              <td class="py-3" style="max-width: 240px;">
                <div class="d-flex align-center gap-2">
                  <VAvatar size="34" color="primary" variant="tonal" rounded="lg" class="font-weight-bold elevation-0 flex-shrink-0">
                    <span style="font-size: 0.8rem;">{{ getClientInitials(item.client) }}</span>
                  </VAvatar>
                  <div class="min-w-0" style="max-width: 180px;">
                    <div class="font-weight-bold text-high-emphasis text-body-2 text-truncate" :title="getClientName(item.client)">
                      {{ getClientName(item.client) }}
                    </div>
                    <div v-if="item.client?.n_document" class="text-caption text-medium-emphasis font-mono text-truncate">
                      {{ item.client.n_document }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Vehículo -->
              <td class="py-3">
                <div v-if="item.vehicle" class="d-flex align-center gap-2">
                  <VAvatar size="34" color="secondary" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0">
                    <VIcon icon="ri-car-line" size="18" color="secondary" />
                  </VAvatar>
                  <div class="min-w-0" style="max-width: 250px;">
                    <div class="font-mono font-weight-bold text-high-emphasis text-body-2 text-truncate" :title="item.vehicle.license_plate ? item.vehicle.license_plate.toUpperCase() : 'Sin placa'">
                      {{ item.vehicle.license_plate ? item.vehicle.license_plate.toUpperCase() : 'SIN PLACA' }}
                    </div>
                    <div class="text-caption text-medium-emphasis text-uppercase text-truncate font-weight-medium" :title="getVehicleInfo(item.vehicle)">
                      {{ getVehicleInfo(item.vehicle) }}
                    </div>
                  </div>
                </div>
                <div v-else class="d-flex align-center gap-2 text-disabled text-caption">
                  <VAvatar size="34" color="secondary" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0 opacity-40">
                    <VIcon icon="ri-car-line" size="18" />
                  </VAvatar>
                  <span>Sin vehículo</span>
                </div>
              </td>

              <!-- Fecha -->
              <td class="py-3" style="white-space: nowrap;">
                <div class="d-flex align-center text-body-2 text-medium-emphasis text-no-wrap" style="white-space: nowrap;">
                  <VIcon icon="ri-calendar-line" size="16" color="medium-emphasis" class="me-1 flex-shrink-0" />
                  <span class="text-no-wrap font-weight-medium" style="white-space: nowrap;">{{ formatDate(item.date || item.created_at) }}</span>
                </div>
              </td>

              <!-- Total -->
              <td class="py-3 text-right" style="white-space: nowrap;">
                <span class="font-weight-bold font-mono text-body-1 text-high-emphasis">
                  ${{ getTotalAmount(item).toFixed(2) }}
                </span>
              </td>

              <!-- Estado (Único chip tonal interactivo) -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <VChip
                  :color="statusColors[item.status]"
                  variant="tonal"
                  size="small"
                  class="font-weight-bold text-uppercase cursor-pointer"
                  @click="item.status !== 'draft' ? handleStatusClick(item) : null"
                >
                  <VProgressCircular
                    v-if="loadingOrders === item.id"
                    indeterminate
                    size="14"
                    width="2"
                    class="me-1"
                  />
                  <VIcon
                    v-else
                    :icon="getDynamicIcon(item)"
                    size="14"
                    class="me-1"
                  />
                  {{ getDynamicLegend(item) }}
                </VChip>
              </td>

              <!-- Acciones -->
              <td class="text-center py-3" style="white-space: nowrap;">
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

                  <!-- Editar -->
                  <VBtn
                    v-if="item.status === 'draft' || (can('edit_sale') && !isWorkOrderInvoiced(item))"
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Orden"
                    @click="goToEdit(item.id, item)"
                  />

                  <!-- Menú Más Opciones -->
                  <VBtn
                    v-if="item.status !== 'draft'"
                    size="small"
                    color="secondary"
                    variant="tonal"
                    icon="ri-more-2-line"
                    title="Más Opciones"
                  >
                    <VIcon icon="ri-more-2-line" size="18" />
                    <VMenu
                      activator="parent"
                      transition="slide-y-transition"
                      align="end"
                      location="bottom end"
                    >
                      <VList density="compact" class="py-1 rounded-lg elevation-4 border" min-width="190">
                        <VListItem
                          prepend-icon="ri-file-pdf-line"
                          title="Ver PDF"
                          class="text-primary font-weight-medium"
                          @click="openPdfPreview(item)"
                        />
                        <VListItem
                          prepend-icon="ri-printer-line"
                          title="Imprimir Orden"
                          class="text-info font-weight-medium"
                          @click="printPDF(item.id)"
                        />
                        <VListItem
                          prepend-icon="ri-download-2-line"
                          title="Descargar PDF"
                          class="text-secondary font-weight-medium"
                          @click="downloadPDF(item.id)"
                        />
                        <VListItem
                          prepend-icon="ri-attachment-2"
                          title="Comprobantes / Soportes"
                          class="text-primary font-weight-medium"
                          @click="openReceiptsDialog(item)"
                        />
                        <VDivider class="my-1" />
                        <VListItem
                          prepend-icon="ri-time-line"
                          title="Ver Secuencia / Historial"
                          class="text-secondary font-weight-medium"
                          @click="openTimeline(item)"
                        />
                        <VListItem
                          v-if="['ready', 'delivered'].includes(item.status) && !item.sale"
                          prepend-icon="ri-shopping-cart-line"
                          title="Generar Venta"
                          class="text-success font-weight-semibold"
                          @click="goToSale(item.id)"
                        />
                        <VListItem
                          v-if="item.status !== 'delivered' && item.status !== 'draft'"
                          prepend-icon="ri-truck-line"
                          title="Marcar como Entregado"
                          class="text-primary font-weight-medium"
                          @click="updateStatus(item.id, 'delivered')"
                        />
                        <VDivider v-if="can('delete_sale')" class="my-1" />
                        <VListItem
                          v-if="can('delete_sale')"
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
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ paginatedWorkOrders.length }}</strong> de <strong class="text-high-emphasis">{{ filteredWorkOrders.length }}</strong> órdenes
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            color="primary"
          />
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <!-- Details Dialog -->
    <VDialog
      v-model="showDetailsDialog"
      scrollable
      max-width="800"
    >
      <VCard v-if="selectedWorkOrder" class="rounded-xl overflow-hidden border elevation-24 bg-surface">
        <div class="pa-5 bg-grey-lighten-5 border-b position-relative">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="position-absolute"
            style="top: 12px; right: 12px;"
            @click="showDetailsDialog = false"
          />
          <div class="d-flex align-center gap-3">
            <VAvatar size="46" color="primary" variant="tonal" rounded="xl">
              <VIcon icon="ri-file-list-3-line" size="24" />
            </VAvatar>
            <div>
              <h3 class="custom-dialog-title">
                Detalles de Orden {{ formatWorkOrderNumber(selectedWorkOrder.number, selectedWorkOrder.id) }}
              </h3>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Información técnica de servicios, repuestos y montos
              </p>
            </div>
          </div>
        </div>

        <VCardText class="pa-5">
          <VRow dense class="mb-3">
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis font-weight-medium">Cliente</div>
              <div class="text-body-1 font-weight-bold text-high-emphasis">
                {{ getClientName(selectedWorkOrder.client) }}
              </div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis font-weight-medium">Vehículo</div>
              <div class="text-body-1 font-weight-bold text-high-emphasis">
                {{ getVehicleInfo(selectedWorkOrder.vehicle) }}
              </div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis font-weight-medium">Kilometraje</div>
              <div class="text-body-1 font-mono font-weight-bold">
                {{ selectedWorkOrder.mileage || 'N/A' }} km
              </div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis font-weight-medium">Nivel de Combustible</div>
              <div class="text-body-1 font-weight-bold">
                {{ selectedWorkOrder.fuel_level || 'N/A' }}
              </div>
            </VCol>
          </VRow>

          <!-- Tabla de Items de la Orden -->
          <div class="text-subtitle-2 font-weight-bold mb-2">Servicios y Repuestos Asignados</div>
          <VTable density="compact" class="border rounded-lg mb-4">
            <thead>
              <tr class="bg-grey-lighten-5">
                <th class="text-left py-2 font-weight-bold">Descripción</th>
                <th class="text-center py-2 font-weight-bold" style="width: 80px;">Cant.</th>
                <th class="text-right py-2 font-weight-bold" style="width: 110px;">P. Unit</th>
                <th class="text-right py-2 font-weight-bold" style="width: 110px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in (selectedWorkOrder.items || [])" :key="idx">
                <td class="py-2">{{ item.description || item.product?.title || '-' }}</td>
                <td class="py-2 text-center font-mono">{{ item.quantity || 1 }}</td>
                <td class="py-2 text-right font-mono">${{ parseFloat(item.unit_price || item.price_unit || item.price || 0).toFixed(2) }}</td>
                <td class="py-2 text-right font-mono font-weight-bold">${{ parseFloat(item.subtotal || ((item.quantity || 1) * (item.unit_price || 0))).toFixed(2) }}</td>
              </tr>
              <tr v-if="!selectedWorkOrder.items || !selectedWorkOrder.items.length">
                <td colspan="4" class="text-center py-4 text-medium-emphasis">No hay items registrados en la orden</td>
              </tr>
            </tbody>
          </VTable>

          <div class="d-flex justify-end gap-3 align-center pa-2">
            <span class="text-body-1 font-weight-medium">Total de la Orden:</span>
            <span class="text-h6 font-weight-bold font-mono text-primary">${{ getTotalAmount(selectedWorkOrder).toFixed(2) }}</span>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-end gap-2">
          <VBtn color="secondary" variant="outlined" @click="showDetailsDialog = false">
            Cerrar
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-printer-line" @click="printPDF(selectedWorkOrder.id)">
            Imprimir
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal Confirmar Eliminación -->
    <VDialog
      v-model="showDeleteDialog"
      max-width="500"
    >
      <VCard v-if="workOrderToDelete" class="rounded-xl overflow-hidden border elevation-24 bg-surface">
        <div class="pa-5 bg-grey-lighten-5 border-b position-relative">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="position-absolute"
            style="top: 12px; right: 12px;"
            @click="showDeleteDialog = false"
          />
          <div class="d-flex align-center gap-3">
            <VAvatar size="46" color="error" variant="tonal" rounded="xl">
              <VIcon icon="ri-delete-bin-line" size="24" />
            </VAvatar>
            <div>
              <h3 class="text-h6 font-weight-bold text-high-emphasis mb-0">
                Eliminar Orden de Trabajo
              </h3>
              <p class="text-caption text-medium-emphasis mb-0">
                Confirmación de baja de registro
              </p>
            </div>
          </div>
        </div>

        <VCardText class="pa-5">
          ¿Estás seguro de que deseas eliminar permanentemente la orden <strong class="font-mono text-error">{{ formatWorkOrderNumber(workOrderToDelete.number) }}</strong>?
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-end gap-3">
          <VBtn color="secondary" variant="outlined" @click="showDeleteDialog = false">
            Cancelar
          </VBtn>
          <VBtn color="error" variant="elevated" prepend-icon="ri-delete-bin-line" @click="confirmDeleteWorkOrder">
            Sí, Eliminar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal PDF Preview -->
    <VDialog
      v-model="isPdfPreviewDialogVisible"
      max-width="900"
      scrollable
    >
      <VCard class="rounded-xl overflow-hidden border elevation-24 bg-surface">
        <div class="pa-4 bg-grey-lighten-5 border-b d-flex align-center justify-space-between">
          <h3 class="text-h6 font-weight-bold mb-0">
            {{ pdfPreviewTitle }}
          </h3>
          <VBtn icon="ri-close-line" variant="text" size="small" @click="isPdfPreviewDialogVisible = false" />
        </div>
        <VCardText class="pa-0" style="height: 650px;">
          <iframe
            v-if="pdfPreviewUrl"
            :src="pdfPreviewUrl"
            width="100%"
            height="100%"
            style="border: none;"
          />
        </VCardText>
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

.wo-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.license-plate-badge {
  display: inline-block;
  padding: 2px 8px;
  background-color: #f8fafc;
  color: #0f172a;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-weight: 800;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  border: 1.5px solid #0f172a;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.hover-underline:hover {
  text-decoration: underline;
}
</style>
