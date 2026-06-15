<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getBrandNameById } from '@/data/vehicleBrands'
import WorkOrderTimelineDialog from '@/components/dialogs/WorkOrderTimelineDialog.vue'

const router = useRouter()
const { showNotification } = useGlobalToast()

const showTimelineDialog = ref(false)
const selectedTimelineOrder = ref(null)

const openTimeline = (workOrder) => {
  selectedTimelineOrder.value = workOrder
  showTimelineDialog.value = true
}

const isLoading = ref(false)
const workOrders = ref([])
const searchQuery = ref('')
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

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
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

const groupedWorkOrders = computed(() => {
  const groups = {}
  paginatedWorkOrders.value.forEach(wo => {
    const dateStr = wo.created_at ? wo.created_at.split(' ')[0] : 'N/A'
    if (!groups[dateStr]) {
      groups[dateStr] = []
    }
    groups[dateStr].push(wo)
  })
  return groups
})

const formatDateGroup = (dateStr) => {
  if (dateStr === 'N/A') return 'Sin Fecha'
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

watch([searchQuery, statusFilter], () => {
  currentPage.value = 1
})

const loadWorkOrders = async () => {
  isLoading.value = true
  try {
    const response = await $api('work-orders')

    workOrders.value = response.data || []
  } catch (error) {
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
  return ['received', 'in_progress'].includes(workOrder.status) || (workOrder.status === 'ready' && !workOrder.sale)
}

const handleStatusClick = workOrder => {
  openTimeline(workOrder)
}

// Obtiene el ícono dinámico basado en la venta de la orden
const getDynamicIcon = workOrder => {
  if (workOrder.status === 'ready' && !workOrder.sale) return 'ri-shopping-cart-line'
  if (workOrder.status === 'ready' && workOrder.sale) return 'ri-check-double-line'

  return statusIcons[workOrder.status]
}

// Obtiene la leyenda dinámica que va debajo del ícono
const getDynamicLegend = workOrder => {
  if (workOrder.status === 'ready' && !workOrder.sale) return 'Facturar'
  if (workOrder.status === 'ready' && workOrder.sale) return 'Facturado'

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

const goToEdit = workOrderId => {
  router.push(`/work-orders/edit/${workOrderId}`)
}

const downloadPDF = async workOrderId => {
  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

    const response = await fetch(`${apiBaseUrl}/work-orders/${workOrderId}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
      },
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')

      a.href = url
      a.download = `orden-trabajo-${workOrderId}.pdf`
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
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
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
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-draft-line" color="primary" class="me-2" size="28" />
          Órdenes de Trabajo
        </h1>
        <p class="text-medium-emphasis mb-0">
          Gestiona y da seguimiento a las órdenes de trabajo del taller
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="primary" prepend-icon="ri-add-line" to="/work-orders/add">
          Nueva Orden
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VForm @submit.prevent="loadWorkOrders">
          <VRow class="align-center">
            <VCol cols="12" md="6">
              <VTextField v-model="searchQuery" label="Buscar orden"
                placeholder="Número, cliente o placa del vehículo..." prepend-inner-icon="ri-search-line"
                variant="outlined" density="comfortable" hide-details="auto" clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="3">
              <VSelect v-model="statusFilter" :items="statusOptions" item-title="title" item-value="value"
                label="Estado" placeholder="Todos" prepend-inner-icon="ri-filter-3-line" variant="outlined"
                density="comfortable" hide-details="auto" clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="3">
              <VBtn color="primary" variant="tonal" prepend-icon="ri-refresh-line" block @click="loadWorkOrders">
                Actualizar
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <!-- Listado de Órdenes de Trabajo (Tarjetas Agrupadas por Día) -->
      <div class="position-relative bg-white">
        <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div v-if="isLoading" class="text-center pa-12">
          <VProgressCircular indeterminate color="primary" size="40" />
          <div class="mt-2 text-medium-emphasis">
            Cargando registros...
          </div>
        </div>

        <div v-else-if="!filteredWorkOrders || filteredWorkOrders.length === 0"
          class="text-center pa-12 text-medium-emphasis">
          <VIcon size="48" class="mb-3" color="grey-lighten-1">
            ri-file-text-line
          </VIcon>
          <div class="text-h6">
            No se encontraron órdenes de trabajo
          </div>
          <div class="text-body-2">
            Intenta ajustar los filtros de búsqueda
          </div>
        </div>

        <div v-else class="pa-5">
          <div v-for="date in Object.keys(groupedWorkOrders)" :key="date" class="mb-6">
            <!-- Cabecera de Grupo por Día -->
            <div class="date-group-header d-flex align-center my-4">
              <VIcon icon="ri-calendar-event-line" color="primary" class="me-2" size="20" />
              <span class="text-subtitle-1 font-weight-bold text-grey-darken-3 text-capitalize">
                {{ formatDateGroup(date) }}
              </span>
              <VDivider class="ms-3" />
            </div>

            <!-- Tarjetas del Día -->
            <VRow>
              <VCol v-for="workOrder in groupedWorkOrders[date]" :key="workOrder.id" cols="12" sm="6" md="4"
                class="d-flex">
                <VCard
                  class="w-100 rounded-lg border-light border overflow-hidden elevation-1 hover-shadow transition-all d-flex flex-column">
                  <!-- Cabecera de la Tarjeta -->
                  <VCardText
                    class="pa-3 bg-grey-lighten-5 border-bottom-light d-flex justify-space-between align-center flex-wrap gap-2">
                    <div class="d-flex align-center gap-2">
                      <span class="text-subtitle-2 font-weight-bold text-primary cursor-pointer hover-underline"
                        @click="viewDetails(workOrder)">
                        {{ workOrder.number }}
                      </span>
                      <span class="text-caption text-medium-emphasis">
                        {{ workOrder.created_at ? new Date(workOrder.created_at.replace(' ',
                          'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A' }}
                      </span>
                    </div>

                    <!-- Estado Interactivo -->
                    <div class="cursor-pointer d-flex align-center" @click="handleStatusClick(workOrder)"
                      style="user-select: none;">
                      <VChip :color="statusColors[workOrder.status]" variant="tonal" size="small"
                        class="font-weight-bold" label>
                        <VProgressCircular v-if="loadingOrders === workOrder.id" indeterminate size="14" width="2"
                          class="me-1" />
                        <VIcon v-else :icon="getDynamicIcon(workOrder)" size="14" class="me-1" />
                        {{ getDynamicLegend(workOrder) }}
                      </VChip>
                    </div>
                  </VCardText>

                  <!-- Cuerpo de la Tarjeta -->
                  <VCardText class="pa-3 flex-grow-1">
                    <div class="d-flex flex-column gap-2">
                      <!-- Cliente -->
                      <div class="d-flex align-start gap-2">
                        <VAvatar color="info" variant="tonal" size="28" class="mt-0">
                          <VIcon icon="ri-user-line" size="15" />
                        </VAvatar>
                        <div class="overflow-hidden w-100">
                          <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold"
                            style="font-size: 0.65rem; letter-spacing: 0.5px;">Cliente</div>
                          <div class="text-body-2 font-weight-semibold text-grey-darken-4 text-truncate"
                            :title="getClientName(workOrder.client)">
                            {{ getClientName(workOrder.client) }}
                          </div>
                          <div v-if="workOrder.client?.n_document" class="text-caption text-medium-emphasis">
                            Doc: {{ workOrder.client.n_document }}
                          </div>
                        </div>
                      </div>

                      <!-- Vehículo -->
                      <div v-if="workOrder.vehicle" class="d-flex align-start gap-2">
                        <VAvatar color="primary" variant="tonal" size="28" class="mt-0">
                          <VIcon icon="ri-car-line" size="15" />
                        </VAvatar>
                        <div class="overflow-hidden w-100">
                          <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold"
                            style="font-size: 0.65rem; letter-spacing: 0.5px;">Vehículo</div>
                          <div class="text-body-2 font-weight-bold text-primary text-truncate">
                            {{ workOrder.vehicle.license_plate }}
                          </div>
                          <div class="text-caption text-medium-emphasis text-truncate"
                            :title="getVehicleInfo(workOrder.vehicle)">
                            {{ getVehicleInfo(workOrder.vehicle) }}
                          </div>
                        </div>
                      </div>

                      <!-- Total -->
                      <div class="d-flex align-start gap-2">
                        <VAvatar color="success" variant="tonal" size="28" class="mt-0">
                          <VIcon icon="ri-money-dollar-circle-line" size="15" />
                        </VAvatar>
                        <div>
                          <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold"
                            style="font-size: 0.65rem; letter-spacing: 0.5px;">Total</div>
                          <div class="text-subtitle-1 font-weight-bold text-success">
                            ${{ getTotalAmount(workOrder).toFixed(2) }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </VCardText>

                  <VDivider />

                  <!-- Acciones -->
                  <VCardActions class="pa-2 justify-end bg-grey-lighten-5 mt-auto">
                    <VBtn variant="text" color="info" prepend-icon="ri-eye-line" size="small"
                      class="text-none font-weight-bold action-btn" @click="viewDetails(workOrder)">
                      Ver Detalle
                    </VBtn>

                    <VBtn variant="text" color="warning" prepend-icon="ri-edit-line" size="small"
                      class="text-none font-weight-bold action-btn" @click="goToEdit(workOrder.id)">
                      Editar
                    </VBtn>

                    <!-- Menú desplegable -->
                    <VBtn variant="text" color="secondary" prepend-icon="ri-more-2-line" size="small"
                      class="text-none font-weight-bold action-btn">
                      Más
                      <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                        <VList density="compact" class="py-1">
                          <VListItem prepend-icon="ri-time-line" title="Ver Secuencia" class="text-secondary text-body-2" @click="openTimeline(workOrder)" />
                          <VDivider class="my-1" />
                          <VListItem v-if="workOrder.status === 'ready' && !workOrder.sale"
                            prepend-icon="ri-shopping-cart-line" title="Generar Venta" class="text-success text-body-2"
                            @click="goToSale(workOrder.id)" />
                          <VListItem v-if="workOrder.status !== 'draft'" prepend-icon="ri-printer-line"
                            title="Imprimir Orden" class="text-info text-body-2" @click="printPDF(workOrder.id)" />

                          <VListItem v-if="workOrder.status !== 'draft'" prepend-icon="ri-file-pdf-line"
                            title="Descargar PDF" class="text-primary text-body-2" @click="downloadPDF(workOrder.id)" />
                          <VDivider class="my-1" />
                          <VListItem prepend-icon="ri-delete-bin-line" title="Eliminar Orden"
                            class="text-error text-body-2" @click="deleteWorkOrder(workOrder)" />
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
            Mostrando <span class="font-weight-bold">{{ paginatedWorkOrders.length }}</span> de <span
              class="font-weight-bold">{{ filteredWorkOrders.length }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Details Dialog -->
    <VDialog v-model="showDetailsDialog" max-width="800">
      <VCard v-if="selectedWorkOrder">
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-file-list-3-line" />
            <span>Detalles de Orden #{{ selectedWorkOrder.number }}</span>
          </div>
          <VBtn icon="ri-close-line" variant="text" @click="showDetailsDialog = false" />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VRow>
            <VCol cols="12" md="6">
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon icon="ri-user-line" size="18" />
                <span class="text-body-2">Cliente</span>
              </div>
              <p class="text-body-1 font-weight-medium">
                {{ getClientName(selectedWorkOrder.client) }}
              </p>
            </VCol>
            <VCol cols="12" md="6">
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon icon="ri-car-line" size="18" />
                <span class="text-body-2">Vehículo</span>
              </div>
              <p class="text-body-1 font-weight-medium">
                {{ getVehicleInfo(selectedWorkOrder.vehicle) }}
              </p>
            </VCol>
            <VCol cols="12" md="6">
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon icon="ri-dashboard-3-line" size="18" />
                <span class="text-body-2">Kilometraje</span>
              </div>
              <p class="text-body-1 font-weight-medium">
                {{ selectedWorkOrder.mileage || 'N/A' }} km
              </p>
            </VCol>
            <VCol cols="12" md="6">
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon icon="ri-information-line" size="18" />
                <span class="text-body-2">Estado</span>
              </div>
              <VChip :color="statusColors[selectedWorkOrder.status]" size="small" label>
                <VIcon start :icon="statusIcons[selectedWorkOrder.status]" size="14" />
                {{ statusLabels[selectedWorkOrder.status] }}
              </VChip>
            </VCol>
          </VRow>

          <VDivider class="my-4" />

          <div class="d-flex align-center gap-2 mb-3">
            <VIcon icon="ri-list-check" size="24" />
            <span class="text-h6 font-weight-bold">Items</span>
          </div>
          <div v-if="selectedWorkOrder.items && selectedWorkOrder.items.length > 0" class="work-order-items-table-wrap">
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
                <tr v-for="item in selectedWorkOrder.items" :key="item.id">
                  <td>{{ item.description }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>${{ parseFloat(item.unit_price).toFixed(2) }}</td>
                  <td>${{ parseFloat(item.discount).toFixed(2) }}</td>
                  <td>${{ parseFloat(item.subtotal).toFixed(2) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" class="text-right font-weight-bold">
                    Total:
                  </td>
                  <td class="font-weight-bold">
                    ${{ getTotalAmount(selectedWorkOrder).toFixed(2) }}
                  </td>
                </tr>
              </tfoot>
            </VTable>
          </div>
          <p v-else class="text-body-2 text-grey">
            No hay items en esta orden
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="grey" variant="text" prepend-icon="ri-close-line" @click="showDetailsDialog = false">
            Cerrar
          </VBtn>
          <VBtn v-if="selectedWorkOrder.status !== 'draft'" color="info" variant="tonal" prepend-icon="ri-printer-line"
            @click="printPDF(selectedWorkOrder.id)">
            Imprimir
          </VBtn>

          <VBtn v-if="selectedWorkOrder.status !== 'draft'" color="primary" variant="tonal"
            prepend-icon="ri-file-pdf-line" @click="downloadPDF(selectedWorkOrder.id)">
            Descargar PDF
          </VBtn>
          <VBtn v-if="selectedWorkOrder.status === 'ready' && !selectedWorkOrder.sale" color="success"
            prepend-icon="ri-shopping-cart-line" @click="goToSale(selectedWorkOrder.id)">
            Generar Venta
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Delete Confirmation Dialog -->
    <VDialog v-model="showDeleteDialog" max-width="500">
      <VCard>
        <VCardTitle class="text-h5">
          Confirmar Eliminación
        </VCardTitle>
        <VCardText>
          <p class="text-body-1">
            ¿Estás seguro de eliminar la orden de trabajo <strong>#{{ workOrderToDelete?.number }}</strong>?
          </p>
          <p class="text-body-2 text-grey-darken-1 mt-2">
            Esta acción no se puede deshacer.
          </p>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn color="grey" variant="text" @click="showDeleteDialog = false">
            Cancelar
          </VBtn>
          <VBtn color="error" @click="confirmDeleteWorkOrder">
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
  </div>
</template>
