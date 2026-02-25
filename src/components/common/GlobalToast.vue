<script setup>
import { useGlobalToast } from '@/composables/useGlobalToast'

const { notificationShow, notificationMessage, notificationType } = useGlobalToast()
</script>

<template>
    <!-- Global Toast Notifications -->
    <VSnackbar 
        v-model="notificationShow" 
        :color="notificationType === 'success' ? 'success' : 'error'"
        location="top right"
        :style="{ 'margin-top': '60px' }"
        timeout="2000"
    >
        <div class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
                <VIcon 
                    :icon="notificationType === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'"
                    class="me-2"
                />
                {{ notificationMessage }}
            </div>
            <VBtn
                icon="ri-close-line"
                variant="text"
                size="small"
                @click="notificationShow = false"
                class="ms-2"
            />
        </div>
    </VSnackbar>
</template>
