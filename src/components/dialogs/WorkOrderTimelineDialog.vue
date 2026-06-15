<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  order: {
    type: Object,
    default: () => null
  },
  isUpdating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'change-status', 'generate-sale'])

// Manejo del cierre del modal
const handleClose = () => {
  emit('close')
}

// Datos de la orden (Fallback a datos de ejemplo si no se pasan por prop)
const numeroOrden = computed(() => props.order?.number || 'OT-2026-0089')
const vehiculoInfo = computed(() => {
  if (props.order?.vehicle) {
    return `${props.order.vehicle.brand} ${props.order.vehicle.model} - ${props.order.vehicle.plate}`
  }
  return 'Toyota Hilux - PCT-810'
})

// Línea de Tiempo Dinámica
const timelineSteps = computed(() => {
  const currentStatus = props.order?.status || 'draft'
  const statuses = ['draft', 'received', 'in_progress', 'ready', 'delivered']
  const currentIndex = statuses.indexOf(currentStatus)
  
  let orderDate = 'N/A'
  if (props.order?.created_at) {
    try {
      const dateObj = new Date(props.order.created_at.replace(' ', 'T'))
      orderDate = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(dateObj)
    } catch(e) {
      orderDate = props.order.created_at
    }
  }

  return [
    {
      id: 1,
      title: 'BORRADOR REGISTRADO',
      date: currentIndex >= 0 ? orderDate : null,
      description: 'La orden fue creada en el sistema.',
      status: currentIndex > 0 ? 'completed' : (currentIndex === 0 ? 'active' : 'pending'),
      icon: 'ri-draft-line',
      action: {
        label: 'Aprobar Ingreso',
        color: 'info',
        icon: 'ri-arrow-right-line',
        handler: () => emit('change-status', 'received')
      }
    },
    {
      id: 2,
      title: 'VEHÍCULO RECIBIDO',
      date: currentIndex >= 1 ? 'Aprobado' : null,
      description: 'El cliente autorizó el ingreso y dejó el vehículo en recepción.',
      status: currentIndex > 1 ? 'completed' : (currentIndex === 1 ? 'active' : 'pending'),
      icon: 'ri-file-list-3-line',
      action: {
        label: 'Iniciar Diagnóstico',
        color: 'warning',
        icon: 'ri-tools-line',
        handler: () => emit('change-status', 'in_progress')
      }
    },
    {
      id: 3,
      title: 'EN DIAGNÓSTICO / REPARACIÓN',
      date: currentIndex >= 2 ? 'En proceso' : null,
      description: 'El vehículo está siendo evaluado y reparado por los técnicos asignados.',
      status: currentIndex > 2 ? 'completed' : (currentIndex === 2 ? 'active' : 'pending'),
      icon: 'ri-tools-line',
      action: {
        label: 'Marcar como Finalizado',
        color: 'success',
        icon: 'ri-checkbox-circle-line',
        handler: () => emit('change-status', 'ready')
      }
    },
    {
      id: 4,
      title: 'TRABAJO FINALIZADO',
      date: currentIndex >= 3 ? 'Completado' : null,
      description: 'Las reparaciones concluyeron exitosamente. Listo para facturar.',
      status: currentIndex > 3 ? 'completed' : (currentIndex === 3 ? 'active' : 'pending'),
      icon: 'ri-checkbox-circle-line',
      action: {
        label: props.order?.sale ? 'Entregar Vehículo' : 'Generar Venta / Facturar',
        color: props.order?.sale ? 'primary' : 'success',
        icon: props.order?.sale ? 'ri-truck-line' : 'ri-shopping-cart-line',
        handler: () => props.order?.sale ? emit('change-status', 'delivered') : emit('generate-sale')
      }
    },
    {
      id: 5,
      title: 'VEHÍCULO ENTREGADO',
      date: currentIndex === 4 ? 'Entregado' : null,
      description: 'El vehículo y las llaves fueron entregados satisfactoriamente al cliente.',
      status: currentIndex === 4 ? 'active' : 'pending',
      icon: 'ri-truck-line'
    }
  ]
})
</script>

<template>
  <VDialog :model-value="isOpen" @update:model-value="(val) => !val && handleClose()" max-width="600" scrollable
    transition="dialog-bottom-transition">
    <VCard class="rounded-xl shadow-lg border-0 bg-white">
      <!-- CABECERA DEL MODAL -->
      <div class="px-6 py-5 border-b border-gray-100 d-flex justify-space-between align-start relative bg-white"
        style="border-bottom-color: #f3f4f6;">
        <div>
          <h2 class="text-h5 font-weight-bold text-grey-darken-4 mb-1" style="color: #1f2937;">
            Secuencia de la Orden: <span class="text-primary">#{{ numeroOrden }}</span>
          </h2>
          <div class="text-body-2 d-flex align-center gap-2" style="color: #6b7280;">
            <VIcon icon="ri-car-line" size="16" />
            <span>{{ vehiculoInfo }}</span>
          </div>
        </div>

        <VBtn icon="ri-close-line" variant="text" color="grey-darken-1" size="small"
          class="bg-grey-lighten-4 rounded-circle transition-all hover:bg-red-50 hover:text-red-500"
          @click="handleClose" />
      </div>

      <!-- CUERPO DEL MODAL (LÍNEA DE TIEMPO) -->
      <VCardText class="pa-6 custom-scrollbar bg-gray-50" style="background-color: #fafafa;">
        <div class="timeline-container">
          <div v-for="(step, index) in timelineSteps" :key="step.id" class="timeline-item"
            :class="`state-${step.status}`">
            <!-- Línea conectora hacia el siguiente nodo -->
            <div v-if="index < timelineSteps.length - 1" class="timeline-connector"
              :class="{ 'completed-line': step.status === 'completed' }"></div>

            <!-- Icono Circular del Nodo -->
            <div class="timeline-icon-container">
              <VIcon :icon="step.icon" size="18" />
            </div>

            <!-- Contenido del Nodo -->
            <div class="timeline-content">
              <div class="d-flex flex-column flex-sm-row justify-space-between align-sm-center mb-1 gap-1">
                <h4 class="text-subtitle-1 font-weight-bold text-uppercase timeline-title">
                  {{ step.title }}
                </h4>
                <span v-if="step.date" class="text-caption timeline-date d-flex align-center gap-1">
                  <VIcon icon="ri-time-line" size="14" />
                  {{ step.date }}
                </span>
                <span v-else class="text-caption text-grey-lighten-1">Por definir</span>
              </div>
              <p class="text-body-2 timeline-description mb-0">
                {{ step.description }}
              </p>
              
              <!-- Botón de acción si es el paso activo -->
              <div v-if="step.status === 'active' && step.action" class="mt-3">
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
      <VCardActions class="pa-4 border-t border-gray-100 bg-white d-flex justify-end"
        style="border-top-color: #f3f4f6;">
        <VBtn color="grey-darken-2" variant="tonal" class="px-6 text-none font-weight-medium rounded-lg"
          @click="handleClose">
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
