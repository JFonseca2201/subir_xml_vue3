<template>
    <div class="transfers-container pa-6">
        <div class="d-flex align-center justify-space-between mb-8">
            <div>
                <h1 class="text-h4 font-weight-black color-title mb-1">
                    <VIcon icon="ri-exchange-line" color="primary" class="mr-2" />
                    Transferencias entre Cuentas
                </h1>
                <p class="text-body-2 text-medium-emphasis">Movimientos de dinero entre cuentas bancarias</p>
            </div>
            <VBtn color="primary" size="large" variant="elevated" @click="openAddDialog" class="rounded-lg">
                <VIcon icon="ri-add-line" start />
                Nueva Transferencia
            </VBtn>
        </div>

        <VRow>
            <VCol cols="12" md="3">
                <VCard class="pa-5 rounded-lg border-light sticky-top" elevation="0">
                    <div class="text-overline mb-4 text-primary font-weight-bold">Filtros</div>

                    <VSelect v-model="selectedFromAccount" :items="accountOptions" item-title="label" item-value="value"
                        label="Cuenta Origen" variant="outlined" density="comfortable" class="mb-4"
                        prepend-inner-icon="ri-bank-line" clearable @update:modelValue="resetAndLoad" />

                    <VSelect v-model="selectedToAccount" :items="accountOptions" item-title="label" item-value="value"
                        label="Cuenta Destino" variant="outlined" density="comfortable" class="mb-4"
                        prepend-inner-icon="ri-bank-card-line" clearable @update:modelValue="resetAndLoad" />

                    <VTextField v-model="search" label="Descripción" variant="outlined" density="comfortable"
                        prepend-inner-icon="ri-search-line" clearable @keyup.enter="resetAndLoad" />

                    <VDivider class="my-6" />

                    <div class="text-center">
                        <div class="text-caption text-uppercase text-medium-emphasis">Total transferido</div>
                        <div class="text-h4 font-weight-black text-primary">${{ formatCurrency(globalSummary.total) }}
                        </div>
                        <div class="text-caption text-medium-emphasis mt-1">{{ globalSummary.count }} transferencias
                        </div>
                    </div>
                </VCard>
            </VCol>

            <VCol cols="12" md="9">
                <div v-if="isLoading" class="d-flex justify-center py-12">
                    <VProgressCircular indeterminate color="primary" />
                </div>

                <div v-else-if="groupedTransfers.length === 0" class="text-center py-12 empty-state">
                    <VIcon icon="ri-exchange-line" size="48" color="disabled" />
                    <p class="mt-2">No hay transferencias encontradas</p>
                </div>

                <div v-else>
                    <div v-for="group in groupedTransfers" :key="group.monthYear" class="mb-6">
                        <div class="d-flex align-center justify-space-between mb-2">
                            <div class="d-flex align-center">
                                <div class="month-icon-box mr-3">
                                    <VIcon icon="ri-calendar-event-fill" color="primary" size="24" />
                                </div>
                                <div>
                                    <div class="text-h6 font-weight-black color-title leading-tight">{{ group.monthName
                                        }}</div>
                                    <div class="text-subtitle-2 font-weight-bold text-medium-emphasis leading-tight">{{
                                        group.year }}</div>
                                </div>
                            </div>
                            <div class="total-badge px-4 py-1 rounded-pill">
                                <span class="text-h5 font-weight-black text-white">${{ formatCurrency(group.totalAmount)
                                    }}</span>
                            </div>
                        </div>

                        <VCard class="transaction-list-container rounded-xl" elevation="0" variant="outlined">
                            <div v-for="(transfer, index) in group.items" :key="transfer.id">
                                <div class="d-flex align-center pa-4 transaction-item">

                                    <div class="date-section text-center mr-6">
                                        <div class="text-h5 font-weight-black leading-tight">{{
                                            getDay(transfer.transfer_date) }}</div>
                                        <div class="text-overline font-weight-bold leading-tight">{{
                                            getMonthShort(transfer.transfer_date) }}</div>
                                    </div>

                                    <div class="flex-grow-1">
                                        <div class="text-subtitle-1 font-weight-bold color-title text-uppercase">
                                            {{ transfer.from_account?.bank_name }} → {{ transfer.to_account?.bank_name
                                            }}
                                        </div>
                                        <div class="text-caption text-medium-emphasis d-flex align-center">
                                            <VIcon icon="ri-arrow-right-line" size="14" class="mr-1" />
                                            {{ transfer.from_account?.bank_name }} ({{
                                                transfer.from_account?.account_name
                                                || '****' }})
                                            →
                                            {{ transfer.to_account?.bank_name }} ({{ transfer.to_account?.account_name
                                                ||
                                                '****' }})
                                        </div>
                                        <div v-if="transfer.description" class="text-caption text-medium-emphasis mt-1">
                                            <VIcon icon="ri-file-text-line" size="14" class="mr-1" />
                                            {{ transfer.description }}
                                        </div>
                                    </div>

                                    <div class="text-right ml-4 action-section">
                                        <div class="text-subtitle-1 font-weight-black text-primary">
                                            ${{ formatCurrency(transfer.amount) }}
                                        </div>
                                        <div class="d-flex justify-end gap-1">
                                            <VBtn icon="ri-pencil-line" variant="text" size="x-small" color="info"
                                                @click="openEditDialog(transfer)" />
                                            <VBtn icon="ri-delete-bin-line" variant="text" size="x-small" color="error"
                                                @click="openDeleteDialog(transfer)" />
                                        </div>
                                    </div>
                                </div>
                                <VDivider v-if="index < group.items.length - 1" class="mx-4" />
                            </div>
                        </VCard>
                    </div>

                    <div v-if="totalPages > 1" class="d-flex align-center justify-end mt-4">
                        <VPagination v-model="currentPage" :length="totalPages" :total-visible="5" density="comfortable"
                            size="small" @update:modelValue="loadTransfers" />
                    </div>
                </div>
            </VCol>
        </VRow>

        <!-- Diálogos -->
        <TransferAddDialog v-model="isAddDialogVisible" @success="onSuccess" />
        <TransferEditDialog v-model="isEditDialogVisible" :transfer-data="selectedTransfer" @success="onSuccess" />
        <TransferDeleteDialog v-model="isDeleteDialogVisible" :transfer-data="selectedTransfer" @success="onSuccess" />
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import TransferAddDialog from '@/components/inventory/transfers/TransferAddDialog.vue'
import TransferEditDialog from '@/components/inventory/transfers/TransferEditDialog.vue'
import TransferDeleteDialog from '@/components/inventory/transfers/TransferDeleteDialog.vue'

const { showNotification } = useGlobalToast()

// --- ESTADO ---
const isLoading = ref(false)
const rawTransfers = ref([])
const accounts = ref([])
const search = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const selectedFromAccount = ref(null)
const selectedToAccount = ref(null)

// --- ESTADO DE DIÁLOGOS ---
const isAddDialogVisible = ref(false)
const isEditDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const selectedTransfer = ref(null)

// --- OPCIONES ---
const monthOptions = [
    { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 }
]

const accountOptions = computed(() => {
    return accounts.value.map(account => ({
        label: `${getAccountDisplayName(account.bank_name, account.name)} (${account.last_four || account.account_number?.slice(-4) || '****'})`,
        value: account.id
    }))
})

// --- COMPUTED PROPERTIES ---
const groupedTransfers = computed(() => {
    const groups = {}
    rawTransfers.value.forEach(item => {
        const d = new Date(item.transfer_date)
        const m = d.getUTCMonth() + 1
        const y = d.getUTCFullYear()
        const key = `${m}-${y}`
        if (!groups[key]) {
            groups[key] = { monthYear: key, month: m, year: y, monthName: getMonthName(m), totalAmount: 0, items: [] }
        }
        groups[key].items.push(item)
        groups[key].totalAmount += parseFloat(item.amount || 0)
    })
    return Object.values(groups).sort((a, b) => b.year - a.year || b.month - a.month)
})

const globalSummary = computed(() => {
    const total = rawTransfers.value.reduce((acc, item) => acc + parseFloat(item.amount || 0), 0)
    return { total, count: rawTransfers.value.length }
})

// --- FUNCIONES DE UTILIDAD ---
const getDay = (dateStr) => dateStr ? new Date(dateStr).getUTCDate() : '??'
const getMonthShort = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '') : '...'
const formatCurrency = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const getMonthName = (val) => monthOptions.find(m => m.value === val)?.label || ''

// Función para personalizar nombres de cuentas
const getAccountDisplayName = (bankName, accountName) => {
    const name = bankName || accountName || ''

    // Si el nombre está vacío o es nulo, intentar detectar por otros campos
    if (!name || name.trim() === '') {
        return 'CAJA CHICA' // Por defecto para cuentas sin nombre
    }

    // Mapeo de nombres personalizados
    const nameMap = {
        'caja chica': 'CAJA CHICA',
        'cajachica': 'CAJA CHICA',
        'caja_chica': 'CAJA CHICA',
        'small box': 'CAJA CHICA',
        'petty cash': 'CAJA CHICA',
        'caja': 'CAJA',
        'cash': 'CAJA',
        'banco pichincha': 'CAJA',
        'pichincha': 'CAJA',
        'banco guayaquil': 'BANCOS',
        'guayaquil': 'BANCOS',
        'bank': 'BANCOS',
        'bancos': 'BANCOS'
    }

    // Buscar coincidencia (ignorando mayúsculas/minúsculas)
    const lowerName = name.toLowerCase().trim()
    for (const [key, value] of Object.entries(nameMap)) {
        if (lowerName.includes(key)) {
            return value
        }
    }

    // Si no hay coincidencia, usar el nombre original en mayúsculas
    return name.toUpperCase() || 'CUENTA'
}

// --- MÉTODOS ---
const resetAndLoad = () => { currentPage.value = 1; loadTransfers() }

const loadTransfers = async () => {
    isLoading.value = true
    try {
        const params = new URLSearchParams({ page: currentPage.value })
        if (search.value) params.append('search', search.value)
        if (selectedFromAccount.value) params.append('from_account_id', selectedFromAccount.value)
        if (selectedToAccount.value) params.append('to_account_id', selectedToAccount.value)

        const resp = await $api(`transfers?${params.toString()}`, { method: 'GET' })
        rawTransfers.value = resp.data || []
        totalPages.value = resp.last_page || 1
        totalItems.value = resp.total || 0
    } catch (e) {
        showNotification('Error al cargar transferencias', 'error')
    } finally {
        isLoading.value = false
    }
}

const loadAccounts = async () => {
    try {
        const resp = await $api('available-accounts', { method: 'GET' })
        console.log('Raw API response from available-accounts:', resp)

        // Usar el formato correcto: resp.accounts
        let accountsData = []
        if (resp && resp.accounts && Array.isArray(resp.accounts)) {
            accountsData = resp.accounts
        } else if (resp && resp.data && Array.isArray(resp.data)) {
            accountsData = resp.data
        } else if (resp && Array.isArray(resp)) {
            accountsData = resp
        } else {
            console.warn('Unexpected response format:', resp)
        }

        accounts.value = accountsData
        console.log('Processed accounts data:', accounts.value)

        if (accounts.value.length === 0) {
            console.warn('No accounts found in response')
            showNotification('No se encontraron cuentas disponibles', 'warning')
        }
    } catch (e) {
        console.error('Error loading accounts:', e)
        showNotification('Error al cargar las cuentas disponibles', 'error')
        accounts.value = []
    }
}

// --- MANEJO DE DIÁLOGOS ---
const openAddDialog = () => isAddDialogVisible.value = true
const openEditDialog = (transfer) => { selectedTransfer.value = transfer; isEditDialogVisible.value = true }
const openDeleteDialog = (transfer) => { selectedTransfer.value = transfer; isDeleteDialogVisible.value = true }
const onSuccess = () => {
    console.log('onSuccess called - reloading transfer data')

    // Forzar refresco con un pequeño delay para asegurar que el backend procese
    setTimeout(() => {
        loadTransfers()
        loadAccounts() // También recargar cuentas por si hay cambios en saldos
        selectedTransfer.value = null
        console.log('Transfer data reload triggered')
    }, 500)
}

// --- LIFECYCLE ---
onMounted(() => {
    loadTransfers()
    loadAccounts()
})
</script>

<style scoped>
.transfers-container {
    background-color: #fcfcfc;
    min-height: 100vh;
}

.color-title {
    color: #2d3748;
}

.border-light {
    border: 1px solid #e2e8f0 !important;
}

.sticky-top {
    position: sticky;
    top: 24px;
    z-index: 10;
}

/* Estilos para el diseño */
.month-icon-box {
    background: #f0f4ff;
    padding: 8px;
    border-radius: 8px;
}

.total-badge {
    background: #76e037;
}

.transaction-list-container {
    border: 1px solid #e2e8f0 !important;
    background: white;
}

.transaction-item {
    transition: background-color 0.2s;
}

.date-section {
    min-width: 50px;
    color: #4a5568;
}

.action-section {
    min-width: 100px;
}

.leading-tight {
    line-height: 1.1;
}

.empty-state {
    color: #9ca3af;
}
</style>
