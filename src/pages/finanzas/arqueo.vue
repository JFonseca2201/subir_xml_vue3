<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const router = useRouter()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

// List of denominations
const billsList = [100, 50, 20, 10, 5, 1]
const coinsList = ['1.00', '0.50', '0.25', '0.10', '0.05', '0.01']

// Active document loading state
const loading = ref(false)
const saving = ref(false)
const sealing = ref(false)
const confirmSealDialog = ref(false)

// Display details
const dateFormatted = ref('')
const alreadyCounted = ref(false)
const isSealed = ref(false)
const prevCountDetailsDialog = ref(false)

const initialBalances = ref({
  cash: 0,
  pichincha: 0,
  guayaquil: 0,
  total: 0,
  origin_date: null,
  cash_details: null,
})

// Live system balances for comparison
const systemBalances = ref({
  cash: 0,
  pichincha: 0,
  guayaquil: 0,
})

import { usePermissions } from '@/composables/usePermissions'

const { can } = usePermissions()
const canAccessArqueo = computed(() => can('list_arqueo'))

// Main reactive payload
const getLocalDateString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000

  return new Date(Date.now() - tzOffset).toISOString().split('T')[0]
}

const payload = ref({
  count_date: getLocalDateString(),
  pichincha_total: 0.00,
  guayaquil_total: 0.00,
  cash_details: {
    bills: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
    },
    coins: {
      '1.00': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0,
    },
  },
  observations: '',
})

const totalBills = computed(() => {
  return billsList.reduce((sum, val) => {
    const qty = parseInt(payload.value.cash_details.bills[val]) || 0

    return sum + (val * qty)
  }, 0)
})

const totalCoins = computed(() => {
  return coinsList.reduce((sum, val) => {
    const qty = parseInt(payload.value.cash_details.coins[val]) || 0

    return sum + (parseFloat(val) * qty)
  }, 0)
})

const totalCash = computed(() => {
  return totalBills.value + totalCoins.value
})

const pichinchaVal = computed({
  get: () => payload.value.pichincha_total,
  set: val => { payload.value.pichincha_total = parseFloat(val) || 0 },
})

const guayaquilVal = computed({
  get: () => payload.value.guayaquil_total,
  set: val => { payload.value.guayaquil_total = parseFloat(val) || 0 },
})

const grandTotal = computed(() => {
  return totalCash.value + (parseFloat(payload.value.pichincha_total) || 0) + (parseFloat(payload.value.guayaquil_total) || 0)
})

// Differences vs. live system balances
const cashDifference = computed(() => {
  return totalCash.value - systemBalances.value.cash
})

const pichinchaDifference = computed(() => {
  return (parseFloat(payload.value.pichincha_total) || 0) - systemBalances.value.pichincha
})

const guayaquilDifference = computed(() => {
  return (parseFloat(payload.value.guayaquil_total) || 0) - systemBalances.value.guayaquil
})

const totalDifferenceSystem = computed(() => {
  const systemTotal = systemBalances.value.cash + systemBalances.value.pichincha + systemBalances.value.guayaquil

  return grandTotal.value - systemTotal
})

// Total difference vs. previous close (carry-over check)
const totalDifference = computed(() => {
  return grandTotal.value - initialBalances.value.total
})

// Currency formatter
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Format date strictly in Spanish
const formatSpanishDate = dateStr => {
  if (!dateStr) return ''
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)

    const formatted = new Intl.DateTimeFormat('es-EC', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dt)

    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch (e) {
    return dateStr
  }
}

// Fetch daily status from Laravel API
const fetchStatus = async date => {
  loading.value = true
  try {
    const response = await $api('daily-cash-counts/status', {
      params: { date },
    })

    console.log('Daily cash count status response:', response)

    if (response.success) {
      dateFormatted.value = formatSpanishDate(date) || response.date_formatted || ''
      alreadyCounted.value = response.already_counted || false
      isSealed.value = response.is_sealed || false

      if (response.initial_balances) {
        initialBalances.value = {
          cash: parseFloat(response.initial_balances.cash) || 0,
          pichincha: parseFloat(response.initial_balances.pichincha) || 0,
          guayaquil: parseFloat(response.initial_balances.guayaquil) || 0,
          total: parseFloat(response.initial_balances.total) || 0,
          origin_date: response.initial_balances.origin_date || null,
          cash_details: response.initial_balances.cash_details || null,
        }
      }

      if (response.system_balances) {
        systemBalances.value = {
          cash: parseFloat(response.system_balances.cash) || 0,
          pichincha: parseFloat(response.system_balances.pichincha) || 0,
          guayaquil: parseFloat(response.system_balances.guayaquil) || 0,
        }
      }

      // Populate form if there's already counted data for selected date
      if (response.already_counted && response.current_data) {
        const data = response.current_data

        payload.value.pichincha_total = parseFloat(data.pichincha_total) || 0
        payload.value.guayaquil_total = parseFloat(data.guayaquil_total) || 0
        payload.value.observations = data.observations || ''

        if (data.cash_details) {
          const details = data.cash_details
          if (details.bills) {
            billsList.forEach(b => {
              payload.value.cash_details.bills[b] = parseInt(details.bills[b]) || 0
            })
          }
          if (details.coins) {
            coinsList.forEach(c => {
              payload.value.cash_details.coins[c] = parseInt(details.coins[c]) || 0
            })
          }
        }
      } else {
        // Reset inputs to 0
        payload.value.pichincha_total = 0
        payload.value.guayaquil_total = 0
        payload.value.observations = ''
        billsList.forEach(b => {
          payload.value.cash_details.bills[b] = 0
        })
        coinsList.forEach(c => {
          payload.value.cash_details.coins[c] = 0
        })
      }
    }
  } catch (error) {
    console.error('Error fetching cash count status:', error)
    showNotification('Error al cargar la información del arqueo diario.', 'error')
  } finally {
    loading.value = false
  }
}

// Save cash counts
const saveArqueo = async () => {
  saving.value = true
  try {
    const response = await $api('daily-cash-counts/save', {
      method: 'POST',
      body: {
        count_date: payload.value.count_date,
        pichincha_total: parseFloat(payload.value.pichincha_total) || 0,
        guayaquil_total: parseFloat(payload.value.guayaquil_total) || 0,
        cash_details: payload.value.cash_details,
        observations: payload.value.observations,
      },
    })

    console.log(response)


    if (response.success) {
      showNotification(response.message || 'Arqueo de caja diario guardado con éxito.', 'success')
      await fetchStatus(payload.value.count_date)
    } else {
      showNotification(response.message || 'Error al procesar el arqueo de caja.', 'error')
    }
  } catch (error) {
    console.error('Error saving daily cash count:', error)

    const apiError = error?.response?.data?.message || 'Error al guardar el arqueo de caja diario.'

    showNotification(apiError, 'error')
  } finally {
    saving.value = false
  }
}

const sealDay = async () => {
  sealing.value = true
  try {
    const response = await $api('daily-cash-counts/seal', {
      method: 'POST',
      body: {
        count_date: payload.value.count_date,
      },
    })

    if (response && response.success) {
      showNotification(response.message || 'Día sellado correctamente.', 'success')
      await fetchStatus(payload.value.count_date)
    } else {
      showNotification(response?.message || 'Error al sellar el día.', 'error')
    }
  } catch (error) {
    console.error('Error sealing day:', error)
    showNotification('Error al sellar el día.', 'error')
  } finally {
    sealing.value = false
  }
}

const confirmSeal = async () => {
  // Close dialog and run the sealing action
  confirmSealDialog.value = false
  await sealDay()
}

// Watch date changes to reload data
watch(() => payload.value.count_date, newDate => {
  if (newDate) {
    fetchStatus(newDate)
  }
})

// Helper functions to get previous counts safely
const getPrevBillQty = denom => {
  return initialBalances.value.cash_details?.bills?.[denom] ?? 0
}

const getPrevCoinQty = denom => {
  return initialBalances.value.cash_details?.coins?.[denom] ?? 0
}

// Initialize
onMounted(() => {
  if (canAccessArqueo.value) {
    fetchStatus(payload.value.count_date)
  }
})
</script>

<template>
  <div class="arqueo-container pa-4 pa-sm-6 position-relative">
    <VProgressLinear
      v-if="loading"
      indeterminate
      color="primary"
      height="3"
      class="position-absolute"
      style="top: 0; left: 0; right: 0; z-index: 99;"
    />

    <!-- Pantalla de Bloqueo por Permisos -->
    <div
      v-if="!canAccessArqueo"
      class="d-flex justify-center align-center"
      style="height: 450px"
    >
      <VCard
        class="pa-8 text-center rounded-xl border-thin"
        elevation="8"
        max-width="450"
      >
        <VIcon
          size="64"
          color="primary"
          class="mb-4"
        >
          ri-lock-line
        </VIcon>
        <h3 class="text-h5 mb-2 font-weight-bold">
          Acceso Restringido
        </h3>
        <p class="text-body-1 text-medium-emphasis mb-6">
          Tu rol no cuenta con los permisos necesarios para realizar el
          arqueo de caja diario.
        </p>
        <VBtn
          color="primary"
          class="text-none font-weight-bold"
          prepend-icon="ri-arrow-left-line"
          @click="router.push('/dashboard')"
        >
          Volver al Dashboard
        </VBtn>
      </VCard>
    </div>

    <!-- Contenido Principal -->
    <div v-else>
      <!-- Header Principal Sticky -->
      <VCard class="mb-6 rounded-xl border-light pa-3 pa-sm-4 elevation-1 sticky-header">
        <div class="d-flex align-center justify-space-between flex-wrap gap-4">
          <div class="d-flex align-center gap-3">
            <VAvatar
              color="primary"
              variant="tonal"
              rounded="lg"
              size="44"
              class="elevation-1"
            >
              <VIcon
                icon="ri-safe-2-line"
                size="24"
              />
            </VAvatar>
            <div>
              <div class="d-flex align-center gap-2 flex-wrap">
                <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                  Caja Diaria & Conciliación
                </h1>
                <div
                  v-if="isSealed"
                  class="status-pill-clean status-pending"
                >
                  <span class="status-dot" />
                  <span>DÍA SELLADO (SOLO LECTURA)</span>
                </div>
                <div
                  v-else-if="alreadyCounted"
                  class="status-pill-clean status-paid"
                >
                  <span class="status-dot" />
                  <span>REGISTRADO (EDICIÓN)</span>
                </div>
                <div
                  v-else
                  class="status-pill-clean status-partial"
                >
                  <span class="status-dot" />
                  <span>PENDIENTE POR ARCHIVAR</span>
                </div>
              </div>
              <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
                Cierre diario de control físico de dinero y conciliación bancaria
              </p>
            </div>
          </div>

          <div class="d-flex align-center gap-3">
            <div class="d-flex align-center gap-2 bg-white px-3 py-1.5 rounded-lg border">
              <VIcon icon="ri-calendar-event-line" color="primary" size="18" />
              <span class="text-caption font-weight-bold text-slate-700 text-uppercase d-none d-sm-inline">Fecha de Corte:</span>
              <input
                v-model="payload.count_date"
                type="date"
                class="custom-date-input border-0 pa-0 font-weight-bold"
                :disabled="saving || loading"
              >
            </div>
          </div>
        </div>
      </VCard>

      <!-- Banner Informativo de Fecha -->
      <VCard
        v-if="dateFormatted"
        class="pa-4 mb-5 rounded-xl bg-primary-tonal border-primary elevation-0 d-flex justify-space-between align-center flex-wrap gap-3"
      >
        <div class="d-flex align-center gap-2">
          <VIcon icon="ri-calendar-check-line" color="primary" size="22" />
          <span class="text-subtitle-1 font-weight-bold text-slate-900 capitalize-first">{{ dateFormatted }}</span>
        </div>
        <div class="text-caption text-primary font-weight-semibold">
          Control diario de efectivo y cuentas
        </div>
      </VCard>

      <!-- Fila 1: Comparativa de Saldos (8 cols) + Resumen de Cuadre (4 cols) -->
      <VRow class="mb-6">
        <!-- Columna Izquierda (8 cols): Comparativa Estructurada -->
        <VCol cols="12" md="8">
          <VCard elevation="1" class="rounded-xl border-light h-100 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-2">
                    <VAvatar color="primary" variant="tonal" size="32" class="rounded-lg">
                      <VIcon icon="ri-scales-3-line" size="18" />
                    </VAvatar>
                    <span class="text-subtitle-1 font-weight-bold text-slate-900">
                      Comparativa de Saldos
                    </span>
                  </div>
                  <div
                    v-if="initialBalances.origin_date"
                    class="status-pill-clean status-transfer"
                  >
                    <span class="status-dot" />
                    <span>Arrastre del cierre: {{ initialBalances.origin_date }}</span>
                  </div>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-0">
              <VTable hover class="arqueo-summary-table">
                <thead>
                  <tr class="bg-slate-50 text-caption font-weight-bold">
                    <th class="py-3 px-4 text-left font-weight-bold text-slate-700" style="width: 28%;">
                      CUENTA / CAJA
                    </th>
                    <th class="py-3 px-3 text-center font-weight-bold text-primary" style="width: 24%;">
                      <div class="d-flex align-center justify-center gap-1">
                        <VIcon size="16">
                          ri-history-line
                        </VIcon>
                        <span>SALDO INICIAL</span>
                      </div>
                      <div class="text-caption text-slate-500 font-weight-regular text-none" style="font-size: 0.72rem !important;">
                        (Arrastre día anterior)
                      </div>
                    </th>
                    <th class="py-3 px-3 text-center font-weight-bold text-indigo" style="width: 24%;">
                      <div class="d-flex align-center justify-center gap-1">
                        <VIcon size="16">
                          ri-bank-card-line
                        </VIcon>
                        <span>SALDO EN SISTEMA</span>
                      </div>
                      <div class="text-caption text-slate-500 font-weight-regular text-none" style="font-size: 0.72rem !important;">
                        (Movimientos en Cartera)
                      </div>
                    </th>
                    <th class="py-3 px-3 text-center font-weight-bold text-success" style="width: 24%;">
                      <div class="d-flex align-center justify-center gap-1">
                        <VIcon size="16">
                          ri-hand-coin-line
                        </VIcon>
                        <span>CONTEO DE HOY</span>
                      </div>
                      <div class="text-caption text-slate-500 font-weight-regular text-none" style="font-size: 0.72rem !important;">
                        (Arqueo físico ingresado)
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Fila 1: Efectivo -->
                  <tr>
                    <td class="py-3 px-4">
                      <div class="d-flex align-center gap-3">
                        <VAvatar
                          color="success"
                          variant="tonal"
                          size="36"
                          class="rounded-lg"
                        >
                          <VIcon icon="ri-money-dollar-circle-line" size="20" />
                        </VAvatar>
                        <div>
                          <div class="font-weight-bold text-body-2 text-slate-900">
                            Efectivo Físico
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            Caja Chica Principal
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-bold font-mono text-body-1 text-slate-800">
                        {{ formatCurrency(initialBalances.cash) }}
                      </div>
                      <VBtn
                        v-if="initialBalances.origin_date"
                        variant="text"
                        color="primary"
                        size="x-small"
                        class="px-1 text-none font-weight-semibold"
                        prepend-icon="ri-history-line"
                        @click="prevCountDetailsDialog = true"
                      >
                        Ver billetes
                      </VBtn>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-bold font-mono text-body-1 text-indigo">
                        {{ formatCurrency(systemBalances.cash) }}
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-black font-mono text-body-1 text-success">
                        {{ formatCurrency(totalCash) }}
                      </div>
                    </td>
                  </tr>

                  <!-- Fila 2: Banco Pichincha -->
                  <tr>
                    <td class="py-3 px-4">
                      <div class="d-flex align-center gap-3">
                        <VAvatar
                          color="warning"
                          variant="tonal"
                          size="36"
                          class="rounded-lg"
                        >
                          <VIcon icon="ri-bank-line" size="20" />
                        </VAvatar>
                        <div>
                          <div class="font-weight-bold text-body-2 text-slate-900">
                            Banco Pichincha
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            Cuenta de Ahorros
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-bold font-mono text-body-1 text-slate-800">
                        {{ formatCurrency(initialBalances.pichincha) }}
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-bold font-mono text-body-1 text-indigo">
                        {{ formatCurrency(systemBalances.pichincha) }}
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-black font-mono text-body-1 text-success">
                        {{ formatCurrency(payload.pichincha_total) }}
                      </div>
                    </td>
                  </tr>

                  <!-- Fila 3: Banco Guayaquil -->
                  <tr>
                    <td class="py-3 px-4">
                      <div class="d-flex align-center gap-3">
                        <VAvatar
                          color="primary"
                          variant="tonal"
                          size="36"
                          class="rounded-lg"
                        >
                          <VIcon icon="ri-safe-2-line" size="20" />
                        </VAvatar>
                        <div>
                          <div class="font-weight-bold text-body-2 text-slate-900">
                            Banco Guayaquil
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            BGA Dólares (USD)
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-bold font-mono text-body-1 text-slate-800">
                        {{ formatCurrency(initialBalances.guayaquil) }}
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-bold font-mono text-body-1 text-indigo">
                        {{ formatCurrency(systemBalances.guayaquil) }}
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                      <div class="font-weight-black font-mono text-body-1 text-success">
                        {{ formatCurrency(payload.guayaquil_total) }}
                      </div>
                    </td>
                  </tr>
                </tbody>

                <!-- Pie de tabla con Totales -->
                <tfoot>
                  <tr class="bg-slate-100 border-t">
                    <td class="py-3 px-4 font-weight-black text-slate-900 text-uppercase">
                      TOTAL GENERAL
                    </td>
                    <td class="py-3 px-3 text-center font-weight-black font-mono text-body-1 text-primary">
                      {{ formatCurrency(initialBalances.total) }}
                    </td>
                    <td class="py-3 px-3 text-center font-weight-black font-mono text-body-1 text-indigo">
                      {{ formatCurrency(systemBalances.cash + systemBalances.pichincha + systemBalances.guayaquil) }}
                    </td>
                    <td class="py-3 px-3 text-center font-weight-black font-mono text-body-1 text-success">
                      {{ formatCurrency(grandTotal) }}
                    </td>
                  </tr>
                </tfoot>
              </VTable>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Derecha (4 cols): Resumen de Cuadre -->
        <VCol cols="12" md="4">
          <VCard elevation="1" class="rounded-xl d-flex flex-column h-100 border-light overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VAvatar color="primary" variant="tonal" size="32" class="rounded-lg">
                    <VIcon icon="ri-dashboard-3-line" size="18" />
                  </VAvatar>
                  <span class="text-subtitle-1 font-weight-bold text-slate-900 text-uppercase">
                    Resumen de Cuadre
                  </span>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 d-flex flex-column flex-grow-1 justify-space-around gap-3">
              <!-- Conteo Físico Total -->
              <div class="d-flex justify-space-between align-center pa-2 rounded-lg bg-slate-50">
                <div>
                  <div class="font-weight-bold text-body-2 text-slate-900">
                    Total Físico Hoy
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    (Arqueo ingresado)
                  </div>
                </div>
                <div class="text-h6 font-weight-black font-mono text-primary">
                  {{ formatCurrency(grandTotal) }}
                </div>
              </div>

              <!-- Saldo Teórico en Sistema -->
              <div class="d-flex justify-space-between align-center pa-2 rounded-lg bg-slate-50">
                <div>
                  <div class="font-weight-bold text-body-2 text-slate-900">
                    Total en Cartera
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    (Saldo en Sistema)
                  </div>
                </div>
                <div class="text-body-1 font-weight-black font-mono text-slate-800">
                  {{ formatCurrency(systemBalances.cash + systemBalances.pichincha + systemBalances.guayaquil) }}
                </div>
              </div>

              <!-- Diferencia (Alerta Cuadrado / Descuadre) -->
              <div
                class="pa-4 rounded-xl text-center"
                :class="Math.abs(totalDifferenceSystem) < 0.01 ? 'bg-success-tonal border-success' : 'bg-error-tonal border-error'"
              >
                <div class="font-weight-bold text-caption text-uppercase mb-1" :class="Math.abs(totalDifferenceSystem) < 0.01 ? 'text-success' : 'text-error'">
                  {{ Math.abs(totalDifferenceSystem) < 0.01 ? '✓ Arqueo Cuadrado' : '⚠ Diferencia con Sistema' }}
                </div>
                <div class="text-h5 font-weight-black font-mono" :class="Math.abs(totalDifferenceSystem) < 0.01 ? 'text-success' : 'text-error'">
                  {{ formatCurrency(totalDifferenceSystem) }}
                </div>
                <div class="text-caption text-slate-600 mt-1 font-weight-medium">
                  {{ Math.abs(totalDifferenceSystem) < 0.01 ? 'Sin diferencias registradas' :
                    (totalDifferenceSystem > 0 ? 'Sobrante en caja' : 'Faltante en caja') }}
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Fila 2: Desglose Físico (8 cols) + Cuentas y Observaciones (4 cols) -->
      <VRow>
        <!-- Desglose Físico de Efectivo -->
        <VCol cols="12" md="8">
          <VCard elevation="1" class="rounded-xl border-light h-100 overflow-hidden">
            <VCardItem class="bg-white py-3 px-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VAvatar color="primary" variant="tonal" size="32" class="rounded-lg">
                    <VIcon icon="ri-coins-line" size="18" />
                  </VAvatar>
                  <span class="font-weight-bold text-subtitle-1 text-slate-900">
                    Desglose Físico de Efectivo (Caja Chica)
                  </span>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 bg-white">
              <VRow>
                <!-- Columna Billetes -->
                <VCol cols="12" sm="6" class="border-right-divider pr-sm-4">
                  <div class="d-flex align-center gap-2 mb-3 pb-2 border-b">
                    <VIcon icon="ri-bill-line" color="primary" size="18" />
                    <span class="font-weight-bold text-subtitle-2 text-slate-800 text-uppercase">Billetes</span>
                  </div>
                  <table class="w-100 table-cash text-uppercase">
                    <thead>
                      <tr>
                        <th class="text-left py-1 text-slate-500 text-caption font-weight-bold">
                          Denom.
                        </th>
                        <th class="text-center py-1 text-slate-500 text-caption font-weight-bold" style="width: 110px;">
                          Cant.
                        </th>
                        <th class="text-right py-1 text-slate-500 text-caption font-weight-bold">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="denom in billsList" :key="`bill-${denom}`">
                        <td class="py-2 text-body-1 font-weight-medium">
                          <VChip variant="tonal" size="small" color="primary" class="font-weight-bold font-mono px-2" style="width: 55px; justify-content: center;">
                            ${{ denom }}
                          </VChip>
                        </td>
                        <td class="py-1">
                          <div class="d-flex align-center justify-center">
                            <input
                              v-model.number="payload.cash_details.bills[denom]"
                              type="number"
                              min="0"
                              class="cash-qty-input"
                              :disabled="saving || loading || isSealed"
                              @focus="$event.target.select()"
                            >
                          </div>
                        </td>
                        <td class="py-2 text-right font-weight-bold font-mono text-slate-900">
                          {{ formatCurrency(denom * (parseInt(payload.cash_details.bills[denom]) || 0)) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </VCol>

                <!-- Columna Monedas -->
                <VCol cols="12" sm="6" class="pl-sm-4">
                  <div class="d-flex align-center gap-2 mb-3 pb-2 border-b">
                    <VIcon icon="ri-coins-line" color="secondary" size="18" />
                    <span class="font-weight-bold text-subtitle-2 text-slate-800 text-uppercase">Monedas</span>
                  </div>
                  <table class="w-100 table-cash text-uppercase">
                    <thead>
                      <tr>
                        <th class="text-left py-1 text-slate-500 text-caption font-weight-bold">
                          Denom.
                        </th>
                        <th class="text-center py-1 text-slate-500 text-caption font-weight-bold" style="width: 110px;">
                          Cant.
                        </th>
                        <th class="text-right py-1 text-slate-500 text-caption font-weight-bold">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="denom in coinsList" :key="`coin-${denom}`">
                        <td class="py-2 text-body-1 font-weight-medium">
                          <VChip variant="tonal" size="small" color="secondary" class="font-weight-bold font-mono px-2" style="width: 55px; justify-content: center;">
                            ${{ denom }}
                          </VChip>
                        </td>
                        <td class="py-1">
                          <div class="d-flex align-center justify-center">
                            <input
                              v-model.number="payload.cash_details.coins[denom]"
                              type="number"
                              min="0"
                              class="cash-qty-input"
                              :disabled="saving || loading || isSealed"
                              @focus="$event.target.select()"
                            >
                          </div>
                        </td>
                        <td class="py-2 text-right font-weight-bold font-mono text-slate-900">
                          {{ formatCurrency(parseFloat(denom) * (parseInt(payload.cash_details.coins[denom]) || 0)) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </VCol>
              </VRow>

              <!-- Panel Subtotal Efectivo -->
              <div class="total-cash-panel mt-4 pa-4 rounded-xl bg-slate-50 border">
                <div class="d-flex justify-space-between align-center flex-wrap gap-2 mb-2">
                  <div class="d-flex flex-column">
                    <span class="text-caption font-weight-bold text-slate-500 text-uppercase">Subtotales de Efectivo</span>
                    <span class="text-body-2 text-slate-800">
                      Billetes: <strong class="font-mono text-slate-900">{{ formatCurrency(totalBills) }}</strong> |
                      Monedas: <strong class="font-mono text-slate-900">{{ formatCurrency(totalCoins) }}</strong>
                    </span>
                  </div>
                  <div class="d-flex align-center gap-3">
                    <span class="text-h6 font-weight-black text-slate-900 text-uppercase">Físico Contado:</span>
                    <span class="text-h5 font-weight-black text-success font-mono">{{ formatCurrency(totalCash) }}</span>
                  </div>
                </div>
                <div class="d-flex justify-space-between align-center pt-2 border-t flex-wrap gap-2">
                  <span class="text-caption font-weight-medium text-slate-600">
                    Saldo Teórico del Sistema (Caja Chica):
                    <strong class="font-mono text-slate-900">{{ formatCurrency(systemBalances.cash) }}</strong>
                  </span>
                  <span
                    class="text-caption font-weight-bold"
                    :class="cashDifference >= 0 ? 'text-success' : 'text-error'"
                  >
                    Diferencia Caja:
                    <strong class="font-mono">{{ cashDifference > 0 ? '+' : '' }}{{ formatCurrency(cashDifference) }}</strong>
                  </span>
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Saldos Bancarios y Acciones -->
        <VCol cols="12" md="4">
          <div class="d-flex flex-column gap-5 h-100 justify-space-between">
            <!-- Cuentas Bancarias -->
            <VCard elevation="1" class="rounded-xl border-light overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-2">
                    <VAvatar color="primary" variant="tonal" size="32" class="rounded-lg">
                      <VIcon icon="ri-bank-line" size="18" />
                    </VAvatar>
                    <span class="font-weight-bold text-subtitle-1 text-slate-900">
                      Saldos Bancarios
                    </span>
                  </div>
                </template>
              </VCardItem>
              <VCardText class="pa-4 bg-white d-flex flex-column gap-4">
                <!-- Pichincha -->
                <div>
                  <div class="d-flex justify-space-between align-center mb-1">
                    <label class="text-caption font-weight-bold text-slate-800">Banco Pichincha ($)</label>
                    <span class="text-caption font-weight-medium text-slate-500">
                      Sistema: <strong class="font-mono text-slate-900">{{ formatCurrency(systemBalances.pichincha) }}</strong>
                    </span>
                  </div>
                  <VTextField
                    v-model.number="pichinchaVal"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    prepend-inner-icon="ri-bank-card-line"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    color="primary"
                    class="bank-input"
                    :disabled="saving || loading || isSealed"
                    @focus="$event.target.select()"
                  />
                  <div
                    class="text-right text-caption mt-1 font-weight-bold"
                    :class="pichinchaDifference >= 0 ? 'text-success' : 'text-error'"
                  >
                    Dif: {{ pichinchaDifference > 0 ? '+' : '' }}{{ formatCurrency(pichinchaDifference) }}
                  </div>
                </div>

                <!-- Guayaquil -->
                <div>
                  <div class="d-flex justify-space-between align-center mb-1">
                    <label class="text-caption font-weight-bold text-slate-800">Banco Guayaquil ($)</label>
                    <span class="text-caption font-weight-medium text-slate-500">
                      Sistema: <strong class="font-mono text-slate-900">{{ formatCurrency(systemBalances.guayaquil) }}</strong>
                    </span>
                  </div>
                  <VTextField
                    v-model.number="guayaquilVal"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    prepend-inner-icon="ri-bank-card-line"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    color="primary"
                    class="bank-input"
                    :disabled="saving || loading || isSealed"
                    @focus="$event.target.select()"
                  />
                  <div
                    class="text-right text-caption mt-1 font-weight-bold"
                    :class="guayaquilDifference >= 0 ? 'text-success' : 'text-error'"
                  >
                    Dif: {{ guayaquilDifference > 0 ? '+' : '' }}{{ formatCurrency(guayaquilDifference) }}
                  </div>
                </div>
              </VCardText>
            </VCard>

            <!-- Observaciones -->
            <VCard elevation="1" class="rounded-xl border-light overflow-hidden">
              <VCardItem class="bg-white py-3 px-4 border-b">
                <template #title>
                  <div class="d-flex align-center gap-2">
                    <VAvatar color="secondary" variant="tonal" size="32" class="rounded-lg">
                      <VIcon icon="ri-file-text-line" size="18" />
                    </VAvatar>
                    <span class="font-weight-bold text-subtitle-1 text-slate-900">Observaciones</span>
                  </div>
                </template>
              </VCardItem>
              <VCardText class="pa-4 bg-white">
                <VTextarea
                  v-model="payload.observations"
                  label="Describa diferencias o novedades..."
                  rows="2"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  color="primary"
                  :disabled="saving || loading || isSealed"
                />
              </VCardText>
            </VCard>

            <!-- Botones de Acción -->
            <div class="d-flex flex-column gap-2">
              <VBtn
                block
                variant="elevated"
                color="primary"
                size="large"
                class="font-weight-bold elevation-2"
                :loading="saving"
                :disabled="saving || sealing || loading || isSealed"
                prepend-icon="ri-save-3-line"
                @click="saveArqueo"
              >
                GUARDAR ARQUEO DIARIO
              </VBtn>
              <VBtn
                block
                variant="elevated"
                color="success"
                size="large"
                class="font-weight-bold elevation-2"
                :loading="sealing"
                :disabled="sealing || saving || loading || isSealed"
                prepend-icon="ri-lock-password-line"
                @click="confirmSealDialog = true"
              >
                SELLAR DÍA
              </VBtn>
            </div>
          </div>
        </VCol>
      </VRow>

      <!-- Diálogo de Confirmación de Sellado -->
      <VDialog v-model="confirmSealDialog" scrollable persistent max-width="480">
        <VCard class="custom-dialog-card elevation-24">
          <div class="custom-dialog-header-primary">
            <VBtn
              icon="ri-close-line"
              variant="text"
              size="small"
              class="custom-dialog-close-btn"
              :disabled="sealing"
              @click="confirmSealDialog = false"
            />
            <div class="custom-dialog-avatar">
              <VIcon icon="ri-lock-password-line" />
            </div>
            <h3 class="custom-dialog-title">
              Confirmar Sellado del Día
            </h3>
            <p class="custom-dialog-subtitle">
              Esta acción cerrará permanentemente los registros de arqueo
            </p>
          </div>

          <VCardText class="pa-6 text-center text-body-1">
            ¿Estás seguro de que deseas sellar el día seleccionado? Esta acción no podrá deshacerse.
          </VCardText>

          <VDivider />

          <VCardActions
            class="pa-4 d-flex justify-end align-center gap-3 bg-white"
            style="position: sticky; bottom: 0; z-index: 2;"
          >
            <VBtn
              variant="outlined"
              color="secondary"
              prepend-icon="ri-close-line"
              class="rounded-lg px-6 font-weight-medium"
              height="40"
              :disabled="sealing"
              @click="confirmSealDialog = false"
            >
              Cancelar
            </VBtn>
            <VBtn
              color="success"
              variant="elevated"
              prepend-icon="ri-check-line"
              class="rounded-lg px-6 font-weight-bold"
              height="40"
              :loading="sealing"
              :disabled="sealing"
              @click="confirmSeal"
            >
              Confirmar Sellado
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>

      <!-- Diálogo de Desglose Día Anterior -->
      <VDialog v-model="prevCountDetailsDialog" scrollable max-width="600">
        <VCard class="custom-dialog-card elevation-24">
          <div class="custom-dialog-header-primary">
            <VBtn
              icon="ri-close-line"
              variant="text"
              size="small"
              class="custom-dialog-close-btn"
              @click="prevCountDetailsDialog = false"
            />
            <div class="custom-dialog-avatar">
              <VIcon icon="ri-history-line" />
            </div>
            <h3 class="custom-dialog-title">
              Desglose de Efectivo del Día Anterior
            </h3>
            <p class="custom-dialog-subtitle">
              Fecha del cierre: {{ initialBalances.origin_date || 'N/A' }}
            </p>
          </div>

          <VCardText v-if="initialBalances.cash_details" class="pa-6 bg-white">
            <VRow>
              <!-- Billetes -->
              <VCol cols="12" sm="6" class="border-right-divider pr-sm-4">
                <div class="d-flex align-center gap-2 mb-3 pb-2 border-b">
                  <VIcon icon="ri-bill-line" color="primary" size="18" />
                  <span class="font-weight-bold text-subtitle-2 text-slate-800 text-uppercase">Billetes</span>
                </div>
                <table class="w-100 table-cash text-uppercase">
                  <thead>
                    <tr>
                      <th class="text-left py-1 text-slate-500 text-caption font-weight-bold">
                        Denom.
                      </th>
                      <th class="text-center py-1 text-slate-500 text-caption font-weight-bold">
                        Cant.
                      </th>
                      <th class="text-right py-1 text-slate-500 text-caption font-weight-bold">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="denom in billsList" :key="`prev-bill-${denom}`">
                      <td class="py-2">
                        <VChip variant="tonal" size="small" color="primary" class="font-weight-bold font-mono px-2" style="width: 55px; justify-content: center;">
                          ${{ denom }}
                        </VChip>
                      </td>
                      <td class="py-2 text-center font-weight-bold font-mono text-slate-800">
                        {{ getPrevBillQty(denom) }}
                      </td>
                      <td class="py-2 text-right font-weight-bold font-mono text-slate-900">
                        {{ formatCurrency(denom * getPrevBillQty(denom)) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </VCol>

              <!-- Monedas -->
              <VCol cols="12" sm="6" class="pl-sm-4">
                <div class="d-flex align-center gap-2 mb-3 pb-2 border-b">
                  <VIcon icon="ri-coins-line" color="secondary" size="18" />
                  <span class="font-weight-bold text-subtitle-2 text-slate-800 text-uppercase">Monedas</span>
                </div>
                <table class="w-100 table-cash text-uppercase">
                  <thead>
                    <tr>
                      <th class="text-left py-1 text-slate-500 text-caption font-weight-bold">
                        Denom.
                      </th>
                      <th class="text-center py-1 text-slate-500 text-caption font-weight-bold">
                        Cant.
                      </th>
                      <th class="text-right py-1 text-slate-500 text-caption font-weight-bold">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="denom in coinsList" :key="`prev-coin-${denom}`">
                      <td class="py-2">
                        <VChip variant="tonal" size="small" color="secondary" class="font-weight-bold font-mono px-2" style="width: 55px; justify-content: center;">
                          ${{ denom }}
                        </VChip>
                      </td>
                      <td class="py-2 text-center font-weight-bold font-mono text-slate-800">
                        {{ getPrevCoinQty(denom) }}
                      </td>
                      <td class="py-2 text-right font-weight-bold font-mono text-slate-900">
                        {{ formatCurrency(parseFloat(denom) * getPrevCoinQty(denom)) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </VCol>
            </VRow>

            <VDivider class="my-4" />

            <div class="d-flex justify-space-between align-center px-2 py-1">
              <span class="font-weight-bold text-subtitle-1 text-slate-900">Total Efectivo Día Anterior:</span>
              <span class="text-h6 font-weight-black text-success font-mono">{{ formatCurrency(initialBalances.cash) }}</span>
            </div>
          </VCardText>

          <VCardText v-else class="pa-8 text-center">
            <VIcon size="48" color="warning" class="mb-2">
              ri-information-line
            </VIcon>
            <p class="text-body-1 text-medium-emphasis mb-0">
              No se encontraron detalles de billetes y monedas registrados para el día anterior ({{
                initialBalances.origin_date || 'N/A' }}).
            </p>
          </VCardText>

          <VDivider />
          <VCardActions
            class="pa-4 d-flex justify-end align-center gap-3 bg-white"
            style="position: sticky; bottom: 0; z-index: 2;"
          >
            <VBtn
              variant="outlined"
              color="secondary"
              prepend-icon="ri-close-line"
              class="rounded-lg px-6 font-weight-medium"
              height="40"
              @click="prevCountDetailsDialog = false"
            >
              Cerrar
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Status Pills (Estilo Socios/Usuarios con Punto Indicador)
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
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }

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

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}

.status-transfer {
  background-color: #eff6ff !important;
  color: #1e40af !important;
  border: 1px solid #bfdbfe !important;

  .status-dot {
    background-color: #3b82f6 !important;
  }
}

.status-canceled {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  border: 1px solid #cbd5e1 !important;

  .status-dot {
    background-color: #94a3b8 !important;
  }
}
</style>

<route lang="yaml">
meta:
  navActiveLink: 'finanzas-arqueo'
</route>
