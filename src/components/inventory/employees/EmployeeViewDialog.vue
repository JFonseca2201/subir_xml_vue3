<script setup>
import { ref, watch } from 'vue'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    employee: {
        type: Object,
        default: () => ({})
    }
})

// Emits
const emit = defineEmits(['update:modelValue'])

// Estado
const loading = ref(false)
const employeeData = ref({
    id: null,
    identification: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    salary: 0,
    hired_at: null,
    created_at: null,
    updated_at: null,
    creator: null,
    deleted_at: null
})

// Métodos
const loadEmployeeDetails = async () => {
    if (!props.employee?.id) return

    try {
        loading.value = true
        
        const response = await $api(`employees/${props.employee.id}`)
        
        if (response.status === 200) {
            employeeData.value = response.employee
        }
    } catch (error) {
        console.error('Error al cargar detalles del empleado:', error)
    } finally {
        loading.value = false
    }
}

const formatSalary = (salary) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
    }).format(salary)
}

const formatDate = (dateString) => {
    if (!dateString) return 'No disponible'
    
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    } catch (error) {
        return dateString
    }
}

const formatDateTime = (dateString) => {
    if (!dateString) return 'No disponible'
    
    try {
        const date = new Date(dateString)
        return date.toLocaleString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    } catch (error) {
        return dateString
    }
}

const getStatusColor = (deletedAt) => {
    return deletedAt ? 'error' : 'success'
}

const getStatusText = (deletedAt) => {
    return deletedAt ? 'Inactivo' : 'Activo'
}

const closeDialog = () => {
    emit('update:modelValue', false)
}

// Watchers
watch(() => props.modelValue, (newValue) => {
    if (newValue && props.employee) {
        loadEmployeeDetails()
    }
})

watch(() => props.employee, () => {
    if (props.modelValue && props.employee) {
        loadEmployeeDetails()
    }
}, { deep: true })
</script>

<template>
    <VDialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="700">
        <VCard>
            <VCardTitle class="text-h5 pa-4 d-flex align-center">
                <VIcon icon="ri-user-line" class="mr-2" />
                Detalles del Empleado
            </VCardTitle>
            <VDivider />
            
            <VCardText class="pa-4">
                <VProgressCircular v-if="loading" indeterminate color="primary" class="d-block mx-auto my-4" />
                
                <div v-else>
                    <!-- Información Personal -->
                    <div class="mb-6">
                        <h3 class="text-h6 font-weight-medium mb-3 d-flex align-center">
                            <VIcon icon="ri-user-line" class="mr-2" />
                            Información Personal
                        </h3>
                        <VRow>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Cédula:</span>
                                    <div class="font-weight-medium">{{ employeeData.identification || 'No disponible' }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Nombre Completo:</span>
                                    <div class="font-weight-medium">
                                        {{ employeeData.first_name || '' }} {{ employeeData.last_name || '' }}
                                    </div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Email:</span>
                                    <div class="font-weight-medium">{{ employeeData.email || 'No disponible' }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Teléfono:</span>
                                    <div class="font-weight-medium">{{ employeeData.phone || 'No disponible' }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Estado:</span>
                                    <div>
                                        <VChip :color="getStatusColor(employeeData.deleted_at)" variant="tonal" size="small">
                                            {{ getStatusText(employeeData.deleted_at) }}
                                        </VChip>
                                    </div>
                                </div>
                            </VCol>
                        </VRow>
                    </div>

                    <!-- Información Laboral -->
                    <div class="mb-6">
                        <h3 class="text-h6 font-weight-medium mb-3 d-flex align-center">
                            <VIcon icon="ri-briefcase-line" class="mr-2" />
                            Información Laboral
                        </h3>
                        <VRow>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Cargo:</span>
                                    <div class="font-weight-medium">{{ employeeData.position || 'No disponible' }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Salario:</span>
                                    <div class="font-weight-medium text-success">
                                        {{ formatSalary(employeeData.salary) }}
                                    </div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Fecha de Contratación:</span>
                                    <div class="font-weight-medium">{{ formatDate(employeeData.hired_at) }}</div>
                                </div>
                            </VCol>
                        </VRow>
                    </div>

                    <!-- Información del Sistema -->
                    <div class="mb-6">
                        <h3 class="text-h6 font-weight-medium mb-3 d-flex align-center">
                            <VIcon icon="ri-settings-line" class="mr-2" />
                            Información del Sistema
                        </h3>
                        <VRow>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">ID de Empleado:</span>
                                    <div class="font-weight-medium">#{{ employeeData.id || 'No disponible' }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Registrado por:</span>
                                    <div class="font-weight-medium">
                                        {{ employeeData.creator?.name || 'No disponible' }}
                                    </div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Fecha de Creación:</span>
                                    <div class="font-weight-medium">{{ formatDateTime(employeeData.created_at) }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Última Actualización:</span>
                                    <div class="font-weight-medium">{{ formatDateTime(employeeData.updated_at) }}</div>
                                </div>
                            </VCol>
                            <VCol v-if="employeeData.deleted_at" cols="12">
                                <div class="mb-3">
                                    <span class="text-caption text-medium-emphasis">Fecha de Eliminación:</span>
                                    <div class="font-weight-medium text-error">
                                        {{ formatDateTime(employeeData.deleted_at) }}
                                    </div>
                                </div>
                            </VCol>
                        </VRow>
                    </div>
                </div>
            </VCardText>

            <VDivider />
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn variant="text" @click="closeDialog">
                    Cerrar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
/* Estilos específicos si son necesarios */
</style>
