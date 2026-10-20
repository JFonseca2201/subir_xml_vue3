<script setup>
import { ref, computed } from 'vue'
import avatar1 from "@images/avatars/avatar-1.png"
import { useRouter, useRoute } from "vue-router"
import { useLoaderStore } from '@/stores/loader'
import { useConfigStore } from '@core/stores/config'
import MyProfileDialog from './MyProfileDialog.vue'
import { usePermissions } from '@/composables/usePermissions'

const router = useRouter()
const route = useRoute()
const loader = useLoaderStore()
const configStore = useConfigStore()
const { can, currentUser } = usePermissions()

const user = computed(() => currentUser.value)

const isMenuOpen = ref(false)
const isProfileDialogVisible = ref(false)
const isShortcutsDialogVisible = ref(false)
const currentProfileTab = ref('menu')

const supportPhone = import.meta.env.VITE_SUPPORT_PHONE || '593999179988'
const supportWhatsappUrl = computed(() => `https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}`)

const themes = [
  {
    name: 'system',
    label: 'Sistema',
    icon: 'ri-macbook-line',
    desc: 'Sincronizar con S.O.',
  },
  {
    name: 'light',
    label: 'Claro',
    icon: 'ri-sun-line',
    desc: 'Luminoso clásico',
  },
  {
    name: 'dark',
    label: 'Oscuro',
    icon: 'ri-moon-clear-line',
    desc: 'Modo noche estándar',
  },
  {
    name: 'dark-glass',
    label: 'Oscuro Transparente',
    icon: 'ri-moon-cloudy-line',
    desc: 'Glassmorphism nocturno',
  },
  {
    name: 'semi-dark-glass',
    label: 'Medio Transparente',
    icon: 'ri-contrast-line',
    desc: 'Glass translúcido medio',
  },
  {
    name: 'light-glass',
    label: 'Transparente Claro',
    icon: 'ri-sun-cloudy-line',
    desc: 'Glassmorphism claro',
  },
]

const userProfileList = [
  {
    type: "navItem",
    icon: "ri-user-settings-line",
    title: "Mi Perfil & Seguridad",
    subtitle: "Mis datos y contraseña",
    action: "open_profile",
    color: "primary",
  },
  {
    type: "navItem",
    icon: "ri-store-2-line",
    title: "Mi Establecimiento",
    subtitle: "Razón social y sucursal",
    to: "/sucursales",
    color: "info",
    permission: "settings",
  },
  { type: "divider" },
  {
    type: "navItem",
    icon: "ri-keyboard-line",
    title: "Atajos de Teclado & Soporte",
    subtitle: "Guía rápida y ayuda",
    action: "open_shortcuts",
    color: "cyan",
  },
]

const filteredUserProfileList = computed(() => {
  const clean = userProfileList.filter(item => {
    if (item.type === 'divider') return true
    if (!item.permission) return true

    return can(item.permission)
  })

  return clean.filter((item, index, arr) => {
    if (item.type === 'divider') {
      if (index === 0 || index === arr.length - 1) return false
      if (arr[index - 1]?.type === 'divider') return false
    }

    return true
  })
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
}

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
  <div>
    <VBadge
      dot
      bordered
      location="bottom right"
      offset-x="3"
      offset-y="3"
      color="success"
      class="user-profile-badge"
    >
      <VAvatar
        class="cursor-pointer elevation-2 transition-swing hover-scale"
        size="42"
      >
        <VImg :src="user && user.avatar ? user.avatar : avatar1" />

        <!-- SECTION Menu -->
        <VMenu
          v-model="isMenuOpen"
          activator="parent"
          min-width="300"
          max-width="calc(100vw - 24px)"
          location="bottom end"
          offset="14px"
          transition="scale-transition"
          :close-on-content-click="false"
        >
          <VList
            class="pa-0 rounded-2xl overflow-hidden elevation-12 border user-profile-menu-list"
            style="max-width: 320px; width: 100%;"
          >
            <!-- Modern Profile Header (Compact & High Contrast) -->
            <div class="user-profile-header pa-4 pb-3 d-flex flex-column align-center text-center position-relative">
              <VAvatar
                size="56"
                class="elevation-3 mb-2 border-avatar"
              >
                <VImg :src="user && user.avatar ? user.avatar : avatar1" />
              </VAvatar>
              <div v-if="user" class="w-100">
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis text-truncate mb-0.5">
                  {{ user.full_name || `${user.name} ${user.surname || ''}` || 'Usuario' }}
                </div>
                <div class="text-caption text-medium-emphasis mb-2 font-mono text-truncate">
                  {{ user.email }}
                </div>
                <VChip
                  size="x-small"
                  color="primary"
                  variant="tonal"
                  class="font-weight-bold px-2.5 text-uppercase"
                >
                  <VIcon
                    start
                    icon="ri-shield-star-line"
                    size="13"
                  />
                  {{ typeof user.role === 'object' ? user.role?.name : (user.role || 'Usuario') }}
                </VChip>
              </div>
              <div v-else>
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
                  Usuario Invitado
                </div>
              </div>
            </div>

            <!-- Subpestañas del perfil: Menú y Temas -->
            <div class="px-3 pb-2">
              <VTabs
                v-model="currentProfileTab"
                density="compact"
                grow
                color="primary"
                class="profile-tabs-pill border rounded-lg"
              >
                <VTab
                  value="menu"
                  class="text-caption font-weight-bold text-none py-1"
                >
                  <VIcon
                    start
                    icon="ri-menu-line"
                    size="16"
                  />
                  Menú
                </VTab>
                <VTab
                  value="themes"
                  class="text-caption font-weight-bold text-none py-1"
                >
                  <VIcon
                    start
                    icon="ri-palette-line"
                    size="16"
                  />
                  Temas
                </VTab>
              </VTabs>
            </div>

            <VDivider class="border-opacity-50" />

            <!-- Tab Content (Bounded Height) -->
            <div class="px-2 py-1.5" style="max-height: 250px; overflow-y: auto;">
              <!-- SUBPESTAÑA 1: Menú General -->
              <VList
                v-if="currentProfileTab === 'menu'"
                nav
                density="compact"
                class="pa-0"
              >
                <template
                  v-for="item in filteredUserProfileList"
                  :key="item.title"
                >
                  <VListItem
                    v-if="item.type === 'navItem'"
                    color="primary"
                    class="rounded-xl mb-1 nav-item-hover cursor-pointer py-1.5"
                    @click="handleItemClick(item)"
                  >
                    <template #prepend>
                      <VAvatar
                        :color="item.color || 'primary'"
                        variant="tonal"
                        size="32"
                        class="me-2.5 rounded-lg"
                      >
                        <VIcon
                          :icon="item.icon"
                          size="17"
                        />
                      </VAvatar>
                    </template>

                    <VListItemTitle class="font-weight-bold text-body-2">
                      {{ item.title }}
                    </VListItemTitle>
                    <VListItemSubtitle
                      v-if="item.subtitle"
                      class="text-caption text-medium-emphasis mt-0.5"
                    >
                      {{ item.subtitle }}
                    </VListItemSubtitle>
                  </VListItem>

                  <VDivider
                    v-else
                    class="my-1.5 border-opacity-50"
                  />
                </template>
              </VList>

              <!-- SUBPESTAÑA 2: Temas del Sistema -->
              <VList
                v-else-if="currentProfileTab === 'themes'"
                nav
                density="compact"
                class="pa-0"
              >
                <VListItem
                  v-for="thm in themes"
                  :key="thm.name"
                  :active="configStore.theme === thm.name"
                  color="primary"
                  class="rounded-xl mb-1 nav-item-hover cursor-pointer py-1.5"
                  @click="selectTheme(thm.name)"
                >
                  <template #prepend>
                    <VAvatar
                      :color="configStore.theme === thm.name ? 'primary' : 'secondary'"
                      :variant="configStore.theme === thm.name ? 'elevated' : 'tonal'"
                      size="32"
                      class="me-2.5 rounded-lg"
                    >
                      <VIcon
                        :icon="thm.icon"
                        size="17"
                      />
                    </VAvatar>
                  </template>

                  <VListItemTitle class="font-weight-bold text-body-2 d-flex align-center justify-space-between">
                    <span>{{ thm.label }}</span>
                    <VIcon
                      v-if="configStore.theme === thm.name"
                      icon="ri-checkbox-circle-fill"
                      color="primary"
                      size="18"
                    />
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption text-medium-emphasis mt-0.5">
                    {{ thm.desc }}
                  </VListItemSubtitle>
                </VListItem>
              </VList>
            </div>

            <!-- Botón Cerrar Sesión (Siempre Visible y Destacado en el fondo) -->
            <VDivider class="border-opacity-50" />
            <div class="pa-2.5 bg-surface">
              <VBtn
                block
                color="error"
                variant="tonal"
                prepend-icon="ri-logout-box-r-line"
                class="rounded-xl font-weight-bold logout-action-btn"
                size="large"
                height="42"
                :loading="loader.loading"
                :disabled="loader.loading"
                @click="logout"
              >
                <span class="text-body-2 font-weight-bold text-uppercase">Cerrar Sesión</span>
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
                <div
                  class="d-flex align-center justify-space-between p-2 pa-3 bg-surface rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Nueva Venta / Factura</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    F2
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div
                  class="d-flex align-center justify-space-between p-2 pa-3 bg-surface rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Buscador de Productos</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    F4
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div
                  class="d-flex align-center justify-space-between p-2 pa-3 bg-surface rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Imprimir Documento</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    Ctrl + P
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div
                  class="d-flex align-center justify-space-between p-2 pa-3 bg-surface rounded-lg border mb-2">
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
.border-avatar {
  border: 2px solid rgba(var(--v-theme-primary), 0.5);
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2);
}

.user-profile-header {
  background: linear-gradient(180deg, rgba(var(--v-theme-primary), 0.06) 0%, transparent 100%);
}

.profile-tabs-pill {
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-color: rgba(var(--v-border-color), 0.12) !important;
}

.nav-item-hover {
  transition: all 0.15s ease-in-out;
}

.nav-item-hover:hover {
  background: rgba(var(--v-theme-primary), 0.08) !important;
  transform: translateX(2px);
}

.logout-action-btn {
  letter-spacing: 0.5px;
}
</style>

