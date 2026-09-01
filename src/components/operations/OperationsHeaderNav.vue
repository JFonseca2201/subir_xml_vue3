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
    id: 'socios',
    title: 'Socios',
    description: 'Aportes de capital',
    icon: 'ri-group-line',
    color: 'primary',
    route: '/aportes',
  },
  {
    id: 'nomina',
    title: 'Gestión de pagos nómina',
    description: 'Pagos y adelantos al personal',
    icon: 'ri-user-3-line',
    color: 'primary',
    route: '/finanzas/employee-expenses',
  },
  {
    id: 'transferencias',
    title: 'Transferencias internas',
    description: 'Transferencias entre cuentas',
    icon: 'ri-arrow-left-right-line',
    color: 'primary',
    route: '/transfers',
  },
]

const isCurrentActive = item => {
  if (props.activeTab && props.activeTab === item.id) return true
  if (route.path.startsWith(item.route)) return true
  
  return false
}

const navigateTo = itemRoute => {
  router.push(itemRoute)
}
</script>

<template>
  <div class="operations-header-nav mt-2 mt-sm-4 mb-5">
    <!-- Encabezado Principal Sin Recuadro (Estilo Gestión de Cartera) -->
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
        <VIcon
          icon="ri-exchange-funds-line"
          color="primary"
          class="me-2"
          size="28"
        />
        Gestión de Operaciones
      </h1>
      <p class="text-medium-emphasis mb-0">
        Control financiero integral para tu negocio
      </p>
    </div>

    <!-- 3 Tarjetas de Acceso Rápido Compactas -->
    <VRow dense>
      <VCol
        v-for="item in navItems"
        :key="item.id"
        cols="12"
        sm="4"
        md="4"
      >
        <VCard
          elevation="1"
          class="h-100 rounded-xl cursor-pointer transition-swing operation-nav-card"
          :class="{
            'active-nav-card': isCurrentActive(item),
            'border-light': !isCurrentActive(item),
          }"
          hover
          @click="navigateTo(item.route)"
        >
          <VCardText class="d-flex flex-column align-center text-center pa-3 pa-sm-4">
            <VAvatar
              :color="item.color"
              variant="tonal"
              size="40"
              class="mb-2"
            >
              <VIcon
                :icon="item.icon"
                size="20"
              />
            </VAvatar>
            <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-1">
              {{ item.title }}
            </div>
            <div
              class="text-caption text-medium-emphasis"
              style="font-size: 0.75rem !important; line-height: 1.2;"
            >
              {{ item.description }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
