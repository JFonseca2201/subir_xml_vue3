<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const isVisible = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
})

const loading = ref(false)
const selectedMonth = ref('')
const sortBy = ref('revenue') // 'revenue' | 'quantity'
const activeTab = ref('products') // 'products' | 'services' | 'all'
const filterSearch = ref('')

const data = ref({
  month_key: '',
  month_name: '',
  summary: {
    grand_total_revenue: 0,
    grand_total_quantity: 0,
    products_revenue: 0,
    products_quantity: 0,
    products_unique_count: 0,
    services_revenue: 0,
    services_quantity: 0,
    services_unique_count: 0,
  },
  products: [],
  services: [],
  available_months: [],
})

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value || 0)
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      sort_by: sortBy.value,
    }
    if (selectedMonth.value) {
      params.month = selectedMonth.value
    }

    const response = await $api('dashboard/monthly-sales-breakdown', { params })

    if (response.success) {
      data.value = response
      if (!selectedMonth.value) {
        selectedMonth.value = response.month_key
      }
    }
  } catch (error) {
    console.error('Error al cargar ventas mensuales:', error)
  } finally {
    loading.value = false
  }
}

watch(isVisible, val => {
  if (val) {
    loadData()
  }
})

watch([selectedMonth, sortBy], () => {
  if (isVisible.value) {
    loadData()
  }
})

// Filtered lists
const filteredProducts = computed(() => {
  if (!data.value.products) return []
  const q = filterSearch.value.trim().toLowerCase()
  if (!q) return data.value.products

  return data.value.products.filter(p =>
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.sku && p.sku.toLowerCase().includes(q)),
  )
})

const filteredServices = computed(() => {
  if (!data.value.services) return []
  const q = filterSearch.value.trim().toLowerCase()
  if (!q) return data.value.services

  return data.value.services.filter(s =>
    (s.name && s.name.toLowerCase().includes(q)) ||
    (s.sku && s.sku.toLowerCase().includes(q)),
  )
})

const allUnifiedList = computed(() => {
  const prod = (data.value.products || []).map(p => ({ ...p, type_label: 'Producto', type_color: 'primary' }))
  const serv = (data.value.services || []).map(s => ({ ...s, type_label: 'Servicio', type_color: 'info' }))
  
  const merged = [...prod, ...serv]
  
  if (sortBy.value === 'quantity') {
    merged.sort((a, b) => b.quantity - a.quantity)
  } else {
    merged.sort((a, b) => b.revenue - a.revenue)
  }

  const q = filterSearch.value.trim().toLowerCase()
  if (!q) return merged

  return merged.filter(item =>
    (item.name && item.name.toLowerCase().includes(q)) ||
    (item.sku && item.sku.toLowerCase().includes(q)),
  )
})

const getRankColor = index => {
  if (index === 0) return '#FFD700' // Oro
  if (index === 1) return '#C0C0C0' // Plata
  if (index === 2) return '#CD7F32' // Bronce
  return 'secondary'
}

const getRankIcon = index => {
  if (index === 0) return 'ri-medal-fill text-amber'
  if (index === 1) return 'ri-medal-fill text-blue-grey'
  if (index === 2) return 'ri-medal-fill text-orange-darken-2'
  return 'ri-hashtag'
}
</script>

<template>
  <VDialog
    v-model="isVisible"
    max-width="1100"
    scrollable
    transition="dialog-bottom-transition"
  >
    <VCard class="custom-dialog-card elevation-24">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="isVisible = false"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-bar-chart-grouped-fill" />
        </div>
        <h3 class="custom-dialog-title">
          Reporte de Ventas por Mes (Mayor a Menor)
        </h3>
        <p class="custom-dialog-subtitle">
          Desglose detallado comparando Productos Físicos vs. Servicios del Taller
        </p>
      </div>

      <!-- Barra de Filtros Rápidos -->
      <div class="pa-4 bg-grey-lighten-4 border-b d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center flex-wrap gap-3">
          <!-- Selector de Mes -->
          <div style="min-width: 200px; width: 220px;">
            <VSelect
              v-model="selectedMonth"
              :items="data.available_months"
              item-title="label"
              item-value="key"
              density="compact"
              variant="outlined"
              hide-details
              bg-color="white"
              prepend-inner-icon="ri-calendar-event-line"
              label="Mes de Consulta"
            />
          </div>

          <!-- Criterio de Ordenamiento -->
          <div style="min-width: 220px; width: 240px;">
            <VSelect
              v-model="sortBy"
              :items="[
                { title: 'Por Mayor Monto ($)', value: 'revenue' },
                { title: 'Por Mayor Cantidad (U.)', value: 'quantity' },
              ]"
              item-title="title"
              item-value="value"
              density="compact"
              variant="outlined"
              hide-details
              bg-color="white"
              prepend-inner-icon="ri-sort-desc"
              label="Criterio de Orden"
            />
          </div>
        </div>

        <!-- Buscador Rápido -->
        <div style="min-width: 250px; width: 280px;">
          <VTextField
            v-model="filterSearch"
            density="compact"
            placeholder="Filtrar por nombre o SKU..."
            prepend-inner-icon="ri-search-line"
            variant="outlined"
            hide-details
            bg-color="white"
            clearable
          />
        </div>
      </div>

      <VCardText class="pa-5" style="max-height: 70vh;">
        <!-- Indicador de Carga -->
        <div
          v-if="loading"
          class="py-12 text-center"
        >
          <VProgressCircular
            indeterminate
            color="primary"
            size="54"
            width="4"
          />
          <div class="text-subtitle-1 font-weight-bold mt-4 text-medium-emphasis">
            Analizando y ordenando ventas del mes...
          </div>
        </div>

        <div v-else>
          <!-- Tarjetas KPI Resumen del Mes -->
          <VRow class="mb-5" dense>
            <!-- Gran Total -->
            <VCol
              cols="12"
              md="4"
            >
              <VCard
                elevation="0"
                class="pa-4 rounded-xl border bg-purple-lighten-5 border-purple-lighten-4"
              >
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-caption font-weight-bold text-uppercase text-purple-darken-2">
                      Total Facturado Mes ({{ data.month_name }})
                    </div>
                    <div class="text-h5 font-weight-black text-purple-darken-3 mt-1">
                      {{ formatCurrency(data.summary.grand_total_revenue) }}
                    </div>
                    <div class="text-caption text-purple-darken-1 font-weight-medium">
                      {{ Number(data.summary.grand_total_quantity).toLocaleString() }} unidades/servicios vendidos
                    </div>
                  </div>
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    size="48"
                  >
                    <VIcon
                      icon="ri-money-dollar-box-line"
                      size="26"
                    />
                  </VAvatar>
                </div>
              </VCard>
            </VCol>

            <!-- Total Productos -->
            <VCol
              cols="12"
              sm="6"
              md="4"
            >
              <VCard
                elevation="0"
                class="pa-4 rounded-xl border bg-indigo-lighten-5 border-indigo-lighten-4"
              >
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-caption font-weight-bold text-uppercase text-indigo-darken-2">
                      📦 Productos / Repuestos Físicos
                    </div>
                    <div class="text-h5 font-weight-black text-indigo-darken-3 mt-1">
                      {{ formatCurrency(data.summary.products_revenue) }}
                    </div>
                    <div class="text-caption text-indigo-darken-1 font-weight-medium">
                      {{ Number(data.summary.products_quantity).toLocaleString() }} unidades ({{ data.summary.products_unique_count }} ítems)
                    </div>
                  </div>
                  <VAvatar
                    color="indigo"
                    variant="tonal"
                    size="48"
                  >
                    <VIcon
                      icon="ri-box-3-line"
                      size="26"
                    />
                  </VAvatar>
                </div>
              </VCard>
            </VCol>

            <!-- Total Servicios -->
            <VCol
              cols="12"
              sm="6"
              md="4"
            >
              <VCard
                elevation="0"
                class="pa-4 rounded-xl border bg-teal-lighten-5 border-teal-lighten-4"
              >
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-caption font-weight-bold text-uppercase text-teal-darken-2">
                      🔧 Servicios / Mano de Obra
                    </div>
                    <div class="text-h5 font-weight-black text-teal-darken-3 mt-1">
                      {{ formatCurrency(data.summary.services_revenue) }}
                    </div>
                    <div class="text-caption text-teal-darken-1 font-weight-medium">
                      {{ Number(data.summary.services_quantity).toLocaleString() }} servicios realizados ({{ data.summary.services_unique_count }} tipos)
                    </div>
                  </div>
                  <VAvatar
                    color="teal"
                    variant="tonal"
                    size="48"
                  >
                    <VIcon
                      icon="ri-tools-line"
                      size="26"
                    />
                  </VAvatar>
                </div>
              </VCard>
            </VCol>
          </VRow>

          <!-- Pestañas de Navegación de Venta -->
          <VTabs
            v-model="activeTab"
            color="primary"
            align-tabs="start"
            class="mb-4 border-b"
          >
            <VTab
              value="products"
              class="font-weight-bold text-capitalize"
            >
              <VIcon
                start
                icon="ri-box-3-line"
              />
              Productos Físicos ({{ filteredProducts.length }})
            </VTab>
            <VTab
              value="services"
              class="font-weight-bold text-capitalize"
            >
              <VIcon
                start
                icon="ri-tools-line"
              />
              Servicios de Taller ({{ filteredServices.length }})
            </VTab>
            <VTab
              value="all"
              class="font-weight-bold text-capitalize"
            >
              <VIcon
                start
                icon="ri-list-check-2"
              />
              Ranking General Unificado ({{ allUnifiedList.length }})
            </VTab>
          </VTabs>

          <!-- TAB 1: PRODUCTOS -->
          <div v-if="activeTab === 'products'">
            <div
              v-if="filteredProducts.length === 0"
              class="pa-10 text-center text-medium-emphasis d-flex flex-column align-center justify-center"
            >
              <VAvatar
                color="primary"
                variant="tonal"
                size="64"
                class="mb-3"
              >
                <VIcon
                  icon="ri-dropbox-line"
                  size="36"
                />
              </VAvatar>
              <div class="text-body-1 font-weight-medium">
                No se registraron ventas de productos físicos en el período seleccionado.
              </div>
            </div>

            <VTable
              v-else
              hover
              density="comfortable"
              class="border rounded-lg overflow-hidden sales-ranking-table"
            >
              <thead>
                <tr class="bg-grey-lighten-4">
                  <th class="text-center font-weight-bold py-3" style="width: 70px;">
                    RANK
                  </th>
                  <th class="text-left font-weight-bold py-3">
                    PRODUCTO / REPUESTO
                  </th>
                  <th class="text-center font-weight-bold py-3" style="width: 130px;">
                    CANTIDAD
                  </th>
                  <th class="text-right font-weight-bold py-3" style="width: 140px;">
                    PRECIO PROM.
                  </th>
                  <th class="text-right font-weight-bold py-3" style="width: 160px;">
                    TOTAL FACTURADO
                  </th>
                  <th class="text-center font-weight-bold py-3" style="width: 140px;">
                    % DE PRODUCTOS
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in filteredProducts"
                  :key="`prod-${idx}`"
                >
                  <td class="text-center">
                    <VChip
                      v-if="idx < 3"
                      size="small"
                      :color="getRankColor(idx)"
                      variant="flat"
                      class="font-weight-black text-white"
                    >
                      #{{ item.rank || (idx + 1) }}
                    </VChip>
                    <span
                      v-else
                      class="font-weight-bold text-medium-emphasis text-caption"
                    >
                      #{{ item.rank || (idx + 1) }}
                    </span>
                  </td>
                  <td>
                    <div class="font-weight-bold text-high-emphasis">
                      {{ item.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      SKU: <span class="font-mono">{{ item.sku }}</span> • en {{ item.sales_count }} factura(s)
                    </div>
                  </td>
                  <td class="text-center">
                    <VChip
                      color="primary"
                      variant="tonal"
                      size="small"
                      class="font-weight-bold font-mono"
                    >
                      {{ Number(item.quantity).toLocaleString() }} u.
                    </VChip>
                  </td>
                  <td class="text-right font-mono text-medium-emphasis">
                    {{ formatCurrency(item.avg_price) }}
                  </td>
                  <td class="text-right">
                    <span class="text-subtitle-1 font-weight-bold text-success font-mono">
                      {{ formatCurrency(item.revenue) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <div class="d-flex align-center gap-2 justify-center">
                      <VProgressLinear
                        :model-value="data.summary.products_revenue > 0 ? (item.revenue / data.summary.products_revenue) * 100 : 0"
                        color="primary"
                        height="6"
                        rounded
                        style="width: 60px;"
                      />
                      <span class="text-caption font-weight-bold text-medium-emphasis" style="min-width: 35px;">
                        {{ data.summary.products_revenue > 0 ? Math.round((item.revenue / data.summary.products_revenue) * 100) : 0 }}%
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>

          <!-- TAB 2: SERVICIOS -->
          <div v-if="activeTab === 'services'">
            <div
              v-if="filteredServices.length === 0"
              class="pa-8 text-center text-medium-emphasis"
            >
              <VIcon
                icon="ri-inbox-line"
                size="48"
                class="mb-2 opacity-50"
              />
              <div>No se registraron ventas de servicios en el período seleccionado.</div>
            </div>

            <VTable
              v-else
              hover
              density="comfortable"
              class="border rounded-lg overflow-hidden sales-ranking-table"
            >
              <thead>
                <tr class="bg-grey-lighten-4">
                  <th class="text-center font-weight-bold py-3" style="width: 70px;">
                    RANK
                  </th>
                  <th class="text-left font-weight-bold py-3">
                    SERVICIO / MANO DE OBRA
                  </th>
                  <th class="text-center font-weight-bold py-3" style="width: 130px;">
                    VECES REALIZADO
                  </th>
                  <th class="text-right font-weight-bold py-3" style="width: 140px;">
                    PRECIO PROM.
                  </th>
                  <th class="text-right font-weight-bold py-3" style="width: 160px;">
                    TOTAL FACTURADO
                  </th>
                  <th class="text-center font-weight-bold py-3" style="width: 140px;">
                    % DE SERVICIOS
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in filteredServices"
                  :key="`serv-${idx}`"
                >
                  <td class="text-center">
                    <VChip
                      v-if="idx < 3"
                      size="small"
                      :color="getRankColor(idx)"
                      variant="flat"
                      class="font-weight-black text-white"
                    >
                      #{{ item.rank || (idx + 1) }}
                    </VChip>
                    <span
                      v-else
                      class="font-weight-bold text-medium-emphasis text-caption"
                    >
                      #{{ item.rank || (idx + 1) }}
                    </span>
                  </td>
                  <td>
                    <div class="font-weight-bold text-high-emphasis">
                      {{ item.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ item.sku !== 'S/N' ? `Código: ${item.sku} • ` : '' }}en {{ item.sales_count }} factura(s) / orden(es)
                    </div>
                  </td>
                  <td class="text-center">
                    <VChip
                      color="teal"
                      variant="tonal"
                      size="small"
                      class="font-weight-bold font-mono"
                    >
                      {{ Number(item.quantity).toLocaleString() }} servicios
                    </VChip>
                  </td>
                  <td class="text-right font-mono text-medium-emphasis">
                    {{ formatCurrency(item.avg_price) }}
                  </td>
                  <td class="text-right">
                    <span class="text-subtitle-1 font-weight-bold text-teal-darken-2 font-mono">
                      {{ formatCurrency(item.revenue) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <div class="d-flex align-center gap-2 justify-center">
                      <VProgressLinear
                        :model-value="data.summary.services_revenue > 0 ? (item.revenue / data.summary.services_revenue) * 100 : 0"
                        color="teal"
                        height="6"
                        rounded
                        style="width: 60px;"
                      />
                      <span class="text-caption font-weight-bold text-medium-emphasis" style="min-width: 35px;">
                        {{ data.summary.services_revenue > 0 ? Math.round((item.revenue / data.summary.services_revenue) * 100) : 0 }}%
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>

          <!-- TAB 3: UNIFICADO (PRODUCTOS + SERVICIOS) -->
          <div v-if="activeTab === 'all'">
            <div
              v-if="allUnifiedList.length === 0"
              class="pa-8 text-center text-medium-emphasis"
            >
              <VIcon
                icon="ri-inbox-line"
                size="48"
                class="mb-2 opacity-50"
              />
              <div>No se registraron ventas en el período seleccionado.</div>
            </div>

            <VTable
              v-else
              hover
              density="comfortable"
              class="border rounded-lg overflow-hidden sales-ranking-table"
            >
              <thead>
                <tr class="bg-grey-lighten-4">
                  <th class="text-center font-weight-bold py-3" style="width: 70px;">
                    POS.
                  </th>
                  <th class="text-left font-weight-bold py-3">
                    ÍTEM / DESCRIPCIÓN
                  </th>
                  <th class="text-center font-weight-bold py-3" style="width: 120px;">
                    TIPO
                  </th>
                  <th class="text-center font-weight-bold py-3" style="width: 120px;">
                    CANTIDAD
                  </th>
                  <th class="text-right font-weight-bold py-3" style="width: 140px;">
                    PRECIO PROM.
                  </th>
                  <th class="text-right font-weight-bold py-3" style="width: 160px;">
                    TOTAL FACTURADO
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in allUnifiedList"
                  :key="`all-${idx}`"
                >
                  <td class="text-center">
                    <span class="font-weight-black text-caption">
                      #{{ idx + 1 }}
                    </span>
                  </td>
                  <td>
                    <div class="font-weight-bold text-high-emphasis">
                      {{ item.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      SKU/Código: {{ item.sku }}
                    </div>
                  </td>
                  <td class="text-center">
                    <VChip
                      :color="item.type_color"
                      variant="tonal"
                      size="x-small"
                      class="font-weight-bold"
                    >
                      {{ item.type_label }}
                    </VChip>
                  </td>
                  <td class="text-center font-mono font-weight-bold">
                    {{ Number(item.quantity).toLocaleString() }}
                  </td>
                  <td class="text-right font-mono text-medium-emphasis">
                    {{ formatCurrency(item.avg_price) }}
                  </td>
                  <td class="text-right">
                    <span class="text-subtitle-1 font-weight-bold text-high-emphasis font-mono">
                      {{ formatCurrency(item.revenue) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-grey-lighten-5 justify-space-between align-center">
        <div class="text-caption text-medium-emphasis">
          Datos calculados directamente desde las ventas confirmadas en la base de datos
        </div>
        <VBtn
          color="secondary"
          variant="outlined"
          class="font-weight-bold text-none px-6"
          @click="isVisible = false"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.sales-ranking-table th {
  letter-spacing: 0.5px;
  font-size: 0.75rem !important;
}

.sales-ranking-table tbody tr:hover {
  background-color: #f8fafc !important;
}
</style>
