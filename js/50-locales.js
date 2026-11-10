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
    const nUsers = approved.filter(a => _userRests(a).includes(u.restaurant)).length;
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

  toast('Renombrando local…', '#2563eb', 15000);
  let updates;
  try{
    updates = await _buildRenameUpdates(oldName, newName);
  }catch(e){
    console.error('renameLocal (lectura)', e);
    toast('No se pudo renombrar (no se ha cambiado nada): '+(e.message||e), '#dc2626', 9000);
    return;
  }
  const locales = _localesPayload(cfg.users.map(x => x.id === id ? {...x, restaurant:newName} : x));
  updates['globalCfg/locales'] = locales;
  const res = await _applyUpdatesRobust(updates);
  if(!res.ok){
    toast('No se pudo renombrar: '+res.error, '#dc2626', 9000);
    return;
  }
  cfg.users = locales;
  if(cfg.localPhones && cfg.localPhones[oldName] !== undefined){
    cfg.localPhones[newName] = cfg.localPhones[oldName];
    delete cfg.localPhones[oldName];
  }
  saveCfgLocalOnly();
  if(S.session && S.session.restaurant === oldName) S.session.restaurant = newName;
  if(S.session && Array.isArray(S.session.restaurants)) S.session.restaurants = S.session.restaurants.map(r => r === oldName ? newName : r);
  auditLog('local_rename', {id, from:oldName, to:newName, paths:Object.keys(updates).length, failed:res.failed.slice(0,50)});
  _rerenderLocales();
  if(res.failed.length){
    alert('Local renombrado a "'+newName+'", pero '+res.failed.length+' registro(s) antiguos no se pudieron actualizar y siguen con el nombre "'+oldName+'":\n\n'
      + res.failed.slice(0,12).map(f => '• '+f.path+(f.reason?'  ('+f.reason+')':'')).join('\n')
      + (res.failed.length > 12 ? '\n… y '+(res.failed.length-12)+' más' : '')
      + '\n\nHaz una captura de este mensaje para revisarlo.');
  } else {
    toast('Local renombrado a "'+newName+'"', '#16a34a');
  }
}

// Campos obligatorios según las reglas de Firebase (.validate). Si un
// registro antiguo no los tiene, cualquier escritura sobre él se rechaza.
const _REQUIRED_FIELDS = {
  orders:    ['id','restaurant','supId','items','status','createdAt','total'],
  albaranes: ['id','restaurant'],
  wishlist:  ['id','restaurant','uid','items','status','createdAt'],
  authUsers: ['uid','email','status'],
  schedules: ['id','restaurant','day','person']
};
// Completa lo que se puede deducir sin inventar nada (id = clave, total = suma de líneas)
function _repairRecord(col, key, r, up, base){
  const req = _REQUIRED_FIELDS[col]; if(!req) return [];
  if((req.includes('id')) && (r.id === undefined || r.id === null || r.id === '')) up[base+'/id'] = key;
  if(col === 'authUsers' && !r.uid) up[base+'/uid'] = key;
  if(col === 'orders' && (r.total === undefined || r.total === null) && r.items){
    const its = Array.isArray(r.items) ? r.items : Object.values(r.items);
    const t = its.reduce((s, it) => s + (parseFloat(it && it.qty)||0) * (parseFloat(it && it.price)||0), 0);
    up[base+'/total'] = Math.round(t*100)/100;
  }
  // Lo que falte y no se pueda deducir
  return req.filter(f => {
    if(f === 'id' || (col === 'authUsers' && f === 'uid')) return false;
    if(col === 'orders' && f === 'total' && r.items) return false;
    if(f === 'restaurant') return false;
    return r[f] === undefined || r[f] === null || r[f] === '';
  });
}

// Lista de locales de un usuario (Firebase puede devolver arrays como objetos)
function _userRests(a){
  if(!a) return [];
  const rs = a.restaurants ? (Array.isArray(a.restaurants) ? a.restaurants : Object.values(a.restaurants)) : [];
  return (rs.length ? rs : [a.restaurant]).filter(Boolean);
}

// Construye el mapa {ruta: valor} con todos los cambios necesarios.
// Lee de Firebase (no de la memoria) para no dejarse nada sin cargar.
async function _buildRenameUpdates(oldName, newName){
  const get = path => fbDb.ref(path).once('value').then(s => s.val(), e => { throw new Error('no se pudo leer "'+path+'" ('+(e.code||e.message||e)+')'); });
  const oldKey = restKey(oldName), newKey = restKey(newName);
  const [ordersV, albV, extraV, reviewV, wishV, escV, menV, authV, phonesV, schedV, invV, movV, favV] = await Promise.all([
    get('orders'), get('albaranes'), get('extraExpenses'), get('pendingReview'), get('wishlist'),
    get('escandallos'), get('menus'), get('authUsers'), get('globalCfg/localPhones'),
    get('schedules/'+oldKey), get('inventory/'+oldKey), get('inventoryMovements/'+oldKey), get('favorites/'+oldKey)
  ]);
  const up = {};

  // Colecciones con campo `restaurant`
  [['orders',ordersV],['albaranes',albV],['extraExpenses',extraV],['pendingReview',reviewV],['wishlist',wishV]].forEach(([col, val]) => {
    Object.entries(val || {}).forEach(([k, r]) => {
      if(!r || r.restaurant !== oldName) return;
      up[col+'/'+k+'/restaurant'] = newName;
      _repairRecord(col, k, r, up, col+'/'+k);
    });
  });
  // Escandallos y menús usan `restaurante`
  [['escandallos',escV],['menus',menV]].forEach(([col, val]) => {
    Object.entries(val || {}).forEach(([k, r]) => { if(r && r.restaurante === oldName) up[col+'/'+k+'/restaurante'] = newName; });
  });
  // Usuarios
  Object.entries(authV || {}).forEach(([uid, a]) => {
    if(!a) return;
    let touched = false;
    if(a.restaurant === oldName){ up['authUsers/'+uid+'/restaurant'] = newName; touched = true; }
    const rs = a.restaurants ? (Array.isArray(a.restaurants) ? a.restaurants : Object.values(a.restaurants)) : [];
    if(rs.includes(oldName)){ up['authUsers/'+uid+'/restaurants'] = rs.map(r => r === oldName ? newName : r); touched = true; }
    if(touched) _repairRecord('authUsers', uid, a, up, 'authUsers/'+uid);
  });
  // Teléfono de WhatsApp (clave = nombre)
  if(phonesV && phonesV[oldName] !== undefined){
    up['globalCfg/localPhones/'+oldName] = null;
    up['globalCfg/localPhones/'+newName] = phonesV[oldName];
  }
  // Nodos indexados por restKey(nombre): hay que moverlos de clave
  if(oldKey !== newKey){
    Object.entries(schedV || {}).forEach(([sid, sh]) => {
      if(!sh) return;
      up['schedules/'+oldKey+'/'+sid] = null;
      up['schedules/'+newKey+'/'+sid] = {...sh, id: sh.id || sid, restaurant: newName};
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

// Agrupa las rutas en "unidades" que deben aplicarse juntas (un registro, o
// un movimiento de clave borrar+crear) para el modo registro-a-registro.
function _unitKey(path){
  const seg = path.split('/');
  if(['inventory','inventoryMovements','favorites'].includes(seg[0])) return seg[0];
  if(seg[0] === 'schedules') return 'schedules/'+seg[2];
  if(seg[0] === 'globalCfg') return 'globalCfg';
  return seg[0]+'/'+seg[1];
}
// 1º intenta todo de una vez (atómico). Si Firebase lo rechaza (normalmente
// por algún registro antiguo incompleto), aplica registro a registro y
// devuelve los que fallen. La lista de locales (globalCfg) se aplica la última.
async function _applyUpdatesRobust(up){
  try{
    await fbDb.ref().update(up);
    return {ok:true, failed:[]};
  }catch(e){
    const code = String(e.code || e.message || e);
    if(!/PERMISSION_DENIED|permission/i.test(code)) return {ok:false, error:code, failed:[]};
    console.warn('Actualización atómica rechazada; se aplica registro a registro', e);
  }
  const units = {};
  Object.entries(up).forEach(([p, v]) => { const k = _unitKey(p); (units[k] = units[k] || {})[p] = v; });
  const failed = [];
  const entries = Object.entries(units).filter(([k]) => k !== 'globalCfg');
  for(let i = 0; i < entries.length; i += 25){
    await Promise.all(entries.slice(i, i+25).map(([k, u]) =>
      fbDb.ref().update(u).catch(err => failed.push({path:k, reason:_describeFailure(k)}))));
  }
  if(units.globalCfg){
    try{ await fbDb.ref().update(units.globalCfg); }
    catch(e){ return {ok:false, error:'no se pudo guardar la lista de locales ('+(e.code||e.message||e)+')', failed}; }
  }
  return {ok:true, failed};
}
function _describeFailure(unitKey){
  const [col, key] = unitKey.split('/');
  let r = null;
  try{
    if(col === 'orders') r = orders.find(o => o.id === key || o._key === key);
    else if(col === 'albaranes') r = albNotes.find(a => a.id === key);
    else if(col === 'authUsers') r = (authUsers||{})[key];
    else if(col === 'wishlist') r = (wishlist||{})[key];
  }catch(e){}
  if(!r || !_REQUIRED_FIELDS[col]) return '';
  const miss = _REQUIRED_FIELDS[col].filter(f => r[f] === undefined || r[f] === null || r[f] === '');
  return miss.length ? 'le falta: '+miss.join(', ') : '';
}

/* ── Borrar ─────────────────────────────────────────────────────────────── */
async function deleteLocal(id){
  if(!_requireLocalesAdmin()) return;
  const u = cfg.users.find(x => x.id === id); if(!u) return;
  const name = u.restaurant;
  if(cfg.users.length <= 1){ toast('Debe quedar al menos un local', '#dc2626'); return; }

  const authV = await fbDb.ref('authUsers').once('value').then(s => s.val() || {}).catch(() => authUsers || {});
  const affected = Object.entries(authV).filter(([, a]) => a && (a.restaurant === name || _userRests(a).includes(name)));
  // Usuarios cuyo ÚNICO local es este: hay que reasignarlos antes
  const orphans = affected.filter(([, a]) => {
    const rs = _userRests(a).filter(r => r !== name);
    return rs.length === 0 && a.status !== 'rejected';
  });
  if(orphans.length){
    alert('No se puede borrar "'+name+'": estos usuarios solo tienen acceso a este local:\n\n'
      + orphans.map(([, a]) => '• '+(a.name || a.email)).join('\n')
      + '\n\nAsígnales otro local en "Solicitudes de acceso" (o recházalos) y vuelve a intentarlo.');
    return;
  }
  const _remaining = a => _userRests(a).filter(r => r !== name);
  const nKeep = affected.filter(([, a]) => _remaining(a).length).length;
  if(!confirm('¿Borrar el local "'+name+'"?\n\nDejará de aparecer en la app'
    + (nKeep ? ' y se quitará de '+nKeep+' usuario(s) que también tienen otros locales' : '')
    + '.\nLos pedidos, albaranes y demás datos antiguos se conservan.')) return;

  const up = {};
  affected.forEach(([uid, a]) => {
    const rs = _userRests(a).filter(r => r !== name);
    // Usuarios (rechazados) que se quedarían sin ningún local: no se tocan.
    // Firebase no admite `undefined` y además no tienen acceso a la app.
    if(!rs.length) return;
    up['authUsers/'+uid+'/restaurants'] = rs;
    if(a.restaurant === name) up['authUsers/'+uid+'/restaurant'] = rs[0];
    _repairRecord('authUsers', uid, a, up, 'authUsers/'+uid);
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
