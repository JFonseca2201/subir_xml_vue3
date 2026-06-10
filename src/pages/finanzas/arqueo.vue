<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const router = useRouter()
const { showNotification } = useGlobalToast()

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
const initialBalances = ref({
  cash: 0,
  pichincha: 0,
  guayaquil: 0,
  total: 0,
  origin_date: null
})

// Live system balances for comparison
const systemBalances = ref({
  cash: 0,
  pichincha: 0,
  guayaquil: 0
})

// Main reactive payload
const payload = ref({
  count_date: new Date().toISOString().split('T')[0],
  pichincha_total: 0.00,
  guayaquil_total: 0.00,
  cash_details: {
    bills: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0
    },
    coins: {
      '1.00': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    }
  },
  observations: ''
})

// Current User check for role restriction
const currentUser = computed(() => {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
})

const canAccessArqueo = computed(() => {
  const roleId = currentUser.value?.role?.id
  return currentUser.value && [1, 2].includes(roleId) // Admin/Gerente
})

// Computations for totals
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
  set: (val) => { payload.value.pichincha_total = parseFloat(val) || 0 }
})

const guayaquilVal = computed({
  get: () => payload.value.guayaquil_total,
  set: (val) => { payload.value.guayaquil_total = parseFloat(val) || 0 }
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
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Fetch daily status from Laravel API
const fetchStatus = async (date) => {
  loading.value = true
  try {
    const response = await $api('daily-cash-counts/status', {
      params: { date }
    })

    console.log('Daily cash count status response:', response);

    if (response.success) {
      dateFormatted.value = response.date_formatted || ''
      alreadyCounted.value = response.already_counted || false
      isSealed.value = response.is_sealed || false

      if (response.initial_balances) {
        initialBalances.value = {
          cash: parseFloat(response.initial_balances.cash) || 0,
          pichincha: parseFloat(response.initial_balances.pichincha) || 0,
          guayaquil: parseFloat(response.initial_balances.guayaquil) || 0,
          total: parseFloat(response.initial_balances.total) || 0,
          origin_date: response.initial_balances.origin_date || null
        }
      }

      if (response.system_balances) {
        systemBalances.value = {
          cash: parseFloat(response.system_balances.cash) || 0,
          pichincha: parseFloat(response.system_balances.pichincha) || 0,
          guayaquil: parseFloat(response.system_balances.guayaquil) || 0
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
        observations: payload.value.observations
      }
    })
    console.log(response);


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
        count_date: payload.value.count_date
      }
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
watch(() => payload.value.count_date, (newDate) => {
  if (newDate) {
    fetchStatus(newDate)
  }
})

// Initialize
onMounted(() => {
  if (canAccessArqueo.value) {
    fetchStatus(payload.value.count_date)
  }
})
</script>

<template>
  <div class="arqueo-container pa-4 pa-sm-6">
    <!-- Restrict Access Screen -->
    <div v-if="!canAccessArqueo" class="d-flex justify-center align-center" style="height: 450px">
      <VCard class="pa-8 text-center rounded-xl border-thin" elevation="8" max-width="450">
        <VIcon size="64" color="primary" class="mb-4">ri-lock-line</VIcon>
        <h3 class="text-h5 mb-2 font-weight-bold">Acceso Restringido</h3>
        <p class="text-body-1 text-medium-emphasis mb-6">Tu rol no cuenta con los permisos necesarios para realizar el
          arqueo de caja diario.</p>
        <VBtn color="primary" class="text-none font-weight-bold" prepend-icon="ri-arrow-left-line"
          @click="router.push('/dashboard')">
          Volver al Dashboard
        </VBtn>
      </VCard>
    </div>

    <div v-else class="arqueo-content-layout">
      <!-- Top Title Bar -->
      <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
        <div class="d-flex align-center gap-3">
          <VAvatar color="primary" variant="tonal" rounded size="48">
            <VIcon icon="ri-safe-2-line" size="28" />
          </VAvatar>
          <div>
            <h1 class="text-h4 font-weight-bold mb-1 page-title">Caja Diaria</h1>
            <p class="text-medium-emphasis mb-0 page-subtitle">
              Cierre diario de control físico de dinero y conciliación bancaria
            </p>
          </div>
        </div>

        <div class="date-selector-container">
          <span class="text-caption text-uppercase font-weight-bold text-grey-darken-1 mr-2 d-none d-sm-inline">Fecha de
            Corte:</span>
          <input v-model="payload.count_date" type="date" class="custom-date-input" :disabled="saving || loading" />
        </div>
      </div>

      <!-- Elegante Fecha Formateada Alert -->
      <VCard v-if="dateFormatted" elevation="0" class="date-display-card mb-5 pa-4 rounded-lg border-light border">
        <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center gap-2">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-calendar-event-line" color="primary" size="22" />
            <span class="text-h6 font-weight-bold text-grey-darken-4 capitalize-first">{{ dateFormatted }}</span>
          </div>
          <VChip v-if="isSealed" color="error" variant="flat" size="small" class="font-weight-bold px-3 py-1">
            <VIcon start size="14">ri-lock-password-fill</VIcon>
            DÍA SELLADO (SOLO LECTURA)
          </VChip>
          <VChip v-else-if="alreadyCounted" color="success" variant="flat" size="small" class="font-weight-bold px-3 py-1">
            <VIcon start size="14">ri-checkbox-circle-fill</VIcon>
            ARQUEO YA REGISTRADO (MODO EDICIÓN)
          </VChip>
          <VChip v-else color="warning" variant="tonal" size="small" class="font-weight-bold px-3 py-1">
            <VIcon start size="14">ri-time-line</VIcon>
            PENDIENTE POR ARCHIVAR
          </VChip>
        </div>
      </VCard>

      <VRow class="mb-6">
        <!-- Columna Izquierda (9/12) -->
        <VCol cols="12" md="9">
          <VCard elevation="3" class="rounded-xl h-100 border-light border position-relative">
            <VProgressLinear v-if="loading" indeterminate color="primary" height="3" class="position-absolute"
              style="top: 0; left: 0; right: 0; z-index: 10;" />
            <VCardItem class="bg-grey-lighten-4 py-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-history-line" size="24" color="primary" />
                  <span class="text-h6 font-weight-bold text-grey-darken-3">Resumen de Saldos Iniciales del Día
                    Anterior</span>
                  <span v-if="initialBalances.origin_date"
                    class="text-body-2 font-weight-medium text-grey-darken-1 ml-2">
                    (Saldo Inicial de Arrastre - {{ initialBalances.origin_date }})
                  </span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-0">
              <!-- Fila 1: Efectivo -->
              <div class="d-flex align-center pa-4 border-b">
                <div class="d-flex align-center justify-center rounded-circle bg-primary-lighten-5 mr-4"
                  style="width: 54px; height: 54px; flex-shrink: 0;">
                  <VIcon icon="ri-money-dollar-circle-line" size="32" color="primary" />
                </div>
                <VRow no-gutters class="w-100">
                  <VCol cols="12" sm="4" class="px-2 border-r-sm mb-2 mb-sm-0">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Efectivo Físico</div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(initialBalances.cash) }}</div>
                  </VCol>
                  <VCol cols="12" sm="4" class="px-sm-4 border-r-sm mb-2 mb-sm-0">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Sede Principal</div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(initialBalances.cash) }}</div>
                  </VCol>
                  <VCol cols="12" sm="4" class="px-sm-4">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">
                      Caja Chica <span class="text-caption text-grey ml-1 text-lowercase">(Caja Chica
                        Principal)</span>
                    </div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(systemBalances.cash) }}</div>
                  </VCol>
                </VRow>
              </div>

              <!-- Fila 2: Banco Pichincha -->
              <div class="d-flex align-center pa-4 border-b">
                <div class="d-flex align-center justify-center rounded-circle bg-warning-lighten-5 mr-4"
                  style="width: 54px; height: 54px; flex-shrink: 0;">
                  <VIcon icon="ri-bank-line" size="32" color="warning" />
                </div>
                <VRow no-gutters class="w-100">
                  <VCol cols="12" sm="4" class="px-2 border-r-sm mb-2 mb-sm-0">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Banco Pichincha</div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(initialBalances.pichincha) }}
                    </div>
                  </VCol>
                  <VCol cols="12" sm="4" class="px-sm-4 border-r-sm mb-2 mb-sm-0">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Cuenta de Ahorros
                    </div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(initialBalances.pichincha) }}
                    </div>
                  </VCol>
                  <VCol cols="12" sm="4" class="px-sm-4">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">
                      Pichincha Ahorro <span class="text-caption text-grey ml-1 text-lowercase">(Caja de
                        Ahorro)</span>
                    </div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(systemBalances.pichincha) }}
                    </div>
                  </VCol>
                </VRow>
              </div>

              <!-- Fila 3: Banco Guayaquil -->
              <div class="d-flex align-center pa-4">
                <div class="d-flex align-center justify-center rounded-circle bg-error-lighten-5 mr-4"
                  style="width: 54px; height: 54px; flex-shrink: 0;">
                  <VIcon icon="ri-safe-2-line" size="32" color="error" />
                </div>
                <VRow no-gutters class="w-100">
                  <VCol cols="12" sm="4" class="px-2 border-r-sm mb-2 mb-sm-0">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Banco Guayaquil</div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(initialBalances.guayaquil) }}
                    </div>
                  </VCol>
                  <VCol cols="12" sm="4" class="px-sm-4 border-r-sm mb-2 mb-sm-0">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">Cuenta Principal
                    </div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(initialBalances.guayaquil) }}
                    </div>
                  </VCol>
                  <VCol cols="12" sm="4" class="px-sm-4">
                    <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase">
                      BGA Dólares <span class="text-caption text-grey ml-1 text-lowercase">(Cuenta USD)</span>
                    </div>
                    <div class="text-h6 font-weight-bold font-mono">{{ formatCurrency(systemBalances.guayaquil) }}
                    </div>
                  </VCol>
                </VRow>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Derecha (3/12) -->
        <VCol cols="12" md="3">
          <VCard elevation="3" class="rounded-xl d-flex flex-column h-100 border-light border">
            <VCardItem class="bg-grey-lighten-4 py-4 text-center border-b">
              <VCardTitle class="text-h6 font-weight-black text-grey-darken-3">RESUMEN DE CUADRE</VCardTitle>
            </VCardItem>
            <VCardText class="pa-4 d-flex flex-column flex-grow-1 justify-center gap-4">
              <!-- Fila 1 -->
              <div class="d-flex justify-space-between align-center">
                <div>
                  <div class="font-weight-bold text-body-2 text-grey-darken-3">GRAN TOTAL EMPRESA</div>
                  <div class="text-caption text-grey-darken-1">(Sumen del Sistema Totalea)</div>
                </div>
                <div class="text-h6 font-weight-black font-mono text-primary">{{ formatCurrency(grandTotal) }}</div>
              </div>

              <VDivider />

              <!-- Fila 2 (Alerta) -->
              <div class="d-flex justify-space-between align-center pa-3 rounded-lg"
                :class="totalDifferenceSystem === 0 ? 'bg-success-light' : 'bg-error-light'">
                <div class="font-weight-bold text-body-2"
                  :class="totalDifferenceSystem === 0 ? 'text-success-dark' : 'text-error-dark'">DIFERENCIA TOTAL
                </div>
                <div class="text-h6 font-weight-black font-mono"
                  :class="totalDifferenceSystem === 0 ? 'text-success-dark' : 'text-error-dark'">{{
                    formatCurrency(totalDifferenceSystem) }}</div>
              </div>

              <VDivider />

              <!-- Fila 3 -->
              <div class="d-flex justify-space-between align-center">
                <div class="font-weight-bold text-body-2 text-grey-darken-3">EFECTIVO TOTAL FÍSICO</div>
                <div class="text-h6 font-weight-black font-mono text-success">{{ formatCurrency(totalCash) }}</div>
              </div>
            </VCardText>

          </VCard>
        </VCol>
      </VRow>

      <!-- Main Form Grid -->
      <VRow>
        <!-- Left: Physical Cash Breakdown -->
        <VCol cols="12" md="8">
          <VCard elevation="0" class="rounded-lg border-light border h-100">
            <VCardItem class="bg-grey-lighten-4 py-3 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-coins-line" color="primary" size="20" />
                  <span class="font-weight-bold text-subtitle-1 text-grey-darken-3">Desglose Físico de Efectivo (Caja
                    Chica)</span>
                </div>
              </template>
            </VCardItem>

            <VCardText class="pa-4 bg-white">
              <VRow>
                <!-- Bills Column -->
                <VCol cols="12" sm="6" class="border-right-divider pr-sm-4">
                  <div class="d-flex align-center gap-2 mb-3 pb-2 border-b">
                    <VIcon icon="ri-bill-line" color="primary" size="18" />
                    <span class="font-weight-bold text-subtitle-2 text-grey-darken-3 text-uppercase">Billetes</span>
                  </div>
                  <table class="w-100 table-cash text-uppercase">
                    <thead>
                      <tr>
                        <th class="text-left py-1 text-grey-darken-1 text-caption">Denom.</th>
                        <th class="text-center py-1 text-grey-darken-1 text-caption" style="width: 110px;">Cant.</th>
                        <th class="text-right py-1 text-grey-darken-1 text-caption">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="denom in billsList" :key="`bill-${denom}`">
                        <td class="py-2 text-body-1 font-weight-medium">
                          <VChip variant="tonal" size="small" color="primary" class="font-weight-bold font-mono px-2"
                            style="width: 55px; justify-content: center;">
                            ${{ denom }}
                          </VChip>
                        </td>
                        <td class="py-1">
                          <div class="d-flex align-center justify-center">
                            <input v-model.number="payload.cash_details.bills[denom]" type="number" min="0"
                              class="cash-qty-input" :disabled="saving || loading || isSealed" @focus="$event.target.select()" />
                          </div>
                        </td>
                        <td class="py-2 text-right font-weight-bold font-mono text-grey-darken-3">
                          {{ formatCurrency(denom * (parseInt(payload.cash_details.bills[denom]) || 0)) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </VCol>

                <!-- Coins Column -->
                <VCol cols="12" sm="6" class="pl-sm-4">
                  <div class="d-flex align-center gap-2 mb-3 pb-2 border-b">
                    <VIcon icon="ri-coins-line" color="primary" size="18" />
                    <span class="font-weight-bold text-subtitle-2 text-grey-darken-3 text-uppercase">Monedas</span>
                  </div>
                  <table class="w-100 table-cash text-uppercase">
                    <thead>
                      <tr>
                        <th class="text-left py-1 text-grey-darken-1 text-caption">Denom.</th>
                        <th class="text-center py-1 text-grey-darken-1 text-caption" style="width: 110px;">Cant.</th>
                        <th class="text-right py-1 text-grey-darken-1 text-caption">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="denom in coinsList" :key="`coin-${denom}`">
                        <td class="py-2 text-body-1 font-weight-medium">
                          <VChip variant="tonal" size="small" color="secondary" class="font-weight-bold font-mono px-2"
                            style="width: 55px; justify-content: center;">
                            ${{ denom }}
                          </VChip>
                        </td>
                        <td class="py-1">
                          <div class="d-flex align-center justify-center">
                            <input v-model.number="payload.cash_details.coins[denom]" type="number" min="0"
                              class="cash-qty-input" :disabled="saving || loading || isSealed" @focus="$event.target.select()" />
                          </div>
                        </td>
                        <td class="py-2 text-right font-weight-bold font-mono text-grey-darken-3">
                          {{ formatCurrency(parseFloat(denom) * (parseInt(payload.cash_details.coins[denom]) || 0)) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </VCol>
              </VRow>

              <!-- Total Cash Box section with live system comparison -->
              <div class="total-cash-panel mt-4 pa-4 rounded-lg bg-grey-lighten-4">
                <div class="d-flex justify-space-between align-center flex-wrap gap-2 mb-2">
                  <div class="d-flex flex-column">
                    <span class="text-caption font-weight-bold text-grey-darken-1 text-uppercase">Subtotales de
                      Efectivo</span>
                    <span class="text-body-2 text-grey-darken-3">
                      Billetes: <strong class="font-mono">{{ formatCurrency(totalBills) }}</strong> |
                      Monedas: <strong class="font-mono">{{ formatCurrency(totalCoins) }}</strong>
                    </span>
                  </div>
                  <div class="d-flex align-center gap-3">
                    <span class="text-h6 font-weight-black text-grey-darken-3 text-uppercase">Físico Contado:</span>
                    <span class="text-h5 font-weight-black text-success font-mono">{{ formatCurrency(totalCash)
                    }}</span>
                  </div>
                </div>
                <div class="d-flex justify-space-between align-center pt-2 border-t flex-wrap gap-2">
                  <span class="text-caption font-weight-medium text-grey-darken-1">
                    Saldo Teórico del Sistema (Caja Chica):
                    <strong class="font-mono text-grey-darken-4">{{ formatCurrency(systemBalances.cash) }}</strong>
                  </span>
                  <span class="text-caption font-weight-bold"
                    :class="cashDifference >= 0 ? 'text-success-dark' : 'text-error-dark'">
                    Diferencia Caja:
                    <strong class="font-mono">{{ cashDifference > 0 ? '+' : '' }}{{ formatCurrency(cashDifference)
                    }}</strong>
                  </span>
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Right: Banks, Notes, Summary and Actions -->
        <VCol cols="12" md="4">
          <div class="d-flex flex-column gap-6 h-100 justify-space-between">
            <!-- Cuentas Bancarias -->
            <VCard elevation="0" class="rounded-lg border-light border">
              <VCardItem class="bg-grey-lighten-4 py-3 border-b">
                <template #title>
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-bank-line" color="primary" size="20" />
                    <span class="font-weight-bold text-subtitle-1 text-grey-darken-3">Saldos en Cuentas
                      Bancarias</span>
                  </div>
                </template>
              </VCardItem>
              <VCardText class="pa-4 bg-white d-flex flex-column gap-4 text-uppercase">
                <!-- Pichincha Input & Comparison -->
                <div>
                  <div class="d-flex justify-space-between align-center mb-1">
                    <label class="text-caption font-weight-bold text-grey-darken-2">Banco Pichincha ($)</label>
                    <span class="text-caption font-weight-medium text-grey-darken-1">
                      Sistema: <strong class="font-mono text-grey-darken-4">{{
                        formatCurrency(systemBalances.pichincha)
                      }}</strong>
                    </span>
                  </div>
                  <VTextField v-model.number="pichinchaVal" type="number" min="0" step="0.01" placeholder="0.00"
                    prepend-inner-icon="ri-bank-card-line" variant="outlined" density="comfortable" hide-details="auto"
                    color="primary" class="bank-input" :disabled="saving || loading || isSealed" @focus="$event.target.select()" />
                  <div class="text-right text-caption mt-1 font-weight-bold"
                    :class="pichinchaDifference >= 0 ? 'text-success-dark' : 'text-error-dark'">
                    Dif: {{ pichinchaDifference > 0 ? '+' : '' }}{{ formatCurrency(pichinchaDifference) }}
                  </div>
                </div>

                <!-- Guayaquil Input & Comparison -->
                <div>
                  <div class="d-flex justify-space-between align-center mb-1">
                    <label class="text-caption font-weight-bold text-grey-darken-2">Banco Guayaquil ($)</label>
                    <span class="text-caption font-weight-medium text-grey-darken-1">
                      Sistema: <strong class="font-mono text-grey-darken-4">{{
                        formatCurrency(systemBalances.guayaquil)
                      }}</strong>
                    </span>
                  </div>
                  <VTextField v-model.number="guayaquilVal" type="number" min="0" step="0.01" placeholder="0.00"
                    prepend-inner-icon="ri-bank-card-line" variant="outlined" density="comfortable" hide-details="auto"
                    color="primary" class="bank-input" :disabled="saving || loading || isSealed" @focus="$event.target.select()" />
                  <div class="text-right text-caption mt-1 font-weight-bold"
                    :class="guayaquilDifference >= 0 ? 'text-success-dark' : 'text-error-dark'">
                    Dif: {{ guayaquilDifference > 0 ? '+' : '' }}{{ formatCurrency(guayaquilDifference) }}
                  </div>
                </div>
              </VCardText>
            </VCard>

            <!-- Observaciones -->
            <VCard elevation="0" class="rounded-lg border-light border">
              <VCardItem class="bg-grey-lighten-4 py-3 border-b">
                <template #title>
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-file-text-line" color="primary" size="20" />
                    <span class="font-weight-bold text-subtitle-1 text-grey-darken-3">Observaciones / Novedades</span>
                  </div>
                </template>
              </VCardItem>
              <VCardText class="pa-4 bg-white text-uppercase">
                <VTextarea v-model="payload.observations" label="Describa diferencias o novedades..." rows="3"
                  variant="outlined" density="comfortable" hide-details="auto" color="primary"
                  :disabled="saving || loading || isSealed" />
              </VCardText>
            </VCard>
            <VCardActions class="pa-4 bg-grey-lighten-5 border-t d-flex flex-column gap-2">
              <VBtn block variant="flat" color="primary" class="text-none font-weight-bold text-white m-0"
                @click="saveArqueo" :loading="saving" :disabled="saving || sealing || loading || isSealed">
                <VIcon start>ri-save-3-line</VIcon>
                GUARDAR ARQUEO DIARIO
              </VBtn>
              <VBtn block variant="flat" color="success" class="text-none font-weight-bold text-white m-0"
                @click="confirmSealDialog = true" :loading="sealing" :disabled="sealing || saving || loading || isSealed">
                <VIcon start>ri-lock-password-line</VIcon>
                SELLAR DÍA
              </VBtn>
            </VCardActions>
          </div>
        </VCol>
      </VRow>
      <!-- Confirmación de sellado -->
      <VDialog v-model="confirmSealDialog" persistent max-width="480">
        <VCard>
          <VCardTitle class="text-h6">Confirmar Sellado del Día</VCardTitle>
          <VCardText>¿Estás seguro de que deseas sellar el día seleccionado? Esta acción no podrá deshacerse.
          </VCardText>
          <VCardActions class="pa-4">
            <VBtn text @click="confirmSealDialog = false" :disabled="sealing">Cancelar</VBtn>
            <VBtn color="success" @click="confirmSeal" :loading="sealing" :disabled="sealing">
              Confirmar
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>
    </div>
  </div>

</template>

<style scoped>
.arqueo-container {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: #fcfcfd;
  min-height: 100vh;
}

.page-title {
  color: #1a1a24;
  letter-spacing: -0.5px;
}

.page-subtitle {
  font-size: 0.92rem;
}

.avatar-primary-tonal {
  background-color: rgba(var(--v-theme-primary), 0.12) !important;
}

.date-selector-container {
  display: flex;
  align-items: center;
  background-color: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.custom-date-input {
  border: none;
  outline: none;
  font-size: 0.95rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  text-transform: uppercase;
}

.date-display-card {
  background-color: white !important;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
}

.capitalize-first {
  text-transform: capitalize;
}

.border-b {
  border-bottom: 1px solid #e2e8f0;
}

@media (min-width: 600px) {
  .border-r-sm {
    border-right: 1px solid #e2e8f0;
  }
}

.border-right-divider {
  border-right: 1.5px dashed #e2e8f0;
}

@media (max-width: 600px) {
  .border-right-divider {
    border-right: none;
    border-bottom: 1.5px dashed #e2e8f0;
    padding-bottom: 16px;
    margin-bottom: 16px;
  }
}

.balance-card-inner {
  display: flex;
  flex-direction: column;
  background-color: white;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.balance-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.balance-value {
  font-size: 1.35rem;
  font-weight: 800;
  font-family: monospace;
  margin-top: 4px;
}

.total-initial-highlight {
  background-color: rgba(var(--v-theme-primary), 0.04) !important;
  border-color: rgba(var(--v-theme-primary), 0.2) !important;
}

.table-cash {
  border-collapse: collapse;
}

.table-cash th {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  padding-bottom: 8px;
}

.table-cash tr {
  border-bottom: 1px solid #f8fafc;
}

.table-cash tr:last-child {
  border-bottom: none;
}

.font-mono {
  font-family: monospace;
}

.cash-qty-input {
  width: 80px;
  height: 34px;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  text-align: center;
  font-weight: 700;
  font-size: 1.05rem;
  color: #1e293b;
  outline: none;
  transition: all 0.15s ease-in-out;
}

.cash-qty-input:focus {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.15);
}

.cash-qty-input:disabled {
  background-color: #f1f5f9;
  color: #94a3b8;
  border-color: #e2e8f0;
  cursor: not-allowed;
}

/* Hide input number spinners */
.cash-qty-input::-webkit-outer-spin-button,
.cash-qty-input::-webkit-inner-spin-button,
.bank-input input::-webkit-outer-spin-button,
.bank-input input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* .cash-qty-input[type=number] {
  -moz-appearance: textfield;
} */

.total-cash-panel {
  border: 1.5px solid #e2e8f0;
}

.border-light {
  border: 1px solid #e2e8f0 !important;
}

.bg-grey-lighten-4 {
  background-color: #f8fafc !important;
}

.bg-grey-lighten-5 {
  background-color: #f8fafc !important;
}

.bg-grey-darken-4 {
  background-color: #1e1e2d !important;
}

.summary-divider {
  border: none;
  border-top: 1.5px dashed #e2e8f0;
  margin: 10px 0;
}

.text-primary {
  color: rgb(var(--v-theme-primary)) !important;
}

.text-success-dark {
  color: #1b5e20 !important;
}

.text-error-dark {
  color: #b71c1c !important;
}

.bg-success-light {
  background-color: #e8f5e9 !important;
}

.bg-error-light {
  background-color: #ffebee !important;
}

.border-success-light {
  border-color: #c8e6c9 !important;
}

.border-error-light {
  border-color: #ffcdd2 !important;
}

.summary-comparison {
  border-collapse: collapse;
}

.summary-comparison th {
  border-bottom: 1px solid #e2e8f0;
}

.border-b-faint {
  border-bottom: 1px solid #f1f5f9;
}
</style>

<route lang="yaml">
meta:
  navActiveLink: 'finanzas-arqueo'
</route>
