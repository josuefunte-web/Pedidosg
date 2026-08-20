/* ═══════════════ ORDER VIEW ═══════════════ */
function vOrder(){
  const myRests=S.session.restaurants||[S.session.restaurant];
  // Ensure active restaurant is valid
  if(!myRests.includes(S.session.restaurant)) S.session.restaurant=myRests[0];
  const myPending=orders.filter(o=>o.restaurant===S.session.restaurant&&o.status==='pending').length;
  const histBadge=myPending?` <span style="background:var(--acc);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px">${myPending}</span>`:'';
  const adminBanner=S.session.isAdminOrder?`<div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <span style="font-weight:600;color:#92400e">Admin — pedido para <strong>${S.session.restaurant}</strong></span>
    <button class="btn btn-ghost btn-sm" onclick="goAdmin()">← Volver al panel</button>
  </div>`:'';
  const tabsHtml=`<div class="tabs" style="margin-bottom:16px">
    <button class="tab ${S.orderTab==='new'?'act':''}" onclick="S.orderTab='new';render()">Hacer pedido</button>
    <button class="tab ${S.orderTab==='history'?'act':''}" onclick="S.orderTab='history';render()"> Mis pedidos${histBadge}</button>
    <button class="tab ${S.orderTab==='gastos'?'act':''}" onclick="S.orderTab='gastos';render()">Mi gasto</button>
    <button class="tab ${S.orderTab==='escandallos'?'act':''}" onclick="S.orderTab='escandallos';render()">Escandallos</button>
    <button class="tab ${S.orderTab==='inventario'?'act':''}" onclick="S.orderTab='inventario';render()">Inventario</button>
  </div>`;
  const restPickerHtml=myRests.length>1?`<div class="rest-picker">
    <div class="rest-picker-lbl">Pedido para</div>
    ${myRests.map(r=>`<button class="stab ${S.session.restaurant===r?'act':''}" onclick="setActiveRestaurant('${r.replace(/'/g,"\\'")}')">${r}</button>`).join('')}
  </div>`:'';

  if(S.orderTab==='history'){
    return `<div class="main">${adminBanner}${tabsHtml}${myRests.length>1?restPickerHtml:''}${vMyOrders()}</div>`;
  }
  if(S.orderTab==='gastos'){
    return `<div class="main">${adminBanner}${tabsHtml}${myRests.length>1?restPickerHtml:''}${vLocalGastos()}</div>`;
  }
  if(S.orderTab==='escandallos'){
    if(!_escInit&&fbDb) initEscandallos();
    return `<div class="main">${adminBanner}${tabsHtml}${myRests.length>1?restPickerHtml:''}${vLocalEscandallos()}</div>`;
  }
  if(S.orderTab==='inventario'){
    return `<div class="main">${adminBanner}${tabsHtml}${myRests.length>1?restPickerHtml:''}${vLocalInventario(S.session.restaurant)}</div>`;
  }

  const sups=visibleSups();
  if(!sups.length){
    // Distinguir "todavía no ha llegado nada de Firebase" (conexión lenta) de
    // "el admin ha desactivado todos los proveedores para este local" — mostrar
    // solo el segundo mensaje como definitivo evita que una conexión lenta se
    // vea igual que un local sin proveedores configurados.
    const stillLoading=Object.keys(suppliers).length===0;
    return `<div class="main">${adminBanner}${tabsHtml}<div class="empty"><div class="ei">${stillLoading?'⏳':''}</div><div class="et">${stillLoading?'Cargando proveedores…':'No hay proveedores activos para este local.'}</div>${stillLoading?'<div style="font-size:12px;color:var(--mut);margin-top:6px">Si tarda mucho, comprueba tu conexión a internet.</div>':''}</div></div>`;
  }
  if(!suppliers[S.supId]||!(sups.find(s=>s.id===S.supId))) S.supId=sups[0].id;
  const sup=suppliers[S.supId];
  const cnt=Object.values(S.cart).reduce((s,sc2)=>s+Object.values(sc2).reduce((a,v)=>a+v,0),0);
  const tot=Object.entries(S.cart).reduce((s,[sid,sc2])=>{const sp=suppliers[sid];if(!sp)return s;return s+(sp.products||[]).reduce((a,p)=>a+(sc2[p.id]||0)*p.price,0);},0);
  const supCnt=Object.keys(S.cart).length;
  const _approvalMin=cfg.approvalMinAmount||0;
  const note=S.session.needsApproval
    ?(_approvalMin>0
      ?`<div class="banner"> Pedidos <strong>por encima de ${fmt(_approvalMin)}</strong> irán a <strong>${cfg.adminName}</strong> para aprobación. Los pedidos menores se aprueban automáticamente.</div>`
      :`<div class="banner"> Tu pedido irá a <strong>${cfg.adminName}</strong> para aprobación antes de enviarse al proveedor.</div>`)
    :`<div class="banner blue">Tus pedidos se aprueban automáticamente y van directo al proveedor.</div>`;
  const _vacUser=cfg.users.find(u=>u.restaurant===S.session.restaurant);
  const vacBanner=_vacUser&&_vacUser.vacaciones?'<div class="banner" style="background:#fef3c7;border-color:#f59e0b;color:#92400e">Modo vacaciones activo — los pedidos están desactivados temporalmente</div>':'';
  const stabs=`<select onchange="setSup(this.value)" style="max-width:320px;font-weight:600;cursor:pointer">${sups.map(s=>{const sc2=S.cart[s.id]||{};const n=Object.values(sc2).reduce((a,v)=>a+v,0);return `<option value="${s.id}" ${S.supId===s.id?'selected':''}>${s.emoji} ${s.name}${n>0?` — ${n} en el carrito`:''}</option>`;}).join('')}</select>`;
  const searchTerm=(S.prodSearch||'').toLowerCase().trim();
  const filteredProds=sup.products.filter(p=>!searchTerm||p.name.toLowerCase().includes(searchTerm));
  const _UNITS=['KG','L','UN','Caja'];
  function mkProdCard(p){
    const q=(S.cart[S.supId]||{})[p.id]||0;
    const selUnit=(S.cartUnits[S.supId]||{})[p.id]||p.unit;
    const unitBtns=_UNITS.map(u=>`<button class="ubt${selUnit===u?' ubt-on':''}" onclick="setUnit('${p.id}','${u}');event.stopPropagation()">${u}</button>`).join('');
    return `<div class="pi ${q>0?'ic':''}" id="pi-${p.id}">
      <div class="pi-i"><div class="pi-n">${p.name}</div><div class="pi-p">${pkgLabel(p)}</div></div>
      <div class="qc">
        <button class="qb" onclick="chgQ('${p.id}',-1)">−</button>
        <div class="qd" id="qd-${p.id}">${q}</div>
        <button class="qb" onclick="chgQ('${p.id}',1)">+</button>
      </div>
      ${q>0?`<div class="urow" id="ur-${p.id}">${unitBtns}</div>`:`<div class="urow" id="ur-${p.id}" style="display:none">${unitBtns}</div>`}
    </div>`;
  }
  // Agrupar por categoría (solo si no hay búsqueda activa)
  let prods='';
  if(searchTerm){
    prods=`<div class="pgrid">${filteredProds.map(mkProdCard).join('')}</div>`;
  } else {
    const byCat={};
    filteredProds.forEach(p=>{ const c=p.category||'Otros'; if(!byCat[c])byCat[c]=[]; byCat[c].push(p); });
    const catOrder=[...PROD_CATS,...Object.keys(byCat).filter(c=>!PROD_CATS.includes(c))].filter(c=>byCat[c]);
    if(catOrder.length<=1){
      prods=`<div class="pgrid">${filteredProds.map(mkProdCard).join('')}</div>`;
    } else {
      prods=catOrder.map(cat=>`
        <div style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:5px 2px 6px;border-bottom:2px solid ${catColor(cat)}40;margin-bottom:8px;display:flex;align-items:center;gap:5px;color:${catColor(cat)}">${catDot(cat)} ${cat}</div>
          <div class="pgrid">${byCat[cat].map(mkProdCard).join('')}</div>
        </div>`).join('');
    }
  }
  const myTpls=Object.values(templates[S.session.userId]||{}).filter(t=>t.supId===S.supId);
  // Auto-suggest: most ordered products for this restaurant+supplier
  const myHistory=orders.filter(o=>o.restaurant===S.session.restaurant&&o.supId===S.supId&&o.status!=='rejected');
  const autoSuggest={};
  myHistory.forEach(o=>(o.items||[]).forEach(it=>{if(!autoSuggest[it.id])autoSuggest[it.id]={...it,count:0,totalQty:0};autoSuggest[it.id].count++;autoSuggest[it.id].totalQty+=it.qty;}));
  const topProds=Object.values(autoSuggest).sort((a,b)=>b.count-a.count).slice(0,5);
  const autoBtn=topProds.length&&!Object.keys(S.cart[S.supId]||{}).length?`<button class="btn btn-blue btn-sm" onclick="loadAutoSuggest()" style="white-space:nowrap">Pedido típico</button>`:'';
  // Recurring templates
  const _today=new Date();
  const _todayWD=_today.getDay();
  const _todayDOM=_today.getDate();
  const _todayKey=_today.toISOString().split('T')[0];
  const _myTplsAll=Object.values(templates[S.session.userId]||{});
  const _recurringDue=_myTplsAll.filter(t=>{
    if(!t.recurrence||t.recurrence.type==='none') return false;
    if(t.lastAutoDate===_todayKey) return false;
    if(t.recurrence.type==='weekly') return _todayWD===t.recurrence.weekday;
    if(t.recurrence.type==='monthly') return _todayDOM===t.recurrence.dayOfMonth;
    return false;
  });
  const recurringBanner=_recurringDue.length?`<div class="banner blue" style="margin-bottom:10px">
    <strong>Pedidos recurrentes pendientes:</strong>
    ${_recurringDue.map(t=>`<div style="margin-top:6px;display:flex;align-items:center;gap:8px">
      <span>${t.name} (${(suppliers[t.supId]||{name:t.supId}).name})</span>
      <button class="btn btn-blue btn-sm" onclick="loadRecurringTpl('${t.id}')">Cargar</button>
    </div>`).join('')}
  </div>`:'';
  const tplSection=`<div class="sh" style="margin-top:4px">Plantillas</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${autoBtn}
      ${myTpls.map(t=>`<div style="display:flex;gap:2px"><button class="btn btn-ghost btn-sm" onclick="loadTemplate('${t.id}')" style="border-radius:6px 0 0 6px">📥 ${t.name}</button><button class="btn btn-no btn-sm" onclick="deleteTpl('${t.id}')" style="border-radius:0 6px 6px 0;padding:0 8px">✕</button></div>`).join('')}
      ${Object.keys(S.cart[S.supId]||{}).length>0?`<button class="btn btn-ghost btn-sm" onclick="S.showSaveTemplate=!S.showSaveTemplate;render()">Guardar</button>`:''}
    </div>
    ${S.showSaveTemplate?`<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
      <div style="display:flex;gap:6px"><input type="text" id="tpl-name" placeholder="Nombre de la plantilla..." style="flex:1;padding:6px 10px;border:1px solid var(--brd);border-radius:6px;font-size:13px"/></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="tpl-recur" style="padding:6px;border:1px solid var(--brd);border-radius:6px;font-size:13px;background:var(--card);color:var(--txt)">
          <option value="none">Sin repetición</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensual</option>
        </select>
        <select id="tpl-recur-day" style="padding:6px;border:1px solid var(--brd);border-radius:6px;font-size:13px;background:var(--card);color:var(--txt)">
          <option value="1">Lunes</option><option value="2">Martes</option><option value="3">Miércoles</option>
          <option value="4">Jueves</option><option value="5">Viernes</option><option value="6">Sábado</option><option value="0">Domingo</option>
          ${Array.from({length:28},(_,i)=>`<option value="d${i+1}">${i+1} de cada mes</option>`).join('')}
        </select>
        <button class="btn btn-pri btn-sm" onclick="saveTpl()">Guardar</button>
      </div>
    </div>`:''}`;
  return `<div class="main">
    ${adminBanner}${tabsHtml}${restPickerHtml}${note}
    ${vacBanner}
    ${recurringBanner}
    ${tplSection}
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 0 6px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;border-radius:10px;border:2px solid ${S.orderUrgent?'#dc2626':'var(--brd)'};background:${S.orderUrgent?'#fff1f2':'var(--card)'};transition:.2s">
        <input type="checkbox" id="ord-urg" ${S.orderUrgent?'checked':''} onchange="S.orderUrgent=this.checked;render()" style="width:16px;height:16px;accent-color:#dc2626">
        <span style="font-weight:700;font-size:13px;color:${S.orderUrgent?'#dc2626':'var(--txt)'}">Urgente</span>
      </label>
      <div style="flex:1;min-width:160px">
        <label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Entrega deseada</label>
        <input type="date" value="${S.orderDeliveryDate||''}" onchange="S.orderDeliveryDate=this.value" style="padding:7px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;width:100%;background:var(--card);color:var(--txt)">
      </div>
    </div>
    <div class="sh">Proveedor</div>
    <div class="sup-tabs">${stabs}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div class="sh" style="margin:0;flex:1">Productos — ${sup.emoji} ${sup.name}</div>
      <input type="text" id="prod-search-inp" placeholder="Buscar producto..." value="${S.prodSearch||''}" oninput="filterProds(this.value)" style="padding:6px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:12px;width:180px;background:var(--card);color:var(--txt)">
    </div>
    <div id="prod-grid-wrap">${filteredProds.length?prods:`<div class="empty"><div class="ei"></div><div class="et">Sin resultados para "${S.prodSearch}"</div></div>`}</div>
    <div style="margin-top:10px">
      <button class="btn btn-ghost btn-sm" onclick="S.showAddProd=!S.showAddProd;render()" style="width:100%;justify-content:center">
        ${S.showAddProd?'✕ Cancelar':'Añadir producto que falta'}
      </button>
      ${S.showAddProd?`<div style="background:var(--srf);border:1.5px solid var(--brd);border-radius:10px;padding:14px;margin-top:8px">
        <div style="font-size:12px;font-weight:600;color:var(--mut);margin-bottom:10px">Nuevo producto para ${sup.emoji} ${sup.name}</div>
        <div style="display:grid;grid-template-columns:1fr 80px 90px;gap:8px;margin-bottom:10px">
          <div><label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Nombre</label>
            <input type="text" id="lp-name" placeholder="Ej: Lomo ibérico" style="width:100%;padding:7px 10px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/></div>
          <div><label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Unidad</label>
            <select id="lp-unit" style="width:100%;padding:7px 6px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt)">
              <option>KG</option><option>UN</option><option>L</option><option>Caja</option><option>Bote</option><option>Bolsa</option>
            </select></div>
          <div><label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Precio €</label>
            <input type="number" id="lp-price" placeholder="0.00" step="0.01" min="0" style="width:100%;padding:7px 8px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/></div>
        </div>
        <button class="btn btn-ok btn-sm" onclick="localAddProd('${S.supId}')">✓ Añadir producto</button>
      </div>`:''}
    </div>
    <div style="margin-top:12px">
      <label style="font-size:11px;color:var(--mut);display:block;margin-bottom:4px"> Anotación / Nota para el pedido (opcional)</label>
      <textarea id="order-notes" placeholder="Ej: Traer antes de las 10h, sin el producto X esta semana..." rows="2" style="width:100%;padding:8px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt);resize:vertical;box-sizing:border-box" oninput="S.orderNotes=this.value">${S.orderNotes||''}</textarea>
    </div>
  </div>
  <div class="cbar ${cnt>0?'up':''}" id="cbar">
    <div><div class="cb-v" id="cb-v">${cnt} art.${supCnt>1?` · ${supCnt} prov.`:''}</div><div class="cb-s" id="cb-s">${fmt(tot)}</div></div>
    <button class="btn btn-acc" onclick="submitOrder()">Enviar${supCnt>1?` (${supCnt} pedidos)`:' pedido'}</button>
  </div>`;
}

function vMyOrders(){
  const myRests=S.session.restaurants||[S.session.restaurant];
  // When filtering history: show orders for the active restaurant (if picker used) or all allowed restaurants
  const filterRest=myRests.length>1?S.session.restaurant:S.session.restaurant;
  const mine=orders.filter(o=>o.restaurant===filterRest)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(!mine.length) return `<div class="empty"><div class="ei"></div><div class="et">Aún no has hecho ningún pedido</div></div>`;
  return mine.map(o=>{
    const sup=suppliers[o.supId]||{name:'?',emoji:'?'};
    const tot=total(o);
    const sMap={
      pending: {cls:'b-p', lbl:' Pendiente de aprobación'},
      approved:{cls:'b-a', lbl:'Aprobado'},
      rejected:{cls:'b-r', lbl:'✗ Rechazado'},
      received:{cls:'b-recv',lbl:' Recibido'}
    };
    const s=sMap[o.status]||{cls:'b-p',lbl:o.status};
    const modTag=o.modifiedByAdmin?`<span class="badge b-f" style="margin-left:6px"> Modificado</span>`:'';
    const urgTag=o.urgent?`<span class="badge b-urg" style="margin-left:6px">URGENTE</span>`:'';
    const delTag=o.deliveryDate?`<span style="font-size:11px;color:var(--mut);margin-left:6px"> Entrega: ${o.deliveryDate}</span>`:'';
    const rows=(o.items||[]).map(it=>`<div class="pr"><span class="pn">${it.name||'?'}</span><span class="pq">${convQtyStr(it.qty,it.unit,it.baseUnit||it.unit,it.conversions)}</span><span class="pp">${fmt((it.qty||0)*(it.price||0))}</span></div>`).join('');
    const rejNote=o.status==='rejected'&&o.rejectReason?`<div class="banner red" style="margin-top:8px">${o.rejectReason}</div>`:'';
    const recvBtn=o.status==='approved'?`<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="markReceived('${o.id}')">Confirmar recepción</button>`:'';
    return `<div class="oc" ${o.urgent?'style="border-color:#dc2626"':''}>
      <div class="oc-hd">
        <div>
          <div class="oc-rest">${sup.emoji} ${sup.name}${modTag}${urgTag}</div>
          <div class="oc-sub">${fmtD(o.createdAt||'')} · <span class="badge ${s.cls}">${s.lbl}</span>${delTag}</div>
        </div>
      </div>
      <div class="pl">${rows}<div class="ptot">Total: ${fmt(tot)}</div></div>
      ${rejNote}${recvBtn}
    </div>`;
  }).join('');
}
