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

const partnerIdentification = computed(() => {
  return partner.value.identification || partner.value.dni || partner.value.n_document || partner.value.document_number || partner.value.ruc || partner.value.cedula || ''
})

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
  const id = String(partnerIdentification.value || '').replace(/\D/g, '')
  if (id.length === 13) return { label: 'RUC', color: 'deep-purple' }
  if (id.length === 10) return { label: 'Cédula', color: 'info' }

  return { label: 'Cédula / RUC', color: 'primary' }
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
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="640"
    scrollable
    @update:model-value="closeDialog"
  >
    <VCard
      class="custom-dialog-card partner-view-card"
      rounded="lg"
      elevation="4"
    >
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
          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff;"
          >
            <VIcon
              icon="ri-id-card-line"
              size="14"
              class="me-1"
            />
            <span><strong>{{ identificationType.label }}:</strong> <span class="font-mono font-weight-bold">{{ partnerIdentification || '—' }}</span></span>
          </div>

          <div
            v-if="partner.created_at"
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff;"
          >
            <VIcon
              icon="ri-calendar-line"
              size="14"
              class="me-1"
            />
            <span><strong>Registrado:</strong> {{ formatDate(partner.created_at) }}</span>
          </div>
        </div>
      </div>

      <VCardText class="pa-5">
        <!-- Resumen KPI Tiles -->
        <VRow class="mb-5">
          <VCol
            cols="12"
            :sm="totalContributions ? 6 : 12"
          >
            <div class="kpi-tile">
              <div class="d-flex align-center justify-space-between mb-1">
                <VIcon
                  icon="ri-id-card-line"
                  size="24"
                  color="primary"
                />
                <VChip
                  size="x-small"
                  :color="identificationType.color"
                  variant="tonal"
                  class="font-weight-bold"
                >
                  {{ identificationType.label }}
                </VChip>
              </div>
              <div class="text-caption text-medium-emphasis">
                Número de Identificación
              </div>
              <div class="text-h6 font-weight-bold text-high-emphasis font-mono mt-1">
                {{ partnerIdentification || 'Sin documento' }}
              </div>
            </div>
          </VCol>
          <VCol
            v-if="totalContributions"
            cols="12"
            sm="6"
          >
            <div class="kpi-tile kpi-tile--accent">
              <div class="d-flex align-center justify-space-between mb-1">
                <VIcon
                  icon="ri-funds-line"
                  size="24"
                  color="success"
                />
                <VChip
                  v-if="contributionsCount != null"
                  size="x-small"
                  color="success"
                  variant="tonal"
                  class="font-weight-bold"
                >
                  {{ contributionsCount }} {{ contributionsCount === 1 ? 'aporte' : 'aportes' }}
                </VChip>
              </div>
              <div class="text-caption text-medium-emphasis">
                Capital Total Aportado
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
                Datos de Identidad y Contacto
              </div>
              <div class="text-caption text-medium-emphasis">
                Información del socio
              </div>
            </div>
          </div>

          <div class="info-list">
            <div class="info-row">
              <span class="info-label">
                <VIcon
                  icon="ri-id-card-line"
                  size="16"
                />
                {{ identificationType.label }}
              </span>
              <span class="info-value font-mono font-weight-bold text-high-emphasis">
                {{ partnerIdentification || '—' }}
              </span>
            </div>
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

      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
