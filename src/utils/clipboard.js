/**
 * Universal clipboard copy utility that works reliably across:
 * - HTTPS and non-HTTPS (HTTP / IP addresses, local network)
 * - Vuetify modal dialogs (without focus trap interference)
 * - Mobile (iOS / Android) and desktop browsers
 *
 * @param {string} text - The text to copy
 * @returns {Promise<boolean>}
 */

function fallbackExecCopy(textToCopy) {
  if (typeof document === 'undefined') return false

  let textArea = null
  let activeContainer = null

  try {
    // 1. Locate the best active container (bypasses Vuetify modal focus-trap)
    activeContainer =
      document.querySelector('.v-overlay--active .v-overlay__content') ||
      document.querySelector('.v-dialog--active') ||
      document.querySelector('.v-dialog') ||
      document.activeElement?.closest?.('.v-overlay__content') ||
      document.activeElement?.closest?.('.v-dialog') ||
      document.activeElement?.parentElement ||
      document.body

    textArea = document.createElement('textarea')
    textArea.value = textToCopy

    // Crucial: keep it editable and focusable, but completely invisible
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.color = 'transparent'
    textArea.style.zIndex = '-9999'
    textArea.style.opacity = '0.01'
    textArea.setAttribute('aria-hidden', 'true')
    textArea.tabIndex = -1

    activeContainer.appendChild(textArea)

    // Focus and select range
    textArea.focus({ preventScroll: true })
    textArea.select()
    textArea.setSelectionRange(0, textToCopy.length)

    const successful = document.execCommand('copy')

    if (activeContainer && textArea.parentNode === activeContainer) {
      activeContainer.removeChild(textArea)
    }

    return !!successful
  } catch (err) {
    console.warn('[Clipboard] Fallback execCommand copy failed:', err)
    if (activeContainer && textArea && textArea.parentNode === activeContainer) {
      try {
        activeContainer.removeChild(textArea)
      } catch (_) {}
    }
    
    return false
  }
}

export async function copyToClipboard(text) {
  if (text === null || text === undefined) return false

  const textToCopy = String(text).trim()
  if (!textToCopy) return false

  // 1. If non-secure context (HTTP / IP address without SSL), execute fallback synchronously
  //    to preserve the active user interaction context token
  const isSecure = typeof window !== 'undefined' && window.isSecureContext && navigator?.clipboard?.writeText

  if (!isSecure) {
    const ok = fallbackExecCopy(textToCopy)
    if (ok) return true
  }

  // 2. Try modern async Clipboard API if available
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy)
      
      return true
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText rejected, attempting fallback:', err)
    }
  }

  // 3. Fallback execution
  return fallbackExecCopy(textToCopy)
}
