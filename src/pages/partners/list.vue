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

// Métricas computadas
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
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-hand-coin-line" size="26" />
          </VAvatar>
          Gestión de Socios
        </h1>
        <p class="text-medium-emphasis mb-0">
          Control de socios de capital, participaciones y directorio de contacto del taller
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="isPartnerAddDialogVisible = true"
        >
          Nuevo Socio
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-group-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Socios Registrados</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_partners.length }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-phone-fill" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Con Teléfono de Contacto</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ partnersWithPhoneCount }} <span class="text-caption text-disabled font-weight-regular">registrados</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-calendar-check-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Página Actual</div>
            <div class="text-h6 font-weight-bold text-warning">
              Página {{ currentPage }} <span class="text-caption text-disabled font-weight-regular">de {{ totalPage || 1 }}</span>
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
            <VIcon icon="ri-filter-3-line" size="18" color="primary" />
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

        <VRow dense class="gap-y-3">
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

    <!-- ESTADO DE CARGA -->
    <VCard v-if="isLoading" class="rounded-xl border overflow-hidden elevation-0 bg-surface">
      <VTable>
        <tbody>
          <tr v-for="n in 5" :key="n" class="skeleton-row align-middle">
            <td class="py-4" style="width: 70px;"><div class="shimmer-line w-40" /></td>
            <td class="py-4" style="width: 150px;"><div class="shimmer-line w-75" /></td>
            <td class="py-4"><div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4"><div class="shimmer-line w-60" /></td>
            <td class="py-4"><div class="shimmer-line w-50" /></td>
            <td class="py-4 text-center" style="width: 130px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_partners || list_partners.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-hand-coin-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron socios
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar los filtros de búsqueda o registra un nuevo socio en el sistema.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" @click="isPartnerAddDialogVisible = true">
          Nuevo Socio
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE SOCIOS -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="partners-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 160px;">
                Identificación
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Nombre del Socio
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 240px;">
                Email
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 160px;">
                Teléfono
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 130px;">
                Fecha Reg.
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 130px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="partner in list_partners" :key="partner.id" class="partner-table-row">
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
                  <VAvatar size="38" color="primary" variant="tonal" rounded="lg" class="font-weight-bold elevation-0">
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
                <span class="text-body-2 text-medium-emphasis text-truncate" style="max-width: 230px;" :title="partner.email">
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
          </tbody>
        </VTable>
      </VCard>

      <!-- Paginación -->
      <VCard class="mt-4 rounded-xl border elevation-0 pa-4 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 w-100">
          <div class="text-body-2 text-medium-emphasis">
            Mostrando <strong class="text-high-emphasis">{{ list_partners.length }}</strong> registros
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPage"
            rounded="circle"
            :total-visible="7"
            color="primary"
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
</style>
