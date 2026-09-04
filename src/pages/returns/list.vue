<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const loading = ref(false)
const returns = ref([])

const selectedReturn = ref(null)
const isViewDialogVisible = ref(false)
const viewLoading = ref(false)

const showDeleteDialog = ref(false)
const returnToDelete = ref(null)
const deleteLoading = ref(false)

const searchForm = ref({
  search: null,
})

const currentPage = ref(1)
const itemsPerPage = ref(15)
const totalItems = ref(0)
const totalPages = ref(0)

const loadReturns = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      ...searchForm.value,
    }

    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === '') {
        delete params[key]
      }
    })

    const response = await $api('returns', { params })

    const extractArray = (res, key) => {
      if (Array.isArray(res)) return res
      if (res?.[key] && Array.isArray(res[key])) return res[key]
      if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
      if (res?.data && Array.isArray(res.data)) return res.data
      if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data

      return []
    }

    returns.value = extractArray(response, 'returns')

    const paginator = response?.data?.data ? response.data : (response?.data || response?.returns || response || {})

    totalItems.value = paginator.total || returns.value.length || 0
    totalPages.value = paginator.last_page || 1
  } catch (error) {
    console.error('Error al cargar devoluciones:', error)
    showNotification('Error al cargar el historial de devoluciones', 'error')
  } finally {
    loading.value = false
  }
}

const viewReturn = async returnItem => {
  viewLoading.value = true
  selectedReturn.value = null
  isViewDialogVisible.value = true
  try {
    const response = await $api(`returns/${returnItem.id}`)
    if (response?.success || response?.data) {
      selectedReturn.value = response.data || response
    } else {
      showNotification('Error al cargar los detalles de la devolución', 'error')
      isViewDialogVisible.value = false
    }
  } catch (error) {
    console.error('Error al cargar devolución:', error)
    showNotification('Error al cargar los detalles de la devolución', 'error')
    isViewDialogVisible.value = false
  } finally {
    viewLoading.value = false
  }
}

const deleteReturn = returnItem => {
  returnToDelete.value = returnItem
  showDeleteDialog.value = true
}

const confirmDeleteReturn = async () => {
  if (!returnToDelete.value) return
  deleteLoading.value = true
  try {
    const response = await $api(`returns/${returnToDelete.value.id}`, {
      method: 'DELETE',
    })

    if (response?.success || response?.message) {
      showNotification('Devolución eliminada exitosamente', 'success')
      showDeleteDialog.value = false
      returnToDelete.value = null
      loadReturns()
    } else {
      showNotification('Error al eliminar la devolución', 'error')
    }
  } catch (error) {
    console.error('Error al eliminar devolución:', error)
    showNotification('Error al eliminar la devolución', 'error')
  } finally {
    deleteLoading.value = false
  }
}

const clearSearch = () => {
  searchForm.value = {
    search: null,
  }
  currentPage.value = 1
  loadReturns()
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const formatDate = dateString => {
  if (!dateString) return '-'
  try {
    const cleanDate = String(dateString).split('T')[0].split(' ')[0]
    const parts = cleanDate.split('-')
    if (parts.length === 3) {
      const [year, month, day] = parts
      return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`
    }

    const d = new Date(dateString)
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return `${year}/${month}/${day}`
    }
  } catch (e) {
    console.error('Error formatting date:', e)
  }
  return dateString
}

// Métricas computadas y filtros
const totalRefundedInPage = computed(() => {
  return returns.value.reduce((acc, r) => acc + (parseFloat(r.refund_amount) || 0), 0)
})

const totalReturnsTypeCount = computed(() => {
  return returns.value.filter(r => r.type === 'total').length
})

const hasActiveFilters = computed(() => {
  return !!(searchForm.value.search && searchForm.value.search.trim())
})

const resetFilters = () => {
  clearSearch()
}

watch(currentPage, () => {
  loadReturns()
})

// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch(() => searchForm.value.search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadReturns()
  }, 500)
})

onMounted(() => {
  loadReturns()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 returns-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="error" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-arrow-go-back-line" size="26" />
          </VAvatar>
          Devoluciones y Reembolsos
        </h1>
        <p class="text-medium-emphasis mb-0">
          Control de notas de crédito, reintegro de productos y devolución de importes
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          to="/returns/add"
          class="elevation-2 font-weight-bold"
        >
          Nueva Devolución
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-file-list-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Devoluciones</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ totalItems }} <span class="text-caption text-disabled font-weight-regular">en historial</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="error" variant="tonal" rounded="lg">
            <VIcon icon="ri-money-dollar-circle-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Reembolsado (Pág.)</div>
            <div class="text-h6 font-weight-bold text-error font-mono">
              ${{ totalRefundedInPage.toFixed(2) }}
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-restart-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Devoluciones Totales</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ totalReturnsTypeCount }} <span class="text-caption text-disabled font-weight-regular">anulación total</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon icon="ri-filter-3-line" size="18" color="primary" />
            <span>Filtros de Devoluciones</span>
          </div>

          <VBtn
            v-if="hasActiveFilters"
            variant="text"
            color="error"
            size="small"
            prepend-icon="ri-filter-off-line"
            class="font-weight-semibold"
            @click="resetFilters"
          >
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow dense class="gap-y-3">
          <VCol cols="12">
            <VTextField
              v-model="searchForm.search"
              label="Buscar devolución"
              placeholder="Número de devolución, venta original o motivo..."
              prepend-inner-icon="ri-search-2-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              :loading="loading"
              @click:clear="clearSearch"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ESTADO DE CARGA -->
    <VCard v-if="loading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-60 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-75" /></td>
            <td class="py-4" style="width: 120px;"><div class="shimmer-line w-60" /></td>
            <td class="py-4"><div class="shimmer-line w-80" /></td>
            <td class="py-4" style="width: 120px;"><div class="shimmer-line w-60 ms-auto" /></td>
            <td class="py-4" style="width: 100px;"><div class="shimmer-chip mx-auto" /></td>
            <td class="py-4 text-center" style="width: 100px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!returns || returns.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-arrow-go-back-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron devoluciones
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los criterios de búsqueda o emite una nueva devolución para reintegrar productos.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" to="/returns/add">
          Nueva Devolución
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA MODERNA DE DEVOLUCIONES -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="returns-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 150px; min-width: 140px; white-space: nowrap;">
                Devolución
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 150px; min-width: 140px; white-space: nowrap;">
                Venta Orig.
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 145px; min-width: 140px; white-space: nowrap;">
                Fecha
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 260px;">
                Motivo / Causa
              </th>
              <th class="text-right font-weight-bold text-uppercase py-3" style="width: 110px; min-width: 100px; white-space: nowrap;">
                Reembolso
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px; min-width: 120px; white-space: nowrap;">
                Tipo
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px; min-width: 120px; white-space: nowrap;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in returns" :key="item?.id || index" class="return-table-row">
              <!-- N° Devolución -->
              <td class="py-3" style="white-space: nowrap;">
                <div
                  class="font-mono font-weight-bold text-primary cursor-pointer hover-underline text-body-1"
                  @click="viewReturn(item)"
                >
                  {{ item.return_number }}
                </div>
              </td>

              <!-- Venta Origen -->
              <td class="py-3" style="white-space: nowrap;">
                <span
                  v-if="item.sale?.document_number"
                  class="font-mono font-weight-semibold text-high-emphasis text-body-2"
                >
                  {{ item.sale.document_number }}
                </span>
                <span v-else class="text-disabled">—</span>
              </td>

              <!-- Fecha -->
              <td class="py-3" style="white-space: nowrap;">
                <div class="d-flex align-center text-body-2 text-medium-emphasis text-no-wrap" style="white-space: nowrap;">
                  <VIcon
                    icon="ri-calendar-line"
                    size="16"
                    color="medium-emphasis"
                    class="me-1 flex-shrink-0"
                  />
                  <span class="text-no-wrap font-weight-medium" style="white-space: nowrap;">{{ formatDate(item.created_at || item.date) }}</span>
                </div>
              </td>

              <!-- Motivo -->
              <td class="py-3">
                <div class="text-body-2 text-high-emphasis text-truncate" style="max-width: 280px;" :title="item.reason">
                  {{ item.reason || 'Sin motivo especificado' }}
                </div>
              </td>

              <!-- Reembolso -->
              <td class="text-right py-3" style="white-space: nowrap;">
                <span class="font-mono font-weight-bold text-body-1 text-high-emphasis">
                  {{ formatCurrency(item.refund_amount) }}
                </span>
              </td>

              <!-- Tipo -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <VChip
                  :color="item.type === 'total' ? 'error' : 'warning'"
                  variant="tonal"
                  size="small"
                  class="font-weight-semibold text-uppercase"
                >
                  {{ item.type === 'total' ? 'Total' : 'Parcial' }}
                </VChip>
              </td>

              <!-- Acciones -->
              <td class="text-center py-3">
                <div class="d-flex justify-center align-center gap-1">
                  <!-- Ver detalle -->
                  <VBtn
                    size="small"
                    color="info"
                    variant="tonal"
                    icon="ri-eye-line"
                    title="Ver Detalle"
                    @click="viewReturn(item)"
                  />

                  <!-- Eliminar -->
                  <VBtn
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Devolución"
                    @click="deleteReturn(item)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ returns.length }}</strong> de <strong class="text-high-emphasis">{{ totalItems }}</strong> devoluciones
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            color="primary"
          />
        </div>
      </VCard>
    </div>

    <!-- Dialog de Detalles de Devolución -->
    <VDialog
      v-model="isViewDialogVisible"
      scrollable
      max-width="700"
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isViewDialogVisible = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-loop-right-line" />
          </div>
          <h3 class="custom-dialog-title">
            Detalle de Devolución #{{ selectedReturn?.return_number }}
          </h3>
          <p class="custom-dialog-subtitle">
            Información de la devolución e ítems reintegrados al inventario
          </p>
        </div>
        
        <VCardText class="pa-4">
          <div
            v-if="viewLoading"
            class="text-center py-6"
          >
            <VProgressCircular
              indeterminate
              color="primary"
              size="40"
            />
            <div class="mt-2 text-medium-emphasis">
              Cargando detalles...
            </div>
          </div>
          <div v-else-if="selectedReturn">
            <VRow class="mb-4">
              <VCol
                cols="12"
                sm="6"
              >
                <div class="text-caption text-grey mb-1">
                  Fecha de Registro
                </div>
                <div class="text-body-1 font-weight-medium d-flex align-center">
                  <VIcon
                    icon="ri-calendar-line"
                    size="16"
                    class="me-1 text-grey"
                  />
                  {{ formatDate(selectedReturn.created_at) }}
                </div>
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <div class="text-caption text-grey mb-1">
                  Venta Asociada
                </div>
                <div class="text-body-1 font-weight-semibold text-primary">
                  {{ selectedReturn.sale?.document_number || 'N/A' }}
                </div>
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <div class="text-caption text-grey mb-1">
                  Tipo de Devolución
                </div>
                <div>
                  <VChip
                    :color="selectedReturn.type === 'total' ? 'primary' : 'warning'"
                    size="small"
                    label
                    class="font-weight-bold"
                  >
                    {{ selectedReturn.type === 'total' ? 'Total' : 'Parcial' }}
                  </VChip>
                </div>
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <div class="text-caption text-grey mb-1">
                  Registrado por
                </div>
                <div class="text-body-1 font-weight-medium d-flex align-center">
                  <VIcon
                    icon="ri-user-line"
                    size="16"
                    class="me-1 text-grey"
                  />
                  {{ selectedReturn.user?.name || 'N/A' }}
                </div>
              </VCol>
              <VCol cols="12">
                <div class="text-caption text-grey mb-1">
                  Motivo de la Devolución
                </div>
                <div
                  class="text-body-1 font-weight-medium bg-grey-lighten-4 pa-3 rounded-lg text-uppercase"
                  style="border: 1px dashed #cbd5e1;"
                >
                  {{ selectedReturn.reason }}
                </div>
              </VCol>
            </VRow>

            <VDivider class="my-4" />

            <div class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center gap-2">
              <VIcon
                icon="ri-list-check"
                color="primary"
              />
              <span>Productos Devueltos</span>
            </div>
            
            <div
              v-if="selectedReturn.details && selectedReturn.details.length > 0"
              class="return-items-table-wrap"
            >
              <VTable class="return-items-table">
                <thead>
                  <tr>
                    <th class="text-uppercase text-caption font-weight-bold">
                      Descripción
                    </th>
                    <th
                      class="text-center text-uppercase text-caption font-weight-bold"
                      style="width: 100px;"
                    >
                      Cant.
                    </th>
                    <th
                      class="text-right text-uppercase text-caption font-weight-bold"
                      style="width: 120px;"
                    >
                      Precio Unit.
                    </th>
                    <th
                      class="text-right text-uppercase text-caption font-weight-bold"
                      style="width: 120px;"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody style="text-transform: uppercase;">
                  <tr
                    v-for="item in selectedReturn.details"
                    :key="item.id"
                  >
                    <td>{{ item.description }}</td>
                    <td class="text-center font-weight-semibold">
                      {{ item.quantity }}
                    </td>
                    <td class="text-right">
                      {{ formatCurrency(item.price) }}
                    </td>
                    <td class="text-right font-weight-bold">
                      {{ formatCurrency(item.total) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colspan="3"
                      class="text-right font-weight-bold text-subtitle-1"
                    >
                      Monto de Reembolso:
                    </td>
                    <td class="text-right font-weight-bold text-subtitle-1 text-error">
                      {{ formatCurrency(selectedReturn.refund_amount) }}
                    </td>
                  </tr>
                </tfoot>
              </VTable>
            </div>
            <p
              v-else
              class="text-body-2 text-grey text-center py-4"
            >
              No hay ítems registrados en esta devolución.
            </p>
          </div>
        </VCardText>
        <VDivider />
        <VCardActions
          class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            color="secondary"
            variant="outlined"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="isViewDialogVisible = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Dialog de Confirmación de Eliminación -->
    <VDialog
      v-model="showDeleteDialog"
      scrollable
      max-width="500"
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            :disabled="deleteLoading"
            @click="showDeleteDialog = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-delete-bin-line" />
          </div>
          <h3 class="custom-dialog-title">
            Confirmar Eliminación
          </h3>
          <p class="custom-dialog-subtitle">
            Esta acción revertirá los cambios de stock en el inventario
          </p>
        </div>
        <VCardText class="pa-4">
          <p class="text-body-1">
            ¿Estás seguro de eliminar la devolución <strong>#{{ returnToDelete?.return_number }}</strong>?
          </p>
          <p class="text-body-2 text-error font-weight-medium mt-2 mb-0">
            Esta acción no se puede deshacer y revertirá los cambios de stock en el inventario.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions
          class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            color="secondary"
            variant="outlined"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            :disabled="deleteLoading"
            @click="showDeleteDialog = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            prepend-icon="ri-delete-bin-line"
            class="rounded-lg px-6 font-weight-bold"
            height="40"
            :loading="deleteLoading"
            @click="confirmDeleteReturn"
          >
            Eliminar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped lang="scss">
.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.return-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.hover-underline:hover {
  text-decoration: underline;
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
