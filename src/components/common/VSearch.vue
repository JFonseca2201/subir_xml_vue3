<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { $api } from '@/utils/api'

const props = defineProps({
  modelValue: {
    type: [String, Number, Object],
    default: null
  },
  endpoint: {
    type: String,
    required: true
  },
  itemTitle: {
    type: [String, Function],
    default: 'title'
  },
  itemValue: {
    type: String,
    default: 'id'
  },
  label: {
    type: String,
    default: 'Buscar'
  },
  placeholder: {
    type: String,
    default: 'Escriba al menos 2 caracteres...'
  },
  returnObject: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: 'ri-search-line'
  },
  minChars: {
    type: Number,
    default: 2
  },
  initialItem: {
    type: Object,
    default: null
  },
  extraParams: {
    type: Object,
    default: () => ({})
  },
  clearable: {
    type: Boolean,
    default: true
  },
  variant: {
    type: String,
    default: 'outlined'
  },
  density: {
    type: String,
    default: 'compact'
  },
  hideDetails: {
    type: [Boolean, String],
    default: 'auto'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const loading = ref(false)
const items = ref([])
const search = ref('')

const fetchItems = async (query) => {
  if (!query || query.length < props.minChars) {
    if (props.modelValue && props.initialItem) {
      items.value = [props.initialItem]
    } else {
      items.value = []
    }
    return
  }

  loading.value = true
  try {
    const params = {
      q: query,
      ...props.extraParams
    }
    const response = await $api(props.endpoint, { params })
    items.value = response?.data || response || []
  } catch (error) {
    console.error('Error in VSearch:', error)
    items.value = []
  } finally {
    loading.value = false
  }
}

const onSearchInput = useDebounceFn((val) => {
  search.value = val || ''
  fetchItems(search.value)
}, 300)

const hideNoData = computed(() => {
  return search.value.length < props.minChars
})

onMounted(() => {
  if (props.initialItem) {
    items.value = [props.initialItem]
  }
})

watch(() => props.initialItem, (newVal) => {
  if (newVal) {
    items.value = [newVal]
  }
}, { deep: true })
</script>

<template>
  <VAutocomplete
    :model-value="modelValue"
    @update:model-value="(val) => { emit('update:modelValue', val); emit('change', val) }"
    :items="items"
    :item-title="itemTitle"
    :item-value="itemValue"
    :label="label"
    :placeholder="placeholder"
    :return-object="returnObject"
    :clearable="clearable"
    :variant="variant"
    :density="density"
    :hide-details="hideDetails"
    :hide-no-data="hideNoData"
    :no-filter="true"
    @update:search="onSearchInput"
  >
    <template #prepend-inner>
      <VProgressCircular
        v-if="loading"
        indeterminate
        color="primary"
        size="20"
        width="2"
      />
      <VIcon v-else :icon="icon" />
    </template>
    <template #item="data">
      <slot name="item" v-bind="data">
        <VListItem v-bind="data.props" />
      </slot>
    </template>

    <template #append v-if="$slots.append">
      <slot name="append"></slot>
    </template>
    
    <template #no-data>
      <div class="px-4 py-2 text-medium-emphasis text-body-2">
        <span v-if="search.length < minChars">
          Escriba al menos {{ minChars }} caracteres para buscar
        </span>
        <span v-else>
          No se encontraron resultados
        </span>
      </div>
    </template>
  </VAutocomplete>
</template>
