import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'

// ✅ Importá tus estilos globales (para borrar blancos y quitar max-width del template)
import './style.css'

// Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

createApp(App)
  .use(router)
  .mount('#app')
