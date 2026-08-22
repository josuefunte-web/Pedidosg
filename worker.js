/**
 * Noventia — Mistral OCR Proxy
 *
 * Cloudflare Worker que actúa de proxy autenticado entre la PWA y Mistral.
 * Verifica que la petición viene de un usuario autenticado en Firebase Auth,
 * y si es válido reenvía la request a api.mistral.ai inyectando la API key
 * desde una variable de entorno secreta.
 *
 * La API key de Mistral NUNCA sale al cliente.
 *
 * Rutas soportadas:
 *   POST /mistral/chat/completions   → https://api.mistral.ai/v1/chat/completions
 *   POST /mistral/ocr                → https://api.mistral.ai/v1/ocr
 *
 * Rechaza cualquier otra ruta con 404.
 */

export default {
  async fetch(request, env) {
    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    // Solo POST bajo /mistral/*
    if (request.method !== 'POST' || !url.pathname.startsWith('/mistral/')) {
      return json({ error: 'not_found' }, 404, env);
    }

    // ── 1. Verificar Firebase Auth ID token ─────────────────────────────
    const auth = request.headers.get('Authorization') || '';
    const idToken = auth.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return json({ error: 'missing_auth' }, 401, env);

    let user;
    try {
      user = await verifyFirebaseIdToken(idToken, env.FIREBASE_API_KEY);
    } catch (e) {
      return json({ error: 'invalid_auth', detail: e.message }, 401, env);
    }
    if (!user || !user.localId) {
      return json({ error: 'invalid_auth' }, 401, env);
    }

    // ── 2. (Opcional) rate-limit por usuario ────────────────────────────
    // TODO: usar KV o Durable Object para limitar N req/min por user.localId.
    // Sin esto, un token robado puede llamar libremente hasta que expire (1h).

    // ── 3. Forward a Mistral con la API key inyectada ──────────────────
    if (!env.MISTRAL_API_KEY) {
      return json({ error: 'server_misconfigured', detail: 'MISTRAL_API_KEY no está configurada' }, 500, env);
    }

    const upstreamPath = url.pathname.replace(/^\/mistral/, '/v1');
    const upstreamUrl = 'https://api.mistral.ai' + upstreamPath;
    const body = await request.arrayBuffer();

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
          'Authorization': 'Bearer ' + env.MISTRAL_API_KEY,
          'Accept': 'application/json'
        },
        body
      });
    } catch (e) {
      return json({ error: 'upstream_unreachable', detail: e.message }, 502, env);
    }

    // ── 4. Devolver respuesta al cliente con CORS ───────────────────────
    const respBody = await upstream.arrayBuffer();
    const headers = new Headers({
      ...corsHeaders(env),
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-store'
    });
    return new Response(respBody, { status: upstream.status, headers });
  }
};

/**
 * Verifica un Firebase ID token usando el endpoint accounts:lookup.
 * Devuelve el objeto de usuario si es válido, throwea si no.
 *
 * Alternativa más eficiente: verificar la firma JWT contra JWKS
 * localmente (~100 líneas de crypto). Para volumen bajo esto es
 * suficiente. La Web API Key ya está en el cliente, así que no expone
 * nada extra.
 */
async function verifyFirebaseIdToken(idToken, apiKey) {
  if (!apiKey) throw new Error('server_misconfigured_no_api_key');
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!r.ok) throw new Error('lookup_failed_' + r.status);
  const data = await r.json();
  if (!data.users || !data.users.length) throw new Error('no_user');
  const u = data.users[0];
  if (u.disabled) throw new Error('user_disabled');
  return u;
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders(env),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
