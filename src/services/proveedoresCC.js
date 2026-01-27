// src/services/proveedoresCC.js
import { listComprasAll } from './comprasStorage'
import { listPagosByProveedor } from './pagosProveedoresStorage'

export function getSaldoProveedor(proveedorId) {
  const compras = listComprasAll()
  const deudaCompras = compras
    .filter(c => String(c.proveedorId) === String(proveedorId))
    .filter(c => c.condicion === 'CUENTA')
    .reduce((acc, c) => acc + Number(c.saldoPendiente ?? 0), 0)

  const pagos = listPagosByProveedor(proveedorId)
  const pagosTotal = pagos.reduce((acc, p) => acc + Number(p.amount ?? 0), 0)

  const deuda = Math.round(deudaCompras * 100) / 100
  const pag = Math.round(pagosTotal * 100) / 100

  return {
    deudaCompras: deuda,
    pagosTotal: pag,
    saldo: Math.round((deuda - pag) * 100) / 100
  }
}
