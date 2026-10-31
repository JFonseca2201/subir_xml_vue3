<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'addItem'])

const { showNotification } = useGlobalToast()

// Data states
const items = ref([])
const suppliers = ref([])
const categories = ref([])
const isLoading = ref(false)
const isCategoriesLoading = ref(false)

// Filters & Pagination
const searchQuery = ref('')
const debouncedSearch = ref('')
const selectedSupplierId = ref('all')
const selectedCategory = ref('ALL')
const selectedStockStatus = ref('ALL')
const currentPage = ref(1)
const perPage = ref(10)
const totalItems = ref(0)
const totalPages = ref(1)

// Pricing & Profit Margin for quoting
const profitMarginPercent = ref(30) // Margen de ganancia estándar sugerido para repuestos
const quickMargins = [0, 15, 25, 30, 40, 50]
const taxPercent = 15 // IVA Ecuador 15%

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

// Opciones de distribuidores
const supplierOptions = computed(() => {
  const active = suppliers.value.filter(s => Number(s.total_items) > 0)

  return [
    { title: 'Todos los Proveedores con Catálogo', value: 'all' },
    ...active.map(s => ({
      title: `${s.name} (${s.total_items} items)`,
      value: s.id,
      name: s.name,
    })),
  ]
})

// Opciones de categorías
const categoryOptions = computed(() => {
  return [
    { title: 'Todas las Categorías', value: 'ALL' },
    ...categories.value.map(c => ({
      title: `${c.category_name} (${c.total_items})`,
      value: c.category_name,
    })),
  ]
})

// Cargar distribuidores con catálogo
const loadSuppliers = async () => {
  try {
    const response = await $api('distributor-catalog/suppliers')
    suppliers.value = response?.data || []
  } catch (err) {
    console.error('Error al cargar distribuidores:', err)
  }
}

// Cargar categorías del distribuidor seleccionado
const loadCategories = async () => {
  isCategoriesLoading.value = true
  try {
    const params = {}
    if (selectedSupplierId.value && selectedSupplierId.value !== 'all') {
      params.supplier_id = selectedSupplierId.value
    }
    const response = await $api('distributor-catalog/categories', { params })
    categories.value = response?.data || []
  } catch (err) {
    console.error('Error al cargar categorías:', err)
  } finally {
    isCategoriesLoading.value = false
  }
}

// Cargar productos del catálogo
const loadCatalog = async () => {
  isLoading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: perPage.value,
    }

    if (selectedSupplierId.value && selectedSupplierId.value !== 'all') {
      params.supplier_id = selectedSupplierId.value
    }
    if (selectedCategory.value && selectedCategory.value !== 'ALL') {
      params.category = selectedCategory.value
    }
    if (selectedStockStatus.value && selectedStockStatus.value !== 'ALL') {
      params.stock_status = selectedStockStatus.value
    }
    if (debouncedSearch.value && debouncedSearch.value.trim()) {
      params.search = debouncedSearch.value.trim()
    }

    const response = await $api('distributor-catalog', { params })
    if (response) {
      items.value = response.data || []
      totalItems.value = response.total || 0
      totalPages.value = response.last_page || 1
    }
  } catch (err) {
    console.error('Error al cargar catálogo de distribuidores:', err)
  } finally {
    isLoading.value = false
  }
}

// Debounce para búsqueda
let debounceTimer = null
watch(searchQuery, val => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = val
    currentPage.value = 1
    loadCatalog()
  }, 350)
})

watch([selectedSupplierId, selectedCategory, selectedStockStatus], () => {
  currentPage.value = 1
  loadCatalog()
})

watch(selectedSupplierId, () => {
  selectedCategory.value = 'ALL'
  loadCategories()
})

watch(currentPage, () => {
  loadCatalog()
})

watch(perPage, () => {
  currentPage.value = 1
  loadCatalog()
})

// Cálculos de precios con margen y con IVA
const calculateQuotedPrice = costPrice => {
  const cost = Number(costPrice) || 0
  const margin = Number(profitMarginPercent.value) || 0
  
  // Precio de venta neto antes de IVA con margen de ganancia
  const priceBeforeTax = cost * (1 + (margin / 100))
  
  // PVP con IVA 15%
  const priceWithTax = priceBeforeTax * (1 + (taxPercent / 100))

  return parseFloat(priceWithTax.toFixed(2))
}

const getStockPillClass = status => {
  if (!status) return 'status-paid'
  const s = status.toLowerCase()
  if (s.includes('disponible') || s.includes('en stock')) return 'status-paid'
  if (s.includes('stock <=') || s.includes('bajo') || s.includes('10')) return 'status-partial'
  if (s.includes('agotado') || s.includes('sin stock')) return 'status-pending'
  if (s.includes('tránsito') || s.includes('transito') || s.includes('pedido')) return 'status-transfer'
  return 'status-quote'
}

const getStockBadgeColor = status => {
  if (!status) return 'grey'
  const s = status.toLowerCase()
  if (s.includes('disponible')) return 'success'
  if (s.includes('stock <=') || s.includes('bajo') || s.includes('10')) return 'warning'
  if (s.includes('tránsito') || s.includes('transito')) return 'info'
  return 'secondary'
}

// Acción de agregar a la cotización
const addToQuote = item => {
  const quotedPrice = calculateQuotedPrice(item.price)
  const supplierLabel = item.supplier?.name || item.supplier_name || 'Proveedor'

  const itemPayload = {
    product_id: null,
    description: `${item.description} [${supplierLabel}]`,
    sku: item.code || item.reference || `CAT-${item.id}`,
    price: quotedPrice,
    cost_price: Number(item.price) || 0,
    quantity: 1,
    discount: 0,
    type: 'product',
    supplier_id: item.supplier_id,
    supplier_name: supplierLabel,
    is_manual: true,
    is_external: true,
  }

  emit('addItem', itemPayload)
}

watch(() => props.isDialogVisible, val => {
  if (val) {
    if (suppliers.value.length === 0) {
      loadSuppliers()
    }
    if (categories.value.length === 0) {
      loadCategories()
    }
    loadCatalog()
  }
})

onMounted(() => {
  if (props.isDialogVisible) {
    loadSuppliers()
    loadCategories()
    loadCatalog()
  }
})
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="1200"
    width="96vw"
    scrollable
    @update:model-value="closeDialog"
  >
    <VCard class="custom-dialog-card catalog-search-card rounded-xl">
      <!-- Cabecera del diálogo según el estándar del sistema -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          aria-label="Cerrar catálogo"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon
            icon="ri-store-2-line"
            size="26"
          />
        </div>
        <h3 class="custom-dialog-title">
          Catálogo de Distribuidores y Proveedores
        </h3>
        <p class="custom-dialog-subtitle">
          Consulte repuestos disponibles con precios mayoristas y agréguelos con margen a la cotización
        </p>
      </div>

      <VCardText class="pa-5">
        <!-- Barra de Búsqueda y Filtros -->
        <VRow class="mb-2">
          <!-- Búsqueda por texto / SKU -->
          <VCol
            cols="12"
            md="5"
          >
            <VTextField
              v-model="searchQuery"
              prepend-inner-icon="ri-search-line"
              label="Buscar por Nombre, Código o SKU del Repuesto..."
              placeholder="Ej: amortiguador, pastilla, filtro, 03-005..."
              density="compact"
              variant="outlined"
              clearable
              hide-details
              autofocus
            />
          </VCol>

          <!-- Filtro por Distribuidor -->
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VSelect
              v-model="selectedSupplierId"
              :items="supplierOptions"
              item-title="title"
              item-value="value"
              prepend-inner-icon="ri-building-line"
              label="Distribuidor / Proveedor"
              density="compact"
              variant="outlined"
              hide-details
            />
          </VCol>

          <!-- Filtro por Categoría -->
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="selectedCategory"
              :items="categoryOptions"
              item-title="title"
              item-value="value"
              prepend-inner-icon="ri-folder-2-line"
              label="Categoría"
              density="compact"
              variant="outlined"
              :loading="isCategoriesLoading"
              hide-details
            />
          </VCol>
        </VRow>

        <!-- Barra de Configuración de Margen Comercial Sugerido -->
        <div class="profit-margin-bar d-flex align-center justify-space-between flex-wrap gap-3 pa-3 rounded-lg border bg-surface-variant-subtle mb-4">
          <div class="d-flex align-center gap-2">
            <VIcon
              icon="ri-percent-line"
              size="20"
              color="primary"
            />
            <span class="text-caption font-weight-bold text-slate-700">
              Margen de Ganancia sugerido para cotizar:
            </span>
            <div class="d-flex align-center gap-1">
              <VBtn
                v-for="margin in quickMargins"
                :key="margin"
                size="x-small"
                :variant="profitMarginPercent === margin ? 'elevated' : 'outlined'"
                :color="profitMarginPercent === margin ? 'primary' : 'secondary'"
                class="font-weight-bold"
                @click="profitMarginPercent = margin"
              >
                {{ margin }}%
              </VBtn>
            </div>
          </div>

          <div class="d-flex align-center gap-2">
            <span class="text-caption text-medium-emphasis">Margen personalizado:</span>
            <VTextField
              v-model.number="profitMarginPercent"
              type="number"
              suffix="%"
              density="compact"
              variant="outlined"
              style="width: 100px;"
              hide-details
              min="0"
              max="200"
            />
            <span class="text-caption text-disabled">(+15% IVA incluido en precio cotizado)</span>
          </div>
        </div>

        <!-- Tabla de Resultados -->
        <div class="table-responsive border rounded-xl overflow-hidden position-relative">
          <VProgressLinear
            v-if="isLoading"
            indeterminate
            color="primary"
            class="position-absolute top-0 w-100"
            style="z-index: 5;"
          />

          <VTable
            hover
            density="comfortable"
            class="catalog-items-table"
          >
            <thead>
              <tr class="bg-light-subtle text-caption">
                <th class="text-left py-3 font-weight-bold" style="width: 15%; min-width: 110px;">
                  Distribuidor
                </th>
                <th class="text-left py-3 font-weight-bold" style="width: 13%; min-width: 100px;">
                  Código / SKU
                </th>
                <th class="text-left py-3 font-weight-bold" style="width: 32%;">
                  Descripción / Repuesto
                </th>
                <th class="text-center py-3 font-weight-bold" style="width: 12%; min-width: 95px;">
                  Estado / Stock
                </th>
                <th class="text-right py-3 font-weight-bold" style="width: 9%; min-width: 75px;">
                  Costo Prov.
                </th>
                <th class="text-right py-3 font-weight-bold text-primary" style="width: 10%; min-width: 85px;">
                  PVP Cotizado
                </th>
                <th class="text-center py-3 font-weight-bold" style="width: 9%; min-width: 85px;">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-if="!isLoading && items.length === 0"
                class="text-center"
              >
                <td
                  colspan="7"
                  class="py-8 text-medium-emphasis"
                >
                  <VIcon
                    icon="ri-inbox-line"
                    size="36"
                    class="d-block mx-auto mb-2 opacity-50"
                  />
                  No se encontraron productos en el catálogo para los filtros aplicados.
                </td>
              </tr>

              <tr
                v-for="item in items"
                :key="item.id"
                class="catalog-item-row"
              >
                <!-- Distribuidor (Avatar + Nombre limpio sin chip genérico) -->
                <td class="py-3">
                  <div class="d-flex align-center gap-2">
                    <VAvatar
                      size="28"
                      color="primary"
                      variant="tonal"
                      rounded="md"
                      class="flex-shrink-0 font-weight-bold"
                    >
                      <VIcon icon="ri-store-2-line" size="14" />
                    </VAvatar>
                    <div class="min-w-0">
                      <div
                        class="font-weight-semibold text-body-2 text-truncate"
                        :title="item.supplier?.name || item.supplier_name || 'Proveedor'"
                      >
                        {{ item.supplier?.name || item.supplier_name || 'Proveedor' }}
                      </div>
                      <div
                        v-if="item.supplier?.code || item.supplier?.ruc"
                        class="text-caption text-disabled font-monospace"
                      >
                        {{ item.supplier?.code || item.supplier?.ruc }}
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Código / SKU -->
                <td class="py-3">
                  <div class="font-weight-medium text-body-2 font-monospace">
                    {{ item.code || '-' }}
                  </div>
                  <div
                    v-if="item.reference"
                    class="text-caption text-medium-emphasis"
                  >
                    Ref: {{ item.reference }}
                  </div>
                </td>

                <!-- Descripción -->
                <td class="py-3">
                  <div class="font-weight-medium text-body-2 line-clamp-2">
                    {{ item.description }}
                  </div>
                  <div
                    v-if="item.category_name"
                    class="text-caption text-disabled"
                  >
                    {{ item.category_name }}
                  </div>
                </td>

                <!-- Estado / Stock (Pill limpia acorde al sistema con status-dot) -->
                <td class="text-center py-3">
                  <div
                    class="status-pill-clean mx-auto"
                    :class="getStockPillClass(item.stock_status)"
                  >
                    <span class="status-dot" />
                    <span>{{ item.stock_status || 'Disponible' }}</span>
                  </div>
                </td>

                <!-- Costo Mayorista -->
                <td class="text-right py-3 text-body-2 text-medium-emphasis">
                  ${{ (Number(item.price) || 0).toFixed(2) }}
                </td>

                <!-- PVP Cotizado (Costo + Margen + IVA 15%) -->
                <td class="text-right py-3">
                  <div class="font-weight-bold text-body-2 text-primary">
                    ${{ calculateQuotedPrice(item.price).toFixed(2) }}
                  </div>
                  <div class="text-caption text-success font-weight-medium">
                    +{{ profitMarginPercent }}% util.
                  </div>
                </td>

                <!-- Botón Cotizar estilizado -->
                <td class="text-center py-3">
                  <VBtn
                    color="primary"
                    size="small"
                    variant="elevated"
                    prepend-icon="ri-add-line"
                    class="btn-cotizar-action text-none font-weight-bold rounded-lg elevation-1"
                    @click="addToQuote(item)"
                  >
                    Cotizar
                  </VBtn>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>

        <!-- Paginación -->
        <div
          v-if="totalItems > 0"
          class="d-flex align-center justify-space-between flex-wrap gap-3 mt-4 px-2"
        >
          <div class="d-flex align-center flex-wrap gap-3">
            <span class="text-caption text-medium-emphasis">
              Mostrando {{ items.length }} de <strong>{{ totalItems }}</strong> productos disponibles
            </span>
            <div class="d-flex align-center gap-1">
              <span class="text-caption text-disabled">Mostrar:</span>
              <VBtnToggle
                v-model="perPage"
                mandatory
                density="compact"
                size="x-small"
                variant="outlined"
                color="primary"
                rounded="lg"
              >
                <VBtn
                  :value="10"
                  size="x-small"
                  class="px-2 font-weight-bold"
                >
                  10
                </VBtn>
                <VBtn
                  :value="12"
                  size="x-small"
                  class="px-2 font-weight-bold"
                >
                  12
                </VBtn>
              </VBtnToggle>
            </div>
          </div>

          <VPagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="5"
            density="compact"
            size="small"
            rounded="circle"
          />
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 px-6 justify-space-between align-center bg-surface-variant-subtle border-t">
        <div class="text-caption text-medium-emphasis d-none d-sm-flex align-center">
          <VIcon
            icon="ri-information-line"
            size="16"
            class="me-1 text-primary"
          />
          <span>Los repuestos se agregan a la cotización con el PVP calculado y datos del proveedor.</span>
        </div>
        <VBtn
          color="secondary"
          variant="tonal"
          prepend-icon="ri-close-line"
          class="rounded-lg font-weight-medium ms-auto"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style lang="scss" scoped>
.catalog-search-card {
  overflow: hidden;
}

.custom-dialog-header-primary {
  background: linear-gradient(135deg, #7367F0 0%, #5e50ee 50%, #4839eb 100%) !important;
  color: #ffffff !important;
  padding: 1.5rem 1.5rem 1.25rem 1.5rem !important;
  text-align: center !important;
  position: relative !important;
  box-shadow: 0 4px 18px rgba(115, 103, 240, 0.25);

  .custom-dialog-close-btn {
    position: absolute !important;
    top: 14px !important;
    right: 14px !important;
    color: #ffffff !important;
    background: rgba(255, 255, 255, 0.2) !important;
    border: 1px solid rgba(255, 255, 255, 0.35) !important;
    border-radius: 10px !important;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
    z-index: 5 !important;

    &:hover {
      background: rgba(255, 255, 255, 0.35) !important;
      border-color: rgba(255, 255, 255, 0.6) !important;
      transform: scale(1.08) !important;
    }
  }

  .custom-dialog-avatar {
    margin: 0 auto 0.65rem auto !important;
    background: rgba(255, 255, 255, 0.22) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1.5px solid rgba(255, 255, 255, 0.4) !important;
    border-radius: 1rem !important;
    width: 52px !important;
    height: 52px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
    color: #ffffff !important;

    .v-icon {
      color: #ffffff !important;
    }
  }

  .custom-dialog-title {
    font-size: 1.25rem !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    margin-bottom: 0.25rem !important;
    line-height: 1.25 !important;
    letter-spacing: -0.02em !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .custom-dialog-subtitle {
    font-size: 0.85rem !important;
    color: rgba(255, 255, 255, 0.92) !important;
    font-weight: 500 !important;
    margin-bottom: 0 !important;
    line-height: 1.35 !important;
    max-width: 580px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
}

.btn-cotizar-action {
  letter-spacing: 0.02em;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap !important;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(115, 103, 240, 0.4) !important;
  }
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
}

.catalog-items-table {
  width: 100% !important;
  table-layout: fixed;

  td, th {
    padding: 8px 6px !important;
  }
}

.font-monospace {
  font-family: monospace, sans-serif;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bg-light-subtle {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.bg-surface-variant-subtle {
  background-color: rgba(var(--v-theme-on-surface), 0.02);
}
</style>

