<template>
    <VDialog v-model="isVisible" max-width="600" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-money-dollar-circle-line" color="success" />
                    <span class="text-h5 font-weight-bold">
                        {{ isEditing ? 'Editar Pago' : 'Nuevo Pago' }}
                    </span>
                </div>
                <VBtn icon variant="text" @click="isVisible = false">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VForm ref="formRef" @submit.prevent="savePayment">
                <VRow>
                    <VCol cols="12" md="6">
                        <VSelect v-model="form.employee_id" :items="employeeOptions" item-title="full_name"
                            item-value="id" label="Empleado *" prepend-inner-icon="ri-user-line"
                            :rules="[rules.required]" required :disabled="isEditing"
                            placeholder="Seleccione un empleado" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.amount" label="Monto Total a Cancelar" type="number"
                            prepend-inner-icon="ri-money-calculator-line"
                            :rules="[rules.required, rules.accountBalance]"
                            hint="No puede exceder el saldo de la cuenta ni el monto disponible para pagar"
                            persistent-hint color="primary">
                            <template #append-inner>
                                <span class="text-medium-emphasis">USD</span>
                            </template>
                        </VTextField>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.payment_date" label="Fecha del Pago *" type="date"
                            prepend-inner-icon="ri-calendar-line" :rules="[rules.required]" required />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="form.payment_type" :items="paymentTypeOptions" item-title="title"
                            item-value="value" label="Tipo de Pago *" prepend-inner-icon="ri-bank-line"
                            :rules="[rules.required]" required placeholder="Seleccione tipo de pago" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="form.account_id" :items="availableAccounts" item-title="display_name"
                            item-value="id" label="Cuenta de Origen *" prepend-inner-icon="ri-bank-card-line"
                            :rules="[rules.required]" required placeholder="Seleccione cuenta de origen"
                            :disabled="loadingAccounts" :loading="loadingAccounts">
                            <template #append-inner>
                                <VProgressCircular v-if="loadingAccounts" indeterminate size="16" width="2" />
                            </template>
                        </VSelect>
                        <div v-if="form.account_id && selectedAccount" class="text-caption text-medium-emphasis mt-1">
                            <div class="d-flex align-center gap-1">
                                <VIcon icon="ri-bank-card-line" size="14" />
                                <span class="font-weight-medium">{{ selectedAccount.bank_name }}</span>
                                <span>•••• {{ selectedAccount.last_four }}</span>
                            </div>
                            <div class="text-info">Saldo disponible: ${{ formatCurrency(selectedAccount.balance) }}
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="form.state" :items="stateOptions" item-title="title" item-value="value"
                            label="Estado" prepend-inner-icon="ri-toggle-line" placeholder="Seleccione estado" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.concept" label="Concepto/Descripción"
                            prepend-inner-icon="ri-file-text-line" placeholder="Ej: Pago quincenal" maxlength="255" />
                    </VCol>
                </VRow>

                <VDivider class="my-4" />
                <VRow v-if="form.employee_id">
                    <VCol cols="12">
                        <h5 class="text-h6 font-weight-bold mb-1 text-primary">Detalle de Adelantos a Descontar</h5>
                        <p class="text-caption text-medium-emphasis mb-3">Estos montos se descontarán automáticamente
                            del salario.</p>
                    </VCol>

                    <VCol cols="12">
                        <VCard variant="outlined" border v-if="pendingAdvances.length > 0">
                            <VList density="compact">
                                <VListItem v-for="advance in pendingAdvances" :key="advance.id">
                                    <template v-slot:prepend>
                                        <VIcon icon="ri-arrow-right-down-line" color="error" size="small" />
                                    </template>
                                    <VListItemTitle>{{ advance.concept || 'Adelanto de efectivo' }}</VListItemTitle>
                                    <template v-slot:append>
                                        <span class="font-weight-medium text-error">-${{ formatCurrency(advance.amount)
                                        }}</span>
                                    </template>
                                </VListItem>
                            </VList>
                        </VCard>
                        <VAlert v-else type="info" variant="tonal" density="compact">
                            El empleado no tiene adelantos pendientes.
                        </VAlert>
                    </VCol>

                    <VCol cols="12" class="mt-2">
                        <VAlert border="start" color="success" variant="tonal">
                            <div class="d-flex justify-space-between align-center">
                                <div>
                                    <div class="text-caption">Salario Base</div>
                                    <div class="text-h6">${{ formatCurrency(employeeSalary) }}</div>
                                </div>
                                <div class="text-h4">-</div>
                                <div>
                                    <div class="text-caption">Adelantos</div>
                                    <div class="text-h6">${{ formatCurrency(totalPendingAdvances) }}</div>
                                </div>
                                <div class="text-h4">=</div>
                                <div>
                                    <div class="text-caption font-weight-bold">Total a Pagar</div>
                                    <div class="text-h6 font-weight-bold">${{ formatCurrency(availableForPayment) }}
                                    </div>
                                </div>
                            </div>
                        </VAlert>
                    </VCol>
                </VRow>

                <VCardActions class="mt-6">
                    <VSpacer />
                    <VBtn variant="outlined" color="secondary" @click="isVisible = false">
                        Cancelar
                    </VBtn>
                    <VBtn color="success" variant="elevated" type="submit" :loading="loading">
                        {{ isEditing ? 'Actualizar' : 'Registrar' }} Pago
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

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    paymentData: { type: Object, default: null },
    employees: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'success'])

// Toast
let showNotification
try {
    const toast = useGlobalToast()
    showNotification = toast.showNotification
} catch (e) {
    showNotification = () => { }
}

const formRef = ref(null)
const loading = ref(false)

const form = ref({
    employee_id: null,
    amount: 0,
    payment_date: new Date().toISOString().substr(0, 10),
    concept: '',
    payment_type: 'cash',
    state: 1,
    user_id: null,
    sucursale_id: 1,
    account_id: null,
    advance_ids: [] // Se llenará automáticamente
})

const availableAccounts = ref([])
const selectedAccount = ref(null)
const loadingAccounts = ref(false)

const pendingAdvances = ref([])
const totalPendingAdvances = ref(0)
const availableForPayment = ref(0)
const employeeSalary = ref(0)

const paymentTypeOptions = [
    { title: 'Efectivo', value: 'cash' },
    { title: 'Transferencia', value: 'transfer' },
    { title: 'Cheque', value: 'check' }
]

const stateOptions = [
    { title: 'Activo', value: 1 },
    { title: 'Inactivo', value: 2 }
]

const rules = {
    required: value => !!value || 'Requerido',
    accountBalance: value => {
        if (!value) return true
        const num = parseFloat(value)
        if (isNaN(num)) return 'El monto debe ser un número válido'
        if (num <= 0) return 'El monto debe ser mayor a 0'

        // Verificar saldo suficiente en cuenta seleccionada
        if (selectedAccount.value && num > parseFloat(selectedAccount.value.balance)) {
            return `El monto excede el saldo disponible de la cuenta ($${formatCurrency(selectedAccount.value.balance)})`
        }

        // Verificar que no exceda el monto disponible para pagar al empleado
        if (num > availableForPayment.value) {
            return `El monto no puede exceder $${formatCurrency(availableForPayment.value)}`
        }

        return true
    }
}

const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const isEditing = computed(() => !!props.paymentData)

const employeeOptions = computed(() => {
    return props.employees.map(emp => ({
        ...emp,
        full_name: `${emp?.name || ''} ${emp?.surname || ''}`.trim()
    }))
})

const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Cargar cuentas bancarias disponibles
const loadAvailableAccounts = async () => {
    loadingAccounts.value = true
    try {
        const resp = await $api('accounts', { method: 'GET' })
        if (resp.status === 200) {
            availableAccounts.value = resp.data.map(account => ({
                ...account,
                display_name: `${account.bank_name} •••• ${account.last_four} - Saldo: $${formatCurrency(account.balance || 0)}`
            }))
        }
    } catch (error) {
        console.error('Error loading accounts:', error)
        availableAccounts.value = []
    } finally {
        loadingAccounts.value = false
    }
}

const loadPendingAdvances = async (employeeId) => {
    if (!employeeId) return

    try {
        const resp = await $api(`employees/${employeeId}/check-pending-advances`, { method: 'GET' })

        if (resp.status === 200) {
            pendingAdvances.value = resp.advances || []
            totalPendingAdvances.value = resp.total_pending_advances || 0
            employeeSalary.value = resp.employee_salary || 0
            availableForPayment.value = resp.available_for_payment || 0

            // 1. Asignamos el monto calculado al formulario automáticamente
            form.value.amount = availableForPayment.value

            // 2. Cargamos todos los IDs de adelantos automáticamente para el backend
            form.value.advance_ids = pendingAdvances.value.map(a => a.id)
        }
    } catch (error) {
        console.error('Error loading advances:', error)
    }
}

const savePayment = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return

    loading.value = true
    try {
        const userStr = localStorage.getItem("user")
        if (userStr) {
            const user = JSON.parse(userStr)
            form.value.user_id = user.id
        }

        const url = isEditing.value ? `employee-payments/${props.paymentData.id}` : 'employee-payments'
        const method = isEditing.value ? 'PUT' : 'POST'

        const resp = await $api(url, { method, body: form.value })

        showNotification('Operación exitosa', 'success')
        emit('success', resp.data)
        isVisible.value = false
    } catch (error) {
        showNotification('Error al procesar pago', 'error')
    } finally {
        loading.value = false
    }
}

// Watcher para actualizar cuenta seleccionada
watch(() => form.value.account_id, (newAccountId) => {
    if (newAccountId) {
        selectedAccount.value = availableAccounts.value.find(acc => acc.id === newAccountId) || null
    } else {
        selectedAccount.value = null
    }
})

watch(() => form.value.employee_id, (newVal) => {
    if (newVal) loadPendingAdvances(newVal)
})

watch(() => props.modelValue, (val) => {
    if (val) {
        loadAvailableAccounts()
    } else {
        form.value.employee_id = null
        form.value.amount = 0
        form.value.advance_ids = []
        form.value.account_id = null
        selectedAccount.value = null
    }
})
</script>