<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { $api, getApiBaseUrl } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import ViewProduct from '@/components/inventory/product/ViewProduct.vue'
import DeleteProduct from '@/components/inventory/product/DeleteProdcut.vue'
import ImportProductsDialog from '@/components/inventory/product/ImportProductsDialog.vue'

// Router
const router = useRouter()
const loader = useLoaderStore()
import { usePermissions } from '@/composables/usePermissions'

const { can } = usePermissions()

// Estado
const loading = ref(false)
const products = ref([])
const searchFormRef = ref(null)
const productDialog = ref(false)
const selectedProduct = ref(null)
const deleteDialog = ref(false)
const productToDelete = ref(null)
const importDialog = ref(false)

// Formulario de búsqueda
const searchForm = ref({
  search: '',
  categorie_id: null,
  warehouse_id: null,
  unit_id: null,
  sucursale_id: null,
  disponibilidad: null,
  is_gift: null,
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalItems = ref(0)
const totalPages = ref(0)

const pagination = ref({
  total: 0,
  per_page: 10,
  current_page: 1,
  last_page: 1,
  from: 0,
  to: 0,
})

// Opciones para selects
const categories = ref([])
const warehouses = ref([])
const units = ref([])
const sucursales = ref([])

const disponibilidadOptions = [
  { label: 'Con Stock', value: 'con_stock' },
  { label: 'Sin Stock', value: 'sin_stock' },
  { label: 'Stock Bajo', value: 'stock_bajo' },
]

const giftOptions = [
  { label: 'Productos Normales', value: 0 },
  { label: 'Regalos', value: 1 },
]

// Headers de la tabla
const headers = [
  { title: 'Imagen', key: 'imagen', sortable: false, width: '80px' },
  { title: 'Producto', key: 'description', sortable: false },
  { title: 'Categoría', key: 'categorie.title', sortable: false },
  { title: 'Almacén', key: 'warehouse.name', sortable: false },
  { title: 'Precio Venta', key: 'price_sale', sortable: false, align: 'end' },
  { title: 'Regalo', key: 'is_gift', sortable: false, width: '40px' },
  { title: 'Stock', key: 'stock', sortable: false, width: '100px' },
  { title: 'Estado', key: 'state', sortable: false, width: '100px' },
  { title: 'Acciones', key: 'actions', sortable: false, width: '120px' },
]

let productsAbortController = null

// Métodos
const searchProducts = async () => {
  if (productsAbortController) {
    productsAbortController.abort()
  }
  productsAbortController = new AbortController()

  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage.value,
      ...searchForm.value,
    }

    // Eliminar parámetros nulos o vacíos
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === '') {
        delete params[key]
      }
    })

    const response = await $api('products', {
      params,
      signal: productsAbortController.signal,
    })

    console.log(response)


    if (response.status === 200) {
      // Acceder a los datos correctos: response.products.data
      products.value = response.products.data || []
      totalItems.value = response.total || 0
      totalPages.value = response.total_pages || 0
      pagination.value = {
        total: response.total || 0,
        per_page: response.per_page || 10,
        current_page: response.current_page || 1,
        last_page: response.total_pages || 1,
        from: response.from || 0,
        to: response.to || 0,
      }
    }
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
    console.error('Error al buscar productos:', error)
  } finally {
    loading.value = false
  }
}

const clearSearch = () => {
  searchForm.value = {
    search: '',
    categorie_id: null,
    warehouse_id: null,
    unit_id: null,
    sucursale_id: null,
    disponibilidad: null,
    is_gift: null,
  }
  currentPage.value = 1
  searchProducts()
}

// Métricas computadas y filtros
const inStockCount = computed(() => {
  return products.value.filter(p => (parseFloat(p.stock) || 0) > 0).length
})

const lowOrNoStockCount = computed(() => {
  return products.value.filter(p => (parseFloat(p.stock) || 0) <= 0).length
})

const hasActiveFilters = computed(() => {
  return !!(
    (searchForm.value.search && searchForm.value.search.trim()) ||
    searchForm.value.categorie_id ||
    searchForm.value.warehouse_id ||
    searchForm.value.unit_id
  )
})

const resetFilters = () => {
  clearSearch()
}

const getStockColor = (stock, minStock) => {
  if (stock === 0) return 'error'
  if (stock <= minStock) return 'warning'

  return 'success'
}

const viewProduct = product => {
  console.log('Ver producto:', product)
  selectedProduct.value = product
  productDialog.value = true
}

const openProductDialog = product => {
  selectedProduct.value = product
  productDialog.value = true
}

const editProduct = product => {
  console.log('Editar producto:', product)

  // Navegar a página de edición
  router.push(`/product/edit/${product.id}`)
}

const deleteProduct = product => {
  console.log('Eliminar producto:', product)
  productToDelete.value = product
  deleteDialog.value = true
}

const handleProductDeleted = () => {
  console.log('🗑️ handleProductDeleted llamado', productToDelete.value)

  // Eliminar el producto de la lista localmente
  if (productToDelete.value) {
    const index = products.value.findIndex(p => p.id === productToDelete.value.id)

    console.log('📍 Índice encontrado:', index)

    if (index > -1) {
      products.value.splice(index, 1)
      console.log('✅ Producto eliminado de la lista')

      // Actualizar el total de paginación
      if (pagination.value.total > 0) {
        pagination.value.total -= 1
        console.log('📊 Total actualizado:', pagination.value.total)
      }
    }
  }

  // Cerrar el diálogo y limpiar el producto seleccionado inmediatamente
  console.log('🔒 Cerrando diálogo desde list.vue')
  deleteDialog.value = false
  productToDelete.value = null
  console.log('🔒 Diálogo cerrado y producto limpiado')
}


const importProducts = () => {
  importDialog.value = true
}

const handleProductsImported = () => {
  currentPage.value = 1
  searchProducts()
  importDialog.value = false
}

// Cargar datos iniciales
const loadInitialData = async () => {
  try {
    // Cargar categorías
    const categoriesResponse = await $api('products/config')

    console.log('📊 Respuesta de categorías:', categoriesResponse)
    if (categoriesResponse.status === 200) {
      categories.value = categoriesResponse.data.categories || []
      warehouses.value = categoriesResponse.data.warehouses || []
      units.value = categoriesResponse.data.units || []

      // TODO: Cargar sucursales cuando esté disponible
    }
  } catch (error) {
    console.error('Error al cargar datos iniciales:', error)
  }
}

const downloadExcel = () => {
  console.log('Descargar Excel')
  let query_params = ""
  if (searchForm.value.search) {
    query_params += "&search=" + searchForm.value.search
  }
  if (searchForm.value.categorie_id) {
    query_params += "&categorie_id=" + searchForm.value.categorie_id
  }
  if (searchForm.value.warehouse_id) {
    query_params += "&warehouse_id=" + searchForm.value.warehouse_id
  }
  if (searchForm.value.unit_id) {
    query_params += "&unit_id=" + searchForm.value.unit_id
  }

  window.open(getApiBaseUrl() + "products-excel?z=1" + query_params, '_blank')
}


// Montar componente
onMounted(() => {
  loadInitialData()
  searchProducts()
})

// Watcher para monitorear el diálogo
watch(deleteDialog, newValue => {
  console.log('👀 deleteDialog cambió a:', newValue)
})

// Watcher para resetear página cuando los filtros cambian
let filterTimeout = null
watch([() => searchForm.value.search, () => searchForm.value.categorie_id, () => searchForm.value.warehouse_id, () => searchForm.value.unit_id], () => {
  console.log('🔍 Filtros cambiados, reseteando página a 1')
  currentPage.value = 1

  // Búsqueda en tiempo real con debounce de 500ms
  if (filterTimeout) clearTimeout(filterTimeout)
  filterTimeout = setTimeout(() => {
    searchProducts()
  }, 500)
}, { deep: true })
</script>

<template>
  <div class="pa-4 pa-sm-6 products-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-box-3-line" size="26" />
          </VAvatar>
          Inventario de Productos
        </h1>
        <p class="text-medium-emphasis mb-0">
          Catálogo de repuestos, insumos, accesorios y control de inventario en almacenes
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn v-if="can('import_xml') || can('register_product')" color="secondary" variant="tonal"
          prepend-icon="ri-upload-2-line" class="font-weight-medium" @click="importProducts">
          Importar Excel
        </VBtn>
        <VBtn v-if="can('export_data') || can('list_product')" color="secondary" variant="tonal"
          prepend-icon="ri-download-2-line" class="font-weight-medium" @click="downloadExcel">
          Exportar Excel
        </VBtn>
        <VBtn v-if="can('register_product')" color="primary" prepend-icon="ri-add-line" to="/product/add"
          class="elevation-2 font-weight-bold">
          Agregar Producto
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-box-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Productos</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ totalItems }} <span class="text-caption text-disabled font-weight-regular">en catálogo</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-checkbox-circle-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Con Stock Disponible</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ inStockCount }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-alert-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Stock Agotado / Bajo</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ lowOrNoStockCount }} <span class="text-caption text-disabled font-weight-regular">requieren
                reposición</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon icon="ri-filter-3-line" size="18" color="primary" />
            <span>Filtros de Productos</span>
          </div>

          <VBtn v-if="hasActiveFilters" variant="text" color="error" size="small" prepend-icon="ri-filter-off-line"
            class="font-weight-semibold" @click="resetFilters">
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow dense class="gap-y-3">
          <VCol cols="12" md="6">
            <VTextField v-model="searchForm.search" label="Buscar producto"
              placeholder="Descripción, SKU, código auxiliar..." prepend-inner-icon="ri-search-2-line"
              variant="outlined" density="comfortable" hide-details="auto" clearable color="primary"
              :loading="loading" />
          </VCol>

          <VCol cols="12" sm="4" md="2">
            <VSelect v-model="searchForm.categorie_id" :items="categories" item-title="title" item-value="id"
              label="Categoría" placeholder="Todas" prepend-inner-icon="ri-folder-line" variant="outlined"
              density="comfortable" hide-details="auto" clearable color="primary" />
          </VCol>

          <VCol cols="12" sm="4" md="2">
            <VSelect v-model="searchForm.warehouse_id" :items="warehouses" item-title="name" item-value="id"
              label="Almacén" placeholder="Todos" prepend-inner-icon="ri-store-2-line" variant="outlined"
              density="comfortable" hide-details="auto" clearable color="primary" />
          </VCol>

          <VCol cols="12" sm="4" md="2">
            <VSelect v-model="searchForm.unit_id" :items="units" item-title="name" item-value="id" label="Unidad"
              placeholder="Todas" prepend-inner-icon="ri-ruler-line" variant="outlined" density="comfortable"
              hide-details="auto" clearable color="primary" />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ESTADO DE CARGA -->
    <VCard v-if="loading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4 text-center" style="width: 70px;">
              <div class="shimmer-circle mx-auto" style="width: 36px; height: 36px;" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-75 mb-2" />
              <div class="shimmer-line w-40" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-60" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-60" />
            </td>
            <td class="py-4" style="width: 120px;">
              <div class="shimmer-line w-50 ms-auto" />
            </td>
            <td class="py-4 text-center" style="width: 100px;">
              <div class="shimmer-line w-40 mx-auto" />
            </td>
            <td class="py-4 text-center" style="width: 110px;">
              <div class="shimmer-chip mx-auto" />
            </td>
            <td class="py-4 text-center" style="width: 120px;">
              <div class="shimmer-button rounded mx-auto" />
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard v-else-if="!products || products.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4">
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-box-3-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron productos
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los criterios de búsqueda o agrega un nuevo repuesto a tu inventario.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line"
          @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn v-if="can('register_product')" color="primary" prepend-icon="ri-add-line" to="/product/add">
          Agregar Producto
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA MODERNA DE PRODUCTOS -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="products-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 70px;">
                Img
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Producto / Repuesto
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 150px;">
                Categoría
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 140px;">
                Almacén
              </th>
              <th class="text-right font-weight-bold text-uppercase py-3" style="width: 130px;">
                P.V.P
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 110px;">
                Stock
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Estado
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in products" :key="item.id" class="product-table-row">
              <!-- Imagen -->
              <td class="text-center py-3">
                <VAvatar v-if="item.imagen" :image="item.imagen" size="38" rounded="lg" class="cursor-pointer border"
                  @click="openProductDialog(item)" />
                <VAvatar v-else color="primary" variant="tonal" size="38" rounded="lg" class="cursor-pointer"
                  @click="openProductDialog(item)">
                  <VIcon icon="ri-box-3-line" size="20" />
                </VAvatar>
              </td>

              <!-- Producto -->
              <td class="py-3">
                <div class="d-flex flex-column gap-0.5">
                  <div
                    class="font-weight-bold text-high-emphasis text-body-2 cursor-pointer hover-underline text-truncate"
                    style="max-width: 300px;" :title="item.description" @click="viewProduct(item)">
                    {{ item.description }}
                  </div>
                  <div class="d-flex align-center gap-2 text-caption text-medium-emphasis font-mono">
                    <span v-if="item.sku">Cód. P.: {{ item.sku }}</span>
                    <span v-if="item.code_aux">• Cód. Aux.: {{ item.code_aux }}</span>
                  </div>
                </div>
              </td>

              <!-- Categoría -->
              <td class="py-3">
                <span class="text-body-2 text-medium-emphasis font-weight-medium">
                  {{ item.categorie?.title || 'Sin Categoría' }}
                </span>
              </td>

              <!-- Almacén -->
              <td class="py-3">
                <span class="text-body-2 text-medium-emphasis font-weight-medium">
                  {{ item.warehouse?.name || 'General' }}
                </span>
              </td>

              <!-- Precio Venta -->
              <td class="text-right py-3">
                <span class="font-mono font-weight-bold text-body-1 text-high-emphasis">
                  ${{ ((item.price_sale || 0) * (1 + (item.tax_rate || 0) / 100)).toFixed(2) }}
                </span>
              </td>

              <!-- Stock -->
              <td class="text-center py-3">
                <span v-if="item.item_type == 1" class="font-mono font-weight-bold text-body-2 px-2 py-0.5 rounded"
                  :class="(item.stock || 0) > 0 ? 'bg-success-lighten-5 text-success' : 'bg-error-lighten-5 text-error'">
                  {{ item.stock || 0 }}
                </span>
                <span v-else class="text-caption text-medium-emphasis font-weight-medium">
                  Serv.
                </span>
              </td>

              <!-- Estado (Pill limpia aceituna / pastel con punto) -->
              <td class="text-center py-3" style="white-space: nowrap;">
                <div
                  class="status-pill-clean"
                  :class="parseInt(item.state) === 1 ? 'status-paid' : 'status-pending'"
                >
                  <span class="status-dot" />
                  <span>{{ parseInt(item.state) === 1 ? 'Activo' : 'Inactivo' }}</span>
                </div>
              </td>

              <!-- Acciones -->
              <td class="text-center py-3">
                <div class="d-flex justify-center align-center gap-1">
                  <!-- Ver detalle -->
                  <VBtn size="small" color="info" variant="tonal" icon="ri-eye-line" title="Ver Producto"
                    @click="viewProduct(item)" />

                  <!-- Editar -->
                  <VBtn v-if="can('edit_product')" size="small" color="warning" variant="tonal" icon="ri-pencil-line"
                    title="Editar Producto" @click="editProduct(item)" />

                  <!-- Eliminar -->
                  <VBtn v-if="can('delete_product')" size="small" color="error" variant="tonal"
                    icon="ri-delete-bin-line" title="Eliminar Producto" @click="deleteProduct(item)" />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ products.length }}</strong> de <strong
              class="text-high-emphasis">{{ totalItems }}</strong> productos
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="searchProducts" />
        </div>
      </VCard>
    </div>

    <!-- Diálogo de Detalles del Producto -->
    <ViewProduct v-model:dialog="productDialog" :product="selectedProduct" />

    <!-- Diálogo de Eliminación de Producto -->
    <DeleteProduct v-if="productToDelete" :product="productToDelete" :show-dialog="deleteDialog"
      @update:show-dialog="deleteDialog = $event" @deleted="handleProductDeleted" />

    <!-- Diálogo de Importación de Excel -->
    <ImportProductsDialog v-model:isDialogVisible="importDialog" @imported="handleProductsImported" />
  </div>
</template>

<style scoped lang="scss">
.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.product-table-row {
  transition: background-color 0.15s ease;

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.hover-underline:hover {
  text-decoration: underline;
}

.shimmer-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-chip {
  width: 60px;
  height: 20px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-button {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

// Status Pills (Estilo listado de clientes/compras)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
