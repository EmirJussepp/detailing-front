import { createRouter, createWebHistory } from "vue-router"

import MainLayout from "../layouts/MainLayout.vue"
import AuthLayout from "../layouts/AuthLayout.vue"

import LoginView from "../views/LoginView.vue"
import HomeView from "../views/HomeView.vue"

import CajaView from "../views/CajaView.vue"
import VentasView from "../views/VentasView.vue"
import ClientesView from "../views/ClientesView.vue"
import ProductosView from "../views/ProductosView.vue"
import ProveedoresView from "../views/ProveedoresView.vue"
import MetodoPagoView from "../views/MetodoPagoView.vue"

import { getSession, isAdmin } from "../auth/session"

const routes = [
  // Auth
  {
    path: "/login",
    component: AuthLayout,
    children: [{ path: "", name: "login", component: LoginView }],
  },

  // App
  {
    path: "/",
    component: MainLayout,
    children: [
      { path: "", redirect: "/dashboard" },
      { path: "dashboard", name: "dashboard", component: HomeView },

      // Caja
      { path: "caja", name: "caja.dashboard", component: CajaView },
      { path: "caja/ventas", name: "caja.ventas", component: VentasView },
      {
        path: "caja/movimientos",
        name: "caja.movimientos",
        component: () => import("../views/MovimientosCajaView.vue"),
      },

      // Compras / Proveedores
      { path: "compras/proveedores", name: "compras.proveedores", component: ProveedoresView },

      // Maestros
      { path: "clientes", name: "clientes", component: ClientesView },
      { path: "productos", name: "productos", component: ProductosView },

      // Métodos de pago (si lo querés como pantalla directa)
      { path: "metodos-pago", name: "metodos-pago", component: MetodoPagoView },

      // Config (solo ADMIN si querés)
      {
        path: "configuracion",
        name: "configuracion",
        component: () => import("../views/ConfigView.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "config/localidades",
        name: "config-localidades",
        component: () => import("../views/LocalidadView.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "config/tipos-cliente",
        name: "config-tipos-cliente",
        component: () => import("../views/TipoClienteView.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "config/metodos-pago",
        name: "config-metodos-pago",
        component: () => import("../views/MetodoPagoView.vue"),
        meta: { requiresAdmin: true },
      },

      // Redirects “cortos”
      { path: "ventas", redirect: "/caja/ventas" },
      { path: "proveedores", redirect: "/compras/proveedores" },
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
  const s = getSession()

  // login required
  if (to.path !== "/login" && !s) return "/login"

  // admin-only
  if (to.meta?.requiresAdmin && !isAdmin()) return "/dashboard"
})

export default router
