export function mapProducto(p) {
  return {
    id: Number(p.productoId ?? p.id),
    nombre: p.nombre ?? "",
    codigoProducto: p.codigoProducto ?? null,
    categoria: p.categoria ?? null,
    stockMinimo: p.stockMinimo ?? null,
    stockMaximo: p.stockMaximo ?? null,
    stockActual: p.stockActual == null ? 0 : Number(p.stockActual),
    precioCosto: Number(p.precioCosto ?? 0),
    precioVenta: Number(p.precioVenta ?? 0),
    precioMayorista: p.precioMayorista == null ? null : Number(p.precioMayorista),
    userId: Number(p.userId ?? 0),
  }
}
