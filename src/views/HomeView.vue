<template>
  <div>
    <h1 class="h4 mb-1">Dashboard</h1>
    <div class="text-secondary">Bienvenido a GestionaTuNegocio</div>

    <div class="row g-3 mt-3">
      <div class="col-12 col-md-6 col-lg-3" v-for="c in cards" :key="c.label">
        <div class="card bg-dark border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-secondary small mb-2">{{ c.label }}</div>
            <div class="fs-4 fw-bold">{{ c.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-dark border-0 shadow-sm mt-4">
      <div class="card-body">
        <div class="fw-semibold mb-2">Accesos rápidos</div>
        <div class="d-flex flex-wrap gap-2">
          <RouterLink class="btn btn-sm btn-outline-light" to="/clientes">Clientes</RouterLink>
          <RouterLink class="btn btn-sm btn-outline-light" to="/productos">Productos</RouterLink>
          <RouterLink class="btn btn-sm btn-outline-light" to="/ventas">Ventas</RouterLink>
          <RouterLink class="btn btn-sm btn-outline-light" to="/caja">Caja</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const cards = [
  { label: 'Caja', value: '—' },
  { label: 'Ventas hoy', value: '0' },
  { label: 'Ingresos', value: '$0' },
  { label: 'Stock bajo', value: '0' }
]
</script>
