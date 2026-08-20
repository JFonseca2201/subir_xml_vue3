<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { getBrandOptions, filterBrands } from '@/data/vehicleBrands.js'
import {
  formatEcuadorianPlate,
  plateValidationRule,
} from '@/utils/ecuadorianPlateValidator.js'
import { getVehicleTypeOptions, getVehicleUsageTypeOptions } from '@/data/vehicleTypes.js'
import VSearch from '@/components/common/VSearch.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  clientSelectedId: {
    type: [Number, String],
    default: null,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'addVehicle',
  'add-vehicle',
  'vehicle-added',
  'vehicleAdded',
])

// --- ESTADO ---
const loading = ref(false)
const error = ref('')
const success = ref('')
const formRef = ref(null)

const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message
  notificationType.value = type
  notificationShow.value = true
}

// Obtener user_id del localStorage
const getCurrentUserId = () => {
  try {
    const userStore = localStorage.getItem('user')
    if (userStore) {
      const user = JSON.parse(userStore)
      
      return user.id || user.user_id || null
    }
    
    return null
  } catch (error) {
    console.error('Error al obtener user_id del localStorage:', error)
    
    return null
  }
}

const initialClient = ref(null)

const loadClientById = async id => {
  try {
    const clientResp = await $api(`clients/${id}`)
    const clientObj = clientResp.client || clientResp.data || clientResp
    if (clientObj) {
      initialClient.value = clientObj
    }
  } catch (err) {
    console.error('Error al cargar cliente por ID:', err)
  }
}

const vehicleForm = ref({
  license_plate: '',
  brand: null,
  model: '',
  year: new Date().getFullYear(),
  color: '',
  vehicle_type: '',
  usage_type: 'particular',
  description: '',
  user_id: null, // ID del usuario que crea el vehículo
  client_id: null,
  status: 1, // Estado activo por defecto (1 = activo, 2 = inactivo)
})

// --- LÓGICA DE FORMATEO ---
watch(() => vehicleForm.value.license_plate, (newValue, oldValue) => {
  if (!newValue) return

  // Evitar formateo si el usuario está borrando para no bloquear el cursor
  if (oldValue && newValue.length < oldValue.length) return

  const formatted = formatEcuadorianPlate(newValue)
  if (formatted !== newValue) {
    vehicleForm.value.license_plate = formatted
  }
})

// Recargar clientes cada vez que el diálogo se abre
watch(() => props.isDialogVisible, newVal => {
  if (newVal) {
    error.value = ''
    success.value = ''
    resetForm()
    if (props.clientSelectedId) {
      vehicleForm.value.client_id = props.clientSelectedId
      loadClientById(props.clientSelectedId)
    } else {
      vehicleForm.value.client_id = null
      initialClient.value = null
    }
    vehicleForm.value.user_id = getCurrentUserId()
  }
})

const selectedClient = computed(() => {
  return initialClient.value
})

watch(() => initialClient.value, newVal => {
  if (newVal && newVal.id) {
    vehicleForm.value.client_id = newVal.id
  } else {
    vehicleForm.value.client_id = null
  }
})


// --- OPCIONES ---
const vehicleTypeOptions = getVehicleTypeOptions()
const vehicleUsageTypeOptions = getVehicleUsageTypeOptions()

const colorOptions = [
  { title: 'Rojo', value: 'rojo' },
  { title: 'Azul', value: 'azul' },
  { title: 'Verde', value: 'verde' },
  { title: 'Amarillo', value: 'amarillo' },
  { title: 'Negro', value: 'negro' },
  { title: 'Blanco', value: 'blanco' },
  { title: 'Gris', value: 'gris' },
  { title: 'Plateado', value: 'plateado' },
]

const yearOptions = ref([])
const brandOptions = ref(getBrandOptions())

// --- REGLAS ---
const rules = {
  client_id: [v => !!v || 'El propietario es requerido'],
  license_plate: [
    v => !!v || 'La placa es requerida',
    v => plateValidationRule(v),
  ],
  brand: [v => !!v || 'La marca es requerida'],
  model: [v => !!v || 'El modelo es requerido'],
  year: [v => !!v || 'El año es requerido'],
  color: [v => !!v || 'El color es requerido'],
  vehicle_type: [v => !!v || 'El tipo es requerido'],
}

// --- ACCIONES ---
const resetForm = () => {
  vehicleForm.value = {
    license_plate: '',
    brand: null,
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vehicle_type: '',
    description: '',
    user_id: getCurrentUserId(), // Asignar el ID del usuario actual
    client_id: props.clientSelectedId || null,
    status: 1, // Estado activo por defecto (1 = activo, 2 = inactivo)
  }
  formRef.value?.resetValidation()
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
  resetForm()
}

const saveVehicle = async () => {
  const { valid } = await formRef.value?.validate()
  if (!valid) return

  loading.value = true
  error.value = ''

  try {
    const resp = await $api("vehicles", {
      method: "POST",
      body: vehicleForm.value,
    })

    showNotification('Vehículo guardado correctamente', 'success')
    resetForm()
    setTimeout(() => {
      const vehiclePayload = resp.data || resp

      emit('addVehicle', vehiclePayload)
      emit('add-vehicle', vehiclePayload)
      emit('vehicle-added', vehiclePayload)
      emit('vehicleAdded', vehiclePayload)
      emit('update:isDialogVisible', false)
    }, 25)

  } catch (err) {
    error.value = err.response?._data?.message || 'Error al guardar vehículo'
    showNotification(error.value, 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Generar opciones de años
  const currentYear = new Date().getFullYear()
  for (let i = currentYear + 5; i >= 1980; i--) {
    yearOptions.value.push({ title: i.toString(), value: i })
  }

  // Asignar el user_id al montar el componente
  vehicleForm.value.user_id = getCurrentUserId()
})
</script>

<template>
  <VDialog
    scrollable
    max-width="800"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="custom-dialog-card pa-0">
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
          <VIcon icon="ri-car-line" />
        </div>
        <h3 class="custom-dialog-title">
          Nuevo Vehículo
        </h3>
        <p class="custom-dialog-subtitle">
          Completa los datos del vehículo para ingresar al taller
        </p>
      </div>

      <VCardText class="pa-6 pa-sm-8">
        <VForm
          id="vehicleAddForm"
          ref="formRef"
          @submit.prevent="saveVehicle"
        >
          <VRow>
            <VCol cols="12">
              <h5 class="text-h5 font-weight-bold mb-3 text-primary">
                Datos Principales
              </h5>
            </VCol>

            <VCol
              cols="12"
              class="mb-3"
            >
              <VSearch
                v-model="initialClient"
                :return-object="true"
                endpoint="clients/search"
                item-title="full_name"
                label="Propietario / Cliente *"
                placeholder="Buscar cliente por nombre o documento..."
                icon="ri-user-line"
                :rules="rules.client_id"
                :initial-item="initialClient"
              >
                <template #item="{ props: itemProps, item }">
                  <VListItem
                    v-bind="itemProps"
                    :title="undefined"
                  >
                    <VListItemTitle
                      style="white-space: normal !important; line-height: 1.4;"
                      class="font-weight-medium"
                    >
                      {{ item.raw.full_name }}
                    </VListItemTitle>
                    <VListItemSubtitle class="mt-1 text-grey">
                      DNI/RUC: {{ item.raw.n_document || 'N/A' }} | Tel: {{ item.raw.phone || 'N/A' }}
                    </VListItemSubtitle>
                  </VListItem>
                </template>
              </VSearch>
              <div
                v-if="selectedClient"
                class="text-caption text-grey mt-1 ms-1"
              >
                <VIcon
                  icon="ri-file-list-3-line"
                  size="14"
                  class="me-1"
                />
                Documento (Cédula/RUC): <span class="font-weight-semibold">{{ selectedClient.n_document || 'N/A' }}</span>
              </div>
            </VCol>

            <VCol
              cols="12"
              md="6"
              class="mb-3"
            >
              <VTextField
                v-model="vehicleForm.license_plate"
                label="Placa *"
                placeholder="ABC-1234"
                prepend-inner-icon="ri-id-card-line"
                :rules="rules.license_plate"
                variant="outlined"
                maxlength="9"
                hint="Formato automático"
                persistent-hint
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
              class="mb-3"
            >
              <VSelect
                v-model="vehicleForm.vehicle_type"
                :items="vehicleTypeOptions"
                label="Tipo de Vehículo *"
                prepend-inner-icon="ri-car-line"
                :rules="rules.vehicle_type"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
              class="mb-3"
            >
              <VSelect
                v-model="vehicleForm.usage_type"
                :items="vehicleUsageTypeOptions"
                label="Uso / Frecuencia Estimada"
                prepend-inner-icon="ri-dashboard-3-line"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
              class="mb-3"
            >
              <VAutocomplete
                v-model="vehicleForm.brand"
                :items="brandOptions"
                label="Marca *"
                prepend-inner-icon="ri-building-line"
                :rules="rules.brand"
                :filter="filterBrands"
                no-data-text="No se encontraron marcas"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
              class="mb-3"
            >
              <VTextField
                v-model="vehicleForm.model"
                label="Modelo *"
                prepend-inner-icon="ri-car-line"
                :rules="rules.model"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
              class="mb-3"
            >
              <VSelect
                v-model="vehicleForm.year"
                :items="yearOptions"
                label="Año *"
                prepend-inner-icon="ri-calendar-line"
                :rules="rules.year"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
              class="mb-3"
            >
              <VSelect
                v-model="vehicleForm.color"
                :items="colorOptions"
                label="Color *"
                prepend-inner-icon="ri-palette-line"
                :rules="rules.color"
              />
            </VCol>

            <VCol
              cols="12"
              class="mb-3"
            >
              <VTextarea
                v-model="vehicleForm.description"
                label="Descripción (opcional)"
                prepend-inner-icon="ri-file-text-line"
                rows="3"
              />
            </VCol>

            <VCol
              v-if="error"
              cols="12"
            >
              <VAlert
                type="error"
                variant="tonal"
                closable
              >
                {{ error }}
              </VAlert>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>

        <VBtn
          type="submit"
          form="vehicleAddForm"
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-3-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loading"
          :disabled="loading"
        >
          Guardar Vehículo
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VSnackbar
    v-model="notificationShow"
    :color="notificationType"
    :timeout="3000"
    location="top"
  >
    {{ notificationMessage }}
  </VSnackbar>
</template>