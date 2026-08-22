# NOVENTIA — reconstrucción estable

Versión: `20260822-noventia-rebuild1`

Este paquete reconstruye el repositorio completo con los archivos recibidos.

## Incluye
- Aplicación web completa (`index.html`, `css/`, `js/`).
- Reglas de Firebase (`database.rules.json`).
- Proxy OCR de Cloudflare (`worker.js`, `wrangler.toml`).
- Marca NOVENTIA y estilo visual consolidado.
- Sidebar compacto de 168 px en escritorio.
- Editor de escandallos integrado en la página, no flotante.

## Sustitución
1. Haz una copia del repositorio actual.
2. Elimina su contenido salvo la carpeta `.git`.
3. Copia dentro todo el contenido de este ZIP.
4. Publica los cambios.
5. Despliega `database.rules.json` por separado en Firebase si corresponde.
6. Para Cloudflare, configura el secret con `wrangler secret put MISTRAL_API_KEY`.

## Notas
- `MISTRAL_API_KEY` no está incluida.
- `wrangler.toml` limita CORS al host de GitHub Pages indicado; si usas otro dominio, cambia `ALLOWED_ORIGIN`.
