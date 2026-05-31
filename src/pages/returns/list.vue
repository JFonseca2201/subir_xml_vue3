<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const router = useRouter()
const { showNotification } = useGlobalToast()

const loading = ref(false)
const returns = ref([])

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
        <VForm @submit.prevent="() => { currentPage = 1; loadReturns() }">
          <VRow class="align-center">
            <VCol cols="12" md="6">
              <VTextField v-model="searchForm.search" label="Buscar devolución"
                placeholder="Número de devolución o venta..." prepend-inner-icon="ri-search-line" variant="outlined"
                density="comfortable" hide-details="auto" clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="3">
              <VBtn color="secondary" variant="tonal" prepend-icon="ri-refresh-line" @click="clearSearch" block>
                Limpiar
              </VBtn>
            </VCol>

            <VCol cols="12" sm="6" md="3">
              <VBtn color="primary" variant="tonal" prepend-icon="ri-search-line" :loading="loading"
                @click="loadReturns" block>
                Buscar
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
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
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver Detalle">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>

                    <!-- Más Acciones (Dropdown) -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="secondary" title="Acciones">
                      <VIcon icon="ri-more-2-line" size="20" />
                      <VMenu activator="parent" transition="slide-y-transition" align="end" location="bottom end">
                        <VList density="compact" class="py-1">
                          <VListItem prepend-icon="ri-file-pdf-line" title="Descargar PDF"
                            class="text-primary text-body-2" />
                          <VDivider class="my-1" />
                          <VListItem prepend-icon="ri-delete-bin-line" title="Eliminar Devolución"
                            class="text-error text-body-2" />
                        </VList>
                      </VMenu>
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
