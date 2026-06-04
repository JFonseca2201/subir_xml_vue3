<script setup>
import { computed } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { notificationShow, notificationMessage, notificationType } = useGlobalToast()

const toastColor = computed(() => {
  if (notificationType.value === 'success') return 'success'
  if (notificationType.value === 'info') return 'info'
  if (notificationType.value === 'warning') return 'warning'
  return 'error'
})

const toastIcon = computed(() => {
  if (notificationType.value === 'success') return 'ri-checkbox-circle-line'
  if (notificationType.value === 'info') return 'ri-information-line'
  if (notificationType.value === 'warning') return 'ri-alert-line'
  return 'ri-error-warning-line'
})
</script>

<template>
  <!-- Global Toast Notifications -->
  <VSnackbar 
    v-model="notificationShow" 
    :color="toastColor"
    location="top right"
    :style="{ 'margin-top': '60px' }"
    timeout="2000"
  >
    <div class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <VIcon 
          :icon="toastIcon"
          class="me-2"
        />
        {{ notificationMessage }}
      </div>
      <VBtn
        icon="ri-close-line"
        variant="text"
        size="small"
        class="ms-2"
        @click="notificationShow = false"
      />
    </div>
  </VSnackbar>
</template>
