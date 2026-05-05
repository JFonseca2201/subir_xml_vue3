import { createApp } from 'vue'
import App from '@/App.vue'
import { registerPlugins } from '@core/utils/plugins'

// Styles
import '@core/scss/template/index.scss'
import '@styles/styles.scss'
import '@styles/remix-icons.css' // Importar Remix Icons CSS local

// Create vue app
const app = createApp(App)

// Registrar la directiva v-intersect personalizada
app.directive('intersect', () => import('@/plugins/directives/intersect.js').default)

// Register plugins
registerPlugins(app)

// Mount vue app
app.mount('#app')
