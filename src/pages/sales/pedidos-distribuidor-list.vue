<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import Swal from 'sweetalert2'

const router = useRouter()
const { showNotification } = useGlobalToast()

const loading = ref(false)
const pedidos = ref([])
const search = ref('')

const statusOptions = [
  { value: 'pendiente', label: 'Pendiente', color: 'warning', icon: 'ri-time-line' },
  { value: 'por_confirmar', label: 'Por Confirmar', color: 'info', icon: 'ri-checkbox-circle-line' },
  { value: 'completado', label: 'Completado', color: 'success', icon: 'ri-check-line' },
  { value: 'cancelado', label: 'Cancelado', color: 'error', icon: 'ri-close-circle-line' },
]

// Paginación
const currentPage = ref(1)
const totalItems = ref(0)
const totalPages = ref(0)

// Modal de Detalles
const isViewDialogVisible = ref(false)
const selectedPedido = ref(null)
const viewLoading = ref(false)

const loadPedidos = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      search: search.value,
    }

    // Limpiar vacíos
    if (!params.search) {
      delete params.search
    }

    const response = await $api('pedidos-distribuidor', { params })
    
    if (response.success || response.status === 200) {
      const paginator = response.data || {}
      pedidos.value = paginator.data || []
      totalItems.value = paginator.total || pedidos.value.length || 0
      totalPages.value = paginator.last_page || 1
    } else {
      pedidos.value = []
    }
  } catch (error) {
    console.error('Error al cargar pedidos:', error)
    showNotification('Error al cargar la lista de pedidos', 'error')
  } finally {
    loading.value = false
  }
}

const clearSearch = () => {
  search.value = ''
  currentPage.value = 1
  loadPedidos()
}

// Helpers de Formateo
const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const formatDate = dateString => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

const getStatusInfo = status => {
  const map = {
    pendiente: { color: 'warning', text: 'Pendiente', icon: 'ri-time-line' },
    por_confirmar: { color: 'info', text: 'Por Confirmar', icon: 'ri-checkbox-circle-line' },
    completado: { color: 'success', text: 'Completado', icon: 'ri-check-line' },
    cancelado: { color: 'error', text: 'Cancelado', icon: 'ri-close-circle-line' },
  }
  return map[status] || { color: 'grey', text: status, icon: 'ri-question-line' }
}

const viewPedidoDetails = async pedido => {
  try {
    viewLoading.value = true
    const response = await $api(`pedidos-distribuidor/${pedido.id}`)
    if (response.success || response.status === 200) {
      selectedPedido.value = response.data
      isViewDialogVisible.value = true
    } else {
      showNotification('Error al obtener detalles del pedido', 'error')
    }
  } catch (error) {
    console.error('Error al ver pedido:', error)
    showNotification('Error al obtener detalles del pedido', 'error')
  } finally {
    viewLoading.value = false
  }
}

const generateSinglePDF = async pedido => {
  try {
    const response = await $api(`pedidos-distribuidor/${pedido.id}/pdf`, {
      method: 'GET',
      responseType: 'blob'
    })
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    window.open(url, '_blank')
    showNotification('PDF cargado exitosamente', 'success')
  } catch (error) {
    console.error('Error al generar PDF:', error)
    showNotification('Error al generar el PDF', 'error')
  }
}

const editPedido = pedido => {
  router.push(`/sales/pedidos-distribuidor?id=${pedido.id}`)
}

const deletePedido = async pedido => {
  const result = await Swal.fire({
    title: '¿Estás seguro?',
    text: `Vas a eliminar el pedido #${String(pedido.id).padStart(5, '0')}. Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#fb7578',
    cancelButtonColor: '#90a4ae',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  })

  if (result.isConfirmed) {
    loading.value = true
    try {
      const response = await $api(`pedidos-distribuidor/${pedido.id}`, {
        method: 'DELETE'
      })
      if (response.success || response.status === 200) {
        showNotification('Pedido eliminado exitosamente', 'success')
        loadPedidos()
      } else {
        showNotification(response.message || 'Error al eliminar el pedido', 'error')
      }
    } catch (error) {
      console.error('Error al eliminar pedido:', error)
      showNotification('Error al eliminar el pedido', 'error')
    } finally {
      loading.value = false
    }
  }
}

const updateStatus = async (pedido, newStatus) => {
  if (pedido.estado === newStatus) return

  const result = await Swal.fire({
    title: '¿Confirmar cambio de estado?',
    text: `Vas a cambiar el estado del pedido a "${newStatus.replace('_', ' ').toUpperCase()}".`,
    icon: 'info',
    showCancelButton: true,
    confirmButtonColor: '#4f83cc',
    cancelButtonColor: '#90a4ae',
    confirmButtonText: 'Sí, cambiar',
    cancelButtonText: 'Cancelar'
  })

  if (result.isConfirmed) {
    loading.value = true
    try {
      const response = await $api(`pedidos-distribuidor/${pedido.id}/status`, {
        method: 'PUT',
        body: { estado: newStatus }
      })
      if (response.success || response.status === 200) {
        showNotification('Estado del pedido actualizado exitosamente', 'success')
        if (selectedPedido.value && selectedPedido.value.id === pedido.id) {
          selectedPedido.value.estado = newStatus
        }
        loadPedidos()
      } else {
        showNotification(response.message || 'Error al actualizar el estado', 'error')
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error)
      showNotification('Error al actualizar el estado del pedido', 'error')
    } finally {
      loading.value = false
    }
  }
}

// Watchers
watch(currentPage, () => {
  loadPedidos()
})

// Búsqueda en tiempo real (debounce simple)
let searchTimeout = null
watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadPedidos()
  }, 500)
})

onMounted(() => {
  loadPedidos()
})
</script>

<template>
  <div class="pa-4 pa-sm-6">
    <VCard class="pa-6 pa-sm-8 rounded-lg elevation-4 max-w-1200 mx-auto">
      <!-- Encabezado -->
      <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1">Pedidos a Distribuidor</h1>
          <p class="text-medium-emphasis mb-0">Historial y estado de los pedidos solicitados a distribuidores</p>
        </div>
        <VBtn
          color="info"
          prepend-icon="ri-add-line"
          to="/sales/pedidos-distribuidor"
          size="large"
        >
          Nuevo Pedido
        </VBtn>
      </div>

      <VDivider class="mb-6" />

      <!-- Filtros y Búsqueda -->
      <VRow class="mb-4">
        <VCol cols="12" sm="6" md="4">
          <VTextField
            v-model="search"
            label="Buscar por distribuidor"
            placeholder="Escribe el nombre del proveedor..."
            prepend-inner-icon="ri-search-line"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
            clearable
            @click:clear="clearSearch"
            color="info"
          />
        </VCol>
      </VRow>

      <VTable class="text-no-wrap border rounded-lg overflow-hidden">
        <thead class="bg-grey-lighten-4">
          <tr>
            <th class="font-weight-bold">ID Pedido</th>
            <th class="font-weight-bold">Fecha / Hora</th>
            <th class="font-weight-bold">Distribuidor</th>
            <th class="font-weight-bold">Usuario</th>
            <th class="font-weight-bold text-center">Estado</th>
            <th class="font-weight-bold text-right">Total Est.</th>
            <th class="font-weight-bold text-center">Acciones</th>
          </tr>
        </thead>
        
        <tbody v-if="loading">
          <tr>
            <td colspan="7" class="text-center pa-6">
              <VProgressCircular indeterminate color="info" size="40" />
              <div class="mt-2 text-medium-emphasis">Cargando registros...</div>
            </td>
          </tr>
        </tbody>
        
        <tbody v-else-if="pedidos.length === 0">
          <tr>
            <td colspan="7" class="text-center pa-8 text-medium-emphasis">
              <VIcon size="48" class="mb-3 opacity-50">ri-file-list-3-line</VIcon>
              <div class="text-h6">No se encontraron pedidos</div>
              <div class="text-body-2">Prueba cambiando el filtro de búsqueda o crea uno nuevo</div>
            </td>
          </tr>
        </tbody>
        
        <tbody v-else style="text-transform: uppercase;">
          <tr v-for="item in pedidos" :key="item.id" class="align-middle">
            <td class="font-weight-bold text-primary">#{{ String(item.id).padStart(5, '0') }}</td>
            <td>{{ formatDate(item.created_at) }}</td>
            <td>
              <div class="font-weight-medium">{{ item.distribuidor?.name || 'DESCONOCIDO' }}</div>
              <div class="text-caption text-medium-emphasis" v-if="item.distribuidor?.ruc">RUC: {{ item.distribuidor.ruc }}</div>
            </td>
            <td>{{ item.usuario?.name || 'S/N' }}</td>
            <td class="text-center">
              <VMenu close-on-content-click>
                <template #activator="{ props }">
                  <VChip
                    v-bind="props"
                    :color="getStatusInfo(item.estado).color"
                    size="small"
                    variant="flat"
                    class="font-weight-bold cursor-pointer"
                    style="cursor: pointer;"
                  >
                    <VIcon start :icon="getStatusInfo(item.estado).icon" />
                    {{ getStatusInfo(item.estado).text }}
                    <VIcon end icon="ri-arrow-down-s-line" class="ml-1" />
                  </VChip>
                </template>
                <VList density="compact">
                  <VListItem
                    v-for="status in statusOptions"
                    :key="status.value"
                    @click="updateStatus(item, status.value)"
                  >
                    <template #prepend>
                      <VIcon :icon="status.icon" :color="status.color" class="mr-2" size="20" />
                    </template>
                    <VListItemTitle>{{ status.label }}</VListItemTitle>
                  </VListItem>
                </VList>
              </VMenu>
            </td>
            <td class="text-right font-weight-black text-info text-body-1">
              {{ formatCurrency(item.total) }}
            </td>
            <td class="text-center">
              <div class="d-flex justify-center gap-1">
                <VBtn
                  icon="ri-file-pdf-line"
                  variant="text"
                  size="small"
                  color="success"
                  title="Ver PDF (Sin Precios)"
                  @click="generateSinglePDF(item)"
                />
                <VBtn
                  icon="ri-eye-line"
                  variant="text"
                  size="small"
                  color="info"
                  title="Ver Detalle"
                  :loading="viewLoading && selectedPedido?.id === item.id"
                  @click="viewPedidoDetails(item)"
                />
                <VBtn
                  icon="ri-edit-line"
                  variant="text"
                  size="small"
                  color="warning"
                  title="Editar Pedido"
                  @click="editPedido(item)"
                />
                <VBtn
                  icon="ri-delete-bin-line"
                  variant="text"
                  size="small"
                  color="error"
                  title="Eliminar Pedido"
                  @click="deletePedido(item)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </VTable>

      <VDivider class="mt-4" />
      
      <!-- Paginación -->
      <div class="d-flex justify-center pa-4">
        <div class="d-flex flex-column align-center gap-2">
          <div class="text-caption text-medium-emphasis">
            Mostrando página {{ currentPage }} de {{ totalPages }} ({{ totalItems }} registros en total)
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            rounded="circle"
            :total-visible="7"
            :disabled="loading"
            color="info"
          />
        </div>
      </div>
    </VCard>

    <!-- Dialogo de Detalle de Pedido -->
    <VDialog v-model="isViewDialogVisible" max-width="800">
      <VCard class="rounded-lg" v-if="selectedPedido">
        <VCardTitle class="bg-grey-lighten-4 pa-4 d-flex align-center justify-space-between border-b">
          <div class="d-flex align-center">
            <VIcon icon="ri-truck-line" color="info" class="mr-2" />
            <span class="text-h6 font-weight-bold">Detalle de Pedido #{{ String(selectedPedido.id).padStart(5, '0') }}</span>
          </div>
          <VMenu close-on-content-click>
            <template #activator="{ props }">
              <VChip
                v-bind="props"
                :color="getStatusInfo(selectedPedido.estado).color"
                size="small"
                variant="flat"
                class="font-weight-bold cursor-pointer"
                style="cursor: pointer;"
              >
                <VIcon start :icon="getStatusInfo(selectedPedido.estado).icon" />
                {{ getStatusInfo(selectedPedido.estado).text }}
                <VIcon end icon="ri-arrow-down-s-line" class="ml-1" />
              </VChip>
            </template>
            <VList density="compact">
              <VListItem
                v-for="status in statusOptions"
                :key="status.value"
                @click="updateStatus(selectedPedido, status.value)"
              >
                <template #prepend>
                  <VIcon :icon="status.icon" :color="status.color" class="mr-2" size="20" />
                </template>
                <VListItemTitle>{{ status.label }}</VListItemTitle>
              </VListItem>
            </VList>
          </VMenu>
        </VCardTitle>

        <VCardText class="pa-6">
          <VRow class="mb-4">
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Distribuidor / Proveedor:</div>
              <div class="text-body-1 font-weight-bold">{{ selectedPedido.distribuidor?.name || 'DESCONOCIDO' }}</div>
              <div class="text-body-2" v-if="selectedPedido.distribuidor?.ruc">RUC: {{ selectedPedido.distribuidor.ruc }}</div>
              <div class="text-body-2" v-if="selectedPedido.distribuidor?.address">Dirección: {{ selectedPedido.distribuidor.address }}</div>
            </VCol>
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Generado por:</div>
              <div class="text-body-1 font-weight-bold">{{ selectedPedido.usuario?.name || 'S/N' }}</div>
              <div class="text-caption text-medium-emphasis mt-2">Fecha y Hora:</div>
              <div class="text-body-2">{{ formatDate(selectedPedido.created_at) }}</div>
            </VCol>
          </VRow>

          <VDivider class="mb-4" />

          <div class="text-h6 font-weight-bold mb-3">Ítems Solicitados</div>
          
          <VTable class="text-no-wrap border rounded-lg mb-4">
            <thead class="bg-grey-lighten-4">
              <tr>
                <th class="font-weight-bold">Producto</th>
                <th class="font-weight-bold text-center">Cantidad</th>
                <th class="font-weight-bold text-right">Precio Compra Est.</th>
                <th class="font-weight-bold text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedPedido.detalles" :key="item.id">
                <td>
                  <div class="font-weight-medium">{{ item.description }}</div>
                  <div class="text-caption text-medium-emphasis" v-if="item.producto?.sku">SKU: {{ item.producto.sku }}</div>
                  <VChip v-if="!item.producto_id" size="x-small" color="orange" variant="tonal" class="mt-1">Ingreso Manual</VChip>
                </td>
                <td class="text-center">{{ item.cantidad }}</td>
                <td class="text-right">{{ formatCurrency(item.precio_compra_estimado) }}</td>
                <td class="text-right font-weight-bold text-info">
                  {{ formatCurrency(item.cantidad * item.precio_compra_estimado) }}
                </td>
              </tr>
            </tbody>
          </VTable>

          <div class="d-flex justify-end border-t pt-4">
            <div class="text-right">
              <span class="text-subtitle-1 text-medium-emphasis mr-4">Total Estimado del Pedido:</span>
              <span class="text-h5 font-weight-black text-info">{{ formatCurrency(selectedPedido.total) }}</span>
            </div>
          </div>
        </VCardText>

        <VCardActions class="pa-4 bg-grey-lighten-4 border-t justify-end gap-2">
          <VBtn
            color="success"
            variant="flat"
            prepend-icon="ri-file-pdf-line"
            @click="generateSinglePDF(selectedPedido)"
          >
            Generar PDF
          </VBtn>
          <VBtn color="secondary" variant="flat" @click="isViewDialogVisible = false">Cerrar</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.v-table th {
  font-weight: 700 !important;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
}
</style>
