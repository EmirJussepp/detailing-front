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
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 60000, // 60s solo para importación
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