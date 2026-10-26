<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { PerfectScrollbar } from "vue3-perfect-scrollbar"
import avatar1 from "@images/avatars/avatar-1.png"
import { useRouter, useRoute } from "vue-router"
import { useLoaderStore } from '@/stores/loader'
import { useConfigStore } from '@core/stores/config'
import MyProfileDialog from './MyProfileDialog.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useMaintenanceReminders } from '@/composables/useMaintenanceReminders'

const router = useRouter()
const route = useRoute()
const loader = useLoaderStore()
const configStore = useConfigStore()
const { can, currentUser } = usePermissions()

const user = ref(null)

watch(currentUser, updatedUser => {
  user.value = updatedUser
}, { immediate: true })

const isMenuOpen = ref(false)
const isProfileDialogVisible = ref(false)
const isShortcutsDialogVisible = ref(false)
const isThemeExpanded = ref(false)

const {
  badgeCount,
  toggleDrawer,
  openDrawer,
  fetchDrawerReminders,
} = useMaintenanceReminders()

onMounted(() => {
  fetchDrawerReminders(true)
})

const supportPhone = import.meta.env.VITE_SUPPORT_PHONE || '593999179988'
const supportWhatsappUrl = computed(() => `https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}`)

const solidThemes = [
  {
    name: 'light',
    label: 'Claro',
    icon: 'ri-sun-line',
  },
  {
    name: 'dark',
    label: 'Oscuro',
    icon: 'ri-moon-clear-line',
  },
]

const glassThemes = [
  {
    name: 'dark-glass',
    label: 'Oscuro Transparente',
    icon: 'ri-moon-cloudy-line',
  },
  {
    name: 'semi-dark-glass',
    label: 'Medio Transparente',
    icon: 'ri-contrast-line',
  },
  {
    name: 'light-glass',
    label: 'Transparente Claro',
    icon: 'ri-sun-cloudy-line',
  },
]

const workshopThemes = [
  {
    name: 'taller',
    label: 'Colores del Taller',
    icon: 'ri-tools-fill',
    badge: 'Taller',
  },
]

const currentThemeIcon = computed(() => {
  if (configStore.theme === 'system') return 'ri-macbook-line'
  if (configStore.theme === 'light') return 'ri-sun-line'
  if (configStore.theme === 'dark') return 'ri-moon-clear-line'
  if (configStore.theme === 'dark-glass') return 'ri-moon-cloudy-line'
  if (configStore.theme === 'semi-dark-glass') return 'ri-contrast-line'
  if (configStore.theme === 'light-glass') return 'ri-sun-cloudy-line'
  if (configStore.theme === 'taller') return 'ri-tools-fill'
  return 'ri-palette-line'
})

const currentThemeLabel = computed(() => {
  if (configStore.theme === 'system') return 'Sistema'
  if (configStore.theme === 'light') return 'Claro'
  if (configStore.theme === 'dark') return 'Oscuro'
  if (configStore.theme === 'dark-glass') return 'Oscuro Glass'
  if (configStore.theme === 'semi-dark-glass') return 'Medio Glass'
  if (configStore.theme === 'light-glass') return 'Claro Glass'
  if (configStore.theme === 'taller') return 'Taller'
  return 'Tema'
})

const handleItemClick = item => {
  isMenuOpen.value = false
  if (item.action === 'open_profile') {
    isProfileDialogVisible.value = true
  } else if (item.action === 'open_shortcuts') {
    isShortcutsDialogVisible.value = true
  } else if (item.to) {
    router.push(item.to)
  }
}

const handleProfileUpdate = updatedUser => {
  user.value = updatedUser
}

const selectTheme = themeName => {
  configStore.theme = themeName
  isMenuOpen.value = false
}

watch(isMenuOpen, val => {
  if (!val) {
    isThemeExpanded.value = false
  }
})

const logout = async () => {
  isMenuOpen.value = false
  loader.start()
  localStorage.removeItem("user")
  localStorage.removeItem("token")
  setTimeout(() => {
    loader.stop()
  }, 500)

  const currentPath = route.fullPath
  if (currentPath && currentPath !== '/' && currentPath !== '/login') {
    await router.push({ name: 'login', query: { to: currentPath } })
  } else {
    await router.push("/login")
  }
}
</script>

<template>
  <div class="user-profile-nav-container d-flex align-center gap-3">
    <!-- 👉 Botón de Notificaciones / Recordatorios 10.000 KM en el Navbar -->
    <VTooltip location="bottom">
      <template #activator="{ props: tooltipProps }">
        <button
          v-bind="tooltipProps"
          type="button"
          class="navbar-reminder-bell-btn d-flex align-center justify-center position-relative"
          aria-label="Centro de Recordatorios 10.000 KM"
          @click="toggleDrawer"
        >
          <VBadge
            v-if="badgeCount > 0"
            color="error"
            :content="badgeCount"
            max="99"
            class="navbar-reminder-badge"
          >
            <VIcon
              icon="ri-notification-3-line"
              size="22"
              class="text-white"
            />
          </VBadge>
          <VIcon
            v-else
            icon="ri-notification-3-line"
            size="22"
            class="text-white"
          />
        </button>
      </template>
      <span>
        Centro de Recordatorios (10.000 KM)
        <template v-if="badgeCount > 0">
          — <strong>{{ badgeCount }}</strong> pendiente(s)
        </template>
      </span>
    </VTooltip>

    <VBadge dot bordered location="bottom right" offset-x="3" offset-y="3" color="success" class="user-profile-badge">
      <VAvatar class="cursor-pointer elevation-2 transition-swing hover-scale" size="52">
        <VImg :src="user && user.avatar ? user.avatar : avatar1" />

        <!-- SECTION Menu -->
        <VMenu v-model="isMenuOpen" activator="parent" width="390" min-width="360" max-width="calc(100vw - 24px)"
          location="bottom end" offset="14px" transition="scale-transition" :close-on-content-click="false">
          <VList class="pa-0 rounded-2xl overflow-hidden elevation-12 border user-profile-menu-list"
            style="width: 390px; max-width: 100%;">
            <!-- Modern Profile Header (Tamaño Cómodo Original) -->
            <div class="user-profile-header pa-5 d-flex flex-column align-center text-center position-relative">
              <VAvatar size="68" class="elevation-4 mb-3 border-avatar">
                <VImg :src="user && user.avatar ? user.avatar : avatar1" />
              </VAvatar>
              <div v-if="user" class="w-100">
                <div class="text-h6 font-weight-bold text-high-emphasis text-truncate mb-1">
                  {{ user.full_name || `${user.name} ${user.surname || ''}` || 'Usuario' }}
                </div>
                <div class="text-caption text-medium-emphasis mb-2 font-mono text-truncate">
                  {{ user.email }}
                </div>
                <VChip size="small" color="primary" variant="tonal" class="font-weight-bold px-3 text-uppercase">
                  <VIcon start icon="ri-shield-star-line" size="14" />
                  {{ typeof user.role === 'object' ? user.role?.name : (user.role || 'Usuario') }}
                </VChip>
              </div>
              <div v-else>
                <div class="text-h6 font-weight-bold text-high-emphasis mb-1">
                  Usuario Invitado
                </div>
              </div>
            </div>

            <VDivider />

            <!-- Nav Items (Viñetas y Subviñetas de Temas) -->
            <PerfectScrollbar :options="{
              wheelPropagation: false,
              suppressScrollX: true,
              minScrollbarLength: 20,
            }" class="settings-scroll px-3 py-2" style="max-height: 380px;">
              <VList nav density="compact" class="pa-0">
                <!-- Viñeta 1: Mi Perfil & Seguridad -->
                <VListItem color="primary" class="rounded-xl mb-1 nav-item-hover cursor-pointer py-2"
                  @click="handleItemClick({ action: 'open_profile' })">
                  <template #prepend>
                    <VAvatar color="primary" variant="tonal" size="34" class="me-3 rounded-lg">
                      <VIcon icon="ri-user-settings-line" size="18" />
                    </VAvatar>
                  </template>

                  <VListItemTitle class="font-weight-bold text-body-2">
                    Mi Perfil & Seguridad
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption text-medium-emphasis mt-0.5">
                    Mis datos y contraseña
                  </VListItemSubtitle>
                </VListItem>

                <!-- Viñeta 2: Mi Establecimiento (con permiso) -->
                <VListItem v-if="can('settings')" color="primary"
                  class="rounded-xl mb-1 nav-item-hover cursor-pointer py-2"
                  @click="handleItemClick({ to: '/sucursales' })">
                  <template #prepend>
                    <VAvatar color="info" variant="tonal" size="34" class="me-3 rounded-lg">
                      <VIcon icon="ri-store-2-line" size="18" />
                    </VAvatar>
                  </template>

                  <VListItemTitle class="font-weight-bold text-body-2">
                    Mi Establecimiento
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption text-medium-emphasis mt-0.5">
                    Razón social y sucursal
                  </VListItemSubtitle>
                </VListItem>

                <!-- Viñeta: Centro de Recordatorios de Mantenimiento 10.000 KM -->
                <VListItem
                  color="warning"
                  class="rounded-xl mb-1 nav-item-hover cursor-pointer py-2"
                  @click="isMenuOpen = false; openDrawer()"
                >
                  <template #prepend>
                    <VAvatar color="warning" variant="tonal" size="34" class="me-3 rounded-lg">
                      <VIcon icon="ri-calendar-check-line" size="18" />
                    </VAvatar>
                  </template>

                  <VListItemTitle class="font-weight-bold text-body-2 d-flex align-center justify-space-between">
                    <span>Recordatorios 10.000 KM</span>
                    <VChip
                      v-if="badgeCount > 0"
                      size="x-small"
                      color="error"
                      variant="elevated"
                      class="font-weight-bold px-2"
                    >
                      {{ badgeCount }}
                    </VChip>
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption text-medium-emphasis mt-0.5">
                    Mantenimientos preventivos
                  </VListItemSubtitle>
                </VListItem>

                <VDivider class="my-2 border-opacity-50" />

                <!-- Viñeta 3: Tema del Sistema (Desplegable con Subviñetas) -->
                <VListItem color="primary" class="rounded-xl mb-1 nav-item-hover cursor-pointer py-2"
                  :class="{ 'theme-active-item': isThemeExpanded }" @click="isThemeExpanded = !isThemeExpanded">
                  <template #prepend>
                    <VAvatar color="warning" variant="tonal" size="34" class="me-3 rounded-lg">
                      <VIcon :icon="currentThemeIcon" size="18" />
                    </VAvatar>
                  </template>

                  <VListItemTitle class="font-weight-bold text-body-2 d-flex align-center justify-space-between">
                    <span>Tema / Apariencia</span>
                    <VChip size="x-small" color="warning" variant="tonal"
                      class="font-weight-semibold text-caption px-2">
                      {{ currentThemeLabel }}
                    </VChip>
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption text-medium-emphasis mt-0.5">
                    Personalizar interfaz
                  </VListItemSubtitle>

                  <template #append>
                    <VIcon :icon="isThemeExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" size="20"
                      class="text-medium-emphasis ms-1" />
                  </template>
                </VListItem>

                <!-- Subviñetas Desplegables de Temas -->
                <VExpandTransition>
                  <div v-if="isThemeExpanded" class="theme-subitems-wrapper pa-2 mb-2 rounded-xl border">
                    <!-- Subviñeta 1: Sistema -->
                    <div
                      class="theme-group-label text-caption font-weight-bold text-uppercase px-2 pt-1 pb-1 text-medium-emphasis d-flex align-center gap-1">
                      <VIcon icon="ri-computer-line" size="13" color="primary" />
                      Sistema
                    </div>
                    <VListItem :active="configStore.theme === 'system'" color="primary"
                      class="rounded-lg mb-1 subitem-hover cursor-pointer py-1" @click="selectTheme('system')">
                      <template #prepend>
                        <VAvatar :color="configStore.theme === 'system' ? 'primary' : 'secondary'"
                          :variant="configStore.theme === 'system' ? 'elevated' : 'tonal'" size="26"
                          class="me-2 rounded-md">
                          <VIcon icon="ri-macbook-line" size="15" />
                        </VAvatar>
                      </template>
                      <VListItemTitle class="text-body-2 font-weight-medium">
                        Predeterminado S.O.
                      </VListItemTitle>
                      <template #append>
                        <VIcon v-if="configStore.theme === 'system'" icon="ri-checkbox-circle-fill" color="primary"
                          size="18" />
                      </template>
                    </VListItem>

                    <!-- Subviñeta 2: Claro u Oscuro -->
                    <div
                      class="theme-group-label text-caption font-weight-bold text-uppercase px-2 pt-2 pb-1 text-medium-emphasis d-flex align-center gap-1">
                      <VIcon icon="ri-contrast-drop-line" size="13" color="primary" />
                      Claro u Oscuro
                    </div>
                    <VListItem v-for="thm in solidThemes" :key="thm.name" :active="configStore.theme === thm.name"
                      color="primary" class="rounded-lg mb-1 subitem-hover cursor-pointer py-1"
                      @click="selectTheme(thm.name)">
                      <template #prepend>
                        <VAvatar :color="configStore.theme === thm.name ? 'primary' : 'secondary'"
                          :variant="configStore.theme === thm.name ? 'elevated' : 'tonal'" size="26"
                          class="me-2 rounded-md">
                          <VIcon :icon="thm.icon" size="15" />
                        </VAvatar>
                      </template>
                      <VListItemTitle class="text-body-2 font-weight-medium">
                        {{ thm.label }}
                      </VListItemTitle>
                      <template #append>
                        <VIcon v-if="configStore.theme === thm.name" icon="ri-checkbox-circle-fill" color="primary"
                          size="18" />
                      </template>
                    </VListItem>

                    <!-- Subviñeta 3: Transparentes (Glass) -->
                    <div
                      class="theme-group-label text-caption font-weight-bold text-uppercase px-2 pt-2 pb-1 text-medium-emphasis d-flex align-center gap-1">
                      <VIcon icon="ri-sparkling-line" size="13" color="primary" />
                      Transparentes (Glass)
                    </div>
                    <VListItem v-for="thm in glassThemes" :key="thm.name" :active="configStore.theme === thm.name"
                      color="primary" class="rounded-lg mb-1 subitem-hover cursor-pointer py-1"
                      @click="selectTheme(thm.name)">
                      <template #prepend>
                        <VAvatar :color="configStore.theme === thm.name ? 'primary' : 'secondary'"
                          :variant="configStore.theme === thm.name ? 'elevated' : 'tonal'" size="26"
                          class="me-2 rounded-md">
                          <VIcon :icon="thm.icon" size="15" />
                        </VAvatar>
                      </template>
                      <VListItemTitle class="text-body-2 font-weight-medium">
                        {{ thm.label }}
                      </VListItemTitle>
                      <template #append>
                        <VIcon v-if="configStore.theme === thm.name" icon="ri-checkbox-circle-fill" color="primary"
                          size="18" />
                      </template>
                    </VListItem>

                    <!-- Subviñeta 4: Colores Oficiales del Taller -->
                    <div
                      class="theme-group-label text-caption font-weight-bold text-uppercase px-2 pt-2 pb-1 text-medium-emphasis d-flex align-center gap-1">
                      <VIcon icon="ri-tools-fill" size="13" color="error" />
                      Colores del Taller
                    </div>
                    <VListItem v-for="thm in workshopThemes" :key="thm.name" :active="configStore.theme === thm.name"
                      color="primary" class="rounded-lg mb-1 subitem-hover cursor-pointer py-1"
                      @click="selectTheme(thm.name)">
                      <template #prepend>
                        <VAvatar :color="configStore.theme === thm.name ? 'primary' : 'secondary'"
                          :variant="configStore.theme === thm.name ? 'elevated' : 'tonal'" size="26"
                          class="me-2 rounded-md"
                          :style="configStore.theme === thm.name ? 'background: linear-gradient(135deg, #8A1538 0%, #600A1F 100%) !important; color: #fff !important;' : ''">
                          <VIcon :icon="thm.icon" size="15" />
                        </VAvatar>
                      </template>
                      <VListItemTitle class="text-body-2 font-weight-medium d-flex align-center gap-2">
                        <span>{{ thm.label }}</span>
                        <VChip v-if="thm.badge" size="x-small" color="error" variant="tonal"
                          class="font-weight-bold px-1.5" style="font-size: 10px; height: 18px;">
                          {{ thm.badge }}
                        </VChip>
                      </VListItemTitle>
                      <template #append>
                        <VIcon v-if="configStore.theme === thm.name" icon="ri-checkbox-circle-fill" color="error"
                          size="18" />
                      </template>
                    </VListItem>
                  </div>
                </VExpandTransition>

                <VDivider class="my-2 border-opacity-50" />

                <!-- Viñeta 4: Atajos de Teclado & Soporte -->
                <VListItem color="primary" class="rounded-xl mb-1 nav-item-hover cursor-pointer py-2"
                  @click="handleItemClick({ action: 'open_shortcuts' })">
                  <template #prepend>
                    <VAvatar color="cyan" variant="tonal" size="34" class="me-3 rounded-lg">
                      <VIcon icon="ri-keyboard-line" size="18" />
                    </VAvatar>
                  </template>

                  <VListItemTitle class="font-weight-bold text-body-2">
                    Atajos de Teclado & Soporte
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption text-medium-emphasis mt-0.5">
                    Guía rápida y ayuda
                  </VListItemSubtitle>
                </VListItem>
              </VList>
            </PerfectScrollbar>

            <!-- Logout Button (Siempre Visible en la base) -->
            <VDivider class="border-opacity-50" />
            <div class="pa-3 bg-surface">
              <VBtn block color="error" variant="tonal" prepend-icon="ri-logout-box-r-line"
                class="rounded-xl font-weight-bold logout-action-btn" size="large" height="44" :loading="loader.loading"
                :disabled="loader.loading" @click="logout">
                <span class="text-body-2 font-weight-bold text-uppercase letter-spacing-1">Cerrar Sesión</span>
              </VBtn>
            </div>
          </VList>
        </VMenu>
        <!-- !SECTION -->
      </VAvatar>
    </VBadge>

    <!-- Modal de Mi Perfil -->
    <MyProfileDialog v-if="user" v-model:is-dialog-visible="isProfileDialogVisible" :user-data="user"
      @profile-updated="handleProfileUpdate" />

    <!-- Modal de Atajos de Teclado & Soporte -->
    <VDialog v-model="isShortcutsDialogVisible" max-width="650" scrollable>
      <VCard class="custom-dialog-card elevation-24">
        <!-- Header Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn"
            @click="isShortcutsDialogVisible = false" />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-keyboard-line" />
          </div>
          <h3 class="custom-dialog-title">
            Atajos de Teclado & Soporte
          </h3>
          <p class="custom-dialog-subtitle">
            Guía rápida de acceso y soporte técnico del sistema
          </p>
        </div>

        <VCardText class="pa-5">
          <!-- Sección Atajos -->
          <div class="mb-5">
            <div class="d-flex align-center gap-2 mb-3">
              <VIcon icon="ri-flashlight-line" color="primary" size="20" />
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Atajos Rápidos de Productividad
              </span>
            </div>

            <VRow dense>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between p-2 pa-3 bg-surface rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Nueva Venta / Factura</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    F2
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between p-2 pa-3 bg-surface rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Buscador de Productos</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    F4
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between p-2 pa-3 bg-surface rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Imprimir Documento</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    Ctrl + P
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between p-2 pa-3 bg-surface rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Cerrar Ventanas</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    ESC
                  </VChip>
                </div>
              </VCol>
            </VRow>
          </div>

          <VDivider class="my-4" />

          <!-- Sección Información del Sistema -->
          <div class="mb-5">
            <div class="d-flex align-center gap-2 mb-3">
              <VIcon icon="ri-information-line" color="info" size="20" />
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Estado del Sistema
              </span>
            </div>

            <div
              class="pa-4 bg-indigo-lighten-5 rounded-xl border border-indigo-lighten-4 d-flex align-center justify-space-between flex-wrap gap-3">
              <div>
                <div class="text-caption font-weight-bold text-indigo-darken-3 text-uppercase">
                  Facturación SRI Electrónica
                </div>
                <div class="text-body-2 font-weight-semibold text-indigo-darken-2 mt-0.5">
                  Ambiente en Línea (Producción)
                </div>
              </div>
              <VChip color="success" variant="elevated" size="small" class="font-weight-bold">
                <VIcon start icon="ri-checkbox-circle-fill" size="14" />
                Operativo
              </VChip>
            </div>
          </div>

          <VDivider class="my-4" />

          <!-- Asistencia y Soporte -->
          <div>
            <div class="d-flex align-center gap-2 mb-3">
              <VIcon icon="ri-customer-service-2-line" color="success" size="20" />
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Asistencia Técnica
              </span>
            </div>

            <p class="text-caption text-medium-emphasis mb-3">
              ¿Tienes dudas o necesitas asistencia con el sistema? Comunícate con el equipo de soporte técnico:
            </p>

            <div class="d-flex align-center gap-3">
              <VBtn color="success" variant="elevated" prepend-icon="ri-whatsapp-line"
                class="rounded-lg font-weight-bold flex-grow-1" :href="supportWhatsappUrl" target="_blank"
                rel="noopener noreferrer">
                WhatsApp Soporte
              </VBtn>
            </div>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 bg-surface justify-end">
          <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium" @click="isShortcutsDialogVisible = false">
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
/* Evita que el menú genere desbordamiento horizontal. */
.settings-scroll {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-x: hidden;
}

/* PerfectScrollbar crea un rail horizontal aunque no sea necesario. */
.settings-scroll :deep(.ps__rail-x),
.settings-scroll :deep(.ps__thumb-x) {
  display: none !important;
  height: 0 !important;
  visibility: hidden !important;
}

.settings-scroll :deep(.ps),
.settings-scroll :deep(.ps-content),
.settings-scroll :deep(.v-list) {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.settings-scroll :deep(.v-list) {
  width: 100%;
}

.settings-scroll :deep(.v-list-item) {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.settings-scroll :deep(.v-list-item__content) {
  min-width: 0;
  overflow: hidden;
}

.settings-scroll :deep(.v-list-item-title),
.settings-scroll :deep(.v-list-item-subtitle) {
  min-width: 0;
  overflow-wrap: anywhere;
}

.border-avatar {
  border: 2px solid rgba(var(--v-theme-primary), 0.5);
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2);
}

.user-profile-header {
  background: linear-gradient(180deg, rgba(var(--v-theme-primary), 0.06) 0%, transparent 100%);
}

.nav-item-hover {
  transition: all 0.15s ease-in-out;
}

.nav-item-hover:hover {
  background: rgba(var(--v-theme-primary), 0.08) !important;
}

.theme-active-item {
  background: rgba(var(--v-theme-primary), 0.06);
}

.theme-subitems-wrapper {
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-color: rgba(var(--v-border-color), 0.12) !important;
}

.theme-group-label {
  letter-spacing: 0.5px;
}

.subitem-hover {
  transition: all 0.15s ease-in-out;
}

.subitem-hover:hover {
  background: rgba(var(--v-theme-primary), 0.08) !important;
}

.logout-action-btn {
  letter-spacing: 0.5px;
}

.navbar-reminder-bell-btn {
  background: rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  border: 1.5px solid rgba(255, 255, 255, 0.28) !important;
  border-radius: 12px !important;
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
  cursor: pointer;
  outline: none;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;

  &:hover {
    background: rgba(255, 255, 255, 0.3) !important;
    border-color: rgba(255, 255, 255, 0.6) !important;
    transform: scale(1.08);
    box-shadow: 0 4px 18px rgba(245, 158, 11, 0.5);
  }

  &:active {
    transform: scale(0.95);
  }
}

:deep(.navbar-reminder-badge .v-badge__badge) {
  font-size: 0.72rem !important;
  font-weight: 800 !important;
  height: 19px !important;
  min-width: 19px !important;
  padding: 0 4px !important;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.7) !important;
  animation: pulse-attention 2.5s infinite ease-in-out;
}
</style>
