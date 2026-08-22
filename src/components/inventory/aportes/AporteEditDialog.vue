<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import ReceiptUploader from '@/components/common/ReceiptUploader.vue'

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
const receiptFiles = ref([])
const existingAttachments = ref([])
const showUploadBox = ref(false)
const isLoadingData = ref(false)

// Diálogo de previsualización de imagen en grande
const isImageModalOpen = ref(false)
const selectedImageUrl = ref('')

const openImageModal = url => {
  selectedImageUrl.value = url
  isImageModalOpen.value = true
}

const getAttachmentUrl = att => {
  if (!att) return ''
  let rawUrl = att.url || att.file_path || ''
  if (!rawUrl) return ''
  
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:')) {
    return rawUrl.replace(/([^:]\/)\/+/g, '$1')
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin
  const base = apiBase.replace(/\/api\/?$/, '')
  const combined = `${base}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
  
  return combined.replace(/([^:]\/)\/+/g, '$1')
}

const isImageFile = att => {
  if (!att) return false
  if (att.is_image) return true
  const mime = att.mime_type || ''
  const name = att.file_name || att.file_path || ''
  
  return mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(name)
}

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
  receiptFiles.value = []
  existingAttachments.value = []
  showUploadBox.value = false

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

const deleteExistingAttachment = async attId => {
  if (!confirm('¿Estás seguro de eliminar este comprobante?')) return
  try {
    const res = await $api(`attachments/${attId}`, { method: 'DELETE' })
    if (res && (res.status === 'success' || res.message)) {
      existingAttachments.value = existingAttachments.value.filter(a => a.id !== attId)
      if (existingAttachments.value.length === 0) {
        showUploadBox.value = true
      }
      showNotification('Comprobante eliminado exitosamente', 'success')
    }
  } catch (e) {
    console.error('Error al eliminar comprobante:', e)
    showNotification('Error al eliminar el comprobante', 'error')
  }
}

const loadAporteData = async () => {
  if (!props.aporte) return

  if (Array.isArray(props.aporte.attachments) && props.aporte.attachments.length > 0) {
    existingAttachments.value = [...props.aporte.attachments]
  } else {
    try {
      const attRes = await $api(`attachments?attachable_type=aporte&attachable_id=${props.aporte.id}`)
      if (attRes && attRes.data && Array.isArray(attRes.data)) {
        existingAttachments.value = attRes.data
      } else {
        existingAttachments.value = []
      }
    } catch (err) {
      console.warn('No se pudieron cargar adjuntos para aporte:', err)
      existingAttachments.value = []
    }
  }

  showUploadBox.value = existingAttachments.value.length === 0

  const obj = props.aporte
  const partnerId = obj.partner?.id || obj.partner_id || null
  const cuentaId = obj.cuenta?.id || obj.cuenta_id || null

  form.value.partner_id = partnerId
  form.value.monto = obj.monto || null
  form.value.descripcion = obj.descripcion || ''
  form.value.cuenta_id = cuentaId
  form.value.metodo_pago = obj.metodo_pago || ''
  form.value.fecha_aporte = formatDate(obj.fecha_aporte) || ''
  form.value.hora_aporte = obj.hora_aporte || ''
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
  }
}

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()

  if (!valid) {
    showNotification('Por favor, completa todos los campos requeridos', 'warning')
    return
  }

  loading.value = true
  loader.start()

  try {
    let response

    if (receiptFiles.value.length > 0) {
      const fd = new FormData()
      fd.append('_method', 'PUT')
      fd.append('partner_id', form.value.partner_id)
      fd.append('monto', form.value.monto)
      fd.append('descripcion', form.value.descripcion || '')
      fd.append('cuenta_id', form.value.cuenta_id)
      fd.append('metodo_pago', form.value.metodo_pago)
      fd.append('fecha_aporte', form.value.fecha_aporte)
      fd.append('hora_aporte', form.value.hora_aporte || '12:00')

      receiptFiles.value.forEach(f => {
        fd.append('receipts[]', f)
      })

      response = await $api(`aportes/${props.aporte.id}`, {
        method: 'POST',
        body: fd,
      })
    } else {
      response = await $api(`aportes/${props.aporte.id}`, {
        method: 'PUT',
        body: {
          ...form.value,
          monto: parseFloat(form.value.monto) || 0,
        },
      })
    }

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

watch(show, newVal => {
  if (newVal) {
    isLoadingData.value = true
    Promise.all([loadPartners(), loadAccounts()])
      .then(async () => {
        if (props.aporte) {
          await loadAporteData()
        } else {
          resetForm()
        }
      })
      .catch(error => {
        console.error('❌ Error cargando datos:', error)
      })
      .finally(() => {
        isLoadingData.value = false
      })
  } else {
    resetForm()
  }
})

watch(() => props.aporte, (newVal) => {
  if (newVal && show.value) {
    loadAporteData()
  }
}, { immediate: true, deep: true })

onMounted(() => {
  loadPartners()
  loadAccounts()
  if (props.aporte) {
    loadAporteData()
  }
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
          <VIcon icon="ri-edit-line" />
        </div>
        <h3 class="custom-dialog-title">
          {{ dialogTitle }}
        </h3>
        <p class="custom-dialog-subtitle">
          Modificar información registrada del aporte de capital
        </p>
      </div>

      <!-- Formulario -->
      <VCardText class="pa-6">
        <!-- Skeleton Loader mientras se cargan datos -->
        <div v-if="isLoadingData" class="py-2">
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

            <!-- Comprobantes Registrados con Previsualización de Imagen -->
            <VCol
              v-if="existingAttachments.length > 0"
              cols="12"
              class="mb-3"
            >
              <label class="custom-form-label font-weight-bold text-subtitle-2 mb-2 d-flex align-center justify-space-between">
                <span>Comprobantes Registrados ({{ existingAttachments.length }})</span>
                <VBtn
                  v-if="!showUploadBox"
                  variant="tonal"
                  color="primary"
                  size="small"
                  prepend-icon="ri-add-circle-line"
                  class="px-3 text-none font-weight-medium rounded-lg"
                  @click="showUploadBox = true"
                >
                  Agregar más comprobantes
                </VBtn>
              </label>
              
              <VRow dense>
                <VCol
                  v-for="att in existingAttachments"
                  :key="att.id"
                  cols="12"
                  sm="6"
                >
                  <VCard
                    variant="outlined"
                    class="rounded-xl overflow-hidden position-relative bg-grey-lighten-4 elevation-1"
                  >
                    <!-- Imagen / Vista Previa -->
                    <div
                      style="height: 140px;"
                      class="d-flex align-center justify-center bg-grey-lighten-3 overflow-hidden position-relative"
                    >
                      <VImg
                        v-if="att.is_image || isImageFile(att)"
                        :src="getAttachmentUrl(att)"
                        cover
                        height="140"
                        class="w-100 cursor-pointer"
                        @click="openImageModal(getAttachmentUrl(att))"
                      />
                      <div
                        v-else
                        class="text-center pa-4 cursor-pointer"
                        @click="window.open(getAttachmentUrl(att), '_blank')"
                      >
                        <VIcon
                          icon="ri-file-pdf-fill"
                          color="error"
                          size="48"
                          class="mb-1"
                        />
                        <div
                          class="text-caption font-weight-bold text-truncate"
                          style="max-width: 180px;"
                        >
                          {{ att.file_name || 'Documento PDF' }}
                        </div>
                      </div>
                    </div>

                    <!-- Footer con Nombre y Acciones -->
                    <div class="pa-2 d-flex align-center justify-space-between bg-white border-top">
                      <span
                        class="text-caption font-weight-semibold text-truncate me-2"
                        style="max-width: 140px;"
                        :title="att.file_name"
                      >
                        {{ att.file_name || 'Comprobante' }}
                      </span>
                      <div class="d-flex align-center gap-1">
                        <VBtn
                          v-if="att.is_image || isImageFile(att)"
                          icon="ri-eye-line"
                          size="x-small"
                          color="primary"
                          variant="tonal"
                          title="Ver imagen grande"
                          @click="openImageModal(getAttachmentUrl(att))"
                        />
                        <VBtn
                          icon="ri-delete-bin-line"
                          size="x-small"
                          color="error"
                          variant="tonal"
                          title="Eliminar comprobante"
                          @click="deleteExistingAttachment(att.id)"
                        />
                      </div>
                    </div>
                  </VCard>
                </VCol>
              </VRow>
            </VCol>

            <!-- Agregar Nuevos Comprobantes (Foto / PDF) -->
            <VCol
              v-if="showUploadBox || existingAttachments.length === 0"
              cols="12"
            >
              <div
                v-if="existingAttachments.length > 0"
                class="d-flex justify-space-between align-center mb-1"
              >
                <span class="text-caption font-weight-bold text-primary">Agregar nuevos comprobantes</span>
                <VBtn
                  size="x-small"
                  variant="text"
                  color="secondary"
                  icon="ri-close-line"
                  title="Ocultar cargador"
                  @click="showUploadBox = false"
                />
              </div>
              <ReceiptUploader
                v-model="receiptFiles"
                label="Comprobantes Adicionales (Foto / PDF)"
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
          prepend-icon="ri-refresh-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loading"
          @click="handleSubmit"
        >
          Actualizar Aporte
        </VBtn>
      </VCardActions>
    </VCard>

    <!-- Modal para ver imagen completa -->
    <VDialog
      v-model="isImageModalOpen"
      max-width="800"
    >
      <VCard class="pa-2 rounded-2xl overflow-hidden">
        <div class="d-flex justify-end pa-1">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            @click="isImageModalOpen = false"
          />
        </div>
        <div class="d-flex justify-center pa-2">
          <img
            :src="selectedImageUrl"
            style="max-width: 100%; max-height: 80vh; object-fit: contain;"
            class="rounded-xl"
          >
        </div>
      </VCard>
    </VDialog>
  </VDialog>
</template>
