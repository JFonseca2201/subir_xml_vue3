<script setup>
import { ref, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { vehicleBrands } from '@/data/vehicleBrands.js'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'select-order',
])

const { showNotification } = useGlobalToast()

const readyWorkOrders = ref([])
const isLoadingWorkOrders = ref(false)
const workOrderSearchQuery = ref('')

const loadReadyWorkOrders = async () => {
  isLoadingWorkOrders.value = true
  try {
    const response = await $api('work-orders/ready-to-invoice')
    readyWorkOrders.value = response?.data || []
  } catch (error) {
    console.error('Error al cargar órdenes listas:', error)
    showNotification('Error al cargar las órdenes listas para facturar', 'error')
  } finally {
    isLoadingWorkOrders.value = false
  }
}

watch(() => props.isDialogVisible, val => {
  if (val) {
    workOrderSearchQuery.value = ''
    loadReadyWorkOrders()
  }
})

// Formatear número de OT evitando duplicar prefijos (ej: OT-OT-001 -> OT-001)
const formatOtNumber = order => {
  if (!order) return 'OT-0'
  const num = String(order.number || order.id || '').trim()
  if (num.toUpperCase().startsWith('OT-') || num.toUpperCase().startsWith('OT')) {
    return num.toUpperCase()
  }
  return `OT-${num}`
}

// Obtener nombre de la marca por ID o string
const getBrandName = brand => {
  if (!brand) return ''
  return vehicleBrands[brand] || vehicleBrands[String(brand)] || brand
}

// Obtener nombre del cliente de forma segura
const getClientName = client => {
  if (!client) return 'Consumidor Final'
  if (client.full_name && client.full_name.trim()) return client.full_name.trim()
  const name = `${client.name || ''} ${client.surname || ''}`.trim()
  return name || client.n_document || 'Cliente'
}

// Obtener placa del vehículo
const getVehiclePlate = vehicle => {
  return (vehicle?.license_plate || vehicle?.plate || '').trim().toUpperCase() || 'SIN PLACA'
}

// Obtener descripción del vehículo
const getVehicleDescription = vehicle => {
  if (!vehicle) return 'Vehículo no especificado'
  const brand = getBrandName(vehicle.brand)
  const model = vehicle.model || ''
  const year = vehicle.year ? `(${vehicle.year})` : ''
  const color = vehicle.color ? `• ${vehicle.color}` : ''
  return `${brand} ${model} ${year} ${color}`.trim() || 'Vehículo sin detalles'
}

// Obtener nombre / descripción limpia del ítem
const getItemDescription = item => {
  return item?.description || item?.product?.title || item?.product?.name || 'Servicio / Repuesto'
}

// Obtener subtotal de un ítem
const getItemSubtotal = item => {
  const qty = parseFloat(item?.quantity) || 0
  const price = parseFloat(item?.unit_price || item?.price) || 0
  const discount = parseFloat(item?.discount) || 0
  return qty * price - discount
}

// Formatear fecha de la OT
const formatDate = dateStr => {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) {
      const parts = String(dateStr).split(' ')[0].split('-')
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
      return dateStr
    }
    return d.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch (e) {
    return dateStr
  }
}

// Formatear moneda USD
const formatCurrency = val => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(val || 0)
}

// Calcular total estimado de la OT
const calculateOrderTotal = order => {
  if (!order?.items || !Array.isArray(order.items)) return 0
  return order.items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price || item.price) || 0
    const discount = parseFloat(item.discount) || 0
    return sum + (qty * price - discount)
  }, 0)
}

// Órdenes filtradas por búsqueda
const filteredWorkOrders = computed(() => {
  if (!workOrderSearchQuery.value) return readyWorkOrders.value

  const query = workOrderSearchQuery.value.toLowerCase().trim()

  return readyWorkOrders.value.filter(order => {
    const idMatch = String(order.id).includes(query)
    const numberMatch = String(order.number || '').toLowerCase().includes(query)
    const clientName = getClientName(order.client).toLowerCase()
    const clientDoc = String(order.client?.n_document || '').toLowerCase()
    const licensePlate = getVehiclePlate(order.vehicle).toLowerCase()
    const brand = String(getBrandName(order.vehicle?.brand) || '').toLowerCase()
    const model = String(order.vehicle?.model || '').toLowerCase()

    // Búsqueda en descripciones de ítems
    const itemsMatch = order.items?.some(it => getItemDescription(it).toLowerCase().includes(query))

    return (
      idMatch ||
      numberMatch ||
      clientName.includes(query) ||
      clientDoc.includes(query) ||
      licensePlate.includes(query) ||
      brand.includes(query) ||
      model.includes(query) ||
      itemsMatch
    )
  })
})

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const handleSelectOrder = order => {
  emit('select-order', order)
  closeDialog()
}
</script>

<template>
  <VDialog
    :model-value="isDialogVisible"
    scrollable
    max-width="950px"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card rounded-xl elevation-12">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-file-download-line" />
        </div>
        <h3 class="custom-dialog-title">
          Importar Orden de Trabajo
        </h3>
        <p class="custom-dialog-subtitle">
          Selecciona una orden de trabajo finalizada para facturarla
        </p>
      </div>

      <VCardText class="pa-4 pa-sm-5 bg-grey-lighten-5">
        <!-- Buscador y Contador -->
        <div class="mb-4 d-flex align-center justify-space-between flex-wrap gap-3">
          <VTextField
            v-model="workOrderSearchQuery"
            placeholder="Buscar por placa, cliente, RUC/Cédula, número de OT, vehículo o repuesto..."
            prepend-inner-icon="ri-search-line"
            variant="outlined"
            density="compact"
            bg-color="white"
            class="rounded-lg flex-grow-1"
            hide-details
            clearable
            style="min-width: 280px;"
          />
          <div class="d-flex align-center gap-2">
            <VChip
              color="primary"
              variant="tonal"
              size="small"
              class="font-weight-bold"
            >
              <VIcon icon="ri-check-double-line" size="14" class="me-1" />
              {{ filteredWorkOrders.length }} {{ filteredWorkOrders.length === 1 ? 'orden lista' : 'órdenes listas' }}
            </VChip>
          </div>
        </div>

        <!-- Estado de Carga -->
        <div v-if="isLoadingWorkOrders" class="text-center py-12 bg-white rounded-xl border-light">
          <VProgressCircular indeterminate color="primary" size="52" width="4" />
          <p class="mt-4 text-body-1 font-weight-medium text-high-emphasis">
            Cargando órdenes de trabajo listas para facturar...
          </p>
          <span class="text-caption text-medium-emphasis">
            Consultando registros en el sistema
          </span>
        </div>

        <!-- Sin Órdenes Disponibles -->
        <div
          v-else-if="readyWorkOrders.length === 0"
          class="text-center py-12 px-4 bg-white rounded-xl border-light"
        >
          <VAvatar size="64" color="primary" variant="tonal" class="mb-3">
            <VIcon icon="ri-file-list-3-line" size="32" color="primary" />
          </VAvatar>
          <h4 class="text-h6 font-weight-bold text-high-emphasis">
            No hay órdenes de trabajo listas para facturar
          </h4>
          <p class="text-body-2 text-medium-emphasis mt-1 max-w-sm mx-auto">
            Las órdenes de trabajo deben estar en estado <strong>"Listo"</strong> o <strong>"Entregado"</strong> y no haber sido facturadas previamente.
          </p>
        </div>

        <!-- Sin Resultados en Búsqueda -->
        <div
          v-else-if="filteredWorkOrders.length === 0"
          class="text-center py-10 px-4 bg-white rounded-xl border-light"
        >
          <VIcon icon="ri-search-eye-line" size="48" color="medium-emphasis" class="mb-2" />
          <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis">
            No se encontraron coincidencias
          </h4>
          <p class="text-caption text-medium-emphasis mt-1">
            No hay resultados para "<strong>{{ workOrderSearchQuery }}</strong>". Intenta con otra placa, cliente o número.
          </p>
          <VBtn
            size="small"
            variant="text"
            color="primary"
            class="mt-2"
            @click="workOrderSearchQuery = ''"
          >
            Limpiar filtro de búsqueda
          </VBtn>
        </div>

        <!-- Lista de Tarjetas de Órdenes de Trabajo -->
        <div v-else class="d-flex flex-column gap-3">
          <div
            v-for="order in filteredWorkOrders"
            :key="order.id"
            class="ot-import-card bg-white rounded-xl pa-4 border-light"
            @click="handleSelectOrder(order)"
          >
            <div class="d-flex flex-column flex-md-row justify-space-between align-md-center gap-3">
              <!-- Bloque Principal: OT, Cliente y Vehículo -->
              <div class="d-flex flex-column gap-2 flex-grow-1 overflow-hidden">
                <!-- Fila Superior: Badge OT + Estado + Fecha -->
                <div class="d-flex align-center flex-wrap gap-2">
                  <span class="ot-number-badge">
                    <VIcon icon="ri-tools-line" size="13" class="me-1" />
                    {{ formatOtNumber(order) }}
                  </span>

                  <span
                    class="ot-status-pill"
                    :class="order.status === 'delivered' ? 'status-delivered' : 'status-ready'"
                  >
                    <span class="status-dot" />
                    {{ order.status === 'delivered' ? 'Entregada' : 'Lista para Facturar' }}
                  </span>

                  <span class="text-caption text-medium-emphasis d-flex align-center">
                    <VIcon icon="ri-calendar-line" size="13" class="me-1" />
                    {{ formatDate(order.date || order.created_at || order.entry_date) }}
                  </span>
                </div>

                <!-- Fila Media: Cliente y Vehículo -->
                <div class="d-flex flex-column flex-sm-row gap-3 gap-sm-5 mt-1">
                  <!-- Cliente -->
                  <div class="d-flex align-start gap-2" style="min-width: 220px; max-width: 320px;">
                    <VAvatar size="32" color="primary" variant="tonal" class="rounded-lg mt-1 shrink-0">
                      <VIcon icon="ri-user-3-line" size="16" />
                    </VAvatar>
                    <div class="d-flex flex-column overflow-hidden">
                      <span class="text-body-2 font-weight-bold text-slate-900 line-clamp-1" :title="getClientName(order.client)">
                        {{ getClientName(order.client) }}
                      </span>
                      <div class="d-flex align-center gap-2 text-caption text-medium-emphasis">
                        <span v-if="order.client?.n_document" class="font-mono">
                          <VIcon icon="ri-id-card-line" size="12" class="me-1" />
                          {{ order.client?.n_document }}
                        </span>
                        <span v-if="order.client?.phone" class="text-truncate">
                          • {{ order.client?.phone }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Vehículo -->
                  <div class="d-flex align-start gap-2 flex-grow-1 overflow-hidden">
                    <div class="plate-chip shrink-0 mt-1">
                      {{ getVehiclePlate(order.vehicle) }}
                    </div>
                    <div class="d-flex flex-column overflow-hidden">
                      <span class="text-body-2 font-weight-semibold text-slate-800 line-clamp-1" :title="getVehicleDescription(order.vehicle)">
                        {{ getVehicleDescription(order.vehicle) }}
                      </span>
                      <span v-if="order.mileage" class="text-caption text-medium-emphasis font-mono">
                        <VIcon icon="ri-dashboard-3-line" size="12" class="me-1" />
                        {{ Number(order.mileage).toLocaleString() }} km
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Fila Inferior: Lista Limpia y Estructurada de Ítems / Servicios -->
                <div v-if="order.items && order.items.length > 0" class="ot-items-box rounded-lg pa-2 mt-1">
                  <div class="d-flex align-center gap-1 mb-1">
                    <VIcon icon="ri-shopping-bag-3-line" size="13" color="primary" />
                    <span class="text-caption font-weight-bold text-slate-700">
                      {{ order.items.length }} {{ order.items.length === 1 ? 'producto / servicio incluido' : 'productos / servicios incluidos' }}:
                    </span>
                  </div>

                  <div class="d-flex flex-column gap-1">
                    <div
                      v-for="(item, idx) in order.items.slice(0, 2)"
                      :key="idx"
                      class="ot-item-row d-flex align-center justify-space-between gap-2"
                    >
                      <div class="d-flex align-center gap-2 overflow-hidden flex-grow-1">
                        <span class="ot-item-qty">{{ item.quantity }}x</span>
                        <span class="ot-item-name text-truncate" :title="getItemDescription(item)">
                          {{ getItemDescription(item) }}
                        </span>
                      </div>
                      <span class="ot-item-price font-mono shrink-0">
                        {{ formatCurrency(getItemSubtotal(item)) }}
                      </span>
                    </div>

                    <div v-if="order.items.length > 2" class="text-caption text-primary font-weight-medium mt-1">
                      + {{ order.items.length - 2 }} más en esta orden
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bloque Lateral Derecho: Total y Botón Importar -->
              <div class="d-flex flex-row flex-md-column align-center align-md-end justify-space-between gap-3 shrink-0 pt-2 pt-md-0 border-top-md-0 border-t-sm" style="min-width: 140px;">
                <div class="d-flex flex-column align-start align-md-end">
                  <span class="text-caption text-medium-emphasis font-weight-medium">
                    Total de la OT
                  </span>
                  <span class="text-h6 font-weight-black text-primary font-mono line-height-1">
                    {{ formatCurrency(calculateOrderTotal(order)) }}
                  </span>
                </div>

                <VBtn
                  color="primary"
                  variant="elevated"
                  prepend-icon="ri-download-cloud-line"
                  class="rounded-lg font-weight-bold px-4 elevation-1"
                  height="36"
                  @click.stop="handleSelectOrder(order)"
                >
                  Importar
                </VBtn>
              </div>
            </div>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <!-- Pie de Página Fijo -->
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
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped lang="scss">
.ot-import-card {
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.12);
  }
}

.ot-number-badge {
  display: inline-flex;
  align-items: center;
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
  font-weight: 800;
  font-size: 0.76rem;
  padding: 2px 8px;
  border-radius: 6px;
  font-family: inherit;
  letter-spacing: 0.02em;
}

.ot-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.70rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  line-height: 1;

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &.status-ready {
    background-color: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;

    .status-dot {
      background-color: #10b981;
    }
  }

  &.status-delivered {
    background-color: #f0fdfa;
    color: #0f766e;
    border: 1px solid #99f6e4;

    .status-dot {
      background-color: #14b8a6;
    }
  }
}

// Placa estilo vehículo ecuatoriano
.plate-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  color: #0f172a;
  border: 1.5px solid #334155;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 800;
  font-size: 0.75rem;
  padding: 1px 7px;
  letter-spacing: 0.08em;
  line-height: 1.2;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

// Caja contenedora limpia para ítems de la orden
.ot-items-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.ot-item-row {
  font-size: 0.75rem;
  line-height: 1.3;
}

.ot-item-qty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  color: #334155;
  font-weight: 700;
  font-size: 0.68rem;
  padding: 1px 5px;
  border-radius: 4px;
  line-height: 1;
}

.ot-item-name {
  color: #334155;
  font-weight: 500;
}

.ot-item-price {
  color: #0f172a;
  font-weight: 700;
  font-size: 0.75rem;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
