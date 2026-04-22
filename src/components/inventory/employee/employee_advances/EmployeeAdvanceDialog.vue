<template>
    <VDialog v-model="isVisible" max-width="600" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-money-dollar-circle-line" color="primary" />
                    <span class="text-h5 font-weight-bold">
                        {{ isEditing ? 'Editar Adelanto' : 'Nuevo Adelanto' }}
                    </span>
                </div>
                <VBtn icon variant="text" @click="closeDialog">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VForm ref="formRef" @submit.prevent="saveAdvance">
                <VRow>
                    <VCol cols="12" md="6">
                        <VSelect v-model="form.employee_id" :items="employeeOptions" item-title="full_name"
                            item-value="id" label="Empleado *" prepend-inner-icon="ri-user-line"
                            :rules="[rules.required]" required :disabled="isEditing"
                            placeholder="Seleccione un empleado" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="form.account_id" :items="accountOptions" item-title="label" item-value="id"
                            label="Cuenta *" prepend-inner-icon="ri-bank-line" :rules="[rules.required]" required
                            placeholder="Seleccione una cuenta" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.amount" label="Monto *" type="number"
                            prepend-inner-icon="ri-money-dollar-circle-line" :rules="[rules.required, rules.minAmount]"
                            required placeholder="0.00" step="0.01">
                            <template #append-inner>
                                <span class="text-medium-emphasis">USD</span>
                            </template>
                        </VTextField>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.advance_date" label="Fecha del Adelanto *" type="date"
                            prepend-inner-icon="ri-calendar-line" :rules="[rules.required]" required />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="form.state" :items="stateOptions" item-title="title" item-value="value"
                            label="Estado" prepend-inner-icon="ri-toggle-line" placeholder="Seleccione estado" />
                    </VCol>

                    <VCol cols="12">
                        <VTextField v-model="form.concept" label="Concepto/Descripción"
                            prepend-inner-icon="ri-file-text-line" placeholder="Ej: Adelanto para emergencia médica"
                            maxlength="255" />
                    </VCol>
                </VRow>

                <VCardActions class="mt-6">
                    <VSpacer />
                    <VBtn variant="outlined" color="secondary" @click="closeDialog">
                        Cancelar
                    </VBtn>
                    <VBtn color="primary" variant="elevated" type="submit" :loading="loading">
                        {{ isEditing ? 'Actualizar' : 'Registrar' }} Adelanto
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

// Definir props de forma más explícita
const props = defineProps({
    modelValue: Boolean,
    advanceData: Object,
    employees: Array
})

// Definir emits de forma más explícita
const emit = defineEmits({
    'update:modelValue': null,
    'success': null
})

const { showNotification } = useGlobalToast()
const formRef = ref(null)
const loading = ref(false)

// Estado del formulario
const form = ref({
    employee_id: null,
    amount: 0,
    advance_date: null,
    concept: null,
    state: 1,
    user_id: null,
    sucursale_id: null,
    account_id: null // Agregado para cumplir con la validación del backend
})

// Estado para cuentas
const accounts = ref(props.accounts)

// Opciones para selects
const stateOptions = ref([
    { title: 'Pendiente', value: 1 },
    { title: 'Descontado', value: 2 },
    { title: 'Anulado', value: 3 }
])

// Reglas de validación
const rules = {
    required: value => !!value || 'Este campo es requerido',
    minAmount: value => {
        if (!value) return true
        const num = parseFloat(value)
        if (isNaN(num)) return 'El monto debe ser un número válido'
        if (num <= 0) return 'El monto debe ser mayor a 0'
        return true
    }
}

// Computed properties
const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const isEditing = computed(() => !!props.advanceData?.id)

const employeeOptions = computed(() => {
    return props.employees.map(emp => ({
        ...emp,
        full_name: `${emp.name} ${emp.surname}`.trim()
    }))
})

const accountOptions = computed(() => {
    if (!accounts.value || !Array.isArray(accounts.value)) return []
    return accounts.value.map(account => ({
        id: account.id,
        label: getAccountDisplayName(account)
    }))
})

// Función para formatear moneda
const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

// Métodos
const loadAdvanceData = () => {
    if (props.advanceData && props.advanceData.id) {
        form.value = {
            employee_id: props.advanceData.employee_id || '',
            account_id: props.advanceData.account_id || null,
            amount: props.advanceData.amount || '',
            advance_date: props.advanceData.advance_date ? props.advanceData.advance_date.split('T')[0] : '',
            concept: props.advanceData.concept || '',
            state: props.advanceData.state || 1,
            user_id: props.advanceData.user_id || null,
            sucursale_id: props.advanceData.sucursale_id || null
        }
    }
}

const resetForm = () => {
    form.value = {
        employee_id: null,
        account_id: null,
        amount: 0,
        advance_date: null,
        concept: null,
        state: 1,
        user_id: null,
        sucursale_id: null
    }
    if (formRef.value) {
        formRef.value.resetValidation()
    }
}

const closeDialog = () => {
    isVisible.value = false
    resetForm()
}

const saveAdvance = async () => {
    const { valid } = await formRef.value?.validate()
    if (!valid) return

    loading.value = true
    try {
        const isEdit = isEditing.value
        const url = isEdit ? `employee-advances/${props.advanceData.id}` : 'employee-advances'
        const method = isEdit ? 'PUT' : 'POST'

        // Agregar user_id desde el localStorage
        const user = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null
        if (user && !form.value.user_id) {
            form.value.user_id = user.id
        }

        const resp = await $api(url, {
            method,
            body: form.value,
            onResponseError({ response }) {
                console.error('Error al guardar adelanto:', response._data?.error || response._data?.message)
                const errorMessage = response._data?.message || 'Error al guardar el adelanto'
                const errors = response._data?.errors

                if (errors && Object.keys(errors).length > 0) {
                    const firstError = Object.values(errors)[0]
                    showNotification(Array.isArray(firstError) ? firstError[0] : firstError, 'error')
                } else {
                    showNotification(errorMessage, 'error')
                }
            }
        })

        if (resp.status === 201 || resp.status === 200) {
            showNotification(
                isEdit ? 'Adelanto actualizado exitosamente' : 'Adelanto registrado exitosamente',
                'success'
            )
            emit('success')
            closeDialog()
        }
    } catch (error) {
        console.error('Error al guardar adelanto:', error)
        showNotification('Error al guardar el adelanto', 'error')
    } finally {
        loading.value = false
    }
}

// Watchers
watch(() => props.modelValue, (val) => {
    if (val) {
        loadAccounts()
        resetForm()
    }
})

watch(() => props.advanceData, (newData) => {
    if (newData) {
        loadAdvanceData()
    }
}, { immediate: true })

watch(() => props.accounts, (newAccounts) => {
    accounts.value = newAccounts
})
</script>
