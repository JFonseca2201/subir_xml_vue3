<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Campos obligatorios por llenar',
  },
  message: {
    type: String,
    default: 'Por favor complete todos los casilleros obligatorios marcados en rojo antes de continuar.',
  },
  type: {
    type: String,
    default: 'warning', // 'warning' o 'error'
  },
})

const emit = defineEmits(['update:visible', 'close'])

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}
</script>

<template>
  <VAlert
    v-if="visible"
    :type="type"
    variant="tonal"
    density="comfortable"
    closable
    class="form-validation-alert mb-4 rounded-lg"
    @click:close="handleClose"
  >
    <template #prepend>
      <VIcon
        :icon="type === 'error' ? 'ri-error-warning-fill' : 'ri-alert-fill'"
        size="24"
        :class="type === 'error' ? 'text-error mr-2' : 'text-warning mr-2'"
      />
    </template>

    <div class="d-flex flex-column gap-1">
      <div class="font-weight-bold text-subtitle-2 line-height-1">
        {{ title }}
      </div>
      <div class="text-caption text-high-emphasis">
        {{ message }}
      </div>
    </div>
  </VAlert>
</template>

<style scoped>
.line-height-1 {
  line-height: 1.35;
}
</style>
