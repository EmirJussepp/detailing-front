// src/ui/menu.js
import { getSession } from "../auth/session"

export function getRole() {
  return getSession()?.role || "CASHIER"
}

export function canAccess(item, role = getRole()) {
  if (!item?.roles || item.roles.length === 0) return true
  return item.roles.includes(role)
}

export function buildMenu(role = getRole()) {
  const items = [
    { label: "Dashboard", to: { name: "dashboard" }, icon: "🏠", roles: ["ADMIN", "CASHIER"] },

    { section: "Operación", roles: ["ADMIN", "CASHIER"] },
    { label: "Caja", to: { name: "caja.dashboard" }, icon: "💰", roles: ["ADMIN", "CASHIER"] },
    { label: "Ventas", to: { name: "caja.ventas" }, icon: "🧾", roles: ["ADMIN", "CASHIER"] },
    { label: "Movimientos", to: { name: "caja.movimientos" }, icon: "📊", roles: ["ADMIN", "CASHIER"] },

    { section: "Clientes", roles: ["ADMIN", "CASHIER"] },
    { label: "Clientes", to: { name: "clientes" }, icon: "👤", roles: ["ADMIN", "CASHIER"] },
    { label: "Cuenta Corriente", to: { name: "caja.cuenta" }, icon: "📒", roles: ["ADMIN", "CASHIER"] },

    { section: "Inventario", roles: ["ADMIN", "CASHIER"] },
    { label: "Productos", to: { name: "productos" }, icon: "📦", roles: ["ADMIN", "CASHIER"] },

    { section: "Compras", roles: ["ADMIN"] },
    { label: "Compras", to: { name: "compras" }, icon: "🧾", roles: ["ADMIN"] },
    { label: "Proveedores", to: { name: "compras.proveedores" }, icon: "🏭", roles: ["ADMIN"] },

    { section: "Configuración", roles: ["ADMIN"] },
    { label: "Panel Config", to: { name: "configuracion" }, icon: "⚙️", roles: ["ADMIN"] },
    { label: "Localidades", to: { name: "config-localidades" }, icon: "📍", roles: ["ADMIN"] },
    { label: "Tipos de cliente", to: { name: "config-tipos-cliente" }, icon: "🏷️", roles: ["ADMIN"] },
    { label: "Métodos de pago (Config)", to: { name: "config-metodos-pago" }, icon: "💳", roles: ["ADMIN"] },
  ]

  return items.filter((it) => canAccess(it, role))
}