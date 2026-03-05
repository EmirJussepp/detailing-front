import { http } from "./http"

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

  actualizarPreciosPorcentaje(command) {
    return http.put("/productos/actualizar-precios", command)
  },
  actualizarPreciosPorMarca(command) {
    return http.put("/productos/actualizar-precios/marca", command)
  },
  actualizarPreciosPorCategoria(command) {
    return http.put("/productos/actualizar-precios/categoria", command)
  },
}

export const marcasApi = {
  list: () => http.get("/marcas"),
  create: (payload) => http.post("/marcas", payload),
}

export const categoriasApi = {
  list: () => http.get("/categoria"),     // ✅ singular
  create: (payload) => http.post("/categoria", payload),
}