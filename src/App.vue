<script setup>
import { useTheme } from "vuetify"
import ScrollToTop from "@core/components/ScrollToTop.vue"
import initCore from "@core/initCore"
import { initConfigStore, useConfigStore } from "@core/stores/config"
import { hexToRgb } from "@layouts/utils"
import GlobalLoader from '@/components/loaders/GlobalLoader.vue'
import OfflineOverlay from '@/components/OfflineOverlay.vue'
import GlobalToast from '@/components/common/GlobalToast.vue'
import MaintenanceRemindersDrawer from '@/components/maintenance/MaintenanceRemindersDrawer.vue'

const { global } = useTheme()

// ℹ️ Sync current theme with initial loader theme
initCore()
initConfigStore()

const configStore = useConfigStore()

// Sincronizar data-theme en html y body para selector global de temas glassmorphism
watch(() => global.name.value, (newTheme) => {
  console.log('Theme changed to:', newTheme, 'current theme object:', global.current.value)
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', newTheme)
    document.body.setAttribute('data-theme', newTheme)
  }
}, { immediate: true })

// Prevenir que el navegador descarte la pestaña o resetee el estado en segundo plano
onMounted(() => {
  if (typeof window !== 'undefined') {
    document.documentElement.setAttribute('data-theme', global.name.value)
    document.body.setAttribute('data-theme', global.name.value)
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
      :data-theme="global.name.value"
      :class="`theme-${global.name.value}`"
      :style="`--v-global-theme-primary: ${hexToRgb(
        global.current.value?.colors?.primary || '#7367F0'
      )}`"
    >
      <RouterView />
      <MaintenanceRemindersDrawer />
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

/* Excepciones para campos que deben conservar minúsculas o formato natural (ej: correos y asuntos) */
input[type="email"],
.v-field__input input[type="email"],
.no-uppercase,
.no-uppercase .v-field__input,
.no-uppercase input,
.email-clean-input .v-field__input,
.email-clean-input input,
.subject-clean-input .v-field__input,
.subject-clean-input input {
  text-transform: none !important;
}

.email-clean-input .v-field__input,
.email-clean-input input {
  text-transform: lowercase !important;
}
</style>
