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
    <VNavigationDrawer v-model="isDrawerOpen" location="end" temporary width="440"
      class="maintenance-drawer elevation-12" style="z-index: 2500;">
      <!-- CABECERA DEL DRAWER (Color según el tema del sistema) -->
      <div class="drawer-header-themed d-flex align-center justify-space-between">
        <div class="d-flex align-center gap-3">
          <div class="drawer-avatar-wrap">
            <VIcon icon="ri-calendar-check-line" size="22" />
          </div>
          <div>
            <div class="d-flex align-center gap-2">
              <h4 class="drawer-header-title">
                Recordatorios 10k KM
              </h4>
              <VChip v-if="counts.badge_total > 0" color="error" size="x-small" variant="flat"
                class="font-weight-bold px-1.5">
                {{ counts.badge_total }}
              </VChip>
            </div>
            <p class="drawer-header-subtitle">
              Mantenimiento Preventivo Periódico
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-1">
          <!-- Botón refrescar -->
          <VBtn icon="ri-refresh-line" variant="text" size="small" class="drawer-close-btn" :loading="isLoading"
            title="Actualizar recordatorios" @click="fetchDrawerReminders(false)" />

          <!-- Botón cerrar -->
          <VBtn icon="ri-close-line" variant="text" size="small" class="drawer-close-btn" title="Cerrar panel"
            @click="closeDrawer" />
        </div>
      </div>

      <!-- PESTAÑAS (Sobrias con línea simple) -->
      <VTabs v-model="activeTab" grow class="drawer-tabs-clean">
        <VTab value="today" class="drawer-tab-item">
          <VIcon icon="ri-calendar-line" size="17" class="me-1.5" />
          <span class="tab-label-text">Hoy</span>
          <span class="drawer-tab-badge">
            {{ counts.today }}
          </span>
        </VTab>

        <VTab value="upcoming" class="drawer-tab-item">
          <VIcon icon="ri-time-line" size="17" class="me-1.5" />
          <span class="tab-label-text">Próximos</span>
          <span class="drawer-tab-badge">
            {{ counts.upcoming }}
          </span>
        </VTab>

        <VTab value="overdue" class="drawer-tab-item">
          <VIcon icon="ri-error-warning-line" size="17" class="me-1.5" />
          <span class="tab-label-text">Vencidos</span>
          <span class="drawer-tab-badge" :class="{ 'badge-danger': counts.overdue > 0 }">
            {{ counts.overdue }}
          </span>
        </VTab>
      </VTabs>

      <!-- CUERPO / LISTADO DE TARJETAS -->
      <div class="drawer-body pa-3 overflow-y-auto" style="height: calc(100vh - 120px);">
        <!-- Loading Skeletons -->
        <div v-if="isLoading" class="d-flex flex-column gap-3">
          <VCard v-for="n in 3" :key="n" elevation="0" class="border pa-3 rounded-lg"
            style="background: rgba(255, 255, 255, 0.7) !important;">
            <div class="d-flex justify-space-between mb-2">
              <div class="shimmer-line w-40" style="height: 14px; background: rgba(0, 0, 0, 0.08) !important;" />
              <div class="shimmer-chip"
                style="width: 70px; height: 18px; background: rgba(0, 0, 0, 0.08) !important;" />
            </div>
            <div class="shimmer-line w-75 mb-2" style="height: 16px; background: rgba(0, 0, 0, 0.08) !important;" />
            <div class="shimmer-line w-50 mb-3" style="height: 12px; background: rgba(0, 0, 0, 0.08) !important;" />
            <div class="d-flex gap-2">
              <div class="shimmer-button w-50" style="height: 30px; background: rgba(0, 0, 0, 0.08) !important;" />
              <div class="shimmer-button w-50" style="height: 30px; background: rgba(0, 0, 0, 0.08) !important;" />
            </div>
          </VCard>
        </div>

        <!-- Estado Vacío Sobrio y Amigable -->
        <div v-else-if="!currentList || currentList.length === 0"
          class="empty-state-clean d-flex flex-column align-center justify-center text-center py-12 px-6">
          <div class="empty-icon-circle">
            <VIcon
              :icon="activeTab === 'overdue' ? 'ri-shield-check-line' : (activeTab === 'today' ? 'ri-checkbox-circle-line' : 'ri-calendar-line')"
              size="32" />
          </div>

          <h4 class="empty-clean-title">
            {{ activeTab === 'overdue' ? 'Sin recordatorios vencidos' : (activeTab === 'today' ? 'Todo al día por hoy' :
              'Sin recordatorios próximos') }}
          </h4>

          <p class="empty-clean-desc">
            {{ activeTab === 'overdue' ? 'Todos los ciclos de 10.000 KM han sido atendidos oportunamente.'
              : (activeTab === 'today'
                ? 'No hay vehículos programados para el día de hoy.'
                : 'No hay vehículos con ciclos por vencer en los próximos 7 días.') }}
          </p>

          <VChip size="small" variant="tonal" color="success" prepend-icon="ri-check-line" class="font-weight-medium">
            Al día
          </VChip>
        </div>

        <!-- Listado de Tarjetas de Recordatorio -->
        <div v-else class="d-flex flex-column gap-3">
          <VCard v-for="item in currentList" :key="item.id" elevation="0"
            class="reminder-card border rounded-lg transition-all" :class="[
              item.status === 'notified' ? 'reminder-card-notified' : '',
              item.is_overdue ? 'reminder-card-overdue' : (item.is_today ? 'reminder-card-today' : '')
            ]">
            <div class="pa-3">
              <!-- Fila Superior: Servicio + Estado -->
              <div class="d-flex align-center justify-space-between gap-2 mb-2 flex-wrap">
                <!-- Categoría de Servicio -->
                <div class="d-flex align-center gap-1.5 min-w-0">
                  <VAvatar :color="item.category_color" variant="tonal" size="24" rounded="sm">
                    <VIcon :icon="item.category_icon" size="13" />
                  </VAvatar>
                  <span class="text-caption font-weight-bold text-uppercase text-truncate"
                    :class="`text-${item.category_color}`" style="font-size: 0.70rem; letter-spacing: 0.03em;">
                    {{ item.service_category || 'Preventivo' }}
                  </span>
                </div>

                <!-- Estado del Recordatorio (Pill unificada) -->
                <div class="status-pill-clean"
                  :class="item.status === 'notified' ? 'status-paid' : (item.is_overdue ? 'status-pending' : 'status-partial')"
                  style="font-size: 0.66rem; padding: 2px 7px;">
                  <span class="status-dot" />
                  <span>{{ item.status === 'notified' ? 'Notificado' : (item.is_overdue ? 'Vencido' : 'Pendiente')
                  }}</span>
                </div>
              </div>

              <!-- Fila Vehículo (Placa + Modelo) -->
              <div class="d-flex align-center gap-2 mb-2">
                <span class="kardex-plate-badge flex-shrink-0" style="font-size: 0.75rem; padding: 2px 6px;">
                  {{ item.vehicle?.license_plate || 'S/P' }}
                </span>
                <div class="min-w-0 flex-grow-1 text-truncate">
                  <span class="text-body-2 font-weight-bold text-high-emphasis text-truncate d-block"
                    :title="`${item.vehicle?.brand_name || ''} ${item.vehicle?.model || ''}`">
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
                  <span class="text-caption font-weight-medium text-high-emphasis text-truncate"
                    :title="item.client?.full_name">
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
                    <VChip size="x-small" color="success" variant="tonal" class="px-1"
                      style="font-size: 0.60rem; height: 16px;">
                      Móvil
                    </VChip>
                  </template>
                  <template v-else-if="item.phone_type === 'conventional'">
                    <VIcon icon="ri-phone-line" size="13" color="warning" />
                    <span class="text-caption font-mono text-warning" style="font-size: 0.70rem;"
                      :title="`Teléfono convencional (${item.client.phone}) - No dispone de WhatsApp`">
                      {{ item.client.phone }}
                    </span>
                    <VChip size="x-small" color="warning" variant="tonal" class="px-1"
                      style="font-size: 0.60rem; height: 16px;"
                      :title="`Teléfono convencional (${item.client.phone}) - No dispone de WhatsApp`">
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
                  <span class="font-weight-bold"
                    :class="item.is_overdue ? 'text-error' : (item.is_today ? 'text-warning' : 'text-medium-emphasis')"
                    style="font-size: 0.72rem;">
                    {{ formatDate(item.scheduled_date) }} ({{ getRelativeDaysText(item) }})
                  </span>
                </div>

                <!-- Info si ya fue notificado -->
                <div v-if="item.notified_at"
                  class="mt-1 pt-1 border-t text-caption text-success d-flex align-center gap-1"
                  style="font-size: 0.68rem;">
                  <VIcon icon="ri-checkbox-circle-fill" size="11" />
                  <span>Notificado el {{ formatDate(item.notified_at) }}
                    vía {{ item.notification_channel || 'canal directo' }}</span>
                </div>
              </div>

              <!-- BOTONES DE ACCIÓN RÁPIDA (WhatsApp + Email) -->
              <div class="d-flex align-center gap-2">
                <!-- Botón 1: WhatsApp -->
                <VBtn size="small" variant="flat" :color="item.has_cellphone ? 'success' : 'secondary'"
                  class="flex-grow-1 text-caption font-weight-bold" prepend-icon="ri-whatsapp-line"
                  :disabled="!item.has_cellphone || (isActionLoading && currentActionReminderId === item.id)"
                  :title="getWhatsAppTooltip(item)" @click="openWhatsApp(item)">
                  WhatsApp
                </VBtn>

                <!-- Botón 2: Email -->
                <VBtn size="small" variant="flat" color="primary" class="flex-grow-1 text-caption font-weight-bold"
                  prepend-icon="ri-mail-send-line" :disabled="isActionLoading && currentActionReminderId === item.id"
                  :loading="isActionLoading && currentActionReminderId === item.id"
                  :title="item.has_email ? `Enviar correo a ${item.client?.email}` : 'Enviar correo ingresando destinatario'"
                  @click="openEmailModal(item)">
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
          <VBtn v-bind="fabTooltipProps" icon size="52" elevation="8" color="primary" class="maintenance-fab-btn"
            aria-label="Centro de Recordatorios 10.000 KM" @click="openDrawer()">
            <VBadge v-if="counts.badge_total > 0" color="error" :content="counts.badge_total" max="99"
              class="maintenance-fab-badge">
              <VIcon icon="ri-calendar-check-line" size="26" />
            </VBadge>
            <VIcon v-else icon="ri-calendar-check-line" size="26" />
          </VBtn>
        </template>
        <span style="color: #ffffff !important; font-weight: 600; font-size: 0.8125rem;">
          Centro de Recordatorios (10.000 KM)
          <template v-if="counts.badge_total > 0">
            — <strong style="color: #FBBF24 !important; font-weight: 800;">{{ counts.badge_total }}</strong>
            pendiente(s)
          </template>
        </span>
      </VTooltip>
    </div>

    <!-- DIÁLOGO MODAL PARA CONFIRMACIÓN Y ENVÍO DE CORREO -->
    <VDialog v-model="isEmailDialogVisible" max-width="660" scrollable>
      <VCard class="rounded-xl overflow-hidden elevation-24 email-confirm-card">
        <!-- Header con degradado primario estilizado y sobrio -->
        <div class="custom-dialog-header-primary email-dialog-header">
          <!-- Botón de Cerrar (X) anclado en la esquina superior derecha -->
          <VBtn icon="ri-close-line" size="small" variant="text" class="custom-dialog-close-btn" title="Cerrar ventana"
            @click="isEmailDialogVisible = false" />

          <!-- Contenedor alineado a la izquierda con avatar notorio -->
          <div class="d-flex align-center gap-3.5 pe-10 text-start w-100">
            <div class="email-dialog-avatar flex-shrink-0">
              <VIcon icon="ri-mail-send-fill" size="24" color="white" />
            </div>
            <div class="min-w-0">
              <h3 class="text-subtitle-1 font-weight-bold text-white mb-0.5 text-truncate"
                style="color: #ffffff !important;">
                Confirmación de Envío por Email
              </h3>
              <p class="text-caption mb-0 text-truncate" style="color: rgba(255, 255, 255, 0.88) !important;">
                Revisa los detalles técnicos y el cuerpo del mensaje antes del envío
              </p>
            </div>
          </div>
        </div>

        <VCardText class="pa-5 overflow-y-auto" style="max-height: calc(85vh - 120px);">
          <!-- Ficha Resumen con Íconos (Vehículo, Placa, Cliente, Servicio) -->
          <div class="email-vehicle-card pa-3.5 rounded-xl border mb-4">
            <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-2.5">
              <!-- Vehículo y Placa -->
              <div class="d-flex align-center gap-2">
                <div class="vehicle-icon-circle">
                  <VIcon icon="ri-car-fill" size="16" color="primary" />
                </div>
                <span class="font-weight-bold text-body-2 text-high-emphasis">
                  {{ emailTargetReminder?.vehicle?.brand_name || '' }} {{ emailTargetReminder?.vehicle?.model ||
                    'Vehículo'
                  }}
                </span>
                <span class="kardex-plate-badge" style="font-size: 0.72rem; padding: 1px 7px;">
                  {{ emailTargetReminder?.vehicle?.license_plate || 'S/P' }}
                </span>
              </div>

              <!-- Servicio -->
              <VChip size="small" :color="emailTargetReminder?.category_color || 'primary'" variant="tonal"
                class="font-weight-bold">
                <VIcon start :icon="emailTargetReminder?.category_icon || 'ri-tools-fill'" size="14" />
                {{ emailTargetReminder?.service_name || emailTargetReminder?.service_category || 'Preventivo' }}
              </VChip>
            </div>

            <VDivider class="my-2 border-dashed opacity-50" />

            <VRow dense class="text-caption">
              <!-- Cliente -->
              <VCol cols="12" sm="7" class="d-flex align-center gap-1.5 text-medium-emphasis">
                <VIcon icon="ri-user-3-line" size="14" class="text-primary" />
                <span>Cliente:</span>
                <strong class="text-high-emphasis font-weight-semibold">
                  {{ emailTargetReminder?.client?.full_name || 'No registrado' }}
                </strong>
              </VCol>

              <!-- Kilometraje Meta -->
              <VCol cols="12" sm="5" class="d-flex align-center gap-1.5 text-medium-emphasis justify-sm-end">
                <VIcon icon="ri-dashboard-3-line" size="14" class="text-primary" />
                <span>Kilometraje:</span>
                <strong class="text-primary font-mono font-weight-bold">
                  {{ Number(emailTargetReminder?.target_mileage || 0).toLocaleString() }} KM
                </strong>
              </VCol>
            </VRow>
          </div>

          <!-- Campos de Destinatario y Asunto -->
          <div class="mb-4 mt-2">
            <VTextField v-model="emailForm.email" label="Correo Electrónico Destinatario *"
              placeholder="ejemplo@correo.com" type="email" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-mail-line" class="mb-3.5"
              hint="Si el cliente no tenía correo registrado, se actualizará automáticamente." persistent-hint />

            <VTextField v-model="emailForm.subject" label="Asunto del Correo *"
              placeholder="Asunto descriptivo del recordatorio..." variant="outlined" density="comfortable"
              prepend-inner-icon="ri-file-text-line" />
          </div>

          <!-- Cuerpo del Correo a Enviar (Editable) -->
          <div class="mb-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption font-weight-bold text-high-emphasis d-flex align-center gap-1.5">
                <VIcon icon="ri-message-2-line" size="16" color="primary" />
                Cuerpo del Mensaje a Enviar <span class="text-error font-weight-bold">*</span>
              </span>
              <VChip size="x-small" color="primary" variant="tonal" class="font-weight-semibold">
                <VIcon start icon="ri-edit-line" size="11" />
                Editable
              </VChip>
            </div>

            <VTextarea v-model="emailForm.message"
              placeholder="Escribe el cuerpo del mensaje que recibirá el cliente..." variant="outlined"
              density="comfortable" rows="6" auto-grow prepend-inner-icon="ri-edit-2-line"
              hint="Este texto se insertará en el cuerpo principal de la plantilla institucional enviada al cliente."
              persistent-hint />
          </div>

          <!-- Acordeón / Vista previa en vivo -->
          <div class="mt-3">
            <VBtn variant="text" size="small" color="primary" class="pa-0 text-caption font-weight-bold"
              :prepend-icon="isPreviewExpanded ? 'ri-eye-off-line' : 'ri-eye-line'"
              @click="isPreviewExpanded = !isPreviewExpanded">
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
                <div class="pa-3 rounded-md mb-3 text-center"
                  style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff;">
                  <div class="d-inline-flex align-center justify-center rounded-circle mb-1"
                    style="width: 32px; height: 32px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4);">
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
                <div class="pa-3 rounded-md border mb-3 text-body-2"
                  style="white-space: pre-line; background: rgba(var(--v-theme-on-surface), 0.03); line-height: 1.5; font-size: 0.82rem;">
                  {{ emailForm.message || 'Sin mensaje especificado' }}
                </div>

                <!-- Detalle Vehicular Simulado -->
                <div class="pa-3 rounded-md border mb-3"
                  style="background: rgba(var(--v-theme-primary), 0.03); border-left: 3px solid rgb(var(--v-theme-primary)) !important;">
                  <div class="text-caption font-weight-bold text-high-emphasis mb-1 d-flex align-center gap-1">
                    <VIcon icon="ri-file-list-3-line" size="13" color="primary" />
                    Detalle del Control Técnico
                  </div>
                  <div class="d-flex justify-space-between text-caption py-0.5">
                    <span class="text-medium-emphasis">Vehículo:</span>
                    <span class="font-weight-bold">{{ emailTargetReminder?.vehicle?.brand_name || '' }} {{
                      emailTargetReminder?.vehicle?.model || 'Vehículo' }}</span>
                  </div>
                  <div class="d-flex justify-space-between text-caption py-0.5">
                    <span class="text-medium-emphasis">Placa:</span>
                    <span class="font-weight-bold font-mono">{{ emailTargetReminder?.vehicle?.license_plate || 'S/P'
                    }}</span>
                  </div>
                  <div class="d-flex justify-space-between text-caption py-0.5">
                    <span class="text-medium-emphasis">Kilometraje Meta:</span>
                    <span class="font-weight-bold text-primary font-mono">{{ Number(emailTargetReminder?.target_mileage
                      ||
                      0).toLocaleString() }} KM</span>
                  </div>
                </div>

                <!-- Botón WhatsApp Simulado -->
                <div class="text-center pt-1">
                  <VBtn size="small" color="success" variant="flat" prepend-icon="ri-whatsapp-line"
                    class="text-caption font-weight-bold">
                    Agendar Turno por WhatsApp
                  </VBtn>
                </div>
              </div>
            </VExpandTransition>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 bg-surface d-flex align-center justify-end gap-2">
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" class="rounded-lg px-4"
            :disabled="isActionLoading" @click="isEmailDialogVisible = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-send-plane-fill"
            class="rounded-lg px-5 font-weight-bold" :loading="isActionLoading"
            :disabled="!emailForm.email || !emailForm.subject || !emailForm.message || isActionLoading"
            @click="confirmAndSendEmail">
            Enviar Correo
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </template>
</template>

<style scoped lang="scss">
.email-confirm-card {
  .email-dialog-header {
    position: relative !important;
    padding: 1.25rem 1.5rem !important;
    text-align: left !important;
    background: linear-gradient(135deg, #666cff 0%, #5b61eb 50%, #4f54e5 100%) !important;
    color: #ffffff !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.18) !important;
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.08) !important;

    .email-dialog-avatar {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.22);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.38);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);

      .v-icon {
        color: #ffffff !important;
      }
    }

    .custom-dialog-close-btn {
      position: absolute !important;
      top: 14px !important;
      right: 14px !important;
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      border-radius: 8px !important;
      background: rgba(255, 255, 255, 0.18) !important;
      border: 1px solid rgba(255, 255, 255, 0.28) !important;
      color: #ffffff !important;
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
      z-index: 10 !important;

      &:hover {
        background: rgba(255, 255, 255, 0.32) !important;
        border-color: rgba(255, 255, 255, 0.5) !important;
        transform: scale(1.06) !important;
      }

      .v-icon {
        color: #ffffff !important;
      }
    }
  }

  .email-vehicle-card {
    background: rgba(var(--v-theme-on-surface), 0.02) !important;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
    transition: all 0.2s ease;

    .vehicle-icon-circle {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(var(--v-theme-primary), 0.12);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
