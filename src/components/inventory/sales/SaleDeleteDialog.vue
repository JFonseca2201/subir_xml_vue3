<script setup>
import { ref, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  saleSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'deleteSale',
])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

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
  if (!props.saleSelected?.document_type) return 'No especificado'
  const option = documentTypeOptions.value.find(opt => opt.value === props.saleSelected.document_type)
  
  return option ? option.title : 'No especificado'
})

const getPaymentStatusLabel = computed(() => {
  if (!props.saleSelected?.payment_status) return 'No especificado'
  const option = paymentStatusOptions.value.find(opt => opt.value === props.saleSelected.payment_status)
  
  return option ? option.title : 'No especificado'
})

const getStatusLabel = computed(() => {
  if (!props.saleSelected?.status) return 'No especificado'
  const option = statusOptions.value.find(opt => opt.value === props.saleSelected.status)
  
  return option ? option.title : 'No especificado'
})

// Computed para obtener el nombre del cliente
const getClientName = computed(() => {
  if (!props.saleSelected?.client) return 'No especificado'
  
  return props.saleSelected.client.full_name || props.saleSelected.client.name || 
        `${props.saleSelected.client.first_name || ''} ${props.saleSelected.client.last_name || ''}`.trim() || 'Cliente Desconocido'
})

// Computed para obtener la placa del vehículo
const getVehicleLicensePlate = computed(() => {
  return props.saleSelected?.vehicle?.license_plate || 'No especificado'
})

// Formatear moneda
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Computed para obtener colores
const getStatusColor = computed(() => {
  const colors = {
    completed: 'success',
    pending: 'warning',
    canceled: 'error',
  }

  
  return colors[props.saleSelected?.status] || 'grey'
})

const confirmDelete = async () => {
  if (!props.saleSelected || !props.saleSelected.id) {
    console.error('No hay venta seleccionada para eliminar')
    showNotification('Error: no se puede eliminar, venta no seleccionada', 'error')
    
    return
  }

  if (props.saleSelected.status === 'canceled') {
    showNotification('Esta venta ya se encuentra anulada', 'warning')
    emit('update:isDialogVisible', false)
    
    return
  }

  if (!window.confirm(`¿Está seguro de anular el documento ${props.saleSelected.document_number}? Esta acción revertirá el stock y anulará la transacción.`)) {
    return
  }

  loader.start()

  try {
    const resp = await $api(`sales/${props.saleSelected.id}`, {
      method: "DELETE",
      onResponseError({ response }) {
        console.error('Error al eliminar venta:', response)
        console.error('Data del error:', response._data)
        console.error('Status:', response.status)
        console.error('StatusText:', response.statusText)

        let errorMessage = 'Error desconocido'

        if (response._data) {
          if (response._data.message) {
            errorMessage = response._data.message
          } else if (response._data.error) {
            errorMessage = response._data.error
          } else if (response._data.errors) {
            const firstErrorKey = Object.keys(response._data.errors)[0]
            if (firstErrorKey) {
              errorMessage = response._data.errors[firstErrorKey][0]
            }
          } else {
            errorMessage = JSON.stringify(response._data)
          }
        } else if (response.statusText) {
          errorMessage = response.statusText
        } else if (response.status) {
          errorMessage = `Error HTTP ${response.status}`
        }

        showNotification(errorMessage, 'error')
      },
    })

    showNotification('Venta anulada correctamente', 'success')
    emit('deleteSale', props.saleSelected)

    // Cerrar diálogo
    emit('update:isDialogVisible', false)

  } catch (error) {
    console.error('Error al eliminar venta:', error)

    if (props.saleSelected) {
      emit('deleteSale', props.saleSelected)
      emit('update:isDialogVisible', false)
      showNotification('Venta anulada (verificar en servidor)', 'warning')
    } else {
      showNotification('Error al anular la venta', 'error')
    }
  } finally {
    loader.stop()
  }
}

const cancelDelete = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="600px"
    persistent
    :closable="!loader.loading"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="rounded-xl elevation-8">
      <!-- Header -->
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <div class="d-flex align-center gap-2">
          <VIcon
            icon="ri-delete-bin-line"
            color="error"
          />
          <span class="text-h6 font-weight-bold">Anular Venta</span>
        </div>
        <VBtn
          icon
          variant="text"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
        >
          <VIcon icon="ri-close-line" />
        </VBtn>
      </VCardTitle>

      <VDivider />

      <!-- Content -->
      <VCardText class="pa-4">
        <div class="text-center">
          <!-- Avatar -->
          <VAvatar
            size="80"
            color="error"
            variant="tonal"
            class="mb-4"
          >
            <VIcon
              icon="ri-file-list-3-line"
              size="40"
            />
          </VAvatar>

          <!-- Sale Info -->
          <div class="mb-4">
            <h4 class="text-h6 font-weight-bold mb-2">
              {{ getDocumentTypeLabel }}
            </h4>

            <div class="d-flex flex-column gap-1">
              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-hashtag"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Número:</strong> {{ props.saleSelected?.document_number || 'Sin número' }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-user-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Cliente:</strong> {{ getClientName }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-car-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Vehículo:</strong> {{ getVehicleLicensePlate }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  icon="ri-money-dollar-circle-line"
                  size="16"
                />
                <span class="text-body-2">
                  <strong>Total:</strong> {{ formatCurrency(props.saleSelected?.total) }}
                </span>
              </div>

              <div class="d-flex align-center justify-center gap-2">
                <VIcon
                  :icon="props.saleSelected?.status === 'completed' ? 'ri-checkbox-circle-line' : props.saleSelected?.status === 'pending' ? 'ri-time-line' : 'ri-close-circle-line'"
                  size="16"
                  :color="getStatusColor"
                />
                <span class="text-body-2">
                  <strong>Estado:</strong> {{ getStatusLabel }}
                </span>
              </div>
            </div>
          </div>

          <VAlert
            type="warning"
            variant="tonal"
            class="mt-4"
            border="start"
          >
            <template #prepend>
              <VIcon icon="ri-alert-line" />
            </template>
            <div class="text-body-2">
              <strong>Advertencia:</strong> Esta acción revertirá el stock y anulará la transacción financiera.
            </div>
          </VAlert>
        </div>
      </VCardText>

      <VDivider />

      <!-- Actions -->
      <VCardActions class="pa-4">
        <VSpacer />
        <VBtn
          color="default"
          variant="outlined"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
        >
          <VIcon
            start
            icon="ri-close-line"
          />
          Cancelar
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          :loading="loader.loading"
          :disabled="loader.loading || props.saleSelected?.status === 'canceled'"
          @click="confirmDelete"
        >
          <VIcon
            start
            icon="ri-delete-bin-line"
          />
          Anular
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
