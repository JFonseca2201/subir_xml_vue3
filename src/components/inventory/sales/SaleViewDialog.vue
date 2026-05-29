<script setup>
import { computed } from 'vue'
import { getBrandNameById } from '@/data/vehicleBrands'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  saleData: {
    type: Object,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const documentTypeOptions = [
  { title: 'Cotización', value: 'quote' },
  { title: 'Nota de Venta', value: 'sale_note' },
  { title: 'Factura', value: 'invoice' },
]

const paymentStatusOptions = [
  { title: 'Pagado', value: 'paid' },
  { title: 'Parcial', value: 'partial' },
  { title: 'Pendiente', value: 'pending' },
]

const statusOptions = [
  { title: 'Completada', value: 'completed' },
  { title: 'Pendiente', value: 'pending' },
  { title: 'Anulada', value: 'canceled' },
]

const getDocumentTypeLabel = computed(() => {
  const option = documentTypeOptions.find(opt => opt.value === props.saleData?.document_type)

  return option?.title || 'No especificado'
})

const getPaymentStatusLabel = computed(() => {
  const option = paymentStatusOptions.find(opt => opt.value === props.saleData?.payment_status)

  return option?.title || 'No especificado'
})

const getStatusLabel = computed(() => {
  const option = statusOptions.find(opt => opt.value === props.saleData?.status)

  return option?.title || 'No especificado'
})

const getDocumentTypeColor = computed(() => ({
  quote: 'info',
  sale_note: 'primary',
  invoice: 'deep-purple',
}[props.saleData?.document_type] || 'grey'))

const getPaymentStatusColor = computed(() => ({
  paid: 'success',
  partial: 'warning',
  pending: 'error',
}[props.saleData?.payment_status] || 'grey'))

const getStatusColor = computed(() => ({
  completed: 'success',
  pending: 'warning',
  canceled: 'error',
}[props.saleData?.status] || 'grey'))

const documentTypeIcon = computed(() => ({
  quote: 'ri-file-list-3-line',
  sale_note: 'ri-receipt-line',
  invoice: 'ri-bill-line',
}[props.saleData?.document_type] || 'ri-file-text-line'))

const statusIcon = computed(() => ({
  completed: 'ri-checkbox-circle-line',
  pending: 'ri-time-line',
  canceled: 'ri-close-circle-line',
}[props.saleData?.status] || 'ri-question-line'))

const getClientName = computed(() => {
  const client = props.saleData?.client
  if (!client) return 'Consumidor final'

  return client.full_name || client.name ||
    `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Cliente'
})

const getClientDocument = computed(() => props.saleData?.client?.n_document || '—')

const getClientPhone = computed(() => props.saleData?.client?.phone || '—')

const getVehicleLicensePlate = computed(() => props.saleData?.vehicle?.license_plate || null)

const getVehicleInfo = computed(() => {
  const vehicle = props.saleData?.vehicle
  if (!vehicle) return null

  const brandName = vehicle.brand ? getBrandNameById(vehicle.brand) : ''

  return [brandName, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || '—'
})

const technicians = computed(() => props.saleData?.technicians || [])

const getPaymentDistributions = computed(() =>
  props.saleData?.finance_record?.payment_distributions || [],
)

const hasPaymentDistributions = computed(() => getPaymentDistributions.value.length > 0)

const itemsCount = computed(() => props.saleData?.details?.length || 0)

const isQuote = computed(() => props.saleData?.document_type === 'quote')

/** Método real: prioriza pagos distribuidos sobre el campo de cabecera (a veces queda "Efectivo" por defecto). */
const displayPaymentMethod = computed(() => {
  const dists = getPaymentDistributions.value
  if (dists.length > 0) {
    const methods = [...new Set(dists.map(d => d.payment_method).filter(Boolean))]
    if (methods.length) return methods.join(', ')
  }

  return props.saleData?.payment_method || '—'
})

const formatCurrency = value => new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
}).format(value || 0)

const formatDate = dateString => {
  if (!dateString) return '—'
  const [year, month, day] = dateString.split('T')[0].split('-')

  return `${day}/${month}/${year}`
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="960"
    scrollable
    @update:model-value="closeDialog"
  >
    <VCard
      class="sale-view-card"
      rounded="lg"
      elevation="4"
    >
      <!-- Cabecera al estilo del resto del inventario -->
      <div class="sale-view-header d-flex align-start justify-space-between pa-5 pb-4">
        <div class="d-flex align-start gap-4 flex-grow-1 min-w-0">
          <VAvatar
            size="56"
            :color="getDocumentTypeColor"
            variant="tonal"
            class="flex-shrink-0"
          >
            <VIcon
              :icon="documentTypeIcon"
              size="28"
            />
          </VAvatar>

          <div class="min-w-0">
            <div class="d-flex align-center flex-wrap gap-2 mb-1">
              <span class="text-h5 font-weight-bold text-truncate">
                {{ saleData.document_number || '—' }}
              </span>
              <VChip
                :color="getDocumentTypeColor"
                size="small"
                variant="tonal"
                label
              >
                {{ getDocumentTypeLabel }}
              </VChip>
              <VChip
                :color="getStatusColor"
                size="small"
                variant="elevated"
                label
              >
                <VIcon
                  start
                  :icon="statusIcon"
                  size="14"
                />
                {{ getStatusLabel }}
              </VChip>
            </div>

            <div class="d-flex align-center flex-wrap gap-3 text-body-2 text-medium-emphasis">
              <span class="d-inline-flex align-center gap-1">
                <VIcon
                  icon="ri-calendar-line"
                  size="16"
                />
                {{ formatDate(saleData.service_date) }}
              </span>
              <span
                v-if="saleData.work_order_id"
                class="d-inline-flex align-center gap-1 text-primary"
              >
                <VIcon
                  icon="ri-link"
                  size="16"
                />
                Orden de trabajo vinculada
              </span>
            </div>
          </div>
        </div>

        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="flex-shrink-0 ms-2"
          @click="closeDialog"
        />
      </div>

      <VDivider />

      <VCardText class="pa-5">
        <div
          v-if="loading"
          class="d-flex flex-column align-center justify-center py-12"
        >
          <VProgressCircular
            indeterminate
            color="primary"
            size="48"
          />
          <p class="text-body-2 text-medium-emphasis mt-4 mb-0">
            Cargando detalle de la venta...
          </p>
        </div>

        <template v-else>
          <!-- Resumen rápido -->
          <VRow class="mb-5">
            <VCol
              cols="6"
              sm="3"
            >
              <div class="kpi-tile">
                <VIcon
                  icon="ri-money-dollar-circle-line"
                  size="22"
                  color="primary"
                  class="mb-2"
                />
                <div class="text-caption text-medium-emphasis">
                  Total
                </div>
                <div class="text-h6 font-weight-bold text-primary">
                  {{ formatCurrency(saleData.total) }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="6"
              sm="3"
            >
              <div class="kpi-tile">
                <VIcon
                  icon="ri-wallet-3-line"
                  size="22"
                  :color="getPaymentStatusColor"
                  class="mb-2"
                />
                <div class="text-caption text-medium-emphasis">
                  Estado de pago
                </div>
                <VChip
                  :color="getPaymentStatusColor"
                  size="small"
                  variant="tonal"
                  class="mt-1"
                >
                  {{ getPaymentStatusLabel }}
                </VChip>
              </div>
            </VCol>
            <VCol
              cols="6"
              sm="3"
            >
              <div class="kpi-tile">
                <VIcon
                  icon="ri-shopping-bag-3-line"
                  size="22"
                  color="info"
                  class="mb-2"
                />
                <div class="text-caption text-medium-emphasis">
                  Ítems
                </div>
                <div class="text-h6 font-weight-bold">
                  {{ itemsCount }}
                </div>
              </div>
            </VCol>
            <VCol
              cols="6"
              sm="3"
            >
              <div class="kpi-tile">
                <VIcon
                  icon="ri-bank-card-line"
                  size="22"
                  color="secondary"
                  class="mb-2"
                />
                <div class="text-caption text-medium-emphasis">
                  Método de pago
                </div>
                <div class="text-body-2 font-weight-medium text-truncate mt-1">
                  {{ displayPaymentMethod }}
                </div>
              </div>
            </VCol>
          </VRow>

          <VRow>
            <!-- Cliente y vehículo -->
            <VCol
              cols="12"
              md="6"
            >
              <div class="section-panel h-100">
                <div class="section-title">
                  <VAvatar
                    size="36"
                    color="success"
                    variant="tonal"
                    class="me-3"
                  >
                    <VIcon
                      icon="ri-user-star-line"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <div class="text-subtitle-1 font-weight-bold">
                      Cliente y vehículo
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Datos del servicio
                    </div>
                  </div>
                </div>

                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">
                      <VIcon
                        icon="ri-user-line"
                        size="16"
                      />
                      Cliente
                    </span>
                    <span class="info-value font-weight-medium">{{ getClientName }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">
                      <VIcon
                        icon="ri-id-card-line"
                        size="16"
                      />
                      Documento
                    </span>
                    <span class="info-value">{{ getClientDocument }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">
                      <VIcon
                        icon="ri-phone-line"
                        size="16"
                      />
                      Teléfono
                    </span>
                    <span class="info-value">{{ getClientPhone }}</span>
                  </div>
                  <VDivider class="my-3" />
                  <div class="info-row">
                    <span class="info-label">
                      <VIcon
                        icon="ri-car-line"
                        size="16"
                      />
                      Placa
                    </span>
                    <span class="info-value">
                      <VChip
                        v-if="getVehicleLicensePlate"
                        size="small"
                        color="primary"
                        variant="tonal"
                        label
                        class="font-weight-bold"
                      >
                        {{ getVehicleLicensePlate }}
                      </VChip>
                      <span
                        v-else
                        class="text-medium-emphasis"
                      >—</span>
                    </span>
                  </div>
                  <div
                    v-if="saleData.vehicle"
                    class="info-row"
                  >
                    <span class="info-label">
                      <VIcon
                        icon="ri-roadster-line"
                        size="16"
                      />
                      Vehículo
                    </span>
                    <span class="info-value">{{ getVehicleInfo }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">
                      <VIcon
                        icon="ri-dashboard-3-line"
                        size="16"
                      />
                      Kilometraje
                    </span>
                    <span class="info-value">
                      {{ saleData.mileage ? `${saleData.mileage} km` : '—' }}
                    </span>
                  </div>
                  <div class="info-row align-start">
                    <span class="info-label">
                      <VIcon
                        icon="ri-user-settings-line"
                        size="16"
                      />
                      Técnicos
                    </span>
                    <span class="info-value">
                      <div
                        v-if="technicians.length"
                        class="d-flex flex-wrap gap-1 justify-end"
                      >
                        <VChip
                          v-for="tech in technicians"
                          :key="tech.id"
                          size="small"
                          color="primary"
                          variant="tonal"
                        >
                          {{ tech.first_name }} {{ tech.last_name }}
                        </VChip>
                      </div>
                      <span
                        v-else
                        class="text-medium-emphasis"
                      >—</span>
                    </span>
                  </div>
                </div>
              </div>
            </VCol>

            <!-- Pagos -->
            <VCol
              cols="12"
              md="6"
            >
              <div class="section-panel h-100">
                <div class="section-title">
                  <VAvatar
                    size="36"
                    color="warning"
                    variant="tonal"
                    class="me-3"
                  >
                    <VIcon
                      icon="ri-wallet-3-line"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <div class="text-subtitle-1 font-weight-bold">
                      Información de pago
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ hasPaymentDistributions ? 'Pagos distribuidos' : 'Resumen financiero' }}
                    </div>
                  </div>
                </div>

                <div
                  v-if="hasPaymentDistributions"
                  class="payment-table-wrap"
                >
                  <VTable
                    density="compact"
                    class="payment-table"
                  >
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Método</th>
                        <th>Cuenta</th>
                        <th class="text-right">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(dist, index) in getPaymentDistributions"
                        :key="dist.id || index"
                      >
                        <td class="text-medium-emphasis">
                          {{ index + 1 }}
                        </td>
                        <td>{{ dist.payment_method }}</td>
                        <td>{{ dist.account?.name || `Cuenta ${dist.account_id}` }}</td>
                        <td class="text-right font-weight-bold">
                          {{ formatCurrency(dist.amount) }}
                        </td>
                      </tr>
                    </tbody>
                  </VTable>
                </div>

                <div
                  v-else-if="!isQuote"
                  class="info-list"
                >
                  <div class="info-row">
                    <span class="info-label">Estado</span>
                    <VChip
                      :color="getPaymentStatusColor"
                      size="small"
                      variant="tonal"
                    >
                      {{ getPaymentStatusLabel }}
                    </VChip>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Método</span>
                    <span class="info-value">{{ displayPaymentMethod }}</span>
                  </div>
                  <div
                    v-if="saleData.is_credited"
                    class="info-row"
                  >
                    <span class="info-label">Crédito</span>
                    <VChip
                      size="small"
                      color="warning"
                      variant="tonal"
                    >
                      A crédito
                    </VChip>
                  </div>
                </div>

                <div
                  v-else
                  class="empty-hint pa-4 text-center"
                >
                  <VIcon
                    icon="ri-file-list-3-line"
                    size="32"
                    color="info"
                    class="mb-2"
                  />
                  <p class="text-body-2 text-medium-emphasis mb-0">
                    Cotización sin movimiento de caja
                  </p>
                </div>
              </div>
            </VCol>
          </VRow>

          <!-- Detalle de ítems -->
          <div class="section-panel mt-4">
            <div class="section-title mb-3">
              <VAvatar
                size="36"
                color="info"
                variant="tonal"
                class="me-3"
              >
                <VIcon
                  icon="ri-shopping-cart-2-line"
                  size="20"
                />
              </VAvatar>
              <div>
                <div class="text-subtitle-1 font-weight-bold">
                  Productos y servicios
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ itemsCount }} {{ itemsCount === 1 ? 'ítem' : 'ítems' }} en el documento
                </div>
              </div>
            </div>

            <div
              v-if="saleData.details?.length"
              class="items-table-wrap"
            >
              <VTable
                density="comfortable"
                class="items-table"
              >
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th class="text-center">
                      Cant.
                    </th>
                    <th class="text-right">
                      P. unit.
                    </th>
                    <th class="text-right">
                      Desc.
                    </th>
                    <th class="text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, index) in saleData.details"
                    :key="item.id || index"
                  >
                    <td class="font-weight-medium">
                      {{ item.description }}
                    </td>
                    <td class="text-center">
                      {{ item.quantity }}
                    </td>
                    <td class="text-right">
                      {{ formatCurrency(item.price) }}
                    </td>
                    <td class="text-right text-medium-emphasis">
                      {{ formatCurrency(item.discount || 0) }}
                    </td>
                    <td class="text-right font-weight-bold">
                      {{ formatCurrency(item.total) }}
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </div>

            <div
              v-else
              class="empty-hint pa-6 text-center"
            >
              <VIcon
                icon="ri-shopping-bag-3-line"
                size="40"
                color="grey-lighten-1"
                class="mb-2"
              />
              <p class="text-body-2 text-medium-emphasis mb-0">
                No hay productos o servicios registrados
              </p>
            </div>
          </div>

          <!-- Totales y observaciones -->
          <VRow class="mt-4">
            <VCol
              cols="12"
              md="7"
            >
              <div
                v-if="saleData.observations"
                class="section-panel observations-panel"
              >
                <div class="d-flex align-center gap-2 mb-2">
                  <VIcon
                    icon="ri-file-text-line"
                    size="20"
                    color="info"
                  />
                  <span class="text-subtitle-2 font-weight-bold">Observaciones</span>
                </div>
                <p class="text-body-2 mb-0 observations-text">
                  {{ saleData.observations }}
                </p>
              </div>
            </VCol>

            <VCol
              cols="12"
              md="5"
            >
              <div class="totals-panel pa-4 rounded-lg">
                <div class="d-flex justify-space-between align-center mb-2">
                  <span class="text-body-2 text-medium-emphasis">Subtotal</span>
                  <span class="text-body-1 font-weight-medium">{{ formatCurrency(saleData.subtotal) }}</span>
                </div>
                <div
                  v-if="saleData.tax_amount > 0"
                  class="d-flex justify-space-between align-center mb-2"
                >
                  <span class="text-body-2 text-medium-emphasis">IVA (15%)</span>
                  <span class="text-body-1 font-weight-medium">{{ formatCurrency(saleData.tax_amount) }}</span>
                </div>
                <VDivider class="my-3" />
                <div class="d-flex justify-space-between align-center">
                  <span class="text-subtitle-1 font-weight-bold">Total</span>
                  <span class="text-h5 font-weight-bold text-primary">{{ formatCurrency(saleData.total) }}</span>
                </div>
              </div>
            </VCol>
          </VRow>
        </template>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4">
        <VSpacer />
        <VBtn
          color="secondary"
          variant="tonal"
          prepend-icon="ri-close-line"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.sale-view-card {
  overflow: hidden;
}

.sale-view-header {
  background: rgb(var(--v-theme-surface));
}

.kpi-tile {
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  height: 100%;
}

.section-panel {
  padding: 20px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.section-title {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.875rem;
}

.info-row.align-start {
  align-items: flex-start;
}

.info-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  flex-shrink: 0;
}

.info-value {
  text-align: right;
  word-break: break-word;
}

.payment-table-wrap,
.items-table-wrap {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.payment-table :deep(thead th),
.items-table :deep(thead th) {
  font-size: 0.7rem !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: rgba(var(--v-theme-on-surface), 0.04) !important;
  color: rgba(var(--v-theme-on-surface), 0.65) !important;
}

.items-table :deep(tbody tr:hover) {
  background: rgba(var(--v-theme-primary), 0.04);
}

.totals-panel {
  background: rgba(var(--v-theme-primary), 0.06);
  border: 1px solid rgba(var(--v-theme-primary), 0.15);
}

.observations-panel {
  background: rgba(var(--v-theme-info), 0.04);
  border-color: rgba(var(--v-theme-info), 0.2);
}

.observations-text {
  white-space: pre-wrap;
  line-height: 1.5;
}

.empty-hint {
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
