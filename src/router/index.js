import { createRouter, createWebHistory } from "vue-router"

import MainLayout from "../layouts/MainLayout.vue"
import AuthLayout from "../layouts/AuthLayout.vue"

import LoginView from "../views/LoginView.vue"
import HomeView from "../views/HomeView.vue"
import ComprasView from "../views/ComprasView.vue"

import CajaView from "../views/CajaView.vue"
import VentasView from "../views/VentasView.vue"
import ClientesView from "../views/ClientesView.vue"
import ProductosView from "../views/ProductosView.vue"
import ProveedoresView from "../views/ProveedoresView.vue"
import MetodoPagoView from "../views/MetodoPagoView.vue"

import { getSession } from "../auth/session"

const routes = [
  // Auth
  {
    path: "/login",
    component: AuthLayout,
    children: [{ path: "", name: "login", component: LoginView }],
    meta: { public: true },
  },

  // App
  {
    path: "/",
    component: MainLayout,
    children: [
      { path: "", redirect: "/dashboard" },

      { path: "dashboard", name: "dashboard", component: HomeView, meta: { requiresAuth: true } },

      // Caja
      { path: "caja", name: "caja.dashboard", component: CajaView, meta: { requiresAuth: true } },
      { path: "caja/ventas", name: "caja.ventas", component: VentasView, meta: { requiresAuth: true } },
      {
        path: "caja/movimientos",
        name: "caja.movimientos",
        component: () => import("../views/MovimientosCajaView.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "caja/cuenta-corriente",
        name: "caja.cuenta",
        component: () => import("../views/CuentaCorrienteView.vue"),
        meta: { requiresAuth: true },
      },

      // Compras
      { path: "compras", name: "compras", component: ComprasView, meta: { requiresAuth: true, roles: ["ADMIN"] } },
      {
        path: "compras/proveedores",
        name: "compras.proveedores",
        component: ProveedoresView,
        meta: { requiresAuth: true, roles: ["ADMIN"] },
      },

      // Maestros
      { path: "clientes", name: "clientes", component: ClientesView, meta: { requiresAuth: true } },
      { path: "productos", name: "productos", component: ProductosView, meta: { requiresAuth: true } },

      // Métodos de pago
      { path: "metodos-pago", name: "metodos-pago", component: MetodoPagoView, meta: { requiresAuth: true, roles: ["ADMIN"] } },

      // Config (solo ADMIN)
      {
        path: "configuracion",
        name: "configuracion",
        component: () => import("../views/ConfigView.vue"),
        meta: { requiresAuth: true, roles: ["ADMIN"] },
      },
      {
        path: "config/localidades",
        name: "config-localidades",
        component: () => import("../views/LocalidadView.vue"),
        meta: { requiresAuth: true, roles: ["ADMIN"] },
      },
      {
        path: "config/tipos-cliente",
        name: "config-tipos-cliente",
        component: () => import("../views/TipoClienteView.vue"),
        meta: { requiresAuth: true, roles: ["ADMIN"] },
      },
      {
        path: "config/metodos-pago",
        name: "config-metodos-pago",
        component: () => import("../views/MetodoPagoView.vue"),
        meta: { requiresAuth: true, roles: ["ADMIN"] },
      },

      // Redirects cortos
      { path: "ventas", redirect: "/caja/ventas" },
      { path: "proveedores", redirect: "/compras/proveedores" },
      { path: "cuenta", redirect: "/caja/cuenta-corriente" },
    ],
  },

  // 404
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const session = getSession()

  if (to.meta?.public) {
    if (to.name === "login" && session) return { name: "dashboard" }
    return true
  }

  if (to.meta?.requiresAuth && !session) {
    return { name: "login", query: { redirect: to.fullPath } }
  }

  const roles = to.meta?.roles
  if (Array.isArray(roles) && roles.length > 0) {
    const userRole = session?.role
    if (!userRole || !roles.includes(userRole)) return { name: "dashboard" }
  }

  return true
})

export default router