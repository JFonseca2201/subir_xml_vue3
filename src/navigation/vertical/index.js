export default [
  {
    title: 'Pagina principal',
    to: { name: 'dashboard' },
    icon: { icon: 'ri-pie-chart-box-line' },
  },

  { heading: 'Comercial' },
  {
    title: 'Clientes',
    icon: { icon: 'ri-p2p-line' },
    to: 'clients-list',
  },
  {
    title: 'Vehículos',
    icon: { icon: 'ri-roadster-line' },
    to: 'vehicles-list',
  },
  {
    title: 'Ventas',
    icon: { icon: 'ri-money-dollar-box-line' },
    children: [
      {
        title: 'Registrar',
        to: 'sales-add',
        icon: { icon: 'ri-radio-button-line' },
      },
      {
        title: 'Listado',
        to: 'sales-list',
        icon: { icon: 'ri-radio-button-line' },
      },
    ],
  },
  {
    title: 'Pedidos',
    icon: { icon: 'ri-box-3-line' },
    children: [
      {
        title: 'Registrar Pedido',
        to: 'sales-pedidos-distribuidor',
        icon: { icon: 'ri-radio-button-line' },
      },
      {
        title: 'Listado Pedidos',
        to: 'sales-pedidos-distribuidor-list',
        icon: { icon: 'ri-radio-button-line' },
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
        icon: { icon: 'ri-radio-button-line' },
      },
      {
        title: 'Listado',
        to: 'returns-list',
        icon: { icon: 'ri-radio-button-line' },
      },
    ],
  },

  { heading: 'Servicios' },
  {
    title: 'Ordenes de trabajo',
    icon: { icon: 'ri-tools-line' },
    children: [
      {
        title: 'Nueva Orden',
        to: 'work-orders-add',
        icon: { icon: 'ri-file-list-3-line' },
      },
      {
        title: 'Listado',
        to: 'work-orders-list',
        icon: { icon: 'ri-file-list-3-line' },
      },
    ],
  },

  { heading: 'Inventario' },
  {
    title: 'Productos',
    icon: { icon: 'ri-product-hunt-line' },
    children: [
      {
        title: 'Registrar',
        to: 'product-add',
        icon: { icon: 'ri-radio-button-line' },
      },
      {
        title: 'Listado',
        to: 'product-list',
        icon: { icon: 'ri-radio-button-line' },
      },
    ],
  },
  {
    title: 'Compras',
    icon: { icon: 'ri-shopping-cart-2-line' },
    children: [
      {
        title: 'Registrar',
        to: 'invoice-manual-purchase',
        icon: { icon: 'ri-computer-line' },
      },
      {
        title: 'Listado',
        icon: { icon: 'ri-file-list-3-line' },
        to: 'invoice-list',
      },
    ],
  },
  {
    title: 'Conversión',
    icon: { icon: 'ri-file-ppt-2-line' },
    to: 'configuration-unitconversions',
  },

  { heading: 'Finanzas' },
  {
    title: 'Cuentas y Operaciones',
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
        icon: { icon: 'ri-group-3-line' },
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
        icon: { icon: 'ri-group-line' },
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
        icon: { icon: 'ri-radio-button-line' },
      },
      {
        title: 'Almacenes',
        to: { name: 'sucursales-warehouses' },
        icon: { icon: 'ri-radio-button-line' },
      },
      {
        title: 'Categorias',
        to: 'configuration-categories',
        icon: { icon: 'ri-radio-button-line' },
      },
      {
        title: 'Unidades',
        to: 'configuration-units',
        icon: { icon: 'ri-ruler-line' },
      },
      {
        title: 'Conversiones',
        to: 'configuration-unit-convertion',
        icon: { icon: 'ri-file-ppt-2-line' },
      },
      {
        title: 'Proveedores',
        to: 'configuration-providers',
        icon: { icon: 'ri-radio-button-line' },
      },
    ],
  },

  { heading: 'Información' },
  {
    title: 'Kardex',
    to: { name: 'second-page' },
    icon: { icon: 'ri-draft-line' },
  },

]
