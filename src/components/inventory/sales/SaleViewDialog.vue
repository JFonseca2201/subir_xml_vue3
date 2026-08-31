<script setup>
import { computed, ref } from 'vue'
import { getBrandNameById } from '@/data/vehicleBrands'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  saleData: {
    type: Object,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const { showNotification } = useGlobalToast()
const copiedKey = ref(false)

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

const statusOptions = [
  { title: 'Completada', value: 'completed' },
  { title: 'Pendiente', value: 'pending' },
  { title: 'Anulada', value: 'canceled' },
]

const isInvoice = computed(() => props.saleData?.document_type === 'invoice')

const formattedSequential = computed(() => {
  const docNum = props.saleData?.document_number || ''
  const cleanNum = docNum.replace(/\D/g, '')
  if (cleanNum && isInvoice.value) {
    return `001-001-${cleanNum.padStart(9, '0')}`
  }
  return docNum || '—'
})

const sriEnvironment = computed(() => {
  const key = props.saleData?.sri_access_key || ''
  if (key.length >= 24) {
    return key.charAt(23) === '2' ? 'PRODUCCIÓN' : 'PRUEBAS'
  }
  return props.saleData?.sri_environment || 'PRUEBAS'
})

const sriStatus = computed(() => props.saleData?.sri_status || null)

const sriStatusColor = computed(() => {
  const s = (sriStatus.value || '').toUpperCase()
  if (s === 'AUTORIZADA' || s === 'AUTORIZADO') return 'success'
  if (s === 'DEVUELTA' || s === 'RECHAZADA') return 'error'
  if (s === 'ENVIADA' || s === 'FIRMADA' || s === 'PROCESO') return 'info'
  return 'warning'
})

const sriStatusIcon = computed(() => {
  const s = (sriStatus.value || '').toUpperCase()
  if (s === 'AUTORIZADA' || s === 'AUTORIZADO') return 'ri-checkbox-circle-line'
  if (s === 'DEVUELTA' || s === 'RECHAZADA') return 'ri-close-circle-line'
  if (s === 'ENVIADA' || s === 'FIRMADA' || s === 'PROCESO') return 'ri-loader-4-line'
  return 'ri-time-line'
})

const getDocumentTypeLabel = computed(() => {
  const option = documentTypeOptions.find(opt => opt.value === props.saleData?.document_type)

  return option?.title || 'No especificado'
})

const getPaymentStatusLabel = computed(() => {
  const option = paymentStatusOptions.find(opt => opt.value === props.saleData?.payment_status)

  return option?.title || 'No especificado'
})

const getStatusLabel = computed(() => {
  if (props.saleData?.status === 'canceled') return 'Anulada'
  if (props.saleData?.document_type === 'quote') return 'Cotización'

  return getPaymentStatusLabel.value
})

const getDocumentTypeColor = computed(() => ({
  quote: 'info',
  sale_note: 'primary',
  invoice: 'deep-purple',
}[props.saleData?.document_type] || 'grey'))

const getPaymentStatusColor = computed(() => ({
  paid: 'success',
  partial: 'warning',
  pending: 'error',
}[props.saleData?.payment_status] || 'grey'))

const getStatusColor = computed(() => {
  if (props.saleData?.status === 'canceled') return 'error'
  if (props.saleData?.document_type === 'quote') return 'info'

  return getPaymentStatusColor.value
})

const documentTypeIcon = computed(() => ({
  quote: 'ri-file-list-3-line',
  sale_note: 'ri-receipt-line',
  invoice: 'ri-bill-line',
}[props.saleData?.document_type] || 'ri-file-text-line'))

const statusIcon = computed(() => {
  if (props.saleData?.status === 'canceled') return 'ri-close-circle-line'
  if (props.saleData?.document_type === 'quote') return 'ri-file-list-3-line'
  if (props.saleData?.payment_status === 'paid') return 'ri-checkbox-circle-line'
  if (props.saleData?.payment_status === 'partial') return 'ri-time-line'

  return 'ri-error-warning-line'
})

const getClientName = computed(() => {
  const client = props.saleData?.client
  if (!client) return 'Consumidor final'

  return client.full_name || client.name ||
    `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Cliente'
})

const getClientDocument = computed(() => props.saleData?.client?.n_document || '—')

const getClientPhone = computed(() => props.saleData?.client?.phone || '—')

const getClientEmail = computed(() => props.saleData?.client?.email || '—')

const getVehicleLicensePlate = computed(() => props.saleData?.vehicle?.license_plate || null)

const getVehicleInfo = computed(() => {
  const vehicle = props.saleData?.vehicle
  if (!vehicle) return null

  const brandName = vehicle.brand ? getBrandNameById(vehicle.brand) : ''

  return [brandName, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || '—'
})

const technicians = computed(() => props.saleData?.technicians || [])

const getPaymentDistributions = computed(() =>
  props.saleData?.finance_record?.payment_distributions || [],
)

const hasPaymentDistributions = computed(() => getPaymentDistributions.value.length > 0)

const itemsCount = computed(() => props.saleData?.details?.length || 0)

const isQuote = computed(() => {
  return props.saleData?.document_type === 'quote' ||
    !props.saleData?.document_type ||
    'converted_sale_id' in (props.saleData || {})
})

const displayTotal = computed(() => {
  if (isQuote.value) {
    return Number(props.saleData?.total) || 0
  }

  return Number(props.saleData?.total) || 0
})

const displaySubtotal = computed(() => {
  if (isQuote.value) {
    return displayTotal.value / 1.15
  }

  return Number(props.saleData?.subtotal) || 0
})

const displayTaxAmount = computed(() => {
  if (isQuote.value) {
    return displayTotal.value - displaySubtotal.value
  }

  return Number(props.saleData?.tax_amount) || 0
})

const totalDiscount = computed(() => {
  if (!props.saleData?.details) return 0
  return props.saleData.details.reduce((sum, d) => sum + Number(d.discount || 0), 0)
})

const subtotalIva15 = computed(() => {
  if (props.saleData?.subtotal_iva_15 !== undefined && Number(props.saleData.subtotal_iva_15) > 0) {
    return Number(props.saleData.subtotal_iva_15)
  }
  if (!props.saleData?.details) return displaySubtotal.value
  return props.saleData.details
    .filter(d => Number(d.tax_rate ?? 15) > 0)
    .reduce((sum, d) => {
      const gross = Number(d.quantity || 1) * Number(d.price || 0)
      const disc = Number(d.discount || 0)
      const rate = Number(d.tax_rate ?? 15)
      return sum + ((gross - disc) / (1 + (rate / 100)))
    }, 0)
})

const subtotalIva0 = computed(() => {
  if (props.saleData?.subtotal_iva_0 !== undefined && Number(props.saleData.subtotal_iva_0) > 0) {
    return Number(props.saleData.subtotal_iva_0)
  }
  if (!props.saleData?.details) return 0
  return props.saleData.details
    .filter(d => Number(d.tax_rate ?? 15) === 0)
    .reduce((sum, d) => {
      const gross = Number(d.quantity || 1) * Number(d.price || 0)
      const disc = Number(d.discount || 0)
      return sum + (gross - disc)
    }, 0)
})

const hasVehicle = computed(() => !!props.saleData?.vehicle || !!getVehicleLicensePlate.value)

/** Método real: prioriza pagos distribuidos sobre el campo de cabecera (a veces queda "Efectivo" por defecto). */
const displayPaymentMethod = computed(() => {
  const dists = getPaymentDistributions.value
  if (dists.length > 0) {
    const methods = dists.map(d => {
      const bName = d.account?.bank_name || (d.account?.type === 'bank' ? d.account?.name : '')
      if (bName && d.payment_method?.toLowerCase() === 'transferencia') {
        return `${d.payment_method} - ${bName}`
      }

      return d.payment_method
    }).filter(Boolean)
    const uniqueMethods = [...new Set(methods)]
    if (uniqueMethods.length) return uniqueMethods.join(', ')
  }

  return props.saleData?.payment_method || '—'
})

const formatCurrency = value => new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
}).format(value || 0)

const formatDate = dateString => {
  if (!dateString) return '—'
  const parts = dateString.split('T')[0].split(' ')[0].split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateString
}

const formatDateTime = dateStr => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const pad = n => String(n).padStart(2, '0')
    const day = pad(d.getDate())
    const month = pad(d.getMonth() + 1)
    const year = d.getFullYear()
    const hours = pad(d.getHours())
    const mins = pad(d.getMinutes())
    const secs = pad(d.getSeconds())
    return `${day}/${month}/${year} ${hours}:${mins}:${secs}`
  } catch (e) {
    return dateStr
  }
}

const copyAccessKey = async () => {
  const key = props.saleData?.sri_access_key
  if (!key) {
    showNotification('No hay clave de acceso registrada', 'warning')
    return
  }

  let successful = false

  // Try modern Clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(key)
      successful = true
    } catch (e) {
      successful = false
    }
  }

  // Fallback for non-HTTPS / restricted environments
  if (!successful) {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = key
      textArea.setAttribute('readonly', '')
      textArea.style.position = 'fixed'
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.width = '2em'
      textArea.style.height = '2em'
      textArea.style.padding = '0'
      textArea.style.border = 'none'
      textArea.style.outline = 'none'
      textArea.style.boxShadow = 'none'
      textArea.style.background = 'transparent'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      textArea.setSelectionRange(0, 99999)
      successful = document.execCommand('copy')
      document.body.removeChild(textArea)
    } catch (err) {
      successful = false
    }
  }

  if (successful) {
    copiedKey.value = true
    showNotification('Clave de acceso copiada al portapapeles', 'success')
    setTimeout(() => { copiedKey.value = false }, 2500)
  } else {
    showNotification('Por favor selecciona y copia la clave manualmente', 'info')
  }
}

const downloadXml = async () => {
  if (!props.saleData?.id) return
  try {
    const response = await $api(`sales/${props.saleData.id}/xml`, {
      method: 'GET',
      responseType: 'blob',
    })
    const blob = new Blob([response], { type: 'application/xml' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `FAC_${props.saleData.document_number || props.saleData.id}.xml`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    showNotification('XML descargado exitosamente', 'success')
  } catch (err) {
    showNotification('El XML aún no está disponible', 'warning')
  }
}

const downloadRide = async () => {
  if (!props.saleData?.id) return
  try {
    const response = await $api(`sales/${props.saleData.id}/ride`, {
      method: 'GET',
      responseType: 'blob',
    })
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RIDE_${props.saleData.document_number || props.saleData.id}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    showNotification('RIDE PDF descargado exitosamente', 'success')
  } catch (err) {
    showNotification('Error al descargar RIDE PDF', 'error')
  }
}

const isResending = ref(false)
const resendSri = async () => {
  if (!props.saleData?.id) return
  isResending.value = true
  try {
    const response = await $api(`sales/${props.saleData.id}/sri/reenviar`, {
      method: 'POST',
    })
    if (response?.success) {
      showNotification(response.message || 'Factura reenviada al SRI correctamente', 'success')
    } else {
      showNotification(response?.message || 'Error al reenviar al SRI', 'warning')
    }
  } catch (err) {
    showNotification('Error al conectar con el servicio SRI', 'error')
  } finally {
    isResending.value = false
  }
}

const isSendingEmail = ref(false)
const sendEmail = async () => {
  if (!props.saleData?.id) return
  isSendingEmail.value = true
  try {
    const response = await $api(`sales/${props.saleData.id}/sri/enviar-email`, {
      method: 'POST',
    })
    if (response?.success) {
      showNotification('Factura electrónica enviada por correo al cliente', 'success')
    } else {
      showNotification(response?.message || 'Error al enviar por correo', 'warning')
    }
  } catch (err) {
    showNotification('Error al enviar correo', 'error')
  } finally {
    isSendingEmail.value = false
  }
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const printSale = saleId => {
  try {
    const token = localStorage.getItem('token')
    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
    const resource = isQuote.value ? 'quotes' : 'sales'
    const pdfUrl = `${apiBaseUrl}/${resource}/${saleId}/pdf?token=${token}&print=true`

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

const generateSinglePDF = sale => {
  const token = localStorage.getItem('token')
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
  const resource = isQuote.value ? 'quotes' : 'sales'
  const pdfUrl = `${apiBaseUrl}/${resource}/${sale.id}/pdf?token=${token}`

  const printWindow = window.open(pdfUrl, '_blank')
  if (printWindow) {
    printWindow.focus()
    showNotification('PDF cargado exitosamente', 'success')
  } else {
    showNotification('Permite las ventanas emergentes para abrir el PDF', 'warning')
  }
}
</script>

<template>
  <VDialog :model-value="props.isDialogVisible" max-width="1140" transition="dialog-bottom-transition"
    @update:model-value="closeDialog">
    <VCard class="sale-view-dialog-card rounded-xl overflow-hidden elevation-12">
      <!-- Modern Radiant Header -->
      <div class="sale-dialog-header">
        <VBtn icon="ri-close-line" variant="text" size="small" class="dialog-close-btn" @click="closeDialog" />

        <div class="d-flex align-center gap-4 flex-wrap">
          <div class="header-avatar-glow">
            <VIcon :icon="documentTypeIcon" size="28" color="white" />
          </div>

          <div class="flex-grow-1">
            <div class="d-flex align-center gap-2 flex-wrap">
              <span class="text-caption font-weight-bold text-white-50 text-uppercase tracking-wider">
                Comprobante de {{ getDocumentTypeLabel }}
              </span>
              <VChip v-if="sriEnvironment" size="x-small"
                :color="sriEnvironment === 'PRODUCCIÓN' ? 'success' : 'amber-darken-2'" variant="flat"
                class="font-weight-bold text-white shadow-sm">
                <VIcon start icon="ri-shield-flash-line" size="11" />
                {{ sriEnvironment }}
              </VChip>
            </div>

            <h2 class="text-h5 font-weight-black text-white mt-0.5 tracking-tight d-flex align-center gap-2 flex-wrap">
              <span>{{ isInvoice ? 'Factura' : 'Venta' }} #{{ formattedSequential }}</span>
            </h2>
          </div>

          <!-- Header Badges -->
          <div class="d-flex align-center gap-2 flex-wrap header-meta-pills">
            <div class="glass-pill">
              <VIcon icon="ri-calendar-event-line" size="15" class="me-1 text-white-70" />
              <span class="text-caption text-white font-weight-medium">{{ formatDate(saleData.service_date) }}</span>
            </div>

            <div
              v-if="saleData.work_order_id || saleData.work_order_number || saleData.work_order?.number || saleData.workOrder?.number"
              class="glass-pill glass-pill--ot">
              <VIcon icon="ri-tools-line" size="15" class="me-1 text-amber-lighten-2" />
              <span class="text-caption font-weight-bold text-white">
                OT #{{ saleData.work_order_number || saleData.work_order?.number || saleData.workOrder?.number }}
              </span>
            </div>

            <VChip :color="isInvoice && sriStatus ? sriStatusColor : getStatusColor" size="small" variant="flat"
              class="font-weight-bold text-white elevation-2">
              <VIcon start :icon="isInvoice && sriStatus ? sriStatusIcon : statusIcon" size="14" />
              {{ isInvoice && sriStatus ? sriStatus : getStatusLabel }}
            </VChip>
          </div>
        </div>
      </div>

      <VCardText class="pa-6 dialog-body-content bg-slate-50">
        <div v-if="loading" class="d-flex flex-column align-center justify-center py-16">
          <VProgressCircular indeterminate color="primary" size="54" width="4" />
          <p class="text-body-2 text-medium-emphasis mt-4 font-weight-medium">
            Cargando información del comprobante...
          </p>
        </div>

        <template v-else>
          <!-- 4 Stat Cards Modernas (Layout Superior) -->
          <VRow class="mb-5 g-3">
            <!-- 1. Total -->
            <VCol cols="12" sm="6" md="3">
              <div class="stat-glass-card stat-card--total h-100">
                <div class="d-flex align-center gap-3">
                  <div class="stat-icon-wrapper stat-icon--total">
                    <VIcon icon="ri-money-dollar-circle-line" size="22" />
                  </div>
                  <div>
                    <div class="stat-label">
                      Total Facturado
                    </div>
                    <div class="stat-value text-primary font-weight-black">
                      {{ formatCurrency(saleData.total) }}
                    </div>
                  </div>
                </div>
              </div>
            </VCol>

            <!-- 2. Estado de pago / SRI -->
            <VCol cols="12" sm="6" md="3">
              <div class="stat-glass-card stat-card--status h-100">
                <div class="d-flex align-center gap-3">
                  <div class="stat-icon-wrapper stat-icon--status">
                    <VIcon :icon="isInvoice ? 'ri-shield-check-line' : 'ri-wallet-3-line'" size="22" />
                  </div>
                  <div>
                    <div class="stat-label">
                      Estado {{ isInvoice ? 'SRI' : 'Pago' }}
                    </div>
                    <div class="mt-0.5">
                      <VChip :color="isInvoice && sriStatus ? sriStatusColor : getPaymentStatusColor" size="small"
                        variant="tonal" class="font-weight-bold">
                        {{ isInvoice && sriStatus ? sriStatus : getPaymentStatusLabel }}
                      </VChip>
                    </div>
                  </div>
                </div>
              </div>
            </VCol>

            <!-- 3. Ítems -->
            <VCol cols="12" sm="6" md="3">
              <div class="stat-glass-card stat-card--items h-100">
                <div class="d-flex align-center gap-3">
                  <div class="stat-icon-wrapper stat-icon--items">
                    <VIcon icon="ri-shopping-bag-3-line" size="22" />
                  </div>
                  <div>
                    <div class="stat-label">
                      Ítems
                    </div>
                    <div class="stat-value text-slate-800 font-weight-black">
                      {{ itemsCount }} <span class="text-caption font-weight-medium text-medium-emphasis">{{ itemsCount
                        === 1 ? 'ítem' : 'ítems' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </VCol>

            <!-- 4. Método de pago -->
            <VCol cols="12" sm="6" md="3">
              <div class="stat-glass-card stat-card--payment h-100">
                <div class="d-flex align-center gap-3">
                  <div class="stat-icon-wrapper stat-icon--payment">
                    <VIcon icon="ri-bank-card-line" size="22" />
                  </div>
                  <div class="overflow-hidden">
                    <div class="stat-label">
                      Método de pago
                    </div>
                    <div class="text-body-2 font-weight-bold text-slate-800 text-truncate"
                      :title="displayPaymentMethod">
                      {{ displayPaymentMethod }}
                    </div>
                  </div>
                </div>
              </div>
            </VCol>
          </VRow>

          <!-- Clave de Acceso SRI (49 dígitos) - Cyber Ribbon Card -->
          <div v-if="saleData.sri_access_key" class="sri-security-ribbon mb-5">
            <div class="d-flex align-center gap-3 flex-grow-1 min-w-0">
              <div class="sri-shield-avatar">
                <VIcon icon="ri-shield-keyhole-line" size="22" color="indigo-darken-2" />
              </div>
              <div class="overflow-hidden">
                <div class="d-flex align-center gap-2 flex-wrap">
                  <span class="text-caption font-weight-black text-indigo-darken-3 text-uppercase tracking-wider">
                    Clave de Acceso SRI (49 Dígitos)
                  </span>
                  <span class="text-caption text-medium-emphasis">· Comprobante Oficial</span>
                </div>
                <div
                  class="font-monospace text-body-2 font-weight-bold text-indigo-darken-4 text-break user-select-all mt-0.5 tracking-wide">
                  {{ saleData.sri_access_key }}
                </div>
              </div>
            </div>

            <div class="d-flex align-center gap-2 flex-wrap justify-end">
              <VBtn v-if="sriStatus && sriStatus !== 'AUTORIZADA' && sriStatus !== 'AUTORIZADO'" size="small"
                variant="outlined" color="warning" :loading="isResending" prepend-icon="ri-refresh-line"
                class="font-weight-bold rounded-lg" @click="resendSri">
                Reintentar SRI
              </VBtn>

              <VBtn size="small" variant="flat" :color="copiedKey ? 'success' : 'primary'"
                :prepend-icon="copiedKey ? 'ri-check-line' : 'ri-file-copy-line'"
                class="copy-key-btn rounded-lg text-white font-weight-bold px-3" @click="copyAccessKey">
                {{ copiedKey ? '¡Copiada!' : 'Copiar Clave' }}
              </VBtn>
            </div>
          </div>

          <!-- Cliente y Vehículo -->
          <VRow class="mb-5">
            <!-- Cliente -->
            <VCol cols="12" :md="hasVehicle ? 6 : 12">
              <div class="modern-section-panel h-100">
                <div class="panel-header mb-4">
                  <div class="panel-icon-circle bg-emerald-50 text-emerald-600">
                    <VIcon icon="ri-user-smile-line" size="20" />
                  </div>
                  <div>
                    <h4 class="text-subtitle-1 font-weight-bold text-slate-800">
                      Datos del Cliente
                    </h4>
                    <span class="text-caption text-medium-emphasis">Información de facturación</span>
                  </div>
                </div>

                <div class="detail-rows">
                  <div class="detail-row">
                    <span class="detail-label">
                      <VIcon icon="ri-user-line" size="15" /> Razón Social
                    </span>
                    <span class="detail-value font-weight-bold text-slate-900">{{ getClientName }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">
                      <VIcon icon="ri-id-card-line" size="15" /> RUC / Cédula
                    </span>
                    <span class="detail-value font-monospace font-weight-semibold">{{ getClientDocument }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">
                      <VIcon icon="ri-phone-line" size="15" /> Teléfono
                    </span>
                    <span class="detail-value">{{ getClientPhone }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">
                      <VIcon icon="ri-mail-line" size="15" /> Email
                    </span>
                    <span class="detail-value text-lowercase">{{ getClientEmail }}</span>
                  </div>
                  <div v-if="!hasVehicle && technicians.length" class="detail-row align-start mt-2">
                    <span class="detail-label">
                      <VIcon icon="ri-user-settings-line" size="15" /> Técnicos
                    </span>
                    <span class="detail-value">
                      <div class="d-flex flex-wrap gap-1 justify-end">
                        <VChip v-for="tech in technicians" :key="tech.id" size="small" color="primary" variant="tonal"
                          class="font-weight-medium">
                          {{ tech.first_name }} {{ tech.last_name }}
                        </VChip>
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            </VCol>

            <!-- Vehículo -->
            <VCol v-if="hasVehicle" cols="12" md="6">
              <div class="modern-section-panel h-100">
                <div class="panel-header mb-4">
                  <div class="panel-icon-circle bg-blue-50 text-blue-600">
                    <VIcon icon="ri-car-line" size="20" />
                  </div>
                  <div>
                    <h4 class="text-subtitle-1 font-weight-bold text-slate-800">
                      Vehículo Asociado
                    </h4>
                    <span class="text-caption text-medium-emphasis">Detalle del servicio</span>
                  </div>
                </div>

                <div class="detail-rows">
                  <div class="detail-row">
                    <span class="detail-label">
                      <VIcon icon="ri-qr-code-line" size="15" /> Placa
                    </span>
                    <span class="detail-value">
                      <span v-if="getVehicleLicensePlate" class="plate-badge">
                        {{ getVehicleLicensePlate }}
                      </span>
                      <span v-else class="text-medium-emphasis">—</span>
                    </span>
                  </div>
                  <div v-if="saleData.vehicle" class="detail-row">
                    <span class="detail-label">
                      <VIcon icon="ri-roadster-line" size="15" /> Modelo
                    </span>
                    <span class="detail-value font-weight-semibold">{{ getVehicleInfo }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">
                      <VIcon icon="ri-dashboard-3-line" size="15" /> Kilometraje
                    </span>
                    <span class="detail-value font-weight-semibold">
                      {{ saleData.mileage ? `${saleData.mileage} km` : '—' }}
                    </span>
                  </div>
                  <div v-if="technicians.length" class="detail-row align-start mt-2">
                    <span class="detail-label">
                      <VIcon icon="ri-user-settings-line" size="15" /> Técnicos
                    </span>
                    <span class="detail-value">
                      <div class="d-flex flex-wrap gap-1 justify-end">
                        <VChip v-for="tech in technicians" :key="tech.id" size="small" color="primary" variant="tonal"
                          class="font-weight-medium">
                          {{ tech.first_name }} {{ tech.last_name }}
                        </VChip>
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            </VCol>
          </VRow>

          <!-- Historial de Pagos / Transacciones -->
          <VRow class="mb-5">
            <VCol cols="12">
              <div class="modern-section-panel">
                <div class="panel-header mb-3">
                  <div class="panel-icon-circle bg-amber-50 text-amber-600">
                    <VIcon icon="ri-wallet-3-line" size="20" />
                  </div>
                  <div>
                    <h4 class="text-subtitle-1 font-weight-bold text-slate-800">
                      Transacciones y Pagos
                    </h4>
                    <span class="text-caption text-medium-emphasis">Distribución financiera</span>
                  </div>
                </div>

                <div v-if="hasPaymentDistributions" class="rounded-lg overflow-hidden border border-slate-200">
                  <VTable density="compact" class="modern-flat-table">
                    <thead>
                      <tr>
                        <th style="width: 50px;">
                          #
                        </th>
                        <th>Método de Pago</th>
                        <th>Cuenta Destino</th>
                        <th class="text-right" style="width: 160px;">
                          Monto Recibido
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(dist, index) in getPaymentDistributions" :key="dist.id || index">
                        <td class="text-medium-emphasis font-weight-medium">
                          {{ index + 1 }}
                        </td>
                        <td class="font-weight-bold text-slate-800">
                          <VChip size="x-small" variant="tonal" color="primary" class="font-weight-bold me-1">
                            {{ dist.payment_method }}
                          </VChip>
                        </td>
                        <td class="text-slate-700 font-weight-medium">
                          {{ dist.account?.name || `Cuenta ${dist.account_id}` }}
                        </td>
                        <td class="text-right font-weight-black text-success text-subtitle-2">
                          {{ formatCurrency(dist.amount) }}
                        </td>
                      </tr>
                    </tbody>
                  </VTable>
                </div>

                <div v-else class="empty-panel-hint pa-6 text-center rounded-lg border border-dashed">
                  <VIcon
                    :icon="isQuote ? 'ri-file-list-3-line' : (saleData.is_credited ? 'ri-file-shield-2-line' : 'ri-checkbox-circle-line')"
                    size="34" :color="isQuote ? 'info' : (saleData.is_credited ? 'warning' : 'success')" class="mb-2" />
                  <div class="text-body-2 font-weight-bold text-slate-800">
                    {{ isQuote ? 'Documento de Cotización' : (saleData.is_credited ? 'Venta a Crédito' : 'Venta de
                    Contado') }}
                  </div>
                  <p class="text-caption text-medium-emphasis mb-0 mt-1">
                    {{ isQuote ? 'No genera salidas ni ingresos de caja hasta su conversión.' : (saleData.is_credited ?
                      'Registrado en cartera de cuentas por cobrar.' : 'Pago registrado en su totalidad.') }}
                  </p>
                </div>
              </div>
            </VCol>
          </VRow>

          <!-- Detalle de Ítems (Productos y Servicios) -->
          <div class="modern-section-panel mb-5">
            <div class="panel-header mb-4">
              <div class="panel-icon-circle bg-indigo-50 text-indigo-600">
                <VIcon icon="ri-shopping-cart-2-line" size="20" />
              </div>
              <div>
                <h4 class="text-subtitle-1 font-weight-bold text-slate-800">
                  Productos y Servicios
                </h4>
                <span class="text-caption text-medium-emphasis">{{ itemsCount }} {{ itemsCount === 1 ? 'ítem registrado'
                  : 'ítems registrados' }}</span>
              </div>
            </div>

            <div v-if="saleData.details?.length" class="rounded-lg overflow-hidden border border-slate-200">
              <VTable density="comfortable" class="modern-flat-table">
                <thead>
                  <tr>
                    <th style="width: 48%;">
                      Descripción del Ítem
                    </th>
                    <th class="text-center" style="width: 10%;">
                      Cant.
                    </th>
                    <th class="text-right" style="width: 14%;">
                      P. Unitario
                    </th>
                    <th class="text-right" style="width: 12%;">
                      Desc.
                    </th>
                    <th class="text-right" style="width: 16%;">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in saleData.details" :key="item.id || index">
                    <td>
                      <div class="font-weight-semibold text-slate-900 text-body-2">
                        {{ item.description }}
                      </div>
                      <div v-if="item.product?.sku" class="mt-1">
                        <span class="sku-badge">SKU: {{ item.product.sku }}</span>
                      </div>
                    </td>
                    <td class="text-center">
                      <span class="quantity-circle">{{ item.quantity }}</span>
                    </td>
                    <td class="text-right font-weight-medium text-slate-700">
                      {{ formatCurrency(item.price) }}
                    </td>
                    <td class="text-right text-medium-emphasis">
                      {{ formatCurrency(item.discount || 0) }}
                    </td>
                    <td class="text-right font-weight-black text-slate-900 text-body-2">
                      {{ formatCurrency(item.total) }}
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </div>

            <div v-else class="empty-panel-hint pa-8 text-center rounded-lg border border-dashed">
              <VIcon icon="ri-shopping-bag-3-line" size="42" color="grey-lighten-1" class="mb-2" />
              <p class="text-body-2 text-medium-emphasis mb-0">
                No hay productos registrados en este comprobante
              </p>
            </div>
          </div>

          <!-- Totales y Observaciones -->
          <VRow>
            <VCol cols="12" md="7">
              <div v-if="saleData.observations" class="modern-section-panel h-100">
                <div class="d-flex align-center gap-2 mb-2 text-indigo-darken-2">
                  <VIcon icon="ri-chat-1-line" size="18" />
                  <span class="text-subtitle-2 font-weight-bold">Observaciones</span>
                </div>
                <p class="text-body-2 mb-0 text-slate-700 bg-slate-50 pa-3 rounded-lg border border-slate-200">
                  {{ saleData.observations }}
                </p>
              </div>
            </VCol>

            <VCol cols="12" md="5">
              <div class="totals-summary-card pa-5 rounded-xl shadow-sm">
                <div class="d-flex justify-space-between align-center mb-2">
                  <span class="text-body-2 text-medium-emphasis font-weight-medium">Subtotal</span>
                  <span class="text-body-1 font-weight-semibold text-slate-800">{{ formatCurrency(displaySubtotal)
                  }}</span>
                </div>

                <div v-if="displayTaxAmount > 0" class="d-flex justify-space-between align-center mb-2">
                  <span class="text-body-2 text-medium-emphasis font-weight-medium">IVA (15%)</span>
                  <span class="text-body-1 font-weight-semibold text-slate-800">{{ formatCurrency(displayTaxAmount)
                  }}</span>
                </div>

                <div v-if="totalDiscount > 0" class="d-flex justify-space-between align-center mb-2 text-error">
                  <span class="text-body-2 font-weight-medium">Descuento</span>
                  <span class="text-body-1 font-weight-bold">-{{ formatCurrency(totalDiscount) }}</span>
                </div>

                <VDivider class="my-3 border-slate-300" />

                <div class="d-flex justify-space-between align-center">
                  <span class="text-subtitle-1 font-weight-black text-slate-900">Total a Pagar</span>
                  <span class="text-h5 font-weight-black text-primary">{{ formatCurrency(displayTotal) }}</span>
                </div>
              </div>
            </VCol>
          </VRow>
        </template>
      </VCardText>

      <VDivider />

      <!-- Footer Actions Flotante y Moderno -->
      <VCardActions class="pa-4 px-6 d-flex justify-end align-center gap-3 bg-white flex-wrap sticky-dialog-footer">
        <!-- Descargar XML (Facturas SRI) -->
        <VBtn v-if="isInvoice || saleData.sri_access_key" color="info" variant="outlined"
          prepend-icon="ri-file-code-line" class="rounded-lg px-4 font-weight-bold" height="42" @click="downloadXml">
          Descargar XML
        </VBtn>

        <!-- Descargar RIDE / Ver PDF -->
        <VBtn v-if="isInvoice || saleData.sri_access_key" color="primary" variant="elevated"
          prepend-icon="ri-file-pdf-line" class="rounded-lg px-5 font-weight-bold elevation-2" height="42"
          @click="downloadRide">
          Descargar RIDE
        </VBtn>
        <VBtn v-else color="primary" variant="elevated" prepend-icon="ri-file-pdf-line"
          class="rounded-lg px-6 font-weight-bold elevation-2" height="42" @click="generateSinglePDF(props.saleData)">
          Ver PDF
        </VBtn>

        <!-- Enviar por Email (si tiene email) -->
        <VBtn v-if="(isInvoice || saleData.sri_access_key) && saleData.client?.email" color="success" variant="tonal"
          prepend-icon="ri-mail-send-line" :loading="isSendingEmail" class="rounded-lg px-4 font-weight-bold"
          height="42" @click="sendEmail">
          Enviar Email
        </VBtn>

        <VBtn color="secondary" variant="tonal" prepend-icon="ri-printer-line" class="rounded-lg px-4 font-weight-bold"
          height="42" @click="printSale(props.saleData.id)">
          Imprimir
        </VBtn>

        <VBtn color="slate" variant="outlined" prepend-icon="ri-close-line" class="rounded-lg px-5 font-weight-medium"
          height="42" @click="closeDialog">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
