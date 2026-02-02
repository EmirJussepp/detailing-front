import { http } from "./http";

const BASE = "/metodos-pago";

export const metodoPagoApi = {
  list: () => http.get(BASE),
  getById: (id) => http.get(`${BASE}/${id}`),

  // back espera { nombre }
  create: (nombre) => http.post(BASE, { nombre }),

  update: (id, nombre) => http.put(`${BASE}/${id}`, { nombre }),

  remove: (id) => http.delete(`${BASE}/${id}`),
};
