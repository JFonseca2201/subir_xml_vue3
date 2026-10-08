<script setup>
import { computed } from 'vue'

const props = defineProps({
  hasDraft: {
    type: Boolean,
    default: false,
  },
  draftTimestamp: {
    type: [Number, String],
    default: null,
  },
})

const emit = defineEmits(['discard'])

const formattedTime = computed(() => {
  if (!props.draftTimestamp) return ''
  try {
    const date = new Date(props.draftTimestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    return ''
  }
})
</script>

<template>
  <Transition name="fade-slide">
    <VAlert
      v-if="hasDraft"
      type="info"
      variant="tonal"
      density="compact"
      rounded="lg"
      class="mb-4 border-info elevation-0 form-draft-alert"
    >
      <template #prepend>
        <VIcon
          icon="ri-history-line"
          size="20"
          color="info"
        />
      </template>

      <div class="d-flex align-center justify-space-between flex-wrap gap-2 w-100">
        <div class="text-caption font-weight-medium text-info-darken-1">
          <strong>Borrador recuperado:</strong> Se han restaurado tus datos no guardados {{ formattedTime ? `(guardado a las ${formattedTime})` : '' }}.
        </div>
        <VBtn
          size="x-small"
          variant="text"
          color="error"
          class="font-weight-bold text-none px-2"
          prepend-icon="ri-delete-bin-line"
          @click="emit('discard')"
        >
          Descartar borrador
        </VBtn>
      </div>
    </VAlert>
  </Transition>
</template>

<style scoped>
.form-draft-alert {
  border-left: 4px solid rgb(var(--v-theme-info)) !important;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
