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

const editItemInvoice = async () => {
    warning.value = null;
    success.value = null;
    loader.start();
    item_type.value = radioGroup.value;
    try {

        let data = {
            item_type: item_type.value,
        }
        /* const resp = await $api(`invoices/${props.carSelected.id}`, { */
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
        success.value = "Item editado con éxito.";
    } catch (error) {
        console.log(error);

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
                <!-- Contenedor con sombra y bordes redondeados -->

                <!-- Grupo de radio botones -->
                <v-radio-group v-model="radioGroup" row class="justify-center">
                    <!-- Opción Producto -->
                    <v-radio :key="1" :label="'Producto'" :value="1" class="mr-4"
                        :style="{ fontSize: '16px', fontWeight: '500' }" color="deep-purple accent-4" dense />
                    <!-- Opción Gasto Común -->
                    <v-radio :key="2" :label="'Gasto Común'" :value="2" class="mr-4"
                        :style="{ fontSize: '16px', fontWeight: '500' }" color="teal darken-2" dense />
                    <!-- Opción Mantenimiento o Servicio -->
                    <v-radio :key="3" :label="'Mantenimiento o Servicio'" :value="3" class="mr-4"
                        :style="{ fontSize: '16px', fontWeight: '500' }" color="blue-grey darken-3" dense />
                    <v-radio :key="4" :label="'Herramienta'" :value="4" class="mr-4"
                        :style="{ fontSize: '16px', fontWeight: '500' }" color="blue-grey darken-3" dense />
                </v-radio-group>
                <VCol cols="12" v-if="success">
                    <VAlert type="success" color="success" closable="" variant="tonal">{{ success }}</VAlert>
                </VCol>
                <VCol cols="12" v-if="warning">
                    <VAlert type="error" color="warning" closable="" variant="tonal">{{ warning }}</VAlert>
                </VCol>

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
