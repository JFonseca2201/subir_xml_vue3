<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'
import { XMLParser } from "fast-xml-parser";  // Importar el parser

// Definir el estado reactivo para almacenar los datos XML
const xmlData = ref(null);
const error_exist = ref("");  // Para mostrar errores si es necesario


const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (file) {

        console.log("Archivo seleccionado:", file.name);
        console.log("Tipo de archivo:", file.type);


        if (file.type === "application/xml" || file.type === "text/xml" || file.name.endsWith(".xml")) {
            const reader = new FileReader();


            reader.onload = function (e) {
                const xmlString = e.target.result;


                console.log("Contenido del XML:", xmlString);


                const parser = new XMLParser();
                const result = parser.parse(xmlString);
                console.log("Datos parseados del XML:", result);
                if (result.autorizacion && result.autorizacion.comprobante) {
                    const innerXmlString = result.autorizacion.comprobante.replace("<![CDATA[", "").replace("]]>", "");
                    const innerParser = new XMLParser();
                    const innerResult = innerParser.parse(innerXmlString);

                    if (innerResult.factura) {
                        xmlData.value = innerResult.factura;
                        error_exist.value = "";
                    } else {
                        error_exist.value = "Error al parsear XML interno. No se encontró la factura.";
                    }
                } else {
                    error_exist.value = "Error al parsear XML. No se encontró el nodo de 'comprobante'.";
                }
            };

            // Leer el archivo como texto
            reader.readAsText(file);
        } else {
            error_exist.value = "Por favor, selecciona un archivo XML válido.";
        }
    } else {
        error_exist.value = "No se ha seleccionado ningún archivo.";
    }
};

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
})

const emit = defineEmits([
    'update:isDialogVisible',
    'addInvoice'
]);

// Radios con iconos (tipo string para compatibilidad)
const radioContent = [
    { title: 'Productos', value: '1', icon: 'ri-rocket-line' },
    { title: 'Gastos', value: '2', icon: 'ri-user-line' },
    { title: 'Serv./Mant.', value: '3', icon: 'ri-vip-crown-line' },
    { title: 'Herramienta', value: '4', icon: 'ri-tools-line' },
];
const selectedRadio = ref('1') // siempre string para el componente

// Loader
const loader = useLoaderStore()

// Archivos y alertas
let selectedFile = null
const success = ref(null)
const msg = ref(null)

// Notificaciones
const notificationShow = ref(false);
const notificationMessage = ref('');
const notificationType = ref('success');

const showNotification = (message, type = 'success') => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationShow.value = true;
};

// Función helper para obtener los detalles de forma segura
const getDetallesArray = () => {
    if (!xmlData.value || !xmlData.value.detalles) return []

    // Manejar diferentes estructuras posibles
    if (Array.isArray(xmlData.value.detalles.detalle)) {
        return xmlData.value.detalles.detalle
    } else if (xmlData.value.detalles.detalle && typeof xmlData.value.detalles.detalle === 'object') {
        return [xmlData.value.detalles.detalle]
    } else if (Array.isArray(xmlData.value.detalles)) {
        return xmlData.value.detalles
    }

    return []
}

// Selección de archivo
const onFileSelected = (event) => {
    selectedFile = event.target.files[0];
    handleFileUpload(event);
}

// Enviar XML al backend
const storeXml = async () => {
    error_exist.value = null
    success.value = null

    if (!selectedFile) {
        error_exist.value = "Selecciona un archivo XML primero"
        return
    }

    try {
        loader.start()
        const formData = new FormData()
        formData.append('xml', selectedFile)
        formData.append('item_type', (selectedRadio.value))

        const resp = await $api('invoices/import-xml', {
            method: 'POST',
            body: formData,
            onResponseError({ response }) {
                const data = response._data || {}
                msg.value = data.message || 'Error al importar XML'
                if (response.status === 409) {
                    error_exist.value = data.message || 'La factura ya ha sido importada'
                    return
                }
                error_exist.value = data.message || 'Error al importar XML'
            }
        })

        // Mensaje de éxito
        const successMessage = resp?._data?.message || resp?.message || 'Factura importada correctamente'
        showNotification(successMessage, 'success');
        console.log(resp);

        // Refrescar formulario y emitir nueva factura
        onFormReset()
        emit('addInvoice', resp.data)

    } catch (error) {
        console.error(error)
        showNotification(msg.value || 'Error al importar XML', 'error');
    } finally {
        loader.stop()
    }
}

// Reset del modal
const onFormReset = () => {
    error_exist.value = null
    success.value = null
    selectedFile = null
    xmlData.value = null  // Limpiar los datos de previsualización
    emit('update:isDialogVisible', false)
}

// Cerrar modal
const dialogVisibleUpdate = val => {
    emit('update:isDialogVisible', val)
}

onMounted(() => {
    error_exist.value = null
    success.value = null
})
</script>

<template>
    <VDialog v-model="props.isDialogVisible" max-width="800" persistent transition="dialog-bottom-transition">
        <VCard class="rounded-xl">

            <!-- Header -->
            <VCardTitle class="d-flex align-center justify-space-between">
                <div class="d-flex align-center gap-2">
                    <VIcon size="22" color="primary">ri-file-upload-line</VIcon>
                    <span class="text-h6 font-weight-bold">Importar factura XML</span>
                </div>
                <VBtn icon variant="text" @click="emit('update:isDialogVisible', false)">
                    <VIcon>ri-close-line</VIcon>
                </VBtn>
            </VCardTitle>

            <VDivider />

            <!-- Contenido -->
            <VCardText class="pt-6 d-flex flex-column gap-4">

                <!-- Selector de XML -->
                <VFileInput accept=".xml" label="Seleccionar archivo XML" variant="outlined" clearable
                    prepend-inner-icon="ri-file-xml-line" @change="onFileSelected" />

                <!-- Radios con iconos compactos -->
                <CustomRadiosWithIcon v-model:selected-radio="selectedRadio" :radio-content="radioContent"
                    :grid-column="{ sm: '3', cols: '12' }" class="square-radio" />

                <!-- Alertas -->
                <div class="d-flex flex-column gap-2">
                    <VAlert v-if="error_exist" type="error" variant="tonal" closable dense>
                        {{ error_exist }}
                    </VAlert>
                </div>

                <!-- Mostrar información del XML cargado solo si xmlData está disponible -->
                <div v-if="xmlData && xmlData.infoTributaria" class="mt-4">
                    <VCard class="rounded-xl" variant="elevated">
                        <VCardTitle class="d-flex align-center gap-2 pa-4 rounded-t-xl">
                            <VIcon size="24">ri-file-text-line</VIcon>
                            <span class="text-h5 font-weight-bold">Detalles de la Factura</span>
                        </VCardTitle>
                        <VDivider />
                        <VCardText class="pa-4">
                            <!-- 📋 Información principal -->
                            <div class="mb-4">
                                <div class="d-flex align-center gap-2 mb-3">
                                    <VIcon size="20" color="primary">ri-building-line</VIcon>
                                    <span class="text-body-1 font-weight-medium">Proveedor:</span>
                                    {{ xmlData.infoTributaria?.razonSocial || 'N/A' }}
                                </div>
                                <div class="d-flex align-center gap-2 mb-3">
                                    <VIcon size="20" color="success">ri-hashtag</VIcon>
                                    <span class="text-body-1 font-weight-medium">Número de Factura:</span>
                                    <!-- {{ xmlData.infoTributaria?.secuencial || 'N/A' }} -->
                                    {{ (String(xmlData.infoTributaria?.secuencial || '0')).padStart(9, '0') }}


                                </div>
                                <div class="d-flex align-center gap-2">
                                    <VIcon size="20" color="info">ri-calendar-line</VIcon>
                                    <span class="text-body-1 font-weight-medium">Fecha de Emisión:</span>
                                    {{ xmlData.infoFactura?.fechaEmision || 'N/A' }}
                                </div>
                            </div>

                            <!-- Tabla de productos con resumen financiero como tfoot -->
                            <div>
                                <div class="d-flex align-center gap-2 mb-3">
                                    <VIcon size="20" color="warning">ri-shopping-cart-line</VIcon>
                                    <span class="text-h6 font-weight-bold">Productos</span>
                                    <VChip color="warning" variant="tonal" size="small">
                                        {{ getDetallesArray()?.length || 0 }} items
                                    </VChip>
                                </div>

                                <VTable class="elevation-2 rounded-lg">
                                    <thead class="bg-grey-lighten-4">
                                        <tr>
                                            <th class="text-left">
                                                <VIcon size="16" color="primary" class="mr-1">ri-price-tag-3-line
                                                </VIcon>
                                                Descripción
                                            </th>
                                            <th class="text-center">
                                                <VIcon size="16" color="success" class="mr-1">ri-stack-line</VIcon>
                                                Cantidad
                                            </th>
                                            <th class="text-right">
                                                <VIcon size="16" color="info" class="mr-1">ri-money-dollar-circle-line
                                                </VIcon>
                                                Precio Unitario
                                            </th>
                                            <th class="text-right">
                                                <VIcon size="16" color="warning" class="mr-1">ri-wallet-line</VIcon>
                                                Total Sin Impuesto
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(item, index) in getDetallesArray()" :key="index"
                                            class="hover:bg-grey-lighten-3">
                                            <td class="font-weight-medium">
                                                <div class="d-flex align-center gap-2">
                                                    <VIcon size="16" color="primary">ri-price-tag-3-line</VIcon>
                                                    {{ item.descripcion || 'Sin descripción' }}
                                                </div>
                                            </td>
                                            <td class="text-center">
                                                <VChip color="success" variant="tonal" size="small">
                                                    {{ parseFloat(item.cantidad || 0).toFixed(2) }}
                                                </VChip>
                                            </td>
                                            <td class="text-right font-weight-medium">
                                                ${{ parseFloat(item.precioUnitario || 0).toFixed(2) }}
                                            </td>
                                            <td class="text-right font-weight-medium text-warning">
                                                ${{ parseFloat(item.precioTotalSinImpuesto || 0).toFixed(2) }}
                                            </td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colspan="4" class="pa-0">
                                                <VCard class="elevation-1 mt-4">
                                                    <VCardText class="pa-4">
                                                        <div class="d-flex justify-end">
                                                            <div style="width: 300px;">
                                                                <div class="d-flex align-center gap-2 mb-3">
                                                                    <VIcon size="20" color="success">ri-calculator-line
                                                                    </VIcon>
                                                                    <span class="text-h6 font-weight-bold">Resumen
                                                                        Financiero</span>
                                                                </div>

                                                                <div class="d-flex flex-column gap-2">
                                                                    <!-- Subtotal (totalSinImpuestos + descuento) -->
                                                                    <div
                                                                        class="d-flex justify-space-between align-center py-2 border-bottom">
                                                                        <div class="d-flex align-center gap-2">
                                                                            <VIcon size="16" color="info">
                                                                                ri-subtract-line</VIcon>
                                                                            <span
                                                                                class="text-body-2 font-weight-medium">Subtotal:</span>
                                                                        </div>
                                                                        <span
                                                                            class="text-body-2 font-weight-bold text-info">
                                                                            ${{
                                                                                (parseFloat(xmlData.infoFactura?.totalSinImpuestos
                                                                                    || 0) +
                                                                                    parseFloat(xmlData.infoFactura?.totalDescuento
                                                                                        || 0)).toFixed(2) }}
                                                                        </span>
                                                                    </div>

                                                                    <!-- Descuento -->
                                                                    <div
                                                                        class="d-flex justify-space-between align-center py-2 border-bottom">
                                                                        <div class="d-flex align-center gap-2">
                                                                            <VIcon size="16" color="error">
                                                                                ri-percent-line</VIcon>
                                                                            <span
                                                                                class="text-body-2 font-weight-medium">Descuento:</span>
                                                                        </div>
                                                                        <span
                                                                            class="text-body-2 font-weight-bold text-error">
                                                                            -${{
                                                                                parseFloat(xmlData.infoFactura?.totalDescuento
                                                                                    || 0).toFixed(2) }}
                                                                        </span>
                                                                    </div>

                                                                    <!-- IVA -->
                                                                    <div
                                                                        class="d-flex justify-space-between align-center py-2 border-bottom">
                                                                        <div class="d-flex align-center gap-2">
                                                                            <VIcon size="16" color="warning">
                                                                                ri-funds-line</VIcon>
                                                                            <span
                                                                                class="text-body-2 font-weight-medium">IVA
                                                                                (15%):</span>
                                                                        </div>
                                                                        <span
                                                                            class="text-body-2 font-weight-bold text-warning">
                                                                            ${{
                                                                                parseFloat(xmlData.infoFactura?.totalConImpuestos?.totalImpuesto?.valor
                                                                                    || 0).toFixed(2) }}
                                                                        </span>
                                                                    </div>

                                                                    <!-- Total -->
                                                                    <div
                                                                        class="d-flex justify-space-between align-center pt-3">
                                                                        <div class="d-flex align-center gap-2">
                                                                            <VIcon size="18" color="success">
                                                                                ri-money-dollar-circle-line</VIcon>
                                                                            <span
                                                                                class="text-h6 font-weight-bold">TOTAL:</span>
                                                                        </div>
                                                                        <span
                                                                            class="text-h5 font-weight-bold text-success">
                                                                            ${{
                                                                                parseFloat(xmlData.infoFactura?.importeTotal
                                                                                    || 0).toFixed(2) }}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </VCardText>
                                                </VCard>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </VTable>
                            </div>
                        </VCardText>
                    </VCard>
                </div>

            </VCardText>

            <!-- 🎯 Footer -->
            <VCardActions class="justify-end px-6 pb-4 gap-3">
                <VBtn variant="tonal" color="primary" @click="storeXml" :loading="loader.loading">
                    <VIcon left>ri-upload-cloud-2-line</VIcon> &nbsp; Importar XML
                </VBtn>

                <VBtn variant="tonal" color="error" @click="onFormReset">
                    <VIcon left>ri-close-circle-line</VIcon> &nbsp; Cancelar
                </VBtn>
            </VCardActions>

        </VCard>
    </VDialog>

    <!-- Notificación Toast -->
    <NotificationToast v-model:show="notificationShow" :message="notificationMessage" :type="notificationType" />
</template>

<style scoped>
/* 🔹 Botones de radios cuadrados y compactos */
.square-radio button {
    padding: 0 !important;
    font-size: 0.6rem !important;
    width: 36px !important;
    height: 36px !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: unset !important;
    line-height: 1 !important;
}

.square-radio .icon-class {
    width: 16px !important;
    height: 16px !important;
    margin-bottom: 1px;
}

.square-radio {
    gap: 2px;
}
</style>
