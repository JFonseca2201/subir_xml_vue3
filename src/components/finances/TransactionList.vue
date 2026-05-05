<template>
  <div class="transaction-list">
    <!-- Resumen de Saldos -->
    <VCard class="mb-6">
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center gap-2">
          <VIcon icon="ri-wallet-line" color="primary" size="24" />
          <span class="text-h6 font-weight-bold">Resumen de Saldos</span>
        </div>
      </VCardTitle>
      <VCardText class="pa-4 pt-2">
        <VRow>
          <VCol 
            v-for="account in accounts" 
            :key="account.id" 
            cols="12" 
            sm="6" 
            md="4" 
            lg="3"
          >
            <VCard 
              :class="getAccountCardClass(account.type)" 
              class="account-balance-card"
              elevation="2"
            >
              <VCardText class="pa-4">
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ getAccountTypeLabel(account.type) }}
                    </div>
                    <div class="text-h6 font-weight-bold">
                      {{ account.name }}
                    </div>
                  </div>
                  <VAvatar 
                    :color="getAccountIconColor(account.type)" 
                    size="40"
                    variant="tonal"
                  >
                    <VIcon :icon="getAccountIcon(account.type)" size="20" />
                  </VAvatar>
                </div>
                <div class="mt-3">
                  <div class="text-h5 font-weight-bold" :class="getBalanceColor(account.current_balance)">
                    ${{ formatCurrency(account.current_balance) }}
                  </div>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Filtros -->
    <VCard class="mb-6">
      <VCardText class="pa-4">
        <VRow>
          <VCol cols="12" md="4">
            <VSelect
              v-model="filters.accountId"
              :items="accountFilterItems"
              label="Filtrar por Cuenta"
              placeholder="Todas las cuentas"
              clearable
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="ri-bank-line"
              item-title="name"
              item-value="id"
            />
          </VCol>
          <VCol cols="12" md="4">
            <VSelect
              v-model="filters.type"
              :items="typeFilterItems"
              label="Filtrar por Tipo"
              placeholder="Todos los tipos"
              clearable
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="ri-filter-line"
              item-title="label"
              item-value="value"
            />
          </VCol>
          <VCol cols="12" md="4">
            <VBtn
              color="primary"
              variant="tonal"
              @click="refreshData"
              :loading="loading"
              prepend-icon="ri-refresh-line"
            >
              Actualizar
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Tabla de Movimientos -->
    <VCard>
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center justify-space-between w-100">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-history-line" color="primary" size="24" />
            <span class="text-h6 font-weight-bold">Movimientos Recientes</span>
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ filteredTransactions.length }} movimientos
          </div>
        </div>
      </VCardTitle>
      <VDivider />
      
      <VCardText class="pa-0">
        <VDataTable
          :headers="headers"
          :items="filteredTransactions"
          :loading="loading"
          :sort-by="[{ key: 'date', order: 'desc' }]"
          class="transaction-table"
          density="comfortable"
        >
          <!-- Fecha -->
          <template #item.date="{ item }">
            <div class="text-body-2">
              {{ formatDate(item.date) }}
            </div>
          </template>

          <!-- Cuenta -->
          <template #item.account="{ item }">
            <div class="d-flex align-center gap-2">
              <VAvatar size="24" :color="getAccountIconColor(item.account?.type)" variant="tonal">
                <VIcon :icon="getAccountIcon(item.account?.type)" size="14" />
              </VAvatar>
              <div>
                <div class="text-body-2 font-weight-medium">
                  {{ item.account?.name || 'N/A' }}
                </div>
                <div class="text-caption text-primary">
                  {{ getAccountTypeLabel(item.account?.type) }}
                </div>
              </div>
            </div>
          </template>

          <!-- Tipo -->
          <template #item.type="{ item }">
            <VChip
              :color="getTypeColor(item.type)"
              variant="tonal"
              size="small"
              class="font-weight-medium"
            >
              <VIcon start :icon="getTypeIcon(item.type)" size="16" />
              {{ getTypeLabel(item.type) }}
            </VChip>
          </template>

          <!-- Monto -->
          <template #item.amount="{ item }">
            <div class="text-body-2 font-weight-bold" :class="getAmountColor(item.type)">
              {{ getAmountPrefix(item.type) }}${{ formatCurrency(item.amount) }}
            </div>
          </template>

          <!-- Descripción -->
          <template #item.description="{ item }">
            <div class="text-body-2">
              {{ item.description || '-' }}
            </div>
          </template>

          <!-- Referencia -->
          <template #item.reference="{ item }">
            <div v-if="item.reference" class="d-flex align-center gap-1">
              <VIcon 
                :icon="getReferenceIcon(item.reference_type)" 
                size="16" 
                color="medium-emphasis"
              />
              <span class="text-body-2">{{ item.reference }}</span>
            </div>
            <span v-else class="text-medium-emphasis text-body-2">-</span>
          </template>

          <!-- Usuario -->
          <template #item.user="{ item }">
            <div class="d-flex align-center gap-2">
              <VAvatar size="24" color="primary" variant="tonal">
                <span class="text-caption font-weight-bold">
                  {{ getUserInitials(item.user?.name) }}
                </span>
              </VAvatar>
              <div class="text-body-2">
                {{ item.user?.name || 'Sistema' }}
              </div>
            </div>
          </template>

          <!-- Acciones -->
          <template #item.actions="{ item }">
            <VBtn
              icon="ri-eye-line"
              variant="text"
              size="small"
              color="primary"
              @click="viewTransaction(item)"
            />
          </template>

          <!-- No data -->
          <template #no-data>
            <div class="text-center pa-6">
              <VIcon icon="ri-inbox-line" size="48" color="medium-emphasis" class="mb-3" />
              <div class="text-h6 text-medium-emphasis mb-2">No hay movimientos</div>
              <div class="text-body-2 text-medium-emphasis">
                No se encontraron transacciones con los filtros seleccionados.
              </div>
            </div>
          </template>
        </VDataTable>
      </VCardText>
    </VCard>

    <!-- Diálogo de detalles -->
    <VDialog v-model="showDetailsDialog" max-width="600">
      <VCard v-if="selectedTransaction">
        <VCardTitle class="pa-4 pb-2">
          <div class="d-flex align-center gap-2">
            <VIcon :icon="getTypeIcon(selectedTransaction.type)" :color="getTypeColor(selectedTransaction.type)" />
            <span>Detalles del Movimiento</span>
          </div>
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <VRow>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">Fecha</div>
              <div class="text-body-2 font-weight-medium">
                {{ formatDate(selectedTransaction.date) }}
              </div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">Tipo</div>
              <VChip
                :color="getTypeColor(selectedTransaction.type)"
                variant="tonal"
                size="small"
              >
                {{ getTypeLabel(selectedTransaction.type) }}
              </VChip>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">Cuenta</div>
              <div class="text-body-2 font-weight-medium">
                {{ selectedTransaction.account?.name }}
              </div>
            </VCol>
            <VCol cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">Monto</div>
              <div class="text-h5 font-weight-bold" :class="getAmountColor(selectedTransaction.type)">
                {{ getAmountPrefix(selectedTransaction.type) }}${{ formatCurrency(selectedTransaction.amount) }}
              </div>
            </VCol>
            <VCol cols="12">
              <div class="text-caption text-medium-emphasis mb-1">Descripción</div>
              <div class="text-body-2">
                {{ selectedTransaction.description || 'Sin descripción' }}
              </div>
            </VCol>
            <VCol v-if="selectedTransaction.reference" cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">Referencia</div>
              <div class="text-body-2">
                {{ selectedTransaction.reference }}
              </div>
            </VCol>
            <VCol v-if="selectedTransaction.user" cols="12" md="6">
              <div class="text-caption text-medium-emphasis mb-1">Registrado por</div>
              <div class="text-body-2">
                {{ selectedTransaction.user.name }}
              </div>
            </VCol>
          </VRow>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn @click="showDetailsDialog = false">
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

// Props
const props = defineProps({
  refreshTrigger: {
    type: Number,
    default: 0
  }
})

// Data
const loading = ref(false)
const accounts = ref([])
const transactions = ref([])
const selectedTransaction = ref(null)
const showDetailsDialog = ref(false)

// Filtros
const filters = ref({
  accountId: null,
  type: null
})

// Headers de la tabla
const headers = [
  { title: 'Fecha', key: 'date', sortable: true },
  { title: 'Cuenta', key: 'account', sortable: false },
  { title: 'Tipo', key: 'type', sortable: true },
  { title: 'Monto', key: 'amount', sortable: true },
  { title: 'Descripción', key: 'description', sortable: false },
  { title: 'Referencia', key: 'reference', sortable: false },
  { title: 'Usuario', key: 'user', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false, width: 80 }
]

// Items para filtros
const accountFilterItems = computed(() => [
  { id: null, name: 'Todas las cuentas' },
  ...accounts.value
])

const typeFilterItems = [
  { value: null, label: 'Todos los tipos' },
  { value: 1, label: 'Ingreso' },
  { value: 2, label: 'Egreso' },
  { value: 3, label: 'Transferencia' }
]

// Computed properties
const filteredTransactions = computed(() => {
  let filtered = transactions.value

  // Filtrar por cuenta
  if (filters.value.accountId) {
    filtered = filtered.filter(t => t.account_id === filters.value.accountId)
  }

  // Filtrar por tipo
  if (filters.value.type !== null) {
    filtered = filtered.filter(t => t.type === filters.value.type)
  }

  return filtered
})

// Methods
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0)
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const getAccountTypeLabel = (type) => {
  if (!type) return 'Desconocido'
  
  const types = {
    cash: 'EFECTIVO',
    bank: 'BANCO',
    efectivo: 'EFECTIVO',
    banco: 'BANCO',
    EFECTIVO: 'EFECTIVO',
    BANCO: 'BANCO',
    'Efectivo': 'EFECTIVO',
    'Banco': 'BANCO'
  }
  return types[type] || type.toUpperCase()
}

const getAccountIcon = (type) => {
  const icons = {
    cash: 'ri-money-dollar-circle-line',
    bank: 'ri-bank-line',
    efectivo: 'ri-money-dollar-circle-line',
    banco: 'ri-bank-line',
    EFECTIVO: 'ri-money-dollar-circle-line',
    BANCO: 'ri-bank-line',
    'Efectivo': 'ri-money-dollar-circle-line',
    'Banco': 'ri-bank-line'
  }
  return icons[type] || icons.cash || 'ri-bank-line'
}

const getAccountIconColor = (type) => {
  const colors = {
    cash: 'success',
    bank: 'info',
    efectivo: 'success',
    banco: 'info',
    EFECTIVO: 'success',
    BANCO: 'info',
    'Efectivo': 'success',
    'Banco': 'info'
  }
  return colors[type] || 'primary'
}

const getAccountCardClass = (type) => {
  return `account-card-${type}`
}

const getBalanceColor = (balance) => {
  if (balance < 0) return 'text-error'
  if (balance > 0) return 'text-success'
  return 'text-medium-emphasis'
}

const getTypeLabel = (type) => {
  const types = {
    1: 'Ingreso',
    2: 'Egreso',
    3: 'Transferencia'
  }
  return types[type] || type
}

const getTypeIcon = (type) => {
  const icons = {
    1: 'ri-arrow-down-line',
    2: 'ri-arrow-up-line',
    3: 'ri-arrow-left-right-line'
  }
  return icons[type] || 'ri-file-list-line'
}

const getTypeColor = (type) => {
  const colors = {
    1: 'success',
    2: 'error',
    3: 'info'
  }
  return colors[type] || 'default'
}

const getAmountColor = (type) => {
  if (type === 1) return 'text-success'  // Ingreso - verde
  if (type === 2) return 'text-error'    // Egreso - rojo
  return 'text-info'  // Transferencia - azul
}

const getAmountPrefix = (type) => {
  if (type === 1) return '+'  // Ingreso
  if (type === 2) return '-'  // Egreso
  return ''  // Transferencia
}

const getReferenceIcon = (type) => {
  const icons = {
    invoice: 'ri-file-text-line',
    work_order: 'ri-tools-line'
  }
  return icons[type] || 'ri-file-line'
}

const getUserInitials = (name) => {
  if (!name) return 'S'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const viewTransaction = (transaction) => {
  selectedTransaction.value = transaction
  showDetailsDialog.value = true
}

const loadAccounts = async () => {
  try {
    const response = await axios.get('/api/accounts-test')
    accounts.value = response.data.data || []
    console.log('🏦 Cuentas cargadas:', accounts.value)
    console.log('🏦 Tipos de cuenta:', accounts.value.map(a => ({ name: a.name, type: a.type })))
  } catch (error) {
    console.error('Error loading accounts:', error)
  }
}

const loadTransactions = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/transactions-test?per_page=100')
    transactions.value = response.data.data?.transactions?.data || []
  } catch (error) {
    console.error('Error loading transactions:', error)
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  await Promise.all([loadAccounts(), loadTransactions()])
}

// Watch para actualización automática
watch(() => props.refreshTrigger, () => {
  refreshData()
})

// Lifecycle
onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.transaction-list {
  padding: 0;
}

.account-balance-card {
  transition: all 0.3s ease;
  border-left: 4px solid;
}

.account-card-cash {
  border-left-color: rgb(var(--v-theme-success));
}

.account-card-bank {
  border-left-color: rgb(var(--v-theme-info));
}

.account-balance-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.transaction-table :deep(.v-data-table__tr:hover) {
  background-color: rgb(var(--v-theme-surface-variant));
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
  color: rgb(var(--v-theme-on-surface-variant)) !important;
  opacity: 0.7;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .account-balance-card .v-card-text {
    padding: 16px;
  }
  
  .transaction-table :deep(.v-data-table__th),
  .transaction-table :deep(.v-data-table__td) {
    padding: 8px;
  }
}
</style>
