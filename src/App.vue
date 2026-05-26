<script setup>
import { useTheme } from "vuetify"
import ScrollToTop from "@core/components/ScrollToTop.vue"
import initCore from "@core/initCore"
import { initConfigStore, useConfigStore } from "@core/stores/config"
import { hexToRgb } from "@layouts/utils"
import GlobalLoader from '@/components/loaders/GlobalLoader.vue'
import OfflineOverlay from '@/components/OfflineOverlay.vue'
import { onMounted, onUnmounted, ref } from 'vue'

const { global } = useTheme()

// ℹ️ Sync current theme with initial loader theme
initCore()
initConfigStore()

const configStore = useConfigStore()

// Manejo global de conexión sin usar el router (evita errores de Vite fetch dynamically imported module)
const isOffline = ref(false)

const handleOffline = () => {
  isOffline.value = true
}

const handleOnline = () => {
  isOffline.value = false
}

onMounted(() => {
  window.addEventListener('offline', handleOffline)
  window.addEventListener('online', handleOnline)
  
  // Check initial state
  if (!navigator.onLine) {
    handleOffline()
  }
})

onUnmounted(() => {
  window.removeEventListener('offline', handleOffline)
  window.removeEventListener('online', handleOnline)
})
</script>

<template>
  <VLocaleProvider :rtl="configStore.isAppRTL">
    <!-- ℹ️ This is required to set the background color of active nav link based on currently active global theme's primary -->
    <VApp
      :style="`--v-global-theme-primary: ${hexToRgb(
        global.current.value.colors.primary
      )}`"
    >
      <RouterView />
      <GlobalLoader />
      <ScrollToTop />
      
      <!-- Overlay Global de Sin Conexión -->
      <OfflineOverlay v-if="isOffline" />
    </VApp>
  </VLocaleProvider>
</template>

<style>
.v-field__input {
  text-transform: uppercase !important;
}
</style>
