<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    employeeData: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:isDialogVisible'])

// Computed properties para mostrar datos formateados
const getFullName = computed(() => {
    if (props.employeeData && props.employeeData.name && props.employeeData.surname) {
        return `${props.employeeData.name} ${props.employeeData.surname}`
    }
    return 'N/A'
})

const getEmployeeStatus = computed(() => {
    if (props.employeeData && props.employeeData.status !== undefined) {
        return props.employeeData.status === 1 ? 'Activo' : 'Inactivo'
    }
    return 'N/A'
})

const getStatusColor = computed(() => {
    if (props.employeeData && props.employeeData.status !== undefined) {
        return props.employeeData.status === 1 ? 'success' : 'error'
    }
    return 'grey'
})

const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '$0.00'
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(amount)
}

const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString('es-EC', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    } catch (error) {
        return dateString
    }
}

const getGenderText = (gender) => {
    if (!gender) return 'N/A'
    return gender === '1' ? 'Masculino' : gender === '2' ? 'Femenino' : 'N/A'
}

// Cerrar diálogo
const closeDialog = () => {
    emit('update:isDialogVisible', false)
}
</script>

<template>
    <VDialog max-width="700" v-model="props.isDialogVisible" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-user-3-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Detalles del Empleado</h4>
                <p class="text-body-2 text-medium-emphasis">
                    Información completa del empleado
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Contenido -->
            <VCardText>
                <VRow>
                    <!-- Foto y Nombre Principal -->
                    <VCol cols="12" class="text-center mb-4">
                        <VAvatar size="80" color="primary" class="mb-3">
                            <VIcon size="40" icon="ri-user-3-line" />
                        </VAvatar>
                        <h3 class="text-h5 font-weight-bold mb-2">
                            {{ getFullName }}
                        </h3>
                        <div class="d-flex justify-center gap-2 mb-2">
                            <VChip :color="getStatusColor" size="small" variant="tonal">
                                {{ getEmployeeStatus }}
                            </VChip>
                            <VChip :color="getPaymentTypeColor" size="small" variant="tonal">
                                {{ employeeData.type_payment || 'N/A' }}
                            </VChip>
                        </div>
                        <p class="text-body-2 text-medium-emphasis">
                            {{ employeeData.position || 'N/A' }} · {{ employeeData.department || 'N/A' }}
                        </p>
                    </VCol>

                    <VDivider class="my-4" />

                    <!-- Información Personal -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Información Personal</h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Nombre Completo</div>
                            <div class="text-body-1 font-weight-medium">{{ getFullName }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Género</div>
                            <div class="text-body-1 font-weight-medium">{{ getGenderText(employeeData.gender) }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Teléfono</div>
                            <div class="text-body-1 font-weight-medium">{{ employeeData.phone || 'N/A' }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Email</div>
                            <div class="text-body-1 font-weight-medium">{{ employeeData.email || 'N/A' }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Fecha de Nacimiento</div>
                            <div class="text-body-1 font-weight-medium">{{ formatDate(employeeData.birth_date) }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Dirección</div>
                            <div class="text-body-1 font-weight-medium">{{ employeeData.address || 'N/A' }}</div>
                        </div>
                    </VCol>

                    <VDivider class="my-4" />

                    <!-- Información Laboral -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Información Laboral</h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Cargo</div>
                            <div class="text-body-1 font-weight-medium">{{ employeeData.position || 'N/A' }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Departamento</div>
                            <div class="d-flex align-center gap-2">
                                <VChip :color="getDepartmentColor" size="small" variant="tonal">
                                    {{ employeeData.department || 'N/A' }}
                                </VChip>
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Salario</div>
                            <div class="text-h6 font-weight-bold text-success">
                                {{ formatCurrency(employeeData.salary) }}
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Tipo de Pago</div>
                            <div class="d-flex align-center gap-2">
                                <VChip :color="getPaymentTypeColor" size="small" variant="tonal">
                                    {{ employeeData.type_payment || 'N/A' }}
                                </VChip>
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Fecha de Contratación</div>
                            <div class="text-body-1 font-weight-medium">{{ formatDate(employeeData.hire_date) }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Cuenta Bancaria</div>
                            <div class="text-body-1 font-weight-medium">{{ employeeData.bank_account || 'N/A' }}</div>
                        </div>
                    </VCol>

                    <VDivider class="my-4" />

                    <!-- Información del Sistema -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Información del Sistema</h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">ID del Empleado</div>
                            <div class="text-body-1 font-weight-medium">#{{ employeeData.id || 'N/A' }}</div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <div class="mb-3">
                            <div class="text-caption text-medium-emphasis mb-1">Estado</div>
                            <div class="d-flex align-center gap-2">
                                <VChip :color="getStatusColor" size="small" variant="tonal">
                                    {{ getEmployeeStatus }}
                                </VChip>
                            </div>
                        </div>
                    </VCol>
                </VRow>
            </VCardText>

            <VDivider class="mt-6" />

            <!-- Actions -->
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" @click="closeDialog">
                    Cerrar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
.v-card-title {
    border-radius: 12px 12px 0 0;
}

.text-h6 {
    color: #1976D2;
    border-bottom: 2px solid #1976D2;
    padding-bottom: 8px;
    margin-bottom: 16px;
}

.v-avatar {
    background: linear-gradient(135deg, #1976D2 0%, #42A5F5 100%);
}
</style>
