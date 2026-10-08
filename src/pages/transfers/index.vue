<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'
import MovementReceiptNoteDialog from '@/components/inventory/finances-records/MovementReceiptNoteDialog.vue'
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
const accounts = ref([])

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
const showNoteDialog = ref(false)
const selectedTransferForNote = ref(null)

const openNoteDialog = transfer => {
  const fromAcc = transfer.source_account || accounts.value.find(a => String(a.id) === String(transfer.from_account_id || transfer.source_account_id))
  const toAcc = transfer.destination_account || accounts.value.find(a => String(a.id) === String(transfer.to_account_id || transfer.destination_account_id))

  selectedTransferForNote.value = {
    ...transfer,
    type: 'transfer',
    attachable_type: 'internal_transfer',
    referencia: 'internal_transfer',
    transfer_date: transfer.transfer_date || transfer.created_at,
    amount: transfer.amount,
    description: transfer.description,
    from_account: fromAcc,
    to_account: toAcc,
    from_account_id: fromAcc?.id || transfer.from_account_id || transfer.source_account_id,
    to_account_id: toAcc?.id || transfer.to_account_id || transfer.destination_account_id,
    from_account_name: fromAcc?.bank_name || fromAcc?.name,
    to_account_name: toAcc?.bank_name || toAcc?.name,
    resolved_attachments: transfer.attachments || transfer.resolved_attachments || [],
  }
  showNoteDialog.value = true
}

// Filtros y búsqueda
const searchQuery = ref('')
const selectedFilter = ref('all') // 'all', 'today', 'month'

const loadTransfers = async () => {
  loading.value = true

  try {
    const [response, accountsRes] = await Promise.all([
      $api('transfers'),
      $api('accounts').catch(() => []),
    ])

    accounts.value = accountsRes || []
    
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
  if (!dateString) return '-'
  try {
    const datePart = dateString.split('T')[0].split(' ')[0]
    const parts = datePart.split('-')
    if (parts.length === 3) {
      const [year, month, day] = parts
      
      return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`
    }

    const date = new Date(dateString)
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      
      return `${y}/${m}/${d}`
    }
  } catch (e) {
    return dateString
  }
  
  return dateString
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

// Transferencias filtradas (plano para paginación)
const allFilteredTransfers = computed(() => {
  if (!transfers.value || !transfers.value.length) return []

  const query = searchQuery.value.trim().toLowerCase()
  const todayObj = new Date()
  const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
  const currentMonth = today.substring(0, 7)

  const flatList = []

  transfers.value.forEach(group => {
    const items = group.transfers || [group]

    items.forEach(t => {
      const tDate = (t.transfer_date || t.created_at || '').split('T')[0]

      if (selectedFilter.value === 'today' && tDate !== today) return
      if (selectedFilter.value === 'month' && tDate.substring(0, 7) !== currentMonth) return

      if (query) {
        const sourceName = (getAccountName(t.source_account) + ' ' + (t.source_account?.name || '')).toLowerCase()
        const destName = (getAccountName(t.destination_account) + ' ' + (t.destination_account?.name || '')).toLowerCase()
        const desc = (t.description || '').toLowerCase()
        const amountStr = String(t.amount || '')
        const groupLabel = (group.label || '').toLowerCase()

        const match = (
          sourceName.includes(query) ||
          destName.includes(query) ||
          desc.includes(query) ||
          amountStr.includes(query) ||
          groupLabel.includes(query)
        )

        if (!match) return
      }

      flatList.push(t)
    })
  })

  return flatList.sort((a, b) => new Date(b.transfer_date || b.created_at || 0) - new Date(a.transfer_date || a.created_at || 0))
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(15)
const totalPages = computed(() => Math.ceil(allFilteredTransfers.value.length / itemsPerPage.value) || 1)

watch(totalPages, newVal => {
  if (currentPage.value > newVal) {
    currentPage.value = newVal || 1
  }
})

watch([searchQuery, selectedFilter], () => {
  currentPage.value = 1
})

// Transferencias de la página activa
const paginatedTransfers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  
  return allFilteredTransfers.value.slice(start, end)
})

// Agrupación por fecha de las transferencias de la página activa
const paginatedGroupedTransfers = computed(() => {
  const groups = {}

  paginatedTransfers.value.forEach(t => {
    const date = (t.transfer_date || t.created_at || '').split('T')[0] || 'Sin fecha'
    if (!groups[date]) {
      groups[date] = {
        label: date,
        transfers: [],
      }
    }
    groups[date].transfers.push(t)
  })

  return Object.values(groups).sort((a, b) => new Date(b.label) - new Date(a.label))
})

// Total de ítems filtrados
const totalFilteredItems = computed(() => allFilteredTransfers.value.length)

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
              <div class="status-pill-clean status-transfer">
                <span class="status-dot" />
                <span>{{ totalFilteredItems }} {{ totalFilteredItems === 1 ? 'registro' : 'registros' }}</span>
              </div>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle d-none d-sm-block">
              Control y auditoría de transferencias monetarias entre cuentas y cajas
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap w-100 w-sm-auto">
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
            class="font-weight-semibold elevation-2 flex-grow-1 flex-sm-grow-0"
            @click="openTransferDialog"
          >
            Nueva Transferencia
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Tarjetas de Resumen KPI con colores tonales e impresiones de texto de alto contraste -->
    <VRow class="mb-5 d-none d-sm-flex">
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
            :loading="loading"
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

    <!-- Contenedor v-else para transferencias existentes (Móvil + Desktop + Paginación) -->
    <div v-else>
      <!-- VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-4 mb-4">
        <div
          v-if="loading"
          class="d-flex flex-column gap-3"
        >
          <div
            v-for="n in 3"
            :key="n"
            class="pa-4 rounded-xl border bg-surface"
          >
            <div class="shimmer-line w-50 mb-2" />
            <div class="shimmer-line w-75 mb-3" />
            <div class="shimmer-line w-40" />
          </div>
        </div>
        <div
          v-else-if="!allFilteredTransfers.length"
          class="text-center pa-8 rounded-xl border bg-surface"
        >
          <VAvatar
            size="56"
            color="primary"
            variant="tonal"
            class="mb-3"
          >
            <VIcon
              size="28"
              icon="ri-arrow-left-right-line"
            />
          </VAvatar>
          <p class="text-body-1 font-weight-bold mb-1">
            No se encontraron transferencias
          </p>
          <p class="text-caption text-medium-emphasis mb-0">
            Intenta cambiar los términos de búsqueda o registra una transferencia.
          </p>
        </div>
        <template
          v-for="group in paginatedGroupedTransfers"
          v-else
          :key="`mob-tr-grp-${group.label}`"
        >
          <!-- Cabecera de Día Móvil -->
          <div class="pa-3 rounded-xl bg-slate-50 border d-flex flex-column gap-1.5">
            <div class="d-flex align-center justify-space-between flex-wrap gap-2">
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="ri-calendar-event-line"
                  size="18"
                  color="primary"
                />
                <span class="text-body-2 font-weight-bold text-high-emphasis">
                  {{ formatDateHeader(group.label) }}
                </span>
              </div>
              <div class="status-pill-clean status-transfer">
                <span class="status-dot" />
                <span>{{ group.transfers.length }} {{ group.transfers.length === 1 ? 'operación' : 'operaciones' }}</span>
              </div>
            </div>
            <div class="d-flex align-center justify-space-between pt-1 border-t text-caption font-weight-bold">
              <span class="text-medium-emphasis text-uppercase">Total jornada:</span>
              <span class="text-primary font-weight-black">
                {{ formatCurrency(group.transfers.reduce((acc, t) => acc + parseFloat(t.amount || 0), 0)) }}
              </span>
            </div>
          </div>

          <!-- Tarjetas de Transferencia del Día -->
          <div
            v-for="transfer in group.transfers"
            :key="`mob-transfer-${transfer.id}`"
            class="mobile-transfer-card"
          >
            <!-- Fila Superior: Fecha y Referencia -->
            <div class="d-flex align-center justify-space-between pb-2 border-b mb-2">
              <span class="text-caption text-medium-emphasis font-weight-medium">
                {{ formatDate(transfer.transfer_date || transfer.created_at) }}
              </span>
              <span class="text-caption font-mono font-weight-bold text-medium-emphasis">
                #TRANS-{{ transfer.id }}
              </span>
            </div>

            <!-- Flujo de Cuentas: Origen -> Destino -->
            <div class="transfer-flow-container w-100 mb-2.5 justify-space-between">
              <div class="transfer-endpoint">
                <VAvatar
                  size="22"
                  color="secondary"
                  variant="tonal"
                  class="rounded-circle shrink-0"
                >
                  <VIcon
                    :icon="getAccountName(transfer.source_account).toLowerCase().includes('efectivo') || getAccountName(transfer.source_account).toLowerCase().includes('caja') ? 'ri-money-dollar-circle-line' : 'ri-bank-line'"
                    size="12"
                  />
                </VAvatar>
                <span
                  class="account-name text-truncate"
                  style="max-width: 120px;"
                >
                  {{ getAccountName(transfer.source_account) }}
                </span>
              </div>

              <div class="transfer-arrow-separator">
                <VIcon
                  icon="ri-arrow-right-line"
                  size="12"
                />
              </div>

              <div class="transfer-endpoint">
                <VAvatar
                  size="22"
                  color="primary"
                  variant="tonal"
                  class="rounded-circle shrink-0"
                >
                  <VIcon
                    :icon="getAccountName(transfer.destination_account).toLowerCase().includes('efectivo') || getAccountName(transfer.destination_account).toLowerCase().includes('caja') ? 'ri-money-dollar-circle-line' : 'ri-bank-line'"
                    size="12"
                  />
                </VAvatar>
                <span
                  class="account-name font-weight-bold text-high-emphasis text-truncate"
                  style="max-width: 120px;"
                >
                  {{ getAccountName(transfer.destination_account) }}
                </span>
              </div>
            </div>

            <!-- Concepto / Descripción -->
            <div class="mb-2 text-body-2 text-slate-800">
              {{ transfer.description || 'Transferencia entre cuentas' }}
            </div>

            <!-- Fila Inferior: Monto y Acciones -->
            <div class="d-flex align-center justify-space-between pt-2 border-t flex-wrap gap-2">
              <div>
                <span
                  class="text-caption text-medium-emphasis d-block"
                  style="font-size: 0.68rem;"
                >MONTO</span>
                <span class="text-h6 font-weight-black text-primary">
                  {{ formatCurrency(transfer.amount) }}
                </span>
              </div>

              <div class="d-flex align-center gap-1 ms-auto">
                <VBtn
                  size="small"
                  variant="tonal"
                  color="primary"
                  icon="ri-eye-line"
                  class="rounded-lg"
                  title="Ver Nota"
                  @click="openNoteDialog(transfer)"
                />
                <VBtn
                  size="small"
                  variant="tonal"
                  color="secondary"
                  icon="ri-attachment-line"
                  class="rounded-lg"
                  title="Adjuntos"
                  @click="openAttachDialog(transfer)"
                />
                <VBtn
                  v-if="can('edit_transfer')"
                  size="small"
                  variant="tonal"
                  color="warning"
                  icon="ri-pencil-line"
                  class="rounded-lg"
                  title="Editar"
                  @click="openEditDialog(transfer)"
                />
                <VBtn
                  v-if="can('delete_transfer')"
                  size="small"
                  variant="tonal"
                  color="error"
                  icon="ri-delete-bin-line"
                  class="rounded-lg"
                  title="Eliminar"
                  @click="deleteTransfer(transfer)"
                />
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Lista de Transferencias Unificada Desktop (d-none d-md-block) -->
      <VCard class="d-none d-md-block rounded-xl border-light overflow-hidden elevation-1 transfer-table-container position-relative">
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
          class="transfer-table"
        >
          <thead>
            <tr>
              <th
                class="text-left py-3"
                style="width: 44%;"
              >
                FLUJO DE LA TRANSFERENCIA
              </th>
              <th
                class="text-left py-3"
                style="width: 30%;"
              >
                DESCRIPCIÓN & FECHA
              </th>
              <th
                class="text-right py-3"
                style="width: 14%;"
              >
                MONTO
              </th>
              <th
                class="text-center py-3"
                style="width: 12%;"
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
          <tbody v-else-if="!allFilteredTransfers.length">
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
              v-for="group in paginatedGroupedTransfers"
              :key="group.label"
            >
              <!-- Fila de Encabezado por Fecha -->
              <tr class="transfer-date-header-row">
                <td colspan="4">
                  <div class="d-flex align-center justify-space-between flex-wrap gap-2 py-1">
                    <div class="d-flex align-center gap-3">
                      <VAvatar
                        color="primary"
                        variant="tonal"
                        size="36"
                        class="rounded-lg"
                      >
                        <VIcon
                          icon="ri-calendar-event-line"
                          size="20"
                          color="primary"
                        />
                      </VAvatar>
                      <div class="d-flex align-center gap-2">
                        <span class="text-subtitle-2 font-weight-bold text-slate-900">
                          {{ formatDateHeader(group.label) }}
                        </span>
                        <div class="status-pill-clean status-transfer">
                          <span class="status-dot" />
                          <span>{{ group.transfers.length }} {{ group.transfers.length === 1 ? 'operación' : 'operaciones' }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="d-flex align-center gap-2 me-2">
                      <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold">Total del Día:</span>
                      <div class="status-pill-clean status-paid">
                        <span class="status-dot" />
                        <span>{{ formatCurrency(group.transfers.reduce((acc, t) => acc + parseFloat(t.amount || 0), 0)) }}</span>
                      </div>
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
                <!-- Flujo: Origen -> Destino sobrio y elegante -->
                <td class="py-3">
                  <div class="transfer-flow-container">
                    <!-- Origen -->
                    <div class="transfer-endpoint">
                      <VAvatar
                        size="24"
                        color="secondary"
                        variant="tonal"
                        class="rounded-circle shrink-0"
                      >
                        <VIcon
                          :icon="getAccountName(transfer.source_account).toLowerCase().includes('efectivo') || getAccountName(transfer.source_account).toLowerCase().includes('caja') ? 'ri-money-dollar-circle-line' : 'ri-bank-line'"
                          size="13"
                          color="secondary"
                        />
                      </VAvatar>
                      <span class="account-name">{{ getAccountName(transfer.source_account) }}</span>
                    </div>

                    <!-- Separador Flecha -->
                    <div class="transfer-arrow-separator">
                      <VIcon
                        icon="ri-arrow-right-line"
                        size="12"
                      />
                    </div>

                    <!-- Destino -->
                    <div class="transfer-endpoint">
                      <VAvatar
                        size="24"
                        color="primary"
                        variant="tonal"
                        class="rounded-circle shrink-0"
                      >
                        <VIcon
                          :icon="getAccountName(transfer.destination_account).toLowerCase().includes('efectivo') || getAccountName(transfer.destination_account).toLowerCase().includes('caja') ? 'ri-money-dollar-circle-line' : 'ri-bank-line'"
                          size="13"
                          color="primary"
                        />
                      </VAvatar>
                      <span class="account-name font-weight-bold text-high-emphasis">{{ getAccountName(transfer.destination_account) }}</span>
                    </div>
                  </div>
                </td>

                <!-- Descripción & Fecha -->
                <td class="py-3">
                  <div class="d-flex flex-column">
                    <span class="text-body-2 font-weight-bold text-slate-900 leading-tight">
                      {{ transfer.description || 'Transferencia entre cuentas' }}
                    </span>
                    <div class="d-flex align-center gap-1.5 text-caption text-medium-emphasis font-weight-medium mt-1">
                      <VIcon
                        icon="ri-calendar-line"
                        size="14"
                        color="secondary"
                      />
                      <span>{{ formatDate(transfer.transfer_date || transfer.created_at) }}</span>
                    </div>
                  </div>
                </td>

                <!-- Monto -->
                <td class="py-3 text-right">
                  <span class="text-subtitle-1 font-weight-black text-primary">
                    {{ formatCurrency(transfer.amount) }}
                  </span>
                </td>

                <!-- Acciones -->
                <td class="py-3 text-center">
                  <div class="d-flex align-center justify-center gap-1">
                    <!-- Botón Principal: Ver Nota de Transferencia -->
                    <VBtn
                      title="Ver nota de transferencia y comprobantes"
                      size="small"
                      variant="tonal"
                      color="primary"
                      icon="ri-eye-line"
                      class="action-btn"
                      @click="openNoteDialog(transfer)"
                    />

                    <!-- Menú Pro de Acciones Secundarias -->
                    <VMenu
                      v-if="can('edit_transfer') || can('delete_transfer')"
                      location="bottom end"
                      transition="scale-transition"
                    >
                      <template #activator="{ props: menuProps }">
                        <VBtn
                          v-bind="menuProps"
                          size="small"
                          variant="text"
                          color="secondary"
                          icon="ri-more-2-fill"
                          class="action-btn"
                          title="Más opciones"
                        />
                      </template>

                      <VList
                        density="compact"
                        elevation="6"
                        class="py-1 rounded-lg"
                        min-width="180"
                      >
                        <VListItem
                          v-if="can('edit_transfer')"
                          @click="openEditDialog(transfer)"
                        >
                          <template #prepend>
                            <VIcon
                              icon="ri-edit-line"
                              color="warning"
                              size="18"
                              class="me-2"
                            />
                          </template>
                          <VListItemTitle class="font-weight-medium text-body-2">
                            Editar Registro
                          </VListItemTitle>
                        </VListItem>

                        <VDivider
                          v-if="can('edit_transfer') && can('delete_transfer')"
                          class="my-1"
                        />

                        <VListItem
                          v-if="can('delete_transfer')"
                          class="text-error"
                          @click="deleteTransfer(transfer)"
                        >
                          <template #prepend>
                            <VIcon
                              icon="ri-delete-bin-line"
                              color="error"
                              size="18"
                              class="me-2"
                            />
                          </template>
                          <VListItemTitle class="font-weight-medium text-body-2 text-error">
                            Eliminar Registro
                          </VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard
        v-if="allFilteredTransfers.length > 0"
        class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface"
      >
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="d-flex align-center gap-4 flex-wrap">
            <div class="text-body-2 text-medium-emphasis">
              Mostrando <strong class="text-high-emphasis">{{ paginatedTransfers.length }}</strong> de <strong class="text-high-emphasis">{{ allFilteredTransfers.length }}</strong> transferencias
            </div>
            <div
              class="d-flex align-center gap-2"
              style="min-width: 140px;"
            >
              <span class="text-caption text-medium-emphasis">Por pág:</span>
              <VSelect
                v-model="itemsPerPage"
                :items="[10, 15, 25, 50, 100]"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 95px;"
                @update:model-value="currentPage = 1"
              />
            </div>
          </div>
          <VPagination
            v-if="totalPages > 1"
            v-model="currentPage"
            :length="totalPages"
            :disabled="loading"
            rounded="circle"
            :total-visible="$vuetify.display.xs ? 4 : 7"
            :size="$vuetify.display.xs ? 'small' : 'default'"
            density="comfortable"
            color="primary"
            class="my-0"
          />
        </div>
      </VCard>
    </div>
  </div>

  <!-- Modal Ver Nota de Transferencia -->
  <MovementReceiptNoteDialog
    v-model="showNoteDialog"
    :movement="selectedTransferForNote"
    :accounts="accounts"
    @updated="loadTransfers"
  />

  <!-- Modal de transferencias -->
  <TransferDialog
    v-model="showTransferDialog"
    :transfer-data="editingTransfer"
    @transferred="onTransferred"
  />

  <!-- Modal Confirmar Eliminación Estándar del Sistema -->
  <VDialog
    v-model="showDeleteDialog"
    scrollable
    max-width="500"
    persistent
    transition="dialog-bottom-transition"
  >
    <VCard class="custom-dialog-card elevation-12">
      <!-- Header Banner Primary (Color del sistema) -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="loader.loading"
          @click="closeDeleteDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Transferencia
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción revertirá la transferencia de fondos entre cuentas
        </p>
      </div>

      <VCardText class="pa-6">
        <div class="text-center">
          <!-- Transfer Avatar -->
          <VAvatar
            size="72"
            color="primary"
            variant="tonal"
            class="mb-3"
          >
            <VIcon
              icon="ri-arrow-left-right-line"
              size="36"
            />
          </VAvatar>

          <!-- Transfer Info Summary -->
          <div class="mb-2">
            <h4 class="text-h6 font-weight-bold mb-1 text-high-emphasis">
              ¿Eliminar esta transferencia?
            </h4>
            <p class="text-caption text-medium-emphasis mb-3">
              Monto a revertir: <strong class="text-error font-weight-bold font-mono">{{ formatCurrency(transferToDelete?.amount) }}</strong>
            </p>

            <!-- Detalles en Card Plana -->
            <div
              class="pa-3 rounded-xl border d-flex flex-column gap-2 text-start info-card-flat"
              style="background-color: #f8fafc;"
            >
              <div class="d-flex justify-space-between align-center">
                <span class="text-caption text-medium-emphasis">Cuenta Origen (Sale de):</span>
                <span class="text-caption font-weight-bold text-error">
                  {{ getAccountName(transferToDelete?.source_account) }}
                </span>
              </div>

              <div class="d-flex justify-space-between align-center">
                <span class="text-caption text-medium-emphasis">Cuenta Destino (Ingresa a):</span>
                <span class="text-caption font-weight-bold text-success">
                  {{ getAccountName(transferToDelete?.destination_account) }}
                </span>
              </div>

              <div
                v-if="transferToDelete?.description"
                class="d-flex justify-space-between align-center"
              >
                <span class="text-caption text-medium-emphasis">Descripción:</span>
                <span
                  class="text-caption text-high-emphasis text-truncate"
                  style="max-width: 220px;"
                >
                  {{ transferToDelete.description }}
                </span>
              </div>

              <div class="d-flex justify-space-between align-center">
                <span class="text-caption text-medium-emphasis">Fecha:</span>
                <span class="text-caption font-mono font-weight-medium">
                  {{ formatDate(transferToDelete?.transfer_date || transferToDelete?.created_at) }}
                </span>
              </div>

              <div class="d-flex justify-space-between align-center">
                <span class="text-caption text-medium-emphasis">Monto Transferido:</span>
                <span class="text-caption font-weight-bold text-primary font-mono">
                  {{ formatCurrency(transferToDelete?.amount) }}
                </span>
              </div>
            </div>

            <div class="mt-4 d-flex align-center justify-center gap-1 text-error text-caption font-weight-medium text-center">
              <VIcon
                icon="ri-error-warning-line"
                size="16"
              />
              <span>Esta acción revertirá los fondos a sus cuentas de origen y destino originales.</span>
            </div>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
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
          class="rounded-lg px-6 font-weight-bold elevation-2"
          height="40"
          :loading="loader.loading"
          @click="confirmDeleteTransfer"
        >
          Confirmar Eliminación
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
