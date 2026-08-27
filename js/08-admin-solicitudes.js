/* ═══════════════ ADMIN: SOLICITUDES ═══════════════ */
function vSolicitudes(){
  const all=Object.values(authUsers);
  const pending=all.filter(u=>u.status==='pending').sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  const approved=all.filter(u=>u.status==='approved').sort((a,b)=>(a.restaurant||'').localeCompare(b.restaurant||'','es'));
  const rejected=all.filter(u=>u.status==='rejected');
  const allRests=cfg.users.map(u=>u.restaurant);

  const pendHtml=pending.length?pending.map(u=>`
    <div class="user-card">
      <div class="uc-hd">
        <div>
          <div class="uc-name"> ${u.email}</div>
          <div class="uc-info">${u.restaurant}${u.name&&u.name!==u.email?' · '+u.name:''} · ${fmtD(u.createdAt)}</div>
        </div>
        <div class="uc-acts" style="flex-wrap:wrap;gap:4px">
          <button class="btn btn-ok btn-sm" onclick="approveRegistration('${u.uid}')">Aprobar</button>
          <button class="btn btn-no btn-sm" onclick="rejectRegistration('${u.uid}')">✗ Rechazar</button>
        </div>
      </div>
    </div>`).join('')
    :`<div class="empty" style="padding:28px 20px"><div class="ei"></div><div class="et">Sin solicitudes pendientes</div></div>`;

  function permEditor(u){
    const curRests=u.restaurants||[u.restaurant];
    const checks=allRests.map(r=>`
      <label class="perm-check">
        <input type="checkbox" class="perm-cb-${u.uid}" value="${r}" ${curRests.includes(r)?'checked':''}>
        ${r}
      </label>`).join('');
    return `<div class="perm-editor">
      <div style="font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Locales con acceso</div>
      <div class="perm-grid">${checks}</div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn btn-pri btn-sm" onclick="saveUserRestaurants('${u.uid}')">Guardar permisos</button>
        <button class="btn btn-ghost btn-sm" onclick="S.editingPermsUid=null;render()">Cancelar</button>
      </div>
    </div>`;
  }

  function restBadges(u){
    const rests=u.restaurants||[u.restaurant];
    return rests.map(r=>`<span class="rest-pill">${r}</span>`).join('');
  }

  const apprHtml=approved.length?`
    <div class="sh" style="margin-top:20px">Usuarios activos (${approved.length})</div>
    ${approved.map(u=>{
      const isEditing=S.editingPermsUid===u.uid;
      // Rol actual del usuario (con default para usuarios legacy sin campo role)
      const uRole=(u.role && ROLES.includes(u.role))?u.role:(u.isAdmin?'admin1':'jefe_cocina');
      const roleLbl=ROLE_LABELS[uRole];
      // Selector de rol — solo visible para quien puede cambiarlo
      const myRole=currentRole();
      const canChangeThisRole=canAssignRole(myRole,uRole);
      const rolePickerOpts=ROLES
        .filter(r=>canAssignRole(myRole,r))
        .map(r=>`<option value="${r}" ${r===uRole?'selected':''}>${ROLE_LABELS[r]}</option>`).join('');
      const rolePicker=canChangeThisRole&&rolePickerOpts?`<select onchange="setUserRole('${u.uid}',this.value)" style="padding:4px 8px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);font-weight:600">${rolePickerOpts}</select>`
        :`<span style="font-size:12px;color:var(--mut);font-weight:600">${roleLbl}</span>`;
      const blockedBadge=u.blocked?'<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;margin-left:4px">BLOQUEADO</span>':'';
      return `
      <div class="user-card" style="${isEditing?'border-color:var(--pri);box-shadow:0 0 0 2px rgba(26,26,46,.12)':''}${u.blocked?';opacity:.65':''}">
        <div class="uc-hd">
          <div style="flex:1;min-width:0">
            <div class="uc-name"> ${u.email}${u.name&&u.name!==u.email?` <span style="font-weight:400;font-size:13px;color:var(--mut)">· ${u.name}</span>`:''}${blockedBadge}</div>
            <div class="uc-info" style="margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${restBadges(u)} · ${u.needsApproval?'Aprobación manual':'Auto-aprobado'} · ${rolePicker}</div>
          </div>
          <div class="uc-acts" style="flex-wrap:wrap;gap:4px">
            <button class="btn btn-blue btn-sm" onclick="S.editingPermsUid='${isEditing?'':u.uid}';render()"> ${isEditing?'Cerrar':'Locales'}</button>
            <button class="btn btn-ghost btn-sm" title="${u.needsApproval?'Cambiar a auto-aprobado':'Cambiar a requiere aprobación'}" onclick="toggleNeedsApprovalAuth('${u.uid}',${!u.needsApproval})">${u.needsApproval?'Auto':'Manual'}</button>
            ${can('canBlockUsers')?`<button class="btn btn-ghost btn-sm" title="${u.blocked?'Desbloquear cuenta':'Bloquear cuenta'}" onclick="toggleUserBlock('${u.uid}',${!u.blocked})" style="${u.blocked?'background:#fee2e2;color:#dc2626;border-color:#fecaca':''}">${u.blocked?'🔒 Bloqueado':'🔓'}</button>`:''}
            <button class="btn btn-no btn-xs" title="Revocar acceso" onclick="revokeUser('${u.uid}')"></button>
          </div>
        </div>
        ${isEditing?permEditor(u):''}
      </div>`}).join('')}`:'';

  const rejHtml=rejected.length?`
    <div class="sh" style="margin-top:20px">Rechazados (${rejected.length})</div>
    ${rejected.map(u=>`
    <div class="user-card" style="opacity:.55">
      <div class="uc-hd">
        <div>
          <div class="uc-name" style="text-decoration:line-through"> ${u.email}</div>
          <div class="uc-info">${u.restaurant}</div>
        </div>
        <div class="uc-acts">
          <button class="btn btn-ok btn-xs" onclick="approveRegistration('${u.uid}')">↩ Re-aprobar</button>
        </div>
      </div>
    </div>`).join('')}`:'';

  const pendingBadge=pending.length?`<span style="background:var(--acc);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:800;margin-left:6px">${pending.length}</span>`:'';
  return `<div class="sh">Solicitudes de acceso${pendingBadge}</div>${pendHtml}${apprHtml}${rejHtml}${localPhonesEditor()}`;
}

// Teléfono de WhatsApp por local — se usa para avisar automáticamente al
// local cuando su pedido es aprobado y enviado al proveedor.
function localPhonesEditor(){
  const rests=cfg.users.map(u=>u.restaurant).filter(Boolean);
  const rows=rests.map(r=>{
    const phone=(cfg.localPhones||{})[r]||'';
    const rid=r.replace(/[^a-zA-Z0-9]/g,'_');
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--brd)">
      <span style="flex:1;font-size:13px;font-weight:600">${r}</span>
      <input type="tel" id="lp-phone-${rid}" value="${phone}" placeholder="34612345678" style="width:170px;padding:6px 10px;border:1.5px solid var(--brd);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt)" onchange="setLocalPhone('${r.replace(/'/g,"\\'")}',this.value)"/>
      ${phone?'<span style="color:#16a34a;font-size:11px;font-weight:600">✓</span>':'<span style="color:var(--mut);font-size:11px">sin número</span>'}
    </div>`;
  }).join('');
  return `<div class="sh" style="margin-top:24px">Teléfono de WhatsApp por local</div>
  <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Se usa para avisar automáticamente al local por WhatsApp cuando su pedido se aprueba y se envía al proveedor.</div>
  <div style="background:var(--srf);border:1.5px solid var(--brd);border-radius:10px;padding:4px 14px">${rows}</div>`;
}

function approveRegistration(uid){
  const u=authUsers[uid]; if(!u)return;
  const updates={status:'approved',approvedAt:new Date().toISOString(),approvedBy:cfg.adminName};
  if(!u.restaurants||!u.restaurants.length) updates.restaurants=[u.restaurant];
  fbDb.ref('authUsers/'+uid).update(updates)
    .then(()=>toast('Acceso concedido: '+u.email,'#16a34a'));
}
function rejectRegistration(uid){
  const u=authUsers[uid]; if(!u)return;
  const reason=prompt('Motivo del rechazo (opcional):');
  if(reason===null)return;
  fbDb.ref('authUsers/'+uid).update({status:'rejected',rejectedAt:new Date().toISOString(),rejectReason:reason||''})
    .then(()=>toast('Usuario rechazado','#888'));
}
function toggleNeedsApprovalAuth(uid,val){
  fbDb.ref('authUsers/'+uid).update({needsApproval:val})
    .then(()=>toast(val?'Ahora requiere aprobación manual':'Ahora se aprueba automáticamente','#16a34a'));
}
function toggleAdminRole(uid,val){
  const u=authUsers[uid]; if(!u)return;
  if(val && !confirm('¿Dar acceso de administrador completo a '+u.email+'?'))return;
  fbDb.ref('authUsers/'+uid).update({isAdmin:val})
    .then(()=>toast(val?'Ya es administrador: '+u.email:'Rol admin retirado','#16a34a'));
}
// Cambiar el rol de un usuario. Comprueba que el rol actual del que llama
// tiene permisos para asignar ese rol (admin1 puede todos, admin2 solo los
// no admin: camarero/jefe_cocina/encargado).
function setUserRole(uid,newRole){
  const u=authUsers[uid]; if(!u) return;
  if(!ROLES.includes(newRole)){ toast('Rol inválido','#dc2626'); return; }
  const myRole=currentRole();
  if(!canAssignRole(myRole,newRole)){ toast('No tienes permiso para asignar ese rol','#dc2626'); return; }
  // También comprobar que puede asignar/cambiar el rol ANTERIOR
  const oldRole=(u.role&&ROLES.includes(u.role))?u.role:(u.isAdmin?'admin1':'jefe_cocina');
  if(!canAssignRole(myRole,oldRole)){ toast('No tienes permiso sobre este usuario','#dc2626'); return; }
  // Sincronizar isAdmin con el rol (para compat con lugares donde aún se usa)
  const updates={role:newRole,isAdmin:ROLE_LEVEL[newRole]>=ROLE_LEVEL.admin3};
  fbDb.ref('authUsers/'+uid).update(updates)
    .then(()=>toast('Rol actualizado: '+ROLE_LABELS[newRole],'#16a34a'));
}
// Bloquear/desbloquear una cuenta. Solo admin1 (via can('canBlockUsers')).
function toggleUserBlock(uid,val){
  const u=authUsers[uid]; if(!u) return;
  if(val && !confirm('¿Bloquear a '+u.email+'? No podrá entrar hasta que lo desbloquees.')) return;
  fbDb.ref('authUsers/'+uid).update({blocked:val,blockedAt:val?new Date().toISOString():null})
    .then(()=>toast(val?'Cuenta bloqueada: '+u.email:'Cuenta desbloqueada','#16a34a'));
}
function revokeUser(uid){
  const u=authUsers[uid]; if(!u)return;
  if(!confirm('¿Revocar acceso a '+u.email+'? El usuario no podrá entrar.'))return;
  fbDb.ref('authUsers/'+uid).update({status:'rejected',revokedAt:new Date().toISOString()})
    .then(()=>toast('Acceso revocado','#888'));
}
function saveUserRestaurants(uid){
  const boxes=document.querySelectorAll(`.perm-cb-${uid}`);
  const selected=[...boxes].filter(cb=>cb.checked).map(cb=>cb.value);
  if(!selected.length){toast('Selecciona al menos un local','#dc2626');return;}
  const u=authUsers[uid]; if(!u)return;
  // Primary restaurant = first checked (or keep original if still in list)
  const primary=selected.includes(u.restaurant)?u.restaurant:selected[0];
  fbDb.ref('authUsers/'+uid).update({restaurants:selected,restaurant:primary})
    .then(()=>{ S.editingPermsUid=null; toast('Permisos actualizados','#16a34a'); });
}
