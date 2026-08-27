/* ═══════════════ ADMIN VIEW ═══════════════ */
function buildSbStats(pend,appr){
  return `
    <div class="sb-ms"><div class="sb-msv">${pend.length}</div><div class="sb-msl">Pendientes</div></div>
    <div class="sb-ms"><div class="sb-msv" style="color:var(--acc)">${appr.length}</div><div class="sb-msl">Aprobados</div></div>
    <div class="sb-ms"><div class="sb-msv" style="font-size:13px">${fmt(pend.reduce((s,o)=>s+total(o),0))}</div><div class="sb-msl">Por aprobar</div></div>
    <div class="sb-ms"><div class="sb-msv" style="font-size:13px;color:#4ade80">${fmt(appr.reduce((s,o)=>s+total(o),0))}</div><div class="sb-msl">Gasto</div></div>`;
}

function vAdmin(){
  const pend=orders.filter(o=>o.status==='pending');
  const appr=orders.filter(o=>o.status==='approved');

  const pendingSol=Object.values(authUsers).filter(u=>u.status==='pending').length;
  function sbItem(id,lbl,badgeId){
    const act=S.adminTab===id;
    const badge=badgeId==='sb-pend-badge'
      ? `<span class="sb-badge" id="sb-pend-badge" style="${pend.length?'':'display:none'}">${pend.length}</span>`
      : badgeId==='sb-sol-badge'
      ? `<span class="sb-badge" id="sb-sol-badge" style="${pendingSol?'':'display:none'}">${pendingSol}</span>`
      : '';
    return `<div class="sg-direct${act?' act':''}" onclick="setTabSb('${id}')" style="display:flex;align-items:center;justify-content:space-between">${lbl}${badge}</div>`;
  }

  // Filtrado de items del sidebar según el rol del usuario (Fase 1 permisos):
  const _shopEdit = can('canManageProducts');       // admin2+ → gestión de productos/proveedores/escandallos
  const _canReviewAlb = can('canReviewAlbaranes');  // admin2+ → revisar albaranes
  const _canConfig = can('canConfigWeb');           // admin1 solo → configuración
  const _canManageUsers = can('canCreateBasicUsers'); // admin2+ → alta de usuarios y solicitudes
  const _canAssignSup = can('canAssignSuppliers'); // admin2+ → visibilidad de proveedores por local
  const sidebar=`<div class="sidebar${S.sidebarOpen?' sb-open':''}">
    <div class="sb-mini-stats" id="sb-stats">${buildSbStats(pend,appr)}</div>
    <div class="sb-section">Inicio</div>
    ${sbItem('dashboard','Inicio')}
    <div class="sb-section">Pedidos</div>
    ${sbItem('pending','Pendientes','sb-pend-badge')}
    ${sbItem('approved','Aprobados')}
    ${sbItem('received','Recibidos')}
    <div class="sb-section">Análisis</div>
    ${sbItem('budgets','Presupuestos')}
    ${sbItem('foodcost','Food Cost')}
    ${sbItem('compare','Comparar precios')}
    ${sbItem('compras','Compras por producto')}
    ${sbItem('sup-history','Por proveedor')}
    <div class="sb-section">Operaciones</div>
    ${_shopEdit?sbItem('productos','Productos'):''}
    ${_canReviewAlb?sbItem('albaranes','Albaranes'):''}
    ${sbItem('inventario','Inventario')}
    <div class="sb-section">Gestión</div>
    ${_canManageUsers?sbItem('solicitudes','Solicitudes','sb-sol-badge'):''}
    ${_shopEdit?sbItem('suppliers','Proveedores'):''}
    ${_canAssignSup?sbItem('sup-visibility','Visibilidad por local'):''}
    ${_shopEdit?sbItem('escandallos','Escandallos'):''}
    ${_canConfig?sbItem('settings','Configuración'):''}
    <div style="border-top:1px solid rgba(255,255,255,.1);margin:12px 10px 8px;padding-top:12px">
      <div class="sg-direct" onclick="S.adminOrderPicker=true;S.sidebarOpen=false;render()" style="background:rgba(251,191,36,.12);border-radius:9px;color:#fbbf24;font-weight:700;border:1px solid rgba(251,191,36,.25)">Hacer pedido</div>
    </div>
  </div>`;

  let content='';
  if(S.adminTab==='dashboard') content=vDashboard();
  else if(S.adminTab==='pending')        content=vPending();
  else if(S.adminTab==='approved')  content=vApproved();
  else if(S.adminTab==='received')  content=vReceived();
  else if(S.adminTab==='budgets')   content=vBudgets();
  else if(S.adminTab==='foodcost')  content=vFoodCost();
  else if(S.adminTab==='compare')   content=vCompare();
  else if(S.adminTab==='compras')   content=vComprasProducto();
  else if(S.adminTab==='productos')  content=vProductos();
  else if(S.adminTab==='albaranes') content=vAlbaranes();
  else if(S.adminTab==='solicitudes') content=vSolicitudes();
  else if(S.adminTab==='suppliers') content=vSuppliers();
  else if(S.adminTab==='sup-visibility') content=vSupVisibility();
  else if(S.adminTab==='settings')  content=vSettings();
  else if(S.adminTab==='escandallos') content=vEscandallos();
  else if(S.adminTab==='sup-history') content=vSupHistory();
  else if(S.adminTab==='inventario') content=vInventario();

  const liveTag=fbConnected?`<span class="live-badge"><span class="pulse"></span>EN VIVO</span>`:'';

  const adminOrderModal=S.adminOrderPicker?`
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:500;display:flex;align-items:center;justify-content:center;padding:24px" onclick="S.adminOrderPicker=false;render()">
      <div style="background:var(--card);border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.3);max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
        <div style="font-weight:700;font-size:17px;margin-bottom:4px">Hacer pedido</div>
        <div style="font-size:13px;color:var(--mut);margin-bottom:16px">Selecciona el restaurante para el que haces el pedido</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${(()=>{
            // Combinar restaurantes de authUsers (aprobados en Firebase) + cfg.users (legado)
            const fbRests=[...new Set(Object.values(authUsers).filter(u=>u.status==='approved').flatMap(u=>u.restaurants||[u.restaurant]).filter(Boolean))];
            const cfgRests=cfg.users.map(u=>u.restaurant).filter(r=>r&&!fbRests.includes(r));
            const allRests=[...fbRests,...cfgRests].sort();
            if(!allRests.length) return `<div style="font-size:13px;color:var(--mut);text-align:center;padding:12px">Sin restaurantes registrados</div>`;
            return allRests.map(r=>`<button class="btn btn-ghost" style="text-align:left;padding:11px 14px;font-size:14px" onclick="event.stopPropagation();goOrderAsAdmin('${r.replace(/'/g,"\\'")}')">${r}</button>`).join('');
          })()}
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:14px;width:100%" onclick="S.adminOrderPicker=false;render()">Cancelar</button>
      </div>
    </div>`:'';

  return `<div class="adm-layout">
    ${sidebar}
    <div class="sb-overlay${S.sidebarOpen?' sb-open':''}" onclick="S.sidebarOpen=false;render()"></div>
    <div class="adm-content">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--pri)">Panel de compras</div>${liveTag}
      </div>
      <div id="tc">${content}</div>
    </div>
  </div>${adminOrderModal}`;
}

function vDashboard(){
  const valid=orders.filter(o=>o.status!=='rejected');
  const pend=orders.filter(o=>o.status==='pending');
  const appr=orders.filter(o=>o.status==='approved');
  const rec=orders.filter(o=>o.status==='received');
  const today=new Date().toISOString().slice(0,10);
  const todayOrders=valid.filter(o=>(o.createdAt||'').startsWith(today));
  const month=new Date().toISOString().slice(0,7);
  const monthSpend=valid.filter(o=>(o.createdAt||'').startsWith(month)).reduce((n,o)=>n+total(o),0);
  const pendingTotal=pend.reduce((n,o)=>n+total(o),0);
  const recent=valid.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);
  const recentRows=recent.map(o=>{
    const sup=suppliers[o.supId]||{name:o.supId||'Proveedor'};
    const status={pending:'Pendiente',approved:'Aprobado',received:'Recibido'}[o.status]||o.status;
    const tab=o.status==='pending'?'pending':(o.status==='approved'?'approved':'received');
    return `<button class="db-row" onclick="setTabSb('${tab}')">
      <span><b>${escHtml(o.restaurant||'Sin local')}</b><small>${escHtml(sup.name||'')}</small></span>
      <span>${fmtD(o.createdAt)}</span><span class="db-status ${o.status}">${status}</span><strong>${fmt(total(o))}</strong>
    </button>`;
  }).join('');
  const alerts=[];
  if(pend.length) alerts.push(`<button onclick="setTabSb('pending')"><b>${pend.length} pedidos pendientes</b><span>${fmt(pendingTotal)} por revisar</span></button>`);
  const urgent=pend.filter(o=>o.urgent);
  if(urgent.length) alerts.push(`<button onclick="setTabSb('pending')"><b>${urgent.length} pedidos urgentes</b><span>Revisión prioritaria</span></button>`);
  if(!alerts.length) alerts.push(`<div class="db-clear"><b>Todo al día</b><span>No hay pedidos pendientes.</span></div>`);
  return `<div class="db-page">
    <header class="db-head"><span>Panel de compras</span><h1>Resumen general</h1><p>Actividad y pedidos del grupo.</p></header>
    <section class="db-kpis">
      <button onclick="setTabSb('pending')"><small>Pendientes</small><strong>${pend.length}</strong><span>${fmt(pendingTotal)}</span></button>
      <button onclick="setTabSb('approved')"><small>Aprobados</small><strong>${appr.length}</strong><span>Por enviar o recibir</span></button>
      <button onclick="setTabSb('received')"><small>Recibidos</small><strong>${rec.length}</strong><span>Histórico confirmado</span></button>
      <article><small>Gasto del mes</small><strong>${fmt(monthSpend)}</strong><span>${todayOrders.length} pedidos hoy</span></article>
    </section>
    <section class="db-grid">
      <div class="db-panel"><header><h2>Actividad reciente</h2><button onclick="setTabSb('approved')">Ver pedidos</button></header>${recentRows||'<div class="db-empty">Todavía no hay actividad.</div>'}</div>
      <aside class="db-panel"><header><h2>Atención</h2></header><div class="db-alerts">${alerts.join('')}</div><button class="db-new" onclick="S.adminOrderPicker=true;render()">Hacer pedido</button></aside>
    </section>
  </div>`;
}

function orderCard(o,showActions){
  const sup=suppliers[o.supId]||{name:'?',emoji:'?',phone:''};
  const isEditing=S.editOrderId===o.id;
  const editItems=isEditing?S.editItems:(o.items||[]);
  const tot=(editItems||[]).reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
  const bc={pending:'b-p',approved:'b-a',rejected:'b-r',received:'b-recv'}[o.status]||'b-p';
  const bl={pending:'Pendiente',approved:'Aprobado',rejected:'Rechazado',received:'Recibido'}[o.status]||o.status;
  const modTag=o.modifiedByAdmin?` <span class="badge b-f"> Modificado</span>`:'';
  const urgTag=o.urgent?` <span class="badge b-urg">URGENTE</span>`:'';
  const issuesTag=o.receivedIssues?` <span class="badge" style="background:#fef3c7;color:#92400e">Con incidencias</span>`:'';
  const delTag=o.deliveryDate?` <span style="font-size:11px;color:var(--mut);font-weight:600"> Entrega: ${o.deliveryDate}</span>`:'';
  const recvBtn=showActions&&o.status==='approved'?`<button class="btn btn-ghost btn-sm" onclick="markReceived('${o.id}')">Marcar recibido</button>`:'';
  const restRecvBtn=!showActions&&o.status==='approved'&&S.session?`<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="markReceived('${o.id}')">Confirmar recepción</button>`:'';

  let itemsHtml='';
  if(isEditing){
    const supProds=(suppliers[o.supId]?.products||[]).filter(p=>!S.editItems.find(it=>it.id===p.id));
    const prodOpts=supProds.map(p=>`<option value="${p.id}" data-name="${p.name}" data-price="${p.price||0}" data-unit="${p.unit||'UN'}">${p.name} — ${pkgLabel(p)}</option>`).join('');
    itemsHtml=S.editItems.map((it,i)=>`
      <div class="pr" style="align-items:center;flex-wrap:nowrap">
        <span class="pn" style="flex:1">${it.name}</span>
        <div class="qc" style="margin-left:8px">
          <button class="qb" onclick="editItemQty(${i},-1)">−</button>
          <span class="qd" id="eiq-${i}" style="min-width:32px;text-align:center">${it.qty}</span>
          <button class="qb" onclick="editItemQty(${i},1)">+</button>
        </div>
        <span class="pp" id="eip-${i}" style="margin-left:8px">${fmt(it.qty*it.price)}</span>
        <button style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:15px;padding:0 4px;margin-left:4px" onclick="editRemoveItem(${i})" title="Eliminar">✕</button>
      </div>`).join('')
    +(supProds.length?`<div style="display:flex;gap:6px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px dashed var(--brd)">
        <select id="edit-add-prod-${o.id}" style="flex:1;padding:6px 8px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt)">
          <option value="">+ Selecciona producto a añadir...</option>${prodOpts}
        </select>
        <input type="number" id="edit-add-qty-${o.id}" value="1" min="0.1" step="0.1" style="width:60px;padding:6px 8px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;text-align:center"/>
        <button class="btn btn-ok btn-sm" onclick="editAddProduct('${o.id}','${o.supId}')">Añadir</button>
      </div>`:'');
  } else {
    itemsHtml=(o.items||[]).map(it=>`<div class="pr"><span class="pn">${it.name||'?'}</span><span class="pq">${convQtyStr(it.qty,it.unit,it.baseUnit||it.unit,it.conversions)}</span><span class="pp">${fmt((it.qty||0)*(it.price||0))}</span></div>`).join('');
  }
  let acts='';
  if(showActions&&o.status==='pending'){
    if(isEditing){
      acts=`<div style="width:100%">
        <textarea id="approve-note-${o.id}" placeholder="Comentario al aprobar (opcional)..." rows="2" style="width:100%;padding:6px 8px;border:1px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);resize:none;box-sizing:border-box;margin-bottom:6px"></textarea>
        <div class="oc-acts" style="flex-wrap:wrap">
          <button class="btn btn-ok btn-sm" onclick="approveWithEdits('${o.id}')">Aprobar</button>
          <button class="btn btn-ghost btn-sm" onclick="S.editOrderId=null;S.editItems=[];renderAdminContent()">Cancelar</button>
        </div>
      </div>`;
    } else {
      // Mostrar botón Aprobar solo si el rol tiene permiso Y el importe entra
      // en su límite. Si no, mostrar mensaje explicativo.
      const _canAppr=canApproveOrderAmount(total(o));
      const _lim=currentApprovalLimit();
      const _apprBtn=_canAppr
        ?`<button class="btn btn-ok btn-sm" onclick="approve('${o.id}')">Aprobar</button>`
        :`<span style="font-size:12px;color:#dc2626;padding:6px 10px;background:#fee2e2;border-radius:6px">Fuera de tu límite (${_lim===Infinity?'sin límite':fmt(_lim)})</span>`;
      acts=`<div style="width:100%">
        <textarea id="approve-note-${o.id}" placeholder="Comentario al aprobar (opcional)..." rows="2" style="width:100%;padding:6px 8px;border:1px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);resize:none;box-sizing:border-box;margin-bottom:6px"></textarea>
        <div class="oc-acts">
          ${_apprBtn}
          <button class="btn btn-blue btn-sm" onclick="startEditOrder('${o.id}')"> Modificar</button>
          <button class="btn btn-no btn-sm" onclick="rejectWithReason('${o.id}')">Rechazar</button>
        </div>
      </div>`;
    }
  } else if(o.status==='approved'){
    const sentBadge=o.sentToSupplier?`<span class="badge" style="background:#dcfce7;color:#166534;font-weight:700">Enviado ${o.sentAt?fmtD(o.sentAt):''}</span>`:'';
    acts=`<div class="oc-acts" style="align-items:center">
      ${sentBadge}
      <button class="btn ${o.sentToSupplier?'btn-ghost':'btn-wa'} btn-sm" onclick="markSentToSupplier('${o.id}');showWA('${_a(supPhoneFor(sup,o.restaurant))}',msgSupplier(orders.find(x=>x.id==='${o.id}')),'Envía el pedido aprobado al proveedor')">${WA_SVG} ${o.sentToSupplier?'Reenviar':sup.name}</button>
    </div>`;
  }
  const totLabel=isEditing?`<div class="ptot" id="edit-tot">Total: ${fmt(tot)}</div>`:`<div class="ptot">Total: ${fmt(tot)}</div>`;
  const threshold=cfg.alertThreshold||300;
  const isLargeOrder=showActions&&tot>=threshold;
  const largeAlert=isLargeOrder?`<div class="banner red" style="margin:6px 0 2px">Pedido grande — supera ${fmt(threshold)}</div>`:'';
  // Budget warning
  const oUser=cfg.users.find(u=>u.restaurant===o.restaurant);
  const oCreatedAt=o.createdAt||'';
  const bKey=oUser?oUser.id+'_'+oCreatedAt.slice(0,7):null;
  const bLimit=bKey?(budgets[bKey]||0):0;
  const bSpent=bKey?orders.filter(x=>(x.status==='approved'||x.status==='received')&&x.restaurant===o.restaurant&&(x.createdAt||'').startsWith(oCreatedAt.slice(0,7))).reduce((s,x)=>s+total(x),0):0;
  const budgetAlert=bLimit>0&&bSpent>bLimit?`<div class="banner red" style="margin:4px 0 2px"> Presupuesto superado — ${fmt(bSpent)} de ${fmt(bLimit)}</div>`:'';
  const restColor=strToColor(o.restaurant||'');
  return `<div class="oc" ${isEditing?'style="border-color:var(--pri);box-shadow:0 0 0 2px rgba(26,26,46,.15)"':o.urgent?'style="border-color:#dc2626"':''}>
    <div style="background:${restColor};border-radius:10px 10px 0 0;margin:-14px -14px 10px -14px;padding:7px 14px;display:flex;align-items:center;gap:8px">
      <span style="font-size:15px;font-weight:800;color:#fff;letter-spacing:.3px">${o.restaurant}</span>
      ${o.autoApproved?`<span class="badge b-f" style="background:rgba(255,255,255,.25);color:#fff">Auto</span>`:''}
      ${o.urgent?`<span style="background:#fff;color:#dc2626;border-radius:8px;padding:1px 8px;font-size:11px;font-weight:800">URGENTE</span>`:''}
      ${issuesTag}
    </div>
    <div class="oc-hd">
      <div><div class="oc-rest" style="font-size:13px;color:var(--mut);font-weight:600">${sup.name}${modTag}</div>
      <div class="oc-sub">${fmtD(o.createdAt)} · <span class="badge ${bc}">${bl}</span>${delTag}</div></div>
      ${acts}
    </div>
    ${largeAlert}${budgetAlert}
    ${o.approvalNote?`<div style="background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;padding:6px 10px;margin:4px 0 6px;font-size:12px;color:#166534">Admin: ${o.approvalNote}</div>`:''}
    ${o.notes?`<div style="background:var(--bg);border-left:3px solid var(--pri);border-radius:0 6px 6px 0;padding:6px 10px;margin:4px 0 6px;font-size:12px;color:var(--txt)"> <em>${o.notes}</em></div>`:''}
    ${isEditing?`<div class="banner blue" style="margin-bottom:10px"> Modifica las cantidades y pulsa <strong>Aprobar</strong></div>`:''}
    <div class="pl">${itemsHtml}${totLabel}</div>
    ${recvBtn||restRecvBtn}
    ${chatHTML(o)}
  </div>`;
}

function chatHTML(o){
  const msgs = orderComments[o.id]||[];
  const isAdmin = S.session?.isAdmin;
  const author = isAdmin ? (cfg.adminName||'Admin') : (S.session?.name||S.session?.restaurant||'Local');
  const open = S.chatOpen===o.id;
  const unread = msgs.length;
  const badge = unread>0 ? `<span style="background:#e11d48;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:700;margin-left:6px">${unread}</span>` : '';
  if(!open) return `<div style="margin-top:8px"><button class="btn btn-ghost btn-sm" style="font-size:12px" onclick="S.chatOpen='${o.id}';renderAdminContent&&renderAdminContent();render&&(S.view==='order'?render():null)">Chat interno${badge}</button></div>`;
  // Escape SIEMPRE los datos de usuario (m.text, m.author) — proteger de XSS.
  // Un local puede escribir <script> en su mensaje; sin escape se ejecuta en la sesión del admin.
  const msgsHtml = msgs.length ? msgs.map(m=>`
    <div style="display:flex;flex-direction:column;align-items:${m.isAdmin?'flex-end':'flex-start'};margin-bottom:6px">
      <div style="max-width:80%;background:${m.isAdmin?'var(--pri)':'var(--srf)'};color:${m.isAdmin?'#fff':'var(--txt)'};border-radius:${m.isAdmin?'12px 12px 2px 12px':'12px 12px 12px 2px'};padding:7px 12px;font-size:13px">${_e(m.text)}</div>
      <div style="font-size:10px;color:var(--mut);margin-top:2px">${_e(m.author)} · ${m.ts?new Date(m.ts).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}</div>
    </div>`).join('') : `<div style="color:var(--mut);font-size:12px;text-align:center;padding:8px 0">Sin mensajes aún</div>`;
  return `<div style="margin-top:10px;border-top:1px solid var(--brd);padding-top:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:13px;font-weight:600">Chat interno</span>
      <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="S.chatOpen=null;renderAdminContent&&renderAdminContent();render&&(S.view==='order'?render():null)">▲ Cerrar</button>
    </div>
    <div style="max-height:200px;overflow-y:auto;margin-bottom:8px;padding:4px 0">${msgsHtml}</div>
    <div style="display:flex;gap:6px">
      <input id="chat-input-${o.id}" type="text" placeholder="Escribe un mensaje..." style="flex:1;padding:7px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;background:#fff;color:var(--txt)" onkeydown="if(event.key==='Enter')sendOrderChat('${o.id}')"/>
      <button class="btn btn-pri btn-sm" onclick="sendOrderChat('${o.id}')">Enviar</button>
    </div>
  </div>`;
}
// sendOrderChat: NUNCA acepta isAdmin/author del cliente — se DERIVAN del
// rol autenticado. Antes se pasaban como parámetros, lo que permitía
// suplantar la identidad del admin desde consola.
function sendOrderChat(oid){
  if(!requireNotBlocked()) return;
  const inp = document.getElementById('chat-input-'+oid);
  if(!inp) return;
  const text = inp.value.trim(); if(!text) return;
  if(!fbDb){ toast('Sin conexión Firebase','#dc2626'); return; }
  if(!S.session || !S.session.uid){ toast('Sin sesión','#dc2626'); return; }
  const role = currentRole();
  const isAdmin = isAdminRole(role);
  const author = isAdmin ? (cfg.adminName || S.session.name || 'Admin')
                         : (S.session.name || S.session.restaurant || 'Local');
  const msg = {
    id: uid(),
    uid: S.session.uid,   // Firebase Rules validan que === auth.uid
    author,
    isAdmin,
    text,
    ts: Date.now()
  };
  fbDb.ref('orderComments/'+oid+'/'+msg.id).set(msg);
  inp.value = '';
}
function restFilterTabs(ordersForCount, stateKey){
  const allRests=[...new Set(ordersForCount.map(o=>o.restaurant||'').filter(Boolean))].sort();
  if(allRests.length<2) return '';
  const cur=S[stateKey]||null;
  const tabs=[`<button class="stab ${!cur?'act':''}" onclick="S.${stateKey}=null;render()">🏠 Todos (${ordersForCount.length})</button>`,
    ...allRests.map(r=>{const cnt=ordersForCount.filter(o=>o.restaurant===r).length;return`<button class="stab ${cur===r?'act':''}" onclick="S.${stateKey}='${r.replace(/'/g,"\\'")}';render()">${r} (${cnt})</button>`;})
  ].join('');
  return `<div class="sup-tabs" style="margin-bottom:14px;flex-wrap:wrap">${tabs}</div>`;
}

function vPending(){
  const all=orders.filter(o=>o.status==='pending');
  const tabs=restFilterTabs(all,'pendingRestFilter');
  const p=S.pendingRestFilter?all.filter(o=>o.restaurant===S.pendingRestFilter):all;
  return tabs+(p.length?p.map(o=>orderCard(o,true)).join(''):`<div class="empty"><div class="ei"></div><div class="et">Sin pedidos pendientes${S.pendingRestFilter?' en '+S.pendingRestFilter:''}</div></div>`);
}
function vApproved(){
  const all=orders.filter(o=>o.status==='approved');
  const tabs=restFilterTabs(all,'approvedRestFilter');
  const a=S.approvedRestFilter?all.filter(o=>o.restaurant===S.approvedRestFilter):all;
  return tabs+(a.length?a.map(o=>orderCard(o,false)).join(''):`<div class="empty"><div class="ei"></div><div class="et">Sin pedidos aprobados${S.approvedRestFilter?' en '+S.approvedRestFilter:''}</div></div>`);
}

function vConsolidated(){
  const pend=orders.filter(o=>o.status==='pending');
  if(!pend.length) return `<div class="empty"><div class="ei"></div><div class="et">No hay pedidos pendientes</div></div>`;
  const bySup={};
  pend.forEach(o=>{ if(!bySup[o.supId])bySup[o.supId]={}; (o.items||[]).forEach(it=>{ if(!bySup[o.supId][it.id])bySup[o.supId][it.id]={...it,qty:0,rests:[]}; bySup[o.supId][it.id].qty+=it.qty; bySup[o.supId][it.id].rests.push((o.restaurant||'').replace("",'')); }); });
  return Object.entries(bySup).map(([sid,items])=>{
    const sup=suppliers[sid]||{name:sid,emoji:'',phone:''};
    const arr=Object.values(items);
    const tot=arr.reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
    const co={supId:sid,restaurant:`Consolidado`,items:arr,createdAt:new Date().toISOString()};
    const rows=arr.map(it=>`<div class="pr"><span class="pn">${it.name} <small style="color:var(--mut)">(${[...new Set(it.rests)].length}r)</small></span><span class="pq">${it.qty} ${it.unit}</span><span class="pp">${fmt(it.qty*it.price)}</span></div>`).join('');
    return `<div class="cc"><div class="cc-hd"><div class="cc-name">${sup.emoji} ${sup.name}</div>
      <button class="btn btn-wa btn-sm" onclick="markSupplierOrdersSent('${sid}');showWA('${_a(sup.phone||'')}',msgSupplier(${JSON.stringify(co).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}), 'Pedido consolidado')">${WA_SVG} Enviar</button>
    </div><div class="pl">${rows}<div class="ptot">Total: ${fmt(tot)}</div></div></div>`;
  }).join('');
}
