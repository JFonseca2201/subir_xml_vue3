<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { getBrandNameById } from '@/data/vehicleBrands.js'

import ClientFinalAddDialog from '@/components/inventory/clients/ClientFinalAddDialog.vue'
import ClientCompanyAddDialog from '@/components/inventory/clients/ClientCompanyAddDialog.vue'
import VehicleAddDialog from '@/components/inventory/vehicles/VehicleAddDialog.vue'

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
  document_type: 'sale_note',
  document_number: '',
  client_id: null,
  vehicle_id: null,
  work_order_id: null,
  mileage: null,
  service_date: new Date().toISOString().substr(0, 10),
  payment_status: 'paid',
  is_credited: false,
  payment_method: 'Efectivo',
  observations: '',
  items: [],
  user_id: userId.value,
})

// Watch para cambiar estado de pago cuando es crédito
const onCreditChange = () => {
  if (sale.value.is_credited) {
    sale.value.payment_status = 'pending'
  } else {
    sale.value.payment_status = 'paid'
  }
}

const lastOtNumber = ref(0)
const lastCotNumber = ref(0)

// Generar número de documento secuencial
const generateDocumentNumber = type => {
  if (type === 'quote') {
    const newNumber = lastCotNumber.value + 1
    
    return 'COT-' + String(newNumber).padStart(7, '0')
  } else {
    const newNumber = lastOtNumber.value + 1
    
    return 'OT-' + String(newNumber).padStart(7, '0')
  }
}

// Watch para regenerar número cuando cambia el tipo de documento
const onDocumentTypeChange = () => {
  sale.value.document_number = generateDocumentNumber(sale.value.document_type)
  if (sale.value.document_type === 'quote') {
    sale.value.payment_status = 'pending'
  } else {
    sale.value.payment_status = sale.value.is_credited ? 'pending' : 'paid'
  }
}

// Pagos distribuidos
const paymentDistributions = ref([])

// Inicializar con un pago distribuido cuando hay items
const initializePaymentDistribution = () => {
  if (paymentDistributions.value.length === 0 && sale.value.items.length > 0) {
    paymentDistributions.value.push({
      account_id: 1, // Caja Chica por defecto para efectivo
      amount: 0,
      payment_method: 'Efectivo',
    })
  }
}

// Estado de diálogos y manejadores
const isClientFinalAddDialogVisible = ref(false)
const isClientCompanyAddDialogVisible = ref(false)
const isVehicleAddDialogVisible = ref(false)
const isWorkOrderImportDialogVisible = ref(false)
const readyWorkOrders = ref([])
const isLoadingWorkOrders = ref(false)

const handleClientAdded = async clientData => {
  if (clientData) {
    const newId = clientData.id || Date.now()
    const newClient = { ...clientData, id: newId }

    const exists = clients.value.find(c => (c.n_document && c.n_document === newClient.n_document) || c.id === newId)
    if (!exists) {
      // Al reasignar el arreglo forzamos a que Vuetify detecte el cambio instantáneamente
      clients.value = [newClient, ...clients.value]
    }

    await nextTick()
    sale.value.client_id = exists ? exists.id : newId
  }
}

const handleVehicleAdded = async vehicleData => {
  console.log(vehicleData)

  if (vehicleData) {
    // Extract vehicle from response structure
    const vehicle = vehicleData.vehicle || vehicleData
    const newId = vehicle.id || Date.now()
    const brandId = typeof vehicle.brand === 'object' ? vehicle.brand.id : vehicle.brand
    const brandName = brandId ? getBrandNameById(brandId) : ''
    const parts = [vehicle.license_plate, brandName, vehicle.model].filter(p => p !== undefined && p !== null)
    const displayTitle = parts.length > 0 ? parts.join(' - ') : vehicle.license_plate || 'Vehículo'

    const newVehicle = {
      ...vehicle,
      id: newId,
      brand: brandId,
      displayTitle,
    }

    const exists = vehicles.value.find(v => (v.license_plate && v.license_plate === newVehicle.license_plate) || v.id === newId)
    if (!exists) {
      // Al reasignar el arreglo forzamos a que Vuetify detecte el cambio instantáneamente
      vehicles.value = [newVehicle, ...vehicles.value]
    }

    await nextTick()
    sale.value.vehicle_id = exists ? exists.id : newId
  }
}

// Función para cargar órdenes listas para facturar
const loadReadyWorkOrders = async () => {
  isLoadingWorkOrders.value = true
  try {
    const response = await $api('work-orders/ready-to-invoice')

    readyWorkOrders.value = response.data || []
  } catch (error) {
    console.error('Error al cargar órdenes listas:', error)
    showNotification('Error al cargar las órdenes listas para facturar', 'error')
  } finally {
    isLoadingWorkOrders.value = false
  }
}

// Función para seleccionar una orden de trabajo
const selectWorkOrder = workOrder => {
  sale.value.work_order_id = workOrder.id
  sale.value.client_id = workOrder.client_id
  sale.value.vehicle_id = workOrder.vehicle_id
  sale.value.mileage = workOrder.mileage

  // Importar items de la orden de trabajo
  if (workOrder.items && workOrder.items.length > 0) {
    sale.value.items = workOrder.items.map(item => ({
      product_id: item.product_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      subtotal: item.subtotal,
    }))
  }

  isWorkOrderImportDialogVisible.value = false
  showNotification('Orden de trabajo importada exitosamente', 'success')
}

// Abrir diálogo de importación de órdenes de trabajo
const openWorkOrderImportDialog = () => {
  loadReadyWorkOrders()
  isWorkOrderImportDialogVisible.value = true
}

const searchProduct = ref(null)
const isClearingSearch = ref(false)

// Reglas de validación
const requiredRule = v => !!v || 'Campo obligatorio'

// Helpers
const getClientName = c => {
  if (!c) return 'Cliente'
  
  return c.full_name || c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente'
}

// Carga inicial
const loadInitialData = async () => {
  isLoading.value = true
  try {
    // Cargar datos en paralelo con menos registros para mejorar rendimiento
    const [clientsRes, vehiclesRes, productsRes, accountsRes, salesRes] = await Promise.all([
      $api('clients', { params: { per_page: 1000 } }),
      $api('vehicles', { params: { per_page: 1000 } }),
      $api('products', { params: { per_page: 1000 } }),
      $api('accounts', { params: { per_page: 100 } }),
      $api('sales', { params: { per_page: 1000 } }), // Elevado a 1000 para evitar duplicados en la numeración correlativa
    ])

    const extractArray = (res, key) => {
      if (Array.isArray(res)) return res
      if (res?.[key] && Array.isArray(res[key])) return res[key]
      if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
      if (res?.data && Array.isArray(res.data)) return res.data
      if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data
      
      return []
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


    // Agregar campo de búsqueda combinado para productos
    products.value = rawProducts.map(p => ({
      ...p,
      searchText: `${p.sku || ''} ${p.code || ''} ${p.name || ''} ${p.description || ''}`.toLowerCase(),
      displayTitle: p.description || p.name || '',
    }))
    accounts.value = extractArray(accountsRes, 'accounts')

    // Obtener el último número de documento OT- y COT- (optimizado)
    const sales = extractArray(salesRes, 'data')
    let maxOt = 0
    let maxCot = 0
    if (sales && sales.length > 0) {
      for (const s of sales) {
        if (s.document_number?.toUpperCase().startsWith('OT-')) {
          const match = s.document_number.match(/OT-?(\d+)/i)
          if (match) {
            const num = parseInt(match[1])
            if (num > maxOt) maxOt = num
          }
        } else if (s.document_number?.toUpperCase().startsWith('COT-')) {
          const match = s.document_number.match(/COT-?(\d+)/i)
          if (match) {
            const num = parseInt(match[1])
            if (num > maxCot) maxCot = num
          }
        }
      }
    }
    lastOtNumber.value = maxOt
    lastCotNumber.value = maxCot

    sale.value.document_number = generateDocumentNumber(sale.value.document_type)

  } catch (error) {
    console.error('Error al cargar datos:', error)
    showNotification('Error al cargar datos iniciales', 'error')
  } finally {
    isLoading.value = false
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

  // Asignar cuenta automáticamente si es efectivo
  if (newPayment.payment_method === 'Efectivo') {
    // Siempre asignar account_id 1 (Caja Chica) para efectivo
    newPayment.account_id = 1
  }
}

const removePaymentDistribution = index => {
  // No permitir eliminar si es el último pago
  if (paymentDistributions.value.length > 1) {
    paymentDistributions.value.splice(index, 1)
  }
}

// Asignar cuenta automáticamente según método de pago
const onPaymentMethodChange = (dist, newMethod) => {
  if (newMethod === 'Efectivo') {
    // Caja Chica (account_id 1)
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))

    dist.account_id = cajaChica ? cajaChica.id : 1
  } else if (newMethod === 'Transferencia') {
    // No asignar automáticamente, dejar que el usuario elija
    dist.account_id = null
  }
}

// Watch para asignar cuenta automáticamente cuando se inicializa un pago
const initializePaymentAccount = dist => {
  if (dist.payment_method === 'Efectivo') {
    // Siempre asignar Caja Chica (account_id 1) para efectivo
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
  // Solo procesar si es un objeto (producto seleccionado)
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

    // Inicializar pago distribuido si es el primer item
    initializePaymentDistribution()

    // Limpiar campo de búsqueda
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
  const code = String(raw.code || '').toLowerCase()
  const name = String(raw.name || '').toLowerCase()
  const desc = String(raw.description || '').toLowerCase()

  return sku.includes(q) || code.includes(q) || name.includes(q) || desc.includes(q)
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
const TAX_RATE = 0.15 // 15% IVA

const grossSubtotal = computed(() => {
  return sale.value.items.reduce((sum, item) => {
    const price = item.price || item.unit_price || 0
    const quantity = item.quantity || 0
    
    return sum + (quantity * parseFloat(price))
  }, 0)
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
  
  return clients.value.find(c => c.id === sale.value.client_id)
})

// Computed para obtener el vehículo seleccionado
const selectedVehicle = computed(() => {
  if (!sale.value.vehicle_id) return null
  
  return vehicles.value.find(v => v.id === sale.value.vehicle_id)
})

// Envío del formulario
const submitForm = async () => {
  getUserId()
  sale.value.user_id = userId.value
  console.log(userId.value)

  //return
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

  // Validar que haya un cliente seleccionado
  if (!sale.value.client_id) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe seleccionar un cliente para continuar'
    
    return
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
        const itemDiscount = Number(item.discount) || 0
        if (itemDiscount > maxDiscountAmount) {
          showValidationError.value = true
          validationErrorMessage.value = `Descuento excede el máximo permitido para ${product.description}. Máximo: ${maxDiscountAmount.toFixed(2)}, Ingresado: ${itemDiscount.toFixed(2)}`
          
          return
        }
      }
    }
  }

  // Validar que haya al menos un método de pago solo si es venta (invoice o sale_note)
  if ((sale.value.document_type === 'invoice' || sale.value.document_type === 'sale_note') && paymentDistributions.value.length === 0) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe agregar al menos un método de pago para la venta'
    
    return
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

  loader.start()

  try {
    // Asegurarnos de que las cotizaciones siempre se guarden como pendientes
    if (sale.value.document_type === 'quote') {
      sale.value.payment_status = 'pending'
    }

    const payload = {
      ...sale.value,
      subtotal: subtotal.value,
      tax_amount: taxAmount.value,
      total: total.value,
    }

    // Enviar pagos distribuidos solo si no es cotización
    if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
      payload.payment_distributions = paymentDistributions.value
    }

    const response = await $api('sales', {
      method: 'POST',
      body: payload,
    })

    if (response.success || response.status === 201 || response.status === 200) {
      showNotification('Registro procesado exitosamente', 'success')
      router.push('/sales/list')
    } else {
      showNotification(response.message || 'Error al registrar', 'error')
    }
  } catch (error) {
    console.error('Error enviando formulario', error)

    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'

    showNotification(errMsg, 'error')
  } finally {
    loader.stop()
  }
}

// Despachar venta con pago pendiente
const dispatchSale = async () => {
  getUserId()
  sale.value.user_id = userId.value

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

  // Validar que haya un cliente seleccionado
  if (!sale.value.client_id) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe seleccionar un cliente para continuar'
    
    return
  }

  // Validar que haya al menos un producto/servicio
  if (sale.value.items.length === 0) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe agregar al menos un producto o servicio'
    
    return
  }

  // Validar stock
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

  loader.start()

  try {
    const payload = {
      document_number: sale.value.document_number,
      client_id: sale.value.client_id,
      vehicle_id: sale.value.vehicle_id,
      user_id: userId.value,
      mileage: sale.value.mileage,
      service_date: sale.value.service_date,
      subtotal: subtotal.value,
      tax_amount: taxAmount.value,
      total: total.value,
      observations: sale.value.observations,
      items: sale.value.items,
    }

    const response = await $api('sales/dispatch', {
      method: 'POST',
      body: payload,
    })

    if (response.success || response.status === 201 || response.status === 200) {
      showNotification('Venta despachada correctamente con pago pendiente', 'success')
      router.push('/sales/list')
    } else {
      showNotification(response.message || 'Error al despachar', 'error')
    }
  } catch (error) {
    console.error('Error al despachar venta', error)

    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'

    showNotification(errMsg, 'error')
  } finally {
    loader.stop()
  }
}

onMounted(async () => {
  await loadInitialData()
    
  // Verificar si hay un work_order_id en el query parameter
  const workOrderId = route.query.work_order_id
  if (workOrderId) {
    try {
      const workOrderRes = await $api(`work-orders/${workOrderId}`)
      const workOrder = workOrderRes.data || workOrderRes
            
      if (workOrder) {
        sale.value.work_order_id = workOrder.id
        sale.value.client_id = workOrder.client_id
        sale.value.vehicle_id = workOrder.vehicle_id
        sale.value.mileage = workOrder.mileage

        // Importar items de la orden de trabajo
        if (workOrder.items && workOrder.items.length > 0) {
          sale.value.items = workOrder.items.map(item => ({
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            price: item.unit_price || 0,
            discount: item.discount || 0,
            subtotal: item.subtotal,
          }))
        }
                
        showNotification('Orden de trabajo importada exitosamente', 'success')
      }
    } catch (error) {
      console.error('Error al importar orden de trabajo:', error)
      showNotification('Error al importar la orden de trabajo', 'error')
    }
  }
})
</script>

<template>
  <div class="pa-4 pa-sm-6">
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <div class="d-flex align-center">
          <VAvatar color="primary" variant="tonal" size="48" class="mr-3">
            <VIcon icon="ri-shopping-cart-2-line" size="28" />
          </VAvatar>
          <h1 class="text-h4 font-weight-bold mb-1">
            Nueva Venta
          </h1>
        </div>
        <p class="text-medium-emphasis mb-0">
          Crea una nueva cotización, nota de venta o factura
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
          <div class="mb-6">
            <h2 class="text-h6 font-weight-bold mb-3">Tipo de Documento</h2>
            <div class="d-flex gap-3 flex-wrap">
              <VCard :class="sale.document_type === 'quote' ? 'border-primary border-2 bg-primary-lighten-5' : 'border-opacity-25'" class="flex-1 cursor-pointer rounded-lg elevation-1 hover:elevation-3 transition-all" variant="outlined" @click="sale.document_type = 'quote'; onDocumentTypeChange()">
                <VCardText class="pa-4 text-center">
                  <VIcon icon="ri-file-text-line" size="28" :color="sale.document_type === 'quote' ? 'primary' : 'grey'" class="mb-2"/>
                  <div class="font-weight-bold" :class="sale.document_type === 'quote' ? 'text-primary' : 'text-grey'">Cotización</div>
                </VCardText>
              </VCard>

              <VCard :class="sale.document_type === 'sale_note' ? 'border-success border-2 bg-success-lighten-5' : 'border-opacity-25'" class="flex-1 cursor-pointer rounded-lg elevation-1 hover:elevation-3 transition-all" variant="outlined" @click="sale.document_type = 'sale_note'; onDocumentTypeChange()">
                <VCardText class="pa-4 text-center">
                  <VIcon icon="ri-file-list-3-line" size="28" :color="sale.document_type === 'sale_note' ? 'success' : 'grey'" class="mb-2"/>
                  <div class="font-weight-bold" :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey'">Nota de Venta</div>
                </VCardText>
              </VCard>

              <VCard :class="sale.document_type === 'invoice' ? 'border-purple border-2 bg-purple-lighten-5' : 'border-opacity-25'" class="flex-1 cursor-pointer rounded-lg elevation-1 hover:elevation-3 transition-all" variant="outlined" @click="sale.document_type = 'invoice'; onDocumentTypeChange()">
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
                  <VBtn color="info" variant="tonal" prepend-icon="ri-download-cloud-line" size="small" @click="openWorkOrderImportDialog">
                    Importar OT
                  </VBtn>
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
                  <VTextField v-model="sale.service_date" label="Fecha de Servicio *" type="date" :rules="[requiredRule]" variant="outlined" density="comfortable" prepend-inner-icon="ri-calendar-line" hide-details="auto" required />
                </VCol>
                <VCol cols="12">
                  <div class="d-flex gap-2 align-start">
                    <VAutocomplete v-model="sale.client_id" :items="clients" :item-title="getClientName" item-value="id" label="Cliente *" :rules="[requiredRule]" variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line" hide-details="auto" required placeholder="Buscar por nombre o documento" clearable :custom-filter="clientFilter" class="flex-grow-1">
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="getClientName(item.raw)" :subtitle="item.raw?.n_document" />
                      </template>
                    </VAutocomplete>
                    <VMenu>
                      <template #activator="{ props }">
                        <VBtn v-bind="props" color="primary" variant="tonal" icon="ri-user-add-line" class="mt-1" style="height: 48px;"/>
                      </template>
                      <VList>
                        <VListItem prepend-icon="ri-user-line" title="Consumidor Final" @click="isClientFinalAddDialogVisible = true" />
                        <VListItem prepend-icon="ri-building-line" title="Empresa" @click="isClientCompanyAddDialogVisible = true" />
                      </VList>
                    </VMenu>
                  </div>
                </VCol>
                <VCol cols="12" md="6">
                  <div class="d-flex gap-2 align-start">
                    <VAutocomplete v-model="sale.vehicle_id" :items="vehicles" item-title="license_plate" item-value="id" label="Vehículo (Opcional)" variant="outlined" density="comfortable" prepend-inner-icon="ri-car-line" hide-details="auto" placeholder="Buscar placa" clearable class="flex-grow-1">
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="item.raw.license_plate" :subtitle="`${item.raw.model || ''}`" />
                      </template>
                    </VAutocomplete>
                    <VBtn color="success" variant="tonal" icon="ri-add-line" class="mt-1" style="height: 48px;" @click="isVehicleAddDialogVisible = true"/>
                  </div>
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField v-model="sale.mileage" label="Kilometraje (Opcional)" type="number" variant="outlined" density="comfortable" prepend-inner-icon="ri-speed-up-line" hide-details="auto" />
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
              <VAutocomplete v-model="searchProduct" :items="products" item-title="displayTitle" return-object label="Buscar y agregar producto/servicio..." placeholder="Escribe para buscar por código, nombre o descripción..." prepend-inner-icon="ri-search-2-line" variant="outlined" density="comfortable" clearable :custom-filter="productFilter" @update:model-value="onProductSelected" class="mb-4" hide-details>
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
                        <VTextField v-model="item.description" placeholder="Descripción" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" bg-color="white"/>
                      </td>
                      <td class="pa-2">
                        <VTextField v-model.number="item.quantity" type="number" min="1" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" bg-color="white"/>
                      </td>
                      <td class="pa-2">
                        <VTextField v-model.number="item.price" type="number" min="0" step="0.01" variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" prefix="$" bg-color="white"/>
                      </td>
                      <td class="pa-2">
                        <VTextField v-model.number="item.discount" type="number" min="0" step="0.01" variant="outlined" density="compact" hide-details="auto" prefix="$" bg-color="white"/>
                      </td>
                      <td class="pa-2 text-right font-weight-bold">
                        ${{ ((item.quantity * item.price) - (item.discount || 0)).toFixed(2) }}
                      </td>
                      <td class="pa-2 text-center">
                        <VBtn icon="ri-delete-bin-line" variant="text" color="error" size="small" @click="removeItem(index)" />
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
              <VTextarea v-model="sale.observations" placeholder="Notas adicionales para el documento..." variant="solo" flat hide-details rows="2" class="rounded-0"/>
            </VCardText>
          </VCard>
          
          <VAlert v-if="showValidationError" color="error" variant="tonal" class="mb-4 d-md-none" border="start" closable @click:close="showValidationError = false">
            <div class="d-flex align-center">
              <VIcon icon="ri-error-warning-line" class="mr-2" size="20"/>
              <span class="text-body-2">{{ validationErrorMessage }}</span>
            </div>
          </VAlert>

        </VCol>

        <!-- COLUMNA DERECHA (STICKY) -->
        <VCol cols="12" md="4">
          <div style="position: sticky; top: 20px;">
            <!-- RESUMEN FINANCIERO -->
            <VCard class="elevation-3 rounded-lg border-primary border-opacity-50 mb-4 overflow-hidden">
              <div class="bg-primary pa-4 text-center">
                <div class="text-caption text-white opacity-70 text-uppercase letter-spacing-1 mb-1">Total a Pagar</div>
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

            <!-- PAGOS Y CREDITO -->
            <VCard v-if="sale.document_type !== 'quote'" class="elevation-2 rounded-lg border mb-4">
              <VCardItem class="bg-grey-lighten-4 py-3">
                <span class="text-subtitle-1 font-weight-bold d-flex align-center">
                  <VIcon icon="ri-secure-payment-line" class="mr-2" size="20"/> Configuración de Pago
                </span>
              </VCardItem>
              <VDivider />
              <VCardText class="pa-4">
                <div class="d-flex align-center justify-space-between mb-4 px-3 py-2 bg-blue-grey-lighten-5 rounded border">
                  <span class="font-weight-medium d-flex align-center">
                     <VIcon icon="ri-hand-coin-line" class="mr-2" size="18"/> ¿Venta a Crédito?
                  </span>
                  <VSwitch v-model="sale.is_credited" color="primary" density="compact" hide-details @change="onCreditChange" />
                </div>

                <div v-if="!sale.is_credited">
                  <div class="d-flex justify-space-between align-center mb-3">
                    <span class="text-subtitle-2 text-medium-emphasis">Distribución de Pagos</span>
                    <VBtn color="primary" variant="tonal" size="x-small" prepend-icon="ri-add-line" @click="addPaymentDistribution">Agregar</VBtn>
                  </div>
                  
                  <div class="d-flex flex-column gap-3">
                    <VCard v-for="(dist, index) in paymentDistributions" :key="dist.id || index" variant="outlined" class="border-opacity-50">
                      <div class="pa-3 position-relative">
                        <VBtn v-if="paymentDistributions.length > 1" icon="ri-close-line" size="x-small" variant="text" color="grey" class="position-absolute" style="top: 4px; right: 4px; z-index: 2;" @click="removePaymentDistribution(index)"/>
                        
                        <div class="text-caption font-weight-bold mb-2">Pago {{ index + 1 }}</div>
                        <VRow dense>
                          <VCol cols="12">
                            <VSelect v-model="dist.payment_method" :items="paymentMethods" item-title="title" item-value="value" label="Método" variant="outlined" density="compact" hide-details :rules="[requiredRule]" @update:model-value="(val) => onPaymentMethodChange(dist, val)"/>
                          </VCol>
                          <VCol cols="12">
                            <VSelect v-if="dist.payment_method === 'Transferencia'" v-model="dist.account_id" :items="accounts" item-title="name" item-value="id" label="Cuenta bancaria" variant="outlined" density="compact" hide-details :rules="[requiredRule]"/>
                            <VTextField v-else :value="dist.payment_method === 'Efectivo' ? 'Caja Chica' : ''" label="Cuenta" variant="outlined" density="compact" hide-details bg-color="grey-lighten-4" readonly/>
                            <input v-if="dist.payment_method === 'Efectivo'" v-model="dist.account_id" type="hidden">
                          </VCol>
                          <VCol cols="12">
                            <VTextField v-model.number="dist.amount" type="number" min="0" step="0.01" label="Monto" variant="outlined" density="compact" hide-details :rules="[requiredRule]" prefix="$"/>
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

            <VBtn type="submit" color="primary" size="x-large" block class="elevation-3 font-weight-bold text-subtitle-1 rounded-lg" :loading="loader.loading">
              <VIcon icon="ri-save-3-line" class="mr-2"/>
              {{ sale.document_type === 'quote' ? 'Generar Cotización' : (sale.is_credited ? 'Registrar Venta a Crédito' : 'Cobrar y Registrar') }}
            </VBtn>
            
            <VBtn v-if="sale.document_type !== 'quote'" color="warning" variant="tonal" size="large" block class="mt-3 rounded-lg" :loading="loader.loading" @click.prevent="dispatchSale">
              <VIcon icon="ri-truck-line" class="mr-2"/>
              Despachar (Pago Pendiente)
            </VBtn>
          </div>
        </VCol>
      </VRow>
    </VForm>

    <!-- Diálogos ocultos -->
    <ClientFinalAddDialog v-if="isClientFinalAddDialogVisible" v-model:isDialogVisible="isClientFinalAddDialogVisible" @add-client-final="handleClientAdded" />
    <ClientCompanyAddDialog v-if="isClientCompanyAddDialogVisible" v-model:isDialogVisible="isClientCompanyAddDialogVisible" @add-client-company="handleClientAdded" />
    <VehicleAddDialog v-if="isVehicleAddDialogVisible" v-model:isDialogVisible="isVehicleAddDialogVisible" @add-vehicle="handleVehicleAdded" />

    <!-- Diálogo OT -->
    <VDialog v-model="isWorkOrderImportDialogVisible" max-width="800px">
      <VCard class="rounded-lg">
        <VCardTitle class="bg-grey-lighten-4 pa-4 border-b">
          <div class="d-flex align-center justify-space-between">
            <span class="text-h6 font-weight-bold">Importar Orden de Trabajo</span>
            <VBtn icon="ri-close-line" variant="text" size="small" @click="isWorkOrderImportDialogVisible = false" />
          </div>
        </VCardTitle>
        <VCardText class="pa-0">
          <div v-if="isLoadingWorkOrders" class="text-center pa-8">
            <VProgressCircular indeterminate color="primary" size="48" />
            <p class="mt-4 text-body-2">Buscando órdenes listas...</p>
          </div>
          <div v-else-if="readyWorkOrders.length === 0" class="text-center pa-8">
            <VIcon icon="ri-inbox-line" size="64" color="grey-lighten-1" />
            <p class="mt-4 text-body-1 text-medium-emphasis">No hay órdenes listas para facturar</p>
          </div>
          <VTable v-else hover>
            <thead class="bg-grey-lighten-4">
              <tr>
                <th class="font-weight-bold">OT</th>
                <th class="font-weight-bold">Cliente</th>
                <th class="font-weight-bold">Vehículo</th>
                <th class="font-weight-bold text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="wo in readyWorkOrders" :key="wo.id">
                <td class="font-weight-medium">{{ wo.number }}</td>
                <td>{{ getClientName(wo.client) }}</td>
                <td>{{ wo.vehicle ? `${wo.vehicle.license_plate}` : 'N/A' }}</td>
                <td class="text-center">
                  <VBtn color="primary" variant="tonal" size="small" @click="selectWorkOrder(wo)">Importar</VBtn>
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>
    </VDialog>
  </div>
</template>