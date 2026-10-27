import { ref } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

export function useFormValidation() {
  const validationAlertVisible = ref(false)
  const validationAlertMessage = ref('')
  const { showNotification } = useGlobalToast()

  /**
   * Valida un formulario de Vuetify y en caso de error:
   * 1. Activa la alerta visible de validación (VAlert).
   * 2. Muestra un toast informativo claro.
   * 3. Hace scroll y foco suave al primer campo con error.
   */
  const validateAndNotify = async (formRef, containerSelector = null, customMessage = null) => {
    if (!formRef) return { valid: true }

    // En Vuetify 3 formRef puede ser el template ref directo
    const formInstance = formRef.value || formRef
    if (!formInstance?.validate) return { valid: true }

    const result = await formInstance.validate()
    const valid = result?.valid ?? (typeof result === 'boolean' ? result : true)
    const rawErrors = result?.errors || []

    if (!valid) {
      validationAlertVisible.value = true
      validationAlertMessage.value = customMessage || 'Por favor complete todos los casilleros obligatorios marcados en rojo antes de continuar.'

      showNotification('Campos obligatorios por llenar', 'warning')

      // Scroll y focus al primer campo con error
      setTimeout(() => {
        let root = null
        if (containerSelector) {
          root = document.querySelector(containerSelector)
        }
        if (!root && formInstance.$el) {
          root = formInstance.$el
        }
        if (!root) {
          root = document
        }

        const firstErrorEl = root.querySelector('.v-input--error, .v-field--error')
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          const inputEl = firstErrorEl.querySelector('input, select, textarea')
          if (inputEl) {
            inputEl.focus()
          }
        }
      }, 100)

      return { valid: false, errors: rawErrors }
    }

    validationAlertVisible.value = false
    validationAlertMessage.value = ''
    return { valid: true, errors: [] }
  }

  const resetValidationAlert = () => {
    validationAlertVisible.value = false
    validationAlertMessage.value = ''
  }

  return {
    validationAlertVisible,
    validationAlertMessage,
    validateAndNotify,
    resetValidationAlert,
  }
}
