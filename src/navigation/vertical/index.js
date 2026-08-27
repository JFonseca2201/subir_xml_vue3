export default [
  {
    title: 'Pagina principal',
    to: { name: 'dashboard' },
    icon: { icon: 'ri-dashboard-line' },
    permission: 'dashboard',
  },

  {
    heading: 'Comercial',
    permissions: ['list_client', 'list_car', 'list_product'],
  },
  {
    title: 'Clientes',
    icon: { icon: 'ri-user-shared-2-line' },
    to: 'clients-list',
    permission: 'list_client',
  },
  {
    title: 'Vehículos',
    icon: { icon: 'ri-car-line' },
    to: 'vehicles-list',
    permission: 'list_car',
  },
  {
    title: 'Info Repuestos',
    to: 'inforepuestos',
    icon: { icon: 'ri-file-search-line' },
    permission: 'list_product',
  },

  {
    heading: 'Negocio Paralelo',
    permissions: ['list_transaction', 'register_transaction', 'edit_transaction', 'delete_transaction', 'approve_transactions'],
  },
  {
    title: 'Cuentas Paralelo',
    icon: { icon: 'ri-store-2-line' },
    to: 'negocio-paralelo',
    permission: 'list_transaction',
  },

  {
    heading: 'Finanzas',
    permissions: ['list_transfer', 'list_transaction', 'list_arqueo', 'register_transfer', 'register_transaction'],
  },
  {
    title: 'Cuentas/Operaciones',
    icon: { icon: 'ri-bank-line' },
    children: [
      {
        title: 'Cuentas',
        to: { name: 'accounts-index' },
        icon: { icon: 'ri-bank-card-line' },
        permission: 'list_transfer',
      },
      {
        title: 'Operaciones',
        to: { name: 'operations-index' },
        icon: { icon: 'ri-exchange-funds-line' },
        activeMatch: /operations|transfers|employee-expenses|aportes/,
        permission: 'list_transaction',
      },
      {
        title: 'Ingresos y Gastos',
        to: { name: 'movements-index' },
        icon: { icon: 'ri-exchange-dollar-line' },
        permission: 'list_transaction',
      },
      {
        title: 'Arqueo de Caja',
        to: { name: 'finanzas-arqueo' },
        icon: { icon: 'ri-safe-2-line' },
        permission: 'list_arqueo',
      },
    ],
  },

  {
    heading: 'Servicios',
    permissions: [
      'register_work_order', 'list_work_order', 'edit_work_order', 'delete_work_order',
      'register_sale', 'list_sale', 'edit_sale', 'delete_sale',
      'register_quote', 'list_quote', 'edit_quote', 'delete_quote',
      'register_pedido', 'list_pedido', 'edit_pedido', 'delete_pedido',
      'return',
    ],
  },
  {
    title: 'Ordenes de trabajo',
    icon: { icon: 'ri-tools-line' },
    permission: 'list_work_order',
    children: [
      {
        title: 'Registrar',
        to: 'work-orders-add',
        icon: { icon: 'ri-file-add-line' },
        permission: 'register_work_order',
      },
      {
        title: 'Listado',
        to: 'work-orders-list',
        icon: { icon: 'ri-file-list-3-line' },
        permission: 'list_work_order',
      },
    ],
  },
  {
    title: 'Ventas',
    icon: { icon: 'ri-shopping-cart-2-line' },
    permission: 'list_sale',
    children: [
      {
        title: 'Registrar',
        to: 'sales-add',
        icon: { icon: 'ri-file-add-line' },
        permission: 'register_sale',
      },
      {
        title: 'Listado',
        to: 'sales-list',
        icon: { icon: 'ri-file-list-3-line' },
        permission: 'list_sale',
      },
    ],
  },
  {
    title: 'Cotizaciones',
    icon: { icon: 'ri-file-text-line' },
    permission: 'list_quote',
    children: [
      {
        title: 'Registrar',
        to: 'quotes-add',
        icon: { icon: 'ri-file-add-line' },
        permission: 'register_quote',
      },
      {
        title: 'Listado',
        to: 'quotes-list',
        icon: { icon: 'ri-file-list-3-line' },
        permission: 'list_quote',
      },
    ],
  },
  {
    title: 'Pedidos',
    icon: { icon: 'ri-truck-line' },
    permission: 'list_pedido',
    children: [
      {
        title: 'Registrar',
        to: 'sales-pedidos-distribuidor',
        icon: { icon: 'ri-file-add-line' },
        permission: 'register_pedido',
      },
      {
        title: 'Listado',
        to: 'sales-pedidos-distribuidor-list',
        icon: { icon: 'ri-file-list-3-line' },
        permission: 'list_pedido',
      },
    ],
  },
  {
    title: 'Devoluciones',
    icon: { icon: 'ri-arrow-go-back-line' },
    permission: 'return',
    children: [
      {
        title: 'Registrar',
        to: 'returns-add',
        icon: { icon: 'ri-file-add-line' },
        permission: 'return',
      },
      {
        title: 'Listado',
        to: 'returns-list',
        icon: { icon: 'ri-file-list-3-line' },
        permission: 'return',
      },
    ],
  },

  {
    heading: 'Inventario',
    permissions: ['register_product', 'list_product', 'register_purchase', 'list_purchase'],
  },
  {
    title: 'Productos',
    icon: { icon: 'ri-box-3-line' },
    permission: 'list_product',
    children: [
      {
        title: 'Registrar',
        to: 'product-add',
        icon: { icon: 'ri-file-add-line' },
        permission: 'register_product',
      },
      {
        title: 'Listado',
        to: 'product-list',
        icon: { icon: 'ri-file-list-3-line' },
        permission: 'list_product',
      },
    ],
  },
  {
    title: 'Compras',
    icon: { icon: 'ri-shopping-bag-3-line' },
    permission: 'list_purchase',
    children: [
      {
        title: 'Registrar',
        to: 'invoice-manual-purchase',
        icon: { icon: 'ri-file-add-line' },
        permission: 'register_purchase',
      },
      {
        title: 'Listado',
        icon: { icon: 'ri-file-list-3-line' },
        to: 'invoice-list',
        permission: 'list_purchase',
      },
      {
        title: 'Conciliación y Pagos',
        icon: { icon: 'ri-exchange-dollar-line' },
        to: 'invoice-reconciliation',
        permission: 'list_purchase',
      },
      {
        title: 'Saldos a Favor',
        icon: { icon: 'ri-hand-coin-line' },
        to: 'invoice-supplier-credits',
        permission: 'list_purchase',
      },
    ],
  },

  {
    heading: 'Administración',
    permissions: [
      'list_employee', 'register_employee', 'edit_employee', 'delete_employee',
      'list_partner', 'register_partner', 'edit_partner', 'delete_partner',
      'list_user', 'register_user', 'edit_user', 'delete_user',
      'list_role', 'register_role', 'edit_role', 'delete_role',
      'settings', 'manage_settings', 'conversions', 'list_supplier',
    ],
  },
  {
    title: 'Recursos Humanos',
    icon: { icon: 'ri-team-line' },
    permission: 'list_employee',
    children: [
      {
        title: 'Empleados',
        to: { name: 'employees-list' },
        icon: { icon: 'ri-user-3-line' },
        permission: 'list_employee',
      },
      {
        title: 'Socios',
        to: { name: 'partners-list' },
        icon: { icon: 'ri-shake-hands-line' },
        permission: 'list_partner',
      },
    ],
  },
  {
    title: 'Accesos y Seguridad',
    icon: { icon: 'ri-shield-keyhole-line' },
    permission: 'list_user',
    children: [
      {
        title: 'Usuarios',
        to: { name: 'users' },
        icon: { icon: 'ri-user-settings-line' },
        permission: 'list_user',
      },
      {
        title: 'Roles y Permisos',
        to: { name: 'roles-permisos' },
        icon: { icon: 'ri-lock-password-line' },
        permission: 'list_role',
      },
    ],
  },
  {
    title: 'Configuraciones',
    icon: { icon: 'ri-settings-3-line' },
    permission: 'settings',
    children: [
      {
        title: 'Establecimiento',
        to: { name: 'sucursales' },
        icon: { icon: 'ri-building-line' },
        permission: 'settings',
      },
      {
        title: 'Almacenes',
        to: { name: 'sucursales-warehouses' },
        icon: { icon: 'ri-store-3-line' },
        permission: 'settings',
      },
      {
        title: 'Categorias',
        to: 'configuration-categories',
        icon: { icon: 'ri-folder-shared-line' },
        permission: 'settings',
      },
      {
        title: 'Unidades',
        to: 'configuration-units',
        icon: { icon: 'ri-ruler-line' },
        permission: 'settings',
      },
      {
        title: 'Conversiones',
        to: 'configuration-unit-convertion',
        icon: { icon: 'ri-scales-3-line' },
        permission: 'conversions',
      },
      {
        title: 'Proveedores',
        to: 'configuration-providers',
        icon: { icon: 'ri-truck-line' },
        permission: 'list_supplier',
      },
    ],
  },

  {
    heading: 'Información',
    permissions: ['kardex'],
  },
  {
    title: 'Kardex',
    icon: { icon: 'ri-file-chart-line' },
    permission: 'kardex',
    children: [
      {
        title: 'Por Cliente / Vehículo',
        to: 'kardex-cliente',
        icon: { icon: 'ri-user-search-line' },
        permission: 'kardex',
      },
      {
        title: 'Por Producto',
        to: 'kardex-producto',
        icon: { icon: 'ri-box-3-line' },
        permission: 'kardex',
      },
      {
        title: 'General',
        to: 'kardex',
        icon: { icon: 'ri-line-chart-line' },
        permission: 'kardex',
      },
    ],
  },
]
