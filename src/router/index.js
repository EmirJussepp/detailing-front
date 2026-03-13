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
    // =========================
    // AUTH
    // =========================
    {
        path: "/login",
        component: AuthLayout,
        children: [{ path: "", name: "login", component: LoginView }],
        meta: { public: true },
    },

    // =========================
    // APP
    // =========================
    {
        path: "/",
        component: MainLayout,
        children: [
            { path: "", redirect: "/dashboard" },

            {
                path: "dashboard",
                name: "dashboard",
                component: HomeView,
                meta: { requiresAuth: true },
            },

            // =========================
            // CAJA
            // =========================
            {
                path: "caja",
                name: "caja.dashboard",
                component: CajaView,
                meta: { requiresAuth: true, perm: "movimientos_caja:ver" },
            },

            {
  path: "/reportes",
  name: "reportes",
  component: () => import("../views/ReportesView.vue"),
  meta: {
    requiresAuth: true,
    permission: "usuarios:ver",
  },
},
      
      {
                path: "caja/ventas",
                name: "caja.ventas",
                component: VentasView,
                meta: { requiresAuth: true, perm: "ventas:ver" },
            },
            {
                path: "caja/movimientos",
                name: "caja.movimientos",
                component: () => import("../views/MovimientosCajaView.vue"),
                meta: { requiresAuth: true, perm: "movimientos_caja:ver" },
            },
            {
                path: "caja/cuenta-corriente",
                name: "caja.cuenta",
                component: () => import("../views/CuentaCorrienteView.vue"),
                meta: { requiresAuth: true, perm: "pagos:ver" },
            },

            // =========================
            // COMPRAS (ADMIN)
            // =========================
            {
                path: "compras",
                name: "compras",
                component: ComprasView,
                meta: { requiresAuth: true, perm: "compras:ver" },
            },
            {
                path: "compras/proveedores",
                name: "compras.proveedores",
                component: ProveedoresView,
                meta: { requiresAuth: true, perm: "proveedores:ver" },
            },

            // =========================
            // MAESTROS
            // =========================
            {
                path: "clientes",
                name: "clientes",
                component: ClientesView,
                meta: { requiresAuth: true, perm: "clientes:ver" },
            },
            {
                path: "productos",
                name: "productos",
                component: ProductosView,
                meta: { requiresAuth: true, perm: "productos:ver" },
            },

            // =========================
            // METODOS DE PAGO
            // =========================
            {
                path: "metodos-pago",
                name: "metodos-pago",
                component: MetodoPagoView,
                meta: { requiresAuth: true, perm: "pagos:ver" },
            },

            // =========================
            // CONFIGURACION (ADMIN)
            // =========================
            {
                path: "configuracion",
                name: "configuracion",
                component: () => import("../views/ConfigView.vue"),
                meta: { requiresAuth: true, perm: "usuarios:gestionar" },
            },
            {
                path: "config/localidades",
                name: "config-localidades",
                component: () => import("../views/LocalidadView.vue"),
                meta: { requiresAuth: true, perm: "usuarios:gestionar" },
            },
           
            {
                path: "config/usuarios",
                name: "config-usuarios",
                component: () => import("../views/UsuariosView.vue"),
                meta: { requiresAuth: true, perm: "usuarios:ver" },
            },
            {
  path: "/movimientos-caja-historico",
  name: "caja.movimientos-historico",
  component: () => import("../views/MovimientosCajaHistoricoView.vue"),
},
            
            {
                path: "config/metodos-pago",
                name: "config-metodos-pago",
                component: () => import("../views/MetodoPagoView.vue"),
                meta: { requiresAuth: true, perm: "usuarios:gestionar" },
            },

            // =========================
            // REDIRECTS
            // =========================
            { path: "ventas", redirect: "/caja/ventas" },
            { path: "proveedores", redirect: "/compras/proveedores" },
            { path: "cuenta", redirect: "/caja/cuenta-corriente" },
        ],
    },

    // =========================
    // 404
    // =========================
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

router.beforeEach((to) => {
    const session = getSession()

    // =========================
    // PUBLIC ROUTES
    // =========================
    if (to.meta?.public) {
        if (to.name === "login" && session) {
            return { name: "dashboard" }
        }
        return true
    }

    // =========================
    // AUTH CHECK
    // =========================
    if (to.meta?.requiresAuth && !session) {
        return { name: "login", query: { redirect: to.fullPath } }
    }

    // =========================
    // ROLE CHECK (fallback)
    // =========================
    const roles = to.meta?.roles
    if (Array.isArray(roles) && roles.length > 0) {
        const userRole = session?.role
        if (!userRole || !roles.includes(userRole)) {
            return { name: "dashboard" }
        }
    }

    // =========================
    // PERMISSION CHECK (RBAC)
    // =========================
    const perm = to.meta?.perm
    if (perm) {
        const permissions = session?.permissions || []

        const hasPermission =
            permissions.includes("admin:all") ||
            permissions.includes(perm)

        if (!hasPermission) {
            return { name: "dashboard" }
        }
    }

    return true
})

export default router