<script setup>
import { ref, computed } from 'vue'
import { PERMISOS } from '@/utils/constants'
import { usePermissions } from '@/composables/usePermissions'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  roleSelected: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'editRole',
])

const { can } = usePermissions()
const searchQuery = ref('')
const filterOnlyActive = ref(true)

// Extraer permisos del rol (maneja array de strings o array de objetos)
const rolePermissions = computed(() => {
  if (!props.roleSelected) return []
  const perms = props.roleSelected.permissions_pluck || props.roleSelected.permissions || []
  return perms.map(p => (typeof p === 'object' && p ? p.name || p.permiso : p))
})

// Total de permisos posibles en el sistema
const totalAvailablePermissions = computed(() => {
  return PERMISOS.reduce((acc, mod) => acc + (mod.permisos?.length || 0), 0)
})

// Módulos con estado de permisos asignados
const modulesWithStatus = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return PERMISOS.map(mod => {
    const modPerms = mod.permisos || []
    const activePerms = modPerms.filter(p => rolePermissions.value.includes(p.permiso))

    return {
      name: mod.name,
      totalCount: modPerms.length,
      activeCount: activePerms.length,
      activePerms,
      allPerms: modPerms,
      hasActive: activePerms.length > 0,
    }
  }).filter(mod => {
    if (filterOnlyActive.value && !mod.hasActive) return false
    if (!query) return true

    const matchModuleName = mod.name.toLowerCase().includes(query)
    const matchPermName = mod.allPerms.some(p => p.name.toLowerCase().includes(query) || p.permiso.toLowerCase().includes(query))
    return matchModuleName || matchPermName
  })
})

const getRoleColor = roleName => {
  const name = (roleName || '').toLowerCase()
  if (name.includes('admin')) return 'warning'
  if (name.includes('vendedor') || name.includes('seller')) return 'success'
  if (name.includes('gerente') || name.includes('manager')) return 'primary'
  return 'secondary'
}

const getRoleIcon = roleName => {
  const name = (roleName || '').toLowerCase()
  if (name.includes('admin')) return 'ri-vip-crown-line'
  if (name.includes('vendedor') || name.includes('seller')) return 'ri-shopping-cart-line'
  if (name.includes('gerente') || name.includes('manager')) return 'ri-briefcase-4-line'
  return 'ri-shield-user-line'
}

const formatDate = dateStr => {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr.replace ? dateStr.replace(' ', 'T') : dateStr)
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const closeDialog = () => {
  emit('update:isDialogVisible', false)
}

const triggerEdit = () => {
  closeDialog()
  emit('editRole', props.roleSelected)
}
</script>

<template>
  <VDialog
    scrollable
    :width="$vuetify.display.smAndDown ? 'auto' : 760"
    :model-value="props.isDialogVisible"
    persistent
    transition="dialog-bottom-transition"
    @update:model-value="closeDialog"
  >
    <VCard class="custom-dialog-card role-view-card elevation-12">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon :icon="getRoleIcon(roleSelected.name)" />
        </div>
        <h3 class="custom-dialog-title text-capitalize">
          {{ roleSelected.name }}
        </h3>
        <p class="custom-dialog-subtitle mb-2">
          Detalle del perfil y matriz de permisos del sistema
        </p>

        <!-- Header Pills -->
        <div class="d-flex flex-wrap justify-center gap-2 mt-2">
          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.28);"
          >
            <VIcon
              icon="ri-hashtag"
              size="14"
              class="me-1"
            />
            <span>ID #{{ roleSelected.id }}</span>
          </div>

          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-bold"
            style="background: rgba(16, 185, 129, 0.25); color: #ffffff; border: 1px solid rgba(16, 185, 129, 0.5);"
          >
            <VIcon
              icon="ri-shield-check-line"
              size="14"
              class="me-1"
            />
            <span>{{ rolePermissions.length }} de {{ totalAvailablePermissions }} permisos</span>
          </div>

          <div
            v-if="roleSelected.created_at"
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-medium"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.28);"
          >
            <VIcon
              icon="ri-calendar-line"
              size="14"
              class="me-1"
            />
            <span>Registrado: {{ formatDate(roleSelected.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Contenido Principal -->
      <VCardText class="pa-6">
        <!-- Grid de Especificaciones Rápidas (Brochure Style) -->
        <div class="specs-container mb-5">
          <div class="spec-badge-card">
            <span class="spec-label">Permisos</span>
            <span class="spec-value text-primary font-weight-bold">{{ rolePermissions.length }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Total Sistema</span>
            <span class="spec-value font-weight-bold">{{ totalAvailablePermissions }}</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Módulos</span>
            <span class="spec-value font-weight-bold">{{ modulesWithStatus.filter(m => m.hasActive).length }} activos</span>
          </div>
          <div class="spec-badge-card">
            <span class="spec-label">Cobertura</span>
            <span class="spec-value text-success font-weight-bold">
              {{ Math.round((rolePermissions.length / (totalAvailablePermissions || 1)) * 100) }}%
            </span>
          </div>
        </div>

        <!-- Barra de Búsqueda y Filtro de Módulos -->
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3 mb-4">
          <VTextField
            v-model="searchQuery"
            placeholder="Buscar permiso o módulo..."
            prepend-inner-icon="ri-search-2-line"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="w-100"
          />

          <VSwitch
            v-model="filterOnlyActive"
            label="Solo con accesos"
            color="primary"
            density="compact"
            hide-details
            class="flex-shrink-0"
          />
        </div>

        <!-- Listado de Módulos -->
        <div
          v-if="!modulesWithStatus.length"
          class="text-center py-8 text-medium-emphasis"
        >
          <VAvatar
            size="54"
            color="grey-lighten-4"
            class="mb-3"
          >
            <VIcon
              size="28"
              icon="ri-search-eye-line"
              color="medium-emphasis"
            />
          </VAvatar>
          <div class="text-subtitle-1 font-weight-bold">
            No se encontraron permisos coincidentes
          </div>
          <p class="text-caption text-disabled mb-0">
            Intenta cambiar el filtro o desmarca "Solo con accesos"
          </p>
        </div>

        <div
          v-else
          class="d-flex flex-column gap-3"
        >
          <VCard
            v-for="(mod, index) in modulesWithStatus"
            :key="'view-mod-' + index"
            class="pa-4 info-card-flat"
            variant="outlined"
            :class="mod.hasActive ? '' : 'opacity-60 bg-grey-lighten-5'"
          >
            <!-- Cabecera del módulo -->
            <div class="d-flex align-center justify-space-between mb-2">
              <div class="d-flex align-center gap-2">
                <VAvatar
                  size="30"
                  :color="mod.hasActive ? 'primary' : 'secondary'"
                  variant="tonal"
                  rounded="lg"
                >
                  <VIcon
                    icon="ri-folder-keyhole-line"
                    size="16"
                  />
                </VAvatar>
                <h4 class="text-subtitle-2 font-weight-bold text-high-emphasis mb-0">
                  {{ mod.name }}
                </h4>
              </div>

              <VChip
                size="x-small"
                :color="mod.hasActive ? 'success' : 'default'"
                variant="tonal"
                class="font-weight-semibold"
              >
                {{ mod.activeCount }} / {{ mod.totalCount }} asignados
              </VChip>
            </div>

            <!-- Permisos del módulo -->
            <div class="d-flex flex-wrap gap-2 mt-2">
              <template v-if="filterOnlyActive">
                <div
                  v-for="(perm, pIdx) in mod.activePerms"
                  :key="'act-' + pIdx"
                  class="d-flex align-center gap-1.5 px-2.5 py-1 rounded-lg border bg-grey-lighten-5 text-caption font-weight-medium text-high-emphasis"
                >
                  <VIcon
                    icon="ri-checkbox-circle-fill"
                    size="14"
                    color="success"
                  />
                  <span>{{ perm.name }}</span>
                </div>
              </template>

              <template v-else>
                <div
                  v-for="(perm, pIdx) in mod.allPerms"
                  :key="'all-' + pIdx"
                  class="d-flex align-center gap-1.5 px-2.5 py-1 rounded-lg border text-caption font-weight-medium"
                  :class="rolePermissions.includes(perm.permiso) ? 'bg-grey-lighten-5 text-high-emphasis' : 'bg-transparent text-disabled text-decoration-line-through'"
                >
                  <VIcon
                    :icon="rolePermissions.includes(perm.permiso) ? 'ri-checkbox-circle-fill' : 'ri-close-circle-line'"
                    size="14"
                    :color="rolePermissions.includes(perm.permiso) ? 'success' : 'medium-emphasis'"
                  />
                  <span>{{ perm.name }}</span>
                </div>
              </template>
            </div>
          </VCard>
        </div>
      </VCardText>

      <VDivider />

      <!-- Footer con Acciones -->
      <VCardActions
        class="pa-4 bg-white d-flex justify-space-between align-center"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>

        <VBtn
          v-if="can('edit_role') && roleSelected.id !== 1"
          color="primary"
          variant="elevated"
          prepend-icon="ri-pencil-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          @click="triggerEdit"
        >
          Editar Permisos
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
