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
  console.log('🚀 Iniciando deleteProduct para:', props.product)
    
  if (!props.product?.id) {
    showNotification('error', 'No se puede eliminar el producto: ID no válido')
    
    return
  }

  try {
    isLoading.value = true
    console.log('⏳ isLoading = true')
        
    if (loader && typeof loader.show === 'function') {
      loader.show()
      console.log('📺 Loader mostrado')
    }

    console.log('🌐 Enviando DELETE a:', `products/${props.product.id}`)

    const response = await $api(`products/${props.product.id}`, {
      method: 'DELETE',
      onResponseError({ response }) {
        console.error('❌ Error de API:', response._data)
        showNotification('error', response._data.message || 'Error al eliminar el producto')
      },
    })

    console.log('📡 Respuesta recibida:', response)
    console.log('📊 Status:', response.status)
    console.log('📊 Message:', response.message)

    // La API responde con message: 200 en lugar de status: 200
    if (response.message === 200 || response.status === 200) {
      showNotification('success', 'Producto eliminado correctamente')
      console.log('📤 Emitiendo evento deleted')
      emit('deleted')
      console.log('📤 Evento deleted emitido, llamando a closeDialog')
      closeDialog()
    } else {
      console.log('❌ Status no es 200:', response.message, response.status)
      showNotification('error', 'Error al eliminar el producto')
    }
  } catch (error) {
    console.error('❌ Error en deleteProduct:', error)
    showNotification('error', 'Error al eliminar el producto')
  } finally {
    isLoading.value = false
    console.log('⏳ isLoading = false')
        
    if (loader && typeof loader.hide === 'function') {
      loader.hide()
      console.log('📺 Loader ocultado')
    }
  }
}

// Cerrar diálogo
const closeDialog = () => {
  console.log('🔒 Cerrando diálogo desde DeleteProduct')
  emit('update:showDialog', false)
}

// Manejar error de imagen
const handleImageError = () => {
  console.log('❌ Error al cargar la imagen')
  imageError.value = true
}
</script>

<template>
  <VDialog
    scrollable 
    :model-value="showDialog" 
    max-width="500"
    persistent
    @update:model-value="emit('update:showDialog', $event)"
  >
    <VCard class="custom-dialog-card">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="isLoading"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-delete-bin-line" />
        </div>
        <h3 class="custom-dialog-title">
          Eliminar Producto
        </h3>
        <p class="custom-dialog-subtitle">
          Esta acción removerá el producto del catálogo de inventario
        </p>
      </div>

      <VCardText class="pa-4">
        <!-- Imagen del producto en cuadrado -->
        <div class="text-center mb-4">
          <div class="d-inline-block">
            <img 
              v-if="product.imagen && !imageError" 
              :src="product.imagen" 
              class="product-image"
              alt="Imagen del producto"
              @error="handleImageError"
            >
            <div 
              v-else 
              class="product-image-placeholder d-flex align-center justify-center"
            >
              <VIcon
                icon="ri-image-line"
                size="40"
                color="grey-lighten-1"
              />
            </div>
          </div>
        </div>

        <p class="mb-2 text-center text-h6">
          {{ product.description }}
        </p>

        <div class="text-center text-caption text-medium-emphasis mb-4">
          SKU: {{ product.sku }}
        </div>

        <VAlert
          color="warning"
          variant="tonal"
          class="mb-4"
        >
          <template #prepend>
            <VIcon icon="ri-alert-line" />
          </template>
          Esta acción no se puede deshacer
        </VAlert>
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
          :disabled="isLoading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>
        <VBtn 
          color="error" 
          variant="elevated"
          prepend-icon="ri-delete-bin-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
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
