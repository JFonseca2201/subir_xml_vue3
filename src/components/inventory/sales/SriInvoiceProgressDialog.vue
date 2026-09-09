<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import SriStatusDialog from '@/components/inventory/sales/SriStatusDialog.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  salePayload: {
    type: Object,
    default: () => ({}),
  },
  saleId: {
    type: [Number, String],
    default: null,
  },
  endpoint: {
    type: String,
    default: null,
  },
  method: {
    type: String,
    default: null,
  },
  clientName: {
    type: String,
    default: 'Consumidor Final',
  },
  clientDocument: {
    type: String,
    default: '',
  },
  totalAmount: {
    type: [Number, String],
    default: 0,
  },
  sriEnvironment: {
    type: String,
    default: '1',
  },
})

const emit = defineEmits(['update:isDialogVisible', 'completed', 'error'])

const router = useRouter()
const { showNotification } = useGlobalToast()

// Estados del proceso
const progressPercent = ref(0)
const currentStepIndex = ref(0)
const processStatus = ref('processing') // 'processing' | 'sri_offline' | 'success' | 'error'
const statusMessage = ref('Comprobando estado de los servidores del SRI...')
const errorMessage = ref('')
const responseData = ref(null)
const timerInterval = ref(null)
const autoRedirectTimer = ref(null)
const countdownSeconds = ref(3)

// Diagnóstico previo del SRI
const sriDiagnostic = ref(null)
const isDetailsDialogVisible = ref(false)

const isProd = computed(() => String(props.sriEnvironment) === '2' || props.sriEnvironment === 'PRODUCCIÓN')

const steps = [
  {
    id: 1,
    title: 'Conectividad Web Services SRI',
    desc: 'Comprobación de disponibilidad de los servidores fiscales del SRI',
    icon: 'ri-wifi-line',
  },
  {
    id: 2,
    title: 'Estructuración y Validación',
    desc: 'Validación de cliente, ítems, desglose de impuestos e inventario',
    icon: 'ri-file-code-line',
  },
  {
    id: 3,
    title: 'Firma Electrónica XML',
    desc: 'Cifrado y firmado digital del XML con certificado criptográfico PKCS#12',
    icon: 'ri-shield-keyhole-line',
  },
  {
    id: 4,
    title: 'Transmisión y Autorización SRI',
    desc: 'Envío SOAP y consulta de estado tributario oficial',
    icon: 'ri-shield-check-line',
  },
]

const formatCurrency = val => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(val) || 0)
}

const startProgressAnimation = () => {
  progressPercent.value = 25
  currentStepIndex.value = 1
  processStatus.value = 'processing'
  statusMessage.value = 'Estructurando comprobante y validando cálculos tributarios...'
  errorMessage.value = ''
  responseData.value = null
  countdownSeconds.value = 3

  if (timerInterval.value) clearInterval(timerInterval.value)

  // Intervalo de progreso fluido por fases
  timerInterval.value = setInterval(() => {
    if (processStatus.value !== 'processing') {
      clearInterval(timerInterval.value)
      return
    }

    if (progressPercent.value < 48) {
      progressPercent.value += 2
      currentStepIndex.value = 1
      statusMessage.value = 'Estructurando comprobante y validando cálculos tributarios...'
    } else if (progressPercent.value < 75) {
      progressPercent.value += 1.8
      currentStepIndex.value = 2
      statusMessage.value = 'Firmando digitalmente el XML con certificado electrónico...'
    } else if (progressPercent.value < 94) {
      progressPercent.value += 0.8
      currentStepIndex.value = 3
      statusMessage.value = 'Transmitiendo comprobante y consultando autorización SRI...'
    }
  }, 180)
}

// Ejecutar la llamada real a la API con comprobación previa del SRI
const executeSriEmission = async () => {
  if (timerInterval.value) clearInterval(timerInterval.value)
  if (autoRedirectTimer.value) clearInterval(autoRedirectTimer.value)

  progressPercent.value = 12
  currentStepIndex.value = 0
  processStatus.value = 'processing'
  statusMessage.value = 'Comprobando conectividad con los servidores del SRI...'
  errorMessage.value = ''
  sriDiagnostic.value = null
  responseData.value = null
  countdownSeconds.value = 3

  // ── FASE 1: Comprobación previa del estado del SRI ──
  try {
    const amb = props.sriEnvironment ? (String(props.sriEnvironment) === '2' ? 2 : 1) : 1
    const checkResponse = await $api('sri/check-status', {
      params: { ambiente: amb },
    })

    const health = checkResponse?.data
    if (health) {
      sriDiagnostic.value = health
      const recepcionOnline = health.services?.recepcion?.online !== false
      const isDown = !health.online || !recepcionOnline || health.status === 'FUERA_DE_SERVICIO' || health.status === 'CAIDO'

      if (isDown) {
        if (timerInterval.value) clearInterval(timerInterval.value)
        processStatus.value = 'sri_offline'
        progressPercent.value = 100
        statusMessage.value = 'No es posible generar la factura por problemas en el SRI'
        errorMessage.value = health.message || 'Los servidores del SRI no están disponibles o se encuentran fuera de servicio en este momento. La emisión fue detenida para proteger tu comprobante.'
        emit('error', errorMessage.value)
        return
      }
    }
  } catch (checkErr) {
    console.warn('Error en sondeo previo del SRI:', checkErr)
  }

  // ── FASE 2: Servidores listos, estructuración y emisión ──
  currentStepIndex.value = 1
  progressPercent.value = 25
  statusMessage.value = 'Servidores SRI operativos. Estructurando comprobante...'

  startProgressAnimation()

  try {
    const targetUrl = props.endpoint || (props.saleId ? `sales/${props.saleId}` : 'sales')
    const targetMethod = props.method || (props.saleId ? 'PUT' : 'POST')

    const response = await $api(targetUrl, {
      method: targetMethod,
      body: props.salePayload,
    })

    if (timerInterval.value) clearInterval(timerInterval.value)

    if (response?.success || response?.status === 201 || response?.status === 200) {
      responseData.value = response.data || response.sale || response
      progressPercent.value = 100
      currentStepIndex.value = 4
      processStatus.value = 'success'
      statusMessage.value = '¡Factura electrónica emitida y procesada correctamente!'

      emit('completed', responseData.value)

      // Iniciar cuenta regresiva para redirección automática suave
      startAutoRedirect()
    } else {
      processStatus.value = 'error'
      errorMessage.value = response?.message || 'El SRI no pudo autorizar el comprobante en este momento.'
      emit('error', errorMessage.value)
    }
  } catch (err) {
    if (timerInterval.value) clearInterval(timerInterval.value)

    processStatus.value = 'error'
    const backendMsg =
      err.data?.error ||
      err.data?.message ||
      err.response?._data?.error ||
      err.response?._data?.message ||
      err.message ||
      'Error de conexión con el servicio de facturación SRI'

    errorMessage.value = backendMsg
    emit('error', backendMsg)
  }
}

const startAutoRedirect = () => {
  countdownSeconds.value = 3
  if (autoRedirectTimer.value) clearInterval(autoRedirectTimer.value)

  autoRedirectTimer.value = setInterval(() => {
    countdownSeconds.value -= 1
    if (countdownSeconds.value <= 0) {
      clearInterval(autoRedirectTimer.value)
      goToList()
    }
  }, 1000)
}

const cancelAutoRedirect = () => {
  if (autoRedirectTimer.value) clearInterval(autoRedirectTimer.value)
}

const goToList = () => {
  cancelAutoRedirect()
  emit('update:isDialogVisible', false)
  router.push('/sales/list')
}

const downloadRide = async () => {
  const saleId = responseData.value?.id || responseData.value?.sale?.id
  if (!saleId) return
  try {
    const response = await $api(`sales/${saleId}/ride`, {
      method: 'GET',
      responseType: 'blob',
    })
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RIDE_${responseData.value?.document_number || saleId}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    showNotification('RIDE PDF descargado exitosamente', 'success')
  } catch (err) {
    showNotification('Error al descargar el RIDE PDF', 'error')
  }
}

const closeDialog = () => {
  cancelAutoRedirect()
  if (timerInterval.value) clearInterval(timerInterval.value)
  emit('update:isDialogVisible', false)
}

const retryEmission = () => {
  executeSriEmission()
}

watch(
  () => props.isDialogVisible,
  newVal => {
    if (newVal) {
      executeSriEmission()
    } else {
      cancelAutoRedirect()
      if (timerInterval.value) clearInterval(timerInterval.value)
    }
  },
)

onBeforeUnmount(() => {
  cancelAutoRedirect()
  if (timerInterval.value) clearInterval(timerInterval.value)
})
</script>

<template>
  <VDialog :model-value="props.isDialogVisible" max-width="620" persistent transition="dialog-bottom-transition">
    <VCard class="sri-progress-dialog-card elevation-24">
      <!-- Header con Identidad SRI -->
      <div class="sri-progress-header">
        <div class="d-flex align-center justify-space-between gap-3">
          <div class="d-flex align-center gap-3">
            <div class="d-flex align-center justify-center rounded-xl"
              style="width: 48px; height: 48px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.35);">
              <VIcon icon="ri-shield-flash-line" size="26" color="white" />
            </div>
            <div>
              <div class="d-flex align-center gap-2">
                <span class="text-caption font-weight-bold text-white opacity-85 text-uppercase letter-spacing-1">
                  Facturación Electrónica SRI
                </span>
                <VChip size="x-small" :color="isProd ? 'success' : 'amber-darken-2'" variant="flat"
                  class="font-weight-bold text-white">
                  {{ isProd ? 'PRODUCCIÓN' : 'PRUEBAS' }}
                </VChip>
              </div>
              <h3 class="text-h6 font-weight-bold text-white mb-0">
                Emisión de Comprobante Fiscal
              </h3>
            </div>
          </div>

          <!-- Total Pill Flotante -->
          <div class="d-none d-sm-flex flex-column align-end px-3 py-1.5 rounded-lg"
            style="background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.28);">
            <span style="font-size: 0.68rem; color: rgba(255, 255, 255, 0.85); font-weight: 600;">TOTAL</span>
            <span class="text-subtitle-1 font-weight-black text-white font-mono leading-none">
              {{ formatCurrency(props.totalAmount) }}
            </span>
          </div>
        </div>

        <!-- Info Cliente Ribbon -->
        <div class="d-flex align-center justify-space-between gap-2 mt-3 pt-2.5 text-caption font-weight-medium"
          style="border-top: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.9);">
          <div class="d-flex align-center gap-1.5 text-truncate">
            <VIcon icon="ri-user-3-line" size="14" />
            <span class="text-truncate"><strong>Cliente:</strong> {{ props.clientName }}</span>
          </div>
          <div v-if="props.clientDocument" class="d-none d-sm-block font-mono">
            <strong>ID:</strong> {{ props.clientDocument }}
          </div>
        </div>
      </div>

      <!-- Cuerpo del Proceso -->
      <VCardText class="pa-6 bg-surface">
        <!-- ESTADO: PROCESANDO -->
        <template v-if="processStatus === 'processing'">
          <!-- Barra de Progreso Dinámica -->
          <div class="sri-progress-bar-container mb-5">
            <div class="d-flex align-center justify-space-between mb-1">
              <span class="text-caption font-weight-bold d-flex align-center gap-1.5 text-high-emphasis">
                <VProgressCircular indeterminate size="14" width="2" color="primary" />
                {{ statusMessage }}
              </span>
              <span class="text-subtitle-2 font-weight-black text-primary font-mono">
                {{ Math.round(progressPercent) }}%
              </span>
            </div>

            <div class="progress-track-wrapper">
              <div class="progress-track-fill" :style="{ width: `${progressPercent}%` }" />
            </div>

            <div class="d-flex align-center justify-space-between text-caption text-medium-emphasis mt-1">
              <span>Fase {{ currentStepIndex + 1 }} de 4: {{ steps[currentStepIndex]?.title }}</span>
              <span>Conexión Cifrada SSL / TLS 1.3</span>
            </div>
          </div>

          <!-- Stepper de 4 Fases con Micro-animaciones -->
          <div class="sri-step-list mb-2">
            <div v-for="(step, idx) in steps" :key="step.id" class="sri-step-item" :class="{
              'sri-step-completed': idx < currentStepIndex,
              'sri-step-active': idx === currentStepIndex,
              'sri-step-pending': idx > currentStepIndex,
            }">
              <div class="sri-step-icon-badge">
                <VIcon v-if="idx < currentStepIndex" icon="ri-check-line" size="18" />
                <VProgressCircular v-else-if="idx === currentStepIndex" indeterminate size="18" width="2.5"
                  color="white" />
                <VIcon v-else :icon="step.icon" size="18" />
              </div>

              <div class="sri-step-content">
                <div class="sri-step-title font-weight-bold">
                  {{ step.title }}
                </div>
                <div class="sri-step-desc">
                  {{ step.desc }}
                </div>
              </div>

              <div class="sri-step-status">
                <VChip v-if="idx < currentStepIndex" size="x-small" color="success" variant="tonal"
                  class="font-weight-bold">
                  Completado
                </VChip>
                <VChip v-else-if="idx === currentStepIndex" size="x-small" color="primary" variant="flat"
                  class="font-weight-bold">
                  En curso...
                </VChip>
                <span v-else class="text-caption text-disabled">Pendiente</span>
              </div>
            </div>
          </div>
        </template>

        <!-- ESTADO: SRI FUERA DE SERVICIO (BLOQUEO PREVIO POR FALLA DEL SRI) -->
        <template v-else-if="processStatus === 'sri_offline'">
          <div class="sri-offline-state">
            <!-- Barra de Progreso Detenida en Error -->
            <div class="sri-progress-bar-container mb-4">
              <div class="d-flex align-center justify-space-between mb-1">
                <span class="text-caption font-weight-bold text-error d-flex align-center gap-1.5">
                  <VIcon icon="ri-wifi-off-line" color="error" size="18" />
                  No es posible generar la factura por problemas en el SRI
                </span>
                <span class="text-subtitle-2 font-weight-black text-error font-mono">
                  SRI INACTIVO
                </span>
              </div>

              <div class="progress-track-wrapper">
                <div class="progress-track-fill is-sri-error" style="width: 100%;" />
              </div>

              <div class="d-flex align-center justify-space-between text-caption text-error font-weight-medium mt-1">
                <span>Fase 1: Verificación de Servidores SRI</span>
                <span>Emisión pausada por seguridad</span>
              </div>
            </div>

            <!-- Card de Diagnóstico y Explicación -->
            <div class="sri-offline-card pa-4 rounded-xl border mb-4">
              <div class="d-flex align-start gap-3 mb-3">
                <div class="sri-offline-icon-circle flex-shrink-0">
                  <VIcon icon="ri-cloud-off-line" size="26" color="error" />
                </div>
                <div>
                  <h4 class="text-subtitle-1 font-weight-bold text-error mb-1">
                    Servidores de Web Services del SRI no funcionales
                  </h4>
                  <p class="text-body-2 text-high-emphasis opacity-90 mb-0">
                    El sistema comprobó la disponibilidad del SRI antes de crear la factura y detectó que los servidores se encuentran caídos o no responden. Para proteger tu facturación y evitar comprobantes rechazados, la emisión ha sido detenida.
                  </p>
                </div>
              </div>

              <!-- Endpoints State -->
              <div class="d-flex flex-column gap-2 mb-3">
                <div class="d-flex align-center justify-space-between pa-2.5 rounded-lg border bg-surface text-caption">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-upload-cloud-2-line" size="16" color="primary" />
                    <span class="font-weight-medium">Recepción (RecepcionComprobantesOffline):</span>
                  </div>
                  <VChip size="x-small" :color="sriDiagnostic?.services?.recepcion?.online ? 'success' : 'error'" variant="flat" class="font-weight-bold">
                    {{ sriDiagnostic?.services?.recepcion?.status_label || (sriDiagnostic?.services?.recepcion?.online ? 'Operativo' : 'Sin Conexión') }}
                  </VChip>
                </div>

                <div class="d-flex align-center justify-space-between pa-2.5 rounded-lg border bg-surface text-caption">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-shield-check-line" size="16" color="success" />
                    <span class="font-weight-medium">Autorización (AutorizacionComprobantesOffline):</span>
                  </div>
                  <VChip size="x-small" :color="sriDiagnostic?.services?.autorizacion?.online ? 'success' : 'error'" variant="flat" class="font-weight-bold">
                    {{ sriDiagnostic?.services?.autorizacion?.status_label || (sriDiagnostic?.services?.autorizacion?.online ? 'Operativo' : 'Sin Conexión') }}
                  </VChip>
                </div>
              </div>

              <!-- Tip informativo -->
              <div class="info-safety-box pa-3 rounded-lg border d-flex align-start gap-2.5">
                <VIcon icon="ri-shield-check-line" size="18" color="success" class="flex-shrink-0 mt-0.5" />
                <div class="text-caption text-high-emphasis opacity-90">
                  <strong>Tus datos están intactos:</strong> Los ítems, productos y montos ingresados permanecen guardados en el formulario de venta. Puedes esperar a que el SRI se restablezca y pulsar <strong>Reintentar Emisión</strong>, o <strong>Cerrar</strong> para emitir como Nota de Venta si es urgente.
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ESTADO: ÉXITO (AUTORIZADA) -->
        <template v-else-if="processStatus === 'success'">
          <div class="sri-success-celebration text-center py-4">
            <div class="d-inline-flex align-center justify-center rounded-circle mb-3 elevation-4"
              style="width: 76px; height: 76px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;">
              <VIcon icon="ri-checkbox-circle-fill" size="48" />
            </div>

            <h3 class="text-h5 font-weight-bold text-high-emphasis mb-1">
              ¡Factura Generada y Autorizada!
            </h3>
            <p class="text-body-2 text-medium-emphasis mb-4">
              El comprobante tributario ha sido validado exitosamente ante el SRI.
            </p>

            <!-- Card de Resumen de la Factura -->
            <div class="pa-4 rounded-xl border mb-4 text-start bg-surface elevation-1">
              <div v-if="responseData?.document_number || responseData?.sequential"
                class="d-flex justify-space-between align-center pb-2 border-b mb-2">
                <span class="text-caption text-medium-emphasis font-weight-medium">SECUENCIAL FACTURA</span>
                <span class="text-body-2 font-weight-bold text-primary font-mono">
                  #{{ responseData?.document_number || responseData?.sequential }}
                </span>
              </div>

              <div v-if="responseData?.sri_access_key" class="d-flex flex-column pb-2 border-b mb-2">
                <span class="text-caption text-medium-emphasis font-weight-medium mb-1">CLAVE DE ACCESO SRI (49 DÍGITOS)</span>
                <span
                  class="text-caption font-mono font-weight-bold pa-1.5 rounded bg-background border text-break"
                  style="font-size: 0.72rem !important; word-break: break-all;">
                  {{ responseData?.sri_access_key }}
                </span>
              </div>

              <div class="d-flex justify-space-between align-center">
                <span class="text-caption text-medium-emphasis font-weight-medium">ESTADO FISCAL</span>
                <VChip color="success" size="small" variant="flat" class="font-weight-bold px-3">
                  <VIcon icon="ri-shield-check-line" size="14" class="me-1" />
                  AUTORIZADA
                </VChip>
              </div>
            </div>

            <!-- Contador de Redirección Automática -->
            <div class="text-caption text-medium-emphasis d-flex align-center justify-center gap-1 mb-1">
              <VIcon icon="ri-time-line" size="14" />
              <span>Redirigiendo al listado de ventas en <strong>{{ countdownSeconds }}s</strong>...</span>
              <VBtn variant="text" density="compact" size="x-small" color="primary" class="ms-1"
                @click="cancelAutoRedirect">
                Pausar
              </VBtn>
            </div>
          </div>
        </template>

        <!-- ESTADO: ERROR GENERAL -->
        <template v-else-if="processStatus === 'error'">
          <div class="text-center py-4">
            <div class="d-inline-flex align-center justify-center rounded-circle mb-3"
              style="width: 72px; height: 72px; background: rgba(239, 68, 68, 0.12); color: #ef4444;">
              <VIcon icon="ri-error-warning-fill" size="42" />
            </div>

            <h3 class="text-h6 font-weight-bold text-error mb-1">
              No se pudo completar la emisión
            </h3>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Ocurrió un inconveniente durante el procesamiento ante el SRI.
            </p>

            <VAlert type="error" variant="tonal"
              class="text-start text-caption pa-4 rounded-xl mb-4 font-weight-medium">
              <div class="font-weight-bold mb-1">
                Detalle del Error:
              </div>
              <div>{{ errorMessage }}</div>
            </VAlert>
          </div>
        </template>
      </VCardText>

      <VDivider />

      <!-- Acciones Inferiores -->
      <VCardActions class="pa-4 px-6 d-flex justify-end align-center gap-3 bg-surface">
        <template v-if="processStatus === 'processing'">
          <span class="text-caption text-medium-emphasis me-auto d-flex align-center gap-1.5">
            <VIcon icon="ri-information-line" size="15" color="primary" />
            Por favor, no cierres esta ventana mientras el SRI autoriza.
          </span>
        </template>

        <template v-else-if="processStatus === 'sri_offline'">
          <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
            class="rounded-lg px-5 font-weight-medium" height="40" @click="closeDialog">
            Cerrar / Modificar
          </VBtn>
          <VBtn color="info" variant="tonal" prepend-icon="ri-wifi-line"
            class="rounded-lg px-5 font-weight-medium" height="40" @click="isDetailsDialogVisible = true">
            Diagnóstico SRI
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-refresh-line"
            class="rounded-lg px-6 font-weight-bold" height="40" @click="retryEmission">
            Reintentar Emisión
          </VBtn>
        </template>

        <template v-else-if="processStatus === 'success'">
          <VBtn color="secondary" variant="outlined" prepend-icon="ri-file-pdf-line"
            class="rounded-lg px-4 font-weight-medium" height="40" @click="downloadRide">
            Descargar RIDE PDF
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-arrow-right-line"
            class="rounded-lg px-6 font-weight-bold elevation-2" height="40" @click="goToList">
            Ir a Ventas
          </VBtn>
        </template>

        <template v-else-if="processStatus === 'error'">
          <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
            class="rounded-lg px-5 font-weight-medium" height="40" @click="closeDialog">
            Cerrar y Revisar
          </VBtn>
          <VBtn color="info" variant="tonal" prepend-icon="ri-wifi-line"
            class="rounded-lg px-5 font-weight-medium" height="40" @click="isDetailsDialogVisible = true">
            Diagnóstico SRI
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-refresh-line"
            class="rounded-lg px-6 font-weight-bold" height="40" @click="retryEmission">
            Reintentar Emisión
          </VBtn>
        </template>
      </VCardActions>
    </VCard>

    <!-- Diálogo Modal de Diagnóstico SRI Detallado -->
    <SriStatusDialog
      v-model:is-dialog-visible="isDetailsDialogVisible"
      :initial-ambiente="props.sriEnvironment"
    />
  </VDialog>
</template>

<style scoped lang="scss">
.progress-track-fill.is-sri-error {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%) !important;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.45) !important;
}

.sri-offline-card {
  background: rgba(var(--v-theme-error), 0.05);
  border-color: rgba(var(--v-theme-error), 0.3) !important;
}

.sri-offline-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-safety-box {
  background: rgba(var(--v-theme-surface), 0.7);
  border-color: rgba(var(--v-border-color), 0.15) !important;
}
</style>
