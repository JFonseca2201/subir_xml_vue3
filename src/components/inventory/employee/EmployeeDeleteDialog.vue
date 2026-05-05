<script setup>
import { ref, computed } from 'vue'
import { $api } from '@/utils/api'

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

const emit = defineEmits(['update:isDialogVisible', 'deleteEmployee'])

// Estado
const loading = ref(false)
const error = ref('')
const success = ref('')

// Computed properties
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

// Eliminar empleado
const deleteEmployee = async () => {
    loading.value = true
    error.value = ''
    success.value = ''

    try {
        console.log('Eliminando empleado:', props.employeeData.id)

        const resp = await $api(`employees/${props.employeeData.id}`, {
            method: "DELETE",
            onResponseError({ response }) {
                if (response.status === 404) {
                    error.value = response._data?.message || 'Empleado no encontrado'
                } else {
                    error.value = response._data?.message || 'Error al eliminar empleado'
                }
                console.error('Error response:', response._data)
            },
        })

        console.log('Respuesta del servidor:', resp)

        if (resp.status === 200) {
            success.value = resp.data?.message || 'Empleado eliminado exitosamente'
            
            // Cerrar diálogo después de un momento
            setTimeout(() => {
                emit('update:isDialogVisible', false)
                emit('deleteEmployee', props.employeeData.id)
            }, 1500)
        } else {
            error.value = resp.data?.message || 'Error al eliminar empleado'
        }
    } catch (error) {
        console.error('Error al eliminar empleado:', error)
        error.value = 'Error al eliminar empleado. Intente nuevamente.'
    } finally {
        loading.value = false
    }
}

// Cerrar diálogo
const closeDialog = () => {
    emit('update:isDialogVisible', false)
    error.value = ''
    success.value = ''
}
</script>

<template>
    <VDialog max-width="500" v-model="props.isDialogVisible" persistent>
        <VCard class="pa-sm-8 pa-4">
            <!-- Botón cerrar -->
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <!-- Header -->
            <VCardText class="text-center pb-6">
                <VIcon icon="ri-user-unfollow-line" size="42" color="error" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Eliminar Empleado</h4>
                <p class="text-body-2 text-medium-emphasis">
                    ¿Está seguro que desea eliminar este empleado?
                </p>
            </VCardText>

            <VDivider class="mb-6" />

            <!-- Información del empleado a eliminar -->
            <VCardText class="text-center pb-6">
                <div class="mb-4">
                    <VAvatar size="60" color="error" class="mb-3">
                        <VIcon size="30" icon="ri-user-3-line" />
                    </VAvatar>
                    <h5 class="text-h5 font-weight-bold mb-2">
                        {{ getFullName }}
                    </h5>
                    <div class="text-body-2 text-medium-emphasis mb-1">
                        {{ employeeData.position || 'N/A' }}
                    </div>
                    <div class="d-flex justify-center gap-2 mb-2">
                        <VChip color="error" size="small" variant="tonal">
                            {{ getEmployeeStatus }}
                        </VChip>
                    </div>
                    <div class="text-caption text-medium-emphasis">
                        ID: #{{ employeeData.id || 'N/A' }}
                    </div>
                </div>

                <!-- Alerta de advertencia -->
                <VAlert type="warning" variant="tonal" class="mb-4">
                    <template #prepend>
                        <VIcon icon="ri-alert-line" />
                    </template>
                    <div class="text-body-2">
                        <strong>¡Advertencia!</strong> Esta acción no se puede deshacer. 
                        Al eliminar este empleado, se perderán todos sus datos del sistema.
                    </div>
                </VAlert>

                <!-- Alerta de error -->
                <VAlert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
                    {{ error }}
                </VAlert>

                <!-- Alerta de éxito -->
                <VAlert v-if="success" type="success" variant="tonal" class="mb-4" closable @click:close="success = ''">
                    {{ success }}
                </VAlert>
            </VCardText>

            <VDivider class="mt-6" />

            <!-- Actions -->
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" @click="closeDialog">
                    Cancelar
                </VBtn>
                <VBtn 
                    color="error" 
                    variant="tonal" 
                    prepend-icon="ri-delete-bin-line"
                    @click="deleteEmployee"
                    :loading="loading"
                    :disabled="loading"
                >
                    Eliminar Empleado
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
    background: linear-gradient(135deg, #f44336 0%, #e91e63 100%);
}
</style>
