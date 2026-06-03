<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

// Dialogs Import
import ClientShowDialog from '@/components/inventory/clients/ClientShowDialog.vue'
import VehicleShowDialog from '@/components/inventory/vehicles/VehicleShowDialog.vue'

const theme = useTheme()
const router = useRouter()
const { showNotification } = useGlobalToast()

// State
const loading = ref(true)
const isStockDialogVisible = ref(false)
const isClientDialogVisible = ref(false)
const selectedClient = ref({})
const isVehicleDialogVisible = ref(false)
const selectedVehicle = ref({})

const kpis = ref({
  total_clients: 0,
  total_vehicles: 0,
  low_stock_count: 0,
  low_stock_products: [],
  monthly_sales: 0,
  monthly_expenses: 0,
  monthly_balance: 0
})
const topProducts = ref([])
const cashFlow = ref([])

// Search Engine State & Watcher
const searchQuery = ref('')
const isSearchFocused = ref(false)
const searchResults = ref([])
const searchLoading = ref(false)
let debounceTimeout = null

watch(searchQuery, (newVal) => {
  if (debounceTimeout) clearTimeout(debounceTimeout)

  const query = newVal.trim()
  if (query.length < 2) {
    searchResults.value = []
    return
  }

  debounceTimeout = setTimeout(async () => {
    try {
      searchLoading.value = true
      const response = await $api(`/dashboard/search?q=${encodeURIComponent(query)}`)
      if (response.status === 200) {
        searchResults.value = response.results || []
      }
    } catch (err) {
      console.error('Error al realizar búsqueda en base de datos:', err)
    } finally {
      searchLoading.value = false
    }
  }, 350)
})

const handleSearchBlur = () => {
  setTimeout(() => {
    isSearchFocused.value = false
  }, 200)
}

const handleResultClick = (item) => {
  searchQuery.value = ''
  isSearchFocused.value = false
  
  if (item.type === 'Cliente' && item.raw_data) {
    selectedClient.value = item.raw_data
    isClientDialogVisible.value = true
  } else if (item.type === 'Vehículo' && item.raw_data) {
    selectedVehicle.value = item.raw_data
    isVehicleDialogVisible.value = true
  } else {
    showNotification(`Navegando a: ${item.type} - ${item.name}`, 'info')
    router.push(item.route)
  }
}

// Calendar Widget State & Functions
const todayDateObj = new Date()
const calendarDate = ref(new Date())
const daysOfWeek = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

// Calendar Day Selection & Event Binding
const selectedDay = ref(todayDateObj.getDate())
const selectedMonth = ref(todayDateObj.getMonth())
const selectedYear = ref(todayDateObj.getFullYear())

// Dynamic mockup events linked to calendar dates (anchored on today's relative date)
const mockEvents = {}

const prevMonth = () => {
  calendarDate.value = new Date(calendarDate.value.getFullYear(), calendarDate.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  calendarDate.value = new Date(calendarDate.value.getFullYear(), calendarDate.value.getMonth() + 1, 1)
}

const currentMonthName = computed(() => {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return months[calendarDate.value.getMonth()] + ' ' + calendarDate.value.getFullYear()
})

const calendarDays = computed(() => {
  const year = calendarDate.value.getFullYear()
  const month = calendarDate.value.getMonth()

  const firstDayIndex = new Date(year, month, 1).getDay()
  const lastDay = new Date(year, month + 1, 0).getDate()

  const today = new Date()
  const days = []

  // Padding for previous month days
  for (let i = 0; i < firstDayIndex; i++) {
    days.push({ day: '', isToday: false, isSelected: false })
  }

  // Current month days
  for (let i = 1; i <= lastDay; i++) {
    const isToday = today.getDate() === i &&
      today.getMonth() === month &&
      today.getFullYear() === year
    const isSelected = selectedDay.value === i &&
      selectedMonth.value === month &&
      selectedYear.value === year
    days.push({ day: i, isToday, isSelected })
  }

  return days
})

const selectDayObj = (dayObj) => {
  if (!dayObj.day) return
  selectedDay.value = dayObj.day
  selectedMonth.value = calendarDate.value.getMonth()
  selectedYear.value = calendarDate.value.getFullYear()

  const count = mockEvents[dayObj.day]?.length || 0
  if (count > 0) {
    showNotification(`Mostrando ${count} actividades programadas para el ${dayObj.day} de este mes`, 'info')
  }
}

const activeEvents = computed(() => {
  if (calendarDate.value.getMonth() !== selectedMonth.value || calendarDate.value.getFullYear() !== selectedYear.value) {
    return []
  }
  return mockEvents[selectedDay.value] || []
})

const formattedSelectedDate = computed(() => {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${selectedDay.value} de ${months[selectedMonth.value]}`
})

// Progress Meters Calculations
const balancePercentage = computed(() => {
  const target = 10000
  if (!kpis.value.monthly_balance || kpis.value.monthly_balance <= 0) return 40
  return Math.min(100, Math.round((kpis.value.monthly_balance / target) * 100))
})

const clientsPercentage = computed(() => {
  const target = 100
  if (!kpis.value.total_clients) return 70
  return Math.min(100, Math.round((kpis.value.total_clients / target) * 100))
})

const vehiclesPercentage = computed(() => {
  const target = 150
  if (!kpis.value.total_vehicles) return 55
  return Math.min(100, Math.round((kpis.value.total_vehicles / target) * 100))
})

// Circular Radial Bar Progress
const monthlySalesTarget = 15000
const salesTargetPercentage = computed(() => {
  if (!kpis.value.monthly_sales || kpis.value.monthly_sales <= 0) return 65
  return Math.min(100, Math.round((kpis.value.monthly_sales / monthlySalesTarget) * 100))
})

// Fetch dashboard metrics
const fetchDashboardData = async () => {
  try {
    loading.value = true
    const response = await $api('/dashboard')
    if (response.status === 200) {
      kpis.value = response.data.kpis
      topProducts.value = response.data.top_products || []
      cashFlow.value = response.data.cash_flow || []
    } else {
      showNotification('Error al cargar datos del dashboard', 'error')
    }
  } catch (err) {
    console.error(err)
    showNotification('Ocurrió un error de red al consultar el dashboard', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
})

// Formatting Helpers
const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD'
  }).format(val || 0)
}

// Compute theme colors dynamically from the Vuetify system context
const chartThemes = computed(() => {
  const isDark = theme.current.value.dark
  const textColor = isDark ? '#CFD3EC' : '#6D788D'
  const borderColor = isDark ? 'rgba(234, 234, 255, 0.12)' : 'rgba(38, 43, 67, 0.12)'
  const primaryColor = theme.current.value.colors.primary || '#666CFF'
  const infoColor = theme.current.value.colors.info || '#26C6F9'
  const tooltipTheme = isDark ? 'dark' : 'light'

  return { textColor, borderColor, primaryColor, infoColor, tooltipTheme }
})

// ApexChart: Wavy Dual Area Chart Options & Series using system colors
const wavyChartOptions = computed(() => {
  return {
    chart: {
      id: 'wavy-cashflow-chart',
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent'
    },
    colors: [chartThemes.value.primaryColor, chartThemes.value.infoColor],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.02,
        stops: [0, 95, 100]
      }
    },
    grid: {
      borderColor: chartThemes.value.borderColor,
      strokeDashArray: 4
    },
    xaxis: {
      categories: cashFlow.value.map(item => item.month_name.substring(0, 3)),
      labels: { style: { colors: chartThemes.value.textColor, fontSize: '10px' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: chartThemes.value.textColor, fontSize: '10px' },
        formatter: (val) => `$${Math.round(val)}`
      }
    },
    tooltip: {
      theme: chartThemes.value.tooltipTheme,
      y: {
        formatter: (val) => `$${val.toFixed(2)}`
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: chartThemes.value.textColor }
    }
  }
})

const wavyChartSeries = computed(() => {
  return [
    {
      name: 'Ingresos YTD',
      data: cashFlow.value.map(item => item.income)
    },
    {
      name: 'Egresos YTD',
      data: cashFlow.value.map(item => item.expense)
    }
  ]
})

// ApexChart: Radial Goal Gauge Options & Series
const radialChartOptions = computed(() => {
  return {
    chart: {
      type: 'radialBar',
      background: 'transparent'
    },
    plotOptions: {
      radialBar: {
        hollow: {
          size: '65%'
        },
        track: {
          background: chartThemes.value.borderColor,
          strokeWidth: '100%'
        },
        dataLabels: {
          name: {
            show: true,
            color: chartThemes.value.textColor,
            fontSize: '11px'
          },
          value: {
            show: true,
            color: theme.current.value.dark ? '#ffffff' : '#262B43',
            fontSize: '22px',
            fontWeight: 'bold',
            formatter: (val) => `${val}%`
          }
        }
      }
    },
    colors: [chartThemes.value.primaryColor],
    stroke: {
      lineCap: 'round'
    },
    labels: ['Meta Alcanzada']
  }
})

const radialChartSeries = computed(() => {
  return [salesTargetPercentage.value]
})
</script>

<template>
  <VContainer fluid class="pa-6 dashboard-container">
    <!-- Header glowing ambient background -->
    <div class="dashboard-header-glow"></div>

    <!-- Header (Mockup Style layout using system colors) -->
    <div class="d-flex flex-wrap justify-space-between align-center mb-6 position-relative border-b pb-4"
      style="z-index: 10; border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
      <div>
        <h1 class="text-h4 font-weight-bold text-high-emphasis mb-1" style="letter-spacing: 0.5px;">
          <span class="gradient-title">DASHBOARD</span>
          <span style="font-size: 1.1rem;" class="font-weight-medium text-medium-emphasis">/ ADMIN PANEL</span>
        </h1>
        <p class="text-caption text-medium-emphasis mb-0">Gestión Automotriz - Rendimiento y Balance de Operaciones</p>
      </div>

      <!-- Search & quick action shortcuts -->
      <div class="d-flex flex-wrap align-center gap-4 mt-4 mt-md-0">
        <div style="width: 250px; position: relative;" class="d-none d-sm-block">
          <VTextField v-model="searchQuery" density="compact" placeholder="Buscar cliente, auto, SKU..."
            prepend-inner-icon="ri-search-line" variant="outlined" hide-details class="rounded-xl search-field"
            @focus="isSearchFocused = true" @blur="handleSearchBlur" />

          <!-- Floating search results drop panel -->
          <VCard v-if="searchQuery && isSearchFocused" elevation="8"
            class="position-absolute mt-1 pa-1 rounded-xl search-results-dropdown"
            style="width: 300px; right: 0; z-index: 100; max-height: 250px; overflow-y: auto; background-color: rgb(var(--v-theme-surface)) !important; border: 1px solid rgba(var(--v-theme-on-surface), 0.12) !important;">
            <div v-if="searchLoading"
              class="text-caption text-medium-emphasis text-center py-4 d-flex align-center justify-center gap-2">
              <VProgressCircular indeterminate size="16" width="2" color="primary" />
              <span>Buscando en BD...</span>
            </div>
            <div v-else-if="searchResults.length === 0" class="text-caption text-medium-emphasis text-center py-4">
              Sin coincidencias encontradas
            </div>
            <div v-else>
              <div v-for="(res, idx) in searchResults" :key="idx"
                class="search-result-item pa-2 rounded-lg cursor-pointer d-flex flex-column"
                @mousedown="handleResultClick(res)">
                <div class="d-flex justify-space-between align-center">
                  <span class="font-weight-bold text-caption text-high-emphasis">{{ res.name }}</span>
                  <VChip size="x-small" color="primary" variant="tonal" class="font-weight-bold">{{ res.type }}</VChip>
                </div>
                <span class="text-grey" style="font-size: 0.65rem;">{{ res.detail }}</span>
              </div>
            </div>
          </VCard>
        </div>

        <!-- Quick actions buttons -->
        <div class="d-flex gap-2">
          <VTooltip text="Nueva Orden de Trabajo" location="bottom">
            <template #activator="{ props }">
              <VBtn v-bind="props" icon="ri-tools-line" color="primary" variant="tonal" size="small" class="rounded-lg"
                @click="router.push('/work-orders/add')" />
            </template>
          </VTooltip>
          <VTooltip text="Registrar Venta" location="bottom">
            <template #activator="{ props }">
              <VBtn v-bind="props" icon="ri-money-dollar-box-line" color="primary" variant="tonal" size="small"
                class="rounded-lg" @click="router.push('/sales/add')" />
            </template>
          </VTooltip>
          <VTooltip text="Ingresar Compra" location="bottom">
            <template #activator="{ props }">
              <VBtn v-bind="props" icon="ri-shopping-cart-2-line" color="primary" variant="tonal" size="small"
                class="rounded-lg" @click="router.push('/invoice/manual-purchase')" />
            </template>
          </VTooltip>
          <VTooltip text="Kardex" location="bottom">
            <template #activator="{ props }">
              <VBtn v-bind="props" icon="ri-exchange-funds-line" color="primary" variant="tonal" size="small"
                class="rounded-lg" @click="router.push('/kardex')" />
            </template>
          </VTooltip>
        </div>

        <VBtn prepend-icon="ri-refresh-line" color="primary" variant="tonal" @click="fetchDashboardData"
          :loading="loading" class="rounded-xl px-4" style="border: 1px solid rgba(var(--v-theme-primary), 0.25);">
          Actualizar
        </VBtn>
      </div>
    </div>

    <!-- Spinner Loader -->
    <div v-if="loading" class="d-flex justify-center align-center py-12 my-12">
      <VProgressCircular indeterminate color="primary" size="64" width="6" />
    </div>

    <div v-else class="position-relative" style="z-index: 1;">
      <!-- KPIs Section (Matching Mockup layout with system color cards) -->
      <VRow class="mb-6">
        <!-- KPI 1: Clientes y Vehículos -->
        <VCol cols="12" md="4">
          <VCard elevation="0" class="pa-6 mock-card h-100 d-flex flex-column justify-center align-center text-center">
            <div class="text-h3 font-weight-black text-high-emphasis mb-2">{{ kpis.total_clients }}</div>
            <div class="text-subtitle-2 text-primary font-weight-bold text-uppercase mb-1">Clientes Registrados</div>
            <div class="text-caption text-medium-emphasis">Total de vehículos asociados: {{ kpis.total_vehicles }}</div>
          </VCard>
        </VCol>

        <!-- KPI 2: Balance (Highlighted with system gradient colors) -->
        <VCol cols="12" md="4">
          <VCard elevation="0"
            class="pa-6 mock-card mock-card-gradient h-100 d-flex flex-column justify-center align-center text-center">
            <div class="text-h4 font-weight-black text-white mb-2">{{ formatCurrency(kpis.monthly_balance) }}</div>
            <div class="text-subtitle-2 text-white font-weight-bold text-uppercase mb-1">Balance Mensual</div>
            <div class="text-caption text-white" style="opacity: 0.9;">
              Ventas: {{ formatCurrency(kpis.monthly_sales) }} | Gastos: {{ formatCurrency(kpis.monthly_expenses) }}
            </div>
          </VCard>
        </VCol>

        <!-- KPI 3: Stock Alert -->
        <VCol cols="12" md="4">
          <VCard elevation="0"
            class="pa-6 mock-card h-100 d-flex flex-column justify-center align-center text-center cursor-pointer"
            @click="isStockDialogVisible = true">
            <div class="text-h3 font-weight-black text-high-emphasis mb-2">{{ kpis.low_stock_count }}</div>
            <div class="text-subtitle-2 text-primary font-weight-bold text-uppercase mb-1">Stock Mínimo Alerta</div>
            <div class="text-caption text-medium-emphasis">Productos físicos en niveles mínimos regulados</div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Middle Section (Calendar & Wavy Chart) -->
      <VRow class="mb-6">
        <!-- Column 1: Calendar -->
        <VCol cols="12" md="4">
          <VCard elevation="0" class="pa-4 mock-card h-100">
            <div
              class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-4 border-b pb-2 d-flex align-center gap-2"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
              <VIcon icon="ri-calendar-todo-line" />
              <span>Calendario de Trabajo</span>
            </div>

            <div class="calendar-widget">
              <div class="d-flex justify-space-between align-center mb-4">
                <VIcon icon="ri-arrow-left-s-line" class="cursor-pointer text-primary" @click="prevMonth" />
                <span class="font-weight-bold text-primary text-uppercase text-caption">{{ currentMonthName }}</span>
                <VIcon icon="ri-arrow-right-s-line" class="cursor-pointer text-primary" @click="nextMonth" />
              </div>
              <div class="calendar-grid">
                <div v-for="w in daysOfWeek" :key="w" class="calendar-header-day">{{ w }}</div>
                <div v-for="(dayObj, idx) in calendarDays" :key="idx" class="calendar-day" :class="{
                  'is-today': dayObj.isToday,
                  'is-selected': dayObj.isSelected && !dayObj.isToday,
                  'is-empty': !dayObj.day
                }" @click="selectDayObj(dayObj)">
                  {{ dayObj.day }}
                </div>
              </div>
            </div>

            <!-- Calendar Agenda Timeline Feed -->
            <div class="mt-4 pt-3 border-t" style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-caption font-weight-bold text-primary text-uppercase">Agenda: {{ formattedSelectedDate
                  }}</span>
                <VChip v-if="activeEvents.length > 0" size="x-small" color="primary" class="font-weight-black">
                  {{ activeEvents.length }} event.
                </VChip>
              </div>

              <div v-if="activeEvents.length === 0" class="text-caption text-medium-emphasis text-center py-2">
                Sin órdenes de trabajo programadas
              </div>
              <div class="d-flex flex-column gap-2" v-else>
                <div v-for="(evt, idx) in activeEvents" :key="idx"
                  class="d-flex justify-space-between align-center pa-2 rounded-lg"
                  style="background-color: rgba(var(--v-theme-on-surface), 0.03); border: 1px solid rgba(var(--v-theme-on-surface), 0.05);">
                  <div class="overflow-hidden" style="max-width: 70%;">
                    <div
                      class="font-weight-bold text-caption text-high-emphasis d-flex align-center gap-1 text-truncate">
                      <span style="font-size: 0.75rem;" class="text-primary font-weight-black">{{ evt.time }}</span>
                      <span>-</span>
                      <span class="text-truncate">{{ evt.title }}</span>
                    </div>
                    <div class="text-medium-emphasis text-truncate" style="font-size: 0.68rem;">{{ evt.subtitle }}</div>
                  </div>
                  <VChip :color="evt.color" size="x-small" variant="tonal" class="font-weight-bold">
                    {{ evt.status }}
                  </VChip>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Column 2: Wavy double area chart -->
        <VCol cols="12" md="8">
          <VCard elevation="0" class="pa-4 mock-card h-100">
            <div
              class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-4 border-b pb-2 d-flex align-center gap-2"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
              <VIcon icon="ri-line-chart-line" />
              <span>Flujo de Caja YTD (Ingresos vs Egresos)</span>
            </div>
            <div class="pa-2">
              <VueApexCharts type="area" height="325" :options="wavyChartOptions" :series="wavyChartSeries" />
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Bottom Section (Feed list, progress meters, radial chart) -->
      <VRow class="mb-6">
        <!-- Feed Card: Top Sold Products -->
        <VCol cols="12" md="4">
          <VCard elevation="0" class="pa-4 mock-card h-100 d-flex flex-column justify-space-between">
            <div>
              <div
                class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-4 border-b pb-2 d-flex align-center gap-2"
                style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
                <VIcon icon="ri-star-line" />
                <span>Productos Más Vendidos</span>
              </div>
              <div v-if="topProducts.length === 0" class="text-center py-6 text-medium-emphasis">
                Sin registros de ventas en el mes.
              </div>
              <div v-else>
                <div v-for="(prod, idx) in topProducts.slice(0, 3)" :key="idx" class="mb-4">
                  <div class="d-flex justify-space-between align-center">
                    <span class="font-weight-bold text-uppercase text-caption text-primary text-truncate"
                      style="max-width: 70%;">{{ prod.description }}</span>
                    <span class="text-caption font-weight-bold text-high-emphasis">{{
                      Number(prod.total_quantity).toLocaleString() }} u.</span>
                  </div>
                  <p class="text-caption text-medium-emphasis mb-0" style="font-size: 0.75rem;">Monto mensual: {{
                    formatCurrency(prod.total_revenue) }}</p>
                </div>
              </div>
            </div>
            <VBtn color="primary" variant="elevated" block class="rounded-xl mt-4 font-weight-bold"
              style="background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-info)) 100%) !important; color: #ffffff !important;"
              @click="isStockDialogVisible = true">
              Ver Alertas Stock
            </VBtn>
          </VCard>
        </VCol>

        <!-- Progress Meters Card -->
        <VCol cols="12" md="4">
          <VCard elevation="0" class="pa-4 mock-card h-100">
            <div
              class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-4 border-b pb-2 d-flex align-center gap-2"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
              <VIcon icon="ri-bar-chart-fill" />
              <span>Rendimiento Operativo</span>
            </div>

            <div class="d-flex flex-column gap-5 mt-2">
              <div>
                <div class="d-flex justify-space-between text-caption mb-1">
                  <span class="font-weight-bold">Eficiencia del Balance</span>
                  <span class="text-primary font-weight-bold">{{ balancePercentage }}%</span>
                </div>
                <VProgressLinear v-model="balancePercentage" color="primary" height="8" class="rounded" />
              </div>

              <div>
                <div class="d-flex justify-space-between text-caption mb-1">
                  <span class="font-weight-bold">Registro de Clientes (Meta 100)</span>
                  <span class="text-primary font-weight-bold">{{ clientsPercentage }}%</span>
                </div>
                <VProgressLinear v-model="clientsPercentage" color="primary" height="8" class="rounded" />
              </div>

              <div>
                <div class="d-flex justify-space-between text-caption mb-1">
                  <span class="font-weight-bold">Vehículos Registrados (Meta 150)</span>
                  <span class="text-primary font-weight-bold">{{ vehiclesPercentage }}%</span>
                </div>
                <VProgressLinear v-model="vehiclesPercentage" color="primary" height="8" class="rounded" />
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Radial Chart Card -->
        <VCol cols="12" md="4">
          <VCard elevation="0" class="pa-4 mock-card h-100 d-flex flex-column justify-space-between align-center">
            <div class="w-100">
              <div
                class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-2 border-b pb-2 d-flex align-center gap-2 w-100"
                style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
                <VIcon icon="ri-radar-line" />
                <span>Progreso de Meta Mensual</span>
              </div>
            </div>

            <div class="d-flex justify-center align-center" style="height: 180px; width: 100%;">
              <VueApexCharts type="radialBar" height="200" width="100%" :options="radialChartOptions"
                :series="radialChartSeries" />
            </div>

            <VBtn color="primary" variant="elevated" block class="rounded-xl font-weight-bold"
              style="background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-info)) 100%) !important; color: #ffffff !important;"
              @click="router.push('/sales/add')">
              Registrar Venta
            </VBtn>
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- Low Stock Alert Dialog -->
    <VDialog v-model="isStockDialogVisible" max-width="700">
      <VCard class="rounded-xl mock-card pa-2">
        <VCardItem class="pa-4 border-b" style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
          <template #title>
            <div class="d-flex align-center gap-2 text-warning">
              <VIcon icon="ri-error-warning-line" />
              <span class="font-weight-bold text-h6 text-high-emphasis">Productos bajo Stock Mínimo</span>
            </div>
          </template>
          <template #append>
            <VBtn icon="ri-close-line" variant="text" class="text-high-emphasis"
              @click="isStockDialogVisible = false" />
          </template>
        </VCardItem>
        <VCardText class="pa-0">
          <VTable class="text-no-wrap premium-table">
            <thead>
              <tr>
                <th class="font-weight-bold text-uppercase text-medium-emphasis">SKU</th>
                <th class="font-weight-bold text-uppercase text-medium-emphasis">Producto</th>
                <th class="font-weight-bold text-uppercase text-center text-medium-emphasis">Stock Actual</th>
                <th class="font-weight-bold text-uppercase text-center text-medium-emphasis">Stock Mínimo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="kpis.low_stock_products.length === 0">
                <td colspan="4" class="text-center py-6 text-medium-emphasis">
                  ¡Excelente! No hay productos con stock menor o igual al mínimo.
                </td>
              </tr>
              <tr v-for="item in kpis.low_stock_products" :key="item.id"
                style="border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);">
                <td><code class="text-primary">{{ item.sku || 'N/A' }}</code></td>
                <td class="font-weight-bold text-high-emphasis">{{ item.description }}</td>
                <td class="text-center font-weight-black">
                  <VChip :color="Number(item.stock) === 0 ? 'error' : 'warning'" size="small">
                    {{ item.stock }}
                  </VChip>
                </td>
                <td class="text-center text-medium-emphasis">{{ item.min_stock }}</td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
        <VCardActions class="pa-4 border-t d-flex justify-end"
          style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;">
          <VBtn color="primary" variant="text" @click="isStockDialogVisible = false">Cerrar</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Client Details Dialog -->
    <ClientShowDialog
      v-if="isClientDialogVisible"
      v-model:isDialogVisible="isClientDialogVisible"
      :client-data="selectedClient"
    />

    <!-- Vehicle Details Dialog -->
    <VehicleShowDialog
      v-if="isVehicleDialogVisible"
      v-model:isDialogVisible="isVehicleDialogVisible"
      :vehicle-data="selectedVehicle"
    />
  </VContainer>
</template>

<style scoped>
.dashboard-container {
  position: relative;
  overflow: hidden;
}

.dashboard-header-glow {
  position: absolute;
  top: -120px;
  left: 5%;
  width: 500px;
  height: 300px;
  background: radial-gradient(circle, rgba(var(--v-theme-primary), 0.08) 0%, rgba(var(--v-theme-primary), 0) 70%);
  pointer-events: none;
  z-index: 0;
  filter: blur(60px);
}

.gradient-title {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-info)) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
}

.mock-card {
  background-color: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
  border-radius: 16px !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

.mock-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 24px rgba(var(--v-theme-primary), 0.1) !important;
  border-color: rgba(var(--v-theme-primary), 0.25) !important;
}

.mock-card-gradient {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-info)) 100%) !important;
  color: #ffffff !important;
  border: none !important;
}

.mock-card-gradient:hover {
  box-shadow: 0 12px 24px rgba(var(--v-theme-primary), 0.25) !important;
}

/* Custom Search Field styling to match system */
.search-field :deep(.v-field) {
  border-radius: 24px !important;
  background-color: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
}

.search-field :deep(.v-field__outline) {
  display: none;
}

.search-field :deep(.v-field__prepend-inner) .v-icon {
  color: rgb(var(--v-theme-primary)) !important;
}

/* Floating drop-down list items */
.search-results-dropdown {
  backdrop-filter: blur(12px);
}

.search-result-item {
  transition: background-color 0.25s ease;
}

.search-result-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}

/* Custom Calendar Styling using system themes */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  text-align: center;
  font-size: 0.85rem;
}

.calendar-header-day {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-weight: bold;
  padding-bottom: 4px;
}

.calendar-day {
  color: rgb(var(--v-theme-on-surface));
  padding: 6px 0;
  border-radius: 6px;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.calendar-day:hover:not(.is-empty) {
  background-color: rgba(var(--v-theme-primary), 0.1);
  cursor: pointer;
}

.calendar-day.is-today {
  background-color: rgb(var(--v-theme-primary)) !important;
  color: #ffffff !important;
  font-weight: bold;
  box-shadow: 0 0 12px rgba(var(--v-theme-primary), 0.4);
}

.calendar-day.is-selected {
  border: 1.5px solid rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-primary)) !important;
  font-weight: bold;
}

.calendar-day.is-empty {
  visibility: hidden;
}

/* Custom progress linear styling overrides to match system themes */
:deep(.v-progress-linear) {
  background-color: rgba(var(--v-theme-on-surface), 0.08) !important;
}

/* Table styles */
.premium-table {
  background: transparent !important;
}

.premium-table :deep(tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.05) !important;
}

.premium-table :deep(th) {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
}

.premium-table :deep(td) {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
}

.pulse-warning {
  box-shadow: 0 0 0 0 rgba(255, 179, 0, 0.7);
  animation: pulse-warn 2s infinite;
}

@keyframes pulse-warn {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 179, 0, 0.7);
  }

  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(255, 179, 0, 0);
  }

  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 179, 0, 0);
  }
}
</style>
