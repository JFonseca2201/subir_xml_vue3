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
  isLoading.value = true

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

    list_partners.value = resp.partners.data || []
    totalPage.value = resp.total_page
    if (currentPage.value > totalPage.value && totalPage.value > 0) {
      currentPage.value = 1
    }
    showNotification('Lista de socios cargada correctamente', 'success')
  } catch (error) {
    console.error(error)
    showNotification('Error al cargar la lista de socios', 'error')
  } finally {
    isLoading.value = false
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

  return isNaN(d) ? '-' : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

onMounted(() => {
  list()
})
</script>

<template>
  <div class="pa-4 pa-sm-6 partners-management-page">
    <!-- Header y Filtros Fijos (Sticky Top) -->
    <div class="sticky-page-header-wrapper">
      <!-- Encabezado de la página -->
      <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-4 gap-4">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
            <VIcon
              icon="ri-group-3-line"
              color="primary"
              class="me-2"
              size="28"
            />
            Socios
          </h1>
          <p class="text-medium-emphasis mb-0">
            Gestión de socios del taller
          </p>
        </div>
        <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
          <VBtn
            color="primary"
            prepend-icon="ri-add-circle-line"
            @click="isPartnerAddDialogVisible = !isPartnerAddDialogVisible"
          >
            Nuevo Socio
          </VBtn>
        </div>
      </div>

      <!-- Filtros y Búsqueda -->
      <VCard class="rounded-lg border-light border elevation-0 sticky-filter-card">
        <VCardText class="pa-4 bg-grey-lighten-5">
          <VRow class="align-center">
            <VCol cols="12">
              <VTextField
                v-model="search"
                label="Buscar socio"
                placeholder="Nombre, cédula, email..."
                prepend-inner-icon="ri-search-line"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                clearable
                color="primary"
              />
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </div>

    <!-- Contenedor Principal (Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Tabla de Socios -->
      <div class="position-relative">

        <div class="overflow-x-auto">
          <VTable
            hover
            class="partners-table"
          >
            <thead>
              <tr>
                <th
                  class="text-center font-weight-bold text-uppercase"
                  style="width: 60px;"
                >
                  #
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="min-width: 150px;"
                >
                  CÉDULA/RUC
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="min-width: 200px;"
                >
                  SOCIO
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="width: 120px;"
                >
                  FECHA REG.
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="min-width: 200px;"
                >
                  EMAIL
                </th>
                <th
                  class="text-left font-weight-bold text-uppercase"
                  style="width: 150px;"
                >
                  TELÉFONO
                </th>
                <th
                  class="text-center font-weight-bold text-uppercase"
                  style="width: 90px;"
                >
                  ACCIONES
                </th>
              </tr>
            </thead>

            <!-- Cargando (Skeleton Rows) -->
            <tbody v-if="isLoading">
              <tr
                v-for="n in 5"
                :key="n"
                class="skeleton-row align-middle"
              >
                <td class="text-center py-4">
                  <div class="shimmer-line w-40 mx-auto" />
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-75" />
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-80" />
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-60" />
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-80" />
                </td>
                <td class="py-4">
                  <div class="shimmer-line w-70" />
                </td>
                <td class="text-center py-4">
                  <div class="d-flex justify-center gap-1">
                    <div class="shimmer-button rounded" />
                    <div class="shimmer-button rounded" />
                    <div class="shimmer-button rounded" />
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else-if="!list_partners || list_partners.length === 0">
              <tr>
                <td
                  colspan="7"
                  class="text-center pa-8 text-medium-emphasis"
                >
                  <VIcon
                    size="48"
                    class="mb-3"
                    color="grey-lighten-1"
                  >
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
              <tr
                v-for="partner in list_partners"
                :key="partner.id"
                class="partners-row align-middle"
              >
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
                    <VIcon
                      icon="ri-calendar-line"
                      size="14"
                      class="mr-1 text-grey"
                    />
                    <span class="text-body-2 text-medium-emphasis">{{ formatDate(partner.created_at) }}</span>
                  </div>
                </td>

                <td
                  class="text-left py-3"
                  style="max-width: 250px;"
                >
                  <span
                    class="text-body-2 text-grey-darken-3 text-truncate"
                    :title="partner.email"
                  >{{ partner.email
                  }}</span>
                </td>

                <td class="text-left py-3">
                  <span class="text-body-2 text-grey-darken-3">{{ partner.phone }}</span>
                </td>

                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center gap-1">
                    <!-- Botón Principal: Ver Detalle -->
                    <VBtn
                      class="action-btn"
                      variant="tonal"
                      size="small"
                      color="primary"
                      icon="ri-eye-line"
                      title="Ver Detalle del Socio"
                      @click="showItem(partner)"
                    />

                    <!-- Menú Pro de Acciones Secundarias -->
                    <VMenu
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
                        min-width="180"
                      >
                        <VListItem @click="editPartner(partner)">
                          <template #prepend>
                            <VIcon
                              icon="ri-pencil-line"
                              color="warning"
                              size="18"
                              class="me-2"
                            />
                          </template>
                          <VListItemTitle class="font-weight-medium text-body-2">
                            Editar Socio
                          </VListItemTitle>
                        </VListItem>

                        <VDivider class="my-1" />

                        <VListItem
                          class="text-error"
                          @click="deletePartner(partner)"
                        >
                          <template #prepend>
                            <VIcon
                              icon="ri-delete-bin-6-line"
                              color="error"
                              size="18"
                              class="me-2"
                            />
                          </template>
                          <VListItemTitle class="font-weight-medium text-body-2 text-error">
                            Eliminar Socio
                          </VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
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
          <VPagination
            v-model="currentPage"
            :length="totalPage"
            rounded="circle"
            :total-visible="7"
            color="primary"
            @update:model-value="list"
          />
        </div>
      </VCardActions>
    </VCard>

    <!-- DIALOG -->
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
