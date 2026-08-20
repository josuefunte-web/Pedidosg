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

    // 4. Service Worker — cachea scripts CDN para uso sin conexión parcial
    if('serviceWorker' in navigator){
      const CDN=[
        'https://cdn.jsdelivr.net/npm/firebase@9.23.0/firebase-app-compat.js',
        'https://cdn.jsdelivr.net/npm/firebase@9.23.0/firebase-database-compat.js',
        'https://cdn.jsdelivr.net/npm/firebase@9.23.0/firebase-auth-compat.js',
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
      ];
      const swCode=`
const CACHE='provea-v2';
const CDN=${JSON.stringify(CDN)};
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CDN.map(u=>c.add(u)))));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch',e=>{
  const u=e.request.url;
  if(CDN.some(c=>u===c)){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{caches.open(CACHE).then(c=>c.put(e.request,res.clone()));return res;})));
  }
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

  // ── Firebase Auth: siempre registrar onAuthStateChanged ──
  // (debe registrarse ANTES de restaurar sesión admin para capturar logins de restaurantes)
  if(fbAuth){
    fbAuth.onAuthStateChanged(user=>{
      if(S.session?.isAdmin) return; // admin activo vía localStorage, ignorar
      if(user){
        fbDb.ref('authUsers/'+user.uid).once('value',snap=>{
          const u=snap.val();
          const isAdminUser=(user.email && user.email.toLowerCase()===(cfg.adminEmail||'josue.funte@gmail.com').toLowerCase()) || (u && u.isAdmin===true);
          if(isAdminUser){ goAdmin(); return; }
          if(u && u.status==='approved'){
            const myRests=u.restaurants||[u.restaurant];
            S.session={uid:user.uid,email:user.email,name:u.name||u.restaurant,restaurant:myRests[0]||u.restaurant,restaurants:myRests,isAdmin:false,needsApproval:u.needsApproval!==false};
            showHdr(false);
            S.view='order';
            const sl=visibleSups(); if(sl.length) S.supId=sl[0].id;
            render();
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

  // ── Restaurar sesión de administrador (localStorage) ──
  if(localStorage.getItem('oc_admin_session')==='1'){
    S.session={isAdmin:true,name:cfg.adminName};
    showHdr(true);
    S.view='admin';
    render();
  } else if(!fbAuth){
    render(); // Firebase no disponible → mostrar login
  }
});
