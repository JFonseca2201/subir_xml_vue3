<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import SaleViewDialog from '@/components/inventory/sales/SaleViewDialog.vue'
import { getBrandNameById } from '@/data/vehicleBrands'

// Router & Composables
const router = useRouter()
const { showNotification } = useGlobalToast()

// Estado general
const loading = ref(false)
const quotes = ref([])
const pdfLoading = ref(false)

// Estado de los diálogos
const isViewDialogVisible = ref(false)
const selectedQuote = ref(null)
const viewLoading = ref(false)

// Diálogo de conversión
const isConvertDialogVisible = ref(false)
const convertForm = ref({
  document_type: 'sale_note',
  payment_method: 'Efectivo',
  payment_status: 'paid',
  is_credited: false,
  account_id: null,
})
const isConverting = ref(false)
const accounts = ref([])

const convertDocTypeOptions = [
  { title: 'Nota de Venta', value: 'sale_note' },
  { title: 'Factura', value: 'invoice' },
]

const paymentMethodOptions = [
  { title: 'Efectivo', value: 'Efectivo' },
  { title: 'Transferencia', value: 'Transferencia' },
  { title: 'Depósito', value: 'Depósito' },
  { title: 'Tarjeta de Crédito', value: 'Tarjeta de Crédito' },
  { title: 'Tarjeta de Débito', value: 'Tarjeta de Débito' },
]

// Formulario de búsqueda
const searchForm = ref({
  start_date: null,
  end_date: null,
  search: null,
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(15)
const totalItems = ref(0)
const totalPages = ref(0)

// Cargar datos
const loadQuotes = async () => {
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

    const response = await $api('quotes', { params })

    const extractArray = (res, key) => {
      if (res?.data && Array.isArray(res.data)) return res.data
      if (res?.[key] && Array.isArray(res[key])) return res[key]
      if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
      if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data
      return []
    }

    // El backend de laravel paginado devuelve la lista en response.data.data o response.data
    const responseData = response?.data || response
    quotes.value = responseData?.data || []

    totalItems.value = responseData?.total || quotes.value.length || 0
    totalPages.value = responseData?.last_page || 1
  } catch (error) {
    console.error('Error al cargar cotizaciones:', error)
    showNotification('Error al cargar el historial de cotizaciones', 'error')
  } finally {
    loading.value = false
  }
}

// Limpiar Búsqueda
const clearSearch = () => {
  searchForm.value = {
    start_date: null,
    end_date: null,
    search: null,
  }
  currentPage.value = 1
  loadQuotes()
}

// Helpers de Formateo
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Enviar correo electrónico
const isMailDialogVisible = ref(false)
const mailQuoteSelected = ref(null)
const isMailSending = ref(false)

const openMailDialog = quote => {
  mailQuoteSelected.value = quote
  isMailDialogVisible.value = true
}

const confirmSendMail = async () => {
  if (!mailQuoteSelected.value) return
  isMailSending.value = true
  try {
    const response = await $api(`quotes/${mailQuoteSelected.value.id}/enviar-cotizacion`, { method: 'POST' })
    if (response.success) {
      showNotification(response.message || '¡Correo enviado con éxito!', 'success')
      isMailDialogVisible.value = false
    } else {
      showNotification(response.message || 'Error al enviar el correo.', 'error')
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al enviar el correo.', 'error')
  } finally {
    isMailSending.value = false
  }
}

const formatDate = dateString => {
  if (!dateString) return '-'
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

const getStatusInfo = status => {
  const map = {
    pending: { color: 'info', text: 'Activa', icon: 'ri-time-line' },
    completed: { color: 'success', text: 'Convertida', icon: 'ri-check-line' },
    canceled: { color: 'error', text: 'Anulada', icon: 'ri-close-circle-line' },
  }
  return map[status] || { color: 'grey', text: status, icon: 'ri-question-line' }
}

// Acciones
const viewQuote = async quote => {
  try {
    viewLoading.value = true
    const response = await $api(`quotes/${quote.id}`)
    const qData = response?.data || response
    if (qData) {
      // Re-map details to match SaleViewDialog expected layout if needed
      selectedQuote.value = qData
      isViewDialogVisible.value = true
    } else {
      showNotification('Error al cargar los detalles de la cotización', 'error')
    }
  } catch (error) {
    console.error('Error al cargar cotización:', error)
    showNotification('Error al cargar los detalles de la cotización', 'error')
  } finally {
    viewLoading.value = false
  }
}

const editQuote = quote => {
  if (quote.status === 'canceled') {
    showNotification('No se puede editar una cotización anulada', 'warning')
    return
  }
  if (quote.converted_sale_id) {
    showNotification('Esta cotización ya fue convertida y no puede editarse', 'warning')
    return
  }
  router.push(`/quotes/edit/${quote.id}`)
}

const generateSinglePDF = quote => {
  const token = localStorage.getItem('token')
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const pdfUrl = `${apiBaseUrl}/quotes/${quote.id}/pdf?token=${token}`
  const printWindow = window.open(pdfUrl, '_blank')
  if (printWindow) {
    printWindow.focus()
    showNotification('PDF cargado exitosamente', 'success')
  } else {
    showNotification('Permite las ventanas emergentes para abrir el PDF', 'warning')
  }
}

const printQuote = quoteId => {
  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
    const pdfUrl = `${apiBaseUrl}/quotes/${quoteId}/pdf?token=${token}&print=true`
    const printWindow = window.open(pdfUrl, '_blank')
    if (printWindow) {
      printWindow.focus()
      showNotification('Previsualización de impresión cargada', 'info')
    } else {
      showNotification('Permite las ventanas emergentes para abrir el PDF', 'warning')
    }
  } catch (error) {
    console.error('Error al imprimir:', error)
    showNotification('Error al abrir la previsualización', 'error')
  }
}

const downloadSinglePDF = async quote => {
  try {
    const response = await $api(`quotes/${quote.id}/pdf`, {
      method: 'GET',
      responseType: 'blob'
    })
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const clientName = getClientName(quote.client).replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')
    const docNumber = quote.document_number || 'Cotizacion'
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

// Diálogo de Anulación
const isCancelDialogVisible = ref(false)
const quoteToCancel = ref(null)

const cancelQuote = quote => {
  if (quote.status === 'canceled') return
  quoteToCancel.value = quote
  isCancelDialogVisible.value = true
}

const confirmCancelQuote = async () => {
  if (!quoteToCancel.value) return
  try {
    const response = await $api(`quotes/${quoteToCancel.value.id}`, { method: 'DELETE' })
    if (response.success || response.status === 200) {
      showNotification('Cotización anulada correctamente', 'success')
      isCancelDialogVisible.value = false
      loadQuotes()
    } else {
      showNotification(response.message || 'Error al anular cotización', 'error')
    }
  } catch (error) {
    console.error('Error al anular cotización:', error)
    showNotification('Error al anular la cotización', 'error')
  }
}

// Cargar Cuentas Financieras
const loadAccounts = async () => {
  try {
    const response = await $api('accounts', { params: { per_page: 100 } })
    if (Array.isArray(response)) {
      accounts.value = response
    } else if (response?.data && Array.isArray(response.data)) {
      accounts.value = response.data
    } else if (response?.accounts && Array.isArray(response.accounts)) {
      accounts.value = response.accounts
    } else if (response?.data?.data && Array.isArray(response.data.data)) {
      accounts.value = response.data.data
    } else {
      accounts.value = []
    }
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
  }
}

// Mostrar selector de cuenta
const showAccountSelect = computed(() => {
  return convertForm.value.payment_status === 'paid' && 
         ['Transferencia', 'Depósito', 'Tarjeta de Crédito', 'Tarjeta de Débito'].includes(convertForm.value.payment_method)
})

// Conversión de cotización
const openConvertDialog = quote => {
  if (quote.converted_sale_id) {
    showNotification('Esta cotización ya fue convertida', 'warning')
    return
  }
  if (quote.status === 'canceled') {
    showNotification('No se puede convertir una cotización anulada', 'warning')
    return
  }
  selectedQuote.value = quote

  let defaultAccountId = null
  if (accounts.value.length > 0) {
    const transferAcc = accounts.value.find(acc => acc.id === 2 || acc.name?.toLowerCase().includes('banco') || acc.name?.toLowerCase().includes('produbanco'))
    defaultAccountId = transferAcc ? transferAcc.id : accounts.value[0].id
  }

  convertForm.value = {
    document_type: 'sale_note',
    payment_method: 'Efectivo',
    payment_status: 'paid',
    is_credited: false,
    account_id: defaultAccountId,
  }
  isConvertDialogVisible.value = true
}

const confirmConvert = async () => {
  if (!selectedQuote.value) return
  isConverting.value = true
  try {
    const payload = {
      document_type: convertForm.value.document_type,
      payment_method: convertForm.value.payment_method,
      payment_status: convertForm.value.payment_status,
      is_credited: convertForm.value.is_credited,
    }

    if (convertForm.value.payment_status === 'paid' && convertForm.value.account_id) {
      payload.payment_distributions = [
        {
          account_id: convertForm.value.account_id,
          amount: parseFloat(selectedQuote.value.total),
          payment_method: convertForm.value.payment_method,
        }
      ]
    }

    const response = await $api(`quotes/${selectedQuote.value.id}/convert`, {
      method: 'POST',
      body: payload,
    })
    if (response?.success) {
      showNotification(response.message || 'Cotización convertida exitosamente', 'success')
      isConvertDialogVisible.value = false
      loadQuotes()
    } else {
      showNotification(response?.message || 'Error al convertir la cotización', 'error')
    }
  } catch (error) {
    console.error('Error al convertir cotización:', error)
    showNotification('Error al convertir la cotización', 'error')
  } finally {
    isConverting.value = false
  }
}

const groupedQuotes = computed(() => {
  const groups = {}
  quotes.value.forEach(quote => {
    const dateStr = quote.service_date ? quote.service_date.split('T')[0] : 'N/A'
    if (!groups[dateStr]) {
      groups[dateStr] = []
    }
    groups[dateStr].push(quote)
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
  loadQuotes()
}, { deep: true })

watch(currentPage, () => {
  loadQuotes()
})

// Montaje
onMounted(() => {
  loadQuotes()
  loadAccounts()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 quotes-management-page bg-grey-lighten-4 min-vh-100">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4"
      style="width: 100%;">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 text-grey-darken-4 d-flex align-center gap-2">
          <VIcon icon="ri-file-list-3-line" color="info" />
          Cotizaciones
        </h1>
        <p class="text-medium-emphasis mb-0 text-body-1">
          Gestión de presupuestos y cotizaciones del taller
        </p>
      </div>
      <div class="d-flex gap-3 flex-wrap justify-end">
        <VBtn color="info" prepend-icon="ri-add-line" to="/quotes/add" class="text-none font-weight-medium px-4"
          elevation="1">
          Nueva Cotización
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="border border-opacity-25 overflow-hidden elevation-1 mb-6 rounded-lg">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-white border-b border-opacity-25">
        <VForm @submit.prevent="() => { currentPage = 1; loadQuotes() }">
          <VRow class="align-center" dense>
            <VCol cols="12" md="6">
              <VTextField v-model="searchForm.search" label="Buscar cotización"
                placeholder="Nombre, cédula o placa del vehículo..." prepend-inner-icon="ri-search-line"
                variant="outlined" density="compact" hide-details="auto" color="info" bg-color="white" />
            </VCol>

            <VCol cols="12" sm="6" md="3">
              <VTextField v-model="searchForm.start_date" type="date" label="Desde" variant="outlined" density="compact"
                hide-details="auto" color="info" bg-color="white" />
            </VCol>

            <VCol cols="12" sm="6" md="3">
              <VTextField v-model="searchForm.end_date" type="date" label="Hasta" variant="outlined" density="compact"
                hide-details="auto" color="info" bg-color="white" />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <!-- Listado de Cotizaciones -->
      <div class="position-relative bg-white">
        <VProgressLinear v-if="loading" indeterminate color="info" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div v-if="loading" class="text-center py-10">
          <VProgressCircular indeterminate color="info" size="32" width="3" />
          <div class="mt-3 text-body-1 text-medium-emphasis">
            Cargando cotizaciones...
          </div>
        </div>

        <div v-else-if="!quotes || quotes.length === 0" class="text-center py-12">
          <VIcon size="40" color="grey-lighten-1" icon="ri-file-text-line" class="mb-3" />
          <div class="text-h6 text-grey-darken-2 font-weight-regular">
            No se encontraron cotizaciones
          </div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Intenta ajustar los filtros de búsqueda
          </div>
        </div>

        <div v-else>
          <!-- Vista de Tabla para Desktop -->
          <div class="d-none d-md-block overflow-x-auto">
            <VTable hover class="quotes-table bg-white">
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
                  <th class="text-center font-weight-medium text-grey-darken-2 py-3 px-4" style="width: 140px;">
                    Estado
                  </th>
                  <th class="text-center font-weight-medium text-grey-darken-2 py-3 px-4" style="width: 140px;">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in quotes" :key="item?.id ? `quote-${item.id}` : `quote-idx-${index}`"
                  class="align-middle border-b border-opacity-25">
                  <td class="text-left py-3 px-4">
                    <div v-if="item" class="d-flex flex-column gap-1">
                      <div class="d-flex align-center gap-2">
                        <span class="text-caption font-weight-bold text-info">
                          Cotización
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
                    <div v-if="item" class="font-weight-medium text-body-1 text-grey-darken-4">
                      {{ formatCurrency(item.total) }}
                    </div>
                  </td>

                  <td class="text-center py-3 px-4">
                    <div v-if="item" class="d-flex flex-column align-center gap-1">
                      <!-- Estado de la cotización -->
                      <div class="d-flex align-center gap-1">
                        <VIcon :icon="getStatusInfo(item.status)?.icon" :color="getStatusInfo(item.status)?.color"
                          size="14" />
                        <span class="text-caption font-weight-medium"
                          :class="`text-${getStatusInfo(item.status)?.color}`">
                          {{ getStatusInfo(item.status)?.text }}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td class="text-center py-3 px-4">
                    <div v-if="item" class="d-flex justify-center align-center gap-1">
                      <VBtn variant="text" icon size="small" color="info" title="Ver Detalle" @click="viewQuote(item)">
                        <VIcon icon="ri-eye-line" size="18" />
                      </VBtn>

                      <VBtn v-if="!item.converted_sale_id && item.status !== 'canceled'" variant="text" icon
                        size="small" color="success" title="Convertir a Venta/Factura" @click="openConvertDialog(item)">
                        <VIcon icon="ri-arrow-right-up-line" size="18" />
                      </VBtn>

                      <VBtn variant="text" icon size="small" color="secondary" title="Acciones">
                        <VIcon icon="ri-more-2-line" size="18" />
                        <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                          <VList density="compact" class="py-1 rounded elevation-3 border">
                            <VListItem prepend-icon="ri-printer-line" title="Imprimir" class="text-info text-body-2"
                              @click="printQuote(item.id)" />
                            <VListItem prepend-icon="ri-file-pdf-line" title="Ver PDF" class="text-success text-body-2"
                              @click="generateSinglePDF(item)" />
                            <VListItem prepend-icon="ri-download-2-line" title="Descargar PDF"
                              class="text-primary text-body-2" @click="downloadSinglePDF(item)" />
                            <VListItem prepend-icon="ri-mail-send-line" title="Enviar por Correo"
                              class="text-secondary text-body-2" @click="openMailDialog(item)" />
                            <VListItem v-if="!item.converted_sale_id && item.status !== 'canceled'"
                              prepend-icon="ri-edit-line" title="Editar Cotización"
                              class="text-warning text-body-2" @click="editQuote(item)" />
                            <VDivider class="my-1" />
                            <VListItem :disabled="item.status === 'canceled' || !!item.converted_sale_id"
                              prepend-icon="ri-close-circle-line" title="Anular Cotización"
                              class="text-error text-body-2" @click="cancelQuote(item)" />
                          </VList>
                        </VMenu>
                      </VBtn>
                    </div>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>

          <!-- Vista de Tarjetas para Móviles -->
          <div class="d-block d-md-none pa-3">
            <div v-for="date in Object.keys(groupedQuotes)" :key="date" class="mb-5">
              <div class="d-flex align-center mb-3 px-2">
                <VIcon icon="ri-calendar-event-line" size="18" color="medium-emphasis" class="mr-2" />
                <span class="text-body-2 font-weight-medium text-medium-emphasis text-capitalize">
                  {{ formatDateGroup(date) }}
                </span>
                <VDivider class="ms-3 flex-grow-1 border-opacity-25" />
              </div>

              <VRow dense>
                <VCol v-for="item in groupedQuotes[date]" :key="item.id" cols="12">
                  <VCard class="border border-opacity-25 elevation-0 bg-white">
                    <VCardText class="pa-3">
                      <div class="d-flex justify-space-between align-start mb-3">
                        <div>
                          <div class="d-flex align-center gap-2 mb-1">
                            <span class="text-caption font-weight-bold text-info">Cotización</span>
                          </div>
                          <div class="text-subtitle-1 font-weight-medium text-primary cursor-pointer"
                            @click="viewQuote(item)">
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

                      <div class="d-flex flex-column gap-2">
                        <div class="d-flex align-center">
                          <VIcon icon="ri-user-line" size="16" class="mr-2 text-medium-emphasis" />
                          <div>
                            <span class="text-body-2 font-weight-medium text-grey-darken-4 mr-2">{{
                              getClientName(item.client) }}</span>
                            <span v-if="item.client?.n_document" class="text-caption text-medium-emphasis">{{
                              item.client.n_document }}</span>
                          </div>
                        </div>

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

                    <VCardActions class="pa-3 bg-grey-lighten-5 d-flex justify-space-between align-center">
                      <div class="d-flex flex-column">
                        <span class="text-subtitle-1 font-weight-medium text-grey-darken-4">
                          {{ formatCurrency(item.total) }}
                        </span>
                      </div>

                      <div class="d-flex gap-1">
                        <VBtn variant="text" color="info" size="small" class="text-none px-2" @click="viewQuote(item)">
                          Ver
                        </VBtn>
                        <VBtn v-if="!item.converted_sale_id && item.status !== 'canceled'" variant="text"
                          color="success" size="small" class="text-none px-2" @click="openConvertDialog(item)">
                          Convertir
                        </VBtn>
                        <VBtn variant="text" color="secondary" size="small" class="text-none px-2">
                          Más
                          <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                            <VList density="compact" class="py-1 border elevation-3">
                              <VListItem prepend-icon="ri-printer-line" title="Imprimir" class="text-info text-body-2"
                                @click="printQuote(item.id)" />
                              <VListItem prepend-icon="ri-file-pdf-line" title="Ver PDF"
                                class="text-success text-body-2" @click="generateSinglePDF(item)" />
                              <VListItem prepend-icon="ri-download-2-line" title="Descargar PDF"
                                class="text-primary text-body-2" @click="downloadSinglePDF(item)" />
                              <VListItem prepend-icon="ri-mail-send-line" title="Enviar por Correo"
                                class="text-secondary text-body-2" @click="openMailDialog(item)" />
                              <VListItem v-if="!item.converted_sale_id && item.status !== 'canceled'"
                                prepend-icon="ri-edit-line" title="Editar" class="text-warning text-body-2"
                                @click="editQuote(item)" />
                              <VDivider class="my-1" />
                              <VListItem :disabled="item.status === 'canceled' || !!item.converted_sale_id"
                                prepend-icon="ri-close-circle-line" title="Anular" class="text-error text-body-2"
                                @click="cancelQuote(item)" />
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
            Mostrando <span class="font-weight-bold text-high-emphasis">{{ quotes.length }}</span> de <span
              class="font-weight-bold text-high-emphasis">{{ totalItems }}</span> cotizaciones
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="info"
            density="comfortable" show-first-last-page />
        </div>
      </VCardActions>
    </VCard>

    <!-- Dialogs -->
    <SaleViewDialog v-if="isViewDialogVisible" v-model:is-dialog-visible="isViewDialogVisible" :sale-data="selectedQuote"
      :loading="viewLoading" />

    <!-- Convert Dialog -->
    <VDialog v-model="isConvertDialogVisible" max-width="600" persistent>
      <VCard>
        <!-- Header -->
        <VCardTitle class="pa-6 pb-4">
          <div class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-3">
              <VIcon icon="ri-exchange-dollar-line" color="primary" size="28" />
              <div>
                <h3 class="text-h5 font-weight-bold">Facturar / Convertir</h3>
                <span class="text-medium-emphasis text-body-2">Crea una nota de venta o factura de esta cotización</span>
              </div>
            </div>
            <VBtn icon="ri-close-line" variant="text" size="small" :disabled="isConverting" @click="isConvertDialogVisible = false" />
          </div>
        </VCardTitle>

        <VDivider />

        <VCardText class="pa-6">
          <!-- Banner resumen -->
          <div class="rounded-lg pa-4 mb-5 d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center gap-2" style="background-color: #f0f1ff; border: 1px solid #666cff2b;">
            <div>
              <div class="text-caption text-uppercase font-weight-bold mb-1" style="color: #666cff;">Cotización a Facturar</div>
              <div class="text-h6 font-weight-bold text-grey-darken-4">{{ selectedQuote?.document_number }}</div>
              <div class="text-body-2 text-medium-emphasis">{{ getClientName(selectedQuote?.client) }}</div>
            </div>
            <div class="text-sm-right mt-2 mt-sm-0">
              <div class="text-caption text-uppercase font-weight-bold mb-1" style="color: #666cff;">Monto Total</div>
              <div class="text-h5 font-weight-bold" style="color: #666cff;">{{ formatCurrency(selectedQuote?.total) }}</div>
            </div>
          </div>

          <!-- Campos Formulario -->
          <VRow>
            <!-- Columna izquierda -->
            <VCol cols="12" sm="6">
              <VSelect
                v-model="convertForm.document_type"
                :items="convertDocTypeOptions"
                item-title="title"
                item-value="value"
                label="Convertir a *"
                variant="outlined"
                density="comfortable"
                color="primary"
                prepend-inner-icon="ri-file-list-3-line"
                class="mb-3"
              />

              <VSelect
                v-model="convertForm.payment_status"
                :items="[{ title: 'Pagado', value: 'paid' }, { title: 'Pendiente', value: 'pending' }]"
                item-title="title"
                item-value="value"
                label="Estado de Pago *"
                variant="outlined"
                density="comfortable"
                color="primary"
                prepend-inner-icon="ri-hand-coin-line"
              />
            </VCol>

            <!-- Columna derecha -->
            <VCol cols="12" sm="6">
              <VSelect
                v-model="convertForm.payment_method"
                :items="paymentMethodOptions"
                item-title="title"
                item-value="value"
                label="Método de Pago *"
                variant="outlined"
                density="comfortable"
                color="primary"
                prepend-inner-icon="ri-wallet-3-line"
                class="mb-3"
              />

              <VSelect
                v-if="showAccountSelect"
                v-model="convertForm.account_id"
                :items="accounts"
                item-title="name"
                item-value="id"
                label="Cuenta de Destino *"
                variant="outlined"
                density="comfortable"
                color="primary"
                prepend-inner-icon="ri-bank-card-line"
              />
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-6">
          <VSpacer />
          <VBtn color="secondary" variant="outlined" class="text-none font-weight-medium mr-2" :disabled="isConverting" @click="isConvertDialogVisible = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" variant="elevated" elevation="2" class="text-none font-weight-bold" :loading="isConverting" @click="confirmConvert">
            <VIcon icon="ri-arrow-right-up-line" class="mr-2" size="18" />
            Convertir
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Cancel Dialog -->
    <VDialog v-model="isCancelDialogVisible" max-width="400">
      <VCard>
        <VCardTitle class="text-h5 d-flex align-center">
          <VIcon icon="ri-close-circle-line" class="mr-2" color="error" />
          Anular Cotización
        </VCardTitle>
        <VDivider />

        <VCardText class="py-4">
          ¿Está seguro que desea anular la cotización <strong>{{ quoteToCancel?.document_number }}</strong>?
          <br>
          Esta acción no se puede revertir y la cotización pasará a estado Anulada.
          <br><br>
          <small class="text-medium-emphasis">
            Cliente: {{ getClientName(quoteToCancel?.client) }}
          </small>
        </VCardText>

        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn variant="text" @click="isCancelDialogVisible = false">
            Cancelar
          </VBtn>
          <VBtn color="error" variant="elevated" prepend-icon="ri-close-circle-line" @click="confirmCancelQuote">
            Anular
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Mail Dialog -->
    <VDialog v-model="isMailDialogVisible" max-width="480">
      <VCard class="rounded-xl overflow-hidden elevation-10" border="0">
        <div class="pa-6 text-center position-relative"
          style="background: linear-gradient(135deg, rgba(var(--v-theme-info), 1) 0%, rgba(var(--v-theme-info), 0.85) 100%);">
          <VAvatar color="white" size="64" class="elevation-3 mb-4">
            <VIcon icon="ri-mail-send-line" size="32" color="info" />
          </VAvatar>
          <h3 class="text-h5 text-white font-weight-bold mb-1">Enviar Cotización</h3>
          <p class="text-white text-body-2 mb-0" style="opacity: 0.85;">Se enviará la cotización por correo electrónico
          </p>
        </div>

        <VCardText class="pa-6">
          <div class="text-center mb-6">
            <p class="text-body-2 text-medium-emphasis mb-2">
              ¿Estás seguro de enviar este documento a:
            </p>
            <div class="text-h6 font-weight-bold text-grey-darken-4 mb-1">
              {{ getClientName(mailQuoteSelected?.client) }}
            </div>
            <div class="d-flex align-center justify-center text-body-2"
              :class="mailQuoteSelected?.client?.email ? 'text-medium-emphasis' : 'text-error font-weight-medium'">
              <VIcon :icon="mailQuoteSelected?.client?.email ? 'ri-mail-line' : 'ri-error-warning-line'" size="16"
                class="mr-2" />
              {{ mailQuoteSelected?.client?.email || 'El cliente no tiene correo registrado' }}
            </div>
          </div>

          <VCard variant="tonal" color="info" class="rounded-lg border-opacity-25">
            <VCardText class="pa-4 d-flex justify-space-between align-center">
              <div class="d-flex flex-column">
                <span class="text-caption font-weight-bold text-info text-uppercase mb-1"
                  style="letter-spacing: 0.5px;">Documento</span>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-file-text-line" size="18" color="info" />
                  <span class="font-weight-bold text-grey-darken-4 text-subtitle-1">{{
                    mailQuoteSelected?.document_number }}</span>
                </div>
              </div>
              <VChip size="small" color="info" variant="elevated" elevation="1"
                class="font-weight-medium text-capitalize px-3">
                Cotización
              </VChip>
            </VCardText>
          </VCard>
        </VCardText>

        <VDivider class="border-opacity-25" />

        <VCardActions class="pa-4 px-6 justify-space-between bg-grey-lighten-5">
          <VBtn color="grey-darken-2" variant="text" class="text-none font-weight-medium rounded-lg px-4"
            :disabled="isMailSending" @click="isMailDialogVisible = false">
            Cancelar
          </VBtn>
          <VBtn color="info" variant="elevated" elevation="2" class="text-none font-weight-bold rounded-lg px-6"
            :loading="isMailSending" :disabled="!mailQuoteSelected?.client?.email" @click="confirmSendMail">
            <VIcon icon="ri-send-plane-fill" class="mr-2" size="18" />
            Enviar Ahora
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
/* Estilos sutiles para la página de cotizaciones */
</style>
