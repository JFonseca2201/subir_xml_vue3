<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useFormDraft } from '@/composables/useFormDraft'

const router = useRouter()
const { showNotification } = useGlobalToast()

const loading = ref(false)
const loadingRecent = ref(false)
const processing = ref(false)

const searchSaleNumber = ref('')
const hasSearched = ref(false)
const sale = ref(null)
const foundSales = ref([])
const recentSales = ref([])

const returnForm = ref({
  sale_id: null,
  type: 'partial',
  reason: '',
  refund_amount: 0,
  items: [],
})

const returnDraftState = computed({
  get: () => ({
    sale: sale.value,
    returnForm: returnForm.value,
    searchSaleNumber: searchSaleNumber.value,
  }),
  set: val => {
    if (!val) return
    if (val.sale) sale.value = val.sale
    if (val.returnForm) returnForm.value = val.returnForm
    if (val.searchSaleNumber) searchSaleNumber.value = val.searchSaleNumber
  },
})

const resetForm = () => {
  searchSaleNumber.value = ''
  hasSearched.value = false
  sale.value = null
  foundSales.value = []
  returnForm.value = {
    sale_id: null,
    type: 'partial',
    reason: '',
    refund_amount: 0,
    items: [],
  }
}
const resetReturnForm = resetForm

const cancelAndReturn = () => {
  clearDraft()
  resetForm()
  router.push('/returns/list')
}

const { hasDraft, draftTimestamp, clearDraft, discardDraft } = useFormDraft('returns_add', returnDraftState, {
  clearOnRouteLeave: true,
  resetForm,
  isMeaningful: data => !!(data.sale_id || (data.items && data.items.length > 0) || (data.reason && data.reason.trim())),
})

// Cargar ventas recientes disponibles
const loadRecentSales = async () => {
  loadingRecent.value = true
  try {
    const response = await $api('sales', {
      params: { per_page: 6 },
    })

    const list = response?.data?.data || []

    recentSales.value = list.filter(s => s.document_type !== 'quote' && s.status !== 'canceled')
  } catch (err) {
    console.error('Error al cargar ventas recientes:', err)
  } finally {
    loadingRecent.value = false
  }
}

const searchSale = async () => {
  const query = (searchSaleNumber.value || '').trim()
  if (!query) {
    showNotification('Ingrese el número de comprobante, cédula o nombre', 'warning')
    return
  }

  loading.value = true
  hasSearched.value = true
  foundSales.value = []
  sale.value = null

  try {
    const response = await $api('sales', {
      params: { search: query },
    })

    let sales = response?.data?.data || []

    // Solo permitir ventas y facturas emitidas, excluyendo cotizaciones
    sales = sales.filter(s => s.document_type !== 'quote')

    if (sales.length === 1) {
      selectSale(sales[0])
    } else if (sales.length > 1) {
      foundSales.value = sales
      showNotification(`Se encontraron ${sales.length} ventas coincidentes. Seleccione la correspondiente.`, 'info')
    } else {
      showNotification('No se encontró ninguna venta con ese criterio de búsqueda', 'error')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al buscar la venta', 'error')
  } finally {
    loading.value = false
  }
}

const clearSearch = () => {
  searchSaleNumber.value = ''
  hasSearched.value = false
  foundSales.value = []
}

const clearSelectedSale = () => {
  sale.value = null
  returnForm.value = {
    sale_id: null,
    type: 'partial',
    reason: '',
    refund_amount: 0,
    items: [],
  }
  clearSearch()
  loadRecentSales()
}

const selectSale = async selectedSaleInfo => {
  if (selectedSaleInfo.status === 'canceled') {
    showNotification('No se puede procesar devolución sobre una venta anulada', 'error')
    return
  }

  loading.value = true
  try {
    const saleDetail = await $api(`sales/${selectedSaleInfo.id}`)

    sale.value = saleDetail?.data || saleDetail

    returnForm.value.sale_id = sale.value.id
    returnForm.value.items = (sale.value.details || []).map(d => ({
      ...d,
      return_quantity: 0,
      max_quantity: Number(d.quantity || 1),

      // Usar el precio unitario efectivo con descuento
      price: Number(d.quantity > 0 ? (d.total / d.quantity).toFixed(2) : d.price),
    }))

    foundSales.value = []
    hasSearched.value = false
    showNotification('Venta cargada correctamente para devolución', 'success')
  } catch (error) {
    console.error(error)
    showNotification('Error al cargar el detalle de los productos de la venta', 'error')
  } finally {
    loading.value = false
  }
}

const totalRefund = computed(() => {
  if (!returnForm.value.items || !returnForm.value.items.length) return 0

  return returnForm.value.items.reduce((total, item) => {
    return total + (Number(item.return_quantity || 0) * Number(item.price || 0))
  }, 0)
})

const totalUnitsToReturn = computed(() => {
  if (!returnForm.value.items) return 0
  return returnForm.value.items.reduce((acc, i) => acc + Number(i.return_quantity || 0), 0)
})

const clampQuantity = (item, val) => {
  const num = Number(val) || 0
  if (num > item.max_quantity) {
    item.return_quantity = item.max_quantity
    showNotification(`Solo puede devolver hasta ${item.max_quantity} unidad(es) de ${item.description}`, 'warning')
  } else if (num < 0) {
    item.return_quantity = 0
  } else {
    item.return_quantity = num
  }
}

const incrementQty = item => {
  if (item.return_quantity < item.max_quantity) {
    item.return_quantity += 1
  }
}

const decrementQty = item => {
  if (item.return_quantity > 0) {
    item.return_quantity -= 1
  }
}

const returnAllQty = item => {
  item.return_quantity = item.max_quantity
}

const returnAllSale = () => {
  returnForm.value.items.forEach(i => {
    i.return_quantity = i.max_quantity
  })
}

const resetAllQty = () => {
  returnForm.value.items.forEach(i => {
    i.return_quantity = 0
  })
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
    showNotification('Debe seleccionar al menos un producto con cantidad a devolver mayor a 0', 'warning')
    return
  }
  if (!returnForm.value.reason.trim()) {
    showNotification('Debe ingresar el motivo o justificación de la devolución', 'warning')
    return
  }

  processing.value = true
  try {
    const isTotal = returnForm.value.items.every(i => i.return_quantity === i.max_quantity)

    const payload = {
      sale_id: returnForm.value.sale_id,
      type: isTotal ? 'total' : 'partial',
      reason: returnForm.value.reason.trim(),
      refund_amount: Number(totalRefund.value.toFixed(2)),
      items: itemsToReturn.map(i => ({
        product_id: i.product_id,
        description: i.description,
        quantity: i.return_quantity,
        price: i.price,
      })),
    }

    const res = await $api('returns', {
      method: 'POST',
      body: payload,
    })

    if (res?.success || res?.status === 200) {
      showNotification('Devolución procesada e inventario reintegrado correctamente', 'success')
      clearDraft()
      router.push('/returns/list')
    }
  } catch (error) {
    console.error(error)
    showNotification(error?.response?._data?.message || 'Error al procesar la devolución', 'error')
  } finally {
    processing.value = false
  }
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value || 0)
}

const formatDate = dateStr => {
  if (!dateStr) return '-'
  const clean = String(dateStr).split('T')[0].split(' ')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return clean
}

onMounted(() => {
  loadRecentSales()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 position-relative return-add-page mobile-card-list-container">
    <VProgressLinear v-if="loading" indeterminate color="primary" height="3" class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 10;" />

    <!-- Header Principal Sticky Estandarizado -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="44" class="elevation-1">
            <VIcon icon="ri-refund-2-line" size="24" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Procesar Devolución de Venta
              </h1>
              <VChip color="primary" size="small" variant="tonal" class="font-weight-bold"
                prepend-icon="ri-arrow-go-back-line">
                Reintegro a Inventario
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Busca la venta original, selecciona los artículos a retornar y registra el reintegro de productos a
              inventario
            </p>
          </div>
        </div>

        <div class="d-flex align-center justify-end gap-2 flex-wrap ms-auto crud-header-actions">
          <VBtn v-if="sale" variant="tonal" color="warning" prepend-icon="ri-refresh-line" class="font-weight-medium"
            @click="clearSelectedSale">
            Cambiar de Venta
          </VBtn>
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-arrow-left-line" class="font-weight-medium"
            @click="cancelAndReturn">
            Volver al Listado
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Guía del Proceso de Devolución (Cuando aún no se ha seleccionado la venta) -->
    <VCard v-if="!sale" class="mb-6 rounded-xl border bg-surface elevation-0 overflow-hidden">

    </VCard>

    <!-- Buscador Principal -->
    <VCard v-if="!sale" class="mb-6 rounded-xl border elevation-1 overflow-visible bg-surface">
      <VCardText class="pa-4 pa-sm-6">
        <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-3 d-flex align-center gap-2">
          <VIcon icon="ri-search-2-line" size="18" color="primary" />
          <span>Búsqueda de Factura o Venta Emitida</span>
        </div>

        <VRow align="center" dense class="gap-y-3">
          <VCol cols="12" md="9">
            <VTextField v-model="searchSaleNumber" label="Buscar Venta (Nº Factura, Cédula/RUC, Placa o Cliente)"
              placeholder="Ej: 001-001-0000012, 1712345678 o Juan Pérez" prepend-inner-icon="ri-file-search-line"
              variant="outlined" density="comfortable" hide-details="auto" rounded="lg" color="primary" clearable
              class="search-input-hover" @keyup.enter="searchSale" @click:clear="clearSearch" />
          </VCol>
          <VCol cols="12" md="3">
            <VBtn color="primary" block size="large" rounded="lg" class="elevation-2 font-weight-bold"
              :loading="loading" prepend-icon="ri-search-eye-line" @click="searchSale">
              Buscar Venta
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Resultados de Búsqueda (Múltiples Coincidencias) -->
    <VExpandTransition>
      <div v-if="foundSales.length > 0 && !sale" class="mb-8">
        <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-4">
          <h3 class="text-h6 font-weight-bold d-flex align-center gap-2 text-primary">
            <VIcon icon="ri-list-check" />
            <span>Coincidencias encontradas ({{ foundSales.length }})</span>
          </h3>
          <VBtn variant="text" color="secondary" size="small" prepend-icon="ri-close-line" @click="clearSearch">
            Cerrar Resultados
          </VBtn>
        </div>

        <VRow>
          <VCol v-for="s in foundSales" :key="s.id" cols="12" sm="6" lg="4">
            <VCard variant="outlined"
              class="h-100 rounded-xl hover-card transition-swing elevation-0 bg-surface d-flex flex-column"
              :class="{ 'opacity-50': s.status === 'canceled' }" :disabled="s.status === 'canceled'">
              <VCardText class="pa-4 flex-grow-1">
                <div class="d-flex justify-space-between align-start mb-3">
                  <VChip size="small" :color="s.document_type === 'invoice' ? 'primary' : 'info'"
                    class="font-weight-bold">
                    {{ s.document_type === 'invoice' ? 'Factura' : 'Nota de Venta' }}: {{ s.document_number || 'S/N' }}
                  </VChip>
                  <VChip size="small" :color="s.status === 'canceled' ? 'error' : 'success'" variant="tonal"
                    class="font-weight-bold">
                    {{ s.status === 'canceled' ? 'Anulada' : 'Válida' }}
                  </VChip>
                </div>

                <div class="d-flex align-center gap-3 mb-3">
                  <VAvatar color="primary" variant="tonal" size="40" rounded="lg" class="flex-shrink-0">
                    <VIcon icon="ri-user-3-line" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-subtitle-2 font-weight-bold text-high-emphasis text-truncate">
                      {{ s.client?.full_name || s.client?.name || 'Consumidor Final' }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Fecha: {{ formatDate(s.service_date) }}
                    </div>
                  </div>
                </div>

                <div class="d-flex justify-space-between align-center mt-3 pt-3 border-t">
                  <span class="text-caption text-medium-emphasis font-weight-medium">Total Venta</span>
                  <span class="text-h6 font-weight-bold text-primary font-mono">{{ formatCurrency(s.total) }}</span>
                </div>
              </VCardText>

              <VCardActions class="pa-3 bg-grey-lighten-5 border-t">
                <VBtn block color="primary" variant="elevated" size="default" prepend-icon="ri-check-line"
                  class="font-weight-bold" @click="selectSale(s)">
                  Seleccionar para Devolución
                </VBtn>
              </VCardActions>
            </VCard>
          </VCol>
        </VRow>
      </div>
    </VExpandTransition>

    <!-- Mensaje cuando la búsqueda no arrojó resultados -->
    <VAlert v-if="hasSearched && foundSales.length === 0 && !sale && !loading" type="warning" variant="tonal"
      class="mb-6 rounded-xl border" icon="ri-information-line">
      <div class="d-flex align-center justify-space-between flex-wrap gap-2">
        <div>
          <strong>No se encontraron ventas</strong> coincidentes con el término ingresado.
          Verifica que el número de factura o documento esté correcto o selecciona una de las ventas recientes listadas
          abajo.
        </div>
        <VBtn size="small" variant="outlined" color="warning" @click="clearSearch">
          Limpiar Búsqueda
        </VBtn>
      </div>
    </VAlert>

    <!-- SECCIÓN DE VENTAS RECIENTES (Evita pantalla vacía) -->
    <div v-if="!sale && foundSales.length === 0" class="mb-6">
      <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-4">
        <div>
          <h3 class="text-h6 font-weight-bold text-high-emphasis d-flex align-center gap-2 mb-0">
            <VIcon icon="ri-history-line" color="primary" size="22" />
            <span>Ventas Recientes Disponibles para Devolución</span>
          </h3>
          <p class="text-caption text-medium-emphasis mb-0">
            Selecciona directamente una venta reciente sin necesidad de escribir el número de factura.
          </p>
        </div>

        <VBtn variant="text" color="primary" size="small" prepend-icon="ri-refresh-line" :loading="loadingRecent"
          @click="loadRecentSales">
          Actualizar
        </VBtn>
      </div>

      <!-- Skeletons durante carga de recientes -->
      <template v-if="loadingRecent">
        <VRow>
          <VCol v-for="n in 6" :key="'recent-skel-' + n" cols="12" sm="6" lg="4">
            <VCard class="pa-4 rounded-xl border elevation-0 bg-surface">
              <div class="d-flex justify-space-between mb-3">
                <div class="shimmer-chip" style="width: 110px; height: 22px;" />
                <div class="shimmer-chip" style="width: 60px; height: 22px;" />
              </div>
              <div class="d-flex align-center gap-3 mb-3">
                <div class="shimmer-circle" style="width: 40px; height: 40px; border-radius: 8px;" />
                <div class="flex-grow-1">
                  <div class="shimmer-line w-75 mb-2" style="height: 16px;" />
                  <div class="shimmer-line w-50" style="height: 12px;" />
                </div>
              </div>
              <div class="shimmer-line w-100 mb-3" style="height: 38px; border-radius: 8px;" />
            </VCard>
          </VCol>
        </VRow>
      </template>

      <!-- Lista de Ventas Recientes -->
      <template v-else-if="recentSales.length > 0">
        <VRow>
          <VCol v-for="s in recentSales" :key="'recent-' + s.id" cols="12" sm="6" lg="4">
            <VCard
              class="h-100 rounded-xl border elevation-0 bg-surface hover-card transition-swing d-flex flex-column">
              <VCardText class="pa-4 flex-grow-1">
                <div class="d-flex justify-space-between align-start mb-2.5">
                  <VChip size="small" :color="s.document_type === 'invoice' ? 'primary' : 'info'" variant="tonal"
                    class="font-weight-bold font-mono">
                    {{ s.document_number || 'Venta #' + s.id }}
                  </VChip>
                  <span class="text-caption text-medium-emphasis">
                    {{ formatDate(s.service_date) }}
                  </span>
                </div>

                <div class="d-flex align-center gap-3 mb-3">
                  <VAvatar color="primary" variant="tonal" size="38" rounded="lg" class="flex-shrink-0">
                    <VIcon icon="ri-user-line" size="20" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-2 font-weight-bold text-high-emphasis text-truncate">
                      {{ s.client?.full_name || s.client?.name || 'Consumidor Final' }}
                    </div>
                    <div v-if="s.client?.n_document" class="text-caption text-medium-emphasis font-mono">
                      CI/RUC: {{ s.client.n_document }}
                    </div>
                  </div>
                </div>

                <div class="d-flex justify-space-between align-center pt-2.5 border-t">
                  <span class="text-caption text-medium-emphasis font-weight-medium">Total Cobrado</span>
                  <span class="text-subtitle-1 font-weight-bold text-success font-mono">{{ formatCurrency(s.total)
                    }}</span>
                </div>
              </VCardText>

              <VCardActions class="pa-3 bg-grey-lighten-5 border-t">
                <VBtn block color="primary" variant="tonal" size="default" prepend-icon="ri-arrow-right-line"
                  class="font-weight-bold" @click="selectSale(s)">
                  Procesar Devolución
                </VBtn>
              </VCardActions>
            </VCard>
          </VCol>
        </VRow>
      </template>

      <!-- Estado vacío cuando no hay ventas recientes -->
      <VCard v-else class="pa-8 text-center rounded-xl border elevation-0 bg-surface">
        <VIcon icon="ri-inbox-line" size="40" color="grey-lighten-1" class="mb-2" />
        <div class="text-body-1 font-weight-medium text-medium-emphasis">
          No hay ventas recientes registradas para mostrar.
        </div>
        <div class="text-caption text-disabled mt-1">
          Utiliza el buscador superior ingresando el número de factura o documento de venta.
        </div>
      </VCard>
    </div>

    <!-- ÁREA DE TRABAJO DE DEVOLUCIÓN (CUANDO LA VENTA ESTÁ SELECCIONADA) -->
    <VExpandTransition>
      <div v-if="sale">
        <!-- Banner de Venta Seleccionada -->
        <VAlert type="info" variant="tonal" class="mb-6 rounded-xl border d-flex align-center"
          icon="ri-checkbox-circle-line">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2 w-100">
            <div>
              <strong>Venta Seleccionada:</strong>
              <span class="font-mono font-weight-bold ms-1 text-primary">{{ sale.document_number || 'S/N' }}</span> —
              {{ sale.client?.full_name || sale.client?.name || 'Consumidor Final' }}
              ({{ formatDate(sale.service_date) }})
            </div>
            <VBtn size="small" variant="outlined" color="primary" prepend-icon="ri-refresh-line"
              @click="clearSelectedSale">
              Cambiar de Venta
            </VBtn>
          </div>
        </VAlert>

        <VRow>
          <!-- Resumen de la Venta (Columna Izquierda) -->
          <VCol cols="12" md="4" lg="3">
            <VCard class="rounded-xl elevation-1 border bg-surface h-100">
              <VCardTitle
                class="pa-4 pb-2 text-subtitle-1 font-weight-bold d-flex align-center gap-2 text-primary border-b">
                <VIcon icon="ri-information-line" />
                <span>Datos del Comprobante</span>
              </VCardTitle>

              <VCardText class="pa-4">
                <VList class="bg-transparent" lines="two" density="compact">
                  <VListItem class="px-0">
                    <template #prepend>
                      <VAvatar color="primary" variant="tonal" size="38" rounded="lg" class="me-3">
                        <VIcon icon="ri-file-list-3-line" />
                      </VAvatar>
                    </template>
                    <VListItemSubtitle class="text-uppercase text-caption font-weight-bold mb-1">
                      Comprobante
                    </VListItemSubtitle>
                    <VListItemTitle class="text-body-1 font-weight-bold font-mono">
                      {{ sale.document_number }}
                    </VListItemTitle>
                  </VListItem>

                  <VListItem class="px-0 mt-2">
                    <template #prepend>
                      <VAvatar color="info" variant="tonal" size="38" rounded="lg" class="me-3">
                        <VIcon icon="ri-calendar-2-line" />
                      </VAvatar>
                    </template>
                    <VListItemSubtitle class="text-uppercase text-caption font-weight-bold mb-1">
                      Fecha de Emisión
                    </VListItemSubtitle>
                    <VListItemTitle class="text-body-2 font-weight-medium">
                      {{ formatDate(sale.service_date) }}
                    </VListItemTitle>
                  </VListItem>

                  <VListItem class="px-0 mt-2">
                    <template #prepend>
                      <VAvatar color="success" variant="tonal" size="38" rounded="lg" class="me-3">
                        <VIcon icon="ri-user-smile-line" />
                      </VAvatar>
                    </template>
                    <VListItemSubtitle class="text-uppercase text-caption font-weight-bold mb-1">
                      Cliente
                    </VListItemSubtitle>
                    <VListItemTitle class="text-body-2 font-weight-medium" style="white-space: normal;">
                      {{ sale.client?.full_name || sale.client?.name || 'Consumidor Final' }}
                    </VListItemTitle>
                  </VListItem>

                  <VListItem class="px-0 mt-2">
                    <template #prepend>
                      <VAvatar color="warning" variant="tonal" size="38" rounded="lg" class="me-3">
                        <VIcon icon="ri-money-dollar-circle-line" />
                      </VAvatar>
                    </template>
                    <VListItemSubtitle class="text-uppercase text-caption font-weight-bold mb-1">
                      Total Original
                    </VListItemSubtitle>
                    <VListItemTitle class="text-h6 font-weight-bold text-primary font-mono">
                      {{ formatCurrency(sale.total) }}
                    </VListItemTitle>
                  </VListItem>
                </VList>

                <VDivider class="my-4" />

                <div class="d-flex flex-column gap-2">
                  <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis">
                    Estado del Pago
                  </div>
                  <VChip size="default" :color="sale.payment_status === 'paid' ? 'success' : 'warning'" variant="tonal"
                    class="font-weight-bold w-100 justify-center py-2">
                    <VIcon :icon="sale.payment_status === 'paid' ? 'ri-checkbox-circle-fill' : 'ri-time-fill'" start
                      size="18" />
                    {{ sale.payment_status === 'paid' ? 'Comprobante Pagado' : 'Pendiente / Crédito' }}
                  </VChip>
                </div>

                <VBtn block variant="outlined" color="secondary" size="small" prepend-icon="ri-arrow-left-line"
                  class="mt-4" @click="clearSelectedSale">
                  Buscar Otra Venta
                </VBtn>
              </VCardText>
            </VCard>
          </VCol>

          <!-- Tabla de Productos y Motivo (Columna Derecha) -->
          <VCol cols="12" md="8" lg="9">
            <VCard class="rounded-xl border elevation-1 bg-surface overflow-hidden h-100 d-flex flex-column">
              <!-- Cabecera de Artículos con Accesos Rápidos -->
              <VCardItem class="pa-4 bg-grey-lighten-5 border-b">
                <div class="d-flex align-center justify-space-between flex-wrap gap-2 w-100">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-shopping-cart-2-line" color="primary" size="22" />
                    <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                      Artículos de la Venta ({{ returnForm.items.length }})
                    </span>
                  </div>

                  <div class="d-flex align-center gap-2">
                    <VBtn size="small" color="primary" variant="tonal" class="font-weight-bold text-caption"
                      @click="returnAllSale">
                      Devolver Todo
                    </VBtn>
                    <VBtn size="small" color="secondary" variant="text" class="text-caption" @click="resetAllQty">
                      Limpiar Cantidades
                    </VBtn>
                  </div>
                </div>
              </VCardItem>

              <!-- VISTA MÓVIL: Tarjetas de Producto con Stepper Táctil (d-md-none) -->
              <div class="d-md-none pa-3 d-flex flex-column gap-3">
                <VCard v-for="item in returnForm.items" :key="'mob-item-' + item.id" variant="outlined"
                  class="rounded-xl pa-3 bg-surface" :class="{ 'border-primary': item.return_quantity > 0 }">
                  <div class="font-weight-bold text-body-2 text-high-emphasis mb-1">
                    {{ item.description }}
                  </div>

                  <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis mb-3">
                    <span>Cant. Vendida: <strong>{{ item.max_quantity }}</strong></span>
                    <span>Precio: <strong>{{ formatCurrency(item.price) }}</strong></span>
                  </div>

                  <!-- Selector Táctil de Cantidad a Devolver -->
                  <div class="d-flex align-center justify-space-between pt-2 border-t">
                    <span class="text-caption font-weight-bold text-high-emphasis">A Devolver:</span>

                    <div class="d-flex align-center gap-2">
                      <VBtn size="small" icon="ri-subtract-line" variant="tonal" color="secondary"
                        :disabled="item.return_quantity <= 0" style="width: 32px; height: 32px; border-radius: 8px;"
                        @click="decrementQty(item)" />

                      <VTextField v-model.number="item.return_quantity" type="number" min="0" :max="item.max_quantity"
                        density="compact" variant="outlined" hide-details style="max-width: 65px;"
                        class="centered-input text-center font-weight-bold font-mono"
                        @update:model-value="val => clampQuantity(item, val)" />

                      <VBtn size="small" icon="ri-add-line" variant="tonal" color="primary"
                        :disabled="item.return_quantity >= item.max_quantity"
                        style="width: 32px; height: 32px; border-radius: 8px;" @click="incrementQty(item)" />

                      <VBtn size="x-small" variant="text" color="primary" class="px-1 text-caption"
                        @click="returnAllQty(item)">
                        Máx
                      </VBtn>
                    </div>
                  </div>

                  <div v-if="item.return_quantity > 0"
                    class="d-flex justify-space-between align-center mt-2 pt-2 border-t text-caption font-weight-bold text-error">
                    <span>Subtotal Reintegro:</span>
                    <span class="font-mono text-body-2">{{ formatCurrency(item.return_quantity * item.price) }}</span>
                  </div>
                </VCard>
              </div>

              <!-- VISTA ESCRITORIO: Tabla Moderna (d-none d-md-table) -->
              <div class="d-none d-md-block flex-grow-1 overflow-x-auto">
                <VTable hover class="table-modern">
                  <thead class="bg-grey-lighten-5">
                    <tr>
                      <th class="text-uppercase text-caption font-weight-bold text-medium-emphasis">
                        Producto / Descripción
                      </th>
                      <th class="text-center text-uppercase text-caption font-weight-bold text-medium-emphasis"
                        style="width: 100px;">
                        Cant. Orig.
                      </th>
                      <th class="text-right text-uppercase text-caption font-weight-bold text-medium-emphasis"
                        style="width: 120px;">
                        Precio Unit.
                      </th>
                      <th
                        class="text-center text-uppercase text-caption font-weight-bold text-primary bg-primary-lighten-5"
                        style="width: 190px;">
                        Cantidad a Devolver
                      </th>
                      <th class="text-right text-uppercase text-caption font-weight-bold text-medium-emphasis"
                        style="width: 130px;">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in returnForm.items" :key="'desk-item-' + item.id" class="transition-swing"
                      :class="{ 'bg-primary-lighten-5 bg-opacity-25': item.return_quantity > 0 }">
                      <td class="py-3">
                        <div class="font-weight-bold text-body-2 text-high-emphasis">
                          {{ item.description }}
                        </div>
                      </td>
                      <td class="text-center">
                        <VChip size="small" variant="tonal" class="font-mono font-weight-bold">
                          {{ item.max_quantity }}
                        </VChip>
                      </td>
                      <td class="text-right font-mono text-body-2 text-medium-emphasis">
                        {{ formatCurrency(item.price) }}
                      </td>
                      <td class="bg-primary-lighten-5 px-3 py-2 text-center">
                        <div class="d-flex align-center justify-center gap-1.5">
                          <VBtn size="x-small" icon="ri-subtract-line" variant="tonal" color="secondary"
                            :disabled="item.return_quantity <= 0" style="width: 28px; height: 28px; border-radius: 6px;"
                            @click="decrementQty(item)" />
                          <VTextField v-model.number="item.return_quantity" type="number" min="0"
                            :max="item.max_quantity" density="compact" variant="outlined" hide-details color="primary"
                            bg-color="white" class="centered-input text-center font-mono font-weight-bold rounded"
                            style="width: 65px;" @update:model-value="val => clampQuantity(item, val)" />
                          <VBtn size="x-small" icon="ri-add-line" variant="tonal" color="primary"
                            :disabled="item.return_quantity >= item.max_quantity"
                            style="width: 28px; height: 28px; border-radius: 6px;" @click="incrementQty(item)" />
                          <VBtn size="x-small" variant="text" color="primary" class="px-1 text-caption font-weight-bold"
                            title="Devolver cantidad total" @click="returnAllQty(item)">
                            Todo
                          </VBtn>
                        </div>
                      </td>
                      <td class="text-right font-weight-bold text-error text-body-1 font-mono">
                        {{ formatCurrency(item.return_quantity * item.price) }}
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>

              <!-- Resumen Final, Justificación y Confirmación -->
              <div class="bg-grey-lighten-4 pa-4 pa-sm-6 border-t mt-auto">
                <VRow dense class="gap-y-4">
                  <VCol cols="12" md="7">
                    <div class="text-subtitle-2 font-weight-bold mb-2 text-high-emphasis d-flex align-center gap-1.5">
                      <VIcon icon="ri-chat-1-line" size="18" color="primary" />
                      <span>Motivo o Justificación de la Devolución *</span>
                    </div>
                    <VTextarea v-model="returnForm.reason"
                      placeholder="Indica el motivo de la devolución (ej: Producto en mal estado, error en repuesto despachado, garantía del cliente...)"
                      variant="outlined" rounded="lg" rows="3" hide-details="auto" bg-color="white"
                      class="elevation-0" />
                  </VCol>

                  <VCol cols="12" md="5" class="d-flex flex-column justify-end">
                    <div class="bg-white rounded-xl pa-4 pa-sm-5 elevation-1 border d-flex flex-column align-end">
                      <div class="d-flex justify-space-between w-100 text-caption text-medium-emphasis mb-1">
                        <span>Unidades a Retornar:</span>
                        <strong class="text-high-emphasis">{{ totalUnitsToReturn }} ítem(s)</strong>
                      </div>

                      <div class="text-uppercase text-caption font-weight-bold text-medium-emphasis mb-0.5">
                        Total Reintegro / Nota de Crédito
                      </div>
                      <div class="text-h4 font-weight-black text-error font-mono mb-4">
                        {{ formatCurrency(totalRefund) }}
                      </div>

                      <VBtn color="error" size="large" block rounded="lg" class="font-weight-bold elevation-2"
                        prepend-icon="ri-check-double-line" :loading="processing"
                        :disabled="processing || totalRefund <= 0 || !returnForm.reason.trim()" @click="submitReturn">
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
.border-light {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
}

.sticky-header {
  position: sticky;
  top: 12px;
  z-index: 9;
  backdrop-filter: blur(8px);
}

.operations-page-title {
  letter-spacing: -0.3px;
}

.operations-page-subtitle {
  font-size: 0.84rem;
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.hover-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.15) !important;
}

.hover-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.08) !important;
  border-color: rgba(var(--v-theme-primary), 0.4) !important;
}

.centered-input :deep(input) {
  text-align: center !important;
  font-weight: 700 !important;
  padding: 4px 6px !important;
}

.shimmer-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-chip {
  width: 60px;
  height: 20px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-button {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
