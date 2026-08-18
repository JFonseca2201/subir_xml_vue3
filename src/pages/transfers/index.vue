<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'
import OperationsHeaderNav from '@/components/operations/OperationsHeaderNav.vue'

import { usePermissions } from '@/composables/usePermissions'

// Router y dependencias globales
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const { can } = usePermissions()

// Validación de seguridad vía permisos
const canAccessTransfers = computed(() => {
  return can('list_transfer')
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

const loadTransfers = async () => {
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
    loading.value = false
  }
}

const cleanAccountName = name => {
  if (!name) return 'N/A'
  
  return name
    .replace(/\(EFECTIVO\)/gi, '')
    .replace(/\(TRANSFERENCIA\)/gi, '')
    .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
    .trim()
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
  <div
    v-if="!canAccessTransfers"
    class="d-flex justify-center align-center"
    style="min-height: 400px"
  >
    <VCard
      class="pa-8 text-center rounded-xl elevation-4"
      max-width="460"
    >
      <VAvatar
        color="error"
        variant="tonal"
        size="72"
        class="mb-4"
      >
        <VIcon
          size="38"
          icon="ri-lock-line"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold mb-2 text-high-emphasis">
        Acceso Restringido
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-6">
        No tienes permisos suficientes para acceder al módulo de gestión de transferencias.
      </p>
      <VBtn
        color="primary"
        size="large"
        variant="elevated"
        prepend-icon="ri-dashboard-line"
        class="font-weight-semibold"
        @click="router.push('/dashboard')"
      >
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>

  <div
    v-else
    class="pa-4 pa-sm-6 transfers-page"
  >
    <!-- Encabezado de Navegación de Operaciones -->
    <OperationsHeaderNav active-tab="transferencias" />

    <!-- Header Principal Sticky -->
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
              icon="ri-arrow-left-right-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Transferencias
              </h1>
              <VChip
                size="small"
                color="primary"
                variant="tonal"
                class="font-weight-bold"
              >
                {{ totalFilteredItems }} {{ totalFilteredItems === 1 ? 'registro' : 'registros' }}
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
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
            size="small"
            :loading="loading"
            @click="loadTransfers"
          />
          <VBtn
            v-if="can('register_transfer')"
            color="primary"
            variant="elevated"
            size="small"
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
    <VRow class="mb-5">
      <!-- Transferido Hoy -->
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
                Transferido Hoy
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(resumen.total_hoy) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Movimientos de la jornada actual
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
                icon="ri-calendar-check-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Transferido en el Mes -->
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
                Transferido en el Mes
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(resumen.total_mes) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Acumulado mes en curso
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
                icon="ri-calendar-event-fill"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Total Histórico -->
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
                Total Histórico
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(resumen.total_general) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma total de transferencias
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
                icon="ri-safe-2-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Barra de Búsqueda y Filtros Rápidos -->
    <VCard class="pa-4 mb-6 rounded-xl border-light elevation-1">
      <VRow
        align="center"
        density="comfortable"
      >
        <VCol
          cols="12"
          md="6"
        >
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

        <VCol
          cols="12"
          md="6"
          class="d-flex justify-md-end align-center gap-2 flex-wrap"
        >
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

    <!-- Sin registros iniciales (Base de datos vacía) -->
    <VCard
      v-if="!loading && !transfers.length"
      class="text-center pa-12 rounded-xl border-light elevation-1"
    >
      <VAvatar
        color="primary"
        variant="tonal"
        size="80"
        class="mb-4"
      >
        <VIcon
          icon="ri-inbox-line"
          size="42"
          color="primary"
        />
      </VAvatar>
      <h3 class="text-h6 font-weight-bold text-high-emphasis">
        No hay transferencias registradas
      </h3>
      <p class="text-body-2 text-medium-emphasis max-w-md mx-auto mt-1 mb-6">
        Registra movimientos entre tus cuentas bancarias o cajas de efectivo.
      </p>
      <VBtn
        color="primary"
        variant="elevated"
        prepend-icon="ri-add-line"
        class="font-weight-semibold"
        @click="openTransferDialog"
      >
        Registrar Primera Transferencia
      </VBtn>
    </VCard>

    <!-- Lista de Transferencias Unificada (Se muestra si está cargando o si ya hay registros) -->
    <VCard
      v-else
      class="rounded-xl border-light overflow-hidden elevation-1 transfer-table-container position-relative"
    >
      <VProgressLinear
        v-if="loading"
        v-slot
        indeterminate
        color="primary"
        height="3"
        class="position-absolute"
        style="top: 0; left: 0; right: 0; z-index: 10;"
      />
      <VTable
        hover
        class="transfer-table text-no-wrap"
      >
        <thead>
          <tr>
            <th
              class="text-left py-3"
              style="min-width: 320px;"
            >
              FLUJO DE LA TRANSFERENCIA
            </th>
            <th class="text-left py-3">
              DESCRIPCIÓN & FECHA
            </th>
            <th
              class="text-right py-3"
              style="width: 160px;"
            >
              MONTO
            </th>
            <th
              class="text-center py-3"
              style="width: 120px;"
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
              <div class="shimmer-line w-75" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-60 mb-2" />
              <div class="shimmer-line w-40" />
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

        <!-- Sin resultados filtrados -->
        <tbody v-else-if="!filteredTransfers.length">
          <tr>
            <td
              colspan="4"
              class="text-center py-12 text-medium-emphasis"
            >
              <VAvatar
                color="primary"
                variant="tonal"
                size="64"
                class="mb-3"
              >
                <VIcon
                  icon="ri-inbox-line"
                  size="32"
                  color="primary"
                />
              </VAvatar>
              <div class="text-h6 font-weight-bold text-high-emphasis">
                Sin resultados para la búsqueda
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                Prueba cambiando el término de búsqueda o limpia el filtro aplicado.
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Datos reales -->
        <tbody v-else>
          <template
            v-for="group in filteredTransfers"
            :key="group.label"
          >
            <!-- Fila de Encabezado por Fecha -->
            <tr class="transfer-date-header-row">
              <td colspan="4">
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      size="32"
                      rounded="lg"
                    >
                      <VIcon
                        icon="ri-calendar-event-line"
                        size="18"
                        color="primary"
                      />
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
                    <VChip
                      color="primary"
                      variant="tonal"
                      size="small"
                      class="font-weight-bold px-3"
                    >
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
                  <div class="d-flex align-center gap-1 bg-red-tonal px-3 py-1 rounded-lg border-danger">
                    <VIcon
                      start
                      size="14"
                      icon="ri-bank-line"
                      color="error"
                    />
                    <span class="text-body-2 font-weight-bold text-error">
                      {{ getAccountName(transfer.source_account) }}
                    </span>
                  </div>

                  <VIcon
                    icon="ri-arrow-right-line"
                    size="16"
                    class="text-medium-emphasis mx-1 animate-arrow"
                  />

                  <div class="d-flex align-center gap-1 bg-success-tonal px-3 py-1 rounded-lg border-success">
                    <VIcon
                      start
                      size="14"
                      icon="ri-bank-line"
                      color="success"
                    />
                    <span class="text-body-2 font-weight-bold text-success">
                      {{ getAccountName(transfer.destination_account) }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Descripción & Fecha -->
              <td class="py-3">
                <div class="d-flex flex-column">
                  <span class="text-body-2 font-weight-semibold text-high-emphasis">
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
                    v-if="can('edit_transfer')"
                    title="Editar registro"
                    size="small"
                    variant="tonal"
                    color="primary"
                    icon="ri-edit-line"
                    class="action-btn"
                    @click="openEditDialog(transfer)"
                  />
                  <VBtn
                    v-if="can('delete_transfer')"
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
  <VDialog
    v-model="showDeleteDialog"
    scrollable
    max-width="440"
  >
    <VCard class="rounded-xl pa-2">
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-3">
            <VAvatar
              color="error"
              variant="tonal"
              size="40"
            >
              <VIcon
                color="error"
                icon="ri-delete-bin-line"
                size="22"
              />
            </VAvatar>
            <span class="text-h6 font-weight-bold text-high-emphasis">Eliminar Transferencia</span>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            @click="closeDeleteDialog"
          />
        </div>
      </VCardTitle>
      <VDivider class="my-2" />
      <VCardText class="pa-4">
        <div class="text-body-1 text-high-emphasis mb-2">
          ¿Estás seguro de eliminar esta transferencia por
          <strong class="text-error font-weight-bold">{{ formatCurrency(transferToDelete?.amount) }}</strong>?
        </div>
        <div class="text-caption text-medium-emphasis bg-error-tonal pa-3 rounded-lg border-error">
          <VIcon
            icon="ri-alert-line"
            size="16"
            color="error"
            class="me-1"
          />
          Esta acción revertirá los fondos a sus cuentas de origen y destino originales.
        </div>
      </VCardText>
      <VCardActions
        class="pa-4 pt-0 d-flex justify-end align-center gap-3"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loading"
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
          :loading="loading"
          @click="confirmDeleteTransfer"
        >
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

.shimmer-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-chip {
  width: 60px;
  height: 20px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-button {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
