<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const router = useRouter()
const route = useRoute()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const userId = ref(null)
const suppliers = ref([])
const supplierProducts = ref([])
const searchProduct = ref(null)
const isLoading = ref(false)
const isLoadingProducts = ref(false)
const isSubmitting = ref(false)
const isSavingDraft = ref(false)
const formRef = ref(null)
const pedidoId = ref(null)
const nextPedidoNumber = ref('')

const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0]
}

const orderDate = ref(getLocalDateString())

const getUserId = () => {
  const userData = JSON.parse(localStorage.getItem('user'))
  userId.value = userData ? userData.id : null
}

// Estado del formulario
const pedido = ref({
  number: '',
  distribuidor_id: null,
  items: [],
  observations: '',
})

// Reglas de validación
const requiredRule = v => (
  v !== null &&
  v !== undefined &&
  v !== '' &&
  !(typeof v === 'number' && Number.isNaN(v))
) || 'Campo obligatorio'

// Distribuidor seleccionado
const selectedSupplier = computed(() => {
  if (!pedido.value.distribuidor_id) return null
  return suppliers.value.find(s => s.id === pedido.value.distribuidor_id) || null
})

// Cargar secuencial
const loadNextNumber = async () => {
  try {
    const response = await $api('pedidos-distribuidor/next-number')
    if (response?.data) {
      nextPedidoNumber.value = response.data
      if (!pedido.value.number) {
        pedido.value.number = response.data
      }
    }
  } catch (error) {
    console.error('Error al obtener secuencial de pedido:', error)
  }
}

// Cargar distribuidores al iniciar
const loadSuppliers = async () => {
  isLoading.value = true
  try {
    const response = await $api('suppliers?per_page=-1')
    suppliers.value = response.suppliers || response.data || response || []
  } catch (error) {
    console.error('Error al cargar distribuidores:', error)
    showNotification('Error al cargar la lista de distribuidores', 'error')
  } finally {
    isLoading.value = false
  }
}

// Cargar productos del distribuidor seleccionado
const loadProductsOfSupplier = async supplierId => {
  if (!supplierId) {
    supplierProducts.value = []
    return
  }

  isLoadingProducts.value = true
  try {
    const response = await $api(`pedidos-distribuidor/productos/${supplierId}`)
    if (response.status === 200) {
      supplierProducts.value = (response.products || []).map(p => {
        const codePart = p.sku ? `[${p.sku}] ` : (p.reference ? `[${p.reference}] ` : '')
        return {
          ...p,
          searchText: `${p.sku || ''} ${p.reference || ''} ${p.description || ''}`.toLowerCase(),
          displayTitle: `${codePart}${p.description || ''}`,
        }
      })
    } else {
      supplierProducts.value = []
    }
  } catch (error) {
    console.error('Error al cargar productos:', error)
    showNotification('Error al cargar los productos del distribuidor', 'error')
  } finally {
    isLoadingProducts.value = false
  }
}

// Observar cambio de distribuidor para cargar sus productos
watch(() => pedido.value.distribuidor_id, async (newVal) => {
  searchProduct.value = null
  await loadProductsOfSupplier(newVal)
})

// Agregar producto seleccionado al carrito
const onProductSelected = product => {
  if (product && typeof product === 'object') {
    const existingItem = pedido.value.items.find(i =>
      (product.id && i.producto_id === product.id) ||
      (!product.id && i.description && i.description.toLowerCase() === (product.description || '').toLowerCase())
    )

    if (existingItem) {
      existingItem.cantidad++
      showNotification(`Cantidad incrementada para: ${product.description}`, 'info')
    } else {
      pedido.value.items.push({
        producto_id: product.id || null,
        description: product.description || '',
        sku: product.sku || product.reference || '',
        cantidad: 1,
        precio_compra_estimado: parseFloat(product.purchase_price) || 0,
        source: product.source || 'catalog',
      })
      showNotification('Producto agregado al pedido', 'success')
    }

    // Limpiar selección de búsqueda
    nextTick(() => {
      searchProduct.value = null
    })
  }
}

// Eliminar producto del carrito
const removeItem = index => {
  pedido.value.items.splice(index, 1)
}

// Modal de Producto Manual
const isManualProductDialogVisible = ref(false)
const manualFormRef = ref(null)
const manualProduct = ref({
  description: '',
  sku: '',
  quantity: 1,
  price: 0,
})

const openManualProductDialog = () => {
  manualProduct.value = {
    description: '',
    sku: '',
    quantity: 1,
    price: 0,
  }
  manualFormRef.value?.resetValidation()
  isManualProductDialogVisible.value = true
}

const addManualItemFromDialog = async () => {
  const { valid } = await manualFormRef.value?.validate()
  if (!valid) return

  const desc = (manualProduct.value.description || '').trim()
  if (!desc) {
    showNotification('La descripción del producto es requerida', 'warning')
    return
  }

  pedido.value.items.push({
    producto_id: null,
    description: desc,
    sku: manualProduct.value.sku ? manualProduct.value.sku.trim().toUpperCase() : 'MANUAL',
    cantidad: Number(manualProduct.value.quantity) || 1,
    precio_compra_estimado: parseFloat(manualProduct.value.price) || 0,
    source: 'manual',
  })

  showNotification('Producto manual agregado al pedido', 'success')
  isManualProductDialogVisible.value = false
}

// Agregar fila manual directamente
const addManualItem = () => {
  pedido.value.items.push({
    producto_id: null,
    description: '',
    sku: 'MANUAL',
    cantidad: 1,
    precio_compra_estimado: 0,
    source: 'manual',
  })
}

// Filtro personalizado de autocompletado en Vuetify
const productFilter = (value, query, item) => {
  if (query == null || query === '') return true
  const q = String(query).toLowerCase().trim()
  if (!q) return true

  const raw = item?.raw
  if (!raw) return false

  const sku = String(raw.sku || '').toLowerCase()
  const ref = String(raw.reference || '').toLowerCase()
  const desc = String(raw.description || '').toLowerCase()

  return sku.includes(q) || ref.includes(q) || desc.includes(q)
}

// Cálculos
const totalQuantities = computed(() => {
  return pedido.value.items.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0)
})

const total = computed(() => {
  return pedido.value.items.reduce((sum, item) => {
    const qty = Number(item.cantidad) || 0
    const price = Number(item.precio_compra_estimado) || 0
    return sum + (qty * price)
  }, 0)
})

// Cargar detalles del pedido para editar
const loadPedidoDetails = async id => {
  isLoading.value = true
  try {
    const response = await $api(`pedidos-distribuidor/${id}`)
    if (response.success || response.status === 200) {
      const data = response.data
      pedido.value = {
        number: data.number || '',
        distribuidor_id: data.distribuidor_id,
        observations: data.observations || '',
        items: (data.detalles || []).map(detail => ({
          producto_id: detail.producto_id,
          description: detail.description,
          sku: detail.producto?.sku || '',
          cantidad: detail.cantidad,
          precio_compra_estimado: parseFloat(detail.precio_compra_estimado) || 0,
          source: detail.producto_id ? 'inventory' : 'catalog',
        })),
      }
      if (data.created_at) {
        orderDate.value = data.created_at.split(' ')[0]
      }
    } else {
      showNotification('No se pudieron cargar los detalles del pedido', 'error')
    }
  } catch (error) {
    console.error('Error al cargar detalles del pedido:', error)
    showNotification('Error al cargar los detalles del pedido', 'error')
  } finally {
    isLoading.value = false
  }
}

// Enviar formulario
const submitForm = async () => {
  getUserId()
  if (!userId.value) {
    showNotification('Sesión inválida o expirada. Por favor vuelva a iniciar sesión.', 'error')
    return
  }

  if (formRef.value) {
    const { valid } = await formRef.value.validate()
    if (!valid) {
      showNotification('Por favor, complete todos los campos obligatorios.', 'error')
      return
    }
  }

  if (!pedido.value.distribuidor_id) {
    showNotification('Debe seleccionar un distribuidor para continuar.', 'error')
    return
  }

  if (pedido.value.items.length === 0) {
    showNotification('Debe agregar al menos un producto al pedido.', 'error')
    return
  }

  isSubmitting.value = true
  loader.start()

  try {
    const payload = {
      number: pedido.value.number || nextPedidoNumber.value,
      distribuidor_id: pedido.value.distribuidor_id,
      usuario_id: userId.value,
      observations: pedido.value.observations,
      items: pedido.value.items.map(item => ({
        producto_id: item.producto_id,
        description: item.description,
        cantidad: item.cantidad,
        precio_compra_estimado: item.precio_compra_estimado,
      })),
    }

    const url = pedidoId.value ? `pedidos-distribuidor/${pedidoId.value}` : 'pedidos-distribuidor'
    const method = pedidoId.value ? 'PUT' : 'POST'

    const response = await $api(url, {
      method: method,
      body: payload,
    })

    if (response.success || response.status === 200 || response.status === 201) {
      showNotification(pedidoId.value ? 'Pedido a distribuidor actualizado correctamente.' : 'Pedido a distribuidor generado correctamente.', 'success')
      router.push('/sales/pedidos-distribuidor-list')
    } else {
      showNotification(response.message || 'Error al procesar el pedido.', 'error')
    }
  } catch (error) {
    console.error('Error al enviar el pedido:', error)
    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'
    showNotification(errMsg, 'error')
  } finally {
    isSubmitting.value = false
    loader.stop()
  }
}

const saveDraft = async () => {
  getUserId()
  if (!userId.value) {
    showNotification('Sesión inválida o expirada. Por favor vuelva a iniciar sesión.', 'error')
    return
  }

  if (!pedido.value.distribuidor_id) {
    showNotification('Debe seleccionar un distribuidor para guardar el borrador.', 'error')
    return
  }

  if (pedido.value.items.length === 0) {
    showNotification('Debe agregar al menos un producto al pedido para guardar el borrador.', 'error')
    return
  }

  isSavingDraft.value = true
  loader.start()

  try {
    const payload = {
      number: pedido.value.number || nextPedidoNumber.value,
      distribuidor_id: pedido.value.distribuidor_id,
      usuario_id: userId.value,
      is_draft: true,
      observations: pedido.value.observations,
      items: pedido.value.items.map(item => ({
        producto_id: item.producto_id,
        description: item.description,
        cantidad: item.cantidad,
        precio_compra_estimado: item.precio_compra_estimado,
      })),
    }

    const url = pedidoId.value ? `pedidos-distribuidor/${pedidoId.value}` : 'pedidos-distribuidor'
    const method = pedidoId.value ? 'PUT' : 'POST'

    const response = await $api(url, {
      method: method,
      body: payload,
    })

    if (response.success || response.status === 200 || response.status === 201) {
      showNotification('Borrador guardado exitosamente.', 'success')
      router.push('/sales/pedidos-distribuidor-list')
    } else {
      showNotification(response.message || 'Error al procesar el borrador.', 'error')
    }
  } catch (error) {
    console.error('Error al enviar el pedido:', error)
    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'
    showNotification(errMsg, 'error')
  } finally {
    isSavingDraft.value = false
    loader.stop()
  }
}

// Lógica de repuestos a reponer
const pendingReplacements = ref([])
const loadingReplacements = ref(false)
const isReplacementsDialogVisible = ref(false)
const searchReplacementQuery = ref('')

const loadPendingReplacements = async () => {
  loadingReplacements.value = true
  try {
    const response = await $api('repuestos-reposicion/pending')
    if (response.success || response.status === 200) {
      pendingReplacements.value = response.data || []
    }
  } catch (error) {
    console.error('Error al cargar repuestos a reponer:', error)
  } finally {
    loadingReplacements.value = false
  }
}

const filteredReplacements = computed(() => {
  if (!searchReplacementQuery.value) return pendingReplacements.value
  const q = searchReplacementQuery.value.toLowerCase().trim()
  return pendingReplacements.value.filter(item => {
    const desc = String(item.description || '').toLowerCase()
    const sku = String(item.sku || '').toLowerCase()
    const sup = String(item.supplier?.name || '').toLowerCase()
    const ruc = String(item.supplier?.ruc || '').toLowerCase()
    return desc.includes(q) || sku.includes(q) || sup.includes(q) || ruc.includes(q)
  })
})

const isItemAlreadyInOrder = item => {
  return pedido.value.items.some(i => (item.product_id && i.producto_id === item.product_id) || (i.description && i.description.toLowerCase() === (item.description || '').toLowerCase()))
}

const getItemQtyInOrder = item => {
  const found = pedido.value.items.find(i => (item.product_id && i.producto_id === item.product_id) || (i.description && i.description.toLowerCase() === (item.description || '').toLowerCase()))
  return found ? found.cantidad : 0
}

const addReplacementsToOrder = item => {
  if (!pedido.value.distribuidor_id && item.supplier_id) {
    pedido.value.distribuidor_id = item.supplier_id
  }

  const existingItem = pedido.value.items.find(i => (item.product_id && i.producto_id === item.product_id) || (i.description && i.description.toLowerCase() === (item.description || '').toLowerCase()))
  if (existingItem) {
    existingItem.cantidad++
  } else {
    pedido.value.items.push({
      producto_id: item.product_id || null,
      description: item.description,
      sku: item.sku || '',
      cantidad: 1,
      precio_compra_estimado: parseFloat(item.purchase_price) || 0,
      source: 'replacement',
    })
  }
  showNotification('Repuesto agregado al pedido', 'success')
}

const markAsAcquired = async replacementId => {
  try {
    const response = await $api(`repuestos-reposicion/${replacementId}/adquirido`, {
      method: 'PUT',
    })
    if (response.success || response.status === 200) {
      showNotification('Repuesto marcado como adquirido', 'success')
      await loadPendingReplacements()
    }
  } catch (error) {
    console.error('Error al marcar como adquirido:', error)
    showNotification('Error al marcar el repuesto como adquirido', 'error')
  }
}

onMounted(async () => {
  getUserId()
  await Promise.all([
    loadSuppliers(),
    loadNextNumber(),
    loadPendingReplacements(),
  ])

  const id = route.query.id
  if (id) {
    pedidoId.value = id
    await loadPedidoDetails(id)
  }
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

    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar
            color="primary"
            variant="tonal"
            rounded="lg"
            size="44"
            class="elevation-1"
          >
            <VIcon
              icon="ri-truck-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0">
                {{ pedidoId ? 'Editar Pedido a Distribuidor' : 'Generar Pedido a Distribuidor' }}
              </h1>
              <VChip
                color="primary"
                size="small"
                variant="tonal"
                class="font-weight-bold"
                prepend-icon="ri-truck-line"
              >
                Pedido Proveedor
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
              Solicitud de compra y reposición a distribuidores (sin impacto en inventario ni caja)
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-arrow-left-line"
            class="font-weight-medium"
            to="/sales/pedidos-distribuidor-list"
          >
            Volver al Listado
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Form Skeleton loader -->
    <div
      v-if="isLoading"
      class="d-flex flex-column gap-6"
    >
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
    <VForm
      v-else
      ref="formRef"
      @submit.prevent="submitForm"
    >
      <VRow>
        <!-- Columna Izquierda (8 cols): Proveedor, Catálogo y Productos -->
        <VCol cols="12" lg="8">
          <!-- Tarjeta 1: Proveedor y Datos del Pedido -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="36"
                      color="primary"
                      variant="tonal"
                      class="rounded-lg"
                    >
                      <VIcon
                        icon="ri-store-2-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Distribuidor / Proveedor
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Selecciona el proveedor al que se solicitarán los productos
                      </p>
                    </div>
                  </div>
                  <VChip
                    v-if="pedido.number || nextPedidoNumber"
                    color="primary"
                    variant="tonal"
                    size="small"
                    class="font-weight-bold font-mono"
                  >
                    #{{ pedido.number || nextPedidoNumber }}
                  </VChip>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <VRow>
                <!-- Secuencial de Pedido -->
                <VCol cols="12" sm="6">
                  <VTextField
                    :model-value="pedido.number || nextPedidoNumber"
                    label="Secuencial Pedido"
                    variant="outlined"
                    density="comfortable"
                    readonly
                    bg-color="grey-lighten-4"
                    prepend-inner-icon="ri-hashtag"
                  />
                </VCol>

                <!-- Fecha del Pedido -->
                <VCol cols="12" sm="6">
                  <VTextField
                    v-model="orderDate"
                    type="date"
                    label="Fecha de Solicitud"
                    variant="outlined"
                    density="comfortable"
                    :rules="[requiredRule]"
                    prepend-inner-icon="ri-calendar-line"
                  />
                </VCol>

                <!-- Selector de Distribuidor -->
                <VCol cols="12">
                  <VAutocomplete
                    v-model="pedido.distribuidor_id"
                    :loading="isLoading"
                    :items="suppliers"
                    item-title="name"
                    item-value="id"
                    label="Distribuidor / Proveedor *"
                    placeholder="Buscar y seleccionar un distribuidor..."
                    prepend-inner-icon="ri-truck-fill"
                    variant="outlined"
                    density="comfortable"
                    :rules="[requiredRule]"
                    color="primary"
                    clearable
                    required
                  >
                    <template #item="{ props, item }">
                      <VListItem
                        v-bind="props"
                        :title="item.raw.name"
                        :subtitle="item.raw.ruc ? `RUC: ${item.raw.ruc}` : ''"
                      >
                        <template #prepend>
                          <VAvatar
                            size="32"
                            color="primary"
                            variant="tonal"
                            class="rounded-lg mr-2"
                          >
                            <VIcon icon="ri-building-line" size="18" />
                          </VAvatar>
                        </template>
                      </VListItem>
                    </template>
                  </VAutocomplete>
                </VCol>

                <!-- Panel Elegante de Resumen del Proveedor Seleccionado -->
                <VCol
                  v-if="selectedSupplier"
                  cols="12"
                  class="pt-0"
                >
                  <div class="rounded-xl border bg-slate-50 pa-3 pa-sm-4">
                    <div class="d-flex align-center gap-3">
                      <VAvatar
                        color="primary"
                        variant="tonal"
                        size="40"
                        class="rounded-lg shrink-0"
                      >
                        <VIcon
                          icon="ri-building-line"
                          size="22"
                        />
                      </VAvatar>
                      <div class="d-flex flex-column overflow-hidden flex-grow-1">
                        <div class="d-flex align-center gap-2 flex-wrap">
                          <span class="font-weight-bold text-slate-900 text-body-2">
                            {{ selectedSupplier.name }}
                          </span>
                          <span
                            v-if="selectedSupplier.ruc"
                            class="font-mono text-caption font-weight-medium text-primary"
                          >
                            • RUC: {{ selectedSupplier.ruc }}
                          </span>
                        </div>
                        <div class="d-flex align-center gap-3 mt-1 text-caption text-medium-emphasis flex-wrap">
                          <span
                            v-if="selectedSupplier.phone"
                            class="d-flex align-center gap-1"
                          >
                            <VIcon icon="ri-phone-line" size="13" /> {{ selectedSupplier.phone }}
                          </span>
                          <span
                            v-if="selectedSupplier.email"
                            class="d-flex align-center gap-1 text-truncate"
                          >
                            <VIcon icon="ri-mail-line" size="13" /> {{ selectedSupplier.email }}
                          </span>
                          <span
                            v-if="selectedSupplier.address"
                            class="d-flex align-center gap-1 text-truncate"
                          >
                            <VIcon icon="ri-map-pin-line" size="13" /> {{ selectedSupplier.address }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Tarjeta 2: Productos y Repuestos Solicitados -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="36"
                      color="success"
                      variant="tonal"
                      class="rounded-lg"
                    >
                      <VIcon
                        icon="ri-shopping-bag-3-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Productos y Repuestos
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Catálogo del proveedor e inventario disponible
                      </p>
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <VBtn
                      size="small"
                      color="primary"
                      variant="tonal"
                      prepend-icon="ri-add-circle-line"
                      class="font-weight-semibold"
                      :disabled="!pedido.distribuidor_id"
                      @click="openManualProductDialog"
                    >
                      + Producto Manual
                    </VBtn>
                    <VBtn
                      size="small"
                      color="warning"
                      variant="tonal"
                      prepend-icon="ri-history-line"
                      class="font-weight-semibold"
                      @click="isReplacementsDialogVisible = true"
                    >
                      Repuestos Sugeridos
                      <VChip
                        v-if="pendingReplacements.length > 0"
                        size="x-small"
                        color="warning"
                        class="ml-1.5 font-weight-bold"
                      >
                        {{ pendingReplacements.length }}
                      </VChip>
                    </VBtn>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5 bg-white">
              <!-- Cuadro de búsqueda de productos del distribuidor -->
              <div class="mb-4">
                <VAutocomplete
                  v-model="searchProduct"
                  :loading="isLoadingProducts"
                  :items="supplierProducts"
                  item-title="displayTitle"
                  return-object
                  label="Buscar y agregar producto por nombre, código SKU o referencia..."
                  placeholder="Escribe para buscar en el catálogo del proveedor..."
                  prepend-inner-icon="ri-search-line"
                  variant="outlined"
                  clearable
                  :disabled="!pedido.distribuidor_id"
                  :custom-filter="productFilter"
                  color="primary"
                  class="flex-grow-1"
                  hide-details
                  :menu-props="{ maxWidth: 0 }"
                  @update:model-value="onProductSelected"
                >
                  <template #item="{ props, item }">
                    <VListItem
                      v-bind="props"
                      :title="undefined"
                    >
                      <template #prepend>
                        <VAvatar
                          size="32"
                          :color="item.raw.source === 'catalog' ? 'info' : 'primary'"
                          variant="tonal"
                          class="rounded-lg mr-2"
                        >
                          <VIcon
                            :icon="item.raw.source === 'catalog' ? 'ri-book-read-line' : 'ri-box-3-line'"
                            size="18"
                          />
                        </VAvatar>
                      </template>
                      <VListItemTitle
                        style="white-space: normal !important; line-height: 1.4;"
                        class="font-weight-medium text-body-2"
                      >
                        {{ item.raw.description }}
                      </VListItemTitle>
                      <VListItemSubtitle class="mt-1 text-grey d-flex align-center gap-2 flex-wrap">
                        <span v-if="item.raw.sku"><strong>Cód:</strong> {{ item.raw.sku }}</span>
                        <span v-if="item.raw.reference"><strong>Ref:</strong> {{ item.raw.reference }}</span>
                        <VChip
                          size="x-small"
                          :color="item.raw.source === 'catalog' ? 'info' : 'success'"
                          variant="tonal"
                        >
                          {{ item.raw.source === 'catalog' ? 'Catálogo Proveedor' : 'Inventario' }}
                        </VChip>
                        <span v-if="item.raw.purchase_price > 0" class="text-primary font-weight-semibold">
                          ${{ Number(item.raw.purchase_price).toFixed(2) }}
                        </span>
                      </VListItemSubtitle>
                    </VListItem>
                  </template>
                  <template #no-data>
                    <div class="pa-4 text-center text-medium-emphasis">
                      <VIcon
                        icon="ri-information-line"
                        class="mr-1"
                      />
                      {{
                        pedido.distribuidor_id ? 'No se encontraron productos para este distribuidor' :
                          'Seleccione un distribuidor primero para cargar su catálogo'
                      }}
                    </div>
                  </template>
                </VAutocomplete>
              </div>

              <!-- Tabla de Items Agregados -->
              <div
                v-if="pedido.items.length > 0"
                class="rounded-xl border overflow-hidden"
              >
                <VTable hover class="w-100">
                  <thead class="bg-grey-lighten-5">
                    <tr>
                      <th class="text-left font-weight-bold text-grey-darken-3">
                        Ítem / Descripción
                      </th>
                      <th
                        class="text-center font-weight-bold text-grey-darken-3"
                        style="width: 110px;"
                      >
                        Cant.
                      </th>
                      <th
                        class="text-right font-weight-bold text-grey-darken-3"
                        style="width: 150px;"
                      >
                        Costo Compra ($)
                      </th>
                      <th
                        class="text-right font-weight-bold text-grey-darken-3"
                        style="width: 130px;"
                      >
                        Subtotal ($)
                      </th>
                      <th
                        class="text-center"
                        style="width: 50px;"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(item, index) in pedido.items"
                      :key="index"
                    >
                      <td class="pa-3">
                        <div v-if="item.producto_id || item.source !== 'manual'">
                          <div class="font-weight-medium text-body-2 text-grey-darken-4">
                            {{ item.description }}
                          </div>
                          <div class="d-flex align-center gap-2 mt-1 flex-wrap">
                            <span
                              v-if="item.sku"
                              class="text-caption text-medium-emphasis font-mono"
                            >
                              SKU/Ref: {{ item.sku }}
                            </span>
                            <VChip
                              size="x-small"
                              :color="item.source === 'catalog' ? 'info' : (item.source === 'replacement' ? 'warning' : 'success')"
                              variant="tonal"
                              class="font-weight-bold"
                            >
                              {{ item.source === 'catalog' ? 'Catálogo' : (item.source === 'replacement' ? 'Repuesto OT' : 'Inventario') }}
                            </VChip>
                          </div>
                        </div>
                        <div v-else class="d-flex flex-column gap-1">
                          <div class="d-flex align-center gap-2">
                            <VChip
                              size="x-small"
                              color="primary"
                              variant="tonal"
                              class="font-weight-bold"
                            >
                              Producto Manual
                            </VChip>
                            <span
                              v-if="item.sku && item.sku !== 'MANUAL'"
                              class="text-caption text-medium-emphasis font-mono font-weight-medium"
                            >
                              Ref: {{ item.sku }}
                            </span>
                          </div>
                          <VTextField
                            v-model="item.description"
                            placeholder="Descripción del producto manual *"
                            variant="underlined"
                            density="compact"
                            hide-details="auto"
                            :rules="[requiredRule]"
                            class="font-weight-medium mt-1"
                          />
                        </div>
                      </td>
                      <td class="pa-2 text-center">
                        <VTextField
                          v-model.number="item.cantidad"
                          type="number"
                          min="1"
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                          :rules="[requiredRule]"
                          class="text-center"
                        />
                      </td>
                      <td class="pa-2 text-right">
                        <VTextField
                          v-model.number="item.precio_compra_estimado"
                          type="number"
                          min="0"
                          step="0.01"
                          variant="outlined"
                          density="compact"
                          hide-details="auto"
                          :rules="[requiredRule]"
                          prefix="$"
                          class="text-right"
                        />
                      </td>
                      <td class="pa-2 text-right font-weight-bold font-mono text-body-2 text-primary">
                        ${{ ((Number(item.cantidad) || 0) * (Number(item.precio_compra_estimado) || 0)).toFixed(2) }}
                      </td>
                      <td class="pa-2 text-center">
                        <VBtn
                          icon="ri-delete-bin-line"
                          variant="text"
                          color="error"
                          size="small"
                          @click="removeItem(index)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>

              <!-- Empty State -->
              <div
                v-else
                class="text-center pa-10 rounded-xl bg-slate-50 border border-dashed"
              >
                <VAvatar
                  color="primary"
                  variant="tonal"
                  size="64"
                  class="mb-3"
                >
                  <VIcon
                    icon="ri-shopping-cart-line"
                    size="32"
                  />
                </VAvatar>
                <div class="text-subtitle-1 font-weight-bold text-slate-900">
                  No hay productos agregados al pedido
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  {{ pedido.distribuidor_id ? 'Usa el buscador arriba para agregar productos del catálogo o crea ítems manuales.' : 'Selecciona un distribuidor arriba para habilitar la búsqueda de productos.' }}
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- Tarjeta 3: Observaciones -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="36"
                    color="secondary"
                    variant="tonal"
                    class="rounded-lg"
                  >
                    <VIcon
                      icon="ri-edit-2-line"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                      Notas y Observaciones
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Información complementaria para la entrega o despacho
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5 bg-white">
              <VTextarea
                v-model="pedido.observations"
                label="Notas / Observaciones del Pedido"
                placeholder="Escribe alguna nota adicional o condición especial para el distribuidor..."
                variant="outlined"
                prepend-inner-icon="ri-file-text-line"
                hide-details="auto"
                rows="3"
                color="primary"
              />
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Derecha (4 cols): Resumen Financiero y Acciones -->
        <VCol cols="12" lg="4">
          <div
            class="position-sticky"
            style="top: 24px; z-index: 1;"
          >
            <VCard class="rounded-xl border-light elevation-1 overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="36"
                      color="primary"
                      variant="tonal"
                      class="rounded-lg"
                    >
                      <VIcon
                        icon="ri-file-list-3-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                        Resumen del Pedido
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        {{ pedido.items.length }} {{ pedido.items.length === 1 ? 'ítem en lista' : 'ítems en lista' }}
                      </p>
                    </div>
                  </div>
                </template>
              </VCardItem>

              <VCardText class="pa-4 bg-white d-flex flex-column gap-3">
                <div class="d-flex justify-space-between align-center text-body-2">
                  <span class="text-medium-emphasis font-weight-medium">Líneas de productos:</span>
                  <span class="font-mono font-weight-bold">{{ pedido.items.length }}</span>
                </div>
                <div class="d-flex justify-space-between align-center text-body-2">
                  <span class="text-medium-emphasis font-weight-medium">Total de unidades:</span>
                  <span class="font-mono font-weight-bold">{{ totalQuantities }}</span>
                </div>
                <div class="d-flex justify-space-between align-center text-body-2">
                  <span class="text-medium-emphasis font-weight-medium">Subtotal Estimado:</span>
                  <span class="font-mono font-weight-bold">${{ total.toFixed(2) }}</span>
                </div>

                <!-- Total Estimado Destacado -->
                <div class="d-flex justify-space-between align-center pa-3 rounded-xl bg-slate-50 border mt-1">
                  <div>
                    <div class="text-caption font-weight-bold text-slate-500 text-uppercase">
                      Total Estimado
                    </div>
                    <div class="text-h4 font-weight-black text-primary font-mono mt-0.5">
                      ${{ total.toFixed(2) }}
                    </div>
                  </div>
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    size="44"
                    class="rounded-xl"
                  >
                    <VIcon
                      icon="ri-wallet-3-line"
                      size="24"
                    />
                  </VAvatar>
                </div>

                <!-- Banner Informativo -->
                <div class="mt-2 pa-3 bg-purple-lighten-5 rounded-lg border border-purple-lighten-4">
                  <div class="d-flex align-start gap-2">
                    <VIcon
                      icon="ri-information-fill"
                      color="primary"
                      class="mt-1"
                      size="18"
                    />
                    <div class="text-caption text-primary" style="line-height: 1.35;">
                      <strong>Información Importante:</strong>
                      Este pedido se registrará en estado <strong>Pendiente</strong>. No afecta el stock actual ni genera facturación financiera hasta la recepción de los repuestos.
                    </div>
                  </div>
                </div>
              </VCardText>

              <VDivider />

              <VCardActions class="pa-4 bg-white d-flex flex-column gap-2">
                <!-- Botón Principal Prominente -->
                <VBtn
                  type="submit"
                  block
                  color="primary"
                  variant="elevated"
                  height="44"
                  prepend-icon="ri-send-plane-fill"
                  class="rounded-lg font-weight-bold elevation-2 text-none"
                  style="font-size: 0.95rem; letter-spacing: 0.3px;"
                  :loading="isSubmitting"
                  :disabled="pedido.items.length === 0"
                >
                  {{ pedidoId ? 'Guardar Cambios' : 'Generar Pedido' }}
                </VBtn>

                <!-- Fila de Acciones Secundarias Equilibradas -->
                <div
                  class="d-flex align-center gap-2 w-100 mt-1"
                  style="gap: 8px;"
                >
                  <VBtn
                    color="secondary"
                    variant="tonal"
                    height="38"
                    prepend-icon="ri-draft-line"
                    class="rounded-lg font-weight-semibold text-none"
                    style="flex: 1;"
                    :loading="isSavingDraft"
                    @click.prevent="saveDraft"
                  >
                    {{ pedidoId ? 'Borrador' : 'Guardar Borrador' }}
                  </VBtn>

                  <VBtn
                    color="secondary"
                    variant="outlined"
                    height="38"
                    prepend-icon="ri-close-line"
                    class="rounded-lg font-weight-medium text-none"
                    style="flex: 1;"
                    to="/sales/pedidos-distribuidor-list"
                  >
                    Cancelar
                  </VBtn>
                </div>
              </VCardActions>
            </VCard>
          </div>
        </VCol>
      </VRow>
    </VForm>

    <!-- Modal Producto Manual -->
    <VDialog
      v-model="isManualProductDialogVisible"
      max-width="500"
    >
      <VCard class="rounded-xl overflow-hidden">
        <VCardItem class="bg-primary text-white py-3 px-4">
          <template #title>
            <div class="d-flex align-center gap-2">
              <VIcon icon="ri-add-circle-line" color="white" />
              <span class="text-subtitle-1 font-weight-bold text-white">Agregar Producto Manual</span>
            </div>
          </template>
        </VCardItem>
        <VCardText class="pa-5 bg-white">
          <VForm ref="manualFormRef" @submit.prevent="addManualItemFromDialog">
            <VRow dense>
              <VCol cols="12">
                <VTextField
                  v-model="manualProduct.description"
                  label="Descripción del Producto *"
                  placeholder="Ej: Filtro de Aceite Especial"
                  variant="outlined"
                  density="comfortable"
                  :rules="[requiredRule]"
                  color="primary"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="manualProduct.sku"
                  label="Código / Referencia (Opcional)"
                  placeholder="Ej: FLT-9988"
                  variant="outlined"
                  density="comfortable"
                  color="primary"
                />
              </VCol>
              <VCol cols="6">
                <VTextField
                  v-model.number="manualProduct.quantity"
                  type="number"
                  min="1"
                  label="Cantidad *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[requiredRule]"
                  color="primary"
                />
              </VCol>
              <VCol cols="6">
                <VTextField
                  v-model.number="manualProduct.price"
                  type="number"
                  min="0"
                  step="0.01"
                  label="Precio Compra Est. ($)"
                  prefix="$"
                  variant="outlined"
                  density="comfortable"
                  :rules="[requiredRule]"
                  color="primary"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-4 bg-white d-flex justify-end gap-2">
          <VBtn
            color="secondary"
            variant="outlined"
            @click="isManualProductDialogVisible = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            @click="addManualItemFromDialog"
          >
            Agregar al Pedido
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- VDialog: Repuestos Sugeridos a Reponer -->
    <VDialog
      v-model="isReplacementsDialogVisible"
      max-width="950"
      scrollable
    >
      <VCard class="custom-dialog-card rounded-xl overflow-hidden">
        <!-- Header Banner Primary -->
        <div class="custom-dialog-header-primary pb-5">
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="custom-dialog-close-btn"
            @click="isReplacementsDialogVisible = false"
          />
          <div class="custom-dialog-avatar">
            <VIcon icon="ri-history-line" />
          </div>
          <h2 class="custom-dialog-title">
            Repuestos Sugeridos a Reponer
          </h2>
          <p class="custom-dialog-subtitle">
            Repuestos solicitados en órdenes de trabajo que necesitan reposición
          </p>
          <div class="d-flex justify-center mb-3">
            <VChip
              size="small"
              color="white"
              variant="tonal"
              class="font-weight-bold text-white border"
            >
              {{ pendingReplacements.length }} Repuestos Pendientes
            </VChip>
          </div>
          <!-- Buscador Fijo en la Cabecera -->
          <div
            class="mx-auto px-2"
            style="max-width: 650px;"
          >
            <VTextField
              v-model="searchReplacementQuery"
              placeholder="Buscar por repuesto, código SKU o distribuidor sugerido..."
              prepend-inner-icon="ri-search-line"
              variant="solo"
              density="comfortable"
              clearable
              hide-details
              bg-color="white"
              class="elevation-3 rounded-lg text-body-1 text-grey-darken-4"
              :loading="loadingReplacements"
            />
          </div>
        </div>

        <VCardText class="pa-4 bg-grey-lighten-4">
          <!-- Tabla de sugerencias -->
          <div class="border rounded-lg overflow-hidden bg-white">
            <VTable
              class="w-100"
              density="comfortable"
              hover
            >
              <thead class="bg-grey-lighten-5">
                <tr>
                  <th class="text-left font-weight-bold text-grey-darken-3">
                    Repuesto
                  </th>
                  <th class="text-left font-weight-bold text-grey-darken-3">
                    Distribuidor Sugerido
                  </th>
                  <th
                    class="text-right font-weight-bold text-grey-darken-3"
                    style="width: 130px;"
                  >
                    Costo Adq.
                  </th>
                  <th
                    class="text-center font-weight-bold text-grey-darken-3"
                    style="width: 140px;"
                  >
                    Estado
                  </th>
                  <th
                    class="text-center font-weight-bold text-grey-darken-3"
                    style="width: 150px;"
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in filteredReplacements"
                  :key="item.id"
                >
                  <td class="py-3">
                    <div class="font-weight-medium text-body-2 text-grey-darken-4">
                      {{ item.description }}
                    </div>
                    <div
                      v-if="item.sku"
                      class="text-caption text-medium-emphasis font-mono"
                    >
                      SKU: {{ item.sku }}
                    </div>
                  </td>
                  <td class="py-3">
                    <div class="font-weight-medium text-body-2 text-grey-darken-4">
                      {{ item.supplier?.name || 'Sin Proveedor' }}
                    </div>
                    <div
                      v-if="item.supplier?.ruc"
                      class="text-caption text-medium-emphasis"
                    >
                      RUC: {{ item.supplier.ruc }}
                    </div>
                  </td>
                  <td class="py-3 text-right font-weight-bold font-mono text-body-2">
                    ${{ parseFloat(item.purchase_price || 0).toFixed(2) }}
                  </td>
                  <td class="py-3 text-center">
                    <VChip
                      v-if="isItemAlreadyInOrder(item)"
                      size="small"
                      color="success"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      <VIcon
                        icon="ri-check-line"
                        size="14"
                        class="mr-1"
                      />
                      En Pedido ({{ getItemQtyInOrder(item) }})
                    </VChip>
                    <VChip
                      v-else
                      size="small"
                      color="warning"
                      variant="tonal"
                    >
                      Pendiente
                    </VChip>
                  </td>
                  <td class="py-3 text-center">
                    <div class="d-flex justify-center align-center gap-2">
                      <VBtn
                        :icon="isItemAlreadyInOrder(item) ? 'ri-add-line' : 'ri-check-line'"
                        :color="isItemAlreadyInOrder(item) ? 'primary' : 'success'"
                        variant="elevated"
                        size="small"
                        :title="isItemAlreadyInOrder(item) ? 'Sumar 1 unidad más al pedido' : 'Agregar producto al listado del pedido'"
                        @click="addReplacementsToOrder(item)"
                      />
                      <VBtn
                        icon="ri-checkbox-circle-line"
                        variant="tonal"
                        color="secondary"
                        size="small"
                        title="Marcar como adquirido en bodega"
                        @click="markAsAcquired(item.id)"
                      />
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredReplacements.length === 0">
                  <td
                    colspan="5"
                    class="text-center py-8 text-medium-emphasis"
                  >
                    <VIcon
                      icon="ri-search-line"
                      size="40"
                      color="grey-lighten-1"
                      class="mb-2"
                    /><br>
                    {{ searchReplacementQuery ? 'No se encontraron repuestos con ese término de búsqueda.' :
                      'No hay repuestos pendientes de reposición.' }}
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 bg-white d-flex justify-space-between align-center">
          <div class="text-caption text-medium-emphasis">
            Mostrando {{ filteredReplacements.length }} de {{ pendingReplacements.length }} repuestos sugeridos
          </div>
          <VBtn
            color="secondary"
            variant="outlined"
            @click="isReplacementsDialogVisible = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
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

.custom-dialog-card {
  border-radius: 16px !important;
}

.custom-dialog-header-primary {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, #4338ca 100%);
  color: white;
  padding: 24px 20px 20px 20px;
  text-align: center;
  position: relative;
}

.custom-dialog-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  color: white !important;
}

.custom-dialog-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px auto;
  font-size: 24px;
}

.custom-dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: white;
}

.custom-dialog-subtitle {
  font-size: 0.875rem;
  opacity: 0.9;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.9);
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
