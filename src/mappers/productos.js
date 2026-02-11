export function mapProducto(p) {
  const toIntOrNull = (v) => {
    if (v === null || v === undefined || v === "") return null
    const n = parseInt(String(v), 10)
    return Number.isFinite(n) ? n : null
  }
  const toNum = (v, d = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }

  return {
    id: toIntOrNull(p.productoId ?? p.id),
    nombre: p.nombre ?? "",
    codigoProducto: p.codigoProducto ?? null,
    categoria: p.categoria ?? null,
    stockMinimo: toIntOrNull(p.stockMinimo ?? p.stock_minimo),
    stockMaximo: toIntOrNull(p.stockMaximo ?? p.stock_maximo),
    stockActual: toIntOrNull(p.stockActual ?? p.stock_actual) ?? 0,
    precioCosto: toNum(p.precioCosto),
    precioVenta: toNum(p.precioVenta),
    precioMayorista: p.precioMayorista == null ? null : toNum(p.precioMayorista),
    userId: toIntOrNull(p.userId) ?? 0,
  }
}
