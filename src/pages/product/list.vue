<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import ViewProduct from '@/components/inventory/product/ViewProduct.vue'
import DeleteProduct from '@/components/inventory/product/DeleteProdcut.vue'

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

// Formulario de búsqueda
const searchForm = ref({
    search: '',
    categorie_id: null,
    warehouse_id: null,
    unit_id: null,
    sucursale_id: null,
    disponibilidad: null,
    is_gift: null
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(10)
const pagination = ref({
    total: 0,
    per_page: 10,
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0
})

// Opciones para selects
const categories = ref([])
const warehouses = ref([])
const units = ref([])
const sucursales = ref([])

const disponibilidadOptions = [
    { label: 'Con Stock', value: 'con_stock' },
    { label: 'Sin Stock', value: 'sin_stock' },
    { label: 'Stock Bajo', value: 'stock_bajo' }
]

const giftOptions = [
    { label: 'Productos Normales', value: 0 },
    { label: 'Regalos', value: 1 }
]

// Headers de la tabla
const headers = [
    { title: 'Imagen', key: 'imagen', sortable: false, width: '80px' },
    { title: 'Producto', key: 'description', sortable: false },
    { title: 'Categoría', key: 'categorie.title', sortable: false },
    { title: 'Almacén', key: 'warehouse.name', sortable: false },
    { title: 'Precio Venta', key: 'price_sale', sortable: false, align: 'end' },
    { title: 'Stock', key: 'stock', sortable: false, width: '100px' },
    { title: 'Estado', key: 'state', sortable: false, width: '100px' },
    { title: 'Acciones', key: 'actions', sortable: false, width: '120px' }
]

// Métodos
const searchProducts = async () => {
    loading.value = true
    try {
        const params = {
            page: currentPage.value,
            per_page: itemsPerPage.value,
            ...searchForm.value
        }

        // Eliminar parámetros nulos o vacíos
        Object.keys(params).forEach(key => {
            if (params[key] === null || params[key] === '') {
                delete params[key]
            }
        })

        const response = await $api('products', { params })
        console.log(response);


        if (response.status === 200) {
            products.value = response.products
            pagination.value = response.pagination
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
        is_gift: null
    }
    currentPage.value = 1
    searchProducts()
}

const handleTableUpdate = (options) => {
    currentPage.value = options.page
    itemsPerPage.value = options.itemsPerPage
    searchProducts()
}

const getStockColor = (stock, minStock) => {
    if (stock === 0) return 'error'
    if (stock <= minStock) return 'warning'
    return 'success'
}

const viewProduct = (product) => {
    console.log('Ver producto:', product)
    selectedProduct.value = product
    productDialog.value = true
}

const openProductDialog = (product) => {
    selectedProduct.value = product
    productDialog.value = true
}

const editProduct = (product) => {
    console.log('Editar producto:', product)
    // Navegar a página de edición
    router.push(`/product/edit/${product.id}`)
}

const deleteProduct = (product) => {
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

const exportProducts = () => {
    console.log('Exportar productos')
    // TODO: Implementar exportación
}

// Cargar datos iniciales
const loadInitialData = async () => {
    try {
        // Cargar categorías
        const categoriesResponse = await $api('products/config')
        if (categoriesResponse.status === 200) {
            categories.value = categoriesResponse.categories || []
            warehouses.value = categoriesResponse.warehouses || []
            units.value = categoriesResponse.units || []
            // TODO: Cargar sucursales cuando esté disponible
        }
    } catch (error) {
        console.error('Error al cargar datos iniciales:', error)
    }
}

// Montar componente
onMounted(() => {
    loadInitialData()
    searchProducts()
})

// Watcher para monitorear el diálogo
watch(deleteDialog, (newValue) => {
    console.log('👀 deleteDialog cambió a:', newValue)
})
</script><template>
    <div class="pa-4 pa-sm-6">


        <!-- Formulario de Búsqueda -->
        <VCard class="pa-6 pa-sm-8 rounded-lg elevation-4 max-w-1200 mx-auto" elevation="2">
            <!-- Título y Botón Agregar -->
            <div class="d-flex justify-space-between align-center mb-6">
                <h1 class="text-h4 font-weight-bold">Listado de Productos</h1>
                <VBtn color="primary" prepend-icon="ri-add-line" to="/product/add">
                    Agregar Producto
                </VBtn>
            </div>
            <VDivider />
            <VCardTitle class="d-flex align-center gap-2 pa-4">
                <VIcon icon="ri-search-line" size="20" color="primary" />
                Búsqueda Avanzada de Productos
            </VCardTitle>

            <VCardText class="pa-4">
                <VForm ref="searchFormRef" @submit.prevent="searchProducts">
                    <VRow>
                        <!-- Búsqueda General -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="searchForm.search" label="Búsqueda General"
                                placeholder="Buscar por descripción, SKU, código auxiliar..."
                                prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable"
                                hide-details="auto" clearable />
                        </VCol>

                        <!-- Categoría -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="searchForm.categorie_id" :items="categories" item-title="title"
                                item-value="id" label="Categoría" placeholder="Seleccionar"
                                prepend-inner-icon="ri-folder-line" variant="outlined" density="comfortable"
                                hide-details="auto" clearable />
                        </VCol>

                        <!-- Almacén -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="searchForm.warehouse_id" :items="warehouses" item-title="name"
                                item-value="id" label="Almacén" placeholder="Seleccionar"
                                prepend-inner-icon="ri-store-2-line" variant="outlined" density="comfortable"
                                hide-details="auto" clearable />
                        </VCol>

                        <!-- Unidad -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="searchForm.unit_id" :items="units" item-title="name" item-value="id"
                                label="Unidad" placeholder="Seleccionar" prepend-inner-icon="ri-ruler-line"
                                variant="outlined" density="comfortable" hide-details="auto" clearable />
                        </VCol>

                        <!-- Sucursal -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="searchForm.sucursale_id" :items="sucursales" item-title="name"
                                item-value="id" label="Sucursal" placeholder="Seleccionar"
                                prepend-inner-icon="ri-building-line" variant="outlined" density="comfortable"
                                hide-details="auto" clearable />
                        </VCol>

                        <!-- Disponibilidad -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="searchForm.disponibilidad" :items="disponibilidadOptions"
                                item-title="label" item-value="value" label="Disponibilidad" placeholder="Seleccionar"
                                prepend-inner-icon="ri-check-double-line" variant="outlined" density="comfortable"
                                hide-details="auto" clearable />
                        </VCol>

                        <!-- Es Regalo -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="searchForm.is_gift" :items="giftOptions" item-title="label"
                                item-value="value" label="Tipo de Producto" placeholder="Seleccionar"
                                prepend-inner-icon="ri-gift-line" variant="outlined" density="comfortable"
                                hide-details="auto" clearable />
                        </VCol>

                        <!-- Botones de Acción -->
                        <VCol cols="12" class="d-flex gap-2">
                            <VBtn type="submit" color="primary" prepend-icon="ri-search-line" :loading="loading">
                                Buscar
                            </VBtn>
                            <VBtn variant="outlined" prepend-icon="ri-refresh-line" @click="clearSearch">
                                Limpiar
                            </VBtn>
                            <VBtn variant="text" prepend-icon="ri-download-line" @click="exportProducts">
                                Exportar
                            </VBtn>
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>

            <VDivider />

            <!-- Tabla de Productos -->
            <VDataTable :headers="headers" :items="products" :loading="loading" :items-per-page="itemsPerPage"
                :server-items-length="pagination.total" class="elevation-0" @update:options="handleTableUpdate">
                <!-- Imagen -->
                <template #item.imagen="{ item }">
                    <div @click="openProductDialog(item)" class="cursor-pointer">
                        <VAvatar v-if="item.imagen" :image="item.imagen" size="40" class="elevation-2" />
                        <VAvatar v-else color="grey-lighten-2" size="40" class="elevation-2">
                            <VIcon icon="ri-image-line" />
                        </VAvatar>
                    </div>
                </template>

                <!-- Información Principal -->
                <template #item.description="{ item }">
                    <div>
                        <div class="font-weight-medium">{{ item.description }}</div>
                        <div class="text-caption text-medium-emphasis">SKU: {{ item.sku }}</div>
                        <div v-if="item.code_aux" class="text-caption text-medium-emphasis">
                            Código: {{ item.code_aux }}
                        </div>
                    </div>
                </template>

                <!-- Precios -->
                <template #item.price_sale="{ item }">
                    <div class="text-right">
                        <div class="font-weight-medium text-success">
                            ${{ item.price_sale.toFixed(2) }}
                        </div>
                        <div v-if="item.discount_percentage > 0" class="text-caption text-warning">
                            {{ item.discount_percentage }}% desc
                        </div>
                    </div>
                </template>

                <!-- Stock -->
                <template #item.stock="{ item }">
                    <VChip :color="getStockColor(item.stock, item.min_stock)" variant="tonal" size="small">
                        {{ item.stock }}
                    </VChip>
                </template>

                <!-- Estado -->
                <template #item.state="{ item }">
                    <VChip :color="item.state === 1 ? 'success' : 'error'" variant="tonal" size="small">
                        {{ item.state === 1 ? 'Activo' : 'Inactivo' }}
                    </VChip>
                </template>

                <!-- Acciones -->
                <template #item.actions="{ item }">
                    <div class="d-flex gap-1">
                        <VBtn icon="ri-eye-line" variant="text" size="small" color="primary"
                            @click="viewProduct(item)" />
                        <VBtn icon="ri-edit-line" variant="text" size="small" color="warning"
                            @click="editProduct(item)" />
                        <VBtn icon="ri-delete-bin-line" variant="text" size="small" color="error"
                            @click="deleteProduct(item)" />
                    </div>
                </template>
            </VDataTable>

            <!-- Paginación -->
            <VDivider />
            <div class="d-flex justify-center pa-4">
                <VPagination v-model="currentPage" :length="pagination.last_page" :total-visible="7"
                    @update:model-value="searchProducts" />
            </div>
        </VCard>
    </div>

    <!-- Diálogo de Detalles del Producto -->
    <ViewProduct v-model:dialog="productDialog" :product="selectedProduct" />

    <!-- Diálogo de Eliminación de Producto -->
    <DeleteProduct v-if="productToDelete" :product="productToDelete" :show-dialog="deleteDialog"
        @update:show-dialog="deleteDialog = $event" @deleted="handleProductDeleted" />
</template>



<style scoped>
.v-data-table {
    border-radius: 0;
}

.drop-zone {
    border: 2px dashed rgba(var(--v-theme-primary), 0.3);
    transition: all 0.3s ease;
}

.drop-zone:hover {
    border-color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
