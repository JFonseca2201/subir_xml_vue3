<script setup>
/* eslint-disable camelcase */
import { ref, watch, onMounted, computed } from 'vue'
import defaultCategoryImg from '@images/misc/default_category.png'
import { useLoaderStore } from '@/stores/loader'
import { $api } from '@/utils/api'
import CategorieAddDialog from '@/components/inventory/config/categories/CategorieAddDialog.vue'
import CategorieEditDialog from '@/components/inventory/config/categories/CategorieEditDialog.vue'
import CategorieDeleteDialog from '@/components/inventory/config/categories/CategorieDeleteDialog.vue'

const loader = useLoaderStore()

const isCategorieAddDialogVisible = ref(false)
const isCategorieEditDialogVisible = ref(false)
const isCategorieDeleteDialogVisible = ref(false)
const isCategorieImageDialogVisible = ref(false)

const list_categories = ref([])
const searchQuery = ref(null)
const categorie_selected_edit = ref(null)
const categorie_selected_delete = ref(null)
const categorie_selected_image = ref(null)

const isLoading = ref(false)
const currentPage = ref(1)
const totalPage = ref(1)
const itemsPerPage = 10

// Métricas computadas
const activeCategoriesCount = computed(() => {
  return list_categories.value.filter(c => parseInt(c.state) === 1).length
})

const categoriesWithImageCount = computed(() => {
  return list_categories.value.filter(c => !!c.imagen && c.imagen !== 'null' && !c.imagen.endsWith('/null')).length
})

const hasActiveFilters = computed(() => {
  return !!(searchQuery.value && searchQuery.value.trim())
})

const resetFilters = () => {
  searchQuery.value = null
  currentPage.value = 1
  list()
}

const formatDate = dateStr => {
  if (!dateStr) return 'N/A'
  let d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  const normalized = dateStr.replace(/-/g, '/')
  d = new Date(normalized)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  return 'N/A'
}

const getCategoryIcon = imagen => {
  if (!imagen || typeof imagen !== 'string') return defaultCategoryImg
  const imgStr = imagen.trim().toLowerCase()
  if (
    imgStr === '' ||
    imgStr === 'null' ||
    imgStr === 'undefined' ||
    imgStr.endsWith('/null') ||
    imgStr.endsWith('/undefined') ||
    imgStr.endsWith('/storage/')
  ) {
    return defaultCategoryImg
  }
  return imagen
}

const list = async () => {
  isLoading.value = true
  try {
    const params = {
      page: currentPage.value,
      per_page: itemsPerPage,
      search: searchQuery.value || '',
    }

    const resp = await $api("categories", {
      method: "GET",
      params,
      onResponseError({ response }) {
        console.log(response._data?.error)
      },
    })

    list_categories.value = resp.categories || []

    if (resp.total_pages) {
      totalPage.value = resp.total_pages
    } else if (resp.total) {
      totalPage.value = Math.ceil(resp.total / itemsPerPage)
    } else {
      totalPage.value = 1
    }

    if (resp.current_page) {
      currentPage.value = resp.current_page
    }
  } catch (error) {
    console.log(error)
  } finally {
    isLoading.value = false
  }
}

const addNewCategorie = NewCategorie => {
  list_categories.value.unshift(NewCategorie)
}

const addEditCategorie = editCategorie => {
  const index = list_categories.value.findIndex(categ => categ.id == editCategorie.id)
  if (index !== -1) {
    list_categories.value[index] = editCategorie
  } else {
    list()
  }
}

const addDeleteCategorie = Categorie => {
  const index = list_categories.value.findIndex(categorie => categorie.id == Categorie.id)
  if (index !== -1) {
    list_categories.value.splice(index, 1)
  }
}

const editItem = item => {
  categorie_selected_edit.value = item
  isCategorieEditDialogVisible.value = true
}

const deleteItem = item => {
  categorie_selected_delete.value = item
  isCategorieDeleteDialogVisible.value = true
}

const viewImage = item => {
  categorie_selected_image.value = item
  isCategorieImageDialogVisible.value = true
}

let searchTimeout = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    list()
  }, 400)
})

onMounted(() => {
  list()
})

definePage({ meta: { permission: "settings" } })
</script>

<template>
  <div class="pa-4 pa-sm-6 categories-management-page">
    <!-- Encabezado Principal y Acciones -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-5 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VAvatar size="42" color="primary" variant="tonal" rounded="lg" class="me-3">
            <VIcon icon="ri-price-tag-3-line" size="26" />
          </VAvatar>
          Gestión de Categorías
        </h1>
        <p class="text-medium-emphasis mb-0">
          Familias y clasificaciones oficiales de repuestos y productos del taller
        </p>
      </div>

      <div class="d-flex gap-3 flex-wrap align-self-md-center align-self-end">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          class="elevation-2 font-weight-bold"
          @click="isCategorieAddDialogVisible = true"
        >
          Nueva Categoría
        </VBtn>
      </div>
    </div>

    <!-- Barra de Métricas Rápidas (KPIs) -->
    <VRow class="mb-4" dense>
      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="primary" variant="tonal" rounded="lg">
            <VIcon icon="ri-price-tag-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Total Categorías Registradas</div>
            <div class="text-h6 font-weight-bold text-high-emphasis">
              {{ list_categories.length }} <span class="text-caption text-disabled font-weight-regular">en página</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="success" variant="tonal" rounded="lg">
            <VIcon icon="ri-checkbox-circle-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Categorías Activas</div>
            <div class="text-h6 font-weight-bold text-success">
              {{ activeCategoriesCount }} <span class="text-caption text-disabled font-weight-regular">habilitadas</span>
            </div>
          </div>
        </VCard>
      </VCol>

      <VCol cols="12" sm="4">
        <VCard class="kpi-stat-card elevation-0 border rounded-xl pa-3.5 bg-surface d-flex align-center gap-3">
          <VAvatar size="46" color="warning" variant="tonal" rounded="lg">
            <VIcon icon="ri-image-line" size="24" />
          </VAvatar>
          <div>
            <div class="text-caption text-medium-emphasis font-weight-medium">Con Imagen Ilustrativa</div>
            <div class="text-h6 font-weight-bold text-warning">
              {{ categoriesWithImageCount }} <span class="text-caption text-disabled font-weight-regular">categorías</span>
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
              v-model="searchQuery"
              label="Buscar categoría"
              placeholder="Nombre de categoría..."
              prepend-inner-icon="ri-search-2-line"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              clearable
              color="primary"
              :loading="isLoading"
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
            <td class="py-4" style="width: 80px;"><div class="shimmer-circle" style="width: 36px; height: 36px;" /></td>
            <td class="py-4"><div class="shimmer-line w-75 mb-2" /><div class="shimmer-line w-40" /></td>
            <td class="py-4" style="width: 120px;"><div class="shimmer-chip" /></td>
            <td class="py-4" style="width: 140px;"><div class="shimmer-line w-60" /></td>
            <td class="py-4 text-center" style="width: 120px;"><div class="shimmer-button rounded mx-auto" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <!-- ESTADO VACÍO -->
    <VCard
      v-else-if="!list_categories || list_categories.length === 0"
      class="rounded-xl border elevation-0 pa-10 text-center bg-surface my-4"
    >
      <VAvatar size="76" color="primary" variant="tonal" class="mb-4">
        <VIcon size="38" icon="ri-price-tag-3-line" />
      </VAvatar>
      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">
        No se encontraron categorías
      </h3>
      <p class="text-body-1 text-medium-emphasis mb-5 mx-auto" style="max-width: 480px;">
        Intenta ajustar el término de búsqueda o registra una nueva categoría en el sistema.
      </p>
      <div class="d-flex justify-center gap-3">
        <VBtn v-if="hasActiveFilters" variant="outlined" color="secondary" prepend-icon="ri-filter-off-line" @click="resetFilters">
          Restablecer Filtros
        </VBtn>
        <VBtn color="primary" prepend-icon="ri-add-line" @click="isCategorieAddDialogVisible = true">
          Nueva Categoría
        </VBtn>
      </div>
    </VCard>

    <!-- TABLA DE CATEGORÍAS -->
    <div v-else>
      <VCard class="rounded-xl border overflow-hidden elevation-0 bg-surface">
        <VTable hover class="categories-modern-table overflow-x-auto">
          <thead>
            <tr class="bg-grey-lighten-5">
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 70px;">
                ID
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="min-width: 250px;">
                Categoría
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Estado
              </th>
              <th class="text-left font-weight-bold text-uppercase py-3" style="width: 140px;">
                Fecha Reg.
              </th>
              <th class="text-center font-weight-bold text-uppercase py-3" style="width: 120px;">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list_categories" :key="item.id" class="category-table-row">
              <td class="font-weight-bold text-disabled">
                #{{ item.id }}
              </td>

              <!-- Categoría con Imagen / Avatar -->
              <td class="py-3">
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    rounded="lg"
                    size="40"
                    color="grey-lighten-4"
                    class="cursor-pointer border elevation-0"
                    title="Ver imagen ampliada"
                    @click="viewImage(item)"
                  >
                    <VImg :src="getCategoryIcon(item.imagen)" />
                  </VAvatar>
                  <div>
                    <div class="font-weight-bold text-high-emphasis text-uppercase text-body-1">
                      {{ item.title }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Estado -->
              <td class="text-center">
                <VChip
                  :color="item.state == 1 ? 'success' : 'error'"
                  size="small"
                  variant="tonal"
                  class="font-weight-semibold"
                >
                  <VIcon :icon="item.state == 1 ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'" size="14" class="me-1" />
                  {{ item.state == 1 ? 'ACTIVO' : 'INACTIVO' }}
                </VChip>
              </td>

              <!-- Fecha -->
              <td class="py-3">
                <span class="text-caption text-medium-emphasis">
                  {{ formatDate(item.created_at) }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="text-center">
                <div class="d-flex justify-center align-center gap-1">
                  <VBtn
                    size="small"
                    color="warning"
                    variant="tonal"
                    icon="ri-pencil-line"
                    title="Editar Categoría"
                    @click="editItem(item)"
                  />
                  <VBtn
                    size="small"
                    color="error"
                    variant="tonal"
                    icon="ri-delete-bin-line"
                    title="Eliminar Categoría"
                    @click="deleteItem(item)"
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
            Mostrando <strong class="text-high-emphasis">{{ list_categories.length }}</strong> categorías registradas
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
    <CategorieAddDialog
      v-model:isDialogVisible="isCategorieAddDialogVisible"
      @add-categorie="addNewCategorie"
    />

    <CategorieEditDialog
      v-if="categorie_selected_edit && isCategorieEditDialogVisible"
      v-model:isDialogVisible="isCategorieEditDialogVisible"
      :categorie-selected="categorie_selected_edit"
      @edit-categorie="addEditCategorie"
    />

    <CategorieDeleteDialog
      v-if="categorie_selected_delete && isCategorieDeleteDialogVisible"
      v-model:isDialogVisible="isCategorieDeleteDialogVisible"
      :categorie-selected="categorie_selected_delete"
      @delete-categorie="addDeleteCategorie"
    />

    <!-- Diálogo para ver imagen de categoría -->
    <VDialog
      v-model="isCategorieImageDialogVisible"
      scrollable
      max-width="500px"
    >
      <VCard class="rounded-xl overflow-hidden">
        <VCardTitle class="d-flex align-center justify-space-between pa-4 bg-grey-lighten-5 border-b">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-image-line" color="primary" />
            <span class="font-weight-bold text-subtitle-1">{{ categorie_selected_image?.title || 'Imagen' }}</span>
          </div>
          <VBtn icon="ri-close-line" variant="text" size="small" @click="isCategorieImageDialogVisible = false" />
        </VCardTitle>

        <VCardText class="pa-6 text-center">
          <VImg
            :src="getCategoryIcon(categorie_selected_image?.imagen)"
            max-width="360"
            max-height="280"
            contain
            class="rounded-lg mx-auto border"
          />
        </VCardText>

        <VDivider />

        <VCardActions class="pa-3 px-4 justify-end bg-grey-lighten-5">
          <VBtn color="secondary" variant="tonal" @click="isCategorieImageDialogVisible = false">
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
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

.category-table-row {
  transition: background-color 0.15s ease;
  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.02) !important;
  }
}
</style>
