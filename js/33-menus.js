/* ═══════════════ MENÚS v2 (bloques: para todos / a compartir / a escoger) ═══════════════
   Un menú se compone de BLOQUES. Cada bloque tiene un tipo:
     fijo      → cada comensal toma todos los platos del bloque.
     compartir → 1 tanda de los platos cada N comensales (primeros al centro).
     escoger   → cada comensal elige UNA opción; se calcula el coste medio según
                 el reparto esperado (%) y el peor caso (todos piden la más cara).
   Los menús antiguos (lista plana de escandallos) se convierten al abrirlos:
   un bloque "para todos" por categoría, con el mismo coste que antes. */
const MEN_TIPOS={
  fijo:{l:'Para todos',ico:'👤',help:'Cada comensal toma todos los platos de este bloque'},
  compartir:{l:'A compartir',ico:'🍽',help:'Una tanda de platos cada N comensales (al centro de la mesa)'},
  escoger:{l:'A escoger',ico:'🔀',help:'Cada comensal elige una opción; el coste depende del reparto'}
};
let _menDraft=null;       // menú en edición
let _menGroupState=null;  // calculadora de grupo {menuId, personas, excl:Set, precio}

function menNormalize(m){
  if(!m) return null;
  if(Array.isArray(m.bloques)) return m;
  const byCat={};
  (m.escandallos||[]).forEach(id=>{
    const c=(_escAllData[id]&&_escAllData[id].categoria)||'Otros';
    (byCat[c]=byCat[c]||[]).push(id);
  });
  const bloques=Object.entries(byCat).map(([c,ids])=>({id:uid(),tipo:'fijo',titulo:c,porCada:4,opciones:ids.map(id=>({escId:id,peso:null}))}));
  return {...m,bloques,schema:1};
}
function menIsLegacy(m){ return m&&!Array.isArray(m.bloques); }

/* ── Cálculo de costes ─────────────────────────────────────────────── */
function menCalc(m,personas,excl){
  const N=Math.max(1,parseInt(personas)||1);
  const out={N,bloques:[],avgTotal:0,maxTotal:0};
  ((m&&m.bloques)||[]).forEach(b=>{
    const opts=(b.opciones||[]).filter(o=>_escAllData[o.escId]&&!(excl&&excl.has(o.escId)))
      .map(o=>({...o,nombre:_escAllData[o.escId].nombre||'',coste:escCosteTotal(_escAllData[o.escId])}));
    let avg=0,max=0,info='';
    if(opts.length){
      const sum=opts.reduce((s,o)=>s+o.coste,0);
      if(b.tipo==='compartir'){
        const k=Math.max(1,parseInt(b.porCada)||4);
        const tandas=Math.ceil(N/k);
        avg=max=sum*tandas;
        info=`${tandas} ${tandas===1?'tanda':'tandas'} (1 cada ${k})`;
      } else if(b.tipo==='escoger'){
        const hasPesos=opts.some(o=>parseFloat(o.peso)>0);
        const w=opts.map(o=>hasPesos?(parseFloat(o.peso)||0):1);
        const wt=w.reduce((s,x)=>s+x,0)||1;
        avg=N*opts.reduce((s,o,i)=>s+o.coste*w[i]/wt,0);
        max=N*Math.max(...opts.map(o=>o.coste));
        info=hasPesos?'reparto según %':'reparto a partes iguales';
      } else {
        avg=max=sum*N;
        info='× '+N+' comensales';
      }
    }
    out.bloques.push({b,opts,avg,max,info});
    out.avgTotal+=avg; out.maxTotal+=max;
  });
  out.avgPP=out.avgTotal/N; out.maxPP=out.maxTotal/N;
  return out;
}
function menSummaryRows(calc,pvp,fcObj){
  const r=[];
  r.push(['Coste por persona (medio)',escFmt(calc.avgPP)]);
  r.push(['Coste por persona (peor caso)',escFmt(calc.maxPP)]);
  r.push([`Coste total grupo (${calc.N} pers., medio)`,escFmt(calc.avgTotal)]);
  r.push([`Coste total grupo (${calc.N} pers., peor caso)`,escFmt(calc.maxTotal)]);
  const fo=parseFloat(fcObj)||30;
  r.push([`PVP sugerido por persona (FC ${fo}%)`,escFmt(calc.maxPP/(fo/100))]);
  if(pvp>0){
    r.push(['Food cost real (medio / peor)',`${(calc.avgPP/pvp*100).toFixed(1)}% / ${(calc.maxPP/pvp*100).toFixed(1)}%`]);
    r.push(['Margen total grupo (medio / peor)',`${escFmt((pvp-calc.avgPP)*calc.N)} / ${escFmt((pvp-calc.maxPP)*calc.N)}`]);
  }
  return r;
}

/* ── Listado ───────────────────────────────────────────────────────── */
function menRender(){
  const grid=document.getElementById('men-grid');
  if(!grid) return;
  const nLegacy=Object.values(_menAllData).filter(menIsLegacy).length;
  const bar=document.getElementById('men-legacy-bar');
  if(bar) bar.innerHTML=nLegacy?`<div class="men-legacy">⚠ Hay ${nLegacy} menú${nLegacy>1?'s':''} con el formato antiguo. Se ven bien, pero conviene convertirlos. <button class="btn btn-pri btn-xs" onclick="menMigrarTodos()">Convertir ahora</button></div>`:'';
  const txt=(document.getElementById('men-search')?.value||'').toLowerCase();
  const local=document.getElementById('men-local-filter')?.value||'';
  const entries=Object.entries(_menAllData).filter(([,m])=>
    (!txt||(m.nombre||'').toLowerCase().includes(txt))&&(!local||m.restaurante===local||(m.restaurante||'global')==='global')
  ).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||'','es'));
  if(!entries.length){
    grid.innerHTML='<p style="color:var(--mut)">No hay menús. Crea el primero con "+ Nuevo menú".</p>';
    return;
  }
  grid.innerHTML=entries.map(([id,m0])=>{
    const m=menNormalize(m0);
    const n=parseInt(m.personas)||10;
    const c=menCalc(m,n);
    const pvp=parseFloat(m.pvp)||0;
    const fcReal=pvp>0?c.avgPP/pvp*100:null;
    const fcCls=fcReal===null?'esc-ok':fcReal>35?'esc-bad':fcReal>30?'esc-warn':'esc-ok';
    const rest=m.restaurante||'global';
    const restBadge=rest==='global'
      ?`<span style="font-size:10px;background:#dbeafe;color:#1d4ed8;border-radius:10px;padding:1px 7px;font-weight:600">Global</span>`
      :`<span style="font-size:10px;background:#f3e8ff;color:#7c3aed;border-radius:10px;padding:1px 7px;font-weight:600">${escHtml(rest)}</span>`;
    const blocks=c.bloques.map(x=>{
      const t=MEN_TIPOS[x.b.tipo]||MEN_TIPOS.fijo;
      const dishes=x.opts.length?x.opts.map(o=>escHtml(o.nombre)).join(' · '):'—';
      return `<div class="men-course"><div class="men-course-title">${t.ico} ${escHtml(x.b.titulo||'Bloque')} <span class="men-tipo">${t.l}${x.b.tipo==='compartir'?' ÷'+(parseInt(x.b.porCada)||4):''}</span></div><div class="men-dish"><span class="men-dish-name">${dishes}</span></div></div>`;
    }).join('');
    return `<div class="men-card" onclick="menOpenModal('${id}')">
      <div class="men-card-hd">
        <div>
          <div class="men-card-name">${escHtml(m.nombre||'Sin nombre')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${restBadge}${m.notas?`<span style="font-size:11px;color:var(--mut)">${escHtml(m.notas)}</span>`:''}</div>
        </div>
        <div class="esc-fc-ind ${fcCls}" style="position:relative;top:0;right:0;flex-shrink:0">${fcReal!==null?fcReal.toFixed(0)+'%':'—'}</div>
      </div>
      <div class="men-courses">${blocks}</div>
      <div class="men-stats">
        <div class="men-stat"><div class="k">Coste/pers.</div><div class="v">${escFmt(c.avgPP)}</div></div>
        <div class="men-stat"><div class="k">Peor caso</div><div class="v">${escFmt(c.maxPP)}</div></div>
        <div class="men-stat"><div class="k">PVP</div><div class="v">${pvp>0?escFmt(pvp):'—'}</div></div>
        <div class="men-stat"><div class="k">Margen</div><div class="v">${pvp>0?escFmt(pvp-c.avgPP):'—'}</div></div>
      </div>
      <div style="padding:0 14px 12px">
        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="event.stopPropagation();menGroupOpen('${id}')">👥 Calcular para un grupo</button>
      </div>
    </div>`;
  }).join('');
}

/* ── Editor ────────────────────────────────────────────────────────── */
function menOpenModal(id=null){
  _menEditId=id;
  const src=id&&_menAllData[id]?menNormalize(_menAllData[id]):null;
  _menDraft=src?{
    nombre:src.nombre||'',restaurante:src.restaurante||'global',pvp:src.pvp||'',notas:src.notas||'',
    personas:parseInt(src.personas)||10,fcObj:parseFloat(src.fcObj)||30,
    bloques:JSON.parse(JSON.stringify(src.bloques||[]))
  }:{nombre:'',restaurante:'global',pvp:'',notas:'',personas:10,fcObj:30,bloques:[]};
  document.getElementById('men-modal-title').textContent=id?'Editar menú':'Nuevo menú';
  document.getElementById('men-btn-del').style.display=id?'':'none';
  document.getElementById('men-nombre').value=_menDraft.nombre;
  document.getElementById('men-local').value=_menDraft.restaurante;
  document.getElementById('men-pvp').value=_menDraft.pvp;
  document.getElementById('men-notas').value=_menDraft.notas;
  document.getElementById('men-personas').value=_menDraft.personas;
  document.getElementById('men-fcobj').value=_menDraft.fcObj;
  menRenderBloques();
  document.getElementById('men-modal-ov').style.display='flex';
}
function menCloseModal(){
  document.getElementById('men-modal-ov').style.display='none';
  _menEditId=null; _menDraft=null;
}
function menField(k,v){
  if(!_menDraft) return;
  if(k==='pvp') _menDraft.pvp=v;
  else if(k==='personas') _menDraft.personas=Math.max(1,parseInt(v)||1);
  else if(k==='fcObj') _menDraft.fcObj=parseFloat(v)||30;
  else _menDraft[k]=v;
  menRenderResumen();
}
function menAddBloque(tipo,titulo){
  _menDraft.bloques.push({id:uid(),tipo,titulo:titulo||'',porCada:4,opciones:[]});
  menRenderBloques();
}
function menDelBloque(bi){ _menDraft.bloques.splice(bi,1); menRenderBloques(); }
function menMoveBloque(bi,d){
  const j=bi+d, a=_menDraft.bloques;
  if(j<0||j>=a.length) return;
  [a[bi],a[j]]=[a[j],a[bi]];
  menRenderBloques();
}
function menSetTipo(bi,t){ _menDraft.bloques[bi].tipo=t; menRenderBloques(); }
function menSetBloque(bi,k,v){
  const b=_menDraft.bloques[bi]; if(!b) return;
  b[k]=k==='porCada'?Math.max(1,parseInt(v)||1):v;
  if(k==='porCada') menRenderResumen();
}
function menSetPeso(bi,oi,v){
  const o=_menDraft.bloques[bi]?.opciones[oi]; if(!o) return;
  const n=parseFloat(v); o.peso=isNaN(n)||n<=0?null:n;
  menRenderResumen();
}
function menDelOpcion(bi,oi){ _menDraft.bloques[bi].opciones.splice(oi,1); menRenderBloques(); }
function menAddOpcion(bi,escId){
  const b=_menDraft.bloques[bi]; if(!b||b.opciones.some(o=>o.escId===escId)) return;
  b.opciones.push({escId,peso:null});
  menRenderBloques();
  document.getElementById('men-q-'+bi)?.focus();
}
// Buscador de platos de cada bloque
function menDishSearch(bi,q){
  const dd=document.getElementById('men-dd-'+bi); if(!dd) return;
  const toks=escNorm(q).split(' ').filter(Boolean);
  const b=_menDraft.bloques[bi];
  const used=new Set((b.opciones||[]).map(o=>o.escId));
  const list=Object.entries(_escAllData).filter(([id,e])=>e&&e.nombre&&(e.tipo||'final')!=='intermedia'&&!used.has(id)
    &&toks.every(t=>escNorm(e.nombre+' '+(e.categoria||'')).includes(t)))
    .sort((a,b2)=>a[1].nombre.localeCompare(b2[1].nombre,'es')).slice(0,12);
  if(!list.length){ dd.innerHTML='<div class="pk-hint">Sin resultados</div>'; dd.style.display='block'; return; }
  dd.innerHTML=list.map(([id,e])=>`<div class="pk-row" onmousedown="menAddOpcion(${bi},'${id}')"><span class="pk-name">${escHtml(e.nombre)}</span><span class="pk-chip">${escHtml(e.categoria||'')}</span><span class="pk-price">${escFmt(escCosteTotal(e))}</span></div>`).join('');
  dd.style.display='block';
}
function menDishBlur(bi){
  setTimeout(()=>{
    if(document.activeElement&&document.activeElement.id==='men-q-'+bi) return; // sigue escribiendo
    const dd=document.getElementById('men-dd-'+bi); if(dd) dd.style.display='none';
  },160);
}

function menRenderBloques(){
  const cont=document.getElementById('men-bloques'); if(!cont||!_menDraft) return;
  if(!_menDraft.bloques.length){
    cont.innerHTML='<p style="color:var(--mut);font-size:13px">Añade bloques con los botones de abajo. Por ejemplo: <em>Primeros a compartir</em>, <em>Segundos a escoger</em>, <em>Postres a escoger</em>.</p>';
    menRenderResumen(); return;
  }
  cont.innerHTML=_menDraft.bloques.map((b,bi)=>{
    const t=MEN_TIPOS[b.tipo]||MEN_TIPOS.fijo;
    const seg=Object.entries(MEN_TIPOS).map(([k,v])=>`<button type="button" class="men-seg${k===b.tipo?' act':''}" onclick="menSetTipo(${bi},'${k}')" title="${escHtml(v.help)}">${v.ico} ${v.l}</button>`).join('');
    const hasPesos=(b.opciones||[]).some(o=>parseFloat(o.peso)>0);
    const rows=(b.opciones||[]).map((o,oi)=>{
      const e=_escAllData[o.escId];
      const missing=!e;
      return `<div class="men-opt${missing?' missing':''}">
        <span class="men-opt-name">${missing?'⚠ Plato eliminado':escHtml(e.nombre)}</span>
        <span class="pk-chip">${escHtml(e?e.categoria||'':'')}</span>
        <span class="pk-price">${e?escFmt(escCosteTotal(e)):'—'}</span>
        ${b.tipo==='escoger'?`<input type="number" class="men-peso" min="0" max="100" step="1" value="${o.peso||''}" placeholder="igual" title="% de comensales que lo pedirán (vacío = a partes iguales)" onchange="menSetPeso(${bi},${oi},this.value)"/><span class="pk-mut">%</span>`:''}
        <button class="btn btn-ghost btn-xs" onclick="menDelOpcion(${bi},${oi})">✕</button>
      </div>`;
    }).join('');
    const pesoAviso=b.tipo==='escoger'&&hasPesos?(()=>{ const tot=(b.opciones||[]).reduce((s,o)=>s+(parseFloat(o.peso)||0),0); return tot!==100?`<div class="men-warn">Los % suman ${Math.round(tot)}; se ajustan proporcionalmente.</div>`:''; })():'';
    return `<div class="men-bloque">
      <div class="men-bloque-hd">
        <input type="text" value="${escHtml(b.titulo||'')}" placeholder="Nombre del bloque (Primeros, Postres…)" oninput="menSetBloque(${bi},'titulo',this.value)" class="men-bloque-titulo"/>
        <div class="men-segs">${seg}</div>
        <button class="btn btn-ghost btn-xs" onclick="menMoveBloque(${bi},-1)" title="Subir">↑</button>
        <button class="btn btn-ghost btn-xs" onclick="menMoveBloque(${bi},1)" title="Bajar">↓</button>
        <button class="btn btn-ghost btn-xs" onclick="menDelBloque(${bi})" title="Eliminar bloque" style="color:#dc2626">✕</button>
      </div>
      <div class="pk-mut" style="font-size:12px;margin:2px 0 6px">${t.help}${b.tipo==='compartir'?` · <strong>1 tanda cada <input type="number" min="1" step="1" value="${b.porCada||4}" onchange="menSetBloque(${bi},'porCada',this.value)" class="men-porcada"/> comensales</strong>`:''}</div>
      ${rows||'<div class="pk-mut" style="font-size:12px;padding:4px 0">Sin platos todavía</div>'}
      ${pesoAviso}
      <div class="pk-wrap" style="margin-top:6px">
        <input type="text" id="men-q-${bi}" class="pk-input" autocomplete="off" placeholder="+ Añadir plato (escribe para buscar)…" oninput="menDishSearch(${bi},this.value)" onfocus="menDishSearch(${bi},this.value)" onblur="menDishBlur(${bi})"/>
        <div id="men-dd-${bi}" class="pk-dd" style="display:none"></div>
      </div>
    </div>`;
  }).join('');
  menRenderResumen();
}
function menRenderResumen(){
  const el=document.getElementById('men-resumen'); if(!el||!_menDraft) return;
  const c=menCalc(_menDraft,_menDraft.personas);
  const pvp=parseFloat(_menDraft.pvp)||0;
  el.innerHTML=menSummaryRows(c,pvp,_menDraft.fcObj).map(([k,v])=>`<div class="men-sum-r"><span>${k}</span><strong>${v}</strong></div>`).join('');
}

function _menBuildData(){
  const d=_menDraft;
  const bloques=d.bloques.map(b=>({
    id:b.id||uid(),tipo:b.tipo||'fijo',titulo:(b.titulo||'').trim()||(MEN_TIPOS[b.tipo]||MEN_TIPOS.fijo).l,
    porCada:Math.max(1,parseInt(b.porCada)||4),
    opciones:(b.opciones||[]).filter(o=>o.escId).map(o=>({escId:o.escId,peso:(parseFloat(o.peso)>0?parseFloat(o.peso):null)}))
  }));
  // Compatibilidad: la vista de los locales y otros lectores usan la lista plana
  const flat=[...new Set(bloques.flatMap(b=>b.opciones.map(o=>o.escId)))];
  return {
    nombre:(document.getElementById('men-nombre')?.value||'').trim(),
    restaurante:document.getElementById('men-local')?.value||'global',
    pvp:parseFloat(document.getElementById('men-pvp')?.value)||0,
    notas:(document.getElementById('men-notas')?.value||'').trim(),
    personas:Math.max(1,parseInt(d.personas)||10),
    fcObj:parseFloat(d.fcObj)||30,
    schema:2,bloques,escandallos:flat,updatedAt:Date.now()
  };
}
function menSave(){
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  if(!_menDraft) return;
  const data=_menBuildData();
  if(!data.nombre){toast('Escribe el nombre del menú','#dc2626');return;}
  const ref=_menEditId?fbDb.ref('menus/'+_menEditId):fbDb.ref('menus').push();
  if(!_menEditId) data.createdAt=Date.now();
  else if(_menAllData[_menEditId]?.createdAt) data.createdAt=_menAllData[_menEditId].createdAt;
  ref.set(data).then(()=>{menCloseModal();toast('Menú guardado','#16a34a');}).catch(e=>toast('Error: '+e.message,'#dc2626'));
}
function menDelete(){
  if(!_menEditId||!confirm('¿Eliminar este menú?')) return;
  fbDb.ref('menus/'+_menEditId).remove().then(()=>{menCloseModal();toast('Menú eliminado','#888');});
}

/* ── Migración de menús antiguos (con copia de seguridad) ──────────── */
function menMigrarTodos(){
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  const legacy=Object.entries(_menAllData).filter(([,m])=>menIsLegacy(m));
  if(!legacy.length){toast('No hay menús antiguos','#888');return;}
  if(!confirm(`Se convertirán ${legacy.length} menús al formato nuevo. Antes se descargará una copia de seguridad. El coste de cada menú no cambia. ¿Continuar?`)) return;
  try{
    const blob=new Blob([JSON.stringify(_menAllData,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='menus-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); a.remove();
  }catch(e){ toast('No se pudo crear la copia; migración cancelada','#dc2626'); return; }
  const updates={};
  legacy.forEach(([id,m])=>{
    const n=menNormalize(m);
    updates['menus/'+id]={
      nombre:m.nombre||'',restaurante:m.restaurante||'global',pvp:parseFloat(m.pvp)||0,notas:m.notas||'',
      personas:10,fcObj:30,schema:2,
      bloques:n.bloques.map(b=>({id:b.id,tipo:'fijo',titulo:b.titulo,porCada:4,opciones:b.opciones.map(o=>({escId:o.escId,peso:null}))})),
      escandallos:m.escandallos||[],createdAt:m.createdAt||Date.now(),updatedAt:Date.now()
    };
  });
  fbDb.ref().update(updates).then(()=>toast(`${legacy.length} menús convertidos`,'#16a34a')).catch(e=>toast('Error: '+e.message,'#dc2626'));
}

/* ── PDF del menú (desde el editor) ────────────────────────────────── */
function menExportPDF(){
  if(!_menDraft){return;}
  const d=_menBuildData();
  const c=menCalc(d,d.personas);
  if(!c.bloques.some(x=>x.opts.length)){toast('Añade platos antes de exportar','#dc2626');return;}
  const pvp=d.pvp;
  const rows=c.bloques.map(x=>{
    const t=MEN_TIPOS[x.b.tipo]||MEN_TIPOS.fijo;
    const dish=x.opts.map(o=>`<tr><td style="padding:4px 10px 4px 24px;font-size:12px;color:#555">${escHtml(o.nombre)}${x.b.tipo==='escoger'&&parseFloat(o.peso)>0?` <em>(${o.peso}%)</em>`:''}</td><td style="text-align:right;font-size:12px">${escFmt(o.coste)}</td></tr>`).join('');
    return `<tr style="background:#f0f4ff"><td style="padding:8px 10px;font-weight:700;font-size:13px">${escHtml(x.b.titulo)} <span style="font-size:11px;font-weight:400;color:#888">${t.l} · ${escHtml(x.info)}</span></td><td style="text-align:right;padding:8px 10px;font-weight:700;font-size:13px">${escFmt(x.avg)}</td></tr>${dish}`;
  }).join('');
  const sum=menSummaryRows(c,pvp,d.fcObj).map(([k,v])=>`<tr><td style="padding:6px 10px">${k}</td><td style="text-align:right;padding:6px 10px;font-weight:700">${v}</td></tr>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(d.nombre||'Menú')}</title>
  <style>body{font-family:Arial,sans-serif;padding:28px;color:#111;max-width:800px;margin:0 auto}h1{font-size:24px;margin-bottom:2px;color:#1a1a2e}.meta{color:#666;font-size:13px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-bottom:20px}td{border-bottom:1px solid #e5e7eb}@media print{body{padding:10px}}</style></head><body>
  <h1>🍽 ${escHtml(d.nombre||'Menú')}</h1>
  <div class="meta">${d.restaurante!=='global'?escHtml(d.restaurante)+' · ':''}Cálculo para ${c.N} comensales · ${new Date().toLocaleDateString('es-ES')}</div>
  <table>${rows}</table>
  <table>${sum}</table>
  ${d.notas?`<div style="padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px">${escHtml(d.notas)}</div>`:''}
  <script>window.onload=()=>{window.print()}<\/script></body></html>`;
  const w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Activa los popups para exportar el PDF','#d97706',4000);
}

/* ── Calculadora de grupo ──────────────────────────────────────────── */
function menGroupOpen(menuId){
  const m=menNormalize(_menAllData[menuId]);
  if(!m){ toast('Menú no encontrado','#dc2626'); return; }
  _menGroupState={menuId,personas:parseInt(m.personas)||10,excl:new Set(),precio:parseFloat(m.pvp)||0};
  menGroupRender();
  document.getElementById('men-group-ov').style.display='flex';
}
function menGroupClose(){ document.getElementById('men-group-ov').style.display='none'; _menGroupState=null; }
function menGroupSet(k,v){
  const st=_menGroupState; if(!st) return;
  if(k==='personas') st.personas=Math.max(1,parseInt(v)||1);
  else st.precio=parseFloat(v)||0;
  menGroupRender();
}
function menGroupToggle(escId){
  const st=_menGroupState; if(!st) return;
  if(st.excl.has(escId)) st.excl.delete(escId); else st.excl.add(escId);
  menGroupRender();
}
function menGroupRender(){
  const st=_menGroupState, body=document.getElementById('men-group-body');
  if(!st||!body) return;
  const m=menNormalize(_menAllData[st.menuId]);
  if(!m){ body.innerHTML='<p style="color:var(--mut)">Menú no encontrado.</p>'; return; }
  const c=menCalc(m,st.personas,st.excl);
  const blocks=(m.bloques||[]).map((b,bi)=>{
    const t=MEN_TIPOS[b.tipo]||MEN_TIPOS.fijo;
    const x=c.bloques[bi];
    const rows=(b.opciones||[]).filter(o=>_escAllData[o.escId]).map(o=>{
      const e=_escAllData[o.escId], on=!st.excl.has(o.escId);
      return `<label class="men-gopt"><input type="checkbox" ${on?'checked':''} onchange="menGroupToggle('${o.escId}')"/><span style="flex:1">${escHtml(e.nombre)}</span><span class="pk-mut">${escFmt(escCosteTotal(e))}</span></label>`;
    }).join('')||'<div class="pk-mut" style="font-size:12px">Sin platos</div>';
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-weight:700;font-size:13px;color:var(--pri)">${t.ico} ${escHtml(b.titulo||'Bloque')} <span class="men-tipo">${t.l}${b.tipo==='compartir'?' · 1 cada '+(parseInt(b.porCada)||4):''}</span></div><div style="font-size:12px"><strong>${escFmt(x.avg)}</strong>${x.max>x.avg+0.005?` <span class="pk-mut">(peor ${escFmt(x.max)})</span>`:''}</div></div>
      <div class="pk-mut" style="font-size:11px;margin-bottom:4px">${escHtml(x.info)}${b.tipo==='escoger'?' · desmarca las opciones que no estarán disponibles':''}</div>
      ${rows}</div>`;
  }).join('');
  const sum=menSummaryRows(c,st.precio,m.fcObj).map(([k,v])=>`<div class="men-sum-r"><span>${k}</span><strong>${v}</strong></div>`).join('');
  body.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="fg"><label>Nº de comensales</label><input type="number" min="1" step="1" value="${st.personas}" onchange="menGroupSet('personas',this.value)"/></div>
      <div class="fg"><label>Precio a cobrar por persona €</label><input type="number" min="0" step="0.01" value="${st.precio||''}" placeholder="0.00" onchange="menGroupSet('precio',this.value)"/></div>
    </div>
    ${blocks}
    <div class="men-resumen" style="margin-top:8px">${sum}</div>`;
}
