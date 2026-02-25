<script setup>
import { ref, onMounted } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const partnerSelected = ref(null);
const currentPage = ref(1);
const totalPage = ref(0);

const { showNotification } = useGlobalToast();

const list_partners = ref([])
const search = ref(null);
const isLoading = ref(false);

const isPartnerAddDialogVisible = ref(false);
const isPartnerShowDialogVisible = ref(false);
const isPartnerEditDialogVisible = ref(false);
const isPartnerDeleteDialogVisible = ref(false);

const list = async () => {
    isLoading.value = true;

    try {

        let data = {
            search: search.value || '',
        };
        const resp = await $api("partners/index?page=" + currentPage.value + "&search=" + (search.value ? search.value : ""), {
            method: "POST",
            body: data,
            onResponseError({ response }) {
                console.log(response._data.error);
            },
        });
        console.log(resp);
        list_partners.value = resp.partners.data;
        totalPage.value = resp.total_page;
        if (currentPage.value > totalPage.value && totalPage.value > 0) {
            currentPage.value = 1;
        }
        showNotification('Lista de socios cargada correctamente', 'success')
    } catch (error) {
        console.error(error)
        showNotification('Error al cargar la lista de socios', 'error')
    } finally {
        isLoading.value = false;
    }
}

const providers = ref([]);

const showItem = (ShowPartner) => {
    console.log(ShowPartner);
    isPartnerShowDialogVisible.value = true;
    partnerSelected.value = ShowPartner;
}

const editPartner = (editPartner) => {
    console.log(editPartner);
    isPartnerEditDialogVisible.value = true;
    partnerSelected.value = editPartner;

}

const deletePartner = (DeletePartner) => {
    partnerSelected.value = DeletePartner;
    isPartnerDeleteDialogVisible.value = true;
    console.log(DeletePartner);
}

const confirmDeletePartner = async () => {
    if (!partnerSelected.value) return;
    try {
        await $api(`partners/${partnerSelected.value.id}`, {
            method: 'DELETE',
            onResponseError({ response }) {
                showNotification('Error al eliminar socio', 'error');
            },
        });
        showNotification('Socio eliminado correctamente', 'success');
        await list();
    } catch (error) {
        showNotification('Error al eliminar socio', 'error');
    } finally {
        isPartnerDeleteDialogVisible.value = false;
        partnerSelected.value = null;
    }
};

const addPartner = (newPartner) => {
    console.log('Agregando nuevo socio:', newPartner);

    // Agregar el nuevo socio al inicio de la lista
    list_partners.value.unshift(newPartner);

    // Mostrar mensaje de éxito
    showNotification('Socio agregado correctamente a la tabla', 'success');
}

const updatePartner = (updatedPartner) => {
    console.log('Actualizando socio:', updatedPartner);

    // Buscar el índice del socio a actualizar
    const index = list_partners.value.findIndex(partner => partner.id === updatedPartner.id);

    if (index !== -1) {
        // Actualizar el socio en la lista
        list_partners.value[index] = updatedPartner;

        // Mostrar mensaje de éxito
        showNotification('Socio actualizado correctamente en la tabla', 'success');
    } else {
        // Si no se encuentra, recargar la lista
        console.warn('Socio no encontrado en la lista, recargando...');
        list();
    }
}

// Método de refresco para reiniciar todos los filtros
const refresh = () => {
    search.value = null;
    currentPage.value = 1;
    list();
}

const formatDate = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    return isNaN(d) ? '-' : d.toISOString().slice(0, 10)
}

onMounted(() => {
    list();
})
</script>

<template>
    <div class="pa-6">

        <!-- Overlay global -->
        <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
            <VProgressCircular indeterminate size="56" width="5" color="primary" />
        </VOverlay>

        <!-- CARD MAESTRA -->
        <VCard class="elevation-4 rounded-xl">

            <!-- HEADER -->
            <VCardText>
                <VRow class="align-center justify-space-between">
                    <VCol cols="12" md="8">
                        <div class="d-flex align-center gap-3">
                            <VIcon size="40" color="primary">ri-group-3-line</VIcon>
                            <div>
                                <h2 class="text-h4 font-weight-bold mb-1">
                                    Gestión de Socios
                                </h2>
                                <span class="text-medium-emphasis">
                                    Administración y control de socios
                                </span>
                            </div>
                        </div>
                    </VCol>

                    <VCol cols="12" md="4" class="d-flex justify-end align-center">
                        <VBtn color="primary" size="large" elevation="5"
                            @click="isPartnerAddDialogVisible = !isPartnerAddDialogVisible">
                            <VIcon start>ri-add-circle-line</VIcon>
                            Nuevo Socio
                        </VBtn>
                    </VCol>
                </VRow>
            </VCardText>

            <VDivider />

            <!-- FILTROS Y BOTÓN FILTRAR -->
            <VCardText>

                <div class="d-flex align-center gap-2 mb-4">
                    <VIcon color="primary">ri-filter-3-line</VIcon>
                    <span class="text-h6 font-weight-bold">
                        Filtros de búsqueda
                    </span>
                </div>


                <!-- Filtros de búsqueda alineados con el botón Filtrar -->
                <VRow dense>
                    <VCol cols="12" md="6">
                        <VTextField v-model="search" @keyup.enter="list" label="Buscar socio" variant="outlined"
                            density="comfortable" clearable prepend-inner-icon="ri-search-line" />
                    </VCol>

                    <!-- Botón Filtrar alineado con los filtros -->
                    <VCol cols="12" md="6" class="d-flex align-end justify-end gap-4">
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
            </VCardText>

            <VDivider />

            <!-- TABLA -->
            <VCardText class="pa-0">
                <VTable hover class="text-no-wrap">
                    <thead class="bg-primary text-white">
                        <tr>
                            <th>#</th>
                            <th>Cedula / Ruc</th>
                            <th>Socio</th>
                            <th>Fecha registro</th>
                            <th>Email</th>
                            <th>Teléfono</th>

                            <th class="text-center">Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="partner in list_partners" :key="partner" class="hover:bg-grey-lighten-4 transition">
                            <td class="font-weight-medium">{{ partner.id }}</td>
                            <td>{{ partner.identification }}</td>
                            <td>{{ partner.name }}</td>
                            <td>{{ formatDate(partner.created_at) }}</td>
                            <td>{{ partner.email }}</td>
                            <td>{{ partner.phone }}</td>

                            <td class="text-center">
                                <div class="d-flex justify-center gap-1">
                                    <IconBtn @click="showItem(partner)">
                                        <VIcon icon="ri-eye-line" />
                                    </IconBtn>
                                    <IconBtn @click="editPartner(partner)">
                                        <VIcon icon="ri-pencil-line" />
                                    </IconBtn>
                                    <IconBtn @click="deletePartner(partner)">
                                        <VIcon icon="ri-delete-bin-6-line" color="error" />
                                    </IconBtn>
                                </div>
                            </td>
                        </tr>

                        <tr v-if="!list_partners.length">
                            <td colspan="8" class="text-center text-medium-emphasis py-6">
                                <VIcon size="32" class="mb-2">ri-inbox-line</VIcon>
                                <div>No hay soci@s registrad@s</div>
                            </td>
                        </tr>
                    </tbody>
                </VTable>
            </VCardText>

            <VDivider />

            <!-- PAGINACIÓN -->
            <VCardActions class="justify-center pa-4">
                <VPagination v-model="currentPage" :length="totalPage" rounded="circle" @update:modelValue="list" />
            </VCardActions>
        </VCard>

        <!-- DIALOG -->
        <PartnerAddDialog v-model:isDialogVisible="isPartnerAddDialogVisible" @addPartner="addPartner" />
        <PartnerShowDialog v-if="isPartnerShowDialogVisible" v-model:isDialogVisible="isPartnerShowDialogVisible"
            :partnerSelected="partnerSelected" />
        <PartnerEditDialog v-if="isPartnerEditDialogVisible" v-model:isDialogVisible="isPartnerEditDialogVisible"
            :partnerSelected="partnerSelected" @updatePartner="updatePartner" />
        <PartnerDeleteDialog v-if="isPartnerDeleteDialogVisible && partnerSelected"
            v-model:isDialogVisible="isPartnerDeleteDialogVisible" :partnerSelected="partnerSelected"
            @deletePartner="confirmDeletePartner" />
    </div>
</template>