# Provea UI 3.0 — paquete listo para GitHub

## Qué sustituir
Copia estos archivos conservando las carpetas:

- `index.html`
- `css/styles.css`
- `js/14-render.js`
- `js/16-order-view.js`
- `js/18-admin-view.js`

## Resultado
- Dashboard visual nuevo con KPIs, pedidos pendientes, gasto, proveedor principal y accesos rápidos.
- Sidebar granate, header y paneles alineados con la maqueta.
- Vista local con cabecera visual mejorada.
- Responsive para móvil.

## Importante
- Haz una rama o copia antes.
- El paquete conserva la lógica existente de Firebase y permisos.
- Si `S.adminTab` sigue siendo `pending`, abre el menú y pulsa **Dashboard**. Si quieres que sea la pantalla inicial, cambia el valor inicial de `adminTab` a `dashboard` en `10-state.js`.

## Corrección UI3b
Evita el error si `albaranes`, `inventory` o los cálculos de Food Cost aún no están disponibles al renderizar el dashboard.
