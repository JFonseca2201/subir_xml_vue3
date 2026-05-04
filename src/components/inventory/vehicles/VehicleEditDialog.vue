<script setup>
import { ref, onMounted, watch } from 'vue'
import { $api } from '@/utils/api'
import { getBrandOptions, getBrandNameById, getBrandSearchOptions, filterBrands } from '@/data/vehicleBrands.js'
import { formatEcuadorianPlate, plateValidationRule } from '@/utils/ecuadorianPlateValidator.js'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    vehicleData: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:isDialogVisible', 'vehicleUpdated'])

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
    id: '',
    license_plate: '',
    brand: null,
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vehicle_type: '',
    description: '',
    status: 1, // 1 = Activo, 2 = Inactivo
    user_id: null, // ID del usuario que crea/edita el vehículo
})

// --- OPCIONES ---
const vehicleTypeOptions = [
    { title: 'Sedán', value: 'sedan' }, { title: 'Hatchback', value: 'hatchback' },
    { title: 'Camioneta', value: 'camioneta' }, { title: 'SUV', value: 'suv' },
    { title: 'Furgoneta', value: 'furgoneta' }, { title: 'Camión', value: 'camion' },
    { title: 'Bus', value: 'bus' }, { title: 'Van', value: 'van' },
    { title: 'Motocicleta', value: 'motocicleta' }, { title: 'Pickup', value: 'pickup' },
    { title: 'Deportivo', value: 'deportivo' }, { title: 'Otro', value: 'otro' }
]

const colorOptions = [
    { title: 'Rojo', value: 'rojo' }, { title: 'Azul', value: 'azul' },
    { title: 'Verde', value: 'verde' }, { title: 'Amarillo', value: 'amarillo' },
    { title: 'Negro', value: 'negro' }, { title: 'Blanco', value: 'blanco' },
    { title: 'Gris', value: 'gris' }, { title: 'Plateado', value: 'plateado' },
    { title: 'Beige', value: 'beige' }, { title: 'Otro', value: 'otro' }
]

const statusOptions = [
    { title: 'Activo', value: 1 },
    { title: 'Inactivo', value: 2 }
]

const yearOptions = ref([])
const brandOptions = ref(getBrandOptions())
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

// --- FORMATEO DINÁMICO ---
watch(() => vehicleForm.value.license_plate, (newValue, oldValue) => {
    if (!newValue) return
    // Evitar formatear si está borrando
    if (oldValue && newValue.length < oldValue.length) return

    const formatted = formatEcuadorianPlate(newValue)
    if (formatted !== newValue) {
        vehicleForm.value.license_plate = formatted
    }
})

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
    vehicle_type: [v => !!v || 'El tipo es requerido'],
}

// --- CARGA Y ACCIONES ---
const loadVehicleData = () => {
    if (props.vehicleData && Object.keys(props.vehicleData).length > 0) {
        // Formatear al cargar si viene de DB sin guión
        const rawPlate = props.vehicleData.license_plate || ''
        const plate = rawPlate.includes('-') ? rawPlate : formatEcuadorianPlate(rawPlate)

        // Asegurar que brand sea el ID numérico correcto
        let brandValue = props.vehicleData.brand
        console.log('Brand original:', brandValue, 'Tipo:', typeof brandValue)

        if (brandValue !== null && brandValue !== undefined) {
            if (typeof brandValue === 'string') {
                // Si viene como nombre, buscar el ID correspondiente
                const brandOption = brandOptions.value.find(opt =>
                    opt.title === brandValue.toUpperCase() ||
                    opt.title === brandValue ||
                    opt.value.toString() === brandValue
                )
                if (brandOption) {
                    brandValue = brandOption.value
                    console.log('Brand convertido de nombre a ID:', brandValue)
                } else {
                    // Intentar convertir directamente a número si es un string numérico
                    const numericBrand = parseInt(brandValue)
                    if (!isNaN(numericBrand)) {
                        brandValue = numericBrand
                        console.log('Brand convertido a número:', brandValue)
                    } else {
                        brandValue = null
                        console.log('Brand no encontrado, seteando a null')
                    }
                }
            } else if (typeof brandValue === 'number') {
                // Ya es número, verificar que exista en las opciones
                const brandOption = brandOptions.value.find(opt => opt.value === brandValue)
                if (!brandOption) {
                    console.log('Brand ID no encontrado en opciones:', brandValue)
                    brandValue = null
                } else {
                    console.log('Brand ID válido:', brandValue)
                }
            }
        } else {
            console.log('Brand es null o undefined')
        }

        // Asegurar que el status sea un número válido (1 o 2)
        let statusValue = props.vehicleData.status
        if (statusValue === null || statusValue === undefined || statusValue === '') {
            statusValue = 1 // Por defecto activo si no viene valor
        } else {
            statusValue = parseInt(statusValue)
            if (isNaN(statusValue) || (statusValue !== 1 && statusValue !== 2)) {
                statusValue = 1 // Por defecto activo si el valor no es válido
            }
        }

        console.log('Status del vehículo:', statusValue, 'Tipo:', typeof statusValue)

        vehicleForm.value = {
            ...props.vehicleData,
            license_plate: plate,
            brand: brandValue,
            status: statusValue, // Asegurar que el status sea correcto
            user_id: getCurrentUserId() // Asignar el ID del usuario actual
        }
    }
}

const updateVehicle = async () => {
    const { valid } = await formRef.value?.validate()
    if (!valid) return

    loading.value = true
    error.value = ''

    try {
        const resp = await $api(`vehicles/${vehicleForm.value.id}`, {
            method: "PUT",
            body: vehicleForm.value,
        })

        showNotification('Vehículo actualizado con éxito', 'success')

        setTimeout(() => {
            emit('update:isDialogVisible', false)
            emit('vehicleUpdated', resp.data || vehicleForm.value)
        }, 1200)

    } catch (err) {
        error.value = err.response?._data?.message || 'Error al actualizar'
        showNotification(error.value, 'error')
    } finally {
        loading.value = false
    }
}

const closeDialog = () => {
    emit('update:isDialogVisible', false)
    formRef.value?.resetValidation()
}

// Sincronizar cuando el prop cambie (al abrir el diálogo)
watch(() => props.vehicleData, () => {
    loadVehicleData()
    searchBrands('')
}, { deep: true })

onMounted(() => {
    generateYearOptions()
    loadVehicleData()
    // Inicializar con marcas populares
    searchBrands('')
})
</script>

<template>
    <VDialog max-width="800" :model-value="props.isDialogVisible" @update:model-value="closeDialog" persistent>
        <VCard class="pa-sm-10 pa-5">
            <DialogCloseBtn variant="text" size="default" @click="closeDialog" />

            <VCardText class="text-center pb-6">
                <VIcon icon="ri-edit-box-line" size="42" color="primary" class="mb-3" />
                <h4 class="text-h4 font-weight-bold mb-1">Editar Vehículo</h4>
                <p class="text-body-2 text-medium-emphasis">Actualice la información del registro</p>
            </VCardText>

            <VDivider class="mb-6" />

            <VForm ref="formRef" @submit.prevent="updateVehicle">
                <VRow dense>
                    <VCol cols="12" md="6">
                        <VTextField v-model="vehicleForm.license_plate" label="Placa *" placeholder="ABC-1234"
                            prepend-inner-icon="ri-id-card-line" :rules="rules.license_plate" maxlength="9"
                            variant="outlined" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.vehicle_type" :items="vehicleTypeOptions"
                            label="Tipo de Vehículo *" prepend-inner-icon="ri-car-line" :rules="rules.vehicle_type" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VAutocomplete v-model="vehicleForm.brand" :items="brandOptions" item-title="title"
                            item-value="value" label="Marca *" prepend-inner-icon="ri-building-line"
                            :rules="rules.brand" :filter="filterBrands" @update:search="searchBrands"
                            no-data-text="No se encontraron marcas" clearable />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="vehicleForm.model" label="Modelo *" :rules="rules.model" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.year" :items="yearOptions" label="Año *" :rules="rules.year" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.color" :items="colorOptions" label="Color *"
                            :rules="rules.color" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="vehicleForm.status" :items="statusOptions" item-title="title"
                            item-value="value" label="Estado del Vehículo" prepend-inner-icon="ri-toggle-line" />
                    </VCol>

                    <VCol cols="12">
                        <VTextarea v-model="vehicleForm.description" label="Descripción" rows="3" />
                    </VCol>

                    <VCol cols="12" v-if="error">
                        <VAlert type="error" variant="tonal">{{ error }}</VAlert>
                    </VCol>

                    <VCol cols="12" class="d-flex justify-center gap-4 mt-4">
                        <VBtn type="submit" color="primary" :loading="loading">Actualizar</VBtn>
                        <VBtn variant="outlined" color="secondary" @click="closeDialog">Cancelar</VBtn>
                    </VCol>
                </VRow>
            </VForm>
        </VCard>
    </VDialog>

    <VSnackbar v-model="notificationShow" :color="notificationType" :timeout="3000" location="top">
        {{ notificationMessage }}
    </VSnackbar>
</template>
