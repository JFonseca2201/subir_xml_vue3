<script setup>
import { ref, computed } from 'vue';

const isLoading = ref(false);
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

const emit = defineEmits(['update:isDialogVisible']);

const invoice = ref({});
const searchProduct = ref(''); // Variable para el filtro de búsqueda de productos

// Método para obtener los datos de la factura
const showItems = async () => {
    isLoading.value = true;
    try {
        const resp = await $api('invoices/' + props.invoiceSelected.id, {
            method: 'GET',
            onResponseError({ response }) {
                console.log(response);
            }
        });
        console.log(resp);
        invoice.value = resp.data;
    } catch (error) {
        console.log(error);
    } finally {
        isLoading.value = false;
    }
}

// Computed para filtrar los productos
const filteredItems = computed(() => {
    return invoice.value?.invoice_items?.filter(item => {
        const searchTerm = searchProduct.value.toLowerCase();
        return item.code.toLowerCase().includes(searchTerm) || item.description.toLowerCase().includes(searchTerm);
    }) || [];
});

// Mostrar el dialogo
const dialogVisible = computed({
    get: () => props.isDialogVisible,
    set: val => emit('update:isDialogVisible', val),
})

const onFormReset = () => {
    searchProduct.value = ''; // Limpiar el filtro al cerrar el formulario
    dialogVisible.value = false;
}

// Truncar texto
const truncate = (text, length = 50) => {
    if (!text) return '';
    return text.length > length ? text.slice(0, length) + '…' : text;
}

onMounted(() => {
    setTimeout(() => {
        showItems();
    }, 50);
})
</script>

<template>
    <VDialog v-model="dialogVisible" max-width="1200" transition="dialog-bottom-transition">
        <VCard class="rounded-xl" style="text-transform: uppercase;">
            <!-- 🔄 Overlay global -->
            <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
                <VProgressCircular indeterminate size="56" width="5" color="primary" />
            </VOverlay>

            <!-- 🧾 CABECERA -->
            <div class="invoice-header" style="position: sticky; top: 0; z-index: 10; background: white;">
                <!-- 🔷 FILA SUPERIOR: TÍTULO + ACCIÓN -->
                <VCardText class="pb-2">
                    <VRow align="center" justify="space-between">
                        <VCol cols="12" md="8">
                            <div class="d-flex align-center gap-4">
                                <VAvatar color="primary" variant="tonal" size="48">
                                    <VIcon size="26">ri-receipt-3-line</VIcon>
                                </VAvatar>

                                <div>
                                    <h3 class="text-h5 font-weight-bold mb-1">
                                        Detalle de Factura
                                    </h3>
                                    <span class="text-medium-emphasis">
                                        Vista completa de la factura registrada
                                    </span>
                                </div>
                            </div>
                        </VCol>

                        <VCol cols="12" md="4" class="d-flex justify-end">
                            <VBtn icon variant="text" color="grey" @click="onFormReset">
                                <VIcon size="22">ri-close-line</VIcon>
                            </VBtn>
                        </VCol>
                    </VRow>
                </VCardText>

                <VDivider />

                <!-- 🔷 FILA INFERIOR: INFO DE FACTURA -->
                <VCardText class="pt-4 pb-3">
                    <VRow>
                        <!-- 🏪 Proveedor -->
                        <VCol cols="12" md="4">
                            <div class="d-flex align-center gap-2 mb-1">
                                <VIcon size="18" class="text-primary">
                                    ri-store-2-line
                                </VIcon>
                                <span class="font-weight-medium">
                                    Proveedor
                                </span>
                            </div>
                            <div class="text-medium-emphasis">
                                {{ invoice?.supplier?.name || '-' }}
                            </div>
                        </VCol>

                        <!-- 📄 Número de factura -->
                        <VCol cols="12" md="4">
                            <div class="d-flex align-center gap-2 mb-1">
                                <VIcon size="18" class="text-primary">
                                    ri-file-text-line
                                </VIcon>
                                <span class="font-weight-medium">
                                    N° Factura
                                </span>
                            </div>
                            <div class="text-medium-emphasis">
                                {{ invoice?.invoice_number || '-' }}
                            </div>
                        </VCol>

                        <!-- 📅 Fecha -->
                        <VCol cols="12" md="4">
                            <div class="d-flex align-center gap-2 mb-1">
                                <VIcon size="18" class="text-primary">
                                    ri-calendar-line
                                </VIcon>
                                <span class="font-weight-medium">
                                    Fecha
                                </span>
                            </div>
                            <div class="text-medium-emphasis">
                                {{
                                    invoice?.issue_date
                                        ? new Date(invoice.issue_date)
                                            .toISOString()
                                            .slice(0, 10)
                                        : '-'
                                }}
                            </div>
                        </VCol>
                    </VRow>
                </VCardText>

                <VDivider />
                <VRow class="mb-4 my-2" style="position: sticky; ">
                    <VCol cols="12" md="4" class="ml-4">
                        <VTextField v-model="searchProduct" label="Buscar producto" variant="outlined" clearable
                            prepend-inner-icon="ri-search-line" />
                    </VCol>
                </VRow>
            </div>

            <!-- 📦 PRODUCTOS -->
            <VCardText class="pa-0 mt-1">
                <!-- Filtro de búsqueda -->


                <VTable hover class="invoice-table">
                    <!-- 🧾 CABECERA -->
                    <thead class="bg-primary text-white sticky-header">
                        <tr>
                            <th style="width: 50px">#</th>
                            <th style="width: 50px">Código</th>
                            <th>
                                <VIcon size="16" class="mr-1">ri-box-3-line</VIcon>
                                Producto
                            </th>
                            <th class="text-right">
                                <VIcon size="16" class="mr-1">ri-stack-line</VIcon>
                                Cant.
                            </th>
                            <th class="text-right">
                                <VIcon size="16" class="mr-1">ri-money-dollar-circle-line</VIcon>
                                Precio
                            </th>
                            <th class="text-right">
                                <VIcon size="16" class="mr-1">ri-calculator-line</VIcon>
                                Subtotal
                            </th>
                            <th class="text-right">
                                <VIcon size="16" class="mr-1">ri-percent-line</VIcon>
                                Dcto.
                            </th>
                            <th class="text-right">
                                <VIcon size="16" class="mr-1">ri-money-dollar-circle-line</VIcon>
                                Total
                            </th>
                        </tr>
                    </thead>

                    <!-- 📦 CUERPO -->
                    <tbody>
                        <tr v-for="(item, index) in filteredItems" :key="item.id">
                            <td><small>{{ index + 1 }}</small></td>
                            <td class="font-weight-medium">
                                <VTooltip location="top" open-on-hover>
                                    <template #activator="{ props: tooltipProps }">
                                        <small class="text-medium-emphasis" v-bind="tooltipProps">
                                            {{ truncate(item.code, 20) }}
                                        </small>
                                    </template>
                                    <span>{{ item.code }}</span> <!-- hora: HH:MM:SS -->
                                </VTooltip>

                            </td>
                            <td class=" text-medium-emphasis">
                                <small>{{ (item.description) }}</small>
                            </td>

                            <td class="text-right">
                                <small>{{ item.quantity }}</small>
                            </td>

                            <td class="text-right">
                                <small>${{ Number(item.unit_price).toFixed(2) }}</small>
                            </td>

                            <td class="text-right font-weight-bold">
                                <small>${{ Number(item.quantity * item.unit_price).toFixed(2) }}</small>
                            </td>

                            <td class="text-right text-error">
                                <small>${{ Number(item.discount).toFixed(2) }}</small>
                            </td>

                            <td class="text-right font-weight-bold text-primary">
                                <small>${{ Number((item.quantity * item.unit_price) - Number(item.discount)).toFixed(2)
                                }}</small>
                            </td>
                        </tr>

                        <tr v-if="!invoice?.invoice_items?.length">
                            <td colspan="7" class="text-center text-medium-emphasis py-8">
                                <VIcon size="28" class="mb-2">ri-inbox-line</VIcon>
                                <div>Esta factura no tiene productos registrados</div>
                            </td>
                        </tr>
                    </tbody>
                </VTable>
            </VCardText>

            <VDivider />

            <!-- 🔢 TOTALES -->
            <VCardText class="pt-6">
                <VRow justify="end">
                    <VCol cols="12" md="4">
                        <div class="d-flex justify-space-between mb-2">
                            <span class="text-medium-emphasis">
                                Total
                            </span>
                            <span class="font-weight-medium">
                                ${{ Number(Number(invoice.subtotal) + Number(invoice.discount)).toFixed(2) }}
                            </span>
                        </div>
                        <div class="d-flex justify-space-between mb-2">
                            <span class="text-medium-emphasis">
                                Descuento
                            </span>
                            <span class="font-weight-medium">
                                ${{ Number(invoice.discount).toFixed(2) }}
                            </span>
                        </div>
                        <div class="d-flex justify-space-between mb-2">
                            <span class="text-medium-emphasis">
                                Subtotal
                            </span>
                            <span class="font-weight-medium">
                                ${{ Number(invoice.subtotal).toFixed(2) }}
                            </span>
                        </div>
                        <div class="d-flex justify-space-between mb-2">
                            <span class="text-medium-emphasis">
                                IVA (15%)
                            </span>
                            <span class="font-weight-medium">
                                ${{ Number(invoice.tax).toFixed(2) }}
                            </span>
                        </div>

                        <VDivider class="my-2" />

                        <div class="d-flex justify-space-between text-h6">
                            <span class="font-weight-bold">
                                Total Final
                            </span>
                            <span class="font-weight-bold text-primary">
                                ${{ Number(invoice.total).toFixed(2) }}
                            </span>
                        </div>
                    </VCol>
                </VRow>
            </VCardText>

            <VDivider />

            <!-- 🔘 FOOTER -->
            <VCardActions class="justify-end pa-4">
                <VBtn color="primary" variant="tonal" prepend-icon="ri-close-circle-line" @click="onFormReset">
                    Cerrar
                </VBtn>
            </VCardActions>

        </VCard>
    </VDialog>
</template>
