<template>
  <VDialog :model-value="dialog" max-width="900px" persistent>
    <VCard class="product-view-card">
      <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-grey-lighten-4 border-b">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-shopping-bag-3-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-h6 font-weight-bold text-high-emphasis">Ficha del Producto</div>
            <div class="text-caption text-medium-emphasis">Detalle completo e información de inventario</div>
          </div>
        </div>
        <VBtn icon="ri-close-line" variant="tonal" color="secondary" size="large" @click="$emit('update:dialog', false)" />
      </VCardTitle>
      <VDivider />

      <VCardText v-if="product" class="pa-6" style="background-color: #fbfbfb;">
        
        <!-- CABECERA: Imagen y Título -->
        <div class="d-flex flex-column flex-sm-row align-center align-sm-start gap-6 mb-6 bg-white pa-4 rounded-lg elevation-1">
          <div class="cursor-pointer image-container position-relative rounded-lg overflow-hidden border" 
               style="width: 140px; height: 140px; flex-shrink: 0;" @click="openImageDialog">
            <VImg v-if="product.imagen" :src="product.imagen" width="100%" height="100%" cover />
            <div v-else class="d-flex align-center justify-center w-100 h-100 bg-grey-lighten-4">
              <VIcon icon="ri-image-line" size="48" color="grey-lighten-1" />
            </div>
            <div class="image-overlay position-absolute top-0 left-0 w-100 h-100 d-flex flex-column align-center justify-center bg-black" style="opacity: 0; transition: opacity 0.2s;">
              <VIcon icon="ri-zoom-in-line" size="28" color="white" />
            </div>
          </div>

          <div class="flex-grow-1 text-center text-sm-left">
            <h2 class="text-h5 font-weight-bold text-high-emphasis mb-1" style="line-height: 1.2;">
              {{ product.description }}
            </h2>
            <div class="text-subtitle-1 text-medium-emphasis mb-4">
              SKU: <span class="font-weight-medium">{{ product.sku }}</span>
            </div>
            
            <div class="d-flex flex-wrap gap-2 justify-center justify-sm-start">
              <VChip :color="product.state === 1 ? 'success' : 'error'" size="small" variant="flat" class="font-weight-bold">
                {{ product.state === 1 ? 'Activo' : 'Inactivo' }}
              </VChip>
              <VChip :color="product.item_type == 1 ? 'primary' : 'secondary'" size="small" variant="tonal" class="font-weight-bold">
                {{ product.item_type == 1 ? 'Producto' : 'Servicio' }}
              </VChip>
              <VChip v-if="product.is_taxable" color="info" size="small" variant="tonal" class="font-weight-bold">
                Aplica IVA ({{ product.tax_rate }}%)
              </VChip>
              <VChip v-if="product.is_gift === 1" color="warning" size="small" variant="tonal" class="font-weight-bold">
                <VIcon icon="ri-gift-line" start size="14"/> Regalo
              </VChip>
            </div>
          </div>
        </div>

        <!-- SECCIÓN: PRECIOS (Ultra simple e intuitivo) -->
        <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3">
          <VIcon icon="ri-money-dollar-circle-line" color="success" class="mr-1" /> Precios
        </h3>
        <VRow class="mb-6">
          <!-- Precio Compra -->
          <VCol v-if="product.item_type == 1" cols="12" sm="6">
            <VCard variant="outlined" class="bg-white border text-center h-100 pa-4" style="border-color: #e0e0e0 !important;">
              <div class="text-overline text-medium-emphasis mb-2">Costo de Compra</div>
              <div class="d-flex justify-center align-center">
                <div class="px-4">
                  <div class="text-caption text-medium-emphasis">Sin IVA</div>
                  <div class="text-h6">${{ Number(product.purchase_price || 0).toFixed(2) }}</div>
                </div>
                <VDivider vertical style="height: 40px;" />
                <div class="px-4">
                  <div class="text-caption text-primary font-weight-bold">Con IVA</div>
                  <div class="text-h5 text-primary font-weight-bold">
                    ${{ (Number(product.purchase_price || 0) * (1 + Number(product.tax_rate || 0) / 100)).toFixed(2) }}
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Precio Venta -->
          <VCol cols="12" :sm="product.item_type == 1 ? 6 : 12">
            <VCard variant="outlined" class="bg-success-lighten-5 text-center h-100 pa-4" style="border-color: #81C784 !important;">
              <div class="text-overline text-success font-weight-bold mb-2">Precio de Venta Público</div>
              <div class="d-flex justify-center align-center">
                <div class="px-4">
                  <div class="text-caption text-success">Sin IVA</div>
                  <div class="text-h6 text-success">${{ Number(product.price_sale || 0).toFixed(2) }}</div>
                </div>
                <VDivider vertical color="success" style="height: 40px; opacity: 0.3;" />
                <div class="px-4">
                  <div class="text-caption text-success font-weight-bold">Con IVA</div>
                  <div class="text-h4 text-success font-weight-black">
                    ${{ (Number(product.price_sale || 0) * (1 + Number(product.tax_rate || 0) / 100)).toFixed(2) }}
                  </div>
                </div>
              </div>
            </VCard>
          </VCol>

          <!-- Descuento (Si aplica) -->
          <VCol cols="12" v-if="product.max_discount > 0 || product.discount_percentage > 0">
            <VCard variant="outlined" class="bg-error-lighten-5 border-error border-opacity-25 pa-3 d-flex align-center justify-center gap-4">
              <span class="text-error font-weight-medium">Descuento Máximo Permitido:</span>
              <span class="text-h6 text-error font-weight-bold">
                ${{ product.item_type == 1 ? Number(product.max_discount || 0).toFixed(2) : (Number(product.price_sale || 0) * (Number(product.discount_percentage || 0) / 100)).toFixed(2) }}
              </span>
              <VChip v-if="product.discount_percentage > 0" color="error" size="small" variant="flat">{{ product.discount_percentage }}% OFF</VChip>
            </VCard>
          </VCol>
        </VRow>

        <!-- SECCIÓN: INVENTARIO Y GENERAL -->
        <VRow>
          <!-- Inventario -->
          <VCol v-if="product.item_type == 1" cols="12" md="6">
            <VCard variant="flat" class="bg-white rounded-lg elevation-1 h-100">
              <VCardTitle class="text-subtitle-1 font-weight-bold border-b py-3">
                <VIcon icon="ri-archive-line" color="warning" class="mr-1" size="20"/> Inventario
              </VCardTitle>
              <VCardText class="pa-4">
                <div class="d-flex align-center justify-space-between mb-4 bg-grey-lighten-4 pa-3 rounded">
                  <span class="font-weight-medium">Stock Actual</span>
                  <span class="text-h5 font-weight-black" :class="getStockClassText(product.stock, product.min_stock)">
                    {{ product.stock || 0 }}
                  </span>
                </div>
                <VList density="compact" class="pa-0">
                  <VListItem class="px-0 border-b">
                    <template #prepend><span class="text-body-2 text-medium-emphasis" style="width: 120px;">Stock Mín/Máx</span></template>
                    <div class="text-body-2 font-weight-medium text-right">{{ product.min_stock || 0 }} - {{ product.max_stock || 0 }}</div>
                  </VListItem>
                  <VListItem class="px-0 border-b">
                    <template #prepend><span class="text-body-2 text-medium-emphasis" style="width: 120px;">Unidad</span></template>
                    <div class="text-body-2 font-weight-medium text-right">{{ product.unit?.name || 'N/A' }}</div>
                  </VListItem>
                  <VListItem class="px-0">
                    <template #prepend><span class="text-body-2 text-medium-emphasis" style="width: 120px;">Almacén</span></template>
                    <div class="text-body-2 font-weight-medium text-right">{{ product.warehouse?.name || 'General' }}</div>
                  </VListItem>
                </VList>
              </VCardText>
            </VCard>
          </VCol>

          <!-- General -->
          <VCol cols="12" :md="product.item_type == 1 ? 6 : 12">
            <VCard variant="flat" class="bg-white rounded-lg elevation-1 h-100">
              <VCardTitle class="text-subtitle-1 font-weight-bold border-b py-3">
                <VIcon icon="ri-information-line" color="primary" class="mr-1" size="20"/> Datos Generales
              </VCardTitle>
              <VCardText class="pa-4">
                <VList density="compact" class="pa-0">
                  <VListItem class="px-0 border-b">
                    <template #prepend><span class="text-body-2 text-medium-emphasis" style="width: 120px;">Categoría</span></template>
                    <div class="text-body-2 font-weight-medium text-right">{{ product.categorie?.title || 'Sin categoría' }}</div>
                  </VListItem>
                  <VListItem class="px-0 border-b">
                    <template #prepend><span class="text-body-2 text-medium-emphasis" style="width: 120px;">Marca</span></template>
                    <div class="text-body-2 font-weight-medium text-right">{{ product.brand || 'Sin marca' }}</div>
                  </VListItem>
                  <VListItem class="px-0 border-b">
                    <template #prepend><span class="text-body-2 text-medium-emphasis" style="width: 120px;">Proveedor</span></template>
                    <div class="text-body-2 font-weight-medium text-right">{{ product.supplier?.name || 'Sin proveedor' }}</div>
                  </VListItem>
                  <VListItem class="px-0">
                    <template #prepend><span class="text-body-2 text-medium-emphasis" style="width: 120px;">Cód. Auxiliar</span></template>
                    <div class="text-body-2 font-weight-medium text-right">{{ product.code_aux || 'N/A' }}</div>
                  </VListItem>
                </VList>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>

        <!-- Notas -->
        <VRow v-if="product.notes" class="mt-2">
          <VCol cols="12">
            <VCard variant="flat" class="bg-white rounded-lg elevation-1">
              <VCardTitle class="text-subtitle-2 font-weight-bold border-b py-2">Notas Adicionales</VCardTitle>
              <VCardText class="pa-4 text-body-2" style="white-space: pre-line;">
                {{ product.notes }}
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>
      <VDivider />

      <VCardActions class="pa-4 bg-grey-lighten-4 border-t justify-end">
        <VBtn variant="tonal" color="secondary" rounded="lg" prepend-icon="ri-close-line" @click="$emit('update:dialog', false)">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Diálogo de Imagen con Zoom -->
  <VDialog v-model="imageDialog" max-width="700" persistent content-class="image-dialog">
    <VCard class="image-view-card">
      <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-grey-lighten-4 border-b">
        <div class="d-flex align-center gap-3">
          <VAvatar color="info" variant="tonal" rounded="lg">
            <VIcon icon="ri-image-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ product?.description || 'Producto' }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ product?.item_type == 1 ? 'Producto' : 'Servicio' }} • Click y arrastra para hacer zoom
            </div>
          </div>
        </div>
        <VBtn icon="ri-close-line" variant="tonal" color="secondary" size="large" @click="imageDialog = false" />
      </VCardTitle>
      <VDivider />

      <VCardText class="pa-4 image-container-zoom">
        <div ref="zoomWrapper" class="zoom-wrapper">
          <VImg v-if="product?.imagen" :src="product.imagen" class="zoom-image" :style="zoomStyle" @wheel="handleZoom"
            @mousedown="startDrag" @mousemove="drag" @mouseup="endDrag" @mouseleave="endDrag" />
          <div v-else class="no-image-placeholder">
            <VIcon icon="ri-image-line" size="100" color="grey-lighten-1" />
            <div class="text-h6 mt-4 text-medium-emphasis">
              Sin imagen disponible
            </div>
            <div class="text-caption text-medium-emphasis mt-2">
              Este producto no tiene una imagen asociada
            </div>
          </div>
        </div>

        <!-- Controles de Zoom -->
        <div v-if="product?.imagen" class="zoom-controls">
          <VBtn icon="ri-zoom-out-line" variant="elevated" size="small" class="mr-2" @click="zoomOut" />
          <div class="zoom-level">
            {{ Math.round(zoomLevel * 100) }}%
          </div>
          <VBtn icon="ri-zoom-in-line" variant="elevated" size="small" class="ml-2" @click="zoomIn" />
          <VBtn icon="ri-refresh-line" variant="outlined" size="small" class="ml-2" @click="resetZoom" />
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-grey-lighten-5">
        <VSpacer />
        <VBtn variant="elevated" prepend-icon="ri-close-line" @click="imageDialog = false">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<script setup>
import { ref, computed } from 'vue'

// Props
const props = defineProps({
  dialog: {
    type: Boolean,
    default: false,
  },
  product: {
    type: Object,
    default: null,
  },
})

// Emits
const emit = defineEmits(['update:dialog'])

// Refs
const imageDialog = ref(false)
const zoomWrapper = ref(null)

// Zoom state
const zoomLevel = ref(1)
const position = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

// Methods
const openImageDialog = () => {
  imageDialog.value = true
  resetZoom()
}

const getStockClassText = (stock, minStock) => {
  if (stock === 0) return 'text-error'
  if (stock <= minStock) return 'text-warning'
  return 'text-success'
}

const formatDate = dateString => {
  if (!dateString) return 'No disponible'
  try {
    const date = new Date(dateString)

    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch (error) {
    return dateString
  }
}

// Zoom functionality
const zoomStyle = computed(() => ({
  transform: `scale(${zoomLevel.value}) translate(${position.value.x}px, ${position.value.y}px)`,
  transition: isDragging.value ? 'none' : 'transform 0.3s ease',
  cursor: isDragging.value ? 'grabbing' : 'grab',
}))

const handleZoom = event => {
  event.preventDefault()

  const delta = event.deltaY > 0 ? -0.1 : 0.1
  const newZoom = Math.max(0.5, Math.min(3, zoomLevel.value + delta))

  if (newZoom !== zoomLevel.value) {
    zoomLevel.value = newZoom

    // Center the zoom on mouse position
    const rect = zoomWrapper.value?.getBoundingClientRect()
    if (rect) {
      const x = event.clientX - rect.left - rect.width / 2
      const y = event.clientY - rect.top - rect.height / 2

      position.value = {
        x: -x * (newZoom - 1) / newZoom,
        y: -y * (newZoom - 1) / newZoom,
      }
    }
  }
}

const startDrag = event => {
  isDragging.value = true
  dragStart.value = {
    x: event.clientX - position.value.x,
    y: event.clientY - position.value.y,
  }
  event.preventDefault()
}

const drag = event => {
  if (!isDragging.value) return

  position.value = {
    x: event.clientX - dragStart.value.x,
    y: event.clientY - dragStart.value.y,
  }
}

const endDrag = () => {
  isDragging.value = false
}

const zoomIn = () => {
  zoomLevel.value = Math.min(3, zoomLevel.value + 0.2)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.2)
}

const resetZoom = () => {
  zoomLevel.value = 1
  position.value = { x: 0, y: 0 }
}
</script>

<style scoped>
.image-container:hover .image-overlay {
  opacity: 0.5 !important;
}
</style>
