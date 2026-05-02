<template>
    <VDialog v-model="isVisible" max-width="800" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-safe-2-fill" size="42" color="error" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Cierre de Caja</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Registrar conteo físico de billetes y monedas para cierre de caja
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Formulario -->
            <VCardText>
                <VForm ref="formRef" @submit.prevent="handleSubmit">
                    <VRow>
                        <!-- Fecha y Cuenta -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="form.operation_date" label="Fecha de Operación *"
                                prepend-inner-icon="ri-calendar-line" :rules="[rules.required]" type="date"
                                variant="outlined" />
                        </VCol>
                        <VCol cols="12" md="6">
                            <VSelect v-model="form.account_id" :items="accountOptions" item-title="label"
                                item-value="value" label="Cuenta *" prepend-inner-icon="ri-bank-line"
                                :rules="[rules.required]" placeholder="Seleccione la cuenta" variant="outlined" />
                        </VCol>

                        <!-- Billetes -->
                        <VCol cols="12">
                            <h5 class="text-h6 font-weight-bold mb-3 text-error">
                                <VIcon icon="ri-money-dollar-circle-line" class="me-2" />
                                Conteo de Billetes
                            </h5>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.bill_100_count" label="$100" type="number" min="0"
                                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(billTotals.bill_100) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.bill_50_count" label="$50" type="number" min="0"
                                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(billTotals.bill_50) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.bill_20_count" label="$20" type="number" min="0"
                                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(billTotals.bill_20) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.bill_10_count" label="$10" type="number" min="0"
                                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(billTotals.bill_10) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.bill_5_count" label="$5" type="number" min="0"
                                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(billTotals.bill_5) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.bill_1_count" label="$1" type="number" min="0"
                                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(billTotals.bill_1) }}
                            </div>
                        </VCol>

                        <!-- Monedas -->
                        <VCol cols="12">
                            <h5 class="text-h6 font-weight-bold mb-3 text-warning">
                                <VIcon icon="ri-coin-line" class="me-2" />
                                Conteo de Monedas
                            </h5>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.coin_1_count" label="$1.00" type="number" min="0"
                                prepend-inner-icon="ri-coin-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(coinTotals.coin_1) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.coin_50_count" label="$0.50" type="number" min="0"
                                prepend-inner-icon="ri-coin-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(coinTotals.coin_50) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.coin_25_count" label="$0.25" type="number" min="0"
                                prepend-inner-icon="ri-coin-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(coinTotals.coin_25) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.coin_10_count" label="$0.10" type="number" min="0"
                                prepend-inner-icon="ri-coin-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(coinTotals.coin_10) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.coin_5_count" label="$0.05" type="number" min="0"
                                prepend-inner-icon="ri-coin-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(coinTotals.coin_5) }}
                            </div>
                        </VCol>

                        <VCol cols="6" md="3">
                            <VTextField v-model.number="form.coin_1_cent_count" label="$0.01" type="number" min="0"
                                prepend-inner-icon="ri-coin-line" variant="outlined" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Total: ${{ formatCurrency(coinTotals.coin_1_cent) }}
                            </div>
                        </VCol>

                        <!-- Resumen -->
                        <VCol cols="12">
                            <VCard variant="outlined" class="pa-4 bg-grey-lighten-5">
                                <VCardText>
                                    <div class="d-flex justify-space-between align-center mb-2">
                                        <span class="font-weight-bold">Total Billetes:</span>
                                        <span class="text-h6">${{ formatCurrency(totalBills) }}</span>
                                    </div>
                                    <div class="d-flex justify-space-between align-center mb-2">
                                        <span class="font-weight-bold">Total Monedas:</span>
                                        <span class="text-h6">${{ formatCurrency(totalCoins) }}</span>
                                    </div>
                                    <VDivider class="my-2" />
                                    <div class="d-flex justify-space-between align-center">
                                        <span class="font-weight-bold text-error">Total Efectivo:</span>
                                        <span class="text-h5 text-error">${{ formatCurrency(totalCash) }}</span>
                                    </div>
                                </VCardText>
                            </VCard>
                        </VCol>

                        <!-- Ajuste de Saldos de Cuentas -->
                        <VCol cols="12">
                            <h5 class="text-h6 font-weight-bold mb-3 text-primary">
                                <VIcon icon="ri-bank-line" class="me-2" />
                                Ajuste de Saldos de Cuentas al Cierre
                            </h5>
                        </VCol>

                        <VCol cols="12" md="6">
                            <VTextField v-model.number="form.banco_pichincha_balance" label="Banco Pichincha (Caja)"
                                type="number" step="0.01" prepend-inner-icon="ri-bank-line" variant="outlined"
                                prefix="$" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Saldo final en Banco Pichincha
                            </div>
                        </VCol>

                        <VCol cols="12" md="6">
                            <VTextField v-model.number="form.banco_guayaquil_balance" label="Banco Guayaquil (Bancos)"
                                type="number" step="0.01" prepend-inner-icon="ri-bank-line" variant="outlined"
                                prefix="$" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Saldo final en Banco Guayaquil
                            </div>
                        </VCol>

                        <!-- Balance del Sistema -->
                        <VCol cols="12" v-if="systemBalance">
                            <VCard variant="outlined" class="pa-4" :class="balanceStatusClass">
                                <VCardText>
                                    <div class="d-flex justify-space-between align-center mb-2">
                                        <span class="font-weight-bold">Balance Sistema:</span>
                                        <span class="text-h6">${{ formatCurrency(systemBalance) }}</span>
                                    </div>
                                    <div class="d-flex justify-space-between align-center mb-2">
                                        <span class="font-weight-bold">Total Efectivo:</span>
                                        <span class="text-h6">${{ formatCurrency(totalCash) }}</span>
                                    </div>
                                    <div class="d-flex justify-space-between align-center mb-2">
                                        <span class="font-weight-bold">Total Bancos:</span>
                                        <span class="text-h6">${{ formatCurrency(totalBanks) }}</span>
                                    </div>
                                    <VDivider class="my-2" />
                                    <div class="d-flex justify-space-between align-center">
                                        <span class="font-weight-bold">Total General:</span>
                                        <span class="text-h5 text-primary">${{ formatCurrency(totalGeneral) }}</span>
                                    </div>
                                    <div class="mt-2">
                                        <VChip :color="balanceStatusColor" variant="tonal" size="small">
                                            {{ balanceStatusText }}
                                        </VChip>
                                    </div>
                                </VCardText>
                            </VCard>
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
                <VBtn color="error" variant="elevated" prepend-icon="ri-safe-2-fill" :loading="loading"
                    :disabled="!isFormValid" @click="handleSubmit">
                    Cerrar Caja
                </VBtn>
            </VCardActions>
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
    },
    systemBalance: {
        type: Number,
        default: null
    }
})

const emit = defineEmits(['update:modelValue', 'success'])

const { showNotification } = useGlobalToast()

// Estado
const formRef = ref()
const loading = ref(false)
const accounts = ref([])

const form = ref({
    operation_date: new Date().toISOString().split('T')[0],
    account_id: 1, // Caja chica por defecto
    bill_100_count: 0,
    bill_50_count: 0,
    bill_20_count: 0,
    bill_10_count: 0,
    bill_5_count: 0,
    bill_1_count: 0,
    coin_1_count: 0,
    coin_50_count: 0,
    coin_25_count: 0,
    coin_10_count: 0,
    coin_5_count: 0,
    coin_1_cent_count: 0,
    // Saldos de cuentas
    banco_pichincha_balance: 0,
    banco_guayaquil_balance: 0
})

// Computed
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const accountOptions = computed(() => {
    return accounts.value.map(account => ({
        label: getAccountDisplayName(account),
        value: account.id
    }))
})

// Totales por denominación
const billTotals = computed(() => ({
    bill_100: form.value.bill_100_count * 100,
    bill_50: form.value.bill_50_count * 50,
    bill_20: form.value.bill_20_count * 20,
    bill_10: form.value.bill_10_count * 10,
    bill_5: form.value.bill_5_count * 5,
    bill_1: form.value.bill_1_count * 1
}))

const coinTotals = computed(() => ({
    coin_1: form.value.coin_1_count * 1.00,
    coin_50: form.value.coin_50_count * 0.50,
    coin_25: form.value.coin_25_count * 0.25,
    coin_10: form.value.coin_10_count * 0.10,
    coin_5: form.value.coin_5_count * 0.05,
    coin_1_cent: form.value.coin_1_cent_count * 0.01
}))

const totalBills = computed(() => {
    return Object.values(billTotals.value).reduce((sum, total) => sum + total, 0)
})

const totalCoins = computed(() => {
    return Object.values(coinTotals.value).reduce((sum, total) => sum + total, 0)
})

const totalCash = computed(() => {
    return totalBills.value + totalCoins.value
})

const totalBanks = computed(() => {
    return (form.value.banco_pichincha_balance || 0) + (form.value.banco_guayaquil_balance || 0)
})

const totalGeneral = computed(() => {
    return totalCash.value + totalBanks.value
})

const difference = computed(() => {
    if (props.systemBalance === null) return 0
    return totalGeneral.value - props.systemBalance
})

// Status del balance
const balanceStatus = computed(() => {
    if (props.systemBalance === null) return 'unknown'
    const diff = Math.abs(difference.value)
    if (diff < 0.01) return 'balanced'
    return difference.value > 0 ? 'surplus' : 'shortage'
})

const balanceStatusText = computed(() => {
    switch (balanceStatus.value) {
        case 'balanced': return 'Balanceado'
        case 'surplus': return 'Sobrante'
        case 'shortage': return 'Faltante'
        default: return 'Desconocido'
    }
})

const balanceStatusColor = computed(() => {
    switch (balanceStatus.value) {
        case 'balanced': return 'success'
        case 'surplus': return 'warning'
        case 'shortage': return 'error'
        default: return 'grey'
    }
})

const balanceStatusClass = computed(() => {
    switch (balanceStatus.value) {
        case 'balanced': return 'bg-success-light'
        case 'surplus': return 'bg-warning-light'
        case 'shortage': return 'bg-error-light'
        default: return 'bg-grey-light'
    }
})

const differenceText = computed(() => {
    const diff = difference.value
    const sign = diff >= 0 ? '+' : ''
    return `${sign}$${formatCurrency(Math.abs(diff))}`
})

const differenceClass = computed(() => {
    switch (balanceStatus.value) {
        case 'balanced': return 'text-success'
        case 'surplus': return 'text-warning'
        case 'shortage': return 'text-error'
        default: return 'text-grey'
    }
})

const isFormValid = computed(() => {
    return form.value.operation_date && form.value.account_id && totalCash.value > 0
})

// Reglas de validación
const rules = {
    required: value => !!value || 'Este campo es requerido'
}

// Métodos
const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const loadAccounts = async () => {
    try {
        console.log('🔍 Cargando cuentas para cierre de caja...')
        const resp = await $api('transfer-accounts', { method: 'GET' })
        console.log('🔍 Accounts response:', resp)

        if (resp && Array.isArray(resp)) {
            accounts.value = resp
            console.log('✅ Cuentas cargadas desde API:', accounts.value)
        } else if (resp && resp.data && Array.isArray(resp.data)) {
            accounts.value = resp.data
            console.log('✅ Cuentas cargadas desde resp.data:', accounts.value)
        } else if (resp && resp.accounts && Array.isArray(resp.accounts)) {
            accounts.value = resp.accounts
            console.log('✅ Cuentas cargadas desde resp.accounts:', accounts.value)
        } else {
            console.log('⚠️ No se encontraron cuentas en API, usando cuentas por defecto')
            accounts.value = [
                { id: 1, name: 'Caja Chica', bank_name: null },
                { id: 2, name: 'Caja', bank_name: 'Banco Pichincha' },
                { id: 3, name: 'Bancos', bank_name: 'Banco Guayaquil' }
            ]
        }

        console.log('🔍 accountOptions después de cargar:', accountOptions.value)
    } catch (error) {
        console.error('❌ Error loading accounts:', error)
        // Cuentas por defecto
        accounts.value = [
            { id: 1, name: 'Caja Chica', bank_name: null },
            { id: 2, name: 'Caja', bank_name: 'Banco Pichincha' },
            { id: 3, name: 'Bancos', bank_name: 'Banco Guayaquil' }
        ]
        console.log('🔍 Usando cuentas por defecto:', accounts.value)
    }
}

const resetForm = () => {
    form.value = {
        operation_date: new Date().toISOString().split('T')[0],
        account_id: 1,
        bill_100_count: 0,
        bill_50_count: 0,
        bill_20_count: 0,
        bill_10_count: 0,
        bill_5_count: 0,
        bill_1_count: 0,
        coin_1_count: 0,
        coin_50_count: 0,
        coin_25_count: 0,
        coin_10_count: 0,
        coin_5_count: 0,
        coin_1_cent_count: 0,
        banco_pichincha_balance: 0,
        banco_guayaquil_balance: 0
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
        const user = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null

        const requestBody = {
            ...form.value,
            user_id: user?.id || null
        }

        console.log('📤 Enviando cierre de caja:', requestBody)

        const resp = await $api('cash-sessions/close', {
            method: 'POST',
            body: requestBody
        })

        console.log('✅ Respuesta cierre de caja:', resp)

        showNotification('Caja cerrada correctamente', 'success')
        emit('success', resp.denomination || resp)
        closeDialog()
    } catch (error) {
        console.error('❌ Error al cerrar caja:', error)
        const message = error.response?._data?.message || 'Error al cerrar la caja'
        showNotification(message, 'error')
    } finally {
        loading.value = false
    }
}

// Cargar cuentas al montar el componente
onMounted(() => {
    console.log('🔍 CashClosingDialog montado, cargando cuentas...')
    loadAccounts()
})

// Watch para cargar cuentas cuando se abre el diálogo
watch(() => props.modelValue, (val) => {
    if (val) {
        console.log('🔍 Diálogo de cierre abierto, verificando cuentas...')
        if (accounts.value.length === 0) {
            loadAccounts()
        }
    }
})
</script>

<style scoped>
.bg-grey-lighten-5 {
    background-color: #f5f5f5;
}

.bg-success-light {
    background-color: #e8f5e9;
    border: 1px solid #c8e6c9;
}

.bg-warning-light {
    background-color: #fff3e0;
    border: 1px solid #ffcc02;
}

.bg-error-light {
    background-color: #ffebee;
    border: 1px solid #ffcdd2;
}

.bg-grey-light {
    background-color: #f5f5f5;
    border: 1px solid #e0e0e0;
}
</style>
