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
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center pa-4 gap-4">
      <!-- Encabezado Principal -->
      <div class="d-flex align-center gap-3">
        <VAvatar
          color="primary"
          variant="tonal"
          rounded="lg"
          size="44"
          class="elevation-0"
        >
          <VIcon
            icon="ri-exchange-funds-line"
            size="26"
          />
        </VAvatar>
        <div>
          <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 d-flex align-center gap-2">
            Gestión de Operaciones
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Control financiero integral para tu negocio
          </p>
        </div>
      </div>

      <!-- Barra de Pestañas / Navegación Unificada -->
      <div class="d-flex align-center gap-2 flex-wrap">
        <VBtn
          v-for="item in navItems"
          :key="item.id"
          :color="isCurrentActive(item) ? 'primary' : 'secondary'"
          :variant="isCurrentActive(item) ? 'elevated' : 'tonal'"
          size="small"
          class="font-weight-semibold rounded-lg text-none px-3"
          :prepend-icon="item.icon"
          @click="navigateTo(item.route)"
        >
          {{ item.title }}
        </VBtn>
      </div>
    </div>
  </VCard>
</template>

<style scoped lang="scss">
.operations-unified-header {
  border-color: rgba(var(--v-border-color), 0.1) !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04) !important;
}
</style>

