<script setup>
import { ref } from 'vue'
import { PerfectScrollbar } from "vue3-perfect-scrollbar"
import avatar1 from "@images/avatars/avatar-1.png"
import { useRouter } from "vue-router"
import { useLoaderStore } from '@/stores/loader'
import MyProfileDialog from './MyProfileDialog.vue'

const router = useRouter()
const loader = useLoaderStore()
const user = ref(localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null)

const isMenuOpen = ref(false)
const isProfileDialogVisible = ref(false)
const isShortcutsDialogVisible = ref(false)

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
  },
  {
    type: "navItem",
    icon: "ri-safe-2-line",
    title: "Caja y Arqueo Diario",
    subtitle: "Cuadre y cierre de caja",
    to: "/finanzas/arqueo",
    color: "success",
  },
  { type: "divider" },
  {
    type: "navItem",
    icon: "ri-receipt-line",
    title: "Historial de Ventas",
    subtitle: "Facturas y documentos",
    to: "/sales/list",
    color: "warning",
  },
  {
    type: "navItem",
    icon: "ri-tools-line",
    title: "Órdenes de Trabajo",
    subtitle: "Taller automotriz",
    to: "/work-orders/list",
    color: "purple",
  },
  {
    type: "navItem",
    icon: "ri-shield-user-line",
    title: "Roles y Permisos",
    subtitle: "Accesos del sistema",
    to: "/roles-permisos",
    color: "indigo",
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

const logout = async () => {
  loader.start()
  localStorage.removeItem("user")
  localStorage.removeItem("token")
  setTimeout(() => {
    loader.stop()
  }, 500)
  await router.push("/login")
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
          min-width="280"
          max-width="calc(100vw - 24px)"
          location="bottom end"
          offset="14px"
          transition="scale-transition"
          close-on-content-click
        >
          <VList class="pa-0 rounded-2xl overflow-hidden elevation-8 border user-profile-menu-list" style="max-width: 320px; width: 100%;">
            <!-- Modern Profile Header -->
            <div class="user-profile-header pa-5 d-flex flex-column align-center text-center position-relative">
              <VAvatar
                size="68"
                class="elevation-4 mb-3 border-avatar"
              >
                <VImg :src="user && user.avatar ? user.avatar : avatar1" />
              </VAvatar>
              <div v-if="user">
                <div class="text-h6 font-weight-bold text-high-emphasis mb-1">
                  {{ user.full_name || `${user.name} ${user.surname || ''}` || 'Usuario' }}
                </div>
                <div class="text-caption text-medium-emphasis mb-2 font-mono">
                  {{ user.email }}
                </div>
                <VChip
                  size="small"
                  color="primary"
                  variant="tonal"
                  class="font-weight-bold px-3 text-uppercase"
                >
                  <VIcon
                    start
                    icon="ri-shield-star-line"
                    size="14"
                  />
                  {{ user.role?.name || 'Administrador' }}
                </VChip>
              </div>
              <div v-else>
                <div class="text-h6 font-weight-bold text-high-emphasis mb-1">
                  Usuario Invitado
                </div>
              </div>
            </div>

            <VDivider />

            <!-- Nav Items -->
            <PerfectScrollbar
              :options="{ wheelPropagation: false }"
              class="px-3 py-2"
              style="max-height: 360px;"
            >
              <VList
                nav
                density="compact"
                class="pa-0"
              >
                <template
                  v-for="item in userProfileList"
                  :key="item.title"
                >
                  <VListItem
                    v-if="item.type === 'navItem'"
                    color="primary"
                    class="rounded-xl mb-1 nav-item-hover cursor-pointer py-2"
                    @click="handleItemClick(item)"
                  >
                    <template #prepend>
                      <VAvatar
                        :color="item.color || 'primary'"
                        variant="tonal"
                        size="34"
                        class="me-3 rounded-lg"
                      >
                        <VIcon
                          :icon="item.icon"
                          size="18"
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
                    class="my-2 border-opacity-50"
                  />
                </template>
              </VList>

              <!-- Logout Button -->
              <div class="mt-3 mb-2 px-1">
                <VBtn
                  block
                  color="error"
                  variant="tonal"
                  prepend-icon="ri-logout-box-r-line"
                  class="rounded-xl font-weight-bold"
                  size="large"
                  height="44"
                  :loading="loader.loading"
                  :disabled="loader.loading"
                  @click="logout"
                >
                  Cerrar Sesión
                </VBtn>
              </div>
            </PerfectScrollbar>
          </VList>
        </VMenu>
        <!-- !SECTION -->
      </VAvatar>
    </VBadge>

    <!-- Modal de Mi Perfil -->
    <MyProfileDialog
      v-if="user"
      v-model:is-dialog-visible="isProfileDialogVisible"
      :user-data="user"
      @profile-updated="handleProfileUpdate"
    />

    <!-- Modal de Atajos de Teclado & Soporte -->
    <VDialog
      v-model="isShortcutsDialogVisible"
      max-width="650"
      scrollable
    >
      <VCard class="custom-dialog-card elevation-24">
        <!-- Header Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isShortcutsDialogVisible = false"
          />
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
              <VIcon
                icon="ri-flashlight-line"
                color="primary"
                size="20"
              />
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Atajos Rápidos de Productividad
              </span>
            </div>

            <VRow dense>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between p-2 pa-3 bg-grey-lighten-4 rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Nueva Venta / Factura</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    F2
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between p-2 pa-3 bg-grey-lighten-4 rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Buscador de Productos</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    F4
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between p-2 pa-3 bg-grey-lighten-4 rounded-lg border mb-2">
                  <span class="text-body-2 font-weight-medium">Imprimir Documento</span>
                  <VChip size="x-small" color="primary" variant="elevated" class="font-weight-black font-mono">
                    Ctrl + P
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between p-2 pa-3 bg-grey-lighten-4 rounded-lg border mb-2">
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
              <VIcon
                icon="ri-information-line"
                color="info"
                size="20"
              />
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Estado del Sistema
              </span>
            </div>

            <div class="pa-4 bg-indigo-lighten-5 rounded-xl border border-indigo-lighten-4 d-flex align-center justify-space-between flex-wrap gap-3">
              <div>
                <div class="text-caption font-weight-bold text-indigo-darken-3 text-uppercase">
                  Facturación SRI Electrónica
                </div>
                <div class="text-body-2 font-weight-semibold text-indigo-darken-2 mt-0.5">
                  Ambiente en Línea (Producción)
                </div>
              </div>
              <VChip
                color="success"
                variant="elevated"
                size="small"
                class="font-weight-bold"
              >
                <VIcon start icon="ri-checkbox-circle-fill" size="14" />
                Operativo
              </VChip>
            </div>
          </div>

          <VDivider class="my-4" />

          <!-- Asistencia y Soporte -->
          <div>
            <div class="d-flex align-center gap-2 mb-3">
              <VIcon
                icon="ri-customer-service-2-line"
                color="success"
                size="20"
              />
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Asistencia Técnica
              </span>
            </div>

            <p class="text-caption text-medium-emphasis mb-3">
              ¿Tienes dudas o necesitas asistencia con el sistema? Comunícate con el equipo de soporte técnico:
            </p>

            <div class="d-flex align-center gap-3">
              <VBtn
                color="success"
                variant="elevated"
                prepend-icon="ri-whatsapp-line"
                class="rounded-lg font-weight-bold flex-grow-1"
                href="https://wa.me/593987654321"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp Soporte
              </VBtn>
            </div>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 bg-grey-lighten-5 justify-end">
          <VBtn
            color="secondary"
            variant="outlined"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            @click="isShortcutsDialogVisible = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
