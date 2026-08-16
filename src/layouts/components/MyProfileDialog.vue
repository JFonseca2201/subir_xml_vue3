<script setup>
import { ref, watch, computed } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import avatar1 from "@images/avatars/avatar-1.png"

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
  phone: '',
  address: '',
})

const passwordData = ref({
  current_password: '',
  new_password: '',
  new_password_confirmation: '',
})

// Initialize form when dialog opens
watch(() => props.isDialogVisible, newVal => {
  if (newVal && props.userData) {
    formData.value = {
      phone: props.userData.phone || '',
      address: props.userData.address || '',
    }
    passwordData.value = {
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    }
    activeTab.value = 'general'
  }
})

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const saveGeneralInfo = async () => {
  loader.start()
  try {
    // Aquí iría tu llamada a la API para actualizar el perfil
    // const resp = await $api(`users/${props.userData.id}/profile`, {
    //   method: 'PUT',
    //   body: formData.value
    // })

    // Simulación de guardado
    await new Promise(resolve => setTimeout(resolve, 800))

    // Actualizar localStorage simulado
    const updatedUser = { ...props.userData, ...formData.value }

    localStorage.setItem('user', JSON.stringify(updatedUser))

    showNotification('Perfil actualizado correctamente', 'success')
    emit('profile-updated', updatedUser)
    closeDialog()
  } catch (error) {
    console.error(error)
    showNotification('Error al actualizar el perfil', 'error')
  } finally {
    loader.stop()
  }
}

const savePassword = async () => {
  if (passwordData.value.new_password !== passwordData.value.new_password_confirmation) {
    showNotification('Las contraseñas nuevas no coinciden', 'error')
    
    return
  }
  
  if (passwordData.value.new_password.length < 6) {
    showNotification('La contraseña debe tener al menos 6 caracteres', 'error')
    
    return
  }

  loader.start()
  try {
    // Aquí iría tu llamada a la API para cambiar contraseña
    // const resp = await $api(`users/${props.userData.id}/password`, {
    //   method: 'PUT',
    //   body: passwordData.value
    // })

    // Simulación
    await new Promise(resolve => setTimeout(resolve, 800))

    showNotification('Contraseña cambiada exitosamente', 'success')
    closeDialog()
  } catch (error) {
    console.error(error)
    showNotification('Error al cambiar la contraseña', 'error')
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
          Mi Perfil de Usuario
        </h3>
        <p class="custom-dialog-subtitle">
          Información personal, datos de contacto y seguridad de la cuenta
        </p>
      </div>

      <!-- Pestañas de Navegación -->
      <VTabs
        v-model="activeTab"
        color="primary"
        align-tabs="center"
        class="border-b bg-grey-lighten-5"
      >
        <VTab value="general" class="font-weight-bold">
          <VIcon
            start
            icon="ri-user-line"
            size="18"
          />
          Datos Personales
        </VTab>
        <VTab value="security" class="font-weight-bold">
          <VIcon
            start
            icon="ri-shield-keyhole-line"
            size="18"
          />
          Seguridad & Contraseña
        </VTab>
      </VTabs>

      <VCardText class="pa-6">
        <VWindow v-model="activeTab">
          <!-- Pestaña General -->
          <VWindowItem value="general">
            <!-- HERO CARD DE USUARIO -->
            <div class="bg-grey-lighten-4 rounded-xl pa-5 mb-6 border d-flex flex-column flex-sm-row align-center justify-space-between gap-4">
              <div class="d-flex align-center gap-4 text-center text-sm-left flex-column flex-sm-row">
                <VAvatar
                  size="72"
                  class="elevation-3 border-avatar"
                >
                  <VImg :src="avatarUrl" />
                </VAvatar>
                <div>
                  <h3 class="text-h6 font-weight-bold text-high-emphasis mb-1">
                    {{ props.userData?.full_name || `${props.userData?.name || ''} ${props.userData?.surname || ''}` || 'Usuario' }}
                  </h3>
                  <div class="d-flex flex-wrap align-center justify-center justify-sm-start gap-2">
                    <VChip
                      size="small"
                      color="primary"
                      variant="elevated"
                      class="font-weight-bold text-uppercase"
                    >
                      <VIcon start icon="ri-shield-user-line" size="14" />
                      {{ props.userData?.role?.name || 'Administrador' }}
                    </VChip>
                    <span class="text-caption text-medium-emphasis font-mono">
                      {{ props.userData?.email }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Formulario Datos Generales -->
            <VRow dense>
              <VCol cols="12" sm="6" class="mb-3">
                <label class="custom-form-label">CORREO ELECTRÓNICO</label>
                <VTextField
                  :model-value="props.userData?.email"
                  variant="outlined"
                  density="comfortable"
                  readonly
                  prepend-inner-icon="ri-mail-line"
                  class="bg-grey-lighten-5"
                />
              </VCol>

              <VCol cols="12" sm="6" class="mb-3">
                <label class="custom-form-label">DOCUMENTO DE IDENTIDAD</label>
                <VTextField
                  :model-value="props.userData?.identification || 'No registrado'"
                  variant="outlined"
                  density="comfortable"
                  readonly
                  prepend-inner-icon="ri-id-card-line"
                  class="bg-grey-lighten-5"
                />
              </VCol>
              
              <VCol cols="12" sm="6" class="mb-3">
                <label class="custom-form-label">NÚMERO DE TELÉFONO</label>
                <VTextField
                  v-model="formData.phone"
                  placeholder="Ej: 0987654321"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-phone-line"
                />
              </VCol>

              <VCol cols="12" sm="6" class="mb-3">
                <label class="custom-form-label">DIRECCIÓN DOMICILIARIA</label>
                <VTextField
                  v-model="formData.address"
                  placeholder="Ciudad, Calle Principal"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-map-pin-line"
                />
              </VCol>
            </VRow>
          </VWindowItem>

          <!-- Pestaña Seguridad -->
          <VWindowItem value="security">
            <VAlert
              color="primary"
              variant="tonal"
              icon="ri-shield-check-line"
              class="mb-6 rounded-xl"
            >
              Para mayor seguridad, te recomendamos usar una contraseña de al menos 8 caracteres con letras y números.
            </VAlert>

            <VForm @submit.prevent="savePassword">
              <VRow dense>
                <VCol cols="12" class="mb-3">
                  <label class="custom-form-label">CONTRASEÑA ACTUAL</label>
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
                
                <VCol cols="12" sm="6" class="mb-3">
                  <label class="custom-form-label">NUEVA CONTRASEÑA</label>
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

                <VCol cols="12" sm="6" class="mb-3">
                  <label class="custom-form-label">CONFIRMAR NUEVA CONTRASEÑA</label>
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
          @click="saveGeneralInfo"
        >
          Guardar Cambios
        </VBtn>

        <VBtn
          v-else
          color="primary"
          variant="elevated"
          prepend-icon="ri-shield-check-line"
          class="rounded-lg px-6 font-weight-bold"
          :loading="loader.loading"
          @click="savePassword"
        >
          Actualizar Contraseña
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
