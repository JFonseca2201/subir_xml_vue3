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
    { title: 'Saldo Inicial', key: 'initial_balance', sortable: true },
    { title: 'Acciones', key: 'actions', sortable: false }
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
            const balance = parseFloat(account.initial_balance || 0)
            console.log(`💰 Cuenta ${account.id}: balance=${account.initial_balance}, parsed=${balance}`)
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
const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value)
}

// Obtener ícono según tipo de cuenta
const getAccountIcon = (type) => {
    return type === 'bank' ? 'ri-bank-card-line' : 'ri-cash-line'
}

// Obtener etiqueta del tipo
const getTypeLabel = (type) => {
    return type === 'bank' ? 'Banco' : 'Caja'
}

// Verificar si es Banco Guayaquil (ID 3)
const isBankGuayaquil = (account) => {
    return account.id === 3 && account.bank_name?.toLowerCase().includes('guayaquil')
}

// Obtener clase CSS para resaltar Banco Guayaquil
const getRowClass = (account) => {
    return isBankGuayaquil(account) ? 'bg-blue-lighten-4' : ''
}

// Watch para redirigir cuando el usuario esté disponible (después de definir loadAccounts)
watch(() => currentUser.value, (user) => {
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

const openEditDialog = (account) => {
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

const deleteAccount = (account) => {
    accountToDelete.value = account
    showDeleteDialog.value = true
}

const confirmDeleteAccount = async () => {
    if (!accountToDelete.value) return

    loader.start()

    try {
        await $api(`accounts/${accountToDelete.value.id}`, {
            method: 'DELETE'
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
        <VCard class="pa-6 text-center">
            <VIcon size="64" color="error" class="mb-4">ri-lock-line</VIcon>
            <h3 class="text-h5 mb-2">Acceso Restringido</h3>
            <p class="text-medium-emphasis">No tienes permisos para acceder a la gestión de cartera.</p>
            <VBtn color="primary" @click="router.push('/dashboard')" class="mt-4">
                Volver al Dashboard
            </VBtn>
        </VCard>
    </div>

    <div v-else class="pa-4 pa-sm-6">
        <!-- Header -->
        <VCard class="pa-6 mb-6 rounded-lg elevation-4">
            <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-3">
                    <VIcon size="40" color="primary">ri-bank-line</VIcon>
                    <div>
                        <h1 class="text-h4 font-weight-bold mb-1">Gestión de Cartera</h1>
                        <span class="text-medium-emphasis">Administración de cuentas y movimientos financieros</span>
                    </div>
                </div>
                <VBtn color="primary" prepend-icon="ri-add-line" size="large" @click="openAccountDialog">
                    Nueva Cuenta
                </VBtn>
            </div>
            <VDivider />
        </VCard>

        <!-- Tarjetas de Resumen -->
        <VRow class="mb-6">
            <VCol cols="12" md="6" lg="4">
                <VCard class="pa-6 rounded-lg elevation-3" color="primary" variant="tonal">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6 font-weight-medium text-primary-darken-1 mb-2">
                                Saldo Total de la Compañía
                            </div>
                            <div class="text-h4 font-weight-bold text-primary">
                                {{ formatCurrency(totalBalance) }}
                            </div>
                        </div>
                        <VIcon size="48" color="primary">ri-money-dollar-box-line</VIcon>
                    </div>
                </VCard>
            </VCol>

            <VCol cols="12" md="6" lg="4">
                <VCard class="pa-6 rounded-lg elevation-3">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6 font-weight-medium mb-2">Total de Cuentas</div>
                            <div class="text-h4 font-weight-bold">{{ accounts.length }}</div>
                        </div>
                        <VIcon size="48" color="success">ri-bank-card-line</VIcon>
                    </div>
                </VCard>
            </VCol>

            <VCol cols="12" md="6" lg="4">
                <VCard class="pa-6 rounded-lg elevation-3">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6 font-weight-medium mb-2">Cuentas Activas</div>
                            <div class="text-h4 font-weight-bold">
                                {{accounts.filter(acc => !acc.is_system).length}}
                            </div>
                        </div>
                        <VIcon size="48" color="info">ri-cash-line</VIcon>
                    </div>
                </VCard>
            </VCol>
        </VRow>

        <!-- Tabla de Cuentas -->
        <VCard class="rounded-lg elevation-4">
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center gap-2">
                    <VIcon color="primary">ri-bank-card-line</VIcon>
                    <span class="text-h5 font-weight-bold">Gestión de Cartera</span>
                </div>
            </VCardTitle>

            <VDivider />

            <VCardText class="pa-0">
                <VTable class="elevation-0">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Banco</th>
                            <th>Saldo Inicial</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loader.loading">
                            <td colspan="7" class="text-center pa-4">
                                <VProgressCircular indeterminate color="primary" />
                            </td>
                        </tr>
                        <tr v-else-if="!accounts.length">
                            <td colspan="7" class="text-center text-medium-emphasis py-8">
                                <VIcon size="48" class="mb-2">ri-bank-card-line</VIcon>
                                <div class="text-h6 mb-1">No hay cuentas registradas</div>
                                <div class="text-body-2">Comienza agregando tu primera cuenta</div>
                            </td>
                        </tr>
                        <tr v-else v-for="account in accounts" :key="account.id" :class="getRowClass(account)">
                            <!-- ID -->
                            <td>
                                <VChip color="primary" variant="tonal" size="small">
                                    {{ account.id }}
                                </VChip>
                            </td>

                            <!-- Código -->
                            <td>
                                <div class="font-weight-medium">
                                    <VIcon v-if="account.is_system" icon="ri-lock-2-line" size="16" color="warning"
                                        class="me-1" />
                                    {{ account.code }}
                                </div>
                            </td>

                            <!-- Nombre -->
                            <td>
                                <div class="font-weight-medium">
                                    {{ account.name }}
                                </div>
                            </td>

                            <!-- Tipo -->
                            <td>
                                <VChip :color="account.type === 'bank' ? 'primary' : 'success'" variant="tonal"
                                    size="small">
                                    <VIcon start :icon="getAccountIcon(account.type)" />
                                    {{ getTypeLabel(account.type) }}
                                </VChip>
                            </td>

                            <!-- Banco -->
                            <td>
                                <div v-if="account.bank_name">
                                    <div class="font-weight-medium">
                                        {{ account.bank_name }}
                                    </div>
                                    <VChip v-if="isBankGuayaquil(account)" color="info" variant="tonal" size="x-small"
                                        class="mt-1">
                                        Principal
                                    </VChip>
                                </div>
                                <span v-else class="text-medium-emphasis">N/A</span>
                            </td>

                            <!-- Saldo Inicial -->
                            <td>
                                <div class="text-right font-weight-medium">
                                    {{ formatCurrency(account.initial_balance || 0) }}
                                </div>
                            </td>

                            <!-- Acciones -->
                            <td>
                                <div class="d-flex gap-1">
                                    <VBtn icon="ri-edit-line" variant="elevated" size="small" color="primary"
                                        :disabled="!!account.is_system" @click="openEditDialog(account)" title="Editar">
                                        <VIcon icon="ri-edit-line" />
                                    </VBtn>
                                    <VBtn icon="ri-delete-bin-line" variant="elevated" size="small" color="error"
                                        :disabled="!!account.is_system" @click="deleteAccount(account)"
                                        title="Eliminar">
                                        <VIcon icon="ri-delete-bin-line" />
                                    </VBtn>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </VTable>
            </VCardText>
        </VCard>
    </div>

    <!-- Diálogo de Formulario de Cuentas -->
    <AccountFormDialog v-model="showAccountDialog" :account-data="editingAccount" @account-created="onAccountCreated"
        @account-updated="onAccountUpdated" />

    <!-- Diálogo de Confirmación de Eliminación -->
    <VDialog v-model="showDeleteDialog" max-width="400">
        <VCard>
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-2">
                        <VIcon color="error" size="24">ri-delete-bin-line</VIcon>
                        <span class="text-h6 font-weight-bold">Eliminar Cuenta</span>
                    </div>
                    <VBtn icon="ri-close-line" variant="text" size="small" @click="closeDeleteDialog" />
                </div>
            </VCardTitle>

            <VDivider />

            <VCardText class="pa-4">
                <div class="text-body-1 mb-2">
                    ¿Estás seguro de eliminar la cuenta <strong>"{{ accountToDelete?.name }}"</strong>?
                </div>
                <div class="text-medium-emphasis text-body-2">
                    Esta acción no se puede deshacer. La cuenta y todos sus datos asociados serán eliminados
                    permanentemente.
                </div>
            </VCardText>

            <VDivider />

            <VCardActions class="pa-4">
                <VSpacer />
                <VBtn variant="outlined" @click="closeDeleteDialog" :disabled="loader.loading">
                    Cancelar
                </VBtn>
                <VBtn color="error" variant="elevated" @click="confirmDeleteAccount" :loading="loader.loading"
                    prepend-icon="ri-delete-bin-line">
                    Eliminar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
.bg-blue-lighten-4 {
    background-color: rgba(33, 150, 243, 0.1) !important;
}
</style>
