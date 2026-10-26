<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from 'vuetify'
import { useMaintenanceReminders } from '@/composables/useMaintenanceReminders'

const route = useRoute()

// El botón y el panel solo deben operar si el usuario está autenticado y NO está en la vista de login / auth
const isLoginOrAuthPage = computed(() => {
  if (!route) return false
  const path = (route.path || '').toLowerCase()
  const name = String(route.name || '').toLowerCase()

  if (name === 'login' || path === '/login' || path.startsWith('/login')) {
    return true
  }

  if (route.meta?.unauthenticatedOnly || route.meta?.layout === 'blank') {
    return true
  }

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    if (!token || !user) {
      return true
    }
  }

  return false
})

const {
  isDrawerOpen,
  isLoading,
  isActionLoading,
  currentActionReminderId,
  activeTab,
  reminders,
  counts,
  fetchDrawerReminders,
  openDrawer,
  closeDrawer,
  openWhatsApp,
  sendEmail,
} = useMaintenanceReminders()

const theme = useTheme()

// Diálogo para enviar correo manual con personalización opcional
const isEmailDialogVisible = ref(false)
const emailTargetReminder = ref(null)
const isPreviewExpanded = ref(false)
const emailForm = ref({
  email: '',
  subject: '',
  message: '',
})

const getWhatsAppTooltip = (item) => {
  if (item?.has_cellphone) {
    return `Enviar WhatsApp al celular (${item.whatsapp_phone || item.client?.phone}) y marcar notificado`
  }
  if (item?.phone_type === 'conventional') {
    return `Teléfono convencional (${item.client?.phone || ''}). WhatsApp requiere celular de 10 dígitos (ej: 0999179988)`
  }
  return 'Cliente sin teléfono celular registrado'
}

const openEmailModal = (reminder) => {
  emailTargetReminder.value = reminder
  const plate = reminder.vehicle?.license_plate || 'Vehículo'
  const intervalKm = Number(reminder.interval_km || 10000).toLocaleString()
  const clientName = reminder.client?.full_name || reminder.client?.name || 'Estimado cliente'
  const brandName = reminder.vehicle?.brand_name || ''
  const vehicleFullName = `${brandName} ${reminder.vehicle?.model || ''}`.trim() || 'su vehículo'
  const targetKm = Number(reminder.target_mileage || 0).toLocaleString()
  const serviceName = reminder.service_name || reminder.service_category || 'Mantenimiento Preventivo'

  const defaultBody = reminder.default_email_body || `Estimado(a) ${clientName},

De acuerdo con nuestro control técnico de mantenimiento vehicular, le informamos que su vehículo ${vehicleFullName} (Placa: ${plate}) ha cumplido el ciclo de los ${intervalKm} KM recomendados desde su último servicio, alcanzando aproximadamente los ${targetKm} KM.

Servicio correspondiente: ${serviceName}.

Le sugerimos agendar su turno para la inspección y mantenimiento correspondiente, garantizando así la seguridad, rendimiento y óptimo funcionamiento de su vehículo.`

  emailForm.value = {
    email: (reminder.client?.email || '').toLowerCase().trim(),
    subject: reminder.default_email_subject || `Mantenimiento Preventivo (${intervalKm} KM Cumplidos) - Placa ${plate}`,
    message: defaultBody,
  }

  // 1. Cerrar y desaparecer inmediatamente la barra lateral (drawer)
  closeDrawer()

  // 2. Mostrar el diálogo modal de confirmación
  isEmailDialogVisible.value = true
}

const confirmAndSendEmail = async () => {
  if (!emailTargetReminder.value) return
  const success = await sendEmail(
    emailTargetReminder.value,
    emailForm.value.email,
    emailForm.value.subject,
    emailForm.value.message
  )
  if (success) {
    isEmailDialogVisible.value = false
  }
}

// Lista filtrada según la pestaña activa
const currentList = computed(() => {
  if (activeTab.value === 'today') return reminders.value.today
  if (activeTab.value === 'upcoming') return reminders.value.upcoming
  if (activeTab.value === 'overdue') return reminders.value.overdue
  return []
})

// Formateador de fechas
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return new Date(dateStr).toLocaleDateString('es-EC')
  } catch {
    return dateStr
  }
}

// Texto relativo de días
const getRelativeDaysText = (item) => {
  if (item.is_today) return 'Programado para HOY'
  if (item.days_until < 0) {
    const days = Math.abs(item.days_until)
    return `Vencido hace ${days} ${days === 1 ? 'día' : 'días'}`
  }
  return `En ${item.days_until} ${item.days_until === 1 ? 'día' : 'días'}`
}
</script>

<template>
  <template v-if="!isLoginOrAuthPage">
    <VNavigationDrawer
      v-model="isDrawerOpen"
      location="end"
      temporary
      width="440"
      class="maintenance-drawer elevation-12"
      style="z-index: 2500;"
    >
    <!-- CABECERA DEL DRAWER -->
    <div class="drawer-header px-4 py-3.5 border-b d-flex align-center justify-space-between">
      <div class="d-flex align-center gap-2.5">
        <VAvatar color="white" variant="tonal" size="36" rounded="lg" class="drawer-header-avatar">
          <VIcon icon="ri-calendar-check-line" size="20" color="white" />
        </VAvatar>
        <div>
          <div class="d-flex align-center gap-1.5">
            <h3 class="text-subtitle-1 font-weight-bold drawer-header-title mb-0" style="line-height: 1.2;">
              Recordatorios 10k KM
            </h3>
            <VBadge
              v-if="counts.badge_total > 0"
              color="error"
              :content="counts.badge_total"
              inline
              class="font-weight-black"
            />
          </div>
          <span class="text-caption drawer-header-subtitle">
            Mantenimiento Preventivo Periódico
          </span>
        </div>
      </div>

      <div class="d-flex align-center gap-1">
        <!-- Botón refrescar -->
        <VBtn
          icon="ri-refresh-line"
          variant="text"
          size="small"
          class="drawer-header-action-btn"
          :loading="isLoading"
          title="Actualizar recordatorios"
          @click="fetchDrawerReminders(false)"
        />

        <!-- Botón cerrar -->
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="drawer-header-action-btn"
          title="Cerrar panel"
          @click="closeDrawer"
        />
      </div>
    </div>

    <!-- PESTAÑAS (3 PESTAÑAS: Hoy, Próximos 7 días, Vencidos) -->
    <VTabs
      v-model="activeTab"
      grow
      density="comfortable"
      class="border-b drawer-tabs"
    >
      <!-- Pestaña 1: Hoy -->
      <VTab value="today" class="text-caption font-weight-bold drawer-tab-item">
        <span>Hoy</span>
        <span class="ms-1.5 drawer-tab-badge">
          {{ counts.today }}
        </span>
      </VTab>

      <!-- Pestaña 2: Próximos (7 días) -->
      <VTab value="upcoming" class="text-caption font-weight-bold drawer-tab-item">
        <span>Próximos (7d)</span>
        <span class="ms-1.5 drawer-tab-badge">
          {{ counts.upcoming }}
        </span>
      </VTab>

      <!-- Pestaña 3: Vencidos -->
      <VTab value="overdue" class="text-caption font-weight-bold drawer-tab-item">
        <span>Vencidos</span>
        <span
          class="ms-1.5 drawer-tab-badge"
          :class="{ 'badge-overdue': counts.overdue > 0 }"
        >
          {{ counts.overdue }}
        </span>
      </VTab>
    </VTabs>

    <!-- CUERPO / LISTADO DE TARJETAS -->
    <div class="drawer-body pa-3 overflow-y-auto" style="height: calc(100vh - 120px);">
      <!-- Loading Skeletons -->
      <div v-if="isLoading" class="d-flex flex-column gap-3">
        <VCard v-for="n in 3" :key="n" elevation="0" class="border pa-3 rounded-lg" style="background: rgba(255, 255, 255, 0.12) !important;">
          <div class="d-flex justify-space-between mb-2">
            <div class="shimmer-line w-40" style="height: 14px; background: rgba(255, 255, 255, 0.25) !important;" />
            <div class="shimmer-chip" style="width: 70px; height: 18px; background: rgba(255, 255, 255, 0.25) !important;" />
          </div>
          <div class="shimmer-line w-75 mb-2" style="height: 16px; background: rgba(255, 255, 255, 0.25) !important;" />
          <div class="shimmer-line w-50 mb-3" style="height: 12px; background: rgba(255, 255, 255, 0.25) !important;" />
          <div class="d-flex gap-2">
            <div class="shimmer-button w-50" style="height: 30px; background: rgba(255, 255, 255, 0.25) !important;" />
            <div class="shimmer-button w-50" style="height: 30px; background: rgba(255, 255, 255, 0.25) !important;" />
          </div>
        </VCard>
      </div>

      <!-- Estado Vacío -->
      <div
        v-else-if="!currentList || currentList.length === 0"
        class="empty-state-container d-flex flex-column align-center justify-center text-center py-12 px-4"
      >
        <div class="empty-state-avatar-wrap mb-4">
          <VAvatar size="68" class="empty-avatar">
            <VIcon
              :icon="activeTab === 'overdue' ? 'ri-shield-check-line' : (activeTab === 'today' ? 'ri-checkbox-circle-line' : 'ri-calendar-line')"
              size="36"
            />
          </VAvatar>
        </div>
        <h4 class="empty-title mb-2">
          {{ activeTab === 'overdue' ? '¡Sin recordatorios vencidos!' : (activeTab === 'today' ? 'Al día por hoy' : 'Sin mantenimientos en los próximos 7 días') }}
        </h4>
        <p class="empty-desc mb-0" style="max-width: 300px;">
          {{ activeTab === 'overdue' ? 'Todos los ciclos de 10.000 KM han sido atendidos oportunamente.' : (activeTab === 'today' ? 'No hay vehículos con ciclos cumplidos agendados para la fecha actual.' : 'Los próximos mantenimientos preventivos se proyectarán automáticamente.') }}
        </p>
      </div>

      <!-- Listado de Tarjetas de Recordatorio -->
      <div v-else class="d-flex flex-column gap-3">
        <VCard
          v-for="item in currentList"
          :key="item.id"
          elevation="0"
          class="reminder-card border rounded-lg transition-all"
          :class="[
            item.status === 'notified' ? 'reminder-card-notified' : '',
            item.is_overdue ? 'reminder-card-overdue' : (item.is_today ? 'reminder-card-today' : '')
          ]"
        >
          <div class="pa-3">
            <!-- Fila Superior: Servicio + Estado -->
            <div class="d-flex align-center justify-space-between gap-2 mb-2 flex-wrap">
              <!-- Categoría de Servicio -->
              <div class="d-flex align-center gap-1.5 min-w-0">
                <VAvatar :color="item.category_color" variant="tonal" size="24" rounded="sm">
                  <VIcon :icon="item.category_icon" size="13" />
                </VAvatar>
                <span class="text-caption font-weight-bold text-uppercase text-truncate" :class="`text-${item.category_color}`" style="font-size: 0.70rem; letter-spacing: 0.03em;">
                  {{ item.service_category || 'Preventivo' }}
                </span>
              </div>

              <!-- Estado del Recordatorio (Pill unificada) -->
              <div
                class="status-pill-clean"
                :class="item.status === 'notified' ? 'status-paid' : (item.is_overdue ? 'status-pending' : 'status-partial')"
                style="font-size: 0.66rem; padding: 2px 7px;"
              >
                <span class="status-dot" />
                <span>{{ item.status === 'notified' ? 'Notificado' : (item.is_overdue ? 'Vencido' : 'Pendiente') }}</span>
              </div>
            </div>

            <!-- Fila Vehículo (Placa + Modelo) -->
            <div class="d-flex align-center gap-2 mb-2">
              <span class="kardex-plate-badge flex-shrink-0" style="font-size: 0.75rem; padding: 2px 6px;">
                {{ item.vehicle?.license_plate || 'S/P' }}
              </span>
              <div class="min-w-0 flex-grow-1 text-truncate">
                <span class="text-body-2 font-weight-bold text-high-emphasis text-truncate d-block" :title="`${item.vehicle?.brand_name || ''} ${item.vehicle?.model || ''}`">
                  {{ item.vehicle?.brand_name || '' }} {{ item.vehicle?.model || 'Vehículo' }}
                </span>
                <span v-if="item.vehicle?.year" class="text-caption text-medium-emphasis">
                  Año {{ item.vehicle.year }}
                </span>
              </div>
            </div>

            <!-- Fila Cliente & Teléfono -->
            <div class="d-flex align-center justify-space-between gap-1.5 mb-2.5 flex-wrap">
              <div class="d-flex align-center gap-1.5 min-w-0 flex-grow-1">
                <VIcon icon="ri-user-3-line" size="13" class="text-medium-emphasis flex-shrink-0" />
                <span class="text-caption font-weight-medium text-high-emphasis text-truncate" :title="item.client?.full_name">
                  {{ item.client?.full_name || 'Cliente no registrado' }}
                </span>
              </div>

              <!-- Indicador de teléfono y tipo (Celular vs Convencional) -->
              <div v-if="item.client?.phone" class="d-flex align-center gap-1 flex-shrink-0">
                <template v-if="item.has_cellphone">
                  <VIcon icon="ri-smartphone-line" size="13" color="success" />
                  <span class="text-caption font-mono font-weight-semibold text-success" style="font-size: 0.70rem;">
                    {{ item.client.phone }}
                  </span>
                  <VChip size="x-small" color="success" variant="tonal" class="px-1" style="font-size: 0.60rem; height: 16px;">
                    Móvil
                  </VChip>
                </template>
                <template v-else-if="item.phone_type === 'conventional'">
                  <VIcon icon="ri-phone-line" size="13" color="warning" />
                  <span class="text-caption font-mono text-warning" style="font-size: 0.70rem;" :title="`Teléfono convencional (${item.client.phone}) - No dispone de WhatsApp`">
                    {{ item.client.phone }}
                  </span>
                  <VChip size="x-small" color="warning" variant="tonal" class="px-1" style="font-size: 0.60rem; height: 16px;" :title="`Teléfono convencional (${item.client.phone}) - No dispone de WhatsApp`">
                    Convencional
                  </VChip>
                </template>
                <template v-else>
                  <VIcon icon="ri-phone-line" size="13" class="text-medium-emphasis" />
                  <span class="text-caption font-mono text-medium-emphasis" style="font-size: 0.70rem;">
                    {{ item.client.phone }}
                  </span>
                </template>
              </div>
            </div>

            <!-- Caja de Kilometraje y Metas -->
            <div class="mileage-info-box pa-2 rounded-md mb-2.5">
              <div class="d-flex align-center justify-space-between text-caption mb-1">
                <span class="text-medium-emphasis d-flex align-center gap-1">
                  <VIcon icon="ri-dashboard-3-line" size="12" />
                  Meta:
                </span>
                <span class="font-weight-black text-primary font-mono" style="font-size: 0.80rem;">
                  {{ Number(item.target_mileage || 0).toLocaleString() }} KM
                </span>
              </div>

              <div class="d-flex align-center justify-space-between text-caption">
                <span class="text-medium-emphasis d-flex align-center gap-1">
                  <VIcon icon="ri-time-line" size="12" />
                  Estimado:
                </span>
                <span
                  class="font-weight-bold"
                  :class="item.is_overdue ? 'text-error' : (item.is_today ? 'text-warning' : 'text-medium-emphasis')"
                  style="font-size: 0.72rem;"
                >
                  {{ formatDate(item.scheduled_date) }} ({{ getRelativeDaysText(item) }})
                </span>
              </div>

              <!-- Info si ya fue notificado -->
              <div v-if="item.notified_at" class="mt-1 pt-1 border-t text-caption text-success d-flex align-center gap-1" style="font-size: 0.68rem;">
                <VIcon icon="ri-checkbox-circle-fill" size="11" />
                <span>Notificado el {{ formatDate(item.notified_at) }} vía {{ item.notification_channel || 'canal directo' }}</span>
              </div>
            </div>

            <!-- BOTONES DE ACCIÓN RÁPIDA (WhatsApp + Email) -->
            <div class="d-flex align-center gap-2">
              <!-- Botón 1: WhatsApp -->
              <VBtn
                size="small"
                variant="tonal"
                :color="item.has_cellphone ? 'success' : 'secondary'"
                class="flex-grow-1 text-caption font-weight-bold"
                prepend-icon="ri-whatsapp-line"
                :disabled="!item.has_cellphone || (isActionLoading && currentActionReminderId === item.id)"
                :title="getWhatsAppTooltip(item)"
                @click="openWhatsApp(item)"
              >
                WhatsApp
              </VBtn>

              <!-- Botón 2: Email -->
              <VBtn
                size="small"
                variant="tonal"
                color="primary"
                class="flex-grow-1 text-caption font-weight-bold"
                prepend-icon="ri-mail-send-line"
                :disabled="isActionLoading && currentActionReminderId === item.id"
                :loading="isActionLoading && currentActionReminderId === item.id"
                :title="item.has_email ? `Enviar correo a ${item.client?.email}` : 'Enviar correo ingresando destinatario'"
                @click="openEmailModal(item)"
              >
                Email
              </VBtn>
            </div>
          </div>
        </VCard>
      </div>
    </div>
  </VNavigationDrawer>

  <!-- 👉 BOTÓN FLOTANTE (FAB) FIJO EN LA PANTALLA (Esquina inferior derecha) -->
  <div v-if="!isDrawerOpen" class="maintenance-floating-fab-root">
    <VTooltip location="left" :open-on-focus="false">
      <template #activator="{ props: fabTooltipProps }">
        <VBtn
          v-bind="fabTooltipProps"
          icon
          size="52"
          elevation="8"
          color="primary"
          class="maintenance-fab-btn"
          aria-label="Centro de Recordatorios 10.000 KM"
          @click="openDrawer()"
        >
          <VBadge
            v-if="counts.badge_total > 0"
            color="error"
            :content="counts.badge_total"
            max="99"
            class="maintenance-fab-badge"
          >
            <VIcon icon="ri-calendar-check-line" size="26" />
          </VBadge>
          <VIcon v-else icon="ri-calendar-check-line" size="26" />
        </VBtn>
      </template>
      <span style="color: #ffffff !important; font-weight: 600; font-size: 0.8125rem;">
        Centro de Recordatorios (10.000 KM)
        <template v-if="counts.badge_total > 0">
          — <strong style="color: #FBBF24 !important; font-weight: 800;">{{ counts.badge_total }}</strong> pendiente(s)
        </template>
      </span>
    </VTooltip>
  </div>

  <!-- DIÁLOGO MODAL PARA CONFIRMACIÓN Y ENVÍO DE CORREO -->
  <VDialog
    v-model="isEmailDialogVisible"
    max-width="660"
    scrollable
  >
    <VCard class="rounded-xl overflow-hidden elevation-24">
      <!-- Header con degradado primario e íconos -->
      <div class="px-5 py-4 d-flex align-center justify-space-between border-b bg-surface">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" size="38" rounded="lg">
            <VIcon icon="ri-mail-send-fill" size="22" color="primary" />
          </VAvatar>
          <div>
            <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0 d-flex align-center gap-1.5">
              Confirmación de Envío por Email
            </h3>
            <span class="text-caption text-medium-emphasis">
              Revisa los detalles técnicos y el cuerpo del mensaje antes del envío
            </span>
          </div>
        </div>

        <VBtn
          icon="ri-close-line"
          size="small"
          variant="text"
          color="medium-emphasis"
          @click="isEmailDialogVisible = false"
        />
      </div>

      <VCardText class="pa-5 overflow-y-auto" style="max-height: calc(85vh - 120px);">
        <!-- Ficha Resumen con Íconos (Vehículo, Placa, Cliente, Servicio) -->
        <div class="p-3 pa-3 rounded-lg border mb-4 bg-surface" style="background: rgba(var(--v-theme-on-surface), 0.02) !important;">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-2">
            <!-- Vehículo y Placa -->
            <div class="d-flex align-center gap-2">
              <VIcon icon="ri-car-fill" size="18" color="primary" />
              <span class="font-weight-bold text-body-2 text-high-emphasis">
                {{ emailTargetReminder?.vehicle?.brand_name || '' }} {{ emailTargetReminder?.vehicle?.model || 'Vehículo' }}
              </span>
              <span class="kardex-plate-badge" style="font-size: 0.72rem; padding: 1px 6px;">
                {{ emailTargetReminder?.vehicle?.license_plate || 'S/P' }}
              </span>
            </div>

            <!-- Servicio -->
            <VChip
              size="small"
              :color="emailTargetReminder?.category_color || 'primary'"
              variant="tonal"
              class="font-weight-bold"
            >
              <VIcon start :icon="emailTargetReminder?.category_icon || 'ri-tools-fill'" size="14" />
              {{ emailTargetReminder?.service_name || emailTargetReminder?.service_category || 'Preventivo' }}
            </VChip>
          </div>

          <VRow dense class="text-caption">
            <!-- Cliente -->
            <VCol cols="12" sm="6" class="d-flex align-center gap-1.5 text-medium-emphasis">
              <VIcon icon="ri-user-3-line" size="14" />
              <span>Cliente:</span>
              <strong class="text-high-emphasis">{{ emailTargetReminder?.client?.full_name || 'No registrado' }}</strong>
            </VCol>

            <!-- Kilometraje Meta -->
            <VCol cols="12" sm="6" class="d-flex align-center gap-1.5 text-medium-emphasis justify-sm-end">
              <VIcon icon="ri-dashboard-3-line" size="14" />
              <span>Kilometraje:</span>
              <strong class="text-primary font-mono">{{ Number(emailTargetReminder?.target_mileage || 0).toLocaleString() }} KM</strong>
            </VCol>
          </VRow>
        </div>

        <!-- Campos de Destinatario y Asunto -->
        <div class="mb-4">
          <VTextField
            v-model="emailForm.email"
            label="Correo Electrónico Destinatario *"
            placeholder="ejemplo@correo.com"
            type="email"
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="ri-mail-line"
            class="mb-3"
            hint="Si el cliente no tenía correo registrado, se actualizará automáticamente."
            persistent-hint
          />

          <VTextField
            v-model="emailForm.subject"
            label="Asunto del Correo *"
            placeholder="Asunto descriptivo del recordatorio..."
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="ri-file-text-line"
          />
        </div>

        <!-- Cuerpo del Correo a Enviar (Editable) -->
        <div class="mb-3">
          <div class="d-flex align-center justify-space-between mb-1.5">
            <span class="text-caption font-weight-bold text-high-emphasis d-flex align-center gap-1.5">
              <VIcon icon="ri-message-2-line" size="16" color="primary" />
              Cuerpo del Mensaje a Enviar *
            </span>
            <VChip size="x-small" color="primary" variant="tonal" class="font-weight-semibold">
              <VIcon start icon="ri-edit-line" size="11" />
              Editable
            </VChip>
          </div>

          <VTextarea
            v-model="emailForm.message"
            label="Mensaje para el Cliente"
            placeholder="Escribe el cuerpo del mensaje que recibirá el cliente..."
            variant="outlined"
            density="comfortable"
            rows="6"
            auto-grow
            prepend-inner-icon="ri-edit-2-line"
            hint="Este texto se insertará en el cuerpo principal de la plantilla institucional enviada al cliente."
            persistent-hint
          />
        </div>

        <!-- Acordeón / Vista previa en vivo -->
        <div class="mt-3">
          <VBtn
            variant="text"
            size="small"
            color="primary"
            class="pa-0 text-caption font-weight-bold"
            :prepend-icon="isPreviewExpanded ? 'ri-eye-off-line' : 'ri-eye-line'"
            @click="isPreviewExpanded = !isPreviewExpanded"
          >
            {{ isPreviewExpanded ? 'Ocultar vista previa del correo' : 'Ver vista previa del correo' }}
          </VBtn>

          <VExpandTransition>
            <div v-if="isPreviewExpanded" class="mt-2 pa-4 rounded-lg border bg-surface email-preview-card">
              <div class="d-flex align-center gap-2 mb-3 pb-2 border-b">
                <VIcon icon="ri-mail-open-line" size="18" color="primary" />
                <span class="text-caption font-weight-bold text-high-emphasis">
                  Vista Previa del Formato que Recibirá el Cliente
                </span>
              </div>

              <!-- Header Simulado -->
              <div class="pa-3 rounded-md mb-3 text-center" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff;">
                <div class="d-inline-flex align-center justify-center rounded-circle mb-1" style="width: 32px; height: 32px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4);">
                  <VIcon icon="ri-tools-fill" size="16" color="warning" />
                </div>
                <div class="text-caption font-weight-bold text-uppercase" style="letter-spacing: 0.5px; color: #fff;">
                  TECNICENTRO LUXURY EVYS
                </div>
                <div class="text-caption text-medium-emphasis" style="font-size: 0.70rem; color: #94a3b8 !important;">
                  Control de Mantenimiento Preventivo Periódico
                </div>
              </div>

              <!-- Cuerpo de Mensaje Simulado -->
              <div class="pa-3 rounded-md border mb-3 text-body-2" style="white-space: pre-line; background: rgba(var(--v-theme-on-surface), 0.03); line-height: 1.5; font-size: 0.82rem;">
                {{ emailForm.message || 'Sin mensaje especificado' }}
              </div>

              <!-- Detalle Vehicular Simulado -->
              <div class="pa-3 rounded-md border mb-3" style="background: rgba(var(--v-theme-primary), 0.03); border-left: 3px solid rgb(var(--v-theme-primary)) !important;">
                <div class="text-caption font-weight-bold text-high-emphasis mb-1 d-flex align-center gap-1">
                  <VIcon icon="ri-file-list-3-line" size="13" color="primary" />
                  Detalle del Control Técnico
                </div>
                <div class="d-flex justify-space-between text-caption py-0.5">
                  <span class="text-medium-emphasis">Vehículo:</span>
                  <span class="font-weight-bold">{{ emailTargetReminder?.vehicle?.brand_name || '' }} {{ emailTargetReminder?.vehicle?.model || 'Vehículo' }}</span>
                </div>
                <div class="d-flex justify-space-between text-caption py-0.5">
                  <span class="text-medium-emphasis">Placa:</span>
                  <span class="font-weight-bold font-mono">{{ emailTargetReminder?.vehicle?.license_plate || 'S/P' }}</span>
                </div>
                <div class="d-flex justify-space-between text-caption py-0.5">
                  <span class="text-medium-emphasis">Kilometraje Meta:</span>
                  <span class="font-weight-bold text-primary font-mono">{{ Number(emailTargetReminder?.target_mileage || 0).toLocaleString() }} KM</span>
                </div>
              </div>

              <!-- Botón WhatsApp Simulado -->
              <div class="text-center pt-1">
                <VBtn size="small" color="success" variant="flat" prepend-icon="ri-whatsapp-line" class="text-caption font-weight-bold">
                  Agendar Turno por WhatsApp
                </VBtn>
              </div>
            </div>
          </VExpandTransition>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-surface d-flex align-center justify-end gap-2">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-4"
          :disabled="isActionLoading"
          @click="isEmailDialogVisible = false"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-send-plane-fill"
          class="rounded-lg px-5 font-weight-bold"
          :loading="isActionLoading"
          :disabled="!emailForm.email || !emailForm.subject || !emailForm.message || isActionLoading"
          @click="confirmAndSendEmail"
        >
          Enviar Correo
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
  </template>
</template>

<style scoped lang="scss">
.maintenance-drawer {
  background: var(--bg-dialog, #ffffff) !important;
  color: var(--text-primary, #0f172a) !important;
  backdrop-filter: var(--blur-glass, none);
  -webkit-backdrop-filter: var(--blur-glass, none);
  border-left: 1px solid var(--border-glass, #e2e8f0) !important;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.25) !important;

  :deep(.v-navigation-drawer__content) {
    background: transparent !important;
  }

  // 1. Cabecera del Drawer
  .drawer-header {
    border-bottom: 1px solid var(--border-dialog-header, rgba(255, 255, 255, 0.15)) !important;
    background: var(--bg-header, var(--bg-dialog-header, linear-gradient(135deg, #666CFF 0%, #5C61E6 100%))) !important;

    .drawer-header-avatar {
      background: rgba(255, 255, 255, 0.22) !important;
      border: 1.5px solid rgba(255, 255, 255, 0.40) !important;

      .v-icon {
        color: #ffffff !important;
        fill: #ffffff !important;
      }
    }

    .drawer-header-title {
      color: #ffffff !important;
      font-weight: 800 !important;
      font-size: 1.05rem !important;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;
    }

    .drawer-header-subtitle {
      color: rgba(255, 255, 255, 0.88) !important;
      font-size: 0.74rem !important;
      font-weight: 500 !important;
    }

    .drawer-header-action-btn {
      color: #ffffff !important;

      .v-icon {
        color: #ffffff !important;
        fill: #ffffff !important;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.18) !important;
      }
    }
  }

  // 2. Pestañas de Navegación
  .drawer-tabs {
    border-bottom: 1px solid var(--border-glass, #e2e8f0) !important;
    background: var(--table-header-bg, #f8fafc) !important;

    :deep(.v-tab) {
      color: var(--text-secondary, #64748b) !important;
      font-weight: 700 !important;
      letter-spacing: 0.02em;

      .drawer-tab-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(var(--v-theme-on-surface), 0.10) !important;
        color: var(--text-secondary, #475569) !important;
        -webkit-text-fill-color: var(--text-secondary, #475569) !important;
        font-weight: 800 !important;
        font-size: 0.72rem !important;
        padding: 1px 7px !important;
        min-width: 22px !important;
        height: 19px !important;
        border-radius: 999px !important;
        border: 1px solid var(--border-glass, rgba(0, 0, 0, 0.1)) !important;
        line-height: 1 !important;

        &.badge-overdue {
          background: #ef4444 !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          border-color: #f87171 !important;
        }
      }

      &.v-tab--selected {
        background: var(--bg-surface, #ffffff) !important;
        opacity: 1 !important;
        border-radius: 8px 8px 0 0 !important;

        .v-btn__content,
        > span:not(.drawer-tab-badge) {
          color: var(--text-active, #5C61E6) !important;
          -webkit-text-fill-color: var(--text-active, #5C61E6) !important;
          font-weight: 900 !important;
        }

        .drawer-tab-badge {
          background: var(--text-active, #5C61E6) !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          border: none !important;
          font-weight: 900 !important;

          &.badge-overdue {
            background: #ef4444 !important;
          }
        }
      }
    }
  }

  // 3. Cuerpo del Drawer
  .drawer-body {
    background: var(--bg-app, #f8fafc) !important;
  }

  // 4. Estado Vacío (Al día por hoy / Sin recordatorios)
  .empty-state-container {
    .empty-avatar {
      background: var(--dialog-avatar-bg, rgba(102, 108, 255, 0.12)) !important;
      border: 2px solid var(--dialog-avatar-border, rgba(102, 108, 255, 0.30)) !important;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.15) !important;

      .v-icon {
        color: var(--text-active, #5C61E6) !important;
        fill: var(--text-active, #5C61E6) !important;
        font-size: 34px !important;
      }
    }

    .empty-title {
      color: var(--text-primary, #0f172a) !important;
      font-weight: 900 !important;
      font-size: 1.25rem !important;
      letter-spacing: 0.02em !important;
      text-shadow: none !important;
    }

    .empty-desc {
      color: var(--text-secondary, #64748b) !important;
      font-size: 0.88rem !important;
      line-height: 1.5 !important;
      text-shadow: none !important;
    }
  }

  // 5. Tarjetas de Recordatorio
  .reminder-card {
    background: var(--bg-surface, #ffffff) !important;
    color: var(--text-primary, #0f172a) !important;
    border: 1px solid var(--border-glass, #e2e8f0) !important;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08) !important;

    * {
      color: var(--text-primary, #0f172a);
    }

    .kardex-plate-badge {
      background: var(--text-primary, #0f172a) !important;
      color: #ffffff !important;
      border-radius: 6px;
      font-weight: 800;
    }

    .text-high-emphasis,
    .text-body-2 {
      color: var(--text-primary, #0f172a) !important;
      font-weight: 700 !important;
    }

    .text-medium-emphasis,
    .text-caption {
      color: var(--text-secondary, #64748b) !important;
    }

    .mileage-info-box {
      background: rgba(var(--v-theme-on-surface), 0.04) !important;
      border: 1.5px dashed var(--border-glass, #cbd5e1) !important;

      * {
        color: var(--text-secondary, #334155);
      }

      .text-primary {
        color: var(--text-active, #5C61E6) !important;
        font-weight: 900 !important;
      }

      .text-error {
        color: #ef4444 !important;
      }

      .text-warning {
        color: #f59e0b !important;
      }
    }

    .status-pill-clean {
      font-weight: 700 !important;

      &.status-paid {
        background: rgba(16, 185, 129, 0.15) !important;
        color: #10b981 !important;
        border: 1px solid rgba(16, 185, 129, 0.35) !important;
        .status-dot { background: #10b981 !important; }
      }

      &.status-pending {
        background: rgba(239, 68, 68, 0.15) !important;
        color: #ef4444 !important;
        border: 1px solid rgba(239, 68, 68, 0.35) !important;
        .status-dot { background: #ef4444 !important; }
      }

      &.status-partial {
        background: rgba(245, 158, 11, 0.15) !important;
        color: #f59e0b !important;
        border: 1px solid rgba(245, 158, 11, 0.35) !important;
        .status-dot { background: #f59e0b !important; }
      }
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16) !important;
    }

    &.reminder-card-overdue {
      border-left: 5px solid #ef4444 !important;
    }

    &.reminder-card-today {
      border-left: 5px solid var(--text-active, #666CFF) !important;
    }
  }
}

.maintenance-floating-fab-root {
  position: fixed;
  bottom: 88px;
  right: 24px;
  z-index: 1050;

  .maintenance-fab-btn {
    border-radius: 50% !important;
    background: var(--bg-header, var(--v-theme-primary)) !important;
    color: #ffffff !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.30) !important;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;

    &:hover {
      transform: scale(1.10) translateY(-2px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45) !important;
    }
  }
}

:deep(.maintenance-fab-badge .v-badge__badge) {
  font-size: 0.72rem !important;
  font-weight: 800 !important;
  height: 20px !important;
  min-width: 20px !important;
  padding: 0 5px !important;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.6) !important;
  animation: pulse-fab-badge 2.2s infinite ease-in-out;
}

@keyframes pulse-fab-badge {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}
</style>
