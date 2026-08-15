<script setup>
import { ref, onMounted } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  invoiceSelected: {
    type: Object,
    required: true,
  },
})


//const emit = defineEmits(["update:isDialogVisible", "editInvoiceItem"]);
const emit = defineEmits(["update:isDialogVisible", "editInvoiceItem"])
const onFormReset = () => emit("update:isDialogVisible", false)


const loader = useLoaderStore()
const { showNotification } = useGlobalToast()
const warning = ref(null)
const success = ref(null)
const error_exits = ref(null)
const item_type = ref(1)
const radioGroup = ref(1)
const categories = ref([])
const selectedCategory = ref(null)
const loadingCategories = ref(false)

// Cargar categorías
const loadCategories = async () => {
  loadingCategories.value = true
  try {
    const response = await $api('invoices/config')
    if (response.status === 200) {
      categories.value = response.data || response.categories || []
      
      return categories.value // Retornar las categorías
    }
  } catch (error) {
    console.error('Error al cargar categorías:', error)
    
    return []
  } finally {
    loadingCategories.value = false
  }
}

// Cargar categorías al montar el componente
onMounted(() => {
  loadCategories().then(() => {
    // Establecer categoría después de cargar las categorías
    if (props.invoiceSelected.product_categorie_id) {
      selectedCategory.value = props.invoiceSelected.product_categorie_id
      console.log('🔍 Categoría establecida:', selectedCategory.value)
      console.log('🔍 Categorías disponibles:', categories.value)
    }
  })
})

const editItemInvoice = async () => {
  warning.value = null
  success.value = null
  loader.start()
  item_type.value = radioGroup.value
  try {

    let data = {
      item_type: item_type.value,
    }

    // Agregar categoría si es un producto
    if (item_type.value === 1 && selectedCategory.value) {
      data.product_categorie_id = selectedCategory.value
    }

    console.log('🔍 Datos a enviar:', data)

    const resp = await $api("invoice-items/" + props.invoiceSelected.id, {
      method: "PUT",
      body: data,
      onResponseError({ response }) {
        error_exits.value = response._data.error
        warning.value = 'No se pudo editar el item.'
      },
    })

    console.log(resp)

    // emit("editInvoiceItem", resp.invoiceItem);
    emit("editInvoiceItem", resp.invoiceItem)
    showNotification('Item editado con éxito', 'success')

    // Cerrar el diálogo después de un breve delay para mostrar el mensaje de éxito
    setTimeout(() => {
      onFormReset()
    }, 1500)
  } catch (error) {
    console.log(error)
    showNotification('Error al editar el item', 'error')
  } finally {
    loader.stop()
  }
}

onMounted(() => {
  setTimeout(() => {
    console.log(props.invoiceSelected)
    radioGroup.value = props.invoiceSelected.item_type

    //item_type.value = props.invoiceSelected.item_type;
  }, 50)
})
</script>

<template>
  <VDialog scrollable
    v-model="props.isDialogVisible"
    max-width="700"
  >
    <VCard class="custom-dialog-card elevation-15 position-relative">
      <VProgressLinear
        v-if="loadingCategories"
        indeterminate
        color="white"
        height="3"
        class="position-absolute"
        style="top: 0; left: 0; right: 0; z-index: 10;"
      />

      <VOverlay
        :model-value="loader.loading"
        class="align-center justify-center"
        contained
        persistent
      >
        <VProgressCircular
          color="primary"
          indeterminate
          size="64"
        />
      </VOverlay>

      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="emit('update:isDialogVisible', false)"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-edit-box-line" />
        </div>
        <h3 class="custom-dialog-title">
          Editar {{ props.invoiceSelected.description }}
        </h3>
        <p class="custom-dialog-subtitle">
          Actualización de categoría y tipo de gasto
        </p>
      </div>

      <VCardText>
        <!-- Skeleton Loader -->
        <div
          v-if="loadingCategories"
          class="d-flex flex-column gap-4 py-4"
        >
          <div
            class="shimmer-line w-60 mb-2"
            style="height: 20px;"
          />
          <div
            class="shimmer-line w-100"
            style="height: 48px; border-radius: 8px;"
          />
          <div
            class="shimmer-line w-100"
            style="height: 48px; border-radius: 8px;"
          />
        </div>

        <VRow v-else>
          <VCol cols="6">
            <!-- Grupo de radio botones -->
            <VRadioGroup
              v-model="radioGroup"
              row
              class="justify-center"
            >
              <!-- Opción Producto -->
              <VRadio
                :key="1"
                label="Producto"
                :value="1"
                class="mr-4"
              />
              <!-- Opción Gasto Común -->
              <VRadio
                :key="2"
                label="Gasto Común"
                :value="2"
                class="mr-4"
              />
              <!-- Opción Mantenimiento o Servicio -->
              <VRadio
                :key="3"
                label="Mantenimiento o Servicio"
                :value="3"
                class="mr-4"
              />
              <!-- Opción Herramienta -->
              <VRadio
                :key="4"
                label="Herramienta"
                :value="4"
                class="mr-4"
              />
            </VRadioGroup>
          </VCol>
          <!-- Contenedor con sombra y bordes redondeados -->

          <VCol cols="6">
            <!-- Selector de Categoría -->
            <VSelect
              v-if="radioGroup === 1"
              v-model="selectedCategory"
              :items="categories"
              item-title="title"
              item-value="id"
              label="Categoría del Producto"
              placeholder="Selecciona una categoría"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="ri-folder-line"
              class="mt-4"
              hide-details="auto"
              :rules="[v => !!v || 'Selecciona una categoría']"
            />
          </VCol>
        </VRow>
        <VCol
          v-if="warning"
          cols="6"
        >
          <VAlert
            type="error"
            color="warning"
            closable
            variant="tonal"
          >
            {{ warning }}
          </VAlert>
        </VCol>
      </VCardText>

      <VCardActions class="pa-4 d-flex justify-end align-center gap-3 bg-white" style="position: sticky; bottom: 0; z-index: 2;">
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="onFormReset"
        >
          Cerrar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-refresh-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loader.loading"
          :disabled="loader.loading"
          @click="editItemInvoice"
        >
          Editar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
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
