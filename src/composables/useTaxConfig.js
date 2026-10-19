import { computed } from 'vue'

/**
 * Configuración centralizada de impuestos (IVA Ecuador)
 * Evita datos quemados en cálculos tributarios y permite actualización legal inmediata.
 */
export const DEFAULT_TAX_PERCENT = Number(import.meta.env?.VITE_DEFAULT_TAX_RATE) || 15
export const DEFAULT_TAX_RATE = DEFAULT_TAX_PERCENT / 100 // 0.15

export const useTaxConfig = () => {
  // Lee de la sucursal o configuración del sistema si está disponible en localStorage
  const taxPercent = computed(() => {
    try {
      const sucursalData = localStorage.getItem('sucursal')
      if (sucursalData) {
        const parsed = JSON.parse(sucursalData)
        if (parsed.tax_rate !== undefined && parsed.tax_rate !== null) {
          const val = Number(parsed.tax_rate)
          if (!isNaN(val) && val >= 0) return val
        }
      }

      const userData = localStorage.getItem('user')
      if (userData) {
        const parsedUser = JSON.parse(userData)
        if (parsedUser.sucursal?.tax_rate !== undefined) {
          const val = Number(parsedUser.sucursal.tax_rate)
          if (!isNaN(val) && val >= 0) return val
        }
      }
    } catch (_) {}

    return DEFAULT_TAX_PERCENT
  })

  const taxRate = computed(() => taxPercent.value / 100)

  /**
   * Calcula el impuesto IVA sobre un valor base
   * @param {number|string} amount - Monto base
   * @param {boolean|number} isTaxable - Si grava IVA
   * @returns {number}
   */
  const calculateTax = (amount, isTaxable = true) => {
    const num = Number(amount) || 0
    const taxable = isTaxable === true || isTaxable === 1 || isTaxable === '1'
    if (!taxable) return 0
    
    return Number((num * taxRate.value).toFixed(2))
  }

  /**
   * Calcula el total con IVA incluido
   * @param {number|string} amount - Monto base
   * @param {boolean|number} isTaxable - Si grava IVA
   * @returns {number}
   */
  const calculateTotalWithTax = (amount, isTaxable = true) => {
    const num = Number(amount) || 0
    const taxable = isTaxable === true || isTaxable === 1 || isTaxable === '1'
    if (!taxable) return num

    return Number((num * (1 + taxRate.value)).toFixed(2))
  }

  return {
    DEFAULT_TAX_PERCENT,
    DEFAULT_TAX_RATE,
    taxPercent,
    taxRate,
    calculateTax,
    calculateTotalWithTax,
  }
}
