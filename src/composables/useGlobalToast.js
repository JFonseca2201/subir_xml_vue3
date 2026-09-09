import { ref } from 'vue'

const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

/**
 * Extracts a user-friendly, specific error message from an API response or error object.
 */
export function extractErrorMessage(err, fallback = 'Ha ocurrido un error inesperado') {
  if (!err) return fallback

  const genericMessages = [
    'The given data was invalid.',
    'Error de validación',
    'Datos inválidos',
    'Errores de validación.',
    'Datos de entrada no válidos.',
  ]

  if (typeof err === 'string') {
    const isGeneric = genericMessages.includes(err.trim())
    return isGeneric ? fallback : err
  }

  // Check ofetch / axios error response structures
  const data = err?.response?._data || err?.response?.data || err?.data || err?._data || err

  // 1. Check backend 'errors' object (e.g., { errors: { ruc: ["El RUC ya está registrado"] } })
  if (data?.errors && typeof data.errors === 'object') {
    const errorValues = Object.values(data.errors)
    for (const val of errorValues) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        return val[0]
      }
      if (typeof val === 'string') {
        return val
      }
    }
  }

  // 2. Check 'message' property
  if (data?.message && typeof data.message === 'string') {
    const isGeneric = genericMessages.includes(data.message.trim())
    if (!isGeneric) {
      return data.message
    }
  }

  // 3. Check 'error' property
  if (data?.error && typeof data.error === 'string') {
    return data.error
  }

  // 4. Check native exception message
  if (err?.message && typeof err.message === 'string') {
    const isGeneric = genericMessages.includes(err.message.trim())
    if (!isGeneric) {
      return err.message
    }
  }

  return fallback
}

export function useGlobalToast() {
  const showNotification = (messageOrError, type = 'success') => {
    let cleanMessage = ''

    if (type === 'error' || type === 'warning') {
      if (typeof messageOrError === 'string') {
        cleanMessage = extractErrorMessage(messageOrError, messageOrError)
      } else {
        cleanMessage = extractErrorMessage(messageOrError)
      }
    } else {
      cleanMessage = typeof messageOrError === 'string' ? messageOrError : String(messageOrError || '')
    }

    notificationMessage.value = cleanMessage
    notificationType.value = type
    notificationShow.value = true
  }

  return {
    notificationShow,
    notificationMessage,
    notificationType,
    showNotification,
    extractErrorMessage,
  }
}
