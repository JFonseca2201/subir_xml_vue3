<script setup>
import { useTheme } from "vuetify"
import ScrollToTop from "@core/components/ScrollToTop.vue"
import initCore from "@core/initCore"
import { initConfigStore, useConfigStore } from "@core/stores/config"
import { hexToRgb } from "@layouts/utils"
import GlobalLoader from '@/components/loaders/GlobalLoader.vue'
import OfflineOverlay from '@/components/OfflineOverlay.vue'
import GlobalToast from '@/components/common/GlobalToast.vue'

const { global } = useTheme()

// ℹ️ Sync current theme with initial loader theme
initCore()
initConfigStore()

const configStore = useConfigStore()

// Prevenir que el navegador descarte la pestaña o resetee el estado en segundo plano
onMounted(() => {
  if (typeof window !== 'undefined') {
    let tabHeartbeat = null
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        tabHeartbeat = setInterval(() => {}, 25000)
      } else if (tabHeartbeat) {
        clearInterval(tabHeartbeat)
        tabHeartbeat = null
      }
    })
  }
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
      
      <!-- Indicador y Overlay Global de Conexión -->
      <OfflineOverlay />

      <!-- Notificaciones Toast Globales -->
      <GlobalToast />
    </VApp>
  </VLocaleProvider>
</template>

<style>
.v-field__input {
  text-transform: uppercase !important;
}
</style>
