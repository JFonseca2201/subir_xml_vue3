<script setup>
import { ref, computed, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    accountData: {
        type: Object,
        default: null
    }
})

// Emits
const emit = defineEmits(['update:modelValue', 'accountCreated', 'accountUpdated'])

// Loader y notificaciones
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Estado del formulario
const formRef = ref(null)
const isEditing = computed(() => !!props.accountData)

// Opciones de tipo de cuenta
const accountTypes = [
    { title: 'Cuenta Bancaria', value: 'bank' },
    { title: 'Caja de Efectivo', value: 'cash' }
]

// Formulario
const accountForm = ref({
    code: '',
    name: '',
    type: 'bank',
    bank_name: '',
    initial_balance: 0,
    is_active: true,
    is_system: false
})

// Reglas de validación
const rules = {
    code: [
        v => !!v || 'El código es requerido',
        v => (v && v.length >= 3) || 'El código debe tener al menos 3 caracteres'
    ],
    name: [
        v => !!v || 'El nombre es requerido',
        v => (v && v.length >= 3) || 'El nombre debe tener al menos 3 caracteres'
    ],
    type: [
        v => !!v || 'El tipo de cuenta es requerido'
    ],
    bank_name: [
        v => accountForm.value.type === 'bank' ? !!v || 'El nombre del banco es requerido' : true
    ],
    initial_balance: [
        v => v !== null && v !== '' || 'El saldo inicial es requerido',
        v => !isNaN(v) || 'El saldo debe ser un número válido'
    ]
}

// Computed para verificar si es sistema
const isSystemAccount = computed(() => {
    return props.accountData?.is_system || false
})

// Transformar a mayúsculas y limpiar espacios
const transformToUppercase = (field) => {
    if (accountForm.value[field]) {
        accountForm.value[field] = accountForm.value[field].toUpperCase().trim()
    }
}

// Resetear formulario
const resetForm = () => {
    accountForm.value = {
        code: '',
        name: '',
        type: 'bank',
        bank_name: '',
        initial_balance: 0,
        is_active: true,
        is_system: false
    }
    formRef.value?.resetValidation()
}

// Watch para cambios en accountData (después de definir resetForm)
watch(() => props.accountData, (newData) => {
    if (newData) {
        accountForm.value = {
            code: newData.code || '',
            name: newData.name || '',
            type: newData.type || 'bank',
            bank_name: newData.bank_name || '',
            initial_balance: newData.initial_balance || 0,
            is_active: newData.is_active ?? true,
            is_system: newData.is_system || false
        }
    } else {
        resetForm()
    }
}, { immediate: true })

// Watch para tipo de cuenta
watch(() => accountForm.value.type, (newType) => {
    if (newType === 'cash') {
        accountForm.value.bank_name = ''
    }
})

// Cerrar diálogo
const closeDialog = () => {
    emit('update:modelValue', false)
    resetForm()
}

// Guardar cuenta
const saveAccount = async () => {
    const { valid } = await formRef.value?.validate()

    if (!valid) {
        showNotification('Por favor, completa todos los campos requeridos', 'error')
        return
    }

    loader.start()

    try {
        // Transformar campos a mayúsculas y limpiar espacios
        const formData = {
            ...accountForm.value,
            name: accountForm.value.name.toUpperCase().trim(),
            bank_name: accountForm.value.bank_name ? accountForm.value.bank_name.toUpperCase().trim() : '',
            code: accountForm.value.code.toUpperCase().trim()
        }

        let response
        if (isEditing.value) {
            response = await $api(`accounts/${props.accountData.id}`, {
                method: 'PUT',
                body: formData
            })
            showNotification('Cuenta actualizada correctamente', 'success')
            emit('accountUpdated', response)
        } else {
            response = await $api('accounts', {
                method: 'POST',
                body: formData
            })
            showNotification('Cuenta creada correctamente', 'success')
            emit('accountCreated', response)
        }

        closeDialog()
    } catch (error) {
        console.error('Error al guardar cuenta:', error)
        showNotification('Error al guardar la cuenta', 'error')
    } finally {
        loader.stop()
    }
}

// Computed para el título del diálogo
const dialogTitle = computed(() => {
    return isEditing.value ? 'Editar Cuenta' : 'Nueva Cuenta'
})
</script>

<template>
    <VDialog :model-value="modelValue" @update:model-value="closeDialog" max-width="600" persistent>
        <VCard>
            <!-- Header -->
            <VCardTitle class="pa-6 pb-4">
                <div class="d-flex align-center gap-3">
                    <VIcon :icon="isEditing ? 'ri-edit-line' : 'ri-add-circle-line'" color="primary" size="28" />
                    <div>
                        <h3 class="text-h5 font-weight-bold">{{ dialogTitle }}</h3>
                        <span class="text-medium-emphasis text-body-2">
                            {{ isEditing ? 'Modificar cuenta' : 'Completa los datos para crear una nueva cuenta' }}
                        </span>
                    </div>
                </div>
            </VCardTitle>

            <VDivider />

            <!-- Formulario -->
            <VCardText class="pa-6">
                <VForm ref="formRef" @submit.prevent="saveAccount">
                    <VRow>
                        <!-- Código -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="accountForm.code" label="Código de Cuenta" placeholder="Ej: BAN-001"
                                prepend-inner-icon="ri-hashtag" variant="outlined" density="comfortable"
                                :rules="rules.code" :disabled="isSystemAccount" @blur="transformToUppercase('code')"
                                hint="Código único para identificar la cuenta" persistent-hint>
                                <template #append-inner v-if="isSystemAccount">
                                    <VIcon icon="ri-lock-2-line" color="warning" size="16">
                                        <VTooltip text="Cuenta del sistema - no editable">
                                            <template #activator="{ props }">
                                                <VIcon v-bind="props" icon="ri-lock-2-line" />
                                            </template>
                                        </VTooltip>
                                    </VIcon>
                                </template>
                            </VTextField>
                        </VCol>

                        <!-- Nombre -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="accountForm.name" label="Nombre de la Cuenta"
                                placeholder="Ej: Cuenta Corriente" prepend-inner-icon="ri-bank-card-line"
                                variant="outlined" density="comfortable" :rules="rules.name"
                                @blur="transformToUppercase('name')" hint="Nombre descriptivo de la cuenta"
                                persistent-hint />
                        </VCol>

                        <!-- Tipo de Cuenta -->
                        <VCol cols="12" md="6">
                            <VSelect v-model="accountForm.type" :items="accountTypes" item-title="title"
                                item-value="value" label="Tipo de Cuenta" prepend-inner-icon="ri-bank-line"
                                variant="outlined" density="comfortable" :rules="rules.type" :disabled="isSystemAccount"
                                hint="Selecciona el tipo de cuenta" persistent-hint />
                        </VCol>

                        <!-- Banco (solo para tipo bancario) -->
                        <VCol cols="12" md="6" v-if="accountForm.type === 'bank'">
                            <VTextField v-model="accountForm.bank_name" label="Nombre del Banco"
                                placeholder="Ej: Banco Guayaquil" prepend-inner-icon="ri-building-line"
                                variant="outlined" density="comfortable" :rules="rules.bank_name"
                                @blur="transformToUppercase('bank_name')" hint="Nombre de la institución bancaria"
                                persistent-hint />
                        </VCol>

                        <!-- Saldo Inicial -->
                        <VCol cols="12" md="6">
                            <VTextField v-model.number="accountForm.initial_balance" label="Saldo Inicial"
                                placeholder="0.00" prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined"
                                density="comfortable" type="number" step="0.01" :rules="rules.initial_balance"
                                hint="Saldo inicial de la cuenta" persistent-hint />
                        </VCol>

                        <!-- Indicador de sistema (solo para edición) -->
                        <VCol cols="12" v-if="isEditing && isSystemAccount">
                            <VAlert type="warning" variant="tonal" class="mb-4">
                                <template #prepend>
                                    <VIcon icon="ri-lock-2-line" />
                                </template>
                                <div class="text-body-2">
                                    Esta es una cuenta del sistema. Algunos campos están deshabilitados para mantener la
                                    integridad de los
                                    datos.
                                </div>
                            </VAlert>
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>

            <VDivider />

            <!-- Acciones -->
            <VCardActions class="pa-6">
                <VSpacer />
                <VBtn variant="outlined" @click="closeDialog" :disabled="loader.loading">
                    Cancelar
                </VBtn>
                <VBtn color="primary" variant="elevated" @click="saveAccount" :loading="loader.loading"
                    prepend-icon="ri-save-line">
                    {{ isEditing ? 'Actualizar' : 'Crear' }}
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>
