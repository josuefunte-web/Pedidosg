/* ═══════════════════════════════════════════════════════════════════════
   COMPARAR PRECIOS — NOVENTIA 2026
   Implementación directa. Sin overlays, sin Firebase writes y sin fuzzy matching.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

function initCmpState(){
  if(S.cmpSearch===undefined) S.cmpSearch='';
  if(S.cmpCat===undefined) S.cmpCat='';
  if(S.cmpSup===undefined) S.cmpSup='';
  if(S.cmpKind===undefined) S.cmpKind='all';
  if(S.cmpSort===undefined) S.cmpSort='saving';
  if(!S.cmpOpen) S.cmpOpen={};
}
function cmpName(value){
  return String(value==null?'':value).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}
function cmpProducts(sup){
  var value=sup&&sup.products;
  return Array.isArray(value)?value:Object.values(value||{});
}
function cmpUnit(value){
  var u=String(value||'').trim().toUpperCase();
  if(u==='KGS'||u==='KILO'||u==='KILOS') return 'KG';
  if(u==='LT'||u==='LITRO'||u==='LITROS') return 'L';
  if(u==='GR'||u==='GRAMO'||u==='GRAMOS') return 'G';
  return u;
}
/* Comparación conservadora. No inventa conversiones.
   - KG y L ya contienen precio base.
   - g se normaliza a KG.
   - pesoGr permite normalizar envases/unidades a KG.
   - Las conversiones del proyecto expresan unidades de pedido respecto a la
     unidad base del precio; si la unidad base ya es KG/L no se necesitan aquí.
   - Cajas/UN/Botes sin peso inequívoco quedan fuera de la comparación. */
function cmpNormalizeOffer(product){
  var price=parseFloat(product&&product.price), rawUnit=String(product&&product.unit||'').trim();
  if(!Number.isFinite(price)||price<=0) return {ok:false,reason:'Sin precio válido'};
  if(!rawUnit) return {ok:false,reason:'Sin unidad'};
  var unit=cmpUnit(rawUnit);
  if(unit==='KG') return {ok:true,baseUnit:'KG',price:price,method:'Precio base'};
  if(unit==='L') return {ok:true,baseUnit:'L',price:price,method:'Precio base'};
  if(unit==='G') return {ok:true,baseUnit:'KG',price:price*1000,method:'Conversión g → KG'};
  var grams=parseFloat(product.pesoGr);
  if(Number.isFinite(grams)&&grams>0){
    return {ok:true,baseUnit:'KG',price:(price/grams)*1000,method:'Peso declarado'};
  }
  return {ok:false,reason:'Falta conversión inequívoca a KG o L'};
}
function cmpBuildGroups(){
  var map={};
  (typeof supList==='function'?supList():[]).forEach(function(sup){
    cmpProducts(sup).forEach(function(product){
      var key=cmpName(product&&product.name); if(!key) return;
      if(!map[key]) map[key]={key:key,name:String(product.name||''),category:product.category||product.cat||'Otros',offers:[]};
      var norm=cmpNormalizeOffer(product);
      map[key].offers.push({
        supId:String(sup.id||''),supName:String(sup.name||''),product:product,
        rawPrice:parseFloat(product.price),rawUnit:String(product.unit||''),
        ok:norm.ok,reason:norm.reason||'',baseUnit:norm.baseUnit||'',
        normPrice:norm.price,method:norm.method||''
      });
    });
  });
  return Object.values(map).map(function(group){
    var byFamily={};
    group.offers.filter(function(o){return o.ok;}).forEach(function(o){(byFamily[o.baseUnit]||(byFamily[o.baseUnit]=[])).push(o);});
    var families=Object.keys(byFamily).sort(function(a,b){return byFamily[b].length-byFamily[a].length;});
    group.baseUnit=families[0]||'';
    group.comparable=(byFamily[group.baseUnit]||[]).slice().sort(function(a,b){return a.normPrice-b.normPrice;});
    group.comparable.forEach(function(o){o.inFamily=true;});
    group.offers.forEach(function(o){if(o.ok&&!o.inFamily)o.reason='Unidad base distinta';});
    group.best=group.comparable[0]||null; group.worst=group.comparable[group.comparable.length-1]||null;
    group.min=group.best?group.best.normPrice:null; group.max=group.worst?group.worst.normPrice:null;
    group.diff=group.min!=null&&group.max!=null?group.max-group.min:0;
    group.pct=group.min>0?group.diff/group.min*100:0;
    group.hasSaving=group.comparable.length>=2&&group.diff>0.0001;
    group.single=group.offers.length===1;
    return group;
  });
}
function cmpFiltered(groups){
  var q=cmpName(S.cmpSearch), cat=S.cmpCat||'', sid=S.cmpSup||'', kind=S.cmpKind||'all';
  var rows=groups.filter(function(g){
    if(q&&cmpName(g.name).indexOf(q)<0) return false;
    if(cat&&(g.category||'Otros')!==cat) return false;
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
function cmpKpi(label,value,hint){return '<article class="cmp26-kpi"><small>'+escHtml(label)+'</small><strong>'+value+'</strong>'+(hint?'<span>'+escHtml(hint)+'</span>':'')+'</article>';}
function cmpDetail(group){
  var offers=group.offers.slice().sort(function(a,b){
    if(a.inFamily!==b.inFamily) return a.inFamily?-1:1;
    return (a.normPrice||Infinity)-(b.normPrice||Infinity);
  });
  var rows=offers.map(function(o){
    var best=group.best===o;
    var normalized=o.inFamily?fmt(o.normPrice)+' / '+escHtml(o.baseUnit):'—';
    var delta=o.inFamily&&group.min!=null?fmt(o.normPrice-group.min):'—';
    var state=best?'<span class="cmp26-state best">Mejor opción</span>':o.inFamily?'<span class="cmp26-state">Comparable</span>':'<span class="cmp26-state warn">'+escHtml(o.reason||'No comparable')+'</span>';
    return '<tr class="'+(best?'is-best':'')+'"><td><b>'+escHtml(o.supName)+'</b></td><td class="num">'+(Number.isFinite(o.rawPrice)?fmt(o.rawPrice):'—')+' / '+escHtml(o.rawUnit)+'</td><td class="num">'+normalized+'</td><td class="num">'+delta+'</td><td>'+state+'</td></tr>';
  }).join('');
  var note=group.comparable.length<2?'<p class="cmp26-note">No hay dos ofertas normalizadas en la misma unidad base. NOVENTIA no declara un ganador cuando faltan conversiones fiables.</p>':'';
  return '<div class="cmp26-detail">'+note+'<table><thead><tr><th>Proveedor</th><th class="num">Precio original</th><th class="num">Precio normalizado</th><th class="num">Δ vs mejor</th><th>Estado</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function cmpRow(group){
  var open=!!S.cmpOpen[group.key], best=group.best;
  return '<article class="cmp26-row">'+
    '<button class="cmp26-summary" onclick="cmpToggle(\''+escAttr(group.key)+'\')">'+
      '<span class="cmp26-product"><b>'+escHtml(group.name)+'</b><small>'+escHtml(group.category||'Otros')+'</small></span>'+
      '<span class="cmp26-best">'+(best?'<b>'+fmt(group.min)+' / '+escHtml(group.baseUnit)+'</b><small>'+escHtml(best.supName)+'</small>':'<b>—</b><small>Sin precio comparable</small>')+'</span>'+
      '<span class="cmp26-num">'+(group.max!=null?fmt(group.max):'—')+'</span>'+
      '<span class="cmp26-num '+(group.hasSaving?'saving':'')+'">'+(group.hasSaving?fmt(group.diff):'—')+'</span>'+
      '<span class="cmp26-num '+(group.hasSaving?'saving':'')+'">'+(group.hasSaving?group.pct.toFixed(1)+'%':'—')+'</span>'+
      '<span class="cmp26-offers">'+group.comparable.length+' / '+group.offers.length+'</span>'+
      '<span class="cmp26-toggle">'+(open?'−':'+')+'</span>'+
    '</button>'+(open?cmpDetail(group):'')+'</article>';
}
function vCompare(){
  initCmpState();
  var suppliers=typeof supList==='function'?supList():[];
  if(!suppliers.length) return '<div class="cmp26-empty"><b>Sin proveedores</b><span>Añade proveedores para empezar a comparar.</span></div>';
  var groups=cmpBuildGroups(), rows=cmpFiltered(groups);
  var comparable=groups.filter(function(g){return g.comparable.length>=2;}), opportunities=comparable.filter(function(g){return g.hasSaving;});
  var saving=opportunities.reduce(function(sum,g){return sum+g.diff;},0);
  var cats=Array.from(new Set(groups.map(function(g){return g.category||'Otros';}))).sort();
  var filters='<div class="cmp26-filters">'+
    '<input class="cmp26-search" value="'+escAttr(S.cmpSearch)+'" oninput="cmpSearch(this.value)" placeholder="Buscar producto">'+
    '<select onchange="cmpCat(this.value)"><option value="">Todas las categorías</option>'+cats.map(function(c){return '<option value="'+escAttr(c)+'" '+(S.cmpCat===c?'selected':'')+'>'+escHtml(c)+'</option>';}).join('')+'</select>'+
    '<select onchange="cmpSup(this.value)"><option value="">Todos los proveedores</option>'+suppliers.map(function(s){return '<option value="'+escAttr(s.id)+'" '+(S.cmpSup===s.id?'selected':'')+'>'+escHtml(s.name)+'</option>';}).join('')+'</select>'+
    '<div class="cmp26-tabs">'+[['all','Todos'],['saving','Con ahorro'],['single','Sin alternativa']].map(function(x){return '<button class="'+(S.cmpKind===x[0]?'act':'')+'" onclick="cmpKind(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div>'+
    '<select onchange="cmpSort(this.value)"><option value="saving" '+(S.cmpSort==='saving'?'selected':'')+'>Mayor ahorro</option><option value="pct" '+(S.cmpSort==='pct'?'selected':'')+'>Mayor diferencia %</option><option value="price" '+(S.cmpSort==='price'?'selected':'')+'>Menor precio</option><option value="name" '+(S.cmpSort==='name'?'selected':'')+'>Nombre</option></select></div>';
  return '<div class="cmp26-page"><header class="cmp26-head"><span>Análisis de compras</span><h1>Comparar precios</h1><p>Detecta el mejor proveedor y las principales oportunidades de ahorro por unidad comparable.</p></header>'+
    '<section class="cmp26-kpis">'+cmpKpi('Productos comparables',String(comparable.length))+cmpKpi('Diferencia acumulada',saving>0?fmt(saving):'—','Suma de diferencias por unidad base')+cmpKpi('Proveedores analizados',String(suppliers.length))+cmpKpi('Oportunidades',String(opportunities.length))+'</section>'+filters+
    '<div class="cmp26-caption">'+rows.length+' productos mostrados · '+groups.length+' productos analizados</div>'+
    '<section class="cmp26-list"><div class="cmp26-columns"><span>Producto</span><span>Mejor opción</span><span>Precio mayor</span><span>Δ €</span><span>Δ %</span><span>Comp./total</span><span></span></div>'+ (rows.map(cmpRow).join('')||'<div class="cmp26-empty"><b>Sin resultados</b><span>Prueba con otros filtros.</span></div>')+'</section></div>';
}
function rerenderCmp(){if(typeof renderAdminContent==='function') renderAdminContent();}
window.cmpSearch=function(v){S.cmpSearch=v;rerenderCmp();var e=document.querySelector('.cmp26-search');if(e){e.focus();try{e.setSelectionRange(v.length,v.length);}catch(_){}}};
window.cmpCat=function(v){S.cmpCat=v;rerenderCmp();};
window.cmpSup=function(v){S.cmpSup=v;rerenderCmp();};
window.cmpKind=function(v){S.cmpKind=v;rerenderCmp();};
window.cmpSort=function(v){S.cmpSort=v;rerenderCmp();};
window.cmpToggle=function(k){S.cmpOpen[k]?delete S.cmpOpen[k]:S.cmpOpen[k]=true;rerenderCmp();};
window.cmpNormalizeProductName=cmpName;
window.vCompare=vCompare;
})();
