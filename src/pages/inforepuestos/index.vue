<script setup>
import { ref, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import InfoRepuestoFormDialog from '@/components/inforepuestos/InfoRepuestoFormDialog.vue'
import InfoRepuestoDetailDialog from '@/components/inforepuestos/InfoRepuestoDetailDialog.vue'

import { usePermissions } from '@/composables/usePermissions'

const { showNotification } = useGlobalToast()
const { can } = usePermissions()

// Data
const requests = ref([])
const loading = ref(false)
const page = ref(1)
const perPage = ref(10)
const totalPages = ref(1)
const totalItems = ref(0)

// Filters
const searchQuery = ref('')
const tractionFilter = ref('ALL')
const yearFilter = ref(null)

// Dialog states
const isFormDialogOpen = ref(false)
const isDetailDialogOpen = ref(false)
const requestSelected = ref(null)

// Load requests from backend with pagination
const loadRequests = async () => {
  loading.value = true
  try {
    const params = {
      page: page.value,
      per_page: perPage.value,
    }

    if (searchQuery.value && searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }
    if (tractionFilter.value !== 'ALL') {
      params.traction = tractionFilter.value
    }
    if (yearFilter.value) {
      params.year = yearFilter.value
    }

    const response = await $api('spare-part-requests', { params })
    if (response) {
      requests.value = response.data || []
      totalItems.value = response.total || 0
      totalPages.value = response.last_page || 1
    }
  } catch (error) {
    console.error('Error al cargar búsquedas de repuestos:', error)
    showNotification('Error al cargar el listado de repuestos', 'error')
  } finally {
    loading.value = false
  }
}

// Watch filters to reset page and reload
watch([searchQuery, tractionFilter, yearFilter], () => {
  page.value = 1
  loadRequests()
})

const handlePageChange = newPage => {
  page.value = newPage
  loadRequests()
}

// Reactively reload on save/edit/delete (no page reload)
const handleSaveSuccess = () => {
  loadRequests()
}

const openCreate = () => {
  requestSelected.value = null
  isFormDialogOpen.value = true
}

const openEdit = item => {
  requestSelected.value = item
  isFormDialogOpen.value = true
}

const openDetail = item => {
  requestSelected.value = item
  isDetailDialogOpen.value = true
}

const deleteRequest = async item => {
  const result = await Swal.fire({
    title: '¿Estás seguro?',
    text: `Vas a eliminar el registro del vehículo ${item.brand} ${item.model}. Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#fb7578',
    cancelButtonColor: '#90a4ae',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })

  if (result.isConfirmed) {
    try {
      const response = await $api(`spare-part-requests/${item.id}`, {
        method: 'DELETE',
      })

      if (response && response.success) {
        showNotification(response.message || 'Registro eliminado correctamente', 'success')
        loadRequests()
      }
    } catch (error) {
      console.error('Error al eliminar registro:', error)
      showNotification('Error al eliminar el registro', 'error')
    }
  }
}

onMounted(() => {
  loadRequests()
})
</script>

<template>
  <VContainer
    fluid
    class="inforepuestos-container pa-6"
  >
    <div class="header-glow" />

    <!-- Título y botón superior -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-6 relative-header">
      <div class="d-flex align-center gap-3">
        <VAvatar
          color="primary"
          variant="tonal"
          size="50"
          class="elevation-2"
        >
          <VIcon
            icon="ri-file-list-3-line"
            size="28"
          />
        </VAvatar>
        <div>
          <h3 class="text-h4 font-weight-bold text-high-emphasis mb-1">
            Gestión y Búsqueda de Repuestos por Vehículo
          </h3>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Administra el historial de repuestos y compatibilidades por marca, modelo y año.
          </p>
        </div>
      </div>
      <VBtn
        v-if="can('register_product')"
        color="primary"
        prepend-icon="ri-add-line"
        class="elevation-2"
        @click="openCreate"
      >
        Registrar Búsqueda
      </VBtn>
    </div>

    <!-- Filtros de Búsqueda -->
    <VCard
      class="mb-6 elevation-3 search-card"
      variant="outlined"
      color="rgba(var(--v-border-color), 0.12)"
    >
      <VCardText class="pa-5">
        <VRow dense>
          <!-- Búsqueda General -->
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="searchQuery"
              label="Búsqueda por Palabra Clave"
              placeholder="Ej: Chevrolet, Vitara, Amortiguador, Frenos..."
              clearable
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              prepend-inner-icon="ri-search-2-line"
            />
          </VCol>

          <!-- Tracción / Suspensión -->
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="tractionFilter"
              label="Tracción / Suspensión"
              :items="[
                { title: 'Todos', value: 'ALL' },
                { title: '4x4', value: '4X4' },
                { title: '4x2', value: '4X2' },
                { title: 'AWD', value: 'AWD' },
                { title: 'FWD', value: 'FWD' },
                { title: 'RWD', value: 'RWD' }
              ]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
            />
          </VCol>

          <!-- Año -->
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VTextField
              v-model.number="yearFilter"
              label="Año del Vehículo"
              type="number"
              placeholder="Ej: 2007"
              clearable
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              prepend-inner-icon="ri-calendar-line"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- Listado principal -->
    <VCard
      class="elevation-3"
      variant="outlined"
      color="rgba(var(--v-border-color), 0.12)"
    >
      <VCardText class="pa-0">
        <VTable class="custom-catalog-table">
          <thead>
            <tr>
              <th
                class="text-left font-weight-bold"
                style="width: 35%;"
              >
                Información de Vehículo
              </th>
              <th class="text-left font-weight-bold">
                Repuestos Compatibles Registrados
              </th>
              <th
                class="text-center font-weight-bold"
                style="width: 150px;"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Skeleton Loader -->
            <tr
              v-for="i in 5"
              v-if="loading"
              :key="'skeleton-' + i"
            >
              <td
                colspan="3"
                class="py-4"
              >
                <VSkeletonLoader type="text" />
              </td>
            </tr>

            <!-- No Data -->
            <tr v-else-if="requests.length === 0">
              <td
                colspan="3"
                class="text-center py-8"
              >
                <VIcon
                  icon="ri-inbox-line"
                  size="48"
                  class="text-grey-lighten-1 mb-2"
                />
                <h4 class="text-h6 font-weight-bold">
                  No se encontraron registros
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                  Prueba cambiando los filtros o agrega una nueva búsqueda arriba.
                </p>
              </td>
            </tr>

            <!-- Table Rows -->
            <tr
              v-for="item in requests"
              v-else
              :key="item.id"
              class="catalog-row"
            >
              <td>
                <div class="vehicle-info-cell">
                  <div class="vehicle-title text-uppercase font-weight-bold">
                    {{ item.brand }} {{ item.model }}
                  </div>
                  <div class="vehicle-meta-chips d-flex align-center gap-1 mt-1">
                    <VChip
                      size="x-small"
                      color="secondary"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      {{ item.year }}
                    </VChip>
                    <VChip
                      v-if="item.traction"
                      size="x-small"
                      color="info"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      {{ item.traction }}
                    </VChip>
                    <VChip
                      v-if="item.origin_country"
                      size="x-small"
                      color="warning"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      {{ item.origin_country }}
                    </VChip>
                  </div>
                  <div class="vehicle-user text-caption text-disabled mt-2 d-flex align-center gap-1">
                    <VIcon
                      icon="ri-user-smile-line"
                      size="12"
                    />
                    <span>Por: {{ item.user ? (item.user.name + ' ' + (item.user.surname || '')) : 'Sistema' }}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="spare-part-list-wrapper">
                  <div
                    v-for="(subItem, idx) in (item.items || [])"
                    :key="idx"
                    class="spare-part-row-item"
                  >
                    <!-- Icon or Index Badge -->
                    <div class="item-badge">
                      #{{ idx + 1 }}
                    </div>

                    <!-- Description & Brand -->
                    <div class="item-info">
                      <div class="item-name text-uppercase">
                        {{ subItem.spare_parts_detail }}
                      </div>
                      <div class="item-brand">
                        Marca: {{ subItem.spare_part_brand }}
                      </div>
                    </div>

                    <!-- Category -->
                    <div class="item-category">
                      <VChip
                        size="x-small"
                        color="primary"
                        variant="tonal"
                        class="font-weight-bold"
                      >
                        {{ subItem.category }}
                      </VChip>
                    </div>

                    <!-- Pricing -->
                    <div class="item-pricing">
                      <span class="price-sell">PVP: ${{
                        parseFloat(subItem.public_price || 0).toFixed(2) }}</span>
                      <span class="price-buy">Compra: ${{ parseFloat(subItem.purchase_price || 0).toFixed(2)
                      }}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <div class="d-flex justify-center gap-1">
                  <!-- Ver Detalle -->
                  <VBtn
                    size="small"
                    color="info"
                    variant="text"
                    icon="ri-eye-line"
                    @click="openDetail(item)"
                  />
                  <!-- Editar -->
                  <VBtn
                    v-if="can('edit_product')"
                    size="small"
                    color="warning"
                    variant="text"
                    icon="ri-edit-line"
                    @click="openEdit(item)"
                  />
                  <!-- Eliminar -->
                  <VBtn
                    v-if="can('delete_product')"
                    size="small"
                    color="error"
                    variant="text"
                    icon="ri-delete-bin-line"
                    @click="deleteRequest(item)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>

      <!-- Paginación -->
      <VDivider v-if="totalPages > 1" />
      <VCardText
        v-if="totalPages > 1"
        class="d-flex align-center justify-space-between flex-wrap gap-4 py-4 px-6"
      >
        <span class="text-subtitle-2 text-medium-emphasis">
          Mostrando {{ requests.length }} de {{ totalItems }} registros
        </span>
        <VPagination
          :model-value="page"
          :length="totalPages"
          :total-visible="5"
          size="small"
          @update:model-value="handlePageChange"
        />
      </VCardText>
    </VCard>

    <!-- Formulario modal de Creación/Edición -->
    <InfoRepuestoFormDialog
      v-model:isDialogVisible="isFormDialogOpen"
      :request-selected="requestSelected"
      @save-success="handleSaveSuccess"
    />

    <!-- Detalle modal -->
    <InfoRepuestoDetailDialog
      v-model:isDialogVisible="isDetailDialogOpen"
      :request-selected="requestSelected"
    />
  </VContainer>
</template>
