<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import Swal from 'sweetalert2'
import { useDebounceFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import SaleViewDialog from '@/components/inventory/sales/SaleViewDialog.vue'
import SaleDeleteDialog from '@/components/inventory/sales/SaleDeleteDialog.vue'
import CreditNoteDialog from '@/components/inventory/sales/CreditNoteDialog.vue'
import { getBrandNameById } from '@/data/vehicleBrands'


// Router & Composables
const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()
import { usePermissions } from '@/composables/usePermissions'

const { can } = usePermissions()

// Estado general
const loading = ref(false)
const sales = ref([])
const pdfLoading = ref(false)

// Estado de los diálogos
const isViewDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const isPaymentDialogVisible = ref(false)
const isCreditNoteDialogVisible = ref(false)
const selectedSaleForCreditNote = ref(null)
const selectedSale = ref(null)
const viewLoading = ref(false)

const openCreditNoteDialog = sale => {
  selectedSaleForCreditNote.value = sale
  isCreditNoteDialogVisible.value = true
}

const handleCreditNoteCreated = () => {
  loadSales()
}


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
  { title: 'Nota de Venta', value: 'sale_note' },
  { title: 'Factura', value: 'invoice' },
]

const paymentStatusOptions = [
  { title: 'Pagado', value: 'paid' },
  { title: 'Parcial', value: 'partial' },
  { title: 'Pendiente', value: 'pending' },
]

let salesAbortController = null

// Cargar datos
const loadSales = async () => {
  if (salesAbortController) {
    salesAbortController.abort()
  }
  salesAbortController = new AbortController()

  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      exclude_quotes: true,
      ...searchForm.value,
    }

    // Limpiar parámetros nulos o vacíos
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === '') {
        delete params[key]
      }
    })

    const response = await $api('sales', {
      params,
      signal: salesAbortController.signal,
    })

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
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
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
const isMailDialogVisible = ref(false)
const mailSaleSelected = ref(null)
const isMailSending = ref(false)

const openMailDialog = sale => {
  mailSaleSelected.value = sale
  isMailDialogVisible.value = true
}

const confirmSendMail = async () => {
  if (!mailSaleSelected.value) return
  isMailSending.value = true
  try {
    const isInvoice = mailSaleSelected.value.document_type === 'invoice'
    const endpoint = isInvoice
      ? `sales/${mailSaleSelected.value.id}/sri/enviar-email`
      : `sales/${mailSaleSelected.value.id}/enviar-cotizacion`

    const response = await $api(endpoint, { method: 'POST' })
    if (response.success) {
      showNotification(response.message || 'Factura y comprobantes enviados exitosamente por correo.', 'success')
      isMailDialogVisible.value = false
    } else {
      showNotification(response.message || 'Error al despachar el correo.', 'error')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al despachar el correo.', 'error')
  } finally {
    isMailSending.value = false
  }
}

const formatDate = dateString => {
  if (!dateString) return '-'

  // Previene el desfase de zona horaria si viene en YYYY-MM-DD
  const [year, month, day] = dateString.split('T')[0].split(' ')[0].split('-')

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
    sale_note: { color: 'success', text: 'Nota Venta' },
    invoice: { color: 'primary', text: 'Factura' },
  }

  return map[type] || { color: 'grey', text: type }
}

const getPaymentStatusInfo = status => {
  const map = {
    paid: { color: 'success', text: 'Pagado', icon: 'ri-checkbox-circle-line' },
    partial: { color: 'warning', text: 'Parcial', icon: 'ri-time-line' },
    pending: { color: 'error', text: 'Pendiente', icon: 'ri-error-warning-line' },
  }

  return map[status] || { color: 'grey', text: status || 'Pendiente', icon: 'ri-question-line' }
}

const isSaleCanceled = item => {
  if (!item) return false
  if (item.deleted_at) return true
  const s = String(item.status || '').toLowerCase()
  const ps = String(item.payment_status || '').toLowerCase()
  return s === 'canceled' || s === 'anulado' || s === 'anulada' || s === 'cancelled' || ps === 'canceled' || ps === 'anulado'
}

const getStatusInfo = item => {
  if (!item) return { color: 'grey', text: '-', icon: 'ri-question-line' }
  if (isSaleCanceled(item)) {
    return { color: 'error', text: 'Anulada', icon: 'ri-close-circle-line' }
  }
  if (item.document_type === 'quote') {
    return { color: 'info', text: 'Cotización', icon: 'ri-file-list-3-line' }
  }

  return getPaymentStatusInfo(item.payment_status)
}

const getPaidAmount = item => {
  if (isSaleCanceled(item) || item.document_type === 'quote') {
    return item.total
  }
  if (item.payment_status === 'paid') {
    return item.total
  }
  if (item.finance_record && item.finance_record.payment_distributions) {
    return item.finance_record.payment_distributions.reduce((sum, pd) => sum + Number(pd.amount || 0), 0)
  }

  return 0
}

const formatMethodName = name => {
  const n = (name || '').toLowerCase().trim()
  if (n.includes('transferencia') || n.includes('banco') || n === 'transfer') return 'TRANSF.'
  if (n.includes('efectivo') || n === 'cash') return 'EFECT.'
  if (n.includes('tarjeta') || n === 'card') return 'TARJ.'
  if (n.includes('cheque') || n === 'check') return 'CHEQ.'
  if (n.includes('credito') || n.includes('pendiente') || n === 'credit') return 'PEND.'
  return (name || '').toUpperCase()
}

const getPaymentMethodDisplay = item => {
  if (!item) return ''
  if (item.document_type === 'quote') return ''
  if (isSaleCanceled(item)) return ''
  if (item.payment_status === 'pending') {
    return 'PEND.'
  }

  const distributions = item.finance_record?.payment_distributions || []
  if (distributions.length > 0) {
    const methods = [...new Set(distributions.map(d => formatMethodName(d.payment_method)).filter(Boolean))]
    if (methods.length > 0) {
      return methods.join(' + ')
    }
  }

  if (item.payment_method) {
    return formatMethodName(item.payment_method)
  }

  return 'EFEC.T.'
}

const getPaymentMethodIcon = item => {
  if (!item || item.payment_status === 'pending') return 'ri-time-line'

  const display = (getPaymentMethodDisplay(item) || '').toLowerCase()
  if (display.includes('+') || display.includes(',')) return 'ri-split-cells-horizontal'
  if (display.includes('transf')) return 'ri-bank-card-line'
  if (display.includes('tarj')) return 'ri-bank-card-2-line'
  if (display.includes('efec')) return 'ri-money-dollar-circle-line'

  return 'ri-wallet-3-line'
}

const getPaymentMethodColor = item => {
  if (!item || item.payment_status === 'pending') return 'error'

  const display = (getPaymentMethodDisplay(item) || '').toLowerCase()
  if (display.includes('transf')) return 'info'
  if (display.includes('efec')) return 'success'
  if (display.includes('+') || display.includes(',')) return 'primary'

  return 'secondary'
}

const getPaymentMethodClass = item => {
  if (!item || item.payment_status === 'pending') return 'pending'

  const display = (getPaymentMethodDisplay(item) || '').toLowerCase()
  if (display.includes('transf')) return 'transfer'
  if (display.includes('efec')) return 'cash'
  if (display.includes('tarj')) return 'card'
  if (display.includes('+') || display.includes(',')) return 'mixed'

  return 'default'
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
  if (isSaleCanceled(sale)) {
    showNotification('No se puede editar una venta anulada', 'warning')

    return
  }
  if (sale.document_type === 'invoice' && sale.sri_status === 'AUTORIZADA') {
    showNotification('Esta factura ya fue autorizada por el SRI y no se puede editar', 'warning')

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

// ── SRI Helpers & Acciones ──────────────────────────────────────────────
const sriErrorDialogVisible = ref(false)
const selectedSriError = ref('')

const getSriStatusInfo = status => {
  const map = {
    AUTORIZADA: { color: 'success', text: 'SRI Autorizada', icon: 'ri-checkbox-circle-fill' },
    ENVIADA: { color: 'info', text: 'SRI Enviada', icon: 'ri-send-plane-fill' },
    FIRMADA: { color: 'primary', text: 'SRI Firmada', icon: 'ri-key-fill' },
    CREADA: { color: 'secondary', text: 'SRI Creada', icon: 'ri-time-fill' },
    DEVUELTA: { color: 'warning', text: 'SRI Devuelta', icon: 'ri-alert-fill' },
    RECHAZADA: { color: 'error', text: 'SRI Rechazada', icon: 'ri-close-circle-fill' },
  }
  return map[status] || { color: 'grey', text: status || 'SRI Pendiente', icon: 'ri-question-line' }
}

const openSriErrorDialog = errorMsg => {
  selectedSriError.value = errorMsg || 'Sin detalle de error registrado por el SRI.'
  sriErrorDialogVisible.value = true
}

const getDownloadFileName = (item, extension) => {
  const ot = item.work_order_number || item.work_order?.number || item.document_number || 'DOC'
  const surname = item.client?.surname ? item.client.surname.trim() : ''
  const name = item.client?.name ? item.client.name.trim() : ''
  let clientName = (surname || name) ? `${surname} ${name}`.trim() : (item.client?.full_name || 'CLIENTE')
  clientName = clientName.trim()
  const cleanName = `${ot} ${clientName}`.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()
  return `${cleanName}.${extension}`
}

const downloadXml = async item => {
  try {
    const response = await $api(`sales/${item.id}/xml`, { responseType: 'blob' })
    const blob = new Blob([response], { type: 'application/xml' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getDownloadFileName(item, 'xml')
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    showNotification('XML descargado exitosamente', 'success')
  } catch (error) {
    showNotification('El XML de esta factura aún no está disponible', 'error')
  }
}

const downloadRide = async item => {
  try {
    const response = await $api(`sales/${item.id}/ride`, { responseType: 'blob' })
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getDownloadFileName(item, 'pdf')
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    showNotification('RIDE PDF descargado exitosamente', 'success')
  } catch (error) {
    showNotification('El RIDE PDF aún no está disponible', 'error')
  }
}

const resendSri = async item => {
  try {
    const response = await $api(`sales/${item.id}/sri/reenviar`, { method: 'POST' })
    if (response?.success) {
      showNotification('Factura encolada para reenvío al SRI', 'success')
      loadSales()
    } else {
      showNotification(response?.message || 'Error al reenviar al SRI', 'error')
    }
  } catch (error) {
    showNotification('Error al solicitar reenvío al SRI', 'error')
  }
}

const showCanceledDocAlert = docNumber => {
  Swal.fire({
    icon: 'warning',
    title: 'Documento Anulado',
    html: `
      <div style="text-align: center; color: #4b5563; font-size: 0.95rem;">
        La venta / factura <b>${docNumber ? '#' + docNumber : ''}</b> se encuentra <b>ANULADA</b> en el sistema.<br><br>
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px; color: #991b1b; font-size: 0.88rem; line-height: 1.4;">
          ⚠️ Los comprobantes anulados son dados de baja permanentemente y no disponen de archivo PDF ni permiten cobros o modificaciones.
        </div>
      </div>
    `,
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#7367f0',
  })
}

const generateSinglePDF = sale => {
  if (isSaleCanceled(sale)) {
    showCanceledDocAlert(sale.document_number || sale.id)
    return
  }

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

const printSale = saleId => {
  const sale = sales.value.find(s => s.id === saleId)
  if (sale && isSaleCanceled(sale)) {
    showCanceledDocAlert(sale.document_number || sale.id)
    return
  }

  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
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
  if (isSaleCanceled(sale)) {
    showCanceledDocAlert(sale.document_number || sale.id)
    return
  }

  try {
    const response = await $api(`sales/${sale.id}/pdf`, {
      method: 'GET',
      responseType: 'blob',
    })

    // Crear el blob con el tipo MIME correcto para PDF
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)

    // Formatear el nombre del cliente y placa
    const typeLabel = sale.document_type === 'invoice' ? 'Factura' : (sale.document_type === 'quote' ? 'Cotizacion' : 'Nota_Venta')
    const rawClient = sale.client?.full_name || getClientName(sale.client) || 'Cliente'
    const clientName = rawClient
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').toUpperCase()
    const plate = (sale.vehicle?.license_plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const docNumber = (sale.document_number || 'Documento').replace(/[^a-zA-Z0-9\-_]/g, '')
    const parts = [typeLabel, docNumber, clientName]
    const fileName = getDownloadFileName(sale, 'pdf')

    const a = document.createElement('a')

    a.href = url
    a.download = fileName
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
  if (isSaleCanceled(sale)) return
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
    const dateStr = sale.service_date ? sale.service_date.split('T')[0].split(' ')[0] : 'N/A'
    if (!groups[dateStr]) {
      groups[dateStr] = []
    }
    groups[dateStr].push(sale)
  })

  return groups
})

const formatDateGroup = dateStr => {
  if (dateStr === 'N/A') return 'Sin Fecha'
  const date = new Date(dateStr + 'T00:00:00')

  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

// Watchers con debounce para evitar congelamiento de UI en búsquedas
const debouncedLoadSales = useDebounceFn(() => {
  currentPage.value = 1
  loadSales()
}, 350)

watch(searchForm, () => {
  debouncedLoadSales()
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
    <!-- Header y Filtros Fijos (Sticky Top) -->
    <div class="sticky-page-header-wrapper">
      <!-- Encabezado de la página -->
      <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-4 gap-4"
        style="width: 100%;">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1 text-grey-darken-4 d-flex align-center gap-2">
            <VIcon icon="ri-price-tag-3-line" color="primary" />
            Ventas y Facturas
          </h1>
          <p class="text-medium-emphasis mb-0 text-body-1">
            Historial de transacciones y servicios del taller
          </p>
        </div>
        <div class="d-flex gap-3 flex-wrap justify-end">
          <VBtn v-if="can('export_data') || can('list_sale')" variant="tonal" color="secondary"
            prepend-icon="ri-file-pdf-line" class="text-none font-weight-medium px-4" :loading="pdfLoading"
            @click="generatePDF">
            Exportar PDF
          </VBtn>
          <VBtn v-if="can('register_sale')" color="primary" prepend-icon="ri-add-line" to="/sales/add"
            class="text-none font-weight-medium px-4" elevation="1">
            Nueva Venta
          </VBtn>
        </div>
      </div>

      <!-- Filtros y Búsqueda -->
      <VCard class="rounded-lg border-light border elevation-0 sticky-filter-card">
        <VCardText class="pa-4 bg-grey-lighten-5">
          <VForm @submit.prevent="() => { currentPage = 1; loadSales() }">
            <VRow class="align-center" dense>
              <VCol cols="12" md="4">
                <VTextField v-model="searchForm.search" label="Buscar venta"
                  placeholder="# Doc, Orden de Trabajo, cliente, cédula, placa..." variant="outlined" density="compact"
                  hide-details="auto" clearable color="primary" :loading="loading">
                  <template #prepend-inner>
                    <VProgressCircular v-if="loading" indeterminate color="primary" size="18" width="2" class="me-1" />
                    <VIcon v-else icon="ri-search-line" />
                  </template>
                </VTextField>
              </VCol>

              <VCol cols="12" sm="6" md="2">
                <VSelect v-model="searchForm.document_type" :items="documentTypeOptions" item-title="title"
                  item-value="value" label="Tipo de Doc." placeholder="Todos" variant="outlined" density="compact"
                  hide-details="auto" clearable color="primary" />
              </VCol>

              <VCol cols="12" sm="6" md="2">
                <VSelect v-model="searchForm.payment_status" :items="paymentStatusOptions" item-title="title"
                  item-value="value" label="Estado Pago" placeholder="Todos" variant="outlined" density="compact"
                  hide-details="auto" clearable color="primary" bg-color="white" />
              </VCol>

              <VCol cols="12" sm="6" md="2">
                <VTextField v-model="searchForm.start_date" type="date" label="Desde" variant="outlined"
                  density="compact" hide-details="auto" clearable color="primary" bg-color="white" />
              </VCol>

              <VCol cols="12" sm="6" md="2">
                <VTextField v-model="searchForm.end_date" type="date" label="Hasta" variant="outlined" density="compact"
                  hide-details="auto" clearable color="primary" bg-color="white" />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </div>

    <!-- Contenedor Principal (Tarjetas de Ventas) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Listado de Ventas -->
      <div class="position-relative bg-white rounded-xl border-light overflow-hidden">
        <VProgressLinear v-if="loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div v-if="!loading && (!sales || sales.length === 0)" class="text-center py-12">
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
              <thead>
                <tr>
                  <th class="text-left py-3 px-3" style="width: 12%; min-width: 130px;">
                    Documento
                  </th>
                  <th class="text-center py-3 px-2" style="width: 8%; min-width: 70px;">
                    ORD. TR.
                  </th>
                  <th class="text-center py-3 px-2" style="width: 9%; min-width: 85px;">
                    Fecha
                  </th>
                  <th class="text-left py-3 px-3" style="width: 22%; min-width: 150px; max-width: 180px;">
                    Cliente
                  </th>
                  <th class="text-left py-3 px-3" style="width: 18%; min-width: 130px; max-width: 150px;">
                    Vehículo
                  </th>
                  <th class="text-right py-3 px-3" style="width: 12%; min-width: 85px;">
                    Total
                  </th>
                  <th class="text-center py-3 px-3" style="width: 13%; min-width: 110px;">
                    Estado
                  </th>
                  <th class="text-center py-3 px-2" style="width: 6%; min-width: 65px;">
                    Acciones
                  </th>
                </tr>
              </thead>

              <!-- Cargando (Skeleton Rows) -->
              <tbody v-if="loading">
                <tr v-for="n in 5" :key="n" class="skeleton-row align-middle border-b border-opacity-25">
                  <td class="py-3 px-3">
                    <div class="shimmer-line w-50 mb-2" />
                    <div class="shimmer-line w-75" />
                  </td>
                  <td class="py-3 px-2 text-center">
                    <div class="shimmer-chip mx-auto" style="width: 55px;" />
                  </td>
                  <td class="py-3 px-2 text-center">
                    <div class="shimmer-line mx-auto" style="width: 65px;" />
                  </td>
                  <td class="py-3 px-3">
                    <div class="shimmer-line w-75 mb-2" />
                    <div class="shimmer-line w-50" />
                  </td>
                  <td class="py-3 px-3">
                    <div class="shimmer-line w-60 mb-2" />
                    <div class="shimmer-line w-40" />
                  </td>
                  <td class="py-3 px-3">
                    <div class="shimmer-line w-50 ms-auto" />
                  </td>
                  <td class="py-3 px-3 text-center">
                    <div class="shimmer-chip mx-auto" />
                  </td>
                  <td class="py-3 px-2 text-center">
                    <div class="d-flex justify-center gap-1">
                      <div class="shimmer-button" />
                      <div class="shimmer-button" />
                      <div class="shimmer-button" />
                    </div>
                  </td>
                </tr>
              </tbody>

              <tbody v-else>
                <tr v-for="(item, index) in sales" :key="item?.id ? `sale-${item.id}` : `sale-idx-${index}`"
                  class="sale-table-row align-middle border-b">

                  <td class="text-left py-3 px-3">
                    <div v-if="item" class="d-flex flex-column gap-0.5">
                      <div class="d-flex align-center">
                        <span class="font-weight-bold d-inline-flex align-center"
                          :class="item.document_type === 'invoice' ? 'text-primary' : (item.document_type === 'sale_note' ? 'text-success' : 'text-info')"
                          style="font-size: 0.85rem; letter-spacing: 0.3px; text-transform: uppercase;">
                          <VIcon
                            :icon="item.document_type === 'invoice' ? 'ri-file-shield-2-line' : (item.document_type === 'sale_note' ? 'ri-file-paper-2-line' : 'ri-file-list-3-line')"
                            size="14" class="me-1" />
                          {{ getDocumentTypeInfo(item.document_type)?.text }}
                        </span>
                      </div>
                      <div class="d-flex align-center">
                        <span class="doc-number-text"
                          :class="isSaleCanceled(item) ? 'text-decoration-line-through opacity-50' : ''"
                          style="font-size: 0.55rem; font-weight: 200;">
                          {{ item.document_number }}
                        </span>
                      </div>
                    </div>
                  </td>

                  <!-- 2. Orden de Trabajo -->
                  <td class="text-center py-3 px-2">
                    <span v-if="item?.work_order_number || item?.work_order?.number || item?.workOrder?.number"
                      class="font-weight-semibold text-slate-700" style="font-size: 0.85rem;"
                      :title="`Orden de Trabajo #${item.work_order_number || item.work_order?.number || item.workOrder?.number}`">
                      {{ item.work_order_number || item.work_order?.number || item.workOrder?.number }}
                    </span>
                    <span v-else class="text-slate-400 font-weight-medium" style="font-size: 0.85rem;">—</span>
                  </td>

                  <!-- 3. Fecha -->
                  <td class="text-center py-3 px-2">
                    <div class="d-flex align-center justify-center text-slate-600 gap-1" style="font-size: 0.85rem;">
                      <VIcon icon="ri-calendar-line" size="14" class="text-slate-400" />
                      <span class="font-weight-medium">{{ formatDate(item.service_date) }}</span>
                    </div>
                  </td>

                  <!-- 4. Cliente -->
                  <td class="text-left py-3 px-3" style="max-width: 180px;">
                    <div v-if="item">
                      <div class="font-weight-semibold text-slate-800 text-truncate" style="font-size: 0.85rem;"
                        :title="getClientName(item.client)">
                        {{ getClientName(item.client) }}
                      </div>
                      <div v-if="item.client?.n_document" class="text-slate-500 mt-0.5" style="font-size: 0.85rem;">
                        {{ item.client.n_document }}
                      </div>
                    </div>
                  </td>

                  <!-- 5. Vehículo -->
                  <td class="text-left py-3 px-3" style="max-width: 150px;">
                    <div v-if="item?.vehicle">
                      <div class="font-weight-medium text-slate-700 text-truncate" style="font-size: 0.85rem;"
                        :title="formatVehicleInfo(item.vehicle)">
                        {{ formatVehicleInfo(item.vehicle) }}
                      </div>
                      <div class="mt-0.5">
                        <span class="plate-badge font-weight-semibold" style="font-size: 0.85rem;">
                          {{ item.vehicle.license_plate }}
                        </span>
                      </div>
                    </div>
                    <span v-else class="text-slate-400" style="font-size: 0.85rem;">-</span>
                  </td>

                  <!-- 6. Total -->
                  <td class="text-right py-3 px-4">
                    <div v-if="item" class="d-flex flex-column align-end gap-1">
                      <div class="font-weight-bold text-slate-900"
                        :class="isSaleCanceled(item) ? 'text-decoration-line-through opacity-50' : ''"
                        style="font-size: 0.88rem; font-variant-numeric: tabular-nums;">
                        {{ formatCurrency(item.total) }}
                      </div>

                      <!-- Micro-Pill de Método de Pago debajo del total (solo activas) -->
                      <div
                        v-if="item.document_type !== 'quote' && !isSaleCanceled(item) && getPaymentMethodDisplay(item)"
                        class="payment-method-pill" :class="`payment-method-${getPaymentMethodClass(item)}`"
                        style="font-size: 0.85rem;">
                        <VIcon :icon="getPaymentMethodIcon(item)" size="13" />
                        <span>{{ getPaymentMethodDisplay(item) }}</span>
                      </div>
                    </div>
                  </td>

                  <!-- 7. Estado -->
                  <td class="text-center py-3 px-4" style="white-space: nowrap;">
                    <div v-if="item" class="d-inline-flex flex-column align-center gap-1">
                      <!-- Estado de Cobro / Anulada -->
                      <div class="status-pill-clean"
                        :class="`status-${isSaleCanceled(item) ? 'canceled' : (item.document_type === 'quote' ? 'quote' : item.payment_status)}`"
                        style="font-size: 0.85rem;">
                        <span class="status-dot" />
                        <span>{{ getStatusInfo(item)?.text }}</span>
                      </div>

                      <!-- Estado SRI (Solo para facturas activas) -->
                      <div v-if="item.document_type === 'invoice' && item.sri_status && !isSaleCanceled(item)"
                        class="sri-badge-clean" :class="`sri-${item.sri_status.toLowerCase()}`"
                        :title="item.sri_error ? `Error SRI: ${item.sri_error}` : `Estado SRI: ${item.sri_status}`"
                        style="font-size: 0.85rem;" @click="item.sri_error ? openSriErrorDialog(item.sri_error) : null">
                        <VIcon :icon="getSriStatusInfo(item.sri_status).icon" size="13" class="me-1" />
                        <span>{{ getSriStatusInfo(item.sri_status).text }}</span>
                      </div>
                    </div>
                  </td>

                  <!-- 8. Acciones -->
                  <td class="text-center py-3 px-4">
                    <div v-if="item && !isSaleCanceled(item)" class="d-flex justify-center align-center gap-1">
                      <VBtn variant="text" icon size="small" class="action-icon-btn text-slate-600" title="Ver Detalle"
                        @click="viewSale(item)">
                        <VIcon icon="ri-eye-line" size="17" />
                      </VBtn>

                      <VBtn variant="text" icon size="small" class="action-icon-btn text-amber-600"
                        :disabled="item.document_type === 'invoice' && item.sri_status === 'AUTORIZADA'"
                        :title="(item.document_type === 'invoice' && item.sri_status === 'AUTORIZADA') ? 'Factura autorizada por el SRI (No editable)' : 'Editar'"
                        @click="editSale(item)">
                        <VIcon icon="ri-pencil-line" size="17" />
                      </VBtn>

                      <VBtn variant="text" icon size="small" class="action-icon-btn text-slate-500"
                        title="Más Acciones">
                        <VIcon icon="ri-more-2-fill" size="17" />
                        <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                          <VList density="compact" class="py-1 rounded elevation-3 border">
                            <VListItem prepend-icon="ri-printer-line" title="Imprimir" class="text-info text-body-2"
                              @click="printSale(item.id)" />
                            <VListItem prepend-icon="ri-file-pdf-line" title="Ver PDF" class="text-success text-body-2"
                              @click="generateSinglePDF(item)" />
                            <VListItem prepend-icon="ri-download-2-line" title="Descargar PDF"
                              class="text-primary text-body-2" @click="downloadSinglePDF(item)" />
                            <VListItem v-if="item.payment_status === 'pending' && item.document_type !== 'quote'"
                              prepend-icon="ri-money-dollar-circle-line" title="Registrar Pago"
                              class="text-success text-body-2" @click="openPaymentDialog(item)" />
                            <VListItem prepend-icon="ri-mail-send-line" title="Enviar por Correo"
                              class="text-secondary text-body-2" @click="openMailDialog(item)" />

                            <!-- Acciones SRI (Solo para Facturas) -->
                            <VDivider v-if="item.document_type === 'invoice'" class="my-1" />
                            <VListItem v-if="item.document_type === 'invoice'" prepend-icon="ri-file-code-line"
                              title="Descargar XML (SRI)" class="text-info text-body-2" @click="downloadXml(item)" />
                            <VListItem v-if="item.document_type === 'invoice'" prepend-icon="ri-file-text-line"
                              title="Descargar RIDE PDF (SRI)" class="text-primary text-body-2"
                              @click="downloadRide(item)" />
                            <VListItem v-if="item.document_type === 'invoice' && item.sri_status !== 'AUTORIZADA'"
                              prepend-icon="ri-refresh-line" title="Reenviar al SRI" class="text-warning text-body-2"
                              @click="resendSri(item)" />
                            <VListItem v-if="item.document_type === 'invoice' && item.sri_status === 'AUTORIZADA'"
                              prepend-icon="ri-refund-2-line" title="Emitir Nota de Crédito (SRI)"
                              class="text-error text-body-2 font-weight-medium" @click="openCreditNoteDialog(item)" />
                            <VListItem v-if="item.document_type === 'invoice' && item.sri_error"
                              prepend-icon="ri-alert-line" title="Ver Error SRI" class="text-error text-body-2"
                              @click="openSriErrorDialog(item.sri_error)" />
                            <VDivider class="my-1" />
                            <VListItem prepend-icon="ri-close-circle-line" title="Anular Documento"
                              class="text-error text-body-2" @click="cancelSale(item)" />
                          </VList>
                        </VMenu>
                      </VBtn>
                    </div>
                    <div v-else class="d-flex justify-center align-center">
                      <VBtn variant="text" icon size="small" class="action-icon-btn text-error"
                        title="Documento Anulado (Clic para información)"
                        @click="showCanceledDocAlert(item.document_number || item.id)">
                        <VIcon icon="ri-information-line" size="18" />
                      </VBtn>
                    </div>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>

          <!-- Vista de Tarjetas para Dispositivos Móviles y Tabletas -->
          <div class="d-block d-md-none pa-3">
            <!-- Cargando en Móvil (Skeleton Cards) -->
            <div v-if="loading">
              <VCard v-for="n in 3" :key="n" class="border border-opacity-25 elevation-0 bg-white mb-3 pa-3 rounded-lg">
                <div class="d-flex justify-space-between align-center mb-2">
                  <div class="shimmer-line w-30" />
                  <div class="shimmer-chip" />
                </div>
                <div class="shimmer-line w-60 mb-2" />
                <div class="shimmer-line w-40" />
              </VCard>
            </div>

            <div v-for="date in Object.keys(groupedSales)" v-else :key="date" class="mb-5">
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
                            <span v-if="item.work_order_number || item.work_order?.number || item.workOrder?.number"
                              class="text-caption font-weight-bold text-indigo bg-indigo-lighten-5 px-1.5 py-0.5 rounded d-inline-flex align-center"
                              :title="`Orden de Trabajo: ${item.work_order_number || item.work_order?.number || item.workOrder?.number}`">
                              <VIcon icon="ri-file-settings-line" size="12" class="mr-1" />
                              OT: {{ item.work_order_number || item.work_order?.number || item.workOrder?.number }}
                            </span>
                          </div>
                          <div class="text-subtitle-1 font-weight-medium text-primary cursor-pointer"
                            @click="viewSale(item)">
                            {{ item.document_number }}
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="d-flex align-center gap-1 justify-end">
                            <VIcon :icon="getStatusInfo(item)?.icon" :color="getStatusInfo(item)?.color" size="14" />
                            <span class="text-caption font-weight-bold" :class="`text-${getStatusInfo(item)?.color}`">
                              {{ getStatusInfo(item)?.text }}
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
                        <span
                          v-if="item.document_type !== 'quote' && !isSaleCanceled(item) && item.payment_status !== 'paid'"
                          class="text-caption text-medium-emphasis">
                          De: {{ formatCurrency(item.total) }}
                        </span>
                        <span class="text-subtitle-1 font-weight-medium"
                          :class="isSaleCanceled(item) ? 'text-decoration-line-through text-medium-emphasis' : 'text-grey-darken-4'">
                          {{ formatCurrency(getPaidAmount(item)) }}
                        </span>
                      </div>

                      <div v-if="!isSaleCanceled(item)" class="d-flex gap-1">
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
                              <VListItem v-if="item.payment_status === 'pending' && item.document_type !== 'quote'"
                                prepend-icon="ri-money-dollar-circle-line" title="Registrar Pago"
                                class="text-success text-body-2" @click="openPaymentDialog(item)" />
                              <VListItem prepend-icon="ri-mail-send-line" title="Enviar por Correo"
                                class="text-secondary text-body-2" @click="openMailDialog(item)" />
                              <VListItem
                                :disabled="item.document_type === 'invoice' && item.sri_status === 'AUTORIZADA'"
                                prepend-icon="ri-edit-line" title="Editar Venta" class="text-warning text-body-2"
                                @click="editSale(item)" />
                              <VListItem v-if="item.document_type === 'invoice' && item.sri_status === 'AUTORIZADA'"
                                prepend-icon="ri-refund-2-line" title="Emitir Nota de Crédito (SRI)"
                                class="text-error text-body-2 font-weight-medium" @click="openCreditNoteDialog(item)" />
                              <VDivider class="my-1" />
                              <VListItem prepend-icon="ri-close-circle-line" title="Anular Documento"
                                class="text-error text-body-2" @click="cancelSale(item)" />
                            </VList>
                          </VMenu>
                        </VBtn>
                        <VBtn variant="text" color="info" size="small" class="text-none px-2" @click="viewSale(item)">
                          Ver
                        </VBtn>
                      </div>
                      <div v-else class="text-caption text-medium-emphasis">
                        —
                      </div>
                    </VCardActions>
                  </VCard>
                </VCol>
              </VRow>
            </div>
          </div>
        </div>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ sales.length }}</span> de <span class="font-weight-bold">{{
              totalItems }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="loadSales" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Dialogs -->
    <SaleViewDialog v-if="isViewDialogVisible" v-model:is-dialog-visible="isViewDialogVisible" :sale-data="selectedSale"
      :loading="viewLoading" />

    <SaleDeleteDialog v-if="isDeleteDialogVisible" v-model:isDialogVisible="isDeleteDialogVisible"
      :sale-selected="selectedSale" @delete-sale="handleDeleteSale" />


    <!-- Payment Dialog -->
    <VDialog v-model="isPaymentDialogVisible" scrollable max-width="450">
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn"
            @click="isPaymentDialogVisible = false" />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-secure-payment-line" />
          </div>
          <h3 class="custom-dialog-title">
            Registrar Pago
          </h3>
          <p class="custom-dialog-subtitle">
            Selecciona el método de pago para la venta
          </p>
        </div>

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
        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;">
          <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium" height="40" @click="isPaymentDialogVisible = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-check-line" class="rounded-lg px-6 font-weight-bold"
            height="40" @click="registerPayment">
            Confirmar Pago
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Mail Confirmation Dialog -->
    <VDialog v-model="isMailDialogVisible" scrollable max-width="480">
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn"
            @click="isMailDialogVisible = false" />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-mail-send-line" />
          </div>
          <h3 class="custom-dialog-title">
            Confirmar Envío
          </h3>
          <p class="custom-dialog-subtitle">
            Se enviará el documento por correo electrónico
          </p>
        </div>

        <VCardText class="pa-6">
          <div class="text-center mb-6">
            <p class="text-body-2 text-medium-emphasis mb-2">
              ¿Estás seguro de enviar este documento a:
            </p>
            <div class="text-h6 font-weight-bold text-grey-darken-4 mb-1">
              {{ getClientName(mailSaleSelected?.client) }}
            </div>
            <div class="d-flex align-center justify-center text-body-2"
              :class="mailSaleSelected?.client?.email ? 'text-medium-emphasis' : 'text-error font-weight-medium'">
              <VIcon :icon="mailSaleSelected?.client?.email ? 'ri-mail-line' : 'ri-error-warning-line'" size="16"
                class="mr-2" />
              {{ mailSaleSelected?.client?.email || 'El cliente no tiene correo registrado' }}
            </div>
          </div>

          <!-- Tarjeta interna de detalles -->
          <VCard variant="tonal" color="primary" class="rounded-lg border-opacity-25">
            <VCardText class="pa-4 d-flex justify-space-between align-center">
              <div class="d-flex flex-column">
                <span class="text-caption font-weight-bold text-primary text-uppercase mb-1"
                  style="letter-spacing: 0.5px;">Documento</span>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-file-text-line" size="18" color="primary" />
                  <span class="font-weight-bold text-grey-darken-4 text-subtitle-1">{{ mailSaleSelected?.document_number
                  }}</span>
                </div>
              </div>
              <div class="text-right">
                <VChip size="small" :color="getDocumentTypeInfo(mailSaleSelected?.document_type)?.color"
                  variant="elevated" elevation="1" class="font-weight-medium text-capitalize px-3">
                  {{ getDocumentTypeInfo(mailSaleSelected?.document_type)?.text }}
                </VChip>
              </div>
            </VCardText>
          </VCard>
        </VCardText>

        <VDivider class="border-opacity-25" />

        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;">
          <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium" height="40" :disabled="isMailSending"
            @click="isMailDialogVisible = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-send-plane-fill"
            class="rounded-lg px-6 font-weight-bold" height="40" :loading="isMailSending"
            :disabled="!mailSaleSelected?.client?.email" @click="confirmSendMail">
            Enviar Ahora
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Diálogo Modal para Errores SRI -->
    <VDialog v-model="sriErrorDialogVisible" max-width="600">
      <VCard class="rounded-xl border border-error border-opacity-25 overflow-hidden">
        <VCardItem class="bg-error-lighten-5 pa-4">
          <template #prepend>
            <VIcon icon="ri-alert-line" color="error" size="28" />
          </template>
          <VCardTitle class="text-h6 font-weight-bold text-error">
            Detalle del Respuesta SRI
          </VCardTitle>
        </VCardItem>
        <VCardText class="pa-6">
          <p class="text-body-2 text-medium-emphasis mb-3">
            El Servicio de Rentas Internas (SRI) retornó la siguiente observación al procesar este comprobante:
          </p>
          <div
            class="bg-grey-lighten-4 pa-4 rounded-lg text-body-2 font-weight-medium text-grey-darken-3 text-wrap font-monospace border">
            {{ selectedSriError }}
          </div>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4 d-flex justify-end bg-white">
          <VBtn color="secondary" variant="tonal" @click="sriErrorDialogVisible = false">
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Diálogo para Emitir Nota de Crédito SRI -->
    <CreditNoteDialog :is-dialog-visible="isCreditNoteDialogVisible" :sale-selected="selectedSaleForCreditNote"
      @update:is-dialog-visible="isCreditNoteDialogVisible = $event" @credit-note-created="handleCreditNoteCreated" />
  </div>
</template>
