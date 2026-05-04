<script setup>
import { ref, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    }
})

// Emits
const emit = defineEmits(['update:modelValue', 'employee-created'])

// Estado
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const employeeForm = ref({
    identification: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    salary: 0,
    hired_at: null
})
const employeeFormRef = ref(null)

// Reglas de validación
const requiredRule = v => !!v || 'Campo obligatorio'
const minLengthRule = (min) => v => !v || v.length >= min || `Mínimo ${min} caracteres`
const maxLengthRule = (max) => v => !v || v.length <= max || `Máximo ${max} caracteres`
const emailRule = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email no válido'
const numericRule = v => !v || !isNaN(v) || 'Debe ser un número'
const minValueRule = (min) => v => !v || parseFloat(v) >= min || `Mínimo ${min}`
const maxValueRule = (max) => v => !v || parseFloat(v) <= max || `Máximo ${max}`

// Validación de cédula ecuatoriana
const ecuadorianIdRule = (v) => {
    if (!v) return 'Campo obligatorio'
    
    // Eliminar espacios y guiones
    const cleanId = v.replace(/[\s-]/g, '')
    
    // Debe tener exactamente 10 dígitos
    if (!/^\d{10}$/.test(cleanId)) {
        return 'La cédula debe tener exactamente 10 dígitos'
    }
    
    // Los dos primeros dígitos no pueden ser 00
    if (cleanId.substring(0, 2) === '00') {
        return 'Los dos primeros dígitos no pueden ser 00'
    }
    
    // Validar provincia (01-24, excepto 30 que es para personas naturales)
    const province = parseInt(cleanId.substring(0, 2))
    if (province < 1 || province > 24) {
        return 'Código de provincia inválido'
    }
    
    // Algoritmo de validación de cédula ecuatoriana
    const digits = cleanId.split('').map(Number)
    const provinceCode = digits[0] * 10 + digits[1]
    const thirdDigit = digits[2]
    
    // El tercer dígito debe ser 0-5 (0-9 para personas naturales, 6 para sociedades públicas)
    if (thirdDigit < 0 || thirdDigit > 5) {
        return 'Tercer dígito inválido'
    }
    
    // Calcular dígito verificador
    const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    let sum = 0
    
    for (let i = 0; i < 9; i++) {
        let product = digits[i] * coefficients[i]
        if (product >= 10) {
            product = product - 9
        }
        sum += product
    }
    
    const remainder = sum % 10
    const calculatedVerifier = remainder === 0 ? 0 : 10 - remainder
    const actualVerifier = digits[9]
    
    if (calculatedVerifier !== actualVerifier) {
        return 'Cédula inválida - dígito verificador incorrecto'
    }
    
    return true
}

const identificationRules = [
    ecuadorianIdRule,
    maxLengthRule(20)
]

const nameRules = [
    requiredRule,
    minLengthRule(2),
    maxLengthRule(100)
]

const emailRules = [
    requiredRule,
    emailRule,
    maxLengthRule(150)
]

const phoneRules = [
    maxLengthRule(20)
]

const positionRules = [
    requiredRule,
    minLengthRule(2),
    maxLengthRule(100)
]

const salaryRules = [
    requiredRule,
    numericRule,
    minValueRule(0),
    maxValueRule(99999999.99)
]

const hiredAtRules = [
    requiredRule
]

// Métodos
const resetEmployeeForm = () => {
    employeeForm.value = {
        identification: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        position: '',
        salary: 0,
        hired_at: null
    }
    if (employeeFormRef.value) {
        employeeFormRef.value.reset()
    }
}

const saveEmployee = async () => {
    if (employeeFormRef.value && typeof employeeFormRef.value.validate === 'function') {
        const valid = await employeeFormRef.value.validate()
        if (!valid.valid) {
            showNotification('Por favor, completa todos los campos obligatorios', 'warning')
            return
        }
    }

    try {
        loader.start()
        
        const response = await $api('employees', {
            method: 'POST',
            body: JSON.stringify({
                identification: employeeForm.value.identification.trim(),
                first_name: employeeForm.value.first_name.trim(),
                last_name: employeeForm.value.last_name.trim(),
                email: employeeForm.value.email.trim(),
                phone: employeeForm.value.phone ? employeeForm.value.phone.trim() : null,
                position: employeeForm.value.position.trim(),
                salary: parseFloat(employeeForm.value.salary),
                hired_at: employeeForm.value.hired_at
            })
        })

        if (response.status === 201) {
            showNotification('Empleado creado exitosamente', 'success')
            
            // Cerrar diálogo
            emit('update:modelValue', false)
            
            // Emitir evento de empleado creado
            emit('employee-created', response.employee)
            
            // Resetear formulario
            resetEmployeeForm()
        }
    } catch (error) {
        console.error('Error al crear empleado:', error)
        showNotification('Error al crear empleado', 'error')
    } finally {
        loader.stop()
    }
}

const closeDialog = () => {
    emit('update:modelValue', false)
    resetEmployeeForm()
}

// Watcher para resetear formulario cuando se cierra el diálogo
watch(() => props.modelValue, (newValue) => {
    if (!newValue) {
        resetEmployeeForm()
    }
})
</script>

<template>
    <VDialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="800">
        <VCard>
            <VCardTitle class="text-h5 pa-4">
                <VIcon icon="ri-user-add-line" class="mr-2" />
                Crear Nuevo Empleado
            </VCardTitle>
            <VDivider />
            
            <VCardText class="pa-4">
                <VForm ref="employeeFormRef" @submit.prevent="saveEmployee">
                    <!-- Información Personal -->
                    <div class="mb-4">
                        <h3 class="text-h6 font-weight-medium mb-3">Información Personal</h3>
                        <VRow>
                            <VCol cols="12" md="6">
                                <VTextField v-model="employeeForm.identification" :rules="identificationRules"
                                    label="Cédula" placeholder="Ej. 1710034065" variant="outlined"
                                    density="comfortable" prepend-inner-icon="ri-id-card-line" hide-details="auto"
                                    required />
                            </VCol>

                            <VCol cols="12" md="6">
                                <VTextField v-model="employeeForm.first_name" :rules="nameRules" label="Nombres"
                                    placeholder="Ej. JUAN CARLOS" variant="outlined" density="comfortable"
                                    prepend-inner-icon="ri-user-line" hide-details="auto" required />
                            </VCol>

                            <VCol cols="12" md="6">
                                <VTextField v-model="employeeForm.last_name" :rules="nameRules" label="Apellidos"
                                    placeholder="Ej. PÉREZ GARCÍA" variant="outlined" density="comfortable"
                                    prepend-inner-icon="ri-user-line" hide-details="auto" required />
                            </VCol>

                            <VCol cols="12" md="6">
                                <VTextField v-model="employeeForm.email" :rules="emailRules" label="Email"
                                    placeholder="Ej. juan.perez@empresa.com" variant="outlined" density="comfortable"
                                    prepend-inner-icon="ri-mail-line" hide-details="auto" required type="email" />
                            </VCol>

                            <VCol cols="12" md="6">
                                <VTextField v-model="employeeForm.phone" :rules="phoneRules" label="Teléfono"
                                    placeholder="Ej. +57 300 123 4567" variant="outlined" density="comfortable"
                                    prepend-inner-icon="ri-phone-line" hide-details="auto" />
                            </VCol>

                            <VCol cols="12" md="6">
                                <VTextField v-model="employeeForm.position" :rules="positionRules" label="Cargo"
                                    placeholder="Ej. DESARROLLADOR SENIOR" variant="outlined" density="comfortable"
                                    prepend-inner-icon="ri-briefcase-line" hide-details="auto" required />
                            </VCol>
                        </VRow>
                    </div>

                    <!-- Información Laboral -->
                    <div class="mb-4">
                        <h3 class="text-h6 font-weight-medium mb-3">Información Laboral</h3>
                        <VRow>
                            <VCol cols="12" md="6">
                                <VTextField v-model="employeeForm.salary" :rules="salaryRules" label="Salario"
                                    placeholder="0.00" variant="outlined" density="comfortable"
                                    prepend-inner-icon="ri-money-dollar-circle-line" hide-details="auto" type="number"
                                    step="0.01" min="0" required />
                            </VCol>

                            <VCol cols="12" md="6">
                                <VTextField v-model="employeeForm.hired_at" :rules="hiredAtRules" label="Fecha de Contratación"
                                    variant="outlined" density="comfortable" prepend-inner-icon="ri-calendar-line"
                                    hide-details="auto" type="date" required />
                            </VCol>
                        </VRow>
                    </div>
                </VForm>
            </VCardText>

            <VDivider />
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn variant="text" @click="closeDialog">
                    Cancelar
                </VBtn>
                <VBtn color="primary" variant="elevated" @click="saveEmployee" prepend-icon="ri-save-3-line">
                    Crear Empleado
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
/* Estilos específicos si son necesarios */
</style>
