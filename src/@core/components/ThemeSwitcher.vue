<script setup>
import { computed, ref, watch } from 'vue'
import { useConfigStore } from '@core/stores/config'

const props = defineProps({
  themes: {
    type: Array,
    required: true,
  },
})

const configStore = useConfigStore()
const selectedItem = ref([configStore.theme])

// Update icon if theme is changed from other sources
watch(() => configStore.theme, () => {
  selectedItem.value = [configStore.theme]
}, { deep: true })

const currentThemeIcon = computed(() => {
  const current = props.themes?.find(t => t.name === configStore.theme)
  if (current?.icon) return current.icon
  if (configStore.theme === 'dark-glass') return 'ri-moon-cloudy-line'
  if (configStore.theme === 'semi-dark-glass') return 'ri-contrast-line'
  if (configStore.theme === 'light-glass') return 'ri-sun-cloudy-line'
  if (configStore.theme === 'taller') return 'ri-tools-fill'
  if (configStore.theme === 'dark') return 'ri-moon-clear-line'
  return 'ri-sun-line'
})

const currentThemeLabel = computed(() => {
  const current = props.themes?.find(t => t.name === configStore.theme)
  return current?.label || configStore.theme
})
</script>

<template>
  <IconBtn class="theme-switcher-btn">
    <VIcon :icon="currentThemeIcon" size="22" />

    <VTooltip activator="parent" open-delay="1000" scroll-strategy="close">
      <span class="text-capitalize">{{ currentThemeLabel }}</span>
    </VTooltip>
    <VMenu activator="parent" offset="15px" width="220">
      <VList v-model:selected="selectedItem" mandatory>
        <VListItem v-for="{ name, icon, label } in props.themes" :key="name" :value="name" :prepend-icon="icon"
          color="primary" class="px-4" @click="() => { configStore.theme = name }">
          <VListItemTitle>
            {{ label || name }}
          </VListItemTitle>
        </VListItem>
      </VList>
    </VMenu>
  </IconBtn>
</template>
