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

const list_categories = ref([]);
const searchQuery = ref(null);
const categorie_selected_edit = ref(null);
const categorie_selected_delete = ref(null);

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
                            :variant="!item.imagen ? 'tonal' : undefined">
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
    </div>
</template>
