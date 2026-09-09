<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

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
    default: 'all',
  },
})

const emit = defineEmits(['update:isDialogVisible', 'updated'])

const { showNotification } = useGlobalToast()

const activeTab = ref('all')
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
  tax_rate: 15,
  purchase_price: 0,
  item_type: 1,
  is_taxable: 1,
  is_gift: 2,
  min_stock: 0,
  max_stock: 0,
  state: 1,
  warehouse_id: 1,
  unit_id: 1,
  supplier_id: null,
  code_aux: '',
  uses: '',
  notes: '',
  max_discount: 0,
  discount_percentage: 0,
  imagen: null,
})

// Pestañas disponibles
const tabs = [
  { id: 'all', label: 'Todo', icon: 'ri-flashlight-line' },
  { id: 'stock', label: 'Stock', icon: 'ri-box-3-line' },
  { id: 'price', label: 'Precio', icon: 'ri-money-dollar-circle-line' },
  { id: 'category', label: 'Categoría & Marca', icon: 'ri-price-tag-3-line' },
]

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
      activeTab.value = props.initialTab || 'all'

      const p = props.product
      const taxRate = parseFloat(p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : 15)
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
        warehouse_id: p.warehouse_id || p.warehouse?.id || 1,
        unit_id: p.unit_id || p.unit?.id || 1,
        supplier_id: p.supplier_id || p.supplier?.id || null,
        code_aux: p.code_aux || '',
        uses: p.uses || '',
        notes: p.notes || '',
        max_discount: parseFloat(p.max_discount || 0),
        discount_percentage: parseFloat(p.discount_percentage || 0),
        imagen: p.imagen || null,
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
    formData.append('product_categorie_id', form.value.product_categorie_id)
    formData.append('warehouse_id', form.value.warehouse_id || 1)
    formData.append('unit_id', form.value.unit_id || 1)
    if (form.value.supplier_id) formData.append('supplier_id', form.value.supplier_id)
    formData.append('price', basePrice)
    formData.append('price_sale', basePrice)
    formData.append('purchase_price', isService ? 0 : purchasePrice)
    formData.append('tax_rate', form.value.tax_rate ?? 15)
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
  <VDialog
    :model-value="isDialogVisible"
    max-width="580px"
    persistent
    scrollable
    class="v-dialog-quick-edit"
    @update:model-value="val => !val && closeDialog()"
  >
    <VCard class="product-quick-dialog-card">
      <!-- Encabezado con degradado moderno -->
      <div class="product-quick-header">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />

        <div class="d-flex align-center gap-3">
          <VAvatar
            size="44"
            rounded="lg"
            color="white"
            class="elevation-2 overflow-hidden flex-shrink-0"
          >
            <img
              v-if="form.imagen"
              :src="form.imagen"
              :alt="form.description"
              style="width: 100%; height: 100%; object-fit: cover;"
            />
            <VIcon
              v-else
              icon="ri-box-3-line"
              color="primary"
              size="24"
            />
          </VAvatar>

          <div class="overflow-hidden" style="flex: 1;">
            <div class="d-flex align-center gap-2 mb-0.5 flex-wrap">
              <span class="product-mini-badge font-mono">SKU: {{ form.sku || 'S/C' }}</span>
              <span v-if="form.item_type == 2" class="product-mini-badge bg-white text-primary">Servicio</span>
            </div>
            <h3 class="text-white font-weight-bold text-truncate mb-0" style="font-size: 1.05rem;" :title="form.description">
              {{ form.description || 'Edición Rápida' }}
            </h3>
          </div>
        </div>
      </div>

      <!-- Barra de pestañas segmentada para móvil/desktop -->
      <div class="px-4 pt-3 pb-1 bg-surface border-b">
        <div class="quick-edit-nav-pills">
          <div
            v-for="t in tabs"
            :key="t.id"
            class="nav-pill-item"
            :class="{ active: activeTab === t.id }"
            @click="activeTab = t.id"
          >
            <VIcon :icon="t.icon" size="16" class="me-1" />
            <span>{{ t.label }}</span>
          </div>
        </div>
      </div>

      <!-- Contenido del diálogo con scroll suave -->
      <VCardText class="pa-4 bg-grey-lighten-5">
        <!-- Alerta de error si existe -->
        <VAlert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          closable
          density="comfortable"
          class="mb-3 rounded-lg"
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </VAlert>

        <!-- SECCIÓN: STOCK -->
        <div v-show="activeTab === 'all' || activeTab === 'stock'" class="quick-edit-section">
          <div class="section-header">
            <div class="section-icon-wrap bg-primary-lighten-5 text-primary">
              <VIcon icon="ri-box-3-line" size="18" />
            </div>
            <span class="section-title-text">Ajuste de Stock en Almacén</span>
            <VSpacer />
            <span
              v-if="stockDelta !== 0"
              class="font-mono text-caption font-weight-bold px-2 py-0.5 rounded"
              :class="stockDelta > 0 ? 'bg-success-lighten-5 text-success' : 'bg-error-lighten-5 text-error'"
            >
              {{ stockDelta > 0 ? `+${stockDelta}` : stockDelta }} unidades
            </span>
          </div>

          <div v-if="form.item_type == 2" class="text-center pa-4 bg-grey-lighten-4 rounded-lg">
            <VIcon icon="ri-information-line" color="medium-emphasis" class="mb-1" />
            <div class="text-caption text-medium-emphasis">Este ítem está configurado como <strong>Servicio</strong>, no gestiona existencias físicas.</div>
          </div>

          <div v-else class="quick-stock-stepper-box">
            <div class="stock-current-display">
              <div class="text-caption text-medium-emphasis font-weight-medium">Existencia Actualizada</div>
              <div class="stock-big-number" :class="form.stock > 0 ? 'text-primary' : 'text-error'">
                {{ form.stock }}
              </div>
              <div class="text-caption text-disabled font-mono">Stock anterior: {{ form.initialStock }}</div>
            </div>

            <!-- Stepper interactivo táctil -->
            <div class="quick-stepper-row my-3">
              <VBtn
                color="secondary"
                variant="tonal"
                class="quick-stepper-btn"
                :disabled="form.stock <= 0"
                @click="adjustStock(-1)"
              >
                <VIcon icon="ri-subtract-line" size="20" />
              </VBtn>

              <VTextField
                v-model.number="form.stock"
                type="number"
                min="0"
                step="any"
                density="comfortable"
                variant="outlined"
                hide-details
                class="font-mono text-center font-weight-bold"
                style="max-width: 140px;"
              />

              <VBtn
                color="primary"
                variant="tonal"
                class="quick-stepper-btn"
                @click="adjustStock(1)"
              >
                <VIcon icon="ri-add-line" size="20" />
              </VBtn>
            </div>

            <!-- Chips de ajuste rápido para celulares -->
            <div class="quick-adjustment-chips mt-2">
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
        <div v-show="activeTab === 'all' || activeTab === 'price'" class="quick-edit-section">
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
              <VTextField
                v-model="form.final_price"
                type="number"
                step="0.01"
                min="0"
                label="Precio Venta Final (con IVA)"
                prefix="$"
                variant="outlined"
                density="comfortable"
                color="success"
                class="font-mono font-weight-bold"
                hide-details="auto"
                @update:model-value="onFinalPriceInput"
              />
            </VCol>

            <VCol cols="12" sm="5">
              <VTextField
                v-model="form.price_sale"
                type="number"
                step="0.01"
                min="0"
                label="Base sin IVA"
                prefix="$"
                variant="outlined"
                density="comfortable"
                color="primary"
                class="font-mono"
                hide-details="auto"
                @update:model-value="onBasePriceInput"
              />
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
        <div v-show="activeTab === 'all' || activeTab === 'category'" class="quick-edit-section mb-0">
          <div class="section-header">
            <div class="section-icon-wrap bg-warning-lighten-5 text-warning">
              <VIcon icon="ri-price-tag-3-line" size="18" />
            </div>
            <span class="section-title-text">Categoría & Marca Comercial</span>
          </div>

          <VRow dense>
            <VCol cols="12">
              <VSelect
                v-model="form.product_categorie_id"
                :items="computedCategories"
                item-title="title"
                item-value="id"
                label="Categoría del Producto"
                placeholder="Seleccionar categoría"
                prepend-inner-icon="ri-folder-line"
                variant="outlined"
                density="comfortable"
                color="primary"
                hide-details="auto"
                class="mb-3"
              >
                <template #selection="{ item }">
                  <span>{{ item.raw?.title || item.title }}</span>
                </template>
                <template #item="{ props: itemProps, item }">
                  <VListItem v-bind="itemProps" :title="item.raw?.title || item.title" />
                </template>
              </VSelect>
            </VCol>

            <VCol cols="12">
              <VCombobox
                v-model="form.brand"
                :items="combinedBrands"
                label="Marca"
                placeholder="Escribe o selecciona la marca"
                prepend-inner-icon="ri-award-line"
                variant="outlined"
                density="comfortable"
                color="primary"
                hide-details="auto"
                clearable
              >
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
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="font-weight-medium"
          :disabled="isSubmitting"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="primary"
          variant="flat"
          prepend-icon="ri-save-line"
          class="font-weight-bold px-5"
          :loading="isSubmitting"
          @click="saveChanges"
        >
          Guardar Cambios
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
