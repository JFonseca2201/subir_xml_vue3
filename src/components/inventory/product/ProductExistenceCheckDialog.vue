<script setup>
import { ref, watch, computed } from 'vue'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  initialQuery: {
    type: String,
    default: '',
  },
  searchField: {
    type: String,
    default: 'all', // 'all', 'sku', 'description'
  },
})

const emit = defineEmits(['update:modelValue', 'select-product', 'use-data'])

const router = useRouter()

const show = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
})

const searchQuery = ref('')
const activeFilter = ref('all') // 'all', 'sku', 'description'
const loading = ref(false)
const searched = ref(false)
const results = ref([])
const hasExactSkuMatch = ref(false)
const hasExactNameMatch = ref(false)

const filterOptions = [
  { title: 'Todo el Catálogo', value: 'all', icon: 'ri-search-line' },
  { title: 'Por SKU', value: 'sku', icon: 'ri-barcode-line' },
  { title: 'Por Nombre / Descripción', value: 'description', icon: 'ri-price-tag-3-line' },
]

const performSearch = async () => {
  const query = searchQuery.value?.trim()
  if (!query) {
    results.value = []
    searched.value = false
    hasExactSkuMatch.value = false
    hasExactNameMatch.value = false
    return
  }

  loading.value = true
  searched.value = true
  hasExactSkuMatch.value = false
  hasExactNameMatch.value = false

  try {
    let params = {}
    if (activeFilter.value === 'sku') {
      params = { sku: query }
    } else if (activeFilter.value === 'description') {
      params = { description: query }
    } else {
      params = { q: query }
    }

    const queryString = new URLSearchParams(params).toString()
    const response = await $api(`products/search?${queryString}`, { method: 'GET' })

    const list = Array.isArray(response) ? response : (response.data || response.products || [])
    results.value = list

    // Check for exact matches
    const lowerQuery = query.toLowerCase()
    hasExactSkuMatch.value = list.some(p => p.sku && p.sku.toLowerCase() === lowerQuery)
    hasExactNameMatch.value = list.some(p => p.description && p.description.toLowerCase() === lowerQuery)
  } catch (error) {
    console.error('Error al verificar existencia de producto:', error)
    results.value = []
  } finally {
    loading.value = false
  }
}

const handleUseData = product => {
  emit('use-data', product)
  show.value = false
}

const navigateToEdit = id => {
  show.value = false
  router.push(`/product/edit/${id}`)
}

const formatCurrency = val => {
  const num = parseFloat(val) || 0
  return `$${num.toFixed(2)}`
}

let debounceTimeout = null

watch(searchQuery, newVal => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    if (newVal && newVal.trim()) {
      performSearch()
    } else {
      results.value = []
      searched.value = false
    }
  }, 250)
})

watch(
  () => [props.modelValue, props.initialQuery, props.searchField],
  ([newVal, query, field]) => {
    if (newVal) {
      searchQuery.value = query || ''
      activeFilter.value = field || 'all'
      if (searchQuery.value.trim()) {
        performSearch()
      } else {
        results.value = []
        searched.value = false
      }
    }
  },
  { immediate: true },
)

watch(activeFilter, () => {
  if (searchQuery.value.trim()) {
    performSearch()
  }
})
</script>

<template>
  <VDialog
    v-model="show"
    max-width="880"
    scrollable
    transition="dialog-bottom-transition"
  >
    <VCard class="product-lookup-card rounded-xl elevation-24 bg-white">
      <!-- Encabezado Limpio -->
      <VCardTitle class="bg-primary text-white py-3 px-5 d-flex align-center justify-space-between flex-none">
        <div class="d-flex align-center gap-3">
          <VIcon
            icon="ri-search-eye-line"
            size="22"
            color="white"
          />
          <div>
            <div class="text-subtitle-1 font-weight-bold text-white leading-tight">
              Coincidencias en Catálogo
            </div>
            <div
              class="text-caption text-white opacity-80"
              style="font-size: 11px;"
            >
              Comprueba los productos existentes antes de registrar
            </div>
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          color="white"
          size="small"
          @click="show = false"
        />
      </VCardTitle>

      <VCardText
        class="pa-4 bg-white overflow-y-auto"
        style="background-color: #ffffff !important;"
      >
        <!-- Barra de Búsqueda y Pestañas Simplificadas -->
        <div class="mb-4">
          <VTextField
            v-model="searchQuery"
            placeholder="Buscar por SKU o Nombre..."
            variant="outlined"
            density="compact"
            prepend-inner-icon="ri-search-2-line"
            clearable
            autofocus
            hide-details
            class="bg-white rounded-lg mb-2"
            :loading="loading"
            @keydown.enter.prevent="performSearch"
            @click:clear="results = []; searched = false"
          />

          <!-- Pestañas de Filtro -->
          <VTabs
            v-model="activeFilter"
            color="primary"
            density="compact"
            class="border-b"
          >
            <VTab
              value="all"
              class="text-none font-weight-medium text-caption"
            >
              <VIcon
                icon="ri-search-line"
                size="15"
                class="me-1"
              />
              Todo
            </VTab>
            <VTab
              value="sku"
              class="text-none font-weight-medium text-caption"
            >
              <VIcon
                icon="ri-barcode-line"
                size="15"
                class="me-1"
              />
              Por SKU
            </VTab>
            <VTab
              value="description"
              class="text-none font-weight-medium text-caption"
            >
              <VIcon
                icon="ri-price-tag-3-line"
                size="15"
                class="me-1"
              />
              Por Nombre
            </VTab>
          </VTabs>
        </div>

        <!-- Skeleton loader -->
        <div
          v-if="loading && results.length === 0"
          class="d-flex flex-column gap-2 py-4"
        >
          <VSkeletonLoader
            v-for="n in 3"
            :key="n"
            type="list-item-two-line"
            class="rounded-lg border"
          />
        </div>

        <!-- Estado Inicial -->
        <div
          v-else-if="!searched"
          class="text-center py-8 px-4"
        >
          <VIcon
            icon="ri-file-search-line"
            size="40"
            color="secondary"
            class="mb-2 opacity-60"
          />
          <div class="text-caption text-medium-emphasis">
            Escribe un código o nombre para buscar coincidencias.
          </div>
        </div>

        <!-- Resultados de la búsqueda -->
        <div v-else>
          <!-- Si NO existen coincidencias -->
          <div
            v-if="results.length === 0"
            class="text-center py-6 px-4 bg-light-success rounded-lg border border-success"
            style="background-color: #f0fdf4 !important;"
          >
            <VIcon
              icon="ri-checkbox-circle-line"
              color="success"
              size="28"
              class="mb-1"
            />
            <div class="text-subtitle-2 font-weight-bold text-success">
              Código libre
            </div>
            <div class="text-caption text-medium-emphasis">
              No existe ningún producto con el término "{{ searchQuery }}".
            </div>
          </div>

          <!-- Si SÍ existen coincidencias -->
          <div v-else>
            <div class="d-flex align-center justify-space-between mb-3 px-1">
              <span class="text-caption font-weight-bold text-medium-emphasis">
                {{ results.length }} producto(s) encontrado(s):
              </span>
            </div>

            <!-- Lista de Productos Coincidentes (Diseño Limpio) -->
            <div class="products-result-list d-flex flex-column gap-3">
            <div v-for="item in results" :key="item.id" class="product-lookup-item" :class="{
              'product-lookup-item--matched-sku': item.sku && searchQuery.trim().toLowerCase() === item.sku.toLowerCase(),
            }">
              <div class="d-flex align-start justify-space-between flex-wrap gap-3">
                <div class="d-flex align-start gap-3 flex-grow-1">
                  <!-- Thumbnail o Icono -->
                  <VAvatar rounded="lg" size="44" color="primary" variant="tonal" class="border flex-shrink-0">
                    <VImg v-if="item.imagen" :src="item.imagen" cover />
                    <VIcon v-else icon="ri-box-3-line" size="22" color="primary" />
                  </VAvatar>

                  <!-- Información del producto -->
                  <div class="flex-grow-1">
                    <!-- Nombre del Producto -->
                    <h4 class="text-body-1 font-weight-bold text-high-emphasis mb-1">
                      {{ item.description }}
                    </h4>

                    <!-- Fila 1: SKU, Código Auxiliar, Marca, Estado -->
                    <div class="d-flex align-center flex-wrap gap-x-3 gap-y-1 text-caption text-medium-emphasis mb-1">
                      <span>
                        SKU: <span class="product-lookup-sku-badge">{{ item.sku }}</span>
                      </span>
                      <span v-if="item.code_aux">
                        • Aux: <strong class="text-high-emphasis font-mono">{{ item.code_aux }}</strong>
                      </span>
                      <span v-if="item.brand">
                        • Marca: <strong>{{ item.brand }}</strong>
                      </span>
                      <span>
                        • Estado: <span :class="item.state == 1 ? 'text-success font-weight-medium' : 'text-error'">{{
                          item.state == 1 ? 'Activo' : 'Inactivo' }}</span>
                      </span>
                    </div>

                    <!-- Fila 2: Categoría, Almacén, Stock, PVP -->
                    <div class="d-flex align-center flex-wrap gap-x-3 gap-y-1 text-caption text-medium-emphasis">
                      <span v-if="item.categorie?.title">
                        <VIcon icon="ri-folder-line" size="13" class="me-1" />
                        {{ item.categorie.title }}
                      </span>
                      <span v-if="item.warehouse?.name">
                        <VIcon icon="ri-home-4-line" size="13" class="me-1" />
                        {{ item.warehouse.name }}
                      </span>
                      <span>
                        <VIcon icon="ri-stack-line" size="13" class="me-1" />
                        Stock: <strong :class="parseFloat(item.stock) > 0 ? 'text-success' : 'text-error'">{{ item.stock
                        }} {{
                            item.unit?.name || 'UND' }}</strong>
                      </span>
                      <span>
                        <VIcon icon="ri-price-tag-3-line" size="13" class="me-1" />
                        PVP: <strong class="text-primary font-weight-bold">{{ formatCurrency(item.price_sale)
                        }}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Acciones -->
                <div class="d-flex align-center gap-2 flex-shrink-0 align-self-center">
                  <VBtn color="secondary" variant="tonal" size="small" prepend-icon="ri-edit-line"
                    class="rounded-lg font-weight-medium text-none" @click="navigateToEdit(item.id)">
                    Editar
                  </VBtn>

                  <VBtn color="primary" variant="elevated" size="small" prepend-icon="ri-file-copy-line"
                    class="rounded-lg font-weight-bold text-none" @click="handleUseData(item)">
                    Usar Datos
                  </VBtn>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </VCardText>

      <VDivider />

      <VCardActions class="pa-4 bg-surface d-flex justify-end gap-3">
        <VBtn color="secondary" variant="outlined" prepend-icon="ri-close-line"
          class="rounded-lg font-weight-medium text-none" @click="show = false">
          Cerrar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.font-mono {
  font-family: monospace;
}
</style>
