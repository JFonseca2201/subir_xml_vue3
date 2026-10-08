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
const activeTab = ref('finances')

const dashboardTabs = [
  {
    id: 'finances',
    title: 'Finanzas & Ventas',
    icon: 'ri-line-chart-line',
  },
  {
    id: 'workshop',
    title: 'Taller & Mantenimiento',
    icon: 'ri-tools-line',
  },
  {
    id: 'purchases',
    title: 'Proveedores & Compras',
    icon: 'ri-truck-line',
  },
]

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

// Current Greeting & Local Date
const greetingText = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '¡Buenos días!'
  if (hour < 19) return '¡Buenas tardes!'
  
  return '¡Buenas noches!'
})

const formattedCurrentDate = computed(() => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  const str = new Date().toLocaleDateString('es-EC', options)
  
  return str.charAt(0).toUpperCase() + str.slice(1)
})

// Compute theme colors dynamically from the Vuetify system context
const chartThemes = computed(() => {
  const isDark = theme.current.value.dark
  const textColor = isDark ? '#CFD3EC' : '#6D788D'
  const borderColor = isDark ? 'rgba(234, 234, 255, 0.12)' : 'rgba(38, 43, 67, 0.12)'
  const primaryColor = theme.current.value.colors.primary || '#6366F1'
  const infoColor = theme.current.value.colors.info || '#0EA5E9'
  const tooltipTheme = isDark ? 'dark' : 'light'

  return { textColor, borderColor, primaryColor, infoColor, tooltipTheme }
})

// ApexChart: Wavy Dual Area Chart Options & Series using system colors
const wavyChartOptions = computed(() => {
  return {
    chart: {
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      background: 'transparent',
    },
    colors: ['#6366F1', '#06B6D4'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 95, 100],
      },
    },
    grid: {
      borderColor: chartThemes.value.borderColor,
      strokeDashArray: 4,
    },
    xaxis: {
      categories: cashFlow.value.map(item => item.month_name ? item.month_name.substring(0, 3) : ''),
      labels: { style: { colors: chartThemes.value.textColor, fontSize: '11px', fontWeight: 600 } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: chartThemes.value.textColor, fontSize: '11px', fontWeight: 600 },
        formatter: val => `$${Math.round(val)}`,
      },
    },
    tooltip: {
      theme: chartThemes.value.tooltipTheme,
      y: {
        formatter: val => `$${Number(val || 0).toFixed(2)}`,
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
    chart: {
      type: 'donut',
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      background: 'transparent',
    },
    labels: ['Ingresos', 'Egresos'],
    colors: ['#06B6D4', '#6366F1'],
    plotOptions: { pie: { donut: { size: '72%' } } },
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
    chart: {
      type: 'bar',
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      background: 'transparent',
    },
    colors: ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'],
    plotOptions: { bar: { borderRadius: 6, horizontal: true, distributed: true } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: topProducts.value.slice(0, 5).map(p => {
        const desc = p.description || ''

        return desc.length > 20 ? desc.substring(0, 20) + '...' : desc
      }),
      labels: { style: { colors: chartThemes.value.textColor, fontSize: '11px', fontWeight: 600 } },
      axisBorder: { show: false },
    },
    yaxis: {
      labels: { style: { colors: chartThemes.value.textColor, fontSize: '11px', fontWeight: 600 } },
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
    
    return desc.length > 28 ? desc.substring(0, 28) + '...' : desc
  })

  return {
    chart: {
      type: 'donut',
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      background: 'transparent',
    },
    labels: labels.length > 0 ? labels : ['Sin datos'],
    colors: ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#94A3B8'],
    dataLabels: {
      enabled: true,
      formatter: val => `${Math.round(val)}%`,
      style: {
        fontSize: '12px',
        fontWeight: 'bold',
      },
      dropShadow: { enabled: false },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total Unidades',
              fontSize: '13px',
              fontWeight: '600',
              color: chartThemes.value.textColor,
              formatter: () => {
                const totalQty = topPurchasedProducts.value.reduce((acc, p) => acc + Number(p.total_quantity || 0), 0)
                
                return `${Math.round(totalQty)} u.`
              },
            },
            value: {
              fontSize: '24px',
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
      fontSize: '12px',
      itemMargin: {
        horizontal: 8,
        vertical: 4,
      },
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
    chart: {
      type: 'donut',
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      background: 'transparent',
    },
    labels: labels.length > 0 ? labels : ['Sin datos'],
    colors: ['#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#6366F1'],
    dataLabels: { enabled: true, style: { fontSize: '10px', fontWeight: 'bold' } },
    plotOptions: { pie: { donut: { size: '60%' } } },
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
    chart: {
      type: 'pie',
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      background: 'transparent',
    },
    labels: labels.length > 0 ? labels : ['1 día', '2-3 días', '4-7 días', '+8 días'],
    colors: ['#10B981', '#F59E0B', '#EF4444', '#6366F1'],
    dataLabels: { enabled: true, style: { fontWeight: 'bold' } },
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
    chart: {
      type: 'bar',
      stacked: false,
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      background: 'transparent',
    },
    colors: ['#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#6366F1'],
    xaxis: {
      categories: categories.length > 0 ? categories : ['Sin datos'],
      labels: { style: { colors: chartThemes.value.textColor, fontSize: '11px', fontWeight: 600 } },
      axisBorder: { show: false },
    },
    yaxis: { labels: { style: { colors: chartThemes.value.textColor, fontSize: '11px', fontWeight: 600 } } },
    legend: { position: 'top', labels: { colors: chartThemes.value.textColor } },
    grid: { borderColor: chartThemes.value.borderColor, strokeDashArray: 4 },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '45%' } },
  }
})
</script>

<template>
  <div class="dashboard-container pa-3 pa-sm-6">
    <!-- Header glowing ambient background -->
    <div class="dashboard-header-glow" />

    <!-- Executive Greeting & Action Hub -->
    <div
      class="d-flex flex-column flex-lg-row justify-space-between align-start align-lg-center mb-6 position-relative border-b pb-4 gap-4"
      style="z-index: 10; border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
    >
      <div>
        <div class="d-flex align-center gap-2 flex-wrap mb-1">
          <span class="text-caption font-weight-bold text-uppercase px-2.5 py-1 rounded-pill" style="background: rgba(var(--v-theme-primary), 0.12); color: rgb(var(--v-theme-primary)); letter-spacing: 0.5px;">
            <VIcon icon="ri-dashboard-3-line" size="13" class="me-1" />
            Panel Ejecutivo & Operaciones
          </span>
          <span class="text-caption text-medium-emphasis font-weight-medium">
            • {{ formattedCurrentDate }}
          </span>
        </div>
        <h1 class="text-h4 font-weight-black text-high-emphasis mb-0" style="letter-spacing: -0.5px;">
          {{ greetingText }} <span class="gradient-title">ADMIN PANEL</span>
        </h1>
        <p class="text-caption text-medium-emphasis mb-0">
          Control general de finanzas, taller de servicio, inventario y proveedores
        </p>
      </div>

      <!-- Quick Search & Action Hub Bar -->
      <div class="d-flex flex-wrap align-center gap-2.5 w-100 w-lg-auto">
        <!-- Live Instant Search -->
        <div style="min-width: 220px; flex: 1 1 auto; position: relative;" class="d-none d-sm-block">
          <VTextField
            v-model="searchQuery"
            density="compact"
            placeholder="Buscar cliente, auto, SKU..."
            variant="solo"
            hide-details
            :loading="searchLoading"
            class="rounded-xl search-field"
            style="box-shadow: 0 4px 15px rgba(var(--v-theme-primary), 0.08) !important;"
            @focus="isSearchFocused = true"
            @blur="handleSearchBlur"
          >
            <template #prepend-inner>
              <VProgressCircular
                v-if="searchLoading"
                indeterminate
                color="primary"
                size="16"
                width="2"
                class="me-1"
              />
              <VIcon
                v-else
                icon="ri-search-line"
                size="18"
                class="text-medium-emphasis"
              />
            </template>
          </VTextField>

          <!-- Floating search results drop panel -->
          <VCard
            v-if="searchQuery && isSearchFocused"
            elevation="10"
            class="position-absolute mt-2 pa-2 rounded-xl search-results-dropdown"
            style="width: 320px; right: 0; z-index: 100; max-height: 280px; overflow-y: auto; background-color: rgb(var(--v-theme-surface)) !important; border: 1px solid rgba(var(--v-theme-on-surface), 0.12) !important;"
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
              <span>Buscando en Base de Datos...</span>
            </div>
            <div
              v-else-if="searchResults.length === 0"
              class="text-caption text-medium-emphasis text-center py-4"
            >
              Sin coincidencias encontradas
            </div>
            <div v-else class="d-flex flex-column gap-1">
              <div
                v-for="(res, idx) in searchResults"
                :key="idx"
                class="search-result-item pa-2.5 rounded-lg cursor-pointer d-flex flex-column"
                @mousedown="handleResultClick(res)"
              >
                <div class="d-flex justify-space-between align-center mb-1">
                  <span class="font-weight-bold text-caption text-high-emphasis text-truncate pe-2">{{ res.name }}</span>
                  <VChip
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="font-weight-bold flex-shrink-0"
                  >
                    {{ res.type }}
                  </VChip>
                </div>
                <span
                  class="text-medium-emphasis text-truncate"
                  style="font-size: 0.68rem;"
                >{{ res.detail }}</span>
              </div>
            </div>
          </VCard>
        </div>

        <!-- Action Buttons -->
        <div class="d-flex align-center gap-2">
          <VTooltip text="Nueva Orden de Trabajo" location="bottom">
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="ri-tools-line"
                variant="elevated"
                size="small"
                class="rounded-xl text-white"
                style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35) !important;"
                @click="router.push('/work-orders/add')"
              />
            </template>
          </VTooltip>

          <VTooltip text="Registrar Venta" location="bottom">
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="ri-money-dollar-box-line"
                variant="elevated"
                size="small"
                class="rounded-xl text-white"
                style="background: linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%); box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35) !important;"
                @click="router.push('/sales/add')"
              />
            </template>
          </VTooltip>

          <VTooltip text="Ingresar Compra" location="bottom">
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="ri-shopping-cart-2-line"
                variant="elevated"
                size="small"
                class="rounded-xl text-white"
                style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35) !important;"
                @click="router.push('/invoice/manual-purchase')"
              />
            </template>
          </VTooltip>

          <VTooltip text="Kardex de Inventario" location="bottom">
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="ri-exchange-funds-line"
                variant="elevated"
                size="small"
                class="rounded-xl text-white"
                style="background: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35) !important;"
                @click="router.push('/kardex')"
              />
            </template>
          </VTooltip>
        </div>

        <VBtn
          prepend-icon="ri-bar-chart-grouped-line"
          variant="tonal"
          color="primary"
          class="rounded-xl px-3 font-weight-bold text-caption"
          style="letter-spacing: 0.3px;"
          @click="isMonthlySalesBreakdownOpen = true"
        >
          Ranking
        </VBtn>

        <VBtn
          prepend-icon="ri-refresh-line"
          variant="elevated"
          color="primary"
          :loading="loading"
          class="rounded-xl px-3 text-white font-weight-bold text-caption"
          style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%) !important; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35) !important;"
          @click="fetchDashboardData"
        >
          Actualizar
        </VBtn>
      </div>
    </div>

    <!-- Spinner Loader -->
    <div
      v-if="loading"
      class="d-flex flex-column justify-center align-center py-16 my-12"
    >
      <VProgressCircular
        indeterminate
        color="primary"
        size="64"
        width="5"
        class="mb-3"
      />
      <span class="text-caption font-weight-bold text-medium-emphasis">Cargando métricas ejecutivas...</span>
    </div>

    <!-- Error State -->
    <div
      v-else-if="hasError"
      class="d-flex flex-column align-center justify-center py-12 my-12 text-center"
      style="max-width: 480px; margin: 0 auto;"
    >
      <VAvatar color="error" variant="tonal" size="64" class="mb-4">
        <VIcon
          icon="ri-error-warning-line"
          size="36"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold mb-2 text-high-emphasis">
        Error al cargar el Dashboard
      </h3>
      <p class="text-body-2 text-medium-emphasis mb-6">
        No se pudieron obtener los datos actualizados del servidor. Por favor, verifica tu conexión o vuelve a intentarlo.
      </p>
      <VBtn
        color="primary"
        prepend-icon="ri-refresh-line"
        class="rounded-xl px-6 font-weight-bold"
        @click="fetchDashboardData"
      >
        Reintentar sincronizar
      </VBtn>
    </div>

    <div
      v-else
      class="position-relative"
      style="z-index: 1;"
    >
      <!-- TOP 4 ULTRA-PEPA KPI CARDS -->
      <VRow
        class="mb-5"
        dense
      >
        <!-- KPI 1: Clientes Registrados -->
        <VCol
          cols="12"
          sm="6"
          lg="3"
        >
          <VCard
            elevation="0"
            class="pa-4 pa-sm-5 pepa-kpi-card kpi-gradient-primary h-100 d-flex flex-column justify-space-between"
          >
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="kpi-icon-bubble">
                <VIcon
                  icon="ri-user-star-line"
                  size="26"
                  color="white"
                />
              </div>
              <span class="kpi-badge-pill">
                <VIcon icon="ri-check-line" size="12" />
                Base Activa
              </span>
            </div>

            <div>
              <div class="text-h4 font-weight-black text-white mb-0" style="letter-spacing: -0.5px;">
                {{ Number(kpis.total_clients || 0).toLocaleString() }}
              </div>
              <div class="text-caption font-weight-bold text-white text-uppercase" style="opacity: 0.92; letter-spacing: 0.5px;">
                Clientes Registrados
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t d-flex justify-space-between align-center" style="border-color: rgba(255, 255, 255, 0.2) !important;">
              <span class="text-caption text-white" style="font-size: 0.72rem; opacity: 0.85;">
                Meta {{ clientsPercentage }}% alcanzada
              </span>
              <VIcon icon="ri-arrow-right-up-line" size="16" class="text-white" style="opacity: 0.85;" />
            </div>
          </VCard>
        </VCol>

        <!-- KPI 2: Vehículos Registrados -->
        <VCol
          cols="12"
          sm="6"
          lg="3"
        >
          <VCard
            elevation="0"
            class="pa-4 pa-sm-5 pepa-kpi-card kpi-gradient-info h-100 d-flex flex-column justify-space-between"
          >
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="kpi-icon-bubble">
                <VIcon
                  icon="ri-car-washing-line"
                  size="26"
                  color="white"
                />
              </div>
              <span class="kpi-badge-pill">
                <VIcon icon="ri-shield-check-line" size="12" />
                Taller & Flota
              </span>
            </div>

            <div>
              <div class="text-h4 font-weight-black text-white mb-0" style="letter-spacing: -0.5px;">
                {{ Number(kpis.total_vehicles || 0).toLocaleString() }}
              </div>
              <div class="text-caption font-weight-bold text-white text-uppercase" style="opacity: 0.92; letter-spacing: 0.5px;">
                Vehículos en Sistema
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t d-flex justify-space-between align-center" style="border-color: rgba(255, 255, 255, 0.2) !important;">
              <span class="text-caption text-white" style="font-size: 0.72rem; opacity: 0.85;">
                Meta {{ vehiclesPercentage }}% alcanzada
              </span>
              <VIcon icon="ri-arrow-right-up-line" size="16" class="text-white" style="opacity: 0.85;" />
            </div>
          </VCard>
        </VCol>

        <!-- KPI 3: Balance Mensual -->
        <VCol
          cols="12"
          sm="6"
          lg="3"
        >
          <VCard
            elevation="0"
            class="pa-4 pa-sm-5 pepa-kpi-card kpi-gradient-success h-100 d-flex flex-column justify-space-between"
          >
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="kpi-icon-bubble">
                <VIcon
                  icon="ri-wallet-3-line"
                  size="26"
                  color="white"
                />
              </div>
              <span class="kpi-badge-pill">
                <VIcon icon="ri-funds-line" size="12" />
                {{ kpis.monthly_balance >= 0 ? 'Superávit' : 'Déficit' }}
              </span>
            </div>

            <div>
              <div class="text-h4 font-weight-black text-white mb-0" style="letter-spacing: -0.5px;">
                {{ formatCurrency(kpis.monthly_balance) }}
              </div>
              <div class="text-caption font-weight-bold text-white text-uppercase" style="opacity: 0.92; letter-spacing: 0.5px;">
                Balance Neto Mensual
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t d-flex justify-space-between align-center" style="border-color: rgba(255, 255, 255, 0.2) !important;">
              <span class="text-caption text-white text-truncate pe-1" style="font-size: 0.70rem; opacity: 0.9;">
                V: {{ formatCurrency(kpis.monthly_sales) }} | G: {{ formatCurrency(kpis.monthly_expenses) }}
              </span>
              <VIcon icon="ri-exchange-line" size="16" class="text-white flex-shrink-0" style="opacity: 0.85;" />
            </div>
          </VCard>
        </VCol>

        <!-- KPI 4: Stock Mínimo Crítico -->
        <VCol
          cols="12"
          sm="6"
          lg="3"
        >
          <VCard
            elevation="0"
            class="pa-4 pa-sm-5 pepa-kpi-card kpi-gradient-warning h-100 d-flex flex-column justify-space-between cursor-pointer"
            @click="isStockDialogVisible = true"
          >
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="kpi-icon-bubble">
                <VIcon
                  icon="ri-alarm-warning-line"
                  size="26"
                  color="white"
                />
              </div>
              <span class="kpi-badge-pill" style="background: rgba(0,0,0,0.18);">
                <VIcon icon="ri-error-warning-line" size="12" />
                Reponer Stock
              </span>
            </div>

            <div>
              <div class="text-h4 font-weight-black text-white mb-0" style="letter-spacing: -0.5px;">
                {{ Number(kpis.low_stock_count || 0).toLocaleString() }}
              </div>
              <div class="text-caption font-weight-bold text-white text-uppercase" style="opacity: 0.92; letter-spacing: 0.5px;">
                Artículos Bajo Mínimo
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t d-flex justify-space-between align-center" style="border-color: rgba(255, 255, 255, 0.2) !important;">
              <span class="text-caption text-white font-weight-bold" style="font-size: 0.72rem; opacity: 0.95;">
                Ver alertas de inventario
              </span>
              <VIcon icon="ri-arrow-right-line" size="16" class="text-white" />
            </div>
          </VCard>
        </VCol>
      </VRow>

      <!-- EXECUTIVE SEGMENTED NAVIGATION CONTROLLER -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4 mt-2">
        <div class="luxury-tabs-nav">
          <button
            v-for="tab in dashboardTabs"
            :key="tab.id"
            type="button"
            class="luxury-tab-btn"
            :class="{ 'is-active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <div class="tab-icon-wrap">
              <VIcon
                :icon="tab.icon"
                size="18"
              />
            </div>
            <span class="tab-title">{{ tab.title }}</span>
            <div
              v-if="activeTab === tab.id"
              class="active-dot"
            />
          </button>
        </div>

        <div class="text-caption text-medium-emphasis d-none d-md-flex align-center gap-1 font-weight-medium">
          <VIcon
            icon="ri-shield-check-line"
            size="15"
            color="success"
          />
          <span>Métricas en tiempo real sincronizadas</span>
        </div>
      </div>

      <!-- TAB 1: FINANZAS & VENTAS -->
      <div
        v-show="activeTab === 'finances'"
        class="tab-content-fade"
      >
        <VRow
          class="mb-4"
          dense
        >
          <!-- Flujo de caja YTD -->
          <VCol
            cols="12"
            lg="8"
          >
            <VCard
              elevation="0"
              class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column justify-space-between"
            >
              <div>
                <div
                  class="d-flex justify-space-between align-center flex-wrap gap-2 mb-3 border-b pb-3"
                  style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
                >
                  <div class="d-flex align-center gap-2">
                    <VAvatar color="primary" variant="tonal" size="32" rounded="lg">
                      <VIcon icon="ri-line-chart-line" size="18" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                        Flujo de Caja Anual (YTD)
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Comparativa de Ingresos vs Egresos por mes
                      </p>
                    </div>
                  </div>
                  <VChip
                    size="small"
                    color="primary"
                    variant="tonal"
                    class="font-weight-bold"
                  >
                    Balance: {{ formatCurrency(kpis.monthly_balance) }}
                  </VChip>
                </div>

                <div class="pa-1">
                  <VueApexCharts
                    type="area"
                    height="270"
                    :options="wavyChartOptions"
                    :series="wavyChartSeries"
                  />
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Donut: Distribución Financiera -->
          <VCol
            cols="12"
            lg="4"
          >
            <VCard
              elevation="0"
              class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column justify-space-between"
            >
              <div>
                <div
                  class="d-flex align-center gap-2 mb-3 border-b pb-3"
                  style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
                >
                  <VAvatar color="info" variant="tonal" size="32" rounded="lg">
                    <VIcon icon="ri-pie-chart-2-line" size="18" />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                      Distribución Mensual
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Proporción de ingresos vs egresos
                    </p>
                  </div>
                </div>

                <div class="pa-1 d-flex justify-center align-center my-auto">
                  <VueApexCharts
                    type="donut"
                    height="240"
                    :options="donutChartOptions"
                    :series="donutChartSeries"
                  />
                </div>
              </div>
            </VCard>
          </VCol>
        </VRow>

        <VRow
          class="mb-4"
          dense
        >
          <!-- Top 5 Productos Vendidos -->
          <VCol
            cols="12"
            lg="7"
          >
            <VCard
              elevation="0"
              class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column justify-space-between"
            >
              <div>
                <div
                  class="d-flex justify-space-between align-center flex-wrap gap-2 mb-3 border-b pb-3"
                  style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
                >
                  <div class="d-flex align-center gap-2">
                    <VAvatar color="success" variant="tonal" size="32" rounded="lg">
                      <VIcon icon="ri-bar-chart-horizontal-line" size="18" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                        Top 5 Artículos Más Vendidos
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Volumen total de unidades despachadas
                      </p>
                    </div>
                  </div>
                  <VBtn
                    size="small"
                    variant="tonal"
                    color="primary"
                    class="font-weight-bold text-none rounded-lg"
                    prepend-icon="ri-list-ordered"
                    @click="isMonthlySalesBreakdownOpen = true"
                  >
                    Ranking Completo
                  </VBtn>
                </div>

                <div class="pa-1">
                  <VueApexCharts
                    type="bar"
                    height="220"
                    :options="barChartOptions"
                    :series="barChartSeries"
                  />
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Rendimiento Operativo & Metas -->
          <VCol
            cols="12"
            lg="5"
          >
            <VCard
              elevation="0"
              class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column justify-space-between"
            >
              <div>
                <div
                  class="d-flex align-center gap-2 mb-3 border-b pb-3"
                  style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
                >
                  <VAvatar color="warning" variant="tonal" size="32" rounded="lg">
                    <VIcon icon="ri-radar-line" size="18" />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                      Rendimiento de Objetivos
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Indicadores clave de rendimiento mensual
                    </p>
                  </div>
                </div>

                <div class="d-flex flex-column gap-3.5 my-auto py-2">
                  <div class="pa-3 rounded-xl" style="background: rgba(var(--v-theme-surface), 1); border: 1px solid rgba(var(--v-theme-on-surface), 0.06);">
                    <div class="d-flex justify-space-between text-caption mb-1.5">
                      <span class="font-weight-bold text-high-emphasis">Eficiencia del Balance</span>
                      <span class="text-primary font-weight-bold">{{ balancePercentage }}%</span>
                    </div>
                    <VProgressLinear
                      v-model="balancePercentage"
                      color="#6366F1"
                      height="8"
                      rounded
                    />
                  </div>

                  <div class="pa-3 rounded-xl" style="background: rgba(var(--v-theme-surface), 1); border: 1px solid rgba(var(--v-theme-on-surface), 0.06);">
                    <div class="d-flex justify-space-between text-caption mb-1.5">
                      <span class="font-weight-bold text-high-emphasis">Meta de Clientes (Meta 100)</span>
                      <span class="text-info font-weight-bold">{{ clientsPercentage }}%</span>
                    </div>
                    <VProgressLinear
                      v-model="clientsPercentage"
                      color="#0EA5E9"
                      height="8"
                      rounded
                    />
                  </div>

                  <div class="pa-3 rounded-xl" style="background: rgba(var(--v-theme-surface), 1); border: 1px solid rgba(var(--v-theme-on-surface), 0.06);">
                    <div class="d-flex justify-space-between text-caption mb-1.5">
                      <span class="font-weight-bold text-high-emphasis">Meta de Vehículos (Meta 150)</span>
                      <span class="text-success font-weight-bold">{{ vehiclesPercentage }}%</span>
                    </div>
                    <VProgressLinear
                      v-model="vehiclesPercentage"
                      color="#10B981"
                      height="8"
                      rounded
                    />
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>
        </VRow>
      </div>

      <!-- TAB 2: TALLER & MANTENIMIENTO -->
      <div
        v-show="activeTab === 'workshop'"
        class="tab-content-fade"
      >
        <VRow
          class="mb-4"
          dense
        >
          <!-- Mantenimiento Preventivo (Calendario + Agenda) -->
          <VCol
            cols="12"
            lg="4"
          >
            <VCard
              elevation="0"
              class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column"
            >
              <div
                class="d-flex align-center justify-space-between mb-3 border-b pb-3"
                style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
              >
                <div class="d-flex align-center gap-2">
                  <VAvatar color="primary" variant="tonal" size="32" rounded="lg">
                    <VIcon icon="ri-calendar-todo-line" size="18" />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                      Mantenimiento Preventivo
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Calendario de servicios proyectados
                    </p>
                  </div>
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
                <div class="d-flex justify-space-between align-center mb-3">
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
                          width: '4px',
                          height: '4px',
                          backgroundColor: evt.category_color === 'error' ? '#EF4444' :
                            (evt.category_color === 'warning' ? '#F59E0B' :
                              (evt.category_color === 'success' ? '#10B981' :
                                (evt.category_color === 'info' ? '#0EA5E9' : '#6366F1')))
                        }"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Agenda Feed -->
              <div
                class="mt-4 pt-3 border-t flex-grow-1"
                style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
              >
                <div class="d-flex justify-space-between align-center mb-2">
                  <span class="text-caption font-weight-bold text-primary text-uppercase">
                    Agenda: {{ formattedSelectedDate }}
                  </span>
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
                  <VIcon
                    icon="ri-calendar-check-line"
                    size="26"
                    color="grey"
                    class="mb-1"
                  />
                  <span>Sin servicios proyectados para este día</span>
                </div>
                <div
                  v-else
                  class="d-flex flex-column gap-2"
                  style="max-height: 200px; overflow-y: auto;"
                >
                  <div
                    v-for="evt in activeEvents"
                    :key="evt.id"
                    class="d-flex justify-space-between align-center pa-2.5 rounded-lg elevation-1"
                    style="background-color: rgba(var(--v-theme-surface), 1); border: 1px solid rgba(var(--v-theme-on-surface), 0.08); border-left: 4px solid;"
                    :style="{ borderLeftColor: evt.category_color === 'error' ? '#EF4444' : (evt.category_color === 'warning' ? '#F59E0B' : (evt.category_color === 'success' ? '#10B981' : '#6366F1')) }"
                  >
                    <div
                      class="overflow-hidden cursor-pointer"
                      style="max-width: 60%;"
                      @click="openReminderDetails(evt)"
                    >
                      <div class="font-weight-bold text-caption text-high-emphasis d-flex align-center gap-1 text-truncate">
                        <VIcon
                          :icon="evt.category_icon"
                          size="14"
                          :color="evt.category_color"
                        />
                        <span class="text-truncate">{{ evt.vehicle?.license_plate || 'Vehículo' }}</span>
                      </div>
                      <div
                        class="text-medium-emphasis text-truncate"
                        style="font-size: 0.68rem;"
                      >
                        <span class="font-weight-bold text-primary">{{ Number(evt.target_mileage || 0).toLocaleString() }} KM</span> - {{ evt.client?.full_name || 'Cliente' }}
                      </div>
                    </div>

                    <div class="d-flex align-center gap-1">
                      <VBtn
                        icon="ri-whatsapp-line"
                        size="x-small"
                        color="success"
                        variant="tonal"
                        title="Contactar WhatsApp"
                        @click.stop="sendWhatsAppNotification(evt)"
                      />
                      <VBtn
                        icon="ri-mail-send-line"
                        size="x-small"
                        color="primary"
                        variant="tonal"
                        :loading="isSendingAction"
                        title="Enviar Correo"
                        @click.stop="sendEmailNotification(evt)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- OT Totales + SLA + Técnicos -->
          <VCol
            cols="12"
            lg="8"
          >
            <VRow dense>
              <VCol
                cols="12"
                sm="6"
              >
                <VCard
                  elevation="0"
                  class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column justify-space-between"
                >
                  <div class="d-flex justify-space-between align-center mb-2">
                    <div>
                      <div class="text-subtitle-1 font-weight-bold text-high-emphasis">
                        Órdenes de Trabajo
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        Distribución por estado actual
                      </div>
                    </div>
                    <VChip size="small" color="primary" variant="tonal" class="font-weight-bold">
                      {{ otTotalesSeries.reduce((a, b) => a + b, 0) }} Total
                    </VChip>
                  </div>
                  <div class="pa-1 d-flex justify-center align-center my-auto">
                    <VueApexCharts
                      type="donut"
                      height="200"
                      width="100%"
                      :options="otTotalesOptions"
                      :series="otTotalesSeries"
                    />
                  </div>
                </VCard>
              </VCol>

              <VCol
                cols="12"
                sm="6"
              >
                <VCard
                  elevation="0"
                  class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column justify-space-between"
                >
                  <div class="mb-2">
                    <div class="text-subtitle-1 font-weight-bold text-high-emphasis">
                      SLA de Cierre de OTs
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Tiempo de resolución y entrega
                    </div>
                  </div>
                  <div class="pa-1 d-flex justify-center align-center my-auto">
                    <VueApexCharts
                      type="pie"
                      height="200"
                      width="100%"
                      :options="slaOptions"
                      :series="slaSeries"
                    />
                  </div>
                </VCard>
              </VCol>

              <VCol
                cols="12"
                class="mt-2"
              >
                <VCard
                  elevation="0"
                  class="pa-4 pa-sm-5 mock-card"
                >
                  <div class="d-flex align-center gap-2 mb-2">
                    <VAvatar color="info" variant="tonal" size="30" rounded="lg">
                      <VIcon icon="ri-user-settings-line" size="16" />
                    </VAvatar>
                    <div>
                      <div class="text-subtitle-1 font-weight-bold text-high-emphasis">
                        Servicios Asignados por Técnico
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        Carga de trabajo distribuida del personal mecánico
                      </div>
                    </div>
                  </div>
                  <div class="pa-1">
                    <VueApexCharts
                      type="bar"
                      height="210"
                      width="100%"
                      :options="tecnicosOptions"
                      :series="tecnicosSeries"
                    />
                  </div>
                </VCard>
              </VCol>
            </VRow>
          </VCol>
        </VRow>
      </div>

      <!-- TAB 3: PROVEEDORES & COMPRAS -->
      <div
        v-show="activeTab === 'purchases'"
        class="tab-content-fade"
      >
        <VRow
          class="mb-4"
          dense
        >
          <!-- Top Proveedores con Mayor Facturación -->
          <VCol
            cols="12"
            lg="7"
          >
            <VCard
              elevation="0"
              class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column justify-space-between"
            >
              <div>
                <div
                  class="d-flex justify-space-between align-center flex-wrap gap-2 mb-3 border-b pb-3"
                  style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
                >
                  <div class="d-flex align-center gap-2">
                    <VAvatar color="primary" variant="tonal" size="32" rounded="lg">
                      <VIcon icon="ri-store-3-line" size="18" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                        Top Proveedores por Facturación
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Volumen de compras directas acumuladas
                      </p>
                    </div>
                  </div>
                  <VChip
                    size="small"
                    color="primary"
                    variant="tonal"
                    class="font-weight-bold"
                  >
                    Total Compras: {{ formatCurrency(kpis.total_purchases_spent) }}
                  </VChip>
                </div>

                <div
                  v-if="topSuppliers.length === 0"
                  class="text-center py-8 text-medium-emphasis"
                >
                  <VIcon
                    icon="ri-inbox-line"
                    size="36"
                    class="mb-2 text-disabled"
                  />
                  <p class="text-caption mb-0">
                    Sin compras registradas aún.
                  </p>
                </div>

                <div
                  v-else
                  class="d-flex flex-column gap-2.5"
                  style="max-height: 440px; overflow-y: auto;"
                >
                  <div
                    v-for="(sup, idx) in topSuppliers"
                    :key="sup.id"
                    class="supplier-pro-row"
                  >
                    <div
                      class="d-flex align-center flex-grow-1 overflow-hidden"
                      style="min-width: 180px; gap: 14px;"
                    >
                      <div
                        class="supplier-rank-badge font-weight-black flex-shrink-0"
                        :class="`rank-${idx + 1}`"
                      >
                        #{{ idx + 1 }}
                      </div>
                      <div class="overflow-hidden flex-grow-1 pe-2">
                        <div
                          class="supplier-title text-truncate"
                          :title="sup.name"
                        >
                          {{ sup.name }}
                        </div>
                        <div class="supplier-meta">
                          <span class="d-inline-flex align-center gap-1">
                            <VIcon
                              icon="ri-file-list-3-line"
                              size="13"
                              class="text-medium-emphasis"
                            />
                            <span>{{ sup.invoices_count }} factura{{ sup.invoices_count > 1 ? 's' : '' }}</span>
                          </span>
                          <span class="text-disabled">•</span>
                          <span class="supplier-pct-badge">
                            {{ sup.percentage }}% del total
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="text-right flex-shrink-0 ps-2">
                      <div class="supplier-amount font-mono">
                        {{ formatCurrency(sup.total) }}
                      </div>
                      <div
                        class="text-caption text-medium-emphasis font-weight-medium"
                        style="font-size: 0.68rem;"
                      >
                        Facturado
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Pastel de Productos Más Comprados -->
          <VCol
            cols="12"
            lg="5"
          >
            <VCard
              elevation="0"
              class="pa-4 pa-sm-5 mock-card h-100 d-flex flex-column justify-space-between"
            >
              <div>
                <div
                  class="d-flex align-center gap-2 mb-2 border-b pb-3"
                  style="border-color: rgba(var(--v-theme-on-surface), 0.08) !important;"
                >
                  <VAvatar color="info" variant="tonal" size="32" rounded="lg">
                    <VIcon icon="ri-pie-chart-line" size="18" />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                      Productos Más Comprados
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Distribución por unidades adquiridas
                    </p>
                  </div>
                </div>

                <div
                  v-if="topPurchasedProducts.length === 0"
                  class="text-center py-8 text-medium-emphasis"
                >
                  <VIcon
                    icon="ri-pie-chart-2-line"
                    size="36"
                    class="mb-2 text-disabled"
                  />
                  <p class="text-caption mb-0">
                    Sin ítems registrados.
                  </p>
                </div>

                <div
                  v-else
                  class="pa-2 d-flex justify-center align-center"
                >
                  <VueApexCharts
                    type="donut"
                    height="340"
                    width="100%"
                    :options="purchasedProductsOptions"
                    :series="purchasedProductsSeries"
                  />
                </div>
              </div>
            </VCard>
          </VCol>
        </VRow>
      </div>
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
                {{ getBrandNameById(selectedReminder.vehicle?.brand) }} {{ selectedReminder.vehicle?.model }} ({{
                  selectedReminder.vehicle?.usage_type ? String(selectedReminder.vehicle.usage_type).toUpperCase() :
                  'PARTICULAR' }})
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
                Notificado el {{ selectedReminder.notified_at }} vía {{ selectedReminder.notification_channel ||
                  'WhatsApp'
                }}
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
  </div>
</template>
