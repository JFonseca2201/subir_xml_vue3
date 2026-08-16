export default [
  {
    title: 'Pagina principal',
    to: { name: 'dashboard' },
    icon: { icon: 'ri-dashboard-line' },
  },

  { heading: 'Comercial' },
  {
    title: 'Clientes',
    icon: { icon: 'ri-user-shared-2-line' },
    to: 'clients-list',
  },
  {
    title: 'Vehículos',
    icon: { icon: 'ri-car-line' },
    to: 'vehicles-list',
  },
  {
    title: 'Info Repuestos',
    to: 'inforepuestos',
    icon: { icon: 'ri-file-search-line' },
  },

  { heading: 'Negocio Paralelo' },
  {
    title: 'Cuentas Paralelo',
    icon: { icon: 'ri-store-2-line' },
    to: 'negocio-paralelo',
  },

  { heading: 'Finanzas' },
  {
    title: 'Cuentas/Operaciones',
    icon: { icon: 'ri-bank-line' },
    children: [
      {
        title: 'Cuentas',
        to: { name: 'accounts-index' },
        icon: { icon: 'ri-bank-card-line' },
      },
      {
        title: 'Operaciones',
        to: { name: 'operations-index' },
        icon: { icon: 'ri-exchange-funds-line' },
        activeMatch: /operations|transfers|employee-expenses|aportes|movements/,
      },
      {
        title: 'Arqueo de Caja',
        to: { name: 'finanzas-arqueo' },
        icon: { icon: 'ri-safe-2-line' },
      },
    ],
  },

  { heading: 'Servicios' },

  {
    title: 'Ordenes de trabajo',
    icon: { icon: 'ri-tools-line' },
    children: [
      {
        title: 'Registrar',
        to: 'work-orders-add',
        icon: { icon: 'ri-file-add-line' },
      },
      {
        title: 'Listado',
        to: 'work-orders-list',
        icon: { icon: 'ri-file-list-3-line' },
      },
    ],
  },
  {
    title: 'Ventas',
    icon: { icon: 'ri-shopping-cart-2-line' },
    children: [
      {
        title: 'Registrar',
        to: 'sales-add',
        icon: { icon: 'ri-file-add-line' },
      },
      {
        title: 'Listado',
        to: 'sales-list',
        icon: { icon: 'ri-file-list-3-line' },
      },
    ],
  },
  {
    title: 'Cotizaciones',
    icon: { icon: 'ri-file-text-line' },
    children: [
      {
        title: 'Registrar',
        to: 'quotes-add',
        icon: { icon: 'ri-file-add-line' },
      },
      {
        title: 'Listado',
        to: 'quotes-list',
        icon: { icon: 'ri-file-list-3-line' },
      },
    ],
  },
  {
    title: 'Pedidos',
    icon: { icon: 'ri-truck-line' },
    children: [
      {
        title: 'Registrar',
        to: 'sales-pedidos-distribuidor',
        icon: { icon: 'ri-file-add-line' },
      },
      {
        title: 'Listado',
        to: 'sales-pedidos-distribuidor-list',
        icon: { icon: 'ri-file-list-3-line' },
      },
    ],
  },
  {
    title: 'Devoluciones',
    icon: { icon: 'ri-arrow-go-back-line' },
    children: [
      {
        title: 'Registrar',
        to: 'returns-add',
        icon: { icon: 'ri-file-add-line' },
      },
      {
        title: 'Listado',
        to: 'returns-list',
        icon: { icon: 'ri-file-list-3-line' },
      },
    ],
  },

  { heading: 'Inventario' },
  {
    title: 'Productos',
    icon: { icon: 'ri-box-3-line' },
    children: [
      {
        title: 'Registrar',
        to: 'product-add',
        icon: { icon: 'ri-file-add-line' },
      },
      {
        title: 'Listado',
        to: 'product-list',
        icon: { icon: 'ri-file-list-3-line' },
      },
    ],
  },
  {
    title: 'Compras',
    icon: { icon: 'ri-shopping-bag-3-line' },
    children: [
      {
        title: 'Registrar',
        to: 'invoice-manual-purchase',
        icon: { icon: 'ri-file-add-line' },
      },
      {
        title: 'Listado',
        icon: { icon: 'ri-file-list-3-line' },
        to: 'invoice-list',
      },
    ],
  },

  { heading: 'Administración' },
  {
    title: 'Recursos Humanos',
    icon: { icon: 'ri-team-line' },
    children: [
      {
        title: 'Empleados',
        to: { name: 'employees-list' },
        icon: { icon: 'ri-user-3-line' },
      },
      {
        title: 'Socios',
        to: { name: 'partners-list' },
        icon: { icon: 'ri-shake-hands-line' },
      },
    ],
  },
  {
    title: 'Accesos y Seguridad',
    icon: { icon: 'ri-shield-keyhole-line' },
    children: [
      {
        title: 'Usuarios',
        to: { name: 'users' },
        icon: { icon: 'ri-user-settings-line' },
      },
      {
        title: 'Roles y Permisos',
        to: { name: 'roles-permisos' },
        icon: { icon: 'ri-lock-password-line' },
      },
    ],
  },
  {
    title: 'Configuraciones',
    icon: { icon: 'ri-settings-3-line' },
    children: [
      {
        title: 'Establecimiento',
        to: { name: 'sucursales' },
        icon: { icon: 'ri-building-line' },
      },
      {
        title: 'Almacenes',
        to: { name: 'sucursales-warehouses' },
        icon: { icon: 'ri-store-3-line' },
      },
      {
        title: 'Categorias',
        to: 'configuration-categories',
        icon: { icon: 'ri-folder-shared-line' },
      },
      {
        title: 'Unidades',
        to: 'configuration-units',
        icon: { icon: 'ri-ruler-line' },
      },
      {
        title: 'Conversiones',
        to: 'configuration-unit-convertion',
        icon: { icon: 'ri-scales-3-line' },
      },
      {
        title: 'Proveedores',
        to: 'configuration-providers',
        icon: { icon: 'ri-truck-line' },
      },
    ],
  },

  { heading: 'Información' },
  {
    title: 'Kardex',
    icon: { icon: 'ri-file-chart-line' },
    children: [
      {
        title: 'Por Producto',
        to: { name: 'kardex-producto' },
        icon: { icon: 'ri-box-3-line' },
      },
      {
        title: 'General',
        to: { name: 'kardex-index' },
        icon: { icon: 'ri-line-chart-line' },
      },
    ],
  },

]
