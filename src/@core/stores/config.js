import { storeToRefs } from 'pinia'
import { useTheme } from 'vuetify'
import { cookieRef, useLayoutConfigStore } from '@layouts/stores/config'
import { themeConfig } from '@themeConfig'

// SECTION Store
export const useConfigStore = defineStore('config', () => {
  // 👉 Theme
  const userPreferredColorScheme = usePreferredColorScheme()
  const cookieColorScheme = cookieRef('color-scheme', 'light')

  watch(userPreferredColorScheme, val => {
    if (val !== 'no-preference')
      cookieColorScheme.value = val
  }, { immediate: true })

  // Read saved theme with fallback: localStorage -> themeConfig default
  const getInitialTheme = () => {
    if (typeof window !== 'undefined') {
      try {
        const fromLocal = localStorage.getItem('app_theme') || localStorage.getItem('theme')
        if (fromLocal) return fromLocal
      } catch (e) {}
    }
    return themeConfig.app.theme
  }

  const theme = cookieRef('theme', getInitialTheme())

  // Ensure theme syncs to localStorage whenever changed
  watch(theme, newTheme => {
    if (typeof window !== 'undefined' && newTheme) {
      try {
        localStorage.setItem('app_theme', newTheme)
        localStorage.setItem('theme', newTheme)
      } catch (e) {}
    }
  }, { immediate: true })

  // 👉 isVerticalNavSemiDark
  const isVerticalNavSemiDark = cookieRef('isVerticalNavSemiDark', themeConfig.verticalNav.isVerticalNavSemiDark)

  // 👉 isVerticalNavSemiDark
  const skin = cookieRef('skin', themeConfig.app.skin)

  // ℹ️ We need to use `storeToRefs` to forward the state
  const { isLessThanOverlayNavBreakpoint, appContentWidth, navbarType, isNavbarBlurEnabled, appContentLayoutNav, isVerticalNavCollapsed, footerType, isAppRTL } = storeToRefs(useLayoutConfigStore())
  
  return {
    theme,
    isVerticalNavSemiDark,
    skin,

    // @layouts exports
    isLessThanOverlayNavBreakpoint,
    appContentWidth,
    navbarType,
    isNavbarBlurEnabled,
    appContentLayoutNav,
    isVerticalNavCollapsed,
    footerType,
    isAppRTL,
  }
})
// !SECTION
// SECTION Init
export const initConfigStore = () => {
  const userPreferredColorScheme = usePreferredColorScheme()
  const vuetifyTheme = useTheme()
  const configStore = useConfigStore()

  // Make sure theme matches localStorage if present
  if (typeof window !== 'undefined') {
    try {
      const savedTheme = localStorage.getItem('app_theme') || localStorage.getItem('theme')
      if (savedTheme && configStore.theme !== savedTheme) {
        configStore.theme = savedTheme
      }
    } catch (e) {}
  }

  watch([() => configStore.theme, userPreferredColorScheme], () => {
    const targetTheme = configStore.theme === 'system'
      ? userPreferredColorScheme.value === 'dark'
        ? 'dark'
        : 'light'
      : configStore.theme

    vuetifyTheme.global.name.value = targetTheme

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', targetTheme)
      document.body.setAttribute('data-theme', targetTheme)
    }
  }, { immediate: true })

  onMounted(() => {
    if (configStore.theme === 'system')
      vuetifyTheme.global.name.value = userPreferredColorScheme.value
  })
}
// !SECTION
