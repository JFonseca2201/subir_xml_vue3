<template>
    <VDialog v-model="isVisible" max-width="700" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-edit-line" color="primary" />
                    <span class="text-h5 font-weight-bold">
                        Editar Movimiento de Caja
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
                        <VSelect v-model="form.flow_type" :items="flowTypeOptions" item-title="label" item-value="value"
                            label="Tipo de Movimiento *" prepend-inner-icon="ri-exchange-line" :rules="[rules.required]"
                            required disabled />
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
                        Actualizar Movimiento
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
    flowData: Object
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
    flow_type: 'income',
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

const accountOptions = computed(() => {
    if (!accounts.value || !Array.isArray(accounts.value)) return []
    return accounts.value.map(account => ({
        id: account.id,
        label: getAccountDisplayName(account),
        type: account.type
    }))
})

const filteredAccountOptions = computed(() => {
    if (!form.value.account_type) return accountOptions.value

    // Filtrar cuentas por tipo
    const typeMap = {
        1: ['cash'], // Caja Chica
        2: ['cash'], // Caja (pueden ser cash también)
        3: ['bank']  // Bancos
    }

    const allowedTypes = typeMap[form.value.account_type] || []
    return accountOptions.value.filter(account =>
        allowedTypes.includes(account.type) ||
        (form.value.account_type === 1 && account.label.includes('CAJA CHICA')) ||
        (form.value.account_type === 2 && account.label.includes('CAJA') && !account.label.includes('CHICA')) ||
        (form.value.account_type === 3 && account.label.includes('BANCOS'))
    )
})

// Reglas de validación
const rules = {
    required: value => !!value || 'Este campo es requerido',
    minAmount: value => parseFloat(value) > 0 || 'El monto debe ser mayor a 0'
}

// Métodos
const loadFlowData = () => {
    console.log('=== loadFlowData INICIADO ===')
    console.log('props.flowData completo:', JSON.stringify(props.flowData, null, 2))

    if (props.flowData && props.flowData.id) {
        console.log('✅ flowData válido con ID:', props.flowData.id)
        console.log('📋 Datos a cargar:')
        console.log('  - flow_type:', props.flowData.flow_type)
        console.log('  - flow_date:', props.flowData.flow_date)
        console.log('  - order_number:', props.flowData.order_number)
        console.log('  - total_amount:', props.flowData.total_amount, '(tipo:', typeof props.flowData.total_amount, ')')
        console.log('  - payment_status:', props.flowData.payment_status)
        console.log('  - payment_method:', props.flowData.payment_method)
        console.log('  - account_id:', props.flowData.account_id)
        console.log('  - source_type:', props.flowData.source_type)
        console.log('  - source_id:', props.flowData.source_id)
        console.log('  - description:', props.flowData.description)

        // Crear objeto con datos del flujo
        const formData = {
            flow_type: props.flowData.flow_type || 'income',
            flow_date: props.flowData.flow_date ? props.flowData.flow_date.split('T')[0] : new Date().toISOString().split('T')[0],
            order_number: props.flowData.order_number || '',
            total_amount: props.flowData.total_amount ? props.flowData.total_amount.toString() : '',
            payment_status: props.flowData.payment_status || 'complete',
            payment_method: props.flowData.payment_method || 'cash',
            account_id: props.flowData.account_id || 1,
            source_type: props.flowData.source_type || 'other',
            source_id: props.flowData.source_id?.toString() || '',
            description: props.flowData.description || ''
        }

        console.log('📝 Datos que se asignarán al formulario:', formData)
        form.value = formData

        console.log('✅ Formulario después de cargar datos:', JSON.stringify(form.value, null, 2))
    } else {
        console.log('❌ No hay flowData o no tiene id')
        console.log('  - props.flowData:', props.flowData)
        console.log('  - props.flowData.id:', props.flowData?.id)
    }
    console.log('=== loadFlowData FINALIZADO ===')
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
    // No establecer valores quemados, solo limpiar el formulario
    // Los datos se cargarán desde loadFlowData cuando se abra el diálogo
    form.value = {
        flow_type: '',
        flow_date: '',
        order_number: '',
        total_amount: '',
        payment_status: '',
        payment_method: '',
        account_id: null,
        source_type: '',
        source_id: '',
        description: ''
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
        const requestBody = {
            ...form.value,
            total_amount: parseFloat(form.value.total_amount),
            source_id: form.value.source_id ? parseInt(form.value.source_id) : null,
            account_type: form.value.account_id, // Mapear account_id a account_type para el backend
            _method: 'PUT' // Para Laravel saber que es una actualización
        }

        console.log('Datos que se enviarán al backend:', requestBody)

        const resp = await $api(`daily-cash-flows/${props.flowData.id}`, {
            method: 'POST',
            body: requestBody
        })

        console.log('Flujo de caja actualizado:', resp)

        showNotification('Movimiento actualizado exitosamente', 'success')

        // Emitir evento success y cerrar diálogo
        emit('success', resp.data || resp)
        closeDialog()
    } catch (error) {
        console.error('Error al actualizar movimiento:', error)
        console.error('Error response:', error.response?._data)
        const message = error.response?._data?.message || 'Error al actualizar el movimiento'
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

// Cargar datos iniciales cuando el componente se monta
onMounted(() => {
    console.log('🚀 DailyCashFlowEditDialog montado')
    console.log('props.modelValue:', props.modelValue)
    console.log('props.flowData disponible:', !!props.flowData)

    // Si el diálogo está abierto y hay datos, cargarlos
    if (props.modelValue && props.flowData) {
        console.log('✅ Diálogo abierto con datos, cargando...')
        loadFlowData()
        loadAccounts()
    } else if (props.modelValue) {
        console.log('🔄 Diálogo abierto sin datos, cargando cuentas...')
        loadAccounts()
    }
})

// Watch para cambios en flowData después del montaje inicial
watch(() => props.flowData, (newData) => {
    if (newData && props.modelValue) {
        console.log('📝 flowData cambiado, recargando datos...')
        loadFlowData()
    }
})

// Watch para apertura/cierre del diálogo
watch(() => props.modelValue, (val) => {
    if (val && !props.flowData) {
        console.log('🔄 Diálogo abierto sin flowData, cargando cuentas...')
        loadAccounts()
    }
})
</script>

<style scoped>
.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
