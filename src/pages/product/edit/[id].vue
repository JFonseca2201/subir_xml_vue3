<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useDropZone, useFileDialog, useObjectUrl } from '@vueuse/core'
import ProductExistenceCheckDialog from '@/components/inventory/product/ProductExistenceCheckDialog.vue'
import { compressImage } from '@/utils/imageCompressor'

const route = useRoute()
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const isCheckDialogVisible = ref(false)
const checkInitialQuery = ref('')
const checkSearchField = ref('all')
const skuExistsAlert = ref(null)
const isCheckingSkuOnBlur = ref(false)

const openCheckDialog = (query = '', field = 'all') => {
  const q = query !== undefined && query !== null && query !== ''
    ? query
    : (field === 'sku' ? product.value.sku : (field === 'description' ? product.value.description : (product.value.sku || product.value.description || '')))
  checkInitialQuery.value = (q || '').trim()
  checkSearchField.value = field || 'all'
  isCheckDialogVisible.value = true
}

const handleSkuCheck = async () => {
  const query = product.value.sku?.trim()
  if (!query) {
    skuExistsAlert.value = null
    return
  }

  isCheckingSkuOnBlur.value = true
  try {
    const response = await $api(`products/search?sku=${encodeURIComponent(query)}`, { method: 'GET' })
    const list = Array.isArray(response) ? response : (response.data || response.products || [])

    const currentId = route.params.id
    const otherProducts = list.filter(p => String(p.id) !== String(currentId))

    if (otherProducts.length === 0) {
      skuExistsAlert.value = null
    } else if (otherProducts.length === 1) {
      // 1 sola coincidencia: no abre VDialog, muestra VAlert
      const exactMatch = otherProducts[0]
      skuExistsAlert.value = {
        type: 'error',
        title: `¡Atención! El SKU "${query}" ya pertenece a otro producto`,
        text: `Corresponde a: "${exactMatch.description}" (Stock: ${exactMatch.stock} ${exactMatch.unit?.name || 'UND'} - PVP: $${parseFloat(exactMatch.price_sale || 0).toFixed(2)}).`,
        product: exactMatch,
        count: 1,
      }
    } else {
      // MÁS DE 1 coincidencia: SÍ abre el VDialog
      skuExistsAlert.value = null
      checkInitialQuery.value = query
      checkSearchField.value = 'sku'
      isCheckDialogVisible.value = true
    }
  } catch (e) {
    console.warn('Error al verificar SKU en blur:', e)
  } finally {
    isCheckingSkuOnBlur.value = false
  }
}

const handleSkuBlur = () => {
  handleSkuCheck()
}

const handleSkuSearchClick = async () => {
  const query = product.value.sku?.trim()
  if (!query) {
    showNotification('Ingresa al menos parte de un SKU para buscar', 'warning')
    return
  }

  isCheckingSkuOnBlur.value = true
  try {
    const response = await $api(`products/search?sku=${encodeURIComponent(query)}`, { method: 'GET' })
    const list = Array.isArray(response) ? response : (response.data || response.products || [])

    const currentId = route.params.id
    const otherProducts = list.filter(p => String(p.id) !== String(currentId))

    if (otherProducts.length === 0) {
      skuExistsAlert.value = null
      showNotification(`✅ SKU "${query}" disponible. No existen otras coincidencias.`, 'success')
    } else if (otherProducts.length === 1) {
      // 1 sola coincidencia: no abre VDialog, muestra VAlert
      const exactMatch = otherProducts[0]
      skuExistsAlert.value = {
        type: 'error',
        title: `¡Atención! El SKU "${query}" ya pertenece a otro producto`,
        text: `Corresponde a: "${exactMatch.description}" (Stock: ${exactMatch.stock} ${exactMatch.unit?.name || 'UND'} - PVP: $${parseFloat(exactMatch.price_sale || 0).toFixed(2)}).`,
        product: exactMatch,
        count: 1,
      }
      showNotification(`⚠️ Ya existe 1 producto con este código: "${exactMatch.description}"`, 'warning')
    } else {
      // MÁS DE 1 coincidencia: SÍ abre el VDialog
      skuExistsAlert.value = null
      checkInitialQuery.value = query
      checkSearchField.value = 'sku'
      isCheckDialogVisible.value = true
    }
  } catch (e) {
    console.warn('Error al verificar SKU:', e)
  } finally {
    isCheckingSkuOnBlur.value = false
  }
}

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

async function onDrop(DroppedFiles) {
  if (fileData.value.length >= 1) {
    alert('Solo permite una imagen')
    
    return
  }
  for (const rawFile of (DroppedFiles || [])) {
    if (rawFile.type.slice(0, 6) !== 'image/') {
      alert('Solo se permiten archivos tipo imagen.')

      return
    }
    if (fileData.value.length < 1) {
      const optimizedFile = await compressImage(rawFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
      fileData.value.push({
        file: optimizedFile,
        url: createPreview(optimizedFile),
      })
    }
  }
}

onChange(async selectedFiles => {
  if (fileData.value.length >= 1) {
    alert('Solo permite una imagen')

    return
  }
  if (!selectedFiles)
    return
  for (const rawFile of selectedFiles) {
    if (fileData.value.length < 1) {
      const optimizedFile = await compressImage(rawFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
      fileData.value.push({
        file: optimizedFile,
        url: createPreview(optimizedFile),
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

const purchasePriceWithIva = ref(0)
const priceSaleWithIva = ref(0)

// Sincronización bidireccional para Precio de Compra (Costo con y sin IVA)
watch(() => product.value.purchase_price, newVal => {
  const base = parseFloat(newVal) || 0
  const tax = parseFloat(product.value.tax_rate) || 0
  const calculated = parseFloat((base * (1 + tax / 100)).toFixed(2))
  if (purchasePriceWithIva.value === null || parseFloat(purchasePriceWithIva.value) !== calculated) {
    purchasePriceWithIva.value = calculated
  }
  calculateMaxDiscount()
}, { immediate: true })

watch(() => purchasePriceWithIva.value, newVal => {
  const finalVal = parseFloat(newVal) || 0
  const tax = parseFloat(product.value.tax_rate) || 0
  const calculatedBase = parseFloat((finalVal / (1 + tax / 100)).toFixed(2))
  if (parseFloat(product.value.purchase_price) !== calculatedBase) {
    product.value.purchase_price = calculatedBase
  }
  calculateMaxDiscount()
})

// Sincronización bidireccional entre precio base (sin IVA) y precio con IVA (PVP)
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

      if (!product.value.warehouse_id && response.product.warehouse?.id) {
        product.value.warehouse_id = response.product.warehouse.id
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

    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar
            color="primary"
            variant="tonal"
            rounded="lg"
            size="44"
            class="elevation-1"
          >
            <VIcon
              icon="ri-edit-2-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Editar Producto
              </h1>
              <VChip
                v-if="product.id"
                color="primary"
                size="small"
                variant="tonal"
                class="font-weight-bold font-mono"
                prepend-icon="ri-hashtag"
              >
                ID #{{ product.id }}
              </VChip>
              <VChip
                :color="product.state === 1 ? 'success' : 'secondary'"
                size="small"
                variant="tonal"
                class="font-weight-bold"
              >
                {{ product.state === 1 ? 'Activo' : 'Inactivo' }}
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Actualiza las características, precios, stock o clasificación del producto
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-arrow-left-line"
            class="font-weight-medium"
            :disabled="isLoading || isLoadingConfig || loader.loading"
            @click="router.push('/product/list')"
          >
            Volver al Listado
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Form Skeleton loader -->
    <div
      v-if="isLoading || isLoadingConfig"
      class="d-flex flex-column gap-6"
    >
      <VRow>
        <VCol
          cols="12"
          lg="8"
        >
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div
              class="shimmer-line w-40 mb-6"
              style="height: 24px;"
            />
            <VRow class="mb-4">
              <VCol
                cols="12"
                sm="6"
              >
                <div
                  class="shimmer-line w-100 mb-2"
                  style="height: 48px; border-radius: 8px;"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <div
                  class="shimmer-line w-100 mb-2"
                  style="height: 48px; border-radius: 8px;"
                />
              </VCol>
            </VRow>
            <div
              class="shimmer-line w-100 mb-4"
              style="height: 80px; border-radius: 8px;"
            />
            <div
              class="shimmer-line w-100"
              style="height: 120px; border-radius: 8px;"
            />
          </VCard>
        </VCol>
        <VCol
          cols="12"
          lg="4"
        >
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div
              class="shimmer-line w-60 mb-6"
              style="height: 24px;"
            />
            <div
              class="shimmer-line w-100 mb-4"
              style="height: 48px; border-radius: 8px;"
            />
            <div
              class="shimmer-line w-100 mb-4"
              style="height: 48px; border-radius: 8px;"
            />
            <div
              class="shimmer-line w-100"
              style="height: 48px; border-radius: 8px;"
            />
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- Formulario Principal -->
    <VForm
      v-else
      ref="formRef"
      @submit.prevent="updateProduct"
    >
      <VRow>
        <!-- Columna Izquierda (8 cols): Tipo, Info Básica, Clasificación, Stock -->
        <VCol
          cols="12"
          lg="8"
        >
          <!-- Tarjeta 1: Tipo de Ítem / Clasificación -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="36"
                      color="primary"
                      variant="tonal"
                      class="rounded-lg"
                    >
                      <VIcon
                        icon="ri-shapes-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Tipo de Ítem
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Define el comportamiento de inventario y facturación
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <div class="doc-type-united-group rounded-xl d-flex flex-column flex-md-row">
                <!-- Opción Producto -->
                <div
                  class="doc-type-united-item rounded-lg pa-3 px-4 cursor-pointer d-flex align-center justify-space-between"
                  :class="product.item_type == 1 || !product.item_type ? 'doc-type-selected-primary' : 'doc-type-unselected'"
                  @click="product.item_type = 1"
                >
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      :color="product.item_type == 1 || !product.item_type ? 'primary' : 'grey-lighten-3'"
                      :variant="product.item_type == 1 || !product.item_type ? 'flat' : 'tonal'"
                      size="40"
                      class="transition-all"
                    >
                      <VIcon
                        icon="ri-box-3-line"
                        size="22"
                        :color="product.item_type == 1 || !product.item_type ? 'white' : 'grey-darken-1'"
                      />
                    </VAvatar>
                    <div>
                      <div
                        class="text-body-2 font-weight-bold"
                        :class="product.item_type == 1 || !product.item_type ? 'text-primary' : 'text-grey-darken-3'"
                      >
                        Producto Físico
                      </div>
                      <div
                        class="text-caption text-medium-emphasis"
                        style="font-size: 0.75rem;"
                      >
                        Control de stock y bodega
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <VChip
                      size="x-small"
                      :color="product.item_type == 1 || !product.item_type ? 'primary' : 'grey'"
                      :variant="product.item_type == 1 || !product.item_type ? 'tonal' : 'outlined'"
                      class="font-weight-bold"
                    >
                      Físico
                    </VChip>
                    <VIcon
                      :icon="product.item_type == 1 || !product.item_type ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                      size="20"
                      :color="product.item_type == 1 || !product.item_type ? 'primary' : 'grey-lighten-1'"
                    />
                  </div>
                </div>

                <!-- Opción Servicio -->
                <div
                  class="doc-type-united-item rounded-lg pa-3 px-4 cursor-pointer d-flex align-center justify-space-between"
                  :class="product.item_type == 2 ? 'doc-type-selected-success' : 'doc-type-unselected'"
                  @click="product.item_type = 2"
                >
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      :color="product.item_type == 2 ? 'success' : 'grey-lighten-3'"
                      :variant="product.item_type == 2 ? 'flat' : 'tonal'"
                      size="40"
                      class="transition-all"
                    >
                      <VIcon
                        icon="ri-tools-line"
                        size="22"
                        :color="product.item_type == 2 ? 'white' : 'grey-darken-1'"
                      />
                    </VAvatar>
                    <div>
                      <div
                        class="text-body-2 font-weight-bold"
                        :class="product.item_type == 2 ? 'text-success' : 'text-grey-darken-3'"
                      >
                        Servicio Técnico
                      </div>
                      <div
                        class="text-caption text-medium-emphasis"
                        style="font-size: 0.75rem;"
                      >
                        Mano de obra sin inventario
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <VChip
                      size="x-small"
                      :color="product.item_type == 2 ? 'success' : 'grey'"
                      :variant="product.item_type == 2 ? 'tonal' : 'outlined'"
                      class="font-weight-bold"
                    >
                      Servicio
                    </VChip>
                    <VIcon
                      :icon="product.item_type == 2 ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                      size="20"
                      :color="product.item_type == 2 ? 'success' : 'grey-lighten-1'"
                    />
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- Tarjeta 2: Información Principal y Códigos -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="36"
                    color="primary"
                    variant="tonal"
                    class="rounded-lg"
                  >
                    <VIcon
                      icon="ri-information-line"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                      Información Principal y Códigos
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Identificación, descripción y códigos de búsqueda del ítem
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <VRow>
                <!-- Alerta si el SKU ya existe al abandonar el campo -->
                <VCol
                  v-if="skuExistsAlert"
                  cols="12"
                  class="py-1"
                >
                  <VAlert
                    :type="skuExistsAlert.type || 'error'"
                    variant="tonal"
                    density="comfortable"
                    closable
                    class="rounded-lg mb-1"
                    @click:close="skuExistsAlert = null"
                  >
                    <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                      <div>
                        <div class="font-weight-bold">
                          {{ skuExistsAlert.title }}
                        </div>
                        <div class="text-caption">
                          {{ skuExistsAlert.text }}
                        </div>
                      </div>
                      <div class="d-flex align-center gap-2">
                        <VBtn
                          v-if="skuExistsAlert.count > 1"
                          size="small"
                          variant="tonal"
                          :color="skuExistsAlert.type"
                          class="text-none font-weight-medium"
                          @click="openCheckDialog(product.sku, 'sku')"
                        >
                          Ver {{ skuExistsAlert.count }} Coincidencias
                        </VBtn>
                        <VBtn
                          size="small"
                          variant="elevated"
                          :color="skuExistsAlert.type"
                          class="text-none font-weight-bold"
                          @click="openCheckDialog(product.sku, 'sku')"
                        >
                          Ver Ficha Completa
                        </VBtn>
                      </div>
                    </div>
                  </VAlert>
                </VCol>

                <!-- SKU / Código Principal -->
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="product.sku"
                    :rules="skuRules"
                    label="SKU / Código Principal *"
                    placeholder="Ej. LAP-001 / SRV-001"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-barcode-line"
                    hide-details="auto"
                    required
                    color="primary"
                    :loading="isCheckingSkuOnBlur"
                    @blur="handleSkuBlur"
                    @update:model-value="skuExistsAlert = null"
                  >
                    <template #append-inner>
                      <VTooltip
                        text="Buscar coincidencias de este SKU"
                        location="top"
                      >
                        <template #activator="{ props: tooltipProps }">
                          <VBtn
                            v-bind="tooltipProps"
                            icon="ri-search-line"
                            variant="text"
                            color="primary"
                            density="compact"
                            size="small"
                            class="me-n1"
                            @click.stop="handleSkuSearchClick"
                          />
                        </template>
                      </VTooltip>
                    </template>
                  </VTextField>
                </VCol>

                <!-- Código Auxiliar -->
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="product.code_aux"
                    :rules="codeAuxRules"
                    label="Código Auxiliar / Alternativo"
                    placeholder="Ej. PROD-001 / REF-2024"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-code-line"
                    hide-details="auto"
                    color="primary"
                  />
                </VCol>

                <!-- Descripción del Producto -->
                <VCol cols="12">
                  <VTextField
                    v-model="product.description"
                    :rules="descriptionRules"
                    label="Descripción / Nombre del Producto *"
                    placeholder="Ej. AMORTIGUADOR DELANTERO CHEVROLET AVEO RH"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-price-tag-3-line"
                    hide-details="auto"
                    required
                    color="primary"
                  >
                    <template #append-inner>
                      <VTooltip
                        text="Buscar coincidencias de este Nombre"
                        location="top"
                      >
                        <template #activator="{ props: tooltipProps }">
                          <VBtn
                            v-bind="tooltipProps"
                            icon="ri-search-line"
                            variant="text"
                            color="primary"
                            density="compact"
                            size="small"
                            class="me-n1"
                            @click.stop="openCheckDialog(product.description, 'description')"
                          />
                        </template>
                      </VTooltip>
                    </template>
                  </VTextField>
                </VCol>

                <!-- Marca -->
                <VCol
                  v-if="product.item_type != 2"
                  cols="12"
                  sm="6"
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
                    color="primary"
                  />
                </VCol>

                <!-- Usos / Aplicaciones -->
                <VCol
                  cols="12"
                  :sm="product.item_type != 2 ? 6 : 12"
                >
                  <VTextField
                    v-model="product.uses"
                    label="Usos / Aplicaciones"
                    placeholder="Ej. VEHÍCULO LIVIANO / CAMIONETAS"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-tools-line"
                    hide-details="auto"
                    color="primary"
                  />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Tarjeta 3: Clasificación y Ubicación en Bodega (Solo productos físicos) -->
          <VCard
            v-if="product.item_type != 2"
            class="rounded-xl border-light elevation-1 mb-6 overflow-hidden"
          >
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="36"
                    color="warning"
                    variant="tonal"
                    class="rounded-lg"
                  >
                    <VIcon
                      icon="ri-folder-3-line"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                      Clasificación y Ubicación
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Categoría, almacén de depósito, unidad de medida y proveedor
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <VRow>
                <!-- Categoría -->
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
                    label="Categoría *"
                    placeholder="Selecciona categoría"
                    prepend-inner-icon="ri-folder-3-line"
                    hide-details="auto"
                    required
                    color="primary"
                    :loading="isLoadingConfig"
                  />
                </VCol>

                <!-- Almacén -->
                <VCol
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
                    label="Almacén / Bodega *"
                    placeholder="Selecciona almacén"
                    prepend-inner-icon="ri-home-4-line"
                    hide-details="auto"
                    required
                    color="primary"
                    :loading="isLoadingConfig"
                  />
                </VCol>

                <!-- Unidad de Medida -->
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
                    label="Unidad de Medida *"
                    placeholder="Selecciona unidad"
                    prepend-inner-icon="ri-ruler-line"
                    hide-details="auto"
                    required
                    color="primary"
                    :loading="isLoadingConfig"
                  >
                    <template #item="{ item, props }">
                      <VListItem v-bind="props">
                        <template #prepend>
                          <VAvatar
                            size="24"
                            color="primary"
                            variant="tonal"
                            class="me-2"
                          >
                            <span class="text-caption font-weight-bold">{{ item.raw.code || 'UND' }}</span>
                          </VAvatar>
                        </template>
                      </VListItem>
                    </template>
                  </VSelect>
                </VCol>

                <!-- Proveedor -->
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
                    label="Proveedor Principal"
                    placeholder="Selecciona proveedor"
                    prepend-inner-icon="ri-truck-line"
                    hide-details="auto"
                    color="primary"
                    :loading="isLoadingConfig"
                  />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Tarjeta 4: Control de Stock e Inventario (Solo productos físicos) -->
          <VCard
            v-if="product.item_type != 2"
            class="rounded-xl border-light elevation-1 mb-6 overflow-hidden"
          >
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="36"
                    color="info"
                    variant="tonal"
                    class="rounded-lg"
                  >
                    <VIcon
                      icon="ri-stack-line"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                      Control de Stock e Inventario
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Gestión de cantidades disponibles y alertas de reabastecimiento
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <VRow>
                <!-- Stock Inicial Actual -->
                <VCol
                  cols="12"
                  sm="4"
                >
                  <VTextField
                    v-model="product.stock"
                    :rules="stockRules"
                    label="Stock Actual *"
                    placeholder="0"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-stack-line"
                    hide-details="auto"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    color="primary"
                  />
                </VCol>

                <!-- Stock Mínimo -->
                <VCol
                  cols="12"
                  sm="4"
                >
                  <VTextField
                    v-model="product.min_stock"
                    :rules="stockRules"
                    label="Stock Mínimo (Alerta)"
                    placeholder="0"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-arrow-down-line"
                    hide-details="auto"
                    type="number"
                    step="0.01"
                    min="0"
                    color="warning"
                  />
                </VCol>

                <!-- Stock Máximo -->
                <VCol
                  cols="12"
                  sm="4"
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
                    color="info"
                  />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Tarjeta 5: Observaciones y Notas (Compacta) -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon
                    icon="ri-file-text-line"
                    size="18"
                    class="text-medium-emphasis"
                  />
                  <span class="text-subtitle-2 font-weight-bold text-slate-800">Observaciones y Notas Internas</span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 bg-white">
              <VTextarea
                v-model="product.notes"
                placeholder="Notas adicionales, especificaciones técnicas o términos de garantía..."
                variant="outlined"
                rows="2"
                density="comfortable"
                hide-details="auto"
                color="primary"
                auto-grow
              />
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Derecha (4 cols): Imagen, Precios, Costos y Acciones -->
        <VCol
          cols="12"
          lg="4"
        >
          <div class="d-flex flex-column gap-6 sticky-sidebar">
            <!-- Tarjeta A: Imagen Principal -->
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="36"
                      color="primary"
                      variant="tonal"
                      class="rounded-lg"
                    >
                      <VIcon
                        icon="ri-image-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Imagen del Producto
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Foto representativa para catálogo
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>

              <VCardText class="pa-4 bg-white">
                <div
                  ref="dropZoneRef"
                  class="cursor-pointer"
                  @click="() => open()"
                >
                  <div
                    v-if="fileData.length === 0"
                    class="d-flex flex-column justify-center align-center gap-2 pa-6 border-2 border-dashed rounded-xl bg-slate-50 transition-swing text-center"
                    style="min-height: 180px;"
                  >
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      size="48"
                      class="mb-1"
                    >
                      <VIcon
                        icon="ri-upload-cloud-2-line"
                        size="26"
                      />
                    </VAvatar>
                    <div class="text-body-2 font-weight-bold text-slate-800">
                      Subir Imagen
                    </div>
                    <span
                      class="text-caption text-medium-emphasis"
                      style="font-size: 0.75rem;"
                    >
                      Arrastra o haz clic para seleccionar (JPG, PNG)
                    </span>
                  </div>
                  <div
                    v-else
                    class="pa-2 border rounded-xl bg-slate-50"
                  >
                    <VCard
                      v-for="(item, index) in fileData"
                      :key="index"
                      class="elevation-0 border rounded-lg overflow-hidden bg-white"
                      :ripple="false"
                    >
                      <VCardText
                        class="pa-3 text-center"
                        @click.stop
                      >
                        <VImg
                          :src="item.url"
                          height="160px"
                          class="rounded-lg mb-2 mx-auto bg-slate-100"
                          contain
                        />
                        <div class="text-caption font-weight-bold mb-0 text-truncate text-slate-800">
                          {{ item.file?.name || 'Imagen actual' }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {{ item.file ? (item.file.size / 1024).toFixed(2) + ' KB' : 'Imagen existente' }}
                        </div>
                      </VCardText>
                      <VCardActions class="pa-3 pt-0">
                        <VBtn
                          variant="tonal"
                          block
                          size="small"
                          color="error"
                          prepend-icon="ri-delete-bin-line"
                          class="font-weight-medium"
                          @click.stop="clearImage"
                        >
                          Eliminar Imagen
                        </VBtn>
                      </VCardActions>
                    </VCard>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <!-- Tarjeta B: Estructura de Precios e Impuestos -->
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                    <div class="d-flex align-center gap-3">
                      <VAvatar
                        size="36"
                        color="success"
                        variant="tonal"
                        class="rounded-lg"
                      >
                        <VIcon
                          icon="ri-money-dollar-circle-line"
                          size="20"
                        />
                      </VAvatar>
                      <div>
                        <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                          Precios y Costos
                        </h3>
                        <p class="text-caption text-medium-emphasis mb-0">
                          Tarifas de venta, costos y márgenes
                        </p>
                      </div>
                    </div>
                    <VChip
                      size="small"
                      color="primary"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      IVA {{ product.tax_rate || 15 }}%
                    </VChip>
                  </div>
                </template>
              </VCardItem>

              <VCardText class="pa-4 bg-white d-flex flex-column gap-4">
                <!-- Switches Tributarios -->
                <div class="pa-3 rounded-xl bg-slate-50 border d-flex flex-column gap-2">
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-2">
                      <VIcon
                        icon="ri-receipt-line"
                        size="18"
                        color="primary"
                      />
                      <span class="text-caption font-weight-bold text-slate-800">Graba IVA (15%)</span>
                    </div>
                    <VSwitch
                      v-model="isTaxableSwitch"
                      hide-details
                      density="compact"
                      color="primary"
                    />
                  </div>
                  <VDivider />
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-2">
                      <VIcon
                        icon="ri-gift-line"
                        size="18"
                        color="info"
                      />
                      <span class="text-caption font-weight-bold text-slate-800">¿Es un regalo / muestra?</span>
                    </div>
                    <VSwitch
                      v-model="isGiftSwitch"
                      hide-details
                      density="compact"
                      color="info"
                    />
                  </div>
                </div>

                <!-- Precios de Compra (Solo productos físicos) -->
                <template v-if="product.item_type != 2">
                  <div class="d-flex flex-column gap-2">
                    <div class="text-caption font-weight-bold text-slate-700 text-uppercase">
                      Costo de Compra
                    </div>
                    <VRow dense>
                      <VCol
                        cols="12"
                        sm="6"
                      >
                        <VTextField
                          v-model="purchasePriceWithIva"
                          :rules="priceRules"
                          label="Costo (Con IVA)"
                          placeholder="0.00"
                          variant="outlined"
                          density="compact"
                          prefix="$"
                          prepend-inner-icon="ri-shopping-cart-fill"
                          hide-details="auto"
                          type="number"
                          step="0.01"
                          min="0"
                          class="font-mono font-weight-semibold"
                        />
                      </VCol>
                      <VCol
                        cols="12"
                        sm="6"
                      >
                        <VTextField
                          v-model="product.purchase_price"
                          :rules="priceRules"
                          label="Costo Base (Sin IVA)"
                          placeholder="0.00"
                          variant="outlined"
                          density="compact"
                          prefix="$"
                          prepend-inner-icon="ri-shopping-cart-line"
                          hide-details="auto"
                          type="number"
                          step="0.01"
                          min="0"
                          class="font-mono font-weight-semibold"
                        />
                      </VCol>
                    </VRow>
                  </div>
                </template>

                <!-- Precios de Venta / PVP -->
                <div class="d-flex flex-column gap-2">
                  <div class="text-caption font-weight-bold text-slate-700 text-uppercase">
                    Precio de Venta al Público (PVP)
                  </div>
                  <VRow dense>
                    <VCol
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="priceSaleWithIva"
                        :rules="priceRules"
                        label="PVP Final (Con IVA) *"
                        placeholder="0.00"
                        variant="outlined"
                        density="compact"
                        prefix="$"
                        prepend-inner-icon="ri-money-dollar-circle-fill"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        color="success"
                        class="font-mono font-weight-bold"
                      />
                    </VCol>
                    <VCol
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="product.price_sale"
                        :rules="priceRules"
                        label="PVP Base (Sin IVA) *"
                        placeholder="0.00"
                        variant="outlined"
                        density="compact"
                        prefix="$"
                        prepend-inner-icon="ri-price-tag-3-line"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        color="primary"
                        class="font-mono font-weight-semibold"
                      />
                    </VCol>
                  </VRow>
                </div>

                <!-- Descuentos Permitidos -->
                <div class="d-flex flex-column gap-2">
                  <div class="text-caption font-weight-bold text-slate-700 text-uppercase">
                    Políticas de Descuento
                  </div>
                  <VRow dense>
                    <VCol
                      cols="12"
                      sm="6"
                    >
                      <VTextField
                        v-model="product.discount_percentage"
                        :rules="percentageRules"
                        label="Desc. Máx. (%)"
                        placeholder="0"
                        variant="outlined"
                        density="compact"
                        suffix="%"
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
                        label="Desc. Inicial ($)"
                        placeholder="0.00"
                        variant="outlined"
                        density="compact"
                        prefix="$"
                        prepend-inner-icon="ri-money-dollar-circle-line"
                        hide-details="auto"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </VCol>
                  </VRow>
                </div>

                <!-- Resumen Financiero & Margen Estimado -->
                <div class="pa-3 rounded-xl bg-slate-50 border mt-1">
                  <div class="d-flex justify-space-between align-center mb-1 text-caption">
                    <span class="text-medium-emphasis">PVP Final:</span>
                    <span class="font-mono font-weight-bold text-success">${{ (Number(priceSaleWithIva) || 0).toFixed(2) }}</span>
                  </div>
                  <div
                    v-if="product.item_type != 2"
                    class="d-flex justify-space-between align-center mb-1 text-caption"
                  >
                    <span class="text-medium-emphasis">Costo Compra:</span>
                    <span class="font-mono font-weight-semibold text-slate-700">${{ (Number(purchasePriceWithIva) || 0).toFixed(2) }}</span>
                  </div>
                  <VDivider
                    v-if="product.item_type != 2"
                    class="my-2"
                  />
                  <div
                    v-if="product.item_type != 2 && Number(product.price_sale) > 0 && Number(product.purchase_price) > 0"
                    class="d-flex justify-space-between align-center"
                  >
                    <span class="text-caption font-weight-bold text-slate-800">Margen Estimado:</span>
                    <VChip
                      size="small"
                      color="info"
                      variant="flat"
                      class="font-weight-bold font-mono px-2"
                    >
                      +${{ (Number(product.price_sale) - Number(product.purchase_price)).toFixed(2) }} ({{ (((Number(product.price_sale) - Number(product.purchase_price)) / Number(product.purchase_price)) * 100).toFixed(1) }}%)
                    </VChip>
                  </div>
                  <div
                    v-else
                    class="text-caption text-medium-emphasis text-center py-1"
                  >
                    Ingresa costo y PVP para calcular margen
                  </div>
                </div>
              </VCardText>

              <VDivider />

              <!-- Acciones de Guardar -->
              <VCardActions class="pa-4 bg-slate-50 sales-actions-container">
                <!-- Alertas -->
                <VAlert
                  v-if="success"
                  color="success"
                  variant="tonal"
                  class="w-100 mb-2 rounded-lg"
                  border="start"
                  closable
                  @click:close="success = null"
                >
                  <div class="d-flex align-center">
                    <VIcon
                      icon="ri-checkbox-circle-line"
                      class="mr-2"
                      size="18"
                    />
                    <span class="text-caption font-weight-bold">{{ success }}</span>
                  </div>
                </VAlert>

                <VAlert
                  v-if="warning"
                  color="warning"
                  variant="tonal"
                  class="w-100 mb-2 rounded-lg"
                  border="start"
                  closable
                  @click:close="warning = null"
                >
                  <div class="d-flex align-center">
                    <VIcon
                      icon="ri-alert-line"
                      class="mr-2"
                      size="18"
                    />
                    <span class="text-caption font-weight-bold">{{ warning }}</span>
                  </div>
                </VAlert>

                <VAlert
                  v-if="error_exist"
                  color="error"
                  variant="tonal"
                  class="w-100 mb-2 rounded-lg"
                  border="start"
                  closable
                  @click:close="error_exist = null"
                >
                  <div class="d-flex align-center">
                    <VIcon
                      icon="ri-error-warning-line"
                      class="mr-2"
                      size="18"
                    />
                    <span class="text-caption font-weight-bold">{{ error_exist }}</span>
                  </div>
                </VAlert>

                <div class="d-flex gap-3 w-100">
                  <VBtn
                    color="secondary"
                    variant="outlined"
                    prepend-icon="ri-close-line"
                    class="font-weight-medium flex-grow-1"
                    :disabled="isLoading || isLoadingConfig || loader.loading"
                    @click="router.push('/product/list')"
                  >
                    Cancelar
                  </VBtn>

                  <VBtn
                    type="submit"
                    color="primary"
                    variant="elevated"
                    prepend-icon="ri-save-3-line"
                    class="font-weight-bold elevation-2 flex-grow-1"
                    :loading="loader.loading"
                    :disabled="loader.loading || isLoading || isLoadingConfig"
                  >
                    ACTUALIZAR PRODUCTO
                  </VBtn>
                </div>
              </VCardActions>
            </VCard>
          </div>
        </VCol>
      </VRow>
    </VForm>

    <!-- Diálogo de Verificación de Existencia de Producto -->
    <ProductExistenceCheckDialog
      v-model="isCheckDialogVisible"
      :initial-query="checkInitialQuery"
      :search-field="checkSearchField"
    />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
}

.sticky-header {
  position: sticky;
  top: 12px;
  z-index: 9;
  backdrop-filter: blur(8px);
}

.sticky-sidebar {
  position: sticky;
  top: 90px;
}

/* Selector Segmentado de Tipo de Ítem (Estilo Ventas) */
.doc-type-united-group {
  display: flex;
  background-color: #f1f5f9;
  padding: 4px;
  gap: 6px;
  border: 1px solid #e2e8f0;
}

.doc-type-united-item {
  flex: 1;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background-color: transparent;
  user-select: none;
}

.doc-type-unselected {
  opacity: 0.85;
}

.doc-type-unselected:hover {
  background-color: rgba(255, 255, 255, 0.6);
  opacity: 1;
}

.doc-type-selected-primary {
  background-color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1.5px solid rgba(99, 102, 241, 0.4);
}

.doc-type-selected-success {
  background-color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1.5px solid rgba(16, 185, 129, 0.4);
}

.bg-slate-50 {
  background-color: #f8fafc !important;
}

.text-slate-700 {
  color: #334155 !important;
}

.text-slate-800 {
  color: #1e293b !important;
}

.text-slate-900 {
  color: #0f172a !important;
}

.shimmer-line {
  height: 12px;
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
