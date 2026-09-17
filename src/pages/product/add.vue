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
        title: `¡Atención! El COD "${query}" ya está registrado`,
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
  const salePrice = parseFloat(product.value.price_sale) || 0
  const discountPercentage = parseFloat(product.value.discount_percentage) || 0

  if (salePrice > 0 && discountPercentage > 0) {
    product.value.max_discount = parseFloat(((salePrice * discountPercentage) / 100).toFixed(2))
  }
}

const onDiscountPercentageInput = val => {
  const pct = parseFloat(val) || 0
  const salePrice = parseFloat(product.value.price_sale) || 0
  if (salePrice > 0 && pct > 0) {
    product.value.max_discount = parseFloat(((salePrice * pct) / 100).toFixed(2))
  } else if (pct === 0) {
    product.value.max_discount = 0
  }
}

const onMaxDiscountInput = val => {
  const amount = parseFloat(val) || 0
  const salePrice = parseFloat(product.value.price_sale) || 0
  if (salePrice > 0 && amount > 0) {
    product.value.discount_percentage = parseFloat(((amount / salePrice) * 100).toFixed(1))
  } else if (amount === 0) {
    product.value.discount_percentage = 0
  }
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
    let errorMessageHandled = false
    const resp = await $api("products", {
      method: "POST",
      body: formData,
      onResponseError({ response }) {
        const errorData = response?._data || {}
        let msg = errorData.message || errorData.message_text || errorData.error
        if (errorData.errors && typeof errorData.errors === 'object') {
          const firstKey = Object.keys(errorData.errors)[0]
          if (firstKey && Array.isArray(errorData.errors[firstKey]) && errorData.errors[firstKey].length > 0) {
            msg = errorData.errors[firstKey][0]
          }
        }
        const finalMsg = msg || 'Error al crear el producto'
        error_exist.value = finalMsg
        showNotification(finalMsg, 'error')
        errorMessageHandled = true
      },
    })

    if (resp?.status === 200 || resp?.product) {
      showNotification('Producto creado exitosamente', 'success')
      setTimeout(() => {
        onFormReset()
      }, 1000)
    } else if (!errorMessageHandled && (resp?.message_text || resp?.message)) {
      const finalMsg = resp.message_text || resp.message
      showNotification(finalMsg, 'warning')
      error_exist.value = finalMsg
    }
  } catch (error) {
    if (!error_exist.value) {
      const msg = error?.data?.message || error?.message || 'Error al crear producto'
      showNotification(msg, 'error')
      error_exist.value = msg
    }
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
    <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 10;" />

    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="44" class="elevation-1">
            <VIcon icon="ri-box-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Crear Nuevo Producto
              </h1>
              <VChip color="primary" size="small" variant="tonal" class="font-weight-bold"
                prepend-icon="ri-store-2-line">
                Catálogo & Inventario
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Registra un nuevo producto, servicio o herramienta en el catálogo del sistema
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-arrow-left-line" class="font-weight-medium"
            :disabled="isLoading || loader.loading" @click="router.push(backRoute)">
            Volver al Listado
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Form Skeleton loader -->
    <div v-if="isLoading" class="d-flex flex-column gap-6">
      <VRow>
        <VCol cols="12" lg="8">
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div class="shimmer-line w-40 mb-6" style="height: 24px;" />
            <VRow class="mb-4">
              <VCol cols="12" sm="6">
                <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
              </VCol>
              <VCol cols="12" sm="6">
                <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
              </VCol>
            </VRow>
            <div class="shimmer-line w-100 mb-4" style="height: 80px; border-radius: 8px;" />
            <div class="shimmer-line w-100" style="height: 120px; border-radius: 8px;" />
          </VCard>
        </VCol>
        <VCol cols="12" lg="4">
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div class="shimmer-line w-60 mb-6" style="height: 24px;" />
            <div class="shimmer-line w-100 mb-4" style="height: 48px; border-radius: 8px;" />
            <div class="shimmer-line w-100 mb-4" style="height: 48px; border-radius: 8px;" />
            <div class="shimmer-line w-100" style="height: 48px; border-radius: 8px;" />
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- Formulario Principal -->
    <VForm v-else ref="formRef" @submit.prevent="store">
      <VRow>
        <!-- Columna Izquierda (8 cols): Tipo, Info Básica, Clasificación, Stock, Notas -->
        <VCol cols="12" lg="8">
          <!-- Tarjeta 1: Tipo de Ítem -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                    <VIcon icon="ri-shapes-line" size="20" />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                      Tipo de Ítem
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Selecciona la naturaleza del registro en el catálogo
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 bg-white">
              <div class="d-flex flex-wrap gap-3">
                <!-- Opción 1: Producto Físico -->
                <div
                  class="cursor-pointer d-flex align-center justify-space-between pa-3 px-4 rounded-lg border flex-grow-1 transition-all"
                  :class="(product.item_type === '1' || product.item_type === 1 || !product.item_type) ? 'border-primary bg-slate-50 text-primary' : 'border-light bg-white text-slate-700'"
                  style="min-width: 180px;" @click="product.item_type = '1'">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-box-3-line" size="20"
                      :color="(product.item_type === '1' || product.item_type === 1 || !product.item_type) ? 'primary' : 'grey-darken-1'" />
                    <span class="font-weight-semibold text-body-2">Producto Físico</span>
                  </div>
                  <VIcon
                    :icon="(product.item_type === '1' || product.item_type === 1 || !product.item_type) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                    size="20"
                    :color="(product.item_type === '1' || product.item_type === 1 || !product.item_type) ? 'primary' : 'grey-lighten-1'" />
                </div>

                <!-- Opción 2: Servicio Técnico -->
                <div
                  class="cursor-pointer d-flex align-center justify-space-between pa-3 px-4 rounded-lg border flex-grow-1 transition-all"
                  :class="(product.item_type === '2' || product.item_type === 2) ? 'border-success bg-slate-50 text-success' : 'border-light bg-white text-slate-700'"
                  style="min-width: 180px;" @click="product.item_type = '2'">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-tools-line" size="20"
                      :color="(product.item_type === '2' || product.item_type === 2) ? 'success' : 'grey-darken-1'" />
                    <span class="font-weight-semibold text-body-2">Servicio Técnico</span>
                  </div>
                  <VIcon
                    :icon="(product.item_type === '2' || product.item_type === 2) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                    size="20"
                    :color="(product.item_type === '2' || product.item_type === 2) ? 'success' : 'grey-lighten-1'" />
                </div>

                <!-- Opción 3: Herramienta -->
                <div
                  class="cursor-pointer d-flex align-center justify-space-between pa-3 px-4 rounded-lg border flex-grow-1 transition-all"
                  :class="(product.item_type === '3' || product.item_type === 3) ? 'border-warning bg-slate-50 text-warning' : 'border-light bg-white text-slate-700'"
                  style="min-width: 180px;" @click="product.item_type = '3'">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-hammer-line" size="20"
                      :color="(product.item_type === '3' || product.item_type === 3) ? 'warning' : 'grey-darken-1'" />
                    <span class="font-weight-semibold text-body-2">Herramienta</span>
                  </div>
                  <VIcon
                    :icon="(product.item_type === '3' || product.item_type === 3) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                    size="20"
                    :color="(product.item_type === '3' || product.item_type === 3) ? 'warning' : 'grey-lighten-1'" />
                </div>
              </div>

              <!-- Pie de la tarjeta: Texto descriptivo dinámico y sobrio -->
              <div class="d-flex align-center gap-1.5 pt-3 mt-3 border-t text-caption text-medium-emphasis">
                <VIcon icon="ri-information-line" size="16" class="text-primary" />
                <span v-if="product.item_type === '2' || product.item_type === 2">
                  <strong>Servicio Técnico:</strong> Mano de obra o servicios intangibles sin control de stock físico ni
                  costo de
                  compra.
                </span>
                <span v-else-if="product.item_type === '3' || product.item_type === 3">
                  <strong>Herramienta:</strong> Equipos y herramientas asignadas para uso interno del taller.
                </span>
                <span v-else>
                  <strong>Producto Físico:</strong> Mercadería con control de stock, bodegas y costos de inventario.
                </span>
              </div>
            </VCardText>
          </VCard>

          <!-- Tarjeta 2: Información Principal y Códigos + Imagen -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VRow no-gutters class="align-stretch">
              <!-- Sub-sección Izquierda: Información Principal y Códigos -->
              <VCol cols="12" md="8" sm="7" class="d-flex flex-column bg-white">
                <VCardItem class="bg-white py-3 px-4 border-b">
                  <template #title>
                    <div class="d-flex align-center gap-3">
                      <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                        <VIcon icon="ri-information-line" size="20" />
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

                <VCardText class="pa-4 pa-sm-5 bg-white flex-grow-1">
                  <!-- Alerta si el SKU ya existe al abandonar el campo -->
                  <VAlert v-if="skuExistsAlert" :type="skuExistsAlert.type || 'error'" variant="tonal" density="comfortable"
                    closable class="rounded-lg mb-4" @click:close="skuExistsAlert = null">
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
                        <VBtn v-if="skuExistsAlert.product" size="small" variant="tonal" color="secondary"
                          class="text-none font-weight-medium" @click="handleUseProductData(skuExistsAlert.product)">
                          Usar Datos
                        </VBtn>
                        <VBtn v-if="skuExistsAlert.product" size="small" variant="elevated" :color="skuExistsAlert.type"
                          class="text-none font-weight-bold"
                          @click="router.push('/product/edit/' + skuExistsAlert.product.id)">
                          Editar Producto
                        </VBtn>
                        <VBtn v-if="skuExistsAlert.count > 1" size="small" variant="tonal" :color="skuExistsAlert.type"
                          class="text-none font-weight-medium" @click="openCheckDialog(product.sku, 'sku')">
                          Ver {{ skuExistsAlert.count }} Coincidencias
                        </VBtn>
                      </div>
                    </div>
                  </VAlert>

                  <VRow dense>
                    <!-- SKU / Código Principal -->
                    <VCol cols="12" sm="6">
                      <VTextField v-model="product.sku" :rules="skuRules" label="SKU / Código Principal *"
                        placeholder="Ej. LAP-001 / SRV-001" variant="outlined" density="comfortable"
                        prepend-inner-icon="ri-barcode-line" hide-details="auto" required color="primary"
                        :loading="isCheckingSkuOnBlur" @blur="handleSkuBlur" @update:model-value="skuExistsAlert = null">
                        <template #append-inner>
                          <VTooltip text="Buscar coincidencias de este SKU" location="top">
                            <template #activator="{ props: tooltipProps }">
                              <VBtn v-bind="tooltipProps" icon="ri-search-line" variant="text" color="primary"
                                density="compact" size="small" class="me-n1" @click.stop="handleSkuSearchClick" />
                            </template>
                          </VTooltip>
                        </template>
                      </VTextField>
                    </VCol>

                    <!-- Código Auxiliar -->
                    <VCol cols="12" sm="6" class="mt-2 mt-sm-0">
                      <VTextField v-model="product.code_aux" :rules="codeAuxRules" label="Código Auxiliar / Alternativo"
                        placeholder="Ej. PROD-001 / REF-2024" variant="outlined" density="comfortable"
                        prepend-inner-icon="ri-code-line" hide-details="auto" color="primary" />
                    </VCol>

                    <!-- Descripción del Producto -->
                    <VCol cols="12" class="mt-2">
                      <VTextField v-model="product.description" :rules="descriptionRules"
                        label="Descripción / Nombre del Producto *"
                        placeholder="Ej. AMORTIGUADOR DELANTERO CHEVROLET AVEO RH" variant="outlined" density="comfortable"
                        prepend-inner-icon="ri-price-tag-3-line" hide-details="auto" required color="primary">
                        <template #append-inner>
                          <VTooltip text="Buscar coincidencias de este Nombre" location="top">
                            <template #activator="{ props: tooltipProps }">
                              <VBtn v-bind="tooltipProps" icon="ri-search-line" variant="text" color="primary"
                                density="compact" size="small" class="me-n1"
                                @click.stop="openCheckDialog(product.description, 'description')" />
                            </template>
                          </VTooltip>
                        </template>
                      </VTextField>
                    </VCol>

                    <!-- Marca -->
                    <VCol v-if="product.item_type !== '2'" cols="12" sm="6" class="mt-2">
                      <VCombobox v-model="product.brand" :items="brandOptions" :rules="brandRules" label="Marca"
                        placeholder="Selecciona o escribe marca" variant="outlined" density="comfortable"
                        prepend-inner-icon="ri-building-line" hide-details="auto" clearable color="primary" />
                    </VCol>

                    <!-- Usos / Aplicaciones -->
                    <VCol cols="12" :sm="product.item_type !== '2' ? 6 : 12" class="mt-2">
                      <VTextField v-model="product.uses" label="Usos / Aplicaciones"
                        placeholder="Ej. VEHÍCULO LIVIANO" variant="outlined" density="comfortable"
                        prepend-inner-icon="ri-tools-line" hide-details="auto" color="primary" />
                    </VCol>
                  </VRow>
                </VCardText>
              </VCol>

              <!-- Sub-sección Derecha: Imagen del Producto (Separada con línea divisoria vertical) -->
              <VCol cols="12" md="4" sm="5" class="border-s bg-slate-50 d-flex flex-column pa-4 pa-sm-5 justify-center">
                <div class="d-flex align-center justify-space-between mb-3">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-image-line" size="18" class="text-slate-600" />
                    <span class="text-caption font-weight-bold text-slate-700 text-uppercase" style="letter-spacing: 0.5px;">
                      Imagen del Producto
                    </span>
                  </div>
                  <span v-if="fileData.length > 0" class="text-caption text-success font-weight-medium">
                    Cargada
                  </span>
                </div>

                <div ref="dropZoneRef" class="cursor-pointer flex-grow-1 d-flex flex-column justify-center" @click="() => open()">
                  <div v-if="fileData.length === 0"
                    class="d-flex flex-column justify-center align-center gap-2 pa-4 border border-dashed rounded-lg bg-white text-center transition-swing h-100"
                    style="min-height: 190px;">
                    <VAvatar size="40" color="primary" variant="tonal" class="rounded-circle">
                      <VIcon icon="ri-upload-cloud-2-line" size="22" />
                    </VAvatar>
                    <div>
                      <div class="text-caption font-weight-semibold text-slate-800">
                        Subir o arrastrar imagen
                      </div>
                      <div class="text-caption text-medium-emphasis" style="font-size: 0.75rem;">
                        PNG, JPG o WEBP
                      </div>
                    </div>
                  </div>
                  <div v-else class="pa-2 border rounded-lg bg-white text-center h-100 d-flex flex-column justify-center">
                    <div v-for="(item, index) in fileData" :key="index">
                      <VImg :src="item.url" height="135px" class="rounded-lg mb-2 mx-auto bg-slate-50 border" contain />
                      <div class="text-caption font-weight-semibold text-truncate mb-2 text-slate-800" :title="item.file?.name">
                        {{ item.file.name }}
                      </div>
                      <VBtn variant="tonal" block size="x-small" color="error" prepend-icon="ri-delete-bin-line"
                        class="font-weight-medium" @click.stop="removeImage(index)">
                        Eliminar Imagen
                      </VBtn>
                    </div>
                  </div>
                </div>
              </VCol>
            </VRow>
          </VCard>

          <!-- Tarjeta 3: Control de Stock e Inventario (Solo productos físicos y herramientas) -->
          <VCard v-if="product.item_type !== '2'" class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar size="36" color="info" variant="tonal" class="rounded-lg">
                    <VIcon icon="ri-stack-line" size="20" />
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
                <VCol cols="12" sm="4">
                  <VTextField v-model="product.stock" :rules="stockRules" label="Stock Inicial Actual *" placeholder="0"
                    variant="outlined" density="comfortable" prepend-inner-icon="ri-stack-line" hide-details="auto"
                    type="number" step="0.01" min="0" required color="primary" />
                </VCol>

                <!-- Stock Mínimo -->
                <VCol cols="12" sm="4">
                  <VTextField v-model="product.min_stock" :rules="stockRules" label="Stock Mínimo (Alerta)"
                    placeholder="0" variant="outlined" density="comfortable" prepend-inner-icon="ri-arrow-down-line"
                    hide-details="auto" type="number" step="0.01" min="0" color="warning" />
                </VCol>

                <!-- Stock Máximo -->
                <VCol cols="12" sm="4">
                  <VTextField v-model="product.max_stock" :rules="stockRules" label="Stock Máximo" placeholder="0"
                    variant="outlined" density="comfortable" prepend-inner-icon="ri-arrow-up-line" hide-details="auto"
                    type="number" step="0.01" min="0" color="info" />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Tarjeta 4: Estructura de Precios e Impuestos -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="success" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-price-tag-3-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Precios y Finanzas
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        PVP, costos y política fiscal
                      </p>
                    </div>
                  </div>
                  <div class="status-pill-clean status-primary font-weight-semibold">
                    <span class="status-dot" />
                    <span>IVA {{ product.tax_rate || 15 }}%</span>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white d-flex flex-column gap-4">
              <!-- Opciones Tributarias -->
              <div class="d-flex flex-column gap-2 pa-3 rounded-lg bg-slate-50 border">
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-body-2 font-weight-medium text-slate-800">
                      Graba IVA ({{ product.tax_rate || 15 }}%)
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Aplica tarifa impositiva general
                    </div>
                  </div>
                  <VSwitch v-model="product.is_taxable" hide-details density="compact" color="primary" />
                </div>
                <VDivider class="my-1" />
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="text-body-2 font-weight-medium text-slate-800">
                      Muestra o Regalo
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Sin costo comercial directo
                    </div>
                  </div>
                  <VSwitch v-model="product.is_gift" hide-details density="compact" color="primary" />
                </div>
              </div>

              <!-- Precios de Venta / PVP -->
              <div>
                <div class="text-caption font-weight-bold text-slate-700 text-uppercase mb-2"
                  style="letter-spacing: 0.5px;">
                  Precio de Venta al Público (PVP)
                </div>
                <VRow dense>
                  <VCol cols="12" sm="6">
                    <VTextField v-model="priceSaleWithIva" :rules="priceRules" label="PVP (Con IVA) *"
                      placeholder="0.00" variant="outlined" density="comfortable" prefix="$" hide-details="auto"
                      type="number" step="0.01" min="0" required color="primary" class="font-weight-bold" />
                  </VCol>
                  <VCol cols="12" sm="6">
                    <VTextField v-model="product.price_sale" :rules="priceRules" label="PVP Base (Sin IVA) *"
                      placeholder="0.00" variant="outlined" density="comfortable" prefix="$" hide-details="auto"
                      type="number" step="0.01" min="0" required color="primary" />
                  </VCol>
                </VRow>
              </div>

              <!-- Precios de Compra (Solo productos físicos) -->
              <div v-if="product.item_type !== '2' && product.item_type !== 2">
                <div class="text-caption font-weight-bold text-slate-700 text-uppercase mb-2"
                  style="letter-spacing: 0.5px;">
                  Costo de Adquisición
                </div>
                <VRow dense>
                  <VCol cols="12" sm="6">
                    <VTextField v-model="purchasePriceWithIva" :rules="priceRules" label="Costo (Con IVA)"
                      placeholder="0.00" variant="outlined" density="comfortable" prefix="$" hide-details="auto"
                      type="number" step="0.01" min="0" color="primary" />
                  </VCol>
                  <VCol cols="12" sm="6">
                    <VTextField v-model="product.purchase_price" :rules="priceRules" label="Costo Base (Sin IVA)"
                      placeholder="0.00" variant="outlined" density="comfortable" prefix="$" hide-details="auto"
                      type="number" step="0.01" min="0" color="primary" />
                  </VCol>
                </VRow>
              </div>

              <!-- Descuentos Permitidos -->
              <div>
                <div class="text-caption font-weight-bold text-slate-700 text-uppercase mb-2"
                  style="letter-spacing: 0.5px;">
                  Políticas de Descuento
                </div>
                <VRow dense>
                  <VCol cols="12" sm="6">
                    <VTextField v-model.number="product.discount_percentage" :rules="percentageRules"
                      label="Desc. Máximo (%)" placeholder="0" variant="outlined" density="comfortable" suffix="%"
                      hide-details="auto" type="number" step="0.1" min="0" max="100" color="primary"
                      @update:model-value="onDiscountPercentageInput" />
                  </VCol>
                  <VCol cols="12" sm="6">
                    <VTextField v-model.number="product.max_discount" :rules="discountRules" label="Desc. Máximo ($)"
                      placeholder="0.00" variant="outlined" density="comfortable" prefix="$" hide-details="auto"
                      type="number" step="0.01" min="0" color="primary" @update:model-value="onMaxDiscountInput" />
                  </VCol>
                </VRow>
              </div>

              <!-- Margen Financiero Estimado -->
              <div
                v-if="product.item_type !== '2' && product.item_type !== 2 && Number(product.price_sale) > 0 && Number(product.purchase_price) > 0"
                class="pa-3 rounded-lg border bg-slate-50 d-flex justify-space-between align-center">
                <div>
                  <div class="text-caption text-medium-emphasis">
                    Margen Estimado
                  </div>
                  <div class="text-subtitle-2 font-weight-bold text-success">
                    +${{ (Number(product.price_sale) - Number(product.purchase_price)).toFixed(2) }}
                  </div>
                </div>
                <VChip color="success" variant="tonal" size="small" class="font-weight-bold">
                  {{ (((Number(product.price_sale) - Number(product.purchase_price)) / Number(product.purchase_price))
                    *
                    100).toFixed(1) }}% Rentabilidad
                </VChip>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Derecha (4 cols): Clasificación, Observaciones y Resumen -->
        <VCol cols="12" lg="4">
          <div class="d-flex flex-column gap-4 sticky-sidebar">
            <!-- Tarjeta 1: Clasificación y Ubicación en Bodega -->
            <VCard v-if="product.item_type !== '2'" class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="warning" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-folder-3-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Clasificación y Ubicación
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Categoría, almacén, unidad y proveedor
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>

              <VCardText class="pa-4 bg-white">
                <VRow dense>
                  <!-- Categoría -->
                  <VCol cols="12">
                    <VSelect v-model="product.product_categorie_id" :items="categories" item-title="title"
                      item-value="id" :rules="[requiredRule]" density="comfortable" variant="outlined"
                      label="Categoría *" placeholder="Selecciona categoría" prepend-inner-icon="ri-folder-3-line"
                      hide-details="auto" required color="primary" :loading="isLoading" />
                  </VCol>

                  <!-- Almacén -->
                  <VCol cols="12" class="mt-2">
                    <VSelect v-model="product.warehouse_id" :items="warehouses" item-title="name" item-value="id"
                      :rules="product.item_type === '2' ? [] : [requiredRule]" density="comfortable" variant="outlined"
                      label="Almacén / Bodega *" placeholder="Selecciona almacén" prepend-inner-icon="ri-home-4-line"
                      hide-details="auto" required color="primary" :loading="isLoading" />
                  </VCol>

                  <!-- Unidad de Medida -->
                  <VCol cols="12" class="mt-2">
                    <VSelect v-model="product.unit_id" :items="units" item-title="name" item-value="id"
                      :rules="[requiredRule]" density="comfortable" variant="outlined" label="Unidad de Medida *"
                      placeholder="Selecciona unidad" prepend-inner-icon="ri-ruler-line" hide-details="auto" required
                      color="primary" :loading="isLoading">
                      <template #item="{ item, props }">
                        <VListItem v-bind="props">
                          <template #prepend>
                            <VAvatar size="24" color="primary" variant="tonal" class="me-2">
                              <span class="text-caption font-weight-bold">{{ item.raw.code || 'UND' }}</span>
                            </VAvatar>
                          </template>
                        </VListItem>
                      </template>
                    </VSelect>
                  </VCol>

                  <!-- Proveedor -->
                  <VCol cols="12" class="mt-2">
                    <VSelect v-model="product.supplier_id" :items="suppliers" item-title="name" item-value="id"
                      density="comfortable" variant="outlined" label="Proveedor Principal"
                      placeholder="Selecciona proveedor" prepend-inner-icon="ri-truck-line" hide-details="auto"
                      color="primary" :loading="isLoading" />
                  </VCol>
                </VRow>
              </VCardText>
            </VCard>

            <!-- Tarjeta 3: Observaciones y Notas Internas -->
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="secondary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-file-text-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Observaciones y Notas
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Especificaciones adicionales
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>
              <VCardText class="pa-4 bg-white">
                <VTextarea v-model="product.notes"
                  placeholder="Notas adicionales, especificaciones técnicas o términos de garantía..."
                  variant="outlined" rows="2" density="comfortable" hide-details="auto" color="primary" auto-grow />
              </VCardText>
            </VCard>

            <!-- Tarjeta 4: Resumen y Acciones (Igual que en Orden de Trabajo) -->
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-money-dollar-circle-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Resumen del Registro
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        PVP final y confirmación
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>

              <VCardText class="pa-4 bg-white d-flex flex-column gap-3">
                <div class="d-flex justify-space-between align-center pa-3 rounded-xl bg-slate-50 border">
                  <div>
                    <div class="text-caption font-weight-bold text-slate-500 text-uppercase">
                      PVP Final (Con IVA)
                    </div>
                    <div class="text-h4 font-weight-black text-primary mt-0.5">
                      ${{ parseFloat(priceSaleWithIva || 0).toFixed(2) }}
                    </div>
                  </div>
                  <VAvatar color="primary" variant="tonal" size="44" class="rounded-xl">
                    <VIcon icon="ri-wallet-3-line" size="24" />
                  </VAvatar>
                </div>

                <div
                  v-if="product.item_type !== '2' && product.item_type !== 2 && Number(product.price_sale) > 0 && Number(product.purchase_price) > 0"
                  class="d-flex justify-space-between align-center px-1">
                  <span class="text-caption text-medium-emphasis">Margen Bruto:</span>
                  <span class="text-caption font-weight-bold text-success">
                    +${{ (Number(product.price_sale) - Number(product.purchase_price)).toFixed(2) }}
                    ({{ (((Number(product.price_sale) - Number(product.purchase_price)) /
                      Number(product.purchase_price)) *
                    100).toFixed(1) }}%)
                  </span>
                </div>
              </VCardText>

              <VDivider />

              <VCardActions class="pa-4 bg-white d-flex flex-column gap-2">
                <!-- Alertas -->
                <VAlert v-if="warning" color="warning" variant="tonal" class="w-100 mb-1 rounded-lg" border="start"
                  closable @click:close="warning = null">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-alert-line" class="me-2" size="20" />
                    <span class="text-caption font-weight-bold">{{ warning }}</span>
                  </div>
                </VAlert>

                <VAlert v-if="error_exist" color="error" variant="tonal" class="w-100 mb-1 rounded-lg" border="start"
                  closable @click:close="error_exist = null">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-error-warning-line" class="me-2" size="20" />
                    <span class="text-caption font-weight-bold">{{ error_exist }}</span>
                  </div>
                </VAlert>

                <VBtn block type="submit" color="primary" variant="elevated" height="44" prepend-icon="ri-save-3-line"
                  class="rounded-lg font-weight-bold elevation-2 text-none"
                  style="font-size: 0.95rem; letter-spacing: 0.3px;" :loading="loader.loading"
                  :disabled="loader.loading || isLoading">
                  Guardar Producto
                </VBtn>

                <VBtn block color="secondary" variant="outlined" height="38" prepend-icon="ri-close-line"
                  class="rounded-lg font-weight-medium text-none" :disabled="isLoading || loader.loading"
                  @click="router.push(backRoute)">
                  Cancelar
                </VBtn>
              </VCardActions>
            </VCard>

          </div>
        </VCol>
      </VRow>
    </VForm>

    <!-- Diálogo de Verificación de Existencia de Producto -->
    <ProductExistenceCheckDialog v-model="isCheckDialogVisible" :initial-query="checkInitialQuery"
      :search-field="checkSearchField" @use-data="handleUseProductData" />
  </div>
</template>

<style scoped lang="scss">
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

// Status Pills (Estilo listado de clientes / ventas)
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

.status-partial {
  background-color: #fffbeb !important;
  color: #92400e !important;
  border: 1px solid #fde68a !important;

  .status-dot {
    background-color: #f59e0b !important;
  }
}

.status-info {
  background-color: #eff6ff !important;
  color: #1e40af !important;
  border: 1px solid #bfdbfe !important;

  .status-dot {
    background-color: #3b82f6 !important;
  }
}

.status-secondary {
  background-color: #f8fafc !important;
  color: #475569 !important;
  border: 1px solid #e2e8f0 !important;

  .status-dot {
    background-color: #94a3b8 !important;
  }
}

.status-primary {
  background-color: #eef2ff !important;
  color: #4338ca !important;
  border: 1px solid #c7d2fe !important;

  .status-dot {
    background-color: #6366f1 !important;
  }
}
</style>
