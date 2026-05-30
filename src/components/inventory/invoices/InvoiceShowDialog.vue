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

const updateItemCategory = async (item) => {
  try {
    isLoading.value = true
    const data = {
      item_type: item.item_type,
      product_categorie_id: item.product_categorie_id
    }
    const resp = await $api(`invoice-items/${item.id}`, {
      method: 'PUT',
      body: data
    })
    
    if (resp.status === 200 || resp.invoiceItem) {
      showNotification('Categoría actualizada con éxito', 'success')
      // Actualizar localmente
      const index = invoice.value.invoice_items.findIndex(i => i.id === item.id)
      if (index !== -1) {
        invoice.value.invoice_items[index] = {
          ...invoice.value.invoice_items[index],
          ...resp.invoiceItem
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
          product_categorie_id: bulkCategory.value
        }
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
    max-width="1200"
    transition="dialog-bottom-transition"
  >
    <VCard
      class="rounded-xl"
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
      <div
        class="invoice-header"
        style="position: sticky; top: 0; z-index: 10; background: white;"
      >
        <!-- 🔷 FILA SUPERIOR: TÍTULO + ACCIÓN -->
        <VCardText class="pb-2">
          <VRow
            align="center"
            justify="space-between"
          >
            <VCol
              cols="12"
              md="8"
            >
              <div class="d-flex align-center gap-4">
                <VAvatar
                  color="primary"
                  variant="tonal"
                  size="48"
                >
                  <VIcon size="26">
                    ri-receipt-3-line
                  </VIcon>
                </VAvatar>

                <div>
                  <h3 class="text-h5 font-weight-bold mb-1">
                    Detalle de Factura
                  </h3>
                  <span class="text-medium-emphasis">
                    Vista completa de la factura registrada
                  </span>
                </div>
              </div>
            </VCol>

            <VCol
              cols="12"
              md="4"
              class="d-flex justify-end"
            >
              <VBtn
                icon
                variant="text"
                color="grey"
                @click="onFormReset"
              >
                <VIcon size="22">
                  ri-close-line
                </VIcon>
              </VBtn>
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />

        <!-- 🔷 FILA INFERIOR: INFO DE FACTURA -->
        <VCardText class="pt-4 pb-3">
          <VRow>
            <!-- 🏪 Proveedor -->
            <VCol
              cols="12"
              md="4"
            >
              <div class="d-flex align-center gap-2 mb-1">
                <VIcon
                  size="18"
                  class="text-primary"
                >
                  ri-store-2-line
                </VIcon>
                <span class="font-weight-medium">
                  Proveedor
                </span>
              </div>
              <div class="text-medium-emphasis">
                <small>{{ invoice?.supplier?.name || '-' }}</small>
              </div>
            </VCol>

            <!-- 📄 Número de factura -->
            <VCol
              cols="12"
              md="4"
            >
              <div class="d-flex align-center gap-2 mb-1">
                <VIcon
                  size="18"
                  class="text-primary"
                >
                  ri-file-text-line
                </VIcon>
                <span class="font-weight-medium">
                  N° Factura
                </span>
              </div>
              <div class="text-medium-emphasis">
                <small>{{ invoice?.invoice_number || '-' }}</small>
              </div>
            </VCol>

            <!-- 📅 Fecha -->
            <VCol
              cols="12"
              md="4"
            >
              <div class="d-flex align-center gap-2 mb-1">
                <VIcon
                  size="18"
                  class="text-primary"
                >
                  ri-calendar-line
                </VIcon>
                <span class="font-weight-medium">
                  Fecha
                </span>
              </div>
              <div class="text-medium-emphasis">
                <small>
                  {{
                    invoice?.issue_date
                      ? new Date(invoice.issue_date)
                        .toISOString()
                        .slice(0, 10)
                      : '-'
                  }}
                </small>
              </div>
            </VCol>
          </VRow>
        </VCardText>

        <VDivider />
        <VRow
          class="mb-4 my-2 align-center px-4"
          style="position: sticky; top: 0;"
        >
          <VCol
            cols="12"
            md="4"
          >
            <VTextField
              v-model="searchProduct"
              label="Buscar producto"
              variant="outlined"
              clearable
              hide-details
              prepend-inner-icon="ri-search-line"
            />
          </VCol>
          
          <!-- Banner de Acciones en Lote -->
          <VCol
            v-if="selectedItems.length > 0"
            cols="12"
            md="8"
            class="d-flex align-center gap-3 bg-blue-lighten-5 border border-blue-lighten-3 rounded-lg py-2 px-4 animate-fade-in"
          >
            <div class="text-caption font-weight-black text-info-darken-3 text-no-wrap">
              <VIcon icon="ri-checkbox-multiple-line" class="mr-1" color="info" />
              {{ selectedItems.length }} SELECCIONADOS
            </div>
            
            <VSelect
              v-model="bulkCategory"
              :items="categories"
              item-title="title"
              item-value="id"
              label="Categoría en lote"
              placeholder="Asignar a todos..."
              density="compact"
              variant="outlined"
              hide-details
              class="flex-grow-1"
              bg-color="white"
              style="max-width: 250px; font-size: 0.8rem;"
            />
            
            <VBtn
              color="info"
              size="small"
              :disabled="!bulkCategory"
              :loading="isBulkUpdating"
              @click="applyBulkCategory"
            >
              Aplicar
            </VBtn>
            
            <VBtn
              variant="text"
              color="secondary"
              size="small"
              @click="selectedItems = []"
            >
              Limpiar
            </VBtn>
          </VCol>
        </VRow>
      </div>

      <!-- 📦 PRODUCTOS -->
      <VCardText class="pa-0 mt-1">
        <!-- Filtro de búsqueda -->


        <VTable
          hover
          class="invoice-table"
        >
          <!-- 🧾 CABECERA -->
          <thead class="bg-primary text-white sticky-header">
            <tr>
              <th style="width: 55px" v-if="props.invoiceSelected.invoice_process != 1">
                <VCheckbox
                  :model-value="isAllSelected"
                  :indeterminate="isSomeSelected && !isAllSelected"
                  density="compact"
                  hide-details
                  @click.stop="toggleSelectAll"
                />
              </th>
              <th style="width: 50px">
                #
              </th>
              <th style="width: 150px">
                Código
              </th>
              <th style="width: 450px">
                <VIcon
                  size="16"
                  class="mr-1"
                >
                  ri-box-3-line
                </VIcon>
                Producto
              </th>
              <th style="width: 200px">
                <VIcon
                  size="16"
                  class="mr-1"
                >
                  ri-folder-line
                </VIcon>
                Categoría
              </th>
              <th class="text-right">
                <VIcon
                  size="16"
                  class="mr-1"
                >
                  ri-stack-line
                </VIcon>
                Cant.
              </th>
              <th class="text-right">
                <VIcon
                  size="16"
                  class="mr-1"
                >
                  ri-money-dollar-circle-line
                </VIcon>
                Precio
              </th>
              <th class="text-right">
                <VIcon
                  size="16"
                  class="mr-1"
                >
                  ri-calculator-line
                </VIcon>
                Subtotal
              </th>
              <th class="text-right">
                <VIcon
                  size="16"
                  class="mr-1"
                >
                  ri-percent-line
                </VIcon>
                Dcto.
              </th>
              <th class="text-right">
                <VIcon
                  size="16"
                  class="mr-1"
                >
                  ri-money-dollar-circle-line
                </VIcon>
                Total
              </th>

              <th v-if="props.invoiceSelected.invoice_process != 1" class="text-right">
                <VIcon
                  size="16"
                  class="mr-1"
                >
                  ri-settings-2-line
                </VIcon>
                Editar
              </th>
            </tr>
          </thead>

          <!-- 📦 CUERPO -->
          <tbody>
            <tr
              v-for="(item, index) in filteredItems"
              :key="item.id"
            >
              <td v-if="props.invoiceSelected.invoice_process != 1">
                <VCheckbox
                  v-if="item.item_type === 1"
                  v-model="selectedItems"
                  :value="item.id"
                  density="compact"
                  hide-details
                  @click.stop
                />
              </td>
              <td><small>{{ index + 1 }}</small></td>
              <td class="font-weight-medium">
                <VTooltip
                  location="top"
                  open-on-hover
                >
                  <template #activator="{ props: tooltipProps }">
                    <small
                      class="text-medium-emphasis"
                      v-bind="tooltipProps"
                    >
                      {{ truncate(item.code, 20) }}
                    </small>
                  </template>
                  <span>{{ item.code }}</span> <!-- hora: HH:MM:SS -->
                </VTooltip>
              </td>
              <td class=" text-medium-emphasis">
                <small>{{ (item.description) }}</small>
              </td>

              <td>
                <VSelect
                  v-if="props.invoiceSelected.invoice_process != 1 && item.item_type === 1"
                  v-model="item.product_categorie_id"
                  :items="categories"
                  item-title="title"
                  item-value="id"
                  density="compact"
                  variant="underlined"
                  hide-details
                  placeholder="Seleccionar..."
                  class="inline-category-select"
                  @update:model-value="updateItemCategory(item)"
                />
                <span v-else class="text-caption text-medium-emphasis">
                  {{ getCategoryName(item.product_categorie_id, item.item_type) }}
                </span>
              </td>

              <td class="text-right">
                <small>{{ item.quantity }}</small>
              </td>

              <td class="text-right">
                <small>${{ Number(item.unit_price).toFixed(2) }}</small>
              </td>

              <td class="text-right font-weight-bold">
                <small>${{ Number(item.quantity * item.unit_price).toFixed(2) }}</small>
              </td>

              <td class="text-right text-error">
                <small>${{ Number(item.discount).toFixed(2) }}</small>
              </td>

              <td class="text-right font-weight-bold text-primary">
                <small>${{ Number((item.quantity * item.unit_price) - Number(item.discount)).toFixed(2)
                }}</small>
              </td>

              <td v-if="props.invoiceSelected.invoice_process != 1" class="text-right font-weight-bold text-primary">
                <IconBtn @click="editInvoice(item)">
                  <VIcon icon="ri-pencil-line" />
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
      </VCardText>

      <VDivider />

      <!-- 🔢 TOTALES -->
      <VCardText class="pt-6">
        <VRow justify="end">
          <VCol
            cols="12"
            md="4"
          >
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">
                Total
              </span>
              <span class="font-weight-medium">
                ${{ Number(Number(invoice.subtotal) + Number(invoice.discount)).toFixed(2) }}
              </span>
            </div>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">
                Descuento
              </span>
              <span class="font-weight-medium">
                ${{ Number(invoice.discount).toFixed(2) }}
              </span>
            </div>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">
                Subtotal
              </span>
              <span class="font-weight-medium">
                ${{ Number(invoice.subtotal).toFixed(2) }}
              </span>
            </div>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">
                IVA (15%)
              </span>
              <span class="font-weight-medium">
                ${{ Number(invoice.tax).toFixed(2) }}
              </span>
            </div>

            <VDivider class="my-2" />

            <div class="d-flex justify-space-between text-h6">
              <span class="font-weight-bold">
                Total Final
              </span>
              <span class="font-weight-bold text-primary">
                ${{ Number(invoice.total).toFixed(2) }}
              </span>
            </div>
          </VCol>
        </VRow>
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

<style scoped>
.inline-category-select :deep(.v-field__input) {
  font-size: 0.75rem !important;
  padding-top: 0 !important;
  padding-bottom: 2px !important;
  min-height: unset !important;
}
.inline-category-select :deep(.v-field) {
  --v-input-control-height: 24px;
}
.animate-fade-in {
  animation: fadeIn 0.25s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
<!-- @editInvoiceItem="addEditInvoiceItem" -->