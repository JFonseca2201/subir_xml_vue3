<script setup>
import { ref, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import ReceiptUploader from '@/components/common/ReceiptUploader.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  transferData: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'transferred'])

// Estado
const formRef = ref(null)
const loading = ref(false)
const accounts = ref([])
const { showNotification } = useGlobalToast()
const receiptFiles = ref([])

const form = ref({
  from_account_id: null,
  to_account_id: null,
  amount: '',
  description: '',
  transfer_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
})

// Computed
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const isEditing = computed(() => !!props.transferData)

const originAccounts = computed(() => {
  return accounts.value.filter(account => account.id !== form.value.to_account_id)
})

const destinationAccounts = computed(() => {
  return accounts.value.filter(account => account.id !== form.value.from_account_id)
})

// Cargar cuentas desde la API
const loadAccounts = async () => {
  try {
    const response = await $api('accounts')

    accounts.value = (response || []).map(account => {
      const cleanedName = (account.name || '')
        .replace(/\(EFECTIVO\)/gi, '')
        .replace(/\(TRANSFERENCIA\)/gi, '')
        .trim()

      return {
        ...account,
        display_name: `${account.bank_name} (${cleanedName})`,
      }
    })
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
    showNotification('Error al cargar la lista de cuentas', 'error')
  }
}

const resetForm = () => {
  receiptFiles.value = []
  form.value = {
    from_account_id: null,
    to_account_id: null,
    amount: '',
    description: '',
    transfer_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
  }
  if (formRef.value) formRef.value.resetValidation()
}

const closeDialog = () => {
  show.value = false
}

const handleSubmit = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  if (form.value.from_account_id === form.value.to_account_id) {
    showNotification('La cuenta de origen y destino no pueden ser la misma', 'warning')
    return
  }

  if (!isEditing.value && receiptFiles.value.length === 0) {
    showNotification('Es obligatorio adjuntar la foto o comprobante de la transferencia', 'warning')
    return
  }

  loading.value = true

  try {
    let method = isEditing.value ? 'PUT' : 'POST'
    const endpoint = isEditing.value ? `transfers/${props.transferData.id}` : 'transfers'

    let requestBody
    if (receiptFiles.value.length > 0) {
      const formData = new FormData()
      formData.append('from_account_id', form.value.from_account_id)
      formData.append('to_account_id', form.value.to_account_id)
      formData.append('amount', form.value.amount)
      if (form.value.description) formData.append('description', form.value.description)
      if (form.value.transfer_date) formData.append('transfer_date', form.value.transfer_date)
      if (isEditing.value) {
        formData.append('_method', 'PUT')
        method = 'POST'
      }
      receiptFiles.value.forEach(file => {
        formData.append('receipts[]', file)
      })
      requestBody = formData
    } else {
      requestBody = form.value
    }

    const response = await $api(endpoint, {
      method: method,
      body: requestBody,
    })

    showNotification(`Transferencia ${isEditing.value ? 'actualizada' : 'realizada'} exitosamente`, 'success')
    emit('transferred', response)
    closeDialog()
  } catch (error) {
    console.error('Error al realizar transferencia:', error)
    const errMessage = error?.data?.message || (error?.data?.errors ? Object.values(error.data.errors).flat().join(', ') : 'Error al procesar la transferencia')
    showNotification(errMessage, 'error')
  } finally {
    loading.value = false
  }
}

watch(() => show.value, newVal => {
  if (newVal) {
    loadAccounts().then(() => {
      if (props.transferData) {
        form.value = {
          from_account_id: props.transferData.from_account_id || props.transferData.source_account_id || null,
          to_account_id: props.transferData.to_account_id || props.transferData.destination_account_id || null,
          amount: props.transferData.amount || '',
          description: props.transferData.description,
          transfer_date: props.transferData.transfer_date
            ? props.transferData.transfer_date.split('T')[0]
            : (props.transferData.created_at ? props.transferData.created_at.split('T')[0] : new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]),
        }
      } else {
        resetForm()
      }
    })
  }
})
</script>

<template>
  <VDialog
    v-model="show"
    scrollable
    max-width="650"
    persistent
  >
    <VCard class="rounded-xl overflow-hidden elevation-10 d-flex flex-column" style="max-height: 90vh;">
      <!-- Header Banner Fijo -->
      <VCardTitle class="pa-4 bg-primary text-white d-flex align-center justify-space-between flex-none">
        <div class="d-flex align-center gap-3">
          <VAvatar
            color="white"
            variant="tonal"
            size="38"
            rounded="lg"
          >
            <VIcon
              icon="ri-arrow-left-right-line"
              color="white"
              size="22"
            />
          </VAvatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold text-white leading-tight">
              {{ isEditing ? 'Editar Transferencia' : 'Transferencia entre Cuentas' }}
            </div>
            <div class="text-caption text-white opacity-80" style="font-size: 11px;">
              Mueve fondos entre cuentas del sistema
            </div>
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          color="white"
          :disabled="loading"
          @click="closeDialog"
        />
      </VCardTitle>

      <!-- Formulario con Scroll Interno -->
      <VCardText class="pa-5 overflow-y-auto" style="flex: 1 1 auto; max-height: calc(90vh - 140px);">
        <VForm
          ref="formRef"
          @submit.prevent="handleSubmit"
        >
          <VRow dense>
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="form.from_account_id"
                :items="originAccounts"
                item-value="id"
                item-title="display_name"
                label="Cuenta Origen *"
                placeholder="Desde dónde"
                :rules="[v => !!v || 'Requerido']"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-bank-card-line"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <VSelect
                v-model="form.to_account_id"
                :items="destinationAccounts"
                item-value="id"
                item-title="display_name"
                label="Cuenta Destino *"
                placeholder="Hacia dónde"
                :rules="[v => !!v || 'Requerido', v => v !== form.from_account_id || 'Debe ser diferente al origen']"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-bank-card-fill"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="form.amount"
                label="Monto a Transferir *"
                placeholder="0.00"
                type="number"
                prefix="$"
                :rules="[v => !!v || 'Requerido', v => v > 0 || 'El monto debe ser mayor a 0']"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-money-dollar-circle-line"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="form.transfer_date"
                label="Fecha *"
                type="date"
                :rules="[v => !!v || 'Requerido']"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-calendar-line"
              />
            </VCol>
            <VCol cols="12">
              <VTextarea
                v-model="form.description"
                label="Motivo / Descripción *"
                placeholder="Ej. Reposición de caja chica..."
                rows="2"
                variant="outlined"
                density="comfortable"
                no-resize
                :rules="[v => !!v || 'Requerido']"
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

            <!-- Foto / Comprobante de la Transferencia -->
            <VCol cols="12" class="mt-1">
              <ReceiptUploader
                v-model="receiptFiles"
                label="Foto / Comprobante de la Transferencia"
                hint="Adjunta foto del comprobante o captura de la transferencia entre cuentas (Obligatorio)"
                required
                :max-files="5"
                @error="msg => showNotification(msg, 'error')"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Footer Fijo de Acciones -->
      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-grey-lighten-5 flex-none"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-5 font-weight-medium"
          height="38"
          :disabled="loading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-check-line"
          class="rounded-lg px-6 font-weight-bold"
          height="38"
          :loading="loading"
          :disabled="loading || (!isEditing && receiptFiles.length === 0)"
          @click="handleSubmit"
        >
          {{ isEditing ? 'Actualizar Transferencia' : 'Realizar Transferencia' }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
