<template>
    <VAutocomplete v-model="selectedId" :items="results" item-title="displayName" item-value="id" :label="label"
        :placeholder="placeholder" :disabled="disabled" :loading="isLoading" clearable hide-details="auto"
        v-model:search-input="searchTerm" @update:model-value="onSelectCliente" class="w-100">
        <template #item="{ props, item }">
            <VListItem v-bind="props" :title="item.raw?.displayName || item.raw?.full_name || 'Cliente'" :subtitle="item.raw?.n_document || 'Sin cédula'">
                <template #prepend>
                    <VAvatar size="32" color="info" variant="tonal">
                        <VIcon icon="ri-user-line" size="20" />
                    </VAvatar>
                </template>
            </VListItem>
        </template>
    </VAutocomplete>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
    modelValue: {
        type: [String, Number, null],
        default: null,
    },
    clienteInicial: {
        type: Object,
        default: null,
    },
    clienteId: {
        type: [String, Number, null],
        default: null,
    },
    items: {
        type: Array,
        default: () => [],
    },
    label: {
        type: String,
        default: 'Cliente',
    },
    placeholder: {
        type: String,
        default: 'Buscar cliente por nombre o cédula...',
    },
    disabled: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['update:modelValue', 'clienteSeleccionado'])

const searchTerm = ref('')
const results = ref([])
const isLoading = ref(false)
const selectedId = ref(props.modelValue || null)
let debounceTimeout = null

const normalizeClient = (client) => {
    if (!client) return null
    const nombre = client.full_name || `${client.name || ''} ${client.surname || ''}`.trim()
    return {
        ...client,
        displayName: nombre,
    }
}

const loadClienteById = async id => {
    if (!id) return
    isLoading.value = true
    try {
        const response = await $api(`clients/${id}`)
        const client = normalizeClient(response?.client ?? response?.data ?? null)
        if (client) {
            if (!results.value.find((item) => item.id === client.id)) {
                results.value = [client, ...results.value]
            }
            selectedId.value = client.id
            emit('clienteSeleccionado', client)
        }
    } catch (error) {
        console.error('AutocompleteCliente loadClienteById failed', error)
    } finally {
        isLoading.value = false
    }
}

const searchClientes = async (query) => {
    const term = String(query || '').trim()
    if (!term) {
        results.value = Array.isArray(props.items) ? props.items.map(normalizeClient) : []
        return
    }

    isLoading.value = true
    try {
        const response = await $api('clients/search', { params: { q: term, limit: 10 } })
        const items = response?.data ?? response ?? []
        results.value = Array.isArray(items) ? items.map(normalizeClient) : []
    } catch (error) {
        console.error('AutocompleteCliente search failed', error)
        results.value = []
    } finally {
        isLoading.value = false
    }
}

const filterLocalClients = (query) => {
    const term = String(query || '').toLowerCase().trim()
    if (!term) {
        results.value = Array.isArray(props.items) ? props.items.map(normalizeClient) : []
        return
    }

    const filtered = props.items.filter(client => {
        const normalized = normalizeClient(client)
        const searchText = `${normalized.displayName || ''} ${normalized.n_document || ''}`.toLowerCase()
        return searchText.includes(term)
    })
    results.value = filtered.map(normalizeClient)
}

const onSelectCliente = (value) => {
    selectedId.value = value
    emit('update:modelValue', value)

    const item = results.value.find((candidate) => candidate.id === value)
    if (item) {
        emit('clienteSeleccionado', item)
    } else if (value == null) {
        emit('clienteSeleccionado', null)
    }
}

watch(
    () => props.modelValue,
    async (value) => {
        selectedId.value = value
        if (value != null && typeof value !== 'object') {
            await loadClienteById(value)
        }
    },
    { immediate: true }
)

watch(
    () => props.items,
    (items) => {
        if (items && items.length > 0) {
            results.value = items.map(normalizeClient)
        }
    },
    { immediate: true }
)

watch(searchTerm, (query) => {
    clearTimeout(debounceTimeout)
    debounceTimeout = window.setTimeout(() => {
        if (props.items && props.items.length > 0) {
            filterLocalClients(query)
        } else {
            searchClientes(query)
        }
    }, 300)
})

onMounted(() => {
    if (props.clienteInicial) {
        const normalized = normalizeClient(props.clienteInicial)
        results.value = [normalized]
        selectedId.value = normalized.id
        emit('update:modelValue', normalized.id)
    } else if (props.modelValue != null && typeof props.modelValue !== 'object') {
        loadClienteById(props.modelValue)
    } else if (props.items && props.items.length > 0) {
        results.value = props.items.map(normalizeClient)
    }
})
</script>
