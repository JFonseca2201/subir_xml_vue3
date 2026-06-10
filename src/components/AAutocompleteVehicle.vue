<template>
    <VAutocomplete v-model="selectedId" :items="results" item-title="displayTitle" item-value="id" :label="label"
        :placeholder="placeholder" :disabled="disabled" :loading="isLoading" clearable hide-details="auto"
        v-model:search-input="searchQuery" @update:model-value="onSelectVehicle" class="w-100">
        <template #item="{ props, item }">
            <VListItem v-bind="props" :title="item.raw?.displayTitle || item.raw?.license_plate || 'Vehículo'" :subtitle="item.raw?.model || ''">
                <template #prepend>
                    <VAvatar size="32" color="primary" variant="tonal">
                        <VIcon icon="ri-car-line" size="20" />
                    </VAvatar>
                </template>
            </VListItem>
        </template>
    </VAutocomplete>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { getBrandNameById } from '@/data/vehicleBrands'

const props = defineProps({
    modelValue: {
        type: [String, Number, Object, null],
        default: null,
    },
    clientId: {
        type: [String, Number, null],
        default: null,
    },
    items: {
        type: Array,
        default: () => [],
    },
    label: {
        type: String,
        default: 'Vehículo',
    },
    placeholder: {
        type: String,
        default: 'Buscar vehículo...',
    },
    disabled: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['update:modelValue', 'selected'])

const searchQuery = ref('')
const results = ref([])
const isLoading = ref(false)
const selectedId = ref(props.modelValue || null)
let debounceTimeout = null

const normalizeVehicle = (vehicle) => {
    if (!vehicle) return null
    const brandId = typeof vehicle.brand === 'object' ? vehicle.brand.id : vehicle.brand
    const brandName = brandId ? getBrandNameById(brandId) : ''
    const clientName = vehicle.client?.full_name || `${vehicle.client?.name || ''} ${vehicle.client?.surname || ''}`.trim()
    const parts = [vehicle.license_plate, brandName, vehicle.model, clientName].filter(
        (part) => part !== undefined && part !== null && part !== ''
    )

    return {
        ...vehicle,
        brand: brandId,
        client_name: clientName,
        displayTitle: parts.length > 0 ? parts.join(' - ') : vehicle.license_plate || 'Vehículo',
    }
}

const loadVehicleById = async (id) => {
    if (!id) {
        results.value = []
        return
    }

    isLoading.value = true
    try {
        const response = await $api(`vehicles/${id}`)
        const vehicle = normalizeVehicle(response?.data?.vehicle ?? response?.data ?? response)
        if (vehicle) {
            if (!results.value.find((item) => item.id === vehicle.id)) {
                results.value = [vehicle, ...results.value]
            }
            selectedId.value = vehicle.id
            emit('selected', vehicle)
        }
    } catch (error) {
        console.error('AutocompleteVehicle loadVehicleById failed', error)
    } finally {
        isLoading.value = false
    }
}

const searchVehicles = async (query) => {
    const term = String(query || '').trim()
    if (!term) {
        results.value = Array.isArray(props.items) ? props.items.map(normalizeVehicle) : []
        return
    }

    isLoading.value = true
    try {
        const params = { q: term }
        if (props.clientId) {
            params.client_id = props.clientId
        }

        const response = await $api('vehicles/search', { params })
        const items = response?.data?.data ?? response?.data ?? response ?? []
        results.value = Array.isArray(items)
            ? items.map(normalizeVehicle)
            : []
    } catch (error) {
        console.error('AutocompleteVehicle search failed', error)
        results.value = []
    } finally {
        isLoading.value = false
    }
}

const filterLocalVehicles = (query) => {
    const term = String(query || '').toLowerCase().trim()
    if (!term) {
        results.value = Array.isArray(props.items) ? props.items.map(normalizeVehicle) : []
        return
    }

    const filtered = props.items.filter(vehicle => {
        const normalized = normalizeVehicle(vehicle)
        const searchText = `${normalized.license_plate || ''} ${normalized.model || ''} ${normalized.client_name || ''} ${normalized.brand || ''}`.toLowerCase()
        return searchText.includes(term)
    })
    results.value = filtered.map(normalizeVehicle)
}

const onSearchInput = (value) => {
    searchQuery.value = value
}

const onSelectVehicle = (value) => {
    selectedId.value = value
    emit('update:modelValue', value)

    const item = results.value.find((candidate) => candidate.id === value)
    if (item) {
        emit('selected', item)
    } else if (value == null) {
        emit('selected', null)
    }
}

watch(
    () => props.modelValue,
    async (value) => {
        selectedId.value = value
        if (value != null && typeof value !== 'object') {
            await loadVehicleById(value)
        }
    },
    { immediate: true }
)

watch(
    () => props.clientId,
    (value) => {
        if (searchQuery.value.trim().length > 0) {
            searchVehicles(searchQuery.value)
        }
    }
)

watch(
    () => props.items,
    (items) => {
        if (items && items.length > 0) {
            results.value = items.map(normalizeVehicle)
        } else {
            results.value = []
        }
    },
    { immediate: true }
)

watch(searchQuery, (query) => {
    clearTimeout(debounceTimeout)
    debounceTimeout = window.setTimeout(() => {
        filterLocalVehicles(query)
    }, 300)
})

onMounted(() => {
    if (props.items && props.items.length > 0) {
        results.value = props.items.map(normalizeVehicle)
    }
    if (props.modelValue != null && typeof props.modelValue !== 'object') {
        loadVehicleById(props.modelValue)
    }
})
</script>
