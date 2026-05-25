<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import AccountFormDialog from '@/components/inventory/accounts/AccountFormDialog.vue'

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
const canAccessTreasury = computed(() => {
  const user = currentUser.value
  const roleId = user?.role?.id

  console.log('🔍 Debug - Usuario actual:', user)
  console.log('🔍 Debug - role:', user?.role)
  console.log('🔍 Debug - role.id:', roleId)
  console.log('🔍 Debug - Tipo de role.id:', typeof roleId)
  console.log('🔍 Debug - ¿Puede acceder?:', user && roleId === 1)

  return user && roleId === 1
})

// Estado
const accounts = ref([])
const totalBalance = ref(0)
const loading = ref(false)
const showAccountDialog = ref(false)
const editingAccount = ref(null)
const showDeleteDialog = ref(false)
const accountToDelete = ref(null)

// Headers para la tabla
const headers = [
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Código', key: 'code', sortable: true },
  { title: 'Nombre', key: 'name', sortable: true },
  { title: 'Tipo', key: 'type', sortable: true },
  { title: 'Banco', key: 'bank_name', sortable: true },
  { title: 'Saldo Actual', key: 'saldo_actual', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false },
]

// Cargar cuentas
const loadAccounts = async () => {
  loader.start()
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
    loader.stop()
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
    showNotification('Error al eliminar la cuenta', 'error')
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
  <div v-if="!canAccessTreasury" class="d-flex justify-center align-center" style="height: 400px">
    <VCard class="pa-8 text-center rounded-xl border-thin" elevation="8" max-width="450">
      <VIcon size="64" color="error" class="mb-4">
        ri-lock-line
      </VIcon>
      <h3 class="text-h5 mb-2 font-weight-bold">
        Acceso Restringido
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-6">
        No tienes los permisos necesarios para acceder a la gestión de cartera.
      </p>
      <VBtn color="primary" class="text-none" elevation="2" prepend-icon="ri-arrow-left-line"
        @click="router.push('/dashboard')">
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>

  <div v-else>
    <!-- Contenedor Principal acorde al contexto del sistema -->
    <VCard elevation="8" class="pa-6 rounded-xl border-thin">
      <!-- Título -->
      <VRow class="mb-4">
        <VCol>
          <div class="d-flex align-center gap-3">
            <VIcon icon="ri-bank-line" color="primary" size="28" />
            <div>
              <h4 class="text-h5 font-weight-bold mb-1">
                Gestión de Cartera
              </h4>
              <span class="text-body-2 text-medium-emphasis">
                Administración de cuentas y movimientos financieros
              </span>
            </div>
          </div>
        </VCol>
        <!-- Acciones -->
        <VCol cols="12" md="4" class="d-flex justify-end">
          <VBtn color="primary" variant="elevated" size="large" class="text-none px-6" @click="openAccountDialog">
            <VIcon start icon="ri-add-line" />
            Nueva Cuenta
          </VBtn>
        </VCol>
      </VRow>

      <!-- Tarjetas de Resumen -->
      <VRow class="mb-6">
        <VCol cols="12" md="4">
          <VCard class="pa-4 rounded-lg border-thin elevation-1" color="primary" variant="tonal">
            <div class="d-flex justify-space-between align-center">
              <div>
                <div class="text-body-2 text-primary font-weight-medium mb-1">
                  Saldo Total
                </div>
                <div class="text-h5 font-weight-bold text-primary">
                  {{ formatCurrency(totalBalance) }}
                </div>
              </div>
              <VIcon size="40" color="primary">ri-money-dollar-circle-line</VIcon>
            </div>
          </VCard>
        </VCol>
        <VCol cols="12" md="4">
          <VCard class="pa-4 rounded-lg border-thin elevation-1">
            <div class="d-flex justify-space-between align-center">
              <div>
                <div class="text-body-2 text-medium-emphasis font-weight-medium mb-1">
                  Total Cuentas
                </div>
                <div class="text-h5 font-weight-bold">
                  {{ accounts.length }}
                </div>
              </div>
              <VIcon size="40" color="success">ri-bank-card-line</VIcon>
            </div>
          </VCard>
        </VCol>
        <VCol cols="12" md="4">
          <VCard class="pa-4 rounded-lg border-thin elevation-1">
            <div class="d-flex justify-space-between align-center">
              <div>
                <div class="text-body-2 text-medium-emphasis font-weight-medium mb-1">
                  Cuentas Activas
                </div>
                <div class="text-h5 font-weight-bold">
                  {{accounts.filter(acc => !acc.is_system).length}}
                </div>
              </div>
              <VIcon size="40" color="info">ri-check-line</VIcon>
            </div>
          </VCard>
        </VCol>
      </VRow>



      <VDivider class="mb-4" />

      <!-- Tabla -->
      <VTable class="text-no-wrap elevation-1 rounded-lg">
        <thead>
          <tr>
            <th class="text-uppercase text-caption font-weight-bold">ID</th>
            <th class="text-uppercase text-caption font-weight-bold">Nombre</th>
            <th class="text-uppercase text-caption font-weight-bold">Tipo</th>
            <th class="text-uppercase text-caption font-weight-bold">Banco</th>
            <th class="text-uppercase text-caption font-weight-bold text-right">Saldo Actual</th>
            <th class="text-uppercase text-caption font-weight-bold text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loader.loading">
            <td colspan="6" class="text-center pa-4">
              <VProgressCircular indeterminate color="primary" />
            </td>
          </tr>
          <tr v-else-if="!accounts.length">
            <td colspan="6" class="text-center text-medium-emphasis py-6">
              <VIcon size="32" class="mb-2">ri-database-2-line</VIcon>
              <div>No hay cuentas registradas</div>
            </td>
          </tr>
          <tr v-for="account in accounts" v-else :key="account.id">
            <!-- ID -->
            <td>
              <span color="primary" variant="tonal" size="small">
                {{ account.id }}
              </span>
            </td>

            <!-- Nombre -->
            <td>
              <div class="d-flex align-center gap-2">
                <VIcon v-if="account.is_system" icon="ri-lock-2-line" size="16" color="warning" />
                <span>{{ account.name }}</span>
              </div>
            </td>

            <!-- Tipo -->
            <td>
              <VChip :color="account.type === 'bank' ? 'primary' : 'success'" variant="tonal" size="small">
                {{ getTypeLabel(account.type) }}
              </VChip>
            </td>

            <!-- Banco -->
            <td>
              <div v-if="account.bank_name" class="d-flex align-center gap-2">
                <span>{{ account.bank_name }}</span>
                <VChip v-if="isBankGuayaquil(account)" color="info" variant="tonal" size="x-small">
                  Principal
                </VChip>
              </div>
              <span v-else class="text-medium-emphasis">-</span>
            </td>

            <!-- Saldo Inicial -->
            <td class="text-right" :class="account.saldo_actual < 0 ? 'text-error' : ''">
              {{ formatCurrency(account.saldo_actual || 0) }}
            </td>

            <!-- Acciones -->
            <td>
              <div class="d-flex justify-center align-center gap-2">
                <VTooltip v-if="!account.is_system" text="Editar">
                  <template #activator="{ props }">
                    <IconBtn v-bind="props" size="small" color="primary" variant="text"
                      @click="openEditDialog(account)">
                      <VIcon icon="ri-pencil-line" />
                    </IconBtn>
                  </template>
                </VTooltip>

                <VTooltip v-if="!account.is_system" text="Eliminar">
                  <template #activator="{ props }">
                    <IconBtn v-bind="props" size="small" color="error" variant="text" @click="deleteAccount(account)">
                      <VIcon icon="ri-delete-bin-line" />
                    </IconBtn>
                  </template>
                </VTooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- Diálogos -->
    <AccountFormDialog v-model="showAccountDialog" :account-data="editingAccount" @account-created="onAccountCreated"
      @account-updated="onAccountUpdated" />

    <VDialog v-model="showDeleteDialog" max-width="400">
      <VCard class="pa-4 rounded-xl border-thin">
        <VCardTitle class="px-0 pt-0">
          <div class="d-flex align-center gap-2">
            <VIcon color="error" size="24">ri-error-warning-line</VIcon>
            <span class="text-h6 font-weight-bold">Eliminar Cuenta</span>
          </div>
        </VCardTitle>

        <VCardText class="px-0 pb-4">
          <p class="mb-1">¿Estás seguro de eliminar la cuenta <strong>"{{ accountToDelete?.name }}"</strong>?</p>
          <span class="text-body-2 text-medium-emphasis">Esta acción no se puede deshacer.</span>
        </VCardText>

        <VCardActions class="px-0 pb-0">
          <VSpacer />
          <VBtn variant="tonal" color="secondary" class="text-none" :disabled="loader.loading"
            @click="closeDeleteDialog">
            Cancelar
          </VBtn>
          <VBtn color="error" variant="elevated" class="text-none" :loading="loader.loading"
            @click="confirmDeleteAccount">
            Eliminar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
:deep(.v-data-table__tr td) {
  padding-top: 15px !important;
  padding-bottom: 15px !important;
}
</style>
