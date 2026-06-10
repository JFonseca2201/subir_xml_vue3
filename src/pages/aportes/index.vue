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
  total_general: 0,
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
        total_general: 0,
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

const openEditDialog = aporte => {
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

const formatCurrency = value => {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

const openDeleteDialog = aporte => {
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
      method: 'DELETE',
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

const deleteAporte = aporte => {
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
  <div
    v-if="!canAccessAportes"
    class="d-flex justify-center align-center"
    style="height: 400px"
  >
    <VCard class="pa-6 text-center">
      <VIcon
        size="64"
        color="error"
        class="mb-4"
      >
        ri-lock-line
      </VIcon>
      <h3 class="text-h5 mb-2">
        Acceso Restringido
      </h3>
      <p class="text-medium-emphasis">
        No tienes permisos para acceder a la gestión de aportes de capital.
      </p>
      <VBtn
        color="primary"
        class="mt-4"
        @click="router.push('/dashboard')"
      >
        Volver al Dashboard
      </VBtn>
    </VCard>
  </div>
  <div
    v-else
    class="pa-4 pa-sm-6"
  >
    <!-- Cabecera Estandarizada -->
    <VRow class="mb-4 mt-2">
      <VCol>
        <div class="d-flex align-center justify-space-between flex-wrap gap-4">
          <div class="d-flex align-center gap-3">
            <VAvatar color="primary" variant="tonal" rounded size="48">
              <VIcon icon="ri-group-line" size="28" />
            </VAvatar>
            <div>
              <h4 class="text-h5 font-weight-bold mb-1">Aportes de Capital</h4>
              <span class="text-body-2 text-medium-emphasis">Gestión de aportes de socios y control de capital</span>
            </div>
          </div>
          <VBtn color="primary" variant="elevated" prepend-icon="ri-add-line" @click="openCreateDialog">
            Nuevo Aporte
          </VBtn>
        </div>
      </VCol>
    </VRow>

    <!-- Tarjetas de Resumen -->
    <VRow class="mb-6">
      <VCol
        cols="12"
        md="6"
        lg="4"
      >
        <VCard
          class="pa-6 rounded-lg elevation-3"
          color="primary"
          variant="tonal"
        >
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-h6 font-weight-medium text-primary-darken-1 mb-2">
                Aportes Hoy
              </div>
              <div class="text-h4 font-weight-bold text-primary">
                {{ formatCurrency(resumen.total_hoy) }}
              </div>
            </div>
            <VIcon
              size="48"
              color="primary"
            >
              ri-calendar-today-line
            </VIcon>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
        lg="4"
      >
        <VCard class="pa-6 rounded-lg elevation-3">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-h6 font-weight-medium mb-2">
                Aportes del Mes
              </div>
              <div class="text-h4 font-weight-bold">
                {{ formatCurrency(resumen.total_mes) }}
              </div>
            </div>
            <VIcon
              size="48"
              color="success"
            >
              ri-calendar-line
            </VIcon>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
        lg="4"
      >
        <VCard class="pa-6 rounded-lg elevation-3">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-h6 font-weight-medium mb-2">
                Total General
              </div>
              <div class="text-h4 font-weight-bold">
                {{ formatCurrency(resumen.total_general) }}
              </div>
            </div>
            <VIcon
              size="48"
              color="info"
            >
              ri-money-dollar-box-line
            </VIcon>
          </div>
        </VCard>
      </VCol>
    </VRow>

    <!-- Lista de Aportes -->
    <VCard elevation="2" class="rounded-lg">
      <VCardItem class="pa-4 border-b">
        <template #title>
          <div class="d-flex align-center gap-2">
            <VIcon color="primary" icon="ri-history-line" />
            <span class="text-h6 font-weight-bold">Historial de Aportes</span>
          </div>
        </template>
      </VCardItem>

      <VCardText class="pa-0">
        <div v-if="loading" class="text-center pa-12">
          <VProgressCircular indeterminate color="primary" size="48" />
          <div class="text-body-1 mt-4 text-medium-emphasis">Cargando aportes...</div>
        </div>

        <div v-else-if="!aportes.length" class="text-center pa-12">
          <VAvatar color="grey-lighten-3" size="72" class="mb-4">
            <VIcon icon="ri-group-line" size="36" color="grey" />
          </VAvatar>
          <h3 class="text-h6 font-weight-medium">No hay aportes registrados</h3>
          <p class="text-body-2 text-medium-emphasis mb-4">Comienza registrando tu primer aporte</p>
          <VBtn color="primary" variant="tonal" prepend-icon="ri-add-line" @click="openCreateDialog">Registrar Aporte</VBtn>
        </div>

        <div v-else>
          <VList lines="two" bg-color="transparent" class="pa-0">
            <template v-for="(dia, diaIndex) in aportes" :key="dia.fecha">
              <VListSubheader class="text-subtitle-1 font-weight-bold text-primary mt-2">
                {{ dia.label }}
                <VChip size="small" color="primary" variant="tonal" class="ml-3 font-weight-bold">
                  Total: {{ formatCurrency(dia.total_dia) }}
                </VChip>
              </VListSubheader>

              <VListItem
                v-for="(aporte, index) in dia.aportes"
                :key="aporte.id"
                class="border-b hover-bg-light"
                :class="{ 'border-0': index === dia.aportes.length - 1 && diaIndex === aportes.length - 1 }"
              >
                <template #prepend>
                  <VAvatar size="40" color="primary" variant="tonal" class="mr-3">
                    <VIcon icon="ri-user-line" />
                  </VAvatar>
                </template>

                <VListItemTitle class="font-weight-medium text-body-1">{{ aporte.partner_nombre }}</VListItemTitle>
                <VListItemSubtitle class="text-body-2 mt-1">
                  {{ aporte.descripcion }}
                  <div class="d-flex gap-2 mt-2 align-center">
                    <VChip size="x-small" color="primary" variant="tonal">{{ aporte.cuenta }}</VChip>
                    <VChip size="x-small" :color="aporte.metodo_pago === 'EFECTIVO' ? 'success' : 'info'" variant="tonal">{{ aporte.metodo_pago }}</VChip>
                    <span class="text-caption text-medium-emphasis ms-2">{{ aporte.hora }} • {{ aporte.user_nombre }}</span>
                  </div>
                </VListItemSubtitle>

                <template #append>
                  <div class="d-flex align-center gap-4">
                    <span class="text-body-1 font-weight-bold text-success">+{{ formatCurrency(aporte.monto) }}</span>
                    <div class="d-flex gap-1">
                      <VBtn title="Editar" icon="ri-edit-line" variant="tonal" size="small" color="primary" @click="openEditDialog(aporte)" />
                      <VBtn title="Eliminar" icon="ri-delete-bin-line" variant="tonal" size="small" color="error" @click="deleteAporte(aporte)" />
                    </div>
                  </div>
                </template>
              </VListItem>
            </template>
          </VList>
        </div>
      </VCardText>
    </VCard>
  </div>

  <!-- Diálogo de Crear Aportes -->
  <AporteCreateDialog
    v-model="showCreateDialog"
    @created="onAporteCreated"
  />

  <!-- Diálogo de Editar Aportes -->
  <AporteEditDialog
    v-model="showEditDialog"
    :aporte="editingAporte"
    @updated="onAporteUpdated"
  />

  <!-- Diálogo de Eliminar Aporte -->
  <VDialog
    v-model="showDeleteDialog"
    max-width="400"
    persistent
  >
    <VCard>
      <!-- Header -->
      <VCardTitle class="pa-6 pb-4">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-3">
            <VIcon
              icon="ri-delete-bin-line"
              color="error"
              size="28"
            />
            <div>
              <h3 class="text-h5 font-weight-bold">
                Eliminar Aporte
              </h3>
              <span class="text-medium-emphasis text-body-2">
                ¿Estás seguro de eliminar este aporte?
              </span>
            </div>
          </div>
          <VBtn
            icon="ri-close-line"
            variant="text"
            size="small"
            @click="closeDeleteDialog"
          />
        </div>
      </VCardTitle>

      <VDivider />

      <!-- Contenido -->
      <VCardText
        v-if="aporteToDelete"
        class="pa-6"
      >
        <div class="d-flex flex-column gap-3">
          <div class="d-flex align-center gap-2">
            <VIcon
              color="primary"
              size="20"
            >
              ri-user-line
            </VIcon>
            <span class="text-body-2">
              <strong>Socio:</strong> {{ aporteToDelete.partner_nombre }}
            </span>
          </div>

          <div class="d-flex align-center gap-2">
            <VIcon
              color="success"
              size="20"
            >
              ri-money-dollar-box-line
            </VIcon>
            <span class="text-body-2">
              <strong>Monto:</strong> ${{ aporteToDelete.monto?.toFixed(2) }}
            </span>
          </div>

          <div class="d-flex align-center gap-2">
            <VIcon
              color="info"
              size="20"
            >
              ri-calendar-line
            </VIcon>
            <span class="text-body-2">
              <strong>Fecha:</strong> {{ aporteToDelete.fecha }}
            </span>
          </div>
        </div>

        <VAlert
          type="warning"
          variant="tonal"
          class="mt-4"
        >
          <VIcon class="mr-2">
            ri-alert-line
          </VIcon>
          Esta acción afectará el saldo de la cuenta y no se puede deshacer.
        </VAlert>
      </VCardText>

      <VDivider />

      <!-- Footer -->
      <VCardActions class="pa-6">
        <VSpacer />
        <VBtn
          variant="outlined"
          :disabled="loading"
          @click="closeDeleteDialog"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="error"
          variant="elevated"
          :loading="loading"
          @click="confirmDeleteAporte"
        >
          Eliminar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>



<route lang="yaml">
meta:
  navActiveLink: 'operations-index'
</route>
