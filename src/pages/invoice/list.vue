<script setup>
import { ref, onMounted } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const invoiceSelected = ref(null)
const currentPage = ref(1)
const totalPage = ref(0)
const perPage = ref(10)
const totalItems = ref(0)

const { showNotification } = useGlobalToast()

const list_invoices = ref([])
const supplier_id = ref(null)
const from_date = ref(null)
const to_date = ref(null)
const range_date = ref(null)
const search = ref(null)
const type = ref(1)


const isLoading = ref(false)

const isInvoiceAddDialogVisible = ref(false)
const isInvoiceShowDialogVisible = ref(false)
const isInvoiceDeleteDialogVisible = ref(false)
const isInvoiceProcessDialogVisible = ref(false)
const invoiceToProcess = ref(null)
import InvoiceDeleteDialog from '@/components/inventory/invoices/InvoiceDeleteDialog.vue'
import InvoiceProcessDialog from '@/components/inventory/invoices/InvoiceProcessDialog.vue'

const list = async () => {
  isLoading.value = true

  try {
    let data = {
      type: type.value,
      search: search.value || '',
      start_date: range_date.value ? range_date.value.split("to")[0] : "",
      end_date: range_date.value ? range_date.value.split("to")[1] : "",
      supplier_id: supplier_id.value || null,
      per_page: 10, // Items por página
    }

    console.log('📋 Datos de búsqueda:', data)

    const resp = await $api("invoices/index?page=" + currentPage.value, {
      method: "POST",
      body: data,
      onResponseError({ response }) {
        showNotification('Error al cargar las facturas', 'error')
      },
    })

    console.log('📊 Respuesta del servidor:', resp)

    // Actualizar datos según el response del backend
    list_invoices.value = resp.invoices.data  // Acceder al array data dentro de invoices
    totalPage.value = resp.total_pages
    totalItems.value = resp.total
    perPage.value = resp.per_page

    // Validar página actual
    if (currentPage.value > totalPage.value && totalPage.value > 0) {
      currentPage.value = 1
      list() // Recargar con la primera página
    }

    showNotification('Facturas cargadas correctamente', 'success')
  } catch (error) {
    console.error('❌ Error al cargar facturas:', error)
    showNotification('Error al cargar las facturas', 'error')
  } finally {
    isLoading.value = false
  }
}

const providers = ref([])

const config = async () => {
  try {
    const resp = await $api("invoices/config", {
      method: "GET",
      onResponseError({ response }) {
        console.log(response._data.error)
      },
    })

    console.log(resp)
    providers.value = resp.suppliers
  } catch (error) {
    console.log(error)
  }
}

const showItem = ShowInvoice => {
  console.log(ShowInvoice)
  isInvoiceShowDialogVisible.value = true
  invoiceSelected.value = ShowInvoice
}

const processInvoice = invoice => {
  invoiceToProcess.value = invoice
  isInvoiceProcessDialogVisible.value = true
}

const onProcessSuccess = invoiceId => {
  const index = list_invoices.value.findIndex(item => item.id === invoiceId)
  if (index !== -1) {
    list_invoices.value[index].invoice_process = 1
  }
}


const deleteInvoice = DeleteInvoice => {
  invoiceSelected.value = DeleteInvoice
  isInvoiceDeleteDialogVisible.value = true
}

const onDeleteSuccess = () => {
  list() // recargar la tabla después de borrar
}

const addInvoice = newInvoice => {
  console.log('Agregando nueva factura:', newInvoice)

  // Agregar la nueva factura al inicio de la lista
  list_invoices.value.unshift(newInvoice)
}

// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch([search, supplier_id, range_date], () => {
  currentPage.value = 1
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    list()
  }, 500)
})

// Método de refresco para reiniciar todos los filtros
const refresh = () => {
  search.value = null
  supplier_id.value = null
  from_date.value = null
  to_date.value = null
  range_date.value = null
  currentPage.value = 1
  list()
}

const truncate = (text, length = 50) => {
  if (!text) return ''

  return text.length > length
    ? text.slice(0, length) + '…'
    : text
}

onMounted(() => {
  config()
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 invoices-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-file-list-3-line" color="primary" class="me-2" size="28" />
          Compras
        </h1>
        <p class="text-medium-emphasis mb-0">
          Gestión de facturas de compras y proveedores
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="secondary" variant="tonal" prepend-icon="ri-file-upload-line"
          @click="isInvoiceAddDialogVisible = !isInvoiceAddDialogVisible">
          Subir XML
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-circle-line" to="/invoice/manual-purchase">
          Compra Manual
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12" md="4">
            <VTextField v-model="search" label="Buscar factura" placeholder="Número, proveedor, RUC..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto" clearable
              color="primary" />
          </VCol>

          <VCol cols="12" sm="6" md="4">
            <VAutocomplete v-model="supplier_id" label="Proveedores" placeholder="Todos" :items="providers"
              item-title="name" item-value="id" clearable variant="outlined" density="comfortable" hide-details="auto"
              color="primary" />
          </VCol>

          <VCol cols="12" sm="6" md="4">
            <AppDateTimePicker v-model="range_date" label="Rango de fecha" placeholder="Seleccionar rango de fechas"
              :config="{ mode: 'range' }" variant="outlined" density="comfortable" hide-details="auto"
              color="primary" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Facturas -->
      <div class="position-relative">
        <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div class="overflow-x-auto">
          <VTable hover class="invoices-table">
            <thead>
              <tr>
                <th class="text-center font-weight-bold text-uppercase" style="width: 60px;">
                  #
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">
                  PROVEEDOR
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">
                  FACTURA
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 120px;">
                  FECHA
                </th>
                <th class="text-right font-weight-bold text-uppercase" style="width: 120px;">
                  SUBTOTAL
                </th>
                <th class="text-right font-weight-bold text-uppercase" style="width: 120px;">
                  IVA (15%)
                </th>
                <th class="text-right font-weight-bold text-uppercase" style="width: 120px;">
                  TOTAL
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 120px;">
                  ESTADO
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody v-if="isLoading">
              <tr>
                <td colspan="9" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">
                    Cargando registros...
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!list_invoices || list_invoices.length === 0">
              <tr>
                <td colspan="9" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">
                    ri-inbox-line
                  </VIcon>
                  <div class="text-h6">
                    No hay facturas registradas
                  </div>
                  <div class="text-body-2">
                    Intenta ajustar los filtros de búsqueda
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="invoice in list_invoices" :key="invoice.id" class="invoices-row align-middle">
                <td class="text-center py-3">
                  <span class="font-weight-bold text-subtitle-1 text-primary">{{ invoice.id }}</span>
                </td>

                <td class="text-left py-3" style="max-width: 250px;">
                  <div class="font-weight-semibold text-truncate text-body-1 text-grey-darken-4"
                    :title="invoice.supplier?.name ? truncate(invoice.supplier.name, 50) : '-'">
                    {{ invoice.supplier?.name ? truncate(invoice.supplier.name, 50) : '-' }}
                  </div>
                </td>

                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3">{{ invoice.invoice_number || '-' }}</span>
                </td>

                <td class="text-no-wrap text-left py-3">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                    <span class="text-body-2 text-medium-emphasis">
                      {{ invoice.issue_date ? new Date(invoice.issue_date).toISOString().slice(0, 10) : '-' }}
                    </span>
                  </div>
                </td>

                <td class="text-no-wrap text-right py-3">
                  <div class="font-weight-medium text-body-1 text-grey-darken-4">
                    ${{ Number(invoice.subtotal || 0).toFixed(2) }}
                  </div>
                </td>

                <td class="text-no-wrap text-right py-3">
                  <div class="font-weight-medium text-body-1 text-grey-darken-4">
                    ${{ Number(invoice.tax || 0).toFixed(2) }}
                  </div>
                </td>

                <td class="text-no-wrap text-right py-3">
                  <div class="font-weight-bold text-subtitle-1 text-success">
                    ${{ Number(invoice.total || 0).toFixed(2) }}
                  </div>
                </td>

                <td class="text-no-wrap text-center py-3">
                  <VChip :color="invoice.invoice_process === 1 ? 'success' : 'warning'" variant="tonal" size="small">
                    {{ invoice.invoice_process === 1 ? 'Procesada' : 'Pendiente' }}
                  </VChip>
                </td>

                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <!-- Procesar Factura -->
                    <VBtn v-if="!invoice.invoice_process || invoice.invoice_process === 2" class="action-btn"
                      variant="text" icon size="small" color="success" title="Procesar Factura"
                      @click="processInvoice(invoice)">
                      <VIcon icon="ri-check-line" size="20" />
                    </VBtn>
                    <VBtn v-else class="action-btn" variant="text" icon size="small" color="success"
                      title="Factura Procesada" disabled>
                      <VIcon icon="ri-file-check-line" size="20" />
                    </VBtn>

                    <!-- Ver Detalle -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver Factura"
                      @click="showItem(invoice)">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>

                    <!-- Eliminar -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="error" title="Eliminar Factura"
                      @click="deleteInvoice(invoice)">
                      <VIcon icon="ri-delete-bin-6-line" size="20" />
                    </VBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ list_invoices.length }}</span> de <span
              class="font-weight-bold">{{
                totalItems }}</span> facturas
          </div>
          <VPagination v-model="currentPage" :length="totalPage" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="list" />
        </div>
      </VCardActions>
    </VCard>

    <!-- DIALOG -->
    <InvoiceAddDialog v-model:isDialogVisible="isInvoiceAddDialogVisible" @add-invoice="addInvoice" />
    <InvoiceShowDialog v-if="isInvoiceShowDialogVisible" v-model:isDialogVisible="isInvoiceShowDialogVisible"
      :invoice-selected="invoiceSelected" />
    <InvoiceDeleteDialog v-if="isInvoiceDeleteDialogVisible" v-model:isDialogVisible="isInvoiceDeleteDialogVisible"
      :invoice-selected="invoiceSelected" @delete-invoice-success="onDeleteSuccess" />
    <InvoiceProcessDialog v-if="isInvoiceProcessDialogVisible" v-model:isDialogVisible="isInvoiceProcessDialogVisible"
      :invoice="invoiceToProcess" @process-success="onProcessSuccess" />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de facturas */
.invoices-table :deep(thead) {
  background-color: #f8fafc !important;
}

.invoices-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.invoices-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.invoices-row:hover {
  background-color: #f8fafc !important;
}

.action-btn {
  transition: all 0.2s ease;
  border-radius: 6px !important;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}
</style>