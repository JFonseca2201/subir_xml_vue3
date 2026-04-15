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
                        ¿Está seguro de eliminar este adelanto?
                    </p>
                </div>
            </VCardTitle>

            <VCardText class="pa-0" v-if="advanceToDelete">
                <VAlert type="warning" variant="tonal" class="mb-4">
                    <div class="d-flex align-center gap-2">
                        <VIcon icon="ri-alert-line" />
                        <span>
                            Está a punto de eliminar el adelanto de <strong>{{ advanceToDelete.employee?.full_name || advanceToDelete.employee?.name }}</strong>
                        </span>
                    </div>
                </VAlert>

                <VCard variant="outlined" class="pa-4 bg-grey-lighten-5">
                    <div class="d-flex flex-column gap-3">
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Empleado:</span>
                            <span class="font-weight-medium">{{ advanceToDelete.employee?.full_name || `${advanceToDelete.employee?.name} ${advanceToDelete.employee?.surname || ''}` }}</span>
                        </div>
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Monto:</span>
                            <span class="font-weight-bold text-primary">${{ parseFloat(advanceToDelete.amount || 0).toFixed(2) }}</span>
                        </div>
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Fecha:</span>
                            <span class="font-weight-medium">{{ formatDate(advanceToDelete.advance_date) }}</span>
                        </div>
                        <div class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Estado:</span>
                            <VChip 
                                :color="getStateColor(advanceToDelete.state)" 
                                size="small" 
                                variant="tonal"
                            >
                                {{ getStateText(advanceToDelete.state) }}
                            </VChip>
                        </div>
                        <div v-if="advanceToDelete.concept" class="d-flex justify-space-between align-center">
                            <span class="text-medium-emphasis">Concepto:</span>
                            <span class="font-weight-medium text-truncate" style="max-width: 200px;">{{ advanceToDelete.concept }}</span>
                        </div>
                    </div>
                </VCard>

                <div class="text-center mt-4">
                    <p class="text-body-2 mb-0 text-warning-darken-1">
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
                    Eliminar Adelanto
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
    advanceData: {
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

const advanceToDelete = computed(() => props.advanceData)

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

const getStateText = (state) => {
    const states = {
        1: 'Pendiente',
        2: 'Descontado', 
        3: 'Anulado'
    }
    return states[state] || 'Desconocido'
}

const getStateColor = (state) => {
    const colors = {
        1: 'warning',
        2: 'success',
        3: 'error'
    }
    return colors[state] || 'grey'
}

const closeDialog = () => {
    if (!loading.value) {
        isVisible.value = false
    }
}

const confirmDelete = async () => {
    if (!advanceToDelete.value) return

    loading.value = true
    try {
        const resp = await $api(`employee-advances/${advanceToDelete.value.id}`, {
            method: 'DELETE',
            onResponseError({ response }) {
                console.error('Error al eliminar adelanto:', response._data?.error || response._data?.message)
                const errorMessage = response._data?.message || 'Error al eliminar el adelanto'
                showNotification(errorMessage, 'error')
            }
        })

        if (resp.status === 200) {
            showNotification('Adelanto eliminado exitosamente', 'success')
            emit('success')
            closeDialog()
        }
    } catch (error) {
        console.error('Error al eliminar adelanto:', error)
        showNotification('Error al eliminar el adelanto', 'error')
    } finally {
        loading.value = false
    }
}
</script>
