<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const router = useRouter()
const { showNotification } = useGlobalToast()

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
  const [year, month, day] = dateString.split('T')[0].split('-')

  return `${day}/${month}/${year}`
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
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-loop-right-line" color="primary" class="me-2" size="28" />
          Devoluciones
        </h1>
        <p class="text-medium-emphasis mb-0">
          Historial de devoluciones de productos y servicios
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn color="primary" prepend-icon="ri-add-line" to="/returns/add">
          Nueva Devolución
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12">
            <VTextField v-model="searchForm.search" label="Buscar devolución"
              placeholder="Número de devolución o venta..." prepend-inner-icon="ri-search-line" variant="outlined"
              density="comfortable" hide-details="auto" clearable color="primary" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Devoluciones -->
      <div class="position-relative">
        <VProgressLinear v-if="loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div class="overflow-x-auto">
          <VTable hover class="returns-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase" style="width: 135px;">
                  DEVOLUCIÓN
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">
                  VENTA ORIG.
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 120px;">
                  FECHA
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">
                  MOTIVO
                </th>
                <th class="text-right font-weight-bold text-uppercase" style="width: 120px;">
                  REEMBOLSO
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody v-if="loading">
              <tr>
                <td colspan="6" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">
                    Cargando registros...
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!returns || returns.length === 0">
              <tr>
                <td colspan="6" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">
                    ri-loop-right-line
                  </VIcon>
                  <div class="text-h6">
                    No se encontraron devoluciones
                  </div>
                  <div class="text-body-2">
                    Intenta ajustar los filtros de búsqueda
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else style="text-transform: uppercase;">
              <tr v-for="(item, index) in returns" :key="item?.id ? `return-${item.id}` : `return-idx-${index}`"
                class="returns-row align-middle">
                <td class="text-no-wrap text-left py-3">
                  <div v-if="item" class="d-flex flex-column align-start">
                    <span class="font-weight-bold text-subtitle-1 text-primary">{{ item.return_number }}</span>
                    <span class="text-body-2 text-medium-emphasis">{{ item.type === 'total' ? 'Total' : 'Parcial'
                    }}</span>
                  </div>
                </td>

                <td class="text-left py-3">
                  <div v-if="item && item.sale">
                    <span class="font-weight-semibold text-body-1 text-grey-darken-4">{{ item.sale.document_number
                    }}</span>
                  </div>
                  <span v-else class="text-medium-emphasis text-body-2">-</span>
                </td>

                <td class="text-no-wrap text-left py-3">
                  <div v-if="item" class="d-flex align-center">
                    <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                    <span class="text-body-2 text-medium-emphasis">{{ formatDate(item.created_at) }}</span>
                  </div>
                </td>

                <td class="text-left py-3" style="max-width: 300px;">
                  <div v-if="item" class="text-body-2 text-grey-darken-3 text-truncate" :title="item.reason">
                    {{ item.reason }}
                  </div>
                </td>

                <td class="text-no-wrap text-right py-3">
                  <div v-if="item" class="font-weight-bold text-subtitle-1 text-error">
                    {{ formatCurrency(item.refund_amount) }}
                  </div>
                </td>

                <td class="text-no-wrap text-center py-3">
                  <div v-if="item" class="d-flex justify-center align-center">
                    <!-- Ver Detalle (Acción rápida) -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver Detalle" @click="viewReturn(item)">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>

                    <!-- Eliminar Devolución (Acción rápida) -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="error" title="Eliminar Devolución" @click="deleteReturn(item)">
                      <VIcon icon="ri-delete-bin-line" size="20" />
                    </VBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ returns.length }}</span> de <span class="font-weight-bold">{{
              totalItems }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Dialog de Detalles de Devolución -->
    <VDialog v-model="isViewDialogVisible" max-width="700">
      <VCard>
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-loop-right-line" color="primary" />
            <span>Detalle de Devolución #{{ selectedReturn?.return_number }}</span>
          </div>
          <VBtn icon="ri-close-line" variant="text" @click="isViewDialogVisible = false" />
        </VCardTitle>
        <VDivider />
        
        <VCardText class="pa-4">
          <div v-if="viewLoading" class="text-center py-6">
            <VProgressCircular indeterminate color="primary" size="40" />
            <div class="mt-2 text-medium-emphasis">Cargando detalles...</div>
          </div>
          <div v-else-if="selectedReturn">
            <VRow class="mb-4">
              <VCol cols="12" sm="6">
                <div class="text-caption text-grey mb-1">Fecha de Registro</div>
                <div class="text-body-1 font-weight-medium d-flex align-center">
                  <VIcon icon="ri-calendar-line" size="16" class="me-1 text-grey" />
                  {{ formatDate(selectedReturn.created_at) }}
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="text-caption text-grey mb-1">Venta Asociada</div>
                <div class="text-body-1 font-weight-semibold text-primary">
                  {{ selectedReturn.sale?.document_number || 'N/A' }}
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="text-caption text-grey mb-1">Tipo de Devolución</div>
                <div>
                  <VChip :color="selectedReturn.type === 'total' ? 'primary' : 'warning'" size="small" label class="font-weight-bold">
                    {{ selectedReturn.type === 'total' ? 'Total' : 'Parcial' }}
                  </VChip>
                </div>
              </VCol>
              <VCol cols="12" sm="6">
                <div class="text-caption text-grey mb-1">Registrado por</div>
                <div class="text-body-1 font-weight-medium d-flex align-center">
                  <VIcon icon="ri-user-line" size="16" class="me-1 text-grey" />
                  {{ selectedReturn.user?.name || 'N/A' }}
                </div>
              </VCol>
              <VCol cols="12">
                <div class="text-caption text-grey mb-1">Motivo de la Devolución</div>
                <div class="text-body-1 font-weight-medium bg-grey-lighten-4 pa-3 rounded-lg text-uppercase" style="border: 1px dashed #cbd5e1;">
                  {{ selectedReturn.reason }}
                </div>
              </VCol>
            </VRow>

            <VDivider class="my-4" />

            <div class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center gap-2">
              <VIcon icon="ri-list-check" color="primary" />
              <span>Productos Devueltos</span>
            </div>
            
            <VTable v-if="selectedReturn.details && selectedReturn.details.length > 0" class="border rounded-lg overflow-hidden">
              <thead>
                <tr>
                  <th class="text-uppercase text-caption font-weight-bold">Descripción</th>
                  <th class="text-center text-uppercase text-caption font-weight-bold" style="width: 100px;">Cant.</th>
                  <th class="text-right text-uppercase text-caption font-weight-bold" style="width: 120px;">Precio Unit.</th>
                  <th class="text-right text-uppercase text-caption font-weight-bold" style="width: 120px;">Total</th>
                </tr>
              </thead>
              <tbody style="text-transform: uppercase;">
                <tr v-for="item in selectedReturn.details" :key="item.id">
                  <td>{{ item.description }}</td>
                  <td class="text-center font-weight-semibold">{{ item.quantity }}</td>
                  <td class="text-right">{{ formatCurrency(item.price) }}</td>
                  <td class="text-right font-weight-bold">{{ formatCurrency(item.total) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" class="text-right font-weight-bold text-subtitle-1">Monto de Reembolso:</td>
                  <td class="text-right font-weight-bold text-subtitle-1 text-error">{{ formatCurrency(selectedReturn.refund_amount) }}</td>
                </tr>
              </tfoot>
            </VTable>
            <p v-else class="text-body-2 text-grey text-center py-4">No hay ítems registrados en esta devolución.</p>
          </div>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="secondary" variant="text" @click="isViewDialogVisible = false">Cerrar</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Dialog de Confirmación de Eliminación -->
    <VDialog v-model="showDeleteDialog" max-width="500">
      <VCard>
        <VCardTitle class="text-h5 pa-4">
          Confirmar Eliminación
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <p class="text-body-1">
            ¿Estás seguro de eliminar la devolución <strong>#{{ returnToDelete?.return_number }}</strong>?
          </p>
          <p class="text-body-2 text-error font-weight-medium mt-2">
            Esta acción no se puede deshacer y revertirá los cambios de stock en el inventario.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="secondary" variant="text" @click="showDeleteDialog = false" :disabled="deleteLoading">
            Cancelar
          </VBtn>
          <VBtn color="error" :loading="deleteLoading" @click="confirmDeleteReturn">
            Eliminar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de devoluciones */
.returns-table :deep(thead) {
  background-color: #f8fafc !important;
}

.returns-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.returns-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.returns-row:hover {
  background-color: #f8fafc !important;
}

.action-btn {
  transition: all 0.2s ease;
  border-radius: 6px !important;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}
</style>
