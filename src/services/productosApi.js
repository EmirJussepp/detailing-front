import { http } from "./http"

// FIX Bug #3: construir la URL base de imágenes sin fallback a localhost.
// En producción VITE_API_URL debe estar seteado (ej: https://tu-backend.com).
// Si no está seteado, usamos una ruta relativa "/" para que el navegador
// resuelva desde el mismo dominio — funciona cuando front y back están
// en el mismo dominio o detrás de un reverse proxy (nginx, Railway, etc.).
const _rawApiUrl = import.meta.env.VITE_API_URL || ""
const API_BASE = _rawApiUrl
  ? _rawApiUrl.replace(/\/api$/, "").replace(/\/$/, "")
  : ""  // cadena vacía → URLs relativas ("/uploads/...") → mismo dominio

/**
 * Convierte una ruta relativa de imagen en URL apuntando al backend.
 * - Si VITE_API_URL está seteado: devuelve URL absoluta al backend.
 * - Si no está seteado: devuelve ruta relativa ("/uploads/...") para que
 *   el navegador la resuelva desde el mismo dominio.
 * - Si ya es blob:// o http(s)://, la devuelve sin cambios.
 */
export function resolveImagenUrl(url) {
  if (!url) return null
  if (url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  return `${API_BASE}${url}`
}

export const productosApi = {
  list(params = {}) {
    const page = Number(params.page ?? 0)
    const size = Number(params.size ?? 10)
    const search = String(params.search ?? params.q ?? "").trim()

    const qp = { page, size }
    if (search) qp.search = search

    return http.get("/productos", { params: qp })
  },

  create(payload) {
    return http.post("/productos", payload)
  },

  update(id, payload) {
    return http.patch(`/productos/${id}`, payload)
  },

  delete(id) {
    return http.delete(`/productos/eliminar/${id}`)
  },

  inactivos() {
    return http.get("/productos/inactivos")
  },

  reactivar(id) {
    return http.post(`/productos/reactivar/${id}`)
  },

  actualizarPreciosPorcentaje(command) {
    return http.put("/productos/actualizar-precios", command)
  },

  actualizarPreciosPorMarca(command) {
    return http.put("/productos/actualizar-precios/marca", command)
  },

  actualizarPreciosPorCategoria(command) {
    return http.put("/productos/actualizar-precios/categoria", command)
  },

  importarExcel(file) {
    const form = new FormData()
    form.append("file", file)

    return http.post("/productos/importar-excel", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    })
  },

  // Sube o reemplaza la imagen de un producto existente.
  // Devuelve { imagenUrl: "/uploads/productos/5.jpg" }
  uploadImagen(id, file) {
    const form = new FormData()
    form.append("imagen", file)

    return http.post(`/productos/${id}/imagen`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
}

export const marcasApi = {
  list() {
    return http.get("/marcas")
  },
  create(payload) {
    return http.post("/marcas", payload)
  },
}

export const categoriasApi = {
  list() {
    return http.get("/categoria")
  },
  create(payload) {
    return http.post("/categoria", payload)
  },
}