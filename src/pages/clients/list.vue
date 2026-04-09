<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import ClientFinalAddDialog from '@/components/inventory/clients/ClientFinalAddDialog.vue'
import ClientCompanyAddDialog from '@/components/inventory/clients/ClientCompanyAddDialog.vue'
import ClientFinalEditDialog from '@/components/inventory/clients/ClientFinalEditDialog.vue'
import ClientCompanyEditDialog from '@/components/inventory/clients/ClientCompanyEditDialog.vue'
import ClientShowDialog from '@/components/inventory/clients/ClientShowDialog.vue'
import ClientDeleteDialog from '@/components/inventory/clients/ClientDeleteDialog.vue'

// Router
const router = useRouter()

// Estado
const loading = ref(false)
const clients = ref([])
const clientDialog = ref(false)
const selectedClient = ref(null)
const deleteDialog = ref(false)
const clientToDelete = ref(null)
const isClientFinalAddDialogVisible = ref(false)
const isClientCompanyAddDialogVisible = ref(false)
const isClientFinalEditDialogVisible = ref(false)
const clientToEdit = ref(null)
const isClientCompanyEditDialogVisible = ref(false)
const companyToEdit = ref(null)
const isClientShowDialogVisible = ref(false)
const clientToShow = ref(null)

// Formulario de búsqueda
const searchForm = ref({
    search: '',
    type_client: null,
    type_document: null,
    state: null,  // Cambiar a null para mostrar todos por defecto
    gender: null,
    sucursale_id: null
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalItems = ref(0)
const totalPages = ref(0)
const pagination = ref({
    total: 0,
    per_page: 10,
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0
})

// Opciones para selects
const sucursales = ref([])
const typeClientOptions = ref([
    { title: 'Natural', value: 1 },
    { title: 'Jurídico o compañía', value: 2 }
])
const typeDocumentOptions = ref([
    { title: 'Cédula', value: 1 },
    { title: 'RUC', value: 2 },
    { title: 'Pasaporte', value: 3 }
])
const stateOptions = ref([
    { title: 'Activo', value: 1 },
    { title: 'Inactivo', value: 2 }
])
const genderOptions = ref([
    { title: 'Masculino', value: 'M' },
    { title: 'Femenino', value: 'F' },
    { title: 'Otro', value: 'O' }
])

// Cargar clientes
const loadClients = async () => {
    loading.value = true
    try {
        // Primero probar sin filtros para ver si hay datos
        const params = {
            page: currentPage.value,
            per_page: itemsPerPage.value,
        };

        // Agregar filtros solo si tienen valores
        if (searchForm.value.search) {
            params.search = searchForm.value.search;
        }
        if (searchForm.value.type_client) {
            params.type_client = searchForm.value.type_client;
        }
        if (searchForm.value.type_document) {
            params.type_document = searchForm.value.type_document;
        }
        if (searchForm.value.state) {
            params.state = searchForm.value.state;
        }

        console.log('Parámetros enviados:', params);

        const resp = await $api("clients", {
            method: "GET",
            params: params,
            onResponseError({ response }) {
                console.log(response._data.error);
            },
        });

        console.log('Respuesta completa de la API:', resp);
        console.log('Estructura de datos:', Object.keys(resp));
        console.log('clients en respuesta:', resp.clients);
        console.log('data en respuesta:', resp.data);

        clients.value = resp.clients || resp.data || [];
        totalPages.value = resp.total_pages || resp.last_page || 1;
        totalItems.value = resp.total || resp.data?.length || 0;

    } catch (error) {
        console.error('❌ Error al cargar clientes:', error);
    } finally {
        loading.value = false;
    }
}

// Cargar configuración (sucursales)
const loadConfig = async () => {
    try {
        const resp = await $api("clients/config", {
            method: "GET",
            onResponseError({ response }) {
                console.log(response._data.error);
            },
        });
        console.log(resp);
        sucursales.value = resp.sucursales || [];
    } catch (error) {
        console.log(error);
    }
};

// Watch para resetear página cuando cambia el filtro
watch(searchForm, () => {
    currentPage.value = 1;
    loadClients();
}, { deep: true });

// Watch para paginación
watch(currentPage, () => {
    loadClients();
});

// Métodos
const showClient = (client) => {
    clientToShow.value = client;
    isClientShowDialogVisible.value = true;
}

const deleteClient = (client) => {
    clientToDelete.value = client;
    deleteDialog.value = true;
}

const handleClientDeleted = (deletedClient) => {
    // Eliminar el cliente de la lista local
    const index = clients.value.findIndex(client => client.id === deletedClient.id);
    if (index > -1) {
        clients.value.splice(index, 1);
        // Actualizar el total de items
        totalItems.value = Math.max(0, totalItems.value - 1);
    }
    // Cerrar el diálogo
    deleteDialog.value = false;
    clientToDelete.value = null;
}

const addNewClientFinal = () => {
    console.log("Agregar cliente final");
    isClientFinalAddDialogVisible.value = true;
}

const handleClientFinalAdded = (clientData) => {
    console.log("Cliente final agregado:", clientData);

    // Agregar nuevo cliente al listado localmente (sin recargar API)
    if (clientData) {
        clients.value.unshift(clientData); // Agregar al principio
        totalItems.value += 1; // Incrementar contador
    }
}

const addClient = () => {
    console.log("Agregar cliente empresa");
    isClientCompanyAddDialogVisible.value = true;
}

const handleClientCompanyAdded = (clientData) => {
    console.log("Cliente empresa agregado:", clientData);

    // Agregar nuevo cliente al listado localmente (sin recargar API)
    if (clientData) {
        clients.value.unshift(clientData); // Agregar al principio
        totalItems.value += 1; // Incrementar contador
    }
}

const editClient = (client) => {
    console.log("Editar cliente:", client);

    // Determinar tipo de cliente y abrir diálogo correspondiente
    if (client.type_client === '2' || client.type_client === 2) {
        // Cliente empresa
        companyToEdit.value = client;
        isClientCompanyEditDialogVisible.value = true;
    } else {
        // Cliente final
        clientToEdit.value = client;
        isClientFinalEditDialogVisible.value = true;
    }
}

const handleClientFinalUpdated = (clientData) => {
    console.log("Cliente final actualizado:", clientData);

    // Validar que clientData exista y tenga id
    if (!clientData || !clientData.id) {
        console.error("Datos del cliente inválidos:", clientData);
        return;
    }

    // Actualizar cliente en el listado localmente (sin recargar API)
    const index = clients.value.findIndex(client => client.id === clientData.id);
    if (index !== -1) {
        clients.value.splice(index, 1, clientData);
        console.log("Cliente actualizado en posición:", index);
    } else {
        console.warn("Cliente no encontrado en el listado, recargando...");
        loadClients(); // Fallback: recargar si no se encuentra
    }
}

const handleClientCompanyUpdated = (clientData) => {
    console.log("Cliente empresa actualizado:", clientData);

    // Validar que clientData exista y tenga id
    if (!clientData || !clientData.id) {
        console.error("Datos del cliente inválidos:", clientData);
        return;
    }

    // Actualizar cliente en el listado localmente (sin recargar API)
    const index = clients.value.findIndex(client => client.id === clientData.id);
    if (index !== -1) {
        clients.value.splice(index, 1, clientData);
        console.log("Cliente actualizado en posición:", index);
    } else {
        console.warn("Cliente no encontrado en el listado, recargando...");
        loadClients(); // Fallback: recargar si no se encuentra
    }
}

// Truncar texto
const truncate = (text, length = 50) => {
    if (!text) return '';
    return text.length > length ? text.slice(0, length) + '…' : text;
}

// Montar componente
onMounted(() => {
    /* loadConfig(); */
    loadClients();
});
</script>
<template>
    <VCard>
        <VCardTitle class="d-flex align-center justify-space-between pa-4">
            <div class="d-flex align-center">
                <VIcon icon="ri-user-3-line" class="me-2" />
                <span class="text-h5">Gestión de Clientes</span>
            </div>
            <div class="d-flex gap-2">
                <VBtn color="primary" @click="addNewClientFinal" prepend-icon="ri-user-add-line">
                    Cliente Final
                </VBtn>
                <VBtn color="primary" @click="addClient" prepend-icon="ri-building-line">
                    Cliente Empresa
                </VBtn>
            </div>
        </VCardTitle>

        <VDivider />

        <!-- Formulario de búsqueda -->
        <VCardText class="pa-4">
            <VForm ref="searchFormRef">
                <VRow>
                    <VCol cols="12" md="7">
                        <VRow>
                            <VCol cols="12" md="12">
                                <VTextField v-model="searchForm.search" label="Buscar cliente"
                                    placeholder="Nombre, email, documento..." prepend-inner-icon="ri-search-line"
                                    clearable hide-details />
                            </VCol>

                        </VRow>
                    </VCol>
                    <VCol cols="12" md="5">
                        <VRow>
                            <VCol cols="12" md="6">
                                <VSelect v-model="searchForm.type_client" :items="typeClientOptions" item-title="title"
                                    item-value="value" label="Tipo de cliente" placeholder="Todos" clearable
                                    hide-details />
                            </VCol>
                            <VCol cols="12" md="6">
                                <VSelect v-model="searchForm.state" :items="stateOptions" item-title="title"
                                    item-value="value" label="Estado" placeholder="Todos" clearable hide-details />
                            </VCol>
                        </VRow>
                    </VCol>
                </VRow>

            </VForm>
        </VCardText>

        <VDivider />

        <!-- Tabla de clientes -->
        <VCardText class="pa-0">
            <VTable hover class="client-table">
                <thead class="bg-primary text-white">
                    <tr>
                        <th>#</th>
                        <th>Nombre Completo</th>
                        <th>Tipo</th>
                        <th>Documento</th>
                        <th>Teléfono</th>
                        <th>Email</th>
                        <th>Estado</th>
                        <th class="text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="8" class="text-center pa-4">
                            <VProgressCircular indeterminate color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="!clients.length">
                        <td colspan="8" class="text-center text-medium-emphasis py-6">
                            <VIcon size="32" class="mb-2">ri-user-line</VIcon>
                            <div>No hay clientes registrados</div>
                        </td>
                    </tr>
                    <tr v-else v-for="client in clients" :key="client.id" class="hover:bg-grey-lighten-4 transition">
                        <td class="font-weight-medium">{{ client.id }}</td>
                        <td>
                            <div class="font-weight-medium">{{ client.full_name || `${client.name} ${client.surname}` }}
                            </div>
                            <div class="text-caption text-medium-emphasis">{{ client.address }}</div>
                        </td>
                        <td>
                            <VChip :color="client.type_client === '1' ? 'primary' : 'secondary'" variant="tonal"
                                size="small">
                                {{ client.type_client === '1' ? 'Natural' : 'Jurídico' }}
                            </VChip>
                        </td>
                        <td>
                            <div class="text-caption">{{ client.type_document === '1' ? 'Cédula' : client.type_document
                                === '2' ? 'RUC' : 'Pasaporte' }}</div>
                            <div class="font-weight-medium">{{ client.n_document }}</div>
                        </td>
                        <td>{{ client.phone || '-' }}</td>
                        <td>{{ client.email || '-' }}</td>
                        <td>
                            <VChip :color="client.state === 1 ? 'success' : 'error'" variant="tonal" size="small">
                                {{ client.state === 1 ? 'Activo' : 'Inactivo' }}
                            </VChip>
                        </td>
                        <td class="text-center">
                            <div class="d-flex justify-center gap-1">
                                <IconBtn @click="showClient(client)">
                                    <VIcon icon="ri-eye-line" />
                                </IconBtn>
                                <IconBtn @click="editClient(client)">
                                    <VIcon icon="ri-pencil-line" />
                                </IconBtn>
                                <IconBtn @click="deleteClient(client)">
                                    <VIcon icon="ri-delete-bin-6-line" color="error" />
                                </IconBtn>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </VTable>
        </VCardText>

        <VDivider />

        <!-- Paginación -->
        <VCardActions class="justify-center pa-4">
            <div class="d-flex flex-column align-center gap-2">
                <div class="text-caption text-medium-emphasis">
                    Mostrando {{ clients.length }} de {{ totalItems }} clientes
                </div>
                <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7"
                    @update:modelValue="loadClients" />
            </div>
        </VCardActions>
    </VCard>

    <ClientFinalAddDialog v-if="isClientFinalAddDialogVisible" v-model:isDialogVisible="isClientFinalAddDialogVisible"
        @addClientFinal="handleClientFinalAdded" />

    <ClientCompanyAddDialog v-if="isClientCompanyAddDialogVisible"
        v-model:isDialogVisible="isClientCompanyAddDialogVisible" @addClientCompany="handleClientCompanyAdded" />

    <ClientFinalEditDialog v-if="isClientFinalEditDialogVisible"
        v-model:isDialogVisible="isClientFinalEditDialogVisible" :clientData="clientToEdit"
        @clientUpdated="handleClientFinalUpdated" />

    <ClientCompanyEditDialog v-if="isClientCompanyEditDialogVisible"
        v-model:isDialogVisible="isClientCompanyEditDialogVisible" :clientData="companyToEdit"
        @clientUpdated="handleClientCompanyUpdated" />

    <ClientShowDialog v-if="isClientShowDialogVisible" v-model:isDialogVisible="isClientShowDialogVisible"
        :clientData="clientToShow" />

    <ClientDeleteDialog v-if="deleteDialog" v-model:isDialogVisible="deleteDialog" :clientSelected="clientToDelete"
        @deleteClient="handleClientDeleted" />
</template>

<style scoped>
.client-table {
    border-collapse: collapse;
}

.client-table th {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.5px;
}

.client-table td {
    vertical-align: middle;
}

.hover\:bg-grey-lighten-4:hover {
    background-color: rgba(0, 0, 0, 0.04);
    transition: background-color 0.2s ease;
}
</style>
