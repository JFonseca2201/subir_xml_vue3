<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'serviceAdded'])

// --- ESTADO ---
const loading = ref(false)
const error = ref('')
const formRef = ref(null)
const categories = ref([])
const defaultCategorieId = ref(null)
const defaultUnitId = ref(null)

const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message
  notificationType.value = type
  notificationShow.value = true
}

const serviceForm = ref({
  description: '',
  price_sale: '',
  is_taxable: true,
})

// --- REGLAS ---
const rules = {
  description: [
    v => !!v || 'La descripción es obligatoria',
    v => (v && v.length >= 3) || 'Mínimo 3 caracteres',
  ],
  price_sale: [
    v => !!v || 'El precio es obligatorio',
    v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 || 'Debe ser un número positivo',
  ],
}

// --- CARGA INICIAL ---
const loadConfig = async () => {
  try {
    const resp = await $api('products/config', { method: 'GET' })
    if (resp && resp.data) {
      categories.value = resp.data.categories || []
      
      // Intentar encontrar la categoría "SERVICIOS" o "SERVICIO"
      const serviceCat = categories.value.find(c => 
        c.title?.toUpperCase().includes('SERVICIO') || 
        c.title?.toUpperCase().includes('MANO DE OBRA')
      )
      
      if (serviceCat) {
        defaultCategorieId.value = serviceCat.id
      } else if (categories.value.length > 0) {
        defaultCategorieId.value = categories.value[0].id
      }

      const units = resp.data.units || []
      if (units.length > 0) {
        defaultUnitId.value = units[0].id
      } else {
        defaultUnitId.value = 1
      }
    }
  } catch (err) {
    console.error('Error al cargar la configuración de productos:', err)
  }
}

// --- ACCIONES ---
const resetForm = () => {
  serviceForm.value = {
    description: '',
    price_sale: '',
    is_taxable: true,
  }
  formRef.value?.resetValidation()
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
  resetForm()
}

const saveService = async () => {
  const { valid } = await formRef.value?.validate()
  if (!valid) return

  loading.value = true
  error.value = ''

  // Generar un SKU único y seguro de manera automática para el servicio
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const autoSku = `SRV-${Date.now().toString().slice(-6)}-${randomSuffix}`

  // Construir el payload completo para el backend respetando item_type = 2
  const payload = {
    description: serviceForm.value.description.toUpperCase().trim(),
    sku: autoSku,
    product_categorie_id: defaultCategorieId.value || 1,
    unit_id: defaultUnitId.value || 1,
    price: parseFloat(serviceForm.value.price_sale) || 0,
    price_sale: parseFloat(serviceForm.value.price_sale) || 0,
    purchase_price: 0.00,
    tax_rate: 15.00, // Impuesto general de taller (15% IVA)
    max_discount: 0.00,
    discount_percentage: 0.00,
    stock: 0.00,
    item_type: 2, // Servicio / Mano de Obra
    min_stock: 0.00,
    max_stock: 0.00,
    is_taxable: serviceForm.value.is_taxable ? 1 : 2,
    is_gift: 2, // No es regalo
    state: 1, // Activo
    notes: 'REGISTRADO DESDE MODAL EXPRESS DE VENTAS',
  }

  try {
    const resp = await $api('products', {
      method: 'POST',
      body: payload,
    })

    // Soportar respuestas con estructura diferente
    const newProduct = resp.product || resp.data || resp

    showNotification('Servicio express creado exitosamente', 'success')
    resetForm()
    
    // Esperar un instante corto para que se muestre la notificación y luego cerrar
    setTimeout(() => {
      emit('update:isDialogVisible', false)
      emit('serviceAdded', newProduct)
    }, 500)

  } catch (err) {
    error.value = err.response?._data?.message || 'Error al guardar el servicio'
    showNotification(error.value, 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <VDialog
    max-width="550"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="pa-sm-8 pa-4 rounded-lg">
      <DialogCloseBtn
        variant="text"
        size="default"
        @click="closeDialog"
      />

      <VCardText class="text-center pb-4">
        <VAvatar color="info" variant="tonal" size="64" class="mb-3">
          <VIcon
            icon="ri-tools-line"
            size="36"
          />
        </VAvatar>
        <h4 class="text-h4 font-weight-bold mb-1">
          Registrar Servicio Express
        </h4>
        <p class="text-body-2 text-medium-emphasis">
          Crea rápidamente un nuevo servicio para inyectar en el carrito de venta.
        </p>
      </VCardText>

      <VDivider class="mb-6" />

      <VForm
        ref="formRef"
        @submit.prevent="saveService"
      >
        <VRow>
          <VCol cols="12">
            <VTextField
              v-model="serviceForm.description"
              label="Descripción del Servicio *"
              placeholder="Ej. CAMBIO DE ACEITE Y FILTRO"
              prepend-inner-icon="ri-tools-line"
              :rules="rules.description"
              variant="outlined"
              density="comfortable"
              required
            />
          </VCol>

          <VCol cols="12" sm="6">
            <VTextField
              v-model="serviceForm.price_sale"
              label="Precio de Venta *"
              placeholder="0.00"
              prefix="$"
              prepend-inner-icon="ri-money-dollar-circle-line"
              :rules="rules.price_sale"
              variant="outlined"
              density="comfortable"
              type="number"
              step="0.01"
              min="0"
              required
            />
          </VCol>

          <VCol cols="12" sm="6" class="d-flex align-center justify-space-between pl-sm-6">
            <div class="d-flex flex-column">
              <span class="text-subtitle-2 font-weight-bold">Grava IVA (15%)</span>
              <span class="text-caption text-medium-emphasis">¿Aplica impuestos al servicio?</span>
            </div>
            <VSwitch
              v-model="serviceForm.is_taxable"
              color="primary"
              hide-details
            />
          </VCol>

          <VCol
            v-if="error"
            cols="12"
          >
            <VAlert
              type="error"
              variant="tonal"
              closable
              class="ma-0 text-caption"
            >
              {{ error }}
            </VAlert>
          </VCol>

          <VCol
            cols="12"
            class="d-flex justify-end gap-3 mt-4"
          >
            <VBtn
              variant="outlined"
              color="secondary"
              :disabled="loading"
              @click="closeDialog"
            >
              Cancelar
            </VBtn>
            <VBtn
              type="submit"
              color="primary"
              :loading="loading"
              prepend-icon="ri-save-3-line"
            >
              Guardar Servicio
            </VBtn>
          </VCol>
        </VRow>
      </VForm>
    </VCard>
  </VDialog>

  <VSnackbar
    v-model="notificationShow"
    :color="notificationType"
    :timeout="2000"
    location="top"
  >
    {{ notificationMessage }}
  </VSnackbar>
</template>
