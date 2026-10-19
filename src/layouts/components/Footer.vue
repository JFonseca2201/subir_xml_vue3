<template>
  <div class="h-100 d-flex align-center justify-space-between text-medium-emphasis">
    <!-- 👉 Footer: left content -->
    <div class="d-flex align-center text-caption font-weight-medium">
      &copy;
      {{ new Date().getFullYear() }}
      <span class="font-weight-bold text-high-emphasis ms-1">Luxury Evys</span>
      <span class="ms-1 d-none d-sm-inline">— Sistema de Gestión y Facturación</span>
    </div>

    <!-- 👉 Footer: right content -->
    <div class="d-flex align-center gap-x-3 text-caption text-medium-emphasis">
      <span>v2.0</span>
      <span>•</span>
      <span>Todos los derechos reservados</span>
    </div>
  </div>
</template>
