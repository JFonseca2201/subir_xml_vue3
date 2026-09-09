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
})

const emit = defineEmits(['update:isDialogVisible', 'updated'])

const { showNotification } = useGlobalToast()

const isSubmitting = ref(false)
const errorMessage = ref('')
const currentStock = ref(0)
const initialStock = ref(0)

watch(
  () => props.isDialogVisible,
  visible => {
    if (visible && props.product) {
      errorMessage.value = ''
      const stockVal = parseFloat(props.product.stock || 0)
      currentStock.value = stockVal
      initialStock.value = stockVal
    }
  },
  { immediate: true },
)

const adjust = delta => {
  const updated = Math.max(0, (parseFloat(currentStock.value) || 0) + delta)
  currentStock.value = Math.round(updated * 100) / 100
}

const resetToInitial = () => {
  currentStock.value = initialStock.value
}

const delta = computed(() => {
  const diff = (parseFloat(currentStock.value) || 0) - (parseFloat(initialStock.value) || 0)
  return Math.round(diff * 100) / 100
})

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const saveStock = async () => {
  if (parseFloat(currentStock.value) < 0) {
    errorMessage.value = 'El stock no puede ser menor a 0'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const p = props.product
    const isService = p.item_type == 2
    const basePrice = parseFloat(p.price_sale || 0)

    const formData = new FormData()
    formData.append('description', p.description || '')
    formData.append('sku', p.sku || '')
    if (p.code_aux) formData.append('code_aux', p.code_aux)
    if (p.uses) formData.append('uses', p.uses)
    formData.append('product_categorie_id', p.product_categorie_id || p.categorie?.id || 1)
    formData.append('warehouse_id', p.warehouse_id || p.warehouse?.id || 1)
    formData.append('unit_id', p.unit_id || p.unit?.id || 1)
    if (p.supplier_id || p.supplier?.id) formData.append('supplier_id', p.supplier_id || p.supplier?.id)
    formData.append('price', basePrice)
    formData.append('price_sale', basePrice)
    formData.append('purchase_price', parseFloat(p.purchase_price || 0))
    formData.append('tax_rate', parseFloat(p.tax_rate ?? 15))
    formData.append('max_discount', parseFloat(p.max_discount || 0))
    formData.append('discount_percentage', parseFloat(p.discount_percentage || 0))
    formData.append('brand', p.brand || '')
    formData.append('stock', isService ? 0 : (parseFloat(currentStock.value) || 0))
    formData.append('item_type', p.item_type || 1)
    formData.append('min_stock', parseFloat(p.min_stock || 0))
    formData.append('max_stock', parseFloat(p.max_stock || 0))
    formData.append('is_taxable', p.is_taxable !== undefined ? p.is_taxable : 1)
    formData.append('is_gift', p.is_gift !== undefined ? p.is_gift : 2)
    formData.append('notes', p.notes || '')
    formData.append('state', p.state !== undefined ? p.state : 1)
    formData.append('_method', 'PUT')

    const response = await $api(`products/${p.id}`, {
      method: 'POST',
      body: formData,
    })

    if (response && (response.status === 200 || response.message === 200)) {
      showNotification('Stock actualizado correctamente', 'success')
      emit('updated', response.product || {
        ...props.product,
        stock: parseFloat(currentStock.value),
      })
      closeDialog()
    } else {
      errorMessage.value = response?.message_text || response?.message || 'Error al actualizar el stock'
    }
  } catch (error) {
    console.error('Error al actualizar stock:', error)
    errorMessage.value = error?.data?.message || error?.message || 'Error al guardar stock'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="isDialogVisible"
    max-width="440px"
    persistent
    class="v-dialog-quick-stock"
    @update:model-value="val => !val && closeDialog()"
  >
    <VCard class="product-quick-dialog-card">
      <!-- Header con degradado primario / teal -->
      <div class="product-quick-header" style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 60%, #0369a1 100%) !important;">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />

        <div class="d-flex align-center gap-3">
          <VAvatar
            size="42"
            rounded="lg"
            color="white"
            class="elevation-2 overflow-hidden flex-shrink-0"
          >
            <VIcon icon="ri-archive-line" color="info" size="24" />
          </VAvatar>

          <div class="overflow-hidden" style="flex: 1;">
            <span class="product-mini-badge font-mono">SKU: {{ product?.sku || 'S/C' }}</span>
            <h3 class="text-white font-weight-bold text-truncate mb-0 mt-0.5" style="font-size: 1rem;" :title="product?.description">
              {{ product?.description || 'Ajuste de Stock' }}
            </h3>
          </div>
        </div>
      </div>

      <VCardText class="pa-4 bg-grey-lighten-5">
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

        <div class="quick-stock-stepper-box bg-white">
          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-caption text-medium-emphasis font-weight-bold text-uppercase">Stock Físico</span>
            <span
              v-if="delta !== 0"
              class="font-mono text-caption font-weight-bold px-2 py-0.5 rounded"
              :class="delta > 0 ? 'bg-success-lighten-5 text-success' : 'bg-error-lighten-5 text-error'"
            >
              {{ delta > 0 ? `+${delta}` : delta }} unidades
            </span>
          </div>

          <div class="stock-current-display py-2">
            <div
              class="stock-big-number"
              :class="currentStock > 0 ? 'text-info' : 'text-error'"
            >
              {{ currentStock }}
            </div>
            <div class="text-caption text-disabled font-mono">
              Stock registrado: {{ initialStock }} {{ product?.unit?.name || 'UND' }}
            </div>
          </div>

          <!-- Botones táctiles grandes -->
          <div class="quick-stepper-row my-3">
            <VBtn
              color="secondary"
              variant="tonal"
              class="quick-stepper-btn"
              :disabled="currentStock <= 0"
              @click="adjust(-1)"
            >
              <VIcon icon="ri-subtract-line" size="22" />
            </VBtn>

            <VTextField
              v-model.number="currentStock"
              type="number"
              min="0"
              step="any"
              density="comfortable"
              variant="outlined"
              hide-details
              class="font-mono text-center font-weight-bold"
              style="max-width: 130px;"
            />

            <VBtn
              color="info"
              variant="tonal"
              class="quick-stepper-btn"
              @click="adjust(1)"
            >
              <VIcon icon="ri-add-line" size="22" />
            </VBtn>
          </div>

          <!-- Ajustes rápidos para móvil -->
          <div class="quick-adjustment-chips mt-3">
            <span class="adj-chip adj-minus" @click="adjust(-10)">-10</span>
            <span class="adj-chip adj-minus" @click="adjust(-5)">-5</span>
            <span class="adj-chip adj-minus" @click="adjust(-1)">-1</span>
            <span class="adj-chip adj-plus" @click="adjust(1)">+1</span>
            <span class="adj-chip adj-plus" @click="adjust(5)">+5</span>
            <span class="adj-chip adj-plus" @click="adjust(10)">+10</span>
          </div>

          <div v-if="delta !== 0" class="text-center mt-3">
            <VBtn
              variant="text"
              color="secondary"
              size="x-small"
              prepend-icon="ri-refresh-line"
              @click="resetToInitial"
            >
              Restablecer a {{ initialStock }}
            </VBtn>
          </div>
        </div>
      </VCardText>

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
          color="info"
          variant="flat"
          prepend-icon="ri-check-line"
          class="font-weight-bold px-5"
          :loading="isSubmitting"
          @click="saveStock"
        >
          Actualizar Stock
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
