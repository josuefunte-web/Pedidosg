/* ═══════════════ INIT ═══════════════ */
window.addEventListener('DOMContentLoaded',()=>{
  try {
    fbApp = firebase.initializeApp(FB_CONFIG);
    fbDb  = firebase.database();
    fbAuth= firebase.auth();
  } catch(e) {
    console.warn('Firebase init error:', e);
  }
  // Si Firebase no se cargó (CDN lenta/caída), reintentar en 3 s
  if(!fbAuth){
    setTimeout(()=>{
      if(!fbAuth && typeof firebase !== 'undefined'){
        try{ fbApp=firebase.initializeApp(FB_CONFIG); fbDb=firebase.database(); fbAuth=firebase.auth(); initFirebaseListeners(); }catch(e){}
        // Re-renderizar para quitar el spinner de "Conectando"
        if(S.view==='login') render();
      }
    },3000);
  }
  if(S.darkMode){ document.body.classList.add('dark'); const btn=document.getElementById('btn-dark'); if(btn) btn.textContent='☀️'; }

  // ── PWA SETUP ────────────────────────────────────────────────────────────
  (function initPWA(){
    // 1. Generar icono con Canvas (PNG nativo, funciona en iOS y Android)
    function makeIcon(size){
      try{
        const c=document.createElement('canvas');
        c.width=c.height=size;
        const ctx=c.getContext('2d');
        const r=size*0.16;
        // Fondo redondeado
        ctx.beginPath();
        ctx.moveTo(r,0);ctx.lineTo(size-r,0);ctx.arcTo(size,0,size,r,r);
        ctx.lineTo(size,size-r);ctx.arcTo(size,size,size-r,size,r);
        ctx.lineTo(r,size);ctx.arcTo(0,size,0,size-r,r);
        ctx.lineTo(0,r);ctx.arcTo(0,0,r,0,r);
        ctx.closePath();
        ctx.fillStyle='#1e293b';ctx.fill();
        // Letra P
        ctx.fillStyle='#ffffff';
        ctx.font=`900 ${Math.round(size*0.6)}px -apple-system,system-ui,sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('P',size/2,size*0.45);
        // Barra roja
        ctx.fillStyle='#e11d48';
        ctx.beginPath();
        const bh=size*0.09,by=size*0.76,bx=size*0.15,bw=size*0.7,br=bh/2;
        ctx.roundRect(bx,by,bw,bh,br);
        ctx.fill();
        return c.toDataURL('image/png');
      }catch(e){return '';}
    }
    const icon192=makeIcon(192);
    const icon512=makeIcon(512);

    // 2. apple-touch-icon (necesario para iOS)
    if(icon192){
      const link=document.createElement('link');
      link.rel='apple-touch-icon';link.href=icon192;
      document.head.appendChild(link);
    }

    // 3. Manifest
    const manifest={
      name:'Provea — Gestión de Pedidos',
      short_name:'Provea',
      description:'Gestión de compras del grupo O\'Carro',
      start_url:'./',
      display:'standalone',
      orientation:'portrait',
      background_color:'#f8fafc',
      theme_color:'#1e293b',
      icons:[
        {src:icon192,sizes:'192x192',type:'image/png',purpose:'any maskable'},
        {src:icon512,sizes:'512x512',type:'image/png',purpose:'any maskable'},
      ]
    };
    const mBlob=new Blob([JSON.stringify(manifest)],{type:'application/json'});
    document.getElementById('pwa-manifest').href=URL.createObjectURL(mBlob);

    // 4. Service Worker — dos estrategias distintas según el tipo de archivo:
    //    · CDN externas (Firebase, Chart.js, xlsx): cache-first — nunca cambian
    //      por versión, así que servirlas desde caché es rápido y funciona offline.
    //    · Archivos propios de la app (html/js/css en nuestro dominio):
    //      NETWORK-FIRST — siempre intenta la red primero para que cualquier
    //      subida a GitHub se refleje al instante en la próxima visita, y solo
    //      cae a caché si el usuario está sin conexión. Esto resuelve de raíz
    //      el problema de "los usuarios ven código antiguo": el service worker
    //      pasa por encima de la caché del navegador y garantiza que si hay
    //      internet, se carga siempre la última versión.
    if('serviceWorker' in navigator){
      const CDN=[
        'https://cdn.jsdelivr.net/npm/firebase@9.23.0/firebase-app-compat.js',
        'https://cdn.jsdelivr.net/npm/firebase@9.23.0/firebase-database-compat.js',
        'https://cdn.jsdelivr.net/npm/firebase@9.23.0/firebase-auth-compat.js',
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
      ];
      const swCode=`
const CACHE='provea-v3';
const CDN=${JSON.stringify(CDN)};
const APP_HOST=self.location.host;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CDN.map(u=>c.add(u)))));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  // 1) CDN externas: cache-first (nunca cambian entre versiones)
  if(CDN.indexOf(req.url)!==-1){
    e.respondWith(
      caches.match(req).then(r=>r||fetch(req).then(res=>{
        if(res && res.status===200){ const clone=res.clone(); caches.open(CACHE).then(c=>c.put(req,clone)); }
        return res;
      }))
    );
    return;
  }

  // 2) Archivos propios de la app (mismo host): NETWORK-FIRST
  if(url.host===APP_HOST){
    e.respondWith(
      fetch(req).then(res=>{
        if(res && res.status===200 && res.type==='basic'){
          const clone=res.clone();
          caches.open(CACHE).then(c=>c.put(req,clone));
        }
        return res;
      }).catch(()=>caches.match(req).then(r=>r||new Response('Sin conexión',{status:503,statusText:'Offline'})))
    );
    return;
  }

  // 3) Cualquier otra cosa (Firebase Realtime DB, etc.): pass-through al navegador
});`;
      const swBlob=new Blob([swCode],{type:'application/javascript'});
      navigator.serviceWorker.register(URL.createObjectURL(swBlob),{type:'classic'}).catch(()=>{});
    }

    // 5. Banner de instalación
    let _installPrompt=null;
    const isIOS=/ipad|iphone|ipod/i.test(navigator.userAgent)&&!window.MSStream;
    const isStandalone=window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;

    if(!isStandalone){
      // Android/Chrome: capturar evento de instalación nativo
      window.addEventListener('beforeinstallprompt',e=>{
        e.preventDefault(); _installPrompt=e;
        showInstallBanner('android');
      });
      // iOS: mostrar instrucciones manuales
      if(isIOS){
        // Solo si no se ha instalado ya (localStorage)
        if(!localStorage.getItem('pwa_banner_dismissed')){
          setTimeout(()=>showInstallBanner('ios'), 4000);
        }
      }
    }

    function showInstallBanner(type){
      if(document.getElementById('pwa-banner')) return;
      const banner=document.createElement('div');
      banner.id='pwa-banner';
      banner.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#1e293b;color:#fff;padding:14px 16px;z-index:9999;display:flex;align-items:center;gap:12px;box-shadow:0 -4px 20px rgba(0,0,0,.3);font-family:-apple-system,system-ui,sans-serif';
      if(type==='android'){
        banner.innerHTML=`<div style="flex:1"><div style="font-weight:700;font-size:14px">Instalar Provea</div><div style="font-size:12px;opacity:.7;margin-top:2px">Añade la app a tu pantalla de inicio</div></div><button onclick="if(window._pwaInstall)window._pwaInstall()" style="background:#e11d48;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">Instalar</button><button onclick="this.parentElement.remove();localStorage.setItem('pwa_banner_dismissed','1')" style="background:rgba(255,255,255,.1);color:#fff;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:16px">✕</button>`;
        window._pwaInstall=async()=>{ if(_installPrompt){await _installPrompt.prompt();_installPrompt=null;banner.remove();}};
      } else {
        banner.innerHTML=`<div style="flex:1"><div style="font-weight:700;font-size:14px">Instalar en iPhone/iPad</div><div style="font-size:12px;opacity:.7;margin-top:2px">Pulsa <strong>Compartir</strong> y luego <strong>"Añadir a pantalla de inicio"</strong></div></div><button onclick="this.parentElement.remove();localStorage.setItem('pwa_banner_dismissed','1')" style="background:rgba(255,255,255,.1);color:#fff;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:16px">✕</button>`;
      }
      document.body.appendChild(banner);
    }
  })();
  initFirebaseListeners();
  addMissingSuppliers();
  updateCoreSuppliers();

  // ── Firebase Auth: única fuente de sesión ──
  // (ya no hay bootstrap admin desde localStorage — todo pasa por aquí)
  if(fbAuth){
    fbAuth.onAuthStateChanged(user=>{
      if(user){
        fbDb.ref('authUsers/'+user.uid).once('value',snap=>{
          const u=snap.val();
          if(u && u.status==='approved'){
            // ── Bloqueo de cuenta ──
            if(u.blocked===true){
              alert('Tu cuenta está bloqueada. Contacta con el administrador.');
              fbAuth.signOut().catch(()=>{});
              S.session=null; S.view='login'; render();
              return;
            }
            const myRests=u.restaurants||[u.restaurant];
            const _rest0=myRests[0]||u.restaurant;
            // Rol: prioridad al campo `role`; si no, isAdmin legacy → admin1;
            // resto → jefe_cocina (default para locales que aún no tienen rol).
            const _role = (u.role && ROLES.includes(u.role)) ? u.role : (u.isAdmin ? 'admin1' : 'jefe_cocina');
            // NOTA: isAdmin del cliente es informativo (compat con UI antigua).
            // La autoridad real es `role` + Firebase Rules. NUNCA confiar en isAdmin
            // en cliente para decidir permisos — usar can(), hasAdminAccess(), etc.
            S.session={
              uid:user.uid,
              email:user.email,
              name:u.name||u.restaurant,
              restaurant:_rest0,
              restaurants:myRests,
              userId:userIdForRestaurant(_rest0),
              role:_role,
              isAdmin: isAdminRole(_role),  // derivado del rol real, no del flag legacy
              needsApproval:u.needsApproval!==false
            };
            // Si el rol tiene acceso admin, ir al panel admin. Si no, a la vista local.
            if(hasAdminAccess()){
              showHdr(true); S.view='admin';
            } else {
              showHdr(false); S.view='order';
              // Camareros arrancan en "Mis pedidos", no en "Hacer pedido"
              S.orderTab = can('canCreateOrders') ? 'new' : 'history';
            }
            const sl=visibleSups(); if(sl.length) S.supId=sl[0].id;
            render();
            try{ fbDb.ref('suppliers').once('value').catch(()=>{}); }catch(e){}

            // ── Listener runtime de bloqueo ──
            // Si el propio user es bloqueado mientras tiene sesión abierta,
            // se le desloguea al instante.
            try{ if(window._blockedListener) window._blockedListener.off(); }catch(e){}
            try{
              window._blockedListener = fbDb.ref('authUsers/'+user.uid+'/blocked');
              window._blockedListener.on('value', snap2 => {
                if(snap2.val() === true){
                  alert('Tu cuenta ha sido bloqueada por el administrador.');
                  try{ fbAuth.signOut().catch(()=>{}); }catch(e){}
                  S.session=null; S.view='login'; render();
                }
              });
            }catch(e){}

            // ── Backfill one-off de `total` en pedidos legacy ──
            // Las nuevas Firebase Rules exigen `total` en cada pedido.
            // Los pedidos creados antes de la Fase 1 no lo tienen. Solo
            // admin1 corre el backfill y solo una vez por instalación.
            if(isSuperAdmin() && !localStorage.getItem('oc_total_backfill_done')){
              setTimeout(()=>{ try{ _backfillOrderTotals(); }catch(e){console.warn('backfill:',e);} }, 3000);
            }
          } else if(u && (u.status==='pending'||u.status==='rejected')){
            S.session={uid:user.uid,email:user.email,pendingStatus:u.status};
            document.getElementById('hdr').style.display='none';
            S.view='pending-approval';
            render();
          } else {
            S.view='login'; render();
          }
        });
      } else {
        if(!S.session){ S.view='login'; render(); }
      }
    });
  }

  // ── Sin bootstrap admin desde localStorage ──
  // La sesión SIEMPRE viene de Firebase Auth (onAuthStateChanged arriba).
  // Firebase Auth ya persiste el token en IndexedDB, así que la sesión
  // sobrevive a recargas sin flags extra en localStorage.
  // Limpiamos el flag legacy por si quedaba en algún dispositivo.
  try{ localStorage.removeItem('oc_admin_session'); }catch(e){}
  if(!fbAuth){ render(); } // Firebase no disponible → mostrar login
});

// ── Backfill one-off del campo `total` en pedidos legacy ────────────
// Las Firebase Rules de la Fase 1 exigen `total` en cada pedido para
// validar el límite económico de aprobación de admin3. Los pedidos
// creados antes tienen items pero no un campo `total`. Este backfill
// lo calcula y lo persiste. Solo lo corre admin1, solo una vez.
function _backfillOrderTotals(){
  if(!fbDb) return;
  if(!isSuperAdmin()) return;
  fbDb.ref('orders').once('value').then(snap=>{
    const all=snap.val()||{};
    const updates={};
    let count=0;
    Object.entries(all).forEach(([id,o])=>{
      if(o && typeof o.total !== 'number'){
        const t=(o.items||[]).reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
        updates['orders/'+id+'/total'] = parseFloat(t.toFixed(2));
        count++;
      }
    });
    if(count===0){
      localStorage.setItem('oc_total_backfill_done','1');
      console.log('[backfill] no orders needed total');
      return;
    }
    fbDb.ref().update(updates).then(()=>{
      localStorage.setItem('oc_total_backfill_done','1');
      if(typeof toast==='function') toast(`Backfill OK: ${count} pedidos actualizados con total`,'#16a34a',4000);
      console.log('[backfill] '+count+' orders backfilled');
    }).catch(e=>console.warn('[backfill] error:',e));
  }).catch(e=>console.warn('[backfill] read error:',e));
}
