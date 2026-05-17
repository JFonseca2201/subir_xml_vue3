<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'

const router = useRouter()
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

const clients = ref([])
const vehicles = ref([])
const products = ref([])
const accounts = ref([])

// Estado del formulario
const sale = ref({
    document_type: 'sale_note',
    document_number: '',
    client_id: null,
    vehicle_id: null,
    mileage: null,
    service_date: new Date().toISOString().substr(0, 10),
    payment_status: 'paid',
    is_credited: false,
    payment_method: 'Efectivo',
    observations: '',
    items: []
})

// Watch para cambiar estado de pago cuando es crédito
const onCreditChange = () => {
    if (sale.value.is_credited) {
        sale.value.payment_status = 'pending'
    } else {
        sale.value.payment_status = 'paid'
    }
}

// Generar número de documento según tipo
const generateDocumentNumber = (type) => {
    const today = new Date()
    const dateStr = today.getFullYear() +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0')
    
    const prefixes = {
        'quote': 'COT',
        'sale_note': 'NV',
        'invoice': 'FAC'
    }
    
    const prefix = prefixes[type] || 'DOC'
    const randomNum = String(Math.floor(Math.random() * 999)).padStart(3, '0')
    
    return `${prefix}-${dateStr}-${randomNum}`
}

// Watch para regenerar número cuando cambia el tipo de documento
const onDocumentTypeChange = () => {
    sale.value.document_number = generateDocumentNumber(sale.value.document_type)
}

// Pagos distribuidos
const paymentDistributions = ref([])

// Inicializar con un pago distribuido cuando hay items
const initializePaymentDistribution = () => {
    if (paymentDistributions.value.length === 0 && sale.value.items.length > 0) {
        paymentDistributions.value.push({
            account_id: 1, // Caja Chica por defecto para efectivo
            amount: 0,
            payment_method: 'Efectivo'
        })
    }
}

const searchProduct = ref(null)
const isClearingSearch = ref(false)

// Reglas de validación
const requiredRule = v => !!v || 'Campo obligatorio'

// Helpers
const getClientName = (c) => {
    if (!c) return 'Cliente'
    return c.full_name || c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente'
}

// Carga inicial
const loadInitialData = async () => {
    isLoading.value = true
    try {
        const [clientsRes, vehiclesRes, productsRes, accountsRes] = await Promise.all([
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

        clients.value = extractArray(clientsRes, 'clients')
        vehicles.value = extractArray(vehiclesRes, 'vehicles')
        const rawProducts = extractArray(productsRes, 'products')
        // Agregar campo de búsqueda combinado para productos
        products.value = rawProducts.map(p => ({
            ...p,
            searchText: `${p.name || ''} ${p.code || ''} ${p.description || ''}`.toLowerCase()
        }))
        accounts.value = extractArray(accountsRes, 'accounts')

        // Generar número de documento según tipo
        sale.value.document_number = generateDocumentNumber(sale.value.document_type)

    } catch (error) {
        console.error('Error al cargar datos:', error)
        showNotification('Error al cargar datos iniciales', 'error')
    } finally {
        isLoading.value = false
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
    // Asignar cuenta automáticamente si es efectivo
    if (newPayment.payment_method === 'Efectivo') {
        // Siempre asignar account_id 1 (Caja Chica) para efectivo
        newPayment.account_id = 1
    }
}

const removePaymentDistribution = (index) => {
    // No permitir eliminar si es el último pago
    if (paymentDistributions.value.length > 1) {
        paymentDistributions.value.splice(index, 1)
    }
}

// Asignar cuenta automáticamente según método de pago
const onPaymentMethodChange = (dist, newMethod) => {
    if (newMethod === 'Efectivo') {
        // Caja Chica (account_id 1)
        const cajaChica = accounts.value.find(acc => acc.id === 1 || acc.name?.toLowerCase().includes('caja'))
        dist.account_id = cajaChica ? cajaChica.id : 1
    } else if (newMethod === 'Transferencia') {
        // No asignar automáticamente, dejar que el usuario elija
        dist.account_id = null
    }
}

// Watch para asignar cuenta automáticamente cuando se inicializa un pago
const initializePaymentAccount = (dist) => {
    if (dist.payment_method === 'Efectivo') {
        // Siempre asignar Caja Chica (account_id 1) para efectivo
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
    // Solo procesar si es un objeto (producto seleccionado)
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
        // Inicializar pago distribuido si es el primer item
        initializePaymentDistribution()
        // Limpiar campo de búsqueda
        searchProduct.value = null
    }
}

const onProductItemClick = (product) => {
    // Manejar clic en el item de la lista
    if (product) {
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
        // Inicializar pago distribuido si es el primer item
        initializePaymentDistribution()
        // Limpiar campo de búsqueda
        searchProduct.value = null
    }
}

const onSearchUpdate = (value) => {
    // No hacer nada, el filtrado se maneja con searchText
}

// Cálculos
const TAX_RATE = 0.15 // 15% IVA

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

// Envío del formulario
const submitForm = async () => {
    if (formRef.value) {
        const { valid } = await formRef.value.validate()
        if (!valid) return
    }

    // Validar que haya un cliente seleccionado
    if (!sale.value.client_id) {
        showNotification('Debe seleccionar un cliente para continuar', 'warning')
        return
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

    loader.start()

    try {
        const payload = {
            ...sale.value,
            subtotal: subtotal.value,
            tax_amount: taxAmount.value,
            total: total.value
        }

        // Enviar pagos distribuidos solo si no es cotización
        if (sale.value.document_type !== 'quote' && paymentDistributions.value.length > 0) {
            payload.payment_distributions = paymentDistributions.value
        }

        const response = await $api('sales', {
            method: 'POST',
            body: payload
        })

        if (response.success || response.status === 201 || response.status === 200) {
            showNotification('Registro procesado exitosamente', 'success')
            router.push('/sales/list')
        } else {
            showNotification(response.message || 'Error al registrar', 'error')
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
    loadInitialData()
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
                    <h1 class="text-h4 font-weight-bold mb-1">Registrar Venta o Cotización</h1>
                    <p class="text-medium-emphasis mb-0">Crea un nuevo documento comercial</p>
                </div>
                <VBtn color="primary" variant="elevated" prepend-icon="ri-arrow-left-line" to="/sales/list">
                    Volver al Listado
                </VBtn>
            </div>

            <VForm ref="formRef" @submit.prevent="submitForm">
                <!-- Datos Generales -->
                <div class="mb-6">
                    <h2 class="text-h6 font-weight-medium mb-4 d-flex align-center">
                        <VIcon icon="ri-file-info-line" class="mr-2" /> Datos Generales
                    </h2>
                    <VRow>
                        <VCol cols="12" md="4">
                            <VSelect v-model="sale.document_type" :items="documentTypes" item-title="title"
                                item-value="value" label="Tipo de Documento" :rules="[requiredRule]" variant="outlined"
                                density="comfortable" prepend-inner-icon="ri-file-list-3-line" hide-details="auto"
                                required @update:model-value="onDocumentTypeChange" />
                        </VCol>
                        <VCol cols="12" md="4">
                            <VTextField v-model="sale.document_number" label="Número de Documento"
                                :rules="[requiredRule]" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-hashtag" hide-details="auto" required />
                        </VCol>
                        <VCol cols="12" md="4">
                            <VTextField v-model="sale.service_date" label="Fecha de Servicio" type="date"
                                :rules="[requiredRule]" variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-calendar-line" hide-details="auto" required />
                        </VCol>
                        <VCol cols="12" md="4">
                            <VAutocomplete v-model="sale.client_id" :items="clients" :item-title="getClientName"
                                item-value="id" label="Cliente" :rules="[requiredRule]" variant="outlined"
                                density="comfortable" prepend-inner-icon="ri-user-line" hide-details="auto" required
                                placeholder="Seleccionar cliente" clearable>
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
                                clearable>
                                <template v-slot:item="{ props, item }">
                                    <VListItem v-bind="props" :title="item.raw.license_plate"
                                        :subtitle="`${item.raw.brand || ''} ${item.raw.model || ''}`" />
                                </template>
                            </VAutocomplete>
                        </VCol>
                        <VCol cols="12" md="4">
                            <VTextField v-model="sale.mileage" label="Kilometraje (Opcional)" type="number"
                                variant="outlined" density="comfortable" prepend-inner-icon="ri-speed-up-line"
                                hide-details="auto" />
                        </VCol>
                    </VRow>
                </div>

                <VDivider class="mb-6" />

                <!-- Detalle de Venta -->
                <div class="mb-6">
                    <div class="d-flex justify-space-between align-center mb-4">
                        <h2 class="text-h6 font-weight-medium d-flex align-center">
                            <VIcon icon="ri-shopping-cart-2-line" class="mr-2" /> Detalle de Venta
                        </h2>
                    </div>
                    <div class="mb-4">
                        <VAutocomplete ref="productAutocompleteRef" v-model="searchProduct" :items="products" item-title="searchText" return-object
                            label="Buscar y agregar producto" placeholder="Escribe para buscar por nombre, código o descripción..."
                            prepend-inner-icon="ri-search-line" variant="outlined" clearable
                            @update:search="onSearchUpdate" no-filter>
                            <template v-slot:item="{ props, item }">
                                <VListItem v-bind="props" :title="item.raw.name || item.raw.description"
                                    :subtitle="item.raw.code ? `Código: ${item.raw.code}` : ''" 
                                    @click="onProductItemClick(item.raw)" />
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
                                            :rules="[requiredRule]" />
                                    </td>
                                    <td class="pa-2">
                                        <VTextField v-model.number="item.quantity" type="number" min="1"
                                            variant="outlined" density="compact" hide-details="auto"
                                            :rules="[requiredRule]" />
                                    </td>
                                    <td class="pa-2">
                                        <VTextField v-model.number="item.price" type="number" min="0" step="0.01"
                                            variant="outlined" density="compact" hide-details="auto"
                                            :rules="[requiredRule]" prefix="$" />
                                    </td>
                                    <td class="pa-2">
                                        <VTextField v-model.number="item.discount" type="number" min="0" step="0.01"
                                            variant="outlined" density="compact" hide-details="auto" prefix="$" />
                                    </td>
                                    <td class="pa-2 text-right font-weight-bold text-body-1">
                                        ${{ ((item.quantity * item.price) - item.discount).toFixed(2) }}
                                    </td>
                                    <td class="pa-2 text-center">
                                        <VBtn icon="ri-delete-bin-line" variant="text" color="error" size="small"
                                            @click="removeItem(index)" />
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
                                    <div class="d-flex align-center mb-5 pa-4 rounded-lg bg-gradient-to-r from-primary to-primary-darken-1">
                                        <VAvatar color="white" size="52" class="mr-4">
                                            <VIcon icon="ri-wallet-3-line" size="30" color="primary" />
                                        </VAvatar>
                                        <div class="text-white">
                                            <h2 class="text-h5 font-weight-bold mb-1">Forma de Pago</h2>
                                            <p class="text-body-2 opacity-90 mb-0">Configura cómo recibirás el pago de ${{ total.toFixed(2) }}</p>
                                        </div>
                                    </div>

                                    <!-- Estado de pago -->
                                    <div class="mb-4">
                                        <label class="text-subtitle-2 font-weight-medium mb-2 d-block text-primary">
                                            <VIcon icon="ri-money-dollar-circle-line" size="18" class="mr-1" />
                                            Estado del pago
                                        </label>
                                        <VSelect v-model="sale.payment_status" :items="paymentStatuses" item-title="title"
                                            item-value="value" :rules="[requiredRule]" variant="outlined"
                                            density="comfortable" prepend-inner-icon="ri-flag-line"
                                            hide-details="auto" bg-color="grey-lighten-5" rounded="lg" />
                                    </div>

                                    <!-- Opción de crédito -->
                                    <div class="mb-4">
                                        <VCard variant="outlined" class="pa-3 rounded-lg cursor-pointer hover-bg-grey-lighten-4"
                                            :class="sale.is_credited ? 'border-primary bg-primary-lighten-5' : ''"
                                            @click="onCreditChange">
                                            <div class="d-flex align-center">
                                                <VIcon :icon="sale.is_credited ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                                                    :color="sale.is_credited ? 'primary' : 'grey'" size="24" class="mr-2" />
                                                <div>
                                                    <div class="text-body-2 font-weight-medium">Venta a crédito</div>
                                                    <div class="text-caption text-medium-emphasis">Pago diferido</div>
                                                </div>
                                            </div>
                                        </VCard>
                                    </div>
                                </VCardText>
                            </VCard>

                            <!-- Pagos distribuidos (siempre visible) -->
                            <VCard variant="outlined" class="border-primary border-opacity-50 elevation-2">
                                <VCardText class="pa-4">
                                    <div class="d-flex justify-space-between align-center mb-4">
                                        <div class="d-flex align-center">
                                            <VAvatar color="success" size="40" class="mr-3 elevation-2">
                                                <VIcon icon="ri-spreadsheet-line" size="24" />
                                            </VAvatar>
                                            <div>
                                                <h3 class="text-subtitle-1 font-weight-bold mb-0">Pagos</h3>
                                                <p class="text-caption text-medium-emphasis mb-0">Total: ${{ total.toFixed(2) }} - Distribuido: ${{ totalDistributed.toFixed(2) }}</p>
                                            </div>
                                        </div>
                                        <VBtn color="primary" variant="elevated" prepend-icon="ri-add-circle-line"
                                            @click="addPaymentDistribution" size="small" class="elevation-2">
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
                                                            @update:model-value="(val) => onPaymentMethodChange(dist, val)" />
                                                    </td>
                                                    <td class="pa-2">
                                                        <VSelect v-if="dist.payment_method === 'Transferencia'" 
                                                            v-model="dist.account_id" 
                                                            :items="accounts.filter(a => a.name?.toLowerCase().includes('pichincha') || a.name?.toLowerCase().includes('guayaquil'))" 
                                                            item-title="name" item-value="id" label="Cuenta bancaria" variant="outlined" density="compact"
                                                            hide-details="auto" :rules="[requiredRule]" bg-color="white"
                                                            prepend-inner-icon="ri-bank-line" />
                                                        <VTextField v-else 
                                                            :value="dist.payment_method === 'Efectivo' ? 'Caja Chica' : ''" 
                                                            label="Cuenta" variant="outlined" density="compact" 
                                                            hide-details="auto" bg-color="grey-lighten-4" readonly
                                                            prepend-inner-icon="ri-bank-line" />
                                                        <!-- Campo oculto para account_id cuando es efectivo -->
                                                        <input type="hidden" v-if="dist.payment_method === 'Efectivo'" v-model="dist.account_id" />
                                                    </td>
                                                    <td class="pa-2">
                                                        <VTextField v-model.number="dist.amount" type="number" min="0" step="0.01"
                                                            label="Monto" variant="outlined" density="compact" hide-details="auto"
                                                            :rules="[requiredRule]" prefix="$" bg-color="white"
                                                            prepend-inner-icon="ri-money-dollar-circle-line" />
                                                    </td>
                                                    <td class="pa-2 text-center">
                                                        <VBtn icon="ri-delete-bin-line" variant="text" color="error" size="small"
                                                            @click="removePaymentDistribution(index)"
                                                            :disabled="paymentDistributions.length === 1" />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </VTable>
                                    </div>

                                    <!-- Resumen de pagos -->
                                    <VCard v-if="paymentDistributions.length > 0" variant="tonal" class="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 elevation-2">
                                        <VCardText class="pa-4">
                                            <div class="d-flex flex-column gap-3">
                                                <div class="d-flex justify-space-between align-center">
                                                    <span class="text-body-2 font-weight-medium">Total distribuido:</span>
                                                    <VChip color="primary" size="small" variant="elevated" class="elevation-1">
                                                        ${{ totalDistributed.toFixed(2) }}
                                                    </VChip>
                                                </div>
                                                <VDivider />
                                                <div class="d-flex justify-space-between align-center">
                                                    <span class="text-body-2 font-weight-bold">Falta por distribuir:</span>
                                                    <VChip :color="remainingAmount >= 0 ? 'success' : 'error'" size="small" variant="elevated" class="elevation-1">
                                                        ${{ remainingAmount.toFixed(2) }}
                                                    </VChip>
                                                </div>
                                            </div>
                                        </VCardText>
                                    </VCard>
                                </VCardText>
                            </VCard>
                        </template>
                        <div :class="sale.document_type !== 'quote' ? 'mt-4' : ''">
                            <h2 v-if="sale.document_type === 'quote'" class="text-h6 font-weight-medium mb-4 d-flex align-center">
                                <VIcon icon="ri-edit-2-line" class="mr-2" /> Notas Adicionales
                            </h2>
                            <VTextarea v-model="sale.observations" label="Observaciones"
                                placeholder="Notas adicionales..." variant="outlined" density="comfortable"
                                prepend-inner-icon="ri-edit-2-line" hide-details="auto" rows="3" />
                        </div>
                    </VCol>

                    <VCol cols="12" md="6">
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
                                <span class="text-h6 font-weight-bold">{{ sale.document_type === 'quote' ? 'Total Cotizado:' : 'Total a Pagar:' }}</span>
                                <span class="text-h5 font-weight-bold text-primary">${{ total.toFixed(2) }}</span>
                            </div>
                        </VCard>
                    </VCol>
                </VRow>

                <!-- Acciones -->
                <div class="d-flex justify-end gap-3 mt-8">
                    <VBtn variant="outlined" color="secondary" prepend-icon="ri-close-line" to="/sales/list"
                        :disabled="loader.loading">
                        Cancelar
                    </VBtn>
                    <VBtn type="submit" color="primary" variant="elevated" prepend-icon="ri-save-3-line"
                        :loading="loader.loading">
                        Registrar Documento
                    </VBtn>
                </div>
            </VForm>
        </VCard>
    </div>
</template>