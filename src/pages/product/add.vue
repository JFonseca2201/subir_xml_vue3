<template>
  <VForm @submit.prevent="handleSubmit">
    <VTextField v-model="product.name" label="Nombre del producto" required />
    <VTextField v-model="product.description" label="Descripción" required />
    <VTextField v-model="product.price" label="Precio" type="number" required />
    <VBtn type="submit" color="primary">Guardar</VBtn>
  </VForm>
</template>

<script setup>
import { ref } from 'vue';

const product = ref({
  name: '',
  description: '',
  price: '',
});

const handleSubmit = () => {
  // Aquí irá la lógica para guardar el producto
  console.log('Producto guardado:', product.value);
};
</script>