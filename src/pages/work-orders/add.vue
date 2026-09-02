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
const isSavingDraft = ref(false)
const isSubmitting = ref(false)
const showValidationError = ref(false)
const validationErrorMessage = ref('')

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const employees = ref([])

const workOrder = ref({
  number: '',
  date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
  client_id: null,
  vehicle_id: null,
  quote_id: null,
  quote_number: null,
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

    const [employeesRes, productsRes, workOrdersRes, nextNumberRes] = await Promise.all([
      $api('employees', { params: { per_page: 1000 } }),
      $api('products', { params: { per_page: 1000 } }),
      $api('work-orders'),
      $api('work-orders/next-number'),
    ])

    employees.value = Array.isArray(employeesRes.employees) ? employeesRes.employees :
      Array.isArray(employeesRes.data) ? employeesRes.data : []

    const rawProducts = Array.isArray(productsRes.products) ? productsRes.products :
      (Array.isArray(productsRes.data) ? productsRes.data : (Array.isArray(productsRes) ? productsRes : []))

    products.value = rawProducts.map(p => ({
      ...p,
      searchText: `${p.sku || ''} ${p.code || ''} ${p.name || ''} ${p.description || ''}`.toLowerCase(),
      displayTitle: p.description || p.name || '',
    }))

    // Usamos el número que entrega el backend directamente
    workOrder.value.number = nextNumberRes?.data || '000000000'

    console.log('Employees loaded:', employees.value.length)
  } catch (error) {
    console.error('Error al cargar datos:', error)
    showNotification('Error al cargar datos iniciales', 'error')
  } finally {
    isLoading.value = false
  }
}

const validateForm = async () => {
  if (formRef.value) {
    const { valid } = await formRef.value.validate()
    if (!valid) {
      validationErrorMessage.value = 'Por favor, complete todos los campos obligatorios marcados con *'
      showValidationError.value = true

      return false
    }
  }

  if (!workOrder.value.client_id) {
    validationErrorMessage.value = 'Debe seleccionar un cliente'
    showValidationError.value = true

    return false
  }

  return true
}

const saveWorkOrder = async () => {
  if (!(await validateForm())) {
    console.log('Error de validación')

    return
  }

  for (const item of workOrder.value.items) {
    if (item.type === 'product' && item.product_id) {
      const product = products.value.find(p => p.id === item.product_id)
      if (product && product.stock < item.quantity) {
        showValidationError.value = true
        validationErrorMessage.value = `Stock insuficiente para ${product.description || product.name || 'el producto'}. Stock disponible: ${product.stock}, Solicitado: ${item.quantity}`

        return
      }
    }
  }

  isSubmitting.value = true

  // Clonar el objeto y eliminar 'number' para que el backend lo genere fresco
  // y evitar el error de "The number has already been taken" por concurrencia.
  const payload = { ...workOrder.value }

  delete payload.number

  try {
    const response = await $api('work-orders', {
      method: 'POST',
      body: payload,
    })

    showNotification('Orden de trabajo creada exitosamente', 'success')
    router.push('/work-orders')
  } catch (error) {
    console.error('Error al crear orden de trabajo:', error)

    // ofetch usa error.data para la respuesta JSON
    const errorData = error.data || (error.response && error.response._data)

    if (errorData) {
      if (errorData.error === 'stock_insufficient' || errorData.error === 'discount_exceeded') {
        showNotification(errorData.message, 'error')
      } else {
        showNotification(errorData.message || 'Error al crear la orden de trabajo', 'error')
      }
    } else {
      showNotification('Error al crear la orden de trabajo', 'error')
    }
  } finally {
    isSubmitting.value = false
  }
}

const saveDraft = async () => {
  if (!workOrder.value.client_id) {
    showNotification('Debe seleccionar un cliente para guardar el borrador', 'warning')

    return
  }

  isSavingDraft.value = true

  const payload = { ...workOrder.value, is_draft: true }

  delete payload.number

  try {
    const response = await $api('work-orders', {
      method: 'POST',
      body: payload,
    })

    showNotification('Borrador de orden guardado exitosamente', 'success')
    router.push('/work-orders')
  } catch (error) {
    console.error('Error al guardar borrador:', error)

    const errorData = error.data || (error.response && error.response._data)
    if (errorData) {
      showNotification(errorData.message || 'Error al guardar borrador', 'error')
    } else {
      showNotification('Error al guardar borrador', 'error')
    }
  } finally {
    isSavingDraft.value = false
  }
}

const cancel = () => {
  router.push('/work-orders')
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

const getVehicleBrandModel = vehicle => {
  if (!vehicle) return ''
  const brand = getBrandNameById(vehicle.brand?.name || vehicle.brand || vehicle.brand_id)
  const model = vehicle.model || ''
  if (brand && model) return `${brand} - ${model}`
  return brand || model || 'Sin marca/modelo'
}

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

const isServiceItem = item => {
  if (!item) return false
  if (item.type === 'service') return true
  if (item.item_type === 2) return true
  if (item.product?.item_type === 2) return true
  const itemSku = item.sku || item.product?.sku || ''
  const product = products.value.find(p =>
    (item.product_id && p.id === item.product_id) ||
    (itemSku && (p.sku === itemSku || p.code === itemSku || p.code_aux === itemSku))
  )
  if (product && (product.item_type === 2 || product.type === 'service')) return true
  if (itemSku && String(itemSku).toUpperCase().startsWith('SRV-')) return true
  if (!item.product_id && !itemSku) return true
  return false
}

const getProductStock = (productId, item = null) => {
  const itemSku = item?.sku || item?.product?.sku || ''
  const product = products.value.find(p =>
    (productId && p.id === productId) ||
    (itemSku && (p.sku === itemSku || p.code === itemSku || p.code_aux === itemSku))
  )

  if (product && product.stock !== undefined && product.stock !== null) {
    return Number(product.stock)
  }

  if (item && item.stock !== undefined && item.stock !== null) {
    return Number(item.stock)
  }

  if (item && item.product && item.product.stock !== undefined && item.product.stock !== null) {
    return Number(item.product.stock)
  }

  return 0
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

onMounted(async () => {
  await loadInitialData()

  const quoteId = route.query.quote_id
  if (quoteId) {
    try {
      isLoading.value = true
      const quoteRes = await $api(`quotes/${quoteId}`)
      const quote = quoteRes.data || quoteRes

      if (quote) {
        workOrder.value.quote_id = quote.id
        workOrder.value.quote_number = quote.document_number
        workOrder.value.client_id = quote.client_id
        workOrder.value.vehicle_id = quote.vehicle_id
        workOrder.value.user_id = quote.user_id || userId.value
        workOrder.value.mileage = quote.mileage
        workOrder.value.fuel_level = quote.fuel_level || '1/2'
        workOrder.value.observations = quote.observations || ''
        workOrder.value.date = quote.date ? quote.date.split(' ')[0] : workOrder.value.date

        if (quote.technicians && Array.isArray(quote.technicians)) {
          workOrder.value.technicians = quote.technicians.map(t => typeof t === 'object' ? t.id : t)
        }

        if (quote.client) {
          selectedClient.value = quote.client
        } else if (quote.client_id) {
          try {
            const clientRes = await $api(`clients/${quote.client_id}`)
            selectedClient.value = clientRes.client || clientRes.data || clientRes
          } catch (e) {
            console.error('Error al cargar cliente:', e)
          }
        }

        if (quote.vehicle) {
          selectedVehicle.value = quote.vehicle
        } else if (quote.vehicle_id) {
          try {
            const vehicleRes = await $api(`vehicles/${quote.vehicle_id}`)
            selectedVehicle.value = vehicleRes.vehicle || vehicleRes.data || vehicleRes
          } catch (e) {
            console.error('Error al cargar vehículo:', e)
          }
        }

        if (quote.details && quote.details.length > 0) {
          workOrder.value.items = quote.details.map(item => {
            if (item.product) {
              const existingIdx = products.value.findIndex(p => p.id === item.product.id)
              if (existingIdx >= 0) {
                products.value[existingIdx] = { ...products.value[existingIdx], ...item.product }
              } else {
                products.value.push(item.product)
              }
            }

            const isService = item.type === 'service' ||
              item.item_type === 2 ||
              item.product?.item_type === 2 ||
              (item.sku && String(item.sku).toUpperCase().startsWith('SRV-')) ||
              (item.product?.sku && String(item.product.sku).toUpperCase().startsWith('SRV-')) ||
              (!item.product_id && !item.sku)

            return {
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.price || item.unit_price || 0,
              discount: item.discount || 0,
              subtotal: item.subtotal,
              type: isService ? 'service' : 'product',
              sku: item.product?.sku || item.product?.code || item.sku || '',
              stock: item.product?.stock !== undefined ? item.product.stock : item.stock,
              product: item.product || null,
            }
          })
        }

        showNotification(`Cotización #${quote.document_number} cargada para crear Orden de Trabajo`, 'success')
      }
    } catch (e) {
      console.error('Error al cargar cotización para OT:', e)
      showNotification('Error al cargar la cotización seleccionada', 'error')
    } finally {
      isLoading.value = false
    }
  }
})
</script>

<template>
  <div class="pa-4 pa-sm-6 work-orders-create-page position-relative">
    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="44" class="elevation-1">
            <VIcon icon="ri-draft-line" size="24" />
          </VAvatar>
          <div>
            <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
              Nueva Orden de Trabajo
            </h1>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Completa la información para crear una orden de trabajo
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-arrow-left-line" class="font-weight-medium"
            @click="cancel">
            Volver al Lsitado
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Form Skeleton loader -->
    <div v-if="isLoading" class="d-flex flex-column gap-6">
      <VRow>
        <VCol cols="12" lg="8">
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div class="shimmer-line w-40 mb-6" style="height: 24px;" />
            <VRow class="mb-4">
              <VCol cols="12" sm="6">
                <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
              </VCol>
              <VCol cols="12" sm="6">
                <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
              </VCol>
            </VRow>
            <div class="shimmer-line w-100 mb-4" style="height: 80px; border-radius: 8px;" />
            <div class="shimmer-line w-100" style="height: 120px; border-radius: 8px;" />
          </VCard>
        </VCol>
        <VCol cols="12" lg="4">
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div class="shimmer-line w-60 mb-6" style="height: 24px;" />
            <div class="shimmer-line w-100 mb-4" style="height: 48px; border-radius: 8px;" />
            <div class="shimmer-line w-100 mb-4" style="height: 48px; border-radius: 8px;" />
            <VDivider class="my-4" />
            <div class="d-flex justify-space-between mb-2">
              <div class="shimmer-line w-30" />
              <div class="shimmer-line w-20" />
            </div>
            <div class="d-flex justify-space-between mb-4">
              <div class="shimmer-line w-40" />
              <div class="shimmer-line w-30" />
            </div>
            <div class="shimmer-line w-100" style="height: 48px; border-radius: 8px;" />
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- Formulario Principal -->
    <VForm v-else ref="formRef" @submit.prevent>
      <!-- Alerta de Validación -->
      <VAlert v-if="showValidationError" color="error" variant="tonal" class="mb-6 rounded-xl" border="start" closable
        @click:close="showValidationError = false">
        <div class="d-flex align-center">
          <VIcon icon="ri-error-warning-line" class="mr-2" />
          <span class="text-body-2 font-weight-medium">{{ validationErrorMessage }}</span>
        </div>
      </VAlert>

      <VRow>
        <!-- Columna Izquierda (8 cols): Cliente, Vehículo y Productos/Servicios -->
        <VCol cols="12" lg="8">
          <!-- Tarjeta 1: Información del Cliente y Vehículo -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                    <VIcon icon="ri-car-line" size="20" />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                      Información del Cliente y Vehículo
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Selecciona el cliente y el vehículo para la orden
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <VRow>
                <!-- Número de Orden -->
                <VCol cols="12" sm="6">
                  <VTextField v-model="workOrder.number" label="Número de Orden *" prepend-inner-icon="ri-hashtag"
                    variant="outlined" density="comfortable" hide-details="auto" color="primary"
                    :rules="[(v) => !!v || 'Número de orden es requerido']" :loading="isLoading" />
                </VCol>

                <!-- Fecha -->
                <VCol cols="12" sm="6">
                  <VTextField v-model="workOrder.date" type="date" label="Fecha *" prepend-inner-icon="ri-calendar-line"
                    variant="outlined" density="comfortable" hide-details="auto" color="primary"
                    :rules="[(v) => !!v || 'Fecha es requerida']" />
                </VCol>

                <!-- Cliente -->
                <VCol cols="12" sm="6">
                  <VSearch v-model="selectedClient" :return-object="true" endpoint="clients/search"
                    item-title="full_name" label="Cliente *" icon="ri-user-line" :initial-item="selectedClient"
                    :rules="[(v) => !!workOrder.client_id || 'Cliente es requerido']">
                    <template #item="{ props, item }">
                      <VListItem v-bind="props" :title="item.raw.full_name || item.raw.name">
                        <VListItemSubtitle v-if="item.raw.n_document" class="mt-1 text-grey">
                          Documento: {{ item.raw.n_document }}
                        </VListItemSubtitle>
                      </VListItem>
                    </template>
                    <template #append>
                      <VBtn icon size="small" variant="tonal" color="primary" type="button">
                        <VIcon icon="ri-add-line" />
                        <VMenu activator="parent">
                          <VList density="compact" class="rounded-lg elevation-4 border">
                            <VListItem prepend-icon="ri-user-line" title="Cliente Final"
                              @click="showClientDialog = true" />
                            <VListItem prepend-icon="ri-building-line" title="Cliente Empresa"
                              @click="showCompanyDialog = true" />
                          </VList>
                        </VMenu>
                      </VBtn>
                    </template>
                  </VSearch>

                  <!-- Preview de Cliente debajo del campo -->
                  <div
                    v-if="selectedClient"
                    class="mt-2 pa-2.5 bg-slate-50 rounded-lg border d-flex align-center gap-3"
                  >
                    <VAvatar color="primary" variant="tonal" size="36" class="rounded-lg">
                      <VIcon icon="ri-user-line" size="20" />
                    </VAvatar>
                    <div class="d-flex flex-column">
                      <div class="text-caption font-weight-bold text-slate-800 d-flex align-center gap-1.5">
                        <VIcon icon="ri-id-card-line" size="14" class="text-primary" />
                        <span>Identificación: {{ selectedClient.n_document || "Sin identificación" }}</span>
                      </div>
                      <div class="text-caption text-medium-emphasis d-flex align-center gap-1.5 mt-0.5" style="font-size: 0.75rem;">
                        <VIcon icon="ri-mail-line" size="14" class="text-secondary" />
                        <span>Email: {{ selectedClient.email || "Sin email" }}</span>
                        <span v-if="selectedClient.phone" class="ms-1 text-slate-500">• Tel: {{ selectedClient.phone }}</span>
                      </div>
                    </div>
                  </div>
                </VCol>

                <!-- Vehículo -->
                <VCol cols="12" sm="6">
                  <div style="text-transform: uppercase;">
                    <VSearch v-model="selectedVehicle" :return-object="true" endpoint="vehicles/search"
                      item-title="license_plate" label="Vehículo" icon="ri-car-line" :initial-item="selectedVehicle"
                      :extra-params="workOrder.client_id ? { client_id: workOrder.client_id } : {}">
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="item.raw.license_plate">
                          <VListItemSubtitle class="mt-1 text-grey">
                            <span>{{ getBrandNameById(item.raw.brand?.name || item.raw.brand || item.raw.brand_id) }} {{ item.raw.model || '' }}</span>
                            <span v-if="item.raw.color" class="ms-1">• Color: {{ item.raw.color }}</span>
                            <span v-if="item.raw.client" class="text-primary font-weight-medium ms-2">
                              • Propietario: {{ item.raw.client.full_name || (item.raw.client.name + ' ' +
                                (item.raw.client.surname || '')) }}
                            </span>
                          </VListItemSubtitle>
                        </VListItem>
                      </template>
                      <template #append>
                        <VBtn icon size="small" variant="tonal" color="primary" type="button"
                          @click="showVehicleDialog = true">
                          <VIcon icon="ri-add-line" />
                        </VBtn>
                      </template>
                    </VSearch>
                  </div>

                  <!-- Preview de Vehículo debajo del campo -->
                  <div
                    v-if="selectedVehicle"
                    class="mt-2 pa-2.5 bg-slate-50 rounded-lg border d-flex align-center gap-3"
                  >
                    <VAvatar color="success" variant="tonal" size="36" class="rounded-lg">
                      <VIcon icon="ri-car-line" size="20" />
                    </VAvatar>
                    <div class="d-flex flex-column">
                      <div class="text-caption font-weight-bold text-slate-800 d-flex align-center gap-1.5">
                        <VIcon icon="ri-roadster-line" size="14" class="text-success" />
                        <span>{{ getVehicleBrandModel(selectedVehicle) }}</span>
                      </div>
                      <div class="text-caption text-medium-emphasis d-flex align-center gap-1.5 mt-0.5" style="font-size: 0.75rem;">
                        <VIcon icon="ri-palette-line" size="14" class="text-secondary" />
                        <span>Color: {{ selectedVehicle.color || "Sin color" }}</span>
                        <span v-if="selectedVehicle.year" class="ms-1 text-slate-500">• Año: {{ selectedVehicle.year }}</span>
                      </div>
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Tarjeta 2: Detalles del Taller -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar size="36" color="warning" variant="tonal" class="rounded-lg">
                    <VIcon icon="ri-tools-line" size="20" />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                      Detalles del Taller
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Kilometraje, combustible y técnicos asignados
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <VRow>
                <!-- Kilometraje -->
                <VCol cols="12" sm="4">
                  <label class="text-caption font-weight-bold text-slate-800 mb-1 d-block">Kilometraje</label>
                  <VTextField v-model.number="workOrder.mileage" type="number" placeholder="Ej: 45000"
                    prepend-inner-icon="ri-speed-line" variant="outlined" density="comfortable" hide-details="auto"
                    color="primary" />
                </VCol>

                <!-- Nivel de Combustible -->
                <VCol cols="12" sm="4">
                  <label class="text-caption font-weight-bold text-slate-800 mb-1 d-block">Nivel de Combustible</label>
                  <VSelect v-model="workOrder.fuel_level" :items="fuelLevels" placeholder="Seleccionar nivel"
                    prepend-inner-icon="ri-gas-station-line" variant="outlined" density="comfortable"
                    hide-details="auto" color="primary" clearable />
                </VCol>

                <!-- Técnicos Asignados -->
                <VCol cols="12" sm="4">
                  <label class="text-caption font-weight-bold text-slate-800 mb-1 d-block">Técnicos (máximo 2)</label>
                  <VAutocomplete v-model="workOrder.technicians" :items="employees"
                    :item-title="(item) => `${item.first_name} ${item.last_name} - ${item.position || ''}`"
                    item-value="id" placeholder="Seleccionar técnicos..." prepend-inner-icon="ri-user-settings-line"
                    variant="outlined" density="comfortable" hide-details="auto" color="primary" clearable
                    :loading="isLoading" multiple chips :rules="[(v) => !v || v.length <= 2 || 'Máximo 2 técnicos']"
                    class="fix-notch-bug">
                    <template #chip="{ props, item }">
                      <VChip v-bind="props" size="small" color="primary" variant="tonal"
                        :text="`${item.raw.first_name} ${item.raw.last_name}`" />
                    </template>
                  </VAutocomplete>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Tarjeta 3: Productos y Servicios -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="success" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-shopping-bag-3-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Productos y Servicios
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Agrega los items a la orden de trabajo
                      </p>
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <VBtn size="small" color="primary" variant="tonal" prepend-icon="ri-box-3-line"
                      class="font-weight-semibold" @click="addTemporaryProduct">
                      Producto Temporal
                    </VBtn>
                    <VBtn size="small" color="info" variant="tonal" prepend-icon="ri-tools-line"
                      class="font-weight-semibold" @click="showAddServiceDialog = true">
                      Servicio Express
                    </VBtn>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <!-- Cuadro de búsqueda de productos -->
              <div class="mb-4">
                <VSearch v-model="productSearch" endpoint="products/search" item-title="description"
                  :return-object="true" label="Buscar y agregar producto por nombre, código o SKU..."
                  icon="ri-search-line" class="mb-0" hide-details @change="addProductFromSearch">
                  <template #item="{ props, item }">
                    <VListItem v-bind="props" :title="undefined">
                      <template #prepend>
                        <VAvatar size="32" color="primary" variant="tonal" class="rounded-lg">
                          <VIcon icon="ri-box-3-line" size="18" />
                        </VAvatar>
                      </template>
                      <VListItemTitle style="white-space: normal !important; line-height: 1.4;"
                        class="font-weight-medium text-body-2">
                        {{ item.raw.description || item.raw.name }}
                      </VListItemTitle>
                      <VListItemSubtitle v-if="item.raw.code_aux || item.raw.sku" class="mt-1 text-grey">
                        Código/SKU: {{ item.raw.code_aux || item.raw.sku }}
                      </VListItemSubtitle>
                      <template #append>
                        <VChip size="small" color="success" variant="tonal" class="font-weight-bold">
                          ${{ parseFloat(item.raw.price_sale || item.raw.price).toFixed(2) }}
                        </VChip>
                      </template>
                    </VListItem>
                  </template>
                </VSearch>
              </div>

              <!-- Tabla de items -->
              <div v-if="workOrder.items.length > 0" class="rounded-xl border overflow-hidden">
                <VTable class="custom-items-table text-no-wrap">
                  <thead>
                    <tr class="bg-slate-50 text-caption font-weight-bold">
                      <th class="text-left font-weight-bold text-slate-700" style="min-width: 250px;">
                        Ítem / Descripción
                      </th>
                      <th class="text-center font-weight-bold text-slate-700" style="width: 130px;">
                        Cantidad
                      </th>
                      <th class="text-center font-weight-bold text-slate-700" style="width: 140px;">
                        Precio Unit.
                      </th>
                      <th class="text-center font-weight-bold text-slate-700" style="width: 120px;">
                        Descuento
                      </th>
                      <th class="text-center font-weight-bold text-slate-700" style="width: 130px;">
                        Subtotal
                      </th>
                      <th class="text-center font-weight-bold text-slate-700" style="width: 60px;">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in workOrder.items" :key="item.id || item.product_id || index"
                      class="hover-row">
                      <td>
                        <div class="d-flex align-center gap-3 py-1">
                          <VAvatar size="36" :color="item.type === 'product' ? 'primary' : 'info'" variant="tonal"
                            class="rounded-lg">
                            <VIcon :icon="item.type === 'product' ? 'ri-box-3-line' : 'ri-tools-line'" size="18" />
                          </VAvatar>
                          <div class="flex-grow-1">
                            <VTextField v-model="item.description" density="compact" variant="plain" hide-details
                              placeholder="Descripción del ítem..." class="font-weight-bold text-slate-900" />
                            <div class="text-caption text-medium-emphasis mt-1 d-flex align-center gap-2">
                              <span class="text-uppercase font-weight-bold"
                                :class="isServiceItem(item) ? 'text-primary' : 'text-secondary'"
                                style="font-size: 0.65rem;">
                                {{ isServiceItem(item) ? 'Servicio' : 'Producto' }}
                              </span>
                              <span v-if="!isServiceItem(item)" class="stock-tag"
                                :class="{ 'stock-low': item.quantity > getProductStock(item.product_id, item) }">
                                <VIcon icon="ri-stack-line" size="12" class="mr-1" />
                                {{ getProductStock(item.product_id, item) }} en stock
                              </span>
                              <span v-if="getProductSku(item.product_id) || item.sku"
                                class="text-uppercase font-weight-bold" style="font-size: 0.65rem;">
                                {{ getProductSku(item.product_id) || item.sku }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="text-center">
                        <div class="d-inline-flex align-center qty-selector">
                          <VBtn icon="ri-subtract-line" variant="text" color="primary" :disabled="item.quantity <= 1"
                            class="qty-btn" size="small" @click="item.quantity--" />
                          <input v-model.number="item.quantity" type="number" min="1" max="99"
                            class="qty-input font-mono font-weight-bold"
                            @input="item.quantity > 99 ? item.quantity = 99 : null"
                            @blur="(!item.quantity || item.quantity < 1) ? item.quantity = 1 : null">
                          <VBtn icon="ri-add-line" variant="text" color="primary" :disabled="item.quantity >= 99"
                            class="qty-btn" size="small" @click="item.quantity < 99 ? item.quantity++ : null" />
                        </div>
                      </td>
                      <td>
                        <VTextField v-model.number="item.unit_price" type="number" density="compact" variant="plain"
                          hide-details min="0" step="0.01" prefix="$"
                          class="font-weight-bold text-slate-800 font-mono" />
                      </td>
                      <td>
                        <VTextField v-model.number="item.discount" type="number" density="compact" variant="plain"
                          hide-details min="0" step="0.01" prefix="$" class="font-weight-medium text-error font-mono" />
                      </td>
                      <td class="text-center">
                        <span class="text-body-1 font-weight-black text-success font-mono">
                          ${{ calculateItemSubtotal(item).toFixed(2) }}
                        </span>
                      </td>
                      <td class="text-center">
                        <VBtn icon="ri-delete-bin-line" size="small" color="error" variant="text" class="delete-btn"
                          @click="removeItem(index)" />
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>

              <!-- Estado Vacío -->
              <div v-else class="text-center pa-10 rounded-xl bg-slate-50 border border-dashed">
                <VAvatar color="primary" variant="tonal" size="64" class="mb-3">
                  <VIcon icon="ri-shopping-bag-3-line" size="32" />
                </VAvatar>
                <div class="text-subtitle-1 font-weight-bold text-slate-900">
                  No hay productos o servicios agregados
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  Usa el buscador para agregar ítems o crea un producto/servicio temporal.
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Derecha (4 cols): Observaciones y Resumen -->
        <VCol cols="12" lg="4">
          <div class="d-flex flex-column gap-6">
            <!-- Tarjeta 4: Observaciones -->
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="secondary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-file-text-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Observaciones
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Notas internas o novedades
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>
              <VCardText class="pa-4 bg-white">
                <VTextarea v-model="workOrder.observations" rows="3" variant="outlined" density="comfortable"
                  placeholder="Describe cualquier novedad u observación del vehículo..." hide-details="auto"
                  color="primary" />
              </VCardText>
            </VCard>

            <!-- Tarjeta 5: Resumen Económico y Acciones -->
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-money-dollar-circle-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Resumen de la Orden
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        {{ workOrder.items.length }} {{ workOrder.items.length === 1 ? 'ítem agregado' :
                          'ítems agregados' }}
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>

              <VCardText class="pa-4 bg-white d-flex flex-column gap-3">
                <div class="d-flex justify-space-between align-center">
                  <span class="text-body-2 text-slate-600 font-weight-medium">Items en Orden:</span>
                  <VChip size="small" color="primary" variant="tonal" class="font-weight-bold">
                    {{ workOrder.items.length }} ítems
                  </VChip>
                </div>

                <div class="d-flex justify-space-between align-center pa-3 rounded-xl bg-slate-50 border">
                  <div>
                    <div class="text-caption font-weight-bold text-slate-500 text-uppercase">
                      Total a Pagar
                    </div>
                    <div class="text-h4 font-weight-black text-primary font-mono mt-0.5">
                      ${{ calculateTotal().toFixed(2) }}
                    </div>
                  </div>
                  <VAvatar color="primary" variant="tonal" size="44" class="rounded-xl">
                    <VIcon icon="ri-wallet-3-line" size="24" />
                  </VAvatar>
                </div>
              </VCardText>

              <VDivider />

              <VCardActions class="pa-4 bg-slate-50 d-flex flex-column gap-2">
                <VBtn block color="primary" variant="elevated" size="large" prepend-icon="ri-save-3-line"
                  class="font-weight-bold elevation-2" :loading="isSubmitting" @click="saveWorkOrder">
                  GUARDAR ORDEN
                </VBtn>
                <div class="d-flex gap-2 w-100">
                  <VBtn color="secondary" variant="tonal" prepend-icon="ri-file-draft-line"
                    class="font-weight-semibold flex-grow-1" :loading="isSavingDraft" @click="saveDraft">
                    Borrador
                  </VBtn>
                  <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line" class="font-weight-medium"
                    @click="cancel">
                    Cancelar
                  </VBtn>
                </div>
              </VCardActions>
            </VCard>
          </div>
        </VCol>
      </VRow>
    </VForm>

    <!-- Dialog para agregar cliente -->
    <ClientFinalAddDialog :is-dialog-visible="showClientDialog" @update:is-dialog-visible="showClientDialog = $event"
      @add-client-final="onClientAdded" />

    <!-- Dialog para agregar cliente empresa -->
    <ClientCompanyAddDialog :is-dialog-visible="showCompanyDialog"
      @update:is-dialog-visible="showCompanyDialog = $event" @add-client-company="onCompanyAdded" />

    <!-- Dialog para agregar vehículo -->
    <VehicleAddDialog :is-dialog-visible="showVehicleDialog" :client-selected-id="workOrder.client_id"
      @update:is-dialog-visible="showVehicleDialog = $event" @add-vehicle="onVehicleAdded" />

    <!-- Dialog para agregar servicio express -->
    <AddServiceDialog v-model:isDialogVisible="showAddServiceDialog" @service-added="handleServiceAdded" />
  </div>
</template>
