import { ref, computed } from 'vue'
import { $api } from '@/utils/api'
import { showNotification } from '@/utils/notifications'

// Estado compartido global reactivo (Singleton)
const isDrawerOpen = ref(false)
const isLoading = ref(false)
const isActionLoading = ref(false)
const currentActionReminderId = ref(null)
const activeTab = ref('today') // 'today' | 'upcoming' | 'overdue'

const reminders = ref({
  today: [],
  upcoming: [],
  overdue: [],
})

const counts = ref({
  today: 0,
  pending_today: 0,
  upcoming: 0,
  overdue: 0,
  badge_total: 0,
})

const lastFetchedAt = ref(null)

export function useMaintenanceReminders() {
  /**
   * Cargar resumen de recordatorios para el drawer y el badge
   */
  const fetchDrawerReminders = async (silent = false) => {
    try {
      if (!silent) isLoading.value = true

      const res = await $api('/maintenance-reminders/drawer-summary')

      if (res?.success && res?.data) {
        reminders.value = {
          today: res.data.today || [],
          upcoming: res.data.upcoming || [],
          overdue: res.data.overdue || [],
        }

        counts.value = {
          today: res.counts?.today || 0,
          pending_today: res.counts?.pending_today || 0,
          upcoming: res.counts?.upcoming || 0,
          overdue: res.counts?.overdue || 0,
          badge_total: res.counts?.badge_total || 0,
        }

        lastFetchedAt.value = new Date()
      }
    } catch (err) {
      console.error('Error al consultar recordatorios de mantenimiento para drawer:', err)
      if (!silent) {
        showNotification('No se pudieron sincronizar los recordatorios de mantenimiento', 'error')
      }
    } finally {
      isLoading.value = false
    }
  }

  const openDrawer = (tab = null) => {
    if (tab) activeTab.value = tab
    isDrawerOpen.value = true
    fetchDrawerReminders()
  }

  const closeDrawer = () => {
    isDrawerOpen.value = false
  }

  const toggleDrawer = () => {
    if (!isDrawerOpen.value) {
      openDrawer()
    } else {
      closeDrawer()
    }
  }

  /**
   * Registrar que se notificó por WhatsApp u otro canal manual
   */
  const markNotified = async (reminder, channel = 'whatsapp') => {
    if (!reminder?.id) return
    try {
      isActionLoading.value = true
      currentActionReminderId.value = reminder.id

      const res = await $api(`/maintenance-reminders/${reminder.id}/mark-notified`, {
        method: 'POST',
        body: { channel },
      })

      if (res?.success) {
        reminder.status = 'notified'
        reminder.notified_at = new Date().toISOString()
        reminder.notification_channel = channel

        showNotification('Recordatorio marcado como notificado', 'success')
        fetchDrawerReminders(true)
      }
    } catch (err) {
      console.error('Error al registrar notificación:', err)
      showNotification('Error al registrar la notificación en el sistema', 'error')
    } finally {
      isActionLoading.value = false
      currentActionReminderId.value = null
    }
  }

  /**
   * Abrir enlace directo a WhatsApp y marcar como notificado
   */
  const openWhatsApp = async (reminder) => {
    if (!reminder) return
    if (reminder.whatsapp_url) {
      window.open(reminder.whatsapp_url, '_blank')
      await markNotified(reminder, 'whatsapp')
    } else {
      showNotification('El cliente no tiene un número telefónico registrado para WhatsApp', 'warning')
    }
  }

  /**
   * Enviar correo electrónico manual
   */
  const sendEmail = async (reminder, customEmail = null, customSubject = null) => {
    if (!reminder?.id) return false
    try {
      isActionLoading.value = true
      currentActionReminderId.value = reminder.id

      const targetEmail = (customEmail || reminder.client?.email || '').trim()
      if (!targetEmail) {
        showNotification('El cliente no tiene un correo electrónico registrado', 'warning')
        return false
      }

      const res = await $api(`/maintenance-reminders/${reminder.id}/notify`, {
        method: 'POST',
        body: {
          channel: 'email',
          custom_email: targetEmail,
          subject: customSubject,
        },
      })

      if (res?.success) {
        reminder.status = 'notified'
        reminder.notified_at = new Date().toISOString()
        reminder.notification_channel = 'email'
        if (reminder.client) {
          reminder.client.email = targetEmail
        }

        showNotification(`Correo enviado exitosamente a ${targetEmail}`, 'success')
        fetchDrawerReminders(true)
        return true
      }
      return false
    } catch (err) {
      console.error('Error al enviar correo de recordatorio:', err)
      showNotification(err?.data?.message || err?.message || 'Error al enviar el correo', 'error')
      return false
    } finally {
      isActionLoading.value = false
      currentActionReminderId.value = null
    }
  }

  return {
    isDrawerOpen,
    isLoading,
    isActionLoading,
    currentActionReminderId,
    activeTab,
    reminders,
    counts,
    lastFetchedAt,
    badgeCount: computed(() => counts.value.badge_total),
    fetchDrawerReminders,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    markNotified,
    openWhatsApp,
    sendEmail,
  }
}
