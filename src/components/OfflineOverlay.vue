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
