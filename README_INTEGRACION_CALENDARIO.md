# NOVENTIA — Calendario interno integrado

Este paquete integra un calendario interno de personal/vacaciones en NOVENTIA, sin React y sin dependencias nuevas.

## Archivos incluidos

Copia estos archivos sustituyendo los existentes cuando proceda:

```text
js/06-firebase-listeners.js
js/14-render.js
js/18-admin-view.js
js/47-vacaciones-personal.js
css/vacaciones-personal.css
```

## Añadir en index.html

Añade el CSS junto al resto de estilos:

```html
<link rel="stylesheet" href="css/vacaciones-personal.css?v=TU_VERSION">
```

Añade el JS después de `js/46-sup-visibility.js` y antes de `js/noventia-ui-final.js`:

```html
<script src="js/47-vacaciones-personal.js?v=TU_VERSION"></script>
```

Después actualiza `window.APP_VERSION`, todos los `?v=` y `version.json`.

## Dónde aparecerá

En el panel admin aparecerá:

```text
Gestión → Calendario
```

El módulo guarda datos en Firebase en:

```text
staff
vacations
```

Si Firebase no está disponible, usa localStorage para poder probar la interfaz.

## Reglas Firebase sugeridas

Añade estas ramas dentro de `rules` en `database.rules.json`:

```json
"staff": {
  ".read": "auth != null && root.child('authUsers').child(auth.uid).child('blocked').val() !== true && (root.child('authUsers').child(auth.uid).child('role').val() === 'admin1' || root.child('authUsers').child(auth.uid).child('role').val() === 'admin2')",
  ".write": "auth != null && root.child('authUsers').child(auth.uid).child('blocked').val() !== true && (root.child('authUsers').child(auth.uid).child('role').val() === 'admin1' || root.child('authUsers').child(auth.uid).child('role').val() === 'admin2')"
},
"vacations": {
  ".read": "auth != null && root.child('authUsers').child(auth.uid).child('blocked').val() !== true && (root.child('authUsers').child(auth.uid).child('role').val() === 'admin1' || root.child('authUsers').child(auth.uid).child('role').val() === 'admin2')",
  ".write": "auth != null && root.child('authUsers').child(auth.uid).child('blocked').val() !== true && (root.child('authUsers').child(auth.uid).child('role').val() === 'admin1' || root.child('authUsers').child(auth.uid).child('role').val() === 'admin2')"
}
```

## Validación realizada

- Sintaxis JS validada con `node --check`.
- Integración añadida en `06-firebase-listeners.js`.
- Ruta añadida en `14-render.js` y `18-admin-view.js`.
- Menú añadido en `18-admin-view.js`.
