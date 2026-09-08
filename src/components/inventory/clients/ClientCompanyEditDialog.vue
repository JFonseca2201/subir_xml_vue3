<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  clientData: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:isDialogVisible', 'clientUpdated'])

// Estado del formulario
const loading = ref(false)
const error = ref('')
const success = ref('')
const userStore = JSON.parse(localStorage.getItem('user'))

// Notificaciones
const notificationShow = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const showNotification = (message, type = 'success') => {
  notificationMessage.value = message
  notificationType.value = type
  notificationShow.value = true
}

// Formulario de cliente empresa (mismos campos que ClientFinalAddDialog)
const clientForm = ref({
  id: '',
  name: '', // No se usa para empresas
  surname: '', // No se usa para empresas
  full_name: '', // Se llenará manualmente
  phone: '',
  email: '',
  type_client: 2, // Cliente empresa = Jurídico
  type_document: 2, // RUC por defecto
  n_document: '',
  birth_date: '', // Fecha de constitución
  user_id: 1, // ID de usuario por defecto (no nulo)
  sucursale_id: 1, // Por defecto 1
  state: 1, // Activo por defecto
  gender: '', // No aplica para empresas
  ubigeo_region: '',
  ubigeo_provincia: '',
  ubigeo_ciudad: '',
  region: '',
  provincia: '',
  distrito: '',
  address: '',
})

const documentMaxLength = computed(() => {
  const type = Number(clientForm.value.type_document)
  if (type === 1) return 10
  if (type === 2) return 13
  
  return 20 // Pasaporte u otros
})

watch(() => clientForm.value.type_document, newType => {
  const type = Number(newType)
  const maxLen = type === 1 ? 10 : (type === 2 ? 13 : 20)
  if (clientForm.value.n_document && clientForm.value.n_document.length > maxLen) {
    clientForm.value.n_document = clientForm.value.n_document.substring(0, maxLen)
  }
})

// Opciones para selects
const typeDocumentOptions = ref([
  { title: 'Cédula', value: 1 },
  { title: 'RUC', value: 2 },
  { title: 'Pasaporte', value: 3 },
])

const genderOptions = ref([
  { title: 'Masculino', value: '1' },
  { title: 'Femenino', value: '2' },
])

// Opciones para estado (1 = Activo, 2 = Inactivo)
const stateOptions = ref([
  { title: 'Activo', value: 1 },
  { title: 'Inactivo', value: 2 },
])

const sucursales = ref([])

// Referencias del formulario
const formRef = ref(null)

// Validación para RUC ecuatoriano
const validateEcuadorianRUC = ruc => {
  if (!ruc) return true

  // Eliminar espacios y guiones
  let cleanRUC = ruc.replace(/[\s-]/g, '')

  // Si tiene 10 dígitos y el tercer dígito es 6 o 9, normalizar a RUC
  if (cleanRUC.length === 10) {
    const tercerDigit = parseInt(cleanRUC.substring(2, 3))
    if ([6, 9].includes(tercerDigit)) {
      cleanRUC += '001'
    }
  }

  // Verificar que tenga 13 dígitos
  if (!/^\d{13}$/.test(cleanRUC)) {
    return false
  }

  // El tercer dígito indica el tipo de persona (natural o jurídica)
  const tercerDigito = parseInt(cleanRUC.substring(2, 3))
    
  if (tercerDigito < 6) {
    // Persona natural: los primeros 10 dígitos deben ser una cédula válida
    return validateEcuadorianCedula(cleanRUC.substring(0, 10))
  } else if (![6, 9].includes(tercerDigito)) {
    // Persona jurídica o pública: 3er dígito debe ser 6 o 9
    return false
  }

  return true
}

// Reglas de validación
const rules = {
  full_name: [
    v => !!v || 'El nombre completo es requerido',
    v => (v && v.length >= 3) || 'El nombre completo debe tener al menos 3 caracteres',
  ],
  n_document: [
    v => !!v || 'El número de documento es requerido',
    v => (v && (v.replace(/[\s-]/g, '').length === 10 || v.replace(/[\s-]/g, '').length === 13)) || 'El RUC debe tener 10 o 13 dígitos',
    v => validateEcuadorianRUC(v) || 'RUC ecuatoriano inválido',
  ],
  email: [
    v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email inválido',
  ],
  phone: [
    v => !v || /^\d{10}$/.test(String(v).replace(/\D/g, '')) || 'El teléfono debe tener 10 dígitos',
  ],
  state: [
    v => !!v || 'El estado es requerido',
    v => [1, 2].includes(v) || 'El estado debe ser 1 (Activo) o 2 (Inactivo)',
  ],
}

// Cargar datos del cliente al montar
const loadClientData = () => {
  if (props.clientData) {
    clientForm.value = {
      ...props.clientData,
      user_id: userStore.id || 1,

      // Convertir string a número para que el VSelect funcione correctamente
      type_client: parseInt(props.clientData.type_client) || 2,
      type_document: parseInt(props.clientData.type_document) || 2,
      state: parseInt(props.clientData.state) || 1,
    }
  }
}

// Actualizar cliente empresa
const updateClient = async () => {
  if (clientForm.value.n_document) {
    const cleanDoc = clientForm.value.n_document.replace(/[\s-]/g, '')
    if (cleanDoc.length === 10) {
      const thirdDigit = parseInt(cleanDoc.substring(2, 3))
      if ([6, 9].includes(thirdDigit)) {
        clientForm.value.n_document = cleanDoc + '001'
      }
    }
  }

  const { valid } = await formRef.value?.validate()
  if (!valid) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    console.log('Datos del cliente empresa a actualizar:', clientForm.value)

    // Convertir campos a strings para validación del backend
    const clientData = {
      ...clientForm.value,
      type_client: clientForm.value.type_client.toString(),
      type_document: clientForm.value.type_document.toString(),
      state: clientForm.value.state.toString(),
      name: clientForm.value.full_name, // Usar full_name como name
      surname: '', // Las empresas no tienen apellido
    }

    console.log('Datos corregidos para enviar:', clientData)

    const resp = await $api(`clients/${clientForm.value.id}`, {
      method: "PUT",
      body: clientData,
      onResponseError({ response }) {
        error.value = response._data?.message || 'Error al actualizar cliente'
        console.error('Error response:', response._data)
      },
    })

    console.log('Respuesta del servidor:', resp)

    if (resp.status === 200 || resp.status === 201) {
      success.value = 'Cliente empresa actualizado correctamente'
      showNotification('Cliente empresa actualizado correctamente', 'success')

      // Emitir datos actualizados (usar resp.data o clientForm.value como fallback)
      const updatedData = resp.data ?? clientForm.value

      console.log('Datos emitidos:', updatedData)

      // Cerrar diálogo después de un momento
      setTimeout(() => {
        emit('update:isDialogVisible', false)
        emit('clientUpdated', updatedData)
      }, 1500)
    } else {
      error.value = resp.message || 'Error al actualizar cliente'
      showNotification(resp.message || 'Error al actualizar cliente', 'error')
    }
  } catch (error) {
    console.error('Error al actualizar cliente:', error)
    error.value = 'Error al actualizar cliente. Intente nuevamente.'
    showNotification('Error al actualizar cliente. Intente nuevamente.', 'error')
  } finally {
    loading.value = false
  }
}

// Resetear formulario
const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetValidation()
  }
}

// Cerrar diálogo
const closeDialog = () => {
  emit('update:isDialogVisible', false)
  resetForm()
}

// Watch para cambios en clientData
watch(() => props.clientData, newData => {
  if (newData) {
    loadClientData()
  }
}, { immediate: true })

watch(() => clientForm.value.n_document, newVal => {
  if (newVal) {
    const cleanDoc = newVal.replace(/[\s-]/g, '')
    const type = Number(clientForm.value.type_document)
    if (cleanDoc.length === 10) {
      const thirdDigit = parseInt(cleanDoc.substring(2, 3))
      if ([6, 9].includes(thirdDigit) && type !== 2) {
        clientForm.value.type_document = 2
      }
    }
  }
})

const filterDocumentKey = event => {
  if (event.key && event.key.length > 1) return
  const type = Number(clientForm.value.type_document)
  const charStr = event.key || String.fromCharCode(event.keyCode || event.which)
  if (type === 1 || type === 2) {
    if (!/^[0-9]$/.test(charStr)) {
      event.preventDefault()
    }
  } else if (type === 3) {
    if (!/^[a-zA-Z0-9]$/.test(charStr)) {
      event.preventDefault()
    }
  }
}

const filterPhoneKey = event => {
  if (event.key && event.key.length > 1) return
  const charStr = event.key || String.fromCharCode(event.keyCode || event.which)
  if (!/^[0-9]$/.test(charStr)) {
    event.preventDefault()
  }
}

const regions = ref([])
const provinces = ref([])
const districts = ref([])

const loadRegions = async () => {
  try {
    const resp = await $api('geographic/regions', { method: 'GET' })

    regions.value = resp
  } catch (e) {
    console.error(e)
  }
}

watch(() => clientForm.value.ubigeo_region, async newVal => {
  if (newVal) {
    try {
      const resp = await $api(`geographic/provinces/${newVal}`, { method: 'GET' })

      provinces.value = resp
      clientForm.value.region = regions.value.find(r => r.id === newVal)?.name || ''
    } catch (e) {
      console.error(e)
    }
  } else {
    provinces.value = []
    districts.value = []
    clientForm.value.ubigeo_provincia = ''
    clientForm.value.ubigeo_distrito = ''
    clientForm.value.region = ''
  }
})

watch(() => clientForm.value.ubigeo_provincia, async newVal => {
  if (newVal) {
    try {
      const resp = await $api(`geographic/cities/${newVal}`, { method: 'GET' })

      districts.value = resp
      clientForm.value.provincia = provinces.value.find(p => p.id === newVal)?.name || ''
    } catch (e) {
      console.error(e)
    }
  } else {
    districts.value = []
    clientForm.value.ubigeo_distrito = ''
    clientForm.value.provincia = ''
  }
})

watch(() => clientForm.value.ubigeo_distrito, newVal => {
  if (newVal) {
    clientForm.value.distrito = districts.value.find(d => d.id === newVal)?.name || ''
  } else {
    clientForm.value.distrito = ''
  }
})

// Montar componente
onMounted(() => {
  loadRegions()
  clientForm.value.user_id = userStore.id
  loadClientData()
  if (props.clientData) {
    setTimeout(async () => {
      if (props.clientData.ubigeo_region) {
        provinces.value = await $api(`geographic/provinces/${props.clientData.ubigeo_region}`, { method: 'GET' })
      }
      if (props.clientData.ubigeo_provincia) {
        districts.value = await $api(`geographic/cities/${props.clientData.ubigeo_provincia}`, { method: 'GET' })
      }
    }, 100)
  }
})
</script>

<template>
  <VDialog
    scrollable
    max-width="820"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="closeDialog"
  >
    <VCard class="custom-dialog-card pa-0 rounded-xl overflow-hidden">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-building-line" />
        </div>
        <h3 class="custom-dialog-title">
          Editar Cliente Empresa
        </h3>
        <p class="custom-dialog-subtitle">
          Modifica la información registrada de la persona jurídica
        </p>
      </div>

      <VCardText class="pa-sm-6 pa-4">
        <!-- Form -->
        <VForm
          id="clientCompanyEditForm"
          ref="formRef"
          @submit.prevent="updateClient"
        >
          <VRow>
            <!-- 👉 Sección 1: Identificación Tributaria y Estado -->
            <VCol cols="12" class="pb-1 pt-1">
              <div class="d-flex align-center gap-2 mb-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                  <VIcon size="16" icon="ri-id-card-line" />
                </VAvatar>
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.5px;">
                  1. Identificación Tributaria y Estado
                </span>
              </div>
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VSelect
                v-model="clientForm.type_document"
                :items="typeDocumentOptions"
                item-title="title"
                item-value="value"
                label="Tipo de Documento *"
                prepend-inner-icon="ri-article-line"
                density="compact"
                variant="outlined"
              />
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VTextField
                v-model="clientForm.n_document"
                label="Número de RUC *"
                placeholder="13 dígitos (ej: 0991234567001)"
                prepend-inner-icon="ri-fingerprint-line"
                :rules="rules.n_document"
                density="compact"
                variant="outlined"
                clearable
                :maxlength="documentMaxLength"
                @keypress="filterDocumentKey"
              />
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VSelect
                v-model="clientForm.state"
                :items="stateOptions"
                item-title="title"
                item-value="value"
                label="Estado de la Empresa *"
                prepend-inner-icon="ri-toggle-line"
                density="compact"
                variant="outlined"
              >
                <template #selection="{ item }">
                  <VChip
                    :color="item.raw.value === 1 ? 'success' : 'error'"
                    size="small"
                    variant="tonal"
                    class="font-weight-bold"
                  >
                    {{ item.title }}
                  </VChip>
                </template>
                <template #item="{ props: itemProps, item }">
                  <VListItem v-bind="itemProps">
                    <template #prepend>
                      <VBadge
                        dot
                        :color="item.raw.value === 1 ? 'success' : 'error'"
                        inline
                        class="me-2"
                      />
                    </template>
                  </VListItem>
                </template>
              </VSelect>
            </VCol>

            <VCol cols="12"><VDivider class="my-1" /></VCol>

            <!-- 👉 Sección 2: Datos de la Empresa -->
            <VCol cols="12" class="pb-1 pt-2">
              <div class="d-flex align-center gap-2 mb-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                  <VIcon size="16" icon="ri-building-2-line" />
                </VAvatar>
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.5px;">
                  2. Datos de la Empresa
                </span>
              </div>
            </VCol>

            <VCol cols="12" class="py-2">
              <VTextField
                v-model="clientForm.full_name"
                label="Razón Social / Nombre Completo *"
                placeholder="Ej: Corporación Favorita C.A."
                prepend-inner-icon="ri-building-line"
                :rules="rules.full_name"
                density="compact"
                variant="outlined"
                clearable
                maxlength="255"
              />
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VTextField
                v-model="clientForm.phone"
                label="Teléfono Corporativo"
                placeholder="0991234567"
                prepend-inner-icon="ri-phone-line"
                :rules="rules.phone"
                density="compact"
                variant="outlined"
                clearable
                maxlength="10"
                @keypress="filterPhoneKey"
              />
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VTextField
                v-model="clientForm.email"
                label="Correo Electrónico"
                placeholder="empresa@correo.com"
                prepend-inner-icon="ri-mail-line"
                :rules="rules.email"
                density="compact"
                variant="outlined"
                clearable
                maxlength="100"
              />
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VTextField
                v-model="clientForm.birth_date"
                label="Fecha de Constitución"
                type="date"
                prepend-inner-icon="ri-calendar-event-line"
                density="compact"
                variant="outlined"
                clearable
              />
            </VCol>

            <VCol cols="12"><VDivider class="my-1" /></VCol>

            <!-- 👉 Sección 3: Dirección y Ubicación -->
            <VCol cols="12" class="pb-1 pt-2">
              <div class="d-flex align-center gap-2 mb-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                  <VIcon size="16" icon="ri-map-pin-line" />
                </VAvatar>
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.5px;">
                  3. Dirección y Ubicación Fiscal
                </span>
              </div>
            </VCol>

            <VCol cols="12" class="py-2">
              <VTextField
                v-model="clientForm.address"
                label="Dirección Fiscal"
                placeholder="Av. Principal, Edificio, Oficina / Local"
                prepend-inner-icon="ri-map-pin-2-line"
                density="compact"
                variant="outlined"
                clearable
              />
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VSelect
                v-model="clientForm.ubigeo_region"
                :items="regions"
                item-title="name"
                item-value="id"
                label="Región"
                placeholder="Seleccione"
                prepend-inner-icon="ri-map-2-line"
                density="compact"
                variant="outlined"
                clearable
              />
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VSelect
                v-model="clientForm.ubigeo_provincia"
                :items="provinces"
                item-title="name"
                item-value="id"
                label="Provincia"
                placeholder="Seleccione"
                prepend-inner-icon="ri-map-2-line"
                density="compact"
                variant="outlined"
                clearable
                :disabled="!clientForm.ubigeo_region"
              />
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VSelect
                v-model="clientForm.ubigeo_distrito"
                :items="districts"
                item-title="name"
                item-value="id"
                label="Cantón / Ciudad"
                placeholder="Seleccione"
                prepend-inner-icon="ri-map-2-line"
                density="compact"
                variant="outlined"
                clearable
                :disabled="!clientForm.ubigeo_provincia"
              />
            </VCol>

            <!-- Alerts -->
            <VCol v-if="error" cols="12">
              <VAlert
                type="error"
                variant="tonal"
                closable
                class="rounded-lg"
                @click:close="error = ''"
              >
                {{ error }}
              </VAlert>
            </VCol>

            <VCol v-if="success" cols="12">
              <VAlert
                type="success"
                variant="tonal"
                closable
                class="rounded-lg"
                @click:close="success = ''"
              >
                {{ success }}
              </VAlert>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-surface"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-close-line"
          class="rounded-lg px-5 font-weight-medium"
          height="40"
          :disabled="loading"
          @click="closeDialog"
        >
          Cancelar
        </VBtn>

        <VBtn
          type="submit"
          form="clientCompanyEditForm"
          color="primary"
          variant="elevated"
          prepend-icon="ri-refresh-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loading"
          :disabled="loading"
        >
          Actualizar Empresa
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Notificación Toast -->
  <VSnackbar
    v-model="notificationShow"
    :color="notificationType"
    :timeout="3000"
    location="top"
  >
    {{ notificationMessage }}
  </VSnackbar>
</template>