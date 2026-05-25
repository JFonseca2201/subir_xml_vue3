<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { getBrandNameById } from '@/data/vehicleBrands.js'

const router = useRouter()
const route = useRoute()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const formRef = ref(null)
const isLoading = ref(false)
const showValidationError = ref(false)
const validationErrorMessage = ref('')

// Opciones
const documentTypes = [
  { title: 'Cotización', value: 'quote' },
  { title: 'Nota de Venta', value: 'sale_note' },
  { title: 'Factura', value: 'invoice' },
]

const paymentStatuses = [
  { title: 'Pagado', value: 'paid' },
  { title: 'Parcial', value: 'partial' },
  { title: 'Pendiente', value: 'pending' },
]

const paymentMethods = [
  { title: 'Efectivo', value: 'Efectivo' },
  { title: 'Transferencia', value: 'Transferencia' },
  { title: 'Tarjeta de Crédito', value: 'Tarjeta de Crédito' },
  { title: 'Tarjeta de Débito', value: 'Tarjeta de Débito' },
]

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const accounts = ref([])

// Estado del formulario
const sale = ref({
  document_type: '',
  document_number: '',
  client_id: null,
  vehicle_id: null,
  mileage: null,
  service_date: '',
  payment_status: '',
  is_credited: false,
  payment_method: 'Efectivo',
  observations: '',
  subtotal: 0,
  tax_amount: 0,
  total: 0,
  status: '',
  client: null,
  vehicle: null,
  items: [],
})

// Pagos distribuidos
const paymentDistributions = ref([])

// Buscador de productos
const searchProduct = ref(null)

// Reglas de validación
const requiredRule = v => !!v || 'Campo obligatorio'

// Helpers
const getClientName = client => {
  if (!client) return 'Consumidor Final'

  return client.full_name || client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Cliente Desconocido'
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const formatDate = dateString => {
  if (!dateString) return '-'
  const [year, month, day] = dateString.split('T')[0].split('-')

  return `${day}/${month}/${year}`
}

// Watch para cambiar estado de pago cuando es crédito
const onCreditChange = () => {
  if (sale.value.is_credited) {
    sale.value.payment_status = 'pending'
  } else {
    sale.value.payment_status = 'paid'
  }
}

// Watch para regenerar número cuando cambia el tipo de documento
const onDocumentTypeChange = () => {
  // Solo permitir cambiar de cotización a venta, no viceversa
  if (sale.value.document_type !== 'quote' && sale.value.document_type !== '') {
    // Si ya es una venta (nota de venta o factura), no permitir cambiar a cotización
    showNotification('Solo las cotizaciones pueden convertirse a ventas', 'warning')

    return
  }
}

// Inicializar con un pago distribuido cuando hay items
const initializePaymentDistribution = () => {
  if (paymentDistributions.value.length === 0 && sale.value.items.length > 0) {
    paymentDistributions.value.push({
      account_id: 1,
      amount: 0,
      payment_method: 'Efectivo',
    })
  }
}

// Gestión del detalle (items)
const removeItem = index => {
  sale.value.items.splice(index, 1)
}

// Gestión de pagos distribuidos
const addPaymentDistribution = () => {
  const newPayment = {
    account_id: null,
    amount: 0,
    payment_method: 'Efectivo',
  }

  paymentDistributions.value.push(newPayment)
  if (newPayment.payment_method === 'Efectivo') {
    newPayment.account_id = 1
  }
}

const removePaymentDistribution = index => {
  if (paymentDistributions.value.length > 1) {
    paymentDistributions.value.splice(index, 1)
  }
}

// Asignar cuenta automáticamente según método de pago
const onPaymentMethodChange = (dist, newMethod) => {
  if (newMethod === 'Efectivo') {
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))

    dist.account_id = cajaChica ? cajaChica.id : 1
  } else if (newMethod === 'Transferencia') {
    dist.account_id = null
  }
}

const initializePaymentAccount = dist => {
  if (dist.payment_method === 'Efectivo') {
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))

    dist.account_id = cajaChica ? cajaChica.id : 1
  }
}

const totalDistributed = computed(() => {
  return paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0)
})

const remainingAmount = computed(() => {
  return total.value - totalDistributed.value
})

const getPaymentIcon = method => {
  const icons = {
    'Efectivo': 'ri-money-dollar-circle-line',
    'Transferencia': 'ri-bank-transfer-line',
    'Tarjeta de Crédito': 'ri-bank-card-line',
    'Tarjeta de Débito': 'ri-bank-card-2-line',
  }


  return icons[method] || 'ri-money-dollar-circle-line'
}

const onProductSelected = product => {
  if (product && typeof product === 'object') {
    const existingItem = sale.value.items.find(i => i.product_id === product.id)
    if (existingItem) {
      existingItem.quantity++
    } else {
      sale.value.items.push({
        product_id: product.id,
        description: product.description || product.name || '',
        quantity: 1,
        price: product.price_sale || product.price || 0,
        discount: 0,
      })
    }
    initializePaymentDistribution()
    searchProduct.value = null
  }
}

const productFilter = (value, query, item) => {
  if (query == null || query === '') return true

  const q = String(query).toLowerCase().trim()
  if (!q) return true

  const raw = item?.raw
  if (!raw) return false

  // Convertir de forma segura cada campo a texto minúscula para comparación
  const sku = String(raw.sku || '').toLowerCase()
  const name = String(raw.name || '').toLowerCase()
  const desc = String(raw.description || '').toLowerCase()

  return sku.includes(q) || sku.includes(q) || name.includes(q) || desc.includes(q)
}

const clientFilter = (value, query, item) => {
  if (query == null || query === '') return true
  const q = String(query).toLowerCase().trim()
  const raw = item?.raw
  if (!raw) return false
  const n_doc = String(raw.n_document || '').toLowerCase()
  const name = String(getClientName(raw)).toLowerCase()

  return name.includes(q) || n_doc.includes(q)
}

// Cálculos
const TAX_RATE = 0.15

const grossSubtotal = computed(() => {
  return sale.value.items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
})

const totalDiscount = computed(() => {
  return sale.value.items.reduce((sum, item) => sum + (Number(item.discount) || 0), 0)
})

const subtotal = computed(() => {
  return grossSubtotal.value - totalDiscount.value
})

const taxAmount = computed(() => {
  if (sale.value.document_type === 'invoice') {
    return subtotal.value * TAX_RATE
  }

  return 0
})

const total = computed(() => {
  return subtotal.value + taxAmount.value
})

// Computed para verificar si es cotización
const isQuote = computed(() => {
  return sale.value.document_type === 'quote'
})

// Computed para verificar si se puede convertir a venta
const canConvertToSale = computed(() => {
  return isQuote.value && sale.value.status !== 'canceled' && sale.value.items.length > 0
})

// Computed para obtener el cliente seleccionado
const selectedClient = computed(() => {
  if (!sale.value.client_id) return null

  // Buscar en la lista de clientes cargados
  return clients.value.find(c => c.id === sale.value.client_id) || sale.value.client
})

// Computed para obtener el vehículo seleccionado
const selectedVehicle = computed(() => {
  if (!sale.value.vehicle_id) return null

  return sale.value.vehicle
})

// Cargar datos iniciales
const loadSaleData = async () => {
  isLoading.value = true
  try {
    const [saleRes, clientsRes, vehiclesRes, productsRes, accountsRes] = await Promise.all([
      $api(`sales/${route.params.id}`),
      $api('clients', { params: { per_page: 1000 } }),
      $api('vehicles', { params: { per_page: 1000 } }),
      $api('products', { params: { per_page: 1000 } }),
      $api('accounts', { params: { per_page: 1000 } }),
    ])

    const extractArray = (res, key) => {
      if (Array.isArray(res)) return res
      if (res?.[key] && Array.isArray(res[key])) return res[key]
      if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
      if (res?.data && Array.isArray(res.data)) return res.data
      if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data

      return []
    }

    const saleData = saleRes.data || saleRes

    sale.value = {
      document_type: saleData.document_type,
      document_number: saleData.document_number,
      client_id: saleData.client_id,
      vehicle_id: saleData.vehicle_id,
      mileage: saleData.mileage,
      service_date: saleData.service_date ? saleData.service_date.split('T')[0] : '',
      payment_status: saleData.payment_status,
      is_credited: saleData.is_credited,
      payment_method: saleData.payment_method,
      observations: saleData.observations || '',
      subtotal: saleData.subtotal,
      tax_amount: saleData.tax_amount,
      total: saleData.total,
      status: saleData.status,
      client: saleData.client,
      vehicle: saleData.vehicle,
      items: (saleData.details || []).map(d => ({
        id: d.id,
        product_id: d.product_id,
        description: d.description,
        quantity: d.quantity,
        price: d.price,
        discount: d.discount,
      })),
    }

    clients.value = extractArray(clientsRes, 'clients')

    const rawVehicles = extractArray(vehiclesRes, 'vehicles')


    // Agregar campo de búsqueda combinado para vehículos
    vehicles.value = rawVehicles.map(v => {
      const brandId = typeof v.brand === 'object' ? v.brand.id : v.brand
      const brandName = brandId ? getBrandNameById(brandId) : ''
      const parts = [v.license_plate, brandName, v.model].filter(p => p !== undefined && p !== null)
      const displayTitle = parts.length > 0 ? parts.join(' - ') : v.license_plate || 'Vehículo'

      return {
        ...v,
        brand: brandId,
        displayTitle,
      }
    })

    const rawProducts = extractArray(productsRes, 'products')

    products.value = rawProducts.map(p => ({
      ...p,
      searchText: `${p.sku || ''} ${p.sku || ''} ${p.name || ''} ${p.description || ''}`.toLowerCase(),
      displayTitle: p.description || p.name || '',
    }))
    accounts.value = extractArray(accountsRes, 'accounts')

    // Si no es cotización, cargar los pagos distribuidos existentes
    if (sale.value.document_type !== 'quote' && saleData.finance_record) {
      const financeRecord = saleData.finance_record

      if (financeRecord && financeRecord.payment_distributions) {
        paymentDistributions.value = financeRecord.payment_distributions.map(pd => ({
          account_id: pd.account_id,
          amount: pd.amount,
          payment_method: pd.payment_method,
        }))
      } else {
        // Si no hay pagos distribuidos, inicializar con uno vacío
        initializePaymentDistribution()
      }
    } else if (sale.value.document_type !== 'quote' && sale.value.items.length > 0) {
      // Inicializar pagos distribuidos si no es cotización
      initializePaymentDistribution()
    }

  } catch (error) {
    console.error('Error al cargar datos:', error)
    showNotification('Error al cargar los datos de la venta', 'error')
    router.push('/sales/list')
  } finally {
    isLoading.value = false
  }
}

// Envío del formulario
const submitForm = async () => {
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

  // Validar que haya al menos un producto/servicio
  if (sale.value.items.length === 0) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe agregar al menos un producto o servicio'

    return
  }

  // Validar stock solo si no es cotización
  if (sale.value.document_type !== 'quote') {
    for (const item of sale.value.items) {
      if (item.product_id) {
        const product = products.value.find(p => p.id === item.product_id)
        if (product && product.stock < item.quantity) {
          showValidationError.value = true
          validationErrorMessage.value = `Stock insuficiente para ${product.description}. Stock disponible: ${product.stock}, Solicitado: ${item.quantity}`

          return
        }
      }
    }
  }

  // Validar descuentos máximos
  for (const item of sale.value.items) {
    if (item.product_id) {
      const product = products.value.find(p => p.id === item.product_id)
      if (product && product.max_discount !== null && product.max_discount !== undefined) {
        const maxDiscountAmount = (item.quantity * item.price) * (product.max_discount / 100)
        if (item.discount > maxDiscountAmount) {
          showValidationError.value = true
          validationErrorMessage.value = `Descuento excede el máximo permitido para ${product.description}. Máximo: ${maxDiscountAmount.toFixed(2)}, Ingresado: ${item.discount.toFixed(2)}`

          return
        }
      }
    }
  }

  // Validar pagos distribuidos solo si no es cotización
  if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
    const totalDist = paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0)
    if (Math.abs(totalDist - total.value) > 0.01) {
      showValidationError.value = true
      validationErrorMessage.value = 'La suma de los pagos debe ser igual al total'

      return
    }
  }

  // Si es cotización y se va a convertir a venta, confirmar
  if (isQuote.value && sale.value.document_type !== 'quote') {
    if (!window.confirm('¿Está seguro de convertir esta cotización en una venta? Esta acción restará el stock y procesará los pagos.')) {
      return
    }
  }

  loader.start()

  try {
    const payload = {
      ...sale.value,
      subtotal: subtotal.value,
      tax_amount: taxAmount.value,
      total: total.value,
      items: sale.value.items,
    }

    // Enviar pagos distribuidos solo si no es cotización
    if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
      payload.payment_distributions = paymentDistributions.value
    }

    const response = await $api(`sales/${route.params.id}`, {
      method: 'PUT',
      body: payload,
    })

    if (response?.success || response?.status === 200) {
      showNotification('Venta actualizada correctamente', 'success')
      router.push('/sales/list')
    } else {
      showNotification(response.message || 'Error al actualizar', 'error')
    }
  } catch (error) {
    console.error('Error enviando formulario', error)

    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'

    showNotification(errMsg, 'error')
  } finally {
    loader.stop()
  }
}

onMounted(() => {
  loadSaleData()
})
</script>

<template>
  <div class="pa-4 pa-sm-6">
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <div class="d-flex align-center">
          <VAvatar color="primary" variant="tonal" size="48" class="mr-3">
            <VIcon icon="ri-edit-box-line" size="28" />
          </VAvatar>
          <h1 class="text-h4 font-weight-bold mb-1">
            Editar Venta
          </h1>
        </div>
        <p class="text-medium-emphasis mb-0">
          Modifica la información de la venta o cotización
        </p>
      </div>
      <VBtn color="secondary" variant="outlined" prepend-icon="ri-arrow-left-line" to="/sales/list">
        Volver al Listado
      </VBtn>
    </div>

    <VForm ref="formRef" @submit.prevent="submitForm">
      <VRow>
        <!-- COLUMNA IZQUIERDA (OPERATIVA) -->
        <VCol cols="12" md="8">
          
          <!-- Selección de Tipo de Documento -->
          <div v-if="!isLoading && sale.document_type" class="mb-6">
            <h2 class="text-h6 font-weight-bold mb-3">Tipo de Documento</h2>
            <div class="d-flex gap-3 flex-wrap">
              <!-- Cotización -->
              <VCard v-if="sale.document_type === 'quote'" :class="[sale.document_type === 'quote' ? 'border-primary border-2 bg-primary-lighten-5' : 'border-opacity-25', sale.status === 'canceled' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:elevation-3 transition-all']" class="flex-1 rounded-lg elevation-1" variant="outlined" @click="sale.status !== 'canceled' && (sale.document_type = 'quote'); onDocumentTypeChange()">
                <VCardText class="pa-4 text-center">
                  <VIcon icon="ri-file-text-line" size="28" :color="sale.document_type === 'quote' ? 'primary' : 'grey'" class="mb-2"/>
                  <div class="font-weight-bold" :class="sale.document_type === 'quote' ? 'text-primary' : 'text-grey'">Cotización</div>
                </VCardText>
              </VCard>

              <!-- Nota de Venta -->
              <VCard v-if="sale.document_type === 'sale_note'" :class="[sale.document_type === 'sale_note' ? 'border-success border-2 bg-success-lighten-5' : 'border-opacity-25', sale.status === 'canceled' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:elevation-3 transition-all']" class="flex-1 rounded-lg elevation-1" variant="outlined" @click="sale.status !== 'canceled' && (sale.document_type = 'sale_note'); onDocumentTypeChange()">
                <VCardText class="pa-4 text-center">
                  <VIcon icon="ri-file-list-3-line" size="28" :color="sale.document_type === 'sale_note' ? 'success' : 'grey'" class="mb-2"/>
                  <div class="font-weight-bold" :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey'">Nota de Venta</div>
                </VCardText>
              </VCard>

              <!-- Factura -->
              <VCard v-if="sale.document_type === 'invoice'" :class="[sale.document_type === 'invoice' ? 'border-purple border-2 bg-purple-lighten-5' : 'border-opacity-25', sale.status === 'canceled' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:elevation-3 transition-all']" class="flex-1 rounded-lg elevation-1" variant="outlined" @click="sale.status !== 'canceled' && (sale.document_type = 'invoice'); onDocumentTypeChange()">
                <VCardText class="pa-4 text-center">
                  <VIcon icon="ri-bill-line" size="28" :color="sale.document_type === 'invoice' ? 'purple' : 'grey'" class="mb-2"/>
                  <div class="font-weight-bold" :class="sale.document_type === 'invoice' ? 'text-purple' : 'text-grey'">Factura</div>
                </VCardText>
              </VCard>
            </div>
          </div>

          <!-- Datos Generales -->
          <VCard class="mb-6 elevation-2 rounded-lg border">
            <VCardItem class="bg-grey-lighten-4 py-3">
              <template #title>
                <div class="d-flex align-center justify-space-between w-100">
                  <span class="text-subtitle-1 font-weight-bold d-flex align-center">
                    <VIcon icon="ri-profile-line" class="mr-2" size="20"/> Datos Generales
                  </span>
                </div>
              </template>
            </VCardItem>
            <VDivider />
            <VCardText class="pa-5">
              <VRow>
                <VCol cols="12" md="6">
                  <VTextField v-model="sale.document_number" label="Número de Documento *" :rules="[requiredRule]" variant="outlined" density="comfortable" prepend-inner-icon="ri-hashtag" hide-details="auto" required readonly bg-color="grey-lighten-4" />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField v-model="sale.service_date" label="Fecha de Servicio *" type="date" :rules="[requiredRule]" variant="outlined" density="comfortable" prepend-inner-icon="ri-calendar-line" hide-details="auto" required :disabled="sale.status === 'canceled'" />
                </VCol>
                <VCol cols="12">
                  <div class="d-flex gap-2 align-start">
                    <VAutocomplete v-model="sale.client_id" :items="clients" :item-title="getClientName" item-value="id" label="Cliente *" :rules="[requiredRule]" variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line" hide-details="auto" required placeholder="Buscar por nombre o documento" clearable :custom-filter="clientFilter" class="flex-grow-1" :disabled="sale.status === 'canceled'">
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="getClientName(item.raw)" :subtitle="item.raw?.n_document" />
                      </template>
                    </VAutocomplete>
                  </div>
                </VCol>
                <VCol cols="12" md="6">
                  <div class="d-flex gap-2 align-start">
                    <VAutocomplete v-model="sale.vehicle_id" :items="vehicles" item-title="license_plate" item-value="id" label="Vehículo (Opcional)" variant="outlined" density="comfortable" prepend-inner-icon="ri-car-line" hide-details="auto" placeholder="Buscar placa" clearable class="flex-grow-1" :disabled="sale.status === 'canceled'">
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="item.raw.license_plate" :subtitle="`${item.raw.model || ''}`" />
                      </template>
                    </VAutocomplete>
                  </div>
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField v-model="sale.mileage" label="Kilometraje (Opcional)" type="number" variant="outlined" density="comfortable" prepend-inner-icon="ri-speed-up-line" hide-details="auto" :disabled="sale.status === 'canceled'" />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Detalle de Productos -->
          <VCard class="mb-6 elevation-2 rounded-lg border">
            <VCardItem class="bg-gradient-to-r from-primary to-primary-darken-1 text-white py-3">
              <template #title>
                <span class="text-subtitle-1 font-weight-bold d-flex align-center">
                  <VIcon icon="ri-shopping-cart-2-line" class="mr-2" size="20"/> Detalle de Productos/Servicios
                </span>
              </template>
            </VCardItem>
            <VCardText class="pa-4">
              <VAutocomplete v-model="searchProduct" :items="products" item-title="displayTitle" return-object label="Buscar y agregar producto/servicio..." placeholder="Escribe para buscar por código, nombre o descripción..." prepend-inner-icon="ri-search-2-line" variant="outlined" density="comfortable" clearable :custom-filter="productFilter" @update:model-value="onProductSelected" class="mb-4" hide-details :disabled="sale.status === 'canceled'">
                <template #item="{ props, item }">
                  <VListItem v-bind="props" :title="item.raw.name || item.raw.description" :subtitle="(item.raw.sku || item.raw.code) ? `Código/SKU: ${item.raw.sku || item.raw.code}` : ''" />
                </template>
              </VAutocomplete>

              <div v-if="sale.items.length === 0" class="text-center pa-8 border rounded-lg bg-grey-lighten-4 border-dashed">
                <VIcon icon="ri-inbox-line" size="48" color="grey-lighten-1" class="mb-2"/>
                <div class="text-body-1 text-medium-emphasis">No hay productos agregados</div>
                <div class="text-caption text-grey">Busca y selecciona un producto arriba para comenzar</div>
              </div>

              <div v-else class="border rounded-lg overflow-x-auto">
                <VTable class="text-no-wrap" density="compact">
                  <thead class="bg-grey-lighten-4">
                    <tr>
                      <th class="text-uppercase text-caption font-weight-bold">Descripción</th>
                      <th class="text-uppercase text-caption font-weight-bold" style="width: 100px;">Cant.</th>
                      <th class="text-uppercase text-caption font-weight-bold" style="width: 120px;">P. Unit</th>
                      <th class="text-uppercase text-caption font-weight-bold" style="width: 100px;">Desc.</th>
                      <th class="text-uppercase text-caption font-weight-bold text-right" style="width: 120px;">Total</th>
                      <th style="width: 50px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in sale.items" :key="item.id || item.product_id || index" class="hover:bg-grey-lighten-5 transition-colors">
                      <td class="pa-2">
                        <VTextField v-model="item.description" placeholder="Descripción" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" bg-color="white" :disabled="sale.status === 'canceled'"/>
                      </td>
                      <td class="pa-2">
                        <VTextField v-model.number="item.quantity" type="number" min="1" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" bg-color="white" :disabled="sale.status === 'canceled'"/>
                      </td>
                      <td class="pa-2">
                        <VTextField v-model.number="item.price" type="number" min="0" step="0.01" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" prefix="$" bg-color="white" :disabled="sale.status === 'canceled'"/>
                      </td>
                      <td class="pa-2">
                        <VTextField v-model.number="item.discount" type="number" min="0" step="0.01" variant="outlined" density="compact" hide-details="auto" prefix="$" bg-color="white" :disabled="sale.status === 'canceled'"/>
                      </td>
                      <td class="pa-2 text-right font-weight-bold">
                        ${{ ((item.quantity * item.price) - (item.discount || 0)).toFixed(2) }}
                      </td>
                      <td class="pa-2 text-center">
                        <VBtn icon="ri-delete-bin-line" variant="text" color="error" size="small" @click="removeItem(index)" :disabled="sale.status === 'canceled'" />
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </VCardText>
          </VCard>

          <VCard class="elevation-2 rounded-lg border mb-4">
            <VCardItem class="bg-grey-lighten-4 py-2">
              <span class="text-subtitle-2 font-weight-medium d-flex align-center text-medium-emphasis">
                <VIcon icon="ri-edit-2-line" class="mr-2" size="16"/> Observaciones (Opcional)
              </span>
            </VCardItem>
            <VDivider />
            <VCardText class="pa-0">
              <VTextarea v-model="sale.observations" placeholder="Notas adicionales para el documento..." variant="solo" flat hide-details rows="2" class="rounded-0" :disabled="sale.status === 'canceled'"/>
            </VCardText>
          </VCard>
          
          <VAlert v-if="showValidationError" color="error" variant="tonal" class="mb-4 d-md-none" border="start" closable @click:close="showValidationError = false">
            <div class="d-flex align-center">
              <VIcon icon="ri-error-warning-line" class="mr-2" size="20"/>
              <span class="text-body-2">{{ validationErrorMessage }}</span>
            </div>
          </VAlert>
          
          <VAlert v-if="canConvertToSale" type="warning" variant="tonal" class="mb-4 d-md-none" border="start">
            <template #prepend>
              <VIcon icon="ri-exclamation-line" />
            </template>
            <div class="text-body-2">
              <strong>Esta es una cotización</strong>. Puedes convertirla en una venta cambiando el
              tipo de documento arriba.
            </div>
          </VAlert>

        </VCol>

        <!-- COLUMNA DERECHA (STICKY) -->
        <VCol cols="12" md="4">
          <div style="position: sticky; top: 20px;">
            <!-- RESUMEN FINANCIERO -->
            <VCard class="elevation-3 rounded-lg border-primary border-opacity-50 mb-4 overflow-hidden">
              <div class="bg-primary pa-4 text-center">
                <div class="text-caption text-white opacity-70 text-uppercase letter-spacing-1 mb-1">{{ sale.document_type === 'quote' ? 'Total Cotizado' : 'Total a Pagar' }}</div>
                <div class="text-h3 font-weight-bold text-white">${{ total.toFixed(2) }}</div>
              </div>
              <VCardText class="pa-5">
                <div class="d-flex justify-space-between mb-2">
                  <span class="text-medium-emphasis">Subtotal:</span>
                  <span class="font-weight-medium">${{ grossSubtotal.toFixed(2) }}</span>
                </div>
                <div v-if="totalDiscount > 0" class="d-flex justify-space-between mb-2 text-error">
                  <span>Descuentos:</span>
                  <span class="font-weight-medium">-${{ totalDiscount.toFixed(2) }}</span>
                </div>
                <div class="d-flex justify-space-between mb-2">
                  <span class="text-medium-emphasis">Base Imponible:</span>
                  <span class="font-weight-medium">${{ subtotal.toFixed(2) }}</span>
                </div>
                <div v-if="sale.document_type === 'invoice'" class="d-flex justify-space-between mb-2">
                  <span class="text-medium-emphasis">IVA (15%):</span>
                  <span class="font-weight-medium">${{ taxAmount.toFixed(2) }}</span>
                </div>
              </VCardText>
            </VCard>
            
            <VAlert v-if="canConvertToSale" type="warning" variant="tonal" class="mb-4 d-none d-md-block" border="start">
              <template #prepend>
                <VIcon icon="ri-exclamation-line" />
              </template>
              <div class="text-body-2">
                <strong>Esta es una cotización</strong>. Puedes convertirla en una venta cambiando el
                tipo de documento.
              </div>
            </VAlert>

            <!-- PAGOS Y CREDITO -->
            <VCard v-if="sale.document_type !== 'quote'" class="elevation-2 rounded-lg border mb-4">
              <VCardItem class="bg-grey-lighten-4 py-3">
                <span class="text-subtitle-1 font-weight-bold d-flex align-center">
                  <VIcon icon="ri-secure-payment-line" class="mr-2" size="20"/> Configuración de Pago
                </span>
              </VCardItem>
              <VDivider />
              <VCardText class="pa-4">
                <div class="mb-3">
                  <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">Estado General</label>
                  <VSelect v-model="sale.payment_status" :items="paymentStatuses" item-title="title" item-value="value" :rules="[requiredRule]" variant="outlined" density="compact" prepend-inner-icon="ri-flag-line" hide-details="auto" bg-color="white" :disabled="sale.status === 'canceled'" />
                </div>
              
                <div class="d-flex align-center justify-space-between mb-4 px-3 py-2 bg-blue-grey-lighten-5 rounded border">
                  <span class="font-weight-medium d-flex align-center">
                     <VIcon icon="ri-hand-coin-line" class="mr-2" size="18"/> ¿Venta a Crédito?
                  </span>
                  <VSwitch v-model="sale.is_credited" color="primary" density="compact" hide-details @change="onCreditChange" :disabled="sale.status === 'canceled'" />
                </div>

                <div v-if="!sale.is_credited">
                  <div class="d-flex justify-space-between align-center mb-3">
                    <span class="text-subtitle-2 text-medium-emphasis">Distribución de Pagos</span>
                    <VBtn color="primary" variant="tonal" size="x-small" prepend-icon="ri-add-line" @click="addPaymentDistribution" :disabled="sale.status === 'canceled'">Agregar</VBtn>
                  </div>
                  
                  <div class="d-flex flex-column gap-3">
                    <VCard v-for="(dist, index) in paymentDistributions" :key="dist.id || index" variant="outlined" class="border-opacity-50">
                      <div class="pa-3 position-relative">
                        <VBtn v-if="paymentDistributions.length > 1" icon="ri-close-line" size="x-small" variant="text" color="grey" class="position-absolute" style="top: 4px; right: 4px; z-index: 2;" @click="removePaymentDistribution(index)" :disabled="sale.status === 'canceled'"/>
                        
                        <div class="text-caption font-weight-bold mb-2">Pago {{ index + 1 }}</div>
                        <VRow dense>
                          <VCol cols="12">
                            <VSelect v-model="dist.payment_method" :items="paymentMethods" item-title="title" item-value="value" label="Método" variant="outlined" density="compact" hide-details :rules="[requiredRule]" @update:model-value="(val) => onPaymentMethodChange(dist, val)" :disabled="sale.status === 'canceled'"/>
                          </VCol>
                          <VCol cols="12">
                            <VSelect v-if="dist.payment_method === 'Transferencia'" v-model="dist.account_id" :items="accounts" item-title="name" item-value="id" label="Cuenta bancaria" variant="outlined" density="compact" hide-details :rules="[requiredRule]" :disabled="sale.status === 'canceled'"/>
                            <VTextField v-else :value="dist.payment_method === 'Efectivo' ? 'Caja Chica' : ''" label="Cuenta" variant="outlined" density="compact" hide-details bg-color="grey-lighten-4" readonly :disabled="sale.status === 'canceled'"/>
                            <input v-if="dist.payment_method === 'Efectivo'" v-model="dist.account_id" type="hidden">
                          </VCol>
                          <VCol cols="12">
                            <VTextField v-model.number="dist.amount" type="number" min="0" step="0.01" label="Monto" variant="outlined" density="compact" hide-details :rules="[requiredRule]" prefix="$" :disabled="sale.status === 'canceled'"/>
                          </VCol>
                        </VRow>
                      </div>
                    </VCard>
                  </div>

                  <div v-if="paymentDistributions.length > 0" class="mt-4 px-3 py-2 rounded" :class="remainingAmount === 0 ? 'bg-success-lighten-5 text-success' : 'bg-error-lighten-5 text-error'">
                    <div class="d-flex justify-space-between text-caption font-weight-bold">
                      <span>Falta distribuir:</span>
                      <span>${{ remainingAmount.toFixed(2) }}</span>
                    </div>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <VAlert v-if="showValidationError" color="error" variant="tonal" class="mb-4 d-none d-md-block" border="start" closable @click:close="showValidationError = false">
              <div class="d-flex align-center">
                <VIcon icon="ri-error-warning-line" class="mr-2" size="20"/>
                <span class="text-body-2">{{ validationErrorMessage }}</span>
              </div>
            </VAlert>

            <VBtn type="submit" color="primary" size="x-large" block class="elevation-3 font-weight-bold text-subtitle-1 rounded-lg" :loading="loader.loading" :disabled="sale.status === 'canceled'">
              <VIcon icon="ri-save-3-line" class="mr-2"/>
              Guardar Cambios
            </VBtn>
          </div>
        </VCol>
      </VRow>
    </VForm>
  </div>
</template>