<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'

let selectedFile = null
const success = ref(null)
const error_exist = ref(null)
const currentPage = ref(1);
const totalPage = ref(0);

const list_invoices = ref([])
const supplier_id = ref(null)
const from_date = ref(null)
const to_date = ref(null)
const range_date = ref(null);
const search = ref(null);
const type = ref(1);

const isLoading = ref(false);

const isInvoiceAddDialogVisible = ref(false);


const list = async () => {
    isLoading.value = true;
    error_exist.value = null
    success.value = null

    try {
        let data = {
            type: type.value,
            search: search.value || '',
            start_date: range_date.value ? range_date.value.split('to')[0] : null,
            end_date: range_date.value ? range_date.value.split('to')[1] : null,
            supplier_id: supplier_id.value || null,
        }
        console.log(data);

        const resp = await $api("invoices/index?page=" + currentPage.value + "&search=" + (search.value ? search.value : ""), {
            method: "POST",
            body: data,
            onResponseError({ response }) {
                console.log(response._data.error);
            },
        });
        console.log(resp);
        list_invoices.value = resp.invoices.data;
        totalPage.value = resp.total_page;
        if (currentPage.value > totalPage.value && totalPage.value > 0) {
            currentPage.value = 1;
        }
        success.value = 'Facturas cargadas correctamente'
    } catch (error) {
        console.error(error)
        error_exist.value = 'Error al cargar las facturas'
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
}

const editInvoice = (EditInvoice) => {
    console.log(EditInvoice);

}
const deleteInvoice = (DeleteInvoice) => {
    console.log(DeleteInvoice);
}

const addInvoice = (newInvoice) => {
    console.log(newInvoice);

    let backup = list_invoices.value;
    list_invoices.value = [];
    backup.unshift(newInvoice);
    setTimeout(() => {
        list_invoices.value = backup;
    }, 50);
}

watch([search, supplier_id, from_date, to_date], () => {
    currentPage.value = 1
})
onMounted(() => {
    config();
    list();

})
</script>

<template>
    <div class="pa-6">
        <!-- Overlay global -->
        <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
            <VProgressCircular indeterminate size="48" width="4" color="primary" />
        </VOverlay>

        <!-- 🏷️ Encabezado principal con botón Agregar -->
        <VRow class="align-center justify-space-between mb-6">
            <VCol cols="12" md="6">
                <h2 class="text-h4 font-weight-bold mb-0">📄 Gestión de Facturas</h2>
            </VCol>
            <VCol cols="12" md="6" class="text-right">
                <VBtn color="success" rounded class="ma-0"
                    @click="isInvoiceAddDialogVisible = !isInvoiceAddDialogVisible">
                    <VIcon left>ri-add-line</VIcon>
                    Agregar Factura
                </VBtn>
            </VCol>
        </VRow>

        <!-- 🔍 FILTROS -->
        <VCard class="mb-6 elevation-2 rounded-lg">
            <VCardTitle class="text-h6 font-weight-bold">Filtros de facturas</VCardTitle>
            <VCardText>
                <VRow class="align-center" dense>
                    <VCol cols="12" md="3">
                        <VTextField v-model="search" @keyup.enter="list" label="Buscar factura" outlined dense clearable
                            prepend-inner-icon="ri-search-line" />
                    </VCol>
                    <VCol cols="12" md="3">
                        <VSelect v-model="supplier_id" :items="providers" item-title="name" item-value="id"
                            label="Proveedor" outlined dense clearable prepend-inner-icon="ri-store-line" />
                    </VCol>
                    <VCol cols="12" md="2">
                        <VTextField v-model="from_date" type="date" label="Desde" outlined dense clearable
                            prepend-inner-icon="ri-calendar-line" />
                    </VCol>
                    <VCol cols="12" md="2">
                        <VTextField v-model="to_date" type="date" label="Hasta" outlined dense clearable
                            prepend-inner-icon="ri-calendar-line" />
                    </VCol>
                    <VCol cols="12" md="2" class="d-flex justify-end gap-2 flex-wrap">
                        <VBtn color="primary" class="" @click="list" rounded>
                            <VIcon left>ri-search-line</VIcon>
                            Buscar
                        </VBtn>
                    </VCol>
                </VRow>
            </VCardText>
        </VCard>

        <!-- 📋 LISTADO -->
        <VCard class="elevation-2 rounded-lg">
            <VCardTitle class="text-h6 font-weight-bold">Facturas registradas</VCardTitle>
            <VCardText class="pa-0">
                <VTable striped hover dense>
                    <thead class="bg-primary text-white">
                        <tr>
                            <th>#</th>
                            <th>Proveedor</th>
                            <th>N° Factura</th>
                            <th>Fecha</th>
                            <th>Subtotal</th>
                            <th>IVA (15%)</th>
                            <th>Total</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- <pre>{{ list_invoices }}</pre> -->
                        <tr v-for="invoice in list_invoices" :key="invoice" class="hover:bg-gray-50 transition-colors">
                            <td>{{ invoice.id }}</td>
                            <td>{{ invoice.supplier.name }}</td>
                            <td>{{ invoice.invoice_number }}</td>
                            <td>{{ new Date(invoice.issue_date).toISOString().slice(0, 10) }}</td>
                            <td>${{ Number(invoice.subtotal).toFixed(2) }}</td>
                            <td>${{ Number(invoice.tax).toFixed(2) }}</td>
                            <td>${{ Number(invoice.total).toFixed(2) }}</td>

                            <td>
                                <div class="d-flex gap-1">
                                    <IconBtn size="small" @click="showItem(invoice)">
                                        <VIcon icon="ri-eye-line" />
                                    </IconBtn>
                                    <IconBtn size="small" @click="editInvoice(invoice)">
                                        <VIcon icon="ri-pencil-line" />
                                    </IconBtn>
                                    <IconBtn size="small" @click="deleteInvoice(invoice)">
                                        <VIcon icon="ri-delete-bin-line" />
                                    </IconBtn>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="!list_invoices.length">
                            <td colspan="8" class="text-center text-subtitle1">
                                No hay registros
                            </td>
                        </tr>
                    </tbody>
                </VTable>
            </VCardText>

            <!-- 📄 PAGINACIÓN -->
            <VPagination v-model="currentPage" :length="totalPage" rounded="circle" @update:modelValue="list" />
        </VCard>
        <InvoiceAddDialog v-model:isDialogVisible="isInvoiceAddDialogVisible" @addInvoice="addInvoice" />

    </div>
</template>
<!-- @addRole="addNewRole"  -->