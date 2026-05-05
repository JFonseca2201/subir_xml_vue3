<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'
import { useRouter } from 'vue-router'
import AporteCreateDialog from '@/components/inventory/aportes/AporteCreateDialog.vue'
import AporteEditDialog from '@/components/inventory/aportes/AporteEditDialog.vue'

// Router y seguridad
const router = useRouter()
const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Obtener usuario actual del localStorage
const currentUser = computed(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
})

// Validación de seguridad - solo rol_id === 1 puede acceder
const canAccessAportes = computed(() => {
    const user = currentUser.value
    const roleId = user?.role?.id
    console.log('🔍 Debug - Usuario actual:', user)
    console.log('🔍 Debug - role:', user?.role)
    console.log('🔍 Debug - role.id:', roleId)
    console.log('🔍 Debug - Tipo de role.id:', typeof roleId)
    console.log('🔍 Debug - ¿Puede acceder?:', user && roleId === 1)
    return user && roleId === 1
})

// Estado del componente
const aportes = ref([])
const resumen = ref({
    total_hoy: 0,
    total_mes: 0,
    total_general: 0
})
const loading = ref(false)
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const editingAporte = ref(null)

// Estado para el diálogo de eliminación
const showDeleteDialog = ref(false)
const aporteToDelete = ref(null)

// Funciones
const loadAportes = async () => {
    loader.start()
    loading.value = true

    try {
        const response = await $api('aportes')

        if (response.data) {
            aportes.value = response.data
            resumen.value = response.resumen || {
                total_hoy: 0,
                total_mes: 0,
                total_general: 0
            }
        }

        showNotification('Aportes cargados correctamente', 'success')
    } catch (error) {
        console.error('Error al cargar aportes:', error)
        showNotification('Error al cargar aportes', 'error')
    } finally {
        loader.stop()
        loading.value = false
    }
}

const openCreateDialog = () => {
    console.log('🆕 Abriendo diálogo de creación')
    showCreateDialog.value = true
}

const openEditDialog = (aporte) => {
    console.log('🔧 -----------------:', aporte)
    console.log('🔧 ID del Partner:', aporte?.partner?.id)
    console.log('🔧 Nombre del Partner:', aporte?.partner?.partner_nombre)
    console.log('🔧 ID de la Cuenta:', aporte?.cuenta?.id)
    console.log('🔧 Nombre de la Cuenta:', aporte?.cuenta)
    editingAporte.value = aporte
    showEditDialog.value = true
}

const closeCreateDialog = () => {
    console.log('� Cerrando diálogo de creación')
    showCreateDialog.value = false
}

const closeEditDialog = () => {
    console.log('🚪 Cerrando diálogo de edición')
    showEditDialog.value = false
    editingAporte.value = null
}

const onAporteCreated = () => {
    console.log('✅ Aporte creado exitosamente')
    loadAportes()
    closeCreateDialog()
}

const onAporteUpdated = () => {
    console.log('✅ Aporte actualizado exitosamente')
    loadAportes()
    closeEditDialog()
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
    }).format(value)
}

const openDeleteDialog = (aporte) => {
    aporteToDelete.value = aporte
    showDeleteDialog.value = true
}

const closeDeleteDialog = () => {
    showDeleteDialog.value = false
    aporteToDelete.value = null
}

const confirmDeleteAporte = async () => {
    if (!aporteToDelete.value) return

    loader.start()

    try {
        await $api(`aportes/${aporteToDelete.value.id}`, {
            method: 'DELETE'
        })

        showNotification('Aporte eliminado exitosamente', 'success')
        loadAportes()
        closeDeleteDialog()
    } catch (error) {
        console.error('Error al eliminar aporte:', error)
        showNotification('Error al eliminar aporte', 'error')
    } finally {
        loader.stop()
    }
}

const deleteAporte = (aporte) => {
    openDeleteDialog(aporte)
}

// Montar componente
onMounted(() => {
    console.log('🚀 Dashboard de Aportes montado - Usuario actual:', currentUser.value)
    if (canAccessAportes.value) {
        loadAportes()
    }
})
</script>

<template>
    <div v-if="!canAccessAportes" class="d-flex justify-center align-center" style="height: 400px">
        <VCard class="pa-6 text-center">
            <VIcon size="64" color="error" class="mb-4">ri-lock-line</VIcon>
            <h3 class="text-h5 mb-2">Acceso Restringido</h3>
            <p class="text-medium-emphasis">No tienes permisos para acceder a la gestión de aportes de capital.</p>
            <VBtn color="primary" @click="router.push('/dashboard')" class="mt-4">
                Volver al Dashboard
            </VBtn>
        </VCard>
    </div>

    <div v-else class="pa-4 pa-sm-6">
        <!-- Header -->
        <VCard class="pa-6 mb-6 rounded-lg elevation-4">
            <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center gap-3">
                    <VIcon size="40" color="primary">ri-group-line</VIcon>
                    <div>
                        <h1 class="text-h4 font-weight-bold mb-1">Aportes de Capital</h1>
                        <span class="text-medium-emphasis">Gestión de aportes de socios y control de capital</span>
                    </div>
                </div>
                <VBtn color="primary" prepend-icon="ri-add-line" size="large" @click="openCreateDialog">
                    Nuevo Aporte
                </VBtn>
            </div>
            <VDivider />
        </VCard>

        <!-- Tarjetas de Resumen -->
        <VRow class="mb-6">
            <VCol cols="12" md="6" lg="4">
                <VCard class="pa-6 rounded-lg elevation-3" color="primary" variant="tonal">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6 font-weight-medium text-primary-darken-1 mb-2">
                                Aportes Hoy
                            </div>
                            <div class="text-h4 font-weight-bold text-primary">
                                {{ formatCurrency(resumen.total_hoy) }}
                            </div>
                        </div>
                        <VIcon size="48" color="primary">ri-calendar-today-line</VIcon>
                    </div>
                </VCard>
            </VCol>

            <VCol cols="12" md="6" lg="4">
                <VCard class="pa-6 rounded-lg elevation-3">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6 font-weight-medium mb-2">Aportes del Mes</div>
                            <div class="text-h4 font-weight-bold">{{ formatCurrency(resumen.total_mes) }}</div>
                        </div>
                        <VIcon size="48" color="success">ri-calendar-line</VIcon>
                    </div>
                </VCard>
            </VCol>

            <VCol cols="12" md="6" lg="4">
                <VCard class="pa-6 rounded-lg elevation-3">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6 font-weight-medium mb-2">Total General</div>
                            <div class="text-h4 font-weight-bold">{{ formatCurrency(resumen.total_general) }}</div>
                        </div>
                        <VIcon size="48" color="info">ri-money-dollar-box-line</VIcon>
                    </div>
                </VCard>
            </VCol>
        </VRow>

        <!-- Lista de Aportes -->
        <VCard class="rounded-lg elevation-4">
            <VCardTitle class="pa-4 pb-2">
                <div class="d-flex align-center gap-2">
                    <VIcon color="primary">ri-history-line</VIcon>
                    <span class="text-h5 font-weight-bold">Historial de Aportes</span>
                </div>
            </VCardTitle>

            <VDivider />

            <VCardText class="pa-0">
                <div v-if="loading" class="text-center pa-8">
                    <VProgressCircular indeterminate color="primary" size="48" />
                    <div class="text-h6 mt-4">Cargando aportes...</div>
                </div>

                <div v-else-if="!aportes.length" class="text-center pa-8">
                    <VIcon size="64" color="medium-emphasis" class="mb-4">ri-group-line</VIcon>
                    <div class="text-h6 mb-2">No hay aportes registrados</div>
                    <div class="text-body-2 text-medium-emphasis mb-4">Comienza registrando tu primer aporte</div>
                    <VBtn color="primary" prepend-icon="ri-add-line" @click="openCreateDialog">
                        Registrar Primer Aporte
                    </VBtn>
                </div>

                <div v-else>
                    <div v-for="dia in aportes" :key="dia.fecha" class="pa-4">
                        <div class="text-h6 font-weight-medium mb-3 text-primary-darken-1">
                            {{ dia.label }}
                            <VChip size="small" color="primary" variant="tonal" class="ml-2">
                                Total: {{ formatCurrency(dia.total_dia) }}
                            </VChip>
                        </div>

                        <VRow class="mb-4">
                            <VCol v-for="aporte in dia.aportes" :key="aporte.id" cols="12">
                                <VCard class="pa-4 rounded-lg elevation-2">
                                    <div class="d-flex align-center justify-space-between">
                                        <div class="d-flex align-center gap-3">
                                            <VAvatar size="40" color="primary" variant="tonal">
                                                <VIcon>ri-user-line</VIcon>
                                            </VAvatar>
                                            <div>
                                                <div class="font-weight-medium text-h6">
                                                    {{ aporte.partner_nombre }}
                                                </div>
                                                <div class="text-medium-emphasis text-body-2">
                                                    {{ aporte.descripcion }}
                                                </div>
                                                <div class="d-flex gap-2 mt-1">
                                                    <VChip size="x-small" color="primary" variant="tonal">
                                                        {{ aporte.cuenta }}
                                                    </VChip>
                                                    <VChip size="x-small"
                                                        :color="aporte.metodo_pago === 'EFECTIVO' ? 'success' : 'info'"
                                                        variant="tonal">
                                                        {{ aporte.metodo_pago }}
                                                    </VChip>
                                                    <span class="text-medium-emphasis text-caption">
                                                        {{ aporte.hora }} • {{ aporte.user_nombre }}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="d-flex align-center gap-2">
                                            <div class="text-right">
                                                <div class="text-h6 font-weight-bold text-success">
                                                    +{{ formatCurrency(aporte.monto) }}
                                                </div>
                                            </div>
                                            <VBtn icon="ri-edit-line" variant="text" size="small" color="primary"
                                                @click="openEditDialog(aporte)" title="Editar aporte">
                                                <VIcon />
                                            </VBtn>
                                            <VBtn icon="ri-delete-bin-line" variant="text" size="small" color="error"
                                                @click="deleteAporte(aporte)" title="Eliminar aporte">
                                                <VIcon />
                                            </VBtn>
                                        </div>
                                    </div>
                                </VCard>
                            </VCol>
                        </VRow>

                        <VDivider v-if="dia !== aportes[aportes.length - 1]" class="my-4" />
                    </div>
                </div>
            </VCardText>
        </VCard>
    </div>

    <!-- Diálogo de Crear Aportes -->
    <AporteCreateDialog v-model="showCreateDialog" @created="onAporteCreated" />

    <!-- Diálogo de Editar Aportes -->
    <AporteEditDialog v-model="showEditDialog" :aporte="editingAporte" @updated="onAporteUpdated" />

    <!-- Diálogo de Eliminar Aporte -->
    <VDialog v-model="showDeleteDialog" max-width="400" persistent>
        <VCard>
            <!-- Header -->
            <VCardTitle class="pa-6 pb-4">
                <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-3">
                        <VIcon icon="ri-delete-bin-line" color="error" size="28" />
                        <div>
                            <h3 class="text-h5 font-weight-bold">Eliminar Aporte</h3>
                            <span class="text-medium-emphasis text-body-2">
                                ¿Estás seguro de eliminar este aporte?
                            </span>
                        </div>
                    </div>
                    <VBtn icon="ri-close-line" variant="text" size="small" @click="closeDeleteDialog" />
                </div>
            </VCardTitle>

            <VDivider />

            <!-- Contenido -->
            <VCardText class="pa-6" v-if="aporteToDelete">
                <div class="d-flex flex-column gap-3">
                    <div class="d-flex align-center gap-2">
                        <VIcon color="primary" size="20">ri-user-line</VIcon>
                        <span class="text-body-2">
                            <strong>Socio:</strong> {{ aporteToDelete.partner_nombre }}
                        </span>
                    </div>

                    <div class="d-flex align-center gap-2">
                        <VIcon color="success" size="20">ri-money-dollar-box-line</VIcon>
                        <span class="text-body-2">
                            <strong>Monto:</strong> ${{ aporteToDelete.monto?.toFixed(2) }}
                        </span>
                    </div>

                    <div class="d-flex align-center gap-2">
                        <VIcon color="info" size="20">ri-calendar-line</VIcon>
                        <span class="text-body-2">
                            <strong>Fecha:</strong> {{ aporteToDelete.fecha }}
                        </span>
                    </div>
                </div>

                <VAlert type="warning" variant="tonal" class="mt-4">
                    <VIcon class="mr-2">ri-alert-line</VIcon>
                    Esta acción afectará el saldo de la cuenta y no se puede deshacer.
                </VAlert>
            </VCardText>

            <VDivider />

            <!-- Footer -->
            <VCardActions class="pa-6">
                <VSpacer />
                <VBtn variant="outlined" @click="closeDeleteDialog" :disabled="loading">
                    Cancelar
                </VBtn>
                <VBtn color="error" variant="elevated" @click="confirmDeleteAporte" :loading="loading">
                    Eliminar
                </VBtn>
            </VCardActions>
        </VCard>
    </VDialog>
</template>

<style scoped>
.bg-blue-lighten-4 {
    background-color: rgba(33, 150, 243, 0.1) !important;
}
</style>
