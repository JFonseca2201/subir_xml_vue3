<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

// Estado reactivo
const isLoading = ref(false)
const search = ref('')
const selectedRange = ref('anio_actual')
const startDate = ref('')
const endDate = ref('')

// Datos
const kardexData = ref({
  items: [],
  itemsGrouped: {},
  filtrosAplicados: {},
})

// Rango rápido de fechas
const rangeOptions = [
  { title: 'Año Actual', value: 'anio_actual' },
  { title: 'Mes Actual', value: 'mes_actual' },
  { title: 'Mes Anterior', value: 'mes_anterior' },
  { title: 'Últimos 3 Meses', value: 'ultimos_3_meses' },
  { title: 'Últimos 6 Meses', value: 'ultimos_6_meses' },
]

// Formatear Date a YYYY-MM-DD local
function formatDateYMD(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

// Cambiar rango rápido
const onRangeChange = val => {
  if (!val) return
  
  const today = new Date()
  let start = null
  let end = null
  
  if (val === 'anio_actual') {
    const firstDay = new Date(today.getFullYear(), 0, 1)
    const lastDay = new Date(today.getFullYear(), 12, 0)

    start = formatDateYMD(firstDay)
    end = formatDateYMD(lastDay)
  } else if (val === 'mes_actual') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    start = formatDateYMD(firstDay)
    end = formatDateYMD(lastDay)
  } else if (val === 'mes_anterior') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)

    start = formatDateYMD(firstDay)
    end = formatDateYMD(lastDay)
  } else if (val === 'ultimos_3_meses') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 3, 1)

    start = formatDateYMD(firstDay)
    end = formatDateYMD(today)
  } else if (val === 'ultimos_6_meses') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 6, 1)

    start = formatDateYMD(firstDay)
    end = formatDateYMD(today)
  }
  
  if (start && end) {
    startDate.value = start
    endDate.value = end
    loadKardex()
  }
}

// Cargar datos
const loadKardex = async () => {
  isLoading.value = true
  try {
    const params = {
      search: search.value,
      'start_date': startDate.value,
      'end_date': endDate.value,
    }

    const resp = await $api('kardex/productos', {
      method: 'GET',
      params,
      onResponseError({ response }) {
        console.log('Error al cargar kardex por producto:', response._data?.error)
        showNotification('Error al cargar el kardex por producto', 'error')
      },
    })

    console.log('Kardex product data:', resp)
    kardexData.value = {
      items: resp.data.items,
      itemsGrouped: resp.data.items_grouped,
      filtrosAplicados: resp.data.filtros_aplicados,
    }
    showNotification('Kardex por producto cargado correctamente', 'success')
  } catch (error) {
    console.log(error)
    showNotification('Error al cargar el kardex por producto', 'error')
  } finally {
    isLoading.value = false
  }
}

// Aplicar filtros
const applyFilters = () => {
  loadKardex()
}

// Limpiar filtros
const clearFilters = () => {
  search.value = ''
  selectedRange.value = 'anio_actual'

  const today = new Date()
  const firstDay = new Date(today.getFullYear(), 0, 1)
  const lastDay = new Date(today.getFullYear(), 12, 0)

  startDate.value = formatDateYMD(firstDay)
  endDate.value = formatDateYMD(lastDay)
  loadKardex()
}

// Formatear moneda
const formatCurrency = value => {
  if (value === null || value === undefined) return '$0.00'
  
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value)
}

// Computed para obtener los meses ordenados cronológicamente inverso
const orderedMonths = computed(() => {
  const keys = Object.keys(kardexData.value.itemsGrouped || {})
  
  return keys.sort((a, b) => {
    const aKey = kardexData.value.itemsGrouped[a]?.[0]?.month_key || ''
    const bKey = kardexData.value.itemsGrouped[b]?.[0]?.month_key || ''
    
    return bKey.localeCompare(aKey)
  })
})

onMounted(() => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), 0, 1)
  const lastDay = new Date(today.getFullYear(), 12, 0)

  startDate.value = formatDateYMD(firstDay)
  endDate.value = formatDateYMD(lastDay)
  loadKardex()
})

definePage({ meta: { permission: 'kardex' } })
</script>

<template>
  <div class="pa-4 pa-sm-6 kardex-product-page">
    <!-- Encabezado -->
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon
            icon="ri-draft-line"
            color="primary"
            class="me-2"
            size="28"
          />
          Kardex por Producto y Servicio
        </h1>
        <p class="text-medium-emphasis mb-0">
          Cantidades vendidas y compradas agrupadas mensualmente
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn
          color="primary"
          prepend-icon="ri-refresh-line"
          :loading="isLoading"
          @click="loadKardex"
        >
          Actualizar
        </VBtn>
      </div>
    </div>

    <!-- Filtros -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0 mb-6">
      <VCardText class="pa-4">
        <VRow dense>
          <!-- Buscador -->
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VTextField
              v-model="search"
              label="Buscar por SKU, Nombre o Código Auxiliar"
              placeholder="Ej. alineación, amortiguador, 12345"
              prepend-inner-icon="ri-search-line"
              density="comfortable"
              variant="outlined"
              hide-details
              clearable
              @keyup.enter="applyFilters"
            />
          </VCol>

          <!-- Rango rápido -->
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VSelect
              v-model="selectedRange"
              :items="rangeOptions"
              item-title="title"
              item-value="value"
              label="Rango rápido"
              placeholder="Seleccionar rango"
              density="comfortable"
              variant="outlined"
              hide-details
              @update:model-value="onRangeChange"
            />
          </VCol>

          <VCol
            cols="12"
            sm="12"
            md="4"
            class="d-flex align-center gap-2"
          >
            <VBtn
              color="primary"
              variant="elevated"
              :loading="isLoading"
              class="flex-grow-1"
              @click="applyFilters"
            >
              Filtrar
            </VBtn>
            <VBtn
              color="secondary"
              variant="outlined"
              :loading="isLoading"
              @click="clearFilters"
            >
              Limpiar
            </VBtn>
          </VCol>
        </VRow>

        <VRow
          dense
          class="mt-2"
        >
          <!-- Rango de Fechas -->
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VTextField
              v-model="startDate"
              type="date"
              label="Desde"
              density="comfortable"
              variant="outlined"
              hide-details
              clearable
            />
          </VCol>

          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VTextField
              v-model="endDate"
              type="date"
              label="Hasta"
              density="comfortable"
              variant="outlined"
              hide-details
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Tabla agrupada por mes -->
    <div
      v-if="isLoading"
      class="text-center pa-8"
    >
      <VProgressCircular
        indeterminate
        color="primary"
        size="48"
      />
      <div class="mt-3 text-body-2 text-medium-emphasis">
        Procesando información de productos...
      </div>
    </div>

    <div
      v-else-if="orderedMonths.length === 0"
      class="text-center pa-8"
    >
      <VIcon
        size="64"
        class="mb-3"
        color="grey-lighten-1"
      >
        ri-draft-line
      </VIcon>
      <div class="text-h6 mb-2">
        No hay movimientos registrados en este período
      </div>
      <div class="text-body-2 text-medium-emphasis">
        Intenta cambiando el rango de fechas o los términos de búsqueda
      </div>
    </div>

    <div
      v-else
      class="kardex-container"
    >
      <div
        v-for="monthName in orderedMonths"
        :key="monthName"
        class="mb-6"
      >
        <!-- Encabezado del Mes -->
        <VCard class="rounded-lg border-light border overflow-hidden day-header elevation-0 mb-2">
          <VCardText class="pa-4 d-flex align-center justify-space-between">
            <h2 class="text-h5 font-weight-bold mb-0 d-flex align-center">
              <VIcon
                icon="ri-calendar-event-line"
                color="primary"
                class="me-2"
                size="24"
              />
              {{ monthName }}
            </h2>
            <div class="text-body-2 text-medium-emphasis font-weight-medium">
              {{ kardexData.itemsGrouped[monthName]?.length || 0 }} productos/servicios con actividad
            </div>
          </VCardText>
        </VCard>

        <!-- Tabla de Movimientos del Mes -->
        <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
          <div class="overflow-x-auto">
            <VTable
              hover
              class="kardex-table"
            >
              <thead>
                <tr>
                  <th
                    class="text-left font-weight-bold text-uppercase"
                    style="min-width: 150px;"
                  >
                    CÓDIGO (SKU)
                  </th>
                  <th
                    class="text-left font-weight-bold text-uppercase"
                    style="min-width: 250px;"
                  >
                    DESCRIPCIÓN
                  </th>
                  <th
                    class="text-center font-weight-bold text-uppercase"
                    style="width: 120px;"
                  >
                    TIPO
                  </th>
                  <th
                    class="text-center font-weight-bold text-uppercase bg-success-header"
                    style="width: 120px;"
                  >
                    CANT. VENDIDA
                  </th>
                  <th
                    class="text-right font-weight-bold text-uppercase bg-success-header"
                    style="width: 150px;"
                  >
                    TOTAL VENTAS
                  </th>
                  <th
                    class="text-center font-weight-bold text-uppercase bg-error-header"
                    style="width: 120px;"
                  >
                    CANT. COMPRADA
                  </th>
                  <th
                    class="text-right font-weight-bold text-uppercase bg-error-header"
                    style="width: 150px;"
                  >
                    TOTAL COMPRAS
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in kardexData.itemsGrouped[monthName]"
                  :key="item.month_key + '_' + item.sku + '_' + item.description"
                  class="kardex-row"
                >
                  <!-- Código SKU / Aux -->
                  <td class="text-left py-3">
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold text-slate-800">
                        {{ item.sku || 'SIN SKU' }}
                      </span>
                      <span
                        v-if="item.code_aux"
                        class="text-caption text-medium-emphasis mt-0.5"
                      >
                        cod. aux: {{ item.code_aux }}
                      </span>
                    </div>
                  </td>

                  <!-- Descripción / Nombre del Producto -->
                  <td class="text-left py-3">
                    <div class="text-body-2 text-slate-700 font-medium">
                      {{ item.description }}
                    </div>
                  </td>

                  <!-- Tipo: Producto o Servicio -->
                  <td class="text-center py-3">
                    <VChip
                      :color="item.tipo === 'servicio' ? 'info' : 'warning'"
                      size="small"
                      label
                      class="text-uppercase font-weight-bold"
                    >
                      {{ item.tipo }}
                    </VChip>
                  </td>

                  <!-- Cant. Vendida -->
                  <td class="text-center py-3 bg-success-light text-success font-weight-bold text-body-2">
                    {{ item.cantidad_vendida }}
                  </td>

                  <!-- Total Ventas -->
                  <td class="text-right py-3 bg-success-light text-success font-weight-bold text-body-2">
                    {{ formatCurrency(item.monto_vendido) }}
                  </td>

                  <!-- Cant. Comprada -->
                  <td class="text-center py-3 bg-error-light text-error font-weight-bold text-body-2">
                    {{ item.tipo === 'servicio' ? '-' : item.cantidad_comprada }}
                  </td>

                  <!-- Total Compras -->
                  <td class="text-right py-3 bg-error-light text-error font-weight-bold text-body-2">
                    {{ item.tipo === 'servicio' ? '-' : formatCurrency(item.monto_comprado) }}
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>
        </VCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.day-header {
  background-color: #f8fafc;
}

.kardex-table {
  border-collapse: collapse !important;
  width: 100%;
}

.kardex-table :deep(th) {
  border: 1px solid #e2e8f0 !important;
  text-align: center !important;
  font-weight: 700 !important;
  font-size: 0.75rem !important;
  letter-spacing: 0.5px;
  background-color: #f8fafc !important;
  color: #475569 !important;
  vertical-align: middle !important;
  height: 44px !important;
}

.kardex-table :deep(th.text-left) {
  text-align: left !important;
}

.kardex-table :deep(th.text-right) {
  text-align: right !important;
}

.kardex-table :deep(td) {
  border: 1px solid #e2e8f0 !important;
  height: 56px !important;
  vertical-align: middle !important;
}

.bg-success-header {
  background-color: rgba(76, 175, 80, 0.05) !important;
  color: #2e7d32 !important;
}

.bg-error-header {
  background-color: rgba(244, 67, 54, 0.05) !important;
  color: #c62828 !important;
}

.bg-success-light {
  background-color: rgba(76, 175, 80, 0.02) !important;
}

.bg-error-light {
  background-color: rgba(244, 67, 54, 0.02) !important;
}

.kardex-row {
  transition: background-color 0.15s ease;
}

.kardex-row:hover {
  background-color: #f8fafc !important;
}
</style>
