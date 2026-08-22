<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import ReceiptUploader from '@/components/common/ReceiptUploader.vue'

// Props
const props = defineProps({
  modelValue: Boolean,
})

// Emits
const emit = defineEmits(['update:modelValue', 'created'])

// Stores y composables
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

const receiptFiles = ref([])
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
const isEditing = computed(() => !props.aporte)

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
  receiptFiles.value = []

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
    const response = await $api('partners')

    let partnersData = []
    if (response && response.partners && response.partners.data && Array.isArray(response.partners.data)) {
      partnersData = response.partners.data
    } else if (Array.isArray(response)) {
      partnersData = response
    }

    partners.value = partnersData
  } catch (error) {
    console.error('Error al cargar socios:', error)
    showNotification('Error al cargar socios', 'error')
  }
}

const loadAccounts = async () => {
  try {
    const response = await $api('accounts')

    let accountsData = []
    if (response && response.data && Array.isArray(response.data)) {
      accountsData = response.data
    } else if (Array.isArray(response)) {
      accountsData = response
    }

    accounts.value = accountsData.map(acc => {
      const cleaned = (acc.name || '')
        .replace(/\(EFECTIVO\)/gi, '')
        .replace(/\(TRANSFERENCIA\)/gi, '')
        .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
        .trim()

      return {
        ...acc,
        name: acc.bank_name ? `${acc.bank_name} (${cleaned})` : cleaned,
      }
    })
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
    showNotification('Error al cargar cuentas', 'error')
  }
}

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()

  if (!valid) {
    showNotification('Por favor, completa todos los campos requeridos', 'warning')
    return
  }

  loading.value = true

  try {
    const formData = new FormData()
    formData.append('partner_id', form.value.partner_id)
    formData.append('monto', form.value.monto)
    formData.append('descripcion', form.value.descripcion || 'Aporte de capital')
    formData.append('cuenta_id', form.value.cuenta_id)
    formData.append('metodo_pago', form.value.metodo_pago)
    formData.append('fecha_aporte', form.value.fecha_aporte)
    formData.append('hora_aporte', form.value.hora_aporte || '12:00')

    receiptFiles.value.forEach(f => {
      formData.append('receipts[]', f)
    })

    const response = await $api('aportes', {
      method: 'POST',
      body: formData,
    })

    showNotification('Aporte registrado exitosamente', 'success')
    emit('created', response.aporte)
    closeDialog()

  } catch (error) {
    console.error('❌ Error al registrar aporte:', error)
    showNotification(error.response?.data?.message || 'Error al registrar aporte', 'error')
  } finally {
    loading.value = false
  }
}

const loadingData = ref(false)

// Watchers profesionales
watch(show, newVal => {
  if (newVal) {
    loadingData.value = true
    Promise.all([loadPartners(), loadAccounts()])
      .then(() => {
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
      .finally(() => {
        loadingData.value = false
      })
  } else {
    resetForm()
  }
})

// Lifecycle
onMounted(() => {
  resetForm()
})
</script>

<template>
  <VDialog
    v-model="show"
    scrollable
    max-width="920"
    persistent
  >
    <VCard class="custom-dialog-card aporte-dialog">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="loading"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon :icon="isEditing ? 'ri-edit-line' : 'ri-add-circle-line'" />
        </div>
        <h3 class="custom-dialog-title">
          {{ dialogTitle }}
        </h3>
        <p class="custom-dialog-subtitle">
          {{ isEditing ? 'Modificar datos del aporte' : 'Completa los datos para registrar un nuevo aporte' }}
        </p>
      </div>

      <!-- Formulario -->
      <VCardText class="pa-6">
        <!-- Skeleton Loader mientras cargan datos -->
        <div v-if="loadingData" class="py-2">
          <VRow>
            <VCol cols="12"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="12"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="12"><VSkeletonLoader type="article" class="rounded-lg" /></VCol>
          </VRow>
        </div>

        <VForm
          v-else
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
                rows="2"
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

            <!-- Comprobante / Recibo Adjunto -->
            <VCol cols="12">
              <ReceiptUploader
                v-model="receiptFiles"
                label="Comprobante(s) de Aporte (Foto / PDF)"
                hint="Formatos JPG, PNG, WEBP o PDF hasta 15MB"
                :max-files="5"
                @error="msg => showNotification(msg, 'error')"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Footer -->
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
          :disabled="loading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loading"
          @click="handleSubmit"
        >
          Registrar Aporte
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
