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
    
    return name && surname ? `${name} ${surname}` : name || surname || props.clientData.full_name || ''
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
    scrollable
    max-width="720"
    :model-value="props.isDialogVisible"
    persistent
    transition="dialog-bottom-transition"
    @update:model-value="closeDialog"
  >
    <VCard class="custom-dialog-card client-dialog-card elevation-12">
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
          <VIcon :icon="isCompanyClient ? 'ri-building-line' : 'ri-user-3-line'" />
        </div>
        <h3 class="custom-dialog-title text-capitalize">
          {{ fullName || 'Ficha del Cliente' }}
        </h3>
        <p class="custom-dialog-subtitle mb-2">
          {{ isCompanyClient ? 'Información registrada de la persona jurídica' : 'Información detallada y datos de contacto' }}
        </p>

        <!-- Header Pills -->
        <div class="d-flex flex-wrap justify-center gap-2 mt-2">
          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-bold"
            :style="clientData?.state?.toString() === '1' ? 'background: rgba(16, 185, 129, 0.25); color: #ffffff; border: 1px solid rgba(16, 185, 129, 0.5);' : 'background: rgba(239, 68, 68, 0.25); color: #ffffff; border: 1px solid rgba(239, 68, 68, 0.5);'"
          >
            <VIcon
              :icon="clientData?.state?.toString() === '1' ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'"
              size="14"
              class="me-1"
            />
            <span>{{ getStateLabel }}</span>
          </div>

          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.28);"
          >
            <VIcon
              icon="ri-id-card-line"
              size="14"
              class="me-1"
            />
            <span><strong>{{ getDocumentTypeLabel }}:</strong> <span class="font-weight-bold ms-1">{{ clientData.n_document || '—' }}</span></span>
          </div>

          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.28);"
          >
            <VIcon
              :icon="isCompanyClient ? 'ri-building-2-line' : 'ri-user-star-line'"
              size="14"
              class="me-1"
            />
            <span>{{ getClientTypeLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Contenido principal -->
      <VCardText class="pa-6">
        <!-- Grid de Especificaciones (Brochure Style) -->
        <div class="specs-container mb-6">
          <div class="spec-badge-card">
            <span class="spec-label">Documento</span>
            <span class="spec-value text-primary font-weight-bold">{{ getDocumentTypeLabel }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Número</span>
            <span class="spec-value font-weight-bold font-mono">{{ clientData.n_document || 'N/A' }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Teléfono</span>
            <span class="spec-value font-weight-bold">{{ clientData.phone || 'N/A' }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Tipo</span>
            <span class="spec-value font-weight-bold">{{ getClientTypeLabel }}</span>
          </div>
        </div>

        <VRow>
          <!-- Tarjeta de Información Principal -->
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
                  :icon="isCompanyClient ? 'ri-building-line' : 'ri-user-3-line'"
                  color="primary"
                  class="me-2"
                  size="20"
                />
                {{ isCompanyClient ? 'Datos de Empresa' : 'Datos Personales' }}
              </VCardTitle>

              <VRow
                no-gutters
                class="gap-y-3"
              >
                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">
                    {{ isCompanyClient ? 'Razón Social' : 'Nombre Completo' }}
                  </div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 text-uppercase mt-0.5">
                    {{ fullName || 'No especificado' }}
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">
                    Estado en el Sistema
                  </div>
                  <div class="mt-1">
                    <VChip
                      size="small"
                      class="status-pill-clean font-weight-bold"
                      :class="clientData?.state?.toString() === '1' ? 'status-paid' : 'status-pending'"
                    >
                      <span class="status-dot" />
                      <span>{{ getStateLabel }}</span>
                    </VChip>
                  </div>
                </VCol>

                <!-- Campos específicos para cliente final -->
                <template v-if="!isCompanyClient">
                  <VCol cols="6">
                    <div class="text-caption text-medium-emphasis">
                      Género
                    </div>
                    <div class="text-body-2 font-weight-semibold text-grey-darken-3 mt-0.5">
                      {{ getGenderLabel }}
                    </div>
                  </VCol>

                  <VCol cols="6">
                    <div class="text-caption text-medium-emphasis">
                      F. Nacimiento
                    </div>
                    <div class="text-body-2 font-weight-semibold text-grey-darken-3 mt-0.5">
                      {{ clientData.birth_date || 'No especificado' }}
                    </div>
                  </VCol>
                </template>

                <!-- Campos específicos para cliente empresa -->
                <template v-if="isCompanyClient">
                  <VCol cols="12">
                    <div class="text-caption text-medium-emphasis">
                      Fecha Constitución
                    </div>
                    <div class="text-body-2 font-weight-semibold text-grey-darken-3 mt-0.5">
                      {{ clientData.birth_date || 'No especificado' }}
                    </div>
                  </VCol>
                </template>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Ubicación -->
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
                Ubicación
              </VCardTitle>

              <VRow
                no-gutters
                class="gap-y-3"
              >
                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">
                    Dirección Principal
                  </div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 text-uppercase mt-0.5">
                    {{ clientData.address || 'No especificada' }}
                  </div>
                </VCol>

                <VCol cols="4">
                  <div class="text-caption text-medium-emphasis">
                    Región
                  </div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 text-uppercase mt-0.5">
                    {{ clientData.region || '-' }}
                  </div>
                </VCol>

                <VCol cols="4">
                  <div class="text-caption text-medium-emphasis">
                    Provincia
                  </div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 text-uppercase mt-0.5">
                    {{ clientData.provincia || '-' }}
                  </div>
                </VCol>

                <VCol cols="4">
                  <div class="text-caption text-medium-emphasis">
                    Distrito
                  </div>
                  <div class="text-body-2 font-weight-semibold text-grey-darken-3 text-uppercase mt-0.5">
                    {{ clientData.distrito || '-' }}
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Contacto -->
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
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 mt-0.5">
                    <VIcon
                      icon="ri-phone-line"
                      size="15"
                      class="me-1 text-success"
                    />
                    {{ clientData.phone || 'No especificado' }}
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                >
                  <div class="text-caption text-medium-emphasis">
                    Correo Electrónico
                  </div>
                  <div class="text-body-2 font-weight-bold text-grey-darken-3 text-lowercase mt-0.5">
                    <VIcon
                      icon="ri-mail-line"
                      size="15"
                      class="me-1 text-info"
                    />
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
