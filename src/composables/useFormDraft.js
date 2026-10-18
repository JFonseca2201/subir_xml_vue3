import { ref, watch, onMounted, onUnmounted, nextTick, isRef } from 'vue'

/**
 * Composable universal para autoguardado y recuperación de formularios (textos, selects, arrays, imágenes).
 * Protegido contra re-guardado accidental de formularios ya guardados o finalizados.
 * 
 * @param {string} draftKey - Clave única para identificar el formulario (ej: 'pedido_distribuidor', 'product_add', 'work_order_add')
 * @param {Ref|Object} formData - Objeto reactivo con los campos del formulario
 * @param {Object} options - Opciones de configuración
 * @param {number} [options.debounce=400] - Tiempo en ms para guardar tras la última edición
 * @param {boolean} [options.autoRestore=true] - Si restaura automáticamente al montar
 * @param {Array<string>} [options.excludeFields=[]] - Campos a ignorar en el guardado
 * @param {Function} [options.validateDraft=null] - Función validadora (data) => boolean para verificar si el borrador es válido
 * @param {Function} [options.onRestored=null] - Callback ejecutado tras restaurar
 */
export function useFormDraft(draftKey, formData, options = {}) {
  const {
    debounce = 400,
    autoRestore = true,
    excludeFields = [],
    validateDraft = null,
    onRestored = null,
  } = options

  const storageKey = `ot_draft_${draftKey}`
  const hasDraft = ref(false)
  const draftTimestamp = ref(null)
  const isRestoring = ref(false)
  let isSavingDisabled = false
  let debounceTimeout = null
  let stopWatchFn = null

  // Función segura para serializar objetos (excluyendo File/Blob y detectando contenido significativo)
  const serializeForm = obj => {
    try {
      const source = isRef(obj) ? obj.value : obj
      if (!source || typeof source !== 'object') return null

      const cleaned = {}
      let hasMeaningfulData = false

      for (const [key, value] of Object.entries(source)) {
        if (excludeFields.includes(key)) continue

        // Si es una función o nodo DOM, ignorar
        if (typeof value === 'function' || (value && value instanceof Element)) continue

        // Si es un File nativo, no serializar
        if (value instanceof File) continue

        // Detectar si el formulario contiene datos reales ingresados por el usuario
        if (
          key !== 'user_id' &&
          key !== 'date' &&
          key !== 'service_date' &&
          key !== 'number' &&
          key !== 'document_number' &&
          key !== 'status'
        ) {
          if (Array.isArray(value) && value.length > 0) {
            hasMeaningfulData = true
          } else if (value !== null && value !== undefined && value !== '' && value !== false) {
            hasMeaningfulData = true
          }
        }

        cleaned[key] = value
      }

      // Si no hay datos ingresados por el usuario (está vacío o en estado inicial por defecto), no guardar borrador
      if (!hasMeaningfulData) {
        return null
      }

      return JSON.stringify({
        data: cleaned,
        savedAt: Date.now(),
      })
    } catch (e) {
      console.warn(`[useFormDraft] Error serializando borrador para ${draftKey}:`, e)
      return null
    }
  }

  // Guardar en localStorage
  const saveDraft = () => {
    if (isSavingDisabled || isRestoring.value) return
    const serialized = serializeForm(formData)
    if (serialized) {
      try {
        localStorage.setItem(storageKey, serialized)
        hasDraft.value = true
        draftTimestamp.value = Date.now()
      } catch (e) {
        console.warn(`[useFormDraft] Cuota de almacenamiento excedida para ${draftKey}:`, e)
      }
    } else {
      // Si el formulario quedó limpio o sin datos significativos, eliminar borrador previo
      try {
        localStorage.removeItem(storageKey)
        hasDraft.value = false
        draftTimestamp.value = null
      } catch (e) {}
    }
  }

  // Restaurar desde localStorage
  const restoreDraft = (customValidator = null) => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (!saved) {
        hasDraft.value = false
        return false
      }

      const parsed = JSON.parse(saved)
      if (!parsed || !parsed.data) {
        hasDraft.value = false
        return false
      }

      // Validar si el borrador ya pertenece a un registro ya guardado/salvado
      const validator = customValidator || validateDraft
      if (typeof validator === 'function') {
        const isValid = validator(parsed.data, parsed)
        if (!isValid) {
          clearDraft()
          return false
        }
      }

      isRestoring.value = true
      const target = isRef(formData) ? formData.value : formData

      // Mezclar campos guardados en el objeto reactivo actual
      Object.keys(parsed.data).forEach(key => {
        if (!excludeFields.includes(key)) {
          target[key] = parsed.data[key]
        }
      })

      hasDraft.value = true
      draftTimestamp.value = parsed.savedAt

      nextTick(() => {
        isRestoring.value = false
        if (typeof onRestored === 'function') {
          onRestored(parsed.data)
        }
      })

      return true
    } catch (e) {
      console.warn(`[useFormDraft] Error restaurando borrador para ${draftKey}:`, e)
      return false
    }
  }

  // Limpiar borrador tras guardar con éxito en backend
  // Cancela debounces pendientes, apaga el observador y previene que el registro salvado se vuelva a autoguardar
  const clearDraft = () => {
    isSavingDisabled = true
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
      debounceTimeout = null
    }
    if (typeof stopWatchFn === 'function') {
      stopWatchFn()
      stopWatchFn = null
    }
    try {
      localStorage.removeItem(storageKey)
      hasDraft.value = false
      draftTimestamp.value = null
    } catch (e) {
      // Ignore
    }
  }

  // Descartar borrador y reiniciar
  const discardDraft = (resetCallback = null) => {
    clearDraft()
    if (typeof resetCallback === 'function') {
      resetCallback()
    }
  }

  // Comprobar si hay borrador disponible
  const checkHasDraft = (customValidator = null) => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.data) {
          const validator = customValidator || validateDraft
          if (typeof validator === 'function') {
            const isValid = validator(parsed.data, parsed)
            if (!isValid) {
              clearDraft()
              return false
            }
          }
          hasDraft.value = true
          draftTimestamp.value = parsed.savedAt
          return true
        }
      }
    } catch (e) {
      // Ignore
    }
    hasDraft.value = false
    return false
  }

  // Iniciar watcher con debounce
  const initWatcher = () => {
    if (stopWatchFn) return
    stopWatchFn = watch(
      formData,
      () => {
        if (isSavingDisabled || isRestoring.value) return
        if (debounceTimeout) clearTimeout(debounceTimeout)
        debounceTimeout = setTimeout(() => {
          saveDraft()
        }, debounce)
      },
      { deep: true },
    )
  }

  initWatcher()

  onMounted(() => {
    const hasValid = checkHasDraft()
    if (autoRestore && hasValid) {
      restoreDraft()
    }
  })

  onUnmounted(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout)
    if (typeof stopWatchFn === 'function') stopWatchFn()
  })

  return {
    hasDraft,
    draftTimestamp,
    saveDraft,
    restoreDraft,
    clearDraft,
    discardDraft,
    checkHasDraft,
  }
}
