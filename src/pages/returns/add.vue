<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const router = useRouter()
const { showNotification } = useGlobalToast()

const loading = ref(false)
const processing = ref(false)

const searchSaleNumber = ref('')
const sale = ref(null)
const foundSales = ref([])

const returnForm = ref({
  sale_id: null,
  type: 'partial',
  reason: '',
  refund_amount: 0,
  items: [],
})

const searchSale = async () => {
  if (!searchSaleNumber.value) {
    showNotification('Ingrese el número de documento, cédula o nombre', 'warning')
    return
  }

  loading.value = true
  foundSales.value = []
  sale.value = null

  try {
    const response = await $api('sales', {
      params: { search: searchSaleNumber.value }
    })

    let sales = response?.data?.data || []
    
    // Solo permitir ventas y facturas, excluyendo cotizaciones
    sales = sales.filter(s => s.document_type !== 'quote')

    if (sales.length === 1) {
      selectSale(sales[0])
    } else if (sales.length > 1) {
      foundSales.value = sales
      showNotification(`Se encontraron ${sales.length} ventas. Seleccione la correcta.`, 'info')
    } else {
      showNotification('Venta no encontrada', 'error')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al buscar la venta', 'error')
  } finally {
    loading.value = false
  }
}

const selectSale = async (selectedSaleInfo) => {
  if (selectedSaleInfo.status === 'canceled') {
    showNotification('No se puede hacer devolución sobre una venta anulada', 'error')
    return
  }

  loading.value = true
  try {
    const saleDetail = await $api(`sales/${selectedSaleInfo.id}`)
    sale.value = saleDetail?.data || saleDetail

    returnForm.value.sale_id = sale.value.id
    returnForm.value.items = sale.value.details.map(d => ({
      ...d,
      return_quantity: 0,
      max_quantity: d.quantity,
      // Usar el precio efectivo por unidad (ya descontado) en lugar del precio base
      price: d.quantity > 0 ? Number((d.total / d.quantity).toFixed(2)) : d.price
    }))

    foundSales.value = []
    showNotification('Venta seleccionada correctamente', 'success')
  } catch (error) {
    console.error(error)
    showNotification('Error al cargar los detalles de la venta', 'error')
  } finally {
    loading.value = false
  }
}

const totalRefund = computed(() => {
  if (!returnForm.value.items.length) return 0
  return returnForm.value.items.reduce((total, item) => {
    return total + (item.return_quantity * item.price)
  }, 0)
})

const clampQuantity = (item, val) => {
  if (val > item.max_quantity) {
    item.return_quantity = item.max_quantity
    showNotification(`Solo puede devolver hasta ${item.max_quantity} unidades de ${item.description}`, 'warning')
  } else if (val < 0) {
    item.return_quantity = 0
  }
}

const submitReturn = async () => {
  for (const item of returnForm.value.items) {
    if (item.return_quantity > item.max_quantity) {
      showNotification(`La cantidad a devolver de ${item.description} excede el máximo permitido.`, 'warning')
      return
    }
  }

  const itemsToReturn = returnForm.value.items.filter(i => i.return_quantity > 0)
  if (itemsToReturn.length === 0) {
    showNotification('Debe seleccionar al menos un producto para devolver', 'warning')
    return
  }
  if (!returnForm.value.reason.trim()) {
    showNotification('Debe ingresar el motivo de la devolución', 'warning')
    return
  }

  processing.value = true
  try {
    const isTotal = returnForm.value.items.every(i => i.return_quantity === i.max_quantity)
    const payload = {
      sale_id: returnForm.value.sale_id,
      type: isTotal ? 'total' : 'partial',
      reason: returnForm.value.reason,
      refund_amount: totalRefund.value,
      items: itemsToReturn.map(i => ({
        product_id: i.product_id,
        description: i.description,
        quantity: i.return_quantity,
        price: i.price
      }))
    }

    const res = await $api('returns', {
      method: 'POST',
      body: payload
    })

    if (res?.success) {
      showNotification('Devolución procesada correctamente', 'success')
      router.push('/returns/list')
    }
  } catch (error) {
    console.error(error)
    showNotification(error?.response?._data?.message || 'Error al procesar devolución', 'error')
  } finally {
    processing.value = false
  }
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}
</script>

<template>
  <div class="pa-4 pa-sm-6">
    <!-- Header Section -->
    <div class="d-flex align-center gap-4 mb-6">
      <VBtn icon="ri-arrow-left-line" variant="tonal" color="primary" class="rounded-lg elevation-2"
        @click="router.push('/returns/list')" />
      <div>
        <h1 class="text-h3 font-weight-bold text-primary mb-1 d-flex align-center gap-2">
          <VIcon icon="ri-refund-2-fill" size="40" />
          Procesar Devolución
        </h1>
        <p class="text-medium-emphasis mb-0 text-body-1">
          Busca la venta original y selecciona los artículos a retornar al inventario.
        </p>
      </div>
    </div>

    <!-- Buscador Principal -->
    <VCard class="mb-8 rounded-xl elevation-3 border-0 overflow-visible">
      <VCardText class="pa-6">
        <VRow align="center">
          <VCol cols="12" md="9">
            <VTextField v-model="searchSaleNumber" 
              label="Buscar Venta (Nº Factura, Cédula, Placa o Nombre)"
              placeholder="Ej: 1712345678 o FAC-001"
              prepend-inner-icon="ri-search-2-line" 
              variant="outlined" 
              hide-details 
              rounded="lg"
              color="primary"
              bg-color="surface"
              class="search-input-hover"
              @keyup.enter="searchSale" />
          </VCol>
          <VCol cols="12" md="3">
            <VBtn color="primary" block size="x-large" rounded="lg" class="elevation-2 text-button font-weight-bold" :loading="loading" @click="searchSale" prepend-icon="ri-search-eye-line">
              Buscar
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Lista de Múltiples Resultados -->
    <VExpandTransition>
      <div v-if="foundSales.length > 0 && !sale">
        <h3 class="text-h5 font-weight-bold mb-4 d-flex align-center gap-2 text-primary">
          <VIcon icon="ri-list-check" />
          Múltiples coincidencias encontradas
        </h3>
        <VRow>
          <VCol v-for="s in foundSales" :key="s.id" cols="12" md="6" lg="4">
            <VCard variant="outlined" class="h-100 rounded-lg hover-card transition-swing" @click="selectSale(s)" :class="{'opacity-50': s.status === 'canceled'}" :disabled="s.status === 'canceled'">
              <VCardText class="pa-5">
                <div class="d-flex justify-space-between align-start mb-3">
                  <VChip size="small" :color="s.document_type === 'invoice' ? 'primary' : 'info'" class="font-weight-bold">
                    {{ s.document_number }}
                  </VChip>
                  <VChip size="small" :color="s.status === 'canceled' ? 'error' : 'success'" variant="flat">
                    {{ s.status === 'canceled' ? 'Anulada' : 'Válida' }}
                  </VChip>
                </div>
                
                <div class="d-flex align-center gap-3 mb-2">
                  <VAvatar color="primary-lighten-4" size="40" rounded>
                    <VIcon icon="ri-user-3-line" color="primary" />
                  </VAvatar>
                  <div>
                    <div class="text-subtitle-2 font-weight-bold">{{ s.client?.full_name || s.client?.name || 'Consumidor Final' }}</div>
                    <div class="text-caption text-medium-emphasis">{{ s.service_date?.split('T')[0] }}</div>
                  </div>
                </div>

                <div class="d-flex justify-space-between align-end mt-4 pt-4 border-t">
                  <span class="text-body-2 text-medium-emphasis">Total Venta</span>
                  <span class="text-h6 font-weight-bold text-primary">{{ formatCurrency(s.total) }}</span>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </div>
    </VExpandTransition>

    <!-- Área de Trabajo de Devolución -->
    <VExpandTransition>
      <div v-if="sale">
        <VRow>
          <!-- Resumen de la Venta (Izquierda) -->
          <VCol cols="12" md="4" lg="3">
            <VCard class="rounded-xl elevation-2 h-100 border-thin">
              <VCardTitle class="pa-5 pb-0 text-h5 font-weight-bold d-flex align-center gap-2 text-primary">
                <VIcon icon="ri-information-line" />
                Resumen de Venta
              </VCardTitle>
              
              <VCardText class="pa-5">
                <VList class="bg-transparent" lines="two" density="compact">
                  <VListItem class="px-0">
                    <template #prepend>
                      <VAvatar color="primary" variant="tonal" size="42" rounded class="mr-3">
                        <VIcon icon="ri-file-list-3-line" />
                      </VAvatar>
                    </template>
                    <VListItemSubtitle class="text-uppercase text-caption font-weight-bold mb-1">Documento</VListItemSubtitle>
                    <VListItemTitle class="text-h6 font-weight-bold">{{ sale.document_number }}</VListItemTitle>
                  </VListItem>

                  <VListItem class="px-0 mt-3">
                    <template #prepend>
                      <VAvatar color="info" variant="tonal" size="42" rounded class="mr-3">
                        <VIcon icon="ri-calendar-2-line" />
                      </VAvatar>
                    </template>
                    <VListItemSubtitle class="text-uppercase text-caption font-weight-bold mb-1">Fecha</VListItemSubtitle>
                    <VListItemTitle class="text-subtitle-1 font-weight-medium">{{ sale.service_date?.split('T')[0] }}</VListItemTitle>
                  </VListItem>

                  <VListItem class="px-0 mt-3">
                    <template #prepend>
                      <VAvatar color="success" variant="tonal" size="42" rounded class="mr-3">
                        <VIcon icon="ri-user-heart-line" />
                      </VAvatar>
                    </template>
                    <VListItemSubtitle class="text-uppercase text-caption font-weight-bold mb-1">Cliente</VListItemSubtitle>
                    <VListItemTitle class="text-subtitle-1 font-weight-medium" style="white-space: normal;">
                      {{ sale.client?.full_name || sale.client?.name || 'Consumidor Final' }}
                    </VListItemTitle>
                  </VListItem>

                  <VListItem class="px-0 mt-3">
                    <template #prepend>
                      <VAvatar color="warning" variant="tonal" size="42" rounded class="mr-3">
                        <VIcon icon="ri-money-dollar-circle-line" />
                      </VAvatar>
                    </template>
                    <VListItemSubtitle class="text-uppercase text-caption font-weight-bold mb-1">Total Original</VListItemSubtitle>
                    <VListItemTitle class="text-h5 font-weight-bold text-primary">{{ formatCurrency(sale.total) }}</VListItemTitle>
                  </VListItem>
                </VList>
                
                <VDivider class="my-5" />
                
                <div class="d-flex flex-column gap-2">
                  <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis text-center">
                    Estado de la Venta
                  </div>
                  <VChip 
                    size="large" 
                    :color="sale.payment_status === 'paid' ? 'success' : 'warning'" 
                    variant="flat"
                    class="font-weight-bold w-100 justify-center py-5 text-subtitle-1 rounded-lg elevation-1"
                  >
                    <VIcon :icon="sale.payment_status === 'paid' ? 'ri-checkbox-circle-fill' : 'ri-time-fill'" start size="22" />
                    {{ sale.payment_status === 'paid' ? 'Factura Pagada' : 'Crédito / Pendiente' }}
                  </VChip>
                </div>
              </VCardText>
            </VCard>
          </VCol>

          <!-- Tabla de Productos y Motivo (Derecha) -->
          <VCol cols="12" md="8" lg="9">
            <VCard class="rounded-xl elevation-3 border-0 overflow-hidden h-100 d-flex flex-column">
              <VCardTitle class="pa-5 bg-grey-lighten-4 border-b d-flex align-center justify-space-between">
                <div class="d-flex align-center gap-2 text-h5 font-weight-bold text-primary">
                  <VIcon icon="ri-shopping-cart-2-line" />
                  Selección de Artículos
                </div>
                <VChip color="primary" variant="tonal" size="small" class="font-weight-bold">
                  {{ returnForm.items.length }} ítem(s) en factura
                </VChip>
              </VCardTitle>

              <VTable hover class="flex-grow-1 table-modern">
                <thead class="bg-grey-lighten-5">
                  <tr>
                    <th class="text-uppercase text-caption font-weight-bold text-medium-emphasis">Producto</th>
                    <th class="text-center text-uppercase text-caption font-weight-bold text-medium-emphasis">C. Orig</th>
                    <th class="text-right text-uppercase text-caption font-weight-bold text-medium-emphasis">Precio Un.</th>
                    <th class="text-center text-uppercase text-caption font-weight-bold text-primary bg-primary-lighten-5" style="width: 180px">Devolución</th>
                    <th class="text-right text-uppercase text-caption font-weight-bold text-medium-emphasis">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in returnForm.items" :key="item.id" class="transition-swing">
                    <td class="py-3">
                      <div class="font-weight-bold text-body-1">{{ item.description }}</div>
                    </td>
                    <td class="text-center font-weight-medium text-medium-emphasis">
                      <VChip size="small" variant="tonal">{{ item.max_quantity }}</VChip>
                    </td>
                    <td class="text-right text-medium-emphasis">{{ formatCurrency(item.price) }}</td>
                    <td class="bg-primary-lighten-5 px-4">
                      <VTextField v-model.number="item.return_quantity" type="number" min="0" :max="item.max_quantity"
                        @update:model-value="val => clampQuantity(item, val)" density="compact" variant="outlined"
                        hide-details color="primary" bg-color="white" class="centered-input rounded" />
                    </td>
                    <td class="text-right font-weight-bold text-error text-subtitle-1">
                      {{ formatCurrency(item.return_quantity * item.price) }}
                    </td>
                  </tr>
                </tbody>
              </VTable>

              <!-- Resumen Final y Botón -->
              <div class="bg-grey-lighten-4 pa-6 border-t mt-auto">
                <VRow>
                  <VCol cols="12" md="7">
                    <div class="text-subtitle-2 font-weight-bold mb-2 text-medium-emphasis">
                      <VIcon icon="ri-chat-1-line" size="small" class="mr-1" />
                      Justificación requerida
                    </div>
                    <VTextarea v-model="returnForm.reason" label="Motivo de la Devolución"
                      placeholder="Ej: Producto en mal estado, error de facturación..." variant="solo" rounded="lg" rows="3"
                      hide-details bg-color="white" class="elevation-1" />
                  </VCol>
                  
                  <VCol cols="12" md="5" class="d-flex flex-column justify-end">
                    <div class="bg-white rounded-xl pa-5 elevation-2 border-primary border-thin d-flex flex-column align-end">
                      <div class="text-uppercase text-caption font-weight-bold text-medium-emphasis mb-1">
                        Monto a Reintegrar
                      </div>
                      <div class="text-h3 font-weight-black text-error mb-4">
                        {{ formatCurrency(totalRefund) }}
                      </div>
                      
                      <VBtn color="error" size="x-large" block rounded="lg" class="text-button font-weight-bold elevation-3" 
                            prepend-icon="ri-check-double-line" :loading="processing" @click="submitReturn">
                        Confirmar Devolución
                      </VBtn>
                    </div>
                  </VCol>
                </VRow>
              </div>
            </VCard>
          </VCol>
        </VRow>
      </div>
    </VExpandTransition>
  </div>
</template>

<style scoped>
.hover-card {
  cursor: pointer;
}
.hover-card:hover {
  border-color: rgb(var(--v-theme-primary)) !important;
  transform: translateY(-4px);
  box-shadow: 0 10px 20px -10px rgba(var(--v-theme-primary), 0.3) !important;
  background-color: rgba(var(--v-theme-primary), 0.02);
}

.search-input-hover:hover {
  transform: translateY(-1px);
  transition: transform 0.2s ease;
}

/* Círculos decorativos para la tarjeta resumen */
.decorative-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  pointer-events: none;
}
.circle-1 {
  width: 200px;
  height: 200px;
  top: -50px;
  right: -50px;
}
.circle-2 {
  width: 150px;
  height: 150px;
  bottom: -30px;
  left: -20px;
  background: rgba(255, 255, 255, 0.03);
}

.z-1 {
  z-index: 1;
}

/* Mejora para la tabla */
.table-modern tbody tr:hover {
  background-color: rgba(var(--v-theme-primary), 0.03) !important;
}

/* Centrar el texto en el input de cantidad */
:deep(.centered-input input) {
  text-align: center;
  font-weight: bold;
  font-size: 1.1rem;
}
</style>
