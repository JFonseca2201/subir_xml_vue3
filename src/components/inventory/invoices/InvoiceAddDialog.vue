<script setup>
import { ref, onMounted } from 'vue'
import { $api } from '@/utils/api'
import { useLoaderStore } from '@/stores/loader'

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        required: true,
    },
})

const emit = defineEmits([
    'update:isDialogVisible',
    'addInvoice'
]);

// ✅ Radios con iconos (tipo string para compatibilidad)
const radioContent = [
    { title: 'Productos', value: '1', icon: 'ri-rocket-line' },
    { title: 'Gastos', value: '2', icon: 'ri-user-line' },
    { title: 'Serv./Mant.', value: '3', icon: 'ri-vip-crown-line' },
    { title: 'Herramienta', value: '4', icon: 'ri-tools-line' },
];
const selectedRadio = ref('1') // siempre string para el componente

// Loader
const loader = useLoaderStore()

// Archivos y alertas
let selectedFile = null
const success = ref(null)
const error_exist = ref(null)
const msg = ref(null)

// 📄 Selección de archivo
const onFileSelected = (event) => {
    selectedFile = event.target.files[0]
}

// 🔥 Enviar XML al backend
const storeXml = async () => {
    error_exist.value = null
    success.value = null

    if (!selectedFile) {
        error_exist.value = "Selecciona un archivo XML primero"
        return
    }

    try {
        loader.start()
        const formData = new FormData()
        formData.append('xml', selectedFile)
        formData.append('item_type', (selectedRadio.value))

        const resp = await $api('invoices/import-xml', {
            method: 'POST',
            body: formData,
            onResponseError({ response }) {
                const data = response._data || {}
                msg.value = data.message || 'Error al importar XML'
                if (response.status === 409) {
                    error_exist.value = data.message || 'La factura ya ha sido importada'
                    return
                }
                error_exist.value = data.message || 'Error al importar XML'
            }
        })

        // Mensaje de éxito
        success.value = resp?._data?.message || resp?.message || 'Factura importada correctamente'
        console.log(resp);

        // Refrescar formulario y emitir nueva factura
        onFormReset()
        emit('addInvoice', resp.data)

    } catch (error) {
        console.error(error)
        error_exist.value = msg.value || 'Error al importar XML'
    } finally {
        loader.stop()
    }
}

// 🔄 Reset del modal
const onFormReset = () => {
    error_exist.value = null
    success.value = null
    selectedFile = null
    emit('update:isDialogVisible', false)
}

// Cerrar modal
const dialogVisibleUpdate = val => {
    emit('update:isDialogVisible', val)
}
onMounted(() => {
    error_exist.value = null
    success.value = null
})
</script>

<template>
    <VDialog v-model="props.isDialogVisible" max-width="600" persistent transition="dialog-bottom-transition">
        <VCard class="rounded-xl">

            <!-- 🏷️ Header -->
            <VCardTitle class="d-flex align-center justify-space-between">
                <div class="d-flex align-center gap-2">
                    <VIcon size="22" color="primary">ri-file-upload-line</VIcon>
                    <span class="text-h6 font-weight-bold">Importar factura XML</span>
                </div>
                <VBtn icon variant="text" @click="emit('update:isDialogVisible', false)">
                    <VIcon>ri-close-line</VIcon>
                </VBtn>
            </VCardTitle>

            <VDivider />

            <!-- 📤 Contenido -->
            <VCardText class="pt-6 d-flex flex-column gap-4">

                <!-- 📄 Selector de XML -->
                <VFileInput accept=".xml" label="Seleccionar archivo XML" variant="outlined" clearable
                    prepend-inner-icon="ri-file-xml-line" @change="onFileSelected" />

                <!-- 🎚️ Radios con iconos compactos -->
                <CustomRadiosWithIcon v-model:selected-radio="selectedRadio" :radio-content="radioContent"
                    :grid-column="{ sm: '3', cols: '12' }" class="square-radio" />
                <!-- Aquí se ajustan a 3/4 partes del espacio -->

                <!-- ⚠️ Alertas -->
                <div class="d-flex flex-column gap-2">
                    <VAlert v-if="error_exist" type="error" variant="tonal" closable dense>
                        {{ error_exist }}
                    </VAlert>

                    <VAlert v-if="success" type="success" variant="tonal" closable dense>
                        {{ success }}
                    </VAlert>
                </div>

            </VCardText>

            <!-- 🎯 Footer -->
            <VCardActions class="justify-end px-6 pb-4 gap-3">
                <VBtn variant="tonal" color="primary" @click="storeXml">
                    <VIcon left>ri-upload-cloud-2-line</VIcon> &nbsp; Importar XML
                </VBtn>

                <VBtn variant="tonal" color="error" @click="emit('update:isDialogVisible', false)">
                    <VIcon left>ri-close-circle-line</VIcon> &nbsp; Cancelar
                </VBtn>
            </VCardActions>

        </VCard>
    </VDialog>
</template>

<style scoped>
/* 🔹 Botones de radios cuadrados y compactos */
.square-radio button {
    padding: 0 !important;
    font-size: 0.6rem !important;
    width: 36px !important;
    height: 36px !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: unset !important;
    line-height: 1 !important;
}

.square-radio .icon-class {
    width: 16px !important;
    height: 16px !important;
    margin-bottom: 1px;
}

.square-radio {
    gap: 2px;
}
</style>
