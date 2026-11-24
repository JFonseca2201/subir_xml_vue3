<script setup>
import { ref, computed, onMounted } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  invoiceSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible'])
const isLoading = ref(false)
const isInvoiceEditDialogVisible = ref(false)
const invoice = ref([])
const searchProduct = ref('') // Variable para el filtro de búsqueda de productos
const categories = ref([]) // Variable para almacenar categorías

const selectedItems = ref([])
const bulkCategory = ref(null)
const isBulkUpdating = ref(false)
const { showNotification } = useGlobalToast()

const formatDate = dateString => {
  if (!dateString) return '-'
  const clean = String(dateString).split('T')[0].split(' ')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`
  }
  const date = new Date(dateString)
  if (!isNaN(date.getTime())) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    
    return `${y}/${m}/${d}`
  }
  
  return dateString
}

const isAllSelected = computed(() => {
  const productItems = filteredItems.value.filter(item => item.item_type === 1)
  if (productItems.length === 0) return false

  return productItems.every(item => selectedItems.value.includes(item.id))
})

const isSomeSelected = computed(() => {
  return selectedItems.value.length > 0
})

const toggleSelectAll = () => {
  const productItems = filteredItems.value.filter(item => item.item_type === 1)
  if (isAllSelected.value) {
    const idsToRemove = productItems.map(item => item.id)

    selectedItems.value = selectedItems.value.filter(id => !idsToRemove.includes(id))
  } else {
    const idsToAdd = productItems.map(item => item.id)

    selectedItems.value = [...new Set([...selectedItems.value, ...idsToAdd])]
  }
}

const updateItemCategory = async item => {
  try {
    isLoading.value = true

    const data = {
      item_type: item.item_type,
      product_categorie_id: item.product_categorie_id,
    }

    const resp = await $api(`invoice-items/${item.id}`, {
      method: 'PUT',
      body: data,
    })

    if (resp.status === 200 || resp.invoiceItem) {
      showNotification('Categoría actualizada con éxito', 'success')


      // Actualizar localmente
      const index = invoice.value.invoice_items.findIndex(i => i.id === item.id)
      if (index !== -1) {
        invoice.value.invoice_items[index] = {
          ...invoice.value.invoice_items[index],
          ...resp.invoiceItem,
        }
      }
    } else {
      showNotification('No se pudo actualizar la categoría', 'error')
    }
  } catch (error) {
    console.error('Error al actualizar categoría inline:', error)
    showNotification('Error al actualizar la categoría del producto', 'error')
  } finally {
    isLoading.value = false
  }
}

const applyBulkCategory = async () => {
  if (!bulkCategory.value || selectedItems.value.length === 0) return

  isBulkUpdating.value = true
  isLoading.value = true
  try {
    const promises = selectedItems.value.map(id => {
      return $api(`invoice-items/${id}`, {
        method: 'PUT',
        body: {
          item_type: 1,
          product_categorie_id: bulkCategory.value,
        },
      })
    })

    await Promise.all(promises)
    showNotification('Categorías actualizadas en lote con éxito', 'success')

    await showItems()
    selectedItems.value = []
    bulkCategory.value = null
  } catch (error) {
    console.error('Error al aplicar categoría en lote:', error)
    showNotification('Error al actualizar las categorías en lote', 'error')
  } finally {
    isBulkUpdating.value = false
    isLoading.value = false
  }
}

// Método para obtener los datos de la factura
const showItems = async () => {
  isLoading.value = true
  try {
    const resp = await $api('invoices/' + props.invoiceSelected.id, {
      method: 'GET',
      onResponseError({ response }) {
        console.log(response)
      },
    })

    console.log(resp)
    invoice.value = resp.data
  } catch (error) {
    console.log(error)
  } finally {
    isLoading.value = false
  }
}

// Computed para filtrar los productos
const filteredItems = computed(() => {
  return invoice.value?.invoice_items?.filter(item => {
    const searchTerm = searchProduct.value.toLowerCase()

    return item.code.toLowerCase().includes(searchTerm) || item.description.toLowerCase().includes(searchTerm)
  }) || []
})

// Computed para filtrar los detalles de gasto general
const filteredExpenseDetails = computed(() => {
  const details = invoice.value?.expense_details || []
  const searchTerm = (searchProduct.value || '').toLowerCase()
  if (!searchTerm) return details

  return details.filter(detail =>
    (detail.description || '').toLowerCase().includes(searchTerm)
    || (detail.category || '').toLowerCase().includes(searchTerm),
  )
})

// Función para obtener el nombre de la categoría
const getCategoryName = (categoryId, itemType) => {
  // Si no es producto comercial
  if (Number(itemType) === 2) {
    return 'Gasto Taller (Sin Stock)'
  }
  if (Number(itemType) === 3) {
    return 'Insumo Taller (Por Envase)'
  }
  if (Number(itemType) !== 1) {
    return 'No aplica'
  }

  // Si es producto pero no tiene categoría
  if (!categoryId) {
    return 'Sin categoría'
  }

  // Buscar categoría por ID
  const category = categories.value.find(cat => cat.id === categoryId)

  return category ? category.title : 'Sin categoría'
}

// Cargar categorías
const loadCategories = async () => {
  try {
    const response = await $api('invoices/config')
    if (response.status === 200) {
      categories.value = response.data || response.categories || []
    }
  } catch (error) {
    console.error('Error al cargar categorías:', error)
  }
}

// Mostrar el dialogo
const dialogVisible = computed({
  get: () => props.isDialogVisible,
  set: val => emit('update:isDialogVisible', val),
})

const onFormReset = () => {
  searchProduct.value = '' // Limpiar el filtro al cerrar el formulario
  selectedItems.value = [] // Limpiar la selección de lote
  bulkCategory.value = null
  dialogVisible.value = false
}

// Truncar texto
const truncate = (text, length = 50) => {
  if (!text) return ''

  return text.length > length ? text.slice(0, length) + '…' : text
}

const invoiceSelected = ref(null)

const editInvoice = EditInvoice => {
  console.log(EditInvoice)
  invoiceSelected.value = EditInvoice
  isInvoiceEditDialogVisible.value = true
}

const addEditInvoiceItem = updatedItem => {
  // Actualizar el item específico en la lista sin recargar toda la factura
  if (updatedItem && invoice.value?.invoice_items) {
    const itemIndex = invoice.value.invoice_items.findIndex(item => item.id === updatedItem.id)
    if (itemIndex !== -1) {
      // Actualizar el item con los nuevos datos
      invoice.value.invoice_items[itemIndex] = {
        ...invoice.value.invoice_items[itemIndex],
        ...updatedItem,
      }
    }
  }

  // También recargar categorías por si hay cambios
  loadCategories()
}


onMounted(() => {
  setTimeout(() => {
    showItems()
    loadCategories()
  }, 50)
})
</script>

<template>
  <VDialog
    v-model="dialogVisible"
    scrollable
    max-width="1020"
    :fullscreen="$vuetify.display.smAndDown"
    transition="dialog-bottom-transition"
  >
    <VCard
      class="invoice-show-dialog-card rounded-xl"
    >
      <!-- 🔄 Overlay global -->
      <VOverlay
        :model-value="isLoading"
        class="align-center justify-center"
        contained
        persistent
      >
        <VProgressCircular
          color="primary"
          indeterminate
          size="56"
        />
      </VOverlay>

      <!-- Header Banner Elegante, Compacto y Proporcionado -->
      <div class="invoice-dialog-header">
        <div class="d-flex align-start justify-space-between w-100 gap-3">
          <!-- Izquierda: Avatar Icono + Título + Subtítulo -->
          <div class="d-flex align-center gap-3 min-w-0">
            <div class="header-avatar-badge">
              <VIcon
                icon="ri-file-text-line"
                size="24"
                color="white"
              />
            </div>
            <div class="min-w-0">
              <div class="d-flex align-center gap-2 flex-wrap">
                <h3 class="text-h6 font-weight-bold text-white mb-0 leading-tight">
                  Detalle de Factura
                </h3>
                <VChip
                  v-if="invoice?.is_expense"
                  size="x-small"
                  color="warning"
                  variant="flat"
                  class="font-weight-bold px-2 text-white"
                >
                  <VIcon
                    icon="ri-receipt-line"
                    size="12"
                    class="me-1"
                  />
                  Gasto General
                </VChip>
              </div>
              <p class="text-caption text-white-70 mb-0 mt-0.5">
                Comprobante registrado y desglose de rubros
              </p>
            </div>
          </div>

          <!-- Botón de Cerrar (X) -->
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            class="header-close-btn"
            @click="onFormReset"
          />
        </div>

        <!-- Metadata Pills (Proveedor, N° Factura, Fecha) -->
        <div class="d-flex flex-wrap align-center gap-2 mt-3">
          <div class="glass-header-pill">
            <VIcon
              icon="ri-store-2-line"
              size="14"
              class="text-white-70 me-1"
            />
            <span><strong class="text-white font-weight-medium">Proveedor:</strong> {{ invoice?.supplier?.name || invoice?.supplier?.trade_name || '-' }}</span>
          </div>

          <div class="glass-header-pill">
            <VIcon
              icon="ri-hashtag"
              size="14"
              class="text-white-70 me-1"
            />
            <span><strong class="text-white font-weight-medium">N° Factura:</strong> {{ invoice?.invoice_number || '-' }}</span>
          </div>

          <div class="glass-header-pill">
            <VIcon
              icon="ri-calendar-line"
              size="14"
              class="text-white-70 me-1"
            />
            <span><strong class="text-white font-weight-medium">Fecha:</strong> {{ formatDate(invoice?.issue_date) }}</span>
          </div>
        </div>
      </div>

      <!-- 📦 CONTENIDO DEL MODAL -->
      <VCardText class="pa-4 pa-sm-5">
        <!-- Barra de Búsqueda y Acciones en Lote -->
        <div class="mb-3">
          <VRow
            align="center"
            dense
          >
            <!-- Campo de búsqueda -->
            <VCol
              cols="12"
              :md="selectedItems.length > 0 ? 5 : 12"
            >
              <VTextField
                v-model="searchProduct"
                placeholder="Buscar por código, SKU o descripción..."
                variant="outlined"
                density="compact"
                clearable
                hide-details
                prepend-inner-icon="ri-search-line"
                color="primary"
                :loading="isLoading"
                class="rounded-lg bg-surface text-body-2"
              />
            </VCol>

            <!-- Acciones en lote cuando hay ítems seleccionados -->
            <VCol
              v-if="selectedItems.length > 0"
              cols="12"
              md="7"
              class="d-flex align-center gap-2 flex-wrap"
            >
              <VChip
                size="small"
                color="primary"
                variant="flat"
                class="font-weight-bold px-3 text-no-wrap"
              >
                <VIcon
                  icon="ri-checkbox-multiple-line"
                  size="14"
                  class="me-1"
                />
                {{ selectedItems.length }} seleccionados
              </VChip>

              <VSelect
                v-model="bulkCategory"
                :items="categories"
                item-title="title"
                item-value="id"
                label="Categoría en lote"
                placeholder="Seleccionar..."
                density="compact"
                variant="outlined"
                hide-details
                color="primary"
                class="flex-grow-1"
                style="min-width: 150px;"
              />

              <VBtn
                color="primary"
                size="small"
                variant="elevated"
                class="font-weight-bold text-none"
                :disabled="!bulkCategory"
                :loading="isBulkUpdating"
                @click="applyBulkCategory"
              >
                Aplicar
              </VBtn>

              <VBtn
                variant="tonal"
                color="secondary"
                size="small"
                class="font-weight-bold text-none"
                @click="selectedItems = []"
              >
                Limpiar
              </VBtn>
            </VCol>
          </VRow>
        </div>
        <div v-if="invoice?.is_expense" class="invoice-table-wrap">
          <VTable
            hover
            class="invoice-table"
          >
            <thead class="bg-grey-lighten-4">
              <tr>
                <th class="text-caption font-weight-bold text-center px-1" style="width: 44px">
                  #
                </th>
                <th class="text-caption font-weight-bold px-3" style="width: 100%; min-width: 280px;">
                  Descripción del Gasto
                </th>
                <th class="text-caption font-weight-bold px-2" style="width: 180px">
                  Categoría
                </th>
                <th class="text-caption font-weight-bold text-end pe-3 text-no-wrap" style="width: 110px">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(expense, index) in filteredExpenseDetails"
                :key="expense.id"
                class="align-middle"
              >
                <td class="text-caption text-medium-emphasis text-center px-1">
                  {{ index + 1 }}
                </td>
                <td class="py-2.5 px-3 text-body-2 font-weight-medium text-high-emphasis">
                  {{ expense.description }}
                </td>
                <td class="py-2.5 px-2">
                  <VChip
                    size="small"
                    color="warning"
                    variant="tonal"
                    class="font-weight-medium"
                  >
                    {{ expense.category }}
                  </VChip>
                </td>
                <td class="text-end pe-3 text-body-2 font-weight-bold text-primary">
                  ${{ Number(expense.total || 0).toFixed(2) }}
                </td>
              </tr>

              <tr v-if="!filteredExpenseDetails.length">
                <td colspan="4" class="text-center text-medium-emphasis py-8">
                  <VIcon size="28" class="mb-2">
                    ri-receipt-line
                  </VIcon>
                  <div>Este comprobante no tiene líneas de gasto registradas</div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>

        <div v-else class="invoice-table-wrap">
          <VTable
            hover
            class="invoice-table"
          >
            <!-- 🧾 CABECERA -->
            <thead class="bg-grey-lighten-4">
              <tr>
                <th
                  v-if="props.invoiceSelected.invoice_process != 1"
                  style="width: 44px"
                  class="px-2 text-center"
                >
                  <VCheckbox
                    :model-value="isAllSelected"
                    :indeterminate="isSomeSelected && !isAllSelected"
                    density="compact"
                    hide-details
                    color="primary"
                    @click.stop="toggleSelectAll"
                  />
                </th>
                <th
                  class="text-caption font-weight-bold text-center px-1"
                  style="width: 44px"
                >
                  #
                </th>
                <th
                  class="text-caption font-weight-bold px-3"
                  style="width: 100%; min-width: 280px;"
                >
                  Producto / Código
                </th>
                <th
                  class="text-caption font-weight-bold px-2"
                  style="width: 160px"
                >
                  Categoría
                </th>
                <th
                  class="text-caption font-weight-bold text-center px-1 text-no-wrap"
                  style="width: 65px"
                >
                  Cant.
                </th>
                <th
                  class="text-caption font-weight-bold text-end px-2 text-no-wrap"
                  style="width: 90px"
                >
                  Precio U.
                </th>
                <th
                  class="text-caption font-weight-bold text-end px-2 text-no-wrap"
                  style="width: 90px"
                >
                  Subtotal
                </th>
                <th
                  class="text-caption font-weight-bold text-end px-2 text-no-wrap"
                  style="width: 75px"
                >
                  Dcto.
                </th>
                <th
                  class="text-caption font-weight-bold text-end pe-3 text-no-wrap"
                  style="width: 90px"
                >
                  Total
                </th>
                <th
                  v-if="props.invoiceSelected.invoice_process != 1"
                  class="text-caption font-weight-bold text-center px-1"
                  style="width: 50px"
                >
                  Editar
                </th>
              </tr>
            </thead>

            <!-- 📦 CUERPO -->
            <tbody>
              <tr
                v-for="(item, index) in filteredItems"
                :key="item.id"
                class="align-middle"
              >
                <td
                  v-if="props.invoiceSelected.invoice_process != 1"
                  class="px-2 text-center"
                >
                  <VCheckbox
                    v-if="item.item_type === 1"
                    v-model="selectedItems"
                    :value="item.id"
                    density="compact"
                    hide-details
                    color="primary"
                    @click.stop
                  />
                </td>
                <td class="text-caption text-medium-emphasis text-center px-1">
                  {{ index + 1 }}
                </td>
                
                <td class="py-2.5 px-3">
                  <div class="d-flex flex-column">
                    <span
                      class="text-body-2 font-weight-medium text-high-emphasis text-wrap"
                      style="line-height: 1.35; word-break: break-word;"
                    >
                      {{ item.description || 'Sin descripción' }}
                    </span>
                    <div class="d-flex align-center gap-1.5 mt-1 flex-wrap">
                      <span class="text-caption text-medium-emphasis">
                        SKU: <strong class="text-high-emphasis">{{ item.code || 'S/N' }}</strong>
                      </span>
                      <VChip
                        size="x-small"
                        :color="Number(item.item_type) === 1 ? 'primary' : (Number(item.item_type) === 3 ? 'warning' : 'info')"
                        variant="tonal"
                        class="font-weight-bold px-1.5"
                        style="height: 18px; font-size: 0.68rem;"
                      >
                        {{ Number(item.item_type) === 1 ? 'Producto Venta' : (Number(item.item_type) === 3 ? 'Insumo Envase' : 'Gasto Taller') }}
                      </VChip>
                    </div>
                  </div>
                </td>

                <td class="py-2 px-2">
                  <VSelect
                    v-if="props.invoiceSelected.invoice_process != 1 && item.item_type === 1"
                    v-model="item.product_categorie_id"
                    :items="categories"
                    item-title="title"
                    item-value="id"
                    density="compact"
                    variant="outlined"
                    hide-details
                    placeholder="Seleccionar..."
                    class="inline-category-select"
                    @update:model-value="updateItemCategory(item)"
                  />
                  <VChip
                    v-else
                    size="small"
                    color="grey-darken-1"
                    variant="tonal"
                    class="font-weight-medium"
                  >
                    {{ getCategoryName(item.product_categorie_id, item.item_type) }}
                  </VChip>
                </td>

                <td class="text-center text-body-2 px-1 font-weight-medium text-no-wrap">
                  {{ item.quantity }}
                </td>

                <td class="text-end text-body-2 px-2 text-no-wrap">
                  ${{ Number(item.unit_price).toFixed(2) }}
                </td>

                <td class="text-end text-body-2 font-weight-medium px-2 text-no-wrap">
                  ${{ Number(item.quantity * item.unit_price).toFixed(2) }}
                </td>

                <td class="text-end text-body-2 text-error px-2 text-no-wrap">
                  ${{ Number(item.discount).toFixed(2) }}
                </td>

                <td class="text-end pe-3 text-body-2 font-weight-bold text-primary text-no-wrap">
                  ${{ Number((item.quantity * item.unit_price) - Number(item.discount)).toFixed(2) }}
                </td>

                <td
                  v-if="props.invoiceSelected.invoice_process != 1"
                  class="text-center px-1"
                >
                  <IconBtn
                    color="primary"
                    @click="editInvoice(item)"
                  >
                    <VIcon
                      icon="ri-pencil-line"
                      size="20"
                    />
                  </IconBtn>
                </td>
              </tr>

              <tr v-if="!invoice?.invoice_items?.length">
                <td
                  colspan="7"
                  class="text-center text-medium-emphasis py-8"
                >
                  <VIcon
                    size="28"
                    class="mb-2"
                  >
                    ri-inbox-line
                  </VIcon>
                  <div>Esta factura no tiene productos registrados</div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>

        <!-- 🔢 INFORMACIÓN DE PAGO Y RESUMEN FINANCIERO -->
        <VRow class="mt-2" dense>
          <!-- 💳 INFORMACIÓN DE PAGO -->
          <VCol
            v-if="invoice?.invoice_process === 1"
            cols="12"
            md="7"
          >
            <VCard variant="flat" class="pa-4 rounded-xl border bg-surface h-100">
              <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-3 d-flex align-center gap-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded-md">
                  <VIcon size="15" icon="ri-bank-card-line" />
                </VAvatar>
                <span>Información de Pago</span>
              </div>

              <!-- Caso Crédito / Cuenta por Pagar -->
              <div
                v-if="invoice.account_payable"
                class="pa-3 rounded-lg border bg-slate-50 mb-2"
              >
                <div class="d-flex align-center justify-space-between mb-2">
                  <span class="text-caption font-weight-medium text-medium-emphasis">Tipo de Pago:</span>
                  <VChip
                    color="primary"
                    size="x-small"
                    variant="tonal"
                    class="font-weight-bold"
                  >
                    Crédito (Cuenta por Pagar)
                  </VChip>
                </div>
                <div class="d-flex align-center justify-space-between mb-1.5 text-body-2">
                  <span class="text-medium-emphasis">Monto Total:</span>
                  <span class="font-weight-bold text-high-emphasis">${{ Number(invoice.account_payable.total_amount).toFixed(2) }}</span>
                </div>
                <div class="d-flex align-center justify-space-between mb-1.5 text-body-2">
                  <span class="text-medium-emphasis">Fecha de Vencimiento:</span>
                  <span class="font-weight-bold text-high-emphasis">
                    {{ invoice.account_payable.due_date ? new Date(invoice.account_payable.due_date).toISOString().slice(0, 10) : '-' }}
                  </span>
                </div>
                <div class="d-flex align-center justify-space-between">
                  <span class="text-medium-emphasis text-body-2">Estado:</span>
                  <VChip
                    :color="invoice.account_payable.status === 'paid' ? 'success' : 'warning'"
                    size="x-small"
                    class="font-weight-bold"
                  >
                    {{ invoice.account_payable.status === 'paid' ? 'Pagado' : 'Pendiente' }}
                  </VChip>
                </div>
              </div>

              <!-- Caso Contado / Aporte / Distribución de Pagos -->
              <div v-else-if="invoice.finance_records && invoice.finance_records.length > 0">
                <div
                  v-for="record in invoice.finance_records"
                  :key="record.id"
                  class="mb-2 pa-3 rounded-lg border bg-slate-50"
                >
                  <div class="text-caption text-medium-emphasis font-weight-bold mb-1.5">
                    Registro de Egreso #{{ record.id }} ({{ formatDate(record.entry_date) }})
                  </div>

                  <div v-if="record.payment_distributions && record.payment_distributions.length > 0">
                    <div
                      v-for="dist in record.payment_distributions"
                      :key="dist.id"
                      class="d-flex align-center justify-space-between py-1.5 border-b text-none"
                    >
                      <div class="d-flex align-center gap-2">
                        <VIcon
                          size="18"
                          :color="(dist.payment_method === 'cash' || dist.account?.type === 'cash') ? 'success' : 'primary'"
                        >
                          {{ (dist.payment_method === 'cash' || dist.account?.type === 'cash') ? 'ri-money-dollar-circle-line' : 'ri-bank-card-line' }}
                        </VIcon>
                        <div>
                          <div class="text-body-2 font-weight-bold text-high-emphasis">
                            {{ dist.account?.name || 'Cuenta del sistema' }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{ (dist.payment_method === 'cash' || dist.account?.type === 'cash') ? 'Efectivo' : 'Transferencia' }}
                          </div>
                        </div>
                      </div>
                      <span class="text-body-2 font-weight-bold text-success">
                        ${{ Number(dist.amount).toFixed(2) }}
                      </span>
                    </div>
                  </div>
                  <div
                    v-else
                    class="d-flex align-center justify-space-between py-1.5 text-none"
                  >
                    <div class="d-flex align-center gap-2">
                      <VIcon
                        size="18"
                        color="success"
                      >
                        ri-money-dollar-circle-line
                      </VIcon>
                      <div>
                        <div class="text-body-2 font-weight-bold text-high-emphasis">
                          {{ record.account_label || 'Caja Chica' }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {{ record.payment_method_label || 'Efectivo' }}
                        </div>
                      </div>
                    </div>
                    <span class="text-body-2 font-weight-bold text-success">
                      ${{ Number(record.amount).toFixed(2) }}
                    </span>
                  </div>
                </div>
              </div>

              <div
                v-else
                class="text-caption text-medium-emphasis pa-4 text-center border rounded-lg bg-slate-50"
              >
                No hay registros de pago asociados a esta factura.
              </div>
            </VCard>
          </VCol>

          <!-- Caso Pendiente de Procesar -->
          <VCol
            v-else
            cols="12"
            md="7"
          >
            <div class="h-100 d-flex align-center justify-center bg-surface rounded-xl border pa-6 text-center">
              <div>
                <VIcon
                  size="36"
                  color="warning"
                  class="mb-2"
                >
                  ri-error-warning-line
                </VIcon>
                <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
                  Factura Pendiente de Procesar
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                  Esta factura aún no ha sido procesada en inventario ni caja chica.
                </div>
              </div>
            </div>
          </VCol>

          <!-- 🔢 TOTALES DE LA FACTURA -->
          <VCol
            cols="12"
            md="5"
          >
            <VCard
              variant="flat"
              class="pa-4 rounded-xl border bg-slate-50 h-100 d-flex flex-column justify-space-between"
            >
              <div>
                <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-3 d-flex align-center gap-2">
                  <VAvatar size="26" color="primary" variant="tonal" class="rounded-md">
                    <VIcon
                      icon="ri-calculator-line"
                      size="15"
                    />
                  </VAvatar>
                  <span>Resumen Financiero</span>
                </div>

                <div class="d-flex justify-space-between mb-1.5 text-body-2">
                  <span class="text-medium-emphasis">Total Bruto:</span>
                  <span class="font-weight-medium text-high-emphasis">
                    ${{ Number(Number(invoice.subtotal) + Number(invoice.discount)).toFixed(2) }}
                  </span>
                </div>
                <div class="d-flex justify-space-between mb-1.5 text-body-2">
                  <span class="text-medium-emphasis">Descuento:</span>
                  <span class="font-weight-medium text-error">
                    -${{ Number(invoice.discount).toFixed(2) }}
                  </span>
                </div>
                <div class="d-flex justify-space-between mb-1.5 text-body-2">
                  <span class="text-medium-emphasis">Subtotal Neto:</span>
                  <span class="font-weight-medium text-high-emphasis">
                    ${{ Number(invoice.subtotal).toFixed(2) }}
                  </span>
                </div>
                <div class="d-flex justify-space-between mb-1.5 text-body-2">
                  <span class="text-medium-emphasis">IVA (15%):</span>
                  <span class="font-weight-medium text-high-emphasis">
                    ${{ Number(invoice.tax).toFixed(2) }}
                  </span>
                </div>
              </div>

              <div>
                <VDivider class="my-2.5" />
                <div class="d-flex justify-space-between align-center">
                  <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
                    TOTAL FINAL:
                  </span>
                  <span class="text-h6 font-weight-black text-primary">
                    ${{ Number(invoice.total).toFixed(2) }}
                  </span>
                </div>
              </div>
            </VCard>
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <!-- 🔘 FOOTER -->
      <VCardActions
        class="d-flex justify-end align-center gap-3 pa-4 bg-surface"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium text-none"
          height="38"
          @click="onFormReset"
        >
          Cerrar
        </VBtn>
      </VCardActions>
      <InvoiceEditDialog
        v-if="isInvoiceEditDialogVisible"
        v-model:isDialogVisible="isInvoiceEditDialogVisible"
        :invoice-selected="invoiceSelected"
        @edit-invoice-item="addEditInvoiceItem"
      />
    </VCard>
  </VDialog>
</template>

<style lang="scss" scoped>
.invoice-show-dialog-card {
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.invoice-dialog-header {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: #ffffff;
  padding: 1.25rem 1.5rem;
  position: relative;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.2);

  .header-avatar-badge {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-close-btn {
    color: #ffffff !important;
    background: rgba(255, 255, 255, 0.18) !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
    border-radius: 8px !important;
    transition: all 0.2s ease !important;

    &:hover {
      background: rgba(255, 255, 255, 0.3) !important;
      transform: scale(1.05);
    }
  }

  .glass-header-pill {
    display: inline-flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 9999px;
    padding: 3px 10px;
    font-size: 0.75rem;
    color: #ffffff;
  }

  .text-white-70 {
    color: rgba(255, 255, 255, 0.78) !important;
  }
}

.bg-slate-50 {
  background-color: #f8fafc !important;
}

.invoice-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.invoice-table {
  thead th {
    background-color: #f8fafc !important;
    color: #475569 !important;
    font-size: 0.75rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.3px !important;
    height: 38px !important;
    white-space: nowrap !important;
  }

  tbody td {
    font-size: 0.82rem !important;
  }
}
</style>
