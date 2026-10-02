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
  { title: 'Blanco', value: 'blanco', hex: '#ffffff' },
  { title: 'Negro', value: 'negro', hex: '#212121' },
  { title: 'Plateado', value: 'plateado', hex: '#c0c0c0' },
  { title: 'Gris', value: 'gris', hex: '#9e9e9e' },
  { title: 'Rojo', value: 'rojo', hex: '#f44336' },
  { title: 'Azul', value: 'azul', hex: '#2196f3' },
  { title: 'Verde', value: 'verde', hex: '#4caf50' },
  { title: 'Amarillo', value: 'amarillo', hex: '#ffeb3b' },
  { title: 'Dorado', value: 'dorado', hex: '#ffd700' },
  { title: 'Naranja', value: 'naranja', hex: '#ff9800' },
  { title: 'Café', value: 'café', hex: '#795548' },
  { title: 'Beige', value: 'beige', hex: '#f5f5dc' },
  { title: 'Celeste', value: 'celeste', hex: '#87ceeb' },
  { title: 'Morado', value: 'morado', hex: '#9c27b0' },
  { title: 'Rosado', value: 'rosado', hex: '#e91e63' },
  { title: 'Otro', value: 'otro', hex: '#78909c' },
]

const getColorHex = colorName => {
  if (!colorName) return '#9e9e9e'
  const match = colorOptions.find(c => c.value.toLowerCase() === String(colorName).toLowerCase())
  
  return match ? match.hex : '#9e9e9e'
}

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
    usage_type: 'particular',
    description: '',
    user_id: getCurrentUserId(),
    client_id: props.clientSelectedId || null,
    status: 1,
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

      emit('add-vehicle', vehiclePayload)
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
    max-width="620"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="custom-dialog-card pa-0 rounded-xl overflow-hidden">
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
          Completa los datos del vehículo para registrarlo en el sistema
        </p>
      </div>

      <VCardText class="pa-sm-6 pa-4">
        <VForm
          id="vehicleAddForm"
          ref="formRef"
          @submit.prevent="saveVehicle"
        >
          <VRow
            dense
            class="gap-y-3"
          >
            <!-- 1. PROPIETARIO DEL VEHÍCULO -->
            <VCol
              cols="12"
              class="d-flex align-center gap-2 pt-1"
            >
              <VAvatar
                size="28"
                color="primary"
                variant="tonal"
              >
                <VIcon
                  size="16"
                  icon="ri-user-star-line"
                />
              </VAvatar>
              <span class="text-subtitle-2 font-weight-bold text-uppercase text-high-emphasis">
                1. Propietario del Vehículo
              </span>
            </VCol>

            <!-- Propietario / Cliente -->
            <VCol cols="12">
              <VSearch
                v-model="initialClient"
                :return-object="true"
                endpoint="clients/search"
                item-title="full_name"
                label="Propietario / Cliente *"
                placeholder="Buscar por nombre o número de documento..."
                icon="ri-user-line"
                :rules="rules.client_id"
                :initial-item="initialClient"
              >
                <template #item="{ props: itemProps, item }">
                  <VListItem
                    v-bind="itemProps"
                    :title="undefined"
                    class="py-2"
                  >
                    <template #prepend>
                      <VAvatar
                        size="34"
                        color="primary"
                        variant="tonal"
                        class="me-3"
                      >
                        <VIcon
                          size="18"
                          icon="ri-user-3-line"
                        />
                      </VAvatar>
                    </template>
                    <VListItemTitle
                      class="font-weight-semibold text-body-2"
                      style="white-space: normal !important; line-height: 1.3;"
                    >
                      {{ item.raw.full_name }}
                    </VListItemTitle>
                    <VListItemSubtitle class="mt-1 d-flex flex-wrap gap-2 text-caption">
                      <span class="d-inline-flex align-center">
                        <VIcon
                          size="13"
                          icon="ri-id-card-line"
                          class="me-1 text-primary"
                        />
                        {{ item.raw.n_document || 'Sin Doc.' }}
                      </span>
                      <span
                        v-if="item.raw.phone"
                        class="d-inline-flex align-center text-grey"
                      >
                        <VIcon
                          size="13"
                          icon="ri-phone-line"
                          class="me-1"
                        />
                        {{ item.raw.phone }}
                      </span>
                    </VListItemSubtitle>
                  </VListItem>
                </template>
              </VSearch>

              <!-- Datos clave del cliente seleccionado (limpio y sin redundancia) -->
              <div
                v-if="selectedClient && (selectedClient.n_document || selectedClient.phone)"
                class="mt-1 d-flex flex-wrap align-center gap-4 px-1 text-caption text-medium-emphasis"
              >
                <span
                  v-if="selectedClient.n_document"
                  class="d-inline-flex align-center"
                >
                  <VIcon
                    size="14"
                    icon="ri-id-card-line"
                    class="me-1 text-primary"
                  />
                  Doc: <strong class="ms-1 text-high-emphasis">{{ selectedClient.n_document }}</strong>
                </span>
                <span
                  v-if="selectedClient.phone"
                  class="d-inline-flex align-center"
                >
                  <VIcon
                    size="14"
                    icon="ri-phone-line"
                    class="me-1 text-success"
                  />
                  Tel: <strong class="ms-1 text-high-emphasis">{{ selectedClient.phone }}</strong>
                </span>
              </div>
            </VCol>

            <VCol cols="12">
              <VDivider class="my-1" />
            </VCol>

            <!-- 2. DATOS DEL VEHÍCULO -->
            <VCol
              cols="12"
              class="d-flex align-center gap-2"
            >
              <VAvatar
                size="28"
                color="primary"
                variant="tonal"
              >
                <VIcon
                  size="16"
                  icon="ri-car-line"
                />
              </VAvatar>
              <span class="text-subtitle-2 font-weight-bold text-uppercase text-high-emphasis">
                2. Datos del Vehículo
              </span>
            </VCol>

            <!-- Fila 1: Placa, Tipo de Vehículo, Año -->
            <VCol
              cols="12"
              sm="4"
            >
              <VTextField
                v-model="vehicleForm.license_plate"
                label="Placa *"
                placeholder="Ej: ABC-1234"
                prepend-inner-icon="ri-id-card-line"
                :rules="rules.license_plate"
                variant="outlined"
                density="compact"
                maxlength="9"
                hide-details="auto"
                class="text-uppercase"
              />
            </VCol>

            <VCol
              cols="12"
              sm="4"
            >
              <VSelect
                v-model="vehicleForm.vehicle_type"
                :items="vehicleTypeOptions"
                label="Tipo de Vehículo *"
                placeholder="Seleccione tipo"
                prepend-inner-icon="ri-roadster-line"
                :rules="rules.vehicle_type"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </VCol>

            <VCol
              cols="12"
              sm="4"
            >
              <VSelect
                v-model="vehicleForm.year"
                :items="yearOptions"
                label="Año *"
                placeholder="Seleccione año"
                prepend-inner-icon="ri-calendar-line"
                :rules="rules.year"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </VCol>

            <!-- Fila 2: Marca y Modelo (Espacio amplio para modelos con nombres largos) -->
            <VCol
              cols="12"
              sm="4"
            >
              <VAutocomplete
                v-model="vehicleForm.brand"
                :items="brandOptions"
                label="Marca *"
                placeholder="Seleccione marca"
                prepend-inner-icon="ri-building-line"
                :rules="rules.brand"
                :filter="filterBrands"
                density="compact"
                variant="outlined"
                hide-details="auto"
                no-data-text="No se encontraron marcas"
              />
            </VCol>

            <VCol
              cols="12"
              sm="8"
            >
              <VTextField
                v-model="vehicleForm.model"
                label="Modelo *"
                placeholder="Ej: Corolla Cross XEI, D-Max 3.0 CD 4x4, Tucson TL..."
                prepend-inner-icon="ri-car-line"
                :rules="rules.model"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </VCol>

            <!-- Fila 3: Color y Uso -->
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="vehicleForm.color"
                :items="colorOptions"
                item-title="title"
                item-value="value"
                label="Color *"
                placeholder="Seleccione color"
                prepend-inner-icon="ri-palette-line"
                :rules="rules.color"
                density="compact"
                variant="outlined"
                hide-details="auto"
              >
                <template #selection="{ item }">
                  <div class="d-flex align-center gap-2">
                    <span
                      class="color-dot-indicator"
                      :style="{ backgroundColor: getColorHex(item.value) }"
                    />
                    <span>{{ item.title }}</span>
                  </div>
                </template>
                <template #item="{ props: itemProps, item }">
                  <VListItem v-bind="itemProps">
                    <template #prepend>
                      <span
                        class="color-dot-indicator me-2"
                        :style="{ backgroundColor: item.raw.hex }"
                      />
                    </template>
                  </VListItem>
                </template>
              </VSelect>
            </VCol>

            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="vehicleForm.usage_type"
                :items="vehicleUsageTypeOptions"
                label="Tipo de Uso"
                placeholder="Seleccione uso"
                prepend-inner-icon="ri-dashboard-3-line"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </VCol>

            <VCol cols="12">
              <VDivider class="my-1" />
            </VCol>

            <!-- 3. OBSERVACIONES & DETALLES (OPCIONAL) -->
            <VCol
              cols="12"
              class="d-flex align-center gap-2"
            >
              <VAvatar
                size="28"
                color="primary"
                variant="tonal"
              >
                <VIcon
                  size="16"
                  icon="ri-file-text-line"
                />
              </VAvatar>
              <span class="text-subtitle-2 font-weight-bold text-uppercase text-high-emphasis">
                3. Observaciones & Detalles (Opcional)
              </span>
            </VCol>

            <VCol cols="12">
              <VTextarea
                v-model="vehicleForm.description"
                label="Observaciones (Opcional)"
                placeholder="Detalles sobre estado mecánico, carrocería, accesorios especiales, etc."
                prepend-inner-icon="ri-sticky-note-line"
                rows="2"
                density="compact"
                variant="outlined"
                hide-details="auto"
                auto-grow
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
                class="rounded-lg"
                @click:close="error = ''"
              >
                {{ error }}
              </VAlert>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-surface"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-5 font-weight-medium"
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

<style scoped>
.color-dot-indicator {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.ecuador-plate-badge {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 2px solid #1e293b;
  border-radius: 6px;
  padding: 2px 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  min-width: 90px;
}

.plate-top-strip {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.8px;
  color: #1e293b;
  line-height: 1;
  margin-bottom: 1px;
}

.flag-stripe {
  width: 3px;
  height: 6px;
  border-radius: 1px;
}

.flag-stripe.y {
  background: #facc15;
}

.flag-stripe.b {
  background: #2563eb;
}

.flag-stripe.r {
  background: #dc2626;
}

.plate-number {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: 1px;
  line-height: 1;
}
</style>