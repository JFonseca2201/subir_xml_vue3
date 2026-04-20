<template>
    <VDialog v-model="isVisible" max-width="600" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-exchange-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Nueva Transferencia</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Mover dinero entre cuentas bancarias
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Formulario -->
            <VCardText>
                <VForm ref="formRef" @submit.prevent="handleSubmit">
                    <VRow>
                        <!-- Cuenta Origen -->
                        <VCol cols="12">
                            <VSelect v-model="form.from_account_id" :items="accountOptions" item-title="label"
                                item-value="value" label="Cuenta Origen *" prepend-inner-icon="ri-bank-line"
                                :rules="[rules.required]" placeholder="Seleccione la cuenta de origen"
                                variant="outlined" />

                            <!-- Información de cuenta origen -->
                            <div v-if="fromAccount" class="mt-2 pa-3 bg-blue-light rounded">
                                <div class="d-flex align-center justify-space-between">
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Saldo disponible</div>
                                        <div class="text-h6 font-weight-bold text-primary">
                                            ${{ formatCurrency(fromAccount.current_balance) }}
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-caption text-medium-emphasis">Banco</div>
                                        <div class="font-weight-medium">{{ fromAccount.bank_name }}</div>
                                    </div>
                                </div>
                            </div>
                        </VCol>

                        <!-- Cuenta Destino -->
                        <VCol cols="12">
                            <VSelect v-model="form.to_account_id" :items="filteredAccountOptions" item-title="label"
                                item-value="value" label="Cuenta Destino *" prepend-inner-icon="ri-bank-card-line"
                                :rules="[rules.required, rules.differentAccount]"
                                placeholder="Seleccione la cuenta de destino" variant="outlined" />

                            <!-- Información de cuenta destino -->
                            <div v-if="toAccount" class="mt-2 pa-3 bg-green-light rounded">
                                <div class="d-flex align-center justify-space-between">
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Banco</div>
                                        <div class="font-weight-medium text-success">{{ toAccount.bank_name }}</div>
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
                            <VTextField v-model="form.amount" label="Monto a Transferir *"
                                prepend-inner-icon="ri-money-dollar-circle-line"
                                :rules="[rules.required, rules.positive, rules.sufficientBalance]" placeholder="0.00"
                                type="number" step="0.01" min="0.01" variant="outlined" />

                            <!-- Validación visual -->
                            <div v-if="form.amount && fromAccount" class="mt-2">
                                <div v-if="parseFloat(form.amount) > parseFloat(fromAccount.current_balance)"
                                    class="text-caption text-error d-flex align-center">
                                    <VIcon icon="ri-error-warning-line" size="16" class="mr-1" />
                                    Saldo insuficiente. Disponible: ${{ formatCurrency(fromAccount.current_balance) }}
                                </div>
                                <div v-else class="text-caption text-success d-flex align-center">
                                    <VIcon icon="ri-checkbox-circle-line" size="16" class="mr-1" />
                                    Transferencia válida
                                </div>
                            </div>
                        </VCol>

                        <!-- Fecha -->
                        <VCol cols="12">
                            <VTextField v-model="form.transfer_date" label="Fecha de Transferencia *"
                                prepend-inner-icon="ri-calendar-line" :rules="[rules.required]" type="date"
                                variant="outlined" />
                        </VCol>

                        <!-- Descripción -->
                        <VCol cols="12">
                            <VTextarea v-model="form.description" label="Descripción (Opcional)"
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
                <VBtn color="primary" variant="elevated" prepend-icon="ri-exchange-line" :loading="loading"
                    :disabled="!isFormValid" @click="handleSubmit">
                    Realizar Transferencia
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
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
    transfer_date: new Date().toISOString().split('T')[0],
    description: ''
})

// Computed
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const accountOptions = computed(() => {
    return accounts.value.map(account => ({
        label: `${getAccountDisplayName(account.bank_name, account.name)} (${account.last_four || account.account_number?.slice(-4) || '****'}) - Saldo: $${formatCurrency(account.current_balance)}`,
        value: account.id,
        account: account
    }))
})

const filteredAccountOptions = computed(() => {
    return accountOptions.value.filter(option => option.value !== form.value.from_account_id)
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
        (!fromAccount.value || parseFloat(form.value.amount) <= parseFloat(fromAccount.value.current_balance)) &&
        form.value.transfer_date
})

// Reglas de validación
const rules = {
    required: value => !!value || 'Este campo es requerido',
    positive: value => parseFloat(value) > 0 || 'El monto debe ser mayor a 0',
    differentAccount: value => value !== form.value.from_account_id || 'La cuenta destino debe ser diferente a la origen',
    sufficientBalance: value => {
        if (!fromAccount.value) return true
        return parseFloat(value) <= parseFloat(fromAccount.value.current_balance) || 'Saldo insuficiente'
    }
}

// Métodos
const loadAvailableAccounts = async () => {
    loadingAccounts.value = true
    try {
        const resp = await $api('available-accounts', { method: 'GET' })
        console.log('Raw API response from available-accounts (AddDialog):', resp)

        // Usar el formato correcto: resp.accounts
        let accountsData = []
        if (resp && resp.accounts && Array.isArray(resp.accounts)) {
            accountsData = resp.accounts
        } else if (resp && resp.data && Array.isArray(resp.data)) {
            accountsData = resp.data
        } else if (resp && Array.isArray(resp)) {
            accountsData = resp
        } else {
            console.warn('Unexpected response format in AddDialog:', resp)
        }

        accounts.value = accountsData
        console.log('Processed accounts data in AddDialog:', accounts.value)

        if (accounts.value.length === 0) {
            console.warn('No accounts found in AddDialog response')
            showNotification('No se encontraron cuentas disponibles', 'warning')
        }
    } catch (error) {
        console.error('Error loading available accounts in AddDialog:', error)
        showNotification('Error al cargar las cuentas disponibles', 'error')
        accounts.value = []
    } finally {
        loadingAccounts.value = false
    }
}

// Función para personalizar nombres de cuentas
const getAccountDisplayName = (bankName, accountName) => {
    const name = bankName || accountName || ''

    // Si el nombre está vacío o es nulo, intentar detectar por otros campos
    if (!name || name.trim() === '') {
        return 'CAJA CHICA' // Por defecto para cuentas sin nombre
    }

    // Mapeo de nombres personalizados
    const nameMap = {
        'caja chica': 'CAJA CHICA',
        'cajachica': 'CAJA CHICA',
        'caja_chica': 'CAJA CHICA',
        'small box': 'CAJA CHICA',
        'petty cash': 'CAJA CHICA',
        'caja': 'CAJA',
        'cash': 'CAJA',
        'banco pichincha': 'CAJA',
        'pichincha': 'CAJA',
        'banco guayaquil': 'BANCOS',
        'guayaquil': 'BANCOS',
        'bank': 'BANCOS',
        'bancos': 'BANCOS'
    }

    // Buscar coincidencia (ignorando mayúsculas/minúsculas)
    const lowerName = name.toLowerCase().trim()
    for (const [key, value] of Object.entries(nameMap)) {
        if (lowerName.includes(key)) {
            return value
        }
    }

    // Si no hay coincidencia, usar el nombre original en mayúsculas
    return name.toUpperCase() || 'CUENTA'
}

const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const resetForm = () => {
    form.value = {
        from_account_id: null,
        to_account_id: null,
        amount: '',
        transfer_date: new Date().toISOString().split('T')[0],
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
        const resp = await $api('transfers', {
            method: 'POST',
            body: {
                ...form.value,
                amount: parseFloat(form.value.amount)
            }
        })

        console.log('Transfer creation response:', resp)

        // Si la petición se completó sin error, considerarla exitosa
        showNotification('Transferencia realizada exitosamente', 'success')

        // Emitir evento success y cerrar diálogo inmediatamente
        emit('success', resp.data || resp)
        closeDialog()
    } catch (error) {
        console.error('Error creating transfer:', error)
        const message = error.response?._data?.message || 'Error al realizar la transferencia'
        showNotification(message, 'error')
    } finally {
        loading.value = false
    }
}

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

.text-error {
    color: #f44336;
}

.text-success {
    color: #4caf50;
}
</style>
