<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  clientData: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:isDialogVisible'])

// Opciones para selects (solo para mostrar labels)
const typeClientOptions = ref([
  { title: 'Natural', value: 1 },
  { title: 'Jurídico o Compañía', value: 2 },
])

const typeDocumentOptions = ref([
  { title: 'Cédula', value: 1 },
  { title: 'RUC', value: 2 },
  { title: 'Pasaporte', value: 3 },
])

const stateOptions = ref([
  { title: 'Activo', value: 1 },
  { title: 'Inactivo', value: 2 },
])

const genderOptions = ref([
  { title: 'Masculino', value: '1' },
  { title: 'Femenino', value: '2' },
])

// Computed properties para obtener labels
const getClientTypeLabel = computed(() => {
  if (!props.clientData?.type_client) return 'No especificado'
  const option = typeClientOptions.value.find(opt => opt.value.toString() === props.clientData.type_client.toString())
  
  return option ? option.title : 'No especificado'
})

const getDocumentTypeLabel = computed(() => {
  if (!props.clientData?.type_document) return 'No especificado'
  const option = typeDocumentOptions.value.find(opt => opt.value.toString() === props.clientData.type_document.toString())
  
  return option ? option.title : 'No especificado'
})

const getStateLabel = computed(() => {
  if (!props.clientData?.state) return 'No especificado'
  const option = stateOptions.value.find(opt => opt.value.toString() === props.clientData.state.toString())
  
  return option ? option.title : 'No especificado'
})

const getGenderLabel = computed(() => {
  if (!props.clientData?.gender) return 'No especificado'
  const option = genderOptions.value.find(opt => opt.value === props.clientData.gender.toString())
  
  return option ? option.title : 'No especificado'
})

// Computed para determinar si es cliente empresa
const isCompanyClient = computed(() => {
  return props.clientData?.type_client?.toString() === '2'
})

// Computed para obtener el nombre completo
const fullName = computed(() => {
  if (!props.clientData) return ''

  if (isCompanyClient.value) {
    return props.clientData.full_name || props.clientData.name || ''
  } else {
    const name = props.clientData.name || ''
    const surname = props.clientData.surname || ''
    
    return name && surname ? `${name} ${surname}` : name || surname || ''
  }
})

// Computed para obtener el estado con color
const getStateColor = computed(() => {
  return props.clientData?.state?.toString() === '1' ? 'success' : 'error'
})

// Computed para obtener el tipo de cliente con texto
const getClientTypeIcon = computed(() => {
  return isCompanyClient.value ? 'Cliente Empresa' : 'Cliente Final'
})

// Cerrar diálogo
const closeDialog = () => {
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    max-width="700"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="client-dialog-card pa-0 elevation-8">
      <!-- Header sobrio y limpio alineado con el sistema -->
      <VCardTitle class="d-flex align-center justify-space-between pa-6 border-bottom-light bg-grey-lighten-5">
        <div class="d-flex align-center">
          <VIcon :icon="isCompanyClient ? 'ri-building-line' : 'ri-user-3-line'" color="primary" class="me-3" size="28" />
          <div>
            <div class="text-h5 font-weight-bold text-grey-darken-3">Ficha de Cliente</div>
            <div class="text-caption text-grey text-uppercase">{{ getClientTypeIcon }}</div>
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          density="comfortable"
          @click="closeDialog"
        />
      </VCardTitle>

      <!-- Contenido principal -->
      <VCardText class="pa-6">
        <!-- Grid de Especificaciones (Brochure Style) -->
        <div class="specs-container mb-6">
          <div class="spec-badge-card">
            <span class="spec-label">Documento</span>
            <span class="spec-value">{{ getDocumentTypeLabel }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Número</span>
            <span class="spec-value">{{ clientData.n_document || 'N/A' }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Teléfono</span>
            <span class="spec-value">{{ clientData.phone || 'N/A' }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Tipo</span>
            <span class="spec-value">{{ getClientTypeLabel }}</span>
          </div>
        </div>

        <VRow>
          <!-- Tarjeta de Información Principal -->
          <VCol cols="12" md="6">
            <VCard class="pa-4 h-100 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title">
                <VIcon icon="ri-user-3-line" color="primary" class="me-2" size="20" />
                Registro
              </VCardTitle>

              <VRow no-gutters class="gap-y-3">
                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">Nombre / Razón Social</div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 text-uppercase">
                    {{ fullName || 'No especificado' }}
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">Estado</div>
                  <div class="mt-1">
                    <VChip
                      :color="getStateColor"
                      variant="tonal"
                      size="small"
                      class="font-weight-bold"
                    >
                      {{ getStateLabel }}
                    </VChip>
                  </div>
                </VCol>

                <!-- Campos específicos para cliente final -->
                <template v-if="!isCompanyClient">
                  <VCol cols="6">
                    <div class="text-caption text-medium-emphasis">Género</div>
                    <div class="text-body-2 font-weight-semibold text-grey-darken-3">
                      {{ getGenderLabel }}
                    </div>
                  </VCol>

                  <VCol cols="6">
                    <div class="text-caption text-medium-emphasis">F. Nacimiento</div>
                    <div class="text-body-2 font-weight-semibold text-grey-darken-3">
                      {{ clientData.birth_date || 'No especificado' }}
                    </div>
                  </VCol>
                </template>

                <!-- Campos específicos para cliente empresa -->
                <template v-if="isCompanyClient">
                  <VCol cols="12">
                    <div class="text-caption text-medium-emphasis">Fecha Constitución</div>
                    <div class="text-body-2 font-weight-semibold text-grey-darken-3">
                      {{ clientData.birth_date || 'No especificado' }}
                    </div>
                  </VCol>
                </template>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Ubicación -->
          <VCol cols="12" md="6">
            <VCard class="pa-4 h-100 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-4 section-title">
                <VIcon icon="ri-map-pin-line" color="warning" class="me-2" size="20" />
                Ubicación
              </VCardTitle>

              <VRow no-gutters class="gap-y-3">
                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">Dirección Principal</div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 text-uppercase">
                    {{ clientData.address || 'No especificada' }}
                  </div>
                </VCol>

                <VCol cols="4">
                  <div class="text-caption text-medium-emphasis">Región</div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 text-uppercase">
                    {{ clientData.region || '-' }}
                  </div>
                </VCol>

                <VCol cols="4">
                  <div class="text-caption text-medium-emphasis">Provincia</div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 text-uppercase">
                    {{ clientData.provincia || '-' }}
                  </div>
                </VCol>

                <VCol cols="4">
                  <div class="text-caption text-medium-emphasis">Distrito</div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 text-uppercase">
                    {{ clientData.distrito || '-' }}
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Contacto -->
          <VCol cols="12" class="pt-4">
            <VCard class="pa-4 bg-grey-lighten-5 info-card-flat" variant="outlined">
              <VCardTitle class="d-flex align-center pa-0 mb-3 section-title text-grey-darken-2">
                <VIcon icon="ri-contacts-line" color="grey-darken-2" class="me-2" size="18" />
                Contacto
              </VCardTitle>

              <VRow no-gutters class="gap-y-2">
                <VCol cols="12" sm="6">
                  <div class="text-caption text-medium-emphasis">Teléfono Móvil</div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3">
                    <VIcon icon="ri-phone-line" size="14" class="me-1 text-success" />
                    {{ clientData.phone || 'No especificado' }}
                  </div>
                </VCol>

                <VCol cols="12" sm="6">
                  <div class="text-caption text-medium-emphasis">Correo Electrónico</div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 text-lowercase">
                    <VIcon icon="ri-mail-line" size="14" class="me-1 text-info" />
                    {{ clientData.email || 'No especificado' }}
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Footer con botones -->
      <VDivider />
      <VCardActions class="pa-4 justify-end">
        <VBtn
          color="secondary"
          variant="tonal"
          prepend-icon="ri-close-line"
          class="px-5"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.client-dialog-card {
  border-radius: 12px !important;
  overflow: hidden;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Grid de Especificaciones (Brochure Style) */
.specs-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

@media (max-width: 600px) {
  .specs-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

.spec-badge-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}

.spec-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  display: block;
}

.spec-value {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  margin-top: 2px;
  display: block;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-title {
  font-size: 0.82rem !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #475569;
}

.info-card-flat {
  border: 1px solid #e2e8f0 !important;
  border-radius: 8px !important;
}
</style>