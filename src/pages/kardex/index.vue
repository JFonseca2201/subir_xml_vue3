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
  }


  return labels[concepto] || concepto
}

// Computed para obtener días ordenados
const orderedDays = computed(() => {
  return Object.keys(kardexData.value.movimientos_agrupados || {}).sort((a, b) => new Date(b) - new Date(a))
})

// Obtener movimientos de un día específico y calcular el saldo acumulado diario
const getMovimientosConSaldo = day => {
  const movimientos = kardexData.value.movimientos_agrupados?.[day] || []

  // Como están ordenados de más reciente a más antiguo (desc), los revertimos
  // para calcular el saldo acumulado cronológicamente (asc)
  const cronologico = [...movimientos].reverse()
  let saldoAcumulado = 0

  const conSaldo = cronologico.map(movimiento => {
    const monto = parseFloat(movimiento.monto_financiero) || 0
    if (movimiento.movimiento_tipo === 'entrada') {
      saldoAcumulado += monto
    } else {
      saldoAcumulado -= monto
    }

    return {
      ...movimiento,
      saldo_acumulado: saldoAcumulado,
    }
  })

  // Revertimos de nuevo para mostrar los más recientes arriba en la tabla
  return conSaldo.reverse()
}

// Computed para obtener resumen de un día específico
const getResumenByDay = day => {
  return kardexData.value.resumen_por_dia?.[day] || {}
}

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
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-file-list-3-line" color="primary" class="me-2" size="28" />
          Kardex
        </h1>
        <p class="text-medium-emphasis mb-0">
          Movimientos financieros consolidados
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
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

    <!-- Tabla de Kardex Agrupada por Día -->
    <div v-if="isLoading" class="text-center pa-8">
      <VProgressCircular indeterminate color="primary" size="48" />
      <div class="mt-3 text-body-2 text-medium-emphasis">
        Cargando movimientos...
      </div>
    </div>

    <div v-else-if="orderedDays.length === 0" class="text-center pa-8">
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
      <div v-for="day in orderedDays" :key="day" class="mb-6">
        <!-- Encabezado del Día con Resumen -->
        <VCard class="rounded-lg border-light border overflow-hidden elevation-0 mb-2 day-header">
          <VCardText class="pa-4">
            <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center gap-4">
              <div>
                <h2 class="text-h5 font-weight-bold mb-1">
                  <VIcon icon="ri-calendar-line" color="primary" class="me-2" size="24" />
                  {{ formatDate(day) }}
                </h2>
              </div>
              <div class="d-flex gap-4 flex-wrap">
                <div class="text-center">
                  <div class="text-caption text-medium-emphasis">
                    Ingresos
                  </div>
                  <div class="text-h6 font-weight-bold text-success">
                    {{ formatCurrency(getResumenByDay(day).total_ingresos_financieros || 0) }}
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-caption text-medium-emphasis">
                    Egresos
                  </div>
                  <div class="text-h6 font-weight-bold text-error">
                    {{ formatCurrency(getResumenByDay(day).total_egresos_financieros || 0) }}
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-caption text-medium-emphasis">
                    Saldo
                  </div>
                  <div class="text-h6 font-weight-bold"
                    :class="getResumenByDay(day).saldo_financiero >= 0 ? 'text-success' : 'text-error'">
                    {{ formatCurrency(getResumenByDay(day).saldo_financiero || 0) }}
                  </div>
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>

        <!-- Tabla de Movimientos del Día -->
        <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
          <div class="overflow-x-auto">
            <VTable hover class="kardex-table">
              <thead>
                <!-- Fila 1: Cabeceras Agrupadas -->
                <tr>
                  <th rowspan="2" class="text-left font-weight-bold text-uppercase" style="min-width: 180px;">
                    CONCEPTO
                  </th>
                  <th rowspan="2" class="text-left font-weight-bold text-uppercase" style="min-width: 250px;">
                    DESCRIPCIÓN
                  </th>
                  <th rowspan="2" class="text-left font-weight-bold text-uppercase" style="min-width: 180px;">
                    CUENTA /
                    REFERENCIA
                  </th>
                  <th rowspan="2" class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                    CANT.
                  </th>
                  <th colspan="2" class="text-center font-weight-bold text-uppercase flow-header-group">
                    VALORES DE FLUJO
                  </th>
                  <th rowspan="2" class="text-right font-weight-bold text-uppercase" style="width: 140px;">
                    SALDO ACUM.
                  </th>
                </tr>
                <!-- Fila 2: Sub-cabeceras -->
                <tr>
                  <th class="text-right font-weight-bold text-uppercase flow-in-header" style="width: 130px;">
                    ENTRADA
                    (+)
                  </th>
                  <th class="text-right font-weight-bold text-uppercase flow-out-header" style="width: 130px;">
                    SALIDA
                    (-)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="movimiento in getMovimientosConSaldo(day)" :key="movimiento.id" class="kardex-row">
                  <!-- Concepto -->
                  <td class="text-left py-3">
                    <div class="d-flex align-center gap-2">
                      <VIcon :icon="getConceptoIcon(movimiento.concepto_tipo)" size="20" color="primary" />
                      <div class="d-flex flex-column">
                        <span class="text-body-2 font-weight-bold text-slate-800">
                          {{ movimiento.concepto || getConceptoLabel(movimiento.concepto_tipo) }}
                        </span>
                        <span v-if="movimiento.codigo_aux" class="text-caption text-medium-emphasis mt-0.5">
                          cod. aux: {{ movimiento.codigo_aux }}
                        </span>
                      </div>
                    </div>
                  </td>

                  <!-- Descripción -->
                  <td class="text-left py-3">
                    <div class="text-body-2 text-slate-600 font-medium">
                      {{ movimiento.descripcion || 'Sin descripción' }}
                    </div>
                  </td>

                  <!-- Cuenta / Referencia -->
                  <td class="text-left py-3">
                    <div class="text-body-2 font-weight-bold text-slate-800">
                      {{ movimiento.account ? movimiento.account.name : 'Sin cuenta' }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      <span v-if="movimiento.referencia_tipo" class="text-xs text-slate-500">
                        {{ movimiento.referencia_tipo }} #{{ movimiento.referencia_id }}
                      </span>
                      <span v-else class="text-xs text-slate-400">Sin ref.</span>
                    </div>
                  </td>

                  <!-- Cant. -->
                  <td class="text-center py-3 bg-balance font-weight-bold text-slate-800">
                    <span v-if="movimiento.cantidad_movida !== null && movimiento.cantidad_movida !== undefined"
                      class="text-body-2">
                      {{ movimiento.cantidad_movida }}
                    </span>
                    <span v-else class="text-slate-400">-</span>
                  </td>

                  <!-- Entrada (+) -->
                  <td class="text-right py-3 bg-success-light font-weight-bold">
                    <span v-if="movimiento.movimiento_tipo === 'entrada'" class="text-success text-body-2">
                      +{{ formatCurrency(movimiento.monto_financiero || 0) }}
                    </span>
                    <span v-else class="text-grey-lighten-1">-</span>
                  </td>

                  <!-- Salida (-) -->
                  <td class="text-right py-3 bg-error-light font-weight-bold">
                    <span v-if="movimiento.movimiento_tipo === 'salida'" class="text-error text-body-2">
                      -{{ formatCurrency(movimiento.monto_financiero || 0) }}
                    </span>
                    <span v-else class="text-grey-lighten-1">-</span>
                  </td>

                  <!-- Saldo Acumulado -->
                  <td class="text-right py-3 font-weight-bold bg-balance">
                    <span :class="movimiento.saldo_acumulado >= 0 ? 'text-success' : 'text-error'" class="text-body-2">
                      {{ formatCurrency(movimiento.saldo_acumulado) }}
                    </span>
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

.day-header .v-card-text {
  color: #334155;
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
  height: 40px !important;
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

.bg-success-light {
  background-color: rgba(76, 175, 80, 0.01) !important;
}

.bg-error-light {
  background-color: rgba(244, 67, 54, 0.01) !important;
}

.bg-balance {
  background-color: #fafbfc !important;
}

.kardex-row {
  transition: background-color 0.15s ease;
}

.kardex-row:hover {
  background-color: #f8fafc !important;
}

.flow-header-group {
  border-bottom: 2px solid #cbd5e1 !important;
  background-color: #f1f5f9 !important;
}

.flow-in-header {
  color: #2e7d32 !important;
  background-color: rgba(76, 175, 80, 0.05) !important;
}

.flow-out-header {
  color: #c62828 !important;
  background-color: rgba(244, 67, 54, 0.05) !important;
}
</style>
