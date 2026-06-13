<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import SaleViewDialog from '@/components/inventory/sales/SaleViewDialog.vue'
import SaleDeleteDialog from '@/components/inventory/sales/SaleDeleteDialog.vue'
import { getBrandNameById } from '@/data/vehicleBrands'


// Router & Composables
const router = useRouter()
const { showNotification } = useGlobalToast()

// Estado general
const loading = ref(false)
const sales = ref([])
const pdfLoading = ref(false)

// Estado de los diálogos
const isViewDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const isPaymentDialogVisible = ref(false)
const selectedSale = ref(null)
const viewLoading = ref(false)


// Estado del formulario de pago
const paymentForm = ref({
  payment_method: 'efectivo',
  convert_to_invoice: false,
})

const paymentMethodOptions = [
  { title: 'Efectivo', value: 'efectivo' },
  { title: 'Tarjeta', value: 'tarjeta' },
  { title: 'Transferencia', value: 'transferencia' },
  { title: 'Cheque', value: 'cheque' },
]

// Formulario de búsqueda
const searchForm = ref({
  document_type: null,
  payment_status: null,
  start_date: null,
  end_date: null,
  search: null, // Búsqueda por nombre, cédula o placa de vehículo
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(15)
const totalItems = ref(0)
const totalPages = ref(0)

// Opciones para selects
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

// Cargar datos
const loadSales = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      ...searchForm.value,
    }

    // Limpiar parámetros nulos o vacíos
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === '') {
        delete params[key]
      }
    })

    const response = await $api('sales', { params })

    // Extraer el arreglo real sin importar la estructura de la respuesta
    const extractArray = (res, key) => {
      if (Array.isArray(res)) return res
      if (res?.[key] && Array.isArray(res[key])) return res[key]
      if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
      if (res?.data && Array.isArray(res.data)) return res.data
      if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data

      return []
    }

    sales.value = extractArray(response, 'sales')

    const paginator = response?.data?.data ? response.data : (response?.data || response?.sales || response || {})

    totalItems.value = paginator.total || sales.value.length || 0
    totalPages.value = paginator.last_page || 1
  } catch (error) {
    console.error('Error al cargar ventas:', error)
    showNotification('Error al cargar el historial de ventas', 'error')
  } finally {
    loading.value = false
  }
}

// Limpiar Búsqueda
const clearSearch = () => {
  searchForm.value = {
    document_type: null,
    payment_status: null,
    start_date: null,
    end_date: null,
    search: null,
  }
  currentPage.value = 1
  loadSales()
}

// Helpers de Formateo
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}


//enviar correo electronico
const mailLoading = ref({})

const mandarCotizacionMail = async id => {
  mailLoading.value[id] = true
  try {
    const response = await $api(`sales/${id}/enviar-cotizacion`, { method: 'POST' })
    if (response.success) {
      showNotification(response.message || '¡Cotización enviada al correo con éxito, mi compa!', 'success')
    } else {
      showNotification(response.message || 'Error al despachar el correo de la cotización.', 'error')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al despachar el correo de la cotización.', 'error')
  } finally {
    mailLoading.value[id] = false
  }
}

const formatDate = dateString => {
  if (!dateString) return '-'

  // Previene el desfase de zona horaria si viene en YYYY-MM-DD
  const [year, month, day] = dateString.split('T')[0].split('-')

  return `${day}/${month}/${year}`
}

const formatVehicleInfo = vehicle => {
  if (!vehicle) return '-'
  const brandName = vehicle.brand ? getBrandNameById(vehicle.brand) : ''

  return `${brandName} ${vehicle.model || ''}`.trim()
}

const getClientName = client => {
  if (!client) return 'Consumidor Final'

  return client.full_name || client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Cliente Desconocido'
}

// Helpers visuales (Chips)
const getDocumentTypeInfo = type => {
  const map = {
    quote: { color: 'info', text: 'Cotización' },
    sale_note: { color: 'primary', text: 'Nota Venta' },
    invoice: { color: 'deep-purple', text: 'Factura' },
  }


  return map[type] || { color: 'grey', text: type }
}

const getPaymentStatusInfo = status => {
  const map = {
    paid: { color: 'success', text: 'Pagado' },
    partial: { color: 'warning', text: 'Parcial' },
    pending: { color: 'error', text: 'Pendiente' },
  }


  return map[status] || { color: 'grey', text: status }
}

const getStatusInfo = status => {
  const map = {
    completed: { color: 'success', text: 'Completada', icon: 'ri-check-line' },
    pending: { color: 'warning', text: 'Pendiente', icon: 'ri-time-line' },
    canceled: { color: 'error', text: 'Anulada', icon: 'ri-close-circle-line' },
  }


  return map[status] || { color: 'grey', text: status, icon: 'ri-question-line' }
}

// Acciones
const viewSale = async sale => {
  try {
    viewLoading.value = true

    const response = await $api(`sales/${sale.id}`)
    if (response?.success || response?.data) {
      selectedSale.value = response.data || response
      isViewDialogVisible.value = true
    } else {
      showNotification('Error al cargar los detalles de la venta', 'error')
    }
  } catch (error) {
    console.error('Error al cargar venta:', error)
    showNotification('Error al cargar los detalles de la venta', 'error')
  } finally {
    viewLoading.value = false
  }
}


const editSale = sale => {
  if (sale.status === 'canceled') {
    showNotification('No se puede editar una venta anulada', 'warning')

    return
  }
  router.push(`/sales/edit/${sale.id}`)
}

const generatePDF = async () => {
  pdfLoading.value = true
  try {
    const params = {
      ...searchForm.value,
    }

    // Limpiar parámetros nulos o vacíos
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === '') {
        delete params[key]
      }
    })

    const response = await $api('sales/pdf', {
      method: 'POST',
      body: params,
      responseType: 'blob',
    })

    // Crear un blob y descargar el PDF
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `ventas_${new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    showNotification('Reporte PDF generado exitosamente', 'success')
  } catch (error) {
    console.error('Error al generar PDF:', error)
    showNotification('Error al generar el reporte PDF', 'error')
  } finally {
    pdfLoading.value = false
  }
}

const generateSinglePDF = sale => {
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

const printSale = saleId => {
  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
    const pdfUrl = `${apiBaseUrl}/sales/${saleId}/pdf?token=${token}&print=true`

    const printWindow = window.open(pdfUrl, '_blank')
    if (printWindow) {
      printWindow.focus()
      showNotification('Previsualización de impresión cargada', 'info')
    } else {
      showNotification('Permite las ventanas emergentes para abrir el PDF', 'warning')
    }
  } catch (error) {
    console.error('Error al imprimir:', error)
    showNotification('Error al abrir la previsualización de la venta', 'error')
  }
}

const printDirectlyFromServer = async (id, type) => {
  try {
    const endpoint = type === 'sale' ? `sales/${id}/print` : `work-orders/${id}/print`
    const response = await $api(endpoint, { method: 'POST' })
    if (response.success) {
      showNotification(response.message || 'Impresión directa enviada', 'success')
    } else {
      showNotification(response.message || 'Error en impresión directa', 'error')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al conectar con la impresora del servidor', 'error')
  }
}

const downloadSinglePDF = async sale => {
  try {
    const response = await $api(`sales/${sale.id}/pdf`, {
      method: 'GET',
      responseType: 'blob'
    })

    // Crear el blob con el tipo MIME correcto para PDF
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)

    // Formatear el nombre del cliente (quitando caracteres especiales y reemplazando espacios por guiones bajos)
    const clientName = getClientName(sale.client).replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')
    const docNumber = sale.document_number || 'Documento'

    const a = document.createElement('a')

    a.href = url
    a.download = `${docNumber}_${clientName}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    showNotification('PDF descargado exitosamente', 'success')
  } catch (error) {
    console.error('Error al descargar PDF:', error)
    showNotification('Error al descargar el PDF', 'error')
  }
}

const cancelSale = sale => {
  if (sale.status === 'canceled') return
  selectedSale.value = sale
  isDeleteDialogVisible.value = true
}

const handleDeleteSale = sale => {
  loadSales()
}

// Registrar pago
const openPaymentDialog = sale => {
  if (sale.payment_status !== 'pending') {
    showNotification('Solo se puede registrar pago para ventas pendientes', 'warning')

    return
  }
  selectedSale.value = sale
  paymentForm.value = {
    payment_method: 'efectivo',
    convert_to_invoice: false,
  }
  isPaymentDialogVisible.value = true
}

const registerPayment = async () => {
  if (!selectedSale.value) return

  try {
    const response = await $api(`sales/${selectedSale.value.id}/register-payment`, {
      method: 'POST',
      body: paymentForm.value,
    })

    if (response?.success) {
      showNotification('Pago registrado correctamente', 'success')
      isPaymentDialogVisible.value = false
      loadSales()
    } else {
      showNotification(response?.message || 'Error al registrar el pago', 'error')
    }
  } catch (error) {
    console.error('Error al registrar pago:', error)
    showNotification('Error al registrar el pago', 'error')
  }
}

const groupedSales = computed(() => {
  const groups = {}
  sales.value.forEach(sale => {
    const dateStr = sale.service_date ? sale.service_date.split('T')[0] : 'N/A'
    if (!groups[dateStr]) {
      groups[dateStr] = []
    }
    groups[dateStr].push(sale)
  })
  return groups
})

const formatDateGroup = (dateStr) => {
  if (dateStr === 'N/A') return 'Sin Fecha'
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

// Watchers
watch(searchForm, () => {
  currentPage.value = 1
  loadSales()
}, { deep: true })

watch(currentPage, () => {
  loadSales()
})

// Montaje
onMounted(() => {
  loadSales()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 sales-management-page bg-grey-lighten-4 min-vh-100">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4"
      style="width: 100%;">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 text-grey-darken-4 d-flex align-center gap-2">
          <VIcon icon="ri-price-tag-3-line" color="primary" />
          Ventas y Cotizaciones
        </h1>
        <p class="text-medium-emphasis mb-0 text-body-1">
          Historial de transacciones y servicios del taller
        </p>
      </div>
      <div class="d-flex gap-3 flex-wrap justify-end">
        <VBtn color="secondary" variant="outlined" prepend-icon="ri-file-pdf-line" :loading="pdfLoading"
          @click="generatePDF" class="text-none font-weight-medium px-4 bg-white">
          Exportar PDF
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" to="/sales/add" class="text-none font-weight-medium px-4"
          elevation="1">
          Nueva Venta
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="border border-opacity-25 overflow-hidden elevation-1 mb-6 rounded-lg">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-white border-b border-opacity-25">
        <VForm @submit.prevent="() => { currentPage = 1; loadSales() }">
          <VRow class="align-center" dense>
            <VCol cols="12" md="4">
              <VTextField v-model="searchForm.search" label="Buscar venta"
                placeholder="Nombre, cédula o placa del vehículo..." prepend-inner-icon="ri-search-line"
                variant="outlined" density="compact" hide-details="auto" clearable color="primary" bg-color="white" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VSelect v-model="searchForm.document_type" :items="documentTypeOptions" item-title="title"
                item-value="value" label="Tipo de Doc." placeholder="Todos" variant="outlined" density="compact"
                hide-details="auto" clearable color="primary" bg-color="white" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VSelect v-model="searchForm.payment_status" :items="paymentStatusOptions" item-title="title"
                item-value="value" label="Estado Pago" placeholder="Todos" variant="outlined" density="compact"
                hide-details="auto" clearable color="primary" bg-color="white" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VTextField v-model="searchForm.start_date" type="date" label="Desde" variant="outlined" density="compact"
                hide-details="auto" clearable color="primary" bg-color="white" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VTextField v-model="searchForm.end_date" type="date" label="Hasta" variant="outlined" density="compact"
                hide-details="auto" clearable color="primary" bg-color="white" />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <!-- Listado de Ventas -->
      <div class="position-relative bg-white">
        <VProgressLinear v-if="loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div v-if="loading" class="text-center py-10">
          <VProgressCircular indeterminate color="primary" size="32" width="3" />
          <div class="mt-3 text-body-1 text-medium-emphasis">
            Cargando registros...
          </div>
        </div>

        <div v-else-if="!sales || sales.length === 0" class="text-center py-12">
          <VIcon size="40" color="grey-lighten-1" icon="ri-file-text-line" class="mb-3" />
          <div class="text-h6 text-grey-darken-2 font-weight-regular">
            No se encontraron ventas
          </div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Intenta ajustar los filtros de búsqueda
          </div>
        </div>

        <div v-else>
          <!-- Vista de Tabla para Computadoras (Desktop) -->
          <div class="d-none d-md-block overflow-x-auto">
            <VTable hover class="sales-table bg-white">
              <thead class="bg-grey-lighten-4">
                <tr>
                  <th class="text-left font-weight-medium text-grey-darken-2 py-3 px-4" style="width: 160px;">
                    Documento
                  </th>
                  <th class="text-left font-weight-medium text-grey-darken-2 py-3 px-4" style="min-width: 200px;">
                    Cliente
                  </th>
                  <th class="text-left font-weight-medium text-grey-darken-2 py-3 px-4" style="min-width: 180px;">
                    Vehículo
                  </th>
                  <th class="text-right font-weight-medium text-grey-darken-2 py-3 px-4" style="width: 120px;">
                    Total
                  </th>
                  <th class="text-center font-weight-medium text-grey-darken-2 py-3 px-4" style="width: 130px;">
                    Estado
                  </th>
                  <th class="text-center font-weight-medium text-grey-darken-2 py-3 px-4" style="width: 120px;">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in sales" :key="item?.id ? `sale-${item.id}` : `sale-idx-${index}`"
                  class="align-middle border-b border-opacity-25">
                  <td class="text-left py-3 px-4">
                    <div v-if="item" class="d-flex flex-column gap-1">
                      <div class="d-flex align-center gap-2">
                        <span class="text-caption font-weight-bold"
                          :class="`text-${getDocumentTypeInfo(item.document_type)?.color}`">
                          {{ getDocumentTypeInfo(item.document_type)?.text }}
                        </span>
                        <span
                          v-if="(item.work_order || item.workOrder) && (item.work_order?.number || item.workOrder?.number || '').trim().toUpperCase() !== (item.document_number || '').trim().toUpperCase()"
                          class="text-caption font-weight-medium text-indigo bg-indigo-lighten-5 px-1 rounded">
                          <VIcon icon="ri-link-m" size="12" class="mr-1" />
                          {{ item.work_order?.number || item.workOrder?.number }}
                        </span>
                      </div>
                      <div class="text-body-1 font-weight-medium text-grey-darken-4">
                        {{ item.document_number }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        {{ formatDate(item.service_date) }}
                      </div>
                    </div>
                  </td>

                  <td class="text-left py-3 px-4">
                    <div v-if="item">
                      <div class="text-body-2 font-weight-medium text-grey-darken-4"
                        :title="getClientName(item.client)">
                        {{ getClientName(item.client) }}
                      </div>
                      <div v-if="item.client?.n_document" class="text-caption text-medium-emphasis mt-1">
                        {{ item.client.n_document }}
                      </div>
                    </div>
                  </td>

                  <td class="text-left py-3 px-4">
                    <div v-if="item?.vehicle">
                      <div class="text-body-2 font-weight-medium text-grey-darken-4"
                        :title="formatVehicleInfo(item.vehicle)">
                        {{ formatVehicleInfo(item.vehicle) }}
                      </div>
                      <div class="text-caption text-medium-emphasis mt-1">
                        {{ item.vehicle.license_plate }}
                      </div>
                    </div>
                    <span v-else class="text-medium-emphasis text-body-2">-</span>
                  </td>

                  <td class="text-right py-3 px-4">
                    <div v-if="item" class="font-weight-medium text-body-1"
                      :class="item.status === 'canceled' ? 'text-decoration-line-through text-medium-emphasis' : 'text-grey-darken-4'">
                      {{ formatCurrency(item.total) }}
                    </div>
                  </td>

                  <td class="text-center py-3 px-4">
                    <div v-if="item" class="d-flex flex-column align-center gap-1">
                      <div class="d-flex align-center gap-1">
                        <VIcon :icon="getStatusInfo(item.status)?.icon" :color="getStatusInfo(item.status)?.color"
                          size="14" />
                        <span class="text-caption font-weight-medium"
                          :class="`text-${getStatusInfo(item.status)?.color}`">
                          {{ getStatusInfo(item.status)?.text }}
                        </span>
                      </div>
                      <span v-if="item.status !== 'canceled' && item.document_type !== 'quote'" class="text-caption"
                        :class="`text-${getPaymentStatusInfo(item.payment_status)?.color}`">
                        {{ getPaymentStatusInfo(item.payment_status)?.text }}
                      </span>
                    </div>
                  </td>

                  <td class="text-center py-3 px-4">
                    <div v-if="item" class="d-flex justify-center align-center gap-1">
                      <VBtn variant="text" icon size="small" color="info" title="Ver Detalle" @click="viewSale(item)">
                        <VIcon icon="ri-eye-line" size="18" />
                      </VBtn>

                      <VBtn variant="text" icon size="small" color="warning" title="Editar" @click="editSale(item)">
                        <VIcon icon="ri-pencil-line" size="18" />
                      </VBtn>

                      <VBtn variant="text" icon size="small" color="secondary" title="Acciones">
                        <VIcon icon="ri-more-2-line" size="18" />
                        <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                          <VList density="compact" class="py-1 rounded elevation-3 border">
                            <VListItem prepend-icon="ri-printer-line" title="Imprimir" class="text-info text-body-2"
                              @click="printSale(item.id)" />
                            <VListItem prepend-icon="ri-file-pdf-line" title="Ver PDF" class="text-success text-body-2"
                              @click="generateSinglePDF(item)" />
                            <VListItem prepend-icon="ri-download-2-line" title="Descargar PDF"
                              class="text-primary text-body-2" @click="downloadSinglePDF(item)" />
                            <VListItem
                              v-if="item.payment_status === 'pending' && item.status !== 'canceled' && item.document_type !== 'quote'"
                              prepend-icon="ri-money-dollar-circle-line" title="Registrar Pago"
                              class="text-success text-body-2" @click="openPaymentDialog(item)" />
                            <VListItem v-if="item.document_type === 'quote'" prepend-icon="ri-mail-send-line"
                              title="Enviar por Correo" class="text-secondary text-body-2"
                              :loading="mailLoading[item.id]" @click="mandarCotizacionMail(item.id)">
                            </VListItem>
                            <VDivider class="my-1" />
                            <VListItem :disabled="item.status === 'canceled'" prepend-icon="ri-close-circle-line"
                              title="Anular Documento" class="text-error text-body-2" @click="cancelSale(item)" />
                          </VList>
                        </VMenu>
                      </VBtn>
                    </div>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>

          <!-- Vista de Tarjetas para Dispositivos Móviles y Tabletas -->
          <div class="d-block d-md-none pa-3">
            <div v-for="date in Object.keys(groupedSales)" :key="date" class="mb-5">
              <!-- Cabecera de Grupo por Día -->
              <div class="d-flex align-center mb-3 px-2">
                <VIcon icon="ri-calendar-event-line" size="18" color="medium-emphasis" class="mr-2" />
                <span class="text-body-2 font-weight-medium text-medium-emphasis text-capitalize">
                  {{ formatDateGroup(date) }}
                </span>
                <VDivider class="ms-3 flex-grow-1 border-opacity-25" />
              </div>

              <!-- Tarjetas del Día -->
              <VRow dense>
                <VCol v-for="item in groupedSales[date]" :key="item.id" cols="12">
                  <VCard class="border border-opacity-25 elevation-0 bg-white">
                    <VCardText class="pa-3">
                      <!-- Cabecera Tarjeta: Documento y Estado -->
                      <div class="d-flex justify-space-between align-start mb-3">
                        <div>
                          <div class="d-flex align-center gap-2 mb-1">
                            <span class="text-caption font-weight-bold"
                              :class="`text-${getDocumentTypeInfo(item.document_type)?.color}`">
                              {{ getDocumentTypeInfo(item.document_type)?.text }}
                            </span>
                            <span
                              v-if="(item.work_order || item.workOrder) && (item.work_order?.number || item.workOrder?.number || '').trim().toUpperCase() !== (item.document_number || '').trim().toUpperCase()"
                              class="text-caption font-weight-medium text-indigo bg-indigo-lighten-5 px-1 rounded">
                              <VIcon icon="ri-link-m" size="12" class="mr-1" />
                              {{ item.work_order?.number || item.workOrder?.number }}
                            </span>
                          </div>
                          <div class="text-subtitle-1 font-weight-medium text-primary cursor-pointer"
                            @click="viewSale(item)">
                            {{ item.document_number }}
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="d-flex align-center gap-1 justify-end">
                            <VIcon :icon="getStatusInfo(item.status)?.icon" :color="getStatusInfo(item.status)?.color"
                              size="14" />
                            <span class="text-caption font-weight-medium"
                              :class="`text-${getStatusInfo(item.status)?.color}`">
                              {{ getStatusInfo(item.status)?.text }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <VDivider class="border-opacity-25 my-2" />

                      <!-- Detalles Tarjeta -->
                      <div class="d-flex flex-column gap-2">
                        <!-- Cliente -->
                        <div class="d-flex align-center">
                          <VIcon icon="ri-user-line" size="16" class="mr-2 text-medium-emphasis" />
                          <div>
                            <span class="text-body-2 font-weight-medium text-grey-darken-4 mr-2">{{
                              getClientName(item.client) }}</span>
                            <span v-if="item.client?.n_document" class="text-caption text-medium-emphasis">{{
                              item.client.n_document }}</span>
                          </div>
                        </div>

                        <!-- Vehículo -->
                        <div v-if="item.vehicle" class="d-flex align-center">
                          <VIcon icon="ri-car-line" size="16" class="mr-2 text-medium-emphasis" />
                          <div>
                            <span class="text-body-2 text-grey-darken-4 mr-2">{{ formatVehicleInfo(item.vehicle)
                            }}</span>
                            <span class="text-caption text-medium-emphasis border px-1 rounded">{{
                              item.vehicle.license_plate }}</span>
                          </div>
                        </div>
                      </div>
                    </VCardText>

                    <VDivider class="border-opacity-25" />

                    <!-- Pie Tarjeta: Totales y Acciones -->
                    <VCardActions class="pa-3 bg-grey-lighten-5 d-flex justify-space-between align-center">
                      <div class="d-flex flex-column">
                        <span class="text-subtitle-1 font-weight-medium"
                          :class="item.status === 'canceled' ? 'text-decoration-line-through text-medium-emphasis' : 'text-grey-darken-4'">
                          {{ formatCurrency(item.total) }}
                        </span>
                        <span v-if="item.status !== 'canceled' && item.document_type !== 'quote'" class="text-caption"
                          :class="`text-${getPaymentStatusInfo(item.payment_status)?.color}`">
                          {{ getPaymentStatusInfo(item.payment_status)?.text }}
                        </span>
                      </div>

                      <div class="d-flex gap-1">
                        <VBtn variant="text" color="info" size="small" class="text-none px-2" @click="viewSale(item)">
                          Ver
                        </VBtn>
                        <VBtn variant="text" color="secondary" size="small" class="text-none px-2">
                          Más
                          <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                            <VList density="compact" class="py-1 border elevation-3">
                              <VListItem prepend-icon="ri-printer-line" title="Imprimir" class="text-info text-body-2"
                                @click="printSale(item.id)" />
                              <VListItem prepend-icon="ri-file-pdf-line" title="Ver PDF"
                                class="text-success text-body-2" @click="generateSinglePDF(item)" />
                              <VListItem prepend-icon="ri-download-2-line" title="Descargar PDF"
                                class="text-primary text-body-2" @click="downloadSinglePDF(item)" />
                              <VListItem
                                v-if="item.payment_status === 'pending' && item.status !== 'canceled' && item.document_type !== 'quote'"
                                prepend-icon="ri-money-dollar-circle-line" title="Registrar Pago"
                                class="text-success text-body-2" @click="openPaymentDialog(item)" />
                              <VListItem :disabled="item.status === 'canceled'" prepend-icon="ri-edit-line"
                                title="Editar Venta" class="text-warning text-body-2" @click="editSale(item)" />
                              <VDivider class="my-1" />
                              <VListItem :disabled="item.status === 'canceled'" prepend-icon="ri-close-circle-line"
                                title="Anular Documento" class="text-error text-body-2" @click="cancelSale(item)" />
                            </VList>
                          </VMenu>
                        </VBtn>
                      </div>
                    </VCardActions>
                  </VCard>
                </VCol>
              </VRow>
            </div>
          </div>
        </div>
      </div>

      <VDivider class="border-opacity-25" />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-6 bg-white border-t border-opacity-25">
        <div class="d-flex flex-column align-center gap-3">
          <div class="text-subtitle-2 text-medium-emphasis font-weight-regular">
            Mostrando <span class="font-weight-bold text-high-emphasis">{{ sales.length }}</span> de <span
              class="font-weight-bold text-high-emphasis">{{ totalItems }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            density="comfortable" show-first-last-page />
        </div>
      </VCardActions>

    </VCard>






    <!-- Dialogs -->
    <SaleViewDialog v-if="isViewDialogVisible" v-model:is-dialog-visible="isViewDialogVisible" :sale-data="selectedSale"
      :loading="viewLoading" />

    <SaleDeleteDialog v-if="isDeleteDialogVisible" v-model:isDialogVisible="isDeleteDialogVisible"
      :sale-selected="selectedSale" @delete-sale="handleDeleteSale" />


    <!-- Payment Dialog -->
    <VDialog v-model="isPaymentDialogVisible" max-width="450">
      <VCard class="rounded-lg">
        <VCardTitle class="text-h6 font-weight-medium pa-4 border-b border-opacity-25">
          Registrar Pago
        </VCardTitle>
        <VCardText class="pa-4">
          <div class="mb-4">
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-body-2 text-medium-emphasis">Documento:</span>
              <span class="font-weight-medium text-grey-darken-4">{{ selectedSale?.document_number }}</span>
            </div>
            <div class="d-flex justify-space-between align-center">
              <span class="text-body-2 text-medium-emphasis">Total a Pagar:</span>
              <span class="text-subtitle-1 font-weight-bold text-success">{{ formatCurrency(selectedSale?.total)
              }}</span>
            </div>
          </div>

          <VSelect v-model="paymentForm.payment_method" :items="paymentMethodOptions" item-title="title"
            item-value="value" label="Método de Pago" variant="outlined" density="compact" color="primary"
            class="mb-2" />

          <VCheckbox v-model="paymentForm.convert_to_invoice" label="Convertir a Factura" class="mt-2" color="primary"
            density="compact" hide-details />
        </VCardText>
        <VCardActions class="pa-4 pt-0 justify-end gap-2">
          <VBtn color="secondary" variant="text" class="text-none font-weight-medium"
            @click="isPaymentDialogVisible = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" variant="flat" class="text-none font-weight-medium px-4" @click="registerPayment">
            Confirmar Pago
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
/* Eliminar efectos exagerados, solo estilos sutiles */
</style>
