<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { $api, getApiBaseUrl } from '@/utils/api'

definePage({ meta: { permission: 'kardex' } })

const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

// Filtros
const selectedClient = ref(null)
const selectedVehicle = ref(null)
const searchQuery = ref('')
const selectedRange = ref('all') // Por defecto Todo el historial para no ocultar transacciones
const customStartDate = ref('')
const customEndDate = ref('')
const selectedDocType = ref('all')
const selectedPaymentStatus = ref('all')

// Datos
const isLoading = ref(false)
const transactions = ref([])
const metrics = ref({
  total_facturado: 0,
  total_pagado: 0,
  saldo_pendiente: 0,
  total_transacciones: 0,
  total_repuestos: 0,
  total_servicios: 0,
  repuestos_count: 0,
  servicios_count: 0,
  ultimo_kilometraje: null,
  promedio_visita: 0,
})
const clientProfile = ref(null)
const vehicleProfile = ref(null)

// Paginación
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const perPage = ref(15)

// Autocomplete Options
const clientOptions = ref([])
const vehicleOptions = ref([])
const isSearchingClients = ref(false)
const isSearchingVehicles = ref(false)

// Filtro personalizado para Autocomplete de Clientes (busca por nombre, RUC, Cédula o teléfono)
const filterClient = (itemTitle, queryText, item) => {
  if (!queryText) return true
  const query = queryText.toLowerCase().trim()
  const name = (item.raw.full_name || '').toLowerCase()
  const doc = (item.raw.n_document || '').toLowerCase()
  const phone = (item.raw.phone || '').toLowerCase()
  return name.includes(query) || doc.includes(query) || phone.includes(query)
}

// Filtro personalizado para Autocomplete de Vehículos (busca por placa, marca, modelo, dueño o cédula)
const filterVehicle = (itemTitle, queryText, item) => {
  if (!queryText) return true
  const query = queryText.toLowerCase().trim()
  const plate = (item.raw.license_plate || '').toLowerCase()
  const brand = (item.raw.brand || '').toLowerCase()
  const model = (item.raw.model || '').toLowerCase()
  const clientName = (item.raw.client?.full_name || '').toLowerCase()
  const clientDoc = (item.raw.client?.n_document || '').toLowerCase()
  return plate.includes(query) || brand.includes(query) || model.includes(query) || clientName.includes(query) || clientDoc.includes(query)
}

// Expandir transacciones
const expandedTx = ref({})

const toggleExpand = id => {
  expandedTx.value[id] = !expandedTx.value[id]
}

const isExpanded = id => !!expandedTx.value[id]

const expandAll = () => {
  transactions.value.forEach(tx => {
    expandedTx.value[tx.id] = true
  })
}

const collapseAll = () => {
  expandedTx.value = {}
}

// Opciones de rango de fechas
const rangeOptions = [
  { title: 'Todo el historial (Recomendado)', value: 'all' },
  { title: 'Mes actual', value: 'current_month' },
  { title: 'Mes anterior', value: 'last_month' },
  { title: 'Últimos 3 meses', value: 'last_3_months' },
  { title: 'Año actual (2026)', value: 'current_year' },
  { title: 'Rango personalizado', value: 'custom' },
]

const computeDateRange = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  if (selectedRange.value === 'current_month') {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    return {
      start: formatDateParam(firstDay),
      end: formatDateParam(lastDay),
    }
  }

  if (selectedRange.value === 'last_month') {
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    return {
      start: formatDateParam(firstDay),
      end: formatDateParam(lastDay),
    }
  }

  if (selectedRange.value === 'last_3_months') {
    const firstDay = new Date(year, month - 2, 1)
    const lastDay = new Date(year, month + 1, 0)
    return {
      start: formatDateParam(firstDay),
      end: formatDateParam(lastDay),
    }
  }

  if (selectedRange.value === 'current_year') {
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    }
  }

  if (selectedRange.value === 'custom') {
    return {
      start: customStartDate.value || '',
      end: customEndDate.value || '',
    }
  }

  return { start: '', end: '' }
}

const formatDateParam = d => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Cargar opciones de Clientes
const fetchClients = async (query = '') => {
  isSearchingClients.value = true
  try {
    const resp = await $api(`kardex/clientes/selector?search=${encodeURIComponent(query || '')}`)
    if (resp?.clients) {
      clientOptions.value = resp.clients
    }
  } catch (error) {
    console.error('Error cargando selector de clientes:', error)
  } finally {
    isSearchingClients.value = false
  }
}

// Cargar opciones de Vehículos / Placas
const fetchVehicles = async (query = '') => {
  isSearchingVehicles.value = true
  try {
    const resp = await $api(`kardex/vehiculos/selector?search=${encodeURIComponent(query || '')}`)
    if (resp?.vehicles) {
      vehicleOptions.value = resp.vehicles
    }
  } catch (error) {
    console.error('Error cargando selector de vehículos:', error)
  } finally {
    isSearchingVehicles.value = false
  }
}

// Cargar Kardex Principal
const loadKardex = async () => {
  isLoading.value = true
  loader.start()

  try {
    const { start, end } = computeDateRange()

    const params = {
      page: currentPage.value,
      per_page: perPage.value,
      document_type: selectedDocType.value,
      payment_status: selectedPaymentStatus.value,
    }

    if (selectedClient.value) {
      params.client_id = typeof selectedClient.value === 'object' ? selectedClient.value.id : selectedClient.value
    }

    if (selectedVehicle.value) {
      params.vehicle_id = typeof selectedVehicle.value === 'object' ? selectedVehicle.value.id : selectedVehicle.value
    }

    if (searchQuery.value && searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }

    if (start) params.start_date = start
    if (end) params.end_date = end

    const resp = await $api('kardex/clientes-vehiculos', {
      method: 'GET',
      params,
    })

    if (resp?.status === 'success' && resp.data) {
      transactions.value = resp.data.transactions || []
      metrics.value = resp.data.metrics || {}
      clientProfile.value = resp.data.client || null
      vehicleProfile.value = resp.data.vehicle || null
      totalPages.value = resp.data.pagination?.last_page || 1
      totalItems.value = resp.data.pagination?.total || 0
    }
  } catch (error) {
    console.error('Error al cargar kardex de clientes/vehículos:', error)
    showNotification('Error al cargar datos del Kardex', 'error')
  } finally {
    isLoading.value = false
    loader.stop()
  }
}

// Manejar selección de cliente
const onClientSelected = client => {
  if (!client) {
    selectedClient.value = null
    clientProfile.value = null
  } else {
    selectedClient.value = client
  }
  currentPage.value = 1
  loadKardex()
}

// Manejar selección de vehículo
const onVehicleSelected = vehicle => {
  if (!vehicle) {
    selectedVehicle.value = null
    vehicleProfile.value = null
  } else {
    selectedVehicle.value = vehicle
  }
  currentPage.value = 1
  loadKardex()
}

// Filtrar por vehículo desde chip del cliente
const selectClientVehicle = v => {
  selectedVehicle.value = v
  currentPage.value = 1
  loadKardex()
}

// Limpiar filtros
const resetFilters = () => {
  selectedClient.value = null
  selectedVehicle.value = null
  searchQuery.value = ''
  selectedRange.value = 'all'
  selectedDocType.value = 'all'
  selectedPaymentStatus.value = 'all'
  currentPage.value = 1
  loadKardex()
}

// Generar y abrir PDF de la transacción
const openPDF = sale => {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
  const pdfUrl = `${apiBaseUrl}/sales/${sale.id}/pdf?token=${token}`

  const printWindow = window.open(pdfUrl, '_blank')
  if (printWindow) {
    printWindow.focus()
    showNotification('PDF cargado exitosamente', 'success')
  } else {
    showNotification('Permite ventanas emergentes para visualizar el comprobante', 'warning')
  }
}

// Exportar Reporte General de Kardex en PDF
const exportKardexPDF = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
  const { start, end } = computeDateRange()

  const params = new URLSearchParams()
  params.append('token', token)
  params.append('document_type', selectedDocType.value)
  params.append('payment_status', selectedPaymentStatus.value)

  if (selectedClient.value) {
    const cId = typeof selectedClient.value === 'object' ? selectedClient.value.id : selectedClient.value
    params.append('client_id', cId)
  }

  if (selectedVehicle.value) {
    const vId = typeof selectedVehicle.value === 'object' ? selectedVehicle.value.id : selectedVehicle.value
    params.append('vehicle_id', vId)
  }

  if (searchQuery.value && searchQuery.value.trim()) {
    params.append('search', searchQuery.value.trim())
  }

  if (start) params.append('start_date', start)
  if (end) params.append('end_date', end)

  const pdfUrl = `${apiBaseUrl}/kardex/clientes-vehiculos/pdf?${params.toString()}`

  const printWindow = window.open(pdfUrl, '_blank')
  if (printWindow) {
    printWindow.focus()
    showNotification('Generando Reporte PDF...', 'success')
  } else {
    showNotification('Permite ventanas emergentes para abrir el PDF', 'warning')
  }
}

// Helpers de formato
const formatCurrency = val => {
  const num = parseFloat(val) || 0
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(num)
}

const getDocTypeLabel = type => {
  if (type === 'invoice') return 'Factura'
  if (type === 'sale_note') return 'Nota de Venta'
  if (type === 'quote') return 'Cotización'
  return type?.toUpperCase() || 'Documento'
}

const getDocTypeColor = type => {
  if (type === 'invoice') return 'primary'
  if (type === 'sale_note') return 'success'
  if (type === 'quote') return 'info'
  return 'secondary'
}

const getStatusColor = status => {
  if (status === 'paid') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'partial') return 'info'
  return 'secondary'
}

const getStatusLabel = status => {
  if (status === 'paid') return 'Pagado'
  if (status === 'pending') return 'Pendiente'
  if (status === 'partial') return 'Parcial'
  return status?.toUpperCase() || 'N/A'
}

// Observadores de filtros
watch([selectedDocType, selectedPaymentStatus], () => {
  currentPage.value = 1
  loadKardex()
})

watch(currentPage, () => {
  loadKardex()
})

onMounted(() => {
  fetchClients()
  fetchVehicles()
  loadKardex()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 kardex-client-page">
    <!-- Header Principal -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon
            icon="ri-user-search-line"
            color="primary"
            class="me-2"
            size="32"
          />
          Kardex por Cliente & Vehículo
        </h1>
        <p class="text-medium-emphasis mb-0">
          Auditoría comercial, historial de mantenimientos por placa, consumos y compras
        </p>
      </div>

      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn
          variant="tonal"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="resetFilters"
        >
          Limpiar Filtros
        </VBtn>
        <VBtn
          variant="outlined"
          color="error"
          prepend-icon="ri-file-pdf-2-line"
          :loading="isLoading"
          @click="exportKardexPDF"
        >
          Exportar Reporte PDF
        </VBtn>
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

    <!-- Panel de Filtros Inteligentes -->
    <VCard class="rounded-xl border elevation-0 mb-6 overflow-hidden">
      <div class="pa-4 bg-surface border-b d-flex flex-wrap align-center justify-space-between gap-3">
        <div class="d-flex align-center gap-2">
          <VIcon
            icon="ri-equalizer-line"
            color="primary"
            size="20"
          />
          <span class="font-weight-bold text-subtitle-1">Criterios de Búsqueda & Filtrado</span>
        </div>

        <!-- Botones Expandir / Contraer Detalles -->
        <div class="d-flex align-center gap-2">
          <VBtn
            size="x-small"
            variant="tonal"
            color="primary"
            prepend-icon="ri-arrow-down-s-line"
            @click="expandAll"
          >
            Expandir Todos
          </VBtn>
          <VBtn
            size="x-small"
            variant="tonal"
            color="secondary"
            prepend-icon="ri-arrow-up-s-line"
            @click="collapseAll"
          >
            Contraer Todos
          </VBtn>
        </div>
      </div>

      <VCardText class="pa-4 pa-sm-6">
        <VRow dense>
          <!-- Selector de Cliente (Cédula, RUC, Nombre) -->
          <VCol
            cols="12"
            md="6"
            lg="4"
          >
            <label class="text-caption font-weight-bold text-uppercase text-primary mb-1 d-flex align-center gap-1">
              <VIcon icon="ri-user-3-line" size="14" color="primary" />
              1. Buscar por Cliente / RUC / Cédula
            </label>
            <VAutocomplete
              v-model="selectedClient"
              :items="clientOptions"
              :custom-filter="filterClient"
              item-title="full_name"
              item-value="id"
              return-object
              placeholder="Escribe Cédula, RUC o Nombre..."
              prepend-inner-icon="ri-user-3-line"
              density="comfortable"
              variant="outlined"
              clearable
              :loading="isSearchingClients"
              hide-details
              @update:search="val => val && val.length > 0 && fetchClients(val)"
              @update:model-value="onClientSelected"
            >
              <template #item="{ props: itemProps, item }">
                <VListItem
                  v-bind="itemProps"
                  :title="item.raw.full_name"
                  :subtitle="`C.I / RUC: ${item.raw.n_document || 'S/N'} • Tel: ${item.raw.phone || 'S/N'}`"
                >
                  <template #prepend>
                    <VAvatar
                      size="32"
                      color="primary"
                      variant="tonal"
                      class="me-2 font-weight-bold"
                    >
                      {{ item.raw.full_name?.charAt(0) || 'C' }}
                    </VAvatar>
                  </template>
                  <template #append>
                    <VChip
                      v-if="item.raw.vehicles_count"
                      size="x-small"
                      color="info"
                      variant="tonal"
                    >
                      <VIcon
                        start
                        icon="ri-car-line"
                        size="12"
                      />
                      {{ item.raw.vehicles_count }}
                    </VChip>
                  </template>
                </VListItem>
              </template>
            </VAutocomplete>
          </VCol>

          <!-- Selector de Vehículo / Placa -->
          <VCol
            cols="12"
            md="6"
            lg="4"
          >
            <label class="text-caption font-weight-bold text-uppercase text-success mb-1 d-flex align-center gap-1">
              <VIcon icon="ri-car-line" size="14" color="success" />
              2. Buscar por Vehículo / Placa Automotriz
            </label>
            <VAutocomplete
              v-model="selectedVehicle"
              :items="vehicleOptions"
              :custom-filter="filterVehicle"
              item-title="license_plate"
              item-value="id"
              return-object
              placeholder="Escribe Placa (Ej. ABC-1234)..."
              prepend-inner-icon="ri-car-line"
              density="comfortable"
              variant="outlined"
              clearable
              :loading="isSearchingVehicles"
              hide-details
              @update:search="val => val && val.length > 0 && fetchVehicles(val)"
              @update:model-value="onVehicleSelected"
            >
              <template #item="{ props: itemProps, item }">
                <VListItem
                  v-bind="itemProps"
                  :title="`${item.raw.brand || ''} ${item.raw.model || ''} (${item.raw.year || 'S/A'})`"
                  :subtitle="item.raw.client ? `Dueño: ${item.raw.client.full_name} (${item.raw.client.n_document || ''})` : 'Sin dueño asignado'"
                >
                  <template #prepend>
                    <span class="kardex-plate-badge kardex-plate-badge--sm me-2">
                      {{ item.raw.license_plate }}
                    </span>
                  </template>
                </VListItem>
              </template>
            </VAutocomplete>
          </VCol>

          <!-- Rango de Fechas -->
          <VCol
            cols="12"
            md="6"
            lg="4"
          >
            <label class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-1 d-flex align-center gap-1">
              <VIcon icon="ri-calendar-event-line" size="14" />
              Rango de Fechas
            </label>
            <VSelect
              v-model="selectedRange"
              :items="rangeOptions"
              item-title="title"
              item-value="value"
              density="comfortable"
              variant="outlined"
              hide-details
              prepend-inner-icon="ri-calendar-event-line"
              @update:model-value="loadKardex"
            />
          </VCol>

          <!-- Búsqueda de Texto Libre (Repuestos / OTs / Notas) -->
          <VCol
            cols="12"
            md="6"
            lg="4"
            class="mt-3"
          >
            <label class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-1 d-block">
              🔍 Búsqueda de Repuesto, Servicio u OT
            </label>
            <VTextField
              v-model="searchQuery"
              placeholder="Ej. amortiguador, alineación, OT-001..."
              density="comfortable"
              variant="outlined"
              prepend-inner-icon="ri-search-2-line"
              hide-details
              clearable
              @keyup.enter="loadKardex"
            />
          </VCol>

          <!-- Tipo de Comprobante -->
          <VCol
            cols="12"
            sm="6"
            lg="4"
            class="mt-3"
          >
            <label class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-1 d-block">
              📄 Tipo de Comprobante
            </label>
            <VSelect
              v-model="selectedDocType"
              :items="[
                { title: 'Todos los Comprobantes', value: 'all' },
                { title: 'Facturas Electrónicas', value: 'invoice' },
                { title: 'Notas de Venta / Recibos', value: 'sale_note' },
              ]"
              item-title="title"
              item-value="value"
              density="comfortable"
              variant="outlined"
              hide-details
              prepend-inner-icon="ri-file-list-3-line"
            />
          </VCol>

          <!-- Estado de Pago -->
          <VCol
            cols="12"
            sm="6"
            lg="4"
            class="mt-3"
          >
            <label class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-1 d-block">
              💳 Estado de Pago
            </label>
            <VSelect
              v-model="selectedPaymentStatus"
              :items="[
                { title: 'Todos los Estados', value: 'all' },
                { title: 'Totalmente Pagados', value: 'paid' },
                { title: 'Con Saldo Parcial (Abonado)', value: 'partial' },
                { title: 'Con Saldo Pendiente (Total)', value: 'pending' },
              ]"
              item-title="title"
              item-value="value"
              density="comfortable"
              variant="outlined"
              hide-details
              prepend-inner-icon="ri-money-dollar-circle-line"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Fichas Perfil (Si hay Vehículo o Cliente Seleccionado) -->
    <VRow
      v-if="vehicleProfile || clientProfile"
      class="mb-6"
    >
      <!-- Ficha de Vehículo Seleccionado -->
      <VCol
        v-if="vehicleProfile"
        cols="12"
        :md="clientProfile ? 6 : 12"
      >
        <div class="kardex-profile-card h-100">
          <div class="profile-header-banner d-flex align-center justify-space-between flex-wrap gap-2">
            <div class="d-flex align-center gap-3">
              <span class="kardex-plate-badge kardex-plate-badge--lg">
                {{ vehicleProfile.license_plate }}
              </span>
              <div>
                <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                  {{ vehicleProfile.brand }} {{ vehicleProfile.model }}
                </h3>
                <span class="text-caption text-medium-emphasis">
                  Año {{ vehicleProfile.year || 'N/A' }} • Color: {{ vehicleProfile.color || 'No especificado' }}
                </span>
              </div>
            </div>
            <VChip
              size="small"
              color="primary"
              variant="tonal"
              class="font-weight-bold"
            >
              <VIcon
                start
                icon="ri-speed-up-line"
                size="14"
              />
              {{ vehicleProfile.last_mileage ? `${vehicleProfile.last_mileage.toLocaleString()} km` : 'Km s/n' }}
            </VChip>
          </div>

          <div class="pa-4 d-flex flex-wrap gap-4 align-center justify-space-between bg-surface">
            <div>
              <span class="text-caption text-medium-emphasis d-block">Propietario / Dueño:</span>
              <span class="font-weight-bold text-body-2 text-high-emphasis">
                {{ vehicleProfile.client?.full_name || 'Consumidor Final' }}
              </span>
            </div>
            <div v-if="vehicleProfile.client?.phone">
              <span class="text-caption text-medium-emphasis d-block">Teléfono de Contacto:</span>
              <span class="font-weight-medium text-body-2 font-mono">
                <VIcon
                  icon="ri-phone-line"
                  size="14"
                  class="me-1"
                />
                {{ vehicleProfile.client.phone }}
              </span>
            </div>
          </div>
        </div>
      </VCol>

      <!-- Ficha de Cliente Seleccionado -->
      <VCol
        v-if="clientProfile"
        cols="12"
        :md="vehicleProfile ? 6 : 12"
      >
        <div class="kardex-profile-card h-100">
          <div class="profile-header-banner d-flex align-center justify-space-between flex-wrap gap-2">
            <div class="d-flex align-center gap-3">
              <VAvatar
                size="44"
                color="primary"
                variant="elevated"
                class="font-weight-black text-white"
              >
                {{ clientProfile.full_name?.charAt(0) || 'C' }}
              </VAvatar>
              <div>
                <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                  {{ clientProfile.full_name }}
                </h3>
                <span class="text-caption text-medium-emphasis font-mono">
                  RUC / C.I: {{ clientProfile.n_document || 'Sin documento' }}
                </span>
              </div>
            </div>
            <VChip
              v-if="clientProfile.phone"
              size="small"
              color="success"
              variant="tonal"
              class="font-mono"
            >
              <VIcon
                start
                icon="ri-phone-line"
                size="14"
              />
              {{ clientProfile.phone }}
            </VChip>
          </div>

          <!-- Vehículos del Cliente como Chips Filtrables -->
          <div class="pa-4 bg-surface">
            <span class="text-caption text-medium-emphasis font-weight-bold text-uppercase d-block mb-2">
              Vehículos Registrados:
            </span>
            <div
              v-if="clientProfile.vehicles && clientProfile.vehicles.length"
              class="d-flex flex-wrap gap-2"
            >
              <VChip
                v-for="veh in clientProfile.vehicles"
                :key="veh.id"
                size="small"
                :color="selectedVehicle?.id === veh.id ? 'primary' : 'default'"
                :variant="selectedVehicle?.id === veh.id ? 'elevated' : 'outlined'"
                class="cursor-pointer font-weight-bold"
                @click="selectClientVehicle(veh)"
              >
                <VIcon
                  start
                  icon="ri-car-line"
                  size="14"
                />
                {{ veh.license_plate }} ({{ veh.brand }} {{ veh.model }})
              </VChip>
            </div>
            <span
              v-else
              class="text-caption text-disabled"
            >
              Sin vehículos registrados directamente
            </span>
          </div>
        </div>
      </VCol>
    </VRow>

    <!-- Métricas & KPIs de Kardex -->
    <VRow class="mb-6">
      <!-- Total Facturado -->
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard class="kardex-stat-widget pa-4 elevation-0">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">Total Facturado</span>
            <VAvatar
              size="38"
              color="primary"
              variant="tonal"
              class="rounded-lg"
            >
              <VIcon
                icon="ri-file-list-3-line"
                size="20"
              />
            </VAvatar>
          </div>
          <div class="text-h5 font-weight-black text-high-emphasis mb-1">
            {{ formatCurrency(metrics.total_facturado) }}
          </div>
          <span class="text-caption text-medium-emphasis">
            En {{ metrics.total_transacciones }} {{ metrics.total_transacciones === 1 ? 'comprobante' : 'comprobantes' }}
          </span>
        </VCard>
      </VCol>

      <!-- Total Pagado -->
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard class="kardex-stat-widget pa-4 elevation-0">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-caption font-weight-bold text-uppercase text-success">Total Cobrado</span>
            <VAvatar
              size="38"
              color="success"
              variant="tonal"
              class="rounded-lg"
            >
              <VIcon
                icon="ri-checkbox-circle-line"
                size="20"
              />
            </VAvatar>
          </div>
          <div class="text-h5 font-weight-black text-success mb-1">
            {{ formatCurrency(metrics.total_pagado) }}
          </div>
          <span class="text-caption text-medium-emphasis">
            Liquidado y verificado
          </span>
        </VCard>
      </VCol>

      <!-- Saldo Pendiente -->
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard class="kardex-stat-widget pa-4 elevation-0">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-caption font-weight-bold text-uppercase text-warning">Saldo Pendiente</span>
            <VAvatar
              size="38"
              color="warning"
              variant="tonal"
              class="rounded-lg"
            >
              <VIcon
                icon="ri-time-line"
                size="20"
              />
            </VAvatar>
          </div>
          <div class="text-h5 font-weight-black text-warning mb-1">
            {{ formatCurrency(metrics.saldo_pendiente) }}
          </div>
          <span class="text-caption text-medium-emphasis">
            Por cobrar / crédito
          </span>
        </VCard>
      </VCol>

      <!-- Desglose Repuestos vs Servicios -->
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard class="kardex-stat-widget pa-4 elevation-0">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-caption font-weight-bold text-uppercase text-info">Repuestos & Servicios</span>
            <VAvatar
              size="38"
              color="info"
              variant="tonal"
              class="rounded-lg"
            >
              <VIcon
                icon="ri-tools-line"
                size="20"
              />
            </VAvatar>
          </div>
          <div class="d-flex justify-space-between align-baseline mb-1">
            <span class="text-body-2 font-weight-bold text-medium-emphasis">Repuestos:</span>
            <span class="font-weight-bold text-high-emphasis">{{ formatCurrency(metrics.total_repuestos) }}</span>
          </div>
          <div class="d-flex justify-space-between align-baseline">
            <span class="text-body-2 font-weight-bold text-medium-emphasis">Mano de Obra:</span>
            <span class="font-weight-bold text-primary">{{ formatCurrency(metrics.total_servicios) }}</span>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Lista de Transacciones y Movimientos -->
    <div class="d-flex flex-column gap-4 mb-6">
      <!-- Empty State -->
      <VCard
        v-if="!isLoading && transactions.length === 0"
        class="rounded-xl border pa-12 text-center elevation-0"
      >
        <VAvatar
          size="72"
          color="secondary"
          variant="tonal"
          class="mb-3 rounded-circle"
        >
          <VIcon
            icon="ri-inbox-2-line"
            size="36"
          />
        </VAvatar>
        <h4 class="text-h6 font-weight-bold text-high-emphasis mb-1">
          Sin registros para los filtros seleccionados
        </h4>
        <p
          class="text-body-2 text-medium-emphasis mb-0 mx-auto"
          style="max-width: 420px;"
        >
          No se encontraron facturas o notas de venta con los criterios indicados. Intenta cambiar el cliente o vehículo seleccionado.
        </p>
      </VCard>

      <!-- Transacciones -->
      <VCard
        v-for="tx in transactions"
        :key="tx.id"
        class="kardex-tx-card elevation-0"
      >
        <div class="d-flex flex-column flex-md-row align-stretch">
          <!-- Columna Izquierda: Documento y Fecha -->
          <div
            class="tx-tag-col pa-4 d-flex flex-column justify-center align-start align-md-center"
            style="min-width: 170px;"
          >
            <VChip
              size="small"
              :color="getDocTypeColor(tx.document_type)"
              variant="tonal"
              class="font-weight-bold text-uppercase mb-1"
            >
              {{ getDocTypeLabel(tx.document_type) }}
            </VChip>
            <span class="text-subtitle-2 font-weight-black text-high-emphasis font-mono">
              {{ tx.document_number }}
            </span>
            <span class="text-caption text-medium-emphasis mt-1 d-flex align-center">
              <VIcon
                icon="ri-calendar-line"
                size="13"
                class="me-1"
              />
              {{ tx.date_formatted }}
            </span>
          </div>

          <!-- Columna Central: Cliente, Vehículo, Kilometraje, OT -->
          <div class="pa-4 flex-grow-1 d-flex flex-column justify-center border-t border-md-t-0">
            <div class="d-flex flex-wrap gap-x-6 gap-y-2 mb-2">
              <!-- Vehículo -->
              <div v-if="tx.vehicle">
                <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold d-block">Vehículo</span>
                <div class="d-flex align-center gap-2 mt-0.5">
                  <span class="kardex-plate-badge kardex-plate-badge--sm">
                    {{ tx.vehicle.license_plate }}
                  </span>
                  <span class="font-weight-bold text-body-2 text-high-emphasis">
                    {{ tx.vehicle.brand }} {{ tx.vehicle.model }}
                  </span>
                </div>
              </div>

              <!-- Cliente -->
              <div v-if="tx.client">
                <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold d-block">Cliente</span>
                <div class="d-flex align-center gap-1 mt-0.5">
                  <VIcon
                    icon="ri-user-3-line"
                    size="15"
                    color="primary"
                  />
                  <span class="font-weight-bold text-body-2 text-high-emphasis">
                    {{ tx.client.full_name }}
                  </span>
                </div>
              </div>

              <!-- Kilometraje -->
              <div v-if="tx.mileage">
                <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold d-block">Kilometraje</span>
                <span class="font-weight-bold text-body-2 text-high-emphasis font-mono mt-0.5 d-block">
                  <VIcon
                    icon="ri-speed-up-line"
                    size="14"
                    class="me-1"
                  />
                  {{ parseInt(tx.mileage).toLocaleString() }} km
                </span>
              </div>

              <!-- Orden de Trabajo -->
              <div v-if="tx.work_order_number">
                <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold d-block">Orden de Trabajo</span>
                <VChip
                  size="x-small"
                  color="info"
                  variant="outlined"
                  class="font-weight-bold font-mono mt-0.5"
                >
                  OT #{{ tx.work_order_number }}
                </VChip>
              </div>
            </div>

            <!-- Botón para expandir ítems -->
            <div class="mt-2">
              <VBtn
                size="x-small"
                variant="text"
                color="primary"
                class="px-1"
                :prepend-icon="isExpanded(tx.id) ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"
                @click="toggleExpand(tx.id)"
              >
                {{ isExpanded(tx.id) ? 'Ocultar Detalle' : `Ver ${tx.details.length} ${tx.details.length === 1 ? 'ítem' : 'ítems'} detallados` }}
              </VBtn>
            </div>
          </div>

          <!-- Columna Derecha: Total, Pagado, Saldo & PDF -->
          <div
            class="pa-4 d-flex flex-row flex-md-column align-center justify-space-between justify-md-center align-md-end border-t border-md-t-0 border-md-s gap-2"
            style="min-width: 200px;"
          >
            <div class="text-right">
              <div class="d-flex justify-space-between justify-md-end gap-3 align-baseline">
                <span class="text-caption text-medium-emphasis text-uppercase">Total:</span>
                <span class="text-subtitle-1 font-weight-black text-high-emphasis font-mono">
                  {{ formatCurrency(tx.total) }}
                </span>
              </div>
              <div class="d-flex justify-space-between justify-md-end gap-3 align-baseline text-caption">
                <span class="text-success font-weight-bold">Pagado:</span>
                <span class="font-weight-bold text-success font-mono">
                  {{ formatCurrency(tx.paid_amount) }}
                </span>
              </div>
              <div class="d-flex justify-space-between justify-md-end gap-3 align-baseline text-caption">
                <span :class="tx.due_amount > 0 ? 'text-warning font-weight-bold' : 'text-medium-emphasis'">Saldo:</span>
                <span :class="tx.due_amount > 0 ? 'text-warning font-weight-bold font-mono' : 'text-medium-emphasis font-mono'">
                  {{ formatCurrency(tx.due_amount) }}
                </span>
              </div>
            </div>

            <div class="d-flex align-center gap-2 mt-1">
              <VChip
                size="small"
                :color="getStatusColor(tx.payment_status)"
                variant="tonal"
                class="font-weight-bold text-uppercase"
              >
                {{ getStatusLabel(tx.payment_status) }}
              </VChip>

              <VBtn
                icon
                size="small"
                color="error"
                variant="tonal"
                class="rounded-lg"
                title="Ver y descargar PDF"
                @click.stop="openPDF(tx)"
              >
                <VIcon
                  icon="ri-file-pdf-2-line"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="top"
                >
                  Descargar Comprobante
                </VTooltip>
              </VBtn>
            </div>
          </div>
        </div>

        <!-- Detalle Desplegable de Repuestos y Servicios -->
        <VExpandTransition>
          <div
            v-if="isExpanded(tx.id)"
            class="pa-4 bg-grey-lighten-5 border-t"
          >
            <div class="kardex-nested-table bg-surface">
              <VTable density="compact">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Código / SKU</th>
                    <th>Descripción del Producto o Servicio</th>
                    <th class="text-center">
                      Cant.
                    </th>
                    <th class="text-right">
                      P. Unit.
                    </th>
                    <th class="text-right">
                      Subtotal
                    </th>
                    <th class="text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="detail in tx.details"
                    :key="detail.id"
                  >
                    <td>
                      <VChip
                        size="x-small"
                        :color="detail.tipo === 'servicio' ? 'primary' : 'success'"
                        variant="tonal"
                        class="font-weight-bold text-uppercase"
                      >
                        {{ detail.tipo }}
                      </VChip>
                    </td>
                    <td class="font-mono text-caption font-weight-medium">
                      {{ detail.sku || '—' }}
                    </td>
                    <td class="font-weight-bold text-high-emphasis">
                      {{ detail.description }}
                    </td>
                    <td class="text-center font-mono font-weight-bold">
                      {{ detail.quantity }}
                    </td>
                    <td class="text-right font-mono">
                      {{ formatCurrency(detail.unit_price) }}
                    </td>
                    <td class="text-right font-mono text-medium-emphasis">
                      {{ formatCurrency(detail.subtotal) }}
                    </td>
                    <td class="text-right font-mono font-weight-bold text-primary">
                      {{ formatCurrency(detail.total) }}
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </div>
          </div>
        </VExpandTransition>
      </VCard>
    </div>

    <!-- Paginación -->
    <div
      v-if="totalPages > 1"
      class="d-flex justify-center align-center py-4"
    >
      <VPagination
        v-model="currentPage"
        :length="totalPages"
        rounded="circle"
        active-color="primary"
        density="comfortable"
      />
    </div>
  </div>
</template>
