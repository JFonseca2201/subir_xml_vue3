<template>
  <VDialog :model-value="dialog" max-width="900px" persistent @update:model-value="$emit('update:dialog', $event)">
    <VCard class="product-view-card">
      <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-primary-lighten-1">
        <div class="d-flex align-center gap-2">
          <VAvatar color="primary" variant="tonal">
            <VIcon icon="ri-eye-line" />
          </VAvatar>
          <div>
            <div class="text-h6 font-weight-bold">
              Detalles del Producto
            </div>
            <div class="text-caption text-medium-emphasis">
              Información completa del producto
            </div>
          </div>
        </div>
        <VBtn icon="ri-close-line" variant="text" @click="$emit('update:dialog', false)" />
      </VCardTitle>
      <VDivider />

      <VCardText v-if="product" class="pa-6">
        <!-- Imagen Principal -->
        <VRow class="mb-6">
          <VCol cols="12" md="4">
            <div class="text-center">
              <div class="cursor-pointer image-container" @click="openImageDialog">
                <VAvatar v-if="product.imagen" :image="product.imagen" size="140"
                  class="elevation-6 mb-3 product-avatar" />
                <VAvatar v-else color="grey-lighten-3" size="140" class="elevation-6 mb-3 product-avatar">
                  <VIcon icon="ri-image-line" size="70" color="grey-lighten-1" />
                </VAvatar>
                <div class="image-overlay">
                  <VIcon icon="ri-zoom-in-line" size="24" color="white" />
                  <div class="text-caption text-white mt-1">
                    Click para ampliar
                  </div>
                </div>
              </div>

              <div class="product-info">
                <h3 class="text-h6 font-weight-bold mb-2">
                  {{ product.description }}
                </h3>
                <div class="info-chips d-flex flex-wrap gap-2 justify-center">
                  <VChip size="x-small" color="primary" variant="tonal">
                    SKU: {{ product.sku }}
                  </VChip>
                  <VChip v-if="product.code_aux" size="x-small" color="grey" variant="tonal">
                    Código: {{ product.code_aux }}
                  </VChip>
                  <VChip :color="product.state === 1 ? 'success' : 'error'" size="x-small" variant="flat">
                    {{ product.state === 1 ? 'Activo' : 'Inactivo' }}
                  </VChip>
                  <VChip v-if="product.is_gift === 1" color="warning" size="x-small" variant="tonal">
                    <VIcon icon="ri-gift-line" size="12" class="mr-1"/> Regalo
                  </VChip>
                  <VChip v-if="product.is_taxable" color="info" size="x-small" variant="tonal">
                    Gravable
                  </VChip>
                </div>
              </div>
            </div>
          </VCol>

          <!-- Información Principal -->
          <VCol cols="12" md="8">
            <div class="info-grid">
              <!-- Categoría -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-folder-line" size="16" />
                  Categoría
                </div>
                <div class="info-value">
                  {{ product.categorie?.title || 'Sin categoría' }}
                </div>
              </div>

              <!-- Almacén -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-store-2-line" size="16" />
                  Almacén
                </div>
                <div class="info-value">
                  {{ product.warehouse?.name || 'Sin almacén' }}
                </div>
              </div>

              <!-- Unidad -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-ruler-line" size="16" />
                  Unidad
                </div>
                <div class="info-value">
                  {{ product.unit?.name || 'Sin unidad' }}
                </div>
              </div>

              <!-- Proveedor -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-truck-line" size="16" />
                  Proveedor
                </div>
                <div class="info-value">
                  {{ product.supplier?.name || 'Sin proveedor' }}
                </div>
              </div>

              <!-- Marca -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-price-tag-3-line" size="16" />
                  Marca
                </div>
                <div class="info-value">
                  {{ product.brand || 'Sin marca' }}
                </div>
              </div>

              <!-- Tipo de Ítem -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-shapes-line" size="16" />
                  Tipo
                </div>
                <VChip :color="product.item_type == 1 ? 'primary' : 'secondary'" size="small" variant="tonal">
                  {{ product.item_type == 1 ? 'Producto' : 'Servicio' }}
                </VChip>
              </div>
            </div>
          </VCol>
        </VRow>

        <!-- Precios -->
        <div class="mb-6">
          <div class="section-title mb-2">
            <VIcon icon="ri-money-dollar-circle-line" size="20" color="success" />
            Información de Precios
          </div>
          <VDivider class="mb-4" />

          <div class="price-grid">
            <div class="price-item">
              <div class="price-label">
                Precio Compra (Sin IVA)
              </div>
              <div class="price-value">
                ${{ product.purchase_price?.toFixed(2) || '0.00' }}
              </div>
            </div>
            <div class="price-item" style="border-left: 3px solid var(--v-theme-primary); background-color: rgb(var(--v-theme-primary), 0.03);">
              <div class="price-label text-primary font-weight-bold">
                Precio Compra (+ IVA)
              </div>
              <div class="price-value text-primary">
                ${{ (product.purchase_price * (1 + (product.tax_rate || 0) / 100)).toFixed(2) }}
              </div>
            </div>
            <div class="price-item highlight">
              <div class="price-label">
                Precio Venta (Sin IVA)
              </div>
              <div class="price-value">
                ${{ product.price_sale?.toFixed(2) || '0.00' }}
              </div>
            </div>
            <div class="price-item highlight" style="border-left: 3px solid var(--v-theme-success); background-color: rgb(var(--v-theme-success), 0.05);">
              <div class="price-label text-success font-weight-bold">
                Precio Venta (+ IVA)
              </div>
              <div class="price-value text-success">
                ${{ (product.price_sale * (1 + (product.tax_rate || 0) / 100)).toFixed(2) }}
              </div>
            </div>
            <div class="price-item">
              <div class="price-label">
                Descuento Máx
              </div>
              <div class="price-value">
                ${{ product.max_discount?.toFixed(2) || '0.00' }}
              </div>
              <div v-if="product.discount_percentage > 0" class="price-discount">
                {{ product.discount_percentage }}%
              </div>
            </div>
          </div>
        </div>

        <!-- Inventario Simplificado -->
        <div class="mb-6">
          <div class="section-title mb-2">
            <VIcon icon="ri-archive-line" size="20" color="primary" />
            Inventario
          </div>
          <VDivider class="mb-4" />

          <div class="inventory-grid">
            <div class="inventory-item" :class="getStockClass(product.stock, product.min_stock)">
              <div class="inventory-label">
                Stock Actual
              </div>
              <div class="inventory-value">
                {{ product.stock || 0 }}
              </div>
              <div class="inventory-range">
                Min: {{ product.min_stock || 0 }} | Max: {{ product.max_stock || 0 }}
              </div>
            </div>
            <div class="inventory-item">
              <div class="inventory-label">
                Impuesto Aplicado
              </div>
              <div class="inventory-value">
                {{ product.tax_rate || 0 }}%
              </div>
            </div>
          </div>
        </div>

        <!-- Notas -->
        <div v-if="product.notes" class="mb-6">
          <div class="section-title mb-2">
            <VIcon icon="ri-file-text-line" size="20" color="primary" />
            Notas Adicionales
          </div>
          <VDivider class="mb-3" />
          <div class="notes-content bg-grey-lighten-4 pa-4 rounded-lg text-body-2">
            {{ product.notes }}
          </div>
        </div>

        <!-- Fechas en el pie -->
        <div class="d-flex flex-wrap align-center justify-space-between mt-6 pt-4 border-t text-caption text-medium-emphasis">
          <span><VIcon icon="ri-calendar-event-line" size="14" class="mr-1"/> Creado: {{ formatDate(product.created_at) }}</span>
          <span><VIcon icon="ri-edit-line" size="14" class="mr-1"/> Actualizado: {{ formatDate(product.updated_at) }}</span>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-grey-lighten-5">
        <VSpacer />
        <VBtn variant="elevated" prepend-icon="ri-close-line" @click="$emit('update:dialog', false)">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Diálogo de Imagen con Zoom -->
  <VDialog v-model="imageDialog" max-width="700" content-class="image-dialog">
    <VCard class="image-view-card">
      <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-primary-lighten-1">
        <div>
          <div class="text-h6 font-weight-bold">
            {{ product?.description || 'Producto' }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ product?.item_type == 1 ? 'Producto' : 'Servicio' }} • Click y arrastra para hacer zoom
          </div>
        </div>
        <VBtn icon="ri-close-line" variant="text" @click="imageDialog = false" />
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

const getStockClass = (stock, minStock) => {
  if (stock === 0) return 'stock-zero'
  if (stock <= minStock) return 'stock-low'

  return 'stock-good'
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
