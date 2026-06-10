<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'

// --- Router y Seguridad ---
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

const currentUser = computed(() => {
  const userStr = localStorage.getItem('user')

  return userStr ? JSON.parse(userStr) : null
})

const canAccessOperations = computed(() => {
  const user = currentUser.value
  const roleId = user?.role?.id

  return user && roleId === 1
})

// --- Estado del Componente ---
const recentMovements = ref([]) // Datos agrupados para el template
const loading = ref(true)
const isTransferDialogVisible = ref(false)
const pdfLoading = ref(false)

const financialSummary = ref({
  monthlyIncome: 0,
  monthlyExpense: 0,
  currentBalance: 0,
  lastTransfer: { amount: 0, from: 'N/A', to: 'N/A', date: '-' },
  alerts: [],
})

const mainCards = [
  {
    title: 'Socios',
    description: 'Aportes de capital',
    icon: 'ri-group-line',
    color: 'success',
    buttonText: 'Registrar aporte',
    action: 'register-contribution',
  },
  {
    title: 'Gestión de pagos nómina',
    description: 'Pagos y adelantos al personal',
    icon: 'ri-user-3-line',
    color: 'primary',
    buttonText: 'Registrar pagos/adelantos',
    action: 'employee-expenses',
  },
  {
    title: 'Ingresos y Gastos',
    description: 'Registro de ingresos y egresos',
    icon: 'ri-exchange-dollar-line',
    color: 'warning',
    buttonText: 'Nuevo movimiento',
    action: 'movements-index',
  },
  {
    title: 'Transferencias internas',
    description: 'Transferencias entre cuentas',
    icon: 'ri-arrow-left-right-line',
    color: 'info',
    buttonText: 'Nueva transferencia',
    action: 'transfer',
  },
]

// --- Lógica de Procesamiento ---

// Agrupa la lista plana del backend en el formato que requiere el v-for anidado
const groupMovementsByDate = movements => {
  if (!movements || !Array.isArray(movements)) return []

  const groups = {}

  movements.forEach(m => {
    const rawDate = m.entry_date || 'Sin fecha'
    const dateKey = rawDate !== 'Sin fecha' ? rawDate.split('T')[0] : 'Sin fecha'

    if (!groups[dateKey]) {
      let displayDate = 'Sin fecha'
      if (rawDate !== 'Sin fecha') {
        displayDate = new Intl.DateTimeFormat('es-EC', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(rawDate))

        // Capitalizar primera letra
        displayDate = displayDate.charAt(0).toUpperCase() + displayDate.slice(1)
      }
      groups[dateKey] = { dateKey, date: displayDate, movements: [] }
    }

    // 1. Extraer y mejorar la descripción
    let finalDesc = m.description || m.movable?.descripcion || 'Movimiento General'
    if (finalDesc.trim().endsWith(':') && m.movable?.descripcion) {
      // Une descripciones cortadas, ej: "Aporte de socio: " + "APORTE DE CAPITAL"
      finalDesc = `${finalDesc.trim()} ${m.movable.descripcion}`
    }

    // 2. Extraer el origen/módulo de forma legible
    let moduleName = 'General'
    if (m.movable_type) {
      const type = m.movable_type.split('\\').pop()
      const typeMap = { 'AporteCapital': 'Aporte de Capital', 'EmployeeExpense': 'Gasto de Empleado', 'Income': 'Ingreso Manual', 'Expense': 'Egreso Manual' }

      moduleName = typeMap[type] || type
    }

    // 3. Extraer el método de pago real priorizando metadata o movable
    let method = m.metadata?.metodo || m.movable?.metodo_pago || m.movable?.payment_method || m.metadata?.payment_method || m.payment_method || 'EFECTIVO'

    method = method.toUpperCase()
    if (method === 'TRANSFER') method = 'TRANSFERENCIA'
    if (method === 'CASH') method = 'EFECTIVO'

    groups[dateKey].movements.push({
      id: m.id,
      type: m.type, // 'income' | 'expense'
      description: finalDesc,
      module: moduleName,
      method: method,
      time: m.created_at ? new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '--:--',
      amount: parseFloat(m.amount || 0),
    })
  })

  // Ordenar por fecha descendente
  return Object.values(groups).sort((a, b) => {
    if (a.dateKey === 'Sin fecha') return 1
    if (b.dateKey === 'Sin fecha') return -1

    return new Date(b.dateKey) - new Date(a.dateKey)
  })
}

const dashboardOptions = async () => {
  loader.start()
  loading.value = true
  try {
    const response = await $api('/dashboard-financiero')

    console.log(response)

    // Asignar el resumen del backend al estado
    if (response.summary) {
      financialSummary.value = {
        ...financialSummary.value,
        monthlyIncome: response.summary.monthlyIncome,
        monthlyExpense: response.summary.monthlyExpense,
        currentBalance: response.summary.currentBalance,
      }
    }

    // Procesar movimientos recientes
    recentMovements.value = groupMovementsByDate(response.movements)

    // Cargar última transferencia para el widget Info. Adicional
    try {
      const transfersResponse = await $api('transfers')
      let dataArray = []
      
      if (transfersResponse.data) {
        dataArray = transfersResponse.data
      } else if (Array.isArray(transfersResponse)) {
        dataArray = transfersResponse
      }

      if (dataArray && dataArray.length > 0) {
        let lastTransferObj = null
        // Verificar si la respuesta viene agrupada o plana
        if (dataArray[0].transfers && dataArray[0].transfers.length > 0) {
          lastTransferObj = dataArray[0].transfers[0]
        } else if (!dataArray[0].transfers) {
          lastTransferObj = dataArray[0]
        }

        if (lastTransferObj) {
          const tDate = (lastTransferObj.transfer_date || lastTransferObj.created_at || '').split('T')[0]
          financialSummary.value = {
            ...financialSummary.value,
            lastTransfer: {
              amount: parseFloat(lastTransferObj.amount || 0),
              date: tDate || '-'
            }
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar la última transferencia', e)
    }

  } catch (error) {
    console.error('Error al cargar datos del dashboard:', error)
    showNotification('No se pudieron cargar los datos financieros', 'error')
  } finally {
    loading.value = false
    loader.stop()
  }
}

// --- Utilidades ---
const handleCardAction = action => {
  switch (action) {
    case 'employee-expenses': router.push('/finanzas/employee-expenses'); break
    case 'register-contribution': router.push({ name: 'aportes-index' }); break
    case 'movements-index': router.push({ name: 'movements-index' }); break
    case 'transfer': router.push('/transfers'); break
  }
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

const generatePDF = async () => {
  pdfLoading.value = true
  try {
    const response = await $api('financial-movements/pdf', {
      method: 'POST',
      responseType: 'blob',
    })

    // Crear un blob y descargar el PDF
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `reporte_financiero_${new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    showNotification('Reporte PDF generado exitosamente', 'success')
  } catch (error) {
    console.error('Error al generar PDF:', error)
    showNotification('Error al generar el reporte PDF', 'error')
  } finally {
    pdfLoading.value = false
  }
}

onMounted(() => {
  dashboardOptions()
})
</script>

<template>
  <div>
    <!-- Pantalla de Bloqueo -->
    <div v-if="!canAccessOperations" class="d-flex justify-center align-center" style="height: 400px">
      <VCard class="pa-6 text-center" elevation="4" rounded="xl">
        <VIcon size="64" color="error" class="mb-4">
          ri-lock-line
        </VIcon>
        <h3 class="text-h5 mb-2">
          Acceso Restringido
        </h3>
        <p class="text-medium-emphasis">
          No tienes permisos para acceder a la gestión de operaciones.
        </p>
        <VBtn color="primary" class="mt-4" @click="router.push('/dashboard')">
          Volver al Dashboard
        </VBtn>
      </VCard>
    </div>

    <!-- Dashboard Principal -->
    <div v-else>
      <!-- Cabecera -->
      <VRow class="mb-4">
        <VCol>
          <div class="d-flex align-center gap-3">
            <VAvatar color="primary" variant="tonal" rounded size="48">
              <VIcon icon="ri-exchange-funds-line" size="28" />
            </VAvatar>
            <div>
              <h4 class="text-h5 font-weight-bold mb-1">
                Gestión de Operaciones
              </h4>
              <span class="text-body-2 text-medium-emphasis">
                Control financiero integral para tu negocio
              </span>
            </div>
          </div>
        </VCol>
      </VRow>

      <!-- Cards de Acceso Rápido -->
      <VRow class="mb-6">
        <VCol v-for="card in mainCards" :key="card.title" cols="12" sm="6" md="3">
          <VCard
            elevation="2"
            class="h-100 rounded-lg cursor-pointer transition-swing"
            hover
            @click="handleCardAction(card.action)"
          >
            <VCardText class="d-flex flex-column align-center text-center pa-6">
              <VAvatar :color="card.color" variant="tonal" size="56" class="mb-4">
                <VIcon :icon="card.icon" size="28" />
              </VAvatar>
              <h5 class="text-subtitle-1 font-weight-bold mb-2">
                {{ card.title }}
              </h5>
              <span class="text-caption text-medium-emphasis">
                {{ card.description }}
              </span>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Estado de Carga -->
      <div v-if="loading" class="d-flex justify-center align-center py-12 my-12">
        <VProgressCircular indeterminate color="primary" size="48" width="5" />
      </div>

      <VRow v-else>
        <!-- Columna Movimientos -->
        <VCol cols="12" md="8">
          <VCard elevation="2" class="rounded-lg h-100">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-history-line" color="primary" />
                  <span class="font-weight-bold text-h6">Movimientos Recientes</span>
                </div>
              </template>
              <template #append>
                <VBtn
                  color="success"
                  prepend-icon="ri-file-pdf-line"
                  :loading="pdfLoading"
                  size="small"
                  variant="tonal"
                  @click="generatePDF"
                >
                  Generar PDF
                </VBtn>
              </template>
            </VCardItem>

            <VCardText class="pa-0">
              <div v-if="recentMovements.length === 0" class="pa-10 text-center text-medium-emphasis">
                <VAvatar color="grey-lighten-3" size="72" class="mb-4">
                  <VIcon icon="ri-folder-info-line" size="36" color="grey" />
                </VAvatar>
                <h3 class="text-h6 font-weight-medium">No hay movimientos</h3>
                <p class="text-body-2 mt-1">No se encontraron registros financieros para este mes.</p>
              </div>

              <VList v-else lines="two" class="bg-transparent" style="max-height: 550px; overflow-y: auto;">
                <template v-for="day in recentMovements" :key="day.dateKey">
                  <VListSubheader class="text-uppercase font-weight-bold text-primary bg-grey-50 pa-4 sticky-top">
                    {{ day.date }}
                  </VListSubheader>

                  <VListItem v-for="movement in day.movements" :key="movement.id" class="border-b movement-item">
                    <template #prepend>
                      <VAvatar
                        :color="movement.type === 'transfer' ? 'info' : (movement.type === 'income' ? 'success' : 'error')"
                        variant="tonal"
                        class="mr-4"
                      >
                        <VIcon :icon="movement.type === 'transfer' ? 'ri-arrow-left-right-line' : (movement.type === 'income' ? 'ri-arrow-down-line' : 'ri-arrow-up-line')" />
                      </VAvatar>
                    </template>

                    <VListItemTitle class="font-weight-medium mb-1">
                      {{ movement.description }}
                    </VListItemTitle>

                    <VListItemSubtitle>
                      <div class="d-flex align-center flex-wrap gap-2 text-caption">
                        <span class="d-flex align-center"><VIcon icon="ri-folder-open-line" size="14" class="mr-1"/>{{ movement.module }}</span>
                        <span class="opacity-50">•</span>
                        <span class="d-flex align-center"><VIcon :icon="movement.method === 'TRANSFERENCIA' ? 'ri-bank-card-line' : 'ri-money-dollar-circle-line'" size="14" class="mr-1"/>{{ movement.method === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo' }}</span>
                        <span class="opacity-50">•</span>
                        <span class="d-flex align-center"><VIcon icon="ri-time-line" size="14" class="mr-1"/>{{ movement.time }}</span>
                      </div>
                    </VListItemSubtitle>

                    <template #append>
                      <div
                        class="font-weight-bold text-subtitle-1"
                        :class="movement.type === 'transfer' ? 'text-info' : (movement.type === 'income' ? 'text-success' : 'text-error')"
                      >
                        {{ movement.type === 'transfer' ? '' : (movement.type === 'income' ? '+' : '-') }}
                        {{ formatCurrency(movement.amount) }}
                      </div>
                    </template>
                  </VListItem>
                </template>
              </VList>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Columna Lateral (Resumen) -->
        <VCol cols="12" md="4" class="d-flex flex-column gap-6">
          <VCard elevation="2" class="rounded-lg">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-pie-chart-line" color="primary" />
                  <span class="font-weight-bold text-h6">Resumen Financiero</span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-5">
              <div class="d-flex justify-space-between align-center mb-4">
                <span class="text-body-1 text-medium-emphasis">Ingresos del mes</span>
                <span class="text-success font-weight-bold text-subtitle-1">{{ formatCurrency(financialSummary.monthlyIncome) }}</span>
              </div>
              <div class="d-flex justify-space-between align-center mb-5">
                <span class="text-body-1 text-medium-emphasis">Egresos del mes</span>
                <span class="text-error font-weight-bold text-subtitle-1">{{ formatCurrency(financialSummary.monthlyExpense) }}</span>
              </div>
              <VDivider class="mb-5" />
              <div class="d-flex justify-space-between align-center">
                <span class="text-subtitle-1 font-weight-bold text-high-emphasis">Balance actual</span>
                <span class="text-h5 font-weight-black text-primary">{{ formatCurrency(financialSummary.currentBalance) }}</span>
              </div>
            </VCardText>
          </VCard>

          <VCard elevation="2" class="rounded-lg">
            <VCardItem class="pa-4 border-b">
              <template #title>
                <div class="d-flex align-center gap-2">
                  <VIcon icon="ri-information-line" color="primary" />
                  <span class="font-weight-bold text-h6">Info. Adicional</span>
                </div>
              </template>
            </VCardItem>
            <VCardText class="pa-5">
              <div class="d-flex align-start gap-4 mb-4">
                <VAvatar color="info" variant="tonal" rounded size="48">
                  <VIcon icon="ri-exchange-line" size="24" />
                </VAvatar>
                <div>
                  <div class="text-caption text-medium-emphasis mb-1 text-uppercase font-weight-medium">Última transferencia</div>
                  <div class="font-weight-bold text-h6">{{ formatCurrency(financialSummary.lastTransfer.amount) }}</div>
                  <div class="text-caption text-medium-emphasis mt-1 d-flex align-center gap-1">
                    <VIcon icon="ri-calendar-event-line" size="14" />
                    {{ financialSummary.lastTransfer.date }}
                  </div>
                </div>
              </div>

              <div v-if="financialSummary.alerts && financialSummary.alerts.length > 0">
                <VAlert
                  v-for="alert in financialSummary.alerts"
                  :key="alert"
                  color="warning"
                  variant="tonal"
                  density="compact"
                  class="mt-4"
                >
                  <template #prepend>
                    <VIcon icon="ri-alert-line" size="small" />
                  </template>
                  {{ alert }}
                </VAlert>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <TransferDialog v-model="isTransferDialogVisible" />
    </div>
  </div>
</template>
