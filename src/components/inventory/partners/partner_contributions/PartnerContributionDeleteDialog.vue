<template>
    <VDialog v-model="isVisible" max-width="500" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-delete-bin-line" color="error" />
                    <span class="text-h5 font-weight-bold">Eliminar Aporte</span>
                </div>
                <VBtn icon variant="text" @click="isVisible = false">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VCardText>
                <VAlert type="warning" variant="tonal" class="mb-4">
                    <div class="d-flex align-center gap-2">
                        <VIcon icon="ri-alert-line" />
                        <span class="font-weight-medium">Esta acción no se puede deshacer</span>
                    </div>
                </VAlert>

                <div v-if="contributionData" class="text-body-1">
                    <p>¿Está seguro que desea eliminar el siguiente aporte?</p>

                    <VCard variant="outlined" class="mt-3">
                        <VCardText>
                            <div class="d-flex align-center gap-2 mb-2">
                                <VIcon icon="ri-user-line" size="20" color="primary" />
                                <span class="font-weight-medium">Socio:</span>
                                <span>{{ contributionData.partner?.name || 'N/A' }} {{ contributionData.partner?.surname
                                    || '' }}</span>
                            </div>

                            <div class="d-flex align-center gap-2 mb-2">
                                <VIcon icon="ri-money-dollar-circle-line" size="20" color="success" />
                                <span class="font-weight-medium">Monto:</span>
                                <span class="text-success font-weight-bold">${{ formatCurrency(contributionData.amount)
                                    }}</span>
                            </div>

                            <div class="d-flex align-center gap-2 mb-2">
                                <VIcon icon="ri-calendar-line" size="20" color="info" />
                                <span class="font-weight-medium">Fecha:</span>
                                <span>{{ formatDate(contributionData.contribution_date) }}</span>
                            </div>

                            <div v-if="contributionData.notes" class="d-flex align-start gap-2">
                                <VIcon icon="ri-file-text-line" size="20" color="secondary" />
                                <div>
                                    <span class="font-weight-medium">Notas:</span>
                                    <p class="text-body-2 mt-1">{{ contributionData.notes }}</p>
                                </div>
                            </div>
                        </VCardText>
                    </VCard>
                </div>
            </VCardText>

            <VCardActions class="mt-4">
                <VSpacer />
                <VBtn variant="outlined" color="secondary" @click="isVisible = false">
                    Cancelar
                </VBtn>
                <VBtn color="error" variant="elevated" @click="deleteContribution" :loading="loading">
                    Eliminar Aporte
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<script setup>
import { computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    contributionData: {
        type: Object,
        default: null
    }
})

const emit = defineEmits(['update:modelValue', 'success'])

const { showNotification } = useGlobalToast()
const loading = ref(false)

const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

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

const deleteContribution = async () => {
    if (!props.contributionData?.id) return

    loading.value = true
    try {
        const resp = await $api(`contributions/${props.contributionData.id}`, {
            method: 'DELETE'
        })

        if (resp.status >= 200 && resp.status < 300) {
            showNotification('Aporte eliminado exitosamente', 'success')
            emit('success', resp.data)
            isVisible.value = false
        }
    } catch (error) {
        console.error('Error al eliminar aporte:', error)
        showNotification('Error al eliminar el aporte', 'error')
    } finally {
        loading.value = false
    }
}
</script>
