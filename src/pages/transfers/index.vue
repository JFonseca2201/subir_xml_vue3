<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'

// Router y dependencias globales
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Obtener usuario actual del localStorage
const currentUser = computed(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
})

// Validación de seguridad - solo rol_id === 1 puede acceder
const canAccessTransfers = computed(() => {
    const user = currentUser.value
    const roleId = user?.role?.id
    return user && roleId === 1
})

// Estado del componente
const transfers = ref([])
const resumen = ref({
    total_hoy: 0,
    total_mes: 0,
    total_general: 0
})
const loading = ref(false)
const showTransferDialog = ref(false)
const editingTransfer = ref(null)
const showDeleteDialog = ref(false)
const transferToDelete = ref(null)

// Cargar listado de transferencias
const loadTransfers = async () => {
    loader.start()
    loading.value = true

    try {
        const response = await $api('transfers')

        // Adaptación dependiendo de cómo devuelva tu API los datos
        console.log(response);

        let dataArray = []

        if (response.data) {
            dataArray = response.data
        } else if (Array.isArray(response)) {
            dataArray = response
        }

        transfers.value = dataArray

        // Cálculo del resumen en frontend (Respaldo por si la API no lo envía)
        const today = new Date().toISOString().split('T')[0]
        const currentMonth = today.substring(0, 7)

        let totalHoy = 0, totalMes = 0, totalGeneral = 0

        dataArray.forEach(t => {
            const amount = parseFloat(t.amount || 0)
            const tDate = (t.transfer_date || t.created_at || '').split('T')[0]

            totalGeneral += amount
            if (tDate === today) totalHoy += amount
            if (tDate.substring(0, 7) === currentMonth) totalMes += amount
        })

        resumen.value = response.resumen || {
            total_hoy: totalHoy,
            total_mes: totalMes,
            total_general: totalGeneral
        }

        showNotification('Transferencias cargadas correctamente', 'success')
    } catch (error) {
        console.error('Error al cargar transferencias:', error)
        showNotification('Error al cargar historial de transferencias', 'error')
    } finally {
        loader.stop()
        loading.value = false
    }
}

const openTransferDialog = () => {
    editingTransfer.value = null
    showTransferDialog.value = true
}

// Funciones de Edición y Eliminación
const openEditDialog = (transfer) => {
    editingTransfer.value = transfer
    showTransferDialog.value = true
}

const deleteTransfer = (transfer) => {
    transferToDelete.value = transfer
    showDeleteDialog.value = true
}

const confirmDeleteTransfer = async () => {
    if (!transferToDelete.value) return
    loader.start()
    try {
        await $api(`transfers/${transferToDelete.value.id}`, { method: 'DELETE' })
        showNotification('Transferencia eliminada exitosamente', 'success')
        loadTransfers()
        closeDeleteDialog()
    } catch (error) {
        console.error('Error al eliminar:', error)
        showNotification('Error al eliminar transferencia', 'error')
    } finally {
        loader.stop()
    }
}

const closeDeleteDialog = () => {
    showDeleteDialog.value = false
    transferToDelete.value = null
}

// Función que se ejecuta cuando el TransferDialog emite 'transferred'
const onTransferred = () => {
    loadTransfers()
}

// Formatear moneda
const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value || 0)
}

// Formatear Fecha
const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Montar componente
onMounted(() => {
    if (canAccessTransfers.value) {
        loadTransfers()
    }
})
</script>

<template>
    <div v-if="!canAccessTransfers" class="d-flex justify-center align-center" style="height: 400px">
        <VCard class="pa-6 text-center">
            <VIcon size="64" color="error" class="mb-4">ri-lock-line</VIcon>
            <h3 class="text-h5 mb-2">Acceso Restringido</h3>
            <p class="text-medium-emphasis">No tienes permisos para acceder a la gestión de transferencias.</p>
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
                    <VIcon size="40" color="primary">ri-arrow-left-right-line</VIcon>
                    <div>
                        <h1 class="text-h4 font-weight-bold mb-1">Transferencias</h1>
                        <span class="text-medium-emphasis">Gestión de movimientos y transferencias entre cuentas</span>
                    </div>
                </div>
                <VBtn color="primary" prepend-icon="ri-add-line" size="large" @click="openTransferDialog">
                    Nueva Transferencia
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
                                Transferido Hoy
                            </div>
                            <div class="text-h4 font-weight-bold text-primary">
                                {{ formatCurrency(resumen.total_hoy) }}
                            </div>
                        </div>
                        <VIcon size="48" color="primary">ri-calendar-today-line</VIcon>
                    </div>
                </VCard>
            </VCol>

            <VCol cols="12" md="6" lg="4">
                <VCard class="pa-6 rounded-lg elevation-3">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6 font-weight-medium mb-2">Transferido en el Mes</div>
                            <div class="text-h4 font-weight-bold">{{ formatCurrency(resumen.total_mes) }}</div>
                        </div>
                        <VIcon size="48" color="success">ri-calendar-line</VIcon>
                    </div>
                </VCard>
            </VCol>

            <VCol cols="12" md="6" lg="4">
                <VCard class="pa-6 rounded-lg elevation-3">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6 font-weight-medium mb-2">Total Histórico</div>
                            <div class="text-h4 font-weight-bold">{{ formatCurrency(resumen.total_general) }}</div>
                        </div>
                        <VIcon size="48" color="info">ri-money-dollar-box-line</VIcon>
                    </div>
                </VCard>
            </VCol>
        </VRow>

        <!-- Tabla de Historial -->
        <VCard class="rounded-lg elevation-4">
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center gap-2">
                    <VIcon color="primary">ri-history-line</VIcon>
                    <span class="text-h5 font-weight-bold">Historial de Transferencias</span>
                </div>
            </VCardTitle>

            <VDivider />

            <VCardText class="pa-0">
                <VTable class="elevation-0">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Cuenta Origen</th>
                            <th>Cuenta Destino</th>
                            <th>Descripción / Motivo</th>
                            <th>Monto</th>
                            <th class="text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody style="text-transform: uppercase;">
                        <tr v-if="loading">
                            <td colspan="6" class="text-center pa-4">
                                <VProgressCircular indeterminate color="primary" />
                            </td>
                        </tr>
                        <tr v-else-if="!transfers.length">
                            <td colspan="6" class="text-center text-medium-emphasis py-8">
                                <VIcon size="48" class="mb-2">ri-arrow-left-right-line</VIcon>
                                <div class="text-h6 mb-1">No hay transferencias registradas</div>
                            </td>
                        </tr>
                        <tr v-else v-for="transfer in transfers" :key="transfer.id">
                            <td>{{ formatDate(transfer.transfer_date || transfer.created_at) }}</td>
                            <td>
                                <VChip color="error" variant="tonal" size="small">
                                    <VIcon start icon="ri-arrow-up-line" />
                                    {{ transfer.source_account?.name || 'Origen' }}
                                </VChip>
                            </td>
                            <td>
                                <VChip color="success" variant="tonal" size="small">
                                    <VIcon start icon="ri-arrow-down-line" />
                                    {{ transfer.destination_account?.name || 'Destino' }}
                                </VChip>
                            </td>
                            <td>{{ transfer.description || 'Sin descripción' }}</td>
                            <td class="font-weight-bold text-primary">{{ formatCurrency(transfer.amount) }}</td>
                            <td class="text-center">
                                <div class="d-flex justify-center gap-1">
                                    <VBtn icon="ri-edit-line" variant="elevated" size="small" color="primary"
                                        @click="openEditDialog(transfer)" title="Editar">
                                        <VIcon icon="ri-edit-line" />
                                    </VBtn>
                                    <VBtn icon="ri-delete-bin-line" variant="elevated" size="small" color="error"
                                        @click="deleteTransfer(transfer)" title="Eliminar">
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

    <!-- Modal de transferencias -->
    <TransferDialog v-model="showTransferDialog" :transfer-data="editingTransfer" @transferred="onTransferred" />

    <!-- Modal Confirmar Eliminación -->
    <VDialog v-model="showDeleteDialog" max-width="400">
        <VCard>
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-2">
                        <VIcon color="error" size="24">ri-delete-bin-line</VIcon>
                        <span class="text-h6 font-weight-bold">Eliminar Transferencia</span>
                    </div>
                    <VBtn icon="ri-close-line" variant="text" size="small" @click="closeDeleteDialog" />
                </div>
            </VCardTitle>
            <VDivider />
            <VCardText class="pa-4">
                <div class="text-body-1 mb-2">
                    ¿Estás seguro de eliminar esta transferencia por <strong>{{ formatCurrency(transferToDelete?.amount)
                        }}</strong>?
                </div>
                <div class="text-medium-emphasis text-body-2">
                    Esta acción no se puede deshacer y los saldos volverán a su estado anterior.
                </div>
            </VCardText>
            <VDivider />
            <VCardActions class="pa-4 d-flex justify-end">
                <VBtn variant="outlined" @click="closeDeleteDialog" :disabled="loading">Cancelar</VBtn>
                <VBtn color="error" variant="elevated" @click="confirmDeleteTransfer" :loading="loading"
                    prepend-icon="ri-delete-bin-line">
                    Eliminar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>