<template>
  <VOverlay
    :model-value="loading"
    class="align-center justify-center"
    persistent
    scrim="#0c111d"
    opacity="0.7"
    style="z-index: 99999;"
  >
    <div class="d-flex flex-column align-center justify-center pa-8 rounded-xl bg-white text-center loader-card">
      <div class="position-relative d-flex align-center justify-center mb-4">
        <VProgressCircular
          indeterminate
          color="primary"
          size="72"
          width="6"
          class="loader-progress"
        />
        <VIcon
          icon="ri-loader-4-line"
          color="primary"
          size="32"
          class="position-absolute rotate-icon"
        />
      </div>
      <div class="text-h6 font-weight-bold text-grey-darken-4 mb-1">Cargando Sistema</div>
      <div class="text-body-2 text-medium-emphasis px-2">Preparando los datos, por favor espere...</div>
    </div>
  </VOverlay>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useLoaderStore } from '@/stores/loader'

const loaderStore = useLoaderStore()
const { loading } = storeToRefs(loaderStore)
</script>

<style scoped>
.loader-card {
  min-width: 280px;
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.loader-progress {
  animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.rotate-icon {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-ring {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .7;
  }
}
</style>
