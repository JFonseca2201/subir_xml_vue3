<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'

const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const isSubmitting = ref(false)
const isLoadingConfig = ref(false)
const isLoadingProducts = ref(false)

// Config data
const suppliers = ref([])
const categories = ref([])
const accounts = ref([])
const partners = ref([])
const products = ref([])

// Saldo a favor disponible del proveedor
const supplierAvailableCredit = ref(0)

const checkSupplierCredit = async (supId) => {
  if (!supId) {
    supplierAvailableCredit.value = 0
    return
  }
  try {
    const res = await $api(`supplier-reconciliation/credit-balances/${supId}`)
    if (res.success) {
      supplierAvailableCredit.value = Number(res.total_available || 0)
    }
  } catch (err) {
    console.error('Error al consultar crédito del proveedor:', err)
  }
}

const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000
  
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0]
}

// Form State
const formData = ref({
  supplier_id: null,
  invoice_number: '',
  issue_date: getLocalDateString(),
  payment_type: 'credito',
  account_id: null,
  partner_id: null,
})

// Items State
const items = ref([])
const searchProduct = ref(null)

// Manual Product Entry State
const isManualProductDialogOpen = ref(false)

const manualItem = ref({
  description: '',
  code: '',
  product_categorie_id: null,
  quantity: 1,
  unit_price: null,
  discount: 0,
  is_taxable: true,
})

const openManualProductDialog = (initialSearch = '') => {
  manualItem.value = {
    description: typeof initialSearch === 'string' ? initialSearch : '',
    code: '',
    product_categorie_id: categories.value[0]?.id || null,
    quantity: 1,
    unit_price: null,
    discount: 0,
    is_taxable: true,
  }
  isManualProductDialogOpen.value = true
}

const addManualProduct = () => {
  if (!manualItem.value.description || !manualItem.value.description.trim()) {
    return showNotification('Debe ingresar la descripción del producto', 'warning')
  }
  if (manualItem.value.unit_price === null || manualItem.value.unit_price === undefined || manualItem.value.unit_price < 0) {
    return showNotification('Debe ingresar un precio unitario válido', 'warning')
  }
  if (!manualItem.value.product_categorie_id) {
    return showNotification('Debe seleccionar una categoría para el producto', 'warning')
  }

  const qty = Number(manualItem.value.quantity) || 1
  const price = Number(manualItem.value.unit_price) || 0
  const disc = Number(manualItem.value.discount) || 0
  const sub = qty * price
  const isTaxable = manualItem.value.is_taxable ? 1 : 0
  const taxVal = isTaxable === 1 ? (sub - disc) * 0.15 : 0

  items.value.push({
    id: Date.now(),
    code: manualItem.value.code && manualItem.value.code.trim() ? manualItem.value.code.trim().toUpperCase() : `MANUAL-${Date.now().toString().slice(-6)}`,
    description: manualItem.value.description.trim(),
    quantity: qty,
    unit_price: price,
    subtotal: sub,
    discount: disc,
    tax: taxVal,
    total: (sub - disc) + taxVal,
    item_type: 1,
    product_categorie_id: manualItem.value.product_categorie_id,
    is_taxable: isTaxable,
    is_manual: true,
  })

  showNotification('Producto manual agregado a la compra', 'success')
  isManualProductDialogOpen.value = false
}

const getCategoryName = catId => {
  if (!catId) return ''
  const cat = categories.value.find(c => c.id === catId)
  
  return cat ? (cat.title || cat.name || '') : ''
}

const loadConfig = async () => {
  isLoadingConfig.value = true
  try {
    const [configResp, accountsResp, partnersResp] = await Promise.all([
      $api('invoices/config', { method: 'GET' }),
      $api('accounts', { method: 'GET' }),
      $api('partners', { method: 'GET' }),
    ])

    suppliers.value = configResp.suppliers || []
    categories.value = configResp.categories || []

    const rawAccounts = accountsResp.data || accountsResp || []

    accounts.value = rawAccounts.map(acc => {
      const cleaned = (acc.name || '')
        .replace(/\(EFECTIVO\)/gi, '')
        .replace(/\(TRANSFERENCIA\)/gi, '')
        .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
        .trim()

      
      return {
        ...acc,
        name: acc.bank_name ? `${acc.bank_name} (${cleaned})` : cleaned,
      }
    })

    // Partners returns object with data in many laravel resources
    partners.value = partnersResp.data?.data || partnersResp.data || []

  } catch (error) {
    console.error(error)
    showNotification('Error cargando configuraciones iniciales', 'error')
  } finally {
    isLoadingConfig.value = false
  }
}

// Watcher para buscar productos y saldo a favor cuando cambia el proveedor
watch(() => formData.value.supplier_id, async newSupplierId => {
  checkSupplierCredit(newSupplierId)

  if (!newSupplierId) {
    products.value = []
    
    return
  }

  isLoadingProducts.value = true
  try {
    const productsResp = await $api(`products?supplier_id=${newSupplierId}&per_page=1000`, { method: 'GET' })

    products.value = productsResp.products?.data || productsResp.products || productsResp.data?.data || productsResp.data || []
  } catch (error) {
    console.error(error)
    showNotification('Error cargando productos del proveedor', 'error')
    products.value = []
  } finally {
    isLoadingProducts.value = false
  }
})

// Computeds for totals
const subtotal = computed(() => {
  return items.value.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0)
})

const totalTax = computed(() => {
  return items.value.reduce((sum, item) => sum + (Number(item.tax) || 0), 0)
})

const grandTotal = computed(() => {
  return subtotal.value + totalTax.value
})

const addProductToItems = product => {
  if (!product) return

  // Check if already exists
  const exists = items.value.find(i => i.code === product.sku)
  if (exists) {
    exists.quantity++
    updateItemTotals(exists)
    searchProduct.value = null
    
    return
  }

  items.value.push({
    id: Date.now(),
    code: product.sku,
    description: product.description,
    quantity: 1,
    unit_price: product.purchase_price || 0,
    subtotal: product.purchase_price || 0,
    discount: Number(product.discount) || 0,
    tax: 0, // Simplified tax calculation
    total: product.purchase_price || 0,
    item_type: 1, // Physical Product
    product_categorie_id: product.product_categorie_id || categories.value[0]?.id,
    is_taxable: product.is_taxable || 0,
  })

  searchProduct.value = null
}

const updateItemTotals = item => {
  const qty = Number(item.quantity) || 0
  const price = Number(item.unit_price) || 0
  const disc = Number(item.discount) || 0

  item.subtotal = qty * price

  // Asumimos 15% de IVA si es taxable
  item.tax = item.is_taxable == 1 ? (item.subtotal - disc) * 0.15 : 0
  item.total = (item.subtotal - disc) + item.tax
}

const removeItem = index => {
  items.value.splice(index, 1)
}

const submitPurchase = async () => {
  if (!formData.value.supplier_id || !formData.value.invoice_number) {
    return showNotification('Debe llenar los campos de proveedor y número de factura', 'warning')
  }
  if (items.value.length === 0) {
    return showNotification('Debe agregar al menos un producto a la compra', 'warning')
  }

  if (formData.value.payment_type === 'efectivo' && !formData.value.account_id) {
    return showNotification('Debe seleccionar una cuenta de origen', 'warning')
  }

  if (formData.value.payment_type === 'aporte' && !formData.value.partner_id) {
    return showNotification('Debe seleccionar un socio', 'warning')
  }

  isSubmitting.value = true
  loader.start()

  const payload = {
    ...formData.value,
    subtotal: subtotal.value,
    tax: totalTax.value,
    total: grandTotal.value,
    items: items.value,
  }

  try {
    await $api('purchases/manual', {
      method: 'POST',
      body: payload,
    })

    showNotification('Compra manual registrada correctamente', 'success')
    router.push('/invoice/list')
  } catch (error) {
    console.error(error)
    showNotification(error.response?._data?.message || 'Error al guardar la compra', 'error')
  } finally {
    isSubmitting.value = false
    loader.stop()
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="pa-6 position-relative">
    <VProgressLinear
      v-if="isLoadingConfig"
      v-slot
      indeterminate
      color="primary"
      height="3"
      class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 10;"
    />

    <VRow>
      <VCol
        cols="12"
        class="d-flex align-center justify-space-between mb-4"
      >
        <div>
          <h2 class="text-h4 font-weight-bold d-flex align-center gap-3">
            <VIcon
              icon="ri-shopping-cart-2-line"
              color="primary"
            />
            Nueva Compra Manual
          </h2>
          <span class="text-medium-emphasis">Registra una factura física y actualiza stock/finanzas</span>
        </div>
      </VCol>
    </VRow>

    <!-- Form Skeleton loader -->
    <div
      v-if="isLoadingConfig"
      class="d-flex flex-column gap-6"
    >
      <VRow>
        <VCol
          cols="12"
          md="8"
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
                sm="3"
              >
                <div
                  class="shimmer-line w-100 mb-2"
                  style="height: 48px; border-radius: 8px;"
                />
              </VCol>
              <VCol
                cols="12"
                sm="3"
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
          md="4"
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
            <VDivider class="my-4" />
            <div class="d-flex justify-space-between mb-2">
              <div class="shimmer-line w-30" />
              <div class="shimmer-line w-20" />
            </div>
            <div class="d-flex justify-space-between mb-4">
              <div class="shimmer-line w-40" />
              <div class="shimmer-line w-30" />
            </div>
            <div
              class="shimmer-line w-100"
              style="height: 48px; border-radius: 8px;"
            />
          </VCard>
        </VCol>
      </VRow>
    </div>

    <VRow v-else>
      <!-- HEADER COMPRA -->
      <VCol
        cols="12"
        md="8"
      >
        <VCard class="elevation-3 rounded-xl mb-6">
          <VCardTitle class="px-6 pt-6 pb-2 text-h6 font-weight-bold">
            <VIcon
              start
              icon="ri-file-info-line"
            /> Datos de Factura
          </VCardTitle>
          <VCardText class="px-6 pb-6">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VAutocomplete
                  v-model="formData.supplier_id"
                  :items="suppliers"
                  item-title="name"
                  item-value="id"
                  label="Proveedor"
                  placeholder="Selecciona el proveedor"
                  variant="outlined"
                  density="comfortable"
                  :loading="isLoadingConfig"
                />

                <!-- Alerta de Saldo a Favor / NC disponible -->
                <VAlert
                  v-if="supplierAvailableCredit > 0"
                  type="info"
                  variant="tonal"
                  density="compact"
                  class="mt-2 rounded-lg"
                  icon="ri-hand-coin-line"
                >
                  <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                    <span class="text-caption">
                      Este proveedor tiene un <strong>Saldo a Favor de ${{ supplierAvailableCredit.toFixed(2) }}</strong>.
                    </span>
                    <VBtn
                      size="x-small"
                      variant="outlined"
                      color="info"
                      to="/invoice/reconciliation"
                      class="text-none font-weight-bold"
                    >
                      Ir a Conciliar
                    </VBtn>
                  </div>
                </VAlert>
              </VCol>
              <VCol
                cols="12"
                md="3"
              >
                <VTextField
                  v-model="formData.invoice_number"
                  label="N° Factura"
                  placeholder="001-001-0000123"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>
              <VCol
                cols="12"
                md="3"
              >
                <VTextField
                  v-model="formData.issue_date"
                  type="date"
                  label="Fecha de Emisión"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <!-- SELECCION DE PRODUCTOS -->
        <VCard class="elevation-3 rounded-xl">
          <VCardTitle class="px-6 pt-6 pb-2 d-flex align-center justify-space-between flex-wrap gap-2">
            <div class="text-h6 font-weight-bold d-flex align-center gap-2">
              <VIcon
                start
                icon="ri-box-3-line"
              /> Detalle de Productos
            </div>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="ri-add-line"
              class="rounded-lg"
              @click="openManualProductDialog('')"
            >
              Ingresar Producto Manual
            </VBtn>
          </VCardTitle>
          <VCardText class="px-6">
            <VAutocomplete
              v-model="searchProduct"
              :items="products"
              item-title="description"
              item-value="id"
              label="Buscar Producto para añadir..."
              placeholder="Escribe el nombre o SKU"
              variant="outlined"
              prepend-inner-icon="ri-search-line"
              return-object
              clearable
              class="mb-4"
              :menu-props="{ maxWidth: 0 }"
              :loading="isLoadingProducts"
              :disabled="!formData.supplier_id"
              @update:model-value="addProductToItems"
            >
              <template #no-data>
                <div class="pa-4 text-center">
                  <p class="text-medium-emphasis mb-2">
                    {{
                      formData.supplier_id ? '¿No encuentras el producto en el catálogo?'
                      : 'Seleccione un proveedor primero'
                    }}
                  </p>
                  <VBtn
                    v-if="formData.supplier_id"
                    color="primary"
                    variant="outlined"
                    size="small"
                    prepend-icon="ri-edit-box-line"
                    class="mt-1"
                    @click="openManualProductDialog(typeof searchProduct === 'string' ? searchProduct : '')"
                  >
                    Ingresar Producto Manualmente
                  </VBtn>
                </div>
              </template>
              <template #item="{ props, item }">
                <VListItem
                  v-bind="props"
                  :title="undefined"
                >
                  <VListItemTitle
                    style="white-space: normal !important; line-height: 1.4;"
                    class="font-weight-medium"
                  >
                    {{ item.raw.description || item.raw.name }}
                  </VListItemTitle>
                  <VListItemSubtitle class="mt-1 text-grey">
                    SKU: {{ item.raw.sku }} | Costo actual: ${{ parseFloat(item.raw.purchase_price).toFixed(2) }}
                  </VListItemSubtitle>
                </VListItem>
              </template>
            </VAutocomplete>

            <VTable class="manual-purchase-table border rounded-xl overflow-hidden">
              <thead>
                <tr class="bg-grey-lighten-4">
                  <th
                    class="text-left font-weight-bold py-3"
                    style="min-width: 240px;"
                  >
                    PRODUCTO
                  </th>
                  <th
                    class="text-center font-weight-bold py-3"
                    style="width: 110px;"
                  >
                    CANT.
                  </th>
                  <th
                    class="text-center font-weight-bold py-3"
                    style="width: 135px;"
                  >
                    P.U. (COSTO)
                  </th>
                  <th
                    class="text-center font-weight-bold py-3"
                    style="width: 125px;"
                  >
                    DCTO.
                  </th>
                  <th
                    class="text-right font-weight-bold py-3 pr-4"
                    style="width: 130px;"
                  >
                    SUBTOTAL
                  </th>
                  <th
                    class="text-center font-weight-bold py-3"
                    style="width: 80px;"
                  >
                    ACCIÓN
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="items.length === 0">
                  <td
                    colspan="6"
                    class="text-center py-10 text-medium-emphasis"
                  >
                    <VIcon
                      icon="ri-shopping-bag-3-line"
                      size="40"
                      class="mb-2 text-grey-lighten-1"
                    />
                    <div class="text-body-1 font-weight-medium">
                      No hay productos agregados a la compra
                    </div>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Busca en el catálogo o ingresa productos manualmente
                    </p>
                  </td>
                </tr>
                <tr
                  v-for="(item, index) in items"
                  :key="item.id"
                  class="purchase-item-row"
                >
                  <td class="py-4">
                    <div class="font-weight-bold text-high-emphasis text-body-1 d-flex align-center gap-2 flex-wrap">
                      <span>{{ item.description }}</span>
                      <VChip
                        v-if="item.is_manual"
                        size="x-small"
                        color="info"
                        variant="tonal"
                        class="font-weight-bold"
                      >
                        Manual
                      </VChip>
                    </div>
                    <div class="text-caption text-medium-emphasis mt-1 d-flex align-center gap-3 flex-wrap">
                      <span>SKU: <strong class="text-high-emphasis">{{ item.code }}</strong></span>
                      <span
                        v-if="getCategoryName(item.product_categorie_id)"
                        class="text-primary font-weight-medium"
                      >• {{ getCategoryName(item.product_categorie_id) }}</span>
                    </div>
                  </td>
                  <td class="text-center py-4">
                    <VTextField
                      v-model.number="item.quantity"
                      type="number"
                      min="0.01"
                      step="1"
                      variant="outlined"
                      density="compact"
                      hide-details
                      class="custom-number-input mx-auto"
                      style="width: 95px;"
                      @input="updateItemTotals(item)"
                    />
                  </td>
                  <td class="text-center py-4">
                    <VTextField
                      v-model.number="item.unit_price"
                      type="number"
                      min="0"
                      step="0.01"
                      prefix="$"
                      variant="outlined"
                      density="compact"
                      hide-details
                      class="custom-price-input mx-auto"
                      style="width: 125px;"
                      @input="updateItemTotals(item)"
                    />
                  </td>
                  <td class="text-center py-4">
                    <VTextField
                      v-model.number="item.discount"
                      type="number"
                      min="0"
                      step="0.01"
                      prefix="$"
                      variant="outlined"
                      density="compact"
                      hide-details
                      class="custom-price-input mx-auto"
                      style="width: 115px;"
                      @input="updateItemTotals(item)"
                    />
                  </td>
                  <td class="text-right py-4 text-body-1 font-weight-bold text-high-emphasis pr-4">
                    ${{ Number(item.subtotal - (item.discount || 0)).toFixed(2) }}
                  </td>
                  <td class="text-center py-4">
                    <VBtn
                      icon="ri-delete-bin-line"
                      color="error"
                      variant="tonal"
                      size="small"
                      class="rounded-lg"
                      @click="removeItem(index)"
                    />
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VCardText>
        </VCard>
      </VCol>

      <!-- SECCION FINANCIERA Y TOTALES -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard class="elevation-3 rounded-xl mb-6 border-primary border-opacity-50 border-s-4">
          <VCardTitle class="px-6 pt-6 pb-2 text-h6 font-weight-bold">
            <VIcon
              start
              icon="ri-money-dollar-circle-line"
            /> Origen de Fondos
          </VCardTitle>
          <VCardText class="px-6 pb-6">
            <VRadioGroup
              v-model="formData.payment_type"
              class="mb-4"
            >
              <VRadio
                label="Cuenta por Pagar (Crédito)"
                value="credito"
                color="primary"
              />
              <VRadio
                label="Pago Inmediato (Caja/Banco)"
                value="efectivo"
                color="success"
              />
              <VRadio
                label="Financiado por Socio (Aporte)"
                value="aporte"
                color="warning"
              />
            </VRadioGroup>

            <!-- Conditional Selectors -->
            <VExpandTransition>
              <div v-if="formData.payment_type === 'efectivo'">
                <VSelect
                  v-model="formData.account_id"
                  :items="accounts"
                  item-title="name"
                  item-value="id"
                  label="Seleccionar Cuenta de Egreso"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-bank-card-line"
                  :loading="isLoadingConfig"
                />
              </div>
            </VExpandTransition>

            <VExpandTransition>
              <div v-if="formData.payment_type === 'aporte'">
                <VSelect
                  v-model="formData.partner_id"
                  :items="partners"
                  item-title="nombre"
                  item-value="id"
                  label="Seleccionar Socio Capitalista"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="ri-user-star-line"
                  :loading="isLoadingConfig"
                />
              </div>
            </VExpandTransition>

            <VAlert
              v-if="formData.payment_type === 'credito'"
              color="primary"
              variant="tonal"
              icon="ri-information-line"
              class="mt-2 text-caption"
            >
              Se registrará la compra en el inventario y se creará una Cuenta por Pagar asociada al proveedor. No se
              descontará dinero de las cuentas aún.
            </VAlert>
          </VCardText>
        </VCard>

        <!-- RESUMEN TOTAL -->
        <VCard class="elevation-3 rounded-xl bg-grey-lighten-4">
          <VCardTitle class="px-6 pt-6 text-h6 font-weight-bold">
            Resumen
          </VCardTitle>
          <VCardText class="px-6">
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">Subtotal</span>
              <span class="font-weight-bold">${{ subtotal.toFixed(2) }}</span>
            </div>
            <div class="d-flex justify-space-between mb-4">
              <span class="text-medium-emphasis">Impuestos (IVA)</span>
              <span class="font-weight-bold">${{ totalTax.toFixed(2) }}</span>
            </div>
            <VDivider class="mb-4" />
            <div class="d-flex justify-space-between mb-6 align-center">
              <span class="text-h6 font-weight-bold">Total Compra</span>
              <span class="text-h4 font-weight-black text-primary">${{ grandTotal.toFixed(2) }}</span>
            </div>

            <VBtn
              block
              color="primary"
              size="x-large"
              elevation="4"
              :loading="isSubmitting"
              prepend-icon="ri-save-3-line"
              @click="submitPurchase"
            >
              Registrar Compra
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Modal Dialog para Agregar Producto Manual -->
    <VDialog
      v-model="isManualProductDialogOpen"
      scrollable
      max-width="600"
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isManualProductDialogOpen = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-add-box-line" />
          </div>
          <h3 class="custom-dialog-title">
            Ingresar Producto Manual
          </h3>
          <p class="custom-dialog-subtitle">
            Agrega un producto directamente a la compra
          </p>
        </div>

        <VCardText class="pa-4">
          <VRow dense>
            <VCol
              cols="12"
              class="mb-2"
            >
              <VTextField
                v-model="manualItem.description"
                label="Descripción / Nombre del Producto *"
                placeholder="Ej: Aceite Sintético 5W30 4L"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-text"
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
              class="mb-2"
            >
              <VTextField
                v-model="manualItem.code"
                label="Código / SKU"
                placeholder="Ej: PROD-101 (Opcional)"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-barcode-line"
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
              class="mb-2"
            >
              <VSelect
                v-model="manualItem.product_categorie_id"
                :items="categories"
                item-title="title"
                item-value="id"
                label="Categoría del Producto *"
                placeholder="Seleccione categoría"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-folders-line"
              />
            </VCol>

            <VCol
              cols="12"
              sm="4"
              class="mb-2"
            >
              <VTextField
                v-model.number="manualItem.quantity"
                type="number"
                min="0.01"
                step="1"
                label="Cantidad *"
                variant="outlined"
                density="comfortable"
              />
            </VCol>

            <VCol
              cols="12"
              sm="4"
              class="mb-2"
            >
              <VTextField
                v-model.number="manualItem.unit_price"
                type="number"
                min="0"
                step="0.01"
                prefix="$"
                label="Precio Unitario *"
                placeholder="0.00"
                variant="outlined"
                density="comfortable"
              />
            </VCol>

            <VCol
              cols="12"
              sm="4"
              class="mb-2"
            >
              <VTextField
                v-model.number="manualItem.discount"
                type="number"
                min="0"
                step="0.01"
                prefix="$"
                label="Descuento ($)"
                placeholder="0.00"
                variant="outlined"
                density="comfortable"
              />
            </VCol>

            <VCol cols="12">
              <VSwitch
                v-model="manualItem.is_taxable"
                label="Aplica IVA (15%)"
                color="primary"
                hide-details
              />
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />

        <VCardActions
          class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="isManualProductDialogOpen = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            prepend-icon="ri-add-line"
            class="rounded-lg px-6 font-weight-bold"
            height="40"
            @click="addManualProduct"
          >
            Añadir a la Compra
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.manual-purchase-table {
  border-color: rgba(var(--v-border-color), 0.12) !important;
}

.manual-purchase-table th {
  background-color: rgba(var(--v-theme-on-surface), 0.03) !important;
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.5px;
  height: 48px !important;
  vertical-align: middle !important;
  color: rgba(var(--v-theme-on-surface), 0.7) !important;
}

.manual-purchase-table td {
  vertical-align: middle !important;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.08) !important;
}

.purchase-item-row {
  transition: background-color 0.15s ease;
}

.purchase-item-row:hover {
  background-color: rgba(var(--v-theme-primary), 0.015);
}

.custom-number-input :deep(.v-field) {
  border-radius: 8px !important;
}

.custom-number-input :deep(.v-field__input) {
  text-align: center !important;
  font-weight: 700 !important;
  font-size: 0.95rem !important;
  padding-inline-start: 6px !important;
  padding-inline-end: 6px !important;
}

.custom-price-input :deep(.v-field) {
  border-radius: 8px !important;
}

.custom-price-input :deep(.v-field__input) {
  font-weight: 600 !important;
  font-size: 0.9rem !important;
  padding-inline-start: 4px !important;
  padding-inline-end: 8px !important;
}

.custom-price-input :deep(.v-field__prefix) {
  color: rgba(var(--v-theme-on-surface), 0.6) !important;
  font-weight: 600 !important;
  padding-inline-end: 2px !important;
}

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
