import { ref, watch, onMounted, onUnmounted, nextTick, isRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

/**
 * Composable universal para autoguardado y recuperación de formularios (textos, selects, arrays, imágenes).
 * Protegido contra re-guardado accidental de formularios ya guardados o finalizados.
 * 
 * Regla de negocio:
 * - Los borradores SÓLO se conservan si ocurre un imprevisto del sistema (cierre de pestaña, recarga accidental F5, caída).
 * - Si el usuario interactúa con botones de acción (Cancelar, Volver al Listado, Guardar) o navega deliberadamente,
 *   el borrador se elimina y el formulario de entrada se limpia.
 * 
 * @param {string} draftKey - Clave única para identificar el formulario (ej: 'sale_add', 'product_add', 'work_order_add')
 * @param {Ref|Object} formData - Objeto reactivo con los campos del formulario
 * @param {Object} options - Opciones de configuración
 * @param {number} [options.debounce=400] - Tiempo en ms para guardar tras la última edición
 * @param {boolean} [options.autoRestore=true] - Si restaura automáticamente al montar
 * @param {Array<string>} [options.excludeFields=[]] - Campos a ignorar en el guardado
 * @param {Function} [options.validateDraft=null] - Función validadora (data) => boolean para verificar si el borrador es válido
 * @param {Function} [options.onRestored=null] - Callback ejecutado tras restaurar
 * @param {boolean} [options.clearOnRouteLeave=true] - Si elimina el borrador al navegar por rutas internas
 * @param {Function} [options.resetForm=null] - Callback para limpiar el formulario cuando se usa una acción o navegación
 * @param {Function} [options.isMeaningful=null] - Función para comprobar si hay datos reales del usuario
 */
export function useFormDraft(draftKey, formData, options = {}) {
  const {
    debounce = 400,
    autoRestore = true,
    excludeFields = [],
    validateDraft = null,
    onRestored = null,
    clearOnRouteLeave = true,
    resetForm = null,
    isMeaningful = null,
  } = options

  const storageKey = `ot_draft_${draftKey}`
  const hasDraft = ref(false)
  const draftTimestamp = ref(null)
  const isRestoring = ref(false)
  let isSavingDisabled = false
  let debounceTimeout = null
  let stopWatchFn = null

  // Claves que son configuración o valores por defecto del sistema (no representan datos reales del usuario)
  const defaultIgnoredKeys = [
    'user_id',
    'usuario_id',
    'date',
    'created_at',
    'service_date',
    'number',
    'document_number',
    'status',
    'document_type',
    'payment_status',
    'is_credited',
    'ambiente',
    'state',
    'tax_rate',
  ]

  // Función segura para serializar objetos (excluyendo File/Blob y detectando contenido significativo)
  const serializeForm = obj => {
    try {
      const source = isRef(obj) ? obj.value : obj
      if (!source || typeof source !== 'object') return null

      // Si se definió un comprobador personalizado de datos significativos
      if (typeof isMeaningful === 'function') {
        if (!isMeaningful(source)) {
          return null
        }
      }

      const cleaned = {}
      let hasMeaningfulData = false

      for (const [key, value] of Object.entries(source)) {
        if (excludeFields.includes(key)) continue

        // Si es una función o nodo DOM, ignorar
        if (typeof value === 'function' || (value && value instanceof Element)) continue

        // Si es un File nativo, no serializar
        if (value instanceof File) continue

        // Detectar si el formulario contiene datos reales ingresados por el usuario
        if (!defaultIgnoredKeys.includes(key)) {
          if (Array.isArray(value) && value.length > 0) {
            hasMeaningfulData = true
          } else if (typeof value === 'object' && value !== null) {
            if (Object.keys(value).length > 0) {
              hasMeaningfulData = true
            }
          } else if (value !== null && value !== undefined && value !== '' && value !== false && value !== 0) {
            hasMeaningfulData = true
          }
        }

        cleaned[key] = value
      }

      // Si no hay datos ingresados por el usuario (está vacío o en estado inicial por defecto), no guardar borrador
      if (!hasMeaningfulData && typeof isMeaningful !== 'function') {
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

  // Limpiar borrador tras guardar con éxito en backend o al accionar cancelar/volver
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
    const fn = resetCallback || resetForm
    if (typeof fn === 'function') {
      fn()
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

  // Manejo de salida inesperada del sistema (cierre de pestaña, recarga por error o corte de conexión)
  const handleBeforeUnload = () => {
    saveDraft()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
  }

  // Si se navega internamente mediante Vue Router (botones de acción, menús, etc.),
  // se limpia el borrador y se resetea el formulario según la regla de negocio
  try {
    onBeforeRouteLeave(() => {
      if (clearOnRouteLeave) {
        clearDraft()
        if (typeof resetForm === 'function') {
          resetForm()
        }
      }
    })
  } catch (e) {
    // onBeforeRouteLeave solo opera si se invoca dentro de un componente de ruta
  }

  onMounted(() => {
    const hasValid = checkHasDraft()
    if (autoRestore && hasValid) {
      restoreDraft()
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
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
