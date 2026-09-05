<script setup>
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({
  activeTab: {
    type: String,
    default: '',
  },
})

const router = useRouter()
const route = useRoute()

const navItems = [
  {
    id: 'dashboard',
    title: 'Operaciones',
    description: 'Resumen y movimientos',
    icon: 'ri-dashboard-line',
    route: '/operations',
  },
  {
    id: 'socios',
    title: 'Socios',
    description: 'Aportes de capital',
    icon: 'ri-group-line',
    route: '/aportes',
  },
  {
    id: 'nomina',
    title: 'Nómina',
    description: 'Pagos y adelantos',
    icon: 'ri-user-3-line',
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
  <VCard class="mb-5 rounded-xl border elevation-0 bg-surface operations-unified-header">
    <div class="d-flex flex-column flex-lg-row justify-space-between align-start align-lg-center pa-4 pa-sm-5 gap-4">
      <!-- Encabezado Principal -->
      <div class="d-flex align-center gap-3">
        <VAvatar
          color="primary"
          variant="tonal"
          rounded="lg"
          size="48"
          class="elevation-0 shrink-0"
        >
          <VIcon
            icon="ri-exchange-funds-line"
            size="28"
          />
        </VAvatar>
        <div>
          <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 d-flex align-center gap-2">
            Gestión de Operaciones
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0 mt-0.5">
            Control financiero integral para tu negocio
          </p>
        </div>
      </div>

      <!-- Barra de Segmentos Unificada (Píldoras Unidas con Viñeta Activa) -->
      <div class="operations-segmented-container d-flex align-center p-1 rounded-xl">
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
            size="19"
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
  border-color: rgba(var(--v-border-color), 0.1) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04) !important;
}

.operations-segmented-container {
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 5px;
  gap: 4px;
  overflow-x: auto;
  max-width: 100%;
}

.segmented-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 18px;
  height: 42px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);

  .tab-icon {
    color: #64748b;
    transition: color 0.2s ease, transform 0.2s ease;
  }

  &:hover:not(.is-active) {
    color: #1e293b;
    background-color: rgba(255, 255, 255, 0.75);

    .tab-icon {
      color: #334155;
      transform: translateY(-1px);
    }
  }

  &.is-active {
    background-color: #4a5df8;
    color: #ffffff !important;
    font-weight: 700;
    box-shadow: 0 4px 14px rgba(74, 93, 248, 0.35);
    transform: translateY(-1px);

    .tab-icon {
      color: #ffffff !important;
    }

    .nav-active-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: #ffffff;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
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
    opacity: 0.85;
  }
}
</style>


