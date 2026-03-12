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
const success = ref(null)
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

    const purchasePrice = parseFloat(product.value.purchase_price) || 0
    const salePrice = parseFloat(product.value.price_sale) || 0
    const discountPercentage = parseFloat(product.value.discount_percentage) || 0

    if (purchasePrice > 0 && salePrice > 0 && discountPercentage > 0) {
        // Calcular descuento máximo basado en el porcentaje ingresado
        const maxDiscountAmount = (salePrice - purchasePrice) * discountPercentage / 100
        product.value.max_discount = parseFloat(maxDiscountAmount.toFixed(2))
    } else {
        product.value.max_discount = 0
    }
}

// Watchers para recalcular descuento
watch(() => product.value.purchase_price, calculateMaxDiscount)
watch(() => product.value.price_sale, calculateMaxDiscount)
watch(() => product.value.tax_rate, calculateMaxDiscount)
watch(() => product.value.discount_percentage, calculateMaxDiscount)

// Computed para asegurar valores correctos de los switches
const isTaxableSwitch = computed({
    get: () => product.value.is_taxable === 1,
    set: (value) => {
        product.value.is_taxable = value ? 1 : 2
    }
})

const isGiftSwitch = computed({
    get: () => product.value.is_gift === 1,
    set: (value) => {
        product.value.is_gift = value ? 1 : 2
    }
})

// Cargar producto existente
const loadProduct = async () => {
    try {
        isLoading.value = true
        const productId = route.params.id

        const response = await $api(`products/${productId}`)
        console.log(response);

        if (response.status === 200) {
            product.value = response.product;
            // Asegurar que los descuentos sean números, no strings
            if (response.product.max_discount) {
                product.value.max_discount = parseFloat(response.product.max_discount)
            }
            if (response.product.discount_percentage) {
                product.value.discount_percentage = parseFloat(response.product.discount_percentage)
            }

            if (response.product.imagen) {
                fileData.value = [{
                    url: response.product.imagen,
                    file: null // Indica que es una imagen existente
                }]
            }
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
        const resp = await $api(`products/config`, {
            method: "GET",
            onResponseError({ response }) {
                console.error('❌ Error al cargar configuración de productos:', response._data)
                showNotification('Error al cargar configuración de productos', 'error')
            }
        })

        categories.value = resp.data.categories || []
        warehouses.value = resp.data.warehouses || []
        units.value = resp.data.units || []
        suppliers.value = resp.data.suppliers || []
    } catch (error) {
        console.error('❌ Error al cargar datos iniciales:', error)
        showNotification('Error al cargar configuración de productos', 'error')
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
        loader.start()
        success.value = null
        error_exist.value = null
        warning.value = null

        const formData = new FormData()

        // Debug para is_taxable

        formData.append('is_taxable', product.value.is_taxable === 1 ? 1 : 2)
        formData.append('is_gift', product.value.is_gift === 1 ? 1 : 2)



        // Agregar todos los campos del producto
        Object.keys(product.value).forEach(key => {
            // Excluir campos que ya se manejan manualmente y valores nulos
            if (key !== 'imagen' && key !== 'is_taxable' && key !== 'is_gift' && product.value[key] !== null) {
                formData.append(key, product.value[key])
            }
        })


        formData.set('is_taxable', product.value.is_taxable === 1 ? 1 : 2)
        formData.set('is_gift', product.value.is_gift === 1 ? 1 : 2)



        // Agregar imagen si hay una nueva
        if (fileData.value.length > 0 && fileData.value[0].file) {
            formData.append('imagen', fileData.value[0].file)
        }

        // Agregar método PUT para actualización
        formData.append('_method', 'PUT')

        /* formData.forEach((value, key) => {
            console.log("campo " + key + ":", value)
        })
         */

        const response = await $api(`products/${product.value.id}`, {
            method: 'POST',
            body: formData,
            onResponseError({ response }) {
                console.error('❌ Error de API:', response._data)
                showNotification('error', response._data.message || 'Error al actualizar el producto')
            }
        })

        if (response.status === 200) {
            /* showNotification('success', 'Producto actualizado correctamente') */
            success.value = 'Producto actualizado correctamente'
            /* router.push('/product/list') */
        }
    } catch (error) {
        console.error('❌ Error al actualizar producto:', error)
        /* showNotification('error', 'Error al actualizar el producto') */
        error_exist.value = 'Error al actualizar el producto'
    } finally {
        isLoading.value = false;
        loader.stop()
    }
}

// Limpiar imagen
const clearImage = () => {
    fileData.value = []
    product.value.imagen = null
}

// Resetear formulario
const onFormReset = () => {
    formRef.value.reset()
    router.push('/product/list')
}

// Montar componente
onMounted(() => {
    loadInitialData()
    loadProduct()
})
</script>

<template>
    <!-- Overlay global -->
    <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
        <VProgressCircular indeterminate size="48" width="4" color="primary" />
    </VOverlay>

    <div class="pa-4 pa-sm-6">
        <VCard class="pa-6 pa-sm-8 rounded-lg elevation-4 max-w-1200 mx-auto">
            <!-- Header -->
            <div class="d-flex justify-space-between align-center mb-6 pb-4 border-b">
                <h1 class="text-h4 font-weight-bold mb-1">
                    Editar Producto
                </h1>
                <VBtn color="primary" variant="elevated" prepend-icon="ri-arrow-left-line" to="/product/list">
                    Volver al Listado
                </VBtn>
            </div>

            <!-- Formulario -->
            <VForm ref="formRef" @submit.prevent="updateProduct">
                <!-- Información Básica -->
                <div class="mb-6">
                    <h2 class="text-h6 font-weight-medium mb-4">
                        Información Básica
                    </h2>
                    <VRow>
                        <VCol cols="12" md="6">
                            <VTextField v-model="product.description" :rules="descriptionRules"
                                label="Descripción del Producto" placeholder="Ej. Laptop Dell XPS 15" variant="outlined"
                                density="comfortable" prepend-inner-icon="ri-price-tag-3-line" hide-details="auto"
                                required />
                        </VCol>

                        <VCol cols="12" md="6">
                            <VTextField v-model="product.sku" :rules="skuRules" label="SKU" placeholder="Ej. LAP-001"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-barcode-line"
                                hide-details="auto" required />
                        </VCol>

                        <VCol cols="12" md="4">
                            <VTextField v-model="product.code_aux" :rules="codeAuxRules" label="Código Auxiliar"
                                placeholder="Ej. PROD-001" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-code-line" hide-details="auto" />
                        </VCol>

                        <VCol cols="12" md="4">
                            <VTextField v-model="product.brand" :rules="brandRules" label="Marca" placeholder="Ej. Dell"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-building-line"
                                hide-details="auto" />
                        </VCol>

                        <VCol cols="12" md="4">
                            <VSelect :items="itemTypes" item-title="label" item-value="value"
                                v-model="product.item_type" :rules="[requiredRule]" density="comfortable"
                                variant="outlined" label="Tipo de Ítem" placeholder="Selecciona"
                                prepend-inner-icon="ri-shapes-line" hide-details="auto" required />
                        </VCol>

                        <VCol cols="12">
                            <VTextarea v-model="product.uses" label="Usos del Producto"
                                placeholder="Ej. Oficina, Gaming, etc." variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-tools-line" hide-details="auto" rows="3" auto-grow />
                        </VCol>
                    </VRow>
                </div>

                <!-- Clasificación -->
                <div class="mb-6">
                    <h2 class="text-h6 font-weight-medium mb-4">
                        Clasificación
                    </h2>
                    <VRow>
                        <VCol cols="12" sm="6">
                            <VSelect :items="categories" item-title="title" item-value="id"
                                v-model="product.product_categorie_id" :rules="[requiredRule]" density="comfortable"
                                variant="outlined" label="Categoría" placeholder="Selecciona"
                                prepend-inner-icon="ri-folder-3-line" hide-details="auto" required />
                        </VCol>

                        <VCol cols="12" sm="6">
                            <VSelect :items="warehouses" item-title="name" item-value="id"
                                v-model="product.warehouse_id" :rules="[requiredRule]" density="comfortable"
                                variant="outlined" label="Almacén" placeholder="Selecciona"
                                prepend-inner-icon="ri-home-4-line" hide-details="auto" required />
                        </VCol>

                        <VCol cols="12" sm="6">
                            <VSelect :items="units" item-title="name" item-value="id" v-model="product.unit_id"
                                :rules="[requiredRule]" density="comfortable" variant="outlined"
                                label="Unidad de Medida" placeholder="Selecciona" prepend-inner-icon="ri-ruler-line"
                                hide-details="auto" required />
                        </VCol>

                        <VCol cols="12" sm="6">
                            <VSelect :items="suppliers" item-title="name" item-value="id" v-model="product.supplier_id"
                                density="comfortable" variant="outlined" label="Proveedor" placeholder="Selecciona"
                                prepend-inner-icon="ri-truck-line" hide-details="auto" />
                        </VCol>

                        <VCol cols="12" sm="6">
                            <VTextField v-model="product.tax_rate" :rules="percentageRules" label="Impuesto (%)"
                                placeholder="0" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-receipt-line" hide-details="auto" type="number" step="0.1"
                                min="0" max="100" readonly />
                        </VCol>
                    </VRow>
                </div>

                <!-- Precios y Descuentos -->
                <div class="mb-6">
                    <h2 class="text-h6 font-weight-medium mb-4">
                        Precios y Descuentos
                    </h2>
                    <VRow>
                        <VCol cols="12" sm="4">
                            <VTextField v-model="product.price_sale" :rules="priceRules" label="Precio de Venta"
                                placeholder="0.00" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-price-tag-3-line" hide-details="auto" type="number" step="0.01"
                                min="0" required />
                        </VCol>

                        <VCol cols="12" sm="4">
                            <VTextField v-model="product.purchase_price" :rules="priceRules" label="Precio de Compra"
                                placeholder="0.00" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-shopping-cart-line" hide-details="auto" type="number" step="0.01"
                                min="0" />
                        </VCol>

                        <VCol cols="12" sm="4">
                            <VTextField v-model="product.discount_percentage" :rules="discountRules"
                                label="Descuento Porcentual" placeholder="0" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-percent-line" hide-details="auto" type="number" step="0.01"
                                min="0" max="100" />
                        </VCol>

                        <VCol cols="12" sm="4">
                            <VTextField v-model="product.max_discount" :rules="discountRules" label="Descuento Máximo"
                                placeholder="0.00" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-price-tag-2-line" hide-details="auto" type="number" step="0.01"
                                min="0" />
                        </VCol>
                    </VRow>
                </div>

                <!-- Inventario -->
                <div class="mb-6">
                    <h2 class="text-h6 font-weight-medium mb-4">
                        Inventario
                    </h2>
                    <VRow>
                        <VCol cols="12" sm="4">
                            <VTextField v-model="product.stock" :rules="stockRules" label="Stock Actual" placeholder="0"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-stack-line"
                                hide-details="auto" type="number" step="0.01" min="0" required />
                        </VCol>

                        <VCol cols="12" sm="4">
                            <VTextField v-model="product.min_stock" :rules="stockRules" label="Stock Mínimo"
                                placeholder="0" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-arrow-down-line" hide-details="auto" type="number" step="0.01"
                                min="0" />
                        </VCol>

                        <VCol cols="12" sm="4">
                            <VTextField v-model="product.max_stock" :rules="stockRules" label="Stock Máximo"
                                placeholder="0" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-arrow-up-line" hide-details="auto" type="number" step="0.01"
                                min="0" />
                        </VCol>
                    </VRow>
                </div>

                <!-- Imagen y Configuración -->
                <div class="mb-6">
                    <h2 class="text-h6 font-weight-medium mb-4">
                        Imagen y Configuración
                    </h2>
                    <VRow>
                        <!-- Imagen -->
                        <VCol cols="12" md="6">
                            <div ref="dropZoneRef" class="cursor-pointer" @click="() => open()">
                                <div v-if="fileData.length === 0"
                                    class="d-flex flex-column justify-center align-center gap-y-3 pa-8 border-2 border-dashed rounded-lg">
                                    <VIcon icon="ri-upload-2-line" size="48" color="primary" />
                                    <h4 class="text-h6 font-weight-medium">
                                        Arrastra y suelte su imagen aquí
                                    </h4>
                                    <span class="text-medium-emphasis">ó</span>
                                    <VBtn variant="outlined" size="small">
                                        Buscar imagen
                                    </VBtn>
                                </div>

                                <div v-else class="pa-4 border-2 border-dashed rounded-lg">
                                    <VRow>
                                        <template v-for="(item, index) in fileData" :key="index">
                                            <VCol cols="12">
                                                <VCard class="elevation-2" :ripple="false">
                                                    <VCardText class="pa-4" @click.stop>
                                                        <VImg :src="item.url" width="100%" height="200px"
                                                            class="rounded-lg mb-3" />
                                                        <div class="text-center">
                                                            <div class="text-body-2 font-weight-medium mb-1">
                                                                {{ item.file?.name || 'Imagen actual' }}
                                                            </div>
                                                            <div class="text-caption text-medium-emphasis">
                                                                {{ item.file ? (item.file.size / 1024).toFixed(2) + 'KB'
                                                                    : 'Imagen existente' }}
                                                            </div>
                                                        </div>
                                                    </VCardText>
                                                    <VCardActions class="pa-4 pt-0">
                                                        <VBtn variant="text" block color="error"
                                                            @click.stop="clearImage">
                                                            <VIcon start icon="ri-delete-bin-line" />
                                                            Eliminar Imagen
                                                        </VBtn>
                                                    </VCardActions>
                                                </VCard>
                                            </VCol>
                                        </template>
                                    </VRow>
                                </div>
                            </div>
                        </VCol>

                        <!-- Configuración Adicional -->
                        <VCol cols="12" md="6">
                            <div class="d-flex flex-column gap-4">
                                <div class="d-flex align-center justify-space-between pa-3 border rounded-lg">
                                    <div class="d-flex align-center gap-3">
                                        <VIcon icon="ri-receipt-line" />
                                        <span>Gravable con Impuestos</span>
                                    </div>

                                    <VSwitch v-model="isTaxableSwitch" hide-details />
                                    <div class="text-caption text-medium-emphasis mt-1">
                                        {{ product.is_taxable === 1 ? 'Sí' : 'No' }}
                                    </div>
                                </div>

                                <div class="d-flex align-center justify-space-between pa-3 border rounded-lg">
                                    <div class="d-flex align-center gap-3">
                                        <VIcon icon="ri-gift-line" />
                                        <span>¿Es un regalo?</span>
                                    </div>
                                    <VSwitch v-model="isGiftSwitch" hide-details />
                                    <div class="text-caption text-medium-emphasis mt-1">
                                        {{ product.is_gift === 1 ? 'Sí' : 'No' }}
                                    </div>
                                </div>

                                <VTextarea v-model="product.notes" label="Notas Adicionales"
                                    placeholder="Ingresa cualquier nota o descripción adicional del producto..."
                                    variant="outlined" density="comfortable" prepend-inner-icon="ri-file-text-line"
                                    hide-details="auto" rows="4" auto-grow />
                            </div>
                        </VCol>
                    </VRow>
                </div>

                <!-- Alertas -->
                <div class="mb-6">
                    <VAlert v-if="warning" color="warning" variant="tonal" closable class="mb-3">
                        {{ warning }}
                    </VAlert>

                    <VAlert v-if="error_exist" color="error" variant="tonal" closable>
                        {{ error_exist }}
                    </VAlert>
                    <VAlert v-if="success" color="success" variant="tonal" closable>
                        {{ success }}
                    </VAlert>
                </div>

                <!-- Botones de Acción -->
                <div class="d-flex justify-end gap-3">
                    <VBtn variant="outlined" @click="onFormReset" prepend-icon="ri-close-line" :disabled="isLoading">
                        Cancelar
                    </VBtn>

                    <VBtn type="submit" color="primary" variant="elevated" :loading="loader.loading"
                        :disabled="loader.loading || isLoading" prepend-icon="ri-save-3-line">
                        Actualizar Producto
                    </VBtn>
                </div>
            </VForm>
        </VCard>
    </div>
</template>

<style scoped>
/* Drop zone simple */
.drop-zone {
    border: 2px dashed rgba(var(--v-theme-primary), 0.3);
    transition: all 0.3s ease;
    cursor: pointer;
}

.drop-zone:hover {
    border-color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.05);
}

/* Utilidades básicas */
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
