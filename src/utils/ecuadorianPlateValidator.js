/**
 * Lógica de Placas Ecuador - Vue 3 Composition API Friendly
 */

// Centralizamos los Regex para mantenimiento
const PATTERNS = {
    PARTICULAR: /^[A-Z]{3}-\d{4}$/,   // ABC-1234
    COMERCIAL: /^[A-Z]{3}-\d{3}$/,   // XYZ-999
    MOTO: /^[A-Z]{1}-\d{3}[A-Z]{1}$/, // A-123B
    ANTIGUA: /^\d{4}-[A-Z]{3}$/    // 1234-ABC
};

/**
 * Formateador Inteligente
 * No solo añade el guion, sino que detecta dónde ponerlo según el tipo de entrada
 */
export const formatEcuadorianPlate = (input) => {
    if (!input) return '';

    // Limpiamos todo excepto letras y números
    let clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Caso 1: Formato estándar (Letras primero) - ABC1234 o A123B
    if (/^[A-Z]/.test(clean)) {
        // Si empieza con 3 letras, el guion va en la pos 3 (ABC-...)
        if (clean.length > 3 && /^[A-Z]{3}/.test(clean)) {
            return `${clean.slice(0, 3)}-${clean.slice(3, 7)}`;
        }
        // Si empieza con 1 letra y sigue un número, es moto (A-123B)
        if (clean.length > 1 && /^[A-Z]{1}\d/.test(clean)) {
            return `${clean.slice(0, 1)}-${clean.slice(1, 5)}`;
        }
    }

    // Caso 2: Formato antiguo (Números primero) - 1234ABC
    if (/^\d/.test(clean)) {
        if (clean.length > 4) {
            return `${clean.slice(0, 4)}-${clean.slice(4, 7)}`;
        }
    }

    return clean;
};

/**
 * Validador Robusto
 */
export const validateEcuadorianPlate = (plate) => {
    if (!plate) return false;
    return Object.values(PATTERNS).some(regex => regex.test(plate));
};

/**
 * Regla para Vuetify / Form Validations
 */
export const plateValidationRule = (value) => {
    if (!value || value.trim() === '') return 'La placa es obligatoria';

    return validateEcuadorianPlate(value)
        || 'Formato inválido (Ej: ABC-1234, A-123B, 1234-ABC)';
};