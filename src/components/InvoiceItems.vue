<script setup>
/* import { ref, onMounted } from 'vue'
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

const current_page = ref(1)
const pagination = ref({})

const onFileSelected = (event) => {
    selectedFile = event.target.files[0]
}


const storeXml = async () => {
    error_exist.value = null
    success.value = null

    if (!selectedFile) {
        error_exist.value = "Selecciona un archivo XML primero"
        return
    }

    try {
        const formData = new FormData()
        formData.append('xml', selectedFile)

        const resp = await $api('invoices/import-xml', {
            method: 'POST',
            body: formData,
            onResponseError({ response }) {
                console.log(response)
                error_exist.value = response._data?.message || 'Error al importar XML'
            }
        })

        console.log(resp)
        success.value = resp.message || 'Factura importada correctamente'

        // Refrescar listado luego de subir XML
        list()
    } catch (error) {
        console.error(error)
        error_exist.value = 'Error al importar XML'
    } finally {
        console.log("Finaliza tarea")
    }
}

const list = async () => {
    error_exist.value = null
    success.value = null

    try {
        let data = {
            type: type.value,
            search: search.value,
            start_date: range_date.value ? range_date.value.split("to")[0] : "",
            end_date: range_date.value ? range_date.value.split("to")[1] : "",
            supplier_id: supplier_id.value
        }
        console.log(data);

        const resp = await $api("invoices/index?page=" + currentPage.value, {
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

onMounted(() => {
    config();
    list();

}) */
</script>

<template>
    <div class="pa-4">


        <!--  <VCard class="mb-4">
            <VCardTitle>Importar factura XML</VCardTitle>
            <VCardText>
                <VFileInput accept=".xml" label="Ingresar archivo XML" @change="onFileSelected" />
                <VBtn class="mt-3" color="primary" @click="storeXml">
                    Enviar XML
                </VBtn>
            </VCardText>
        </VCard>

        
        <VAlert v-if="error_exist" type="error" variant="tonal" closable class="mb-3">
            {{ error_exist }}
        </VAlert>
        <VAlert v-if="success" type="success" variant="tonal" closable class="mb-3">
            {{ success }}
        </VAlert>

        
        <VCard class="mb-4">
            <VCardTitle>Filtros</VCardTitle>
            <VCardText>
                <VRow>
                    <VCol cols="12" md="3">
                        <VTextField v-model="search" @keyup.enter="list" label="Buscar factura" />
                    </VCol>
                    <VCol cols="12" md="3">
                        <VTextField v-model="from_date" type="date" label="Desde" />
                    </VCol>
                    <VCol cols="12" md="3">
                        <VTextField v-model="to_date" type="date" label="Hasta" />
                    </VCol>
                    <VCol cols="12" md="3">
                        <VSelect v-model="supplier_id" :items="providers" item-title="name" item-value="id"
                            label="Proveedor" clearable />
                    </VCol>
                </VRow>
                <VBtn color="primary" class="mt-3" @click="list">
                    Buscar
                </VBtn>
            </VCardText>
        </VCard>

        
        <VCard>
            <VCardTitle>Facturas</VCardTitle>
            <VTable>
                <thead>
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
                    <tr v-for="invoice in list_invoices" :key="invoice.id">
                        <td>{{ invoice.id }}</td>
                        <td>{{ invoice.supplier.name }}</td>
                        <td>{{ invoice.invoice_number }}</td>
                        <td>{{ invoice.issue_date }}</td>
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
                        <td colspan="5" class="text-center">No hay registros</td>
                    </tr>
                </tbody>
            </VTable>

            
            <VCardActions class="justify-center">
                <VPagination v-model="current_page" :length="pagination.last_page" @update:modelValue="list" />
            </VCardActions>
        </VCard> -->
    </div>
</template>
