<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { XMLParser } from "fast-xml-parser"
import { useFormDraft } from '@/composables/useFormDraft'
import { useTaxConfig } from '@/composables/useTaxConfig'

const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()
const { taxPercent, calculateTax } = useTaxConfig()

const isSubmitting = ref(false)
const isLoadingConfig = ref(false)
const isLoadingProducts = ref(false)

// Config data
const suppliers = ref([])
const categories = ref([])
const brands = ref(['SM'])
const accounts = ref([])
const partners = ref([])
const products = ref([])

// Saldo a favor disponible del proveedor
const supplierAvailableCredit = ref(0)

// XML Import State & Duplicate Detection
const xmlFileInputRef = ref(null)
const isDragging = ref(false)
const xmlLoadedInfo = ref(null)
const isParsingXml = ref(false)
const isDuplicateInvoice = ref(false)
const duplicateInvoiceInfo = ref(null)

const checkSupplierCredit = async supId => {
  if (!supId) {
    supplierAvailableCredit.value = 0

    return
  }
  try {
    const res = await $api(`supplier-reconciliation/credit-balances/${supId}`)
    if (res.success) {
      supplierAvailableCredit.value = Number(res.total_available || 0)
    }
  } catch (err) {
    console.error('Error al consultar crédito del proveedor:', err)
  }
}

const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000

  return new Date(Date.now() - tzOffset).toISOString().split('T')[0]
}

// Form State
const formData = ref({
  supplier_id: null,
  supplier_ruc: '',
  supplier_name: '',
  supplier_address: '',
  invoice_number: '',
  issue_date: getLocalDateString(),
  access_key: '',
  payment_type: null,
  account_id: null,
  partner_id: null,
})

// Tipo general de la compra: 'products' (Productos) | 'supplies' (Insumos) | 'expenses' (Gasto General)
const purchaseType = ref('products')
const isExpense = computed({
  get: () => purchaseType.value === 'expenses' || purchaseType.value === 'supplies',
  set: val => {
    if (val) {
      if (purchaseType.value === 'products') purchaseType.value = 'expenses'
    } else {
      purchaseType.value = 'products'
    }
  },
})

const purchaseTypeOptions = [
  {
    value: 'products',
    btnLabel: 'Productos (Stock)',
    title: 'Productos para Venta (Stock Comercial)',
    subtitle: 'Mercadería física para venta al cliente. Se registrarán en el catálogo y aumentará su stock comercial.',
    icon: 'ri-box-3-line',
    color: 'primary',
    badge: 'Afecta Stock Ventas',
  },
  {
    value: 'supplies',
    btnLabel: 'Insumos Taller',
    title: 'Insumos de Taller (Por Envase/Caja)',
    subtitle: 'Entra a inventario interno de taller.',
    icon: 'ri-archive-line',
    color: 'warning',
    badge: 'Stock Interno Taller',
  },
  {
    value: 'expenses',
    btnLabel: 'Gasto General',
    title: 'Gasto Directo',
    subtitle: 'Consumibles directos o gastos operativos que no llevan inventario.',
    icon: 'ri-receipt-line',
    color: 'info',
    badge: 'Gasto Taller Directo',
  },
]

const setPurchaseType = type => {
  if (isDuplicateInvoice.value) return
  purchaseType.value = type

  const targetItemType = type === 'products' ? 1 : (type === 'supplies' ? 3 : 2)
  const targetUsageType = targetItemType === 1 ? 'commercial_product' : (targetItemType === 3 ? 'workshop_stock_unit' : 'workshop_consumable')

  items.value.forEach(item => {
    item.item_type = targetItemType
    item.usage_type = targetUsageType
    if (targetItemType !== 1 && targetItemType !== 3) {
      item.product_categorie_id = null
    }
  })
}

// Tipos de Ítems disponibles individualmente por fila
const itemTypeOptions = [
  {
    title: '📦 Producto para Venta (Stock Comercial)',
    shortTitle: 'Prod. Venta',
    value: 1,
    usage_type: 'commercial_product',
    color: 'primary',
    icon: 'ri-box-3-line',
    desc: 'Inventario comercial para clientes y facturación POS',
  },
  {
    title: '🧰 Gasto Directo Taller (Sin Stock)',
    shortTitle: 'Gasto Taller',
    value: 2,
    usage_type: 'workshop_consumable',
    color: 'info',
    icon: 'ri-tools-line',
    desc: 'Consumibles inmediatos / costo operativo sin inventario',
  },
  {
    title: '🛢️ Insumo por Envase / Caja (Inventario Taller)',
    shortTitle: 'Insumo Envase',
    value: 3,
    usage_type: 'workshop_stock_unit',
    color: 'warning',
    icon: 'ri-archive-line',
    desc: 'Control de reposición interno por caja o envase (1 clic para abrir)',
  },
]

const createEmptyItemRow = (type = null) => {
  const chosenType = type !== null ? type : (purchaseType.value === 'products' ? 1 : (purchaseType.value === 'supplies' ? 3 : 2))
  const isProd = chosenType === 1
  const isWorkshopStock = chosenType === 3
  const usageType = chosenType === 1 ? 'commercial_product' : (chosenType === 3 ? 'workshop_stock_unit' : 'workshop_consumable')

  return {
    id: Date.now() + Math.random(),
    code: isProd ? '' : (isWorkshopStock ? `INS-ENV-${Date.now().toString().slice(-6)}` : `GAS-${Date.now().toString().slice(-6)}`),
    code_aux: '',
    description: '',
    brand: isProd || isWorkshopStock ? 'SM' : 'N/A',
    quantity: 1,
    unit_price: null,
    discount: 0,
    subtotal: 0,
    tax: 0,
    total: 0,
    item_type: chosenType,
    usage_type: usageType,
    product_categorie_id: isProd ? (categories.value[0]?.id || null) : null,
    is_taxable: 1,
    is_manual: true,
    _selected: true,
  }
}

// Computed para verificar si existe alguna fila rápida o manual vacía / incompleta
const hasEmptyQuickRow = computed(() => {
  return items.value.some(item => {
    if (item.is_from_xml) return false
    const noDesc = !item.description || !item.description.toString().trim()
    const noPrice = item.unit_price === null || item.unit_price === undefined || item.unit_price === ''
    return noDesc || noPrice
  })
})

const addQuickItemRow = () => {
  const emptyRowIndex = items.value.findIndex(item => {
    if (item.is_from_xml) return false
    const noDesc = !item.description || !item.description.toString().trim()
    const noPrice = item.unit_price === null || item.unit_price === undefined || item.unit_price === ''
    return noDesc || noPrice
  })

  if (emptyRowIndex !== -1) {
    const emptyItem = items.value[emptyRowIndex]
    const hasNoDesc = !emptyItem.description || !emptyItem.description.toString().trim()

    if (hasNoDesc) {
      showNotification(`La fila #${emptyRowIndex + 1} está vacía. Ingresa la descripción antes de agregar otra fila.`, 'warning')
    } else {
      showNotification(`La fila #${emptyRowIndex + 1} ("${emptyItem.description}") requiere precio unitario antes de agregar otra fila.`, 'warning')
    }

    nextTick(() => {
      const rowElements = document.querySelectorAll('.purchase-item-row')
      if (rowElements && rowElements[emptyRowIndex]) {
        const inputToFocus = hasNoDesc
          ? rowElements[emptyRowIndex].querySelector('input[type="text"]')
          : rowElements[emptyRowIndex].querySelector('.price-box input')
        inputToFocus?.focus()
        inputToFocus?.select?.()
        inputToFocus?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
    return
  }

  items.value.push(createEmptyItemRow())

  nextTick(() => {
    const rowElements = document.querySelectorAll('.purchase-item-row')
    if (rowElements && rowElements.length > 0) {
      const lastRow = rowElements[rowElements.length - 1]
      const input = lastRow?.querySelector('input[type="text"]')
      input?.focus()
      input?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
}

// Bulk Category Assignment State
const isBulkCategoryEnabled = ref(false)
const bulkCategory = ref(null)
const isAllSelected = computed(() => items.value.length > 0 && items.value.every(item => item._selected !== false))
const isSomeSelected = computed(() => items.value.some(item => item._selected !== false))
const selectedProductsCount = computed(() => items.value.filter(item => item._selected !== false && Number(item.item_type) === 1).length)

const toggleSelectAll = () => {
  const newVal = !isAllSelected.value

  items.value.forEach(item => {
    item._selected = newVal
    if (!newVal) {
      item.product_categorie_id = null
    }
  })
  if (isSharedInvoice.value) {
    calculateTercerosFromUnchecked()
  }
}

const onToggleItem = (item, val) => {
  item._selected = val
  if (val === false) {
    item.product_categorie_id = null
  }
  if (isSharedInvoice.value) {
    calculateTercerosFromUnchecked()
  }
}

const applyBulkCategory = () => {
  if (!bulkCategory.value) {
    return showNotification('Selecciona una categoría primero', 'warning')
  }
  if (items.value.length === 0) {
    return showNotification('No hay productos en la lista', 'warning')
  }

  // Aplica la categoría a todos los productos que tengan el check activo
  let count = 0
  items.value.forEach(item => {
    if (item._selected !== false && Number(item.item_type) === 1) {
      item.product_categorie_id = bulkCategory.value
      count++
    }
  })

  if (count === 0) {
    return showNotification('No hay productos físicos marcados para asignar categoría', 'warning')
  }

  showNotification(`Categoría asignada a ${count} producto(s) marcado(s)`, 'success')
}

const onItemTypeChange = item => {
  const t = Number(item.item_type)
  item.usage_type = t === 1 ? 'commercial_product' : (t === 3 ? 'workshop_stock_unit' : 'workshop_consumable')
  if (t === 2) {
    item.product_categorie_id = null
  }
}

// Factura Compartida State
const isSharedInvoice = ref(false)
const totalAsumidoTerceros = ref(0)

const toggleSharedInvoice = val => {
  if (val) {
    calculateTercerosFromUnchecked()
  } else {
    items.value.forEach(item => {
      item._selected = true
    })
    totalAsumidoTerceros.value = 0
  }
}

const calculateTercerosFromUnchecked = () => {
  let unchTotal = 0
  items.value.forEach(item => {
    if (item._selected === false) {
      unchTotal += item.total
    }
  })
  totalAsumidoTerceros.value = Number(unchTotal.toFixed(2))
}

const totalDiscount = computed(() => {
  return items.value.reduce((acc, item) => acc + (Number(item.discount) || 0), 0)
})

const subtotal = computed(() => {
  return items.value.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0)
})

const totalTax = computed(() => {
  return items.value.reduce((acc, item) => acc + (Number(item.tax) || 0), 0)
})

const grandTotal = computed(() => {
  return items.value.reduce((acc, item) => acc + (Number(item.total) || 0), 0)
})

// Desglose Terceros / Taller
const tercerosMath = computed(() => {
  const total = Number((parseFloat(totalAsumidoTerceros.value) || 0).toFixed(2))
  const subtotal = Number((total / 1.15).toFixed(2))
  const iva = Number((total - subtotal).toFixed(2))

  return { subtotal, iva, total }
})

const tallerMath = computed(() => {
  const grandTot = grandTotal.value
  const grandSub = subtotal.value
  const grandTx = totalTax.value

  const total = Number(Math.max(0, grandTot - tercerosMath.value.total).toFixed(2))
  const sub = Number(Math.max(0, grandSub - tercerosMath.value.subtotal).toFixed(2))
  const iva = Number(Math.max(0, grandTx - tercerosMath.value.iva).toFixed(2))

  return { subtotal: sub, iva, total }
})

// Desglose Contable y Operativo: Mercadería Comercial vs Insumos / Gastos de Taller
const purchaseBreakdown = computed(() => {
  let commercialTotal = 0
  let workshopTotal = 0
  let workshopStockTotal = 0
  let workshopConsumableTotal = 0

  items.value.forEach(item => {
    const isSelected = item._selected !== false
    // Si la factura es compartida y el ítem no fue seleccionado por el taller, no entra a costos de taller
    if (isSharedInvoice.value && !isSelected) return

    const t = Number(item.item_type)
    const tot = Number(item.total) || 0

    if (t === 1) {
      commercialTotal += tot
    } else if (t === 3) {
      workshopStockTotal += tot
      workshopTotal += tot
    } else {
      workshopConsumableTotal += tot
      workshopTotal += tot
    }
  })

  return {
    commercialTotal: Number(commercialTotal.toFixed(2)),
    workshopTotal: Number(workshopTotal.toFixed(2)),
    workshopStockTotal: Number(workshopStockTotal.toFixed(2)),
    workshopConsumableTotal: Number(workshopConsumableTotal.toFixed(2)),
  }
})

// Items State
const items = ref([])
const searchProduct = ref(null)

const purchaseDraftState = computed({
  get: () => ({
    formData: formData.value,
    purchaseType: purchaseType.value,
    isExpense: isExpense.value,
    items: items.value,
    isSharedInvoice: isSharedInvoice.value,
    totalAsumidoTerceros: totalAsumidoTerceros.value,
  }),
  set: val => {
    if (!val) return
    if (val.formData) Object.assign(formData.value, val.formData)
    if (val.purchaseType) purchaseType.value = val.purchaseType
    if (Array.isArray(val.items)) items.value = val.items
    if (val.isSharedInvoice !== undefined) isSharedInvoice.value = val.isSharedInvoice
    if (val.totalAsumidoTerceros !== undefined) totalAsumidoTerceros.value = val.totalAsumidoTerceros
  },
})

const resetPurchaseForm = () => {
  formData.value = {
    supplier_id: null,
    supplier_ruc: '',
    supplier_name: '',
    supplier_address: '',
    invoice_number: '',
    issue_date: getLocalDateString(),
    access_key: '',
    payment_type: null,
    account_id: null,
    partner_id: null,
  }
  purchaseType.value = 'products'
  items.value = []
  isSharedInvoice.value = false
  totalAsumidoTerceros.value = 0
  xmlLoadedInfo.value = null
  isDuplicateInvoice.value = false
  duplicateInvoiceInfo.value = null
  isBulkCategoryEnabled.value = false
  bulkCategory.value = null
  if (xmlFileInputRef.value) {
    xmlFileInputRef.value.value = ''
  }
}

const cancelAndReturn = () => {
  clearDraft()
  resetPurchaseForm()
  router.push('/invoice/list')
}

const { hasDraft, draftTimestamp, clearDraft, discardDraft } = useFormDraft('invoice_manual_purchase', purchaseDraftState, {
  clearOnRouteLeave: true,
  resetForm: resetPurchaseForm,
  isMeaningful: data => !!(
    data.supplier_id
    || (data.items && data.items.length > 0)
    || (data.invoice_number && data.invoice_number.trim())
  ),
})

// Manual Product Entry State
const isManualProductDialogOpen = ref(false)

const manualItem = ref({
  description: '',
  code: '',
  product_categorie_id: null,
  brand: 'SM',
  item_type: 1,
  quantity: 1,
  unit_price: null,
  discount: 0,
  is_taxable: true,
})

// Estado para Diálogo de Configuración y Clasificación del Ítem (Producto / Insumo / Gasto)
const isBrandDialogOpen = ref(false)
const selectedBrandItem = ref(null)
const itemEditType = ref(1)
const itemEditCategory = ref(null)
const brandEditValue = ref('')
const applyToSimilarBrand = ref(false)

const popularShockBrands = [
  'TOKICO',
  'KYB',
  'MONROE',
  '555',
  'CORVEN',
  'GABRIEL',
  'NAKAMOTO',
  'BOSCH',
  'SM',
]

const openBrandDialog = item => {
  if (isDuplicateInvoice.value) return

  selectedBrandItem.value = item
  itemEditType.value = Number(item.item_type) || 1
  itemEditCategory.value = item.product_categorie_id || null
  brandEditValue.value = (item.brand && item.brand !== 'N/A') ? item.brand : 'SM'
  applyToSimilarBrand.value = false
  isBrandDialogOpen.value = true
}

const saveBrandEdit = () => {
  if (!selectedBrandItem.value) return

  const it = selectedBrandItem.value
  const targetType = Number(itemEditType.value) || 1
  const trimmed = (brandEditValue.value || 'SM').toString().trim()
  const finalBrand = targetType === 2 ? 'N/A' : (trimmed || 'SM')

  // Actualizar clasificación y uso
  it.item_type = targetType
  it.usage_type = targetType === 1
    ? 'commercial_product'
    : (targetType === 3 ? 'workshop_stock_unit' : 'workshop_consumable')

  it.brand = finalBrand

  if (finalBrand && finalBrand !== 'N/A' && !brands.value.includes(finalBrand)) {
    brands.value.push(finalBrand)
  }

  // Actualizar categoría según el tipo
  if (targetType === 1) {
    it.product_categorie_id = itemEditCategory.value || it.product_categorie_id || null
  } else {
    it.product_categorie_id = null
  }

  // Si marcó aplicar a similares y es producto
  if (applyToSimilarBrand.value && targetType === 1) {
    const curDesc = (it.description || '').toLowerCase()
    let count = 0
    items.value.forEach(otherIt => {
      if (Number(otherIt.item_type) === 1 && otherIt.id !== it.id) {
        const desc = (otherIt.description || '').toLowerCase()
        if (
          (curDesc.includes('amortiguador') && desc.includes('amortiguador')) ||
          (curDesc.includes('pastilla') && desc.includes('pastilla')) ||
          (curDesc.includes('disco') && desc.includes('disco')) ||
          (curDesc.includes('filtro') && desc.includes('filtro')) ||
          (curDesc.includes('aceite') && desc.includes('aceite'))
        ) {
          otherIt.brand = finalBrand
          if (itemEditCategory.value && !otherIt.product_categorie_id) {
            otherIt.product_categorie_id = itemEditCategory.value
          }
          count++
        }
      }
    })
    if (count > 0) {
      showNotification(`Configuración aplicada a este y ${count} ítem(s) similar(es)`, 'success')
    } else {
      showNotification(`Ítem actualizado como ${targetType === 1 ? 'Producto' : (targetType === 3 ? 'Insumo Taller' : 'Gasto Directo')}`, 'success')
    }
  } else {
    showNotification(`Ítem actualizado como ${targetType === 1 ? 'Producto' : (targetType === 3 ? 'Insumo Taller' : 'Gasto Directo')}`, 'success')
  }

  isBrandDialogOpen.value = false
}



const openManualProductDialog = (initialSearch = '') => {
  const defaultType = purchaseType.value === 'products' ? 1 : (purchaseType.value === 'supplies' ? 3 : 2)
  manualItem.value = {
    description: typeof initialSearch === 'string' ? initialSearch : '',
    code: '',
    product_categorie_id: defaultType === 1 ? (categories.value[0]?.id || null) : null,
    brand: defaultType === 1 || defaultType === 3 ? 'SM' : 'N/A',
    item_type: defaultType,
    usage_type: defaultType === 1 ? 'commercial_product' : (defaultType === 3 ? 'workshop_stock_unit' : 'workshop_consumable'),
    quantity: 1,
    unit_price: null,
    discount: 0,
    is_taxable: true,
  }
  isManualProductDialogOpen.value = true
}

const addManualProduct = () => {
  if (!manualItem.value.description || !manualItem.value.description.trim()) {
    return showNotification('Debe ingresar la descripción del ítem', 'warning')
  }
  if (manualItem.value.unit_price === null || manualItem.value.unit_price === undefined || manualItem.value.unit_price < 0) {
    return showNotification('Debe ingresar un precio unitario válido', 'warning')
  }

  const itemTypeVal = Number(manualItem.value.item_type) || 1
  const isProduct = itemTypeVal === 1
  const isWorkshopStock = itemTypeVal === 3
  if (isProduct && !manualItem.value.product_categorie_id) {
    return showNotification('Debe seleccionar una categoría para el producto', 'warning')
  }

  const brandTrimmed = (manualItem.value.brand || 'SM').toString().trim()
  if ((isProduct || isWorkshopStock) && brandTrimmed && !brands.value.includes(brandTrimmed)) {
    brands.value.push(brandTrimmed)
  }

  const qty = Math.max(0.0001, Number(manualItem.value.quantity) || 1)
  const price = Math.max(0, Number(manualItem.value.unit_price) || 0)
  const disc = Math.max(0, Number(manualItem.value.discount) || 0)
  const sub = Math.max(0, (qty * price) - disc)
  const isTaxable = manualItem.value.is_taxable ? 1 : 0
  const taxVal = calculateTax(sub, isTaxable === 1)

  const prefix = isProduct ? 'PROD-' : (isWorkshopStock ? 'INS-ENV-' : 'GAS-')
  const codeVal = manualItem.value.code && manualItem.value.code.trim()
    ? manualItem.value.code.trim().toUpperCase()
    : `${prefix}${Date.now().toString().slice(-6)}`

  const usageTypeVal = isProduct ? 'commercial_product' : (isWorkshopStock ? 'workshop_stock_unit' : 'workshop_consumable')

  items.value.push({
    id: Date.now() + Math.random(),
    code: codeVal,
    description: manualItem.value.description.trim(),
    brand: isProduct || isWorkshopStock ? (brandTrimmed || 'SM') : 'N/A',
    quantity: qty,
    unit_price: price,
    discount: disc,
    subtotal: Number(sub.toFixed(2)),
    tax: Number(taxVal.toFixed(2)),
    total: Number((sub + taxVal).toFixed(2)),
    item_type: itemTypeVal,
    usage_type: usageTypeVal,
    product_categorie_id: isProduct ? manualItem.value.product_categorie_id : null,
    is_taxable: isTaxable,
    is_manual: true,
    _selected: true,
  })

  showNotification('Ítem agregado a la compra', 'success')
  isManualProductDialogOpen.value = false
}

const getCategoryName = catId => {
  if (!catId) return ''
  const cat = categories.value.find(c => c.id === catId)

  return cat ? (cat.title || cat.name || '') : ''
}

const loadConfig = async () => {
  isLoadingConfig.value = true
  try {
    const [configResp, accountsResp, partnersResp] = await Promise.all([
      $api('invoices/config', { method: 'GET' }),
      $api('accounts', { method: 'GET' }),
      $api('partners', { method: 'GET' }),
    ])

    suppliers.value = configResp.suppliers || []
    categories.value = configResp.categories || []

    const rawBrands = configResp.brands || []
    const brandSet = new Set(['SM', ...rawBrands])

    brands.value = Array.from(brandSet).filter(Boolean)

    const rawAccounts = accountsResp.data || accountsResp || []

    accounts.value = rawAccounts.map(acc => {
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

    // Pre-seleccionar automáticamente la primera cuenta para Pago Inmediato
    if (accounts.value.length > 0 && !formData.value.account_id) {
      formData.value.account_id = accounts.value[0].id
    }

    // Partners returns object with data in many laravel resources
    partners.value = partnersResp.data?.data || partnersResp.data || []

  } catch (error) {
    console.error(error)
    showNotification('Error cargando configuraciones iniciales', 'error')
  } finally {
    isLoadingConfig.value = false
  }
}

// XML Upload and Parser Handler
const triggerXmlFileInput = () => {
  if (xmlFileInputRef.value) {
    xmlFileInputRef.value.click()
  }
}

const handleXmlFileSelect = event => {
  const file = event.target.files ? event.target.files[0] : null
  if (file) {
    processXmlFile(file)
  }

  // Reset input value so the same file can be selected again if needed
  if (event.target) event.target.value = ''
}

const handleXmlDrop = event => {
  isDragging.value = false

  const file = event.dataTransfer?.files?.[0]
  if (file) {
    processXmlFile(file)
  }
}

const processXmlFile = async file => {
  if (!file) return

  const isXml = file.type === 'application/xml' || file.type === 'text/xml' || file.name.toLowerCase().endsWith('.xml')
  if (!isXml) {
    showNotification('El archivo seleccionado no es un XML válido', 'warning')

    return
  }

  isParsingXml.value = true

  const reader = new FileReader()

  reader.onload = async e => {
    try {
      let xmlString = e.target.result

      // 1. Decodificar entidades HTML si el XML viene escapado
      if (xmlString.includes('&lt;factura') || xmlString.includes('&lt;Factura')) {
        const txt = document.createElement('textarea')

        txt.innerHTML = xmlString
        xmlString = txt.value
      }

      const parser = new XMLParser({
        ignoreAttributes: false,
        cdataPropName: '#cdata-section',
        textNodeName: '#text',
        parseNodeValue: false,
        trimValues: true,
      })

      let facturaData = null
      const match = xmlString.match(/<factura[\s\S]*?<\/factura>/i)

      if (match) {
        const cleanXml = match[0].trim()
        const parsed = parser.parse(cleanXml)

        facturaData = parsed.factura || parsed.Factura || parsed
      } else {
        const parsed = parser.parse(xmlString)
        if (parsed.factura) {
          facturaData = parsed.factura
        } else if (parsed.autorizacion && parsed.autorizacion.comprobante) {
          let comp = parsed.autorizacion.comprobante
          if (typeof comp === 'string') {
            comp = comp.replace('<![CDATA[', '').replace(']]>', '')

            const innerParsed = parser.parse(comp)

            facturaData = innerParsed.factura || innerParsed.Factura || innerParsed
          } else if (comp['#cdata-section'] || comp['#text']) {
            let inner = comp['#cdata-section'] || comp['#text'] || ''
            inner = inner.replace('<![CDATA[', '').replace(']]>', '')

            const innerParsed = parser.parse(inner)

            facturaData = innerParsed.factura || innerParsed.Factura || innerParsed
          }
        } else if (parsed.comprobante && parsed.comprobante.factura) {
          facturaData = parsed.comprobante.factura
        }
      }

      if (!facturaData || !facturaData.infoTributaria) {
        showNotification('No se pudo extraer la información tributaria de la factura XML', 'error')
        isParsingXml.value = false

        return
      }

      // 2. Extraer datos del proveedor
      let ruc = (facturaData.infoTributaria.ruc || '').toString().trim()
      const rawRucWithoutZero = ruc.replace(/^0+/, '')
      const razonSocial = (facturaData.infoTributaria.razonSocial || '').toString().trim()
      const nombreComercial = (facturaData.infoTributaria.nombreComercial || razonSocial).toString().trim()
      const dirMatriz = (facturaData.infoTributaria.dirMatriz || 'S/N').toString().trim()

      formData.value.supplier_ruc = ruc
      formData.value.supplier_name = nombreComercial || razonSocial
      formData.value.supplier_address = dirMatriz

      // Buscar proveedor en la lista local por RUC o por Nombre
      let matchedSupplier = suppliers.value.find(s => {
        const sRuc = (s.ruc || s.identification || s.tax_id || '').toString().trim()
        const sRucClean = sRuc.replace(/^0+/, '')

        return (
          (sRuc && (sRuc === ruc || sRucClean === rawRucWithoutZero)) ||
          (s.name && s.name.toLowerCase() === nombreComercial.toLowerCase()) ||
          (s.trade_name && s.trade_name.toLowerCase() === razonSocial.toLowerCase())
        )
      })

      if (matchedSupplier) {
        formData.value.supplier_id = matchedSupplier.id
      } else {
        // Registrar proveedor automáticamente vía API si no existe
        try {
          const newSupResp = await $api('suppliers', {
            method: 'POST',
            body: {
              tax_id: ruc,
              ruc: ruc,
              name: nombreComercial || razonSocial,
              trade_name: razonSocial,
              address: dirMatriz,
              state: 1,
            },
          })

          const createdSup = newSupResp.supplier || newSupResp.data
          if (createdSup) {
            suppliers.value.unshift(createdSup)
            formData.value.supplier_id = createdSup.id
          } else {
            const tempSup = { id: ruc, ruc: ruc, name: nombreComercial || razonSocial, trade_name: razonSocial }

            suppliers.value.unshift(tempSup)
            formData.value.supplier_id = tempSup.id
          }
        } catch (supErr) {
          console.warn('Fallback proveedor nuevo para XML:', supErr)

          const tempSup = { id: ruc, ruc: ruc, name: nombreComercial || razonSocial, trade_name: razonSocial }

          suppliers.value.unshift(tempSup)
          formData.value.supplier_id = tempSup.id
        }
      }

      // 3. Extraer Número de Factura (Únicamente el secuencial de 9 dígitos)
      const secuencial = (facturaData.infoTributaria.secuencial || '').toString().trim().padStart(9, '0')

      formData.value.invoice_number = secuencial

      // 4. Extraer Clave de Acceso (como String de 49 dígitos exactos)
      const claveMatch = xmlString.match(/<(?:claveAcceso|numeroAutorizacion)[^>]*>([0-9]{49})<\/(?:claveAcceso|numeroAutorizacion)>/i)
      const rawClave = claveMatch ? claveMatch[1] : (facturaData.infoTributaria?.claveAcceso || '')

      formData.value.access_key = String(rawClave || '').trim()

      // 5. Extraer Fecha de Emisión
      if (facturaData.infoFactura?.fechaEmision) {
        const rawDate = facturaData.infoFactura.fechaEmision.toString()

        // Format can be DD/MM/YYYY
        if (rawDate.includes('/')) {
          const parts = rawDate.split('/')
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0')
            const month = parts[1].padStart(2, '0')
            const year = parts[2]

            formData.value.issue_date = `${year}-${month}-${day}`
          }
        } else {
          formData.value.issue_date = rawDate
        }
      }

      // 6. Extraer Ítems/Productos del XML
      let detalles = []
      if (Array.isArray(facturaData.detalles?.detalle)) {
        detalles = facturaData.detalles.detalle
      } else if (facturaData.detalles?.detalle) {
        detalles = [facturaData.detalles.detalle]
      } else if (Array.isArray(facturaData.detalles)) {
        detalles = facturaData.detalles
      }

      // Helpers para extracción segura de nodos XML (soporta texto simple, CDATA y objetos)
      const getNodeVal = (node, defaultVal = '') => {
        if (node === null || node === undefined) return defaultVal
        if (typeof node === 'object') {
          if (node['#text'] !== undefined) return String(node['#text']).trim()
          if (node['#cdata-section'] !== undefined) return String(node['#cdata-section']).trim()
          if (node['_text'] !== undefined) return String(node['_text']).trim()
          for (const k of Object.keys(node)) {
            if (!k.startsWith('@_')) {
              const val = node[k]
              if (typeof val === 'string' || typeof val === 'number') return String(val).trim()
            }
          }

          return defaultVal
        }

        return String(node).trim()
      }

      const getNodeNum = (node, defaultVal = 0) => {
        const raw = getNodeVal(node, defaultVal)
        const parsed = parseFloat(raw)

        return isNaN(parsed) ? defaultVal : parsed
      }

      const defaultCatId = categories.value[0]?.id || null
      const parsedItems = []

      detalles.forEach((det, idx) => {
        const primaryCode = getNodeVal(det.codigoPrincipal || det.codigoInterno, '').toUpperCase()
        const auxCode = getNodeVal(det.codigoAuxiliar, '').toUpperCase()
        const code = (primaryCode || auxCode || `XML-${idx + 1}`).toUpperCase()
        const codeAux = (auxCode && auxCode !== '-') ? auxCode : (primaryCode ? `LE${primaryCode}` : (code ? `LE${code}` : ''))
        const description = getNodeVal(det.descripcion, 'Sin descripción')

        // Extracción robusta de cantidades y precios
        let qty = getNodeNum(det.cantidad, 1)
        if (qty <= 0) qty = 1

        let unitPrice = getNodeNum(det.precioUnitario, 0)
        const discount = getNodeNum(det.descuento, 0)
        let subtotalVal = getNodeNum(det.precioTotalSinImpuesto, 0)

        // Si subtotal viene en 0 pero unitPrice existe
        if (subtotalVal <= 0 && unitPrice > 0) {
          subtotalVal = (qty * unitPrice) - discount
        }

        // Si unitPrice viene en 0 pero subtotal existe
        if (unitPrice <= 0 && subtotalVal > 0 && qty > 0) {
          unitPrice = (subtotalVal + discount) / qty
        }

        // Calcular impuesto
        let taxVal = 0
        let isTax = 0
        if (det.impuestos?.impuesto) {
          const impArray = Array.isArray(det.impuestos.impuesto) ? det.impuestos.impuesto : [det.impuestos.impuesto]

          impArray.forEach(imp => {
            const val = getNodeNum(imp.valor, 0)
            const tarifa = getNodeNum(imp.tarifa, 0)
            if (val > 0 || tarifa > 0) {
              taxVal += val > 0 ? val : (subtotalVal * (tarifa / 100))
              isTax = 1
            }
          })
        }

        // Buscar si ya existe este producto en catálogo para heredar categoría, marca y clasificación
        const existingProd = products.value.find(p => p.sku === code || p.code_aux === codeAux || p.description?.toLowerCase() === description.toLowerCase())

        // Detectar si parece logística/flete o según el Tipo general de Compra seleccionado o producto existente
        const isLogistics = /flete|transporte|envio|logistica|acarreo/i.test(description)
        let itemType = 1
        let usageType = 'commercial_product'

        if (existingProd) {
          if (existingProd.usage_type === 'workshop_stock_unit' || Number(existingProd.item_type) === 3) {
            itemType = 3
            usageType = 'workshop_stock_unit'
          } else if (existingProd.usage_type === 'workshop_consumable' || Number(existingProd.item_type) === 2) {
            itemType = 2
            usageType = 'workshop_consumable'
          } else {
            itemType = 1
            usageType = 'commercial_product'
          }
        } else if (isLogistics) {
          itemType = 2
          usageType = 'workshop_consumable'
        } else if (purchaseType.value === 'supplies') {
          itemType = 3
          usageType = 'workshop_stock_unit'
        } else if (purchaseType.value === 'expenses') {
          itemType = 2
          usageType = 'workshop_consumable'
        }

        parsedItems.push({
          id: Date.now() + idx + Math.random(),
          code: code,
          code_aux: codeAux,
          description: description,
          brand: (itemType === 1 || itemType === 3) ? (existingProd?.brand || 'SM') : 'N/A',
          quantity: Number(qty.toFixed(2)),
          unit_price: Number(unitPrice.toFixed(4)),
          discount: Number(discount.toFixed(2)),
          subtotal: Number(subtotalVal.toFixed(2)),
          tax: Number(taxVal.toFixed(2)),
          total: Number((subtotalVal + taxVal).toFixed(2)),
          item_type: itemType,
          usage_type: usageType,
          product_categorie_id: itemType === 1 ? (existingProd?.product_categorie_id || null) : null,
          is_taxable: isTax,
          is_from_xml: true,
          _selected: true,
        })
      })

      items.value = parsedItems

      xmlLoadedInfo.value = {
        fileName: file.name,
        invoiceNumber: formData.value.invoice_number,
        supplierName: razonSocial || nombreComercial,
        ruc: ruc,
        accessKey: formData.value.access_key,
        itemsCount: parsedItems.length,
      }

      // 7. Verificar si la factura ya existe en el sistema
      try {
        const checkRes = await $api('invoices/check-duplicate', {
          method: 'POST',
          body: {
            access_key: formData.value.access_key,
            invoice_number: formData.value.invoice_number,
            supplier_ruc: ruc,
            supplier_id: formData.value.supplier_id,
          },
        })

        if (checkRes.exists) {
          isDuplicateInvoice.value = true
          duplicateInvoiceInfo.value = checkRes.invoice
          if (checkRes.invoice.supplier?.id) {
            formData.value.supplier_id = checkRes.invoice.supplier.id
          }
          showNotification('⚠️ Esta factura ya fue registrada previamente en el sistema. Los datos se muestran en modo solo lectura.', 'warning')
        } else {
          isDuplicateInvoice.value = false
          duplicateInvoiceInfo.value = null
          showNotification(`Factura XML cargada: ${formData.value.invoice_number} con ${parsedItems.length} ítems`, 'success')
        }
      } catch (checkErr) {
        console.error('Error al verificar duplicidad de factura:', checkErr)
        isDuplicateInvoice.value = false
        duplicateInvoiceInfo.value = null
        showNotification(`Factura XML cargada: ${formData.value.invoice_number} con ${parsedItems.length} ítems`, 'success')
      }

    } catch (err) {
      console.error('Error al procesar archivo XML:', err)
      showNotification('Error al leer o procesar el archivo XML', 'error')
    } finally {
      isParsingXml.value = false
    }
  }

  reader.readAsText(file)
}

const clearXmlImport = () => {
  xmlLoadedInfo.value = null
  isDuplicateInvoice.value = false
  duplicateInvoiceInfo.value = null
  isBulkCategoryEnabled.value = false
  bulkCategory.value = null
  items.value = []
  formData.value.invoice_number = ''
  formData.value.access_key = ''
  isSharedInvoice.value = false
  totalAsumidoTerceros.value = 0
  showNotification('Datos de XML eliminados', 'info')
}

// Watcher para buscar productos y saldo a favor cuando cambia el proveedor
watch(() => formData.value.supplier_id, async newSupplierId => {
  checkSupplierCredit(newSupplierId)

  if (!newSupplierId) {
    products.value = []

    return
  }

  isLoadingProducts.value = true
  try {
    const productsResp = await $api(`products?supplier_id=${newSupplierId}&per_page=1000`, { method: 'GET' })

    products.value = productsResp.products?.data || productsResp.products || productsResp.data?.data || productsResp.data || []
  } catch (error) {
    console.error(error)
    showNotification('Error cargando productos del proveedor', 'error')
    products.value = []
  } finally {
    isLoadingProducts.value = false
  }
})

// Computeds for totals
/* const subtotal = computed(() => {
  return items.value.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0)
})

const totalTax = computed(() => {
  return items.value.reduce((sum, item) => sum + (Number(item.tax) || 0), 0)
})

const grandTotal = computed(() => {
  return subtotal.value + totalTax.value
})
 */
const customProductFilter = (value, query, item) => {
  if (!query) return true
  const q = query.toString().toLowerCase().trim()
  const raw = item?.raw || item || {}
  const desc = (raw.description || raw.name || '').toString().toLowerCase()
  const sku = (raw.sku || raw.code || '').toString().toLowerCase()
  const brand = (raw.brand || '').toString().toLowerCase()

  return desc.includes(q) || sku.includes(q) || brand.includes(q)
}

const addProductToItems = product => {
  if (!product) return

  // Check if already exists
  const exists = items.value.find(i => i.code === product.sku)
  if (exists) {
    exists.quantity++
    updateItemTotals(exists)
    searchProduct.value = null

    return
  }

  const isTaxable = (product.is_taxable === 0 || product.is_taxable === '0' || product.is_taxable === false) ? 0 : 1
  const qty = 1
  const unitPrice = Number(product.purchase_price) || 0
  const discount = Number(product.discount) || 0
  const sub = Number(((qty * unitPrice) - discount).toFixed(2))
  const tax = calculateTax(sub, isTaxable === 1)
  const total = Number((sub + tax).toFixed(2))

  // Auto-recordar item_type y usage_type si ya está catalogado
  const itemType = Number(product.item_type) || (product.usage_type === 'workshop_stock_unit' ? 3 : (product.usage_type === 'workshop_consumable' ? 2 : 1))
  const usageType = product.usage_type || (itemType === 3 ? 'workshop_stock_unit' : (itemType === 2 ? 'workshop_consumable' : 'commercial_product'))

  items.value.push({
    id: Date.now(),
    code: product.sku,
    description: product.description,
    brand: product.brand || 'SM',
    quantity: qty,
    unit_price: unitPrice,
    subtotal: sub,
    discount: discount,
    tax: tax,
    total: total,
    item_type: itemType,
    usage_type: usageType,
    product_categorie_id: product.product_categorie_id || (categories.value && categories.value[0] ? categories.value[0].id : null),
    is_taxable: isTaxable,
    _selected: true,
  })

  searchProduct.value = null
}

const updateItemTotals = item => {
  const qty = Number(item.quantity) || 0
  const price = Number(item.unit_price) || 0
  const disc = Number(item.discount) || 0

  item.subtotal = Number(((qty * price) - disc).toFixed(2))

  const isTaxable = (item.is_taxable === 0 || item.is_taxable === '0' || item.is_taxable === false) ? 0 : 1

  item.is_taxable = isTaxable
  item.tax = calculateTax(item.subtotal, isTaxable === 1)
  item.total = Number((item.subtotal + item.tax).toFixed(2))

  if (isSharedInvoice.value) {
    calculateTercerosFromUnchecked()
  }
}

const toggleItemTax = item => {
  item.is_taxable = (item.is_taxable === 1 || item.is_taxable === true) ? 0 : 1
  updateItemTotals(item)
}

const removeItem = index => {
  items.value.splice(index, 1)
  if (isSharedInvoice.value) {
    calculateTercerosFromUnchecked()
  }
}

const submitPurchase = async () => {
  if (!formData.value.supplier_id || !formData.value.invoice_number) {
    return showNotification('Debe llenar los campos de proveedor y número de factura', 'warning')
  }

  if (items.value.length === 0) {
    return showNotification('Debe agregar al menos un ítem a la compra', 'warning')
  }

  const invalidItem = items.value.find(item => !item.description?.trim() || item.unit_price === null || item.unit_price === undefined || Number(item.unit_price) < 0)
  if (invalidItem) {
    return showNotification(`El ítem "${invalidItem.description || 'sin nombre'}" requiere descripción y precio válido`, 'warning')
  }

  if (!formData.value.payment_type) {
    return showNotification('Debe seleccionar el origen de fondos para la compra', 'warning')
  }

  if (formData.value.payment_type === 'efectivo' && !formData.value.account_id) {
    return showNotification('Debe seleccionar obligatoriamente una cuenta de origen de los fondos', 'warning')
  }

  if (formData.value.payment_type === 'aporte' && !formData.value.partner_id) {
    return showNotification('Debe seleccionar un socio', 'warning')
  }

  // Validar obligatoriamente que todos los productos físicos del taller tengan una categoría asignada
  const unassignedProduct = items.value.find(item => {
    const isSelected = item._selected !== false
    const isWorkshop = !isSharedInvoice.value || isSelected
    const isProduct = Number(item.item_type) === 1 && isWorkshop

    return isProduct && !item.product_categorie_id
  })

  if (unassignedProduct) {
    return showNotification(`El producto "${unassignedProduct.description}" requiere una categoría obligatoria`, 'warning')
  }

  isSubmitting.value = true
  loader.start()

  const hasAnyProduct = items.value.some(it => {
    const isSelected = it._selected !== false
    const isWorkshop = !isSharedInvoice.value || isSelected

    return Number(it.item_type) === 1 && isWorkshop
  })

  const payload = {
    ...formData.value,
    purchase_type: purchaseType.value,
    is_expense: !hasAnyProduct,
    access_key: formData.value.access_key ? String(formData.value.access_key).trim() : null,
    subtotal: Number(subtotal.value.toFixed(2)),
    tax: Number(totalTax.value.toFixed(2)),
    total: Number(grandTotal.value.toFixed(2)),
    is_shared: isSharedInvoice.value,
    terceros_total: isSharedInvoice.value ? tercerosMath.value.total : 0,
    taller_total: isSharedInvoice.value ? tallerMath.value.total : grandTotal.value,
    items: items.value.map(item => {
      const isSelected = item._selected !== false
      const isWorkshop = !isSharedInvoice.value || isSelected
      const rawType = Number(item.item_type) || 1
      const isProduct = rawType === 1 && isWorkshop
      const usageType = item.usage_type || (rawType === 3 ? 'workshop_stock_unit' : (rawType === 2 ? 'workshop_consumable' : 'commercial_product'))

      return {
        id: item.id,
        code: item.code,
        code_aux: item.code_aux,
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        discount: Number(item.discount) || 0,
        subtotal: Number(item.subtotal) || 0,
        tax: Number(item.tax) || 0,
        total: Number(item.total) || 0,
        selected_for_inventory: isWorkshop,
        item_type: isWorkshop ? rawType : 2,
        usage_type: isWorkshop ? usageType : 'workshop_consumable',
        product_categorie_id: isProduct ? item.product_categorie_id : null,
        brand: (isProduct || rawType === 3) ? (item.brand || 'SM') : 'N/A',
      }
    }),
  }

  try {
    await $api('purchases/manual', {
      method: 'POST',
      body: payload,
    })

    const successMsg = !hasAnyProduct
      ? (purchaseType.value === 'supplies' ? 'Compra de insumos de taller registrada correctamente en finanzas' : 'Gasto general registrado correctamente en finanzas')
      : 'Compra de productos registrada correctamente en inventario y finanzas'

    showNotification(successMsg, 'success')
    clearDraft()
    router.push('/invoice/list')
  } catch (error) {
    console.error('Error al guardar compra:', error)

    const errData = error?.data || error?._data || error?.response?._data || error?.response?.data
    let msg = errData?.message || errData?.error
    if (errData?.errors) {
      const errList = Object.values(errData.errors).flat()
      if (errList.length > 0) {
        msg = errList.join(' • ')
      }
    }
    showNotification(msg || error?.message || 'Error al registrar la compra', 'error')
  } finally {
    isSubmitting.value = false
    loader.stop()
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 position-relative">
    <!-- Hidden XML File Input -->
    <input ref="xmlFileInputRef" type="file" accept=".xml,text/xml,application/xml" style="display: none;"
      @change="handleXmlFileSelect">

    <!-- Header Principal Sticky Estandarizado -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 page-header-wrapper">
        <div class="d-flex align-center gap-3 page-title-block">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="44" class="elevation-1">
            <VIcon icon="ri-shopping-cart-2-line" size="24" />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Ingreso de Compra
              </h1>
              <VChip color="primary" size="small" variant="tonal" class="font-weight-bold d-none d-sm-inline-flex"
                prepend-icon="ri-file-code-line">
                Factura SRI & Manual
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Registra tu compra cargando la factura XML del SRI o de forma manual
            </p>
          </div>
        </div>

        <div class="d-flex align-center justify-end gap-2 flex-wrap ms-auto crud-header-actions">


          <VBtn variant="text" color="info" class="text-capitalize font-weight-medium px-2" @click="cancelAndReturn">
            <template #prepend>
              <VAvatar color="info" size="36" class="mr-2">
                <VIcon icon="ri-arrow-left-s-line" color="white" size="22" />
              </VAvatar>
            </template>
            Listado
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- 1. Form Skeleton loader inicial al cargar configuraciones -->
    <div v-if="isLoadingConfig" class="d-flex flex-column gap-6">
      <VRow>
        <VCol cols="12">
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div class="shimmer-line w-40 mb-6" style="height: 24px;" />
            <VRow>
              <VCol cols="12" sm="6">
                <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
              </VCol>
              <VCol cols="12" sm="3">
                <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
              </VCol>
              <VCol cols="12" sm="3">
                <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
              </VCol>
            </VRow>
          </VCard>
        </VCol>
        <VCol cols="12" md="8">
          <VCard class="pa-6 rounded-xl border-light mb-6">
            <div class="shimmer-line w-100 mb-4" style="height: 80px; border-radius: 8px;" />
            <div class="shimmer-line w-100" style="height: 120px; border-radius: 8px;" />
          </VCard>
        </VCol>
        <VCol cols="12" md="4">
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

    <!-- 3. SKELETON LOADER AL PROCESAR / CARGAR XML -->
    <div v-else-if="isParsingXml" class="d-flex flex-column gap-6 mb-6">
      <VAlert color="primary" variant="tonal" class="rounded-xl border border-primary border-opacity-25 pa-4"
        icon="ri-file-code-line">
        <div class="d-flex align-center gap-3">
          <VProgressCircular indeterminate color="primary" size="28" width="3" />
          <div>
            <div class="text-subtitle-2 font-weight-bold text-primary">
              Procesando y verificando Factura Electrónica del SRI...
            </div>
            <div class="text-caption text-medium-emphasis">
              Extrayendo productos, impuestos, proveedor y consultando estado en el sistema...
            </div>
          </div>
        </div>
      </VAlert>

      <VRow>
        <!-- Skeleton Datos de Factura (12 cols) -->
        <VCol cols="12">
          <VCard class="pa-6 rounded-xl border elevation-0 bg-surface">
            <div class="d-flex align-center gap-2 mb-4">
              <div class="shimmer-circle" style="width: 24px; height: 24px;" />
              <div class="shimmer-line" style="width: 140px; height: 18px;" />
            </div>
            <VRow>
              <VCol cols="12" md="6">
                <div class="shimmer-line w-100" style="height: 48px; border-radius: 8px;" />
              </VCol>
              <VCol cols="12" md="3">
                <div class="shimmer-line w-100" style="height: 48px; border-radius: 8px;" />
              </VCol>
              <VCol cols="12" md="3">
                <div class="shimmer-line w-100" style="height: 48px; border-radius: 8px;" />
              </VCol>
            </VRow>
          </VCard>
        </VCol>

        <!-- Skeleton Detalle de Productos (8 cols) -->
        <VCol cols="12" md="8">
          <VCard class="pa-6 rounded-xl border elevation-0 bg-surface">
            <div class="d-flex justify-space-between align-center mb-4">
              <div class="shimmer-line" style="width: 200px; height: 20px;" />
              <div class="shimmer-chip" style="width: 90px; height: 26px; border-radius: 8px;" />
            </div>
            <div class="shimmer-line w-100 mb-3" style="height: 44px; border-radius: 8px;" />
            <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
            <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
            <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
            <div class="shimmer-line w-100 mb-2" style="height: 48px; border-radius: 8px;" />
          </VCard>
        </VCol>

        <!-- Skeleton Resumen & Fondos (4 cols) -->
        <VCol cols="12" md="4">
          <VCard class="pa-6 rounded-xl border elevation-0 bg-surface mb-6">
            <div class="shimmer-line mb-4" style="width: 140px; height: 20px;" />
            <div class="shimmer-line w-100 mb-3" style="height: 40px; border-radius: 8px;" />
            <div class="shimmer-line w-100 mb-3" style="height: 40px; border-radius: 8px;" />
          </VCard>
          <VCard class="pa-6 rounded-xl border elevation-0 bg-grey-lighten-4">
            <div class="shimmer-line mb-4" style="width: 160px; height: 20px;" />
            <div class="d-flex justify-space-between mb-3">
              <div class="shimmer-line" style="width: 100px; height: 16px;" />
              <div class="shimmer-line" style="width: 60px; height: 16px;" />
            </div>
            <div class="d-flex justify-space-between mb-4">
              <div class="shimmer-line" style="width: 120px; height: 16px;" />
              <div class="shimmer-line" style="width: 50px; height: 16px;" />
            </div>
            <div class="shimmer-line w-100" style="height: 48px; border-radius: 8px;" />
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- 4. Formulario Real y Contenido -->
    <div v-else>
      <!-- BANNER DE ALERTA: FACTURA YA REGISTRADA (SOLO LECTURA) -->
      <VAlert v-if="isDuplicateInvoice" color="error" variant="tonal" class="rounded-xl mb-6 border border-error pa-4"
        icon="ri-lock-2-line">
        <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center gap-3">
          <div>
            <div class="text-subtitle-1 font-weight-bold text-error d-flex align-center gap-2">
              <span>Factura Ya Registrada en el Sistema</span>
            </div>
            <div class="text-body-2 medium-emphasis mt-1">
              Esta factura (N° <strong>{{ formData.invoice_number }}</strong> de <strong>{{ formData.supplier_name ||
                'Proveedor' }}</strong>) ya fue ingresada previamente en el sistema el <strong>{{
                  duplicateInvoiceInfo?.created_at || 'en registros anteriores' }}</strong>.
            </div>
          </div>
          <VBtn color="error" variant="outlined" size="small" class="font-weight-bold text-none rounded-lg"
            @click="clearXmlImport">
            Cargar Otro XML
          </VBtn>
        </div>
      </VAlert>

      <VRow>
        <!-- 1. DATOS DE FACTURA (12 COLUMNAS COMPLETAS) -->
        <VCol cols="12">
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden"
            :class="{ 'opacity-90 bg-grey-lighten-5': isDuplicateInvoice }">
            <VCardItem class="py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-3 w-100">

                  <!-- Lado Izquierdo: Icono y Títulos -->
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-file-info-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                        Datos de Factura
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Información fiscal del proveedor y comprobante
                      </p>
                    </div>
                  </div>

                  <!-- Lado Derecho: Botones de Acción -->
                  <div class="d-flex align-center gap-2 flex-wrap">
                    <!-- Si no hay XML cargado -->
                    <VBtn v-if="!xmlLoadedInfo" color="primary" variant="elevated" prepend-icon="ri-upload-cloud-2-line"
                      class="rounded-lg px-4 font-weight-bold" height="40" :loading="isParsingXml"
                      @click="triggerXmlFileInput">
                      Agregar un XML
                    </VBtn>

                    <!-- Si ya hay XML cargado (Sin bordes ni fondo contenedor) -->
                    <template v-else>
                      <VChip size="small" color="success" variant="flat" class="font-weight-bold">
                        <VIcon icon="ri-checkbox-circle-fill" size="14" class="me-1" />
                        XML: {{ xmlLoadedInfo.invoiceNumber }} ({{ xmlLoadedInfo.itemsCount }} ítems)
                      </VChip>
                      <VBtn size="small" variant="outlined" color="primary" prepend-icon="ri-refresh-line"
                        class="rounded-lg text-none" @click="triggerXmlFileInput">
                        Reemplazar XML
                      </VBtn>
                      <VBtn size="small" variant="tonal" color="error" icon="ri-close-line" class="rounded-lg"
                        title="Quitar XML" @click="clearXmlImport" />
                    </template>
                  </div>

                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5">
              <!-- Selector de Clasificación de Compra: Productos vs Insumos vs Gasto General -->
              <div class="mb-5 pa-4 rounded-xl bg-grey-lighten-5 border">
                <div
                  class="d-flex flex-column flex-md-row align-start align-md-center justify-space-between gap-3 mb-2">
                  <!-- Lado Izquierdo: Icono + Título + Badge -->
                  <div class="d-flex align-center gap-3 min-w-0">
                    <VAvatar size="40"
                      :color="purchaseTypeOptions.find(o => o.value === purchaseType)?.color || 'primary'"
                      variant="tonal" class="rounded-lg shrink-0">
                      <VIcon :icon="purchaseTypeOptions.find(o => o.value === purchaseType)?.icon || 'ri-box-3-line'"
                        size="22" />
                    </VAvatar>
                    <div class="min-w-0">
                      <div class="d-flex align-center gap-2 flex-wrap">
                        <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                          {{purchaseTypeOptions.find(o => o.value === purchaseType)?.title || 'Tipo de Compra'}}
                        </span>
                        <VChip size="x-small"
                          :color="purchaseTypeOptions.find(o => o.value === purchaseType)?.color || 'primary'"
                          variant="tonal" class="font-weight-bold">
                          {{purchaseTypeOptions.find(o => o.value === purchaseType)?.badge}}
                        </VChip>
                      </div>
                    </div>
                  </div>

                  <!-- Lado Derecho: Radio Pills Pixel-Perfect y Super Estables (Inmunes a recortes) -->
                  <div class="d-flex align-center gap-2 flex-nowrap shrink-0 purchase-type-radio-container"
                    role="radiogroup">
                    <div v-for="opt in purchaseTypeOptions" :key="opt.value" role="radio"
                      :aria-checked="purchaseType === opt.value" class="custom-radio-pill" :class="{
                        'is-active': purchaseType === opt.value,
                        [`type-${opt.value}`]: true,
                        'is-disabled': isDuplicateInvoice
                      }" @click="setPurchaseType(opt.value)">
                      <!-- Círculo de Radio Button personalizado (nunca se corta) -->
                      <span class="custom-radio-circle">
                        <span class="custom-radio-dot" />
                      </span>

                      <!-- Icono -->
                      <VIcon :icon="opt.icon" size="16" class="pill-icon" />

                      <!-- Label -->
                      <span class="pill-label">{{ opt.btnLabel }}</span>
                    </div>
                  </div>
                </div>

                <!-- Subtítulo descriptivo en una línea limpia inferior para que no desplace los botones -->
                <div
                  class="text-caption text-medium-emphasis d-flex align-center gap-1.5 pt-2 border-t border-slate-200 border-opacity-50">
                  <VIcon icon="ri-information-line" size="14"
                    :color="purchaseTypeOptions.find(o => o.value === purchaseType)?.color || 'primary'" />
                  <span>{{purchaseTypeOptions.find(o => o.value === purchaseType)?.subtitle}}</span>
                </div>
              </div>

              <VRow>
                <VCol cols="12" md="6">
                  <VAutocomplete v-model="formData.supplier_id" :items="suppliers" item-title="name" item-value="id"
                    label="Proveedor *" placeholder="Selecciona o busca proveedor" variant="outlined"
                    density="comfortable" prepend-inner-icon="ri-store-2-line" :loading="isLoadingConfig"
                    :disabled="isDuplicateInvoice" />

                  <!-- Alerta de Saldo a Favor / NC disponible -->
                  <VAlert v-if="supplierAvailableCredit > 0 && !isDuplicateInvoice" type="info" variant="tonal"
                    density="compact" class="mt-2 rounded-lg" icon="ri-hand-coin-line">
                    <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                      <span class="text-caption">
                        Este proveedor tiene un <strong>Saldo a Favor de ${{ supplierAvailableCredit.toFixed(2)
                        }}</strong>.
                      </span>
                      <VBtn size="x-small" variant="outlined" color="info" to="/invoice/reconciliation"
                        class="text-none font-weight-bold">
                        Ir a Conciliar
                      </VBtn>
                    </div>
                  </VAlert>
                </VCol>
                <VCol cols="12" md="3">
                  <VTextField v-model="formData.invoice_number" label="N° Factura *" placeholder="000223753"
                    variant="outlined" density="comfortable" prepend-inner-icon="ri-hashtag"
                    :disabled="isDuplicateInvoice" />
                </VCol>
                <VCol cols="12" md="3">
                  <VTextField v-model="formData.issue_date" type="date" label="Fecha de Emisión *" variant="outlined"
                    density="comfortable" :disabled="isDuplicateInvoice" />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </VCol>


        <!-- 2. COLUMNA IZQUIERDA (8 COLUMNAS) -->
        <VCol cols="12" md="8">
          <!-- BANNER DE FACTURA COMPARTIDA (SOLO SI SE IMPORTA UN XML, 8 COLUMNAS) -->
          <VCard v-if="xmlLoadedInfo && !isDuplicateInvoice" class="rounded-xl border elevation-0 pa-2 bg-surface mb-2">
            <div class="d-flex flex-column flex-md-row align-start align-md-center justify-space-between gap-4">
              <div class="d-flex align-center gap-3">
                <div class="bg-primary-lighten-5 rounded-circle pa-2 d-flex align-center justify-center text-primary">
                  <VIcon icon="ri-pie-chart-2-line" size="26" />
                </div>
                <div>
                  <div class="d-flex align-center gap-2">
                    <span class="text-subtitle-1 font-weight-bold">¿Es una Factura Compartida con Terceros?</span>
                    <VSwitch v-model="isSharedInvoice" color="primary" density="compact" hide-details
                      class="d-inline-flex ms-2" @update:model-value="toggleSharedInvoice" />
                  </div>
                  <p class="text-caption text-medium-emphasis mb-0">
                    Activa esta opción si solo una parte de la compra corresponde al taller. Podrás desmarcar los
                    ítems de terceros o definir el monto asumido por ellos.
                  </p>
                </div>
              </div>

              <!-- Input directo de Monto Terceros si está activo -->
              <VExpandTransition>
                <div v-if="isSharedInvoice"
                  class="d-flex align-center gap-3 flex-wrap bg-grey-lighten-4 pa-3 rounded-lg border">
                  <div>
                    <div class="text-caption font-weight-bold text-medium-emphasis">
                      Monto Asumido por Terceros ($)
                    </div>
                    <VTextField v-model.number="totalAsumidoTerceros" type="number" min="0" step="0.01" prefix="$"
                      variant="outlined" density="compact" hide-details style="width: 140px;" />
                  </div>
                  <div class="text-caption border-s ps-3">
                    <div>Total SRI: <strong>${{ grandTotal.toFixed(2) }}</strong></div>
                    <div>Gasto Taller: <strong class="text-primary">${{ tallerMath.total.toFixed(2) }}</strong></div>
                  </div>
                </div>
              </VExpandTransition>
            </div>
          </VCard>

          <!-- DETALLE UNIFICADO DE ÍTEMS: PRODUCTOS / INSUMOS / GASTOS -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36"
                      :color="purchaseType === 'products' ? 'primary' : (purchaseType === 'supplies' ? 'info' : 'warning')"
                      variant="tonal" class="rounded-lg">
                      <VIcon
                        :icon="purchaseType === 'products' ? 'ri-box-3-line' : (purchaseType === 'supplies' ? 'ri-tools-line' : 'ri-receipt-line')"
                        size="20" />
                    </VAvatar>
                    <div>
                      <div class="d-flex align-center gap-2 flex-wrap">
                        <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                          {{ purchaseType === 'products' ? 'Detalle de Productos' : (purchaseType === 'supplies' ?
                            'Detalle de Insumos' : 'Detalle de Gastos Generales') }}
                        </h3>
                        <VChip size="x-small"
                          :color="purchaseType === 'products' ? 'primary' : (purchaseType === 'supplies' ? 'info' : 'warning')"
                          variant="tonal" class="font-weight-bold">
                          {{ items.length }}
                        </VChip>
                        <VChip v-if="isDuplicateInvoice" size="x-small" color="error" variant="tonal"
                          class="ms-1 font-weight-bold">
                          Informativo
                        </VChip>
                      </div>
                      <p class="text-caption text-medium-emphasis mb-0">
                        {{ purchaseType === 'products'
                          ? 'Artículos que ingresan al catálogo y aumentan stock'
                          : (purchaseType === 'supplies'
                            ? 'Consumibles y materiales de taller con desglose de precios, IVA y descuentos'
                            : 'Servicios y gastos generales con desglose de precios, IVA y descuentos')
                        }}
                      </p>
                    </div>
                  </div>
                  <div v-if="!xmlLoadedInfo && !isDuplicateInvoice" class="d-flex align-center gap-2 flex-wrap">
                    <VBtn color="secondary" variant="outlined" size="small" prepend-icon="ri-add-line"
                      class="rounded-lg font-weight-bold text-none" :disabled="hasEmptyQuickRow"
                      :title="hasEmptyQuickRow ? 'Completa la fila vacía antes de agregar otra' : 'Agregar fila rápida'"
                      @click="addQuickItemRow">
                      Fila Rápida
                    </VBtn>
                    <VBtn color="primary" variant="flat" size="small" prepend-icon="ri-file-add-line"
                      class="rounded-lg font-weight-bold text-none" @click="openManualProductDialog('')">
                      Ingreso Detallado
                    </VBtn>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5">
              <!-- Búsqueda en catálogo si está en modo Productos -->
              <VAutocomplete v-if="!xmlLoadedInfo && !isDuplicateInvoice && purchaseType === 'products'"
                v-model="searchProduct" :items="products" item-title="description" item-value="id"
                :custom-filter="customProductFilter" label="Buscar Producto en catálogo por Nombre o SKU para añadir..."
                placeholder="Escribe el nombre o SKU (ej: 03-005...)" variant="outlined"
                prepend-inner-icon="ri-search-line" return-object clearable class="mb-4" :menu-props="{ maxWidth: 0 }"
                :loading="isLoadingProducts" :disabled="!formData.supplier_id" @update:model-value="addProductToItems">
                <template #no-data>
                  <div class="pa-4 text-center">
                    <p class="text-medium-emphasis mb-2">
                      {{
                        formData.supplier_id ? '¿No encuentras el producto en el catálogo?'
                          : 'Seleccione un proveedor primero'
                      }}
                    </p>
                    <div class="d-flex justify-center gap-2 flex-wrap">
                      <VBtn v-if="formData.supplier_id" color="secondary" variant="outlined" size="small"
                        prepend-icon="ri-add-line" class="mt-1" :disabled="hasEmptyQuickRow"
                        :title="hasEmptyQuickRow ? 'Completa la fila vacía antes de agregar otra' : 'Agregar fila rápida'"
                        @click="addQuickItemRow">
                        Agregar Fila Rápida
                      </VBtn>
                      <VBtn v-if="formData.supplier_id" color="primary" variant="outlined" size="small"
                        prepend-icon="ri-edit-box-line" class="mt-1"
                        @click="openManualProductDialog(typeof searchProduct === 'string' ? searchProduct : '')">
                        Ingresar Detallado
                      </VBtn>
                    </div>
                  </div>
                </template>
                <template #item="{ props, item }">
                  <VListItem v-bind="props" :title="undefined">
                    <VListItemTitle style="white-space: normal !important; line-height: 1.4;"
                      class="font-weight-medium">
                      {{ item.raw.description || item.raw.name }}
                    </VListItemTitle>
                    <VListItemSubtitle class="mt-1 text-grey">
                      SKU: {{ item.raw.sku }} | Marca: {{ item.raw.brand || 'SM' }} | Costo actual: ${{
                        parseFloat(item.raw.purchase_price).toFixed(2) }}
                    </VListItemSubtitle>
                  </VListItem>
                </template>
              </VAutocomplete>

              <!-- Banner de acción rápida si está en Insumos o Gastos -->
              <div v-else-if="!xmlLoadedInfo && !isDuplicateInvoice && purchaseType !== 'products'"
                class="d-flex align-center justify-space-between flex-wrap gap-2 mb-4 pa-3 rounded-lg bg-surface border">
                <div class="d-flex align-center gap-2">
                  <VIcon :icon="purchaseType === 'supplies' ? 'ri-tools-line' : 'ri-receipt-line'"
                    :color="purchaseType === 'supplies' ? 'info' : 'warning'" size="20" />

                </div>
                <div class="d-flex align-center gap-2">
                  <VBtn color="secondary" variant="tonal" size="x-small" prepend-icon="ri-add-line"
                    class="text-none font-weight-bold" :disabled="hasEmptyQuickRow"
                    :title="hasEmptyQuickRow ? 'Completa la fila vacía antes de agregar otra' : 'Agregar fila rápida'"
                    @click="addQuickItemRow">
                    Fila Rápida
                  </VBtn>
                  <VBtn color="primary" variant="flat" size="x-small" prepend-icon="ri-file-add-line"
                    class="text-none font-weight-bold" @click="openManualProductDialog('')">
                    Ingreso Detallado
                  </VBtn>
                </div>
              </div>

              <!-- BARRA DE ASIGNACIÓN DE CATEGORÍA EN BLOQUE (Solo para productos) -->
              <div v-if="items.length > 1 && !isDuplicateInvoice && purchaseType === 'products'"
                class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4 pa-3 rounded-lg bg-grey-lighten-4 border">
                <div class="d-flex align-center gap-3">
                  <VCheckbox v-model="isBulkCategoryEnabled" color="primary" density="compact" hide-details
                    label="Asignar Categoría por Lote" class="font-weight-bold" />
                  <VChip v-if="isBulkCategoryEnabled" size="x-small" color="primary" variant="tonal"
                    class="font-weight-bold ms-1">
                    {{ selectedProductsCount }} producto(s) marcado(s)
                  </VChip>
                </div>
                <VExpandTransition>
                  <div v-if="isBulkCategoryEnabled" class="d-flex align-center gap-2 flex-grow-1 flex-sm-grow-0"
                    style="min-width: 300px;">
                    <VSelect v-model="bulkCategory" :items="categories" item-title="title" item-value="id"
                      placeholder="Seleccionar Categoría *" variant="outlined" density="compact" hide-details
                      style="min-width: 210px;" />
                    <VBtn color="primary" variant="elevated" size="small" class="font-weight-bold text-none rounded-lg"
                      @click="applyBulkCategory">
                      Aplicar
                    </VBtn>
                  </div>
                </VExpandTransition>
              </div>

              <!-- TABLA UNIFICADA DE COMPRAS CON CANTIDAD, PRECIO, DESCUENTO E IVA -->
              <VTable class="manual-purchase-table border rounded-xl overflow-hidden w-100">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <!-- Checkbox Único Maestro -->
                    <th class="text-center font-weight-bold py-3 px-1" style="width: 36px;"
                      :title="isDuplicateInvoice ? 'Número de ítem' : (isSharedInvoice ? 'Marcar si pertenece al taller / aplicar categoría' : 'Marcar para aplicar categoría')">
                      <span v-if="isDuplicateInvoice"
                        class="text-caption font-weight-bold text-medium-emphasis">#</span>
                      <VCheckbox v-else :model-value="isAllSelected" :indeterminate="isSomeSelected && !isAllSelected"
                        density="compact" hide-details @click.stop="toggleSelectAll" />
                    </th>
                    <th class="text-left font-weight-bold py-3 px-2">
                      PRODUCTO / DETALLES
                    </th>
                    <th class="text-left font-weight-bold py-3 px-2" style="width: 145px;">
                      CATEGORÍA
                    </th>
                    <th class="text-center font-weight-bold py-3 px-1" style="width: 56px;">
                      CANT.
                    </th>
                    <th class="text-center font-weight-bold py-3 px-1" style="width: 80px;">
                      PRECIO
                    </th>
                    <th class="text-center font-weight-bold py-3 px-1" style="width: 52px;">
                      IVA
                    </th>
                    <th class="text-right font-weight-bold py-3 pr-3 pl-1" style="width: 78px;">
                      SUBTOTAL
                    </th>
                    <th v-if="!xmlLoadedInfo && !isDuplicateInvoice" class="text-center font-weight-bold py-3 px-1"
                      style="width: 34px;">
                      <VIcon icon="ri-settings-3-line" size="15" color="grey" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="items.length === 0">
                    <td :colspan="xmlLoadedInfo || isDuplicateInvoice ? 7 : 8"
                      class="text-center py-10 text-medium-emphasis">
                      <VIcon
                        :icon="purchaseType === 'products' ? 'ri-shopping-bag-3-line' : (purchaseType === 'supplies' ? 'ri-tools-line' : 'ri-receipt-line')"
                        size="40" class="mb-2 text-grey-lighten-1" />
                      <div class="text-body-1 font-weight-medium">
                        No hay ítems agregados a la compra
                      </div>
                      <p class="text-caption text-medium-emphasis mb-3">
                        Carga un XML del SRI arriba o añade ítems usando los botones
                      </p>
                      <!-- <div v-if="!xmlLoadedInfo && !isDuplicateInvoice" class="d-flex justify-center gap-2">
                        <VBtn size="small" variant="outlined" color="primary" prepend-icon="ri-add-line"
                          class="text-none font-weight-bold" :disabled="hasEmptyQuickRow"
                          :title="hasEmptyQuickRow ? 'Completa la fila vacía antes de agregar otra' : 'Agregar fila rápida'"
                          @click="addQuickItemRow">
                          Fila Rápida
                        </VBtn>
                        <VBtn size="small" variant="flat" color="primary" prepend-icon="ri-file-add-line"
                          class="text-none font-weight-bold" @click="openManualProductDialog('')">
                          Ingreso Detallado
                        </VBtn>
                      </div> -->
                    </td>
                  </tr>
                  <tr v-for="(item, index) in items" :key="item.id" class="purchase-item-row"
                    :class="{ 'opacity-50 bg-grey-lighten-5': isSharedInvoice && item._selected === false }">
                    <!-- Checkbox Único por Fila -->
                    <td class="text-center py-2 px-1" style="width: 36px;">
                      <span v-if="isDuplicateInvoice" class="text-caption text-medium-emphasis font-weight-bold">{{
                        index + 1
                      }}</span>
                      <VCheckbox v-else :model-value="item._selected !== false" color="primary" density="compact"
                        hide-details
                        :title="isSharedInvoice ? 'Marcar si pertenece al taller / categoría' : 'Marcar para aplicar categoría'"
                        @update:model-value="val => onToggleItem(item, val)" />
                    </td>

                    <!-- Nombre, SKU, Tipo y Marca -->
                    <td class="py-2.5 px-2">
                      <div v-if="item.is_from_xml || isDuplicateInvoice || (!item.is_manual && item.description)"
                        class="font-weight-bold text-high-emphasis text-body-2 d-flex align-center gap-1 flex-wrap">
                        <span :class="{ 'cursor-pointer hover-product-title': !isDuplicateInvoice }"
                          :title="!isDuplicateInvoice ? 'Clic para configurar ítem (Producto, Insumo o Gasto) y su marca' : ''"
                          @click="!isDuplicateInvoice ? openBrandDialog(item) : null">
                          {{ item.description }}
                        </span>
                        <VChip v-if="item.is_from_xml" size="x-small" color="success" variant="tonal"
                          class="font-weight-bold px-1" style="height: 17px; font-size: 0.65rem;">
                          XML
                        </VChip>
                      </div>
                      <div v-else class="mb-1">
                        <input v-model="item.description" type="text"
                          class="table-cell-input text-left font-weight-bold px-2 py-1 rounded border w-100"
                          placeholder="Descripción del ítem *" style="font-size: 0.85rem;"
                          @keydown.enter.prevent="addQuickItemRow" />
                      </div>

                      <div class="text-caption text-medium-emphasis mt-1 d-flex align-center gap-1.5 flex-wrap">
                        <span v-if="item.code">SKU: <strong class="text-high-emphasis">{{ item.code }}</strong></span>
                        <span v-if="item.code" class="text-disabled">•</span>

                        <VChip v-if="!isDuplicateInvoice && item._selected !== false" size="x-small"
                          :color="Number(item.item_type) === 1 ? 'primary' : (Number(item.item_type) === 3 ? 'warning' : 'info')"
                          variant="tonal" class="font-weight-bold px-1.5 cursor-pointer hover-brand-chip"
                          style="height: 19px; font-size: 0.7rem;"
                          :title="'Clic para cambiar clasificación (Producto / Insumo / Gasto)'"
                          @click.stop="openBrandDialog(item)">
                          <VIcon
                            :icon="Number(item.item_type) === 1 ? 'ri-box-3-line' : (Number(item.item_type) === 3 ? 'ri-archive-line' : 'ri-tools-line')"
                            size="12" class="me-0.5" />
                          {{ Number(item.item_type) === 1 ? 'Producto' : (Number(item.item_type) === 3 ? 'Insumo Taller'
                            :
                            'Gasto Directo') }}
                        </VChip>

                        <!-- Chip interactivo de Marca para abrir el VDialog si es producto o insumo por envase -->
                        <VChip
                          v-if="(Number(item.item_type) === 1 || Number(item.item_type) === 3) && !isDuplicateInvoice"
                          size="x-small" color="secondary" variant="outlined"
                          class="font-weight-bold cursor-pointer hover-brand-chip px-1.5"
                          style="height: 20px; font-size: 0.7rem;" title="Clic para editar la marca o clasificación"
                          @click.stop="openBrandDialog(item)">
                          <VIcon icon="ri-price-tag-3-line" size="11" class="me-1 text-primary" />
                          <span>Marca: <strong class="text-primary">{{ item.brand || 'SM' }}</strong></span>
                          <VIcon icon="ri-pencil-line" size="10" class="ms-1 opacity-70" />
                        </VChip>
                        <span
                          v-else-if="(Number(item.item_type) === 1 || Number(item.item_type) === 3) && item.brand && item.brand !== 'N/A'"
                          class="text-caption text-medium-emphasis">
                          • {{ item.brand }}
                        </span>
                      </div>
                    </td>

                    <!-- Selector Editable de Categoría (Solo si es Producto) -->
                    <td class="py-2 px-2" style="width: 145px;">
                      <div v-if="isDuplicateInvoice" class="text-caption text-medium-emphasis text-truncate"
                        :title="getCategoryName(item.product_categorie_id)">
                        <span v-if="getCategoryName(item.product_categorie_id)" class="text-primary font-weight-medium">
                          {{ getCategoryName(item.product_categorie_id) }}
                        </span>
                        <span v-else class="text-disabled">—</span>
                      </div>
                      <VSelect v-else-if="item._selected !== false && Number(item.item_type) === 1"
                        v-model="item.product_categorie_id" :items="categories" item-title="title" item-value="id"
                        placeholder="Categoría *" variant="outlined" density="compact" hide-details
                        class="custom-table-select" />
                      <div v-else
                        class="text-caption text-medium-emphasis text-center py-1 px-1 bg-grey-lighten-4 rounded border border-dashed">
                        <span style="font-size: 0.72rem;">{{ Number(item.item_type) === 3 ? 'Insumo Taller'
                          : 'Gasto (No aplica) ' }}</span>
                      </div>
                    </td>

                    <!-- Cantidad (Columna Individual - Editable) -->
                    <td class="text-center py-2 px-1" style="width: 56px;">
                      <div v-if="!isDuplicateInvoice" class="table-cell-input-box qty-box">
                        <input v-model.number="item.quantity" type="number" min="0.01" step="any"
                          class="table-cell-input text-center" placeholder="1" @input="updateItemTotals(item)">
                      </div>
                      <span v-else class="text-body-2 font-weight-bold text-high-emphasis">
                        {{ item.quantity }}
                      </span>
                    </td>

                    <!-- Precio Unitario (Columna Individual - Editable) -->
                    <td class="text-center py-2 px-1" style="width: 80px;">
                      <div v-if="!isDuplicateInvoice" class="table-cell-input-box price-box">
                        <span class="table-cell-prefix">$</span>
                        <input v-model.number="item.unit_price" type="number" min="0" step="0.0001"
                          class="table-cell-input text-right" placeholder="0.00" @input="updateItemTotals(item)"
                          @keydown.enter.prevent="addQuickItemRow">
                      </div>
                      <span v-else class="text-body-2 font-weight-medium text-grey-darken-3">${{
                        Number(item.unit_price || 0).toFixed(2)
                      }}</span>
                    </td>

                    <!-- IVA Toggle Chip -->
                    <td class="text-center py-2 px-1" style="width: 52px;">
                      <VChip v-if="!isDuplicateInvoice" size="x-small"
                        :color="item.is_taxable == 1 ? 'primary' : 'default'"
                        :variant="item.is_taxable == 1 ? 'tonal' : 'outlined'"
                        class="font-weight-bold cursor-pointer px-1" style="height: 22px; font-size: 0.72rem;"
                        :title="item.is_taxable == 1 ? `Grava IVA ${taxPercent}% (Clic para cambiar a 0%)` : `No grava IVA (Clic para cambiar a ${taxPercent}%)`"
                        @click="toggleItemTax(item)">
                        {{ item.is_taxable == 1 ? `${taxPercent}%` : '0%' }}
                      </VChip>
                      <span v-else class="text-caption font-weight-medium" style="font-size: 0.72rem;">
                        {{ item.is_taxable == 1 ? `${taxPercent}%` : '0%' }}
                      </span>
                    </td>

                    <!-- Subtotal (Columna Individual) -->
                    <td class="text-right py-2 pr-3 pl-1" style="width: 78px;">
                      <div class="font-weight-bold text-body-2 text-primary">
                        ${{ Number(item.subtotal || 0).toFixed(2) }}
                      </div>
                      <div v-if="item.is_taxable == 1" class="text-caption text-medium-emphasis"
                        style="font-size: 0.68rem; line-height: 1.1;">
                        +IVA ${{ Number(item.tax || 0).toFixed(2) }}
                      </div>
                      <div v-if="item.discount > 0" class="text-caption text-error text-no-wrap"
                        style="font-size: 0.68rem; line-height: 1.1;">
                        -${{ Number(item.discount).toFixed(2) }}
                      </div>
                    </td>

                    <!-- Acción Eliminar (Oculta si es importado de XML) -->
                    <td v-if="!xmlLoadedInfo && !isDuplicateInvoice" class="text-center py-2 px-1" style="width: 34px;">
                      <VBtn v-if="!item.is_from_xml" icon="ri-delete-bin-line" color="error" variant="text"
                        size="x-small" class="rounded-lg" title="Eliminar ítem" @click="removeItem(index)" />
                    </td>
                  </tr>
                </tbody>
              </VTable>

              <!-- Footer de la tabla con acciones rápidas y totales en vivo -->
              <div v-if="items.length > 0 && !xmlLoadedInfo && !isDuplicateInvoice"
                class="d-flex align-center justify-space-between flex-wrap gap-2 mt-4 pt-2">
                <!-- <div class="d-flex align-center gap-2">
                  <VBtn variant="outlined" color="primary" size="small" prepend-icon="ri-add-line"
                    class="rounded-lg font-weight-bold text-none" :disabled="hasEmptyQuickRow"
                    :title="hasEmptyQuickRow ? 'Completa la fila vacía antes de agregar otra' : 'Agregar fila rápida'"
                    @click="addQuickItemRow">
                    Fila Rápida
                  </VBtn>
                  <VBtn variant="tonal" color="primary" size="small" prepend-icon="ri-file-add-line"
                    class="rounded-lg font-weight-bold text-none" @click="openManualProductDialog('')">
                    Ingreso Detallado
                  </VBtn>
                </div> -->
                <div
                  class="ms-auto d-flex align-center gap-3 flex-wrap text-caption font-weight-bold text-medium-emphasis">
                  <span>Subtotal: <strong class="text-high-emphasis">${{ subtotal.toFixed(2) }}</strong></span>
                  <span v-if="totalDiscount > 0" class="text-error">Dcto: <strong>-${{ totalDiscount.toFixed(2)
                  }}</strong></span>
                  <span>IVA: <strong class="text-high-emphasis">${{ totalTax.toFixed(2) }}</strong></span>
                  <span>Total: <strong class="text-primary text-body-2">${{ grandTotal.toFixed(2) }}</strong></span>
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- SECCION FINANCIERA Y TOTALES -->
        <VCol cols="12" md="4">
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden"
            :class="{ 'opacity-90 bg-grey-lighten-5': isDuplicateInvoice }">
            <VCardItem class="py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-money-dollar-circle-line" size="20" />
                    </VAvatar>
                    <div>
                      <div class="d-flex align-center gap-2 flex-wrap">
                        <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                          Origen de Fondos
                        </h3>
                        <VChip v-if="isDuplicateInvoice" size="x-small" color="error" variant="tonal"
                          class="font-weight-bold">
                          Solo Lectura
                        </VChip>
                      </div>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Forma de pago o financiamiento
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5">
              <VRadioGroup v-model="formData.payment_type" class="mb-4" :disabled="isDuplicateInvoice">
                <VRadio label="Pago Inmediato (Caja/Banco)" value="efectivo" color="success" />
                <VRadio label="Cuenta por Pagar (Crédito)" value="credito" color="primary" />
                <VRadio label="Financiado por Socio (Aporte)" value="aporte" color="warning" />
              </VRadioGroup>

              <!-- Conditional Selectors -->
              <VExpandTransition>
                <div v-if="formData.payment_type === 'efectivo'">
                  <VSelect v-model="formData.account_id" :items="accounts" item-title="name" item-value="id"
                    label="Cuenta de Egreso (Origen de Fondos) *" placeholder="Seleccione la cuenta obligatoria"
                    variant="outlined" density="comfortable" prepend-inner-icon="ri-bank-card-line"
                    :rules="[val => !!val || 'Debe escoger obligatoriamente de qué cuenta salen los fondos']"
                    :loading="isLoadingConfig" :disabled="isDuplicateInvoice" />
                  <p class="text-caption text-medium-emphasis mt-1 mb-0">
                    <VIcon icon="ri-information-line" size="14" class="me-1" />
                    El monto pagado se descontará automáticamente del saldo de esta cuenta.
                  </p>
                </div>
              </VExpandTransition>

              <VExpandTransition>
                <div v-if="formData.payment_type === 'aporte'">
                  <VSelect v-model="formData.partner_id" :items="partners" item-title="nombre" item-value="id"
                    label="Seleccionar Socio Capitalista *" variant="outlined" density="comfortable"
                    prepend-inner-icon="ri-user-star-line" :loading="isLoadingConfig" :disabled="isDuplicateInvoice" />
                </div>
              </VExpandTransition>

              <VAlert v-if="formData.payment_type === 'credito'" color="primary" variant="tonal"
                icon="ri-information-line" class="mt-2 text-caption">
                <span v-if="purchaseType === 'products'">
                  Se registrará la compra en el inventario e incrementará el stock, y se creará una Cuenta por Pagar
                  asociada al
                  proveedor. No se descontará dinero de las cuentas todavía.
                </span>
                <span v-else-if="purchaseType === 'supplies'">
                  Se registrarán los insumos de taller como gasto operativo sin alterar catálogo de venta, y se creará
                  una
                  Cuenta por Pagar asociada al proveedor.
                </span>
                <span v-else>
                  Se registrará el gasto general y se creará una Cuenta por Pagar asociada al proveedor. No se
                  descontará dinero
                  de las cuentas todavía.
                </span>
              </VAlert>
            </VCardText>
          </VCard>

          <!-- RESUMEN TOTAL -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden bg-surface">
            <VCardItem class="py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="36" color="primary" variant="tonal" class="rounded-lg">
                      <VIcon icon="ri-calculator-line" size="20" />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                        Resumen de Factura
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Totales y valores a liquidar
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5">
              <div class="d-flex justify-space-between mb-2 align-center">
                <span class="text-medium-emphasis">Tipo de Registro</span>
                <VChip size="x-small"
                  :color="purchaseType === 'products' ? 'primary' : (purchaseType === 'supplies' ? 'info' : 'warning')"
                  variant="tonal" class="font-weight-bold">
                  {{purchaseTypeOptions.find(o => o.value === purchaseType)?.title || 'Compra'}}
                </VChip>
              </div>

              <div class="d-flex justify-space-between mb-2">
                <span class="text-medium-emphasis">Subtotal</span>
                <span class="font-weight-bold">${{ subtotal.toFixed(2) }}</span>
              </div>

              <div v-if="totalDiscount > 0" class="d-flex justify-space-between mb-2 text-error">
                <span class="text-caption font-weight-bold">(-) Descuentos</span>
                <span class="font-weight-bold">-${{ totalDiscount.toFixed(2) }}</span>
              </div>

              <div class="d-flex justify-space-between mb-2">
                <span class="text-medium-emphasis">Impuestos (IVA {{ taxPercent }}%)</span>
                <span class="font-weight-bold">${{ totalTax.toFixed(2) }}</span>
              </div>

              <div class="d-flex justify-space-between mb-3">
                <span class="text-medium-emphasis">Ítems Registrados</span>
                <span class="font-weight-bold">{{ items.length }}</span>
              </div>

              <!-- Desglose Mercadería vs Insumos Taller -->
              <div v-if="items.length > 0" class="mb-4 pa-3 rounded-lg bg-grey-lighten-5 border">
                <div
                  class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-2 d-flex align-center justify-space-between">
                  <span>Destino Contable</span>
                  <VIcon icon="ri-pie-chart-2-line" size="14" />
                </div>

                <!-- Mercadería Comercial -->
                <div class="d-flex justify-space-between align-center mb-1.5">
                  <div class="d-flex align-center gap-1.5 text-caption">
                    <span class="rounded-circle bg-primary"
                      style="width: 8px; height: 8px; display: inline-block;"></span>
                    <span>Mercadería (Stock Venta):</span>
                  </div>
                  <span class="font-mono font-weight-bold text-caption text-primary">
                    ${{ purchaseBreakdown.commercialTotal.toFixed(2) }}
                  </span>
                </div>

                <!-- Insumos y Gastos Taller -->
                <div class="d-flex justify-space-between align-center">
                  <div class="d-flex align-center gap-1.5 text-caption">
                    <span class="rounded-circle bg-info" style="width: 8px; height: 8px; display: inline-block;"></span>
                    <span>Insumos / Gasto Taller:</span>
                  </div>
                  <span class="font-mono font-weight-bold text-caption text-info">
                    ${{ purchaseBreakdown.workshopTotal.toFixed(2) }}
                  </span>
                </div>
                <div v-if="purchaseBreakdown.workshopStockTotal > 0 && purchaseBreakdown.workshopConsumableTotal > 0"
                  class="text-caption text-disabled mt-1 ps-3" style="font-size: 0.68rem;">
                  (Envases: ${{ purchaseBreakdown.workshopStockTotal.toFixed(2) }} | Directos: ${{
                    purchaseBreakdown.workshopConsumableTotal.toFixed(2) }})
                </div>
              </div>

              <!-- Desglose de Factura Compartida -->
              <VExpandTransition>
                <div v-if="isSharedInvoice">
                  <VDivider class="mb-3" />
                  <div class="d-flex justify-space-between mb-2 text-error">
                    <span class="text-caption font-weight-bold">(-) Asumido por Terceros</span>
                    <span class="font-weight-bold">-${{ tercerosMath.total.toFixed(2) }}</span>
                  </div>
                  <div
                    class="d-flex justify-space-between mb-4 align-center bg-primary-lighten-5 pa-3 rounded-lg border border-primary border-opacity-25">
                    <div>
                      <div class="text-subtitle-2 font-weight-bold text-primary">
                        Gasto Real Taller
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        Monto a pagar/egresar
                      </div>
                    </div>
                    <span class="text-h4 font-weight-black text-primary">${{ tallerMath.total.toFixed(2) }}</span>
                  </div>
                </div>
              </VExpandTransition>

              <VDivider class="mb-4" />

              <div class="d-flex justify-space-between mb-6 align-center">
                <span class="text-h6 font-weight-bold">Total Factura</span>
                <span class="text-h4 font-weight-black text-primary">${{ grandTotal.toFixed(2) }}</span>
              </div>

              <VBtn block :color="isDuplicateInvoice ? 'secondary' : 'primary'" height="42"
                :elevation="isDuplicateInvoice ? 0 : 2" :loading="isSubmitting" :disabled="isDuplicateInvoice"
                :prepend-icon="isDuplicateInvoice ? 'ri-lock-2-line' : 'ri-save-3-line'"
                :variant="isDuplicateInvoice ? 'tonal' : 'elevated'" class="rounded-lg font-weight-bold text-none mt-2"
                style="font-size: 0.92rem; letter-spacing: 0.2px;" @click="submitPurchase">
                {{ isDuplicateInvoice
                  ? 'Factura Ya Registrada'
                  : (purchaseType === 'products'
                    ? 'Registrar Compra de Productos'
                    : (purchaseType === 'supplies' ? 'Registrar Insumos de Taller' : 'Registrar Gasto General'))
                }}
              </VBtn>

              <VBtn block variant="outlined" color="secondary" height="42" prepend-icon="ri-close-line"
                class="rounded-lg font-weight-medium text-none mt-2" @click="cancelAndReturn">
                Cancelar
              </VBtn>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- Modal Dialog para Agregar Producto Manual -->
    <VDialog v-model="isManualProductDialogOpen" scrollable max-width="600">
      <VCard class="custom-dialog-card">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn"
            @click="isManualProductDialogOpen = false" />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-add-box-line" />
          </div>
          <h3 class="custom-dialog-title">
            {{ Number(manualItem.item_type) === 1 ? 'Ingresar Producto al Inventario' : (Number(manualItem.item_type)
              === 3
              ? 'Ingresar Insumo por Envase / Caja' : 'Ingresar Gasto Directo de Taller') }}
          </h3>
          <p class="custom-dialog-subtitle">
            {{ Number(manualItem.item_type) === 1 ? 'Agrega un producto comercial al catálogo con stock para venta' :
              (Number(manualItem.item_type) === 3
                ? 'Agrega un insumo por caja/envase cerrado para inventario interno y salidas de taller'
                : 'Agrega un gasto operativo o consumible directo sin inventario') }}
          </p>
        </div>

        <VCardText class="pa-4">
          <VRow dense>
            <VCol cols="12" class="mb-2">
              <VTextField v-model="manualItem.description" label="Descripción / Nombre del Producto *"
                placeholder="Ej: Aceite Sintético 5W30 4L o Flete de transporte" variant="outlined"
                density="comfortable" prepend-inner-icon="ri-text" />
            </VCol>

            <VCol cols="12" sm="6" class="mb-2">
              <VSelect v-model="manualItem.item_type" :items="itemTypeOptions" item-title="title" item-value="value"
                label="Tipo de Ítem *" variant="outlined" density="comfortable"
                prepend-inner-icon="ri-price-tag-2-line" />
            </VCol>

            <VCol cols="12" sm="6" class="mb-2">
              <VTextField v-model="manualItem.code" label="Código / SKU" placeholder="Ej: PROD-101 (Opcional)"
                variant="outlined" density="comfortable" prepend-inner-icon="ri-barcode-line" />
            </VCol>

            <VCol v-if="Number(manualItem.item_type) === 1 || Number(manualItem.item_type) === 3" cols="12" sm="6"
              class="mb-2">
              <VCombobox v-model="manualItem.brand" :items="brands"
                :label="Number(manualItem.item_type) === 1 ? 'Marca del Producto' : 'Marca del Insumo'"
                placeholder="Seleccionar o escribir marca nueva..." variant="outlined" density="comfortable"
                prepend-inner-icon="ri-price-tag-3-line" clearable :return-object="false" />
            </VCol>

            <VCol v-if="Number(manualItem.item_type) === 1" cols="12" sm="6" class="mb-2">
              <VSelect v-model="manualItem.product_categorie_id" :items="categories" item-title="title" item-value="id"
                label="Categoría del Producto *" placeholder="Seleccione categoría" variant="outlined"
                density="comfortable" prepend-inner-icon="ri-folders-line" />
            </VCol>

            <VCol cols="12" sm="4" class="mb-2">
              <VTextField v-model.number="manualItem.quantity" type="number" min="0.01" step="1" label="Cantidad *"
                variant="outlined" density="comfortable" />
            </VCol>

            <VCol cols="12" sm="4" class="mb-2">
              <VTextField v-model.number="manualItem.unit_price" type="number" min="0" step="0.01" prefix="$"
                label="Precio Unitario *" placeholder="0.00" variant="outlined" density="comfortable" />
            </VCol>

            <VCol cols="12" sm="4" class="mb-2">
              <VTextField v-model.number="manualItem.discount" type="number" min="0" step="0.01" prefix="$"
                label="Descuento ($)" placeholder="0.00" variant="outlined" density="comfortable" />
            </VCol>

            <VCol cols="12">
              <VSwitch v-model="manualItem.is_taxable" label="Aplica IVA (15%)" color="primary" hide-details />
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;">
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line"
            class="rounded-lg px-6 font-weight-medium" height="40" @click="isManualProductDialogOpen = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-add-line" class="rounded-lg px-6 font-weight-bold"
            height="40" @click="addManualProduct">
            Añadir a la Compra
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Modal Dialog para Clasificación y Marca del Ítem -->
    <VDialog v-model="isBrandDialogOpen" scrollable max-width="560">
      <VCard class="custom-dialog-card elevation-16">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary">
          <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn"
            @click="isBrandDialogOpen = false" />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-settings-4-line" />
          </div>
          <h3 class="custom-dialog-title">
            Configuración y Clasificación del Ítem
          </h3>
          <p class="custom-dialog-subtitle">
            Define si este ítem es Producto para venta, Insumo de taller o Gasto directo (logística/flete)
          </p>
        </div>

        <VCardText class="pa-4">
          <!-- Detalle del Ítem / Repuesto -->
          <div class="pa-3 rounded-xl bg-slate-50 border border-slate-200 mb-4">
            <div class="d-flex align-center justify-space-between mb-1">
              <span class="text-caption font-weight-bold text-slate-500 text-uppercase tracking-wider">
                Ítem en la Factura
              </span>
              <div class="d-flex align-center gap-1.5">
                <VChip v-if="selectedBrandItem?.code" size="x-small" color="primary" variant="tonal"
                  class="font-weight-bold">
                  SKU: {{ selectedBrandItem.code }}
                </VChip>
                <VChip v-if="selectedBrandItem?.subtotal" size="x-small" color="success" variant="tonal"
                  class="font-weight-bold font-mono">
                  ${{ Number(selectedBrandItem.subtotal).toFixed(2) }}
                </VChip>
              </div>
            </div>
            <div class="text-body-2 font-weight-bold text-slate-900">
              {{ selectedBrandItem?.description || 'Sin descripción' }}
            </div>
          </div>

          <!-- Selector de Tipo de Ítem (Producto vs Insumo vs Gasto) -->
          <div class="mb-4">
            <label class="text-caption font-weight-bold text-slate-700 mb-1.5 d-block">
              ¿Cómo debe registrarse este ítem en el sistema?
            </label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button type="button" class="item-type-select-btn"
                :class="{ 'active primary-active': itemEditType === 1 }" @click="itemEditType = 1">
                <VIcon icon="ri-box-3-line" size="22" class="mb-1" />
                <div class="btn-main-title">Producto</div>
                <div class="btn-sub-title">Stock Venta</div>
              </button>

              <button type="button" class="item-type-select-btn"
                :class="{ 'active warning-active': itemEditType === 3 }" @click="itemEditType = 3">
                <VIcon icon="ri-archive-line" size="22" class="mb-1" />
                <div class="btn-main-title">Insumo</div>
                <div class="btn-sub-title">Uso Taller</div>
              </button>

              <button type="button" class="item-type-select-btn" :class="{ 'active info-active': itemEditType === 2 }"
                @click="itemEditType = 2">
                <VIcon icon="ri-tools-line" size="22" class="mb-1" />
                <div class="btn-main-title">Gasto / Flete</div>
                <div class="btn-sub-title">Logística</div>
              </button>
            </div>
          </div>

          <!-- Si es Producto (Tipo 1) -->
          <div v-if="itemEditType === 1">
            <!-- Categoría del Producto -->
            <div class="mb-3">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 d-block">
                Categoría del Producto *:
              </label>
              <VSelect v-model="itemEditCategory" :items="categories" item-title="title" item-value="id"
                placeholder="Seleccione la categoría..." variant="outlined" density="comfortable"
                prepend-inner-icon="ri-folders-line" clearable />
            </div>

            <!-- Marca del Producto -->
            <div class="mb-3">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 d-block">
                Marca del Amortiguador / Producto:
              </label>
              <VCombobox v-model="brandEditValue" :items="brands"
                placeholder="Seleccionar o escribir marca (ej: TOKICO, KYB, MONROE)..." variant="outlined"
                density="comfortable" prepend-inner-icon="ri-price-tag-3-line" clearable :return-object="false"
                @keydown.enter="saveBrandEdit" />
            </div>

            <!-- Marcas Sugeridas Rápidas -->
            <div class="mb-3">
              <div class="text-caption font-weight-medium text-slate-500 mb-1">
                Marcas frecuentes (clic rápido):
              </div>
              <div class="d-flex flex-wrap gap-1.5">
                <VChip v-for="b in popularShockBrands" :key="b" size="small" variant="outlined"
                  :color="brandEditValue?.toUpperCase() === b ? 'primary' : 'default'"
                  class="cursor-pointer font-weight-medium"
                  :class="{ 'bg-primary-tonal font-weight-bold border-primary': brandEditValue?.toUpperCase() === b }"
                  @click="brandEditValue = b">
                  {{ b }}
                </VChip>
              </div>
            </div>

            <!-- Opción: Aplicar a similares -->
            <div class="pa-2.5 rounded-lg bg-grey-lighten-4 border border-dashed mb-2">
              <VCheckbox v-model="applyToSimilarBrand" color="primary" density="compact" hide-details>
                <template #label>
                  <span class="text-caption font-weight-medium text-slate-800">
                    Aplicar también esta marca y categoría a otros productos similares en esta compra
                  </span>
                </template>
              </VCheckbox>
            </div>
          </div>

          <!-- Si es Insumo de Taller (Tipo 3) -->
          <div v-else-if="itemEditType === 3">
            <VAlert type="warning" variant="tonal" density="compact" class="rounded-lg mb-3 text-caption"
              icon="ri-archive-line">
              Este ítem ingresará al inventario interno de taller por caja/envase cerrado (salida por consumo en 1
              clic). NO
              se venderá en el punto de venta.
            </VAlert>

            <div class="mb-3">
              <label class="text-caption font-weight-bold text-slate-700 mb-1 d-block">
                Marca del Insumo (Opcional):
              </label>
              <VCombobox v-model="brandEditValue" :items="brands"
                placeholder="Seleccionar o escribir marca (ej: SM, WURTH, ABRO)..." variant="outlined"
                density="comfortable" prepend-inner-icon="ri-price-tag-3-line" clearable :return-object="false" />
            </div>
          </div>

          <!-- Si es Gasto Directo / Logística (Tipo 2) -->
          <div v-else-if="itemEditType === 2">
            <VAlert type="info" variant="tonal" density="compact" class="rounded-lg mb-2 text-caption"
              icon="ri-tools-line">
              <strong>Gasto Directo / Operativo:</strong> Este ítem (ej. flete, transporte, logística, servicios o
              consumibles) se registrará como egreso contable directo sin crear un producto en el catálogo comercial ni
              alterar stock.
            </VAlert>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white"
          style="position: sticky; bottom: 0; z-index: 2;">
          <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line"
            class="rounded-lg px-5 font-weight-medium" height="40" @click="isBrandDialogOpen = false">
            Cancelar
          </VBtn>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-check-line" class="rounded-lg px-6 font-weight-bold"
            height="40" @click="saveBrandEdit">
            Guardar Configuración
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

  </div>
</template>

<style scoped>
.hover-product-title {
  transition: color 0.15s ease;
}

.hover-product-title:hover {
  color: rgb(var(--v-theme-primary)) !important;
  text-decoration: underline;
}

.hover-brand-chip {
  transition: all 0.15s ease;
}

.hover-brand-chip:hover {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
  border-color: rgb(var(--v-theme-primary)) !important;
  transform: translateY(-1px);
}

.item-type-select-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 6px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  user-select: none;
}

.item-type-select-btn .btn-main-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.item-type-select-btn .btn-sub-title {
  font-size: 0.67rem;
  color: #64748b;
  margin-top: 2px;
}

.item-type-select-btn:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.item-type-select-btn.active {
  border-width: 2px;
}

.item-type-select-btn.active.primary-active {
  border-color: #4f46e5;
  background: #eef2ff;
}

.item-type-select-btn.active.primary-active :deep(.v-icon),
.item-type-select-btn.active.primary-active .btn-main-title {
  color: #4338ca !important;
}

.item-type-select-btn.active.warning-active {
  border-color: #d97706;
  background: #fffbeb;
}

.item-type-select-btn.active.warning-active :deep(.v-icon),
.item-type-select-btn.active.warning-active .btn-main-title {
  color: #b45309 !important;
}

.item-type-select-btn.active.info-active {
  border-color: #0284c7;
  background: #f0f9ff;
}

.item-type-select-btn.active.info-active :deep(.v-icon),
.item-type-select-btn.active.info-active .btn-main-title {
  color: #0369a1 !important;
}

/* Radio Buttons Súper Chéveres estilo Píldora (Pixel-Perfect, sin recortes) */
.purchase-type-radio-container {
  min-width: max-content;
}

.custom-radio-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 13px 0 9px;
  border-radius: 9999px;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
  white-space: nowrap !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.custom-radio-pill .custom-radio-circle {
  width: 17px;
  height: 17px;
  min-width: 17px;
  min-height: 17px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  background: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

.custom-radio-pill .custom-radio-circle .custom-radio-dot {
  width: 7px;
  height: 7px;
  min-width: 7px;
  min-height: 7px;
  border-radius: 50%;
  background: transparent;
  transform: scale(0);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-sizing: border-box;
}

.custom-radio-pill .pill-icon {
  color: #64748b;
  transition: all 0.2s ease;
}

.custom-radio-pill .pill-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.1px;
  transition: color 0.2s ease;
}

.custom-radio-pill:hover:not(.is-disabled) {
  border-color: #cbd5e1;
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.custom-radio-pill:hover:not(.is-disabled) .custom-radio-circle {
  border-color: #94a3b8;
}

/* Activo: Productos (Stock) */
.custom-radio-pill.is-active.type-products {
  border-color: #4f46e5;
  background: #eef2ff;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.16);
}

.custom-radio-pill.is-active.type-products .custom-radio-circle {
  border-color: #4f46e5;
  background: #ffffff;
}

.custom-radio-pill.is-active.type-products .custom-radio-circle .custom-radio-dot {
  background: #4f46e5;
  transform: scale(1);
}

.custom-radio-pill.is-active.type-products .pill-icon {
  color: #4f46e5;
  transform: scale(1.08);
}

.custom-radio-pill.is-active.type-products .pill-label {
  color: #3730a3;
  font-weight: 700;
}

/* Activo: Insumos Taller */
.custom-radio-pill.is-active.type-supplies {
  border-color: #d97706;
  background: #fffbeb;
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.16);
}

.custom-radio-pill.is-active.type-supplies .custom-radio-circle {
  border-color: #d97706;
  background: #ffffff;
}

.custom-radio-pill.is-active.type-supplies .custom-radio-circle .custom-radio-dot {
  background: #d97706;
  transform: scale(1);
}

.custom-radio-pill.is-active.type-supplies .pill-icon {
  color: #d97706;
  transform: scale(1.08);
}

.custom-radio-pill.is-active.type-supplies .pill-label {
  color: #92400e;
  font-weight: 700;
}

/* Activo: Gasto General */
.custom-radio-pill.is-active.type-expenses {
  border-color: #0284c7;
  background: #f0f9ff;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.16);
}

.custom-radio-pill.is-active.type-expenses .custom-radio-circle {
  border-color: #0284c7;
  background: #ffffff;
}

.custom-radio-pill.is-active.type-expenses .custom-radio-circle .custom-radio-dot {
  background: #0284c7;
  transform: scale(1);
}

.custom-radio-pill.is-active.type-expenses .pill-icon {
  color: #0284c7;
  transform: scale(1.08);
}

.custom-radio-pill.is-active.type-expenses .pill-label {
  color: #075985;
  font-weight: 700;
}

.custom-radio-pill.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
