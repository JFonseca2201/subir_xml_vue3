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

// Silenciar las advertencias experimentales de <Suspense> en Vue 3
app.config.warnHandler = (msg, instance, trace) => {
  if (msg && msg.toLowerCase().includes('suspense')) return
  console.warn(`[Vue warn]: ${msg}`, trace)
}

// Silenciar errores internos inyectados por el navegador o Chrome DevTools (Live Metrics / reportAllChanges)
if (typeof window !== 'undefined') {
  const isDevToolsBug = (err, msg) => {
    const text = ((err?.message || '') + ' ' + (err?.stack || '') + ' ' + (msg || '')).toLowerCase()
    return (text.includes("reading 'starttime'") || text.includes('starttime')) && (text.includes('reportallchanges') || text.includes('anonymous') || text.includes('timeout'))
  }

  app.config.errorHandler = (err, instance, info) => {
    if (isDevToolsBug(err)) return
    console.error(err)
  }

  window.addEventListener('error', event => {
    if (isDevToolsBug(event?.error, event?.message)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return true
    }
  }, true)

  window.addEventListener('unhandledrejection', event => {
    if (isDevToolsBug(event?.reason)) {
      event.preventDefault()
      return true
    }
  })
}

// Mount vue app
app.mount('#app')

