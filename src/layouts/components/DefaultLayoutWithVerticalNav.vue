<script setup>
import { onMounted } from 'vue'
import navItems from '@/navigation/vertical'
import { useConfigStore } from '@core/stores/config'
import { themeConfig, layoutConfig } from '@themeConfig'
import { $api } from '@/utils/api'

// Components
import Footer from '@/layouts/components/Footer.vue'
import NavbarThemeSwitcher from '@/layouts/components/NavbarThemeSwitcher.vue'
import UserProfile from '@/layouts/components/UserProfile.vue'
import NavBarI18n from '@core/components/I18n.vue'
import GlobalToast from '@/components/common/GlobalToast.vue'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'

// @layouts plugin
import { VerticalNavLayout } from '@layouts'

// Cargar dinámicamente nombre de la sucursal registrada
const loadSucursalInfo = async () => {
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    const resp = await $api('sucursales/1', {
      method: 'GET',
    })
    if (resp && resp.sucursal) {
      const sucursalName = resp.sucursal.trade_name || (resp.sucursal.name && resp.sucursal.name.length <= 25 ? resp.sucursal.name : 'LUXURY EVYS')
      localStorage.setItem('sucursal_name', sucursalName)
      if (themeConfig.app) themeConfig.app.title = sucursalName
      if (layoutConfig?.app) layoutConfig.app.title = sucursalName
    }
  } catch (e) {
    // Si falla o no hay conexión inmediata, mantiene el guardado en localStorage o LUXURY EVYS
  }
}

onMounted(() => {
  loadSucursalInfo()
})

// SECTION: Loading Indicator
const isFallbackStateActive = ref(false)
const refLoadingIndicator = ref(null)

watch([
  isFallbackStateActive,
  refLoadingIndicator,
], () => {
  if (isFallbackStateActive.value && refLoadingIndicator.value)
    refLoadingIndicator.value.fallbackHandle()
  if (!isFallbackStateActive.value && refLoadingIndicator.value)
    refLoadingIndicator.value.resolveHandle()
}, { immediate: true })

// !SECTION
const configStore = useConfigStore()

// ℹ️ Provide animation name for vertical nav collapse icon.
const verticalNavHeaderActionAnimationName = ref(null)

watch([
  () => configStore.isVerticalNavCollapsed,
  () => configStore.isAppRTL,
], val => {
  if (configStore.isAppRTL)
    verticalNavHeaderActionAnimationName.value = val[0] ? 'rotate-back-180' : 'rotate-180'
  else
    verticalNavHeaderActionAnimationName.value = val[0] ? 'rotate-180' : 'rotate-back-180'
}, { immediate: true })
</script>

<template>
  <VerticalNavLayout :nav-items="navItems">
    <!-- 👉 navbar -->
    <template #navbar="{ toggleVerticalOverlayNavActive }">
      <div class="d-flex h-100 align-center w-100">
        <IconBtn
          id="vertical-nav-toggle-btn"
          class="me-2 d-lg-none modern-hamburger-btn"
          @click="toggleVerticalOverlayNavActive(true)"
        >
          <VIcon
            icon="ri-menu-line"
            size="24"
          />
        </IconBtn>

        <!-- Brand logo on mobile/tablet when sidebar is collapsed -->
        <div class="d-flex align-center gap-x-2 d-lg-none">
          <VNodeRenderer :nodes="themeConfig.app.logo" />
          <span class="font-weight-bold text-white text-subtitle-1 tracking-wide d-none d-sm-inline">
            {{ themeConfig.app.title }}
          </span>
        </div>

        <VSpacer />

        <NavBarI18n
          v-if="themeConfig.app.i18n.enable && themeConfig.app.i18n.langConfig?.length"
          :languages="themeConfig.app.i18n.langConfig"
        />
        <NavbarThemeSwitcher class="me-2" />
        <UserProfile />
      </div>
    </template>

    <AppLoadingIndicator ref="refLoadingIndicator" />

    <!-- 👉 Pages -->
    <RouterView v-slot="{ Component }">
      <Suspense
        :timeout="0"
        @fallback="isFallbackStateActive = true"
        @resolve="isFallbackStateActive = false"
      >
        <Component :is="Component" />
      </Suspense>
    </RouterView>

    <!-- 👉 Footer -->
    <template #footer>
      <Footer />
    </template>

    <!-- 👉 Customizer -->
    <!-- <TheCustomizer /> -->

    <!-- 👉 Global Toast -->
    <GlobalToast />
  </VerticalNavLayout>
</template>

<style lang="scss">
@keyframes rotate-180 {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(180deg);
  }
}

@keyframes rotate-back-180 {
  from {
    transform: rotate(180deg);
  }

  to {
    transform: rotate(0deg);
  }
}

.modern-hamburger-btn {
  background: rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  border-radius: 10px !important;
  width: 42px !important;
  height: 42px !important;
  min-width: 42px !important;
  transition: all 0.2s ease !important;

  &:hover {
    background: rgba(255, 255, 255, 0.28) !important;
    transform: scale(1.05);
  }
}

.layout-vertical-nav {
  .nav-header {
    .header-action {
      animation-duration: 0.35s;
      animation-fill-mode: forwards;
      animation-name: v-bind(verticalNavHeaderActionAnimationName);
      transform: rotate(0deg);
    }
  }
}
</style>
 
 
