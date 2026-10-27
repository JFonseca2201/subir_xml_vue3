<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

const isGlobalAlertVisible = ref(false)
const globalAlertMessage = ref('Por favor complete todos los casilleros obligatorios marcados en rojo antes de continuar.')

let lastCheckTimeout = null

const handleGlobalClick = event => {
  const target = event.target
  if (!target) return

  // Buscar si el click fue en un botón o dentro de un botón
  const button = target.closest('button, .v-btn')
  if (!button) return

  // Verificar si es un botón de guardar / submit / registrar / actualizar
  const text = (button.innerText || button.textContent || '').toLowerCase().trim()
  const isSubmitBtn =
    button.type === 'submit' ||
    text.includes('guardar') ||
    text.includes('registrar') ||
    text.includes('crear') ||
    text.includes('actualizar') ||
    text.includes('generar') ||
    text.includes('facturar') ||
    text.includes('save')

  // Ignorar botones de cerrar, cancelar, limpiar, etc.
  if (
    !isSubmitBtn ||
    text.includes('cancelar') ||
    text.includes('cerrar') ||
    text.includes('limpiar') ||
    text.includes('volver')
  ) {
    return
  }

  // Dar tiempo a Vuetify (60ms) para que ejecute form.validate() y aplique .v-input--error
  if (lastCheckTimeout) clearTimeout(lastCheckTimeout)
  lastCheckTimeout = setTimeout(() => {
    // Buscar el contenedor más cercano (diálogo, drawer, tarjeta o formulario)
    const container =
      button.closest('.v-dialog') ||
      button.closest('.v-navigation-drawer') ||
      button.closest('.v-card') ||
      button.closest('form') ||
      button.closest('.v-form') ||
      document

    const errorFields = container.querySelectorAll('.v-input--error, .v-field--error')

    if (errorFields && errorFields.length > 0) {
      globalAlertMessage.value = 'Por favor complete todos los casilleros obligatorios marcados en rojo antes de continuar.'

      // Si el contenedor ya tiene su propia alerta interna visible (.form-validation-alert), no duplicamos el banner flotante
      const localAlert = container.querySelector('.form-validation-alert')
      if (!localAlert) {
        isGlobalAlertVisible.value = true
        showNotification('Campos obligatorios por llenar', 'warning')
      }

      // Auto-focus y scroll suave al primer campo inválido
      const firstError = errorFields[0]
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const input = firstError.querySelector('input, select, textarea')
        if (input) {
          setTimeout(() => input.focus(), 120)
        }
      }
    } else {
      isGlobalAlertVisible.value = false
    }
  }, 75)
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleGlobalClick, true)
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', handleGlobalClick, true)
  }
  if (lastCheckTimeout) clearTimeout(lastCheckTimeout)
})
</script>

<template>
  <!-- Alerta Flotante Global de Control de Formularios -->
  <Transition name="fade-slide">
    <div
      v-if="isGlobalAlertVisible"
      class="global-form-alert-container"
    >
      <VAlert
        type="warning"
        variant="tonal"
        density="comfortable"
        closable
        class="global-form-alert elevation-12 rounded-xl"
        @click:close="isGlobalAlertVisible = false"
      >
        <template #prepend>
          <VIcon
            icon="ri-alert-fill"
            size="26"
            class="text-warning mr-2 pulse-icon"
          />
        </template>

        <div class="d-flex flex-column gap-1">
          <div class="font-weight-bold text-subtitle-2 d-flex align-center gap-2">
            <span>Campos obligatorios por llenar</span>
          </div>
          <div class="text-caption text-high-emphasis">
            {{ globalAlertMessage }}
          </div>
        </div>
      </VAlert>
    </div>
  </Transition>
</template>

<style scoped>
.global-form-alert-container {
  position: fixed;
  top: 75px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999999 !important;
  width: 90%;
  max-width: 540px;
  pointer-events: auto;
}

.global-form-alert {
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border-left: 5px solid #ef4444 !important;
}

.pulse-icon {
  animation: iconPulse 1.2s infinite ease-in-out;
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.85;
  }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translate(-50%, -20px) scale(0.96);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px) scale(0.96);
}
</style>
