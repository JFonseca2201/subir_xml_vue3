<script setup>
import { ref, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getBrandNameById } from '@/data/vehicleBrands.js'

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

const filteredWorkOrders = computed(() => {
  if (!workOrderSearchQuery.value) return readyWorkOrders.value

  const query = workOrderSearchQuery.value.toLowerCase().trim()

  return readyWorkOrders.value.filter(order => {
    const idMatch = String(order.id).includes(query)
    const clientName = `${order.client?.name || ''} ${order.client?.surname || ''}`.toLowerCase()
    const clientDoc = String(order.client?.n_document || '').toLowerCase()
    const licensePlate = String(order.vehicle?.license_plate || '').toLowerCase()
    const brand = String(order.vehicle?.brand || '').toLowerCase()
    const model = String(order.vehicle?.model || '').toLowerCase()

    return (
      idMatch ||
      clientName.includes(query) ||
      clientDoc.includes(query) ||
      licensePlate.includes(query) ||
      brand.includes(query) ||
      model.includes(query)
    )
  })
})

const formatDate = dateStr => {
  if (!dateStr) return 'N/A'
  try {
    const date = dateStr.includes(':')
      ? new Date(dateStr.replace(' ', 'T'))
      : new Date(dateStr.replace(/-/g, '/'))
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString()
  } catch (e) {
    return dateStr
  }
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const handleSelectOrder = order => {
  emit('select-order', order)
  closeDialog()
}
</script>

<template>
  <VDialog :model-value="isDialogVisible" scrollable max-width="800px"
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="custom-dialog-card">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn" @click="closeDialog" />
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

      <VCardText class="pa-4">
        <div v-if="isLoadingWorkOrders" class="text-center pa-8">
          <VProgressCircular indeterminate color="primary" size="48" />
          <p class="mt-4">
            Cargando órdenes listas para facturar...
          </p>
        </div>

        <div v-else-if="readyWorkOrders.length === 0" class="text-center pa-8">
          <VIcon icon="ri-file-list-3-line" size="64" color="grey-lighten-1" />
          <p class="mt-4 text-grey">
            No hay órdenes de trabajo listas para facturar.
          </p>
        </div>

        <div v-else>
          <VTextField v-model="workOrderSearchQuery" placeholder="Buscar orden (placa, cliente, #)..."
            prepend-inner-icon="ri-search-line" variant="outlined" density="compact" class="mb-4" hide-details
            clearable />
          <div class="border rounded-lg overflow-x-auto">
            <VTable density="comfortable" hover>
              <thead>
                <tr>
                  <th>OT #</th>
                  <th>Cliente</th>
                  <th>Vehículo</th>
                  <th>Fecha Ingreso</th>
                  <th class="text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in filteredWorkOrders" :key="order.id">
                  <td class="font-weight-medium">
                    OT-{{ order.id }}
                  </td>
                  <td>
                    {{ order.client?.name }} {{ order.client?.surname }}<br>
                    <small class="text-grey">{{ order.client?.n_document }}</small>
                  </td>
                  <td>
                    {{ order.vehicle?.license_plate }}<br>
                    <small class="text-grey">
                      {{ getBrandNameById(order.vehicle?.brand) }} {{ order.vehicle?.model }}
                    </small>
                  </td>
                  <td>
                    {{ formatDate(order.entry_date) }}
                  </td>
                  <td class="text-right">
                    <VBtn color="primary" size="small" variant="elevated" @click="handleSelectOrder(order)">
                      Importar
                    </VBtn>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;">
        <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium" height="40" @click="closeDialog">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
