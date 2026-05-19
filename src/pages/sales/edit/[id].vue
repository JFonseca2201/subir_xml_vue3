<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const router = useRouter()
const route = useRoute()
const { showNotification } = useGlobalToast()
const loader = useLoaderStore()

const formRef = ref(null)
const isLoading = ref(false)

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
    return sale.value.client
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
        const [saleRes, vehiclesRes, productsRes, accountsRes] = await Promise.all([
            $api(`sales/${route.params.id}`),
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

        vehicles.value = extractArray(vehiclesRes, 'vehicles')
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
    if (formRef.value) {
        const { valid } = await formRef.value.validate()
        if (!valid) return
    }

    // Validar que haya al menos un producto/servicio
    if (sale.value.items.length === 0) {
        showNotification('Debe agregar al menos un producto o servicio', 'warning')
        return
    }

    // Validar pagos distribuidos solo si no es cotización
    if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
        const totalDist = paymentDistributions.value.reduce((sum, dist) => sum + (Number(dist.amount) || 0), 0)
        if (Math.abs(totalDist - total.value) > 0.01) {
            showNotification('La suma de los pagos debe ser igual al total', 'warning')
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
                    <h1 class="text-h4 font-weight-bold mb-1">Editar Venta</h1>
                    <p class="text-medium-emphasis mb-0">Edita la información de la venta o cotización</p>
                </div>
                <VBtn color="primary" variant="elevated" prepend-icon="ri-arrow-left-line" to="/sales/list">
                    Volver al Listado
                </VBtn>
            </div>

            <VForm ref="formRef" @submit.prevent="submitForm">
                <!-- Información de Solo Lectura -->
                <div class="mb-6">
                    <h2 class="text-h6 font-weight-medium mb-4 d-flex align-center">
                        <VIcon icon="ri-file-info-line" class="mr-2" /> Información del Documento
                    </h2>
                    <VCard class="pa-4" variant="tonal" color="grey-lighten-4">
                        <VRow>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Tipo de Documento</div>
                                    <VSelect v-model="sale.document_type" :items="documentTypes" item-title="title"
                                        item-value="value" variant="outlined" density="comfortable" hide-details="auto"
                                        :disabled="sale.status === 'canceled' || !isQuote" />
                                </div>
                            </VCol>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Número de Documento</div>
                                    <div class="text-body-1 font-weight-medium">{{ sale.document_number }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Estado</div>
                                    <VChip :color="sale.status === 'completed' ? 'success' : sale.status === 'pending' ? 'warning' : 'error'" size="small">
                                        {{ sale.status === 'completed' ? 'Completada' : sale.status === 'pending' ? 'Pendiente' : 'Anulada' }}
                                    </VChip>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Cliente</div>
                                    <div class="text-body-1 font-weight-medium">{{ getClientName(sale.client) }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="6">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Documento del Cliente</div>
                                    <div class="text-body-2">{{ sale.client?.n_document || '-' }}</div>
                                </div>
                            </VCol>
                        </VRow>
                    </VCard>
                </div>

                <VDivider class="mb-6" />

                <!-- Campos Editables -->
                <div class="mb-6">
                    <h2 class="text-h6 font-weight-medium mb-4 d-flex align-center">
                        <VIcon icon="ri-edit-line" class="mr-2" /> Información Editable
                    </h2>
                    <VRow>
                        <VCol cols="12" md="4">
                            <VAutocomplete v-model="sale.vehicle_id" :items="vehicles" item-title="license_plate"
                                item-value="id" label="Vehículo" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-car-line" hide-details="auto" placeholder="Seleccionar vehículo"
                                clearable :disabled="sale.status === 'canceled'">
                                <template v-slot:item="{ props, item }">
                                    <VListItem v-bind="props" :title="item.raw.license_plate"
                                        :subtitle="`${item.raw.brand || ''} ${item.raw.model || ''}`" />
                                </template>
                            </VAutocomplete>
                        </VCol>
                        <VCol cols="12" md="4">
                            <VTextField v-model="sale.mileage" label="Kilometraje" type="number"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-speed-up-line"
                                hide-details="auto" :disabled="sale.status === 'canceled'" />
                        </VCol>
                        <VCol cols="12" md="4">
                            <VTextField v-model="sale.service_date" label="Fecha de Servicio" type="date"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-calendar-line"
                                hide-details="auto" :disabled="sale.status === 'canceled'" />
                        </VCol>
                        <VCol cols="12">
                            <VTextarea v-model="sale.observations" label="Observaciones" variant="outlined"
                                density="comfortable" prepend-inner-icon="ri-file-text-line" hide-details="auto"
                                rows="3" :disabled="sale.status === 'canceled'" />
                        </VCol>
                    </VRow>
                </div>

                <VDivider class="mb-6" />

                <!-- Información del Cliente -->
                <div class="mb-6" v-if="selectedClient">
                    <h2 class="text-h6 font-weight-medium mb-4 d-flex align-center">
                        <VIcon icon="ri-user-line" class="mr-2" /> Información del Cliente
                    </h2>
                    <VCard class="pa-4" variant="tonal" color="blue-lighten-5">
                        <VRow>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Nombre Completo</div>
                                    <div class="text-body-1 font-weight-medium">{{ getClientName(selectedClient) }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Documento</div>
                                    <div class="text-body-2">{{ selectedClient.n_document || '-' }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Teléfono</div>
                                    <div class="text-body-2">{{ selectedClient.phone || '-' }}</div>
                                </div>
                            </VCol>
                        </VRow>
                    </VCard>
                </div>

                <VDivider class="mb-6" />

                <!-- Información del Vehículo -->
                <div class="mb-6" v-if="selectedVehicle">
                    <h2 class="text-h6 font-weight-medium mb-4 d-flex align-center">
                        <VIcon icon="ri-car-line" class="mr-2" /> Información del Vehículo
                    </h2>
                    <VCard class="pa-4" variant="tonal" color="green-lighten-5">
                        <VRow>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Placa</div>
                                    <div class="text-body-1 font-weight-medium">{{ selectedVehicle.license_plate }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Marca y Modelo</div>
                                    <div class="text-body-2">{{ selectedVehicle.brand }} {{ selectedVehicle.model }}</div>
                                </div>
                            </VCol>
                            <VCol cols="12" md="4">
                                <div class="mb-2">
                                    <div class="text-caption text-medium-emphasis mb-1">Año</div>
                                    <div class="text-body-2">{{ selectedVehicle.year || '-' }}</div>
                                </div>
                            </VCol>
                        </VRow>
                    </VCard>
                </div>

                <VDivider class="mb-6" />

                <!-- Detalle de Venta -->
                <div class="mb-6">
                    <div class="d-flex justify-space-between align-center mb-4">
                        <h2 class="text-h6 font-weight-medium d-flex align-center">
                            <VIcon icon="ri-shopping-cart-2-line" class="mr-2" /> Detalle de Productos/Servicios
                        </h2>
                    </div>
                    <div class="mb-4">
                        <VAutocomplete v-model="searchProduct" :items="products"
                            item-title="displayTitle" return-object label="Buscar y agregar producto"
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
                    </VCol>

                    <VCol cols="12" md="6">
                        <!-- Totales -->
                        <VCard class="mb-4" elevation="3">
                            <VCardText class="pa-5">
                                <h3 class="text-h6 font-weight-bold mb-4 d-flex align-center">
                                    <VIcon icon="ri-money-dollar-circle-line" class="mr-2" /> Totales
                                </h3>
                                <div class="d-flex justify-space-between align-center mb-3">
                                    <span class="text-body-2">Subtotal</span>
                                    <span class="text-body-1 font-weight-medium">{{ formatCurrency(subtotal) }}</span>
                                </div>
                                <div class="d-flex justify-space-between align-center mb-3">
                                    <span class="text-body-2">IVA (15%)</span>
                                    <span class="text-body-1 font-weight-medium">{{ formatCurrency(taxAmount) }}</span>
                                </div>
                                <VDivider class="my-3" />
                                <div class="d-flex justify-space-between align-center">
                                    <span class="text-h6 font-weight-bold">Total</span>
                                    <span class="text-h5 font-weight-bold text-primary">{{ formatCurrency(total) }}</span>
                                </div>
                            </VCardText>
                        </VCard>

                        <!-- Alerta de conversión -->
                        <VAlert v-if="canConvertToSale" type="warning" variant="tonal" class="mb-4" border="start">
                            <template v-slot:prepend>
                                <VIcon icon="ri-exclamation-line" />
                            </template>
                            <div class="text-body-2">
                                <strong>Esta es una cotización</strong>. Puedes convertirla en una venta cambiando el tipo de documento.
                            </div>
                        </VAlert>
                    </VCol>
                </VRow>

                <!-- Botones de Acción -->
                <div class="d-flex justify-end gap-3">
                    <VBtn color="default" variant="outlined" prepend-icon="ri-close-line" to="/sales/list">
                        Cancelar
                    </VBtn>
                    <VBtn color="primary" variant="elevated" prepend-icon="ri-save-line" type="submit"
                        :loading="loader.loading" :disabled="sale.status === 'canceled'">
                        Guardar Cambios
                    </VBtn>
                </div>
            </VForm>
        </VCard>
    </div>
</template>