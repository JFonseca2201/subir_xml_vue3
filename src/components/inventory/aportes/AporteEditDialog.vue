<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
  modelValue: Boolean,
  aporte: {
    type: Object,
    default: null,
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'updated'])

// Stores y composables
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Estado reactivo profesional
const form = ref({
  partner_id: null,
  monto: null,
  descripcion: '',
  cuenta_id: null,
  metodo_pago: '',
  fecha_aporte: '',
  hora_aporte: '',
})

const formRef = ref()
const loading = ref(false)
const partners = ref([])
const accounts = ref([])

// Datos estáticos
const metodosPago = [
  { text: 'Efectivo', value: 'EFECTIVO' },
  { text: 'Transferencia', value: 'TRANSFERENCIA' },
]

// Computed
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

// Computed para el título del diálogo
const isEditing = computed(() => !!props.aporte)

const dialogTitle = computed(() => {
  return isEditing.value ? 'Editar Aporte de Capital' : 'Registrar Aporte de Capital'
})

// Métodos profesionales
const resetForm = () => {
  form.value = {
    partner_id: null,
    monto: null,
    descripcion: '',
    cuenta_id: null,
    metodo_pago: '',
    fecha_aporte: '',
    hora_aporte: '',
  }

  if (formRef.value) {
    formRef.value.resetValidation()
  }
}

const closeDialog = () => {
  show.value = false
  setTimeout(() => {
    resetForm()
  }, 200)
}

const formatDate = fecha => {
  return fecha ? fecha.split('T')[0] : ''
}

const loadAporteData = () => {
  console.log('🔧 Cargando datos del aporte para editar:', props.aporte)

  if (!props.aporte) {
    console.warn('⚠️ No hay aporte para editar')
    
    return
  }

  // Función helper para extraer datos de objeto Proxy
  const extractData = obj => {
    if (!obj) return null

    console.log('🔍 Analizando objeto aporte:', obj)

    // El aporte viene con partner_nombre y cuenta (nombres directos, no objetos)
    const partnerId = obj.partner?.id || obj.partner_id || null
    const cuentaId = obj.cuenta?.id || obj.cuenta_id || null
    const partnerName = obj.partner?.name || obj.partner_nombre || ''
    const cuentaName = obj.cuenta?.name || obj.cuenta || ''

    console.log('📋 Datos extraídos:', {
      partnerId,
      cuentaId,
      partnerName,
      cuentaName,
      partner_nombre: obj.partner_nombre,
      cuenta: obj.cuenta,
    })

    return {
      partner_id: partnerId,
      cuenta_id: cuentaId,
      monto: obj.monto || null,
      descripcion: obj.descripcion || '',
      metodo_pago: obj.metodo_pago || '',
      fecha_aporte: formatDate(obj.fecha_aporte) || '',
      hora_aporte: obj.hora_aporte || '',
      partner_name: partnerName,
      cuenta_name: cuentaName,
    }
  }

  const datos = extractData(props.aporte)

  console.log('📋 Datos que se van a cargar:', datos)

  // Asignación directa y reactiva
  form.value.partner_id = datos.partner_id
  form.value.monto = datos.monto
  form.value.descripcion = datos.descripcion
  form.value.cuenta_id = datos.cuenta_id
  form.value.metodo_pago = datos.metodo_pago
  form.value.fecha_aporte = datos.fecha_aporte
  form.value.hora_aporte = datos.hora_aporte

  console.log('✅ Formulario cargado correctamente:', { ...form.value })
}

const loadPartners = async () => {
  try {
    console.log('🚀 Cargando socios...')

    const response = await $api('partners')

    let partnersData = []
    if (response && response.partners && response.partners.data && Array.isArray(response.partners.data)) {
      partnersData = response.partners.data
    } else if (Array.isArray(response)) {
      partnersData = response
    }

    partners.value = partnersData
    console.log('✅ Socios cargados:', partnersData.length)
  } catch (error) {
    console.error('Error al cargar socios:', error)
    showNotification('Error al cargar socios', 'error')
  }
}

const loadAccounts = async () => {
  try {
    console.log('🚀 Cargando cuentas...')

    const response = await $api('accounts')

    let accountsData = []
    if (response && response.data && Array.isArray(response.data)) {
      accountsData = response.data
    } else if (Array.isArray(response)) {
      accountsData = response
    }

    accounts.value = accountsData
    console.log('✅ Cuentas cargadas:', accountsData.length)
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
    showNotification('Error al cargar cuentas', 'error')
  }
}

const handleSubmit = async () => {
  console.log('🚀 Iniciando actualización de aporte...')
  console.log('📋 Datos del formulario:', { ...form.value })

  const { valid } = await formRef.value.validate()

  if (!valid) {
    console.warn('⚠️ Formulario inválido')
    showNotification('Por favor, completa todos los campos requeridos', 'warning')
    
    return
  }

  loading.value = true
  loader.start()

  try {
    const formData = {
      ...form.value,
      monto: parseFloat(form.value.monto) || 0,
    }

    console.log('📤 Enviando datos:', formData)

    const response = await $api(`aportes/${props.aporte.id}`, {
      method: 'PUT',
      body: formData,
    })

    console.log('✅ Aporte actualizado:', response)
    showNotification('Aporte actualizado exitosamente', 'success')
    emit('updated', response.aporte)
    closeDialog()

  } catch (error) {
    console.error('❌ Error al actualizar aporte:', error)
    showNotification(error.response?.data?.message || 'Error al actualizar aporte', 'error')
  } finally {
    loading.value = false
    loader.stop()
  }
}

// Watchers profesionales
watch(show, newVal => {
  console.log('👀 Cambio en show:', newVal)

  if (newVal) {
    // Cargar datos primero
    Promise.all([loadPartners(), loadAccounts()])
      .then(() => {
        console.log('📦 Datos cargados, procesando edición...')

        // Después de cargar socios y cuentas, cargar datos del aporte si estamos editando
        if (props.aporte) {
          console.log('📝 Modo edición detectado, cargando datos...')
          loadAporteData()
        } else {
          console.log('🆕 Modo creación, reseteando formulario...')
          resetForm()
        }
      })
      .catch(error => {
        console.error('❌ Error cargando datos:', error)
      })
  } else {
    // Al cerrar, limpiar formulario
    resetForm()
  }
})

// Watcher específico para aporte - optimizado
watch(() => props.aporte, (newVal, oldVal) => {
  console.log('👀 Cambio en aporte:', { newVal, oldVal })

  if (newVal && show.value) {
    // Solo cargar si hay datos, el diálogo está abierto y estamos en modo edición
    console.log('🔄 Recargando datos del aporte...')
    loadAporteData()
  }
}, { immediate: true, deep: true })

// Lifecycle
onMounted(() => {
  console.log("APORTE DE CAPITAL: " + props.aporte)
  loadPartners()
  loadAccounts()

  // Si hay un aporte para editar, cargar sus datos
  if (props.aporte) {
    console.log('🔄 Cargando datos del aporte al montar...')
    loadAporteData()
  }
})
</script>

<template>
  <VDialog
    v-model="show"
    max-width="500"
    persistent
  >
    <VCard>
      <!-- Header -->
      <VCardTitle class="pa-6 pb-4">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-3">
            <VIcon
              :icon="isEditing ? 'ri-edit-line' : 'ri-add-circle-line'"
              color="primary"
              size="28"
            />
            <div>
              <h3 class="text-h5 font-weight-bold">
                {{ dialogTitle }}
              </h3>
              <span class="text-medium-emphasis text-body-2">
                {{ isEditing ? 'Modificar aporte' : 'Completa los datos para crear un nuevo aporte' }}
              </span>
            </div>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            @click="closeDialog"
          />
        </div>
      </VCardTitle>

      <VDivider />

      <!-- Formulario -->
      <VCardText class="pa-6">
        <VForm
          ref="formRef"
          @submit.prevent="handleSubmit"
        >
          <VRow>
            <!-- Socio -->
            <VCol cols="12">
              <VSelect
                v-model="form.partner_id"
                :items="partners"
                item-title="name"
                item-value="id"
                label="Socio *"
                placeholder="Selecciona un socio"
                :rules="[v => !!v || 'El socio es requerido']"
                variant="outlined"
                density="comfortable"
              >
                <template #prepend-inner>
                  <VIcon
                    color="primary"
                    size="20"
                  >
                    ri-group-line
                  </VIcon>
                </template>
              </VSelect>
            </VCol>

            <!-- Monto -->
            <VCol cols="12">
              <VTextField
                v-model="form.monto"
                label="Monto *"
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0.01"
                :rules="[
                  v => !!v || 'El monto es requerido',
                  v => v > 0 || 'El monto debe ser mayor a 0'
                ]"
                variant="outlined"
                density="comfortable"
              >
                <template #prepend-inner>
                  <VIcon
                    color="primary"
                    size="20"
                  >
                    ri-money-dollar-box-line
                  </VIcon>
                </template>
              </VTextField>
            </VCol>

            <!-- Cuenta -->
            <VCol cols="6">
              <VSelect
                v-model="form.cuenta_id"
                :items="accounts"
                item-title="name"
                item-value="id"
                label="Cuenta *"
                placeholder="Selecciona una cuenta"
                :rules="[v => !!v || 'La cuenta es requerida']"
                variant="outlined"
                density="comfortable"
              >
                <template #prepend-inner>
                  <VIcon
                    color="primary"
                    size="20"
                  >
                    ri-bank-line
                  </VIcon>
                </template>
              </VSelect>
            </VCol>

            <!-- Método de Pago -->
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="form.metodo_pago"
                :items="metodosPago"
                item-title="text"
                item-value="value"
                label="Método de Pago *"
                placeholder="Selecciona método"
                :rules="[v => !!v || 'El método de pago es requerido']"
                variant="outlined"
                density="comfortable"
              >
                <template #prepend-inner>
                  <VIcon
                    color="primary"
                    size="20"
                  >
                    ri-money-dollar-circle-line
                  </VIcon>
                </template>
              </VSelect>
            </VCol>

            <!-- Fecha -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="form.fecha_aporte"
                label="Fecha *"
                type="date"
                :rules="[v => !!v || 'La fecha es requerida']"
                variant="outlined"
                density="comfortable"
              >
                <template #prepend-inner>
                  <VIcon
                    color="primary"
                    size="20"
                  >
                    ri-calendar-line
                  </VIcon>
                </template>
              </VTextField>
            </VCol>

            <!-- Hora -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="form.hora_aporte"
                label="Hora *"
                type="time"
                :rules="[v => !!v || 'La hora es requerida']"
                variant="outlined"
                density="comfortable"
              >
                <template #prepend-inner>
                  <VIcon
                    color="primary"
                    size="20"
                  >
                    ri-time-line
                  </VIcon>
                </template>
              </VTextField>
            </VCol>

            <!-- Descripción -->
            <VCol cols="12">
              <VTextarea
                v-model="form.descripcion"
                label="Descripción"
                placeholder="Describe el aporte de capital..."
                rows="3"
                variant="outlined"
                density="comfortable"
                no-resize
              >
                <template #prepend-inner>
                  <VIcon
                    color="primary"
                    size="20"
                  >
                    ri-article-line
                  </VIcon>
                </template>
              </VTextarea>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Footer -->
      <VCardActions class="pa-6">
        <VSpacer />
        <VBtn
          variant="outlined"
          :disabled="loading"
          prepend-icon="ri-close-line"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          :loading="loading"
          prepend-icon="ri-save-line"
          @click="handleSubmit"
        >
          Guardar Cambios
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
