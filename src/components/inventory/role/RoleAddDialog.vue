<script setup>
import { ref, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { PERMISOS } from '@/utils/constants'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'addRole',
])

const loader = useLoaderStore()
const name = ref(null)
const permissions = ref([])
const warning = ref(null)
const error_exist = ref(null)
const success = ref(null)
const searchQuery = ref('')

// Todos los permisos planos
const allPermissionCodes = computed(() => {
  return PERMISOS.flatMap(m => (m.permisos || []).map(p => p.permiso))
})

const totalPermissionsCount = computed(() => allPermissionCodes.value.length)

// Módulos filtrados según el buscador
const filteredModules = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return PERMISOS

  return PERMISOS.filter(mod => {
    const matchModName = mod.name.toLowerCase().includes(q)
    const matchPerm = (mod.permisos || []).some(p => p.name.toLowerCase().includes(q) || p.permiso.toLowerCase().includes(q))
    return matchModName || matchPerm
  })
})

const togglePermission = permission => {
  const index = permissions.value.indexOf(permission)
  if (index !== -1) {
    permissions.value.splice(index, 1)
  } else {
    permissions.value.push(permission)
  }
}

const selectAll = () => {
  permissions.value = [...allPermissionCodes.value]
}

const clearAll = () => {
  permissions.value = []
}

const isModuleFullySelected = mod => {
  const modPerms = (mod.permisos || []).map(p => p.permiso)
  return modPerms.length > 0 && modPerms.every(p => permissions.value.includes(p))
}

const toggleModule = mod => {
  const modPerms = (mod.permisos || []).map(p => p.permiso)
  if (isModuleFullySelected(mod)) {
    // Quitar todos los de este módulo
    permissions.value = permissions.value.filter(p => !modPerms.includes(p))
  } else {
    // Agregar todos los faltantes de este módulo
    modPerms.forEach(p => {
      if (!permissions.value.includes(p)) {
        permissions.value.push(p)
      }
    })
  }
}

const getModuleSelectedCount = mod => {
  const modPerms = (mod.permisos || []).map(p => p.permiso)
  return modPerms.filter(p => permissions.value.includes(p)).length
}

const store = async () => {
  warning.value = null
  error_exist.value = null
  success.value = null

  if (!name.value || !name.value.trim()) {
    warning.value = "Ingresa un nombre para el nuevo rol."
    return
  }

  if (permissions.value.length === 0) {
    warning.value = "Selecciona al menos un permiso para el rol."
    return
  }

  loader.start()
  const data = {
    name: name.value.trim(),
    permissions: permissions.value,
  }

  try {
    const resp = await $api("role", {
      method: 'POST',
      body: data,
      onResponseError({ response }) {
        const errors = response?._data?.errors
        if (errors?.name && errors.name.length) {
          error_exist.value = errors.name[0]
        } else {
          error_exist.value = response?._data?.message || 'Error al crear el rol'
        }
      },
    })

    if (resp?.data) {
      emit("addRole", resp.data)
      onFormReset()
    }
  } catch (error) {
    console.error('Error al crear rol:', error)
  } finally {
    loader.stop()
  }
}

const onFormReset = () => {
  name.value = null
  permissions.value = []
  warning.value = null
  error_exist.value = null
  success.value = null
  searchQuery.value = ''
  emit('update:isDialogVisible', false)
}
</script>

<template>
  <VDialog
    scrollable
    :width="$vuetify.display.smAndDown ? 'auto' : 780"
    :model-value="props.isDialogVisible"
    transition="dialog-bottom-transition"
    @update:model-value="onFormReset"
  >
    <VCard class="rounded-xl overflow-hidden border elevation-24 bg-surface">
      <!-- Cabecera Visual Amigable -->
      <div class="pa-5 bg-grey-lighten-5 border-b position-relative">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="position-absolute"
          style="top: 12px; right: 12px;"
          @click="onFormReset"
        />

        <div class="d-flex align-center gap-3">
          <VAvatar size="50" color="primary" variant="tonal" rounded="xl" class="elevation-0 font-weight-bold">
            <VIcon icon="ri-shield-keyhole-line" size="26" />
          </VAvatar>

          <div>
            <h2 class="text-h5 font-weight-bold text-high-emphasis mb-0">
              Crear Nuevo Rol
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Asigna permisos granulares y define los niveles de acceso del personal
            </p>
          </div>
        </div>

        <!-- Indicador Dinámico de Permisos -->
        <div class="mt-4 pa-3 rounded-lg bg-surface border d-flex align-center justify-space-between flex-wrap gap-2">
          <div class="d-flex align-center gap-2">
            <VIcon icon="ri-checkbox-circle-fill" color="primary" size="20" />
            <span class="text-body-2 font-weight-bold text-high-emphasis">
              {{ permissions.length }} de {{ totalPermissionsCount }} permisos seleccionados
            </span>
          </div>

          <div class="d-flex align-center gap-2">
            <VBtn size="x-small" variant="tonal" color="primary" class="font-weight-medium" @click="selectAll">
              Seleccionar Todos
            </VBtn>
            <VBtn size="x-small" variant="text" color="error" class="font-weight-medium" @click="clearAll">
              Limpiar
            </VBtn>
          </div>
        </div>
      </div>

      <!-- Formulario y Permisos Scrollable -->
      <VCardText class="pa-5" style="max-height: 520px;">
        <VForm id="roleAddForm" @submit.prevent="store">
          <!-- Input Nombre del Rol -->
          <div class="mb-4">
            <VTextField
              v-model="name"
              label="Nombre del Rol *"
              placeholder="Ej: Administrador, Vendedor de Mostrador, Mecánico Líder..."
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="ri-shield-user-line"
              color="primary"
              hide-details="auto"
              class="mb-3"
            />

            <!-- Buscador interno de permisos -->
            <VTextField
              v-model="searchQuery"
              label="Filtrar permisos..."
              placeholder="Buscar por módulo o acción (ej: eliminar, ventas, autos)..."
              prepend-inner-icon="ri-search-2-line"
              variant="outlined"
              density="compact"
              hide-details
              clearable
            />
          </div>

          <!-- Alertas -->
          <VAlert v-if="warning" color="warning" variant="tonal" closable class="mb-3">
            <template #prepend><VIcon icon="ri-alert-line" /></template>
            {{ warning }}
          </VAlert>

          <VAlert v-if="error_exist" color="error" variant="tonal" closable class="mb-3">
            <template #prepend><VIcon icon="ri-error-warning-line" /></template>
            {{ error_exist }}
          </VAlert>

          <!-- Tarjetas de Módulos y Permisos -->
          <div class="d-flex flex-column gap-3">
            <VCard
              v-for="(mod, index) in filteredModules"
              :key="'mod-' + index"
              class="rounded-xl border elevation-0 pa-4 bg-surface"
            >
              <!-- Cabecera de Módulo -->
              <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-3">
                <div class="d-flex align-center gap-2">
                  <VAvatar size="28" :color="getModuleSelectedCount(mod) > 0 ? 'primary' : 'secondary'" variant="tonal" rounded="lg">
                    <VIcon icon="ri-folder-lock-line" size="16" />
                  </VAvatar>
                  <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                    {{ mod.name }}
                  </span>
                  <VChip
                    size="x-small"
                    :color="getModuleSelectedCount(mod) > 0 ? 'primary' : 'default'"
                    variant="tonal"
                    class="font-weight-bold ms-1"
                  >
                    {{ getModuleSelectedCount(mod) }}/{{ (mod.permisos || []).length }}
                  </VChip>
                </div>

                <VBtn
                  size="x-small"
                  :variant="isModuleFullySelected(mod) ? 'tonal' : 'outlined'"
                  :color="isModuleFullySelected(mod) ? 'primary' : 'secondary'"
                  class="font-weight-medium"
                  @click="toggleModule(mod)"
                >
                  {{ isModuleFullySelected(mod) ? 'Desmarcar todo' : 'Marcar todo el módulo' }}
                </VBtn>
              </div>

              <!-- Chips de Permisos -->
              <div class="d-flex flex-wrap gap-2">
                <VChip
                  v-for="(perm, pIdx) in mod.permisos"
                  :key="'perm-' + pIdx"
                  :color="permissions.includes(perm.permiso) ? 'primary' : 'default'"
                  :variant="permissions.includes(perm.permiso) ? 'elevated' : 'outlined'"
                  class="cursor-pointer font-weight-medium"
                  size="small"
                  :prepend-icon="permissions.includes(perm.permiso) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
                  @click="togglePermission(perm.permiso)"
                >
                  {{ perm.name }}
                </VChip>
              </div>
            </VCard>
          </div>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Footer con Acciones -->
      <VCardActions class="pa-4 bg-grey-lighten-5 d-flex justify-space-between align-center">
        <VBtn
          color="secondary"
          variant="outlined"
          class="rounded-lg px-5 font-weight-medium"
          @click="onFormReset"
        >
          Cancelar
        </VBtn>

        <VBtn
          type="submit"
          form="roleAddForm"
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-3-line"
          class="rounded-lg px-6 font-weight-bold elevation-2"
          :loading="loader.loading"
          :disabled="loader.loading"
        >
          Guardar Rol
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
