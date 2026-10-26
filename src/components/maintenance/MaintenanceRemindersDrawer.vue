<script setup>
import { ref, computed } from 'vue'
import { useTheme } from 'vuetify'
import { useMaintenanceReminders } from '@/composables/useMaintenanceReminders'

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
const emailForm = ref({
  email: '',
  subject: '',
})

const openEmailModal = (reminder) => {
  emailTargetReminder.value = reminder
  const plate = reminder.vehicle?.license_plate || 'Vehículo'
  const intervalKm = Number(reminder.interval_km || 10000).toLocaleString()

  emailForm.value = {
    email: (reminder.client?.email || '').toLowerCase().trim(),
    subject: `Mantenimiento Preventivo (${intervalKm} KM Cumplidos) - Placa ${plate}`,
  }

  isEmailDialogVisible.value = true
}

const confirmAndSendEmail = async () => {
  if (!emailTargetReminder.value) return
  const success = await sendEmail(
    emailTargetReminder.value,
    emailForm.value.email,
    emailForm.value.subject
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
        <VAvatar color="primary" variant="tonal" size="36" rounded="lg">
          <VIcon icon="ri-calendar-check-line" size="20" />
        </VAvatar>
        <div>
          <div class="d-flex align-center gap-1.5">
            <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0" style="line-height: 1.2;">
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
          <span class="text-caption text-medium-emphasis">
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
          color="medium-emphasis"
          :loading="isLoading"
          title="Actualizar recordatorios"
          @click="fetchDrawerReminders(false)"
        />

        <!-- Botón cerrar -->
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          color="medium-emphasis"
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
      color="primary"
      class="border-b drawer-tabs"
    >
      <!-- Pestaña 1: Hoy -->
      <VTab value="today" class="text-caption font-weight-bold">
        <span>Hoy</span>
        <VChip
          size="x-small"
          class="ms-1.5 font-weight-bold"
          :color="counts.pending_today > 0 ? 'warning' : 'default'"
          :variant="counts.pending_today > 0 ? 'flat' : 'tonal'"
        >
          {{ counts.today }}
        </VChip>
      </VTab>

      <!-- Pestaña 2: Próximos (7 días) -->
      <VTab value="upcoming" class="text-caption font-weight-bold">
        <span>Próximos (7d)</span>
        <VChip
          size="x-small"
          class="ms-1.5 font-weight-bold"
          color="primary"
          variant="tonal"
        >
          {{ counts.upcoming }}
        </VChip>
      </VTab>

      <!-- Pestaña 3: Vencidos -->
      <VTab value="overdue" class="text-caption font-weight-bold">
        <span>Vencidos</span>
        <VChip
          size="x-small"
          class="ms-1.5 font-weight-bold"
          :color="counts.overdue > 0 ? 'error' : 'default'"
          :variant="counts.overdue > 0 ? 'flat' : 'tonal'"
        >
          {{ counts.overdue }}
        </VChip>
      </VTab>
    </VTabs>

    <!-- CUERPO / LISTADO DE TARJETAS -->
    <div class="drawer-body pa-3 overflow-y-auto" style="height: calc(100vh - 120px);">
      <!-- Loading Skeletons -->
      <div v-if="isLoading" class="d-flex flex-column gap-3">
        <VCard v-for="n in 3" :key="n" elevation="0" class="border pa-3 rounded-lg">
          <div class="d-flex justify-space-between mb-2">
            <div class="shimmer-line w-40" style="height: 14px;" />
            <div class="shimmer-chip" style="width: 70px; height: 18px;" />
          </div>
          <div class="shimmer-line w-75 mb-2" style="height: 16px;" />
          <div class="shimmer-line w-50 mb-3" style="height: 12px;" />
          <div class="d-flex gap-2">
            <div class="shimmer-button w-50" style="height: 30px;" />
            <div class="shimmer-button w-50" style="height: 30px;" />
          </div>
        </VCard>
      </div>

      <!-- Estado Vacío -->
      <div
        v-else-if="!currentList || currentList.length === 0"
        class="d-flex flex-column align-center justify-center text-center py-12 px-4"
      >
        <VAvatar size="64" color="primary" variant="tonal" class="mb-3">
          <VIcon
            :icon="activeTab === 'overdue' ? 'ri-shield-check-line' : (activeTab === 'today' ? 'ri-checkbox-circle-line' : 'ri-calendar-line')"
            size="32"
          />
        </VAvatar>
        <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
          {{ activeTab === 'overdue' ? '¡Sin recordatorios vencidos!' : (activeTab === 'today' ? 'Al día por hoy' : 'Sin mantenimientos en los próximos 7 días') }}
        </h4>
        <p class="text-caption text-medium-emphasis mb-0" style="max-width: 280px;">
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

            <!-- Fila Cliente -->
            <div class="d-flex align-center gap-1.5 mb-2.5">
              <VIcon icon="ri-user-3-line" size="13" class="text-medium-emphasis flex-shrink-0" />
              <span class="text-caption font-weight-medium text-high-emphasis text-truncate" :title="item.client?.full_name">
                {{ item.client?.full_name || 'Cliente no registrado' }}
              </span>
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
                color="success"
                class="flex-grow-1 text-caption font-weight-bold"
                prepend-icon="ri-whatsapp-line"
                :disabled="!item.has_phone || (isActionLoading && currentActionReminderId === item.id)"
                :title="item.has_phone ? 'Enviar mensaje por WhatsApp y marcar notificado' : 'Cliente sin teléfono registrado'"
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

    <!-- DIÁLOGO MODAL PARA ENVIAR CORREO CON DESTINATARIO PERSONALIZADO -->
    <VDialog
      v-model="isEmailDialogVisible"
      max-width="480"
    >
      <VCard class="rounded-xl pa-4">
        <div class="d-flex align-center justify-space-between mb-3 border-b pb-2">
          <div class="d-flex align-center gap-2">
            <VAvatar color="primary" variant="tonal" size="32" rounded="lg">
              <VIcon icon="ri-mail-send-line" size="18" />
            </VAvatar>
            <div>
              <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                Enviar Recordatorio por Email
              </h4>
              <span class="text-caption text-medium-emphasis">
                Placa {{ emailTargetReminder?.vehicle?.license_plate || 'S/P' }} • {{ Number(emailTargetReminder?.target_mileage || 0).toLocaleString() }} KM
              </span>
            </div>
          </div>

          <VBtn
            icon="ri-close-line"
            size="x-small"
            variant="text"
            @click="isEmailDialogVisible = false"
          />
        </div>

        <div class="mb-3">
          <VTextField
            v-model="emailForm.email"
            label="Correo Destinatario *"
            placeholder="cliente@ejemplo.com"
            type="email"
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="ri-mail-line"
            class="mb-3"
            hint="Si el cliente no lo tenía, se registrará para futuros envíos."
            persistent-hint
          />

          <VTextField
            v-model="emailForm.subject"
            label="Asunto del Correo"
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="ri-text"
          />
        </div>

        <div class="d-flex justify-end gap-2 pt-2">
          <VBtn
            variant="text"
            color="secondary"
            @click="isEmailDialogVisible = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="ri-send-plane-fill"
            :loading="isActionLoading"
            :disabled="!emailForm.email || isActionLoading"
            @click="confirmAndSendEmail"
          >
            Enviar Correo
          </VBtn>
        </div>
      </VCard>
    </VDialog>
  </VNavigationDrawer>

  <!-- 👉 BOTÓN FLOTANTE (FAB) FIJO EN LA PANTALLA (Esquina inferior derecha) -->
  <div v-if="!isDrawerOpen" class="maintenance-floating-fab-root">
    <VTooltip location="left">
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
      <span>
        Centro de Recordatorios (10.000 KM)
        <template v-if="counts.badge_total > 0">
          — <strong>{{ counts.badge_total }}</strong> pendiente(s)
        </template>
      </span>
    </VTooltip>
  </div>
</template>

<style scoped lang="scss">
.maintenance-drawer {
  background: var(--bg-dialog, rgba(16, 20, 36, 0.98)) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-left: 1px solid var(--border-glass, rgba(255, 255, 255, 0.12)) !important;
}

.drawer-header {
  border-color: var(--border-glass, rgba(255, 255, 255, 0.08)) !important;
}

.drawer-tabs {
  border-color: var(--border-glass, rgba(255, 255, 255, 0.08)) !important;
}

.reminder-card {
  background: var(--bg-surface, rgba(255, 255, 255, 0.04)) !important;
  border-color: var(--border-glass, rgba(255, 255, 255, 0.08)) !important;

  &:hover {
    border-color: rgba(var(--v-theme-primary), 0.4) !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  &.reminder-card-overdue {
    border-left: 3px solid rgb(var(--v-theme-error)) !important;
  }

  &.reminder-card-today {
    border-left: 3px solid rgb(var(--v-theme-primary)) !important;
  }

  &.reminder-card-notified {
    opacity: 0.88;
  }
}

.mileage-info-box {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.12);
}

.maintenance-floating-fab-root {
  position: fixed;
  bottom: 88px;
  right: 24px;
  z-index: 1050;

  .maintenance-fab-btn {
    border-radius: 50% !important;
    box-shadow: 0 8px 24px rgba(var(--v-theme-primary), 0.40) !important;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;

    &:hover {
      transform: scale(1.10) translateY(-2px);
      box-shadow: 0 12px 30px rgba(var(--v-theme-primary), 0.65) !important;
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
