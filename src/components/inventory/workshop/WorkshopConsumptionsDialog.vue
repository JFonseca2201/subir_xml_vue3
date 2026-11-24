<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'consumptionRegistered'])

const { showNotification } = useGlobalToast()

const isVisible = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
})

const activeTab = ref('supplies') // 'supplies' | 'history'
const loadingSupplies = ref(false)
const loadingHistory = ref(false)
const isSubmittingConsumption = ref(false)

// State: Insumos por envase
const suppliesList = ref([])
const totalContainersInStock = ref(0)
const searchSupply = ref('')

// State: Historial de consumo
const consumptionsList = ref([])
const historySummary = ref({
  total_consumptions_count: 0,
  total_containers_opened: 0,
  total_consumed_cost: 0,
})
const searchHistory = ref('')
const historyPagination = ref({
  current_page: 1,
  last_page: 1,
  total: 0,
})

// Modal rápido de "Abrir Envase / Registrar Salida"
const isConsumeDialogOpen = ref(false)
const selectedSupply = ref(null)
const consumeQuantity = ref(1)
const consumeStationOrNotes = ref('')

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value || 0)
}

const formatDate = dateStr => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// Cargar insumos en stock de taller
const loadSupplies = async () => {
  loadingSupplies.value = true
  try {
    const response = await $api('workshop-supplies')
    if (response.success) {
      suppliesList.value = response.data || []
      totalContainersInStock.value = response.total_containers_in_stock || 0
    }
  } catch (error) {
    console.error('Error al cargar insumos de taller:', error)
    showNotification('No se pudo cargar la lista de insumos', 'error')
  } finally {
    loadingSupplies.value = false
  }
}

// Cargar historial de consumos
const loadConsumptions = async (page = 1) => {
  loadingHistory.value = true
  try {
    const params = {
      page,
      per_page: 15,
    }
    if (searchHistory.value) {
      params.search = searchHistory.value
    }
    const response = await $api('workshop-consumptions', { params })
    if (response.success) {
      consumptionsList.value = response.data?.data || []
      historyPagination.value = {
        current_page: response.data?.current_page || 1,
        last_page: response.data?.last_page || 1,
        total: response.data?.total || 0,
      }
      if (response.summary) {
        historySummary.value = response.summary
      }
    }
  } catch (error) {
    console.error('Error al cargar historial de consumos:', error)
  } finally {
    loadingHistory.value = false
  }
}

// Filtrado reactivo de insumos
const filteredSupplies = computed(() => {
  if (!searchSupply.value) return suppliesList.value
  const q = searchSupply.value.toLowerCase().trim()
  return suppliesList.value.filter(item => {
    return (
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.brand && item.brand.toLowerCase().includes(q))
    )
  })
})

// Abrir diálogo de consumo para un insumo
const openConsumeDialog = supply => {
  selectedSupply.value = supply
  consumeQuantity.value = 1
  consumeStationOrNotes.value = ''
  isConsumeDialogOpen.value = true
}

// Confirmar salida de consumo interno
const confirmConsumption = async () => {
  if (!selectedSupply.value) return
  const qty = Number(consumeQuantity.value) || 1
  if (qty <= 0) {
    return showNotification('La cantidad de envases debe ser mayor a 0', 'warning')
  }
  if (qty > selectedSupply.value.stock) {
    return showNotification(`Solo hay ${selectedSupply.value.stock} envase(s) disponibles`, 'warning')
  }

  isSubmittingConsumption.value = true
  try {
    const payload = {
      product_id: selectedSupply.value.id,
      quantity: qty,
      station_or_notes: consumeStationOrNotes.value ? consumeStationOrNotes.value.trim() : null,
    }
    const response = await $api('workshop-consumptions', {
      method: 'POST',
      body: payload,
    })

    if (response.success) {
      showNotification(
        response.message || `Salida de ${qty} envase(s) registrada correctamente`,
        'success'
      )
      // Actualizar stock localmente
      selectedSupply.value.stock = response.remaining_stock
      selectedSupply.value.consumptions_count = (selectedSupply.value.consumptions_count || 0) + 1
      selectedSupply.value.total_containers_consumed = (selectedSupply.value.total_containers_consumed || 0) + qty
      selectedSupply.value.last_consumed_at = new Date().toISOString()

      // Recalcular métricas
      totalContainersInStock.value = Math.max(0, totalContainersInStock.value - qty)

      isConsumeDialogOpen.value = false
      emit('consumptionRegistered', response.data)

      // Si el historial está abierto o en memoria, recargar
      loadConsumptions(1)
    }
  } catch (error) {
    const msg = error.response?._data?.message || 'Error al registrar consumo interno'
    showNotification(msg, 'error')
  } finally {
    isSubmittingConsumption.value = false
  }
}

// Watchers
watch(isVisible, val => {
  if (val) {
    loadSupplies()
    loadConsumptions(1)
  }
})

watch(activeTab, val => {
  if (val === 'history' && consumptionsList.value.length === 0) {
    loadConsumptions(1)
  }
})
</script>

<template>
  <VDialog
    v-model="isVisible"
    max-width="1100"
    scrollable
    transition="dialog-bottom-transition"
  >
    <VCard class="custom-dialog-card elevation-24">
      <!-- Header Banner -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="isVisible = false"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-archive-line" />
        </div>
        <h3 class="custom-dialog-title">
          Insumos y Consumo Interno de Taller
        </h3>
        <p class="custom-dialog-subtitle">
          Control de cajas cerradas, tarros y envases de taller con registro de consumo interno en 1 clic
        </p>
      </div>

      <!-- Barra de KPIs Resumen -->
      <div class="pa-4 bg-grey-lighten-5 border-b">
        <VRow dense>
          <!-- Total Tipos de Insumo -->
          <VCol cols="12" sm="4">
            <VCard elevation="0" class="pa-3 rounded-xl border bg-white">
              <div class="d-flex align-center justify-space-between">
                <div>
                  <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
                    Insumos por Envase
                  </div>
                  <div class="text-h5 font-weight-black text-primary mt-0.5">
                    {{ suppliesList.length }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Productos controlados por caja
                  </div>
                </div>
                <VAvatar color="primary" variant="tonal" size="44" rounded="lg">
                  <VIcon icon="ri-archive-drawer-line" size="24" />
                </VAvatar>
              </div>
            </VCard>
          </VCol>

          <!-- Envases / Cajas Disponibles -->
          <VCol cols="12" sm="4">
            <VCard elevation="0" class="pa-3 rounded-xl border bg-white">
              <div class="d-flex align-center justify-space-between">
                <div>
                  <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
                    Envases Disponibles
                  </div>
                  <div class="text-h5 font-weight-black text-warning mt-0.5">
                    {{ totalContainersInStock }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Cajas/tarros cerrados en taller
                  </div>
                </div>
                <VAvatar color="warning" variant="tonal" size="44" rounded="lg">
                  <VIcon icon="ri-box-3-fill" size="24" />
                </VAvatar>
              </div>
            </VCard>
          </VCol>

          <!-- Total Consumido Histórico -->
          <VCol cols="12" sm="4">
            <VCard elevation="0" class="pa-3 rounded-xl border bg-white">
              <div class="d-flex align-center justify-space-between">
                <div>
                  <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
                    Gasto Consumido
                  </div>
                  <div class="text-h5 font-weight-black text-info mt-0.5">
                    {{ formatCurrency(historySummary.total_consumed_cost) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ historySummary.total_containers_opened }} envases abiertos en total
                  </div>
                </div>
                <VAvatar color="info" variant="tonal" size="44" rounded="lg">
                  <VIcon icon="ri-hand-coin-line" size="24" />
                </VAvatar>
              </div>
            </VCard>
          </VCol>
        </VRow>
      </div>

      <!-- Pestañas de Navegación -->
      <div class="px-5 pt-3 bg-white border-b d-flex align-center justify-space-between flex-wrap gap-2">
        <VTabs
          v-model="activeTab"
          color="primary"
          density="comfortable"
        >
          <VTab value="supplies" class="text-none font-weight-bold">
            <VIcon icon="ri-box-3-line" start size="18" />
            Stock de Envases ({{ suppliesList.length }})
          </VTab>
          <VTab value="history" class="text-none font-weight-bold">
            <VIcon icon="ri-history-line" start size="18" />
            Historial de Salidas / Consumos ({{ historyPagination.total }})
          </VTab>
        </VTabs>

        <!-- Buscador contextual según pestaña -->
        <div style="min-width: 260px; max-width: 320px;" class="mb-2">
          <VTextField
            v-if="activeTab === 'supplies'"
            v-model="searchSupply"
            density="compact"
            variant="outlined"
            placeholder="Filtrar insumo o SKU..."
            prepend-inner-icon="ri-search-line"
            hide-details
            clearable
          />
          <VTextField
            v-else
            v-model="searchHistory"
            density="compact"
            variant="outlined"
            placeholder="Buscar en historial..."
            prepend-inner-icon="ri-search-line"
            hide-details
            clearable
            @keydown.enter="loadConsumptions(1)"
          />
        </div>
      </div>

      <!-- Contenido de las Pestañas -->
      <VCardText class="pa-5" style="max-height: 60vh;">
        <!-- TAB 1: Stock de Envases -->
        <div v-if="activeTab === 'supplies'">
          <div v-if="loadingSupplies" class="py-12 text-center">
            <VProgressCircular indeterminate color="primary" size="48" width="4" />
            <div class="text-subtitle-2 font-weight-bold mt-3 text-medium-emphasis">
              Cargando insumos del taller...
            </div>
          </div>

          <div v-else-if="filteredSupplies.length === 0" class="py-12 text-center">
            <VIcon icon="ri-inbox-2-line" size="64" color="disabled" class="mb-3" />
            <div class="text-h6 font-weight-bold text-medium-emphasis">
              No hay insumos registrados por envase
            </div>
            <p class="text-caption text-disabled mb-4" style="max-width: 440px; margin: 0 auto;">
              Al registrar facturas de compra, selecciona la opción <strong>"🛢️ Insumo por Envase / Caja"</strong> para ingresar tarros, cajas de pesas o penetrantes que se controlan por envase cerrado.
            </p>
          </div>

          <div v-else class="table-responsive rounded-lg border">
            <VTable density="comfortable" hover>
              <thead>
                <tr class="bg-grey-lighten-5 text-uppercase" style="font-size: 0.72rem;">
                  <th class="font-weight-bold">SKU / CÓDIGO</th>
                  <th class="font-weight-bold">INSUMO / DESCRIPCIÓN</th>
                  <th class="font-weight-bold">MARCA</th>
                  <th class="text-center font-weight-bold">ENVASES DISP.</th>
                  <th class="text-right font-weight-bold">COSTO / ENVASE</th>
                  <th class="text-center font-weight-bold">CONSUMIDOS</th>
                  <th class="text-center font-weight-bold" style="width: 170px;">ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="supply in filteredSupplies" :key="supply.id">
                  <td class="font-mono text-caption font-weight-bold text-medium-emphasis">
                    {{ supply.sku }}
                  </td>
                  <td>
                    <div class="font-weight-bold text-high-emphasis">
                      {{ supply.description }}
                    </div>
                    <div v-if="supply.last_consumed_at" class="text-caption text-disabled" style="font-size: 0.7rem;">
                      Último consumo: {{ formatDate(supply.last_consumed_at) }}
                    </div>
                  </td>
                  <td>
                    <VChip size="x-small" variant="tonal" color="secondary" class="font-weight-medium">
                      {{ supply.brand || 'N/A' }}
                    </VChip>
                  </td>
                  <td class="text-center">
                    <VChip
                      size="small"
                      :color="supply.stock > 2 ? 'success' : (supply.stock > 0 ? 'warning' : 'error')"
                      variant="tonal"
                      class="font-weight-bold font-mono px-2"
                    >
                      <VIcon
                        :icon="supply.stock > 0 ? 'ri-box-3-line' : 'ri-alert-line'"
                        start
                        size="14"
                      />
                      {{ Number(supply.stock).toFixed(0) }} envase{{ supply.stock === 1 ? '' : 's' }}
                    </VChip>
                  </td>
                  <td class="text-right font-mono font-weight-bold text-medium-emphasis">
                    {{ formatCurrency(supply.purchase_price) }}
                  </td>
                  <td class="text-center font-mono text-caption text-medium-emphasis">
                    {{ Number(supply.total_containers_consumed || 0).toFixed(0) }} abiertos
                  </td>
                  <td class="text-center">
                    <VBtn
                      color="primary"
                      size="small"
                      variant="tonal"
                      prepend-icon="ri-logout-box-r-line"
                      class="text-none font-weight-bold rounded-lg"
                      :disabled="supply.stock <= 0"
                      @click="openConsumeDialog(supply)"
                    >
                      Abrir Envase
                    </VBtn>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>
        </div>

        <!-- TAB 2: Historial de Consumos -->
        <div v-else-if="activeTab === 'history'">
          <div v-if="loadingHistory" class="py-12 text-center">
            <VProgressCircular indeterminate color="primary" size="48" width="4" />
            <div class="text-subtitle-2 font-weight-bold mt-3 text-medium-emphasis">
              Cargando historial de salidas...
            </div>
          </div>

          <div v-else-if="consumptionsList.length === 0" class="py-12 text-center">
            <VIcon icon="ri-history-line" size="64" color="disabled" class="mb-3" />
            <div class="text-h6 font-weight-bold text-medium-emphasis">
              No hay salidas registradas todavía
            </div>
            <p class="text-caption text-disabled" style="max-width: 420px; margin: 0 auto;">
              Cada vez que abras una caja de pesas o un envase de lubricante/aflojatodo en taller, quedará registrado aquí con fecha, responsable y costo.
            </p>
          </div>

          <div v-else>
            <div class="table-responsive rounded-lg border mb-3">
              <VTable density="comfortable" hover>
                <thead>
                  <tr class="bg-grey-lighten-5 text-uppercase" style="font-size: 0.72rem;">
                    <th class="font-weight-bold">FECHA Y HORA</th>
                    <th class="font-weight-bold">INSUMO</th>
                    <th class="text-center font-weight-bold">CANTIDAD</th>
                    <th class="text-right font-weight-bold">COSTO UNIT.</th>
                    <th class="text-right font-weight-bold">TOTAL</th>
                    <th class="font-weight-bold">ESTACIÓN / NOTAS</th>
                    <th class="font-weight-bold">REGISTRADO POR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in consumptionsList" :key="c.id">
                    <td class="text-caption font-mono text-medium-emphasis">
                      {{ formatDate(c.consumed_at) }}
                    </td>
                    <td>
                      <div class="font-weight-bold text-high-emphasis">
                        {{ c.product?.description || 'Insumo eliminado' }}
                      </div>
                      <div class="text-caption text-disabled font-mono">
                        {{ c.product?.sku }} • {{ c.product?.brand }}
                      </div>
                    </td>
                    <td class="text-center font-mono font-weight-bold">
                      <VChip size="x-small" color="info" variant="tonal">
                        {{ Number(c.quantity).toFixed(0) }} envase{{ c.quantity === 1 ? '' : 's' }}
                      </VChip>
                    </td>
                    <td class="text-right font-mono text-caption text-medium-emphasis">
                      {{ formatCurrency(c.unit_cost) }}
                    </td>
                    <td class="text-right font-mono font-weight-black text-high-emphasis">
                      {{ formatCurrency(c.total_cost) }}
                    </td>
                    <td>
                      <span v-if="c.station_or_notes" class="text-caption text-high-emphasis">
                        <VIcon icon="ri-map-pin-line" size="13" class="me-1 text-primary" />
                        {{ c.station_or_notes }}
                      </span>
                      <span v-else class="text-disabled text-caption">—</span>
                    </td>
                    <td>
                      <div class="d-flex align-center gap-1.5 text-caption">
                        <VAvatar color="primary" variant="tonal" size="22">
                          <span style="font-size: 0.65rem;">{{ (c.user?.name || 'U').charAt(0) }}</span>
                        </VAvatar>
                        <span class="font-weight-medium">{{ c.user?.name || 'Sistema' }}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </VTable>
            </div>

            <!-- Paginación -->
            <div v-if="historyPagination.last_page > 1" class="d-flex justify-center mt-3">
              <VPagination
                v-model="historyPagination.current_page"
                :length="historyPagination.last_page"
                total-visible="5"
                density="compact"
                @update:model-value="loadConsumptions"
              />
            </div>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-end align-center gap-3">
        <span class="text-caption text-medium-emphasis me-auto">
          Los insumos de taller no se mezclan con los productos comerciales del POS
        </span>
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="isVisible = false"
        >
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>

    <!-- Modal Rápido: Confirmar Salida de Insumo por Envase -->
    <VDialog
      v-model="isConsumeDialogOpen"
      max-width="480"
      persistent
    >
      <VCard class="rounded-xl elevation-24">
        <VCardTitle class="pa-5 pb-3 d-flex align-center justify-space-between bg-primary-lighten-5">
          <div class="d-flex align-center gap-2">
            <VAvatar color="primary" variant="tonal" size="36">
              <VIcon icon="ri-logout-box-r-line" size="20" />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold text-primary">
                Registrar Salida de Insumo
              </div>
              <div class="text-caption text-medium-emphasis">
                Abrir caja/envase para uso en taller
              </div>
            </div>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            @click="isConsumeDialogOpen = false"
          />
        </VCardTitle>

        <VCardText class="pa-5" v-if="selectedSupply">
          <!-- Detalle del Insumo -->
          <div class="bg-grey-lighten-5 pa-3 rounded-lg border mb-4">
            <div class="font-weight-bold text-high-emphasis">
              {{ selectedSupply.description }}
            </div>
            <div class="d-flex justify-space-between text-caption text-medium-emphasis mt-1">
              <span>SKU: <strong class="font-mono">{{ selectedSupply.sku }}</strong></span>
              <span>Marca: <strong>{{ selectedSupply.brand }}</strong></span>
            </div>
            <div class="d-flex justify-space-between text-caption mt-2 pt-2 border-t">
              <span>Disponibles en taller:</span>
              <strong class="text-primary font-mono font-weight-black">
                {{ selectedSupply.stock }} envase{{ selectedSupply.stock === 1 ? '' : 's' }}
              </strong>
            </div>
          </div>

          <!-- Selector de Cantidad a Abrir -->
          <VRow dense class="mb-3">
            <VCol cols="12" sm="6">
              <VTextField
                v-model.number="consumeQuantity"
                type="number"
                min="1"
                :max="selectedSupply.stock"
                label="Envases a Abrir *"
                density="comfortable"
                variant="outlined"
                prepend-inner-icon="ri-box-3-line"
                hide-details
              />
            </VCol>
            <VCol cols="12" sm="6" class="d-flex align-center">
              <div class="text-caption text-medium-emphasis ps-2">
                Costo estimado:<br>
                <strong class="text-high-emphasis font-mono font-weight-bold" style="font-size: 0.95rem;">
                  {{ formatCurrency((consumeQuantity || 1) * selectedSupply.purchase_price) }}
                </strong>
              </div>
            </VCol>
          </VRow>

          <!-- Bahía / Estación / Observaciones -->
          <VTextField
            v-model="consumeStationOrNotes"
            label="Bahía / Estación / Técnico (Opcional)"
            placeholder="Ej: Bahía 2 - Balanceo, Técnico Carlos..."
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="ri-map-pin-line"
            hide-details
          />
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-end gap-2">
          <VBtn
            variant="outlined"
            color="secondary"
            class="rounded-lg text-none"
            :disabled="isSubmittingConsumption"
            @click="isConsumeDialogOpen = false"
          >
            Cancelar
          </VBtn>
          <VBtn
            color="primary"
            class="rounded-lg text-none font-weight-bold"
            prepend-icon="ri-check-line"
            :loading="isSubmittingConsumption"
            @click="confirmConsumption"
          >
            Confirmar Salida
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VDialog>
</template>

<style scoped>
.table-responsive {
  overflow-x: auto;
}
</style>
