export default [
  {
    title: 'Dashboard',
    to: { name: 'dashboard' },
    icon: { icon: 'ri-pie-chart-box-line' },
  },
  { heading: 'Accesos' },
  {
    title: 'Roles y Permisos',
    to: { name: 'roles-permisos' },
    icon: { icon: 'ri-lock-password-line' },
  },
  {
    title: 'Nomina y finanzas',
    icon: { icon: 'ri-money-dollar-circle-line' },
    children: [
      {
        title: 'Operaciones',
        to: { name: 'finances-list' },
        icon: { icon: 'ri-dashboard-line' },
      },
      {
        title: 'Empleados',
        to: { name: 'employees-list' },
        icon: { icon: 'ri-group-line' },
      },
    ],
  },
  {
    title: 'Socios',
    icon: { icon: 'ri-group-3-line' },
    children: [
      {
        title: 'Listado',
        to: { name: 'partners-list' },
        icon: { icon: 'ri-list-check' },
      },
      {
        title: 'Contribuciones',
        to: { name: 'partners-contributions-list' },
        icon: { icon: 'ri-hand-coin-line' },
      },
    ],
  },
  {
    title: 'Usuarios',
    to: { name: 'users' },
    icon: { icon: 'ri-group-line' },
  },
  {
    title: 'Configuraciones',
    icon: { icon: 'ri-tools-line' },
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
        title: 'Proveedores',
        to: 'configuration-providers',
        icon: { icon: 'ri-radio-button-line' },
      },
    ],
  },
  { heading: 'Comercial' },
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
      }
    ],
  },
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
        to: 'second-page',
        icon: { icon: 'ri-radio-button-line' },
      },
      {
        title: 'Listado',
        to: 'second-page',
        icon: { icon: 'ri-radio-button-line' },
      },
    ],
  },
  {
    title: 'Devolución',
    icon: { icon: 'ri-loop-right-line' },
    to: 'second-page',
  },
  { heading: 'Almacen' },
  {
    title: 'Compras',
    icon: { icon: 'ri-box-3-line' },
    children: [
      {
        title: 'Registrar',
        to: 'second-page',
        icon: { icon: 'ri-computer-line' },
      },
      {
        title: 'Listado',
        to: 'second-page',
        icon: { icon: 'ri-bar-chart-line' },
      },
      {
        title: 'Ingresar compra desde un XML',
        icon: { icon: 'ri-roadster-line' },
        to: 'invoice-list',
      },
    ],
  },
  {
    title: 'Transporte',
    icon: { icon: 'ri-translate' },
    children: [
      {
        title: 'Registrar',
        to: 'second-page',
        icon: { icon: 'ri-computer-line' },
      },
      {
        title: 'Listado',
        to: 'second-page',
        icon: { icon: 'ri-bar-chart-line' },
      },
    ],
  },
  {
    title: 'Conversión',
    icon: { icon: 'ri-file-ppt-2-line' },
    to: 'second-page',
  },
  {
    title: 'Kardex',
    to: { name: 'second-page' },
    icon: { icon: 'ri-draft-line' },
  },
]
