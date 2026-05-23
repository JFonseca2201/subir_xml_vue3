<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { getBrandNameById } from '@/data/vehicleBrands.js'

const router = useRouter()
const route = useRoute()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const formRef = ref(null)
const isLoading = ref(false)
const showValidationError = ref(false)
const validationErrorMessage = ref('')

// Opciones
const documentTypes = [
    { title: 'Cotización', value: 'quote' },
    { title: 'Nota de Venta', value: 'sale_note' },
    { title: 'Factura', value: 'invoice' }
]

const paymentStatuses = [
    { title: 'Pagado', value: 'paid' },
    { title: 'Parcial', value: 'partial' },
    { title: 'Pendiente', value: 'pending' }
]

const paymentMethods = [
    { title: 'Efectivo', value: 'Efectivo' },
    { title: 'Transferencia', value: 'Transferencia' },
    { title: 'Tarjeta de Crédito', value: 'Tarjeta de Crédito' },
    { title: 'Tarjeta de Débito', value: 'Tarjeta de Débito' }
]

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const accounts = ref([])

// Estado del formulario
const sale = ref({
    document_type: '',
    document_number: '',
    client_id: null,
    vehicle_id: null,
    mileage: null,
    service_date: '',
    payment_status: '',
    is_credited: false,
    payment_method: 'Efectivo',
    observations: '',
    subtotal: 0,
    tax_amount: 0,
    total: 0,
    status: '',
    client: null,
    vehicle: null,
    items: []
})

// Pagos distribuidos
const paymentDistributions = ref([])

// Buscador de productos
const searchProduct = ref(null)

// Reglas de validación
const requiredRule = v => !!v || 'Campo obligatorio'

// Helpers
const getClientName = (client) => {
    if (!client) return 'Consumidor Final'
    return client.full_name || client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Cliente Desconocido'
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value || 0)
}

const formatDate = (dateString) => {
    if (!dateString) return '-'
    const [year, month, day] = dateString.split('T')[0].split('-')
    return `${day}/${month}/${year}`
}

// Watch para cambiar estado de pago cuando es crédito
const onCreditChange = () => {
    if (sale.value.is_credited) {
        sale.value.payment_status = 'pending'
    } else {
        sale.value.payment_status = 'paid'
    }
}

// Watch para regenerar número cuando cambia el tipo de documento
const onDocumentTypeChange = () => {
    // Solo permitir cambiar de cotización a venta, no viceversa
    if (sale.value.document_type !== 'quote' && sale.value.document_type !== '') {
        // Si ya es una venta (nota de venta o factura), no permitir cambiar a cotización
        showNotification('Solo las cotizaciones pueden convertirse a ventas', 'warning')
        return
    }
}

// Inicializar con un pago distribuido cuando hay items
const initializePaymentDistribution = () => {
    if (paymentDistributions.value.length === 0 && sale.value.items.length > 0) {
        paymentDistributions.value.push({
            account_id: 1,
            amount: 0,
            payment_method: 'Efectivo'
        })
    }
}

// Gestión del detalle (items)
const removeItem = (index) => {
    sale.value.items.splice(index, 1)
}

// Gestión de pagos distribuidos
const addPaymentDistribution = () => {
    const newPayment = {
        account_id: null,
        amount: 0,
        payment_method: 'Efectivo'
    }
    paymentDistributions.value.push(newPayment)
    if (newPayment.payment_method === 'Efectivo') {
        newPayment.account_id = 1
    }
}

const removePaymentDistribution = (index) => {
    if (paymentDistributions.value.length > 1) {
        paymentDistributions.value.splice(index, 1)
    }
}

// Asignar cuenta automáticamente según método de pago
const onPaymentMethodChange = (dist, newMethod) => {
    if (newMethod === 'Efectivo') {
        const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))
        dist.account_id = cajaChica ? cajaChica.id : 1
    } else if (newMethod === 'Transferencia') {
        dist.account_id = null
    }
}

const initializePaymentAccount = (dist) => {
    if (dist.payment_method === 'Efectivo') {
        const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))
        dist.account_id = cajaChica ? cajaChica.id : 1
    }
}

const totalDistributed = computed(() => {
    return paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0)
})

const remainingAmount = computed(() => {
    return total.value - totalDistributed.value
})

const getPaymentIcon = (method) => {
    const icons = {
        'Efectivo': 'ri-money-dollar-circle-line',
        'Transferencia': 'ri-bank-transfer-line',
        'Tarjeta de Crédito': 'ri-bank-card-line',
        'Tarjeta de Débito': 'ri-bank-card-2-line'
    }
    return icons[method] || 'ri-money-dollar-circle-line'
}

const onProductSelected = (product) => {
    if (product && typeof product === 'object') {
        const existingItem = sale.value.items.find(i => i.product_id === product.id)
        if (existingItem) {
            existingItem.quantity++
        } else {
            sale.value.items.push({
                product_id: product.id,
                description: product.description || product.name || '',
                quantity: 1,
                price: product.price_sale || product.price || 0,
                discount: 0
            })
        }
        initializePaymentDistribution()
        searchProduct.value = null
    }
}

const productFilter = (value, query, item) => {
    if (query == null || query === '') return true
    const searchText = item?.raw?.searchText || ''
    return searchText.includes(query.toLowerCase())
}

const clientFilter = (value, query, item) => {
    if (query == null || query === '') return true
    const client = item?.raw
    if (!client) return false
    const searchText = `${getClientName(client)} ${client.n_document || ''}`.toLowerCase()
    return searchText.includes(query.toLowerCase())
}

// Cálculos
const TAX_RATE = 0.15

const grossSubtotal = computed(() => {
    return sale.value.items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
})

const totalDiscount = computed(() => {
    return sale.value.items.reduce((sum, item) => sum + (Number(item.discount) || 0), 0)
})

const subtotal = computed(() => {
    return grossSubtotal.value - totalDiscount.value
})

const taxAmount = computed(() => {
    if (sale.value.document_type === 'invoice') {
        return subtotal.value * TAX_RATE
    }
    return 0
})

const total = computed(() => {
    return subtotal.value + taxAmount.value
})

// Computed para verificar si es cotización
const isQuote = computed(() => {
    return sale.value.document_type === 'quote'
})

// Computed para verificar si se puede convertir a venta
const canConvertToSale = computed(() => {
    return isQuote.value && sale.value.status !== 'canceled' && sale.value.items.length > 0
})

// Computed para obtener el cliente seleccionado
const selectedClient = computed(() => {
    if (!sale.value.client_id) return null
    // Buscar en la lista de clientes cargados
    return clients.value.find(c => c.id === sale.value.client_id) || sale.value.client
})

// Computed para obtener el vehículo seleccionado
const selectedVehicle = computed(() => {
    if (!sale.value.vehicle_id) return null
    return sale.value.vehicle
})

// Cargar datos iniciales
const loadSaleData = async () => {
    isLoading.value = true
    try {
        const [saleRes, clientsRes, vehiclesRes, productsRes, accountsRes] = await Promise.all([
            $api(`sales/${route.params.id}`),
            $api('clients', { params: { per_page: 1000 } }),
            $api('vehicles', { params: { per_page: 1000 } }),
            $api('products', { params: { per_page: 1000 } }),
            $api('accounts', { params: { per_page: 1000 } })
        ])

        const extractArray = (res, key) => {
            if (Array.isArray(res)) return res
            if (res?.[key] && Array.isArray(res[key])) return res[key]
            if (res?.[key]?.data && Array.isArray(res[key].data)) return res[key].data
            if (res?.data && Array.isArray(res.data)) return res.data
            if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data
            return []
        }

        const saleData = saleRes.data || saleRes
        sale.value = {
            document_type: saleData.document_type,
            document_number: saleData.document_number,
            client_id: saleData.client_id,
            vehicle_id: saleData.vehicle_id,
            mileage: saleData.mileage,
            service_date: saleData.service_date ? saleData.service_date.split('T')[0] : '',
            payment_status: saleData.payment_status,
            is_credited: saleData.is_credited,
            payment_method: saleData.payment_method,
            observations: saleData.observations || '',
            subtotal: saleData.subtotal,
            tax_amount: saleData.tax_amount,
            total: saleData.total,
            status: saleData.status,
            client: saleData.client,
            vehicle: saleData.vehicle,
            items: (saleData.details || []).map(d => ({
                id: d.id,
                product_id: d.product_id,
                description: d.description,
                quantity: d.quantity,
                price: d.price,
                discount: d.discount
            }))
        }

        clients.value = extractArray(clientsRes, 'clients')
        const rawVehicles = extractArray(vehiclesRes, 'vehicles')
        // Agregar campo de búsqueda combinado para vehículos
        vehicles.value = rawVehicles.map(v => {
            const brandId = typeof v.brand === 'object' ? v.brand.id : v.brand
            const brandName = brandId ? getBrandNameById(brandId) : ''
            const parts = [v.license_plate, brandName, v.model].filter(p => p !== undefined && p !== null)
            const displayTitle = parts.length > 0 ? parts.join(' - ') : v.license_plate || 'Vehículo'
            return {
                ...v,
                brand: brandId,
                displayTitle
            }
        })
        const rawProducts = extractArray(productsRes, 'products')
        products.value = rawProducts.map(p => ({
            ...p,
            searchText: `${p.name || ''} ${p.code || ''} ${p.description || ''}`.toLowerCase(),
            displayTitle: p.name || p.description || ''
        }))
        accounts.value = extractArray(accountsRes, 'accounts')

        // Si no es cotización, cargar los pagos distribuidos existentes
        if (sale.value.document_type !== 'quote' && saleData.finance_record) {
            const financeRecord = saleData.finance_record

            if (financeRecord && financeRecord.payment_distributions) {
                paymentDistributions.value = financeRecord.payment_distributions.map(pd => ({
                    account_id: pd.account_id,
                    amount: pd.amount,
                    payment_method: pd.payment_method
                }))
            } else {
                // Si no hay pagos distribuidos, inicializar con uno vacío
                initializePaymentDistribution()
            }
        } else if (sale.value.document_type !== 'quote' && sale.value.items.length > 0) {
            // Inicializar pagos distribuidos si no es cotización
            initializePaymentDistribution()
        }

    } catch (error) {
        console.error('Error al cargar datos:', error)
        showNotification('Error al cargar los datos de la venta', 'error')
        router.push('/sales/list')
    } finally {
        isLoading.value = false
    }
}

// Envío del formulario
const submitForm = async () => {
    showValidationError.value = false
    validationErrorMessage.value = ''

    if (formRef.value) {
        const { valid } = await formRef.value.validate()
        if (!valid) {
            showValidationError.value = true
            validationErrorMessage.value = 'Por favor, complete todos los campos obligatorios marcados con *'
            return
        }
    }

    // Validar que haya al menos un producto/servicio
    if (sale.value.items.length === 0) {
        showValidationError.value = true
        validationErrorMessage.value = 'Debe agregar al menos un producto o servicio'
        return
    }

    // Validar stock solo si no es cotización
    if (sale.value.document_type !== 'quote') {
        for (const item of sale.value.items) {
            if (item.product_id) {
                const product = products.value.find(p => p.id === item.product_id)
                if (product && product.stock < item.quantity) {
                    showValidationError.value = true
                    validationErrorMessage.value = `Stock insuficiente para ${product.description}. Stock disponible: ${product.stock}, Solicitado: ${item.quantity}`
                    return
                }
            }
        }
    }

    // Validar descuentos máximos
    for (const item of sale.value.items) {
        if (item.product_id) {
            const product = products.value.find(p => p.id === item.product_id)
            if (product && product.max_discount !== null && product.max_discount !== undefined) {
                const maxDiscountAmount = (item.quantity * item.price) * (product.max_discount / 100)
                if (item.discount > maxDiscountAmount) {
                    showValidationError.value = true
                    validationErrorMessage.value = `Descuento excede el máximo permitido para ${product.description}. Máximo: ${maxDiscountAmount.toFixed(2)}, Ingresado: ${item.discount.toFixed(2)}`
                    return
                }
            }
        }
    }

    // Validar pagos distribuidos solo si no es cotización
    if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
        const totalDist = paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0)
        if (Math.abs(totalDist - total.value) > 0.01) {
            showValidationError.value = true
            validationErrorMessage.value = 'La suma de los pagos debe ser igual al total'
            return
        }
    }

    // Si es cotización y se va a convertir a venta, confirmar
    if (isQuote.value && sale.value.document_type !== 'quote') {
        if (!window.confirm('¿Está seguro de convertir esta cotización en una venta? Esta acción restará el stock y procesará los pagos.')) {
            return
        }
    }

    loader.start()

    try {
        const payload = {
            ...sale.value,
            subtotal: subtotal.value,
            tax_amount: taxAmount.value,
            total: total.value,
            items: sale.value.items
        }

        // Enviar pagos distribuidos solo si no es cotización
        if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
            payload.payment_distributions = paymentDistributions.value
        }

        const response = await $api(`sales/${route.params.id}`, {
            method: 'PUT',
            body: payload
        })

        if (response?.success || response?.status === 200) {
            showNotification('Venta actualizada correctamente', 'success')
            router.push('/sales/list')
        } else {
            showNotification(response.message || 'Error al actualizar', 'error')
        }
    } catch (error) {
        console.error('Error enviando formulario', error)
        const errMsg = error.response?._data?.message || 'Error al procesar la solicitud'
        showNotification(errMsg, 'error')
    } finally {
        loader.stop()
    }
}

onMounted(() => {
    loadSaleData()
})
</script>

<template>
    <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
        <VProgressCircular indeterminate size="48" width="4" color="primary" />
    </VOverlay>

    <div class="pa-4 pa-sm-6">
        <VCard class="pa-6 pa-sm-8 rounded-lg elevation-4 max-w-1200 mx-auto">
            <!-- Cabecera -->
            <div
                class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-6 gap-4 border-b pb-4">
                <div>
                    <div class="d-flex align-center">
                        <VAvatar color="white" size="48" class="mr-3">
                            <VIcon icon="ri-edit-line" size="32" color="primary" />
                        </VAvatar>
                        <h1 class="text-h4 font-weight-bold mb-1"> Editar Venta</h1>
                    </div>
                    <p class="text-medium-emphasis mb-0">Edita la información de la venta o cotización</p>
                </div>
                <VBtn color="primary" variant="elevated" prepend-icon="ri-arrow-left-line" to="/sales/list">
                    Volver al Listado
                </VBtn>
            </div>

            <VForm ref="formRef" @submit.prevent="submitForm">
                <!-- Selección de Tipo de Documento con Botones Grandes -->
                <div v-if="!isLoading && sale.document_type" class="mb-6">
                    <h2 class="text-h5 font-weight-bold mb-4">Selecciona el Tipo de Documento</h2>
                    <div class="d-flex gap-4 flex-wrap">
                        <!-- Cotización: Solo visible si es cotización original -->
                        <VCard
                            v-if="sale.document_type === 'quote'"
                            :class="[
                                sale.document_type === 'quote' ? 'border-primary border-2 bg-primary-lighten-5' : 'border-opacity-25',
                                sale.status === 'canceled' ? 'cursor-not-allowed opacity-50' : '',
                                'flex-1 min-w-200 cursor-pointer rounded-xl elevation-2 hover:elevation-4 transition-all'
                            ]"
                            variant="outlined"
                            @click="sale.status !== 'canceled' && (sale.document_type = 'quote'); onDocumentTypeChange()"
                        >
                            <VCardText class="pa-6 text-center">
                                <VAvatar :color="sale.document_type === 'quote' ? 'primary' : 'grey-lighten-2'" size="64" class="mb-3">
                                    <VIcon icon="ri-file-text-line" size="36" :color="sale.document_type === 'quote' ? 'white' : 'grey'" />
                                </VAvatar>
                                <div class="text-h6 font-weight-bold mb-1" :class="sale.document_type === 'quote' ? 'text-primary' : 'text-grey'">
                                    Cotización
                                </div>
                                <div class="text-caption text-medium-emphasis">
                                    Documento de presupuesto
                                </div>
                            </VCardText>
                        </VCard>

                        <!-- Nota de Venta: Solo visible si es nota de venta -->
                        <VCard
                            v-if="sale.document_type === 'sale_note'"
                            :class="[
                                sale.document_type === 'sale_note' ? 'border-success border-2 bg-success-lighten-5' : 'border-opacity-25',
                                sale.status === 'canceled' ? 'cursor-not-allowed opacity-50' : '',
                                'cursor-not-allowed opacity-75',
                                'flex-1 min-w-200 cursor-pointer rounded-xl elevation-2 hover:elevation-4 transition-all'
                            ]"
                            variant="outlined"
                        >
                            <VCardText class="pa-6 text-center">
                                <VAvatar :color="sale.document_type === 'sale_note' ? 'success' : 'grey-lighten-2'" size="64" class="mb-3">
                                    <VIcon icon="ri-file-list-3-line" size="36" :color="sale.document_type === 'sale_note' ? 'white' : 'grey'" />
                                </VAvatar>
                                <div class="text-h6 font-weight-bold mb-1" :class="sale.document_type === 'sale_note' ? 'text-success' : 'text-grey'">
                                    Nota de Venta
                                </div>
                                <div class="text-caption text-medium-emphasis">
                                    Documento de venta
                                </div>
                            </VCardText>
                        </VCard>

                        <!-- Factura: Solo visible si es factura -->
                        <VCard
                            v-if="sale.document_type === 'invoice'"
                            :class="[
                                sale.document_type === 'invoice' ? 'border-purple border-2 bg-purple-lighten-5' : 'border-opacity-25',
                                sale.status === 'canceled' ? 'cursor-not-allowed opacity-50' : '',
                                'cursor-not-allowed opacity-75',
                                'flex-1 min-w-200 cursor-pointer rounded-xl elevation-2 hover:elevation-4 transition-all'
                            ]"
                            variant="outlined"
                        >
                            <VCardText class="pa-6 text-center">
                                <VAvatar :color="sale.document_type === 'invoice' ? 'purple' : 'grey-lighten-2'" size="64" class="mb-3">
                                    <VIcon icon="ri-bill-line" size="36" :color="sale.document_type === 'invoice' ? 'white' : 'grey'" />
                                </VAvatar>
                                <div class="text-h6 font-weight-bold mb-1" :class="sale.document_type === 'invoice' ? 'text-purple' : 'text-grey'">
                                    Factura
                                </div>
                                <div class="text-caption text-medium-emphasis">
                                    Documento fiscal
                                </div>
                            </VCardText>
                        </VCard>
                    </div>
                </div>

                <!-- Datos Generales -->
                <div class="mb-6">
                    <VAlert color="info" variant="tonal" class="mb-4" border="start">
                        <div class="d-flex align-center">
                            <VIcon icon="ri-information-line" class="mr-2" />
                            <span class="text-body-2">Los campos marcados con <strong class="text-error">*</strong> son obligatorios</span>
                        </div>
                    </VAlert>
                    <VRow>
                        <VCol cols="12" md="4">
                            <VTextField v-model="sale.document_number" label="Número de Documento *"
                                :rules="[requiredRule]" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-hashtag" hide-details="auto" required readonly color="primary" />
                        </VCol>
                        <VCol cols="12" md="4">
                            <VTextField v-model="sale.service_date" label="Fecha de Servicio *" type="date"
                                :rules="[requiredRule]" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-calendar-line" hide-details="auto" required
                                :disabled="sale.status === 'canceled'" color="primary" />
                        </VCol>
                        <VCol cols="12" md="4">
                            <VAutocomplete v-model="sale.client_id" :items="clients" :item-title="getClientName"
                                item-value="id" label="Cliente *" :rules="[requiredRule]" variant="outlined"
                                density="comfortable" prepend-inner-icon="ri-user-line" hide-details="auto" required
                                placeholder="Buscar por nombre o documento" clearable color="primary"
                                :disabled="sale.status === 'canceled'" :custom-filter="clientFilter">
                                <template v-slot:item="{ props, item }">
                                    <VListItem v-bind="props" :title="getClientName(item.raw)"
                                        :subtitle="item.raw?.n_document" />
                                </template>
                            </VAutocomplete>
                        </VCol>
                        <VCol cols="12" md="4">
                            <VAutocomplete v-model="sale.vehicle_id" :items="vehicles" item-title="license_plate"
                                item-value="id" label="Vehículo (Opcional)" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-car-line" hide-details="auto" placeholder="Seleccionar vehículo"
                                clearable :disabled="sale.status === 'canceled'">
                                <template v-slot:item="{ props, item }">
                                    <VListItem v-bind="props" :title="item.raw.license_plate"
                                        :subtitle="`${item.raw.model || ''}`" />
                                </template>
                            </VAutocomplete>
                        </VCol>
                        <VCol cols="12" md="4">
                            <VTextField v-model="sale.mileage" label="Kilometraje (Opcional)" type="number"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-speed-up-line"
                                hide-details="auto" :disabled="sale.status === 'canceled'" />
                        </VCol>
                    </VRow>
                </div>

                <VDivider class="mb-6" />

                <!-- Información del Cliente y Vehículo en dos columnas -->
                <VRow>
                    <!-- Información del Cliente -->
                    <VCol cols="12" md="6" v-if="selectedClient">
                        <VCard variant="outlined" class="border-primary border-opacity-25 rounded-lg">
                            <VCardItem class="pa-3">
                                <div class="d-flex align-center gap-3">
                                    <VAvatar color="primary" variant="tonal" size="40">
                                        <VIcon icon="ri-user-line" size="24" />
                                    </VAvatar>
                                    <div class="flex-grow-1">
                                        <div class="text-subtitle-1 font-weight-bold text-truncate">{{
                                            selectedClient.n_document || '-' }}
                                        </div>
                                        <div class="d-flex align-center gap-2 text-caption text-medium-emphasis">
                                            <span class="d-flex align-center">
                                                <VIcon icon="ri-id-card-line" size="14" class="mr-1" /> {{
                                                    selectedClient.n_document ||
                                                    '-' }}
                                            </span>
                                            <span>•</span>
                                            <span class="d-flex align-center">
                                                <VIcon icon="ri-phone-line" size="14" class="mr-1" /> {{
                                                    selectedClient.phone || '-' }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </VCardItem>
                        </VCard>
                    </VCol>

                    <!-- Información del Vehículo -->
                    <VCol cols="12" md="6" v-if="selectedVehicle">
                        <VCard variant="outlined" class="border-success border-opacity-25 rounded-lg">
                            <VCardItem class="pa-3">
                                <div class="d-flex align-center gap-3">
                                    <VAvatar color="success" variant="tonal" size="40">
                                        <VIcon icon="ri-car-line" size="24" />
                                    </VAvatar>
                                    <div class="flex-grow-1">
                                        <div class="text-subtitle-1 font-weight-bold text-truncate">{{
                                            selectedVehicle.license_plate }}
                                        </div>
                                        <div class="d-flex align-center gap-2 text-caption text-medium-emphasis">
                                            <span class="d-flex align-center">
                                                <VIcon icon="ri-car-washing-line" size="14" class="mr-1" /> {{
                                                    selectedVehicle.model || '-' }}
                                            </span>
                                            <span>•</span>
                                            <span class="d-flex align-center">
                                                <VIcon icon="ri-calendar-event-line" size="14" class="mr-1" /> {{
                                                    selectedVehicle.year
                                                    || '-' }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </VCardItem>
                        </VCard>
                    </VCol>
                </VRow>

                <VDivider class="mb-6" />

                <!-- Detalle de Venta -->
                <div class="mb-6">
                    <VCard class="elevation-2 mb-4">
                        <VCardText class="pa-4">
                            <div
                                class="d-flex align-center pa-3 rounded-lg bg-gradient-to-r from-indigo to-indigo-darken-1">
                                <VAvatar color="white" size="48" class="mr-3">
                                    <VIcon icon="ri-shopping-cart-2-line" size="28" color="indigo" />
                                </VAvatar>
                                <div class="text-white">
                                    <h2 class="text-h5 font-weight-bold mb-1">Detalle de Venta</h2>
                                    <p class="text-body-2 opacity-90 mb-0">Productos y servicios del documento</p>
                                </div>
                            </div>
                        </VCardText>
                    </VCard>
                    <div class="mb-4">
                        <VAutocomplete v-model="searchProduct" :items="products" item-title="displayTitle" return-object
                            label="Buscar y agregar producto"
                            placeholder="Escribe para buscar por nombre, código o descripción..."
                            prepend-inner-icon="ri-search-line" variant="outlined" clearable
                            :custom-filter="productFilter" @update:model-value="onProductSelected"
                            :disabled="sale.status === 'canceled'">
                            <template v-slot:item="{ props, item }">
                                <VListItem v-bind="props" :title="item.raw.name || item.raw.description"
                                    :subtitle="item.raw.code ? `Código: ${item.raw.code}` : ''" />
                            </template>
                        </VAutocomplete>
                    </div>
                    <div class="border rounded-lg overflow-x-auto">
                        <VTable class="text-no-wrap">
                            <thead class="bg-grey-lighten-4">
                                <tr>
                                    <th style="min-width: 250px;">Producto / Servicio</th>
                                    <th style="width: 150px;">Cantidad</th>
                                    <th style="width: 150px;">Precio Unit.</th>
                                    <th style="width: 150px;">Descuento</th>
                                    <th style="width: 150px;" class="text-right">Total</th>
                                    <th style="width: 50px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, index) in sale.items" :key="index">
                                    <td class="pa-2">
                                        <VTextField v-model="item.description" placeholder="Descripción del item"
                                            variant="outlined" density="compact" hide-details="auto"
                                            :rules="[requiredRule]" :disabled="sale.status === 'canceled'" />
                                    </td>
                                    <td class="pa-2">
                                        <VTextField v-model.number="item.quantity" type="number" min="1"
                                            variant="outlined" density="compact" hide-details="auto"
                                            :rules="[requiredRule]" :disabled="sale.status === 'canceled'" />
                                    </td>
                                    <td class="pa-2">
                                        <VTextField v-model.number="item.price" type="number" min="0" step="0.01"
                                            variant="outlined" density="compact" hide-details="auto"
                                            :rules="[requiredRule]" prefix="$" :disabled="sale.status === 'canceled'" />
                                    </td>
                                    <td class="pa-2">
                                        <VTextField v-model.number="item.discount" type="number" min="0" step="0.01"
                                            variant="outlined" density="compact" hide-details="auto" prefix="$"
                                            :disabled="sale.status === 'canceled'" />
                                    </td>
                                    <td class="pa-2 text-right font-weight-bold text-body-1">
                                        ${{ ((item.quantity * item.price) - item.discount).toFixed(2) }}
                                    </td>
                                    <td class="pa-2 text-center">
                                        <VBtn icon="ri-delete-bin-line" variant="text" color="error" size="small"
                                            @click="removeItem(index)" :disabled="sale.status === 'canceled'" />
                                    </td>
                                </tr>
                                <tr v-if="sale.items.length === 0">
                                    <td colspan="6" class="text-center pa-4 text-medium-emphasis">No hay productos
                                        agregados. Utiliza el
                                        buscador de arriba.</td>
                                </tr>
                            </tbody>
                        </VTable>
                    </div>
                </div>

                <VDivider class="mb-6" />

                <!-- Totales y Pagos -->
                <VRow>
                    <VCol cols="12" md="6">
                        <!-- Mensaje informativo cuando no hay items -->
                        <VAlert v-if="sale.items.length === 0" type="info" variant="tonal" class="mb-4" border="start">
                            <template v-slot:prepend>
                                <VIcon icon="ri-information-line" />
                            </template>
                            <div class="text-body-2">
                                <strong>Agrega productos o servicios</strong> para ver las opciones de pago
                            </div>
                        </VAlert>

                        <template v-if="sale.document_type !== 'quote' && sale.items.length > 0">
                            <!-- Card principal de configuración de pago -->
                            <VCard class="mb-4 elevation-3 border-thin">
                                <VCardText class="pa-5">
                                    <!-- Header con gradiente -->
                                    <div
                                        class="d-flex align-center mb-5 pa-4 rounded-lg bg-gradient-to-r from-primary to-primary-darken-1">
                                        <VAvatar color="white" size="52" class="mr-4">
                                            <VIcon icon="ri-wallet-3-line" size="30" color="primary" />
                                        </VAvatar>
                                        <div class="text-white">
                                            <h2 class="text-h5 font-weight-bold mb-1">Forma de Pago</h2>
                                            <p class="text-body-2 opacity-90 mb-0">Configura cómo recibirás el pago de
                                                ${{ total.toFixed(2) }}</p>
                                        </div>
                                    </div>

                                    <!-- Estado de pago -->
                                    <div class="mb-4">
                                        <label class="text-subtitle-2 font-weight-medium mb-2 d-block text-primary">
                                            <VIcon icon="ri-money-dollar-circle-line" size="18" class="mr-1" />
                                            Estado del pago
                                        </label>
                                        <VSelect v-model="sale.payment_status" :items="paymentStatuses"
                                            item-title="title" item-value="value" :rules="[requiredRule]"
                                            variant="outlined" density="comfortable" prepend-inner-icon="ri-flag-line"
                                            hide-details="auto" bg-color="grey-lighten-5" rounded="lg"
                                            :disabled="sale.status === 'canceled'" />
                                    </div>

                                    <!-- Opción de crédito -->
                                    <div class="mb-4">
                                        <VCard variant="outlined"
                                            class="pa-3 rounded-lg cursor-pointer hover-bg-grey-lighten-4"
                                            :class="sale.is_credited ? 'border-primary bg-primary-lighten-5' : ''"
                                            @click="onCreditChange" :disabled="sale.status === 'canceled'">
                                            <div class="d-flex align-center">
                                                <VIcon
                                                    :icon="sale.is_credited ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                                                    :color="sale.is_credited ? 'primary' : 'grey'" size="24"
                                                    class="mr-2" />
                                                <div>
                                                    <div class="text-body-2 font-weight-medium">Venta a crédito</div>
                                                    <div class="text-caption text-medium-emphasis">Pago diferido</div>
                                                </div>
                                            </div>
                                        </VCard>
                                    </div>
                                </VCardText>
                            </VCard>

                            <!-- Pagos distribuidos -->
                            <VCard variant="outlined" class="border-primary border-opacity-50 elevation-2">
                                <VCardText class="pa-4">
                                    <div class="d-flex justify-space-between align-center mb-4">
                                        <div class="d-flex align-center">
                                            <VAvatar color="success" size="40" class="mr-3 elevation-2">
                                                <VIcon icon="ri-spreadsheet-line" size="24" />
                                            </VAvatar>
                                            <div>
                                                <h3 class="text-subtitle-1 font-weight-bold mb-0">Pagos</h3>
                                                <p class="text-caption text-medium-emphasis mb-0">Total: ${{
                                                    total.toFixed(2) }} - Distribuido: ${{ totalDistributed.toFixed(2)
                                                    }}</p>
                                            </div>
                                        </div>
                                        <VBtn color="primary" variant="elevated" prepend-icon="ri-add-circle-line"
                                            @click="addPaymentDistribution" size="small" class="elevation-2"
                                            :disabled="sale.status === 'canceled'">
                                            Agregar Pago
                                        </VBtn>
                                    </div>

                                    <!-- Tabla de pagos -->
                                    <div class="border rounded-lg overflow-hidden">
                                        <VTable class="text-no-wrap">
                                            <thead class="bg-grey-lighten-4">
                                                <tr>
                                                    <th style="width: 50px;">#</th>
                                                    <th style="width: 200px;">Forma de Pago</th>
                                                    <th style="width: 200px;">Cuenta</th>
                                                    <th style="width: 150px;">Monto</th>
                                                    <th style="width: 50px;"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr v-for="(dist, index) in paymentDistributions" :key="index">
                                                    <td class="pa-2 text-center font-weight-medium">{{ index + 1 }}</td>
                                                    <td class="pa-2">
                                                        <VSelect v-model="dist.payment_method" :items="paymentMethods"
                                                            item-title="title" item-value="value" label="Forma de pago"
                                                            variant="outlined" density="compact" hide-details="auto"
                                                            :rules="[requiredRule]" bg-color="white"
                                                            prepend-inner-icon="ri-secure-payment-line"
                                                            @update:model-value="(val) => onPaymentMethodChange(dist, val)"
                                                            :disabled="sale.status === 'canceled'" />
                                                    </td>
                                                    <td class="pa-2">
                                                        <VSelect v-if="dist.payment_method === 'Transferencia'"
                                                            v-model="dist.account_id" :items="accounts"
                                                            item-title="name" item-value="id" label="Cuenta bancaria"
                                                            variant="outlined" density="compact" hide-details="auto"
                                                            :rules="[requiredRule]" bg-color="white"
                                                            prepend-inner-icon="ri-bank-line"
                                                            :disabled="sale.status === 'canceled'" />
                                                        <VTextField v-else
                                                            :value="dist.payment_method === 'Efectivo' ? 'Caja Chica' : ''"
                                                            label="Cuenta" variant="outlined" density="compact"
                                                            hide-details="auto" bg-color="grey-lighten-4" readonly
                                                            prepend-inner-icon="ri-bank-line"
                                                            :disabled="sale.status === 'canceled'" />
                                                        <input type="hidden" v-if="dist.payment_method === 'Efectivo'"
                                                            v-model="dist.account_id" />
                                                    </td>
                                                    <td class="pa-2">
                                                        <VTextField v-model.number="dist.amount" type="number" min="0"
                                                            step="0.01" label="Monto" variant="outlined"
                                                            density="compact" hide-details="auto"
                                                            :rules="[requiredRule]" prefix="$" bg-color="white"
                                                            prepend-inner-icon="ri-money-dollar-circle-line"
                                                            :disabled="sale.status === 'canceled'" />
                                                    </td>
                                                    <td class="pa-2 text-center">
                                                        <VBtn icon="ri-delete-bin-line" variant="text" color="error"
                                                            size="small" @click="removePaymentDistribution(index)"
                                                            :disabled="paymentDistributions.length === 1 || sale.status === 'canceled'" />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </VTable>
                                    </div>

                                    <!-- Resumen de pagos -->
                                    <VCard v-if="paymentDistributions.length > 0" variant="tonal"
                                        class="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 elevation-2">
                                        <VCardText class="pa-4">
                                            <div class="d-flex flex-column gap-3">
                                                <div class="d-flex justify-space-between align-center">
                                                    <span class="text-body-2 font-weight-medium">Total
                                                        distribuido:</span>
                                                    <VChip color="primary" size="small" variant="elevated"
                                                        class="elevation-1">
                                                        ${{ totalDistributed.toFixed(2) }}
                                                    </VChip>
                                                </div>
                                                <VDivider />
                                                <div class="d-flex justify-space-between align-center">
                                                    <span class="text-body-2 font-weight-bold">Falta por
                                                        distribuir:</span>
                                                    <VChip :color="remainingAmount >= 0 ? 'success' : 'error'"
                                                        size="small" variant="elevated" class="elevation-1">
                                                        ${{ remainingAmount.toFixed(2) }}
                                                    </VChip>
                                                </div>
                                            </div>
                                        </VCardText>
                                    </VCard>
                                </VCardText>
                            </VCard>
                        </template>

                        <!-- Notas y Observaciones -->
                        <div :class="sale.document_type !== 'quote' ? 'mt-4' : ''">
                            <h2 v-if="sale.document_type === 'quote'"
                                class="text-h6 font-weight-medium mb-4 d-flex align-center">
                                <VIcon icon="ri-edit-2-line" class="mr-2" /> Notas Adicionales
                            </h2>
                            <VTextarea v-model="sale.observations" label="Observaciones"
                                placeholder="Notas adicionales..." variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-edit-2-line" hide-details="auto" rows="3"
                                :disabled="sale.status === 'canceled'" />
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
                        <!-- Resumen -->
                        <VCard variant="tonal" class="pa-4 bg-grey-lighten-4">
                            <h2 class="text-h6 font-weight-medium mb-4 text-right">Resumen</h2>

                            <div class="d-flex justify-space-between mb-2">
                                <span class="text-medium-emphasis">Subtotal:</span>
                                <span>${{ grossSubtotal.toFixed(2) }}</span>
                            </div>

                            <div class="d-flex justify-space-between mb-2 text-error" v-if="totalDiscount > 0">
                                <span class="text-medium-emphasis">Descuento:</span>
                                <span>-${{ totalDiscount.toFixed(2) }}</span>
                            </div>

                            <div class="d-flex justify-space-between mb-2">
                                <span class="text-medium-emphasis">Base Imponible:</span>
                                <span>${{ subtotal.toFixed(2) }}</span>
                            </div>

                            <div class="d-flex justify-space-between mb-2" v-if="sale.document_type === 'invoice'">
                                <span class="text-medium-emphasis">IVA (15%):</span>
                                <span>${{ taxAmount.toFixed(2) }}</span>
                            </div>

                            <VDivider class="my-3" />

                            <div class="d-flex justify-space-between align-center">
                                <span class="text-h6 font-weight-bold">
                                    {{ sale.document_type === 'quote' ? 'Total Cotizado:' : 'Total a Pagar:' }}
                                </span>
                                <span class="text-h5 font-weight-bold text-primary">${{ total.toFixed(2) }}</span>
                            </div>
                        </VCard>

                        <!-- Alerta de conversión -->
                        <VAlert v-if="canConvertToSale" type="warning" variant="tonal" class="mt-4" border="start">
                            <template v-slot:prepend>
                                <VIcon icon="ri-exclamation-line" />
                            </template>
                            <div class="text-body-2">
                                <strong>Esta es una cotización</strong>. Puedes convertirla en una venta cambiando el
                                tipo de documento.
                            </div>
                        </VAlert>
                    </VCol>
                </VRow>

                <!-- Acciones -->
                <div class="d-flex justify-end gap-3 mt-8">
                    <VAlert v-if="showValidationError" color="error" variant="tonal" class="mb-4" border="start" closable @click:close="showValidationError = false">
                        <div class="d-flex align-center">
                            <VIcon icon="ri-error-warning-line" class="mr-2" />
                            <span class="text-body-2">{{ validationErrorMessage }}</span>
                        </div>
                    </VAlert>
                </div>
                <div class="d-flex justify-end gap-3">
                    <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" to="/sales/list"
                        :disabled="loader.loading">
                        Cancelar
                    </VBtn>
                    <VBtn type="submit" color="primary" variant="elevated" prepend-icon="ri-save-3-line"
                        :loading="loader.loading" :disabled="sale.status === 'canceled'">
                        Guardar Cambios
                    </VBtn>
                </div>
            </VForm>
        </VCard>
    </div>
</template>