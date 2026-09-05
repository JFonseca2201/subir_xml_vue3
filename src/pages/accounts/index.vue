<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import AccountFormDialog from '@/components/inventory/accounts/AccountFormDialog.vue'
import { usePermissions } from '@/composables/usePermissions'

const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const { currentUser, can } = usePermissions()

const canAccessTreasury = computed(() => can('list_transfer'))
const loading = ref(false)
const showAccountDialog = ref(false)
const editingAccount = ref(null)
const showDeleteDialog = ref(false)
const accountToDelete = ref(null)
const accounts = ref([])
const totalBalance = ref(0)

const headers = [
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Código', key: 'code', sortable: true },
  { title: 'Nombre', key: 'name', sortable: true },
  { title: 'Tipo', key: 'type', sortable: true },
  { title: 'Banco', key: 'bank_name', sortable: true },
  { title: 'Saldo Actual', key: 'saldo_actual', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false },
]

const loadAccounts = async () => {
  loading.value = true
  try {
    console.log('🔄 Iniciando carga de cuentas...')

    const response = await $api('accounts')

    console.log('📦 Respuesta de la API:', response)

    // Verificar diferentes estructuras posibles de respuesta
    let accountsData = []
    if (response && response.accounts) {
      accountsData = response.accounts
      console.log('✅ Encontrado response.accounts:', accountsData)
    } else if (response && response.data) {
      accountsData = response.data
      console.log('✅ Encontrado response.data:', accountsData)
    } else if (Array.isArray(response)) {
      accountsData = response
      console.log('✅ La respuesta es un array:', accountsData)
    } else {
      console.log('❌ Estructura de respuesta no reconocida:', response)
    }

    accounts.value = accountsData
    console.log('📋 Cuentas asignadas:', accounts.value)
    console.log('📊 Total de cuentas:', accounts.value.length)

    // Debug de la estructura de cada cuenta
    if (accounts.value.length > 0) {
      console.log('🔍 Estructura de la primera cuenta:', JSON.stringify(accounts.value[0], null, 2))
    }

    // Calcular saldo total
    totalBalance.value = accounts.value.reduce((sum, account) => {
      const balance = parseFloat(account.saldo_actual || 0)

      console.log(`💰 Cuenta ${account.id}: saldo_actual=${account.saldo_actual}, parsed=${balance}`)

      return sum + balance
    }, 0)

    console.log('💰 Saldo total calculado:', totalBalance.value)
    showNotification('Cuentas cargadas correctamente', 'success')
  } catch (error) {
    console.error('❌ Error al cargar cuentas:', error)
    console.error('❌ Detalles del error:', error.response?.data)
    showNotification('Error al cargar las cuentas', 'error')
  } finally {
    loading.value = false
  }
}

// Formatear moneda
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

// Obtener ícono según tipo de cuenta
const getAccountIcon = type => {
  return type === 'bank' ? 'ri-bank-card-line' : 'ri-cash-line'
}

// Obtener etiqueta del tipo
const getTypeLabel = type => {
  return type === 'bank' ? 'Banco' : 'Caja'
}

// Verificar si es Banco Guayaquil (ID 3)
const isBankGuayaquil = account => {
  return account.id === 3 && account.bank_name?.toLowerCase().includes('guayaquil')
}

// Obtener clase CSS para resaltar Banco Guayaquil
const getRowClass = account => {
  return isBankGuayaquil(account) ? 'bg-blue-lighten-4' : ''
}

// Watch para redirigir cuando el usuario esté disponible (después de definir loadAccounts)
watch(() => currentUser.value, user => {
  console.log('👀 Watch - Usuario cambió:', user)
  if (user && !canAccessTreasury.value) {
    console.log('🚫 Redirigiendo - No tiene permisos')
    showNotification('No tienes permisos para acceder al dashboard de tesorería', 'error')
    router.push('/dashboard')
  } else if (user && canAccessTreasury.value) {
    console.log('✅ Usuario con permisos - Cargando cuentas')
    loadAccounts()
  }
}, { immediate: true })

// Funciones para manejar el diálogo
const openAccountDialog = () => {
  editingAccount.value = null
  showAccountDialog.value = true
}

const openEditDialog = account => {
  if (!account.is_system) {
    editingAccount.value = account
    showAccountDialog.value = true
  }
}

const closeAccountDialog = () => {
  showAccountDialog.value = false
  editingAccount.value = null
}

const onAccountCreated = () => {
  loadAccounts()
  closeAccountDialog()
  showNotification('Cuenta creada exitosamente', 'success')
}

const onAccountUpdated = () => {
  loadAccounts()
  closeAccountDialog()
  showNotification('Cuenta actualizada exitosamente', 'success')
}

const deleteAccount = account => {
  accountToDelete.value = account
  showDeleteDialog.value = true
}

const confirmDeleteAccount = async () => {
  if (!accountToDelete.value) return

  loader.start()

  try {
    await $api(`accounts/${accountToDelete.value.id}`, {
      method: 'DELETE',
    })

    loadAccounts()
    showNotification('Cuenta eliminada exitosamente', 'success')
    closeDeleteDialog()
  } catch (error) {
    const backendMessage = error.response?.data?.message || error.response?._data?.message

    if (backendMessage) {
      showNotification(backendMessage, 'error')
    } else {
      showNotification('Error al eliminar la cuenta', 'error')
    }
    console.error('Error al eliminar cuenta:', error)
  } finally {
    loader.stop()
  }
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  accountToDelete.value = null
}

// Montar componente - la carga se maneja en el watch
onMounted(() => {
  console.log('🚀 Componente montado - Usuario actual:', currentUser.value)
})
</script>

<template>
  <div
    v-if="!canAccessTreasury"
    class="d-flex justify-center align-center"
    style="height: 400px"
  >
    <VCard
      class="pa-8 text-center rounded-xl border-thin"
      elevation="8"
      max-width="450"
    >
      <VIcon
        size="64"
        color="error"
        class="mb-4"
      >
        ri-lock-line
      </VIcon>
      <h3 class="text-h5 mb-2 font-weight-bold">
        Acceso Restringido
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-6">
        No tienes los permisos necesarios para acceder a la gestión de cartera.
      </p>
      <VBtn
        color="primary"
        class="text-none"
        elevation="2"
        prepend-icon="ri-arrow-left-line"
        @click="router.push('/dashboard')"
      >
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>

  <div
    v-else
    class="pa-4 pa-sm-6 account-management-page"
  >
    <!-- Encabezado Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar
            color="primary"
            variant="tonal"
            rounded="lg"
            size="44"
            class="elevation-1"
          >
            <VIcon
              icon="ri-bank-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Gestión de Cuentas y Cajas
              </h1>
              <div
                class="status-pill-clean status-transfer"
              >
                <span class="status-dot" />
                <span>{{ accounts.length }} {{ accounts.length === 1 ? 'cuenta' : 'cuentas' }}</span>
              </div>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Administración de cuentas bancarias, cajas chicas y saldos financieros
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-3">
          <VBtn
            title="Actualizar cuentas"
            variant="tonal"
            color="secondary"
            icon="ri-refresh-line"
            size="small"
            :loading="loading"
            @click="loadAccounts"
          />
          <VBtn
            color="primary"
            variant="elevated"
            size="small"
            prepend-icon="ri-add-circle-line"
            class="font-weight-semibold elevation-2"
            @click="openAccountDialog"
          >
            Nueva Cuenta
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Tarjetas de Resumen KPI con colores tonales -->
    <VRow class="mb-5">
      <!-- Saldo Total Acumulado -->
      <VCol
        cols="12"
        sm="6"
        md="4"
      >
        <VCard
          class="pa-4 rounded-xl tonal-card bg-primary-tonal border-primary operations-kpi-card"
          elevation="0"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-primary text-uppercase tracking-wider">
                Saldo Total Acumulado
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(totalBalance) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma consolidada de todas las cuentas
              </span>
            </div>
            <VAvatar
              color="primary"
              variant="elevated"
              size="42"
              class="elevation-2 kpi-avatar"
            >
              <VIcon
                size="24"
                icon="ri-money-dollar-circle-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Total Cuentas -->
      <VCol
        cols="12"
        sm="6"
        md="4"
      >
        <VCard
          class="pa-4 rounded-xl tonal-card bg-success-tonal border-success operations-kpi-card"
          elevation="0"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-success text-uppercase tracking-wider">
                Total de Cuentas
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ accounts.length }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Cuentas y cajas registradas
              </span>
            </div>
            <VAvatar
              color="success"
              variant="elevated"
              size="42"
              class="elevation-2 kpi-avatar"
            >
              <VIcon
                size="24"
                icon="ri-bank-card-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Cuentas Activas -->
      <VCol
        cols="12"
        sm="12"
        md="4"
      >
        <VCard
          class="pa-4 rounded-xl tonal-card bg-info-tonal border-info operations-kpi-card"
          elevation="0"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-info text-uppercase tracking-wider">
                Cuentas Activas
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ accounts.filter(acc => Boolean(acc.is_active)).length }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Habilitadas para operaciones
              </span>
            </div>
            <VAvatar
              color="info"
              variant="elevated"
              size="42"
              class="elevation-2 kpi-avatar"
            >
              <VIcon
                size="24"
                icon="ri-checkbox-circle-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Contenedor Principal (Tabla) -->
    <VCard class="rounded-xl border-light overflow-hidden elevation-1 transfer-table-container position-relative">
      <VProgressLinear
        v-if="loading"
        indeterminate
        color="primary"
        height="3"
        class="position-absolute"
        style="top: 0; left: 0; right: 0; z-index: 10;"
      />

      <VTable
        hover
        class="transfer-table text-no-wrap overflow-x-auto"
      >
        <thead>
          <tr>
            <th
              class="text-left py-4"
              style="width: 80px;"
            >
              ID
            </th>
            <th class="text-left py-4" style="min-width: 250px;">
              NOMBRE DE LA CUENTA
            </th>
            <th
              class="text-center py-4"
              style="width: 130px;"
            >
              SISTEMA
            </th>
            <th
              class="text-left py-4"
              style="width: 140px;"
            >
              TIPO
            </th>
            <th class="text-left py-4" style="min-width: 220px;">
              INSTITUCIÓN / BANCO
            </th>
            <th
              class="text-right py-4"
              style="width: 170px;"
            >
              SALDO DISPONIBLE
            </th>
            <th
              class="text-center py-4"
              style="width: 130px;"
            >
              ACCIONES
            </th>
          </tr>
        </thead>
        
        <!-- Cargando (Skeleton Rows) -->
        <tbody v-if="loading">
          <tr
            v-for="n in 5"
            :key="n"
            class="skeleton-row align-middle"
          >
            <td class="py-4">
              <div class="shimmer-line w-40" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-60" />
            </td>
            <td class="py-4 text-center">
              <div class="shimmer-chip mx-auto" />
            </td>
            <td class="py-4">
              <div class="shimmer-chip" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-50" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-40 ms-auto" />
            </td>
            <td class="py-4 text-center">
              <div class="d-flex justify-center gap-2">
                <div class="shimmer-button" />
                <div class="shimmer-button" />
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Sin resultados -->
        <tbody v-else-if="!accounts.length">
          <tr>
            <td
              colspan="7"
              class="text-center text-medium-emphasis py-12"
            >
              <VAvatar
                size="64"
                color="primary"
                variant="tonal"
                class="mb-3"
              >
                <VIcon
                  size="32"
                  color="primary"
                  icon="ri-bank-line"
                />
              </VAvatar>
              <div class="text-h6 font-weight-bold text-high-emphasis">
                No se encontraron cuentas
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                Intenta registrar una nueva cuenta bancaria o de caja.
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Datos Reales -->
        <tbody v-else>
          <tr
            v-for="account in accounts"
            :key="account.id"
            class="transfer-row"
          >
            <!-- ID -->
            <td class="font-weight-bold text-slate-700">
              #{{ account.id }}
            </td>

            <!-- Nombre -->
            <td class="py-3">
              <div class="d-flex align-center gap-3">
                <VAvatar
                  size="36"
                  :color="account.type === 'bank' ? 'primary' : 'success'"
                  variant="tonal"
                  class="rounded-lg shrink-0"
                >
                  <VIcon
                    :icon="account.type === 'bank' ? 'ri-bank-line' : 'ri-money-dollar-circle-line'"
                    size="20"
                  />
                </VAvatar>
                <div class="d-flex flex-column text-left">
                  <span class="text-body-2 font-weight-bold text-slate-900">
                    {{ account.name }}
                  </span>
                  <span class="text-caption text-medium-emphasis font-mono">
                    {{ account.code || `Cuenta #${account.id}` }}
                  </span>
                </div>
              </div>
            </td>

              <!-- Sistema -->
            <td class="py-3 text-center" style="white-space: nowrap;">
              <div
                v-if="account.is_system"
                class="status-pill-clean status-partial"
              >
                <span class="status-dot" />
                <span>Sistema</span>
              </div>
              <span
                v-else
                class="text-caption text-disabled font-weight-medium"
              >—</span>
            </td>

            <!-- Tipo -->
            <td class="py-3" style="white-space: nowrap;">
              <div
                class="status-pill-clean"
                :class="account.type === 'bank' ? 'status-transfer' : 'status-paid'"
              >
                <span class="status-dot" />
                <span>{{ getTypeLabel(account.type) }}</span>
              </div>
            </td>

            <!-- Banco -->
            <td class="py-3">
              <div
                v-if="account.bank_name"
                class="d-flex align-center gap-2"
              >
                <span class="text-body-2 font-weight-bold text-slate-900">
                  {{ account.bank_name }}
                </span>
                <div
                  v-if="isBankGuayaquil(account)"
                  class="status-pill-clean status-transfer"
                >
                  <span class="status-dot" />
                  <span>Principal</span>
                </div>
              </div>
              <span
                v-else
                class="text-caption text-medium-emphasis"
              >No especificado</span>
            </td>

            <!-- Saldo Actual -->
            <td class="py-3 text-right">
              <span
                class="text-subtitle-1 font-weight-black"
                :class="parseFloat(account.saldo_actual) >= 0 ? 'text-success' : 'text-error'"
              >
                {{ formatCurrency(account.saldo_actual || 0) }}
              </span>
            </td>

            <!-- Acciones -->
            <td class="py-3 text-center">
              <div class="d-flex align-center justify-center gap-1">
                <template v-if="!account.is_system">
                  <VBtn
                    icon="ri-pencil-line"
                    variant="tonal"
                    size="small"
                    color="warning"
                    class="action-btn"
                    title="Editar Cuenta"
                    @click="openEditDialog(account)"
                  />

                  <VBtn
                    icon="ri-delete-bin-line"
                    variant="tonal"
                    size="small"
                    color="error"
                    class="action-btn"
                    title="Eliminar Cuenta"
                    @click="deleteAccount(account)"
                  />
                </template>
                <div
                  v-else
                  class="status-pill-clean status-canceled"
                >
                  <span class="status-dot" />
                  <span>Protegida</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </VTable>

      <VDivider />

      <!-- Pie de Página -->
      <VCardActions class="justify-start pa-4 bg-grey-lighten-5">
        <div class="text-caption text-slate-700 font-weight-medium">
          Mostrando <strong class="text-primary font-weight-bold">{{ accounts.length }}</strong> cuentas registradas en el sistema
        </div>
      </VCardActions>
    </VCard>

    <!-- Diálogos -->
    <AccountFormDialog
      v-model="showAccountDialog"
      :account-data="editingAccount"
      @account-created="onAccountCreated"
      @account-updated="onAccountUpdated"
    />

    <VDialog
      v-model="showDeleteDialog"
      scrollable
      max-width="500"
    >
      <VCard class="pa-4 rounded-xl border-thin">
        <VCardTitle class="px-0 pt-0">
          <div class="d-flex align-center gap-2">
            <VIcon
              color="error"
              size="24"
            >
              ri-error-warning-line
            </VIcon>
            <span class="text-h6 font-weight-bold">Eliminar Cuenta</span>
          </div>
        </VCardTitle>

        <VCardText class="px-0 pb-4">
          <p class="mb-1">
            ¿Estás seguro de eliminar la cuenta <strong>"{{ accountToDelete?.name }}"</strong>?
          </p>
          <span class="text-body-2 text-medium-emphasis">Esta acción no se puede deshacer.</span>
        </VCardText>

        <VCardActions
          class="px-0 pb-0 d-flex justify-end align-center gap-3"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            :disabled="loader.loading"
            @click="closeDeleteDialog"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            prepend-icon="ri-delete-bin-line"
            class="rounded-lg px-6 font-weight-bold"
            height="40"
            :loading="loader.loading"
            @click="confirmDeleteAccount"
          >
            Eliminar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped lang="scss">
// Status Pills (Estilo Socios/Usuarios con Punto Indicador)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-partial {
  background-color: #fffbeb !important;
  color: #92400e !important;
  border: 1px solid #fde68a !important;

  .status-dot {
    background-color: #f59e0b !important;
  }
}

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}

.status-transfer {
  background-color: #eff6ff !important;
  color: #1e40af !important;
  border: 1px solid #bfdbfe !important;

  .status-dot {
    background-color: #3b82f6 !important;
  }
}

.status-canceled {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  border: 1px solid #cbd5e1 !important;

  .status-dot {
    background-color: #94a3b8 !important;
  }
}
</style>
