import { createApp } from 'vue'
import App from '@/App.vue'
import { registerPlugins } from '@core/utils/plugins'

// Styles
import '@core/scss/template/index.scss'
import '@styles/styles.scss'
import '@styles/remix-icons.css' // Importar Remix Icons CSS local

// Create vue app
const app = createApp(App)



// Register plugins
registerPlugins(app)

// Silenciar la advertencia experimental de <Suspense> en Vue 3
app.config.warnHandler = (msg, instance, trace) => {
  if (msg.includes('Suspense is an experimental feature')) return
  console.warn(`[Vue warn]: ${msg}`, trace)
}

// Mount vue app
app.mount('#app')
