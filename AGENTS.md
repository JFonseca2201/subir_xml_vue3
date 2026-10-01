# Reglas de Desarrollo - POS / Inventario / Órdenes de Trabajo

## 1. Homogeneidad y Estandarización de Interfaces (Look & Feel Unificado)
Todas las vistas del sistema (Ventas, Órdenes de Trabajo, Empleados, Socios, Clientes, Vehículos, Productos, Cotizaciones, Finanzas, etc.) deben compartir la misma estructura visual e interfaz estandarizada:
- **Encabezado y Acciones**: Título de módulo claro con avatares/íconos de sección, tarjetas de métricas/KPI consistentes (`.kpi-stat-card`, `.operations-kpi-card`) y barra de botones de acción con espaciado uniforme (`style="gap: 12px;"` o `.gap-3`).
- **Filtros de Búsqueda**: Tarjeta con fondo blanco/superficie, botón de "Limpiar Filtros", y campos de texto/selects con `density="comfortable"` o `density="compact"`.
- **Tablas de Listados**:
  - Encabezados con clase `bg-grey-lighten-5` y padding uniforme `py-3`.
  - Columnas de identificación / clientes con avatares tonales `size="34"` o `size="38"` y esquinas redondeadas (`rounded="lg"`).
  - Botones de acciones compactos tonales (`size="small"`, `variant="tonal"`).
  - Estados representados **exclusivamente** con píldoras limpias con punto indicador (`.status-pill-clean`).
- **Diálogos y Modales (`VDialog`)**: Cabeceras con banner o estilo horizontal estilizado, tarjetas de estadísticas superiores (`.stat-glass-card`), paneles agrupados (`.modern-section-panel`), y barra de pie fija o clara con botones de acción.

## 2. Estados de Carga con Skeletons (Obligatorio)
- Para la carga de datos en tablas y listados se DEBE utilizar **Skeletons con Shimmer** (`.skeleton-row`, `.shimmer-line`, `.shimmer-chip`, `.shimmer-button`) en lugar de simples spinners o pantallas en blanco.
- Los skeletons deben reflejar fielmente la estructura y número de columnas de la tabla final para una experiencia de usuario fluida y moderna.

## 3. Manejo Global de Notificaciones y Errores (Toast Global)
- **Toast Global Único**: Usar SIEMPRE el composable central `useGlobalToast` (`const { showNotification } = useGlobalToast()` o `extractErrorMessage(err)`). Queda prohibido el uso de `alert()` o sistemas de notificación desconectados.
- **Tipos de Toast Estrictos según Corresponda**:
  - `'success'`: Operaciones completadas con éxito (creación, edición, sincronización, descargas, guardados).
  - `'warning'`: Alertas, confirmaciones preventivas, advertencias de validación o estados incompletos/parciales.
  - `'error'`: Fallos en peticiones, excepciones no controladas o rechazos de operación.
  - `'info'`: Procesos en progreso, mensajes informativos, recordatorios o estados neutrales.
- **Mensaje Real del Backend**: Se debe mostrar con precisión el mensaje que devuelve el backend en respuestas exitosas o de validación (`response.message` o `response.data.message`).
- **Errores Claros y Comprensibles para el Usuario**:
  - Si el backend responde con un error técnico de base de datos (ej. `SQLSTATE`, `QueryException`, `Integrity constraint violation`, `Foreign key constraint`), **NUNCA** mostrar la traza técnica al usuario.
  - Transformar el error técnico en una explicación amigable, clara y profesional (ej. *"No se puede eliminar el registro porque tiene documentos asociados en el sistema"* o *"El registro no se pudo procesar debido a un conflicto de datos"*).

## 4. Regla de Oro: Buscar y Reutilizar Estilos Existentes (NO Duplicar)
- **Paso Obligatorio**: ANTES de crear o añadir cualquier clase de estilo, **buscar primero en `src/assets/styles/inventory.scss`**.
- **Si el estilo o uno equivalente ya existe**, se DEBE **reutilizar** tal cual está, **JAMÁS volver a escribirlo ni duplicarlo**.
- **Solo en caso de que NO exista** y sea estrictamente necesario, se agregará de forma ordenada en `src/assets/styles/inventory.scss`.

## 5. Cero Estilos Dispersos en Archivos `.vue`
- **Prohibido colocar bloques `<style scoped>` o `<style>`** en componentes `.vue` o vistas de `src/pages/` y `src/components/`.
- Todos los estilos deben provenir y ser gestionados centralmente desde `src/assets/styles/inventory.scss`.

## 6. PROHIBIDO el Scroll Horizontal (Listados, Modales y Formularios)
- **Listados y Tablas**: Todas las columnas deben ajustarse de manera fluida y sobria a la pantalla sin generar scroll horizontal. Utilizar anchos proporcionales, `text-truncate`, `break-word` o flexbox compacto.
- **Diálogos y Modales (`VDialog`)**: Anchos máximos (`max-width`) adecuados y estructurados para scroll vertical únicamente (`scrollable`).
- **Formularios de Creación / Edición**: Distribución simétrica y responsiva en columnas (`VRow`, `VCol`) sin desbordamientos.

## 7. Catálogo de Clases Globales Frecuentes
- **Píldoras de Estado**: `.status-pill-clean` con `<span class="status-dot" />` (`.status-paid`, `.status-partial`, `.status-pending`, `.status-transfer`, `.status-quote`, `.status-canceled`, `.status-draft`).
- **Badges y Placas**: `.vehicle-plate-large`, `.kardex-plate-badge`, `.sku-badge`, `.quantity-circle`.
- **Paneles y Tarjetas**: `.modern-section-panel`, `.stat-glass-card`, `.operations-kpi-card`, `.sri-security-ribbon`, `.status-composite-card`.
- **Tablas**: `.app-data-table`, `.employees-modern-table`, encabezados `bg-grey-lighten-5`.
- **Utilidades Flexbox**: `.gap-0` a `.gap-6`, `.gap-x-*`, `.gap-y-*`.
