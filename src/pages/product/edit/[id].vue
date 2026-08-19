<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useDropZone, useFileDialog, useObjectUrl } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const dropZoneRef = ref()
const fileData = ref([])
const { open, reset, onChange } = useFileDialog({ accept: 'image/*', multiple: false })

const createPreview = file => {
  try {
    return URL.createObjectURL(file)
  } catch (e) {
    console.error('Error creating object URL:', e)
    
    return ''
  }
}

function onDrop(DroppedFiles) {
  if (fileData.value.length >= 1) {
    alert('Solo permite una imagen')
    
    return
  }
  DroppedFiles?.forEach(file => {
    if (file.type.slice(0, 6) !== 'image/') {
      alert('Solo se permiten archivos tipo imagen.')

      return
    }
    if (fileData.value.length < 1) {
      fileData.value.push({
        file,
        url: createPreview(file),
      })
    }
  })
}

onChange(selectedFiles => {
  if (fileData.value.length >= 1) {
    alert('Solo permite una imagen')

    return
  }
  if (!selectedFiles)
    return
  for (const file of selectedFiles) {
    if (fileData.value.length < 1) {
      fileData.value.push({
        file,
        url: createPreview(file),
      })
    }
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
  id: null, description: '', sku: '', code_aux: '', uses: '', imagen: null,
  product_categorie_id: null, warehouse_id: null, unit_id: null, supplier_id: null,
  categorie: null, warehouse: null, unit: null, supplier: null,
  price: 0, price_sale: 0, purchase_price: 0, tax_rate: IVA_RATE,
  max_discount: 0, discount_percentage: 0, discount: 0.00, brand: '', stock: 0,
  item_type: null, min_stock: 0, max_stock: 0, is_taxable: true, is_gift: false,
  notes: '', state: 1,
})

const isLoadingConfig = ref(false)
const categories = ref([])
const warehouses = ref([])
const units = ref([])
const suppliers = ref([])
const brandOptions = ref([])

const loadBrandsByCategory = async categoryId => {
  try {
    const url = categoryId ? `products/brands?categorie_id=${categoryId}` : 'products/brands'
    const resp = await $api(url, { method: 'GET' })
    if (resp?.data && resp.data.length > 0) {
      const catBrands = resp.data
      const currentList = brandOptions.value || []
      const combined = [...new Set([...catBrands, ...currentList])]
      brandOptions.value = combined
    }
  } catch (error) {
    // Si falla, mantiene las marcas cargadas en config
  }
}

watch(() => product.value.product_categorie_id, newCatId => {
  if (newCatId) {
    loadBrandsByCategory(newCatId)
  }
})

const itemTypes = ref([
  { label: 'Producto', value: 1 },
  { label: 'Servicio', value: 2 },
])

const requiredRule = v => !!v || 'Campo obligatorio'
const minLengthRule = min => v => !v || v.length >= min || `Mínimo ${min} caracteres`
const maxLengthRule = max => v => !v || v.length <= max || `Máximo ${max} caracteres`
const minValueRule = min => v => !v || parseFloat(v) >= min || `Mínimo ${min}`
const maxValueRule = max => v => !v || parseFloat(v) <= max || `Máximo ${max}`
const maxDecimalRule = decimals => v => !v || (v.toString().split('.')[1]?.length || 0) <= decimals || `Máximo ${decimals} decimales`
const maxPercentageRule = v => !v || parseFloat(v) <= 100 || 'Máximo 100%'

const descriptionRules = [requiredRule, minLengthRule(3), maxLengthRule(400)]
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
    const maxDiscountAmount = (salePrice - purchasePrice) * discountPercentage / 100

    product.value.max_discount = parseFloat(maxDiscountAmount.toFixed(2))
  } else {
    product.value.max_discount = 0
  }
}

const priceSaleWithIva = ref(0)

// Sincronización bidireccional entre precio base (sin IVA) y precio con IVA
watch(() => product.value.price_sale, newVal => {
  const base = parseFloat(newVal) || 0
  const tax = parseFloat(product.value.tax_rate) || 0
  const calculated = parseFloat((base * (1 + tax / 100)).toFixed(2))
  if (priceSaleWithIva.value === null || parseFloat(priceSaleWithIva.value) !== calculated) {
    priceSaleWithIva.value = calculated
  }
  calculateMaxDiscount()
}, { immediate: true })

watch(() => priceSaleWithIva.value, newVal => {
  const finalVal = parseFloat(newVal) || 0
  const tax = parseFloat(product.value.tax_rate) || 0
  const calculatedBase = parseFloat((finalVal / (1 + tax / 100)).toFixed(2))
  if (parseFloat(product.value.price_sale) !== calculatedBase) {
    product.value.price_sale = calculatedBase
  }
  calculateMaxDiscount()
})

watch(() => product.value.purchase_price, calculateMaxDiscount)
watch(() => product.value.tax_rate, calculateMaxDiscount)
watch(() => product.value.discount_percentage, calculateMaxDiscount)

watch(() => product.value.item_type, newVal => {
  if (newVal == 2) {
    const categoryServicio = categories.value.find(c =>
      c.title && (c.title.toUpperCase() === 'SERVICIO DE TALLER' || c.title.toUpperCase() === 'SERVICIOS DE TALLER'),
    )

    if (categoryServicio) {
      product.value.product_categorie_id = categoryServicio.id
    } else if (categories.value.length > 0) {
      product.value.product_categorie_id = categories.value[0].id
    }

    product.value.warehouse_id = 1

    if (!product.value.unit_id && units.value.length > 0) {
      product.value.unit_id = units.value[0].id
    }
  }
})

const isTaxableSwitch = computed({
  get: () => product.value.is_taxable === 1,
  set: value => { product.value.is_taxable = value ? 1 : 2 },
})

const isGiftSwitch = computed({
  get: () => product.value.is_gift === 1,
  set: value => { product.value.is_gift = value ? 1 : 2 },
})

const loadProduct = async () => {
  try {
    isLoading.value = true

    const productId = route.params.id
    const response = await $api(`products/${productId}`)

    if (response.status === 200) {
      product.value = response.product
      if (response.product.max_discount) product.value.max_discount = parseFloat(response.product.max_discount)
      if (response.product.discount_percentage) product.value.discount_percentage = parseFloat(response.product.discount_percentage)
      if (response.product.discount) product.value.discount = parseFloat(response.product.discount)

      if (response.product.imagen) {
        fileData.value = [{ url: response.product.imagen, file: null }]
      }
    } else {
      showNotification('error', 'No se pudo cargar el producto')
      router.push('/product/list')
    }
  } catch (error) {
    showNotification('error', 'Error al cargar el producto')
    router.push('/product/list')
  } finally {
    isLoading.value = false
  }
}

const loadInitialData = async () => {
  isLoadingConfig.value = true
  try {
    const resp = await $api(`products/config`, {
      method: "GET",
      onResponseError({ response }) {
        showNotification('Error al cargar configuración de productos', 'error')
      },
    })

    categories.value = resp.data.categories || []
    warehouses.value = resp.data.warehouses || []
    units.value = resp.data.units || []
    suppliers.value = resp.data.suppliers || []
    brandOptions.value = resp.data.brands || []
  } catch (error) {
    showNotification('Error al cargar configuración de productos', 'error')
  } finally {
    isLoadingConfig.value = false
  }
}

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

    const isService = product.value.item_type == 2
    const formData = new FormData()

    Object.keys(product.value).forEach(key => {
      if (key !== 'imagen' && key !== 'is_taxable' && key !== 'is_gift' && product.value[key] !== null) {
        let value = product.value[key]
        if (isService) {
          if (key === 'stock' || key === 'min_stock' || key === 'max_stock' || key === 'purchase_price') {
            value = 0
          }
        } else {
          if (key === 'unit_id' || key === 'supplier_id') {
            value = value || 1
          }
        }
        if (key === 'warehouse_id') {
          value = value || 1
        }
        formData.append(key, value)
      }
    })
    formData.set('is_taxable', product.value.is_taxable === 1 ? 1 : 2)
    formData.set('is_gift', product.value.is_gift === 1 ? 1 : 2)

    if (fileData.value.length > 0 && fileData.value[0].file) {
      formData.append('imagen', fileData.value[0].file)
    }
    formData.append('_method', 'PUT')

    const response = await $api(`products/${product.value.id}`, {
      method: 'POST',
      body: formData,
      onResponseError({ response }) {
        showNotification('error', response._data.message || 'Error al actualizar el producto')
      },
    })

    if (response.status === 200) {
      success.value = 'Producto actualizado correctamente'
    }
  } catch (error) {
    error_exist.value = 'Error al actualizar el producto'
  } finally {
    isLoading.value = false
    loader.stop()
  }
}

const clearImage = () => {
  fileData.value.forEach(item => {
    if (item.url && item.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(item.url)
      } catch (e) {
        console.error(e)
      }
    }
  })
  fileData.value = []
  product.value.imagen = null
  reset()
}

const onFormReset = () => {
  formRef.value.reset()
  router.push('/product/list')
}

onMounted(() => {
  loadInitialData()
  loadProduct()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 position-relative">
    <VProgressLinear
      v-if="isLoading || isLoadingConfig"
      v-slot
      indeterminate
      color="primary"
      height="3"
      class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 10;"
    />

    <VCard class="rounded-lg elevation-2 max-w-1200 mx-auto overflow-hidden">
      <!-- Header -->
      <div
        class="pa-6 border-b bg-surface sticky-top d-flex justify-space-between align-center"
        style="z-index: 10;"
      >
        <div class="d-flex align-center gap-4">
          <VAvatar
            color="primary"
            variant="tonal"
            rounded
            size="48"
          >
            <VIcon
              icon="ri-edit-line"
              size="28"
            />
          </VAvatar>
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">
              Editar Producto
            </h1>
            <span class="text-body-2 text-medium-emphasis">Actualiza la información del producto existente</span>
          </div>
        </div>
        <VBtn
          color="primary"
          variant="tonal"
          prepend-icon="ri-arrow-left-line"
          to="/product/list"
          class="align-self-md-center align-self-end"
        >
          Volver al Listado
        </VBtn>
      </div>

      <!-- Form Skeleton Loader -->
      <div
        v-if="isLoading || isLoadingConfig"
        class="pa-6 pb-12 d-flex flex-column gap-6"
      >
        <div class="mb-8">
          <div
            class="shimmer-line w-30 mb-6"
            style="height: 24px;"
          />
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <div
                class="shimmer-line w-100 mb-2"
                style="height: 48px; border-radius: 8px;"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div
                class="shimmer-line w-100 mb-2"
                style="height: 48px; border-radius: 8px;"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <div
                class="shimmer-line w-100 mb-2"
                style="height: 48px; border-radius: 8px;"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <div
                class="shimmer-line w-100 mb-2"
                style="height: 48px; border-radius: 8px;"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <div
                class="shimmer-line w-100 mb-2"
                style="height: 48px; border-radius: 8px;"
              />
            </VCol>
          </VRow>
        </div>
        <VDivider class="my-4" />
        <div class="mb-8">
          <div
            class="shimmer-line w-25 mb-6"
            style="height: 24px;"
          />
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <div
                class="shimmer-line w-100 mb-2"
                style="height: 48px; border-radius: 8px;"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <div
                class="shimmer-line w-100 mb-2"
                style="height: 48px; border-radius: 8px;"
              />
            </VCol>
          </VRow>
        </div>
      </div>

      <VForm
        v-else
        ref="formRef"
        @submit.prevent="updateProduct"
      >
        <div class="pa-6 pb-12">
          <!-- 1. Información Básica -->
          <div class="mb-8">
            <div class="d-flex align-center gap-3 mb-5">
              <VAvatar
                color="info"
                variant="tonal"
                size="36"
              >
                <VIcon icon="ri-information-line" />
              </VAvatar>
              <h2 class="text-h5 font-weight-medium m-0">
                Información Básica
              </h2>
            </div>

            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="product.sku"
                  :rules="skuRules"
                  label="SKU"
                  placeholder="Ej. LAP-001"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-barcode-line"
                  hide-details="auto"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="product.description"
                  :rules="descriptionRules"
                  label="Descripción del Producto"
                  placeholder="Ej. Laptop Dell XPS 15"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-price-tag-3-line"
                  hide-details="auto"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="product.code_aux"
                  :rules="codeAuxRules"
                  label="Código Auxiliar"
                  placeholder="Ej. PROD-001"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-code-line"
                  hide-details="auto"
                />
              </VCol>
              <VCol
                v-if="product.item_type != 2"
                cols="12"
                md="4"
              >
                <VCombobox
                  v-model="product.brand"
                  :items="brandOptions"
                  :rules="brandRules"
                  label="Marca"
                  placeholder="Selecciona o escribe una marca (Ej. MONROE)"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-building-line"
                  hide-details="auto"
                  clearable
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VSelect
                  v-model="product.item_type"
                  :items="itemTypes"
                  item-title="label"
                  item-value="value"
                  :rules="[requiredRule]"
                  density="comfortable"
                  variant="outlined"
                  label="Tipo de Ítem"
                  placeholder="Selecciona"
                  prepend-inner-icon="ri-shapes-line"
                  hide-details="auto"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="product.uses"
                  label="Usos del Producto"
                  placeholder="Ej. Oficina, Gaming, etc."
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-tools-line"
                  hide-details="auto"
                  rows="2"
                  auto-grow
                />
              </VCol>
            </VRow>
          </div>

          <VDivider
            v-if="product.item_type != 2"
            class="my-8"
          />

          <!-- 2. Clasificación -->
          <div
            v-if="product.item_type != 2"
            class="mb-8"
          >
            <div class="d-flex align-center gap-3 mb-5">
              <VAvatar
                color="warning"
                variant="tonal"
                size="36"
              >
                <VIcon icon="ri-folder-3-line" />
              </VAvatar>
              <h2 class="text-h5 font-weight-medium m-0">
                Clasificación
              </h2>
            </div>

            <VRow>
              <VCol
                cols="12"
                sm="6"
              >
                <VSelect
                  v-model="product.product_categorie_id"
                  :items="categories"
                  item-title="title"
                  item-value="id"
                  :rules="[requiredRule]"
                  density="comfortable"
                  variant="outlined"
                  label="Categoría"
                  placeholder="Selecciona"
                  prepend-inner-icon="ri-folder-3-line"
                  hide-details="auto"
                  required
                  :loading="isLoadingConfig"
                />
              </VCol>
              <VCol
                v-if="product.item_type != 2"
                cols="12"
                sm="6"
              >
                <VSelect
                  v-model="product.warehouse_id"
                  :items="warehouses"
                  item-title="name"
                  item-value="id"
                  :rules="product.item_type == 2 ? [] : [requiredRule]"
                  density="comfortable"
                  variant="outlined"
                  label="Almacén"
                  placeholder="Selecciona"
                  prepend-inner-icon="ri-home-4-line"
                  hide-details="auto"
                  required
                  :loading="isLoadingConfig"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <VSelect
                  v-model="product.unit_id"
                  :items="units"
                  item-title="name"
                  item-value="id"
                  :rules="[requiredRule]"
                  density="comfortable"
                  variant="outlined"
                  label="Unidad de Medida"
                  placeholder="Selecciona"
                  prepend-inner-icon="ri-ruler-line"
                  hide-details="auto"
                  required
                  :loading="isLoadingConfig"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <VSelect
                  v-model="product.supplier_id"
                  :items="suppliers"
                  item-title="name"
                  item-value="id"
                  density="comfortable"
                  variant="outlined"
                  label="Proveedor"
                  placeholder="Selecciona"
                  prepend-inner-icon="ri-truck-line"
                  hide-details="auto"
                  :loading="isLoadingConfig"
                />
              </VCol>
            </VRow>
          </div>

          <VDivider class="my-8" />

          <!-- 3. Precios e Inventario -->
          <div class="mb-8">
            <div class="d-flex align-center gap-3 mb-5">
              <VAvatar
                color="success"
                variant="tonal"
                size="36"
              >
                <VIcon icon="ri-money-dollar-circle-line" />
              </VAvatar>
              <h2 class="text-h5 font-weight-medium m-0">
                Precios e Inventario
              </h2>
            </div>

            <VRow>
              <!-- Bloque Precios -->
              <VCol
                cols="12"
                :md="product.item_type == 2 ? '12' : '6'"
              >
                <VCard
                  variant="outlined"
                  class="pa-4 h-100 rounded-lg"
                >
                  <div class="text-subtitle-1 font-weight-bold mb-4">
                    Configuración de Precio
                  </div>
                  <VRow>
                    <VCol
                      v-if="product.item_type != 2"
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="product.purchase_price"
                        :rules="product.item_type == 2 ? [] : priceRules"
                        label="Precio de Compra"
                        placeholder="0.00"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-shopping-cart-line"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      :sm="product.item_type == 2 ? '12' : '6'"
                    >
                      <VTextField
                        v-model="priceSaleWithIva"
                        :rules="priceRules"
                        label="Precio de Venta Final (Con IVA) *"
                        placeholder="0.00"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-money-dollar-circle-fill"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        color="success"
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      :sm="product.item_type == 2 ? '12' : '6'"
                    >
                      <VTextField
                        v-model="product.price_sale"
                        :rules="priceRules"
                        label="Precio de Venta Base (Sin IVA)"
                        placeholder="0.00"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-price-tag-3-line"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="product.discount_percentage"
                        :rules="percentageRules"
                        label="Descuento Max. (%)"
                        placeholder="0"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-percent-line"
                        hide-details="auto"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="product.discount"
                        :rules="discountRules"
                        label="Descuento Inicial ($)"
                        placeholder="0.00"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-money-dollar-circle-line"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="product.tax_rate"
                        :rules="percentageRules"
                        label="Impuesto (%)"
                        placeholder="0"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-receipt-line"
                        hide-details="auto"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        readonly
                      />
                    </VCol>
                  </VRow>
                </VCard>
              </VCol>

              <!-- Bloque Inventario -->
              <VCol
                v-if="product.item_type != 2"
                cols="12"
                md="6"
              >
                <VCard
                  variant="outlined"
                  class="pa-4 h-100 rounded-lg"
                >
                  <div class="text-subtitle-1 font-weight-bold mb-4">
                    Control de Stock
                  </div>
                  <VRow>
                    <VCol cols="12">
                      <VTextField
                        v-model="product.stock"
                        :rules="stockRules"
                        label="Stock Actual"
                        placeholder="0"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-stack-line"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="product.min_stock"
                        :rules="stockRules"
                        label="Stock Mínimo"
                        placeholder="0"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-arrow-down-line"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="product.max_stock"
                        :rules="stockRules"
                        label="Stock Máximo"
                        placeholder="0"
                        variant="outlined"
                        density="comfortable"
                        prepend-inner-icon="ri-arrow-up-line"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </VCol>
                  </VRow>
                </VCard>
              </VCol>
            </VRow>
          </div>

          <VDivider class="my-8" />

          <!-- 4. Imagen y Extras -->
          <div class="mb-4">
            <div class="d-flex align-center gap-3 mb-5">
              <VAvatar
                color="primary"
                variant="tonal"
                size="36"
              >
                <VIcon icon="ri-image-line" />
              </VAvatar>
              <h2 class="text-h5 font-weight-medium m-0">
                Imagen y Extras
              </h2>
            </div>

            <VRow>
              <VCol
                cols="12"
                md="7"
              >
                <div
                  ref="dropZoneRef"
                  class="cursor-pointer h-100"
                  @click="() => open()"
                >
                  <div
                    v-if="fileData.length === 0"
                    class="d-flex flex-column justify-center align-center gap-y-3 pa-8 border-2 border-dashed rounded-lg bg-grey-50 h-100 transition-swing"
                    style="min-height: 250px"
                    hover
                  >
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      size="64"
                    >
                      <VIcon
                        icon="ri-upload-cloud-2-line"
                        size="32"
                      />
                    </VAvatar>
                    <h4 class="text-h6 font-weight-medium">
                      Subir Nueva Imagen Principal
                    </h4>
                    <span class="text-caption text-medium-emphasis">Arrastra tu imagen o haz click para explorar</span>
                  </div>
                  <div
                    v-else
                    class="pa-4 border-2 border-dashed rounded-lg bg-grey-50 h-100"
                  >
                    <VCard
                      v-for="(item, index) in fileData"
                      :key="index"
                      class="elevation-2"
                      :ripple="false"
                    >
                      <VCardText
                        class="pa-4 text-center"
                        @click.stop
                      >
                        <VImg
                          :src="item.url"
                          height="200px"
                          class="rounded-lg mb-3 mx-auto bg-black"
                          contain
                        />
                        <div class="text-body-2 font-weight-medium mb-1 text-truncate">
                          {{ item.file?.name || 'Imagen actual' }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {{ item.file ? (item.file.size / 1024).toFixed(2) + ' KB' : 'Imagen existente' }}
                        </div>
                      </VCardText>
                      <VCardActions class="pa-4 pt-0">
                        <VBtn
                          variant="tonal"
                          block
                          color="error"
                          @click.stop="clearImage"
                        >
                          <VIcon
                            start
                            icon="ri-delete-bin-line"
                          /> Eliminar Imagen
                        </VBtn>
                      </VCardActions>
                    </VCard>
                  </div>
                </div>
              </VCol>

              <VCol
                cols="12"
                md="5"
              >
                <VCard
                  variant="outlined"
                  class="pa-4 rounded-lg bg-grey-50 h-100 d-flex flex-column"
                >
                  <div class="d-flex align-center justify-space-between mb-4">
                    <div class="d-flex align-center gap-3">
                      <VAvatar
                        color="primary"
                        variant="tonal"
                        size="40"
                      >
                        <VIcon icon="ri-receipt-line" />
                      </VAvatar>
                      <span class="font-weight-medium">Gravable con Impuestos</span>
                    </div>
                    <VSwitch
                      v-model="isTaxableSwitch"
                      hide-details
                      color="primary"
                    />
                  </div>
                  <VDivider class="mb-4" />
                  <div class="d-flex align-center justify-space-between mb-4">
                    <div class="d-flex align-center gap-3">
                      <VAvatar
                        color="info"
                        variant="tonal"
                        size="40"
                      >
                        <VIcon icon="ri-gift-line" />
                      </VAvatar>
                      <span class="font-weight-medium">¿Es un regalo?</span>
                    </div>
                    <VSwitch
                      v-model="isGiftSwitch"
                      hide-details
                      color="info"
                    />
                  </div>
                  <VTextarea
                    v-model="product.notes"
                    class="mt-auto"
                    label="Notas Adicionales"
                    placeholder="Observaciones..."
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-file-text-line"
                    hide-details="auto"
                    rows="3"
                    auto-grow
                  />
                </VCard>
              </VCol>
            </VRow>
          </div>
        </div>

        <!-- Sticky Footer -->
        <div class="pa-4 bg-surface sticky-bottom d-flex flex-column flex-md-row justify-space-between align-center gap-4">
          <div class="d-flex flex-column gap-2 w-100 w-sm-auto flex-grow-1">
            <VAlert
              v-if="success"
              color="success"
              variant="tonal"
              closable
              density="compact"
              class="ma-0 text-caption"
            >
              {{ success }}
            </VAlert>
            <VAlert
              v-if="warning"
              color="warning"
              variant="tonal"
              closable
              density="compact"
              class="ma-0 text-caption"
            >
              {{ warning }}
            </VAlert>
            <VAlert
              v-if="error_exist"
              color="error"
              variant="tonal"
              closable
              density="compact"
              class="ma-0 text-caption"
            >
              {{ error_exist }}
            </VAlert>
          </div>
          <div class="d-flex gap-3 w-100 w-sm-auto justify-end">
            <VBtn
              variant="outlined"
              prepend-icon="ri-close-line"
              :disabled="isLoading"
              @click="router.push('/product/list')"
            >
              Cancelar
            </VBtn>
            <VBtn
              type="submit"
              color="primary"
              variant="elevated"
              :loading="loader.loading"
              :disabled="loader.loading || isLoading"
              prepend-icon="ri-save-3-line"
            >
              Actualizar Producto
            </VBtn>
          </div>
        </div>
      </VForm>
    </VCard>
  </div>
</template>

<style scoped>
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

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
