<template>
    <VDialog v-model="isVisible" max-width="600" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-hand-coin-line" color="success" />
                    <span class="text-h5 font-weight-bold">Nuevo Aporte de Socio</span>
                </div>
                <VBtn icon variant="text" @click="isVisible = false">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VForm ref="formRef" @submit.prevent="saveContribution">
                <VRow>
                    <VCol cols="12">
                        <VSelect v-model="form.partner_id" :items="partnerOptions" item-title="full_name"
                            item-value="id" label="Socio *" prepend-inner-icon="ri-user-line" :rules="[rules.required]"
                            required placeholder="Seleccione un socio" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.amount" label="Monto del Aporte *" type="number"
                            prepend-inner-icon="ri-money-dollar-circle-line" :rules="[rules.required, rules.minAmount]"
                            required placeholder="0.00" step="0.01">
                            <template #append-inner>
                                <span class="text-medium-emphasis">USD</span>
                            </template>
                        </VTextField>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.contribution_date" label="Fecha del Aporte *" type="date"
                            prepend-inner-icon="ri-calendar-line" :rules="[rules.required]" required />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="form.account_id" :items="availableAccounts" item-title="display_name"
                            item-value="id" label="Cuenta de Destino *" prepend-inner-icon="ri-bank-card-line"
                            :rules="[rules.required]" required placeholder="Seleccione cuenta bancaria"
                            :disabled="loadingAccounts" :loading="loadingAccounts">
                            <template #append-inner>
                                <VProgressCircular v-if="loadingAccounts" indeterminate size="16" width="2" />
                            </template>
                        </VSelect>
                        <div v-if="form.account_id && selectedAccount" class="text-caption text-medium-emphasis mt-1">
                            <div class="d-flex align-center gap-1">
                                <VIcon icon="ri-bank-card-line" size="14" />
                                <span class="font-weight-medium">{{ selectedAccountName }}</span>
                                <span>•••• {{ selectedAccount.last_four }}</span>
                            </div>
                            <div class="text-success">Saldo disponible: ${{ formatCurrency(selectedAccount.balance) }}
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12">
                        <VTextarea v-model="form.notes" label="Notas" prepend-inner-icon="ri-file-text-line"
                            placeholder="Notas adicionales sobre el aporte" rows="3" auto-grow />
                    </VCol>
                </VRow>

                <VCardActions class="mt-4">
                    <VSpacer />
                    <VBtn variant="outlined" color="secondary" @click="isVisible = false">
                        Cancelar
                    </VBtn>
                    <VBtn color="success" variant="elevated" type="submit" :loading="loading">
                        Registrar Aporte
                    </VBtn>
                </VCardActions>
            </VForm>
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
    },
    partners: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['update:modelValue', 'success'])

const { showNotification } = useGlobalToast()
const formRef = ref(null)
const loading = ref(false)

const form = ref({
    partner_id: null,
    amount: 0,
    contribution_date: new Date().toISOString().substr(0, 10),
    notes: '',
    account_id: 3 // ID 3 (Banco Guayaquil) por defecto
})

const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const partnerOptions = computed(() => {
    if (!props.partners || !Array.isArray(props.partners)) return []
    return props.partners.map(partner => ({
        ...partner,
        full_name: `${partner?.name || ''} ${partner?.surname || ''}`.trim()
    }))
})

// Cuentas bancarias
const availableAccounts = ref([])
const loadingAccounts = ref(false)

const loadAccounts = async () => {
    loadingAccounts.value = true
    try {
        const resp = await $api('accounts', { method: 'GET' })
        if (resp.status === 200) {
            availableAccounts.value = resp.data.map(account => ({
                ...account,
                display_name: `${account.bank_name} ••••• ${account.last_four} - Saldo: $${formatCurrency(account.balance || 0)}`
            }))
        }
    } catch (error) {
        console.error('Error loading accounts:', error)
        availableAccounts.value = []
    } finally {
        loadingAccounts.value = false
    }
}

const selectedAccount = computed(() => {
    return availableAccounts.value.find(account => account.id === form.value.account_id) || null
})

// Computed para mostrar el nombre del banco correctamente
const selectedAccountName = computed(() => {
    if (!selectedAccount.value) return ''
    return selectedAccount.value.bank_name || 'Banco Guayaquil'
})

const rules = {
    required: value => !!value || 'Este campo es requerido',
    minAmount: value => {
        if (!value) return true
        const num = parseFloat(value)
        if (isNaN(num)) return 'El monto debe ser un número válido'
        if (num <= 0) return 'El monto debe ser mayor a 0'
        return true
    }
}

const resetForm = () => {
    form.value = {
        partner_id: null,
        amount: 0,
        contribution_date: new Date().toISOString().substr(0, 10),
        notes: ''
    }
    if (formRef.value) {
        formRef.value.resetValidation()
    }
}

const saveContribution = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return

    loading.value = true
    try {
        const resp = await $api('contributions', {
            method: 'POST',
            body: form.value
        })

        if (resp.status >= 200 && resp.status < 300) {
            showNotification('Aporte registrado exitosamente', 'success')
            emit('success', resp.data)
            isVisible.value = false
            resetForm()
        }
    } catch (error) {
        console.error('Error al registrar aporte:', error)
        showNotification('Error al registrar el aporte', 'error')
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
