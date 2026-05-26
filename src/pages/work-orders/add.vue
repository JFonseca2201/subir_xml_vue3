<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { getBrandNameById } from '@/data/vehicleBrands'

import ClientFinalAddDialog from '@/components/inventory/clients/ClientFinalAddDialog.vue'
import ClientCompanyAddDialog from '@/components/inventory/clients/ClientCompanyAddDialog.vue'
import VehicleAddDialog from '@/components/inventory/vehicles/VehicleAddDialog.vue'

const router = useRouter()
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

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const employees = ref([])

const workOrder = ref({
  client_id: null,
  vehicle_id: null,
  user_id: userId.value,
  mileage: null,
  fuel_level: '',
  observations: '',
  diagnostic: '',
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
const productSearch = ref('')
const filteredProducts = ref([])

const loadInitialData = async () => {
  isLoading.value = true
  try {
    getUserId()
    workOrder.value.user_id = userId.value

    const [clientsRes, vehiclesRes, productsRes, employeesRes] = await Promise.all([
      $api('clients', { params: { per_page: 100 } }),
      $api('vehicles', { params: { per_page: 100 } }),
      $api('products', { params: { per_page: 1000 } }),
      $api('employees', { params: { per_page: 100 } }),
    ])

    console.log('Clients response:', clientsRes)
    console.log('Vehicles response:', vehiclesRes)
    console.log('Products response:', productsRes)
    console.log('Employees response:', employeesRes)

    clients.value = Array.isArray(clientsRes.clients) ? clientsRes.clients :
      Array.isArray(clientsRes.data) ? clientsRes.data : []
    vehicles.value = Array.isArray(vehiclesRes.vehicles) ? vehiclesRes.vehicles :
      Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []

    const productsArray = Array.isArray(productsRes.products?.data) ? productsRes.products.data :
      Array.isArray(productsRes.data) ? productsRes.data :
        Array.isArray(productsRes.products) ? productsRes.products : []

    products.value = productsArray
    filteredProducts.value = productsArray

    employees.value = Array.isArray(employeesRes.employees) ? employeesRes.employees :
      Array.isArray(employeesRes.data) ? employeesRes.data : []

    console.log('Clients loaded:', clients.value.length)
    console.log('Vehicles loaded:', vehicles.value.length)
    console.log('Products loaded:', products.value.length)
    console.log('Employees loaded:', employees.value.length)
  } catch (error) {
    console.error('Error al cargar datos:', error)
    showNotification('Error al cargar datos iniciales', 'error')
  } finally {
    isLoading.value = false
  }
}

const validateForm = () => {
  if (!workOrder.value.client_id) {
    validationErrorMessage.value = 'Debe seleccionar un cliente'
    showValidationError.value = true
    
    return false
  }
  
  return true
}

const saveWorkOrder = async () => {
  if (!validateForm()) return

  isLoading.value = true
  try {
    const response = await $api('work-orders', {
      method: 'POST',
      body: workOrder.value,
    })

    showNotification('Orden de trabajo creada exitosamente', 'success')
    router.push('/work-orders')
  } catch (error) {
    console.error('Error al crear orden de trabajo:', error)
    if (error.response && error.response.data) {
      const errorData = error.response.data
      if (errorData.error === 'stock_insufficient' || errorData.error === 'discount_exceeded') {
        showNotification(errorData.message, 'error')
      } else {
        showNotification(errorData.message || 'Error al crear la orden de trabajo', 'error')
      }
    } else {
      showNotification('Error al crear la orden de trabajo', 'error')
    }
  } finally {
    isLoading.value = false
  }
}

const cancel = () => {
  router.push('/work-orders')
}

const onClientAdded = newClient => {
  const clientObj = newClient.client || newClient.data || newClient
  clients.value.push(clientObj)
  workOrder.value.client_id = clientObj.id
  showClientDialog.value = false
}

const onCompanyAdded = newCompany => {
  const companyObj = newCompany.client || newCompany.data || newCompany
  clients.value.push(companyObj)
  workOrder.value.client_id = companyObj.id
  showCompanyDialog.value = false
}

const onVehicleAdded = newVehicle => {
  const vehicleObj = newVehicle.vehicle || newVehicle.data || newVehicle
  vehicles.value.push(vehicleObj)
  workOrder.value.vehicle_id = vehicleObj.id
  showVehicleDialog.value = false
}

// Funciones para items
const addItem = (type = 'product') => {
  // Validar que el último item esté completo antes de agregar uno nuevo
  if (workOrder.value.items.length > 0) {
    const lastItem = workOrder.value.items[workOrder.value.items.length - 1]
    if (!lastItem.description || !lastItem.quantity || !lastItem.unit_price) {
      showNotification('Completa el item actual antes de agregar uno nuevo', 'warning')
      
      return
    }
  }
    
  workOrder.value.items.push({
    product_id: null,
    description: '',
    quantity: 1,
    unit_price: 0,
    discount: 0,
    type: type,
    sku: 'MANUAL',
  })
}

const removeItem = index => {
  workOrder.value.items.splice(index, 1)
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

const onProductChanged = item => {
  if (item.product_id) {
    const product = products.value.find(p => p.id === item.product_id)
    if (product) {
      item.description = product.name || product.description || ''
      item.unit_price = parseFloat(product.price) || 0
    }
  }
}

// Filtrar productos basado en búsqueda
const filterProducts = () => {
  if (!productSearch.value) {
    filteredProducts.value = Array.isArray(products.value) ? products.value : []
    
    return
  }
  const query = productSearch.value.toLowerCase()
  const productsArray = Array.isArray(products.value) ? products.value : []

  filteredProducts.value = productsArray.filter(p =>
    (p.name && p.name.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.code && p.code.toLowerCase().includes(query)),
  )
}

// Watch para filtrar productos cuando cambia la búsqueda
watch(productSearch, () => {
  filterProducts()
})

// Agregar producto desde búsqueda
const addProductFromSearch = product => {
  // Determinar si es servicio basado en item_type o categoría
  const isService = product.item_type === 2 ||
        (product.categorie && product.categorie.title && product.categorie.title.includes('SERVICIO'))

  workOrder.value.items.push({
    product_id: product.id,
    description: product.description || product.name || '',
    quantity: 1,
    unit_price: parseFloat(product.price_sale) || parseFloat(product.price) || 0,
    discount: 0,
    type: isService ? 'service' : 'product',
    sku: product.sku || product.code || '',
  })
  productSearch.value = ''
}

onMounted(() => {
  loadInitialData()
  filteredProducts.value = products.value
})
</script>

<template>
  <VContainer class="pa-6">
    <VRow>
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
              Nueva Orden de Trabajo
            </h1>
            <p class="text-body-2 text-grey">
              Completa la información para crear una orden de trabajo
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
                  <VAutocomplete
                    v-model="workOrder.client_id"
                    :items="clients"
                    item-title="full_name"
                    item-value="id"
                    label="Cliente *"
                    prepend-inner-icon="ri-user-line"
                    variant="outlined"
                    clearable
                    :loading="isLoading"
                    :rules="[(v) => !!v || 'Cliente es requerido']"
                  >
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
                  </VAutocomplete>
                </div>
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <div class="mb-4" style="text-transform: uppercase;">
                  <VAutocomplete
                    v-model="workOrder.vehicle_id"
                    :items="vehicles"
                    :item-title="(item) => `${getBrandNameById(item.brand)} ${item.model} - ${item.license_plate}`"
                    item-value="id"
                    label="Vehículo"
                    prepend-inner-icon="ri-car-line"
                    variant="outlined"
                    clearable
                    :loading="isLoading"
                  >
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
                  </VAutocomplete>
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
                    :rules="[(v) => !v || v.length <= 2 || 'Máximo 2 técnicos']"
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

        <!-- Observaciones y Diagnóstico -->
        <VCard class="elevation-2 mb-4">
          <VCardText class="pa-6">
            <div class="d-flex align-center mb-4">
              <VAvatar
                size="40"
                color="info"
                variant="tonal"
                class="mr-3"
              >
                <VIcon
                  icon="ri-file-text-line"
                  size="24"
                />
              </VAvatar>
              <div>
                <h3 class="text-h6 font-weight-bold mb-0">
                  Observaciones y Diagnóstico
                </h3>
                <p class="text-caption text-grey mb-0">
                  Detalles adicionales sobre el trabajo a realizar
                </p>
              </div>
            </div>

            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextarea
                  v-model="workOrder.observations"
                  label="Observaciones"
                  prepend-inner-icon="ri-file-text-line"
                  variant="outlined"
                  rows="4"
                  placeholder="Describe cualquier observación relevante..."
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextarea
                  v-model="workOrder.diagnostic"
                  label="Diagnóstico"
                  prepend-inner-icon="ri-stethoscope-line"
                  variant="outlined"
                  rows="4"
                  placeholder="Describe el diagnóstico técnico..."
                />
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
              <VBtn
                size="small"
                color="info"
                variant="outlined"
                prepend-icon="ri-tools-line"
                @click="addItem('service')"
              >
                Agregar Servicio Manual
              </VBtn>
            </div>

            <!-- Cuadro de búsqueda de productos -->
            <VCard
              class="mb-4 elevation-1"
              color="grey-lighten-5"
            >
              <VCardText class="pa-4">
                <VAutocomplete
                  v-model="productSearch"
                  :items="filteredProducts"
                  item-title="description"
                  item-value="id"
                  label="Buscar producto..."
                  prepend-inner-icon="ri-search-line"
                  variant="outlined"
                  clearable
                  hide-details
                  return-object
                  @update:model-value="(val) => val && addProductFromSearch(val)"
                >
                  <template #item="{ props, item }">
                    <VListItem v-bind="props">
                      <template #prepend>
                        <VAvatar
                          size="32"
                          color="primary"
                          variant="tonal"
                        >
                          <VIcon icon="ri-box-3-line" />
                        </VAvatar>
                      </template>
                      <VListItemSubtitle>{{ item.raw.sku || '' }}</VListItemSubtitle>
                      <template #append>
                        <VChip
                          size="small"
                          color="success"
                        >
                          ${{
                            parseFloat(item.raw.price).toFixed(2) }}
                        </VChip>
                      </template>
                    </VListItem>
                  </template>
                </VAutocomplete>
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
                    <th class="text-left" style="min-width: 250px;">
                      Ítem / Descripción
                    </th>
                    <th class="text-center" style="width: 130px;">
                      Cantidad
                    </th>
                    <th class="text-center" style="width: 140px;">
                      Precio Unit.
                    </th>
                    <th class="text-center" style="width: 120px;">
                      Descuento
                    </th>
                    <th class="text-center" style="width: 130px;">
                      Subtotal
                    </th>
                    <th class="text-center" style="width: 60px;">
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
                          <VIcon :icon="item.type === 'product' ? 'ri-box-3-line' : 'ri-tools-line'" size="20" />
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
                            <span class="text-uppercase font-weight-bold" style="font-size: 0.65rem;">
                              {{ item.type === 'product' ? 'Producto' : 'Servicio' }}
                            </span>
                            <span v-if="item.sku" class="sku-tag">{{ item.sku }}</span>
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
                          @click="item.quantity--"
                          class="qty-btn"
                          size="small"
                        />
                        <input
                          v-model.number="item.quantity"
                          type="number"
                          min="1"
                          class="qty-input"
                        />
                        <VBtn
                          icon="ri-add-line"
                          variant="text"
                          color="primary"
                          @click="item.quantity++"
                          class="qty-btn"
                          size="small"
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
                type="submit"
                color="primary"
                variant="elevated"
                prepend-icon="ri-save-3-line"
                :loading="isLoading"
                size="large"
                @click="saveWorkOrder"
              >
                Guardar Orden de Trabajo
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
      @update:is-dialog-visible="showVehicleDialog = $event"
      @add-vehicle="onVehicleAdded"
    />
  </VContainer>
</template>

<style scoped>
.custom-items-table {
  width: 100%;
  border-collapse: collapse;
}

.custom-items-table th {
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.6);
  padding: 12px 16px !important;
  border-bottom: 2px solid rgba(0, 0, 0, 0.06) !important;
}

.custom-items-table td {
  padding: 12px 16px !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
  vertical-align: middle;
}

.hover-row {
  transition: all 0.2s ease-in-out;
}

.hover-row:hover {
  background-color: rgba(var(--v-theme-primary), 0.02) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
}

/* Custom quantity selector */
.qty-selector {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: hidden;
  background-color: #fff;
  transition: border-color 0.2s;
}

.qty-selector:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
}

.qty-btn {
  height: 32px !important;
  width: 32px !important;
  min-width: 32px !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

.qty-input {
  width: 44px;
  height: 32px;
  border: none;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
  outline: none;
}

/* Hide spin buttons for Firefox/Chrome */
.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.qty-input[type=number] {
  -moz-appearance: textfield;
}

/* Underline inputs */
.premium-input :deep(.v-field__outline) {
  --v-field-border-width: 0px !important;
  --v-field-border-opacity: 0 !important;
}

.premium-input :deep(.v-field__outline::before),
.premium-input :deep(.v-field__outline::after) {
  display: none !important;
}

.premium-input :deep(.v-field) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 0 !important;
  padding-inline-start: 4px !important;
  padding-inline-end: 4px !important;
  transition: all 0.2s ease;
}

.premium-input :deep(.v-field--focused) {
  border-bottom: 2px solid rgb(var(--v-theme-primary)) !important;
  background-color: transparent !important;
}

.premium-input :deep(.v-field:hover:not(.v-field--focused)) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.4) !important;
}

.sku-tag {
  background-color: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.6);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.delete-btn {
  transition: transform 0.2s, color 0.2s;
}
.delete-btn:hover {
  transform: scale(1.15);
  color: rgb(var(--v-theme-error)) !important;
}
</style>
