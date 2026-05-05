<template>
  <div class="transaction-list-page">
    <!-- Header -->
    <VCard class="mb-6" elevation="0">
      <VCardText class="py-4">
        <div class="d-flex justify-space-between align-center">
          <div>
            <h1 class="text-h4 font-weight-bold text-primary mb-1">
              Todas las Transacciones
            </h1>
            <p class="text-medium-emphasis">
              Historial completo de movimientos financieros
            </p>
          </div>
          <div class="d-flex gap-3">
            <VBtn color="secondary" variant="outlined" prepend-icon="ri-arrow-left-line" @click="goBack">
              Volver
            </VBtn>
            <VBtn color="primary" prepend-icon="ri-refresh-line" @click="refreshData" :loading="loading">
              Actualizar
            </VBtn>
          </div>
        </div>
      </VCardText>
    </VCard>

    <!-- Componente TransactionList -->
    <TransactionList :refresh-trigger="refreshTrigger" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import TransactionList from '@/components/finances/TransactionList.vue'

const router = useRouter()
const loading = ref(false)
const refreshTrigger = ref(0)

const goBack = () => {
  router.push({ name: 'finances-operations' })
}

const refreshData = async () => {
  loading.value = true
  refreshTrigger.value++
  setTimeout(() => {
    loading.value = false
  }, 1000)
}
</script>

<style scoped>
.transaction-list-page {
  padding: 0;
}
</style>
