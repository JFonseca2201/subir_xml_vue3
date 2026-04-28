<template>
    <VDialog v-model="isVisible" max-width="600" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-edit-line" size="42" color="info" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Editar Transferencia</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Modificar datos de la transferencia
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Formulario -->
            <VCardText>
                <VForm ref="formRef" @submit.prevent="handleSubmit">
                    <VRow>
                        <!-- Cuenta Origen (Solo lectura) -->
                        <VCol cols="12">
                            <VSelect v-model="form.from_account_id" :items="accountOptions" item-title="label"
                                item-value="value" label="Cuenta Origen *" prepend-inner-icon="ri-bank-line"
                                :rules="[rules.required]" placeholder="Seleccione la cuenta de origen"
                                variant="outlined" disabled />

                            <!-- Información de cuenta origen -->
                            <div v-if="fromAccount" class="mt-2 pa-3 bg-blue-light rounded">
                                <div class="d-flex align-center justify-space-between">
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Saldo actual</div>
                                        <div class="text-h6 font-weight-bold text-primary">
                                            ${{ formatCurrency(fromAccount.current_balance) }}
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-caption text-medium-emphasis">Banco</div>
                                        <div class="font-weight-medium">{{ getAccountDisplayName(fromAccount) }}</div>
                                    </div>
                                </div>
                            </div>
                        </VCol>

                        <!-- Cuenta Destino (Solo lectura) -->
                        <VCol cols="12">
                            <VSelect v-model="form.to_account_id" :items="accountOptions" item-title="label"
                                item-value="value" label="Cuenta Destino *" prepend-inner-icon="ri-bank-card-line"
                                :rules="[rules.required]" placeholder="Seleccione la cuenta de destino"
                                variant="outlined" disabled />

                            <!-- Información de cuenta destino -->
                            <div v-if="toAccount" class="mt-2 pa-3 bg-green-light rounded">
                                <div class="d-flex align-center justify-space-between">
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Banco</div>
                                        <div class="font-weight-medium text-success">{{ getAccountDisplayName(toAccount)
                                            }}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-caption text-medium-emphasis">Cuenta</div>
                                        <div class="font-weight-medium">{{ toAccount.last_four || '****' }}</div>
                                    </div>
                                </div>
                            </div>
                        </VCol>

                        <!-- Monto -->
                        <VCol cols="12">
                            <VTextField v-model="form.amount" label="Monto Transferido *"
                                prepend-inner-icon="ri-money-dollar-circle-line"
                                :rules="[rules.required, rules.positive]" placeholder="0.00" type="number" step="0.01"
                                min="0.01" variant="outlined" />
                        </VCol>

                        <!-- Fecha -->
                        <VCol cols="12">
                            <VTextField v-model="form.transfer_date" label="Fecha de Transferencia *"
                                prepend-inner-icon="ri-calendar-line" :rules="[rules.required]" type="date"
                                variant="outlined" />
                        </VCol>

                        <!-- Descripción -->
                        <VCol cols="12">
                            <VTextarea v-model="form.description" label="Descripción"
                                prepend-inner-icon="ri-file-text-line" placeholder="Ingrese una descripción..." rows="3"
                                variant="outlined" />
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>

            <VDivider class="mt-6" />

            <!-- Acciones -->
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" @click="closeDialog">
                    Cancelar
                </VBtn>
                <VBtn color="info" variant="elevated" prepend-icon="ri-save-line" :loading="loading"
                    :disabled="!isFormValid" @click="handleSubmit">
                    Guardar Cambios
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getAccountDisplayName, formatAccountDisplay } from '@/utils/helpers'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    transferData: {
        type: Object,
        default: null
    }
})

const emit = defineEmits(['update:modelValue', 'success'])

const { showNotification } = useGlobalToast()

// Estado
const formRef = ref()
const loading = ref(false)
const accounts = ref([])
const loadingAccounts = ref(false)
const form = ref({
    from_account_id: null,
    to_account_id: null,
    amount: '',
    transfer_date: '',
    description: ''
})

// Computed
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const accountOptions = computed(() => {
    return accounts.value.map(account => ({
        label: formatAccountDisplay(account),
        value: account.id,
        account: account
    }))
})

const fromAccount = computed(() => {
    if (!form.value.from_account_id) return null
    return accounts.value.find(account => account.id === form.value.from_account_id)
})

const toAccount = computed(() => {
    if (!form.value.to_account_id) return null
    return accounts.value.find(account => account.id === form.value.to_account_id)
})

const isFormValid = computed(() => {
    return form.value.from_account_id &&
        form.value.to_account_id &&
        form.value.amount &&
        parseFloat(form.value.amount) > 0 &&
        form.value.transfer_date
})

// Reglas de validación
const rules = {
    required: value => !!value || 'Este campo es requerido',
    positive: value => parseFloat(value) > 0 || 'El monto debe ser mayor a 0'
}

// Métodos
const loadAvailableAccounts = async () => {
    loadingAccounts.value = true
    try {
        const resp = await $api('transfer-accounts', { method: 'GET' })
        console.log('Raw API response from transfer-accounts (EditDialog):', resp)

        // Usar el formato correcto: resp.accounts
        let accountsData = []
        if (resp && resp.accounts && Array.isArray(resp.accounts)) {
            accountsData = resp.accounts
        } else if (resp && resp.data && Array.isArray(resp.data)) {
            accountsData = resp.data
        } else if (resp && Array.isArray(resp)) {
            accountsData = resp
        } else {
            console.warn('Unexpected response format in EditDialog:', resp)
        }

        accounts.value = accountsData
        console.log('Processed accounts data in EditDialog:', accounts.value)

        if (accounts.value.length === 0) {
            console.warn('No accounts found in EditDialog response')
            showNotification('No se encontraron cuentas disponibles', 'warning')
        }
    } catch (error) {
        console.error('Error loading available accounts in EditDialog:', error)
        showNotification('Error al cargar las cuentas disponibles', 'error')
        accounts.value = []
    } finally {
        loadingAccounts.value = false
    }
}


const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const loadTransferData = () => {
    if (props.transferData) {
        form.value = {
            from_account_id: props.transferData.from_account_id,
            to_account_id: props.transferData.to_account_id,
            amount: props.transferData.amount.toString(),
            transfer_date: props.transferData.transfer_date?.split('T')[0] || '',
            description: props.transferData.description || ''
        }
    }
}

const resetForm = () => {
    form.value = {
        from_account_id: null,
        to_account_id: null,
        amount: '',
        transfer_date: '',
        description: ''
    }
    if (formRef.value) {
        formRef.value.resetValidation()
    }
}

const closeDialog = () => {
    isVisible.value = false
    resetForm()
}

const handleSubmit = async () => {
    if (!formRef.value.validate()) return

    loading.value = true
    try {
        const resp = await $api(`transfers/${props.transferData.id}`, {
            method: 'PUT',
            body: {
                ...form.value,
                amount: parseFloat(form.value.amount)
            }
        })

        console.log('Transfer update response:', resp)
        console.log('Response status:', resp.status)
        console.log('Response data:', resp.data)
        console.log('Response keys:', Object.keys(resp))

        // Manejar diferentes formatos de respuesta exitosa
        // Considerar exitosa si: tiene status 200/201, tiene data, o no tiene error explícito
        const isSuccess = (resp.status === 200 || resp.status === 201) ||
            resp.data ||
            (!resp.error && !resp.message?.includes('error'))

        if (isSuccess) {
            showNotification('Transferencia actualizada exitosamente', 'success')

            // Emitir evento success con delay para asegurar que el componente padre lo procese
            setTimeout(() => {
                emit('success', resp.data || resp)
                closeDialog()
            }, 100)
        } else {
            console.warn('Unexpected response format:', resp)
            showNotification('Respuesta inesperada del servidor', 'warning')
        }
    } catch (error) {
        console.error('Error updating transfer:', error)
        const message = error.response?._data?.message || 'Error al actualizar la transferencia'
        showNotification(message, 'error')
    } finally {
        loading.value = false
    }
}

// Watch para cargar datos cuando cambia transferData
watch(() => props.transferData, (newData) => {
    if (newData && props.modelValue) {
        loadTransferData()
    }
}, { immediate: true })

// Watch para cargar cuentas cuando se abre el diálogo
watch(() => props.modelValue, (val) => {
    if (val) {
        loadAvailableAccounts()
    } else {
        resetForm()
    }
})
</script>

<style scoped>
.bg-blue-light {
    background-color: #e3f2fd;
    border: 1px solid #bbdefb;
}

.bg-green-light {
    background-color: #e8f5e9;
    border: 1px solid #c8e6c9;
}
</style>
