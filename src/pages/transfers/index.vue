<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import TransferDialog from '@/components/inventory/finances-records/TransferDialog.vue'

// Router y dependencias globales
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Obtener usuario actual del localStorage
const currentUser = computed(() => {
  const userStr = localStorage.getItem('user')
  
  return userStr ? JSON.parse(userStr) : null
})

// Validación de seguridad - solo rol_id === 1 puede acceder
const canAccessTransfers = computed(() => {
  const user = currentUser.value
  const roleId = user?.role?.id
  
  return user && roleId === 1
})

// Estado del componente
const transfers = ref([])

const resumen = ref({
  total_hoy: 0,
  total_mes: 0,
  total_general: 0,
})

const loading = ref(false)
const showTransferDialog = ref(false)
const editingTransfer = ref(null)
const showDeleteDialog = ref(false)
const transferToDelete = ref(null)

// Cargar listado de transferencias
const loadTransfers = async () => {
  loader.start()
  loading.value = true

  try {
    const response = await $api('transfers')

    // Adaptación dependiendo de cómo devuelva tu API los datos
    console.log(response)

    let dataArray = []

    if (response.data) {
      dataArray = response.data
    } else if (Array.isArray(response)) {
      dataArray = response
    }

    transfers.value = dataArray

    // Cálculo del resumen en frontend (Respaldo por si la API no lo envía)
    const todayObj = new Date()
    const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
    const currentMonth = today.substring(0, 7)

    let totalHoy = 0, totalMes = 0, totalGeneral = 0

    dataArray.forEach(group => {
      // Soporte dinámico para la nueva estructura agrupada (o si viene plana)
      const items = group.transfers || [group]

      items.forEach(t => {
        const amount = parseFloat(t.amount || 0)
        const tDate = (t.transfer_date || t.created_at || '').split('T')[0]

        totalGeneral += amount
        if (tDate === today) totalHoy += amount
        if (tDate.substring(0, 7) === currentMonth) totalMes += amount
      })
    })

    resumen.value = response.resumen || {
      total_hoy: totalHoy,
      total_mes: totalMes,
      total_general: totalGeneral,
    }

    showNotification('Transferencias cargadas correctamente', 'success')
  } catch (error) {
    console.error('Error al cargar transferencias:', error)
    showNotification('Error al cargar historial de transferencias', 'error')
  } finally {
    loader.stop()
    loading.value = false
  }
}

const openTransferDialog = () => {
  editingTransfer.value = null
  showTransferDialog.value = true
}

// Funciones de Edición y Eliminación
const openEditDialog = transfer => {
  editingTransfer.value = transfer
  showTransferDialog.value = true
}

const deleteTransfer = transfer => {
  transferToDelete.value = transfer
  showDeleteDialog.value = true
}

const confirmDeleteTransfer = async () => {
  if (!transferToDelete.value) return
  loader.start()
  try {
    await $api(`transfers/${transferToDelete.value.id}`, { method: 'DELETE' })
    showNotification('Transferencia eliminada exitosamente', 'success')
    loadTransfers()
    closeDeleteDialog()
  } catch (error) {
    console.error('Error al eliminar:', error)
    showNotification('Error al eliminar transferencia', 'error')
  } finally {
    loader.stop()
  }
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  transferToDelete.value = null
}

// Función que se ejecuta cuando el TransferDialog emite 'transferred'
const onTransferred = () => {
  loadTransfers()
}

// Formatear moneda
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

// Formatear Fecha
const formatDate = dateString => {
  if (!dateString) return 'N/A'
  try {
    // Extraer solo la parte de la fecha (YYYY-MM-DD) para evitar el desfase de zona horaria
    const datePart = dateString.split('T')[0].split(' ')[0]
    const [year, month, day] = datePart.split('-')
    const date = new Date(year, month - 1, day)
    
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch (e) {
    return dateString
  }
}

// Montar componente
onMounted(() => {
  if (canAccessTransfers.value) {
    loadTransfers()
  }
})
</script>

<template>
  <div
    v-if="!canAccessTransfers"
    class="d-flex justify-center align-center"
    style="height: 400px"
  >
    <VCard class="pa-6 text-center">
      <VIcon
        size="64"
        color="error"
        class="mb-4"
      >
        ri-lock-line
      </VIcon>
      <h3 class="text-h5 mb-2">
        Acceso Restringido
      </h3>
      <p class="text-medium-emphasis">
        No tienes permisos para acceder a la gestión de transferencias.
      </p>
      <VBtn
        color="primary"
        class="mt-4"
        @click="router.push('/dashboard')"
      >
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>
  <div
    v-else
    class="pa-4 pa-sm-6"
  >
    <!-- Cabecera Estandarizada -->
    <VRow class="mb-4 mt-2">
      <VCol>
        <div class="d-flex align-center justify-space-between flex-wrap gap-4">
          <div class="d-flex align-center gap-3">
            <VAvatar color="primary" variant="tonal" rounded size="48">
              <VIcon icon="ri-arrow-left-right-line" size="28" />
            </VAvatar>
            <div>
              <h4 class="text-h5 font-weight-bold mb-1">Transferencias</h4>
              <span class="text-body-2 text-medium-emphasis">Gestión de movimientos y transferencias entre cuentas</span>
            </div>
          </div>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-add-line" @click="openTransferDialog">
            Nueva Transferencia
          </VBtn>
        </div>
      </VCol>
    </VRow>

    <!-- Tarjetas de Resumen -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        md="6"
        lg="4"
      >
        <VCard
          class="pa-6 rounded-lg elevation-3"
          color="primary"
          variant="tonal"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-h6 font-weight-medium text-primary-darken-1 mb-2">
                Transferido Hoy
              </div>
              <div class="text-h4 font-weight-bold text-primary">
                {{ formatCurrency(resumen.total_hoy) }}
              </div>
            </div>
            <VIcon
              size="48"
              color="primary"
            >
              ri-calendar-today-line
            </VIcon>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
        lg="4"
      >
        <VCard class="pa-6 rounded-lg elevation-3">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-h6 font-weight-medium mb-2">
                Transferido en el Mes
              </div>
              <div class="text-h4 font-weight-bold">
                {{ formatCurrency(resumen.total_mes) }}
              </div>
            </div>
            <VIcon
              size="48"
              color="success"
            >
              ri-calendar-line
            </VIcon>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
        lg="4"
      >
        <VCard class="pa-6 rounded-lg elevation-3">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-h6 font-weight-medium mb-2">
                Total Histórico
              </div>
              <div class="text-h4 font-weight-bold">
                {{ formatCurrency(resumen.total_general) }}
              </div>
            </div>
            <VIcon
              size="48"
              color="info"
            >
              ri-money-dollar-box-line
            </VIcon>
          </div>
        </VCard>
      </VCol>
    </VRow>
       <!-- Tabla de Historial -->
    <div v-if="loading" class="text-center pa-12">
      <VProgressCircular indeterminate color="primary" size="48" />
      <div class="text-body-1 mt-4 text-medium-emphasis">Cargando transferencias...</div>
    </div>

    <div v-else-if="!transfers.length" class="text-center pa-12">
      <VAvatar color="grey-lighten-3" size="72" class="mb-4">
        <VIcon icon="ri-arrow-left-right-line" size="36" color="grey" />
      </VAvatar>
      <h3 class="text-h6 font-weight-medium">No hay transferencias registradas</h3>
      <p class="text-body-2 mt-1 text-medium-emphasis">Comienza registrando tu primera transferencia</p>
    </div>

    <div v-else>
      <VCard
        v-for="group in transfers"
        :key="group.label"
        class="mb-6 rounded-lg elevation-2"
      >
        <VCardTitle class="pa-4">
          <div class="d-flex justify-space-between align-center flex-wrap gap-2">
            <div class="d-flex align-center gap-2">
              <VIcon icon="ri-calendar-event-line" color="primary" />
              <h3 class="text-h6 font-weight-bold text-primary">{{ group.label }}</h3>
              <VChip size="small" variant="tonal" color="secondary" class="ml-2 font-weight-bold">
                {{ group.transfers.length }} transacc{{ group.transfers.length !== 1 ? 'iones' : 'ión' }}
              </VChip>
            </div>
            <div class="text-end">
              <span class="text-primary text-body-2 font-weight-bold">Total: {{ formatCurrency(group.transfers.reduce((acc, t) => acc + parseFloat(t.amount || 0), 0)) }}</span>
            </div>
          </div>
        </VCardTitle>
        <VDivider />
        <VCardText class="pa-0">
          <VTable hover class="transfer-table bg-transparent">
            <thead>
              <tr>
                <th class="font-weight-bold">CUENTA ORIGEN</th>
                <th class="font-weight-bold">CUENTA DESTINO</th>
                <th class="font-weight-bold">DESCRIPCIÓN</th>
                <th class="font-weight-bold text-end">MONTO</th>
                <th class="font-weight-bold text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transfer in group.transfers" :key="transfer.id" class="border-b">
                <td>
                  <VChip color="error" variant="tonal" size="small" class="font-weight-bold">
                    <VIcon start size="14">ri-arrow-up-line</VIcon>
                    {{ transfer.source_account?.name || 'Origen' }}
                  </VChip>
                </td>
                <td>
                  <VChip color="success" variant="tonal" size="small" class="font-weight-bold">
                    <VIcon start size="14">ri-arrow-down-line</VIcon>
                    {{ transfer.destination_account?.name || 'Destino' }}
                  </VChip>
                </td>
                <td class="text-body-2">{{ transfer.description || '-' }}</td>
                <td class="font-weight-bold text-end text-primary">
                  {{ formatCurrency(transfer.amount) }}
                </td>
                                <td class="text-center">
                                  <div class="d-flex justify-center gap-1">
                                    <VBtn title="Editar" size="small" variant="tonal" color="primary" icon="ri-edit-line" @click="openEditDialog(transfer)" />
                                    <VBtn title="Eliminar" size="small" variant="tonal" color="error" icon="ri-delete-bin-line" @click="deleteTransfer(transfer)" />
                                  </div>
                                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>
    </div>
  </div>

  <!-- Modal de transferencias -->
  <TransferDialog
    v-model="showTransferDialog"
    :transfer-data="editingTransfer"
    @transferred="onTransferred"
  />

  <!-- Modal Confirmar Eliminación -->
  <VDialog
    v-model="showDeleteDialog"
    max-width="400"
  >
    <VCard>
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-2">
            <VIcon
              color="error"
              size="24"
            >
              ri-delete-bin-line
            </VIcon>
            <span class="text-h6 font-weight-bold">Eliminar Transferencia</span>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            @click="closeDeleteDialog"
          />
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-4">
        <div class="text-body-1 mb-2">
          ¿Estás seguro de eliminar esta transferencia por <strong>{{ formatCurrency(transferToDelete?.amount)
          }}</strong>?
        </div>
        <div class="text-medium-emphasis text-body-2">
          Esta acción no se puede deshacer y los saldos volverán a su estado anterior.
        </div>
      </VCardText>
      <VDivider />
      <VCardActions class="pa-4 d-flex justify-end">
        <VBtn
          variant="outlined"
          :disabled="loading"
          @click="closeDeleteDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          :loading="loading"
          prepend-icon="ri-delete-bin-line"
          @click="confirmDeleteTransfer"
        >
          Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>



<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
