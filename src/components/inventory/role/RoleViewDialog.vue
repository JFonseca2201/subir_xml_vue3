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
    :width="$vuetify.display.smAndDown ? 'auto' : 750"
    :model-value="props.isDialogVisible"
    transition="dialog-bottom-transition"
    @update:model-value="closeDialog"
  >
    <VCard class="rounded-xl overflow-hidden border elevation-24 bg-surface">
      <!-- Cabecera Visual con Gradiente y Avatar -->
      <div class="pa-5 bg-grey-lighten-5 border-b position-relative">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="position-absolute"
          style="top: 12px; right: 12px;"
          @click="closeDialog"
        />

        <div class="d-flex align-center gap-4">
          <VAvatar
            size="56"
            :color="getRoleColor(roleSelected.name)"
            variant="tonal"
            rounded="xl"
            class="elevation-0 font-weight-bold"
          >
            <VIcon :icon="getRoleIcon(roleSelected.name)" size="30" />
          </VAvatar>

          <div class="flex-grow-1 min-w-0">
            <div class="d-flex align-center gap-2 mb-1 flex-wrap">
              <h2 class="text-h5 font-weight-bold text-high-emphasis text-uppercase mb-0">
                {{ roleSelected.name }}
              </h2>
              <VChip
                size="small"
                :color="getRoleColor(roleSelected.name)"
                variant="tonal"
                class="font-weight-semibold text-uppercase"
              >
                ID #{{ roleSelected.id }}
              </VChip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Registrado el {{ formatDate(roleSelected.created_at) }}
            </p>
          </div>
        </div>

        <!-- Banner de Cobertura de Permisos -->
        <div class="mt-4 pa-3 rounded-lg bg-surface border d-flex align-center justify-space-between flex-wrap gap-2">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-shield-check-line" color="primary" size="20" />
            <span class="text-body-2 font-weight-bold text-high-emphasis">
              {{ rolePermissions.length }} de {{ totalAvailablePermissions }} permisos habilitados
            </span>
          </div>
          <div class="text-caption text-medium-emphasis font-weight-medium">
            {{ Math.round((rolePermissions.length / (totalAvailablePermissions || 1)) * 100) }}% del sistema cubierto
          </div>
        </div>
      </div>

      <!-- Filtros internos del modal -->
      <div class="px-5 pt-4 pb-2 bg-surface">
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-3">
          <VTextField
            v-model="searchQuery"
            label="Buscar permiso o módulo..."
            placeholder="Ej: ventas, facturación, eliminar..."
            prepend-inner-icon="ri-search-2-line"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="w-100"
          />

          <VSwitch
            v-model="filterOnlyActive"
            label="Solo módulos con accesos"
            color="primary"
            density="compact"
            hide-details
            class="flex-shrink-0"
          />
        </div>
      </div>

      <!-- Lista de Módulos Scrollable -->
      <VCardText class="pa-5" style="max-height: 480px;">
        <div v-if="!modulesWithStatus.length" class="text-center py-8 text-medium-emphasis">
          <VAvatar size="54" color="grey-lighten-4" class="mb-3">
            <VIcon size="28" icon="ri-search-eye-line" color="medium-emphasis" />
          </VAvatar>
          <div class="text-subtitle-1 font-weight-bold">
            No se encontraron permisos coincidentes
          </div>
          <p class="text-caption text-disabled mb-0">
            Intenta cambiar el filtro o desmarca "Solo módulos con accesos"
          </p>
        </div>

        <div v-else class="d-flex flex-column gap-3">
          <VCard
            v-for="(mod, index) in modulesWithStatus"
            :key="'view-mod-' + index"
            class="rounded-xl border elevation-0 pa-4"
            :class="mod.hasActive ? 'bg-surface' : 'bg-grey-lighten-5 opacity-75'"
          >
            <!-- Cabecera del módulo -->
            <div class="d-flex align-center justify-space-between mb-2">
              <div class="d-flex align-center gap-2">
                <VAvatar size="30" :color="mod.hasActive ? 'primary' : 'secondary'" variant="tonal" rounded="lg">
                  <VIcon icon="ri-folder-keyhole-line" size="16" />
                </VAvatar>
                <h4 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0">
                  {{ mod.name }}
                </h4>
              </div>

              <VChip
                size="small"
                :color="mod.hasActive ? 'success' : 'default'"
                variant="tonal"
                class="font-weight-semibold"
              >
                {{ mod.activeCount }} / {{ mod.totalCount }} asignados
              </VChip>
            </div>

            <!-- Permisos del módulo -->
            <div class="d-flex flex-wrap gap-2 mt-3">
              <template v-if="filterOnlyActive">
                <div
                  v-for="(perm, pIdx) in mod.activePerms"
                  :key="'act-' + pIdx"
                  class="d-flex align-center gap-1.5 px-3 py-1.5 rounded-lg border bg-grey-lighten-5 text-caption font-weight-medium text-high-emphasis"
                >
                  <VIcon icon="ri-checkbox-circle-fill" size="14" color="success" />
                  <span>{{ perm.name }}</span>
                </div>
              </template>

              <template v-else>
                <div
                  v-for="(perm, pIdx) in mod.allPerms"
                  :key="'all-' + pIdx"
                  class="d-flex align-center gap-1.5 px-3 py-1.5 rounded-lg border text-caption font-weight-medium"
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
      <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-space-between align-center">
        <VBtn
          color="secondary"
          variant="outlined"
          class="rounded-lg px-5 font-weight-medium"
          @click="closeDialog"
        >
          Cerrar
        </VBtn>

        <VBtn
          v-if="can('edit_role') && roleSelected.id !== 1"
          color="primary"
          variant="elevated"
          prepend-icon="ri-pencil-line"
          class="rounded-lg px-5 font-weight-bold"
          @click="triggerEdit"
        >
          Editar Permisos
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
