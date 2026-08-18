<script setup>
import { ref, watch, computed } from 'vue'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  clientId: {
    type: [Number, String],
    default: null,
  },
  vehicleId: {
    type: [Number, String],
    default: null,
  },
  title: {
    type: String,
    default: 'Historial de Transacciones',
  },
  subtitle: {
    type: String,
    default: 'Ventas, Facturas y Documentos Emitidos',
  },
})

const emit = defineEmits(['update:modelValue'])

const { showNotification } = useGlobalToast()

const dialog = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
})

const closeDialog = () => {
  dialog.value = false
  emit('update:modelValue', false)
}

const loading = ref(false)
const sales = ref([])
const totalPages = ref(1)
const currentPage = ref(1)

const totalAmount = computed(() => {
  return sales.value.reduce((acc, s) => acc + (Number(s.total) || 0), 0)
})

const paidCount = computed(() => {
  return sales.value.filter(s => s.payment_status === 'paid').length
})

const loadHistory = async () => {
  if (!props.clientId && !props.vehicleId) return

  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      exclude_quotes: true,
    }

    if (props.clientId) params.client_id = props.clientId
    if (props.vehicleId) params.vehicle_id = props.vehicleId

    const response = await $api('sales', {
      method: 'GET',
      params,
    })

    if (response?.data?.data) {
      sales.value = response.data.data
      totalPages.value = response.data.last_page || 1
    } else {
      sales.value = []
    }
  } catch (error) {
    console.error('Error al cargar el historial:', error)
    showNotification('No se pudo cargar el historial', 'error')
  } finally {
    loading.value = false
  }
}

watch(dialog, val => {
  if (val) {
    currentPage.value = 1
    loadHistory()
  }
})

watch(currentPage, () => {
  if (dialog.value) loadHistory()
})

const formatCurrency = value => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const formatDate = dateString => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const getStatusColor = status => {
  switch (status) {
  case 'paid': return 'success'
  case 'partial': return 'warning'
  case 'pending': return 'error'
  default: return 'secondary'
  }
}

const getStatusText = status => {
  switch (status) {
  case 'paid': return 'Pagado'
  case 'partial': return 'Abonado'
  case 'pending': return 'Pendiente'
  default: return status || 'N/A'
  }
}

const getDocumentType = type => {
  switch (type) {
  case 'invoice': return 'Factura'
  case 'sale_note': return 'Nota de Venta'
  case 'ticket': return 'Ticket'
  default: return type ? type.toUpperCase() : 'DOCUMENTO'
  }
}

const generateSinglePDF = sale => {
  const token = localStorage.getItem('token')
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
  const pdfUrl = `${apiBaseUrl}/sales/${sale.id}/pdf?token=${token}`

  const printWindow = window.open(pdfUrl, '_blank')
  if (printWindow) {
    printWindow.focus()
    showNotification('PDF cargado exitosamente', 'success')
  } else {
    showNotification('Permite las ventanas emergentes para abrir el PDF', 'warning')
  }
}
</script>

<template>
  <VDialog
    v-model="dialog"
    scrollable
    max-width="880"
    transition="dialog-bottom-transition"
  >
    <VCard
      class="custom-dialog-card history-dialog-card pa-0 elevation-8"
      style="overflow: hidden; max-height: 85vh; display: flex; flex-direction: column;"
    >
      <!-- Header Banner Primary (Estilo estándar de diálogos del sistema) -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-history-line" />
        </div>
        <h3 class="custom-dialog-title">
          {{ props.title }}
        </h3>
        <p class="custom-dialog-subtitle">
          {{ props.subtitle }}
        </p>
      </div>

      <!-- Content Area -->
      <VCardText class="pa-0 position-relative d-flex flex-column flex-grow-1 overflow-hidden history-content-area">
        <VProgressLinear
          v-if="loading"
          indeterminate
          color="primary"
          class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;"
          height="3"
        />

        <!-- Summary Stats Banner (When data exists) -->
        <div
          v-if="!loading && sales.length > 0"
          class="pa-4 bg-surface border-b d-flex flex-wrap align-center justify-space-between gap-3 history-stats-bar"
        >
          <div class="d-flex align-center gap-2">
            <VChip
              size="small"
              color="primary"
              variant="tonal"
              class="font-weight-bold"
            >
              <VIcon
                start
                icon="ri-file-list-3-line"
                size="14"
              />
              {{ sales.length }} {{ sales.length === 1 ? 'registro' : 'registros' }}
            </VChip>
            <VChip
              v-if="paidCount > 0"
              size="small"
              color="success"
              variant="tonal"
              class="font-weight-bold"
            >
              <VIcon
                start
                icon="ri-checkbox-circle-line"
                size="14"
              />
              {{ paidCount }} pagados
            </VChip>
          </div>

          <div class="d-flex align-center gap-2">
            <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold">Total Acumulado:</span>
            <span class="text-subtitle-1 font-weight-black text-primary">{{ formatCurrency(totalAmount) }}</span>
          </div>
        </div>

        <!-- Main Scrollable List -->
        <div class="pa-4 pa-sm-6 flex-grow-1 overflow-y-auto history-scroll-body">
          <!-- Empty State -->
          <div
            v-if="!loading && sales.length === 0"
            class="d-flex flex-column align-center justify-center py-12 text-center h-100"
          >
            <VAvatar
              size="72"
              color="secondary"
              variant="tonal"
              class="mb-3 rounded-circle opacity-80"
            >
              <VIcon
                icon="ri-inbox-2-line"
                size="36"
              />
            </VAvatar>
            <h4 class="text-h6 font-weight-bold text-high-emphasis mb-1">
              Sin registros en el historial
            </h4>
            <p class="text-body-2 text-medium-emphasis mb-0" style="max-width: 380px;">
              Este {{ props.clientId ? 'cliente' : 'vehículo' }} aún no cuenta con facturas, notas de venta o servicios registrados.
            </p>
          </div>

          <!-- History Item Cards -->
          <div
            v-else
            class="d-flex flex-column gap-3"
          >
            <VCard
              v-for="sale in sales"
              :key="sale.id"
              class="history-item-card rounded-xl border elevation-0 transition-swing"
              @click="generateSinglePDF(sale)"
            >
              <div class="d-flex flex-column flex-sm-row">
                <!-- Left Tag / Type Column -->
                <div
                  class="history-card-tag pa-4 d-flex flex-column justify-center align-start align-sm-center border-b border-sm-b-0 border-sm-e"
                  style="min-width: 150px;"
                >
                  <VChip
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="font-weight-bold text-uppercase mb-1"
                  >
                    {{ getDocumentType(sale.document_type) }}
                  </VChip>
                  <span class="text-subtitle-2 font-weight-black text-high-emphasis font-mono">
                    #{{ sale.document_number || sale.id }}
                  </span>
                  <span class="text-caption text-medium-emphasis d-flex align-center mt-1">
                    <VIcon
                      icon="ri-calendar-line"
                      size="13"
                      class="me-1"
                    />
                    {{ formatDate(sale.service_date || sale.created_at) }}
                  </span>
                </div>

                <!-- Middle Content Info -->
                <div class="pa-4 flex-grow-1 d-flex flex-column justify-center">
                  <div class="d-flex flex-wrap gap-x-6 gap-y-2">
                    <!-- Vehicle info when browsing by client -->
                    <div v-if="props.clientId">
                      <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold">
                        Vehículo
                      </div>
                      <div
                        v-if="sale.vehicle"
                        class="d-flex align-center gap-1 mt-0.5"
                      >
                        <VIcon
                          icon="ri-car-line"
                          size="16"
                          color="info"
                        />
                        <span class="font-weight-bold text-body-2 text-high-emphasis">{{ sale.vehicle.license_plate }}</span>
                        <span class="text-caption text-medium-emphasis">({{ sale.vehicle.brand }} {{ sale.vehicle.model }})</span>
                      </div>
                      <span
                        v-else
                        class="text-caption text-disabled"
                      >Venta directa / Sin vehículo</span>
                    </div>

                    <!-- Client info when browsing by vehicle -->
                    <div v-if="props.vehicleId">
                      <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold">
                        Cliente / Propietario
                      </div>
                      <div class="d-flex align-center gap-1 mt-0.5">
                        <VIcon
                          icon="ri-user-3-line"
                          size="16"
                          color="primary"
                        />
                        <span class="font-weight-bold text-body-2 text-high-emphasis">
                          {{ sale.client?.full_name || sale.client?.name || 'Consumidor Final' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Right Side: Total Amount, Status Chip & Action -->
                <div
                  class="pa-4 d-flex flex-row flex-sm-column align-center justify-space-between justify-sm-center align-sm-end border-t border-sm-t-0 gap-2"
                  style="min-width: 160px;"
                >
                  <div class="text-right">
                    <div class="text-h6 font-weight-black text-high-emphasis leading-tight">
                      {{ formatCurrency(sale.total) }}
                    </div>
                  </div>

                  <div class="d-flex align-center gap-2">
                    <VChip
                      size="small"
                      :color="getStatusColor(sale.payment_status)"
                      variant="tonal"
                      class="font-weight-bold text-uppercase"
                    >
                      <VIcon
                        start
                        :icon="sale.payment_status === 'paid' ? 'ri-check-line' : 'ri-time-line'"
                        size="13"
                      />
                      {{ getStatusText(sale.payment_status) }}
                    </VChip>

                    <VBtn
                      icon
                      size="x-small"
                      color="error"
                      variant="tonal"
                      class="rounded-lg"
                      @click.stop="generateSinglePDF(sale)"
                    >
                      <VIcon
                        icon="ri-file-pdf-2-line"
                        size="16"
                      />
                      <VTooltip
                        activator="parent"
                        location="top"
                      >
                        Ver y descargar PDF
                      </VTooltip>
                    </VBtn>
                  </div>
                </div>
              </div>
            </VCard>
          </div>
        </div>

        <!-- Pagination Controls -->
        <div
          v-if="totalPages > 1"
          class="d-flex justify-center align-center py-3 bg-surface border-t"
          style="flex-shrink: 0;"
        >
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            active-color="primary"
            density="compact"
          />
        </div>
      </VCardText>

      <VDivider />

      <!-- Dialog Action Footer -->
      <VCardActions class="pa-4 d-flex justify-space-between align-center bg-surface">
        <div class="text-caption text-medium-emphasis d-none d-sm-block">
          <VIcon
            icon="ri-information-line"
            size="14"
            class="me-1"
          />
          Haz clic en cualquier tarjeta para abrir el documento PDF
        </div>

        <VBtn
          color="secondary"
          variant="tonal"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-bold ms-auto"
          height="40"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style lang="scss" scoped>
.history-dialog-card {
  background-color: rgb(var(--v-theme-surface)) !important;
}

.history-stats-bar {
  background-color: rgba(var(--v-theme-primary), 0.03);
}

.history-scroll-body {
  background-color: rgba(var(--v-theme-on-surface), 0.02);
}

.history-card-tag {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}

.history-item-card {
  background-color: rgb(var(--v-theme-surface)) !important;
  border-color: rgba(var(--v-theme-on-surface), 0.1) !important;
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &:hover {
    border-color: rgba(var(--v-theme-primary), 0.4) !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px -4px rgba(var(--v-theme-primary), 0.15) !important;
  }
}
</style>
