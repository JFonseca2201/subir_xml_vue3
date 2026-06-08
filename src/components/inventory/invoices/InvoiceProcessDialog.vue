<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  invoice: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:isDialogVisible', 'processSuccess'])

const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

// State
const paymentType = ref('credito')
const partnerId = ref(null)
const paymentDistributions = ref([])

const accounts = ref([])
const partners = ref([])
const invoiceDetails = ref(null)

const isLoadingConfig = ref(false)
const isLoadingInvoice = ref(false)
const errorMsg = ref(null)

const loadConfig = async () => {
  isLoadingConfig.value = true
  try {
    const [accountsResp, partnersResp] = await Promise.all([
      $api('accounts', { method: 'GET' }),
      $api('partners', { method: 'GET' }),
    ])

    accounts.value = accountsResp.data || accountsResp || []
    partners.value = partnersResp.data?.data || partnersResp.data || []
  } catch (error) {
    console.error(error)
    showNotification('Error cargando configuraciones de cuentas y socios', 'error')
  } finally {
    isLoadingConfig.value = false
  }
}

const loadInvoiceDetails = async () => {
  isLoadingInvoice.value = true
  try {
    const resp = await $api(`invoices/${props.invoice.id}`, { method: 'GET' })
    invoiceDetails.value = resp.data || resp || null
  } catch (error) {
    console.error(error)
    showNotification('Error al cargar detalles de la factura', 'error')
  } finally {
    isLoadingInvoice.value = false
  }
}

// Check if physical products lack a category
const hasMissingCategories = computed(() => {
  if (!invoiceDetails.value || !invoiceDetails.value.invoice_items) return false
  return invoiceDetails.value.invoice_items.some(
    item => item.item_type === 1 && !item.product_categorie_id
  )
})

const addPaymentDistribution = () => {
  const remaining = props.invoice.total - totalPaymentsAmount.value
  paymentDistributions.value.push({
    account_id: null,
    payment_method: 'cash',
    amount: remaining > 0 ? Number(remaining.toFixed(2)) : 0
  })
}

const removePaymentDistribution = (index) => {
  paymentDistributions.value.splice(index, 1)
}

const totalPaymentsAmount = computed(() => {
  return paymentDistributions.value.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
})

const remainingAmount = computed(() => {
  return Number((props.invoice.total - totalPaymentsAmount.value).toFixed(2))
})

const isPaymentBalanced = computed(() => {
  return Math.abs(remainingAmount.value) < 0.01
})

watch(paymentType, (newType) => {
  if (newType === 'efectivo' && paymentDistributions.value.length === 0) {
    addPaymentDistribution()
  }
})

watch(paymentDistributions, (newDists) => {
  newDists.forEach(dist => {
    if (dist.payment_method === 'cash') {
      // Allow user to select account instead of hardcoding 1
      // dist.account_id = null 
    } else if (dist.payment_method === 'transfer') {
      // Let user choose
    }
  })
}, { deep: true })

const onFormReset = () => {
  paymentType.value = 'credito'
  partnerId.value = null
  paymentDistributions.value = []
  errorMsg.value = null
  emit('update:isDialogVisible', false)
}

const processInvoice = async () => {
  errorMsg.value = null

  if (hasMissingCategories.value) {
    return showNotification('Debe asignar categorías a todos los productos antes de procesar.', 'warning')
  }

  if (paymentType.value === 'efectivo') {
    if (paymentDistributions.value.length === 0) {
      return showNotification('Debe agregar al menos una distribución de pago', 'warning')
    }
    if (!isPaymentBalanced.value) {
      return showNotification(`Los pagos no coinciden con el total de la factura. Restante: $${remainingAmount.value}`, 'warning')
    }
    // Check if all distribution rows have account_id
    const hasInvalidRow = paymentDistributions.value.some(d => !d.account_id)
    if (hasInvalidRow) {
      return showNotification('Debe seleccionar una cuenta para cada distribución de pago', 'warning')
    }
  }

  if (paymentType.value === 'aporte' && !partnerId.value) {
    return showNotification('Debe seleccionar un socio capitalista', 'warning')
  }

  loader.start()
  try {
    const payload = {
      invoice: props.invoice.id,
      payment_type: paymentType.value,
    }

    if (paymentType.value === 'efectivo') {
      payload.payment_distributions = paymentDistributions.value
    } else if (paymentType.value === 'aporte') {
      payload.partner_id = partnerId.value
    }

    const response = await $api('products/process', {
      method: 'POST',
      body: payload,
      onResponseError({ response }) {
        errorMsg.value = response._data?.message || 'Error al procesar la factura'
      },
    })

    if (response.status === 200 || response.message) {
      showNotification('Factura procesada con éxito', 'success')
      emit('processSuccess', props.invoice.id)
      onFormReset()
    }
  } catch (error) {
    console.error(error)
    showNotification(errorMsg.value || 'Error al procesar la factura', 'error')
  } finally {
    loader.stop()
  }
}

onMounted(() => {
  loadConfig()
  loadInvoiceDetails()
})
</script>

<template>
  <VDialog
    v-model="props.isDialogVisible"
    max-width="700"
    persistent
  >
    <VCard class="rounded-xl overflow-hidden elevation-24">
      <VOverlay
        :model-value="loader.loading || isLoadingConfig || isLoadingInvoice"
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

      <!-- Header with Premium Gradient -->
      <div class="gradient-header px-6 py-4 d-flex align-center justify-space-between text-white">
        <div class="d-flex align-center gap-3">
          <VAvatar color="rgba(255,255,255,0.15)" size="38">
            <VIcon color="white" size="22">ri-checkbox-circle-line</VIcon>
          </VAvatar>
          <div>
            <div class="text-h6 font-weight-bold leading-tight" style="color: white !important;">Procesar Factura XML</div>
            <div class="text-caption text-white opacity-80" style="color: white !important;">Define la forma de pago y procesa el stock</div>
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          color="white"
          density="comfortable"
          @click="onFormReset"
        />
      </div>

      <VCardText class="pa-6 d-flex flex-column gap-4 bg-slate-50" style="max-height: 70vh; overflow-y: auto;">
        <!-- Invoice summary -->
        <div class="bg-white rounded-lg pa-4 border shadow-sm mb-2">
          <div class="text-subtitle-2 font-weight-bold text-medium-emphasis mb-2">Detalles de la Factura:</div>
          <VRow>
            <VCol cols="12" sm="6" class="py-1">
              <div class="text-caption text-grey">Proveedor</div>
              <div class="text-body-2 font-weight-bold text-truncate">
                {{ props.invoice.supplier?.name || props.invoice.supplier?.trade_name || 'Sin Proveedor' }}
              </div>
            </VCol>
            <VCol cols="12" sm="6" class="py-1">
              <div class="text-caption text-grey">Número de Factura</div>
              <div class="text-body-2 font-weight-bold text-primary">
                {{ props.invoice.invoice_number }}
              </div>
            </VCol>
            <VCol cols="12" sm="6" class="py-1">
              <div class="text-caption text-grey">Fecha</div>
              <div class="text-body-2 font-weight-medium">
                {{ props.invoice.issue_date ? new Date(props.invoice.issue_date).toISOString().slice(0, 10) : '-' }}
              </div>
            </VCol>
            <VCol cols="12" sm="6" class="py-1">
              <div class="text-caption text-grey">Total Facturado</div>
              <div class="text-body-2 font-weight-black text-success">
                ${{ Number(props.invoice.total || 0).toFixed(2) }}
              </div>
            </VCol>
          </VRow>
        </div>

        <!-- Warning: Missing Categories -->
        <VAlert
          v-if="hasMissingCategories"
          type="error"
          variant="tonal"
          icon="ri-alert-line"
          class="mb-2"
        >
          <div class="text-subtitle-2 font-weight-bold">Faltan Categorías:</div>
          <p class="text-body-2 mb-0">
            Esta factura contiene productos físicos sin categoría asignada. Debe asignarles una categoría en el diálogo de ver factura antes de poder procesarla.
          </p>
        </VAlert>

        <!-- Payment Method Selection -->
        <div class="bg-white rounded-lg pa-4 border shadow-sm mb-2 border-primary border-opacity-50 border-s-4">
          <div class="d-flex align-center gap-2 mb-3">
            <VIcon color="primary" size="20">ri-money-dollar-circle-line</VIcon>
            <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
              Forma de Pago (Origen de Fondos)
            </span>
          </div>

          <VRadioGroup v-model="paymentType" class="mb-4">
            <VRadio label="Cuenta por Pagar (Crédito)" value="credito" color="primary" class="mb-2" />
            <VRadio label="Pago Inmediato (Caja/Banco)" value="efectivo" color="success" class="mb-2" />
            <VRadio label="Financiado por Socio (Aporte)" value="aporte" color="warning" />
          </VRadioGroup>

          <!-- Conditional Fields: MULTIPLE PAYMENTS (EFECTIVO) -->
          <VExpandTransition>
            <div v-if="paymentType === 'efectivo'">
              <div class="d-flex align-center justify-space-between mb-3 border-t pt-4">
                <span class="text-subtitle-2 font-weight-bold">Distribución del Pago:</span>
                <VBtn
                  color="primary"
                  size="small"
                  prepend-icon="ri-add-line"
                  variant="outlined"
                  @click="addPaymentDistribution"
                >
                  Añadir Pago
                </VBtn>
              </div>

              <!-- List of Payment Distributions -->
              <div v-for="(dist, index) in paymentDistributions" :key="index" class="d-flex align-center gap-2 mb-3">
                <VSelect
                  v-model="dist.account_id"
                  :items="accounts"
                  item-title="name"
                  item-value="id"
                  label="Cuenta"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  :disabled="false"
                  style="flex: 2;"
                />
                
                <VSelect
                  v-model="dist.payment_method"
                  :items="[
                    { title: 'Efectivo', value: 'cash' },
                    { title: 'Transferencia', value: 'transfer' }
                  ]"
                  item-title="title"
                  item-value="value"
                  label="Método"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  style="flex: 1.5;"
                />

                <VTextField
                  v-model.number="dist.amount"
                  type="number"
                  label="Monto"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  prefix="$"
                  style="flex: 1.5;"
                />

                <VBtn
                  icon="ri-delete-bin-line"
                  color="error"
                  variant="text"
                  size="small"
                  :disabled="paymentDistributions.length <= 1"
                  @click="removePaymentDistribution(index)"
                />
              </div>

              <!-- Balance status bar -->
              <div class="mt-4 pa-3 rounded-lg border d-flex justify-space-between align-center"
                   :class="isPaymentBalanced ? 'bg-success-lighten-5 border-success-opacity-30' : 'bg-error-lighten-5 border-error-opacity-30'">
                <div>
                  <span class="text-body-2 font-weight-medium">Suma de Pagos: </span>
                  <span class="text-body-1 font-weight-bold">${{ totalPaymentsAmount.toFixed(2) }}</span>
                </div>
                <div>
                  <span class="text-body-2 font-weight-medium">Restante: </span>
                  <span class="text-body-1 font-weight-bold" :class="isPaymentBalanced ? 'text-success' : 'text-error'">
                    ${{ remainingAmount.toFixed(2) }}
                  </span>
                </div>
              </div>
            </div>
          </VExpandTransition>

          <!-- Conditional Fields: PARTNER APORTE -->
          <VExpandTransition>
            <div v-if="paymentType === 'aporte'">
              <VSelect
                v-model="partnerId"
                :items="partners"
                item-title="nombre"
                item-value="id"
                label="Seleccionar Socio Capitalista"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-user-star-line"
                class="mt-2"
              />
            </div>
          </VExpandTransition>

          <VAlert
            v-if="paymentType === 'credito'"
            color="primary"
            variant="tonal"
            icon="ri-information-line"
            class="text-caption mt-2"
          >
            Se registrarán los productos en inventario y se creará una Cuenta por Pagar asociada al proveedor. No se descontará saldo de caja/bancos inmediatamente.
          </VAlert>
        </div>

        <!-- Alert messages -->
        <VAlert
          v-if="errorMsg"
          type="error"
          variant="tonal"
          class="rounded-xl mt-2"
        >
          {{ errorMsg }}
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- Footer -->
      <VCardActions class="justify-end px-6 pb-6 pt-3 bg-grey-lighten-4 border-t gap-2">
        <VBtn
          color="secondary"
          variant="tonal"
          rounded="lg"
          prepend-icon="ri-close-line"
          :disabled="loader.loading"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          color="success"
          variant="flat"
          rounded="lg"
          prepend-icon="ri-check-line"
          :loading="loader.loading"
          :disabled="hasMissingCategories || (paymentType === 'efectivo' && !isPaymentBalanced)"
          @click="processInvoice"
        >
          Procesar Factura
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.gradient-header {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-info)));
}

.border-s-4 {
  border-left-width: 4px !important;
}

.bg-slate-50 {
  background-color: #f8fafc !important;
}

.bg-success-lighten-5 {
  background-color: rgba(40, 199, 111, 0.08) !important;
}

.border-success-opacity-30 {
  border-color: rgba(40, 199, 111, 0.3) !important;
}

.bg-error-lighten-5 {
  background-color: rgba(234, 84, 85, 0.08) !important;
}

.border-error-opacity-30 {
  border-color: rgba(234, 84, 85, 0.3) !important;
}
</style>
