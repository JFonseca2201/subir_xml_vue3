<script setup>
import { ref, onMounted, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const { showNotification } = useGlobalToast()

// Estados de la lista
const loading = ref(false)
const credits = ref([])
const suppliers = ref([])
const accounts = ref([])
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)

// Filtros
const filters = ref({
  supplier_id: null,
  status: null,
  source_type: null,
  start_date: null,
  end_date: null,
  search: '',
})

const statusOptions = [
  { title: 'Disponible', value: 'available' },
  { title: 'Parcialmente Usado', value: 'partially_used' },
  { title: 'Liquidado Totalmente', value: 'fully_used' },
  { title: 'Reembolsado a Cuenta', value: 'refunded' },
]

const sourceTypeOptions = [
  { title: 'Sobrante en Pago (Excedente)', value: 'overpayment' },
  { title: 'Nota de Crédito', value: 'credit_note' },
  { title: 'Ajuste Manual', value: 'manual_adjustment' },
]

// Modal de Reembolso a Cuenta
const isRefundDialogVisible = ref(false)
const selectedCreditForRefund = ref(null)
const refundForm = ref({
  account_id: null,
  amount: null,
  notes: '',
})
const isRefundSubmitting = ref(false)

// Modal de Detalle de Usos / Cruces
const isUsagesDialogVisible = ref(false)
const selectedCreditForUsages = ref(null)

// Filtro personalizado de proveedor
const filterSupplier = (value, query, item) => {
  if (!query) return true
  const q = query.toLowerCase().trim()
  const name = (item.raw.name || '').toLowerCase()
  const ruc = (item.raw.ruc || item.raw.tax_id || '').toLowerCase()
  return name.includes(q) || ruc.includes(q)
}

// Cargar Proveedores y Cuentas
const loadInitialConfig = async () => {
  try {
    const [configRes, accountsRes] = await Promise.all([
      $api('invoices/config'),
      $api('accounts'),
    ])

    suppliers.value = configRes?.suppliers || []
    accounts.value = accountsRes?.data || accountsRes?.accounts || accountsRes || []
  } catch (error) {
    console.error('Error cargando configuración:', error)
  }
}

// Cargar listado de créditos
const loadCredits = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      ...filters.value,
    }

    Object.keys(params).forEach(k => {
      if (params[k] === null || params[k] === '') {
        delete params[k]
      }
    })

    const response = await $api('supplier-credit-balances', { params })

    if (response.success) {
      const paginator = response.data
      credits.value = paginator.data || []
      totalPages.value = paginator.last_page || 1
      totalItems.value = paginator.total || 0
    }
  } catch (error) {
    console.error('Error al cargar saldos a favor:', error)
    showNotification('Error al cargar saldos a favor de proveedores', 'error')
  } finally {
    loading.value = false
  }
}

// Limpiar filtros
const resetFilters = () => {
  filters.value = {
    supplier_id: null,
    status: null,
    source_type: null,
    start_date: null,
    end_date: null,
    search: '',
  }
  currentPage.value = 1
  loadCredits()
}

// Helpers de visualización
const formatMoney = (val) => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(val || 0)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('T')[0].split(' ')[0].split('-')
  return `${day}/${month}/${year}`
}

const getStatusBadge = (status) => {
  const map = {
    available: { color: 'success', text: 'Disponible', icon: 'ri-checkbox-circle-line' },
    partially_used: { color: 'warning', text: 'Parcial', icon: 'ri-pie-chart-line' },
    fully_used: { color: 'secondary', text: 'Liquidado', icon: 'ri-check-line' },
    refunded: { color: 'info', text: 'Reembolsado', icon: 'ri-refund-2-line' },
    canceled: { color: 'error', text: 'Anulado', icon: 'ri-close-circle-line' },
  }
  return map[status] || { color: 'grey', text: status, icon: 'ri-question-line' }
}

const getSourceTypeBadge = (type) => {
  const map = {
    overpayment: { color: 'primary', text: 'Saldo a Favor' },
    credit_note: { color: 'amber-darken-2', text: 'Nota de Crédito' },
    manual_adjustment: { color: 'purple', text: 'Ajuste Manual' },
  }
  return map[type] || { color: 'grey', text: type }
}

// Abrir diálogo de reembolso
const openRefundDialog = (credit) => {
  selectedCreditForRefund.value = credit
  refundForm.value = {
    account_id: accounts.value[0]?.id || null,
    amount: Number(credit.remaining_balance),
    notes: '',
  }
  isRefundDialogVisible.value = true
}

// Procesar reembolso
const submitRefund = async () => {
  if (!refundForm.value.account_id) {
    showNotification('Seleccione la cuenta bancaria de destino.', 'warning')
    return
  }

  if (!refundForm.value.amount || refundForm.value.amount <= 0) {
    showNotification('Ingrese un monto válido para el reembolso.', 'warning')
    return
  }

  isRefundSubmitting.value = true

  try {
    const creditId = selectedCreditForRefund.value.id
    const response = await $api(`supplier-credit-balances/${creditId}/refund`, {
      method: 'POST',
      body: refundForm.value,
    })

    if (response.success) {
      showNotification(response.message || 'Reembolso procesado exitosamente.', 'success')
      isRefundDialogVisible.value = false
      loadCredits()
    } else {
      showNotification(response.message || 'Error al procesar reembolso.', 'error')
    }
  } catch (error) {
    console.error('Error en reembolso:', error)
    showNotification(error?.response?._data?.message || 'Error al procesar el reembolso.', 'error')
  } finally {
    isRefundSubmitting.value = false
  }
}

// Abrir diálogo de usos / aplicaciones
const openUsagesDialog = (credit) => {
  selectedCreditForUsages.value = credit
  isUsagesDialogVisible.value = true
}

onMounted(() => {
  loadInitialConfig()
  loadCredits()
})
</script>

<template>
  <div class="supplier-credits-container pb-10">
    <!-- Header -->
    <div class="d-flex flex-wrap align-center justify-space-between gap-4 mb-6">
      <div>
        <h4 class="text-h4 font-weight-bold text-grey-darken-4 mb-1">
          Saldos a Favor y Notas de Crédito de Proveedores
        </h4>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Controla los excedentes de pago a favor de la empresa, notas de crédito recibidas y su historial de cruces.
        </p>
      </div>

      <div class="d-flex align-center gap-3">
        <VBtn
          color="primary"
          prepend-icon="ri-exchange-dollar-line"
          to="/invoice/reconciliation"
          class="text-none font-weight-medium"
        >
          Nueva Conciliación de Pago
        </VBtn>
      </div>
    </div>

    <!-- Filtros -->
    <VCard class="mb-6 rounded-xl border border-light elevation-0">
      <VCardText class="pa-4 bg-grey-lighten-5">
        <VRow dense class="align-center">
          <!-- Búsqueda -->
          <VCol cols="12" md="4">
            <VTextField
              v-model="filters.search"
              placeholder="Buscar por referencia, NC o proveedor..."
              prepend-inner-icon="ri-search-line"
              variant="outlined"
              density="compact"
              hide-details="auto"
              clearable
              color="primary"
              :loading="loading"
              @keyup.enter="() => { currentPage = 1; loadCredits(); }"
            />
          </VCol>

          <!-- Proveedor -->
          <VCol cols="12" sm="6" md="3">
            <VAutocomplete
              v-model="filters.supplier_id"
              :items="suppliers"
              item-title="name"
              item-value="id"
              :custom-filter="filterSupplier"
              placeholder="Todos los proveedores"
              variant="outlined"
              density="compact"
              hide-details="auto"
              clearable
              color="primary"
              @update:model-value="() => { currentPage = 1; loadCredits(); }"
            />
          </VCol>

          <!-- Estado -->
          <VCol cols="12" sm="6" md="2">
            <VSelect
              v-model="filters.status"
              :items="statusOptions"
              item-title="title"
              item-value="value"
              placeholder="Estado"
              variant="outlined"
              density="compact"
              hide-details="auto"
              clearable
              color="primary"
              @update:model-value="() => { currentPage = 1; loadCredits(); }"
            />
          </VCol>

          <!-- Tipo de Origen -->
          <VCol cols="12" sm="6" md="2">
            <VSelect
              v-model="filters.source_type"
              :items="sourceTypeOptions"
              item-title="title"
              item-value="value"
              placeholder="Tipo Origen"
              variant="outlined"
              density="compact"
              hide-details="auto"
              clearable
              color="primary"
              @update:model-value="() => { currentPage = 1; loadCredits(); }"
            />
          </VCol>

          <!-- Botón Limpiar -->
          <VCol cols="12" sm="6" md="1" class="text-right">
            <VBtn
              variant="text"
              color="secondary"
              density="compact"
              icon="ri-filter-off-line"
              title="Limpiar Filtros"
              @click="resetFilters"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Listado Principal -->
    <VCard class="rounded-xl border border-light elevation-0 overflow-hidden">
      <VProgressLinear v-if="loading" indeterminate color="primary" height="3" />

      <div v-if="!loading && credits.length === 0" class="text-center py-12">
        <VIcon icon="ri-hand-coin-line" size="48" color="grey-lighten-1" class="mb-3" />
        <div class="text-h6 text-grey-darken-2 font-weight-regular">
          No se encontraron saldos a favor ni notas de crédito
        </div>
        <div class="text-caption text-medium-emphasis mt-1">
          Ajusta los filtros o registra una nueva conciliación con excedente
        </div>
      </div>

      <div v-else class="table-responsive">
        <VTable hover class="credits-table">
          <thead class="bg-grey-lighten-4">
            <tr>
              <th class="text-left font-weight-bold text-caption text-grey-darken-3 py-3 px-4">Proveedor</th>
              <th class="text-left font-weight-bold text-caption text-grey-darken-3 py-3 px-4">Tipo & Referencia</th>
              <th class="text-right font-weight-bold text-caption text-grey-darken-3 py-3 px-4">Monto Original</th>
              <th class="text-right font-weight-bold text-caption text-grey-darken-3 py-3 px-4">Monto Usado</th>
              <th class="text-right font-weight-bold text-caption text-grey-darken-3 py-3 px-4">Saldo Disponible</th>
              <th class="text-center font-weight-bold text-caption text-grey-darken-3 py-3 px-4">Estado</th>
              <th class="text-left font-weight-bold text-caption text-grey-darken-3 py-3 px-4">Fecha</th>
              <th class="text-center font-weight-bold text-caption text-grey-darken-3 py-3 px-4" style="width: 140px;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in credits"
              :key="item.id"
              class="align-middle border-b border-opacity-25"
            >
              <!-- Proveedor -->
              <td class="py-3 px-4">
                <div class="text-body-2 font-weight-bold text-grey-darken-4">
                  {{ item.supplier?.name || 'Proveedor #' + item.supplier_id }}
                </div>
                <div v-if="item.supplier?.ruc" class="text-caption text-medium-emphasis">
                  RUC: {{ item.supplier.ruc }}
                </div>
              </td>

              <!-- Tipo & Referencia -->
              <td class="py-3 px-4">
                <div class="d-flex align-center gap-2 mb-1">
                  <VChip size="x-small" :color="getSourceTypeBadge(item.source_type).color" class="font-weight-bold">
                    {{ getSourceTypeBadge(item.source_type).text }}
                  </VChip>
                </div>
                <div class="text-caption font-weight-medium text-grey-darken-3">
                  {{ item.reference_number || 'Sin ref.' }}
                </div>
              </td>

              <!-- Monto Original -->
              <td class="text-right py-3 px-4 text-body-2 font-weight-medium text-grey-darken-3">
                {{ formatMoney(item.amount) }}
              </td>

              <!-- Monto Usado -->
              <td class="text-right py-3 px-4 text-body-2 text-medium-emphasis">
                {{ formatMoney(item.used_amount) }}
              </td>

              <!-- Saldo Disponible -->
              <td class="text-right py-3 px-4">
                <span
                  class="text-body-1 font-weight-bold"
                  :class="Number(item.remaining_balance) > 0 ? 'text-success' : 'text-grey-darken-1'"
                >
                  {{ formatMoney(item.remaining_balance) }}
                </span>
              </td>

              <!-- Estado -->
              <td class="text-center py-3 px-4">
                <VChip
                  size="small"
                  :color="getStatusBadge(item.status).color"
                  class="font-weight-bold"
                >
                  <VIcon :icon="getStatusBadge(item.status).icon" start size="14" />
                  {{ getStatusBadge(item.status).text }}
                </VChip>
              </td>

              <!-- Fecha -->
              <td class="py-3 px-4 text-caption text-medium-emphasis">
                {{ formatDate(item.created_at) }}
              </td>

              <!-- Acciones -->
              <td class="text-center py-3 px-4">
                <div class="d-flex justify-center align-center gap-1">
                  <!-- Ver Usos -->
                  <VBtn
                    variant="text"
                    icon
                    size="small"
                    color="info"
                    title="Ver Historial de Cruces"
                    @click="openUsagesDialog(item)"
                  >
                    <VIcon icon="ri-history-line" size="18" />
                  </VBtn>

                  <!-- Reembolsar a Cuenta (si tiene saldo disponible) -->
                  <VBtn
                    v-if="Number(item.remaining_balance) > 0"
                    variant="text"
                    icon
                    size="small"
                    color="success"
                    title="Reembolsar a Cuenta Bancaria"
                    @click="openRefundDialog(item)"
                  >
                    <VIcon icon="ri-refund-2-line" size="18" />
                  </VBtn>
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </div>

      <!-- Paginación -->
      <div v-if="totalPages > 1" class="d-flex justify-space-between align-center px-4 py-3 border-t border-light">
        <div class="text-caption text-medium-emphasis">
          Mostrando {{ credits.length }} de {{ totalItems }} registros
        </div>
        <VPagination
          v-model="currentPage"
          :length="totalPages"
          total-visible="5"
          density="compact"
          @update:model-value="loadCredits"
        />
      </div>
    </VCard>

    <!-- DIÁLOGO: Reembolso de Saldo a Cuenta Bancaria -->
    <VDialog v-model="isRefundDialogVisible" max-width="500" persistent>
      <VCard class="rounded-xl overflow-hidden">
        <VCardItem class="bg-success text-white py-3">
          <VCardTitle class="text-subtitle-1 font-weight-bold text-white d-flex align-center gap-2">
            <VIcon icon="ri-refund-2-line" size="20" />
            Reembolso de Saldo a Favor
          </VCardTitle>
        </VCardItem>

        <VCardText class="pa-5">
          <p class="text-body-2 text-grey-darken-3 mb-4">
            Ingresa la cuenta bancaria o caja donde el proveedor realizó la devolución del dinero:
          </p>

          <VRow dense>
            <VCol cols="12" class="mb-3">
              <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                Cuenta de Destino del Reembolso <span class="text-error">*</span>
              </label>
              <VSelect
                v-model="refundForm.account_id"
                :items="accounts"
                item-title="name"
                item-value="id"
                placeholder="Seleccione cuenta..."
                variant="outlined"
                density="compact"
                hide-details="auto"
                color="success"
              />
            </VCol>

            <VCol cols="12" class="mb-3">
              <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                Monto a Reembolsar ($) <span class="text-error">*</span>
              </label>
              <VTextField
                v-model.number="refundForm.amount"
                type="number"
                step="0.01"
                min="0.01"
                :max="selectedCreditForRefund?.remaining_balance"
                prefix="$"
                variant="outlined"
                density="compact"
                hide-details="auto"
                color="success"
              />
              <div class="text-caption text-medium-emphasis mt-1">
                Máximo disponible: {{ formatMoney(selectedCreditForRefund?.remaining_balance) }}
              </div>
            </VCol>

            <VCol cols="12">
              <label class="text-caption font-weight-bold text-grey-darken-3 d-block mb-1">
                Observación / Referencia
              </label>
              <VTextField
                v-model="refundForm.notes"
                placeholder="Ej: Transferencia recibida por devolución #..."
                variant="outlined"
                density="compact"
                hide-details="auto"
                color="success"
              />
            </VCol>
          </VRow>
        </VCardText>

        <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-end gap-2 border-t border-light">
          <VBtn
            variant="outlined"
            color="secondary"
            class="text-none"
            @click="isRefundDialogVisible = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="success"
            class="text-none font-weight-bold px-4"
            :loading="isRefundSubmitting"
            @click="submitRefund"
          >
            Confirmar Reembolso
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- DIÁLOGO: Historial de Cruces / Usos del Saldo -->
    <VDialog v-model="isUsagesDialogVisible" max-width="600">
      <VCard class="rounded-xl overflow-hidden">
        <VCardItem class="bg-primary text-white py-3">
          <VCardTitle class="text-subtitle-1 font-weight-bold text-white d-flex align-center gap-2">
            <VIcon icon="ri-history-line" size="20" />
            Historial de Cruces y Aplicaciones
          </VCardTitle>
          <VCardSubtitle class="text-caption text-white text-opacity-75">
            Ref: {{ selectedCreditForUsages?.reference_number || 'Crédito #' + selectedCreditForUsages?.id }}
          </VCardSubtitle>
        </VCardItem>

        <VCardText class="pa-5">
          <div v-if="!selectedCreditForUsages?.usages || selectedCreditForUsages.usages.length === 0" class="text-center py-6">
            <VIcon icon="ri-time-line" size="36" color="grey-lighten-1" class="mb-2" />
            <p class="text-body-2 text-medium-emphasis mb-0">
              Este saldo aún no ha sido aplicado en ninguna compra posterior.
            </p>
          </div>

          <VTable v-else class="usages-table border rounded-lg">
            <thead class="bg-grey-lighten-4">
              <tr>
                <th class="text-left py-2 px-3 text-caption font-weight-bold">Factura de Compra</th>
                <th class="text-right py-2 px-3 text-caption font-weight-bold">Monto Aplicado</th>
                <th class="text-left py-2 px-3 text-caption font-weight-bold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="usage in selectedCreditForUsages.usages" :key="usage.id">
                <td class="py-2 px-3 text-body-2 font-weight-medium">
                  {{ usage.invoice?.invoice_number || 'Compra #' + (usage.invoice_id || 'N/A') }}
                </td>
                <td class="py-2 px-3 text-right font-weight-bold text-primary">
                  {{ formatMoney(usage.amount_applied) }}
                </td>
                <td class="py-2 px-3 text-caption text-medium-emphasis">
                  {{ formatDate(usage.created_at) }}
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>

        <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-end border-t border-light">
          <VBtn
            variant="tonal"
            color="secondary"
            class="text-none"
            @click="isUsagesDialogVisible = false"
          >
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style lang="scss" scoped>
.supplier-credits-container {
  .credits-table, .usages-table {
    border-collapse: separate;
    border-spacing: 0;

    th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}
</style>
