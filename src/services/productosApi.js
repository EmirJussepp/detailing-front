import { http } from "./http"

// [FOTO] URL base del backend para construir URLs de imágenes.
// Las imágenes se sirven desde el backend (puerto 8082), NO desde Vite (5173).
// Si el proyecto usa VITE_API_URL en producción, se respeta automáticamente.
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8082").replace(/\/api$/, "")

/**
 * Convierte una ruta relativa de imagen en URL absoluta apuntando al backend.
 * Ejemplo: "/uploads/productos/5.jpg" → "http://localhost:8082/uploads/productos/5.jpg"
 * Si ya es una URL absoluta (http/https) o un blob:// de preview local, la devuelve tal cual.
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