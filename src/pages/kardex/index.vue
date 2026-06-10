<script setup>
import { ref, onMounted, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

// Estado reactivo
const isLoading = ref(false)
const search = ref('')
const movimientoTipo = ref(null)
const selectedRange = ref('mes_actual')
const startDate = ref('')
const endDate = ref('')
const perPage = ref(50)

// Datos
const kardexData = ref({
  movimientos: [],
  movimientos_agrupados: {},
  resumen_por_dia: {},
  pagination: {},
  filtros_aplicados: {},
})

// Opciones de filtros
const movimientoTipoOptions = [
  { title: 'Todos', value: null },
  { title: 'Ingresos', value: 'income' },
  { title: 'Egresos', value: 'expense' },
  { title: 'Transferencias', value: 'transfer' },
]

// Rango rápido de fechas
const rangeOptions = [
  { title: 'Mes Actual', value: 'mes_actual' },
  { title: 'Última Semana', value: 'ultima_semana' },
  { title: 'Hace 15 Días', value: 'ultimos_15_dias' },
  { title: 'Mes Anterior', value: 'mes_anterior' },
  ...getCurrentYearMonths(),
]

// Generar meses del año actual
function getCurrentYearMonths() {
  const currentYear = new Date().getFullYear()

  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]


  return monthNames.map((name, index) => ({
    title: `${name} ${currentYear}`,
    value: `mes_${index}`,
  }))
}

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
  const currentYear = today.getFullYear()
  let start = null
  let end = null

  if (val === 'ultima_semana') {
    const priorDate = new Date()

    priorDate.setDate(today.getDate() - 7)
    start = formatDateYMD(priorDate)
    end = formatDateYMD(today)
  } else if (val === 'ultimos_15_dias') {
    const priorDate = new Date()

    priorDate.setDate(today.getDate() - 15)
    start = formatDateYMD(priorDate)
    end = formatDateYMD(today)
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
  } else if (val.startsWith('mes_')) {
    const monthIndex = parseInt(val.replace('mes_', ''))
    const firstDay = new Date(currentYear, monthIndex, 1)
    const lastDay = new Date(currentYear, monthIndex + 1, 0)

    start = formatDateYMD(firstDay)
    end = formatDateYMD(lastDay)
  }

  if (start && end) {
    startDate.value = start
    endDate.value = end
    loadKardex()
  }
}

// Cargar datos del kardex
const loadKardex = async () => {
  isLoading.value = true
  try {
    const params = {
      search: search.value,
      movimiento_tipo: movimientoTipo.value,
      start_date: startDate.value,
      end_date: endDate.value,
      per_page: perPage.value,
    }

    const resp = await $api('kardex', {
      method: 'GET',
      params,
      onResponseError({ response }) {
        console.log('Error al cargar kardex:', response._data.error)
        showNotification('Error al cargar el kardex', 'error')
      },
    })

    console.log('Kardex data:', resp)
    kardexData.value = resp.data
    showNotification('Kardex cargado correctamente', 'success')
  } catch (error) {
    console.log(error)
    showNotification('Error al cargar el kardex', 'error')
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
  movimientoTipo.value = null
  selectedRange.value = 'mes_actual'

  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  startDate.value = formatDateYMD(firstDay)
  endDate.value = formatDateYMD(lastDay)
  loadKardex()
}

// Formatear fecha para mostrar
const formatDate = dateString => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }

  return date.toLocaleDateString('es-ES', options)
}

// Formatear moneda
const formatCurrency = value => {
  if (value === null || value === undefined) return '$0.00'

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value)
}

// Obtener color según tipo de movimiento
const getMovimientoColor = tipo => {
  return tipo === 'entrada' ? 'success' : 'error'
}

// Obtener icono según concepto tipo
const getConceptoIcon = concepto => {
  const icons = {
    venta_producto: 'ri-shopping-cart-line',
    venta_servicio: 'ri-service-line',
    compra_inventario: 'ri-shopping-bag-3-line',
    pago_sueldo: 'ri-money-dollar-circle-line',
    adelanto: 'ri-hand-coin-line',
    gasto_general: 'ri-file-list-3-line',
    transferencia: 'ri-arrow-left-right-line',
  }


  return icons[concepto] || 'ri-file-line'
}

// Obtener etiqueta del concepto tipo
const getConceptoLabel = concepto => {
  const labels = {
    venta_producto: 'Venta Producto',
    venta_servicio: 'Venta Servicio',
    compra_inventario: 'Compra Inventario',
    pago_sueldo: 'Pago Sueldo',
    adelanto: 'Adelanto',
    gasto_general: 'Gasto General',
    transferencia: 'Transferencia',
  }


  return labels[concepto] || concepto
}

// Formatear cantidades para redondear valores como 4.01 a 4
const formatQuantity = value => {
  if (value === null || value === undefined) return 0
  const num = Number(value)
  
  // Si está extremadamente cerca de un entero (como 4.01 o 3.99), probablemente fue un error de cálculo o XML
  if (Math.abs(num - Math.round(num)) <= 0.02) {
    return Math.round(num)
  }
  
  return Number(num.toFixed(2))
}

// Computed para agrupar por producto
const groupedByProduct = computed(() => {
  const groups = {}

  const movimientos = kardexData.value.movimientos || []

  movimientos.forEach(mov => {
    let productName = 'Otros (Sin Producto Específico)'
    let productSku = 'N/A'
    let isProduct = false

    if (mov.producto && mov.producto.id) {
      productName = mov.producto.description || mov.descripcion
      productSku = mov.producto.sku || mov.codigo_aux || 'N/A'
      isProduct = true
    } else if (mov.codigo_aux || mov.concepto_tipo === 'venta_producto' || mov.concepto_tipo === 'compra_inventario') {
      productName = mov.descripcion || mov.concepto
      productSku = mov.codigo_aux || mov.concepto || 'N/A'
      isProduct = true
    }

    const key = isProduct ? `${productSku} - ${productName}` : 'Movimientos Generales (Pagos, Adelantos, etc)'

    if (!groups[key]) {
      groups[key] = {
        name: productName,
        sku: productSku,
        isProduct: isProduct,
        items: [],
        totalEntradasFinancieras: 0,
        totalSalidasFinancieras: 0,
        totalEntradasFisicas: 0,
        totalSalidasFisicas: 0,
        saldoFinanciero: 0
      }
    }

    groups[key].items.push(mov)

    const monto = parseFloat(mov.monto_financiero) || 0
    const cant = formatQuantity(mov.cantidad_movida)

    if (mov.movimiento_tipo === 'entrada') {
      groups[key].totalEntradasFinancieras += monto
      if (mov.concepto_tipo === 'venta_producto') {
        // Si vendemos, sale inventario, entra dinero
        groups[key].totalSalidasFisicas += cant
      } else {
        groups[key].totalEntradasFisicas += cant
      }
      groups[key].saldoFinanciero += monto
    } else {
      groups[key].totalSalidasFinancieras += monto
      if (mov.concepto_tipo === 'compra_inventario') {
        // Si compramos, entra inventario, sale dinero
        groups[key].totalEntradasFisicas += cant
      } else {
        groups[key].totalSalidasFisicas += cant
      }
      groups[key].saldoFinanciero -= monto
    }
  })

  // Calcular saldos acumulados
  Object.values(groups).forEach(group => {
    const cronologico = [...group.items].reverse()
    let saldoAcum = 0

    const conSaldo = cronologico.map(m => {
      const monto = parseFloat(m.monto_financiero) || 0
      if (m.movimiento_tipo === 'entrada') saldoAcum += monto
      else saldoAcum -= monto
      return { ...m, saldo_acumulado: saldoAcum }
    })

    group.items = conSaldo.reverse()
  })

  return groups
})

onMounted(() => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  startDate.value = formatDateYMD(firstDay)
  endDate.value = formatDateYMD(lastDay)
  loadKardex()
})

definePage({ meta: { permission: 'kardex' } })
</script>

<template>
  <div class="pa-4 pa-sm-6 kardex-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-file-list-3-line" color="primary" class="me-2" size="28" />
          Kardex
        </h1>
        <p class="text-medium-emphasis mb-0">
          Movimientos financieros consolidados
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="primary" prepend-icon="ri-refresh-line" :loading="isLoading" @click="loadKardex">
          Actualizar
        </VBtn>
      </div>
    </div>

    <!-- Panel de Filtros -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0 mb-6">
      <VCardText class="pa-4">
        <VRow dense>
          <!-- Buscador -->
          <VCol cols="12" sm="6" md="4">
            <VTextField v-model="search" label="Buscar por descripción o artículo"
              placeholder="Texto, nombre o SKU de artículo" prepend-inner-icon="ri-search-line" density="comfortable"
              variant="outlined" hide-details clearable @keyup.enter="applyFilters" />
          </VCol>

          <!-- Tipo de Movimiento -->
          <VCol cols="12" sm="6" md="4">
            <VSelect v-model="movimientoTipo" :items="movimientoTipoOptions" item-title="title" item-value="value"
              label="Tipo Flujo" placeholder="Todos" density="comfortable" variant="outlined" hide-details clearable />
          </VCol>

          <!-- Rango rápido -->
          <VCol cols="12" sm="6" md="4">
            <VSelect v-model="selectedRange" :items="rangeOptions" item-title="title" item-value="value"
              label="Rango rápido" placeholder="Seleccionar rango" density="comfortable" variant="outlined" hide-details
              @update:model-value="onRangeChange" />
          </VCol>
        </VRow>

        <VRow dense class="mt-2">
          <!-- Rango de Fechas -->
          <VCol cols="12" sm="6" md="4">
            <VTextField v-model="startDate" type="date" label="Desde" density="comfortable" variant="outlined"
              hide-details clearable />
          </VCol>

          <VCol cols="12" sm="6" md="4">
            <VTextField v-model="endDate" type="date" label="Hasta" density="comfortable" variant="outlined"
              hide-details clearable />
          </VCol>

          <!-- Botones de Acción -->
          <VCol cols="12" sm="12" md="4" class="d-flex align-center gap-2">
            <VBtn color="primary" variant="elevated" :loading="isLoading" class="flex-grow-1" @click="applyFilters">
              Filtrar
            </VBtn>
            <VBtn color="secondary" variant="outlined" :loading="isLoading" @click="clearFilters">
              Limpiar
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Tabla de Kardex Agrupada por Producto -->
    <div v-if="isLoading" class="text-center pa-8">
      <VProgressCircular indeterminate color="primary" size="48" />
      <div class="mt-3 text-body-2 text-medium-emphasis">
        Cargando movimientos...
      </div>
    </div>

    <div v-else-if="Object.keys(groupedByProduct).length === 0" class="text-center pa-8">
      <VIcon size="64" class="mb-3" color="grey-lighten-1">
        ri-file-list-3-line
      </VIcon>
      <div class="text-h6 mb-2">
        No hay movimientos registrados
      </div>
      <div class="text-body-2 text-medium-emphasis">
        Aplica filtros o selecciona un rango de fechas diferente
      </div>
    </div>

    <div v-else class="kardex-container">
      <div v-for="(group, key) in groupedByProduct" :key="key" class="mb-6">
        <!-- Encabezado del Producto con Resumen -->
        <VCard class="rounded-lg border-light border overflow-hidden elevation-0 mb-2 day-header">
          <VCardText class="pa-4">
            <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center gap-4">
              <div>
                <h2 class="text-h5 font-weight-bold mb-1 d-flex align-center">
                  <VIcon :icon="group.isProduct ? 'ri-box-3-line' : 'ri-wallet-3-line'" color="primary" class="me-2"
                    size="24" />
                  {{ key }}
                </h2>
                <div class="text-body-2 text-medium-emphasis">
                  {{ group.items.length }} Movimientos en este rango
                </div>
              </div>
              <div class="d-flex gap-4 flex-wrap">
                <div class="text-center" v-if="group.isProduct">
                  <div class="text-caption text-medium-emphasis">
                    Und. Compradas
                  </div>
                  <div class="text-h6 font-weight-bold text-success">
                    {{ formatQuantity(group.totalEntradasFisicas) }}
                  </div>
                </div>
                <div class="text-center" v-if="group.isProduct">
                  <div class="text-caption text-medium-emphasis">
                    Und. Vendidas
                  </div>
                  <div class="text-h6 font-weight-bold text-error">
                    {{ formatQuantity(group.totalSalidasFisicas) }}
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-caption text-medium-emphasis">
                    Ingresos ($)
                  </div>
                  <div class="text-h6 font-weight-bold text-success">
                    {{ formatCurrency(group.totalEntradasFinancieras) }}
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-caption text-medium-emphasis">
                    Egresos ($)
                  </div>
                  <div class="text-h6 font-weight-bold text-error">
                    {{ formatCurrency(group.totalSalidasFinancieras) }}
                  </div>
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>

        <!-- Tabla de Movimientos del Producto -->
        <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
          <div class="overflow-x-auto">
            <VTable hover class="kardex-table">
              <thead>
                <tr>
                  <th class="text-left font-weight-bold">FECHA</th>
                  <th class="text-left font-weight-bold">CONCEPTO</th>
                  <th class="text-left font-weight-bold">DETALLES</th>
                  <th v-if="group.isProduct" class="text-center font-weight-bold">CANTIDAD</th>
                  <th class="text-right font-weight-bold">ENTRADA (+)</th>
                  <th class="text-right font-weight-bold">SALIDA (-)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="movimiento in group.items" :key="movimiento.id">
                  <td>{{ movimiento.fecha_formateada }}</td>
                  <td>
                    <div class="d-flex align-center">
                      <VIcon :icon="getConceptoIcon(movimiento.concepto_tipo)" size="small" class="me-2" />
                      {{ getConceptoLabel(movimiento.concepto_tipo) }}
                    </div>
                  </td>

                  <!-- REFERENCIA Y DETALLES -->
                  <td>
                    <div class="text-body-2 text-medium-emphasis text-wrap">
                      {{ movimiento.descripcion || 'Sin descripción' }}
                    </div>
                    <div v-if="movimiento.account" class="text-caption d-flex align-center mt-1">
                      <VIcon icon="ri-bank-card-line" size="x-small" class="me-1" />
                      {{ movimiento.account.name }}
                    </div>
                  </td>

                  <!-- CANTIDAD FÍSICA -->
                  <td class="text-center" v-if="group.isProduct">
                    <VChip v-if="movimiento.cantidad_movida" size="small"
                      :color="movimiento.concepto_tipo === 'compra_inventario' ? 'success' : (movimiento.concepto_tipo === 'venta_producto' ? 'error' : 'default')"
                      variant="tonal">
                      {{ movimiento.concepto_tipo === 'compra_inventario' ? '+' : '-' }}{{ formatQuantity(movimiento.cantidad_movida) }}
                    </VChip>
                    <span v-else class="text-grey">-</span>
                  </td>

                  <!-- FLUJO FINANCIERO: ENTRADA -->
                  <td class="text-right flow-in-cell">
                    <span v-if="movimiento.movimiento_tipo === 'entrada'" class="font-weight-bold text-success">
                      +{{ formatCurrency(movimiento.monto_financiero) }}
                    </span>
                    <span v-else class="text-grey-lighten-2">-</span>
                  </td>

                  <!-- FLUJO FINANCIERO: SALIDA -->
                  <td class="text-right flow-out-cell">
                    <span v-if="movimiento.movimiento_tipo === 'salida'" class="font-weight-bold text-error">
                      -{{ formatCurrency(movimiento.monto_financiero) }}
                    </span>
                    <span v-else class="text-grey-lighten-2">-</span>
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
