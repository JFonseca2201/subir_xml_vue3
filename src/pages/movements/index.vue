<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import IncomeDialog from '@/components/inventory/finances-records/IncomeDialog.vue'
import ExpenseDialog from '@/components/inventory/finances-records/ExpenseDialog.vue'
import DeleteDialog from '@/components/inventory/finances-records/DeleteDialog.vue'
import AttachReceiptsDialog from '@/components/common/AttachReceiptsDialog.vue'
import MovementReceiptNoteDialog from '@/components/inventory/finances-records/MovementReceiptNoteDialog.vue'
import AporteCreateDialog from '@/components/inventory/aportes/AporteCreateDialog.vue'

// Composable instances
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Estado del diálogo
const showIncomeDialog = ref(false)
const showExpenseDialog = ref(false)
const showAporteDialog = ref(false)
const isSavingIncome = ref(false)
const isSavingExpense = ref(false)

// Datos reactivos
const movements = ref([])
const transfersList = ref([])
const accounts = ref([])
const editingMovement = ref(null)
const showDeleteDialog = ref(false)
const movementToDelete = ref(null)
const loading = ref(false)

// Búsqueda y Filtros
const searchWorkOrder = ref('')
const rangeDate = ref(null)
const filterType = ref('')
const filterMonth = ref('')

const backendTotals = ref({
  income: 0,
  expense: 0,
  transfer: 0,
  balance: 0,
})

let searchTimeout = null
watch([searchWorkOrder, rangeDate, filterType, filterMonth], () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadMovements()
  }, 500)
})

// Filtrar movimientos por Ingreso / Egreso
const incomeMovements = computed(() => {
  return movements.value.filter(m => m.type === 0 || m.type === 'income')
})

const expenseMovements = computed(() => {
  return movements.value.filter(m => m.type === 1 || m.type === 'expense')
})

// Computados de totales generales (preferir backendTotals si existen)
const totals = computed(() => {
  if (backendTotals.value.income > 0 || backendTotals.value.expense > 0 || backendTotals.value.transfer > 0) {
    return {
      income: backendTotals.value.income,
      expense: backendTotals.value.expense,
      expenses: backendTotals.value.expense,
      balance: backendTotals.value.balance,
    }
  }
  const income = incomeMovements.value.reduce((acc, m) => acc + parseFloat(m.amount || 0), 0)
  const expenses = expenseMovements.value.reduce((acc, m) => acc + parseFloat(m.amount || 0), 0)

  return {
    income,
    expense: expenses,
    expenses,
    balance: income - expenses,
  }
})

// Agrupar movimientos por día (ingresos y egresos)
const groupedMovements = computed(() => {
  const groups = {}

  movements.value.forEach(movement => {
    const date = movement.entry_date ? movement.entry_date.split('T')[0] : 'Sin fecha'
    if (!groups[date]) {
      groups[date] = {
        date: date,
        movements: [],
        dailyIncome: 0,
        dailyExpenses: 0,
        dailyBalance: 0,
      }
    }

    groups[date].movements.push(movement)

    if (movement.type === 0 || movement.type === 'income') {
      groups[date].dailyIncome += parseFloat(movement.amount || 0)
    } else if (movement.type === 1 || movement.type === 'expense') {
      groups[date].dailyExpenses += parseFloat(movement.amount || 0)
    }

    groups[date].dailyBalance = groups[date].dailyIncome - groups[date].dailyExpenses
  })

  return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date))
})

// Total de movimientos
const totalMovementsCount = computed(() => movements.value.length)

// Funciones de formato
const formatDate = date => {
  if (!date) return '-'

  try {
    if (typeof date === 'string' && date.includes('-')) {
      const dateParts = date.split('T')[0].split(' ')[0]
      const [year, month, day] = dateParts.split('-')

      if (year && month && day) {
        return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`
      }
    }

    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      return date
    }

    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()

    return `${year}/${month}/${day}`
  } catch (error) {
    console.error('Error al formatear fecha:', error, date)

    return String(date)
  }
}

const formatDateHeader = dateStr => {
  if (!dateStr) return 'Movimientos'
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const todayObj = new Date()
    const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
    if (dateStr === today) return 'Hoy'

    const [year, month, day] = dateStr.split('-')
    const date = new Date(year, month - 1, day)

    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
  }

  return formatDate(dateStr)
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const cleanAccountName = name => {
  if (!name) return 'N/A'

  return name
    .replace(/\(EFECTIVO\)/gi, '')
    .replace(/\(TRANSFERENCIA\)/gi, '')
    .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
    .trim()
}

// Determinar con precisión si el método de pago es TRANSFERENCIA o EFECTIVO
const getPaymentMethod = (movement, accountsList = []) => {
  if (movement.type === 'transfer') {
    return 'TRANSFERENCIA'
  }

  const rawMethod = (
    movement.method ||
    movement.payment_method ||
    movement.metodo_pago ||
    movement.movable?.metodo_pago ||
    movement.movable?.payment_method ||
    movement.metadata?.metodo ||
    movement.metadata?.payment_method ||
    ''
  ).toString().toUpperCase()

  if (rawMethod.includes('TRANS') || rawMethod.includes('TRANSFER') || rawMethod.includes('BANCO') || rawMethod.includes('DEPOSITO')) {
    return 'TRANSFERENCIA'
  }

  let accountId = movement.account_id
  if (movement.payment_distributions && movement.payment_distributions.length > 0) {
    accountId = movement.payment_distributions[0].account_id || movement.payment_distributions[0].account || accountId
  }

  if (accountId && accountsList.length > 0) {
    const account = accountsList.find(acc => String(acc.id) === String(accountId))
    if (account) {
      const accType = (account.type || '').toLowerCase()
      const bankName = (account.bank_name || '').toLowerCase()
      const accName = (account.name || '').toLowerCase()

      if (accType === 'bank' || (bankName && !bankName.includes('efectivo') && !bankName.includes('caja'))) {
        return 'TRANSFERENCIA'
      }
      if (accName.includes('transferencia') || accName.includes('banco') || accName.includes('pichincha') || accName.includes('guayaquil') || accName.includes('produbanco') || accName.includes('pacifico')) {
        return 'TRANSFERENCIA'
      }
      if (accType === 'cash' || bankName.includes('efectivo') || bankName.includes('caja') || accName.includes('efectivo') || accName.includes('caja')) {
        return 'EFECTIVO'
      }
    }
  }

  const accLabel = (movement.account_name || movement.account_label || '').toLowerCase()
  if (accLabel.includes('transferencia') || accLabel.includes('banco') || accLabel.includes('pichincha') || accLabel.includes('guayaquil') || accLabel.includes('produbanco') || accLabel.includes('pacifico')) {
    return 'TRANSFERENCIA'
  }

  if (rawMethod === 'CASH') return 'EFECTIVO'

  return 'EFECTIVO'
}

const isGeneratingPDF = ref(false)

// Generar PDF DIRECTAMENTE EN EL BACKEND (Separado por tipo de movimiento)
const generatePDF = async () => {
  isGeneratingPDF.value = true
  try {
    const todayISO = new Date().toISOString().split('T')[0]

    const params = {
      group_by_type: true,
      separate_sections: true,
      include_transfers: true,
      include_incomes: true,
      include_expenses: true,
      search: searchWorkOrder.value || undefined,
      start_date: rangeDate.value ? rangeDate.value.split(" to ")[0]?.trim() || undefined : undefined,
      end_date: rangeDate.value ? rangeDate.value.split(" to ")[1]?.trim() || undefined : undefined,
      type: filterType.value || undefined,
      month: filterMonth.value || undefined,
    }

    let response
    try {
      response = await $api('financial-movements/pdf', {
        method: 'POST',
        body: params,
        responseType: 'blob',
      })
    } catch (postErr) {
      console.warn('POST a financial-movements/pdf falló, reintentando con GET:', postErr)
      response = await $api('financial-movements/pdf', {
        method: 'GET',
        params: params,
        responseType: 'blob',
      })
    }

    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `Reporte_Movimientos_${todayISO}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    showNotification('Reporte PDF (separado por tipos) generado exitosamente desde el servidor', 'success')
  } catch (error) {
    console.error('Error al generar PDF en el backend:', error)
    showNotification('Error al solicitar el reporte PDF al servidor.', 'error')
  } finally {
    isGeneratingPDF.value = false
  }
}

const generatingSingleId = ref(null)

const generateSinglePDF = async movement => {
  generatingSingleId.value = movement.id
  try {
    const response = await $api(`financial-movements/${movement.id}/pdf`, {
      method: 'GET',
      responseType: 'blob',
    })

    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `comprobante_${movement.type === 0 ? 'ingreso' : 'egreso'}_${movement.id}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    showNotification('Comprobante PDF generado exitosamente', 'success')
  } catch (error) {
    console.error('Error al generar PDF individual:', error)
    showNotification('Error al generar el comprobante PDF', 'error')
  } finally {
    generatingSingleId.value = null
  }
}

const openIncomeDialog = () => {
  editingMovement.value = null
  showIncomeDialog.value = true
}

const openExpenseDialog = () => {
  editingMovement.value = null
  showExpenseDialog.value = true
}

const getFinanceRecordId = movement => {
  if (!movement) return null

  let metadata = movement.metadata
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata)
    } catch (e) {
      metadata = {}
    }
  }

  // 1. Validar en metadata
  if (metadata?.finance_record_id) {
    return metadata.finance_record_id
  }

  // 2. Validar en el objeto de la distribución / movable
  if (movement.movable?.finance_record_id) {
    return movement.movable.finance_record_id
  }
  const finRecord = movement.movable?.finance_record || movement.movable?.financeRecord
  if (finRecord?.id) {
    return finRecord.id
  }

  // 3. Fallback al ID del movimiento
  return movement.id
}

const editMovement = movement => {
  let movementForEdit = { ...movement }

  // Extraer datos del FinanceRecord si es un registro manual
  const finRecord = movement.movable?.finance_record || movement.movable?.financeRecord
  if (finRecord) {
    movementForEdit.work_order_number = finRecord.work_order_number
    movementForEdit.invoice_number = finRecord.invoice_number
    if (finRecord.payment_distributions || finRecord.paymentDistributions) {
      movementForEdit.payment_distributions = finRecord.payment_distributions || finRecord.paymentDistributions
    }
  }

  if (movement.paymentDistributions) {
    movementForEdit.payment_distributions = movement.paymentDistributions
  }
  if (!movementForEdit.payment_distributions && movement.payment_distributions) {
    movementForEdit.payment_distributions = movement.payment_distributions
  }

  editingMovement.value = movementForEdit

  // En el listado unificado de movimientos, 'income' o 0 es ingreso, 'expense' o 1 es egreso
  if (movement.type === 0 || movement.type === 'income') {
    showIncomeDialog.value = true
  } else {
    showExpenseDialog.value = true
  }
}

const closeIncomeDialog = () => {
  showIncomeDialog.value = false
  editingMovement.value = null
}

const closeExpenseDialog = () => {
  showExpenseDialog.value = false
  editingMovement.value = null
}

const deleteMovement = movement => {
  movementToDelete.value = movement
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  try {
    const recordId = getFinanceRecordId(movementToDelete.value)

    await $api(`finance-records/${recordId}`, {
      method: 'DELETE',
    })

    showNotification(`${(movementToDelete.value.type === 0 || movementToDelete.value.type === 'income') ? 'Ingreso' : 'Egreso'} eliminado exitosamente`, 'success')
    await loadMovements(false)
    closeDeleteDialog()
  } catch (error) {
    console.error('Error al eliminar movimiento:', error)
    showNotification('Error al eliminar movimiento', 'error')
  }
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  movementToDelete.value = null
}

const prepareFinanceRecordPayload = data => {
  if (data && data.receipts && data.receipts.length > 0) {
    const formData = new FormData()
    Object.keys(data).forEach(key => {
      if (key === 'receipts') {
        data.receipts.forEach(file => {
          formData.append('receipts[]', file)
        })
      } else if (key === 'payments' && Array.isArray(data.payments)) {
        data.payments.forEach((p, idx) => {
          if (p.account_id) formData.append(`payments[${idx}][account_id]`, p.account_id)
          formData.append(`payments[${idx}][amount]`, p.amount || 0)
        })
      } else if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key])
      }
    })
    return formData
  }
  return data
}

const saveIncome = async data => {
  isSavingIncome.value = true
  try {
    const payload = prepareFinanceRecordPayload(data)

    if (editingMovement.value) {
      const recordId = getFinanceRecordId(editingMovement.value)

      if (payload instanceof FormData) {
        payload.append('_method', 'PUT')
        await $api(`finance-records/${recordId}`, {
          method: 'POST',
          body: payload,
        })
      } else {
        await $api(`finance-records/${recordId}`, {
          method: 'PUT',
          body: payload,
        })
      }
      showNotification('Ingreso actualizado exitosamente', 'success')
    } else {
      await $api('finance-records', {
        method: 'POST',
        body: payload,
      })
      showNotification('Ingreso creado exitosamente', 'success')
    }

    closeIncomeDialog()
    await loadMovements(false)
  } catch (error) {
    console.error('Error al guardar ingreso:', error)
    const errMessage = error?.data?.message || (error?.data?.errors ? Object.values(error.data.errors).flat().join(', ') : 'Error al guardar ingreso')
    showNotification(errMessage, 'error')
  } finally {
    isSavingIncome.value = false
  }
}

const saveExpense = async data => {
  isSavingExpense.value = true
  try {
    const payload = prepareFinanceRecordPayload(data)

    if (editingMovement.value) {
      const recordId = getFinanceRecordId(editingMovement.value)

      if (payload instanceof FormData) {
        payload.append('_method', 'PUT')
        await $api(`finance-records/${recordId}`, {
          method: 'POST',
          body: payload,
        })
      } else {
        await $api(`finance-records/${recordId}`, {
          method: 'PUT',
          body: payload,
        })
      }
      showNotification('Egreso actualizado exitosamente', 'success')
    } else {
      await $api('finance-records', {
        method: 'POST',
        body: payload,
      })
      showNotification('Egreso creado exitosamente', 'success')
    }

    closeExpenseDialog()
    await loadMovements(false)
  } catch (error) {
    console.error('Error al guardar egreso:', error)
    const errMessage = error?.data?.message || (error?.data?.errors ? Object.values(error.data.errors).flat().join(', ') : 'Error al guardar egreso')
    showNotification(errMessage, 'error')
  } finally {
    isSavingExpense.value = false
  }
}

const monthsOptions = computed(() => {
  const options = [{ title: 'Todos los meses', value: '' }]
  const date = new Date()
  for (let i = 0; i < 12; i++) {
    const y = date.getFullYear()
    const m = date.getMonth()
    const value = `${y}-${String(m + 1).padStart(2, '0')}`
    const title = new Date(y, m, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

    options.push({
      title: title.replace(/^\w/, c => c.toUpperCase()),
      value: value,
    })
    date.setMonth(date.getMonth() - 1)
  }

  return options
})

const loadMovements = async (showOverlay = true) => {
  loading.value = true
  try {
    const params = {}
    if (searchWorkOrder.value) {
      params.search = searchWorkOrder.value
    }
    if (rangeDate.value) {
      const parts = rangeDate.value.split(" to ")
      if (parts[0]) params.start_date = parts[0].trim()
      if (parts[1]) params.end_date = parts[1].trim()
    }
    if (filterType.value) {
      params.type = filterType.value
    }
    if (filterMonth.value) {
      params.month = filterMonth.value
    }

    const response = await $api('financial-movements', {
      params,
    })

    movements.value = response?.movements || []
    if (response?.totals) {
      backendTotals.value = response.totals
    }
  } catch (error) {
    console.error('Error al cargar movimientos:', error)
    showNotification('Error al cargar movimientos', 'error')
    movements.value = []
  } finally {
    loading.value = false
  }
}

const loadTransfers = async () => {
  try {
    const response = await $api('transfers')
    let dataArray = []
    if (response?.data) {
      dataArray = response.data
    } else if (Array.isArray(response)) {
      dataArray = response
    }

    const flatTransfers = []

    dataArray.forEach(group => {
      const items = group.transfers || [group]

      items.forEach(t => flatTransfers.push(t))
    })

    transfersList.value = flatTransfers
  } catch (e) {
    console.error('Error al cargar transferencias:', e)
  }
}

const loadAccounts = async () => {
  try {
    const response = await $api('accounts')

    accounts.value = response || []
  } catch (error) {
    console.error('Error al cargar cuentas:', error)
  }
}

const getAccountName = movement => {
  if (movement.type === 'transfer') {
    let fromName = movement.metadata?.from_account_name
    let toName = movement.metadata?.to_account_name

    if (!fromName && movement.metadata?.from_account) {
      const acc = accounts.value.find(a => String(a.id) === String(movement.metadata.from_account))
      if (acc) fromName = acc.name || acc.bank_name
    }
    if (!toName && movement.metadata?.to_account) {
      const acc = accounts.value.find(a => String(a.id) === String(movement.metadata.to_account))
      if (acc) toName = acc.name || acc.bank_name
    }

    fromName = fromName || 'Origen'
    toName = toName || 'Destino'

    return `${cleanAccountName(fromName)} → ${cleanAccountName(toName)}`
  }

  if (movement.payment_distributions && movement.payment_distributions.length > 1) {
    return `${movement.payment_distributions.length} cuentas`
  }

  let accountId = movement.account_id
  if (movement.payment_distributions && movement.payment_distributions.length === 1) {
    accountId = movement.payment_distributions[0].account_id || movement.payment_distributions[0].account || accountId
  }

  if (accountId) {
    const account = accounts.value.find(acc => String(acc.id) === String(accountId))
    if (account) {
      const name = account.bank_name || account.name || account.account_name || account.description || `Cuenta ${accountId}`

      return cleanAccountName(name)
    }
  }

  const fallbackName = movement.account_label || movement.account_name || (accountId ? `Cuenta ${accountId}` : 'Desconocida')

  return cleanAccountName(fallbackName)
}

const getMovementDocNumber = movement => {
  // 1. Verificar si existen propiedades directas
  if (movement.work_order_number) return movement.work_order_number
  if (movement.invoice_number) return movement.invoice_number

  // 2. Verificar metadata
  if (movement.metadata) {
    const metadata = movement.metadata
    const docNum = metadata.work_order || metadata.work_order_number || metadata.invoice || metadata.document_number || metadata.invoice_number
    if (docNum) return docNum
  }

  // 3. Verificar relación polimórfica movable
  if (movement.movable) {
    const movable = movement.movable
    if (movable.finance_record) {
      const fr = movable.finance_record
      if (fr.work_order_number) return fr.work_order_number
      if (fr.invoice_number) return fr.invoice_number
    }
    if (movable.work_order_number) return movable.work_order_number
    if (movable.invoice_number) return movable.invoice_number
    if (movable.document_number) return movable.document_number
  }

  return '-'
}

// --- NOTA DE MOVIMIENTO Y COMPROBANTES ---
const isMovementNoteDialogVisible = ref(false)
const selectedMovementForNote = ref(null)

const openMovementNoteDialog = movement => {
  selectedMovementForNote.value = movement
  isMovementNoteDialogVisible.value = true
}

// --- FOTOS, COMPROBANTES Y DESCARGAS ---
const isReceiptsDialogVisible = ref(false)
const selectedMovementReceipt = ref(null)

const isPhotoViewerVisible = ref(false)
const currentPhotoList = ref([])
const currentPhotoIndex = ref(0)
const currentPhotoMovement = ref(null)

const getAttachmentUrl = att => {
  if (!att) return ''

  let rawPath = ''
  if (typeof att === 'object' && att !== null) {
    rawPath = att.file_path || att.url || ''
  } else {
    rawPath = String(att)
  }

  if (!rawPath) return ''

  // Extraer la ruta relativa dentro de storage
  let cleanPath = rawPath
  if (cleanPath.includes('/storage/')) {
    cleanPath = cleanPath.substring(cleanPath.indexOf('/storage/') + '/storage/'.length)
  } else {
    cleanPath = cleanPath.replace(/^\/?storage\/?/, '')
  }

  // Quitar prefijos http previos si aún existen
  cleanPath = cleanPath.replace(/^https?:\/\/[^\/]+\/storage\//, '')
  cleanPath = cleanPath.replace(/^\/+/, '')

  const apiBase = getApiBaseUrl().replace(/\/api\/?$/, '')
  const encodedSegments = cleanPath.split('/').map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/')

  return `${apiBase}/storage/${encodedSegments}`
}

const hasImageAttachment = movement => {
  const atts = movement?.resolved_attachments || movement?.attachments || []
  return atts.some(att => att.is_image || (att.mime_type && att.mime_type.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.file_name || att.file_path || ''))
}

const getFirstImageUrl = movement => {
  const atts = movement?.resolved_attachments || movement?.attachments || []
  const imgAtt = atts.find(att => att.is_image || (att.mime_type && att.mime_type.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.file_name || att.file_path || ''))
  return imgAtt ? getAttachmentUrl(imgAtt) : ''
}

const getMovementAttachableTarget = movement => {
  if (!movement) return { type: 'financial_movement', id: 0 }

  let metadata = movement.metadata
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata)
    } catch (e) {
      metadata = {}
    }
  }

  // 1. Aporte de Capital
  if (movement.partner_id || movement.partner_nombre || movement.type === 'aporte' || movement.movable_type?.includes('AporteCapital')) {
    return {
      type: 'aporte',
      id: movement.movable_id || movement.id,
    }
  }

  // 2. Pago / Anticipo de Empleado
  if (movement.movable_type?.includes('EmployeePayment') || movement.type === 'payment' || movement.referencia === 'employee_payment' || String(movement.type).toLowerCase() === 'pago') {
    return {
      type: 'employee_payment',
      id: movement.movable_id || movement.id,
    }
  }
  if (movement.movable_type?.includes('EmployeeAdvance') || movement.referencia === 'employee_advance') {
    return {
      type: 'employee_advance',
      id: movement.movable_id || movement.id,
    }
  }

  // 3. Transferencia Interna
  if (movement.type === 'transfer' || movement.movable_type?.includes('InternalTransfer')) {
    return {
      type: 'internal_transfer',
      id: movement.movable_id || movement.id,
    }
  }

  // 4. Venta (Sale)
  if (movement.movable_type?.includes('Sale')) {
    return {
      type: 'sale',
      id: movement.movable_id || movement.id,
    }
  }

  // 5. Orden de Trabajo (WorkOrder)
  if (movement.movable_type?.includes('WorkOrder')) {
    return {
      type: 'work_order',
      id: movement.movable_id || movement.id,
    }
  }

  // 6. Factura / Compra (Invoice)
  if (movement.movable_type?.includes('Invoice')) {
    return {
      type: 'invoice',
      id: movement.movable_id || movement.id,
    }
  }

  // 7. FinanceRecord (manual o PaymentDistribution)
  const finRecordId = metadata?.finance_record_id || movement.movable?.finance_record_id || movement.movable?.finance_record?.id || movement.movable?.financeRecord?.id || (movement.movable_type?.includes('FinanceRecord') ? movement.movable_id : null)
  if (finRecordId) {
    return {
      type: 'finance_record',
      id: finRecordId,
    }
  }

  // 8. Fallback a Financial Movement directo
  return {
    type: 'financial_movement',
    id: movement.id,
  }
}

const getMovementAttachableType = movement => getMovementAttachableTarget(movement).type
const getMovementAttachableId = movement => getMovementAttachableTarget(movement).id

const openAttachDialog = movement => {
  selectedMovementReceipt.value = movement
  isReceiptsDialogVisible.value = true
}

const previewMovementPhoto = (movement, index = 0) => {
  const atts = movement?.resolved_attachments || movement?.attachments || []
  if (!atts || atts.length === 0) {
    openAttachDialog(movement)
    return
  }
  currentPhotoMovement.value = movement
  currentPhotoList.value = atts
  currentPhotoIndex.value = index >= 0 && index < atts.length ? index : 0
  isPhotoViewerVisible.value = true
}

const currentActivePhoto = computed(() => {
  if (!currentPhotoList.value || currentPhotoList.value.length === 0) return null
  return currentPhotoList.value[currentPhotoIndex.value] || currentPhotoList.value[0]
})

const isCurrentPhotoAnImage = computed(() => {
  const photo = currentActivePhoto.value
  if (!photo) return false
  return photo.is_image || (photo.mime_type && photo.mime_type.startsWith('image/')) || /\.(jpg|jpeg|png|webp|gif)$/i.test(photo.file_name || photo.file_path || '')
})

const isDownloading = ref(false)

const downloadAttachment = async att => {
  if (!att) return
  isDownloading.value = true
  try {
    const url = getAttachmentUrl(att)
    const fileName = att.file_name || att.original_name || 'comprobante'

    const response = await fetch(url)
    if (!response.ok) throw new Error('Error al descargar archivo')
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
    showNotification('Descarga completada', 'success')
  } catch (error) {
    const a = document.createElement('a')
    a.href = getAttachmentUrl(att)
    a.download = att.file_name || 'comprobante'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    isDownloading.value = false
  }
}

const downloadFirstAttachment = movement => {
  const atts = movement?.resolved_attachments || movement?.attachments || []
  if (atts && atts.length > 0) {
    downloadAttachment(atts[0])
  } else {
    openAttachDialog(movement)
  }
}

onMounted(() => {
  loadAccounts()
  loadMovements()
  loadTransfers()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 movements-page">
    <!-- Header de la Página -->
    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <h2 class="text-h4 font-weight-bold text-high-emphasis mb-1 d-flex align-center gap-2">
          <VIcon icon="ri-exchange-dollar-line" color="primary" class="me-1" />
          Ingresos y Gastos
        </h2>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">
          Control financiero integral de movimientos de caja y cuentas
        </p>
      </div>
    </div>

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
              icon="ri-exchange-dollar-line"
              size="24"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h6 font-weight-bold text-high-emphasis mb-0 operations-page-title">
                Ingresos y Egresos
              </h1>
              <VChip
                size="small"
                color="primary"
                variant="tonal"
                class="font-weight-bold"
              >
                {{ totalMovementsCount }} {{ totalMovementsCount === 1 ? 'registro' : 'registros' }}
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0 mt-0 operations-page-subtitle">
              Administración financiera y control de movimientos de caja y cuentas
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-3 flex-wrap">
          <VBtn
            color="secondary"
            variant="tonal"
            size="small"
            prepend-icon="ri-file-pdf-line"
            class="font-weight-semibold"
            :loading="isGeneratingPDF"
            @click="generatePDF"
          >
            Exportar PDF
          </VBtn>
          <VBtn
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="ri-group-line"
            class="font-weight-semibold"
            @click="showAporteDialog = true"
          >
            Aporte Socio
          </VBtn>
          <VBtn
            color="success"
            variant="elevated"
            size="small"
            prepend-icon="ri-add-circle-line"
            class="font-weight-semibold elevation-2"
            @click="openIncomeDialog"
          >
            Nuevo Ingreso
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            size="small"
            prepend-icon="ri-indeterminate-circle-line"
            class="font-weight-semibold elevation-2"
            @click="openExpenseDialog"
          >
            Nuevo Egreso
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Tarjetas de Resumen KPI con colores tonales -->
    <VRow class="mb-5">
      <!-- Total Ingresos -->
      <VCol
        cols="12"
        sm="6"
        md="4"
      >
        <VCard 
          class="pa-4 rounded-xl tonal-card bg-success-tonal border-success cursor-pointer transition-all hover-scale operations-kpi-card" 
          :class="{ 'active-card border-2 elevation-3': filterType === 'income', 'opacity-60': filterType && filterType !== 'income' }"
          elevation="0"
          @click="filterType = filterType === 'income' ? '' : 'income'"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-success text-uppercase tracking-wider">
                Total Ingresos
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(totals.income) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma total de ingresos registrados
              </span>
            </div>
            <VAvatar
              color="success"
              variant="elevated"
              size="42"
              class="elevation-2 kpi-avatar"
            >
              <VIcon
                size="24"
                icon="ri-arrow-right-up-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Total Egresos -->
      <VCol
        cols="12"
        sm="6"
        md="4"
      >
        <VCard 
          class="pa-4 rounded-xl tonal-card bg-error-tonal border-error cursor-pointer transition-all hover-scale operations-kpi-card" 
          :class="{ 'active-card border-2 elevation-3': filterType === 'expense', 'opacity-60': filterType && filterType !== 'expense' }"
          elevation="0"
          @click="filterType = filterType === 'expense' ? '' : 'expense'"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-error text-uppercase tracking-wider">
                Total Egresos
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(totals.expenses) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma total de egresos registrados
              </span>
            </div>
            <VAvatar
              color="error"
              variant="elevated"
              size="42"
              class="elevation-2 kpi-avatar"
            >
              <VIcon
                size="24"
                icon="ri-arrow-right-down-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Balance Neto -->
      <VCol
        cols="12"
        sm="12"
        md="4"
      >
        <VCard 
          class="pa-4 rounded-xl tonal-card bg-primary-tonal border-primary cursor-pointer transition-all hover-scale operations-kpi-card" 
          :class="{ 'active-card border-2 elevation-3': filterType === '', 'opacity-60': filterType }"
          elevation="0"
          @click="filterType = ''"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-primary text-uppercase tracking-wider">
                Balance Neto
              </span>
              <div class="text-h5 font-weight-extrabold text-high-emphasis mt-1 kpi-amount">
                {{ formatCurrency(totals.balance) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Diferencia Ingresos - Egresos
              </span>
            </div>
            <VAvatar
              color="primary"
              variant="elevated"
              size="42"
              class="elevation-2 kpi-avatar"
            >
              <VIcon
                size="24"
                icon="ri-wallet-3-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Barra de Filtros de Búsqueda -->
    <VCard class="pa-4 mb-6 rounded-xl border-light elevation-1">
      <VRow
        align="center"
        density="comfortable"
      >
        <!-- Buscar por texto -->
        <VCol
          cols="12"
          sm="6"
          md="3"
        >
          <VTextField
            v-model="searchWorkOrder"
            prepend-inner-icon="ri-search-2-line"
            placeholder="Buscar por OT, Factura..."
            hide-details
            clearable
            variant="outlined"
            density="compact"
            :loading="loading"
          />
        </VCol>

        <!-- Filtrar por Mes -->
        <VCol
          cols="12"
          sm="6"
          md="3"
        >
          <VSelect
            v-model="filterMonth"
            :items="monthsOptions"
            item-title="title"
            item-value="value"
            label="Filtrar por Mes"
            prepend-inner-icon="ri-calendar-event-line"
            hide-details
            variant="outlined"
            density="compact"
          />
        </VCol>

        <!-- Filtrar por Tipo -->
        <VCol
          cols="12"
          sm="6"
          md="3"
        >
          <VSelect
            v-model="filterType"
            :items="[
              { title: 'Todos los tipos', value: '' },
              { title: 'Ingresos', value: 'income' },
              { title: 'Egresos', value: 'expense' },
              { title: 'Transferencias', value: 'transfer' }
            ]"
            item-title="title"
            item-value="value"
            label="Tipo de Movimiento"
            prepend-inner-icon="ri-equalizer-line"
            hide-details
            variant="outlined"
            density="compact"
          />
        </VCol>

        <!-- Rango de Fechas -->
        <VCol
          cols="12"
          sm="6"
          md="3"
        >
          <AppDateTimePicker
            v-model="rangeDate"
            label="Rango de fechas"
            placeholder="Seleccionar rango"
            :config="{ mode: 'range' }"
            variant="outlined"
            density="compact"
            hide-details
            clearable
          />
        </VCol>
      </VRow>
    </VCard>

    <!-- Cargando -->
    <!-- Sin registros iniciales (Base de datos vacía) -->
    <VCard
      v-if="!loading && !movements.length"
      class="text-center pa-12 rounded-xl border-light elevation-1"
    >
      <VAvatar
        color="primary"
        variant="tonal"
        size="80"
        class="mb-4"
      >
        <VIcon
          icon="ri-inbox-line"
          size="42"
          color="primary"
        />
      </VAvatar>
      <h3 class="text-h6 font-weight-bold text-high-emphasis">
        No hay movimientos para mostrar
      </h3>
      <p class="text-body-2 text-medium-emphasis max-w-md mx-auto mt-1 mb-6">
        Intenta ajustar los filtros de búsqueda o registra un nuevo ingreso o egreso.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn
          color="success"
          variant="elevated"
          prepend-icon="ri-add-line"
          class="font-weight-semibold"
          @click="openIncomeDialog"
        >
          Agregar Ingreso
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          prepend-icon="ri-subtract-line"
          class="font-weight-semibold"
          @click="openExpenseDialog"
        >
          Agregar Egreso
        </VBtn>
      </div>
    </VCard>

    <!-- Lista de Movimientos Unificada (Se muestra si está cargando o si ya hay registros) -->
    <VCard
      v-else
      class="rounded-xl border-light overflow-hidden elevation-1 transfer-table-container position-relative"
    >
      <VProgressLinear
        v-if="loading"
        v-slot
        indeterminate
        color="primary"
        height="3"
        class="position-absolute"
        style="top: 0; left: 0; right: 0; z-index: 10;"
      />

      <VTable
        hover
        class="transfer-table"
      >
        <thead>
          <tr>
            <th
              class="text-left py-3"
              style="width: 14%; min-width: 100px;"
            >
              OT / FACTURA
            </th>
            <th
              class="text-left py-3"
              style="width: 12%; min-width: 110px;"
            >
              TIPO
            </th>
            <th
              class="text-left py-3"
              style="width: 26%; min-width: 180px;"
            >
              DESCRIPCIÓN & FECHA
            </th>
            <th
              class="text-center py-3"
              style="width: 12%; min-width: 110px;"
            >
              COMPROBANTE
            </th>
            <th
              class="text-left py-3"
              style="width: 16%; min-width: 140px;"
            >
              CUENTA & MÉTODO
            </th>
            <th
              class="text-right py-3"
              style="width: 10%; min-width: 90px;"
            >
              MONTO
            </th>
            <th
              class="text-center py-3"
              style="width: 10%; min-width: 120px;"
            >
              ACCIONES
            </th>
          </tr>
        </thead>

        <!-- Cargando (Skeleton Rows) -->
        <tbody v-if="loading">
          <tr
            v-for="n in 5"
            :key="n"
            class="skeleton-row align-middle"
          >
            <td class="py-4">
              <div class="shimmer-line w-40" />
            </td>
            <td class="py-4">
              <div class="shimmer-chip" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-75 mb-2" />
              <div class="shimmer-line w-40" />
            </td>
            <td class="py-4 text-center">
              <div class="shimmer-chip mx-auto" style="width: 40px; height: 40px; border-radius: 8px;" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-60" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-40 ms-auto" />
            </td>
            <td class="py-4 text-center">
              <div class="d-flex justify-center gap-2">
                <div class="shimmer-button" />
                <div class="shimmer-button" />
                <div class="shimmer-button" />
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Sin resultados filtrados -->
        <tbody v-else-if="groupedMovements.length === 0">
          <tr>
            <td
              colspan="7"
              class="text-center py-12 text-medium-emphasis"
            >
              <VAvatar
                color="primary"
                variant="tonal"
                size="64"
                class="mb-3"
              >
                <VIcon
                  icon="ri-inbox-line"
                  size="32"
                  color="primary"
                />
              </VAvatar>
              <div class="text-h6 font-weight-bold text-high-emphasis">
                Sin resultados para la búsqueda
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                Prueba cambiando el término de búsqueda o limpia el filtro aplicado.
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Datos reales -->
        <tbody v-else>
          <template
            v-for="day in groupedMovements"
            :key="day.date"
          >
            <!-- Fila de Encabezado por Fecha -->
            <tr class="transfer-date-header-row">
              <td colspan="7">
                <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      size="32"
                      rounded="lg"
                    >
                      <VIcon
                        icon="ri-calendar-event-line"
                        size="18"
                        color="primary"
                      />
                    </VAvatar>
                    <div class="d-flex align-center gap-2">
                      <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
                        {{ formatDateHeader(day.date) }}
                      </span>
                      <span class="text-caption text-medium-emphasis">
                        • {{ day.movements.length }} {{ day.movements.length === 1 ?
                          'movimiento' : 'movimientos' }}
                      </span>
                    </div>
                  </div>

                  <div class="d-flex align-center gap-3 me-2">
                    <span class="text-caption text-success font-weight-bold">
                      Ingresos: +{{ formatCurrency(day.dailyIncome) }}
                    </span>
                    <span class="text-caption text-error font-weight-bold">
                      Egresos: -{{ formatCurrency(day.dailyExpenses) }}
                    </span>
                    <span
                      class="text-caption font-weight-bold"
                      :class="day.dailyBalance >= 0 ? 'text-success' : 'text-error'"
                    >
                      Balance: {{ formatCurrency(day.dailyBalance) }}
                    </span>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Filas de Movimientos para ese día -->
            <tr
              v-for="movement in day.movements"
              :key="movement.id"
              class="transfer-row"
            >
              <!-- OT / Factura -->
              <td class="py-3">
                <span
                  class="text-body-2 font-weight-black text-slate-900 cursor-pointer"
                  title="Clic para ver nota completa y comprobantes"
                  @click="openMovementNoteDialog(movement)"
                >
                  {{ getMovementDocNumber(movement) }}
                </span>
              </td>

              <!-- Tipo (Ingreso vs Egreso) -->
              <td class="py-3">
                <VChip
                  v-if="movement.type === 0 || movement.type === 'income'"
                  color="success"
                  variant="tonal"
                  size="small"
                  class="font-weight-bold text-uppercase"
                >
                  <VIcon start icon="ri-arrow-down-line" size="14" />
                  Ingreso
                </VChip>
                <VChip
                  v-else-if="movement.type === 1 || movement.type === 'expense'"
                  color="error"
                  variant="tonal"
                  size="small"
                  class="font-weight-bold text-uppercase"
                >
                  <VIcon start icon="ri-arrow-up-line" size="14" />
                  Egreso
                </VChip>
                <VChip
                  v-else-if="movement.type === 'transfer'"
                  color="info"
                  variant="tonal"
                  size="small"
                  class="font-weight-bold text-uppercase"
                >
                  <VIcon start icon="ri-arrow-left-right-line" size="14" />
                  Transferencia
                </VChip>
                <VChip
                  v-else
                  color="secondary"
                  variant="tonal"
                  size="small"
                  class="font-weight-bold text-uppercase"
                >
                  {{ movement.type }}
                </VChip>
              </td>

              <!-- Descripción & Fecha -->
              <td class="py-3">
                <div
                  class="d-flex flex-column cursor-pointer text-left"
                  title="Clic para ver nota completa y comprobantes"
                  @click="openMovementNoteDialog(movement)"
                >
                  <span class="text-body-2 font-weight-bold text-slate-900 mb-0.5">
                    {{ movement.description || 'Sin descripción' }}
                  </span>
                  <span class="text-caption text-medium-emphasis d-flex align-center gap-1 font-weight-medium">
                    <VIcon icon="ri-calendar-line" size="12" class="text-slate-400" />
                    {{ formatDate(movement.entry_date) }}
                  </span>
                </div>
              </td>

              <!-- Comprobante / Foto -->
              <td class="py-3 text-center">
                <div
                  v-if="movement.resolved_attachments && movement.resolved_attachments.length > 0"
                  class="d-flex align-center justify-center gap-1"
                >
                  <!-- Miniatura interactiva de foto -->
                  <div
                    v-if="hasImageAttachment(movement)"
                    class="position-relative cursor-pointer attachment-thumb-wrapper"
                    title="Clic para ver foto en tamaño completo"
                    @click="previewMovementPhoto(movement)"
                  >
                    <VAvatar
                      size="38"
                      rounded="lg"
                      class="border elevation-1 attachment-thumbnail"
                    >
                      <VImg
                        :src="getFirstImageUrl(movement)"
                        cover
                      />
                    </VAvatar>
                    <span
                      v-if="movement.resolved_attachments.length > 1"
                      class="attachment-count-badge"
                    >
                      +{{ movement.resolved_attachments.length - 1 }}
                    </span>
                  </div>

                  <!-- Icono si solo es PDF o documento -->
                  <VBtn
                    v-else
                    size="small"
                    variant="tonal"
                    color="primary"
                    icon="ri-file-text-line"
                    title="Ver documento adjunto"
                    @click="previewMovementPhoto(movement)"
                  />

                  <!-- Botón rápido de descarga directa -->
                  <VBtn
                    title="Descargar Foto / Comprobante"
                    size="x-small"
                    variant="text"
                    color="secondary"
                    icon="ri-download-2-line"
                    @click.stop="downloadFirstAttachment(movement)"
                  />
                </div>

                <!-- Si no tiene comprobante aún -->
                <div v-else>
                  <VBtn
                    v-if="movement.type !== 'transfer'"
                    size="x-small"
                    variant="tonal"
                    color="secondary"
                    prepend-icon="ri-attachment-line"
                    class="text-caption text-none font-weight-medium"
                    @click="openAttachDialog(movement)"
                  >
                    Adjuntar
                  </VBtn>
                  <span
                    v-else
                    class="text-caption text-disabled"
                  >
                    —
                  </span>
                </div>
              </td>

              <!-- Cuenta & Método -->
              <td class="py-3">
                <div class="d-flex align-center gap-2">
                  <VAvatar
                    size="32"
                    color="primary"
                    variant="tonal"
                    class="rounded-lg shrink-0"
                  >
                    <VIcon
                      size="16"
                      icon="ri-bank-line"
                    />
                  </VAvatar>
                  <div class="d-flex flex-column text-left">
                    <span class="text-body-2 font-weight-bold text-slate-900">
                      {{ getAccountName(movement) }}
                    </span>
                    <span
                      class="text-medium-emphasis font-weight-semibold text-uppercase"
                      style="font-size: 10px !important;"
                    >
                      {{ getPaymentMethod(movement, accounts) }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Monto -->
              <td class="py-3 text-right">
                <span
                  class="text-subtitle-1 font-weight-black me-1"
                  :class="(movement.type === 0 || movement.type === 'income') ? 'text-success' : ((movement.type === 1 || movement.type === 'expense') ? 'text-error' : 'text-info')"
                >
                  {{ (movement.type === 0 || movement.type === 'income') ? '+' : ((movement.type === 1 || movement.type
                    === 'expense') ? '-' : '') }}{{ formatCurrency(movement.amount) }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="py-3 text-center">
                <div class="d-flex align-center justify-center gap-1">
                  <!-- Botón Principal: Ver Nota y Comprobantes -->
                  <VBtn
                    title="Ver Nota y Comprobantes"
                    size="small"
                    variant="tonal"
                    color="primary"
                    icon="ri-eye-line"
                    class="action-btn"
                    @click="openMovementNoteDialog(movement)"
                  />

                  <!-- Menú Pro de Acciones Secundarias -->
                  <VMenu
                    v-if="movement.type !== 'transfer'"
                    location="bottom end"
                    transition="scale-transition"
                  >
                    <template #activator="{ props: menuProps }">
                      <VBtn
                        v-bind="menuProps"
                        size="small"
                        variant="text"
                        color="secondary"
                        icon="ri-more-2-fill"
                        class="action-btn"
                        title="Más opciones"
                      />
                    </template>

                    <VList
                      density="compact"
                      elevation="6"
                      class="py-1 rounded-lg"
                      min-width="200"
                    >
                      <VListItem
                        :disabled="generatingSingleId === movement.id"
                        @click="generateSinglePDF(movement)"
                      >
                        <template #prepend>
                          <VIcon
                            icon="ri-file-pdf-line"
                            color="info"
                            size="18"
                            class="me-2"
                          />
                        </template>
                        <VListItemTitle class="font-weight-medium text-body-2">
                          Descargar PDF
                        </VListItemTitle>
                      </VListItem>

                      <VListItem @click="openAttachDialog(movement)">
                        <template #prepend>
                          <VIcon
                            icon="ri-attachment-2"
                            color="secondary"
                            size="18"
                            class="me-2"
                          />
                        </template>
                        <VListItemTitle class="font-weight-medium text-body-2">
                          Adjuntar Comprobante
                        </VListItemTitle>
                      </VListItem>

                      <VListItem @click="editMovement(movement)">
                        <template #prepend>
                          <VIcon
                            icon="ri-edit-line"
                            color="warning"
                            size="18"
                            class="me-2"
                          />
                        </template>
                        <VListItemTitle class="font-weight-medium text-body-2">
                          Editar Registro
                        </VListItemTitle>
                      </VListItem>

                      <VDivider class="my-1" />

                      <VListItem
                        class="text-error"
                        @click="deleteMovement(movement)"
                      >
                        <template #prepend>
                          <VIcon
                            icon="ri-delete-bin-line"
                            color="error"
                            size="18"
                            class="me-2"
                          />
                        </template>
                        <VListItemTitle class="font-weight-medium text-body-2 text-error">
                          Eliminar Registro
                        </VListItemTitle>
                      </VListItem>
                    </VList>
                  </VMenu>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </VTable>
    </VCard>

    <!-- Diálogos -->
    <IncomeDialog
      v-model="showIncomeDialog"
      :editing-movement="editingMovement"
      :is-saving="isSavingIncome"
      @saved="saveIncome"
    />
    <ExpenseDialog
      v-model="showExpenseDialog"
      :editing-movement="editingMovement"
      :is-saving="isSavingExpense"
      @saved="saveExpense"
    />
    <DeleteDialog
      v-model="showDeleteDialog"
      :movement="movementToDelete"
      @confirm="confirmDelete"
    />

    <!-- Diálogo de Aporte de Socio (VDialog) -->
    <AporteCreateDialog
      v-model="showAporteDialog"
      @created="() => loadMovements(false)"
    />

    <!-- Diálogo de Nota de Movimiento y Comprobantes -->
    <MovementReceiptNoteDialog
      v-if="selectedMovementForNote"
      v-model="isMovementNoteDialogVisible"
      :movement="selectedMovementForNote"
      :accounts="accounts"
      @updated="() => loadMovements(false)"
    />

    <!-- Diálogo de Gestión de Comprobantes Adjuntos -->
    <AttachReceiptsDialog
      v-if="selectedMovementReceipt"
      :is-dialog-visible="isReceiptsDialogVisible"
      :attachable-type="getMovementAttachableType(selectedMovementReceipt)"
      :attachable-id="getMovementAttachableId(selectedMovementReceipt)"
      :title="`Comprobantes de ${selectedMovementReceipt.description || getMovementDocNumber(selectedMovementReceipt)}`"
      :identifier="getMovementDocNumber(selectedMovementReceipt)"
      :party-name="selectedMovementReceipt.description"
      @update:is-dialog-visible="val => { isReceiptsDialogVisible = val; if (!val) selectedMovementReceipt = null; }"
      @updated="() => loadMovements(false)"
    />

    <!-- Lightbox / Visor de Fotos en Pantalla Completa con Descarga -->
    <VDialog
      v-model="isPhotoViewerVisible"
      max-width="920"
      scrollable
    >
      <VCard class="rounded-xl overflow-hidden elevation-10">
        <!-- Header del Visor Primary -->
        <VCardTitle class="d-flex align-center justify-space-between bg-primary text-white pa-4 flex-none">
          <div class="d-flex align-center gap-3">
            <VAvatar
              color="white"
              variant="tonal"
              size="38"
              rounded="lg"
            >
              <VIcon
                icon="ri-image-line"
                color="white"
                size="22"
              />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold text-white leading-tight text-truncate" style="max-width: 450px;">
                {{ currentActivePhoto?.file_name || 'Comprobante de Pago' }}
              </div>
              <div class="text-caption text-white opacity-80">
                Archivo {{ currentPhotoIndex + 1 }} de {{ currentPhotoList.length }}
                <span v-if="currentPhotoMovement"> • {{ getMovementDocNumber(currentPhotoMovement) }}</span>
              </div>
            </div>
          </div>
          <div class="d-flex align-center gap-2">
            <!-- Botón de Descarga Principal -->
            <VBtn
              color="white"
              variant="tonal"
              prepend-icon="ri-download-2-line"
              size="small"
              class="font-weight-medium text-white me-1"
              :loading="isDownloading"
              @click="downloadAttachment(currentActivePhoto)"
            >
              Descargar
            </VBtn>
            <VBtn
              icon="ri-close-line"
              variant="text"
              color="white"
              size="small"
              @click="isPhotoViewerVisible = false"
            />
          </div>
        </VCardTitle>

        <!-- Cuerpo del Visor -->
        <VCardText class="pa-4 bg-grey-lighten-4 d-flex align-center justify-center position-relative" style="min-height: 440px; max-height: 75vh; overflow: auto;">
          <!-- Navegación Anterior -->
          <VBtn
            v-if="currentPhotoList.length > 1"
            icon="ri-arrow-left-s-line"
            variant="elevated"
            color="primary"
            class="position-absolute elevation-4"
            style="left: 16px; z-index: 10;"
            :disabled="currentPhotoIndex === 0"
            @click="currentPhotoIndex--"
          />

          <!-- Visualización de Imagen -->
          <div v-if="isCurrentPhotoAnImage" class="d-flex align-center justify-center w-100 h-100 pa-2">
            <img
              :src="getAttachmentUrl(currentActivePhoto)"
              :alt="currentActivePhoto?.file_name || 'Comprobante'"
              class="img-fluid rounded-xl elevation-4 border"
              style="max-width: 100%; max-height: 68vh; object-fit: contain; background: white;"
            />
          </div>

          <!-- Visualización si es PDF -->
          <div v-else class="d-flex flex-column align-center justify-center pa-8 text-center">
            <VAvatar
              color="error"
              size="72"
              variant="tonal"
              class="mb-4"
            >
              <VIcon
                icon="ri-file-pdf-2-line"
                size="40"
              />
            </VAvatar>
            <div class="text-h6 font-weight-bold mb-1 text-high-emphasis">
              Documento PDF
            </div>
            <div class="text-body-2 text-medium-emphasis mb-4">
              {{ currentActivePhoto?.file_name }}
            </div>
            <div class="d-flex gap-3">
              <VBtn
                color="primary"
                variant="elevated"
                prepend-icon="ri-external-link-line"
                target="_blank"
                :href="getAttachmentUrl(currentActivePhoto)"
              >
                Abrir PDF en pestaña
              </VBtn>
              <VBtn
                color="success"
                variant="tonal"
                prepend-icon="ri-download-2-line"
                @click="downloadAttachment(currentActivePhoto)"
              >
                Descargar PDF
              </VBtn>
            </div>
          </div>

          <!-- Navegación Siguiente -->
          <VBtn
            v-if="currentPhotoList.length > 1"
            icon="ri-arrow-right-s-line"
            variant="elevated"
            color="primary"
            class="position-absolute elevation-4"
            style="right: 16px; z-index: 10;"
            :disabled="currentPhotoIndex === currentPhotoList.length - 1"
            @click="currentPhotoIndex++"
          />
        </VCardText>

        <!-- Footer del Visor -->
        <VCardActions class="pa-4 bg-white border-t d-flex justify-space-between align-center flex-none">
          <div class="text-caption text-medium-emphasis font-weight-medium">
            <span v-if="currentActivePhoto?.file_size">
              Tamaño: {{ (currentActivePhoto.file_size / 1024).toFixed(1) }} KB
            </span>
          </div>
          <div class="d-flex gap-2">
            <VBtn
              variant="tonal"
              color="primary"
              size="small"
              prepend-icon="ri-attachment-2"
              class="font-weight-medium"
              @click="() => { isPhotoViewerVisible = false; openAttachDialog(currentPhotoMovement); }"
            >
              Gestionar Adjuntos
            </VBtn>
            <VBtn
              variant="tonal"
              color="secondary"
              size="small"
              class="font-weight-medium px-4"
              @click="isPhotoViewerVisible = false"
            >
              Cerrar
            </VBtn>
          </div>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.sticky-header {
  position: sticky;
  top: 62px;
  z-index: 99;
  background-color: rgb(var(--v-theme-surface)) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08) !important;
  transition: all 0.2s ease;
}

@media (min-width: 960px) {
  .sticky-header {
    top: 70px;
  }
}

.cursor-pointer {
  cursor: pointer;
}

.transition-all {
  transition: all 0.25s ease-in-out;
}

.hover-scale {
  transition: all 0.25s ease-in-out;
}

.hover-scale:hover {
  transform: translateY(-2px);
}

.opacity-60 {
  opacity: 0.6;
}

.border-2 {
  border-width: 2px !important;
}

.active-card {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12) !important;
}

.shimmer-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-chip {
  width: 60px;
  height: 20px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

.shimmer-button {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(var(--v-theme-on-surface), 0.05) 25%, rgba(var(--v-theme-on-surface), 0.12) 50%, rgba(var(--v-theme-on-surface), 0.05) 75%);
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite ease-in-out;
}

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.attachment-thumb-wrapper {
  display: inline-block;
  transition: transform 0.2s ease-in-out;
}

.attachment-thumb-wrapper:hover {
  transform: scale(1.1);
}

.attachment-thumbnail {
  border: 1.5px solid rgba(var(--v-border-color), 0.25) !important;
  transition: all 0.2s ease;
}

.attachment-thumb-wrapper:hover .attachment-thumbnail {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2) !important;
}

.attachment-count-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background-color: rgb(var(--v-theme-primary));
  color: white;
  font-size: 10px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 6px;
  border: 1.5px solid white;
  line-height: 1;
}
</style>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
