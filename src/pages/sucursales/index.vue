<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { useLoaderStore } from '@/stores/loader'
import { getAccountDisplayName } from '@/utils/helpers'

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

// Estado para Accounts
const accounts = ref([])
const isAccountDialogVisible = ref(false)
const isDeleteDialogVisible = ref(false)
const selectedAccount = ref(null)
const accountToDelete = ref(null)
const accountForm = ref({
    name: '',
    type: 'cash',
    bank_name: '',
    initial_balance: 0,
    state: 1
})
const accountFormRef = ref(null)

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
    },
    // Reglas para Accounts
    accountName: value => !!value || 'El nombre de la cuenta es requerido',
    accountType: value => !!value || 'El tipo de cuenta es requerido',
    accountBalance: value => {
        if (value === '' || value === null || value === undefined) return true
        const num = parseFloat(value)
        if (isNaN(num)) return 'El saldo debe ser un número válido'
        if (num < 0) return 'El saldo no puede ser negativo'
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

// Funciones CRUD para Accounts
const loadAccounts = async () => {
    try {
        const resp = await $api('accounts', {
            method: 'GET',
            onResponseError({ response }) {
                console.error('Error al cargar cuentas:', response._data.error)
                showNotification('Error al cargar las cuentas', 'error')
            }
        })

        accounts.value = resp || []
    } catch (error) {
        console.error('Error al cargar cuentas:', error)
        showNotification('Error al cargar las cuentas', 'error')
    }
}

const openAccountDialog = (account = null) => {
    selectedAccount.value = account
    if (account) {
        accountForm.value = { ...account }
    } else {
        accountForm.value = {
            name: '',
            type: 'cash',
            bank_name: '',
            initial_balance: 0,
            state: 1
        }
    }
    isAccountDialogVisible.value = true
}

const closeAccountDialog = () => {
    isAccountDialogVisible.value = false
    selectedAccount.value = null
    accountForm.value = {
        name: '',
        type: 'cash',
        bank_name: '',
        initial_balance: 0,
        state: 1
    }
}

const saveAccount = async () => {
    const { valid } = await accountFormRef.value?.validate()
    if (!valid) return

    try {
        const isEdit = !!selectedAccount.value
        const url = isEdit ? `accounts/${selectedAccount.value.id}` : 'accounts'
        const method = isEdit ? 'PUT' : 'POST'

        const resp = await $api(url, {
            method,
            body: accountForm.value,
            onResponseError({ response }) {
                console.error('Error al guardar cuenta:', response._data.error)
                showNotification('Error al guardar la cuenta', 'error')
            }
        })

        showNotification(
            isEdit ? 'Cuenta actualizada exitosamente' : 'Cuenta creada exitosamente',
            'success'
        )

        closeAccountDialog()
        loadAccounts()
    } catch (error) {
        console.error('Error al guardar cuenta:', error)
        showNotification('Error al guardar la cuenta', 'error')
    }
}

const deleteAccount = (account) => {
    accountToDelete.value = account
    isDeleteDialogVisible.value = true
}

const confirmDeleteAccount = async () => {
    if (!accountToDelete.value) return

    try {
        await $api(`accounts/${accountToDelete.value.id}`, {
            method: 'DELETE',
            onResponseError({ response }) {
                console.error('Error al eliminar cuenta:', response._data.error)
                showNotification('Error al eliminar la cuenta', 'error')
            }
        })

        showNotification('Cuenta eliminada exitosamente', 'success')
        closeDeleteDialog()
        loadAccounts()
    } catch (error) {
        console.error('Error al eliminar cuenta:', error)
        showNotification('Error al eliminar la cuenta', 'error')
    }
}

const closeDeleteDialog = () => {
    isDeleteDialogVisible.value = false
    accountToDelete.value = null
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
    loadAccounts()
})
</script>
<template>
    <div>
        <!-- Overlay global -->
        <VOverlay :model-value="isLoading" class="align-center justify-center" absolute>
            <VProgressCircular indeterminate size="48" width="4" color="primary" />
        </VOverlay>

        <VCard elevation="8" class="pa-8 rounded-xl border-thin">
            <!-- Header -->
            <div class="text-center mb-8">
                <VIcon icon="ri-building-line" size="64" color="primary" class="mb-4" />
                <h1 class="text-h3 font-weight-bold mb-2">
                    Gestión de Empresa y Cuentas
                </h1>
                <p class="text-body-1 text-medium-emphasis">
                    Administra la información de tu empresa y tus cuentas bancarias
                </p>
            </div>

            <!-- Layout Principal -->
            <VRow>
                <!-- Columna Izquierda: Información de la Empresa (7/12) -->
                <VCol cols="12" md="7">
                    <VCard elevation="4" class="pa-6 rounded-xl border-thin h-100">
                        <div class="d-flex align-center gap-3 mb-6">
                            <VIcon icon="ri-building-line" size="24" color="primary" />
                            <h3 class="text-h5 font-weight-bold text-primary">Información de la Empresa</h3>
                        </div>

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
                                        density="comfortable" prepend-inner-icon="ri-building-line" hide-details="auto"
                                        required :disabled="!isEditing" :rules="[rules.required]" />
                                </VCol>

                                <VCol cols="12" md="6">
                                    <VTextField v-model="sucursal.trade_name" label="Nombre Comercial"
                                        variant="outlined" density="comfortable" prepend-inner-icon="ri-store-line"
                                        hide-details="auto" :disabled="!isEditing" :rules="[rules.required]" />
                                </VCol>

                                <VCol cols="12" md="6">
                                    <VTextField v-model="sucursal.ruc" label="RUC" variant="outlined"
                                        density="comfortable" prepend-inner-icon="ri-file-text-line" hide-details="auto"
                                        required :disabled="!isEditing" :rules="[rules.ruc]" maxlength="13"
                                        @input="sucursal.ruc = sucursal.ruc.replace(/\D/g, '').slice(0, 13)" />
                                </VCol>

                                <VCol cols="12" md="6">
                                    <VTextField v-model="sucursal.address" label="Dirección" variant="outlined"
                                        density="comfortable" prepend-inner-icon="ri-map-pin-line" hide-details="auto"
                                        required :disabled="!isEditing" :rules="[rules.required]" />
                                </VCol>

                                <!-- Facturación -->
                                <VCol cols="12">
                                    <h5 class="text-h5 font-weight-bold mb-4 d-flex align-center">
                                        <VIcon icon="ri-file-list-3-line" size="20" class="me-2" />
                                        Configuración de Facturación
                                    </h5>
                                </VCol>

                                <VCol cols="12" md="3">
                                    <VTextField v-model="sucursal.serie_factura" label="Serie Factura"
                                        variant="outlined" density="comfortable" prepend-inner-icon="ri-hashtag"
                                        hide-details="auto" :disabled="!isEditing" :rules="[rules.serieFactura]" />
                                </VCol>

                                <VCol cols="12" md="3">
                                    <VTextField v-model="sucursal.secuencial_factura" label="Secuencial"
                                        variant="outlined" density="comfortable" prepend-inner-icon="ri-sort-asc"
                                        hide-details="auto" :disabled="!isEditing" :rules="[rules.secuencial]" />
                                </VCol>

                                <VCol cols="12" md="3">
                                    <VTextField v-model="sucursal.establecimiento" label="Establecimiento"
                                        variant="outlined" density="comfortable" prepend-inner-icon="ri-building-2-line"
                                        hide-details="auto" :disabled="!isEditing" :rules="[rules.establecimiento]" />
                                </VCol>

                                <VCol cols="12" md="3">
                                    <VTextField v-model="sucursal.punto_emision" label="Punto Emisión"
                                        variant="outlined" density="comfortable" prepend-inner-icon="ri-printer-line"
                                        hide-details="auto" :disabled="!isEditing" :rules="[rules.puntoEmision]" />
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
                                        prepend-inner-icon="ri-file-copy-line" hide-details="auto"
                                        :disabled="!isEditing" />
                                </VCol>

                                <!-- Firma Electrónica -->
                                <VCol cols="12">
                                    <h5 class="text-h5 font-weight-bold mb-4 d-flex align-center">
                                        <VIcon icon="ri-key-line" size="20" class="me-2" />
                                        Firma Electrónica
                                    </h5>
                                </VCol>

                                <VCol cols="12" md="6">
                                    <VTextField v-model="sucursal.firma_electronica" label="Archivo Firma"
                                        variant="outlined" density="comfortable" prepend-inner-icon="ri-file-lock-line"
                                        hide-details="auto" :disabled="!isEditing" />
                                </VCol>

                                <VCol cols="12" md="6">
                                    <VTextField v-model="sucursal.password_firma" label="Contraseña Firma"
                                        variant="outlined" density="comfortable"
                                        prepend-inner-icon="ri-lock-password-line" hide-details="auto" type="password"
                                        :disabled="!isEditing" />
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
                                        prepend-inner-icon="ri-checkbox-line" hide-details="auto"
                                        :disabled="!isEditing" />
                                </VCol>

                                <VCol cols="12" md="4">
                                    <VTextField v-model="sucursal.contribuyente_especial" label="Contribuyente Especial"
                                        variant="outlined" density="comfortable" prepend-inner-icon="ri-star-line"
                                        hide-details="auto" :disabled="!isEditing"
                                        :rules="[rules.contribuyenteEspecial]" />
                                </VCol>

                                <VCol cols="12" md="4">
                                    <VSelect v-model="sucursal.status" :items="[
                                        { title: 'Activo', value: '1' },
                                        { title: 'Inactivo', value: '0' }
                                    ]" label="Estado" variant="outlined" density="comfortable"
                                        prepend-inner-icon="ri-toggle-line" hide-details="auto" required
                                        :disabled="!isEditing" />
                                </VCol>

                                <VCol cols="12" md="6">
                                    <VTextField v-model="sucursal.phone" label="Teléfono" variant="outlined"
                                        density="comfortable" prepend-inner-icon="ri-phone-line" hide-details="auto"
                                        required :disabled="!isEditing" :rules="[rules.phone]" />
                                </VCol>

                                <VCol cols="12" md="6">
                                    <VTextField v-model="sucursal.email" label="Email" variant="outlined"
                                        density="comfortable" prepend-inner-icon="ri-mail-line" hide-details="auto"
                                        required :disabled="!isEditing" :rules="[rules.email]" />
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

                                <VBtn v-if="isEditing" color="primary" variant="elevated" class="text-none px-8"
                                    type="submit" :loading="isLoading" :disabled="isLoading">
                                    <VIcon start icon="ri-save-line" />
                                    Guardar Cambios
                                </VBtn>
                            </VCol>
                        </VForm>
                    </VCard>
                </VCol>

                <!-- Columna Derecha: Cuentas Bancarias (5/12) -->
                <VCol cols="12" md="5">
                    <VCard elevation="4" class="pa-6 rounded-xl border-thin h-100">
                        <div class="d-flex align-center justify-space-between mb-6">
                            <div class="d-flex align-center gap-3">
                                <VIcon icon="ri-bank-line" size="24" color="primary" />
                                <h3 class="text-h5 font-weight-bold text-primary">Cuentas Bancarias</h3>
                            </div>
                            <VBtn color="primary" variant="elevated" class="text-none" @click="openAccountDialog()">
                                <VIcon start icon="ri-add-line" />
                                Nueva
                            </VBtn>
                        </div>
                        <!-- Lista de Cuentas en Columna Única -->
                        <VCard variant="outlined" class="pa-4">
                            <!-- Grid de Cuentas -->
                            <VRow v-if="accounts && accounts.length > 0">
                                <VCol v-for="account in accounts" :key="account.id" cols="12">
                                    <VCard variant="outlined" class="pa-3">
                                        <div class="d-flex align-start gap-3">
                                            <!-- Avatar -->
                                            <VAvatar :color="account.type === 'cash' ? 'success' : 'info'"
                                                variant="tonal" size="36">
                                                <VIcon
                                                    :icon="account.type === 'cash' ? 'ri-money-dollar-circle-line' : 'ri-bank-card-line'" />
                                            </VAvatar>

                                            <!-- Contenido -->
                                            <div class="flex-grow-1">
                                                <div class="d-flex align-center justify-space-between mb-2">
                                                    <h5 class="text-subtitle-1 font-weight-bold mb-0">
                                                        {{ account.name }}
                                                    </h5>
                                                    <div class="d-flex gap-1">
                                                        <VBtn color="primary" variant="tonal" size="x-small"
                                                            icon="ri-edit-line" @click="openAccountDialog(account)" />
                                                        <VBtn color="error" variant="tonal" size="x-small"
                                                            icon="ri-delete-bin-line" @click="deleteAccount(account)" />
                                                    </div>
                                                </div>

                                                <div class="d-flex align-center gap-2 mb-2">
                                                    <VChip :color="account.type === 'cash' ? 'success' : 'info'"
                                                        size="x-small" variant="tonal">
                                                        {{ account.type === 'cash' ? 'Efectivo' : 'Bancaria' }}
                                                    </VChip>
                                                    <span v-if="account.bank_name" class="text-caption">{{
                                                        getAccountDisplayName(account) }}</span>
                                                </div>

                                                <div class="d-flex align-center gap-2">
                                                    <span class="text-primary font-weight-bold text-caption">
                                                        ${{ parseFloat(account.initial_balance || 0).toFixed(2) }}
                                                    </span>
                                                    <span class="text-medium-emphasis text-caption">
                                                        Saldo inicial
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </VCard>
                                </VCol>
                            </VRow>

                            <!-- Mensaje cuando no hay cuentas -->
                            <VRow v-if="!accounts || accounts.length === 0">
                                <VCol cols="12" class="text-center py-6">
                                    <VIcon icon="ri-bank-line text-medium-emphasis" size="40" class="mb-2" />
                                    <h5 class="text-subtitle-1 text-medium-emphasis mb-1">
                                        No hay cuentas registradas
                                    </h5>
                                    <p class="text-caption text-medium-emphasis mb-0">
                                        Haga clic en "Nueva" para comenzar
                                    </p>
                                </VCol>
                            </VRow>
                        </VCard>
                    </VCard>
                </VCol>
            </VRow>
        </VCard>

        <!-- Diálogo para Agregar/Editar Cuenta -->
        <VDialog v-model="isAccountDialogVisible" max-width="600" persistent>
            <VCard class="pa-6">
                <VCardTitle class="d-flex align-center justify-space-between mb-4">
                    <div class="d-flex align-center gap-2">
                        <VIcon icon="ri-bank-line" color="primary" />
                        <span class="text-h5 font-weight-bold">
                            {{ selectedAccount ? 'Editar Cuenta' : 'Nueva Cuenta' }}
                        </span>
                    </div>
                    <VBtn icon variant="text" @click="closeAccountDialog">
                        <VIcon icon="ri-close-line" />
                    </VBtn>
                </VCardTitle>

                <VForm ref="accountFormRef" @submit.prevent="saveAccount">
                    <VRow>
                        <VCol cols="12" md="6">
                            <VTextField v-model="accountForm.name" label="Nombre de la Cuenta *"
                                prepend-inner-icon="ri-bank-line" :rules="[rules.accountName]" required
                                placeholder="Ej: Cuenta Ahorros, Caja Chica" />
                        </VCol>

                        <VCol cols="12" md="6">
                            <VSelect v-model="accountForm.type" label="Tipo de Cuenta *" :items="[
                                { title: 'Efectivo', value: 'cash' },
                                { title: 'Bancaria', value: 'bank' }
                            ]" prepend-inner-icon="ri-exchange-line" :rules="[rules.accountType]" required />
                        </VCol>

                        <VCol cols="12" md="6" v-if="accountForm.type === 'bank'">
                            <VTextField v-model="accountForm.bank_name" label="Nombre del Banco"
                                prepend-inner-icon="ri-building-line"
                                placeholder="Ej: Banco Pichincha, Banco Guayaquil" />
                        </VCol>

                        <VCol cols="12" md="6">
                            <VTextField v-model="accountForm.initial_balance" label="Saldo Inicial" type="number"
                                prepend-inner-icon="ri-money-dollar-circle-line" :rules="[rules.accountBalance]"
                                placeholder="0.00" />
                        </VCol>

                        <VCol cols="12" md="6">
                            <VSelect v-model="accountForm.state" label="Estado" :items="[
                                { title: 'Activa', value: 1 },
                                { title: 'Inactiva', value: 0 }
                            ]" prepend-inner-icon="ri-toggle-line" />
                        </VCol>
                    </VRow>

                    <VCardActions class="mt-6">
                        <VSpacer />
                        <VBtn variant="outlined" color="secondary" @click="closeAccountDialog">
                            Cancelar
                        </VBtn>
                        <VBtn color="primary" variant="elevated" type="submit">
                            {{ selectedAccount ? 'Actualizar' : 'Crear' }} Cuenta
                        </VBtn>
                    </VCardActions>
                </VForm>
            </VCard>
        </VDialog>

        <!-- Diálogo de Confirmación para Eliminar Cuenta -->
        <VDialog v-model="isDeleteDialogVisible" max-width="400" persistent>
            <VCard class="pa-6">
                <VCardTitle class="d-flex align-center gap-3 mb-4">
                    <VAvatar color="error" variant="tonal" size="40">
                        <VIcon icon="ri-delete-bin-line" />
                    </VAvatar>
                    <div>
                        <h4 class="text-h6 font-weight-bold mb-1">Confirmar Eliminación</h4>
                        <p class="text-body-2 text-medium-emphasis mb-0">
                            ¿Está seguro de eliminar esta cuenta?
                        </p>
                    </div>
                </VCardTitle>

                <VCardText class="pa-0" v-if="accountToDelete">
                    <VAlert type="warning" variant="tonal" class="mb-4">
                        <div class="d-flex align-center gap-2">
                            <VIcon icon="ri-alert-line" />
                            <span>
                                Está a punto de eliminar <strong>"{{ accountToDelete.name }}"</strong>
                            </span>
                        </div>
                    </VAlert>

                    <div class="text-center">
                        <p class="text-body-2 mb-0">
                            Esta acción no se puede deshacer. Todos los datos asociados se perderán permanentemente.
                        </p>
                    </div>
                </VCardText>

                <VCardActions class="mt-6">
                    <VSpacer />
                    <VBtn variant="outlined" color="secondary" @click="closeDeleteDialog">
                        Cancelar
                    </VBtn>
                    <VBtn color="error" variant="elevated" @click="confirmDeleteAccount">
                        <VIcon start icon="ri-delete-bin-line" />
                        Eliminar Cuenta
                    </VBtn>
                </VCardActions>
            </VCard>
        </VDialog>
    </div>
</template>