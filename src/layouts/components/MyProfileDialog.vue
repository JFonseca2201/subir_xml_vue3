<script setup>
import { ref, watch, computed } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'
import avatar1 from "@images/avatars/avatar-1.png"
import { refreshPermissionsUser } from '@/composables/usePermissions'

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
    localStorage.setItem('user', JSON.stringify(updatedUser))

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
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar

  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') || 'http://127.0.0.1:8000'
  
  return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar.replace(/^\//, '')}`
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
    <VCard class="custom-dialog-card elevation-24">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-user-settings-line" />
        </div>
        <h3 class="custom-dialog-title">
          Mi Perfil & Configuración de Seguridad
        </h3>
        <p class="custom-dialog-subtitle">
          Actualiza tus datos personales y credenciales de acceso al sistema
        </p>
      </div>

      <!-- User Summary Info Card -->
      <div class="pa-4 bg-grey-lighten-4 border-bottom d-flex align-center gap-4 flex-wrap">
        <VAvatar
          size="60"
          class="elevation-2 border-avatar"
        >
          <VImg :src="avatarUrl" />
        </VAvatar>
        <div class="flex-grow-1">
          <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
            {{ props.userData.full_name || `${props.userData.name} ${props.userData.surname || ''}` }}
          </h4>
          <span class="text-body-2 text-medium-emphasis d-block font-mono">
            {{ props.userData.email }}
          </span>
          <div class="d-flex align-center gap-2 mt-1">
            <VChip
              size="x-small"
              color="primary"
              variant="flat"
              class="font-weight-bold text-uppercase"
            >
              <VIcon
                start
                icon="ri-shield-star-line"
                size="12"
              />
              {{ userRoleName }}
            </VChip>
            <VChip
              v-if="props.userData.identification"
              size="x-small"
              color="secondary"
              variant="tonal"
              class="font-mono"
            >
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
        class="border-bottom"
      >
        <VTab value="general">
          <VIcon
            start
            icon="ri-user-line"
          />
          Información General
        </VTab>
        <VTab value="security">
          <VIcon
            start
            icon="ri-lock-password-line"
          />
          Cambiar Contraseña
        </VTab>
      </VTabs>

      <VCardText class="pa-5">
        <VWindow v-model="activeTab">
          <!-- TAB 1: Información General -->
          <VWindowItem value="general">
            <VForm @submit.prevent="saveGeneralInfo">
              <VRow dense>
                <VCol
                  cols="12"
                  sm="6"
                  class="mb-3"
                >
                  <label class="custom-form-label">NOMBRES</label>
                  <VTextField
                    v-model="formData.name"
                    placeholder="Tus nombres"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-user-line"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  class="mb-3"
                >
                  <label class="custom-form-label">APELLIDOS</label>
                  <VTextField
                    v-model="formData.surname"
                    placeholder="Tus apellidos"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-user-line"
                  />
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                  class="mb-3"
                >
                  <label class="custom-form-label">DOCUMENTO DE IDENTIDAD (RUC / CÉDULA)</label>
                  <VTextField
                    v-model="formData.identification"
                    placeholder="Ej. 1712345678"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-id-card-line"
                    maxlength="13"
                    @input="e => { formData.identification = e.target.value.replace(/\D/g, '').slice(0, 13) }"
                  />
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                  class="mb-3"
                >
                  <label class="custom-form-label">TELÉFONO DE CONTACTO</label>
                  <VTextField
                    v-model="formData.phone"
                    placeholder="Ej. 0991234567"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-phone-line"
                    maxlength="10"
                    @input="e => { formData.phone = e.target.value.replace(/\D/g, '').slice(0, 10) }"
                  />
                </VCol>

                <VCol
                  cols="12"
                  class="mb-3"
                >
                  <label class="custom-form-label">CORREO ELECTRÓNICO (CUENTA DE ACCESO)</label>
                  <VTextField
                    :model-value="props.userData.email"
                    readonly
                    disabled
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-mail-line"
                    class="bg-grey-lighten-4"
                  />
                </VCol>

                <VCol
                  cols="12"
                  class="mb-3"
                >
                  <label class="custom-form-label">DIRECCIÓN DOMICILIARIA</label>
                  <VTextarea
                    v-model="formData.address"
                    placeholder="Ej. Av. 10 de Agosto y Colón"
                    variant="outlined"
                    rows="2"
                    density="comfortable"
                    prepend-inner-icon="ri-map-pin-line"
                  />
                </VCol>
              </VRow>
            </VForm>
          </VWindowItem>

          <!-- TAB 2: Cambiar Contraseña -->
          <VWindowItem value="security">
            <VForm @submit.prevent="savePassword">
              <VRow dense>
                <VCol
                  cols="12"
                  class="mb-3"
                >
                  <label class="custom-form-label">CONTRASEÑA ACTUAL <span class="text-error">*</span></label>
                  <VTextField
                    v-model="passwordData.current_password"
                    placeholder="Ingresa tu contraseña actual"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-line"
                    :type="showCurrentPassword ? 'text' : 'password'"
                    :append-inner-icon="showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="showCurrentPassword = !showCurrentPassword"
                  />
                </VCol>
                
                <VCol
                  cols="12"
                  sm="6"
                  class="mb-3"
                >
                  <label class="custom-form-label">NUEVA CONTRASEÑA <span class="text-error">*</span></label>
                  <VTextField
                    v-model="passwordData.new_password"
                    placeholder="Mínimo 6 caracteres"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-password-line"
                    :type="showNewPassword ? 'text' : 'password'"
                    :append-inner-icon="showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="showNewPassword = !showNewPassword"
                  />
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                  class="mb-3"
                >
                  <label class="custom-form-label">CONFIRMAR NUEVA CONTRASEÑA <span class="text-error">*</span></label>
                  <VTextField
                    v-model="passwordData.new_password_confirmation"
                    placeholder="Repite la nueva contraseña"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-check-line"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    :append-inner-icon="showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="showConfirmPassword = !showConfirmPassword"
                  />
                </VCol>

                <!-- Feedback Visual de Coincidencia de Contraseñas -->
                <VCol
                  v-if="passwordData.new_password || passwordData.new_password_confirmation"
                  cols="12"
                  class="mb-2"
                >
                  <VAlert
                    v-if="passwordsMatch"
                    color="success"
                    variant="tonal"
                    density="compact"
                    icon="ri-checkbox-circle-line"
                    class="rounded-lg"
                  >
                    Las contraseñas coinciden correctamente.
                  </VAlert>
                  <VAlert
                    v-else-if="passwordsMismatch"
                    color="error"
                    variant="tonal"
                    density="compact"
                    icon="ri-close-circle-line"
                    class="rounded-lg"
                  >
                    Las contraseñas no coinciden. Por favor verifica los caracteres.
                  </VAlert>
                </VCol>
              </VRow>
            </VForm>
          </VWindowItem>
        </VWindow>
      </VCardText>

      <VDivider />

      <!-- Acciones Inferiores -->
      <VCardActions class="pa-4 bg-grey-lighten-5 justify-end gap-2">
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
  border: 3px solid rgba(var(--v-theme-primary), 0.2);
}
</style>
