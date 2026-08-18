<template>
  <div class="app-logo-badge-container">
    <img
      :src="logoPng"
      alt="Luxury Evys"
      class="app-logo-img"
    >
  </div>
</template>

<script setup>
import logoPng from '@images/logo/logo_e.png'
</script>

<style scoped>
.app-logo-badge-container {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 10px;
  padding: 3px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.app-logo-badge-container:hover {
  transform: scale(1.05);
}

.app-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
