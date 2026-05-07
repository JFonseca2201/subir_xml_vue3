<template>
    <VDialog v-model="show" max-width="500" persistent>
        <VCard>
            <!-- Header -->
            <VCardTitle class="pa-6 pb-4">
                <div class="d-flex align-center gap-3">
                    <VIcon icon="ri-edit-line" color="info" size="28" />
                    <div>
                        <h3 class="text-h5 font-weight-bold">Editar Pago</h3>
                        <span class="text-medium-emphasis text-body-2">
                            Modifica los datos del pago
                        </span>
                    </div>
                </div>
            </VCardTitle>
            <VDivider />
            <VCardText class="pa-4">
                <VForm ref="formRef" @submit.prevent="handleSubmit">
                    <VRow>
                        <VCol cols="12">
                            <VSelect
                                v-model="form.employee_id"
                                :items="employees"
                                item-title="name"
                                item-value="id"
                                label="Empleado"
                                placeholder="Seleccionar empleado"
                                :rules="[v => !!v]"
                                required
                            />
                        </VCol>
                    </VRow>

                    <VRow>
                        <VCol cols="12">
                            <VSelect
                                v-model="form.account_id"
                                :items="accounts"
                                item-title="name"
                                item-value="id"
                                label="Cuenta"
                                placeholder="Seleccionar cuenta"
                                :rules="[v => !!v]"
                                required
                            />
                        </VCol>
                    </VRow>

                    <VRow>
                        <VCol cols="12">
                            <VTextField
                                v-model="form.amount"
                                label="Monto"
                                type="number"
                                prefix="$"
                                placeholder="0.00"
                                :rules="[v => !!v && v > 0]"
                                required
                            />
                        </VCol>
                    </VRow>

                    <VRow>
                        <VCol cols="12">
                            <VTextField
                                v-model="form.description"
                                label="Descripción"
                                placeholder="Descripción del pago"
                                :rules="[v => !!v]"
                            />
                        </VCol>
                    </VRow>

                    <VRow>
                        <VCol cols="12">
                            <VTextField
                                v-model="form.payment_date"
                                label="Fecha"
                                type="date"
                                :rules="[v => !!v]"
                                required
                            />
                        </VCol>
                    </VRow>

                    <VRow>
                        <VCol cols="12" class="d-flex gap-2">
                            <VBtn
                                color="primary"
                                type="submit"
                                :loading="loading"
                                :disabled="loading"
                            >
                                {{ isEditing ? 'Actualizar' : 'Crear' }} Pago
                            </VBtn>
                            <VBtn
                                color="default"
                                variant="outlined"
                                @click="closeDialog"
                            >
                                Cancelar
                            </VBtn>
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>
            <VDivider />
            <VCardActions class="pa-4">
                <VBtn
                    color="default"
                    variant="outlined"
                    @click="closeDialog"
                >
                    Cancelar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useLoader } from '@/composables/loader'
import { showNotification } from '@/composables/notifications'

// Props
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    expense: {
        type: Object,
        default: null
    },
    accounts: {
        type: Array,
        default: () => []
    }
})

// Emits
const emit = defineEmits(['update:modelValue', 'updated'])

// Estado
const loader = useLoader()
const { showNotification } = showNotification()
const formRef = ref(null)
const employees = ref([])

// Computed
const show = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const isEditing = computed(() => !!props.expense)

const dialogTitle = computed(() => isEditing.value ? 'Editar Pago' : 'Nuevo Pago')

// Formulario reactivo
const form = ref({
    employee_id: null,
    account_id: null,
    amount: null,
    description: '',
    payment_date: new Date().toISOString().split('T')[0]
})

// Funciones
const resetForm = () => {
    form.value = {
        employee_id: null,
        account_id: null,
        amount: null,
        description: '',
        payment_date: new Date().toISOString().split('T')[0]
    }
    formRef.value?.reset()
}

const closeDialog = () => {
    show.value = false
    setTimeout(() => {
        resetForm()
    }, 300)
}

const handleSubmit = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return

    loader.start()

    try {
        // Simulate API call for testing
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const payload = {
            ...form.value,
            type: 'payment'
        }

        showNotification('Pago guardado exitosamente', 'success')
        emit('updated', payload)
        closeDialog()
    } catch (error) {
        console.error('Error al guardar pago:', error)
        showNotification('Error al guardar pago', 'error')
    } finally {
        loader.stop()
    }
}

const loadEmployees = async () => {
    try {
        // Simulate API response for testing
        const mockEmployees = [
            { id: 1, name: 'CRISTIAN AGUIRRE' },
            { id: 2, name: 'JUAN FONSECA' }
        ]
        employees.value = mockEmployees
    } catch (error) {
        console.error('Error al cargar empleados:', error)
    }
}

// Watchers
watch(() => props.expense, (newVal) => {
    if (newVal) {
        // Load expense data when editing
        if (newVal.employee_id) {
            form.value.employee_id = newVal.employee_id
        }
        if (newVal.account_id) {
            form.value.account_id = newVal.account_id
        }
        if (newVal.amount) {
            form.value.amount = newVal.amount
        }
        if (newVal.description) {
            form.value.description = newVal.description
        }
        if (newVal.payment_date) {
            form.value.payment_date = newVal.payment_date
        }
    }
}, { immediate: true })

watch(() => show.value, (newVal) => {
    if (newVal && !isEditing.value) {
        resetForm()
        loadEmployees()
    }
})

// Lifecycle
onMounted(() => {
    if (isEditing.value) {
        loadEmployees()
    }
})
</script>
