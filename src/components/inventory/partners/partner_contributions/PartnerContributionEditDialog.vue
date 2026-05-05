<template>
    <VDialog v-model="isVisible" max-width="600" persistent>
        <VCard class="pa-6">
            <VCardTitle class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-edit-line" color="warning" />
                    <span class="text-h5 font-weight-bold">Editar Aporte de Socio</span>
                </div>
                <VBtn icon variant="text" @click="isVisible = false">
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VForm ref="formRef" @submit.prevent="updateContribution">
                <VRow>
                    <VCol cols="12">
                        <VSelect v-model="form.partner_id" :items="partnerOptions" item-title="full_name"
                            item-value="id" label="Socio *" prepend-inner-icon="ri-user-line" :rules="[rules.required]"
                            required placeholder="Seleccione un socio" disabled />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.amount" label="Monto del Aporte *" type="number"
                            prepend-inner-icon="ri-money-dollar-circle-line" :rules="[rules.required, rules.minAmount]"
                            required placeholder="0.00" step="0.01">
                            <template #append-inner>
                                <span class="text-medium-emphasis">USD</span>
                            </template>
                        </VTextField>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="form.contribution_date" label="Fecha del Aporte *" type="date"
                            prepend-inner-icon="ri-calendar-line" :rules="[rules.required]" required />
                    </VCol>

                    <VCol cols="12">
                        <VTextarea v-model="form.notes" label="Notas" prepend-inner-icon="ri-file-text-line"
                            placeholder="Notas adicionales sobre el aporte" rows="3" auto-grow />
                    </VCol>
                </VRow>

                <VCardActions class="mt-4">
                    <VSpacer />
                    <VBtn variant="outlined" color="secondary" @click="isVisible = false">
                        Cancelar
                    </VBtn>
                    <VBtn color="warning" variant="elevated" type="submit" :loading="loading">
                        Actualizar Aporte
                    </VBtn>
                </VCardActions>
            </VForm>
        </VCard>
    </VDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    contributionData: {
        type: Object,
        default: null
    },
    partners: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['update:modelValue', 'success'])

const { showNotification } = useGlobalToast()
const formRef = ref(null)
const loading = ref(false)

const form = ref({
    partner_id: null,
    amount: 0,
    contribution_date: '',
    notes: ''
})

const isVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const isEditing = computed(() => !!props.contributionData)

const partnerOptions = computed(() => {
    if (!props.partners || !Array.isArray(props.partners)) return []
    return props.partners.map(partner => ({
        ...partner,
        full_name: `${partner?.name || ''} ${partner?.surname || ''}`.trim()
    }))
})

const rules = {
    required: value => !!value || 'Este campo es requerido',
    minAmount: value => {
        if (!value) return true
        const num = parseFloat(value)
        if (isNaN(num)) return 'El monto debe ser un número válido'
        if (num <= 0) return 'El monto debe ser mayor a 0'
        return true
    }
}

const loadContributionData = () => {
    if (props.contributionData && props.contributionData.id) {
        form.value = {
            partner_id: props.contributionData.partner_id || '',
            amount: props.contributionData.amount || 0,
            contribution_date: props.contributionData.contribution_date ? props.contributionData.contribution_date.split('T')[0] : '',
            notes: props.contributionData.notes || ''
        }
    }
}

const updateContribution = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return

    loading.value = true
    try {
        const resp = await $api(`contributions/${props.contributionData.id}`, {
            method: 'PUT',
            body: form.value
        })

        if (resp.status >= 200 && resp.status < 300) {
            showNotification('Aporte actualizado exitosamente', 'success')
            emit('success', resp.data)
            isVisible.value = false
        }
    } catch (error) {
        console.error('Error al actualizar aporte:', error)
        showNotification('Error al actualizar el aporte', 'error')
    } finally {
        loading.value = false
    }
}

watch(() => props.modelValue, (val) => {
    if (val) {
        loadContributionData()
    }
})
</script>
