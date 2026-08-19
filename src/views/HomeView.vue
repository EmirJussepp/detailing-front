<script setup>
import { ref } from "vue"
import { RouterLink } from "vue-router"

const actions = ref([
  {
    to: "/caja",
    title: "Caja",
    desc: "Abrir o cerrar turno, revisar saldo y controlar movimientos.",
    hint: "Operación del día",
    badge: "PRIORIDAD",
    badgeClass: "badge-soft-warning",
  },
  {
    to: "/ventas",
    title: "Ventas",
    desc: "Registrar ventas, cobrar y descontar stock.",
    hint: "Tickets y cobros",
    badge: "ACTIVO",
    badgeClass: "badge-soft-success",
  },
  {
    to: "/productos",
    title: "Productos",
    desc: "Administrar inventario, precios y stock mínimo.",
    hint: "Inventario",
    badge: "STOCK",
    badgeClass: "badge-soft-neutral",
  },
  {
    to: "/clientes",
    title: "Clientes",
    desc: "Alta de clientes, cuenta corriente e historial.",
    hint: "Relación comercial",
    badge: "CC",
    badgeClass: "badge-soft-neutral",
  },
])

const shortcuts = ref([
  { to: "/ventas", label: "Nueva venta" },
  { to: "/clientes", label: "Alta cliente" },
  { to: "/productos", label: "Alta producto" },
  { to: "/proveedores", label: "Proveedores" },
  { to: "/compras", label: "Compras" },
  { to: "/configuracion", label: "Config" },
])
</script>

<template>
  <div class="principal-page">
    <section class="page-hero">
      <div>
        <p class="eyebrow mb-1">Inicio</p>
        <h1 class="page-title mb-1">Principal</h1>
        <p class="page-subtitle mb-0">
          Accesos rápidos y entradas principales del sistema.
        </p>
      </div>

      <div class="hero-tip">
        <span class="helper-text">
          Empezá por <b>Caja</b> para abrir el turno operativo.
        </span>
      </div>
    </section>

    <div class="row g-3">
      <div class="col-12 col-md-6 col-lg-3" v-for="a in actions" :key="a.to">
        <RouterLink :to="a.to" class="home-card">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div class="home-card-title">{{ a.title }}</div>
            <span class="badge" :class="a.badgeClass">{{ a.badge }}</span>
          </div>

          <div class="home-card-desc">
            {{ a.desc }}
          </div>

          <div class="home-card-footer">
            <span class="helper-text">{{ a.hint }}</span>
            <span class="btn btn-sm btn-outline-light">Abrir</span>
          </div>
        </RouterLink>
      </div>
    </div>

    <div class="card bg-panel border-0 shadow-sm mt-4">
      <div class="card-body">
        <div class="section-header mb-3">
          <h2 class="section-title mb-0">Más atajos</h2>
          <div class="helper-text">Acciones frecuentes</div>
        </div>

        <div class="d-flex flex-wrap gap-2">
          <RouterLink
            v-for="s in shortcuts"
            :key="s.to"
            class="btn btn-sm btn-outline-light"
            :to="s.to"
          >
            {{ s.label }}
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.principal-page {
  min-height: 100%;
}

.hero-tip {
  display: flex;
  align-items: center;
}

.home-card {
  display: block;
  height: 100%;
  background: rgba(18, 16, 10, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-top: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 6px;
  padding: 18px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.home-card:hover {
  border-color: rgba(201, 162, 39, 0.30);
  background: rgba(20, 18, 10, 0.98);
}

.home-card-title {
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
}

.home-card-desc {
  color: rgba(255,255,255,.68);
  font-size: .9rem;
  margin-top: 10px;
  min-height: 46px;
}

.home-card-footer {
  margin-top: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
</style>