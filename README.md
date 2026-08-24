# NOVENTIA — Comparador de precios (versión 20260824-noventia-comp1)

Reescritura completa del módulo *Comparar precios*. El resto del proyecto
NOVENTIA queda intacto. Este ZIP contiene la carpeta completa lista para
sustituir el contenido del repositorio.

## Cómo desplegar

1. Conserva `.git/` y `wrangler.toml` (no van en este ZIP).
2. Sustituye el resto del repositorio con el contenido de este ZIP —
   respetando exactamente la estructura de carpetas.
3. `git add . && git commit -m "Comparar precios NOVENTIA v20260824-noventia-comp1"`.
4. `git push origin main`.
5. Espera 30–60 s a que GitHub Pages publique.
6. Abre la app en un navegador y comprueba en consola:

       > window.APP_VERSION
       "20260824-noventia-comp1"

   Los clientes que ya tuvieran la app abierta se recargarán solos
   porque `version.json` también apunta a esta versión.

## Novedades

- El módulo **Comparar precios** (barra lateral → Análisis) ha sido
  reconstruido: KPIs reales, filtros por producto/categoría/proveedor,
  tabla profesional con normalización de precios a unidad base y
  detalle desplegable por producto.
- No se modifica ninguna otra pantalla, ninguna regla Firebase,
  ninguna función de guardado ni la seguridad admin1/admin2/admin3.

## Archivos que cambian

    js/27-comparativa.js   ← reescrito por completo
    js/10-state.js         ← nuevas claves cmp* añadidas
    css/styles.css         ← bloque final "COMPARAR PRECIOS — NOVENTIA"
    index.html             ← APP_VERSION y todos los ?v= unificados
    version.json           ← 20260824-noventia-comp1

Cualquier duda o incidencia consulta `VALIDACION_COMPARADOR.txt` en la
raíz de este ZIP.
