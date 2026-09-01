<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import AporteCreateDialog from '@/components/inventory/aportes/AporteCreateDialog.vue'
import AporteEditDialog from '@/components/inventory/aportes/AporteEditDialog.vue'
import OperationsHeaderNav from '@/components/operations/OperationsHeaderNav.vue'
import MovementReceiptNoteDialog from '@/components/inventory/finances-records/MovementReceiptNoteDialog.vue'
import AttachReceiptsDialog from '@/components/common/AttachReceiptsDialog.vue'

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
const canAccessAportes = computed(() => {
  const user = currentUser.value
  const roleId = user?.role?.id
  
  return user && roleId === 1
})

// Estado del componente
const aportes = ref([])

const resumen = ref({
  total_hoy: 0,
  total_mes: 0,
  total_general: 0,
})

const loading = ref(false)
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const editingAporte = ref(null)

// Estado para el diálogo de eliminación
const showDeleteDialog = ref(false)
const aporteToDelete = ref(null)

// Búsqueda y filtros
const searchQuery = ref('')
const selectedFilter = ref('all') // 'all', 'today', 'month'

// Limpiar nombre de cuenta
const cleanAccountName = name => {
  if (!name) return 'N/A'
  
  return name
    .replace(/\(EFECTIVO\)/gi, '')
    .replace(/\(TRANSFERENCIA\)/gi, '')
    .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
    .trim()
}

// Cargar Aportes
const loadAportes = async () => {
  loading.value = true

  try {
    const response = await $api('aportes')

    if (response.data) {
      aportes.value = response.data
      resumen.value = response.resumen || {
        total_hoy: 0,
        total_mes: 0,
        total_general: 0,
      }
    }

    showNotification('Aportes cargados correctamente', 'success')
  } catch (error) {
    console.error('Error al cargar aportes:', error)
    showNotification('Error al cargar aportes', 'error')
  } finally {
    loading.value = false
  }
}

const isNoteDialogVisible = ref(false)
const selectedAporteForNote = ref(null)
const isReceiptsDialogVisible = ref(false)
const selectedAporteForReceipts = ref(null)

const openCreateDialog = () => {
  showCreateDialog.value = true
}

const openEditDialog = aporte => {
  editingAporte.value = aporte
  showEditDialog.value = true
}

const openAporteNoteDialog = aporte => {
  selectedAporteForNote.value = {
    ...aporte,
    id: aporte.id,
    type: 'income',
    amount: aporte.monto,
    entry_date: aporte.fecha_aporte,
    description: `Aporte de Capital: ${aporte.partner_nombre}${aporte.descripcion ? ' — ' + aporte.descripcion : ''}`,
    payment_method: aporte.metodo_pago,
    account: { name: aporte.cuenta },
    invoice_number: `APORTE-${String(aporte.id).padStart(5, '0')}`,
    metadata: {
      document_number: `APORTE-${String(aporte.id).padStart(5, '0')}`,
      partner_name: aporte.partner_nombre,
      user_name: aporte.user_nombre,
      metodo: aporte.metodo_pago,
    },
    resolved_attachments: aporte.attachments || [],
  }
  isNoteDialogVisible.value = true
}

const openAttachDialog = aporte => {
  selectedAporteForReceipts.value = aporte
  isReceiptsDialogVisible.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
}

const closeEditDialog = () => {
  showEditDialog.value = false
  editingAporte.value = null
}

const onAporteCreated = () => {
  loadAportes()
  closeCreateDialog()
}

const onAporteUpdated = () => {
  loadAportes()
  closeEditDialog()
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const openDeleteDialog = aporte => {
  aporteToDelete.value = aporte
  showDeleteDialog.value = true
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  aporteToDelete.value = null
}

const confirmDeleteAporte = async () => {
  if (!aporteToDelete.value) return

  loader.start()

  try {
    await $api(`aportes/${aporteToDelete.value.id}`, {
      method: 'DELETE',
    })

    showNotification('Aporte eliminado exitosamente', 'success')
    loadAportes()
    closeDeleteDialog()
  } catch (error) {
    console.error('Error al eliminar aporte:', error)
    showNotification('Error al eliminar aporte', 'error')
  } finally {
    loader.stop()
  }
}

const deleteAporte = aporte => {
  openDeleteDialog(aporte)
}

// Aportes filtrados
const filteredAportes = computed(() => {
  if (!aportes.value || !aportes.value.length) return []

  const query = searchQuery.value.trim().toLowerCase()
  const todayObj = new Date()
  const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
  const currentMonth = today.substring(0, 7)

  return aportes.value
    .map(dia => {
      const items = dia.aportes || []

      const matchingItems = items.filter(a => {
        const aDate = (a.fecha || dia.fecha || '').split('T')[0]

        if (selectedFilter.value === 'today' && aDate !== today) return false
        if (selectedFilter.value === 'month' && aDate.substring(0, 7) !== currentMonth) return false

        if (!query) return true

        const partner = (a.partner_nombre || '').toLowerCase()
        const desc = (a.descripcion || '').toLowerCase()
        const cuenta = (cleanAccountName(a.cuenta) || '').toLowerCase()
        const user = (a.user_nombre || '').toLowerCase()
        const montoStr = String(a.monto || '')

        return (
          partner.includes(query) ||
          desc.includes(query) ||
          cuenta.includes(query) ||
          user.includes(query) ||
          montoStr.includes(query)
        )
      })

      return {
        ...dia,
        aportes: matchingItems,
      }
    })
    .filter(dia => dia.aportes.length > 0)
})

const totalAportesCount = computed(() => {
  return filteredAportes.value.reduce((acc, d) => acc + (d.aportes ? d.aportes.length : 0), 0)
})

// Montar componente
onMounted(() => {
  if (canAccessAportes.value) {
    loadAportes()
  }
})
</script>

<template>
  <!-- Estado sin permisos -->
  <div
    v-if="!canAccessAportes"
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
        No tienes permisos suficientes para acceder a la gestión de
        aportes.
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
    class="pa-4 pa-sm-6 aportes-page"
  >
    <!-- Encabezado de Navegación de Operaciones -->
    <OperationsHeaderNav active-tab="socios" />

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
              icon="ri-group-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Aportes de Capital
              </h1>
              <VChip
                size="small"
                color="primary"
                variant="tonal"
                class="font-weight-bold"
              >
                {{ totalAportesCount }} {{ totalAportesCount === 1 ? 'registro' : 'registros' }}
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Gestión de aportes de socios y control de capital acumulado
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
            @click="loadAportes"
          />
          <VBtn
            color="primary"
            variant="elevated"
            size="small"
            prepend-icon="ri-add-circle-line"
            class="font-weight-semibold elevation-2"
            @click="openCreateDialog"
          >
            Nuevo Aporte
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Tarjetas de Resumen KPI con colores tonales -->
    <VRow class="mb-5">
      <!-- Aportes Hoy -->
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
                Aportes Hoy
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(resumen.total_hoy) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Total acumulado jornada de hoy
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

      <!-- Aportes del Mes -->
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
                Aportes del Mes
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(resumen.total_mes) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Total acumulado mes en curso
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

      <!-- Total General -->
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
                Total General
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(resumen.total_general) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma histórica total de aportes
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
                icon="ri-money-dollar-box-line"
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
            placeholder="Buscar por socio, descripción o cuenta..."
            hide-details
            clearable
            variant="outlined"
            density="compact"
            :loading="loading"
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
      v-if="!loading && !aportes.length"
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
        No hay aportes registrados
      </h3>
      <p class="text-body-2 text-medium-emphasis max-w-md mx-auto mt-1 mb-6">
        Comienza registrando tu primer aporte de capital.
      </p>
      <VBtn
        color="primary"
        variant="elevated"
        prepend-icon="ri-add-line"
        class="font-weight-semibold"
        @click="openCreateDialog"
      >
        Registrar Primer Aporte
      </VBtn>
    </VCard>

    <!-- Lista Unificada de Aportes por Fecha (Se muestra si está cargando o si ya hay registros) -->
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
              class="text-left py-4"
              style="min-width: 260px;"
            >
              SOCIO
            </th>
            <th class="text-left py-4" style="min-width: 260px;">
              DESCRIPCIÓN
            </th>
            <th class="text-left py-4" style="min-width: 200px;">
              CUENTA DE INGRESO
            </th>
            <th class="text-left py-4" style="min-width: 180px;">
              REGISTRADO POR
            </th>
            <th
              class="text-right py-4"
              style="width: 160px;"
            >
              MONTO
            </th>
            <th
              class="text-center py-4"
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
              <div class="shimmer-line w-60" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-75" />
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

        <!-- Sin resultados filtrados -->
        <tbody v-else-if="!filteredAportes.length">
          <tr>
            <td
              colspan="6"
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
                Prueba cambiando el término de búsqueda o limpia el
                filtro aplicado.
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Datos reales -->
        <tbody v-else>
          <template
            v-for="dia in filteredAportes"
            :key="dia.fecha"
          >
            <!-- Fila de Encabezado por Fecha -->
            <tr class="transfer-date-header-row">
              <td colspan="6">
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
                        {{ dia.label }}
                      </span>
                      <VChip
                        size="x-small"
                        color="primary"
                        variant="tonal"
                        class="font-weight-bold"
                      >
                        {{ dia.aportes.length }} {{ dia.aportes.length === 1 ? 'aporte' : 'aportes' }}
                      </VChip>
                    </div>
                  </div>

                  <div class="d-flex align-center gap-2 me-2">
                    <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold">Total del Día:</span>
                    <VChip
                      color="success"
                      variant="tonal"
                      size="small"
                      class="font-weight-black px-3 text-subtitle-2"
                    >
                      {{ formatCurrency(dia.total_dia || dia.aportes.reduce((acc, a) => acc + parseFloat(a.monto || 0), 0)) }}
                    </VChip>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Filas de Aportes -->
            <tr
              v-for="aporte in dia.aportes"
              :key="aporte.id"
              class="transfer-row"
            >
              <!-- Socio -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="36"
                    color="success"
                    variant="tonal"
                    class="rounded-circle shrink-0 font-weight-bold"
                  >
                    <VIcon
                      size="20"
                      icon="ri-user-star-line"
                      color="success"
                    />
                  </VAvatar>
                  <div class="d-flex flex-column text-left">
                    <span class="text-body-2 font-weight-bold text-slate-900">
                      {{ aporte.partner_nombre }}
                    </span>
                    <span class="text-caption text-medium-emphasis">
                      Socio Inversionista
                    </span>
                  </div>
                </div>
              </td>

              <!-- Descripción -->
              <td class="py-3">
                <div
                  class="text-body-2 font-weight-medium text-slate-800 text-wrap"
                  style="max-width: 280px; line-height: 1.35;"
                >
                  {{ aporte.descripcion || 'Aporte de Capital' }}
                </div>
              </td>

              <!-- Cuenta & Método -->
              <td class="py-3">
                <div class="d-flex align-center gap-2">
                  <VAvatar
                    size="30"
                    :color="aporte.metodo_pago === 'EFECTIVO' ? 'success' : 'primary'"
                    variant="tonal"
                    class="rounded-lg shrink-0"
                  >
                    <VIcon
                      :icon="aporte.metodo_pago === 'EFECTIVO' ? 'ri-money-dollar-circle-line' : 'ri-bank-line'"
                      size="16"
                    />
                  </VAvatar>
                  <div class="d-flex flex-column">
                    <span class="text-body-2 font-weight-bold text-slate-900">
                      {{ cleanAccountName(aporte.cuenta) }}
                    </span>
                    <span class="text-caption text-medium-emphasis text-capitalize">
                      {{ (aporte.metodo_pago || '').toLowerCase() }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Registrado por -->
              <td class="py-3">
                <div class="d-flex align-center gap-2">
                  <VAvatar
                    size="28"
                    color="secondary"
                    variant="tonal"
                    class="rounded-circle shrink-0"
                  >
                    <VIcon
                      icon="ri-user-settings-line"
                      size="15"
                    />
                  </VAvatar>
                  <div class="d-flex flex-column">
                    <span class="text-body-2 font-weight-medium text-slate-800">
                      {{ aporte.user_nombre || 'Super-Admin' }}
                    </span>
                    <span class="text-caption text-medium-emphasis d-flex align-center gap-1">
                      <VIcon icon="ri-time-line" size="12" />
                      {{ aporte.hora || '' }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Monto -->
              <td class="py-3 text-right">
                <span class="text-subtitle-1 font-weight-black text-success">
                  +{{ formatCurrency(aporte.monto) }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="py-3 text-center">
                <div class="d-flex align-center justify-center gap-1">
                  <!-- Botón Principal: Ver Nota y Comprobantes -->
                  <VBtn
                    icon="ri-eye-line"
                    variant="tonal"
                    color="primary"
                    size="small"
                    class="action-btn"
                    title="Ver Nota y Comprobantes"
                    @click="openAporteNoteDialog(aporte)"
                  />

                  <!-- Menú Pro de Acciones Secundarias -->
                  <VMenu
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
                      min-width="200"
                    >
                      <VListItem @click="openAttachDialog(aporte)">
                        <template #prepend>
                          <VIcon
                            icon="ri-attachment-2"
                            color="secondary"
                            size="18"
                            class="me-2"
                          />
                        </template>
                        <VListItemTitle class="font-weight-medium text-body-2">
                          Adjuntar Comprobante
                        </VListItemTitle>
                      </VListItem>

                      <VListItem @click="openEditDialog(aporte)">
                        <template #prepend>
                          <VIcon
                            icon="ri-pencil-line"
                            color="warning"
                            size="18"
                            class="me-2"
                          />
                        </template>
                        <VListItemTitle class="font-weight-medium text-body-2">
                          Editar Aporte
                        </VListItemTitle>
                      </VListItem>

                      <VDivider class="my-1" />

                      <VListItem
                        class="text-error"
                        @click="deleteAporte(aporte)"
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
                          Eliminar Aporte
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
  </div>

  <!-- Diálogo de Crear Aportes -->
  <AporteCreateDialog
    v-model="showCreateDialog"
    @created="onAporteCreated"
  />

  <!-- Diálogo de Editar Aportes -->
  <AporteEditDialog
    v-model="showEditDialog"
    :aporte="editingAporte"
    @updated="onAporteUpdated"
  />

  <!-- Diálogo de Nota de Aporte y Comprobantes (VDialog) -->
  <MovementReceiptNoteDialog
    v-if="selectedAporteForNote"
    v-model="isNoteDialogVisible"
    :movement="selectedAporteForNote"
    @updated="loadAportes"
  />

  <!-- Diálogo de Gestión de Comprobantes Adjuntos (VDialog) -->
  <AttachReceiptsDialog
    v-if="selectedAporteForReceipts"
    :is-dialog-visible="isReceiptsDialogVisible"
    attachable-type="partner_capital"
    :attachable-id="selectedAporteForReceipts.id"
    :title="`Comprobantes de Aporte — ${selectedAporteForReceipts.partner_nombre}`"
    :identifier="`APORTE-${String(selectedAporteForReceipts.id).padStart(5, '0')}`"
    :party-name="selectedAporteForReceipts.partner_nombre"
    @update:is-dialog-visible="val => { isReceiptsDialogVisible = val; if (!val) selectedAporteForReceipts = null; }"
    @updated="loadAportes"
  />

  <!-- Diálogo Confirmar Eliminación (VDialog) -->
  <VDialog
    v-model="showDeleteDialog"
    scrollable
    max-width="440"
  >
    <VCard class="custom-dialog-card rounded-xl">
      <!-- Header Banner Danger -->
      <div class="custom-dialog-header-danger bg-error text-white pa-4">
        <div class="d-flex align-center justify-space-between mb-1">
          <div class="d-flex align-center gap-2">
            <VAvatar
              color="white"
              variant="tonal"
              size="32"
            >
              <VIcon
                color="white"
                icon="ri-delete-bin-line"
                size="18"
              />
            </VAvatar>
            <h3 class="custom-dialog-title text-white font-weight-bold">
              Eliminar Aporte
            </h3>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            color="white"
            @click="closeDeleteDialog"
          />
        </div>
        <p class="custom-dialog-subtitle">
          Esta acción revertirá el saldo y no se puede deshacer
        </p>
      </div>

      <VCardText
        v-if="aporteToDelete"
        class="pa-4"
      >
        <div class="text-body-1 text-high-emphasis mb-3">
          ¿Estás seguro de eliminar el aporte de <strong>{{ aporteToDelete.partner_nombre }}</strong> por
          <strong class="text-error font-weight-bold">{{ formatCurrency(aporteToDelete.monto) }}</strong>?
        </div>

        <div class="text-caption text-medium-emphasis bg-error-tonal pa-3 rounded-lg border-error">
          <VIcon
            icon="ri-alert-line"
            size="16"
            color="error"
            class="me-1"
          />
          Esta acción revertirá los fondos de la cuenta asociada y no se puede deshacer.
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
          @click="confirmDeleteAporte"
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
