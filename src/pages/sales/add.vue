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
const isDispatching = ref(false)
const isSubmitting = ref(false)
const isProcessing = computed(() => isSubmitting.value || isSavingDraft.value || isDispatching.value || loader.loading)
const showValidationError = ref(false)
const validationErrorMessage = ref('')
const isConfirmInvoiceDialogVisible = ref(false)
const sriAmbiente = ref('1')

const sriEnvironmentInfo = computed(() => {
  const isProd = String(sriAmbiente.value) === '2'
  return {
    isProd,
    type: isProd ? '2' : '1',
    text: isProd ? 'PRODUCCIÓN' : 'PRUEBAS',
    color: isProd ? 'success' : 'warning',
    icon: isProd ? 'ri-shield-check-line' : 'ri-test-tube-line',
    desc: isProd 
      ? 'Ambiente Oficial de Producción del SRI (con validez tributaria real).' 
      : 'Ambiente de Pruebas y Certificación del SRI (sin validez tributaria).',
  }
})

const computedPaymentMethodSummary = computed(() => {
  if (sale.value.payment_status === 'pending' || sale.value.is_credited) {
    return 'Crédito / Pendiente'
  }
  if (paymentDistributions.value && paymentDistributions.value.length > 0) {
    const methods = [...new Set(paymentDistributions.value.map(d => d.payment_method).filter(Boolean))]
    if (methods.length > 0) {
      return methods.join(', ')
    }
  }
  return sale.value.payment_method || 'Contado'
})

// Opciones
const documentTypes = [
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
const employees = ref([])

// Estado del formulario
const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000
  
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0]
}

const sale = ref({
  document_type: 'invoice',
  document_number: '',
  client_id: null,
  vehicle_id: null,
  quote_id: null,
  quote_number: null,
  work_order_id: null,
  work_order_number: null,
  mileage: null,
  service_date: getLocalDateString(),
  payment_status: 'paid',
  is_credited: false,
  payment_method: 'Efectivo',
  observations: '',
  technicians: [],
  items: [],
  user_id: userId.value,
})

// Regla de campo obligatorio que acepta 0 como valor válido
const positiveNumberRule = v => v >= 0 || 'El valor no puede ser negativo'

const requiredRule = v => (
  v !== null &&
  v !== undefined &&
  v !== '' &&
  !(typeof v === 'number' && Number.isNaN(v))
) || 'Campo obligatorio'

// Watch para cambiar estado de pago cuando es crédito
const onCreditChange = () => {
  sale.value.is_credited = !sale.value.is_credited
  if (sale.value.is_credited) {
    sale.value.payment_status = 'pending'
    paymentDistributions.value = []
    sale.value.payment_method = ''
  } else {
    sale.value.payment_status = 'paid'
    if (paymentDistributions.value.length === 0 && total.value > 0) {
      initializePaymentDistribution()
    }
  }
}

// Watch para cuando cambia el estado de pago directamente en el selector
watch(() => sale.value.payment_status, newStatus => {
  if (newStatus === 'pending') {
    sale.value.is_credited = true
    paymentDistributions.value = []
    sale.value.payment_method = ''
  } else {
    if (newStatus === 'paid') {
      sale.value.is_credited = false
    }
    if (paymentDistributions.value.length === 0 && total.value > 0) {
      initializePaymentDistribution()
    }
  }
})

// Variable reactiva para almacenar el número real desde el backend
const nextGlobalNumber = ref('')

// Generar número de documento
const generateDocumentNumber = type => {
  return nextGlobalNumber.value || '000000000'
}

const isLinkedToWorkOrder = computed(() => !!sale.value.work_order_id)

// Watch para regenerar número cuando cambia el tipo de documento
const onDocumentTypeChange = async () => {
  // Obtener el secuencial correcto según el tipo de documento
  try {
    const docType = sale.value.document_type
    const nextNumberRes = await $api(`sales/next-number?document_type=${docType}`)

    nextGlobalNumber.value = nextNumberRes?.data || '000000000'
    sale.value.document_number = generateDocumentNumber(sale.value.document_type)
  } catch (error) {
    console.error('Error al obtener secuencial:', error)
  }
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
  if (paymentDistributions.value.length === 0) {
    const defaultAcc = accounts.value.find(acc => acc.type === 'cash' || acc.name?.toLowerCase().includes('caja')) || accounts.value[0]

    paymentDistributions.value.push({
      account_id: defaultAcc ? defaultAcc.id : null,
      amount: total.value,
      payment_method: 'Efectivo',
    })
  }
}

// Estado de diálogos y manejadores
const isClientFinalAddDialogVisible = ref(false)
const isClientCompanyAddDialogVisible = ref(false)
const isVehicleAddDialogVisible = ref(false)
const isWorkOrderImportDialogVisible = ref(false)
const isAddServiceDialogVisible = ref(false)
const readyWorkOrders = ref([])
const isLoadingWorkOrders = ref(false)
const workOrderSearchQuery = ref('')

const filteredWorkOrders = computed(() => {
  if (!workOrderSearchQuery.value) return readyWorkOrders.value

  const query = workOrderSearchQuery.value.toLowerCase().trim()
  
  return readyWorkOrders.value.filter(order => {
    const idMatch = String(order.id).includes(query)
    const clientName = `${order.client?.name || ''} ${order.client?.surname || ''}`.toLowerCase()
    const clientDoc = String(order.client?.n_document || '').toLowerCase()
    const licensePlate = String(order.vehicle?.license_plate || '').toLowerCase()
    const brand = String(order.vehicle?.brand || '').toLowerCase()
    const model = String(order.vehicle?.model || '').toLowerCase()

    return idMatch ||
      clientName.includes(query) ||
      clientDoc.includes(query) ||
      licensePlate.includes(query) ||
      brand.includes(query) ||
      model.includes(query)
  })
})

const loadClients = async () => {
  try {
    const clientsRes = await $api('clients', { params: { per_page: 1000 } })
    if (Array.isArray(clientsRes)) clients.value = clientsRes
    else if (clientsRes?.clients && Array.isArray(clientsRes.clients)) clients.value = clientsRes.clients
    else if (clientsRes?.data && Array.isArray(clientsRes.data)) clients.value = clientsRes.data
  } catch (error) {
    console.error('Error al recargar clientes:', error)
  }
}

const loadVehicles = async () => {
  try {
    const vehiclesRes = await $api('vehicles', { params: { per_page: 1000 } })
    let rawVehicles = []
    if (Array.isArray(vehiclesRes)) rawVehicles = vehiclesRes
    else if (vehiclesRes?.vehicles && Array.isArray(vehiclesRes.vehicles)) rawVehicles = vehiclesRes.vehicles
    else if (vehiclesRes?.data && Array.isArray(vehiclesRes.data)) rawVehicles = vehiclesRes.data

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
  } catch (error) {
    console.error('Error al recargar vehículos:', error)
  }
}

const handleClientAdded = async clientData => {
  if (clientData) {
    const clientObj = clientData.client || clientData.data || clientData

    await loadClients()

    const newId = clientObj.id

    await nextTick()
    sale.value.client_id = newId
  }
}

const handleVehicleAdded = async vehicleData => {
  if (vehicleData) {
    const vehicle = vehicleData.vehicle || vehicleData

    await loadClients()
    await loadVehicles()

    const newId = vehicle.id

    await nextTick()
    sale.value.vehicle_id = newId
    if (vehicle.client_id && !sale.value.client_id) {
      sale.value.client_id = vehicle.client_id
    }
  }
}

const handleServiceAdded = async newService => {
  if (newService) {
    const mappedService = {
      ...newService,
      searchText: `${newService.sku || ''} ${newService.code || ''} ${newService.name || ''} ${newService.description || ''}`.toLowerCase(),
      displayTitle: newService.description || newService.name || '',
    }


    // Inyectar en el listado de productos de búsqueda
    products.value = [mappedService, ...products.value]

    // Agregar directamente al carrito
    onProductSelected(mappedService)
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
const applyWorkOrderTechnicians = workOrder => {
  sale.value.technicians = (workOrder.technicians || []).map(t => t.id)
}

const selectWorkOrder = async workOrder => {
  sale.value.work_order_id = workOrder.id
  sale.value.work_order_number = workOrder.number
  sale.value.client_id = workOrder.client_id
  sale.value.vehicle_id = workOrder.vehicle_id
  sale.value.mileage = workOrder.mileage
  applyWorkOrderTechnicians(workOrder)

  if (workOrder.client) {
    selectedClient.value = workOrder.client
  } else if (workOrder.client_id) {
    try {
      const clientRes = await $api(`clients/${workOrder.client_id}`)

      selectedClient.value = clientRes.client || clientRes.data || clientRes
    } catch (e) {
      console.error('Error al cargar cliente de la OT:', e)
    }
  }

  if (workOrder.vehicle) {
    selectedVehicle.value = workOrder.vehicle
  } else if (workOrder.vehicle_id) {
    try {
      const vehicleRes = await $api(`vehicles/${workOrder.vehicle_id}`)

      selectedVehicle.value = vehicleRes.vehicle || vehicleRes.data || vehicleRes
    } catch (e) {
      console.error('Error al cargar vehículo de la OT:', e)
    }
  }

  // Importar items de la orden de trabajo
  if (workOrder.items && workOrder.items.length > 0) {
    sale.value.items = workOrder.items.map(item => {
      if (item.product && !products.value.find(p => p.id === item.product.id)) {
        products.value.push(item.product)
      }
      
      return {
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        price: item.unit_price || item.price || 0,
        discount: item.discount || 0,
        subtotal: item.subtotal,
        type: item.type || (item.product_id ? 'product' : 'service'),
        sku: item.product?.sku || item.product?.code || item.sku || '',
      }
    })
    initializePaymentDistribution()
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

// Helpers
const getClientName = c => {
  if (!c) return 'Cliente'

  return c.full_name || c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente'
}

// Carga inicial
const loadInitialData = async () => {
  isLoading.value = true
  try {
    // Cargar datos en paralelo optimizado
    const [clientsRes, vehiclesRes, productsRes, accountsRes, salesRes, workOrdersRes, employeesRes, nextNumberRes, sucursalRes] = await Promise.all([
      Promise.resolve([]),
      Promise.resolve([]),
      $api('products', { params: { per_page: 1000 } }),
      $api('accounts', { params: { per_page: 100 } }),
      Promise.resolve([]),
      Promise.resolve([]),
      $api('employees', { params: { per_page: 1000 } }),
      $api('sales/next-number?document_type=' + (route.query.type || 'sale_note')),
      $api('sucursales/1').catch(() => null),
    ])

    if (sucursalRes?.sucursal?.ambiente) {
      sriAmbiente.value = String(sucursalRes.sucursal.ambiente)
    }

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
    accounts.value = extractArray(accountsRes, 'accounts').map(acc => {
      const cleaned = (acc.name || '')
        .replace(/\(EFECTIVO\)/gi, '')
        .replace(/\(TRANSFERENCIA\)/gi, '')
        .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
        .trim()

      
      return {
        ...acc,
        name: acc.bank_name ? `${acc.bank_name} (${cleaned})` : cleaned,
      }
    })
    employees.value = extractArray(employeesRes, 'employees')

    // Asignar el correlativo global desde el backend
    nextGlobalNumber.value = nextNumberRes?.data || '000000000'

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

const addTemporaryProduct = () => {
  sale.value.items.push({
    product_id: null,
    description: 'Producto Temporal',
    quantity: 1,
    price: 0,
    discount: 0,
    type: 'product',
    sku: '',
  })
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

// Gestión de pagos distribuidos
const addPaymentDistribution = () => {
  const newPayment = {
    account_id: null,
    amount: 0,
    payment_method: 'Efectivo',
  }

  paymentDistributions.value.push(newPayment)

  if (newPayment.payment_method === 'Efectivo') {
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))

    newPayment.account_id = cajaChica ? cajaChica.id : null
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

    dist.account_id = cajaChica ? cajaChica.id : null
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

    dist.account_id = cajaChica ? cajaChica.id : null
  }
}

const totalDistributed = computed(() => {
  return paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0)
})



const remainingAmount = computed(() => {
  return total.value - totalDistributed.value
})

const handlePaymentAmountChange = (dist, index) => {
  const otherPaymentsTotal = paymentDistributions.value.reduce((sum, d, i) => {
    return i !== index ? sum + (Number(d.amount) || 0) : sum
  }, 0)

  const maxAllowed = Number((total.value - otherPaymentsTotal).toFixed(2))

  if (Number(dist.amount) > maxAllowed) {
    dist.amount = maxAllowed > 0 ? maxAllowed : 0
    showNotification(`El pago no puede exceder el saldo restante ($${maxAllowed.toFixed(2)})`, 'warning')
  }
}

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
    // Caché local para validaciones posteriores (stock, margen, etc)
    if (!products.value.find(p => p.id === product.id)) {
      products.value.push(product)
    }

    const isService = product.item_type === 2 ||
      (product.categorie && product.categorie.title && product.categorie.title.includes('SERVICIO'))

    // Calcular precio dinámico basado en el factor de la unidad
    let calculatedPrice = product.price_sale || product.price || 0

    // Si el producto tiene unidad y factor, calcular el precio dinámico
    if (product.unit && product.unit.factor && !product.unit.is_base) {
      calculatedPrice = (product.price_sale || product.price || 0) * product.unit.factor
    }

    const existingItem = sale.value.items.find(i => i.product_id === product.id)
    if (existingItem) {
      existingItem.quantity++
    } else {
      sale.value.items.push({
        product_id: product.id,
        description: product.description || product.name || '',
        quantity: 1,
        price: calculatedPrice,
        discount: 0,
        type: isService ? 'service' : 'product',
        sku: product.sku || product.code || '',
        unit_id: product.unit_id || null,
        unit: product.unit || null,
      })
    }

    // Inicializar pago distribuido si es el primer item
    initializePaymentDistribution()

    // Limpiar campo de búsqueda
    searchProduct.value = null
  }
}



// Cálculos (Los precios de productos y servicios ya incluyen IVA)
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

const netItemsTotal = computed(() => {
  return Math.max(0, grossSubtotal.value - totalDiscount.value)
})

const subtotal = computed(() => {
  if (sale.value.document_type === 'invoice') {
    return Number((netItemsTotal.value / (1 + TAX_RATE)).toFixed(2))
  }

  return Number(netItemsTotal.value.toFixed(2))
})

const taxAmount = computed(() => {
  if (sale.value.document_type === 'invoice') {
    return Number((netItemsTotal.value - subtotal.value).toFixed(2))
  }

  return 0
})

const total = computed(() => {
  return Number(netItemsTotal.value.toFixed(2))
})

watch(total, newTotal => {
  // Solo actualizar automáticamente si hay un único método de pago
  if (paymentDistributions.value.length === 1) {
    paymentDistributions.value[0].amount = newTotal
  }
})

// Computed para verificar si es cotización
const isQuote = computed(() => {
  return sale.value.document_type === 'quote'
})

// Computed para verificar si se puede convertir a venta
const canConvertToSale = computed(() => {
  return isQuote.value && sale.value.status !== 'canceled' && sale.value.items.length > 0
})

// Refs para almacenar el objeto completo seleccionado
const selectedClient = ref(null)
const selectedVehicle = ref(null)

watch(() => selectedClient.value, newVal => {
  if (newVal && newVal.id) {
    sale.value.client_id = newVal.id
  } else {
    sale.value.client_id = null
  }
})

watch(() => selectedVehicle.value, newVal => {
  if (newVal && newVal.id) {
    sale.value.vehicle_id = newVal.id
    if (newVal.client_id && !sale.value.client_id) {
      sale.value.client_id = newVal.client_id
      selectedClient.value = newVal.client
    }
  } else {
    sale.value.vehicle_id = null
  }
})

// Envío del formulario
const submitForm = async () => {
  if (isSubmitting.value) return

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

  // Validar stock solo si no es cotización
  // Validar stock solo si no es cotización y es producto físico (item_type == 1)
  if (sale.value.document_type !== 'quote') {
    for (const item of sale.value.items) {
      if (item.product_id) {
        const product = products.value.find(p => p.id === item.product_id)
        if (product && product.item_type === 1 && product.stock < item.quantity) {
          showValidationError.value = true
          validationErrorMessage.value = `Stock insuficiente para ${product.description}. Stock disponible: ${product.stock}, Solicitado: ${item.quantity}`

          return
        }
      }
    }
  }

  // Validar descuentos y margen (sólo aplica para item_type == 1 / Productos Físicos)
  for (const item of sale.value.items) {
    if (item.product_id) {
      const product = products.value.find(p => p.id === item.product_id)
      if (product && product.item_type === 1) {
        const itemDiscount = Number(item.discount) || 0
        const finalPrice = (item.quantity * item.price) - itemDiscount
        const minFinalPrice = item.quantity * (parseFloat(product.purchase_price) || 0)

        // A. Validar margen
        if (finalPrice < minFinalPrice) {
          showValidationError.value = true
          validationErrorMessage.value = `El descuento excede el margen permitido para ${product.description}. El precio final no puede ser menor al costo de compra ($${product.purchase_price} c/u).`

          return
        }

        // B. Validar porcentaje de descuento máximo
        if (product.discount_percentage > 0) {
          const maxDiscountAmountByPct = (item.quantity * item.price) * (parseFloat(product.discount_percentage) / 100)
          if (itemDiscount > maxDiscountAmountByPct) {
            showValidationError.value = true
            validationErrorMessage.value = `El descuento total excede el porcentaje máximo permitido (${product.discount_percentage}%) para ${product.description}. Máximo permitido: $${maxDiscountAmountByPct.toFixed(2)}`

            return
          }
        }

        // C. Validar max_discount (monto absoluto o porcentaje según lógica del sistema)
        if (product.max_discount > 0) {
          const maxDiscountAmountByVal = item.quantity * parseFloat(product.max_discount)
          if (itemDiscount > maxDiscountAmountByVal) {
            showValidationError.value = true
            validationErrorMessage.value = `El descuento total excede el máximo permitido para ${product.description}. Máximo permitido: $${maxDiscountAmountByVal.toFixed(2)}`

            return
          }
        }
      }
    }
  }

  // Validar pagos distribuidos solo si no es cotización
  if (sale.value.document_type !== 'quote') {
    if (sale.value.payment_status === 'pending') {
      sale.value.is_credited = true
      paymentDistributions.value = []
      sale.value.payment_method = ''
    } else {
      const totalDist = paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0)

      if (paymentDistributions.value.length === 0 || totalDist <= 0) {
        showValidationError.value = true
        validationErrorMessage.value = 'Debe agregar al menos un pago para la venta'

        return
      }

      if (totalDist > total.value + 0.01) {
        showValidationError.value = true
        validationErrorMessage.value = 'La suma de los pagos no puede ser mayor al total'

        return
      }

      // Si el pago no está completado, el estado debe quedar en pendiente o partial.
      if (Math.abs(totalDist - total.value) <= 0.01) {
        sale.value.payment_status = 'paid'
      } else if (totalDist > 0) {
        sale.value.payment_status = 'partial'
      }
    }
  }

  // Sincronizar método de pago de cabecera con los pagos distribuidos antes de confirmar
  if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
    const methods = [...new Set(paymentDistributions.value.map(d => d.payment_method).filter(Boolean))]
    if (methods.length === 1) {
      sale.value.payment_method = methods[0]
    } else if (methods.length > 1) {
      sale.value.payment_method = methods.join(', ')
    }
  }

  // Si es Factura, abrimos el VDialog de confirmación
  if (sale.value.document_type === 'invoice') {
    isConfirmInvoiceDialogVisible.value = true
  } else {
    await executeSaleSubmission()
  }
}

// Ejecución real del registro de la venta o factura
const executeSaleSubmission = async () => {
  if (isSubmitting.value) return
  isSubmitting.value = true

  try {
    // Asegurarnos de que las cotizaciones siempre se guarden como pendientes
    if (sale.value.document_type === 'quote') {
      sale.value.payment_status = 'pending'
    }

    // Sincronizar método de pago de cabecera con los pagos distribuidos reales
    if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
      const methods = [...new Set(paymentDistributions.value.map(d => d.payment_method).filter(Boolean))]
      if (methods.length === 1) {
        sale.value.payment_method = methods[0]
      } else if (methods.length > 1) {
        sale.value.payment_method = methods.join(', ')
      }
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
      isConfirmInvoiceDialogVisible.value = false
      showNotification(
        sale.value.document_type === 'invoice'
          ? 'Factura generada y encolada para autorización SRI'
          : 'Registro procesado exitosamente',
        'success'
      )
      if (sale.value.document_type === 'quote') {
        router.push('/quotes/list')
      } else {
        router.push('/sales/list')
      }
    } else {
      showNotification(response.message || 'Error al registrar', 'error')
    }
  } catch (error) {
    console.error('Error enviando formulario', error)

    const errMsg = error.data?.error || error.data?.message || error.response?._data?.error || error.response?._data?.message || error.message || 'Error al procesar la solicitud'

    showNotification(errMsg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

// Guardar como Borrador
const saveDraft = async () => {
  getUserId()
  sale.value.user_id = userId.value

  showValidationError.value = false
  validationErrorMessage.value = ''

  if (!sale.value.client_id) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe seleccionar un cliente para guardar el borrador'
    
    return
  }

  if (sale.value.items.length === 0) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe agregar al menos un producto o servicio para guardar el borrador'
    
    return
  }

  isSavingDraft.value = true

  try {
    const payload = {
      ...sale.value,
      subtotal: subtotal.value,
      tax_amount: taxAmount.value,
      total: total.value,
      is_draft: true,
    }

    if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
      payload.payment_distributions = paymentDistributions.value
    }

    const response = await $api('sales', {
      method: 'POST',
      body: payload,
    })

    if (response.success || response.status === 201 || response.status === 200) {
      showNotification('Borrador guardado exitosamente', 'success')
      if (sale.value.document_type === 'quote') {
        router.push('/quotes/list')
      } else {
        router.push('/sales/list')
      }
    } else {
      showNotification(response.message || 'Error al guardar borrador', 'error')
    }
  } catch (error) {
    console.error('Error guardando borrador', error)

    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'

    showNotification(errMsg, 'error')
  } finally {
    isSavingDraft.value = false
  }
}

// Despachar venta con pago pendiente
const dispatchSale = async () => {
  if (isDispatching.value) return

  getUserId()
  sale.value.user_id = userId.value

  showValidationError.value = false
  validationErrorMessage.value = ''

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

  // Validar stock solo si es producto físico (item_type == 1)
  for (const item of sale.value.items) {
    if (item.product_id) {
      const product = products.value.find(p => p.id === item.product_id)
      if (product && product.item_type === 1 && product.stock < item.quantity) {
        showValidationError.value = true
        validationErrorMessage.value = `Stock insuficiente para ${product.description}. Stock disponible: ${product.stock}, Solicitado: ${item.quantity}`

        return
      }
    }
  }

  // Validar descuentos y margen (sólo aplica para item_type == 1 / Productos Físicos)
  for (const item of sale.value.items) {
    if (item.product_id) {
      const product = products.value.find(p => p.id === item.product_id)
      if (product && product.item_type === 1) {
        const itemDiscount = Number(item.discount) || 0
        const finalPrice = (item.quantity * item.price) - itemDiscount
        const minFinalPrice = item.quantity * (parseFloat(product.purchase_price) || 0)

        // A. Validar margen
        if (finalPrice < minFinalPrice) {
          showValidationError.value = true
          validationErrorMessage.value = `El descuento excede el margen permitido para ${product.description}. El precio final no puede ser menor al costo de compra ($${product.purchase_price} c/u).`

          return
        }

        // B. Validar porcentaje de descuento máximo
        if (product.discount_percentage > 0) {
          const maxDiscountAmountByPct = (item.quantity * item.price) * (parseFloat(product.discount_percentage) / 100)
          if (itemDiscount > maxDiscountAmountByPct) {
            showValidationError.value = true
            validationErrorMessage.value = `El descuento excede el porcentaje máximo permitido (${product.discount_percentage}%) para ${product.description}. Máximo permitido: $${maxDiscountAmountByPct.toFixed(2)}`

            return
          }
        }

        // C. Validar max_discount (monto absoluto o porcentaje según lógica del sistema)
        if (product.max_discount > 0) {
          const maxDiscountAmountByVal = (item.quantity * item.price) * (parseFloat(product.max_discount) / 100)
          if (itemDiscount > maxDiscountAmountByVal) {
            showValidationError.value = true
            validationErrorMessage.value = `El descuento excede el máximo permitido para ${product.description}. Máximo permitido: $${maxDiscountAmountByVal.toFixed(2)}`

            return
          }
        }
      }
    }
  }

  isDispatching.value = true

  try {
    const payload = {
      document_number: sale.value.document_number,
      client_id: sale.value.client_id,
      vehicle_id: sale.value.vehicle_id,
      work_order_id: sale.value.work_order_id,
      user_id: userId.value,
      mileage: sale.value.mileage,
      service_date: sale.value.service_date,
      subtotal: subtotal.value,
      tax_amount: taxAmount.value,
      total: total.value,
      observations: sale.value.observations,
      technicians: sale.value.technicians,
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

    const errMsg = error.data?.error || error.data?.message || error.response?._data?.error || error.response?._data?.message || error.message || 'Error al procesar la solicitud'

    showNotification(errMsg, 'error')
  } finally {
    isDispatching.value = false
  }
}

onMounted(async () => {
  await loadInitialData()
  initializePaymentDistribution()

  // Verificar si hay un work_order_id en el query parameter
  const workOrderId = route.query.work_order_id
  if (workOrderId) {
    try {
      const workOrderRes = await $api(`work-orders/${workOrderId}`)
      const workOrder = workOrderRes.data || workOrderRes

      if (workOrder) {
        sale.value.work_order_id = workOrder.id
        sale.value.work_order_number = workOrder.number
        sale.value.client_id = workOrder.client_id
        sale.value.vehicle_id = workOrder.vehicle_id
        sale.value.mileage = workOrder.mileage
        sale.value.service_date = workOrder.date ? workOrder.date.split(' ')[0] : sale.value.service_date
        sale.value.observations = workOrder.observations || ''
        applyWorkOrderTechnicians(workOrder)

        if (workOrder.client) {
          selectedClient.value = workOrder.client
        } else if (workOrder.client_id) {
          try {
            const clientRes = await $api(`clients/${workOrder.client_id}`)

            selectedClient.value = clientRes.client || clientRes.data || clientRes
          } catch (e) {
            console.error('Error al cargar cliente de la OT:', e)
          }
        }

        if (workOrder.vehicle) {
          selectedVehicle.value = workOrder.vehicle
        } else if (workOrder.vehicle_id) {
          try {
            const vehicleRes = await $api(`vehicles/${workOrder.vehicle_id}`)

            selectedVehicle.value = vehicleRes.vehicle || vehicleRes.data || vehicleRes
          } catch (e) {
            console.error('Error al cargar vehículo de la OT:', e)
          }
        }

        // Importar items de la orden de trabajo
        if (workOrder.items && workOrder.items.length > 0) {
          sale.value.items = workOrder.items.map(item => {
            if (item.product && !products.value.find(p => p.id === item.product.id)) {
              products.value.push(item.product)
            }
            
            return {
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              price: item.unit_price || item.price || 0,
              discount: item.discount || 0,
              subtotal: item.subtotal,
              type: item.type || (item.product_id ? 'product' : 'service'),
              sku: item.product?.sku || item.product?.code || item.sku || '',
            }
          })
          initializePaymentDistribution()
        }

        showNotification('Orden de trabajo importada exitosamente', 'success')
      }
    } catch (error) {
      console.error('Error al importar orden de trabajo:', error)
      showNotification('Error al importar la orden de trabajo', 'error')
    }
  }

  // Verificar si hay un quote_id en el query parameter
  const quoteId = route.query.quote_id
  if (quoteId && !workOrderId) {
    try {
      const quoteRes = await $api(`quotes/${quoteId}`)
      const quote = quoteRes.data || quoteRes

      if (quote) {
        sale.value.quote_id = quote.id
        sale.value.quote_number = quote.document_number
        sale.value.client_id = quote.client_id
        sale.value.vehicle_id = quote.vehicle_id
        sale.value.mileage = quote.mileage
        sale.value.service_date = quote.date ? quote.date.split(' ')[0] : sale.value.service_date
        sale.value.observations = quote.observations || ''

        if (route.query.doc_type) {
          sale.value.document_type = route.query.doc_type
          await onDocumentTypeChange()
        }

        if (quote.technicians && Array.isArray(quote.technicians)) {
          sale.value.technicians = quote.technicians.map(t => typeof t === 'object' ? t.id : t)
        }

        if (quote.client) {
          selectedClient.value = quote.client
        } else if (quote.client_id) {
          try {
            const clientRes = await $api(`clients/${quote.client_id}`)
            selectedClient.value = clientRes.client || clientRes.data || clientRes
          } catch (e) {
            console.error('Error al cargar cliente de la cotización:', e)
          }
        }

        if (quote.vehicle) {
          selectedVehicle.value = quote.vehicle
        } else if (quote.vehicle_id) {
          try {
            const vehicleRes = await $api(`vehicles/${quote.vehicle_id}`)
            selectedVehicle.value = vehicleRes.vehicle || vehicleRes.data || vehicleRes
          } catch (e) {
            console.error('Error al cargar vehículo de la cotización:', e)
          }
        }

        // Importar items de la cotización
        if (quote.details && quote.details.length > 0) {
          sale.value.items = quote.details.map(item => {
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
              price: item.price || item.unit_price || 0,
              discount: item.discount || 0,
              subtotal: item.subtotal,
              type: isService ? 'service' : 'product',
              sku: item.product?.sku || item.product?.code || item.sku || '',
              stock: item.product?.stock !== undefined ? item.product.stock : item.stock,
              product: item.product || null,
              unit_id: item.unit_id || item.product?.unit_id || null,
              unit: item.unit || item.product?.unit || null,
            }
          })
          initializePaymentDistribution()
        }

        showNotification(`Cotización #${quote.document_number} cargada para facturar`, 'success')
      }
    } catch (e) {
      console.error('Error al cargar cotización para venta:', e)
      showNotification('Error al cargar la cotización seleccionada', 'error')
    }
  }

  // Si viene con ?type=quote, preseleccionar cotización
  const typeParam = route.query.type
  if (typeParam === 'quote' && !workOrderId && !quoteId) {
    sale.value.document_type = 'quote'
    sale.value.payment_status = 'pending'
  }

  await onDocumentTypeChange()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 position-relative">
    <VProgressLinear
      v-if="isLoading"
      indeterminate
      color="primary"
      height="3"
      class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 10;"
    />

    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4 border-b pb-4">
      <div>
        <div class="d-flex align-center">
          <VAvatar
            :color="isQuote ? 'info-lighten-5' : (sale.document_type === 'invoice' ? 'primary-lighten-5' : 'success-lighten-5')"
            size="52"
            class="mr-3 elevation-1"
          >
            <VIcon
              :icon="isQuote ? 'ri-file-list-3-line' : (sale.document_type === 'invoice' ? 'ri-bill-line' : 'ri-file-text-line')"
              size="30"
              :color="isQuote ? 'info' : (sale.document_type === 'invoice' ? 'primary' : 'success')"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h4 font-weight-bold mb-0">
                {{ isQuote ? 'Registrar Cotización' : (sale.document_type === 'invoice' ? 'Registrar Factura' : 'Registrar Venta') }}
              </h1>
              <VChip
                v-if="!isQuote && sale.document_type === 'invoice'"
                color="primary"
                size="small"
                variant="flat"
                class="font-weight-bold"
                prepend-icon="ri-shield-check-line"
              >
                SRI Electrónica
              </VChip>
              <VChip
                v-else-if="!isQuote"
                color="success"
                size="small"
                variant="tonal"
                class="font-weight-bold"
                prepend-icon="ri-store-2-line"
              >
                Nota de Venta
              </VChip>
            </div>
            <p class="text-medium-emphasis mb-0 mt-1">
              {{ isQuote ? 'Crea una nueva cotización de servicios y repuestos para un cliente' : (sale.document_type === 'invoice' ? 'Emisión de comprobante fiscal electrónico autorizado por el SRI' : 'Crea un nuevo comprobante comercial de venta') }}
            </p>
          </div>
        </div>
      </div>
    </div>

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

    <VForm
      v-else
      ref="formRef"
      :disabled="isProcessing"
      @submit.prevent="submitForm"
    >
      <VRow>
        <VCol cols="12">
          <!-- Tipo de Documento -->
          <VCard
            v-if="!isQuote"
            class="elevation-2 mb-4"
          >
            <VCardText class="pa-6">
              <div class="d-flex align-center justify-space-between mb-5">
                <div class="d-flex align-center">
                  <VAvatar
                    size="40"
                    color="primary"
                    variant="tonal"
                    class="mr-3"
                  >
                    <VIcon
                      icon="ri-file-list-3-line"
                      size="24"
                    />
                  </VAvatar>
                  <div>
                    <h3 class="text-h6 font-weight-bold mb-0">
                      Tipo de Documento
                    </h3>
                    <p class="text-caption text-grey mb-0">
                      Selecciona el comprobante comercial que deseas emitir
                    </p>
                  </div>
                </div>
                <div
                  v-if="isLinkedToWorkOrder"
                  class="text-right"
                >
                  <div style="color: #ff4d4f; font-size: 1.5rem; font-weight: 800; line-height: 1.2;">
                    #{{ sale.work_order_number }}
                  </div>
                  <div style="color: #757575; font-size: 0.75rem; font-weight: 500; text-transform: uppercase;">
                    Orden de trabajo
                  </div>
                </div>
              </div>
              <!-- Selector Unido de Tipo de Documento -->
              <div class="doc-type-united-group rounded-xl d-flex flex-column flex-md-row">
                <!-- Opción Nota de Venta -->
                <div
                  class="doc-type-united-item rounded-lg pa-3 px-4 cursor-pointer d-flex align-center justify-space-between"
                  :class="sale.document_type === 'sale_note' ? 'doc-type-selected-success' : 'doc-type-unselected'"
                  @click="sale.document_type = 'sale_note'; onDocumentTypeChange()"
                >
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      :color="sale.document_type === 'sale_note' ? 'success' : 'grey-lighten-3'"
                      :variant="sale.document_type === 'sale_note' ? 'flat' : 'tonal'"
                      size="44"
                      class="transition-all"
                    >
                      <VIcon
                        icon="ri-file-text-line"
                        size="24"
                        :color="sale.document_type === 'sale_note' ? 'white' : 'grey-darken-1'"
                      />
                    </VAvatar>
                    <div>
                      <div
                        class="text-subtitle-1 font-weight-bold"
                        :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey-darken-3'"
                      >
                        Nota de Venta
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        Comprobante comercial interno
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <VChip
                      size="x-small"
                      :color="sale.document_type === 'sale_note' ? 'success' : 'grey'"
                      :variant="sale.document_type === 'sale_note' ? 'tonal' : 'outlined'"
                      class="font-weight-bold"
                    >
                      Interno
                    </VChip>
                    <VIcon
                      :icon="sale.document_type === 'sale_note' ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                      size="22"
                      :color="sale.document_type === 'sale_note' ? 'success' : 'grey-lighten-1'"
                    />
                  </div>
                </div>

                <!-- Opción Factura -->
                <div
                  class="doc-type-united-item rounded-lg pa-3 px-4 cursor-pointer d-flex align-center justify-space-between"
                  :class="sale.document_type === 'invoice' ? 'doc-type-selected-primary' : 'doc-type-unselected'"
                  @click="sale.document_type = 'invoice'; onDocumentTypeChange()"
                >
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      :color="sale.document_type === 'invoice' ? 'primary' : 'grey-lighten-3'"
                      :variant="sale.document_type === 'invoice' ? 'flat' : 'tonal'"
                      size="44"
                      class="transition-all"
                    >
                      <VIcon
                        icon="ri-bill-line"
                        size="24"
                        :color="sale.document_type === 'invoice' ? 'white' : 'grey-darken-1'"
                      />
                    </VAvatar>
                    <div>
                      <div
                        class="text-subtitle-1 font-weight-bold"
                        :class="sale.document_type === 'invoice' ? 'text-primary' : 'text-grey-darken-3'"
                      >
                        Factura Electrónica
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        Documento fiscal válido para el SRI
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <VChip
                      size="x-small"
                      :color="sale.document_type === 'invoice' ? 'primary' : 'grey'"
                      :variant="sale.document_type === 'invoice' ? 'tonal' : 'outlined'"
                      class="font-weight-bold"
                    >
                      SRI Oficial
                    </VChip>
                    <VIcon
                      :icon="sale.document_type === 'invoice' ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                      size="22"
                      :color="sale.document_type === 'invoice' ? 'primary' : 'grey-lighten-1'"
                    />
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- Datos Generales -->
          <VCard class="elevation-2 mb-4">
            <VCardText class="pa-6">
              <div class="d-flex align-center justify-space-between mb-6">
                <div class="d-flex align-center">
                  <VAvatar
                    size="48"
                    color="primary"
                    variant="tonal"
                    class="mr-3"
                  >
                    <VIcon
                      icon="ri-profile-line"
                      size="28"
                    />
                  </VAvatar>
                  <div>
                    <h3 class="text-h5 font-weight-bold mb-0">
                      Datos Generales
                    </h3>
                    <p class="text-caption text-grey mb-0">
                      Información básica del documento comercial
                    </p>
                  </div>
                </div>
                <VBtn
                  color="info"
                  variant="tonal"
                  prepend-icon="ri-file-list-3-line"
                  size="small"
                  @click="openWorkOrderImportDialog"
                >
                  Importar OT
                </VBtn>
              </div>
              <VRow>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="sale.document_number"
                    label="Número de Documento *"
                    :rules="[requiredRule]"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-hashtag"
                    hide-details="auto"
                    required
                    color="primary"
                    :readonly="isLinkedToWorkOrder"
                    :loading="isLoading"
                    :hint="isLinkedToWorkOrder ? `Vinculado a la Orden de Trabajo: ${sale.work_order_number || ''}` : undefined"
                    persistent-hint
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="sale.service_date"
                    label="Fecha de Servicio *"
                    type="date"
                    :rules="[requiredRule]"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-calendar-line"
                    hide-details="auto"
                    required
                    color="primary"
                  />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Cliente y Vehículo -->
          <VCard class="elevation-2 mb-4">
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-6">
                <VAvatar
                  size="48"
                  color="success"
                  variant="tonal"
                  class="mr-3"
                >
                  <VIcon
                    icon="ri-user-star-line"
                    size="28"
                  />
                </VAvatar>
                <div>
                  <h3 class="text-h5 font-weight-bold mb-0">
                    Cliente y Vehículo
                  </h3>
                  <p class="text-caption text-grey mb-0">
                    Selecciona el cliente y el vehículo para la venta
                  </p>
                </div>
              </div>
              <VRow>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <div class="d-flex align-center gap-2">
                    <VSearch
                      v-model="selectedClient"
                      :return-object="true"
                      endpoint="clients/search"
                      item-title="full_name"
                      label="Cliente *"
                      icon="ri-user-line"
                      :initial-item="selectedClient"
                      :rules="[(v) => !!sale.client_id || 'Cliente es requerido']"
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
                    </VSearch>
                    <VBtn
                      icon
                      size="40"
                      color="primary"
                      variant="tonal"
                    >
                      <VIcon
                        icon="ri-add-line"
                        size="20"
                      />
                      <VMenu activator="parent">
                        <VList>
                          <VListItem
                            prepend-icon="ri-user-line"
                            title="Cliente Final"
                            @click="isClientFinalAddDialogVisible = true"
                          />
                          <VListItem
                            prepend-icon="ri-building-line"
                            title="Cliente Empresa"
                            @click="isClientCompanyAddDialogVisible = true"
                          />
                        </VList>
                      </VMenu>
                    </VBtn>
                  </div>
                  <div
                    v-if="selectedClient"
                    class="mt-3 pa-3 bg-grey-lighten-5 rounded-lg d-flex align-center gap-3"
                  >
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      size="40"
                    >
                      <VIcon
                        icon="ri-user-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <div class="font-weight-bold">
                        {{ selectedClient.n_document || "-" }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        {{ selectedClient.phone || "-" }} • {{
                          selectedClient.address || "-"
                        }}
                      </div>
                    </div>
                  </div>
                  <div class="mt-4">
                    <VAutocomplete
                      v-model="sale.technicians"
                      :items="employees"
                      :item-title="item => `${item.first_name} ${item.last_name}${item.position ? ' - ' + item.position : ''}`"
                      item-value="id"
                      label="Técnicos"
                      prepend-inner-icon="ri-user-settings-line"
                      variant="outlined"
                      density="comfortable"
                      clearable
                      multiple
                      chips
                      :readonly="isLinkedToWorkOrder"
                      :hint="isLinkedToWorkOrder ? 'Heredados de la orden de trabajo' : 'Opcional: uno o más'"
                      persistent-hint
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
                <VCol
                  cols="12"
                  sm="6"
                >
                  <div class="d-flex align-center gap-2">
                    <VSearch
                      v-model="selectedVehicle"
                      :return-object="true"
                      endpoint="vehicles/search"
                      item-title="license_plate"
                      label="Vehículo (Opcional)"
                      icon="ri-car-line"
                      :initial-item="selectedVehicle"
                      :extra-params="sale.client_id ? { client_id: sale.client_id } : {}"
                    >
                      <template #item="{ props, item }">
                        <VListItem
                          v-bind="props"
                          :title="item.raw.license_plate"
                        >
                          <VListItemSubtitle class="mt-1 text-grey">
                            <span>{{ item.raw.brand?.name || item.raw.brand || '' }} {{ item.raw.model || '' }}</span>
                            <span
                              v-if="item.raw.client"
                              class="text-primary font-weight-medium ms-2"
                            >
                              • Propietario: {{ item.raw.client.full_name || (item.raw.client.name + ' ' + (item.raw.client.surname || '')) }}
                            </span>
                          </VListItemSubtitle>
                        </VListItem>
                      </template>
                    </VSearch>
                    <VBtn
                      color="success"
                      variant="tonal"
                      icon="ri-add-line"
                      @click="isVehicleAddDialogVisible = true"
                    />
                  </div>
                  <div
                    v-if="selectedVehicle"
                    class="mt-3 pa-3 bg-grey-lighten-5 rounded-lg d-flex align-center gap-3"
                  >
                    <VAvatar
                      color="success"
                      variant="tonal"
                      size="40"
                    >
                      <VIcon
                        icon="ri-car-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <div class="font-weight-bold">
                        {{ selectedVehicle.license_plate }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        {{ selectedVehicle.model || "-" }} • {{
                          selectedVehicle.year || "-"
                        }}
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="selectedVehicle"
                    class="mt-4"
                  >
                    <VTextField
                      v-model="sale.mileage"
                      label="Kilometraje"
                      type="number"
                      variant="outlined"
                      density="comfortable"
                      prepend-inner-icon="ri-dashboard-3-line"
                      hide-details="auto"
                      color="primary"
                    />
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>


          <!-- Productos y Servicios -->
          <VCard class="elevation-2 mb-4">
            <VCardText class="pa-6">
              <div class="d-flex align-center justify-space-between mb-6">
                <div class="d-flex align-center">
                  <VAvatar
                    size="48"
                    color="info"
                    variant="tonal"
                    class="mr-3"
                  >
                    <VIcon
                      icon="ri-shopping-cart-2-line"
                      size="28"
                    />
                  </VAvatar>
                  <div>
                    <h3 class="text-h5 font-weight-bold mb-0">
                      Productos y Servicios
                    </h3>
                    <p class="text-caption text-grey mb-0">
                      Agrega los ítems a la venta o cotización
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
                    variant="tonal"
                    prepend-icon="ri-add-line"
                    @click="isAddServiceDialogVisible = true"
                  >
                    Servicio Express
                  </VBtn>
                </div>
              </div>
              <div class="d-flex align-center gap-3 mb-4">
                <VSearch
                  v-model="searchProduct"
                  endpoint="products/search"
                  item-title="description"
                  :return-object="true"
                  label="Buscar y agregar producto por nombre, código o SKU..."
                  icon="ri-search-line"
                  class="flex-grow-1"
                  hide-details
                  @change="onProductSelected"
                >
                  <template #item="{ props, item }">
                    <VListItem
                      v-bind="props"
                      :title="undefined"
                    >
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
                    </VListItem>
                  </template>
                </VSearch>
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <VTable class="custom-items-table text-no-wrap">
                  <thead class="bg-grey-lighten-4">
                    <tr>
                      <th style="min-width: 250px;">
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
                        Desc.
                      </th>
                      <th
                        class="text-center"
                        style="width: 130px;"
                      >
                        Total
                      </th>
                      <th
                        class="text-center"
                        style="width: 60px;"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(item, index) in sale.items"
                      :key="index"
                      class="hover-row"
                    >
                      <td>
                        <div class="d-flex align-center gap-3 py-1">
                          <VAvatar
                            size="38"
                            :color="item.type === 'service' ? 'info' : 'primary'"
                            variant="tonal"
                            class="elevation-1"
                          >
                            <VIcon
                              :icon="item.type === 'service' ? 'ri-tools-line' : 'ri-box-3-line'"
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
                              style="white-space: normal !important; max-width: 500px;"
                            />
                            <div class="text-caption text-grey mt-1 d-flex align-center gap-2">
                              <span
                                class="text-uppercase font-weight-bold"
                                :class="isServiceItem(item) ? 'text-primary' : 'text-secondary'"
                                style="font-size: 0.65rem;"
                              >
                                {{ isServiceItem(item) ? 'Servicio' : 'Producto' }}
                              </span>
                              <span
                                v-if="!isServiceItem(item) && sale.document_type !== 'quote'"
                                class="stock-tag"
                                :class="{ 'stock-low': item.quantity > getProductStock(item.product_id, item) }"
                              >
                                <VIcon
                                  icon="ri-stack-line"
                                  size="12"
                                  class="mr-1"
                                />
                                {{ getProductStock(item.product_id, item) }} en stock
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
                          v-model.number="item.price"
                          type="number"
                          density="compact"
                          variant="plain"
                          hide-details
                          min="0"
                          step="0.01"
                          prefix="$"
                          :rules="[requiredRule, positiveNumberRule]"
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
                          ${{ ((item.quantity * item.price) - item.discount).toFixed(2) }}
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
                    <tr v-if="sale.items.length === 0">
                      <td
                        colspan="6"
                        class="text-center pa-8 text-medium-emphasis"
                      >
                        <VIcon
                          icon="ri-shopping-cart-line"
                          size="48"
                          class="mb-2 opacity-50"
                        /><br>
                        No hay productos agregados
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>

              <!-- Resumen Financiero -->
              <div class="d-flex justify-end mt-4">
                <VCard
                  class="elevation-2 bg-primary-lighten-5 border-primary border"
                  width="350"
                >
                  <VCardText class="pa-4">
                    <div class="d-flex align-center mb-3">
                      <VAvatar
                        size="32"
                        color="primary"
                        variant="tonal"
                        class="mr-2"
                      >
                        <VIcon
                          icon="ri-calculator-line"
                          size="18"
                        />
                      </VAvatar>
                      <span class="text-subtitle-2 font-weight-bold">Resumen Financiero</span>
                    </div>
                    <div class="d-flex justify-space-between mb-1 text-body-2">
                      <span class="text-medium-emphasis">Subtotal:</span>
                      <span>${{ grossSubtotal.toFixed(2) }}</span>
                    </div>
                    <div
                      v-if="totalDiscount > 0"
                      class="d-flex justify-space-between mb-1 text-body-2 text-error"
                    >
                      <span class="text-medium-emphasis">Descuento:</span>
                      <span>-${{ totalDiscount.toFixed(2) }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-1 text-body-2">
                      <span class="text-medium-emphasis">Base Imponible:</span>
                      <span>${{ subtotal.toFixed(2) }}</span>
                    </div>
                    <div
                      v-if="sale.document_type === 'invoice'"
                      class="d-flex justify-space-between mb-1 text-body-2"
                    >
                      <span class="text-medium-emphasis">IVA (15%):</span>
                      <span>${{ taxAmount.toFixed(2) }}</span>
                    </div>
                    <VDivider class="my-2 border-opacity-50" />
                    <div class="d-flex justify-space-between align-center">
                      <span class="text-body-1 font-weight-bold">
                        {{ sale.document_type === 'quote' ? 'Total:' : 'Total a pagar:' }}
                      </span>
                      <span class="text-h5 font-weight-black text-primary">${{ total.toFixed(2) }}</span>
                    </div>
                  </VCardText>
                </VCard>
              </div>
            </VCardText>
          </VCard>

          <!-- Pagos (Solo si no es cotización) -->
          <VAlert
            v-if="sale.document_type !== 'quote' && sale.items.length === 0"
            type="info"
            variant="tonal"
            class="mb-4"
          >
            Agrega productos para configurar pagos.
          </VAlert>

          <VCard
            v-if="sale.document_type !== 'quote' && sale.items.length > 0"
            class="elevation-2 mb-4 border-primary border"
          >
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-4">
                <VAvatar
                  size="40"
                  color="success"
                  variant="tonal"
                  class="mr-3"
                >
                  <VIcon
                    icon="ri-wallet-3-line"
                    size="24"
                  />
                </VAvatar>
                <div>
                  <h3 class="text-h6 font-weight-bold mb-0">
                    Configuración de Pagos
                  </h3>
                  <p class="text-caption text-grey mb-0">
                    Método y distribución del pago
                  </p>
                </div>
              </div>

              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VSelect
                    v-model="sale.payment_status"
                    :items="paymentStatuses"
                    item-title="title"
                    item-value="value"
                    label="Estado del pago"
                    :rules="[requiredRule]"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="ri-flag-line"
                    hide-details="auto"
                    class="mb-4"
                  />

                  <VCard
                    variant="tonal"
                    color="primary"
                    class="pa-3 rounded-lg cursor-pointer mb-4"
                    :class="sale.is_credited ? 'border-primary border' : 'opacity-70'"
                    @click="onCreditChange"
                  >
                    <div class="d-flex align-center">
                      <VIcon
                        :icon="sale.is_credited ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                        size="24"
                        class="mr-2"
                      />
                      <div>
                        <div class="text-body-2 font-weight-bold">
                          Venta a crédito
                        </div>
                        <div class="text-caption">
                          Pago diferido
                        </div>
                      </div>
                    </div>
                  </VCard>
                </VCol>

                <VCol
                  cols="12"
                  md="6"
                >
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="font-weight-bold">Distribución de Pagos:</span>
                    <VBtn
                      v-if="sale.payment_status !== 'pending'"
                      color="primary"
                      variant="text"
                      size="small"
                      prepend-icon="ri-add-line"
                      @click="addPaymentDistribution"
                    >
                      Agregar Pago
                    </VBtn>
                  </div>

                  <!-- Mensaje Informativo cuando el pago está Pendiente -->
                  <VAlert
                    v-if="sale.payment_status === 'pending'"
                    type="warning"
                    variant="tonal"
                    density="comfortable"
                    class="rounded-lg mb-2"
                    icon="ri-time-line"
                  >
                    <div class="text-subtitle-2 font-weight-bold">
                      Pago en estado Pendiente
                    </div>
                    <div class="text-caption">
                      No se debe seleccionar método de pago ni registrar abono inmediato. La venta se registrará como pago pendiente / crédito.
                    </div>
                  </VAlert>

                  <template v-else>
                    <div
                      v-for="(dist, index) in paymentDistributions"
                      :key="index"
                      class="pa-3 mb-2 bg-grey-lighten-5 border rounded-lg"
                    >
                      <div class="d-flex justify-space-between mb-2">
                        <span class="text-caption font-weight-bold">Pago #{{ index + 1 }}</span>
                        <VIcon
                          v-if="paymentDistributions.length > 1"
                          icon="ri-close-line"
                          color="error"
                          class="cursor-pointer"
                          size="18"
                          @click="removePaymentDistribution(index)"
                        />
                      </div>
                      <VRow>
                        <VCol
                          cols="12"
                          sm="6"
                        >
                          <VSelect
                            v-model="dist.payment_method"
                            :items="paymentMethods"
                            item-title="title"
                            item-value="value"
                            label="Forma"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="mb-2"
                            @update:model-value="(val) => onPaymentMethodChange(dist, val)"
                          />
                        </VCol>
                        <VCol
                          v-if="dist.payment_method === 'Transferencia'"
                          cols="12"
                          sm="6"
                        >
                          <VSelect
                            v-model="dist.account_id"
                            :items="accounts"
                            item-title="name"
                            item-value="id"
                            label="Cuenta"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="mb-2"
                          />
                        </VCol>
                        <VCol
                          cols="12"
                          :sm="dist.payment_method === 'Transferencia' ? 12 : 6"
                        >
                          <VTextField
                            v-model.number="dist.amount"
                            type="number"
                            min="0"
                            step="0.01"
                            label="Monto"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            prefix="$"
                            @input="handlePaymentAmountChange(dist, index)"
                            @blur="handlePaymentAmountChange(dist, index)"
                          />
                        </VCol>
                      </VRow>
                    </div>

                    <div
                      v-if="paymentDistributions.length > 0"
                      class="mt-3 text-subtitle-2 text-right"
                    >
                      <div :class="remainingAmount < 0 ? 'text-error' : 'text-success'">
                        Falta distribuir: ${{ remainingAmount.toFixed(2) }}
                      </div>
                    </div>
                  </template>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Observaciones -->
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
                    Observaciones y Notas
                  </h3>
                  <p class="text-caption text-grey mb-0">
                    Detalles adicionales del documento
                  </p>
                </div>
              </div>
              <VTextarea
                v-model="sale.observations"
                label="Observaciones / Notas"
                placeholder="Notas o términos y condiciones adicionales..."
                variant="outlined"
                rows="3"
                prepend-inner-icon="ri-file-text-line"
                hide-details="auto"
              />
            </VCardText>
          </VCard>

          <VAlert
            v-if="showValidationError"
            color="error"
            variant="tonal"
            class="mb-4"
            closable
            @click:close="showValidationError = false"
          >
            {{ validationErrorMessage }}
          </VAlert>

          <!-- Acciones -->
          <VCard class="elevation-2">
            <VCardText class="pa-6">
              <div
                class="d-flex justify-end gap-3"
                :style="isProcessing ? 'pointer-events: none; opacity: 0.75;' : ''"
              >
                <VBtn
                  type="button"
                  color="grey"
                  variant="outlined"
                  prepend-icon="ri-close-line"
                  :disabled="isProcessing"
                  @click="router.push('/sales/list')"
                >
                  Cancelar
                </VBtn>
                <VBtn
                  v-if="sale.document_type !== 'quote'"
                  type="button"
                  color="secondary"
                  variant="elevated"
                  prepend-icon="ri-draft-line"
                  :loading="isSavingDraft"
                  :disabled="isProcessing"
                  @click.prevent="saveDraft"
                >
                  Guardar Borrador
                </VBtn>
                <VBtn
                  v-if="sale.document_type !== 'quote'"
                  type="button"
                  color="warning"
                  variant="elevated"
                  prepend-icon="ri-truck-line"
                  :loading="isDispatching"
                  :disabled="isProcessing"
                  @click.prevent="dispatchSale"
                >
                  Despachar (Pago Pendiente)
                </VBtn>
                <VBtn
                  type="submit"
                  color="primary"
                  variant="elevated"
                  prepend-icon="ri-save-3-line"
                  :loading="isSubmitting"
                  :disabled="isProcessing"
                  size="large"
                >
                  {{ isQuote ? 'Registrar Cotización' : (sale.document_type === 'invoice' ? 'Registrar Factura' : 'Registrar Venta') }}
                </VBtn>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </VForm>

    <!-- Dialogs -->
    <ClientFinalAddDialog
      v-if="isClientFinalAddDialogVisible"
      v-model:isDialogVisible="isClientFinalAddDialogVisible"
      @add-client-final="handleClientAdded"
    />
    <ClientCompanyAddDialog
      v-if="isClientCompanyAddDialogVisible"
      v-model:isDialogVisible="isClientCompanyAddDialogVisible"
      @add-client-company="handleClientAdded"
    />
    <VehicleAddDialog
      v-if="isVehicleAddDialogVisible"
      v-model:isDialogVisible="isVehicleAddDialogVisible"
      :client-selected-id="sale.client_id"
      @add-vehicle="handleVehicleAdded"
    />

    <!-- Diálogo de importación de orden de trabajo -->
    <VDialog
      v-model="isWorkOrderImportDialogVisible"
      scrollable
      max-width="800px"
    >
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isWorkOrderImportDialogVisible = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-file-download-line" />
          </div>
          <h3 class="custom-dialog-title">
            Importar Orden de Trabajo
          </h3>
          <p class="custom-dialog-subtitle">
            Selecciona una orden de trabajo finalizada para facturarla
          </p>
        </div>
        <VCardText class="pa-4">
          <div
            v-if="isLoadingWorkOrders"
            class="text-center pa-8"
          >
            <VProgressCircular
              indeterminate
              color="primary"
              size="48"
            />
            <p class="mt-4">
              Cargando órdenes listas para facturar...
            </p>
          </div>
          <div
            v-else-if="readyWorkOrders.length === 0"
            class="text-center pa-8"
          >
            <VIcon
              icon="ri-file-list-3-line"
              size="64"
              color="grey-lighten-1"
            />
            <p class="mt-4 text-grey">
              No hay órdenes de trabajo listas para facturar.
            </p>
          </div>
          <div v-else>
            <VTextField
              v-model="workOrderSearchQuery"
              placeholder="Buscar orden (placa, cliente, #)..."
              prepend-inner-icon="ri-search-line"
              variant="outlined"
              density="compact"
              class="mb-4"
              hide-details
              clearable
            />
            <div class="border rounded-lg overflow-x-auto">
              <VTable
                density="comfortable"
                hover
              >
                <thead>
                  <tr>
                    <th>OT #</th>
                    <th>Cliente</th>
                    <th>Vehículo</th>
                    <th>Fecha Ingreso</th>
                    <th class="text-right">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="order in filteredWorkOrders"
                    :key="order.id"
                  >
                    <td class="font-weight-medium">
                      OT-{{ order.id }}
                    </td>
                    <td>
                      {{ order.client?.name }} {{ order.client?.surname }}<br><small class="text-grey">{{
                        order.client?.n_document }}</small>
                    </td>
                    <td>
                      {{ order.vehicle?.license_plate }}<br><small class="text-grey">{{ order.vehicle?.brand }} {{
                        order.vehicle?.model }}</small>
                    </td>
                    <td>
                      {{ order.entry_date ? (order.entry_date.includes(':') ? new Date(order.entry_date.replace(' ', 'T')) : new Date(order.entry_date.replace(/-/g, '/'))).toLocaleDateString() : 'N/A' }}
                    </td>
                    <td class="text-right">
                      <VBtn
                        color="primary"
                        size="small"
                        variant="elevated"
                        @click="selectWorkOrder(order)"
                      >
                        Importar
                      </VBtn>
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </div>
          </div>
        </VCardText>
        <VDivider />
        <VCardActions
          class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;"
        >
          <VBtn
            color="secondary"
            variant="outlined"
            prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium"
            height="40"
            @click="isWorkOrderImportDialogVisible = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Dialog para agregar servicio express -->
    <!-- Dialog para agregar servicio express -->
    <AddServiceDialog
      :is-dialog-visible="isAddServiceDialogVisible"
      @update:is-dialog-visible="isAddServiceDialogVisible = $event"
      @service-added="handleServiceAdded"
    />

    <!-- Diálogo de confirmación para Factura -->
    <VDialog
      v-model="isConfirmInvoiceDialogVisible"
      max-width="540px"
      persistent
    >
      <VCard class="custom-dialog-card rounded-xl overflow-hidden elevation-10">
        <!-- Header Banner Primary -->
        <div
          class="custom-dialog-header-primary pa-5 text-center position-relative"
          style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: white;"
        >
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn position-absolute"
            style="top: 12px; right: 12px; color: white;"
            :disabled="isSubmitting"
            @click="isConfirmInvoiceDialogVisible = false"
          />
          <div
            class="mx-auto mb-3 d-flex align-center justify-center rounded-circle"
            style="width: 64px; height: 64px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px);"
          >
            <VIcon
              icon="ri-bill-line"
              size="36"
              color="white"
            />
          </div>
          <h3 class="text-h5 font-weight-bold text-white mb-1">
            ¿Estás seguro que deseas realizar esta "FACTURA"?
          </h3>
          <p class="text-caption text-white opacity-90 mb-0">
            Se emitirá el comprobante electrónico fiscal con autorización ante el SRI.
          </p>
        </div>

        <VCardText class="pa-5 bg-grey-lighten-5">
          <!-- Resumen de Factura -->
          <VCard class="pa-4 rounded-lg border border-light elevation-0 mb-4 bg-white">
            <div class="d-flex justify-space-between align-center pb-2 border-b mb-3">
              <span class="text-caption text-medium-emphasis font-weight-medium">CLIENTE</span>
              <span class="text-body-2 font-weight-bold text-grey-darken-4 text-right">
                {{ selectedClient ? (selectedClient.full_name || `${selectedClient.name || ''} ${selectedClient.surname || ''}`.trim() || selectedClient.n_document) : 'Consumidor Final' }}
              </span>
            </div>

            <div
              v-if="selectedClient?.n_document"
              class="d-flex justify-space-between align-center pb-2 border-b mb-3"
            >
              <span class="text-caption text-medium-emphasis font-weight-medium">RUC / CÉDULA</span>
              <span class="text-body-2 font-weight-semibold text-primary">
                {{ selectedClient.n_document }}
              </span>
            </div>

            <div
              v-if="selectedVehicle"
              class="d-flex justify-space-between align-center pb-2 border-b mb-3"
            >
              <span class="text-caption text-medium-emphasis font-weight-medium">VEHÍCULO</span>
              <span class="text-body-2 font-weight-semibold text-grey-darken-3">
                {{ selectedVehicle.license_plate }} ({{ selectedVehicle.brand }} {{ selectedVehicle.model }})
              </span>
            </div>

            <div class="d-flex justify-space-between align-center pb-2 border-b mb-3">
              <span class="text-caption text-medium-emphasis font-weight-medium">AMBIENTE SRI</span>
              <VChip
                :color="sriEnvironmentInfo.color"
                size="small"
                variant="flat"
                class="font-weight-bold px-2.5"
              >
                <VIcon :icon="sriEnvironmentInfo.icon" size="14" class="me-1" />
                {{ sriEnvironmentInfo.text }}
              </VChip>
            </div>

            <div class="d-flex justify-space-between align-center pb-2 border-b mb-3">
              <span class="text-caption text-medium-emphasis font-weight-medium">CONDICIÓN DE PAGO</span>
              <VChip
                :color="sale.payment_status === 'pending' ? 'warning' : 'success'"
                size="x-small"
                variant="tonal"
                class="font-weight-bold"
              >
                {{ computedPaymentMethodSummary }}
              </VChip>
            </div>

            <div class="d-flex justify-space-between align-center pt-1">
              <span class="text-subtitle-1 font-weight-bold text-grey-darken-3">TOTAL A FACTURAR</span>
              <span class="text-h5 font-weight-black text-primary">
                ${{ total.toFixed(2) }}
              </span>
            </div>
          </VCard>

          <VAlert
            :type="sriEnvironmentInfo.isProd ? 'warning' : 'info'"
            variant="tonal"
            density="compact"
            class="rounded-lg mb-0 text-caption font-weight-medium"
            :icon="sriEnvironmentInfo.icon"
          >
            <strong>Ambiente SRI: {{ sriEnvironmentInfo.text }}</strong> — {{ sriEnvironmentInfo.desc }}
          </VAlert>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 d-flex justify-end gap-3 bg-white">
          <VBtn
            color="secondary"
            variant="outlined"
            prepend-icon="ri-close-line"
            :disabled="isSubmitting"
            @click="isConfirmInvoiceDialogVisible = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            prepend-icon="ri-check-line"
            :loading="isSubmitting"
            size="large"
            class="px-5 font-weight-bold"
            @click="executeSaleSubmission"
          >
            Sí, emitir factura
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
