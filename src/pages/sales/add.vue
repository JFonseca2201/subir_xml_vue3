<script setup>
import { ref, computed, onMounted } from 'vue'
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

const searchProduct = ref(null)

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
        const [clientsRes, vehiclesRes, productsRes] = await Promise.all([
            $api('clients', { params: { per_page: 1000 } }),
            $api('vehicles', { params: { per_page: 1000 } }),
            $api('products', { params: { per_page: 1000 } })
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
        products.value = extractArray(productsRes, 'products')

        // Autogenerar número de documento de ejemplo
        sale.value.document_number = 'DOC-' + Math.floor(Math.random() * 1000000)

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

const onProductSelected = (product) => {
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
        setTimeout(() => {
            searchProduct.value = null
        }, 10)
    }
}

// Cálculos
const TAX_RATE = 0.15 // 15% IVA

const subtotal = computed(() => {
    return sale.value.items.reduce((sum, item) => {
        return sum + ((item.quantity * item.price) - item.discount)
    }, 0)
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

    if (sale.value.items.length === 0) {
        showNotification('Debe agregar al menos un producto o servicio', 'warning')
        return
    }

    loader.start()

    try {
        const payload = {
            ...sale.value,
            subtotal: subtotal.value,
            tax_amount: taxAmount.value,
            total: total.value
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
                                required />
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
                        <VAutocomplete v-model="searchProduct" :items="products" item-title="description" return-object
                            label="Buscar y agregar producto" placeholder="Escribe para buscar un producto..."
                            prepend-inner-icon="ri-search-line" variant="outlined" clearable
                            @update:model-value="onProductSelected" />
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
                        <h2 class="text-h6 font-weight-medium mb-4 d-flex align-center">
                            <VIcon icon="ri-wallet-3-line" class="mr-2" /> Configuración de Pago
                        </h2>
                        <VRow>
                            <VCol cols="12" sm="6">
                                <VSelect v-model="sale.payment_status" :items="paymentStatuses" item-title="title"
                                    item-value="value" label="Estado de Pago" :rules="[requiredRule]" variant="outlined"
                                    density="comfortable" prepend-inner-icon="ri-money-dollar-circle-line"
                                    hide-details="auto" />
                            </VCol>
                            <VCol cols="12" sm="6">
                                <VSelect v-model="sale.payment_method" :items="paymentMethods" item-title="title"
                                    item-value="value" label="Método de Pago" :rules="[requiredRule]" variant="outlined"
                                    density="comfortable" prepend-inner-icon="ri-bank-card-line" hide-details="auto" />
                            </VCol>
                            <VCol cols="12">
                                <VSwitch v-model="sale.is_credited" label="Venta a Crédito" color="primary"
                                    hide-details />
                            </VCol>
                        </VRow>
                        <div class="mt-4">
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
                                <span>${{ subtotal.toFixed(2) }}</span>
                            </div>
                            <div class="d-flex justify-space-between mb-2" v-if="sale.document_type === 'invoice'">
                                <span class="text-medium-emphasis">IVA (15%):</span>
                                <span>${{ taxAmount.toFixed(2) }}</span>
                            </div>
                            <VDivider class="my-3" />
                            <div class="d-flex justify-space-between align-center">
                                <span class="text-h6 font-weight-bold">Total a Pagar:</span>
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