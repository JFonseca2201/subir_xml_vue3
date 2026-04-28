<template>
    <VDialog v-model="isVisible" max-width="500" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-delete-bin-line" color="error" />
                    <span class="text-h5 font-weight-bold">
                        Eliminar Movimiento
                    </span>
                </div>
                <VBtn icon variant="text" @click="closeDialog">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VCardText>
                <!-- Alerta de confirmación -->
                <VAlert type="warning" class="mb-4">
                    <VAlertTitle class="d-flex align-center gap-2">
                        <VIcon icon="ri-alert-line" />
                        <span>¡Atención!</span>
                    </VAlertTitle>
                    <div class="mt-2">
                        Está a punto de eliminar un movimiento de caja. Esta acción:
                    </div>
                    <ul class="mt-2">
                        <li>• Eliminará permanentemente el registro</li>
                        <li>• Revertirá automáticamente el saldo de la cuenta</li>
                        <li>• No se puede deshacer esta operación</li>
                    </ul>
                </VAlert>

                <!-- Información del movimiento a eliminar -->
                <div v-if="flowData" class="flow-details pa-4 border rounded-lg">
                    <VRow>
                        <VCol cols="12" sm="6">
                            <div class="text-caption text-medium-emphasis">Tipo</div>
                            <div class="font-weight-bold">
                                <VChip :color="flowData.flow_type === 'income' ? 'success' : 'error'" size="small">
                                    <VIcon
                                        :icon="flowData.flow_type === 'income' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'"
                                        size="16" class="mr-1" />
                                    {{ flowData.flow_type === 'income' ? 'Ingreso' : 'Egreso' }}
                                </VChip>
                            </div>
                        </VCol>
                        <VCol cols="12" sm="6">
                            <div class="text-caption text-medium-emphasis">Monto</div>
                            <div class="font-weight-bold"
                                :class="flowData.flow_type === 'income' ? 'text-success' : 'text-error'">
                                {{ flowData.flow_type === 'income' ? '+' : '-' }}{{
                                    formatCurrency(flowData.total_amount) }}
                            </div>
                        </VCol>
                        <VCol cols="12" sm="6">
                            <div class="text-caption text-medium-emphasis">Fecha</div>
                            <div class="font-weight-bold">
                                {{ formatDate(flowData.flow_date) }}
                            </div>
                        </VCol>
                        <VCol cols="12" sm="6">
                            <div class="text-caption text-medium-emphasis">Cuenta</div>
                            <div class="font-weight-bold">
                                {{ getAccountTypeName(flowData.account_id) }}
                            </div>
                        </VCol>
                        <VCol cols="12" v-if="flowData.description">
                            <div class="text-caption text-medium-emphasis">Descripción</div>
                            <div class="font-weight-bold">
                                {{ flowData.description }}
                            </div>
                        </VCol>
                    </VRow>
                </div>

                <!-- Confirmación final -->
                <div class="text-center mt-4">
                    <div class="text-body-1 mb-3">
                        ¿Está seguro que desea eliminar este movimiento?
                    </div>
                    <div class="d-flex justify-center gap-2">
                        <VBtn variant="outlined" color="secondary" @click="closeDialog">
                            Cancelar
                        </VBtn>
                        <VBtn color="error" variant="elevated" :loading="loading" @click="confirmDelete">
                            <VIcon icon="ri-delete-bin-line" class="mr-1" />
                            Eliminar Movimiento
                        </VBtn>
                    </div>
                </div>
            </VCardText>
        </VCard>
    </VDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
    modelValue: Boolean,
    flowData: Object
})

const emit = defineEmits({
    'update:modelValue': null,
    'success': null
})

const { showNotification } = useGlobalToast()
const loading = ref(false)
const accounts = ref([])

// Función para cargar cuentas desde la API
const loadAccounts = async () => {
    try {
        console.log('🔍 Cargando cuentas para DailyCashFlowDeleteDialog...')
        const resp = await $api('transfer-accounts', { method: 'GET' })
        console.log('🔍 Accounts response:', resp)

        accounts.value = resp.accounts || resp.data || resp || []
        console.log('✅ Cuentas cargadas:', accounts.value)
    } catch (error) {
        console.error('❌ Error al cargar cuentas:', error)
        accounts.value = []
    }
}

// Computed properties
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// Métodos
const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    })
}

const formatCurrency = (val) => {
    if (isNaN(val) || val === null) return '0.00'
    return Number(val || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}

const getAccountTypeName = (accountId) => {
    // Si hay cuentas cargadas, usar el nombre real desde la API
    if (accounts.value && Array.isArray(accounts.value)) {
        const account = accounts.value.find(acc => acc.id === accountId)
        if (account) {
            return account.name || 'Desconocido'
        }
    }

    // Fallback a nombres por defecto si no hay datos de la API
    const types = {
        1: 'Caja Chica',
        2: 'Banco Pichincha',
        3: 'Banco Guayaquil'
    }
    return types[accountId] || 'Desconocido'
}

const closeDialog = () => {
    isVisible.value = false
}

// Watch para cargar cuentas cuando se abre el diálogo
watch(() => props.modelValue, (val) => {
    if (val) {
        console.log('Diálogo de eliminación abierto, cargando cuentas...')
        loadAccounts()
    }
}, { immediate: true })

const confirmDelete = async () => {
    if (!props.flowData?.id) {
        showNotification('No se puede eliminar: ID de movimiento no encontrado', 'error')
        return
    }

    loading.value = true
    try {
        console.log('Eliminando movimiento:', props.flowData.id)

        const resp = await $api(`daily-cash-flows/${props.flowData.id}`, {
            method: 'DELETE'
        })

        console.log('Respuesta de eliminación:', resp)

        showNotification('Movimiento eliminado exitosamente', 'success')

        // Emitir evento success y cerrar diálogo
        emit('success')
        closeDialog()
    } catch (error) {
        console.error('Error al eliminar movimiento:', error)
        console.error('Error response:', error.response?._data)

        let message = 'Error al eliminar el movimiento'
        if (error.response?._data?.message) {
            message = error.response._data.message
        } else if (error.response?._data?.error) {
            message = error.response._data.error
        }

        showNotification(message, 'error')
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.flow-details {
    background-color: #f8f9fa;
    border-color: #e9ecef !important;
}

.text-caption {
    font-size: 0.75rem;
    line-height: 1rem;
}

.border {
    border: 1px solid #dee2e6;
}

.rounded-lg {
    border-radius: 8px;
}
</style>
