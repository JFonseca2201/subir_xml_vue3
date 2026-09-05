<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { getBrandNameById } from '@/data/vehicleBrands.js'
import AddServiceDialog from '@/components/inventory/product/AddServiceDialog.vue'
import VSearch from '@/components/common/VSearch.vue'

const router = useRouter()
const route = useRoute()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const formRef = ref(null)
const isLoading = ref(false)
const isDocumentNumberLoading = ref(false)
const showValidationError = ref(false)
const validationErrorMessage = ref('')
const isDispatching = ref(false)
const isAuthorizedInvoice = computed(() => {
  return sale.value.document_type === 'invoice' && sale.value.sri_status === 'AUTORIZADA'
})
const isReadOnly = computed(() => {
  return sale.value.status === 'canceled' || isAuthorizedInvoice.value
})
const isProcessing = computed(() => loader.loading || isDispatching.value || isReadOnly.value)

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
const sale = ref({
  document_type: '',
  document_number: '',
  client_id: null,
  vehicle_id: null,
  mileage: null,
  service_date: '',
  payment_status: '',
  is_credited: false,
  payment_method: null,
  observations: '',
  technicians: [],
  subtotal: 0,
  tax_amount: 0,
  total: 0,
  status: '',
  sri_status: '',
  sri_access_key: '',
  client: null,
  vehicle: null,
  items: [],
})

// Pagos distribuidos
const paymentDistributions = ref([])

// Buscador de productos
const searchProduct = ref(null)
const isAddServiceDialogVisible = ref(false)

// Reglas de validación
// Regla de campo obligatorio que acepta 0 como valor válido
const positiveNumberRule = v => v >= 0 || 'El valor no puede ser negativo'

const requiredRule = v => (
  v !== null &&
  v !== undefined &&
  v !== '' &&
  !(typeof v === 'number' && Number.isNaN(v))
) || 'Campo obligatorio'

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

// Watch para regenerar número cuando cambia el tipo de documento
const onDocumentTypeChange = async () => {
  // 1. Si era Factura, no se puede cambiar a ningún otro tipo
  if (originalDocumentType.value === 'invoice' && sale.value.document_type !== 'invoice') {
    showNotification('Una factura no puede convertirse en nota de venta ni en cotización', 'warning')
    sale.value.document_type = 'invoice'

    return
  }

  // 2. Si era Nota de Venta, solo se puede convertir a Factura (no a cotización)
  if (originalDocumentType.value === 'sale_note' && sale.value.document_type === 'quote') {
    showNotification('Una nota de venta no puede convertirse en cotización', 'warning')
    sale.value.document_type = 'sale_note'

    return
  }

  // 3. Conversión de Nota de Venta -> Factura
  if (originalDocumentType.value === 'sale_note' && sale.value.document_type === 'invoice') {
    isDocumentNumberLoading.value = true
    try {
      const response = await $api('sales/next-number?document_type=invoice')
      if (response && response.data) {
        sale.value.document_number = response.data
      }
      showNotification('Convertir a Factura: al guardar se emitirá comprobante electrónico con IVA al SRI', 'info')
    } catch (error) {
      console.error('Error al obtener secuencial de factura:', error)
    } finally {
      isDocumentNumberLoading.value = false
    }

    return
  } else if (originalDocumentType.value === 'sale_note' && sale.value.document_type === 'sale_note') {
    sale.value.document_number = originalDocumentNumber.value

    return
  }

  // 4. Conversión desde Cotización
  if (originalDocumentType.value === 'quote' && sale.value.document_type !== 'quote') {
    isDocumentNumberLoading.value = true
    try {
      const response = await $api(`sales/next-number?document_type=${sale.value.document_type}`)
      if (response && response.data) {
        sale.value.document_number = response.data
      }
    } catch (error) {
      console.error('Error al obtener secuencial:', error)
    } finally {
      isDocumentNumberLoading.value = false
    }

    // Establecer la fecha actual por defecto al cambiar a venta
    const tzOffset = (new Date()).getTimezoneOffset() * 60000

    sale.value.service_date = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  } else if (originalDocumentType.value === 'quote' && sale.value.document_type === 'quote') {
    sale.value.document_number = originalDocumentNumber.value
    sale.value.service_date = originalServiceDate.value
  }
}

// Inicializar con un pago distribuido cuando hay items
const initializePaymentDistribution = () => {
  if (paymentDistributions.value.length === 0 && sale.value.items.length > 0) {
    paymentDistributions.value.push({
      account_id: null,
      amount: total.value,
      payment_method: null,
    })
  }
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

// Gestión del detalle (items)
const removeItem = async index => {
  const item = sale.value.items[index]
  if (item.id) {
    loader.start()
    try {
      const response = await $api(`sales/details/${item.id}`, {
        method: 'DELETE',
      })

      if (response && response.success) {
        sale.value.items.splice(index, 1)
        if (response.sale) {
          sale.value.subtotal = response.sale.subtotal
          sale.value.tax_amount = response.sale.tax_amount
          sale.value.total = response.sale.total
        }
        showNotification('Ítem eliminado correctamente', 'success')
      } else {
        showNotification(response.message || 'Error al eliminar el ítem', 'error')
      }
    } catch (error) {
      console.error('Error al eliminar el ítem:', error)
      showNotification(error.response?._data?.message || 'Error al eliminar el ítem', 'error')
    } finally {
      loader.stop()
    }
  } else {
    sale.value.items.splice(index, 1)
  }
}

const isServiceItem = item => {
  if (!item) return false
  if (item.type === 'service') return true
  if (item.item_type === 2) return true
  if (item.product?.item_type === 2) return true
  const product = products.value.find(p => p.id === item.product_id)
  if (product && (product.item_type === 2 || product.type === 'service')) return true
  const sku = item.sku || item.product?.sku || product?.sku || ''
  if (sku && String(sku).toUpperCase().startsWith('SRV-')) return true
  if (!item.product_id && !item.sku) return true
  return false
}

const getProductStock = (productId, item = null) => {
  if (item && item.stock !== undefined && item.stock !== null) {
    return Number(item.stock)
  }
  if (item && item.product && item.product.stock !== undefined && item.product.stock !== null) {
    return Number(item.product.stock)
  }
  const product = products.value.find(p => p.id === productId)

  return product && product.stock !== undefined && product.stock !== null ? Number(product.stock) : 0
}

const getProductSku = productId => {
  const product = products.value.find(p => p.id === productId)

  return product ? (product.sku || product.code_aux || product.code || '') : ''
}

// Gestión de pagos distribuidos
const addPaymentDistribution = () => {
  const rem = remainingAmount.value > 0 ? Number(remainingAmount.value.toFixed(2)) : 0
  const newPayment = {
    account_id: null,
    amount: rem,
    payment_method: null,
  }

  paymentDistributions.value.push(newPayment)
}

const removePaymentDistribution = index => {
  if (paymentDistributions.value.length > 1) {
    paymentDistributions.value.splice(index, 1)
  }
}

// Asignar cuenta automáticamente según método de pago
const onPaymentMethodChange = (dist, newMethod) => {
  dist.payment_method = newMethod
  if (newMethod === 'Efectivo') {
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja')) || accounts.value.find(acc => acc.type === 'cash')

    dist.account_id = cajaChica ? cajaChica.id : (accounts.value[0]?.id || null)
  } else if (newMethod === 'Transferencia') {
    dist.account_id = null
  } else {
    dist.account_id = null
  }
}

const initializePaymentAccount = dist => {
  if (dist.payment_method === 'Efectivo' && !dist.account_id) {
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja')) || accounts.value.find(acc => acc.type === 'cash')

    dist.account_id = cajaChica ? cajaChica.id : (accounts.value[0]?.id || null)
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
    // Caché local para validaciones posteriores
    if (!products.value.find(p => p.id === product.id)) {
      products.value.push(product)
    }

    const isService = product.item_type === 2 ||
      (product.categorie && product.categorie.title && product.categorie.title.includes('SERVICIO'))

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
        type: isService ? 'service' : 'product',
        sku: product.sku || product.code || '',
      })
    }
    initializePaymentDistribution()
    searchProduct.value = null
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

// Cálculos (Los precios de productos y servicios ya incluyen IVA)
const TAX_RATE = 0.15

const grossSubtotal = computed(() => {
  return sale.value.items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
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

watch(total, (newTotal, oldTotal) => {
  // Solo actualizar automáticamente si hay un único método de pago y si coincide con el total anterior
  if (paymentDistributions.value.length === 1) {
    if (isLoading.value) return
    const currentAmount = Number(paymentDistributions.value[0].amount) || 0
    const prevTotal = Number(oldTotal) || 0
    if (Math.abs(currentAmount - prevTotal) <= 0.01) {
      paymentDistributions.value[0].amount = newTotal
    }
  }
})

// Computed para verificar si es cotización
const originalDocumentType = ref('')
const originalDocumentNumber = ref('')
const originalServiceDate = ref('')

const isQuote = computed(() => {
  return sale.value.document_type === 'quote'
})

// Computed para verificar si se puede convertir a venta
const canConvertToSale = computed(() => {
  return isQuote.value && sale.value.status !== 'canceled' && sale.value.items.length > 0
})

const isLinkedToWorkOrder = computed(() => !!sale.value.work_order_id)

// Refs para almacenar el objeto completo seleccionado
const selectedClient = ref(null)
const selectedVehicle = ref(null)

watch(() => selectedClient.value, async (newVal, oldVal) => {
  if (newVal && newVal.id) {
    sale.value.client_id = newVal.id
    if (!newVal.email) {
      try {
        const res = await $api(`clients/${newVal.id}`)
        const fullClient = res.client || res.data || res
        if (fullClient && fullClient.email) {
          selectedClient.value = { ...newVal, ...fullClient }
        }
      } catch (e) {
        console.warn('Error fetching full client:', e)
      }
    }

    // Solo si aún no se ha seleccionado vehículo, auto-cargar si el cliente tiene 1 vehículo
    if (!selectedVehicle.value) {
      try {
        const vRes = await $api('vehicles/search', { params: { client_id: newVal.id } })
        const clientVehicles = vRes?.data || vRes?.vehicles || (Array.isArray(vRes) ? vRes : [])
        if (clientVehicles.length === 1) {
          selectedVehicle.value = clientVehicles[0]
        }
      } catch (e) {
        console.warn('Error cargando vehículos del cliente:', e)
      }
    }
  } else {
    sale.value.client_id = null
  }
})

watch(() => selectedVehicle.value, async newVal => {
  if (newVal && newVal.id) {
    sale.value.vehicle_id = newVal.id

    if (!newVal.color) {
      try {
        const fullVehicle = await $api(`vehicles/${newVal.id}`)
        if (fullVehicle && (fullVehicle.id || fullVehicle.vehicle?.id)) {
          selectedVehicle.value = { ...newVal, ...(fullVehicle.vehicle || fullVehicle) }
        }
      } catch (e) {
        console.warn('Error fetching full vehicle:', e)
      }
    }

    // Si aún no hay un cliente seleccionado en la venta/factura, auto-asignar el dueño del vehículo
    const targetClientId = newVal.client_id || newVal.client?.id
    if (targetClientId && !selectedClient.value) {
      if (newVal.client && (newVal.client.name || newVal.client.full_name)) {
        selectedClient.value = newVal.client
      } else {
        try {
          const res = await $api(`clients/${targetClientId}`)
          selectedClient.value = res.client || res.data || res || newVal.client || newVal.client_details
        } catch (e) {
          selectedClient.value = newVal.client || newVal.client_details || null
        }
      }
    }
  } else {
    sale.value.vehicle_id = null
  }
})

const isVehicleOwnerDifferentFromClient = computed(() => {
  if (!selectedVehicle.value || !selectedClient.value) return false
  const vehicleClientId = selectedVehicle.value.client_id || selectedVehicle.value.client?.id
  return !!(vehicleClientId && vehicleClientId !== selectedClient.value.id)
})

const getVehicleOwnerName = computed(() => {
  if (!selectedVehicle.value) return ''
  const owner = selectedVehicle.value.client
  if (owner) {
    return owner.full_name || (owner.name + (owner.surname ? ' ' + owner.surname : ''))
  }
  return ''
})

const setClientToVehicleOwner = () => {
  if (selectedVehicle.value?.client) {
    selectedClient.value = selectedVehicle.value.client
  }
}

const hasServices = computed(() => {
  return (sale.value.items || []).some(item => isServiceItem(item))
})

const isAssigningDefaultVehicle = ref(false)
const assignDefaultVehicle = async () => {
  isAssigningDefaultVehicle.value = true
  try {
    const params = {}
    if (sale.value.client_id) {
      params.client_id = sale.value.client_id
    }
    const res = await $api('vehicles/default', { params })
    const defVehicle = res.vehicle || res.data || res
    if (defVehicle && defVehicle.id) {
      selectedVehicle.value = defVehicle
      sale.value.vehicle_id = defVehicle.id
      if (defVehicle.client_id && !sale.value.client_id) {
        selectedClient.value = defVehicle.client
      }
    }
  } catch (error) {
    console.error('Error al asignar vehículo por defecto:', error)
    showNotification('Error al obtener vehículo por defecto', 'error')
  } finally {
    isAssigningDefaultVehicle.value = false
  }
}

const getVehicleBrandModel = vehicle => {
  if (!vehicle) return ''
  const brand = getBrandNameById(vehicle.brand?.name || vehicle.brand || vehicle.brand_id)
  const model = vehicle.model || ''
  if (brand && model) return `${brand} - ${model}`
  return brand || model || 'Sin marca/modelo'
}

// Cargar datos iniciales
const loadSaleData = async () => {
  isLoading.value = true
  try {
    const [saleRes, clientsRes, vehiclesRes, productsRes, accountsRes, employeesRes] = await Promise.all([
      $api(`sales/${route.params.id}`),
      Promise.resolve([]),
      Promise.resolve([]),
      $api('products', { params: { per_page: 1000 } }),
      $api('accounts', { params: { per_page: 1000 } }),
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

    const saleData = saleRes.data || saleRes

    originalDocumentType.value = saleData.document_type
    originalDocumentNumber.value = saleData.document_number
    originalServiceDate.value = saleData.service_date ? saleData.service_date.split('T')[0] : ''

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
      technicians: (saleData.technicians || []).map(t => t.id),
      subtotal: saleData.subtotal,
      tax_amount: saleData.tax_amount,
      total: saleData.total,
      status: saleData.status,
      sri_status: saleData.sri_status || '',
      sri_access_key: saleData.sri_access_key || '',
      client: saleData.client,
      vehicle: saleData.vehicle,
      items: (saleData.details || []).map(d => {
        const prod = products.value.find(p => p.id === d.product_id)
        const productObj = d.product || prod
        const isService = productObj ? (productObj.item_type === 2 || (productObj.categorie && productObj.categorie.title && productObj.categorie.title.includes('SERVICIO'))) : false

        // Caché del producto inicial
        if (productObj && !products.value.find(p => p.id === productObj.id)) {
          products.value.push(productObj)
        }

        return {
          id: d.id,
          product_id: d.product_id,
          description: d.description,
          quantity: parseInt(d.quantity) || 1,
          price: parseFloat(d.price) || 0,
          discount: parseFloat(d.discount) || 0,
          type: isService ? 'service' : 'product',
          sku: productObj ? (productObj.sku || productObj.code || '') : '',
          original_quantity: parseInt(d.quantity) || 1,
          original_product_id: d.product_id,
        }
      }),
    }

    if (saleData.client) selectedClient.value = saleData.client
    if (saleData.vehicle) selectedVehicle.value = saleData.vehicle

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
    router.push(sale.value.document_type === 'quote' ? '/quotes/list' : '/sales/list')
  } finally {
    isLoading.value = false
  }
}

// Guardar como Borrador
const saveDraft = async () => {
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
      items: sale.value.items,
      is_draft: true,
    }

    if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
      payload.payment_distributions = paymentDistributions.value
    }

    const response = await $api(`sales/${route.params.id}`, {
      method: 'PUT',
      body: payload,
    })

    if (response?.success || response?.status === 200) {
      showNotification('Borrador actualizado correctamente', 'success')
      router.push(sale.value.document_type === 'quote' ? '/quotes/list' : '/sales/list')
    } else {
      showNotification(response.message || 'Error al actualizar borrador', 'error')
    }
  } catch (error) {
    console.error('Error guardando borrador', error)

    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'

    showNotification(errMsg, 'error')
  } finally {
    loader.stop()
  }
}

// Envío del formulario
const submitForm = async () => {
  if (isAuthorizedInvoice.value) {
    showNotification('Esta factura ya fue autorizada por el SRI y no puede ser modificada', 'warning')
    return
  }

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

  if (!sale.value.client_id) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe seleccionar un cliente para continuar'

    return
  }

  // Validar vehículo si hay servicios
  if (hasServices.value && !sale.value.vehicle_id) {
    await assignDefaultVehicle()
    if (!sale.value.vehicle_id) {
      showValidationError.value = true
      validationErrorMessage.value = 'El comprobante incluye servicios y requiere asociar un vehículo.'

      return
    }
  }

  // Validaciones fiscales para Facturas Electrónicas SRI
  if (sale.value.document_type === 'invoice' && selectedClient.value) {
    const docNum = (selectedClient.value.n_document || '').trim()
    const clientName = (selectedClient.value.full_name || selectedClient.value.name || '').toUpperCase()
    const isFinalConsumer = docNum === '9999999999999' || docNum === '9999999999' || clientName.includes('CONSUMIDOR FINAL')

    // Regla SRI: Límite de $50.00 para Consumidor Final
    if (isFinalConsumer && total.value >= 50.00) {
      showValidationError.value = true
      validationErrorMessage.value = 'Por normativa del SRI, no se pueden emitir Facturas a Consumidor Final por montos iguales o superiores a $50.00. Debe registrar o seleccionar un cliente con Cédula o RUC.'

      return
    }

    // Regla SRI: Formato de Cédula (10 dígitos) o RUC (13 dígitos)
    if (!isFinalConsumer) {
      const isNumeric = /^\d+$/.test(docNum)
      if (!isNumeric || (docNum.length !== 10 && docNum.length !== 13)) {
        showValidationError.value = true
        validationErrorMessage.value = `La identificación del cliente (${docNum || 'vacía'}) no es válida para Facturación Electrónica SRI. Debe ser una Cédula de 10 dígitos o un RUC de 13 dígitos numéricos.`

        return
      }
    }
  }

  // Validar que haya al menos un producto/servicio
  if (sale.value.items.length === 0) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe agregar al menos un producto o servicio'

    return
  }

  // Validar stock solo si no es cotización y es producto físico (item_type == 1)
  if (sale.value.document_type !== 'quote') {
    for (const item of sale.value.items) {
      if (item.product_id) {
        const product = products.value.find(p => p.id === item.product_id)
        if (product && product.item_type === 1) {
          let quantityNeeded = item.quantity
          if (originalDocumentType.value !== 'quote' && item.id && item.original_product_id === item.product_id) {
            quantityNeeded -= (item.original_quantity || 0)
          }
          if (quantityNeeded > 0 && product.stock < quantityNeeded) {
            showValidationError.value = true
            validationErrorMessage.value = `Stock insuficiente para ${product.description}. Stock disponible: ${product.stock}, Solicitado adicional: ${quantityNeeded}`

            return
          }
        }
      }
    }
  }

  // Validar descuentos máximos
  for (const item of sale.value.items) {
    if (item.product_id) {
      const product = products.value.find(p => p.id === item.product_id)
      if (product && product.item_type === 1 && product.max_discount !== null && product.max_discount !== undefined) {
        const maxDiscountAmount = item.quantity * parseFloat(product.max_discount)
        const itemDiscount = parseFloat(item.discount) || 0
        if (itemDiscount > maxDiscountAmount) {
          showValidationError.value = true
          validationErrorMessage.value = `Descuento total excede el máximo permitido para ${product.description}. Máximo total: ${maxDiscountAmount.toFixed(2)}, Ingresado total: ${itemDiscount.toFixed(2)}`

          return
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
      const totalDist = Math.round(paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0) * 100) / 100
      const currentTotal = Math.round(total.value * 100) / 100

      if (paymentDistributions.value.length === 0 || totalDist <= 0) {
        showValidationError.value = true
        validationErrorMessage.value = 'Debe agregar al menos un pago para la venta'

        return
      }

      // Validar que cada pago tenga un método de pago seleccionado y cuenta si es transferencia
      for (let i = 0; i < paymentDistributions.value.length; i++) {
        const dist = paymentDistributions.value[i]
        if (!dist.payment_method) {
          showValidationError.value = true
          validationErrorMessage.value = `⚠️ Debe seleccionar el Tipo de Pago (Efectivo o Transferencia) para el Pago #${i + 1}`

          return
        }
        if (dist.payment_method === 'Transferencia' && !dist.account_id) {
          showValidationError.value = true
          validationErrorMessage.value = `⚠️ Debe seleccionar la Cuenta Bancaria de destino para la Transferencia (Pago #${i + 1})`

          return
        }
        // Asegurar cuenta para efectivo si no estaba asignada
        if (dist.payment_method === 'Efectivo' && !dist.account_id) {
          const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja')) || accounts.value.find(acc => acc.type === 'cash')
          dist.account_id = cajaChica ? cajaChica.id : (accounts.value[0]?.id || null)
        }
      }

      if (totalDist > currentTotal + 0.01) {
        showValidationError.value = true
        validationErrorMessage.value = `La suma de los pagos ($${totalDist.toFixed(2)}) no puede ser mayor al total ($${currentTotal.toFixed(2)})`

        return
      }

      // Si el pago no está completado, el estado debe quedar en pendiente o partial.
      if (Math.abs(totalDist - currentTotal) <= 0.01) {
        sale.value.payment_status = 'paid'
      } else if (totalDist > 0) {
        sale.value.payment_status = 'partial'
      }
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
      router.push(sale.value.document_type === 'quote' ? '/quotes/list' : '/sales/list')
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

const dispatchSale = async () => {
  isDispatching.value = true
  sale.value.payment_status = 'pending'
  sale.value.is_credited = true
  paymentDistributions.value = []
  try {
    await submitForm()
  } finally {
    isDispatching.value = false
  }
}

onMounted(() => {
  loadSaleData()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 work-orders-create-page position-relative">
    <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 10;" />

    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar
            :color="sale.document_type === 'quote' ? 'info' : (sale.document_type === 'invoice' ? 'primary' : 'success')"
            variant="tonal" rounded="lg" size="44" class="elevation-1">
            <VIcon
              :icon="sale.document_type === 'quote' ? 'ri-file-list-3-line' : (sale.document_type === 'invoice' ? 'ri-bill-line' : 'ri-file-text-line')"
              size="24" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                {{ sale.document_type === 'quote' ? 'Editar Cotización' : 'Editar Documento' }}
              </h1>
              <VChip v-if="sale.document_number" color="secondary" size="small" variant="tonal"
                class="font-weight-bold font-mono">
                #{{ sale.document_number }}
              </VChip>
              <VChip v-if="sale.status === 'draft'" color="warning" size="small" variant="tonal"
                class="font-weight-bold" prepend-icon="ri-file-draft-line">
                Borrador
              </VChip>
              <VChip v-else-if="sale.status === 'canceled'" color="error" size="small" variant="flat"
                class="font-weight-bold">
                ANULADA
              </VChip>
              <VChip v-else-if="isAuthorizedInvoice" color="primary" size="small" variant="tonal"
                class="font-weight-bold" prepend-icon="ri-shield-check-line">
                SRI Autorizada
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Actualiza los datos del documento comercial, ítems o condiciones de pago
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-arrow-left-line" class="font-weight-medium"
            :disabled="isProcessing" :to="sale.document_type === 'quote' ? '/quotes/list' : '/sales/list'">
            Volver al Listado
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

    <!-- Alerta de Factura Autorizada -->
    <VAlert v-if="isAuthorizedInvoice" type="info" variant="tonal" class="mb-6 rounded-xl border-info border-2"
      icon="ri-shield-check-line">
      <div class="text-subtitle-1 font-weight-bold text-info">
        Factura Electrónica Autorizada por el SRI
      </div>
      <div class="text-body-2">
        Esta factura ya fue autorizada por el Servicio de Rentas Internas (SRI) y cuenta con validez tributaria oficial.
        Por normativa legal, no se pueden realizar modificaciones sobre este documento.
      </div>
    </VAlert>

    <!-- Formulario Principal -->
    <VForm v-else ref="formRef" :disabled="isProcessing" @submit.prevent="submitForm">
      <VRow>
        <!-- Columna Izquierda (8 cols): Comprobante, Cliente y Productos/Servicios -->
        <VCol cols="12" lg="8">
          <!-- Tarjeta 1: Comprobante y Cliente -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                    <VIcon icon="ri-file-list-3-line" size="20" />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                      {{ sale.document_type === 'quote' ? 'Información de Cotización' : 'Comprobante & Cliente' }}
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Datos del documento comercial y beneficiario
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <!-- Selector Unido cuando el original es Nota de Venta -->
              <div v-if="originalDocumentType === 'sale_note'" class="mb-5">
                <label class="text-caption font-weight-bold text-slate-800 mb-2 d-block">Tipo de Comprobante</label>
                <div class="doc-type-united-group rounded-xl d-flex flex-column flex-md-row">
                  <!-- Opción Nota de Venta -->
                  <div
                    class="doc-type-united-item rounded-lg pa-3 px-4 cursor-pointer d-flex align-center justify-space-between"
                    :class="sale.document_type === 'sale_note' ? 'doc-type-selected-success' : 'doc-type-unselected'"
                    @click="sale.document_type = 'sale_note'; onDocumentTypeChange()">
                    <div class="d-flex align-center gap-3">
                      <VAvatar :color="sale.document_type === 'sale_note' ? 'success' : 'grey-lighten-3'"
                        :variant="sale.document_type === 'sale_note' ? 'flat' : 'tonal'" size="40"
                        class="transition-all">
                        <VIcon icon="ri-file-text-line" size="22"
                          :color="sale.document_type === 'sale_note' ? 'white' : 'grey-darken-1'" />
                      </VAvatar>
                      <div>
                        <div class="text-body-2 font-weight-bold"
                          :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey-darken-3'">
                          Nota de Venta
                        </div>
                        <div class="text-caption text-medium-emphasis" style="font-size: 0.75rem;">
                          Comprobante comercial actual
                        </div>
                      </div>
                    </div>
                    <div class="d-flex align-center gap-2">
                      <VChip size="x-small" :color="sale.document_type === 'sale_note' ? 'success' : 'grey'"
                        :variant="sale.document_type === 'sale_note' ? 'tonal' : 'outlined'" class="font-weight-bold">
                        Actual
                      </VChip>
                      <VIcon
                        :icon="sale.document_type === 'sale_note' ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                        size="20" :color="sale.document_type === 'sale_note' ? 'success' : 'grey-lighten-1'" />
                    </div>
                  </div>

                  <!-- Opción Factura -->
                  <div
                    class="doc-type-united-item rounded-lg pa-3 px-4 cursor-pointer d-flex align-center justify-space-between"
                    :class="sale.document_type === 'invoice' ? 'doc-type-selected-primary' : 'doc-type-unselected'"
                    @click="sale.document_type = 'invoice'; onDocumentTypeChange()">
                    <div class="d-flex align-center gap-3">
                      <VAvatar :color="sale.document_type === 'invoice' ? 'primary' : 'grey-lighten-3'"
                        :variant="sale.document_type === 'invoice' ? 'flat' : 'tonal'" size="40" class="transition-all">
                        <VIcon icon="ri-bill-line" size="22"
                          :color="sale.document_type === 'invoice' ? 'white' : 'grey-darken-1'" />
                      </VAvatar>
                      <div>
                        <div class="text-body-2 font-weight-bold"
                          :class="sale.document_type === 'invoice' ? 'text-primary' : 'text-grey-darken-3'">
                          Factura Electrónica
                        </div>
                        <div class="text-caption text-medium-emphasis" style="font-size: 0.75rem;">
                          Convertir y autorizar con el SRI
                        </div>
                      </div>
                    </div>
                    <div class="d-flex align-center gap-2">
                      <VChip size="x-small" :color="sale.document_type === 'invoice' ? 'primary' : 'grey'"
                        :variant="sale.document_type === 'invoice' ? 'tonal' : 'outlined'" class="font-weight-bold">
                        SRI Oficial
                      </VChip>
                      <VIcon
                        :icon="sale.document_type === 'invoice' ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                        size="20" :color="sale.document_type === 'invoice' ? 'primary' : 'grey-lighten-1'" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Selector cuando el original es Cotización -->
              <VRow v-else-if="originalDocumentType === 'quote'" class="mb-4">
                <VCol cols="12" sm="4">
                  <VCard :disabled="sale.status === 'canceled'"
                    :class="sale.document_type === 'quote' ? 'border-primary border-2 bg-primary-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-xl elevation-0" variant="outlined"
                    @click="sale.document_type = 'quote'; onDocumentTypeChange()">
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar :color="sale.document_type === 'quote' ? 'primary' : 'grey-lighten-2'" size="36">
                        <VIcon icon="ri-file-text-line" :color="sale.document_type === 'quote' ? 'white' : 'grey'"
                          size="18" />
                      </VAvatar>
                      <div>
                        <div class="font-weight-bold text-body-2"
                          :class="sale.document_type === 'quote' ? 'text-primary' : 'text-grey'">
                          Cotización
                        </div>
                        <div class="text-caption text-medium-emphasis" style="font-size: 0.72rem;">
                          Presupuesto
                        </div>
                      </div>
                    </div>
                  </VCard>
                </VCol>

                <VCol cols="12" sm="4">
                  <VCard :disabled="sale.status === 'canceled'"
                    :class="sale.document_type === 'sale_note' ? 'border-success border-2 bg-success-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-xl elevation-0" variant="outlined"
                    @click="sale.document_type = 'sale_note'; onDocumentTypeChange()">
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar :color="sale.document_type === 'sale_note' ? 'success' : 'grey-lighten-2'" size="36">
                        <VIcon icon="ri-file-list-3-line" :color="sale.document_type === 'sale_note' ? 'white' : 'grey'"
                          size="18" />
                      </VAvatar>
                      <div>
                        <div class="font-weight-bold text-body-2"
                          :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey'">
                          Nota de Venta
                        </div>
                        <div class="text-caption text-medium-emphasis" style="font-size: 0.72rem;">
                          Venta comercial
                        </div>
                      </div>
                    </div>
                  </VCard>
                </VCol>

                <VCol cols="12" sm="4">
                  <VCard :disabled="sale.status === 'canceled'"
                    :class="sale.document_type === 'invoice' ? 'border-primary border-2 bg-primary-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-xl elevation-0" variant="outlined"
                    @click="sale.document_type = 'invoice'; onDocumentTypeChange()">
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar :color="sale.document_type === 'invoice' ? 'primary' : 'grey-lighten-2'" size="36">
                        <VIcon icon="ri-bill-line" :color="sale.document_type === 'invoice' ? 'white' : 'grey'"
                          size="18" />
                      </VAvatar>
                      <div>
                        <div class="font-weight-bold text-body-2"
                          :class="sale.document_type === 'invoice' ? 'text-primary' : 'text-grey'">
                          Factura
                        </div>
                        <div class="text-caption text-medium-emphasis" style="font-size: 0.72rem;">
                          Oficial SRI
                        </div>
                      </div>
                    </div>
                  </VCard>
                </VCol>
              </VRow>

              <!-- Fila 1: Número de documento y Fecha -->
              <VRow>
                <VCol cols="12" sm="6">
                  <VTextField v-model="sale.document_number" label="Número de Documento *" :rules="[requiredRule]"
                    variant="outlined" density="comfortable" prepend-inner-icon="ri-hashtag" hide-details="auto"
                    required color="primary" :loading="isDocumentNumberLoading" />
                </VCol>
                <VCol cols="12" sm="6">
                  <VTextField v-model="sale.service_date" :disabled="sale.status === 'canceled'"
                    label="Fecha de Servicio *" type="date" :rules="[requiredRule]" variant="outlined"
                    density="comfortable" prepend-inner-icon="ri-calendar-line" hide-details="auto" required
                    color="primary" />
                </VCol>

                <!-- Fila 2: Cliente y Vehículo -->
                <VCol cols="12" sm="6">
                  <VSearch v-model="selectedClient" :disabled="sale.status === 'canceled'" :return-object="true"
                    endpoint="clients/search" item-title="full_name" label="Cliente *" icon="ri-user-line"
                    :initial-item="selectedClient" :rules="[(v) => !!sale.client_id || 'Cliente es requerido']">
                    <template #item="{ props, item }">
                      <VListItem v-bind="props" :title="item.raw.full_name || item.raw.name">
                        <VListItemSubtitle v-if="item.raw.n_document" class="mt-1 text-grey">
                          Documento: {{ item.raw.n_document }}
                        </VListItemSubtitle>
                      </VListItem>
                    </template>
                  </VSearch>
                </VCol>

                <VCol cols="12" sm="6">
                  <div style="text-transform: uppercase;">
                    <VSearch v-model="selectedVehicle" :disabled="sale.status === 'canceled'" :return-object="true"
                      endpoint="vehicles/search" item-title="license_plate"
                      label="Vehículo (Opcional)"
                      icon="ri-car-line" :initial-item="selectedVehicle">
                      <template #item="{ props, item }">
                        <VListItem v-bind="props" :title="item.raw.license_plate">
                          <VListItemSubtitle class="mt-1 text-grey">
                            <span>{{ getBrandNameById(item.raw.brand?.name || item.raw.brand || item.raw.brand_id) }} {{
                              item.raw.model || '' }}</span>
                            <span v-if="item.raw.color" class="ms-1">• Color: {{ item.raw.color }}</span>
                            <span v-if="item.raw.client" class="text-primary font-weight-medium ms-2">
                              • Propietario: {{ item.raw.client.full_name || (item.raw.client.name + ' ' +
                                (item.raw.client.surname || '')) }}
                            </span>
                          </VListItemSubtitle>
                        </VListItem>
                      </template>
                    </VSearch>
                  </div>
                </VCol>

                <!-- Panel Unificado y Elegante de Resumen Cliente / Vehículo (Sin redundancia) -->
                <VCol v-if="selectedClient || selectedVehicle" cols="12" class="pt-0">
                  <div class="rounded-xl border bg-slate-50 pa-3 pa-sm-4">
                    <VRow dense class="align-center">
                      <!-- Datos del Cliente -->
                      <VCol cols="12" :sm="selectedVehicle ? 6 : 12" class="d-flex align-center gap-3">
                        <template v-if="selectedClient">
                          <VAvatar color="primary" variant="tonal" size="38" class="rounded-lg shrink-0">
                            <VIcon icon="ri-id-card-line" size="20" />
                          </VAvatar>
                          <div class="d-flex flex-column overflow-hidden flex-grow-1">
                            <div class="d-flex align-center gap-2 flex-wrap">
                              <span class="font-mono font-weight-bold text-slate-800 text-body-2">
                                {{ selectedClient.n_document || 'Sin Documento' }}
                              </span>
                              <span v-if="selectedClient.type_client" class="text-caption text-medium-emphasis">
                                • {{ selectedClient.type_client == 2 ? 'Empresa' : 'Persona Natural' }}
                              </span>
                            </div>
                            <div class="d-flex align-center gap-3 mt-0.5 text-caption text-medium-emphasis flex-wrap">
                              <span v-if="selectedClient.phone" class="d-flex align-center gap-1">
                                <VIcon icon="ri-phone-line" size="13" /> {{ selectedClient.phone }}
                              </span>
                              <span v-if="selectedClient.email" class="d-flex align-center gap-1 text-truncate">
                                <VIcon icon="ri-mail-line" size="13" /> {{ selectedClient.email }}
                              </span>
                              <span v-if="selectedClient.address" class="d-flex align-center gap-1 text-truncate">
                                <VIcon icon="ri-map-pin-line" size="13" /> {{ selectedClient.address }}
                              </span>
                            </div>
                          </div>
                        </template>
                        <template v-else>
                          <div class="text-caption text-medium-emphasis font-italic">
                            Seleccione un cliente para ver sus datos
                          </div>
                        </template>
                      </VCol>

                      <!-- Datos del Vehículo -->
                      <VCol v-if="selectedVehicle" cols="12" :sm="selectedClient ? 6 : 12"
                        :class="[selectedClient ? 'border-s-sm ps-sm-4 mt-2 mt-sm-0' : '', 'd-flex align-center gap-3']">
                        <VAvatar color="secondary" variant="tonal" size="38" class="rounded-lg shrink-0">
                          <VIcon icon="ri-car-line" size="20" color="secondary" />
                        </VAvatar>
                        <div class="d-flex flex-column flex-grow-1 overflow-hidden">
                          <div class="d-flex align-center gap-2 flex-wrap">
                            <span class="font-mono font-weight-bold text-slate-800 text-body-2">
                              {{ selectedVehicle.license_plate }}
                            </span>
                            <span class="text-body-2 text-slate-700 font-weight-medium text-truncate">
                              • {{ getVehicleBrandModel(selectedVehicle) }}
                            </span>
                            <span v-if="selectedVehicle.color" class="text-caption text-slate-500">
                              • {{ selectedVehicle.color }}
                            </span>
                            <span
                              v-if="selectedVehicle.year && !getVehicleBrandModel(selectedVehicle).includes(selectedVehicle.year)"
                              class="text-caption text-slate-500">
                              ({{ selectedVehicle.year }})
                            </span>
                          </div>

                          <!-- Dueño diferente del cliente asignado -->
                          <div v-if="isVehicleOwnerDifferentFromClient"
                            class="d-flex align-center justify-space-between gap-2 mt-1 px-2 py-0.5 rounded border border-warning bg-amber-50">
                            <span class="text-caption text-amber-900 text-truncate" style="font-size: 0.75rem;">
                              <VIcon icon="ri-user-shared-line" size="13" color="warning" class="me-1" />
                              Dueño: <strong>{{ getVehicleOwnerName || 'Otro cliente' }}</strong>
                            </span>
                            <VBtn size="x-small" variant="text" color="warning" density="compact"
                              class="font-weight-bold text-none px-1" @click="setClientToVehicleOwner">
                              Asignar
                            </VBtn>
                          </div>
                        </div>
                      </VCol>
                    </VRow>
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
                      Kilometraje y asignación técnica
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5 bg-white">
              <VRow>
                <VCol cols="12" sm="6">
                  <label class="text-caption font-weight-bold text-slate-800 mb-1 d-block">Kilometraje</label>
                  <VTextField v-model="sale.mileage" :disabled="sale.status === 'canceled'" placeholder="Ej: 45000"
                    type="number" variant="outlined" density="comfortable" prepend-inner-icon="ri-dashboard-3-line"
                    hide-details="auto" color="primary" />
                </VCol>
                <VCol cols="12" sm="6">
                  <label class="text-caption font-weight-bold text-slate-800 mb-1 d-block">Técnicos</label>
                  <VAutocomplete v-model="sale.technicians" :disabled="sale.status === 'canceled'" :items="employees"
                    :item-title="item => `${item.first_name} ${item.last_name}${item.position ? ' - ' + item.position : ''}`"
                    item-value="id" placeholder="Seleccionar técnicos..." prepend-inner-icon="ri-user-settings-line"
                    variant="outlined" density="comfortable" clearable multiple chips class="fix-notch-bug">
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
                        Agrega los ítems a la venta o cotización
                      </p>
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <VBtn :disabled="sale.status === 'canceled'" size="small" color="primary" variant="tonal"
                      prepend-icon="ri-box-3-line" class="font-weight-semibold" @click="addTemporaryProduct">
                      Producto Temporal
                    </VBtn>
                    <VBtn :disabled="sale.status === 'canceled'" size="small" color="info" variant="tonal"
                      prepend-icon="ri-tools-line" class="font-weight-semibold"
                      @click="isAddServiceDialogVisible = true">
                      Servicio Express
                    </VBtn>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <!-- Cuadro de búsqueda de productos -->
              <div class="mb-4">
                <VSearch v-model="searchProduct" :disabled="sale.status === 'canceled'" endpoint="products/search"
                  item-title="description" :return-object="true"
                  label="Buscar y agregar producto por nombre, código o SKU..." icon="ri-search-line" class="mb-0"
                  hide-details @change="onProductSelected">
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
              <div v-if="sale.items.length > 0" class="rounded-xl border overflow-hidden">
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
                    <tr v-for="(item, index) in sale.items" :key="index" class="hover-row">
                      <td>
                        <div class="d-flex align-center gap-3 py-1">
                          <VAvatar size="36" :color="item.type === 'service' ? 'info' : 'primary'" variant="tonal"
                            class="rounded-lg">
                            <VIcon :icon="item.type === 'service' ? 'ri-tools-line' : 'ri-box-3-line'" size="18" />
                          </VAvatar>
                          <div class="flex-grow-1">
                            <VTextField v-model="item.description" :disabled="sale.status === 'canceled'"
                              density="compact" variant="plain" hide-details placeholder="Descripción del ítem..."
                              class="font-weight-bold text-slate-900" />
                            <div class="text-caption text-medium-emphasis mt-1 d-flex align-center gap-2">
                              <span class="text-uppercase font-weight-bold"
                                :class="isServiceItem(item) ? 'text-primary' : 'text-secondary'"
                                style="font-size: 0.65rem;">
                                {{ isServiceItem(item) ? 'Servicio' : 'Producto' }}
                              </span>
                              <span v-if="!isServiceItem(item) && sale.document_type !== 'quote'" class="stock-tag"
                                :class="{ 'stock-low': item.quantity > getProductStock(item.product_id, item) }">
                                <VIcon icon="ri-stack-line" size="12" class="mr-1" />
                                {{ getProductStock(item.product_id, item) }} en stock
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="text-center">
                        <div class="d-inline-flex align-center qty-selector">
                          <VBtn icon="ri-subtract-line" variant="text" color="primary"
                            :disabled="item.quantity <= 1 || sale.status === 'canceled'" class="qty-btn" size="small"
                            @click="item.quantity--" />
                          <input v-model.number="item.quantity" type="number" min="1" max="99"
                            :disabled="sale.status === 'canceled'" class="qty-input font-mono font-weight-bold"
                            @input="item.quantity > 99 ? item.quantity = 99 : null"
                            @blur="(!item.quantity || item.quantity < 1) ? item.quantity = 1 : null">
                          <VBtn icon="ri-add-line" variant="text" color="primary"
                            :disabled="item.quantity >= 99 || sale.status === 'canceled'" class="qty-btn" size="small"
                            @click="item.quantity < 99 ? item.quantity++ : null" />
                        </div>
                      </td>
                      <td>
                        <VTextField v-model.number="item.price" :disabled="sale.status === 'canceled'" type="number"
                          density="compact" variant="plain" hide-details min="0" step="0.01" prefix="$"
                          :rules="[requiredRule, positiveNumberRule]"
                          class="font-weight-bold text-slate-800 font-mono" />
                      </td>
                      <td>
                        <VTextField v-model.number="item.discount" :disabled="sale.status === 'canceled'" type="number"
                          density="compact" variant="plain" hide-details min="0" step="0.01" prefix="$"
                          class="font-weight-medium text-error font-mono" />
                      </td>
                      <td class="text-center">
                        <span class="text-body-1 font-weight-black text-success font-mono">
                          ${{ ((item.quantity * item.price) - item.discount).toFixed(2) }}
                        </span>
                      </td>
                      <td class="text-center">
                        <VBtn :disabled="sale.status === 'canceled'" icon="ri-delete-bin-line" size="small"
                          color="error" variant="text" class="delete-btn" @click="removeItem(index)" />
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>

              <!-- Estado Vacío -->
              <div v-else class="text-center pa-10 rounded-xl bg-slate-50 border border-dashed">
                <VAvatar color="primary" variant="tonal" size="64" class="mb-3">
                  <VIcon icon="ri-shopping-cart-line" size="32" />
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

        <!-- Columna Derecha (4 cols): Pagos, Observaciones y Resumen Financiero -->
        <VCol cols="12" lg="4">
          <div class="d-flex flex-column gap-6">
            <!-- Tarjeta 4: Configuración de Pagos (si no es cotización) -->
            <VCard v-if="sale.document_type !== 'quote'" class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="success" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-wallet-3-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Configuración de Pagos
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Método y distribución del pago
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>

              <VCardText class="pa-4 bg-white d-flex flex-column gap-4">
                <div>
                  <label class="text-caption font-weight-bold text-slate-800 mb-1 d-block">Estado del Pago</label>
                  <VSelect v-model="sale.payment_status" :disabled="sale.status === 'canceled'" :items="paymentStatuses"
                    item-title="title" item-value="value" placeholder="Seleccionar estado" :rules="[requiredRule]"
                    variant="outlined" density="comfortable" prepend-inner-icon="ri-flag-line" hide-details="auto" />
                </div>

                <VCard variant="tonal" color="primary" class="pa-3 rounded-xl cursor-pointer border"
                  :class="sale.is_credited ? 'border-primary border' : 'opacity-80'" @click="onCreditChange">
                  <div class="d-flex align-center gap-3">
                    <VIcon :icon="sale.is_credited ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                      size="22" />
                    <div>
                      <div class="text-body-2 font-weight-bold">
                        Venta a crédito
                      </div>
                      <div class="text-caption text-medium-emphasis" style="font-size: 0.72rem;">
                        Pago diferido sin abono inmediato
                      </div>
                    </div>
                  </div>
                </VCard>

                <!-- Distribución de Pagos -->
                <div>
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="text-caption font-weight-bold text-slate-800">Distribución de Pagos:</span>
                    <VBtn v-if="sale.payment_status !== 'pending' && sale.status !== 'canceled'" color="primary"
                      variant="text" size="x-small" prepend-icon="ri-add-line" class="font-weight-bold"
                      @click="addPaymentDistribution">
                      Agregar Pago
                    </VBtn>
                  </div>

                  <!-- Mensaje Informativo cuando el pago está Pendiente -->
                  <VAlert v-if="sale.payment_status === 'pending'" type="warning" variant="tonal" density="compact"
                    class="rounded-lg mb-2 text-caption" icon="ri-time-line">
                    La venta se registrará como pago pendiente / crédito.
                  </VAlert>

                  <template v-else>
                    <div v-for="(dist, index) in paymentDistributions" :key="index" class="pa-3 mb-3 border rounded-xl"
                      :class="!dist.payment_method ? 'bg-amber-50/40 border-warning' : (dist.payment_method === 'Transferencia' ? 'bg-blue-50/20 border-info' : 'bg-emerald-50/20 border-success')">
                      <div class="d-flex justify-space-between align-center mb-2">
                        <div class="d-flex align-center gap-2">
                          <span class="text-caption font-weight-bold text-slate-800">Pago #{{ index + 1 }}</span>
                          <VChip v-if="dist.payment_method" size="x-small"
                            :color="dist.payment_method === 'Efectivo' ? 'success' : (dist.payment_method === 'Transferencia' ? 'info' : 'primary')"
                            variant="tonal" class="font-weight-bold">
                            {{ dist.payment_method }}
                          </VChip>
                          <VChip v-else size="x-small" color="warning" variant="flat" class="font-weight-bold">
                            ⚠️ Sin método seleccionado
                          </VChip>
                        </div>
                        <VIcon v-if="paymentDistributions.length > 1 && sale.status !== 'canceled'" icon="ri-close-line"
                          color="error" class="cursor-pointer" size="18" @click="removePaymentDistribution(index)" />
                      </div>

                      <!-- Botones de selección rápida y clara -->
                      <div class="mb-2">
                        <label class="text-caption font-weight-bold text-slate-700 mb-1 d-block">
                          Tipo de Pago <span class="text-error">*</span>
                        </label>
                        <div class="d-flex gap-2 mb-1">
                          <VBtn size="small" :disabled="sale.status === 'canceled'"
                            :variant="dist.payment_method === 'Efectivo' ? 'elevated' : 'outlined'"
                            :color="dist.payment_method === 'Efectivo' ? 'success' : 'secondary'"
                            prepend-icon="ri-money-dollar-circle-line"
                            class="flex-grow-1 font-weight-bold text-caption rounded-lg"
                            @click="onPaymentMethodChange(dist, 'Efectivo')">
                            Efectivo
                          </VBtn>
                          <VBtn size="small" :disabled="sale.status === 'canceled'"
                            :variant="dist.payment_method === 'Transferencia' ? 'elevated' : 'outlined'"
                            :color="dist.payment_method === 'Transferencia' ? 'info' : 'secondary'"
                            prepend-icon="ri-bank-line" class="flex-grow-1 font-weight-bold text-caption rounded-lg"
                            @click="onPaymentMethodChange(dist, 'Transferencia')">
                            Transferencia
                          </VBtn>
                        </div>
                      </div>

                      <div class="d-flex flex-column gap-2">
                        <!-- Dropdown para otros métodos si se necesita -->
                        <VSelect
                          v-if="dist.payment_method && dist.payment_method !== 'Efectivo' && dist.payment_method !== 'Transferencia'"
                          v-model="dist.payment_method" :disabled="sale.status === 'canceled'" :items="paymentMethods"
                          item-title="title" item-value="value" label="Forma de Pago *" variant="outlined"
                          density="compact" hide-details="auto"
                          @update:model-value="(val) => onPaymentMethodChange(dist, val)" />

                        <!-- Si es transferencia, selector obligatorio de cuenta bancaria -->
                        <div v-if="dist.payment_method === 'Transferencia'">
                          <VSelect v-model="dist.account_id" :disabled="sale.status === 'canceled'" :items="accounts"
                            item-title="name" item-value="id" label="Cuenta Bancaria Destino *"
                            placeholder="Seleccione banco de destino..." variant="outlined" density="compact"
                            color="info" prepend-inner-icon="ri-bank-line" :rules="[requiredRule]"
                            hide-details="auto" />
                        </div>

                        <!-- Si es efectivo, confirmación de caja chica -->
                        <div v-else-if="dist.payment_method === 'Efectivo'"
                          class="text-caption text-success font-weight-medium d-flex align-center gap-1">
                          <VIcon icon="ri-checkbox-circle-fill" size="15" color="success" /> Ingresa a Caja Chica
                          (Efectivo)
                        </div>

                        <!-- Si no ha seleccionado ningún método, alerta visual -->
                        <div v-else class="text-caption text-warning font-weight-bold d-flex align-center gap-1">
                          <VIcon icon="ri-alert-fill" size="15" color="warning" /> Debe elegir Efectivo o Transferencia
                        </div>

                        <!-- Monto -->
                        <VTextField v-model.number="dist.amount" :disabled="sale.status === 'canceled'" type="number"
                          min="0" step="0.01" label="Monto *" variant="outlined" density="compact" hide-details="auto"
                          prefix="$" class="font-mono font-weight-bold" @input="handlePaymentAmountChange(dist, index)"
                          @blur="handlePaymentAmountChange(dist, index)" />
                      </div>
                    </div>

                    <div v-if="paymentDistributions.length > 0" class="mt-2 text-caption text-right font-weight-bold">
                      <div :class="remainingAmount < -0.01 ? 'text-error' : 'text-success'">
                        Falta distribuir: ${{ remainingAmount.toFixed(2) }}
                      </div>
                    </div>
                  </template>
                </div>
              </VCardText>
            </VCard>

            <!-- Tarjeta 5: Observaciones y Notas -->
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="secondary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-file-text-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Observaciones y Notas
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Detalles adicionales del documento
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>
              <VCardText class="pa-4 bg-white">
                <VTextarea v-model="sale.observations" :disabled="sale.status === 'canceled'"
                  placeholder="Notas o términos y condiciones adicionales..." variant="outlined" rows="3"
                  density="comfortable" hide-details="auto" color="primary" />
              </VCardText>
            </VCard>

            <!-- Tarjeta 6: Resumen Financiero & Acciones -->
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-calculator-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Resumen Financiero
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        {{ sale.items.length }} {{ sale.items.length === 1 ? 'ítem agregado' : 'ítems agregados' }}
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>

              <VCardText class="pa-4 bg-white d-flex flex-column gap-3">
                <div class="d-flex justify-space-between align-center text-body-2">
                  <span class="text-medium-emphasis font-weight-medium">Subtotal Bruto:</span>
                  <span class="font-mono font-weight-bold">${{ grossSubtotal.toFixed(2) }}</span>
                </div>
                <div v-if="totalDiscount > 0" class="d-flex justify-space-between align-center text-body-2 text-error">
                  <span class="font-weight-medium">Descuento:</span>
                  <span class="font-mono font-weight-bold">-${{ totalDiscount.toFixed(2) }}</span>
                </div>
                <div class="d-flex justify-space-between align-center text-body-2">
                  <span class="text-medium-emphasis font-weight-medium">Base Imponible:</span>
                  <span class="font-mono font-weight-bold">${{ subtotal.toFixed(2) }}</span>
                </div>
                <div v-if="sale.document_type === 'invoice'"
                  class="d-flex justify-space-between align-center text-body-2">
                  <span class="text-medium-emphasis font-weight-medium">IVA (15%):</span>
                  <span class="font-mono font-weight-bold">${{ taxAmount.toFixed(2) }}</span>
                </div>

                <div class="d-flex justify-space-between align-center pa-3 rounded-xl bg-slate-50 border mt-1">
                  <div>
                    <div class="text-caption font-weight-bold text-slate-500 text-uppercase">
                      {{ sale.document_type === 'quote' ? 'Total Cotizado' : 'Total a Pagar' }}
                    </div>
                    <div class="text-h4 font-weight-black text-primary font-mono mt-0.5">
                      ${{ total.toFixed(2) }}
                    </div>
                  </div>
                  <VAvatar color="primary" variant="tonal" size="44" class="rounded-xl">
                    <VIcon icon="ri-wallet-3-line" size="24" />
                  </VAvatar>
                </div>

                <VAlert v-if="canConvertToSale" type="warning" variant="tonal" density="compact"
                  class="rounded-lg text-caption font-weight-medium mt-1">
                  <strong>Esta es una cotización</strong>. Puedes convertirla a venta cambiando el tipo de comprobante.
                </VAlert>
              </VCardText>

              <VDivider />

              <VCardActions class="pa-4 bg-slate-50 d-flex flex-column gap-2">
                <!-- Alerta de Validación encima del botón de guardar -->
                <VAlert v-if="showValidationError" color="error" variant="tonal" class="w-100 mb-2 rounded-lg"
                  border="start" closable @click:close="showValidationError = false">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-error-warning-line" class="mr-2" size="20" />
                    <span class="text-caption font-weight-bold">{{ validationErrorMessage }}</span>
                  </div>
                </VAlert>

                <VBtn block type="submit" :disabled="sale.status === 'canceled' || isProcessing" color="primary"
                  variant="elevated" size="large" prepend-icon="ri-save-3-line" class="font-weight-bold elevation-2"
                  :loading="loader.loading && !isDispatching">
                  {{ sale.status === 'draft' ? 'FINALIZAR VENTA' : 'GUARDAR CAMBIOS' }}
                </VBtn>

                <VBtn v-if="sale.document_type !== 'quote'" block color="warning" variant="tonal"
                  prepend-icon="ri-truck-line" class="font-weight-semibold" :loading="isDispatching"
                  :disabled="isProcessing" @click.prevent="dispatchSale">
                  Despachar (Pago Pendiente)
                </VBtn>

                <div class="d-flex gap-2 w-100">
                  <VBtn v-if="sale.status === 'draft' && sale.document_type !== 'quote'" color="secondary"
                    variant="tonal" prepend-icon="ri-file-draft-line" class="font-weight-semibold flex-grow-1"
                    :loading="loader.loading && !isDispatching" :disabled="isProcessing" @click.prevent="saveDraft">
                    Actualizar Borrador
                  </VBtn>
                  <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line" class="font-weight-medium"
                    :class="{ 'flex-grow-1': !(sale.status === 'draft' && sale.document_type !== 'quote') }"
                    :disabled="isProcessing"
                    @click="router.push(sale.document_type === 'quote' ? '/quotes/list' : '/sales/list')">
                    Cancelar
                  </VBtn>
                </div>
              </VCardActions>
            </VCard>
          </div>
        </VCol>
      </VRow>
    </VForm>
    <AddServiceDialog :is-dialog-visible="isAddServiceDialogVisible"
      @update:is-dialog-visible="isAddServiceDialogVisible = $event" @service-added="handleServiceAdded" />
  </div>
</template>
