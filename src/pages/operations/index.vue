<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'

// Router y seguridad
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Obtener usuario actual del localStorage
const currentUser = computed(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
})

// Validación de seguridad - solo rol_id === 1 puede acceder
const canAccessOperations = computed(() => {
    const user = currentUser.value
    const roleId = user?.role?.id
    console.log('🔍 Debug - Usuario actual:', user)
    console.log('🔍 Debug - role:', user?.role)
    console.log('🔍 Debug - role.id:', roleId)
    console.log('🔍 Debug - Tipo de role.id:', typeof roleId)
    console.log('🔍 Debug - ¿Puede acceder?:', user && roleId === 1)
    return user && roleId === 1
})

// Estado del componente
const operations = ref([])
const loading = ref(false)
const isTransferDialogVisible = ref(false)

// Datos para las cards principales
const mainCards = ref([

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
        description: 'Transferencias entre cuentas de la compañia',
        icon: 'ri-arrow-left-right-line',
        color: '#8B5CF6',
        buttonText: 'Nueva transferecia',
        action: 'transfer'
    }
])

// Datos de movimientos recientes agrupados por día
const recentMovements = ref([
    {
        date: 'Hoy',
        movements: [
            {
                id: 1,
                type: 'income',
                description: 'Pago de cliente #1234',
                amount: 1250.00,
                account: 'Banco Guayaquil',
                method: 'transfer',
                time: '14:30'
            },
            {
                id: 2,
                type: 'expense',
                description: 'Compra de insumos',
                amount: 450.00,
                account: 'Caja Chica',
                method: 'cash',
                time: '10:15'
            }
        ]
    },
    {
        date: 'Ayer',
        movements: [
            {
                id: 3,
                type: 'income',
                description: 'Venta de servicios',
                amount: 890.00,
                account: 'Banco Guayaquil',
                method: 'transfer',
                time: '16:45'
            },
            {
                id: 4,
                type: 'expense',
                description: 'Pago de servicios básicos',
                amount: 320.00,
                account: 'Banco Guayaquil',
                method: 'transfer',
                time: '09:20'
            }
        ]
    },
    {
        date: 'Lunes 5 Mayo',
        movements: [
            {
                id: 5,
                type: 'income',
                description: 'Ingreso por ventas',
                amount: 2100.00,
                account: 'Caja Chica',
                method: 'cash',
                time: '18:30'
            }
        ]
    }
])

// Datos del panel inteligente
const financialSummary = ref({
    monthlyIncome: 15420.00,
    monthlyExpense: 8750.00,
    currentBalance: 6670.00,
    lastTransfer: {
        amount: 500.00,
        from: 'Banco Guayaquil',
        to: 'Caja Chica',
        date: '2026-05-04'
    },
    alerts: [
        'Gastos elevados esta semana'
    ]
})

// Datos para el gráfico
const chartData = ref([
    { week: 'Sem 1', income: 3200, expense: 2100 },
    { week: 'Sem 2', income: 4100, expense: 2800 },
    { week: 'Sem 3', income: 3800, expense: 2200 },
    { week: 'Sem 4', income: 4320, expense: 1650 }
])

// Funciones de acción
const handleCardAction = (action) => {
    switch (action) {
        case 'employee-expenses':
            //showNotification('Navegando a Gestión de Pagos...', 'info')
            router.push('/finanzas/employee-expenses')
            break
        case 'register-contribution':
            //showNotification('Navegando a Aportes de Capital...', 'info')
            router.push({ name: 'aportes-index' })
            break
        case 'movements-index':
            //showNotification('Función de Nuevo Movimiento en desarrollo', 'info')
            console.log("Dirigiendose a movimientos");

            router.push({ name: 'movements-index' })
            break
        case 'transfer':
            console.log(router.getRoutes());
            router.push('/transfers');
            break
    }
}

// Formatear moneda
const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value)
}

// Montar componente - la carga se maneja en el watch
onMounted(() => {
    console.log('🚀 Dashboard de Operaciones montado - Usuario actual:', currentUser.value)
})
</script>

<template>
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

    <div v-else class="dashboard-container">
        <!-- Header -->
        <div class="dashboard-header">
            <div class="header-content">
                <i class="ri-exchange-funds-line header-icon"></i>
                <h1 class="header-title">Gestión de Operaciones</h1>
                <p class="header-subtitle">Control financiero integral para tu negocio</p>
            </div>
        </div>

        <!-- SECCIÓN SUPERIOR - CARDS PRINCIPALES -->
        <div class="main-cards-section">
            <div class="cards-grid">
                <div v-for="card in mainCards" :key="card.title" class="main-card"
                    :style="{ '--card-color': card.color }">
                    <div class="card-icon">
                        <i :class="card.icon"></i>
                    </div>
                    <div class="card-content">
                        <h3 class="card-title">{{ card.title }}</h3>
                        <p class="card-description">{{ card.description }}</p>
                        <button @click="handleCardAction(card.action)" class="card-button">
                            {{ card.buttonText }}
                            <i class="ri-arrow-right-line"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- SECCIÓN INFERIOR - LAYOUT EN 2 COLUMNAS -->
        <div class="content-section">
            <!-- COLUMNA IZQUIERDA: MOVIMIENTOS RECIENTES -->
            <div class="movements-column">
                <div class="section-header">
                    <i class="ri-history-line"></i>
                    <h2>Movimientos Recientes</h2>
                </div>
                <div class="movements-list">
                    <div v-for="day in recentMovements" :key="day.date" class="day-group">
                        <div class="day-header">{{ day.date }}</div>
                        <div v-for="movement in day.movements" :key="movement.id" class="movement-item">
                            <div class="movement-icon" :class="movement.type">
                                <i :class="movement.type === 'income' ? 'ri-arrow-down-line' : 'ri-arrow-up-line'"></i>
                            </div>
                            <div class="movement-details">
                                <div class="movement-description">{{ movement.description }}</div>
                                <div class="movement-meta">
                                    <span class="movement-account">{{ movement.account }}</span>
                                    <span class="movement-method">{{ movement.method === 'cash' ? 'Efectivo' :
                                        'Transferencia' }}</span>
                                    <span class="movement-time">{{ movement.time }}</span>
                                </div>
                            </div>
                            <div class="movement-amount" :class="movement.type">
                                {{ movement.type === 'income' ? '+' : '-' }}${{
                                    formatCurrency(movement.amount).replace('$', '') }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- COLUMNA DERECHA: PANEL INTELIGENTE -->
            <div class="panel-column">
                <!-- Resumen Financiero -->
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


                <!-- Información Adicional -->
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
                                    {{ financialSummary.lastTransfer.from }} → {{ financialSummary.lastTransfer.to }}
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

        <!-- Diálogos -->
        <TransferDialog v-model="isTransferDialogVisible" />
    </div>
</template>

<style scoped>
/* Variables de color */
:root {
    --primary-color: #3B82F6;
    --success-color: #10B981;
    --warning-color: #F59E0B;
    --info-color: #8B5CF6;
    --expense-color: #EF4444;
    --income-color: #10B981;
    --background: #F8FAFC;
    --surface: #FFFFFF;
    --text-primary: #1E293B;
    --text-secondary: #64748B;
    --border-color: #E2E8F0;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Contenedor principal */
.dashboard-container {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--background);
    min-height: 100vh;
    padding: 24px;
}

/* Header */
.dashboard-header {
    margin-bottom: 32px;
}

.header-content {
    text-align: center;
}

.header-icon {
    font-size: 48px;
    color: var(--primary-color);
    margin-bottom: 16px;
}

.header-title {
    font-size: 32px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 8px 0;
    line-height: 1.2;
}

.header-subtitle {
    font-size: 16px;
    color: var(--text-secondary);
    margin: 0;
    font-weight: 400;
}

/* SECCIÓN SUPERIOR - CARDS PRINCIPALES */
.main-cards-section {
    margin-bottom: 48px;
}

.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin-bottom: 48px;
}

.main-card {
    background: var(--surface);
    border-radius: 16px;
    padding: 32px;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-color);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

.main-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--card-color);
}

.main-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
}

.card-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: var(--card-color);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

.card-icon i {
    font-size: 24px;
    color: white;
}

.card-content {
    text-align: left;
}

.card-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
    line-height: 1.3;
}

.card-description {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 24px 0;
    line-height: 1.5;
}

.card-button {
    background: var(--card-color);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
    width: 100%;
    justify-content: center;
}

.card-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-button i {
    font-size: 16px;
}

/* SECCIÓN INFERIOR - LAYOUT EN 2 COLUMNAS */
.content-section {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 32px;
}

/* COLUMNA IZQUIERDA: MOVIMIENTOS RECIENTES */
.movements-column {
    background: var(--surface);
    border-radius: 16px;
    padding: 24px;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-color);
}

.section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
}

.section-header i {
    font-size: 24px;
    color: var(--primary-color);
}

.section-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

.movements-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.day-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.day-header {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 12px;
}

.movement-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--background);
    border-radius: 12px;
    transition: all 0.2s ease;
}

.movement-item:hover {
    background: #F1F5F9;
}

.movement-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.movement-icon.income {
    background: rgba(16, 185, 129, 0.1);
    color: var(--income-color);
}

.movement-icon.expense {
    background: rgba(239, 68, 68, 0.1);
    color: var(--expense-color);
}

.movement-icon i {
    font-size: 18px;
}

.movement-details {
    flex: 1;
    min-width: 0;
}

.movement-description {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 4px;
}

.movement-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--text-secondary);
}

.movement-account {
    font-weight: 500;
}

.movement-method {
    padding: 2px 6px;
    background: var(--border-color);
    border-radius: 4px;
    font-size: 11px;
}

.movement-amount {
    font-size: 16px;
    font-weight: 600;
    flex-shrink: 0;
}

.movement-amount.income {
    color: var(--income-color);
}

.movement-amount.expense {
    color: var(--expense-color);
}

/* COLUMNA DERECHA: PANEL INTELIGENTE */
.panel-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.panel-card {
    background: var(--surface);
    border-radius: 16px;
    padding: 24px;
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-color);
}

.panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
}

.panel-header i {
    font-size: 20px;
    color: var(--primary-color);
}

.panel-header h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

/* Resumen Financiero */
.summary-items {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color);
}

.summary-item:last-child {
    border-bottom: none;
}

.summary-item.total {
    padding-top: 16px;
    border-top: 2px solid var(--primary-color);
    border-bottom: none;
}

.summary-label {
    font-size: 14px;
    color: var(--text-secondary);
}

.summary-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
}

.summary-value.income {
    color: var(--income-color);
}

.summary-value.expense {
    color: var(--expense-color);
}

/* Gráfico */
.chart-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.chart-bars {
    display: flex;
    align-items: end;
    justify-content: space-between;
    height: 120px;
    gap: 8px;
}

.chart-bar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
}

.bar {
    width: 100%;
    min-height: 8px;
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
}

.bar.income {
    background: var(--income-color);
}

.bar.expense {
    background: var(--expense-color);
}

.bar-label {
    font-size: 11px;
    color: var(--text-secondary);
    text-align: center;
}

.chart-legend {
    display: flex;
    justify-content: center;
    gap: 16px;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
}

.legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

.legend-color.income {
    background: var(--income-color);
}

.legend-color.expense {
    background: var(--expense-color);
}

/* Información Adicional */
.additional-info {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.info-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: var(--background);
    border-radius: 8px;
}

.info-item i {
    color: var(--primary-color);
    font-size: 16px;
    flex-shrink: 0;
}

.info-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 2px;
}

.info-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
}

.info-date {
    font-size: 11px;
    color: var(--text-secondary);
}

.alert-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 8px;
    color: var(--warning-color);
    font-size: 13px;
}

.alert-item i {
    font-size: 14px;
    flex-shrink: 0;
}

/* Responsive */
@media (max-width: 1200px) {
    .content-section {
        grid-template-columns: 1fr;
        gap: 24px;
    }

    .panel-column {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 24px;
    }
}

@media (max-width: 768px) {
    .dashboard-container {
        padding: 16px;
    }

    .cards-grid {
        grid-template-columns: 1fr;
        gap: 16px;
    }

    .main-card {
        padding: 24px;
    }

    .content-section {
        gap: 20px;
    }

    .movement-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }

    .movement-amount {
        align-self: flex-end;
    }
}

@media (max-width: 480px) {
    .header-title {
        font-size: 24px;
    }

    .card-button {
        padding: 14px 16px;
        font-size: 13px;
    }

    .movement-meta {
        flex-wrap: wrap;
        gap: 8px;
    }
}
</style>
