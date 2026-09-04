<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useDropZone, useFileDialog, useObjectUrl } from '@vueuse/core'
import { useRouter } from 'vue-router'
import ProductExistenceCheckDialog from '@/components/inventory/product/ProductExistenceCheckDialog.vue'
import { compressImage } from '@/utils/imageCompressor'

const dropZoneRef = ref()
const fileData = ref([])
const { open, reset, onChange } = useFileDialog({ accept: 'image/*', multiple: false })
const router = useRouter()

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

    if (list.length === 0) {
      // 0 coincidencias: código libre, no alerta, no diálogo
      skuExistsAlert.value = null
    } else if (list.length === 1) {
      // Exactamente 1 coincidencia: solo VAlert en pantalla (NO VDialog)
      const exactMatch = list[0]
      skuExistsAlert.value = {
        type: 'error',
        title: `¡Atención! El SKU "${query}" ya está registrado`,
        text: `Corresponde al producto: "${exactMatch.description}" (Stock: ${exactMatch.stock} ${exactMatch.unit?.name || 'UND'} - PVP: $${parseFloat(exactMatch.price_sale || 0).toFixed(2)}).`,
        product: exactMatch,
        count: 1,
      }
    } else {
      // MÁS DE 1 COINCIDENCIA: Se abre el VDialog con los productos
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

    if (list.length === 0) {
      skuExistsAlert.value = null
      showNotification(`✅ SKU "${query}" disponible. No existen coincidencias.`, 'success')
    } else if (list.length === 1) {
      // 1 sola coincidencia: no abre VDialog, muestra VAlert
      const exactMatch = list[0]
      skuExistsAlert.value = {
        type: 'error',
        title: `¡Atención! El SKU "${query}" ya está registrado`,
        text: `Corresponde al producto: "${exactMatch.description}" (Stock: ${exactMatch.stock} ${exactMatch.unit?.name || 'UND'} - PVP: $${parseFloat(exactMatch.price_sale || 0).toFixed(2)}).`,
        product: exactMatch,
        count: 1,
      }
      showNotification(`⚠️ Ya existe 1 producto con este SKU: "${exactMatch.description}"`, 'warning')
    } else {
      // MÁS DE 1 coincidencia: SÍ se abre el VDialog
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

const handleUseProductData = p => {
  if (p) {
    if (p.product_categorie_id) product.value.product_categorie_id = p.product_categorie_id
    if (p.brand) product.value.brand = p.brand
    if (p.unit_id) product.value.unit_id = p.unit_id
    if (p.warehouse_id) product.value.warehouse_id = p.warehouse_id
    if (p.uses) product.value.uses = p.uses
    if (p.code_aux) product.value.code_aux = p.code_aux
    if (p.price_sale) product.value.price_sale = p.price_sale
    if (p.purchase_price) product.value.purchase_price = p.purchase_price
    showNotification('Datos de producto cargados en el formulario', 'info')
  }
}

const createPreview = file => {
  try {
    return URL.createObjectURL(file)
  } catch (e) {
    console.error('Error creating object URL:', e)
    
    return ''
  }
}

const removeImage = index => {
  const item = fileData.value[index]
  if (item && item.url && item.url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(item.url)
    } catch (e) {
      console.error(e)
    }
  }
  fileData.value.splice(index, 1)
  reset()
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

const loader = useLoaderStore()
const isLoading = ref(false)
const { showNotification } = useGlobalToast()
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
  discount: 0.00,
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
const backRoute = ref('/product/list')

const calculateMaxDiscount = () => {
  const purchasePrice = parseFloat(product.value.purchase_price) || 0
  const salePrice = parseFloat(product.value.price_sale) || 0
  const discountPercentage = parseFloat(product.value.discount_percentage) || 0

  product.value.max_discount = ((salePrice - purchasePrice) * discountPercentage / 100).toFixed(2)
}

// Calcular precio dinámico basado en el factor de la unidad seleccionada
const calculatePriceByUnit = () => {
  const selectedUnit = units.value.find(u => u.id === product.value.unit_id)
  if (selectedUnit && selectedUnit.factor && !selectedUnit.is_base) {
    // Si el precio base está en unidad base, multiplicar por el factor
    const basePrice = parseFloat(product.value.price_sale) || 0
    if (basePrice > 0) {
      product.value.price_sale = (basePrice * selectedUnit.factor).toFixed(2)
    }
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

watch(() => product.value.discount_percentage, () => {
  if (product.value.discount_percentage > 0) {
    calculateMaxDiscount()
  } else {
    product.value.max_discount = 0
  }
})

// Watcher para recalcular precio cuando cambia la unidad
watch(() => product.value.unit_id, () => {
  calculatePriceByUnit()
})

watch(() => product.value.item_type, newVal => {
  if (newVal === '2') {
    const categoryServicio = categories.value.find(c =>
      c.title && (c.title.toUpperCase() === 'SERVICIO DE TALLER' || c.title.toUpperCase() === 'SERVICIOS DE TALLER'),
    )

    if (categoryServicio) {
      product.value.product_categorie_id = categoryServicio.id
    } else if (categories.value.length > 0) {
      // Fallback
      product.value.product_categorie_id = categories.value[0].id
    }

    product.value.warehouse_id = 1

    // Asignar primera unidad si no hay ninguna
    if (!product.value.unit_id && units.value.length > 0) {
      product.value.unit_id = units.value[0].id
    }
  }
})

onMounted(() => {
  loadInitialData()
})

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
  { label: 'Producto', value: '1', name: 'product' },
  { label: 'Servicio', value: '2', name: 'service' },
  { label: 'Herramienta', value: '3', name: 'tool' },
])

const state = ref(1)

const store = async () => {
  error_exist.value = null
  warning.value = null
  loader.start()

  if (formRef.value && typeof formRef.value.validate === 'function') {
    const valid = await formRef.value.validate()
    if (!valid.valid) {
      loader.stop()
      warning.value = 'Por favor, completa todos los campos obligatorios'

      return
    }
  }

  if (product.value.item_type !== '2') {
    const minStock = parseFloat(product.value.min_stock) || 0
    const maxStock = parseFloat(product.value.max_stock) || 0
    if (maxStock > 0 && minStock > maxStock) {
      loader.stop()
      warning.value = 'El stock mínimo no puede ser mayor que el stock máximo.'
      showNotification('Error en los valores de stock', 'warning')

      return
    }
  }

  const activeUserId = JSON.parse(localStorage.getItem('user'))?.id
  if (!activeUserId) {
    loader.stop()
    warning.value = 'No se ha podido identificar al usuario activo. Por favor, recarga la página o inicia sesión nuevamente.'
    showNotification('Error de sesión', 'error')

    return
  }

  const isService = product.value.item_type === '2'

  const payload = {
    description: product.value.description.toUpperCase().trim(),
    sku: product.value.sku ? product.value.sku.toUpperCase().trim() : '',
    code_aux: product.value.code_aux.toUpperCase().trim(),
    uses: product.value.uses,
    product_categorie_id: product.value.product_categorie_id || null,
    warehouse_id: product.value.warehouse_id || 1,
    unit_id: product.value.unit_id || 1,
    supplier_id: product.value.supplier_id || 1,
    price: parseFloat(product.value.price_sale) || 0,
    price_sale: parseFloat(product.value.price_sale) || 0,
    purchase_price: isService ? 0 : (parseFloat(product.value.purchase_price) || 0),
    tax_rate: parseFloat(product.value.tax_rate) || 0,
    max_discount: parseFloat(product.value.max_discount) || 0,
    discount_percentage: parseFloat(product.value.discount_percentage) || 0,
    discount: parseFloat(product.value.discount) || 0,
    brand: product.value.brand.toUpperCase().trim(),
    stock: isService ? 0 : (parseFloat(product.value.stock) || 0),
    item_type: parseInt(product.value.item_type) || 1,
    min_stock: isService ? 0 : (parseFloat(product.value.min_stock) || 0),
    max_stock: isService ? 0 : (parseFloat(product.value.max_stock) || 0),
    is_taxable: product.value.is_taxable ? "1" : "2",
    is_gift: product.value.is_gift ? "1" : "2",
    notes: product.value.notes.trim(),
    state: state.value,
    user_id: activeUserId,
    imagen: fileData.value.length > 0 ? fileData.value[0].file : null,
  }

  const formData = new FormData()
  for (const key in payload) {
    if (payload[key] !== null && payload[key] !== undefined)
      formData.append(key, payload[key])
  }

  try {
    const resp = await $api("products", {
      method: "POST",
      body: formData,
      onResponseError({ response }) {
        error_exist.value = response._data.error
      },
    })

    showNotification('Producto creado exitosamente', 'success')
    setTimeout(() => {
      onFormReset()
    }, 1000)
  } catch (error) {
    showNotification('Error al crear producto', 'error')
  } finally {
    loader.stop()
    isLoading.value = false
  }
}

const onFormReset = () => {
  product.value = {
    id: null, description: '', sku: '', imagen: null, code_aux: '', uses: '',
    product_categorie_id: null, warehouse_id: null, unit_id: null, supplier_id: null,
    categorie: null, warehouse: null, unit: null, supplier: null,
    price: 0, price_sale: 0, purchase_price: 0, tax_rate: IVA_RATE, max_discount: 0,
    discount_percentage: 0, discount: 0, brand: '', stock: 0, item_type: null, min_stock: 0, max_stock: 0,
    is_taxable: true, is_gift: false, notes: '', state: 1, user_id: null,
  }
  priceSaleWithIva.value = 0
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
  reset()
  warning.value = null
  error_exist.value = null
}

const loadInitialData = async () => {
  product.value.user = JSON.parse(localStorage.getItem('user')) || null
  isLoading.value = true
  try {
    const resp = await $api(`products/config`, {
      method: "GET",
      onResponseError({ response }) {
        showNotification('Error al cargar configuración de productos', 'error')
      },
    })

    units.value = resp.data.units || []
    categories.value = resp.data.categories || []
    warehouses.value = resp.data.warehouses || []
    suppliers.value = resp.data.suppliers || []
    brandOptions.value = resp.data.brands || []
  } catch (error) {
    showNotification('Error al cargar configuración de productos', 'error')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="pa-4 pa-sm-6 position-relative">
    <VProgressLinear
      v-if="isLoading"
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
              icon="ri-price-tag-3-line"
              size="28"
            />
          </VAvatar>
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">
              Crear Producto
            </h1>
            <span class="text-body-2 text-medium-emphasis">Completa la información para registrar un nuevo producto en
              el catálogo</span>
          </div>
        </div>
      </div>

      <!-- Form Skeleton Loader -->
      <div
        v-if="isLoading"
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
        @submit.prevent="store"
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
                        v-if="skuExistsAlert.product"
                        size="small"
                        variant="tonal"
                        color="secondary"
                        class="text-none font-weight-medium"
                        @click="handleUseProductData(skuExistsAlert.product)"
                      >
                        Usar Datos
                      </VBtn>
                      <VBtn
                        v-if="skuExistsAlert.product"
                        size="small"
                        variant="elevated"
                        :color="skuExistsAlert.type"
                        class="text-none font-weight-bold"
                        @click="router.push('/product/edit/' + skuExistsAlert.product.id)"
                      >
                        Editar Producto
                      </VBtn>
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
                    </div>
                  </div>
                </VAlert>
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="product.sku"
                  :rules="skuRules"
                  label="SKU *"
                  placeholder="Ej. LAP-001"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-barcode-line"
                  hide-details="auto"
                  required
                  :loading="isCheckingSkuOnBlur"
                  @blur="handleSkuBlur"
                  @update:model-value="skuExistsAlert = null"
                >
                  <!-- Lupa para verificar SKU -->
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
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="product.description"
                  :rules="descriptionRules"
                  label="Descripción del Producto *"
                  placeholder="Ej. AMORTIGUADOR CHEV. AVEO RH"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-price-tag-3-line"
                  hide-details="auto"
                  required
                >
                  <!-- Lupa para verificar Nombre / Descripción -->
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
                v-if="product.item_type !== '2'"
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
                  placeholder="Ej. VEHÍCULO LIVIANO"
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
            v-if="product.item_type !== '2'"
            class="my-8"
          />

          <!-- 2. Clasificación -->
          <div
            v-if="product.item_type !== '2'"
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
                  :loading="isLoading"
                />
              </VCol>
              <VCol
                v-if="product.item_type !== '2'"
                cols="12"
                sm="6"
              >
                <VSelect
                  v-model="product.warehouse_id"
                  :items="warehouses"
                  item-title="name"
                  item-value="id"
                  :rules="product.item_type === '2' ? [] : [requiredRule]"
                  density="comfortable"
                  variant="outlined"
                  label="Almacén"
                  placeholder="Selecciona"
                  prepend-inner-icon="ri-home-4-line"
                  hide-details="auto"
                  required
                  :loading="isLoading"
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
                  :loading="isLoading"
                >
                  <template #item="{ item, props }">
                    <VListItem v-bind="props">
                      <template #prepend>
                        <VAvatar
                          size="24"
                          color="primary"
                          variant="tonal"
                        >
                          <span class="text-caption font-weight-bold">{{ item.raw.code }}</span>
                        </VAvatar>
                      </template>
                      <VListItemSubtitle />
                    </VListItem>
                  </template>
                </VSelect>
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
                  :loading="isLoading"
                />
              </VCol>
            </VRow>
          </div>

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
                :md="product.item_type === '2' ? '12' : '6'"
              >
                <VCard
                  variant="outlined"
                  class="pa-4 h-100 rounded-lg"
                >
                  <div class="text-subtitle-1 font-weight-bold mb-4 d-flex align-center justify-space-between">
                    <span>Configuración de Precios e IVA</span>
                    <VChip
                      size="small"
                      color="primary"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      IVA {{ product.tax_rate || 15 }}%
                    </VChip>
                  </div>
                  <VRow>
                    <!-- Precios de Compra / Costo (Solo productos físicos) -->
                    <template v-if="product.item_type !== '2'">
                      <VCol
                        cols="12"
                        sm="6"
                      >
                        <VTextField
                          v-model="purchasePriceWithIva"
                          :rules="priceRules"
                          label="Precio Compra (Con IVA)"
                          placeholder="0.00"
                          variant="outlined"
                          density="comfortable"
                          prepend-inner-icon="ri-shopping-cart-fill"
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
                          v-model="product.purchase_price"
                          :rules="priceRules"
                          label="Precio Compra Base (Sin IVA)"
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
                    </template>

                    <!-- Precios de Venta / PVP -->
                    <VCol
                      cols="12"
                      :sm="product.item_type === '2' ? '12' : '6'"
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
                      :sm="product.item_type === '2' ? '12' : '6'"
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

                    <!-- Desglose Informativo de Precios (Sin IVA vs Con IVA) -->
                    <VCol cols="12">
                      <div
                        class="pa-3 rounded-lg d-flex flex-wrap justify-space-between align-center gap-2"
                        style="background-color: rgba(var(--v-theme-on-surface), 0.04); border: 1px solid rgba(var(--v-theme-on-surface), 0.08);"
                      >
                        <div
                          v-if="product.item_type !== '2'"
                          class="d-flex flex-column"
                        >
                          <span class="text-caption text-medium-emphasis font-weight-medium">Costo de Compra:</span>
                          <span class="text-body-2 font-weight-bold">
                            Sin IVA: ${{ (Number(product.purchase_price) || 0).toFixed(2) }}
                            <span class="text-medium-emphasis mx-1">|</span>
                            <span class="text-primary font-weight-black">Con IVA: ${{ (Number(purchasePriceWithIva) || 0).toFixed(2) }}</span>
                          </span>
                        </div>
                        <div class="d-flex flex-column">
                          <span class="text-caption text-medium-emphasis font-weight-medium">PVP de Venta:</span>
                          <span class="text-body-2 font-weight-bold">
                            Sin IVA: ${{ (Number(product.price_sale) || 0).toFixed(2) }}
                            <span class="text-medium-emphasis mx-1">|</span>
                            <span class="text-success font-weight-black">Con IVA: ${{ (Number(priceSaleWithIva) || 0).toFixed(2) }}</span>
                          </span>
                        </div>
                        <div
                          v-if="product.item_type !== '2' && Number(product.price_sale) > 0 && Number(product.purchase_price) > 0"
                          class="d-flex flex-column text-right"
                        >
                          <span class="text-caption text-medium-emphasis font-weight-medium">Margen Estimado:</span>
                          <span class="text-body-2 font-weight-bold text-info">
                            ${{ (Number(product.price_sale) - Number(product.purchase_price)).toFixed(2) }} ({{ (((Number(product.price_sale) - Number(product.purchase_price)) / Number(product.purchase_price)) * 100).toFixed(1) }}%)
                          </span>
                        </div>
                      </div>
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
                v-if="product.item_type !== '2'"
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
                        label="Stock Inicial Actual"
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
                      Subir Imagen Principal
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
                          {{ item.file.name }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {{ (item.file.size / 1024).toFixed(2) }} KB
                        </div>
                      </VCardText>
                      <VCardActions class="pa-4 pt-0">
                        <VBtn
                          variant="tonal"
                          block
                          color="error"
                          @click.stop="removeImage(index)"
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
                      v-model="product.is_taxable"
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
                      v-model="product.is_gift"
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

        <VDivider />

        <!-- Sticky Footer -->
        <div class="pa-4 bg-surface sticky-bottom d-flex flex-column flex-md-row justify-space-between align-center gap-4">
          <div class="d-flex flex-column gap-2 w-100 w-sm-auto flex-grow-1">
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
              {{
                error_exist }}
            </VAlert>
          </div>
          <div class="d-flex gap-3 w-100 w-sm-auto justify-end">
            <VBtn
              variant="outlined"
              prepend-icon="ri-close-line"
              :disabled="isLoading"
              @click="router.push(backRoute)"
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
              Crear Producto
            </VBtn>
          </div>
        </div>
      </VForm>
    </VCard>

    <!-- Diálogo de Verificación de Existencia de Producto -->
    <ProductExistenceCheckDialog
      v-model="isCheckDialogVisible"
      :initial-query="checkInitialQuery"
      :search-field="checkSearchField"
      @use-data="handleUseProductData"
    />
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
