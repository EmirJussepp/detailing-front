import axios from "axios";
import { requireCajaAbierta, addToVentasTotal } from '../services/cajaStorage'
import { listVentasBucket, addVenta, removeVenta } from '../services/ventasStorage'
import { listProductos, hasStock, applyStockDelta } from '../services/productosStorage'
import { listClientes } from '../services/clientesStorage'


export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8082",
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
