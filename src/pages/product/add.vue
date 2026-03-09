<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useDropZone, useFileDialog, useObjectUrl } from '@vueuse/core'
const dropZoneRef = ref()
const fileData = ref([])
const { open, onChange } = useFileDialog({ accept: 'image/*', multiple: false })
function onDrop(DroppedFiles) {
  DroppedFiles?.forEach(file => {
    if (file.type.slice(0, 6) !== 'image/') {
      alert('Solo se permiten archivos tipo imagen.')
      return
    }
    fileData.value.push({
      file,
      url: useObjectUrl(file).value ?? '',
    })
  })
}
onChange(selectedFiles => {
  if (fileData.value.length == 1) {
    alert('Solo permite una imagen')
    return
  }
  if (!selectedFiles)
    return
  for (const file of selectedFiles) {
    fileData.value.push({
      file,
      url: useObjectUrl(file).value ?? '',
    })
  }
})
useDropZone(dropZoneRef, onDrop)

const loader = useLoaderStore()
const isLoading = ref(false);
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
const minLengthRule = (min) => v => !v || v.length >= min || `Mínimo ${min} caracteres`
const maxLengthRule = (max) => v => !v || v.length <= max || `Máximo ${max} caracteres`
const minValueRule = (min) => v => !v || parseFloat(v) >= min || `Mínimo ${min}`
const maxValueRule = (max) => v => !v || parseFloat(v) <= max || `Máximo ${max}`
const maxDecimalRule = (decimals) => v => !v || (v.toString().split('.')[1]?.length || 0) <= decimals || `Máximo ${decimals} decimales`
const maxPercentageRule = v => !v || parseFloat(v) <= 100 || 'Máximo 100%'

const descriptionRules = [requiredRule, minLengthRule(3), maxLengthRule(200)]
const skuRules = [requiredRule, minLengthRule(2), maxLengthRule(50)]
const codeAuxRules = [maxLengthRule(50)]
const brandRules = [maxLengthRule(250)]
const priceRules = [requiredRule, minValueRule(0), maxDecimalRule(2)]
const discountRules = [minValueRule(0), maxDecimalRule(2)]
const stockRules = [requiredRule, minValueRule(0), maxDecimalRule(2)]
const percentageRules = [minValueRule(0), maxPercentageRule]

const calculateMaxDiscount = () => {
  console.log('🔄 Calculando descuento máximo...')
  const purchasePrice = parseFloat(product.value.purchase_price) || 0
  const salePrice = parseFloat(product.value.price_sale) || 0
  const discountPercentage = parseFloat(product.value.discount_percentage) || 0
  product.value.max_discount = ((salePrice - purchasePrice) * discountPercentage / 100).toFixed(2)
}
watch(() => product.value.discount_percentage, () => {
  console.log(product.value.max_discount)
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
  { label: 'Herramienta', value: '3', name: 'tool' }
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

  /*   const productData = {
      description: product.value.description.toUpperCase().trim(),
      sku: product.value.sku.toUpperCase().trim(),
      code_aux: product.value.code_aux.toUpperCase().trim(),
      uses: product.value.uses,
      product_categorie_id: product.value.product_categorie_id || 1,
      warehouse_id: product.value.warehouse_id || 1,
      unit_id: product.value.unit_id || 1,
      supplier_id: product.value.supplier_id || 1,
  
      price: parseFloat(product.value.price) || 0,
      price_sale: parseFloat(product.value.price_sale) || 0,
      purchase_price: parseFloat(product.value.purchase_price) || 0,
      tax_rate: parseFloat(product.value.tax_rate) || 0,
      max_discount: parseFloat(product.value.max_discount) || 0,
      discount_percentage: parseFloat(product.value.discount_percentage) || 0,
  
      brand: product.value.brand.toUpperCase().trim(),
      stock: parseFloat(product.value.stock) || 0,
      item_type: parseInt(product.value.item_type) || 1,
      min_stock: parseFloat(product.value.min_stock) || 0,
      max_stock: parseFloat(product.value.max_stock) || 0,
  
      is_taxable: (product.value.is_taxable === true) ? "1" : "2",
      is_gift: (product.value.is_gift === true) ? "1" : "2",
  
      notes: product.value.notes.trim(),
      state: state.value,
    } */
  let formData = new FormData();
  formData.append("description", product.value.description);
  formData.append("sku", product.value.sku);
  formData.append("code_aux", product.value.code_aux);
  formData.append("uses", product.value.uses);
  formData.append("product_categorie_id", product.value.product_categorie_id);
  formData.append("warehouse_id", product.value.warehouse_id);
  formData.append("unit_id", product.value.unit_id);
  formData.append("supplier_id", product.value.supplier_id);
  formData.append("price", product.value.price_sale);
  formData.append("price_sale", product.value.price_sale);
  formData.append("purchase_price", product.value.purchase_price);
  formData.append("tax_rate", product.value.tax_rate);
  formData.append("max_discount", product.value.max_discount);
  formData.append("discount_percentage", product.value.discount_percentage);
  formData.append("brand", product.value.brand);
  formData.append("stock", product.value.stock);
  formData.append("item_type", product.value.item_type);
  formData.append("min_stock", product.value.min_stock);
  formData.append("max_stock", product.value.max_stock);
  formData.append("is_taxable", product.value.is_taxable === false ? "1" : "2");
  formData.append("is_gift", product.value.is_gift === false ? "1" : "2");
  formData.append("notes", product.value.notes);
  formData.append("state", state.value);
  formData.append("imagen", fileData.value[0].file);


  /*   formData.forEach((value, key) => {
      console.log(key, value);
    });
    loader.stop();
    return; */

  try {
    const resp = await $api("products", {
      method: "POST",
      body: formData,
      onResponseError({ response }) {
        console.error('❌ Error de la API:', response._data)
        error_exist.value = response._data.error;
      },
    });
    console.log(resp);
    showNotification('Producto creado exitosamente', 'success')

    setTimeout(() => {
      onFormReset()
    }, 1000)

  } catch (error) {
    console.error('Error al crear producto:', error)
    showNotification('Error al crear producto', 'error')
  } finally {
    loader.stop()
  }
}


// Resetear formulario
const onFormReset = () => {
  product.value = {
    id: null,
    description: '',
    sku: '',
    imagen: null,
    code_aux: '',
    uses: '',
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

  };
  fileData.value = [];
  warning.value = null;
  error_exist.value = null;
}

// Cargar datos iniciales (cuando esté listo el endpoint)
const loadInitialData = async () => {
  isLoading.value = true;
  try {
    const resp = await $api(`products/config`, {
      method: "GET",
      onResponseError({ response }) {
        console.log('Error al cargar configuración de productos:', response._data.error);
        showNotification('Error al cargar configuración de productos', 'error');
      },
    });
    console.log('Configuración de productos cargada:', resp);
    units.value = resp.data.units || [];
    categories.value = resp.data.categories || [];
    warehouses.value = resp.data.warehouses || [];
    suppliers.value = resp.data.suppliers || [];

    showNotification('Configuración cargada exitosamente', 'success');
  } catch (error) {
    console.error('Error cargando configuración de productos:', error)
    showNotification('Error al cargar configuración de productos', 'error');
  } finally {
    isLoading.value = false;
  }
}

</script>
<template>
  <!-- Overlay global -->
  <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
    <VProgressCircular indeterminate size="48" width="4" color="primary" />
  </VOverlay>

  <div class="pa-4 pa-sm-6">
    <VCard class="pa-6 pa-sm-8 rounded-lg elevation-4 max-w-1200 mx-auto">
      <!-- Header -->
      <div class="d-flex justify-space-between align-center mb-6 pb-4 border-b">
        <h1 class="text-h4 font-weight-bold mb-1">
          Crear Nuevo Producto
        </h1>
        <VBtn color="primary" variant="elevated" prepend-icon="ri-arrow-left-line" to="/product/list">
          Volver al Listado
        </VBtn>
      </div>

      <!-- Formulario -->
      <VForm ref="formRef" @submit.prevent="store">
        <!-- Información Básica -->
        <div class="mb-6">
          <h2 class="text-h6 font-weight-medium mb-4">
            Información Básica
          </h2>
          <VRow>
            <VCol cols="12" md="6">
              <VTextField v-model="product.description" :rules="descriptionRules" label="Descripción del Producto"
                placeholder="Ej. AMORTIGUADOR CHEV. AVEO RH" variant="outlined" density="comfortable"
                prepend-inner-icon="ri-price-tag-3-line" hide-details="auto" required />
            </VCol>

            <VCol cols="12" md="6">
              <VTextField v-model="product.sku" :rules="skuRules" label="SKU" placeholder="Ej. LAP-001"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-barcode-line" hide-details="auto"
                required />
            </VCol>

            <VCol cols="12" md="4">
              <VTextField v-model="product.code_aux" :rules="codeAuxRules" label="Código Auxiliar"
                placeholder="Ej. PROD-001" variant="outlined" density="comfortable" prepend-inner-icon="ri-code-line"
                hide-details="auto" />
            </VCol>

            <VCol cols="12" md="4">
              <VTextField v-model="product.brand" :rules="brandRules" label="Marca" placeholder="Ej. MONROE"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-building-line" hide-details="auto" />
            </VCol>

            <VCol cols="12" md="4">
              <VSelect :items="itemTypes" item-title="label" item-value="value" v-model="product.item_type"
                :rules="[requiredRule]" density="comfortable" variant="outlined" label="Tipo de Ítem"
                placeholder="Selecciona" prepend-inner-icon="ri-shapes-line" hide-details="auto" required />
            </VCol>

            <VCol cols="12">
              <VTextarea v-model="product.uses" label="Usos del Producto" placeholder="Ej.VEHÍCULO LIVIANO"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-tools-line" hide-details="auto" rows="3"
                auto-grow />
            </VCol>
          </VRow>
        </div>

        <!-- Clasificación -->
        <div class="mb-6">
          <h2 class="text-h6 font-weight-medium mb-4">
            Clasificación
          </h2>
          <VRow>
            <VCol cols="12" sm="6">
              <VSelect :items="categories" item-title="title" item-value="id" v-model="product.product_categorie_id"
                :rules="[requiredRule]" density="comfortable" variant="outlined" label="Categoría"
                placeholder="Selecciona" prepend-inner-icon="ri-folder-3-line" hide-details="auto" required />
            </VCol>

            <VCol cols="12" sm="6">
              <VSelect :items="warehouses" item-title="name" item-value="id" v-model="product.warehouse_id"
                :rules="[requiredRule]" density="comfortable" variant="outlined" label="Almacén"
                placeholder="Selecciona" prepend-inner-icon="ri-home-4-line" hide-details="auto" required />
            </VCol>

            <VCol cols="12" sm="6">
              <VSelect :items="units" item-title="name" item-value="id" v-model="product.unit_id"
                :rules="[requiredRule]" density="comfortable" variant="outlined" label="Unidad de Medida"
                placeholder="Selecciona" prepend-inner-icon="ri-ruler-line" hide-details="auto" required />
            </VCol>

            <VCol cols="12" sm="6">
              <VSelect :items="suppliers" item-title="name" item-value="id" v-model="product.supplier_id"
                density="comfortable" variant="outlined" label="Proveedor" placeholder="Selecciona"
                prepend-inner-icon="ri-truck-line" hide-details="auto" />
            </VCol>

            <VCol cols="12" sm="6">
              <VTextField v-model="product.tax_rate" :rules="percentageRules" label="Impuesto (%)" placeholder="0"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-receipt-line" hide-details="auto"
                type="number" step="0.1" min="0" max="100" readonly />
            </VCol>
          </VRow>
        </div>

        <!-- Precios y Descuentos -->
        <div class="mb-6">
          <h2 class="text-h6 font-weight-medium mb-4">
            Precios y Descuentos
          </h2>
          <VRow>
            <VCol cols="12" sm="4">
              <VTextField v-model="product.price_sale" :rules="priceRules" label="Precio de Venta" placeholder="0.00"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-price-tag-3-line" hide-details="auto"
                type="number" step="0.01" min="0" required />
            </VCol>

            <VCol cols="12" sm="4">
              <VTextField v-model="product.purchase_price" :rules="priceRules" label="Precio de Compra"
                placeholder="0.00" variant="outlined" density="comfortable" prepend-inner-icon="ri-shopping-cart-line"
                hide-details="auto" type="number" step="0.01" min="0" />
            </VCol>

            <VCol cols="12" sm="4">
              <VTextField v-model="product.discount_percentage" :rules="percentageRules" label="Descuento Porcentual"
                placeholder="0" variant="outlined" density="comfortable" prepend-inner-icon="ri-percent-line"
                hide-details="auto" type="number" step="0.1" min="0" max="100" />
            </VCol>

            <VCol cols="12" sm="4">
              <VTextField v-model="product.max_discount" :rules="discountRules" label="Descuento Máximo"
                placeholder="0.00" variant="outlined" density="comfortable" prepend-inner-icon="ri-price-tag-2-line"
                hide-details="auto" type="number" step="0.01" min="0" readonly />
            </VCol>
          </VRow>
        </div>

        <!-- Inventario -->
        <div class="mb-6">
          <h2 class="text-h6 font-weight-medium mb-4">
            Inventario
          </h2>
          <VRow>
            <VCol cols="12" sm="4">
              <VTextField v-model="product.stock" :rules="stockRules" label="Stock Actual" placeholder="0"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-stack-line" hide-details="auto"
                type="number" step="0.01" min="0" required />
            </VCol>

            <VCol cols="12" sm="4">
              <VTextField v-model="product.min_stock" :rules="stockRules" label="Stock Mínimo" placeholder="0"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-arrow-down-line" hide-details="auto"
                type="number" step="0.01" min="0" />
            </VCol>

            <VCol cols="12" sm="4">
              <VTextField v-model="product.max_stock" :rules="stockRules" label="Stock Máximo" placeholder="0"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-arrow-up-line" hide-details="auto"
                type="number" step="0.01" min="0" />
            </VCol>
          </VRow>
        </div>

        <!-- Imagen y Configuración -->
        <div class="mb-6">
          <h2 class="text-h6 font-weight-medium mb-4">
            Imagen y Configuración
          </h2>
          <VRow>
            <!-- Imagen -->
            <VCol cols="12" md="6">
              <div ref="dropZoneRef" class="cursor-pointer" @click="() => open()">
                <div v-if="fileData.length === 0"
                  class="d-flex flex-column justify-center align-center gap-y-3 pa-8 border-2 border-dashed rounded-lg">
                  <VIcon icon="ri-upload-2-line" size="48" color="primary" />
                  <h4 class="text-h6 font-weight-medium">
                    Arrastra y suelte su imagen aquí
                  </h4>
                  <span class="text-medium-emphasis">ó</span>
                  <VBtn variant="outlined" size="small">
                    Buscar imagen
                  </VBtn>
                </div>

                <div v-else class="pa-4 border-2 border-dashed rounded-lg">
                  <VRow>
                    <template v-for="(item, index) in fileData" :key="index">
                      <VCol cols="12">
                        <VCard class="elevation-2" :ripple="false">
                          <VCardText class="pa-4" @click.stop>
                            <VImg :src="item.url" width="100%" height="200px" class="rounded-lg mb-3" />
                            <div class="text-center">
                              <div class="text-body-2 font-weight-medium mb-1">
                                {{ item.file.name }}
                              </div>
                              <div class="text-caption text-medium-emphasis">
                                {{ (item.file.size / 1024).toFixed(2) }} KB
                              </div>
                            </div>
                          </VCardText>
                          <VCardActions class="pa-4 pt-0">
                            <VBtn variant="text" block color="error" @click.stop="fileData.splice(index, 1)">
                              <VIcon start icon="ri-delete-bin-line" />
                              Eliminar Imagen
                            </VBtn>
                          </VCardActions>
                        </VCard>
                      </VCol>
                    </template>
                  </VRow>
                </div>
              </div>
            </VCol>

            <!-- Configuración Adicional -->
            <VCol cols="12" md="6">
              <div class="d-flex flex-column gap-4">
                <div class="d-flex align-center justify-space-between pa-3 border rounded-lg">
                  <div class="d-flex align-center gap-3">
                    <VIcon icon="ri-receipt-line" />
                    <span>Gravable con Impuestos</span>
                  </div>
                  <VSwitch v-model="product.is_taxable" hide-details />
                </div>

                <div class="d-flex align-center justify-space-between pa-3 border rounded-lg">
                  <div class="d-flex align-center gap-3">
                    <VIcon icon="ri-gift-line" />
                    <span>¿Es un regalo?</span>
                  </div>
                  <VSwitch v-model="product.is_gift" hide-details />
                </div>

                <VTextarea v-model="product.notes" label="Notas Adicionales"
                  placeholder="Ingresa cualquier nota o descripción adicional del producto..." variant="outlined"
                  density="comfortable" prepend-inner-icon="ri-file-text-line" hide-details="auto" rows="4" auto-grow />
              </div>
            </VCol>
          </VRow>
        </div>

        <!-- Alertas -->
        <div class="mb-6">
          <VAlert v-if="warning" color="warning" variant="tonal" closable class="mb-3">
            {{ warning }}
          </VAlert>

          <VAlert v-if="error_exist" color="error" variant="tonal" closable>
            {{ error_exist }}
          </VAlert>
        </div>

        <!-- Botones de Acción -->
        <div class="d-flex justify-end gap-3">
          <VBtn variant="outlined" @click="onFormReset" prepend-icon="ri-close-line" :disabled="isLoading">
            Cancelar
          </VBtn>

          <VBtn type="submit" color="primary" variant="elevated" :loading="loader.loading"
            :disabled="loader.loading || isLoading" prepend-icon="ri-save-3-line">
            {{ product.id ? 'Actualizar Producto' : 'Crear Producto' }}
          </VBtn>
        </div>
      </VForm>
    </VCard>
  </div>
</template>

<style scoped>
/* Drop zone simple */
.drop-zone {
  border: 2px dashed rgba(var(--v-theme-primary), 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
}

.drop-zone:hover {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.05);
}

/* Utilidades básicas */
.position-relative {
  position: relative;
}

.position-absolute {
  position: absolute;
}

.top-0 {
  top: 0;
}

.right-0 {
  right: 0;
}
</style>
