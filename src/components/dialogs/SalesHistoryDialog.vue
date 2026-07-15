<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

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
    default: 'Historial',
  },
  subtitle: {
    type: String,
    default: 'Ventas y Facturas',
  },
})

const emit = defineEmits(['update:modelValue'])

const dialog = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
})

const loading = ref(false)
const sales = ref([])
const totalPages = ref(1)
const currentPage = ref(1)

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

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const getStatusColor = (status) => {
  switch (status) {
    case 'paid': return 'success'
    case 'partial': return 'warning'
    case 'pending': return 'error'
    default: return 'grey'
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'paid': return 'Pagado'
    case 'partial': return 'Abonado'
    case 'pending': return 'Pendiente'
    default: return status
  }
}

const getDocumentType = (type) => {
  switch (type) {
    case 'invoice': return 'Factura'
    case 'sale_note': return 'Nota de Venta'
    default: return type
  }
}

const generateSinglePDF = (sale) => {
  const token = localStorage.getItem('token')
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
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
  <VDialog v-model="dialog" max-width="850">
    <VCard class="rounded-lg d-flex flex-column" height="80vh">
      <VCardTitle class="d-flex justify-space-between align-center pa-5 bg-grey-lighten-4 border-bottom-light" style="flex-shrink: 0;">
        <div class="d-flex align-center">
          <VAvatar color="primary" variant="tonal" class="me-3" size="42">
            <VIcon icon="ri-history-line" size="24" />
          </VAvatar>
          <div>
            <h3 class="text-h6 font-weight-bold mb-0 text-grey-darken-3">{{ props.title }}</h3>
            <p class="text-caption text-medium-emphasis mb-0">{{ props.subtitle }}</p>
          </div>
        </div>
        <IconBtn @click="dialog = false" class="bg-white elevation-1">
          <VIcon icon="ri-close-line" />
        </IconBtn>
      </VCardTitle>

      <VCardText class="pa-0 position-relative d-flex flex-column flex-grow-1 overflow-hidden">
        <VProgressLinear v-if="loading" indeterminate color="primary" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" height="3" />

        <div class="pa-6 flex-grow-1 overflow-y-auto bg-grey-lighten-5">
          <div v-if="!loading && sales.length === 0" class="d-flex flex-column align-center justify-center py-10 text-center h-100">
            <VIcon icon="ri-inbox-line" size="48" color="grey-lighten-2" class="mb-2" />
            <h3 class="text-h6 font-weight-bold text-grey-darken-2">No hay registros</h3>
            <p class="text-body-2 text-grey">Este {{ props.clientId ? 'cliente' : 'vehículo' }} no tiene ventas o facturas asociadas.</p>
          </div>

          <div v-else class="history-list">
            <VCard v-for="sale in sales" :key="sale.id" 
              class="mb-3 rounded-lg border border-opacity-50 overflow-hidden cursor-pointer hover-effect" 
              elevation="0" 
              color="white"
              @click="generateSinglePDF(sale)">
              <div class="d-flex flex-column flex-sm-row">
                <!-- Sección izquierda: Fecha y Tipo -->
                <div class="d-flex flex-column justify-center pa-4 bg-grey-lighten-5 border-e border-opacity-50" style="min-width: 140px; text-align: center;">
                  <span class="text-caption font-weight-bold text-uppercase text-grey-darken-1 mb-1">{{ getDocumentType(sale.document_type) }}</span>
                  <span class="text-subtitle-1 font-weight-bold text-primary mb-1">#{{ sale.document_number }}</span>
                  <span class="text-caption font-weight-medium text-grey-darken-2 d-flex align-center justify-center">
                    <VIcon icon="ri-calendar-event-line" size="14" class="me-1" />
                    {{ formatDate(sale.service_date) }}
                  </span>
                </div>

                <!-- Sección central: Detalles -->
                <div class="pa-4 flex-grow-1 d-flex flex-column justify-center">
                  <div class="d-flex flex-wrap gap-4">
                    <div v-if="props.vehicleId">
                      <div class="text-caption text-grey text-uppercase font-weight-bold mb-1">Cliente</div>
                      <div class="d-flex align-center">
                        <VIcon icon="ri-user-line" size="16" class="me-1 text-primary"/>
                        <span class="font-weight-medium text-grey-darken-3 text-body-2">{{ sale.client?.full_name || sale.client?.name }}</span>
                      </div>
                    </div>
                    
                    <div v-if="props.clientId">
                      <div class="text-caption text-grey text-uppercase font-weight-bold mb-1">Vehículo</div>
                      <div class="d-flex align-center" v-if="sale.vehicle">
                        <VIcon icon="ri-car-line" size="16" class="me-1 text-info"/>
                        <span class="font-weight-medium text-grey-darken-3 text-body-2 me-2">{{ sale.vehicle.license_plate }}</span>
                        <span class="text-caption text-grey">{{ sale.vehicle.brand }} {{ sale.vehicle.model }}</span>
                      </div>
                      <span v-else class="text-caption text-grey-lighten-1">No asignado</span>
                    </div>
                  </div>
                </div>

                <!-- Sección derecha: Total y Estado -->
                <div class="pa-4 d-flex flex-sm-column flex-row align-center justify-space-between justify-sm-center align-sm-end" style="min-width: 140px;">
                  <div class="text-h6 font-weight-bold text-grey-darken-4 mb-sm-2">
                    {{ formatCurrency(sale.total) }}
                  </div>
                  <VChip size="small" :color="getStatusColor(sale.payment_status)" variant="tonal" class="font-weight-medium text-uppercase px-2">
                    {{ getStatusText(sale.payment_status) }}
                  </VChip>
                </div>
              </div>
            </VCard>
          </div>
        </div>

        <div class="d-flex justify-center align-center py-3 bg-white border-top-light" v-if="totalPages > 1" style="flex-shrink: 0; box-shadow: 0 -2px 5px rgba(0,0,0,0.05); z-index: 2;">
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" active-color="primary"
            density="compact" />
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.hover-effect {
  transition: all 0.2s ease-in-out;
}
.hover-effect:hover {
  background-color: #fcfcfc !important;
  border-color: rgba(var(--v-theme-primary), 0.5) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px -4px rgba(0,0,0,0.1) !important;
}
</style>
