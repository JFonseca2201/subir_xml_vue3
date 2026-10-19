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
import NavbarThemeSwitcher from '@/layouts/components/NavbarThemeSwitcher.vue'
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

const isMobileDrawerOpen = ref(false)

// Computed para saber si el menú lateral está visible en pantalla (desktop o móvil)
const isSidebarVisible = computed(() => {
  if (layoutConfigStore.isLessThanOverlayNavBreakpoint) {
    return isMobileDrawerOpen.value
  }
  return !layoutConfigStore.isVerticalNavCollapsed
})

// Manejador inteligente del toggle de navegación: cuando está abierto y se aplasta la X, DESAPARECE!
const handleNavToggle = toggleVerticalOverlayNavActive => {
  if (layoutConfigStore.isLessThanOverlayNavBreakpoint) {
    isMobileDrawerOpen.value = !isMobileDrawerOpen.value
    toggleVerticalOverlayNavActive(isMobileDrawerOpen.value)
  } else {
    // En desktop: alterna entre visible y completamente desaparecido
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
    <!-- 👉 navbar: Full-Width Top Bar con Identidad Oficial Luxury Evys -->
    <template #navbar="{ toggleVerticalOverlayNavActive, isOverlayNavActive }">
      <div class="d-flex h-100 align-center w-100 px-1">
        <!-- 1. Botón Menú Hamburguesa / X al principio a la izquierda -->
        <button
          id="vertical-nav-toggle-btn"
          type="button"
          class="navbar-hamburger-btn d-flex align-center justify-center me-3"
          :title="isSidebarVisible ? 'Ocultar menú lateral (cerrar con X)' : 'Mostrar menú lateral (abrir)'"
          :aria-label="isSidebarVisible ? 'Cerrar Menú Lateral' : 'Abrir Menú Lateral'"
          @click="handleNavToggle(toggleVerticalOverlayNavActive)"
        >
          <!-- Si el menú lateral está visible: se muestra la X [ri-close-line]. Al aplastarla, DESAPARECE el menú lateral! -->
          <!-- Si el menú lateral está desaparecido: se muestra [ri-menu-2-line]. Al aplastarla, APARECE el menú lateral! -->
          <VIcon
            :icon="isSidebarVisible ? 'ri-close-line' : 'ri-menu-2-line'"
            size="22"
          />
        </button>

        <!-- 2. Identidad y Marca Prominente "LUXURY EVYS" (Desaparece en móvil, visible en escritorio) -->
        <RouterLink
          to="/"
          class="d-none d-md-flex align-center gap-x-3 text-decoration-none navbar-brand-link me-4"
        >
          <!-- Logotipo / Sello Oficial de la Empresa -->
          <div class="navbar-brand-seal-badge">
            <img
              :src="logoPng"
              alt="Luxury Evys Sello Oficial"
              class="navbar-brand-logo-img"
            >
          </div>

          <!-- Nombre de la Empresa y Sello de Calidad -->
          <div class="d-flex flex-column justify-center brand-text-container">
            <div class="d-flex align-center gap-2">
              <span class="navbar-brand-title font-weight-black tracking-wider text-uppercase">
                LUXURY EVYS
              </span>
              <span class="navbar-brand-pill d-none d-lg-inline-flex">
                OFICIAL
              </span>
            </div>
            <div class="navbar-brand-subtitle d-none d-lg-flex align-center gap-1">
              <span class="brand-status-dot" />
              <span class="font-weight-medium">{{ sucursalName }}</span>
            </div>
          </div>
        </RouterLink>

        <!-- En responsive móvil: título de texto limpio y compacto sin el sello para evitar sobrecarga -->
        <span class="d-md-none text-subtitle-1 font-weight-black text-white tracking-wider">
          LUXURY EVYS
        </span>

        <VSpacer />

        <!-- Herramientas y Perfil en Navbar -->
        <div class="d-flex align-center gap-2">
          <NavBarI18n
            v-if="themeConfig.app.i18n.enable && themeConfig.app.i18n.langConfig?.length"
            :languages="themeConfig.app.i18n.langConfig"
          />
          <NavbarThemeSwitcher class="me-1" />
          <UserProfile />
        </div>
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

.navbar-brand-title {
  font-size: 1.22rem;
  line-height: 1.15;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

.navbar-brand-pill {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.95), #7367f0);
  color: #ffffff;
  font-size: 0.62rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 5px;
  letter-spacing: 0.08em;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.35);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.navbar-brand-subtitle {
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.73rem;
  line-height: 1.2;
  margin-top: 1px;
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
</style>
