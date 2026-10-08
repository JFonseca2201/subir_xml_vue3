<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const isOffline = ref(!navigator.onLine)
const isChecking = ref(false)
const showDialog = ref(false) // Whether the expanded modal is open
const showRestoredToast = ref(false)
const lastCheckedTime = ref('')
let pingInterval = null
let toastTimeout = null

// Real network test function
const checkRealConnection = async (manual = false) => {
  if (isChecking.value) return
  isChecking.value = true

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    // Ping the app origin with unique timestamp to avoid cache
    await fetch(`/favicon.ico?_ping=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Connection is alive!
    if (isOffline.value) {
      isOffline.value = false
      showDialog.value = false
      showRestoredToast.value = true
      
      if (toastTimeout) clearTimeout(toastTimeout)
      toastTimeout = setTimeout(() => {
        showRestoredToast.value = false
      }, 4000)
    }
  } catch (err) {
    // Still offline
    isOffline.value = true
    const now = new Date()
    lastCheckedTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } finally {
    isChecking.value = false
  }
}

const handleOfflineEvent = () => {
  isOffline.value = true
  lastCheckedTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  // Show dialog initially so user is notified, but they can easily minimize it
  showDialog.value = true
}

const handleOnlineEvent = () => {
  // Confirm with a real request before declaring online
  checkRealConnection()
}

onMounted(() => {
  window.addEventListener('offline', handleOfflineEvent)
  window.addEventListener('online', handleOnlineEvent)

  if (!navigator.onLine) {
    handleOfflineEvent()
  }

  // Periodic background check every 12 seconds when offline
  pingInterval = setInterval(() => {
    if (isOffline.value && !isChecking.value) {
      checkRealConnection()
    }
  }, 12000)
})

onUnmounted(() => {
  window.removeEventListener('offline', handleOfflineEvent)
  window.removeEventListener('online', handleOnlineEvent)
  if (pingInterval) clearInterval(pingInterval)
  if (toastTimeout) clearTimeout(toastTimeout)
})
</script>

<template>
  <!-- 1. FLOATING TOP STATUS PILL (Non-blocking / Minimized) -->
  <Transition name="slide-fade">
    <div
      v-if="isOffline && !showDialog"
      class="offline-floating-pill d-flex align-center gap-3 px-4 py-2.5"
    >
      <div class="pill-beacon">
        <span class="beacon-pulse" />
        <span class="beacon-dot" />
      </div>

      <div class="d-flex flex-column text-start">
        <div class="font-weight-bold text-caption text-sm-body-2 leading-tight d-flex align-center gap-1.5 text-white">
          <VIcon
            icon="ri-wifi-off-line"
            size="16"
            class="text-error-lighten"
          />
          <span>Sin conexión a Internet</span>
        </div>
        <span class="text-caption text-white-50 d-none d-sm-inline" style="font-size: 0.72rem;">
          Modo local activo · Reconectando automáticamente
        </span>
      </div>

      <div class="d-flex align-center gap-1.5 ms-2">
        <VBtn
          size="x-small"
          variant="flat"
          color="white"
          class="text-slate-900 font-weight-bold px-2.5 rounded-pill elevation-2 text-capitalize"
          :loading="isChecking"
          prepend-icon="ri-refresh-line"
          @click="checkRealConnection(true)"
        >
          Reintentar
        </VBtn>

        <VBtn
          icon="ri-information-line"
          size="x-small"
          variant="text"
          color="white"
          class="text-white-80"
          title="Ver detalles"
          @click="showDialog = true"
        />
      </div>
    </div>
  </Transition>

  <!-- 2. FULL GLASSMORPHISM NOTIFICATION DIALOG (Intelligent & Dismissible) -->
  <VDialog
    v-model="showDialog"
    persistent
    max-width="500"
    class="offline-dialog-wrapper"
    transition="dialog-transition"
  >
    <VCard class="offline-glass-card pa-6 pa-sm-8 text-center rounded-2xl elevation-24 position-relative overflow-hidden">
      <!-- Glow ambient background effect -->
      <div class="ambient-glow" />

      <!-- Top Close / Minimize Button -->
      <VBtn
        icon="ri-close-line"
        size="small"
        variant="tonal"
        color="secondary"
        class="position-absolute top-0 right-0 ma-4 rounded-circle z-index-1"
        title="Minimizar y continuar viendo la pantalla"
        @click="showDialog = false"
      />

      <!-- Animated Icon with Ripple Rings -->
      <div class="icon-pulse-container my-3 mx-auto">
        <div class="ripple-ring ring-1" />
        <div class="ripple-ring ring-2" />
        <div class="icon-badge">
          <VIcon
            icon="ri-wifi-off-line"
            size="36"
            color="error"
          />
        </div>
      </div>

      <!-- Title & Details -->
      <h2 class="text-h5 font-weight-black text-high-emphasis mb-2">
        Sin Conexión a Internet
      </h2>

      <p class="text-body-2 text-medium-emphasis mb-5 px-sm-2 leading-relaxed">
        Se ha interrumpido la conexión de red o el servicio de internet.
        <strong class="text-high-emphasis d-block mt-1">
          Te reconectaremos automáticamente en cuanto vuelva la señal.
        </strong>
      </p>

      <!-- Status Pill -->
      <div class="offline-status-bar mb-6 pa-2.5 rounded-xl d-flex align-center justify-center gap-2">
        <VIcon
          icon="ri-radar-line"
          size="16"
          :class="isChecking ? 'spin-anim text-primary' : 'text-medium-emphasis'"
        />
        <span class="text-caption font-weight-medium text-medium-emphasis" style="font-size: 0.78rem;">
          {{ isChecking ? 'Comprobando señal con el servidor...' : (lastCheckedTime ? `Último intento: ${lastCheckedTime}` : 'Monitoreando red en segundo plano...') }}
        </span>
      </div>

      <!-- Actions -->
      <div class="d-flex flex-column gap-2.5 w-100">
        <VBtn
          color="primary"
          size="large"
          rounded="xl"
          block
          class="font-weight-bold text-body-2 elevation-3 btn-reconnect"
          :loading="isChecking"
          prepend-icon="ri-refresh-line"
          @click="checkRealConnection(true)"
        >
          Reintentar Conexión Ahora
        </VBtn>

        <VBtn
          variant="tonal"
          color="secondary"
          size="large"
          rounded="xl"
          block
          class="font-weight-semibold text-body-2"
          prepend-icon="ri-eye-line"
          @click="showDialog = false"
        >
          Continuar en la Pantalla Actual
        </VBtn>
      </div>
    </VCard>
  </VDialog>

  <!-- 3. CONNECTION RESTORED SUCCESS TOAST -->
  <Transition name="slide-fade">
    <div
      v-if="showRestoredToast"
      class="online-restored-pill d-flex align-center gap-2.5 px-5 py-3"
    >
      <div class="success-dot-pulse">
        <span class="dot-core" />
      </div>
      <div class="d-flex flex-column text-start">
        <span class="font-weight-bold text-body-2 text-white leading-tight">
          ¡Conexión Restablecida!
        </span>
        <span class="text-caption text-white-80" style="font-size: 0.72rem;">
          El sistema está en línea y sincronizado
        </span>
      </div>
      <VIcon
        icon="ri-check-line"
        size="20"
        color="white"
        class="ms-2"
      />
    </div>
  </Transition>
</template>

<style scoped lang="scss">
/* 1. FLOATING TOP PILL */
.offline-floating-pill {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999999;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(239, 68, 68, 0.4);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35), 0 0 20px rgba(239, 68, 68, 0.2);
  border-radius: 9999px;
  max-width: 92vw;
}

.pill-beacon {
  position: relative;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;

  .beacon-dot {
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
  }

  .beacon-pulse {
    position: absolute;
    width: 16px;
    height: 16px;
    background: rgba(239, 68, 68, 0.6);
    border-radius: 50%;
    animation: beacon-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
}

@keyframes beacon-ping {
  75%, 100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

/* 2. SUCCESS RESTORED TOAST */
.online-restored-pill {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999999;
  background: rgba(16, 185, 129, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 12px 32px rgba(16, 185, 129, 0.4);
  border-radius: 9999px;
  max-width: 92vw;
}

.success-dot-pulse {
  width: 10px;
  height: 10px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 8px #ffffff;
}

/* 3. GLASS CARD MODAL */
.offline-glass-card {
  background: rgba(var(--v-theme-surface), 0.94) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(239, 68, 68, 0.2) !important;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35) !important;
}

.ambient-glow {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  height: 140px;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0) 70%);
  pointer-events: none;
}

/* ICON PULSE CONTAINER */
.icon-pulse-container {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;

  .icon-badge {
    width: 64px;
    height: 64px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .ripple-ring {
    position: absolute;
    border-radius: 26px;
    border: 1.5px solid rgba(239, 68, 68, 0.35);
    pointer-events: none;

    &.ring-1 {
      width: 76px;
      height: 76px;
      animation: ripple 2.4s ease-out infinite;
    }

    &.ring-2 {
      width: 88px;
      height: 88px;
      animation: ripple 2.4s ease-out infinite 0.8s;
    }
  }
}

@keyframes ripple {
  0% {
    transform: scale(0.85);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.3);
    opacity: 0;
  }
}

.offline-status-bar {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.btn-reconnect {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
  color: white !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35) !important;
  }
}

.spin-anim {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* TRANSITIONS */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translate(-50%, -24px);
  opacity: 0;
}

.text-white-50 {
  color: rgba(255, 255, 255, 0.65) !important;
}

.text-white-80 {
  color: rgba(255, 255, 255, 0.85) !important;
}

.text-error-lighten {
  color: #f87171 !important;
}
</style>
