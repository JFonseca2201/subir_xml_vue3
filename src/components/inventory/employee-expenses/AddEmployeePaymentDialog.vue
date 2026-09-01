<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'
import ReceiptUploader from '@/components/common/ReceiptUploader.vue'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  accounts: {
    type: Array,
    default: () => [],
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'created', 'refresh'])

// Estado
const formRef = ref(null)
const employees = ref([])
const accounts = ref([])
const loading = ref(false)
const isLoadingData = ref(false)
const isCheckingMonth = ref(false)
const monthPaidInfo = ref(null)
const pendingAdvances = ref([])
const totalPendingAdvances = ref(0)
const baseSalary = ref(0)
const receiptFiles = ref([])

// Obtener mes actual YYYY-MM
const getCurrentMonthValue = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const form = ref({
  employee_id: null,
  employee_name: '',
  payment_month: getCurrentMonthValue(),
  account_id: null,
  account_name: null,
  amount: 0,
  base_salary: 0,
  description: '',
  payment_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
  payment_method: 'TRANSFERENCIA',
  reference: '',
})

// Opciones de Meses (últimos 12 meses, actual y 2 futuros)
const monthOptions = computed(() => {
  const options = []
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const today = new Date()

  for (let i = 2; i >= -12; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const value = `${year}-${month}`
    const title = `${monthNames[d.getMonth()]} ${year}`
    options.push({ title, value })
  }
  return options
})

// Métodos de pago
const paymentMethods = [
  { text: 'Efectivo', value: 'EFECTIVO' },
  { text: 'Transferencia', value: 'TRANSFERENCIA' },
]

// Computed
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const filteredAccounts = computed(() => {
  const method = form.value.payment_method
  if (!method) return accounts.value

  if (method === 'EFECTIVO') {
    return accounts.value.filter(acc => acc.type === 'cash')
  } else if (method === 'TRANSFERENCIA') {
    return accounts.value.filter(acc => acc.type === 'bank')
  }

  return accounts.value
})

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Notificación Toast
const showToast = (message, type = 'info') => {
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-size: 14px;
        font-weight: 500;
        max-width: 380px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `
  document.body.appendChild(toast)
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 4000)
}

// Cargar Datos
const loadEmployees = async () => {
  try {
    const response = await $api('employees')
    employees.value = response.employees?.map(emp => ({
      ...emp,
      name: `${emp.first_name} ${emp.last_name}`.trim(),
      display_title: `${emp.first_name} ${emp.last_name} (${emp.position || 'Empleado'} - Sueldo: ${formatCurrency(emp.salary)})`,
    })) || []
  } catch (error) {
    console.error('Error al cargar empleados:', error)
  }
}

const transformAccounts = accs => {
  return (accs || []).map(account => {
    const cleanedName = (account.name || '')
      .replace(/\(EFECTIVO\)/gi, '')
      .replace(/\(TRANSFERENCIA\)/gi, '')
      .trim()

    return {
      ...account,
      display_name: `${account.bank_name || 'Cuenta'} (${cleanedName})`,
    }
  })
}

const loadAccounts = async () => {
  try {
    const response = await $api('accounts')
    return transformAccounts(response)
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
    return []
  }
}

// Verificar Pago del Mes Seleccionado
const checkMonthStatus = async () => {
  if (!form.value.employee_id || !form.value.payment_month) {
    monthPaidInfo.value = null
    return
  }

  isCheckingMonth.value = true
  try {
    const response = await $api('employee-expenses/check-month', {
      params: {
        employee_id: form.value.employee_id,
        month: form.value.payment_month,
      }
    })

    if (response.is_paid) {
      monthPaidInfo.value = response
      form.value.amount = 0
      form.value.base_salary = response.existing_payment?.base_salary || 0
      baseSalary.value = response.existing_payment?.base_salary || 0
      pendingAdvances.value = []
      totalPendingAdvances.value = response.existing_payment?.advances_amount || 0
    } else {
      monthPaidInfo.value = null
      baseSalary.value = response.base_salary || 0
      form.value.base_salary = response.base_salary || 0
      totalPendingAdvances.value = response.total_advances || 0
      pendingAdvances.value = response.pending_advances || []
      form.value.amount = response.net_amount || 0
    }
  } catch (error) {
    console.error('Error al verificar mes de pago:', error)
  } finally {
    isCheckingMonth.value = false
  }
}

const resetForm = () => {
  form.value = {
    employee_id: null,
    employee_name: '',
    payment_month: getCurrentMonthValue(),
    account_id: null,
    account_name: null,
    amount: 0,
    base_salary: 0,
    description: '',
    payment_date: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0],
    payment_method: 'TRANSFERENCIA',
    reference: '',
  }
  monthPaidInfo.value = null
  pendingAdvances.value = []
  totalPendingAdvances.value = 0
  baseSalary.value = 0
  receiptFiles.value = []
  formRef.value?.reset()
}

const closeDialog = () => {
  show.value = false
  setTimeout(() => {
    resetForm()
  }, 100)
}

const handleSubmit = async () => {
  if (monthPaidInfo.value?.is_paid) {
    showToast('No se puede registrar el pago porque este mes ya fue liquidado.', 'error')
    return
  }

  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true

  try {
    const formData = new FormData()
    formData.append('employee_id', form.value.employee_id)
    formData.append('payment_month', form.value.payment_month)
    formData.append('account_id', form.value.account_id)
    formData.append('base_salary', form.value.base_salary || baseSalary.value)
    formData.append('amount', form.value.amount)
    formData.append('description', form.value.description || '')
    formData.append('payment_date', form.value.payment_date)
    formData.append('payment_method', form.value.payment_method)
    formData.append('reference', form.value.reference || '')
    formData.append('type', 'payment')

    receiptFiles.value.forEach(f => {
      formData.append('receipts[]', f)
    })

    const response = await $api('employee-expenses', {
      method: 'POST',
      body: formData,
    })

    showToast(response.message || 'Pago de nómina registrado exitosamente.', 'success')

    emit('created', response)
    closeDialog()
  } catch (error) {
    console.error('Error al guardar pago:', error)

    if (error.status === 422) {
      const errorData = error.data
      if (errorData.error === 'month_already_paid') {
        showToast(errorData.message, 'error')
        monthPaidInfo.value = { is_paid: true, message: errorData.message }
        return
      }
      if (errorData.message && errorData.message.includes('Saldo insuficiente')) {
        showToast('Saldo insuficiente en la cuenta seleccionada.', 'error')
        return
      }
      if (errorData.message) {
        showToast(errorData.message, 'error')
        return
      }
    }

    showToast('Error al guardar el pago. Por favor, intente nuevamente.', 'error')
  } finally {
    loading.value = false
  }
}

// Watchers
watch(() => show.value, newVal => {
  if (newVal) {
    resetForm()
    loadEmployees()
    if (props.accounts && props.accounts.length > 0) {
      accounts.value = transformAccounts(props.accounts)
    } else {
      loadAccounts().then(res => accounts.value = res)
    }
  }
})

watch(() => form.value.employee_id, async newId => {
  if (newId) {
    const selectedEmployee = employees.value.find(emp => emp.id === newId)
    if (selectedEmployee) {
      form.value.employee_name = selectedEmployee.name
    }
    await checkMonthStatus()
  } else {
    monthPaidInfo.value = null
    baseSalary.value = 0
    pendingAdvances.value = []
    totalPendingAdvances.value = 0
    form.value.amount = 0
  }
})

watch(() => form.value.payment_month, async newMonth => {
  if (newMonth && form.value.employee_id) {
    await checkMonthStatus()
  }
})

watch(() => form.value.payment_method, () => {
  form.value.account_id = null
})

onMounted(async () => {
  isLoadingData.value = true
  try {
    await loadEmployees()
    if (props.accounts && props.accounts.length > 0) {
      accounts.value = transformAccounts(props.accounts)
    } else {
      accounts.value = await loadAccounts()
    }
  } finally {
    isLoadingData.value = false
  }
})
</script>

<template>
  <VDialog
    v-model="show"
    scrollable
    max-width="880"
    persistent
  >
    <VCard class="custom-dialog-card rounded-xl">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white pa-5 d-flex align-center justify-space-between">
        <div class="d-flex align-center gap-3">
          <VAvatar color="white" variant="tonal" size="44" class="text-white">
            <VIcon icon="ri-file-user-line" size="24" />
          </VAvatar>
          <div>
            <h3 class="text-h6 font-weight-bold text-white mb-0">
              Nuevo Pago de Nómina / Rol de Pagos
            </h3>
            <p class="text-caption text-white-70 mb-0">
              Registra el sueldo mensual, deducción de adelantos y genera el rol oficial
            </p>
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          color="white"
          @click="closeDialog"
        />
      </div>

      <!-- Formulario -->
      <VCardText class="pa-6 bg-slate-50">
        <!-- Skeleton Loader mientras cargan datos -->
        <div v-if="isLoadingData" class="py-4">
          <VRow>
            <VCol cols="12" md="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="12" md="6"><VSkeletonLoader type="text" height="52" class="rounded-lg mb-2" /></VCol>
            <VCol cols="12"><VSkeletonLoader type="card" height="120" class="rounded-lg mb-2" /></VCol>
          </VRow>
        </div>

        <VForm
          v-else
          ref="formRef"
          @submit.prevent="handleSubmit"
        >
          <VRow class="g-3">
            <!-- 1. Selección de Empleado -->
            <VCol cols="12" md="7">
              <VSelect
                v-model="form.employee_id"
                :items="employees"
                item-title="display_title"
                item-value="id"
                label="Empleado a Liquidar *"
                placeholder="Selecciona un empleado"
                :rules="[v => !!v || 'Debes seleccionar un empleado']"
                variant="outlined"
                density="comfortable"
                class="bg-white rounded-lg"
              >
                <template #prepend-inner>
                  <VIcon color="primary" size="20">ri-user-follow-line</VIcon>
                </template>
              </VSelect>
            </VCol>

            <!-- 2. Selección de Mes de Pago -->
            <VCol cols="12" md="5">
              <VSelect
                v-model="form.payment_month"
                :items="monthOptions"
                item-title="title"
                item-value="value"
                label="Mes a Pagar / Liquidar *"
                placeholder="Selecciona el mes"
                :rules="[v => !!v || 'Debes seleccionar el mes a pagar']"
                variant="outlined"
                density="comfortable"
                class="bg-white rounded-lg"
                :loading="isCheckingMonth"
              >
                <template #prepend-inner>
                  <VIcon color="primary" size="20">ri-calendar-check-line</VIcon>
                </template>
              </VSelect>
            </VCol>

            <!-- ALERTA DE MES YA PAGADO (BLOQUEO) -->
            <VCol v-if="monthPaidInfo?.is_paid" cols="12">
              <VAlert
                type="error"
                variant="tonal"
                class="rounded-xl border border-error mb-2 elevation-1"
                prominent
              >
                <template #title>
                  <div class="d-flex align-center gap-2 font-weight-black text-subtitle-1">
                    <VIcon icon="ri-lock-2-line" size="22" />
                    Sueldo Ya Liquidado para este Período
                  </div>
                </template>
                <div class="text-body-2 mt-1">
                  {{ monthPaidInfo.message }}
                </div>
                <div class="d-flex align-center gap-3 mt-3 flex-wrap">
                  <VChip color="error" size="small" variant="flat" class="font-weight-bold">
                    Pago #{{ monthPaidInfo.existing_payment?.id }}
                  </VChip>
                  <VChip color="slate" size="small" variant="outlined" class="font-weight-medium">
                    Fecha: {{ monthPaidInfo.existing_payment?.payment_date }}
                  </VChip>
                  <VChip color="success" size="small" variant="tonal" class="font-weight-bold">
                    Neto Pagado: {{ formatCurrency(monthPaidInfo.existing_payment?.amount) }}
                  </VChip>
                </div>
                <div class="text-caption text-error font-weight-bold mt-2">
                  * No es posible duplicar pagos para el mismo mes. Selecciona otro período o edita el pago existente.
                </div>
              </VAlert>
            </VCol>

            <!-- DESGLOSE FINANCIERO (ROL DE PAGOS EN TIEMPO REAL) -->
            <VCol v-if="form.employee_id && !monthPaidInfo?.is_paid" cols="12">
              <VCard class="pa-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div class="d-flex align-center justify-space-between mb-3 border-b pb-2">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="ri-calculator-line" color="primary" size="20" />
                    <span class="text-subtitle-2 font-weight-bold text-slate-800">
                      Liquidación de Haberes - Rol de Pagos
                    </span>
                  </div>
                  <VChip color="primary" size="small" variant="tonal" class="font-weight-bold">
                    {{ monthOptions.find(m => m.value === form.payment_month)?.title || form.payment_month }}
                  </VChip>
                </div>

                <!-- 3 Tarjetas de Resumen KPI Interno -->
                <VRow class="g-2 text-center mb-3">
                  <VCol cols="12" sm="4">
                    <div class="pa-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div class="text-caption text-medium-emphasis font-weight-medium">Sueldo Base (A)</div>
                      <div class="text-h6 font-weight-bold text-slate-800 mt-0.5">
                        {{ formatCurrency(baseSalary) }}
                      </div>
                    </div>
                  </VCol>
                  <VCol cols="12" sm="4">
                    <div class="pa-3 rounded-lg bg-red-lighten-5 border border-red-200">
                      <div class="text-caption text-error font-weight-medium">Adelantos a Deducir (B)</div>
                      <div class="text-h6 font-weight-bold text-error mt-0.5">
                        -{{ formatCurrency(totalPendingAdvances) }}
                      </div>
                    </div>
                  </VCol>
                  <VCol cols="12" sm="4">
                    <div class="pa-3 rounded-lg bg-green-lighten-5 border border-green-300">
                      <div class="text-caption text-success font-weight-bold">Líquido a Pagar (A - B)</div>
                      <div class="text-h6 font-weight-black text-success mt-0.5">
                        {{ formatCurrency(form.amount) }}
                      </div>
                    </div>
                  </VCol>
                </VRow>

                <!-- Detalle de Adelantos Descontados -->
                <div v-if="pendingAdvances.length > 0" class="mt-2">
                  <div class="text-caption font-weight-bold text-slate-700 mb-1 d-flex align-center gap-1">
                    <VIcon icon="ri-file-list-2-line" size="14" color="warning" />
                    Detalle de Adelantos que serán liquidados en este pago:
                  </div>
                  <div class="rounded-lg border border-slate-200 overflow-hidden">
                    <VTable density="compact" class="text-caption">
                      <thead>
                        <tr class="bg-slate-100">
                          <th class="text-left font-weight-bold">Fecha</th>
                          <th class="text-left font-weight-bold">Motivo / Descripción</th>
                          <th class="text-right font-weight-bold">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="adv in pendingAdvances" :key="adv.id">
                          <td>{{ adv.advance_date }}</td>
                          <td>{{ adv.reason || adv.description || 'Adelanto de sueldo' }}</td>
                          <td class="text-right font-weight-bold text-error">-${{ Number(adv.amount).toFixed(2) }}</td>
                        </tr>
                      </tbody>
                    </VTable>
                  </div>
                </div>
                <div v-else class="text-caption text-medium-emphasis text-center py-1">
                  <em>No registra adelantos pendientes de descuento para este empleado.</em>
                </div>
              </VCard>
            </VCol>

            <!-- 3. Método de Pago y Cuenta -->
            <VCol cols="12" md="6">
              <VSelect
                v-model="form.payment_method"
                :items="paymentMethods"
                item-title="text"
                item-value="value"
                label="Método de Pago *"
                placeholder="Selecciona método"
                :rules="[v => !!v || 'El método de pago es requerido']"
                variant="outlined"
                density="comfortable"
                class="bg-white rounded-lg"
                :disabled="monthPaidInfo?.is_paid"
              >
                <template #prepend-inner>
                  <VIcon color="primary" size="20">ri-bank-card-line</VIcon>
                </template>
              </VSelect>
            </VCol>

            <VCol cols="12" md="6">
              <VSelect
                v-model="form.account_id"
                :items="filteredAccounts"
                item-value="id"
                item-title="display_name"
                label="Cuenta de Salida *"
                placeholder="Selecciona la cuenta"
                :rules="[v => !!v || 'La cuenta es requerida']"
                variant="outlined"
                density="comfortable"
                class="bg-white rounded-lg"
                :disabled="monthPaidInfo?.is_paid"
              >
                <template #prepend-inner>
                  <VIcon color="primary" size="20">
                    {{ form.payment_method === 'EFECTIVO' ? 'ri-money-dollar-circle-line' : 'ri-bank-line' }}
                  </VIcon>
                </template>
                <template #item="{ props, item }">
                  <VListItem v-bind="props" :title="undefined">
                    <template #prepend>
                      <VAvatar
                        size="28"
                        :color="item.raw.type === 'cash' ? 'success' : 'primary'"
                        variant="tonal"
                        class="me-2"
                      >
                        <VIcon
                          :icon="item.raw.type === 'cash' ? 'ri-money-dollar-circle-line' : 'ri-bank-card-line'"
                          size="16"
                        />
                      </VAvatar>
                    </template>
                    <VListItemTitle class="font-weight-medium text-body-2">
                      {{ item.raw.display_name }}
                    </VListItemTitle>
                    <VListItemSubtitle class="text-caption">
                      Saldo disponible: <span class="font-weight-bold" :class="item.raw.saldo_actual >= 0 ? 'text-success' : 'text-error'">
                        ${{ parseFloat(item.raw.saldo_actual || 0).toFixed(2) }}
                      </span>
                    </VListItemSubtitle>
                  </VListItem>
                </template>
              </VSelect>
            </VCol>

            <!-- 4. Fecha de Pago y Referencia -->
            <VCol cols="12" md="6">
              <VTextField
                v-model="form.payment_date"
                label="Fecha de Emisión / Pago *"
                type="date"
                variant="outlined"
                density="comfortable"
                class="bg-white rounded-lg"
                :rules="[v => !!v || 'La fecha es requerida']"
                :disabled="monthPaidInfo?.is_paid"
              />
            </VCol>

            <VCol cols="12" md="6">
              <VTextField
                v-model="form.reference"
                label="Nº Documento / Transferencia (Opcional)"
                placeholder="Ej. TRANS-98421"
                variant="outlined"
                density="comfortable"
                class="bg-white rounded-lg"
                :disabled="monthPaidInfo?.is_paid"
              >
                <template #prepend-inner>
                  <VIcon color="secondary" size="20">ri-hashtag</VIcon>
                </template>
              </VTextField>
            </VCol>

            <!-- 5. Observaciones -->
            <VCol cols="12">
              <VTextarea
                v-model="form.description"
                label="Observaciones o Notas del Rol (Opcional)"
                placeholder="Detalles adicionales sobre el pago del mes..."
                rows="2"
                variant="outlined"
                density="comfortable"
                class="bg-white rounded-lg"
                :disabled="monthPaidInfo?.is_paid"
              />
            </VCol>

            <!-- 6. Adjuntar Comprobantes -->
            <VCol cols="12">
              <ReceiptUploader
                v-model="receiptFiles"
                title="Comprobante de Transferencia / Recibo (Opcional)"
                subtitle="Adjunta fotos o archivos PDF del comprobante bancario"
                :max-files="3"
                :disabled="monthPaidInfo?.is_paid"
              />
            </VCol>
          </VRow>

          <!-- Acciones del Diálogo -->
          <div class="d-flex justify-end align-center gap-3 mt-6 pt-3 border-t">
            <VBtn
              color="secondary"
              variant="outlined"
              class="rounded-lg px-5 font-weight-medium"
              height="42"
              @click="closeDialog"
            >
              Cancelar
            </VBtn>

            <VBtn
              type="submit"
              color="primary"
              variant="elevated"
              prepend-icon="ri-check-line"
              class="rounded-lg px-6 font-weight-bold elevation-2"
              height="42"
              :loading="loading"
              :disabled="monthPaidInfo?.is_paid || isCheckingMonth"
            >
              Guardar y Emitir Pago
            </VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.custom-dialog-card {
  overflow: hidden;
}
.text-white-70 {
  color: rgba(255, 255, 255, 0.8) !important;
}
</style>