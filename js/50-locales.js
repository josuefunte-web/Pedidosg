/* ═══════════════ GESTIÓN DE LOCALES (añadir / renombrar / borrar) ═══════════════
   La lista de locales vive en cfg.users ({id, name, restaurant, needsApproval}).
   - El `id` (u1, u2, …) es fijo y lo usan presupuestos, food cost y la
     visibilidad de proveedores (disabledFor), así que esos datos no se tocan.
   - El nombre (`restaurant`) se guarda como texto en muchos sitios de Firebase
     (pedidos, albaranes, usuarios, wishlist, horarios, inventario…). Por eso
     renombrar reescribe todos esos registros en UNA sola actualización atómica:
     o se cambia todo, o no se cambia nada.
   La lista se sincroniza en globalCfg/locales para que todos los dispositivos
   la vean (antes solo existía en el localStorage de cada navegador).
═══════════════════════════════════════════════════════════════════════════ */

// Caracteres que Firebase no admite en claves (localPhones usa el nombre como clave)
const _LOCAL_BAD_CHARS = /[.#$\[\]\/]/;

function _localNameError(name, ignoreId){
  if(!name) return 'El nombre no puede estar vacío';
  if(name.length > 60) return 'El nombre es demasiado largo (máx. 60 caracteres)';
  if(_LOCAL_BAD_CHARS.test(name)) return 'El nombre no puede contener . # $ [ ] /';
  const dup = cfg.users.find(u => u.id !== ignoreId && (u.restaurant||'').toLowerCase() === name.toLowerCase());
  if(dup) return 'Ya existe un local con ese nombre';
  return '';
}

// Normaliza lo que llega de Firebase (un array puede llegar como objeto si tiene huecos)
function _normalizeLocales(val){
  const arr = Array.isArray(val) ? val : Object.values(val || {});
  return arr.filter(u => u && u.id && u.restaurant)
            .map(u => ({...u, name:u.name||u.restaurant, needsApproval:u.needsApproval!==false}));
}

// Llamado desde el listener de globalCfg cuando cambia la lista en Firebase
function applyRemoteLocales(val){
  const list = _normalizeLocales(val);
  if(!list.length) return false;
  if(JSON.stringify(list) === JSON.stringify(cfg.users)) return false;
  cfg.users = list;
  return true;
}

function _localesPayload(list){
  // Conserva campos extra (p.ej. `vacaciones`); Firebase no admite undefined
  return list.map(u => JSON.parse(JSON.stringify({...u, name:u.restaurant, needsApproval:u.needsApproval!==false})));
}

function _rerenderLocales(){
  if(typeof renderAdminContent === 'function' && S.view === 'admin'){
    const _sy = window.scrollY;
    renderAdminContent();
    requestAnimationFrame(() => window.scrollTo(0, _sy));
  }
}

function _requireLocalesAdmin(){
  if(!isSuperAdmin()){ toast('Solo el Admin 1 puede gestionar locales', '#dc2626'); return false; }
  if(!fbDb){ toast('Sin conexión con Firebase', '#dc2626'); return false; }
  return true;
}

/* ── UI ─────────────────────────────────────────────────────────────────── */
function localesEditor(){
  if(!isSuperAdmin()) return '';
  const approved = Object.values(authUsers || {}).filter(u => u.status === 'approved');
  const rows = cfg.users.map(u => {
    const nUsers = approved.filter(a => (a.restaurants || [a.restaurant]).includes(u.restaurant)).length;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--brd);flex-wrap:wrap">
      <span style="flex:1;min-width:140px;font-size:14px;font-weight:600">${escHtml(u.restaurant)}</span>
      <span style="font-size:11px;color:var(--mut)">${nUsers} usuario${nUsers===1?'':'s'}</span>
      <button class="btn btn-ghost btn-sm" onclick="renameLocal('${u.id}')">Renombrar</button>
      <button class="btn btn-ghost btn-sm" style="color:#dc2626" onclick="deleteLocal('${u.id}')">Borrar</button>
    </div>`;
  }).join('');
  return `<div class="card" style="margin-top:16px">
    <div class="card-t">Locales</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">
      Al <strong>renombrar</strong> un local se actualiza su nombre en pedidos, albaranes, usuarios, horarios, inventario y demás datos, sin perder historial.
      Al <strong>borrar</strong> un local deja de aparecer en la app, pero sus pedidos y albaranes antiguos se conservan.
    </div>
    <div style="background:var(--srf);border:1.5px solid var(--brd);border-radius:10px;padding:2px 14px">${rows || '<div style="padding:10px 0;color:var(--mut);font-size:13px">No hay locales</div>'}</div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <input type="text" id="new-local-name" placeholder="Nombre del nuevo local" maxlength="60" style="flex:1;min-width:180px" onkeydown="if(event.key==='Enter')addLocal()"/>
      <button class="btn btn-pri" onclick="addLocal()">+ Añadir local</button>
    </div>
  </div>`;
}

/* ── Añadir ─────────────────────────────────────────────────────────────── */
function addLocal(){
  if(!_requireLocalesAdmin()) return;
  const inp = document.getElementById('new-local-name');
  const name = (inp?.value || '').trim().replace(/\s+/g, ' ');
  const err = _localNameError(name);
  if(err){ toast(err, '#dc2626'); return; }
  const maxN = cfg.users.reduce((m, u) => Math.max(m, parseInt(String(u.id).replace(/\D/g, '')) || 0), 0);
  const nu = {id:'u'+(maxN+1), name, restaurant:name, needsApproval:true};
  const list = _localesPayload([...cfg.users, nu]);
  fbDb.ref('globalCfg/locales').set(list).then(() => {
    cfg.users = list; saveCfgLocalOnly();
    auditLog('local_add', {id:nu.id, name});
    toast('Local añadido: '+name, '#16a34a');
    _rerenderLocales();
  }).catch(e => toast('Error al añadir: '+(e.message||e), '#dc2626', 6000));
}

/* ── Renombrar ──────────────────────────────────────────────────────────── */
async function renameLocal(id){
  if(!_requireLocalesAdmin()) return;
  const u = cfg.users.find(x => x.id === id); if(!u) return;
  const oldName = u.restaurant;
  const input = prompt('Nuevo nombre para "'+oldName+'":', oldName);
  if(input === null) return;
  const newName = input.trim().replace(/\s+/g, ' ');
  if(newName === oldName) return;
  const err = _localNameError(newName, id);
  if(err){ toast(err, '#dc2626'); return; }
  if(!confirm('¿Renombrar "'+oldName+'" a "'+newName+'"?\n\nSe actualizará el nombre en todos los pedidos, albaranes, usuarios, horarios, inventario y demás datos de este local.')) return;

  toast('Renombrando local…', '#2563eb', 8000);
  try{
    const updates = await _buildRenameUpdates(oldName, newName);
    updates['globalCfg/locales'] = _localesPayload(cfg.users.map(x => x.id === id ? {...x, restaurant:newName} : x));
    // Una sola actualización multi-ruta → atómica en Firebase
    await fbDb.ref().update(updates);
    cfg.users = updates['globalCfg/locales'];
    if(cfg.localPhones && cfg.localPhones[oldName] !== undefined){
      cfg.localPhones[newName] = cfg.localPhones[oldName];
      delete cfg.localPhones[oldName];
    }
    saveCfgLocalOnly();
    if(S.session && S.session.restaurant === oldName) S.session.restaurant = newName;
    if(S.session && Array.isArray(S.session.restaurants)) S.session.restaurants = S.session.restaurants.map(r => r === oldName ? newName : r);
    auditLog('local_rename', {id, from:oldName, to:newName, paths:Object.keys(updates).length});
    toast('Local renombrado a "'+newName+'"', '#16a34a');
    _rerenderLocales();
  }catch(e){
    console.error('renameLocal', e);
    toast('No se pudo renombrar (no se ha cambiado nada): '+(e.message||e), '#dc2626', 8000);
  }
}

// Construye el mapa {ruta: valor} con todos los cambios necesarios.
// Lee de Firebase (no de la memoria) para no dejarse nada sin cargar.
async function _buildRenameUpdates(oldName, newName){
  const get = path => fbDb.ref(path).once('value').then(s => s.val()).catch(() => null);
  const oldKey = restKey(oldName), newKey = restKey(newName);
  const [ordersV, albV, extraV, reviewV, wishV, escV, menV, authV, phonesV, schedV, invV, movV, favV] = await Promise.all([
    get('orders'), get('albaranes'), get('extraExpenses'), get('pendingReview'), get('wishlist'),
    get('escandallos'), get('menus'), get('authUsers'), get('globalCfg/localPhones'),
    get('schedules/'+oldKey), get('inventory/'+oldKey), get('inventoryMovements/'+oldKey), get('favorites/'+oldKey)
  ]);
  const up = {};

  // Colecciones con campo `restaurant`
  [['orders',ordersV],['albaranes',albV],['extraExpenses',extraV],['pendingReview',reviewV],['wishlist',wishV]].forEach(([col, val]) => {
    Object.entries(val || {}).forEach(([k, r]) => { if(r && r.restaurant === oldName) up[col+'/'+k+'/restaurant'] = newName; });
  });
  // Escandallos y menús usan `restaurante`
  [['escandallos',escV],['menus',menV]].forEach(([col, val]) => {
    Object.entries(val || {}).forEach(([k, r]) => { if(r && r.restaurante === oldName) up[col+'/'+k+'/restaurante'] = newName; });
  });
  // Usuarios
  Object.entries(authV || {}).forEach(([uid, a]) => {
    if(!a) return;
    if(a.restaurant === oldName) up['authUsers/'+uid+'/restaurant'] = newName;
    if(Array.isArray(a.restaurants) && a.restaurants.includes(oldName))
      up['authUsers/'+uid+'/restaurants'] = a.restaurants.map(r => r === oldName ? newName : r);
  });
  // Teléfono de WhatsApp (clave = nombre)
  if(phonesV && phonesV[oldName] !== undefined){
    up['globalCfg/localPhones/'+oldName] = null;
    up['globalCfg/localPhones/'+newName] = phonesV[oldName];
  }
  // Nodos indexados por restKey(nombre): hay que moverlos de clave
  if(oldKey !== newKey){
    Object.entries(schedV || {}).forEach(([sid, sh]) => {
      up['schedules/'+oldKey+'/'+sid] = null;
      up['schedules/'+newKey+'/'+sid] = {...sh, restaurant: sh.restaurant === oldName ? newName : sh.restaurant};
    });
    if(invV){ up['inventory/'+oldKey] = null; up['inventory/'+newKey] = invV; }
    if(movV){ up['inventoryMovements/'+oldKey] = null; up['inventoryMovements/'+newKey] = movV; }
    if(favV){ up['favorites/'+oldKey] = null; up['favorites/'+newKey] = favV; }
  } else {
    Object.entries(schedV || {}).forEach(([sid, sh]) => {
      if(sh && sh.restaurant === oldName) up['schedules/'+oldKey+'/'+sid+'/restaurant'] = newName;
    });
  }
  return up;
}

/* ── Borrar ─────────────────────────────────────────────────────────────── */
async function deleteLocal(id){
  if(!_requireLocalesAdmin()) return;
  const u = cfg.users.find(x => x.id === id); if(!u) return;
  const name = u.restaurant;
  if(cfg.users.length <= 1){ toast('Debe quedar al menos un local', '#dc2626'); return; }

  const authV = await fbDb.ref('authUsers').once('value').then(s => s.val() || {}).catch(() => authUsers || {});
  const affected = Object.entries(authV).filter(([, a]) => a && (a.restaurant === name || (a.restaurants || []).includes(name)));
  // Usuarios cuyo ÚNICO local es este: hay que reasignarlos antes
  const orphans = affected.filter(([, a]) => {
    const rs = (a.restaurants && a.restaurants.length ? a.restaurants : [a.restaurant]).filter(r => r && r !== name);
    return rs.length === 0 && a.status !== 'rejected';
  });
  if(orphans.length){
    alert('No se puede borrar "'+name+'": estos usuarios solo tienen acceso a este local:\n\n'
      + orphans.map(([, a]) => '• '+(a.name || a.email)).join('\n')
      + '\n\nAsígnales otro local en "Solicitudes de acceso" (o recházalos) y vuelve a intentarlo.');
    return;
  }
  if(!confirm('¿Borrar el local "'+name+'"?\n\nDejará de aparecer en la app'
    + (affected.length ? ' y se quitará de '+affected.length+' usuario(s) que también tienen otros locales' : '')
    + '.\nLos pedidos, albaranes y demás datos antiguos se conservan.')) return;

  const up = {};
  affected.forEach(([uid, a]) => {
    const rs = (a.restaurants && a.restaurants.length ? a.restaurants : [a.restaurant]).filter(r => r && r !== name);
    up['authUsers/'+uid+'/restaurants'] = rs;
    if(a.restaurant === name) up['authUsers/'+uid+'/restaurant'] = rs[0];
  });
  if((cfg.localPhones || {})[name] !== undefined) up['globalCfg/localPhones/'+name] = null;
  const list = _localesPayload(cfg.users.filter(x => x.id !== id));
  up['globalCfg/locales'] = list;
  try{
    await fbDb.ref().update(up);
    cfg.users = list;
    if(cfg.localPhones) delete cfg.localPhones[name];
    saveCfgLocalOnly();
    auditLog('local_delete', {id, name});
    toast('Local borrado: '+name, '#16a34a');
    _rerenderLocales();
  }catch(e){
    console.error('deleteLocal', e);
    toast('No se pudo borrar: '+(e.message||e), '#dc2626', 8000);
  }
}

// Guarda cfg en localStorage sin re-subir globalCfg (los locales ya se subieron)
function saveCfgLocalOnly(){
  try{ localStorage.setItem('oc_cfg', JSON.stringify(cfg)); }catch(e){}
}

// En el formulario de registro (antes de iniciar sesión) intentamos leer la
// lista actualizada. Requiere la regla de lectura pública de globalCfg/locales;
// si no está publicada, se usa la lista guardada en este navegador.
function refreshLocalesForRegister(){
  if(!fbDb || S._localesRegFetched) return;
  S._localesRegFetched = true;
  fbDb.ref('globalCfg/locales').once('value').then(snap => {
    if(applyRemoteLocales(snap.val())){
      saveCfgLocalOnly();
      if(S.view === 'login' && S.loginTab === 'register') render();
    }
  }).catch(() => {});
}
