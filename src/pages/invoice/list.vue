<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import Swal from 'sweetalert2'
import { useDebounceFn } from '@vueuse/core'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'
import InvoiceDeleteDialog from '@/components/inventory/invoices/InvoiceDeleteDialog.vue'
import InvoiceProcessDialog from '@/components/inventory/invoices/InvoiceProcessDialog.vue'
import InvoiceShowDialog from '@/components/inventory/invoices/InvoiceShowDialog.vue'

const invoiceSelected = ref(null)
const currentPage = ref(1)
const totalPage = ref(0)
const perPage = ref(10)
const totalItems = ref(0)

const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const list_invoices = ref([])
const supplier_id = ref(null)
const from_date = ref(null)
const to_date = ref(null)
const range_date = ref(null)
const search = ref(null)
const type = ref(1)

const isLoading = ref(false)
const isSearching = ref(false)

const isInvoiceShowDialogVisible = ref(false)
const isInvoiceDeleteDialogVisible = ref(false)
const isInvoiceProcessDialogVisible = ref(false)
const invoiceToProcess = ref(null)

let invoiceAbortController = null

const list = async () => {
  if (invoiceAbortController) {
    invoiceAbortController.abort()
  }
  invoiceAbortController = new AbortController()

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
      signal: invoiceAbortController.signal,
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
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return
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
  if (ShowInvoice?.status === 'canceled' || ShowInvoice?.deleted_at || ShowInvoice?.is_canceled) {
    Swal.fire({
      icon: 'warning',
      title: 'Documento Anulado',
      html: `
        <div style="text-align: center; color: #4b5563; font-size: 0.95rem;">
          La factura <b>${ShowInvoice.invoice_number ? '#' + ShowInvoice.invoice_number : ''}</b> no existe o no se encuentra disponible porque fue <b>ANULADA</b>.<br><br>
          <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px; color: #991b1b; font-size: 0.88rem; line-height: 1.4;">
            ⚠️ Este documento fue dado de baja del sistema y no permite consultar detalles.
          </div>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#7367f0',
    })
    showNotification('El documento no existe porque fue anulado', 'warning')
    
    return
  }

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

// Búsqueda en tiempo real con debounce
const debouncedLoadInvoices = useDebounceFn(() => {
  currentPage.value = 1
  list().finally(() => {
    isSearching.value = false
  })
}, 350)

watch([search, supplier_id, range_date], () => {
  isSearching.value = true
  debouncedLoadInvoices()
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

// Métricas computadas y filtros
const totalPurchasedInPage = computed(() => {
  return list_invoices.value.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0)
})

const processedInvoicesCount = computed(() => {
  return list_invoices.value.filter(i => i.invoice_process === 1).length
})

const hasActiveFilters = computed(() => {
  return !!(
    (search.value && search.value.trim()) ||
    supplier_id.value ||
    range_date.value
  )
})

const truncate = (text, length = 50) => {
  if (!text) return ''

  return text.length > length
    ? text.slice(0, length) + '…'
    : text
}

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

onMounted(() => {
  config()
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 invoices-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar
            size="42"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="me-3"
          >
            <VIcon
              icon="ri-shopping-bag-3-line"
              size="26"
            />
          </VAvatar>
          Compras y Facturas de Proveedores
        </h1>
        <p class="text-medium-emphasis mb-0 d-none d-sm-block">
          Registro de adquisiciones, facturas XML/físicas y abastecimiento de repuestos
        </p>
      </div>

      <div class="d-flex gap-2 flex-wrap w-100 w-md-auto align-center">
        <VBtn
          color="info"
          variant="tonal"
          prepend-icon="ri-exchange-dollar-line"
          to="/invoice/reconciliation"
          class="font-weight-medium flex-grow-1 flex-md-grow-0"
        >
          Conciliación de Pagos
        </VBtn>
        <VBtn
          color="success"
          variant="tonal"
          prepend-icon="ri-hand-coin-line"
          to="/invoice/supplier-credits"
          class="font-weight-medium flex-grow-1 flex-md-grow-0"
        >
          Saldos a Favor
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          to="/invoice/manual-purchase"
          class="elevation-2 font-weight-bold flex-grow-1 flex-md-grow-0"
        >
          Nueva Compra
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow
      class="mb-4 d-none d-sm-flex"
      dense
    >
      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-file-list-3-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Total Facturas
            </div>
            <div class="text-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ totalItems }} <span class="text-caption text-disabled font-weight-regular">registradas</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="success"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-money-dollar-circle-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Total Comprado (Pág.)
            </div>
            <div class="text-h6 font-weight-bold text-success font-mono text-truncate">
              ${{ totalPurchasedInPage.toFixed(2) }}
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="info"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-checkbox-circle-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Facturas Procesadas
            </div>
            <div class="text-h6 font-weight-bold text-info text-truncate">
              {{ processedInvoicesCount }} <span class="text-caption text-disabled font-weight-regular">ingresadas</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon
              icon="ri-filter-3-line"
              size="18"
              color="primary"
            />
            <span>Filtros de Compras</span>
          </div>

          <VBtn
            v-if="hasActiveFilters"
            variant="text"
            color="error"
            size="small"
            prepend-icon="ri-filter-off-line"
            class="font-weight-semibold"
            @click="refresh"
          >
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow
          dense
          class="gap-y-3"
        >
          <VCol
            cols="12"
            md="4"
          >
            <VTextField
              v-model="search"
              label="Buscar factura"
              placeholder="Número, proveedor, RUC..."
              prepend-inner-icon="ri-search-2-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              :loading="isLoading || isSearching"
            />
          </VCol>

          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VAutocomplete
              v-model="supplier_id"
              label="Proveedor"
              placeholder="Todos los proveedores"
              :items="providers"
              item-title="name"
              item-value="id"
              clearable
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              color="primary"
            />
          </VCol>

          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <AppDateTimePicker
              v-model="range_date"
              label="Rango de fecha"
              placeholder="Seleccionar período..."
              :config="{ mode: 'range' }"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              color="primary"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ESTADO DE CARGA -->
    <div v-if="isLoading">
      <!-- Skeleton Móvil -->
      <div class="d-md-none d-flex flex-column gap-3">
        <VCard
          v-for="n in 4"
          :key="'mob-skel-inv-' + n"
          class="mobile-invoice-card elevation-0 pa-4"
        >
          <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b">
            <div
              class="shimmer-line"
              style="width: 100px; height: 16px;"
            />
            <div class="d-flex gap-1">
              <div
                class="shimmer-button rounded"
                style="width: 28px; height: 28px;"
              />
              <div
                class="shimmer-button rounded"
                style="width: 28px; height: 28px;"
              />
            </div>
          </div>
          <div class="d-flex align-center gap-3 mb-3">
            <div
              class="shimmer-circle"
              style="width: 38px; height: 38px; border-radius: 8px;"
            />
            <div class="flex-grow-1">
              <div
                class="shimmer-line w-75 mb-2"
                style="height: 16px;"
              />
              <div
                class="shimmer-line w-40"
                style="height: 12px;"
              />
            </div>
          </div>
          <div
            class="shimmer-line w-100 mb-2"
            style="height: 36px; border-radius: 8px;"
          />
          <div class="d-flex justify-space-between pt-2 border-t">
            <div
              class="shimmer-line"
              style="width: 60px; height: 16px;"
            />
            <div
              class="shimmer-chip"
              style="width: 80px; height: 24px;"
            />
          </div>
        </VCard>
      </div>

      <!-- Skeleton Escritorio -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable>
          <tbody>
            <tr
              v-for="i in 5"
              :key="i"
              class="skeleton-row align-middle"
            >
              <td
                class="py-4 text-center"
                style="width: 50px;"
              >
                <div
                  class="shimmer-line mx-auto"
                  style="width: 24px;"
                />
              </td>
              <td class="py-4">
                <div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" />
              </td>
              <td
                class="py-4"
                style="width: 150px;"
              >
                <div class="shimmer-line w-60" />
              </td>
              <td
                class="py-4"
                style="width: 120px;"
              >
                <div class="shimmer-line w-50" />
              </td>
              <td
                class="py-4"
                style="width: 110px;"
              >
                <div class="shimmer-line w-50 ms-auto" />
              </td>
              <td
                class="py-4"
                style="width: 110px;"
              >
                <div class="shimmer-line w-50 ms-auto" />
              </td>
              <td
                class="py-4"
                style="width: 120px;"
              >
                <div class="shimmer-line w-60 ms-auto" />
              </td>
              <td
                class="py-4 text-center"
                style="width: 120px;"
              >
                <div class="shimmer-chip mx-auto" />
              </td>
              <td
                class="py-4 text-center"
                style="width: 120px;"
              >
                <div class="shimmer-button rounded mx-auto" />
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </div>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_invoices || list_invoices.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar
        size="76"
        color="primary"
        variant="tonal"
        class="mb-4"
      >
        <VIcon
          size="38"
          icon="ri-shopping-bag-3-line"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron facturas de compra
      </h3>
      <p
        class="text-body-1 text-medium-emphasis mb-5 mx-auto"
        style="max-width: 480px;"
      >
        Prueba cambiando el filtro de búsqueda o registra una nueva compra a proveedores.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn
          v-if="hasActiveFilters"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="refresh"
        >
          Restablecer Filtros
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          to="/invoice/manual-purchase"
        >
          Nueva Compra
        </VBtn>
      </div>
    </VCard>

    <!-- LISTADO DE COMPRAS (MÓVIL Y ESCRITORIO) -->
    <div v-else>
      <!-- VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-3 mb-4">
        <VCard
          v-for="(invoice, index) in list_invoices"
          :key="'mob-inv-' + (invoice.id || index)"
          class="mobile-invoice-card elevation-0"
        >
          <!-- Cabecera Móvil: N° Factura + Fecha + Acciones Rápidas -->
          <div class="d-flex align-center justify-space-between gap-2 mb-2 pb-2 border-b">
            <div class="d-flex align-center gap-2 min-w-0">
              <span
                class="font-mono font-weight-bold text-primary cursor-pointer hover-underline text-body-1 text-truncate"
                @click="showItem(invoice)"
              >
                {{ invoice.invoice_number || 'S/N' }}
              </span>
              <span class="text-caption text-disabled">•</span>
              <span class="text-caption text-medium-emphasis text-no-wrap">
                {{ formatDate(invoice.issue_date) }}
              </span>
            </div>

            <!-- Botones de Acción Móvil -->
            <div class="d-flex align-center gap-1 flex-shrink-0">
              <VBtn
                v-if="!invoice.invoice_process || invoice.invoice_process === 2"
                size="x-small"
                color="success"
                variant="tonal"
                icon="ri-check-line"
                title="Procesar Factura"
                @click="processInvoice(invoice)"
              />
              <VBtn
                size="x-small"
                color="info"
                variant="tonal"
                icon="ri-eye-line"
                title="Ver Factura"
                @click="showItem(invoice)"
              />
              <VBtn
                size="x-small"
                color="error"
                variant="tonal"
                icon="ri-delete-bin-line"
                title="Eliminar Factura"
                @click="deleteInvoice(invoice)"
              />
            </div>
          </div>

          <!-- Proveedor Móvil -->
          <div class="d-flex align-start gap-3 mb-2.5">
            <VAvatar
              size="38"
              color="primary"
              variant="tonal"
              rounded="lg"
              class="elevation-0 flex-shrink-0 mt-0.5"
            >
              <VIcon
                icon="ri-store-2-line"
                size="20"
              />
            </VAvatar>
            <div class="min-w-0 flex-grow-1">
              <div
                class="font-weight-bold text-high-emphasis text-body-2 text-truncate"
                :title="invoice.supplier?.name"
              >
                {{ invoice.supplier?.name || 'Proveedor no registrado' }}
              </div>
              <div
                v-if="invoice.supplier?.ruc"
                class="text-caption text-medium-emphasis font-mono"
              >
                RUC: {{ invoice.supplier.ruc }}
              </div>
            </div>
          </div>

          <!-- Grid de Importes: Subtotal, IVA, Total -->
          <div class="d-flex align-center justify-space-between mb-2.5 px-3 py-2 bg-grey-lighten-4 rounded-lg">
            <div>
              <div
                class="text-caption text-medium-emphasis font-weight-medium"
                style="font-size: 0.7rem;"
              >
                Subtotal
              </div>
              <div class="font-mono font-weight-medium text-body-2 text-high-emphasis">
                ${{ Number(invoice.subtotal || 0).toFixed(2) }}
              </div>
            </div>
            <div>
              <div
                class="text-caption text-medium-emphasis font-weight-medium"
                style="font-size: 0.7rem;"
              >
                IVA
              </div>
              <div class="font-mono font-weight-medium text-body-2 text-medium-emphasis">
                ${{ Number(invoice.tax || 0).toFixed(2) }}
              </div>
            </div>
            <div class="text-right">
              <div
                class="text-caption text-medium-emphasis font-weight-medium"
                style="font-size: 0.7rem;"
              >
                Total Factura
              </div>
              <div class="font-mono font-weight-bold text-body-1 text-success">
                ${{ Number(invoice.total || 0).toFixed(2) }}
              </div>
            </div>
          </div>

          <!-- Pie Móvil: Estado del Proceso -->
          <div class="d-flex align-center justify-space-between pt-1 border-t">
            <span class="text-caption text-disabled font-weight-medium">Estado</span>
            <div
              class="status-pill-clean"
              :class="invoice.invoice_process === 1 ? 'status-paid' : 'status-partial'"
            >
              <span class="status-dot" />
              <span>{{ invoice.invoice_process === 1 ? 'Procesada' : 'Pendiente' }}</span>
            </div>
          </div>
        </VCard>
      </div>

      <!-- VISTA ESCRITORIO: TABLA MODERNA (d-none d-md-block) -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable
          hover
          class="invoices-modern-table overflow-x-auto"
        >
          <thead>
            <tr class="bg-grey-lighten-5">
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 50px;"
              >
                #
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="min-width: 220px;"
              >
                Proveedor
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 160px;"
              >
                N° Factura
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 145px; min-width: 140px; white-space: nowrap;"
              >
                Fecha
              </th>
              <th
                class="text-right font-weight-bold text-uppercase py-3"
                style="width: 110px;"
              >
                Subtotal
              </th>
              <th
                class="text-right font-weight-bold text-uppercase py-3"
                style="width: 110px;"
              >
                IVA
              </th>
              <th
                class="text-right font-weight-bold text-uppercase py-3"
                style="width: 120px;"
              >
                Total
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 120px;"
              >
                Estado
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 120px;"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(invoice, index) in list_invoices"
              :key="invoice.id"
              class="invoice-table-row"
            >
              <!-- Índice -->
              <td class="text-center py-3">
                <span class="text-caption font-mono font-weight-bold text-disabled">
                  {{ (currentPage - 1) * (perPage || 10) + index + 1 }}
                </span>
              </td>

              <!-- Proveedor -->
              <td class="py-3">
                <div class="d-flex align-center">
                  <VAvatar
                    size="36"
                    color="primary"
                    variant="tonal"
                    rounded="lg"
                    class="elevation-0 flex-shrink-0 me-4"
                  >
                    <VIcon
                      icon="ri-store-2-line"
                      size="20"
                    />
                  </VAvatar>
                  <div class="min-w-0">
                    <div
                      class="font-weight-bold text-high-emphasis text-body-2 text-truncate"
                      style="max-width: 260px;"
                      :title="invoice.supplier?.name || 'Proveedor no registrado'"
                    >
                      {{ invoice.supplier?.name || 'Proveedor no registrado' }}
                    </div>
                    <div
                      v-if="invoice.supplier?.ruc"
                      class="text-caption text-medium-emphasis font-mono"
                    >
                      RUC: {{ invoice.supplier.ruc }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Factura -->
              <td class="py-3">
                <span
                  class="font-mono font-weight-bold text-primary cursor-pointer hover-underline text-body-2"
                  @click="showItem(invoice)"
                >
                  {{ invoice.invoice_number || 'S/N' }}
                </span>
              </td>

              <!-- Fecha -->
              <td
                class="py-3"
                style="white-space: nowrap;"
              >
                <div
                  class="d-flex align-center text-body-2 text-medium-emphasis text-no-wrap"
                  style="white-space: nowrap;"
                >
                  <VIcon
                    icon="ri-calendar-line"
                    size="16"
                    color="medium-emphasis"
                    class="me-1 flex-shrink-0"
                  />
                  <span
                    class="text-no-wrap font-weight-medium"
                    style="white-space: nowrap;"
                  >{{ formatDate(invoice.issue_date) }}</span>
                </div>
              </td>

              <!-- Subtotal -->
              <td class="text-right py-3">
                <span class="font-mono font-weight-medium text-body-2 text-high-emphasis">
                  ${{ Number(invoice.subtotal || 0).toFixed(2) }}
                </span>
              </td>

              <!-- IVA -->
              <td class="text-right py-3">
                <span class="font-mono font-weight-medium text-body-2 text-medium-emphasis">
                  ${{ Number(invoice.tax || 0).toFixed(2) }}
                </span>
              </td>

              <!-- Total -->
              <td class="text-right py-3">
                <span class="font-mono font-weight-bold text-body-1 text-success">
                  ${{ Number(invoice.total || 0).toFixed(2) }}
                </span>
              </td>

              <!-- Estado (Pill limpia aceituna / pastel con punto) -->
              <td
                class="text-center py-3"
                style="white-space: nowrap;"
              >
                <div
                  class="status-pill-clean"
                  :class="invoice.invoice_process === 1 ? 'status-paid' : 'status-partial'"
                >
                  <span class="status-dot" />
                  <span>{{ invoice.invoice_process === 1 ? 'Procesada' : 'Pendiente' }}</span>
                </div>
              </td>

              <!-- Acciones -->
              <td class="text-center py-3">
                <div class="d-flex justify-center align-center gap-1">
                  <!-- Procesar Factura -->
                  <VBtn
                    v-if="!invoice.invoice_process || invoice.invoice_process === 2"
                    size="small"
                    color="success"
                    variant="tonal"
                    icon="ri-check-line"
                    title="Procesar Factura"
                    @click="processInvoice(invoice)"
                  />
                  <VBtn
                    v-else
                    size="small"
                    color="success"
                    variant="tonal"
                    icon="ri-file-check-line"
                    title="Factura Procesada"
                    disabled
                  />

                  <!-- Ver Detalle -->
                  <VBtn
                    size="small"
                    color="info"
                    variant="tonal"
                    icon="ri-eye-line"
                    title="Ver Factura"
                    @click="showItem(invoice)"
                  />

                  <!-- Eliminar Factura -->
                  <VBtn
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Factura"
                    @click="deleteInvoice(invoice)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100 text-center text-sm-start">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_invoices.length }}</strong> de <strong class="text-high-emphasis">{{ totalItems }}</strong> facturas
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPage"
            rounded="circle"
            :total-visible="$vuetify.display.xs ? 4 : 7"
            :size="$vuetify.display.xs ? 'small' : 'default'"
            density="comfortable"
            color="primary"
            class="my-0"
            @update:model-value="list"
          />
        </div>
      </VCard>
    </div>

    <!-- DIALOGS -->
    <InvoiceShowDialog
      v-if="isInvoiceShowDialogVisible"
      v-model:isDialogVisible="isInvoiceShowDialogVisible"
      :invoice-selected="invoiceSelected"
    />
    <InvoiceDeleteDialog
      v-if="isInvoiceDeleteDialogVisible"
      v-model:isDialogVisible="isInvoiceDeleteDialogVisible"
      :invoice-selected="invoiceSelected"
      @delete-invoice-success="onDeleteSuccess"
    />
    <InvoiceProcessDialog
      v-if="isInvoiceProcessDialogVisible"
      v-model:isDialogVisible="isInvoiceProcessDialogVisible"
      :invoice="invoiceToProcess"
      @process-success="onProcessSuccess"
    />
  </div>
</template>

<style scoped lang="scss">
.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.invoice-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

.hover-underline:hover {
  text-decoration: underline;
}

// Status Pills (Colores aceituna / pastel con punto al inicio)
.status-pill-clean {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 0.74rem !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  letter-spacing: 0.03em !important;
  text-transform: uppercase !important;

  .status-dot {
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }
}

.status-paid {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1px solid #a7f3d0 !important;

  .status-dot {
    background-color: #10b981 !important;
  }
}

.status-partial {
  background-color: #fffbeb !important;
  color: #92400e !important;
  border: 1px solid #fde68a !important;

  .status-dot {
    background-color: #f59e0b !important;
  }
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
