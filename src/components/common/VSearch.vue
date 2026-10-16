<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { $api } from '@/utils/api'

const props = defineProps({
  modelValue: {
    type: [String, Number, Object],
    default: null,
  },
  endpoint: {
    type: String,
    required: true,
  },
  itemTitle: {
    type: [String, Function],
    default: 'title',
  },
  itemValue: {
    type: String,
    default: 'id',
  },
  label: {
    type: String,
    default: 'Buscar',
  },
  placeholder: {
    type: String,
    default: 'Escriba al menos 2 caracteres...',
  },
  returnObject: {
    type: Boolean,
    default: false,
  },
  icon: {
    type: String,
    default: 'ri-search-line',
  },
  minChars: {
    type: Number,
    default: 2,
  },
  preloadRecent: {
    type: Boolean,
    default: true,
  },
  recentLimit: {
    type: Number,
    default: 5,
  },
  initialItem: {
    type: Object,
    default: null,
  },
  extraParams: {
    type: Object,
    default: () => ({}),
  },
  clearable: {
    type: Boolean,
    default: true,
  },
  variant: {
    type: String,
    default: 'outlined',
  },
  density: {
    type: String,
    default: 'compact',
  },
  hideDetails: {
    type: [Boolean, String],
    default: 'auto',
  },
  rules: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

const loading = ref(false)
const items = ref([])
const recentItems = ref([])
const search = ref('')
const isMenuOpen = ref(false)
let isSelecting = false
let vSearchAbortController = null

const resolveItemTitle = item => {
  if (!item) return ''
  if (typeof props.itemTitle === 'function') {
    return props.itemTitle(item)
  }
  if (typeof props.itemTitle === 'string' && item[props.itemTitle] !== undefined && item[props.itemTitle] !== null) {
    return item[props.itemTitle]
  }
  return item.full_name || (item.name ? `${item.name} ${item.surname || ''}`.trim() : '') || item.description || item.license_plate || item.title || item.name || ''
}

const updateItemsWithRecent = () => {
  const list = []
  
  if (props.initialItem && typeof props.initialItem === 'object') {
    list.push(props.initialItem)
  }
  
  if (props.modelValue && typeof props.modelValue === 'object') {
    const key = props.modelValue[props.itemValue]
    if (!list.some(it => String(it[props.itemValue]) === String(key))) {
      list.push(props.modelValue)
    }
  }

  recentItems.value.forEach(item => {
    if (!item) return
    const key = item[props.itemValue]
    if (!list.some(it => String(it[props.itemValue]) === String(key))) {
      list.push(item)
    }
  })

  items.value = list
}

const fetchRecentItems = async () => {
  if (!props.preloadRecent || !props.endpoint) return

  try {
    const params = {
      limit: props.recentLimit || 5,
      ...props.extraParams,
    }

    const response = await $api(props.endpoint, { params })
    const data = response?.data || response || []
    recentItems.value = Array.isArray(data) ? data : []

    if (!search.value || search.value.length < props.minChars) {
      updateItemsWithRecent()
    }
  } catch (error) {
    console.error('Error in VSearch fetchRecentItems:', error)
  }
}

const fetchItems = async query => {
  if (vSearchAbortController) {
    vSearchAbortController.abort()
  }
  vSearchAbortController = new AbortController()

  if (!query || query.length < props.minChars) {
    updateItemsWithRecent()
    return
  }

  loading.value = true
  try {
    const params = {
      q: query,
      search: query,
      ...props.extraParams,
    }

    const response = await $api(props.endpoint, { 
      params,
      signal: vSearchAbortController.signal,
    })

    const data = response?.data || response || []
    const results = Array.isArray(data) ? data : []
    
    // Mantener elemento seleccionado o inicial para no perder reactividad
    const list = [...results]
    if (props.modelValue && typeof props.modelValue === 'object') {
      const key = props.modelValue[props.itemValue]
      if (!list.some(it => String(it[props.itemValue]) === String(key))) {
        list.unshift(props.modelValue)
      }
    }
    
    items.value = list
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
    console.error('Error in VSearch fetchItems:', error)
    items.value = []
  } finally {
    loading.value = false
  }
}

const debouncedFetch = useDebounceFn(val => {
  fetchItems(val)
}, 300)

const onSearchInput = val => {
  if (isSelecting) return
  search.value = val || ''
  if (!search.value || search.value.length < props.minChars) {
    updateItemsWithRecent()
  } else {
    debouncedFetch(search.value)
  }
}

const onFocus = () => {
  if (recentItems.value.length === 0) {
    fetchRecentItems()
  } else if (!search.value || search.value.length < props.minChars) {
    updateItemsWithRecent()
  }
  isMenuOpen.value = true
}

const onMenuUpdate = val => {
  isMenuOpen.value = val
  if (val) {
    if (recentItems.value.length === 0) {
      fetchRecentItems()
    } else if (!search.value || search.value.length < props.minChars) {
      updateItemsWithRecent()
    }
  }
}

const onModelValueUpdate = val => {
  isSelecting = true
  emit('update:modelValue', val)
  if (val) {
    if (props.returnObject) {
      emit('change', val)
    } else {
      const selectedItem = items.value.find(item => item[props.itemValue] === val)
      emit('change', selectedItem || val)
    }
  } else {
    emit('change', null)
    search.value = ''
    updateItemsWithRecent()
  }
  setTimeout(() => {
    isSelecting = false
  }, 100)
}

onMounted(() => {
  if (props.initialItem) {
    items.value = [props.initialItem]
  }
  fetchRecentItems()
})

watch(() => props.modelValue, newVal => {
  if (!newVal) {
    search.value = ''
    updateItemsWithRecent()
  }
}, { immediate: true })

watch(() => props.initialItem, newVal => {
  if (newVal) {
    updateItemsWithRecent()
  }
}, { deep: true })

watch(() => props.extraParams, () => {
  fetchRecentItems()
}, { deep: true })

watch(() => props.endpoint, () => {
  fetchRecentItems()
})
</script>

<template>
  <VAutocomplete
    :model-value="modelValue"
    v-model:search="search"
    v-model:menu="isMenuOpen"
    :items="items"
    :item-title="resolveItemTitle"
    :item-value="itemValue"
    :label="label"
    :placeholder="placeholder"
    :return-object="returnObject"
    :clearable="clearable"
    :variant="variant"
    :density="density"
    :loading="loading"
    :hide-details="hideDetails"
    :rules="rules"
    :custom-filter="() => true"
    :open-on-focus="true"
    :open-on-clear="true"
    @update:model-value="onModelValueUpdate"
    @update:search="onSearchInput"
    @update:menu="onMenuUpdate"
    @focus="onFocus"
    @click:control="onFocus"
  >
    <template #prepend-inner>
      <VProgressCircular
        v-if="loading"
        indeterminate
        color="primary"
        size="20"
        width="2"
      />
      <VIcon
        v-else
        :icon="icon"
      />
    </template>

    <template #item="data">
      <slot
        name="item"
        v-bind="data"
      >
        <VListItem v-bind="data.props" />
      </slot>
    </template>

    <template
      v-if="$slots.append"
      #append
    >
      <slot name="append" />
    </template>
    
    <template #no-data>
      <div class="px-4 py-3 text-medium-emphasis text-body-2 text-center">
        <span v-if="!search || search.length < minChars">
          <VIcon icon="ri-search-line" size="18" class="me-1 mb-1 text-disabled" />
          Escriba al menos {{ minChars }} caracteres para buscar
        </span>
        <span v-else>
          <VIcon icon="ri-information-line" size="18" class="me-1 mb-1 text-disabled" />
          No se encontraron resultados para "<strong>{{ search }}</strong>"
        </span>
      </div>
    </template>
  </VAutocomplete>
</template>
