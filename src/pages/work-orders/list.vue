<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getBrandNameById } from '@/data/vehicleBrands'
import ClientShowDialog from '@/components/inventory/clients/ClientShowDialog.vue'
import VehicleShowDialog from '@/components/inventory/vehicles/VehicleShowDialog.vue'

const router = useRouter()
const { showNotification } = useGlobalToast()

const isLoading = ref(false)
const workOrders = ref([])
const searchQuery = ref('')
const statusFilter = ref('all')
const selectedWorkOrder = ref(null)
const showDetailsDialog = ref(false)
const loadingOrders = ref(null)
const showDeleteDialog = ref(false)
const workOrderToDelete = ref(null)

const isClientDialogVisible = ref(false)
const selectedClient = ref({})
const isVehicleDialogVisible = ref(false)
const selectedVehicle = ref({})

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

    filtered = filtered.filter(wo =>
      wo.number?.toLowerCase().includes(query) ||
      wo.client?.full_name?.toLowerCase().includes(query) ||
      wo.vehicle?.license_plate?.toLowerCase().includes(query),
    )
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
    await $api(`work-orders/${workOrderId}/status`, {
      method: 'PUT',
      body: { status: newStatus },
    })

    showNotification('Estado actualizado exitosamente', 'success')
    loadWorkOrders()
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
  if (loadingOrders.value === workOrder.id) return // Evitar clicks múltiples mientras carga
  if (workOrder.status === 'received') {
    updateStatus(workOrder.id, 'in_progress')
  } else if (workOrder.status === 'in_progress') {
    updateStatus(workOrder.id, 'ready')
  } else if (workOrder.status === 'ready' && !workOrder.sale) {
    goToSale(workOrder.id)
  }
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

    const response = await fetch(`http://127.0.0.1:8000/api/work-orders/${workOrderId}/pdf`, {
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

const showClientDetails = async (client) => {
  if (!client || !client.id) return
  try {
    const response = await $api(`clients/${client.id}`)
    selectedClient.value = response.client || response.data || client
    isClientDialogVisible.value = true
  } catch (error) {
    console.error('Error fetching client details:', error)
    selectedClient.value = client
    isClientDialogVisible.value = true
  }
}

const showVehicleDetails = async (vehicle) => {
  if (!vehicle || !vehicle.id) return
  try {
    const response = await $api(`vehicles/${vehicle.id}`)
    selectedVehicle.value = response.vehicle || response.data || vehicle
    isVehicleDialogVisible.value = true
  } catch (error) {
    console.error('Error fetching vehicle details:', error)
    selectedVehicle.value = vehicle
    isVehicleDialogVisible.value = true
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
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-draft-line" color="primary" class="me-2" size="28" />
          Órdenes de Trabajo
        </h1>
        <p class="text-medium-emphasis mb-0">
          Gestiona y da seguimiento a las órdenes de trabajo del taller
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
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
              <VBtn color="primary" variant="tonal" prepend-icon="ri-refresh-line" @click="loadWorkOrders" block>
                Actualizar
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <!-- Tabla de Órdenes de Trabajo -->
      <div class="position-relative">
        <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div class="overflow-x-auto">
          <VTable hover class="work-orders-table">
            <thead>
              <tr>
                <th class="text-center font-weight-bold text-uppercase" style="width: 120px;">
                  ESTADO
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 135px;">
                  N°/FECHA
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 180px;">
                  CLIENTE
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">
                  VEHÍCULO
                </th>
                <th class="text-right font-weight-bold text-uppercase" style="width: 100px;">
                  TOTAL
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody v-if="isLoading">
              <tr>
                <td colspan="6" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">
                    Cargando registros...
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!filteredWorkOrders || filteredWorkOrders.length === 0">
              <tr>
                <td colspan="6" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">
                    ri-file-text-line
                  </VIcon>
                  <div class="text-h6">
                    No se encontraron órdenes de trabajo
                  </div>
                  <div class="text-body-2">
                    Intenta ajustar los filtros de búsqueda
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else style="text-transform: uppercase;">
              <tr v-for="(workOrder, index) in filteredWorkOrders"
                :key="workOrder?.id ? `wo-${workOrder.id}` : `wo-idx-${index}`" class="work-orders-row align-middle">
                <td class="text-no-wrap text-center py-3">
                  <div v-if="workOrder" class="d-flex flex-column align-center gap-1 cursor-pointer"
                    @click="handleStatusClick(workOrder)">
                    <!-- Estado General con Icono -->
                    <div class="d-flex align-center gap-1">
                      <VIcon :icon="statusIcons[workOrder.status]" size="16" :color="statusColors[workOrder.status]" />
                      <span class="text-body-2 font-weight-bold text-grey-darken-3">{{ statusLabels[workOrder.status]
                        }}</span>
                    </div>
                  </div>
                </td>

                <td class="text-no-wrap text-left py-3">
                  <div v-if="workOrder" class="d-flex flex-column align-start">
                    <span class="font-weight-bold text-subtitle-1 text-primary">{{ workOrder.number }}</span>
                    <span class="text-body-2 text-medium-emphasis d-flex align-center mt-1">
                      <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                      {{ new Date(workOrder.created_at).toLocaleDateString() }}
                    </span>
                  </div>
                </td>

                <td class="text-left py-3" style="max-width: 400px;">
                  <div v-if="workOrder">
                    <div class="font-weight-semibold text-truncate text-body-1 text-grey-darken-4 clickable-link"
                      :title="getClientName(workOrder.client)"
                      @click="showClientDetails(workOrder.client)">
                      {{ getClientName(workOrder.client) }}
                    </div>
                    <div v-if="workOrder.client?.n_document" class="text-body-2 text-medium-emphasis mt-1">
                      Doc: {{ workOrder.client.n_document }}
                    </div>
                  </div>
                </td>

                <td class="text-left py-3" style="max-width: 300px;">
                  <div v-if="workOrder?.vehicle" class="d-flex flex-column">
                    <div class="font-weight-bold text-body-1 text-truncate text-primary clickable-link"
                      :title="workOrder.vehicle.license_plate"
                      @click="showVehicleDetails(workOrder.vehicle)">
                      {{ workOrder.vehicle.license_plate }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis text-truncate mt-1"
                      :title="getVehicleInfo(workOrder.vehicle)">
                      {{ getVehicleInfo(workOrder.vehicle) }}
                    </div>
                  </div>
                  <span v-else class="text-medium-emphasis text-body-2">-</span>
                </td>

                <td class="text-no-wrap text-right py-3">
                  <div v-if="workOrder" class="font-weight-bold text-subtitle-1 text-grey-darken-4">
                    ${{ getTotalAmount(workOrder).toFixed(2) }}
                  </div>
                </td>

                <td class="text-no-wrap text-center py-3">
                  <div v-if="workOrder" class="d-flex justify-center align-center">
                    <!-- Ver Detalle (Acción rápida) -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver Detalle"
                      @click="viewDetails(workOrder)">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>

                    <!-- Editar -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="warning" title="Editar Orden"
                      @click="goToEdit(workOrder.id)">
                      <VIcon icon="ri-edit-line" size="20" />
                    </VBtn>

                    <!-- Más Acciones (Dropdown) -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="secondary" title="Acciones">
                      <VIcon icon="ri-more-2-line" size="20" />
                      <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                        <VList density="compact" class="py-1">
                          <VListItem v-if="workOrder.status === 'ready' && !workOrder.sale"
                            prepend-icon="ri-shopping-cart-line" title="Generar Venta" class="text-success text-body-2"
                            @click="goToSale(workOrder.id)" />
                          <VListItem v-if="workOrder.sale" prepend-icon="ri-file-pdf-line" title="Descargar PDF"
                            class="text-primary text-body-2" @click="downloadPDF(workOrder.id)" />
                          <VDivider class="my-1" />
                          <VListItem prepend-icon="ri-delete-bin-line" title="Eliminar Orden"
                            class="text-error text-body-2" @click="deleteWorkOrder(workOrder)" />
                        </VList>
                      </VMenu>
                    </VBtn>
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
            Mostrando <span class="font-weight-bold">{{ filteredWorkOrders.length }}</span> registros
          </div>
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
              <p class="text-body-1 font-weight-medium clickable-link" @click="showClientDetails(selectedWorkOrder.client)">
                {{ getClientName(selectedWorkOrder.client) }}
              </p>
            </VCol>
            <VCol cols="12" md="6">
              <div class="d-flex align-center gap-1 mb-1 text-grey">
                <VIcon icon="ri-car-line" size="18" />
                <span class="text-body-2">Vehículo</span>
              </div>
              <p class="text-body-1 font-weight-medium clickable-link" @click="showVehicleDetails(selectedWorkOrder.vehicle)">
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
          <VTable v-if="selectedWorkOrder.items && selectedWorkOrder.items.length > 0">
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
          <VBtn v-if="selectedWorkOrder.status === 'ready' && !selectedWorkOrder.sale" color="primary"
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

    <!-- Client Details Dialog -->
    <ClientShowDialog
      v-if="isClientDialogVisible"
      v-model:isDialogVisible="isClientDialogVisible"
      :client-data="selectedClient"
    />

    <!-- Vehicle Details Dialog -->
    <VehicleShowDialog
      v-if="isVehicleDialogVisible"
      v-model:isDialogVisible="isVehicleDialogVisible"
      :vehicle-data="selectedVehicle"
    />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de órdenes de trabajo */
.work-orders-table :deep(thead) {
  background-color: #f8fafc !important;
}

.work-orders-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.work-orders-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.work-orders-row:hover {
  background-color: #f8fafc !important;
}

.action-btn {
  transition: all 0.2s ease;
  border-radius: 6px !important;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}

.clickable-link {
  cursor: pointer;
  color: rgb(var(--v-theme-primary)) !important;
  transition: opacity 0.2s ease;
}

.clickable-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}
</style>
