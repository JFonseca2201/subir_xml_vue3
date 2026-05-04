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
    },
    employee: {
        type: Object,
        default: () => ({})
    }
})

// Emits
const emit = defineEmits(['update:modelValue', 'employee-deleted'])

// Estado
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Métodos
const confirmDelete = async () => {
    if (!props.employee?.id) return

    try {
        loader.start()
        
        await $api(`employees/${props.employee.id}`, {
            method: 'DELETE'
        })

        showNotification('Empleado eliminado exitosamente', 'success')
        
        // Cerrar diálogo
        emit('update:modelValue', false)
        
        // Emitir evento de empleado eliminado
        emit('employee-deleted', props.employee)
        
    } catch (error) {
        console.error('Error al eliminar empleado:', error)
        showNotification('Error al eliminar empleado', 'error')
    } finally {
        loader.stop()
    }
}

const closeDialog = () => {
    emit('update:modelValue', false)
}
</script>

<template>
    <VDialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="400">
        <VCard>
            <VCardTitle class="text-h5 d-flex align-center">
                <VIcon icon="ri-delete-bin-line" class="mr-2" />
                Confirmar Eliminación
            </VCardTitle>
            <VDivider />
            
            <VCardText>
                ¿Está seguro que desea eliminar al empleado
                <strong>{{ employee?.first_name }} {{ employee?.last_name }}</strong>?
                <br><br>
                <small class="text-warning">
                    <VIcon icon="ri-information-line" />
                    El empleado será marcado como inactivo pero no se eliminará permanentemente.
                </small>
            </VCardText>

            <VDivider />
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn variant="text" @click="closeDialog">
                    Cancelar
                </VBtn>
                <VBtn color="error" variant="elevated" @click="confirmDelete" prepend-icon="ri-delete-bin-line">
                    Eliminar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
/* Estilos específicos si son necesarios */
</style>
