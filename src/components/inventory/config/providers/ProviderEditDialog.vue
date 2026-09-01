<script setup>
import { useLoaderStore } from '@/stores/loader'
import { useGlobalToast } from '@/composables/useGlobalToast'
import { $api } from '@/utils/api'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  providerSelected: {
    type: Object,
    required: true,
  },
  roles: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:isDialogVisible', 'editProvider'])

const loader = useLoaderStore()
const { showNotification } = useGlobalToast()

// Form data
const provider = ref({
  id: null,
  ruc: '',
  name: '',
  address: '',
  phone: '',
  email: '',
})

// Computed para mostrar ID con formato
const formattedId = computed(() => {
  if (!provider.value.id) return ''
  
  return `prov00${provider.value.id}`
})

// Validation rules
const rucRules = [
  v => !!v || 'El RUC es requerido',
  v => v && v.length === 13 || 'El RUC debe tener 13 dígitos',
  v => /^\d{13}$/.test(v) || 'El RUC debe contener solo números',
]

const nameRules = [
  v => !!v || 'El nombre es requerido',
  v => (v && v.length >= 3) || 'El nombre debe tener al menos 3 caracteres',
]

const emailRules = [
  v => !v || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v) || 'El correo electrónico no es válido',
]

const phoneRules = [
  v => !v || /^\d{10}$/.test(String(v).replace(/\D/g, '')) || 'El teléfono debe tener 10 dígitos',
]

const addressRules = [
  v => !!v || 'La dirección es requerida',
  v => (v && v.length >= 5) || 'La dirección debe tener al menos 5 caracteres',
]

const supplierIdRules = [
  v => !!v || 'El ID de proveedor es requerido',
]

// Form ref
const providerForm = ref(null)

/* ======================================================
   🔥 LOAD PROVIDER DATA
====================================================== */

const loadProviderData = () => {
  if (!props.providerSelected) return

  console.log('Proveedor seleccionado completo:', props.providerSelected)
  console.log('Campos disponibles:', Object.keys(props.providerSelected))
  console.log('ID:', props.providerSelected.id)
  console.log('RUC:', props.providerSelected.ruc)
  console.log('Nombre:', props.providerSelected.name)
  console.log('Dirección:', props.providerSelected.address)

  provider.value = {
    id: props.providerSelected.id,
    ruc: props.providerSelected.ruc || '',
    name: props.providerSelected.name || '',
    address: props.providerSelected.address || '',
    phone: props.providerSelected.phone || '',
    email: props.providerSelected.email || '',
  }

  console.log('Datos del proveedor cargados:', provider.value)
}

/* ======================================================
   🔥 UPDATE
====================================================== */

const update = async () => {
  const { valid } = await providerForm.value?.validate()
  if (!valid) {
    showNotification('Por favor complete todos los campos requeridos', 'error')
    
    return
  }

  loader.start()

  try {
    const formData = new FormData()

    formData.append("_method", "PUT")
    formData.append("id", provider.value.id)
    formData.append('ruc', provider.value.ruc)
    formData.append('tax_id', provider.value.ruc)
    formData.append('name', provider.value.name)
    formData.append('address', provider.value.address)
    formData.append('phone', provider.value.phone || '')
    formData.append('email', provider.value.email || '')

    const resp = await $api(`suppliers/${provider.value.id}`, {
      method: "POST",
      body: formData,
      onResponseError({ response }) {
        console.error('Error del servidor:', response._data)
        showNotification('Error al actualizar el proveedor', 'error')
      },
    })

    console.log('Proveedor actualizado:', resp.supplier)
    emit('editProvider', resp.supplier)
    emit('update:isDialogVisible', false)
    showNotification('Proveedor actualizado con éxito', 'success')

  } catch (error) {
    console.error('Error al actualizar proveedor:', error)
    showNotification('Error al actualizar el proveedor', 'error')
  } finally {
    loader.stop()
  }
}

/* ======================================================
   🔥 RESET
====================================================== */

const onFormReset = () => {
  provider.value = {
    id: null,
    ruc: '',
    name: '',
    address: '',
    phone: '',
    email: '',
  }

  if (providerForm.value) {
    providerForm.value.resetValidation()
  }
}

/* ======================================================
   🔥 WATCH DIALOG VISIBILITY
====================================================== */

watch(() => props.providerSelected, loadProviderData, { immediate: true })
watch(() => props.isDialogVisible, val => {
  if (val) loadProviderData()
})
</script>

<template>
  <VDialog
    scrollable 
    :model-value="props.isDialogVisible" 
    max-width="600px"
    persistent
    :closable="!loader.loading"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <VCard class="custom-dialog-card">
      <!-- Header Banner Primary -->
      <div class="custom-dialog-header-primary">
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          class="custom-dialog-close-btn"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
        />
        <div class="custom-dialog-avatar">
          <VIcon icon="ri-building-4-line" />
        </div>
        <h3 class="custom-dialog-title">
          Editar Proveedor
        </h3>
        <p class="custom-dialog-subtitle">
          Modifica los datos comerciales del proveedor
        </p>
      </div>

      <!-- Form -->
      <VCardText class="pa-4">
        <VForm
          ref="providerForm"
          @submit.prevent="update"
        >
          <VRow>
            <!-- RUC -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="provider.ruc"
                label="RUC"
                placeholder="EJ. 1700000000001"
                :rules="rucRules"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-file-list-3-line"
                maxlength="13"
                required
                @input="e => { provider.ruc = e.target.value.replace(/\D/g, '').slice(0, 13) }"
              />
            </VCol>

            <!-- ID -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="formattedId"
                label="ID Proveedor"
                placeholder="Ej: prov001"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-hashtag"
                readonly
                required
              />
            </VCol>

            <!-- Nombre -->
            <VCol cols="12">
              <VTextField
                v-model="provider.name"
                label="Nombre del Proveedor"
                placeholder="Ej: Empresa XYZ S.A."
                :rules="nameRules"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-building-line"
                required
              />
            </VCol>

            <!-- Dirección -->
            <VCol cols="12">
              <VTextField
                v-model="provider.address"
                label="Dirección"
                placeholder="Ej: Av. Principal 123, Quito, Ecuador"
                :rules="addressRules"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-map-pin-line"
                required
              />
            </VCol>

            <!-- Teléfono -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="provider.phone"
                label="Teléfono"
                placeholder="Ej: 0999999999"
                :rules="phoneRules"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-phone-line"
                maxlength="10"
                @input="e => { provider.phone = e.target.value.replace(/\D/g, '').slice(0, 10) }"
              />
            </VCol>

            <!-- Correo Electrónico -->
            <VCol
              cols="12"
              md="6"
            >
              <VTextField
                v-model="provider.email"
                label="Correo Electrónico"
                placeholder="Ej: info@proveedor.com"
                :rules="emailRules"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="ri-mail-line"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <!-- Actions -->
      <VCardActions
        class="pa-4 d-flex justify-end align-center gap-3 bg-white"
        style="position: sticky; bottom: 0; z-index: 2;"
      >
        <VBtn
          color="secondary"
          variant="outlined"
          prepend-icon="ri-close-line"
          class="rounded-lg px-6 font-weight-medium"
          height="40"
          :disabled="loader.loading"
          @click="emit('update:isDialogVisible', false)"
        >
          Cancelar
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          prepend-icon="ri-refresh-line"
          class="rounded-lg px-6 font-weight-bold"
          height="40"
          :loading="loader.loading"
          :disabled="loader.loading"
          @click="update"
        >
          Actualizar
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
