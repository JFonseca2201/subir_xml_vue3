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
const employees = ref([])

// Estado del formulario
const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
}

const sale = ref({
  document_type: 'sale_note',
  document_number: '',
  client_id: null,
  vehicle_id: null,
  work_order_id: null,
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
const requiredRule = v => (
  v !== null &&
  v !== undefined &&
  v !== '' &&
  !(typeof v === 'number' && Number.isNaN(v))
) || 'Campo obligatorio'

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
const lastSaleNumber = ref(0)

// Generar número de documento secuencial
const generateDocumentNumber = type => {
  if (type === 'quote') {
    const newNumber = lastCotNumber.value + 1

    return 'COT-' + String(newNumber).padStart(7, '0')
  } else {
    const newNumber = lastSaleNumber.value + 1

    return 'V-' + String(newNumber).padStart(7, '0')
  }
}

const isLinkedToWorkOrder = computed(() => !!sale.value.work_order_id)

// Watch para regenerar número cuando cambia el tipo de documento
const onDocumentTypeChange = () => {
  if (!isLinkedToWorkOrder.value) {
    sale.value.document_number = generateDocumentNumber(sale.value.document_type)
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
  if (paymentDistributions.value.length === 0 && sale.value.items.length > 0) {
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))
    paymentDistributions.value.push({
      account_id: cajaChica ? cajaChica.id : null,
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

const handleServiceAdded = async (newService) => {
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

const selectWorkOrder = workOrder => {
  sale.value.work_order_id = workOrder.id
  sale.value.document_number = workOrder.number
  sale.value.client_id = workOrder.client_id
  sale.value.vehicle_id = workOrder.vehicle_id
  sale.value.mileage = workOrder.mileage
  applyWorkOrderTechnicians(workOrder)

  // Importar items de la orden de trabajo
  if (workOrder.items && workOrder.items.length > 0) {
    sale.value.items = workOrder.items.map(item => ({
      product_id: item.product_id,
      description: item.description,
      quantity: item.quantity,
      price: item.unit_price || item.price || 0,
      discount: item.discount || 0,
      subtotal: item.subtotal,
      type: item.type || (item.product_id ? 'product' : 'service'),
      sku: item.product?.sku || item.product?.code || item.sku || '',
    }))
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
    // Cargar datos en paralelo con menos registros para mejorar rendimiento
    const [clientsRes, vehiclesRes, productsRes, accountsRes, salesRes, workOrdersRes, employeesRes] = await Promise.all([
      $api('clients', { params: { per_page: 1000 } }),
      $api('vehicles', { params: { per_page: 1000 } }),
      $api('products', { params: { per_page: 1000 } }),
      $api('accounts', { params: { per_page: 100 } }),
      $api('sales', { params: { per_page: 1000 } }), // Elevado a 1000 para evitar duplicados en la numeración correlativa
      $api('work-orders'),
      $api('employees', { params: { per_page: 1000 } }),
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
    employees.value = extractArray(employeesRes, 'employees')

    // Obtener el último número OT- (ventas + órdenes de trabajo) y COT-
    const sales = extractArray(salesRes, 'data')
    const workOrders = extractArray(workOrdersRes, 'data')
    let maxOt = 0
    let maxCot = 0

    const updateMaxOt = number => {
      const match = number?.match(/OT-?(\d+)/i)
      if (match) {
        const num = parseInt(match[1])
        if (num > maxOt) maxOt = num
      }
    }

    if (sales?.length) {
      for (const s of sales) {
        if (s.document_number?.toUpperCase().startsWith('OT-')) {
          updateMaxOt(s.document_number)
        } else if (s.document_number?.toUpperCase().startsWith('COT-')) {
          const match = s.document_number.match(/COT-?(\d+)/i)
          if (match) {
            const num = parseInt(match[1])
            if (num > maxCot) maxCot = num
          }
        } else if (s.document_number?.toUpperCase().startsWith('V-')) {
          const match = s.document_number.match(/V-?(\d+)/i)
          if (match) {
            const num = parseInt(match[1])
            if (num > lastSaleNumber.value) lastSaleNumber.value = num
          }
        }
      }
    }

    if (workOrders?.length) {
      for (const wo of workOrders) {
        updateMaxOt(wo.number)
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

const getProductStock = productId => {
  const product = products.value.find(p => p.id === productId)

  return product ? product.stock : 0
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

watch(total, (newTotal) => {
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

watch(() => sale.value.vehicle_id, (newVal) => {
  if (isLoading.value) return // Ignorar durante la carga inicial

  if (newVal) {
    const selectedVeh = vehicles.value.find(v => v.id === newVal)
    if (selectedVeh && selectedVeh.client_id) {
      sale.value.client_id = selectedVeh.client_id
    }
  }
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

  // Validar pagos distribuidos solo si no es cotización
  if (sale.value.document_type !== 'quote') {
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

    // Si el pago no está completado, el estado debe quedar en pendiente. Solo cuando se haya completado el total, cambia a pagado.
    if (Math.abs(totalDist - total.value) <= 0.01) {
      sale.value.payment_status = 'paid'
    } else {
      sale.value.payment_status = 'pending'
    }
  }

  loader.start()

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

  loader.start()

  try {
    const payload = {
      ...sale.value,
      subtotal: subtotal.value,
      tax_amount: taxAmount.value,
      total: total.value,
      is_draft: true
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
      router.push('/sales/list')
    } else {
      showNotification(response.message || 'Error al guardar borrador', 'error')
    }
  } catch (error) {
    console.error('Error guardando borrador', error)
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

  loader.start()

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
        sale.value.document_number = workOrder.number
        sale.value.client_id = workOrder.client_id
        sale.value.vehicle_id = workOrder.vehicle_id
        sale.value.mileage = workOrder.mileage
        applyWorkOrderTechnicians(workOrder)

        // Importar items de la orden de trabajo
        if (workOrder.items && workOrder.items.length > 0) {
          sale.value.items = workOrder.items.map(item => ({
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            price: item.unit_price || item.price || 0,
            discount: item.discount || 0,
            subtotal: item.subtotal,
            type: item.type || (item.product_id ? 'product' : 'service'),
            sku: item.product?.sku || item.product?.code || item.sku || '',
          }))
          initializePaymentDistribution()
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
    <div
      class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4 border-b pb-4">
      <div>
        <div class="d-flex align-center">
          <VAvatar color="primary-lighten-5" size="48" class="mr-3">
            <VIcon icon="ri-add-line" size="32" color="primary" />
          </VAvatar>
          <h1 class="text-h4 font-weight-bold mb-1">Registrar Venta o Cotización</h1>
        </div>
        <p class="text-medium-emphasis mb-0">Crea un nuevo documento comercial</p>
      </div>
      <VBtn color="primary" variant="tonal" prepend-icon="ri-arrow-left-line" to="/sales/list"
        class="align-self-md-center align-self-end">
        Volver al Listado
      </VBtn>
    </div>

    <VForm ref="formRef" @submit.prevent="submitForm">
      <VRow>
        <VCol cols="12">
          <!-- Tipo de Documento -->
          <VCard class="elevation-2 mb-4">
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-5">
                <VAvatar size="40" color="primary" variant="tonal" class="mr-3">
                  <VIcon icon="ri-file-list-3-line" size="24" />
                </VAvatar>
                <div>
                  <h3 class="text-h6 font-weight-bold mb-0">Tipo de Documento</h3>
                  <p class="text-caption text-grey mb-0">Selecciona el tipo de comprobante comercial</p>
                </div>
              </div>
              <VRow>
                <VCol cols="12" md="4">
                  <VCard
                    :class="sale.document_type === 'quote' ? 'border-primary border-2 bg-primary-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-lg elevation-0 hover:elevation-2 transition-all" variant="outlined"
                    @click="sale.document_type = 'quote'; onDocumentTypeChange()">
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar :color="sale.document_type === 'quote' ? 'primary' : 'grey-lighten-2'" size="40">
                        <VIcon icon="ri-file-text-line" :color="sale.document_type === 'quote' ? 'white' : 'grey'" />
                      </VAvatar>
                      <div>
                        <div class="font-weight-bold"
                          :class="sale.document_type === 'quote' ? 'text-primary' : 'text-grey'">Cotización</div>
                        <div class="text-caption text-medium-emphasis">Documento de presupuesto</div>
                      </div>
                    </div>
                  </VCard>
                </VCol>

                <VCol cols="12" md="4">
                  <VCard
                    :class="sale.document_type === 'sale_note' ? 'border-success border-2 bg-success-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-lg elevation-0 hover:elevation-2 transition-all" variant="outlined"
                    @click="sale.document_type = 'sale_note'; onDocumentTypeChange()">
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar :color="sale.document_type === 'sale_note' ? 'success' : 'grey-lighten-2'" size="40">
                        <VIcon icon="ri-file-list-3-line"
                          :color="sale.document_type === 'sale_note' ? 'white' : 'grey'" />
                      </VAvatar>
                      <div>
                        <div class="font-weight-bold"
                          :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey'">Nota de Venta</div>
                        <div class="text-caption text-medium-emphasis">Documento de venta</div>
                      </div>
                    </div>
                  </VCard>
                </VCol>

                <VCol cols="12" md="4">
                  <VCard
                    :class="sale.document_type === 'invoice' ? 'border-red border-2 bg-red-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-lg elevation-0 hover:elevation-2 transition-all" variant="outlined"
                    @click="sale.document_type = 'invoice'; onDocumentTypeChange()">
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar :color="sale.document_type === 'invoice' ? 'red' : 'grey-lighten-2'" size="40">
                        <VIcon icon="ri-bill-line" :color="sale.document_type === 'invoice' ? 'white' : 'grey'" />
                      </VAvatar>
                      <div>
                        <div class="font-weight-bold"
                          :class="sale.document_type === 'invoice' ? 'text-red' : 'text-grey'">Factura</div>
                        <div class="text-caption text-medium-emphasis">Documento fiscal</div>
                      </div>
                    </div>
                  </VCard>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Datos Generales -->
          <VCard class="elevation-2 mb-4">
            <VCardText class="pa-6">
              <div class="d-flex align-center justify-space-between mb-6">
                <div class="d-flex align-center">
                  <VAvatar size="48" color="primary" variant="tonal" class="mr-3">
                    <VIcon icon="ri-profile-line" size="28" />
                  </VAvatar>
                  <div>
                    <h3 class="text-h5 font-weight-bold mb-0">Datos Generales</h3>
                    <p class="text-caption text-grey mb-0">Información básica del documento comercial</p>
                  </div>
                </div>
                <VBtn color="info" variant="tonal" prepend-icon="ri-file-list-3-line" size="small"
                  @click="openWorkOrderImportDialog">
                  Importar OT
                </VBtn>
              </div>
              <VRow>
                <VCol cols="12" sm="6">
                  <VTextField v-model="sale.document_number" label="Número de Documento *" :rules="[requiredRule]"
                    variant="outlined" density="comfortable" prepend-inner-icon="ri-hashtag" hide-details="auto"
                    required color="primary" :readonly="isLinkedToWorkOrder"
                    :hint="isLinkedToWorkOrder ? 'Vinculado a la orden de trabajo' : undefined" persistent-hint />
                </VCol>
                <VCol cols="12" sm="6">
                  <VTextField v-model="sale.service_date" label="Fecha de Servicio *" type="date"
                    :rules="[requiredRule]" variant="outlined" density="comfortable"
                    prepend-inner-icon="ri-calendar-line" hide-details="auto" required color="primary" />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Cliente y Vehículo -->
          <VCard class="elevation-2 mb-4">
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-6">
                <VAvatar size="48" color="success" variant="tonal" class="mr-3">
                  <VIcon icon="ri-user-star-line" size="28" />
                </VAvatar>
                <div>
                  <h3 class="text-h5 font-weight-bold mb-0">Cliente y Vehículo</h3>
                  <p class="text-caption text-grey mb-0">Selecciona el cliente y el vehículo para la venta</p>
                </div>
              </div>
              <VRow>
                <VCol cols="12" sm="6">
                  <div class="d-flex align-center gap-2">
                    <VAutocomplete v-model="sale.client_id" :loading="isLoading" :items="clients"
                      :item-title="getClientName" item-value="id" label="Cliente *" :rules="[requiredRule]"
                      variant="outlined" density="comfortable" prepend-inner-icon="ri-user-line" hide-details="auto"
                      required placeholder="Buscar cliente..." clearable color="primary" :custom-filter="clientFilter"
                      class="flex-grow-1">
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="getClientName(item.raw)" :subtitle="item.raw?.n_document" />
                      </template>
                    </VAutocomplete>
                    <VBtn icon size="40" color="primary" variant="tonal">
                      <VIcon icon="ri-add-line" size="20" />
                      <VMenu activator="parent">
                        <VList>
                          <VListItem prepend-icon="ri-user-line" title="Cliente Final"
                            @click="isClientFinalAddDialogVisible = true" />
                          <VListItem prepend-icon="ri-building-line" title="Cliente Empresa"
                            @click="isClientCompanyAddDialogVisible = true" />
                        </VList>
                      </VMenu>
                    </VBtn>
                  </div>
                  <div v-if="selectedClient" class="mt-3 pa-3 bg-grey-lighten-5 rounded-lg d-flex align-center gap-3">
                    <VAvatar color="primary" variant="tonal" size="40">
                      <VIcon icon="ri-user-line" size="20" />
                    </VAvatar>
                    <div>
                      <div class="font-weight-bold">{{ selectedClient.n_document || "-" }}</div>
                      <div class="text-caption text-medium-emphasis">{{ selectedClient.phone || "-" }} • {{
                        selectedClient.address || "-"
                        }}</div>
                    </div>
                  </div>
                </VCol>
                <VCol cols="12" sm="6">
                  <div class="d-flex align-center gap-2">
                    <VAutocomplete v-model="sale.vehicle_id" :loading="isLoading" :items="vehicles"
                      item-title="license_plate" item-value="id" label="Vehículo (Opcional)" variant="outlined"
                      density="comfortable" prepend-inner-icon="ri-car-line" hide-details="auto"
                      placeholder="Seleccionar vehículo" clearable class="flex-grow-1">
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="item.raw.license_plate" :subtitle="item.raw.model || ''" />
                      </template>
                    </VAutocomplete>
                    <VBtn color="success" variant="tonal" icon="ri-add-line"
                      @click="isVehicleAddDialogVisible = true" />
                  </div>
                  <div v-if="selectedVehicle" class="mt-3 pa-3 bg-grey-lighten-5 rounded-lg d-flex align-center gap-3">
                    <VAvatar color="success" variant="tonal" size="40">
                      <VIcon icon="ri-car-line" size="20" />
                    </VAvatar>
                    <div>
                      <div class="font-weight-bold">{{ selectedVehicle.license_plate }}</div>
                      <div class="text-caption text-medium-emphasis">{{ selectedVehicle.model || "-" }} • {{
                        selectedVehicle.year || "-"
                        }}</div>
                    </div>
                  </div>
                  <div class="mt-4" v-if="selectedVehicle">
                    <VTextField v-model="sale.mileage" label="Kilometraje" type="number" variant="outlined"
                      density="comfortable" prepend-inner-icon="ri-dashboard-3-line" hide-details="auto"
                      color="primary" />
                  </div>
                </VCol>
                <VCol cols="12">
                  <VAutocomplete v-model="sale.technicians" :items="employees"
                    :item-title="item => `${item.first_name} ${item.last_name}${item.position ? ' - ' + item.position : ''}`"
                    item-value="id" label="Técnicos" prepend-inner-icon="ri-user-settings-line" variant="outlined"
                    density="comfortable" clearable multiple chips :readonly="isLinkedToWorkOrder"
                    :hint="isLinkedToWorkOrder ? 'Heredados de la orden de trabajo' : 'Opcional: uno o más'"
                    persistent-hint>
                    <template #chip="{ props, item }">
                      <VChip v-bind="props" :text="`${item.raw.first_name} ${item.raw.last_name}`" />
                    </template>
                  </VAutocomplete>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>


          <!-- Productos y Servicios -->
          <VCard class="elevation-2 mb-4">
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-6">
                <VAvatar size="48" color="info" variant="tonal" class="mr-3">
                  <VIcon icon="ri-shopping-cart-2-line" size="28" />
                </VAvatar>
                <div>
                  <h3 class="text-h5 font-weight-bold mb-0">Productos y Servicios</h3>
                  <p class="text-caption text-grey mb-0">Agrega los ítems a la venta o cotización</p>
                </div>
              </div>
              <div class="d-flex align-center gap-3 mb-4">
                <VAutocomplete ref="productAutocompleteRef" v-model="searchProduct" :loading="isLoading"
                  :items="products" item-title="displayTitle" return-object label="Buscar y agregar producto"
                  placeholder="Escribe para buscar por nombre, código, SKU..." prepend-inner-icon="ri-search-line"
                  variant="outlined" clearable :custom-filter="productFilter" @update:model-value="onProductSelected"
                  class="flex-grow-1" hide-details :menu-props="{ maxWidth: 0 }">
                  <template #item="{ props, item }">
                    <VListItem v-bind="props" :title="undefined">
                      <VListItemTitle style="white-space: normal !important; line-height: 1.4;"
                        class="font-weight-medium">
                        {{ item.raw.name || item.raw.description }}
                      </VListItemTitle>
                      <VListItemSubtitle v-if="item.raw.code || item.raw.sku" class="mt-1 text-grey">
                        Código/SKU: {{ item.raw.code || item.raw.sku }}
                      </VListItemSubtitle>
                    </VListItem>
                  </template>
                </VAutocomplete>
                <VBtn color="info" variant="tonal" prepend-icon="ri-add-line" height="56"
                  @click="isAddServiceDialogVisible = true">
                  Servicio Express
                </VBtn>
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <VTable class="custom-items-table text-no-wrap">
                  <thead class="bg-grey-lighten-4">
                    <tr>
                      <th style="min-width: 250px;">Ítem / Descripción</th>
                      <th class="text-center" style="width: 130px;">Cantidad</th>
                      <th class="text-center" style="width: 140px;">Precio Unit.</th>
                      <th class="text-center" style="width: 120px;">Desc.</th>
                      <th class="text-center" style="width: 130px;">Total</th>
                      <th class="text-center" style="width: 60px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in sale.items" :key="index" class="hover-row">
                      <td>
                        <div class="d-flex align-center gap-3 py-1">
                          <VAvatar size="38" :color="item.type === 'service' ? 'info' : 'primary'" variant="tonal"
                            class="elevation-1">
                            <VIcon :icon="item.type === 'service' ? 'ri-tools-line' : 'ri-box-3-line'" size="20" />
                          </VAvatar>
                          <div class="flex-grow-1">
                            <div class="font-weight-medium text-body-1"
                              style="white-space: normal !important; max-width: 500px;" :title="item.description">
                              {{ item.description }}
                            </div>
                            <div v-if="item.sku" class="text-caption text-grey-darken-1 mt-1 font-weight-semibold"
                              style="font-size: 0.75rem;">
                              SKU: {{ item.sku }}
                            </div>
                            <div class="text-caption text-grey mt-1 d-flex align-center gap-2">
                              <span class="text-uppercase font-weight-bold" style="font-size: 0.65rem;">
                                {{ item.type === 'service' ? 'Servicio' : 'Producto' }}
                              </span>
                              <span v-if="item.type === 'product' && sale.document_type !== 'quote'" class="stock-tag"
                                :class="{ 'stock-low': item.quantity > getProductStock(item.product_id) }">
                                <VIcon icon="ri-stack-line" size="12" class="mr-1" />
                                {{ getProductStock(item.product_id) }} en stock
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="text-center">
                        <div class="d-inline-flex align-center qty-selector">
                          <VBtn icon="ri-subtract-line" variant="text" color="primary" :disabled="item.quantity <= 1"
                            @click="item.quantity--" class="qty-btn" size="small" />
                          <input v-model.number="item.quantity" type="number" min="1" max="99" class="qty-input"
                            @input="item.quantity > 99 ? item.quantity = 99 : null"
                            @blur="(!item.quantity || item.quantity < 1) ? item.quantity = 1 : null" />
                          <VBtn icon="ri-add-line" variant="text" color="primary" :disabled="item.quantity >= 99"
                            @click="item.quantity < 99 ? item.quantity++ : null" class="qty-btn" size="small" />
                        </div>
                      </td>
                      <td>
                        <VTextField v-model.number="item.price" type="number" density="compact" variant="plain"
                          hide-details min="0" step="0.01" prefix="$" :rules="[requiredRule]"
                          class="premium-input font-weight-bold" />
                      </td>
                      <td>
                        <VTextField v-model.number="item.discount" type="number" density="compact" variant="plain"
                          hide-details min="0" step="0.01" prefix="$"
                          class="premium-input text-error font-weight-medium" />
                      </td>
                      <td class="text-center">
                        <span class="text-h6 font-weight-black text-success">
                          ${{ ((item.quantity * item.price) - item.discount).toFixed(2) }}
                        </span>
                      </td>
                      <td class="text-center">
                        <VBtn icon="ri-delete-bin-line" size="small" color="error" variant="text" class="delete-btn"
                          @click="removeItem(index)" />
                      </td>
                    </tr>
                    <tr v-if="sale.items.length === 0">
                      <td colspan="6" class="text-center pa-8 text-medium-emphasis">
                        <VIcon icon="ri-shopping-cart-line" size="48" class="mb-2 opacity-50" /><br>
                        No hay productos agregados
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>

              <!-- Resumen Financiero -->
              <div class="d-flex justify-end mt-4">
                <VCard class="elevation-2 bg-primary-lighten-5 border-primary border" width="350">
                  <VCardText class="pa-4">
                    <div class="d-flex align-center mb-3">
                      <VAvatar size="32" color="primary" variant="tonal" class="mr-2">
                        <VIcon icon="ri-calculator-line" size="18" />
                      </VAvatar>
                      <span class="text-subtitle-2 font-weight-bold">Resumen Financiero</span>
                    </div>
                    <div class="d-flex justify-space-between mb-1 text-body-2">
                      <span class="text-medium-emphasis">Subtotal:</span>
                      <span>${{ grossSubtotal.toFixed(2) }}</span>
                    </div>
                    <div v-if="totalDiscount > 0" class="d-flex justify-space-between mb-1 text-body-2 text-error">
                      <span class="text-medium-emphasis">Descuento:</span>
                      <span>-${{ totalDiscount.toFixed(2) }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-1 text-body-2">
                      <span class="text-medium-emphasis">Base Imponible:</span>
                      <span>${{ subtotal.toFixed(2) }}</span>
                    </div>
                    <div v-if="sale.document_type === 'invoice'" class="d-flex justify-space-between mb-1 text-body-2">
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

          <!-- Pagos (Solo si no es cotización y tiene items) -->
          <VCard v-if="sale.document_type !== 'quote' && sale.items.length > 0"
            class="elevation-2 mb-4 border-primary border">
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-4">
                <VAvatar size="40" color="success" variant="tonal" class="mr-3">
                  <VIcon icon="ri-wallet-3-line" size="24" />
                </VAvatar>
                <div>
                  <h3 class="text-h6 font-weight-bold mb-0">Configuración de Pagos</h3>
                  <p class="text-caption text-grey mb-0">Método y distribución del pago</p>
                </div>
              </div>

              <VRow>
                <VCol cols="12" md="6">
                  <VSelect v-model="sale.payment_status" :items="paymentStatuses" item-title="title" item-value="value"
                    label="Estado del pago" :rules="[requiredRule]" variant="outlined" density="comfortable"
                    prepend-inner-icon="ri-flag-line" hide-details="auto" class="mb-4" />

                  <VCard variant="tonal" color="primary" class="pa-3 rounded-lg cursor-pointer mb-4"
                    :class="sale.is_credited ? 'border-primary border' : 'opacity-70'" @click="onCreditChange">
                    <div class="d-flex align-center">
                      <VIcon :icon="sale.is_credited ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                        size="24" class="mr-2" />
                      <div>
                        <div class="text-body-2 font-weight-bold">Venta a crédito</div>
                        <div class="text-caption">Pago diferido</div>
                      </div>
                    </div>
                  </VCard>
                </VCol>

                <VCol cols="12" md="6">
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="font-weight-bold">Distribución de Pagos:</span>
                    <VBtn color="primary" variant="text" size="small" prepend-icon="ri-add-line"
                      @click="addPaymentDistribution">
                      Agregar Pago</VBtn>
                  </div>

                  <div v-for="(dist, index) in paymentDistributions" :key="index"
                    class="pa-3 mb-2 bg-grey-lighten-5 border rounded-lg">
                    <div class="d-flex justify-space-between mb-2">
                      <span class="text-caption font-weight-bold">Pago #{{ index + 1 }}</span>
                      <VIcon icon="ri-close-line" color="error" class="cursor-pointer" size="18"
                        @click="removePaymentDistribution(index)" v-if="paymentDistributions.length > 1" />
                    </div>
                    <VRow>
                      <VCol cols="12" sm="6">
                        <VSelect v-model="dist.payment_method" :items="paymentMethods" item-title="title"
                          item-value="value" label="Forma" variant="outlined" density="compact" hide-details="auto"
                          class="mb-2" @update:model-value="(val) => onPaymentMethodChange(dist, val)" />
                      </VCol>
                      <VCol cols="12" sm="6" v-if="dist.payment_method === 'Transferencia'">
                        <VSelect v-model="dist.account_id" :items="accounts" item-title="name" item-value="id"
                          label="Cuenta" variant="outlined" density="compact" hide-details="auto" class="mb-2" />
                      </VCol>
                      <VCol cols="12" :sm="dist.payment_method === 'Transferencia' ? 12 : 6">
                        <VTextField v-model.number="dist.amount" type="number" min="0" step="0.01" label="Monto"
                          variant="outlined" density="compact" hide-details="auto" prefix="$" />
                      </VCol>
                    </VRow>
                  </div>

                  <div v-if="paymentDistributions.length > 0" class="mt-3 text-subtitle-2 text-right">
                    <div :class="remainingAmount < 0 ? 'text-error' : 'text-success'">Falta distribuir: ${{
                      remainingAmount.toFixed(2) }}</div>
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <VAlert v-if="sale.document_type !== 'quote' && sale.items.length === 0" type="info" variant="tonal"
            class="mb-4">
            Agrega productos para configurar pagos.
          </VAlert>

          <!-- Observaciones -->
          <VCard class="elevation-2 mb-4">
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-4">
                <VAvatar size="40" color="info" variant="tonal" class="mr-3">
                  <VIcon icon="ri-file-text-line" size="24" />
                </VAvatar>
                <div>
                  <h3 class="text-h6 font-weight-bold mb-0">Observaciones y Notas</h3>
                  <p class="text-caption text-grey mb-0">Detalles adicionales del documento</p>
                </div>
              </div>
              <VTextarea v-model="sale.observations" label="Observaciones / Notas"
                placeholder="Notas o términos y condiciones adicionales..." variant="outlined" rows="3"
                prepend-inner-icon="ri-file-text-line" hide-details="auto" />
            </VCardText>
          </VCard>

          <VAlert v-if="showValidationError" color="error" variant="tonal" class="mb-4" closable
            @click:close="showValidationError = false">
            {{ validationErrorMessage }}
          </VAlert>

          <!-- Acciones -->
          <VCard class="elevation-2">
            <VCardText class="pa-6">
              <div class="d-flex justify-end gap-3">
                <VBtn color="grey" variant="outlined" prepend-icon="ri-close-line" @click="router.push('/sales/list')">
                  Cancelar
                </VBtn>
                <VBtn v-if="sale.document_type !== 'quote'" color="secondary" variant="elevated"
                  prepend-icon="ri-draft-line" :loading="loader.loading" @click.prevent="saveDraft">
                  Guardar Borrador
                </VBtn>
                <VBtn v-if="sale.document_type !== 'quote'" color="warning" variant="elevated"
                  prepend-icon="ri-truck-line" :loading="loader.loading" @click.prevent="dispatchSale">
                  Despachar (Pago Pendiente)
                </VBtn>
                <VBtn type="submit" color="primary" variant="elevated" prepend-icon="ri-save-3-line"
                  :loading="loader.loading" size="large">
                  Registrar Venta
                </VBtn>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </VForm>

    <!-- Dialogs -->
    <ClientFinalAddDialog v-if="isClientFinalAddDialogVisible" v-model:isDialogVisible="isClientFinalAddDialogVisible"
      @add-client-final="handleClientAdded" />
    <ClientCompanyAddDialog v-if="isClientCompanyAddDialogVisible"
      v-model:isDialogVisible="isClientCompanyAddDialogVisible" @add-client-company="handleClientAdded" />
    <VehicleAddDialog v-if="isVehicleAddDialogVisible" v-model:isDialogVisible="isVehicleAddDialogVisible"
      @add-vehicle="handleVehicleAdded" />

    <!-- Diálogo de importación de orden de trabajo -->
    <VDialog v-model="isWorkOrderImportDialogVisible" max-width="800px">
      <VCard>
        <VCardTitle class="pa-4 d-flex align-center justify-space-between bg-primary text-white">
          <span class="text-h6">Importar Orden de Trabajo</span>
          <VBtn icon="ri-close-line" variant="text" color="white" @click="isWorkOrderImportDialogVisible = false" />
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-4">
          <div v-if="isLoadingWorkOrders" class="text-center pa-8">
            <VProgressCircular indeterminate color="primary" size="48" />
            <p class="mt-4">Cargando órdenes listas para facturar...</p>
          </div>
          <div v-else-if="readyWorkOrders.length === 0" class="text-center pa-8">
            <VIcon icon="ri-file-list-3-line" size="64" color="grey-lighten-1" />
            <p class="mt-4 text-grey">No hay órdenes de trabajo listas para facturar.</p>
          </div>
          <div v-else>
            <VTextField v-model="workOrderSearchQuery" placeholder="Buscar orden (placa, cliente, #)..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="compact" class="mb-4" hide-details
              clearable />
            <div class="border rounded-lg overflow-x-auto">
              <VTable density="comfortable" hover>
                <thead>
                  <tr>
                    <th>OT #</th>
                    <th>Cliente</th>
                    <th>Vehículo</th>
                    <th>Fecha Ingreso</th>
                    <th class="text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="order in filteredWorkOrders" :key="order.id">
                    <td class="font-weight-medium">OT-{{ order.id }}</td>
                    <td>{{ order.client?.name }} {{ order.client?.surname }}<br><small class="text-grey">{{
                      order.client?.n_document }}</small></td>
                    <td>{{ order.vehicle?.license_plate }}<br><small class="text-grey">{{ order.vehicle?.brand }} {{
                      order.vehicle?.model }}</small></td>
                    <td>{{ order.entry_date ? new Date(order.entry_date.replace(' ', 'T')).toLocaleDateString() : 'N/A'
                    }}
                    </td>
                    <td class="text-right">
                      <VBtn color="primary" size="small" variant="elevated" @click="selectWorkOrder(order)">
                        Importar
                      </VBtn>
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </div>
          </div>
        </VCardText>
      </VCard>
    </VDialog>

    <!-- Dialog para agregar servicio express -->
    <AddServiceDialog :is-dialog-visible="isAddServiceDialogVisible"
      @update:is-dialog-visible="isAddServiceDialogVisible = $event" @service-added="handleServiceAdded" />
  </div>
</template>
