<template>
    <div>
        <h1>Listado de productos</h1>
        <ul>
            <li v-for="product in products" :key="product.id">
                {{ product.name }} - {{ product.price }}
            </li>
        </ul>
    </div>
</template>

<script>
export default {
    data() {
        return {
            products: [
                { id: 1, name: 'Producto 1', price: 10 },
                { id: 2, name: 'Producto 2', price: 20 },
                { id: 3, name: 'Producto 3', price: 30 },
            ],
        };
    },
};
</script>
