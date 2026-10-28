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

const initPaymentState = () => {
  validationError.value = ''

  // 1. Si ya venían pagos distribuidos del formulario principal
  if (props.paymentDistributions && props.paymentDistributions.length > 0) {
    paymentList.value = props.paymentDistributions.map(d => {
      const method = (d['payment_method'] === 'Efectivo' || d['payment_method'] === 'Transferencia')
        ? d['payment_method']
        : null

      return {
        'payment_method': method,
        'account_id': d['account_id'] || (method === 'Transferencia' ? getDefaultBankId() : (method === 'Efectivo' ? getDefaultCashId() : null)),
        'amount': Number(d['amount'] !== undefined && d['amount'] !== null && d['amount'] !== '' ? d['amount'] : (props.total || 0)).toFixed(2),
      }
    })

    return
  }

  // 2. Si venía un método único ya seleccionado en la venta
  const existingMethod = props.sale?.['payment_method'] || ''
  if (existingMethod === 'Transferencia') {
    paymentList.value = [{
      'payment_method': 'Transferencia',
      'account_id': props.sale?.['account_id'] || getDefaultBankId(),
      'amount': Number(props.total || 0).toFixed(2),
    }]

    return
  }

  if (existingMethod === 'Efectivo') {
    paymentList.value = [{
      'payment_method': 'Efectivo',
      'account_id': props.sale?.['account_id'] || getDefaultCashId(),
      'amount': Number(props.total || 0).toFixed(2),
    }]

    return
  }

  // 3. Si NO está establecida la forma de pago, NO preseleccionar Efectivo por defecto
  paymentList.value = [{
    'payment_method': null,
    'account_id': null,
    'amount': Number(props.total || 0).toFixed(2),
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
  const tot = Number(props.total || 0)

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

  const tot = Number(props.total || 0)
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

  // Si queda 1 sola fila, aseguramos que cubra el total
  if (paymentList.value.length === 1) {
    paymentList.value[0].amount = Number(props.total || 0).toFixed(2)
  }
}

const autoBalance = () => {
  if (paymentList.value.length === 0) return
  const lastIndex = paymentList.value.length - 1
  const sumOthers = paymentList.value.slice(0, lastIndex).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  paymentList.value[lastIndex].amount = Math.max(0, Number((Number(props.total || 0) - sumOthers).toFixed(2))).toFixed(2)
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

  // Si solo hay 1 fila, sincronizar su monto con el total
  if (paymentList.value.length === 1) {
    paymentList.value[0].amount = Number(props.total || 0).toFixed(2)
  } else if (!isBalanced.value) {
    if (balanceDifference.value > 0) {
      validationError.value = `Falta distribuir $${balanceDifference.value.toFixed(2)} del total de la factura ($${Number(props.total).toFixed(2)})`
    } else {
      validationError.value = `La suma de pagos excede el total por $${Math.abs(balanceDifference.value).toFixed(2)}`
    }

    return
  }

  const methods = [...new Set(paymentList.value.map(d => d['payment_method']).filter(Boolean))]

  emit('confirm', {
    'payment_method': methods.join(', '),
    'account_id': paymentList.value[0]?.['account_id'],
    'payment_distributions': paymentList.value.map(d => ({
      'account_id': d['account_id'],
      'amount': Number(parseFloat(d['amount']) || 0),
      'payment_method': d['payment_method'],
    })),
  })
}
</script>

<template>
  <VDialog :model-value="isDialogVisible" max-width="580px" persistent
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="custom-dialog-card rounded-xl overflow-hidden elevation-12">
      <!-- 1. Header Banner Primary Acorde al Sistema -->
      <div class="custom-dialog-header-primary pa-5 text-center position-relative">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn position-absolute"
          style="top: 12px; right: 12px; color: white;" :disabled="isSubmitting" @click="closeDialog" />
        <div class="custom-dialog-avatar mx-auto mb-2.5 d-flex align-center justify-center rounded-circle"
          style="width: 58px; height: 58px; background: rgba(255, 255, 255, 0.22); backdrop-filter: blur(8px); border: 1.5px solid rgba(255, 255, 255, 0.4);">
          <VIcon icon="ri-bill-line" size="32" color="white" />
        </div>
        <h3 class="custom-dialog-title text-h5 font-weight-bold text-white mb-1">
          ¿Estás seguro que deseas realizar esta "FACTURA"?
        </h3>
        <p class="custom-dialog-subtitle text-caption text-white opacity-90 mb-0">
          Se emitirá el comprobante electrónico fiscal con autorización oficial del SRI.
        </p>
      </div>

      <VCardText class="pa-5 bg-background d-flex flex-column gap-4">
        <!-- 2. Resumen de la Factura (Cliente, RUC, Ambiente SRI, Total) -->
        <VCard class="confirm-section-card pa-4 rounded-xl border elevation-0 bg-surface">
          <div class="confirm-detail-row d-flex justify-space-between align-center">
            <span class="text-caption text-medium-emphasis font-weight-bold text-uppercase">CLIENTE</span>
            <span class="text-body-2 font-weight-bold text-high-emphasis text-right text-truncate ms-2"
              style="max-width: 330px;">
              {{ clientDisplayName }}
            </span>
          </div>

          <div v-if="client?.n_document" class="confirm-detail-row d-flex justify-space-between align-center">
            <span class="text-caption text-medium-emphasis font-weight-bold text-uppercase">RUC / CÉDULA</span>
            <span class="text-body-2 font-weight-bold text-primary font-mono">
              {{ client.n_document }}
            </span>
          </div>

          <div v-if="vehicle" class="confirm-detail-row d-flex justify-space-between align-start gap-2">
            <span class="text-caption text-medium-emphasis font-weight-bold text-uppercase shrink-0 pt-0.5">VEHÍCULO</span>
            <span class="text-body-2 font-weight-semibold text-high-emphasis text-right">
              {{ vehicle.license_plate }} ({{ getBrandNameById(vehicle.brand) }} {{ vehicle.model }})
            </span>
          </div>

          <div class="confirm-detail-row d-flex justify-space-between align-center">
            <span class="text-caption text-medium-emphasis font-weight-bold text-uppercase">AMBIENTE SRI</span>
            <VChip size="small" :color="sriEnvironmentInfo.isProd ? 'success' : 'warning'" variant="flat"
              class="font-weight-bold text-white px-3">
              <VIcon :icon="sriEnvironmentInfo.icon" size="14" class="me-1" />
              {{ sriEnvironmentInfo.text }}
            </VChip>
          </div>

          <div class="confirm-total-row d-flex justify-space-between align-center pt-3.5 pb-1">
            <span class="text-subtitle-1 font-weight-bold text-high-emphasis">TOTAL A FACTURAR</span>
            <span class="text-h5 font-weight-black text-primary font-mono">
              ${{ Number(total || 0).toFixed(2) }}
            </span>
          </div>
        </VCard>

        <!-- 3. Sección Forma de Pago -->
        <VCard class="confirm-section-card pa-4 rounded-xl border elevation-0 bg-surface">
          <!-- Cabecera con solo el signo de MÁS en la esquina superior derecha -->
          <div class="d-flex justify-space-between align-center mb-3.5 pb-3 border-b">
            <div class="d-flex align-center gap-2">
              <VIcon icon="ri-wallet-3-line" size="20" color="primary" />
              <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                Forma de Pago
              </span>
            </div>

            <!-- Botón solo con signo de MÁS (+) -->
            <VBtn icon="ri-add-line" size="small" color="primary" variant="tonal" title="Agregar otro método de pago"
              @click="addPaymentRow" />
          </div>

          <!-- Filas de pago con layout en línea y sin distorsión -->
          <div class="d-flex flex-column">
            <div v-for="(row, idx) in paymentList" :key="idx"
              :class="{ 'border-b pb-4 mb-4': idx < paymentList.length - 1 }">
              <!-- Fila principal de controles -->
              <div class="d-flex align-center gap-2.5">
                <!-- Badge número de pago (solo si hay más de 1) -->
                <VAvatar v-if="paymentList.length > 1" size="24" color="primary" variant="tonal"
                  class="text-caption font-weight-bold flex-shrink-0">
                  {{ idx + 1 }}
                </VAvatar>

                <!-- Botones Efectivo y Transferencia -->
                <div class="d-flex gap-2 flex-shrink-0">
                  <VBtn height="36" class="font-weight-semibold text-caption text-none px-3"
                    :variant="row.payment_method === 'Efectivo' ? 'elevated' : 'outlined'"
                    :color="row.payment_method === 'Efectivo' ? 'success' : 'secondary'"
                    prepend-icon="ri-money-dollar-circle-line" @click="setRowMethod(row, 'Efectivo')">
                    Efectivo
                  </VBtn>

                  <VBtn height="36" class="font-weight-semibold text-caption text-none px-3"
                    :variant="row.payment_method === 'Transferencia' ? 'elevated' : 'outlined'"
                    :color="row.payment_method === 'Transferencia' ? 'primary' : 'secondary'"
                    prepend-icon="ri-bank-line" @click="setRowMethod(row, 'Transferencia')">
                    Transferencia
                  </VBtn>
                </div>

                <!-- Input Monto alineado a la derecha con formato decimal -->
                <div class="ms-auto flex-shrink-0" style="width: 130px;">
                  <VTextField v-model="row.amount" type="text" inputmode="decimal" prefix="$"
                    placeholder="0.00" variant="outlined" density="compact" hide-details color="primary"
                    class="font-mono font-weight-bold" @blur="formatRowAmountOnBlur(row)" />
                </div>

                <!-- Botón Eliminar Pago inline -->
                <VBtn v-if="paymentList.length > 1" icon="ri-delete-bin-line" variant="text" size="small" color="error"
                  title="Eliminar este pago" class="flex-shrink-0" @click="removePaymentRow(idx)" />
              </div>

              <!-- Indicador de aviso cuando aún no se ha seleccionado la forma de pago -->
              <div v-if="!row.payment_method" class="mt-2 text-caption d-flex align-center gap-1.5" style="color: #d97706;">
                <VIcon icon="ri-error-warning-line" size="14" color="warning" />
                <span>Seleccione si el pago es en Efectivo o Transferencia</span>
              </div>

              <!-- Selector de Banco si es Transferencia con espacio amplio para la etiqueta -->
              <div v-if="row.payment_method === 'Transferencia'" class="mt-4 pt-1">
                <VSelect v-model="row.account_id" :items="accounts" item-title="name" item-value="id"
                  placeholder="Seleccione cuenta bancaria de destino..." label="Cuenta Bancaria de Destino *"
                  variant="outlined" density="compact" color="primary" prepend-inner-icon="ri-bank-line"
                  hide-details="auto" class="font-weight-medium" :error="Boolean(validationError && !row.account_id)" />
              </div>
            </div>
          </div>

          <!-- Indicador de balance (solo si hay más de 1 pago) -->
          <div v-if="paymentList.length > 1" class="d-flex align-center justify-space-between mt-3 pt-2.5 border-t">
            <div class="d-flex align-center gap-1.5">
              <VIcon :icon="isBalanced ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'" size="16"
                :color="isBalanced ? 'success' : 'warning'" />
              <span class="text-caption font-weight-bold" :class="isBalanced ? 'text-success' : 'text-warning'">
                {{ isBalanced ? 'Monto completo distribuido' : (balanceDifference > 0 ? `Falta distribuir:
                $${balanceDifference.toFixed(2)}` : `Exceso: $${Math.abs(balanceDifference).toFixed(2)}`) }}
              </span>
            </div>

            <VBtn v-if="!isBalanced" variant="text" color="primary" size="x-small"
              class="text-caption font-weight-bold text-none" @click="autoBalance">
              Ajustar saldo restante
            </VBtn>
          </div>
        </VCard>

        <!-- Alerta de Validación -->
        <VAlert v-if="validationError" type="error" variant="tonal" density="comfortable"
          class="rounded-lg text-body-2 font-weight-semibold" icon="ri-error-warning-line">
          {{ validationError }}
        </VAlert>

        <!-- 4. Alerta de Ambiente SRI Oficial -->
        <VAlert :type="sriEnvironmentInfo.isProd ? 'warning' : 'info'" variant="tonal" density="compact"
          class="rounded-lg mb-0 text-caption font-weight-medium" :icon="sriEnvironmentInfo.icon">
          <strong>Ambiente SRI: {{ sriEnvironmentInfo.text }}</strong> — {{ sriEnvironmentInfo.desc }}
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- 5. Acciones del Footer del Sistema -->
      <VCardActions class="pa-4 d-flex justify-end gap-3 bg-surface">
        <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium" height="42" :disabled="isSubmitting" @click="closeDialog">
          Cancelar
        </VBtn>
        <VBtn color="primary" variant="elevated" prepend-icon="ri-check-line"
          class="rounded-lg px-6 font-weight-bold elevation-2" height="42" :loading="isSubmitting" @click="onConfirm">
          Sí, emitir factura
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

