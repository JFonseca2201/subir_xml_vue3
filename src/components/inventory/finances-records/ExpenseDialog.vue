<script setup>
import { ref, watch } from 'vue'
import { showNotification } from '@/utils/notifications'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    editingMovement: {
        type: Object,
        default: null
    }
})

const emit = defineEmits(['update:modelValue', 'saved'])

// Form data
const form = ref({
    type: 1, // TYPE_EXPENSE
    account_id: 1, // ACCOUNT_CASH
    payment_method: 'cash',
    amount: '',
    work_order_number: '',
    invoice_number: '',
    description: '',
    entry_date: new Date().toISOString().split('T')[0]
})

// Account options
const accountOptions = ref([])

// Load accounts from API
const loadAccounts = async () => {
    try {
        const response = await $api('accounts')
        accountOptions.value = response.map(account => ({
            title: account.name,
            value: account.id
        }))
    } catch (error) {
        console.error('Error al cargar cuentas:', error)
        showNotification('Error al cargar cuentas', 'error')
    }
}

onMounted(() => {
    loadAccounts()
})

// Watch for editing movement
watch(() => props.editingMovement, (newVal) => {
    if (newVal) {
        form.value = {
            type: newVal.type,
            account_id: newVal.account_id,
            payment_method: newVal.payment_method,
            amount: newVal.amount.toString(),
            work_order_number: newVal.work_order_number || '',
            invoice_number: newVal.invoice_number || '',
            description: newVal.description || '',
            entry_date: new Date(newVal.entry_date).toISOString().split('T')[0]
        }
    } else {
        resetForm()
    }
})

const resetForm = () => {
    form.value = {
        type: 1,
        account_id: 1,
        payment_method: 'cash',
        amount: '',
        work_order_number: '',
        invoice_number: '',
        description: '',
        entry_date: new Date().toISOString().split('T')[0]
    }
}

const closeDialog = () => {
    emit('update:modelValue', false)
}

const saveExpense = async () => {
    try {
        const payload = { ...form.value }

        emit('saved', payload)
        closeDialog()
        resetForm() // Limpiar formulario después de guardar

        showNotification('Egreso guardado exitosamente', 'success')
    } catch (error) {
        console.error('Error al guardar egreso:', error)
        showNotification('Error al guardar egreso', 'error')
    }
}

const openDialog = () => {
    emit('update:modelValue', true)
}
</script>

<template>
    <VDialog :model-value="props.modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600"
        persistent>
        <VCard>
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center gap-2">
                    <VIcon color="error" size="24">ri-arrow-down-circle-line</VIcon>
                    <span>{{ props.editingMovement ? 'Editar Egreso' : 'Nuevo Egreso' }}</span>
                </div>
            </VCardTitle>
            <VDivider />
            <VCardText class="pa-4">
                <VForm @submit.prevent="saveExpense">
                    <VRow>
                        <VCol cols="6">
                            <VTextField v-model="form.invoice_number" label="Número de Factura" placeholder="FAC-001" />
                        </VCol>
                        <VCol cols="6">
                            <VTextField v-model="form.amount" label="Monto" type="number" prefix="$" placeholder="0.00"
                                required />
                        </VCol>
                        <VCol cols="12">
                            <VSelect v-model="form.account_id" label="Cuenta" :items="accountOptions" item-title="title"
                                item-value="value" required />
                        </VCol>


                        <VCol cols="12">
                            <VTextField v-model="form.entry_date" label="Fecha" type="date" required />
                        </VCol>
                        <VCol cols="12">
                            <VTextField v-model="form.description" label="Descripción"
                                placeholder="Describe el egreso..." required />
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>
            <VDivider />
            <VCardActions class="pa-4 d-flex justify-end">
                <VBtn variant="outlined" @click="closeDialog">
                    Cancelar
                </VBtn>
                <VBtn color="error" @click="saveExpense">
                    {{ props.editingMovement ? 'Actualizar' : 'Guardar' }}
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>
