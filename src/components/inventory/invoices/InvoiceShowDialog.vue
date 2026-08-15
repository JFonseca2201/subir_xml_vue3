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

// Función para obtener el nombre de la categoría
const getCategoryName = (categoryId, itemType) => {
  // Si no es producto, mostrar mensaje específico
  if (itemType !== 1) {
    return 'No tiene categoría de producto'
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
    max-width="1400"
    transition="dialog-bottom-transition"
  >
    <VCard
      class="custom-dialog-card rounded-xl"
      style="text-transform: uppercase;"
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
          size="64"
        />
      </VOverlay>

      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="onFormReset"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-file-text-line" size="32" class="text-white" />
        </div>
        <h3 class="custom-dialog-title">
          Detalle de Factura
        </h3>
        <p class="custom-dialog-subtitle mb-2">
          Vista completa de la factura registrada
        </p>

        <!-- Metadata Pills en la Cabecera -->
        <div class="d-flex flex-wrap justify-center gap-3 mt-2 mb-3">
          <div class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium" style="background: rgba(255, 255, 255, 0.18); color: #ffffff;">
            <VIcon icon="ri-store-2-line" size="14" class="me-1" />
            <span><strong>Proveedor:</strong> {{ invoice?.supplier?.name || invoice?.supplier?.trade_name || '-' }}</span>
          </div>

          <div class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium" style="background: rgba(255, 255, 255, 0.18); color: #ffffff;">
            <VIcon icon="ri-file-text-line" size="14" class="me-1" />
            <span><strong>N° Factura:</strong> {{ invoice?.invoice_number || '-' }}</span>
          </div>

          <div class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium" style="background: rgba(255, 255, 255, 0.18); color: #ffffff;">
            <VIcon icon="ri-calendar-line" size="14" class="me-1" />
            <span><strong>Fecha:</strong> {{ invoice?.issue_date ? new Date(invoice.issue_date).toISOString().slice(0, 10) : '-' }}</span>
          </div>
        </div>

        <!-- Buscador y Acciones Fijos en Cabecera (Tarjeta Blanca de Alto Contraste) -->
        <div class="px-md-4 px-2 pt-2">
          <div
            class="rounded-xl pa-3 shadow-md border"
            style="background-color: #ffffff !important; color: #1e1b4b !important; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);"
          >
            <VRow align="center" dense>
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
                  style="background-color: #f8fafc;"
                  class="rounded-lg text-body-2"
                />
              </VCol>

              <!-- Acciones en lote cuando hay ítems seleccionados -->
              <VCol
                v-if="selectedItems.length > 0"
                cols="12"
                md="7"
                class="d-flex align-center gap-2"
              >
                <VChip
                  size="small"
                  color="primary"
                  variant="flat"
                  class="font-weight-bold px-3 text-no-wrap"
                >
                  <VIcon icon="ri-checkbox-multiple-line" size="14" class="me-1" />
                  {{ selectedItems.length }} SELECCIONADOS
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
                  style="background-color: #ffffff; min-width: 160px;"
                />

                <VBtn
                  color="primary"
                  size="small"
                  variant="elevated"
                  class="font-weight-bold"
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
                  class="font-weight-bold"
                  @click="selectedItems = []"
                >
                  Limpiar
                </VBtn>
              </VCol>
            </VRow>
          </div>
        </div>
      </div>

      <!-- 📦 CONTENIDO DEL MODAL (TABLA Y FOOTER) -->
      <VCardText class="pa-6">
        <div class="invoice-table-wrap">
          <VTable
            hover
            class="invoice-table"
          >
            <!-- 🧾 CABECERA -->
            <thead class="bg-grey-lighten-4">
              <tr>
                <th
                  v-if="props.invoiceSelected.invoice_process != 1"
                  style="width: 50px"
                  class="px-4"
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
                  class="text-uppercase text-caption font-weight-bold"
                  style="width: 50px"
                >
                  #
                </th>
                <th class="text-uppercase text-caption font-weight-bold">
                  Producto / Código
                </th>
                <th
                  class="text-uppercase text-caption font-weight-bold"
                  style="width: 220px"
                >
                  Categoría
                </th>
                <th
                  class="text-uppercase text-caption font-weight-bold text-center"
                  style="width: 90px"
                >
                  Cant.
                </th>
                <th
                  class="text-uppercase text-caption font-weight-bold text-end"
                  style="width: 110px"
                >
                  Precio U.
                </th>
                <th
                  class="text-uppercase text-caption font-weight-bold text-end"
                  style="width: 110px"
                >
                  Subtotal
                </th>
                <th
                  class="text-uppercase text-caption font-weight-bold text-end"
                  style="width: 90px"
                >
                  Dcto.
                </th>
                <th
                  class="text-uppercase text-caption font-weight-bold text-end"
                  style="width: 110px"
                >
                  Total
                </th>
                <th
                  v-if="props.invoiceSelected.invoice_process != 1"
                  class="text-uppercase text-caption font-weight-bold text-center"
                  style="width: 80px"
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
                  class="px-4"
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
                <td class="text-caption text-medium-emphasis">
                  {{ index + 1 }}
                </td>
                
                <td class="py-2">
                  <div class="d-flex flex-column">
                    <span
                      class="text-body-2 font-weight-medium text-high-emphasis text-wrap"
                      style="max-width: 350px;"
                    >
                      {{ item.description || 'Sin descripción' }}
                    </span>
                    <span class="text-caption text-medium-emphasis mt-1">
                      SKU: {{ item.code }}
                    </span>
                  </div>
                </td>

                <td class="py-2">
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

                <td class="text-center text-body-2">
                  {{ item.quantity }}
                </td>

                <td class="text-end text-body-2">
                  ${{ Number(item.unit_price).toFixed(2) }}
                </td>

                <td class="text-end text-body-2 font-weight-medium">
                  ${{ Number(item.quantity * item.unit_price).toFixed(2) }}
                </td>

                <td class="text-end text-body-2 text-error">
                  ${{ Number(item.discount).toFixed(2) }}
                </td>

                <td class="text-end text-body-2 font-weight-bold text-primary">
                  ${{ Number((item.quantity * item.unit_price) - Number(item.discount)).toFixed(2) }}
                </td>

                <td
                  v-if="props.invoiceSelected.invoice_process != 1"
                  class="text-center"
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
      </VCardText>

      <VDivider />

      <!-- 🔢 TOTALES -->
      <VCardText class="pt-6">
        <!-- 💳 PANEL DE RESUMEN Y PAGO -->
        <VCard variant="flat" class="bg-grey-lighten-5 border rounded-xl pa-5 mt-6">
          <VRow>
            <!-- 💳 INFORMACIÓN DE PAGO -->
            <VCol
              v-if="invoice?.invoice_process === 1"
              cols="12"
              md="7"
            >
              <div class="pe-md-4">
                <h4 class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center gap-2 text-primary">
                  <VIcon size="20" icon="ri-bank-card-line" />
                  Información de Pago
                </h4>

                <!-- Caso Crédito / Cuenta por Pagar -->
                <div
                  v-if="invoice.account_payable"
                  class="pa-4 rounded-lg border bg-white shadow-sm mb-3"
                >
                  <div class="d-flex align-center justify-space-between mb-2">
                    <span class="text-body-2 font-weight-bold text-grey-darken-2">Tipo de Pago:</span>
                    <VChip
                      color="primary"
                      size="small"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      Crédito (Cuenta por Pagar)
                    </VChip>
                  </div>
                  <div class="d-flex align-center justify-space-between mb-2">
                    <span class="text-body-2 text-medium-emphasis">Monto Total:</span>
                    <span class="text-body-2 font-weight-bold">${{ Number(invoice.account_payable.total_amount).toFixed(2) }}</span>
                  </div>
                  <div class="d-flex align-center justify-space-between mb-2">
                    <span class="text-body-2 text-medium-emphasis">Fecha de Vencimiento:</span>
                    <span class="text-body-2 font-weight-bold">
                      {{ invoice.account_payable.due_date ? new Date(invoice.account_payable.due_date).toISOString().slice(0, 10) : '-' }}
                    </span>
                  </div>
                  <div class="d-flex align-center justify-space-between">
                    <span class="text-body-2 text-medium-emphasis">Estado:</span>
                    <VChip
                      :color="invoice.account_payable.status === 'paid' ? 'success' : 'warning'"
                      size="small"
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
                    class="mb-3 pa-4 rounded-lg border bg-white shadow-sm"
                  >
                    <div class="text-caption text-medium-emphasis font-weight-bold mb-2">
                      Registro de Egreso #{{ record.id }} ({{ record.entry_date ? new Date(record.entry_date).toISOString().slice(0, 10) : '-' }})
                    </div>

                    <div v-if="record.payment_distributions && record.payment_distributions.length > 0">
                      <div
                        v-for="dist in record.payment_distributions"
                        :key="dist.id"
                        class="d-flex align-center justify-space-between border-bottom py-2 text-none"
                      >
                        <div class="d-flex align-center gap-2">
                          <VIcon
                            size="18"
                            :color="dist.payment_method === 'cash' ? 'success' : 'primary'"
                          >
                            {{ dist.payment_method === 'cash' ? 'ri-money-dollar-circle-line' : 'ri-bank-card-line' }}
                          </VIcon>
                          <div>
                            <div class="text-body-2 font-weight-bold text-none" style="text-transform: none;">
                              {{ dist.account?.name || 'Cuenta del sistema' }}
                            </div>
                            <div class="text-caption text-grey text-none" style="text-transform: none;">
                              {{ dist.payment_method === 'cash' ? 'Efectivo' : 'Transferencia' }}
                            </div>
                          </div>
                        </div>
                        <span class="text-body-1 font-weight-bold text-success">
                          ${{ Number(dist.amount).toFixed(2) }}
                        </span>
                      </div>
                    </div>
                    <div
                      v-else
                      class="d-flex align-center justify-space-between py-2 text-none"
                    >
                      <div class="d-flex align-center gap-2">
                        <VIcon size="18" color="success">
                          ri-money-dollar-circle-line
                        </VIcon>
                        <div>
                          <div class="text-body-2 font-weight-bold text-none" style="text-transform: none;">
                            {{ record.account_label || 'Caja Chica' }}
                          </div>
                          <div class="text-caption text-grey text-none" style="text-transform: none;">
                            {{ record.payment_method_label || 'Efectivo' }}
                          </div>
                        </div>
                      </div>
                      <span class="text-body-1 font-weight-bold text-success">
                        ${{ Number(record.amount).toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  v-else
                  class="text-caption text-medium-emphasis pa-4 text-center border rounded-lg bg-white"
                >
                  No hay registros de pago asociados a esta factura.
                </div>
              </div>
            </VCol>

            <!-- Caso Pendiente de Procesar -->
            <VCol
              v-else
              cols="12"
              md="7"
            >
              <div class="pe-md-4 h-100 d-flex align-center justify-center bg-white rounded-lg border pa-6 text-center">
                <div>
                  <VIcon
                    size="36"
                    color="warning"
                    class="mb-2"
                  >
                    ri-error-warning-line
                  </VIcon>
                  <div class="text-subtitle-1 font-weight-bold text-grey-darken-3">
                    Factura Pendiente de Procesar
                  </div>
                  <div class="text-caption text-medium-emphasis">
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
              <VCard variant="flat" color="purple-lighten-5" class="pa-4 rounded-lg border border-purple-lighten-4">
                <div class="text-subtitle-2 font-weight-bold text-grey-darken-3 mb-3 d-flex align-center gap-2">
                  <VIcon icon="ri-calculator-line" size="18" color="primary" />
                  <span>Resumen Financiero</span>
                </div>

                <div class="d-flex justify-space-between mb-2 text-body-2">
                  <span class="text-medium-emphasis">Total Bruto:</span>
                  <span class="font-weight-medium text-grey-darken-3">
                    ${{ Number(Number(invoice.subtotal) + Number(invoice.discount)).toFixed(2) }}
                  </span>
                </div>
                <div class="d-flex justify-space-between mb-2 text-body-2">
                  <span class="text-medium-emphasis">Descuento:</span>
                  <span class="font-weight-medium text-error">
                    -${{ Number(invoice.discount).toFixed(2) }}
                  </span>
                </div>
                <div class="d-flex justify-space-between mb-2 text-body-2">
                  <span class="text-medium-emphasis">Subtotal Neto:</span>
                  <span class="font-weight-medium text-grey-darken-3">
                    ${{ Number(invoice.subtotal).toFixed(2) }}
                  </span>
                </div>
                <div class="d-flex justify-space-between mb-2 text-body-2">
                  <span class="text-medium-emphasis">IVA (15%):</span>
                  <span class="font-weight-medium text-grey-darken-3">
                    ${{ Number(invoice.tax).toFixed(2) }}
                  </span>
                </div>

                <VDivider class="my-3 border-purple-lighten-3" />

                <div class="d-flex justify-space-between align-center">
                  <span class="text-subtitle-1 font-weight-bold text-grey-darken-4">
                    TOTAL FINAL:
                  </span>
                  <span class="text-h5 font-weight-black text-primary">
                    ${{ Number(invoice.total).toFixed(2) }}
                  </span>
                </div>
              </VCard>
            </VCol>
          </VRow>
        </VCard>
      </VCardText>

      <VDivider />

      <!-- 🔘 FOOTER -->
      <VCardActions class="justify-end pa-4">
        <VBtn
          color="primary"
          variant="tonal"
          prepend-icon="ri-close-circle-line"
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


<!-- @editInvoiceItem="addEditInvoiceItem" -->
