<template>
    <div class="contributions-container pa-6">
        <div class="d-flex align-center justify-space-between mb-8">
            <div>
                <h1 class="text-h4 font-weight-black color-title mb-1">
                    <VIcon icon="ri-bank-card-2-line" color="success" class="mr-2" />
                    Aportes
                </h1>
            </div>
            <VBtn color="success" size="large" variant="elevated" @click="openAddDialog" class="rounded-lg">
                <VIcon icon="ri-add-line" start />
                Nuevo Aporte
            </VBtn>
        </div>

        <VRow>
            <VCol cols="12" md="3">
                <VCard class="pa-5 rounded-lg border-light sticky-top" elevation="0">
                    <div class="text-overline mb-4 text-primary font-weight-bold">Filtros</div>

                    <VSelect v-model="selectedMonth" :items="monthOptions" item-title="label" item-value="value"
                        label="Mes" variant="outlined" density="comfortable" class="mb-4"
                        prepend-inner-icon="ri-calendar-line" clearable @update:modelValue="resetAndLoad" />

                    <VSelect v-model="selectedYear" :items="yearOptions" item-title="label" item-value="value"
                        label="Año" variant="outlined" density="comfortable" class="mb-4"
                        prepend-inner-icon="ri-history-line" @update:modelValue="resetAndLoad" />

                    <VTextField v-model="search" label="Socio" variant="outlined" density="comfortable"
                        prepend-inner-icon="ri-search-line" clearable @keyup.enter="resetAndLoad" />

                    <VDivider class="my-6" />

                    <div class="text-center">
                        <div class="text-caption text-uppercase text-medium-emphasis">Total en lista</div>
                        <div class="text-h4 font-weight-black text-success">${{ formatCurrency(globalSummary.total) }}
                        </div>
                    </div>
                </VCard>
            </VCol>

            <VCol cols="12" md="9">
                <div v-if="isLoading" class="d-flex justify-center py-12">
                    <VProgressCircular indeterminate color="primary" />
                </div>

                <div v-else-if="groupedContributions.length === 0" class="text-center py-12 empty-state">
                    <VIcon icon="ri-inbox-line" size="48" color="disabled" />
                    <p class="mt-2">No hay registros encontrados</p>
                </div>

                <div v-else>
                    <div v-for="group in groupedContributions" :key="group.monthYear" class="mb-6">
                        <div class="d-flex align-center justify-space-between mb-2">
                            <div class="d-flex align-center">
                                <div class="month-icon-box mr-3">
                                    <VIcon icon="ri-calendar-event-fill" color="primary" size="24" />
                                </div>
                                <div>
                                    <div class="text-h6 font-weight-black color-title leading-tight">{{ group.monthName
                                    }}</div>
                                    <div class="text-subtitle-2 font-weight-bold text-medium-emphasis leading-tight">{{
                                        group.year }}</div>
                                </div>
                            </div>
                            <div class="total-badge px-4 py-1 rounded-pill">
                                <span class="text-h5 font-weight-black text-white">${{ formatCurrency(group.totalAmount)
                                }}</span>
                            </div>
                        </div>

                        <VCard class="transaction-list-container rounded-xl" elevation="0" variant="outlined">
                            <div v-for="(contribution, index) in group.items" :key="contribution.id">
                                <div class="d-flex align-center pa-4 transaction-item">

                                    <div class="date-section text-center mr-6">
                                        <div class="text-h5 font-weight-black leading-tight">{{
                                            getDay(contribution.contribution_date) }}</div>
                                        <div class="text-overline font-weight-bold leading-tight">{{
                                            getMonthShort(contribution.contribution_date) }}</div>
                                    </div>

                                    <div class="flex-grow-1">
                                        <div class="text-subtitle-1 font-weight-bold color-title text-uppercase">
                                            {{ contribution.partner?.name }} {{ contribution.partner?.surname }}
                                        </div>
                                        <div class="text-caption text-medium-emphasis d-flex align-center">
                                            <VIcon icon="ri-bank-line" size="14" class="mr-1" /> Banco Guayaquil
                                            <VIcon icon="ri-id-card-line" size="14" class="ml-3 mr-1" /> {{
                                                contribution.partner?.identification }}
                                        </div>
                                    </div>

                                    <div v-if="contribution.notes"
                                        class="notes-section text-right px-4 hidden-sm-and-down">
                                        <span class="text-caption text-uppercase text-medium-emphasis">
                                            <VIcon icon="ri-chat-3-line" size="12" class="mr-1" />
                                            {{ contribution.notes }}
                                        </span>
                                    </div>

                                    <div class="text-right ml-4 action-section">
                                        <div class="text-subtitle-1 font-weight-black text-success">
                                            ${{ formatCurrency(contribution.amount) }}
                                        </div>
                                        <div class="d-flex justify-end gap-1">
                                            <VBtn icon="ri-pencil-line" variant="text" size="x-small" color="info"
                                                @click="openEditDialog(contribution)" />
                                            <VBtn icon="ri-delete-bin-line" variant="text" size="x-small" color="error"
                                                @click="openDeleteDialog(contribution)" />
                                        </div>
                                    </div>
                                </div>
                                <VDivider v-if="index < group.items.length - 1" class="mx-4" />
                            </div>
                        </VCard>
                    </div>

                    <div v-if="totalPages > 1" class="d-flex align-center justify-end mt-4">
                        <VPagination v-model="currentPage" :length="totalPages" :total-visible="5" density="comfortable"
                            size="small" @update:modelValue="loadContributions" />
                    </div>
                </div>
            </VCol>
        </VRow>

        <PartnerContributionAddDialog v-model="isAddDialogVisible" :partners="partners" @success="onSuccess" />
        <PartnerContributionEditDialog v-model="isEditDialogVisible" :contribution-data="selectedContribution"
            :partners="partners" @success="onSuccess" />
        <PartnerContributionDeleteDialog v-model="isDeleteDialogVisible" :contribution-data="selectedContribution"
            @success="onSuccess" />
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

import PartnerContributionAddDialog from '@/components/inventory/partners/partner_contributions/PartnerContributionAddDialog.vue'
import PartnerContributionEditDialog from '@/components/inventory/partners/partner_contributions/PartnerContributionEditDialog.vue'
import PartnerContributionDeleteDialog from '@/components/inventory/partners/partner_contributions/PartnerContributionDeleteDialog.vue'

const { showNotification } = useGlobalToast()
const isLoading = ref(false)
const rawContributions = ref([])
const partners = ref([])
const search = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const selectedMonth = ref(null)
const selectedYear = ref(new Date().getUTCFullYear())
const isAddDialogVisible = ref(false)
const isEditDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const selectedContribution = ref(null)

const monthOptions = [
    { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 }
]

const yearOptions = computed(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => ({ label: (current - 2 + i).toString(), value: current - 2 + i }))
})

const groupedContributions = computed(() => {
    const groups = {}
    rawContributions.value.forEach(item => {
        const d = new Date(item.contribution_date)
        const m = d.getUTCMonth() + 1
        const y = d.getUTCFullYear()
        const key = `${m}-${y}`
        if (!groups[key]) {
            groups[key] = { monthYear: key, month: m, year: y, monthName: getMonthName(m), totalAmount: 0, items: [] }
        }
        groups[key].items.push(item)
        groups[key].totalAmount += parseFloat(item.amount || 0)
    })
    return Object.values(groups).sort((a, b) => b.year - a.year || b.month - a.month)
})

const globalSummary = computed(() => {
    const total = rawContributions.value.reduce((acc, item) => acc + parseFloat(item.amount || 0), 0)
    return { total, count: rawContributions.value.length }
})

const getDay = (dateStr) => dateStr ? new Date(dateStr).getUTCDate() : '??'
const getMonthShort = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).toUpperCase().replace('.', '') : '...'
const formatCurrency = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const getMonthName = (val) => monthOptions.find(m => m.value === val)?.label || ''

const resetAndLoad = () => { currentPage.value = 1; loadContributions() }

const loadContributions = async () => {
    isLoading.value = true
    try {
        const params = new URLSearchParams({ page: currentPage.value, year: selectedYear.value })
        if (search.value) params.append('search', search.value)
        if (selectedMonth.value) params.append('month', selectedMonth.value)
        const resp = await $api(`contributions?${params.toString()}`, { method: 'GET' })
        rawContributions.value = resp.data || []
        totalPages.value = resp.last_page || 1
        totalItems.value = resp.total || 0
    } catch (e) { showNotification('Error al cargar', 'error') }
    finally { isLoading.value = false }
}

const loadPartners = async () => {
    try {
        const resp = await $api('partners/index', { method: 'POST', body: { search: '' } })
        partners.value = resp.partners?.data || []
    } catch (e) { console.error(e) }
}

const openAddDialog = () => isAddDialogVisible.value = true
const openEditDialog = (c) => { selectedContribution.value = c; isEditDialogVisible.value = true }
const openDeleteDialog = (c) => { selectedContribution.value = c; isDeleteDialogVisible.value = true }
const onSuccess = () => setTimeout(resetAndLoad, 300)

onMounted(() => { loadContributions(); loadPartners() })
</script>

<style scoped>
.contributions-container {
    background-color: #fcfcfc;
    min-height: 100vh;
}

.color-title {
    color: #2d3748;
}

.border-light {
    border: 1px solid #e2e8f0 !important;
}

.sticky-top {
    position: sticky;
    top: 24px;
    z-index: 10;
}

/* Estilos para el diseño de la imagen */
.month-icon-box {
    background: #f0f4ff;
    padding: 8px;
    border-radius: 8px;
}

.total-badge {
    background: #76e037;
}

/* El verde de tu imagen */

.transaction-list-container {
    border: 1px solid #e2e8f0 !important;
    background: white;
}

.transaction-item {
    transition: background-color 0.2s;
}

.date-section {
    min-width: 50px;
    color: #4a5568;
}

.notes-section {
    color: #718096;
    max-width: 300px;
}

.action-section {
    min-width: 100px;
}

.leading-tight {
    line-height: 1.1;
}
</style>