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

const isPartnerActive = computed(() => {
  if (partner.value.is_active !== undefined && partner.value.is_active !== null) {
    return partner.value.is_active === true || partner.value.is_active === 1 || partner.value.is_active === '1'
  }
  if (partner.value.status !== undefined && partner.value.status !== null) {
    return partner.value.status === 'active' || partner.value.status === 1 || partner.value.status === '1'
  }
  return true
})

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="680"
    scrollable
    persistent
    transition="dialog-bottom-transition"
    @update:model-value="closeDialog"
  >
    <VCard
      class="custom-dialog-card partner-dialog-card elevation-12"
      rounded="lg"
    >
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
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
        <h3 class="custom-dialog-title text-capitalize">
          {{ partner.name || 'Ficha de Socio' }}
        </h3>
        <p class="custom-dialog-subtitle mb-2">
          Información detallada y capital acumulado del socio
        </p>

        <!-- Header Pills (Sin duplicar cédula) -->
        <div class="d-flex flex-wrap justify-center gap-2 mt-2">
          <!-- Estado -->
          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-bold"
            :style="isPartnerActive ? 'background: rgba(16, 185, 129, 0.25); color: #ffffff; border: 1px solid rgba(16, 185, 129, 0.5);' : 'background: rgba(239, 68, 68, 0.25); color: #ffffff; border: 1px solid rgba(239, 68, 68, 0.5);'"
          >
            <VIcon
              :icon="isPartnerActive ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'"
              size="14"
              class="me-1"
            />
            <span>{{ isPartnerActive ? 'Activo' : 'Inactivo' }}</span>
          </div>

          <!-- ID del Socio -->
          <div
            v-if="partner.id"
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.28);"
          >
            <VIcon
              icon="ri-hashtag"
              size="14"
              class="me-1"
            />
            <span>Socio #{{ partner.id }}</span>
          </div>

          <!-- Fecha de Registro -->
          <div
            v-if="partner.created_at"
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.28);"
          >
            <VIcon
              icon="ri-calendar-line"
              size="14"
              class="me-1"
            />
            <span>Registrado: {{ formatDate(partner.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Contenido Principal -->
      <VCardText class="pa-6">
        <!-- Grid de Especificaciones Rápidas (Brochure Style) -->
        <div class="specs-container mb-6">
          <div class="spec-badge-card">
            <span class="spec-label">Documento</span>
            <span class="spec-value text-primary font-weight-bold">{{ identificationType.label }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Número</span>
            <span class="spec-value font-weight-bold font-mono">{{ partnerIdentification || 'Sin documento' }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Teléfono</span>
            <span class="spec-value font-weight-bold">{{ partner.phone || 'N/A' }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Capital Total</span>
            <span
              class="spec-value font-weight-bold"
              :class="totalContributions ? 'text-success' : 'text-medium-emphasis'"
            >
              {{ totalContributions || '$0.00' }}
            </span>
          </div>
        </div>

        <VRow>
          <!-- Tarjeta: Datos del Socio -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4 h-100 info-card-flat"
              variant="outlined"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title text-primary">
                <VIcon
                  icon="ri-user-3-line"
                  color="primary"
                  class="me-2"
                  size="20"
                />
                Datos del Socio
              </VCardTitle>

              <VRow
                no-gutters
                class="gap-y-3"
              >
                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">
                    Nombre Completo / Razón Social
                  </div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 text-uppercase mt-0.5">
                    {{ partner.name || 'No especificado' }}
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">
                    Estado en el Sistema
                  </div>
                  <div class="mt-1">
                    <VChip
                      :color="isPartnerActive ? 'success' : 'error'"
                      variant="tonal"
                      size="small"
                      class="font-weight-bold"
                    >
                      <VIcon
                        start
                        :icon="isPartnerActive ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'"
                        size="14"
                      />
                      {{ isPartnerActive ? 'Activo' : 'Inactivo' }}
                    </VChip>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">
                    Fecha de Registro
                  </div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 mt-0.5">
                    {{ formatDate(partner.created_at) }}
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta: Ubicación y Domicilio -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4 h-100 info-card-flat"
              variant="outlined"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title text-warning">
                <VIcon
                  icon="ri-map-pin-line"
                  color="warning"
                  class="me-2"
                  size="20"
                />
                Ubicación y Domicilio
              </VCardTitle>

              <VRow
                no-gutters
                class="gap-y-3"
              >
                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">
                    Dirección Registrada
                  </div>
                  <div
                    v-if="partner.address"
                    class="address-box pa-3 rounded-lg mt-1.5 d-flex align-start"
                  >
                    <VIcon
                      icon="ri-road-map-line"
                      color="warning"
                      size="18"
                      class="me-2 mt-0.5 flex-shrink-0"
                    />
                    <span class="text-body-2 font-weight-medium text-grey-darken-3 text-uppercase">
                      {{ partner.address }}
                    </span>
                  </div>
                  <div
                    v-else
                    class="empty-address-box pa-4 rounded-lg mt-1.5 text-center"
                  >
                    <VIcon
                      icon="ri-map-pin-line"
                      size="24"
                      color="grey-lighten-1"
                      class="mb-1"
                    />
                    <div class="text-caption text-medium-emphasis">
                      Sin dirección registrada
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta: Canales de Contacto Directo -->
          <VCol
            cols="12"
            class="pt-3"
          >
            <VCard
              class="pa-4 info-card-flat"
              variant="outlined"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-3 section-title text-success">
                <VIcon
                  icon="ri-contacts-line"
                  color="success"
                  class="me-2"
                  size="18"
                />
                Canales de Contacto Directo
              </VCardTitle>

              <VRow
                no-gutters
                class="gap-y-2"
              >
                <VCol
                  cols="12"
                  sm="6"
                >
                  <div class="text-caption text-medium-emphasis">
                    Teléfono Móvil / WhatsApp
                  </div>
                  <div class="mt-1">
                    <a
                      v-if="partner.phone"
                      :href="`tel:${partner.phone}`"
                      class="contact-link text-body-2 font-weight-bold text-success d-inline-flex align-center"
                    >
                      <VIcon
                        icon="ri-phone-line"
                        size="16"
                        class="me-1.5 text-success"
                      />
                      {{ partner.phone }}
                    </a>
                    <span
                      v-else
                      class="text-body-2 text-medium-emphasis"
                    >
                      No registrado
                    </span>
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                >
                  <div class="text-caption text-medium-emphasis">
                    Correo Electrónico
                  </div>
                  <div class="mt-1">
                    <a
                      v-if="partner.email"
                      :href="`mailto:${partner.email}`"
                      class="contact-link text-body-2 font-weight-bold text-info d-inline-flex align-center"
                    >
                      <VIcon
                        icon="ri-mail-line"
                        size="16"
                        class="me-1.5 text-info"
                      />
                      {{ partner.email }}
                    </a>
                    <span
                      v-else
                      class="text-body-2 text-medium-emphasis"
                    >
                      No registrado
                    </span>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta: Resumen de Aportaciones (si tiene) -->
          <VCol
            v-if="totalContributions || contributionsCount"
            cols="12"
            class="pt-3"
          >
            <VCard
              class="pa-4 info-card-flat border-success-subtle"
              variant="outlined"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-3 section-title text-success">
                <VIcon
                  icon="ri-funds-line"
                  color="success"
                  class="me-2"
                  size="18"
                />
                Resumen de Aportaciones de Capital
              </VCardTitle>

              <VRow
                no-gutters
                class="align-center"
              >
                <VCol
                  cols="12"
                  sm="6"
                >
                  <div class="text-caption text-medium-emphasis">
                    Capital Total Acumulado
                  </div>
                  <div class="text-h6 font-weight-bold text-success mt-0.5">
                    {{ totalContributions }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  class="text-sm-end mt-2 mt-sm-0"
                >
                  <VChip
                    v-if="contributionsCount != null"
                    color="success"
                    variant="tonal"
                    class="font-weight-bold"
                    size="small"
                  >
                    <VIcon
                      start
                      icon="ri-hand-coin-line"
                      size="14"
                    />
                    {{ contributionsCount }} {{ contributionsCount === 1 ? 'aporte registrado' : 'aportes registrados' }}
                  </VChip>
                </VCol>
              </VRow>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Footer con botones -->
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

<style scoped lang="scss">
.address-box {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}

.empty-address-box {
  background-color: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.contact-link {
  text-decoration: none;
  transition: opacity 0.2s ease, text-decoration 0.2s ease;

  &:hover {
    text-decoration: underline;
    opacity: 0.85;
  }
}

.border-success-subtle {
  border-color: rgba(16, 185, 129, 0.3) !important;
  background-color: rgba(16, 185, 129, 0.02) !important;
}
</style>
