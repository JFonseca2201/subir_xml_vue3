import { breakpointsVuetifyV3 } from '@vueuse/core'
import { VIcon } from 'vuetify/components/VIcon'
import { defineThemeConfig } from '@core'
import { Skins } from '@core/enums'
import VerticalNavHeaderArrow from '@images/svg/vertical-nav-header-arrow.svg'
import logoPng from '@images/logo/logo_e.png'
import { AppContentLayoutNav, ContentWidth, FooterType, NavbarType } from '@layouts/enums'

const getCleanTitle = () => {
  if (typeof window === 'undefined') return 'LUXURY EVYS'
  const stored = localStorage.getItem('sucursal_name')
  if (!stored) return 'LUXURY EVYS'
  if (stored.length > 20) {
    if (stored.toUpperCase().includes('LUXURY EVYS')) return 'LUXURY EVYS'
    return stored.substring(0, 18)
  }
  return stored
}

export const { themeConfig, layoutConfig } = defineThemeConfig({
  app: {
    title: getCleanTitle(),

    // Logo oficial de la compañía (Favicon en contenedor de alto contraste)
    logo: h('div', {
      class: 'app-logo-badge-container',
      style: 'display: flex; align-items: center; justify-content: center; background: #ffffff; width: 44px; height: 44px; min-width: 44px; border-radius: 12px; padding: 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); flex-shrink: 0;',
    }, [
      h('img', {
        src: logoPng,
        alt: 'Luxury Evys Favicon',
        style: 'width: 100%; height: 100%; object-fit: contain; display: block;',
      }),
    ]),
    contentWidth: ContentWidth.Boxed,
    contentLayoutNav: AppContentLayoutNav.Vertical,
    overlayNavFromBreakpoint: breakpointsVuetifyV3.lg - 1, // 1 for matching with vuetify breakpoint. Docs: https://next.vuetifyjs.com/en/features/display-and-platform/
    i18n: {
      enable: false,
      defaultLocale: 'en',
      langConfig: [
        {
          label: 'English',
          i18nLang: 'en',
          isRTL: false,
        },
        {
          label: 'French',
          i18nLang: 'fr',
          isRTL: false,
        },
        {
          label: 'Arabic',
          i18nLang: 'ar',
          isRTL: true,
        },
      ],
    },
    theme: 'system',
    skin: Skins.Default,
    iconRenderer: VIcon,
  },
  navbar: {
    type: NavbarType.Sticky,
    navbarBlur: true,
  },
  footer: { type: FooterType.Static },
  verticalNav: {
    isVerticalNavCollapsed: false,
    defaultNavItemIconProps: { icon: 'ri-circle-fill' },
    isVerticalNavSemiDark: false,
  },
  horizontalNav: {
    type: 'sticky',
    transition: 'slide-y-reverse-transition',
    popoverOffset: 4,
  },

  /*
    // ℹ️  In below Icons section, you can specify icon for each component. Also you can use other props of v-icon component like `color` and `size` for each icon.
    // Such as: chevronDown: { icon: 'ri-arrow-down-s-line', color:'primary', size: '24' },
    */
  icons: {
    chevronDown: { icon: 'ri-arrow-down-s-line' },
    chevronRight: { icon: 'ri-arrow-right-s-line' },
    close: { icon: 'ri-close-line' },
    verticalNavPinned: { icon: h(VerticalNavHeaderArrow) },
    verticalNavUnPinned: { icon: h(VerticalNavHeaderArrow) },
    sectionTitlePlaceholder: { icon: 'ri-subtract-line' },
  },
})
