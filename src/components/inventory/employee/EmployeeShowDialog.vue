<script setup>
import { defineEmits, defineProps } from 'vue'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    employeeData: {
        type: Object,
        required: false,
        default: () => ({}),
    },
})

const emit = defineEmits(['update:isDialogVisible'])

const closeDialog = () => {
    emit('update:isDialogVisible', false)
}

// --- FUNCIONES DE AYUDA (Para evitar errores de renderizado) ---

const formatCurrency = amount => {
    const value = Number(amount || 0)
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD',
    }).format(value)
}

const getStatusColor = status => {
    const colors = {
        pending: 'warning',
        approved: 'success',
        rejected: 'error',
        active: 'success',
        inactive: 'secondary',
    }
    return colors[status] || 'grey'
}

const getStatusText = status => {
    const texts = {
        pending: 'Pendiente',
        approved: 'Aprobado',
        rejected: 'Rechazado',
        active: 'Activo',
        inactive: 'Inactivo',
    }
    return texts[status] || 'Desconocido'
}

const getPaymentTypeColor = type => {
    const colors = {
        cash: 'success',
        transfer: 'primary',
        check: 'info',
    }
    return colors[type] || 'grey'
}

const getPaymentTypeText = type => {
    const types = {
        cash: 'Efectivo',
        transfer: 'Transferencia',
        check: 'Cheque',
    }
    return types[type] || 'Desconocido'
}

const getDepartmentColor = department => {
    return 'primary'
}
</script>

<template>
    <VDialog :model-value="props.isDialogVisible" max-width="700"
        @update:model-value="val => emit('update:isDialogVisible', val)">
        <VCard v-if="props.employeeData" class="pa-sm-8 pa-4">
            <DialogCloseBtn @click="closeDialog" />

            <VCardText>
                <VRow>
                    <VCol cols="12" class="text-center mb-4">
                        <VAvatar size="100" color="primary" variant="tonal" class="mb-4">
                            <VIcon icon="ri-user-3-line" size="50" />
                        </VAvatar>
                        <h3 class="text-h5 font-weight-bold text-uppercase">
                            {{ props.employeeData.name }} {{ props.employeeData.surname }}
                        </h3>
                        <VChip :color="getStatusColor(props.employeeData.status === 1 ? 'active' : 'inactive')"
                            size="small" class="mt-2">
                            {{ props.employeeData.status === 1 ? 'ACTIVO' : 'INACTIVO' }}
                        </VChip>
                    </VCol>

                    <VDivider class="my-4" />

                    <VCol cols="12">
                        <p class="text-overline mb-2 text-primary">Información General</p>
                        <VRow>
                            <VCol cols="12" md="6">
                                <div class="d-flex align-center mb-2">
                                    <VIcon icon="ri-briefcase-line" size="20" class="me-2 text-medium-emphasis" />
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Cargo</div>
                                        <div class="font-weight-medium text-uppercase">{{ props.employeeData.position ||
                                            'No definido' }}</div>
                                    </div>
                                </div>
                            </VCol>

                            <VCol cols="12" md="6">
                                <div class="d-flex align-center mb-2">
                                    <VIcon icon="ri-id-card-line" size="20" class="me-2 text-medium-emphasis" />
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Identificación</div>
                                        <div class="font-weight-medium">{{ props.employeeData.dni }}</div>
                                    </div>
                                </div>
                            </VCol>

                            <VCol cols="12" md="6">
                                <div class="d-flex align-center mb-2">
                                    <VIcon icon="ri-map-pin-line" size="20" class="me-2 text-medium-emphasis" />
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Sucursal</div>
                                        <div class="font-weight-medium text-uppercase text-truncate"
                                            style="max-width: 200px;">
                                            {{ props.employeeData.sucursal?.name }}
                                        </div>
                                    </div>
                                </div>
                            </VCol>

                            <VCol cols="12" md="6">
                                <div class="d-flex align-center mb-2">
                                    <VIcon icon="ri-calendar-line" size="20" class="me-2 text-medium-emphasis" />
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Fecha de Ingreso</div>
                                        <div class="font-weight-medium">{{ props.employeeData.hire_date }}</div>
                                    </div>
                                </div>
                            </VCol>
                        </VRow>
                    </VCol>

                    <VDivider class="my-4" />

                    <VCol cols="12">
                        <p class="text-overline mb-2 text-success">Datos de Pago</p>
                        <VRow>
                            <VCol cols="12" md="6">
                                <div class="d-flex align-center mb-2">
                                    <VIcon icon="ri-bank-line" size="20" class="me-2 text-success" />
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Banco</div>
                                        <div class="font-weight-medium text-uppercase">{{ props.employeeData.bank_name
                                        }}</div>
                                    </div>
                                </div>
                            </VCol>

                            <VCol cols="12" md="6">
                                <div class="d-flex align-center mb-2">
                                    <VIcon icon="ri-wallet-3-line" size="20" class="me-2 text-success" />
                                    <div>
                                        <div class="text-caption text-medium-emphasis">Número de Cuenta</div>
                                        <div class="font-weight-medium">{{ props.employeeData.account_number || 'S/N' }}
                                        </div>
                                    </div>
                                </div>
                            </VCol>

                            <VCol cols="12" md="6">
                                <VCard variant="tonal" color="warning" class="pa-3 rounded-lg">
                                    <div class="text-caption">Adelantos Pendientes</div>
                                    <div class="text-h6 font-weight-bold">
                                        {{ formatCurrency(props.employeeData.pending_advances) }}
                                    </div>
                                </VCard>
                            </VCol>
                        </VRow>
                    </VCol>
                </VRow>
            </VCardText>

            <VCardActions class="justify-center mt-4">
                <VBtn color="secondary" variant="outlined" @click="closeDialog">
                    Cerrar Detalle
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>