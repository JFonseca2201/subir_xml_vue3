<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({
  activeTab: {
    type: String,
    default: '',
  },
})

const router = useRouter()
const route = useRoute()

const currentDateDisplay = computed(() => {
  try {
    const now = new Date()
    const options = { weekday: 'short', day: 'numeric', month: 'short' }
    const formatted = new Intl.DateTimeFormat('es-EC', options).format(now)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch (e) {
    return ''
  }
})

const navItems = [
  {
    id: 'dashboard',
    title: 'Operaciones',
    description: 'Resumen y movimientos',
    icon: 'ri-dashboard-3-line',
    route: '/operations',
  },
  {
    id: 'socios',
    title: 'Socios',
    description: 'Aportes de capital',
    icon: 'ri-user-star-line',
    route: '/aportes',
  },
  {
    id: 'nomina',
    title: 'Nómina',
    description: 'Pagos y adelantos',
    icon: 'ri-wallet-3-line',
    route: '/finanzas/employee-expenses',
  },
  {
    id: 'transferencias',
    title: 'Transferencias',
    description: 'Cuentas y cajas',
    icon: 'ri-arrow-left-right-line',
    route: '/transfers',
  },
]

const isCurrentActive = item => {
  if (props.activeTab && props.activeTab === item.id) return true
  if (route.path === item.route || (item.route !== '/operations' && route.path.startsWith(item.route))) return true
  if (item.id === 'dashboard' && (route.path === '/operations' || route.path === '/finanzas/operaciones')) return true

  return false
}

const navigateTo = itemRoute => {
  if (route.path !== itemRoute) {
    router.push(itemRoute)
  }
}
</script>

<template>
  <!-- Encabezado Principal de Sistema (Estándar de la aplicación) -->
  <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4 operations-system-header">
    <div>
      <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
        <VAvatar
          size="42"
          color="primary"
          variant="tonal"
          rounded="lg"
          class="me-3"
        >
          <VIcon icon="ri-exchange-funds-line" size="26" />
        </VAvatar>
        Gestión de Operaciones
      </h1>
      <p class="text-medium-emphasis mb-0">
        Flujo financiero, movimientos diarios y control operativo
      </p>
    </div>

    <!-- Navegación por Pestañas del Sistema de Operaciones alineada a la derecha -->
    <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
      <nav
        class="operations-browser-tabs operations-tabbed-container operations-continuous-menu operations-header-nav-menu operations-segmented-container d-flex align-end"
        role="tablist"
        aria-label="Navegación de Operaciones"
      >
        <template v-for="(item, index) in navItems" :key="item.id">
          <!-- Divisor vertical sutil estilo pestañas de navegador (solo entre pestañas inactivas) -->
          <span
            v-if="index > 0 && !isCurrentActive(item) && !isCurrentActive(navItems[index - 1])"
            class="operations-tab-divider operations-tab-separator operations-menu-separator"
            aria-hidden="true"
          />

          <!-- Pestaña (Tab) -->
          <button
            type="button"
            role="tab"
            :aria-selected="isCurrentActive(item)"
            class="operations-browser-tab operations-tab-item operations-menu-item operations-header-nav-item segmented-tab-btn"
            :class="{ 'is-active': isCurrentActive(item) }"
            @click="navigateTo(item.route)"
          >
            <VIcon :icon="item.icon" size="16" class="operations-tab-icon operations-menu-icon tab-icon" />
            <span class="operations-tab-label operations-menu-label tab-label">{{ item.title }}</span>
          </button>
        </template>
      </nav>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Los estilos de este encabezado y sus pestañas se encuentran centralizados en src/assets/styles/inventory.scss (Sección 12)
</style>
