# OCR de albaranes — puesta en marcha

El OCR funciona así: la app manda la foto/PDF al Worker de Cloudflare (`worker.js`), que
comprueba la sesión de Firebase y llama a Mistral con la clave guardada como secret.
La app nunca ve la clave.

## Una sola vez (si el Worker aún no está desplegado)
1. Cuenta en https://console.mistral.ai → API Keys → crear clave.
2. En Cloudflare: Workers & Pages → Create → pega el contenido de `worker.js` → Deploy.
3. Worker → Settings → Variables and Secrets (tipo **Secret**):
   - `MISTRAL_API_KEY` = la clave del paso 1
   - `FIREBASE_API_KEY` = `AIzaSyCJIF3BsWdWnB59idnxCRlYbWixTp1sGb8` (apiKey de `js/02-firebase-config.js`)
   - opcional `ALLOWED_ORIGIN` = la URL de la app (por defecto `*`)
4. En la app: Admin → Configuración → OCR → pega la URL `https://…workers.dev` → **Probar OCR**.

La prueba genera un albarán de ejemplo y lo pasa por todo el circuito; si algo falla,
dice exactamente qué (sin URL, sesión, clave de Mistral, ruta incorrecta, red…).

## Notas
- La URL debe terminar en `.workers.dev`: la CSP de `index.html` solo permite ese dominio.
  Con dominio propio hay que añadirlo a `connect-src`.
- Los modelos están en `OCR_MODELS` (`js/48-ocr-albaran.js`). Si Mistral renombra alguno, se
  cambia ahí; el Worker no necesita cambios.
- Tests: `node tests/ocr-albaran.test.js`
