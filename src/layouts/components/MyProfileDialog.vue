<script setup>
import { ref, watch, computed } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { useConfigStore } from '@core/stores/config'
import { $api, getStorageUrl } from '@/utils/api'
import avatar1 from "@images/avatars/avatar-1.png"
import { refreshPermissionsUser } from '@/composables/usePermissions'

const configStore = useConfigStore()

const themes = [
  {
    name: 'system',
    label: 'Sistema',
    icon: 'ri-macbook-line',
    desc: 'Sincronizar con el sistema operativo',
  },
  {
    name: 'light',
    label: 'Claro',
    icon: 'ri-sun-line',
    desc: 'Tema claro estándar de alta luminosidad',
  },
  {
    name: 'dark',
    label: 'Oscuro',
    icon: 'ri-moon-clear-line',
    desc: 'Tema oscuro elegante para baja luz',
  },
  {
    name: 'dark-glass',
    label: 'Oscuro Transparente',
    icon: 'ri-moon-cloudy-line',
    desc: 'Glassmorphism translúcido nocturno',
  },
  {
    name: 'semi-dark-glass',
    label: 'Medio Transparente',
    icon: 'ri-contrast-line',
    desc: 'Glassmorphism semioscuro equilibrado',
  },
  {
    name: 'light-glass',
    label: 'Transparente Claro',
    icon: 'ri-sun-cloudy-line',
    desc: 'Glassmorphism luminoso y translúcido',
  },
  {
    name: 'taller',
    label: 'Colores del Taller',
    icon: 'ri-tools-fill',
    desc: 'Colores oficiales: Rojo vino, blanco y gris azulado',
  },
]

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  userData: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'profile-updated'])

const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const activeTab = ref('general')

// Form data
const formData = ref({
  name: '',
  surname: '',
  phone: '',
  address: '',
  identification: '',
})

const passwordData = ref({
  current_password: '',
  new_password: '',
  new_password_confirmation: '',
})

const loadFreshProfile = async () => {
  if (!props.userData?.id) return
  try {
    const resp = await $api(`users/${props.userData.id}`, { method: 'GET' })
    if (resp && (resp.user || resp.data)) {
      const u = resp.user || resp.data

      formData.value.name = u.name || formData.value.name
      formData.value.surname = u.surname || formData.value.surname
      formData.value.phone = u.phone || formData.value.phone
      formData.value.address = u.address || formData.value.address
      formData.value.identification = u.identification || formData.value.identification

      const updatedUser = { ...props.userData, ...u }

      refreshPermissionsUser(updatedUser)
      emit('profile-updated', updatedUser)
    }
  } catch (e) {
    console.error('Error al obtener perfil fresco:', e)
  }
}

// Initialize form when dialog opens
watch(() => props.isDialogVisible, newVal => {
  if (newVal && props.userData) {
    formData.value = {
      name: props.userData.name || '',
      surname: props.userData.surname || '',
      phone: props.userData.phone || '',
      address: props.userData.address || '',
      identification: props.userData.identification || '',
    }
    passwordData.value = {
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    }
    activeTab.value = 'general'
    loadFreshProfile()
  }
})

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const selectTheme = themeName => {
  configStore.theme = themeName
  closeDialog()
}

const passwordsMatch = computed(() => {
  return passwordData.value.new_password &&
         passwordData.value.new_password_confirmation &&
         passwordData.value.new_password === passwordData.value.new_password_confirmation
})

const passwordsMismatch = computed(() => {
  return passwordData.value.new_password &&
         passwordData.value.new_password_confirmation &&
         passwordData.value.new_password !== passwordData.value.new_password_confirmation
})

const saveGeneralInfo = async () => {
  loader.start()
  try {
    const resp = await $api(`users/${props.userData.id}/profile`, {
      method: 'PUT',
      body: formData.value,
    })

    const updatedUser = resp.user || { ...props.userData, ...formData.value }

    refreshPermissionsUser(updatedUser)

    showNotification(resp.message || 'Perfil actualizado correctamente', 'success')
    emit('profile-updated', updatedUser)
    closeDialog()
  } catch (error) {
    const backendMessage = error.response?._data?.message || error.response?.data?.message || 'Error al actualizar el perfil'

    showNotification(backendMessage, 'error')
    console.error(error)
  } finally {
    loader.stop()
  }
}

const savePassword = async () => {
  if (!passwordData.value.current_password) {
    showNotification('Debe ingresar su contraseña actual', 'error')
    
    return
  }

  if (!passwordData.value.new_password) {
    showNotification('Debe ingresar la nueva contraseña', 'error')
    
    return
  }

  if (!passwordData.value.new_password_confirmation) {
    showNotification('Debe confirmar la nueva contraseña', 'error')
    
    return
  }

  if (passwordData.value.new_password !== passwordData.value.new_password_confirmation) {
    showNotification('La nueva contraseña y su confirmación no coinciden', 'error')
    
    return
  }

  if (passwordData.value.new_password.length < 6) {
    showNotification('La nueva contraseña debe tener al menos 6 caracteres', 'error')
    
    return
  }

  loader.start()
  try {
    const resp = await $api(`users/${props.userData.id}/password`, {
      method: 'PUT',
      body: {
        current_password: passwordData.value.current_password,
        new_password: passwordData.value.new_password,
        new_password_confirmation: passwordData.value.new_password_confirmation,
      },
    })

    showNotification(resp.message || 'Contraseña actualizada exitosamente', 'success')
    passwordData.value = {
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    }
    closeDialog()
  } catch (error) {
    const backendMessage = error.data?.message || error.response?._data?.message || error.response?.data?.message || error.message || 'Error al cambiar la contraseña'

    showNotification(backendMessage, 'error')
    console.error('Error al cambiar contraseña:', error)
  } finally {
    loader.stop()
  }
}

const avatarUrl = computed(() => {
  const avatar = props.userData?.avatar
  if (!avatar) return avatar1
  return getStorageUrl(avatar)
})

const userRoleName = computed(() => {
  const role = props.userData?.role
  if (!role) return 'Usuario'
  if (typeof role === 'object') return role.name || 'Usuario'
  
  return role
})

// Toggle password visibility
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="680"
    scrollable
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card elevation-24 rounded-xl overflow-hidden">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn text-white"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-user-settings-line" size="28" />
        </div>
        <h3 class="custom-dialog-title text-white">
          Mi Perfil & Configuración de Seguridad
        </h3>
        <p class="custom-dialog-subtitle text-white opacity-90">
          Actualiza tus datos personales y credenciales de acceso al sistema
        </p>
      </div>

      <!-- User Summary Info Card (Themed & High Contrast) -->
      <div class="profile-summary-bar pa-4 px-6 d-flex align-center gap-4 flex-wrap">
        <VAvatar
          size="64"
          class="elevation-2 border-avatar"
        >
          <VImg :src="avatarUrl" />
        </VAvatar>
        <div class="flex-grow-1 min-w-0">
          <h4 class="text-h6 font-weight-bold text-high-emphasis mb-0 text-truncate">
            {{ props.userData.full_name || `${props.userData.name} ${props.userData.surname || ''}` }}
          </h4>
          <span class="text-body-2 text-medium-emphasis d-block font-mono text-truncate">
            {{ props.userData.email }}
          </span>
          <div class="d-flex align-center gap-2 mt-1.5 flex-wrap">
            <VChip
              size="small"
              color="primary"
              variant="flat"
              class="font-weight-bold text-uppercase"
            >
              <VIcon
                start
                icon="ri-shield-star-line"
                size="14"
              />
              {{ userRoleName }}
            </VChip>
            <VChip
              v-if="props.userData.identification"
              size="small"
              color="info"
              variant="tonal"
              class="font-mono font-weight-semibold"
            >
              <VIcon
                start
                icon="ri-id-card-line"
                size="14"
              />
              RUC/CI: {{ props.userData.identification }}
            </VChip>
          </div>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <VTabs
        v-model="activeTab"
        color="primary"
        grow
        class="border-b"
      >
        <VTab value="general" class="font-weight-semibold">
          <VIcon
            start
            icon="ri-user-3-line"
          />
          Información Personal
        </VTab>
        <VTab value="security" class="font-weight-semibold">
          <VIcon
            start
            icon="ri-shield-keyhole-line"
          />
          Seguridad & Contraseña
        </VTab>
        <VTab value="theme" class="font-weight-semibold">
          <VIcon
            start
            icon="ri-palette-line"
          />
          Apariencia & Temas
        </VTab>
      </VTabs>

      <VCardText class="pa-5 pa-sm-6">
        <VWindow v-model="activeTab">
          <!-- TAB 1: Información General -->
          <VWindowItem value="general">
            <VForm @submit.prevent="saveGeneralInfo">
              <VRow>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="formData.name"
                    label="Nombres"
                    placeholder="Ej. Juan Carlos"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-user-line"
                    hide-details="auto"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="formData.surname"
                    label="Apellidos"
                    placeholder="Ej. Pérez Gómez"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-user-line"
                    hide-details="auto"
                  />
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="formData.identification"
                    label="Documento de Identidad (Cédula / RUC)"
                    placeholder="Ej. 1712345678"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-id-card-line"
                    hide-details="auto"
                    maxlength="13"
                    @input="e => { formData.identification = e.target.value.replace(/\D/g, '').slice(0, 13) }"
                  />
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="formData.phone"
                    label="Teléfono de Contacto"
                    placeholder="Ej. 0991234567"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-phone-line"
                    hide-details="auto"
                    maxlength="10"
                    @input="e => { formData.phone = e.target.value.replace(/\D/g, '').slice(0, 10) }"
                  />
                </VCol>

                <VCol cols="12">
                  <VTextField
                    :model-value="props.userData.email"
                    label="Correo Electrónico (Cuenta de Acceso)"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-mail-line"
                    append-inner-icon="ri-lock-2-line"
                    readonly
                    persistent-hint
                    hint="El correo electrónico está vinculado a tu cuenta y no puede modificarse directamente"
                    class="email-readonly-field"
                    hide-details="auto"
                  />
                </VCol>

                <VCol cols="12">
                  <VTextarea
                    v-model="formData.address"
                    label="Dirección Domiciliaria"
                    placeholder="Ej. Av. 10 de Agosto y Colón"
                    variant="outlined"
                    rows="2"
                    auto-grow
                    density="comfortable"
                    prepend-inner-icon="ri-map-pin-line"
                    hide-details="auto"
                  />
                </VCol>
              </VRow>
            </VForm>
          </VWindowItem>

          <!-- TAB 2: Cambiar Contraseña -->
          <VWindowItem value="security">
            <VForm @submit.prevent="savePassword">
              <VRow>
                <!-- Helper card -->
                <VCol cols="12">
                  <div class="password-advice-card pa-3.5 rounded-lg d-flex align-center gap-3">
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      size="36"
                      rounded="lg"
                    >
                      <VIcon
                        icon="ri-shield-keyhole-line"
                        size="20"
                      />
                    </VAvatar>
                    <div class="text-caption text-medium-emphasis">
                      Para garantizar la protección de tu cuenta, ingresa tu contraseña actual e introduce una nueva que contenga al menos 6 caracteres.
                    </div>
                  </div>
                </VCol>

                <VCol cols="12">
                  <VTextField
                    v-model="passwordData.current_password"
                    label="Contraseña Actual *"
                    placeholder="Ingresa tu contraseña actual"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-line"
                    :type="showCurrentPassword ? 'text' : 'password'"
                    :append-inner-icon="showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    hide-details="auto"
                    @click:append-inner="showCurrentPassword = !showCurrentPassword"
                  />
                </VCol>
                
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="passwordData.new_password"
                    label="Nueva Contraseña *"
                    placeholder="Mínimo 6 caracteres"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-password-line"
                    :type="showNewPassword ? 'text' : 'password'"
                    :append-inner-icon="showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    hide-details="auto"
                    @click:append-inner="showNewPassword = !showNewPassword"
                  />
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="passwordData.new_password_confirmation"
                    label="Confirmar Nueva Contraseña *"
                    placeholder="Repite la nueva contraseña"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-check-line"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    :append-inner-icon="showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    hide-details="auto"
                    @click:append-inner="showConfirmPassword = !showConfirmPassword"
                  />
                </VCol>

                <!-- Feedback Visual de Coincidencia de Contraseñas -->
                <VCol
                  v-if="passwordData.new_password || passwordData.new_password_confirmation"
                  cols="12"
                >
                  <VAlert
                    v-if="passwordsMatch"
                    color="success"
                    variant="tonal"
                    density="comfortable"
                    icon="ri-checkbox-circle-line"
                    class="rounded-lg"
                  >
                    Las contraseñas coinciden correctamente.
                  </VAlert>
                  <VAlert
                    v-else-if="passwordsMismatch"
                    color="error"
                    variant="tonal"
                    density="comfortable"
                    icon="ri-close-circle-line"
                    class="rounded-lg"
                  >
                    Las contraseñas no coinciden. Por favor verifica los caracteres.
                  </VAlert>
                </VCol>
              </VRow>
            </VForm>
          </VWindowItem>
          <!-- TAB 3: Apariencia & Temas -->
          <VWindowItem value="theme">
            <div class="mb-4">
              <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
                Selecciona tu Tema de Interfaz
              </h4>
              <p class="text-caption text-medium-emphasis mb-4">
                Personaliza la apariencia visual del sistema según tus preferencias. Los cambios se aplican de forma inmediata.
              </p>

              <VRow dense>
                <VCol
                  v-for="thm in themes"
                  :key="thm.name"
                  cols="12"
                  sm="6"
                >
                  <VCard
                    variant="outlined"
                    class="pa-3 rounded-xl cursor-pointer transition-swing theme-choice-card mb-2"
                    :class="{ 'theme-choice-card--active': configStore.theme === thm.name }"
                    @click="selectTheme(thm.name)"
                  >
                    <div class="d-flex align-center justify-space-between">
                      <div class="d-flex align-center gap-3">
                        <VAvatar
                          :color="configStore.theme === thm.name ? 'primary' : 'secondary'"
                          :variant="configStore.theme === thm.name ? 'elevated' : 'tonal'"
                          size="38"
                          class="rounded-lg"
                        >
                          <VIcon :icon="thm.icon" size="20" />
                        </VAvatar>
                        <div>
                          <div class="text-body-2 font-weight-bold">
                            {{ thm.label }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{ thm.desc }}
                          </div>
                        </div>
                      </div>

                      <VIcon
                        v-if="configStore.theme === thm.name"
                        icon="ri-checkbox-circle-fill"
                        color="primary"
                        size="22"
                      />
                      <VIcon
                        v-else
                        icon="ri-checkbox-blank-circle-line"
                        color="secondary"
                        size="20"
                        class="opacity-40"
                      />
                    </div>
                  </VCard>
                </VCol>
              </VRow>
            </div>
          </VWindowItem>
        </VWindow>
      </VCardText>

      <VDivider />

      <!-- Acciones Inferiores -->
      <VCardActions class="pa-4 px-6 custom-dialog-actions d-flex justify-end gap-3 flex-wrap">
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-5 font-weight-medium"
          :disabled="loader.loading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>

        <VBtn
          v-if="activeTab === 'general'"
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-3-line"
          class="rounded-lg px-6 font-weight-bold"
          :loading="loader.loading"
          :disabled="loader.loading"
          @click="saveGeneralInfo"
        >
          Guardar Cambios
        </VBtn>

        <VBtn
          v-if="activeTab === 'security'"
          color="primary"
          variant="elevated"
          prepend-icon="ri-key-2-line"
          class="rounded-lg px-6 font-weight-bold"
          :loading="loader.loading"
          :disabled="loader.loading || passwordsMismatch"
          @click="savePassword"
        >
          Actualizar Contraseña
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.border-avatar {
  border: 2px solid rgba(var(--v-theme-primary), 0.45);
  box-shadow: 0 4px 14px rgba(var(--v-theme-primary), 0.2);
}

.profile-summary-bar {
  background: rgba(var(--v-theme-surface), 0.65);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.password-advice-card {
  background: rgba(var(--v-theme-primary), 0.08);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.custom-dialog-actions {
  background: rgba(var(--v-theme-surface), 0.5);
}

.email-readonly-field :deep(.v-field) {
  background-color: rgba(var(--v-theme-on-surface), 0.03) !important;
}

.theme-choice-card {
  border-color: rgba(var(--v-border-color), 0.15) !important;
  background-color: rgba(var(--v-theme-surface), 0.7);
  transition: all 0.2s ease-in-out;
}

.theme-choice-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.5) !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(var(--v-theme-primary), 0.12);
}

.theme-choice-card--active {
  border-color: rgb(var(--v-theme-primary)) !important;
  border-width: 2px !important;
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}
</style>
