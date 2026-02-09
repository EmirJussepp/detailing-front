export function mapCliente(c) {
  return {
    id: Number(c.clienteId ?? c.id),
    nombre: c.nombre ?? "",
    apellido: c.apellido ?? null,
    dni: c.dni ?? null,
    telefono: c.telefono ?? null,
    email: c.email ?? null,
    localidadId: c.localidadId ?? null,
    tipoClienteId: c.tipoClienteId ?? null,
    activo: c.activo ?? true,
  }
}
