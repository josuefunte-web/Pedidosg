# Actualización automática de caché

Cada despliegue usa una versión única compartida por `index.html`, `version.json`, CSS y JavaScript.

La aplicación comprueba `version.json` sin caché al arrancar, al volver a la pestaña, al recuperar conexión y periódicamente. Si hay una versión nueva, limpia únicamente cachés con nombres relacionados con NOVENTIA/PROVEA y realiza una sola recarga por versión, conservando la ruta actual.

## Próximos despliegues
Antes de hacer commit ejecuta en la carpeta del proyecto:

```bash
python3 ACTUALIZAR_VERSION.py
```

Después sube **también** `index.html` y `version.json` en el mismo commit. No borra `localStorage`, Firebase ni datos de la aplicación.
