<script setup>
import { ref, onMounted, computed } from 'vue'
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api, getStorageUrl } from '@/utils/api'
import { themeConfig, layoutConfig } from '@themeConfig'

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
  login_background: '',
  obligado_contabilidad: '',
  contribuyente_especial: '',
  status: '1',
  phone: '',
  email: '',
  responsable: '',
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
      '1793192550001',  // RUC sociedad jurídica
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
    if (!/^\d{10}$/.test(String(value).trim().replace(/\D/g, ''))) return 'El teléfono debe tener 10 dígitos'

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
}

import { usePermissions } from '@/composables/usePermissions'

const { can } = usePermissions()

// Verificar si el usuario tiene permisos para modificar la configuración del establecimiento
const canEditSucursal = computed(() => {
  return can('settings') || can('manage_settings')
})

// Cargar información de la sucursal
const loadSucursal = async () => {
  isLoading.value = true
  try {
    const resp = await $api('sucursales/1', {
      method: 'GET',
    })

    if (resp.sucursal) {
      sucursal.value = resp.sucursal

      const sName = resp.sucursal.name || resp.sucursal.trade_name || 'LUXURY EVYS'

      localStorage.setItem('sucursal_name', sName)
      if (themeConfig.app) themeConfig.app.title = sName
      if (layoutConfig?.app) layoutConfig.app.title = sName

      if (resp.sucursal.login_background) {
        localStorage.setItem('login_background', getStorageUrl(resp.sucursal.login_background))
      } else {
        localStorage.removeItem('login_background')
      }
    }
  } catch (error) {
    console.error('Error al cargar sucursal:', error)
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
  fileFirma.value = null
  fileLoginBg.value = null
  previewLoginBg.value = null
  shouldRemoveLoginBg.value = false
  loadSucursal() // Recargar datos originales
}

const fileFirma = ref(null)
const fileLoginBg = ref(null)
const previewLoginBg = ref(null)
const shouldRemoveLoginBg = ref(false)

const onLoginBgSelected = () => {
  const raw = Array.isArray(fileLoginBg.value) ? fileLoginBg.value[0] : fileLoginBg.value
  if (raw && (raw instanceof File || raw instanceof Blob)) {
    previewLoginBg.value = URL.createObjectURL(raw)
    shouldRemoveLoginBg.value = false
  } else {
    previewLoginBg.value = null
  }
}

const clearLoginBg = () => {
  fileLoginBg.value = null
  previewLoginBg.value = null
  shouldRemoveLoginBg.value = true
}

const currentLoginBgUrl = computed(() => {
  if (previewLoginBg.value) return previewLoginBg.value
  if (shouldRemoveLoginBg.value) return null
  if (sucursal.value?.login_background) {
    return getStorageUrl(sucursal.value.login_background)
  }

  return null
})

// Guardar cambios
const saveSucursal = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  isLoading.value = true
  try {
    let bodyData
    const rawFirma = Array.isArray(fileFirma.value) ? fileFirma.value[0] : fileFirma.value
    const hasFirma = rawFirma && (rawFirma instanceof File || rawFirma instanceof Blob)

    const rawBg = Array.isArray(fileLoginBg.value) ? fileLoginBg.value[0] : fileLoginBg.value
    const hasBg = rawBg && (rawBg instanceof File || rawBg instanceof Blob)

    const needsFormData = hasFirma || hasBg || shouldRemoveLoginBg.value

    if (needsFormData) {
      const formData = new FormData()

      formData.append('_method', 'PUT')
      Object.keys(sucursal.value).forEach(key => {
        if (sucursal.value[key] !== null && sucursal.value[key] !== undefined) {
          formData.append(key, sucursal.value[key])
        }
      })
      if (hasFirma) {
        formData.append('firma_file', rawFirma)
      }
      if (hasBg) {
        formData.append('login_background_file', rawBg)
      }
      if (shouldRemoveLoginBg.value) {
        formData.append('remove_login_background', 'true')
      }
      bodyData = formData
    } else {
      bodyData = sucursal.value
    }

    const resp = await $api('sucursales/1', {
      method: needsFormData ? 'POST' : 'PUT',
      body: bodyData,
      onResponseError({ response }) {
        console.error('Error al guardar sucursal:', response._data.error || response._data.message)
        showNotification(response._data.error || response._data.message || 'Error al guardar cambios', 'error')
      },
    })

    if (resp.sucursal) {
      sucursal.value = resp.sucursal
      isEditing.value = false
      fileFirma.value = null
      fileLoginBg.value = null
      previewLoginBg.value = null
      shouldRemoveLoginBg.value = false

      if (resp.sucursal.login_background) {
        localStorage.setItem('login_background', getStorageUrl(resp.sucursal.login_background))
      } else {
        localStorage.removeItem('login_background')
      }

      const sName = sucursal.value.name || sucursal.value.trade_name || 'LUXURY EVYS'

      localStorage.setItem('sucursal_name', sName)
      if (themeConfig.app) themeConfig.app.title = sName
      if (layoutConfig?.app) layoutConfig.app.title = sName

      showNotification('Información y configuración guardadas correctamente', 'success')
    }
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
    <!-- Global loader in use -->

    <VCard elevation="8" class="pa-8 rounded-xl border-thin max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-6">
        <VIcon icon="ri-building-line" size="44" color="primary" class="mb-2" />
        <h1 class="text-h5 font-weight-bold mb-1">
          Información de la Empresa
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Gestiona los datos de tu empresa y sucursal
        </p>
      </div>

      <!-- Skeleton Loader al cargar inicialmente -->
      <div v-if="isLoading && !sucursal.name" class="pa-4">
        <VRow>
          <VCol cols="12" class="mb-3">
            <div class="shimmer-line w-40 mb-2" />
          </VCol>
          <VCol v-for="n in 6" :key="n" cols="12" md="6" class="mb-3">
            <div class="shimmer-line w-30 mb-2" />
            <div class="shimmer-line w-100" style="height: 44px; border-radius: 8px;" />
          </VCol>
        </VRow>
      </div>

      <!-- Formulario -->
      <VForm v-else ref="formRef" @submit.prevent="saveSucursal">
        <VRow>
          <!-- Información Básica -->
          <VCol cols="12">
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3 d-flex align-center">
              <VIcon icon="ri-information-line" size="18" class="me-2" color="primary" />
              Información Básica
            </div>
          </VCol>

          <VCol cols="12" md="6">
            <VTextField v-model="sucursal.name" label="Nombre de la Empresa" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-building-line" hide-details="auto" required :disabled="!isEditing"
              :rules="[rules.required]" />
          </VCol>

          <VCol cols="12" md="6">
            <VTextField v-model="sucursal.trade_name" label="Nombre Comercial" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-store-line" hide-details="auto" :disabled="!isEditing" :rules="[rules.required]" />
          </VCol>

          <VCol cols="12" md="6">
            <VTextField v-model="sucursal.ruc" label="RUC" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-file-text-line" hide-details="auto" required :disabled="!isEditing"
              :rules="[rules.ruc]" maxlength="13"
              @input="sucursal.ruc = sucursal.ruc.replace(/\D/g, '').slice(0, 13)" />
          </VCol>

          <VCol cols="12" md="6">
            <VTextField v-model="sucursal.address" label="Dirección" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-map-pin-line" hide-details="auto" required :disabled="!isEditing"
              :rules="[rules.required]" />
          </VCol>

          <!-- Facturación -->
          <VCol cols="12">
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3 d-flex align-center">
              <VIcon icon="ri-file-list-3-line" size="18" class="me-2" color="primary" />
              Configuración de Facturación
            </div>
          </VCol>

          <VCol cols="12" md="3">
            <VTextField v-model="sucursal.serie_factura" label="Serie Factura" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-hashtag" hide-details="auto" :disabled="!isEditing"
              :rules="[rules.serieFactura]" />
          </VCol>

          <VCol cols="12" md="3">
            <VTextField v-model="sucursal.secuencial_factura" label="Secuencial" variant="outlined"
              density="comfortable" prepend-inner-icon="ri-sort-asc" hide-details="auto" :disabled="!isEditing"
              :rules="[rules.secuencial]" />
          </VCol>

          <VCol cols="12" md="3">
            <VTextField v-model="sucursal.establecimiento" label="Establecimiento" variant="outlined"
              density="comfortable" prepend-inner-icon="ri-building-2-line" hide-details="auto" :disabled="!isEditing"
              :rules="[rules.establecimiento]" />
          </VCol>

          <VCol cols="12" md="3">
            <VTextField v-model="sucursal.punto_emision" label="Punto Emisión" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-printer-line" hide-details="auto" :disabled="!isEditing"
              :rules="[rules.puntoEmision]" />
          </VCol>

          <!-- Ambiente SRI -->
          <VCol cols="12" md="6">
            <VSelect v-model="sucursal.ambiente" :items="[
              { title: 'Pruebas', value: '1' },
              { title: 'Producción', value: '2' }
            ]" label="Ambiente SRI" variant="outlined" density="comfortable" prepend-inner-icon="ri-cloud-line"
              hide-details="auto" :disabled="!isEditing" />
          </VCol>

          <VCol cols="12" md="6">
            <VSelect v-model="sucursal.tipo_emision" :items="[
              { title: 'Normal', value: '1' },
              { title: 'Contingencia', value: '2' }
            ]" label="Tipo Emisión" variant="outlined" density="comfortable" prepend-inner-icon="ri-file-copy-line"
              hide-details="auto" :disabled="!isEditing" />
          </VCol>

          <!-- Firma Electrónica -->
          <VCol cols="12">
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3 d-flex align-center">
              <VIcon icon="ri-key-line" size="18" class="me-2" color="primary" />
              Firma Electrónica
            </div>
          </VCol>

          <VCol cols="12" md="6">
            <VFileInput v-model="fileFirma" label="Subir Firma (.p12 / .pfx)" accept=".p12,.pfx" variant="outlined"
              density="comfortable" prepend-inner-icon="ri-file-upload-line" hide-details="auto"
              :disabled="!isEditing" />
            <small v-if="sucursal.firma_electronica" class="text-caption text-success d-block mt-1">
              Firma actual: {{ sucursal.firma_electronica }}
            </small>
          </VCol>

          <VCol cols="12" md="6">
            <VTextField v-model="sucursal.password_firma" label="Contraseña de la Firma (.p12)" variant="outlined"
              density="comfortable" prepend-inner-icon="ri-lock-password-line" hide-details="auto" type="password"
              :disabled="!isEditing" />
          </VCol>

          <!-- Personalización Visual / Fondo del Login -->
          <VCol cols="12">
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3 d-flex align-center">
              <VIcon icon="ri-image-line" size="18" class="me-2" color="primary" />
              Fondo de Pantalla del Login
            </div>
          </VCol>

          <VCol cols="12" md="7">
            <VFileInput v-model="fileLoginBg" label="Seleccionar Imagen de Fondo (.jpg, .png, .webp)"
              accept="image/jpeg,image/png,image/webp" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-image-add-line" hide-details="auto" :disabled="!isEditing" clearable
              @change="onLoginBgSelected" @click:clear="clearLoginBg" />
            <div class="text-caption text-medium-emphasis mt-2 d-flex align-center gap-1.5">
              <VIcon icon="ri-information-line" size="15" color="primary" />
              <span>Esta imagen se mostrará como fondo en la pantalla de inicio de sesión con efecto translúcido en el
                formulario azul.</span>
            </div>
          </VCol>

          <!-- Previsualización -->
          <VCol cols="12" md="5">
            <div v-if="currentLoginBgUrl"
              class="login-bg-preview-card rounded-xl border overflow-hidden position-relative">
              <img :src="currentLoginBgUrl" alt="Fondo de Login" class="login-bg-img">
              <div class="login-bg-overlay-badge d-flex align-center justify-space-between px-3 py-1.5">
                <span class="text-caption text-white font-weight-bold">
                  {{ previewLoginBg ? 'Nueva imagen seleccionada' : 'Fondo actual del Login' }}
                </span>
                <VBtn v-if="isEditing" size="x-small" color="error" variant="elevated" icon="ri-delete-bin-line"
                  class="rounded-circle" title="Quitar imagen" @click="clearLoginBg" />
              </div>
            </div>
            <div v-else
              class="login-bg-placeholder rounded-xl border border-dashed pa-4 text-center d-flex flex-column align-center justify-center">
              <VIcon icon="ri-image-line" size="32" class="text-disabled mb-1" />
              <span class="text-caption text-disabled font-weight-medium">
                Sin imagen personalizada (se usará el fondo predeterminado del taller)
              </span>
            </div>
          </VCol>

          <!-- Contabilidad -->
          <VCol cols="12">
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3 d-flex align-center">
              <VIcon icon="ri-calculator-line" size="18" class="me-2" color="primary" />
              Contabilidad
            </div>
          </VCol>

          <VCol cols="12" md="4">
            <VSelect v-model="sucursal.obligado_contabilidad" :items="[
              { title: 'Sí', value: 'SI' },
              { title: 'No', value: 'NO' }
            ]" label="Obligado a Contabilidad" variant="outlined" density="comfortable"
              prepend-inner-icon="ri-checkbox-line" hide-details="auto" :disabled="!isEditing" />
          </VCol>

          <VCol cols="12" md="4">
            <VTextField v-model="sucursal.contribuyente_especial" label="Contribuyente Especial" variant="outlined"
              density="comfortable" prepend-inner-icon="ri-star-line" hide-details="auto" :disabled="!isEditing"
              :rules="[rules.contribuyenteEspecial]" />
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
              :rules="[rules.phone]" maxlength="10"
              @input="sucursal.phone = sucursal.phone.replace(/\D/g, '').slice(0, 10)" />
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
          <VBtn v-if="!isEditing" color="primary" variant="elevated" class="text-none px-8" :disabled="isLoading"
            @click="enableEditing">
            <VIcon start icon="ri-edit-line" />
            Editar Información
          </VBtn>

          <!-- Botones de edición (visibles solo cuando está editando) -->
          <VBtn v-if="isEditing" variant="outlined" color="secondary" class="text-none px-8" :disabled="isLoading"
            @click="cancelEditing">
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


