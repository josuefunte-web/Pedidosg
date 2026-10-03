/* ═══════════════ ESCANDALLOS: SELECTOR DE INGREDIENTES ═══════════════
   Un único buscador sobre TODOS los proveedores (más sub-elaboraciones e
   ingredientes libres). Se escribe "solomillo", se elige, se pone la cantidad
   (en g/ml si el producto va por KG/L) y Enter. */
let _escPick={q:'',res:[],idx:0,sel:null,open:false,alt:null};
let _escIdxCache=null;

function escNorm(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function escProdsOf(sup){
  if(!sup||!sup.products) return [];
  return Array.isArray(sup.products)?sup.products:Object.values(sup.products);
}
// Índice plano de productos de todos los proveedores
// Los escandallos se calculan siempre en KG: g, productos con peso declarado
// (pesoGr) y unidades con conversión a KG se pasan a precio por KG. Si no hay
// equivalencia fiable (UN sin peso, L...) se deja la unidad original.
function escKgPrice(p){
  const price=parseFloat(p.price)||0;
  const unit=String(p.unit||'u.').trim();
  const u=unit.toLowerCase().replace(/\./g,'');
  if(['kg','kgs','kilo','kilos'].includes(u)) return {price,unit:'KG'};
  if(['g','gr','gramo','gramos'].includes(u)) return {price:price*1000,unit:'KG'};
  const grams=parseFloat(p.pesoGr);
  if(grams>0) return {price:price/grams*1000,unit:'KG'};
  const conv=(p.conversions||[]).find(c=>String(c.fromUnit||'').toLowerCase()==='kg'&&parseFloat(c.factor)>0);
  if(conv) return {price:price*parseFloat(conv.factor),unit:'KG'};
  return {price,unit};
}
function escPickIndex(force){
  if(_escIdxCache&&!force) return _escIdxCache;
  const out=[];
  Object.entries(suppliers||{}).forEach(([pid,sup])=>{
    if(!sup) return;
    escProdsOf(sup).forEach(p=>{
      if(!p||!p.name) return;
      const kg=escKgPrice(p);
      out.push({kind:'prod',pid,sname:sup.name||pid,emoji:sup.emoji||'',prodId:p.id||p.name,prod:p,
        name:p.name,key:escNorm(p.name),snorm:escNorm(sup.name||pid),
        price:kg.price,unit:kg.unit,gr:p.pesoGr||''});
    });
  });
  _escIdxCache=out;
  return out;
}
// Dos nombres normalizados se consideran el mismo producto si las palabras
// significativas (>2 letras) de uno están contenidas en el otro.
function escSameProd(a,b){
  const ta=a.split(' ').filter(t=>t.length>2), tb=b.split(' ').filter(t=>t.length>2);
  if(!ta.length||!tb.length) return a===b;
  return ta.every(t=>tb.includes(t))||tb.every(t=>ta.includes(t));
}
function escUnitOpts(base){
  const u=String(base||'').toLowerCase().replace(/\./g,'').trim();
  if(u==='kg') return [{l:'KG',f:1},{l:'g',f:0.001}];
  if(u==='g'||u==='gr') return [{l:'g',f:1},{l:'KG',f:1000}];
  if(u==='l'||u==='lt') return [{l:'L',f:1},{l:'ml',f:0.001},{l:'cl',f:0.01}];
  if(u==='ml') return [{l:'ml',f:1},{l:'L',f:1000}];
  return [{l:base||'u.',f:1}];
}
function escFmtQty(n){ return String(Math.round((parseFloat(n)||0)*10000)/10000); }

function escPickSearch(q){
  const toks=escNorm(q).split(' ').filter(Boolean);
  let prods=[];
  if(toks.length){
    escPickIndex().forEach(it=>{
      const hay=it.key+' '+it.snorm;
      if(!toks.every(t=>hay.includes(t))) return;
      let sc=0;
      toks.forEach(t=>{ if(it.key.startsWith(t)) sc+=3; else if((' '+it.key).includes(' '+t)) sc+=2; else sc+=1; });
      prods.push({...it,sc:sc-it.key.length/100});
    });
    prods.sort((a,b)=>b.sc-a.sc||a.price-b.price);
    prods=prods.slice(0,30);
    // Marca el más barato cuando el mismo producto lo venden varios proveedores
    prods.forEach(p=>{
      const peers=prods.filter(x=>String(x.unit).toLowerCase()===String(p.unit).toLowerCase()&&escSameProd(p.key,x.key));
      if(peers.length<2||new Set(peers.map(x=>x.pid)).size<2) return;
      const min=Math.min(...peers.map(x=>x.price));
      if(p.price===min&&min>0) p.cheapest=true;
    });
  }
  const subs=[];
  if(toks.length){
    Object.entries(_escAllData||{}).forEach(([id,e])=>{
      if(id===_escEditId||!e||!e.nombre) return;
      const k=escNorm(e.nombre);
      if(!toks.every(t=>k.includes(t))) return;
      const rend=parseFloat(e.rendimiento)||1;
      subs.push({kind:'sub',escId:id,name:e.nombre,price:escCosteTotal(e)/rend,unit:e.rendimientoUnidad||'rac.',tipo:e.tipo||'final'});
    });
    subs.sort((a,b)=>(a.tipo==='intermedia'?0:1)-(b.tipo==='intermedia'?0:1)||a.name.localeCompare(b.name,'es'));
  }
  return {prods,subs:subs.slice(0,8)};
}

// Productos usados recientemente (solo comodidad, se guarda en el navegador)
function escRecentGet(){ try{ return JSON.parse(localStorage.getItem('esc_recent_ings')||'[]'); }catch(e){ return []; } }
function escRecentPush(pid,prodId){
  try{
    const k=pid+'|'+prodId;
    const l=escRecentGet().filter(x=>x!==k); l.unshift(k);
    localStorage.setItem('esc_recent_ings',JSON.stringify(l.slice(0,12)));
  }catch(e){}
}

function escPickInput(v){
  _escPick.q=v; _escPick.open=true; _escPick.idx=0; _escPick.sel=null;
  escPickBuildResults(); escPickRender(); escPickRenderStage();
}
function escPickBuildResults(){
  const q=_escPick.q.trim();
  const list=[];
  if(!q){
    const idx=escPickIndex();
    escRecentGet().forEach(k=>{
      const it=idx.find(x=>x.pid+'|'+x.prodId===k);
      if(it) list.push({...it,recent:true});
    });
  } else {
    const {prods,subs}=escPickSearch(q);
    prods.forEach(p=>list.push(p));
    subs.forEach(s=>list.push(s));
    list.push({kind:'free',name:q,price:0,unit:'u.'});
  }
  _escPick.res=list;
}
function escPickFocus(){
  if(_escPick.noOpen){ _escPick.noOpen=false; return; } // foco devuelto por código: no tapar la lista
  escPickIndex(true);
  _escPick.open=true;
  escPickBuildResults(); escPickRender();
}
function escPickBlur(){
  setTimeout(()=>{
    if(document.activeElement&&document.activeElement.id==='esc-pick-q') return; // ha vuelto al buscador
    _escPick.open=false; escPickRender();
  },160);
}
function escPickKey(ev){
  const n=_escPick.res.length;
  if(ev.key==='ArrowDown'){ ev.preventDefault(); _escPick.open=true; _escPick.idx=n?(_escPick.idx+1)%n:0; escPickRender(); }
  else if(ev.key==='ArrowUp'){ ev.preventDefault(); _escPick.idx=n?(_escPick.idx-1+n)%n:0; escPickRender(); }
  else if(ev.key==='Enter'){ ev.preventDefault(); if(n) escPickChoose(_escPick.idx); }
  else if(ev.key==='Escape'){ _escPick.open=false; escPickRender(); }
}
function escPickRender(){
  const dd=document.getElementById('esc-pick-dd'); if(!dd) return;
  if(!_escPick.open||!_escPick.res.length){
    dd.style.display='none';
    if(_escPick.open&&_escPick.q.trim()===''&&!_escPick.res.length){
      dd.innerHTML='<div class="pk-hint">Escribe el nombre del ingrediente (p.ej. "solomillo", "aceite oliva"). Buscamos en todos los proveedores a la vez.</div>';
      dd.style.display='block';
    }
    return;
  }
  const rows=_escPick.res.map((r,i)=>{
    const act=i===_escPick.idx?' act':'';
    if(r.kind==='free'){
      return `<div class="pk-row pk-free${act}" onmousedown="escPickChoose(${i})">➕ Usar «${escHtml(r.name)}» como ingrediente libre <span class="pk-mut">(sin proveedor)</span></div>`;
    }
    if(r.kind==='sub'){
      return `<div class="pk-row${act}" onmousedown="escPickChoose(${i})"><span class="pk-name">🔗 ${escHtml(r.name)}</span><span class="pk-chip pk-sub">${r.tipo==='intermedia'?'Elaboración intermedia':'Sub-elaboración'}</span><span class="pk-price">${escFmt(r.price)}/${escHtml(r.unit)}</span></div>`;
    }
    return `<div class="pk-row${act}" onmousedown="escPickChoose(${i})"><span class="pk-name">${escHtml(r.name)}${r.gr?` <span class="pk-mut">· ${r.gr}gr</span>`:''}</span><span class="pk-chip">${escHtml((r.emoji||'')+r.sname)}</span>${r.cheapest?'<span class="pk-best">✓ más barato</span>':''}${r.recent?'<span class="pk-mut">reciente</span>':''}<span class="pk-price">${escFmt(r.price)}/${escHtml(r.unit)}</span></div>`;
  }).join('');
  const head=_escPick.q.trim()?'':'<div class="pk-hint" style="padding-bottom:2px">Usados recientemente</div>';
  dd.innerHTML=head+rows;
  dd.style.display='block';
  const act=dd.querySelector('.pk-row.act'); if(act&&act.scrollIntoView) act.scrollIntoView({block:'nearest'});
}

function escPickChoose(i){
  const r=_escPick.res[i]; if(!r) return;
  _escPick.sel=r; _escPick.open=false;
  const q=document.getElementById('esc-pick-q'); if(q) q.value=r.name;
  escPickRender(); escPickRenderStage();
  document.getElementById('esc-pick-qty')?.focus();
}
function escPickCancel(){
  _escPick.sel=null; _escPick.q=''; _escPick.res=[];
  const q=document.getElementById('esc-pick-q'); if(q){ q.value=''; _escPick.noOpen=true; q.focus(); }
  escPickRenderStage();
}
function escPickReset(){
  _escPick={q:'',res:[],idx:0,sel:null,open:false,alt:null};
  _escIdxCache=null;
  const q=document.getElementById('esc-pick-q'); if(q) q.value='';
  escPickRender(); escPickRenderStage();
}
// Ficha del ingrediente elegido: cantidad, unidad, merma
function escPickRenderStage(){
  const st=document.getElementById('esc-pick-stage'); if(!st) return;
  const s=_escPick.sel;
  if(!s){ st.style.display='none'; st.innerHTML=''; return; }
  let unitSel='', priceIn='', info='';
  if(s.kind==='prod'){
    const opts=escUnitOpts(s.unit);
    const def=opts.length>1&&opts[1].f<1?1:0;
    unitSel=`<select id="esc-pick-unit" onchange="escPickPreview()">${opts.map((o,k)=>`<option value="${o.f}"${k===def?' selected':''}>${escHtml(o.l)}</option>`).join('')}</select>`;
    info=`<span class="pk-chip">${escHtml((s.emoji||'')+s.sname)}</span><span class="pk-mut">${escFmt(s.price)}/${escHtml(s.unit)}</span>`;
  } else if(s.kind==='sub'){
    unitSel=`<span class="pk-mut">${escHtml(s.unit)}</span>`;
    info=`<span class="pk-chip pk-sub">Sub-elaboración</span><span class="pk-mut">${escFmt(s.price)}/${escHtml(s.unit)}</span>`;
  } else {
    unitSel=`<select id="esc-pick-unit" onchange="escPickPreview()"><option>u.</option><option>KG</option><option>g</option><option>L</option><option>ml</option></select>`;
    priceIn=`<input type="number" id="esc-pick-price" min="0" step="0.01" placeholder="€ por unidad" oninput="escPickPreview()"/>`;
    info='<span class="pk-chip">Libre</span>';
  }
  st.style.display='block';
  st.innerHTML=`<div class="pk-stage-hd"><strong>${escHtml(s.name)}</strong>${info}<button class="btn btn-ghost btn-xs" onclick="escPickCancel()" title="Cancelar">✕</button></div>
  <div class="pk-stage-row">
    <input type="number" id="esc-pick-qty" min="0" step="0.001" placeholder="Cantidad" oninput="escPickPreview()" onkeydown="if(event.key==='Enter'){event.preventDefault();escPickAdd();}"/>
    ${unitSel}
    ${priceIn}
    <input type="number" id="esc-pick-merma" min="0" max="99" step="1" placeholder="Merma %" title="% de desperdicio" onkeydown="if(event.key==='Enter'){event.preventDefault();escPickAdd();}"/>
    <button class="btn btn-pri btn-sm" onclick="escPickAdd()">Añadir ↵</button>
  </div>
  <div id="esc-pick-prev" class="pk-mut" style="margin-top:5px;font-size:12px"></div>`;
}
function _escPickCalc(){
  const s=_escPick.sel; if(!s) return null;
  const qty=parseFloat(document.getElementById('esc-pick-qty')?.value)||0;
  const f=parseFloat(document.getElementById('esc-pick-unit')?.value)||1;
  const merma=Math.max(0,Math.min(99,parseFloat(document.getElementById('esc-pick-merma')?.value)||0));
  const price=s.kind==='free'?(parseFloat(document.getElementById('esc-pick-price')?.value)||0):s.price;
  const base=s.kind==='prod'?qty*f:qty;
  const factor=merma>0?1/(1-merma/100):1;
  return {qty,f,merma,price,base,coste:base*price*factor};
}
function escPickPreview(){
  const c=_escPickCalc(); const el=document.getElementById('esc-pick-prev'); if(!c||!el) return;
  el.textContent=c.base>0?`Coste de esta línea: ${escFmt(c.coste)}`:'';
}
function escPickAdd(){
  const s=_escPick.sel; if(!s) return;
  const c=_escPickCalc();
  if(!c.qty||c.qty<=0){ toast('Introduce una cantidad válida','#dc2626'); document.getElementById('esc-pick-qty')?.focus(); return; }
  if(s.kind==='prod'){
    _escIngs.push({proveedorId:s.pid,proveedorNombre:s.sname,productoId:s.prodId,nombre:s.name,cantidad:c.base,unidad:s.unit,precioUnitario:s.price,merma:c.merma});
    escRecentPush(s.pid,s.prodId);
  } else if(s.kind==='sub'){
    _escIngs.push({type:'subesc',escId:s.escId,proveedorId:null,proveedorNombre:'Sub-elaboración',productoId:s.escId,nombre:s.name,cantidad:c.qty,unidad:s.unit,precioUnitario:0,merma:c.merma});
  } else {
    const u=document.getElementById('esc-pick-unit')?.selectedOptions[0]?.textContent||'u.';
    _escIngs.push({proveedorId:null,proveedorNombre:'Libre',productoId:null,nombre:s.name,cantidad:c.qty,unidad:u,precioUnitario:c.price,merma:c.merma});
  }
  _escPick.sel=null; _escPick.q=''; _escPick.res=[];
  const q=document.getElementById('esc-pick-q'); if(q){ q.value=''; }
  escPickRenderStage(); escRenderIngs(); escRecalc();
  if(q){ _escPick.noOpen=true; q.focus(); }
}

/* ── Cambiar de proveedor desde la propia fila ─────────────────────── */
function escAltsFor(ing){
  if(ing.type||!ing.proveedorId) return [];
  const key=escNorm(ing.nombre); if(!key) return [];
  const u=String(ing.unidad||'').toLowerCase();
  return escPickIndex().filter(it=>{
    if(it.pid===ing.proveedorId&&it.prodId===ing.productoId) return false;
    if(String(it.unit).toLowerCase()!==u) return false;
    return escSameProd(key,it.key);
  }).sort((a,b)=>a.price-b.price).slice(0,8);
}
function escAltToggle(i){ _escPick.alt=_escPick.alt===i?null:i; escRenderIngs(); }
function escAltSwap(i,j){
  const ing=_escIngs[i]; if(!ing) return;
  const it=escAltsFor(ing)[j]; if(!it) return;
  ing.proveedorId=it.pid; ing.proveedorNombre=it.sname; ing.productoId=it.prodId; ing.nombre=it.name; ing.precioUnitario=it.price;
  _escPick.alt=null; escRenderIngs(); escRecalc();
}
