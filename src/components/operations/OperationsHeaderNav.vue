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
  <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-4 mb-md-6 gap-3 gap-md-4 operations-system-header">
    <div>
      <h1 class="text-h5 text-sm-h4 font-weight-bold mb-1 d-flex align-center">
        <VAvatar
          size="38"
          size-sm="42"
          color="primary"
          variant="tonal"
          rounded="lg"
          class="me-2 me-sm-3"
        >
          <VIcon
            icon="ri-exchange-funds-line"
            size="22"
            size-sm="26"
          />
        </VAvatar>
        Gestión de Operaciones
      </h1>
      <p class="text-medium-emphasis mb-0 d-none d-sm-block">
        Flujo financiero, movimientos diarios y control operativo
      </p>
    </div>

    <!-- Navegación Escritorio (Browser Tabs) -->
    <div class="d-none d-md-flex align-self-md-center">
      <nav
        class="operations-browser-tabs operations-tabbed-container operations-continuous-menu operations-header-nav-menu operations-segmented-container d-flex align-end flex-nowrap"
        role="tablist"
        aria-label="Navegación de Operaciones"
      >
        <template
          v-for="(item, index) in navItems"
          :key="item.id"
        >
          <span
            v-if="index > 0 && !isCurrentActive(item) && !isCurrentActive(navItems[index - 1])"
            class="operations-tab-divider operations-tab-separator operations-menu-separator"
            aria-hidden="true"
          />

          <button
            type="button"
            role="tab"
            :aria-selected="isCurrentActive(item)"
            class="operations-browser-tab operations-tab-item operations-menu-item operations-header-nav-item segmented-tab-btn"
            :class="{ 'is-active': isCurrentActive(item) }"
            @click="navigateTo(item.route)"
          >
            <VIcon
              :icon="item.icon"
              size="16"
              class="operations-tab-icon operations-menu-icon tab-icon"
            />
            <span class="operations-tab-label operations-menu-label tab-label">{{ item.title }}</span>
          </button>
        </template>
      </nav>
    </div>

    <!-- Navegación Móvil (Grid 2x2 elegante y compacto, 100% responsive sin scroll) -->
    <div class="w-100 d-grid d-md-none operations-mobile-nav-grid">
      <button
        v-for="item in navItems"
        :key="item.id"
        type="button"
        class="operations-mobile-nav-btn d-flex align-center justify-center gap-2"
        :class="{ 'is-active': isCurrentActive(item) }"
        @click="navigateTo(item.route)"
      >
        <VIcon
          :icon="item.icon"
          size="16"
        />
        <span>{{ item.title }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.operations-mobile-nav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  width: 100%;
  background-color: #eef2f7;
  padding: 5px;
  border-radius: 12px;
  border: 1px solid #d5dee9;
}

.operations-mobile-nav-btn {
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &.is-active {
    background-color: #ffffff;
    color: #4f46e5;
    font-weight: 700;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
}
</style>
