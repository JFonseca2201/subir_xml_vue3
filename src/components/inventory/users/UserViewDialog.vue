<script setup>
import { computed } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  user: {
    type: Object,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const userData = computed(() => props.user || {})

const fullName = computed(() => {
  const parts = [userData.value.name, userData.value.surname].filter(Boolean)

  return parts.join(' ') || 'Sin nombre'
})

const initials = computed(() => {
  const parts = fullName.value.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'

  return parts
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
})

const avatarUrl = computed(() => {
  const avatar = userData.value.avatar
  if (!avatar) return null
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar

  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') || 'http://127.0.0.1:8000'

  return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar.replace(/^\//, '')}`
})

const isActive = computed(() => String(userData.value.status) === '1')

const statusColor = computed(() => (isActive.value ? 'success' : 'error'))
const statusLabel = computed(() => (isActive.value ? 'Activo' : 'Inactivo'))
const statusIcon = computed(() => (isActive.value ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'))

const documentTypeLabel = computed(() => {
  const map = {
    CI: 'Cédula',
    RUC: 'RUC',
    PASSPORT: 'Pasaporte',
    CE: 'Cédula extranjera',
  }

  return map[userData.value.type_document] || userData.value.type_document || 'Documento'
})

const genderLabel = computed(() => {
  const map = {
    M: 'Masculino',
    F: 'Femenino',
    O: 'Otro',
  }

  return map[userData.value.gender] || '—'
})

const roleName = computed(() => userData.value.role?.name || 'Sin rol asignado')
const sucursalName = computed(() => userData.value.sucursale?.name || '—')

const formatDate = dateString => {
  if (!dateString) return '—'
  const normalized = String(dateString).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    const [year, month, day] = String(dateString).split('T')[0].split('-')

    return `${day}/${month}/${year}`
  }

  return date.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="600"
    scrollable
    @update:model-value="closeDialog"
  >
    <VCard rounded="lg" elevation="4">
      <!-- Header Tonal -->
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <div class="d-flex align-center gap-2">
          <VAvatar color="primary" variant="tonal" size="40">
            <VIcon icon="ri-user-line" />
          </VAvatar>
          <span class="text-h6 font-weight-bold">Perfil de Usuario</span>
        </div>
        <VBtn icon variant="text" @click="closeDialog" color="secondary">
          <VIcon icon="ri-close-line" />
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText class="pa-5">
        <div
          v-if="loading"
          class="d-flex flex-column align-center justify-center py-12"
        >
          <VProgressCircular indeterminate color="primary" size="48" />
          <p class="text-body-2 text-medium-emphasis mt-4 mb-0">Cargando perfil...</p>
        </div>

        <template v-else>
          <!-- Perfil principal -->
          <div class="d-flex flex-column align-center text-center mb-6 mt-2">
            <VAvatar
              v-if="avatarUrl"
              :image="avatarUrl"
              size="100"
              class="elevation-3 mb-4"
            />
            <VAvatar
              v-else
              size="100"
              color="primary"
              variant="tonal"
              class="elevation-1 mb-4"
            >
              <span class="text-h3 font-weight-bold">{{ initials }}</span>
            </VAvatar>

            <h3 class="text-h4 font-weight-bold mb-1">{{ fullName }}</h3>
            <p class="text-medium-emphasis mb-3">{{ userData.email || 'Sin correo electrónico' }}</p>
            
            <div class="d-flex justify-center gap-2">
              <VChip :color="statusColor" variant="tonal" size="small" class="font-weight-medium">
                <VIcon start :icon="statusIcon" />
                {{ statusLabel }}
              </VChip>
              <VChip color="primary" variant="tonal" size="small" class="font-weight-medium">
                <VIcon start icon="ri-shield-user-line" />
                {{ roleName }}
              </VChip>
            </div>
          </div>

          <!-- Tarjetas de Información -->
          <VRow>
            <VCol cols="12" sm="6">
              <VCard variant="outlined" class="h-100 pa-4 rounded-lg">
                <div class="d-flex align-center gap-3 mb-3">
                  <VAvatar color="info" variant="tonal" rounded size="40">
                    <VIcon icon="ri-id-card-line" />
                  </VAvatar>
                  <div class="text-subtitle-1 font-weight-bold">Identificación</div>
                </div>
                <div class="text-body-2 text-medium-emphasis mb-1">{{ documentTypeLabel }}</div>
                <div class="text-body-1 font-weight-bold">{{ userData.identification || '—' }}</div>
              </VCard>
            </VCol>

            <VCol cols="12" sm="6">
              <VCard variant="outlined" class="h-100 pa-4 rounded-lg">
                <div class="d-flex align-center gap-3 mb-3">
                  <VAvatar color="warning" variant="tonal" rounded size="40">
                    <VIcon icon="ri-store-2-line" />
                  </VAvatar>
                  <div class="text-subtitle-1 font-weight-bold">Sucursal</div>
                </div>
                <div class="text-body-2 text-medium-emphasis mb-1">Asignada</div>
                <div class="text-body-1 font-weight-bold">{{ sucursalName }}</div>
              </VCard>
            </VCol>

            <VCol cols="12" sm="6">
              <VCard variant="outlined" class="h-100 pa-4 rounded-lg">
                <div class="d-flex align-center gap-3 mb-3">
                  <VAvatar color="success" variant="tonal" rounded size="40">
                    <VIcon icon="ri-contacts-line" />
                  </VAvatar>
                  <div class="text-subtitle-1 font-weight-bold">Contacto</div>
                </div>
                <div class="d-flex flex-column gap-2">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-phone-line" size="small" class="text-medium-emphasis" />
                    <span class="text-body-2 font-weight-medium">{{ userData.phone || '—' }}</span>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-user-heart-line" size="small" class="text-medium-emphasis" />
                    <span class="text-body-2 font-weight-medium">{{ genderLabel }}</span>
                  </div>
                </div>
              </VCard>
            </VCol>

            <VCol cols="12" sm="6">
              <VCard variant="outlined" class="h-100 pa-4 rounded-lg">
                <div class="d-flex align-center gap-3 mb-3">
                  <VAvatar color="secondary" variant="tonal" rounded size="40">
                    <VIcon icon="ri-calendar-line" />
                  </VAvatar>
                  <div class="text-subtitle-1 font-weight-bold">Registro</div>
                </div>
                <div class="text-body-2 text-medium-emphasis mb-1">Fecha de alta</div>
                <div class="text-body-1 font-weight-bold">{{ formatDate(userData.created_at) }}</div>
              </VCard>
            </VCol>
          </VRow>

          <!-- Dirección completa -->
          <VCard variant="outlined" class="mt-4 pa-4 rounded-lg">
            <div class="d-flex align-center gap-3 mb-2">
              <VIcon icon="ri-map-pin-line" color="primary" />
              <div class="text-subtitle-1 font-weight-bold">Dirección</div>
            </div>
            <div class="text-body-2 font-weight-medium px-8">
              {{ userData.address || 'Sin dirección registrada' }}
            </div>
          </VCard>
        </template>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 justify-end">
        <VBtn color="secondary" variant="tonal" class="px-6" @click="closeDialog">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
