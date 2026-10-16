<script setup>
defineProps({
  hasDraft: {
    type: Boolean,
    default: false,
  },
  draftTimestamp: {
    type: [Number, String],
    default: null,
  },
})

defineEmits(['discard'])
</script>

<template>
  <!-- FormDraftAlert desactivado globalmente a petición del usuario -->
  <span />
</template>
