<template>
  <VOverlay
    :model-value="loading"
    class="align-center justify-center global-loader-overlay"
    persistent
    scrim="#0b1329"
    opacity="0.75"
    style="z-index: 99999;"
  >
    <div class="loader-container">
      <div class="spinner-container mb-4">
        <!-- Spinner Ring -->
        <div class="custom-spinner" />
        <!-- Glowing Ring Ambient -->
        <div class="spinner-glow" />
        
        <!-- Center Logo with Clean Badge -->
        <div class="center-logo">
          <img
            :src="logoPng"
            alt="Luxury Evys"
            class="loader-logo-img"
          >
        </div>
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
import logoPng from '@images/logo/logo_e.png'

const loaderStore = useLoaderStore()
const { loading } = storeToRefs(loaderStore)
</script>

<style scoped>
.global-loader-overlay {
  backdrop-filter: blur(6px);
}

.loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Elegant Spinner Container */
.spinner-container {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-spinner {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top: 3px solid #4a5df8;
  border-right: 3px solid #ff4d6d;
  border-radius: 50%;
  animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.spinner-glow {
  position: absolute;
  width: 90%;
  height: 90%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(74, 93, 248, 0.25) 0%, rgba(255, 77, 109, 0.1) 60%, transparent 80%);
  filter: blur(4px);
  animation: pulse-glow 2s ease-in-out infinite alternate;
}

.center-logo {
  position: absolute;
  width: 46px;
  height: 46px;
  background: #ffffff;
  border-radius: 12px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  animation: pulse-logo 2.2s infinite ease-in-out;
  z-index: 2;
}

.loader-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.loader-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.loader-subtitle {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 400;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse-logo {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes pulse-glow {
  0% { opacity: 0.4; transform: scale(0.9); }
  100% { opacity: 0.9; transform: scale(1.1); }
}
</style>
