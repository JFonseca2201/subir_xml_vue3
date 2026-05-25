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

// Cargar categorías
const loadCategories = async () => {
  try {
    const response = await $api('invoices/config')
    if (response.status === 200) {
      categories.value = response.data || response.categories || []
      
      return categories.value // Retornar las categorías
    }
  } catch (error) {
    console.error('Error al cargar categorías:', error)
    
    return []
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
  <VDialog
    v-model="props.isDialogVisible"
    max-width="700"
  >
    <VCard class="invoice-dialog elevation-15 rounded-xl">
      <VCardTitle class="headline text-center text-primary">
        Editar {{ props.invoiceSelected.description }}
      </VCardTitle>

      <VCardText>
        <VRow>
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

      <VCardActions class="justify-center">
        <!-- Botón para cerrar -->
        <VBtn
          color="primary"
          elevation="2"
          class="rounded-lg"
          @click="onFormReset"
        >
          Cerrar
        </VBtn>

        <!-- Botón de acción principal (Editar) -->
        <VBtn
          color="success"
          elevation="2"
          class="rounded-lg"
          :loading="loader.loading"
          @click="editItemInvoice"
          :disabled="loader.loading"
        >
          Editar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
