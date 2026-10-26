<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useMaintenanceReminders } from '@/composables/useMaintenanceReminders'

const {
  badgeCount,
  isLoading,
  toggleDrawer,
  fetchDrawerReminders,
} = useMaintenanceReminders()

let pollInterval = null

onMounted(() => {
  // Carga inicial silenciosa para mostrar el badge en el Navbar
  fetchDrawerReminders(true)

  // Polling cada 5 minutos para mantener el contador actualizado
  pollInterval = setInterval(() => {
    fetchDrawerReminders(true)
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script>

<template>
  <div class="maintenance-bell-wrapper d-flex align-center">
    <VTooltip location="bottom">
      <template #activator="{ props: tooltipProps }">
        <button
          v-bind="tooltipProps"
          type="button"
          class="maintenance-reminder-btn d-flex align-center justify-center position-relative"
          aria-label="Recordatorios de Mantenimiento 10.000 KM"
          @click="toggleDrawer"
        >
          <VBadge
            v-if="badgeCount > 0"
            color="error"
            :content="badgeCount"
            max="99"
            class="maintenance-badge"
          >
            <VIcon
              icon="ri-calendar-check-line"
              size="22"
              class="maintenance-icon text-white"
            />
          </VBadge>

          <VIcon
            v-else
            icon="ri-calendar-check-line"
            size="22"
            class="maintenance-icon text-white"
          />
        </button>
      </template>

      <span>
        Recordatorios de Mantenimiento (10.000 KM)
        <template v-if="badgeCount > 0">
          — <strong>{{ badgeCount }}</strong> pendiente(s)
        </template>
      </span>
    </VTooltip>
  </div>
</template>

<style scoped lang="scss">
.maintenance-bell-wrapper {
  position: relative;
  flex-shrink: 0;
}

.maintenance-reminder-btn {
  background: rgba(255, 255, 255, 0.12) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  border-radius: 12px !important;
  width: 42px !important;
  height: 42px !important;
  min-width: 42px !important;
  cursor: pointer;
  outline: none;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;

  &:hover {
    background: rgba(255, 255, 255, 0.25) !important;
    border-color: rgba(255, 255, 255, 0.45) !important;
    transform: scale(1.08);
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.3);

    .maintenance-icon {
      color: #fbbf24 !important;
      transform: scale(1.08);
    }
  }

  &:active {
    transform: scale(0.95);
  }

  .maintenance-icon {
    color: #ffffff !important;
    transition: transform 0.2s ease, color 0.2s ease;
  }
}

:deep(.maintenance-badge .v-badge__badge) {
  font-size: 0.70rem !important;
  font-weight: 800 !important;
  height: 18px !important;
  min-width: 18px !important;
  padding: 0 4px !important;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.6) !important;
  animation: pulse-attention 2.5s infinite ease-in-out;
}

@keyframes pulse-attention {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}
</style>
