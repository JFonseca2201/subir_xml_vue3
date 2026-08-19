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
  payment_method: 'Efectivo',
  observations: '',
  technicians: [],
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
  } else {
    sale.value.payment_status = 'paid'
  }
}

// Watch para regenerar número cuando cambia el tipo de documento
const onDocumentTypeChange = async () => {
  // Si el documento original no era una cotización (es decir, era venta o factura),
  // no se permite cambiar a ningún otro tipo.
  if (originalDocumentType.value !== 'quote' && sale.value.document_type !== originalDocumentType.value) {
    showNotification('Solo las cotizaciones pueden convertirse a ventas', 'warning')
    sale.value.document_type = originalDocumentType.value
    
    return
  }

  // Si el original es cotización y el usuario selecciona venta o factura:
  if (originalDocumentType.value === 'quote' && sale.value.document_type !== 'quote') {
    // Si el número actual todavía empieza con COT- o coincide con el original, obtenemos el nuevo número
    if (sale.value.document_number.toUpperCase().startsWith('COT-') || sale.value.document_number === originalDocumentNumber.value) {
      isDocumentNumberLoading.value = true
      try {
        const response = await $api('work-orders/next-number')
        if (response && response.data) {
          sale.value.document_number = response.data
        }
      } catch (error) {
        console.error('Error al obtener el siguiente número OT:', error)
      } finally {
        isDocumentNumberLoading.value = false
      }
    }

    // Establecer la fecha actual por defecto al cambiar a venta
    const tzOffset = (new Date()).getTimezoneOffset() * 60000

    sale.value.service_date = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  } else if (originalDocumentType.value === 'quote' && sale.value.document_type === 'quote') {
    // Si vuelve a seleccionar cotización, restauramos el número original y la fecha original
    sale.value.document_number = originalDocumentNumber.value
    sale.value.service_date = originalServiceDate.value
  }
}

// Inicializar con un pago distribuido cuando hay items
const initializePaymentDistribution = () => {
  if (paymentDistributions.value.length === 0 && sale.value.items.length > 0) {
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))

    paymentDistributions.value.push({
      account_id: cajaChica ? cajaChica.id : null,
      amount: 0,
      payment_method: 'Efectivo',
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
  if (paymentDistributions.value.length > 1) {
    paymentDistributions.value.splice(index, 1)
  }
}

// Asignar cuenta automáticamente según método de pago
const onPaymentMethodChange = (dist, newMethod) => {
  if (newMethod === 'Efectivo') {
    const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))

    dist.account_id = cajaChica ? cajaChica.id : null
  } else if (newMethod === 'Transferencia') {
    dist.account_id = null
  }
}

const initializePaymentAccount = dist => {
  if (dist.payment_method === 'Efectivo') {
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
      selectedClient.value = newVal.client || newVal.client_details
    }
  } else {
    sale.value.vehicle_id = null
  }
})

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
    }

    const totalDist = paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0)

    if ((paymentDistributions.value.length === 0 || totalDist <= 0) && !sale.value.is_credited) {
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
    } else {
      sale.value.payment_status = 'pending'
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

const isDispatching = ref(false)

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
            color="primary-lighten-5"
            size="48"
            class="mr-3"
          >
            <VIcon
              icon="ri-add-line"
              size="32"
              color="primary"
            />
          </VAvatar>
          <h1 class="text-h4 font-weight-bold mb-1">
            {{ sale.document_type === 'quote' ? 'Editar Cotización' : 'Editar Documento' }}
          </h1>
          <VChip
            v-if="sale.status === 'canceled'"
            color="error"
            size="small"
            class="mt-2"
          >
            ANULADA
          </VChip>
        </div>
        <p class="text-medium-emphasis mb-0">
          Actualiza el documento
        </p>
      </div>
      <VBtn
        color="primary"
        variant="tonal"
        prepend-icon="ri-arrow-left-line"
        :to="sale.document_type === 'quote' ? '/quotes/list' : '/sales/list'"
        class="align-self-md-center align-self-end"
      >
        Volver al Listado
      </VBtn>
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
      @submit.prevent="submitForm"
    >
      <VRow>
        <VCol cols="12">
          <!-- Tipo de Documento -->
          <VCard
            v-if="false"
            class="elevation-2 mb-4"
          >
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-5">
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
                    Selecciona el tipo de comprobante comercial
                  </p>
                </div>
              </div>
              <VRow>
                <VCol
                  v-if="originalDocumentType === 'quote'"
                  cols="12"
                  md="4"
                >
                  <VCard
                    :disabled="sale.status === 'canceled'"
                    :class="sale.document_type === 'quote' ? 'border-primary border-2 bg-primary-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-lg elevation-0 hover:elevation-2 transition-all"
                    variant="outlined"
                    @click="sale.document_type = 'quote'; onDocumentTypeChange()"
                  >
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar
                        :color="sale.document_type === 'quote' ? 'primary' : 'grey-lighten-2'"
                        size="40"
                      >
                        <VIcon
                          icon="ri-file-text-line"
                          :color="sale.document_type === 'quote' ? 'white' : 'grey'"
                        />
                      </VAvatar>
                      <div>
                        <div
                          class="font-weight-bold"
                          :class="sale.document_type === 'quote' ? 'text-primary' : 'text-grey'"
                        >
                          Cotización
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          Documento de presupuesto
                        </div>
                      </div>
                    </div>
                  </VCard>
                </VCol>

                <VCol
                  cols="12"
                  :md="originalDocumentType === 'quote' ? 4 : 6"
                >
                  <VCard
                    :disabled="sale.status === 'canceled'"
                    :class="sale.document_type === 'sale_note' ? 'border-success border-2 bg-success-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-lg elevation-0 hover:elevation-2 transition-all"
                    variant="outlined"
                    @click="sale.document_type = 'sale_note'; onDocumentTypeChange()"
                  >
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar
                        :color="sale.document_type === 'sale_note' ? 'success' : 'grey-lighten-2'"
                        size="40"
                      >
                        <VIcon
                          icon="ri-file-list-3-line"
                          :color="sale.document_type === 'sale_note' ? 'white' : 'grey'"
                        />
                      </VAvatar>
                      <div>
                        <div
                          class="font-weight-bold"
                          :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey'"
                        >
                          Nota de Venta
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          Documento de venta
                        </div>
                      </div>
                    </div>
                  </VCard>
                </VCol>

                <VCol
                  cols="12"
                  :md="originalDocumentType === 'quote' ? 4 : 6"
                >
                  <VCard
                    :disabled="sale.status === 'canceled'"
                    :class="sale.document_type === 'invoice' ? 'border-red border-2 bg-red-lighten-5' : 'border-opacity-25'"
                    class="cursor-pointer rounded-lg elevation-0 hover:elevation-2 transition-all"
                    variant="outlined"
                    @click="sale.document_type = 'invoice'; onDocumentTypeChange()"
                  >
                    <div class="pa-3 d-flex align-center gap-3">
                      <VAvatar
                        :color="sale.document_type === 'invoice' ? 'red' : 'grey-lighten-2'"
                        size="40"
                      >
                        <VIcon
                          icon="ri-bill-line"
                          :color="sale.document_type === 'invoice' ? 'white' : 'grey'"
                        />
                      </VAvatar>
                      <div>
                        <div
                          class="font-weight-bold"
                          :class="sale.document_type === 'invoice' ? 'text-red' : 'text-grey'"
                        >
                          Factura
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          Documento fiscal
                        </div>
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
                    :loading="isDocumentNumberLoading"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="sale.service_date"
                    :disabled="sale.status === 'canceled'"
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
                      :disabled="sale.status === 'canceled'"
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
                      :disabled="sale.status === 'canceled'"
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
                      :disabled="sale.status === 'canceled'"
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
                      :disabled="sale.status === 'canceled'"
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
                    :disabled="sale.status === 'canceled'"
                    @click="addTemporaryProduct"
                  >
                    Producto Temporal
                  </VBtn>
                  <VBtn
                    size="small"
                    color="info"
                    variant="tonal"
                    prepend-icon="ri-add-line"
                    :disabled="sale.status === 'canceled'"
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
                  :disabled="sale.status === 'canceled'"
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
                            :disabled="item.quantity <= 1 || sale.status === 'canceled'"
                            class="qty-btn"
                            size="small"
                            @click="item.quantity--"
                          />
                          <input
                            v-model.number="item.quantity"
                            :disabled="sale.status === 'canceled'"
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
                            :disabled="item.quantity >= 99 || sale.status === 'canceled'"
                            class="qty-btn"
                            size="small"
                            @click="item.quantity < 99 ? item.quantity++ : null"
                          />
                        </div>
                      </td>
                      <td>
                        <VTextField
                          v-model.number="item.price"
                          :disabled="sale.status === 'canceled'"
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
                          :disabled="sale.status === 'canceled'"
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
                          :disabled="sale.status === 'canceled'"
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
                        {{ sale.document_type === 'quote' ? 'Total:' : 'Total a Pagar:' }}
                      </span>
                      <span class="text-h5 font-weight-black text-primary">${{ total.toFixed(2) }}</span>
                    </div>
                  </VCardText>
                </VCard>
              </div>
            </VCardText>
          </VCard>

          <!-- Pagos (Solo si no es cotización y tiene items) -->
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
                    :disabled="sale.status === 'canceled'"
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
                    :disabled="sale.status === 'canceled'"
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
                      color="primary"
                      variant="text"
                      size="small"
                      :disabled="sale.status === 'canceled'"
                      prepend-icon="ri-add-line"
                      @click="addPaymentDistribution"
                    >
                      Agregar Pago
                    </VBtn>
                  </div>

                  <div
                    v-for="(dist, index) in paymentDistributions"
                    :key="index"
                    class="pa-3 mb-2 bg-grey-lighten-5 border rounded-lg"
                  >
                    <div class="d-flex justify-space-between mb-2">
                      <span class="text-caption font-weight-bold">Pago #{{ index + 1 }}</span>
                      <VIcon
                        v-if="paymentDistributions.length > 1 && sale.status !== 'canceled'"
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
                          :disabled="sale.status === 'canceled'"
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
                          :disabled="sale.status === 'canceled'"
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
                          :disabled="sale.status === 'canceled'"
                          type="number"
                          min="0"
                          step="0.01"
                          label="Monto"
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                          prefix="$"
                        />
                      </VCol>
                    </VRow>
                  </div>

                  <div
                    v-if="paymentDistributions.length > 0"
                    class="mt-3 text-subtitle-2 text-right"
                  >
                    <div :class="remainingAmount < 0 ? 'text-error' : 'text-success'">
                      Falta distribuir: ${{
                        remainingAmount.toFixed(2) }}
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <VAlert
            v-if="sale.document_type !== 'quote' && sale.items.length === 0"
            type="info"
            variant="tonal"
            class="mb-4"
          >
            Agrega productos para configurar pagos.
          </VAlert>

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
                :disabled="sale.status === 'canceled'"
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
            v-if="canConvertToSale"
            type="warning"
            variant="tonal"
            class="mb-4"
            border="start"
          >
            <template #prepend>
              <VIcon icon="ri-exclamation-line" />
            </template>
            <div class="text-body-2">
              <strong>Esta es una cotización</strong>. Puedes convertirla en una venta cambiando
              el tipo de
              documento.
            </div>
          </VAlert>
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
              <div class="d-flex justify-end gap-3">
                <VBtn
                  color="grey"
                  variant="outlined"
                  prepend-icon="ri-close-line"
                  @click="router.push(sale.document_type === 'quote' ? '/quotes/list' : '/sales/list')"
                >
                  Cancelar
                </VBtn>
                <VBtn
                  v-if="sale.status === 'draft' && sale.document_type !== 'quote'"
                  color="secondary"
                  variant="elevated"
                  prepend-icon="ri-draft-line"
                  :loading="loader.loading"
                  @click.prevent="saveDraft"
                >
                  Actualizar Borrador
                </VBtn>
                <VBtn
                  v-if="sale.document_type !== 'quote'"
                  color="warning"
                  variant="elevated"
                  prepend-icon="ri-truck-line"
                  :loading="isDispatching"
                  @click.prevent="dispatchSale"
                >
                  Despachar (Pago Pendiente)
                </VBtn>
                <VBtn
                  type="submit"
                  :disabled="sale.status === 'canceled'"
                  color="primary"
                  variant="elevated"
                  prepend-icon="ri-save-3-line"
                  :loading="loader.loading"
                  size="large"
                >
                  {{ sale.status === 'draft' ? 'Finalizar Venta' : 'Guardar Cambios' }}
                </VBtn>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </VForm>
    <AddServiceDialog
      :is-dialog-visible="isAddServiceDialogVisible"
      @update:is-dialog-visible="isAddServiceDialogVisible = $event"
      @service-added="handleServiceAdded"
    />
  </div>
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
