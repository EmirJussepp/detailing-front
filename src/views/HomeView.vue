<template>
  <div>
    <!-- Header -->
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
      <div>
        <h1 class="h4 mb-1">Principal</h1>
        <div class="text-secondary">
          Accesos rápidos · Gestióna tu negocio
        </div>
      </div>

      <div class="text-secondary small">
        Tip: empezá por <b>Caja</b> para abrir turno.
      </div>
    </div>

    <!-- Quick actions -->
    <div class="row g-3">
      <div class="col-12 col-md-6 col-lg-3" v-for="a in actions" :key="a.to">
        <RouterLink :to="a.to" class="card card-link bg-panel border-0 shadow-sm h-100 text-decoration-none">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div class="fw-semibold text-white">{{ a.title }}</div>
              <span class="badge" :class="a.badgeClass">{{ a.badge }}</span>
            </div>

            <div class="text-secondary small mt-2">
              {{ a.desc }}
            </div>

            <div class="mt-3 d-flex justify-content-between align-items-center">
              <span class="text-secondary small">{{ a.hint }}</span>
              <span class="btn btn-sm btn-outline-light">Abrir</span>
            </div>
          </div>
        </RouterLink>
      </div>
    </div>

    <!-- Secondary shortcuts -->
    <div class="card bg-panel border-0 shadow-sm mt-4">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div class="fw-semibold">Más atajos</div>
          <div class="text-secondary small">Acciones frecuentes</div>
        </div>

       <div class="d-flex flex-wrap gap-2 mt-3">

  <RouterLink class="btn btn-sm btn-outline-light" to="/ventas">
    <i class="bi bi-cart-check me-1"></i> Nueva venta
  </RouterLink>

  <RouterLink class="btn btn-sm btn-outline-light" to="/clientes">
    <i class="bi bi-person-plus me-1"></i> Alta cliente
  </RouterLink>

  <RouterLink class="btn btn-sm btn-outline-light" to="/productos">
    <i class="bi bi-box-seam me-1"></i> Alta producto
  </RouterLink>

  <RouterLink class="btn btn-sm btn-outline-light" to="/proveedores">
    <i class="bi bi-truck me-1"></i> Proveedores
  </RouterLink>

  <RouterLink class="btn btn-sm btn-outline-light" to="/compras">
    <i class="bi bi-bag-check me-1"></i> Compras
  </RouterLink>

  <RouterLink class="btn btn-sm btn-outline-light" to="/configuracion">
    <i class="bi bi-gear me-1"></i> Configuración
  </RouterLink>

</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue"

const actions = ref([
  {
    to: "/caja",
    title: "Caja",
    desc: "Abrir / cerrar turno, ver saldo y movimientos.",
    hint: "Operación del día",
    badge: "PRIORIDAD",
    badgeClass: "text-bg-warning",
  },
  {
    to: "/ventas",
    title: "Ventas",
    desc: "Crear ventas, cobrar y descontar stock.",
    hint: "Tickets y cobros",
    badge: "NUEVAS",
    badgeClass: "text-bg-success",
  },
  {
    to: "/productos",
    title: "Productos",
    desc: "Alta, precios, stock mínimo y control.",
    hint: "Inventario",
    badge: "STOCK",
    badgeClass: "text-bg-info",
  },
  {
    to: "/clientes",
    title: "Clientes",
    desc: "Alta + cuenta corriente + historial.",
    hint: "CRM",
    badge: "CC",
    badgeClass: "text-bg-secondary",
  },
])
</script>

<style scoped>
.bg-panel {
  background: rgba(18, 22, 32, 0.92);
  border-radius: 16px;
}

.card-link {
  transition: transform 120ms ease, filter 120ms ease;
  color: inherit;
}
.card-link:hover {
  transform: translateY(-2px);
  filter: brightness(1.06);
}
.card-link:active {
  transform: translateY(0px);
  filter: brightness(1.02);
}
</style>