<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { XMLParser } from "fast-xml-parser"

const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const isSubmitting = ref(false)
const isLoadingConfig = ref(false)
const isLoadingProducts = ref(false)

// Config data
const suppliers = ref([])
const categories = ref([])
const accounts = ref([])
const partners = ref([])
const products = ref([])

// Saldo a favor disponible del proveedor
const supplierAvailableCredit = ref(0)

// XML Import State
const xmlFileInputRef = ref(null)
const isDragging = ref(false)
const xmlLoadedInfo = ref(null)
const isParsingXml = ref(false)

const checkSupplierCredit = async (supId) => {
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

// Tipos de Ítems (Producto vs Gasto/Logística)
const itemTypeOptions = [
  { title: '📦 Producto (Stock)', value: 1 },
  { title: '🚚 Gasto / Logística', value: 2 },
  { title: '🔧 Servicio', value: 3 },
  { title: '🔨 Herramienta', value: 4 },
]

// Check Unificado (Categoría en Bloque + Factura Compartida / Inventario)
const bulkCategory = ref(null)

const isAllSelected = computed(() => {
  if (items.value.length === 0) return false
  return items.value.every(item => item._selected !== false)
})

const isSomeSelected = computed(() => {
  return items.value.some(item => item._selected !== false)
})

const selectedProductsCount = computed(() => {
  return items.value.filter(item => item._selected !== false && Number(item.item_type) === 1).length
})

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
  if (Number(item.item_type) !== 1) {
    item.product_categorie_id = null
  }
}

// Factura Compartida
const isSharedInvoice = ref(false)
const totalAsumidoTerceros = ref(0)

const calculateTercerosFromUnchecked = () => {
  let autoTotal = 0
  items.value.forEach(item => {
    if (item._selected === false) {
      const sub = (Number(item.quantity) * Number(item.unit_price)) - (Number(item.discount) || 0)
      const tax = item.is_taxable ? sub * 0.15 : 0
      autoTotal += sub + tax
    }
  })
  totalAsumidoTerceros.value = Number(autoTotal.toFixed(2))
}

const toggleSharedInvoice = () => {
  if (!isSharedInvoice.value) {
    totalAsumidoTerceros.value = 0
    items.value.forEach(i => i._selected = true)
  } else {
    calculateTercerosFromUnchecked()
  }
}

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

// Items State
const items = ref([])
const searchProduct = ref(null)

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

const openManualProductDialog = (initialSearch = '') => {
  manualItem.value = {
    description: typeof initialSearch === 'string' ? initialSearch : '',
    code: '',
    product_categorie_id: categories.value[0]?.id || null,
    brand: 'SM',
    item_type: 1,
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

  const isProduct = Number(manualItem.value.item_type) === 1
  if (isProduct && !manualItem.value.product_categorie_id) {
    return showNotification('Debe seleccionar una categoría para el producto', 'warning')
  }

  const qty = Number(manualItem.value.quantity) || 1
  const price = Number(manualItem.value.unit_price) || 0
  const disc = Number(manualItem.value.discount) || 0
  const sub = qty * price
  const isTaxable = manualItem.value.is_taxable ? 1 : 0
  const taxVal = isTaxable === 1 ? (sub - disc) * 0.15 : 0

  items.value.push({
    id: Date.now(),
    code: manualItem.value.code && manualItem.value.code.trim() ? manualItem.value.code.trim().toUpperCase() : (isProduct ? `MANUAL-${Date.now().toString().slice(-6)}` : 'GASTO-LOGISTICA'),
    description: manualItem.value.description.trim(),
    brand: isProduct ? (manualItem.value.brand && manualItem.value.brand.trim() ? manualItem.value.brand.trim() : 'SM') : 'N/A',
    quantity: qty,
    unit_price: price,
    subtotal: sub,
    discount: disc,
    tax: taxVal,
    total: (sub - disc) + taxVal,
    item_type: Number(manualItem.value.item_type) || 1,
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

const handleXmlFileSelect = (event) => {
  const file = event.target.files ? event.target.files[0] : null
  if (file) {
    processXmlFile(file)
  }
  // Reset input value so the same file can be selected again if needed
  if (event.target) event.target.value = ''
}

const handleXmlDrop = (event) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    processXmlFile(file)
  }
}

const processXmlFile = async (file) => {
  if (!file) return

  const isXml = file.type === 'application/xml' || file.type === 'text/xml' || file.name.toLowerCase().endsWith('.xml')
  if (!isXml) {
    showNotification('El archivo seleccionado no es un XML válido', 'warning')
    return
  }

  isParsingXml.value = true
  const reader = new FileReader()

  reader.onload = async (e) => {
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
        parseNodeValue: true,
        trimValues: true,
      })

      let facturaData = null
      const match = xmlString.match(/<factura[\s\S]*?<\/factura>/i)

      if (match) {
        const cleanXml = match[0].trim()
        const parsed = parser.parse(cleanXml)
        facturaData = parsed.factura || parsed.Factura
      } else {
        const parsed = parser.parse(xmlString)
        if (parsed.factura) {
          facturaData = parsed.factura
        } else if (parsed.autorizacion && parsed.autorizacion.comprobante) {
          let comp = parsed.autorizacion.comprobante
          if (typeof comp === 'string') {
            comp = comp.replace('<![CDATA[', '').replace(']]>', '')
            const innerParsed = parser.parse(comp)
            facturaData = innerParsed.factura || innerParsed.Factura
          } else if (comp['#cdata-section'] || comp['#text']) {
            let inner = comp['#cdata-section'] || comp['#text'] || ''
            inner = inner.replace('<![CDATA[', '').replace(']]>', '')
            const innerParsed = parser.parse(inner)
            facturaData = innerParsed.factura || innerParsed.Factura
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
      const ruc = (facturaData.infoTributaria.ruc || '').toString().trim()
      const razonSocial = (facturaData.infoTributaria.razonSocial || '').toString().trim()
      const nombreComercial = (facturaData.infoTributaria.nombreComercial || razonSocial).toString().trim()
      const dirMatriz = (facturaData.infoTributaria.dirMatriz || 'S/N').toString().trim()

      formData.value.supplier_ruc = ruc
      formData.value.supplier_name = nombreComercial || razonSocial
      formData.value.supplier_address = dirMatriz

      // Buscar proveedor en la lista local por RUC o por Nombre
      let matchedSupplier = suppliers.value.find(s =>
        (s.ruc && s.ruc.toString().trim() === ruc) ||
        (s.identification && s.identification.toString().trim() === ruc) ||
        (s.tax_id && s.tax_id.toString().trim() === ruc) ||
        (s.name && s.name.toLowerCase() === nombreComercial.toLowerCase()) ||
        (s.trade_name && s.trade_name.toLowerCase() === razonSocial.toLowerCase())
      )

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

      // 4. Extraer Clave de Acceso (como String)
      formData.value.access_key = String(facturaData.infoTributaria.claveAcceso || '').trim()

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

      const defaultCatId = categories.value[0]?.id || null
      const parsedItems = []

      detalles.forEach((det, idx) => {
        const code = (det.codigoPrincipal || det.codigoInterno || det.codigoAuxiliar || `XML-${idx + 1}`).toString().trim().toUpperCase()
        const description = (det.descripcion || 'Sin descripción').toString().trim()
        const qty = parseFloat(det.cantidad || 1)
        const unitPrice = parseFloat(det.precioUnitario || 0)
        const discount = parseFloat(det.descuento || 0)
        const subtotalVal = parseFloat(det.precioTotalSinImpuesto || (qty * unitPrice - discount))

        // Calcular impuesto
        let taxVal = 0
        let isTax = 0
        if (det.impuestos?.impuesto) {
          const impArray = Array.isArray(det.impuestos.impuesto) ? det.impuestos.impuesto : [det.impuestos.impuesto]
          impArray.forEach(imp => {
            const val = parseFloat(imp.valor || 0)
            const tarifa = parseFloat(imp.tarifa || 0)
            if (val > 0 || tarifa > 0) {
              taxVal += val > 0 ? val : (subtotalVal * (tarifa / 100))
              isTax = 1
            }
          })
        }

        // Detectar si parece logística/flete
        const isLogistics = /flete|transporte|envio|logistica|acarreo/i.test(description)
        const itemType = isLogistics ? 2 : 1

        // Buscar si ya existe este producto en catálogo para heredar categoría y marca
        const existingProd = products.value.find(p => p.sku === code || p.description?.toLowerCase() === description.toLowerCase())

        parsedItems.push({
          id: Date.now() + idx + Math.random(),
          code: code,
          description: description,
          brand: itemType === 1 ? (existingProd?.brand || 'SM') : 'N/A',
          quantity: Number(qty.toFixed(2)),
          unit_price: Number(unitPrice.toFixed(4)),
          discount: Number(discount.toFixed(2)),
          subtotal: Number(subtotalVal.toFixed(2)),
          tax: Number(taxVal.toFixed(2)),
          total: Number((subtotalVal + taxVal).toFixed(2)),
          item_type: itemType,
          product_categorie_id: null,
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

      showNotification(`Factura XML cargada: ${formData.value.invoice_number} con ${parsedItems.length} ítems`, 'success')

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
const subtotal = computed(() => {
  return items.value.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0)
})

const totalTax = computed(() => {
  return items.value.reduce((sum, item) => sum + (Number(item.tax) || 0), 0)
})

const grandTotal = computed(() => {
  return subtotal.value + totalTax.value
})

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

  items.value.push({
    id: Date.now(),
    code: product.sku,
    description: product.description,
    brand: product.brand || 'SM',
    quantity: 1,
    unit_price: product.purchase_price || 0,
    subtotal: product.purchase_price || 0,
    discount: Number(product.discount) || 0,
    tax: 0,
    total: product.purchase_price || 0,
    item_type: 1,
    product_categorie_id: product.product_categorie_id || categories.value[0]?.id,
    is_taxable: product.is_taxable || 0,
    _selected: true,
  })

  searchProduct.value = null
}

const updateItemTotals = item => {
  const qty = Number(item.quantity) || 0
  const price = Number(item.unit_price) || 0
  const disc = Number(item.discount) || 0

  item.subtotal = (qty * price) - disc

  // Asumimos 15% de IVA si es taxable
  item.tax = item.is_taxable == 1 ? item.subtotal * 0.15 : 0
  item.total = item.subtotal + item.tax

  if (isSharedInvoice.value) {
    calculateTercerosFromUnchecked()
  }
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
    return showNotification('Debe agregar al menos un producto a la compra', 'warning')
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

  const payload = {
    ...formData.value,
    access_key: formData.value.access_key ? String(formData.value.access_key).trim() : null,
    subtotal: subtotal.value,
    tax: totalTax.value,
    total: grandTotal.value,
    is_shared: isSharedInvoice.value,
    terceros_total: isSharedInvoice.value ? tercerosMath.value.total : 0,
    taller_total: isSharedInvoice.value ? tallerMath.value.total : grandTotal.value,
    items: items.value.map(item => {
      const isSelected = item._selected !== false
      const isWorkshop = !isSharedInvoice.value || isSelected
      const rawType = Number(item.item_type) || 1
      const isProduct = rawType === 1 && isWorkshop

      return {
        ...item,
        selected_for_inventory: isWorkshop,
        item_type: isProduct ? 1 : 2,
        product_categorie_id: isProduct ? item.product_categorie_id : null,
      }
    }),
  }

  try {
    await $api('purchases/manual', {
      method: 'POST',
      body: payload,
    })

    showNotification('Compra registrada correctamente en inventario y finanzas', 'success')
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
  <div class="pa-6 position-relative">
    <!-- Hidden XML File Input -->
    <input ref="xmlFileInputRef" type="file" accept=".xml,text/xml,application/xml" style="display: none;"
      @change="handleXmlFileSelect" />

    <!-- Header de la Página (50% Título / 50% Acción Agregar XML) -->
    <VRow class="align-center mb-4">
      <VCol cols="12" md="6">
        <div>
          <h2 class="text-h4 font-weight-bold d-flex align-center gap-3">
            <VIcon icon="ri-shopping-cart-2-line" color="primary" />
            Ingreso de Compra
          </h2>
          <span class="text-medium-emphasis">Registra tu compra cargando la factura XML del SRI o de forma manual</span>
        </div>
      </VCol>
      <VCol cols="12" md="6" class="d-flex justify-start justify-md-end align-center gap-2 flex-wrap">

        <!-- Si no hay XML cargado -->
        <VBtn v-if="!xmlLoadedInfo" color="primary" variant="elevated" prepend-icon="ri-upload-cloud-2-line"
          class="rounded-lg px-5 font-weight-bold" :loading="isParsingXml" @click="triggerXmlFileInput">
          Agregar un XML
        </VBtn>

        <!-- Si ya hay XML cargado (Resumen y acciones en cabecera) -->
        <div v-else
          class="d-flex align-center gap-2 flex-wrap bg-success-lighten-5 border border-success border-opacity-50 pa-2 rounded-xl">
          <VChip size="small" color="success" variant="flat" class="font-weight-bold">
            <VIcon icon="ri-checkbox-circle-fill" size="14" class="me-1" />
            XML: {{ xmlLoadedInfo.invoiceNumber }} ({{ xmlLoadedInfo.itemsCount }} ítems)
          </VChip>
          <VBtn size="small" variant="outlined" color="primary" prepend-icon="ri-refresh-line"
            class="rounded-lg text-none" @click="triggerXmlFileInput">
            Reemplazar XML
          </VBtn>
          <VBtn size="small" variant="tonal" color="error" icon="ri-close-line" class="rounded-lg" title="Quitar XML"
            @click="clearXmlImport" />
        </div>
      </VCol>
    </VRow>

    <!-- Form Skeleton loader -->
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

    <VRow v-else>
      <!-- 1. DATOS DE FACTURA (12 COLUMNAS COMPLETAS) -->
      <VCol cols="12">
        <VCard class="elevation-2 rounded-xl mb-6 border">
          <VCardTitle class="px-6 pt-6 pb-2 text-h6 font-weight-bold d-flex align-center gap-2">
            <VIcon icon="ri-file-info-line" color="primary" />
            <span>Datos de Factura</span>
          </VCardTitle>
          <VCardText class="px-6 pb-6">
            <VRow>
              <VCol cols="12" md="6">
                <VAutocomplete v-model="formData.supplier_id" :items="suppliers" item-title="name" item-value="id"
                  label="Proveedor *" placeholder="Selecciona o busca proveedor" variant="outlined"
                  density="comfortable" prepend-inner-icon="ri-store-2-line" :loading="isLoadingConfig" />

                <!-- Alerta de Saldo a Favor / NC disponible -->
                <VAlert v-if="supplierAvailableCredit > 0" type="info" variant="tonal" density="compact"
                  class="mt-2 rounded-lg" icon="ri-hand-coin-line">
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
                  variant="outlined" density="comfortable" prepend-inner-icon="ri-hashtag" />
              </VCol>
              <VCol cols="12" md="3">
                <VTextField v-model="formData.issue_date" type="date" label="Fecha de Emisión *" variant="outlined"
                  density="comfortable" />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>

      <!-- 2. COLUMNA IZQUIERDA (8 COLUMNAS) -->
      <VCol cols="12" md="8">
        <!-- BANNER DE FACTURA COMPARTIDA (SOLO SI SE IMPORTA UN XML, 8 COLUMNAS) -->
        <VCard v-if="xmlLoadedInfo" class="rounded-xl border elevation-0 pa-2 bg-surface mb-2">
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
                  Activa esta opción si solo una parte de la compra corresponde al taller. Podrás desmarcar los ítems de
                  terceros o definir el monto asumido por ellos.
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

        <!-- DETALLE DE PRODUCTOS -->
        <VCard class="elevation-2 rounded-xl border">
          <VCardTitle class="px-6 pt-6 pb-2 d-flex align-center justify-space-between flex-wrap gap-2">
            <div class="text-h6 font-weight-bold d-flex align-center gap-2">
              <VIcon icon="ri-box-3-line" color="primary" />
              <span>Detalle de Productos ({{ items.length }})</span>
            </div>
            <VBtn v-if="!xmlLoadedInfo" color="primary" variant="tonal" size="small" prepend-icon="ri-add-line"
              class="rounded-lg font-weight-bold" @click="openManualProductDialog('')">
              Ingresar Producto Manual
            </VBtn>
          </VCardTitle>
          <VCardText class="px-6">
            <VAutocomplete v-if="!xmlLoadedInfo" v-model="searchProduct" :items="products" item-title="description"
              item-value="id" label="Buscar Producto en catálogo para añadir..." placeholder="Escribe el nombre o SKU"
              variant="outlined" prepend-inner-icon="ri-search-line" return-object clearable class="mb-4"
              :menu-props="{ maxWidth: 0 }" :loading="isLoadingProducts" :disabled="!formData.supplier_id"
              @update:model-value="addProductToItems">
              <template #no-data>
                <div class="pa-4 text-center">
                  <p class="text-medium-emphasis mb-2">
                    {{
                      formData.supplier_id ? '¿No encuentras el producto en el catálogo?'
                        : 'Seleccione un proveedor primero'
                    }}
                  </p>
                  <VBtn v-if="formData.supplier_id" color="primary" variant="outlined" size="small"
                    prepend-icon="ri-edit-box-line" class="mt-1"
                    @click="openManualProductDialog(typeof searchProduct === 'string' ? searchProduct : '')">
                    Ingresar Producto Manualmente
                  </VBtn>
                </div>
              </template>
              <template #item="{ props, item }">
                <VListItem v-bind="props" :title="undefined">
                  <VListItemTitle style="white-space: normal !important; line-height: 1.4;" class="font-weight-medium">
                    {{ item.raw.description || item.raw.name }}
                  </VListItemTitle>
                  <VListItemSubtitle class="mt-1 text-grey">
                    SKU: {{ item.raw.sku }} | Marca: {{ item.raw.brand || 'SM' }} | Costo actual: ${{
                      parseFloat(item.raw.purchase_price).toFixed(2) }}
                  </VListItemSubtitle>
                </VListItem>
              </template>
            </VAutocomplete>

            <!-- BARRA DE ASIGNACIÓN DE CATEGORÍA EN BLOQUE -->
            <div v-if="items.length > 0"
              class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4 pa-3 rounded-lg bg-grey-lighten-4 border">
              <div class="d-flex align-center gap-2">
                <VIcon icon="ri-folder-shared-line" color="primary" size="20" />
                <span class="text-caption font-weight-bold text-high-emphasis">
                  Asignar Categoría:
                </span>
                <VChip size="x-small" color="primary" variant="tonal" class="font-weight-bold ms-1">
                  {{ selectedProductsCount }} producto(s)
                </VChip>
              </div>
              <div class="d-flex align-center gap-2 flex-grow-1 flex-sm-grow-0" style="min-width: 300px;">
                <VSelect v-model="bulkCategory" :items="categories" item-title="title" item-value="id"
                  placeholder="Categoría" variant="outlined" density="compact" hide-details style="min-width: 180px;" />
                <VBtn color="primary" variant="elevated" size="small" class="font-weight-bold text-none rounded-lg"
                  @click="applyBulkCategory">
                  Aplicar ({{ selectedProductsCount }})
                </VBtn>
              </div>
            </div>

            <!-- TABLA DE PRODUCTOS CON TIPO, CATEGORIA Y MARCA EDITABLES -->
            <div class="overflow-x-auto">
              <VTable class="manual-purchase-table border rounded-xl overflow-hidden">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <!-- Checkbox Único Maestro -->
                    <th class="text-center font-weight-bold py-3" style="width: 48px;"
                      :title="isSharedInvoice ? 'Marcar si pertenece al taller / aplicar categoría' : 'Marcar para aplicar categoría'">
                      <VCheckbox :model-value="isAllSelected" :indeterminate="isSomeSelected && !isAllSelected"
                        density="compact" hide-details @click.stop="toggleSelectAll" />
                    </th>
                    <th class="text-left font-weight-bold py-3" style="min-width: 210px;">
                      PRODUCTO / SKU
                    </th>
                    <th class="text-left font-weight-bold py-3" style="min-width: 140px;">
                      TIPO
                    </th>
                    <th class="text-left font-weight-bold py-3" style="min-width: 155px;">
                      CATEGORÍA
                    </th>
                    <th class="text-left font-weight-bold py-3" style="min-width: 125px;">
                      MARCA
                    </th>
                    <th class="text-center font-weight-bold py-3" style="width: 85px;">
                      CANT.
                    </th>
                    <th class="text-center font-weight-bold py-3" style="width: 110px;">
                      P.U. (COSTO)
                    </th>
                    <th class="text-center font-weight-bold py-3" style="width: 95px;">
                      DCTO.
                    </th>
                    <th class="text-right font-weight-bold py-3 pr-4" style="width: 105px;">
                      SUBTOTAL
                    </th>
                    <th class="text-center font-weight-bold py-3" style="width: 60px;">
                      ACCIÓN
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="items.length === 0">
                    <td colspan="10" class="text-center py-10 text-medium-emphasis">
                      <VIcon icon="ri-shopping-bag-3-line" size="40" class="mb-2 text-grey-lighten-1" />
                      <div class="text-body-1 font-weight-medium">
                        No hay productos agregados a la compra
                      </div>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Carga un XML del SRI arriba o ingresa productos manualmente
                      </p>
                    </td>
                  </tr>
                  <tr v-for="(item, index) in items" :key="item.id" class="purchase-item-row"
                    :class="{ 'opacity-50 bg-grey-lighten-5': isSharedInvoice && item._selected === false }">
                    <!-- Checkbox Único por Fila -->
                    <td class="text-center py-3">
                      <VCheckbox :model-value="item._selected !== false" color="primary" density="compact" hide-details
                        :title="isSharedInvoice ? 'Marcar si pertenece al taller / categoría' : 'Marcar para aplicar categoría'"
                        @update:model-value="val => onToggleItem(item, val)" />
                    </td>

                    <!-- Nombre y SKU -->
                    <td class="py-3">
                      <div class="font-weight-bold text-high-emphasis text-body-2 d-flex align-center gap-2 flex-wrap">
                        <span>{{ item.description }}</span>
                        <VChip v-if="item.is_from_xml" size="x-small" color="success" variant="tonal"
                          class="font-weight-bold">
                          XML
                        </VChip>
                        <VChip v-else-if="item.is_manual" size="x-small" color="info" variant="tonal"
                          class="font-weight-bold">
                          Manual
                        </VChip>
                      </div>
                      <div class="text-caption text-medium-emphasis mt-0-5">
                        SKU: <strong class="text-high-emphasis">{{ item.code }}</strong>
                      </div>
                    </td>

                    <!-- Tipo (Producto vs Gasto/Logística) -->
                    <td class="py-3">
                      <VSelect v-if="item._selected !== false" v-model="item.item_type" :items="itemTypeOptions"
                        item-title="title" item-value="value" variant="outlined" density="compact" hide-details
                        class="custom-table-select" style="min-width: 135px;"
                        @update:model-value="onItemTypeChange(item)" />
                      <div v-else
                        class="text-caption text-medium-emphasis text-center py-2 px-2 bg-grey-lighten-4 rounded border border-dashed"
                        style="min-width: 135px;">
                        <VIcon icon="ri-forbid-2-line" size="14" class="me-1" />
                        Terceros
                      </div>
                    </td>

                    <!-- Selector Editable de Categoría (Solo si está marcado y es Producto) -->
                    <td class="py-3">
                      <VSelect v-if="item._selected !== false && Number(item.item_type) === 1"
                        v-model="item.product_categorie_id" :items="categories" item-title="title" item-value="id"
                        placeholder="Categoría *" variant="outlined" density="compact" hide-details
                        class="custom-table-select" style="min-width: 170px;" />
                      <div v-else
                        class="text-caption text-medium-emphasis text-center py-2 px-2 bg-grey-lighten-4 rounded border border-dashed"
                        style="min-width: 145px;">
                        <VIcon icon="ri-forbid-2-line" size="14" class="me-1" />
                        No aplica
                      </div>
                    </td>

                    <!-- Campo Editable de Marca (Solo si está marcado y es Producto) -->
                    <td class="py-3">
                      <VTextField v-if="item._selected !== false && Number(item.item_type) === 1" v-model="item.brand"
                        placeholder="Ej: Bosch" variant="outlined" density="compact" hide-details
                        class="custom-table-input" style="min-width: 115px;" />
                      <div v-else
                        class="text-caption text-medium-emphasis text-center py-2 px-2 bg-grey-lighten-4 rounded border border-dashed"
                        style="min-width: 115px;">
                        N/A
                      </div>
                    </td>

                    <!-- Cantidad (Solo lectura en span) -->
                    <td class="text-center py-3">
                      <span class="text-body-2 font-weight-bold text-high-emphasis">{{ item.quantity }}</span>
                    </td>

                    <!-- Precio Unitario (Solo lectura en span) -->
                    <td class="text-center py-3">
                      <span class="text-body-2 font-weight-medium">${{ Number(item.unit_price || 0).toFixed(2) }}</span>
                    </td>

                    <!-- Descuento (Solo lectura en span) -->
                    <td class="text-center py-3">
                      <span class="text-body-2 text-medium-emphasis">${{ Number(item.discount || 0).toFixed(2) }}</span>
                    </td>

                    <!-- Subtotal (Solo lectura en span) -->
                    <td class="text-right py-3 text-body-2 font-weight-bold text-high-emphasis pr-4">
                      <span>${{ Number((item.quantity * item.unit_price) - (item.discount || 0)).toFixed(2) }}</span>
                    </td>

                    <!-- Acción Eliminar -->
                    <td class="text-center py-3">
                      <VBtn icon="ri-delete-bin-line" color="error" variant="tonal" size="small" class="rounded-lg"
                        title="Eliminar producto" @click="removeItem(index)" />
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- SECCION FINANCIERA Y TOTALES -->
      <VCol cols="12" md="4">
        <VCard class="elevation-2 rounded-xl mb-6 border-primary border-opacity-50 border-s-4 border">
          <VCardTitle class="px-6 pt-6 pb-2 text-h6 font-weight-bold d-flex align-center gap-2">
            <VIcon icon="ri-money-dollar-circle-line" color="primary" />
            <span>Origen de Fondos</span>
          </VCardTitle>
          <VCardText class="px-6 pb-6">
            <VRadioGroup v-model="formData.payment_type" class="mb-4">
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
                  :loading="isLoadingConfig" />
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
                  prepend-inner-icon="ri-user-star-line" :loading="isLoadingConfig" />
              </div>
            </VExpandTransition>

            <VAlert v-if="formData.payment_type === 'credito'" color="primary" variant="tonal"
              icon="ri-information-line" class="mt-2 text-caption">
              Se registrará la compra en el inventario y se creará una Cuenta por Pagar asociada al proveedor. No se
              descontará dinero de las cuentas aún.
            </VAlert>
          </VCardText>
        </VCard>

        <!-- RESUMEN TOTAL -->
        <VCard class="elevation-2 rounded-xl bg-grey-lighten-4 border">
          <VCardTitle class="px-6 pt-6 text-h6 font-weight-bold">
            Resumen de Factura
          </VCardTitle>
          <VCardText class="px-6">
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">Subtotal SRI</span>
              <span class="font-weight-bold">${{ subtotal.toFixed(2) }}</span>
            </div>
            <div class="d-flex justify-space-between mb-4">
              <span class="text-medium-emphasis">Impuestos (IVA 15%)</span>
              <span class="font-weight-bold">${{ totalTax.toFixed(2) }}</span>
            </div>
            <div class="d-flex justify-space-between mb-3 align-center">
              <span class="text-subtitle-1 font-weight-bold">Total Factura SRI</span>
              <span class="text-h5 font-weight-bold text-grey-darken-3">${{ grandTotal.toFixed(2) }}</span>
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
                    <div class="text-subtitle-2 font-weight-bold text-primary">Gasto Real Taller</div>
                    <div class="text-caption text-medium-emphasis">Monto a pagar/egresar</div>
                  </div>
                  <span class="text-h4 font-weight-black text-primary">${{ tallerMath.total.toFixed(2) }}</span>
                </div>
              </div>
            </VExpandTransition>

            <VDivider v-if="!isSharedInvoice" class="mb-4" />

            <div v-if="!isSharedInvoice" class="d-flex justify-space-between mb-6 align-center">
              <span class="text-h6 font-weight-bold">Total Compra</span>
              <span class="text-h4 font-weight-black text-primary">${{ grandTotal.toFixed(2) }}</span>
            </div>

            <VBtn block color="primary" size="x-large" elevation="3" :loading="isSubmitting"
              prepend-icon="ri-save-3-line" class="font-weight-bold mt-2" @click="submitPurchase">
              Registrar Compra
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

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
            Ingresar Producto / Gasto Manual
          </h3>
          <p class="custom-dialog-subtitle">
            Agrega un ítem directamente a la compra
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

            <VCol v-if="Number(manualItem.item_type) === 1" cols="12" sm="6" class="mb-2">
              <VTextField v-model="manualItem.brand" label="Marca" placeholder="Ej: Bosch, Mobil, SM..."
                variant="outlined" density="comfortable" prepend-inner-icon="ri-price-tag-3-line" />
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
  </div>
</template>
