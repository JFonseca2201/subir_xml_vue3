<template>
    <VDialog v-model="isVisible" max-width="600" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-safe-2-line" size="42" color="success" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Apertura de Caja</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Iniciar nueva sesión de caja diaria
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Formulario -->
            <VCardText>
                <VForm ref="formRef" @submit.prevent="handleSubmit">
                    <VRow>
                        <!-- Saldo Inicial -->
                        <VCol cols="12">
                            <VTextField v-model="form.opening_balance" label="Saldo Inicial *"
                                prepend-inner-icon="ri-money-dollar-circle-line"
                                :rules="[rules.required, rules.positiveNumber]" type="number" step="0.01" min="0"
                                placeholder="0.00" variant="outlined" prefix="$" />
                        </VCol>

                        <!-- Información de la sesión -->
                        <VCol cols="12">
                            <VCard variant="outlined" class="bg-success-lighten-5">
                                <VCardText class="pa-3">
                                    <h5 class="text-h6 font-weight-bold mb-2 text-success">
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
                                        <div>
                                            <strong>Saldo Esperado:</strong> ${{ form.opening_balance || '0.00' }}
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
    opening_balance: 0
})

// Computed
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const isFormValid = computed(() => {
    return form.value.opening_balance > 0
})

// Rules
const rules = {
    required: value => !!value || 'Este campo es requerido',
    positiveNumber: value => value > 0 || 'El monto debe ser mayor a 0'
}

// Methods
const handleSubmit = async () => {
    if (!formRef.value?.validate()) return

    try {
        isLoading.value = true

        const response = await $api('cash-sessions/open', {
            method: 'POST',
            body: {
                user_id: currentUser.value?.id,
                opening_balance: parseFloat(form.value.opening_balance)
            }
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
        showNotification({
            title: 'Error',
            message: error.message || 'No se pudo abrir la caja',
            color: 'error',
            icon: 'ri-error-warning-line'
        })
    } finally {
        isLoading.value = false
    }
}

const closeDialog = () => {
    isVisible.value = false
}

const resetForm = () => {
    form.value = {
        opening_balance: 0
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
</style>
