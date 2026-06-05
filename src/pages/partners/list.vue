<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

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

// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch(search, () => {
  currentPage.value = 1
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    list()
  }, 500)
})

const list = async () => {
  loader.start()

  try {

    let data = {
      search: search.value || '',
    }

    const resp = await $api("partners/index?page=" + currentPage.value + "&search=" + (search.value ? search.value : ""), {
      method: "POST",
      body: data,
      onResponseError({ response }) {
        console.log(response._data.error)
      },
    })

    console.log(resp)
    list_partners.value = resp.partners.data
    totalPage.value = resp.total_page
    if (currentPage.value > totalPage.value && totalPage.value > 0) {
      currentPage.value = 1
    }
    showNotification('Lista de socios cargada correctamente', 'success')
  } catch (error) {
    console.error(error)
    showNotification('Error al cargar la lista de socios', 'error')
  } finally {
    loader.stop()
  }
}

const providers = ref([])

const showItem = ShowPartner => {
  console.log(ShowPartner)
  isPartnerShowDialogVisible.value = true
  partnerSelected.value = ShowPartner
}

const editPartner = editPartner => {
  console.log(editPartner)
  isPartnerEditDialogVisible.value = true
  partnerSelected.value = editPartner

}

const deletePartner = DeletePartner => {
  partnerSelected.value = DeletePartner
  isPartnerDeleteDialogVisible.value = true
  console.log(DeletePartner)
}

const confirmDeletePartner = async () => {
  if (!partnerSelected.value) return
  try {
    await $api(`partners/${partnerSelected.value.id}`, {
      method: 'DELETE',
      onResponseError({ response }) {
        showNotification('Error al eliminar socio', 'error')
      },
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
  console.log('Agregando nuevo socio:', newPartner)

  // Agregar el nuevo socio al inicio de la lista
  list_partners.value.unshift(newPartner)

  // Mostrar mensaje de éxito
  showNotification('Socio agregado correctamente a la tabla', 'success')
}

const updatePartner = updatedPartner => {
  console.log('Actualizando socio:', updatedPartner)

  // Buscar el índice del socio a actualizar
  const index = list_partners.value.findIndex(partner => partner.id === updatedPartner.id)

  if (index !== -1) {
    // Actualizar el socio en la lista
    list_partners.value[index] = updatedPartner

    // Mostrar mensaje de éxito
    showNotification('Socio actualizado correctamente en la tabla', 'success')
  } else {
    // Si no se encuentra, recargar la lista
    console.warn('Socio no encontrado en la lista, recargando...')
    list()
  }
}

// Método de refresco para reiniciar todos los filtros
const refresh = () => {
  search.value = null
  currentPage.value = 1
  list()
}

const formatDate = date => {
  if (!date) return '-'
  const d = new Date(date)

  return isNaN(d) ? '-' : d.toISOString().slice(0, 10)
}

onMounted(() => {
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 partners-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-group-3-line" color="primary" class="me-2" size="28" />
          Socios
        </h1>
        <p class="text-medium-emphasis mb-0">
          Gestión de socios del taller
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <VBtn color="primary" prepend-icon="ri-add-circle-line"
          @click="isPartnerAddDialogVisible = !isPartnerAddDialogVisible">
          Nuevo Socio
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12">
            <VTextField v-model="search" label="Buscar socio" placeholder="Nombre, cédula, email..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto" clearable
              color="primary" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Socios -->
      <div class="position-relative">
        <VProgressLinear v-if="loader.loading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />

        <div class="overflow-x-auto">
          <VTable hover class="partners-table">
            <thead>
              <tr>
                <th class="text-center font-weight-bold text-uppercase" style="width: 60px;">
                  #
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 150px;">
                  CÉDULA/RUC
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">
                  SOCIO
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 120px;">
                  FECHA REG.
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 200px;">
                  EMAIL
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">
                  TELÉFONO
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody v-if="loader.loading">
              <tr>
                <td colspan="7" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">
                    Cargando registros...
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!list_partners || list_partners.length === 0">
              <tr>
                <td colspan="7" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">
                    ri-inbox-line
                  </VIcon>
                  <div class="text-h6">
                    No hay socios registrados
                  </div>
                  <div class="text-body-2">
                    Intenta ajustar los filtros de búsqueda
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="partner in list_partners" :key="partner.id" class="partners-row align-middle">
                <td class="text-center py-3">
                  <span class="font-weight-bold text-subtitle-1 text-primary">{{ partner.id }}</span>
                </td>

                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4">{{ partner.identification }}</span>
                </td>

                <td class="text-left py-3">
                  <span class="font-weight-semibold text-body-1 text-grey-darken-4">{{ partner.name }}</span>
                </td>

                <td class="text-no-wrap text-left py-3">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-calendar-line" size="14" class="mr-1 text-grey" />
                    <span class="text-body-2 text-medium-emphasis">{{ formatDate(partner.created_at) }}</span>
                  </div>
                </td>

                <td class="text-left py-3" style="max-width: 250px;">
                  <span class="text-body-2 text-grey-darken-3 text-truncate" :title="partner.email">{{ partner.email
                  }}</span>
                </td>

                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3">{{ partner.phone }}</span>
                </td>

                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <!-- Ver Detalle -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="info" title="Ver Detalle"
                      @click="showItem(partner)">
                      <VIcon icon="ri-eye-line" size="20" />
                    </VBtn>

                    <!-- Editar -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="warning" title="Editar"
                      @click="editPartner(partner)">
                      <VIcon icon="ri-pencil-line" size="20" />
                    </VBtn>

                    <!-- Eliminar -->
                    <VBtn class="action-btn" variant="text" icon size="small" color="error" title="Eliminar"
                      @click="deletePartner(partner)">
                      <VIcon icon="ri-delete-bin-6-line" size="20" />
                    </VBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>

      <VDivider />

      <!-- Paginación -->
      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ list_partners.length }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPage" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="list" />
        </div>
      </VCardActions>
    </VCard>

    <!-- DIALOG -->
    <PartnerAddDialog v-model:isDialogVisible="isPartnerAddDialogVisible" @add-partner="addPartner" />
    <PartnerShowDialog v-if="isPartnerShowDialogVisible" v-model:isDialogVisible="isPartnerShowDialogVisible"
      :partner-selected="partnerSelected" />
    <PartnerEditDialog v-if="isPartnerEditDialogVisible" v-model:isDialogVisible="isPartnerEditDialogVisible"
      :partner-selected="partnerSelected" @update-partner="updatePartner" />
    <PartnerDeleteDialog v-if="isPartnerDeleteDialogVisible && partnerSelected"
      v-model:isDialogVisible="isPartnerDeleteDialogVisible" :partner-selected="partnerSelected"
      @delete-partner="confirmDeletePartner" />
  </div>
</template>

<style scoped>
.border-light {
  border: 1px solid #e2e8f0 !important;
}

.border-bottom-light {
  border-bottom: 1px solid #e2e8f0 !important;
}

/* Estilo de la tabla de socios */
.partners-table :deep(thead) {
  background-color: #f8fafc !important;
}

.partners-table :deep(thead th) {
  color: #475569 !important;
  font-weight: 700 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.6px;
  border-bottom: 1px solid #e2e8f0 !important;
  height: 48px !important;
}

.partners-row {
  height: 52px;
  transition: background-color 0.2s ease;
}

.partners-row:hover {
  background-color: #f8fafc !important;
}

.action-btn {
  transition: all 0.2s ease;
  border-radius: 6px !important;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}
</style>