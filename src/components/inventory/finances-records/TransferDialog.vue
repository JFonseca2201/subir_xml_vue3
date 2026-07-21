<script setup>
import { ref, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

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

  loading.value = true

  try {
    const method = isEditing.value ? 'PUT' : 'POST'
    const endpoint = isEditing.value ? `transfers/${props.transferData.id}` : 'transfers'

    const response = await $api(endpoint, {
      method: method,
      body: form.value,
    })

    showNotification(`Transferencia ${isEditing.value ? 'actualizada' : 'realizada'} exitosamente`, 'success')
    emit('transferred', response)
    closeDialog()
  } catch (error) {
    console.error('Error al realizar transferencia:', error)
    showNotification(error?.data?.message || 'Error al procesar la transferencia', 'error')
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
    max-width="600"
    persistent
  >
    <VCard>
      <!-- Header -->
      <VCardTitle class="pa-6 pb-4">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-3">
            <VIcon
              icon="ri-arrow-left-right-line"
              color="primary"
              size="28"
            />
            <div>
              <h3 class="text-h5 font-weight-bold">
                {{ isEditing ? 'Editar Transferencia' : 'Transferencia entre Cuentas' }}
              </h3>
              <span class="text-medium-emphasis text-body-2">
                Mueve fondos de una cuenta a otra
              </span>
            </div>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            :disabled="loading"
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
                rows="3"
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
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Footer -->
      <VCardActions class="pa-6 d-flex justify-end">
        <VSpacer />
        <VBtn
          variant="outlined"
          prepend-icon="ri-close-line"
          :disabled="loading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-check-line"
          :loading="loading"
          @click="handleSubmit"
        >
          {{ isEditing ? 'Actualizar Transferencia' : 'Confirmar Transferencia' }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
