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
  if (item.id === 'dashboard' && route.path === '/operations') return true

  return false
}

const navigateTo = itemRoute => {
  if (route.path !== itemRoute) {
    router.push(itemRoute)
  }
}
</script>

<template>
  <VCard class="mb-5 rounded-2xl border elevation-0 operations-unified-header">
    <div class="header-gradient-accent" />
    <div class="d-flex flex-column flex-lg-row justify-space-between align-start align-lg-center pa-4 pa-sm-5 gap-4 position-relative">
      <!-- Encabezado Principal -->
      <div class="d-flex align-center gap-3">
        <div class="header-icon-wrapper">
          <VAvatar
            color="primary"
            variant="elevated"
            rounded="xl"
            size="52"
            class="header-main-avatar elevation-2"
          >
            <VIcon
              icon="ri-exchange-funds-line"
              size="30"
              color="white"
            />
          </VAvatar>
          <span class="header-pulse-beacon" />
        </div>

        <div>
          <div class="d-flex align-center flex-wrap gap-2">
            <h1 class="text-h5 font-weight-bold text-slate-900 mb-0 d-flex align-center">
              Gestión de Operaciones
            </h1>
            <span class="live-date-pill d-none d-sm-inline-flex align-center gap-1">
              <VIcon icon="ri-calendar-check-line" size="13" />
              <span>{{ currentDateDisplay }}</span>
            </span>
          </div>
          <p class="text-body-2 text-slate-500 mb-0 mt-0.5">
            Flujo financiero, movimientos diarios y control operativo
          </p>
        </div>
      </div>

      <!-- Barra de Segmentos Unificada (Píldoras Nav Modernas) -->
      <div class="operations-segmented-container d-flex align-center rounded-xl">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          class="segmented-tab-btn"
          :class="{ 'is-active': isCurrentActive(item) }"
          @click="navigateTo(item.route)"
        >
          <!-- Viñeta / Punto indicador activo -->
          <span v-if="isCurrentActive(item)" class="nav-active-dot" />

          <VIcon
            :icon="item.icon"
            size="18"
            class="tab-icon"
          />
          <span class="tab-label">{{ item.title }}</span>
        </button>
      </div>
    </div>
  </VCard>
</template>

<style scoped lang="scss">
.operations-unified-header {
  background: #ffffff !important;
  border-color: rgba(226, 232, 240, 0.9) !important;
  box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.02) !important;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.header-gradient-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #4f46e5 0%, #3b82f6 50%, #06b6d4 100%);
  z-index: 1;
}

.header-icon-wrapper {
  position: relative;
  display: inline-flex;
}

.header-main-avatar {
  background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%) !important;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3) !important;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.04);
  }
}

.header-pulse-beacon {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  background-color: #10b981;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.live-date-pill {
  padding: 3px 10px;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.operations-segmented-container {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 5px;
  gap: 4px;
  overflow-x: auto;
  max-width: 100%;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);

  &::-webkit-scrollbar {
    display: none;
  }
}

.segmented-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 16px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  .tab-icon {
    color: #64748b;
    transition: color 0.2s ease, transform 0.2s ease;
  }

  &:hover:not(.is-active) {
    color: #0f172a;
    background-color: #ffffff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);

    .tab-icon {
      color: #334155;
      transform: translateY(-1px);
    }
  }

  &.is-active {
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
    color: #ffffff !important;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
    transform: translateY(-1px);

    .tab-icon {
      color: #ffffff !important;
    }

    .nav-active-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #38bdf8;
      box-shadow: 0 0 6px #38bdf8;
      flex-shrink: 0;
      animation: pulse-dot 1.8s infinite ease-in-out;
    }
  }
}

@keyframes pulse-dot {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.8;
  }
}
</style>


