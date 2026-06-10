<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import ViewProduct from '@/components/inventory/product/ViewProduct.vue'
import DeleteProduct from '@/components/inventory/product/DeleteProdcut.vue'
import ImportProductsDialog from '@/components/inventory/product/ImportProductsDialog.vue'

// Router
const router = useRouter()

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

// Métodos
const searchProducts = async () => {
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

    const response = await $api('products', { params })

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

  window.open(import.meta.env.VITE_API_BASE_URL + "products-excel?z=1" + query_params, '_blank')
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
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-box-3-line" color="primary" class="me-2" size="28" />
          Productos
        </h1>
        <p class="text-medium-emphasis mb-0">
          Gestión de inventario de productos y servicios
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="error" variant="tonal" prepend-icon="ri-download-2-fill" @click="importProducts">
          Importar
        </VBtn>
        <VBtn color="success" variant="tonal" prepend-icon="ri-file-excel-2-line" @click="downloadExcel">
          Exportar
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" to="/product/add">
          Agregar Producto
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VForm ref="searchFormRef" @submit.prevent="searchProducts">
          <VRow class="align-center">
            <VCol cols="12" md="6">
              <VTextField v-model="searchForm.search" label="Búsqueda General" placeholder="Descripción, SKU, código..."
                prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto"
                clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VSelect v-model="searchForm.categorie_id" :items="categories" item-title="title" item-value="id"
                label="Categoría" placeholder="Todos" prepend-inner-icon="ri-folder-line" variant="outlined"
                density="comfortable" hide-details="auto" clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VSelect v-model="searchForm.warehouse_id" :items="warehouses" item-title="name" item-value="id"
                label="Almacén" placeholder="Todos" prepend-inner-icon="ri-store-2-line" variant="outlined"
                density="comfortable" hide-details="auto" clearable color="primary" />
            </VCol>

            <VCol cols="12" sm="6" md="2">
              <VSelect v-model="searchForm.unit_id" :items="units" item-title="name" item-value="id" label="Unidad"
                placeholder="Todos" prepend-inner-icon="ri-ruler-line" variant="outlined" density="comfortable"
                hide-details="auto" clearable color="primary" />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <!-- Tabla de Productos -->
      <div class="position-relative">
        <VProgressLinear v-if="loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div class="overflow-x-auto">
          <VTable hover class="products-table">
            <thead>
              <tr>
                <th class="text-center font-weight-bold text-uppercase" style="width: 80px;">
                  IMAGEN
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 250px;">
                  PRODUCTO
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">
                  CATEGORÍA
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">
                  ALMACÉN
                </th>
                <th class="text-right font-weight-bold text-uppercase" style="width: 120px;">
                  PRECIO
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 100px;">
                  STOCK
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 100px;">
                  ESTADO
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody v-if="loading">
              <tr>
                <td colspan="8" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">
                    Cargando registros...
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!products || products.length === 0">
              <tr>
                <td colspan="8" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">
                    ri-inbox-line
                  </VIcon>
                  <div class="text-h6">
                    No se encontraron productos
                  </div>
                  <div class="text-body-2">
                    Intenta ajustar los filtros de búsqueda
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="item in products" :key="item.id" class="products-row align-middle">
                <!-- Imagen -->
                <td class="text-center py-3">
                  <div class="cursor-pointer" @click="openProductDialog(item)">
                    <VAvatar v-if="item.imagen" :image="item.imagen" size="40" class="elevation-2" />
                    <VAvatar v-else color="grey-lighten-2" size="40" class="elevation-2">
                      <VIcon icon="ri-image-line" />
                    </VAvatar>
                  </div>
                </td>

                <!-- Producto -->
                <td class="text-left py-3" style="max-width: 300px;">
                  <div class="font-weight-semibold text-truncate text-body-1 text-grey-darken-4"
                    :title="item.description">
                    {{ item.description }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis mt-1">
                    SKU: {{ item.sku }}
                  </div>
                  <div v-if="item.code_aux" class="text-body-2 text-medium-emphasis">
                    Código: {{ item.code_aux }}
                  </div>
                </td>

                <!-- Categoría -->
                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3">{{ item.categorie?.title || '-' }}</span>
                </td>

                <!-- Almacén -->
                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3">{{ item.warehouse?.name || '-' }}</span>
                </td>

                <!-- Precio -->
                <td class="text-no-wrap text-right py-3">
                  <div class="font-weight-bold text-subtitle-1 text-success">
                    ${{ item.price_sale?.toFixed(2) || '0.00' }}
                  </div>
                  <div v-if="item.discount_percentage > 0" class="text-caption text-warning">
                    {{ item.discount_percentage }}% desc
                  </div>
                </td>

                <!-- Stock -->
                <td class="text-no-wrap text-center py-3">
                  <div class="font-weight-bold text-subtitle-1 text-grey-darken-4">
                    {{ item.stock || 0 }}
                  </div>
                </td>

                <!-- Estado -->
                <td class="text-no-wrap text-center py-3">
                  <VChip :color="item.state === 1 ? 'success' : 'error'" variant="tonal" size="small">
                    {{ item.state === 1 ? 'Activo' : 'Inactivo' }}
                  </VChip>
                </td>

                <!-- Acciones -->
                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <!-- Ver Detalle (Acción rápida) -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver Detalle"
                      @click="viewProduct(item)">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>

                    <!-- Editar -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="warning" title="Editar"
                      @click="editProduct(item)">
                      <VIcon icon="ri-edit-line" size="20" />
                    </VBtn>

                    <!-- Eliminar -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="error" title="Eliminar"
                      @click="deleteProduct(item)">
                      <VIcon icon="ri-delete-bin-line" size="20" />
                    </VBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ products.length }}</span> de <span class="font-weight-bold">{{
              totalItems }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="searchProducts" />
        </div>
      </VCardActions>
    </VCard>

    <!-- Diálogo de Detalles del Producto -->
    <ViewProduct v-model:dialog="productDialog" :product="selectedProduct" />

    <!-- Diálogo de Eliminación de Producto -->
    <DeleteProduct v-if="productToDelete" :product="productToDelete" :show-dialog="deleteDialog"
      @update:show-dialog="deleteDialog = $event" @deleted="handleProductDeleted" />

    <!-- Diálogo de Importación de Excel -->
    <ImportProductsDialog v-model:isDialogVisible="importDialog" @imported="handleProductsImported" />
  </div>
</template>
