<script setup>
import { ref, onMounted, watch } from 'vue'
import { $api } from '@/utils/api'
import { getBrandOptions, getBrandNameById, getBrandSearchOptions, filterBrands } from '@/data/vehicleBrands.js'
import { formatEcuadorianPlate, plateValidationRule } from '@/utils/ecuadorianPlateValidator.js'
import { getVehicleTypeOptions, getVehicleUsageTypeOptions } from '@/data/vehicleTypes.js'
import VSearch from '@/components/common/VSearch.vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  vehicleData: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:isDialogVisible', 'vehicleUpdated'])

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
  id: '',
  license_plate: '',
  brand: null,
  model: '',
  year: new Date().getFullYear(),
  color: '',
  vehicle_type: '',
  usage_type: 'particular',
  description: '',
  status: 1, // 1 = Activo, 2 = Inactivo
  user_id: null, // ID del usuario que crea/edita el vehículo
  client_id: null,
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

const statusOptions = [
  { title: 'Activo', value: 1, color: 'success' },
  { title: 'Inactivo', value: 2, color: 'error' },
]

const yearOptions = ref([])
const brandOptions = ref(getBrandOptions())
const brandSearchOptions = ref([])

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear()
  for (let i = currentYear + 5; i >= 1980; i--) {
    yearOptions.value.push({ title: i.toString(), value: i })
  }
}

const searchBrands = searchText => {
  brandSearchOptions.value = getBrandSearchOptions(searchText || '')
}

// --- FORMATEO DINÁMICO ---
watch(() => vehicleForm.value.license_plate, (newValue, oldValue) => {
  if (!newValue) return

  // Evitar formatear si está borrando
  if (oldValue && newValue.length < oldValue.length) return

  const formatted = formatEcuadorianPlate(newValue)
  if (formatted !== newValue) {
    vehicleForm.value.license_plate = formatted
  }
})

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

// --- CARGA Y ACCIONES ---
const loadVehicleData = () => {
  if (props.vehicleData && Object.keys(props.vehicleData).length > 0) {
    // Formatear al cargar si viene de DB sin guión
    const rawPlate = props.vehicleData.license_plate || ''
    const plate = rawPlate.includes('-') ? rawPlate : formatEcuadorianPlate(rawPlate)

    // Asegurar que brand sea el ID numérico correcto
    let brandValue = props.vehicleData.brand
    
    if (brandValue !== null && brandValue !== undefined) {
      if (typeof brandValue === 'string') {
        const brandOption = brandOptions.value.find(opt =>
          opt.title === brandValue.toUpperCase() ||
                    opt.title === brandValue ||
                    opt.value.toString() === brandValue,
        )

        if (brandOption) {
          brandValue = brandOption.value
        } else {
          const numericBrand = parseInt(brandValue)
          if (!isNaN(numericBrand)) {
            brandValue = numericBrand
          } else {
            brandValue = null
          }
        }
      } else if (typeof brandValue === 'number') {
        const brandOption = brandOptions.value.find(opt => opt.value === brandValue)
        if (!brandOption) {
          brandValue = null
        }
      }
    }

    // Asegurar que el status sea un número válido (1 o 2)
    let statusValue = props.vehicleData.status
    if (statusValue === null || statusValue === undefined || statusValue === '') {
      statusValue = 1 // Por defecto activo si no viene valor
    } else {
      statusValue = parseInt(statusValue)
      if (isNaN(statusValue) || (statusValue !== 1 && statusValue !== 2)) {
        statusValue = 1 // Por defecto activo si el valor no es válido
      }
    }

    // Asegurar que el tipo de vehículo sea numérico si es posible
    let vehicleTypeValue = props.vehicleData.vehicle_type
    if (vehicleTypeValue !== null && vehicleTypeValue !== undefined && vehicleTypeValue !== '') {
      const parsedType = parseInt(vehicleTypeValue)
      if (!isNaN(parsedType)) {
        vehicleTypeValue = parsedType
      }
    }

    vehicleForm.value = {
      ...props.vehicleData,
      license_plate: plate,
      brand: brandValue,
      status: statusValue, // Asegurar que el status sea correcto
      vehicle_type: vehicleTypeValue, // Asignar el tipo de vehículo formateado
      usage_type: props.vehicleData.usage_type || 'particular',
      user_id: getCurrentUserId(), // Asignar el ID del usuario actual
      client_id: props.vehicleData.client_id || null,
    }

    if (props.vehicleData.client) {
      initialClient.value = props.vehicleData.client
      vehicleForm.value.client_id = props.vehicleData.client.id
    } else if (props.vehicleData.client_id) {
      loadClientById(props.vehicleData.client_id)
    } else {
      initialClient.value = null
    }
  } else {
    // Resetear si no hay datos
    vehicleForm.value = {
      id: '',
      license_plate: '',
      brand: null,
      model: '',
      year: new Date().getFullYear(),
      color: '',
      vehicle_type: '',
      usage_type: 'particular',
      description: '',
      status: 1,
      user_id: getCurrentUserId(),
      client_id: null,
    }
    initialClient.value = null
  }
}

const updateVehicle = async () => {
  const { valid } = await formRef.value?.validate()
  if (!valid) return

  loading.value = true
  error.value = ''

  try {
    // Construir un payload limpio solo con los campos de la tabla vehicles para evitar desajustes o ignores de Eloquent
    const payload = {
      id: vehicleForm.value.id,
      license_plate: vehicleForm.value.license_plate,
      brand: vehicleForm.value.brand,
      model: vehicleForm.value.model,
      year: vehicleForm.value.year,
      color: vehicleForm.value.color,
      vehicle_type: vehicleForm.value.vehicle_type,
      usage_type: vehicleForm.value.usage_type || 'particular',
      description: vehicleForm.value.description,
      status: vehicleForm.value.status,
      user_id: vehicleForm.value.user_id,
      client_id: vehicleForm.value.client_id,
    }

    const resp = await $api(`vehicles/${payload.id}`, {
      method: "PUT",
      body: payload,
    })

    showNotification('Vehículo actualizado con éxito', 'success')

    setTimeout(() => {
      emit('update:isDialogVisible', false)
      emit('vehicleUpdated', resp.vehicle || resp.data || payload)
    }, 1200)

  } catch (err) {
    error.value = err.response?._data?.message || 'Error al actualizar'
    showNotification(error.value, 'error')
  } finally {
    loading.value = false
  }
}

watch(() => initialClient.value, newVal => {
  if (newVal && newVal.id) {
    vehicleForm.value.client_id = newVal.id
  } else {
    vehicleForm.value.client_id = null
  }
})

const closeDialog = () => {
  emit('update:isDialogVisible', false)
  formRef.value?.resetValidation()
}

onMounted(() => {
  generateYearOptions()
  loadVehicleData()

  // Sincronizar cuando el prop cambie (al abrir el diálogo)
  watch(() => props.vehicleData, () => {
    loadVehicleData()
    searchBrands('')
  }, { deep: true })

  watch(() => props.isDialogVisible, newVal => {
    if (newVal) {
      error.value = ''
      success.value = ''
    }
  })

  // Inicializar con marcas populares
  searchBrands('')
})
</script>

<template>
  <VDialog
    scrollable
    max-width="840"
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
          <VIcon icon="ri-edit-box-line" />
        </div>
        <h3 class="custom-dialog-title">
          Editar Vehículo
        </h3>
        <p class="custom-dialog-subtitle">
          Actualiza la información registrada del vehículo
        </p>
      </div>

      <VCardText class="pa-sm-6 pa-4">
        <VForm
          id="vehicleEditForm"
          ref="formRef"
          @submit.prevent="updateVehicle"
        >
          <VRow>
            <!-- 👉 Sección 1: Propietario / Cliente -->
            <VCol cols="12" class="pb-1 pt-1">
              <div class="d-flex align-center gap-2 mb-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                  <VIcon size="16" icon="ri-user-star-line" />
                </VAvatar>
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.5px;">
                  1. Propietario del Vehículo
                </span>
              </div>
            </VCol>

            <VCol cols="12" class="py-1">
              <VSearch
                v-model="initialClient"
                :return-object="true"
                endpoint="clients/search"
                item-title="full_name"
                label="Propietario / Cliente *"
                placeholder="Buscar cliente por nombre o número de documento..."
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
                      <VAvatar size="36" color="primary" variant="tonal" class="me-3">
                        <VIcon size="20" icon="ri-user-3-line" />
                      </VAvatar>
                    </template>
                    <VListItemTitle class="font-weight-semibold text-body-2" style="white-space: normal !important; line-height: 1.3;">
                      {{ item.raw.full_name }}
                    </VListItemTitle>
                    <VListItemSubtitle class="mt-1 d-flex flex-wrap gap-2 text-caption">
                      <span class="d-inline-flex align-center">
                        <VIcon size="13" icon="ri-id-card-line" class="me-1 text-primary" />
                        {{ item.raw.n_document || 'Sin Doc.' }}
                      </span>
                      <span v-if="item.raw.phone" class="d-inline-flex align-center text-grey">
                        <VIcon size="13" icon="ri-phone-line" class="me-1" />
                        {{ item.raw.phone }}
                      </span>
                    </VListItemSubtitle>
                  </VListItem>
                </template>
              </VSearch>

              <!-- Tarjeta resumen cliente seleccionado -->
              <div
                v-if="initialClient"
                class="mt-2 pa-3 rounded-lg border d-flex flex-wrap align-center justify-space-between gap-2"
                style="background: rgba(var(--v-theme-primary), 0.04); border-color: rgba(var(--v-theme-primary), 0.2) !important;"
              >
                <div class="d-flex align-center gap-3">
                  <VAvatar size="34" color="primary" variant="tonal" class="rounded-circle">
                    <VIcon size="18" icon="ri-user-check-line" />
                  </VAvatar>
                  <div>
                    <div class="text-caption text-primary font-weight-bold">CLIENTE ASOCIADO</div>
                    <div class="text-body-2 font-weight-bold text-high-emphasis">
                      {{ initialClient.full_name }}
                    </div>
                  </div>
                </div>
                <div class="d-flex flex-wrap align-center gap-2">
                  <VChip size="small" variant="tonal" color="primary" class="font-weight-medium">
                    <VIcon start size="14" icon="ri-id-card-line" />
                    {{ initialClient.n_document || 'N/A' }}
                  </VChip>
                  <VChip v-if="initialClient.phone" size="small" variant="tonal" color="secondary" class="font-weight-medium">
                    <VIcon start size="14" icon="ri-phone-line" />
                    {{ initialClient.phone }}
                  </VChip>
                </div>
              </div>
            </VCol>

            <VCol cols="12"><VDivider class="my-2" /></VCol>

            <!-- 👉 Sección 2: Identificación y Especificaciones -->
            <VCol cols="12" class="pb-1 pt-1">
              <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-2">
                <div class="d-flex align-center gap-2">
                  <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                    <VIcon size="16" icon="ri-car-line" />
                  </VAvatar>
                  <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.5px;">
                    2. Datos del Vehículo
                  </span>
                </div>

                <!-- Preview de Placa Ecuatoriana Estilizada -->
                <div v-if="vehicleForm.license_plate" class="ecuador-plate-badge">
                  <div class="plate-top-strip">
                    <span class="flag-stripe y"></span>
                    <span class="flag-stripe b"></span>
                    <span class="flag-stripe r"></span>
                    <span>ECUADOR</span>
                  </div>
                  <div class="plate-number">{{ vehicleForm.license_plate }}</div>
                </div>
              </div>
            </VCol>

            <VCol cols="12" sm="6" md="4" class="py-2">
              <VTextField
                v-model="vehicleForm.license_plate"
                label="Placa *"
                placeholder="ABC-1234"
                prepend-inner-icon="ri-id-card-line"
                :rules="rules.license_plate"
                variant="outlined"
                density="compact"
                maxlength="9"
                hint="Formato ecuatoriano: ABC-1234"
                persistent-hint
                class="font-weight-bold text-uppercase"
              />
            </VCol>

            <VCol cols="12" sm="6" md="4" class="py-2">
              <VAutocomplete
                v-model="vehicleForm.brand"
                :items="brandOptions"
                item-title="title"
                item-value="value"
                label="Marca *"
                placeholder="Seleccione marca"
                prepend-inner-icon="ri-building-line"
                :rules="rules.brand"
                :filter="filterBrands"
                density="compact"
                variant="outlined"
                no-data-text="No se encontraron marcas"
                clearable
                @update:search="searchBrands"
              />
            </VCol>

            <VCol cols="12" sm="6" md="4" class="py-2">
              <VTextField
                v-model="vehicleForm.model"
                label="Modelo *"
                placeholder="Ej: Corolla, D-Max, Sail"
                prepend-inner-icon="ri-car-line"
                :rules="rules.model"
                density="compact"
                variant="outlined"
              />
            </VCol>

            <VCol cols="12" sm="6" md="4" class="py-2">
              <VSelect
                v-model="vehicleForm.vehicle_type"
                :items="vehicleTypeOptions"
                label="Tipo de Vehículo *"
                placeholder="Seleccione tipo"
                prepend-inner-icon="ri-roadster-line"
                :rules="rules.vehicle_type"
                density="compact"
                variant="outlined"
              />
            </VCol>

            <VCol cols="12" sm="6" md="4" class="py-2">
              <VSelect
                v-model="vehicleForm.year"
                :items="yearOptions"
                label="Año de Fabricación *"
                placeholder="Seleccione año"
                prepend-inner-icon="ri-calendar-line"
                :rules="rules.year"
                density="compact"
                variant="outlined"
              />
            </VCol>

            <VCol cols="12" sm="6" md="4" class="py-2">
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

            <VCol cols="12" sm="6" md="6" class="py-2">
              <VSelect
                v-model="vehicleForm.usage_type"
                :items="vehicleUsageTypeOptions"
                label="Uso / Frecuencia Estimada"
                placeholder="Seleccione uso"
                prepend-inner-icon="ri-dashboard-3-line"
                density="compact"
                variant="outlined"
              />
            </VCol>

            <VCol cols="12" sm="6" md="6" class="py-2">
              <VSelect
                v-model="vehicleForm.status"
                :items="statusOptions"
                item-title="title"
                item-value="value"
                label="Estado del Vehículo *"
                prepend-inner-icon="ri-toggle-line"
                density="compact"
                variant="outlined"
              >
                <template #selection="{ item }">
                  <VChip
                    :color="item.raw.color"
                    size="small"
                    variant="tonal"
                    class="font-weight-bold"
                  >
                    {{ item.title }}
                  </VChip>
                </template>
                <template #item="{ props: itemProps, item }">
                  <VListItem v-bind="itemProps">
                    <template #prepend>
                      <VBadge
                        dot
                        :color="item.raw.color"
                        inline
                        class="me-2"
                      />
                    </template>
                  </VListItem>
                </template>
              </VSelect>
            </VCol>

            <VCol cols="12"><VDivider class="my-2" /></VCol>

            <!-- 👉 Sección 3: Observaciones -->
            <VCol cols="12" class="pb-1 pt-1">
              <div class="d-flex align-center gap-2 mb-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                  <VIcon size="16" icon="ri-file-text-line" />
                </VAvatar>
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.5px;">
                  3. Observaciones & Detalles (Opcional)
                </span>
              </div>
            </VCol>

            <VCol cols="12" class="py-2">
              <VTextarea
                v-model="vehicleForm.description"
                label="Observaciones adicionales del vehículo"
                placeholder="Detalles sobre estado mecánico, carrocería, accesorios especiales, etc."
                prepend-inner-icon="ri-sticky-note-line"
                rows="2"
                density="compact"
                variant="outlined"
                auto-grow
              />
            </VCol>

            <VCol v-if="error" cols="12">
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
          form="vehicleEditForm"
          color="primary"
          variant="elevated"
          prepend-icon="ri-refresh-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loading"
          :disabled="loading"
        >
          Actualizar Vehículo
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
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
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
.flag-stripe.y { background: #facc15; }
.flag-stripe.b { background: #2563eb; }
.flag-stripe.r { background: #dc2626; }

.plate-number {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: 1px;
  line-height: 1;
}
</style>
