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
import MetodoPagoView from '../views/MetodoPagoView.vue'



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
      { path: 'compras', name: 'compras', component: ComprasView },
      { path: 'metodos-pago', name: 'metodos-pago', component: MetodoPagoView },
      { path: 'configuracion', name: 'configuracion', component: () => import('../views/ConfigView.vue') },
      {
        path: 'config/localidades',
        name: 'config-localidades',
        component: () => import('../views/LocalidadView.vue')
      },

      {
        path: 'config/tipos-cliente',
        name: 'config-tipos-cliente',
        component: () => import('../views/TipoClienteView.vue')
      },
      { path: 'config/metodos-pago', name: 'config-metodos-pago', component: () => import('../views/MetodoPagoView.vue') },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Guard simple (si ya lo usás)
router.beforeEach((to) => {
  const s = getSession()
  if (to.path !== '/login' && !s) return '/login'
})
export default router
