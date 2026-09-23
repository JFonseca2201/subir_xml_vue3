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
  if (notificationType.value === 'success') return 'ri-checkbox-circle-fill'
  if (notificationType.value === 'info') return 'ri-information-fill'
  if (notificationType.value === 'warning') return 'ri-alert-fill'
  
  return 'ri-error-warning-fill'
})
</script>

<template>
  <!-- Global Toast Notifications -->
  <VSnackbar 
    v-model="notificationShow" 
    :color="toastColor"
    variant="tonal"
    location="top right"
    :style="{ 'margin-top': '60px' }"
    timeout="2500"
    class="custom-global-toast"
  >
    <div class="d-flex align-center justify-space-between w-100 py-0.5">
      <div class="d-flex align-center gap-2 text-body-2 font-weight-medium">
        <VIcon 
          :icon="toastIcon"
          size="20"
        />
        <span>{{ notificationMessage }}</span>
      </div>
      <VBtn
        icon="ri-close-line"
        variant="text"
        size="x-small"
        class="ms-2"
        @click="notificationShow = false"
      />
    </div>
  </VSnackbar>
</template>
