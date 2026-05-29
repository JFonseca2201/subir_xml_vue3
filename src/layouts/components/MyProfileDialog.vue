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
watch(() => props.isDialogVisible, (newVal) => {
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
    max-width="650"
    scrollable
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="overflow-hidden" rounded="lg">
      <VCardTitle class="d-flex align-center justify-space-between pa-4 bg-surface-light">
        <div class="d-flex align-center gap-2">
          <VAvatar color="primary" variant="tonal" size="40">
            <VIcon icon="ri-user-settings-line" />
          </VAvatar>
          <span class="text-h6 font-weight-bold">Mi Perfil</span>
        </div>
        <VBtn icon variant="text" @click="closeDialog" color="secondary">
          <VIcon icon="ri-close-line" />
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VTabs
        v-model="activeTab"
        color="primary"
        class="border-b"
      >
        <VTab value="general">
          <VIcon start icon="ri-user-line" />
          General
        </VTab>
        <VTab value="security">
          <VIcon start icon="ri-lock-password-line" />
          Seguridad
        </VTab>
      </VTabs>

      <VCardText class="pa-5">
        <VWindow v-model="activeTab">
          <!-- Pestaña General -->
          <VWindowItem value="general">
            <div class="d-flex flex-column align-center mb-6">
              <VAvatar size="90" class="elevation-2 mb-3 border-avatar">
                <VImg :src="avatarUrl" />
              </VAvatar>
              <h3 class="text-h5 font-weight-bold">{{ props.userData?.full_name || 'Usuario' }}</h3>
              <p class="text-medium-emphasis">{{ props.userData?.role?.name || 'Rol' }}</p>
            </div>

            <VRow>
              <VCol cols="12" md="6">
                <VTextField
                  :model-value="props.userData?.email"
                  label="Correo Electrónico"
                  variant="outlined"
                  density="comfortable"
                  readonly
                  prepend-inner-icon="ri-mail-line"
                  class="bg-surface-light rounded"
                  hint="No puedes cambiar tu correo principal"
                  persistent-hint
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  :model-value="props.userData?.identification || 'No registrado'"
                  label="Documento de Identidad"
                  variant="outlined"
                  density="comfortable"
                  readonly
                  prepend-inner-icon="ri-id-card-line"
                  class="bg-surface-light rounded"
                />
              </VCol>
              
              <VCol cols="12" md="6">
                <VTextField
                  v-model="formData.phone"
                  label="Teléfono"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-phone-line"
                  placeholder="Ej: 0987654321"
                />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField
                  v-model="formData.address"
                  label="Dirección"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-map-pin-line"
                  placeholder="Ciudad, Calle Principal"
                />
              </VCol>
            </VRow>

            <div class="d-flex justify-end mt-6">
              <VBtn color="primary" @click="saveGeneralInfo" :loading="loader.loading">
                <VIcon start icon="ri-save-3-line" />
                Guardar Cambios
              </VBtn>
            </div>
          </VWindowItem>

          <!-- Pestaña Seguridad -->
          <VWindowItem value="security">
            <VAlert
              color="warning"
              variant="tonal"
              icon="ri-error-warning-line"
              class="mb-6"
            >
              Asegúrate de usar una contraseña fuerte, combinando letras, números y símbolos.
            </VAlert>

            <VForm @submit.prevent="savePassword">
              <VRow>
                <VCol cols="12">
                  <VTextField
                    v-model="passwordData.current_password"
                    label="Contraseña Actual"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-unlock-line"
                    :type="showCurrentPassword ? 'text' : 'password'"
                    :append-inner-icon="showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="showCurrentPassword = !showCurrentPassword"
                  />
                </VCol>
                
                <VDivider class="my-3 mx-3" />

                <VCol cols="12" md="6">
                  <VTextField
                    v-model="passwordData.new_password"
                    label="Nueva Contraseña"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-password-line"
                    :type="showNewPassword ? 'text' : 'password'"
                    :append-inner-icon="showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="showNewPassword = !showNewPassword"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="passwordData.new_password_confirmation"
                    label="Confirmar Contraseña"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-lock-check-line"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    :append-inner-icon="showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'"
                    @click:append-inner="showConfirmPassword = !showConfirmPassword"
                  />
                </VCol>
              </VRow>

              <div class="d-flex justify-end mt-6">
                <VBtn color="primary" type="submit" :loading="loader.loading">
                  <VIcon start icon="ri-shield-check-line" />
                  Actualizar Contraseña
                </VBtn>
              </div>
            </VForm>
          </VWindowItem>
        </VWindow>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.border-avatar {
  border: 3px solid rgb(var(--v-theme-surface));
}
</style>
