<script setup>
import { ref } from 'vue'
import { PerfectScrollbar } from "vue3-perfect-scrollbar"
import avatar1 from "@images/avatars/avatar-1.png"
import { useRouter } from "vue-router"
import { useLoaderStore } from '@/stores/loader'
import MyProfileDialog from './MyProfileDialog.vue'

const userProfileList = [
  {
    type: "navItem",
    icon: "ri-user-line",
    title: "Mi Perfil",
    action: "open_profile",
  },
  {
    type: "navItem",
    icon: "ri-settings-4-line",
    title: "Configuración",
    href: "javascript:void(0)",
  },
  {
    type: "navItem",
    icon: "ri-file-text-line",
    title: "Plan de Facturación",
    href: "javascript:void(0)",
    chipsProps: {
      color: "error",
      text: "4",
      size: "small",
      variant: "elevated"
    },
  },
  { type: "divider" },
  {
    type: "navItem",
    icon: "ri-money-dollar-circle-line",
    title: "Precios",
    href: "javascript:void(0)",
  },
  {
    type: "navItem",
    icon: "ri-question-line",
    title: "Ayuda / FAQ",
    href: "javascript:void(0)",
  },
]

const user = ref(localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null)
const loader = useLoaderStore()
const router = useRouter()

const isProfileDialogVisible = ref(false)

const handleProfileUpdate = (updatedUser) => {
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
          activator="parent"
          width="280"
          location="bottom end"
          offset="18px"
          transition="scale-transition"
        >
          <VList class="pa-0 rounded-xl overflow-hidden elevation-4 border">
            
            <!-- Modern Profile Header -->
            <div class="user-profile-header pa-5 d-flex flex-column align-center text-center">
              <VAvatar size="70" class="elevation-3 mb-3 border-avatar">
                <VImg :src="user && user.avatar ? user.avatar : avatar1" />
              </VAvatar>
              <div v-if="user">
                <div class="text-h6 font-weight-bold text-high-emphasis mb-1">
                  {{ user.full_name || 'Usuario' }}
                </div>
                <VChip size="small" color="primary" variant="tonal" class="font-weight-medium px-4">
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
            <PerfectScrollbar :options="{ wheelPropagation: false }" class="px-3 py-2">
              <VList nav density="compact" class="pa-0">
                <template
                  v-for="item in userProfileList"
                  :key="item.title"
                >
                  <VListItem
                    v-if="item.type === 'navItem'"
                    :href="item.href"
                    color="primary"
                    class="rounded-lg mb-1 nav-item-hover"
                    @click="item.action === 'open_profile' ? isProfileDialogVisible = true : null"
                  >
                    <template #prepend>
                      <VAvatar color="primary" variant="tonal" size="32" class="me-3">
                        <VIcon
                          :icon="item.icon"
                          size="18"
                        />
                      </VAvatar>
                    </template>

                    <VListItemTitle class="font-weight-medium text-body-2">{{ item.title }}</VListItemTitle>

                    <template
                      v-if="item.chipsProps"
                      #append
                    >
                      <VChip
                        v-bind="item.chipsProps"
                        class="font-weight-bold"
                      />
                    </template>
                  </VListItem>

                  <VDivider
                    v-else
                    class="my-2 border-opacity-50"
                  />
                </template>
              </VList>

              <!-- Logout Button -->
              <div class="mt-3 mb-1 px-1">
                <VBtn
                  block
                  color="error"
                  variant="tonal"
                  prepend-icon="ri-logout-circle-r-line"
                  class="rounded-lg font-weight-bold"
                  size="large"
                  :loading="loader.loading"
                  :disabled="loader.loading"
                  @click="logout"
                >
                  Cerrar sesión
                </VBtn>
              </div>
            </PerfectScrollbar>
          </VList>
        </VMenu>
        <!-- !SECTION -->
      </VAvatar>
    </VBadge>

    <MyProfileDialog
      v-if="user"
      v-model:is-dialog-visible="isProfileDialogVisible"
      :user-data="user"
      @profile-updated="handleProfileUpdate"
    />
  </div>
</template>

<style lang="scss">
.user-profile-badge {
  &.v-badge--bordered.v-badge--dot .v-badge__badge::after {
    color: rgb(var(--v-theme-background));
  }
}

.hover-scale {
  transition: transform 0.2s ease-in-out;
  &:hover {
    transform: scale(1.05);
  }
}

.user-profile-header {
  background: linear-gradient(145deg, rgba(var(--v-theme-primary), 0.08) 0%, rgba(var(--v-theme-primary), 0.02) 100%);
}

.border-avatar {
  border: 3px solid rgb(var(--v-theme-surface));
}

.nav-item-hover {
  transition: all 0.2s ease;
  &:hover {
    background: rgba(var(--v-theme-primary), 0.04);
    transform: translateX(4px);
  }
}
</style>
