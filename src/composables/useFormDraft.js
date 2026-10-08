import { ref, watch, onMounted, onUnmounted, nextTick, isRef } from 'vue'

/**
 * Composable universal para autoguardado y recuperación de formularios (textos, selects, arrays, imágenes).
 * 
 * @param {string} draftKey - Clave única para identificar el formulario (ej: 'pedido_distribuidor', 'product_add', 'work_order_add')
 * @param {Ref|Object} formData - Objeto reactivo con los campos del formulario
 * @param {Object} options - Opciones de configuración
 * @param {number} [options.debounce=400] - Tiempo en ms para guardar tras la última edición
 * @param {boolean} [options.autoRestore=true] - Si restaura automáticamente al montar
 * @param {Array<string>} [options.excludeFields=[]] - Campos a ignorar en el guardado
 * @param {Function} [options.onRestored=null] - Callback ejecutado tras restaurar
 */
export function useFormDraft(draftKey, formData, options = {}) {
  const {
    debounce = 400,
    autoRestore = true,
    excludeFields = [],
    onRestored = null,
  } = options

  const storageKey = `ot_draft_${draftKey}`
  const hasDraft = ref(false)
  const draftTimestamp = ref(null)
  const isRestoring = ref(false)
  let debounceTimeout = null

  // Función segura para serializar objetos (excluyendo File/Blob directos si son incompatibles con JSON, o convirtiendo DataURLs)
  const serializeForm = obj => {
    try {
      const source = isRef(obj) ? obj.value : obj
      if (!source || typeof source !== 'object') return null

      const cleaned = {}
      for (const [key, value] of Object.entries(source)) {
        if (excludeFields.includes(key)) continue

        // Si es una función o nodo DOM, ignorar
        if (typeof value === 'function' || (value && value instanceof Element)) continue

        // Si es un File nativo, no se puede guardar en JSON a menos que se guarde el preview / DataURL
        if (value instanceof File) {
          continue
        }

        cleaned[key] = value
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
    if (isRestoring.value) return
    const serialized = serializeForm(formData)
    if (serialized) {
      try {
        localStorage.setItem(storageKey, serialized)
        hasDraft.value = true
        draftTimestamp.value = Date.now()
      } catch (e) {
        // En caso de que se llene la cuota de localStorage
        console.warn(`[useFormDraft] Cuota de almacenamiento excedida para ${draftKey}:`, e)
      }
    }
  }

  // Restaurar desde localStorage
  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (!saved) return false

      const parsed = JSON.parse(saved)
      if (!parsed || !parsed.data) return false

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
  const clearDraft = () => {
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
  const checkHasDraft = () => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        hasDraft.value = true
        draftTimestamp.value = parsed.savedAt
        return true
      }
    } catch (e) {
      // Ignore
    }
    hasDraft.value = false
    return false
  }

  // Watcher con debounce para guardar automáticamente cuando el usuario escribe
  const stopWatch = watch(
    formData,
    () => {
      if (isRestoring.value) return
      if (debounceTimeout) clearTimeout(debounceTimeout)
      debounceTimeout = setTimeout(() => {
        saveDraft()
      }, debounce)
    },
    { deep: true },
  )

  onMounted(() => {
    checkHasDraft()
    if (autoRestore) {
      restoreDraft()
    }
  })

  onUnmounted(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout)
    stopWatch()
  })

  return {
    hasDraft,
    draftTimestamp,
    saveDraft,
    restoreDraft,
    clearDraft,
    discardDraft,
  }
}
