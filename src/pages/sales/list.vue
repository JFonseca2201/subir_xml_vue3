<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'

// Router & Composables
const router = useRouter()
const { showNotification } = useGlobalToast()

// Estado general
const loading = ref(false)
const sales = ref([])

// Formulario de búsqueda
const searchForm = ref({
    document_type: null,
    payment_status: null,
    start_date: null,
    end_date: null,
    search: null, // Búsqueda por nombre o cédula
})

// Paginación
const currentPage = ref(1)
const itemsPerPage = ref(15)
const totalItems = ref(0)
const totalPages = ref(0)

// Opciones para selects
const documentTypeOptions = [
    { title: 'Cotización', value: 'quote' },
    { title: 'Nota de Venta', value: 'sale_note' },
    { title: 'Factura', value: 'invoice' }
]

const paymentStatusOptions = [
    { title: 'Pagado', value: 'paid' },
    { title: 'Parcial', value: 'partial' },
    { title: 'Pendiente', value: 'pending' }
]

// Cargar datos
const loadSales = async () => {
    loading.value = true
    try {
        const params = {
            page: currentPage.value,
            ...searchForm.value
        }

        // Limpiar parámetros nulos o vacíos
        Object.keys(params).forEach(key => {
            if (params[key] === null || params[key] === '') {
                delete params[key]
            }
        })

        const response = await $api('sales', { params })

        // Extraer el arreglo real sin importar la estructura de la respuesta
        const extractArray = (res, key) => {
            if (Array.isArray(res)) return res
            if (res?.[key] && Array.isArray(res[key])) return res[key]
            if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
            if (res?.data && Array.isArray(res.data)) return res.data
            if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data
            return []
        }

        sales.value = extractArray(response, 'sales')
        const paginator = response?.data?.data ? response.data : (response?.data || response?.sales || response || {})
        totalItems.value = paginator.total || sales.value.length || 0
        totalPages.value = paginator.last_page || 1
    } catch (error) {
        console.error('Error al cargar ventas:', error)
        showNotification('Error al cargar el historial de ventas', 'error')
    } finally {
        loading.value = false
    }
}

// Limpiar Búsqueda
const clearSearch = () => {
    searchForm.value = {
        document_type: null,
        payment_status: null,
        start_date: null,
        end_date: null,
        search: null
    }
    currentPage.value = 1
    loadSales()
}

// Helpers de Formateo
const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value || 0)
}

const formatDate = (dateString) => {
    if (!dateString) return '-'
    // Previene el desfase de zona horaria si viene en YYYY-MM-DD
    const [year, month, day] = dateString.split('T')[0].split('-')
    return `${day}/${month}/${year}`
}

const getClientName = (client) => {
    if (!client) return 'Consumidor Final'
    return client.full_name || client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Cliente Desconocido'
}

// Helpers visuales (Chips)
const getDocumentTypeInfo = (type) => {
    const map = {
        quote: { color: 'info', text: 'Cotización' },
        sale_note: { color: 'primary', text: 'Nota Venta' },
        invoice: { color: 'deep-purple', text: 'Factura' }
    }
    return map[type] || { color: 'grey', text: type }
}

const getPaymentStatusInfo = (status) => {
    const map = {
        paid: { color: 'success', text: 'Pagado' },
        partial: { color: 'warning', text: 'Parcial' },
        pending: { color: 'error', text: 'Pendiente' }
    }
    return map[status] || { color: 'grey', text: status }
}

const getStatusInfo = (status) => {
    const map = {
        completed: { color: 'success', text: 'Completada', icon: 'ri-check-line' },
        pending: { color: 'warning', text: 'Pendiente', icon: 'ri-time-line' },
        canceled: { color: 'error', text: 'Anulada', icon: 'ri-close-circle-line' }
    }
    return map[status] || { color: 'grey', text: status, icon: 'ri-question-line' }
}

// Acciones
const viewSale = (sale) => {
    router.push(`/sales/view/${sale.id}`)
}

const editSale = (sale) => {
    if (sale.status === 'canceled') {
        showNotification('No se puede editar una venta anulada', 'warning')
        return
    }
    router.push(`/sales/edit/${sale.id}`)
}

const generatePDF = async () => {
    try {
        const params = {
            ...searchForm.value
        }
        
        // Limpiar parámetros nulos o vacíos
        Object.keys(params).forEach(key => {
            if (params[key] === null || params[key] === '') {
                delete params[key]
            }
        })

        const response = await $api('sales/pdf', {
            method: 'POST',
            body: params,
            responseType: 'blob'
        })

        // Crear un blob y descargar el PDF
        const blob = new Blob([response], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ventas_${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        showNotification('Reporte PDF generado exitosamente', 'success')
    } catch (error) {
        console.error('Error al generar PDF:', error)
        showNotification('Error al generar el reporte PDF', 'error')
    }
}

const generateSinglePDF = async (sale) => {
    try {
        const response = await $api(`sales/${sale.id}/pdf`, {
            method: 'GET',
            responseType: 'blob'
        })

        // Crear un blob y descargar el PDF
        const blob = new Blob([response], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${sale.document_type}_${sale.document_number}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        showNotification('PDF generado exitosamente', 'success')
    } catch (error) {
        console.error('Error al generar PDF:', error)
        showNotification('Error al generar el PDF', 'error')
    }
}

const cancelSale = async (sale) => {
    if (sale.status === 'canceled') return

    if (!window.confirm(`¿Está seguro de anular el documento ${sale.document_number}? Esta acción revertirá el stock y anulará la transacción.`)) {
        return
    }

    try {
        const response = await $api(`sales/${sale.id}`, {
            method: 'DELETE'
        })

        if (response?.success) {
            showNotification('Venta anulada correctamente', 'success')
            loadSales()
        }
    } catch (error) {
        console.error('Error al anular venta:', error)
        const errMsg = error.response?._data?.message || 'Error al procesar la anulación'
        showNotification(errMsg, 'error')
    }
}

// Watchers
watch(currentPage, () => {
    loadSales()
})

// Montaje
onMounted(() => {
    loadSales()
})
</script>

<template>
    <div class="pa-4 pa-sm-6">
        <VCard class="pa-6 pa-sm-8 rounded-lg elevation-4 max-w-1200 mx-auto">
            <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4">
                <div>
                    <h1 class="text-h4 font-weight-bold mb-1">Ventas y Cotizaciones</h1>
                    <p class="text-medium-emphasis mb-0">Historial de transacciones y servicios</p>
                </div>
                <div class="d-flex gap-3">
                    <VBtn color="success" prepend-icon="ri-file-pdf-line" @click="generatePDF" size="large">
                        Generar PDF
                    </VBtn>
                    <VBtn color="primary" prepend-icon="ri-add-line" to="/sales/add" size="large">
                        Nueva Venta
                    </VBtn>
                </div>
            </div>

            <VDivider class="mb-6" />

            <VForm @submit.prevent="() => { currentPage = 1; loadSales() }">
                <VRow class="mb-2">
                    <VCol cols="12" sm="6" md="3">
                        <VTextField v-model="searchForm.search" label="Buscar por nombre o cédula"
                            placeholder="Nombre o cédula del cliente..."
                            prepend-inner-icon="ri-search-line" variant="outlined" density="comfortable"
                            hide-details="auto" clearable />
                    </VCol>

                    <VCol cols="12" sm="6" md="2">
                        <VSelect v-model="searchForm.document_type" :items="documentTypeOptions" item-title="title"
                            item-value="value" label="Tipo" placeholder="Todos"
                            prepend-inner-icon="ri-file-list-3-line" variant="outlined" density="comfortable"
                            hide-details="auto" clearable />
                    </VCol>

                    <VCol cols="12" sm="6" md="2">
                        <VSelect v-model="searchForm.payment_status" :items="paymentStatusOptions" item-title="title"
                            item-value="value" label="Estado Pago" placeholder="Todos"
                            prepend-inner-icon="ri-money-dollar-circle-line" variant="outlined" density="comfortable"
                            hide-details="auto" clearable />
                    </VCol>

                    <VCol cols="12" sm="6" md="2">
                        <VTextField v-model="searchForm.start_date" type="date" label="Desde"
                            prepend-inner-icon="ri-calendar-line" variant="outlined" density="comfortable"
                            hide-details="auto" clearable />
                    </VCol>

                    <VCol cols="12" sm="6" md="2">
                        <VTextField v-model="searchForm.end_date" type="date" label="Hasta"
                            prepend-inner-icon="ri-calendar-event-line" variant="outlined" density="comfortable"
                            hide-details="auto" clearable />
                    </VCol>

                    <VCol cols="12" class="d-flex justify-end gap-3 mt-2">
                        <VBtn variant="tonal" color="secondary" prepend-icon="ri-refresh-line" @click="clearSearch">
                            Limpiar
                        </VBtn>
                        <VBtn type="submit" color="primary" prepend-icon="ri-search-line" :loading="loading">
                            Buscar
                        </VBtn>
                    </VCol>
                </VRow>
            </VForm>

            <VDivider class="mb-4" />

            <VTable class="text-no-wrap">
                <thead>
                    <tr>
                        <th class="font-weight-bold">Documento</th>
                        <th class="font-weight-bold">Fecha Servicio</th>
                        <th class="font-weight-bold">Cliente</th>
                        <th class="font-weight-bold">Vehículo</th>
                        <th class="font-weight-bold text-right">Total</th>
                        <th class="font-weight-bold text-center">Cobro</th>
                        <th class="font-weight-bold text-center">Estado</th>
                        <th class="font-weight-bold text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody v-if="loading">
                    <tr>
                        <td colspan="8" class="text-center pa-6">
                            <VProgressCircular indeterminate color="primary" size="40" />
                            <div class="mt-2 text-medium-emphasis">Cargando registros...</div>
                        </td>
                    </tr>
                </tbody>
                <tbody v-else-if="!sales || sales.length === 0">
                    <tr>
                        <td colspan="8" class="text-center pa-8 text-medium-emphasis">
                            <VIcon size="48" class="mb-3" color="grey-lighten-1">ri-file-text-line</VIcon>
                            <div class="text-h6">No se encontraron ventas</div>
                            <div class="text-body-2">Intenta ajustar los filtros de búsqueda</div>
                        </td>
                    </tr>
                </tbody>
                <tbody v-else style="text-transform: uppercase;">
                    <tr v-for="(item, index) in sales" :key="item?.id ? `sale-${item.id}` : `sale-idx-${index}`"
                        class="align-middle">
                        <td>
                            <div class="d-flex flex-column" v-if="item">
                                <VChip :color="getDocumentTypeInfo(item.document_type)?.color || 'grey'" size="x-small"
                                    class="mb-1 align-self-start font-weight-bold" variant="flat">
                                    {{ getDocumentTypeInfo(item.document_type)?.text || item.document_type }}
                                </VChip>
                                <span class="font-weight-medium">{{ item.document_number }}</span>
                            </div>
                        </td>

                        <td>
                            <div class="d-flex align-center" v-if="item">
                                <VIcon size="16" class="mr-2 text-medium-emphasis">ri-calendar-todo-line</VIcon>
                                <span>{{ formatDate(item.service_date) }}</span>
                            </div>
                        </td>

                        <td>
                            <div v-if="item">
                                <div class="font-weight-medium">{{ getClientName(item.client) }}</div>
                                <div v-if="item.client?.n_document" class="text-caption text-medium-emphasis">
                                    Doc: {{ item.client.n_document }}
                                </div>
                            </div>
                        </td>

                        <td>
                            <template v-if="item?.vehicle">
                                <VChip size="small" variant="outlined" color="primary" class="font-weight-bold">
                                    {{ item.vehicle.license_plate }}
                                </VChip>
                            </template>
                            <span v-else class="text-medium-emphasis text-caption">-</span>
                        </td>

                        <td class="text-right">
                            <div v-if="item" class="font-weight-bold text-body-1"
                                :class="item.status === 'canceled' ? 'text-decoration-line-through text-medium-emphasis' : ''">
                                {{ formatCurrency(item.total) }}
                            </div>
                        </td>

                        <td class="text-center">
                            <VChip v-if="item" :color="getPaymentStatusInfo(item.payment_status)?.color || 'grey'"
                                variant="tonal" size="small">
                                {{ getPaymentStatusInfo(item.payment_status)?.text || item.payment_status }}
                            </VChip>
                        </td>

                        <td class="text-center">
                            <VChip v-if="item" :color="getStatusInfo(item.status)?.color || 'grey'" variant="text"
                                size="small">
                                <VIcon start :icon="getStatusInfo(item.status)?.icon || 'ri-question-line'" />
                                {{ getStatusInfo(item.status)?.text || item.status }}
                            </VChip>
                        </td>

                        <td>
                            <div class="d-flex justify-center gap-1" v-if="item">

                                <VBtn icon="ri-file-pdf-line" variant="text" size="small" color="success"
                                    title="Generar PDF" @click="generateSinglePDF(item)" />

                                <VBtn icon="ri-eye-line" variant="text" size="small" color="info" title="Ver Detalle"
                                    @click="viewSale(item)" />

                                <VBtn icon="ri-edit-line" variant="text" size="small" color="warning"
                                    title="Editar (Info Operativa)" :disabled="item.status === 'canceled'"
                                    @click="editSale(item)" />

                                <VBtn icon="ri-close-circle-line" variant="text" size="small" color="error"
                                    title="Anular" :disabled="item.status === 'canceled'" @click="cancelSale(item)" />

                            </div>
                        </td>
                    </tr>
                </tbody>
            </VTable>

            <VDivider class="mt-2" />
            <div class="d-flex justify-center pa-4">
                <div class="d-flex flex-column align-center gap-2">
                    <div class="text-caption text-medium-emphasis">
                        Mostrando página {{ currentPage }} de {{ totalPages }} ({{ totalItems }} registros en total)
                    </div>
                    <VPagination v-model="currentPage" :length="totalPages" rounded="circle" :total-visible="7"
                        :disabled="loading" />
                </div>
            </div>
        </VCard>
    </div>
</template>