/* NOVENTIA UI 6 — Visibility, suppliers analytics, inventory; no Consolidated */
(function(){
'use strict';
const h=v=>typeof escHtml==='function'?escHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>typeof fmt==='function'?fmt(parseFloat(v)||0):(parseFloat(v)||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const compact=v=>{const n=parseFloat(v)||0;return Math.abs(n)>=10000?(n/1000).toLocaleString('es-ES',{maximumFractionDigits:1})+' k€':money(n)};
window.nvUi6Normalize=function(){if(window.S&&S.adminTab==='consolidated')S.adminTab='pending'};
nvUi6Normalize();

/* Remove Consolidated defensively, including after every render. */
function removeConsolidated(){
  document.querySelectorAll(".sg-direct[onclick*=\"consolidated\"],button[onclick*=\"consolidated\"]").forEach(el=>el.remove());
  nvUi6Normalize();
}
new MutationObserver(removeConsolidated).observe(document.documentElement,{subtree:true,childList:true});
addEventListener('DOMContentLoaded',removeConsolidated);

/* SUPPLIER ANALYTICS */
window.nvSupSetPeriod=p=>{S.supHistPeriod=p;S.supHistOpen=null;renderAdminContent()};
window.nvSupToggle=id=>{S.supHistOpen=S.supHistOpen===id?null:id;renderAdminContent()};
window.nvSupSearch=v=>{S.supHistSearch=v;renderAdminContent()};
window.vSupHistory=function(){
  const all=orders.filter(o=>o.status==='approved'||o.status==='received');
  if(!S.supHistPeriod)S.supHistPeriod='all'; if(S.supHistSearch==null)S.supHistSearch='';
  const now=new Date(),mon=now.toISOString().slice(0,7),yr=now.toISOString().slice(0,4);
  const period=o=>S.supHistPeriod==='month'?String(o.createdAt||'').startsWith(mon):S.supHistPeriod==='year'?String(o.createdAt||'').startsWith(yr):true;
  const q=String(S.supHistSearch||'').toLowerCase().trim();
  const rows=supList().map(s=>{
    const os=all.filter(o=>o.supId===s.id&&period(o)); if(!os.length)return null;
    const spend=os.reduce((n,o)=>n+total(o),0), rests={},prods={};
    os.forEach(o=>{rests[o.restaurant]=(rests[o.restaurant]||0)+total(o);(o.items||[]).forEach(i=>{const k=i.name||'Producto';prods[k]??={name:k,qty:0,unit:i.unit||'',spend:0};prods[k].qty+=+i.qty||0;prods[k].spend+=(+i.qty||0)*(+i.price||0)})});
    const last=os.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];return {s,os,spend,rests,prods:Object.values(prods).sort((a,b)=>b.spend-a.spend),last};
  }).filter(Boolean).filter(x=>!q||String(x.s.name).toLowerCase().includes(q)).sort((a,b)=>b.spend-a.spend);
  const sum=rows.reduce((n,x)=>n+x.spend,0), count=rows.reduce((n,x)=>n+x.os.length,0),locals=new Set();rows.forEach(x=>Object.keys(x.rests).forEach(r=>locals.add(r)));const max=Math.max(1,...rows.map(x=>x.spend));
  const periodBtns=['all','month','year'].map(p=>`<button class="nv6-seg ${S.supHistPeriod===p?'act':''}" onclick="nvSupSetPeriod('${p}')">${{all:'Todo',month:'Este mes',year:'Este año'}[p]}</button>`).join('');
  const list=rows.map((x,i)=>{const open=S.supHistOpen===x.s.id;const detail=`<div class="nv6-sup-detail"><section><h3>Gasto por local</h3>${Object.entries(x.rests).sort((a,b)=>b[1]-a[1]).map(([r,v])=>{const p=x.spend?Math.round(v/x.spend*100):0;return `<div class="nv6-dist"><span><b>${h(r)}</b><small>${money(v)} · ${p}%</small></span><i><b style="width:${p}%"></b></i></div>`}).join('')}</section><section><h3>Productos principales</h3>${x.prods.slice(0,6).map(p=>`<div class="nv6-product"><span><b>${h(p.name)}</b><small>${p.qty%1===0?p.qty:p.qty.toFixed(1)} ${h(p.unit)}</small></span><strong>${money(p.spend)}</strong></div>`).join('')}</section></div>`;return `<article class="nv6-sup-row"><button onclick="nvSupToggle('${x.s.id}')"><em>${i+1}</em><span class="nv6-sup-name"><b>${h(x.s.name)}</b><small>${x.os.length} pedidos · ${Object.keys(x.rests).length} locales · Último ${fmtD(x.last.createdAt)}</small></span><i class="nv6-volume"><b style="width:${Math.max(2,x.spend/max*100)}%"></b></i><span class="nv6-amount"><b>${compact(x.spend)}</b><small>${{all:'Historial',month:'Mes',year:'Año'}[S.supHistPeriod]}</small></span><span class="nv6-plus">${open?'−':'+'}</span></button>${open?detail:''}</article>`}).join('');
  return `<div class="nv6-page"><header class="nv6-head"><span>Análisis de compras</span><h1>Compras por proveedor</h1><p>Volumen, concentración y productos principales</p></header><div class="nv6-toolbar"><div class="nv6-segments">${periodBtns}</div><input value="${h(S.supHistSearch)}" oninput="nvSupSearch(this.value)" placeholder="Buscar proveedor"></div><div class="nv6-kpis"><article><small>Gasto total</small><b>${money(sum)}</b></article><article><small>Proveedores activos</small><b>${rows.length}</b></article><article><small>Pedidos</small><b>${count}</b></article><article><small>Locales</small><b>${locals.size}</b></article></div><section class="nv6-list">${list||'<div class="nv6-empty">Sin resultados</div>'}</section></div>`;
};

/* VISIBILITY — two perspectives, no spreadsheet matrix */
window.nvVisMode=m=>{S.nvVisMode=m;S.nvVisSelected=null;renderAdminContent()};
window.nvVisSelect=id=>{S.nvVisSelected=id;renderAdminContent()};
window.nvVisSearch=v=>{S.nvVisSearch=v;renderAdminContent()};
window.nvVisOne=function(sid,uid,visible){toggleSupVisibility(sid,uid,visible);setTimeout(renderAdminContent,30)};
window.vSupVisibility=function(){
 const sups=supList(),users=(cfg.users||[]);if(!S.nvVisMode)S.nvVisMode='local';if(S.nvVisSearch==null)S.nvVisSearch='';
 const entities=S.nvVisMode==='local'?users:sups;let selected=S.nvVisSelected||entities[0]?.id;if(selected&&!entities.some(x=>x.id===selected))selected=entities[0]?.id;S.nvVisSelected=selected;
 const q=String(S.nvVisSearch).toLowerCase();const nav=entities.filter(x=>!q||String(S.nvVisMode==='local'?x.restaurant:x.name).toLowerCase().includes(q)).map(x=>{const name=S.nvVisMode==='local'?x.restaurant:x.name;const totalN=S.nvVisMode==='local'?sups.length:users.length;const active=S.nvVisMode==='local'?sups.filter(s=>!(s.disabledFor||[]).includes(x.id)).length:users.filter(u=>!(x.disabledFor||[]).includes(u.id)).length;return `<button class="${selected===x.id?'act':''}" onclick="nvVisSelect('${x.id}')"><span><b>${h(name)}</b><small>${active} de ${totalN} visibles</small></span><i>${selected===x.id?'›':''}</i></button>`}).join('');
 let cards=''; if(selected){if(S.nvVisMode==='local'){const u=users.find(x=>x.id===selected);cards=sups.map(s=>{const on=!(s.disabledFor||[]).includes(u.id);return `<article><span><b>${h(s.name)}</b><small>${(s.products||[]).length} productos</small></span><label class="nv6-switch"><input type="checkbox" ${on?'checked':''} onchange="nvVisOne('${s.id}','${u.id}',this.checked)"><i></i></label></article>`}).join('')}else{const s=sups.find(x=>x.id===selected);cards=users.map(u=>{const on=!(s.disabledFor||[]).includes(u.id);return `<article><span><b>${h(u.restaurant)}</b><small>${h(u.name||u.id)}</small></span><label class="nv6-switch"><input type="checkbox" ${on?'checked':''} onchange="nvVisOne('${s.id}','${u.id}',this.checked)"><i></i></label></article>`}).join('')}}
 const selectedName=S.nvVisMode==='local'?users.find(x=>x.id===selected)?.restaurant:sups.find(x=>x.id===selected)?.name;
 return `<div class="nv6-page"><header class="nv6-head"><span>Administración</span><h1>Visibilidad comercial</h1><p>Controla qué proveedores puede utilizar cada local</p></header><div class="nv6-segments nv6-mode"><button class="nv6-seg ${S.nvVisMode==='local'?'act':''}" onclick="nvVisMode('local')">Por local</button><button class="nv6-seg ${S.nvVisMode==='supplier'?'act':''}" onclick="nvVisMode('supplier')">Por proveedor</button></div><div class="nv6-master-detail"><aside><input placeholder="Buscar" value="${h(S.nvVisSearch)}" oninput="nvVisSearch(this.value)">${nav}</aside><section class="nv6-vis-panel"><header><div><small>${S.nvVisMode==='local'?'LOCAL':'PROVEEDOR'}</small><h2>${h(selectedName||'Sin selección')}</h2></div><div class="nv6-bulk"><button onclick="${S.nvVisMode==='local'?`svSetAllForLocal('${selected}',true)`:`svSetAllForSup('${selected}',true)`}">Activar todo</button><button onclick="${S.nvVisMode==='local'?`svSetAllForLocal('${selected}',false)`:`svSetAllForSup('${selected}',false)`}">Ocultar todo</button></div></header><div class="nv6-vis-cards">${cards||'<div class="nv6-empty">Sin elementos</div>'}</div></section></div></div>`;
};

/* INVENTORY — reconstructed as an ERP data grid */
window.nvInvSearch=v=>{S.invSearch=v;renderAdminContent()};window.nvInvStatus=v=>{S.nvInvStatus=v;renderAdminContent()};window.nvInvRest=v=>{S.invRest=v;S.invEditId=null;renderAdminContent()};
window.vInventario=function(){
 const rests=[...new Set((cfg.users||[]).flatMap(u=>u.restaurants||[u.restaurant]).filter(Boolean))].sort();const rest=S.invRest||rests[0]||'';S.invRest=rest;const items=getInvItems(rest);if(S.nvInvStatus==null)S.nvInvStatus='all';const q=String(S.invSearch||'').toLowerCase();
 const low=items.filter(x=>(+x.minStock||0)>0&&invItemQtyInBase(x)<=(+x.minStock||0));const value=items.reduce((n,x)=>n+invItemValue(x),0);const cats=new Set(items.map(x=>x.category||'Sin categoría'));
 const filtered=items.filter(x=>(!q||String(x.name||'').toLowerCase().includes(q)||String(x.category||'').toLowerCase().includes(q))&&(S.nvInvStatus!=='low'||low.includes(x)));
 const body=filtered.map(x=>{const qty=invItemQtyInBase(x),min=+x.minStock||0,isLow=min>0&&qty<=min,prod=findSupProdForInvItem(x),unit=prod?.unit||x.unit||'ud',val=invItemValue(x);return `<tr><td><b>${h(x.name)}</b><small>${h(x.category||'Sin categoría')}</small></td><td>${h(invItemQtysStr(x))}</td><td>${min} ${h(unit)}</td><td>${val?money(val):'—'}</td><td><span class="nv6-status ${isLow?'low':'ok'}">${isLow?'Stock bajo':'Correcto'}</span></td><td><button onclick="openInvForm('${h(rest).replace(/'/g,"\\'")}','${x.id}')">Editar</button></td></tr>`}).join('');
 const form=S.invEditId!==null?`<section class="nv6-inline-form"><header><h2>${S.invEditId==='new'?'Nuevo producto':'Editar producto'}</h2><button onclick="cancelInvForm()">Cerrar</button></header><div class="nv6-form-grid"><label>Nombre<input id="inv-form-name" value="${h(S.invForm.name||'')}"></label><label>Precio por unidad<input id="inv-form-price" type="number" step="0.01" value="${S.invForm.price??''}"></label><label>Stock mínimo<input id="inv-form-min" type="number" step="0.01" value="${S.invForm.minStock??''}"></label><label>Categoría<input id="inv-form-cat" value="${h(S.invForm.category||'')}"></label>${typeof _renderInvQtysForm==='function'?_renderInvQtysForm():''}</div><footer><button class="primary" onclick="submitInvForm('${h(rest).replace(/'/g,"\\'")}')">Guardar producto</button><button onclick="cancelInvForm()">Cancelar</button></footer></section>`:'';
 return `<div class="nv6-page"><header class="nv6-head nv6-head-actions"><div><span>Operaciones</span><h1>Inventario</h1><p>Existencias, valoración y alertas de stock</p></div><div><button onclick="importSupplierProducts('${h(rest).replace(/'/g,"\\'")}')">Importar catálogo</button><button class="primary" onclick="openInvForm('${h(rest).replace(/'/g,"\\'")}','new')">Nuevo producto</button></div></header><div class="nv6-toolbar"><select onchange="nvInvRest(this.value)">${rests.map(r=>`<option ${r===rest?'selected':''}>${h(r)}</option>`).join('')}</select><input value="${h(S.invSearch||'')}" oninput="nvInvSearch(this.value)" placeholder="Buscar producto o categoría"><div class="nv6-segments"><button class="nv6-seg ${S.nvInvStatus==='all'?'act':''}" onclick="nvInvStatus('all')">Todos</button><button class="nv6-seg ${S.nvInvStatus==='low'?'act':''}" onclick="nvInvStatus('low')">Stock bajo</button></div></div><div class="nv6-kpis"><article><small>Valor del stock</small><b>${money(value)}</b></article><article><small>Productos</small><b>${items.length}</b></article><article><small>Stock bajo</small><b>${low.length}</b></article><article><small>Categorías</small><b>${cats.size}</b></article></div>${form}<section class="nv6-table-wrap"><table><thead><tr><th>Producto</th><th>Existencias</th><th>Mínimo</th><th>Valor</th><th>Estado</th><th></th></tr></thead><tbody>${body||'<tr><td colspan="6" class="nv6-empty">Sin productos</td></tr>'}</tbody></table></section></div>`;
};
})();
