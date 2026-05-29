<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useDropZone, useFileDialog, useObjectUrl } from '@vueuse/core'
import { useRouter } from 'vue-router'

const dropZoneRef = ref()
const fileData = ref([])
const { open, reset, onChange } = useFileDialog({ accept: 'image/*', multiple: false })
const router = useRouter()

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

const descriptionRules = [requiredRule, minLengthRule(3), maxLengthRule(200)]
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

watch(() => product.value.discount_percentage, () => {
  if (product.value.discount_percentage > 0) {
    calculateMaxDiscount()
  } else {
    product.value.max_discount = 0
  }
})
onMounted(() => {
  loadInitialData()
})

const categories = ref([])
const warehouses = ref([])
const units = ref([])
const suppliers = ref([])

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
    if (!fileData.value || fileData.value.length === 0) {
      loader.stop()
      warning.value = 'Es obligatorio adjuntar una imagen para el producto.'
      showNotification('Falta la imagen del producto', 'warning')
      
      return
    }

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
    warehouse_id: isService ? null : (product.value.warehouse_id || 1),
    unit_id: product.value.unit_id || 1,
    supplier_id: product.value.supplier_id || 1,
    price: parseFloat(product.value.price_sale) || 0,
    price_sale: parseFloat(product.value.price_sale) || 0,
    purchase_price: isService ? 0 : (parseFloat(product.value.purchase_price) || 0),
    tax_rate: parseFloat(product.value.tax_rate) || 0,
    max_discount: parseFloat(product.value.max_discount) || 0,
    discount_percentage: parseFloat(product.value.discount_percentage) || 0,
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
    discount_percentage: 0, brand: '', stock: 0, item_type: null, min_stock: 0, max_stock: 0,
    is_taxable: true, is_gift: false, notes: '', state: 1, user_id: null,
  }
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
  } catch (error) {
    showNotification('Error al cargar configuración de productos', 'error')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="pa-4 pa-sm-6">
    <VCard class="rounded-lg elevation-2 max-w-1200 mx-auto overflow-hidden">
      <!-- Header -->
      <div class="pa-6 border-b bg-surface sticky-top d-flex justify-space-between align-center" style="z-index: 10;">
        <div class="d-flex align-center gap-4">
          <VAvatar color="primary" variant="tonal" rounded size="48">
            <VIcon icon="ri-price-tag-3-line" size="28" />
          </VAvatar>
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">Crear Producto</h1>
            <span class="text-body-2 text-medium-emphasis">Completa la información para registrar un nuevo producto en el catálogo</span>
          </div>
        </div>
        <VBtn color="primary" variant="tonal" prepend-icon="ri-arrow-left-line" to="/product/list">Volver al Listado</VBtn>
      </div>

      <VForm ref="formRef" @submit.prevent="store">
        <div class="pa-6 pb-12">

          <!-- 1. Información Básica -->
          <div class="mb-8">
            <div class="d-flex align-center gap-3 mb-5">
              <VAvatar color="info" variant="tonal" size="36"><VIcon icon="ri-information-line" /></VAvatar>
              <h2 class="text-h5 font-weight-medium m-0">Información Básica</h2>
            </div>
            
            <VRow>
              <VCol cols="12" md="6">
                <VTextField v-model="product.description" :rules="descriptionRules" label="Descripción del Producto" placeholder="Ej. AMORTIGUADOR CHEV. AVEO RH" variant="outlined" density="comfortable" prepend-inner-icon="ri-price-tag-3-line" hide-details="auto" required />
              </VCol>
              <VCol cols="12" md="6">
                <VTextField v-model="product.sku" :rules="skuRules" label="SKU" placeholder="Ej. LAP-001" variant="outlined" density="comfortable" prepend-inner-icon="ri-barcode-line" hide-details="auto" required />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField v-model="product.code_aux" :rules="codeAuxRules" label="Código Auxiliar" placeholder="Ej. PROD-001" variant="outlined" density="comfortable" prepend-inner-icon="ri-code-line" hide-details="auto" />
              </VCol>
              <VCol cols="12" md="4">
                <VTextField v-model="product.brand" :rules="brandRules" label="Marca" placeholder="Ej. MONROE" variant="outlined" density="comfortable" prepend-inner-icon="ri-building-line" hide-details="auto" />
              </VCol>
              <VCol cols="12" md="4">
                <VSelect v-model="product.item_type" :items="itemTypes" item-title="label" item-value="value" :rules="[requiredRule]" density="comfortable" variant="outlined" label="Tipo de Ítem" placeholder="Selecciona" prepend-inner-icon="ri-shapes-line" hide-details="auto" required />
              </VCol>
              <VCol cols="12">
                <VTextarea v-model="product.uses" label="Usos del Producto" placeholder="Ej. VEHÍCULO LIVIANO" variant="outlined" density="comfortable" prepend-inner-icon="ri-tools-line" hide-details="auto" rows="2" auto-grow />
              </VCol>
            </VRow>
          </div>

          <VDivider class="my-8" />

          <!-- 2. Clasificación -->
          <div class="mb-8">
            <div class="d-flex align-center gap-3 mb-5">
              <VAvatar color="warning" variant="tonal" size="36"><VIcon icon="ri-folder-3-line" /></VAvatar>
              <h2 class="text-h5 font-weight-medium m-0">Clasificación</h2>
            </div>
            
            <VRow>
              <VCol cols="12" sm="6">
                <VSelect v-model="product.product_categorie_id" :items="categories" item-title="title" item-value="id" :rules="[requiredRule]" density="comfortable" variant="outlined" label="Categoría" placeholder="Selecciona" prepend-inner-icon="ri-folder-3-line" hide-details="auto" required />
              </VCol>
              <VCol cols="12" sm="6" v-if="product.item_type !== '2'">
                <VSelect v-model="product.warehouse_id" :items="warehouses" item-title="name" item-value="id" :rules="product.item_type === '2' ? [] : [requiredRule]" density="comfortable" variant="outlined" label="Almacén" placeholder="Selecciona" prepend-inner-icon="ri-home-4-line" hide-details="auto" required />
              </VCol>
              <VCol cols="12" sm="6">
                <VSelect v-model="product.unit_id" :items="units" item-title="name" item-value="id" :rules="[requiredRule]" density="comfortable" variant="outlined" label="Unidad de Medida" placeholder="Selecciona" prepend-inner-icon="ri-ruler-line" hide-details="auto" required />
              </VCol>
              <VCol cols="12" sm="6">
                <VSelect v-model="product.supplier_id" :items="suppliers" item-title="name" item-value="id" density="comfortable" variant="outlined" label="Proveedor" placeholder="Selecciona" prepend-inner-icon="ri-truck-line" hide-details="auto" />
              </VCol>
            </VRow>
          </div>

                    <!-- 3. Precios e Inventario -->
          <div class="mb-8">
            <div class="d-flex align-center gap-3 mb-5">
              <VAvatar color="success" variant="tonal" size="36"><VIcon icon="ri-money-dollar-circle-line" /></VAvatar>
              <h2 class="text-h5 font-weight-medium m-0">Precios e Inventario</h2>
            </div>
            
            <VRow>
              <!-- Bloque Precios -->
              <VCol cols="12" :md="product.item_type === '2' ? '12' : '6'">
                <VCard variant="outlined" class="pa-4 h-100 rounded-lg">
                  <div class="text-subtitle-1 font-weight-bold mb-4">Configuración de Precio</div>
                  <VRow>
                    <VCol cols="12" sm="6" v-if="product.item_type !== '2'">
                      <VTextField v-model="product.purchase_price" :rules="product.item_type === '2' ? [] : priceRules" label="Precio de Compra" placeholder="0.00" variant="outlined" density="comfortable" prepend-inner-icon="ri-shopping-cart-line" hide-details="auto" type="number" step="0.01" min="0" />
                    </VCol>
                    <VCol cols="12" :sm="product.item_type === '2' ? '12' : '6'">
                      <VTextField v-model="product.price_sale" :rules="priceRules" label="Precio de Venta" placeholder="0.00" variant="outlined" density="comfortable" prepend-inner-icon="ri-price-tag-3-line" hide-details="auto" type="number" step="0.01" min="0" required />
                    </VCol>
                    <VCol cols="12" sm="6">
                      <VTextField v-model="product.discount_percentage" :rules="percentageRules" label="Descuento Max. (%)" placeholder="0" variant="outlined" density="comfortable" prepend-inner-icon="ri-percent-line" hide-details="auto" type="number" step="0.1" min="0" max="100" />
                    </VCol>
                    <VCol cols="12" sm="6">
                      <VTextField v-model="product.tax_rate" :rules="percentageRules" label="Impuesto (%)" placeholder="0" variant="outlined" density="comfortable" prepend-inner-icon="ri-receipt-line" hide-details="auto" type="number" step="0.1" min="0" max="100" readonly />
                    </VCol>
                  </VRow>
                </VCard>
              </VCol>

              <!-- Bloque Inventario -->
              <VCol cols="12" md="6" v-if="product.item_type !== '2'">
                <VCard variant="outlined" class="pa-4 h-100 rounded-lg">
                  <div class="text-subtitle-1 font-weight-bold mb-4">Control de Stock</div>
                  <VRow>
                    <VCol cols="12">
                      <VTextField v-model="product.stock" :rules="stockRules" label="Stock Inicial Actual" placeholder="0" variant="outlined" density="comfortable" prepend-inner-icon="ri-stack-line" hide-details="auto" type="number" step="0.01" min="0" required />
                    </VCol>
                    <VCol cols="12" sm="6">
                      <VTextField v-model="product.min_stock" :rules="stockRules" label="Stock Mínimo" placeholder="0" variant="outlined" density="comfortable" prepend-inner-icon="ri-arrow-down-line" hide-details="auto" type="number" step="0.01" min="0" />
                    </VCol>
                    <VCol cols="12" sm="6">
                      <VTextField v-model="product.max_stock" :rules="stockRules" label="Stock Máximo" placeholder="0" variant="outlined" density="comfortable" prepend-inner-icon="ri-arrow-up-line" hide-details="auto" type="number" step="0.01" min="0" />
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
              <VAvatar color="primary" variant="tonal" size="36"><VIcon icon="ri-image-line" /></VAvatar>
              <h2 class="text-h5 font-weight-medium m-0">Imagen y Extras</h2>
            </div>

            <VRow>
              <VCol cols="12" md="7">
                <div ref="dropZoneRef" class="cursor-pointer h-100" @click="() => open()">
                  <div v-if="fileData.length === 0" class="d-flex flex-column justify-center align-center gap-y-3 pa-8 border-2 border-dashed rounded-lg bg-grey-50 h-100 transition-swing" style="min-height: 250px" hover>
                    <VAvatar color="primary" variant="tonal" size="64">
                      <VIcon icon="ri-upload-cloud-2-line" size="32" />
                    </VAvatar>
                    <h4 class="text-h6 font-weight-medium">Subir Imagen Principal</h4>
                    <span class="text-caption text-medium-emphasis">Arrastra tu imagen o haz click para explorar</span>
                  </div>
                  <div v-else class="pa-4 border-2 border-dashed rounded-lg bg-grey-50 h-100">
                    <VCard v-for="(item, index) in fileData" :key="index" class="elevation-2" :ripple="false">
                      <VCardText class="pa-4 text-center" @click.stop>
                        <VImg :src="item.url" height="200px" class="rounded-lg mb-3 mx-auto bg-black" contain />
                        <div class="text-body-2 font-weight-medium mb-1 text-truncate">{{ item.file.name }}</div>
                        <div class="text-caption text-medium-emphasis">{{ (item.file.size / 1024).toFixed(2) }} KB</div>
                      </VCardText>
                      <VCardActions class="pa-4 pt-0">
                        <VBtn variant="tonal" block color="error" @click.stop="removeImage(index)">
                          <VIcon start icon="ri-delete-bin-line" /> Eliminar Imagen
                        </VBtn>
                      </VCardActions>
                    </VCard>
                  </div>
                </div>
              </VCol>
              
              <VCol cols="12" md="5">
                <VCard variant="outlined" class="pa-4 rounded-lg bg-grey-50 h-100 d-flex flex-column">
                  <div class="d-flex align-center justify-space-between mb-4">
                    <div class="d-flex align-center gap-3">
                      <VAvatar color="primary" variant="tonal" size="40"><VIcon icon="ri-receipt-line" /></VAvatar>
                      <span class="font-weight-medium">Gravable con Impuestos</span>
                    </div>
                    <VSwitch v-model="product.is_taxable" hide-details color="primary" />
                  </div>
                  <VDivider class="mb-4" />
                  <div class="d-flex align-center justify-space-between mb-4">
                    <div class="d-flex align-center gap-3">
                      <VAvatar color="info" variant="tonal" size="40"><VIcon icon="ri-gift-line" /></VAvatar>
                      <span class="font-weight-medium">¿Es un regalo?</span>
                    </div>
                    <VSwitch v-model="product.is_gift" hide-details color="info" />
                  </div>
                  <VTextarea class="mt-auto" v-model="product.notes" label="Notas Adicionales" placeholder="Observaciones..." variant="outlined" density="comfortable" prepend-inner-icon="ri-file-text-line" hide-details="auto" rows="3" auto-grow />
                </VCard>
              </VCol>
            </VRow>
          </div>

        </div>

        <VDivider />

        <!-- Sticky Footer -->
        <div class="pa-4 bg-surface sticky-bottom d-flex flex-column flex-sm-row justify-space-between align-center gap-4">
          <div class="d-flex flex-column gap-2 w-100 w-sm-auto flex-grow-1">
            <VAlert v-if="warning" color="warning" variant="tonal" closable density="compact" class="ma-0 text-caption">{{ warning }}</VAlert>
            <VAlert v-if="error_exist" color="error" variant="tonal" closable density="compact" class="ma-0 text-caption">{{ error_exist }}</VAlert>
          </div>
          <div class="d-flex gap-3 w-100 w-sm-auto justify-end">
            <VBtn variant="outlined" prepend-icon="ri-close-line" :disabled="isLoading" @click="router.push(backRoute)">
              Cancelar
            </VBtn>
            <VBtn type="submit" color="primary" variant="elevated" :loading="loader.loading" :disabled="loader.loading || isLoading" prepend-icon="ri-save-3-line">
              Crear Producto
            </VBtn>
          </div>
        </div>
      </VForm>
    </VCard>
  </div>
</template>

<style scoped>
.sticky-top {
  position: sticky;
  top: 0;
  z-index: 10;
}
.sticky-bottom {
  position: sticky;
  bottom: 0;
  z-index: 10;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
