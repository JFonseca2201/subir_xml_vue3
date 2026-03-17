<script setup>
import { ref, onMounted } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const invoiceSelected = ref(null);
const currentPage = ref(1);
const totalPage = ref(0);
const perPage = ref(10);
const totalItems = ref(0);

const { showNotification } = useGlobalToast();

const list_invoices = ref([])
const supplier_id = ref(null)
const from_date = ref(null)
const to_date = ref(null)
const range_date = ref(null);
const search = ref(null);
const type = ref(1);


const isLoading = ref(false);

const isInvoiceAddDialogVisible = ref(false);
const isInvoiceShowDialogVisible = ref(false);

const list = async () => {
    isLoading.value = true;

    try {
        let data = {
            type: type.value,
            search: search.value || '',
            start_date: range_date.value ? range_date.value.split("to")[0] : "",
            end_date: range_date.value ? range_date.value.split("to")[1] : "",
            supplier_id: supplier_id.value || null,
            per_page: 10, // Items por página
        };

        console.log('📋 Datos de búsqueda:', data);

        const resp = await $api("invoices/index?page=" + currentPage.value, {
            method: "POST",
            body: data,
            onResponseError({ response }) {
                showNotification('Error al cargar las facturas', 'error');
            },
        });

        console.log('📊 Respuesta del servidor:', resp);

        // Actualizar datos según el response del backend
        list_invoices.value = resp.invoices.data;  // Acceder al array data dentro de invoices
        totalPage.value = resp.total_pages;
        totalItems.value = resp.total;
        perPage.value = resp.per_page;

        // Validar página actual
        if (currentPage.value > totalPage.value && totalPage.value > 0) {
            currentPage.value = 1;
            list(); // Recargar con la primera página
        }

        showNotification('Facturas cargadas correctamente', 'success')
    } catch (error) {
        console.error('❌ Error al cargar facturas:', error)
        showNotification('Error al cargar las facturas', 'error')
    } finally {
        isLoading.value = false;
    }
}
const providers = ref([]);

const config = async () => {
    try {
        const resp = await $api("invoices/config", {
            method: "GET",
            onResponseError({ response }) {
                console.log(response._data.error);
            },
        });
        console.log(resp);
        providers.value = resp.suppliers;
    } catch (error) {
        console.log(error);
    }
};

const showItem = (ShowInvoice) => {
    console.log(ShowInvoice);
    isInvoiceShowDialogVisible.value = true;
    invoiceSelected.value = ShowInvoice;
}

const processInvoice = async (invoice) => {
    try {
        isLoading.value = true;

        const response = await $api('products/process', {
            method: 'POST',
            body: {
                invoice: invoice.id
            },
            onResponseError({ response }) {
                console.log('❌ Error 422 - Response:', response._data);
                console.log('❌ Error 422 - Datos enviados:', { invoice: invoice.id });
                showNotification('Error al procesar la factura', 'error');
            }
        });

        if (response.status === 200) {
            showNotification('Factura procesada correctamente', 'success');
            // Actualizar la factura en la lista
            const index = list_invoices.value.findIndex(item => item.id === invoice.id);
            if (index !== -1) {
                list_invoices.value[index].invoice_process = 1;
            }
        }
    } catch (error) {
        console.error('Error al procesar factura:', error);
        showNotification('Error al procesar la factura', 'error');
    } finally {
        isLoading.value = false;
    }
}


const deleteInvoice = (DeleteInvoice) => {
    console.log(DeleteInvoice);
}

const addInvoice = (newInvoice) => {
    console.log('Agregando nueva factura:', newInvoice);

    // Agregar la nueva factura al inicio de la lista
    list_invoices.value.unshift(newInvoice);

    // Mostrar notificación de éxito
    showNotification('Factura agregada correctamente a la tabla', 'success');
}

watch([search, supplier_id, from_date, to_date], () => {
    currentPage.value = 1
})

// Método de refresco para reiniciar todos los filtros
const refresh = () => {
    search.value = null;
    supplier_id.value = null;
    from_date.value = null;
    to_date.value = null;
    range_date.value = null;
    currentPage.value = 1;
    list();
}

const truncate = (text, length = 50) => {
    if (!text) return ''
    return text.length > length
        ? text.slice(0, length) + '…'
        : text
}

onMounted(() => {
    config();
    list();
})
</script>

<template>
    <div class="pa-6">

        <!-- 🔄 Overlay global -->
        <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
            <VProgressCircular indeterminate size="56" width="5" color="primary" />
        </VOverlay>

        <!-- 🏛️ CARD MAESTRA -->
        <VCard class="elevation-4 rounded-xl">

            <!-- 🧠 HEADER -->
            <VCardText>
                <VRow class="align-center justify-space-between">
                    <VCol cols="12" md="8">
                        <div class="d-flex align-center gap-3">
                            <VIcon size="40" color="primary">ri-file-list-3-line</VIcon>
                            <div>
                                <h2 class="text-h4 font-weight-bold mb-1">
                                    Gestión de Facturas
                                </h2>
                                <span class="text-medium-emphasis">
                                    Administración y control de facturación
                                </span>
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="4" class="d-flex justify-end align-center">
                        <VBtn color="primary" size="large" elevation="5"
                            @click="isInvoiceAddDialogVisible = !isInvoiceAddDialogVisible">
                            <VIcon start>ri-add-circle-line</VIcon>
                            Nueva
                        </VBtn>
                    </VCol>
                </VRow>
            </VCardText>

            <VDivider />

            <!-- 🔍 FILTROS Y BOTÓN FILTRAR -->
            <VCardText>

                <div class="d-flex align-center gap-2 mb-4">
                    <VIcon color="primary">ri-filter-3-line</VIcon>
                    <span class="text-h6 font-weight-bold">
                        Filtros de búsqueda
                    </span>
                </div>


                <!-- Filtros de búsqueda alineados con el botón Filtrar -->
                <VRow dense>
                    <VCol cols="12" md="8">
                        <VRow>

                            <VCol cols="12" md="4">
                                <VTextField v-model="search" @keyup.enter="list" label="Buscar factura"
                                    variant="outlined" density="comfortable" clearable
                                    prepend-inner-icon="ri-search-line" />
                            </VCol>

                            <VCol cols="12" md="4">
                                <VAutocomplete v-model="supplier_id" label="Proveedores" placeholder="Proveedores"
                                    :items="providers" item-title="name" item-value="id" clearable="" />
                            </VCol>


                            <VCol cols="12" md="4">
                                <AppDateTimePicker v-model="range_date" label="Rango de fecha"
                                    placeholder="Seleccionar un rango de fechas" :config="{ mode: 'range' }" />
                            </VCol>
                        </VRow>

                    </VCol>
                    <VCol cols="12" md="4">
                        <VRow>
                            <!-- Botón Filtrar alineado con los filtros -->
                            <VCol cols="12" md="12" class="d-flex align-end justify-end gap-4">
                                <VBtn color="primary" size="large" rounded="" @click="list" variant="tonal">
                                    <VIcon start>ri-search-line</VIcon>
                                    Buscar
                                </VBtn>
                                <VBtn color="secondary" size="large" rounded="" @click="refresh" variant="tonal">
                                    <VIcon start>ri-refresh-line</VIcon>
                                    Refrescar
                                </VBtn>
                            </VCol>
                        </VRow>
                    </VCol>
                </VRow>
            </VCardText>

            <VDivider />

            <!-- 📋 TABLA -->
            <VCardText class="pa-0">
                <VTable hover class="text-no-wrap">
                    <thead class="bg-primary text-white">
                        <tr>
                            <th>#</th>
                            <th>Proveedor</th>
                            <th>Factura</th>
                            <th>Fecha</th>
                            <th>Subtotal</th>
                            <th>IVA (15%)</th>
                            <th>Total</th>
                            <th class="text-center">Estado</th>
                            <th class="text-center">Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-if="isLoading">
                            <td colspan="9" class="text-center pa-4">
                                <VProgressCircular indeterminate color="primary" />
                            </td>
                        </tr>
                        <tr v-else-if="!list_invoices.length">
                            <td colspan="9" class="text-center text-medium-emphasis py-6">
                                <VIcon size="32" class="mb-2">ri-inbox-line</VIcon>
                                <div>No hay facturas registradas</div>
                            </td>
                        </tr>
                        <tr v-else v-for="invoice in list_invoices" :key="invoice.id"
                            class="hover:bg-grey-lighten-4 transition">
                            <td class="font-weight-medium">{{ invoice.id }}</td>
                            <td>{{ invoice.supplier?.name ? truncate(invoice.supplier.name, 50) : '-' }}</td>
                            <td>{{ invoice.invoice_number || '-' }}</td>
                            <td>{{ invoice.issue_date ? new Date(invoice.issue_date).toISOString().slice(0, 10) : '-' }}
                            </td>
                            <td>${{ Number(invoice.subtotal || 0).toFixed(2) }}</td>
                            <td>${{ Number(invoice.tax || 0).toFixed(2) }}</td>
                            <td class="font-weight-bold text-success">
                                ${{ Number(invoice.total || 0).toFixed(2) }}
                            </td>

                            <td class="text-center">
                                <!-- Debug temporal -->

                                <VChip :color="invoice.invoice_process === 1 ? 'success' : 'warning'" variant="tonal"
                                    size="small">
                                    {{ invoice.invoice_process === 1 ? 'Procesada' : 'Pendiente' }}
                                </VChip>
                            </td>

                            <td class="text-center">
                                <div class="d-flex justify-center gap-1">
                                    <IconBtn @click="showItem(invoice)">
                                        <VIcon icon="ri-eye-line" />
                                    </IconBtn>

                                    <IconBtn v-if="!invoice.invoice_process || invoice.invoice_process === 2"
                                        @click="processInvoice(invoice)" color="primary" title="Procesar Factura">
                                        <VIcon icon="ri-check-line" />
                                    </IconBtn>
                                    <!-- <IconBtn @click="editInvoice(invoice)">
                                        <VIcon icon="ri-pencil-line" />
                                    </IconBtn> -->
                                    <IconBtn @click="deleteInvoice(invoice)">
                                        <VIcon icon="ri-delete-bin-6-line" color="error" />
                                    </IconBtn>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </VTable>
            </VCardText>

            <VDivider />

            <!-- 📄 PAGINACIÓN -->
            <VCardActions class="justify-center pa-4">
                <div class="d-flex flex-column align-center gap-2">
                    <div class="text-caption text-medium-emphasis">
                        Mostrando {{ list_invoices.length }} de {{ totalItems }} facturas
                    </div>
                    <VPagination v-model="currentPage" :length="totalPage" rounded="circle" :total-visible="7"
                        @update:modelValue="list" />
                </div>
            </VCardActions>
        </VCard>

        <!-- DIALOG -->
        <InvoiceAddDialog v-model:isDialogVisible="isInvoiceAddDialogVisible" @addInvoice="addInvoice" />
        <InvoiceShowDialog v-if="isInvoiceShowDialogVisible" v-model:isDialogVisible="isInvoiceShowDialogVisible"
            :invoiceSelected="invoiceSelected" />
    </div>
</template>
