<script>
export default {
    data() {
        return {
            paises: [
                'Argentina',
                'Brasil',
                'Chile',
                'Colombia',
                'Ecuador',
                'Perú',
                'Uruguay',
                'Venezuela',
            ],
        };
    },
    methods: {
        guardarCliente() {
            console.log('Guardar cliente');
        },
    },
};
</script>
<template>
    <div class="client-form">
        <v-card outlined class="pa-4">
            <v-card-title>
                <span class="headline">Nuevo cliente</span>
            </v-card-title>
            <v-card-text>
                <v-form>
                    <v-text-field label="Nombre" />
                    <v-text-field label="Apellido" />
                    <v-text-field label="Email" />
                    <v-text-field label="Teléfono" />
                    <v-text-field label="Dirección" />
                    <v-select label="País" :items="paises" />
                </v-form>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn color="primary" @click="guardarCliente">Guardar</v-btn>
            </v-card-actions>
        </v-card>
    </div>
</template>



<style scoped>
.client-form {
    max-width: 400px;
    margin: 0 auto;
}
</style>
