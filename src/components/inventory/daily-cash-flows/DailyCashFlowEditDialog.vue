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

// Estado del formulario - sin valores quemados, todo desde la base de datos
const form = ref({
    flow_type: null,
    flow_date: '',
    order_number: '',
    total_amount: null,
    payment_status: null,
    payment_method: null,
    account_id: null,
    account_type: null, // Add missing account_type field
    source_type: null,
    source_id: null,
    description: ''
})

// Opciones para selects - se cargarán desde la base de datos
const flowTypeOptions = ref([])
const paymentMethodOptions = ref([])
const bankOptions = ref([])
const paymentStatusOptions = ref([])
const sourceTypeOptions = ref([])

// Computed properties
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const bankOptionsWithNames = computed(() => {
    const options = bankOptions.value.map(account => ({
        ...account,
        label: getAccountDisplayName(account)
    }))
    console.log('bankOptionsWithNames:', options)
    return options
})




// Reglas de validación
const rules = {
    required: value => !!value || 'Este campo es requerido',
    minAmount: value => {
        const numValue = parseFloat(value)
        return (!isNaN(numValue) && numValue > 0) || 'El monto debe ser mayor a 0'
    }
}

// Métodos
const loadFlowData = () => {
    console.log('🎯 loadFlowData iniciado')
    console.log('🎯 props.flowData:', props.flowData)

    if (props.flowData && props.flowData.id) {
        console.log('📊 Procesando flowData con ID:', props.flowData.id)

        // Usar la fecha del backend (campo 'date' en formato DD/MM/YYYY)
        let flowDate = ''

        if (props.flowData.date) {
            flowDate = props.flowData.date
            console.log('📅 Fecha original:', flowDate)

            // Convertir de DD/MM/YYYY a YYYY-MM-DD para el input date
            if (flowDate && flowDate.includes('/')) {
                const parts = flowDate.split('/')
                if (parts.length === 3) {
                    flowDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                }
            }
        } else if (props.flowData.time) {
            // Usar time como fallback (viene en formato Y-m-d H:i:s)
            flowDate = props.flowData.time.split(' ')[0]
            console.log('📅 Fecha desde time:', flowDate)
        } else {
            flowDate = new Date().toISOString().split('T')[0]
            console.log('📅 Fecha por defecto:', flowDate)
        }

        // Mapear campos del backend al frontend
        const flowType = props.flowData.type || 'income'
        const paymentMethod = props.flowData.method === 'Transferencia' ? 'transfer' : 'cash'
        let sourceType = props.flowData.source_type

        console.log('🎯 Source type original:', sourceType)
        console.log('🎯 Tipo de source type original:', typeof sourceType)

        // Si no hay source_type, establecer uno por defecto basado en el flow_type
        if (!sourceType) {
            if (flowType === 'income') {
                sourceType = 'sale' // Ventas por defecto para ingresos
                console.log('💵 Estableciendo source_type por defecto para income:', sourceType)
            } else if (flowType === 'expense') {
                sourceType = 'purchase' // Compras por defecto para egresos
                console.log('💸 Estableciendo source_type por defecto para expense:', sourceType)
            } else {
                sourceType = 'other' // Otro por defecto
                console.log('📦 Estableciendo source_type por defecto other:', sourceType)
            }
        }

        console.log('🎯 Source type final a usar:', sourceType)

        console.log('🔄 Mapeando campos:')
        console.log('   - flowType:', flowType)
        console.log('   - paymentMethod:', paymentMethod)
        console.log('   - sourceType:', sourceType)
        console.log('🔍 TODAS las claves en props.flowData:', Object.keys(props.flowData))
        console.log('🔍 props.flowData.account_id:', props.flowData.account_id)
        console.log('🔍 props.flowData.account:', props.flowData.account)
        console.log('🔍 props.flowData.bank_account_id:', props.flowData.bank_account_id)
        console.log('🔍 props.flowData.transfer_account_id:', props.flowData.transfer_account_id)
        console.log('🔍 typeof props.flowData.account_id:', typeof props.flowData.account_id)
        console.log('🔍 props.flowData.source_type:', props.flowData.source_type)
        console.log('🔍 typeof props.flowData.source_type:', typeof props.flowData.source_type)
        console.log('🔍 props.flowData.source_id:', props.flowData.source_id)
        console.log('🔍 typeof props.flowData.source_id:', typeof props.flowData.source_id)

        // Buscar el ID de cuenta en diferentes campos posibles
        const accountId = props.flowData.account_id ||
            props.flowData.account ||
            props.flowData.bank_account_id ||
            props.flowData.transfer_account_id

        console.log('🎯 ID de cuenta encontrado:', accountId)
        console.log('🎯 Tipo de ID de cuenta:', typeof accountId)

        // Si no hay account_id, establecer uno por defecto basado en el método de pago
        let finalAccountId = accountId
        if (!accountId) {
            if (paymentMethod === 'cash') {
                finalAccountId = 1 // Caja Chica por defecto para efectivo
                console.log('💰 Estableciendo account_id por defecto para efectivo:', finalAccountId)
            } else if (paymentMethod === 'transfer') {
                finalAccountId = 2 // Cuenta bancaria por defecto para transferencia
                console.log('🏦 Estableciendo account_id por defecto para transferencia:', finalAccountId)
            }
        }

        console.log('🎯 Account ID final a usar:', finalAccountId)

        // Buscar el source_id en diferentes campos posibles
        const sourceId = props.flowData.source_id ||
            props.flowData.source ||
            props.flowData.order_id ||
            props.flowData.sale_id ||
            props.flowData.purchase_id

        console.log('🎯 Source ID encontrado:', sourceId)
        console.log('🎯 Tipo de Source ID:', typeof sourceId)
        console.log('🔍 Order number disponible:', props.flowData.order_number)

        // Si no hay source_id pero hay order_number, usarlo como referencia
        let finalSourceId = sourceId
        if (!sourceId) {
            if (props.flowData.order_number && props.flowData.order_number !== '') {
                // Extraer número del order_number (ej: "OT-01428" -> "1428")
                const orderNumber = props.flowData.order_number.replace(/[^\d]/g, '')
                finalSourceId = orderNumber ? parseInt(orderNumber) : null
                console.log('📦 Extrayendo source_id desde order_number:', props.flowData.order_number, '->', finalSourceId)
            } else {
                finalSourceId = null // Es opcional, puede ser null
                console.log('📦 Estableciendo source_id por defecto a null (campo opcional)')
            }
        }

        console.log('🎯 Source ID final a usar:', finalSourceId)

        const formData = {
            flow_type: flowType,
            flow_date: flowDate,
            order_number: props.flowData.order_number || '',
            total_amount: props.flowData.total_amount ? parseFloat(props.flowData.total_amount) : null,
            payment_status: 'complete',
            payment_method: paymentMethod,
            account_id: finalAccountId ? Number(finalAccountId) : null,
            account_type: finalAccountId ? Number(finalAccountId) : null, // Add account_type as integer
            source_type: sourceType,
            source_id: finalSourceId,
            description: props.flowData.description || ''
        }

        console.log('📝 FormData antes de asignar:', formData)
        form.value = formData

        console.log('✅ loadFlowData - account_id asignado:', form.value.account_id, '(tipo:', typeof form.value.account_id, ')')
        console.log('✅ loadFlowData - props.flowData completo:', props.flowData)
        console.log('✅ loadFlowData - bankOptions disponibles:', bankOptions.value.length)
        console.log('✅ loadFlowData - bankOptionsWithNames disponibles:', bankOptionsWithNames.value.length)

        // Verificar si el account_id existe en las opciones
        if (form.value.account_id) {
            const accountExists = bankOptionsWithNames.value.find(acc => acc.id === form.value.account_id)
            console.log('🔍 ¿Existe la cuenta en bankOptionsWithNames?', accountExists)
            if (accountExists) {
                console.log('✅ Nombre de cuenta que debería mostrarse:', accountExists.label)
            } else {
                console.log('❌ No se encontró la cuenta con ID:', form.value.account_id)
                console.log('📋 IDs disponibles:', bankOptionsWithNames.value.map(acc => acc.id))
            }
        }
    } else {
        console.log('⚠️ No hay flowData válido para cargar')
    }
}

// Métodos
const onPaymentMethodChange = (paymentMethod) => {
    if (paymentMethod === 'cash') {
        // Si es efectivo, account_id = 1 (Caja Chica) solo si no hay un valor previo
        if (!form.value.account_id) {
            form.value.account_id = 1
        }
    }
    // No limpiar account_id para transferencia, mantener el valor de la base de datos
}

const resetForm = () => {
    // No establecer valores quemados, solo limpiar el formulario
    // Los datos se cargarán desde loadFlowData cuando se abra el diálogo
    form.value = {
        flow_type: '',
        flow_date: '',
        order_number: '',
        total_amount: null,
        payment_status: '',
        payment_method: '',
        account_id: null,
        source_type: '',
        source_id: null,
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
            _method: 'PUT' // Para Laravel saber que es una actualización
        }


        const resp = await $api(`daily-cash-flows/${props.flowData.id}`, {
            method: 'POST',
            body: requestBody
        })


        showNotification('Movimiento actualizado exitosamente', 'success')

        // Emitir evento success y cerrar diálogo
        emit('success', resp.data || resp)
        closeDialog()
    } catch (error) {
        console.error('Error al actualizar movimiento:', error)
        console.error('Error response:', error.response?._data)
        console.error('Error status:', error.response?.status)
        console.error('Error statusText:', error.response?.statusText)

        // Try to get detailed error messages
        let errorMessage = 'Error al actualizar el movimiento'
        if (error.response?._data) {
            if (error.response._data.message) {
                errorMessage = error.response._data.message
            }
            if (error.response._data.errors) {
                console.error('Validation errors:', error.response._data.errors)
                // If there are field-specific errors, show them
                const errors = error.response._data.errors
                const firstError = Object.values(errors)[0]
                if (firstError && Array.isArray(firstError)) {
                    errorMessage = firstError[0]
                }
            }
        }

        showNotification(errorMessage, 'error')
    } finally {
        loading.value = false
    }
}

// Función para cargar opciones desde la base de datos
const loadOptions = async () => {
    try {
        // Cargar todas las opciones desde un solo endpoint
        const optionsResp = await $api('cash-flow-options', { method: 'GET' })

        if (optionsResp.flow_types) {
            flowTypeOptions.value = optionsResp.flow_types
        }

        if (optionsResp.payment_methods) {
            paymentMethodOptions.value = optionsResp.payment_methods
        }

        if (optionsResp.payment_statuses) {
            paymentStatusOptions.value = optionsResp.payment_statuses
        }

        if (optionsResp.source_types) {
            sourceTypeOptions.value = optionsResp.source_types
        }

        // Cargar cuentas bancarias por separado
        console.log('🔍 Cargando cuentas bancarias desde transfer-accounts...')
        const accountsResp = await $api('transfer-accounts', { method: 'GET' })
        console.log('📥 Respuesta de transfer-accounts:', accountsResp)

        if (accountsResp.accounts && Array.isArray(accountsResp.accounts)) {
            bankOptions.value = accountsResp.accounts.map(account => ({
                ...account,
                id: Number(account.id) // Asegurar que el ID sea numérico
            }));
            console.log('✅ bankOptions cargados:', bankOptions.value)
            console.log('📊 Cantidad de cuentas cargadas:', bankOptions.value.length)
        } else {
            console.log('⚠️ No se encontraron cuentas en accountsResp.accounts')
            console.log('🔍 Estructura de accountsResp:', Object.keys(accountsResp))
            bankOptions.value = []
        }
    } catch (error) {
        console.error('Error al cargar opciones:', error)
        // Establecer valores vacíos en caso de error
        flowTypeOptions.value = []
        paymentMethodOptions.value = []
        paymentStatusOptions.value = []
        sourceTypeOptions.value = []
        bankOptions.value = []
    }
}

// Cargar datos iniciales cuando el componente se monta
onMounted(async () => {
    console.log('🚀 Componente montado')
    console.log('🚀 props.modelValue:', props.modelValue)
    console.log('🚀 props.flowData:', props.flowData)

    // Cargar opciones al montar el componente
    console.log('📥 Cargando opciones en onMounted...')
    await loadOptions()
    console.log('✅ Opciones cargadas en onMounted')

    // Si el diálogo está abierto y hay datos, cargarlos DESPUÉS de cargar las cuentas
    if (props.modelValue && props.flowData) {
        console.log('📊 Cargando datos del flujo en onMounted...')
        loadFlowData()
    } else {
        console.log('⚠️ No hay datos para cargar en onMounted')
        console.log('   - modelValue:', props.modelValue)
        console.log('   - flowData:', props.flowData)
    }
})

// Watch único para cambios en flowData y carga de datos
watch(() => props.flowData, async (newData) => {
    console.log('👀 Watch flowData activado - newData:', newData)
    console.log('👀 props.modelValue:', props.modelValue)
    console.log('👀 bankOptions.length:', bankOptions.value.length)

    if (newData && props.modelValue) {
        console.log('🔄 Necesitamos cargar datos del flujo...')
        // Asegurarse de que las opciones estén cargadas antes de cargar los datos
        if (bankOptions.value.length === 0) {
            console.log('📥 Cargando opciones primero...')
            await loadOptions()
            console.log('✅ Opciones cargadas, bankOptions.length:', bankOptions.value.length)
        }
        console.log('🎯 Ejecutando loadFlowData...')
        loadFlowData()
    }
})

// Watch para actualizar account_type cuando cambia account_id
watch(() => form.value.account_id, (newAccountId) => {
    if (newAccountId && form.value.payment_method === 'transfer') {
        form.value.account_type = newAccountId
        console.log('Account_type actualizado a:', newAccountId, 'para transferencia en edición')
    }
})

// Watch para apertura/cierre del diálogo
watch(() => props.modelValue, async (val) => {
    console.log('🚪 Watch modelValue activado - val:', val)
    console.log('🚪 props.flowData:', props.flowData)

    if (val) {
        console.log('📂 Abriendo diálogo, cargando opciones...')
        // Siempre cargar opciones cuando se abre el diálogo
        await loadOptions()
        console.log('✅ Opciones cargadas después de abrir diálogo')
        // Si hay datos de flujo, cargarlos después de las opciones
        if (props.flowData) {
            console.log('📊 Cargando datos del flujo después de opciones...')
            loadFlowData()
        } else {
            console.log('⚠️ No hay flowData para cargar')
        }
    } else {
        console.log('🔒 Cerrando diálogo')
    }
})

// Watch para prevenir valores NaN en campos numéricos
watch(() => form.value, (newForm) => {
    // Corregir valores NaN
    if (newForm.total_amount !== null && (isNaN(newForm.total_amount) || newForm.total_amount === '')) {
        form.value.total_amount = null
    }
    if (newForm.source_id !== null && (isNaN(newForm.source_id) || newForm.source_id === '')) {
        form.value.source_id = null
    }
    if (newForm.account_id !== null && (isNaN(newForm.account_id) || newForm.account_id === '')) {
        form.value.account_id = 1 // Valor por defecto
    }
}, { deep: true })
</script>

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
                            required />
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
                        <VTextField v-model.number="form.total_amount" label="Monto *" type="number"
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
                        <VSelect v-model="form.account_id" :items="bankOptionsWithNames" item-title="label"
                            item-value="id" label="Banco *" prepend-inner-icon="ri-bank-line" :rules="[rules.required]"
                            required :disabled="bankOptions.length === 0" />
                        <div v-if="bankOptions.length === 0" class="text-caption text-warning mt-1">
                            No hay cuentas bancarias disponibles
                        </div>
                    </VCol>

                    <!-- Tipo de Origen -->
                    <VCol cols="12" md="6">
                        <VSelect v-model="form.source_type" :items="sourceTypeOptions" item-title="label"
                            item-value="value" label="Tipo de Origen *" prepend-inner-icon="ri-links-line"
                            :rules="[rules.required]" required />
                    </VCol>

                    <!-- ID de Origen -->
                    <VCol cols="12" md="6">
                        <VTextField v-model.number="form.source_id" label="ID de Origen" prepend-inner-icon="ri-link"
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


<style scoped>
.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
