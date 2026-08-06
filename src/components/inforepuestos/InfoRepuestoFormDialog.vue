<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  requestSelected: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'saveSuccess'])

const { showNotification } = useGlobalToast()

const isSaving = ref(false)
const form = ref({
  brand: '',
  model: '',
  year: null,
  traction: '',
  origin_country: '',
  items: [
    {
      spare_parts_detail: '',
      spare_part_brand: '',
      category: '',
      purchase_price: null,
      public_price: null,
    }
  ]
})

// Rules
const rules = {
  required: v => !!v || 'Este campo es obligatorio',
  year: v => (!!v && v >= 1900 && v <= new Date().getFullYear() + 5) || 'Año no válido',
  price: v => (v !== null && v !== undefined && v !== '' && v >= 0) || 'El precio debe ser un número positivo',
}

const resetForm = () => {
  form.value = {
    brand: '',
    model: '',
    year: null,
    traction: '',
    origin_country: '',
    items: [
      {
        spare_parts_detail: '',
        spare_part_brand: '',
        category: '',
        purchase_price: null,
        public_price: null,
      }
    ]
  }
}

const addItem = () => {
  form.value.items.push({
    spare_parts_detail: '',
    spare_part_brand: '',
    category: '',
    purchase_price: null,
    public_price: null,
  })
}

const removeItem = (index) => {
  form.value.items.splice(index, 1)
}

// Watch dialog visibility and request selected
watch(
  () => props.isDialogVisible,
  (val) => {
    if (val) {
      if (props.requestSelected) {
        form.value = { 
          ...props.requestSelected,
          items: props.requestSelected.items ? JSON.parse(JSON.stringify(props.requestSelected.items)) : [
            {
              spare_parts_detail: '',
              spare_part_brand: '',
              category: '',
              purchase_price: null,
              public_price: null,
            }
          ]
        }
      } else {
        resetForm()
      }
    }
  }
)

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

// Encabezado estructurado generado automáticamente
const vehicleHeader = computed(() => {
  if (!form.value.brand && !form.value.model) return ''
  const brand = (form.value.brand || '').toUpperCase().trim()
  const model = (form.value.model || '').toUpperCase().trim()
  const traction = (form.value.traction || '').toUpperCase().trim()
  const year = form.value.year || ''
  return `VEHÍCULO: ${brand} ${model} ${traction ? traction + ' ' : ''}DEL ${year}`.trim()
})

const save = async () => {
  // Validate vehicle info
  if (!form.value.brand || !form.value.model || !form.value.year) {
    showNotification('Por favor, rellene todos los campos del vehículo', 'error')
    return
  }

  // Validate items
  if (!form.value.items || form.value.items.length === 0) {
    showNotification('Debe agregar al menos un repuesto', 'error')
    return
  }

  for (let i = 0; i < form.value.items.length; i++) {
    const item = form.value.items[i]
    if (
      !item.spare_parts_detail ||
      !item.spare_part_brand ||
      !item.category ||
      item.purchase_price === null ||
      item.purchase_price === undefined ||
      item.public_price === null ||
      item.public_price === undefined
    ) {
      showNotification(`Por favor, rellene todos los campos del repuesto #${i + 1}`, 'error')
      return
    }
  }

  isSaving.value = true
  try {
    const isEdit = !!props.requestSelected
    const url = isEdit ? `spare-part-requests/${props.requestSelected.id}` : 'spare-part-requests'
    const method = isEdit ? 'PUT' : 'POST'

    const response = await $api(url, {
      method,
      body: form.value,
    })

    if (response) {
      showNotification(response.message || 'Registro guardado correctamente', 'success')
      emit('saveSuccess', response.data)
      closeDialog()
    }
  } catch (error) {
    console.error('Error al guardar la búsqueda de repuesto:', error)
    const errorMsg = error.response?._data?.message || 'Error al guardar el registro'
    showNotification(errorMsg, 'error')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <VDialog max-width="950" :model-value="props.isDialogVisible" @update:model-value="closeDialog" scrollable>
    <VCard class="rounded-xl overflow-hidden relative">
      <!-- Clean & Sober Header -->
      <VCardTitle class="d-flex align-center justify-space-between pa-6 border-b">
        <div class="d-flex align-center gap-2">
          <VIcon icon="ri-roadster-line" color="primary" size="24" />
          <span class="text-h5 font-weight-bold text-high-emphasis">
            {{ props.requestSelected ? 'Editar Búsqueda de Repuestos' : 'Registrar Búsqueda de Repuestos' }}
          </span>
        </div>
        <DialogCloseBtn variant="text" size="default" @click="closeDialog" />
      </VCardTitle>

      <VCardText class="pa-6" style="max-height: 70vh;">
        <!-- Vista previa del encabezado generado -->
        <div v-if="vehicleHeader" class="mb-6">
          <div class="header-preview-box text-center py-2 px-3 rounded text-subtitle-2 font-weight-bold primary--text">
            {{ vehicleHeader }}
          </div>
        </div>

        <VForm @submit.prevent="save">
          <VRow dense>
            <!-- Sección Datos del Vehículo -->
            <VCol cols="12" class="mb-4">
              <div class="form-group-section pa-5 rounded-xl border" style="background-color: rgba(var(--v-theme-on-surface), 0.015); border-color: rgba(var(--v-border-color), 0.12) !important;">
                <div class="d-flex align-center gap-2 mb-4">
                  <VIcon icon="ri-roadster-line" color="primary" size="20" />
                  <span class="text-subtitle-1 font-weight-bold text-high-emphasis">DATOS TÉCNICOS DEL VEHÍCULO</span>
                </div>
                <VRow dense>
                  <VCol cols="12" sm="6">
                    <VTextField
                      v-model="form.brand"
                      label="Marca del Vehículo *"
                      placeholder="Ej: Chevrolet"
                      prepend-inner-icon="ri-road-map-line"
                      :rules="[rules.required]"
                      clearable
                      variant="outlined"
                    />
                  </VCol>

                  <VCol cols="12" sm="6">
                    <VTextField
                      v-model="form.model"
                      label="Modelo del Vehículo *"
                      placeholder="Ej: Vitara Clásico"
                      prepend-inner-icon="ri-car-line"
                      :rules="[rules.required]"
                      clearable
                      variant="outlined"
                    />
                  </VCol>

                  <VCol cols="12" sm="4">
                    <VTextField
                      v-model.number="form.year"
                      label="Año del Vehículo *"
                      type="number"
                      placeholder="Ej: 2007"
                      prepend-inner-icon="ri-calendar-line"
                      :rules="[rules.required, rules.year]"
                      clearable
                      variant="outlined"
                    />
                  </VCol>

                  <VCol cols="12" sm="4">
                    <VTextField
                      v-model="form.traction"
                      label="Tracción / Suspensión"
                      placeholder="Ej: 4x4, 4x2"
                      prepend-inner-icon="ri-compass-line"
                      clearable
                      variant="outlined"
                    />
                  </VCol>

                  <VCol cols="12" sm="4">
                    <VTextField
                      v-model="form.origin_country"
                      label="País de Procedencia"
                      placeholder="Ej: Japón, Ecuador"
                      prepend-inner-icon="ri-earth-line"
                      clearable
                      variant="outlined"
                    />
                  </VCol>
                </VRow>
              </div>
            </VCol>

            <!-- Sección de Repuestos -->
            <VCol cols="12" class="mb-4">
              <div class="form-group-section pa-5 rounded-xl border" style="border-color: rgba(var(--v-border-color), 0.12) !important;">
                <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-4">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-settings-3-line" color="primary" size="20" />
                    <span class="text-subtitle-1 font-weight-bold text-high-emphasis">REPUESTOS COMPATIBLES REGISTRADOS</span>
                  </div>
                  <VBtn size="small" color="primary" variant="elevated" prepend-icon="ri-add-line" class="rounded-lg" @click="addItem">
                    Agregar Repuesto
                  </VBtn>
                </div>

                <div class="d-flex flex-column gap-6">
                  <div 
                    v-for="(item, index) in form.items" 
                    :key="index" 
                    class="form-spare-card pa-4 rounded-xl border relative"
                    style="background-color: rgba(var(--v-theme-primary), 0.01); border-color: rgba(var(--v-border-color), 0.1) !important;"
                  >
                    <!-- Item Header / Delete Button -->
                    <div class="d-flex justify-space-between align-center mb-4 border-b pb-2">
                      <span class="text-subtitle-2 font-weight-bold text-primary">
                        REPUESTO COMPATIBLE #{{ index + 1 }}
                      </span>
                      <VBtn 
                        v-if="form.items.length > 1"
                        size="small" 
                        color="error" 
                        variant="tonal" 
                        prepend-icon="ri-delete-bin-line"
                        class="rounded-lg"
                        @click="removeItem(index)"
                      >
                        Eliminar
                      </VBtn>
                    </div>

                    <VRow dense>
                      <VCol cols="12" class="pb-2">
                        <VTextarea
                          v-model="item.spare_parts_detail"
                          label="Detalle / Descripción del Repuesto *"
                          placeholder="Ej: Amortiguadores delanteros"
                          prepend-inner-icon="ri-tools-line"
                          rows="2"
                          :rules="[rules.required]"
                          auto-grow
                          clearable
                          variant="outlined"
                        />
                      </VCol>

                      <VCol cols="12" sm="6" class="pb-2">
                        <VTextField
                          v-model="item.spare_part_brand"
                          label="Marca del Repuesto *"
                          placeholder="Ej: Tokico, KYB"
                          prepend-inner-icon="ri-price-tag-2-line"
                          :rules="[rules.required]"
                          clearable
                          variant="outlined"
                        />
                      </VCol>

                      <VCol cols="12" sm="6" class="pb-2">
                        <VTextField
                          v-model="item.category"
                          label="Categoría / Concepto *"
                          placeholder="Ej: Suspensión"
                          prepend-inner-icon="ri-folders-line"
                          :rules="[rules.required]"
                          clearable
                          variant="outlined"
                        />
                      </VCol>

                      <VCol cols="12" sm="6" class="pb-2">
                        <VTextField
                          v-model.number="item.purchase_price"
                          label="Costo Adquisición (Compra) *"
                          type="number"
                          step="0.01"
                          min="0"
                          prefix="$"
                          placeholder="0.00"
                          prepend-inner-icon="ri-money-dollar-circle-line"
                          :rules="[rules.required, rules.price]"
                          clearable
                          variant="outlined"
                        />
                      </VCol>

                      <VCol cols="12" sm="6" class="pb-2">
                        <VTextField
                          v-model.number="item.public_price"
                          label="PVP (Venta al Público) *"
                          type="number"
                          step="0.01"
                          min="0"
                          prefix="$"
                          placeholder="0.00"
                          prepend-inner-icon="ri-price-tag-3-line"
                          :rules="[rules.required, rules.price]"
                          clearable
                          variant="outlined"
                        />
                      </VCol>
                    </VRow>
                  </div>
                </div>
              </div>
            </VCol>
          </VRow>
          
          <!-- Submit Button dummy to catch form submit -->
          <input type="submit" style="display: none" />
        </VForm>
      </VCardText>

      <!-- Bottom Sticky Actions -->
      <VDivider />
      <VCardActions class="pa-4 d-flex justify-center gap-4">
        <VBtn color="primary" variant="elevated" prepend-icon="ri-save-line" :loading="isSaving" class="px-6 rounded-lg" @click="save">
          {{ props.requestSelected ? 'Actualizar Registro' : 'Guardar Registro' }}
        </VBtn>

        <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" class="px-6 rounded-lg" @click="closeDialog" :disabled="isSaving">
          Cancelar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
