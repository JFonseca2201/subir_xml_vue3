<template>
  <VOverlay
    :model-value="loading"
    class="align-center justify-center global-loader-overlay"
    persistent
    scrim="#0c111d"
    opacity="0.65"
    style="z-index: 99999;"
  >
    <div class="loader-container">
      <div class="spinner-container mb-4">
        <!-- Modern clean gradient spinner -->
        <div class="custom-spinner" />
        <div
          class="center-logo"
          v-html="logoHtml"
        />
      </div>
      <h3 class="loader-title mb-1">
        Cargando
      </h3>
      <p class="loader-subtitle">
        Por favor espere un momento...
      </p>
    </div>
  </VOverlay>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useLoaderStore } from '@/stores/loader'
import logoHtml from '@images/logo.svg?raw'

const loaderStore = useLoaderStore()
const { loading } = storeToRefs(loaderStore)
</script>

<style scoped>
.global-loader-overlay {
  backdrop-filter: blur(3px);
}

.loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Elegant minimalist spinner */
.spinner-container {
  position: relative;
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-spinner {
  width: 100%;
  height: 100%;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid var(--v-theme-primary, #6b46c1);
  border-radius: 50%;
  animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.center-logo {
  position: absolute;
  color: var(--v-theme-primary, #6b46c1) !important;
  animation: pulse-logo 2s infinite ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

/* Style the SVG to match primary color */
.center-logo :deep(svg) {
  width: 100%;
  height: auto;
  color: var(--v-theme-primary, #6b46c1);
}

.loader-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
}

.loader-subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 400;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse-logo {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
}
</style>

