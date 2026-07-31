<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { getBrandNameById } from '@/data/vehicleBrands.js'

import ClientFinalAddDialog from '@/components/inventory/clients/ClientFinalAddDialog.vue'
import ClientCompanyAddDialog from '@/components/inventory/clients/ClientCompanyAddDialog.vue'
import VehicleAddDialog from '@/components/inventory/vehicles/VehicleAddDialog.vue'
import AddServiceDialog from '@/components/inventory/product/AddServiceDialog.vue'
import VSearch from '@/components/common/VSearch.vue'

const router = useRouter()
const route = useRoute()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()
const userId = ref(null)

const getUserId = () => {
  const userData = JSON.parse(localStorage.getItem('user'))
  userId.value = userData ? userData.id : null
}

const formRef = ref(null)
const isLoading = ref(false)
const isSubmitting = ref(false)
const showValidationError = ref(false)
const validationErrorMessage = ref('')

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const employees = ref([])

const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
}

const quote = ref({
  document_number: '',
  client_id: null,
  vehicle_id: null,
  work_order_id: null,
  mileage: null,
  service_date: getLocalDateString(),
  observations: '',
  technicians: [],
  items: [],
  user_id: userId.value,
})

const positiveNumberRule = v => v >= 0 || 'El valor no puede ser negativo'

const requiredRule = v => (
  v !== null &&
  v !== undefined &&
  v !== '' &&
  !(typeof v === 'number' && Number.isNaN(v))
) || 'Campo obligatorio'

const nextQuoteNumber = ref('')

const generateDocumentNumber = () => {
  return nextQuoteNumber.value || '000000000'
}

const isLinkedToWorkOrder = computed(() => !!quote.value.work_order_id)

const selectedClient = ref(null)
const selectedVehicle = ref(null)

const handleClientAdded = async (newClient) => {
  const clientObj = newClient.client || newClient.data || newClient
  selectedClient.value = clientObj
  showNotification('Cliente registrado exitosamente', 'success')
}

const handleVehicleAdded = async (newVehicle) => {
  const vehicleObj = newVehicle.vehicle || newVehicle.data || newVehicle
  selectedVehicle.value = vehicleObj
  showNotification('Vehículo registrado exitosamente', 'success')
}

watch(() => selectedClient.value, (newVal) => {
  if (newVal && newVal.id) {
    quote.value.client_id = newVal.id
  } else {
    quote.value.client_id = null
  }
})

watch(() => selectedVehicle.value, (newVal) => {
  if (newVal && newVal.id) {
    quote.value.vehicle_id = newVal.id
    if (newVal.client_id && !quote.value.client_id) {
      quote.value.client_id = newVal.client_id
      selectedClient.value = newVal.client || null
    }
  } else {
    quote.value.vehicle_id = null
  }
})

const productSearchQuery = ref('')
// Dialogs state
const isClientFinalDialogVisible = ref(false)
const isClientCompanyDialogVisible = ref(false)
const isVehicleDialogVisible = ref(false)
const isAddServiceDialogVisible = ref(false)



const selectedProductTemp = ref(null)

// Item actions
const addItem = (prod) => {
  if (!prod) return

  const existing = quote.value.items.find(item => item.product_id === prod.id)
  if (existing) {
    existing.quantity++
    showNotification('Cantidad incrementada', 'info')

    // Limpiar buscador
    nextTick(() => {
      selectedProductTemp.value = null
      productSearchQuery.value = ''
    })
    return
  }

  quote.value.items.push({
    product_id: prod.id,
    description: prod.description || prod.name || '',
    quantity: 1,
    price: parseFloat(prod.price_sale || prod.price) || 0,
    discount: 0,
    type: prod.item_type === 2 ? 'service' : 'product',
    sku: prod.sku || prod.code || '',
  })

  showNotification('Producto agregado a la cotización', 'success')

  // Limpiar buscador
  nextTick(() => {
    selectedProductTemp.value = null
    productSearchQuery.value = ''
  })
}

const addCustomService = (serviceData) => {
  quote.value.items.push({
    product_id: null,
    description: serviceData.description,
    quantity: 1,
    price: parseFloat(serviceData.price) || 0,
    discount: 0,
    type: 'service',
    sku: '',
  })
  showNotification('Servicio personalizado agregado', 'success')
}

const removeItem = (index) => {
  quote.value.items.splice(index, 1)
}

// Totals calculations (prices in grid already include IVA)
const subtotal = computed(() => {
  return quote.value.items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.price) || 0
    return sum + (qty * price)
  }, 0)
})

const totalDiscount = computed(() => {
  return quote.value.items.reduce((sum, item) => {
    return sum + (Number(item.discount) || 0)
  }, 0)
})

const total = computed(() => {
  return Math.max(0, subtotal.value - totalDiscount.value)
})

const displaySubtotal = computed(() => {
  return subtotal.value / 1.15
})

const displayDiscount = computed(() => {
  return totalDiscount.value / 1.15
})

const displaySubtotalNeto = computed(() => {
  return Math.max(0, displaySubtotal.value - displayDiscount.value)
})

const taxAmount = computed(() => {
  return total.value - displaySubtotalNeto.value
})

const loadInitialData = async () => {
  isLoading.value = true
  try {
    const [employeesRes, nextNumberRes] = await Promise.all([
      $api('employees', { params: { per_page: 1000 } }),
      $api('quotes/next-number'),
    ])

    const extractArray = (res, key) => {
      if (Array.isArray(res)) return res
      if (res?.[key] && Array.isArray(res[key])) return res[key]
      if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
      if (res?.data && Array.isArray(res.data)) return res.data
      return []
    }

    employees.value = extractArray(employeesRes, 'employees')
    nextQuoteNumber.value = nextNumberRes?.data || '000000000'
    quote.value.document_number = generateDocumentNumber()

  } catch (error) {
    console.error('Error al cargar datos:', error)
    showNotification('Error al cargar datos iniciales', 'error')
  } finally {
    isLoading.value = false
  }
}

const submitForm = async () => {
  getUserId()
  quote.value.user_id = userId.value
  showValidationError.value = false
  validationErrorMessage.value = ''

  if (formRef.value) {
    const { valid } = await formRef.value.validate()
    if (!valid) {
      showValidationError.value = true
      validationErrorMessage.value = 'Por favor, complete todos los campos obligatorios marcados con *'
      return
    }
  }

  if (!quote.value.client_id) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe seleccionar un cliente para continuar'
    return
  }

  if (quote.value.items.length === 0) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe agregar al menos un producto o servicio'
    return
  }

  isSubmitting.value = true

  try {
    const payload = {
      ...quote.value,
      subtotal: subtotal.value,
      tax_amount: taxAmount.value,
      total: total.value,
    }

    const response = await $api('quotes', {
      method: 'POST',
      body: payload,
    })

    if (response.success || response.status === 201) {
      showNotification('Cotización registrada exitosamente', 'success')
      router.push('/quotes/list')
    } else {
      showNotification(response.message || 'Error al registrar', 'error')
    }
  } catch (error) {
    console.error('Error enviando formulario', error)
    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'
    showNotification(errMsg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  await loadInitialData()
})
</script>

<template>
  <div class="pa-4 pa-sm-6">
    <div
      class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4 border-b pb-4">
      <div>
        <div class="d-flex align-center">
          <VAvatar color="info-lighten-5" size="48" class="mr-3">
            <VIcon icon="ri-file-list-3-line" size="32" color="info" />
          </VAvatar>
          <h1 class="text-h4 font-weight-bold mb-1">Registrar Cotización</h1>
        </div>
        <p class="text-medium-emphasis mb-0">Crea un presupuesto detallado para un cliente</p>
      </div>
      <VBtn color="secondary" variant="outlined" prepend-icon="ri-arrow-left-line" to="/quotes/list"
        class="align-self-md-center align-self-end bg-white">
        Volver al Listado
      </VBtn>
    </div>

    <VForm ref="formRef" @submit.prevent="submitForm">
      <VRow>
        <VCol cols="12" md="8">
          <!-- Cabecera de la Cotización -->
          <VCard class="elevation-2 mb-6">
            <VCardText class="pa-6">
              <VRow>
                <VCol cols="12" sm="6">
                  <VTextField v-model="quote.document_number" label="Secuencial Cotización" variant="outlined"
                    density="comfortable" :rules="[requiredRule]" readonly bg-color="grey-lighten-4"
                    prepend-inner-icon="ri-hashtag" />
                </VCol>
                <VCol cols="12" sm="6">
                  <VTextField v-model="quote.service_date" type="date" label="Fecha" variant="outlined"
                    density="comfortable" :rules="[requiredRule]" prepend-inner-icon="ri-calendar-line" />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Cliente y Vehículo -->
          <VCard class="elevation-2 mb-6">
            <VCardText class="pa-6">
              <div class="d-flex align-center justify-space-between mb-4">
                <h3 class="text-h6 font-weight-bold mb-0 d-flex align-center">
                  <VIcon icon="ri-user-settings-line" class="mr-2" color="info" />
                  Cliente y Vehículo
                </h3>
              </div>

              <VRow>
                <!-- Cliente -->
                <VCol cols="12" sm="6">
                  <div class="d-flex gap-2 align-center">
                    <VSearch
                      v-model="selectedClient"
                      :return-object="true"
                      endpoint="clients/search"
                      item-title="full_name"
                      label="Cliente *"
                      icon="ri-user-line"
                      :initial-item="selectedClient"
                      :rules="[(v) => !!quote.client_id || 'Cliente es requerido']"
                    >
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="item.raw.full_name || item.raw.name">
                          <VListItemSubtitle v-if="item.raw.n_document" class="mt-1 text-grey">
                            Documento: {{ item.raw.n_document }}
                          </VListItemSubtitle>
                        </VListItem>
                      </template>
                    </VSearch>
                    <VMenu>
                      <template #activator="{ props }">
                        <VBtn icon="ri-add-line" color="info" variant="tonal" v-bind="props" class="mb-5" />
                      </template>
                      <VList density="compact">
                        <VListItem title="Persona Natural" prepend-icon="ri-user-line"
                          @click="isClientFinalDialogVisible = true" />
                        <VListItem title="Empresa / Jurídico" prepend-icon="ri-building-line"
                          @click="isClientCompanyDialogVisible = true" />
                      </VList>
                    </VMenu>
                  </div>
                  <div v-if="selectedClient" class="text-caption text-grey mt-0 mb-3 ms-1">
                    <VIcon icon="ri-file-list-3-line" size="14" class="me-1" />
                    Cédula/RUC: <span class="font-weight-semibold">{{ selectedClient.n_document || 'N/A' }}</span>
                  </div>
                </VCol>

                <!-- Vehículo -->
                <VCol cols="12" sm="6">
                  <div class="d-flex gap-2 align-center">
                    <VSearch
                      v-model="selectedVehicle"
                      :return-object="true"
                      endpoint="vehicles/search"
                      item-title="license_plate"
                      label="Vehículo"
                      icon="ri-car-line"
                      :initial-item="selectedVehicle"
                      :extra-params="quote.client_id ? { client_id: quote.client_id } : {}"
                    >
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="item.raw.license_plate">
                          <VListItemSubtitle class="mt-1 text-grey">
                            {{ item.raw.brand?.name || item.raw.brand || '' }} {{ item.raw.model || '' }}
                          </VListItemSubtitle>
                        </VListItem>
                      </template>
                    </VSearch>
                    <VBtn icon="ri-add-line" color="info" variant="tonal" @click="isVehicleDialogVisible = true"
                      class="mb-5" />
                  </div>
                </VCol>

                <!-- Datos del Cliente (3 Relevantes) -->
                <VCol v-if="selectedClient" cols="12" sm="6">
                  <VCard variant="flat" color="grey-lighten-4" class="pa-4 rounded-lg">
                    <div class="font-weight-bold text-subtitle-2 mb-2 text-grey-darken-3">Datos del Cliente</div>
                    <div class="text-caption d-flex flex-column gap-1">
                      <div><strong>Documento:</strong> {{ selectedClient.n_document || '-' }}</div>
                      <div><strong>Teléfono:</strong> {{ selectedClient.phone || '-' }}</div>
                      <div><strong>Correo:</strong> {{ selectedClient.email || '-' }}</div>
                    </div>
                  </VCard>
                </VCol>

                <!-- Datos del Vehículo (3 Relevantes) -->
                <VCol v-if="selectedVehicle" cols="12" sm="6">
                  <VCard variant="flat" color="grey-lighten-4" class="pa-4 rounded-lg">
                    <div class="font-weight-bold text-subtitle-2 mb-2 text-grey-darken-3">Datos del Vehículo</div>
                    <div class="text-caption d-flex flex-column gap-1">
                      <div><strong>Placa:</strong> <span class="text-uppercase font-weight-bold text-info">{{
                          selectedVehicle.license_plate }}</span></div>
                      <div><strong>Marca/Modelo:</strong> {{ selectedVehicle.displayTitle }}</div>
                      <div><strong>Color/Año:</strong> {{ selectedVehicle.color || '-' }} / {{ selectedVehicle.year ||
                        '-' }}</div>
                    </div>
                  </VCard>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Búsqueda y Agregar Items -->
          <VCard class="elevation-2 mb-6">
            <VCardText class="pa-6">
              <div class="d-flex align-center justify-space-between mb-4">
                <h3 class="text-h6 font-weight-bold mb-0 d-flex align-center">
                  <VIcon icon="ri-shopping-cart-line" class="mr-2" color="info" />
                  Servicios y Repuestos
                </h3>
                <VBtn color="info" size="small" variant="text" prepend-icon="ri-add-line"
                  @click="isAddServiceDialogVisible = true">
                  Servicio Personalizado
                </VBtn>
              </div>

              <VSearch
                v-model="selectedProductTemp"
                endpoint="products/search"
                item-title="description"
                :return-object="true"
                label="Buscar repuesto o servicio por SKU, código o nombre..."
                icon="ri-search-line"
                @change="addItem"
                class="mb-6"
              >
                <template #item="{ props, item }">
                  <VListItem v-bind="props" :title="undefined">
                    <VListItemTitle style="white-space: normal !important; line-height: 1.4;" class="font-weight-medium">
                      {{ item.raw.description || item.raw.name }}
                    </VListItemTitle>
                    <VListItemSubtitle v-if="item.raw.code_aux || item.raw.sku" class="mt-1 text-grey">
                      Código/SKU: {{ item.raw.code_aux || item.raw.sku }}
                    </VListItemSubtitle>
                  </VListItem>
                </template>
              </VSearch>

              <!-- Tabla de Items Agregados -->
              <VTable v-if="quote.items.length > 0" hover class="border rounded">
                <thead>
                  <tr>
                    <th class="text-left">Item / Descripción</th>
                    <th class="text-center" style="width: 100px;">Cant.</th>
                    <th class="text-right" style="width: 140px;">PVP ($)</th>
                    <th class="text-right" style="width: 120px;">Desc. ($)</th>
                    <th class="text-right" style="width: 120px;">Total</th>
                    <th class="text-center" style="width: 60px;"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in quote.items" :key="index">
                    <td class="text-left font-weight-medium">
                      {{ item.description }}
                      <div class="text-caption text-medium-emphasis">{{ item.sku || 'Sin Código' }}</div>
                    </td>
                    <td class="text-center">
                      <VTextField v-model.number="item.quantity" type="number" min="1" variant="underlined"
                        density="compact" hide-details class="text-center" />
                    </td>
                    <td class="text-right">
                      <VTextField v-model.number="item.price" type="number" prefix="$" variant="underlined"
                        density="compact" hide-details class="text-right" />
                    </td>
                    <td class="text-right">
                      <VTextField v-model.number="item.discount" type="number" prefix="$" variant="underlined"
                        density="compact" hide-details class="text-right" />
                    </td>
                    <td class="text-right font-weight-bold">
                      ${{ (((Number(item.quantity) || 0) * (Number(item.price) || 0)) - (Number(item.discount) ||
                      0)).toFixed(2)
                      }}
                    </td>
                    <td class="text-center">
                      <VBtn icon="ri-delete-bin-line" color="error" variant="text" size="small"
                        @click="removeItem(index)" />
                    </td>
                  </tr>
                </tbody>
              </VTable>

              <div v-else class="text-center py-10 border-2 border-dashed rounded bg-grey-lighten-5">
                <VIcon icon="ri-inbox-line" size="40" color="grey-lighten-1" class="mb-2" />
                <div class="text-subtitle-1 text-medium-emphasis">No hay repuestos o servicios agregados.</div>
                <div class="text-caption text-grey">Busca productos en el campo superior o agrega un servicio
                  personalizado.</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" md="4">
          <!-- Observaciones -->
          <VCard class="elevation-2 mb-6">
            <VCardText class="pa-6">
              <h3 class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center">
                <VIcon icon="ri-chat-1-line" class="mr-2" color="info" />
                Observaciones del Presupuesto
              </h3>
              <VTextarea v-model="quote.observations" rows="4"
                placeholder="Indique términos, condiciones de garantía, validez de la cotización..." variant="outlined"
                density="comfortable" hide-details />
            </VCardText>
          </VCard>

          <!-- Resumen del Presupuesto -->
          <VCard class="elevation-4 mb-6 border-info border-t-4">
            <VCardText class="pa-6">
              <h3 class="text-h6 font-weight-bold mb-4 text-grey-darken-4">Resumen</h3>

              <div class="d-flex justify-space-between mb-3 text-body-1">
                <span class="text-medium-emphasis">Subtotal (Sin IVA):</span>
                <span class="font-weight-medium text-grey-darken-4">${{ displaySubtotal.toFixed(2) }}</span>
              </div>

              <div v-if="totalDiscount > 0" class="d-flex justify-space-between mb-3 text-body-1 text-error">
                <span>Descuento (Sin IVA):</span>
                <span class="font-weight-bold">-${{ displayDiscount.toFixed(2) }}</span>
              </div>

              <div class="d-flex justify-space-between mb-3 text-body-1">
                <span class="text-medium-emphasis">Subtotal Neto (Sin IVA):</span>
                <span class="font-weight-medium text-grey-darken-4">${{ displaySubtotalNeto.toFixed(2) }}</span>
              </div>

              <div class="d-flex justify-space-between mb-3 text-body-1">
                <span class="text-medium-emphasis">IVA (15%):</span>
                <span class="font-weight-medium text-grey-darken-4">${{ taxAmount.toFixed(2) }}</span>
              </div>

              <VDivider class="my-4" />

              <div class="d-flex justify-space-between align-center mb-6">
                <span class="text-h6 font-weight-bold text-grey-darken-4">TOTAL:</span>
                <span class="text-h5 font-weight-black text-info">${{ total.toFixed(2) }}</span>
              </div>

              <VAlert v-if="showValidationError" type="error" variant="tonal" density="compact" class="mb-4">
                {{ validationErrorMessage }}
              </VAlert>

              <VBtn type="submit" color="info" variant="elevated" prepend-icon="ri-save-3-line" :loading="isSubmitting"
                size="large" block class="text-none font-weight-bold mb-3 elevation-2">
                Guardar Cotización
              </VBtn>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </VForm>

    <!-- Dialogs -->
    <ClientFinalAddDialog v-if="isClientFinalDialogVisible" v-model:isDialogVisible="isClientFinalDialogVisible"
      @client-added="handleClientAdded" />
    <ClientCompanyAddDialog v-if="isClientCompanyDialogVisible" v-model:isDialogVisible="isClientCompanyDialogVisible"
      @client-added="handleClientAdded" />
    <VehicleAddDialog v-if="isVehicleDialogVisible" v-model:isDialogVisible="isVehicleDialogVisible"
      :client-selected-id="quote.client_id" @vehicle-added="handleVehicleAdded" />
    <AddServiceDialog v-if="isAddServiceDialogVisible" v-model:isDialogVisible="isAddServiceDialogVisible"
      @add-service="addCustomService" />
  </div>
</template>
