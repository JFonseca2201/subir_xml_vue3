<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const router = useRouter()
const { showNotification } = useGlobalToast()

const isSubmitting = ref(false)
const isLoadingConfig = ref(false)
const isLoadingProducts = ref(false)

// Config data
const suppliers = ref([])
const categories = ref([])
const accounts = ref([])
const partners = ref([])
const products = ref([])

const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
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
    accounts.value = accountsResp.data || accountsResp || []

    // Partners returns object with data in many laravel resources
    partners.value = partnersResp.data?.data || partnersResp.data || []

  } catch (error) {
    console.error(error)
    showNotification('Error cargando configuraciones iniciales', 'error')
  } finally {
    isLoadingConfig.value = false
  }
}

// Watcher para buscar productos cuando cambia el proveedor
import { watch } from 'vue'

watch(() => formData.value.supplier_id, async (newSupplierId) => {
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

const addProductToItems = (product) => {
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
    is_taxable: product.is_taxable || 0
  })

  searchProduct.value = null
}

const updateItemTotals = (item) => {
  const qty = Number(item.quantity) || 0
  const price = Number(item.unit_price) || 0
  const disc = Number(item.discount) || 0

  item.subtotal = qty * price

  // Asumimos 15% de IVA si es taxable
  item.tax = item.is_taxable == 1 ? (item.subtotal - disc) * 0.15 : 0
  item.total = (item.subtotal - disc) + item.tax
}

const removeItem = (index) => {
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

  const payload = {
    ...formData.value,
    subtotal: subtotal.value,
    tax: totalTax.value,
    total: grandTotal.value,
    items: items.value
  }

  try {
    await $api('purchases/manual', {
      method: 'POST',
      body: payload
    })

    showNotification('Compra manual registrada correctamente', 'success')
    router.push('/invoice/list')
  } catch (error) {
    console.error(error)
    showNotification(error.response?._data?.message || 'Error al guardar la compra', 'error')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="pa-6">
    <VRow>
      <VCol cols="12" class="d-flex align-center justify-space-between mb-4">
        <div>
          <h2 class="text-h4 font-weight-bold d-flex align-center gap-3">
            <VIcon icon="ri-shopping-cart-2-line" color="primary" />
            Nueva Compra Manual
          </h2>
          <span class="text-medium-emphasis">Registra una factura física y actualiza stock/finanzas</span>
        </div>
        <VBtn variant="tonal" color="secondary" prepend-icon="ri-arrow-left-line" @click="router.back()">
          Regresar
        </VBtn>
      </VCol>
    </VRow>

    <VRow>
      <!-- HEADER COMPRA -->
      <VCol cols="12" md="8">
        <VCard class="elevation-3 rounded-xl mb-6">
          <VCardTitle class="px-6 pt-6 pb-2 text-h6 font-weight-bold">
            <VIcon start icon="ri-file-info-line" /> Datos de Factura
          </VCardTitle>
          <VCardText class="px-6 pb-6">
            <VRow>
              <VCol cols="12" md="6">
                <VAutocomplete v-model="formData.supplier_id" :items="suppliers" item-title="name" item-value="id"
                  label="Proveedor" placeholder="Selecciona el proveedor" variant="outlined" density="comfortable" 
                  :loading="isLoadingConfig" />
              </VCol>
              <VCol cols="12" md="3">
                <VTextField v-model="formData.invoice_number" label="N° Factura" placeholder="001-001-0000123"
                  variant="outlined" density="comfortable" />
              </VCol>
              <VCol cols="12" md="3">
                <VTextField v-model="formData.issue_date" type="date" label="Fecha de Emisión" variant="outlined"
                  density="comfortable" />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <!-- SELECCION DE PRODUCTOS -->
        <VCard class="elevation-3 rounded-xl">
          <VCardTitle class="px-6 pt-6 pb-2 d-flex align-center justify-space-between">
            <div class="text-h6 font-weight-bold">
              <VIcon start icon="ri-box-3-line" /> Detalle de Productos
            </div>
          </VCardTitle>
          <VCardText class="px-6">
            <VAutocomplete v-model="searchProduct" :items="products" item-title="description" item-value="id"
              label="Buscar Producto para añadir..." placeholder="Escribe el nombre o SKU" variant="outlined"
              prepend-inner-icon="ri-search-line" return-object clearable @update:model-value="addProductToItems"
              class="mb-4" :menu-props="{ maxWidth: 0 }" :loading="isLoadingProducts"
              :disabled="!formData.supplier_id">
              <template #no-data>
                <div class="pa-4 text-center text-medium-emphasis">
                  {{ formData.supplier_id ? 'No hay productos disponibles para este proveedor' : 'Seleccione un proveedor primero' }}
                </div>
              </template>
              <template #item="{ props, item }">
                <VListItem v-bind="props" :title="undefined">
                  <VListItemTitle style="white-space: normal !important; line-height: 1.4;" class="font-weight-medium">
                    {{ item.raw.description || item.raw.name }}
                  </VListItemTitle>
                  <VListItemSubtitle class="mt-1 text-grey">
                    SKU: {{ item.raw.sku }} | Costo actual: ${{ parseFloat(item.raw.purchase_price).toFixed(2) }}
                  </VListItemSubtitle>
                </VListItem>
              </template>
            </VAutocomplete>

            <VTable class="border rounded">
              <thead class="bg-grey-lighten-4">
                <tr>
                  <th style="width: 35%">Producto</th>
                  <th style="width: 10%">Cantidad</th>
                  <th style="width: 15%">Costo Unit.</th>
                  <th style="width: 15%">Desc.</th>
                  <th style="width: 15%">Subtotal</th>
                  <th style="width: 10%" class="text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="items.length === 0">
                  <td colspan="5" class="text-center py-8 text-medium-emphasis">
                    No hay productos agregados a la compra
                  </td>
                </tr>
                <tr v-for="(item, index) in items" :key="item.id">
                  <td>
                    <div class="font-weight-bold">{{ item.description }}</div>
                    <div class="text-caption text-medium-emphasis">SKU: {{ item.code }}</div>
                  </td>
                  <td>
                    <VTextField v-model.number="item.quantity" type="number" min="0.01" step="1" density="compact"
                      hide-details @input="updateItemTotals(item)" />
                  </td>
                  <td>
                    <VTextField v-model.number="item.unit_price" type="number" min="0" step="0.01" density="compact"
                      prefix="$" hide-details @input="updateItemTotals(item)" />
                  </td>
                  <td>
                    <VTextField v-model.number="item.discount" type="number" min="0" step="0.01" density="compact"
                      prefix="$" hide-details @input="updateItemTotals(item)" />
                  </td>
                  <td class="font-weight-bold">
                    ${{ Number(item.subtotal - (item.discount || 0)).toFixed(2) }}
                  </td>
                  <td class="text-center">
                    <VBtn icon="ri-delete-bin-line" color="error" variant="text" size="small"
                      @click="removeItem(index)" />
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VCardText>
        </VCard>
      </VCol>

      <!-- SECCION FINANCIERA Y TOTALES -->
      <VCol cols="12" md="4">
        <VCard class="elevation-3 rounded-xl mb-6 border-primary border-opacity-50 border-s-4">
          <VCardTitle class="px-6 pt-6 pb-2 text-h6 font-weight-bold">
            <VIcon start icon="ri-money-dollar-circle-line" /> Origen de Fondos
          </VCardTitle>
          <VCardText class="px-6 pb-6">
            <VRadioGroup v-model="formData.payment_type" class="mb-4">
              <VRadio label="Cuenta por Pagar (Crédito)" value="credito" color="primary" />
              <VRadio label="Pago Inmediato (Caja/Banco)" value="efectivo" color="success" />
              <VRadio label="Financiado por Socio (Aporte)" value="aporte" color="warning" />
            </VRadioGroup>

            <!-- Conditional Selectors -->
            <VExpandTransition>
              <div v-if="formData.payment_type === 'efectivo'">
                <VSelect v-model="formData.account_id" :items="accounts" item-title="name" item-value="id"
                  label="Seleccionar Cuenta de Egreso" variant="outlined" density="comfortable"
                  prepend-inner-icon="ri-bank-card-line" :loading="isLoadingConfig" />
              </div>
            </VExpandTransition>

            <VExpandTransition>
              <div v-if="formData.payment_type === 'aporte'">
                <VSelect v-model="formData.partner_id" :items="partners" item-title="nombre" item-value="id"
                  label="Seleccionar Socio Capitalista" variant="outlined" density="comfortable"
                  prepend-inner-icon="ri-user-star-line" :loading="isLoadingConfig" />
              </div>
            </VExpandTransition>

            <VAlert v-if="formData.payment_type === 'credito'" color="primary" variant="tonal"
              icon="ri-information-line" class="mt-2 text-caption">
              Se registrará la compra en el inventario y se creará una Cuenta por Pagar asociada al proveedor. No se
              descontará dinero de las cuentas aún.
            </VAlert>
          </VCardText>
        </VCard>

        <!-- RESUMEN TOTAL -->
        <VCard class="elevation-3 rounded-xl bg-grey-lighten-4">
          <VCardTitle class="px-6 pt-6 text-h6 font-weight-bold">Resumen</VCardTitle>
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

            <VBtn block color="primary" size="x-large" elevation="4" :loading="isSubmitting"
              prepend-icon="ri-save-3-line" @click="submitPurchase">
              Registrar Compra
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
.border-s-4 {
  border-left-width: 4px !important;
}
</style>
