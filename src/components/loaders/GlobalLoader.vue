<template>
    <VOverlay :model-value="isLoading" class="align-center justify-center" absolute persistent>
        <VProgressCircular indeterminate size="48" width="4" color="primary" />
    </VOverlay>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useLoaderStore } from '@/stores/loader'

const loaderStore = useLoaderStore()
const { isLoading } = storeToRefs(loaderStore)
</script>
