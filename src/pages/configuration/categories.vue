<script setup>
/* eslint-disable camelcase */
import defaultCategoryImg from '@images/misc/default_category.png'

const headers = [
  /*     {
          title: 'ID',
          key: 'id',
      }, */
  {
    title: "Categoria",
    key: "name",
  },
  {
    title: "Estado",
    key: "state",
  },
  {
    title: "Fecha de registro",
    key: "created_at",
  },
  {
    title: "Acciones",
    key: "action",
  },
]

const isCategorieAddDialogVisible = ref(false)
const isCategorieEditDialogVisible = ref(false)
const isCategorieDeleteDialogVisible = ref(false)
const isCategorieImageDialogVisible = ref(false)

const list_categories = ref([])
const searchQuery = ref(null)
const categorie_selected_edit = ref(null)
const categorie_selected_delete = ref(null)
const categorie_selected_image = ref(null)

const isLoading = ref(false) // ⬅ loader global para la tabla
const currentPage = ref(1)
const totalPage = ref(1)
const itemsPerPage = 10

const formatDate = dateStr => {
  if (!dateStr) return 'N/A'

  // 1. Intentar parseo nativo directo (para formatos estándar ISO)
  let d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  // 2. Intentar parseo con normalización MySQL/Safari ('2026-05-04 11:44:11' -> '2026/05/04 11:44:11')
  const normalized = dateStr.replace(/-/g, '/')

  d = new Date(normalized)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  // 3. Parseo manual robusto por expresiones regulares
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/)
  if (match) {
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    const day = parseInt(match[3], 10)
    const hour = match[4] ? parseInt(match[4], 10) : 0
    const minute = match[5] ? parseInt(match[5], 10) : 0
    const second = match[6] ? parseInt(match[6], 10) : 0

    d = new Date(year, month, day, hour, minute, second)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' })
    }
  }

  return 'Invalid Date'
}

const getCategoryIcon = imagen => {
  if (!imagen || typeof imagen !== 'string') {
    return defaultCategoryImg
  }
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
  isLoading.value = true // ⬅ activar loader
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
        console.log(response._data.error)
      },
    })

    console.log(resp)
    list_categories.value = resp.categories || []

    // Manejar diferentes estructuras de respuesta de paginación
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
    isLoading.value = false // ocultar overlay
  }
}

const addNewCategorie = NewCategorie => {
  console.log(NewCategorie)
  let backup = list_categories.value
  list_categories.value = []
  backup.unshift(NewCategorie)
  setTimeout(() => {
    list_categories.value = backup
  }, 50)
}

const addEditCategorie = editCategorie => {
  console.log(editCategorie)
  let backup = list_categories.value
  list_categories.value = []
  let INDEX = backup.findIndex(categ => categ.id == editCategorie.id)
  if (INDEX != -1) {
    backup[INDEX] = editCategorie
  }
  setTimeout(() => {
    list_categories.value = backup
  }, 50)
}

const addDeleteCategorie = Categorie => {
  console.log(Categorie)
  let backup = list_categories.value
  list_categories.value = []
  let INDEX = backup.findIndex(categorie => categorie.id == Categorie.id)
  if (INDEX != -1) {
    backup.splice(INDEX, 1)
  }
  setTimeout(() => {
    list_categories.value = backup
  }, 50)
}

const editItem = item => {
  console.log(item)
  isCategorieEditDialogVisible.value = true
  categorie_selected_edit.value = item
}

const deleteItem = item => {
  isCategorieDeleteDialogVisible.value = true
  categorie_selected_delete.value = item
}

const viewImage = item => {
  categorie_selected_image.value = item
  isCategorieImageDialogVisible.value = true
}

const refresh = () => {
  console.log('clearImmediate')
  searchQuery.value = null
  list()
}

// Búsqueda en tiempo real (debounce)
let searchTimeout = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    list()
  }, 500)
})

onMounted(() => {
  list()
})

definePage({ meta: { permission: "settings" } })
</script>

<template>
  <div class="pa-4 pa-sm-6 categories-management-page">
    <!-- Encabezado de la página -->
    <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center mb-6 gap-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1 d-flex align-center">
          <VIcon icon="ri-price-tag-3-line" color="primary" class="me-2" size="28" />
          Categorías
        </h1>
        <p class="text-medium-emphasis mb-0">
          Administración de categorías de productos
        </p>
      </div>
      <div class="d-flex gap-2 flex-wrap align-self-md-center align-self-end">
        <VBtn color="primary" prepend-icon="ri-add-line"
          @click="isCategorieAddDialogVisible = !isCategorieAddDialogVisible">
          Nueva Categoría
        </VBtn>
      </div>
    </div>

    <!-- Contenedor Principal (Filtros y Tabla) -->
    <VCard class="rounded-lg border-light border overflow-hidden elevation-0">
      <!-- Filtros y Búsqueda -->
      <VCardText class="pa-5 bg-grey-lighten-5 border-bottom-light">
        <VRow class="align-center">
          <VCol cols="12">
            <VTextField v-model="searchQuery" label="Buscar categoría" placeholder="Nombre de categoría..."
              prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable" hide-details="auto" clearable
              color="primary" />
          </VCol>
        </VRow>
      </VCardText>

      <!-- Tabla de Categorías -->
      <div class="position-relative">
        <VProgressLinear v-if="isLoading" indeterminate color="primary" height="3" class="position-absolute"
          style="top: 0; left: 0; right: 0; z-index: 10;" />
        <div class="overflow-x-auto">
          <VTable hover class="categories-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase" style="min-width: 250px;">
                  CATEGORÍA
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 120px;">
                  ESTADO
                </th>
                <th class="text-left font-weight-bold text-uppercase" style="width: 150px;">
                  FECHA REG.
                </th>
                <th class="text-center font-weight-bold text-uppercase" style="width: 90px;">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody v-if="isLoading">
              <tr>
                <td colspan="4" class="text-center pa-6">
                  <VProgressCircular indeterminate color="primary" size="40" />
                  <div class="mt-2 text-medium-emphasis">
                    Cargando registros...
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="!list_categories || list_categories.length === 0">
              <tr>
                <td colspan="4" class="text-center pa-8 text-medium-emphasis">
                  <VIcon size="48" class="mb-3" color="grey-lighten-1">
                    ri-folder-line
                  </VIcon>
                  <div class="text-h6">
                    No hay categorías registradas
                  </div>
                  <div class="text-body-2">
                    Intenta ajustar los filtros de búsqueda
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="item in list_categories" :key="item.id" class="categories-row align-middle">
                <td class="text-left py-3">
                  <div class="d-flex align-center">
                    <VAvatar size="32" class="cursor-pointer" @click="viewImage(item)">
                      <VImg :src="getCategoryIcon(item.imagen)">
                        <template #error>
                          <VImg :src="defaultCategoryImg" />
                        </template>
                      </VImg>
                    </VAvatar>
                    <div class="d-flex flex-column ms-3">
                      <span class="font-weight-semibold text-body-1 text-grey-darken-4">
                        {{ item.title }}
                      </span>
                    </div>
                  </div>
                </td>
                <td class="text-left py-3">
                  <VChip v-if="item.state == 1" size="small" color="success" variant="tonal">
                    Activo
                  </VChip>
                  <VChip v-if="item.state == 2" size="small" color="error" variant="tonal">
                    Inactivo
                  </VChip>
                </td>
                <td class="text-no-wrap text-left py-3">
                  <div class="d-flex align-center">
                    <VIcon icon="ri-calendar-line" size="14" class="me-1 text-grey" />
                    <span class="text-body-2 text-medium-emphasis">
                      {{ formatDate(item.created_at) }}
                    </span>
                  </div>
                </td>
                <td class="text-no-wrap text-center py-3">
                  <div class="d-flex justify-center align-center">
                    <VBtn class="action-btn" variant="text" icon size="small" color="primary" title="Editar"
                      @click="editItem(item)">
                      <VIcon icon="ri-pencil-line" size="20" />
                    </VBtn>
                    <VBtn class="action-btn" variant="text" icon size="small" color="error" title="Eliminar"
                      @click="deleteItem(item)">
                      <VIcon icon="ri-delete-bin-line" size="20" />
                    </VBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>

      <VDivider />

      <VCardActions class="justify-center pa-5 bg-grey-lighten-5">
        <div class="d-flex flex-column align-center gap-3 w-100">
          <div class="text-caption text-grey-darken-1">
            Mostrando <span class="font-weight-bold">{{ list_categories.length }}</span> registros
          </div>
          <VPagination v-model="currentPage" :length="totalPage" rounded="circle" :total-visible="7" color="primary"
            @update:model-value="list" />
        </div>
      </VCardActions>
    </VCard>

    <!-- DIALOGS -->
    <CategorieAddDialog v-model:isDialogVisible="isCategorieAddDialogVisible" @add-categorie="addNewCategorie" />

    <CategorieEditDialog v-if="categorie_selected_edit && isCategorieEditDialogVisible"
      v-model:isDialogVisible="isCategorieEditDialogVisible" :categorie-selected="categorie_selected_edit"
      @edit-categorie="addEditCategorie" />

    <CategorieDeleteDialog v-if="categorie_selected_delete && isCategorieDeleteDialogVisible"
      v-model:isDialogVisible="isCategorieDeleteDialogVisible" :categorie-selected="categorie_selected_delete"
      @delete-categorie="addDeleteCategorie" />

    <!-- Diálogo para ver imagen de categoría -->
    <VDialog v-model="isCategorieImageDialogVisible" max-width="600px">
      <VCard>
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-image-line" color="primary" />
            <span>Imagen de Categoría</span>
          </div>
          <VBtn icon variant="text" @click="isCategorieImageDialogVisible = false">
            <VIcon icon="ri-close-line" />
          </VBtn>
        </VCardTitle>

        <VDivider />

        <VCardText class="pa-4">
          <div class="text-center">
            <div class="mb-4">
              <h4 class="text-h6 font-weight-bold">
                {{ categorie_selected_image?.title || 'Sin nombre' }}
              </h4>
            </div>

            <div class="d-flex justify-center">
              <VImg :src="getCategoryIcon(categorie_selected_image?.imagen)" max-width="400" max-height="300" contain
                class="rounded-lg elevation-4">
                <template #error>
                  <VImg :src="defaultCategoryImg" max-width="400" max-height="300" contain />
                </template>
              </VImg>
            </div>
          </div>
        </VCardText>

        <VDivider />

        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn color="primary" variant="elevated" @click="isCategorieImageDialogVisible = false">
            Cerrar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
