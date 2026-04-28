<template>
    <VDialog v-model="isVisible" max-width="600" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-exchange-dollar-line" color="primary" />
                    <span class="text-h5 font-weight-bold">Transferir Fondos</span>
                </div>
                <VBtn icon variant="text" @click="isVisible = false">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VForm ref="formRef" @submit.prevent="transferFunds">
                <VRow>
                    <VCol cols="12" md="6">
                        <VSelect v-model="form.from_account_id" :items="availableAccounts" item-title="display_name"
                            item-value="id" label="Cuenta de Origen *" prepend-inner-icon="ri-bank-card-line"
                            :rules="[rules.required, rules.differentAccounts]" required
                            placeholder="Seleccione cuenta de origen" :disabled="loadingAccounts"
                            :loading="loadingAccounts">
                            <template #append-inner>
                                <VProgressCircular v-if="loadingAccounts" indeterminate size="16" width="2" />
                            </template>
                        </VSelect>
                        <div v-if="form.from_account_id && fromAccount" class="text-caption text-medium-emphasis mt-1">
                            <div class="d-flex align-center gap-1">
                                <VIcon icon="ri-bank-card-line" size="14" />
                                <span class="font-weight-medium">{{ getAccountDisplayName(fromAccount) }}</span>
                                <span>•••• {{ fromAccount.last_four }}</span>
                            </div>
                            <div class="text-info">Saldo disponible: ${{ formatCurrency(fromAccount.balance) }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="form.to_account_id" :items="availableAccounts" item-title="display_name"
                            item-value="id" label="Cuenta de Destino *" prepend-inner-icon="ri-bank-card-line"
                            :rules="[rules.required, rules.differentAccounts]" required
                            placeholder="Seleccione cuenta de destino" :disabled="loadingAccounts"
                            :loading="loadingAccounts">
                            <template #append-inner>
                                <VProgressCircular v-if="loadingAccounts" indeterminate size="16" width="2" />
                            </template>
                        </VSelect>
                        <div v-if="form.to_account_id && toAccount" class="text-caption text-medium-emphasis mt-1">
                            <div class="d-flex align-center gap-1">
                                <VIcon icon="ri-bank-card-line" size="14" />
                                <span class="font-weight-medium">{{ getAccountDisplayName(toAccount) }}</span>
                                <span>•••• {{ toAccount.last_four }}</span>
                            </div>
                            <div class="text-success">Saldo actual: ${{ formatCurrency(toAccount.balance) }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.amount" label="Monto a Transferir *" type="number"
                            prepend-inner-icon="ri-money-dollar-circle-line"
                            :rules="[rules.required, rules.sufficientFunds]" required placeholder="0.00" step="0.01">
                            <template #append-inner>
                                <span class="text-medium-emphasis">USD</span>
                            </template>
                        </VTextField>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.description" label="Descripción"
                            prepend-inner-icon="ri-file-text-line" placeholder="Motivo de la transferencia" rows="3"
                            auto-grow />
                    </VCol>
                </VRow>

                <VCardActions class="mt-4">
                    <VSpacer />
                    <VBtn variant="outlined" color="secondary" @click="isVisible = false">
                        Cancelar
                    </VBtn>
                    <VBtn color="primary" variant="elevated" type="submit" :loading="loading">
                        Transferir Fondos
                    </VBtn>
                </VCardActions>
            </VForm>
        </VCard>
    </VDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getAccountDisplayName } from '@/utils/helpers'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:modelValue', 'success'])

const { showNotification } = useGlobalToast()
const formRef = ref(null)
const loading = ref(false)

const form = ref({
    from_account_id: null,
    to_account_id: null,
    amount: 0,
    description: ''
})

// Cuentas bancarias
const availableAccounts = ref([])
const loadingAccounts = ref(false)

const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const fromAccount = computed(() => {
    return availableAccounts.value.find(account => account.id === form.value.from_account_id) || null
})

const toAccount = computed(() => {
    return availableAccounts.value.find(account => account.id === form.value.to_account_id) || null
})

const rules = {
    required: value => !!value || 'Este campo es requerido',
    differentAccounts: value => {
        return form.value.from_account_id !== form.value.to_account_id || 'Las cuentas deben ser diferentes'
    },
    sufficientFunds: value => {
        if (!value) return true
        const num = parseFloat(value)
        if (isNaN(num)) return 'El monto debe ser un número válido'
        if (num <= 0) return 'El monto debe ser mayor a 0'

        if (fromAccount.value && num > parseFloat(fromAccount.value.balance)) {
            return `Fondos insuficientes. Saldo disponible: $${formatCurrency(fromAccount.value.balance)}`
        }

        return true
    }
}

const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const loadAccounts = async () => {
    loadingAccounts.value = true
    try {
        const resp = await $api('accounts', { method: 'GET' })
        if (resp.status === 200) {
            availableAccounts.value = resp.data.map(account => ({
                ...account,
                display_name: `${getAccountDisplayName(account)} •••• ${account.last_four} - Saldo: $${formatCurrency(account.balance || 0)}`
            }))
        }
    } catch (error) {
        console.error('Error loading accounts:', error)
        availableAccounts.value = []
    } finally {
        loadingAccounts.value = false
    }
}

const resetForm = () => {
    form.value = {
        from_account_id: null,
        to_account_id: null,
        amount: 0,
        description: ''
    }
    if (formRef.value) {
        formRef.value.resetValidation()
    }
}

const transferFunds = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return

    loading.value = true
    try {
        const resp = await $api('account-transfers', {
            method: 'POST',
            body: form.value
        })

        if (resp.status >= 200 && resp.status < 300) {
            showNotification('Transferencia realizada exitosamente', 'success')
            emit('success', resp.data)
            isVisible.value = false
            resetForm()
        }
    } catch (error) {
        console.error('Error al realizar transferencia:', error)
        showNotification('Error al realizar la transferencia', 'error')
    } finally {
        loading.value = false
    }
}

watch(() => props.modelValue, (val) => {
    if (val) {
        loadAccounts()
    } else {
        resetForm()
    }
})
</script>
