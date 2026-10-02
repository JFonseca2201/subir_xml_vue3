<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

// Estado reactivo
const isRefreshing = ref(false)
const isFiltering = ref(false)
const isClearing = ref(false)
const isTableLoading = ref(false)
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
    loadKardex('filter')
  }
}

// Cargar datos
const loadKardex = async (action = 'refresh') => {
  if (action === 'refresh') isRefreshing.value = true
  else if (action === 'filter') isFiltering.value = true
  else if (action === 'clear') isClearing.value = true

  isTableLoading.value = true
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
    isRefreshing.value = false
    isFiltering.value = false
    isClearing.value = false
    isTableLoading.value = false
  }
}

// Aplicar filtros
const applyFilters = () => {
  loadKardex('filter')
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
  loadKardex('clear')
}

// Formatear moneda
const formatCurrency = value => {
  if (value === null || value === undefined) return '$0.00'

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value)
}

// Formatear cantidades para redondear valores como 4.01 a 4
const formatQuantity = value => {
  if (value === null || value === undefined) return 0
  const num = Number(value)

  if (Math.abs(num - Math.round(num)) <= 0.02) {
    return Math.round(num)
  }

  return Number(num.toFixed(2))
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
  loadKardex('initial')
})

definePage({ meta: { permission: 'kardex' } })
</script>

<template>
  <div class="pa-4 pa-sm-6 kardex-product-page">
    <!-- Encabezado -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
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
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn
          color="primary"
          prepend-icon="ri-refresh-line"
          :loading="isRefreshing"
          :disabled="isFiltering || isClearing"
          @click="loadKardex('refresh')"
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
              :loading="isFiltering"
              :disabled="isRefreshing || isClearing"
              class="flex-grow-1"
              @click="applyFilters"
            >
              Filtrar
            </VBtn>
            <VBtn
              color="secondary"
              variant="outlined"
              :loading="isClearing"
              :disabled="isRefreshing || isFiltering"
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
      v-if="isTableLoading"
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

        <!-- VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (d-md-none) -->
        <div class="d-md-none d-flex flex-column gap-3 mb-4">
          <div
            v-for="item in kardexData.itemsGrouped[monthName]"
            :key="item.month_key + '_' + item.sku + '_' + item.description"
            class="mobile-kardex-product-card"
          >
            <!-- Fila Superior: SKU/Código y Tipo -->
            <div class="d-flex align-center justify-space-between pb-2 border-b mb-2">
              <div class="d-flex align-center gap-1.5 flex-wrap">
                <span class="text-caption font-mono font-weight-bold text-high-emphasis">
                  {{ item.sku || 'SIN SKU' }}
                </span>
                <span
                  v-if="item.code_aux"
                  class="text-caption text-medium-emphasis"
                >
                  ({{ item.code_aux }})
                </span>
              </div>
              <div
                class="status-pill-clean"
                :class="item.tipo === 'servicio' ? 'status-info' : 'status-partial'"
              >
                <span class="status-dot" />
                <span>{{ item.tipo }}</span>
              </div>
            </div>

            <!-- Fila Central: Avatar y Descripción -->
            <div class="d-flex align-start gap-3 mb-3">
              <VAvatar
                size="38"
                color="primary"
                variant="tonal"
                rounded="lg"
                class="flex-shrink-0 mt-0.5"
              >
                <VIcon
                  :icon="item.tipo === 'servicio' ? 'ri-tools-line' : 'ri-box-3-line'"
                  size="20"
                />
              </VAvatar>
              <div class="min-w-0 flex-grow-1">
                <div class="font-weight-bold text-high-emphasis text-body-2">
                  {{ item.description }}
                </div>
              </div>
            </div>

            <!-- Cuadrícula Ventas vs Compras -->
            <div class="d-flex flex-column gap-2">
              <!-- Bloque Ventas -->
              <div class="d-flex align-center justify-space-between pa-2.5 rounded-lg bg-success-light">
                <div class="d-flex align-center gap-2">
                  <VIcon
                    icon="ri-shopping-cart-2-line"
                    size="18"
                    color="success"
                  />
                  <span class="text-caption font-weight-medium text-success">Ventas:</span>
                  <span class="text-caption font-weight-bold text-success">
                    {{ formatQuantity(item.cantidad_vendida) }} uds.
                  </span>
                </div>
                <span class="text-body-2 font-weight-bold text-success">
                  {{ formatCurrency(item.monto_vendido) }}
                </span>
              </div>

              <!-- Bloque Compras (si no es servicio) -->
              <div
                v-if="item.tipo !== 'servicio'"
                class="d-flex align-center justify-space-between pa-2.5 rounded-lg bg-error-light"
              >
                <div class="d-flex align-center gap-2">
                  <VIcon
                    icon="ri-truck-line"
                    size="18"
                    color="error"
                  />
                  <span class="text-caption font-weight-medium text-error">Compras:</span>
                  <span class="text-caption font-weight-bold text-error">
                    {{ formatQuantity(item.cantidad_comprada) }} uds.
                  </span>
                </div>
                <span class="text-body-2 font-weight-bold text-error">
                  {{ formatCurrency(item.monto_comprado) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- VISTA DESKTOP: TABLA (d-none d-md-block) -->
        <VCard class="d-none d-md-block rounded-lg border-light border overflow-hidden elevation-0">
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
                    <div class="text-body-2 text-slate-800 font-weight-bold">
                      {{ item.description }}
                    </div>
                    <div class="d-flex align-center gap-2 mt-1">
                      <div
                        v-if="item.sku"
                        class="status-pill-clean status-primary"
                        style="font-size: 0.68rem !important; padding: 2px 8px !important;"
                      >
                        <span class="status-dot" />
                        <span>SKU: {{ item.sku }}</span>
                      </div>
                      <span
                        v-if="item.code_aux"
                        class="text-caption text-medium-emphasis"
                      >
                        Cód. Aux: {{ item.code_aux }}
                      </span>
                    </div>
                  </td>

                  <!-- Tipo: Producto o Servicio -->
                  <td class="text-center py-3">
                    <div
                      class="status-pill-clean"
                      :class="item.tipo === 'servicio' ? 'status-info' : 'status-partial'"
                    >
                      <span class="status-dot" />
                      <span>{{ item.tipo }}</span>
                    </div>
                  </td>

                  <!-- Cant. Vendida -->
                  <td class="text-center py-3 bg-success-light text-success font-weight-bold text-body-2">
                    {{ formatQuantity(item.cantidad_vendida) }}
                  </td>

                  <!-- Total Ventas -->
                  <td class="text-right py-3 bg-success-light text-success font-weight-bold text-body-2">
                    {{ formatCurrency(item.monto_vendido) }}
                  </td>

                  <!-- Cant. Comprada -->
                  <td class="text-center py-3 bg-error-light text-error font-weight-bold text-body-2">
                    {{ item.tipo === 'servicio' ? '-' : formatQuantity(item.cantidad_comprada) }}
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
