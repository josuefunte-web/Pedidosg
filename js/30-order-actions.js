/* ═══════════════ ORDER ACTIONS ═══════════════ */
function setSup(id){ S.supId=id;S.prodSearch='';render(); }

function setUnit(pid,unit){
  const sup=suppliers[S.supId];if(!sup)return;
  const prod=(sup.products||[]).find(p=>p.id===pid);
  if(!prod) return;
  const baseUnit=prod.unit||'KG';
  // Si la unidad seleccionada no es la base y NO hay conversión definida para
  // ella, obligar al usuario a introducirla ahora (queda pendiente de que el
  // admin valide el factor). Sin esto, el precio del pedido saldría mal.
  if(unit!==baseUnit){
    const conv=(prod.conversions||[]).find(c=>c.fromUnit===unit&&parseFloat(c.factor)>0);
    if(!conv){
      promptMissingConversion(S.supId,pid,unit,()=>{
        // Cuando termine el modal (guardado o cancelado), reaplicar setUnit
        // solo si ahora sí existe la conversión.
        const updatedProd=(suppliers[S.supId]?.products||[]).find(p=>p.id===pid);
        const nowConv=(updatedProd?.conversions||[]).find(c=>c.fromUnit===unit&&parseFloat(c.factor)>0);
        if(nowConv) _applySetUnit(pid,unit);
      });
      return;
    }
  }
  _applySetUnit(pid,unit);
}
function _applySetUnit(pid,unit){
  if(!S.cartUnits[S.supId])S.cartUnits[S.supId]={};
  S.cartUnits[S.supId][pid]=unit;
  const sup=suppliers[S.supId];if(!sup)return;
  const prodUnits=ORDER_UNITS;
  const el=document.getElementById('ur-'+pid);
  if(el) el.innerHTML=prodUnits.map(u=>`<button class="ubt${unit===u?' ubt-on':''}" onclick="setUnit('${pid}','${u}');event.stopPropagation()">${u}</button>`).join('');
  // Recalcular la barra del carrito con la nueva unidad (mismo cálculo que chgQ)
  const cnt=Object.values(S.cart).reduce((s,sc2)=>s+Object.values(sc2).reduce((a,v)=>a+v,0),0);
  const tot=Object.entries(S.cart).reduce((s,[sid,sc2])=>{const sp=suppliers[sid];if(!sp)return s;return s+(sp.products||[]).reduce((a,p)=>{const q=sc2[p.id]||0;if(!q)return a;const selUnit=(S.cartUnits[sid]||{})[p.id]||p.unit;return a+q*effectivePrice(p,selUnit);},0);},0);
  const bar=document.getElementById('cbar');if(bar)bar.className='cbar'+(cnt>0?' up':'');
  const cv=document.getElementById('cb-v');if(cv)cv.textContent=`${cnt} art. · ${Object.keys(S.cart).length} prov.`;
  const cs=document.getElementById('cb-s');if(cs)cs.textContent=fmt(tot);
}

// Modal para pedir al usuario el factor de conversión de una unidad no
// registrada. La conversión se guarda con pendingValidation:true para que el
// admin luego la revise (aparece en Admin → Proveedores → sección "Conversiones
// pendientes de validar").
function promptMissingConversion(sid,pid,unit,onClose){
  const sup=suppliers[sid]; if(!sup){ if(onClose)onClose(); return; }
  const prod=(sup.products||[]).find(p=>p.id===pid); if(!prod){ if(onClose)onClose(); return; }
  const base=prod.unit||'KG';
  const ov=document.createElement('div');
  ov.id='conv-prompt-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1600;display:flex;align-items:center;justify-content:center;padding:14px';
  ov.innerHTML=`<div style="background:var(--card);border-radius:14px;padding:22px;max-width:420px;width:100%">
    <div style="font-weight:700;font-size:16px;margin-bottom:6px">Falta la conversión de unidad</div>
    <div style="font-size:13px;color:var(--mut);margin-bottom:14px">El precio de <strong>${prod.name}</strong> está registrado en <strong>${base}</strong>. Para pedir en <strong>${unit}</strong> necesitamos saber la equivalencia. El admin la revisará después.</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:14px">1 ${unit} =</span>
      <input type="number" id="cv-factor-inp" step="0.001" min="0" placeholder="ej: 15" style="flex:1;padding:8px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:15px;background:var(--card);color:var(--txt)"/>
      <span style="font-size:14px;color:var(--mut)">${base}</span>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ok btn-sm" onclick="_saveMissingConv('${sid}','${pid}','${unit}')" style="flex:1">Guardar y continuar</button>
      <button class="btn btn-ghost btn-sm" onclick="_closeMissingConv()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  window._missingConvOnClose=onClose;
  setTimeout(()=>document.getElementById('cv-factor-inp')?.focus(),80);
}
function _closeMissingConv(){
  const ov=document.getElementById('conv-prompt-ov'); if(ov) ov.remove();
  const cb=window._missingConvOnClose; window._missingConvOnClose=null;
  if(cb) try{cb();}catch(e){}
}
function _saveMissingConv(sid,pid,unit){
  const val=parseFloat(document.getElementById('cv-factor-inp')?.value);
  if(isNaN(val)||val<=0){ toast('Introduce un valor válido (>0)','#dc2626'); return; }
  const prod=suppliers[sid]?.products.find(p=>p.id===pid);
  if(!prod){ _closeMissingConv(); return; }
  if(!prod.conversions) prod.conversions=[];
  const idx=prod.conversions.findIndex(c=>c.fromUnit===unit);
  const entry={fromUnit:unit,factor:val,pendingValidation:true,addedBy:S.session?.name||S.session?.restaurant||'Local',addedAt:new Date().toISOString()};
  if(idx>=0) prod.conversions[idx]={...prod.conversions[idx],...entry};
  else prod.conversions.push(entry);
  saveSups(sid);
  toast('Conversión guardada — pendiente de validación por el admin','#0369a1',4000);
  _closeMissingConv();
}

function filterProds(val){
  S.prodSearch=val||'';
  const sup=suppliers[S.supId];if(!sup)return;
  const term=(val||'').toLowerCase().trim();
  const filtered=sup.products.filter(p=>!term||p.name.toLowerCase().includes(term));
  function mkCard(p){
    const q=(S.cart[S.supId]||{})[p.id]||0;
    const selUnit=(S.cartUnits[S.supId]||{})[p.id]||p.unit;
    const unitBtns=ORDER_UNITS.map(u=>`<button class="ubt${selUnit===u?' ubt-on':''}" onclick="setUnit('${p.id}','${u}');event.stopPropagation()">${u}</button>`).join('');
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
  let html='';
  if(term){
    html=filtered.length?`<div class="pgrid">${filtered.map(mkCard).join('')}</div>`:`<div class="empty"><div class="ei"></div><div class="et">Sin resultados para "${val}"</div></div>`;
  } else {
    const byCat={};
    filtered.forEach(p=>{ const c=p.category||'Otros'; if(!byCat[c])byCat[c]=[]; byCat[c].push(p); });
    const cats=[...PROD_CATS,...Object.keys(byCat).filter(c=>!PROD_CATS.includes(c))].filter(c=>byCat[c]);
    html=cats.length<=1
      ?`<div class="pgrid">${filtered.map(mkCard).join('')}</div>`
      :cats.map(cat=>`<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--mut);padding:6px 2px 6px;border-bottom:1px solid var(--brd);margin-bottom:8px">${cat}</div><div class="pgrid">${byCat[cat].map(mkCard).join('')}</div></div>`).join('');
  }
  const wrap=document.getElementById('prod-grid-wrap');
  if(wrap) wrap.innerHTML=html;
}

function chgQ(id,d){
  // Bloqueo de seguridad — un rol sin permiso para crear pedidos NO puede
  // modificar el carrito. Se protege aquí por si algún elemento residual del
  // UI acaba llamándolo (por ej. cache antigua del navegador).
  if(!can('canCreateOrders')){ toast('No tienes permiso para hacer pedidos','#dc2626'); return; }
  if(!S.cart[S.supId])S.cart[S.supId]={};
  const sc=S.cart[S.supId];
  const q=sc[id]||0,nq=Math.max(0,q+d);
  if(nq===0)delete sc[id];else sc[id]=nq;
  if(Object.keys(sc).length===0)delete S.cart[S.supId];
  const el=document.getElementById('qd-'+id);if(el)el.textContent=nq;
  const pi=document.getElementById('pi-'+id);if(pi)pi.className='pi'+(nq>0?' ic':'');
  // Mostrar/ocultar fila de unidades
  const ur=document.getElementById('ur-'+id);
  if(ur){
    if(nq>0){
      ur.style.display='flex';
      if(!ur.innerHTML.trim()){
        const sup=suppliers[S.supId];
        const prod=sup&&sup.products.find(p=>p.id===id);
        const selUnit=(S.cartUnits[S.supId]||{})[id]||(prod&&prod.unit)||'UN';
        ur.innerHTML=ORDER_UNITS.map(u=>`<button class="ubt${selUnit===u?' ubt-on':''}" onclick="setUnit('${id}','${u}');event.stopPropagation()">${u}</button>`).join('');
      }
    } else { ur.style.display='none'; }
  }
  // Grand total across all suppliers
  const cnt=Object.values(S.cart).reduce((s,sc2)=>s+Object.values(sc2).reduce((a,v)=>a+v,0),0);
  const tot=Object.entries(S.cart).reduce((s,[sid,sc2])=>{const sp=suppliers[sid];if(!sp)return s;return s+(sp.products||[]).reduce((a,p)=>{const q=sc2[p.id]||0;if(!q)return a;const selUnit=(S.cartUnits[sid]||{})[p.id]||p.unit;return a+q*effectivePrice(p,selUnit);},0);},0);
  const bar=document.getElementById('cbar');if(bar)bar.className='cbar'+(cnt>0?' up':'');
  const cv=document.getElementById('cb-v');if(cv)cv.textContent=`${cnt} art. · ${Object.keys(S.cart).length} prov.`;
  const cs=document.getElementById('cb-s');if(cs)cs.textContent=fmt(tot);
}

function submitOrder(){
  if(!S.session){toast('Sin sesión','#dc2626');return;}
  if(!requireNotBlocked()) return;
  if(!requireCan('canCreateOrders')) return;
  // El restaurant activo debe ser uno de los asignados al usuario.
  // (Doble red: Firebase Rules ya lo rechazan, pero fallamos rápido aquí.)
  const allowedRests = (S.session.restaurants && S.session.restaurants.length) ? S.session.restaurants : [S.session.restaurant];
  // Los administradores con acceso al panel pueden crear pedidos para cualquier
  // local mediante "Hacer pedido". Para usuarios normales se mantiene la
  // comprobación estricta contra sus restaurantes asignados.
  if(!hasAdminAccess() && !allowedRests.includes(S.session.restaurant)){
    toast('Restaurante no autorizado en tu sesión','#dc2626'); return;
  }
  const activeSups=Object.keys(S.cart).filter(sid=>Object.keys(S.cart[sid]||{}).length>0);
  if(!activeSups.length){toast('Añade productos al pedido','#dc2626');return;}
  const approvalMinAmount=cfg.approvalMinAmount||0;
  const orders2send=[];
  activeSups.forEach(sid=>{
    const sup=suppliers[sid];if(!sup)return;
    const sc=S.cart[sid]||{};
    const _lsProds=(()=>{try{return(JSON.parse(localStorage.getItem('oc_suppliers')||'{}')[sid]?.products)||[];}catch(e){return[];}})();
    const _prodMap={};
    _lsProds.forEach(p=>{if(p&&p.id)_prodMap[p.id]=p;});
    Object.values(S._cartProds[sid]||{}).forEach(p=>{if(p&&p.id)_prodMap[p.id]=p;});
    (sup.products||[]).forEach(p=>{if(p&&p.id)_prodMap[p.id]=p;});
    const items=Object.keys(sc).filter(pid=>sc[pid]>0).map(pid=>{
      const p=_prodMap[pid];if(!p)return null;
      const selUnit=(S.cartUnits[sid]&&S.cartUnits[sid][pid])||p.unit;
      const effPrice=effectivePrice(p,selUnit);
      return{...p,qty:sc[pid],unit:selUnit,baseUnit:p.unit,price:effPrice,basePrice:parseFloat(p.price)||0};
    }).filter(Boolean);
    if(!items.length)return;
    const orderTotal=items.reduce((s,p)=>s+p.qty*p.price,0);
    let needApproval=S.session.needsApproval&&(approvalMinAmount<=0||orderTotal>=approvalMinAmount);
    // Un rol con permiso de aprobación (admin3+) NO puede auto-aprobarse
    // pedidos que superen su propio límite económico. En ese caso, aunque
    // tenga needsApproval:false, el pedido va a pending para que un admin
    // superior (admin2/admin1) lo apruebe.
    // Esto cierra el hueco: sin esto, un admin3 con auto-aprobado se saltaría
    // el límite de aprobación al hacer sus propios pedidos.
    if(!needApproval && can('canApproveOrders') && !canApproveOrderAmount(orderTotal)){
      needApproval = true;
    }
    // `total` PERSISTIDO — imprescindible para que Firebase Rules validen
    // el límite económico de admin3 (newData.child('total').val() <= limit).
    // Trazabilidad: createdBy/Email para auditoría desde Firebase.
    const o={
      id:uid(),
      restaurant:S.session.restaurant,
      supId:sid,
      items,
      total:parseFloat(orderTotal.toFixed(2)),
      status:needApproval?'pending':'approved',
      autoApproved:!needApproval,
      createdBy:currentAuthUid(),
      createdByEmail:currentAuthEmail(),
      createdAt:new Date().toISOString(),
      urgent:S.orderUrgent||false,
      deliveryDate:S.orderDeliveryDate||null,
      notes:S.orderNotes||''
    };
    saveOrder(o);
    try{ auditLog('order.create',{orderId:o.id,restaurant:o.restaurant,total:o.total,supId:o.supId,autoApproved:!needApproval}); }catch(e){}
    orders2send.push(o);
  });
  if(!orders2send.length){toast('Añade productos al pedido','#dc2626');return;}
  S.cart={};S.cartUnits={};S._cartProds={};S.orderUrgent=false;S.orderDeliveryDate='';S.prodSearch='';S.orderNotes='';
  const pendingOrders=orders2send.filter(o=>o.status==='pending');
  const autoOrders=orders2send.filter(o=>o.status==='approved');
  if(pendingOrders.length){
    // Show WA for admin with summary of pending orders
    const totalAmt=pendingOrders.reduce((s,o)=>s+total(o),0);
    const restName=(pendingOrders[0].restaurant||'').toUpperCase();
    const msgMulti=` *NUEVO PEDIDO*\n━━━━━━━━━━━━━━━━━━\n*LOCAL: ${restName}*\n━━━━━━━━━━━━━━━━━━\n${pendingOrders.map(o=>`• ${(suppliers[o.supId]||{name:o.supId}).name}: ${fmt(total(o))}${o.urgent?' ':''}`).join('\n')}\n *Total: ${fmt(totalAmt)}*\n\n_Entra en la app para aprobar_`;
    showWA(cfg.adminPhone||'',msgMulti,`${pendingOrders.length} pedido(s) de ${pendingOrders[0].restaurant} — apruébalos`);
    // Notificación push al móvil del admin
    const urgent=pendingOrders.some(o=>o.urgent);
    const ntfyLines=pendingOrders.map(o=>`• ${(suppliers[o.supId]||{name:o.supId}).name}: ${fmt(total(o))}${o.urgent?' URGENTE':''}`).join('\n');
    sendNtfy(
      `${urgent?'URGENTE — ':''}Nuevo pedido de ${pendingOrders[0].restaurant}`,
      `${ntfyLines}\n Total: ${fmt(totalAmt)}`,
      {priority:urgent?'urgent':'high', tags:urgent?'rotating_light':'shopping_cart', urgent}
    );
    toast(`${pendingOrders.length} pedido(s) enviado(s) para aprobación`,'#d97706');
  }
  if(autoOrders.length){
    // Auto-approved: one WA per supplier
    autoOrders.forEach(o=>{
      const sup=suppliers[o.supId];const _ph=supPhoneFor(sup,o.restaurant);if(_ph)showWA(_ph,msgSupplier(o),`Pedido aprobado — envíalo a ${sup.name}`);
    });
    // Notificación push también para auto-aprobados
    const totalAuto=autoOrders.reduce((s,o)=>s+total(o),0);
    sendNtfy(
      `Pedido auto-aprobado — ${autoOrders[0].restaurant}`,
      autoOrders.map(o=>`• ${(suppliers[o.supId]||{name:o.supId}).name}: ${fmt(total(o))}`).join('\n')+`\n Total: ${fmt(totalAuto)}`,
      {priority:'default', tags:'white_check_mark'}
    );
    toast(`${autoOrders.length} pedido(s) aprobado(s) automáticamente — envía a cada proveedor`,'#16a34a');
  }
  render();
}

function approve(id){
  if(!requireNotBlocked()) return;
  const noteEl=document.getElementById('approve-note-'+id);
  const approvalNote=noteEl?noteEl.value.trim():'';
  const o=orders.find(x=>x.id===id);
  // Verificar rol + límite económico
  if(o && !canApproveOrderAmount(total(o))){
    const lim=currentApprovalLimit();
    toast(`No puedes aprobar este pedido (${fmt(total(o))}). Tu límite es ${lim===Infinity?'sin límite':fmt(lim)}.`,'#dc2626',5000);
    return;
  }
  // IMPORTANTE: NO tocar el campo `total` en el update. Las Firebase Rules
  // exigen `newData.child('total').val() === data.child('total').val()`
  // para admin3, para evitar bypass del límite manipulando el total.
  const patch={
    status:'approved',
    approvedAt:new Date().toISOString(),
    approvedBy:currentAuthUid(),
    approvedByEmail:currentAuthEmail(),
    approvedRole:currentRole(),
    ...(approvalNote?{approvalNote}:{})
  };
  updateOrder(id,patch);
  try{ auditLog('order.approve',{orderId:id,total:o?total(o):null,role:currentRole()}); }catch(e){}
  if(!fbDb && o){ Object.assign(o, patch); render(); }
  toast('Pedido aprobado','#16a34a');
  const sup=o?suppliers[o.supId]:null;
  const localPhone=o?(cfg.localPhones?.[o.restaurant]||''):'';
  const nextWA=localPhone?{phone:localPhone,msg:msgLocal(o,sup?.name||o.supId),desc:`Avisa a ${o.restaurant} que el pedido fue enviado`}:null;
  const supPhone=o?supPhoneFor(sup,o.restaurant):'';
  if(o&&supPhone){ markSentToSupplier(id); showWA(supPhone,msgSupplier({...o,status:'approved'}),`Pedido aprobado — envía a ${sup.name}`,nextWA); }
  else if(nextWA) showWA(nextWA.phone,nextWA.msg,nextWA.desc);
}
function rejectWithReason(id){
  if(!requireNotBlocked()) return;
  if(!requireCan('canApproveOrders') && !hasAdminAccess()){ return; }
  const reason=prompt('Motivo del rechazo (opcional):');
  if(reason===null) return; // cancelled
  const patch={
    status:'rejected',
    rejectReason:reason||'',
    rejectedAt:new Date().toISOString(),
    rejectedBy:currentAuthUid(),
    rejectedByEmail:currentAuthEmail(),
    rejectedRole:currentRole()
  };
  updateOrder(id,patch);
  try{ auditLog('order.reject',{orderId:id,reason:reason||'',role:currentRole()}); }catch(e){}
  if(!fbDb){ const o=orders.find(o=>o.id===id);if(o) Object.assign(o, patch); render(); }
  toast('Pedido rechazado','#dc2626');
}
function startEditOrder(id){
  const o=orders.find(x=>x.id===id);
  if(!o) return;
  S.editOrderId=id;
  S.editItems=o.items.map(it=>({...it}));
  renderAdminContent();
}
function editRemoveItem(idx){
  S.editItems.splice(idx,1);
  renderAdminContent();
}
function editAddProduct(orderId, supId){
  const sel=document.getElementById('edit-add-prod-'+orderId);
  const qtyEl=document.getElementById('edit-add-qty-'+orderId);
  if(!sel||!sel.value) return;
  const opt=sel.options[sel.selectedIndex];
  const qty=parseFloat(qtyEl?.value)||1;
  const price=parseFloat(opt.dataset.price)||0;
  S.editItems.push({id:opt.value,name:opt.dataset.name,unit:opt.dataset.unit||'UN',qty,price});
  renderAdminContent();
}
function editItemQty(idx,delta){
  S.editItems[idx].qty=Math.max(0,(S.editItems[idx].qty||0)+delta);
  const el=document.getElementById('eiq-'+idx);
  if(el) el.textContent=S.editItems[idx].qty;
  const ep=document.getElementById('eip-'+idx);
  if(ep) ep.textContent=fmt(S.editItems[idx].qty*S.editItems[idx].price);
  const newTot=S.editItems.reduce((s,it)=>s+it.qty*it.price,0);
  const te=document.getElementById('edit-tot');
  if(te) te.textContent='Total: '+fmt(newTot);
}
function approveWithEdits(id){
  const items=S.editItems.filter(it=>it.qty>0);
  if(!items.length){toast('El pedido no puede estar vacío','#dc2626');return;}
  const noteEl=document.getElementById('approve-note-'+id);
  const approvalNote=noteEl?noteEl.value.trim():'';
  const oOrig=orders.find(x=>x.id===id);
  updateOrder(id,{status:'approved',items,modifiedByAdmin:true,...(approvalNote?{approvalNote}:{})});
  if(!fbDb){ if(oOrig){oOrig.status='approved';oOrig.items=items;oOrig.modifiedByAdmin=true;if(approvalNote)oOrig.approvalNote=approvalNote;} }
  S.editOrderId=null;S.editItems=[];
  toast('Pedido modificado y aprobado','#16a34a');
  const sup=oOrig?suppliers[oOrig.supId]:null;
  const localPhone2=oOrig?(cfg.localPhones?.[oOrig.restaurant]||''):'';
  const nextWA2=localPhone2?{phone:localPhone2,msg:msgLocal({...oOrig,items},sup?.name||oOrig.supId),desc:`Avisa a ${oOrig.restaurant} que el pedido fue enviado`}:null;
  const supPhone2=oOrig?supPhoneFor(sup,oOrig.restaurant):'';
  if(oOrig&&supPhone2) showWA(supPhone2,msgSupplier({...oOrig,status:'approved',items,modifiedByAdmin:true}),`Pedido aprobado — envía a ${sup.name}`,nextWA2);
  else if(nextWA2) showWA(nextWA2.phone,nextWA2.msg,nextWA2.desc);
}

let _recvOrderId=null;
function markReceived(id){
  _recvOrderId=id;
  const o=orders.find(x=>x.id===id);
  if(!o){toast('Pedido no encontrado','#dc2626');return;}
  const itemsHtml=(o.items||[]).map((it,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--brd)">
      <div style="flex:1;font-size:13px">${it.name} <span style="color:var(--mut)">${it.qty} ${it.unit}</span></div>
      <select id="recv-status-${i}" style="font-size:12px;padding:3px 6px;border:1px solid var(--brd);border-radius:6px;background:var(--card);color:var(--txt)">
        <option value="ok">OK</option>
        <option value="partial">Parcial</option>
        <option value="missing">Faltó</option>
        <option value="bad"> Mal estado</option>
      </select>
      <input id="recv-note-${i}" type="text" placeholder="Nota..." style="width:100px;font-size:12px;padding:3px 6px;border:1px solid var(--brd);border-radius:6px;background:var(--card);color:var(--txt)">
    </div>`).join('');
  document.getElementById('recv-items').innerHTML=itemsHtml;
  document.getElementById('recv-general-note').value='';
  document.getElementById('recv-ov').style.display='flex';
}
function closeRecvModal(){ document.getElementById('recv-ov').style.display='none'; _recvOrderId=null; }
function confirmReceived(){
  if(!_recvOrderId) return;
  const o=orders.find(x=>x.id===_recvOrderId);
  if(!o){ closeRecvModal(); return; }
  const receivedItems=(o.items||[]).map((it,i)=>{
    const status=document.getElementById('recv-status-'+i)?.value||'ok';
    const note=document.getElementById('recv-note-'+i)?.value.trim()||'';
    return {...it,recvStatus:status,...(note?{recvNote:note}:{})};
  });
  const generalNote=document.getElementById('recv-general-note')?.value.trim()||'';
  const hasIssues=receivedItems.some(it=>it.recvStatus!=='ok');
  updateOrder(_recvOrderId,{status:'received',receivedAt:new Date().toISOString(),receivedItems,...(generalNote?{receivedNote:generalNote}:{}),...(hasIssues?{receivedIssues:true}:{})});
  if(!fbDb){ const ord=orders.find(x=>x.id===_recvOrderId);if(ord){ord.status='received';ord.receivedAt=new Date().toISOString();ord.receivedItems=receivedItems;if(generalNote)ord.receivedNote=generalNote;if(hasIssues)ord.receivedIssues=true;}}
  // Auto-update inventory stock for received items
  try{ updateStockFromOrder(o, receivedItems); }catch(e){ console.warn('Inv update error:',e); }
  closeRecvModal();
  toast(hasIssues?' Recibido con incidencias':' Pedido recibido correctamente',hasIssues?'#d97706':'#7c3aed');
  renderAdminContent();
}

function vReceived(){
  const rec=orders.filter(o=>o.status==='received').sort((a,b)=>new Date(b.receivedAt||b.createdAt)-new Date(a.receivedAt||a.createdAt));
  if(!rec.length) return `<div class="empty"><div class="ei"></div><div class="et">Sin pedidos recibidos aún</div></div>`;
  const tot=rec.reduce((s,o)=>s+total(o),0);
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div style="font-size:13px;color:var(--mut)">${rec.length} pedidos confirmados · ${fmt(tot)} total</div>
    <button class="btn btn-ghost btn-sm" onclick="exportExcel('received')">Exportar Excel</button>
  </div>`+rec.map(o=>orderCard(o,false)).join('');
}


function exportExcel(type){
  if(typeof XLSX==='undefined'){toast('Librería Excel no cargada','#dc2626');return;}
  let rows=[];
  let filename='pedidos';
  if(type==='all'||type==='monthly'||!type){
    filename='pedidos_provea_'+new Date().toISOString().slice(0,10);
    rows=[['ID','Fecha','Local','Proveedor','Estado','Total €','Urgente','Entrega'],...orders.map(o=>[o.id,(o.createdAt||'').slice(0,10),o.restaurant||'',(suppliers[o.supId]||{name:o.supId||'?'}).name,o.status,total(o).toFixed(2),o.urgent?'Sí':'No',o.deliveryDate||''])];
  } else if(type==='received'){
    filename='pedidos_recibidos_'+new Date().toISOString().slice(0,10);
    const rec=orders.filter(o=>o.status==='received');
    rows=[['ID','Fecha pedido','Fecha recepción','Local','Proveedor','Total €'],...rec.map(o=>[o.id,(o.createdAt||'').slice(0,10),(o.receivedAt||'').slice(0,10),o.restaurant||'',(suppliers[o.supId]||{name:o.supId||'?'}).name,total(o).toFixed(2)])];
  }
  const ws=XLSX.utils.aoa_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Pedidos');
  XLSX.writeFile(wb,filename+'.xlsx');
  toast('Excel descargado','#16a34a');
}

function toggleDarkMode(){
  S.darkMode=!S.darkMode;
  localStorage.setItem('oc_dark',S.darkMode?'1':'0');
  document.body.classList.toggle('dark',S.darkMode);
  const btn=document.getElementById('btn-dark');
  if(btn) btn.textContent=S.darkMode?'☀️':'🌙';
  render();
}
