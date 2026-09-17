<script setup>
import { ref } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

// Props
const props = defineProps({
  product: {
    type: Object,
    required: true,
  },
  showDialog: {
    type: Boolean,
    default: false,
  },
})

// Emits
const emit = defineEmits(['update:showDialog', 'deleted'])

// Stores y composables
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Estado local
const isLoading = ref(false)
const imageError = ref(false)

// Eliminar producto
const deleteProduct = async () => {
  if (!props.product?.id) {
    showNotification('error', 'No se puede eliminar el producto: ID no válido')
    return
  }

  try {
    isLoading.value = true
        
    if (loader && typeof loader.show === 'function') {
      loader.show()
    }

    const response = await $api(`products/${props.product.id}`, {
      method: 'DELETE',
      onResponseError({ response }) {
        showNotification('error', response._data.message || 'Error al eliminar el producto')
      },
    })

    if (response.message === 200 || response.status === 200 || response.success) {
      showNotification('success', 'Producto eliminado correctamente')
      emit('deleted')
      closeDialog()
    } else {
      showNotification('error', response.message || 'Error al eliminar el producto')
    }
  } catch (error) {
    console.error('❌ Error en deleteProduct:', error)
    showNotification('error', 'Error al eliminar el producto')
  } finally {
    isLoading.value = false
        
    if (loader && typeof loader.hide === 'function') {
      loader.hide()
    }
  }
}

// Cerrar diálogo
const closeDialog = () => {
  emit('update:showDialog', false)
}

// Manejar error de imagen
const handleImageError = () => {
  imageError.value = true
}
</script>

<template>
  <VDialog
    scrollable 
    :model-value="showDialog" 
    max-width="520"
    persistent
    @update:model-value="emit('update:showDialog', $event)"
  >
    <VCard class="custom-dialog-card rounded-2xl overflow-hidden elevation-24">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary py-5 px-6">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="isLoading"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar mb-2">
          <VIcon icon="ri-delete-bin-line" size="24" />
        </div>
        <h3 class="custom-dialog-title text-h6 font-weight-bold mb-1">
          Eliminar Producto
        </h3>
        <p class="custom-dialog-subtitle text-caption text-white opacity-90 mb-0">
          Esta acción removerá el producto del catálogo de inventario
        </p>
      </div>

      <VCardText class="pa-6">
        <!-- Tarjeta de vista previa del producto con espaciado amplio -->
        <div class="product-preview-card pa-4 rounded-xl border d-flex align-center gap-4 mb-5">
          <div class="product-thumb-container flex-shrink-0">
            <img 
              v-if="product.imagen && !imageError" 
              :src="product.imagen" 
              class="product-thumb-img"
              alt="Imagen del producto"
              @error="handleImageError"
            >
            <div 
              v-else 
              class="product-thumb-placeholder d-flex align-center justify-center"
            >
              <VIcon
                icon="ri-box-3-line"
                size="28"
                color="secondary"
              />
            </div>
          </div>

          <div class="flex-grow-1 min-w-0">
            <div class="product-title-text font-weight-bold text-slate-900 mb-1.5 line-clamp-2">
              {{ product.title || product.description || 'Sin descripción' }}
            </div>
            
            <div class="d-flex align-center flex-wrap gap-2">
              <VChip
                v-if="product.sku"
                size="small"
                color="primary"
                variant="tonal"
                class="font-weight-semibold"
              >
                SKU: {{ product.sku }}
              </VChip>

              <VChip
                v-if="product.price_sale || product.price"
                size="small"
                color="success"
                variant="tonal"
                class="font-weight-bold font-mono"
              >
                ${{ parseFloat(product.price_sale || product.price || 0).toFixed(2) }}
              </VChip>
            </div>
          </div>
        </div>

        <VAlert
          color="error"
          variant="tonal"
          density="comfortable"
          class="rounded-xl pa-3.5"
        >
          <template #prepend>
            <VIcon icon="ri-error-warning-fill" size="20" class="mr-1" />
          </template>
          <div class="text-body-2 font-weight-medium">
            ¿Está seguro de eliminar este producto? Esta acción no se puede revertir.
          </div>
        </VAlert>
      </VCardText>

      <VDivider />

      <VCardActions
        class="pa-4 px-6 d-flex justify-end align-center gap-3 bg-white"
      >
        <VBtn 
          variant="tonal" 
          color="secondary"
          class="rounded-lg px-6 font-weight-medium text-capitalize"
          height="42"
          :disabled="isLoading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn 
          color="error" 
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="rounded-lg px-6 font-weight-bold text-capitalize"
          height="42"
          :loading="isLoading || loader.loading"
          :disabled="isLoading || loader.loading"
          @click="deleteProduct"
        >
          Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.product-preview-card {
  border-color: #e2e8f0 !important;
  background-color: #f8fafc !important;
  transition: all 0.2s ease;
}

.product-thumb-container {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.product-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: #f1f5f9;
}

.product-title-text {
  font-size: 0.92rem;
  line-height: 1.35;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
