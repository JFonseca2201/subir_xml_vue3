<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { now } from '@vueuse/core'

// Props
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    accounts: {
        type: Array,
        default: () => []
    }
})

// Emits
const emit = defineEmits(['update:modelValue', 'created'])

// Estado
const formRef = ref(null)
const employees = ref([])
const accounts = ref([])
const loading = ref(false)
const pendingAdvances = ref([])
const totalPendingAdvances = ref(0)
const loadingAdvances = ref(false)
const form = ref({
    employee_id: null,
    employee_name: '',
    account_id: 3,
    account_name: null,
    amount: null,
    description: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'TRANSFERENCIA',
    reference: ''
})

// Métodos de pago
const paymentMethods = [
    { text: 'Efectivo', value: 'EFECTIVO' },
    { text: 'Transferencia', value: 'TRANSFERENCIA' }
]

// Computed
const show = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// Función para mostrar notificaciones toast
const showToast = (message, type = 'info') => {
    // Crear elemento toast
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.textContent = message
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 9999;
        font-size: 14px;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `

    // Agregar al DOM
    document.body.appendChild(toast)

    // Remover automáticamente después de 4 segundos
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast)
        }
    }, 4000)
}

// Agregar animación CSS si no existe
if (!document.querySelector('#toast-styles')) {
    const style = document.createElement('style')
    style.id = 'toast-styles'
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `
    document.head.appendChild(style)
}



// Funciones
const loadEmployees = async () => {
    try {
        console.log('Cargando empleados...')
        const response = await $api('employees')
        console.log('Respuesta completa:', response)
        console.log('Empleados:', response.employees)
        // Transform employee data to include a computed name field
        employees.value = response.employees?.map(emp => ({
            ...emp,
            name: `${emp.first_name} ${emp.last_name}`.trim()
        })) || []
        console.log('Empleados cargados:', employees.value)
    } catch (error) {
        console.error('Error al cargar empleados:', error)
    }
}

const transformAccounts = (accounts) => {
    return (accounts || []).map(account => ({
        ...account,
        display_name: `${account.bank_name} (${account.name})`
    }))
}

const loadAccounts = async () => {
    try {
        const response = await $api('accounts')
        return transformAccounts(response)
    } catch (error) {
        console.error('Error al cargar cuentas:', error)
        return []
    }
}

const getEmployeeAdvances = async (employeeId) => {
    try {
        loadingAdvances.value = true
        const response = await $api(`employee-pending-advances/${employeeId}`)
        console.log('Adelantos pendientes:', response)
        pendingAdvances.value = response.pending_advances || []
        totalPendingAdvances.value = response.total_pending_amount || 0
        return response
    } catch (error) {
        console.error('Error al cargar adelantos del empleado:', error)
        pendingAdvances.value = []
        totalPendingAdvances.value = 0
        return null
    } finally {
        loadingAdvances.value = false
    }
}

const calculateMaxPaymentAmount = async (employeeId) => {
    try {
        const response = await $api(`employee-earnings/${employeeId}`)
        return response.data?.available_for_payment || null
    } catch (error) {
        console.error('Error al calcular ganancias:', error)
        return null
    }
}

const resetForm = () => {
    form.value = {
        employee_id: null,
        account_id: 3,
        amount: null,
        description: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'TRANSFERENCIA',
        reference: ''
    }
    formRef.value?.reset()
}

const closeDialog = () => {
    show.value = false
    setTimeout(() => {
        resetForm()
    }, 50)
}

const handleSubmit = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return

    loading.value = true

    try {
        const payload = {
            ...form.value,
            type: 'payment'
        }

        const response = await $api('employee-expenses', {
            method: 'POST',
            body: payload
        })

        // Mostrar mensaje con información de descuentos
        if (response.total_advances_deducted > 0) {
            showToast(`Pago procesado: $${response.final_amount.toFixed(2)} (Original: $${response.original_amount.toFixed(2)} - Descuentos: $${response.total_advances_deducted.toFixed(2)})`, 'success')
        } else {
            showToast('Pago procesado correctamente', 'success')
        }

        emit('created', payload)
        console.log('Respuesta del servidor:', response)

        closeDialog()
    } catch (error) {
        console.error('Error al guardar pago:', error)

        // Manejar errores de validación específicos
        if (error.status === 422) {
            const errorData = error.data
            if (errorData.message && errorData.message.includes('Saldo insuficiente')) {
                // Mostrar mensaje amigable de saldo insuficiente
                showToast('Saldo insuficiente en la cuenta.\nSaldo disponible: $' + errorData.saldo_disponible + '\nMonto solicitado: $' + errorData.monto_solicitado, 'error')
                return
            }

            // Manejar otros errores de validación
            if (errorData.message) {
                showToast(errorData.message, 'error')
                return
            }
        }

        // Error genérico
        showToast('Error al guardar el pago. Por favor, intente nuevamente.', 'error')
    } finally {
        loading.value = false
    }
}

// Watchers
watch(() => show.value, (newVal) => {
    if (newVal) {
        resetForm()
        loadEmployees()
        // Cargar cuentas desde props o API
        if (props.accounts && props.accounts.length > 0) {
            // Las cuentas ya vienen del padre
            accounts.value = transformAccounts(props.accounts)
        } else {
            // Cargar cuentas desde API si no vienen en props
            loadAccounts().then(response => {
                accounts.value = response
                console.log('Cuentas cargadas:', accounts.value)
            }).catch(error => {
                console.error('Error al cargar cuentas:', error)
            })
        }
    }
})

watch(() => form.value.employee_id, async (employeeId) => {
    if (employeeId) {
        // Encontrar el empleado seleccionado para obtener su salario
        const selectedEmployee = employees.value.find(emp => emp.id === employeeId)

        // Actualizar el nombre del empleado en el formulario
        if (selectedEmployee) {
            form.value.employee_name = selectedEmployee.name
        }

        // Cargar adelantos pendientes del empleado
        await getEmployeeAdvances(employeeId)

        // Calcular ganancias disponibles para pago
        const earnings = await calculateMaxPaymentAmount(employeeId)

        // Usar el salario del empleado como base si está disponible
        const employeeSalary = selectedEmployee ? parseFloat(selectedEmployee.salary) : 0
        const availableEarnings = earnings !== null ? earnings : employeeSalary

        // Calcular monto máximo permitido (ganancias - adelantos)
        const maxPaymentAmount = availableEarnings - totalPendingAdvances.value

        // Establecer monto sugerido automáticamente
        if (maxPaymentAmount > 0) {
            form.value.amount = maxPaymentAmount.toFixed(2)
            console.log(`Monto sugerido: $${maxPaymentAmount.toFixed(2)} (Disponible: $${availableEarnings.toFixed(2)} - Adelantos: $${totalPendingAdvances.value.toFixed(2)})`)
        }

        // Mostrar mensaje sobre adelantos si hay
        if (totalPendingAdvances.value > 0) {
            showToast(`Empleado tiene $${totalPendingAdvances.value.toFixed(2)} en adelantos pendientes que se deducirán del pago.`, 'info')
        }

    } else {
        // Limpiar datos cuando no hay empleado seleccionado
        form.value.employee_name = ''
        form.value.amount = null
        pendingAdvances.value = []
        totalPendingAdvances.value = 0
    }
})

watch(() => form.value.account_id, (accountId) => {
    if (accountId) {
        // Encontrar la cuenta seleccionada para obtener su nombre
        const selectedAccount = accounts.value.find(acc => acc.id === accountId)

        // Actualizar el nombre de la cuenta en el formulario
        if (selectedAccount) {
            form.value.account_name = selectedAccount.name
        }
    } else {
        // Limpiar nombre de cuenta cuando no hay cuenta seleccionada
        form.value.account_name = ''
    }
})

// Lifecycle
onMounted(() => {
    loadEmployees()

    // Cargar cuentas al montar el componente
    if (props.accounts && props.accounts.length > 0) {
        accounts.value = transformAccounts(props.accounts)
    } else {
        loadAccounts().then(response => {
            accounts.value = response
            console.log('Cuentas cargadas en onMounted:', accounts.value)
        }).catch(error => {
            console.error('Error al cargar cuentas en onMounted:', error)
        })
    }
})
</script>

<template>
    <VDialog v-model="show" max-width="600" persistent>
        <VCard>
            <!-- Header -->
            <VCardTitle class="pa-6 pb-4">
                <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-3">
                        <VIcon icon="ri-add-circle-line" color="primary" size="28" />
                        <div>
                            <h3 class="text-h5 font-weight-bold">Nuevo Pago</h3>
                            <span class="text-medium-emphasis text-body-2">
                                Completa los datos para crear un nuevo pago
                            </span>
                        </div>
                    </div>
                    <VBtn icon="ri-close-line" variant="text" size="small" @click="closeDialog" />
                </div>
            </VCardTitle>

            <VDivider />

            <!-- Formulario -->
            <VCardText class="pa-6">
                <VForm ref="formRef" @submit.prevent="handleSubmit">
                    <VRow>
                        <!-- Empleado -->
                        <VCol cols="12">
                            <VSelect v-model="form.employee_id" :items="employees" item-title="name" item-value="id"
                                label="Empleado *" placeholder="Selecciona un empleado"
                                :rules="[v => !!v || 'El empleado es requerido']" variant="outlined"
                                density="comfortable">
                                <template #prepend-inner>
                                    <VIcon color="primary" size="20">ri-user-line</VIcon>
                                </template>
                            </VSelect>
                        </VCol>
                        <!-- Monto -->
                        <VCol cols="6">
                            <VTextField v-model="form.amount" label="Monto *" placeholder="0.00" type="text" prefix="$"
                                :rules="[
                                    v => !!v || 'El monto es requerido',
                                    v => v > 0 || 'El monto debe ser mayor a 0'
                                ]" variant="outlined" density="comfortable">
                                <template #prepend-inner>
                                    <VIcon color="primary" size="20">ri-money-dollar-box-line</VIcon>
                                </template>
                            </VTextField>
                        </VCol>

                        <!-- Cuenta -->
                        <VCol cols="6">
                            <VSelect v-model="form.account_id" :items="accounts" item-value="id"
                                item-title="display_name" label="Cuenta *" placeholder="Selecciona una cuenta"
                                :rules="[v => !!v || 'La cuenta es requerida']" variant="outlined"
                                density="comfortable">
                                <template #prepend-inner>
                                    <VIcon color="primary" size="20">ri-bank-line</VIcon>
                                </template>
                            </VSelect>
                        </VCol>

                        <!-- Resumen de Adelantos -->
                        <VCol cols="12" v-if="pendingAdvances.length > 0">
                            <VCard class="bg-orange-lighten-5 rounded-lg pa-4">
                                <VCardTitle class="d-flex align-center gap-2 mb-3">
                                    <VIcon color="warning" size="20">ri-information-line</VIcon>
                                    <span class="text-h6 font-weight-bold">Adelantos Pendientes</span>
                                </VCardTitle>
                                <VCardText class="pa-0">
                                    <div class="mb-3">
                                        <span class="text-body-2">Total a deducir: </span>
                                        <span class="text-h6 font-weight-bold text-warning">${{
                                            totalPendingAdvances.toFixed(2) }}</span>
                                    </div>
                                    <VDivider class="mb-3" />
                                    <div v-for="(advance, index) in pendingAdvances" :key="advance.id" class="mb-2">
                                        <div class="d-flex justify-space-between align-center">
                                            <div>
                                                <span class="text-body-2 font-weight-medium">${{
                                                    advance.amount.toFixed(2) }}</span>
                                                <span class="text-medium-emphasis text-body-2 ml-2">- {{
                                                    advance.description || 'Sin descripción' }}</span>
                                            </div>
                                            <VChip size="x-small" color="warning" variant="tonal">
                                                {{ advance.advance_date }}
                                            </VChip>
                                        </div>
                                    </div>
                                    <VAlert type="info" variant="tonal" class="mt-3" density="compact">
                                        <template #prepend>
                                            <VIcon>ri-lightbulb-line</VIcon>
                                        </template>
                                        <span class="text-body-2">
                                            Estos adelantos se deducirán automáticamente del monto del pago.
                                            Monto final del pago = Monto ingresado - ${{ totalPendingAdvances.toFixed(2)
                                            }}
                                        </span>
                                    </VAlert>
                                </VCardText>
                            </VCard>
                        </VCol>



                        <!-- Método de Pago -->
                        <VCol cols="12" md="6">
                            <VSelect v-model="form.payment_method" :items="paymentMethods" item-title="text"
                                item-value="value" label="Método de Pago *" placeholder="Selecciona método"
                                :rules="[v => !!v || 'El método de pago es requerido']" variant="outlined"
                                density="comfortable">
                                <template #prepend-inner>
                                    <VIcon color="primary" size="20">ri-money-dollar-circle-line</VIcon>
                                </template>
                            </VSelect>
                        </VCol>

                        <!-- Fecha -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="form.payment_date" label="Fecha *" type="date"
                                :rules="[v => !!v || 'La fecha es requerida']" variant="outlined" density="comfortable">
                                <template #prepend-inner>
                                    <VIcon color="primary" size="20">ri-calendar-line</VIcon>
                                </template>
                            </VTextField>
                        </VCol>

                        <!-- Descripción -->
                        <VCol cols="12">
                            <VTextarea v-model="form.description" label="Descripción *"
                                placeholder="Describe el pago realizado..." rows="3" variant="outlined"
                                density="comfortable" no-resize :rules="[
                                    v => !!v || 'La descripción es requerida'
                                ]">
                                <template #prepend-inner>
                                    <VIcon color="primary" size="20">ri-article-line</VIcon>
                                </template>
                            </VTextarea>
                        </VCol>

                        <!-- Referencia -->
                        <VCol cols="12">
                            <VTextField v-model="form.reference" label="Referencia"
                                placeholder="Número de comprobante, cheque, etc..." variant="outlined"
                                density="comfortable">
                                <template #prepend-inner>
                                    <VIcon color="primary" size="20">ri-file-text-line</VIcon>
                                </template>
                            </VTextField>
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>

            <VDivider />

            <!-- Footer -->
            <VCardActions class="pa-6">
                <VSpacer />
                <VBtn variant="outlined" prepend-icon="ri-close-line" @click="closeDialog" :disabled="loading">
                    Cancelar
                </VBtn>
                <VBtn color="primary" variant="elevated" prepend-icon="ri-save-line" @click="handleSubmit"
                    :loading="loading">
                    Guardar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
/* Estilos para inputs modernos */
:deep(.v-field) {
    border-radius: 12px !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
    transition: all 0.3s ease !important;
}

:deep(.v-field:hover) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
    transform: translateY(-1px);
}

:deep(.v-field--focused) {
    box-shadow: 0 4px 20px rgba(33, 150, 243, 0.15) !important;
    border-color: #2196F3 !important;
}

:deep(.v-field__input) {
    font-size: 15px;
    padding: 16px;
}

:deep(.v-field__prepend-inner) {
    padding-right: 8px;
}
</style>
