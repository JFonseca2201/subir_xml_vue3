<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import PartnerAddDialog from '@/components/inventory/partners/PartnerAddDialog.vue'
import PartnerShowDialog from '@/components/inventory/partners/PartnerShowDialog.vue'
import PartnerEditDialog from '@/components/inventory/partners/PartnerEditDialog.vue'
import PartnerDeleteDialog from '@/components/inventory/partners/PartnerDeleteDialog.vue'

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const partnerSelected = ref(null)
const currentPage = ref(1)
const totalPage = ref(0)

const list_partners = ref([])
const search = ref(null)
const isLoading = ref(false)

const isPartnerAddDialogVisible = ref(false)
const isPartnerShowDialogVisible = ref(false)
const isPartnerEditDialogVisible = ref(false)
const isPartnerDeleteDialogVisible = ref(false)

// Helper de estado del socio
const isPartnerActive = partner => {
  if (!partner) return false
  if (partner.is_active !== undefined && partner.is_active !== null) {
    return partner.is_active === true || partner.is_active === 1 || partner.is_active === '1'
  }
  if (partner.status !== undefined && partner.status !== null) {
    return partner.status === 'active' || partner.status === 1 || partner.status === '1'
  }
  
  return true
}

// Métricas computadas
const activePartnersCount = computed(() => {
  return list_partners.value.filter(p => isPartnerActive(p)).length
})

const partnersWithPhoneCount = computed(() => {
  return list_partners.value.filter(p => !!p.phone).length
})

const hasActiveFilters = computed(() => {
  return !!(search.value && search.value.trim())
})

const resetFilters = () => {
  search.value = null
  currentPage.value = 1
  list()
}

// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch(search, () => {
  currentPage.value = 1
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    list()
  }, 400)
})

const list = async () => {
  isLoading.value = true

  try {
    let data = {
      search: search.value || '',
    }

    const resp = await $api("partners/index?page=" + currentPage.value + "&search=" + (search.value ? search.value : ""), {
      method: "POST",
      body: data,
      onResponseError({ response }) {
        console.log(response._data?.error)
      },
    })

    list_partners.value = resp.partners.data || []
    totalPage.value = resp.total_page || 1
    if (currentPage.value > totalPage.value && totalPage.value > 0) {
      currentPage.value = 1
    }
  } catch (error) {
    console.error(error)
    showNotification('Error al cargar la lista de socios', 'error')
  } finally {
    isLoading.value = false
  }
}

const showItem = ShowPartner => {
  partnerSelected.value = ShowPartner
  isPartnerShowDialogVisible.value = true
}

const editPartner = editPartner => {
  partnerSelected.value = editPartner
  isPartnerEditDialogVisible.value = true
}

const deletePartner = DeletePartner => {
  partnerSelected.value = DeletePartner
  isPartnerDeleteDialogVisible.value = true
}

const confirmDeletePartner = async () => {
  if (!partnerSelected.value) return
  try {
    await $api(`partners/${partnerSelected.value.id}`, {
      method: 'DELETE',
    })
    showNotification('Socio eliminado correctamente', 'success')
    await list()
  } catch (error) {
    showNotification('Error al eliminar socio', 'error')
  } finally {
    isPartnerDeleteDialogVisible.value = false
    partnerSelected.value = null
  }
}

const addPartner = newPartner => {
  list_partners.value.unshift(newPartner)
  showNotification('Socio agregado correctamente', 'success')
}

const updatePartner = updatedPartner => {
  const index = list_partners.value.findIndex(partner => partner.id === updatedPartner.id)
  if (index !== -1) {
    list_partners.value[index] = updatedPartner
    showNotification('Socio actualizado correctamente', 'success')
  } else {
    list()
  }
}

const formatDate = date => {
  if (!date) return '-'
  const clean = String(date).split('T')[0].split(' ')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`
  }
  const d = new Date(date)
  if (isNaN(d.getTime())) return date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${y}/${m}/${day}`
}

const getPartnerInitials = name => {
  if (!name) return 'SO'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  
  return name.slice(0, 2).toUpperCase()
}

onMounted(() => {
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 partners-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar
            size="42"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="me-3"
          >
            <VIcon
              icon="ri-hand-coin-line"
              size="26"
            />
          </VAvatar>
          Gestión de Socios
        </h1>
        <p class="text-medium-emphasis mb-0 d-none d-sm-block">
          Control de socios de capital, participaciones y directorio de contacto del taller
        </p>
      </div>

      <div class="d-flex gap-2 flex-wrap w-100 w-md-auto align-center">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold flex-grow-1 flex-md-grow-0"
          @click="isPartnerAddDialogVisible = true"
        >
          Nuevo Socio
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow
      class="mb-4 d-none d-sm-flex"
      dense
    >
      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-group-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Total Socios
            </div>
            <div class="text-h6 font-weight-bold text-high-emphasis text-truncate">
              {{ list_partners.length }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="success"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-user-follow-line"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Socios Activos
            </div>
            <div class="text-h6 font-weight-bold text-success text-truncate">
              {{ activePartnersCount }} <span class="text-caption text-disabled font-weight-regular">activos</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="4"
      >
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3 h-100">
          <VAvatar
            size="44"
            color="warning"
            variant="tonal"
            rounded="lg"
            class="flex-shrink-0"
          >
            <VIcon
              icon="ri-phone-fill"
              size="24"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-caption text-medium-emphasis font-weight-medium text-truncate">
              Con Teléfono
            </div>
            <div class="text-h6 font-weight-bold text-warning text-truncate">
              {{ partnersWithPhoneCount }} <span class="text-caption text-disabled font-weight-regular">contactables</span>
            </div>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Filtros y Búsqueda -->
    <VCard class="rounded-xl border elevation-0 mb-5 bg-surface">
      <VCardText class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="d-flex align-center gap-2 text-subtitle-2 font-weight-bold text-high-emphasis">
            <VIcon
              icon="ri-filter-3-line"
              size="18"
              color="primary"
            />
            <span>Filtros de Búsqueda</span>
          </div>

          <VBtn
            v-if="hasActiveFilters"
            variant="text"
            color="error"
            size="small"
            prepend-icon="ri-filter-off-line"
            class="font-weight-semibold"
            @click="resetFilters"
          >
            Limpiar Filtros
          </VBtn>
        </div>

        <VRow
          dense
          class="gap-y-3"
        >
          <VCol cols="12">
            <VTextField
              v-model="search"
              label="Buscar socio"
              placeholder="Nombre, cédula, email o teléfono..."
              clearable
              hide-details
              variant="outlined"
              density="comfortable"
              color="primary"
              :loading="isLoading"
              prepend-inner-icon="ri-search-2-line"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ESTADO VACÍO (Solo si no está cargando y no hay socios) -->
    <VCard
      v-if="!isLoading && (!list_partners || list_partners.length === 0)"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar
        size="76"
        color="primary"
        variant="tonal"
        class="mb-4"
      >
        <VIcon
          size="38"
          icon="ri-hand-coin-line"
        />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron socios
      </h3>
      <p
        class="text-body-1 text-medium-emphasis mb-5 mx-auto"
        style="max-width: 480px;"
      >
        Intenta ajustar los filtros de búsqueda o registra un nuevo socio en el sistema.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn
          v-if="hasActiveFilters"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="resetFilters"
        >
          Restablecer Filtros
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          @click="isPartnerAddDialogVisible = true"
        >
          Nuevo Socio
        </VBtn>
      </div>
    </VCard>

    <!-- LISTADO DE SOCIOS (MÓVIL Y ESCRITORIO CON SKELETON INTEGRADO) -->
    <div v-else>
      <!-- VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (d-md-none) -->
      <div class="d-md-none d-flex flex-column gap-3 mb-4">
        <!-- Skeleton Móvil mientras carga -->
        <template v-if="isLoading">
          <VCard
            v-for="n in 4"
            :key="'mob-skel-part-' + n"
            class="mobile-partner-card elevation-0 pa-4"
          >
            <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b">
              <div
                class="shimmer-line"
                style="width: 80px; height: 16px;"
              />
              <div class="d-flex gap-1">
                <div
                  class="shimmer-button rounded"
                  style="width: 28px; height: 28px;"
                />
                <div
                  class="shimmer-button rounded"
                  style="width: 28px; height: 28px;"
                />
              </div>
            </div>
            <div class="d-flex align-center gap-3 mb-3">
              <div
                class="shimmer-circle"
                style="width: 40px; height: 40px; border-radius: 8px;"
              />
              <div class="flex-grow-1">
                <div
                  class="shimmer-line w-75 mb-2"
                  style="height: 16px;"
                />
                <div
                  class="shimmer-line w-40"
                  style="height: 12px;"
                />
              </div>
            </div>
            <div class="d-flex justify-space-between pt-2 border-t">
              <div
                class="shimmer-line"
                style="width: 70px; height: 16px;"
              />
              <div
                class="shimmer-chip"
                style="width: 70px; height: 24px;"
              />
            </div>
          </VCard>
        </template>

        <!-- Tarjetas reales de socios -->
        <template v-else>
          <VCard
            v-for="partner in list_partners"
            :key="'mob-partner-' + partner.id"
            class="mobile-partner-card elevation-0"
          >
          <!-- Cabecera Móvil: ID + Identificación + Acciones Rápidas -->
          <div class="d-flex align-center justify-space-between gap-2 mb-2 pb-2 border-b">
            <div class="d-flex align-center gap-1.5 min-w-0">
              <span class="text-caption text-disabled font-weight-bold">#{{ partner.id }}</span>
              <span class="text-caption text-disabled text-uppercase font-weight-bold">Doc:</span>
              <span class="font-mono font-weight-bold text-high-emphasis text-body-2">
                {{ partner.identification || 'Sin doc.' }}
              </span>
            </div>

            <!-- Botones de Acción Móvil -->
            <div class="d-flex align-center gap-1 flex-shrink-0">
              <VBtn
                size="x-small"
                color="info"
                variant="tonal"
                icon="ri-eye-line"
                title="Ver Ficha"
                @click="showItem(partner)"
              />
              <VBtn
                size="x-small"
                color="warning"
                variant="tonal"
                icon="ri-pencil-line"
                title="Editar Socio"
                @click="editPartner(partner)"
              />
              <VBtn
                size="x-small"
                color="error"
                variant="tonal"
                icon="ri-delete-bin-line"
                title="Eliminar Socio"
                @click="deletePartner(partner)"
              />
            </div>
          </div>

          <!-- Socio Nombre y Avatar -->
          <div class="d-flex align-start gap-3 mb-2">
            <VAvatar
              size="40"
              color="primary"
              variant="tonal"
              rounded="lg"
              class="font-weight-bold elevation-0 flex-shrink-0 mt-0.5"
            >
              <span>{{ getPartnerInitials(partner.name) }}</span>
            </VAvatar>
            <div class="min-w-0 flex-grow-1">
              <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                {{ partner.name }}
              </div>
              <div
                v-if="partner.phone"
                class="text-caption text-medium-emphasis mt-0.5 d-flex align-center gap-1"
              >
                <VIcon
                  icon="ri-phone-line"
                  size="14"
                  color="primary"
                />
                <span>{{ partner.phone }}</span>
              </div>
            </div>
          </div>

          <!-- Email -->
          <div
            v-if="partner.email"
            class="mb-2 text-caption text-medium-emphasis d-flex align-center gap-1"
          >
            <VIcon
              icon="ri-mail-line"
              size="14"
              color="medium-emphasis"
            />
            <span class="text-truncate">{{ partner.email }}</span>
          </div>

          <!-- Pie Móvil: Fecha y Estado -->
          <div class="d-flex align-center justify-space-between pt-1.5 border-t">
            <span class="text-caption text-disabled font-weight-medium">
              Reg: {{ formatDate(partner.created_at) }}
            </span>
            <div
              class="status-pill-clean"
              :class="isPartnerActive(partner) ? 'status-paid' : 'status-pending'"
            >
              <span class="status-dot" />
              <span>{{ isPartnerActive(partner) ? 'Activo' : 'Inactivo' }}</span>
            </div>
          </div>
        </VCard>
        </template>
      </div>

      <!-- VISTA ESCRITORIO: TABLA MODERNA (d-none d-md-block) -->
      <VCard class="d-none d-md-block rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable
          hover
          class="partners-modern-table overflow-x-auto"
        >
          <thead>
            <tr class="bg-grey-lighten-5">
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 70px;"
              >
                ID
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 160px;"
              >
                Identificación
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="min-width: 250px;"
              >
                Nombre del Socio
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 240px;"
              >
                Email
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 160px;"
              >
                Teléfono
              </th>
              <th
                class="text-left font-weight-bold text-uppercase py-3"
                style="width: 130px;"
              >
                Fecha Reg.
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 120px;"
              >
                Estado
              </th>
              <th
                class="text-center font-weight-bold text-uppercase py-3"
                style="width: 130px;"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-if="isLoading">
              <tr
                v-for="n in 5"
                :key="'skel-part-row-' + n"
                class="skeleton-row align-middle"
              >
                <td class="py-4" style="width: 70px;">
                  <div class="shimmer-line" style="width: 35px; height: 16px;" />
                </td>
                <td class="py-4" style="width: 160px;">
                  <div class="shimmer-line" style="width: 100px; height: 16px;" />
                </td>
                <td class="py-4">
                  <div class="d-flex align-center gap-3">
                    <div class="shimmer-circle" style="width: 38px; height: 38px; border-radius: 8px;" />
                    <div class="flex-grow-1">
                      <div class="shimmer-line mb-1.5" style="width: 150px; height: 16px;" />
                    </div>
                  </div>
                </td>
                <td class="py-4" style="width: 240px;">
                  <div class="shimmer-line" style="width: 160px; height: 14px;" />
                </td>
                <td class="py-4" style="width: 160px;">
                  <div class="shimmer-line" style="width: 110px; height: 14px;" />
                </td>
                <td class="py-4" style="width: 130px;">
                  <div class="shimmer-line" style="width: 80px; height: 14px;" />
                </td>
                <td class="py-4 text-center" style="width: 120px;">
                  <div class="shimmer-chip mx-auto" style="width: 70px; height: 24px;" />
                </td>
                <td class="py-4 text-center" style="width: 130px;">
                  <div class="d-flex justify-center align-center gap-1">
                    <div class="shimmer-button rounded" style="width: 32px; height: 32px;" />
                    <div class="shimmer-button rounded" style="width: 32px; height: 32px;" />
                    <div class="shimmer-button rounded" style="width: 32px; height: 32px;" />
                  </div>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr
                v-for="partner in list_partners"
                :key="partner.id"
                class="partner-table-row"
              >
                <td class="font-weight-bold text-disabled">
                  #{{ partner.id }}
                </td>

                <!-- Identificación -->
                <td>
                  <span class="font-weight-bold text-high-emphasis font-mono">
                    {{ partner.identification || 'Sin documento' }}
                  </span>
                </td>

                <!-- Socio con Avatar -->
                <td class="py-3">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="38"
                      color="primary"
                      variant="tonal"
                      rounded="lg"
                      class="font-weight-bold elevation-0"
                    >
                      <span>{{ getPartnerInitials(partner.name) }}</span>
                    </VAvatar>
                    <div>
                      <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                        {{ partner.name }}
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Email -->
                <td class="py-3">
                  <span
                    class="text-body-2 text-medium-emphasis text-truncate"
                    style="max-width: 230px;"
                    :title="partner.email"
                  >
                    {{ partner.email || '-' }}
                  </span>
                </td>

                <!-- Teléfono -->
                <td class="py-3">
                  <span class="text-body-2 font-weight-medium text-high-emphasis">
                    {{ partner.phone || '-' }}
                  </span>
                </td>

                <!-- Fecha Reg -->
                <td class="py-3">
                  <span class="text-caption text-medium-emphasis">
                    {{ formatDate(partner.created_at) }}
                  </span>
                </td>

                <!-- Estado (Pill limpia aceituna / pastel con punto) -->
                <td
                  class="text-center py-3"
                  style="white-space: nowrap;"
                >
                  <div
                    class="status-pill-clean"
                    :class="isPartnerActive(partner) ? 'status-paid' : 'status-pending'"
                  >
                    <span class="status-dot" />
                    <span>{{ isPartnerActive(partner) ? 'Activo' : 'Inactivo' }}</span>
                  </div>
                </td>

                <!-- Acciones -->
                <td class="text-center">
                  <div class="d-flex justify-center align-center gap-1">
                    <VBtn
                      size="small"
                      color="info"
                      variant="tonal"
                      icon="ri-eye-line"
                      title="Ver Ficha del Socio"
                      @click="showItem(partner)"
                    />
                    <VBtn
                      size="small"
                      color="warning"
                      variant="tonal"
                      icon="ri-pencil-line"
                      title="Editar Socio"
                      @click="editPartner(partner)"
                    />
                    <VBtn
                      size="small"
                      color="error"
                      variant="tonal"
                      icon="ri-delete-bin-line"
                      title="Eliminar Socio"
                      @click="deletePartner(partner)"
                    />
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard
        v-if="totalPage > 0"
        class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface"
      >
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100 text-center text-sm-start">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_partners.length }}</strong> registros
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPage"
            :disabled="isLoading"
            rounded="circle"
            :total-visible="$vuetify.display.xs ? 4 : 7"
            :size="$vuetify.display.xs ? 'small' : 'default'"
            density="comfortable"
            color="primary"
            class="my-0"
            @update:model-value="list"
          />
        </div>
      </VCard>
    </div>

    <!-- DIÁLOGOS -->
    <PartnerAddDialog
      v-model:isDialogVisible="isPartnerAddDialogVisible"
      @add-partner="addPartner"
    />
    <PartnerShowDialog
      v-if="isPartnerShowDialogVisible"
      v-model:isDialogVisible="isPartnerShowDialogVisible"
      :partner-selected="partnerSelected"
    />
    <PartnerEditDialog
      v-if="isPartnerEditDialogVisible"
      v-model:isDialogVisible="isPartnerEditDialogVisible"
      :partner-selected="partnerSelected"
      @update-partner="updatePartner"
    />
    <PartnerDeleteDialog
      v-if="isPartnerDeleteDialogVisible && partnerSelected"
      v-model:isDialogVisible="isPartnerDeleteDialogVisible"
      :partner-selected="partnerSelected"
      @delete-partner="confirmDeletePartner"
    />
  </div>
</template>

<style scoped lang="scss">
.kpi-stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-color: rgba(var(--v-border-color), 0.1) !important;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(var(--v-theme-on-surface), 0.06);
  }
}

.partner-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}

.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
}

// Status Pills (Estilo listado de clientes/empleados/compras)
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

.status-pending {
  background-color: #fef2f2 !important;
  color: #991b1b !important;
  border: 1px solid #fecaca !important;

  .status-dot {
    background-color: #ef4444 !important;
  }
}
</style>
