<script>
import { VerticalNav } from '@layouts/components'
import { useLayoutConfigStore } from '@layouts/stores/config'

export default defineComponent({
  props: {
    navItems: {
      type: Array,
      required: true,
    },
    verticalNavAttrs: {
      type: Object,
      default: () => ({}),
    },
  },
  setup(props, { slots }) {
    const { width: windowWidth } = useWindowSize()
    const configStore = useLayoutConfigStore()
    const isOverlayNavActive = ref(false)
    const isLayoutOverlayVisible = ref(false)
    const toggleIsOverlayNavActive = useToggle(isOverlayNavActive)


    // ℹ️ This is alternative to below two commented watcher
    // We want to show overlay if overlay nav is visible and want to hide overlay if overlay is hidden and vice versa.
    syncRef(isOverlayNavActive, isLayoutOverlayVisible)

    // watch(isOverlayNavActive, value => {
    //   // Sync layout overlay with overlay nav
    //   isLayoutOverlayVisible.value = value
    // })
    // watch(isLayoutOverlayVisible, value => {
    //   // If overlay is closed via click, close hide overlay nav
    //   if (!value) isOverlayNavActive.value = false
    // })
    // ℹ️ Hide overlay if user open overlay nav in <md and increase the window width without closing overlay nav
    watch(windowWidth, () => {
      if (!configStore.isLessThanOverlayNavBreakpoint && isLayoutOverlayVisible.value)
        isLayoutOverlayVisible.value = false
    })
    
    return () => {
      const verticalNavAttrs = toRef(props, 'verticalNavAttrs')
      const { wrapper: verticalNavWrapper, wrapperProps: verticalNavWrapperProps, ...additionalVerticalNavAttrs } = verticalNavAttrs.value


      // 👉 Vertical nav
      const verticalNav = h(VerticalNav, { isOverlayNavActive: isOverlayNavActive.value, toggleIsOverlayNavActive, navItems: props.navItems, ...additionalVerticalNavAttrs }, {
        'nav-header': () => slots['vertical-nav-header']?.(),
        'before-nav-items': () => slots['before-vertical-nav-items']?.(),
        'after-nav-items': () => slots['after-nav-items']?.(),
      })


      // 👉 Navbar
      const navbar = h('header', { class: ['layout-navbar', { 'navbar-blur': configStore.isNavbarBlurEnabled }] }, [
        h('div', { class: 'navbar-content-container' }, slots.navbar?.({
          toggleVerticalOverlayNavActive: toggleIsOverlayNavActive,
          isOverlayNavActive: isOverlayNavActive.value,
        })),
      ])


      // 👉 Content area
      const main = h('main', { class: 'layout-page-content' }, h('div', { class: 'page-content-container' }, slots.default?.()))


      // 👉 Footer
      const footer = h('footer', { class: 'layout-footer' }, [
        h('div', { class: 'footer-content-container' }, slots.footer?.()),
      ])


      // 👉 Overlay
      const layoutOverlay = h('div', {
        class: ['layout-overlay', { visible: isLayoutOverlayVisible.value }],
        onClick: () => { isLayoutOverlayVisible.value = !isLayoutOverlayVisible.value },
      })

      return h('div', { class: ['layout-wrapper', ...configStore._layoutClasses] }, [
        navbar,
        verticalNavWrapper ? h(verticalNavWrapper, verticalNavWrapperProps, { default: () => verticalNav }) : verticalNav,
        h('div', { class: 'layout-content-wrapper' }, [
          main,
          footer,
        ]),
        layoutOverlay,
      ])
    }
  },
})
</script>

<style lang="scss">
@use "@configured-variables" as variables;
@use "@layouts/styles/placeholders";
@use "@layouts/styles/mixins";

.layout-wrapper.layout-nav-type-vertical {
  block-size: 100%;

  // 1. Full-width top Navbar
  > .layout-navbar,
  .layout-navbar {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    inset-block-start: 0 !important;
    inset-inline-start: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;
    inline-size: 100vw !important;
    height: variables.$layout-vertical-nav-navbar-height !important;
    block-size: variables.$layout-vertical-nav-navbar-height !important;
    z-index: 1050 !important;

    .navbar-content-container {
      width: 100% !important;
      max-width: 100% !important;
      inline-size: 100% !important;
      height: 100% !important;
      block-size: 100% !important;
      display: flex;
      align-items: center;
      padding-inline: 1.25rem !important;
    }
  }

  // 2. Sidebar starts directly BELOW the navbar
  .layout-vertical-nav {
    top: variables.$layout-vertical-nav-navbar-height !important;
    inset-block-start: variables.$layout-vertical-nav-navbar-height !important;
    height: calc(100vh - #{variables.$layout-vertical-nav-navbar-height}) !important;
    height: calc(100dvh - #{variables.$layout-vertical-nav-navbar-height}) !important;
    block-size: calc(100vh - #{variables.$layout-vertical-nav-navbar-height}) !important;
    z-index: 1040 !important;
    border-top: 1px solid rgba(255, 255, 255, 0.08) !important;

    // Eliminar cabecera vacía en el sidebar ya que la marca está en el Navbar superior
    .nav-header {
      display: none !important;
      height: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
    }

    // Desactivar completamente la sombra/degradado flotante sobre los ítems
    .vertical-nav-items-shadow {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      height: 0 !important;
    }

    // Efecto de sombra delimitado estrictamente al borde superior de la cabecera del menú al desplazarse
    &.scrolled {
      box-shadow: 4px 0 28px rgba(79, 84, 229, 0.28), inset 0 4px 6px -4px rgba(0, 0, 0, 0.45) !important;
    }

    &.overlay-nav {
      top: variables.$layout-vertical-nav-navbar-height !important;
      inset-block-start: variables.$layout-vertical-nav-navbar-height !important;
      height: calc(100vh - #{variables.$layout-vertical-nav-navbar-height}) !important;
      height: calc(100dvh - #{variables.$layout-vertical-nav-navbar-height}) !important;
      block-size: calc(100vh - #{variables.$layout-vertical-nav-navbar-height}) !important;
    }
  }

  // 3. Layout overlay on mobile begins below navbar
  .layout-overlay {
    position: fixed;
    top: variables.$layout-vertical-nav-navbar-height !important;
    inset-block-start: variables.$layout-vertical-nav-navbar-height !important;
    height: calc(100vh - #{variables.$layout-vertical-nav-navbar-height}) !important;
    block-size: calc(100vh - #{variables.$layout-vertical-nav-navbar-height}) !important;
    z-index: 1035 !important;
    background-color: rgb(0 0 0 / 60%);
    cursor: pointer;
    inset-inline: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease-in-out;
    will-change: transform;

    &.visible {
      opacity: 1;
      pointer-events: auto;
    }
  }

  // 4. Content area starts below the navbar and respects sidebar width on desktop
  .layout-content-wrapper {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-block-size: calc(100dvh - #{variables.$layout-vertical-nav-navbar-height});
    padding-top: 0 !important;
    padding-block-start: 0 !important;
    transition: padding-inline-start 0.2s ease-in-out;
    will-change: padding-inline-start;

    @media screen and (min-width: 1280px) {
      padding-inline-start: variables.$layout-vertical-nav-width;
    }
  }

  // Adjust right column pl when vertical nav is collapsed
  &.layout-vertical-nav-collapsed .layout-content-wrapper {
    padding-inline-start: variables.$layout-vertical-nav-collapsed-width !important;
  }

  // 👉 Footer
  .layout-footer {
    @include mixins.boxed-content;
  }
}
</style>
