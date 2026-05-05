<template>
  <div class="operations-dashboard">
    <!-- Header -->
    <VCard class="mb-6" elevation="0">
      <VCardText class="py-4">
        <div class="d-flex justify-space-between align-center">
          <div>
            <h1 class="text-h4 font-weight-bold text-primary mb-1">
              Operaciones Financieras
            </h1>
            <p class="text-black">
              Gestión de movimientos y transacciones
            </p>
          </div>
          <div class="d-flex gap-2">
            <VBtn color="success" variant="elevated" prepend-icon="ri-add-line" @click="openTransactionDialog(1)">
              Nuevo Ingreso
            </VBtn>
            <VBtn color="error" variant="elevated" prepend-icon="ri-add-line" @click="openTransactionDialog(2)">
              Nuevo Egreso
            </VBtn>
            <VBtn color="info" variant="elevated" prepend-icon="ri-exchange-line" @click="openTransferDialog">
              Transferencia
            </VBtn>
            <VBtn color="secondary" variant="outlined" prepend-icon="ri-refresh-line" @click="refreshData"
              :loading="loading">
              Actualizar
            </VBtn>
          </div>
        </div>
      </VCardText>
    </VCard>

    <!-- Sección de Cuentas y Transacciones Recientes -->
    <VRow>
      <!-- Balance de Cuentas -->
      <VCol cols="12" lg="6">
        <VCard elevation="2">
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon class="mr-2" color="primary">mdi-bank</VIcon>
            <span>Balance de Cuentas</span>
            <VSpacer />
            <VChip size="small" color="primary">
              {{ accounts.length }} cuentas
            </VChip>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-0">
            <div v-if="accounts.length === 0" class="text-center py-8">
              <VIcon size="48" color="medium-emphasis">mdi-bank-off-outline</VIcon>
              <p class="text-medium-emphasis mt-2">No hay cuentas registradas</p>
              <p class="text-small-emphasis mt-1">Crea tus primeras cuentas para comenzar a gestionar tus finanzas</p>
              <VBtn class="mt-4" color="primary" variant="outlined" prepend-icon="ri-add-line"
                @click="$router.push({ name: 'accounts-index' })">
                Gestionar Cuentas
              </VBtn>
            </div>
            <VList v-else density="compact">
              <VListItem v-for="account in accounts" :key="account.id" class="account-item">
                <template #prepend>
                  <VAvatar size="36" :color="account.type === 'bank' ? 'info' : 'success'" variant="tonal">
                    <VIcon size="20">
                      {{ account.type === 'bank' ? 'mdi-bank' : 'mdi-cash' }}
                    </VIcon>
                  </VAvatar>
                </template>
                <VListItemTitle class="font-weight-medium">
                  {{ account.name }}
                </VListItemTitle>
                <VListItemSubtitle>
                  {{ account.bank_name || 'Efectivo' }}
                </VListItemSubtitle>
                <template #append>
                  <div class="text-end">
                    <p class="text-h6 font-weight-bold"
                      :class="account.current_balance >= 0 ? 'text-success' : 'text-error'">
                      ${{ formatCurrency(account.current_balance) }}
                    </p>
                    <VChip size="x-small" :color="account.is_active ? 'success' : 'error'" variant="flat">
                      {{ account.is_active ? 'Activa' : 'Inactiva' }}
                    </VChip>
                  </div>
                </template>
              </VListItem>
            </VList>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Transacciones Recientes -->
      <VCol cols="12" lg="6">
        <VCard elevation="2">
          <VCardTitle class="d-flex align-center pa-4">
            <VIcon class="mr-2" color="primary">ri-time-line</VIcon>
            <span class="text-h6 font-weight-bold">Transacciones Recientes</span>
            <VSpacer />
            <VBtn size="small" variant="text" @click="viewAllTransactions">
              Ver todas
            </VBtn>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-0">
            <div v-if="recentTransactions.length === 0" class="text-center py-8">
              <VIcon size="48" color="medium-emphasis">ri-receipt-line</VIcon>
              <p class="text-medium-emphasis mt-2">No hay movimientos</p>
              <p class="text-small-emphasis mt-1">Comienza registrando tu primera transacción</p>
              <VBtn class="mt-4" color="primary" variant="outlined" prepend-icon="ri-add-line"
                @click="showTransactionDialog = true">
                Registrar Movimiento
              </VBtn>
            </div>
            <VList v-else density="compact">
              <VListItem v-for="transaction in recentTransactions" :key="transaction.id" class="transaction-item">
                <VListItemTitle>
                  <div class="d-flex flex-column">
                    <span class="font-weight-medium">{{ transaction.account?.name || 'Cuenta desconocida' }}</span>
                    <div class="text-xs text-gray-500 mt-1">
                      <span>{{ transaction.description }}</span>
                      <span v-if="transaction.work_order" class="ml-2">• OT: {{ transaction.work_order.id }}</span>
                      <span v-if="transaction.invoice_number" class="ml-2">• Factura: {{ transaction.invoice_number }}</span>
                    </div>
                  </div>
                </VListItemTitle>
                <VListItemSubtitle class="mt-1">
                  {{ formatDate(transaction.created_at) }}
                </VListItemSubtitle>
                <template #append>
                  <div class="text-end">
                    <p class="text-h6 font-weight-medium" :class="getTransactionTextColor(transaction.type)">
                      {{ getTransactionPrefix(transaction.type) }} ${{ formatCurrency(transaction.amount) }}
                    </p>
                  </div>
                </template>
              </VListItem>
            </VList>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Transaction Dialog -->
    <TransactionDialog v-model="showTransactionDialog" :transaction-type="selectedTransactionType"
      @refresh="refreshData" />

    <!-- Transfer Dialog -->
    <TransferDialog v-model="showTransferDialog" @refresh="refreshData" />

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import TransactionDialog from '@/components/finances/TransactionDialog.vue'
import TransferDialog from '@/components/finances/TransferDialog.vue'

const router = useRouter()

// Estado
const loading = ref(false)
const showTransactionDialog = ref(false)
const selectedTransactionType = ref(null)
const showTransferDialog = ref(false)
const accounts = ref([])
const transactions = ref([])

// Estadísticas
const stats = computed(() => {
  const income = transactions.value.filter(t => t.type === 1)
  const expenses = transactions.value.filter(t => t.type === 2)
  const transfers = transactions.value.filter(t => t.type === 3)

  return {
    totalIncome: income.reduce((sum, t) => sum + parseFloat(t.amount), 0),
    totalExpenses: expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0),
    totalTransfers: transfers.reduce((sum, t) => sum + parseFloat(t.amount), 0),
    incomeCount: income.length,
    expenseCount: expenses.length,
    transferCount: transfers.length,
    netBalance: income.reduce((sum, t) => sum + parseFloat(t.amount), 0) -
      expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0)
  }
})

// Transacciones recientes (últimas 10)
const recentTransactions = computed(() => {
  return transactions.value
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
})

// Métodos
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const getTransactionColor = (type) => {
  const colors = {
    1: 'success',
    2: 'error',
    3: 'info'
  }
  return colors[type] || 'grey'
}

const getTransactionIcon = (type) => {
  const icons = {
    1: 'mdi-cash-plus',
    2: 'mdi-cash-minus',
    3: 'mdi-bank-transfer'
  }
  return icons[type] || 'mdi-receipt'
}

const getTransactionTextColor = (type) => {
  // Income (1): Green, Expense (2): Red, Transfer (3): Blue
  if (type === 1) return 'text-success'
  if (type === 2) return 'text-error'
  if (type === 3) return 'text-info'
  return 'text-grey'
}

const getTransactionPrefix = (type) => {
  // Income (1): +, Expense (2): -, Transfer (3): (empty)
  if (type === 1) return '+'
  if (type === 2) return '-'
  return ''
}

const getTransactionTypeColor = (type) => {
  const colors = {
    1: 'success',
    2: 'error',
    3: 'info'
  }
  return ''
}

const getChipColor = (type) => {
  // Manejar diferentes formatos de tipo
  if (type === 1 || type === '1' || type === 'income') {
    return 'success'
  }
  if (type === 2 || type === '2' || type === 'expense') {
    return 'error'
  }
  return 'default'
}

const getTransactionTypeName = (transaction) => {
  if (!transaction.account) return 'Desconocido'

  const accountName = transaction.account.name.toLowerCase()
  const accountType = transaction.account.type?.toLowerCase()

  // Si es efectivo
  if (accountType === 'cash' || accountType === 'efectivo' || accountName.includes('efectivo') || accountName.includes('caja')) {
    return 'EFECTIVO'
  }

  // Si es banco Pichincha
  if (accountName.includes('pichincha') || accountName.includes('pich')) {
    return 'TRANSFERENCIA PICH'
  }

  // Si es banco Guayaquil
  if (accountName.includes('guayaquil') || accountName.includes('gye') || accountName.includes('guayaq')) {
    return 'TRANSFERENCIA GYE'
  }

  // Otros bancos
  if (accountType === 'bank' || accountType === 'banco' || accountName.includes('banco')) {
    return 'TRANSFERENCIA BANCO'
  }

  return transaction.account.name.toUpperCase()
}

const loadAccounts = async () => {
  try {
    const response = await axios.get('/api/accounts')
    accounts.value = response.data.data || []
  } catch (error) {
    console.error('Error loading accounts:', error)
  }
}

const loadTransactions = async () => {
  try {
    const response = await axios.get('/api/transactions?per_page=100')
    transactions.value = response.data.data?.transactions?.data || []
  } catch (error) {
    console.error('Error loading transactions:', error)
  }
}

const refreshData = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadAccounts(),
      loadTransactions()
    ])
  } finally {
    loading.value = false
  }
}

const openTransactionDialog = (type) => {
  selectedTransactionType.value = type
  showTransactionDialog.value = true
}

const openTransferDialog = () => {
  showTransferDialog.value = true
}

const viewAllTransactions = () => {
  // Navegar a la vista completa de transacciones
  router.push({ name: 'finances-transactions' })
}

// Lifecycle
onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.operations-dashboard {
  padding: 1.5rem;
  background: #f8f9fa;
  min-height: 100vh;
}

.stat-card {
  border-left: 4px solid;
  border-radius: 12px;
}

.action-avatar {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.transaction-item {
  min-height: 80px;
}

.transaction-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.transaction-item .v-list-item__content {
  padding: 8px 0;
}

.text-success {
  color: rgb(var(--v-theme-success)) !important;
}

.text-error {
  color: rgb(var(--v-theme-error)) !important;
}

.text-info {
  color: rgb(var(--v-theme-info)) !important;
}

.text-medium-emphasis {
  opacity: 0.9;
}

.text-gray-500 {
  color: #6b7280 !important;
}
</style>
