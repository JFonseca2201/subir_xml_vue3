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
                            required />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.amount" label="Monto *" type="number"
                            prepend-inner-icon="ri-money-dollar-circle-line"
                            :rules="[rules.required, rules.minAmount]" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.contribution_date" label="Fecha *" type="date"
                            :rules="[rules.required]" />
                    </VCol>

                    <VCol cols="12" md="12">
                        <VSelect v-model="form.account_id" :items="accountOptions" item-title="label" item-value="id"
                            label="Cuenta de Destino *" prepend-inner-icon="ri-bank-card-line" :rules="[rules.required]"
                            :loading="loadingAccounts" persistent-placeholder>
                            <template #selection="{ item }">
                                {{ item.raw.label }}
                            </template>

                            <template #item="{ props, item }">
                                <VListItem v-bind="props" :title="item.raw.label"
                                    :subtitle="item.raw.id === 3 ? 'Cuenta principal' : `Saldo: $${formatCurrency(item.raw.balance)}`" />
                            </template>
                        </VSelect>

                        <div v-if="selectedAccount" class="text-caption text-medium-emphasis mt-1">
                            <div class="d-flex align-center gap-1">
                                <VIcon icon="ri-bank-card-line" size="14" />
                                <span class="font-weight-bold text-primary">{{ getAccountDisplayName(selectedAccount)
                                    }}</span>
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12">
                        <VTextarea v-model="form.notes" label="Notas" rows="3" auto-grow />
                    </VCol>
                </VRow>

                <VCardActions class="mt-4">
                    <VSpacer />
                    <VBtn variant="outlined" color="secondary" @click="isVisible = false">Cancelar</VBtn>
                    <VBtn color="success" variant="elevated" type="submit" :loading="loading">Registrar Aporte</VBtn>
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
    modelValue: { type: Boolean, default: false },
    partners: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'success'])
const { showNotification } = useGlobalToast()
const formRef = ref(null)
const loading = ref(false)

// 1. IMPORTANTE: Inicializamos con el objeto del Banco de Guayaquil ya cargado
const availableAccounts = ref([
    { id: 3, name: 'BANCO DE GUAYAQUIL', last_four: '0000', balance: 0 }
])
const loadingAccounts = ref(false)

const accountOptions = computed(() => {
    return availableAccounts.value.map(account => ({
        ...account,
        label: getAccountDisplayName(account)
    }))
})

const form = ref({
    partner_id: null,
    amount: 0,
    contribution_date: new Date().toISOString().substr(0, 10),
    notes: '',
    account_id: 3
})

const isVisible = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v)
})

const partnerOptions = computed(() => {
    return (props.partners || []).map(p => ({
        ...p,
        full_name: `${p?.name || ''} ${p?.surname || ''}`.trim()
    }))
})

const formatCurrency = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })

const loadAccounts = async () => {
    loadingAccounts.value = true
    try {
        const resp = await $api('accounts', { method: 'GET' })
        if (resp.status === 200) {
            // 2. Al recibir datos, nos aseguramos de que el ID 3 siempre tenga el nombre correcto
            availableAccounts.value = resp.data.map(acc => ({
                ...acc,
                bank_name: acc.id === 3 ? 'BANCO DE GUAYAQUIL' : (acc.bank_name || 'Cuenta')
            }))
        }
    } catch (e) {
        console.error("Error al cargar cuentas", e)
    } finally {
        loadingAccounts.value = false
    }
}

const selectedAccount = computed(() => {
    return availableAccounts.value.find(a => a.id === form.value.account_id) || null
})

const rules = {
    required: v => !!v || 'Requerido',
    minAmount: v => parseFloat(v) > 0 || 'Monto mayor a 0'
}

const resetForm = () => {
    form.value = {
        partner_id: null,
        amount: 0,
        contribution_date: new Date().toISOString().substr(0, 10),
        notes: '',
        account_id: 3
    }
}

const saveContribution = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return
    loading.value = true
    try {
        const resp = await $api('contributions', { method: 'POST', body: form.value })
        if (resp.status >= 200 && resp.status < 300) {
            showNotification('Aporte registrado', 'success')
            emit('update:modelValue', false)
            emit('success', resp.data)
            resetForm()
        }
    } catch (e) {
        showNotification('Error', 'error')
    } finally {
        loading.value = false
    }
}

// Cargar cuentas al montar el componente para tenerlas listas
onMounted(() => {
    loadAccounts()
})

watch(() => props.modelValue, (val) => {
    if (val) loadAccounts()
    else resetForm()
})
</script>