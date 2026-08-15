<script setup>
import { computed } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  partnerSelected: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:isDialogVisible'])

const partner = computed(() => props.partnerSelected || {})

const initials = computed(() => {
  const parts = String(partner.value.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return 'S'

  return parts
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
})

const identificationType = computed(() => {
  const id = String(partner.value.identification || '').replace(/\D/g, '')
  if (id.length === 13) return { label: 'RUC', color: 'deep-purple' }
  if (id.length === 10) return { label: 'Cédula', color: 'info' }

  return { label: 'Documento', color: 'secondary' }
})

const totalContributions = computed(() => {
  if (partner.value.formatted_total_contributions) {
    return partner.value.formatted_total_contributions
  }
  if (partner.value.total_contributions != null) {
    return formatCurrency(partner.value.total_contributions)
  }
  if (Array.isArray(partner.value.contributions) && partner.value.contributions.length) {
    const sum = partner.value.contributions.reduce((acc, c) => acc + (Number(c.amount) || 0), 0)

    return formatCurrency(sum)
  }

  return null
})

const contributionsCount = computed(() => {
  if (Array.isArray(partner.value.contributions)) {
    return partner.value.contributions.length
  }

  return partner.value.contributions_count ?? null
})

const formatDate = dateString => {
  if (!dateString) return '—'
  const dateOnly = String(dateString).replace('T', ' ').split(' ')[0]
  const parts = dateOnly.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }
  return dateString
}

const formatCurrency = value => new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
}).format(value || 0)

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog :model-value="props.isDialogVisible" max-width="640" scrollable @update:model-value="closeDialog">
    <VCard class="custom-dialog-card partner-view-card" rounded="lg" elevation="4">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn" @click="closeDialog" />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-user-star-line" />
        </div>
        <h3 class="custom-dialog-title">
          {{ partner.name || 'Ficha de Socio' }}
        </h3>
        <p class="custom-dialog-subtitle mb-2">
          Información detallada y capital acumulado del socio
        </p>

        <!-- Metadata Pills en la Cabecera -->
        <div class="d-flex flex-wrap justify-center gap-2 mt-2">
          <div class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium" style="background: rgba(255, 255, 255, 0.18); color: #ffffff;">
            <VIcon icon="ri-id-card-line" size="14" class="me-1" />
            <span><strong>{{ identificationType.label }}:</strong> {{ partner.identification || '—' }}</span>
          </div>

          <div v-if="partner.created_at" class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium" style="background: rgba(255, 255, 255, 0.18); color: #ffffff;">
            <VIcon icon="ri-calendar-line" size="14" class="me-1" />
            <span><strong>Registrado:</strong> {{ formatDate(partner.created_at) }}</span>
          </div>
        </div>
      </div>

      <VCardText class="pa-5">
        <!-- Resumen -->
        <VRow class="mb-5">
          <VCol cols="12" :sm="totalContributions ? 6 : 12">
            <div class="kpi-tile">
              <VIcon icon="ri-shield-user-line" size="22" color="primary" class="mb-2" />
              <div class="text-caption text-medium-emphasis">
                Tipo de identificación
              </div>
              <div class="text-body-1 font-weight-bold mt-1">
                {{ identificationType.label }}
              </div>
            </div>
          </VCol>
          <VCol v-if="totalContributions" cols="12" sm="6">
            <div class="kpi-tile kpi-tile--accent">
              <VIcon icon="ri-funds-line" size="22" color="success" class="mb-2" />
              <div class="text-caption text-medium-emphasis">
                Aportes registrados
                <span v-if="contributionsCount != null"> ({{ contributionsCount }})</span>
              </div>
              <div class="text-h6 font-weight-bold text-success mt-1">
                {{ totalContributions }}
              </div>
            </div>
          </VCol>
        </VRow>

        <!-- Contacto -->
        <div class="section-panel mb-4">
          <div class="section-title">
            <VAvatar size="36" color="info" variant="tonal" class="me-3">
              <VIcon icon="ri-contacts-line" size="20" />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold">
                Contacto
              </div>
              <div class="text-caption text-medium-emphasis">
                Medios de comunicación del socio
              </div>
            </div>
          </div>

          <div class="info-list">
            <div class="info-row">
              <span class="info-label">
                <VIcon icon="ri-mail-line" size="16" />
                Correo
              </span>
              <span class="info-value">
                <a v-if="partner.email" :href="`mailto:${partner.email}`" class="contact-link">{{ partner.email }}</a>
                <span v-else class="text-medium-emphasis">—</span>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">
                <VIcon icon="ri-phone-line" size="16" />
                Teléfono
              </span>
              <span class="info-value">
                <a v-if="partner.phone" :href="`tel:${partner.phone}`" class="contact-link">{{ partner.phone }}</a>
                <span v-else class="text-medium-emphasis">—</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Dirección -->
        <div class="section-panel">
          <div class="section-title">
            <VAvatar size="36" color="success" variant="tonal" class="me-3">
              <VIcon icon="ri-map-pin-line" size="20" />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold">
                Ubicación
              </div>
              <div class="text-caption text-medium-emphasis">
                Dirección registrada
              </div>
            </div>
          </div>

          <div v-if="partner.address" class="address-block">
            <VIcon icon="ri-road-map-line" size="20" color="success" class="me-2 flex-shrink-0" />
            <span class="text-body-2">{{ partner.address }}</span>
          </div>
          <div v-else class="empty-hint pa-4 text-center">
            <VIcon icon="ri-map-pin-line" size="32" color="grey-lighten-1" class="mb-2" />
            <p class="text-body-2 text-medium-emphasis mb-0">
              Sin dirección registrada
            </p>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4">
        <VSpacer />
        <VBtn color="secondary" variant="tonal" prepend-icon="ri-close-line" @click="closeDialog">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
