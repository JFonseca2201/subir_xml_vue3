<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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
const formRef = ref(null)
const pedidoId = ref(null)

const getUserId = () => {
  const userData = JSON.parse(localStorage.getItem('user'))
  userId.value = userData ? userData.id : null
}

// Estado del formulario
const pedido = ref({
  distribuidor_id: null,
  items: [],
  observations: ''
})

// Reglas de validación
const requiredRule = v => (
  v !== null &&
  v !== undefined &&
  v !== '' &&
  !(typeof v === 'number' && Number.isNaN(v))
) || 'Campo obligatorio'

// Cargar distribuidores al iniciar
const loadSuppliers = async () => {
  isLoading.value = true
  try {
    const response = await $api('suppliers')
    // Ajustar según estructura de respuesta del listado de proveedores
    suppliers.value = response.suppliers || response.data || response || []
  } catch (error) {
    console.error('Error al cargar distribuidores:', error)
    showNotification('Error al cargar la lista de distribuidores', 'error')
  } finally {
    isLoading.value = false
  }
}

// Cargar productos del distribuidor seleccionado
const loadProductsOfSupplier = async (supplierId) => {
  if (!supplierId) {
    supplierProducts.value = []
    return
  }

  isLoadingProducts.value = true
  try {
    const response = await $api(`pedidos-distribuidor/productos/${supplierId}`)
    if (response.status === 200) {
      supplierProducts.value = (response.products || []).map(p => ({
        ...p,
        searchText: `${p.sku || ''} ${p.description || ''}`.toLowerCase(),
        displayTitle: p.description || '',
      }))
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
watch(() => pedido.value.distribuidor_id, async (newVal, oldVal) => {

  searchProduct.value = null
  await loadProductsOfSupplier(newVal)
})

// Agregar producto seleccionado al carrito
const onProductSelected = product => {
  if (product && typeof product === 'object') {
    const existingItem = pedido.value.items.find(i => i.producto_id === product.id)
    if (existingItem) {
      existingItem.cantidad++
    } else {
      pedido.value.items.push({
        producto_id: product.id,
        description: product.description || '',
        sku: product.sku || '',
        cantidad: 1,
        precio_compra_estimado: parseFloat(product.purchase_price) || 0,
      })
    }

    // Limpiar selección de búsqueda
    searchProduct.value = null
  }
}

// Eliminar producto del carrito
const removeItem = index => {
  pedido.value.items.splice(index, 1)
}

// Agregar producto manual al carrito
const addManualItem = () => {
  pedido.value.items.push({
    producto_id: null,
    description: '',
    sku: '',
    cantidad: 1,
    precio_compra_estimado: 0,
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
  const desc = String(raw.description || '').toLowerCase()

  return sku.includes(q) || desc.includes(q)
}

// Cálculos
const total = computed(() => {
  return pedido.value.items.reduce((sum, item) => {
    const qty = Number(item.cantidad) || 0
    const price = Number(item.precio_compra_estimado) || 0
    return sum + (qty * price)
  }, 0)
})

// Cargar detalles del pedido para editar
const loadPedidoDetails = async (id) => {
  loader.start()
  try {
    const response = await $api(`pedidos-distribuidor/${id}`)
    if (response.success || response.status === 200) {
      const data = response.data
      pedido.value = {
        distribuidor_id: data.distribuidor_id,
        observations: data.observations || '',
        items: (data.detalles || []).map(detail => ({
          producto_id: detail.producto_id,
          description: detail.description,
          sku: detail.producto?.sku || '',
          cantidad: detail.cantidad,
          precio_compra_estimado: parseFloat(detail.precio_compra_estimado) || 0,
        }))
      }
    } else {
      showNotification('No se pudieron cargar los detalles del pedido', 'error')
    }
  } catch (error) {
    console.error('Error al cargar detalles del pedido:', error)
    showNotification('Error al cargar los detalles del pedido', 'error')
  } finally {
    loader.stop()
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

  loader.start()

  try {
    const payload = {
      distribuidor_id: pedido.value.distribuidor_id,
      usuario_id: userId.value,
      items: pedido.value.items.map(item => ({
        producto_id: item.producto_id,
        description: item.description,
        cantidad: item.cantidad,
        precio_compra_estimado: item.precio_compra_estimado,
      }))
    }

    const url = pedidoId.value ? `pedidos-distribuidor/${pedidoId.value}` : 'pedidos-distribuidor'
    const method = pedidoId.value ? 'PUT' : 'POST'

    const response = await $api(url, {
      method: method,
      body: payload
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
    loader.stop()
  }
}

const saveDraft = async () => {
  getUserId()

  if (!userId.value) {
    showNotification('Sesión inválida o expirada. Por favor vuelva a iniciar sesión.', 'error')
    return
  }

  if (pedido.value.items.length === 0) {
    showNotification('Debe agregar al menos un producto al pedido para guardar el borrador.', 'error')
    return
  }

  loader.start()

  try {
    const payload = {
      distribuidor_id: pedido.value.distribuidor_id,
      usuario_id: userId.value,
      is_draft: true,
      items: pedido.value.items.map(item => ({
        producto_id: item.producto_id,
        description: item.description,
        cantidad: item.cantidad,
        precio_compra_estimado: item.precio_compra_estimado,
      }))
    }

    const url = pedidoId.value ? `pedidos-distribuidor/${pedidoId.value}` : 'pedidos-distribuidor'
    const method = pedidoId.value ? 'PUT' : 'POST'

    const response = await $api(url, {
      method: method,
      body: payload
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
    loader.stop()
  }
}

onMounted(async () => {
  getUserId()
  await loadSuppliers()

  const id = route.query.id
  if (id) {
    pedidoId.value = id
    await loadPedidoDetails(id)
  }
})
</script>

<template>
  <div class="pa-4 pa-sm-6">
    <!-- Encabezado de la página -->
    <div
      class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4 border-b pb-4">
      <div>
        <div class="d-flex align-center">
          <VAvatar color="info-lighten-5" size="48" class="mr-3">
            <VIcon icon="ri-truck-line" size="32" color="info" />
          </VAvatar>
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">
              {{ pedidoId ? 'Editar Pedido a Distribuidor' : 'Generar Pedido a Distribuidor' }}
            </h1>
            <p class="text-medium-emphasis mb-0">Solicitud de productos a proveedor (sin impacto en inventario ni caja)
            </p>
          </div>
        </div>
      </div>
      <VBtn color="secondary" variant="tonal" prepend-icon="ri-arrow-left-line" to="/sales/pedidos-distribuidor-list"
        class="align-self-md-center align-self-end">
        Volver al Listado
      </VBtn>
    </div>

    <VForm ref="formRef" @submit.prevent="submitForm">
      <VRow>
        <!-- Columna de Detalles del Pedido -->
        <VCol cols="12" md="8">

          <!-- Selección de Distribuidor -->
          <VCard variant="outlined" class="mb-6 border-opacity-25 rounded-lg elevation-1">
            <VCardTitle class="bg-grey-lighten-4 pa-4 d-flex align-center border-b">
              <VIcon icon="ri-store-2-line" color="info" class="mr-2" />
              <span class="text-h6 font-weight-bold">1. Selección de Distribuidor</span>
            </VCardTitle>
            <VCardText class="pa-6">
              <VAutocomplete v-model="pedido.distribuidor_id" :loading="isLoading" :items="suppliers" item-title="name"
                item-value="id" label="Distribuidor / Proveedor *" placeholder="Seleccione un distribuidor..."
                prepend-inner-icon="ri-truck-fill" variant="outlined" density="comfortable" :rules="[requiredRule]"
                color="info" clearable required>
                <template #item="{ props, item }">
                  <VListItem v-bind="props" :title="item.raw.name"
                    :subtitle="item.raw.ruc ? `RUC: ${item.raw.ruc}` : ''" />
                </template>
              </VAutocomplete>
            </VCardText>
          </VCard>

          <!-- Búsqueda y Selección de Productos -->
          <VCard variant="outlined" class="mb-6 border-opacity-25 rounded-lg elevation-1">
            <VCardTitle class="bg-grey-lighten-4 pa-4 d-flex align-center border-b">
              <VIcon icon="ri-shopping-cart-2-line" color="info" class="mr-2" />
              <span class="text-h6 font-weight-bold">2. Productos Solicitados</span>
            </VCardTitle>
            <VCardText class="pa-6">
              <!-- Autocomplete y botón manual habilitado solo si hay un distribuidor seleccionado -->
              <div class="d-flex align-center gap-4 mb-4">
                <VAutocomplete v-model="searchProduct" :loading="isLoadingProducts" :items="supplierProducts"
                  item-title="displayTitle" return-object label="Buscar y agregar producto de catálogo"
                  placeholder="Escribe para buscar por nombre, SKU..." prepend-inner-icon="ri-search-line"
                  variant="outlined" clearable :disabled="!pedido.distribuidor_id" :custom-filter="productFilter"
                  @update:model-value="onProductSelected" color="info" class="flex-grow-1" hide-details
                  :menu-props="{ maxWidth: 0 }">
                  <template #item="{ props, item }">
                    <VListItem v-bind="props" :title="undefined">
                      <VListItemTitle style="white-space: normal !important; line-height: 1.4;"
                        class="font-weight-medium">
                        {{ item.raw.description }}
                      </VListItemTitle>
                      <VListItemSubtitle class="mt-1 text-grey">
                        {{ item.raw.sku ? `SKU: ${item.raw.sku} | Stock actual: ${item.raw.stock}` : `Stock actual:
                        ${item.raw.stock}` }}
                      </VListItemSubtitle>
                    </VListItem>
                  </template>
                  <template #no-data>
                    <div class="pa-4 text-center text-medium-emphasis">
                      <VIcon icon="ri-information-line" class="mr-1" />
                      {{
                        pedido.distribuidor_id ? 'No se encontraron productos para este distribuidor' :
                          'Seleccione un distribuidor primero'
                      }}
                    </div>
                  </template>
                </VAutocomplete>

                <VBtn color="info" variant="tonal" prepend-icon="ri-add-line" :disabled="!pedido.distribuidor_id"
                  @click="addManualItem">
                  Ingresar Manual
                </VBtn>
              </div>

              <div class="border rounded-lg">
                <VTable class="w-100">
                  <thead class="bg-grey-lighten-4">
                    <tr>
                      <th class="text-left">Producto</th>
                      <th style="width: 100px;" class="text-center">Cantidad</th>
                      <th style="width: 150px;" class="text-center">Precio Compra Est.</th>
                      <th style="width: 120px;" class="text-right">Subtotal</th>
                      <th style="width: 50px;" class="text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in pedido.items" :key="index">
                      <td class="pa-2">
                        <VTextField v-if="!item.producto_id" v-model="item.description"
                          placeholder="Descripción del producto manual *" variant="outlined" density="compact"
                          hide-details="auto" :rules="[requiredRule]" color="info" />
                        <div v-else>
                          <div class="font-weight-medium text-body-1">{{ item.description }}</div>
                          <div class="text-caption text-medium-emphasis" v-if="item.sku">SKU: {{ item.sku }}</div>
                        </div>
                      </td>
                      <td class="pa-2">
                        <VTextField v-model.number="item.cantidad" type="number" min="1" variant="outlined"
                          density="compact" hide-details="auto" :rules="[requiredRule]" class="text-center" />
                      </td>
                      <td class="pa-2">
                        <VTextField v-model.number="item.precio_compra_estimado" type="number" min="0" step="0.01"
                          variant="outlined" density="compact" hide-details="auto" :rules="[requiredRule]" prefix="$" />
                      </td>
                      <td class="pa-2 text-right font-weight-bold text-body-1 text-info">
                        ${{ (item.cantidad * item.precio_compra_estimado).toFixed(2) }}
                      </td>
                      <td class="pa-2 text-center">
                        <VBtn icon="ri-delete-bin-line" variant="text" color="error" size="small"
                          @click="removeItem(index)" />
                      </td>
                    </tr>
                    <tr v-if="pedido.items.length === 0">
                      <td colspan="5" class="text-center pa-8 text-medium-emphasis">
                        <VIcon icon="ri-inbox-line" size="48" class="mb-2 opacity-50" /><br>
                        No hay productos agregados.
                        <div class="text-caption mt-1" v-if="!pedido.distribuidor_id">
                          Seleccione un distribuidor arriba para buscar productos.
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </VCardText>
          </VCard>

          <VTextarea v-model="pedido.observations" label="Notas / Observaciones del Pedido"
            placeholder="Escriba alguna observación opcional aquí..." variant="outlined"
            prepend-inner-icon="ri-edit-2-line" hide-details="auto" rows="3" color="info" />
        </VCol>

        <!-- Columna de Resumen del Pedido -->
        <VCol cols="12" md="4">
          <div class="position-sticky" style="top: 24px; z-index: 1;">

            <VCard variant="outlined" class="border-opacity-25 rounded-lg elevation-1 mb-6">
              <VCardTitle class="bg-grey-lighten-4 pa-4 d-flex align-center border-b">
                <VIcon icon="ri-file-text-line" color="info" class="mr-2" />
                <span class="text-h6 font-weight-bold">Resumen del Pedido</span>
              </VCardTitle>
              <VCardText class="pa-6">

                <div class="d-flex justify-space-between align-center mb-4">
                  <span class="text-body-1 text-medium-emphasis">Items agregados:</span>
                  <span class="text-body-1 font-weight-medium">{{ pedido.items.length }}</span>
                </div>

                <div class="d-flex justify-space-between align-center mb-6">
                  <span class="text-body-1 text-medium-emphasis">Total cantidades:</span>
                  <span class="text-body-1 font-weight-medium">
                    {{pedido.items.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0)}}
                  </span>
                </div>

                <div class="border-t pt-4 mt-4">
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="text-h6 font-weight-bold">Total Estimado</span>
                    <span class="text-h5 font-weight-black text-info">${{ total.toFixed(2) }}</span>
                  </div>
                </div>

                <div class="mt-6 pa-3 bg-blue-lighten-5 rounded-lg border border-blue-lighten-4">
                  <div class="d-flex align-start gap-2">
                    <VIcon icon="ri-information-fill" color="info" class="mt-1" />
                    <div class="text-caption text-info-darken-3">
                      <strong>Información Importante:</strong>
                      Este pedido se registrará en estado <strong>Pendiente</strong>. No afecta el stock actual ni
                      genera
                      facturación financiera.
                    </div>
                  </div>
                </div>
              </VCardText>

              <VCardActions class="pa-6 pt-0 d-flex flex-column gap-3">
                <VBtn color="secondary" variant="outlined" block size="large" prepend-icon="ri-draft-line"
                  @click.prevent="saveDraft">
                  {{ pedidoId ? 'Actualizar Borrador' : 'Guardar Borrador' }}
                </VBtn>
                <VBtn color="info" variant="flat" block size="large" type="submit" prepend-icon="ri-send-plane-fill"
                  :disabled="pedido.items.length === 0">
                  {{ pedidoId ? 'Guardar Cambios' : 'Generar Pedido' }}
                </VBtn>
              </VCardActions>
            </VCard>
          </div>
        </VCol>
      </VRow>
    </VForm>
  </div>
</template>
