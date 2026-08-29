/* ═══════════════ HORARIOS Y SOLICITUDES DE PRODUCTO ═══════════════
   Dos features del modelo de permisos que existían como flags
   (canViewSchedule/canEditSchedule/canSendWishlist) pero no tenían UI:
   1. Horarios: turnos semanales por local. Todos los roles los ven
      (canViewSchedule es de nivel camarero); solo encargado+ los edita.
   2. Solicitudes de producto: los camareros no pueden hacer pedidos
      (canCreateOrders empieza en jefe_cocina), así que necesitan una
      forma de avisar a cocina de lo que falta — este es el "wishlist"
      mencionado en el comment-header de 03a-permissions.js.
════════════════════════════════════════════════════════ */

const DIAS_SEMANA=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

// ── Horarios ──────────────────────────────────────────────────────────────
function vHorarios(){
  const rest=S.session.restaurant;
  const canEdit=can('canEditSchedule');
  const rk=restKey(rest);
  const shifts=Object.values(schedules[rk]||{});
  const byDay=DIAS_SEMANA.map((_,i)=>shifts.filter(s=>s.day===i).sort((a,b)=>(a.start||'').localeCompare(b.start||'')));
  const formHtml=(S.schEditId&&canEdit)?renderSchForm(rest):'';
  const addBtn=canEdit?`<button class="btn btn-pri btn-sm" onclick="openSchForm('new')">+ Turno</button>`:'';
  const rows=DIAS_SEMANA.map((d,i)=>{
    const items=byDay[i];
    return `<div style="margin-bottom:14px">
      <div class="sh" style="margin-bottom:6px">${d}</div>
      ${items.length?items.map(s=>`<div class="pr" style="align-items:center">
        <span class="pn">${_e(s.person||'')}${s.note?` <small style="color:var(--mut)">(${_e(s.note)})</small>`:''}</span>
        <span class="pq">${_e(s.start||'')}${s.start||s.end?'–':''}${_e(s.end||'')}</span>
        ${canEdit?`<div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="openSchForm('${s.id}')" title="Editar">✎</button>
          <button class="btn btn-no btn-sm" onclick="deleteSchShift('${s.id}')" title="Eliminar">✕</button>
        </div>`:''}
      </div>`).join(''):`<div style="font-size:12px;color:var(--mut);padding:4px 0">Sin turnos</div>`}
    </div>`;
  }).join('');
  return `<div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="sh" style="margin:0">Horarios — ${_e(rest)}</div>${addBtn}
    </div>
    ${formHtml}
    ${rows}
  </div>`;
}
function openSchForm(id){ S.schEditId=id; render(); }
function closeSchForm(){ S.schEditId=null; render(); }
function renderSchForm(rest){
  const rk=restKey(rest);
  const isNew=S.schEditId==='new';
  const s=isNew?{day:0,person:'',start:'',end:'',note:''}:((schedules[rk]||{})[S.schEditId]||{day:0,person:'',start:'',end:'',note:''});
  return `<div style="background:var(--srf);border:1.5px solid var(--brd);border-radius:10px;padding:14px;margin-bottom:14px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Persona</label>
        <input type="text" id="sch-person" value="${_e(s.person||'')}" placeholder="Nombre" style="width:100%;padding:7px 10px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/></div>
      <div><label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Día</label>
        <select id="sch-day" style="width:100%;padding:7px 6px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt)">
          ${DIAS_SEMANA.map((d,i)=>`<option value="${i}" ${s.day===i?'selected':''}>${d}</option>`).join('')}
        </select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Entrada</label>
        <input type="time" id="sch-start" value="${_e(s.start||'')}" style="width:100%;padding:7px 10px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/></div>
      <div><label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Salida</label>
        <input type="time" id="sch-end" value="${_e(s.end||'')}" style="width:100%;padding:7px 10px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/></div>
    </div>
    <div style="margin-bottom:10px"><label style="font-size:11px;color:var(--mut);display:block;margin-bottom:3px">Nota (opcional)</label>
      <input type="text" id="sch-note" value="${_e(s.note||'')}" style="width:100%;padding:7px 10px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ok btn-sm" onclick="saveSchShift('${isNew?'':S.schEditId}')">Guardar</button>
      <button class="btn btn-ghost btn-sm" onclick="closeSchForm()">Cancelar</button>
    </div>
  </div>`;
}
function saveSchShift(id){
  if(!requireCan('canEditSchedule')) return;
  if(!requireNotBlocked()) return;
  if(!fbDb){ toast('Sin conexión Firebase','#dc2626'); return; }
  const rest=S.session.restaurant;
  const rk=restKey(rest);
  const person=(document.getElementById('sch-person').value||'').trim();
  const day=parseInt(document.getElementById('sch-day').value,10)||0;
  const start=document.getElementById('sch-start').value||'';
  const end=document.getElementById('sch-end').value||'';
  const note=(document.getElementById('sch-note').value||'').trim();
  if(!person){ toast('Indica la persona','#dc2626'); return; }
  const shiftId=id||('s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  fbDb.ref('schedules/'+rk+'/'+shiftId).set({
    id:shiftId, restaurant:rest, day, person, start, end, note,
    updatedAt:Date.now(), updatedBy:S.session.uid
  }).then(()=>{
    S.schEditId=null; toast('Turno guardado','#16a34a'); render();
    auditLog('schedule_save',{restaurant:rest,shiftId});
  }).catch(e=>toast('Error: '+e.message,'#dc2626'));
}
function deleteSchShift(id){
  if(!requireCan('canEditSchedule')) return;
  if(!confirm('¿Eliminar este turno?')) return;
  if(!fbDb) return;
  const rk=restKey(S.session.restaurant);
  fbDb.ref('schedules/'+rk+'/'+id).remove().then(()=>{
    toast('Turno eliminado','#16a34a'); render();
    auditLog('schedule_delete',{restaurant:S.session.restaurant,shiftId:id});
  });
}

// ── Solicitar producto a cocina (camareros) ─────────────────────────────────
function vWishlistCamarero(){
  const rest=S.session.restaurant;
  const draft=S.wishDraft||[];
  const draftRows=draft.map((it,i)=>`<div class="pr" style="align-items:center">
    <span class="pn">${_e(it.name)}</span><span class="pq">${_e(it.qty||'')} ${_e(it.unit||'')}</span>
    <button style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:15px;padding:0 4px" onclick="removeWishDraftItem(${i})" title="Quitar">✕</button>
  </div>`).join('');
  const mine=Object.values(wishlist).filter(w=>w.restaurant===rest&&w.uid===S.session.uid).sort((a,b)=>b.createdAt-a.createdAt);
  const histHtml=mine.length?`<div class="sh" style="margin-top:20px">Tus solicitudes</div>${mine.map(w=>`
    <div class="oc">
      <div class="oc-hd"><div><div class="oc-sub">${fmtD(w.createdAt)} · <span class="badge ${w.status==='done'?'b-a':'b-p'}">${w.status==='done'?'Atendida':'Pendiente'}</span></div></div></div>
      <div class="pl">${(w.items||[]).map(it=>`<div class="pr"><span class="pn">${_e(it.name)}</span><span class="pq">${_e(it.qty||'')} ${_e(it.unit||'')}</span></div>`).join('')}</div>
      ${w.note?`<div style="font-size:12px;color:var(--mut);margin-top:4px"><em>${_e(w.note)}</em></div>`:''}
    </div>`).join('')}`:'';
  return `<div>
    <div class="sh">Solicitar producto a cocina</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Avisa al jefe de cocina o al encargado de los productos que faltan.</div>
    <div style="display:grid;grid-template-columns:1fr 70px 90px;gap:8px;margin-bottom:8px">
      <input type="text" id="wish-name" placeholder="Producto" style="padding:7px 10px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/>
      <input type="text" id="wish-qty" placeholder="Cant." style="padding:7px 8px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/>
      <input type="text" id="wish-unit" placeholder="Unidad" style="padding:7px 8px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt);box-sizing:border-box"/>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="addWishDraftItem()" style="margin-bottom:10px">+ Añadir a la lista</button>
    ${draftRows}
    <textarea id="wish-note" placeholder="Nota (opcional)..." rows="2" style="width:100%;padding:8px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt);resize:vertical;box-sizing:border-box;margin-top:8px"></textarea>
    <button class="btn btn-acc" style="margin-top:10px" onclick="sendWishlist()" ${draft.length?'':'disabled'}>Enviar solicitud</button>
    ${histHtml}
  </div>`;
}
function addWishDraftItem(){
  const nameEl=document.getElementById('wish-name');
  const name=(nameEl.value||'').trim();
  if(!name){ toast('Indica el producto','#dc2626'); return; }
  const qty=(document.getElementById('wish-qty').value||'').trim();
  const unit=(document.getElementById('wish-unit').value||'').trim();
  if(!S.wishDraft) S.wishDraft=[];
  S.wishDraft.push({name,qty,unit});
  render();
}
function removeWishDraftItem(i){ S.wishDraft.splice(i,1); render(); }
function sendWishlist(){
  if(!requireCan('canSendWishlist')) return;
  if(!requireNotBlocked()) return;
  const draft=S.wishDraft||[];
  if(!draft.length){ toast('Añade al menos un producto','#dc2626'); return; }
  if(!fbDb){ toast('Sin conexión Firebase','#dc2626'); return; }
  if(!S.session||!S.session.uid){ toast('Sin sesión','#dc2626'); return; }
  const noteEl=document.getElementById('wish-note');
  const note=(noteEl?noteEl.value:'').trim();
  const id='w'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const w={
    id, restaurant:S.session.restaurant, uid:S.session.uid,
    authorName:S.session.name||S.session.restaurant, items:draft, note,
    status:'pending', createdAt:Date.now()
  };
  fbDb.ref('wishlist/'+id).set(w).then(()=>{
    S.wishDraft=[]; toast('Solicitud enviada a cocina','#16a34a'); render();
  }).catch(e=>toast('Error: '+e.message,'#dc2626'));
}

// ── Gestionar solicitudes (jefe de cocina / encargado) ──────────────────────
function vWishlistManage(){
  const rest=S.session.restaurant;
  const all=Object.values(wishlist).filter(w=>w.restaurant===rest).sort((a,b)=>b.createdAt-a.createdAt);
  const pending=all.filter(w=>w.status!=='done');
  const done=all.filter(w=>w.status==='done').slice(0,20);
  function card(w){
    return `<div class="oc">
      <div class="oc-hd">
        <div>
          <div class="oc-rest">${_e(w.authorName||'?')}</div>
          <div class="oc-sub">${fmtD(w.createdAt)} · <span class="badge ${w.status==='done'?'b-a':'b-p'}">${w.status==='done'?'Atendida':'Pendiente'}</span></div>
        </div>
        ${w.status!=='done'?`<button class="btn btn-ok btn-sm" onclick="markWishlistDone('${w.id}')">✓ Atendida</button>`:''}
      </div>
      <div class="pl">${(w.items||[]).map(it=>`<div class="pr"><span class="pn">${_e(it.name)}</span><span class="pq">${_e(it.qty||'')} ${_e(it.unit||'')}</span></div>`).join('')}</div>
      ${w.note?`<div style="font-size:12px;color:var(--mut);margin-top:4px"><em>${_e(w.note)}</em></div>`:''}
    </div>`;
  }
  return `<div>
    <div class="sh">Solicitudes de producto (${pending.length} pendientes)</div>
    ${pending.length?pending.map(card).join(''):`<div class="empty"><div class="ei"></div><div class="et">Sin solicitudes pendientes</div></div>`}
    ${done.length?`<div class="sh" style="margin-top:20px">Atendidas recientemente</div>${done.map(card).join('')}`:''}
  </div>`;
}
function markWishlistDone(id){
  if(!requireCan('canCreateOrders')) return;
  if(!requireNotBlocked()) return;
  if(!fbDb) return;
  fbDb.ref('wishlist/'+id).update({
    status:'done', doneAt:Date.now(), doneBy:S.session.uid, doneByName:S.session.name||''
  }).then(()=>toast('Marcada como atendida','#16a34a'))
    .catch(e=>toast('Error: '+e.message,'#dc2626'));
}
