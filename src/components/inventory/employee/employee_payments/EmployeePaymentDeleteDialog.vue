<template>
    <VDialog v-model="isVisible" max-width="450" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center gap-3 mb-4">
                <VAvatar color="error" variant="tonal" size="48">
                    <VIcon icon="ri-delete-bin-line" size="24" />
                </VAvatar>
                <div>
                    <h4 class="text-h6 font-weight-bold mb-1">Confirmar Eliminación</h4>
                    <p class="text-body-2 text-medium-emphasis mb-0">
                        ¿Está seguro de eliminar este pago?
                    </p>
                </div>
            </VCardTitle>

            <VCardText class="pa-0" v-if="paymentToDelete">
                <VAlert type="warning" variant="tonal" class="mb-4">
                    <div class="d-flex align-center gap-2">
                        <VIcon icon="ri-alert-line" />
                        <span>
                            Está a punto de eliminar el pago de <strong>{{ paymentToDelete.employee?.full_name || paymentToDelete.employee?.name }}</strong>
                        </span>
                    </div>
                </VAlert>

                <VCard variant="outlined" class="pa-4 bg-grey-lighten-5">
                    <div class="d-flex flex-column gap-3">
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Empleado:</span>
                            <span class="font-weight-medium">{{ paymentToDelete.employee?.full_name || `${paymentToDelete.employee?.name} ${paymentToDelete.employee?.surname || ''}` }}</span>
                        </div>
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Monto:</span>
                            <span class="font-weight-bold text-success">${{ parseFloat(paymentToDelete.amount || 0).toFixed(2) }}</span>
                        </div>
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Fecha:</span>
                            <span class="font-weight-medium">{{ formatDate(paymentToDelete.payment_date) }}</span>
                        </div>
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Tipo de Pago:</span>
                            <VChip 
                                :color="getPaymentTypeColor(paymentToDelete.payment_type)" 
                                size="small" 
                                variant="tonal"
                            >
                                {{ getPaymentTypeText(paymentToDelete.payment_type) }}
                            </VChip>
                        </div>
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Estado:</span>
                            <VChip 
                                :color="getStateColor(paymentToDelete.state)" 
                                size="small" 
                                variant="tonal"
                            >
                                {{ getStateText(paymentToDelete.state) }}
                            </VChip>
                        </div>
                        <div v-if="paymentToDelete.concept" class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Concepto:</span>
                            <span class="font-weight-medium text-truncate" style="max-width: 200px;">{{ paymentToDelete.concept }}</span>
                        </div>
                    </div>
                </VCard>

                <div class="text-center mt-4">
                    <p class="text-body-2 mb-0 text-error-darken-1">
                        <VIcon icon="ri-information-line" class="me-1" />
                        Esta acción no se puede deshacer. Todos los datos asociados se perderán permanentemente.
                    </p>
                </div>
            </VCardText>

            <VCardActions class="mt-6">
                <VSpacer />
                <VBtn variant="outlined" color="secondary" @click="closeDialog" :disabled="loading">
                    Cancelar
                </VBtn>
                <VBtn 
                    color="error" 
                    variant="elevated" 
                    @click="confirmDelete" 
                    :loading="loading"
                    :disabled="loading"
                >
                    <VIcon start icon="ri-delete-bin-line" />
                    Eliminar Pago
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    paymentData: {
        type: Object,
        default: null
    }
})

const emit = defineEmits(['update:modelValue', 'success'])

const { showNotification } = useGlobalToast()
const loading = ref(false)

// Computed properties
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const paymentToDelete = computed(() => props.paymentData)

// Métodos
const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    } catch (error) {
        return dateString
    }
}

const getPaymentTypeText = (type) => {
    const types = {
        cash: 'Efectivo',
        transfer: 'Transferencia',
        check: 'Cheque'
    }
    return types[type] || 'Desconocido'
}

const getPaymentTypeColor = (type) => {
    const colors = {
        cash: 'success',
        transfer: 'primary',
        check: 'info'
    }
    return colors[type] || 'grey'
}

const getStateText = (state) => {
    const states = {
        1: 'Activo',
        2: 'Inactivo'
    }
    return states[state] || 'Desconocido'
}

const getStateColor = (state) => {
    const colors = {
        1: 'success',
        2: 'error'
    }
    return colors[state] || 'grey'
}

const closeDialog = () => {
    if (!loading.value) {
        isVisible.value = false
    }
}

const confirmDelete = async () => {
    if (!paymentToDelete.value) return

    loading.value = true
    try {
        const resp = await $api(`employee-payments/${paymentToDelete.value.id}`, {
            method: 'DELETE',
            onResponseError({ response }) {
                console.error('Error al eliminar pago:', response._data?.error || response._data?.message)
                const errorMessage = response._data?.message || 'Error al eliminar el pago'
                showNotification(errorMessage, 'error')
            }
        })

        if (resp.status === 200) {
            showNotification('Pago eliminado exitosamente', 'success')
            emit('success')
            closeDialog()
        }
    } catch (error) {
        console.error('Error al eliminar pago:', error)
        showNotification('Error al eliminar el pago', 'error')
    } finally {
        loading.value = false
    }
}
</script>
