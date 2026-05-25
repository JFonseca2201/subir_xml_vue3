<template>
  <!-- Global loader in use -->
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useLoaderStore } from '@/stores/loader'

const loaderStore = useLoaderStore()
const { isLoading } = storeToRefs(loaderStore)
</script>
