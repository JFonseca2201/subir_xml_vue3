<template>
  <VDialog :model-value="dialog" @update:model-value="$emit('update:dialog', $event)" max-width="900px" persistent>
    <VCard class="product-view-card">
      <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-primary-lighten-1">
        <div class="d-flex align-center gap-2">
          <VAvatar color="primary" variant="tonal">
            <VIcon icon="ri-eye-line" />
          </VAvatar>
          <div>
            <div class="text-h6 font-weight-bold">Detalles del Producto</div>
            <div class="text-caption text-medium-emphasis">Información completa del producto</div>
          </div>
        </div>
        <VBtn icon="ri-close-line" variant="text" @click="$emit('update:dialog', false)" />
      </VCardTitle>
      <VDivider />

      <VCardText class="pa-6" v-if="product">
        <!-- Imagen Principal -->
        <VRow class="mb-6">
          <VCol cols="12" md="4">
            <div class="text-center">
              <div @click="openImageDialog" class="cursor-pointer image-container">
                <VAvatar v-if="product.imagen" :image="product.imagen" size="140"
                  class="elevation-6 mb-3 product-avatar" />
                <VAvatar v-else color="grey-lighten-3" size="140" class="elevation-6 mb-3 product-avatar">
                  <VIcon icon="ri-image-line" size="70" color="grey-lighten-1" />
                </VAvatar>
                <div class="image-overlay">
                  <VIcon icon="ri-zoom-in-line" size="24" color="white" />
                  <div class="text-caption text-white mt-1">Click para ampliar</div>
                </div>
              </div>

              <div class="product-info">
                <h3 class="text-h6 font-weight-bold mb-2">{{ product.description }}</h3>
                <div class="info-chips">
                  <VChip size="x-small" color="primary" variant="tonal">SKU: {{ product.sku }}</VChip>
                  <VChip v-if="product.code_aux" size="x-small" color="grey" variant="tonal">
                    Código: {{ product.code_aux }}
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
                <div class="info-value">{{ product.categorie?.title || 'Sin categoría' }}</div>
              </div>

              <!-- Almacén -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-store-2-line" size="16" />
                  Almacén
                </div>
                <div class="info-value">{{ product.warehouse?.name || 'Sin almacén' }}</div>
              </div>

              <!-- Unidad -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-ruler-line" size="16" />
                  Unidad
                </div>
                <div class="info-value">{{ product.unit?.name || 'Sin unidad' }}</div>
              </div>

              <!-- Proveedor -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-truck-line" size="16" />
                  Proveedor
                </div>
                <div class="info-value">{{ product.supplier?.name || 'Sin proveedor' }}</div>
              </div>

              <!-- Marca -->
              <div class="info-item">
                <div class="info-label">
                  <VIcon icon="ri-price-tag-3-line" size="16" />
                  Marca
                </div>
                <div class="info-value">{{ product.brand || 'Sin marca' }}</div>
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
        <VCard class="mb-6" elevation="1">
          <VCardText class="pa-4">
            <div class="section-title">
              <VIcon icon="ri-money-dollar-circle-line" size="20" color="success" />
              Información de Precios
            </div>
            <VDivider class="mb-4" />

            <div class="price-grid">
              <div class="price-item">
                <div class="price-label">Precio Base</div>
                <div class="price-value">${{ product.price?.toFixed(2) || '0.00' }}</div>
              </div>
              <div class="price-item highlight">
                <div class="price-label">Precio Venta</div>
                <div class="price-value">${{ product.price_sale?.toFixed(2) || '0.00' }}</div>
              </div>
              <div class="price-item">
                <div class="price-label">Precio Compra</div>
                <div class="price-value">${{ product.purchase_price?.toFixed(2) || '0.00' }}</div>
              </div>
              <div class="price-item">
                <div class="price-label">Descuento Máx</div>
                <div class="price-value">${{ product.max_discount?.toFixed(2) || '0.00' }}</div>
                <div v-if="product.discount_percentage > 0" class="price-discount">
                  {{ product.discount_percentage }}%
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>

        <!-- Inventario -->
        <VCard class="mb-6" elevation="1">
          <VCardText class="pa-4">
            <div class="section-title">
              <VIcon icon="ri-archive-line" size="20" color="primary" />
              Información de Inventario
            </div>
            <VDivider class="mb-4" />

            <div class="inventory-grid">
              <div class="inventory-item" :class="getStockClass(product.stock, product.min_stock)">
                <div class="inventory-label">Stock Actual</div>
                <div class="inventory-value">{{ product.stock || 0 }}</div>
                <div class="inventory-range">Min: {{ product.min_stock || 0 }} | Max: {{ product.max_stock || 0 }}</div>
              </div>
              <div class="inventory-item">
                <div class="inventory-label">Impuesto</div>
                <div class="inventory-value">{{ product.tax_rate || 0 }}%</div>
              </div>
            </div>
          </VCardText>
        </VCard>

        <!-- Configuración -->
        <VCard class="mb-6" elevation="1">
          <VCardText class="pa-4">
            <div class="section-title">
              <VIcon icon="ri-settings-3-line" size="20" color="primary" />
              Configuración
            </div>
            <VDivider class="mb-4" />

            <div class="config-grid">
              <div class="config-item">
                <div class="config-label">
                  <VIcon icon="ri-receipt-line" size="16" />
                  Gravable
                </div>
                <VChip :color="product.is_taxable ? 'success' : 'error'" size="small" variant="tonal">
                  {{ product.is_taxable ? 'Sí' : 'No' }}
                </VChip>
              </div>
              <div class="config-item">
                <div class="config-label">
                  <VIcon icon="ri-gift-line" size="16" />
                  Es Regalo
                </div>
                <VChip :color="product.is_gift === 1 ? 'warning' : 'grey'" size="small" variant="tonal">
                  {{ product.is_gift === 1 ? 'Sí' : 'No' }}
                </VChip>
              </div>
              <div class="config-item">
                <div class="config-label">
                  <VIcon icon="ri-checkbox-circle-line" size="16" />
                  Estado
                </div>
                <VChip :color="product.state === 1 ? 'success' : 'error'" size="small" variant="tonal">
                  {{ product.state === 1 ? 'Activo' : 'Inactivo' }}
                </VChip>
              </div>
            </div>
          </VCardText>
        </VCard>

        <!-- Notas -->
        <VCard v-if="product.notes" class="mb-6" elevation="1">
          <VCardText class="pa-4">
            <div class="section-title">
              <VIcon icon="ri-file-text-line" size="20" color="primary" />
              Notas Adicionales
            </div>
            <VDivider class="mb-3" />
            <div class="notes-content">{{ product.notes }}</div>
          </VCardText>
        </VCard>

        <!-- Fechas -->
        <VCard elevation="1">
          <VCardText class="pa-4">
            <div class="section-title">
              <VIcon icon="ri-calendar-line" size="20" color="primary" />
              Información de Registro
            </div>
            <VDivider class="mb-4" />

            <div class="dates-grid">
              <div class="date-item">
                <div class="date-label">Fecha de Creación</div>
                <div class="date-value">{{ formatDate(product.created_at) }}</div>
              </div>
              <div class="date-item">
                <div class="date-label">Última Actualización</div>
                <div class="date-value">{{ formatDate(product.updated_at) }}</div>
              </div>
            </div>
          </VCardText>
        </VCard>
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
          <div class="text-h6 font-weight-bold">{{ product?.description || 'Producto' }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ product?.item_type == 1 ? 'Producto' : 'Servicio' }} • Click y arrastra para hacer zoom
          </div>
        </div>
        <VBtn icon="ri-close-line" variant="text" @click="imageDialog = false" />
      </VCardTitle>
      <VDivider />

      <VCardText class="pa-4 image-container-zoom">
        <div class="zoom-wrapper" ref="zoomWrapper">
          <VImg v-if="product?.imagen" :src="product.imagen" class="zoom-image" @wheel="handleZoom"
            @mousedown="startDrag" @mousemove="drag" @mouseup="endDrag" @mouseleave="endDrag" :style="zoomStyle" />
          <div v-else class="no-image-placeholder">
            <VIcon icon="ri-image-line" size="100" color="grey-lighten-1" />
            <div class="text-h6 mt-4 text-medium-emphasis">Sin imagen disponible</div>
            <div class="text-caption text-medium-emphasis mt-2">
              Este producto no tiene una imagen asociada
            </div>
          </div>
        </div>

        <!-- Controles de Zoom -->
        <div class="zoom-controls" v-if="product?.imagen">
          <VBtn icon="ri-zoom-out-line" variant="elevated" size="small" @click="zoomOut" class="mr-2" />
          <div class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</div>
          <VBtn icon="ri-zoom-in-line" variant="elevated" size="small" @click="zoomIn" class="ml-2" />
          <VBtn icon="ri-refresh-line" variant="outlined" size="small" @click="resetZoom" class="ml-2" />
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
    default: false
  },
  product: {
    type: Object,
    default: null
  }
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

const formatDate = (dateString) => {
  if (!dateString) return 'No disponible'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    return dateString
  }
}

// Zoom functionality
const zoomStyle = computed(() => ({
  transform: `scale(${zoomLevel.value}) translate(${position.value.x}px, ${position.value.y}px)`,
  transition: isDragging.value ? 'none' : 'transform 0.3s ease',
  cursor: isDragging.value ? 'grabbing' : 'grab'
}))

const handleZoom = (event) => {
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
        y: -y * (newZoom - 1) / newZoom
      }
    }
  }
}

const startDrag = (event) => {
  isDragging.value = true
  dragStart.value = {
    x: event.clientX - position.value.x,
    y: event.clientY - position.value.y
  }
  event.preventDefault()
}

const drag = (event) => {
  if (!isDragging.value) return

  position.value = {
    x: event.clientX - dragStart.value.x,
    y: event.clientY - dragStart.value.y
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
/* Main card styles */
.product-view-card {
  overflow: hidden;
}

/* Image container */
.image-container {
  position: relative;
  display: inline-block;
}

.product-avatar {
  transition: all 0.3s ease;
}

.image-container:hover .product-avatar {
  transform: scale(1.05);
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 50%;
}

.image-container:hover .image-overlay {
  opacity: 1;
}

.product-info {
  margin-top: 16px;
}

.info-chips {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.info-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-weight: 500;
}

.info-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

/* Section titles */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
}

/* Price grid */
.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.price-item {
  text-align: center;
  padding: 16px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition: all 0.3s ease;
}

.price-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.price-item.highlight {
  background: rgba(var(--v-theme-success), 0.08);
  border-color: rgba(var(--v-theme-success), 0.2);
}

.price-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.price-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

.price-discount {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-warning), 0.8);
  margin-top: 4px;
}

/* Inventory grid */
.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.inventory-item {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition: all 0.3s ease;
}

.inventory-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.inventory-item.stock-good {
  background: rgba(var(--v-theme-success), 0.08);
  border-color: rgba(var(--v-theme-success), 0.2);
}

.inventory-item.stock-low {
  background: rgba(var(--v-theme-warning), 0.08);
  border-color: rgba(var(--v-theme-warning), 0.2);
}

.inventory-item.stock-zero {
  background: rgba(var(--v-theme-error), 0.08);
  border-color: rgba(var(--v-theme-error), 0.2);
}

.inventory-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.inventory-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.inventory-range {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Config grid */
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.config-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-weight: 500;
}

/* Dates grid */
.dates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.date-item {
  padding: 16px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.date-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.date-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

/* Notes */
.notes-content {
  padding: 16px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.8);
}

/* Image dialog styles */
.image-dialog {
  border-radius: 12px;
  overflow: hidden;
}

.image-view-card {
  overflow: hidden;
}

.image-container-zoom {
  position: relative;
  height: 500px;
  background: rgba(var(--v-theme-surface), 1);
  border-radius: 8px;
  overflow: hidden;
}

.zoom-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.zoom-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
}

.no-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(var(--v-theme-on-surface), 0.4);
}

.zoom-controls {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.95);
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
}

.zoom-level {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.8);
  min-width: 45px;
  text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .price-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .inventory-grid {
    grid-template-columns: 1fr;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .dates-grid {
    grid-template-columns: 1fr;
  }

  .image-container-zoom {
    height: 400px;
  }

  .zoom-controls {
    bottom: 12px;
    right: 12px;
  }
}

@media (max-width: 480px) {
  .price-grid {
    grid-template-columns: 1fr;
  }

  .info-chips {
    flex-direction: column;
    align-items: center;
  }

  .image-container-zoom {
    height: 300px;
  }
}
</style>
