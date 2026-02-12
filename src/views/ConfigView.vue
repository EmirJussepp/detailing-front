<template>
  <div class="container py-4">
    <h2 class="mb-1">Configuración</h2>
    <div class="text-secondary mb-3">Catálogos del sistema.</div>

    <div class="row g-3">
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card bg-dark border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="fw-semibold text-light">Métodos de pago</div>
            <div class="text-secondary small mb-3">Efectivo, Transferencia, etc.</div>
            <RouterLink class="btn btn-outline-light btn-sm" to="/config/metodos-pago">
              Administrar
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- <div class="col-12 col-md-6 col-lg-4">
        <div class="card bg-dark border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="fw-semibold text-light">Tipos de cliente</div>
            <div class="text-secondary small mb-3">Regular, VIP, Empresa, etc.</div>
            <RouterLink class="btn btn-outline-light btn-sm" to="/config/tipos-cliente">
              Administrar
            </RouterLink>
          </div>
        </div>
      </div> -->

      <div class="col-12 col-md-6 col-lg-4">
  <div class="card bg-dark border-0 shadow-sm h-100">
    <div class="card-body">
      <div class="fw-semibold text-light">Localidades</div>
      <div class="text-secondary small mb-3">Ciudades / barrios / etc.</div>
      <RouterLink class="btn btn-outline-light btn-sm" to="/config/localidades">
        Administrar
      </RouterLink>
    </div>
  </div>
</div>


      <!-- después agregás Localidades, etc -->
    </div>
  </div>
</template>
