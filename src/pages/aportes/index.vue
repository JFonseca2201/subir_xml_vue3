<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import AporteCreateDialog from '@/components/inventory/aportes/AporteCreateDialog.vue'
import AporteEditDialog from '@/components/inventory/aportes/AporteEditDialog.vue'

// Router y seguridad
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Obtener usuario actual del localStorage
const currentUser = computed(() => {
  const userStr = localStorage.getItem('user')
  
  return userStr ? JSON.parse(userStr) : null
})

// Validación de seguridad - solo rol_id === 1 puede acceder
const canAccessAportes = computed(() => {
  const user = currentUser.value
  const roleId = user?.role?.id
  
  return user && roleId === 1
})

// Estado del componente
const aportes = ref([])

const resumen = ref({
  total_hoy: 0,
  total_mes: 0,
  total_general: 0,
})

const loading = ref(false)
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const editingAporte = ref(null)

// Estado para el diálogo de eliminación
const showDeleteDialog = ref(false)
const aporteToDelete = ref(null)

// Búsqueda y filtros
const searchQuery = ref('')
const selectedFilter = ref('all') // 'all', 'today', 'month'

// Limpiar nombre de cuenta
const cleanAccountName = name => {
  if (!name) return 'N/A'
  
  return name
    .replace(/\(EFECTIVO\)/gi, '')
    .replace(/\(TRANSFERENCIA\)/gi, '')
    .replace(/\(EFECTIVO\s*\/\s*CAJA\)/gi, '')
    .trim()
}

// Cargar Aportes
const loadAportes = async () => {
  loading.value = true

  try {
    const response = await $api('aportes')

    if (response.data) {
      aportes.value = response.data
      resumen.value = response.resumen || {
        total_hoy: 0,
        total_mes: 0,
        total_general: 0,
      }
    }

    showNotification('Aportes cargados correctamente', 'success')
  } catch (error) {
    console.error('Error al cargar aportes:', error)
    showNotification('Error al cargar aportes', 'error')
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  showCreateDialog.value = true
}

const openEditDialog = aporte => {
  editingAporte.value = aporte
  showEditDialog.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
}

const closeEditDialog = () => {
  showEditDialog.value = false
  editingAporte.value = null
}

const onAporteCreated = () => {
  loadAportes()
  closeCreateDialog()
}

const onAporteUpdated = () => {
  loadAportes()
  closeEditDialog()
}

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

const openDeleteDialog = aporte => {
  aporteToDelete.value = aporte
  showDeleteDialog.value = true
}

const closeDeleteDialog = () => {
  showDeleteDialog.value = false
  aporteToDelete.value = null
}

const confirmDeleteAporte = async () => {
  if (!aporteToDelete.value) return

  loader.start()

  try {
    await $api(`aportes/${aporteToDelete.value.id}`, {
      method: 'DELETE',
    })

    showNotification('Aporte eliminado exitosamente', 'success')
    loadAportes()
    closeDeleteDialog()
  } catch (error) {
    console.error('Error al eliminar aporte:', error)
    showNotification('Error al eliminar aporte', 'error')
  } finally {
    loader.stop()
  }
}

const deleteAporte = aporte => {
  openDeleteDialog(aporte)
}

// Aportes filtrados
const filteredAportes = computed(() => {
  if (!aportes.value || !aportes.value.length) return []

  const query = searchQuery.value.trim().toLowerCase()
  const todayObj = new Date()
  const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0')
  const currentMonth = today.substring(0, 7)

  return aportes.value
    .map(dia => {
      const items = dia.aportes || []

      const matchingItems = items.filter(a => {
        const aDate = (a.fecha || dia.fecha || '').split('T')[0]

        if (selectedFilter.value === 'today' && aDate !== today) return false
        if (selectedFilter.value === 'month' && aDate.substring(0, 7) !== currentMonth) return false

        if (!query) return true

        const partner = (a.partner_nombre || '').toLowerCase()
        const desc = (a.descripcion || '').toLowerCase()
        const cuenta = (cleanAccountName(a.cuenta) || '').toLowerCase()
        const user = (a.user_nombre || '').toLowerCase()
        const montoStr = String(a.monto || '')

        return (
          partner.includes(query) ||
          desc.includes(query) ||
          cuenta.includes(query) ||
          user.includes(query) ||
          montoStr.includes(query)
        )
      })

      return {
        ...dia,
        aportes: matchingItems,
      }
    })
    .filter(dia => dia.aportes.length > 0)
})

const totalAportesCount = computed(() => {
  return filteredAportes.value.reduce((acc, d) => acc + (d.aportes ? d.aportes.length : 0), 0)
})

// Montar componente
onMounted(() => {
  if (canAccessAportes.value) {
    loadAportes()
  }
})
</script>

<template>
  <!-- Estado sin permisos -->
  <div
    v-if="!canAccessAportes"
    class="d-flex justify-center align-center"
    style="min-height: 400px"
  >
    <VCard
      class="pa-8 text-center rounded-xl elevation-4"
      max-width="460"
    >
      <VAvatar
        color="error"
        variant="tonal"
        size="72"
        class="mb-4"
      >
        <VIcon
          size="38"
          icon="ri-lock-line"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold mb-2 text-high-emphasis">
        Acceso Restringido
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-6">
        No tienes permisos suficientes para acceder a la gestión de
        aportes.
      </p>
      <VBtn
        color="primary"
        size="large"
        variant="elevated"
        prepend-icon="ri-dashboard-line"
        class="font-weight-semibold"
        @click="router.push('/dashboard')"
      >
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>

  <div
    v-else
    class="pa-4 pa-sm-6 aportes-page"
  >
    <!-- Header Principal Sticky -->
    <VCard class="mb-6 rounded-xl border-light pa-5 elevation-1 sticky-header">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div class="d-flex align-center gap-4">
          <VAvatar
            color="primary"
            variant="tonal"
            rounded="lg"
            size="56"
            class="elevation-1"
          >
            <VIcon
              icon="ri-group-line"
              size="32"
            />
          </VAvatar>
          <div>
            <div class="d-flex align-center gap-2">
              <h1 class="text-h4 font-weight-bold text-high-emphasis mb-0">
                Aportes de Capital
              </h1>
              <VChip
                size="small"
                color="primary"
                variant="tonal"
                class="font-weight-bold"
              >
                {{ totalAportesCount }} {{ totalAportesCount === 1 ? 'registro' : 'registros' }}
              </VChip>
            </div>
            <p class="text-body-1 text-medium-emphasis mb-0 mt-1">
              Gestión de aportes de socios y control de capital acumulado
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-3">
          <VBtn
            title="Actualizar datos"
            variant="tonal"
            color="secondary"
            icon="ri-refresh-line"
            :loading="loading"
            @click="loadAportes"
          />
          <VBtn
            color="primary"
            variant="elevated"
            size="large"
            prepend-icon="ri-add-circle-line"
            class="font-weight-semibold elevation-2"
            @click="openCreateDialog"
          >
            Nuevo Aporte
          </VBtn>
        </div>
      </div>
    </VCard>

    <!-- Tarjetas de Resumen KPI con colores tonales -->
    <VRow class="mb-6">
      <!-- Aportes Hoy -->
      <VCol
        cols="12"
        sm="6"
        md="4"
      >
        <VCard
          class="pa-5 rounded-xl tonal-card bg-primary-tonal border-primary"
          elevation="0"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-primary text-uppercase tracking-wider">
                Aportes Hoy
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(resumen.total_hoy) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Total acumulado jornada de hoy
              </span>
            </div>
            <VAvatar
              color="primary"
              variant="elevated"
              size="52"
              class="elevation-3"
            >
              <VIcon
                size="28"
                icon="ri-calendar-check-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Aportes del Mes -->
      <VCol
        cols="12"
        sm="6"
        md="4"
      >
        <VCard
          class="pa-5 rounded-xl tonal-card bg-success-tonal border-success"
          elevation="0"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-success text-uppercase tracking-wider">
                Aportes del Mes
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(resumen.total_mes) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Total acumulado mes en curso
              </span>
            </div>
            <VAvatar
              color="success"
              variant="elevated"
              size="52"
              class="elevation-3"
            >
              <VIcon
                size="28"
                icon="ri-calendar-event-fill"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>

      <!-- Total General -->
      <VCol
        cols="12"
        sm="12"
        md="4"
      >
        <VCard
          class="pa-5 rounded-xl tonal-card bg-info-tonal border-info"
          elevation="0"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <span class="text-overline font-weight-bold text-info text-uppercase tracking-wider">
                Total General
              </span>
              <div class="text-h4 font-weight-extrabold text-high-emphasis mt-1">
                {{ formatCurrency(resumen.total_general) }}
              </div>
              <span class="text-caption text-medium-emphasis font-weight-medium">
                Suma histórica total de aportes
              </span>
            </div>
            <VAvatar
              color="info"
              variant="elevated"
              size="52"
              class="elevation-3"
            >
              <VIcon
                size="28"
                icon="ri-money-dollar-box-line"
                color="white"
              />
            </VAvatar>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Barra de Búsqueda y Filtros Rápidos -->
    <VCard class="pa-4 mb-6 rounded-xl border-light elevation-1">
      <VRow
        align="center"
        density="comfortable"
      >
        <VCol
          cols="12"
          md="6"
        >
          <VTextField
            v-model="searchQuery"
            prepend-inner-icon="ri-search-2-line"
            placeholder="Buscar por socio, descripción o cuenta..."
            hide-details
            clearable
            variant="outlined"
            density="compact"
          />
        </VCol>

        <VCol
          cols="12"
          md="6"
          class="d-flex justify-md-end align-center gap-2 flex-wrap"
        >
          <span class="text-body-2 font-weight-medium text-medium-emphasis me-2">Filtrar:</span>
          <VBtn
            size="small"
            :variant="selectedFilter === 'all' ? 'elevated' : 'tonal'"
            :color="selectedFilter === 'all' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedFilter = 'all'"
          >
            Todos
          </VBtn>
          <VBtn
            size="small"
            :variant="selectedFilter === 'today' ? 'elevated' : 'tonal'"
            :color="selectedFilter === 'today' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedFilter = 'today'"
          >
            Hoy
          </VBtn>
          <VBtn
            size="small"
            :variant="selectedFilter === 'month' ? 'elevated' : 'tonal'"
            :color="selectedFilter === 'month' ? 'primary' : 'secondary'"
            class="font-weight-semibold"
            @click="selectedFilter = 'month'"
          >
            Este Mes
          </VBtn>
        </VCol>
      </VRow>
    </VCard>

    <!-- Sin registros iniciales (Base de datos vacía) -->
    <VCard
      v-if="!loading && !aportes.length"
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
        No hay aportes registrados
      </h3>
      <p class="text-body-2 text-medium-emphasis max-w-md mx-auto mt-1 mb-6">
        Comienza registrando tu primer aporte de capital.
      </p>
      <VBtn
        color="primary"
        variant="elevated"
        prepend-icon="ri-add-line"
        class="font-weight-semibold"
        @click="openCreateDialog"
      >
        Registrar Primer Aporte
      </VBtn>
    </VCard>

    <!-- Lista Unificada de Aportes por Fecha (Se muestra si está cargando o si ya hay registros) -->
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
        class="transfer-table text-no-wrap"
      >
        <thead>
          <tr>
            <th
              class="text-left py-3"
              style="min-width: 220px;"
            >
              SOCIO
            </th>
            <th class="text-left py-3">
              DESCRIPCIÓN
            </th>
            <th class="text-left py-3">
              CUENTA & MÉTODO
            </th>
            <th class="text-left py-3">
              REGISTRADO POR
            </th>
            <th
              class="text-right py-3"
              style="width: 160px;"
            >
              MONTO
            </th>
            <th
              class="text-center py-3"
              style="width: 120px;"
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
              <div class="shimmer-line w-60" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-75" />
            </td>
            <td class="py-4">
              <div class="shimmer-chip" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-50" />
            </td>
            <td class="py-4">
              <div class="shimmer-line w-40 ms-auto" />
            </td>
            <td class="py-4 text-center">
              <div class="d-flex justify-center gap-2">
                <div class="shimmer-button" />
                <div class="shimmer-button" />
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Sin resultados filtrados -->
        <tbody v-else-if="!filteredAportes.length">
          <tr>
            <td
              colspan="6"
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
                Prueba cambiando el término de búsqueda o limpia el
                filtro aplicado.
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Datos reales -->
        <tbody v-else>
          <template
            v-for="dia in filteredAportes"
            :key="dia.fecha"
          >
            <!-- Fila de Encabezado por Fecha -->
            <tr class="transfer-date-header-row">
              <td colspan="6">
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
                        {{ dia.label }}
                      </span>
                      <span class="text-caption text-medium-emphasis">
                        • {{ dia.aportes.length }} {{ dia.aportes.length === 1 ? 'aporte' : 'aportes' }}
                      </span>
                    </div>
                  </div>

                  <div class="d-flex align-center gap-2 me-2">
                    <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold">TOTAL DÍA:</span>
                    <VChip
                      color="primary"
                      variant="tonal"
                      size="small"
                      class="font-weight-bold px-3"
                    >
                      {{ formatCurrency(dia.total_dia || dia.aportes.reduce((acc, a) => acc + parseFloat(a.monto || 0),
                                                                            0)) }}
                    </VChip>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Filas de Aportes -->
            <tr
              v-for="aporte in dia.aportes"
              :key="aporte.id"
              class="transfer-row"
            >
              <!-- Socio -->
              <td class="py-3">
                <div class="d-flex align-center gap-2 font-weight-bold text-high-emphasis">
                  <VAvatar
                    size="26"
                    color="success"
                    variant="tonal"
                  >
                    <VIcon
                      size="16"
                      icon="ri-user-line"
                    />
                  </VAvatar>
                  {{ aporte.partner_nombre }}
                </div>
              </td>

              <!-- Descripción -->
              <td class="py-3">
                <div
                  class="text-body-2 font-weight-medium text-high-emphasis text-wrap"
                  style="max-width: 250px;"
                >
                  {{ aporte.descripcion || 'Sin descripción' }}
                </div>
              </td>

              <!-- Cuenta & Método -->
              <td class="py-3">
                <div class="d-flex align-center gap-2">
                  <VIcon
                    :icon="aporte.metodo_pago === 'TRANSFERENCIA' ? 'ri-bank-card-line' : 'ri-money-dollar-circle-line'"
                    size="16"
                    :color="aporte.metodo_pago === 'TRANSFERENCIA' ? 'info' : 'success'"
                  />
                  <div class="d-flex flex-column">
                    <span class="text-body-2 font-weight-semibold text-high-emphasis">
                      {{ cleanAccountName(aporte.cuenta) }}
                    </span>
                    <span class="text-caption text-medium-emphasis text-lowercase capitalize-first">
                      {{ aporte.metodo_pago }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Registrado por -->
              <td class="py-3">
                <div class="d-flex align-center gap-2 text-body-2 font-weight-medium text-high-emphasis">
                  <VIcon
                    icon="ri-user-settings-line"
                    size="16"
                    class="text-medium-emphasis"
                  />
                  <span class="text-caption text-medium-emphasis">
                    {{ aporte.hora }} • {{ aporte.user_nombre || 'N/A' }}
                  </span>
                </div>
              </td>

              <!-- Monto -->
              <td class="py-3 text-right font-weight-bold text-subtitle-1 text-success">
                +{{ formatCurrency(aporte.monto) }}
              </td>

              <!-- Acciones -->
              <td class="py-3 text-center">
                <div class="d-flex justify-center gap-1">
                  <VBtn
                    icon
                    variant="text"
                    size="small"
                    class="action-btn text-warning"
                    title="Editar Aporte"
                    @click="openEditDialog(aporte)"
                  >
                    <VIcon
                      icon="ri-pencil-line"
                      size="18"
                    />
                  </VBtn>
                  <VBtn
                    icon
                    variant="text"
                    size="small"
                    class="action-btn text-error"
                    title="Eliminar Aporte"
                    @click="deleteAporte(aporte)"
                  />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </VTable>
    </VCard>
  </div>

  <!-- Diálogo de Crear Aportes -->
  <AporteCreateDialog
    v-model="showCreateDialog"
    @created="onAporteCreated"
  />

  <!-- Diálogo de Editar Aportes -->
  <AporteEditDialog
    v-model="showEditDialog"
    :aporte="editingAporte"
    @updated="onAporteUpdated"
  />

  <!-- Diálogo de Eliminar Aporte -->
  <VDialog
    v-model="showDeleteDialog"
    max-width="440"
    persistent
  >
    <VCard class="rounded-xl pa-2">
      <VCardTitle class="pa-4 pb-2">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-3">
            <VAvatar
              color="error"
              variant="tonal"
              size="40"
            >
              <VIcon
                color="error"
                icon="ri-delete-bin-line"
                size="22"
              />
            </VAvatar>
            <span class="text-h6 font-weight-bold text-high-emphasis">Eliminar Aporte</span>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            @click="closeDeleteDialog"
          />
        </div>
      </VCardTitle>

      <VDivider class="my-2" />

      <VCardText
        v-if="aporteToDelete"
        class="pa-4"
      >
        <div class="text-body-1 text-high-emphasis mb-3">
          ¿Estás seguro de eliminar el aporte de <strong>{{ aporteToDelete.partner_nombre }}</strong> por
          <strong class="text-error font-weight-bold">{{ formatCurrency(aporteToDelete.monto) }}</strong>?
        </div>

        <div class="text-caption text-medium-emphasis bg-error-tonal pa-3 rounded-lg border-error">
          <VIcon
            icon="ri-alert-line"
            size="16"
            color="error"
            class="me-1"
          />
          Esta acción revertirá los fondos de la cuenta asociada y no se puede deshacer.
        </div>
      </VCardText>

      <VCardActions class="pa-4 pt-0 d-flex justify-end gap-2">
        <VBtn
          variant="tonal"
          color="secondary"
          class="font-weight-semibold"
          :disabled="loading"
          @click="closeDeleteDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          class="font-weight-semibold"
          :loading="loading"
          prepend-icon="ri-delete-bin-line"
          @click="confirmDeleteAporte"
        >
          Confirmar Eliminación
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
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
</style>

<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
