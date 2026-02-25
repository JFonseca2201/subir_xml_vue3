import { ref } from 'vue'

const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

export function useGlobalToast() {
    const showNotification = (message, type = 'success') => {
        notificationMessage.value = message
        notificationType.value = type
        notificationShow.value = true
    }

    return {
        notificationShow,
        notificationMessage,
        notificationType,
        showNotification
    }
}
