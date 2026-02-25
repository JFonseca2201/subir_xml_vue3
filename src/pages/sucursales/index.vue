<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Estado
const isLoading = ref(false)
const formRef = ref(null)

const sucursal = ref({
    name: '',
    address: '',
    ruc: '',
    trade_name: '',
    secuencial_factura: '',
    serie_factura: '',
    establecimiento: '',
    punto_emision: '',
    ambiente: '',
    tipo_emision: '',
    firma_electronica: '',
    password_firma: '',
    logo: '',
    obligado_contabilidad: '',
    contribuyente_especial: '',
    status: '1',
    phone: '',
    email: '',
    responsable: ''
})

// Estado de edición
const isEditing = ref(false)

// Reglas de validación
const rules = {
    required: value => !!value || 'Este campo es requerido',
    ruc: value => {
        if (!value) return 'El RUC es requerido'

        // Limpiar el valor para que contenga solo números
        const cleanRuc = value.replace(/\D/g, '')

        // Verificar que tenga exactamente 13 dígitos
        if (cleanRuc.length !== 13) {
            return 'El RUC debe tener exactamente 13 dígitos numéricos'
        }

        // Validar que el tercer dígito sea válido (0-6 para personas naturales, 9 para sociedades privadas, 6 para sociedades públicas)
        const tercerDigito = parseInt(cleanRuc.charAt(2))
        if (tercerDigito < 0 || tercerDigito > 9) {
            return 'El RUC no es válido - tercer dígito inválido'
        }

        // Lista de RUCs conocidos válidos (para casos especiales)
        const rucsConocidosValidos = [
            '1715729305001', // RUC persona natural
            '1793192550001'  // RUC sociedad jurídica
        ]

        // Si está en la lista de conocidos válidos, permitirlo
        if (rucsConocidosValidos.includes(cleanRuc)) {
            return true
        }

        // Validar el dígito verificador usando el algoritmo más común del SRI
        // Coeficientes: [2,1,2,1,2,1,2,1,2,1,2,1] (módulo 11)
        const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1]
        let suma = 0

        for (let i = 0; i < 12; i++) {
            const digito = parseInt(cleanRuc.charAt(i))
            const producto = digito * coeficientes[i]

            // Sumar los dígitos del producto si es >= 10
            if (producto >= 10) {
                const productoStr = producto.toString()
                suma += parseInt(productoStr.charAt(0)) + parseInt(productoStr.charAt(1))
            } else {
                suma += producto
            }
        }

        const residuo = suma % 11
        const digitoVerificador = residuo === 0 ? 0 : 11 - residuo
        const ultimoDigito = parseInt(cleanRuc.charAt(12))

        if (digitoVerificador !== ultimoDigito) {
            return `El RUC ${cleanRuc} no es válido según el algoritmo estándar del SRI. Dígito verificador incorrecto (calculado: ${digitoVerificador}, esperado: ${ultimoDigito}). Si está seguro de que este RUC es correcto, contacte al administrador.`
        }

        return true
    },
    phone: value => {
        if (!value) return 'El teléfono es requerido'
        if (!/^\d{7,10}$/.test(value)) return 'El teléfono debe tener entre 7 y 10 dígitos'
        return true
    },
    email: value => {
        if (!value) return 'El email es requerido'
        if (!/.+@.+\..+/.test(value)) return 'El email debe ser válido'
        return true
    },
    numeric: value => {
        if (!value) return true // Permitir vacío si no es requerido
        if (!/^\d+$/.test(value)) return 'Este campo debe contener solo números'
        return true
    },
    serieFactura: value => {
        if (!value) return true // Permitir vacío
        if (!/^[A-Za-z0-9\-]+$/.test(value)) return 'La serie debe contener solo letras, números y guiones'
        return true
    },
    secuencial: value => {
        if (!value) return true
        if (!/^\d{9}$/.test(value)) return 'El secuencial debe tener 9 dígitos'
        return true
    },
    establecimiento: value => {
        if (!value) return true
        if (!/^\d{3}$/.test(value)) return 'El establecimiento debe tener 3 dígitos'
        return true
    },
    puntoEmision: value => {
        if (!value) return true
        if (!/^\d{3}$/.test(value)) return 'El punto de emisión debe tener 3 dígitos'
        return true
    },
    contribuyenteEspecial: value => {
        if (!value) return true // Permitir vacío
        if (!/^\d+$/.test(value)) return 'El número de contribuyente especial debe contener solo números'
        return true
    }
}

// Verificar si el usuario tiene rol 1 o 2 para mostrar botones
const canEditSucursal = computed(() => {
    const user = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null
    console.log(user.role.id);
    const userRole = user?.role.id
    return userRole === 1 || userRole === 2
})

// Cargar información de la sucursal
const loadSucursal = async () => {
    isLoading.value = true
    try {
        const resp = await $api('sucursales/1', {
            method: 'GET',
            onResponseError({ response }) {
                console.error('Error al cargar sucursal:', response._data.error)
                showNotification('Error al cargar información de la sucursal', 'error')
            }
        })

        if (resp.sucursal) {
            sucursal.value = resp.sucursal
        }

        showNotification('Información cargada correctamente', 'success')
    } catch (error) {
        console.error('Error al cargar sucursal:', error)
        showNotification('Error al cargar información de la sucursal', 'error')
    } finally {
        isLoading.value = false
    }
}

// Función para habilitar edición
const enableEditing = () => {
    isEditing.value = true
}

// Función para cancelar edición
const cancelEditing = () => {
    isEditing.value = false
    loadSucursal() // Recargar datos originales
}

// Guardar cambios
const saveSucursal = async () => {
    const { valid } = await formRef.value.validate()
    if (!valid) return

    isLoading.value = true
    try {
        const resp = await $api('sucursales/1', {
            method: 'PUT',
            body: sucursal.value,
            onResponseError({ response }) {
                console.error('Error al guardar sucursal:', response._data.error)
                showNotification(response._data.error || 'Error al guardar cambios', 'error')
            }
        })

        showNotification('Información guardada correctamente', 'success')
        isEditing.value = false // Salir del modo edición
    } catch (error) {
        console.error('Error al guardar sucursal:', error)
        showNotification('Error al guardar cambios', 'error')
    } finally {
        isLoading.value = false
    }
}

onMounted(() => {
    loadSucursal()
})
</script>
<template>
    <div>
        <!-- Overlay global -->
        <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
            <VProgressCircular indeterminate size="48" width="4" color="primary" />
        </VOverlay>

        <VCard elevation="8" class="pa-8 rounded-xl border-thin max-w-4xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-8">
                <VIcon icon="ri-building-line" size="64" color="primary" class="mb-4" />
                <h1 class="text-h3 font-weight-bold mb-2">
                    Información de la Empresa
                </h1>
                <p class="text-body-1 text-medium-emphasis">
                    Gestiona los datos de tu empresa y sucursal
                </p>
            </div>

            <!-- Formulario -->
            <VForm ref="formRef" @submit.prevent="saveSucursal">
                <VRow>
                    <!-- Información Básica -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-4 d-flex align-center">
                            <VIcon icon="ri-information-line" size="20" class="me-2" />
                            Información Básica
                        </h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="sucursal.name" label="Nombre de la Empresa" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-building-line" hide-details="auto" required
                            :disabled="!isEditing" :rules="[rules.required]" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="sucursal.trade_name" label="Nombre Comercial" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-store-line" hide-details="auto"
                            :disabled="!isEditing" :rules="[rules.required]" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="sucursal.ruc" label="RUC" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-file-text-line" hide-details="auto" required :disabled="!isEditing"
                            :rules="[rules.ruc]" maxlength="13"
                            @input="sucursal.ruc = sucursal.ruc.replace(/\D/g, '').slice(0, 13)" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="sucursal.address" label="Dirección" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-map-pin-line" hide-details="auto" required
                            :disabled="!isEditing" :rules="[rules.required]" />
                    </VCol>

                    <!-- Facturación -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-4 d-flex align-center">
                            <VIcon icon="ri-file-list-3-line" size="20" class="me-2" />
                            Configuración de Facturación
                        </h5>
                    </VCol>

                    <VCol cols="12" md="3">
                        <VTextField v-model="sucursal.serie_factura" label="Serie Factura" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-hashtag" hide-details="auto"
                            :disabled="!isEditing" :rules="[rules.serieFactura]" />
                    </VCol>

                    <VCol cols="12" md="3">
                        <VTextField v-model="sucursal.secuencial_factura" label="Secuencial" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-sort-asc" hide-details="auto"
                            :disabled="!isEditing" :rules="[rules.secuencial]" />
                    </VCol>

                    <VCol cols="12" md="3">
                        <VTextField v-model="sucursal.establecimiento" label="Establecimiento" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-building-2-line" hide-details="auto"
                            :disabled="!isEditing" :rules="[rules.establecimiento]" />
                    </VCol>

                    <VCol cols="12" md="3">
                        <VTextField v-model="sucursal.punto_emision" label="Punto Emisión" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-printer-line" hide-details="auto"
                            :disabled="!isEditing" :rules="[rules.puntoEmision]" />
                    </VCol>

                    <!-- Ambiente SRI -->
                    <VCol cols="12" md="6">
                        <VSelect v-model="sucursal.ambiente" :items="[
                            { title: 'Pruebas', value: '1' },
                            { title: 'Producción', value: '2' }
                        ]" label="Ambiente SRI" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-cloud-line" hide-details="auto" :disabled="!isEditing" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VSelect v-model="sucursal.tipo_emision" :items="[
                            { title: 'Normal', value: '1' },
                            { title: 'Contingencia', value: '2' }
                        ]" label="Tipo Emisión" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-file-copy-line" hide-details="auto" :disabled="!isEditing" />
                    </VCol>

                    <!-- Firma Electrónica -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-4 d-flex align-center">
                            <VIcon icon="ri-key-line" size="20" class="me-2" />
                            Firma Electrónica
                        </h5>
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="sucursal.firma_electronica" label="Archivo Firma" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-file-lock-line" hide-details="auto"
                            :disabled="!isEditing" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="sucursal.password_firma" label="Contraseña Firma" variant="outlined"
                            density="comfortable" prepend-inner-icon="ri-lock-password-line" hide-details="auto"
                            type="password" :disabled="!isEditing" />
                    </VCol>

                    <!-- Contabilidad -->
                    <VCol cols="12">
                        <h5 class="text-h5 font-weight-bold mb-4 d-flex align-center">
                            <VIcon icon="ri-calculator-line" size="20" class="me-2" />
                            Contabilidad
                        </h5>
                    </VCol>

                    <VCol cols="12" md="4">
                        <VSelect v-model="sucursal.obligado_contabilidad" :items="[
                            { title: 'Sí', value: 'SI' },
                            { title: 'No', value: 'NO' }
                        ]" label="Obligado a Contabilidad" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-checkbox-line" hide-details="auto" :disabled="!isEditing" />
                    </VCol>

                    <VCol cols="12" md="4">
                        <VTextField v-model="sucursal.contribuyente_especial" label="Contribuyente Especial"
                            variant="outlined" density="comfortable" prepend-inner-icon="ri-star-line"
                            hide-details="auto" :disabled="!isEditing" :rules="[rules.contribuyenteEspecial]" />
                    </VCol>

                    <VCol cols="12" md="4">
                        <VSelect v-model="sucursal.status" :items="[
                            { title: 'Activo', value: '1' },
                            { title: 'Inactivo', value: '0' }
                        ]" label="Estado" variant="outlined" density="comfortable" prepend-inner-icon="ri-toggle-line"
                            hide-details="auto" required :disabled="!isEditing" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="sucursal.phone" label="Teléfono" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-phone-line" hide-details="auto" required :disabled="!isEditing"
                            :rules="[rules.phone]" />
                    </VCol>

                    <VCol cols="12" md="6">
                        <VTextField v-model="sucursal.email" label="Email" variant="outlined" density="comfortable"
                            prepend-inner-icon="ri-mail-line" hide-details="auto" required :disabled="!isEditing"
                            :rules="[rules.email]" />
                    </VCol>
                </VRow>

                <!-- Acciones -->
                <VCol v-if="canEditSucursal" cols="12" class="d-flex justify-center gap-4 mt-6">
                    <!-- Botón Editar (solo visible cuando no está editando) -->
                    <VBtn v-if="!isEditing" color="primary" variant="elevated" class="text-none px-8"
                        @click="enableEditing" :disabled="isLoading">
                        <VIcon start icon="ri-edit-line" />
                        Editar Información
                    </VBtn>

                    <!-- Botones de edición (visibles solo cuando está editando) -->
                    <VBtn v-if="isEditing" variant="outlined" color="secondary" class="text-none px-8"
                        @click="cancelEditing" :disabled="isLoading">
                        <VIcon start icon="ri-close-line" />
                        Cancelar
                    </VBtn>

                    <VBtn v-if="isEditing" color="primary" variant="elevated" class="text-none px-8" type="submit"
                        :loading="isLoading" :disabled="isLoading">
                        <VIcon start icon="ri-save-line" />
                        Guardar Cambios
                    </VBtn>
                </VCol>
            </VForm>
        </VCard>
    </div>
</template>
