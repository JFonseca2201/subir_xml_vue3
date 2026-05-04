<script setup>
import { ref, onMounted, watch } from 'vue'
import { $api } from '@/utils/api'
import { getBrandSearchOptions, filterBrands } from '@/data/vehicleBrands.js'
import {
    formatEcuadorianPlate,
    plateValidationRule
} from '@/utils/ecuadorianPlateValidator.js'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
})

const emit = defineEmits(['update:isDialogVisible', 'addVehicle'])

// --- ESTADO ---
const loading = ref(false)
const error = ref('')
const success = ref('')
const formRef = ref(null)

const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message
    notificationType.value = type
    notificationShow.value = true
}

// Obtener user_id del localStorage
const getCurrentUserId = () => {
    try {
        const userStore = localStorage.getItem('user')
        if (userStore) {
            const user = JSON.parse(userStore)
            return user.id || user.user_id || null
        }
        return null
    } catch (error) {
        console.error('Error al obtener user_id del localStorage:', error)
        return null
    }
}

const vehicleForm = ref({
    license_plate: '',
    brand: null,
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vehicle_type: '',
    description: '',
    user_id: null, // ID del usuario que crea el vehículo
    status: 1, // Estado activo por defecto (1 = activo, 2 = inactivo)
})

// --- LÓGICA DE FORMATEO ---
watch(() => vehicleForm.value.license_plate, (newValue, oldValue) => {
    if (!newValue) return
    // Evitar formateo si el usuario está borrando para no bloquear el cursor
    if (oldValue && newValue.length < oldValue.length) return

    const formatted = formatEcuadorianPlate(newValue)
    if (formatted !== newValue) {
        vehicleForm.value.license_plate = formatted
    }
})

// --- OPCIONES ---
const vehicleTypeOptions = [
    { title: 'Sedán', value: 'sedan' }, { title: 'Hatchback', value: 'hatchback' },
    { title: 'Camioneta', value: 'camioneta' }, { title: 'SUV', value: 'suv' },
    { title: 'Furgoneta', value: 'furgoneta' }, { title: 'Camión', value: 'camion' },
    { title: 'Bus', value: 'bus' }, { title: 'Van', value: 'van' },
    { title: 'Motocicleta', value: 'motocicleta' }, { title: 'Pickup', value: 'pickup' },
    { title: 'Minivan', value: 'minivan' }, { title: 'Deportivo', value: 'deportivo' },
    { title: 'Otro', value: 'otro' }
]

const colorOptions = [
    { title: 'Rojo', value: 'rojo' }, { title: 'Azul', value: 'azul' },
    { title: 'Verde', value: 'verde' }, { title: 'Amarillo', value: 'amarillo' },
    { title: 'Negro', value: 'negro' }, { title: 'Blanco', value: 'blanco' },
    { title: 'Gris', value: 'gris' }, { title: 'Plateado', value: 'plateado' }
]

const yearOptions = ref([])
const brandSearchOptions = ref([])

const generateYearOptions = () => {
    const currentYear = new Date().getFullYear()
    for (let i = currentYear + 5; i >= currentYear - 20; i--) {
        yearOptions.value.push({ title: i.toString(), value: i })
    }
}

const searchBrands = (searchText) => {
    brandSearchOptions.value = getBrandSearchOptions(searchText || '')
}

// --- REGLAS ---
const rules = {
    license_plate: [
        v => !!v || 'La placa es requerida',
        v => plateValidationRule(v)
    ],
    brand: [v => !!v || 'La marca es requerida'],
    model: [v => !!v || 'El modelo es requerido'],
    year: [v => !!v || 'El año es requerido'],
    color: [v => !!v || 'El color es requerido'],
    vehicle_type: [v => !!v || 'El tipo es requerido']
}

// --- ACCIONES ---
const resetForm = () => {
    vehicleForm.value = {
        license_plate: '',
        brand: null,
        model: '',
        year: new Date().getFullYear(),
        color: '',
        vehicle_type: '',
        description: '',
        user_id: getCurrentUserId(), // Asignar el ID del usuario actual
        status: 1, // Estado activo por defecto (1 = activo, 2 = inactivo)
    }
    formRef.value?.resetValidation()
}

const closeDialog = () => {
    emit('update:isDialogVisible', false)
    resetForm()
}

const saveVehicle = async () => {
    const { valid } = await formRef.value?.validate()
    if (!valid) return

    loading.value = true
    error.value = ''

    try {
        const resp = await $api("vehicles", {
            method: "POST",
            body: vehicleForm.value,
        })

        showNotification('Vehículo guardado correctamente', 'success')
        resetForm()
        setTimeout(() => {
            emit('update:isDialogVisible', false)
            emit('addVehicle', resp.data || resp)
        }, 1200)

    } catch (err) {
        error.value = err.response?._data?.message || 'Error al guardar vehículo'
        showNotification(error.value, 'error')
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    generateYearOptions()
    searchBrands('')
    // Asignar el user_id al montar el componente
    vehicleForm.value.user_id = getCurrentUserId()
})
</script>

<template>
    <VDialog max-width="800" :model-value="props.isDialogVisible" @update:model-value="closeDialog" persistent>
        <VCard class="pa-sm-10 pa-5">
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <VCardText class="text-center pb-6">
                <VIcon icon="ri-add-circle-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Nuevo Vehículo</h4>
            </VCardText>

            <VDivider class="mb-6" />

            <VForm ref="formRef" @submit.prevent="saveVehicle">
                <VRow dense>
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-3 text-primary">Datos Principales</h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="vehicleForm.license_plate" label="Placa *" placeholder="ABC-1234"
                            prepend-inner-icon="ri-id-card-line" :rules="rules.license_plate" variant="outlined"
                            maxlength="9" hint="Formato automático" persistent-hint />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.vehicle_type" :items="vehicleTypeOptions"
                            label="Tipo de Vehículo *" prepend-inner-icon="ri-car-line" :rules="rules.vehicle_type" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VAutocomplete v-model="vehicleForm.brand" :items="brandSearchOptions" label="Marca *"
                            prepend-inner-icon="ri-building-line" :rules="rules.brand" :filter="filterBrands"
                            @update:search="searchBrands" no-data-text="No se encontraron marcas" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="vehicleForm.model" label="Modelo *" prepend-inner-icon="ri-car-line"
                            :rules="rules.model" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.year" :items="yearOptions" label="Año *"
                            prepend-inner-icon="ri-calendar-line" :rules="rules.year" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.color" :items="colorOptions" label="Color *"
                            prepend-inner-icon="ri-palette-line" :rules="rules.color" />
                    </VCol>

                    <VCol cols="12" class="mt-4">
                        <VTextarea v-model="vehicleForm.description" label="Descripción (opcional)"
                            prepend-inner-icon="ri-file-text-line" rows="3" />
                    </VCol>

                    <VCol cols="12" v-if="error">
                        <VAlert type="error" variant="tonal" closable>{{ error }}</VAlert>
                    </VCol>

                    <VCol cols="12" class="d-flex justify-center gap-4 mt-6">
                        <VBtn type="submit" color="primary" :loading="loading" prepend-icon="ri-save-3-line">
                            Guardar Vehículo
                        </VBtn>
                        <VBtn variant="outlined" color="secondary" @click="closeDialog">
                            Cancelar
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>
        </VCard>
    </VDialog>

    <VSnackbar v-model="notificationShow" :color="notificationType" :timeout="3000" location="top">
        {{ notificationMessage }}
    </VSnackbar>
</template>