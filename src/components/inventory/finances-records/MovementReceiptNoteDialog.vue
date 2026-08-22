<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import ReceiptUploader from '@/components/common/ReceiptUploader.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  movement: {
    type: Object,
    default: null,
  },
  accounts: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'updated'])

const { showNotification } = useGlobalToast()

// Estados locales
const isLoadingAttachments = ref(false)
const attachments = ref([])
const showUploader = ref(false)
const newReceiptFiles = ref([])
const isUploading = ref(false)
const isDownloadingPdf = ref(false)

// Visor de foto en grande
const isLightboxOpen = ref(false)
const activePhotoIndex = ref(0)

// Helper para obtener URL completa
const getFullUrl = path => {
  if (!path) return ''
  if (typeof path === 'object' && path.url) return path.url
  if (path.startsWith('http://') || path.startsWith('https://')) return path

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const base = isLocal
    ? (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : 'http://127.0.0.1:8000')
    : `http://${hostname}:8000`

  const cleanPath = path.replace(/^\/?storage\/?/, '')
  return `${base}/storage/${cleanPath}`
}

// Tipo de movimiento normalizado
const movementType = computed(() => {
  if (!props.movement) return 'income'
  const t = props.movement.type
  if (t === 0 || t === '0' || t === 'income') return 'income'
  if (t === 1 || t === '1' || t === 'expense') return 'expense'
  if (t === 'transfer' || t === 'internal_transfer') return 'transfer'
  return 'income'
})

const typeTitle = computed(() => {
  switch (movementType.value) {
    case 'income':
      return 'Nota de Ingreso'
    case 'expense':
      return 'Nota de Egreso'
    case 'transfer':
      return 'Comprobante de Transferencia'
    default:
      return 'Nota de Movimiento'
  }
})

const typeIcon = computed(() => {
  switch (movementType.value) {
    case 'income':
      return 'ri-add-circle-line'
    case 'expense':
      return 'ri-indeterminate-circle-line'
    case 'transfer':
      return 'ri-arrow-left-right-line'
    default:
      return 'ri-exchange-funds-line'
  }
})

const typeColor = computed(() => {
  switch (movementType.value) {
    case 'income':
      return 'success'
    case 'expense':
      return 'error'
    case 'transfer':
      return 'info'
    default:
      return 'primary'
  }
})

// Código o número de documento
const docNumber = computed(() => {
  if (!props.movement) return '-'
  const m = props.movement

  // 1. Factura o código en el movimiento
  if (m.invoice_number) return m.invoice_number
  if (m.work_order_number) return m.work_order_number

  // 2. En metadata
  let meta = m.metadata
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta) } catch (e) { meta = {} }
  }
  if (meta) {
    if (meta.invoice) return meta.invoice
    if (meta.work_order) return meta.work_order
    if (meta.invoice_number) return meta.invoice_number
    if (meta.work_order_number) return meta.work_order_number
    if (meta.document_number) return meta.document_number
  }

  // 3. En movable o finance_record
  const movable = m.movable
  if (movable) {
    if (movable.finance_record?.invoice_number) return movable.finance_record.invoice_number
    if (movable.finance_record?.work_order_number) return movable.finance_record.work_order_number
    if (movable.invoice_number) return movable.invoice_number
    if (movable.work_order_number) return movable.work_order_number
    if (movable.number) return movable.number
  }

  if (movementType.value === 'transfer') {
    return `TRANS-${String(m.id || '').padStart(4, '0')}`
  }

  return `#${m.id || '-'}`
})

// Formato de moneda
const formatCurrency = val => {
  const num = Number(val || 0)
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

// Formato de fecha larga
const formattedDate = computed(() => {
  if (!props.movement?.entry_date) return '-'
  const rawDate = props.movement.entry_date
  try {
    const parts = String(rawDate).split('T')[0].split('-')
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return d.toLocaleDateString('es-EC', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
  } catch (e) {
    return rawDate
  }
  return rawDate
})

// Nombre de la cuenta origen / destino
const accountInfo = computed(() => {
  if (!props.movement) return { from: 'N/A', to: 'N/A', single: 'N/A' }
  const m = props.movement

  let meta = m.metadata
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta) } catch (e) { meta = {} }
  }

  if (movementType.value === 'transfer') {
    const fromName = meta?.from_account_name || props.accounts.find(a => a.id === meta?.from_account)?.name || 'Origen'
    const toName = meta?.to_account_name || props.accounts.find(a => a.id === meta?.to_account)?.name || 'Destino'
    return {
      from: fromName,
      to: toName,
      single: `${fromName} → ${toName}`,
    }
  }

  if (m.account?.name) {
    return { single: m.account.name }
  }

  if (m.account_id) {
    const acc = props.accounts.find(a => a.id === m.account_id)
    if (acc) return { single: acc.name }
  }

  return { single: 'Caja / Cuenta Principal' }
})

// Método de pago
const paymentMethod = computed(() => {
  if (!props.movement) return '-'
  const m = props.movement

  if (m.payment_method) return m.payment_method

  let meta = m.metadata
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta) } catch (e) { meta = {} }
  }
  if (meta?.payment_method) return meta.payment_method

  if (movementType.value === 'transfer') return 'Transferencia Interna'

  return 'Efectivo / Transferencia'
})

// ID para adjuntos
const attachableData = computed(() => {
  if (!props.movement) return { type: 'expense', id: 0 }
  const m = props.movement

  let meta = m.metadata
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta) } catch (e) { meta = {} }
  }

  const finRecordId = meta?.finance_record_id || m.movable?.finance_record_id || m.movable?.finance_record?.id || m.id
  const type = movementType.value === 'transfer' ? 'internal_transfer' : (movementType.value === 'income' ? 'finance_record' : 'expense')

  return {
    type,
    id: finRecordId,
    identifier: docNumber.value,
  }
})

// Cargar archivos adjuntos del movimiento
const loadAttachments = async () => {
  if (!props.movement) return

  isLoadingAttachments.value = true
  try {
    const params = {
      attachable_type: attachableData.value.type,
      attachable_id: attachableData.value.id,
    }
    if (attachableData.value.identifier && attachableData.value.identifier !== '-') {
      params.identifier = attachableData.value.identifier
    }

    const res = await $api('attachments', {
      method: 'GET',
      params,
    })

    if (res && res.status === 'success') {
      attachments.value = res.data || []
    } else if (props.movement.resolved_attachments) {
      attachments.value = props.movement.resolved_attachments
    }
  } catch (error) {
    console.error('Error al cargar comprobantes en diálogo:', error)
    if (props.movement.resolved_attachments) {
      attachments.value = props.movement.resolved_attachments
    }
  } finally {
    isLoadingAttachments.value = false
  }
}

// Guardar nuevos comprobantes subidos
const handleUploadNewReceipts = async () => {
  if (newReceiptFiles.value.length === 0) {
    showNotification('Selecciona al menos un archivo para subir', 'warning')
    return
  }

  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('attachable_type', attachableData.value.type)
    formData.append('attachable_id', attachableData.value.id)
    formData.append('identifier', attachableData.value.identifier)
    formData.append('party_name', props.movement.description || '')

    newReceiptFiles.value.forEach(f => {
      formData.append('receipts[]', f)
    })

    const res = await $api('attachments/upload', {
      method: 'POST',
      body: formData,
    })

    if (res && res.status === 'success') {
      showNotification(res.message || 'Comprobante(s) subido(s) exitosamente', 'success')
      newReceiptFiles.value = []
      showUploader.value = false
      await loadAttachments()
      emit('updated')
    }
  } catch (error) {
    console.error('Error al subir comprobantes:', error)
    showNotification('Error al guardar los comprobantes', 'error')
  } finally {
    isUploading.value = false
  }
}

// Descargar un comprobante
const downloadSingleAttachment = att => {
  if (!att) return
  const url = att.download_url || getFullUrl(att.file_path || att.url)
  const link = document.createElement('a')
  link.href = url
  link.download = att.file_name || 'comprobante'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Descargar PDF oficial de la nota / movimiento
const downloadMovementPdf = async () => {
  if (!props.movement?.id) return

  isDownloadingPdf.value = true
  try {
    const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin
    const base = apiBase.replace(/\/api\/?$/, '')
    const downloadUrl = `${base}/api/financial-movements/${props.movement.id}/pdf`

    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `comprobante_${movementType.value}_${docNumber.value}.pdf`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (e) {
    console.error('Error al descargar PDF del movimiento:', e)
    showNotification('Error al descargar el comprobante en PDF', 'error')
  } finally {
    isDownloadingPdf.value = false
  }
}

// Eliminar un adjunto existente
const deleteAttachment = async att => {
  if (!confirm(`¿Estás seguro de eliminar el comprobante "${att.file_name}"?`)) return

  try {
    const res = await $api(`attachments/${att.id}`, { method: 'DELETE' })
    if (res && res.status === 'success') {
      showNotification('Comprobante eliminado', 'success')
      await loadAttachments()
      emit('updated')
    }
  } catch (error) {
    console.error('Error al eliminar adjunto:', error)
    showNotification('Error al eliminar el comprobante', 'error')
  }
}

// Abrir foto en Lightbox
const openLightbox = idx => {
  activePhotoIndex.value = idx
  isLightboxOpen.value = true
}

const isImageFile = att => {
  return att.is_image || (att.mime_type && att.mime_type.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.file_name || att.file_path || '')
}

const closeDialog = () => {
  emit('update:modelValue', false)
  showUploader.value = false
  newReceiptFiles.value = []
}

watch(
  () => [props.modelValue, props.movement],
  ([visible, mov]) => {
    if (visible && mov) {
      newReceiptFiles.value = []
      showUploader.value = false
      loadAttachments()
    }
  },
  { immediate: true }
)
</script>

<template>
  <VDialog
    :model-value="props.modelValue"
    max-width="780"
    scrollable
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="rounded-xl overflow-hidden elevation-12 d-flex flex-column" style="max-height: 90vh;">
      <!-- Header Banner Primary -->
      <VCardTitle class="pa-4 bg-primary text-white d-flex align-center justify-space-between flex-none">
        <div class="d-flex align-center gap-3">
          <VAvatar
            color="white"
            variant="tonal"
            size="40"
            rounded="lg"
          >
            <VIcon
              :icon="typeIcon"
              color="white"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold text-white leading-tight">
              {{ typeTitle }}
            </div>
            <div class="text-caption text-white opacity-80" style="font-size: 11px;">
              {{ docNumber }} • {{ formattedDate }}
            </div>
          </div>
        </div>
        <div class="d-flex align-center gap-1">
          <VBtn
            color="white"
            variant="tonal"
            size="small"
            prepend-icon="ri-printer-line"
            class="font-weight-medium text-none me-1"
            :loading="isDownloadingPdf"
            @click="downloadMovementPdf"
          >
            Imprimir PDF
          </VBtn>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            color="white"
            @click="closeDialog"
          />
        </div>
      </VCardTitle>

      <!-- Contenido Principal con Scroll -->
      <VCardText class="pa-5 overflow-y-auto" style="flex: 1 1 auto; max-height: calc(90vh - 140px);">
        <!-- 1. Hero Box: Monto & Estado -->
        <VCard
          variant="outlined"
          class="pa-4 rounded-xl mb-5 border-light"
          style="background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.04) 0%, rgba(var(--v-theme-surface), 1) 100%);"
        >
          <div class="d-flex flex-wrap align-center justify-space-between gap-4">
            <div>
              <div class="text-caption text-medium-emphasis text-uppercase font-weight-bold tracking-wide mb-1">
                Monto Registrado
              </div>
              <div
                class="text-h4 font-weight-black tracking-tight"
                :class="movementType === 'income' ? 'text-success' : (movementType === 'expense' ? 'text-error' : 'text-info')"
              >
                {{ movementType === 'income' ? '+' : (movementType === 'expense' ? '-' : '') }}{{ formatCurrency(props.movement?.amount) }}
              </div>
            </div>

            <div class="d-flex flex-column align-end gap-1">
              <VChip
                :color="typeColor"
                variant="elevated"
                class="font-weight-bold text-uppercase px-3"
                size="small"
              >
                <VIcon
                  :icon="typeIcon"
                  size="14"
                  class="me-1"
                />
                {{ movementType === 'income' ? 'Ingreso' : (movementType === 'expense' ? 'Egreso' : 'Transferencia') }}
              </VChip>
              <span class="text-caption text-medium-emphasis">
                {{ formattedDate }}
              </span>
            </div>
          </div>
        </VCard>

        <!-- 2. Tarjeta de Datos y Desglose de la Transacción -->
        <VCard
          variant="flat"
          class="rounded-xl border pa-4 mb-5 bg-grey-lighten-5"
        >
          <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-3 d-flex align-center gap-1">
            <VIcon
              icon="ri-file-list-3-line"
              color="primary"
              size="18"
            />
            Detalles de la Transacción
          </div>

          <VRow dense>
            <!-- Concepto / Descripción -->
            <VCol cols="12" class="mb-2">
              <div class="text-caption text-medium-emphasis font-weight-medium">
                Concepto / Descripción
              </div>
              <div class="text-body-1 font-weight-semibold text-high-emphasis">
                {{ props.movement?.description || 'Sin descripción' }}
              </div>
            </VCol>

            <!-- Cuentas -->
            <VCol cols="12" sm="6" class="mb-2">
              <div class="text-caption text-medium-emphasis font-weight-medium">
                {{ movementType === 'transfer' ? 'Cuentas (Origen ➔ Destino)' : (movementType === 'income' ? 'Cuenta Destino' : 'Cuenta Origen') }}
              </div>
              <div class="text-body-2 font-weight-bold d-flex align-center gap-1 text-primary">
                <VIcon
                  icon="ri-bank-line"
                  size="16"
                />
                {{ accountInfo.single }}
              </div>
            </VCol>

            <!-- Método de Pago -->
            <VCol cols="12" sm="6" class="mb-2">
              <div class="text-caption text-medium-emphasis font-weight-medium">
                Método de Pago
              </div>
              <div class="text-body-2 font-weight-medium text-high-emphasis d-flex align-center gap-1">
                <VIcon
                  icon="ri-secure-payment-line"
                  size="16"
                  color="secondary"
                />
                {{ paymentMethod }}
              </div>
            </VCol>

            <!-- Código / Número de Documento -->
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis font-weight-medium">
                Número de Factura / OT / Código
              </div>
              <div class="text-body-2 font-weight-bold font-mono text-grey-darken-3">
                {{ docNumber }}
              </div>
            </VCol>

            <!-- ID del Registro en Sistema -->
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis font-weight-medium">
                ID de Registro
              </div>
              <div class="text-body-2 text-medium-emphasis font-mono">
                #{{ props.movement?.id || '-' }}
              </div>
            </VCol>
          </VRow>
        </VCard>

        <!-- 3. Sección de Comprobantes de Respaldo -->
        <div class="mb-2">
          <div class="d-flex align-center justify-space-between mb-3">
            <div class="d-flex align-center gap-2">
              <VIcon
                icon="ri-attachment-2"
                color="primary"
                size="20"
              />
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Comprobantes de Respaldo
              </span>
              <VChip
                size="x-small"
                color="primary"
                variant="tonal"
                class="font-weight-bold"
              >
                {{ attachments.length }} archivo(s)
              </VChip>
            </div>

            <VBtn
              size="small"
              variant="tonal"
              color="primary"
              :prepend-icon="showUploader ? 'ri-arrow-up-s-line' : 'ri-add-line'"
              @click="showUploader = !showUploader"
            >
              {{ showUploader ? 'Ocultar Subida' : 'Adjuntar Comprobante' }}
            </VBtn>
          </div>

          <!-- Uploader desplegable -->
          <VExpandTransition>
            <div v-if="showUploader" class="mb-4 pa-4 rounded-xl border bg-grey-lighten-5">
              <div class="text-subtitle-2 font-weight-bold mb-2">
                Subir Nuevo Comprobante / Foto
              </div>
              <ReceiptUploader
                v-model="newReceiptFiles"
                label="Seleccionar o Tomar Foto del Comprobante"
                hint="Formatos JPG, PNG, WEBP o PDF hasta 15MB"
                :max-files="5"
                @error="msg => showNotification(msg, 'error')"
              />
              <div class="d-flex justify-end gap-2 mt-3">
                <VBtn
                  variant="text"
                  size="small"
                  @click="showUploader = false"
                >
                  Cancelar
                </VBtn>
                <VBtn
                  color="primary"
                  size="small"
                  variant="elevated"
                  prepend-icon="ri-upload-cloud-line"
                  :loading="isUploading"
                  :disabled="newReceiptFiles.length === 0 || isUploading"
                  @click="handleUploadNewReceipts"
                >
                  Guardar en Servidor
                </VBtn>
              </div>
            </div>
          </VExpandTransition>

          <!-- Estado Cargando Adjuntos -->
          <div
            v-if="isLoadingAttachments"
            class="text-center py-6"
          >
            <VProgressCircular
              indeterminate
              color="primary"
              size="32"
            />
            <div class="text-caption text-medium-emphasis mt-2">
              Cargando comprobantes...
            </div>
          </div>

          <!-- Estado Sin Adjuntos -->
          <div
            v-else-if="attachments.length === 0"
            class="pa-6 text-center rounded-xl border border-dashed text-medium-emphasis bg-grey-lighten-5"
          >
            <VAvatar
              color="secondary"
              variant="tonal"
              size="48"
              class="mb-2"
            >
              <VIcon
                icon="ri-file-cloud-line"
                size="26"
              />
            </VAvatar>
            <div class="text-subtitle-2 font-weight-medium">
              No hay comprobantes adjuntos todavía
            </div>
            <div class="text-caption text-disabled mb-3">
              Puedes adjuntar una foto del recibo o factura con el botón superior.
            </div>
            <VBtn
              size="small"
              variant="outlined"
              color="primary"
              prepend-icon="ri-upload-2-line"
              @click="showUploader = true"
            >
              Adjuntar Foto Ahora
            </VBtn>
          </div>

          <!-- Galería de Comprobantes Adjuntos -->
          <div
            v-else
            class="d-flex flex-wrap gap-3"
          >
            <VCard
              v-for="(att, idx) in attachments"
              :key="att.id || idx"
              variant="outlined"
              class="rounded-xl overflow-hidden border position-relative attachment-card elevation-1"
              style="width: 100%; max-width: 220px;"
            >
              <!-- Miniatura para Imagen -->
              <div
                v-if="isImageFile(att)"
                class="position-relative cursor-pointer bg-grey-900"
                style="height: 140px; overflow: hidden;"
                @click="openLightbox(idx)"
              >
                <img
                  :src="getFullUrl(att.file_path || att.url)"
                  :alt="att.file_name"
                  class="w-100 h-100 object-cover"
                  style="object-fit: cover;"
                />
                <div class="image-hover-overlay d-flex align-center justify-center">
                  <VIcon
                    icon="ri-zoom-in-line"
                    color="white"
                    size="24"
                  />
                </div>
              </div>

              <!-- Miniatura para PDF -->
              <div
                v-else
                class="d-flex flex-column align-center justify-center bg-grey-100 pa-4 cursor-pointer"
                style="height: 140px;"
                @click="openLightbox(idx)"
              >
                <VIcon
                  icon="ri-file-pdf-2-fill"
                  size="44"
                  color="error"
                  class="mb-1"
                />
                <span class="text-caption font-weight-bold text-truncate w-100 text-center">
                  PDF
                </span>
              </div>

              <!-- Info & Acciones del Card -->
              <div class="pa-2.5 bg-surface">
                <div
                  class="text-caption font-weight-bold text-truncate"
                  :title="att.file_name"
                >
                  {{ att.file_name || 'Comprobante' }}
                </div>
                <div class="text-caption text-disabled mb-2" style="font-size: 10px;">
                  {{ att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : 'Archivo' }}
                </div>

                <div class="d-flex align-center justify-space-between">
                  <VBtn
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    prepend-icon="ri-eye-line"
                    class="font-weight-medium"
                    @click="openLightbox(idx)"
                  >
                    Ver
                  </VBtn>
                  <div class="d-flex gap-1">
                    <VBtn
                      size="x-small"
                      variant="text"
                      color="secondary"
                      icon="ri-download-2-line"
                      title="Descargar archivo"
                      @click.stop="downloadSingleAttachment(att)"
                    />
                    <VBtn
                      size="x-small"
                      variant="text"
                      color="error"
                      icon="ri-delete-bin-line"
                      title="Eliminar archivo"
                      @click.stop="deleteAttachment(att)"
                    />
                  </div>
                </div>
              </div>
            </VCard>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <!-- Footer Fijo de Acciones -->
      <VCardActions class="pa-4 d-flex justify-space-between align-center bg-grey-lighten-5 flex-none">
        <div class="d-flex gap-2">
          <VBtn
            variant="tonal"
            color="primary"
            prepend-icon="ri-file-pdf-2-line"
            size="small"
            class="font-weight-bold rounded-lg"
            :loading="isDownloadingPdf"
            @click="downloadMovementPdf"
          >
            Descargar Nota PDF
          </VBtn>
        </div>

        <VBtn
          variant="outlined"
          color="secondary"
          class="rounded-lg px-6 font-weight-medium"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>

    <!-- Lightbox / Modal de Foto en Pantalla Completa -->
    <VDialog
      v-model="isLightboxOpen"
      max-width="850"
      scrollable
    >
      <VCard class="rounded-xl overflow-hidden elevation-12">
        <VCardTitle class="d-flex align-center justify-space-between bg-grey-900 text-white pa-4">
          <div class="d-flex align-center gap-2">
            <VIcon
              icon="ri-image-line"
              color="white"
            />
            <div class="text-subtitle-1 font-weight-bold text-white text-truncate" style="max-width: 400px;">
              {{ attachments[activePhotoIndex]?.file_name || 'Comprobante' }}
            </div>
          </div>
          <div class="d-flex align-center gap-2">
            <VBtn
              color="success"
              variant="elevated"
              prepend-icon="ri-download-2-line"
              size="small"
              class="font-weight-bold rounded-lg"
              @click="downloadSingleAttachment(attachments[activePhotoIndex])"
            >
              Descargar
            </VBtn>
            <VBtn
              icon="ri-close-line"
              variant="text"
              color="white"
              size="small"
              @click="isLightboxOpen = false"
            />
          </div>
        </VCardTitle>

        <VCardText
          class="pa-0 bg-grey-950 d-flex align-center justify-center position-relative"
          style="min-height: 420px; max-height: 75vh; overflow: auto;"
        >
          <!-- Flecha Anterior -->
          <VBtn
            v-if="attachments.length > 1"
            icon="ri-arrow-left-s-line"
            variant="tonal"
            color="white"
            class="position-absolute"
            style="left: 16px; z-index: 10; background: rgba(0,0,0,0.5);"
            :disabled="activePhotoIndex === 0"
            @click="activePhotoIndex--"
          />

          <!-- Visualizador de Imagen -->
          <div
            v-if="attachments[activePhotoIndex] && isImageFile(attachments[activePhotoIndex])"
            class="d-flex align-center justify-center w-100 h-100 pa-4"
          >
            <img
              :src="getFullUrl(attachments[activePhotoIndex].file_path || attachments[activePhotoIndex].url)"
              :alt="attachments[activePhotoIndex].file_name"
              class="img-fluid rounded-lg shadow-lg"
              style="max-width: 100%; max-height: 68vh; object-fit: contain;"
            />
          </div>

          <!-- Visualizador para PDF -->
          <div
            v-else-if="attachments[activePhotoIndex]"
            class="d-flex flex-column align-center justify-center pa-8 text-center text-white"
          >
            <VAvatar
              color="error"
              size="72"
              variant="tonal"
              class="mb-4"
            >
              <VIcon
                icon="ri-file-pdf-2-line"
                size="40"
              />
            </VAvatar>
            <div class="text-h6 font-weight-bold mb-2">
              Documento PDF
            </div>
            <div class="text-body-2 text-grey-400 mb-4">
              {{ attachments[activePhotoIndex].file_name }}
            </div>
            <div class="d-flex gap-3">
              <VBtn
                color="primary"
                variant="elevated"
                prepend-icon="ri-external-link-line"
                target="_blank"
                :href="getFullUrl(attachments[activePhotoIndex].file_path || attachments[activePhotoIndex].url)"
              >
                Abrir PDF en pestaña
              </VBtn>
              <VBtn
                color="success"
                variant="tonal"
                prepend-icon="ri-download-2-line"
                @click="downloadSingleAttachment(attachments[activePhotoIndex])"
              >
                Descargar PDF
              </VBtn>
            </div>
          </div>

          <!-- Flecha Siguiente -->
          <VBtn
            v-if="attachments.length > 1"
            icon="ri-arrow-right-s-line"
            variant="tonal"
            color="white"
            class="position-absolute"
            style="right: 16px; z-index: 10; background: rgba(0,0,0,0.5);"
            :disabled="activePhotoIndex === attachments.length - 1"
            @click="activePhotoIndex++"
          />
        </VCardText>

        <VCardActions class="pa-3 bg-grey-900 d-flex justify-space-between align-center">
          <span class="text-caption text-grey-400">
            Archivo {{ activePhotoIndex + 1 }} de {{ attachments.length }}
          </span>
          <VBtn
            variant="outlined"
            color="white"
            size="small"
            @click="isLightboxOpen = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VDialog>
</template>

<style scoped>
.attachment-card {
  transition: all 0.2s ease-in-out;
}

.attachment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08) !important;
}

.image-hover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.attachment-card:hover .image-hover-overlay {
  opacity: 1;
}
</style>
