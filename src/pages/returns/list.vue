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
  <div class="pa-4 pa-sm-6">
    <VCard class="pa-6 pa-sm-8 rounded-lg elevation-4 max-w-1200 mx-auto">
      <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1">
            Devoluciones
          </h1>
          <p class="text-medium-emphasis mb-0">
            Historial de devoluciones de productos y servicios
          </p>
        </div>
        <div class="d-flex gap-3">
          <VBtn
            color="primary"
            prepend-icon="ri-add-line"
            to="/returns/add"
            size="large"
          >
            Nueva Devolución
          </VBtn>
        </div>
      </div>

      <VDivider class="mb-6" />

      <VForm @submit.prevent="() => { currentPage = 1; loadReturns() }">
        <VRow class="mb-2">
          <VCol
            cols="12"
            sm="8"
            md="6"
          >
            <VTextField
              v-model="searchForm.search"
              label="Buscar por documento de venta o devolución"
              placeholder="Número de devolución o venta..."
              prepend-inner-icon="ri-search-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
            />
          </VCol>

          <VCol
            cols="12"
            sm="4"
            md="6"
            class="d-flex justify-end gap-3 mt-2"
          >
            <VBtn
              variant="tonal"
              color="secondary"
              prepend-icon="ri-refresh-line"
              @click="clearSearch"
            >
              Limpiar
            </VBtn>
            <VBtn
              type="submit"
              color="primary"
              prepend-icon="ri-search-line"
              :loading="loading"
            >
              Buscar
            </VBtn>
          </VCol>
        </VRow>
      </VForm>

      <VDivider class="mb-4 mt-4" />

      <VTable class="text-no-wrap">
        <thead>
          <tr>
            <th class="font-weight-bold">
              Devolución
            </th>
            <th class="font-weight-bold">
              Venta Orig.
            </th>
            <th class="font-weight-bold">
              Fecha
            </th>
            <th class="font-weight-bold">
              Motivo
            </th>
            <th class="font-weight-bold text-right">
              Reembolso
            </th>
          </tr>
        </thead>
        <tbody v-if="loading">
          <tr>
            <td
              colspan="5"
              class="text-center pa-6"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="40"
              />
              <div class="mt-2 text-medium-emphasis">
                Cargando registros...
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else-if="!returns || returns.length === 0">
          <tr>
            <td
              colspan="5"
              class="text-center pa-8 text-medium-emphasis"
            >
              <VIcon
                size="48"
                class="mb-3"
                color="grey-lighten-1"
              >
                ri-loop-right-line
              </VIcon>
              <div class="text-h6">
                No se encontraron devoluciones
              </div>
            </td>
          </tr>
        </tbody>
        <tbody
          v-else
          style="text-transform: uppercase;"
        >
          <tr
            v-for="(item, index) in returns"
            :key="item?.id ? `return-${item.id}` : `return-idx-${index}`"
            class="align-middle"
          >
            <td>
              <div
                v-if="item"
                class="d-flex flex-column"
              >
                <span class="font-weight-medium">{{ item.return_number }}</span>
                <span class="text-caption text-medium-emphasis">{{ item.type === 'total' ? 'Total' : 'Parcial' }}</span>
              </div>
            </td>

            <td>
              <div
                v-if="item && item.sale"
                class="d-flex align-center"
              >
                <span>{{ item.sale.document_number }}</span>
              </div>
            </td>

            <td>
              <div
                v-if="item"
                class="d-flex align-center"
              >
                <VIcon
                  size="16"
                  class="mr-2 text-medium-emphasis"
                >
                  ri-calendar-todo-line
                </VIcon>
                <span>{{ formatDate(item.created_at) }}</span>
              </div>
            </td>

            <td>
              <span class="text-caption">{{ item.reason }}</span>
            </td>

            <td class="text-right">
              <div
                v-if="item"
                class="font-weight-bold text-body-1 text-error"
              >
                {{ formatCurrency(item.refund_amount) }}
              </div>
            </td>
          </tr>
        </tbody>
      </VTable>

      <VDivider class="mt-2" />
      <div class="d-flex justify-center pa-4">
        <div class="d-flex flex-column align-center gap-2">
          <div class="text-caption text-medium-emphasis">
            Mostrando página {{ currentPage }} de {{ totalPages }} ({{ totalItems }} registros en total)
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            :disabled="loading"
          />
        </div>
      </div>
    </VCard>
  </div>
</template>
