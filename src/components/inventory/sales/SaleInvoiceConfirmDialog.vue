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
  <VDialog :model-value="isDialogVisible" max-width="650px" persistent
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="invoice-confirm-card rounded-2xl overflow-hidden elevation-24 border">
      <!-- 1. Header Banner Ejecutivo & Sobrio (Adaptable a cada Tema) -->
      <div class="invoice-dialog-header custom-dialog-header-primary">
        <!-- Botón Cerrar Superior Derecho -->
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn header-close-btn"
          title="Cerrar ventana" :disabled="isSubmitting" @click="closeDialog" />

        <!-- Centro: Icono + Eyebrow + SRI Chip + Títulos -->
        <div class="d-flex flex-column align-center text-center px-4">
          <div class="custom-dialog-avatar header-avatar mb-3 shrink-0">
            <VIcon icon="ri-file-shield-2-line" size="24" color="white" />
          </div>

          <div class="d-flex align-center justify-center gap-2 flex-wrap mb-1.5">
            <span class="eyebrow-tag">
              Comprobante Electrónico SRI
            </span>
            <span class="sri-env-pill" :class="sriEnvironmentInfo.isProd ? 'env-prod' : 'env-test'">
              <VIcon :icon="sriEnvironmentInfo.icon" size="12" />
              <span>{{ sriEnvironmentInfo.text }}</span>
            </span>
          </div>

          <h2 class="custom-dialog-title header-title mb-1">
            ¿Estás seguro que deseas realizar esta "FACTURA"?
          </h2>
          <p class="custom-dialog-subtitle header-subtitle mb-0">
            Se emitirá el comprobante electrónico fiscal con autorización oficial del SRI.
          </p>
        </div>
      </div>

      <VCardText class="pa-6 d-flex flex-column gap-5 invoice-confirm-body"
        style="max-height: calc(88vh - 200px); overflow-y: auto;">
        <!-- 2. Tarjeta de Información: Cliente, RUC/Cédula, Vehículo y OT -->
        <div class="info-surface-card pa-4 rounded-xl border">
          <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b">
            <div class="d-flex align-center gap-2">
              <VIcon icon="ri-user-follow-line" size="18" color="primary" />
              <span class="text-subtitle-2 font-weight-bold card-heading">
                Datos del Comprobante
              </span>
            </div>
            <div v-if="sale?.work_order_number || sale?.work_order?.number"
              class="d-flex align-center gap-1 text-caption font-mono font-weight-bold text-primary px-2.5 py-0.5 rounded-md ot-tag-badge border">
              <VIcon icon="ri-tools-line" size="13" />
              <span>OT #{{ sale?.work_order_number || sale?.work_order?.number }}</span>
            </div>
          </div>

          <VRow dense class="gy-3">
            <!-- Cliente -->
            <VCol cols="12" :sm="client?.n_document ? 7 : 12">
              <div class="d-flex flex-column">
                <span class="text-caption font-weight-bold card-label text-uppercase tracking-wider">
                  Cliente / Razón Social
                </span>
                <div class="d-flex align-center gap-1.5 mt-0.5">
                  <VIcon icon="ri-user-3-line" size="16" class="text-medium-emphasis shrink-0" />
                  <span class="text-body-1 font-weight-bold card-value text-truncate" :title="clientDisplayName">
                    {{ clientDisplayName }}
                  </span>
                </div>
              </div>
            </VCol>

            <!-- RUC / Cédula (Alineado a la derecha debajo de la OT) -->
            <VCol v-if="client?.n_document" cols="12" sm="5" class="d-flex justify-sm-end text-sm-right">
              <div class="d-flex flex-column align-start align-sm-end">
                <span class="text-caption font-weight-bold card-label text-uppercase tracking-wider">
                  RUC / Cédula
                </span>
                <div class="d-flex align-center gap-1.5 mt-0.5">
                  <VIcon icon="ri-id-card-line" size="16" class="text-medium-emphasis shrink-0" />
                  <span class="text-body-1 font-mono font-weight-bold card-value">
                    {{ client.n_document }}
                  </span>
                </div>
              </div>
            </VCol>

            <!-- Vehículo Asociado: Modelo a la izquierda y Placa notoria a la derecha -->
            <VCol v-if="vehicle" cols="12" class="pt-2 border-t">
              <div class="d-flex flex-column">
                <span class="text-caption font-weight-bold card-label text-uppercase tracking-wider mb-1">
                  Vehículo Asociado
                </span>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <!-- Modelo del vehículo al lado izquierdo -->
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-car-line" size="18" class="text-primary shrink-0" />
                    <span v-if="vehicle.brand || vehicle.model" class="text-body-1 font-weight-bold card-value">
                      {{ getBrandNameById(vehicle.brand) || vehicle.brand }} {{ vehicle.model }}
                      <span v-if="vehicle.year" class="card-label font-weight-medium ms-1">({{ vehicle.year }})</span>
                    </span>
                  </div>

                  <!-- Placa al lado derecho con chip notorio y contrastante -->
                  <VChip color="primary" variant="flat" size="small"
                    class="font-mono font-weight-black px-3 text-body-2 elevation-1">
                    <VIcon icon="ri-bank-card-line" size="14" class="me-1.5" />
                    {{ vehicle.license_plate }}
                  </VChip>
                </div>
              </div>
            </VCol>
          </VRow>
        </div>

        <!-- 3. Desglose Financiero -->
        <div class="info-surface-card pa-4 rounded-xl border">
          <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b">
            <div class="d-flex align-center gap-2">
              <VIcon icon="ri-calculator-line" size="18" color="primary" />
              <span class="text-subtitle-2 font-weight-bold card-heading">
                Resumen de Liquidación
              </span>
            </div>
            <VChip size="small" :color="sriEnvironmentInfo.isProd ? 'success' : 'warning'" variant="flat"
              class="font-weight-bold text-white px-2.5">
              <VIcon :icon="sriEnvironmentInfo.icon" size="13" class="me-1" />
              {{ sriEnvironmentInfo.text }}
            </VChip>
          </div>

          <!-- Desglose Numérico con Gran Claridad y Alto Contraste -->
          <template v-if="hasAdvance">
            <div class="d-flex flex-column gap-2.5">
              <!-- TOTAL A FACTURAR (SRI) -->
              <div class="d-flex justify-space-between align-center py-2.5 px-4 rounded-lg summary-box-sri border">
                <div>
                  <div class="text-caption font-weight-bold text-primary text-uppercase d-flex align-center gap-1.5">
                    <VIcon icon="ri-file-shield-2-line" size="16" />
                    TOTAL A FACTURAR (SRI)
                  </div>
                  <div class="text-caption card-subtext" style="font-size: 0.78rem;">
                    Monto oficial declarado en el comprobante electrónico al SRI
                  </div>
                </div>
                <span class="text-h5 font-weight-bold text-primary font-mono">
                  ${{ Number(total || 0).toFixed(2) }}
                </span>
              </div>

              <!-- MENOS ANTICIPO APLICADO -->
              <div class="d-flex justify-space-between align-center py-2.5 px-4 rounded-lg summary-box-advance border">
                <div>
                  <div class="text-caption font-weight-bold text-success text-uppercase d-flex align-center gap-1.5">
                    <VIcon icon="ri-hand-coin-line" size="16" />
                    MENOS ANTICIPO PREVIO EN OT {{ sale?.work_order_number ? `#${sale.work_order_number}` : '' }}
                  </div>
                  <div class="text-caption card-subtext" style="font-size: 0.78rem;">
                    Cobrado anteriormente en la OT &bull; Ya registrado, no duplica ingreso
                  </div>
                </div>
                <span class="text-h5 font-weight-black text-success font-mono">
                  - ${{ effectiveAdvanceAmount.toFixed(2) }}
                </span>
              </div>

              <!-- SALDO A CANCELAR HOY -->
              <div class="d-flex justify-space-between align-center py-3 px-4 rounded-lg summary-box-balance border">
                <div>
                  <div class="text-subtitle-1 font-weight-black text-uppercase d-flex align-center gap-1.5 balance-title">
                    <VIcon icon="ri-hand-coin-line" size="18" color="primary" />
                    SALDO A CANCELAR HOY
                  </div>
                  <div class="text-caption card-subtext" style="font-size: 0.78rem;">
                    Dinero líquido que ingresa hoy a tu Caja / Banco
                  </div>
                </div>
                <span class="text-h4 font-weight-black balance-amount font-mono">
                  ${{ balanceToCollect.toFixed(2) }}
                </span>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="d-flex justify-space-between align-center py-3.5 px-4 rounded-lg summary-box-sri border">
              <div>
                <div class="text-caption font-weight-bold text-primary text-uppercase d-flex align-center gap-1.5">
                  <VIcon icon="ri-file-shield-2-line" size="18" />
                  TOTAL A FACTURAR (SRI)
                </div>
                <div class="text-caption card-subtext">
                  Monto oficial del comprobante electrónico con autorización del SRI
                </div>
              </div>
              <span class="text-h5 font-weight-bold text-primary font-mono">
                ${{ Number(total || 0).toFixed(2) }}
              </span>
            </div>
          </template>
        </div>

        <!-- 3. Sección Forma de Pago del Saldo -->
        <div class="info-surface-card pa-5 rounded-xl border">
          <!-- Cabecera de Forma de Pago -->
          <div class="d-flex justify-space-between align-center mb-4 pb-2.5 border-b">
            <div class="d-flex align-center gap-2">
              <VAvatar size="34" color="primary" variant="tonal" class="rounded-lg">
                <VIcon icon="ri-wallet-3-line" size="18" />
              </VAvatar>
              <div>
                <span class="text-subtitle-1 font-weight-bold card-heading">
                  {{ hasAdvance ? 'Método de Pago del Saldo Hoy' : 'Forma de Pago' }}
                </span>
                <span v-if="hasAdvance" class="text-caption font-weight-black text-primary font-mono ms-2">
                  (${{ balanceToCollect.toFixed(2) }})
                </span>
              </div>
            </div>

            <!-- Botón Dividir Pago más explicativo y elegante -->
            <VBtn size="small" variant="flat" color="primary" prepend-icon="ri-add-line"
              class="font-weight-bold text-caption text-none rounded-lg px-3" @click="addPaymentRow">
              Dividir Pago
            </VBtn>
          </div>

          <!-- Filas de Pago con Control Segmentado Moderno -->
          <div class="d-flex flex-column gap-3">
            <div v-for="(row, idx) in paymentList" :key="idx" class="payment-row-item pa-3 rounded-xl transition-all"
              :class="{ 'border bg-surface mb-2 shadow-xs': paymentList.length > 1 }">
              <div class="d-flex align-center justify-space-between flex-wrap gap-3">
                <!-- Selector Segmentado Efectivo / Transferencia -->
                <div class="d-flex align-center gap-2 flex-wrap">
                  <VAvatar v-if="paymentList.length > 1" size="16" color="primary" variant="tonal"
                    class="text-caption font-weight-black flex-shrink-0">
                    #{{ idx + 1 }}
                  </VAvatar>

                  <div class="payment-segmented-control">
                    <button type="button" class="payment-segment-btn"
                      :class="{ 'active active-cash': row.payment_method === 'Efectivo' }"
                      @click="setRowMethod(row, 'Efectivo')">
                      <VIcon icon="ri-money-dollar-circle-line" size="18" />
                      <span>Efectivo</span>
                    </button>

                    <button type="button" class="payment-segment-btn"
                      :class="{ 'active active-bank': row.payment_method === 'Transferencia' }"
                      @click="setRowMethod(row, 'Transferencia')">
                      <VIcon icon="ri-bank-line" size="18" />
                      <span>Transferencia</span>
                    </button>
                  </div>
                </div>

                <!-- Input Monto Cómodo, Alineado a la Derecha y Notorio -->
                <div class="d-flex align-center gap-2 ms-auto">
                  <div class="payment-amount-wrapper">
                    <VTextField v-model="row.amount" type="text" inputmode="decimal" prefix="$" placeholder="0.00"
                      variant="outlined" density="compact" hide-details color="primary" class="payment-amount-field"
                      @blur="formatRowAmountOnBlur(row)" />
                  </div>

                  <VBtn v-if="paymentList.length > 1" icon="ri-delete-bin-line" variant="tonal" size="small"
                    color="error" title="Eliminar este pago" class="rounded-lg flex-shrink-0"
                    @click="removePaymentRow(idx)" />
                </div>
              </div>

              <!-- Selector de Banco si es Transferencia -->
              <VExpandTransition>
                <div v-if="row.payment_method === 'Transferencia'" class="bank-select-card mt-3 pa-3 rounded-lg border">
                  <div class="d-flex align-center gap-1.5 mb-1.5">
                    <VIcon icon="ri-bank-card-line" size="15" color="primary" />
                    <span class="text-caption font-weight-bold text-primary text-uppercase tracking-wider">
                      Cuenta Bancaria de Destino *
                    </span>
                  </div>
                  <VSelect v-model="row.account_id" :items="accounts" item-title="name" item-value="id"
                    placeholder="Seleccione banco de destino..." variant="outlined" density="compact" color="primary"
                    prepend-inner-icon="ri-bank-line" hide-details="auto" class="bg-surface font-weight-medium"
                    :error="Boolean(validationError && !row.account_id)" />
                </div>
              </VExpandTransition>
            </div>
          </div>

          <!-- Indicador de balance (solo si hay más de 1 pago) -->
          <div v-if="paymentList.length > 1" class="d-flex align-center justify-space-between mt-3 pt-2.5 border-t">
            <span class="text-caption font-weight-bold" :class="isBalanced ? 'text-success' : 'text-warning'">
              {{ isBalanced ? '✓ Monto completo distribuido' : (balanceDifference > 0 ? `Falta distribuir:
              $${balanceDifference.toFixed(2)}` : `Exceso: $${Math.abs(balanceDifference).toFixed(2)}`) }}
            </span>
            <VBtn v-if="!isBalanced" variant="tonal" color="primary" size="small"
              class="text-caption font-weight-bold text-none rounded-lg" @click="autoBalance">
              Ajustar restante
            </VBtn>
          </div>
        </div>

        <!-- Alerta de Validación (solo si existe error al confirmar) -->
        <VAlert v-if="validationError" type="error" variant="tonal" density="compact"
          class="rounded-lg text-caption font-weight-bold mb-0" icon="ri-error-warning-line">
          {{ validationError }}
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- 4. Footer Amplio y Sobrio -->
      <VCardActions class="pa-5 d-flex justify-end gap-3 invoice-confirm-footer border-t">
        <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium text-none text-body-2" height="46" :disabled="isSubmitting"
          @click="closeDialog">
          Cancelar
        </VBtn>
        <VBtn color="primary" variant="elevated" prepend-icon="ri-check-line"
          class="rounded-lg px-7 font-weight-bold elevation-2 text-none text-body-1" height="46" :loading="isSubmitting"
          @click="onConfirm">
          Sí, Emitir Factura
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
