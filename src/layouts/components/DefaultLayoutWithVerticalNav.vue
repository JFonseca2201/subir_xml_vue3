<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import navItems from '@/navigation/vertical'
import { useConfigStore } from '@core/stores/config'
import { useLayoutConfigStore } from '@layouts/stores/config'
import { themeConfig, layoutConfig } from '@themeConfig'
import { $api } from '@/utils/api'
import { usePermissions, refreshPermissionsUser } from '@/composables/usePermissions'
import logoPng from '@images/logo/logo_e.png'

// Components
import Footer from '@/layouts/components/Footer.vue'
import UserProfile from '@/layouts/components/UserProfile.vue'
import NavBarI18n from '@core/components/I18n.vue'

// @layouts plugin
import { VerticalNavLayout } from '@layouts'

const sucursalName = ref(localStorage.getItem('sucursal_name') || 'LUXURY EVYS')

// Cargar dinámicamente nombre de la sucursal registrada
const loadSucursalInfo = async () => {
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    const resp = await $api('sucursales/1', {
      method: 'GET',
    })

    if (resp && resp.sucursal) {
      const name = resp.sucursal.trade_name || (resp.sucursal.name && resp.sucursal.name.length <= 25 ? resp.sucursal.name : 'LUXURY EVYS')

      sucursalName.value = name
      localStorage.setItem('sucursal_name', name)
      if (themeConfig.app) themeConfig.app.title = name
      if (layoutConfig?.app) layoutConfig.app.title = name
    }
  } catch (e) {
    // Si falla o no hay conexión inmediata, mantiene el guardado en localStorage o LUXURY EVYS
  }
}

// Cargar dinámicamente datos actualizados del usuario autenticado
const loadUserInfo = async () => {
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    const meUser = await $api('auth/me', { method: 'POST' })
    if (meUser && meUser.id) {
      refreshPermissionsUser(meUser)
    }
  } catch (e) {
    //
  }
}

onMounted(() => {
  loadSucursalInfo()
  loadUserInfo()
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

const configStore = useConfigStore()
const layoutConfigStore = useLayoutConfigStore()

// Manejador inteligente del toggle de navegación: abre/cierra drawer en móvil y colapsa/expande en desktop
const handleNavToggle = (toggleVerticalOverlayNavActive, isOverlayNavActive) => {
  if (layoutConfigStore.isLessThanOverlayNavBreakpoint) {
    toggleVerticalOverlayNavActive(!isOverlayNavActive)
  } else {
    layoutConfigStore.isVerticalNavCollapsed = !layoutConfigStore.isVerticalNavCollapsed
  }
}

const { can, canAny } = usePermissions()

// Filtrar ítems del menú lateral según los permisos del usuario
const filteredNavItems = computed(() => {
  // 1. Filtrar elementos individuales y grupos según permisos del usuario
  const cleanItems = navItems
    .map(item => {
      if (item.heading) {
        if (item.permissions && Array.isArray(item.permissions)) {
          if (!canAny(item.permissions)) return null
        } else if (item.permission && !can(item.permission)) {
          return null
        }
        
        return { ...item }
      }

      // Si es un grupo con subelementos
      if (item.children && Array.isArray(item.children)) {
        const visibleChildren = item.children.filter(child => {
          return !child.permission || can(child.permission)
        })

        if (visibleChildren.length === 0) {
          return null
        }

        return {
          ...item,
          children: visibleChildren,
        }
      }

      // Si es un ítem individual
      if (item.permission && !can(item.permission)) {
        return null
      }

      return { ...item }
    })
    .filter(Boolean)

  // 2. Filtrar encabezados (headings) para ocultar los que no tengan elementos visibles debajo
  const result = []
  for (let i = 0; i < cleanItems.length; i++) {
    const item = cleanItems[i]
    if (item.heading) {
      let hasVisibleItemBelow = false
      for (let j = i + 1; j < cleanItems.length; j++) {
        if (cleanItems[j].heading) break
        hasVisibleItemBelow = true
      }
      if (hasVisibleItemBelow) {
        result.push(item)
      }
    } else {
      result.push(item)
    }
  }

  return result
})
</script>

<template>
  <VerticalNavLayout :nav-items="filteredNavItems">
    <!-- 👉 navbar: Full-Width Top Bar con Identidad Oficial Luxury Evys Centrada -->
    <template #navbar="{ toggleVerticalOverlayNavActive, isOverlayNavActive }">
      <div class="navbar-header-wrapper d-flex h-100 align-center w-100 px-1">
        <!-- 1. Columna Izquierda: Botón Menú Hamburguesa -->
        <div class="navbar-left-section">
          <button
            id="vertical-nav-toggle-btn"
            type="button"
            class="navbar-hamburger-btn d-flex align-center justify-center"
            :title="layoutConfigStore.isLessThanOverlayNavBreakpoint
              ? (isOverlayNavActive ? 'Cerrar menú' : 'Abrir menú')
              : (layoutConfigStore.isVerticalNavCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral')"
            :aria-label="isOverlayNavActive ? 'Cerrar Menú' : 'Alternar Menú'"
            @click="handleNavToggle(toggleVerticalOverlayNavActive, isOverlayNavActive)"
          >
            <!-- En responsive móvil: 'ri-close-line' [X] cuando está abierto, 'ri-menu-2-line' [☰] cuando está cerrado -->
            <!-- En desktop: 'ri-menu-unfold-line' si está colapsado, 'ri-menu-2-line' si está expandido -->
            <VIcon
              :icon="layoutConfigStore.isLessThanOverlayNavBreakpoint
                ? (isOverlayNavActive ? 'ri-close-line' : 'ri-menu-2-line')
                : (layoutConfigStore.isVerticalNavCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-2-line')"
              size="22"
            />
          </button>
        </div>

        <!-- 2. Columna Central: Marca Centrada Horizontalmente (Logo en Tablet/Desktop + LUXURY EVYS + Subtítulo) -->
        <div class="navbar-center-section">
          <RouterLink
            to="/"
            class="d-flex align-center gap-x-3 text-decoration-none navbar-brand-link"
          >
            <!-- Logotipo / Sello Oficial: Visible a partir de Tablet (>= 600px), Oculto en Celulares (iPhone 13 Pro Max, etc.) -->
            <div class="navbar-brand-seal-badge d-none d-sm-flex">
              <img
                :src="logoPng"
                alt="Luxury Evys Sello Oficial"
                class="navbar-brand-logo-img"
              >
            </div>

            <!-- Nombre de la Empresa y Sucursal -->
            <div class="d-flex flex-column justify-center align-center align-sm-start brand-text-container">
              <span class="navbar-brand-title font-weight-black tracking-wider text-uppercase">
                LUXURY EVYS
              </span>
              <div class="navbar-brand-subtitle d-flex align-center gap-1">
                <span class="brand-status-dot" />
                <span class="font-weight-medium text-white" style="color: #ffffff !important;">{{ sucursalName }}</span>
              </div>
            </div>
          </RouterLink>
        </div>

        <!-- 3. Columna Derecha: Herramientas, Idioma y Perfil de Usuario con Notificaciones -->
        <div class="navbar-right-section d-flex align-center justify-end gap-2">
          <NavBarI18n
            v-if="themeConfig.app.i18n.enable && themeConfig.app.i18n.langConfig?.length"
            :languages="themeConfig.app.i18n.langConfig"
          />
          <UserProfile />
        </div>
      </div>
    </template>

    <!-- 👉 after-nav-items: Botón discreto inferior para colapsar/expandir en desktop sin estorbar arriba -->
    <template #after-nav-items>
      <div class="sidebar-collapse-footer d-none d-lg-flex align-center justify-end px-3 py-2">
        <IconBtn
          size="small"
          class="sidebar-footer-toggle-btn"
          :title="layoutConfigStore.isVerticalNavCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'"
          aria-label="Colapsar Menú Lateral"
          @click="layoutConfigStore.isVerticalNavCollapsed = !layoutConfigStore.isVerticalNavCollapsed"
        >
          <VIcon
            :icon="layoutConfigStore.isVerticalNavCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'"
            size="18"
          />
        </IconBtn>
      </div>
    </template>

    <AppLoadingIndicator ref="refLoadingIndicator" />

    <!-- 👉 Pages -->
    <RouterView v-slot="{ Component, route }">
      <KeepAlive :max="25">
        <Component
          :is="Component"
          :key="route.fullPath"
        />
      </KeepAlive>
    </RouterView>

    <!-- 👉 Footer -->
    <template #footer>
      <Footer />
    </template>
  </VerticalNavLayout>
</template>

<style lang="scss">
.navbar-hamburger-btn {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  border-radius: 12px !important;
  width: 42px !important;
  height: 42px !important;
  min-width: 42px !important;
  cursor: pointer;
  outline: none;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);

  &:hover {
    background: rgba(255, 255, 255, 0.2) !important;
    border-color: rgba(255, 255, 255, 0.35) !important;
    transform: scale(1.08);
    box-shadow: 0 4px 16px rgba(var(--v-theme-primary), 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2);
  }

  &:active {
    transform: scale(0.95);
  }

  .v-icon {
    color: #ffffff !important;
    transition: transform 0.25s ease;
  }
}

.navbar-brand-link {
  color: inherit;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.95;
  }
}

.navbar-brand-seal-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffffff 0%, #f4f5f8 100%);
  width: 44px;
  height: 44px;
  min-width: 44px;
  border-radius: 12px;
  padding: 3px;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(212, 175, 55, 0.25);
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;

  &:hover {
    transform: scale(1.06);
    box-shadow: 0 6px 20px rgba(var(--v-theme-primary), 0.4), 0 0 0 2px rgba(255, 255, 255, 0.4);
  }
}

.navbar-brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.navbar-header-wrapper {
  position: relative;
  width: 100%;
}

.navbar-left-section {
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.navbar-center-section {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 0.5rem;
}

.navbar-right-section {
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.navbar-brand-title {
  font-size: 1.22rem;
  line-height: 1.15;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

.navbar-brand-subtitle {
  color: #ffffff !important;
  font-size: 0.74rem;
  line-height: 1.2;
  margin-top: 1px;

  span,
  * {
    color: #ffffff !important;
  }
}

.brand-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  display: inline-block;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .navbar-left-section {
    flex: 0 0 auto !important;
  }

  .navbar-right-section {
    flex: 0 0 auto !important;
  }

  .navbar-center-section {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    padding: 0 6px !important;
    overflow: hidden !important;
  }

  .brand-text-container {
    min-width: 0 !important;
    overflow: hidden !important;
  }
}

// Celulares (como iPhone 13 Pro Max a 428px de ancho): Ocultar el logo por completo
@media (max-width: 600px) {
  .navbar-brand-seal-badge {
    display: none !important;
  }

  .navbar-brand-title {
    font-size: 1.05rem !important;
    letter-spacing: 0.06em !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .navbar-brand-subtitle {
    font-size: 0.68rem !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 200px !important;
  }
}

// Tablets (pantallas entre 601px y 960px): Mostrar el icono con dimensiones adecuadas
@media (min-width: 601px) and (max-width: 960px) {
  .navbar-brand-seal-badge {
    display: flex !important;
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
  }

  .navbar-brand-title {
    font-size: 1.1rem !important;
  }
}

// Menú lateral izquierdo con el color exacto y degradado de la barra superior (Navbar)
.layout-vertical-nav,
.layout-nav-type-vertical .layout-vertical-nav,
.v-navigation-drawer.layout-vertical-nav {
  background: var(--bg-sidebar, var(--bg-header)) !important;
  background-color: transparent !important;
  border-right: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 4px 0 25px rgba(0, 0, 0, 0.18) !important;

  .vertical-nav-items-shadow {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
    height: 0 !important;
  }

  .v-navigation-drawer__content,
  .nav-items {
    background: transparent !important;
  }

  .nav-header {
    background: transparent !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;

    .app-logo-title {
      color: #ffffff !important;
    }
  }

  // Títulos de sección (COMERCIAL, FINANZAS, SERVICIOS, INVENTARIO, etc.)
  .nav-section-title {
    opacity: 1 !important;

    .title-text {
      color: #ffffff !important;
      opacity: 0.92 !important;
      font-weight: 800 !important;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25) !important;
      letter-spacing: 0.12em !important;
      text-transform: uppercase !important;

      &::before,
      &::after {
        border-color: rgba(255, 255, 255, 0.45) !important;
        border-block-end-color: rgba(255, 255, 255, 0.45) !important;
      }
    }
  }

  // Enlaces de navegación e iconos
  .nav-link a,
  .nav-group-label {
    color: #ffffff !important;

    *,
    span,
    .nav-item-title,
    .nav-item-icon,
    .nav-group-arrow,
    .v-icon {
      color: #ffffff !important;
      fill: #ffffff !important;
      opacity: 1 !important;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.18) !important;
      color: #ffffff !important;

      *,
      span,
      .nav-item-title,
      .nav-item-icon,
      .nav-group-arrow,
      .v-icon {
        color: #ffffff !important;
        fill: #ffffff !important;
      }
    }
  }

  // Submenús / Hijos de grupos
  .nav-group.open > .nav-group-label {
    background: rgba(255, 255, 255, 0.14) !important;
    color: #ffffff !important;

    *,
    span,
    .nav-item-title,
    .nav-item-icon,
    .nav-group-arrow,
    .v-icon {
      color: #ffffff !important;
      fill: #ffffff !important;
    }
  }

  .nav-group-children {
    border-left: 1.5px solid rgba(255, 255, 255, 0.35) !important;

    .nav-link a {
      color: rgba(255, 255, 255, 0.92) !important;

      *,
      span,
      .nav-item-icon,
      .nav-item-title {
        color: rgba(255, 255, 255, 0.92) !important;
        fill: rgba(255, 255, 255, 0.92) !important;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.16) !important;
        color: #ffffff !important;

        *,
        span,
        .nav-item-icon,
        .nav-item-title {
          color: #ffffff !important;
          fill: #ffffff !important;
        }
      }
    }
  }

  // Elemento activo seleccionado (adaptable a cada tema)
  .nav-link > a.router-link-active,
  .nav-link > a.router-link-exact-active,
  .nav-link.router-link-active > a,
  .nav-link.router-link-exact-active > a,
  .v-list-item--active {
    background: var(--bg-active-item, #ffffff) !important;
    color: var(--text-active, #5C61E6) !important;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18) !important;
    border: none !important;

    *,
    span,
    .nav-item-icon,
    .nav-item-title,
    .v-icon {
      color: var(--text-active, #5C61E6) !important;
      fill: var(--text-active, #5C61E6) !important;
      font-weight: 800 !important;
      -webkit-text-fill-color: var(--text-active, #5C61E6) !important;
    }
  }
}

.sidebar-collapse-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.15) !important;
  margin-top: auto;
  min-height: 40px;
}

.sidebar-footer-toggle-btn {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.12) !important;
  transition: all 0.2s ease;

  .v-icon {
    color: #ffffff !important;
    fill: #ffffff !important;
  }

  &:hover {
    color: #ffffff !important;
    background: rgba(255, 255, 255, 0.22) !important;
  }
}
</style>
