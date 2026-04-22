// Función para personalizar nombres de cuentas de manera centralizada
export function getAccountDisplayName(account) {
    if (!account) return 'CAJA CHICA'; // Fallback principal

    const name = (account.name || '').toLowerCase();
    const originalName = account.name || '';

    // Primero detectar caja chica por tipo o nombre específico
    if (account.type === 'cash' ||
        name.includes('caja chica') ||
        name.includes('cajachica') ||
        name.includes('caja_chica') ||
        name === 'cash' ||
        name === 'caja') {
        return 'CAJA CHICA'; // No necesita paréntesis, es el nombre completo
    }

    // Detectar bancos por nombre (ya que bank_name está undefined)
    if (account.type === 'bank') {
        // Mapeo de nombres personalizados para bancos basado en account.name
        const bankMap = {
            'banco pichincha': 'CAJA',
            'pichincha': 'CAJA',
            'banco guayaquil': 'BANCOS',
            'guayaquil': 'BANCOS'
        };

        const lowerName = name.toLowerCase().trim();
        for (const [key, value] of Object.entries(bankMap)) {
            if (lowerName.includes(key)) {
                return `${value} (${originalName.toUpperCase()})`;
            }
        }

        // Si es un banco pero no coincide con el mapeo, mostrar BANCOS
        if (name.includes('banco')) {
            return `BANCOS (${originalName.toUpperCase()})`;
        }

        // Para cualquier otro banco, mostrar BANCOS
        return `BANCOS (${originalName.toUpperCase()})`;
    }

    // Detectar por nombre si no hay tipo bank
    if (name.includes('pichincha')) {
        return `CAJA (${originalName.toUpperCase()})`;
    }

    if (name.includes('guayaquil')) {
        return `BANCOS (${originalName.toUpperCase()})`;
    }

    // Fallback final: usar name en mayúsculas
    return originalName ? originalName.toUpperCase() : 'CAJA CHICA';
}

export function formatAccountDisplay(account, showLastFour = true) {
    if (!account) return 'CUENTA DESCONOCIDA';

    const displayName = getAccountDisplayName(account);
    const lastFour = account.last_four || account.account_number?.slice(-4) || '****';

    return showLastFour ? `${displayName} (${lastFour})` : displayName;
}
