<script setup>
import { ref, computed, watch } from 'vue'
import { getBrandNameById } from '@/data/vehicleBrands'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  client: {
    type: Object,
    default: null,
  },
  vehicle: {
    type: Object,
    default: null,
  },
  sale: {
    type: Object,
    default: () => ({}),
  },
  paymentDistributions: {
    type: Array,
    default: () => [],
  },
  accounts: {
    type: Array,
    default: () => [],
  },
  total: {
    type: Number,
    default: 0,
  },
  advances: {
    type: Array,
    default: () => [],
  },
  advanceAmount: {
    type: Number,
    default: 0,
  },
  sriEnvironment: {
    type: [String, Number],
    default: '1',
  },
  isSubmitting: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'confirm',
])

// Lista de pagos configurados: [{ payment_method, account_id, amount }]
const paymentList = ref([])

// Mensaje de validación
const validationError = ref('')

const sriEnvironmentInfo = computed(() => {
  const isProd = String(props.sriEnvironment) === '2'

  return {
    isProd,
    type: isProd ? '2' : '1',
    text: isProd ? 'PRODUCCIÓN' : 'PRUEBAS',
    color: isProd ? 'success' : 'info',
    icon: isProd ? 'ri-shield-check-line' : 'ri-test-tube-line',
    desc: isProd
      ? 'Ambiente de Producción del SRI.'
      : 'Ambiente de Pruebas del SRI.',
  }
})

const clientDisplayName = computed(() => {
  if (!props.client) return 'Consumidor Final'

  return (
    props.client.full_name ||
    `${props.client.name || ''} ${props.client.surname || ''}`.trim() ||
    props.client.n_document ||
    'Consumidor Final'
  )
})

const getDefaultCashId = () => {
  const caja = props.accounts.find(a => a.id === 1 || a.name?.toLowerCase().includes('caja')) || props.accounts.find(a => a.type === 'cash')

  return caja ? caja.id : (props.accounts[0]?.id || null)
}

const getDefaultBankId = () => {
  const bank = props.accounts.find(a => a.type !== 'cash' && !a.name?.toLowerCase().includes('caja'))

  return bank ? bank.id : (props.accounts[0]?.id || null)
}

// Cálculo del anticipo aplicado y saldo a cancelar
const effectiveAdvanceAmount = computed(() => {
  if (props.advanceAmount > 0) return Number(props.advanceAmount)
  if (props.advances && props.advances.length > 0) {
    return props.advances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)
  }

  return 0
})

const hasAdvance = computed(() => effectiveAdvanceAmount.value > 0)

const balanceToCollect = computed(() => {
  const tot = Number(props.total || 0)

  return Math.max(0, Number((tot - effectiveAdvanceAmount.value).toFixed(2)))
})

const getTargetAmount = () => hasAdvance.value ? balanceToCollect.value : Number(props.total || 0)

const initPaymentState = () => {
  validationError.value = ''
  const targetAmount = getTargetAmount()

  // 1. Si ya venían pagos distribuidos del formulario principal
  if (props.paymentDistributions && props.paymentDistributions.length > 0) {
    // Filtrar si ya traían is_advance para que las filas editables solo representen el saldo
    const nonAdvanceDists = props.paymentDistributions.filter(d => !d.is_advance)
    if (nonAdvanceDists.length > 0) {
      paymentList.value = nonAdvanceDists.map(d => {
        const method = (d['payment_method'] === 'Efectivo' || d['payment_method'] === 'Transferencia')
          ? d['payment_method']
          : null

        return {
          'payment_method': method,
          'account_id': d['account_id'] || (method === 'Transferencia' ? getDefaultBankId() : (method === 'Efectivo' ? getDefaultCashId() : null)),
          'amount': Number(d['amount'] !== undefined && d['amount'] !== null && d['amount'] !== '' ? d['amount'] : targetAmount).toFixed(2),
        }
      })

      return
    }
  }

  // 2. Si venía un método único ya seleccionado en la venta
  const existingMethod = props.sale?.['payment_method'] || ''
  if (existingMethod === 'Transferencia') {
    paymentList.value = [{
      'payment_method': 'Transferencia',
      'account_id': props.sale?.['account_id'] || getDefaultBankId(),
      'amount': targetAmount.toFixed(2),
    }]

    return
  }

  if (existingMethod === 'Efectivo') {
    paymentList.value = [{
      'payment_method': 'Efectivo',
      'account_id': props.sale?.['account_id'] || getDefaultCashId(),
      'amount': targetAmount.toFixed(2),
    }]

    return
  }

  // 3. Si NO está establecida la forma de pago, NO preseleccionar Efectivo por defecto
  paymentList.value = [{
    'payment_method': null,
    'account_id': null,
    'amount': targetAmount.toFixed(2),
  }]
}

watch(
  () => props.isDialogVisible,
  isOpen => {
    if (isOpen) {
      initPaymentState()
    }
  },
  { immediate: true },
)

const setRowMethod = (row, method) => {
  row['payment_method'] = method
  if (method === 'Efectivo') {
    row['account_id'] = getDefaultCashId()
  } else if (method === 'Transferencia' && (!row['account_id'] || row['account_id'] === getDefaultCashId())) {
    row['account_id'] = getDefaultBankId()
  }
  validationError.value = ''
}

const totalDistributed = computed(() => {
  return paymentList.value.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
})

const balanceDifference = computed(() => {
  const tot = getTargetAmount()

  return Number((tot - totalDistributed.value).toFixed(2))
})

const isBalanced = computed(() => {
  return Math.abs(balanceDifference.value) < 0.01
})

const formatRowAmountOnBlur = row => {
  const sanitized = String(row.amount || '').replace(',', '.')
  const num = parseFloat(sanitized)

  row.amount = isNaN(num) ? '0.00' : num.toFixed(2)
  validationError.value = ''
}

const addPaymentRow = () => {
  validationError.value = ''

  const tot = getTargetAmount()
  const sumCurrent = totalDistributed.value
  const remaining = Math.max(0, Number((tot - sumCurrent).toFixed(2)))

  // Si solo hay 1 fila y aún tiene el 100% del total, dividimos de forma equilibrada
  if (paymentList.value.length === 1 && Math.abs(Number(parseFloat(paymentList.value[0].amount) || 0) - tot) < 0.01) {
    const half = Number((tot / 2).toFixed(2))

    paymentList.value[0].amount = half.toFixed(2)

    const currentMethod = paymentList.value[0]['payment_method']
    const altMethod = currentMethod === 'Efectivo' ? 'Transferencia' : (currentMethod === 'Transferencia' ? 'Efectivo' : null)

    paymentList.value.push({
      'payment_method': altMethod,
      'account_id': altMethod === 'Transferencia' ? getDefaultBankId() : (altMethod === 'Efectivo' ? getDefaultCashId() : null),
      'amount': Number((tot - half).toFixed(2)).toFixed(2),
    })

    return
  }

  // Si ya existían filas, agregamos con el saldo restante
  const altMethod = paymentList.value.some(r => r['payment_method'] === 'Transferencia') ? 'Efectivo' : 'Transferencia'

  paymentList.value.push({
    'payment_method': altMethod,
    'account_id': altMethod === 'Transferencia' ? getDefaultBankId() : getDefaultCashId(),
    'amount': remaining.toFixed(2),
  })
}

const removePaymentRow = index => {
  if (paymentList.value.length <= 1) return
  paymentList.value.splice(index, 1)
  validationError.value = ''

  // Si queda 1 sola fila, aseguramos que cubra el saldo objetivo
  if (paymentList.value.length === 1) {
    paymentList.value[0].amount = getTargetAmount().toFixed(2)
  }
}

const autoBalance = () => {
  if (paymentList.value.length === 0) return
  const tot = getTargetAmount()
  const lastIndex = paymentList.value.length - 1
  const sumOthers = paymentList.value.slice(0, lastIndex).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  paymentList.value[lastIndex].amount = Math.max(0, Number((tot - sumOthers).toFixed(2))).toFixed(2)
  validationError.value = ''
}

const closeDialog = () => {
  if (props.isSubmitting) return
  emit('update:isDialogVisible', false)
}

const onConfirm = () => {
  validationError.value = ''

  if (paymentList.value.length === 0) {
    validationError.value = 'Debe indicar al menos una forma de pago'

    return
  }

  for (let i = 0; i < paymentList.value.length; i++) {
    const row = paymentList.value[i]
    const label = paymentList.value.length > 1 ? `el Pago #${i + 1}` : 'el pago'

    if (!row['payment_method']) {
      validationError.value = `Debe seleccionar una forma de pago (Efectivo o Transferencia) para ${label}`

      return
    }

    if (row['payment_method'] === 'Transferencia' && !row['account_id']) {
      validationError.value = `Seleccione la cuenta bancaria de destino para ${label}`

      return
    }

    const rowAmount = parseFloat(row['amount']) || 0
    if (rowAmount <= 0) {
      validationError.value = `El monto de ${label} debe ser mayor a $0.00`

      return
    }
  }

  const targetTot = getTargetAmount()

  // Si solo hay 1 fila, sincronizar su monto con el saldo objetivo
  if (paymentList.value.length === 1) {
    paymentList.value[0].amount = targetTot.toFixed(2)
  } else if (!isBalanced.value) {
    if (balanceDifference.value > 0) {
      validationError.value = hasAdvance.value
        ? `Falta distribuir $${balanceDifference.value.toFixed(2)} del saldo a cancelar ($${targetTot.toFixed(2)})`
        : `Falta distribuir $${balanceDifference.value.toFixed(2)} del total de la factura ($${targetTot.toFixed(2)})`
    } else {
      validationError.value = hasAdvance.value
        ? `La suma de pagos excede el saldo a cancelar por $${Math.abs(balanceDifference.value).toFixed(2)}`
        : `La suma de pagos excede el total por $${Math.abs(balanceDifference.value).toFixed(2)}`
    }

    return
  }

  // Construir lista de pagos completa dividida (Anticipo Previo + Saldo Cancelado)
  const fullDistributions = []

  // 1. Pago 1: Anticipo(s) registrado(s) previamente en la orden de trabajo
  if (hasAdvance.value) {
    if (props.advances && props.advances.length > 0) {
      props.advances.forEach(a => {
        fullDistributions.push({
          'account_id': a.account_id,
          'amount': Number(parseFloat(a.amount) || 0),
          'payment_method': a.payment_method || 'Efectivo',
          'is_advance': true,
          'work_order_advance_id': a.id,
        })
      })
    } else {
      fullDistributions.push({
        'account_id': getDefaultCashId(),
        'amount': effectiveAdvanceAmount.value,
        'payment_method': 'Efectivo',
        'is_advance': true,
      })
    }
  }

  // 2. Pago 2+: Saldo(s) cobrado(s) hoy al facturar
  paymentList.value.forEach(d => {
    fullDistributions.push({
      'account_id': d['account_id'],
      'amount': Number(parseFloat(d['amount']) || 0),
      'payment_method': d['payment_method'],
      'is_advance': false,
    })
  })

  const allMethods = [...new Set(fullDistributions.map(d => d['payment_method']).filter(Boolean))]

  emit('confirm', {
    'payment_method': allMethods.join(', '),
    'account_id': paymentList.value[0]?.['account_id'] || fullDistributions[0]?.['account_id'],
    'payment_distributions': fullDistributions,
  })
}
</script>

<template>
  <VDialog :model-value="isDialogVisible" max-width="660px" persistent
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="custom-dialog-card rounded-xl overflow-hidden elevation-16 border">
      <!-- 1. Header Banner Primary Acorde al Sistema -->
      <div class="custom-dialog-header-primary bg-primary text-white pa-5 text-center position-relative">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn position-absolute"
          style="top: 14px; right: 14px; color: white;" :disabled="isSubmitting" @click="closeDialog" />
        <div class="custom-dialog-avatar mx-auto mb-2.5 d-flex align-center justify-center rounded-circle"
          style="width: 54px; height: 54px; background: rgba(255, 255, 255, 0.22); backdrop-filter: blur(6px); border: 1.5px solid rgba(255, 255, 255, 0.35);">
          <VIcon icon="ri-bill-line" size="28" color="white" />
        </div>
        <h3 class="custom-dialog-title text-h5 font-weight-bold text-white mb-1">
          ¿Estás seguro que deseas realizar esta "FACTURA"?
        </h3>
        <p class="custom-dialog-subtitle text-body-2 text-white opacity-90 mb-0">
          Se emitirá el comprobante electrónico fiscal con autorización oficial del SRI.
        </p>
      </div>

      <VCardText class="pa-6 bg-background d-flex flex-column gap-4" style="max-height: calc(85vh - 170px); overflow-y: auto;">
        <!-- 2. Datos de la Factura y Desglose Financiero -->
        <VCard class="pa-5 rounded-xl border elevation-0 bg-surface">
          <!-- Datos del Cliente, Vehículo y Ambiente SRI -->
          <div class="d-flex flex-column gap-2.5">
            <div class="d-flex justify-space-between align-center">
              <span class="text-caption font-weight-bold text-slate-600 text-uppercase tracking-wider">CLIENTE</span>
              <span class="text-body-1 font-weight-bold text-slate-900 text-right text-truncate ms-3" style="max-width: 420px;">
                {{ clientDisplayName }}
              </span>
            </div>

            <div v-if="client?.n_document" class="d-flex justify-space-between align-center">
              <span class="text-caption font-weight-bold text-slate-600 text-uppercase tracking-wider">RUC / CÉDULA</span>
              <span class="text-body-1 font-weight-bold text-slate-900 font-mono">
                {{ client.n_document }}
              </span>
            </div>

            <div v-if="vehicle" class="d-flex justify-space-between align-start gap-3">
              <span class="text-caption font-weight-bold text-slate-600 text-uppercase tracking-wider shrink-0 pt-0.5">VEHÍCULO</span>
              <span class="text-body-1 font-weight-bold text-slate-900 text-right">
                {{ vehicle.license_plate }} &bull; {{ getBrandNameById(vehicle.brand) }} {{ vehicle.model }}
              </span>
            </div>

            <div class="d-flex justify-space-between align-center">
              <span class="text-caption font-weight-bold text-slate-600 text-uppercase tracking-wider">AMBIENTE SRI</span>
              <VChip size="small" :color="sriEnvironmentInfo.isProd ? 'success' : 'warning'" variant="flat"
                class="font-weight-bold text-white px-3">
                <VIcon :icon="sriEnvironmentInfo.icon" size="14" class="me-1" />
                {{ sriEnvironmentInfo.text }}
              </VChip>
            </div>
          </div>

          <VDivider class="my-4" />

          <!-- Desglose Numérico con Gran Claridad y Alto Contraste -->
          <template v-if="hasAdvance">
            <!-- TOTAL A FACTURAR (SRI) -->
            <div class="d-flex justify-space-between align-center py-2 px-3 rounded-lg bg-blue-50/60 border border-blue-100 mb-2.5">
              <div>
                <div class="text-caption font-weight-bold text-primary text-uppercase d-flex align-center gap-1.5">
                  <VIcon icon="ri-file-shield-2-line" size="16" />
                  TOTAL A FACTURAR (SRI)
                </div>
                <div class="text-caption text-slate-600" style="font-size: 0.75rem;">
                  Monto oficial declarado en el comprobante electrónico
                </div>
              </div>
              <span class="text-h5 font-weight-black text-primary font-mono">
                ${{ Number(total || 0).toFixed(2) }}
              </span>
            </div>

            <!-- MENOS ANTICIPO APLICADO -->
            <div class="d-flex justify-space-between align-center py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 mb-2.5">
              <div>
                <div class="text-caption font-weight-bold text-emerald-900 d-flex align-center gap-1.5">
                  <VIcon icon="ri-hand-coin-line" size="16" color="success" />
                  MENOS ANTICIPO PREVIO EN OT #{{ sale?.work_order_number || '' }}
                </div>
                <div class="text-caption text-emerald-700" style="font-size: 0.75rem;">
                  Cobrado anteriormente &bull; No genera nuevo ingreso en caja
                </div>
              </div>
              <span class="text-h6 font-weight-black text-success font-mono">
                - ${{ effectiveAdvanceAmount.toFixed(2) }}
              </span>
            </div>

            <!-- SALDO A CANCELAR HOY -->
            <div class="d-flex justify-space-between align-center py-2.5 px-3 rounded-lg bg-slate-100 border border-slate-200">
              <div>
                <div class="text-subtitle-1 font-weight-black text-slate-900 text-uppercase">
                  SALDO A CANCELAR HOY
                </div>
                <div class="text-caption text-slate-600" style="font-size: 0.75rem;">
                  Dinero que ingresa hoy a tu Caja / Banco
                </div>
              </div>
              <span class="text-h5 font-weight-black text-slate-900 font-mono">
                ${{ balanceToCollect.toFixed(2) }}
              </span>
            </div>
          </template>

          <template v-else>
            <div class="d-flex justify-space-between align-center py-2 px-3 rounded-lg bg-blue-50/60 border border-blue-100">
              <div>
                <div class="text-caption font-weight-bold text-primary text-uppercase">
                  TOTAL A FACTURAR (SRI)
                </div>
                <div class="text-caption text-slate-600">
                  Monto oficial del comprobante electrónico
                </div>
              </div>
              <span class="text-h4 font-weight-black text-primary font-mono">
                ${{ Number(total || 0).toFixed(2) }}
              </span>
            </div>
          </template>
        </VCard>

        <!-- 3. Sección Forma de Pago del Saldo -->
        <VCard class="pa-5 rounded-xl border elevation-0 bg-surface">
          <!-- Cabecera de Forma de Pago -->
          <div class="d-flex justify-space-between align-center mb-4 pb-2.5 border-b">
            <div class="d-flex align-center gap-2">
              <VAvatar size="32" color="primary" variant="tonal" class="rounded-lg">
                <VIcon icon="ri-wallet-3-line" size="18" />
              </VAvatar>
              <div>
                <span class="text-subtitle-1 font-weight-bold text-slate-900">
                  {{ hasAdvance ? 'Método de Pago del Saldo Hoy' : 'Forma de Pago' }}
                </span>
                <span v-if="hasAdvance" class="text-caption font-weight-black text-primary font-mono ms-2">
                  (${{ balanceToCollect.toFixed(2) }})
                </span>
              </div>
            </div>

            <VBtn icon="ri-add-line" size="small" color="primary" variant="tonal" title="Dividir en otro método de pago"
              @click="addPaymentRow" />
          </div>

          <!-- Filas de Pago -->
          <div class="d-flex flex-column gap-3.5">
            <div v-for="(row, idx) in paymentList" :key="idx"
              :class="{ 'border-b pb-4 mb-2': idx < paymentList.length - 1 }">
              <div class="d-flex align-center gap-3">
                <VAvatar v-if="paymentList.length > 1" size="26" color="primary" variant="tonal"
                  class="text-caption font-weight-bold flex-shrink-0">
                  {{ idx + 1 }}
                </VAvatar>

                <!-- Botones Efectivo y Transferencia Amplios y Cómodos -->
                <div class="d-flex gap-2.5 flex-shrink-0">
                  <VBtn height="42" class="font-weight-bold text-body-2 text-none px-4"
                    :variant="row.payment_method === 'Efectivo' ? 'elevated' : 'outlined'"
                    :color="row.payment_method === 'Efectivo' ? 'success' : 'secondary'"
                    prepend-icon="ri-money-dollar-circle-line" @click="setRowMethod(row, 'Efectivo')">
                    Efectivo
                  </VBtn>

                  <VBtn height="42" class="font-weight-bold text-body-2 text-none px-4"
                    :variant="row.payment_method === 'Transferencia' ? 'elevated' : 'outlined'"
                    :color="row.payment_method === 'Transferencia' ? 'primary' : 'secondary'"
                    prepend-icon="ri-bank-line" @click="setRowMethod(row, 'Transferencia')">
                    Transferencia
                  </VBtn>
                </div>

                <!-- Input Monto Cómodo y Notorio -->
                <div class="ms-auto flex-shrink-0" style="width: 150px;">
                  <VTextField v-model="row.amount" type="text" inputmode="decimal" prefix="$"
                    placeholder="0.00" variant="outlined" density="comfortable" hide-details color="primary"
                    class="font-mono font-weight-bold text-body-1" @blur="formatRowAmountOnBlur(row)" />
                </div>

                <VBtn v-if="paymentList.length > 1" icon="ri-delete-bin-line" variant="text" size="small" color="error"
                  title="Eliminar este pago" class="flex-shrink-0" @click="removePaymentRow(idx)" />
              </div>

              <!-- Selector de Banco si es Transferencia -->
              <div v-if="row.payment_method === 'Transferencia'" class="mt-3">
                <VSelect v-model="row.account_id" :items="accounts" item-title="name" item-value="id"
                  placeholder="Seleccione banco de destino..." label="Cuenta Bancaria de Destino *"
                  variant="outlined" density="comfortable" color="primary" prepend-inner-icon="ri-bank-line"
                  hide-details="auto" class="font-weight-medium" :error="Boolean(validationError && !row.account_id)" />
              </div>
            </div>
          </div>

          <!-- Indicador de balance (solo si hay más de 1 pago) -->
          <div v-if="paymentList.length > 1" class="d-flex align-center justify-space-between mt-3 pt-2.5 border-t">
            <span class="text-caption font-weight-bold" :class="isBalanced ? 'text-success' : 'text-warning'">
              {{ isBalanced ? 'Monto completo distribuido' : (balanceDifference > 0 ? `Falta distribuir: $${balanceDifference.toFixed(2)}` : `Exceso: $${Math.abs(balanceDifference).toFixed(2)}`) }}
            </span>
            <VBtn v-if="!isBalanced" variant="text" color="primary" size="small"
              class="text-caption font-weight-bold text-none" @click="autoBalance">
              Ajustar restante
            </VBtn>
          </div>
        </VCard>

        <!-- Alerta de Validación (solo si existe error al confirmar) -->
        <VAlert v-if="validationError" type="error" variant="tonal" density="compact"
          class="rounded-lg text-caption font-weight-bold mb-0" icon="ri-error-warning-line">
          {{ validationError }}
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- 4. Footer Amplio y Sobrio -->
      <VCardActions class="pa-5 d-flex justify-end gap-3 bg-surface border-t">
        <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium text-none text-body-2" height="44" :disabled="isSubmitting" @click="closeDialog">
          Cancelar
        </VBtn>
        <VBtn color="primary" variant="elevated" prepend-icon="ri-check-line"
          class="rounded-lg px-7 font-weight-bold elevation-2 text-none text-body-1" height="44" :loading="isSubmitting" @click="onConfirm">
          Sí, Emitir Factura por ${{ Number(total || 0).toFixed(2) }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

