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
  const [year, month, day] = String(dateString).split('T')[0].split('-')

  return `${day}/${month}/${year}`
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
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="640"
    scrollable
    @update:model-value="closeDialog"
  >
    <VCard
      class="partner-view-card"
      rounded="lg"
      elevation="4"
    >
      <!-- Cabecera -->
      <div class="partner-view-header d-flex align-start justify-space-between pa-5 pb-4">
        <div class="d-flex align-start gap-4 flex-grow-1 min-w-0">
          <VAvatar
            size="64"
            color="primary"
            variant="tonal"
            class="flex-shrink-0 partner-avatar"
          >
            <span class="text-h6 font-weight-bold">{{ initials }}</span>
          </VAvatar>

          <div class="min-w-0">
            <div class="text-h5 font-weight-bold text-truncate mb-1">
              {{ partner.name || 'Sin nombre' }}
            </div>
            <div class="d-flex align-center flex-wrap gap-2 mb-2">
              <VChip
                :color="identificationType.color"
                size="small"
                variant="tonal"
                label
              >
                {{ identificationType.label }}
              </VChip>
              <VChip
                color="primary"
                size="small"
                variant="outlined"
                label
                class="font-weight-medium"
              >
                <VIcon
                  start
                  icon="ri-id-card-line"
                  size="14"
                />
                {{ partner.identification || '—' }}
              </VChip>
            </div>
            <div
              v-if="partner.created_at"
              class="text-body-2 text-medium-emphasis d-inline-flex align-center gap-1"
            >
              <VIcon
                icon="ri-calendar-line"
                size="16"
              />
              Registrado el {{ formatDate(partner.created_at) }}
            </div>
          </div>
        </div>

        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="flex-shrink-0 ms-2"
          @click="closeDialog"
        />
      </div>

      <VDivider />

      <VCardText class="pa-5">
        <!-- Resumen -->
        <VRow class="mb-5">
          <VCol
            cols="12"
            :sm="totalContributions ? 6 : 12"
          >
            <div class="kpi-tile">
              <VIcon
                icon="ri-shield-user-line"
                size="22"
                color="primary"
                class="mb-2"
              />
              <div class="text-caption text-medium-emphasis">
                Tipo de identificación
              </div>
              <div class="text-body-1 font-weight-bold mt-1">
                {{ identificationType.label }}
              </div>
            </div>
          </VCol>
          <VCol
            v-if="totalContributions"
            cols="12"
            sm="6"
          >
            <div class="kpi-tile kpi-tile--accent">
              <VIcon
                icon="ri-funds-line"
                size="22"
                color="success"
                class="mb-2"
              />
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
            <VAvatar
              size="36"
              color="info"
              variant="tonal"
              class="me-3"
            >
              <VIcon
                icon="ri-contacts-line"
                size="20"
              />
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
                <VIcon
                  icon="ri-mail-line"
                  size="16"
                />
                Correo
              </span>
              <span class="info-value">
                <a
                  v-if="partner.email"
                  :href="`mailto:${partner.email}`"
                  class="contact-link"
                >{{ partner.email }}</a>
                <span
                  v-else
                  class="text-medium-emphasis"
                >—</span>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">
                <VIcon
                  icon="ri-phone-line"
                  size="16"
                />
                Teléfono
              </span>
              <span class="info-value">
                <a
                  v-if="partner.phone"
                  :href="`tel:${partner.phone}`"
                  class="contact-link"
                >{{ partner.phone }}</a>
                <span
                  v-else
                  class="text-medium-emphasis"
                >—</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Dirección -->
        <div class="section-panel">
          <div class="section-title">
            <VAvatar
              size="36"
              color="success"
              variant="tonal"
              class="me-3"
            >
              <VIcon
                icon="ri-map-pin-line"
                size="20"
              />
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

          <div
            v-if="partner.address"
            class="address-block"
          >
            <VIcon
              icon="ri-road-map-line"
              size="20"
              color="success"
              class="me-2 flex-shrink-0"
            />
            <span class="text-body-2">{{ partner.address }}</span>
          </div>
          <div
            v-else
            class="empty-hint pa-4 text-center"
          >
            <VIcon
              icon="ri-map-pin-line"
              size="32"
              color="grey-lighten-1"
              class="mb-2"
            />
            <p class="text-body-2 text-medium-emphasis mb-0">
              Sin dirección registrada
            </p>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4">
        <VSpacer />
        <VBtn
          color="secondary"
          variant="tonal"
          prepend-icon="ri-close-line"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
