import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import AuthLayout from '../layouts/AuthLayout.vue'

import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'

const routes = [
  // Public (sin login)
  {
    path: '/login',
    component: AuthLayout,
    children: [
      { path: '', name: 'login', component: LoginView }
    ]
  },

  // Private (requiere login)
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', name: 'home', component: HomeView }
      // acá después agregás /clientes, /turnos, /servicios, etc.
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// ✅ GUARD: si no hay token -> login
router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  const isAuthRoute = to.path.startsWith('/login')

  if (!token && !isAuthRoute) {
    return { name: 'login' }
  }

  // Si ya está logueado y va a /login, mandalo a home
  if (token && isAuthRoute) {
    return { name: 'home' }
  }

  return true
})

export default router
