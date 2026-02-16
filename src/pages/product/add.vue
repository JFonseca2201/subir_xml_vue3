<template>
  <div class="product-form-container">
    <h1>Registro de Productos</h1>
    <form @submit.prevent="submitForm">
      <div class="form-group">
        <label for="name">Nombre del Producto:</label>
        <input id="name" v-model="form.name" type="text" required placeholder="Ingrese el nombre" />
      </div>

      <div class="form-group">
        <label for="description">Descripción:</label>
        <textarea id="description" v-model="form.description" placeholder="Ingrese la descripción"></textarea>
      </div>

      <div class="form-group">
        <label for="price">Precio:</label>
        <input id="price" v-model.number="form.price" type="number" step="0.01" required placeholder="0.00" />
      </div>

      <div class="form-group">
        <label for="quantity">Cantidad:</label>
        <input id="quantity" v-model.number="form.quantity" type="number" required placeholder="0" />
      </div>

      <button type="submit" class="btn-submit">Guardar Producto</button>
    </form>
  </div>
</template>

<script>
export default {
  name: "AddProduct",
  data() {
    return {
      form: {
        name: "",
        description: "",
        price: null,
        quantity: null,
        category: "",
      },
    };
  },
  methods: {
    submitForm() {
      console.log("Producto registrado:", this.form);
      // Aquí agregar lógica para enviar los datos al servidor
      this.resetForm();
    },
    resetForm() {
      this.form = {
        name: "",
        description: "",
        price: null,
        quantity: null,
        category: "",
      };
    },
  },
};
</script>

<style scoped>
.product-form-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #333;
}

form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

label {
  font-weight: bold;
  margin-bottom: 5px;
  color: #555;
}

input,
textarea,
select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 5px rgba(0, 102, 204, 0.3);
}

.btn-submit {
  padding: 12px;
  background-color: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  font-size: 16px;
}

.btn-submit:hover {
  background-color: #0052a3;
}
</style>
