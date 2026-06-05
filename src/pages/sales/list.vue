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
    a.download = `ventas_${new Date().toISOString().split('T')[0]}.pdf`
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

const printSale = async saleId => {
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
  <div class="pa-4 pa-sm-6 sales-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-file-list-3-line" color="primary" class="me-2" size="28" />
          Ventas y Cotizaciones
        </h1>
        <p class="text-medium-emphasis mb-0">
          Historial de transacciones y servicios registrados en el taller
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="secondary" variant="tonal" prepend-icon="ri-file-pdf-line" :loading="pdfLoading"
          @click="generatePDF">
          Generar PDF
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" to="/sales/add">
          Nueva Venta
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VForm @submit.prevent="() => { currentPage = 1; loadSales() }">
          <VRow class="align-center">
            <VCol cols="12" md="4">
              <VTextField v-model="searchForm.search" label="Buscar venta"
                placeholder="Nombre, cédula o placa del vehículo..." prepend-inner-icon="ri-search-line"
                variant="outlined" density="comfortable" hide-details="auto" clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VSelect v-model="searchForm.document_type" :items="documentTypeOptions" item-title="title"
                item-value="value" label="Tipo de Doc." placeholder="Todos" prepend-inner-icon="ri-file-list-3-line"
                variant="outlined" density="comfortable" hide-details="auto" clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VSelect v-model="searchForm.payment_status" :items="paymentStatusOptions" item-title="title"
                item-value="value" label="Estado Pago" placeholder="Todos"
                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined" density="comfortable"
                hide-details="auto" clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VTextField v-model="searchForm.start_date" type="date" label="Desde"
                prepend-inner-icon="ri-calendar-line" variant="outlined" density="comfortable" hide-details="auto"
                clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VTextField v-model="searchForm.end_date" type="date" label="Hasta"
                prepend-inner-icon="ri-calendar-event-line" variant="outlined" density="comfortable" hide-details="auto"
                clearable color="primary" />
            </VCol>
          </VRow>


        </VForm>
      </VCardText>

      <!-- Listado de Ventas (Tarjetas Agrupadas por Día) -->
      <div class="position-relative bg-white">
        <VProgressLinear v-if="loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div v-if="loading" class="text-center pa-12">
          <VProgressCircular
            indeterminate
            color="primary"
            size="40"
          />
          <div class="mt-2 text-medium-emphasis">
            Cargando registros...
          </div>
        </div>

        <div v-else-if="!sales || sales.length === 0" class="text-center pa-12 text-medium-emphasis">
          <VIcon
            size="48"
            class="mb-3"
            color="grey-lighten-1"
          >
            ri-file-text-line
          </VIcon>
          <div class="text-h6">
            No se encontraron ventas
          </div>
          <div class="text-body-2">
            Intenta ajustar los filtros de búsqueda
          </div>
        </div>

        <div v-else>
          <!-- Vista de Tabla para Computadoras (Desktop) -->
          <div class="d-none d-md-block overflow-x-auto">
            <VTable hover class="sales-table">
              <thead>
                <tr>
                  <th class="text-left font-weight-bold text-uppercase" style="width: 135px;">
                    DOC./FECHA
                  </th>
                  <th class="text-left font-weight-bold text-uppercase" style="min-width: 180px;">
                    CLIENTE
                  </th>
                  <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">
                    VEHÍCULO
                  </th>
                  <th class="text-right font-weight-bold text-uppercase" style="width: 100px;">
                    TOTAL
                  </th>
                  <th class="text-center font-weight-bold text-uppercase" style="width: 120px;">
                    ESTADO
                  </th>
                  <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody style="text-transform: uppercase;">
                <tr v-for="(item, index) in sales" :key="item?.id ? `sale-${item.id}` : `sale-idx-${index}`"
                  class="sales-row align-middle">
                  <td class="text-no-wrap text-left py-3">
                    <div v-if="item" class="d-flex flex-column align-start">
                      <span class="font-weight-bold text-subtitle-1 text-primary">{{ item.document_number }}</span>
                      <span class="text-body-2 text-grey-darken-1 font-weight-medium">{{
                        getDocumentTypeInfo(item.document_type)?.text }}</span>
                      <span class="text-body-2 text-medium-emphasis d-flex align-center mt-1">
                        <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                        {{ formatDate(item.service_date) }}
                      </span>
                    </div>
                  </td>

                  <td class="text-left py-3" style="max-width: 400px;">
                    <div v-if="item">
                      <div class="font-weight-semibold text-truncate text-body-1 text-grey-darken-4"
                        :title="getClientName(item.client)">
                        {{ getClientName(item.client) }}
                      </div>
                      <div v-if="item.client?.n_document" class="text-body-2 text-medium-emphasis mt-1">
                        Doc: {{ item.client.n_document }}
                      </div>
                    </div>
                  </td>

                  <td class="text-left py-3" style="max-width: 300px;">
                    <div v-if="item?.vehicle" class="d-flex flex-column">
                      <div class="font-weight-bold text-body-1 text-truncate text-primary"
                        :title="item.vehicle.license_plate">
                        {{ item.vehicle.license_plate }}
                      </div>
                      <div class="text-body-2 text-medium-emphasis text-truncate mt-1"
                        :title="formatVehicleInfo(item.vehicle)">
                        {{ formatVehicleInfo(item.vehicle) }}
                      </div>
                    </div>
                    <span v-else class="text-medium-emphasis text-body-2">-</span>
                  </td>

                  <td class="text-no-wrap text-right py-3">
                    <div v-if="item" class="font-weight-bold text-subtitle-1 text-grey-darken-4"
                      :class="item.status === 'canceled' ? 'text-decoration-line-through text-medium-emphasis' : ''">
                      {{ formatCurrency(item.total) }}
                    </div>
                  </td>

                  <td class="text-no-wrap text-center py-3">
                    <div v-if="item" class="d-flex flex-column align-center gap-1">
                      <!-- Estado General (Status dot) -->
                      <div class="d-flex align-center gap-1">
                        <span class="rounded-circle d-inline-block" :class="`bg-${getStatusInfo(item.status)?.color}`"
                          style="width: 10px; height: 10px;"></span>
                        <span class="text-body-2 font-weight-bold text-grey-darken-3">{{ getStatusInfo(item.status)?.text
                        }}</span>
                      </div>
                      <!-- Estado Pago (Text badge) -->
                      <div v-if="item.status !== 'canceled' && item.document_type !== 'quote'"
                        class="text-caption font-weight-bold"
                        :class="`text-${getPaymentStatusInfo(item.payment_status)?.color}`"
                        style="letter-spacing: 0.05em;">
                        {{ getPaymentStatusInfo(item.payment_status)?.text }}
                      </div>
                    </div>
                  </td>

                  <td class="text-no-wrap text-center py-3">
                    <div v-if="item" class="d-flex justify-center align-center">
                      <!-- Ver Detalle (Acción rápida) -->
                      <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver Detalle"
                        @click="viewSale(item)">
                        <VIcon icon="ri-eye-line" size="20" />
                      </VBtn>

                      <!-- Más Acciones (Dropdown) -->
                      <VBtn class="action-btn" variant="text" icon size="small" color="secondary" title="Acciones">
                        <VIcon icon="ri-more-2-line" size="20" />
                        <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                          <VList density="compact" class="py-1">
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
                            <VListItem :disabled="item.status === 'canceled'" prepend-icon="ri-edit-line"
                              title="Editar Venta" class="text-warning text-body-2" @click="editSale(item)" />
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
          <div class="d-block d-md-none pa-5">
            <div v-for="date in Object.keys(groupedSales)" :key="date" class="mb-6">
              <!-- Cabecera de Grupo por Día -->
              <div class="date-group-header d-flex align-center my-4">
                <VIcon
                  icon="ri-calendar-event-line"
                  color="primary"
                  class="me-2"
                  size="20"
                />
                <span class="text-subtitle-1 font-weight-bold text-grey-darken-3 text-capitalize">
                  {{ formatDateGroup(date) }}
                </span>
                <VDivider class="ms-3" />
              </div>

              <!-- Tarjetas del Día -->
              <VRow>
                <VCol 
                  v-for="item in groupedSales[date]" 
                  :key="item.id"
                  cols="12"
                  sm="6"
                  md="4"
                  class="d-flex"
                >
                  <VCard class="w-100 rounded-lg border-light border overflow-hidden elevation-1 hover-shadow transition-all d-flex flex-column">
                    <!-- Cabecera de la Tarjeta -->
                    <VCardText class="pa-3 bg-grey-lighten-5 border-bottom-light d-flex justify-space-between align-center flex-wrap gap-2">
                      <div class="d-flex align-center gap-2">
                        <VChip
                          :color="getDocumentTypeInfo(item.document_type)?.color"
                          size="small"
                          variant="tonal"
                          class="font-weight-bold text-uppercase"
                          label
                        >
                          {{ getDocumentTypeInfo(item.document_type)?.text }}
                        </VChip>
                        <span class="text-subtitle-2 font-weight-bold text-primary cursor-pointer hover-underline" @click="viewSale(item)">
                          {{ item.document_number }}
                        </span>
                      </div>

                      <!-- Estado General -->
                      <div class="d-flex align-center gap-1">
                        <span class="rounded-circle d-inline-block" :class="`bg-${getStatusInfo(item.status)?.color}`"
                          style="width: 8px; height: 8px;"></span>
                        <span class="text-body-2 font-weight-bold text-grey-darken-3">{{ getStatusInfo(item.status)?.text }}</span>
                      </div>
                    </VCardText>

                    <!-- Cuerpo de la Tarjeta -->
                    <VCardText class="pa-3 flex-grow-1">
                      <div class="d-flex flex-column gap-2">
                        <!-- Cliente -->
                        <div class="d-flex align-start gap-2">
                          <VAvatar color="info" variant="tonal" size="28" class="mt-0">
                            <VIcon icon="ri-user-line" size="15" />
                          </VAvatar>
                          <div class="overflow-hidden w-100">
                            <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold" style="font-size: 0.65rem; letter-spacing: 0.5px;">Cliente</div>
                            <div class="text-body-2 font-weight-semibold text-grey-darken-4 text-truncate" :title="getClientName(item.client)">
                              {{ getClientName(item.client) }}
                            </div>
                            <div v-if="item.client?.n_document" class="text-caption text-medium-emphasis">
                              Doc: {{ item.client.n_document }}
                            </div>
                          </div>
                        </div>

                        <!-- Vehículo -->
                        <div v-if="item.vehicle" class="d-flex align-start gap-2">
                          <VAvatar color="primary" variant="tonal" size="28" class="mt-0">
                            <VIcon icon="ri-car-line" size="15" />
                          </VAvatar>
                          <div class="overflow-hidden w-100">
                            <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold" style="font-size: 0.65rem; letter-spacing: 0.5px;">Vehículo</div>
                            <div class="text-body-2 font-weight-bold text-primary text-truncate">
                              {{ item.vehicle.license_plate }}
                            </div>
                            <div class="text-caption text-medium-emphasis text-truncate" :title="formatVehicleInfo(item.vehicle)">
                              {{ formatVehicleInfo(item.vehicle) }}
                            </div>
                          </div>
                        </div>

                        <!-- Total y Pago -->
                        <div class="d-flex align-start gap-2">
                          <VAvatar color="success" variant="tonal" size="28" class="mt-0">
                            <VIcon icon="ri-money-dollar-circle-line" size="15" />
                          </VAvatar>
                          <div class="w-100">
                            <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold" style="font-size: 0.65rem; letter-spacing: 0.5px;">Total</div>
                            <div class="d-flex align-center gap-2 flex-wrap">
                              <span class="text-subtitle-1 font-weight-bold text-success" :class="item.status === 'canceled' ? 'text-decoration-line-through text-medium-emphasis' : ''">
                                {{ formatCurrency(item.total) }}
                              </span>
                              <!-- Estado Pago (Text badge) -->
                              <VChip v-if="item.status !== 'canceled' && item.document_type !== 'quote'"
                                size="x-small"
                                :color="getPaymentStatusInfo(item.payment_status)?.color"
                                variant="tonal"
                                class="font-weight-bold"
                              >
                                {{ getPaymentStatusInfo(item.payment_status)?.text }}
                              </VChip>
                            </div>
                          </div>
                        </div>
                      </div>
                    </VCardText>

                    <VDivider />

                    <!-- Acciones -->
                    <VCardActions class="pa-2 justify-end bg-grey-lighten-5 mt-auto">
                      <!-- Ver Detalle (Acción rápida) -->
                      <VBtn
                        variant="text"
                        color="info"
                        prepend-icon="ri-eye-line"
                        size="small"
                        class="text-none font-weight-bold action-btn"
                        @click="viewSale(item)"
                      >
                        Ver Detalle
                      </VBtn>

                      <!-- Más Acciones (Dropdown) -->
                      <VBtn
                        variant="text"
                        color="secondary"
                        prepend-icon="ri-more-2-line"
                        size="small"
                        class="text-none font-weight-bold action-btn"
                      >
                        Más
                        <VMenu
                          activator="parent"
                          transition="slide-y-transition"
                          align="end"
                          location="bottom end"
                        >
                          <VList density="compact" class="py-1">
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
                            <VListItem :disabled="item.status === 'canceled'" prepend-icon="ri-edit-line"
                              title="Editar Venta" class="text-warning text-body-2" @click="editSale(item)" />
                            <VDivider class="my-1" />
                            <VListItem :disabled="item.status === 'canceled'" prepend-icon="ri-close-circle-line"
                              title="Anular Documento" class="text-error text-body-2" @click="cancelSale(item)" />
                          </VList>
                        </VMenu>
                      </VBtn>
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
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Dialogs -->
    <SaleViewDialog v-if="isViewDialogVisible" v-model:is-dialog-visible="isViewDialogVisible" :sale-data="selectedSale"
      :loading="viewLoading" />

    <SaleDeleteDialog v-if="isDeleteDialogVisible" v-model:isDialogVisible="isDeleteDialogVisible"
      :sale-selected="selectedSale" @delete-sale="handleDeleteSale" />


    <!-- Payment Dialog -->
    <VDialog v-model="isPaymentDialogVisible" max-width="500">
      <VCard>
        <VCardTitle class="text-h5">
          Registrar Pago
        </VCardTitle>
        <VCardText>
          <div class="mb-4">
            <p class="text-body-1">
              Venta: <strong>{{ selectedSale?.document_number }}</strong>
            </p>
            <p class="text-body-1">
              Total: <strong>{{ formatCurrency(selectedSale?.total) }}</strong>
            </p>
          </div>

          <VSelect v-model="paymentForm.payment_method" :items="paymentMethodOptions" item-title="title"
            item-value="value" label="Método de Pago" variant="outlined" density="comfortable" />

          <VCheckbox v-model="paymentForm.convert_to_invoice" label="Convertir a Factura" class="mt-4" />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn color="secondary" variant="text" @click="isPaymentDialogVisible = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" @click="registerPayment">
            Registrar Pago
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de ventas */
.sales-table :deep(thead) {
  background-color: #f8fafc !important;
}

.sales-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.sales-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.sales-row:hover {
  background-color: #f8fafc !important;
}

.action-btn {
  transition: all 0.2s ease;
  border-radius: 6px !important;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}

.clickable-link {
  cursor: pointer;
  color: rgb(var(--v-theme-primary)) !important;
  transition: opacity 0.2s ease;
}

.clickable-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}

/* Estilos de tarjetas y sombreados */
.hover-shadow {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.hover-shadow:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08) !important;
  border-color: rgba(var(--v-theme-primary), 0.4) !important;
}

.hover-underline:hover {
  text-decoration: underline;
}
</style>