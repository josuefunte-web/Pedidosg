/* ═══════════════════════════════════════════════════════════════════════
   COMPARAR PRECIOS — NOVENTIA FIX
   Vista reconstruida en tarjetas/lista responsive. Sin matriz comprimida.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
function initState(){
  if(S.cmpSearch===undefined) S.cmpSearch='';
  if(S.cmpCat===undefined) S.cmpCat='';
  if(S.cmpSup===undefined) S.cmpSup='';
  if(S.cmpKind===undefined) S.cmpKind='all';
  if(S.cmpSort===undefined) S.cmpSort='saving';
  if(!S.cmpOpen) S.cmpOpen={};
}
function e(v){return typeof escHtml==='function'?escHtml(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
function a(v){return typeof escAttr==='function'?escAttr(v):e(v);}
function money(n){return typeof fmt==='function'?fmt(n):(parseFloat(n)||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';}
function normName(v){return String(v==null?'':v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
function productArray(sup){var p=sup&&sup.products;return Array.isArray(p)?p:Object.values(p||{});}
function unitOf(v){var u=String(v||'').trim().toUpperCase();if(['KGS','KILO','KILOS'].indexOf(u)>=0)return 'KG';if(['LT','LITRO','LITROS'].indexOf(u)>=0)return 'L';if(['GR','GRAMO','GRAMOS'].indexOf(u)>=0)return 'G';return u;}
function normalizeOffer(prod){
  var price=parseFloat(prod&&prod.price), rawUnit=String(prod&&prod.unit||'').trim();
  if(!Number.isFinite(price)||price<=0) return {ok:false,reason:'Sin precio comparable'};
  if(!rawUnit) return {ok:false,reason:'Sin unidad'};
  var u=unitOf(rawUnit);
  if(u==='KG') return {ok:true,baseUnit:'KG',price:price,method:'Precio / KG'};
  if(u==='L') return {ok:true,baseUnit:'L',price:price,method:'Precio / L'};
  if(u==='G') return {ok:true,baseUnit:'KG',price:price*1000,method:'g → KG'};
  var grams=parseFloat(prod.pesoGr);
  if(Number.isFinite(grams)&&grams>0) return {ok:true,baseUnit:'KG',price:(price/grams)*1000,method:'pesoGr'};
  return {ok:false,reason:'Falta conversión a KG/L'};
}
function buildGroups(){
  var map={};
  (typeof supList==='function'?supList():[]).forEach(function(sup){
    productArray(sup).forEach(function(prod){
      var key=normName(prod&&prod.name); if(!key) return;
      if(!map[key]) map[key]={key:key,name:String(prod.name||''),cat:prod.category||prod.cat||'Otros',offers:[]};
      var n=normalizeOffer(prod);
      map[key].offers.push({supId:String(sup.id||''),supName:String(sup.name||''),rawPrice:parseFloat(prod.price),rawUnit:String(prod.unit||''),ok:n.ok,reason:n.reason||'',baseUnit:n.baseUnit||'',normPrice:n.price,method:n.method||''});
    });
  });
  return Object.values(map).map(function(g){
    var families={};
    g.offers.filter(function(o){return o.ok;}).forEach(function(o){(families[o.baseUnit]||(families[o.baseUnit]=[])).push(o);});
    var fam=Object.keys(families).sort(function(x,y){return families[y].length-families[x].length;})[0]||'';
    g.baseUnit=fam;
    g.comp=(families[fam]||[]).slice().sort(function(x,y){return x.normPrice-y.normPrice;});
    g.comp.forEach(function(o){o.inFamily=true;});
    g.offers.forEach(function(o){if(o.ok&&!o.inFamily)o.reason='Unidad base distinta';});
    g.best=g.comp[0]||null; g.worst=g.comp[g.comp.length-1]||null;
    g.min=g.best?g.best.normPrice:null; g.max=g.worst?g.worst.normPrice:null;
    g.diff=(g.min!=null&&g.max!=null)?g.max-g.min:0;
    g.pct=g.min>0?(g.diff/g.min*100):0;
    g.hasSaving=g.comp.length>=2&&g.diff>0.0001;
    g.single=g.offers.length===1;
    return g;
  });
}
function filterGroups(groups){
  var q=normName(S.cmpSearch), cat=S.cmpCat||'', sid=S.cmpSup||'', kind=S.cmpKind||'all';
  var rows=groups.filter(function(g){
    if(q&&normName(g.name).indexOf(q)<0) return false;
    if(cat&&(g.cat||'Otros')!==cat) return false;
    if(sid&&!g.offers.some(function(o){return o.supId===sid;})) return false;
    if(kind==='saving'&&!g.hasSaving) return false;
    if(kind==='single'&&!g.single) return false;
    return true;
  });
  rows.sort(function(a,b){
    if(S.cmpSort==='name') return a.name.localeCompare(b.name,'es');
    if(S.cmpSort==='price') return (a.min==null?Infinity:a.min)-(b.min==null?Infinity:b.min);
    if(S.cmpSort==='pct') return b.pct-a.pct;
    return b.diff-a.diff;
  });
  return rows;
}
function kpi(label,value,hint){return '<article class="cmpx-kpi"><small>'+e(label)+'</small><b>'+value+'</b>'+(hint?'<span>'+e(hint)+'</span>':'')+'</article>';}
function chip(label,value,cls){return '<span class="cmpx-chip '+(cls||'')+'"><small>'+e(label)+'</small><b>'+value+'</b></span>';}
function detail(g){
  var rows=g.offers.slice().sort(function(a,b){if(a.inFamily!==b.inFamily)return a.inFamily?-1:1;return (a.normPrice||Infinity)-(b.normPrice||Infinity);}).map(function(o){
    var best=g.best===o;
    return '<div class="cmpx-offer '+(best?'best':'')+'"><div><b>'+e(o.supName)+'</b><small>'+e(o.method||o.reason||'')+'</small></div><div class="num">'+(Number.isFinite(o.rawPrice)?money(o.rawPrice):'—')+' / '+e(o.rawUnit||'')+'</div><div class="num">'+(o.inFamily?money(o.normPrice)+' / '+e(o.baseUnit):'—')+'</div><div class="num">'+(o.inFamily&&g.min!=null?money(o.normPrice-g.min):'—')+'</div><div>'+(best?'<span class="cmpx-state ok">Mejor</span>':o.inFamily?'<span class="cmpx-state">Comparable</span>':'<span class="cmpx-state warn">'+e(o.reason||'No comparable')+'</span>')+'</div></div>';
  }).join('');
  var note=g.comp.length<2?'<p class="cmpx-note">No se comparan ofertas con unidades incompatibles o sin conversión fiable.</p>':'';
  return '<div class="cmpx-detail">'+note+'<div class="cmpx-offer-head"><span>Proveedor</span><span>Original</span><span>Normalizado</span><span>Δ</span><span>Estado</span></div>'+rows+'</div>';
}
function row(g){
  var open=!!S.cmpOpen[g.key], best=g.best;
  var bestHtml=best?'<b>'+money(g.min)+' / '+e(g.baseUnit)+'</b><small>'+e(best.supName)+'</small>':'<b>—</b><small>Sin precio comparable</small>';
  return '<article class="cmpx-card '+(open?'open':'')+'"><button class="cmpx-main" onclick="cmpToggle(\''+a(g.key)+'\')"><div class="cmpx-name"><b>'+e(g.name)+'</b><small>'+e(g.cat||'Otros')+'</small></div><div class="cmpx-best">'+bestHtml+'</div><div class="cmpx-metrics">'+chip('Mayor',g.max!=null?money(g.max):'—')+chip('Δ €',g.hasSaving?money(g.diff):'—',g.hasSaving?'save':'')+chip('Δ %',g.hasSaving?g.pct.toFixed(1)+'%':'—',g.hasSaving?'save':'')+chip('Ofertas',g.comp.length+' / '+g.offers.length)+'</div><span class="cmpx-plus">'+(open?'−':'+')+'</span></button>'+(open?detail(g):'')+'</article>';
}
function vCompare(){
  initState();
  var suppliers=typeof supList==='function'?supList():[];
  var groups=buildGroups();
  var rows=filterGroups(groups);
  var comparable=groups.filter(function(g){return g.comp.length>=2;});
  var opportunities=comparable.filter(function(g){return g.hasSaving;});
  var saving=opportunities.reduce(function(n,g){return n+g.diff;},0);
  var cats=Array.from(new Set(groups.map(function(g){return g.cat||'Otros';}))).sort();
  var filters='<section class="cmpx-filters"><input class="cmpx-search" value="'+a(S.cmpSearch)+'" oninput="cmpSearch(this.value)" placeholder="Buscar producto"><select onchange="cmpCat(this.value)"><option value="">Todas las categorías</option>'+cats.map(function(c){return '<option value="'+a(c)+'" '+(S.cmpCat===c?'selected':'')+'>'+e(c)+'</option>';}).join('')+'</select><select onchange="cmpSup(this.value)"><option value="">Todos los proveedores</option>'+suppliers.map(function(s){return '<option value="'+a(s.id)+'" '+(S.cmpSup===s.id?'selected':'')+'>'+e(s.name)+'</option>';}).join('')+'</select><div class="cmpx-tabs">'+[['all','Todos'],['saving','Con ahorro'],['single','Sin alternativa']].map(function(x){return '<button class="'+(S.cmpKind===x[0]?'act':'')+'" onclick="cmpKind(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div><select onchange="cmpSort(this.value)"><option value="saving" '+(S.cmpSort==='saving'?'selected':'')+'>Mayor ahorro</option><option value="pct" '+(S.cmpSort==='pct'?'selected':'')+'>Mayor diferencia %</option><option value="price" '+(S.cmpSort==='price'?'selected':'')+'>Menor precio</option><option value="name" '+(S.cmpSort==='name'?'selected':'')+'>Nombre</option></select></section>';
  return '<div class="cmpx-page"><header class="cmpx-head"><span>Análisis de compras</span><h1>Comparar precios</h1><p>Mejor proveedor, diferencias y ofertas no comparables sin comprimir columnas.</p></header><section class="cmpx-kpis">'+kpi('Productos comparables',String(comparable.length))+kpi('Diferencia acumulada',saving>0?money(saving):'—','Suma Δ por unidad base')+kpi('Proveedores',String(suppliers.length))+kpi('Oportunidades',String(opportunities.length))+'</section>'+filters+'<div class="cmpx-count">'+rows.length+' mostrados · '+groups.length+' analizados</div><section class="cmpx-list">'+(rows.map(row).join('')||'<div class="cmpx-empty"><b>Sin resultados</b><span>Prueba con otros filtros.</span></div>')+'</section></div>';
}
function rerender(){if(typeof renderAdminContent==='function')renderAdminContent();}
window.cmpSearch=function(v){S.cmpSearch=v;rerender();var el=document.querySelector('.cmpx-search');if(el){el.focus();try{el.setSelectionRange(v.length,v.length);}catch(_){}}};
window.cmpCat=function(v){S.cmpCat=v;rerender();};
window.cmpSup=function(v){S.cmpSup=v;rerender();};
window.cmpKind=function(v){S.cmpKind=v;rerender();};
window.cmpSort=function(v){S.cmpSort=v;rerender();};
window.cmpToggle=function(k){if(!S.cmpOpen)S.cmpOpen={};S.cmpOpen[k]?delete S.cmpOpen[k]:S.cmpOpen[k]=true;rerender();};
window.vCompare=vCompare;
window.cmpNormalizeProductName=normName;
})();
