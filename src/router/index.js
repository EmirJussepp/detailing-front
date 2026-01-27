import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import AuthLayout from '../layouts/AuthLayout.vue'

import LoginView from '../views/LoginView.vue'
import HomeView from '../views/HomeView.vue'
import CajaView from '../views/CajaView.vue'
import ClientesView from '../views/ClientesView.vue'
import ProductosView from '../views/ProductosView.vue'
import VentasView from '../views/VentasView.vue'
import ProveedoresView from '../views/ProveedoresView.vue'
import ComprasView from '../views/ComprasView.vue'


import { getSession } from '../auth/session'

const routes = [
  {
    path: '/login',
    component: AuthLayout,
    children: [{ path: '', name: 'login', component: LoginView }]
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: HomeView },
      { path: 'caja', name: 'caja', component: CajaView },
      { path: 'clientes', name: 'clientes', component: ClientesView },
      { path: 'productos', name: 'productos', component: ProductosView },
      { path: 'ventas', name: 'ventas', component: VentasView },
      { path: 'proveedores', name: 'proveedores', component: ProveedoresView },
      { path: 'compras', name: 'compras', component: ComprasView }

    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const session = getSession()
  const isAuthRoute = to.path.startsWith('/login')

  if (!session && !isAuthRoute) return { name: 'login' }
  if (session && isAuthRoute) return { name: 'dashboard' }
  return true
})

export default router
