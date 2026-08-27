<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const router = useRouter()
const { showNotification } = useGlobalToast()

// Estados generales
const loading = ref(false)
const isSubmitting = ref(false)
const suppliers = ref([])
const accounts = ref([])
const paymentMethods = [
  'Transferencia',
  'Efectivo',
  'Cheque',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
]

// Formulario principal
const form = ref({
  supplier_id: null,
  account_id: null,
  payment_date: new Date().toISOString().substring(0, 10),
  payment_method: 'Transferencia',
  reference_number: '',
  actual_payment_amount: null,
  difference_resolution: 'credit_balance', // 'credit_balance' | 'credit_note' | 'immediate_refund'
  credit_note_number: '',
  refund_account_id: null,
  notes: '',
})

// Facturas pendientes del proveedor seleccionado
const pendingInvoices = ref([])
const selectedInvoices = ref([])
const loadingInvoices = ref(false)

// Saldos a favor disponibles del proveedor
const availableCredits = ref([])
const totalAvailableCredit = ref(0)
const loadingCredits = ref(false)

// Filtro personalizado de proveedor por nombre y RUC
const filterSupplier = (value, query, item) => {
  if (!query) return true
  const q = query.toLowerCase().trim()
  const name = (item.raw.name || '').toLowerCase()
  const ruc = (item.raw.ruc || item.raw.tax_id || '').toLowerCase()
  return name.includes(q) || ruc.includes(q)
}

// Cargar proveedores y cuentas
const loadInitialData = async () => {
  loading.value = true
  try {
    const [configRes, accountsRes] = await Promise.all([
      $api('invoices/config'),
      $api('accounts'),
    ])

    suppliers.value = configRes?.suppliers || []
    
    const rawAccounts = accountsRes?.data || accountsRes?.accounts || accountsRes || []
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

    if (accounts.value.length > 0 && !form.value.account_id) {
      // Pre-seleccionar cuenta bancaria o caja principal
      const defaultAcc = accounts.value.find(a => a.type === 'bank' || a.name?.toLowerCase().includes('banco') || a.id === 1)
      form.value.account_id = defaultAcc ? defaultAcc.id : accounts.value[0].id
      form.value.refund_account_id = form.value.account_id
    }
  } catch (error) {
    console.error('Error al cargar datos iniciales:', error)
    showNotification('Error al cargar proveedores y cuentas', 'error')
  } finally {
    loading.value = false
  }
}

// Cargar facturas pendientes y saldos a favor al cambiar de proveedor
const onSupplierChange = async (newSupplierId) => {
  pendingInvoices.value = []
  selectedInvoices.value = []
  availableCredits.value = []
  totalAvailableCredit.value = 0

  if (!newSupplierId) return

  loadingInvoices.value = true
  loadingCredits.value = true

  try {
    const [invoicesRes, creditsRes] = await Promise.all([
      $api(`supplier-reconciliation/pending-invoices/${newSupplierId}`),
      $api(`supplier-reconciliation/credit-balances/${newSupplierId}`),
    ])

    if (invoicesRes.success) {
      pendingInvoices.value = (invoicesRes.data || []).map(inv => ({
        ...inv,
        selected: false,
        amount_to_pay: Number(inv.balance_due || inv.total_amount || 0),
      }))
    }

    if (creditsRes.success) {
      availableCredits.value = creditsRes.data || []
      totalAvailableCredit.value = Number(creditsRes.total_available || 0)
    }
  } catch (error) {
    console.error('Error al cargar facturas y créditos del proveedor:', error)
    showNotification('Error al consultar facturas pendientes del proveedor', 'error')
  } finally {
    loadingInvoices.value = false
    loadingCredits.value = false
  }
}

watch(() => form.value.supplier_id, (val) => {
  onSupplierChange(val)
})

// Búsqueda y filtrado de facturas en la tabla
const invoiceSearch = ref('')

const filteredInvoices = computed(() => {
  if (!invoiceSearch.value) return pendingInvoices.value
  const q = invoiceSearch.value.toLowerCase().trim()
  return pendingInvoices.value.filter(inv => {
    const num = (inv.invoice_number || '').toLowerCase()
    const date = (inv.issue_date || '').toLowerCase()
    const total = String(inv.total_amount || '')
    return num.includes(q) || date.includes(q) || total.includes(q)
  })
})

// Toggle selección de factura
const toggleInvoiceSelection = (invoice) => {
  invoice.selected = !invoice.selected
  if (invoice.selected && (!invoice.amount_to_pay || invoice.amount_to_pay <= 0)) {
    invoice.amount_to_pay = Number(invoice.balance_due)
  }
}

// Seleccionar todas las facturas
const selectAllInvoices = () => {
  const allSelected = pendingInvoices.value.every(i => i.selected)
  pendingInvoices.value.forEach(i => {
    i.selected = !allSelected
    if (i.selected && (!i.amount_to_pay || i.amount_to_pay <= 0)) {
      i.amount_to_pay = Number(i.balance_due)
    }
  })
}

// Cálculos reactivos
const selectedInvoicesList = computed(() => {
  return pendingInvoices.value.filter(i => i.selected)
})

const totalInvoicesSelected = computed(() => {
  return selectedInvoicesList.value.reduce((sum, i) => sum + Number(i.amount_to_pay || 0), 0)
})

const actualPayment = computed(() => {
  return Number(form.value.actual_payment_amount || 0)
})

// Diferencia calculada (Positiva = Sobrante a favor, Negativa = Falta para cubrir)
const difference = computed(() => {
  if (actualPayment.value <= 0 || totalInvoicesSelected.value <= 0) return 0
  return Number((actualPayment.value - totalInvoicesSelected.value).toFixed(2))
})

const isOverpayment = computed(() => difference.value > 0.001)
const isUnderpayment = computed(() => difference.value < -0.001)

// Formateo de moneda
const formatMoney = (val) => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(val || 0)
}

// Auto-ajustar monto real al total de facturas seleccionadas si está vacío
watch(() => totalInvoicesSelected.value, (newTotal) => {
  if (!form.value.actual_payment_amount || form.value.actual_payment_amount === 0) {
    form.value.actual_payment_amount = newTotal > 0 ? Number(newTotal.toFixed(2)) : null
  }
})

// Enviar conciliación
const submitReconciliation = async () => {
  if (!form.value.supplier_id) {
    showNotification('Seleccione un proveedor.', 'warning')
    return
  }

  if (!form.value.account_id) {
    showNotification('Seleccione la cuenta bancaria o de caja de origen.', 'warning')
    return
  }

  if (actualPayment.value <= 0) {
    showNotification('Ingrese el monto real desembolsado.', 'warning')
    return
  }

  if (selectedInvoicesList.value.length === 0) {
    showNotification('Seleccione al menos una factura a pagar.', 'warning')
    return
  }

  if (isOverpayment.value && form.value.difference_resolution === 'credit_note' && !form.value.credit_note_number) {
    showNotification('Ingrese el número de la Nota de Crédito recibida.', 'warning')
    return
  }

  if (isOverpayment.value && form.value.difference_resolution === 'immediate_refund' && !form.value.refund_account_id) {
    showNotification('Seleccione la cuenta de destino para la devolución.', 'warning')
    return
  }

  isSubmitting.value = true

  try {
    const payload = {
      supplier_id: form.value.supplier_id,
      account_id: form.value.account_id,
      payment_date: form.value.payment_date,
      payment_method: form.value.payment_method,
      reference_number: form.value.reference_number || undefined,
      actual_payment_amount: actualPayment.value,
      invoices: selectedInvoicesList.value.map(i => ({
        id: i.id,
        amount_to_pay: Number(i.amount_to_pay),
      })),
      difference_resolution: isOverpayment.value ? form.value.difference_resolution : undefined,
      credit_note_number: (isOverpayment.value && form.value.difference_resolution === 'credit_note') ? form.value.credit_note_number : undefined,
      refund_account_id: (isOverpayment.value && form.value.difference_resolution === 'immediate_refund') ? form.value.refund_account_id : undefined,
      notes: form.value.notes || undefined,
    }

    const response = await $api('supplier-reconciliation/reconcile-payment', {
      method: 'POST',
      body: payload,
    })

    if (response.success) {
      showNotification(response.message || 'Conciliación procesada exitosamente.', 'success')
      // Redirigir a listado de compras o saldos
      router.push('/invoice/list')
    } else {
      showNotification(response.message || 'Error al procesar la conciliación.', 'error')
    }
  } catch (error) {
    console.error('Error al procesar conciliación:', error)
    showNotification(error?.response?._data?.message || 'Error al procesar la conciliación.', 'error')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  loadInitialData()
})
</script>

<template>
  <div class="supplier-reconciliation-container pb-10">
    <!-- Header -->
    <div class="d-flex flex-wrap align-center justify-space-between gap-4 mb-6">
      <div>
        <div class="d-flex align-center gap-2">
          <VBtn
            icon
            variant="text"
            size="small"
            color="secondary"
            to="/invoice/list"
          >
            <VIcon icon="ri-arrow-left-line" size="22" />
          </VBtn>
          <h4 class="text-h4 font-weight-bold text-grey-darken-4 mb-0">
            Conciliación y Pago a Proveedores
          </h4>
        </div>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-1 ms-10">
          Liquida facturas de proveedores, concilia transferencias reales y gestiona sobrantes o notas de crédito automáticamente.
        </p>
      </div>

      <div class="d-flex align-center gap-3">
        <VBtn
          variant="tonal"
          color="primary"
          prepend-icon="ri-hand-coin-line"
          to="/invoice/supplier-credits"
          class="text-none font-weight-medium"
        >
          Ver Saldos a Favor y NC
        </VBtn>
      </div>
    </div>

    <VRow>
      <!-- COLUMNA IZQUIERDA: Formulario y Selección de Facturas -->
      <VCol cols="12" lg="8">
        <!-- PASO 1: Datos del Desembolso / Pago Real -->
        <VCard class="mb-6 rounded-xl border border-light elevation-0 overflow-hidden">
          <VCardItem class="bg-grey-lighten-5 py-3 border-b border-light">
            <template #prepend>
              <div class="step-badge me-3">1</div>
            </template>
            <VCardTitle class="text-subtitle-1 font-weight-bold text-grey-darken-3">
              Datos del Pago Real / Desembolso
            </VCardTitle>
            <VCardSubtitle class="text-caption text-medium-emphasis">
              Ingresa el proveedor y el monto exacto debitado de la cuenta bancaria o caja
            </VCardSubtitle>
          </VCardItem>

          <VCardText class="pa-5">
            <VRow dense>
              <!-- Proveedor -->
              <VCol cols="12" md="6" class="mb-3">
                <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                  Proveedor <span class="text-error">*</span>
                </label>
                <VAutocomplete
                  v-model="form.supplier_id"
                  :items="suppliers"
                  item-title="name"
                  item-value="id"
                  :custom-filter="filterSupplier"
                  placeholder="Seleccione o busque un proveedor (nombre o RUC)..."
                  prepend-inner-icon="ri-store-2-line"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  color="primary"
                  clearable
                  :loading="loading"
                >
                  <template #item="{ props, item }">
                    <VListItem
                      v-bind="props"
                      :title="item.raw.name"
                      :subtitle="`RUC: ${item.raw.ruc || item.raw.tax_id || 'N/A'}`"
                    />
                  </template>
                </VAutocomplete>
              </VCol>

              <!-- Cuenta Origen -->
              <VCol cols="12" md="6" class="mb-3">
                <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                  Cuenta de Egreso (Origen) <span class="text-error">*</span>
                </label>
                <VSelect
                  v-model="form.account_id"
                  :items="accounts"
                  item-title="name"
                  item-value="id"
                  placeholder="Cuenta bancaria o caja..."
                  prepend-inner-icon="ri-bank-card-line"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  color="primary"
                >
                  <template #item="{ props, item }">
                    <VListItem
                      v-bind="props"
                      :title="item.raw.name"
                      :subtitle="`Saldo actual: ${formatMoney(item.raw.balance)}`"
                    />
                  </template>
                </VSelect>
              </VCol>

              <!-- Monto Real Pagado -->
              <VCol cols="12" sm="6" md="4" class="mb-3">
                <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                  Monto Real Pagado ($) <span class="text-error">*</span>
                </label>
                <VTextField
                  v-model.number="form.actual_payment_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  prefix="$"
                  prepend-inner-icon="ri-money-dollar-circle-line"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  color="primary"
                />
              </VCol>

              <!-- Método de Pago -->
              <VCol cols="12" sm="6" md="4" class="mb-3">
                <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                  Método de Pago <span class="text-error">*</span>
                </label>
                <VSelect
                  v-model="form.payment_method"
                  :items="paymentMethods"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  color="primary"
                />
              </VCol>

              <!-- Fecha de Pago -->
              <VCol cols="12" sm="6" md="4" class="mb-3">
                <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                  Fecha de Pago <span class="text-error">*</span>
                </label>
                <VTextField
                  v-model="form.payment_date"
                  type="date"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  color="primary"
                />
              </VCol>

              <!-- Referencia / Comprobante -->
              <VCol cols="12" sm="6" md="6">
                <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                  # Referencia / Transferencia
                </label>
                <VTextField
                  v-model="form.reference_number"
                  placeholder="Ej: TRANSF-89201948"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  color="primary"
                />
              </VCol>

              <!-- Observaciones -->
              <VCol cols="12" sm="6" md="6">
                <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                  Notas / Observación
                </label>
                <VTextField
                  v-model="form.notes"
                  placeholder="Detalle o motivo del pago..."
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  color="primary"
                />
              </VCol>
            </VRow>

            <!-- Alerta informativa si el proveedor tiene saldos a favor previos -->
            <VAlert
              v-if="totalAvailableCredit > 0"
              type="info"
              variant="tonal"
              density="compact"
              class="mt-4 rounded-lg"
              icon="ri-information-line"
            >
              <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                <span>
                  Este proveedor tiene un <strong>Saldo a Favor / NC acumulado de {{ formatMoney(totalAvailableCredit) }}</strong> disponible para cruce.
                </span>
                <VBtn
                  size="x-small"
                  variant="outlined"
                  color="info"
                  to="/invoice/supplier-credits"
                  class="text-none font-weight-bold"
                >
                  Ver Créditos
                </VBtn>
              </div>
            </VAlert>
          </VCardText>
        </VCard>

        <!-- PASO 2: Facturas del Proveedor -->
        <VCard class="mb-6 rounded-xl border border-light elevation-0 overflow-hidden">
          <VCardItem class="bg-grey-lighten-5 py-3 border-b border-light">
            <template #prepend>
              <div class="step-badge me-3">2</div>
            </template>
            <div class="d-flex align-center justify-space-between flex-wrap gap-2 w-100">
              <div>
                <VCardTitle class="text-subtitle-1 font-weight-bold text-grey-darken-3">
                  Facturas del Proveedor
                </VCardTitle>
                <VCardSubtitle class="text-caption text-medium-emphasis">
                  Selecciona las facturas involucradas en este pago para calcular el valor liquidado y el sobrante
                </VCardSubtitle>
              </div>
              <VBtn
                v-if="pendingInvoices.length > 0"
                size="small"
                variant="text"
                color="primary"
                class="text-none font-weight-medium"
                @click="selectAllInvoices"
              >
                {{ pendingInvoices.every(i => i.selected) ? 'Desmarcar Todas' : 'Seleccionar Todas' }}
              </VBtn>
            </div>
          </VCardItem>

          <VCardText class="pa-0">
            <!-- Loading -->
            <div v-if="loadingInvoices" class="text-center py-8">
              <VProgressCircular indeterminate color="primary" size="36" />
              <p class="text-caption text-medium-emphasis mt-2 mb-0">Cargando facturas del proveedor...</p>
            </div>

            <!-- Sin proveedor seleccionado -->
            <div v-else-if="!form.supplier_id" class="text-center py-10 px-4">
              <VIcon icon="ri-store-2-line" size="40" color="grey-lighten-1" class="mb-2" />
              <p class="text-body-2 font-weight-medium text-grey-darken-2 mb-1">
                Selecciona un proveedor en el Paso 1
              </p>
              <p class="text-caption text-medium-emphasis mb-0">
                Aquí aparecerán las facturas emitidas por el proveedor seleccionado.
              </p>
            </div>

            <!-- Proveedor sin facturas registradas -->
            <div v-else-if="pendingInvoices.length === 0" class="text-center py-10 px-4">
              <VIcon icon="ri-file-warning-line" size="40" color="warning" class="mb-2" />
              <p class="text-body-2 font-weight-medium text-grey-darken-2 mb-1">
                No hay facturas registradas para este proveedor
              </p>
              <p class="text-caption text-medium-emphasis mb-0">
                Ingresa una compra manual o sube el XML del proveedor primero.
              </p>
            </div>

            <!-- Tabla de Facturas -->
            <div v-else>
              <!-- Barra de Búsqueda Rápida de Facturas -->
              <div class="pa-3 bg-grey-lighten-5 border-b border-light d-flex align-center justify-space-between gap-3">
                <VTextField
                  v-model="invoiceSearch"
                  placeholder="Buscar por # factura, fecha o monto..."
                  prepend-inner-icon="ri-search-line"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  class="bg-white"
                  style="max-width: 320px;"
                />
                <span class="text-caption text-medium-emphasis">
                  {{ filteredInvoices.length }} factura(s) encontrada(s)
                </span>
              </div>

              <div class="table-responsive">
                <VTable hover class="reconciliation-table">
                  <thead class="bg-grey-lighten-4">
                    <tr>
                      <th style="width: 48px;" class="text-center">
                        <VCheckbox
                          :model-value="pendingInvoices.length > 0 && pendingInvoices.every(i => i.selected)"
                          density="compact"
                          hide-details
                          @click.stop="selectAllInvoices"
                        />
                      </th>
                      <th class="text-left font-weight-bold text-caption text-grey-darken-3"># Factura</th>
                      <th class="text-left font-weight-bold text-caption text-grey-darken-3">Fecha Emisión</th>
                      <th class="text-right font-weight-bold text-caption text-grey-darken-3">Total Factura</th>
                      <th class="text-right font-weight-bold text-caption text-grey-darken-3" style="min-width: 140px;">Monto a Conciliar</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="invoice in filteredInvoices"
                      :key="invoice.id"
                      :class="{ 'bg-primary-lighten-5': invoice.selected }"
                      class="cursor-pointer transition-all"
                      @click="toggleInvoiceSelection(invoice)"
                    >
                      <td class="text-center" @click.stop>
                        <VCheckbox
                          v-model="invoice.selected"
                          density="compact"
                          hide-details
                        />
                      </td>
                      <td class="text-left font-weight-medium text-body-2 text-grey-darken-4">
                        {{ invoice.invoice_number }}
                      </td>
                      <td class="text-left text-caption text-medium-emphasis">
                        {{ invoice.issue_date || 'N/A' }}
                      </td>
                      <td class="text-right font-weight-bold text-body-2 text-grey-darken-4">
                        {{ formatMoney(invoice.total_amount) }}
                      </td>
                      <td class="text-right" @click.stop>
                        <VTextField
                          v-model.number="invoice.amount_to_pay"
                          type="number"
                          step="0.01"
                          min="0.01"
                          :disabled="!invoice.selected"
                          prefix="$"
                          density="compact"
                          variant="outlined"
                          hide-details
                          class="text-right"
                          style="max-width: 130px; margin-left: auto;"
                        />
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- COLUMNA DERECHA: Resumen, Cuadratura y Resolución de Diferencia -->
      <VCol cols="12" lg="4">
        <!-- Card de Cuadratura Financiera -->
        <VCard class="mb-6 rounded-xl border border-light elevation-1 sticky-card">
          <VCardItem class="bg-primary text-white py-4">
            <VCardTitle class="text-subtitle-1 font-weight-bold text-white d-flex align-center gap-2">
              <VIcon icon="ri-calculator-line" size="20" />
              Cuadratura de Pago
            </VCardTitle>
            <VCardSubtitle class="text-caption text-white text-opacity-75">
              Comparativa entre desembolso y facturas
            </VCardSubtitle>
          </VCardItem>

          <VCardText class="pa-5">
            <!-- Desglose -->
            <div class="d-flex justify-space-between align-center mb-2">
              <span class="text-caption text-medium-emphasis">Facturas seleccionadas:</span>
              <span class="text-body-2 font-weight-bold text-grey-darken-4">
                {{ selectedInvoicesList.length }} comprobante(s)
              </span>
            </div>

            <div class="d-flex justify-space-between align-center mb-2">
              <span class="text-body-2 text-grey-darken-2">Total en Facturas:</span>
              <span class="text-body-1 font-weight-bold text-grey-darken-4">
                {{ formatMoney(totalInvoicesSelected) }}
              </span>
            </div>

            <div class="d-flex justify-space-between align-center mb-3">
              <span class="text-body-2 text-grey-darken-2">Monto Real Transferido:</span>
              <span class="text-body-1 font-weight-bold text-primary">
                {{ formatMoney(actualPayment) }}
              </span>
            </div>

            <VDivider class="my-3" />

            <!-- Indicador de Diferencia / Sobrante -->
            <div
              v-if="isOverpayment"
              class="diferencia-box overpayment pa-3 rounded-lg border mb-4"
            >
              <div class="d-flex align-center gap-2 mb-1">
                <VIcon icon="ri-add-circle-fill" color="success" size="18" />
                <span class="text-caption font-weight-bold text-success text-uppercase">
                  Saldo a Favor Generado (+{{ formatMoney(difference) }})
                </span>
              </div>
              <p class="text-caption text-grey-darken-2 mb-0">
                El pago supera el total de facturas por <strong>{{ formatMoney(difference) }}</strong> debido a falta de stock, ajuste o mercadería pendiente.
              </p>
            </div>

            <div
              v-else-if="isUnderpayment"
              class="diferencia-box underpayment pa-3 rounded-lg border mb-4"
            >
              <div class="d-flex align-center gap-2 mb-1">
                <VIcon icon="ri-error-warning-fill" color="warning" size="18" />
                <span class="text-caption font-weight-bold text-warning text-uppercase">
                  Pago Parcial (Faltan {{ formatMoney(Math.abs(difference)) }})
                </span>
              </div>
              <p class="text-caption text-grey-darken-2 mb-0">
                El monto transferido es menor al saldo total de las facturas seleccionadas.
              </p>
            </div>

            <div
              v-else-if="actualPayment > 0 && totalInvoicesSelected > 0"
              class="diferencia-box exact pa-3 rounded-lg border mb-4 text-center"
            >
              <VIcon icon="ri-checkbox-circle-fill" color="success" size="20" class="mb-1" />
              <div class="text-caption font-weight-bold text-success">
                Cuadratura Exacta ($0.00 de diferencia)
              </div>
            </div>

            <!-- SECCIÓN DE RESOLUCIÓN DE LA DIFERENCIA (Solo si hay excedente) -->
            <div v-if="isOverpayment" class="mt-4 pt-3 border-t border-light">
              <label class="text-caption font-weight-bold text-grey-darken-4 d-block mb-2">
                ¿Cómo gestionar el sobrante de {{ formatMoney(difference) }}?
              </label>

              <VRadioGroup v-model="form.difference_resolution" density="compact" class="resolution-radios">
                <!-- Opción A -->
                <div class="resolution-option pa-3 rounded-lg border mb-2" :class="{ active: form.difference_resolution === 'credit_balance' }">
                  <VRadio
                    value="credit_balance"
                    color="primary"
                  >
                    <template #label>
                      <div>
                        <div class="text-body-2 font-weight-bold text-grey-darken-4">
                          A. Saldo a Favor (Anticipo)
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          Guardar como saldo a favor del proveedor para descontar en la próxima compra.
                        </div>
                      </div>
                    </template>
                  </VRadio>
                </div>

                <!-- Opción B -->
                <div class="resolution-option pa-3 rounded-lg border mb-2" :class="{ active: form.difference_resolution === 'credit_note' }">
                  <VRadio
                    value="credit_note"
                    color="primary"
                  >
                    <template #label>
                      <div>
                        <div class="text-body-2 font-weight-bold text-grey-darken-4">
                          B. Registrar Nota de Crédito
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          El proveedor emitió una NC oficial por la diferencia.
                        </div>
                      </div>
                    </template>
                  </VRadio>

                  <div v-if="form.difference_resolution === 'credit_note'" class="mt-2 ms-8">
                    <VTextField
                      v-model="form.credit_note_number"
                      placeholder="Número de NC (ej: NC-001-001-00451)"
                      variant="outlined"
                      density="compact"
                      hide-details
                      class="bg-white"
                    />
                  </div>
                </div>

                <!-- Opción C -->
                <div class="resolution-option pa-3 rounded-lg border mb-2" :class="{ active: form.difference_resolution === 'immediate_refund' }">
                  <VRadio
                    value="immediate_refund"
                    color="primary"
                  >
                    <template #label>
                      <div>
                        <div class="text-body-2 font-weight-bold text-grey-darken-4">
                          C. Devolución a Cuenta Bancaria
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          El proveedor reembolsó la diferencia directamente.
                        </div>
                      </div>
                    </template>
                  </VRadio>

                  <div v-if="form.difference_resolution === 'immediate_refund'" class="mt-2 ms-8">
                    <VSelect
                      v-model="form.refund_account_id"
                      :items="accounts"
                      item-title="name"
                      item-value="id"
                      placeholder="Cuenta de ingreso del reembolso..."
                      variant="outlined"
                      density="compact"
                      hide-details
                      class="bg-white"
                    />
                  </div>
                </div>
              </VRadioGroup>
            </div>

            <!-- Botón de Envío -->
            <VBtn
              block
              color="primary"
              size="large"
              class="mt-5 text-none font-weight-bold rounded-lg"
              elevation="2"
              :loading="isSubmitting"
              :disabled="selectedInvoicesList.length === 0 || actualPayment <= 0"
              @click="submitReconciliation"
            >
              <VIcon icon="ri-check-double-line" start />
              Procesar y Conciliar Pago ({{ formatMoney(actualPayment) }})
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style lang="scss" scoped>
.supplier-reconciliation-container {
  .step-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: rgb(var(--v-theme-primary));
    color: #fff;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .reconciliation-table {
    border-collapse: separate;
    border-spacing: 0;

    th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    tr {
      transition: background-color 0.15s ease;
      &:hover {
        background-color: rgba(var(--v-theme-primary), 0.03);
      }
    }
  }

  .diferencia-box {
    &.overpayment {
      background-color: #f0fdf4;
      border-color: #bbf7d0 !important;
    }
    &.underpayment {
      background-color: #fffbeb;
      border-color: #fde68a !important;
    }
    &.exact {
      background-color: #f8fafc;
      border-color: #e2e8f0 !important;
    }
  }

  .resolution-option {
    background-color: #ffffff;
    transition: all 0.2s ease;
    cursor: pointer;

    &.active {
      border-color: rgb(var(--v-theme-primary)) !important;
      background-color: rgba(var(--v-theme-primary), 0.04);
    }
  }

  .sticky-card {
    position: sticky;
    top: 80px;
  }
}
</style>
