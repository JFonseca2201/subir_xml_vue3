<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  saleData: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:isDialogVisible'])

// Opciones para selects (solo para mostrar labels)
const documentTypeOptions = ref([
  { title: 'Cotización', value: 'quote' },
  { title: 'Nota de Venta', value: 'sale_note' },
  { title: 'Factura', value: 'invoice' },
])

const paymentStatusOptions = ref([
  { title: 'Pagado', value: 'paid' },
  { title: 'Parcial', value: 'partial' },
  { title: 'Pendiente', value: 'pending' },
])

const statusOptions = ref([
  { title: 'Completada', value: 'completed' },
  { title: 'Pendiente', value: 'pending' },
  { title: 'Anulada', value: 'canceled' },
])

// Computed properties para obtener labels
const getDocumentTypeLabel = computed(() => {
  if (!props.saleData?.document_type) return 'No especificado'
  const option = documentTypeOptions.value.find(opt => opt.value === props.saleData.document_type)
  
  return option ? option.title : 'No especificado'
})

const getPaymentStatusLabel = computed(() => {
  if (!props.saleData?.payment_status) return 'No especificado'
  const option = paymentStatusOptions.value.find(opt => opt.value === props.saleData.payment_status)
  
  return option ? option.title : 'No especificado'
})

const getStatusLabel = computed(() => {
  if (!props.saleData?.status) return 'No especificado'
  const option = statusOptions.value.find(opt => opt.value === props.saleData.status)
  
  return option ? option.title : 'No especificado'
})

// Computed para obtener colores
const getDocumentTypeColor = computed(() => {
  const colors = {
    quote: 'info',
    sale_note: 'primary',
    invoice: 'deep-purple',
  }

  
  return colors[props.saleData?.document_type] || 'grey'
})

const getPaymentStatusColor = computed(() => {
  const colors = {
    paid: 'success',
    partial: 'warning',
    pending: 'error',
  }

  
  return colors[props.saleData?.payment_status] || 'grey'
})

const getStatusColor = computed(() => {
  const colors = {
    completed: 'success',
    pending: 'warning',
    canceled: 'error',
  }

  
  return colors[props.saleData?.status] || 'grey'
})

// Computed para obtener el nombre del cliente
const getClientName = computed(() => {
  if (!props.saleData?.client) return 'No especificado'
  
  return props.saleData.client.full_name || props.saleData.client.name || 
        `${props.saleData.client.first_name || ''} ${props.saleData.client.last_name || ''}`.trim() || 'Cliente Desconocido'
})

// Computed para obtener el documento del cliente
const getClientDocument = computed(() => {
  return props.saleData?.client?.n_document || 'No especificado'
})

// Computed para obtener la placa del vehículo
const getVehicleLicensePlate = computed(() => {
  return props.saleData?.vehicle?.license_plate || 'No especificado'
})

// Computed para obtener información del vehículo
const getVehicleInfo = computed(() => {
  if (!props.saleData?.vehicle) return null
  const vehicle = props.saleData.vehicle
  
  return `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Vehículo'
})

// Computed para obtener los pagos distribuidos
const getPaymentDistributions = computed(() => {
  if (!props.saleData?.finance_record?.payment_distributions) return []
  
  return props.saleData.finance_record.payment_distributions
})

// Computed para verificar si tiene pagos distribuidos
const hasPaymentDistributions = computed(() => {
  return getPaymentDistributions.value.length > 0
})

// Formatear moneda
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Formatear fecha
const formatDate = dateString => {
  if (!dateString) return '-'
  const [year, month, day] = dateString.split('T')[0].split('-')
  
  return `${day}/${month}/${year}`
}

// Cerrar diálogo
const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    max-width="1000"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard
      class="pa-0"
      elevation="8"
    >
      <!-- Header con gradiente -->
      <VCardTitle
        class="pa-6 text-center position-relative bg-gradient-to-r from-primary to-primary-darken-1"
        dark
      >
        <VBtn
          icon="ri-close-line"
          variant="text"
          class="position-absolute"
          style="top: 16px; right: 16px;"
          @click="closeDialog"
        />

        <!-- Icono y tipo de documento -->
        <div class="d-flex flex-column align-center mb-3">
          <VIcon
            icon="ri-file-list-3-line"
            size="48"
            class="mb-2"
          />
          <div class="text-h5 font-weight-bold">
            {{ getDocumentTypeLabel }}
          </div>
          <div class="text-body-1 opacity-90">
            {{ saleData.document_number }}
          </div>
        </div>

        <!-- Chip de estado -->
        <VChip
          :color="getStatusColor"
          variant="elevated"
          size="small"
        >
          <VIcon
            start
            :icon="saleData.status === 'completed' ? 'ri-checkbox-circle-line' : saleData.status === 'pending' ? 'ri-time-line' : 'ri-close-circle-line'"
          />
          {{ getStatusLabel }}
        </VChip>
      </VCardTitle>

      <!-- Contenido principal -->
      <VCardText class="pa-6">
        <VRow>
          <!-- Tarjeta de Información General -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4 h-100"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-file-info-line"
                  color="primary"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Información General</span>
              </VCardTitle>

              <VRow dense>
                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Tipo de Documento
                    </div>
                    <VChip
                      :color="getDocumentTypeColor"
                      size="small"
                      variant="tonal"
                    >
                      {{ getDocumentTypeLabel }}
                    </VChip>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Número de Documento
                    </div>
                    <div class="text-body-1 font-weight-medium">
                      {{ saleData.document_number }}
                    </div>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Fecha de Servicio
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-calendar-line"
                        size="16"
                        class="me-1 text-primary"
                      />
                      <span class="text-body-2">{{ formatDate(saleData.service_date) }}</span>
                    </div>
                  </div>
                </VCol>

                <VCol cols="6">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Estado de Pago
                    </div>
                    <VChip
                      :color="getPaymentStatusColor"
                      size="small"
                      variant="tonal"
                    >
                      {{ getPaymentStatusLabel }}
                    </VChip>
                  </div>
                </VCol>

                <VCol cols="6">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Método de Pago
                    </div>
                    <div class="text-body-2">
                      {{ saleData.payment_method || 'No especificado' }}
                    </div>
                  </div>
                </VCol>

                <VCol
                  v-if="hasPaymentDistributions"
                  cols="12"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Detalle de Pagos
                    </div>
                    <div class="border rounded-lg overflow-hidden mt-2">
                      <VTable
                        class="text-no-wrap"
                        density="compact"
                      >
                        <thead class="bg-grey-lighten-4">
                          <tr>
                            <th style="width: 50px;">
                              #
                            </th>
                            <th>Forma de Pago</th>
                            <th>Cuenta</th>
                            <th class="text-right">
                              Monto
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="(dist, index) in getPaymentDistributions"
                            :key="(typeof item !== 'undefined' ? (item.id || item.product_id || index) : (typeof dist !== 'undefined' ? (dist.id || index) : index))"
                          >
                            <td class="pa-2 text-center font-weight-medium">
                              {{ index + 1 }}
                            </td>
                            <td class="pa-2">
                              {{ dist.payment_method }}
                            </td>
                            <td class="pa-2">
                              {{ dist.account?.name || 'Cuenta ' + dist.account_id }}
                            </td>
                            <td class="pa-2 text-right font-weight-bold">
                              {{ formatCurrency(dist.amount) }}
                            </td>
                          </tr>
                        </tbody>
                      </VTable>
                    </div>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Kilometraje
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-speed-up-line"
                        size="16"
                        class="me-1 text-info"
                      />
                      <span class="text-body-2">{{ saleData.mileage || 'No especificado' }} km</span>
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Cliente y Vehículo -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4 h-100"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-user-vehicle-line"
                  color="success"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Cliente y Vehículo</span>
              </VCardTitle>

              <VRow dense>
                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Cliente
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-user-line"
                        size="16"
                        class="me-1 text-success"
                      />
                      <span class="text-body-2 font-weight-medium">{{ getClientName }}</span>
                    </div>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Documento del Cliente
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-id-card-line"
                        size="16"
                        class="me-1 text-info"
                      />
                      <span class="text-body-2">{{ getClientDocument }}</span>
                    </div>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Vehículo
                    </div>
                    <div
                      v-if="saleData.vehicle"
                      class="d-flex align-center"
                    >
                      <VIcon
                        icon="ri-car-line"
                        size="16"
                        class="me-1 text-warning"
                      />
                      <VChip
                        size="small"
                        variant="outlined"
                        color="primary"
                        class="font-weight-bold"
                      >
                        {{ getVehicleLicensePlate }}
                      </VChip>
                    </div>
                    <span
                      v-else
                      class="text-body-2 text-medium-emphasis"
                    >No especificado</span>
                  </div>
                </VCol>

                <VCol
                  v-if="saleData.vehicle"
                  cols="12"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Información del Vehículo
                    </div>
                    <div class="text-body-2">
                      {{ getVehicleInfo }}
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Detalle de Items -->
          <VCol cols="12">
            <VCard
              class="pa-4"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-shopping-cart-2-line"
                  color="warning"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Detalle de Productos/Servicios</span>
              </VCardTitle>

              <div
                v-if="saleData.details && saleData.details.length > 0"
                class="border rounded-lg overflow-hidden"
              >
                <VTable class="text-no-wrap">
                  <thead class="bg-grey-lighten-4">
                    <tr>
                      <th>Descripción</th>
                      <th style="width: 100px;">
                        Cantidad
                      </th>
                      <th style="width: 120px;">
                        Precio Unit.
                      </th>
                      <th style="width: 120px;">
                        Descuento
                      </th>
                      <th
                        style="width: 120px;"
                        class="text-right"
                      >
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(item, index) in saleData.details"
                      :key="(typeof item !== 'undefined' ? (item.id || item.product_id || index) : (typeof dist !== 'undefined' ? (dist.id || index) : index))"
                    >
                      <td class="pa-2">
                        {{ item.description }}
                      </td>
                      <td class="pa-2">
                        {{ item.quantity }}
                      </td>
                      <td class="pa-2">
                        {{ formatCurrency(item.price) }}
                      </td>
                      <td class="pa-2">
                        {{ formatCurrency(item.discount || 0) }}
                      </td>
                      <td class="pa-2 text-right font-weight-bold">
                        {{ formatCurrency(item.total) }}
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
              <div
                v-else
                class="text-center pa-4 text-medium-emphasis"
              >
                No hay productos/servicios agregados
              </div>
            </VCard>
          </VCol>

          <!-- Tarjeta de Totales -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-money-dollar-circle-line"
                  color="success"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Totales</span>
              </VCardTitle>

              <VRow dense>
                <VCol cols="12">
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="text-body-2">Subtotal</span>
                    <span class="text-body-1 font-weight-medium">{{ formatCurrency(saleData.subtotal) }}</span>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="text-body-2">IVA (15%)</span>
                    <span class="text-body-1 font-weight-medium">{{ formatCurrency(saleData.tax_amount) }}</span>
                  </div>
                </VCol>

                <VDivider class="my-2" />

                <VCol cols="12">
                  <div class="d-flex justify-space-between align-center">
                    <span class="text-h6 font-weight-bold">Total</span>
                    <span class="text-h5 font-weight-bold text-primary">{{ formatCurrency(saleData.total) }}</span>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Observaciones -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-file-text-line"
                  color="info"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Observaciones</span>
              </VCardTitle>

              <div class="text-body-2">
                {{ saleData.observations || 'Sin observaciones' }}
              </div>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Footer con botones -->
      <VDivider />
      <VCardActions class="pa-4 justify-center">
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-close-line"
          class="px-6"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
