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

// Métricas computadas y filtros
const totalBilledInPage = computed(() => {
  return sales.value.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0)
})

const pendingSalesCount = computed(() => {
  return sales.value.filter(s => s.payment_status === 'pending').length
})

const hasActiveFilters = computed(() => {
  return !!(
    (searchForm.value.search && searchForm.value.search.trim()) ||
    searchForm.value.document_type ||
    searchForm.value.payment_status ||
    searchForm.value.start_date ||
    searchForm.value.end_date
  )
})

const resetFilters = () => {
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

const getClientInitials = client => {
  const name = getClientName(client)
  if (!name || name === 'N/A') return 'CL'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
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
  const clean = String(dateString).split('T')[0].split(' ')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${year}/${month}/${day}`
  }
  const date = new Date(dateString)
  if (!isNaN(date.getTime())) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}/${m}/${d}`
  }
  return dateString
}

const formatVehicleInfo = vehicle => {
  if (!vehicle) return '-'
  const brandVal = vehicle.brand?.name || vehicle.brand || vehicle.brand_id
  const brandName = brandVal ? (getBrandNameById(brandVal) || brandVal) : ''
  const model = (vehicle.model || '').trim()
  const year = vehicle.year ? String(vehicle.year).trim() : ''
  const hasYearInModel = year && model.includes(year)
  const details = hasYearInModel ? model : [model, year].filter(Boolean).join(' ')

  return `${brandName} ${details}`.trim() || '-'
}

const getClientName = client => {
  if (!client) return 'Consumidor Final'

  return client.full_name || client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Cliente Desconocido'
}

const getClientPhone = client => {
  if (!client) return ''
  return client.phone || client.mobile || client.cellphone || client.telefono || ''
}

// Formateador estándar de numeración (# + 6 dígitos, ej: #001619)
const formatWorkOrderNumber = num => {
  if (!num) return '-'
  const clean = String(num).replace(/[^0-9]/g, '')
  if (!clean) return String(num)
  const val = parseInt(clean, 10)
  if (isNaN(val)) return String(num)
  return '#' + String(val).padStart(6, '0')
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
  if (isSaleCanceled(sale)) {
    showCanceledDocAlert(sale.document_number || sale.id)
    showNotification('El documento no existe porque fue anulado', 'warning')
    return
  }

  try {
    viewLoading.value = true

    const response = await $api(`sales/${sale.id}`)
    if (response?.success || response?.data) {
      const saleData = response.data || response
      if (isSaleCanceled(saleData)) {
        showCanceledDocAlert(saleData.document_number || saleData.id)
        showNotification('El documento no existe porque fue anulado', 'warning')
        return
      }
      selectedSale.value = saleData
      isViewDialogVisible.value = true
    } else {
      showNotification('Error al cargar los detalles de la venta', 'error')
    }
  } catch (error) {
    console.error('Error al cargar venta:', error)
    const errorMsg = error?.data?.message || error?.message || ''
    if (
      error?.status === 404 ||
      error?.response?.status === 404 ||
      errorMsg.toLowerCase().includes('anulad') ||
      errorMsg.toLowerCase().includes('no encontrad') ||
      errorMsg.toLowerCase().includes('not found')
    ) {
      showCanceledDocAlert(sale.document_number || sale.id)
      showNotification('El documento no existe porque fue anulado', 'warning')
    } else {
      showNotification('Error al cargar los detalles de la venta', 'error')
    }
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
        El documento <b>${docNumber ? '#' + docNumber : ''}</b> no existe o no se encuentra disponible porque fue <b>ANULADO</b>.<br><br>
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px; color: #991b1b; font-size: 0.88rem; line-height: 1.4;">
          ⚠️ Este comprobante fue dado de baja del sistema. No es posible consultar su detalle ni realizar cobros o modificaciones sobre el mismo.
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
  <div class="pa-4 pa-sm-6 sales-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-shopping-cart-2-line" size="26" />
          </VAvatar>
          Ventas y Facturación
        </h1>
        <p class="text-medium-emphasis mb-0">
          Historial de comprobantes emitidos, notas de venta y facturación electrónica
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn v-if="can('export_data') || can('list_sale')" variant="tonal" color="secondary"
          prepend-icon="ri-file-pdf-line" class="font-weight-medium" :loading="pdfLoading" @click="generatePDF">
          Exportar PDF
        </VBtn>
        <VBtn v-if="can('register_sale')" color="primary" prepend-icon="ri-add-line" to="/sales/add"
          class="elevation-2 font-weight-bold">
          Nueva Venta
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="primary" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-file-shield-2-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Total Comprobantes</div>
            <div class="text-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ totalItems }} <span class="text-caption text-disabled font-weight-regular">en sistema</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="success" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-money-dollar-circle-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Facturado en Página</div>
            <div class="text-h6 font-weight-bold text-success font-mono text-truncate">
              ${{ totalBilledInPage.toFixed(2) }}
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar size="44" color="warning" variant="tonal" rounded="lg" class="flex-shrink-0">
            <VIcon icon="ri-time-line" size="24" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">Pendientes de Cobro</div>
            <div class="text-h6 font-weight-bold text-warning text-truncate">
              {{ pendingSalesCount }} <span class="text-caption text-disabled font-weight-regular">por cobrar</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon icon="ri-filter-3-line" size="18" color="primary" />
            <span>Filtros de Ventas</span>
          </div>

          <VBtn v-if="hasActiveFilters" variant="text" color="error" size="small" prepend-icon="ri-filter-off-line"
            class="font-weight-semibold" @click="resetFilters">
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow dense class="gap-y-3">
          <VCol cols="12" md="4">
            <VTextField v-model="searchForm.search" label="Buscar venta"
              placeholder="# Doc, orden, cliente, cédula o placa..." variant="outlined" density="comfortable"
              prepend-inner-icon="ri-search-2-line" hide-details="auto" clearable color="primary" :loading="loading" />
          </VCol>

          <VCol cols="12" sm="6" md="2">
            <VSelect v-model="searchForm.document_type" :items="documentTypeOptions" item-title="title"
              item-value="value" label="Tipo de Comprobante" placeholder="Todos" variant="outlined"
              density="comfortable" hide-details="auto" clearable color="primary" />
          </VCol>

          <VCol cols="12" sm="6" md="2">
            <VSelect v-model="searchForm.payment_status" :items="paymentStatusOptions" item-title="title"
              item-value="value" label="Estado de Pago" placeholder="Todos" variant="outlined" density="comfortable"
              hide-details="auto" clearable color="primary" />
          </VCol>

          <VCol cols="12" sm="6" md="2">
            <VTextField v-model="searchForm.start_date" type="date" label="Desde" variant="outlined"
              density="comfortable" hide-details="auto" clearable color="primary" />
          </VCol>

          <VCol cols="12" sm="6" md="2">
            <VTextField v-model="searchForm.end_date" type="date" label="Hasta" variant="outlined" density="comfortable"
              hide-details="auto" clearable color="primary" />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ESTADO DE CARGA -->
    <VCard v-if="loading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 140px;">
              <div class="shimmer-line w-75" />
            </td>
            <td class="py-4" style="width: 100px;">
              <div class="shimmer-line w-50" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-75 mb-2" />
              <div class="shimmer-line w-40" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-60" />
            </td>
            <td class="py-4" style="width: 110px;">
              <div class="shimmer-line w-60 ms-auto" />
            </td>
            <td class="py-4" style="width: 120px;">
              <div class="shimmer-chip mx-auto" />
            </td>
            <td class="py-4 text-center" style="width: 130px;">
              <div class="shimmer-button rounded mx-auto" />
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard v-else-if="!sales || sales.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4">
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-shopping-cart-2-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron ventas
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los criterios de búsqueda o emite una nueva factura o nota de venta.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line"
          @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_sale')" color="primary" prepend-icon="ri-add-line" to="/sales/add">
          Nueva Venta
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA MODERNA DE VENTAS -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="sales-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 160px; min-width: 150px; white-space: nowrap;">
                Documento
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 90px; min-width: 80px; white-space: nowrap;">
                O. T.
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 220px; min-width: 180px; max-width: 240px;">
                Cliente
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 280px;">
                Vehículo
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 145px; min-width: 140px; white-space: nowrap;">
                Fecha
              </th>
              <th class="text-right font-weight-bold text-uppercase py-3" style="width: 110px; min-width: 100px; white-space: nowrap;">
                Total
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 150px; min-width: 140px; white-space: nowrap;">
                Estado
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px; min-width: 120px; white-space: nowrap;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in sales" :key="item?.id || index" class="sale-table-row">
              <!-- Documento -->
              <td class="py-3" style="white-space: nowrap;">
                <div class="d-flex flex-column gap-0.5">
                  <div class="d-flex align-center gap-1.5">
                    <VIcon
                      :icon="item.document_type === 'invoice' ? 'ri-file-shield-2-line' : (item.document_type === 'sale_note' ? 'ri-file-paper-2-line' : 'ri-file-list-3-line')"
                      size="16"
                      class="me-1 flex-shrink-0"
                      :color="isSaleCanceled(item) ? 'grey' : (item.document_type === 'invoice' ? 'primary' : 'success')" />
                    <span class="text-caption font-weight-bold text-uppercase"
                      :class="isSaleCanceled(item) ? 'text-disabled' : (item.document_type === 'invoice' ? 'text-primary' : 'text-success')">
                      {{ getDocumentTypeInfo(item.document_type)?.text }}
                    </span>
                  </div>
                  <div class="font-mono font-weight-bold text-body-1" :class="[
                    isSaleCanceled(item)
                      ? 'doc-number-canceled cursor-pointer'
                      : 'doc-number-active cursor-pointer hover-underline'
                  ]" :title="isSaleCanceled(item) ? 'Documento Anulado (Clic para más información)' : 'Ver Detalle'"
                    @click="viewSale(item)">
                    {{ item.document_number || 'S/N' }}
                  </div>
                </div>
              </td>

              <!-- OT Vinculada -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <span v-if="item.work_order_id || item.work_order?.number || item.workOrder?.number"
                  class="font-mono text-caption font-weight-bold text-primary bg-primary-lighten-5 px-2 py-0.5 rounded cursor-pointer"
                  :title="`Orden de Trabajo ${formatWorkOrderNumber(item.work_order?.number || item.workOrder?.number || item.work_order_number || item.work_order_id)}`"
                  @click="goToWorkOrder(item.work_order_id || item.work_order?.id || item.workOrder?.id)">
                  {{ formatWorkOrderNumber(item.work_order?.number || item.workOrder?.number || item.work_order_number
                    || item.work_order_id) }}
                </span>
                <span v-else class="text-disabled text-caption">—</span>
              </td>

              <!-- Cliente -->
              <td class="py-3" style="max-width: 240px;">
                <div class="d-flex align-center gap-2">
                  <VAvatar size="34" color="primary" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0">
                    <span style="font-size: 0.8rem;" class="font-weight-bold">{{ getClientInitials(item.client) }}</span>
                  </VAvatar>
                  <div class="min-w-0" style="max-width: 180px;">
                    <div class="font-weight-bold text-high-emphasis text-body-2 text-truncate"
                      :title="getClientName(item.client)">
                      {{ getClientName(item.client) }}
                    </div>
                    <div v-if="getClientPhone(item.client)" class="text-caption text-medium-emphasis d-flex align-center mt-0.5 text-truncate">
                      <VIcon icon="ri-phone-line" size="13" class="me-1 text-disabled flex-shrink-0" />
                      <span class="text-truncate">{{ getClientPhone(item.client) }}</span>
                    </div>
                    <div v-else-if="item.client?.n_document" class="text-caption text-medium-emphasis font-mono text-truncate">
                      {{ item.client.n_document }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Vehículo -->
              <td class="py-3">
                <div v-if="item.vehicle" class="d-flex align-center gap-2">
                  <VAvatar size="34" color="secondary" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0">
                    <VIcon icon="ri-car-line" size="18" color="secondary" />
                  </VAvatar>
                  <div class="min-w-0" style="max-width: 250px;">
                    <div class="font-mono font-weight-bold text-high-emphasis text-body-2 text-truncate" :title="(item.vehicle.plate || item.vehicle.license_plate || '').toUpperCase() || 'Sin placa'">
                      {{ (item.vehicle.plate || item.vehicle.license_plate || '').toUpperCase() || 'SIN PLACA' }}
                    </div>
                    <div class="text-caption text-medium-emphasis text-uppercase text-truncate font-weight-medium" :title="formatVehicleInfo(item.vehicle)">
                      {{ formatVehicleInfo(item.vehicle) }}
                    </div>
                  </div>
                </div>
                <div v-else class="d-flex align-center gap-2 text-disabled text-caption">
                  <VAvatar size="34" color="secondary" variant="tonal" rounded="lg" class="elevation-0 flex-shrink-0 opacity-40">
                    <VIcon icon="ri-car-line" size="18" />
                  </VAvatar>
                  <span>Sin vehículo</span>
                </div>
              </td>

              <!-- Fecha -->
              <td class="py-3" style="white-space: nowrap;">
                <div class="d-flex align-center text-body-2 text-medium-emphasis text-no-wrap" style="white-space: nowrap;">
                  <VIcon icon="ri-calendar-line" size="16" color="medium-emphasis" class="me-1 flex-shrink-0" />
                  <span class="text-no-wrap font-weight-medium" style="white-space: nowrap;">{{ formatDate(item.created_at) }}</span>
                </div>
              </td>

              <!-- Total -->
              <td class="text-right py-3" style="white-space: nowrap;">
                <span class="font-mono font-weight-bold text-body-1 text-high-emphasis">
                  ${{ parseFloat(item.total || 0).toFixed(2) }}
                </span>
              </td>

              <!-- Estado -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <div v-if="item" class="d-inline-flex flex-column align-center gap-1">
                  <!-- Estado de Pago / Anulada con punto -->
                  <div class="status-pill-clean"
                    :class="`status-${isSaleCanceled(item) ? 'canceled' : (item.document_type === 'quote' ? 'quote' : (item.payment_status || 'pending'))}`">
                    <span class="status-dot" />
                    <span>{{ getStatusInfo(item)?.text }}</span>
                  </div>

                  <!-- Estado SRI (Solo para facturas activas) -->
                  <div v-if="item.document_type === 'invoice' && item.sri_status && !isSaleCanceled(item)"
                    class="sri-badge-clean" :class="`sri-${item.sri_status.toLowerCase()}`"
                    :title="item.sri_error_message || item.sri_error ? `Error SRI: ${item.sri_error_message || item.sri_error}` : `Estado SRI: ${item.sri_status}`"
                    @click="item.sri_status === 'DEVUELTA' ? openSriErrorDialog(item.sri_error_message || item.sri_error) : null">
                    <span class="sri-dot" />
                    <span>{{ getSriStatusInfo(item.sri_status).text }}</span>
                  </div>
                </div>
              </td>

              <!-- Acciones -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <div v-if="!isSaleCanceled(item)" class="d-flex justify-center align-center gap-1">
                  <!-- Ver venta -->
                  <VBtn size="small" color="info" variant="tonal" icon="ri-eye-line" title="Ver Detalle"
                    @click="viewSale(item)" />

                  <!-- Menú Más Opciones -->
                  <VBtn size="small" color="secondary" variant="tonal" icon="ri-more-2-line" title="Más Opciones">
                    <VIcon icon="ri-more-2-line" size="18" />
                    <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                      <VList density="compact" class="py-1 rounded-lg elevation-4 border" min-width="190">
                        <VListItem prepend-icon="ri-printer-line" title="Imprimir Ticket" class="text-info text-body-2"
                          @click="printSale(item.id)" />
                        <VListItem prepend-icon="ri-file-pdf-line" title="Ver PDF" class="text-success text-body-2"
                          @click="generateSinglePDF(item)" />
                        <VListItem prepend-icon="ri-download-2-line" title="Descargar PDF"
                          class="text-primary text-body-2" @click="downloadSinglePDF(item)" />
                        <VDivider class="my-1" />
                        <VListItem prepend-icon="ri-pencil-line" title="Editar Venta" class="text-warning text-body-2"
                          @click="editSale(item)" />
                        <VListItem prepend-icon="ri-close-circle-line" title="Anular Venta"
                          class="text-error text-body-2" @click="cancelSale(item)" />
                      </VList>
                    </VMenu>
                  </VBtn>
                </div>
                <div v-else class="text-center">
                  <span class="text-disabled font-weight-bold text-caption">—</span>
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ sales.length }}</strong> de <strong
              class="text-high-emphasis">{{ totalItems }}</strong> ventas
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="loadSales" />
        </div>
      </VCard>
    </div>

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

<style scoped lang="scss">
.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.sale-table-row {
  transition: background-color 0.15s ease;

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.license-plate-badge {
  display: inline-block;
  padding: 2px 8px;
  background-color: #f8fafc;
  color: #0f172a;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-weight: 800;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  border: 1.5px solid #0f172a;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.text-xxs {
  font-size: 0.65rem !important;
}

// Números de documento (gris por defecto, gris con tachón rojo si es anulado)
.doc-number-active {
  color: #334155 !important; // Gris elegante
  transition: color 0.15s ease;

  &:hover {
    color: #0f172a !important;
  }
}

.doc-number-canceled {
  color: #64748b !important; // Gris
  text-decoration: line-through !important;
  text-decoration-color: #ef4444 !important; // Tachón rojo
  text-decoration-thickness: 2.5px !important;
  opacity: 0.85;

  &:hover {
    color: #ef4444 !important;
  }
}

// Status Pills (Colores aceituna / pastel con punto al inicio)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-partial {
  background-color: #fffbeb !important;
  color: #92400e !important;
  border: 1px solid #fde68a !important;

  .status-dot {
    background-color: #f59e0b !important;
  }
}

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}

.status-canceled {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  border: 1px solid #cbd5e1 !important;

  .status-dot {
    background-color: #94a3b8 !important;
  }
}

.status-quote {
  background-color: #f0f9ff !important;
  color: #0369a1 !important;
  border: 1px solid #bae6fd !important;

  .status-dot {
    background-color: #0ea5e9 !important;
  }
}

// SRI Fiscal Status Badges
.sri-badge-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 3px 8px !important;
  border-radius: 6px !important;
  font-size: 0.70rem !important;
  font-weight: 600 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;

  &:hover {
    filter: brightness(0.95);
  }

  .sri-dot {
    width: 5px !important;
    height: 5px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
    background-color: currentColor !important;
  }
}

.sri-autorizada {
  background-color: #f0fdf4 !important;
  color: #166534 !important;
  border: 1px solid #bbf7d0 !important;
}

.sri-enviada,
.sri-firmada,
.sri-creada {
  background-color: #eff6ff !important;
  color: #1e40af !important;
  border: 1px solid #bfdbfe !important;
}

.sri-devuelta {
  background-color: #fffbeb !important;
  color: #92400e !important;
  border: 1px solid #fde68a !important;
}

.sri-rechazada {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;
}
</style>
