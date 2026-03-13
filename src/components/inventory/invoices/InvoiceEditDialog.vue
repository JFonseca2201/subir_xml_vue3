<script setup>
import { useLoaderStore } from '@/stores/loader'
const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
    invoiceSelected: {
        type: Object,
        required: true,
    }
})


//const emit = defineEmits(["update:isDialogVisible", "editInvoiceItem"]);
const emit = defineEmits(["update:isDialogVisible", "editInvoiceItem"]);
const onFormReset = () => emit("update:isDialogVisible", false);


const loader = useLoaderStore()
const warning = ref(null);
const success = ref(null);
const error_exits = ref(null);
const item_type = ref(1);
const radioGroup = ref(1);
const categories = ref([]);
const selectedCategory = ref(null);

// Notificaciones
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

// Cargar categorías
const loadCategories = async () => {
    try {
        const response = await $api('invoices/config');
        if (response.status === 200) {
            categories.value = response.data || response.categories || [];
            return categories.value; // Retornar las categorías
        }
    } catch (error) {
        console.error('Error al cargar categorías:', error);
        return [];
    }
}

// Cargar categorías al montar el componente
onMounted(() => {
    loadCategories().then(() => {
        // Establecer categoría después de cargar las categorías
        if (props.invoiceSelected.categorie_id) {
            selectedCategory.value = props.invoiceSelected.categorie_id;
            console.log('🔍 Categoría establecida:', selectedCategory.value);
            console.log('🔍 Categorías disponibles:', categories.value);
        }
    });
});

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

const editItemInvoice = async () => {
    warning.value = null;
    success.value = null;
    loader.start();
    item_type.value = radioGroup.value;
    try {

        let data = {
            item_type: item_type.value,
        }

        // Agregar categoría si es un producto
        if (item_type.value === 1 && selectedCategory.value) {
            data.categorie_id = selectedCategory.value;
        }

        console.log('🔍 Datos a enviar:', data);

        const resp = await $api("invoices/" + props.invoiceSelected.id, {
            method: "PUT",
            body: data,
            onResponseError({ response }) {
                error_exits.value = response._data.error;
                warning.value = 'No se pudo editar el item.';
            },
        });
        console.log(resp);
        // emit("editInvoiceItem", resp.invoiceItem);
        emit("editInvoiceItem", resp.invoiceItem);
        showNotification('Item editado con éxito', 'success');

        // Cerrar el diálogo después de un breve delay para mostrar el mensaje de éxito
        setTimeout(() => {
            onFormReset();
        }, 1500);
    } catch (error) {
        console.log(error);
        showNotification('Error al editar el item', 'error');
    } finally {
        loader.stop();
    }
}

onMounted(() => {
    setTimeout(() => {
        console.log(props.invoiceSelected);
        radioGroup.value = props.invoiceSelected.item_type;
        //item_type.value = props.invoiceSelected.item_type;
    }, 50);
})

</script>

<template>
    <v-dialog v-model="props.isDialogVisible" max-width="700">
        <v-card class="elevation-15 rounded-xl">
            <v-card-title class="headline text-center text-primary">
                Editar {{ props.invoiceSelected.description }}
            </v-card-title>

            <v-card-text>
                <v-row>
                    <v-col cols="6">

                        <!-- Grupo de radio botones -->
                        <v-radio-group v-model="radioGroup" row class="justify-center">
                            <!-- Opción Producto -->
                            <v-radio :key="1" label="Producto" :value="1" class="mr-4" />
                            <!-- Opción Gasto Común -->
                            <v-radio :key="2" label="Gasto Común" :value="2" class="mr-4" />
                            <!-- Opción Mantenimiento o Servicio -->
                            <v-radio :key="3" label="Mantenimiento o Servicio" :value="3" class="mr-4" />
                            <!-- Opción Herramienta -->
                            <v-radio :key="4" label="Herramienta" :value="4" class="mr-4" />
                        </v-radio-group>
                    </v-col>
                    <!-- Contenedor con sombra y bordes redondeados -->

                    <v-col cols="6">
                        <!-- Selector de Categoría -->
                        <v-select v-if="radioGroup === 1" v-model="selectedCategory" :items="categories"
                            item-title="title" item-value="id" label="Categoría del Producto"
                            placeholder="Selecciona una categoría" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-folder-line" class="mt-4" hide-details="auto"
                            :rules="[v => !!v || 'Selecciona una categoría']" />

                    </v-col>
                </v-row>
                <v-col cols="6" v-if="warning">
                    <v-alert type="error" color="warning" closable variant="tonal">{{ warning }}</v-alert>
                </v-col>
            </v-card-text>

            <v-card-actions class="justify-center">
                <!-- Botón para cerrar -->
                <v-btn @click="onFormReset" color="primary" elevation="2" class="rounded-lg">
                    Cerrar
                </v-btn>

                <!-- Botón de acción principal (Editar) -->
                <v-btn @click="editItemInvoice" color="success" elevation="2" class="rounded-lg"
                    :loading="loader.loading" :disabled="loader.loading">
                    Editar
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>

<style scoped>
/* Mejorar la interacción de los radio buttons */
.v-radio-group .v-radio {
    transition: all 0.3s ease;
}

.v-radio-group .v-radio:hover {
    transform: scale(1.05);
    /* Efecto de animación al pasar el mouse */
}

/* Estilos para los botones con bordes redondeados y sombras */
.v-btn {
    font-weight: bold;
    padding: 10px 20px;
    border-radius: 12px;
}

/* Mejora de los títulos y textos dentro de la tarjeta */
.v-card-title {
    font-weight: 600;
    font-size: 20px;
}

/* Estilo para el contenedor con la tarjeta */
.v-card {
    background-color: #ffffff;
    border-radius: 16px;
}

/* Sombra suave y borde redondeado de la tarjeta */
.v-card.elevation-12 {
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

/* Botones con transición de color */
.v-btn:hover {
    transition: background-color 0.3s ease;
}
</style>
