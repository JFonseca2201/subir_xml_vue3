<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getBrandNameById } from '@/data/vehicleBrands'

const router = useRouter()
const { showNotification } = useGlobalToast()

const isLoading = ref(false)
const workOrders = ref([])
const searchQuery = ref('')
const statusFilter = ref('all')
const selectedWorkOrder = ref(null)
const showDetailsDialog = ref(false)
const loadingOrders = ref(null)

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
  <VContainer class="pa-6">
    <VRow>
      <VCol cols="12">
        <div class="d-flex align-center justify-space-between mb-6">
          <div>
            <div class="d-flex align-center">
              <VIcon
                size="32"
                class="mr-2"
              >
                ri-draft-line
              </VIcon>
              <h1 class="text-h4 font-weight-bold mb-1">
                Órdenes de Trabajo
              </h1>
            </div>
            <p class="text-body-2 text-grey">
              Gestiona y da seguimiento a las órdenes de trabajo
            </p>
          </div>
          <VBtn
            color="primary"
            prepend-icon="ri-add-line"
            size="large"
            @click="goToCreate"
          >
            Nueva Orden
          </VBtn>
        </div>

        <!-- Stats Cards -->
        <VRow class="mb-4">
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VCard class="elevation-2 h-100">
              <VCardText class="pa-4">
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <p class="text-body-2 text-grey mb-1">
                      Total
                    </p>
                    <p class="text-h4 font-weight-bold">
                      {{ stats.total }}
                    </p>
                  </div>
                  <VAvatar
                    size="48"
                    color="primary"
                    variant="tonal"
                  >
                    <VIcon
                      icon="ri-file-list-3-line"
                      size="28"
                    />
                  </VAvatar>
                </div>
              </VCardText>
            </VCard>
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VCard class="elevation-2 h-100">
              <VCardText class="pa-4">
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <p class="text-body-2 text-grey mb-1">
                      Recibidos
                    </p>
                    <p class="text-h4 font-weight-bold">
                      {{ stats.received }}
                    </p>
                  </div>
                  <VAvatar
                    size="48"
                    color="info"
                    variant="tonal"
                  >
                    <VIcon
                      icon="ri-inbox-line"
                      size="28"
                    />
                  </VAvatar>
                </div>
              </VCardText>
            </VCard>
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VCard class="elevation-2 h-100">
              <VCardText class="pa-4">
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <p class="text-body-2 text-grey mb-1">
                      En Progreso
                    </p>
                    <p class="text-h4 font-weight-bold">
                      {{ stats.inProgress }}
                    </p>
                  </div>
                  <VAvatar
                    size="48"
                    color="warning"
                    variant="tonal"
                  >
                    <VIcon
                      icon="ri-loader-4-line"
                      size="28"
                    />
                  </VAvatar>
                </div>
              </VCardText>
            </VCard>
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VCard class="elevation-2 h-100">
              <VCardText class="pa-4">
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <p class="text-body-2 text-grey mb-1">
                      Listos
                    </p>
                    <p class="text-h4 font-weight-bold">
                      {{ stats.ready }}
                    </p>
                  </div>
                  <VAvatar
                    size="48"
                    color="success"
                    variant="tonal"
                  >
                    <VIcon
                      icon="ri-check-double-line"
                      size="28"
                    />
                  </VAvatar>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>

        <!-- Filters -->
        <VCard class="elevation-2 mb-4">
          <VCardText class="pa-4">
            <VRow>
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="searchQuery"
                  label="Buscar orden..."
                  prepend-inner-icon="ri-search-line"
                  variant="outlined"
                  clearable
                  hide-details
                  placeholder="Número, cliente o vehículo"
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VSelect
                  v-model="statusFilter"
                  :items="statusOptions"
                  label="Filtrar por estado"
                  variant="outlined"
                  hide-details
                  prepend-inner-icon="ri-filter-3-line"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <!-- Work Orders List -->
        <div
          v-if="!isLoading && filteredWorkOrders.length > 0"
          class="work-orders-container"
        >
          <!-- Encabezados de Columnas -->
          <div
            class="d-none d-md-flex align-center px-4 py-2 gap-4 text-caption text-grey font-weight-bold text-uppercase"
            style="letter-spacing: 0.5px;"
          >
            <div style="width: 100px" />
            <div style="width: 120px">
              Estado
            </div>
            <div class="flex-grow-1">
              Descripción
            </div>
            <div
              style="width: 120px"
              class="text-right"
            >
              Total
            </div>
            <div
              style="width: 100px"
              class="text-right"
            >
              Acciones
            </div>
          </div>

          <div class="d-flex flex-column gap-3">
            <VCard
              v-for="workOrder in filteredWorkOrders"
              :key="workOrder.id"
              class="work-order-card position-relative overflow-hidden rounded-lg"
              elevation="1"
            >
              <div class="d-flex flex-column flex-md-row h-100">
                <!-- Contenedor del Ícono (Izquierda, alto completo) -->
                <div
                  class="d-flex flex-column align-center justify-center pa-4 transition-colors duration-300"
                  :class="[statusBgClasses[workOrder.status], canAdvance(workOrder) ? 'cursor-pointer hover-effect' : '']"
                  style="min-width: 100px; border-right: 1px solid rgba(0,0,0,0.05);"
                  @click="handleStatusClick(workOrder)"
                >
                  <VIcon
                    size="32" 
                    :color="statusColors[workOrder.status]" 
                    :class="statusAnimations[workOrder.status]"
                  >
                    {{ getDynamicIcon(workOrder) }}
                  </VIcon>
                  <span
                    class="font-weight-bold mt-2 text-center" 
                    :class="`text-${statusColors[workOrder.status]}`" 
                    style="font-size: 0.70rem !important; line-height: 1.1;"
                  >
                    {{ getDynamicLegend(workOrder) }}
                  </span>
                </div>

                <!-- Contenido de la fila -->
                <div class="d-flex flex-grow-1 align-center pa-4 gap-4 flex-wrap flex-md-nowrap">
                  <!-- Estado -->
                  <div
                    style="width: 120px"
                    class="d-flex flex-column align-center align-md-start"
                  >
                    <VChip
                      size="small"
                      :color="statusColors[workOrder.status]"
                      label
                      class="status-chip mt-1"
                    >
                      {{ statusLabels[workOrder.status] }}
                    </VChip>
                  </div>
                                    
                  <!-- Descripción -->
                  <div class="d-flex flex-column flex-grow-1 justify-center py-2">
                    <!-- Linea 1: Numero de Orden y Fecha -->
                    <div class="d-flex justify-space-between align-center mb-2">
                      <span class="text-h6 font-weight-bold text-blue-grey-darken-2">{{ workOrder.number }}</span>
                      <div class="d-flex align-center gap-1 text-caption text-grey">
                        <VIcon
                          icon="ri-calendar-event-line"
                          size="14"
                        />
                        <span>{{ new Date(workOrder.created_at).toLocaleDateString() }}</span>
                      </div>
                    </div>

                    <!-- Linea 2: Cliente y Vehiculo -->
                    <div class="d-flex align-center gap-3 text-body-2 text-grey-darken-3">
                      <div
                        class="d-flex align-center gap-2 text-truncate"
                        style="min-width: 0;"
                      >
                        <VIcon
                          icon="ri-user-line"
                          size="16"
                        />
                        <span class="font-weight-medium text-truncate">{{ getClientName(workOrder.client) }}</span>
                      </div>
                      <VDivider
                        vertical
                        class="mx-2"
                      />
                      <div
                        class="d-flex align-center gap-2 text-truncate"
                        style="min-width: 0;"
                      >
                        <VIcon
                          icon="ri-car-line"
                          size="16"
                        />
                        <span
                          class="text-truncate"
                          style="text-transform: uppercase;"
                        >{{ getVehicleInfo(workOrder.vehicle) }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Total -->
                  <div
                    style="width: 120px"
                    class="text-md-right"
                  >
                    <span class="text-h6 font-weight-bold text-primary">${{ getTotalAmount(workOrder).toFixed(2) }}</span>
                  </div>

                  <!-- Acciones -->
                  <div
                    style="width: 100px"
                    class="d-flex align-center justify-md-end gap-1"
                  >
                    <VBtn
                      v-if="workOrder.status === 'draft'"
                      icon="ri-edit-2-line"
                      size="small"
                      variant="text"
                      color="secondary"
                      @click="goToEdit(workOrder.id)"
                    />
                    <VBtn
                      v-if="workOrder.sale"
                      icon="ri-file-pdf-line"
                      size="small"
                      variant="text"
                      color="grey"
                      @click="downloadPDF(workOrder.id)"
                    />
                    <VBtn
                      icon="ri-eye-line"
                      size="small"
                      variant="text"
                      color="grey"
                      @click="viewDetails(workOrder)"
                    />
                  </div>
                </div>
              </div>
              <!-- Progress Bar -->
              <VProgressLinear
                v-if="loadingOrders === workOrder.id"
                indeterminate
                color="primary"
                absolute
                location="bottom"
                class="position-absolute bottom-0 w-100"
                height="4"
              />
            </VCard>
          </div>
        </div>

        <div
          v-else-if="isLoading"
          class="text-center pa-12"
        >
          <VProgressCircular
            indeterminate
            color="primary"
            size="64"
          />
          <p class="mt-4 text-body-2 text-grey">
            Cargando órdenes de trabajo...
          </p>
        </div>

        <div
          v-else
          class="text-center pa-12"
        >
          <VIcon
            icon="ri-file-list-3-line"
            size="96"
            color="grey-lighten-1"
          />
          <p class="mt-4 text-h6 text-grey">
            No hay órdenes de trabajo registradas
          </p>
          <p class="text-body-2 text-grey mb-4">
            Comienza creando una nueva orden de trabajo
          </p>
          <VBtn
            color="primary"
            prepend-icon="ri-add-line"
            @click="goToCreate"
          >
            Crear Primera Orden
          </VBtn>
        </div>
      </VCol>
    </VRow>

    <!-- Details Dialog -->
    <VDialog
      v-model="showDetailsDialog"
      max-width="800"
    >
      <VCard v-if="selectedWorkOrder">
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-file-list-3-line" />
            <span>Detalles de Orden #{{ selectedWorkOrder.number }}</span>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            @click="showDetailsDialog = false"
          />
        </VCardTitle>
        <VDivider />
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
          <p
            v-else
            class="text-body-2 text-grey"
          >
            No hay items en esta orden
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            prepend-icon="ri-close-line"
            @click="showDetailsDialog = false"
          >
            Cerrar
          </VBtn>
          <VBtn
            v-if="selectedWorkOrder.status === 'ready' && !selectedWorkOrder.sale"
            color="primary"
            prepend-icon="ri-shopping-cart-line"
            @click="goToSale(selectedWorkOrder.id)"
          >
            Generar Venta
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VContainer>
</template>

<style scoped>
.work-order-card {
    transition: all 0.2s ease;
}

.work-order-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
}

.cursor-pointer {
    cursor: pointer;
}

.hover-effect:hover {
    filter: brightness(0.92);
    transition: filter 0.2s ease;
}

.status-btn {
    border-radius: 8px;
    transition: all 0.2s ease;
}

.status-btn:hover {
    transform: scale(1.15);
}

.status-chip {
    font-size: 10px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.halo-active {
    border-radius: 50%;
    animation: green-halo 2s infinite;
}

@keyframes green-halo {
    0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
    70% { box-shadow: 0 0 0 15px rgba(76, 175, 80, 0); }
    100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
}
</style>
