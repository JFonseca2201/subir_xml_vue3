<script setup>
import { ref, computed, watch } from 'vue'

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

// Estado del componente
const loading = ref(false)

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
  console.log(props)
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
    // Cliente final - combinar name y surname
    const name = props.clientData.name || ''
    const surname = props.clientData.surname || ''
    
    return name && surname ? `${name} ${surname}` : name || surname || ''
  }
})

// Computed para obtener el estado con color
const getStateColor = computed(() => {
  return props.clientData?.state === '1' ? 'success' : 'error'
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
    max-width="900"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard
      class="pa-0"
      elevation="8"
    >
      <!-- Header con gradiente -->
      <VCardTitle
        class="pa-8 text-center position-relative"
        :color="isCompanyClient ? 'primary' : 'secondary'"
        dark
      >
        <VBtn
          icon="ri-close-line"
          variant="text"
          class="position-absolute"
          style="top: 16px; right: 16px;"
          @click="closeDialog"
        />

        <!-- Icono y tipo de cliente -->
        <div class="d-flex flex-column align-center mb-4">
          <div class="mb-4">
            <VIcon
              :icon="isCompanyClient ? 'ri-building-line' : 'ri-user-3-line'"
              size="64"
              class="mb-3"
            />
            <div class="text-h5 font-weight-bold text-black">
              {{ getClientTypeIcon }}
            </div>
          </div>
        </div>

        <!-- Chip de estado -->
        <VChip
          :color="getStateColor"
          variant="elevated"
          size="small"
          class="text-black"
        >
          <VIcon
            start
            :icon="clientData?.state?.toString() === '1' ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'"
          />
          {{ getStateLabel }}
        </VChip>
      </VCardTitle>

      <!-- Contenido principal -->
      <VCardText class="pa-6">
        <VRow>
          <!-- Tarjeta de Información Principal -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4 h-100"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-user-3-line"
                  color="primary"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Información Principal</span>
              </VCardTitle>

              <VRow dense>
                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Nombre Completo
                    </div>
                    <div class="text-body-1 font-weight-medium">
                      {{ fullName || 'No especificado' }}
                    </div>
                  </div>
                </VCol>

                <VCol cols="6">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Tipo de Cliente
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        :icon="getClientTypeIcon"
                        size="16"
                        class="me-1"
                      />
                      <span class="text-body-2">{{ getClientTypeLabel }}</span>
                    </div>
                  </div>
                </VCol>

                <VCol cols="6">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Tipo de Documento
                    </div>
                    <div class="text-body-2">
                      {{ getDocumentTypeLabel }}
                    </div>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Número de Documento
                    </div>
                    <div class="text-body-2 font-weight-medium">
                      {{ clientData.n_document }}
                    </div>
                  </div>
                </VCol>

                <!-- Campos específicos para cliente final -->
                <template v-if="!isCompanyClient">
                  <VCol cols="6">
                    <div class="mb-3">
                      <div class="text-caption text-medium-emphasis mb-1">
                        Género
                      </div>
                      <div class="text-body-2">
                        {{ getGenderLabel }}
                      </div>
                    </div>
                  </VCol>

                  <VCol cols="6">
                    <div class="mb-3">
                      <div class="text-caption text-medium-emphasis mb-1">
                        Fecha de Nacimiento
                      </div>
                      <div class="text-body-2">
                        {{ clientData.birth_date || 'No especificado' }}
                      </div>
                    </div>
                  </VCol>
                </template>

                <!-- Campos específicos para cliente empresa -->
                <template v-if="isCompanyClient">
                  <VCol cols="12">
                    <div class="mb-3">
                      <div class="text-caption text-medium-emphasis mb-1">
                        Fecha de Constitución
                      </div>
                      <div class="text-body-2">
                        {{ clientData.birth_date || 'No especificado' }}
                      </div>
                    </div>
                  </VCol>
                </template>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Contacto -->
          <VCol
            cols="12"
            md="6"
          >
            <VCard
              class="pa-4 h-100"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-contacts-line"
                  color="success"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Información de Contacto</span>
              </VCardTitle>

              <VRow dense>
                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Teléfono
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-phone-line"
                        size="16"
                        class="me-1 text-success"
                      />
                      <span class="text-body-2">{{ clientData.phone || 'No especificado' }}</span>
                    </div>
                  </div>
                </VCol>

                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Email
                    </div>
                    <div class="d-flex align-center">
                      <VIcon
                        icon="ri-mail-line"
                        size="16"
                        class="me-1 text-info"
                      />
                      <span class="text-body-2">{{ clientData.email || 'No especificado' }}</span>
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>

          <!-- Tarjeta de Ubicación -->
          <VCol cols="12">
            <VCard
              class="pa-4"
              elevation="2"
              rounded="lg"
            >
              <VCardTitle class="d-flex align-center pa-0 mb-4">
                <VIcon
                  icon="ri-map-pin-line"
                  color="warning"
                  class="me-2"
                />
                <span class="text-h6 font-weight-bold">Ubicación</span>
              </VCardTitle>

              <VRow dense>
                <VCol cols="12">
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Dirección
                    </div>
                    <div class="text-body-2">
                      {{ clientData.address || 'No especificado' }}
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  md="4"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Región
                    </div>
                    <div class="text-body-2">
                      {{ clientData.region || 'No especificado' }}
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  md="4"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Provincia
                    </div>
                    <div class="text-body-2">
                      {{ clientData.provincia || 'No especificado' }}
                    </div>
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  md="4"
                >
                  <div class="mb-3">
                    <div class="text-caption text-medium-emphasis mb-1">
                      Distrito
                    </div>
                    <div class="text-body-2">
                      {{ clientData.distrito || 'No especificado' }}
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <!-- Footer con botones -->
      <VDivider />
      <VCardActions class="pa-4 justify-center">
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-close-line"
          class="px-6"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>