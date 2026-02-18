<script setup>
import { watch } from 'vue'
import Swal from 'sweetalert2'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'success',
    validator: (value) => ['success', 'error', 'warning', 'info'].includes(value)
  },
  timeout: {
    type: Number,
    default: 3000
  }
})

const emit = defineEmits(['update:show'])

const getIcon = () => {
  switch (props.type) {
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
    default:
      return 'info'
  }
}

const getColor = () => {
  switch (props.type) {
    case 'success':
      return '#10b981'
    case 'error':
      return '#ef4444'
    case 'warning':
      return '#f59e0b'
    case 'info':
      return '#3b82f6'
    default:
      return '#3b82f6'
  }
}

// Watch para mostrar la notificación cuando show cambia a true
watch(() => props.show, (newVal) => {
  if (newVal) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: getIcon(),
      title: props.message,
      showConfirmButton: false,
      timer: props.timeout,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
      },
      customClass: {
        popup: 'custom-swal-toast'
      },
      background: getColor(),
      color: '#ffffff'
    }).then(() => {
      emit('update:show', false)
    })
  }
})
</script>

<template>
  <!-- Este componente ahora usa SweetAlert2, no necesita template -->
</template>

<style>
.custom-swal-toast {
  border-radius: 12px !important;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
  backdrop-filter: blur(10px) !important;
}
</style>
