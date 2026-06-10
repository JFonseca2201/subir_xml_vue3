<template>
    <VAutocomplete v-model="selected" :items="results" return-object item-title="displayTitle" item-value="id"
        :label="label" :placeholder="placeholder" :disabled="disabled" :loading="isLoading" clearable
        hide-details="auto" :custom-filter="customFilter" v-model:search-input="searchQuery"
        @update:model-value="onSelectProduct" class="w-100" :menu-props="{ maxWidth: 0 }">
        <template #item="{ props, item }">
            <VListItem v-bind="props" :title="item.raw?.displayTitle || item.raw?.name || item.raw?.description || 'Producto'" :subtitle="item.raw?.sku || item.raw?.code || ''">
                <template #prepend>
                    <VAvatar size="32" color="success" variant="tonal">
                        <VIcon icon="ri-box-3-line" size="20" />
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
        type: [Object, null],
        default: null,
    },
    items: {
        type: Array,
        default: () => [],
    },
    label: {
        type: String,
        default: 'Buscar producto',
    },
    placeholder: {
        type: String,
        default: 'Escribe para buscar por nombre, código o SKU...',
    },
    prependIcon: {
        type: String,
        default: 'ri-search-line',
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
const selected = ref(props.modelValue)
let debounceTimeout = null

const normalizeProduct = (product) => {
    if (!product) return null

    const raw = product
    const sku = raw.sku || raw.code || raw.code_aux || ''
    const displayTitle = raw.description || raw.name || sku || 'Producto'
    return {
        ...raw,
        raw,
        sku,
        displayTitle,
        searchText: `${sku} ${raw.name || ''} ${raw.description || ''}`.toLowerCase(),
    }
}

const mergeRemoteWithLocal = (remoteItems = []) => {
    const remoteNormalized = Array.isArray(remoteItems) ? remoteItems.map(normalizeProduct) : []
    const localNormalized = Array.isArray(props.items) ? props.items.map(normalizeProduct) : []
    const map = new Map()

    localNormalized.forEach((item) => {
        if (item?.id != null) map.set(item.id, item)
    })
    remoteNormalized.forEach((item) => {
        if (item?.id != null) map.set(item.id, item)
    })

    return Array.from(map.values())
}

const loadProductById = async (id) => {
    if (!id) {
        results.value = []
        return
    }

    isLoading.value = true
    try {
        const response = await $api(`products/${id}`)
        const product = normalizeProduct(response?.data?.product ?? response?.data ?? response)
        if (product) {
            if (!results.value.find((item) => item.id === product.id)) {
                results.value = [product, ...results.value]
            }
            selected.value = product
            emit('selected', product)
        }
    } catch (error) {
        console.error('AutocompleteProduct loadProductById failed', error)
    } finally {
        isLoading.value = false
    }
}

const searchProducts = async (query) => {
    const term = String(query || '').trim()
    if (!term) {
        results.value = Array.isArray(props.items) ? props.items.map(normalizeProduct) : []
        return
    }

    isLoading.value = true
    try {
        const response = await $api('products/search', { params: { q: term } })
        const items = response?.data?.data ?? response?.data ?? response ?? []
        results.value = mergeRemoteWithLocal(items)
    } catch (error) {
        console.error('AutocompleteProduct search failed', error)
        results.value = Array.isArray(props.items) ? props.items.map(normalizeProduct) : []
    } finally {
        isLoading.value = false
    }
}

const customFilter = (value, query, item) => {
    if (query == null || query === '') return true
    const q = String(query).toLowerCase().trim()
    const raw = item?.raw
    if (!raw) return false

    const sku = String(raw.sku || raw.code || raw.code_aux || '').toLowerCase()
    const name = String(raw.name || '').toLowerCase()
    const desc = String(raw.description || '').toLowerCase()

    return sku.includes(q) || name.includes(q) || desc.includes(q)
}

const onSearchInput = (value) => {
    searchQuery.value = value
}

const onSelectProduct = (value) => {
    selected.value = value
    emit('update:modelValue', value)

    const selectedItem = results.value.find((item) => item.id === value?.id || item.id === value)
    if (selectedItem) {
        emit('selected', selectedItem)
    } else if (value == null) {
        emit('selected', null)
    }
}

watch(
    () => props.modelValue,
    async (value) => {
        selected.value = value
        if (value && typeof value !== 'object') {
            await loadProductById(value)
        }
    },
    { immediate: true }
)

watch(
    () => props.items,
    (items) => {
        if (!searchQuery.value) {
            results.value = Array.isArray(items) ? items.map(normalizeProduct) : []
        }
    },
    { immediate: true }
)

watch(searchQuery, (query) => {
    clearTimeout(debounceTimeout)
    debounceTimeout = window.setTimeout(() => {
        searchProducts(query)
    }, 300)
})

onMounted(() => {
    if (props.modelValue && typeof props.modelValue !== 'object') {
        loadProductById(props.modelValue)
    } else {
        results.value = Array.isArray(props.items) ? props.items.map(normalizeProduct) : []
    }
})
</script>
