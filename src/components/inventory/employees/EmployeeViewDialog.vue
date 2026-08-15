<script setup>
import { ref, watch } from 'vue'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  employee: {
    type: Object,
    default: () => ({}),
  },
})

// Emits
const emit = defineEmits(['update:modelValue'])

// Estado
const loading = ref(false)

const employeeData = ref({
  id: null,
  identification: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  position: '',
  salary: 0,
  hired_at: null,
  created_at: null,
  updated_at: null,
  creator: null,
  deleted_at: null,
})

// Métodos
const loadEmployeeDetails = async () => {
  if (!props.employee?.id) return

  try {
    loading.value = true
        
    const response = await $api(`employees/${props.employee.id}`)
        
    if (response.status === 200) {
      employeeData.value = response.employee
    }
  } catch (error) {
    console.error('Error al cargar detalles del empleado:', error)
  } finally {
    loading.value = false
  }
}

const formatSalary = salary => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(salary || 0)
}

const formatDate = dateString => {
  if (!dateString) return 'No disponible'
    
  try {
    const date = new Date(dateString)
    
    return date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch (error) {
    return dateString
  }
}

const formatDateTime = dateString => {
  if (!dateString) return 'No disponible'
    
  try {
    const date = new Date(dateString)
    
    return date.toLocaleString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    return dateString
  }
}

const getStatusColor = deletedAt => {
  return deletedAt ? 'error' : 'success'
}

const getStatusText = deletedAt => {
  return deletedAt ? 'Inactivo' : 'Activo'
}

const closeDialog = () => {
  emit('update:modelValue', false)
}

// Watchers
watch(() => props.modelValue, newValue => {
  if (newValue && props.employee) {
    loadEmployeeDetails()
  }
})

watch(() => props.employee, () => {
  if (props.modelValue && props.employee) {
    loadEmployeeDetails()
  }
}, { deep: true })
</script>

<template>
  <VDialog scrollable
    :model-value="modelValue"
    max-width="750"
    @update:model-value="$emit('update:modelValue', $event)"
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
          <VIcon icon="ri-user-search-line" />
        </div>
        <h3 class="custom-dialog-title">
          Ficha del Empleado
        </h3>
        <p class="custom-dialog-subtitle">
          Información personal, contrato laboral y registros de auditoría
        </p>
      </div>
            
      <VCardText class="pa-6 pa-sm-8">
        <VProgressCircular
          v-if="loading"
          indeterminate
          color="primary"
          class="d-block mx-auto my-8"
        />
                
        <div v-else>
          <!-- HERO CARD: Avatar + Nombre + Cargo + Salario Highlight -->
          <div class="bg-grey-lighten-4 rounded-xl pa-5 mb-6 border d-flex flex-column flex-sm-row align-center justify-space-between gap-4">
            <div class="d-flex align-center gap-4 text-center text-sm-left flex-column flex-sm-row">
              <VAvatar
                size="68"
                color="primary"
                variant="tonal"
                class="elevation-2"
              >
                <VIcon
                  icon="ri-user-star-line"
                  size="36"
                />
              </VAvatar>
              <div>
                <h2 class="text-h6 font-weight-bold text-high-emphasis mb-1">
                  {{ employeeData.first_name || '' }} {{ employeeData.last_name || '' }}
                </h2>
                <div class="d-flex flex-wrap align-center justify-center justify-sm-start gap-2">
                  <VChip
                    size="small"
                    color="primary"
                    variant="elevated"
                    class="font-weight-bold"
                  >
                    {{ employeeData.position || 'EMPLEADO' }}
                  </VChip>
                  <VChip
                    :color="getStatusColor(employeeData.deleted_at)"
                    variant="tonal"
                    size="small"
                    class="font-weight-bold"
                  >
                    {{ getStatusText(employeeData.deleted_at) }}
                  </VChip>
                  <VChip
                    v-if="employeeData.identification"
                    size="small"
                    color="secondary"
                    variant="outlined"
                    class="font-weight-medium"
                  >
                    DNI: {{ employeeData.identification }}
                  </VChip>
                </div>
              </div>
            </div>

            <!-- Bloque Destacado de Salario -->
            <div class="bg-success-lighten-5 border border-success border-opacity-25 rounded-lg px-5 py-3 text-center w-100 w-sm-auto">
              <div class="text-caption text-success font-weight-bold text-uppercase tracking-wide">
                Salario Mensual
              </div>
              <div class="text-h5 font-weight-black text-success">
                {{ formatSalary(employeeData.salary) }}
              </div>
            </div>
          </div>

          <!-- SECCIÓN: Información Personal y Contacto -->
          <div class="mb-6">
            <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3 d-flex align-center gap-2 border-b pb-2">
              <VIcon
                icon="ri-user-line"
                color="primary"
                size="20"
              />
              Información Personal y Contacto
            </h4>
            <VRow dense>
              <VCol
                cols="12"
                sm="6"
                class="py-2"
              >
                <div class="bg-white rounded-lg pa-3 border d-flex align-center gap-3">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    size="38"
                    rounded="lg"
                  >
                    <VIcon icon="ri-mail-line" />
                  </VAvatar>
                  <div>
                    <div class="text-caption text-medium-emphasis">Correo Electrónico</div>
                    <div class="text-body-2 font-weight-medium text-high-emphasis text-truncate" style="max-width: 220px;">
                      {{ employeeData.email || 'No registrado' }}
                    </div>
                  </div>
                </div>
              </VCol>

              <VCol
                cols="12"
                sm="6"
                class="py-2"
              >
                <div class="bg-white rounded-lg pa-3 border d-flex align-center gap-3">
                  <VAvatar
                    color="info"
                    variant="tonal"
                    size="38"
                    rounded="lg"
                  >
                    <VIcon icon="ri-phone-line" />
                  </VAvatar>
                  <div>
                    <div class="text-caption text-medium-emphasis">Teléfono / Celular</div>
                    <div class="text-body-2 font-weight-medium text-high-emphasis">
                      {{ employeeData.phone || 'No registrado' }}
                    </div>
                  </div>
                </div>
              </VCol>

              <VCol
                cols="12"
                sm="6"
                class="py-2"
              >
                <div class="bg-white rounded-lg pa-3 border d-flex align-center gap-3">
                  <VAvatar
                    color="warning"
                    variant="tonal"
                    size="38"
                    rounded="lg"
                  >
                    <VIcon icon="ri-calendar-event-line" />
                  </VAvatar>
                  <div>
                    <div class="text-caption text-medium-emphasis">Fecha de Contratación</div>
                    <div class="text-body-2 font-weight-medium text-high-emphasis">
                      {{ formatDate(employeeData.hired_at) }}
                    </div>
                  </div>
                </div>
              </VCol>

              <VCol
                cols="12"
                sm="6"
                class="py-2"
              >
                <div class="bg-white rounded-lg pa-3 border d-flex align-center gap-3">
                  <VAvatar
                    color="secondary"
                    variant="tonal"
                    size="38"
                    rounded="lg"
                  >
                    <VIcon icon="ri-id-card-line" />
                  </VAvatar>
                  <div>
                    <div class="text-caption text-medium-emphasis">Cédula / RUC</div>
                    <div class="text-body-2 font-weight-medium text-high-emphasis">
                      {{ employeeData.identification || 'Sin número' }}
                    </div>
                  </div>
                </div>
              </VCol>
            </VRow>
          </div>

          <!-- SECCIÓN: Registro del Sistema y Auditoría -->
          <div>
            <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3 d-flex align-center gap-2 border-b pb-2">
              <VIcon
                icon="ri-shield-user-line"
                color="primary"
                size="20"
              />
              Información de Auditoría y Sistema
            </h4>
            <div class="bg-grey-lighten-5 rounded-lg pa-4 border">
              <VRow dense>
                <VCol
                  cols="12"
                  sm="6"
                  class="py-1"
                >
                  <span class="text-caption text-medium-emphasis">ID de Empleado:</span>
                  <div class="text-body-2 font-weight-bold text-primary">
                    #{{ employeeData.id || 'N/A' }}
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                  class="py-1"
                >
                  <span class="text-caption text-medium-emphasis">Registrado por:</span>
                  <div class="text-body-2 font-weight-medium text-high-emphasis">
                    {{ employeeData.creator?.name || 'Super-Admin' }}
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                  class="py-1"
                >
                  <span class="text-caption text-medium-emphasis">Fecha de Creación:</span>
                  <div class="text-body-2 font-weight-medium text-medium-emphasis">
                    {{ formatDateTime(employeeData.created_at) }}
                  </div>
                </VCol>

                <VCol
                  cols="12"
                  sm="6"
                  class="py-1"
                >
                  <span class="text-caption text-medium-emphasis">Última Actualización:</span>
                  <div class="text-body-2 font-weight-medium text-medium-emphasis">
                    {{ formatDateTime(employeeData.updated_at) }}
                  </div>
                </VCol>

                <VCol
                  v-if="employeeData.deleted_at"
                  cols="12"
                  class="py-1 mt-2 border-t"
                >
                  <span class="text-caption text-error font-weight-bold">Fecha de Eliminación (Inactivo):</span>
                  <div class="text-body-2 font-weight-bold text-error">
                    {{ formatDateTime(employeeData.deleted_at) }}
                  </div>
                </VCol>
              </VRow>
            </div>
          </div>
        </div>
      </VCardText>

      <VDivider />
      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="closeDialog"
        >
          Cerrar Ficha
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
