<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import ReceiptUploader from '@/components/common/ReceiptUploader.vue'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  expense: {
    type: Object,
    default: () => ({}),
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'updated'])

// Estado
const formRef = ref(null)
const employees = ref([])
const accounts = ref([])
const isLoadingData = ref(false)
const newReceiptFiles = ref([])
const existingAttachments = ref([])
const isLoadingAttachments = ref(false)

const paymentMethods = [
  { text: 'Efectivo', value: 'EFECTIVO' },
  { text: 'Transferencia', value: 'TRANSFERENCIA' },
]

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Computed
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const isEditing = computed(() => !!props.expense)

const dialogTitle = computed(() => isEditing.value ? 'Editar Adelanto' : 'Nuevo Adelanto')

const filteredAccounts = computed(() => {
  const method = form.value.payment_method
  let result = accounts.value
  if (method === 'EFECTIVO') {
    result = accounts.value.filter(acc => acc.type === 'cash')
  } else if (method === 'TRANSFERENCIA') {
    result = accounts.value.filter(acc => acc.type === 'bank')
  }

  if (form.value.account_id) {
    const selectedAcc = accounts.value.find(acc => Number(acc.id) === Number(form.value.account_id))
    if (selectedAcc && !result.some(acc => Number(acc.id) === Number(selectedAcc.id))) {
      result = [selectedAcc, ...result]
    }
  }

  return result
})

// Formulario reactivo
const form = ref({
  employee_id: null,
  employee_name: '',
  account_id: null,
  account_name: '',
  amount: null,
  description: '',
  advance_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
  payment_method: 'TRANSFERENCIA',
})

// Funciones
const resetForm = () => {
  form.value = {
    employee_id: null,
    employee_name: '',
    account_id: null,
    account_name: '',
    amount: null,
    description: '',
    advance_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
    payment_method: 'TRANSFERENCIA',
  }
  newReceiptFiles.value = []
  formRef.value?.reset()
}

const closeDialog = () => {
  show.value = false
  setTimeout(() => {
    resetForm()
  }, 100)
}

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loader.start()

  try {
    const payload = {
      employee_id: form.value.employee_id,
      account_id: form.value.account_id,
      amount: parseFloat(form.value.amount),
      description: form.value.description,
      advance_date: form.value.advance_date,
      payment_method: form.value.payment_method,
      reason: form.value.description,
    }

    const response = await $api(`employee-expenses/${props.expense?.id}/advance`, {
      method: 'PUT',
      body: payload,
    })

    // Subir nuevos comprobantes si fueron seleccionados
    if (newReceiptFiles.value.length > 0 && props.expense?.id) {
      const formData = new FormData()
      formData.append('attachable_type', 'employee_advance')
      formData.append('attachable_id', props.expense.id)
      formData.append('identifier', `ADEL-EMP-${String(props.expense.id).padStart(5, '0')}`)
      if (props.expense.employee_name) {
        formData.append('party_name', props.expense.employee_name)
      }

      newReceiptFiles.value.forEach((fileObj) => {
        const rawFile = fileObj.file || fileObj
        formData.append('receipts[]', rawFile)
      })
      await $api('attachments/upload', {
        method: 'POST',
        body: formData,
      })
    }

    showNotification('Adelanto actualizado exitosamente', 'success')
    emit('updated', response)
    closeDialog()
  } catch (error) {
    console.error('Error al guardar adelanto:', error)

    if (error.status === 422 && error.data?.message) {
      if (error.data.message.includes('Saldo insuficiente')) {
        showNotification('Saldo insuficiente en la cuenta.\nSaldo disponible: $' + error.data.saldo_disponible + '\nMonto solicitado: $' + error.data.monto_solicitado, 'error')
        return
      }
      showNotification(error.data.message, 'error')
      return
    }

    showNotification('Error al guardar el adelanto. Por favor, intente nuevamente.', 'error')
  } finally {
    loader.stop()
  }
}

const fetchExistingAttachments = async advanceId => {
  // 1. Cargar inmediatamente desde props.expense o resetear
  existingAttachments.value = (props.expense?.attachments && Array.isArray(props.expense.attachments))
    ? [...props.expense.attachments]
    : []

  const id = advanceId || props.expense?.id
  if (!id) return

  isLoadingAttachments.value = true
  try {
    const res = await $api('attachments', {
      params: {
        attachable_type: 'employee_advance',
        attachable_id: id,
      },
    })

    let attList = []
    if (Array.isArray(res)) {
      attList = res
    } else if (res && Array.isArray(res.data)) {
      attList = res.data
    } else if (res && Array.isArray(res.attachments)) {
      attList = res.attachments
    }

    existingAttachments.value = attList
  } catch (e) {
    console.error('Error al cargar comprobantes:', e)
  } finally {
    isLoadingAttachments.value = false
  }
}

const deleteAttachment = async id => {
  try {
    await $api(`attachments/${id}`, { method: 'DELETE' })
    showNotification('Comprobante eliminado', 'success')
    existingAttachments.value = existingAttachments.value.filter(a => a.id !== id)
  } catch (e) {
    showNotification('Error al eliminar comprobante', 'error')
  }
}

const isImageFile = att => {
  if (!att) return false
  if (att.is_image) return true
  const path = att.file_path || att.url || att.file_name || ''
  return /\.(jpeg|jpg|png|webp|gif|svg)$/i.test(path)
}

const isPdfFile = att => {
  if (!att) return false
  if (att.is_pdf) return true
  const path = att.file_path || att.url || att.file_name || ''
  return /\.pdf$/i.test(path)
}

const getFullUrl = path => {
  if (!path) return ''
  if (typeof path === 'object' && path.url) return path.url
  if (path.startsWith('http://') || path.startsWith('https://')) return path

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const base = isLocal
    ? (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : 'http://127.0.0.1:8000')
    : `http://${hostname}:8000`

  const cleanPath = path.replace(/^\/?storage\/?/, '')

  return `${base}/storage/${cleanPath}`
}

const openAttachment = att => {
  const url = att.download_url || getFullUrl(att.file_path || att.url)
  window.open(url, '_blank')
}

const loadEmployees = async () => {
  try {
    const response = await $api('employees')
    employees.value = (response.employees || []).map(emp => ({
      ...emp,
      id: Number(emp.id),
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
    }))
  } catch (error) {
    console.error('Error al cargar empleados:', error)
  }
}

const loadAccounts = async () => {
  try {
    const response = await $api('accounts')
    accounts.value = (response || []).map(account => {
      const rawName = account.name || account.account_name || account.description || `Cuenta ${account.id}`
      const cleanedName = rawName
        .replace(/\(EFECTIVO\)/gi, '')
        .replace(/\(TRANSFERENCIA\)/gi, '')
        .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
        .trim()

      return {
        ...account,
        id: Number(account.id),
        name: account.bank_name ? `${account.bank_name} (${cleanedName})` : cleanedName,
      }
    })
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
  }
}

const assignAdvanceData = advanceData => {
  if (!advanceData) return
  console.log('🔍 EditAdvance - Asignando datos:', advanceData)

  // 1. Asignar Empleado (por ID o por nombre)
  let empId = advanceData.employee_id || advanceData.employee?.id
  if (!empId && advanceData.employee_name && employees.value.length > 0) {
    const cleanSearchName = advanceData.employee_name.trim().toLowerCase()
    const emp = employees.value.find(e =>
      (e.name && e.name.toLowerCase() === cleanSearchName) ||
      `${e.first_name || ''} ${e.last_name || ''}`.trim().toLowerCase() === cleanSearchName ||
      cleanSearchName.includes((e.name || '').toLowerCase())
    )
    if (emp) empId = emp.id
  }
  if (empId) {
    form.value.employee_id = Number(empId)
  }

  // 2. Asignar Cuenta (por ID o por nombre)
  let accId = advanceData.account_id || advanceData.account?.id
  if (!accId && advanceData.account_name && accounts.value.length > 0) {
    const cleanAccName = advanceData.account_name
      .replace(/\(EFECTIVO\)|\(TRANSFERENCIA\)|\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
      .trim()
      .toLowerCase()

    const acc = accounts.value.find(a => {
      const name = (a.name || '').toLowerCase()
      const bank = (a.bank_name || '').toLowerCase()
      return name.includes(cleanAccName) || cleanAccName.includes(name) || (bank && cleanAccName.includes(bank))
    })
    if (acc) accId = acc.id
  }
  if (accId) {
    form.value.account_id = Number(accId)
  }

  // 3. Asignar Método de Pago
  if (advanceData.payment_method) {
    form.value.payment_method = advanceData.payment_method
  } else if (form.value.account_id && accounts.value.length > 0) {
    const selectedAcc = accounts.value.find(a => Number(a.id) === Number(form.value.account_id))
    if (selectedAcc) {
      form.value.payment_method = selectedAcc.type === 'cash' ? 'EFECTIVO' : 'TRANSFERENCIA'
    }
  }

  // 4. Asignar campos básicos
  form.value.amount = advanceData.amount || null
  form.value.description = advanceData.description || ''

  const dateValue = advanceData.advance_date || advanceData.date || new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]
  if (dateValue && typeof dateValue === 'string' && dateValue.includes('/')) {
    const [day, month, year] = dateValue.split('/')
    form.value.advance_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  } else if (dateValue) {
    form.value.advance_date = dateValue
  }
}

watch(() => show.value, async newVal => {
  if (newVal) {
    isLoadingData.value = true
    try {
      await Promise.all([loadEmployees(), loadAccounts()])
      await nextTick()
      if (props.expense) {
        assignAdvanceData(props.expense)
        fetchExistingAttachments(props.expense.id)
      }
    } finally {
      isLoadingData.value = false
    }
  }
})

watch(() => props.expense, async (newVal) => {
  if (newVal) {
    await nextTick()
    assignAdvanceData(newVal)
    fetchExistingAttachments(newVal.id)
  }
}, { immediate: true })

onMounted(async () => {
  isLoadingData.value = true
  try {
    await Promise.all([loadEmployees(), loadAccounts()])
    if (props.expense) {
      assignAdvanceData(props.expense)
      fetchExistingAttachments(props.expense.id)
    }
  } finally {
    isLoadingData.value = false
  }
})
</script>

<template>
  <VDialog v-model="show" scrollable max-width="920" persistent>
    <VCard class="custom-dialog-card">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn" @click="closeDialog" />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-edit-line" />
        </div>
        <h3 class="custom-dialog-title">
          Editar Adelanto
        </h3>
        <p class="custom-dialog-subtitle">
          Modifica los datos del adelanto registrado
        </p>
      </div>

      <VCardText class="pa-4">
        <!-- Skeleton loader mientras cargan datos -->
        <div v-if="isLoadingData" class="py-2">
          <VRow>
            <VCol cols="12">
              <VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" />
            </VCol>
            <VCol cols="6">
              <VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" />
            </VCol>
            <VCol cols="6">
              <VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" />
            </VCol>
            <VCol cols="6">
              <VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" />
            </VCol>
            <VCol cols="6">
              <VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" />
            </VCol>
            <VCol cols="12">
              <VSkeletonLoader type="article" class="rounded-lg" />
            </VCol>
          </VRow>
        </div>

        <VForm v-else ref="formRef" @submit.prevent="handleSubmit">
          <VRow>
            <VCol cols="12">
                <VSelect v-model="form.employee_id" :items="employees" item-title="name" item-value="id" label="Empleado"
                  placeholder="Seleccionar empleado" :rules="[v => !!v]" required />
              </VCol>
            </VRow>

            <VRow>
              <VCol cols="12">
                <VSelect v-model="form.payment_method" :items="paymentMethods" item-title="text" item-value="value"
                  label="Método de Pago" :rules="[v => !!v]" required />
              </VCol>
            </VRow>

            <VRow>
              <VCol cols="12">
                <VSelect v-model="form.account_id" :items="filteredAccounts" item-title="name" item-value="id"
                  label="Cuenta" placeholder="Seleccionar cuenta" :rules="[v => !!v]" required>
                  <template #prepend-inner>
                    <VIcon color="primary" size="20">
                      {{ form.payment_method === 'EFECTIVO' ? 'ri-money-dollar-circle-line' : 'ri-bank-line' }}
                    </VIcon>
                  </template>
                  <template #item="{ props, item }">
                    <VListItem v-bind="props" :title="undefined">
                      <template #prepend>
                        <VAvatar size="30" :color="item.raw.type === 'cash' ? 'success' : 'primary'" variant="tonal"
                          class="me-2">
                          <VIcon :icon="item.raw.type === 'cash' ? 'ri-money-dollar-circle-line' : 'ri-bank-card-line'"
                            size="18" />
                        </VAvatar>
                      </template>
                      <VListItemTitle class="font-weight-medium">
                        {{ item.raw.name }}
                      </VListItemTitle>
                      <VListItemSubtitle class="text-caption mt-1">
                        Saldo: <span class="font-weight-bold"
                          :class="item.raw.saldo_actual >= 0 ? 'text-success' : 'text-error'">${{
                            parseFloat(item.raw.saldo_actual).toFixed(2) }}</span>
                      </VListItemSubtitle>
                    </VListItem>
                  </template>
                </VSelect>
              </VCol>
            </VRow>

            <VRow>
              <VCol cols="12">
                <VTextField v-model="form.amount" label="Monto" type="number" prefix="$" placeholder="0.00"
                  :rules="[v => !!v && v > 0]" required />
              </VCol>
            </VRow>

            <VRow>
              <VCol cols="12">
                <VTextField v-model="form.description" label="Descripción" placeholder="Descripción del adelanto"
                  :rules="[v => !!v]" />
              </VCol>
            </VRow>

            <VRow>
              <VCol cols="12">
                <VTextField v-model="form.advance_date" label="Fecha" type="date" :rules="[v => !!v]" required />
              </VCol>
            </VRow>

            <!-- Sección de Comprobantes Adjuntos con Previsualización Grid -->
            <VRow class="mt-2">
              <VCol cols="12">
                <VDivider class="my-3" />
                <div class="d-flex align-center justify-space-between mb-3">
                  <span class="text-subtitle-2 font-weight-bold text-high-emphasis d-flex align-center gap-1">
                    <VIcon icon="ri-attachment-2" color="primary" size="18" />
                    Comprobante(s) de Adelanto (Previsualización)
                  </span>
                  <VChip v-if="existingAttachments.length > 0" size="x-small" color="success" variant="tonal" class="font-weight-bold">
                    {{ existingAttachments.length }} guardado(s)
                  </VChip>
                </div>

                <!-- Grid de Comprobantes Guardados -->
                <div v-if="existingAttachments.length > 0" class="mb-4">
                  <div class="existing-grid">
                    <div v-for="att in existingAttachments" :key="att.id" class="existing-card elevation-1">
                      <!-- Imagen Thumbnail Previsualización -->
                      <div v-if="isImageFile(att)" class="existing-media" @click="openAttachment(att)">
                        <img :src="getFullUrl(att.file_path || att.url)" :alt="att.file_name" class="existing-img" />
                        <div class="existing-overlay">
                          <VIcon icon="ri-external-link-line" color="white" size="18" />
                        </div>
                      </div>

                      <!-- PDF Thumbnail Previsualización -->
                      <div v-else-if="isPdfFile(att)" class="existing-media pdf-media" @click="openAttachment(att)">
                        <VIcon icon="ri-file-pdf-2-fill" size="36" color="error" />
                        <span class="pdf-tag">PDF</span>
                      </div>

                      <!-- General Media -->
                      <div v-else class="existing-media" @click="openAttachment(att)">
                        <VIcon icon="ri-file-3-line" size="32" color="primary" />
                      </div>

                      <!-- Info & Acciones -->
                      <div class="existing-info pa-2">
                        <div class="text-caption font-weight-medium text-truncate text-high-emphasis" :title="att.file_name">
                          {{ att.file_name || 'Comprobante' }}
                        </div>
                        <div class="d-flex align-center justify-space-between text-caption text-disabled mt-1">
                          <span style="font-size: 10px;">{{ att.created_at ? new Date(att.created_at).toLocaleDateString() : 'Archivo' }}</span>
                          <div class="d-flex gap-1">
                            <VBtn icon="ri-download-2-line" size="x-small" variant="text" color="primary" title="Descargar" @click.stop="openAttachment(att)" />
                            <VBtn icon="ri-delete-bin-line" size="x-small" variant="text" color="error" title="Eliminar" @click.stop="deleteAttachment(att.id)" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Subir Nuevos Comprobantes -->
                <ReceiptUploader
                  v-model="newReceiptFiles"
                  label="Adjuntar Nuevos Comprobantes (Foto / PDF)"
                  hint="Puedes agregar o reemplazar fotos del comprobante de adelanto"
                  :max-files="5"
                  @error="msg => showNotification(msg, 'error')"
                />
              </VCol>
            </VRow>

            <VDivider class="mt-4" />
          <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white"
            style="position: sticky; bottom: 0; z-index: 2;">
            <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
              class="rounded-lg px-6 font-weight-medium" height="40" @click="closeDialog">
              Cancelar
            </VBtn>
            <VBtn color="primary" variant="elevated" type="submit" :loading="loader.loading" :disabled="loader.loading"
              prepend-icon="ri-refresh-line" class="rounded-lg px-6 font-weight-bold" height="40">
              Actualizar Adelanto
            </VBtn>
          </VCardActions>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.existing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

.existing-card {
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.existing-media {
  height: 95px;
  width: 100%;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

.existing-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.existing-media:hover .existing-img {
  transform: scale(1.06);
}

.existing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.existing-media:hover .existing-overlay {
  opacity: 1;
}

.pdf-media {
  background: #fef2f2;
  flex-direction: column;
  gap: 2px;
}

.pdf-tag {
  font-size: 9px;
  font-weight: 800;
  color: #dc2626;
  letter-spacing: 0.5px;
}

.existing-info {
  background: white;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
