<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { getBrandNameById } from '@/data/vehicleBrands'

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
const showValidationError = ref(false)
const validationErrorMessage = ref('')
const originalQuantities = ref({})

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const employees = ref([])

const workOrder = ref({
  number: '',
  date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
  client_id: null,
  vehicle_id: null,
  user_id: userId.value,
  mileage: null,
  fuel_level: '',
  observations: '',
  technicians: [],
  items: [],
})

const fuelLevels = [
  { title: '1/4', value: '1/4' },
  { title: '1/2', value: '1/2' },
  { title: '3/4', value: '3/4' },
  { title: 'Full', value: 'Full' },
  { title: 'Reserva', value: 'Reserva' },
]

const showClientDialog = ref(false)
const showCompanyDialog = ref(false)
const showVehicleDialog = ref(false)
const showAddServiceDialog = ref(false)
const productSearch = ref(null)

const loadInitialData = async () => {
  isLoading.value = true
  try {
    getUserId()
    workOrder.value.user_id = userId.value

    const [employeesRes, workOrdersRes] = await Promise.all([
      $api('employees', { params: { per_page: 1000 } }),
      $api('work-orders'),
    ])

    employees.value = Array.isArray(employeesRes.employees) ? employeesRes.employees :
      Array.isArray(employeesRes.data) ? employeesRes.data : []

    const workOrdersList = Array.isArray(workOrdersRes.data) ? workOrdersRes.data :
      (Array.isArray(workOrdersRes) ? workOrdersRes : [])

    let maxOtNumber = 0
    for (const wo of workOrdersList) {
      if (wo.number?.toUpperCase().startsWith('OT-')) {
        const match = wo.number.match(/OT-?(\d+)/i)
        if (match) {
          const num = parseInt(match[1])
          if (num > maxOtNumber) maxOtNumber = num
        }
      }
    }
    workOrder.value.number = 'OT-' + String(maxOtNumber + 1).padStart(7, '0')

    console.log('Employees loaded:', employees.value.length)

    // Si es edición, cargar la orden de trabajo
    const orderId = route.params.id
    if (orderId) {
      await loadWorkOrder(orderId)
    }

  } catch (error) {
    console.error('Error al cargar datos:', error)
    showNotification('Error al cargar datos iniciales', 'error')
  } finally {
    isLoading.value = false
  }
} 

const originalStatus = ref('')

const loadWorkOrder = async id => {
  try {
    const response = await $api(`work-orders/${id}`)
    const data = response.data || response

    originalStatus.value = data.status

    workOrder.value = {
      number: data.number,
      date: data.date ? new Date(data.date).toISOString().split('T')[0] : new Date(data.created_at).toISOString().split('T')[0],
      client_id: data.client_id,
      vehicle_id: data.vehicle_id,
      user_id: data.user_id,
      mileage: data.mileage,
      fuel_level: data.fuel_level,
      observations: data.observations || '',
      technicians: data.technicians ? data.technicians.map(t => t.id) : [],
      items: (data.items || []).map(item => {
        if (item.product && !products.value.find(p => p.id === item.product.id)) {
          products.value.push(item.product)
        }
        
        return {
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price) || 0,
          discount: parseFloat(item.discount) || 0,
          type: item.type,
          sku: item.product ? item.product.sku : '',
        }
      }),
    }

    // Guardar las cantidades originales de los productos en esta OT
    originalQuantities.value = {}
    if (data.items) {
      data.items.forEach(item => {
        if (item.product_id) {
          originalQuantities.value[item.product_id] = (originalQuantities.value[item.product_id] || 0) + item.quantity
        }
      })
    }
    
    if (data.client) selectedClient.value = data.client
    if (data.vehicle) selectedVehicle.value = data.vehicle
  } catch (error) {
    console.error('Error al cargar la orden:', error)
    showNotification('Error al cargar la orden de trabajo', 'error')
  }
}

const validateForm = () => {
  if (!workOrder.value.number) {
    validationErrorMessage.value = 'El número de orden es requerido'
    showValidationError.value = true

    return false
  }
  if (!workOrder.value.client_id) {
    validationErrorMessage.value = 'Debe seleccionar un cliente'
    showValidationError.value = true

    return false
  }

  return true
}

const saveWorkOrder = async () => {
  if (!validateForm()) return

  for (const item of workOrder.value.items) {
    if (item.type === 'product' && item.product_id) {
      const product = products.value.find(p => p.id === item.product_id)
      if (product) {
        const originalQty = originalQuantities.value[item.product_id] || 0
        const additionalQty = item.quantity - originalQty
        if (additionalQty > 0 && product.stock < additionalQty) {
          showValidationError.value = true
          validationErrorMessage.value = `Stock insuficiente para ${product.description || product.name || 'el producto'}. Stock disponible: ${product.stock}, Requerido adicional: ${additionalQty}`
          
          return
        }
      }
    }
  }

  isLoading.value = true
  try {
    const payload = {
      ...workOrder.value,
      technicians: workOrder.value.technicians.map(t => typeof t === 'object' ? t.id : t),
      is_draft: false,
    }

    const response = await $api(`work-orders/${route.params.id}`, {
      method: 'PUT',
      body: payload,
    })

    showNotification('Orden de trabajo finalizada exitosamente', 'success')
    router.push({ name: 'work-orders-list' })
  } catch (error) {
    console.error('Error al actualizar orden de trabajo:', error)
    
    // ofetch usa error.data para la respuesta JSON
    const errorData = error.data || (error.response && error.response._data)

    if (errorData) {
      if (errorData.error === 'stock_insufficient' || errorData.error === 'discount_exceeded') {
        showNotification(errorData.message, 'error')
      } else {
        showNotification(errorData.message || 'Error al actualizar la orden de trabajo', 'error')
      }
    } else {
      showNotification('Error al actualizar la orden de trabajo', 'error')
    }
  } finally {
    isLoading.value = false
  }
}

const saveDraft = async () => {
  if (!validateForm()) return

  isLoading.value = true
  try {
    const payload = {
      ...workOrder.value,
      technicians: workOrder.value.technicians.map(t => typeof t === 'object' ? t.id : t),
      is_draft: true,
    }

    const response = await $api(`work-orders/${route.params.id}`, {
      method: 'PUT',
      body: payload,
    })

    showNotification('Borrador de orden actualizado exitosamente', 'success')
    router.push({ name: 'work-orders-list' })
  } catch (error) {
    console.error('Error al guardar borrador:', error)

    const errorData = error.data || (error.response && error.response._data)
    if (errorData) {
      showNotification(errorData.message || 'Error al guardar borrador', 'error')
    } else {
      showNotification('Error al guardar borrador', 'error')
    }
  } finally {
    isLoading.value = false
  }
}

const cancel = () => {
  router.push({ name: 'work-orders-list' })
}

const selectedClient = ref(null)
const selectedVehicle = ref(null)

const onClientAdded = async newClient => {
  const clientObj = newClient.client || newClient.data || newClient

  selectedClient.value = clientObj
  showClientDialog.value = false
}

const onCompanyAdded = async newCompany => {
  const companyObj = newCompany.client || newCompany.data || newCompany

  selectedClient.value = companyObj
  showCompanyDialog.value = false
}

const onVehicleAdded = async newVehicle => {
  const vehicleObj = newVehicle.vehicle || newVehicle.data || newVehicle

  selectedVehicle.value = vehicleObj
  showVehicleDialog.value = false
}

watch(() => selectedClient.value, newVal => {
  if (newVal && newVal.id) {
    workOrder.value.client_id = newVal.id
  } else {
    workOrder.value.client_id = null
  }
})

watch(() => selectedVehicle.value, newVal => {
  if (newVal && newVal.id) {
    workOrder.value.vehicle_id = newVal.id
    if (newVal.client_id && !workOrder.value.client_id) {
      workOrder.value.client_id = newVal.client_id
      selectedClient.value = newVal.client || null
    }
  } else {
    workOrder.value.vehicle_id = null
  }
})

const handleServiceAdded = newService => {
  if (newService) {
    products.value = [newService, ...products.value]
    addProductFromSearch(newService)
  }
}

// Funciones para items

const removeItem = index => {
  workOrder.value.items.splice(index, 1)
}

const addTemporaryProduct = () => {
  workOrder.value.items.push({
    product_id: null,
    description: 'Producto Temporal',
    quantity: 1,
    unit_price: 0,
    discount: 0,
    type: 'product',
    sku: '',
  })
}

const calculateItemSubtotal = item => {
  const quantity = parseFloat(item.quantity) || 0
  const unitPrice = parseFloat(item.unit_price) || 0
  const discount = parseFloat(item.discount) || 0

  return (quantity * unitPrice) - discount
}

const calculateTotal = () => {
  return workOrder.value.items.reduce((total, item) => {
    return total + calculateItemSubtotal(item)
  }, 0)
}

const getProductPrice = productId => {
  const product = products.value.find(p => p.id === productId)

  return product ? parseFloat(product.price) : 0
}

const getProductStock = productId => {
  const product = products.value.find(p => p.id === productId)

  return product ? product.stock : 0
}

const getProductSku = productId => {
  const product = products.value.find(p => p.id === productId)
  
  return product ? (product.sku || product.code_aux || product.code || '') : ''
}

const onProductChanged = item => {
  if (item.product_id) {
    const product = products.value.find(p => p.id === item.product_id)
    if (product) {
      item.description = product.name || product.description || ''
      item.unit_price = parseFloat(product.price) || 0
    }
  }
}



// Agregar producto desde búsqueda
const addProductFromSearch = product => {
  if (product && !products.value.find(p => p.id === product.id)) {
    products.value.push(product)
  }

  // Determinar si es servicio basado en item_type o categoría
  const isService = product.item_type === 2 ||
    (product.categorie && product.categorie.title && product.categorie.title.includes('SERVICIO'))

  const existingItemIndex = workOrder.value.items.findIndex(item => item.product_id === product.id)

  if (existingItemIndex !== -1) {
    workOrder.value.items[existingItemIndex].quantity += 1
  } else {
    workOrder.value.items.push({
      product_id: product.id,
      description: product.description || product.name || '',
      quantity: 1,
      unit_price: parseFloat(product.price_sale) || parseFloat(product.price) || 0,
      discount: 0,
      type: isService ? 'service' : 'product',
      sku: product.sku || product.code || '',
    })
  }
  productSearch.value = null
}

watch(() => workOrder.value.vehicle_id, newVal => {
  if (isLoading.value) return // Ignorar durante la carga inicial
  
  if (newVal && !workOrder.value.client_id) {
    const selectedVeh = vehicles.value.find(v => v.id === newVal)
    if (selectedVeh && selectedVeh.client_id) {
      workOrder.value.client_id = selectedVeh.client_id
    }
  }
})

onMounted(() => {
  loadInitialData()
})
</script>

<template>
  <VContainer class="pa-6 position-relative">
    <VProgressLinear
      v-if="isLoading"
      v-slot
      indeterminate
      color="primary"
      height="3"
      class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 10;"
    />

    <!-- Form Skeleton loader -->
    <div
      v-if="isLoading"
      class="d-flex flex-column gap-6"
    >
      <VRow>
        <VCol
          cols="12"
          md="8"
        >
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div
              class="shimmer-line w-40 mb-6"
              style="height: 24px;"
            />
            <VRow class="mb-4">
              <VCol
                cols="12"
                sm="6"
              >
                <div
                  class="shimmer-line w-100 mb-2"
                  style="height: 48px; border-radius: 8px;"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <div
                  class="shimmer-line w-100 mb-2"
                  style="height: 48px; border-radius: 8px;"
                />
              </VCol>
            </VRow>
            <div
              class="shimmer-line w-100 mb-4"
              style="height: 80px; border-radius: 8px;"
            />
            <div
              class="shimmer-line w-100"
              style="height: 120px; border-radius: 8px;"
            />
          </VCard>
        </VCol>
        <VCol
          cols="12"
          md="4"
        >
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div
              class="shimmer-line w-60 mb-6"
              style="height: 24px;"
            />
            <div
              class="shimmer-line w-100 mb-4"
              style="height: 48px; border-radius: 8px;"
            />
            <div
              class="shimmer-line w-100 mb-4"
              style="height: 48px; border-radius: 8px;"
            />
            <VDivider class="my-4" />
            <div class="d-flex justify-space-between mb-2">
              <div class="shimmer-line w-30" />
              <div class="shimmer-line w-20" />
            </div>
            <div class="d-flex justify-space-between mb-4">
              <div class="shimmer-line w-40" />
              <div class="shimmer-line w-30" />
            </div>
            <div
              class="shimmer-line w-100"
              style="height: 48px; border-radius: 8px;"
            />
          </VCard>
        </VCol>
      </VRow>
    </div>

    <VRow v-else>
      <VCol cols="12">
        <!-- Header -->
        <div class="d-flex align-center mb-6">
          <VBtn
            icon="ri-arrow-left-line"
            variant="text"
            class="mr-3"
            size="large"
            @click="cancel"
          />
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">
              Editar Orden de Trabajo
            </h1>
            <p class="text-body-2 text-grey">
              Modifica la información de la orden de trabajo
            </p>
          </div>
        </div>



        <!-- Información del Cliente y Vehículo -->
        <VCard class="elevation-2 mb-4">
          <VCardText class="pa-6">
            <div class="d-flex align-center mb-6">
              <VAvatar
                size="48"
                color="primary"
                variant="tonal"
                class="mr-3"
              >
                <VIcon
                  icon="ri-car-line"
                  size="28"
                />
              </VAvatar>
              <div>
                <h3 class="text-h5 font-weight-bold mb-0">
                  Información del Cliente y Vehículo
                </h3>
                <p class="text-caption text-grey mb-0">
                  Selecciona el cliente y el vehículo para la orden
                </p>
              </div>
            </div>

            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4">
                  <VTextField
                    v-model="workOrder.number"
                    label="Número de Orden *"
                    prepend-inner-icon="ri-hashtag"
                    variant="outlined"
                    :rules="[(v) => !!v || 'Número de orden es requerido']"
                  />
                </div>
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4">
                  <VTextField
                    v-model="workOrder.date"
                    type="date"
                    label="Fecha *"
                    prepend-inner-icon="ri-calendar-line"
                    variant="outlined"
                    :rules="[(v) => !!v || 'Fecha es requerida']"
                  />
                </div>
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4">
                  <VSearch
                    v-model="selectedClient"
                    :return-object="true"
                    endpoint="clients/search"
                    item-title="full_name"
                    label="Cliente *"
                    icon="ri-user-line"
                    :initial-item="selectedClient"
                    :rules="[(v) => !!workOrder.client_id || 'Cliente es requerido']"
                  >
                    <template #item="{ props, item }">
                      <VListItem
                        v-bind="props"
                        :title="item.raw.full_name || item.raw.name"
                      >
                        <VListItemSubtitle
                          v-if="item.raw.n_document"
                          class="mt-1 text-grey"
                        >
                          Documento: {{ item.raw.n_document }}
                        </VListItemSubtitle>
                      </VListItem>
                    </template>
                    <template #append>
                      <VBtn
                        icon
                        size="small"
                        variant="tonal"
                        color="primary"
                      >
                        <VIcon icon="ri-add-line" />
                        <VMenu activator="parent">
                          <VList>
                            <VListItem
                              prepend-icon="ri-user-line"
                              title="Cliente Final"
                              @click="showClientDialog = true"
                            />
                            <VListItem
                              prepend-icon="ri-building-line"
                              title="Cliente Empresa"
                              @click="showCompanyDialog = true"
                            />
                          </VList>
                        </VMenu>
                      </VBtn>
                    </template>
                  </VSearch>
                </div>
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <div
                  class="mb-4"
                  style="text-transform: uppercase;"
                >
                  <VSearch
                    v-model="selectedVehicle"
                    :return-object="true"
                    endpoint="vehicles/search"
                    item-title="license_plate"
                    label="Vehículo"
                    icon="ri-car-line"
                    :initial-item="selectedVehicle"
                    :extra-params="workOrder.client_id ? { client_id: workOrder.client_id } : {}"
                  >
                    <template #item="{ props, item }">
                      <VListItem
                        v-bind="props"
                        :title="item.raw.license_plate"
                      >
                        <VListItemSubtitle class="mt-1 text-grey">
                          {{ item.raw.brand?.name || item.raw.brand || '' }} {{ item.raw.model || '' }}
                        </VListItemSubtitle>
                      </VListItem>
                    </template>
                    <template #append>
                      <VBtn
                        icon
                        size="small"
                        variant="tonal"
                        color="primary"
                        @click="showVehicleDialog = true"
                      >
                        <VIcon icon="ri-add-line" />
                      </VBtn>
                    </template>
                  </VSearch>
                </div>
              </VCol>

              <VCol
                cols="12"
                md="4"
              >
                <div class="mb-4">
                  <VTextField
                    v-model.number="workOrder.mileage"
                    type="number"
                    label="Kilometraje"
                    prepend-inner-icon="ri-speed-line"
                    variant="outlined"
                  />
                </div>
              </VCol>

              <VCol
                cols="12"
                md="4"
              >
                <div class="mb-4">
                  <VSelect
                    v-model="workOrder.fuel_level"
                    :items="fuelLevels"
                    label="Nivel de Combustible"
                    prepend-inner-icon="ri-gas-station-line"
                    variant="outlined"
                    clearable
                  />
                </div>
              </VCol>

              <VCol
                cols="12"
                md="4"
              >
                <div class="mb-4">
                  <VAutocomplete
                    v-model="workOrder.technicians"
                    :items="employees"
                    :item-title="(item) => `${item.first_name} ${item.last_name} - ${item.position || ''}`"
                    item-value="id"
                    label="Técnicos (máximo 2)"
                    prepend-inner-icon="ri-user-settings-line"
                    variant="outlined"
                    clearable
                    :loading="isLoading"
                    multiple
                    chips
                    class="fix-notch-bug"
                  >
                    <template #chip="{ props, item }">
                      <VChip
                        v-bind="props"
                        :text="`${item.raw.first_name} ${item.raw.last_name}`"
                      />
                    </template>
                  </VAutocomplete>
                </div>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>



        <!-- Productos y Servicios -->
        <VCard class="elevation-2 mb-4">
          <VCardText class="pa-6">
            <div class="d-flex align-center justify-space-between mb-4">
              <div class="d-flex align-center">
                <VAvatar
                  size="40"
                  color="success"
                  variant="tonal"
                  class="mr-3"
                >
                  <VIcon
                    icon="ri-shopping-bag-3-line"
                    size="24"
                  />
                </VAvatar>
                <div>
                  <h3 class="text-h6 font-weight-bold mb-0">
                    Productos y Servicios
                  </h3>
                  <p class="text-caption text-grey mb-0">
                    Agrega los items a la orden de trabajo
                  </p>
                </div>
              </div>
              <div class="d-flex gap-2">
                <VBtn
                  size="small"
                  color="primary"
                  variant="outlined"
                  prepend-icon="ri-box-3-line"
                  @click="addTemporaryProduct"
                >
                  Producto Temporal
                </VBtn>
                <VBtn
                  size="small"
                  color="info"
                  variant="outlined"
                  prepend-icon="ri-tools-line"
                  @click="showAddServiceDialog = true"
                >
                  Servicio Express
                </VBtn>
              </div>
            </div>

            <!-- Cuadro de búsqueda de productos -->
            <VCard
              class="mb-4 elevation-1"
              color="grey-lighten-5"
            >
              <VCardText class="pa-4">
                <VSearch
                  v-model="productSearch"
                  endpoint="products/search"
                  item-title="description"
                  :return-object="true"
                  label="Buscar y agregar producto por nombre, código o SKU..."
                  icon="ri-search-line"
                  class="mb-0"
                  hide-details
                  @change="addProductFromSearch"
                >
                  <template #item="{ props, item }">
                    <VListItem
                      v-bind="props"
                      :title="undefined"
                    >
                      <template #prepend>
                        <VAvatar
                          size="32"
                          color="primary"
                          variant="tonal"
                        >
                          <VIcon icon="ri-box-3-line" />
                        </VAvatar>
                      </template>
                      <VListItemTitle
                        style="white-space: normal !important; line-height: 1.4;"
                        class="font-weight-medium"
                      >
                        {{ item.raw.description || item.raw.name }}
                      </VListItemTitle>
                      <VListItemSubtitle
                        v-if="item.raw.code_aux || item.raw.sku"
                        class="mt-1 text-grey"
                      >
                        Código/SKU: {{ item.raw.code_aux || item.raw.sku }}
                      </VListItemSubtitle>
                      <template #append>
                        <VChip
                          size="small"
                          color="success"
                        >
                          ${{ parseFloat(item.raw.price_sale || item.raw.price).toFixed(2) }}
                        </VChip>
                      </template>
                    </VListItem>
                  </template>
                </VSearch>
              </VCardText>
            </VCard>

            <!-- Tabla de items -->
            <VCard
              v-if="workOrder.items.length > 0"
              class="elevation-1"
            >
              <VTable class="custom-items-table">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th
                      class="text-left"
                      style="min-width: 250px;"
                    >
                      Ítem / Descripción
                    </th>
                    <th
                      class="text-center"
                      style="width: 130px;"
                    >
                      Cantidad
                    </th>
                    <th
                      class="text-center"
                      style="width: 140px;"
                    >
                      Precio Unit.
                    </th>
                    <th
                      class="text-center"
                      style="width: 120px;"
                    >
                      Descuento
                    </th>
                    <th
                      class="text-center"
                      style="width: 130px;"
                    >
                      Subtotal
                    </th>
                    <th
                      class="text-center"
                      style="width: 60px;"
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, index) in workOrder.items"
                    :key="item.id || item.product_id || index"
                    class="hover-row"
                  >
                    <td>
                      <div class="d-flex align-center gap-3 py-1">
                        <VAvatar
                          size="38"
                          :color="item.type === 'product' ? 'primary' : 'info'"
                          variant="tonal"
                          class="elevation-1"
                        >
                          <VIcon
                            :icon="item.type === 'product' ? 'ri-box-3-line' : 'ri-tools-line'"
                            size="20"
                          />
                        </VAvatar>
                        <div class="flex-grow-1">
                          <VTextField
                            v-model="item.description"
                            density="compact"
                            variant="plain"
                            hide-details
                            placeholder="Descripción del ítem..."
                            class="premium-input font-weight-medium"
                          />
                          <div class="text-caption text-grey mt-1 d-flex align-center gap-2">
                            <span
                              class="text-uppercase font-weight-bold"
                              style="font-size: 0.65rem;"
                            >
                              {{ item.type === 'product' ? 'Producto' : 'Servicio' }}
                            </span>
                            <span
                              v-if="item.type === 'product'"
                              class="stock-tag"
                              :class="{'stock-low': item.quantity > getProductStock(item.product_id)}"
                            >
                              <VIcon
                                icon="ri-stack-line"
                                size="12"
                                class="mr-1"
                              />
                              {{ getProductStock(item.product_id) }} en stock
                            </span>
                            <span
                              v-if="getProductSku(item.product_id) || item.sku"
                              class="text-uppercase font-weight-bold"
                              style="font-size: 0.65rem;"
                            >
                              {{ getProductSku(item.product_id) || item.sku }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="text-center">
                      <div class="d-inline-flex align-center qty-selector">
                        <VBtn
                          icon="ri-subtract-line"
                          variant="text"
                          color="primary"
                          :disabled="item.quantity <= 1"
                          class="qty-btn"
                          size="small"
                          @click="item.quantity--"
                        />
                        <input
                          v-model.number="item.quantity"
                          type="number"
                          min="1"
                          max="99"
                          class="qty-input"
                          @input="item.quantity > 99 ? item.quantity = 99 : null"
                          @blur="(!item.quantity || item.quantity < 1) ? item.quantity = 1 : null"
                        >
                        <VBtn
                          icon="ri-add-line"
                          variant="text"
                          color="primary"
                          :disabled="item.quantity >= 99"
                          class="qty-btn"
                          size="small"
                          @click="item.quantity < 99 ? item.quantity++ : null"
                        />
                      </div>
                    </td>
                    <td>
                      <VTextField
                        v-model.number="item.unit_price"
                        type="number"
                        density="compact"
                        variant="plain"
                        hide-details
                        min="0"
                        step="0.01"
                        prefix="$"
                        class="premium-input font-weight-bold"
                      />
                    </td>
                    <td>
                      <VTextField
                        v-model.number="item.discount"
                        type="number"
                        density="compact"
                        variant="plain"
                        hide-details
                        min="0"
                        step="0.01"
                        prefix="$"
                        class="premium-input text-error font-weight-medium"
                      />
                    </td>
                    <td class="text-center">
                      <span class="text-h6 font-weight-black text-success">
                        ${{ calculateItemSubtotal(item).toFixed(2) }}
                      </span>
                    </td>
                    <td class="text-center">
                      <VBtn
                        icon="ri-delete-bin-line"
                        size="small"
                        color="error"
                        variant="text"
                        class="delete-btn"
                        @click="removeItem(index)"
                      />
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </VCard>

            <div
              v-else
              class="text-center pa-8"
            >
              <VIcon
                icon="ri-shopping-bag-3-line"
                size="64"
                color="grey-lighten-1"
              />
              <p class="mt-4 text-body-2 text-grey">
                No hay productos o servicios agregados
              </p>
              <p class="text-caption text-grey">
                Usa el buscador para agregar items
              </p>
            </div>

            <!-- Total -->
            <div class="d-flex justify-end mt-4">
              <VCard
                class="pa-4 elevation-2"
                width="320"
                color="primary-lighten-5"
              >
                <div class="d-flex align-center mb-2">
                  <VIcon
                    icon="ri-money-dollar-circle-line"
                    size="24"
                    color="primary"
                    class="mr-2"
                  />
                  <span class="text-body-1 font-weight-medium">Total de la Orden</span>
                </div>
                <div class="d-flex justify-space-between align-center">
                  <span class="text-h4 font-weight-bold text-primary">${{ calculateTotal().toFixed(2)
                  }}</span>
                  <VChip
                    size="small"
                    color="primary"
                    label
                  >
                    {{ workOrder.items.length }} items
                  </VChip>
                </div>
              </VCard>
            </div>
          </VCardText>
        </VCard>
        <VAlert
          v-if="showValidationError"
          color="error"
          variant="tonal"
          class="mb-4"
          border="start"
          closable
          @click:close="showValidationError = false"
        >
          <div class="d-flex align-center">
            <VIcon
              icon="ri-error-warning-line"
              class="mr-2"
            />
            <span class="text-body-2">{{ validationErrorMessage }}</span>
          </div>
        </VAlert>
        <!-- Observaciones -->
        <VCard class="elevation-2 mb-4">
          <VCardText class="pa-6">
            <h3 class="text-h6 font-weight-bold mb-4">
              Observaciones
            </h3>
            <VTextarea
              v-model="workOrder.observations"
              label="Observaciones de la orden"
              prepend-inner-icon="ri-file-text-line"
              variant="outlined"
              rows="3"
              placeholder="Describe cualquier observación relevante..."
              hide-details
            />
          </VCardText>
        </VCard>

        <!-- Botones de acción -->
        <VCard class="elevation-2">
          <VCardText class="pa-6">
            <div class="d-flex justify-end gap-3">
              <VBtn
                color="grey"
                variant="outlined"
                prepend-icon="ri-close-line"
                :disabled="isLoading"
                @click="cancel"
              >
                Cancelar
              </VBtn>
              <VBtn
                v-if="originalStatus === 'draft'"
                color="secondary"
                variant="elevated"
                prepend-icon="ri-draft-line"
                :loading="isLoading"
                size="large"
                @click.prevent="saveDraft"
              >
                Actualizar Borrador
              </VBtn>
              <VBtn
                type="submit"
                color="primary"
                variant="elevated"
                prepend-icon="ri-save-3-line"
                :loading="isLoading"
                size="large"
                @click="saveWorkOrder"
              >
                {{ originalStatus === 'draft' ? 'Finalizar Orden de Trabajo' : 'Guardar Cambios' }}
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Dialog para agregar cliente -->
    <ClientFinalAddDialog
      :is-dialog-visible="showClientDialog"
      @update:is-dialog-visible="showClientDialog = $event"
      @add-client-final="onClientAdded"
    />

    <!-- Dialog para agregar cliente empresa -->
    <ClientCompanyAddDialog
      :is-dialog-visible="showCompanyDialog"
      @update:is-dialog-visible="showCompanyDialog = $event"
      @add-client-company="onCompanyAdded"
    />

    <!-- Dialog para agregar vehículo -->
    <VehicleAddDialog
      :is-dialog-visible="showVehicleDialog"
      :client-selected-id="workOrder.client_id"
      @update:is-dialog-visible="showVehicleDialog = $event"
      @add-vehicle="onVehicleAdded"
    />

    <AddServiceDialog
      v-model:isDialogVisible="showAddServiceDialog"
      @service-added="handleServiceAdded"
    />
  </VContainer>
</template>

<style scoped>
:deep(.fix-notch-bug:not(:has(.v-chip)):not(:focus-within) .v-field__outline__notch) {
  max-width: 0 !important;
  border-width: 0 !important;
}

.shimmer-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-chip {
  width: 60px;
  height: 20px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-button {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
