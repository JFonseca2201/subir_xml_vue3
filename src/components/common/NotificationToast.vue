<script setup>
import { watch } from 'vue'
import Swal from 'sweetalert2'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: 'success',
    validator: value => ['success', 'error', 'warning', 'info'].includes(value),
  },
  timeout: {
    type: Number,
    default: 3000,
  },
})

const emit = defineEmits(['update:show'])

const getIcon = () => {
  const t = (props.type || 'success').toLowerCase()
  if (t === 'success') return 'success'
  if (t === 'error') return 'error'
  if (t === 'warning') return 'warning'
  if (t === 'info') return 'info'
  return 'info'
}

// Watch para mostrar la notificación cuando show cambia a true
watch(() => props.show, newVal => {
  if (newVal) {
    const iconType = getIcon()

    const bgColors = {
      success: '#ecfdf5',
      error: '#fef2f2',
      warning: '#fffbeb',
      info: '#eff6ff',
    }
    const textColors = {
      success: '#065f46',
      error: '#991b1b',
      warning: '#92400e',
      info: '#1e40af',
    }

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: iconType,
      title: props.message,
      showConfirmButton: false,
      timer: props.timeout,
      timerProgressBar: true,
      didOpen: toast => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
      },
      customClass: {
        popup: 'custom-swal-toast border',
      },
      background: bgColors[iconType] || '#ecfdf5',
      color: textColors[iconType] || '#065f46',
    }).then(() => {
      emit('update:show', false)
    })
  }
})
</script>

<template>
  <!-- Este componente ahora usa SweetAlert2, no necesita template -->
</template>
