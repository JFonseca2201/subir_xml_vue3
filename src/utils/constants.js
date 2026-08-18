export const COOKIE_MAX_AGE_1_YEAR = 365 * 24 * 60 * 60

export const PERMISOS = [
  {
    name: 'Dashboard',
    permisos: [
      { name: 'Gráficos', permiso: 'dashboard' },
    ],
  },
  {
    name: 'Roles',
    permisos: [
      { name: 'Registrar', permiso: 'register_role' },
      { name: 'Listado', permiso: 'list_role' },
      { name: 'Editar', permiso: 'edit_role' },
      { name: 'Eliminar', permiso: 'delete_role' },
    ],
  },
  {
    name: 'Usuarios',
    permisos: [
      { name: 'Registrar', permiso: 'register_user' },
      { name: 'Listado', permiso: 'list_user' },
      { name: 'Editar', permiso: 'edit_user' },
      { name: 'Eliminar', permiso: 'delete_user' },
    ],
  },
  {
    name: 'Configuraciones y Establecimiento',
    permisos: [
      { name: 'Ajustes Generales', permiso: 'settings' },
      { name: 'Administrar Ajustes', permiso: 'manage_settings' },
    ],
  },
  {
    name: 'Productos',
    permisos: [
      { name: 'Registrar', permiso: 'register_product' },
      { name: 'Listado', permiso: 'list_product' },
      { name: 'Editar', permiso: 'edit_product' },
      { name: 'Eliminar', permiso: 'delete_product' },
      { name: 'Ver Existencias', permiso: 'show_inventory_product' },
      { name: 'Ver billetera de precios', permiso: 'show_wallet_price_product' },
    ],
  },
  {
    name: 'Clientes',
    permisos: [
      { name: 'Registrar', permiso: 'register_client' },
      { name: 'Listado', permiso: 'list_client' },
      { name: 'Editar', permiso: 'edit_client' },
      { name: 'Eliminar', permiso: 'delete_client' },
    ],
  },
  {
    name: 'Vehículos',
    permisos: [
      { name: 'Registrar', permiso: 'register_car' },
      { name: 'Listado', permiso: 'list_car' },
      { name: 'Editar', permiso: 'edit_car' },
      { name: 'Eliminar', permiso: 'delete_car' },
    ],
  },
  {
    name: 'Órdenes de Trabajo',
    permisos: [
      { name: 'Registrar', permiso: 'register_work_order' },
      { name: 'Listado', permiso: 'list_work_order' },
      { name: 'Editar', permiso: 'edit_work_order' },
      { name: 'Eliminar', permiso: 'delete_work_order' },
    ],
  },
  {
    name: 'Cotizaciones',
    permisos: [
      { name: 'Registrar', permiso: 'register_quote' },
      { name: 'Listado', permiso: 'list_quote' },
      { name: 'Editar', permiso: 'edit_quote' },
      { name: 'Eliminar', permiso: 'delete_quote' },
    ],
  },
  {
    name: 'Pedidos Distribuidor',
    permisos: [
      { name: 'Registrar', permiso: 'register_pedido' },
      { name: 'Listado', permiso: 'list_pedido' },
      { name: 'Editar', permiso: 'edit_pedido' },
      { name: 'Eliminar', permiso: 'delete_pedido' },
    ],
  },
  {
    name: 'Ventas',
    permisos: [
      { name: 'Registrar', permiso: 'register_sale' },
      { name: 'Listado', permiso: 'list_sale' },
      { name: 'Editar', permiso: 'edit_sale' },
      { name: 'Eliminar', permiso: 'delete_sale' },
    ],
  },
  {
    name: 'Devolución',
    permisos: [
      { name: 'Disponible', permiso: 'return' },
    ],
  },
  {
    name: 'Compras y Facturas',
    permisos: [
      { name: 'Registrar Compra', permiso: 'register_purchase' },
      { name: 'Listado Compras', permiso: 'list_purchase' },
      { name: 'Editar Compra', permiso: 'edit_purchase' },
      { name: 'Eliminar Compra', permiso: 'delete_purchase' },
      { name: 'Registrar Factura', permiso: 'register_invoice' },
      { name: 'Listado Facturas', permiso: 'list_invoice' },
      { name: 'Editar Factura', permiso: 'edit_invoice' },
      { name: 'Eliminar Factura', permiso: 'delete_invoice' },
    ],
  },
  {
    name: 'Finanzas y Operaciones',
    permisos: [
      { name: 'Listado de Operaciones', permiso: 'list_transaction' },
      { name: 'Registrar Operación', permiso: 'register_transaction' },
      { name: 'Editar Operación', permiso: 'edit_transaction' },
      { name: 'Eliminar Operación', permiso: 'delete_transaction' },
      { name: 'Aprobar Operaciones', permiso: 'approve_transactions' },
      { name: 'Listado Cuentas (Tesorería)', permiso: 'list_transfer' },
      { name: 'Registrar Transferencia', permiso: 'register_transfer' },
      { name: 'Editar Transferencia', permiso: 'edit_transfer' },
      { name: 'Eliminar Transferencia', permiso: 'delete_transfer' },
      { name: 'Arqueo de Caja', permiso: 'list_arqueo' },
    ],
  },
  {
    name: 'Proveedores',
    permisos: [
      { name: 'Registrar', permiso: 'register_supplier' },
      { name: 'Listado', permiso: 'list_supplier' },
      { name: 'Editar', permiso: 'edit_supplier' },
      { name: 'Eliminar', permiso: 'delete_supplier' },
    ],
  },
  {
    name: 'Empleados',
    permisos: [
      { name: 'Registrar', permiso: 'register_employee' },
      { name: 'Listado', permiso: 'list_employee' },
      { name: 'Editar', permiso: 'edit_employee' },
      { name: 'Eliminar', permiso: 'delete_employee' },
      { name: 'Registrar Pagos', permiso: 'register_employee_payment' },
      { name: 'Listado Pagos', permiso: 'list_employee_payment' },
      { name: 'Editar Pagos', permiso: 'edit_employee_payment' },
      { name: 'Eliminar Pagos', permiso: 'delete_employee_payment' },
    ],
  },
  {
    name: 'Socios',
    permisos: [
      { name: 'Registrar', permiso: 'register_partner' },
      { name: 'Listado', permiso: 'list_partner' },
      { name: 'Editar', permiso: 'edit_partner' },
      { name: 'Eliminar', permiso: 'delete_partner' },
      { name: 'Registrar Aportes', permiso: 'register_partner_contribution' },
      { name: 'Listado Aportes', permiso: 'list_partner_contribution' },
      { name: 'Editar Aportes', permiso: 'edit_partner_contribution' },
      { name: 'Eliminar Aportes', permiso: 'delete_partner_contribution' },
    ],
  },
  {
    name: 'Transporte',
    permisos: [
      { name: 'Registrar', permiso: 'register_transport' },
      { name: 'Listado', permiso: 'list_transport' },
      { name: 'Editar', permiso: 'edit_transport' },
      { name: 'Eliminar', permiso: 'delete_transport' },
    ],
  },
  {
    name: 'Conversiones, Kardex y Reportes',
    permisos: [
      { name: 'Conversiones', permiso: 'conversions' },
      { name: 'Kardex', permiso: 'kardex' },
      { name: 'Importar XML', permiso: 'import_xml' },
      { name: 'Exportar Datos', permiso: 'export_data' },
      { name: 'Ver Reportes', permiso: 'view_reports' },
    ],
  },
]