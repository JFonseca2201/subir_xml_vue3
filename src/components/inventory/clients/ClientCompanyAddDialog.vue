<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'addClientCompany',
  'add-client-company',
  'client-added',
  'clientAdded',
])

// Estado del formulario
const loading = ref(false)
const error = ref('')
const success = ref('')
const userStore = JSON.parse(localStorage.getItem('user'))

const isDocumentChecked = ref(false)
const isClientExisting = ref(false)
const matchedClient = ref(null)

const fieldsDisabled = computed(() => {
  return !isDocumentChecked.value || loading.value
})

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
  razon_social: '', // Razón social principal
  nombre_comercial: '', // Nombre comercial
  representante_legal: '', // Representante legal
  actividad_economica: '', // Actividad económica
  capital_social: '', // Capital social
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
  isDocumentChecked.value = false
  isClientExisting.value = false
  matchedClient.value = null
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

const actividadEconomicaOptions = ref([
  { title: 'Comercio', value: 'comercio' },
  { title: 'Servicios', value: 'servicios' },
  { title: 'Industria', value: 'industria' },
  { title: 'Construcción', value: 'construccion' },
  { title: 'Agricultura', value: 'agricultura' },
  { title: 'Tecnología', value: 'tecnologia' },
  { title: 'Transporte', value: 'transporte' },
  { title: 'Otros', value: 'otros' },
])

// Validación para cédulas ecuatorianas
const validateEcuadorianCedula = cedula => {
  if (!cedula) return true
  const cleanCedula = cedula.replace(/[\s-]/g, '')
  if (!/^\d{10}$/.test(cleanCedula)) return false
  const provincia = parseInt(cleanCedula.substring(0, 2))
  if (provincia < 1 || provincia > 24) return false
  const tercerDigito = parseInt(cleanCedula.substring(2, 3))
  if (tercerDigito < 0 || tercerDigito >= 6) return false
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cleanCedula.charAt(i)) * coeficientes[i]
    if (valor >= 10) valor = valor - 9
    suma += valor
  }
  const digitoVerificador = parseInt(cleanCedula.charAt(9))
  const modulo = suma % 10
  const resultado = modulo === 0 ? 0 : 10 - modulo
  
  return resultado === digitoVerificador
}

// Referencias del formulario
const formRef = ref(null)

// Validación para RUC ecuatoriano
const validateEcuadorianRUC = ruc => {
  if (!ruc) return true // Permitir vacío si no es requerido

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

  const tercerDigito = parseInt(cleanRUC.substring(2, 3))
    
  if (tercerDigito < 6) {
    return validateEcuadorianCedula(cleanRUC.substring(0, 10))
  } else if (![6, 9].includes(tercerDigito)) {
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
  razon_social: [
    v => !!v || 'La razón social es requerida',
    v => (v && v.length >= 3) || 'La razón social debe tener al menos 3 caracteres',
  ],
  nombre_comercial: [
    v => !!v || 'El nombre comercial es requerido',
    v => (v && v.length >= 2) || 'El nombre comercial debe tener al menos 2 caracteres',
  ],
  representante_legal: [
    v => !!v || 'El representante legal es requerido',
    v => (v && v.length >= 5) || 'El representante legal debe tener al menos 5 caracteres',
  ],
  actividad_economica: [
    v => !!v || 'La actividad económica es requerida',
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
  capital_social: [
    v => !v || /^\d+(\.\d{1,2})?$/.test(v) || 'Capital social inválido',
  ],
  state: [
    v => !!v || 'El estado es requerido',
    v => [1, 2].includes(v) || 'El estado debe ser 1 (Activo) o 2 (Inactivo)',
  ],
}

// Generar full_name automáticamente
const generateFullName = () => {
  if (clientForm.value.name) {
    clientForm.value.full_name = clientForm.value.name

    // surname se mantiene vacío para empresas
  }
}

const isCheckingDocument = ref(false)
const lastCheckedDocument = ref('')
let checkDocCompanyAbortController = null

const checkDocument = async (force = false) => {
  const doc = (clientForm.value.n_document || '').trim()
  if (!doc) {
    isDocumentChecked.value = false
    isClientExisting.value = false
    matchedClient.value = null
    lastCheckedDocument.value = ''
    return
  }

  // Evitar consultas repetidas si el documento no ha cambiado salvo forzado
  if (doc === lastCheckedDocument.value && isDocumentChecked.value && force !== true) {
    return
  }

  const type = Number(clientForm.value.type_document)
  if (type === 1 && !validateEcuadorianCedula(doc)) return
  if (type === 2 && !validateEcuadorianRUC(doc)) return
  if (type === 3 && doc.length < 4) return

  if (checkDocCompanyAbortController) {
    checkDocCompanyAbortController.abort()
  }
  checkDocCompanyAbortController = new AbortController()

  isCheckingDocument.value = true
  loading.value = true
  lastCheckedDocument.value = doc

  try {
    const resp = await $api('clients', { 
      params: { search: doc },
      signal: checkDocCompanyAbortController.signal,
    })
    const fetchedClients = Array.isArray(resp.clients) ? resp.clients : (Array.isArray(resp.data) ? resp.data : [])

    const match = fetchedClients.find(c => String(c.n_document).trim() === String(doc).trim())
    if (match) {
      showNotification('Cliente empresa encontrado', 'info')
      isClientExisting.value = true
      matchedClient.value = match

      clientForm.value.full_name = match.full_name || match.name || ''
      clientForm.value.phone = match.phone || ''
      clientForm.value.email = match.email || ''
      clientForm.value.birth_date = match.birth_date || ''
      clientForm.value.address = match.address || ''
      clientForm.value.ubigeo_region = match.ubigeo_region || ''
      clientForm.value.ubigeo_provincia = match.ubigeo_provincia || ''
      clientForm.value.ubigeo_distrito = match.ubigeo_distrito || ''
      clientForm.value.state = match.state || 1
    } else {
      isClientExisting.value = false
      matchedClient.value = null
    }
    isDocumentChecked.value = true
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return
    console.error('Error al verificar RUC/documento:', err)
  } finally {
    loading.value = false
    isCheckingDocument.value = false
  }
}

// Seleccionar cliente empresa existente
const selectExistingClient = () => {
  if (!matchedClient.value) return
  success.value = 'Cliente empresa seleccionado'
  showNotification('Cliente empresa seleccionado', 'success')
  setTimeout(() => {
    emit('update:isDialogVisible', false)
    emit('add-client-company', matchedClient.value)
    resetForm()
  }, 25)
}

// Guardar cliente empresa nuevo
const saveClient = async () => {
  if (isClientExisting.value && matchedClient.value) {
    selectExistingClient()
    return
  }
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
    const clientData = {
      ...clientForm.value,
      type_client: clientForm.value.type_client.toString(),
      type_document: clientForm.value.type_document.toString(),
      state: clientForm.value.state.toString(),
      name: clientForm.value.full_name,
      surname: '',
    }

    const resp = await $api("clients", {
      method: "POST",
      body: clientData,
      onResponseError({ response }) {
        const errorData = response._data
        let errorMsg = errorData?.message
        if (!errorMsg || errorMsg === 'Error de validación') {
          if (errorData?.errors && typeof errorData.errors === 'object') {
            errorMsg = Object.values(errorData.errors).flat().join(' | ')
          }
        }
        error.value = errorMsg || 'Error al guardar empresa'
        console.error('Error response:', errorData)
      },
    })

    if (resp.status === 200 || resp.status === 201) {
      success.value = 'Empresa guardada correctamente'
      showNotification('Empresa guardada correctamente', 'success')

      setTimeout(() => {
        emit('update:isDialogVisible', false)

        const serverData = resp.data || resp.client || resp
        const updatedData = {
          ...serverData,
          id: serverData?.id || serverData?.client?.id,
          full_name: serverData?.full_name || clientForm.value.full_name,
          name: serverData?.name || clientForm.value.full_name,
          surname: '',
          type_client: serverData?.type_client?.toString() || clientForm.value.type_client.toString(),
          type_document: serverData?.type_document?.toString() || clientForm.value.type_document.toString(),
          state: serverData?.state || parseInt(clientForm.value.state) || 1,
          phone: serverData?.phone || clientForm.value.phone || '',
          email: serverData?.email || clientForm.value.email || '',
          n_document: serverData?.n_document || clientForm.value.n_document || '',
          address: serverData?.address || clientForm.value.address || '',
        }

        emit('add-client-company', updatedData)
        resetForm()
      }, 25)
    } else {
      error.value = resp.message || 'Error al guardar empresa'
      showNotification(resp.message || 'Error al guardar empresa', 'error')
    }
  } catch (err) {
    console.error('Error al guardar empresa:', err)
    if (!error.value) {
      const respData = err?.data || err?.response?._data
      let errText = respData?.message
      if (!errText || errText === 'Error de validación') {
        if (respData?.errors && typeof respData.errors === 'object') {
          errText = Object.values(respData.errors).flat().join(' | ')
        }
      }
      error.value = errText || err?.message || 'Error al guardar empresa. Intente nuevamente.'
    }
    showNotification(error.value, 'error')
  } finally {
    loading.value = false
  }
}

// Resetear formulario
const resetForm = () => {
  clientForm.value = {
    full_name: '',
    phone: '',
    email: '',
    type_client: 2,
    type_document: 2,
    n_document: '',
    birth_date: '',
    user_id: 1,
    sucursale_id: 1,
    state: 1,
    gender: '',
    ubigeo_region: '',
    ubigeo_provincia: '',
    ubigeo_ciudad: '',
    region: '',
    provincia: '',
    distrito: '',
    address: '',
    razon_social: '',
    nombre_comercial: '',
    representante_legal: '',
    actividad_economica: '',
    capital_social: '',
  }

  isDocumentChecked.value = false
  isClientExisting.value = false
  matchedClient.value = null
  lastCheckedDocument.value = ''

  if (formRef.value) {
    formRef.value.resetValidation()
  }
}

// Cerrar diálogo
const closeDialog = () => {
  emit('update:isDialogVisible', false)
  resetForm()
}

watch(() => props.isDialogVisible, newVal => {
  if (newVal) {
    error.value = ''
    success.value = ''
    resetForm()
  }
})

watch(() => clientForm.value.n_document, newVal => {
  if (newVal !== lastCheckedDocument.value) {
    isDocumentChecked.value = false
    isClientExisting.value = false
    matchedClient.value = null
  }

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
      <!-- 👉 Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          @click="closeDialog"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-building-2-line" />
        </div>
        <h3 class="custom-dialog-title">
          Nuevo Cliente Empresa
        </h3>
        <p class="custom-dialog-subtitle">
          Registro de un nuevo cliente jurídico o compañía
        </p>
      </div>

      <VCardText class="pa-sm-6 pa-4">
        <!-- 👉 Form -->
        <VForm
          id="clientCompanyAddForm"
          ref="formRef"
          @submit.prevent="saveClient"
        >
          <VRow>
            <!-- 👉 Sección 1: Identificación y RUC -->
            <VCol cols="12" class="pb-1">
              <div class="d-flex align-center gap-2 mb-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                  <VIcon size="16" icon="ri-shield-user-line" />
                </VAvatar>
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.5px;">
                  1. Identificación Tributaria
                </span>
              </div>
            </VCol>

            <VCol cols="12" sm="4" class="py-2">
              <VSelect
                v-model="clientForm.type_document"
                :items="typeDocumentOptions"
                item-title="title"
                item-value="value"
                label="Tipo Documento *"
                prepend-inner-icon="ri-file-text-line"
                density="compact"
                variant="outlined"
                required
              />
            </VCol>

            <VCol cols="12" sm="8" class="py-2">
              <VTextField
                v-model="clientForm.n_document"
                label="Número de RUC / Documento *"
                placeholder="Ingrese RUC (13 dígitos) y busque con 🔍 o Enter"
                prepend-inner-icon="ri-numbers-line"
                append-inner-icon="ri-search-line"
                :rules="rules.n_document"
                density="compact"
                variant="outlined"
                required
                clearable
                :maxlength="documentMaxLength"
                :loading="isCheckingDocument"
                @keypress="filterDocumentKey"
                @blur="checkDocument(false)"
                @keyup.enter="checkDocument(true)"
                @click:append-inner="checkDocument(true)"
              />
            </VCol>

            <!-- 👉 Banner de Empresa Existente -->
            <VCol v-if="isClientExisting && matchedClient" cols="12" class="py-1">
              <VAlert
                type="info"
                variant="tonal"
                border="start"
                class="rounded-lg mb-2 pa-3"
              >
                <div class="d-flex flex-column flex-sm-row align-sm-center justify-space-between gap-3">
                  <div>
                    <div class="font-weight-bold text-body-1 text-primary d-flex align-center gap-1">
                      <VIcon icon="ri-checkbox-circle-fill" size="18" color="success" />
                      Empresa ya registrada en el sistema
                    </div>
                    <div class="text-caption text-medium-emphasis mt-0.5">
                      <strong>{{ matchedClient.full_name || matchedClient.name }}</strong> &bull; RUC: {{ matchedClient.n_document }} &bull; Telf: {{ matchedClient.phone || 'S/N' }}
                    </div>
                  </div>
                  <VBtn
                    color="primary"
                    variant="elevated"
                    size="small"
                    prepend-icon="ri-user-shared-line"
                    class="font-weight-bold flex-shrink-0"
                    @click="selectExistingClient"
                  >
                    Usar esta Empresa
                  </VBtn>
                </div>
              </VAlert>
            </VCol>

            <VCol v-else-if="!isDocumentChecked && !clientForm.n_document" cols="12" class="py-0">
              <div class="text-caption text-medium-emphasis ms-1 mb-2 d-flex align-center gap-1">
                <VIcon icon="ri-information-line" size="14" color="info" />
                Ingresa el número de RUC para verificar si la empresa ya existe o registrarla.
              </div>
            </VCol>

            <VCol cols="12"><VDivider class="my-1" /></VCol>

            <!-- 👉 Sección 2: Datos de la Empresa -->
            <VCol cols="12" class="pb-1 pt-2">
              <div class="d-flex align-center gap-2 mb-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                  <VIcon size="16" icon="ri-building-line" />
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
                placeholder="Ej: COMPAÑÍA AUTOMOTRIZ EJEMPLO S.A."
                prepend-inner-icon="ri-building-2-line"
                :rules="rules.full_name"
                density="compact"
                variant="outlined"
                required
                clearable
                maxlength="255"
                :disabled="fieldsDisabled || isClientExisting"
              />
            </VCol>

            <VCol cols="12" sm="6" class="py-2">
              <VTextField
                v-model="clientForm.phone"
                label="Teléfono de Contacto"
                placeholder="Ej: 022123456 / 0991234567"
                prepend-inner-icon="ri-phone-line"
                :rules="rules.phone"
                density="compact"
                variant="outlined"
                clearable
                maxlength="10"
                :disabled="fieldsDisabled || isClientExisting"
                @keypress="filterPhoneKey"
              />
            </VCol>

            <VCol cols="12" sm="6" class="py-2">
              <VTextField
                v-model="clientForm.email"
                label="Correo Electrónico"
                placeholder="facturacion@empresa.com"
                prepend-inner-icon="ri-mail-line"
                :rules="rules.email"
                density="compact"
                variant="outlined"
                clearable
                maxlength="100"
                :disabled="fieldsDisabled || isClientExisting"
              />
            </VCol>

            <VCol cols="12" sm="6" class="py-2">
              <VTextField
                v-model="clientForm.birth_date"
                label="Fecha de Constitución"
                type="date"
                prepend-inner-icon="ri-calendar-event-line"
                density="compact"
                variant="outlined"
                clearable
                :disabled="fieldsDisabled || isClientExisting"
              />
            </VCol>

            <VCol cols="12" sm="6" class="py-2">
              <VSelect
                v-model="clientForm.state"
                :items="stateOptions"
                item-title="title"
                item-value="value"
                label="Estado"
                prepend-inner-icon="ri-toggle-line"
                placeholder="Seleccione estado"
                density="compact"
                variant="outlined"
                clearable
                :disabled="fieldsDisabled || isClientExisting"
              />
            </VCol>

            <VCol cols="12"><VDivider class="my-1" /></VCol>

            <!-- 👉 Sección 3: Ubicación y Dirección -->
            <VCol cols="12" class="pb-1 pt-2">
              <div class="d-flex align-center gap-2 mb-2">
                <VAvatar size="26" color="primary" variant="tonal" class="rounded">
                  <VIcon size="16" icon="ri-map-pin-line" />
                </VAvatar>
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis text-uppercase" style="letter-spacing: 0.5px;">
                  3. Dirección y Ubicación
                </span>
              </div>
            </VCol>

            <VCol cols="12" class="py-2">
              <VTextField
                v-model="clientForm.address"
                label="Dirección de la Empresa"
                placeholder="Calle principal, número y secundaria / Sector"
                prepend-inner-icon="ri-map-pin-2-line"
                density="compact"
                variant="outlined"
                clearable
                :disabled="fieldsDisabled || isClientExisting"
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
                :disabled="fieldsDisabled || isClientExisting"
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
                :disabled="fieldsDisabled || isClientExisting || !clientForm.ubigeo_region"
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
                :disabled="fieldsDisabled || isClientExisting || !clientForm.ubigeo_provincia"
              />
            </VCol>

            <!-- 👉 Alerts -->
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

      <!-- 👉 Fixed Bottom Actions -->
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

        <!-- 👉 Botón cuando la empresa YA EXISTE -->
        <VBtn
          v-if="isClientExisting && matchedClient"
          color="info"
          variant="elevated"
          prepend-icon="ri-user-shared-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          @click="selectExistingClient"
        >
          Seleccionar Empresa
        </VBtn>

        <!-- 👉 Botón Guardar SOLO si la empresa NO existe -->
        <VBtn
          v-else
          type="submit"
          form="clientCompanyAddForm"
          color="primary"
          variant="elevated"
          prepend-icon="ri-save-3-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loading"
          :disabled="fieldsDisabled || isCheckingDocument"
        >
          Guardar Empresa
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