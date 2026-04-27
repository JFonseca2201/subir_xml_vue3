<template>
    <VDialog v-model="isVisible" max-width="700" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon :icon="form.flow_type === 'income' ? 'ri-arrow-down-circle-line' : 'ri-arrow-up-circle-line'"
                        :color="form.flow_type === 'income' ? 'success' : 'error'" />
                    <span class="text-h5 font-weight-bold">
                        {{ props.flowType === 'income' ? 'Nuevo Ingreso' : 'Nuevo Egreso' }}
                    </span>
                </div>
                <VBtn icon variant="text" @click="closeDialog">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VForm ref="formRef" @submit.prevent="handleSubmit">
                <VRow>
                    <!-- Tipo de Flujo -->
                    <VCol cols="12" md="6">
                        <div class="d-flex align-center mb-2">
                            <VIcon icon="ri-exchange-line" class="me-2" />
                            <span class="text-body-2 font-weight-medium">Tipo de Movimiento:</span>
                        </div>
                        <div class="d-flex align-center">
                            <VChip :color="props.flowType === 'income' ? 'success' : 'error'"
                                :prepend-icon="props.flowType === 'income' ? 'ri-arrow-down-circle-line' : 'ri-arrow-up-circle-line'"
                                class="me-2">
                                {{ props.flowType === 'income' ? 'Ingreso' : 'Egreso' }}
                            </VChip>
                        </div>
                    </VCol>

                    <!-- Fecha -->
                    <VCol cols="12" md="6">
                        <VTextField v-model="form.flow_date" label="Fecha del Movimiento *" type="date"
                            prepend-inner-icon="ri-calendar-line" :rules="[rules.required]" required />
                    </VCol>

                    <!-- Número de Orden -->
                    <VCol cols="12" md="6">
                        <VTextField v-model="form.order_number" label="Número de Orden" prepend-inner-icon="ri-hashtag"
                            placeholder="Ej: ORD-001" maxlength="50" />
                    </VCol>

                    <!-- Monto -->
                    <VCol cols="12" md="6">
                        <VTextField v-model="form.total_amount" label="Monto *" type="number"
                            prepend-inner-icon="ri-money-dollar-circle-line" :rules="[rules.required, rules.minAmount]"
                            required placeholder="0.00" step="0.01">
                            <template #append-inner>
                                <span class="text-medium-emphasis">USD</span>
                            </template>
                        </VTextField>
                    </VCol>

                    <!-- Estado de Pago -->
                    <VCol cols="12" md="6">
                        <VSelect v-model="form.payment_status" :items="paymentStatusOptions" item-title="label"
                            item-value="value" label="Estado de Pago *" prepend-inner-icon="ri-checkbox-circle-line"
                            :rules="[rules.required]" required />
                    </VCol>

                    <!-- Tipo de Pago -->
                    <VCol cols="12" md="6">
                        <VSelect v-model="form.payment_method" :items="paymentMethodOptions" item-title="label"
                            item-value="value" label="Tipo de Pago *" prepend-inner-icon="ri-money-dollar-circle-line"
                            :rules="[rules.required]" required @update:modelValue="onPaymentMethodChange" />
                    </VCol>

                    <!-- Banco (solo para transferencia) -->
                    <VCol v-if="form.payment_method === 'transfer'" cols="12" md="6">
                        <VSelect v-model="form.account_id" :items="bankOptions" item-title="label" item-value="id"
                            label="Banco *" prepend-inner-icon="ri-bank-line" :rules="[rules.required]" required />
                    </VCol>

                    <!-- Tipo de Origen -->
                    <VCol cols="12" md="6">
                        <VSelect v-model="form.source_type" :items="sourceTypeOptions" item-title="label"
                            item-value="value" label="Tipo de Origen *" prepend-inner-icon="ri-links-line"
                            :rules="[rules.required]" required />
                    </VCol>

                    <!-- ID de Origen -->
                    <VCol cols="12" md="6">
                        <VTextField v-model="form.source_id" label="ID de Origen" prepend-inner-icon="ri-link"
                            type="number" placeholder="ID de venta/compra (opcional)" />
                    </VCol>

                    <!-- Descripción -->
                    <VCol cols="12">
                        <VTextField v-model="form.description" label="Descripción"
                            prepend-inner-icon="ri-file-text-line" placeholder="Descripción del movimiento"
                            maxlength="255" rows="3" />
                    </VCol>
                </VRow>

                <VCardActions class="mt-6">
                    <VSpacer />
                    <VBtn variant="outlined" color="secondary" @click="closeDialog">
                        Cancelar
                    </VBtn>
                    <VBtn color="primary" variant="elevated" type="submit" :loading="loading">
                        Crear Movimiento
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
import { getAccountDisplayName } from '@/utils/helpers'

const props = defineProps({
    modelValue: Boolean,
    flowType: {
        type: String,
        default: 'income'
    }
})

const emit = defineEmits({
    'update:modelValue': null,
    'success': null
})

const { showNotification } = useGlobalToast()
const formRef = ref(null)
const loading = ref(false)
const accounts = ref([])

// Estado del formulario
const form = ref({
    flow_type: props.flowType || 'income',
    flow_date: new Date().toISOString().split('T')[0],
    order_number: '',
    total_amount: '',
    payment_status: 'complete',
    payment_method: 'cash',
    account_id: 1,
    source_type: 'other',
    source_id: '',
    description: ''
})

// Watch para pre-seleccionar el tipo cuando se abre el diálogo
watch(() => props.modelValue, (val) => {
    console.log('🔓 Dialogo abierto:', val)
    console.log('🔓 FlowType recibido:', props.flowType)
    console.log('🔓 Form.flow_type ANTES de asignar:', form.value.flow_type)
    if (val && props.flowType) {
        console.log('🔓 Estableciendo flow_type a:', props.flowType)
        form.value.flow_type = props.flowType
        console.log('🔓 flow_type DESPUÉS de asignar:', form.value.flow_type)
    } else {
        console.log('🔓 No se asignó flow_type - val:', val, 'flowType:', props.flowType)
    }
})

// Watch adicional para la prop flowType
watch(() => props.flowType, (newFlowType) => {
    console.log('FlowType cambió a:', newFlowType)
    if (newFlowType && props.modelValue) {
        console.log('Actualizando flow_type por cambio de prop:', newFlowType)
        form.value.flow_type = newFlowType
        console.log('flow_type después de actualizar por prop:', form.value.flow_type)
    }
})

// Opciones para selects
const flowTypeOptions = ref([
    { label: 'Ingreso', value: 'income' },
    { label: 'Egreso', value: 'expense' }
])

const paymentMethodOptions = ref([
    { label: 'Efectivo', value: 'cash' },
    { label: 'Transferencia', value: 'transfer' }
])

const bankOptions = ref([
    { label: 'Banco Pichincha', id: 2 },
    { label: 'Banco Guayaquil', id: 3 }
])

const paymentStatusOptions = ref([
    { label: 'Completo', value: 'complete' },
    { label: 'Parcial', value: 'partial' },
    { label: 'Pendiente', value: 'pending' }
])

const sourceTypeOptions = ref([
    { label: 'Venta', value: 'sale' },
    { label: 'Compra', value: 'purchase' },
    { label: 'Otro', value: 'other' }
])

// Computed properties
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})


// Reglas de validación
const rules = {
    required: value => !!value || 'Este campo es requerido',
    minAmount: value => parseFloat(value) > 0 || 'El monto debe ser mayor a 0'
}

// Métodos
const onPaymentMethodChange = (paymentMethod) => {
    console.log('Método de pago cambiado a:', paymentMethod)

    if (paymentMethod === 'cash') {
        // Si es efectivo, account_id = 1 (Caja Chica)
        form.value.account_id = 1
        console.log('Account_id establecido a 1 para efectivo')
    } else if (paymentMethod === 'transfer') {
        // Si es transferencia, limpiar account_id para que el usuario seleccione
        form.value.account_id = null
        console.log('Account_id limpiado para transferencia, usuario debe seleccionar banco')
    }
}

const resetForm = () => {
    console.log('🔄 resetForm() llamado')
    console.log('🔄 flow_type ANTES de resetForm:', form.value.flow_type)

    // Preservar el flow_type actual si ya está establecido
    const currentFlowType = form.value.flow_type || 'income'
    console.log('🔄 currentFlowType preservado:', currentFlowType)

    form.value = {
        flow_type: currentFlowType,
        flow_date: new Date().toISOString().split('T')[0],
        order_number: '',
        total_amount: '',
        payment_status: 'complete',
        payment_method: 'cash',
        account_id: 1,
        source_type: 'other',
        source_id: '',
        description: ''
    }

    console.log('🔄 flow_type DESPUÉS de resetForm:', form.value.flow_type)
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
        // Agregar user_id desde el localStorage
        const user = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null

        console.log('🔍 Antes de enviar - form.value.flow_type:', form.value.flow_type)
        console.log('🔍 Antes de enviar - form.value completo:', form.value)

        const requestBody = {
            ...form.value,
            total_amount: parseFloat(form.value.total_amount),
            source_id: form.value.source_id ? parseInt(form.value.source_id) : null,
            user_id: user?.id || null,
            account_type: form.value.account_id // Mapear account_id a account_type para el backend
        }

        console.log('📤 Datos que se enviarán al backend:', requestBody)
        console.log('📤 flow_type en requestBody:', requestBody.flow_type)

        const resp = await $api('daily-cash-flows', {
            method: 'POST',
            body: requestBody
        })

        console.log('Flujo de caja creado:', resp)

        showNotification('Movimiento creado exitosamente', 'success')

        // Emitir evento success y cerrar diálogo
        emit('success', resp.data || resp)
        closeDialog()
    } catch (error) {
        console.error('Error al crear movimiento:', error)
        console.error('Error response:', error.response?._data)
        const message = error.response?._data?.message || 'Error al crear el movimiento'
        showNotification(message, 'error')
    } finally {
        loading.value = false
    }
}

// Función para cargar cuentas
const loadAccounts = async () => {
    try {
        const resp = await $api('transfer-accounts', { method: 'GET' })
        accounts.value = resp.accounts || resp.data || resp || []
    } catch (error) {
        console.error('Error al cargar cuentas:', error)
    }
}

// Watch para cargar cuentas cuando se abre el diálogo
watch(() => props.modelValue, (val) => {
    if (val) {
        console.log('Diálogo abierto, estableciendo valores iniciales')
        // Establecer valores iniciales según el método de pago
        if (form.value.payment_method === 'cash') {
            form.value.account_id = 1
        }
    }
}, { immediate: true })
</script>

<style scoped>
.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
