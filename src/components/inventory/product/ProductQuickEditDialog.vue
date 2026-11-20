<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useTaxConfig } from '@/composables/useTaxConfig'
import { usePermissions } from '@/composables/usePermissions'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  product: {
    type: Object,
    default: null,
  },
  categories: {
    type: Array,
    default: () => [],
  },
  brands: {
    type: Array,
    default: () => [],
  },
  initialTab: {
    type: String,
    default: 'stock',
  },
})

const emit = defineEmits(['update:isDialogVisible', 'updated'])

const { showNotification } = useGlobalToast()
const { taxPercent } = useTaxConfig()
const { isAdminOrSuperAdmin } = usePermissions()

const activeTab = ref('stock')
const isSubmitting = ref(false)
const errorMessage = ref('')

// Formulario reactivo
const form = ref({
  id: null,
  description: '',
  sku: '',
  stock: 0,
  initialStock: 0,
  price_sale: 0,
  final_price: 0,
  product_categorie_id: null,
  brand: '',
  tax_rate: taxPercent.value,
  purchase_price: 0,
  item_type: 1,
  is_taxable: 1,
  is_gift: 2,
  min_stock: 0,
  max_stock: 0,
  state: 1,
  warehouse_id: null,
  unit_id: null,
  supplier_id: null,
  code_aux: '',
  uses: '',
  notes: '',
  max_discount: 0,
  discount_percentage: 0,
  imagen: null,
  is_inventoried: false,
  inventoried_at: null,
})

// Pestañas disponibles
const allTabs = [
  { id: 'stock', label: 'Stock', icon: 'ri-box-3-line' },
  { id: 'price', label: 'Precio', icon: 'ri-money-dollar-circle-line' },
  { id: 'category', label: 'Categoría & Marca', icon: 'ri-price-tag-3-line' },
]

const tabs = computed(() => {
  if (form.value.item_type == 2) {
    // Si es un servicio, no se puede modificar stock ni categoría
    return allTabs.filter(t => t.id === 'price')
  }
  return allTabs
})

// Estados internos para categorías auxiliares
const internalCategories = ref([])
const isFetchingCategories = ref(false)

const loadCategoriesIfEmpty = async () => {
  if (props.categories && props.categories.length > 0) return
  if (isFetchingCategories.value) return
  isFetchingCategories.value = true
  try {
    const resp = await $api('products/config')
    if (resp?.status === 200 && resp.data?.categories) {
      internalCategories.value = resp.data.categories
    }
  } catch (e) {
    console.warn('Error al cargar categorías en diálogo:', e)
  } finally {
    isFetchingCategories.value = false
  }
}

// Sincronizar formulario cuando se abre el diálogo
watch(
  () => props.isDialogVisible,
  visible => {
    if (visible && props.product) {
      errorMessage.value = ''
      const isService = parseInt(props.product.item_type || 1) === 2
      if (isService) {
        activeTab.value = 'price'
      } else {
        activeTab.value = (props.initialTab && props.initialTab !== 'all') ? props.initialTab : 'stock'
      }

      const p = props.product
      const taxRate = parseFloat(p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : taxPercent.value)
      const basePrice = parseFloat(p.price_sale || 0)
      const finalPrice = parseFloat((basePrice * (1 + taxRate / 100)).toFixed(2))
      const currentStock = parseFloat(p.stock || 0)

      const rawCatId = p.product_categorie_id !== undefined && p.product_categorie_id !== null
        ? p.product_categorie_id
        : (p.categorie?.id !== undefined ? p.categorie.id : null)

      form.value = {
        id: p.id,
        description: p.description || '',
        sku: p.sku || '',
        stock: currentStock,
        initialStock: currentStock,
        price_sale: basePrice,
        final_price: finalPrice,
        product_categorie_id: rawCatId !== null && rawCatId !== undefined ? Number(rawCatId) : null,
        brand: p.brand || '',
        tax_rate: taxRate,
        purchase_price: parseFloat(p.purchase_price || 0),
        item_type: parseInt(p.item_type || 1),
        is_taxable: p.is_taxable !== undefined ? parseInt(p.is_taxable) : 1,
        is_gift: p.is_gift !== undefined ? parseInt(p.is_gift) : 2,
        min_stock: parseFloat(p.min_stock || 0),
        max_stock: parseFloat(p.max_stock || 0),
        state: p.state !== undefined ? parseInt(p.state) : 1,
        warehouse_id: p.warehouse_id || p.warehouse?.id || null,
        unit_id: p.unit_id || p.unit?.id || null,
        supplier_id: p.supplier_id || p.supplier?.id || null,
        code_aux: p.code_aux || '',
        uses: p.uses || '',
        notes: p.notes || '',
        max_discount: parseFloat(p.max_discount || 0),
        discount_percentage: parseFloat(p.discount_percentage || 0),
        imagen: p.imagen || null,
        is_inventoried: Boolean(p.inventoried_at),
        inventoried_at: p.inventoried_at || null,
      }

      loadCategoriesIfEmpty()
    }
  },
  { immediate: true },
)

// Categorías normalizadas asegurando que la categoría actual tenga título visible
const computedCategories = computed(() => {
  const source = (props.categories && props.categories.length > 0)
    ? props.categories
    : internalCategories.value

  const list = source.map(c => ({
    id: Number(c.id),
    title: c.title || c.name || `Categoría #${c.id}`,
  }))

  // Garantizar que la categoría actual del producto esté presente con su nombre real
  const currentCatId = form.value.product_categorie_id !== null && form.value.product_categorie_id !== undefined
    ? Number(form.value.product_categorie_id)
    : (props.product?.categorie?.id ? Number(props.product.categorie.id) : null)

  if (currentCatId) {
    const exists = list.some(c => c.id === currentCatId)
    if (!exists) {
      const catTitle = props.product?.categorie?.title || `Categoría #${currentCatId}`

      list.unshift({ id: currentCatId, title: catTitle })
    }
  }

  return list
})

// Cálculos en tiempo real del precio
const calculatedSubtotal = computed(() => {
  const tax = form.value.tax_rate || 0
  const final = parseFloat(form.value.final_price) || 0

  return (final / (1 + tax / 100)).toFixed(2)
})

const calculatedTaxAmount = computed(() => {
  const final = parseFloat(form.value.final_price) || 0
  const subtotal = parseFloat(calculatedSubtotal.value) || 0

  return Math.max(0, final - subtotal).toFixed(2)
})

const onFinalPriceInput = val => {
  const final = parseFloat(val) || 0
  const tax = form.value.tax_rate || 0

  form.value.price_sale = parseFloat((final / (1 + tax / 100)).toFixed(4))
}

const onBasePriceInput = val => {
  const base = parseFloat(val) || 0
  const tax = form.value.tax_rate || 0

  form.value.final_price = parseFloat((base * (1 + tax / 100)).toFixed(2))
}

// Ajustes interactivos de Stock
const adjustStock = delta => {
  const current = parseFloat(form.value.stock) || 0
  const updated = Math.max(0, current + delta)

  form.value.stock = Math.round(updated * 100) / 100
}

const stockDelta = computed(() => {
  const current = parseFloat(form.value.stock) || 0
  const initial = parseFloat(form.value.initialStock) || 0

  return Math.round((current - initial) * 100) / 100
})

// --- Helpers y Computadas de Estado de Inventario y Existencia en Taller ---

// Stock numérico normalizado
const currentStockNum = computed(() => {
  return parseFloat(form.value.stock) || 0
})

// Clave de estado actual para el control segmentado ('pending' | 'inventoried' | 'out_of_stock')
const currentInventoryStatus = computed(() => {
  if (!form.value.is_inventoried) {
    return 'pending'
  }
  
  return currentStockNum.value === 0 ? 'out_of_stock' : 'inventoried'
})

// Indicador descriptivo de existencia en taller (Fila superior)
const workshopStockBadge = computed(() => {
  if (form.value.item_type == 2) {
    return {
      label: 'Servicio (Sin stock)',
      icon: 'ri-customer-service-2-line',
      chipClass: 'stock-badge--service',
      tooltip: 'Este ítem es un servicio y no maneja existencia física.',
    }
  }

  const stock = currentStockNum.value
  const isInv = Boolean(form.value.is_inventoried)

  // Regla 1: No inventariado + stock = 0
  if (!isInv && stock === 0) {
    return {
      label: 'Stock: 0 · Sin verificar',
      icon: 'ri-time-line',
      chipClass: 'stock-badge--unverified',
      tooltip: 'Stock en cero pendiente de verificación física en el taller.',
    }
  }

  // No inventariado + stock > 0
  if (!isInv && stock > 0) {
    return {
      label: `Stock: ${stock} und. · Por verificar`,
      icon: 'ri-survey-line',
      chipClass: 'stock-badge--unverified',
      tooltip: 'Existencia registrada en sistema, aún no confirmada físicamente.',
    }
  }

  // Regla 3: Inventariado + stock = 0 (Agotado confirmado)
  if (isInv && stock === 0) {
    return {
      label: 'Agotado (0 und.)',
      icon: 'ri-close-circle-line',
      chipClass: 'stock-badge--out-of-stock',
      tooltip: 'Producto inventariado y verificado físicamente: sin existencias.',
    }
  }

  // Regla 2: Inventariado + stock > 0 (Disponible en taller)
  return {
    label: `En taller: ${stock} und.`,
    icon: 'ri-checkbox-circle-line',
    chipClass: 'stock-badge--available',
    tooltip: 'Producto verificado en conteo físico con existencias disponibles en taller.',
  }
})

// Regla 4: Sincronización bidireccional limpia al cambiar estado desde el selector
const setInventoryStatus = statusKey => {
  if (statusKey === 'pending') {
    form.value.is_inventoried = false
  } else if (statusKey === 'out_of_stock') {
    // Si se marca como agotado, el stock objetivo queda en 0 y se confirma como inventariado/revisado
    form.value.stock = 0
    form.value.is_inventoried = true
  } else if (statusKey === 'inventoried') {
    form.value.is_inventoried = true

    // Si estaba en 0 (agotado) pero tenía stock inicial antes de agotar, restaurar la existencia inicial
    if (form.value.stock === 0 && form.value.initialStock > 0) {
      form.value.stock = form.value.initialStock
    }
  }
}

// Opciones combinadas de marcas (props + marcas únicas)
const combinedBrands = computed(() => {
  const list = [...(props.brands || [])]
  if (form.value.brand && !list.includes(form.value.brand)) {
    list.unshift(form.value.brand)
  }

  return list.filter(Boolean)
})

// Cerrar diálogo
const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

// Guardar cambios
const saveChanges = async () => {
  if (!form.value.product_categorie_id) {
    errorMessage.value = 'Por favor selecciona una categoría'

    return
  }

  if (parseFloat(form.value.final_price) < 0) {
    errorMessage.value = 'El precio de venta no puede ser negativo'

    return
  }

  if (form.value.item_type == 1 && parseFloat(form.value.stock) < 0) {
    errorMessage.value = 'El stock no puede ser negativo'

    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const isService = form.value.item_type == 2
    const basePrice = parseFloat(calculatedSubtotal.value) || 0

    // Recalcular max_discount si corresponde
    let maxDiscount = parseFloat(form.value.max_discount || 0)
    const purchasePrice = parseFloat(form.value.purchase_price || 0)
    const discPercentage = parseFloat(form.value.discount_percentage || 0)
    if (purchasePrice > 0 && basePrice > purchasePrice && discPercentage > 0) {
      maxDiscount = parseFloat(((basePrice - purchasePrice) * discPercentage / 100).toFixed(2))
    }

    const formData = new FormData()

    formData.append('description', form.value.description || '')
    formData.append('sku', form.value.sku || '')
    if (form.value.code_aux) formData.append('code_aux', form.value.code_aux)
    if (form.value.uses) formData.append('uses', form.value.uses)
    formData.append('product_categorie_id', isService ? (props.product?.product_categorie_id || props.product?.categorie?.id || form.value.product_categorie_id) : form.value.product_categorie_id)
    if (form.value.warehouse_id) formData.append('warehouse_id', form.value.warehouse_id)
    if (form.value.unit_id) formData.append('unit_id', form.value.unit_id)
    if (form.value.supplier_id) formData.append('supplier_id', form.value.supplier_id)
    formData.append('price', basePrice)
    formData.append('price_sale', basePrice)
    formData.append('purchase_price', isService ? 0 : purchasePrice)
    formData.append('tax_rate', form.value.tax_rate ?? taxPercent.value)
    formData.append('max_discount', maxDiscount)
    formData.append('discount_percentage', discPercentage)
    formData.append('brand', form.value.brand ? form.value.brand.trim() : '')
    formData.append('stock', isService ? 0 : (parseFloat(form.value.stock) || 0))
    formData.append('item_type', form.value.item_type || 1)
    formData.append('min_stock', isService ? 0 : (parseFloat(form.value.min_stock) || 0))
    formData.append('max_stock', isService ? 0 : (parseFloat(form.value.max_stock) || 0))
    formData.append('is_taxable', form.value.is_taxable === 1 ? 1 : 2)
    formData.append('is_gift', form.value.is_gift === 1 ? 1 : 2)
    formData.append('notes', form.value.notes || '')
    formData.append('state', form.value.state || 1)
    if (isAdminOrSuperAdmin.value) {
      formData.append('is_inventoried', form.value.is_inventoried ? '1' : '0')
    }
    formData.append('_method', 'PUT')

    const response = await $api(`products/${form.value.id}`, {
      method: 'POST',
      body: formData,
    })

    if (response && (response.status === 200 || response.message === 200)) {
      showNotification('Producto actualizado correctamente', 'success')
      emit('updated', response.product || {
        ...props.product,
        stock: isService ? 0 : parseFloat(form.value.stock),
        price_sale: basePrice,
        price: basePrice,
        product_categorie_id: form.value.product_categorie_id,
        brand: form.value.brand,
        inventoried_at: form.value.is_inventoried ? (form.value.inventoried_at || new Date().toISOString()) : null,
        categorie: props.categories.find(c => c.id === form.value.product_categorie_id) || props.product.categorie,
      })
      closeDialog()
    } else {
      errorMessage.value = response?.message_text || response?.message || 'Error al actualizar el producto'
    }
  } catch (error) {
    console.error('Error al actualizar producto:', error)
    errorMessage.value = error?.data?.message || error?.message || 'Error al conectar con el servidor'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <VDialog :model-value="isDialogVisible" max-width="580px" :fullscreen="$vuetify.display.smAndDown" persistent
    scrollable class="v-dialog-quick-edit" @update:model-value="val => !val && closeDialog()">
    <VCard class="product-quick-dialog-card">
      <!-- Encabezado Limpio, Sobrio y Profesional -->
      <div class="product-quick-header">
        <!-- Fila Superior: SKU + Badge de Existencia en Taller + Botón Cerrar (X) -->
        <div class="header-top-row d-flex align-center justify-space-between gap-2 mb-2">
          <div class="d-flex align-center gap-2 flex-wrap min-w-0">
            <!-- Chip de SKU -->
            <span class="product-sku-chip font-mono">
              SKU: {{ form.sku || 'S/C' }}
            </span>

            <!-- Chip de Servicio si corresponde -->
            <span v-if="form.item_type == 2" class="product-service-chip">
              Servicio
            </span>

            <!-- Badge / Indicador de Existencia en Taller -->
            <div class="stock-status-chip" :class="workshopStockBadge.chipClass">
              <VIcon :icon="workshopStockBadge.icon" size="14" class="me-1" />
              <span>{{ workshopStockBadge.label }}</span>
              <VTooltip activator="parent" location="bottom">
                {{ workshopStockBadge.tooltip }}
              </VTooltip>
            </div>
          </div>

          <!-- Botón de Cerrar (X) -->
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            title="Cerrar ventana"
            @click="closeDialog"
          />
        </div>

        <!-- Fila Central: Avatar y Título del Producto (Hasta 2 líneas) -->
        <div class="header-main-row d-flex align-center gap-3">
          <VAvatar size="44" rounded="lg" color="white" class="elevation-1 overflow-hidden flex-shrink-0">
            <img
              v-if="form.imagen"
              :src="form.imagen"
              :alt="form.description"
              style="width: 100%; height: 100%; object-fit: cover;"
            >
            <VIcon v-else icon="ri-box-3-line" color="primary" size="24" />
          </VAvatar>

          <div class="product-title-wrap min-w-0 flex-grow-1">
            <h3 class="product-dialog-title ma-0" :title="form.description">
              {{ form.description || 'Edición Rápida de Producto' }}
            </h3>
          </div>
        </div>

        <!-- Fila Inferior: Control de Estado Compacto (Solo Superadmin y Administrador) -->
        <div v-if="isAdminOrSuperAdmin && form.item_type != 2" class="header-status-control mt-2.5">
          <div class="status-toggle-group">
            <button
              type="button"
              class="status-toggle-btn btn-pending"
              :class="{ active: currentInventoryStatus === 'pending' }"
              @click="setInventoryStatus('pending')"
            >
              <VIcon icon="ri-time-line" size="14" class="me-1" />
              <span>Pendiente</span>
            </button>

            <button
              type="button"
              class="status-toggle-btn btn-inventoried"
              :class="{ active: currentInventoryStatus === 'inventoried' }"
              @click="setInventoryStatus('inventoried')"
            >
              <VIcon icon="ri-checkbox-circle-line" size="14" class="me-1" />
              <span>Inventariado</span>
              <VTooltip v-if="form.inventoried_at" activator="parent" location="bottom">
                Última verificación: {{ form.inventoried_at }}
              </VTooltip>
            </button>

            <button
              type="button"
              class="status-toggle-btn btn-out-of-stock"
              :class="{ active: currentInventoryStatus === 'out_of_stock' }"
              @click="setInventoryStatus('out_of_stock')"
            >
              <VIcon icon="ri-close-circle-line" size="14" class="me-1" />
              <span>Agotado (0)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Barra de pestañas segmentada para móvil/desktop (Solo si hay más de 1 pestaña disponible) -->
      <div v-if="tabs.length > 1" class="px-4 pt-3 pb-1 bg-surface border-b">
        <div class="quick-edit-nav-pills">
          <div v-for="t in tabs" :key="t.id" class="nav-pill-item" :class="{ active: activeTab === t.id }"
            @click="activeTab = t.id">
            <VIcon :icon="t.icon" size="16" class="me-1" />
            <span>{{ t.label }}</span>
          </div>
        </div>
      </div>

      <!-- Contenido del diálogo con scroll suave -->
      <VCardText class="pa-4 bg-surface">
        <!-- Alerta de error si existe -->
        <VAlert v-if="errorMessage" type="error" variant="tonal" closable density="comfortable" class="mb-3 rounded-lg"
          @click:close="errorMessage = ''">
          {{ errorMessage }}
        </VAlert>

        <!-- SECCIÓN: STOCK -->
        <div v-show="activeTab === 'stock'" class="quick-edit-section">
          <div class="section-header">
            <div class="section-icon-wrap bg-primary-lighten-5 text-primary">
              <VIcon icon="ri-box-3-line" size="18" />
            </div>
            <span class="section-title-text">Ajuste de Stock en Almacén</span>
            <VSpacer />
            <span v-if="stockDelta !== 0" class="font-mono text-caption font-weight-bold px-2 py-0.5 rounded"
              :class="stockDelta > 0 ? 'bg-success-lighten-5 text-success' : 'bg-error-lighten-5 text-error'">
              {{ stockDelta > 0 ? `+${stockDelta}` : stockDelta }} unidades
            </span>
          </div>

          <div v-if="form.item_type == 2" class="text-center pa-4 bg-surface border rounded-lg">
            <VIcon icon="ri-information-line" color="medium-emphasis" class="mb-1" />
            <div class="text-caption text-medium-emphasis">
              Este ítem está configurado como <strong>Servicio</strong>, no gestiona existencias físicas.
            </div>
          </div>

          <div v-else class="quick-stock-stepper-box">
            <!-- Contexto de Stock sin número duplicado -->
            <div class="d-flex align-center justify-space-between mb-3 px-1">
              <span class="text-caption font-weight-bold text-medium-emphasis">
                Modificar Existencia
              </span>
              <span class="text-caption text-disabled font-mono">
                Stock anterior: <strong class="text-medium-emphasis">{{ form.initialStock }}</strong>
              </span>
            </div>

            <!-- Stepper interactivo táctil compacto: única fuente de la cantidad -->
            <div class="quick-stepper-row mb-3">
              <VBtn color="secondary" variant="tonal" class="quick-stepper-btn" :disabled="form.stock <= 0"
                @click="adjustStock(-1)">
                <VIcon icon="ri-subtract-line" size="18" />
              </VBtn>

              <VTextField v-model.number="form.stock" type="number" min="0" step="any" density="compact"
                variant="outlined" hide-details class="font-mono text-center font-weight-bold stock-input-compact" />

              <VBtn color="primary" variant="tonal" class="quick-stepper-btn" @click="adjustStock(1)">
                <VIcon icon="ri-add-line" size="18" />
              </VBtn>
            </div>

            <!-- Chips de ajuste rápido para celulares -->
            <div class="quick-adjustment-chips">
              <span class="adj-chip adj-minus" @click="adjustStock(-10)">-10</span>
              <span class="adj-chip adj-minus" @click="adjustStock(-5)">-5</span>
              <span class="adj-chip adj-minus" @click="adjustStock(-1)">-1</span>
              <span class="adj-chip adj-plus" @click="adjustStock(1)">+1</span>
              <span class="adj-chip adj-plus" @click="adjustStock(5)">+5</span>
              <span class="adj-chip adj-plus" @click="adjustStock(10)">+10</span>
            </div>
          </div>
        </div>

        <!-- SECCIÓN: PRECIO VENTA FINAL (P.V.P CON IVA) -->
        <div v-show="activeTab === 'price'" class="quick-edit-section">
          <div class="section-header">
            <div class="section-icon-wrap bg-success-lighten-5 text-success">
              <VIcon icon="ri-money-dollar-circle-line" size="18" />
            </div>
            <span class="section-title-text">Precio de Venta Final (P.V.P)</span>
            <VSpacer />
            <span class="text-caption text-medium-emphasis font-weight-medium">IVA {{ form.tax_rate }}%</span>
          </div>

          <VRow dense class="mb-2">
            <VCol cols="12" sm="7">
              <VTextField v-model="form.final_price" type="number" step="0.01" min="0"
                label="Precio Venta Final (con IVA)" prefix="$" variant="outlined" density="comfortable" color="success"
                class="font-mono font-weight-bold" hide-details="auto" @update:model-value="onFinalPriceInput" />
            </VCol>

            <VCol cols="12" sm="5">
              <VTextField v-model="form.price_sale" type="number" step="0.01" min="0" label="Base sin IVA" prefix="$"
                variant="outlined" density="comfortable" color="primary" class="font-mono" hide-details="auto"
                @update:model-value="onBasePriceInput" />
            </VCol>
          </VRow>

          <!-- Desglose automático en vivo -->
          <div class="price-calc-summary-box mt-3">
            <div class="calc-row">
              <span>Subtotal Neto (sin impuestos):</span>
              <strong class="font-mono">${{ calculatedSubtotal }}</strong>
            </div>
            <div class="calc-row">
              <span>Impuesto IVA ({{ form.tax_rate }}%):</span>
              <strong class="font-mono">+${{ calculatedTaxAmount }}</strong>
            </div>
            <div class="calc-row calc-highlight">
              <span>PVP Total al Consumidor:</span>
              <span class="calc-final-price">${{ form.final_price || '0.00' }}</span>
            </div>
          </div>
        </div>

        <!-- SECCIÓN: CATEGORÍA & MARCA -->
        <div v-show="activeTab === 'category'" class="quick-edit-section mb-0">
          <div class="section-header">
            <div class="section-icon-wrap bg-warning-lighten-5 text-warning">
              <VIcon icon="ri-price-tag-3-line" size="18" />
            </div>
            <span class="section-title-text">Categoría & Marca Comercial</span>
          </div>

          <VRow dense>
            <VCol cols="12">
              <VSelect v-model="form.product_categorie_id" :items="computedCategories" item-title="title"
                item-value="id" label="Categoría del Producto" placeholder="Seleccionar categoría"
                prepend-inner-icon="ri-folder-line" variant="outlined" density="comfortable" color="primary"
                hide-details="auto" class="mb-3">
                <template #selection="{ item }">
                  <span>{{ item.raw?.title || item.title }}</span>
                </template>
                <template #item="{ props: itemProps, item }">
                  <VListItem v-bind="itemProps" :title="item.raw?.title || item.title" />
                </template>
              </VSelect>
            </VCol>

            <VCol cols="12">
              <VCombobox v-model="form.brand" :items="combinedBrands" label="Marca"
                placeholder="Escribe o selecciona la marca" prepend-inner-icon="ri-award-line" variant="outlined"
                density="comfortable" color="primary" hide-details="auto" clearable>
                <template #no-data>
                  <VListItem>
                    <VListItemTitle class="text-caption text-medium-emphasis">
                      Presiona <strong>Enter</strong> para agregar una nueva marca
                    </VListItemTitle>
                  </VListItem>
                </template>
              </VCombobox>
            </VCol>
          </VRow>
        </div>
      </VCardText>

      <!-- Botones de Acción -->
      <VCardActions class="pa-4 bg-surface border-t d-flex justify-end gap-2">
        <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" class="font-weight-medium"
          :disabled="isSubmitting" @click="closeDialog">
          Cancelar
        </VBtn>

        <VBtn color="primary" variant="flat" prepend-icon="ri-save-line" class="font-weight-bold px-5"
          :loading="isSubmitting" @click="saveChanges">
          Guardar Cambios
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped lang="scss">
.product-quick-header {
  position: relative;
  padding: 1.1rem 1.25rem 1rem 1.25rem;
  color: #ffffff;
}

.header-top-row {
  position: relative;
  z-index: 2;
}

.product-sku-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #ffffff;
  letter-spacing: 0.03em;
  backdrop-filter: blur(4px);
}

.product-service-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.95);
  color: #4f46e5;
}

.stock-status-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 9999px;
  font-size: 0.73rem;
  font-weight: 600;
  line-height: 1.3;
  backdrop-filter: blur(6px);
  cursor: default;
  transition: all 0.2s ease;

  // Estados visuales sobrios y legibles
  &.stock-badge--available {
    background: rgba(16, 185, 129, 0.22);
    border: 1px solid rgba(52, 211, 153, 0.5);
    color: #ecfdf5;
    font-weight: 700;

    .v-icon {
      color: #34d399 !important;
    }
  }

  &.stock-badge--out-of-stock {
    background: rgba(239, 68, 68, 0.22);
    border: 1px solid rgba(248, 113, 113, 0.45);
    color: #fef2f2;
    font-weight: 700;

    .v-icon {
      color: #f87171 !important;
    }
  }

  &.stock-badge--unverified {
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.24);
    color: rgba(255, 255, 255, 0.92);

    .v-icon {
      color: rgba(255, 255, 255, 0.8) !important;
    }
  }

  &.stock-badge--service {
    background: rgba(14, 165, 233, 0.22);
    border: 1px solid rgba(56, 189, 248, 0.45);
    color: #f0f9ff;

    .v-icon {
      color: #38bdf8 !important;
    }
  }
}

.custom-dialog-close-btn {
  position: static !important;
  width: 30px !important;
  height: 30px !important;
  min-width: 30px !important;
  border-radius: 8px !important;
  background: rgba(255, 255, 255, 0.16) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.3) !important;
    border-color: rgba(255, 255, 255, 0.5) !important;
    transform: scale(1.05) !important;
  }
}

.product-dialog-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
  font-size: 1.05rem;
  font-weight: 700;
  color: #ffffff;
  word-break: break-word;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.header-status-control {
  position: relative;
  z-index: 2;
}

.status-toggle-group {
  display: flex;
  align-items: stretch;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 9px;
  padding: 2px;
  gap: 3px;
  backdrop-filter: blur(8px);
}

.status-toggle-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 0.77rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  user-select: none;

  .v-icon {
    color: inherit;
    transition: transform 0.2s ease;
  }

  &:hover:not(.active) {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  &.active {
    font-weight: 700;
    color: #ffffff;

    &.btn-pending {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.35);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    &.btn-inventoried {
      background: rgba(16, 185, 129, 0.32);
      border-color: rgba(52, 211, 153, 0.6);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);

      .v-icon {
        color: #34d399;
      }
    }

    &.btn-out-of-stock {
      background: rgba(239, 68, 68, 0.32);
      border-color: rgba(248, 113, 113, 0.6);
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);

      .v-icon {
        color: #f87171;
      }
    }
  }
}
</style>
