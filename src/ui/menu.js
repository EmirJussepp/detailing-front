import { getSession } from "../auth/session"

// =========================
// Permissions helpers
// =========================
export function getPermissions() {
  return getSession()?.permissions || []
}

export function isAdminFromPermissions(perms = getPermissions()) {
  const set = new Set(perms || [])
  return set.has("admin:all") || set.has("usuarios:gestionar")
}

export function canPerm(item, perms = getPermissions()) {
  if (!item?.perm && !item?.permAny) return true

  const set = new Set(perms || [])
  const adminAll = set.has("admin:all")

  if (adminAll) return true

  if (item.perm) return set.has(item.perm)

  if (Array.isArray(item.permAny) && item.permAny.length > 0) {
    return item.permAny.some((p) => set.has(p))
  }

  return true
}

// =========================
// Menu by permissions (RBAC)
// =========================
export function buildMenuFromPermissions(perms = getPermissions()) {
  const items = [
    { label: "Dashboard", to: { name: "dashboard" }, icon: "LayoutDashboard" },

    { section: "Operación" },
    { label: "Caja", to: { name: "caja.dashboard" }, icon: "Wallet", perm: "caja:ver" },
    { label: "Ventas", to: { name: "caja.ventas" }, icon: "ShoppingCart", perm: "ventas:ver" },
    { label: "Movimientos", to: { name: "caja.movimientos" }, icon: "ArrowLeftRight", perm: "movimientos_caja:ver" },
    { label: "Cuenta Corriente", to: { name: "caja.cuenta" }, icon: "BookOpen", perm: "pagos:ver" },

    { section: "Clientes" },
    { label: "Clientes", to: { name: "clientes" }, icon: "Users", perm: "clientes:ver" },

    { section: "Inventario" },
    { label: "Productos", to: { name: "productos" }, icon: "Package", perm: "productos:ver" },

    { section: "Compras" },
    { label: "Compras", to: { name: "compras" }, icon: "ShoppingBag", perm: "compras:ver" },
    { label: "Proveedores", to: { name: "compras.proveedores" }, icon: "Truck", perm: "proveedores:ver" },

    { section: "Reportes" },
    { label: "Reportes", to: { name: "reportes" }, icon: "BarChart3", perm: "usuarios:ver" },
    {
      label: "Histórico Caja",
      to: { name: "caja.movimientos-historico" },
      icon: "Receipt",
      permAny: ["admin:all", "usuarios:gestionar"],
    },

    { section: "Configuración" },
    {
      label: "Panel Config",
      to: { name: "configuracion" },
      icon: "Settings",
      permAny: ["usuarios:ver", "usuarios:gestionar"],
    },
  ]

  const visible = items.filter((it) => canPerm(it, perms))

  const cleaned = []
  for (let i = 0; i < visible.length; i++) {
    const item = visible[i]

    if (item.section) {
      const next = visible[i + 1]
      if (next && !next.section) cleaned.push(item)
    } else {
      cleaned.push(item)
    }
  }

  return cleaned
}

// =========================
// Legacy (optional): keep your old role logic
// =========================
export function getRole() {
  return getSession()?.role || "CASHIER"
}

export function canAccess(item, role = getRole()) {
  if (!item?.roles || item.roles.length === 0) return true
  return item.roles.includes(role)
}

export function buildMenu(role = getRole()) {
  const items = [
    { label: "Dashboard", to: { name: "dashboard" }, icon: "LayoutDashboard", roles: ["ADMIN", "CASHIER"] },

    { section: "Operación", roles: ["ADMIN", "CASHIER"] },
    { label: "Caja", to: { name: "caja.dashboard" }, icon: "Wallet", roles: ["ADMIN", "CASHIER"] },
    { label: "Ventas", to: { name: "caja.ventas" }, icon: "ShoppingCart", roles: ["ADMIN", "CASHIER"] },
    { label: "Movimientos", to: { name: "caja.movimientos" }, icon: "ArrowLeftRight", roles: ["ADMIN", "CASHIER"] },

    { section: "Clientes", roles: ["ADMIN", "CASHIER"] },
    { label: "Clientes", to: { name: "clientes" }, icon: "Users", roles: ["ADMIN", "CASHIER"] },
    { label: "Cuenta Corriente", to: { name: "caja.cuenta" }, icon: "BookOpen", roles: ["ADMIN", "CASHIER"] },

    { section: "Inventario", roles: ["ADMIN", "CASHIER"] },
    { label: "Productos", to: { name: "productos" }, icon: "Package", roles: ["ADMIN", "CASHIER"] },

    { section: "Compras", roles: ["ADMIN"] },
    { label: "Compras", to: { name: "compras" }, icon: "ShoppingBag", roles: ["ADMIN"] },
    { label: "Proveedores", to: { name: "compras.proveedores" }, icon: "Truck", roles: ["ADMIN"] },

    { section: "Reportes", roles: ["ADMIN"] },
    { label: "Histórico Caja", to: { name: "caja.movimientos-historico" }, icon: "Receipt", roles: ["ADMIN"] },

    { section: "Configuración", roles: ["ADMIN"] },
    { label: "Panel Config", to: { name: "configuracion" }, icon: "Settings", roles: ["ADMIN"] },
    { label: "Localidades", to: { name: "config-localidades" }, icon: "MapPinned", roles: ["ADMIN"] },
    { label: "Métodos de pago (Config)", to: { name: "config-metodos-pago" }, icon: "CreditCard", roles: ["ADMIN"] },
  ]

  return items.filter((it) => canAccess(it, role))
}