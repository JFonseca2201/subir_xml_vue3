<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  initialAmbiente: {
    type: [Number, String],
    default: null,
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const { showNotification } = useGlobalToast()

const loading = ref(false)
const selectedAmbiente = ref(2) // 2 = Producción por defecto, 1 = Pruebas
const checkResult = ref(null)
const lastCheckedAt = ref(null)

const isOnline = computed(() => checkResult.value?.online === true)
const globalStatus = computed(() => checkResult.value?.status || 'UNKNOWN')

const ambienteOptions = [
  { value: 2, label: 'Producción', icon: 'ri-shield-check-line', host: 'cel.sri.gob.ec' },
  { value: 1, label: 'Pruebas', icon: 'ri-test-tube-line', host: 'celcer.sri.gob.ec' },
]

const getStatusColor = status => {
  switch (status) {
    case 'OPERATIVO':
      return 'success'
    case 'LENTO':
      return 'warning'
    case 'PARCIAL':
      return 'amber-darken-3'
    case 'FUERA_DE_SERVICIO':
    case 'CAIDO':
    case 'ERROR_SERVIDOR':
      return 'error'
    default:
      return 'grey'
  }
}

const getStatusIcon = status => {
  switch (status) {
    case 'OPERATIVO':
      return 'ri-checkbox-circle-fill'
    case 'LENTO':
      return 'ri-time-fill'
    case 'PARCIAL':
      return 'ri-alert-fill'
    case 'FUERA_DE_SERVICIO':
    case 'CAIDO':
    case 'ERROR_SERVIDOR':
      return 'ri-close-circle-fill'
    default:
      return 'ri-question-fill'
  }
}

const getLatencyColor = ms => {
  if (ms <= 600) return 'text-success'
  if (ms <= 1800) return 'text-primary'
  if (ms <= 3500) return 'text-warning'
  return 'text-error'
}

const checkSriConnection = async (amb = null) => {
  loading.value = true
  try {
    const targetAmb = amb !== null ? amb : selectedAmbiente.value
    const response = await $api('sri/check-status', {
      params: { ambiente: targetAmb },
    })

    if (response?.success && response?.data) {
      checkResult.value = response.data
      selectedAmbiente.value = response.data.ambiente || targetAmb
      lastCheckedAt.value = new Date().toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } else {
      showNotification('No se pudo verificar la conexión con el SRI', 'error')
    }
  } catch (error) {
    console.error('Error al verificar SRI:', error)
    showNotification('Error al consultar el servicio de verificación del SRI', 'error')
  } finally {
    loading.value = false
  }
}

const onSelectAmbiente = amb => {
  if (loading.value) return
  selectedAmbiente.value = amb
  checkSriConnection(amb)
}

watch(
  () => props.isDialogVisible,
  newVal => {
    if (newVal) {
      if (props.initialAmbiente) {
        selectedAmbiente.value = Number(props.initialAmbiente)
      }
      checkSriConnection()
    }
  },
  { immediate: true },
)
</script>

<template>
  <VDialog
    scrollable
    :model-value="props.isDialogVisible"
    max-width="580"
    transition="dialog-bottom-transition"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card elevation-16 overflow-hidden">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="emit('update:isDialogVisible', false)"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-wifi-line" size="28" />
        </div>
        <h3 class="custom-dialog-title">
          Estado de Servidores SRI
        </h3>
        <p class="custom-dialog-subtitle">
          Diagnóstico de disponibilidad y latencia de Web Services Ecuador
        </p>
      </div>

      <VCardText class="pa-4 pa-sm-5 bg-surface">
        <!-- Selector de Ambiente (Tabs / Pills) -->
        <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-2">
          <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis letter-spacing-1">
            Ambiente Evaluado
          </span>

          <div class="ambiente-toggle-container">
            <button
              v-for="opt in ambienteOptions"
              :key="opt.value"
              type="button"
              class="ambiente-btn"
              :class="{ 'active': selectedAmbiente === opt.value }"
              :disabled="loading"
              @click="onSelectAmbiente(opt.value)"
            >
              <VIcon :icon="opt.icon" size="15" class="me-1" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <!-- SKELETON LOADER -->
        <div v-if="loading && !checkResult" class="py-6 text-center">
          <VProgressCircular indeterminate color="primary" size="48" width="4" class="mb-3" />
          <div class="text-body-1 font-weight-bold text-high-emphasis">
            Consultando servidores del SRI...
          </div>
          <div class="text-caption text-medium-emphasis">
            Conectando a {{ selectedAmbiente === 2 ? 'cel.sri.gob.ec (Producción)' : 'celcer.sri.gob.ec (Pruebas)' }}
          </div>
        </div>

        <div v-else-if="checkResult" class="d-flex flex-column gap-4">
          <!-- BANNER DE ESTADO GENERAL -->
          <div
            class="general-status-banner rounded-xl pa-4"
            :class="`status-theme-${getStatusColor(globalStatus)}`"
          >
            <div class="d-flex align-start gap-3">
              <div class="status-icon-circle flex-shrink-0 mt-0.5">
                <VIcon :icon="getStatusIcon(globalStatus)" size="26" />
              </div>
              <div class="min-w-0 flex-grow-1">
                <div class="d-flex align-center justify-space-between flex-wrap gap-1 mb-1">
                  <span class="text-subtitle-1 font-weight-bold text-uppercase letter-spacing-05">
                    {{
                      globalStatus === 'OPERATIVO'
                        ? 'Servicios SRI Operativos'
                        : globalStatus === 'LENTO'
                        ? 'Servicios con Alta Latencia'
                        : globalStatus === 'PARCIAL'
                        ? 'Disponibilidad Parcial'
                        : 'Servidores del SRI Fuera de Servicio'
                    }}
                  </span>
                  <span v-if="lastCheckedAt" class="text-xxs opacity-80 font-mono">
                    Último chequeo: {{ lastCheckedAt }}
                  </span>
                </div>
                <p class="text-body-2 mb-0 opacity-95">
                  {{ checkResult.message }}
                </p>
              </div>
            </div>
          </div>

          <!-- DESGLOSE DE SERVICIOS -->
          <div class="services-grid d-flex flex-column gap-3">
            <!-- SERVICIO DE RECEPCIÓN -->
            <div
              v-if="checkResult.services?.recepcion"
              class="service-card rounded-xl border pa-3.5 bg-background"
            >
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center gap-2 min-w-0">
                  <VAvatar size="32" color="primary" variant="tonal" rounded="lg">
                    <VIcon icon="ri-upload-cloud-2-line" size="18" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-2 font-weight-bold text-high-emphasis text-truncate">
                      Recepción de Comprobantes
                    </div>
                    <div class="text-xxs text-medium-emphasis">
                      RecepcionComprobantesOffline
                    </div>
                  </div>
                </div>

                <div class="d-flex align-center gap-2 flex-shrink-0">
                  <VChip
                    size="x-small"
                    :color="getStatusColor(checkResult.services.recepcion.status)"
                    variant="flat"
                    class="font-weight-bold text-uppercase"
                  >
                    {{ checkResult.services.recepcion.status_label || checkResult.services.recepcion.status }}
                  </VChip>
                </div>
              </div>

              <!-- Métricas del Endpoint -->
              <div class="d-flex align-center justify-space-between text-caption pt-2 border-t mt-2">
                <div class="d-flex align-center gap-1.5 font-mono text-xs">
                  <span class="text-medium-emphasis">HTTP:</span>
                  <span
                    class="font-weight-bold"
                    :class="checkResult.services.recepcion.http_code === 200 ? 'text-success' : 'text-error'"
                  >
                    {{ checkResult.services.recepcion.http_code || 'Error' }}
                  </span>
                </div>

                <div class="d-flex align-center gap-1.5 font-mono text-xs">
                  <VIcon icon="ri-speed-line" size="14" class="text-medium-emphasis" />
                  <span class="text-medium-emphasis">Latencia:</span>
                  <span
                    class="font-weight-bold"
                    :class="getLatencyColor(checkResult.services.recepcion.latency_ms)"
                  >
                    {{ checkResult.services.recepcion.latency_ms }} ms
                  </span>
                </div>
              </div>

              <!-- Detalle de error si hubiese -->
              <div
                v-if="checkResult.services.recepcion.error"
                class="mt-2 pa-2 rounded bg-error-lighten-5 border border-error border-opacity-25 text-caption text-error font-mono"
              >
                {{ checkResult.services.recepcion.error }}
              </div>
            </div>

            <!-- SERVICIO DE AUTORIZACIÓN -->
            <div
              v-if="checkResult.services?.autorizacion"
              class="service-card rounded-xl border pa-3.5 bg-background"
            >
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center gap-2 min-w-0">
                  <VAvatar size="32" color="success" variant="tonal" rounded="lg">
                    <VIcon icon="ri-shield-check-line" size="18" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-2 font-weight-bold text-high-emphasis text-truncate">
                      Autorización de Comprobantes
                    </div>
                    <div class="text-xxs text-medium-emphasis">
                      AutorizacionComprobantesOffline
                    </div>
                  </div>
                </div>

                <div class="d-flex align-center gap-2 flex-shrink-0">
                  <VChip
                    size="x-small"
                    :color="getStatusColor(checkResult.services.autorizacion.status)"
                    variant="flat"
                    class="font-weight-bold text-uppercase"
                  >
                    {{ checkResult.services.autorizacion.status_label || checkResult.services.autorizacion.status }}
                  </VChip>
                </div>
              </div>

              <!-- Métricas del Endpoint -->
              <div class="d-flex align-center justify-space-between text-caption pt-2 border-t mt-2">
                <div class="d-flex align-center gap-1.5 font-mono text-xs">
                  <span class="text-medium-emphasis">HTTP:</span>
                  <span
                    class="font-weight-bold"
                    :class="checkResult.services.autorizacion.http_code === 200 ? 'text-success' : 'text-error'"
                  >
                    {{ checkResult.services.autorizacion.http_code || 'Error' }}
                  </span>
                </div>

                <div class="d-flex align-center gap-1.5 font-mono text-xs">
                  <VIcon icon="ri-speed-line" size="14" class="text-medium-emphasis" />
                  <span class="text-medium-emphasis">Latencia:</span>
                  <span
                    class="font-weight-bold"
                    :class="getLatencyColor(checkResult.services.autorizacion.latency_ms)"
                  >
                    {{ checkResult.services.autorizacion.latency_ms }} ms
                  </span>
                </div>
              </div>

              <!-- Detalle de error si hubiese -->
              <div
                v-if="checkResult.services.autorizacion.error"
                class="mt-2 pa-2 rounded bg-error-lighten-5 border border-error border-opacity-25 text-caption text-error font-mono"
              >
                {{ checkResult.services.autorizacion.error }}
              </div>
            </div>
          </div>

          <!-- NOTA INFORMATIVA SOBRE FACTURAS RECHAZADAS -->
          <div class="info-help-box pa-3.5 rounded-xl border d-flex align-start gap-3">
            <div class="info-help-icon-wrap flex-shrink-0 mt-0.5">
              <VIcon icon="ri-lightbulb-line" size="22" color="primary" />
            </div>
            <div class="min-w-0 flex-grow-1">
              <div class="info-help-title mb-1">
                ¿Por qué una factura aparece como Rechazada?
              </div>
              <div class="info-help-body">
                Cuando los servidores del SRI sufren caídas, cortes o tiempos de espera agotados, la emisión no puede completarse y el sistema guarda el estado con el error de conexión. Una vez que el SRI vuelva a estar <strong>OPERATIVO</strong>, puedes presionar el botón <strong>Reenviar al SRI</strong> en la fila de la factura para autorizarla sin necesidad de recrearla.
              </div>
            </div>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <!-- Footer Actions -->
      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-surface">
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-5 font-weight-medium"
          height="40"
          @click="emit('update:isDialogVisible', false)"
        >
          Cerrar
        </VBtn>

        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-refresh-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loading"
          @click="checkSriConnection()"
        >
          Verificar Ahora
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped lang="scss">
.letter-spacing-1 {
  letter-spacing: 0.08em;
}

.letter-spacing-05 {
  letter-spacing: 0.04em;
}

.text-xxs {
  font-size: 0.70rem !important;
}

.text-xs {
  font-size: 0.78rem !important;
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

// Botones de selección de ambiente
.ambiente-toggle-container {
  display: inline-flex;
  background-color: rgba(var(--v-theme-on-surface), 0.06);
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.ambiente-btn {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    color: rgba(var(--v-theme-on-surface), 0.95);
  }

  &.active {
    background-color: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-primary));
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// Temas del Banner General
.general-status-banner {
  transition: all 0.25s ease;

  &.status-theme-success {
    background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
    color: #065f46;
    border: 1.5px solid #a7f3d0;

    .status-icon-circle {
      color: #10b981;
    }
  }

  &.status-theme-warning {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    color: #92400e;
    border: 1.5px solid #fde68a;

    .status-icon-circle {
      color: #f59e0b;
    }
  }

  &.status-theme-amber-darken-3 {
    background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
    color: #9a3412;
    border: 1.5px solid #fed7aa;

    .status-icon-circle {
      color: #ea580c;
    }
  }

  &.status-theme-error {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    color: #991b1b;
    border: 1.5px solid #fecaca;

    .status-icon-circle {
      color: #ef4444;
    }
  }
}

.service-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  border-color: rgba(var(--v-border-color), 0.12) !important;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
}

.info-help-box {
  background: rgba(var(--v-theme-primary), 0.08) !important;
  border-color: rgba(var(--v-theme-primary), 0.3) !important;

  .info-help-icon-wrap {
    color: rgb(var(--v-theme-primary)) !important;
  }

  .info-help-title {
    color: rgb(var(--v-theme-primary)) !important;
    font-weight: 700 !important;
    font-size: 0.88rem !important;
    letter-spacing: 0.01em;
  }

  .info-help-body {
    color: rgba(var(--v-theme-on-surface), 0.90) !important;
    font-size: 0.82rem !important;
    line-height: 1.55 !important;

    strong {
      color: rgba(var(--v-theme-on-surface), 1) !important;
      font-weight: 700 !important;
    }
  }
}
</style>
