// Directiva v-intersect personalizada para corregir error de Vuetify
export default {
    mounted(el, binding) {
        // Crear un IntersectionObserver simple
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && binding.value) {
                    binding.value(entry)
                }
            })
        }, {
            threshold: 0.1
        })
        
        observer.observe(el)
    },
    
    unmounted(el) {
        // Limpiar el observer cuando el componente se destruye
        if (el._observer) {
            el._observer.disconnect()
        }
    }
}
