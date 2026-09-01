<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { getBrandNameById } from '@/data/vehicleBrands.js'

// Dialogs Import
import ClientShowDialog from '@/components/inventory/clients/ClientShowDialog.vue'
import VehicleShowDialog from '@/components/inventory/vehicles/VehicleShowDialog.vue'
import MonthlySalesBreakdownDialog from '@/components/dashboard/MonthlySalesBreakdownDialog.vue'

const theme = useTheme()
const router = useRouter()
const { showNotification } = useGlobalToast()

// State
const loading = ref(true)
const hasError = ref(false)
const isStockDialogVisible = ref(false)
const isClientDialogVisible = ref(false)
const selectedClient = ref({})
const isVehicleDialogVisible = ref(false)
const selectedVehicle = ref({})
const isMonthlySalesBreakdownOpen = ref(false)

const kpis = ref({
  total_clients: 0,
  total_vehicles: 0,
  low_stock_count: 0,
  low_stock_products: [],
  monthly_sales: 0,
  monthly_expenses: 0,
  monthly_balance: 0,
})

const topProducts = ref([])
const topPurchasedProducts = ref([])
const topSuppliers = ref([])
const cashFlow = ref([])


// Search Engine State & Watcher
const searchQuery = ref('')
const isSearchFocused = ref(false)
const searchResults = ref([])
const searchLoading = ref(false)
let debounceTimeout = null
let dashboardSearchAbortController = null

watch(searchQuery, newVal => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  if (dashboardSearchAbortController) {
    dashboardSearchAbortController.abort()
  }

  const query = (newVal || '').trim()
  if (query.length < 2) {
    searchResults.value = []

    return
  }

  debounceTimeout = setTimeout(async () => {
    dashboardSearchAbortController = new AbortController()
    try {
      searchLoading.value = true

      const response = await $api(`/dashboard/search?q=${encodeURIComponent(query)}`, {
        signal: dashboardSearchAbortController.signal,
      })
      if (response.status === 200) {
        searchResults.value = response.results || []
      }
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return
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

const handleResultClick = item => {
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

// Maintenance Events from Backend
const maintenanceEvents = ref([])
const isLoadingEvents = ref(false)
const selectedReminder = ref(null)
const isReminderDetailsOpen = ref(false)
const isSendingAction = ref(false)

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

const fetchCalendarEvents = async () => {
  try {
    isLoadingEvents.value = true
    const month = calendarDate.value.getMonth() + 1
    const year = calendarDate.value.getFullYear()

    const res = await $api('/maintenance-reminders/calendar', {
      params: { month, year },
    })

    maintenanceEvents.value = res.data || []
  } catch (err) {
    console.error('Error al cargar recordatorios de mantenimiento:', err)
  } finally {
    isLoadingEvents.value = false
  }
}

const calendarDays = computed(() => {
  const year = calendarDate.value.getFullYear()
  const month = calendarDate.value.getMonth()

  const firstDayIndex = new Date(year, month, 1).getDay()
  const lastDay = new Date(year, month + 1, 0).getDate()

  const today = new Date()
  const days = []

  // Padding for previous month days
  for (let i = 0; i < firstDayIndex; i++) {
    days.push({ day: '', isToday: false, isSelected: false, hasEvents: false, events: [] })
  }

  // Current month days
  for (let i = 1; i <= lastDay; i++) {
    const isToday = today.getDate() === i &&
      today.getMonth() === month &&
      today.getFullYear() === year

    const isSelected = selectedDay.value === i &&
      selectedMonth.value === month &&
      selectedYear.value === year

    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const dayEvents = maintenanceEvents.value.filter(evt => evt.scheduled_date === formattedDate)

    days.push({
      day: i,
      isToday,
      isSelected,
      hasEvents: dayEvents.length > 0,
      events: dayEvents,
    })
  }

  return days
})

const selectDayObj = dayObj => {
  if (!dayObj.day) return
  selectedDay.value = dayObj.day
  selectedMonth.value = calendarDate.value.getMonth()
  selectedYear.value = calendarDate.value.getFullYear()

  if (dayObj.events && dayObj.events.length > 0) {
    showNotification(`Mostrando ${dayObj.events.length} mantenimientos estimados para el ${dayObj.day} de este mes`, 'info')
  }
}

const activeEvents = computed(() => {
  if (calendarDate.value.getMonth() !== selectedMonth.value || calendarDate.value.getFullYear() !== selectedYear.value) {
    return []
  }

  const formattedDate = `${selectedYear.value}-${String(selectedMonth.value + 1).padStart(2, '0')}-${String(selectedDay.value).padStart(2, '0')}`
  return maintenanceEvents.value.filter(evt => evt.scheduled_date === formattedDate)
})

const formattedSelectedDate = computed(() => {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  return `${selectedDay.value} de ${months[selectedMonth.value]}`
})

// Trigger WhatsApp Direct Notification
const sendWhatsAppNotification = async reminder => {
  if (!reminder) return
  if (reminder.whatsapp_url) {
    window.open(reminder.whatsapp_url, '_blank')
    try {
      await $api(`/maintenance-reminders/${reminder.id}/notify`, {
        method: 'POST',
        body: { channel: 'whatsapp' },
      })
      showNotification('WhatsApp abierto y notificación registrada', 'success')
      fetchCalendarEvents()
    } catch (e) {
      console.error('Error al registrar notificación de WhatsApp:', e)
    }
  } else {
    showNotification('El cliente no posee un número de teléfono registrado', 'warning')
  }
}

// Trigger Email Notification
const sendEmailNotification = async reminder => {
  if (!reminder) return
  if (!reminder.client?.email) {
    showNotification('El cliente no posee un correo electrónico registrado', 'warning')
    return
  }

  try {
    isSendingAction.value = true
    await $api(`/maintenance-reminders/${reminder.id}/notify`, {
      method: 'POST',
      body: { channel: 'email' },
    })
    showNotification(`Correo electrónico de recordatorio enviado a ${reminder.client.email}`, 'success')
    fetchCalendarEvents()
  } catch (e) {
    console.error('Error al enviar correo de recordatorio:', e)
    showNotification('No se pudo enviar el correo de recordatorio', 'error')
  } finally {
    isSendingAction.value = false
  }
}

// Open Details Modal
const openReminderDetails = reminder => {
  selectedReminder.value = reminder
  isReminderDetailsOpen.value = true
}

// Update Reminder Status
const updateReminderStatus = async (reminder, newStatus) => {
  try {
    isSendingAction.value = true
    await $api(`/maintenance-reminders/${reminder.id}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
    showNotification(`Estado actualizado a: ${newStatus}`, 'success')
    isReminderDetailsOpen.value = false
    fetchCalendarEvents()
  } catch (e) {
    console.error('Error al actualizar estado:', e)
    showNotification('Error al actualizar estado del recordatorio', 'error')
  } finally {
    isSendingAction.value = false
  }
}

watch(calendarDate, () => {
  fetchCalendarEvents()
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
    hasError.value = false

    const response = await $api('/dashboard', { timeout: 10000 })
    if (response && response.status === 200) {
      kpis.value = response.data.kpis
      topProducts.value = response.data.top_products || []
      topPurchasedProducts.value = response.data.top_purchased_products || []
      topSuppliers.value = response.data.top_suppliers || []
      cashFlow.value = response.data.cash_flow || []
      hasError.value = false
    } else {
      hasError.value = true
      showNotification('Error al cargar datos del dashboard', 'error')
    }
  } catch (err) {
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      return
    }
    hasError.value = true
    console.error(err)
    showNotification('Ocurrió un error de red al consultar el dashboard', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
  fetchCalendarEvents()
})

// Formatting Helpers
const formatCurrency = val => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
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
      type: 'area',
      toolbar: { show: false },
      background: 'transparent',
    },
    colors: ['#7367F0', '#00CFE8'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.02,
        stops: [0, 95, 100],
      },
    },
    grid: {
      borderColor: chartThemes.value.borderColor,
      strokeDashArray: 4,
    },
    xaxis: {
      categories: cashFlow.value.map(item => item.month_name.substring(0, 3)),
      labels: { style: { colors: chartThemes.value.textColor, fontSize: '10px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: chartThemes.value.textColor, fontSize: '10px' },
        formatter: val => `$${Math.round(val)}`,
      },
    },
    tooltip: {
      theme: chartThemes.value.tooltipTheme,
      y: {
        formatter: val => `$${val.toFixed(2)}`,
      },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: chartThemes.value.textColor },
    },
  }
})

const wavyChartSeries = computed(() => {
  return [
    {
      name: 'Ingresos YTD',
      data: cashFlow.value.map(item => item.income),
    },
    {
      name: 'Egresos YTD',
      data: cashFlow.value.map(item => item.expense),
    },
  ]
})

// ApexChart: Radial Goal Gauge Options & Series
const radialChartOptions = computed(() => {
  return {
    chart: {
      type: 'radialBar',
      background: 'transparent',
    },
    plotOptions: {
      radialBar: {
        hollow: {
          size: '65%',
        },
        track: {
          background: chartThemes.value.borderColor,
          strokeWidth: '100%',
        },
        dataLabels: {
          name: {
            show: true,
            color: chartThemes.value.textColor,
            fontSize: '11px',
          },
          value: {
            show: true,
            color: theme.current.value.dark ? '#ffffff' : '#262B43',
            fontSize: '22px',
            fontWeight: 'bold',
            formatter: val => `${val}%`,
          },
        },
      },
    },
    colors: ['#7367F0'],
    stroke: {
      lineCap: 'round',
    },
    labels: ['Meta Alcanzada'],
  }
})

const radialChartSeries = computed(() => {
  return [salesTargetPercentage.value]
})

// ApexChart: Donut Chart for Income vs Expenses
const donutChartOptions = computed(() => {
  return {
    chart: { type: 'donut', background: 'transparent' },
    labels: ['Ingresos', 'Egresos'],
    colors: ['#00CFE8', '#7367F0'],
    plotOptions: { pie: { donut: { size: '70%' } } },
    dataLabels: { enabled: false },
    legend: { position: 'bottom', labels: { colors: chartThemes.value.textColor } },
    stroke: { show: false },
  }
})

const donutChartSeries = computed(() => {
  return [Number(kpis.value.monthly_sales) || 0, Number(kpis.value.monthly_expenses) || 0]
})

// ApexChart: Bar Chart for Top 5 Products
const barChartOptions = computed(() => {
  return {
    chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
    colors: ['#7367F0', '#00CFE8', '#28C76F', '#FF9F43', '#EA5455'],
    plotOptions: { bar: { borderRadius: 4, horizontal: true, distributed: true } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: topProducts.value.slice(0, 5).map(p => {
        const desc = p.description || ''

        return desc.length > 20 ? desc.substring(0, 20) + '...' : desc
      }),
      labels: { style: { colors: chartThemes.value.textColor } },
      axisBorder: { show: false },
    },
    yaxis: {
      labels: { style: { colors: chartThemes.value.textColor } },
    },
    grid: {
      borderColor: chartThemes.value.borderColor,
      strokeDashArray: 4,
    },
    tooltip: { theme: chartThemes.value.tooltipTheme },
  }
})

const barChartSeries = computed(() => {
  return [{
    name: 'Unidades Vendidas',
    data: topProducts.value.slice(0, 5).map(p => Number(p.total_quantity) || 0),
  }]
})

// =======================================================
// PASTEL DE PRODUCTOS MÁS COMPRADOS A PROVEEDORES
// =======================================================
const purchasedProductsSeries = computed(() => {
  if (!topPurchasedProducts.value || topPurchasedProducts.value.length === 0) return []
  return topPurchasedProducts.value.map(p => Number(p.total_quantity) || 0)
})

const purchasedProductsOptions = computed(() => {
  const labels = topPurchasedProducts.value.map(p => {
    const desc = p.description || 'Producto'
    return desc.length > 25 ? desc.substring(0, 25) + '...' : desc
  })

  return {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    labels: labels.length > 0 ? labels : ['Sin datos'],
    colors: ['#7367F0', '#00CFE8', '#28C76F', '#FF9F43', '#EA5455', '#A8AAAE'],
    dataLabels: {
      enabled: true,
      formatter: (val) => `${Math.round(val)}%`,
      style: {
        fontSize: '11px',
        fontWeight: 'bold',
      },
      dropShadow: { enabled: false },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '62%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total Unidades',
              fontSize: '11px',
              color: chartThemes.value.textColor,
              formatter: () => {
                const totalQty = topPurchasedProducts.value.reduce((acc, p) => acc + Number(p.total_quantity || 0), 0)
                return `${Math.round(totalQty)} u.`
              },
            },
            value: {
              fontSize: '18px',
              fontWeight: 'bold',
              color: theme.current.value.dark ? '#ffffff' : '#262B43',
            },
          },
        },
      },
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      labels: { colors: chartThemes.value.textColor },
      fontSize: '11px',
    },
    stroke: { show: false },
    tooltip: {
      theme: chartThemes.value.tooltipTheme,
      y: {
        formatter: (val, opts) => {
          const item = topPurchasedProducts.value[opts.seriesIndex]
          if (item && item.total_spent) {
            return `${Number(val).toLocaleString()} u. (Total: ${formatCurrency(item.total_spent)})`
          }
          return `${Number(val).toLocaleString()} unidades`
        },
      },
    },
  }
})

// =======================================================
// REPORTE DE ÓRDENES DE TRABAJO (100% Real de Base de Datos)
// =======================================================

const workOrdersReport = computed(() => kpis.value?.work_orders_report || {
  ot_totales: [],
  sla: [],
  technicians: {},
})

const otTotalesSeries = computed(() => {
  return workOrdersReport.value.ot_totales.map(i => i.count)
})

const otTotalesOptions = computed(() => {
  const labels = workOrdersReport.value.ot_totales.map(i => i.status)

  return {
    chart: { type: 'donut', background: 'transparent' },
    labels: labels.length > 0 ? labels : ['Sin datos'],
    colors: ['#00CFE8', '#28C76F', '#FF9F43', '#EA5455', '#7367F0'],
    dataLabels: { enabled: true, style: { fontSize: '10px' } },
    plotOptions: { pie: { donut: { size: '55%' } } },
    legend: { position: 'right', labels: { colors: chartThemes.value.textColor } },
    stroke: { show: false },
  }
})

const slaSeries = computed(() => {
  if (!workOrdersReport.value.sla) return []

  return Object.values(workOrdersReport.value.sla)
})

const slaOptions = computed(() => {
  const labels = Object.keys(workOrdersReport.value.sla || {})

  return {
    chart: { type: 'pie', background: 'transparent' },
    labels: labels.length > 0 ? labels : ['1 día', '2-3 días', '4-7 días', '+8 días'],
    colors: ['#28C76F', '#FF9F43', '#EA5455', '#7367F0'],
    dataLabels: { enabled: true },
    legend: { position: 'right', labels: { colors: chartThemes.value.textColor } },
    stroke: { show: false },
  }
})

const tecnicosSeries = computed(() => {
  const techs = workOrdersReport.value.technicians || {}
  const statusSet = new Set()

  Object.values(techs).forEach(t => {
    Object.keys(t).forEach(status => statusSet.add(status))
  })

  const statuses = Array.from(statusSet)
  if (statuses.length === 0) return []

  return statuses.map(status => {
    return {
      name: status,
      data: Object.keys(techs).map(techName => techs[techName][status] || 0),
    }
  })
})

const tecnicosOptions = computed(() => {
  const techs = workOrdersReport.value.technicians || {}
  const categories = Object.keys(techs)

  return {
    chart: { type: 'bar', stacked: false, background: 'transparent', toolbar: { show: false } },
    colors: ['#00CFE8', '#28C76F', '#FF9F43', '#EA5455', '#7367F0'],
    xaxis: {
      categories: categories.length > 0 ? categories : ['Sin datos'],
      labels: { style: { colors: chartThemes.value.textColor } },
      axisBorder: { show: false },
    },
    yaxis: { labels: { style: { colors: chartThemes.value.textColor } } },
    legend: { position: 'top', labels: { colors: chartThemes.value.textColor } },
    grid: { borderColor: chartThemes.value.borderColor, strokeDashArray: 4 },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
  }
})
</script>

<template>
  <VContainer
    fluid
    class="pa-6 dashboard-container"
  >
    <!-- Header glowing ambient background -->
    <div class="dashboard-header-glow" />

    <!-- Header (Mockup Style layout using system colors) -->
    <div
      class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 position-relative border-b pb-4 gap-4"
      style="z-index: 10; border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
    >
      <div>
        <h1
          class="text-h4 font-weight-bold text-high-emphasis mb-1"
          style="letter-spacing: 0.5px;"
        >
          <span class="gradient-title">DASHBOARD</span>
          <span
            style="font-size: 1.1rem;"
            class="font-weight-medium text-medium-emphasis"
          >/ ADMIN PANEL</span>
        </h1>
        <p class="text-caption text-medium-emphasis mb-0">
          Gestión Automotriz - Rendimiento y Balance de Operaciones
        </p>
      </div>

      <!-- Search & quick action shortcuts -->
      <div class="d-flex flex-wrap align-center gap-3 w-100 w-md-auto">
        <div
          style="min-width: 220px; flex: 1 1 auto; position: relative;"
          class="d-none d-sm-block"
        >
          <VTextField
            v-model="searchQuery"
            density="compact"
            placeholder="Buscar cliente, auto, SKU..."
            variant="solo"
            hide-details
            :loading="searchLoading"
            class="rounded-xl search-field"
            style="box-shadow: 0 4px 15px rgba(var(--v-theme-primary), 0.1) !important;"
            @focus="isSearchFocused = true"
            @blur="handleSearchBlur"
          >
            <template #prepend-inner>
              <VProgressCircular v-if="searchLoading" indeterminate color="primary" size="18" width="2" class="me-1" />
              <VIcon v-else icon="ri-search-line" />
            </template>
          </VTextField>

          <!-- Floating search results drop panel -->
          <VCard
            v-if="searchQuery && isSearchFocused"
            elevation="8"
            class="position-absolute mt-1 pa-1 rounded-xl search-results-dropdown"
            style="width: 300px; right: 0; z-index: 100; max-height: 250px; overflow-y: auto; background-color: rgb(var(--v-theme-surface)) !important; border: 1px solid rgba(var(--v-theme-on-surface), 0.12) !important;"
          >
            <div
              v-if="searchLoading"
              class="text-caption text-medium-emphasis text-center py-4 d-flex align-center justify-center gap-2"
            >
              <VProgressCircular
                indeterminate
                size="16"
                width="2"
                color="primary"
              />
              <span>Buscando en BD...</span>
            </div>
            <div
              v-else-if="searchResults.length === 0"
              class="text-caption text-medium-emphasis text-center py-4"
            >
              Sin coincidencias encontradas
            </div>
            <div v-else>
              <div
                v-for="(res, idx) in searchResults"
                :key="idx"
                class="search-result-item pa-2 rounded-lg cursor-pointer d-flex flex-column"
                @mousedown="handleResultClick(res)"
              >
                <div class="d-flex justify-space-between align-center">
                  <span class="font-weight-bold text-caption text-high-emphasis">{{ res.name }}</span>
                  <VChip
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="font-weight-bold"
                  >
                    {{ res.type }}
                  </VChip>
                </div>
                <span
                  class="text-grey"
                  style="font-size: 0.65rem;"
                >{{ res.detail }}</span>
              </div>
            </div>
          </VCard>
        </div>

        <!-- Quick actions buttons -->
        <div class="d-flex gap-2">
          <VTooltip
            text="Nueva Orden de Trabajo"
            location="bottom"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="ri-tools-line"
                variant="elevated"
                size="small"
                class="rounded-lg text-white"
                style="background: linear-gradient(135deg, #7367F0 0%, #CE9FFC 100%); box-shadow: 0 4px 10px rgba(115, 103, 240, 0.3) !important;"
                @click="router.push('/work-orders/add')"
              />
            </template>
          </VTooltip>
          <VTooltip
            text="Registrar Venta"
            location="bottom"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="ri-money-dollar-box-line"
                variant="elevated"
                size="small"
                class="rounded-lg text-white"
                style="background: linear-gradient(135deg, #00CFE8 0%, #1A2980 100%); box-shadow: 0 4px 10px rgba(0, 207, 232, 0.3) !important;"
                @click="router.push('/sales/add')"
              />
            </template>
          </VTooltip>
          <VTooltip
            text="Ingresar Compra"
            location="bottom"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="ri-shopping-cart-2-line"
                variant="elevated"
                size="small"
                class="rounded-lg text-white"
                style="background: linear-gradient(135deg, #28C76F 0%, #81FBB8 100%); box-shadow: 0 4px 10px rgba(40, 199, 111, 0.3) !important;"
                @click="router.push('/invoice/manual-purchase')"
              />
            </template>
          </VTooltip>
          <VTooltip
            text="Kardex"
            location="bottom"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="ri-exchange-funds-line"
                variant="elevated"
                size="small"
                class="rounded-lg text-white"
                style="background: linear-gradient(135deg, #FF9F43 0%, #FF5A5F 100%); box-shadow: 0 4px 10px rgba(255, 159, 67, 0.3) !important;"
                @click="router.push('/kardex')"
              />
            </template>
          </VTooltip>
        </div>

        <VBtn
          prepend-icon="ri-bar-chart-grouped-line"
          variant="elevated"
          class="rounded-xl px-4 text-white font-weight-bold"
          style="background: linear-gradient(135deg, #7367F0 0%, #9E95F5 100%); box-shadow: 0 6px 15px rgba(115, 103, 240, 0.3) !important; letter-spacing: 0.3px;"
          @click="isMonthlySalesBreakdownOpen = true"
        >
          Ranking Ventas
        </VBtn>

        <VBtn
          prepend-icon="ri-refresh-line"
          variant="elevated"
          :loading="loading"
          class="rounded-xl px-4 text-white font-weight-bold"
          style="background: linear-gradient(135deg, #EA5455 0%, #FEB692 100%); box-shadow: 0 6px 15px rgba(234, 84, 85, 0.3) !important; letter-spacing: 0.5px;"
          @click="fetchDashboardData"
        >
          Actualizar
        </VBtn>
      </div>
    </div>

    <!-- Spinner Loader -->
    <div
      v-if="loading"
      class="d-flex justify-center align-center py-12 my-12"
    >
      <VProgressCircular
        indeterminate
        color="primary"
        size="64"
        width="6"
      />
    </div>

    <!-- Error State -->
    <div
      v-else-if="hasError"
      class="d-flex flex-column align-center justify-center py-12 my-12 text-center"
      style="max-width: 500px; margin: 0 auto;"
    >
      <VIcon
        icon="ri-error-warning-line"
        size="64"
        color="error"
        class="mb-4"
      />
      <h3 class="text-h5 font-weight-bold mb-2 text-high-emphasis">
        Error al cargar el Dashboard
      </h3>
      <p class="text-body-2 text-medium-emphasis mb-6">
        No se pudieron obtener los datos actualizados del servidor. Por favor, verifica tu conexión o vuelve a
        intentarlo.
      </p>
      <VBtn
        color="primary"
        prepend-icon="ri-refresh-line"
        class="rounded-xl px-6"
        @click="fetchDashboardData"
      >
        Reintentar cargar
      </VBtn>
    </div>

    <div
      v-else
      class="position-relative"
      style="z-index: 1;"
    >
      <!-- KPIs Section (Matching Mockup layout with system color cards) -->
      <VRow class="mb-6">
        <!-- KPI 1: Clientes -->
        <VCol
          cols="12"
          sm="6"
          md="3"
        >
          <VCard
            elevation="0"
            class="pa-6 mock-card mock-card-gradient-1 h-100 d-flex flex-column justify-center align-center text-center"
          >
            <VIcon
              icon="ri-group-line"
              size="48"
              class="mb-3 text-white"
              style="opacity: 0.9;"
            />
            <div class="text-h3 font-weight-black text-white mb-2">
              {{ kpis.total_clients }}
            </div>
            <div class="text-subtitle-2 text-white font-weight-bold text-uppercase mb-0">
              Clientes Registrados
            </div>
          </VCard>
        </VCol>

        <!-- KPI 2: Vehículos -->
        <VCol
          cols="12"
          sm="6"
          md="3"
        >
          <VCard
            elevation="0"
            class="pa-6 mock-card mock-card-gradient-4 h-100 d-flex flex-column justify-center align-center text-center"
          >
            <VIcon
              icon="ri-car-line"
              size="48"
              class="mb-3 text-white"
              style="opacity: 0.9;"
            />
            <div class="text-h3 font-weight-black text-white mb-2">
              {{ kpis.total_vehicles }}
            </div>
            <div class="text-subtitle-2 text-white font-weight-bold text-uppercase mb-0">
              Vehículos Asociados
            </div>
          </VCard>
        </VCol>

        <!-- KPI 3: Balance -->
        <VCol
          cols="12"
          sm="6"
          md="3"
        >
          <VCard
            elevation="0"
            class="pa-6 mock-card mock-card-gradient-2 h-100 d-flex flex-column justify-center align-center text-center"
          >
            <VIcon
              icon="ri-wallet-3-line"
              size="48"
              class="mb-3 text-white"
              style="opacity: 0.9;"
            />
            <div class="text-h4 font-weight-black text-white mb-2">
              {{ formatCurrency(kpis.monthly_balance) }}
            </div>
            <div class="text-subtitle-2 text-white font-weight-bold text-uppercase mb-1">
              Balance Mensual
            </div>
            <div
              class="text-caption text-white"
              style="opacity: 0.9; line-height: 1.2;"
            >
              VENTAS: {{ formatCurrency(kpis.monthly_sales) }}<br>GASTOS: {{ formatCurrency(kpis.monthly_expenses) }}
            </div>
          </VCard>
        </VCol>

        <!-- KPI 4: Stock Alert -->
        <VCol
          cols="12"
          sm="6"
          md="3"
        >
          <VCard
            elevation="0"
            class="pa-6 mock-card mock-card-gradient-3 h-100 d-flex flex-column justify-center align-center text-center cursor-pointer"
            @click="isStockDialogVisible = true"
          >
            <VIcon
              icon="ri-alert-line"
              size="48"
              class="mb-3 text-white"
              style="opacity: 0.9;"
            />
            <div class="text-h3 font-weight-black text-white mb-2">
              {{ kpis.low_stock_count }}
            </div>
            <div class="text-subtitle-2 text-white font-weight-bold text-uppercase mb-1">
              Stock Mínimo
            </div>
            <div
              class="text-caption text-white"
              style="opacity: 0.9;"
            >
              Alerta de productos
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Middle Section (Calendar & Wavy Chart) -->
      <VRow class="mb-6">
        <!-- Column 1: Calendar -->
        <VCol
          cols="12"
          md="4"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100 d-flex flex-column"
          >
            <div
              class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-4 border-b pb-2 d-flex align-center justify-space-between"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
            >
              <div class="d-flex align-center gap-2">
                <VIcon icon="ri-calendar-todo-line" />
                <span>Mantenimiento Preventivo</span>
              </div>
              <VProgressCircular
                v-if="isLoadingEvents"
                indeterminate
                size="16"
                width="2"
                color="primary"
              />
            </div>

            <div class="calendar-widget">
              <div class="d-flex justify-space-between align-center mb-4">
                <VIcon
                  icon="ri-arrow-left-s-line"
                  class="cursor-pointer text-primary"
                  @click="prevMonth"
                />
                <span class="font-weight-bold text-primary text-uppercase text-caption">{{ currentMonthName }}</span>
                <VIcon
                  icon="ri-arrow-right-s-line"
                  class="cursor-pointer text-primary"
                  @click="nextMonth"
                />
              </div>
              <div class="calendar-grid">
                <div
                  v-for="w in daysOfWeek"
                  :key="w"
                  class="calendar-header-day"
                >
                  {{ w }}
                </div>
                <div
                  v-for="(dayObj, idx) in calendarDays"
                  :key="idx"
                  class="calendar-day position-relative"
                  :class="{
                    'is-today': dayObj.isToday,
                    'is-selected': dayObj.isSelected && !dayObj.isToday,
                    'is-empty': !dayObj.day
                  }"
                  @click="selectDayObj(dayObj)"
                >
                  <span>{{ dayObj.day }}</span>
                  <!-- Indicadores de eventos de mantenimiento -->
                  <div
                    v-if="dayObj.hasEvents"
                    class="d-flex justify-center gap-1 position-absolute"
                    style="bottom: 2px; left: 0; right: 0;"
                  >
                    <span
                      v-for="(evt, eIdx) in dayObj.events.slice(0, 3)"
                      :key="eIdx"
                      class="rounded-circle"
                      :style="{
                        width: '5px',
                        height: '5px',
                        backgroundColor: evt.category_color === 'error' ? '#EA5455' :
                          (evt.category_color === 'warning' ? '#FF9F43' :
                          (evt.category_color === 'success' ? '#28C76F' :
                          (evt.category_color === 'info' ? '#00CFE8' :
                          (evt.category_color === 'deep-purple' ? '#7367F0' : '#7367F0'))))
                      }"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Calendar Agenda Timeline Feed -->
            <div
              class="mt-4 pt-3 border-t flex-grow-1"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
            >
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-caption font-weight-bold text-primary text-uppercase">Agenda: {{ formattedSelectedDate }}</span>
                <VChip
                  v-if="activeEvents.length > 0"
                  size="x-small"
                  color="primary"
                  class="font-weight-black"
                >
                  {{ activeEvents.length }} servicio{{ activeEvents.length > 1 ? 's' : '' }}
                </VChip>
              </div>

              <div
                v-if="activeEvents.length === 0"
                class="text-caption text-medium-emphasis text-center py-4 d-flex flex-column align-center justify-center"
              >
                <VIcon icon="ri-calendar-check-line" size="28" color="grey" class="mb-1" />
                <span>Sin servicios proyectados para este día</span>
              </div>
              <div
                v-else
                class="d-flex flex-column gap-2"
                style="max-height: 230px; overflow-y: auto;"
              >
                <div
                  v-for="evt in activeEvents"
                  :key="evt.id"
                  class="d-flex justify-space-between align-center pa-2 rounded-lg elevation-1"
                  style="background-color: rgba(var(--v-theme-surface), 1); border: 1px solid rgba(var(--v-theme-on-surface), 0.08); border-left: 4px solid;"
                  :style="{ borderLeftColor: evt.category_color === 'error' ? '#EA5455' : (evt.category_color === 'warning' ? '#FF9F43' : (evt.category_color === 'success' ? '#28C76F' : (evt.category_color === 'deep-purple' ? '#7367F0' : '#7367F0'))) }"
                >
                  <div
                    class="overflow-hidden cursor-pointer"
                    style="max-width: 60%;"
                    @click="openReminderDetails(evt)"
                  >
                    <div class="font-weight-bold text-caption text-high-emphasis d-flex align-center gap-1 text-truncate">
                      <VIcon :icon="evt.category_icon" size="14" :color="evt.category_color" />
                      <span class="text-truncate">{{ evt.vehicle?.license_plate || 'Vehículo' }} • {{ evt.vehicle?.model || '' }}</span>
                    </div>
                    <div
                      class="text-medium-emphasis text-truncate d-flex align-center gap-1"
                      style="font-size: 0.68rem;"
                    >
                      <span class="font-weight-bold text-primary">{{ Number(evt.target_mileage).toLocaleString() }} KM</span>
                      <span>-</span>
                      <span class="text-truncate">{{ evt.client?.full_name || 'Cliente' }}</span>
                    </div>
                  </div>

                  <div class="d-flex align-center gap-1">
                    <!-- Botón WhatsApp -->
                    <VBtn
                      icon="ri-whatsapp-line"
                      size="x-small"
                      color="success"
                      variant="tonal"
                      title="Enviar recordatorio por WhatsApp"
                      @click.stop="sendWhatsAppNotification(evt)"
                    />

                    <!-- Botón Correo -->
                    <VBtn
                      icon="ri-mail-send-line"
                      size="x-small"
                      color="primary"
                      variant="tonal"
                      :loading="isSendingAction"
                      title="Enviar recordatorio por Correo"
                      @click.stop="sendEmailNotification(evt)"
                    />

                    <!-- Botón Ver Detalles -->
                    <VBtn
                      icon="ri-eye-line"
                      size="x-small"
                      color="secondary"
                      variant="text"
                      title="Ver detalles"
                      @click.stop="openReminderDetails(evt)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Column 2: Wavy double area chart -->
        <VCol
          cols="12"
          md="8"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100"
          >
            <div
              class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-4 border-b pb-2 d-flex align-center gap-2"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
            >
              <VIcon icon="ri-line-chart-line" />
              <span>Flujo de Caja YTD (Ingresos vs Egresos)</span>
            </div>
            <div class="pa-2">
              <VueApexCharts
                type="area"
                height="325"
                :options="wavyChartOptions"
                :series="wavyChartSeries"
              />
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Extra Charts Section (Donut & Bar Chart) -->
      <VRow class="mb-6">
        <!-- Donut Chart: Ingresos vs Egresos -->
        <VCol
          cols="12"
          md="4"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100 d-flex flex-column"
          >
            <div
              class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-4 border-b pb-2 d-flex align-center gap-2"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
            >
              <VIcon icon="ri-pie-chart-2-line" />
              <span>Distribución Financiera Mensual</span>
            </div>
            <div class="pa-2 d-flex justify-center align-center flex-grow-1">
              <VueApexCharts
                type="donut"
                height="250"
                :options="donutChartOptions"
                :series="donutChartSeries"
              />
            </div>
          </VCard>
        </VCol>

        <!-- Bar Chart: Top 5 Productos -->
        <VCol
          cols="12"
          md="8"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100"
          >
            <div
              class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-4 border-b pb-2 d-flex justify-space-between align-center flex-wrap gap-2"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
            >
              <div class="d-flex align-center gap-2">
                <VIcon icon="ri-bar-chart-horizontal-line" />
                <span>Top 5 Productos Vendidos (Unidades)</span>
              </div>
              <VBtn
                size="x-small"
                variant="tonal"
                color="primary"
                class="font-weight-bold text-none"
                prepend-icon="ri-list-ordered"
                @click="isMonthlySalesBreakdownOpen = true"
              >
                Ver Ranking Completo
              </VBtn>
            </div>
            <div class="pa-2">
              <VueApexCharts
                type="bar"
                height="250"
                :options="barChartOptions"
                :series="barChartSeries"
              />
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Bottom Section (Feed list, progress meters, radial chart) -->
      <VRow class="mb-6">
        <!-- Feed Card: Top Sold Products -->
        <VCol
          cols="12"
          md="4"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100 d-flex flex-column justify-space-between"
          >
            <div>
              <div
                class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-4 border-b pb-2 d-flex justify-space-between align-center flex-wrap gap-2"
                style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
              >
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-star-line" />
                  <span>Productos Más Vendidos</span>
                </div>
                <VBtn
                  size="x-small"
                  variant="text"
                  color="primary"
                  class="font-weight-bold pa-0 text-none"
                  @click="isMonthlySalesBreakdownOpen = true"
                >
                  Ver todos
                </VBtn>
              </div>
              <div
                v-if="topProducts.length === 0"
                class="text-center py-6 text-medium-emphasis"
              >
                Sin registros de ventas en el mes.
              </div>
              <div v-else>
                <div
                  v-for="(prod, idx) in topProducts.slice(0, 3)"
                  :key="idx"
                  class="mb-4"
                >
                  <div class="d-flex justify-space-between align-center">
                    <span
                      class="font-weight-bold text-uppercase text-caption text-primary text-truncate"
                      style="max-width: 70%;"
                    >{{ prod.description }}</span>
                    <span class="text-caption font-weight-bold text-high-emphasis">{{
                      Number(prod.total_quantity).toLocaleString() }} u.</span>
                  </div>
                  <p
                    class="text-caption text-medium-emphasis mb-0"
                    style="font-size: 0.75rem;"
                  >
                    Monto mensual: {{
                      formatCurrency(prod.total_revenue) }}
                  </p>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Progress Meters Card -->
        <VCol
          cols="12"
          md="4"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100"
          >
            <div
              class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-4 border-b pb-2 d-flex align-center gap-2"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
            >
              <VIcon icon="ri-bar-chart-fill" />
              <span>Rendimiento Operativo</span>
            </div>

            <div class="d-flex flex-column gap-5 mt-2">
              <div>
                <div class="d-flex justify-space-between text-caption mb-1">
                  <span class="font-weight-bold">Eficiencia del Balance</span>
                  <span class="text-primary font-weight-bold">{{ balancePercentage }}%</span>
                </div>
                <VProgressLinear
                  v-model="balancePercentage"
                  color="#7367F0"
                  height="8"
                  class="rounded"
                />
              </div>

              <div>
                <div class="d-flex justify-space-between text-caption mb-1">
                  <span class="font-weight-bold">Registro de Clientes (Meta 100)</span>
                  <span class="text-primary font-weight-bold">{{ clientsPercentage }}%</span>
                </div>
                <VProgressLinear
                  v-model="clientsPercentage"
                  color="#00CFE8"
                  height="8"
                  class="rounded"
                />
              </div>

              <div>
                <div class="d-flex justify-space-between text-caption mb-1">
                  <span class="font-weight-bold">Vehículos Registrados (Meta 150)</span>
                  <span class="text-primary font-weight-bold">{{ vehiclesPercentage }}%</span>
                </div>
                <VProgressLinear
                  v-model="vehiclesPercentage"
                  color="#28C76F"
                  height="8"
                  class="rounded"
                />
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Radial Chart Card -->
        <VCol
          cols="12"
          md="4"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100 d-flex flex-column justify-space-between align-center"
          >
            <div class="w-100">
              <div
                class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-2 border-b pb-2 d-flex align-center gap-2 w-100"
                style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
              >
                <VIcon icon="ri-radar-line" />
                <span>Progreso de Meta Mensual</span>
              </div>
            </div>

            <div
              class="d-flex justify-center align-center"
              style="height: 180px; width: 100%;"
            >
              <VueApexCharts
                type="radialBar"
                height="200"
                width="100%"
                :options="radialChartOptions"
                :series="radialChartSeries"
              />
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- SECCIÓN: GESTIÓN DE COMPRAS Y PROVEEDORES -->
      <div class="mt-8 mb-4">
        <div class="d-flex justify-space-between align-center flex-wrap gap-2">
          <div>
            <h2 class="text-h5 font-weight-bold text-high-emphasis d-flex align-center gap-2">
              <VIcon
                icon="ri-truck-line"
                color="primary"
              />
              Compras a Proveedores & Repuestos Adquiridos
            </h2>
            <p class="text-caption text-medium-emphasis mb-0">
              Proveedores con mayor facturación y distribución de productos más comprados
            </p>
          </div>
          <div class="d-flex gap-2">
            <VBtn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="ri-exchange-dollar-line"
              to="/invoice/reconciliation"
              class="font-weight-bold"
            >
              Conciliación
            </VBtn>
            <VBtn
              size="small"
              variant="elevated"
              color="primary"
              prepend-icon="ri-file-list-3-line"
              to="/invoice/list"
              class="font-weight-bold"
            >
              Ver Compras
            </VBtn>
          </div>
        </div>
      </div>

      <VRow class="mb-6">
        <!-- Top Proveedores a los que más se les ha comprado -->
        <VCol
          cols="12"
          lg="7"
        >
          <VCard
            elevation="0"
            class="pa-5 mock-card h-100 d-flex flex-column justify-space-between"
          >
            <div>
              <div
                class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-4 border-b pb-3 d-flex justify-space-between align-center flex-wrap gap-2"
                style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
              >
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-store-3-line" />
                  <span>Top Proveedores con Mayor Facturación</span>
                </div>
                <VChip
                  size="small"
                  color="primary"
                  variant="tonal"
                  class="font-weight-bold"
                >
                  Total: {{ formatCurrency(kpis.total_purchases_spent) }}
                </VChip>
              </div>

              <div
                v-if="topSuppliers.length === 0"
                class="text-center py-8 text-medium-emphasis"
              >
                <VIcon icon="ri-inbox-line" size="40" class="mb-2 text-disabled" />
                <p class="text-caption mb-0">Sin compras registradas aún en el sistema.</p>
              </div>

              <div
                v-else
                class="d-flex flex-column gap-3"
              >
                <div
                  v-for="(sup, idx) in topSuppliers"
                  :key="sup.id"
                  class="pa-3 rounded-xl border d-flex align-center justify-space-between flex-wrap gap-3 transition-all hover-elevate"
                  style="background-color: rgba(var(--v-theme-surface), 1); border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
                >
                  <!-- Rank + Info -->
                  <div class="d-flex align-center gap-3 flex-grow-1" style="min-width: 220px;">
                    <div
                      class="supplier-rank-badge font-weight-black"
                      :class="`rank-${idx + 1}`"
                    >
                      #{{ idx + 1 }}
                    </div>

                    <div class="overflow-hidden" style="max-width: 280px;">
                      <div class="font-weight-bold text-subtitle-2 text-high-emphasis text-truncate" :title="sup.name">
                        {{ sup.name }}
                      </div>
                      <div class="text-caption text-medium-emphasis d-flex align-center gap-2 mt-0.5">
                        <span v-if="sup.ruc">RUC: <code class="text-primary">{{ sup.ruc }}</code></span>
                        <span v-if="sup.last_purchase">• Última: {{ sup.last_purchase }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Invoices Count & Total -->
                  <div class="d-flex align-center justify-space-between justify-sm-end gap-4" style="min-width: 200px;">
                    <VChip
                      size="x-small"
                      color="secondary"
                      variant="tonal"
                      class="font-weight-medium"
                    >
                      {{ sup.invoices_count }} {{ sup.invoices_count === 1 ? 'factura' : 'facturas' }}
                    </VChip>

                    <div class="text-right" style="min-width: 110px;">
                      <div class="font-weight-black text-subtitle-1 text-high-emphasis font-mono">
                        {{ formatCurrency(sup.total) }}
                      </div>
                      <div class="d-flex align-center justify-end gap-1 text-caption text-medium-emphasis">
                        <span class="font-weight-bold text-primary">{{ sup.percentage }}%</span>
                        <span>del total</span>
                      </div>
                    </div>
                  </div>

                  <!-- Progress Linear -->
                  <div class="w-100 mt-1">
                    <VProgressLinear
                      :model-value="sup.percentage"
                      :color="idx === 0 ? '#7367F0' : (idx === 1 ? '#00CFE8' : (idx === 2 ? '#28C76F' : '#FF9F43'))"
                      height="5"
                      rounded
                    />
                  </div>
                </div>
              </div>
            </div>
          </VCard>
        </VCol>

        <!-- Pastel del Producto Más Comprado -->
        <VCol
          cols="12"
          lg="5"
        >
          <VCard
            elevation="0"
            class="pa-5 mock-card h-100 d-flex flex-column justify-space-between"
          >
            <div>
              <div
                class="text-subtitle-2 font-weight-bold text-uppercase gradient-title mb-4 border-b pb-3 d-flex align-center gap-2"
                style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
              >
                <VIcon icon="ri-pie-chart-line" />
                <span>Productos Más Comprados a Proveedores</span>
              </div>
              <p class="text-caption text-medium-emphasis mb-2">
                Distribución por unidades adquiridas según facturas de compra
              </p>

              <div
                v-if="topPurchasedProducts.length === 0"
                class="text-center py-10 text-medium-emphasis"
              >
                <VIcon icon="ri-pie-chart-2-line" size="48" class="mb-2 text-disabled" />
                <p class="text-caption mb-0">Sin ítems de compras procesados aún.</p>
              </div>

              <div
                v-else
                class="pa-2 d-flex justify-center align-center"
              >
                <VueApexCharts
                  type="donut"
                  height="330"
                  width="100%"
                  :options="purchasedProductsOptions"
                  :series="purchasedProductsSeries"
                />
              </div>
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- Panel de Rendimiento de Taller (Órdenes de Trabajo) -->
      <div class="mt-8 mb-4">
        <h2 class="text-h5 font-weight-bold text-high-emphasis d-flex align-center gap-2">
          <VIcon
            icon="ri-tools-fill"
            color="primary"
          />
          Rendimiento Operativo de Taller - Basado en OTs
        </h2>
        <p class="text-caption text-medium-emphasis">
          Métricas de órdenes de trabajo y rendimiento del personal técnico
        </p>
      </div>

      <VRow class="mb-6">
        <!-- OT Totales -->
        <VCol
          cols="12"
          md="6"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100"
          >
            <div class="text-subtitle-2 font-weight-bold text-medium-emphasis mb-1">
              OTs Totales por Estado
            </div>
            <div class="text-h4 font-weight-black text-high-emphasis mb-4">
              {{ otTotalesSeries.reduce((a, b) => a + b, 0) }} órdenes
            </div>
            <div class="pa-2 d-flex justify-center align-center">
              <VueApexCharts
                type="donut"
                height="240"
                width="100%"
                :options="otTotalesOptions"
                :series="otTotalesSeries"
              />
            </div>
          </VCard>
        </VCol>

        <!-- SLA -->
        <VCol
          cols="12"
          md="6"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100"
          >
            <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-1">
              SLA de Cierre de Órdenes
            </div>
            <div class="text-caption text-medium-emphasis mb-4">
              Tiempo en días hasta que la OT queda como Cerrada / Finalizada
            </div>
            <div class="pa-2 d-flex justify-center align-center mt-2">
              <VueApexCharts
                type="pie"
                height="240"
                width="100%"
                :options="slaOptions"
                :series="slaSeries"
              />
            </div>
          </VCard>
        </VCol>

        <!-- Cant de Servicios por Técnico -->
        <VCol
          cols="12"
        >
          <VCard
            elevation="0"
            class="pa-4 mock-card h-100"
          >
            <div class="text-subtitle-2 font-weight-bold text-medium-emphasis mb-4">
              Cantidad de Servicios Asignados por Técnico
            </div>
            <div class="pa-2">
              <VueApexCharts
                type="bar"
                height="300"
                width="100%"
                :options="tecnicosOptions"
                :series="tecnicosSeries"
              />
            </div>
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- Low Stock Alert Dialog -->
    <VDialog
      v-model="isStockDialogVisible"
      max-width="700"
      scrollable
    >
      <VCard class="custom-dialog-card elevation-24">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isStockDialogVisible = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-alert-line" />
          </div>
          <h3 class="custom-dialog-title">
            Productos Bajo Stock Mínimo
          </h3>
          <p class="custom-dialog-subtitle">
            Artículos del inventario que requieren reabastecimiento urgente
          </p>
        </div>

        <VCardText class="pa-6 pa-sm-8">
          <template v-if="kpis.low_stock_products?.length === 0">
            <div class="text-center py-6 text-medium-emphasis">
              ¡Excelente! No hay productos con stock menor o igual al mínimo.
            </div>
          </template>
          <template v-else>
            <div
              v-for="item in kpis.low_stock_products"
              :key="item.id"
              class="d-flex align-center justify-space-between mb-3 py-3 border-b"
              style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
            >
              <div class="d-flex align-center gap-3">
                <VAvatar
                  color="error"
                  variant="tonal"
                  rounded="lg"
                >
                  <VIcon icon="ri-error-warning-line" />
                </VAvatar>
                <div>
                  <div class="font-weight-bold text-high-emphasis">
                    {{ item.description }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    <code class="text-primary bg-primary-lighten-5 px-1 rounded">{{ item.sku || 'N/A' }}</code>
                  </div>
                </div>
              </div>

              <div class="text-right">
                <div class="text-caption text-medium-emphasis mb-1">
                  Stock Actual / Mín
                </div>
                <div class="d-flex align-center justify-end gap-2">
                  <VChip
                    :color="Number(item.stock) <= 0 ? 'error' : 'warning'"
                    size="small"
                    class="font-weight-bold"
                  >
                    {{ item.stock }}
                  </VChip>
                  <span class="text-medium-emphasis text-body-2 font-weight-bold">/ {{ item.min_stock }}</span>
                </div>
              </div>
            </div>
          </template>
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
            @click="isStockDialogVisible = false"
          >
            Cerrar
          </VBtn>
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

    <!-- Monthly Sales Breakdown (Mayor a Menor / Productos vs Servicios) Dialog -->
    <MonthlySalesBreakdownDialog v-model="isMonthlySalesBreakdownOpen" />

    <!-- Dialog Detalle de Mantenimiento Preventivo -->
    <VDialog
      v-model="isReminderDetailsOpen"
      max-width="520"
    >
      <VCard
        v-if="selectedReminder"
        class="rounded-xl overflow-hidden"
      >
        <div
          class="pa-4 d-flex justify-space-between align-center text-white"
          style="background: linear-gradient(135deg, #7367F0 0%, #4834D4 100%);"
        >
          <div class="d-flex align-center gap-3">
            <VAvatar
              color="white"
              variant="tonal"
              size="40"
            >
              <VIcon
                :icon="selectedReminder.category_icon"
                size="22"
                color="white"
              />
            </VAvatar>
            <div>
              <h3 class="text-subtitle-1 font-weight-bold text-white mb-0">
                Recordatorio Preventivo
              </h3>
              <p
                class="text-caption text-white opacity-80 mb-0 text-truncate"
                style="max-width: 320px;"
              >
                {{ selectedReminder.title }}
              </p>
            </div>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            color="white"
            size="small"
            @click="isReminderDetailsOpen = false"
          />
        </div>

        <VCardText class="pa-4 pt-4">
          <VRow>
            <VCol
              cols="12"
              class="mb-2"
            >
              <div
                class="pa-3 rounded-lg d-flex justify-space-between align-center"
                style="background-color: rgba(var(--v-theme-primary), 0.08); border: 1px dashed rgba(var(--v-theme-primary), 0.3);"
              >
                <div>
                  <span class="text-caption text-medium-emphasis">Fecha Estimada</span>
                  <div class="font-weight-bold text-primary text-body-1">
                    {{ selectedReminder.scheduled_date }}
                  </div>
                </div>
                <div class="text-right">
                  <span class="text-caption text-medium-emphasis">Kilometraje Objetivo</span>
                  <div class="font-weight-bold text-h6 text-success">
                    {{ Number(selectedReminder.target_mileage).toLocaleString() }} KM
                  </div>
                </div>
              </div>
            </VCol>

            <VCol cols="6">
              <span class="text-caption text-medium-emphasis">Vehículo / Placa</span>
              <div class="font-weight-bold text-body-2">
                {{ selectedReminder.vehicle?.license_plate }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ getBrandNameById(selectedReminder.vehicle?.brand) }} {{ selectedReminder.vehicle?.model }} ({{ selectedReminder.vehicle?.usage_type ? String(selectedReminder.vehicle.usage_type).toUpperCase() : 'PARTICULAR' }})
              </div>
            </VCol>

            <VCol cols="6">
              <span class="text-caption text-medium-emphasis">Cliente</span>
              <div class="font-weight-bold text-body-2 text-truncate">
                {{ selectedReminder.client?.full_name }}
              </div>
              <div class="text-caption text-medium-emphasis">
                Telf: {{ selectedReminder.client?.phone || 'Sin teléfono' }}
              </div>
            </VCol>

            <VCol cols="6">
              <span class="text-caption text-medium-emphasis">Último Servicio Realizado</span>
              <div class="font-weight-medium text-body-2">
                {{ Number(selectedReminder.last_service_mileage).toLocaleString() }} KM
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ selectedReminder.last_service_date }}
              </div>
            </VCol>

            <VCol cols="6">
              <span class="text-caption text-medium-emphasis">Tasa de Uso Estimada</span>
              <div class="font-weight-bold text-info text-body-2">
                {{ selectedReminder.avg_daily_km }} KM / día
              </div>
              <div class="text-caption text-medium-emphasis">
                Intervalo: +{{ Number(selectedReminder.interval_km || 10000).toLocaleString() }} KM
              </div>
            </VCol>

            <VCol
              v-if="selectedReminder.description"
              cols="12"
            >
              <span class="text-caption text-medium-emphasis">Descripción / Notas</span>
              <div class="text-body-2 pa-2 rounded bg-light">
                {{ selectedReminder.description }}
              </div>
            </VCol>

            <VCol
              v-if="selectedReminder.notified_at"
              cols="12"
            >
              <VAlert
                type="info"
                variant="tonal"
                density="compact"
                class="text-caption mb-0"
              >
                Notificado el {{ selectedReminder.notified_at }} vía {{ selectedReminder.notification_channel || 'WhatsApp' }}
              </VAlert>
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 d-flex flex-wrap justify-space-between align-center gap-2">
          <div class="d-flex gap-2">
            <VBtn
              color="success"
              variant="elevated"
              size="small"
              prepend-icon="ri-whatsapp-line"
              @click="sendWhatsAppNotification(selectedReminder)"
            >
              WhatsApp
            </VBtn>
            <VBtn
              color="primary"
              variant="elevated"
              size="small"
              prepend-icon="ri-mail-send-line"
              :loading="isSendingAction"
              @click="sendEmailNotification(selectedReminder)"
            >
              Correo
            </VBtn>
          </div>

          <div class="d-flex gap-2">
            <VBtn
              v-if="selectedReminder.status !== 'scheduled'"
              color="info"
              variant="tonal"
              size="small"
              @click="updateReminderStatus(selectedReminder, 'scheduled')"
            >
              Marcar Agendado
            </VBtn>
            <VBtn
              v-if="selectedReminder.status !== 'completed'"
              color="success"
              variant="tonal"
              size="small"
              @click="updateReminderStatus(selectedReminder, 'completed')"
            >
              Completado
            </VBtn>
          </div>
        </VCardActions>
      </VCard>
    </VDialog>
  </VContainer>
</template>

<style scoped>
.supplier-rank-badge {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: #ffffff;
  flex-shrink: 0;
}

.supplier-rank-badge.rank-1 {
  background: linear-gradient(135deg, #FFB400 0%, #FF8F00 100%);
  box-shadow: 0 4px 10px rgba(255, 180, 0, 0.4);
}

.supplier-rank-badge.rank-2 {
  background: linear-gradient(135deg, #A8AAAE 0%, #787B80 100%);
  box-shadow: 0 4px 10px rgba(168, 170, 174, 0.4);
}

.supplier-rank-badge.rank-3 {
  background: linear-gradient(135deg, #E67E22 0%, #D35400 100%);
  box-shadow: 0 4px 10px rgba(230, 126, 34, 0.4);
}

.supplier-rank-badge.rank-4,
.supplier-rank-badge.rank-5,
.supplier-rank-badge.rank-6 {
  background: linear-gradient(135deg, #7367F0 0%, #9E95F5 100%);
  box-shadow: 0 4px 10px rgba(115, 103, 240, 0.3);
}

.hover-elevate {
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.hover-elevate:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.07);
}
</style>

