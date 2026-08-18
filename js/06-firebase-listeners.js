/* ═══════════════ FIREBASE LISTENERS ═══════════════ */
function initFirebaseListeners(){
  if(!fbDb) return;

  // Connection status
  fbDb.ref('.info/connected').on('value', snap => {
    fbConnected = snap.val() === true;
    const dot = document.getElementById('fb-dot');
    if(dot) dot.className = 'fb-dot' + (fbConnected ? ' on' : '');
    // Al (re)conectar, reenviar los pedidos que quedaron pendientes
    if(fbConnected){ try{ flushPendingOrders(); }catch(e){} }
  });

  // Orders — real-time sync
  let _lastOrderIds=null;
  fbDb.ref('orders').on('value', snap => {
    const val = snap.val();
    const newOrders = val ? Object.values(val).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)) : [];
    // Push notifications for new orders (admin) and status changes (restaurant)
    try{
      if(_lastOrderIds!==null){
        const oldIds=_lastOrderIds;
        newOrders.forEach(o=>{
          if(!oldIds.has(o.id)){
            if(S.session?.isAdmin) pushNotify(`Nuevo pedido — ${o.restaurant}`,`${(suppliers[o.supId]||{name:o.supId}).name} · ${fmt(total(o))}${o.urgent?' URGENTE':''}`,o.urgent?'':'');
          } else {
            const old=orders.find(x=>x.id===o.id);
            const myRests=S.session?.restaurants||[S.session?.restaurant];
            if(old&&old.status!==o.status&&S.session&&!S.session.isAdmin&&myRests.includes(o.restaurant)){
              if(o.status==='approved') pushNotify('Pedido aprobado ',`Tu pedido a ${(suppliers[o.supId]||{name:o.supId}).name} ha sido aprobado`,'');
              else if(o.status==='rejected') pushNotify('Pedido rechazado ✗',o.rejectReason||'Contacta con el administrador','');
            }
          }
        });
      }
    }catch(e){ console.warn('Push notify error:',e); }
    _lastOrderIds=new Set(newOrders.map(o=>o.id));
    orders = newOrders;
    if(S.view==='admin') renderAdminContent();
    if(S.view==='order' && S.orderTab==='history') render();
  });

  // Suppliers — real-time sync
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
    // Actualizar UI en TODAS las vistas cuando cambien los proveedores
    const _sv = window.scrollY;
    // No re-renderizar si el usuario está escribiendo (p.ej. añadiendo un
    // producto nuevo) o tiene el formulario abierto: el render borraría lo que
    // está escribiendo. Esto causaba que "no dejara entrar productos nuevos".
    const _ae = document.activeElement;
    const _typing = _ae && /^(INPUT|TEXTAREA|SELECT)$/.test(_ae.tagName);
    if((S.view==='order' || S.view==='albaran-new') && !(S.showAddProd || _typing)){
      render();
    } else if(S.view==='admin'){
      // En admin: solo refrescar si no estamos editando un proveedor inline
      // (para no cerrar el formulario de edición al admin)
      if(S.openSupId === null){
        renderAdminContent();
      }
    }
    requestAnimationFrame(()=>window.scrollTo(0,_sv));
  });

  // Comentarios por pedido — chat interno
  fbDb.ref('orderComments').on('value', snap => {
    const val = snap.val();
    orderComments = {};
    if(val){ Object.keys(val).forEach(oid=>{ orderComments[oid]=Object.values(val[oid]).sort((a,b)=>a.ts-b.ts); }); }
    if(S.view==='admin') renderAdminContent();
    if(S.view==='order' && S.orderTab==='history') render();
  });

  // Config global (ntfyTopic, etc.) — sincronizado en Firebase para todos los dispositivos
  let _loadedAppVersion = null; // versión vista al abrir la app (null = aún no cargada)
  fbDb.ref('globalCfg').on('value', snap => {
    const val = snap.val();
    if(val){
      if(val.ntfyTopic !== undefined) cfg.ntfyTopic = val.ntfyTopic;
      if(val.approvalMinAmount !== undefined) cfg.approvalMinAmount = val.approvalMinAmount;
      if(val.alertThreshold !== undefined) cfg.alertThreshold = val.alertThreshold;
      if(val.priceAlertPct !== undefined) cfg.priceAlertPct = val.priceAlertPct;
      if(val.adminPhone !== undefined) cfg.adminPhone = val.adminPhone;
      localStorage.setItem('oc_cfg', JSON.stringify(cfg));

      // Forzar actualización remota
      if(val.appVersion !== undefined){
        if(_loadedAppVersion === null){
          // Primera lectura: guardamos la versión actual, no recargamos
          _loadedAppVersion = val.appVersion;
        } else if(val.appVersion !== _loadedAppVersion){
          // La versión cambió MIENTRAS el usuario tenía la app abierta → recargar
          const banner = document.createElement('div');
          banner.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.95);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:24px';
          banner.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:8px">Nueva versión disponible</div><div style="font-size:14px;opacity:.7;margin-bottom:24px">La aplicación se actualizará en unos segundos...</div><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.2);border-top-color:#e11d48;border-radius:50%;animation:spin .8s linear infinite"></div>';
          document.body.appendChild(banner);
          setTimeout(()=>{ window.location.reload(true); }, 2500);
        }
      }
    }
  });

  // Albaranes — real-time sync
  fbDb.ref('albaranes').on('value', snap => {
    const val = snap.val();
    albNotes = val ? Object.values(val).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)) : [];
    if(S.view==='admin' && S.adminTab==='albaranes') renderAdminContent();
  });

  // Push default suppliers if DB is empty
  fbDb.ref('suppliers').once('value', snap => {
    if(!snap.val()){
      fbDb.ref('suppliers').set(DEFAULT_SUPS);
    }
  });

  // Revenue — food cost
  fbDb.ref('revenue').on('value', snap => {
    revenue = snap.val() || {};
  });
  // Budgets
  fbDb.ref('budgets').on('value', snap => {
    budgets = snap.val() || {};
    if(S.view==='admin' && S.adminTab==='budgets') renderAdminContent();
  });
  // Extra expenses (gastos manuales)
  fbDb.ref('extraExpenses').on('value', snap => {
    extraExpenses = snap.val() || {};
  });
  // Price history
  fbDb.ref('priceHistory').on('value', snap => {
    const val = snap.val();
    priceHistory = val ? Object.values(val).sort((a,b)=>new Date(b.changedAt)-new Date(a.changedAt)) : [];
  });
  // Templates
  fbDb.ref('templates').on('value', snap => {
    templates = snap.val() || {};
    if(S.view==='order'){const _sv=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo(0,_sv));}
  });

  // Inventory — real-time sync
  fbDb.ref('inventory').on('value', snap => {
    inventory = snap.val() || {};
    if(S.view==='admin' && S.adminTab==='inventario') renderAdminContent();
    if(S.view==='order' && S.orderTab==='inventario'){ const _sv=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo(0,_sv)); }
  });
  fbDb.ref('inventoryMovements').on('value', snap => {
    inventoryMovements = snap.val() || {};
    if(S.view==='admin' && S.adminTab==='inventario') renderAdminContent();
    if(S.view==='order' && S.orderTab==='inventario'){ const _sv=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo(0,_sv)); }
  });

  // Recetas — real-time sync

  // Auth users (registrations)
  fbDb.ref('authUsers').on('value', snap => {
    authUsers = snap.val() || {};
    if(S.view==='admin' && S.adminTab==='solicitudes') renderAdminContent();
    // Update sidebar badge
    const badge=document.getElementById('sb-sol-badge');
    if(badge){ const n=Object.values(authUsers).filter(u=>u.status==='pending').length; badge.textContent=n; badge.style.display=n?'':'none'; }
    // If current user just got approved/rejected, update their session
    if(S.session?.uid && !S.session?.isAdmin){
      const me=authUsers[S.session.uid];
      if(me && me.status==='approved' && S.view==='pending-approval'){
        const myRests=me.restaurants||[me.restaurant];
        S.session={uid:me.uid,email:me.email,name:me.name||me.restaurant,restaurant:myRests[0]||me.restaurant,restaurants:myRests,isAdmin:false,needsApproval:me.needsApproval!==false};
        goOrder();
        toast('Tu acceso ha sido aprobado. ¡Bienvenido!','#16a34a',5000);
      } else if(me && me.status==='approved' && S.view==='order'){
        // Actualización en tiempo real de permisos (admin cambió accesos)
        const myRests=me.restaurants||[me.restaurant];
        const changed=JSON.stringify(myRests)!==JSON.stringify(S.session.restaurants||[]);
        if(changed){
          S.session.restaurants=myRests;
          // Si el restaurante activo ya no está permitido, cambiar al primero
          if(!myRests.includes(S.session.restaurant)) S.session.restaurant=myRests[0];
          S.session.needsApproval=me.needsApproval!==false;
          render();
        }
      } else if(me && me.status==='rejected' && S.view!=='pending-approval'){
        S.session={...S.session,pendingStatus:'rejected'};
        S.view='pending-approval';
        document.getElementById('hdr').style.display='none';
        render();
      }
    }
  });
}
