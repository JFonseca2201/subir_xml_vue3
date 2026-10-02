<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getBrandNameById } from '@/data/vehicleBrands'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  workOrderId: {
    type: [Number, String],
    default: null,
  },
  workOrderData: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'refresh'])

const router = useRouter()
const { showNotification } = useGlobalToast()

const internalLoading = ref(false)
const orderData = ref(null)

const isVisible = computed({
  get: () => props.isDialogVisible,
  set: val => emit('update:isDialogVisible', val),
})

const fetchWorkOrderDetails = async id => {
  if (!id) return
  internalLoading.value = true
  try {
    const response = await $api(`work-orders/${id}`)
    if (response?.data) {
      orderData.value = response.data
    } else if (response && !response.error) {
      orderData.value = response
    }
  } catch (error) {
    console.error('Error al cargar la orden de trabajo:', error)
    showNotification('No se pudo cargar el detalle de la orden de trabajo', 'error')
  } finally {
    internalLoading.value = false
  }
}

watch(
  () => [props.isDialogVisible, props.workOrderId, props.workOrderData],
  ([visible, id, data]) => {
    if (visible) {
      if (data && (data.items || data.details)) {
        orderData.value = data
      } else if (id || data?.id) {
        const targetId = id || data?.id

        fetchWorkOrderDetails(targetId)
      }
    } else {
      orderData.value = null
    }
  },
  { immediate: true },
)

const order = computed(() => orderData.value || props.workOrderData || {})

const formattedNumber = computed(() => {
  const num = order.value?.number || order.value?.id
  if (!num) return '-'
  const clean = String(num).replace(/[^0-9]/g, '')
  if (!clean) return String(num)
  const val = parseInt(clean, 10)
  if (isNaN(val)) return String(num)
  
  return '#' + String(val).padStart(6, '0')
})

const statusMap = {
  draft: { label: 'Borrador', color: 'secondary', icon: 'ri-draft-line' },
  received: { label: 'Recibido', color: 'info', icon: 'ri-file-list-3-line' },
  in_progress: { label: 'En Progreso', color: 'warning', icon: 'ri-tools-line' },
  ready: { label: 'Listo para entrega', color: 'success', icon: 'ri-checkbox-circle-fill' },
  delivered: { label: 'Entregado', color: 'default', icon: 'ri-truck-line' },
}

const currentStatusInfo = computed(() => {
  const s = order.value?.status || 'draft'
  
  return statusMap[s] || { label: s, color: 'primary', icon: 'ri-information-line' }
})

const clientName = computed(() => {
  const c = order.value?.client
  if (!c) return 'Consumidor Final / Sin Cliente'
  
  return c.full_name || c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente Desconocido'
})

const clientDocument = computed(() => order.value?.client?.n_document || order.value?.client?.document_number || '—')
const clientPhone = computed(() => order.value?.client?.phone || order.value?.client?.mobile || order.value?.client?.cellphone || '—')
const clientEmail = computed(() => order.value?.client?.email || '—')
const clientAddress = computed(() => order.value?.client?.address || '—')

const vehicle = computed(() => order.value?.vehicle || null)
const vehiclePlate = computed(() => (vehicle.value?.license_plate || vehicle.value?.plate || '').toUpperCase() || 'SIN PLACA')

const vehicleBrand = computed(() => {
  if (!vehicle.value) return '—'
  const brandVal = vehicle.value.brand?.name || vehicle.value.brand || vehicle.value.brand_id
  
  return brandVal ? (getBrandNameById(brandVal) || brandVal) : '—'
})

const vehicleModel = computed(() => vehicle.value?.model || '—')
const vehicleYear = computed(() => vehicle.value?.year ? String(vehicle.value.year) : '—')
const vehicleColor = computed(() => vehicle.value?.color || '—')
const vehicleKm = computed(() => order.value?.mileage || vehicle.value?.mileage || '—')

const itemsList = computed(() => {
  return order.value?.items || order.value?.details || []
})

const totalAmount = computed(() => {
  if (order.value?.total !== undefined && order.value?.total !== null) {
    return parseFloat(order.value.total) || 0
  }
  
  return itemsList.value.reduce((sum, item) => sum + (parseFloat(item.subtotal || item.total) || 0), 0)
})

const advancesList = computed(() => order.value?.advances || [])

const totalAdvances = computed(() => {
  if (order.value?.total_advances !== undefined && order.value?.total_advances !== null) {
    return parseFloat(order.value.total_advances) || 0
  }
  
  return advancesList.value.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
})

const balancePending = computed(() => {
  const pending = totalAmount.value - totalAdvances.value
  
  return pending > 0 ? pending : 0
})

const formatDate = dateString => {
  if (!dateString) return '—'
  const clean = String(dateString).split('T')[0].split(' ')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`
  }
  
  return dateString
}

const printPDF = () => {
  if (!order.value?.id) return
  const token = localStorage.getItem('token')
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
  const pdfUrl = `${apiBaseUrl}/work-orders/${order.value.id}/pdf?token=${token}&print=true`

  window.open(pdfUrl, '_blank')
}

const downloadPDF = async () => {
  if (!order.value?.id) return
  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')

    const response = await fetch(`${apiBaseUrl}/work-orders/${order.value.id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')

      a.href = url
      a.download = `Orden_Trabajo_${order.value.number || order.value.id}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showNotification('PDF descargado correctamente', 'success')
    }
  } catch (error) {
    showNotification('Error al descargar PDF', 'error')
  }
}

const goToEdit = () => {
  if (!order.value?.id) return
  isVisible.value = false
  router.push(`/work-orders/edit/${order.value.id}`)
}
</script>

<template>
  <VDialog
    v-model="isVisible"
    max-width="920"
    scrollable
    transition="dialog-bottom-transition"
  >
    <VCard class="custom-dialog-card elevation-12">
      <!-- Encabezado de Diálogo -->
      <div class="custom-dialog-header-primary bg-primary text-white py-4 px-6 d-flex align-center justify-space-between position-relative">
        <div class="d-flex align-center gap-3">
          <VAvatar
            size="44"
            color="white"
            variant="tonal"
            class="rounded-xl shadow-sm"
          >
            <VIcon
              icon="ri-tools-line"
              size="26"
              color="white"
            />
          </VAvatar>
          <div class="text-start">
            <div class="d-flex align-center gap-2">
              <h2 class="text-h6 font-weight-bold text-white mb-0">
                Orden de Trabajo {{ formattedNumber }}
              </h2>
              <div
                class="status-pill-clean"
                :class="{
                  'status-paid': ['ready', 'delivered'].includes(order.status),
                  'status-partial': order.status === 'in_progress',
                  'status-transfer': order.status === 'received',
                  'status-canceled': order.status === 'draft',
                }"
                style="font-size: 0.74rem; padding: 4px 10px;"
              >
                <span class="status-dot" />
                <span>{{ currentStatusInfo.label }}</span>
              </div>
            </div>
            <p class="text-caption text-white opacity-85 mb-0 mt-0.5">
              Fecha de ingreso: {{ formatDate(order.date || order.created_at) }}
              <span v-if="order.user?.name"> • Asesor: {{ order.user.name }}</span>
            </p>
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="isVisible = false"
        />
      </div>

      <!-- Cuerpo del Diálogo -->
      <VCardText class="pa-5 bg-background">
        <div
          v-if="internalLoading"
          class="py-12 text-center"
        >
          <VProgressCircular
            indeterminate
            color="primary"
            size="48"
            width="3"
          />
          <p class="text-medium-emphasis mt-3 mb-0 text-caption font-weight-medium">
            Cargando información de la orden de trabajo...
          </p>
        </div>

        <div
          v-else
          class="d-flex flex-column gap-4"
        >
          <!-- Tarjetas de Especificaciones (Cliente y Vehículo) -->
          <VRow dense>
            <!-- Columna Cliente -->
            <VCol
              cols="12"
              md="6"
            >
              <VCard class="elevation-0 border rounded-xl pa-4 h-100 bg-surface">
                <div class="d-flex align-center gap-2 mb-3 pb-2 border-b">
                  <VIcon
                    icon="ri-user-3-line"
                    size="18"
                    color="primary"
                  />
                  <span class="text-subtitle-2 font-weight-bold text-high-emphasis">Datos del Cliente</span>
                </div>
                <div class="d-flex flex-column gap-1.5 text-caption">
                  <div class="d-flex justify-space-between">
                    <span class="text-medium-emphasis">Nombre / Razón:</span>
                    <strong class="text-high-emphasis text-end font-weight-semibold">{{ clientName }}</strong>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-medium-emphasis">Cédula / RUC:</span>
                    <span class="font-mono font-weight-medium text-high-emphasis">{{ clientDocument }}</span>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-medium-emphasis">Teléfono / Celular:</span>
                    <span class="text-high-emphasis font-weight-medium">{{ clientPhone }}</span>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-medium-emphasis">Correo:</span>
                    <span class="text-high-emphasis">{{ clientEmail }}</span>
                  </div>
                  <div
                    v-if="clientAddress !== '—'"
                    class="d-flex justify-space-between"
                  >
                    <span class="text-medium-emphasis">Dirección:</span>
                    <span class="text-high-emphasis text-end">{{ clientAddress }}</span>
                  </div>
                </div>
              </VCard>
            </VCol>

            <!-- Columna Vehículo -->
            <VCol
              cols="12"
              md="6"
            >
              <VCard class="elevation-0 border rounded-xl pa-4 h-100 bg-surface">
                <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b">
                  <div class="d-flex align-center gap-2">
                    <VIcon
                      icon="ri-car-line"
                      size="18"
                      color="secondary"
                    />
                    <span class="text-subtitle-2 font-weight-bold text-high-emphasis">Vehículo en Taller</span>
                  </div>
                  <span class="kardex-plate-badge">{{ vehiclePlate }}</span>
                </div>
                <div
                  v-if="vehicle"
                  class="d-flex flex-column gap-1.5 text-caption"
                >
                  <div class="d-flex justify-space-between">
                    <span class="text-medium-emphasis">Marca y Modelo:</span>
                    <strong class="text-high-emphasis font-weight-semibold">{{ vehicleBrand }} {{ vehicleModel
                    }}</strong>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-medium-emphasis">Año / Color:</span>
                    <span class="text-high-emphasis font-weight-medium">{{ vehicleYear }} • {{ vehicleColor }}</span>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-medium-emphasis">Kilometraje:</span>
                    <span class="font-mono font-weight-bold text-primary">{{ vehicleKm }} Km</span>
                  </div>
                  <div
                    v-if="vehicle.chassis"
                    class="d-flex justify-space-between"
                  >
                    <span class="text-medium-emphasis">Chasis / VIN:</span>
                    <span class="font-mono text-medium-emphasis">{{ vehicle.chassis }}</span>
                  </div>
                </div>
                <div
                  v-else
                  class="text-caption text-disabled text-center py-4"
                >
                  Sin vehículo registrado para esta orden
                </div>
              </VCard>
            </VCol>
          </VRow>

          <!-- Tabla de Trabajos / Repuestos -->
          <VCard class="elevation-0 border rounded-xl overflow-hidden bg-surface">
            <div class="pa-3.5 bg-grey-lighten-5 border-b d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="ri-list-check-2"
                  size="18"
                  color="primary"
                />
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis">Servicios y Repuestos</span>
              </div>
              <span class="text-caption font-weight-medium text-medium-emphasis">
                {{ itemsList.length }} ítem(s) registrados
              </span>
            </div>

            <VTable
              density="compact"
              class="custom-items-table"
            >
              <thead>
                <tr class="bg-grey-lighten-5">
                  <th
                    class="text-left font-weight-bold text-uppercase py-2"
                    style="width: 45%;"
                  >
                    Descripción / Trabajo
                  </th>
                  <th
                    class="text-center font-weight-bold text-uppercase py-2"
                    style="width: 15%;"
                  >
                    Cant.
                  </th>
                  <th
                    class="text-right font-weight-bold text-uppercase py-2"
                    style="width: 20%;"
                  >
                    P. Unit
                  </th>
                  <th
                    class="text-right font-weight-bold text-uppercase py-2"
                    style="width: 20%;"
                  >
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in itemsList"
                  :key="item.id || idx"
                >
                  <td class="py-2.5">
                    <div class="font-weight-medium text-high-emphasis text-body-2">
                      {{ item.description || item.name || item.product?.name || 'Servicio de taller' }}
                    </div>
                    <div
                      v-if="item.technician || item.technician_name"
                      class="text-caption text-medium-emphasis d-flex align-center gap-1 mt-0.5"
                    >
                      <VIcon
                        icon="ri-user-settings-line"
                        size="11"
                      />
                      <span>Técnico: {{ item.technician?.name || item.technician_name }}</span>
                    </div>
                  </td>
                  <td class="text-center font-mono font-weight-bold text-body-2 py-2.5">
                    {{ item.quantity || 1 }}
                  </td>
                  <td class="text-right font-mono text-body-2 py-2.5">
                    ${{ parseFloat(item.price || item.unit_price || 0).toFixed(2) }}
                  </td>
                  <td class="text-right font-mono font-weight-bold text-body-2 text-high-emphasis py-2.5">
                    ${{ parseFloat(item.subtotal || (Number(item.quantity || 1) * Number(item.price || 0))).toFixed(2)
                    }}
                  </td>
                </tr>
                <tr v-if="itemsList.length === 0">
                  <td
                    colspan="4"
                    class="text-center text-disabled py-6 text-caption"
                  >
                    No se han agregado ítems a esta orden de trabajo
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VCard>

          <!-- Resumen Financiero y Abonos -->
          <VRow dense>
            <!-- Observaciones / Diagnóstico -->
            <VCol
              cols="12"
              md="7"
            >
              <VCard class="elevation-0 border rounded-xl pa-3.5 h-100 bg-surface">
                <div class="d-flex align-center gap-2 mb-2 pb-1 border-b">
                  <VIcon
                    icon="ri-file-text-line"
                    size="16"
                    color="info"
                  />
                  <span class="text-caption font-weight-bold text-high-emphasis text-uppercase">Diagnóstico y
                    Notas</span>
                </div>
                <p
                  class="text-caption text-medium-emphasis mb-0"
                  style="white-space: pre-line; line-height: 1.4;"
                >
                  {{ order.notes || order.observations || order.diagnostic || 'Sin observaciones registradas.' }}
                </p>
              </VCard>
            </VCol>

            <!-- Totales -->
            <VCol
              cols="12"
              md="5"
            >
              <VCard class="elevation-0 border rounded-xl pa-3.5 bg-surface">
                <div class="d-flex flex-column gap-2 text-caption">
                  <div class="d-flex justify-space-between align-center">
                    <span class="text-medium-emphasis">Total Trabajos:</span>
                    <span class="font-mono font-weight-bold text-h6 text-high-emphasis">
                      ${{ totalAmount.toFixed(2) }}
                    </span>
                  </div>
                  <div
                    v-if="totalAdvances > 0"
                    class="d-flex justify-space-between align-center text-success"
                  >
                    <span class="font-weight-medium">Abonos / Anticipos:</span>
                    <span class="font-mono font-weight-bold text-body-1">
                      - ${{ totalAdvances.toFixed(2) }}
                    </span>
                  </div>
                  <VDivider
                    v-if="totalAdvances > 0"
                    class="my-1"
                  />
                  <div
                    v-if="totalAdvances > 0"
                    class="d-flex justify-space-between align-center text-warning"
                  >
                    <span class="font-weight-bold">Saldo Pendiente:</span>
                    <span class="font-mono font-weight-bold text-body-1">
                      ${{ balancePending.toFixed(2) }}
                    </span>
                  </div>
                </div>
              </VCard>
            </VCol>
          </VRow>
        </div>
      </VCardText>

      <VDivider />

      <!-- Acciones del Modal -->
      <VCardActions class="pa-4 px-6 d-flex justify-space-between align-center bg-surface">
        <div class="d-flex gap-2">
          <VBtn
            variant="tonal"
            color="secondary"
            prepend-icon="ri-printer-line"
            size="small"
            class="font-weight-medium"
            @click="printPDF"
          >
            Imprimir
          </VBtn>
          <VBtn
            variant="tonal"
            color="primary"
            prepend-icon="ri-download-2-line"
            size="small"
            class="font-weight-medium"
            @click="downloadPDF"
          >
            PDF
          </VBtn>
        </div>

        <div class="d-flex gap-2">
          <VBtn
            variant="tonal"
            color="info"
            prepend-icon="ri-pencil-line"
            class="rounded-lg font-weight-semibold"
            @click="goToEdit"
          >
            Ir a Orden
          </VBtn>
          <VBtn
            variant="outlined"
            color="secondary"
            class="rounded-lg font-weight-medium"
            @click="isVisible = false"
          >
            Cerrar
          </VBtn>
        </div>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

