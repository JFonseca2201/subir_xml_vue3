<script setup>
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    providers: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['update:isDialogVisible', 'addProvider'])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const isLoading = ref(false)
const lastSupplierId = ref('prov000')  // Iniciar en 0 para que el primero sea prov001

// Generate automatic supplier ID (local generation)
const generateSupplierId = () => {
    const prefix = 'prov00'
    const currentNumber = String(lastSupplierId.value.match(/\d+/)?.[0] || 0)
    const nextNumber = String(parseInt(currentNumber) + 1)
    const newId = `${prefix}${nextNumber}`
    return newId
}

// Generate display ID (last + 1, without incrementing counter)
const generateDisplayId = () => {
    const prefix = 'prov00'
    const currentNumber = String(lastSupplierId.value.match(/\d+/)?.[0] || 0)
    const nextNumber = String(parseInt(currentNumber) + 1)
    const displayId = `${prefix}${nextNumber}`
    return displayId
}

// Form data
const provider = ref({
    id: generateDisplayId(),
    ruc: '',
    name: '',
    address: ''
})

// Validation rules
const rucRules = [
    v => !!v || 'El RUC es requerido',
    v => v && v.length === 13 || 'El RUC debe tener 13 dígitos',
    v => /^\d{13}$/.test(v) || 'El RUC debe contener solo números'
]

const nameRules = [
    v => !!v || 'El nombre es requerido',
    v => (v && v.length >= 3) || 'El nombre debe tener al menos 3 caracteres'
]

const addressRules = [
    v => !!v || 'La dirección es requerida',
    v => (v && v.length >= 5) || 'La dirección debe tener al menos 5 caracteres'
]

// Form ref
const providerForm = ref(null)

/* ======================================================
   🔥 STORE
====================================================== */

const store = async () => {
    const { valid } = await providerForm.value?.validate()
    if (!valid) {
        showNotification('Por favor complete todos los campos requeridos', 'error')
        return
    }

    loader.start()

    try {
        // Generate the real ID only when saving
        const realId = generateSupplierId()
        lastSupplierId.value = realId
        
        const formData = new FormData()
        formData.append('ruc', provider.value.ruc)
        formData.append('tax_id', provider.value.ruc)
        formData.append('id', realId.replace('prov00', '')) // Send only the number
        formData.append('name', provider.value.name)
        formData.append('address', provider.value.address)

        const resp = await $api('suppliers', {
            method: 'POST',
            body: formData,
            onResponseError({ response }) {
                console.error('Error del servidor:', response._data)
                showNotification('Error al crear el proveedor', 'error')
            }
        })

        console.log('Proveedor creado:', resp.supplier)
        emit('addProvider', resp.supplier)
        emit('update:isDialogVisible', false)
        showNotification('Proveedor creado con éxito', 'success')
        onFormReset()

    } catch (error) {
        console.error('Error al crear proveedor:', error)
        showNotification('Error al crear el proveedor', 'error')
    } finally {
        loader.stop()
    }
}

/* ======================================================
   🔥 RESET
====================================================== */

const onFormReset = () => {
    provider.value = {
        id: generateDisplayId(),
        ruc: '',
        name: '',
        address: ''
    }
    
    if (providerForm.value) {
        providerForm.value.resetValidation()
    }
}

/* ======================================================
   🔥 WATCH DIALOG VISIBILITY
====================================================== */

watch(() => props.isDialogVisible, (val) => {
    if (val) {
        // Update last ID from providers list and generate display ID
        if (props.providers && props.providers.length > 0) {
            const maxId = props.providers.reduce((max, provider) => {
                const idNumber = parseInt(provider.id) || 0
                const maxNumber = parseInt(max.id) || 0
                return idNumber > maxNumber ? provider : max
            }, { id: '0' })
            
            lastSupplierId.value = `prov00${maxId.id}`
            console.log('Último ID encontrado:', lastSupplierId.value)
        }
        
        // Generate display ID (last + 1)
        provider.value.id = generateDisplayId()
        console.log('ID a mostrar:', provider.value.id)
    } else {
        onFormReset()
    }
})
</script>

<template>
    <VDialog 
        :model-value="props.isDialogVisible" 
        @update:model-value="val => emit('update:isDialogVisible', val)"
        max-width="600px"
        persistent
        :closable="!loader.loading"
    >
        <VCard>
            <!-- Header -->
            <VCardTitle class="d-flex align-center justify-space-between pa-4">
                <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-truck-line" color="primary" />
                    <span class="text-h6 font-weight-bold">Nuevo Proveedor</span>
                </div>
                <VBtn 
                    icon 
                    variant="text" 
                    @click="emit('update:isDialogVisible', false)"
                    :disabled="loader.loading"
                >
                    <VIcon icon="ri-close-line" />
                </VBtn>
            </VCardTitle>

            <VDivider />

            <!-- Form -->
            <VCardText class="pa-4">
                <VForm ref="providerForm" @submit.prevent="store">
                    <VRow>
                        <!-- RUC -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="provider.ruc" label="RUC" placeholder="EJ. 1700000000001" :rules="rucRules"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-file-list-3-line"
                                maxlength="13" required />
                        </VCol>

                        <!-- ID Oculto -->
                        <!-- <VCol cols="12" md="6">
                            <VTextField v-model="provider.id" label="ID Proveedor"
                                placeholder="Generado automáticamente" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-hashtag" readonly required />
                        </VCol> -->

                        <!-- Nombre -->
                        <VCol cols="12">
                            <VTextField v-model="provider.name" label="Nombre del Proveedor"
                                placeholder="Ej: EMPRESA XYZ S.A." :rules="nameRules" variant="outlined"
                                density="comfortable" prepend-inner-icon="ri-building-line" required
                                @input="e => { provider.name = e.target.value.toUpperCase() }" />
                        </VCol>

                        <!-- Dirección -->
                        <VCol cols="12">
                            <VTextField v-model="provider.address" label="Dirección"
                                placeholder="Ej: AV. PRINCIPAL 123, QUITO, ECUADOR" :rules="addressRules"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-map-pin-line"
                                required @input="e => { provider.address = e.target.value.toUpperCase() }" />
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>

            <VDivider />

            <!-- Actions -->
            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn color="default" variant="outlined" @click="emit('update:isDialogVisible', false)"
                    :disabled="loader.loading">
                    <VIcon start icon="ri-close-line" />
                    Cancelar
                </VBtn>
                <VBtn color="primary" variant="elevated" @click="store" :loading="loader.loading"
                    :disabled="loader.loading">
                    <VIcon start icon="ri-save-line" />
                    Guardar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>
