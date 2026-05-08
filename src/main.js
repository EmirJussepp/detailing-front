import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'

// Bootstrap primero para que los estilos de app-ui.css puedan pisarlo
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import "./styles/app-ui.css"

createApp(App)
  .use(router)
  .mount('#app')
