/* ═══════════════ FIREBASE LISTENERS ═══════════════ */
// Refactorizado 19 ago 2026: antes era una única función de 209 líneas con
// todos los listeners; se dividió en un handler por rama de Firebase para
// facilitar mantenimiento. Ningún cambio de comportamiento — el orquestador
// initFirebaseListeners() los llama en el mismo orden que antes.

function initFirebaseListeners(){
  if(!fbDb) return;
  _listenConnection();
  _listenOrders();
  _listenSuppliers();
  _listenOrderComments();
  _listenGlobalCfg();
  _listenAlbaranes();
  _seedDefaultSuppliers();
  _listenRevenue();
  _listenBudgets();
  _listenExtraExpenses();
  _listenPriceHistory();
  _listenTemplates();
  _listenInventory();
  _listenAuthUsers();
  _listenFoodCost();
}

// Estado local del cliente para detectar pedidos nuevos vs cambios de estado
let _lastOrderIds = null;
// Versión de la app vista al abrir; si cambia mientras la app está abierta → recargar
let _loadedAppVersion = null;

// ── Conexión ────────────────────────────────────────────────────────────────
function _listenConnection(){
  fbDb.ref('.info/connected').on('value', snap => {
    fbConnected = snap.val() === true;
    const dot = document.getElementById('fb-dot');
    if(dot) dot.className = 'fb-dot' + (fbConnected ? ' on' : '');
    // Al (re)conectar, reenviar los pedidos que quedaron pendientes
    if(fbConnected){ try{ flushPendingOrders(); }catch(e){} }
  });
}

// ── Pedidos ─────────────────────────────────────────────────────────────────
function _listenOrders(){
  fbDb.ref('orders').on('value', snap => {
    const val = snap.val();
    const newOrders = val ? Object.values(val).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)) : [];
    _notifyOrderChanges(newOrders);
    _lastOrderIds = new Set(newOrders.map(o=>o.id));
    orders = newOrders;
    if(S.view==='admin') renderAdminContent();
    if(S.view==='order' && S.orderTab==='history') render();
  });
}
function _notifyOrderChanges(newOrders){
  if(_lastOrderIds===null) return; // primera carga: solo semilla
  try{
    const oldIds = _lastOrderIds;
    newOrders.forEach(o=>{
      if(!oldIds.has(o.id)){
        // Pedido nuevo → avisar al admin
        if(S.session?.isAdmin){
          pushNotify(
            `Nuevo pedido — ${o.restaurant}`,
            `${(suppliers[o.supId]||{name:o.supId}).name} · ${fmt(total(o))}${o.urgent?' URGENTE':''}`,
            o.urgent?'':''
          );
        }
      } else {
        // Pedido existente cambió → avisar al restaurante si le concierne
        const old = orders.find(x=>x.id===o.id);
        const myRests = S.session?.restaurants || [S.session?.restaurant];
        if(old && old.status!==o.status && S.session && !S.session.isAdmin && myRests.includes(o.restaurant)){
          if(o.status==='approved') pushNotify('Pedido aprobado ',`Tu pedido a ${(suppliers[o.supId]||{name:o.supId}).name} ha sido aprobado`,'');
          else if(o.status==='rejected') pushNotify('Pedido rechazado ✗', o.rejectReason||'Contacta con el administrador','');
        }
      }
    });
  }catch(e){ console.warn('Push notify error:',e); }
}

// ── Proveedores ─────────────────────────────────────────────────────────────
function _listenSuppliers(){
  fbDb.ref('suppliers').on('value', snap => {
    const val = snap.val();
    if(val){
      // Firebase devuelve arrays como objetos {0:{...},1:{...}} — normalizar a array
      Object.values(val).forEach(sup=>{
        if(sup && sup.products && !Array.isArray(sup.products)){
          sup.products = Object.values(sup.products);
        }
        if(sup && !sup.products) sup.products = [];
      });
      suppliers = val;
      // Preservar productos recién añadidos que aún no han llegado a Firebase
      if(S._cartProds){
        Object.entries(S._cartProds).forEach(([sid,prods])=>{
          if(!suppliers[sid]) return;
          if(!Array.isArray(suppliers[sid].products)) suppliers[sid].products=[];
          Object.values(prods).forEach(p=>{
            if(!suppliers[sid].products.find(x=>x.id===p.id)) suppliers[sid].products.push(p);
          });
        });
      }
      localStorage.setItem('oc_suppliers', JSON.stringify(suppliers));
    }
    _rerenderAfterSuppliers();
  });
}
// No re-renderizar si el usuario está escribiendo (p.ej. añadiendo un producto
// nuevo) o tiene el formulario abierto: el render borraría lo que está
// escribiendo. Esto causaba que "no dejara entrar productos nuevos".
function _rerenderAfterSuppliers(){
  const _sv = window.scrollY;
  const _ae = document.activeElement;
  const _typing = _ae && /^(INPUT|TEXTAREA|SELECT)$/.test(_ae.tagName);
  if((S.view==='order' || S.view==='albaran-new') && !(S.showAddProd || _typing)){
    render();
  } else if(S.view==='admin'){
    // En admin: solo refrescar si no estamos editando un proveedor inline
    // (para no cerrar el formulario de edición al admin)
    if(S.openSupId === null) renderAdminContent();
  }
  requestAnimationFrame(()=>window.scrollTo(0,_sv));
}
// Seed proveedores por defecto si la DB está vacía
function _seedDefaultSuppliers(){
  fbDb.ref('suppliers').once('value', snap => {
    if(!snap.val()) fbDb.ref('suppliers').set(DEFAULT_SUPS);
  });
}

// ── Chat interno por pedido ─────────────────────────────────────────────────
function _listenOrderComments(){
  fbDb.ref('orderComments').on('value', snap => {
    const val = snap.val();
    orderComments = {};
    if(val){ Object.keys(val).forEach(oid=>{ orderComments[oid]=Object.values(val[oid]).sort((a,b)=>a.ts-b.ts); }); }
    if(S.view==='admin') renderAdminContent();
    if(S.view==='order' && S.orderTab==='history') render();
  });
}

// ── Config global sincronizado (y actualización remota) ─────────────────────
function _listenGlobalCfg(){
  fbDb.ref('globalCfg').on('value', snap => {
    const val = snap.val();
    if(!val) return;
    if(val.ntfyTopic !== undefined) cfg.ntfyTopic = val.ntfyTopic;
    if(val.approvalMinAmount !== undefined) cfg.approvalMinAmount = val.approvalMinAmount;
    if(val.alertThreshold !== undefined) cfg.alertThreshold = val.alertThreshold;
    if(val.priceAlertPct !== undefined) cfg.priceAlertPct = val.priceAlertPct;
    if(val.adminPhone !== undefined) cfg.adminPhone = val.adminPhone;
    localStorage.setItem('oc_cfg', JSON.stringify(cfg));
    if(val.appVersion !== undefined) _handleAppVersionChange(val.appVersion);
  });
}
function _handleAppVersionChange(newVersion){
  if(_loadedAppVersion === null){
    // Primera lectura: guardamos la versión actual, no recargamos
    _loadedAppVersion = newVersion;
    return;
  }
  if(newVersion === _loadedAppVersion) return;
  // La versión cambió MIENTRAS el usuario tenía la app abierta → recargar
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.95);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:24px';
  banner.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:8px">Nueva versión disponible</div><div style="font-size:14px;opacity:.7;margin-bottom:24px">La aplicación se actualizará en unos segundos...</div><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.2);border-top-color:#e11d48;border-radius:50%;animation:spin .8s linear infinite"></div>';
  document.body.appendChild(banner);
  // Navegamos a una URL "nueva" (con parámetro único) en vez de solo recargar:
  // así el navegador no puede servir la página desde su caché local y se ve
  // obligado a pedir el index.html (y por tanto los .js con el ?v= nuevo) a GitHub.
  setTimeout(()=>{ window.location.replace(location.pathname + '?_r=' + Date.now()); }, 2500);
}
// El listener de arriba (`on('value')`) solo detecta un cambio de versión si la
// pestaña/app ha seguido "viva" todo el rato. En el móvil (sobre todo la app
// instalada en iOS) el sistema operativo suele congelar o matar la pestaña en
// segundo plano, así que al volver a abrirla es como si arrancara de cero y ese
// aviso nunca llega. Para cubrir ese caso, cada vez que la app vuelve a primer
// plano (se reabre, cambias de pestaña y vuelves) volvemos a preguntar a Firebase
// la versión actual con una lectura puntual, en vez de esperar pasivamente.
function _recheckAppVersion(){
  if(!fbDb) return;
  fbDb.ref('globalCfg/appVersion').once('value')
    .then(snap=>{ const v=snap.val(); if(v!==undefined) _handleAppVersionChange(v); })
    .catch(()=>{});
}
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') _recheckAppVersion(); });
window.addEventListener('pageshow', _recheckAppVersion);

// ── Albaranes ───────────────────────────────────────────────────────────────
function _listenAlbaranes(){
  fbDb.ref('albaranes').on('value', snap => {
    const val = snap.val();
    albNotes = val ? Object.values(val).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)) : [];
    if(S.view==='admin' && S.adminTab==='albaranes') renderAdminContent();
  });
}

// ── Analítica: ingresos, presupuestos, gastos extra, historial de precios ───
function _listenRevenue(){
  fbDb.ref('revenue').on('value', snap => { revenue = snap.val() || {}; });
}
function _listenBudgets(){
  fbDb.ref('budgets').on('value', snap => {
    budgets = snap.val() || {};
    if(S.view==='admin' && S.adminTab==='budgets') renderAdminContent();
  });
}
function _listenExtraExpenses(){
  fbDb.ref('extraExpenses').on('value', snap => { extraExpenses = snap.val() || {}; });
}
// ── Control de facturación y compras (% food cost) ──────────────────────────
function _listenFoodCost(){
  fbDb.ref('foodcost').on('value', snap => {
    foodCost = snap.val() || {};
    if(S.view==='admin' && S.adminTab==='foodcost') renderAdminContent();
  });
}
function _listenPriceHistory(){
  fbDb.ref('priceHistory').on('value', snap => {
    const val = snap.val();
    priceHistory = val ? Object.values(val).sort((a,b)=>new Date(b.changedAt)-new Date(a.changedAt)) : [];
  });
}

// ── Plantillas de pedido ────────────────────────────────────────────────────
function _listenTemplates(){
  fbDb.ref('templates').on('value', snap => {
    templates = snap.val() || {};
    if(S.view==='order'){ const _sv=window.scrollY; render(); requestAnimationFrame(()=>window.scrollTo(0,_sv)); }
  });
}

// ── Inventario y sus movimientos ────────────────────────────────────────────
function _listenInventory(){
  fbDb.ref('inventory').on('value', snap => {
    inventory = snap.val() || {};
    _rerenderInventory();
  });
  fbDb.ref('inventoryMovements').on('value', snap => {
    inventoryMovements = snap.val() || {};
    _rerenderInventory();
  });
}
function _rerenderInventory(){
  if(S.view==='admin' && S.adminTab==='inventario') renderAdminContent();
  if(S.view==='order' && S.orderTab==='inventario'){
    const _sv=window.scrollY; render(); requestAnimationFrame(()=>window.scrollTo(0,_sv));
  }
}

// ── Usuarios (registros con email/contraseña y aprobaciones) ────────────────
function _listenAuthUsers(){
  fbDb.ref('authUsers').on('value', snap => {
    authUsers = snap.val() || {};
    if(S.view==='admin' && S.adminTab==='solicitudes') renderAdminContent();
    _updatePendingApprovalsBadge();
    _syncCurrentSessionFromAuth();
  });
}
function _updatePendingApprovalsBadge(){
  const badge=document.getElementById('sb-sol-badge');
  if(!badge) return;
  const n=Object.values(authUsers).filter(u=>u.status==='pending').length;
  badge.textContent=n;
  badge.style.display=n?'':'none';
}
// Si el usuario actual acaba de ser aprobado/rechazado (o cambiaron sus locales),
// actualizar su sesión en vivo — evita que tenga que recargar la página.
function _syncCurrentSessionFromAuth(){
  if(!S.session?.uid || S.session?.isAdmin) return;
  const me = authUsers[S.session.uid];
  if(!me) return;
  if(me.status==='approved' && S.view==='pending-approval'){
    const myRests=me.restaurants||[me.restaurant];
    const _rest0=myRests[0]||me.restaurant;
    S.session={
      uid:me.uid, email:me.email,
      name:me.name||me.restaurant,
      restaurant:_rest0,
      restaurants:myRests,
      userId:userIdForRestaurant(_rest0),
      isAdmin:false,
      needsApproval:me.needsApproval!==false
    };
    goOrder();
    toast('Tu acceso ha sido aprobado. ¡Bienvenido!','#16a34a',5000);
    return;
  }
  if(me.status==='approved' && S.view==='order'){
    // Actualización en tiempo real de permisos (admin cambió accesos)
    const myRests=me.restaurants||[me.restaurant];
    const changed=JSON.stringify(myRests)!==JSON.stringify(S.session.restaurants||[]);
    if(changed){
      S.session.restaurants=myRests;
      // Si el restaurante activo ya no está permitido, cambiar al primero
      if(!myRests.includes(S.session.restaurant)) S.session.restaurant=myRests[0];
      S.session.userId=userIdForRestaurant(S.session.restaurant);
      S.session.needsApproval=me.needsApproval!==false;
      render();
    }
    return;
  }
  if(me.status==='rejected' && S.view!=='pending-approval'){
    S.session={...S.session,pendingStatus:'rejected'};
    S.view='pending-approval';
    document.getElementById('hdr').style.display='none';
    render();
  }
}
