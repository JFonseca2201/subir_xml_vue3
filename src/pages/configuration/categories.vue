<script setup>
const headers = [
    /*     {
          title: 'ID',
          key: 'id',
      }, */
    {
        title: "Categoria",
        key: "name",
    },
    {
        title: "Estado",
        key: "state",
    },
    {
        title: "Fecha de registro",
        key: "created_at",
    },
    {
        title: "Action",
        key: "action",
    },
];
const isCategorieAddDialogVisible = ref(false);
const isCategorieEditDialogVisible = ref(false);
const isCategorieDeleteDialogVisible = ref(false);
const isCategorieImageDialogVisible = ref(false);

const list_categories = ref([]);
const searchQuery = ref(null);
const categorie_selected_edit = ref(null);
const categorie_selected_delete = ref(null);
const categorie_selected_image = ref(null);

const isLoading = ref(false); // ⬅ loader global para la tabla

const list = async () => {
    isLoading.value = true; // ⬅ activar loader
    try {
        const resp = await $api(
            "categories?search=" + (searchQuery.value ? searchQuery.value : ""),
            {
                method: "GET",
                onResponseError({ response }) {
                    console.log(response._data.error);
                },
            },
        );
        console.log(resp);
        list_categories.value = resp.categories;
    } catch (error) {
        console.log(error);
    } finally {
        isLoading.value = false; // ocultar overlay
    }
};

const addNewCategorie = (NewCategorie) => {
    console.log(NewCategorie);
    let backup = list_categories.value;
    list_categories.value = [];
    backup.unshift(NewCategorie);
    setTimeout(() => {
        list_categories.value = backup;
    }, 50);
};

const addEditCategorie = (editCategorie) => {
    console.log(editCategorie);
    let backup = list_categories.value;
    list_categories.value = [];
    let INDEX = backup.findIndex((categ) => categ.id == editCategorie.id);
    if (INDEX != -1) {
        backup[INDEX] = editCategorie;
    }
    setTimeout(() => {
        list_categories.value = backup;
    }, 50);
};

const addDeleteCategorie = (Categorie) => {
    console.log(Categorie);
    let backup = list_categories.value;
    list_categories.value = [];
    let INDEX = backup.findIndex((categorie) => categorie.id == Categorie.id);
    if (INDEX != -1) {
        backup.splice(INDEX, 1);
    }
    setTimeout(() => {
        list_categories.value = backup;
    }, 50);
};

const editItem = (item) => {
    console.log(item);
    isCategorieEditDialogVisible.value = true;
    categorie_selected_edit.value = item;
};

const deleteItem = (item) => {
    isCategorieDeleteDialogVisible.value = true;
    categorie_selected_delete.value = item;
};

const viewImage = (item) => {
    categorie_selected_image.value = item;
    isCategorieImageDialogVisible.value = true;
};

onMounted(() => {
    list();
});

definePage({ meta: { permission: "settings" } });
</script>
<template>
    <div class="pa-4">
        <VCard elevation="4" rounded="lg">
            <!-- HEADER -->
            <VCardTitle class="d-flex align-center gap-2">
                <VIcon icon="ri-price-tag-3-line" />
                <span class="text-h6 font-weight-bold">Categorías</span>
            </VCardTitle>

            <!-- OVERLAY -->
            <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
                <VProgressCircular indeterminate size="42" width="4" color="primary" />
            </VOverlay>

            <VDivider />

            <!-- TOOLBAR -->
            <VCardText>
                <VRow align="center">
                    <VCol cols="12" md="4">
                        <VTextField placeholder="Buscar categorías..." density="compact" variant="outlined"
                            prepend-inner-icon="ri-search-line" v-model="searchQuery" @keyup.enter="list" clearable />
                    </VCol>

                    <VCol cols="12" md="8">
                        <div class="d-flex justify-end">
                            <VBtn color="primary" variant="flat" @click="
                                isCategorieAddDialogVisible = !isCategorieAddDialogVisible
                                ">
                                <VIcon start icon="ri-add-line" />
                                Nueva categoría
                            </VBtn>
                        </div>
                    </VCol>
                </VRow>
            </VCardText>

            <!-- TABLE -->
            <VDataTable :headers="headers" :items="list_categories" :items-per-page="10" class="text-no-wrap">
                <!-- Nombre -->
                <template #item.name="{ item }">
                    <div class="d-flex align-center">
                        <VAvatar size="32" :color="item.imagen ? undefined : 'primary'"
                            :variant="!item.imagen ? 'tonal' : undefined"
                            class="cursor-pointer"
                            @click="viewImage(item)">
                            <VImg v-if="item.imagen" :src="item.imagen" />
                            <VIcon v-else icon="ri-folder-line" />
                        </VAvatar>

                        <div class="d-flex flex-column ms-3">
                            <span class="font-weight-medium text-high-emphasis">
                                {{ item.title }}
                            </span>
                        </div>
                    </div>
                </template>

                <!-- Estado -->
                <template #item.state="{ item }">
                    <VChip v-if="item.state == 1" size="small" color="success" variant="flat">
                        Activo
                    </VChip>
                    <VChip v-if="item.state == 2" size="small" color="error" variant="flat">
                        Inactivo
                    </VChip>
                </template>

                <!-- Acciones -->
                <template #item.action="{ item }">
                    <div class="d-flex gap-1">
                        <IconBtn size="small" color="primary" @click="editItem(item)">
                            <VIcon icon="ri-pencil-line" />
                        </IconBtn>
                        <IconBtn size="small" color="error" @click="deleteItem(item)">
                            <VIcon icon="ri-delete-bin-line" />
                        </IconBtn>
                    </div>
                </template>
            </VDataTable>
        </VCard>

        <!-- DIALOGS (SIN CAMBIOS) -->
        <CategorieAddDialog v-model:isDialogVisible="isCategorieAddDialogVisible" @addCategorie="addNewCategorie" />

        <CategorieEditDialog v-if="categorie_selected_edit && isCategorieEditDialogVisible"
            v-model:isDialogVisible="isCategorieEditDialogVisible" :categorieSelected="categorie_selected_edit"
            @editCategorie="addEditCategorie" />

        <CategorieDeleteDialog v-if="categorie_selected_delete && isCategorieDeleteDialogVisible"
            v-model:isDialogVisible="isCategorieDeleteDialogVisible" :categorieSelected="categorie_selected_delete"
            @deleteCategorie="addDeleteCategorie" />

        <!-- Diálogo para ver imagen de categoría -->
        <VDialog v-model="isCategorieImageDialogVisible" max-width="600px">
            <VCard>
                <VCardTitle class="d-flex align-center justify-space-between pa-4">
                    <div class="d-flex align-center gap-2">
                        <VIcon icon="ri-image-line" color="primary" />
                        <span>Imagen de Categoría</span>
                    </div>
                    <VBtn icon variant="text" @click="isCategorieImageDialogVisible = false">
                        <VIcon icon="ri-close-line" />
                    </VBtn>
                </VCardTitle>

                <VDivider />

                <VCardText class="pa-4">
                    <div class="text-center">
                        <div class="mb-4">
                            <h4 class="text-h6 font-weight-bold">
                                {{ categorie_selected_image?.title || 'Sin nombre' }}
                            </h4>
                        </div>
                        
                        <div v-if="categorie_selected_image?.imagen" class="d-flex justify-center">
                            <VImg 
                                :src="categorie_selected_image.imagen" 
                                max-width="400"
                                max-height="300"
                                contain
                                class="rounded-lg elevation-4"
                            />
                        </div>
                        
                        <div v-else class="d-flex flex-column align-center justify-center pa-8 bg-grey-lighten-4 rounded-lg">
                            <VIcon icon="ri-image-line" size="64" color="grey-lighten-1" />
                            <span class="text-body-2 text-medium-emphasis mt-2">
                                No hay imagen disponible
                            </span>
                        </div>
                    </div>
                </VCardText>

                <VDivider />

                <VCardActions class="pa-4">
                    <VSpacer />
                    <VBtn color="primary" variant="elevated" @click="isCategorieImageDialogVisible = false">
                        Cerrar
                    </VBtn>
                </VCardActions>
            </VCard>
        </VDialog>
    </div>
</template>
