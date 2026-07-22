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
  total_general: 0,
})

const loading = ref(false)
const showTransferDialog = ref(false)
const editingTransfer = ref(null)
const showDeleteDialog = ref(false)
const transferToDelete = ref(null)

// Filtros y búsqueda
const searchQuery = ref('')
const selectedFilter = ref('all') // 'all', 'today', 'month'

// Cargar listado de transferencias
const loadTransfers = async () => {
  loader.start()
  loading.value = true

  try {
    const response = await $api('transfers')

    let dataArray = []

    if (response.data) {
      dataArray = response.data
    } else if (Array.isArray(response)) {
      dataArray = response
    }

    transfers.value = dataArray

    // Cálculo del resumen en frontend (Respaldo por si la API no lo envía)
    const todayObj = new Date()
    const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
    const currentMonth = today.substring(0, 7)

    let totalHoy = 0, totalMes = 0, totalGeneral = 0

    dataArray.forEach(group => {
      const items = group.transfers || [group]

      items.forEach(t => {
        const amount = parseFloat(t.amount || 0)
        const tDate = (t.transfer_date || t.created_at || '').split('T')[0]

        totalGeneral += amount
        if (tDate === today) totalHoy += amount
        if (tDate.substring(0, 7) === currentMonth) totalMes += amount
      })
    })

    resumen.value = response.resumen || {
      total_hoy: totalHoy,
      total_mes: totalMes,
      total_general: totalGeneral,
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
const openEditDialog = transfer => {
  editingTransfer.value = transfer
  showTransferDialog.value = true
}

const deleteTransfer = transfer => {
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
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Formatear Fecha corta
const formatDate = dateString => {
  if (!dateString) return 'N/A'
  try {
    const datePart = dateString.split('T')[0].split(' ')[0]
    const [year, month, day] = datePart.split('-')
    const date = new Date(year, month - 1, day)

    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch (e) {
    return dateString
  }
}

// Formatear fecha para encabezado de grupos
const formatDateHeader = labelString => {
  if (!labelString) return 'Transferencias'
  // Si la etiqueta es tipo YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(labelString)) {
    const todayObj = new Date()
    const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
    if (labelString === today) return 'Hoy'

    const [year, month, day] = labelString.split('-')
    const date = new Date(year, month - 1, day)
    
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
  }
  return labelString
}

// Obtener el nombre adecuado de la cuenta (adaptado a bank_name / name de la base de datos)
const getAccountName = account => {
  if (!account) return 'N/A'

  // Priorizar bank_name si está presente ("Efectivo", "Banco Pichincha", "Banco Guayaquil", etc.)
  const rawName = account.bank_name || account.name || ''

  return rawName
    .replace(/\(EFECTIVO\)/gi, '')
    .replace(/\(TRANSFERENCIA\)/gi, '')
    .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
    .trim() || account.name || 'Cuenta'
}

// Transferencias filtradas
const filteredTransfers = computed(() => {
  if (!transfers.value || !transfers.value.length) return []

  const query = searchQuery.value.trim().toLowerCase()
  const todayObj = new Date()
  const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
  const currentMonth = today.substring(0, 7)

  return transfers.value
    .map(group => {
      const items = group.transfers || [group]
      const matchingItems = items.filter(t => {
        const tDate = (t.transfer_date || t.created_at || '').split('T')[0]

        if (selectedFilter.value === 'today' && tDate !== today) return false
        if (selectedFilter.value === 'month' && tDate.substring(0, 7) !== currentMonth) return false

        if (!query) return true

        const sourceName = (getAccountName(t.source_account) + ' ' + (t.source_account?.name || '')).toLowerCase()
        const destName = (getAccountName(t.destination_account) + ' ' + (t.destination_account?.name || '')).toLowerCase()
        const desc = (t.description || '').toLowerCase()
        const amountStr = String(t.amount || '')
        const groupLabel = (group.label || '').toLowerCase()

        return (
          sourceName.includes(query) ||
          destName.includes(query) ||
          desc.includes(query) ||
          amountStr.includes(query) ||
          groupLabel.includes(query)
        )
      })

      return {
        ...group,
        transfers: matchingItems,
      }
    })
    .filter(group => group.transfers.length > 0)
})

// Total de ítems filtrados
const totalFilteredItems = computed(() => {
  return filteredTransfers.value.reduce((acc, g) => acc + (g.transfers ? g.transfers.length : 0), 0)
})

// Montar componente
onMounted(() => {
  if (canAccessTransfers.value) {
    loadTransfers()
  }
})
</script>

<template>
  <!-- Estado sin permisos -->
  <div v-if="!canAccessTransfers" class="d-flex justify-center align-center" style="min-height: 400px">
    <VCard class="pa-8 text-center rounded-xl elevation-4" max-width="460">
      <VAvatar color="error" variant="tonal" size="72" class="mb-4">
        <VIcon size="38" icon="ri-lock-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold mb-2 text-high-emphasis">
        Acceso Restringido
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-6">
        No tienes permisos suficientes para acceder al módulo de gestión de transferencias.
      </p>
      <VBtn color="primary" size="large" variant="elevated" prepend-icon="ri-dashboard-line" class="font-weight-semibold" @click="router.push('/dashboard')">
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>

  <div v-else class="pa-4 pa-sm-6 transfers-page">
    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-5 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-4">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="56" class="elevation-1">
            <VIcon icon="ri-arrow-left-right-line" size="32" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h4 font-weight-bold text-high-emphasis mb-0">Transferencias</h1>
              <VChip size="small" color="primary" variant="tonal" class="font-weight-bold">
                {{ totalFilteredItems }} {{ totalFilteredItems === 1 ? 'registro' : 'registros' }}
              </VChip>
            </div>
            <p class="text-body-1 text-medium-emphasis mb-0 mt-1">
              Control y auditoría de transferencias monetarias entre cuentas y cajas
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-3">
          <VBtn
            title="Actualizar datos"
            variant="tonal"
            color="secondary"
            icon="ri-refresh-line"
            :loading="loading"
            @click="loadTransfers"
          />
          <VBtn
            color="primary"
            variant="elevated"
            size="large"
            prepend-icon="ri-add-circle-line"
            class="font-weight-semibold elevation-2"
            @click="openTransferDialog"
          >
            Nueva Transferencia
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Tarjetas de Resumen KPI con colores tonales e impresiones de texto de alto contraste -->
    <VRow class="mb-6">
      <!-- Transferido Hoy -->
      <VCol cols="12" sm="6" md="4">
        <VCard class="pa-5 rounded-xl tonal-card bg-primary-tonal border-primary" elevation="0">
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-primary text-uppercase tracking-wider">
                Transferido Hoy
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(resumen.total_hoy) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Movimientos de la jornada actual
              </span>
            </div>
            <VAvatar color="primary" variant="elevated" size="52" class="elevation-3">
              <VIcon size="28" icon="ri-calendar-check-line" color="white" />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Transferido en el Mes -->
      <VCol cols="12" sm="6" md="4">
        <VCard class="pa-5 rounded-xl tonal-card bg-success-tonal border-success" elevation="0">
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-success text-uppercase tracking-wider">
                Transferido en el Mes
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(resumen.total_mes) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Acumulado mes en curso
              </span>
            </div>
            <VAvatar color="success" variant="elevated" size="52" class="elevation-3">
              <VIcon size="28" icon="ri-calendar-event-fill" color="white" />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Total Histórico -->
      <VCol cols="12" sm="12" md="4">
        <VCard class="pa-5 rounded-xl tonal-card bg-info-tonal border-info" elevation="0">
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-info text-uppercase tracking-wider">
                Total Histórico
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(resumen.total_general) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma total de transferencias
              </span>
            </div>
            <VAvatar color="info" variant="elevated" size="52" class="elevation-3">
              <VIcon size="28" icon="ri-safe-2-line" color="white" />
            </VAvatar>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Barra de Búsqueda y Filtros Rápidos -->
    <VCard class="pa-4 mb-6 rounded-xl border-light elevation-1">
      <VRow align="center" density="comfortable">
        <VCol cols="12" md="6">
          <VTextField
            v-model="searchQuery"
            prepend-inner-icon="ri-search-2-line"
            placeholder="Buscar por cuenta, descripción o monto..."
            hide-details
            clearable
            variant="outlined"
            density="compact"
            class="search-input"
          />
        </VCol>

        <VCol cols="12" md="6" class="d-flex justify-md-end align-center gap-2 flex-wrap">
          <span class="text-body-2 font-weight-medium text-medium-emphasis me-2">Filtrar:</span>
          <VBtn
            size="small"
            :variant="selectedFilter === 'all' ? 'elevated' : 'tonal'"
            :color="selectedFilter === 'all' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedFilter = 'all'"
          >
            Todos
          </VBtn>
          <VBtn
            size="small"
            :variant="selectedFilter === 'today' ? 'elevated' : 'tonal'"
            :color="selectedFilter === 'today' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedFilter = 'today'"
          >
            Hoy
          </VBtn>
          <VBtn
            size="small"
            :variant="selectedFilter === 'month' ? 'elevated' : 'tonal'"
            :color="selectedFilter === 'month' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedFilter = 'month'"
          >
            Este Mes
          </VBtn>
        </VCol>
      </VRow>
    </VCard>

    <!-- Cargando -->
    <div v-if="loading" class="text-center pa-12">
      <VProgressCircular indeterminate color="primary" size="54" width="4" />
      <div class="text-subtitle-1 mt-4 font-weight-medium text-medium-emphasis">
        Cargando transferencias...
      </div>
    </div>

    <!-- Sin registros -->
    <VCard v-else-if="!filteredTransfers.length" class="text-center pa-12 rounded-xl border-light elevation-1">
      <VAvatar color="primary" variant="tonal" size="80" class="mb-4">
        <VIcon icon="ri-inbox-line" size="42" color="primary" />
      </VAvatar>
      <h3 class="text-h6 font-weight-bold text-high-emphasis">
        {{ searchQuery ? 'Sin resultados para la búsqueda' : 'No hay transferencias registradas' }}
      </h3>
      <p class="text-body-2 text-medium-emphasis max-w-md mx-auto mt-1 mb-6">
        {{ searchQuery ? 'Prueba cambiando el término de búsqueda o limpia el filtro aplicado.' : 'Registra movimientos entre tus cuentas bancarias o cajas de efectivo.' }}
      </p>
      <VBtn
        v-if="!searchQuery"
        color="primary"
        variant="elevated"
        prepend-icon="ri-add-line"
        class="font-weight-semibold"
        @click="openTransferDialog"
      >
        Registrar Primera Transferencia
      </VBtn>
      <VBtn
        v-else
        color="secondary"
        variant="tonal"
        prepend-icon="ri-filter-off-line"
        class="font-weight-semibold"
        @click="searchQuery = ''; selectedFilter = 'all'"
      >
        Limpiar Filtros
      </VBtn>
    </VCard>

    <!-- Lista de Transferencias Unificada en una sola Card (sin sub-cards por día) -->
    <VCard v-else class="rounded-xl border-light overflow-hidden elevation-1 transfer-table-container">
      <VTable hover class="transfer-table text-no-wrap">
        <thead>
          <tr>
            <th class="text-left py-3" style="min-width: 320px;">
              FLUJO DE LA TRANSFERENCIA
            </th>
            <th class="text-left py-3">
              DESCRIPCIÓN & FECHA
            </th>
            <th class="text-right py-3" style="width: 160px;">
              MONTO
            </th>
            <th class="text-center py-3" style="width: 120px;">
              ACCIONES
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in filteredTransfers" :key="group.label">
            <!-- Fila de Encabezado por Fecha -->
            <tr class="transfer-date-header-row">
              <td colspan="4">
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar color="primary" variant="tonal" size="32" rounded="lg">
                      <VIcon icon="ri-calendar-event-line" size="18" color="primary" />
                    </VAvatar>
                    <div class="d-flex align-center gap-2">
                      <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
                        {{ formatDateHeader(group.label) }}
                      </span>
                      <span class="text-caption text-medium-emphasis">
                        • {{ group.transfers.length }} {{ group.transfers.length === 1 ? 'operación' : 'operaciones' }}
                      </span>
                    </div>
                  </div>

                  <div class="d-flex align-center gap-2 me-2">
                    <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold">TOTAL DÍA:</span>
                    <VChip color="primary" variant="tonal" size="small" class="font-weight-bold px-3">
                      {{ formatCurrency(group.transfers.reduce((acc, t) => acc + parseFloat(t.amount || 0), 0)) }}
                    </VChip>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Filas de Transferencias para ese día -->
            <tr
              v-for="transfer in group.transfers"
              :key="transfer.id"
              class="transfer-row"
            >
              <!-- Flujo: Origen -> Destino con chips tonales y nombres adaptados (bank_name) -->
              <td class="py-3">
                <div class="d-flex align-center gap-2 flex-wrap">
                  <VChip
                    color="error"
                    variant="tonal"
                    size="small"
                    class="font-weight-semibold"
                  >
                    <VIcon start size="14" icon="ri-arrow-up-line" />
                    {{ getAccountName(transfer.source_account) }}
                  </VChip>

                  <VIcon icon="ri-arrow-right-line" color="medium-emphasis" size="16" class="mx-1" />

                  <VChip
                    color="success"
                    variant="tonal"
                    size="small"
                    class="font-weight-semibold"
                  >
                    <VIcon start size="14" icon="ri-arrow-down-line" />
                    {{ getAccountName(transfer.destination_account) }}
                  </VChip>
                </div>
              </td>

              <!-- Descripción & Fecha -->
              <td class="py-3">
                <div class="d-flex flex-column">
                  <span class="text-body-2 font-weight-medium text-high-emphasis">
                    {{ transfer.description || 'Sin descripción' }}
                  </span>
                  <span class="text-caption text-medium-emphasis">
                    {{ formatDate(transfer.transfer_date || transfer.created_at) }}
                  </span>
                </div>
              </td>

              <!-- Monto -->
              <td class="py-3 text-right">
                <span class="text-subtitle-1 font-weight-bold text-primary me-1">
                  {{ formatCurrency(transfer.amount) }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="py-3 text-center">
                <div class="d-flex justify-center gap-1">
                  <VBtn
                    title="Editar registro"
                    size="small"
                    variant="tonal"
                    color="primary"
                    icon="ri-edit-line"
                    class="action-btn"
                    @click="openEditDialog(transfer)"
                  />
                  <VBtn
                    title="Eliminar registro"
                    size="small"
                    variant="tonal"
                    color="error"
                    icon="ri-delete-bin-line"
                    class="action-btn"
                    @click="deleteTransfer(transfer)"
                  />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </VTable>
    </VCard>
  </div>

  <!-- Modal de transferencias -->
  <TransferDialog
    v-model="showTransferDialog"
    :transfer-data="editingTransfer"
    @transferred="onTransferred"
  />

  <!-- Modal Confirmar Eliminación -->
  <VDialog v-model="showDeleteDialog" max-width="440">
    <VCard class="rounded-xl pa-2">
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-3">
            <VAvatar color="error" variant="tonal" size="40">
              <VIcon color="error" icon="ri-delete-bin-line" size="22" />
            </VAvatar>
            <span class="text-h6 font-weight-bold text-high-emphasis">Eliminar Transferencia</span>
          </div>
          <VBtn icon="ri-close-line" variant="text" size="small" @click="closeDeleteDialog" />
        </div>
      </VCardTitle>
      <VDivider class="my-2" />
      <VCardText class="pa-4">
        <div class="text-body-1 text-high-emphasis mb-2">
          ¿Estás seguro de eliminar esta transferencia por
          <strong class="text-error font-weight-bold">{{ formatCurrency(transferToDelete?.amount) }}</strong>?
        </div>
        <div class="text-caption text-medium-emphasis bg-error-tonal pa-3 rounded-lg border-error">
          <VIcon icon="ri-alert-line" size="16" color="error" class="me-1" />
          Esta acción revertirá los fondos a sus cuentas de origen y destino originales.
        </div>
      </VCardText>
      <VCardActions class="pa-4 pt-0 d-flex justify-end gap-2">
        <VBtn variant="tonal" color="secondary" class="font-weight-semibold" :disabled="loading" @click="closeDeleteDialog">
          Cancelar
        </VBtn>
        <VBtn color="error" variant="elevated" class="font-weight-semibold" :loading="loading" prepend-icon="ri-delete-bin-line" @click="confirmDeleteTransfer">
          Confirmar Eliminación
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.sticky-header {
  position: sticky;
  top: 62px;
  z-index: 99;
  background-color: rgb(var(--v-theme-surface)) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08) !important;
  transition: all 0.2s ease;
}
@media (min-width: 960px) {
  .sticky-header {
    top: 70px;
  }
}
</style>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
