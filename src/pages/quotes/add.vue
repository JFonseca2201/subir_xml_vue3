<script setup>
import { ref, computed, onMounted, onActivated, nextTick, watch } from 'vue'
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
import DistributorCatalogSearchDialog from '@/components/distribuidor-catalogo/DistributorCatalogSearchDialog.vue'
import { useFormDraft } from '@/composables/useFormDraft'

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
const isSubmitting = ref(false)
const showValidationError = ref(false)
const validationErrorMessage = ref('')

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const employees = ref([])

const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000
  
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0]
}

const quote = ref({
  document_number: '',
  client_id: null,
  vehicle_id: null,
  work_order_id: null,
  mileage: null,
  service_date: getLocalDateString(),
  observations: '',
  technicians: [],
  items: [],
  user_id: userId.value,
})

const resetQuote = () => {
  quote.value = {
    document_number: nextQuoteNumber.value || '',
    client_id: null,
    vehicle_id: null,
    work_order_id: null,
    mileage: null,
    service_date: getLocalDateString(),
    observations: '',
    technicians: [],
    items: [],
    user_id: userId.value,
  }
  selectedClient.value = null
  selectedVehicle.value = null
}

const cancelAndReturn = () => {
  clearDraft()
  resetQuote()
  router.push('/quotes/list')
}

const { hasDraft, draftTimestamp, clearDraft, discardDraft, restoreDraft, checkHasDraft } = useFormDraft('quote_add', quote, {
  autoRestore: false,
  excludeFields: ['document_number'],
  clearOnRouteLeave: true,
  resetForm: resetQuote,
  isMeaningful: data => {
    return !!(
      data.client_id ||
      (data.items && data.items.length > 0) ||
      (data.observations && data.observations.trim()) ||
      data.vehicle_id ||
      data.work_order_id
    )
  },
  validateDraft: draftData => {
    if (draftData?.document_number && nextQuoteNumber.value) {
      const draftNum = parseInt(String(draftData.document_number).replace(/\D/g, '')) || 0
      const currentNextNum = parseInt(String(nextQuoteNumber.value).replace(/\D/g, '')) || 0
      if (draftNum > 0 && currentNextNum > 0 && draftNum < currentNextNum) {
        return false
      }
    }
    return true
  },
})

const positiveNumberRule = v => v >= 0 || 'El valor no puede ser negativo'

const requiredRule = v => (
  v !== null &&
  v !== undefined &&
  v !== '' &&
  !(typeof v === 'number' && Number.isNaN(v))
) || 'Campo obligatorio'

const nextQuoteNumber = ref('')

const generateDocumentNumber = () => {
  return nextQuoteNumber.value || '000000000'
}

const isLinkedToWorkOrder = computed(() => !!quote.value.work_order_id)

const selectedClient = ref(null)
const selectedVehicle = ref(null)

const handleClientAdded = async newClient => {
  const clientObj = newClient.client || newClient.data || newClient

  selectedClient.value = clientObj
  showNotification('Cliente registrado exitosamente', 'success')
}

const handleVehicleAdded = async newVehicle => {
  const vehicleObj = newVehicle.vehicle || newVehicle.data || newVehicle

  selectedVehicle.value = vehicleObj
  showNotification('Vehículo registrado exitosamente', 'success')
}

watch(() => selectedClient.value, newVal => {
  if (newVal && newVal.id) {
    quote.value.client_id = newVal.id
  } else {
    quote.value.client_id = null
  }
})

watch(() => selectedVehicle.value, newVal => {
  if (newVal && newVal.id) {
    quote.value.vehicle_id = newVal.id
    if (newVal.client_id && !quote.value.client_id) {
      quote.value.client_id = newVal.client_id
      selectedClient.value = newVal.client || null
    }
  } else {
    quote.value.vehicle_id = null
  }
})

const productSearchQuery = ref('')

// Dialogs state
const isClientFinalDialogVisible = ref(false)
const isClientCompanyDialogVisible = ref(false)
const isVehicleDialogVisible = ref(false)
const isAddServiceDialogVisible = ref(false)
const isManualProductDialogVisible = ref(false)
const isDistributorCatalogDialogVisible = ref(false)

// Manual Product Form State
const manualFormRef = ref(null)

const manualProduct = ref({
  description: '',
  sku: '',
  quantity: 1,
  price: '',
  discount: 0,
  type: 'product',
})

const resetManualProductForm = () => {
  manualProduct.value = {
    description: '',
    sku: '',
    quantity: 1,
    price: '',
    discount: 0,
    type: 'product',
  }
  manualFormRef.value?.resetValidation()
}

const openManualProductDialog = () => {
  isManualProductDialogVisible.value = true
  resetManualProductForm()
}

const addManualItem = async () => {
  const { valid } = await manualFormRef.value?.validate()
  if (!valid) return

  const desc = (manualProduct.value.description || '').trim()
  if (!desc) {
    showNotification('La descripción del producto es requerida', 'warning')
    
    return
  }

  quote.value.items.push({
    product_id: null,
    description: desc,
    sku: manualProduct.value.sku ? manualProduct.value.sku.trim().toUpperCase() : 'MANUAL',
    quantity: Number(manualProduct.value.quantity) || 1,
    price: Number(manualProduct.value.price) || 0,
    discount: Number(manualProduct.value.discount) || 0,
    type: manualProduct.value.type || 'product',
    is_manual: true,
  })

  showNotification('Producto manual agregado a la cotización', 'success')
  isManualProductDialogVisible.value = false
  resetManualProductForm()
}

const addDistributorCatalogItem = itemPayload => {
  if (!itemPayload) return

  const existing = quote.value.items.find(item => {
    if (itemPayload.sku && item.sku && item.sku === itemPayload.sku) return true
    if (itemPayload.product_id && item.product_id && item.product_id === itemPayload.product_id) return true
    if (
      item.description &&
      itemPayload.description &&
      item.description.trim().toLowerCase() === itemPayload.description.trim().toLowerCase()
    ) return true
    return false
  })

  if (existing) {
    existing.quantity = (Number(existing.quantity) || 0) + (Number(itemPayload.quantity) || 1)
    showNotification(`Cantidad actualizada a ${existing.quantity} para "${existing.description}"`, 'info')
  } else {
    quote.value.items.push({
      ...itemPayload,
      quantity: Number(itemPayload.quantity) || 1,
    })
    showNotification(`"${itemPayload.description}" agregado a la cotización`, 'success')
  }
}

const isServiceItem = item => {
  if (!item) return false
  if (item.type === 'service') return true
  if (item.item_type === 2) return true
  if (item.sku && String(item.sku).toUpperCase().startsWith('SRV-')) return true
  return false
}

const toggleItemType = item => {
  if (!item) return
  if (isServiceItem(item)) {
    item.type = 'product'
    item.item_type = 1
  } else {
    item.type = 'service'
    item.item_type = 2
  }
}

const addTemporaryProduct = () => {
  openManualProductDialog()
}

const getProductPriceWithTax = product => {
  if (!product) return 0
  const rawPrice = parseFloat(product.price_sale) || parseFloat(product.price) || 0
  const taxRate = parseFloat(product.tax_rate) || 0

  if (taxRate > 0) {
    return parseFloat((rawPrice * (1 + (taxRate / 100))).toFixed(2))
  }

  return parseFloat(rawPrice.toFixed(2))
}

const selectedProductTemp = ref(null)

// Item actions
const addItem = prod => {
  if (!prod) return

  const existing = quote.value.items.find(item => item.product_id === prod.id)
  if (existing) {
    existing.quantity++
    showNotification('Cantidad incrementada', 'info')

    // Limpiar buscador
    nextTick(() => {
      selectedProductTemp.value = null
      productSearchQuery.value = ''
    })
    
    return
  }

  quote.value.items.push({
    product_id: prod.id,
    description: prod.description || prod.name || '',
    quantity: 1,
    price: getProductPriceWithTax(prod),
    discount: 0,
    type: prod.item_type === 2 ? 'service' : 'product',
    sku: prod.sku || prod.code || '',
  })

  showNotification('Producto agregado a la cotización', 'success')

  // Limpiar buscador
  nextTick(() => {
    selectedProductTemp.value = null
    productSearchQuery.value = ''
  })
}

const addCustomService = serviceData => {
  quote.value.items.push({
    product_id: null,
    description: serviceData.description,
    quantity: 1,
    price: parseFloat(serviceData.price) || 0,
    discount: 0,
    type: 'service',
    sku: 'EXPRESS',
    is_manual: true,
  })
  showNotification('Servicio personalizado agregado', 'success')
}

const removeItem = index => {
  quote.value.items.splice(index, 1)
}

// Totals calculations (prices in grid already include IVA)
const subtotal = computed(() => {
  return quote.value.items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.price) || 0
    
    return sum + (qty * price)
  }, 0)
})

const totalDiscount = computed(() => {
  return quote.value.items.reduce((sum, item) => {
    return sum + (Number(item.discount) || 0)
  }, 0)
})

const total = computed(() => {
  return Math.max(0, subtotal.value - totalDiscount.value)
})

const displaySubtotal = computed(() => {
  return subtotal.value / 1.15
})

const displayDiscount = computed(() => {
  return totalDiscount.value / 1.15
})

const displaySubtotalNeto = computed(() => {
  return Math.max(0, displaySubtotal.value - displayDiscount.value)
})

const taxAmount = computed(() => {
  return total.value - displaySubtotalNeto.value
})

const isNextNumberLoading = ref(false)

const fetchNextQuoteNumber = async (force = false) => {
  if (!force && quote.value.work_order_id && quote.value.document_number) return

  isNextNumberLoading.value = true
  try {
    const nextNumberRes = await $api('quotes/next-number')
    if (nextNumberRes?.data) {
      nextQuoteNumber.value = nextNumberRes.data
      quote.value.document_number = nextNumberRes.data
    }
  } catch (err) {
    console.warn('Error loading next quote number:', err)
  } finally {
    isNextNumberLoading.value = false
  }
}

const loadInitialData = async () => {
  isLoading.value = true
  try {
    const [employeesRes] = await Promise.all([
      $api('employees', { params: { per_page: 1000 } }),
      fetchNextQuoteNumber(),
    ])

    const extractArray = (res, key) => {
      if (Array.isArray(res)) return res
      if (res?.[key] && Array.isArray(res[key])) return res[key]
      if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
      if (res?.data && Array.isArray(res.data)) return res.data
      
      return []
    }

    employees.value = extractArray(employeesRes, 'employees')

    // Validar si el borrador guardado pertenece a una cotización que ya fue salvada
    if (!route.query.work_order_id) {
      const isValid = checkHasDraft(draftData => {
        if (!draftData) return false
        if (draftData.document_number && nextQuoteNumber.value) {
          const draftNum = parseInt(String(draftData.document_number).replace(/\D/g, '')) || 0
          const currentNextNum = parseInt(String(nextQuoteNumber.value).replace(/\D/g, '')) || 0
          if (draftNum > 0 && currentNextNum > 0 && draftNum < currentNextNum) {
            console.log(`[quotes/add] Borrador descartado: La cotización #${draftData.document_number} ya fue guardada en el sistema.`)
            return false
          }
        }
        return true
      })

      if (isValid) {
        const freshDocNumber = quote.value.document_number
        restoreDraft()
        quote.value.document_number = freshDocNumber
      }
    }

  } catch (error) {
    console.error('Error al cargar datos:', error)
    showNotification('Error al cargar datos iniciales', 'error')
  } finally {
    isLoading.value = false
  }
}

const submitForm = async () => {
  getUserId()
  quote.value.user_id = userId.value
  showValidationError.value = false
  validationErrorMessage.value = ''

  if (formRef.value) {
    const { valid } = await formRef.value.validate()
    if (!valid) {
      showValidationError.value = true
      validationErrorMessage.value = 'Por favor, complete todos los campos obligatorios marcados con *'
      showNotification('Por favor, complete todos los campos obligatorios marcados con *', 'warning')
      
      return
    }
  }

  if (!quote.value.client_id) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe seleccionar un cliente para continuar'
    showNotification('Debe seleccionar un cliente para continuar', 'warning')
    
    return
  }

  if (quote.value.items.length === 0) {
    showValidationError.value = true
    validationErrorMessage.value = 'Debe agregar al menos un producto o servicio'
    showNotification('Debe agregar al menos un producto o servicio', 'warning')
    
    return
  }

  isSubmitting.value = true

  try {
    const payload = {
      ...quote.value,
      subtotal: displaySubtotalNeto.value,
      tax_amount: taxAmount.value,
      total: total.value,
    }

    const response = await $api('quotes', {
      method: 'POST',
      body: payload,
    })

    if (response.success || response.status === 201) {
      showNotification('Cotización registrada exitosamente', 'success')
      clearDraft()
      resetQuote()
      showValidationError.value = false
      router.push('/quotes/list')
    } else {
      showNotification(response.message || 'Error al registrar', 'error')
    }
  } catch (error) {
    console.error('Error enviando formulario', error)

    const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'

    showNotification(errMsg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  await loadInitialData()
})

onActivated(async () => {
  getUserId()
  quote.value.user_id = userId.value

  if (!quote.value.work_order_id) {
    await fetchNextQuoteNumber()
  }
})
</script>

<template>
  <div class="pa-4 pa-sm-6 position-relative">
    <VProgressLinear
      v-if="isLoading"
      v-slot
      indeterminate
      color="primary"
      height="3"
      class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 10;"
    />

    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
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
              icon="ri-file-list-3-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Registrar Cotización
              </h1>
              <VChip
                color="primary"
                size="small"
                variant="tonal"
                class="font-weight-bold"
                prepend-icon="ri-file-text-line"
              >
                Presupuesto
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Crea un presupuesto detallado para un cliente
            </p>
          </div>
        </div>

        <div class="d-flex align-center justify-end gap-2 flex-wrap ms-auto">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-arrow-left-line"
            class="font-weight-medium"
            @click="cancelAndReturn"
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
        <VCol
          cols="12"
          md="8"
        >
          <!-- Cabecera de la Cotización -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    size="36"
                    color="primary"
                    variant="tonal"
                    class="rounded-lg"
                  >
                    <VIcon
                      icon="ri-file-text-line"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                      Datos del Presupuesto
                    </h3>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Número secuencial y fecha de emisión
                    </p>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5">
              <VRow>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="quote.document_number"
                    label="Secuencial Cotización"
                    variant="outlined"
                    density="comfortable"
                    :rules="[requiredRule]"
                    readonly
                    bg-color="grey-lighten-4"
                    prepend-inner-icon="ri-hashtag"
                    :loading="isLoading || isNextNumberLoading"
                    :error="showValidationError && (!quote.document_number || !String(quote.document_number).trim())"
                    :error-messages="showValidationError && (!quote.document_number || !String(quote.document_number).trim()) ? ['Número de cotización es requerido'] : []"
                    append-inner-icon="ri-refresh-line"
                    @click:append-inner="fetchNextQuoteNumber(true)"
                  />
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                >
                  <VTextField
                    v-model="quote.service_date"
                    type="date"
                    label="Fecha"
                    variant="outlined"
                    density="comfortable"
                    :rules="[requiredRule]"
                    prepend-inner-icon="ri-calendar-line"
                    :error="showValidationError && !quote.service_date"
                    :error-messages="showValidationError && !quote.service_date ? ['Fecha es requerida'] : []"
                  />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Cliente y Vehículo -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="py-3 px-4 border-b">
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
                        icon="ri-user-settings-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                        Cliente y Vehículo
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Selecciona el cliente y el vehículo para la cotización
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5">

              <VRow>
                <!-- Cliente -->
                <VCol
                  cols="12"
                  sm="6"
                >
                  <div class="d-flex gap-2 align-center">
                    <VSearch
                      v-model="selectedClient"
                      :return-object="true"
                      endpoint="clients/search"
                      item-title="full_name"
                      label="Cliente *"
                      icon="ri-user-line"
                      :initial-item="selectedClient"
                      :rules="[(v) => !!v || !!quote.client_id || 'Cliente es requerido']"
                      :error="showValidationError && (!selectedClient || !quote.client_id)"
                      :error-messages="showValidationError && (!selectedClient || !quote.client_id) ? ['Cliente es requerido'] : []"
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
                    <VMenu>
                      <template #activator="{ props }">
                        <VBtn
                          icon="ri-add-line"
                          color="primary"
                          variant="tonal"
                          v-bind="props"
                          class="mb-5"
                        />
                      </template>
                      <VList density="compact">
                        <VListItem
                          title="Persona Natural"
                          prepend-icon="ri-user-line"
                          @click="isClientFinalDialogVisible = true"
                        />
                        <VListItem
                          title="Empresa / Jurídico"
                          prepend-icon="ri-building-line"
                          @click="isClientCompanyDialogVisible = true"
                        />
                      </VList>
                    </VMenu>
                  </div>
                  <div
                    v-if="selectedClient"
                    class="text-caption text-grey mt-0 mb-3 ms-1"
                  >
                    <VIcon
                      icon="ri-file-list-3-line"
                      size="14"
                      class="me-1"
                    />
                    Cédula/RUC: <span class="font-weight-semibold">{{ selectedClient.n_document || 'N/A' }}</span>
                  </div>
                </VCol>

                <!-- Vehículo -->
                <VCol
                  cols="12"
                  sm="6"
                >
                  <div class="d-flex gap-2 align-center">
                    <VSearch
                      v-model="selectedVehicle"
                      :return-object="true"
                      endpoint="vehicles/search"
                      item-title="license_plate"
                      label="Vehículo"
                      icon="ri-car-line"
                      :initial-item="selectedVehicle"
                      :extra-params="quote.client_id ? { client_id: quote.client_id } : {}"
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
                      icon="ri-add-line"
                      color="primary"
                      variant="tonal"
                      class="mb-5"
                      @click="isVehicleDialogVisible = true"
                    />
                  </div>
                </VCol>

                <!-- Datos del Cliente (3 Relevantes) -->
                <VCol
                  v-if="selectedClient"
                  cols="12"
                  sm="6"
                >
                  <VCard
                    variant="flat"
                    color="grey-lighten-4"
                    class="pa-4 rounded-lg"
                  >
                    <div class="font-weight-bold text-subtitle-2 mb-2 text-grey-darken-3">
                      Datos del Cliente
                    </div>
                    <div class="text-caption d-flex flex-column gap-1">
                      <div><strong>Documento:</strong> {{ selectedClient.n_document || '-' }}</div>
                      <div><strong>Teléfono:</strong> {{ selectedClient.phone || '-' }}</div>
                      <div><strong>Correo:</strong> {{ selectedClient.email || '-' }}</div>
                    </div>
                  </VCard>
                </VCol>

                <!-- Datos del Vehículo (3 Relevantes) -->
                <VCol
                  v-if="selectedVehicle"
                  cols="12"
                  sm="6"
                >
                  <VCard
                    variant="flat"
                    color="grey-lighten-4"
                    class="pa-4 rounded-lg"
                  >
                    <div class="font-weight-bold text-subtitle-2 mb-2 text-grey-darken-3">
                      Datos del Vehículo
                    </div>
                    <div class="text-caption d-flex flex-column gap-1">
                      <div>
                        <strong>Placa:</strong> <span class="text-uppercase font-weight-bold text-primary">{{
                          selectedVehicle.license_plate }}</span>
                      </div>
                      <div><strong>Marca/Modelo:</strong> {{ selectedVehicle.displayTitle }}</div>
                      <div>
                        <strong>Color/Año:</strong> {{ selectedVehicle.color || '-' }} / {{ selectedVehicle.year ||
                          '-' }}
                      </div>
                    </div>
                  </VCard>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Búsqueda y Agregar Items -->
          <!-- Tarjeta: Productos y Servicios (Igual a la de ventas) -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="py-3 px-4 border-b">
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
                      <div class="d-flex align-center gap-2 flex-wrap">
                        <h3 class="text-subtitle-1 font-weight-bold text-slate-900 mb-0">
                          Productos y Servicios
                        </h3>
                        <VChip
                          v-if="quote.items.length > 0"
                          size="x-small"
                          color="primary"
                          variant="tonal"
                          class="font-weight-bold"
                        >
                          {{ quote.items.length }}
                        </VChip>
                      </div>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Agrega ítems a presupuestar
                      </p>
                    </div>
                  </div>
                  <div class="d-flex gap-2 flex-wrap">
                    <VBtn
                      size="small"
                      color="primary"
                      variant="tonal"
                      prepend-icon="ri-box-3-line"
                      class="font-weight-semibold"
                      @click="openManualProductDialog"
                    >
                      Producto Temporal
                    </VBtn>
                    <VBtn
                      size="small"
                      color="info"
                      variant="tonal"
                      prepend-icon="ri-store-2-line"
                      class="font-weight-semibold"
                      @click="isDistributorCatalogDialogVisible = true"
                    >
                      Catálogo Distribuidores
                    </VBtn>
                    <VBtn
                      size="small"
                      color="secondary"
                      variant="tonal"
                      prepend-icon="ri-tools-line"
                      class="font-weight-semibold"
                      @click="isAddServiceDialogVisible = true"
                    >
                      Servicio Express
                    </VBtn>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 pa-sm-5">
              <!-- Cuadro de búsqueda de productos -->
              <div class="mb-4">
                <VSearch
                  v-model="selectedProductTemp"
                  endpoint="products/search"
                  item-title="description"
                  :return-object="true"
                  label="Buscar y agregar producto o servicio por nombre, código o SKU..."
                  icon="ri-search-line"
                  class="mb-0"
                  hide-details
                  @change="addItem"
                >
                  <template #item="{ props, item }">
                    <VListItem
                      v-bind="props"
                      :title="undefined"
                    >
                      <template #prepend>
                        <VAvatar
                          size="32"
                          color="primary"
                          variant="tonal"
                          class="rounded-lg"
                        >
                          <VIcon
                            icon="ri-box-3-line"
                            size="18"
                          />
                        </VAvatar>
                      </template>
                      <VListItemTitle
                        style="white-space: normal !important; line-height: 1.4;"
                        class="font-weight-medium text-body-2"
                      >
                        {{ item.raw.description || item.raw.name }}
                      </VListItemTitle>
                      <VListItemSubtitle
                        v-if="item.raw.code_aux || item.raw.sku"
                        class="mt-1 text-grey"
                      >
                        Código/SKU: {{ item.raw.code_aux || item.raw.sku }}
                      </VListItemSubtitle>
                      <template #append>
                        <VChip
                          size="small"
                          color="success"
                          variant="tonal"
                          class="font-weight-bold"
                        >
                          ${{ getProductPriceWithTax(item.raw).toFixed(2) }}
                        </VChip>
                      </template>
                    </VListItem>
                  </template>
                </VSearch>
              </div>

              <!-- Tabla de items (Igual a Ventas) -->
              <div
                v-if="quote.items.length > 0"
                class="rounded-xl border overflow-hidden"
              >
                <table class="custom-sales-items-table">
                  <thead>
                    <tr class="bg-slate-50 text-caption font-weight-bold">
                      <th class="text-left th-desc">
                        Ítem / Descripción
                      </th>
                      <th class="text-center th-qty">
                        Cant.
                      </th>
                      <th class="text-center th-price">
                        P.V.P
                      </th>
                      <th class="text-center th-discount">
                        Desc. $
                      </th>
                      <th class="text-right th-subtotal">
                        Subtotal
                      </th>
                      <th class="text-center th-actions">
                        Acc.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(item, index) in quote.items"
                      :key="index"
                      class="sales-item-row"
                    >
                      <!-- Columna Descripción -->
                      <td class="td-desc">
                        <div class="d-flex align-center gap-2 py-1">
                          <VAvatar
                            size="28"
                            :color="isServiceItem(item) ? 'info' : 'primary'"
                            variant="tonal"
                            class="rounded-lg flex-shrink-0"
                          >
                            <VIcon
                              :icon="isServiceItem(item) ? 'ri-tools-line' : 'ri-box-3-line'"
                              size="14"
                            />
                          </VAvatar>
                          <div class="desc-content-col">
                            <input
                              v-model="item.description"
                              type="text"
                              placeholder="Descripción del ítem..."
                              class="item-title-input"
                              :title="item.description"
                            >
                            <div class="item-meta-row mt-0.5">
                              <span
                                class="meta-tag cursor-pointer"
                                :class="isServiceItem(item) ? 'tag-service' : 'tag-product'"
                                title="Clic para alternar entre Producto y Servicio"
                                @click="toggleItemType(item)"
                              >
                                {{ isServiceItem(item) ? 'Servicio' : 'Producto' }}
                              </span>
                              <span
                                v-if="item.sku"
                                class="meta-sku font-mono"
                              >
                                {{ item.sku }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <!-- Columna Cantidad con stepper -->
                      <td class="td-qty text-center">
                        <div class="qty-stepper-mini">
                          <button
                            type="button"
                            class="qty-mini-btn"
                            :disabled="item.quantity <= 1"
                            @click="item.quantity--"
                          >
                            <VIcon
                              icon="ri-subtract-line"
                              size="12"
                            />
                          </button>
                          <span class="qty-mini-val font-mono">{{ item.quantity }}</span>
                          <button
                            type="button"
                            class="qty-mini-btn"
                            :disabled="item.quantity >= 99"
                            @click="item.quantity++"
                          >
                            <VIcon
                              icon="ri-add-line"
                              size="12"
                            />
                          </button>
                        </div>
                      </td>

                      <!-- Columna Precio Unitario -->
                      <td class="td-price text-center">
                        <div class="cell-input-wrapper">
                          <span class="cell-prefix">$</span>
                          <input
                            v-model.number="item.price"
                            type="number"
                            min="0"
                            step="0.01"
                            class="cell-number-input font-mono font-weight-bold text-slate-800"
                            placeholder="0.00"
                          >
                        </div>
                      </td>

                      <!-- Columna Descuento -->
                      <td class="td-discount text-center">
                        <div class="cell-input-wrapper">
                          <span class="cell-prefix">$</span>
                          <input
                            v-model.number="item.discount"
                            type="number"
                            min="0"
                            step="0.01"
                            class="cell-number-input font-mono font-weight-medium text-error"
                            placeholder="0.00"
                          >
                        </div>
                      </td>

                      <!-- Columna Subtotal -->
                      <td class="td-subtotal text-right">
                        <span
                          class="font-mono font-weight-black text-success"
                          style="font-size: 0.88rem;"
                        >
                          ${{ (((Number(item.quantity) || 0) * (Number(item.price) || 0)) - (Number(item.discount) || 0)).toFixed(2) }}
                        </span>
                      </td>

                      <!-- Columna Acciones -->
                      <td class="td-actions text-center">
                        <VBtn
                          icon="ri-delete-bin-line"
                          size="x-small"
                          color="error"
                          variant="text"
                          class="delete-item-btn"
                          @click="removeItem(index)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Estado Vacío -->
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
                  No hay productos o servicios agregados
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  Usa el buscador para agregar ítems o crea un producto temporal o de catálogo.
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          md="4"
        >
          <!-- Observaciones -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden">
            <VCardItem class="py-3 px-4 border-b">
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
                        icon="ri-chat-1-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                        Observaciones del Presupuesto
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Términos, validez y condiciones
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5">
              <VTextarea
                v-model="quote.observations"
                rows="4"
                placeholder="Indique términos, condiciones de garantía, validez de la cotización..."
                variant="outlined"
                density="comfortable"
                hide-details
              />
            </VCardText>
          </VCard>

          <!-- Resumen del Presupuesto -->
          <VCard class="rounded-xl border-light elevation-1 mb-6 overflow-hidden bg-surface">
            <VCardItem class="py-3 px-4 border-b">
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
                        icon="ri-calculator-line"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                        Resumen de Cotización
                      </h3>
                      <p class="text-caption text-medium-emphasis mb-0">
                        Totales y valores calculados
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-4 pa-sm-5">
              <div class="d-flex justify-space-between mb-3 text-body-1">
                <span class="text-medium-emphasis">Subtotal (Sin IVA):</span>
                <span class="font-weight-medium text-grey-darken-4">${{ displaySubtotal.toFixed(2) }}</span>
              </div>

              <div
                v-if="totalDiscount > 0"
                class="d-flex justify-space-between mb-3 text-body-1 text-error"
              >
                <span>Descuento (Sin IVA):</span>
                <span class="font-weight-bold">-${{ displayDiscount.toFixed(2) }}</span>
              </div>

              <div class="d-flex justify-space-between mb-3 text-body-1">
                <span class="text-medium-emphasis">Subtotal Neto (Sin IVA):</span>
                <span class="font-weight-medium text-grey-darken-4">${{ displaySubtotalNeto.toFixed(2) }}</span>
              </div>

              <div class="d-flex justify-space-between mb-3 text-body-1">
                <span class="text-medium-emphasis">IVA (15%):</span>
                <span class="font-weight-medium text-grey-darken-4">${{ taxAmount.toFixed(2) }}</span>
              </div>

              <VDivider class="my-4" />

              <div class="d-flex justify-space-between align-center mb-6">
                <span class="text-h6 font-weight-bold text-grey-darken-4">TOTAL:</span>
                <span class="text-h5 font-weight-black text-primary">${{ total.toFixed(2) }}</span>
              </div>

              <VBtn
                type="submit"
                color="primary"
                variant="elevated"
                prepend-icon="ri-save-3-line"
                :loading="isSubmitting"
                height="42"
                block
                class="rounded-lg text-none font-weight-bold mb-3 elevation-2"
              >
                Guardar Cotización
              </VBtn>

              <VBtn
                color="secondary"
                variant="outlined"
                prepend-icon="ri-close-line"
                height="42"
                block
                class="rounded-lg text-none font-weight-medium"
                @click="cancelAndReturn"
              >
                Cancelar
              </VBtn>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </VForm>

    <!-- Dialogs -->
    <ClientFinalAddDialog
      v-if="isClientFinalDialogVisible"
      v-model:isDialogVisible="isClientFinalDialogVisible"
      @client-added="handleClientAdded"
    />
    <ClientCompanyAddDialog
      v-if="isClientCompanyDialogVisible"
      v-model:isDialogVisible="isClientCompanyDialogVisible"
      @client-added="handleClientAdded"
    />
    <VehicleAddDialog
      v-if="isVehicleDialogVisible"
      v-model:isDialogVisible="isVehicleDialogVisible"
      :client-selected-id="quote.client_id"
      @vehicle-added="handleVehicleAdded"
    />
    <DistributorCatalogSearchDialog
      v-if="isDistributorCatalogDialogVisible"
      v-model:isDialogVisible="isDistributorCatalogDialogVisible"
      @add-item="addDistributorCatalogItem"
    />
    <AddServiceDialog
      v-if="isAddServiceDialogVisible"
      v-model:isDialogVisible="isAddServiceDialogVisible"
      @add-service="addCustomService"
    />

    <!-- Modal de Producto / Ítem Manual -->
    <VDialog
      v-model="isManualProductDialogVisible"
      max-width="540"
      persistent
    >
      <VCard class="rounded-xl overflow-hidden elevation-10">
        <VCardTitle class="pa-4 bg-primary d-flex align-center justify-space-between text-white">
          <div class="d-flex align-center gap-2">
            <VIcon
              icon="ri-file-add-line"
              size="22"
              color="white"
            />
            <span class="font-weight-bold text-subtitle-1 text-white">Agregar Producto Manual a Cotización</span>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            color="white"
            density="compact"
            @click="isManualProductDialogVisible = false"
          />
        </VCardTitle>

        <VCardText class="pa-5">
          <VForm
            ref="manualFormRef"
            @submit.prevent="addManualItem"
          >
            <VRow dense>
              <VCol cols="12">
                <VTextField
                  v-model="manualProduct.description"
                  label="Descripción del Producto o Repuesto *"
                  placeholder="Ej. Batería Bosch 75Ah, Pastillas Especiales..."
                  variant="outlined"
                  density="comfortable"
                  :rules="[v => !!v || 'La descripción es obligatoria']"
                  autofocus
                />
              </VCol>

              <VCol
                cols="12"
                sm="6"
              >
                <VTextField
                  v-model="manualProduct.sku"
                  label="Código / Referencia (Opcional)"
                  placeholder="Ej. BOSCH-75"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>

              <VCol
                cols="12"
                sm="6"
              >
                <VSelect
                  v-model="manualProduct.type"
                  label="Tipo de Ítem"
                  :items="[
                    { title: 'Producto / Repuesto', value: 'product' },
                    { title: 'Servicio / Mano de Obra', value: 'service' }
                  ]"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>

              <VCol
                cols="12"
                sm="4"
              >
                <VTextField
                  v-model.number="manualProduct.quantity"
                  type="number"
                  min="1"
                  label="Cantidad *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[v => (Number(v) > 0) || 'Debe ser mayor a 0']"
                />
              </VCol>

              <VCol
                cols="12"
                sm="4"
              >
                <VTextField
                  v-model.number="manualProduct.price"
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="$"
                  label="PVP Unitario ($) *"
                  placeholder="0.00"
                  variant="outlined"
                  density="comfortable"
                  :rules="[v => (v !== '' && v !== null && Number(v) >= 0) || 'Precio obligatorio']"
                />
              </VCol>

              <VCol
                cols="12"
                sm="4"
              >
                <VTextField
                  v-model.number="manualProduct.discount"
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="$"
                  label="Descuento ($)"
                  placeholder="0.00"
                  variant="outlined"
                  density="comfortable"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 bg-grey-lighten-4 d-flex justify-end gap-2">
          <VBtn
            variant="outlined"
            color="secondary"
            class="rounded-lg px-4"
            @click="isManualProductDialogVisible = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            class="rounded-lg px-6 font-weight-bold"
            @click="addManualItem"
          >
            Agregar Ítem
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

