/* ═══════════════ VISIBILIDAD DE PROVEEDORES POR LOCAL ═══════════════ */
// Pantalla dedicada para editar de un vistazo qué proveedores ve cada local.
// Antes esto solo se podía tocar entrando al proveedor uno por uno; aquí se
// muestra una matriz (proveedores en filas × locales en columnas) con
// checkboxes en cada cruce — igual que la vista clásica de permisos en una
// hoja de cálculo. Un ✓ = ese local ve ese proveedor; sin ✓ = está oculto.
// La fuente de verdad sigue siendo `sup.disabledFor=[userId,...]` y se
// modifica reutilizando `toggleSupVisibility(sid,uid,visible)` de
// js/23-suppliers.js — nada nuevo que sincronizar con Firebase.

function svSetAllForSup(sid, visible){
  const users=cfg.users||[];
  users.forEach(u=>toggleSupVisibilityQuiet(sid,u.id,visible));
  saveSups(sid);
  toast(visible?'Proveedor visible para todos los locales':'Proveedor oculto para todos los locales','#16a34a');
  renderAdminContent();
}
function svSetAllForLocal(uid, visible){
  const sups=supList();
  sups.forEach(s=>toggleSupVisibilityQuiet(s.id,uid,visible));
  // Guardar todos los proveedores tocados de una vez
  if(fbDb) fbDb.ref('suppliers').set(suppliers);
  const localName=(cfg.users.find(u=>u.id===uid)||{}).restaurant||uid;
  toast(visible?`Todos los proveedores activos para ${localName}`:`Todos los proveedores ocultos para ${localName}`,'#16a34a');
  renderAdminContent();
}
// Versión sin guardar/toast — solo muta en memoria (para hacer un solo guardado al final)
function toggleSupVisibilityQuiet(sid,uid,visible){
  if(!suppliers[sid]) return;
  if(!suppliers[sid].disabledFor) suppliers[sid].disabledFor=[];
  if(visible){ suppliers[sid].disabledFor=suppliers[sid].disabledFor.filter(id=>id!==uid); }
  else { if(!suppliers[sid].disabledFor.includes(uid)) suppliers[sid].disabledFor.push(uid); }
}

function vSupVisibility(){
  const sups=supList(), users=(cfg.users||[]).slice();
  if(!S.supVisMode) S.supVisMode='local';
  if(S.supVisSearch==null) S.supVisSearch='';
  const mode=S.supVisMode, entities=mode==='local'?users:sups;
  if(!S.supVisSelected||!entities.some(x=>x.id===S.supVisSelected)) S.supVisSelected=entities[0]?.id||null;
  const selected=S.supVisSelected, query=String(S.supVisSearch||'').trim().toLowerCase();
  const nav=entities.filter(x=>!query||String(mode==='local'?x.restaurant:x.name).toLowerCase().includes(query)).map(x=>{
    const name=mode==='local'?x.restaurant:x.name, totalN=mode==='local'?sups.length:users.length;
    const active=mode==='local'?sups.filter(s=>!(s.disabledFor||[]).includes(x.id)).length:users.filter(u=>!(x.disabledFor||[]).includes(u.id)).length;
    return `<button class="${selected===x.id?'act':''}" onclick="S.supVisSelected='${x.id}';renderAdminContent()"><span><b>${escHtml(name||'')}</b><small>${active} de ${totalN} visibles</small></span><i>${selected===x.id?'›':''}</i></button>`;
  }).join('');
  let cards='', selectedName='Sin selección', bulkOn='', bulkOff='';
  if(selected&&mode==='local'){
    const u=users.find(x=>x.id===selected); selectedName=u?.restaurant||selected; bulkOn=`svSetAllForLocal('${selected}',true)`;bulkOff=`svSetAllForLocal('${selected}',false)`;
    cards=sups.map(s=>{const visible=!(s.disabledFor||[]).includes(u.id);return `<article><span><b>${escHtml(s.name||'')}</b><small>${(s.products||[]).length} productos</small></span><label class="nv-e-switch"><input type="checkbox" ${visible?'checked':''} onchange="toggleSupVisibility('${s.id}','${u.id}',this.checked);setTimeout(renderAdminContent,30)"><i></i></label></article>`}).join('');
  }else if(selected){
    const s=sups.find(x=>x.id===selected); selectedName=s?.name||selected; bulkOn=`svSetAllForSup('${selected}',true)`;bulkOff=`svSetAllForSup('${selected}',false)`;
    cards=users.map(u=>{const visible=!(s.disabledFor||[]).includes(u.id);return `<article><span><b>${escHtml(u.restaurant||'')}</b><small>${escHtml(u.name||u.id)}</small></span><label class="nv-e-switch"><input type="checkbox" ${visible?'checked':''} onchange="toggleSupVisibility('${s.id}','${u.id}',this.checked);setTimeout(renderAdminContent,30)"><i></i></label></article>`}).join('');
  }
  return `<div class="nv-e-page"><header class="nv-e-head"><span>Administración</span><h1>Visibilidad comercial</h1><p>Configura qué proveedores puede utilizar cada local</p></header><div class="nv-e-segments nv-e-mode"><button class="nv-e-seg ${mode==='local'?'act':''}" onclick="S.supVisMode='local';S.supVisSelected=null;renderAdminContent()">Por local</button><button class="nv-e-seg ${mode==='supplier'?'act':''}" onclick="S.supVisMode='supplier';S.supVisSelected=null;renderAdminContent()">Por proveedor</button></div><div class="nv-e-master"><aside><input value="${escHtml(S.supVisSearch)}" oninput="S.supVisSearch=this.value;renderAdminContent()" placeholder="Buscar">${nav}</aside><section class="nv-e-vis"><header><div><small>${mode==='local'?'LOCAL':'PROVEEDOR'}</small><h2>${escHtml(selectedName)}</h2></div><div><button onclick="${bulkOn}">Activar todo</button><button onclick="${bulkOff}">Ocultar todo</button></div></header><div class="nv-e-vis-grid">${cards||'<div class="nv-e-empty">Sin elementos</div>'}</div></section></div></div>`;
}
