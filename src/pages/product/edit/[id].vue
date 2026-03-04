<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useDropZone, useFileDialog, useObjectUrl } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Drop zone para imágenes
const dropZoneRef = ref()
const fileData = ref([])
const { open, onChange } = useFileDialog({ accept: 'image/*', multiple: false })

function onDrop(DroppedFiles) {
    DroppedFiles?.forEach(file => {
        if (file.type.slice(0, 6) !== 'image/') {
            alert('Solo se permiten archivos tipo imagen.')
            return
        }
        fileData.value.push({
            file,
            url: useObjectUrl(file).value ?? '',
        })
    })
}

onChange(selectedFiles => {
    if (fileData.value.length == 1) {
        alert('Solo permite una imagen')
        return
    }
    if (!selectedFiles)
        return
    for (const file of selectedFiles) {
        fileData.value.push({
            file,
            url: useObjectUrl(file).value ?? '',
        })
    }
})
useDropZone(dropZoneRef, onDrop)

const isLoading = ref(false)
const formRef = ref(null)
const warning = ref(null)
const error_exist = ref(null)

const IVA_RATE = 15

const product = ref({
    id: null,
    description: '',
    sku: '',
    code_aux: '',
    uses: '',
    imagen: null,
    product_categorie_id: null,
    warehouse_id: null,
    unit_id: null,
    supplier_id: null,
    categorie: null,
    warehouse: null,
    unit: null,
    supplier: null,
    price: 0,
    price_sale: 0,
    purchase_price: 0,
    tax_rate: IVA_RATE,
    max_discount: 0,
    discount_percentage: 0,
    brand: '',
    stock: 0,
    item_type: null,
    min_stock: 0,
    max_stock: 0,
    is_taxable: true,
    is_gift: false,
    notes: '',
    state: 1,
})

// Datos para selects
const categories = ref([])
const warehouses = ref([])
const units = ref([])
const suppliers = ref([])
const itemTypes = ref([
    { label: 'Producto', value: 1 },
    { label: 'Servicio', value: 2 }
])

// Reglas de validación
const requiredRule = v => !!v || 'Campo obligatorio'
const minLengthRule = (min) => v => !v || v.length >= min || `Mínimo ${min} caracteres`
const maxLengthRule = (max) => v => !v || v.length <= max || `Máximo ${max} caracteres`
const minValueRule = (min) => v => !v || parseFloat(v) >= min || `Mínimo ${min}`
const maxValueRule = (max) => v => !v || parseFloat(v) <= max || `Máximo ${max}`
const maxDecimalRule = (decimals) => v => !v || (v.toString().split('.')[1]?.length || 0) <= decimals || `Máximo ${decimals} decimales`
const maxPercentageRule = v => !v || parseFloat(v) <= 100 || 'Máximo 100%'

const descriptionRules = [requiredRule, minLengthRule(3), maxLengthRule(200)]
const skuRules = [requiredRule, minLengthRule(2), maxLengthRule(50)]
const codeAuxRules = [maxLengthRule(50)]
const brandRules = [maxLengthRule(250)]
const priceRules = [requiredRule, minValueRule(0), maxDecimalRule(2)]
const discountRules = [minValueRule(0), maxDecimalRule(2)]
const stockRules = [requiredRule, minValueRule(0), maxDecimalRule(2)]
const percentageRules = [minValueRule(0), maxPercentageRule]

const calculateMaxDiscount = () => {
    console.log('🔄 Calculando descuento máximo...')
    const purchasePrice = parseFloat(product.value.purchase_price) || 0
    const taxRate = parseFloat(product.value.tax_rate) || 0
    const priceSale = parseFloat(product.value.price_sale) || 0

    if (purchasePrice > 0 && priceSale > 0) {
        const costWithTax = purchasePrice * (1 + taxRate / 100)
        const maxDiscountAmount = priceSale - costWithTax

        if (maxDiscountAmount > 0) {
            product.value.max_discount = maxDiscountAmount.toFixed(2)
            const discountPercentage = (maxDiscountAmount / priceSale * 100).toFixed(2)
            product.value.discount_percentage = parseFloat(discountPercentage)
        } else {
            product.value.max_discount = 0
            product.value.discount_percentage = 0
        }
    } else {
        product.value.max_discount = 0
        product.value.discount_percentage = 0
    }
}

// Watchers para recalcular descuento
watch(() => product.value.purchase_price, calculateMaxDiscount)
watch(() => product.value.price_sale, calculateMaxDiscount)
watch(() => product.value.tax_rate, calculateMaxDiscount)

// Cargar producto existente
const loadProduct = async () => {
    try {
        isLoading.value = true
        const productId = route.params.id

        const response = await $api(`products/${productId}`)

        if (response.status === 200) {
            // Cargar datos del producto
            product.value = {
                ...product.value,
                ...response.product
            }

            // Si hay imagen existente, cargarla en fileData
            if (response.product.imagen) {
                fileData.value = [{
                    url: response.product.imagen,
                    file: null // Indica que es una imagen existente
                }]
            }

            console.log('✅ Producto cargado:', product.value)
        } else {
            showNotification('error', 'No se pudo cargar el producto')
            router.push('/product/list')
        }
    } catch (error) {
        console.error('❌ Error al cargar producto:', error)
        showNotification('error', 'Error al cargar el producto')
        router.push('/product/list')
    } finally {
        isLoading.value = false
    }
}

// Cargar datos iniciales
const loadInitialData = async () => {
    try {
        const response = await $api('products/config')
        if (response.status === 200) {
            categories.value = response.categories || []
            warehouses.value = response.warehouses || []
            units.value = response.units || []
            suppliers.value = response.suppliers || []
        }
    } catch (error) {
        console.error('❌ Error al cargar datos iniciales:', error)
    }
}

// Actualizar producto
const updateProduct = async () => {
    const { valid } = await formRef.value.validate()

    if (!valid) {
        showNotification('warning', 'Por favor complete los campos obligatorios')
        return
    }

    try {
        isLoading.value = true
        loader.show()

        const formData = new FormData()

        // Agregar todos los campos del producto
        Object.keys(product.value).forEach(key => {
            if (key !== 'imagen' && product.value[key] !== null) {
                formData.append(key, product.value[key])
            }
        })

        // Agregar imagen si hay una nueva
        if (fileData.value.length > 0 && fileData.value[0].file) {
            formData.append('imagen', fileData.value[0].file)
            console.log('📷 Imagen agregada al FormData')
        }

        // Agregar método PUT para actualización
        formData.append('_method', 'PUT')

        console.log('📤 Enviando datos de actualización:', Object.fromEntries(formData))

        const response = await $api(`products/${product.value.id}`, {
            method: 'POST',
            body: formData,
            onResponseError({ response }) {
                console.error('❌ Error de API:', response._data)
                showNotification('error', response._data.message || 'Error al actualizar el producto')
            }
        })

        if (response.status === 200) {
            showNotification('success', 'Producto actualizado correctamente')
            router.push('/product/list')
        }
    } catch (error) {
        console.error('❌ Error al actualizar producto:', error)
        showNotification('error', 'Error al actualizar el producto')
    } finally {
        isLoading.value = false
        loader.hide()
    }
}

// Limpiar imagen
const clearImage = () => {
    fileData.value = []
    product.value.imagen = null
}

// Montar componente
onMounted(() => {
    loadInitialData()
    loadProduct()
})
</script>

<template>
    <div class="pa-4">
        <!-- Título -->
        <div class="d-flex justify-space-between align-center mb-6">
            <h1 class="text-h4 font-weight-bold">Editar Producto</h1>
            <VBtn color="primary" prepend-icon="ri-arrow-left-line" to="/product/list">
                Volver al Listado
            </VBtn>
        </div>

        <!-- Formulario -->
        <VCard elevation="2">
            <VCardTitle class="d-flex align-center gap-2 pa-4">
                <VIcon icon="ri-edit-line" size="20" color="primary" />
                Editar Información del Producto
            </VCardTitle>
            <VDivider />

            <VCardText class="pa-4">
                <VForm ref="formRef" @submit.prevent="updateProduct">
                    <VRow>
                        <!-- Información Básica -->
                        <VCol cols="12">
                            <div class="text-h6 font-weight-medium mb-4">Información Básica</div>
                        </VCol>

                        <!-- Descripción -->
                        <VCol cols="12" md="6">
                            <VTextField v-model="product.description" label="Descripción del Producto"
                                :rules="descriptionRules" prepend-inner-icon="ri-file-text-line" variant="outlined"
                                density="comfortable" placeholder="Ej: Laptop Dell Latitude 5420" required />
                        </VCol>

                        <!-- SKU -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.sku" label="SKU" :rules="skuRules"
                                prepend-inner-icon="ri-barcode-line" variant="outlined" density="comfortable"
                                placeholder="Ej: LAP-001" required />
                        </VCol>

                        <!-- Código Auxiliar -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.code_aux" label="Código Auxiliar" :rules="codeAuxRules"
                                prepend-inner-icon="ri-price-tag-3-line" variant="outlined" density="comfortable"
                                placeholder="Código interno" clearable />
                        </VCol>

                        <!-- Marca -->
                        <VCol cols="12" md="4">
                            <VTextField v-model="product.brand" label="Marca" :rules="brandRules"
                                prepend-inner-icon="ri-truck-line" variant="outlined" density="comfortable"
                                placeholder="Ej: Dell, HP, Lenovo" clearable />
                        </VCol>

                        <!-- Tipo de Ítem -->
                        <VCol cols="12" md="4">
                            <VSelect v-model="product.item_type" :items="itemTypes" item-title="label"
                                item-value="value" label="Tipo de Ítem" prepend-inner-icon="ri-shapes-line"
                                variant="outlined" density="comfortable" placeholder="Seleccionar tipo" required />
                        </VCol>

                        <!-- Estado -->
                        <VCol cols="12" md="4">
                            <VSelect v-model="product.state" :items="[
                                { label: 'Activo', value: 1 },
                                { label: 'Inactivo', value: 0 }
                            ]" item-title="label" item-value="value" label="Estado"
                                prepend-inner-icon="ri-checkbox-circle-line" variant="outlined" density="comfortable"
                                placeholder="Seleccionar estado" required />
                        </VCol>

                        <!-- Imagen -->
                        <VCol cols="12">
                            <div class="text-h6 font-weight-medium mb-4">Imagen del Producto</div>
                        </VCol>

                        <VCol cols="12">
                            <div ref="dropZoneRef" class="drop-zone pa-8 text-center rounded-lg" @click="open">
                                <div v-if="fileData.length === 0" class="text-center">
                                    <VIcon icon="ri-upload-cloud-line" size="48" color="primary" class="mb-4" />
                                    <div class="text-h6 font-weight-medium mb-2">
                                        Arrastra una imagen aquí o haz clic para seleccionar
                                    </div>
                                    <div class="text-caption text-medium-emphasis">
                                        Formatos: JPG, PNG, GIF (Máximo 5MB)
                                    </div>
                                </div>

                                <div v-else class="d-flex align-center justify-center gap-4">
                                    <div class="position-relative">
                                        <VImg :src="fileData[0].url" max-width="200" max-height="200"
                                            class="rounded-lg elevation-4" />
                                        <VBtn icon="ri-close-line" variant="elevated" size="small" color="error"
                                            class="position-absolute top-0 right-0" @click.stop="clearImage" />
                                    </div>
                                    <div class="text-left">
                                        <div class="text-body-2 font-weight-medium">
                                            {{ fileData[0].file?.name || 'Imagen actual' }}
                                        </div>
                                        <div class="text-caption text-medium-emphasis">
                                            {{ fileData[0].file ? `${(fileData[0].file.size / 1024 / 1024).toFixed(2)}
                                            MB` : 'Imagen existente' }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </VCol>

                        <!-- Categorización -->
                        <VCol cols="12">
                            <div class="text-h6 font-weight-medium mb-4">Categorización</div>
                        </VCol>

                        <!-- Categoría -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="product.product_categorie_id" :items="categories" item-title="title"
                                item-value="id" label="Categoría" prepend-inner-icon="ri-folder-line" variant="outlined"
                                density="comfortable" placeholder="Seleccionar categoría" clearable />
                        </VCol>

                        <!-- Almacén -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="product.warehouse_id" :items="warehouses" item-title="name"
                                item-value="id" label="Almacén" prepend-inner-icon="ri-store-2-line" variant="outlined"
                                density="comfortable" placeholder="Seleccionar almacén" clearable />
                        </VCol>

                        <!-- Unidad -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="product.unit_id" :items="units" item-title="name" item-value="id"
                                label="Unidad de Medida" prepend-inner-icon="ri-ruler-line" variant="outlined"
                                density="comfortable" placeholder="Seleccionar unidad" clearable />
                        </VCol>

                        <!-- Proveedor -->
                        <VCol cols="12" md="3">
                            <VSelect v-model="product.supplier_id" :items="suppliers" item-title="name" item-value="id"
                                label="Proveedor" prepend-inner-icon="ri-truck-line" variant="outlined"
                                density="comfortable" placeholder="Seleccionar proveedor" clearable />
                        </VCol>

                        <!-- Precios -->
                        <VCol cols="12">
                            <div class="text-h6 font-weight-medium mb-4">Información de Precios</div>
                        </VCol>

                        <!-- Precio Base -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.price" label="Precio Base" :rules="priceRules"
                                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined"
                                density="comfortable" prefix="$" type="number" step="0.01" required />
                        </VCol>

                        <!-- Precio de Venta -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.price_sale" label="Precio de Venta" :rules="priceRules"
                                prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined"
                                density="comfortable" prefix="$" type="number" step="0.01" required />
                        </VCol>

                        <!-- Precio de Compra -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.purchase_price" label="Precio de Compra" :rules="priceRules"
                                prepend-inner-icon="ri-shopping-cart-line" variant="outlined" density="comfortable"
                                prefix="$" type="number" step="0.01" required />
                        </VCol>

                        <!-- Tasa de Impuesto -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.tax_rate" label="Tasa de Impuesto (%)" :rules="percentageRules"
                                prepend-inner-icon="ri-percent-line" variant="outlined" density="comfortable" suffix="%"
                                type="number" step="0.01" required />
                        </VCol>

                        <!-- Descuento Máximo -->
                        <VCol cols="12" md="4">
                            <VTextField v-model="product.max_discount" label="Descuento Máximo ($)"
                                :rules="discountRules" prepend-inner-icon="ri-discount-percent-line" variant="outlined"
                                density="comfortable" prefix="$" type="number" step="0.01" readonly
                                hint="Calculado automáticamente" persistent-hint />
                        </VCol>

                        <!-- Porcentaje de Descuento -->
                        <VCol cols="12" md="4">
                            <VTextField v-model="product.discount_percentage" label="Descuento Máximo (%)"
                                :rules="percentageRules" prepend-inner-icon="ri-percent-line" variant="outlined"
                                density="comfortable" suffix="%" type="number" step="0.01" readonly
                                hint="Calculado automáticamente" persistent-hint />
                        </VCol>

                        <!-- Es Gravable -->
                        <VCol cols="12" md="4">
                            <VSwitch v-model="product.is_taxable" label="Es Gravable"
                                prepend-inner-icon="ri-receipt-line" color="primary" inset />
                        </VCol>

                        <!-- Inventario -->
                        <VCol cols="12">
                            <div class="text-h6 font-weight-medium mb-4">Información de Inventario</div>
                        </VCol>

                        <!-- Stock Actual -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.stock" label="Stock Actual" :rules="stockRules"
                                prepend-inner-icon="ri-archive-line" variant="outlined" density="comfortable"
                                type="number" step="0.01" required />
                        </VCol>

                        <!-- Stock Mínimo -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.min_stock" label="Stock Mínimo" :rules="stockRules"
                                prepend-inner-icon="ri-alert-line" variant="outlined" density="comfortable"
                                type="number" step="0.01" required />
                        </VCol>

                        <!-- Stock Máximo -->
                        <VCol cols="12" md="3">
                            <VTextField v-model="product.max_stock" label="Stock Máximo" :rules="stockRules"
                                prepend-inner-icon="ri-stock-line" variant="outlined" density="comfortable"
                                type="number" step="0.01" required />
                        </VCol>

                        <!-- Es Regalo -->
                        <VCol cols="12" md="3">
                            <VSwitch v-model="product.is_gift" label="Es Regalo" prepend-inner-icon="ri-gift-line"
                                color="warning" inset />
                        </VCol>

                        <!-- Notas -->
                        <VCol cols="12">
                            <div class="text-h6 font-weight-medium mb-4">Información Adicional</div>
                        </VCol>

                        <!-- Notas -->
                        <VCol cols="12">
                            <VTextarea v-model="product.notes" label="Notas Adicionales"
                                prepend-inner-icon="ri-file-text-line" variant="outlined" density="comfortable"
                                placeholder="Notas, observaciones o información adicional del producto..." rows="3"
                                auto-grow clearable />
                        </VCol>

                        <!-- Botones de Acción -->
                        <VCol cols="12" class="d-flex gap-2 justify-end">
                            <VBtn variant="outlined" prepend-icon="ri-close-line" to="/product/list"
                                :disabled="isLoading">
                                Cancelar
                            </VBtn>
                            <VBtn type="submit" color="primary" prepend-icon="ri-save-line" :loading="isLoading"
                                :disabled="isLoading">
                                Actualizar Producto
                            </VBtn>
                        </VCol>
                    </VRow>
                </VForm>
            </VCardText>
        </VCard>
    </div>
</template>

<style scoped>
.drop-zone {
    border: 2px dashed rgba(var(--v-theme-primary), 0.3);
    transition: all 0.3s ease;
    cursor: pointer;
    background: rgba(var(--v-theme-surface), 1);
}

.drop-zone:hover {
    border-color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.05);
}

.drop-zone.dragover {
    border-color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.1);
}

.position-relative {
    position: relative;
}

.position-absolute {
    position: absolute;
}

.top-0 {
    top: 0;
}

.right-0 {
    right: 0;
}
</style>