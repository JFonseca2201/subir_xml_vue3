<script setup>
import AppSearchHeaderBg from '@images/pages/app-search-header-bg.png'

const props = defineProps({
  title: {
    type: String,
    required: false,
  },
  subtitle: {
    type: String,
    required: false,
  },
  customClass: {
    type: String,
    required: false,
  },
  placeholder: {
    type: String,
    required: false,
    default: 'Ask a question..',
  },
})

defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <!-- 👉 Search Banner  -->
  <VCard
    flat
    class="text-center search-header"
    :class="customClass"
    :style="`background: url(${AppSearchHeaderBg});`"
  >
    <VCardText>
      <slot>
        <h4 class="text-h4 text-primary">
          {{ title }}
        </h4>

        <!-- 👉 Search Input -->
        <VTextField
          v-bind="$attrs"
          :placeholder="placeholder"
          class="search-header-input mx-auto my-4"
        >
          <template #prepend-inner>
            <VIcon
              icon="ri-search-line"
              size="18"
            />
          </template>
        </VTextField>

        <p class="text-body-1">
          {{ subtitle }}
        </p>
      </slot>
    </VCardText>
  </VCard>
</template>
