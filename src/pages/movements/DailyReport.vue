<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'

const loading = ref(false)
const reportData = ref([])

const dateRange = ref({
  start_date: '',
  end_date: '',
})

const formatDate = date => {
  if (!date) return 'N/A'

  try {
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida'
    }

    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()

    return `${day}/${month}/${year}`
  } catch (error) {
    console.error('Error al formatear fecha:', error, date)
    
    return 'Error fecha'
  }
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

const loadReport = async () => {
  if (!dateRange.value.start_date || !dateRange.value.end_date) {
    return
  }

  loading.value = true
  try {
    const response = await $api('finance-records/daily-summary', {
      method: 'POST',
      body: dateRange.value,
    })

    reportData.value = response.data || response
    loading.value = false
  } catch (error) {
    console.error('Error al cargar reporte diario:', error)
    loading.value = false
  }
}

const generateReport = async () => {
  if (!dateRange.value.start_date || !dateRange.value.end_date) {
    return
  }

  await loadReport()
}

onMounted(() => {
  // Cargar reporte del último mes por defecto
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  dateRange.value = {
    start_date: firstDay.toISOString().split('T')[0],
    end_date: lastDay.toISOString().split('T')[0],
  }

  loadReport()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h2 class="text-h4 font-weight-bold">
          Reporte Diario
        </h2>
        <p class="text-medium-emphasis mb-0">
          Resumen de movimientos por día
        </p>
      </div>
      <div class="d-flex gap-3">
        <VBtn
          color="primary"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="loadReport"
        >
          Actualizar
        </VBtn>
        <VBtn
          color="success"
          prepend-icon="ri-file-download-line"
          @click="generateReport"
        >
          Generar Reporte
        </VBtn>
      </div>
    </div>

    <!-- Filtros de Fecha -->
    <VCard class="rounded-lg elevation-4 mb-6">
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center gap-2">
          <VIcon icon="ri-calendar-2-line" />
          <span class="text-h6 font-weight-medium">Rango de Fechas</span>
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-4">
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="dateRange.start_date"
              label="Fecha Inicio"
              type="date"
              placeholder="YYYY-MM-DD"
              hide-details
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="dateRange.end_date"
              label="Fecha Fin"
              type="date"
              placeholder="YYYY-MM-DD"
              hide-details
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Tabla de Reporte -->
    <VCard class="rounded-lg elevation-4">
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center gap-2">
          <VIcon icon="ri-bar-chart-line" />
          <span class="text-h6 font-weight-medium">Resumen Diario</span>
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-0">
        <!-- Loading State -->
        <div
          v-if="loading"
          class="d-flex justify-center pa-12"
        >
          <VProgressCircular
            indeterminate
            color="primary"
            size="48"
          />
          <p class="text-medium-emphasis mt-3">
            Cargando reporte...
          </p>
        </div>

        <!-- Tabla de Datos -->
        <VTable
          v-else
          class="report-table"
        >
          <thead>
            <tr>
              <th class="text-left">
                Fecha
              </th>
              <th class="text-center">
                Ingresos
              </th>
              <th class="text-center">
                Egresos
              </th>
              <th class="text-center">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in reportData"
              :key="item.entry_date"
            >
              <td class="text-left font-weight-medium">
                {{ formatDate(item.entry_date) }}
              </td>
              <td class="text-center">
                <span class="text-success font-weight-bold">
                  {{ formatCurrency(item.total_income) }}
                </span>
                <div class="text-caption text-medium-emphasis">
                  ({{ item.income_count }} ingresos)
                </div>
              </td>
              <td class="text-center">
                <span class="text-error font-weight-bold">
                  {{ formatCurrency(item.total_expenses) }}
                </span>
                <div class="text-caption text-medium-emphasis">
                  ({{ item.expense_count }} egresos)
                </div>
              </td>
              <td class="text-center">
                <span
                  class="font-weight-bold"
                  :class="item.balance >= 0 ? 'text-success' : 'text-error'"
                >
                  {{ formatCurrency(item.balance) }}
                </span>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>
    </VCard>
  </div>
</template>

<style scoped>
.report-table {
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.report-table th {
    background-color: #f5f5f5;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.025em;
}

.report-table td {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    padding: 12px 8px;
}

.report-table tr:hover td {
    background-color: #f8f9fa;
}
</style>
