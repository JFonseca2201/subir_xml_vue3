<script setup>
import { ref } from 'vue'

const isChecking = ref(false)

const checkConnection = () => {
  isChecking.value = true
  setTimeout(() => {
    isChecking.value = false
    if (navigator.onLine) {
      // The global listener in App.vue will catch the 'online' event 
      // but this acts as visual feedback for the user
      window.dispatchEvent(new Event('online'))
    }
  }, 1000)
}
</script>

<template>
  <div class="offline-overlay d-flex align-center justify-center">
    <!-- Animated background shapes -->
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>

    <VCard class="pa-10 text-center rounded-xl elevation-24 glass-card mx-4" max-width="550">
      <div class="icon-wrapper mb-8 d-flex align-center justify-center mx-auto">
        <VIcon icon="ri-wifi-off-line" size="70" color="error" class="pulse-animation" />
      </div>
      
      <h1 class="text-h3 font-weight-black mb-4">Sin Conexión</h1>
      
      <p class="text-body-1 text-medium-emphasis mb-8 px-sm-4">
        Parece que has perdido la conexión a internet. Revisa el estado de tu red, el WiFi o tu router. 
        <strong>Te reconectaremos automáticamente en cuanto vuelvas a tener señal.</strong>
      </p>

      <VBtn 
        color="primary" 
        size="x-large" 
        rounded="pill" 
        block 
        class="font-weight-bold text-button elevation-4 hover-lift" 
        :loading="isChecking"
        prepend-icon="ri-refresh-line"
        @click="checkConnection"
      >
        Reintentar Conexión
      </VBtn>
      
      <div class="mt-6 text-caption text-medium-emphasis d-flex align-center justify-center gap-2">
        <VIcon icon="ri-radar-line" size="small" class="spin-slow" />
        Buscando señal en segundo plano...
      </div>
    </VCard>
  </div>
</template>

<style scoped>
.offline-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999999;
  background-color: rgb(var(--v-theme-background));
  overflow: hidden;
}

/* Glassmorphism Effect */
.glass-card {
  background: rgba(var(--v-theme-surface), 0.75) !important;
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border: 1px solid rgba(var(--v-theme-surface), 0.5);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
  z-index: 10;
}

.icon-wrapper {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: rgba(var(--v-theme-error), 0.08);
  box-shadow: 0 0 40px rgba(var(--v-theme-error), 0.15), inset 0 0 20px rgba(var(--v-theme-error), 0.05);
  position: relative;
}

.icon-wrapper::after {
  content: '';
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  border-radius: 50%;
  border: 2px dashed rgba(var(--v-theme-error), 0.2);
  animation: spin 10s linear infinite;
}

.pulse-animation {
  animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.7; }
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.spin-slow {
  animation: spin 4s linear infinite;
}

.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hover-lift:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(var(--v-theme-primary), 0.3) !important;
}

/* Background Blobs for aesthetic wow factor */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.4;
  z-index: 0;
}

.blob-1 {
  width: 500px;
  height: 500px;
  background: rgb(var(--v-theme-error));
  top: -150px;
  left: -100px;
  animation: float 10s ease-in-out infinite;
}

.blob-2 {
  width: 600px;
  height: 600px;
  background: rgb(var(--v-theme-primary));
  bottom: -200px;
  right: -150px;
  animation: float 14s ease-in-out infinite reverse;
}

.blob-3 {
  width: 400px;
  height: 400px;
  background: rgb(var(--v-theme-warning));
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: float 12s ease-in-out infinite;
  opacity: 0.2;
}

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0, 0) scale(1); }
}
</style>
