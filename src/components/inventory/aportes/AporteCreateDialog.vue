<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
  modelValue: Boolean,
})

// Emits
const emit = defineEmits(['update:modelValue', 'created'])

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

const today = computed(() => {
  return new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]
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
  console.log('🚀 Iniciando registro de aporte...')
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

    const response = await $api('aportes', {
      method: 'POST',
      body: formData,
    })

    console.log('✅ Aporte registrado:', response)
    showNotification('Aporte registrado exitosamente', 'success')
    emit('created', response.aporte)
    closeDialog()

  } catch (error) {
    console.error('❌ Error al registrar aporte:', error)
    showNotification(error.response?.data?.message || 'Error al registrar aporte', 'error')
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
        console.log('📦 Datos cargados, formulario listo para crear')

        // Establecer fecha y hora por defecto
        if (!form.value.fecha_aporte) {
          form.value.fecha_aporte = today.value
        }
        if (!form.value.hora_aporte) {
          const now = new Date()

          form.value.hora_aporte = now.toTimeString().slice(0, 5)
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

// Lifecycle
onMounted(() => {
  console.log('🚀 AporteCreateDialog montado')
  resetForm()
})
</script>

<template>
  <VDialog
    v-model="show"
    max-width="500"
    persistent
  >
    <VCard class="aporte-dialog">
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


            <!-- Método de Pago, Fecha y Hora -->


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
          Registrar Aporte
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
