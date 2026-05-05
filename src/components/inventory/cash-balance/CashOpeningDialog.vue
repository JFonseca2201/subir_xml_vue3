<template>
    <VDialog v-model="isVisible" max-width="900" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-safe-2-line" size="42" color="success" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Apertura de Caja</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Iniciar nueva sesión de caja diaria con conteo de billetes y ajuste de saldos
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Formulario -->
            <VCardText>
                <VForm ref="formRef" @submit.prevent="handleSubmit">
                    <VRow>
                        <!-- Saldo Inicial Calculado -->
                        <VCol cols="12">
                            <VCard variant="outlined" class="bg-success-lighten-5 mb-4">
                                <VCardText class="pa-3">
                                    <h5 class="text-h6 font-weight-bold mb-2 text-success">
                                        <VIcon icon="ri-calculator-line" class="me-2" />
                                        Saldo Inicial Calculado
                                    </h5>
                                    <div class="d-flex justify-space-between align-center">
                                        <span class="text-body-2">Total de billetes y monedas:</span>
                                        <span class="text-h5 font-weight-bold text-success">
                                            ${{ formatCurrency(totalCash) }}
                                        </span>
                                    </div>
                                </VCardText>
                            </VCard>
                        </VCol>

                        <!-- Billetes -->
                        <VCol cols="12">
                            <h5 class="text-h6 font-weight-bold mb-3 text-success">
                                <VIcon icon="ri-money-dollar-circle-line" class="me-2" />
                                Conteo de Billetes (Caja Chica)
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
                                Conteo de Monedas (Caja Chica)
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

                        <!-- Ajuste de Saldos de Cuentas -->
                        <VCol cols="12">
                            <h5 class="text-h6 font-weight-bold mb-3 text-primary">
                                <VIcon icon="ri-bank-line" class="me-2" />
                                Ajuste de Saldos de Cuentas
                            </h5>
                        </VCol>

                        <VCol cols="12" md="6">
                            <VTextField v-model.number="form.banco_pichincha_balance" label="Banco Pichincha (Caja)"
                                type="number" step="0.01" prepend-inner-icon="ri-bank-line" variant="outlined"
                                prefix="$" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Saldo actual en Banco Pichincha
                            </div>
                        </VCol>

                        <VCol cols="12" md="6">
                            <VTextField v-model.number="form.banco_guayaquil_balance" label="Banco Guayaquil (Bancos)"
                                type="number" step="0.01" prepend-inner-icon="ri-bank-line" variant="outlined"
                                prefix="$" />
                            <div class="text-caption text-medium-emphasis mt-1">
                                Saldo actual en Banco Guayaquil
                            </div>
                        </VCol>

                        <!-- Información de la sesión -->
                        <VCol cols="12">
                            <VCard variant="outlined" class="bg-info-lighten-5">
                                <VCardText class="pa-3">
                                    <h5 class="text-h6 font-weight-bold mb-2 text-info">
                                        <VIcon icon="ri-information-line" class="me-2" />
                                        Información de la Sesión
                                    </h5>
                                    <div class="text-body-2">
                                        <div class="mb-1">
                                            <strong>Usuario:</strong> {{ currentUser?.name || 'Usuario actual' }}
                                        </div>
                                        <div class="mb-1">
                                            <strong>Fecha:</strong> {{ sessionDate || new
                                                Date().toLocaleDateString('es-ES') }}
                                        </div>
                                        <div class="mb-1">
                                            <strong>Efectivo en Caja Chica:</strong> ${{ formatCurrency(totalCash) }}
                                        </div>
                                        <div>
                                            <strong>Saldo Total Apertura:</strong> ${{
                                                formatCurrency(totalOpeningBalance) }}
                                        </div>
                                    </div>
                                </VCardText>
                            </VCard>
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>

            <!-- Actions -->
            <VCardActions class="px-6 pb-6">
                <VBtn variant="outlined" color="secondary" @click="closeDialog" :disabled="isLoading">
                    Cancelar
                </VBtn>
                <VSpacer />
                <VBtn color="success" variant="elevated" @click="handleSubmit" :loading="isLoading"
                    :disabled="!isFormValid">
                    <VIcon icon="ri-check-line" class="me-2" />
                    Abrir Caja
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

const props = defineProps({
    modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'success'])

// Reactive data
const formRef = ref()
const isLoading = ref(false)
const sessionDate = ref('')
const currentUser = computed(() => {
    const userStr = localStorage.getItem("user")
    return userStr ? JSON.parse(userStr) : null
})

const form = ref({
    // Billetes
    bill_100_count: 0,
    bill_50_count: 0,
    bill_20_count: 0,
    bill_10_count: 0,
    bill_5_count: 0,
    bill_1_count: 0,
    // Monedas
    coin_1_count: 0,
    coin_50_count: 0,
    coin_25_count: 0,
    coin_10_count: 0,
    // Saldos de cuentas
    banco_pichincha_balance: 0,
    banco_guayaquil_balance: 0
})

// Computed
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
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
    coin_10: form.value.coin_10_count * 0.10
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

const totalOpeningBalance = computed(() => {
    return totalCash.value +
        (form.value.banco_pichincha_balance || 0) +
        (form.value.banco_guayaquil_balance || 0)
})

const isFormValid = computed(() => {
    return totalCash.value > 0 ||
        (form.value.banco_pichincha_balance || 0) > 0 ||
        (form.value.banco_guayaquil_balance || 0) > 0
})

// Rules
const rules = {
    required: value => !!value || 'Este campo es requerido',
    positiveNumber: value => value >= 0 || 'El monto debe ser mayor o igual a 0'
}

// Methods
const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const handleSubmit = async () => {
    if (!formRef.value?.validate()) return

    try {
        isLoading.value = true

        // Backend solo acepta user_id y opening_balance
        const requestBody = {
            user_id: currentUser.value?.id,
            opening_balance: totalOpeningBalance.value
        }

        console.log('📤 Enviando apertura de caja:', requestBody)

        const response = await $api('cash-sessions/open', {
            method: 'POST',
            body: requestBody
        })

        console.log('✅ Caja abierta:', response)

        // Update session date from backend response
        if (response.session?.formatted_date) {
            sessionDate.value = response.session.formatted_date
        }

        showNotification({
            title: 'Caja Abierta',
            message: 'Sesión de caja iniciada correctamente',
            color: 'success',
            icon: 'ri-check-line'
        })

        emit('success', response.session)
        closeDialog()
        resetForm()

    } catch (error) {
        console.error('❌ Error al abrir caja:', error)
        let errorMessage = 'No se pudo abrir la caja'

        if (error.response?._data?.message) {
            errorMessage = error.response._data.message
        } else if (error.message) {
            errorMessage = error.message
        }

        // Manejar específicamente el error de sesión ya abierta
        if (error.response?.status === 422 && errorMessage.includes('sesión abierta')) {
            showNotification({
                title: 'Sesión Ya Abierta',
                message: 'Ya existe una sesión de caja abierta. Por favor, ciérrela primero antes de abrir una nueva.',
                color: 'warning',
                icon: 'ri-alert-line'
            })
        } else if (error.response?.status === 422) {
            showNotification({
                title: 'Error de Validación',
                message: errorMessage || 'Los datos proporcionados no son válidos',
                color: 'warning',
                icon: 'ri-alert-line'
            })
        } else {
            showNotification({
                title: 'Error',
                message: errorMessage,
                color: 'error',
                icon: 'ri-error-warning-line'
            })
        }
    } finally {
        isLoading.value = false
    }
}

const closeDialog = () => {
    isVisible.value = false
}

const resetForm = () => {
    form.value = {
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
        banco_pichincha_balance: 0,
        banco_guayaquil_balance: 0
    }
    sessionDate.value = ''
    if (formRef.value) {
        formRef.value.resetValidation()
    }
}

// Watchers
watch(() => props.modelValue, (val) => {
    if (val) {
        resetForm()
    }
})

// Lifecycle
onMounted(() => {
    console.log('🔍 CashOpeningDialog montado')
})
</script>

<style scoped>
.text-success {
    color: #4caf50 !important;
}

.bg-success-lighten-5 {
    background-color: rgba(76, 175, 80, 0.05) !important;
}

.bg-info-lighten-5 {
    background-color: rgba(33, 150, 243, 0.05) !important;
}

.text-info {
    color: #2196f3 !important;
}
</style>
