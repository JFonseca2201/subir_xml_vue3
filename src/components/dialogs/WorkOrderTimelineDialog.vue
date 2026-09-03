<script setup>
import { ref, watch, computed } from 'vue'
import { getBrandNameById } from '@/data/vehicleBrands'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: Boolean,
    default: false,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
  workOrder: {
    type: Object,
    default: () => null,
  },
  order: {
    type: Object,
    default: () => null,
  },
  isUpdating: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'update:modelValue', 'close', 'change-status', 'generate-sale'])

// Diálogo reactivo
const dialog = computed({
  get: () => props.isDialogVisible || props.modelValue || props.isOpen,
  set: val => {
    emit('update:isDialogVisible', val)
    emit('update:modelValue', val)
    if (!val) emit('close')
  },
})

// Manejo del cierre del modal
const handleClose = () => {
  dialog.value = false
}

// Objeto de la orden unificado
const targetOrder = computed(() => props.workOrder || props.order || null)

// Secuencia / Número de la orden
const numeroOrden = computed(() => {
  const num = targetOrder.value?.number || targetOrder.value?.id
  if (!num) return 'SIN NÚMERO'
  const str = String(num).trim()
  return str.startsWith('#') ? str : (str.includes('-') ? str : '#' + str)
})

// Información del vehículo
const vehiculoInfo = computed(() => {
  if (targetOrder.value?.vehicle) {
    const v = targetOrder.value.vehicle
    const plate = v.license_plate ? `Placa: ${v.license_plate.toUpperCase()}` : 'Sin placa'
    const brand = getBrandNameById(v.brand?.name || v.brand || v.brand_id) || ''
    const model = v.model || ''
    const brandModel = `${brand} ${model}`.trim()
    return brandModel ? `${brandModel} • ${plate}` : plate
  }
  return 'Vehículo en Taller'
})

// Información del cliente
const clienteInfo = computed(() => {
  if (targetOrder.value?.client) {
    const c = targetOrder.value.client
    return c.full_name || c.name || ''
  }
  return ''
})

// Línea de Tiempo Dinámica
const timelineSteps = computed(() => {
  const currentStatus = targetOrder.value?.status || 'draft'
  const statuses = ['draft', 'received', 'in_progress', 'ready', 'delivered']
  const currentIndex = statuses.indexOf(currentStatus)

  let orderDate = 'N/A'
  if (targetOrder.value?.created_at || targetOrder.value?.date) {
    try {
      const rawDate = targetOrder.value.date || targetOrder.value.created_at
      const dateObj = new Date(String(rawDate).replace(' ', 'T'))

      orderDate = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(dateObj)
    } catch (e) {
      orderDate = String(targetOrder.value.date || targetOrder.value.created_at)
    }
  }

  return [
    {
      id: 1,
      title: 'BORRADOR REGISTRADO',
      date: currentIndex >= 0 ? orderDate : null,
      description: 'La orden fue creada y guardada preliminarmente en el sistema.',
      status: currentIndex > 0 ? 'completed' : (currentIndex === 0 ? 'active' : 'pending'),
      icon: 'ri-draft-line',
      action: {
        label: 'Aprobar Ingreso a Taller',
        color: 'info',
        icon: 'ri-arrow-right-line',
        handler: () => emit('change-status', 'received'),
      },
    },
    {
      id: 2,
      title: 'VEHÍCULO RECIBIDO',
      date: currentIndex >= 1 ? 'En Taller' : null,
      description: 'El cliente autorizó el ingreso e inspección del vehículo en recepción.',
      status: currentIndex > 1 ? 'completed' : (currentIndex === 1 ? 'active' : 'pending'),
      icon: 'ri-file-list-3-line',
      action: {
        label: 'Iniciar Diagnóstico / Trabajo',
        color: 'warning',
        icon: 'ri-tools-line',
        handler: () => emit('change-status', 'in_progress'),
      },
    },
    {
      id: 3,
      title: 'EN DIAGNÓSTICO / REPARACIÓN',
      date: currentIndex >= 2 ? 'En Operación' : null,
      description: 'El vehículo está siendo intervenido por los técnicos mecánicos.',
      status: currentIndex > 2 ? 'completed' : (currentIndex === 2 ? 'active' : 'pending'),
      icon: 'ri-tools-line',
      action: {
        label: 'Marcar como Finalizado / Listo',
        color: 'success',
        icon: 'ri-checkbox-circle-line',
        handler: () => emit('change-status', 'ready'),
      },
    },
    {
      id: 4,
      title: 'TRABAJO FINALIZADO',
      date: currentIndex >= 3 ? 'Completado' : null,
      description: 'Las labores mecánicas concluyeron exitosamente. Listo para entrega o facturación.',
      status: currentIndex > 3 ? 'completed' : (currentIndex === 3 ? 'active' : 'pending'),
      icon: 'ri-checkbox-circle-line',
      action: currentIndex === 3 ? {
        label: 'Marcar como Entregado',
        color: 'info',
        icon: 'ri-truck-line',
        handler: () => emit('change-status', 'delivered'),
      } : null,
    },
    {
      id: 5,
      title: 'VEHÍCULO ENTREGADO',
      date: currentIndex === 4 ? 'Entregado al Cliente' : null,
      description: 'El vehículo fue retirado satisfactoriamente por el cliente.',
      status: currentIndex === 4 ? 'active' : 'pending',
      icon: 'ri-truck-line',
      action: (currentIndex >= 3 && !targetOrder.value?.sale) ? {
        label: 'Generar Venta / Facturar',
        color: 'success',
        icon: 'ri-shopping-cart-line',
        handler: () => emit('generate-sale'),
      } : null,
    },
  ]
})
</script>

<template>
  <VDialog
    v-model="dialog"
    max-width="640"
    scrollable
    transition="dialog-bottom-transition"
  >
    <VCard class="custom-dialog-card bg-white rounded-xl overflow-hidden elevation-8">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white pa-5 position-relative">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn position-absolute"
          style="top: 12px; right: 12px;"
          @click="handleClose"
        />
        <div class="d-flex align-center gap-3">
          <VAvatar size="46" color="white" variant="tonal" rounded="lg" class="elevation-1">
            <VIcon icon="ri-time-line" size="26" color="white" />
          </VAvatar>
          <div class="min-w-0">
            <h3 class="text-h6 font-weight-bold text-white mb-0 text-truncate">
              Secuencia de la Orden: {{ numeroOrden }}
            </h3>
            <p class="text-caption text-white opacity-90 mb-0 mt-0.5 text-truncate">
              {{ vehiculoInfo }} <span v-if="clienteInfo">• {{ clienteInfo }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- CUERPO DEL MODAL (LÍNEA DE TIEMPO) -->
      <VCardText
        class="pa-6 custom-scrollbar bg-grey-lighten-5"
        style="background-color: #fafafa; max-height: 60vh;"
      >
        <div class="timeline-container">
          <div
            v-for="(step, index) in timelineSteps"
            :key="step.id"
            class="timeline-item"
            :class="`state-${step.status}`"
          >
            <!-- Línea conectora hacia el siguiente nodo -->
            <div
              v-if="index < timelineSteps.length - 1"
              class="timeline-connector"
              :class="{ 'completed-line': step.status === 'completed' }"
            />

            <!-- Icono Circular del Nodo -->
            <div class="timeline-icon-container">
              <VIcon
                :icon="step.icon"
                size="18"
              />
            </div>

            <!-- Contenido del Nodo -->
            <div class="timeline-content">
              <div class="d-flex flex-column flex-sm-row justify-space-between align-sm-center mb-1 gap-1">
                <h4 class="text-subtitle-2 font-weight-bold text-uppercase timeline-title">
                  {{ step.title }}
                </h4>
                <span
                  v-if="step.date"
                  class="text-caption timeline-date d-flex align-center gap-1"
                >
                  <VIcon
                    icon="ri-time-line"
                    size="13"
                  />
                  {{ step.date }}
                </span>
                <span
                  v-else
                  class="text-caption text-grey-lighten-1"
                >Por definir</span>
              </div>
              <p class="text-caption timeline-description mb-0">
                {{ step.description }}
              </p>

              <!-- Botón de acción si es el paso activo -->
              <div
                v-if="step.status === 'active' && step.action"
                class="mt-3"
              >
                <VBtn
                  :color="step.action.color"
                  variant="elevated"
                  size="small"
                  class="text-none rounded-lg action-btn font-weight-bold"
                  :prepend-icon="step.action.icon"
                  :loading="props.isUpdating"
                  @click="step.action.handler"
                >
                  {{ step.action.label }}
                </VBtn>
              </div>
            </div>
          </div>
        </div>
      </VCardText>

      <!-- PIE DEL MODAL -->
      <VCardActions
        class="pa-4 border-t bg-white d-flex justify-end align-center gap-3"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="handleClose"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
/* Contenedor Principal de la Línea de Tiempo */
.timeline-container {
  position: relative;
  padding: 1rem 0.5rem;
}

/* Ítem Individual */
.timeline-item {
  display: flex;
  position: relative;
  margin-bottom: 2.5rem;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

/* Línea Conectora Vertical */
.timeline-connector {
  position: absolute;
  top: 40px;
  /* Comienza debajo del icono */
  bottom: -40px;
  /* Llega hasta el siguiente icono */
  left: 20px;
  /* Centrado con el icono de 40px de ancho */
  width: 2px;
  background-color: #e2e8f0;
  /* Gris claro por defecto */
  z-index: 1;
  border-radius: 2px;
}

.timeline-connector.completed-line {
  background-color: #22c55e;
  /* Verde brillante si ya se completó el paso actual */
}

/* Contenedor del Icono Circular */
.timeline-icon-container {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 1.5rem;
  transition: all 0.3s ease;
}

/* CONTENIDO DEL NODO */
.timeline-content {
  flex-grow: 1;
  padding-top: 8px;
  /* Alinear el texto con el centro óptico del icono */
}

.timeline-title {
  color: #1f2937;
  letter-spacing: 0.5px;
}

.timeline-description {
  color: #6b7280;
  line-height: 1.5;
}

.timeline-date {
  color: #9ca3af;
  font-weight: 500;
}

/* =========================================
   ESTADOS VISUALES (COMPLETED, ACTIVE, PENDING)
   ========================================= */

/* 1. Estado: COMPLETADO */
.state-completed .timeline-icon-container {
  background-color: #22c55e;
  /* Verde Tailwind */
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(34, 197, 94, 0.2);
}

/* 2. Estado: ACTIVO (Actual) */
.state-active .timeline-icon-container {
  background-color: #2563eb;
  /* Azul Vibrante Eléctrico */
  color: #ffffff;
  /* Efecto de borde tipo "Glow" o sombra exterior suave */
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.15), 0 4px 12px rgba(37, 99, 235, 0.3);
  transform: scale(1.05);
  /* Ligeramente más grande para destacar */
}

.state-active .timeline-title {
  color: #2563eb;
  /* Destacar el título en azul */
}

.state-active .timeline-description {
  color: #4b5563;
  /* Gris más oscuro para mejor lectura */
  font-weight: 500;
}

/* 3. Estado: PENDIENTE (Futuro) */
.state-pending .timeline-icon-container {
  background-color: #f1f5f9;
  /* Gris fondo */
  color: #94a3b8;
  /* Icono opaco */
  border: 2px solid #e2e8f0;
  /* Borde sutil */
}

.state-pending .timeline-content {
  opacity: 0.6;
  /* Atenuar todo el texto del futuro */
}

/* Utilidad para scrollbar del modal */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Efectos de Hover básicos para botones */
.hover\:bg-red-50:hover {
  background-color: #fef2f2 !important;
}

.hover\:text-red-500:hover {
  color: #ef4444 !important;
}
</style>
