<script setup>
import { computed } from 'vue'
import { getBrandNameById } from '@/data/vehicleBrands.js'

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

const sriEnvironmentInfo = computed(() => {
  const isProd = String(props.sriEnvironment) === '2'
  return {
    isProd,
    type: isProd ? '2' : '1',
    text: isProd ? 'PRODUCCIÓN' : 'PRUEBAS',
    color: isProd ? 'success' : 'warning',
    icon: isProd ? 'ri-shield-check-line' : 'ri-test-tube-line',
    desc: isProd
      ? 'Ambiente Oficial de Producción del SRI (con validez tributaria real).'
      : 'Ambiente de Pruebas y Certificación del SRI (sin validez tributaria).',
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

const computedPaymentMethodSummary = computed(() => {
  if (props.sale?.payment_status === 'pending' || props.sale?.is_credited) {
    return 'Crédito / Pendiente'
  }
  if (props.paymentDistributions && props.paymentDistributions.length > 0) {
    const summaryList = props.paymentDistributions.map(d => {
      if (!d.payment_method) return 'Sin seleccionar'
      if (d.payment_method === 'Transferencia' && d.account_id) {
        const acc = props.accounts.find(a => a.id === d.account_id)
        return acc ? `Transferencia — ${acc.name}` : 'Transferencia'
      }
      return d.payment_method
    })
    const unique = [...new Set(summaryList)]
    return unique.join(', ')
  }
  return props.sale?.payment_method || 'Sin seleccionar'
})

const closeDialog = () => {
  if (props.isSubmitting) return
  emit('update:isDialogVisible', false)
}

const onConfirm = () => {
  emit('confirm')
}
</script>

<template>
  <VDialog :model-value="isDialogVisible" max-width="540px" persistent
    @update:model-value="val => emit('update:isDialogVisible', val)">
    <VCard class="custom-dialog-card rounded-xl overflow-hidden elevation-10">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary pa-5 text-center position-relative"
        style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: white;">
        <VBtn icon="ri-close-line" variant="text" size="small" class="custom-dialog-close-btn position-absolute"
          style="top: 12px; right: 12px; color: white;" :disabled="isSubmitting" @click="closeDialog" />
        <div class="mx-auto mb-3 d-flex align-center justify-center rounded-circle"
          style="width: 64px; height: 64px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px);">
          <VIcon icon="ri-bill-line" size="36" color="white" />
        </div>
        <h3 class="text-h5 font-weight-bold text-white mb-1">
          ¿Estás seguro que deseas realizar esta "FACTURA"?
        </h3>
        <p class="text-caption text-white opacity-90 mb-0">
          Se emitirá el comprobante electrónico fiscal con autorización ante el SRI.
        </p>
      </div>

      <VCardText class="pa-5 bg-grey-lighten-5">
        <!-- Resumen de Factura -->
        <VCard class="pa-4 rounded-lg border border-light elevation-0 mb-4 bg-white">
          <div class="d-flex justify-space-between align-center pb-2 border-b mb-3">
            <span class="text-caption text-medium-emphasis font-weight-medium">CLIENTE</span>
            <span class="text-body-2 font-weight-bold text-grey-darken-4 text-right">
              {{ clientDisplayName }}
            </span>
          </div>

          <div v-if="client?.n_document" class="d-flex justify-space-between align-center pb-2 border-b mb-3">
            <span class="text-caption text-medium-emphasis font-weight-medium">RUC / CÉDULA</span>
            <span class="text-body-2 font-weight-semibold text-primary">
              {{ client.n_document }}
            </span>
          </div>

          <div v-if="vehicle" class="d-flex justify-space-between align-center pb-2 border-b mb-3">
            <span class="text-caption text-medium-emphasis font-weight-medium">VEHÍCULO</span>
            <span class="text-body-2 font-weight-semibold text-grey-darken-3">
              {{ vehicle.license_plate }} ({{ getBrandNameById(vehicle.brand) }} {{ vehicle.model }})
            </span>
          </div>

          <div class="d-flex justify-space-between align-center pb-2 border-b mb-3">
            <span class="text-caption text-medium-emphasis font-weight-medium">AMBIENTE SRI</span>
            <VChip :color="sriEnvironmentInfo.color" size="small" variant="flat" class="font-weight-bold px-2.5">
              <VIcon :icon="sriEnvironmentInfo.icon" size="14" class="me-1" />
              {{ sriEnvironmentInfo.text }}
            </VChip>
          </div>

          <!-- Tipo de Pago Simple (1 método o Crédito) -->
          <div v-if="paymentDistributions.length <= 1 || sale?.payment_status === 'pending'"
            class="d-flex justify-space-between align-center pb-2 border-b mb-3">
            <span class="text-caption text-medium-emphasis font-weight-medium">TIPO DE PAGO</span>
            <VChip
              :color="sale?.payment_status === 'pending' ? 'warning' : (paymentDistributions[0]?.payment_method === 'Transferencia' ? 'info' : 'success')"
              size="small" variant="flat" class="font-weight-bold px-2.5">
              <VIcon
                :icon="sale?.payment_status === 'pending' ? 'ri-time-line' : (paymentDistributions[0]?.payment_method === 'Transferencia' ? 'ri-bank-line' : 'ri-money-dollar-circle-line')"
                size="14" class="me-1" />
              {{ computedPaymentMethodSummary }}
            </VChip>
          </div>

          <!-- Desglose de Pagos Múltiples (solo si está dividido en 2 o más métodos) -->
          <div v-else class="d-flex flex-column pb-2 border-b mb-3">
            <div class="d-flex justify-space-between align-center mb-1.5">
              <span class="text-caption text-medium-emphasis font-weight-medium">FORMA DE PAGO</span>
              <VChip color="primary" size="small" variant="tonal" class="font-weight-bold px-2">
                <VIcon icon="ri-split-cells-horizontal" size="14" class="me-1" />
                Pago Dividido ({{ paymentDistributions.length }})
              </VChip>
            </div>

            <div class="bg-slate-50 pa-2.5 rounded-lg border">
              <div v-for="(pd, i) in paymentDistributions" :key="i"
                class="d-flex justify-space-between align-center text-caption py-0.5"
                :class="{ 'border-b pb-1 mb-1': i < paymentDistributions.length - 1 }">
                <div class="d-flex align-center gap-1.5">
                  <VIcon :icon="pd.payment_method === 'Transferencia' ? 'ri-bank-line' : 'ri-money-dollar-circle-line'"
                    size="15" :color="pd.payment_method === 'Transferencia' ? 'info' : 'success'" />
                  <span class="font-weight-bold text-slate-800">{{ pd.payment_method || 'Sin método' }}</span>
                  <span v-if="pd.payment_method === 'Transferencia' && pd.account_id"
                    class="text-info font-weight-medium">
                    — {{accounts.find(a => a.id === pd.account_id)?.name || 'Banco'}}
                  </span>
                </div>
                <span class="font-mono font-weight-bold text-slate-900">${{ Number(pd.amount || 0).toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <div class="d-flex justify-space-between align-center pt-1">
            <span class="text-subtitle-1 font-weight-bold text-grey-darken-3">TOTAL A FACTURAR</span>
            <span class="text-h5 font-weight-black text-primary">
              ${{ Number(total || 0).toFixed(2) }}
            </span>
          </div>
        </VCard>

        <VAlert :type="sriEnvironmentInfo.isProd ? 'warning' : 'info'" variant="tonal" density="compact"
          class="rounded-lg mb-0 text-caption font-weight-medium" :icon="sriEnvironmentInfo.icon">
          <strong>Ambiente SRI: {{ sriEnvironmentInfo.text }}</strong> — {{ sriEnvironmentInfo.desc }}
        </VAlert>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 d-flex justify-end gap-3 bg-white">
        <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line" :disabled="isSubmitting"
          @click="closeDialog">
          Cancelar
        </VBtn>
        <VBtn color="primary" variant="elevated" prepend-icon="ri-check-line" :loading="isSubmitting" size="large"
          class="px-5 font-weight-bold" @click="onConfirm">
          Sí, emitir factura
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
