<script setup>
import { ref, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['update:modelValue', 'transferred'])

// Estado
const formRef = ref(null)
const loading = ref(false)
const accounts = ref([])
const { showNotification } = useGlobalToast()

const form = ref({
    source_account_id: null,
    destination_account_id: null,
    amount: null,
    description: '',
    transfer_date: new Date().toISOString().split('T')[0]
})

// Computed
const show = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// Cargar cuentas desde la API
const loadAccounts = async () => {
    try {
        const response = await $api('accounts')
        accounts.value = (response || []).map(account => ({
            ...account,
            display_name: `${account.bank_name} (${account.name})`
        }))
    } catch (error) {
        console.error('Error al cargar cuentas:', error)
        showNotification('Error al cargar la lista de cuentas', 'error')
    }
}

const resetForm = () => {
    form.value = {
        source_account_id: null,
        destination_account_id: null,
        amount: null,
        description: '',
        transfer_date: new Date().toISOString().split('T')[0]
    }
    if (formRef.value) formRef.value.resetValidation()
}

const closeDialog = () => {
    show.value = false
    setTimeout(resetForm, 200)
}

const handleSubmit = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return

    if (form.value.source_account_id === form.value.destination_account_id) {
        showNotification('La cuenta de origen y destino no pueden ser la misma', 'warning')
        return
    }

    loading.value = true

    try {
        // TODO: Ajusta este endpoint según la ruta de tu API en Laravel
        const response = await $api('transfers', {
            method: 'POST',
            body: form.value
        })

        showNotification('Transferencia realizada exitosamente', 'success')
        emit('transferred', response)
        closeDialog()
    } catch (error) {
        console.error('Error al realizar transferencia:', error)
        showNotification(error?.data?.message || 'Error al procesar la transferencia', 'error')
    } finally {
        loading.value = false
    }
}

watch(() => show.value, (newVal) => {
    if (newVal) {
        resetForm()
        loadAccounts()
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
                        <VIcon icon="ri-arrow-left-right-line" color="primary" size="28" />
                        <div>
                            <h3 class="text-h5 font-weight-bold">Transferencia entre Cuentas</h3>
                            <span class="text-medium-emphasis text-body-2">
                                Mueve fondos de una cuenta a otra
                            </span>
                        </div>
                    </div>
                    <VBtn icon="ri-close-line" variant="text" size="small" @click="closeDialog" :disabled="loading" />
                </div>
            </VCardTitle>

            <VDivider />

            <!-- Formulario -->
            <VCardText class="pa-6">
                <VForm ref="formRef" @submit.prevent="handleSubmit">
                    <VRow>
                        <VCol cols="12" md="6">
                            <VSelect v-model="form.source_account_id" :items="accounts" item-value="id"
                                item-title="display_name" label="Cuenta Origen *" placeholder="Desde dónde"
                                :rules="[v => !!v || 'Requerido']" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-bank-card-line" />
                            <VSelect v-model="form.source_account_id" :items="accounts" item-value="id"
                                item-title="display_name" label="Cuenta Origen *" placeholder="Desde dónde"
                                :rules="[v => !!v || 'Requerido']" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-bank-card-line" />
                        </VCol>
                        <VCol cols="12" md="6">
                            <VSelect v-model="form.destination_account_id" :items="accounts" item-value="id"
                                item-title="display_name" label="Cuenta Destino *" placeholder="Hacia dónde"
                                :rules="[v => !!v || 'Requerido', v => v !== form.source_account_id || 'Debe ser diferente al origen']"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-bank-card-fill" />
                            <VSelect v-model="form.destination_account_id" :items="accounts" item-value="id"
                                item-title="display_name" label="Cuenta Destino *" placeholder="Hacia dónde"
                                :rules="[v => !!v || 'Requerido', v => v !== form.source_account_id || 'Debe ser diferente al origen']"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-bank-card-fill" />
                        </VCol>
                        <VCol cols="12" md="6">
                            <VTextField v-model="form.amount" label="Monto a Transferir *" placeholder="0.00"
                                type="number" prefix="$"
                                :rules="[v => !!v || 'Requerido', v => v > 0 || 'El monto debe ser mayor a 0']"
                                variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-money-dollar-circle-line" />
                            <VTextField v-model="form.amount" label="Monto a Transferir *" placeholder="0.00"
                                type="number" prefix="$"
                                :rules="[v => !!v || 'Requerido', v => v > 0 || 'El monto debe ser mayor a 0']"
                                variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-money-dollar-circle-line" />
                        </VCol>
                        <VCol cols="12" md="6">
                            <VTextField v-model="form.transfer_date" label="Fecha *" type="date"
                                :rules="[v => !!v || 'Requerido']" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-calendar-line" />
                            <VTextField v-model="form.transfer_date" label="Fecha *" type="date"
                                :rules="[v => !!v || 'Requerido']" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-calendar-line" />
                        </VCol>
                        <VCol cols="12">
                            <VTextarea v-model="form.description" label="Motivo / Descripción *"
                                placeholder="Ej. Reposición de caja chica..." rows="3" variant="outlined"
                                density="comfortable" no-resize :rules="[v => !!v || 'Requerido']">
                                <template #prepend-inner>
                                    <VIcon color="primary" size="20">ri-article-line</VIcon>
                                </template>
                            </VTextarea>
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>

            <VDivider />

            <!-- Footer -->
            <VCardActions class="pa-6 d-flex justify-end">
                <VSpacer />
                <VBtn variant="outlined" prepend-icon="ri-close-line" @click="closeDialog" :disabled="loading">
                    Cancelar
                </VBtn>

                <VBtn color="primary" variant="elevated" prepend-icon="ri-check-line" @click="handleSubmit"
                    :loading="loading">
                    Confirmar Transferencia
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>
