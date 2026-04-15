<template>
    <VRow>
        <VCol cols="12">
            <VCard class="pa-6">
                <VCardTitle class="d-flex align-center justify-space-between mb-4">
                    <div class="d-flex align-center gap-2">
                        <VIcon icon="ri-hand-coin-line" color="success" />
                        <span class="text-h5 font-weight-bold">Contribuciones de Socios</span>
                    </div>
                    <VBtn color="success" variant="elevated" @click="openAddDialog">
                        <VIcon icon="ri-add-line" start />
                        Nuevo Aporte
                    </VBtn>
                </VCardTitle>

                <!-- Filtros -->
                <VCardText class="pa-0">
                    <VRow>
                        <VCol cols="12" md="4">
                            <VTextField v-model="search" label="Buscar socio..." prepend-inner-icon="ri-search-line"
                                placeholder="Buscar por nombre o identificación" clearable
                                @keyup.enter="loadContributions" />
                        </VCol>
                        <VCol cols="12" md="2">
                            <VBtn color="primary" variant="elevated" @click="loadContributions" :loading="isLoading"
                                block>
                                <VIcon icon="ri-search-line" start />
                                Buscar
                            </VBtn>
                        </VCol>
                    </VRow>
                </VCardText>

                <!-- Tabla de Contribuciones -->
                <VCardText class="pa-0">
                    <VDataTable :headers="headers" :items="contributions" :loading="isLoading"
                        :items-per-page="itemsPerPage" class="text-no-wrap">
                        <!-- Socio -->
                        <template #item.partner="{ item }">
                            <div class="d-flex align-center gap-2">
                                <VAvatar size="32" color="primary" variant="tonal">
                                    <VIcon icon="ri-user-line" />
                                </VAvatar>
                                <div>
                                    <div class="font-weight-medium">{{ item.partner?.name || 'N/A' }} {{
                                        item.partner?.surname || '' }}</div>
                                    <div class="text-caption text-medium-emphasis">{{ item.partner?.identification ||
                                        'N/A' }}</div>
                                </div>
                            </div>
                        </template>

                        <!-- Monto -->
                        <template #item.amount="{ item }">
                            <span class="text-success font-weight-bold">${{ formatCurrency(item.amount) }}</span>
                        </template>

                        <!-- Fecha -->
                        <template #item.contribution_date="{ item }">
                            <div class="d-flex align-center gap-2">
                                <VIcon icon="ri-calendar-line" size="16" color="info" />
                                <span>{{ formatDate(item.contribution_date) }}</span>
                            </div>
                        </template>

                        <!-- Estado -->
                        <template #item.status="{ item }">
                            <VChip size="small" color="success" variant="tonal">
                                <VIcon icon="ri-check-line" start size="14" />
                                Activo
                            </VChip>
                        </template>

                        <!-- Acciones -->
                        <template #item.actions="{ item }">
                            <div class="d-flex gap-1">
                                <VBtn icon variant="text" size="small" color="info" @click="openEditDialog(item)">
                                    <VIcon icon="ri-edit-line" />
                                </VBtn>
                                <VBtn icon variant="text" size="small" color="error" @click="openDeleteDialog(item)">
                                    <VIcon icon="ri-delete-bin-line" />
                                </VBtn>
                            </div>
                        </template>

                        <!-- Paginación -->
                        <template #bottom>
                            <div class="d-flex justify-space-between align-center pa-4">
                                <div class="text-body-2">
                                    Mostrando {{ contributions.length }} de {{ totalItems }} contribuciones
                                </div>
                                <VPagination v-model="currentPage" :length="totalPages" :total-visible="5"
                                    @update:modelValue="loadContributions" />
                            </div>
                        </template>
                    </VDataTable>
                </VCardText>
            </VCard>
        </VCol>
    </VRow>

    <!-- Dialogs -->
    <PartnerContributionAddDialog v-model="isAddDialogVisible" :partners="partners" @success="onSuccess" />

    <PartnerContributionEditDialog v-model="isEditDialogVisible" :contribution-data="selectedContribution"
        :partners="partners" @success="onSuccess" />

    <PartnerContributionDeleteDialog v-model="isDeleteDialogVisible" :contribution-data="selectedContribution"
        @success="onSuccess" />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import PartnerContributionAddDialog from '@/components/inventory/partners/partner_contributions/PartnerContributionAddDialog.vue'
import PartnerContributionEditDialog from '@/components/inventory/partners/partner_contributions/PartnerContributionEditDialog.vue'
import PartnerContributionDeleteDialog from '@/components/inventory/partners/partner_contributions/PartnerContributionDeleteDialog.vue'

const { showNotification } = useGlobalToast()

// Estado
const contributions = ref([])
const partners = ref([])
const search = ref('')
const currentPage = ref(1)
const totalPages = ref(0)
const totalItems = ref(0)
const itemsPerPage = ref(10)
const isLoading = ref(false)

// Dialogs
const isAddDialogVisible = ref(false)
const isEditDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const selectedContribution = ref(null)

// Headers de la tabla
const headers = [
    { title: 'Socio', key: 'partner', sortable: false },
    { title: 'Monto', key: 'amount', sortable: true },
    { title: 'Fecha', key: 'contribution_date', sortable: true },
    { title: 'Notas', key: 'notes', sortable: false },
    { title: 'Estado', key: 'status', sortable: false },
    { title: 'Acciones', key: 'actions', sortable: false, width: 100 }
]

// Métodos
const formatCurrency = (value) => {
    if (isNaN(value) || value === null) return '0.00'
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

const loadContributions = async () => {
    isLoading.value = true
    try {
        const resp = await $api(`contributions?page=${currentPage.value}&search=${search.value || ''}`, {
            method: 'GET'
        })

        if (resp.status === 200) {
            // Laravel paginate devuelve: { data: [], current_page: 1, last_page: 1, total: 0, per_page: 10 }
            contributions.value = resp.data || []
            totalPages.value = resp.last_page || 1
            totalItems.value = resp.total || 0
            currentPage.value = resp.current_page || 1
        }
    } catch (error) {
        console.error('Error loading contributions:', error)
        showNotification('Error al cargar las contribuciones', 'error')
        contributions.value = []
        totalPages.value = 0
        totalItems.value = 0
    } finally {
        isLoading.value = false
    }
}

const loadPartners = async () => {
    try {
        const data = { search: '' }
        const resp = await $api('partners/index', {
            method: 'POST',
            body: data
        })
        if (resp.status === 200) {
            partners.value = resp.partners?.data || []
        }
    } catch (error) {
        console.error('Error loading partners:', error)
        partners.value = []
    }
}

// Métodos para dialogs
const openAddDialog = () => {
    isAddDialogVisible.value = true
}

const openEditDialog = (contribution) => {
    selectedContribution.value = contribution
    isEditDialogVisible.value = true
}

const openDeleteDialog = (contribution) => {
    selectedContribution.value = contribution
    isDeleteDialogVisible.value = true
}

const onSuccess = () => {
    loadContributions()
    selectedContribution.value = null
}

// Lifecycle
onMounted(() => {
    loadContributions()
    loadPartners()
})
</script>
