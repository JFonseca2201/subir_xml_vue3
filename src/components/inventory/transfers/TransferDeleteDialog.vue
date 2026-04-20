<template>
    <VDialog v-model="isVisible" max-width="500" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VAvatar size="64" color="error" variant="tonal" class="mb-3">
                    <VIcon icon="ri-delete-bin-line" size="32" />
                </VAvatar>
                <h4 class="text-h4 font-weight-bold mb-1">Eliminar Transferencia</h4>
                <p class="text-body-2 text-medium-emphasis">
                    ¿Está seguro de eliminar esta transferencia?
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Información de la transferencia -->
            <VCardText v-if="transferData">
                <VCard variant="outlined" class="pa-4">
                    <div class="d-flex align-center mb-3">
                        <VIcon icon="ri-exchange-line" color="primary" class="mr-2" />
                        <span class="font-weight-bold">Detalles de la Transferencia</span>
                    </div>

                    <VRow>
                        <VCol cols="12">
                            <div class="d-flex align-center justify-space-between mb-2">
                                <span class="text-medium-emphasis">Cuenta Origen:</span>
                                <span class="font-weight-medium">{{ transferData.from_account?.bank_name }}</span>
                            </div>
                            <div class="d-flex align-center justify-space-between mb-2">
                                <span class="text-medium-emphasis">Cuenta Destino:</span>
                                <span class="font-weight-medium">{{ transferData.to_account?.bank_name }}</span>
                            </div>
                            <div class="d-flex align-center justify-space-between mb-2">
                                <span class="text-medium-emphasis">Monto:</span>
                                <span class="font-weight-bold text-error">${{ formatCurrency(transferData.amount)
                                }}</span>
                            </div>
                            <div class="d-flex align-center justify-space-between mb-2">
                                <span class="text-medium-emphasis">Fecha:</span>
                                <span class="font-weight-medium">{{ formatDate(transferData.transfer_date) }}</span>
                            </div>
                            <div v-if="transferData.description" class="d-flex align-center justify-space-between">
                                <span class="text-medium-emphasis">Descripción:</span>
                                <span class="font-weight-medium">{{ transferData.description }}</span>
                            </div>
                        </VCol>
                    </VRow>
                </VCard>
            </VCardText>

            <!-- Advertencia -->
            <VCardText class="text-center">
                <VAlert type="warning" variant="tonal" class="mb-4">
                    <div class="d-flex align-center">
                        <VIcon icon="ri-error-warning-line" class="mr-2" />
                        <div>
                            <div class="font-weight-bold">¡Atención!</div>
                            <div class="text-body-2">
                                Esta acción no se puede deshacer. La transferencia será eliminada permanentemente.
                            </div>
                        </div>
                    </div>
                </VAlert>
            </VCardText>

            <VDivider class="mt-6" />

            <!-- Acciones -->
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" @click="closeDialog">
                    Cancelar
                </VBtn>
                <VBtn color="error" variant="elevated" prepend-icon="ri-delete-bin-line" :loading="loading"
                    @click="handleDelete">
                    Eliminar Transferencia
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
    transferData: {
        type: Object,
        default: null
    }
})

const emit = defineEmits(['update:modelValue', 'success'])

const { showNotification } = useGlobalToast()

// Estado
const loading = ref(false)

// Computed
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// Métodos
const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

const closeDialog = () => {
    isVisible.value = false
}

const handleDelete = async () => {
    if (!props.transferData?.id) return

    loading.value = true
    try {
        const resp = await $api(`transfers/${props.transferData.id}`, {
            method: 'DELETE'
        })

        console.log('Transfer delete response:', resp)

        // Cerrar diálogo inmediatamente después de la respuesta exitosa
        showNotification('Transferencia eliminada exitosamente', 'success')

        // Emitir evento success y cerrar diálogo
        emit('success', props.transferData)
        closeDialog()

    } catch (error) {
        console.error('Error deleting transfer:', error)
        const message = error.response?._data?.message || 'Error al eliminar la transferencia'
        showNotification(message, 'error')

        // Asegurarse de cerrar el diálogo incluso en caso de error
        closeDialog()
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.text-error {
    color: #f44336;
}

.text-medium-emphasis {
    color: #757575;
}
</style>
