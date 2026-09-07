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
    persistent
    transition="dialog-bottom-transition"
    @update:model-value="onFormReset"
  >
    <VCard class="custom-dialog-card role-dialog-card elevation-12">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary bg-primary text-white">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="onFormReset"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-shield-keyhole-line" />
        </div>
        <h3 class="custom-dialog-title">
          Crear Nuevo Rol
        </h3>
        <p class="custom-dialog-subtitle mb-2">
          Asigna permisos granulares y define los niveles de acceso del personal
        </p>

        <!-- Header Pills -->
        <div class="d-flex flex-wrap justify-center gap-2 mt-2">
          <div
            class="d-inline-flex align-center px-3 py-1 rounded-pill text-caption font-weight-bold"
            style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.28);"
          >
            <VIcon
              icon="ri-checkbox-circle-fill"
              size="14"
              class="me-1"
            />
            <span>{{ permissions.length }} de {{ totalPermissionsCount }} permisos seleccionados</span>
          </div>
        </div>
      </div>

      <!-- Formulario y Permisos Scrollable -->
      <VCardText class="pa-6">
        <VForm
          id="roleAddForm"
          @submit.prevent="store"
        >
          <!-- Input Nombre del Rol y Buscador en Rejilla limpia -->
          <VRow class="mb-2">
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="name"
                label="Nombre del Rol *"
                placeholder="Ej: Supervisor de Taller, Vendedor..."
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-shield-user-line"
                color="primary"
                hide-details="auto"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="searchQuery"
                placeholder="Filtrar permisos o módulos..."
                prepend-inner-icon="ri-search-2-line"
                variant="outlined"
                density="comfortable"
                hide-details
                clearable
              />
            </VCol>
          </VRow>

          <!-- Acciones Rápidas de Selección -->
          <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-4 pa-3 bg-grey-lighten-5 rounded-lg border">
            <div class="d-flex align-center gap-2 text-caption text-medium-emphasis">
              <VIcon
                icon="ri-information-line"
                size="16"
              />
              <span>Haz clic en un permiso para activarlo o usa las acciones masivas</span>
            </div>

            <div class="d-flex align-center gap-2">
              <VBtn
                size="small"
                variant="tonal"
                color="primary"
                class="font-weight-medium"
                prepend-icon="ri-checkbox-multiple-line"
                @click="selectAll"
              >
                Marcar Todos
              </VBtn>
              <VBtn
                size="small"
                variant="outlined"
                color="secondary"
                class="font-weight-medium"
                prepend-icon="ri-close-circle-line"
                @click="clearAll"
              >
                Desmarcar Todos
              </VBtn>
            </div>
          </div>

          <!-- Alertas -->
          <VAlert
            v-if="warning"
            color="warning"
            variant="tonal"
            closable
            class="mb-3"
          >
            <template #prepend><VIcon icon="ri-alert-line" /></template>
            {{ warning }}
          </VAlert>

          <VAlert
            v-if="error_exist"
            color="error"
            variant="tonal"
            closable
            class="mb-3"
          >
            <template #prepend><VIcon icon="ri-error-warning-line" /></template>
            {{ error_exist }}
          </VAlert>

          <!-- Tarjetas de Módulos y Permisos -->
          <div class="d-flex flex-column gap-3">
            <VCard
              v-for="(mod, index) in filteredModules"
              :key="'mod-' + index"
              class="pa-4 info-card-flat"
              variant="outlined"
            >
              <!-- Cabecera de Módulo -->
              <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-3">
                <div class="d-flex align-center gap-2">
                  <VAvatar
                    size="30"
                    :color="getModuleSelectedCount(mod) > 0 ? 'primary' : 'secondary'"
                    variant="tonal"
                    rounded="lg"
                  >
                    <VIcon
                      icon="ri-folder-lock-line"
                      size="16"
                    />
                  </VAvatar>
                  <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
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
                  {{ isModuleFullySelected(mod) ? 'Desmarcar todo' : 'Marcar módulo' }}
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
      <VCardActions
        class="pa-4 bg-white d-flex justify-end align-center gap-3"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
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
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loader.loading"
          :disabled="loader.loading"
        >
          Guardar Rol
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
