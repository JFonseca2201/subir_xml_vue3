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

    if (!product.value.warehouse_id && warehouses.value.length > 0) {
      product.value.warehouse_id = warehouses.value[0].id
    }
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
              icon="ri-box-3-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Crear Nuevo Producto
              </h1>
              <VChip
                color="primary"
                size="small"
                variant="tonal"
                class="font-weight-bold"
                prepend-icon="ri-store-2-line"
              >
                Catálogo & Inventario
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Registra un nuevo producto, servicio o herramienta en el catálogo del sistema
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-arrow-left-line"
            class="font-weight-medium"
            :disabled="isLoading || loader.loading"
            @click="router.push(backRoute)"
          >
            Volver al Listado
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Form Skeleton loader -->
    <div
      v-if="isLoading"
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
      @submit.prevent="store"
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
                  :class="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'doc-type-selected-primary' : 'doc-type-unselected'"
                  @click="product.item_type = '1'"
                >
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      :color="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'primary' : 'grey-lighten-3'"
                      :variant="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'flat' : 'tonal'"
                      size="40"
                      class="transition-all"
                    >
                      <VIcon
                        icon="ri-box-3-line"
                        size="22"
                        :color="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'white' : 'grey-darken-1'"
                      />
                    </VAvatar>
                    <div>
                      <div
                        class="text-body-2 font-weight-bold"
                        :class="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'text-primary' : 'text-grey-darken-3'"
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
                      :color="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'primary' : 'grey'"
                      :variant="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'tonal' : 'outlined'"
                      class="font-weight-bold"
                    >
                      Físico
                    </VChip>
                    <VIcon
                      :icon="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                      size="20"
                      :color="product.item_type === '1' || product.item_type === 1 || !product.item_type ? 'primary' : 'grey-lighten-1'"
                    />
                  </div>
                </div>

                <!-- Opción Servicio -->
                <div
                  class="doc-type-united-item rounded-lg pa-3 px-4 cursor-pointer d-flex align-center justify-space-between"
                  :class="product.item_type === '2' || product.item_type === 2 ? 'doc-type-selected-success' : 'doc-type-unselected'"
                  @click="product.item_type = '2'"
                >
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      :color="product.item_type === '2' || product.item_type === 2 ? 'success' : 'grey-lighten-3'"
                      :variant="product.item_type === '2' || product.item_type === 2 ? 'flat' : 'tonal'"
                      size="40"
                      class="transition-all"
                    >
                      <VIcon
                        icon="ri-tools-line"
                        size="22"
                        :color="product.item_type === '2' || product.item_type === 2 ? 'white' : 'grey-darken-1'"
                      />
                    </VAvatar>
                    <div>
                      <div
                        class="text-body-2 font-weight-bold"
                        :class="product.item_type === '2' || product.item_type === 2 ? 'text-success' : 'text-grey-darken-3'"
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
                      :color="product.item_type === '2' || product.item_type === 2 ? 'success' : 'grey'"
                      :variant="product.item_type === '2' || product.item_type === 2 ? 'tonal' : 'outlined'"
                      class="font-weight-bold"
                    >
                      Servicio
                    </VChip>
                    <VIcon
                      :icon="product.item_type === '2' || product.item_type === 2 ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                      size="20"
                      :color="product.item_type === '2' || product.item_type === 2 ? 'success' : 'grey-lighten-1'"
                    />
                  </div>
                </div>

                <!-- Opción Herramienta -->
                <div
                  class="doc-type-united-item rounded-lg pa-3 px-4 cursor-pointer d-flex align-center justify-space-between"
                  :class="product.item_type === '3' || product.item_type === 3 ? 'doc-type-selected-primary' : 'doc-type-unselected'"
                  @click="product.item_type = '3'"
                >
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      :color="product.item_type === '3' || product.item_type === 3 ? 'warning' : 'grey-lighten-3'"
                      :variant="product.item_type === '3' || product.item_type === 3 ? 'flat' : 'tonal'"
                      size="40"
                      class="transition-all"
                    >
                      <VIcon
                        icon="ri-hammer-line"
                        size="22"
                        :color="product.item_type === '3' || product.item_type === 3 ? 'white' : 'grey-darken-1'"
                      />
                    </VAvatar>
                    <div>
                      <div
                        class="text-body-2 font-weight-bold"
                        :class="product.item_type === '3' || product.item_type === 3 ? 'text-warning' : 'text-grey-darken-3'"
                      >
                        Herramienta
                      </div>
                      <div
                        class="text-caption text-medium-emphasis"
                        style="font-size: 0.75rem;"
                      >
                        Equipo y uso de taller
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <VChip
                      size="x-small"
                      :color="product.item_type === '3' || product.item_type === 3 ? 'warning' : 'grey'"
                      :variant="product.item_type === '3' || product.item_type === 3 ? 'tonal' : 'outlined'"
                      class="font-weight-bold"
                    >
                      Herramienta
                    </VChip>
                    <VIcon
                      :icon="product.item_type === '3' || product.item_type === 3 ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                      size="20"
                      :color="product.item_type === '3' || product.item_type === 3 ? 'warning' : 'grey-lighten-1'"
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
                  v-if="product.item_type !== '2'"
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
                  :sm="product.item_type !== '2' ? 6 : 12"
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

          <!-- Tarjeta 3: Clasificación y Ubicación en Bodega (Solo productos físicos y herramientas) -->
          <VCard
            v-if="product.item_type !== '2'"
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
                    :loading="isLoading"
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
                    :rules="product.item_type === '2' ? [] : [requiredRule]"
                    density="comfortable"
                    variant="outlined"
                    label="Almacén / Bodega *"
                    placeholder="Selecciona almacén"
                    prepend-inner-icon="ri-home-4-line"
                    hide-details="auto"
                    required
                    color="primary"
                    :loading="isLoading"
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
                    :loading="isLoading"
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
                    :loading="isLoading"
                  />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Tarjeta 4: Control de Stock e Inventario (Solo productos físicos y herramientas) -->
          <VCard
            v-if="product.item_type !== '2'"
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
                    label="Stock Inicial Actual *"
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
                          {{ item.file.name }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {{ (item.file.size / 1024).toFixed(2) }} KB
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
                          @click.stop="removeImage(index)"
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
                      v-model="product.is_taxable"
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
                      v-model="product.is_gift"
                      hide-details
                      density="compact"
                      color="info"
                    />
                  </div>
                </div>

                <!-- Precios de Compra (Solo productos físicos) -->
                <template v-if="product.item_type !== '2'">
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
                    v-if="product.item_type !== '2'"
                    class="d-flex justify-space-between align-center mb-1 text-caption"
                  >
                    <span class="text-medium-emphasis">Costo Compra:</span>
                    <span class="font-mono font-weight-semibold text-slate-700">${{ (Number(purchasePriceWithIva) || 0).toFixed(2) }}</span>
                  </div>
                  <VDivider
                    v-if="product.item_type !== '2'"
                    class="my-2"
                  />
                  <div
                    v-if="product.item_type !== '2' && Number(product.price_sale) > 0 && Number(product.purchase_price) > 0"
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
                    :disabled="isLoading || loader.loading"
                    @click="router.push(backRoute)"
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
                    :disabled="loader.loading || isLoading"
                  >
                    CREAR PRODUCTO
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
      @use-data="handleUseProductData"
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
