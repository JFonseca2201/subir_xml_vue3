<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'

// --- Router y Seguridad ---
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const currentUser = computed(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
})

const canAccessOperations = computed(() => {
    const user = currentUser.value
    const roleId = user?.role?.id
    return user && roleId === 1
})

// --- Estado del Componente ---
const recentMovements = ref([]) // Datos agrupados para el template
const loading = ref(true)
const isTransferDialogVisible = ref(false)

const financialSummary = ref({
    monthlyIncome: 0,
    monthlyExpense: 0,
    currentBalance: 0,
    lastTransfer: { amount: 0, from: 'N/A', to: 'N/A', date: '-' },
    alerts: []
})

const mainCards = [
    {
        title: 'Socios',
        description: 'Aportes de capital',
        icon: 'ri-group-line',
        color: '#10B981',
        buttonText: 'Registrar aporte',
        action: 'register-contribution'
    },
    {
        title: 'Gestión de pagos nómina',
        description: 'Pagos y adelantos al personal',
        icon: 'ri-user-3-line',
        color: '#6366F1',
        buttonText: 'Registrar pagos/adelantos',
        action: 'employee-expenses'
    },
    {
        title: 'Ingresos y Gastos',
        description: 'Registro de ingresos y egresos',
        icon: 'ri-exchange-dollar-line',
        color: '#F59E0B',
        buttonText: 'Nuevo movimiento',
        action: 'movements-index'
    },
    {
        title: 'Transferencias internas',
        description: 'Transferencias entre cuentas',
        icon: 'ri-arrow-left-right-line',
        color: '#8B5CF6',
        buttonText: 'Nueva transferencia',
        action: 'transfer'
    }
]

// --- Lógica de Procesamiento ---

// Agrupa la lista plana del backend en el formato que requiere el v-for anidado
const groupMovementsByDate = (movements) => {
    if (!movements || !Array.isArray(movements)) return []

    const groups = {}
    movements.forEach(m => {
        const rawDate = m.entry_date || 'Sin fecha'
        const dateKey = rawDate !== 'Sin fecha' ? rawDate.split('T')[0] : 'Sin fecha'

        if (!groups[dateKey]) {
            let displayDate = 'Sin fecha'
            if (rawDate !== 'Sin fecha') {
                displayDate = new Intl.DateTimeFormat('es-EC', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC'
                }).format(new Date(rawDate))
                // Capitalizar primera letra
                displayDate = displayDate.charAt(0).toUpperCase() + displayDate.slice(1)
            }
            groups[dateKey] = { dateKey, date: displayDate, movements: [] }
        }

        // 1. Extraer y mejorar la descripción
        let finalDesc = m.description || m.movable?.descripcion || 'Movimiento General'
        if (finalDesc.trim().endsWith(':') && m.movable?.descripcion) {
            // Une descripciones cortadas, ej: "Aporte de socio: " + "APORTE DE CAPITAL"
            finalDesc = `${finalDesc.trim()} ${m.movable.descripcion}`
        }

        // 2. Extraer el origen/módulo de forma legible
        let moduleName = 'General'
        if (m.movable_type) {
            const type = m.movable_type.split('\\').pop()
            const typeMap = { 'AporteCapital': 'Aporte de Capital', 'EmployeeExpense': 'Gasto de Empleado', 'Income': 'Ingreso Manual', 'Expense': 'Egreso Manual' }
            moduleName = typeMap[type] || type
        }

        // 3. Extraer el método de pago real priorizando metadata o movable
        let method = m.metadata?.metodo || m.movable?.metodo_pago || m.movable?.payment_method || m.metadata?.payment_method || m.payment_method || 'EFECTIVO'

        method = method.toUpperCase()
        if (method === 'TRANSFER') method = 'TRANSFERENCIA'
        if (method === 'CASH') method = 'EFECTIVO'

        groups[dateKey].movements.push({
            id: m.id,
            type: m.type, // 'income' | 'expense'
            description: finalDesc,
            module: moduleName,
            method: method,
            time: m.created_at ? new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '--:--',
            amount: parseFloat(m.amount || 0)
        })
    })

    // Ordenar por fecha descendente
    return Object.values(groups).sort((a, b) => {
        if (a.dateKey === 'Sin fecha') return 1;
        if (b.dateKey === 'Sin fecha') return -1;
        return new Date(b.dateKey) - new Date(a.dateKey);
    })
}

const dashboardOptions = async () => {
    loader.start()
    loading.value = true
    try {
        const response = await $api('/dashboard-financiero')
        console.log(response);

        // Asignar el resumen del backend al estado
        if (response.summary) {
            financialSummary.value = {
                ...financialSummary.value,
                monthlyIncome: response.summary.monthlyIncome,
                monthlyExpense: response.summary.monthlyExpense,
                currentBalance: response.summary.currentBalance
            }
        }

        // Procesar movimientos recientes
        recentMovements.value = groupMovementsByDate(response.movements)

    } catch (error) {
        console.error('Error al cargar datos del dashboard:', error)
        showNotification('No se pudieron cargar los datos financieros', 'error')
    } finally {
        loading.value = false
        loader.stop()
    }
}

// --- Utilidades ---
const handleCardAction = (action) => {
    switch (action) {
        case 'employee-expenses': router.push('/finanzas/employee-expenses'); break
        case 'register-contribution': router.push({ name: 'aportes-index' }); break
        case 'movements-index': router.push({ name: 'movements-index' }); break
        case 'transfer': router.push('/transfers'); break
    }
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value)
}

onMounted(() => {
    dashboardOptions()
})
</script>

<template>
    <!-- Pantalla de Bloqueo -->
    <div v-if="!canAccessOperations" class="d-flex justify-center align-center" style="height: 400px">
        <VCard class="pa-6 text-center">
            <VIcon size="64" color="error" class="mb-4">ri-lock-line</VIcon>
            <h3 class="text-h5 mb-2">Acceso Restringido</h3>
            <p class="text-medium-emphasis">No tienes permisos para acceder a la gestión de operaciones.</p>
            <VBtn color="primary" @click="router.push('/dashboard')" class="mt-4">
                Volver al Dashboard
            </VBtn>
        </VCard>
    </div>

    <!-- Dashboard Principal -->
    <div v-else class="dashboard-container">
        <div class="dashboard-header">
            <div class="header-content">
                <i class="ri-exchange-funds-line header-icon"></i>
                <h1 class="header-title">Gestión de Operaciones</h1>
                <p class="header-subtitle">Control financiero integral para tu negocio</p>
            </div>
        </div>


        <!-- Cards de Acceso Rápido -->
        <div class="main-cards-section">
            <div class="cards-grid">
                <div v-for="card in mainCards" :key="card.title" class="main-card"
                    :style="{ '--card-color': card.color }">

                    <!-- Contenedor alineado al centro verticalmente -->
                    <div
                        style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; height: 40px;">

                        <!-- Izquierda: Caja del Icono -->
                        <div class="card-icon"
                            style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; font-size: 1.5rem; box-sizing: border-box;">
                            <i :class="card.icon"></i>
                        </div>

                        <!-- Derecha: Botón Flecha (idéntico en altura y comportamiento de caja) -->
                        <button @click="handleCardAction(card.action)" class="card-button"
                            style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; padding: 0; border: none; margin: 0; cursor: pointer; font-size: 1.2rem; box-sizing: border-box; line-height: 1;">
                            <i class="ri-arrow-right-line"></i>
                        </button>

                    </div>

                    <div class="card-content">
                        <h3 class="card-title">{{ card.title }}</h3>
                        <p class="card-description">{{ card.description }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Estado de Carga -->
        <div v-if="loading" class="d-flex justify-center align-center py-12 my-12">
            <VProgressCircular indeterminate color="primary" size="48" width="5" />
        </div>

        <div v-else class="content-section">
            <!-- Columna Movimientos -->
            <div class="movements-column">
                <div class="section-header">
                    <i class="ri-history-line"></i>
                    <h2>Movimientos Recientes</h2>
                </div>

                <div v-if="recentMovements.length === 0" class="pa-5 text-center text-secondary">
                    No hay movimientos registrados este mes.
                </div>

                <div v-else class="movements-list"
                    style="max-height: 500px; overflow-y: auto; text-transform: capitalize;">
                    <div v-for="day in recentMovements" :key="day.dateKey" class="day-group">
                        <div class="day-header">{{ day.date }}</div>

                        <div v-for="movement in day.movements" :key="movement.id" class="movement-item">
                            <!-- Icono -->
                            <div class="movement-icon" :class="movement.type">
                                <i
                                    :class="movement.type === 'transfer' ? 'ri-arrow-left-right-line' : (movement.type === 'income' ? 'ri-arrow-down-line' : 'ri-arrow-up-line')"></i>
                            </div>

                            <!-- Detalles (Este debe tener flex: 1 para empujar el monto a la derecha) -->
                            <div class="movement-details" style="flex: 1;">
                                <div class="movement-description">{{ movement.description }}</div>
                                <div class="movement-meta">
                                    <span class="movement-account" style="display:flex; align-items:center; gap: 4px;">
                                        <i class="ri-folder-open-line"></i> {{ movement.module }}
                                    </span>
                                    <span class="separator">•</span>
                                    <span class="movement-method" style="display:flex; align-items:center; gap: 4px;">
                                        <i
                                            :class="movement.method === 'TRANSFERENCIA' ? 'ri-bank-card-line' : 'ri-money-dollar-circle-line'"></i>
                                        {{ movement.method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo' }}
                                    </span>
                                    <span class="separator">•</span>
                                    <span class="movement-time" style="display:flex; align-items:center; gap: 4px;">
                                        <i class="ri-time-line"></i> {{ movement.time }}
                                    </span>
                                </div>
                            </div>

                            <!-- Monto alineado a la derecha -->
                            <div class="movement-amount" :class="movement.type">
                                {{ movement.type === 'transfer' ? '' : (movement.type === 'income' ? '+' : '-') }}
                                {{ formatCurrency(movement.amount) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Columna Lateral -->
            <div class="panel-column">
                <div class="panel-card">
                    <div class="panel-header">
                        <i class="ri-pie-chart-line"></i>
                        <h3>Resumen Financiero</h3>
                    </div>
                    <div class="summary-items">
                        <div class="summary-item">
                            <span class="summary-label">Ingresos del mes</span>
                            <span class="summary-value income">{{ formatCurrency(financialSummary.monthlyIncome)
                            }}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Egresos del mes</span>
                            <span class="summary-value expense">{{ formatCurrency(financialSummary.monthlyExpense)
                            }}</span>
                        </div>
                        <div class="summary-item total">
                            <span class="summary-label">Balance actual</span>
                            <span class="summary-value">{{ formatCurrency(financialSummary.currentBalance) }}</span>
                        </div>
                    </div>
                </div>

                <div class="panel-card">
                    <div class="panel-header">
                        <i class="ri-information-line"></i>
                        <h3>Información Adicional</h3>
                    </div>
                    <div class="additional-info">
                        <div class="info-item">
                            <i class="ri-exchange-line"></i>
                            <div>
                                <div class="info-label">Última transferencia</div>
                                <div class="info-value">
                                    {{ formatCurrency(financialSummary.lastTransfer.amount) }}
                                </div>
                                <div class="info-date">{{ financialSummary.lastTransfer.date }}</div>
                            </div>
                        </div>
                        <div v-for="alert in financialSummary.alerts" :key="alert" class="alert-item">
                            <i class="ri-alert-line"></i>
                            <span>{{ alert }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <TransferDialog v-model="isTransferDialogVisible" />
    </div>
</template>
