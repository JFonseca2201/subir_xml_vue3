<script setup>
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    providerSelected: {
        type: Object,
        required: true,
    },
    roles: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['update:isDialogVisible', 'editProvider'])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Form data
const provider = ref({
    id: null,
    ruc: '',
    name: '',
    address: ''
})

// Computed para mostrar ID con formato
const formattedId = computed(() => {
    if (!provider.value.id) return ''
    return `prov00${provider.value.id}`
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

const supplierIdRules = [
    v => !!v || 'El ID de proveedor es requerido'
]

// Form ref
const providerForm = ref(null)

/* ======================================================
   🔥 LOAD PROVIDER DATA
====================================================== */

const loadProviderData = () => {
    if (!props.providerSelected) return

    console.log('Proveedor seleccionado completo:', props.providerSelected)
    console.log('Campos disponibles:', Object.keys(props.providerSelected))
    console.log('ID:', props.providerSelected.id)
    console.log('RUC:', props.providerSelected.ruc)
    console.log('Nombre:', props.providerSelected.name)
    console.log('Dirección:', props.providerSelected.address)

    provider.value = {
        id: props.providerSelected.id,
        ruc: props.providerSelected.ruc || '',
        name: props.providerSelected.name || '',
        address: props.providerSelected.address || ''
    }

    console.log('Datos del proveedor cargados:', provider.value)
}

/* ======================================================
   🔥 UPDATE
====================================================== */

const update = async () => {
    const { valid } = await providerForm.value?.validate()
    if (!valid) {
        showNotification('Por favor complete todos los campos requeridos', 'error')
        return
    }

    loader.start()

    try {
        const formData = new FormData()
        formData.append("_method", "PUT")
        formData.append("id", provider.value.id)
        formData.append('ruc', provider.value.ruc)
        formData.append('tax_id', provider.value.ruc)
        formData.append('name', provider.value.name)
        formData.append('address', provider.value.address)

        const resp = await $api(`suppliers/${provider.value.id}`, {
            method: "POST",
            body: formData,
            onResponseError({ response }) {
                console.error('Error del servidor:', response._data)
                showNotification('Error al actualizar el proveedor', 'error')
            }
        })

        console.log('Proveedor actualizado:', resp.supplier)
        emit('editProvider', resp.supplier)
        emit('update:isDialogVisible', false)
        showNotification('Proveedor actualizado con éxito', 'success')

    } catch (error) {
        console.error('Error al actualizar proveedor:', error)
        showNotification('Error al actualizar el proveedor', 'error')
    } finally {
        loader.stop()
    }
}

/* ======================================================
   🔥 RESET
====================================================== */

const onFormReset = () => {
    provider.value = {
        id: null,
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

watch(() => props.providerSelected, loadProviderData, { immediate: true })
watch(() => props.isDialogVisible, val => {
    if (val) loadProviderData()
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
                    <VIcon icon="ri-edit-line" color="primary" />
                    <span class="text-h6 font-weight-bold">Editar Proveedor</span>
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
                <VForm ref="providerForm" @submit.prevent="update">
                    <VRow>
                        <!-- RUC -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="provider.ruc" label="RUC" placeholder="EJ. 1700000000001"
                                :rules="rucRules" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-file-list-3-line" maxlength="13" required />
                        </VCol>

                        <!-- ID -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="formattedId" label="ID Proveedor" placeholder="Ej: prov001"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-hashtag" readonly
                                required />
                        </VCol>

                        <!-- Nombre -->
                        <VCol cols="12">
                            <VTextField v-model="provider.name" label="Nombre del Proveedor"
                                placeholder="Ej: Empresa XYZ S.A." :rules="nameRules" variant="outlined"
                                density="comfortable" prepend-inner-icon="ri-building-line" required />
                        </VCol>

                        <!-- Dirección -->
                        <VCol cols="12">
                            <VTextField v-model="provider.address" label="Dirección"
                                placeholder="Ej: Av. Principal 123, Quito, Ecuador" :rules="addressRules"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-map-pin-line"
                                required />
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
                <VBtn color="primary" variant="elevated" @click="update" :loading="loader.loading"
                    :disabled="loader.loading">
                    <VIcon start icon="ri-save-line" />
                    Actualizar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>
