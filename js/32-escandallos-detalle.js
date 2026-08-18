/* ═══════════════ VISTA DETALLE (ficha visual) ═══════════════ */
const ESC_PIE_COLORS=['#7c3aed','#3b82f6','#16a34a','#f59e0b','#ef4444','#06b6d4','#a855f7','#84cc16','#ec4899','#64748b','#0ea5e9','#d97706','#14b8a6','#f43f5e'];
function escPesoInfo(e){
  let g=0; const sin=[];
  (e.ingredientes||[]).forEach(ing=>{
    const u=String(ing.unidad||'').toLowerCase().trim();
    const q=parseFloat(ing.cantidad)||0;
    if(ing.type==='subesc'||ing.type==='fracsubesc'){ sin.push(ing.nombre); return; }
    if(u==='g'||u==='gr'||u==='gramo'||u==='gramos') g+=q;
    else if(u==='kg') g+=q*1000;
    else if(u==='ml') g+=q;
    else if(u==='l'||u==='litro'||u==='litros') g+=q*1000;
    else {
      const sup=ing.proveedorId&&suppliers[ing.proveedorId];
      const prod=sup&&(Array.isArray(sup.products)?sup.products:Object.values(sup.products||{})).find(p=>p.id===ing.productoId);
      if(prod&&parseFloat(prod.pesoGr)>0) g+=q*parseFloat(prod.pesoGr);
      else sin.push(ing.nombre);
    }
  });
  return {kg:g/1000, sin};
}
function escIngAler(ing){
  if(!ing.proveedorId) return [];
  const sup=suppliers[ing.proveedorId]; if(!sup) return [];
  const prod=(Array.isArray(sup.products)?sup.products:Object.values(sup.products||{})).find(p=>p.id===ing.productoId);
  if(!prod||!prod.alergenos) return [];
  return prod.alergenos.map(a=>{const x=ALERGENOS.find(z=>z.id===a);return x?x.label:a;});
}
function escPieSVG(segs){
  const r=72,cx=80,cy=80; let a=-Math.PI/2; let paths='';
  const tot=segs.reduce((s,x)=>s+x.pct,0)||1;
  const real=segs.filter(s=>s.pct>0);
  if(real.length===1){ return `<svg viewBox="0 0 160 160" width="160" height="160"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${real[0].color}"/></svg>`; }
  segs.forEach(sg=>{
    if(sg.pct<=0) return;
    const ang=(sg.pct/tot)*Math.PI*2;
    const x1=cx+r*Math.cos(a), y1=cy+r*Math.sin(a);
    a+=ang;
    const x2=cx+r*Math.cos(a), y2=cy+r*Math.sin(a);
    const large=ang>Math.PI?1:0;
    paths+=`<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${sg.color}"/>`;
  });
  return `<svg viewBox="0 0 160 160" width="160" height="160">${paths}</svg>`;
}
function escDetailHtml(id){
  const e=_escAllData[id]; if(!e) return '';
  const ings=e.ingredientes||[];
  const ingCostes=ings.map(escCosteFactor);
  const coste=ingCostes.reduce((s,c)=>s+c,0);
  const rend=parseFloat(e.rendimiento)||1;
  const rendU=e.rendimientoUnidad||'rac.';
  const costeRac=rend>0?coste/rend:coste;
  const iva=e.iva!==undefined?e.iva:10;
  const pvp=parseFloat(e.precioVenta)||0;
  const ivaFactor=1+(iva/100);
  const pvpSinIva=pvp>0?pvp/ivaFactor:0;
  const fcReal=pvpSinIva>0?(coste/pvpSinIva*100):null;
  const fcObj=parseFloat(e.foodCostObjetivo)||30;
  const fcColor=fcReal===null?'var(--mut)':fcReal<=fcObj?'#16a34a':fcReal<=fcObj+5?'#d97706':'#dc2626';
  const peso=escPesoInfo(e);
  const tipoBadge=(e.tipo||'final')==='intermedia'
    ?'<span style="font-size:10px;background:#f3e8ff;color:#7c3aed;border-radius:10px;padding:2px 9px;font-weight:700">Intermedia</span>'
    :'<span style="font-size:10px;background:#dbeafe;color:#1d4ed8;border-radius:10px;padding:2px 9px;font-weight:700">Final</span>';
  // Filas de composición
  const rows=ings.map((ing,i)=>{
    const col=ESC_PIE_COLORS[i%ESC_PIE_COLORS.length];
    const isSub=ing.type==='subesc'||ing.type==='fracsubesc';
    const qtyStr=ing.type==='fracsubesc'?escFraccionTexto(ing.fraccion||ing.cantidad):`${ing.cantidad} ${ing.unidad||''}`;
    const aler=escIngAler(ing);
    const icon=isSub
      ?`<span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${col};margin-right:7px;flex-shrink:0"></span>`
      :`<span class="escd-dot" style="background:${col}"></span>`;
    return `<tr>
      <td class="qty">${qtyStr}</td>
      <td><div style="display:flex;align-items:flex-start">${icon}<div><div style="font-weight:600;color:var(--txt)">${ing.nombre||''}${isSub?' <span style="color:#7c3aed;font-size:10px;font-weight:700">[intermedia]</span>':''}</div>${aler.length?`<div style="margin-top:2px">${aler.map(a=>`<span class="escd-aler">${a}</span>`).join('')}</div>`:''}</div></div></td>
      <td class="cost">${escFmt(ingCostes[i])}</td>
    </tr>`;
  }).join('');
  // Pie + leyenda
  const segs=ings.map((ing,i)=>({pct:coste>0?ingCostes[i]/coste*100:0,color:ESC_PIE_COLORS[i%ESC_PIE_COLORS.length],label:ing.nombre||''}));
  const legend=segs.map(s=>s).sort((a,b)=>b.pct-a.pct).map(s=>`<div class="lr"><span class="escd-dot" style="background:${s.color}"></span><span class="nm">${s.label}</span><span class="pc">${s.pct.toFixed(1)}%</span></div>`).join('');
  const pie=coste>0?escPieSVG(segs):'<div style="color:var(--mut);font-size:13px;text-align:center;padding:20px">Sin coste</div>';
  // Alérgenos globales
  const alerGlobal=alergenosFromIngs(ings).map(aid=>{const x=ALERGENOS.find(z=>z.id===aid);return x?x.label:aid;});
  const noPeso=peso.sin.length?`<div style="font-size:12px;color:var(--mut);margin-top:4px"><strong>No tienen peso:</strong> ${peso.sin.join(', ')}</div>`:'';
  return `<div class="escd-wrap">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:2px">
      <button class="btn btn-ghost btn-sm" onclick="escBackToList()">← Volver</button>
      <div style="flex:1"></div>
      <button class="btn btn-ghost btn-sm" onclick="escDetailPDF('${id}')">PDF</button>
      <button class="btn btn-pri btn-sm" onclick="escOpenModal('${id}')">Editar</button>
    </div>
    <div class="escd-head">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:4px">${tipoBadge}<span style="font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.5px">${e.categoria||''}</span><span style="font-size:11px;color:var(--mut)">${e.restaurante==='global'||!e.restaurante?'Global':e.restaurante}</span></div>
      <h2 class="escd-title">${e.nombre||'Sin nombre'}</h2>
      <div style="font-size:13px;color:var(--mut)">${rend} ${rendU}</div>
      <div class="escd-kpis">
        <div class="escd-kpi"><div class="k">Coste total</div><div class="v">${escFmt(coste)}</div></div>
        <div class="escd-kpi"><div class="k">Coste / ${rendU}</div><div class="v">${escFmt(costeRac)}</div></div>
        <div class="escd-kpi"><div class="k">Peso</div><div class="v">${peso.kg>0?peso.kg.toFixed(3)+' Kg':'—'}</div></div>
        <div class="escd-kpi"><div class="k">IVA</div><div class="v">${iva}%</div></div>
        ${pvp>0?`<div class="escd-kpi"><div class="k">PVP</div><div class="v">${escFmt(pvp)}</div></div>
        <div class="escd-kpi"><div class="k">Food cost</div><div class="v" style="color:${fcColor}">${fcReal!==null?fcReal.toFixed(1)+'%':'—'}</div></div>`:''}
      </div>
      ${noPeso}
      ${alerGlobal.length?`<div style="margin-top:8px">${alerGlobal.map(a=>`<span class="escd-aler">${a}</span>`).join('')}</div>`:''}
    </div>
    <div class="escd-grid">
      <div class="escd-card">
        <h4>Composición</h4>
        <table class="escd-comp">
          <thead><tr><th style="width:90px">Cantidad</th><th>Composición</th><th style="text-align:right">Coste</th></tr></thead>
          <tbody>${rows||'<tr><td colspan="3" style="color:var(--mut)">Sin ingredientes</td></tr>'}</tbody>
          <tfoot><tr><td></td><td style="font-weight:800;text-align:right;padding-top:10px">TOTAL</td><td class="cost" style="padding-top:10px;font-size:15px">${escFmt(coste)}</td></tr></tfoot>
        </table>
      </div>
      <div class="escd-card">
        <h4>Distribución del coste</h4>
        <div style="display:flex;justify-content:center">${pie}</div>
        <div class="escd-legend">${legend}</div>
      </div>
    </div>
    ${escRecetaHtml(e,id)}
  </div>`;
}
function escRecetaHtml(e,id){
  const elab=e.elaboracion||{texto:'',pasos:[]};
  const secciones=(e.recetaSecciones||[]).filter(s=>(s.titulo&&s.titulo.trim())||(s.ingredientes||[]).some(i=>i.nombre&&i.nombre.trim())||(s.pasos||[]).some(p=>p&&p.trim()));
  const pasosGen=(elab.pasos||[]).filter(p=>p&&p.trim());
  const tieneAlgo=(elab.texto&&elab.texto.trim())||pasosGen.length||secciones.length;
  const paso=(p,i)=>`<div style="display:flex;gap:10px;margin-bottom:8px;align-items:flex-start"><span style="min-width:22px;height:22px;border-radius:50%;background:var(--pri);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span><span style="font-size:13px;line-height:1.6;color:var(--txt);padding-top:2px">${p}</span></div>`;
  let body='';
  if(!tieneAlgo){
    body=`<div style="color:var(--mut);font-size:13px">Sin elaboración. Pulsa <strong>Editar</strong> y rellena la sección "Receta" para añadir la elaboración.</div>`;
  } else {
    if(elab.texto&&elab.texto.trim()) body+=`<p style="font-size:13px;line-height:1.7;color:var(--txt);margin-bottom:12px;white-space:pre-wrap">${elab.texto}</p>`;
    if(pasosGen.length) body+=`<div style="margin-bottom:12px">${pasosGen.map(paso).join('')}</div>`;
    body+=secciones.map(sec=>{
      const ings=(sec.ingredientes||[]).filter(i=>i.nombre&&i.nombre.trim());
      const pasos=(sec.pasos||[]).filter(p=>p&&p.trim());
      const ingsHtml=ings.length?`<ul style="margin:0 0 10px 18px;padding:0">${ings.map(i=>`<li style="font-size:13px;line-height:1.6;color:var(--txt)">${[i.cantidad,i.unidad,i.nombre].filter(Boolean).join(' ')}${i.nota?` <span style="color:var(--mut);font-style:italic">(${i.nota})</span>`:''}</li>`).join('')}</ul>`:'';
      return `<div style="margin-bottom:14px">${sec.titulo&&sec.titulo.trim()?`<div style="font-size:13px;font-weight:800;color:var(--pri);margin-bottom:8px">${sec.titulo}</div>`:''}${ingsHtml}${pasos.map(paso).join('')}</div>`;
    }).join('');
  }
  return `<div class="escd-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h4 style="margin:0">📖 Receta / Elaboración</h4>
      <button class="btn btn-ghost btn-sm" onclick="escOpenModal('${id}')">${tieneAlgo?'Editar':'+ Añadir elaboración'}</button>
    </div>
    ${body}
  </div>`;
}
function escShowDetail(id){
  const e=_escAllData[id]; if(!e) return;
  S._escDetailId=id;
  const dw=document.getElementById('esc-detail-wrap'); if(!dw) return;
  const lw=document.getElementById('esc-list-wrap'); if(lw) lw.style.display='none';
  const ov=document.getElementById('esc-modal-ov'); if(ov) ov.style.display='none';
  dw.style.display='block';
  dw.innerHTML=escDetailHtml(id);
  window.scrollTo(0,0);
}
function escBackToList(){
  S._escDetailId=null;
  const dw=document.getElementById('esc-detail-wrap'); if(dw){ dw.style.display='none'; dw.innerHTML=''; }
  const ov=document.getElementById('esc-modal-ov'); if(ov) ov.style.display='none';
  const lw=document.getElementById('esc-list-wrap'); if(lw) lw.style.display='';
  escRender();
}
function escPdfSection(e,pageBreak){
  const ings=e.ingredientes||[];
  const ingCostes=ings.map(escCosteFactor);
  const coste=ingCostes.reduce((s,c)=>s+c,0);
  const rend=parseFloat(e.rendimiento)||1;
  const rendU=e.rendimientoUnidad||'rac.';
  const costeRac=rend>0?coste/rend:coste;
  const iva=e.iva!==undefined?e.iva:10;
  const pvp=parseFloat(e.precioVenta)||0;
  const ivaFactor=1+(iva/100);
  const pvpSinIva=pvp>0?pvp/ivaFactor:0;
  const fcReal=pvpSinIva>0?(coste/pvpSinIva*100):null;
  const fcObj=parseFloat(e.foodCostObjetivo)||30;
  const fcColor=fcReal===null?'#64748b':fcReal<=fcObj?'#16a34a':fcReal<=fcObj+5?'#d97706':'#dc2626';
  const peso=escPesoInfo(e);
  const ACCENT='#1a1a2e';
  const segs=ings.map((ing,i)=>({pct:coste>0?ingCostes[i]/coste*100:0,color:ESC_PIE_COLORS[i%ESC_PIE_COLORS.length],label:ing.nombre||''}));
  const pie=coste>0?escPieSVG(segs):'';
  const legend=segs.slice().sort((a,b)=>b.pct-a.pct).map(s=>`<div style="display:flex;align-items:center;gap:7px;font-size:12px;margin-bottom:4px"><span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block"></span><span style="flex:1">${s.label}</span><span style="color:#64748b;font-weight:700">${s.pct.toFixed(1)}%</span></div>`).join('');
  const rows=ings.map((ing,i)=>{
    const isSub=ing.type==='subesc'||ing.type==='fracsubesc';
    const qtyStr=ing.type==='fracsubesc'?escFraccionTexto(ing.fraccion||ing.cantidad):`${ing.cantidad} ${ing.unidad||''}`;
    const aler=escIngAler(ing);
    return `<tr style="background:${i%2?'#f8fafc':'#fff'}">
      <td style="padding:7px 10px;font-size:12px;color:#475569;white-space:nowrap;border-bottom:1px solid #f1f5f9;font-weight:700">${qtyStr}</td>
      <td style="padding:7px 10px;font-size:12px;color:#0f172a;border-bottom:1px solid #f1f5f9">${ing.nombre||''}${isSub?' <span style="color:#7c3aed;font-size:10px">[intermedia]</span>':''}${aler.length?`<br><span style="font-size:9px;color:#856404">${aler.join(', ')}</span>`:''}</td>
      <td style="padding:7px 10px;font-size:12px;font-weight:700;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9">${escFmt(ingCostes[i])}</td>
    </tr>`;
  }).join('');
  const kpis=[['Coste total',escFmt(coste),'#0f172a'],['Coste / '+rendU,escFmt(costeRac),'#0f172a'],['Peso',peso.kg>0?peso.kg.toFixed(3)+' Kg':'—','#0f172a'],['IVA',iva+'%','#0f172a']];
  if(pvp>0){ kpis.push(['PVP',escFmt(pvp),'#0f172a']); kpis.push(['Food cost',fcReal!==null?fcReal.toFixed(1)+'%':'—',fcColor]); }
  return `<section style="${pageBreak?'page-break-after:always;':''}">
  <div style="padding:24px 28px;background:${ACCENT}">
    <div style="font-size:10px;letter-spacing:2px;color:#e94560;text-transform:uppercase;font-weight:700;margin-bottom:4px">Escandallo · ${(e.tipo||'final')==='intermedia'?'Elaboración intermedia':'Elaboración final'}</div>
    <div style="font-size:26px;font-weight:900;color:#fff">${e.nombre||''}</div>
    <div style="font-size:12px;color:#cbd5e1;margin-top:4px">${e.categoria||''} · ${(e.restaurante==='global'||!e.restaurante)?'Global':e.restaurante} · ${rend} ${rendU}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(${kpis.length},1fr);border-bottom:1px solid #e2e8f0">
    ${kpis.map(k=>`<div style="padding:13px 14px;border-right:1px solid #e2e8f0;text-align:center"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;font-weight:700;margin-bottom:4px">${k[0]}</div><div style="font-size:17px;font-weight:800;color:${k[2]}">${k[1]}</div></div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:24px;padding:22px 28px">
    <div>
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:10px">Composición</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead><tr style="background:${ACCENT}"><th style="padding:8px 10px;text-align:left;font-size:10px;color:#fff">Cantidad</th><th style="padding:8px 10px;text-align:left;font-size:10px;color:#fff">Composición</th><th style="padding:8px 10px;text-align:right;font-size:10px;color:#fff">Coste</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#f8fafc"><td colspan="2" style="padding:8px 10px;font-weight:800;text-align:right;font-size:12px;border-top:2px solid #e2e8f0">TOTAL</td><td style="padding:8px 10px;font-weight:800;text-align:right;font-size:14px;border-top:2px solid #e2e8f0">${escFmt(coste)}</td></tr></tfoot>
      </table>
    </div>
    <div>
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:10px">Distribución del coste</div>
      <div style="text-align:center;margin-bottom:12px">${pie}</div>
      ${legend}
    </div>
  </div>
  ${escRecetaPDF(e)}
  </section>`;
}
function escPdfDoc(title,inner){
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${inner}</body></html>`;
}
function escDetailPDF(id){
  const e=_escAllData[id]; if(!e){ toast('No encontrado','#dc2626'); return; }
  const w=window.open('','_blank');
  if(!w){ toast('Permite las ventanas emergentes para el PDF','#dc2626'); return; }
  w.document.write(escPdfDoc(e.nombre||'Escandallo', escPdfSection(e,false)));
  w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 400);
}
function escRecetaPDF(e){
  const elab=e.elaboracion||{texto:'',pasos:[]};
  const secciones=(e.recetaSecciones||[]).filter(s=>(s.titulo&&s.titulo.trim())||(s.ingredientes||[]).some(i=>i.nombre&&i.nombre.trim())||(s.pasos||[]).some(p=>p&&p.trim()));
  const pasosGen=(elab.pasos||[]).filter(p=>p&&p.trim());
  if(!(elab.texto&&elab.texto.trim())&&!pasosGen.length&&!secciones.length) return '';
  const paso=(p,i)=>`<div style="display:flex;gap:10px;margin-bottom:7px;align-items:flex-start"><span style="min-width:20px;height:20px;border-radius:50%;background:#1a1a2e;color:#fff;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">${i+1}</span><span style="font-size:12px;line-height:1.6;color:#334155;padding-top:1px">${p}</span></div>`;
  let body='';
  if(elab.texto&&elab.texto.trim()) body+=`<p style="font-size:12px;line-height:1.7;color:#334155;margin-bottom:12px;white-space:pre-wrap">${elab.texto}</p>`;
  if(pasosGen.length) body+=`<div style="margin-bottom:12px">${pasosGen.map(paso).join('')}</div>`;
  body+=secciones.map(sec=>{
    const ings=(sec.ingredientes||[]).filter(i=>i.nombre&&i.nombre.trim());
    const pasos=(sec.pasos||[]).filter(p=>p&&p.trim());
    const ingsHtml=ings.length?`<ul style="margin:0 0 10px 18px;padding:0">${ings.map(i=>`<li style="font-size:12px;line-height:1.6;color:#334155">${[i.cantidad,i.unidad,i.nombre].filter(Boolean).join(' ')}${i.nota?` (${i.nota})`:''}</li>`).join('')}</ul>`:'';
    return `<div style="margin-bottom:14px;page-break-inside:avoid">${sec.titulo&&sec.titulo.trim()?`<div style="font-size:13px;font-weight:800;color:#e94560;margin-bottom:8px">${sec.titulo}</div>`:''}${ingsHtml}${pasos.map(paso).join('')}</div>`;
  }).join('');
  return `<div style="padding:4px 28px 24px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:12px">Receta / Elaboración</div>${body}</div>`;
}

function escRenderTemporada(){
  const cont=document.getElementById('esc-temporada-btns');
  if(!cont) return;
  const MESES=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  cont.innerHTML=MESES.map(m=>{
    const on=_escTemporada.includes(m);
    return `<button type="button" onclick="escToggleMes('${m}')" style="cursor:pointer;border:1.5px solid ${on?'var(--pri)':'var(--brd)'};padding:3px 7px;border-radius:5px;font-size:11px;font-weight:700;background:${on?'var(--pri)':'var(--card)'};color:${on?'#fff':'var(--txt)'}">${m}</button>`;
  }).join('');
}
function escToggleMes(m){
  const i=_escTemporada.indexOf(m);
  if(i>=0) _escTemporada.splice(i,1); else _escTemporada.push(m);
  escRenderTemporada();
}
function escAddSeccion(){
  _escSecciones.push({titulo:'',ingredientes:[],pasos:[]});
  escRenderSecciones();
}
function escDelSeccion(si){
  _escSecciones.splice(si,1);
  escRenderSecciones();
}
function escAddIngSeccion(si){
  _escSecciones[si].ingredientes.push({cantidad:'',unidad:'',nombre:'',nota:''});
  escRenderSecciones();
}
function escDelIngSeccion(si,ii){
  _escSecciones[si].ingredientes.splice(ii,1);
  escRenderSecciones();
}
function escAddPasoSeccion(si){
  _escSecciones[si].pasos.push('');
  escRenderSecciones();
}
function escDelPasoSeccion(si,pi){
  _escSecciones[si].pasos.splice(pi,1);
  escRenderSecciones();
}
function escRenderSecciones(){
  const cont=document.getElementById('esc-secciones-list');
  if(!cont) return;
  if(!_escSecciones.length){
    cont.innerHTML=`<p style="color:var(--mut);font-size:12px;margin-bottom:4px">Sin secciones. Pulsa "+ Añadir sección" para empezar.</p>`;
    return;
  }
  cont.innerHTML=_escSecciones.map((sec,si)=>{
    const ings=(sec.ingredientes||[]).map((ing,ii)=>`
      <div style="display:grid;grid-template-columns:60px 60px 1fr 1fr auto;gap:4px;margin-bottom:4px;align-items:center">
        <input type="number" value="${ing.cantidad||''}" placeholder="Cant." min="0" step="0.001" style="padding:4px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)" oninput="_escSecciones[${si}].ingredientes[${ii}].cantidad=this.value"/>
        <input type="text" value="${ing.unidad||''}" placeholder="Ud." style="padding:4px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)" oninput="_escSecciones[${si}].ingredientes[${ii}].unidad=this.value"/>
        <input type="text" value="${ing.nombre||''}" placeholder="Ingrediente" style="padding:4px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);font-weight:600" oninput="_escSecciones[${si}].ingredientes[${ii}].nombre=this.value"/>
        <input type="text" value="${ing.nota||''}" placeholder="Nota" style="padding:4px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);font-style:italic" oninput="_escSecciones[${si}].ingredientes[${ii}].nota=this.value"/>
        <button onclick="escDelIngSeccion(${si},${ii})" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:13px;padding:2px">✕</button>
      </div>`).join('');
    const pasos=(sec.pasos||[]).map((p,pi)=>`
      <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:5px">
        <span style="min-width:20px;height:20px;background:var(--pri);color:#fff;border-radius:50%;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:5px">${pi+1}</span>
        <input type="text" value="${p.replace(/"/g,'&quot;')}" placeholder="Paso ${pi+1}..." style="flex:1;padding:5px 8px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt)" oninput="_escSecciones[${si}].pasos[${pi}]=this.value"/>
        <button onclick="escDelPasoSeccion(${si},${pi})" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:13px;padding:2px;margin-top:4px">✕</button>
      </div>`).join('');
    return `<div style="background:var(--srf);border:1px solid var(--brd);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <input type="text" value="${(sec.titulo||'').replace(/"/g,'&quot;')}" placeholder="Nombre de sección (ej: Salsa, Guarnición...)" style="flex:1;padding:5px 8px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;font-weight:700;background:var(--card);color:var(--txt)" oninput="_escSecciones[${si}].titulo=this.value"/>
        <button onclick="escDelSeccion(${si})" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:14px;margin-left:8px;padding:2px" title="Eliminar sección">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);margin-bottom:6px">Ingredientes</div>
          ${ings||'<p style="font-size:12px;color:var(--mut);margin:0 0 6px">Sin ingredientes</p>'}
          <button class="btn btn-ghost btn-xs" onclick="escAddIngSeccion(${si})">+ Ingrediente</button>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);margin-bottom:6px">Pasos</div>
          ${pasos||'<p style="font-size:12px;color:var(--mut);margin:0 0 6px">Sin pasos</p>'}
          <button class="btn btn-ghost btn-xs" onclick="escAddPasoSeccion(${si})">+ Paso</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function escLoadProds(){
  const pid=document.getElementById('esc-sel-prov').value;
  const sel=document.getElementById('esc-sel-prod');
  const srch=document.getElementById('esc-prod-search');
  const btnNew=document.getElementById('esc-btn-new-prod');
  const wrapNew=document.getElementById('esc-new-prod-wrap');
  sel.innerHTML='<option value="">-- Producto --</option>';
  if(wrapNew) wrapNew.style.display='none';
  if(pid==='__subesc__'){
    if(srch){srch.value='';srch.style.display='none';}
    if(btnNew) btnNew.style.display='none';
    sel.innerHTML='<option value="">-- Selecciona escandallo --</option>';
    Object.entries(_escAllData).filter(([id])=>id!==_escEditId).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||'','es')).forEach(([id,e])=>{
      const o=document.createElement('option');
      o.value=id; o.textContent=(e.nombre||'Sin nombre')+' ['+escFmt(escCosteTotal(e))+'/rac.]';
      o.dataset.name=e.nombre||'Sin nombre'; o.dataset.unit='rac.'; o.dataset.price='0';
      sel.appendChild(o);
    });
    return;
  }
  if(srch){srch.value='';srch.style.display=pid?'block':'none';}
  if(btnNew) btnNew.style.display=pid?'block':'none';
  if(!pid||!_escSupsCache[pid]) return;
  const prods=(Array.isArray(_escSupsCache[pid].products)?_escSupsCache[pid].products:Object.values(_escSupsCache[pid].products||[]));
  // Agrupar por categoría
  const byCat={};
  prods.forEach(p=>{ const c=p.category||'Otros'; if(!byCat[c])byCat[c]=[]; byCat[c].push(p); });
  const cats=[...PROD_CATS,...Object.keys(byCat).filter(c=>!PROD_CATS.includes(c))].filter(c=>byCat[c]);
  cats.forEach(cat=>{
    const grp=document.createElement('optgroup');
    grp.label=cat;
    byCat[cat].forEach(p=>{
      const o=document.createElement('option');
      o.value=p.id||p.name;
      const grInfo=p.pesoGr?` · ${p.pesoGr}gr`:'';
      o.textContent=`${p.name} (${parseFloat(p.price||0).toFixed(2)}€/${p.unit||'u.'}${grInfo})`;
      o.dataset.price=p.price||0; o.dataset.unit=p.unit||'u.'; o.dataset.name=p.name||''; o.dataset.gr=p.pesoGr||''; o.dataset.cat=cat;
      grp.appendChild(o);
    });
    sel.appendChild(grp);
  });
}
function escFilterProdsSearch(term){
  const sel=document.getElementById('esc-sel-prod');
  if(!sel)return;
  const q=term.toLowerCase().trim();
  Array.from(sel.options).forEach(o=>{
    if(!o.value){o.style.display='';return;}
    o.style.display=(!q||o.dataset.name.toLowerCase().includes(q))?'':'none';
  });
  // Auto-select if only one match
  const visible=Array.from(sel.options).filter(o=>o.value&&o.style.display!=='none');
  if(visible.length===1) sel.value=visible[0].value;
}
function escToggleNewProd(show){
  const wrap=document.getElementById('esc-new-prod-wrap');
  const btn=document.getElementById('esc-btn-new-prod');
  if(!wrap)return;
  wrap.style.display=show?'block':'none';
  if(btn) btn.style.display=show?'none':'block';
  if(show){
    const srch=document.getElementById('esc-prod-search');
    if(srch) document.getElementById('esc-np-name').value=srch.value||'';
    setTimeout(()=>document.getElementById('esc-np-name')?.focus(),50);
  }
}
function escCrearProd(){
  const pid=document.getElementById('esc-sel-prov').value;
  if(!pid){toast('Selecciona primero un proveedor','#dc2626');return;}
  const name=(document.getElementById('esc-np-name')?.value||'').trim();
  const unit=document.getElementById('esc-np-unit')?.value||'KG';
  const price=parseFloat(document.getElementById('esc-np-price')?.value)||0;
  const grRaw=document.getElementById('esc-np-gr')?.value;
  const pesoGr=grRaw&&!isNaN(parseInt(grRaw))?parseInt(grRaw):undefined;
  if(!name){toast('Escribe el nombre del producto','#dc2626');return;}
  if(!suppliers[pid]) suppliers[pid]=_escSupsCache[pid];
  if(!Array.isArray(suppliers[pid].products)) suppliers[pid].products=Object.values(suppliers[pid].products||{});
  const newId='p'+uid();
  const prod={id:newId,name,unit,price};
  if(pesoGr!==undefined) prod.pesoGr=pesoGr;
  suppliers[pid].products.push(prod);
  _escSupsCache[pid]=suppliers[pid];
  saveSups(pid);
  // Reload product list and select the new product
  escLoadProds();
  setTimeout(()=>{
    const sel=document.getElementById('esc-sel-prod');
    if(sel) sel.value=newId;
    escToggleNewProd(false);
    toast(`Producto "${name}" creado y seleccionado`,'#16a34a');
  },100);
}

function escAddIng(){
  const pid=document.getElementById('esc-sel-prov').value;
  const sel=document.getElementById('esc-sel-prod');
  const prodId=sel.value;
  const qty=parseFloat(document.getElementById('esc-sel-qty').value);
  const merma=parseFloat(document.getElementById('esc-sel-merma').value)||0;
  const libreNombre=(document.getElementById('esc-libre-nombre').value||'').trim();
  const librePrice=parseFloat(document.getElementById('esc-libre-precio').value)||0;
  if(!qty||qty<=0){toast('Introduce una cantidad válida','#dc2626');return;}

  if(pid==='__subesc__'){
    // Sub-elaboración
    if(!prodId){toast('Selecciona un escandallo','#dc2626');return;}
    const opt=sel.options[sel.selectedIndex];
    _escIngs.push({type:'subesc',escId:prodId,proveedorId:null,proveedorNombre:'Sub-elaboración',productoId:prodId,nombre:opt.dataset.name||opt.textContent.split(' [')[0],cantidad:qty,unidad:'rac.',precioUnitario:0,merma});
  } else if(libreNombre){
    // Ingrediente libre (sin proveedor)
    _escIngs.push({proveedorId:null,proveedorNombre:'Libre',productoId:null,nombre:libreNombre,cantidad:qty,unidad:'u.',precioUnitario:librePrice,merma});
  } else {
    // Ingrediente de proveedor
    if(!pid){toast('Selecciona un proveedor, un sub-escandallo o escribe un ingrediente libre','#dc2626');return;}
    if(!prodId){toast('Selecciona un producto','#dc2626');return;}
    const opt=sel.options[sel.selectedIndex];
    const prov=_escSupsCache[pid];
    _escIngs.push({proveedorId:pid,proveedorNombre:(prov?.name||pid),productoId:prodId,nombre:opt.dataset.name||opt.textContent,cantidad:qty,unidad:opt.dataset.unit||'u.',precioUnitario:parseFloat(opt.dataset.price)||0,merma});
  }
  document.getElementById('esc-sel-prov').value='';
  document.getElementById('esc-sel-prod').innerHTML='<option value="">-- Producto del proveedor --</option>';
  document.getElementById('esc-sel-qty').value='';
  document.getElementById('esc-sel-merma').value='';
  document.getElementById('esc-libre-nombre').value='';
  document.getElementById('esc-libre-precio').value='';
  escRenderIngs(); escRecalc();
}

function escQuitarIng(i){ _escIngs.splice(i,1); escRenderIngs(); escRecalc(); }
function escSetIngQty(i,val){ if(!_escIngs[i])return; const v=parseFloat(val); _escIngs[i].cantidad=isNaN(v)?0:v; escRenderIngs(); escRecalc(); }
function escSetIngMerma(i,val){ if(!_escIngs[i])return; let v=parseFloat(val); if(isNaN(v))v=0; v=Math.max(0,Math.min(99,v)); _escIngs[i].merma=v; escRenderIngs(); escRecalc(); }


function escLivePrice(ing, depth=0){
  // Sub-escandallo con fracción: coste = fraccion * costeTotal
  if(ing.type==='fracsubesc' && ing.escId && depth<5){
    const subEsc=_escAllData[ing.escId];
    if(subEsc) return escCosteTotal(subEsc, depth+1); // cantidad ya es la fracción
  }
  // Sub-escandallo clásico: coste por unidad de rendimiento
  if(ing.type==='subesc' && ing.escId && depth<5){
    const subEsc=_escAllData[ing.escId];
    if(subEsc){
      const rend=parseFloat(subEsc.rendimiento)||1;
      return escCosteTotal(subEsc, depth+1)/rend;
    }
  }
  if(ing.proveedorId===null) return parseFloat(ing.precioUnitario)||0; // libre o sub-esc no encontrado
  const sup=suppliers[ing.proveedorId];
  if(sup&&sup.products){
    const prod=(Array.isArray(sup.products)?sup.products:Object.values(sup.products)).find(p=>p.id===ing.productoId);
    if(prod) return parseFloat(prod.price)||0;
  }
  return parseFloat(ing.precioUnitario)||0;
}

function escCosteFactor(ing){
  // Coste real = precio * cantidad / (1 - merma/100)
  const merma=parseFloat(ing.merma)||0;
  const factor=merma>0&&merma<100?1/(1-merma/100):1;
  return escLivePrice(ing)*(parseFloat(ing.cantidad)||0)*factor;
}

function escFraccionTexto(val){
  const n=parseFloat(val);
  if(!n||!isFinite(n)) return '0';
  // Fracciones comunes
  const comunes={0.25:'1/4',0.5:'1/2',0.75:'3/4',0.33:'1/3',0.333:'1/3',0.67:'2/3',0.667:'2/3',0.2:'1/5',0.125:'1/8',0.1:'1/10'};
  const key=Math.round(n*1000)/1000;
  if(comunes[key]) return comunes[key];
  if(comunes[Math.round(n*100)/100]) return comunes[Math.round(n*100)/100];
  // Si es un porcentaje "redondo", mostrar como x/100 simplificado o %
  if(n<1) return (Math.round(n*1000)/10)+'%';
  return String(Math.round(n*1000)/1000);
}

function escRenderIngs(){
  const cont=document.getElementById('esc-ing-list');
  if(!cont) return;
  if(!_escIngs.length){cont.innerHTML='<p style="color:var(--mut);font-size:13px">Sin ingredientes aún</p>';return;}
  const totalCoste=_escIngs.reduce((s,ing)=>s+escCosteFactor(ing),0);
  cont.innerHTML=_escIngs.map((ing,i)=>{
    const liveP=escLivePrice(ing);
    const merma=parseFloat(ing.merma)||0;
    const costeReal=escCosteFactor(ing);
    const pct=totalCoste>0?(costeReal/totalCoste*100):0;
    const pctColor=pct>=40?'#dc2626':pct>=20?'#d97706':'#64748b';
    const changed=ing.proveedorId!==null&&Math.abs(liveP-(parseFloat(ing.precioUnitario)||0))>0.001;
    const priceTag=changed?`<span style="color:#d97706;font-size:10px" title="Precio actualizado desde tarifa">${escFmt(liveP)}</span>`:`${escFmt(liveP)}`;
    const mermaTag=merma>0?`<span style="color:#7c3aed;font-size:10px;margin-left:4px" title="Con merma del ${merma}%">${merma}%</span>`:'';
    const fracTexto=ing.type==='fracsubesc'?escFraccionTexto(ing.fraccion||ing.cantidad):'';
    const subEscTag=ing.type==='subesc'?'<span style="font-size:10px;color:#7c3aed;margin-left:4px;font-weight:700">[sub-elaboración]</span>'
      :ing.type==='fracsubesc'?`<span style="font-size:10px;color:#6366f1;margin-left:4px;font-weight:700">[${fracTexto} del escandallo]</span>`
      :'';
    const libre=(!ing.type&&ing.proveedorId===null)?'<span style="font-size:10px;color:#6b7280;margin-left:4px">[libre]</span>':'';
    const qtyCell=ing.type==='fracsubesc'
      ? `${fracTexto} × ${priceTag} total`
      : `<input type="number" value="${ing.cantidad}" min="0" step="0.001" onchange="escSetIngQty(${i},this.value)" onclick="event.stopPropagation()" style="width:64px;padding:3px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);text-align:right"/> ${ing.unidad} × ${priceTag}`;
    const mermaCell=`<input type="number" value="${ing.merma||0}" min="0" max="99" step="1" onchange="escSetIngMerma(${i},this.value)" onclick="event.stopPropagation()" title="% merma" style="width:46px;padding:3px 5px;border:1.5px solid var(--brd);border-radius:6px;font-size:11px;background:var(--card);color:var(--txt);text-align:right"/>%`;
    return `<div class="esc-ing-row">
      <span class="in">${ing.nombre}${subEscTag}${libre}</span>
      <span class="id">${qtyCell} <span style="margin-left:6px;color:var(--mut)">merma</span> ${mermaCell}</span>
      <span class="ic">${escFmt(costeReal)}</span>
      <span style="font-size:11px;font-weight:700;min-width:38px;text-align:right;color:${pctColor}">${pct.toFixed(1)}%</span>
      <button onclick="escQuitarIng(${i})" title="Eliminar">✕</button>
    </div>`;
  }).join('');
}

function escRecalc(){
  const coste=_escIngs.reduce((s,ing)=>s+escCosteFactor(ing),0);
  const pvpConIva=parseFloat(document.getElementById('esc-pvp')?.value)||0;
  const ivaPct=parseFloat(document.getElementById('esc-iva')?.value)||0;
  const fcObj=parseFloat(document.getElementById('esc-fcobj')?.value)||30;
  // IVA desglose
  const ivaFactor=1+(ivaPct/100);
  const pvpSinIva=pvpConIva>0?pvpConIva/ivaFactor:0;
  const ivaAmt=pvpConIva>0?pvpConIva-pvpSinIva:0;
  // Food cost se calcula sobre precio sin IVA
  const fcReal=pvpSinIva>0?(coste/pvpSinIva*100):null;
  // PVP sugerido: precio sin IVA = coste / (fcObj/100), luego con IVA
  const pvpSugSinIva=coste>0?(coste/(fcObj/100)):null;
  const pvpSug=pvpSugSinIva!==null?pvpSugSinIva*ivaFactor:null;
  const margen=pvpSinIva>0?(pvpSinIva-coste):null;
  const margenPct=pvpSinIva>0&&margen!==null?(margen/pvpSinIva*100):null;

  document.getElementById('ec-coste').textContent=escFmt(coste);
  const fcEl=document.getElementById('ec-fc');
  if(fcReal!==null){fcEl.textContent=fcReal.toFixed(1)+'%';fcEl.className=fcReal<=fcObj?'fc-ok':fcReal<=fcObj+5?'fc-warn':'fc-bad';}
  else{fcEl.textContent='— %';fcEl.className='';}
  // IVA rows
  const ivaPctEl=document.getElementById('ec-iva-pct');
  if(ivaPctEl) ivaPctEl.textContent=ivaPct;
  document.getElementById('ec-pvp-coniva').textContent=pvpConIva>0?escFmt(pvpConIva):'— €';
  document.getElementById('ec-iva-amt').textContent=pvpConIva>0?escFmt(ivaAmt):'— €';
  document.getElementById('ec-pvp-noiva').textContent=pvpSinIva>0?escFmt(pvpSinIva):'— €';
  document.getElementById('ec-pvpsug').textContent=pvpSug!==null?escFmt(pvpSug):'— €';
  document.getElementById('ec-margen').textContent=margen!==null?escFmt(margen):'— €';
  document.getElementById('ec-margenpct').textContent=margenPct!==null?margenPct.toFixed(1)+'%':'— %';
  // Actualizar alérgenos en tiempo real
  const alerEl=document.getElementById('esc-alergenos-display');
  if(alerEl){
    const present=alergenosFromIngs(_escIngs);
    if(!present.length){
      alerEl.innerHTML='<span style="color:var(--mut)">Ninguno detectado en ingredientes vinculados</span>';
    } else {
      alerEl.innerHTML=present.map(id=>{
        const a=ALERGENOS.find(x=>x.id===id);
        return `<span style="display:inline-block;background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600;margin:2px 3px 2px 0">${a?a.label:id}</span>`;
      }).join('');
    }
  }
}

function escSave(){
  if(!fbDb){toast('Sin conexión Firebase — espera un momento y vuelve a intentarlo','#dc2626');return;}
  const nombreEl=document.getElementById('esc-nombre');
  if(!nombreEl){toast('Error: recarga la página','#dc2626');return;}
  const nombre=nombreEl.value.trim();
  if(!nombre){toast('Escribe el nombre del plato','#dc2626');return;}
  try{
    const ingsWithLivePrice=_escIngs.map(ing=>({...ing,precioUnitario:escLivePrice(ing)}));
    const data={
      nombre,
      tipo:document.getElementById('esc-tipo')?.value||'final',
      categoria:document.getElementById('esc-categoria')?.value||'Otros',
      restaurante:document.getElementById('esc-local')?.value||'global',
      rendimiento:parseFloat(document.getElementById('esc-rend')?.value)||1,
      rendimientoUnidad:document.getElementById('esc-rend-unit')?.value||'rac.',
      precioVenta:parseFloat(document.getElementById('esc-pvp')?.value)||0,
      iva:parseFloat(document.getElementById('esc-iva')?.value)||0,
      foodCostObjetivo:parseFloat(document.getElementById('esc-fcobj')?.value)||30,
      notas:document.getElementById('esc-notas')?.value.trim()||'',
      tiempoElaboracion:parseFloat(document.getElementById('esc-tiempo')?.value)||null,
      temperatura:document.getElementById('esc-temp')?.value.trim()||'',
      alergenos:alergenosFromIngs(_escIngs),
      ingredientes:ingsWithLivePrice,
      elaboracion:{texto:_escElab.texto||'',pasos:_escElab.pasos.filter(p=>p.trim())},
      temporada:_escTemporada,
      recetaSecciones:_escSecciones.map(s=>({...s,ingredientes:(s.ingredientes||[]).filter(i=>i.nombre),pasos:(s.pasos||[]).filter(p=>p.trim())})),
      updatedAt:Date.now()
    };
    const ref=_escEditId?fbDb.ref('escandallos/'+_escEditId):fbDb.ref('escandallos').push();
    if(!_escEditId) data.createdAt=Date.now();
    ref.set(data)
      .then(()=>{escCloseModal();toast('Escandallo guardado','#16a34a');})
      .catch(e=>toast('Error al guardar: '+e.message,'#dc2626'));
  }catch(e){toast('Error: '+e.message,'#dc2626');console.error(e);}
}

function escExportPDF(){
  const nombre=document.getElementById('esc-nombre')?.value.trim()||'Escandallo';
  const categoria=document.getElementById('esc-categoria')?.value||'';
  const pvp=parseFloat(document.getElementById('esc-pvp')?.value)||0;
  const fcObj=parseFloat(document.getElementById('esc-fcobj')?.value)||30;
  const notas=document.getElementById('esc-notas')?.value.trim()||'';
  const rend=parseFloat(document.getElementById('esc-rend')?.value)||1;
  const rendUnit=document.getElementById('esc-rend-unit')?.value||'rac.';
  const coste=_escIngs.reduce((s,i)=>s+escCosteFactor(i),0);
  const fcReal=pvp>0?(coste/pvp*100):null;
  const margen=pvp>0?(pvp-coste):null;
  const pvpSugerido=coste>0?coste/(fcObj/100):null;

  const ACCENT='#1a1a2e';
  const ACCENT2='#e94560';
  const fcColor=fcReal===null?'#64748b':fcReal<=fcObj?'#16a34a':fcReal<=fcObj+5?'#d97706':'#dc2626';
  const fcBg=fcReal===null?'#f8fafc':fcReal<=fcObj?'#f0fdf4':fcReal<=fcObj+5?'#fffbeb':'#fef2f2';

  const rows=_escIngs.map((ing,ii)=>{
    const liveP=escLivePrice(ing);
    const merma=parseFloat(ing.merma)||0;
    const costeIng=escCosteFactor(ing);
    const pct=coste>0?(costeIng/coste*100):0;
    return `<tr style="background:${ii%2===0?'#fff':'#f8fafc'}">
      <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9">${ing.nombre}${ing.proveedorId===null?'<span style="font-size:10px;color:#94a3b8;margin-left:4px">(libre)</span>':''}</td>
      <td style="padding:8px 12px;font-size:12px;color:#475569;text-align:center;border-bottom:1px solid #f1f5f9;white-space:nowrap">${ing.cantidad} ${ing.unidad}</td>
      <td style="padding:8px 12px;font-size:12px;color:#64748b;text-align:center;border-bottom:1px solid #f1f5f9">${merma>0?merma+'%':'—'}</td>
      <td style="padding:8px 12px;font-size:12px;color:#475569;text-align:right;border-bottom:1px solid #f1f5f9">${escFmt(liveP)}<span style="font-size:10px;color:#94a3b8">/u.</span></td>
      <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9">${escFmt(costeIng)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;width:60px">
        <div style="background:#e2e8f0;border-radius:3px;height:6px;overflow:hidden"><div style="background:${ACCENT2};height:100%;width:${Math.min(pct,100).toFixed(1)}%"></div></div>
        <div style="font-size:9px;color:#94a3b8;text-align:right;margin-top:2px">${pct.toFixed(0)}%</div>
      </td>
    </tr>`;
  }).join('');

  const elab=_escElab||{texto:'',pasos:[]};
  // Secciones de receta (estructura nueva: titulo + ingredientes + pasos)
  const seccionesPDF=(_escSecciones||[]).filter(s=>(s.titulo&&s.titulo.trim())||(s.ingredientes||[]).some(i=>i.nombre&&i.nombre.trim())||(s.pasos||[]).some(p=>p&&p.trim()));
  const seccionesHTML=seccionesPDF.map(sec=>{
    const ings=(sec.ingredientes||[]).filter(i=>i.nombre&&i.nombre.trim());
    const pasos=(sec.pasos||[]).filter(p=>p&&p.trim());
    const ingsHTML=ings.length?`<ul style="margin:0 0 10px 0;padding-left:18px">${ings.map(i=>`<li style="font-size:12px;line-height:1.6;color:#334155">${[i.cantidad,i.unidad].filter(Boolean).join(' ')} ${i.nombre}${i.nota?` <span style="color:#94a3b8">(${i.nota})</span>`:''}</li>`).join('')}</ul>`:'';
    const pasosHTML=pasos.map((p,i)=>`
        <div style="display:flex;gap:10px;margin-bottom:8px;align-items:flex-start">
          <span style="min-width:22px;height:22px;border-radius:50%;background:${ACCENT};color:#fff;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
          <span style="font-size:12px;line-height:1.6;color:#334155;padding-top:2px">${p}</span>
        </div>`).join('');
    return `<div style="margin-bottom:16px;page-break-inside:avoid">
        ${sec.titulo&&sec.titulo.trim()?`<div style="font-size:13px;font-weight:800;color:${ACCENT2};margin-bottom:8px">${sec.titulo}</div>`:''}
        ${ingsHTML}${pasosHTML}
      </div>`;
  }).join('');
  const elabBlocks=(elab.texto?`<p style="font-size:12px;line-height:1.7;color:#334155;margin-bottom:12px">${elab.texto}</p>`:'')
    +(elab.pasos||[]).filter(p=>p.trim()).map((p,i)=>`
        <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start">
          <span style="min-width:24px;height:24px;border-radius:50%;background:${ACCENT};color:#fff;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
          <span style="font-size:12px;line-height:1.6;color:#334155;padding-top:3px">${p}</span>
        </div>`).join('')
    +seccionesHTML;
  const elaboracionHTML=(elab.texto||(elab.pasos||[]).filter(p=>p.trim()).length||seccionesPDF.length)?`
    <div style="margin-top:20px;page-break-inside:avoid">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:12px">Elaboración</div>
      ${elabBlocks}
    </div>`:'';

  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${nombre}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;font-size:13px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <!-- CABECERA -->
  <div style="background:${ACCENT};padding:22px 28px 18px;position:relative;overflow:hidden">
    <div style="position:absolute;right:-20px;top:-20px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:${ACCENT2};text-transform:uppercase;margin-bottom:5px">Escandallo · Food Cost</div>
    <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:.3px;margin-bottom:12px">${nombre}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${categoria?`<span style="background:rgba(255,255,255,.12);color:#e2e8f0;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">${categoria}</span>`:''}
      <span style="background:rgba(255,255,255,.12);color:#e2e8f0;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">🍽 ${rend} ${rendUnit}</span>
      ${notas?`<span style="background:rgba(255,255,255,.12);color:#e2e8f0;padding:4px 12px;border-radius:20px;font-size:11px"> ${notas}</span>`:''}
    </div>
  </div>
  <!-- KPIs -->
  <div style="display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid #e2e8f0">
    <div style="padding:14px 16px;border-right:1px solid #e2e8f0;text-align:center">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:4px">Coste</div>
      <div style="font-size:18px;font-weight:800;color:#0f172a">${escFmt(coste)}</div>
    </div>
    <div style="padding:14px 16px;border-right:1px solid #e2e8f0;text-align:center">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:4px">PVP</div>
      <div style="font-size:18px;font-weight:800;color:#0f172a">${pvp>0?escFmt(pvp):'—'}</div>
    </div>
    <div style="padding:14px 16px;border-right:1px solid #e2e8f0;text-align:center;background:${fcBg}">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:4px">Food Cost</div>
      <div style="font-size:18px;font-weight:800;color:${fcColor}">${fcReal!==null?fcReal.toFixed(1)+'%':'—'}</div>
    </div>
    <div style="padding:14px 16px;border-right:1px solid #e2e8f0;text-align:center">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:4px">Obj. FC</div>
      <div style="font-size:18px;font-weight:800;color:#64748b">${fcObj}%</div>
    </div>
    <div style="padding:14px 16px;border-right:1px solid #e2e8f0;text-align:center">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:4px">Margen</div>
      <div style="font-size:18px;font-weight:800;color:${margen!==null&&margen>0?'#16a34a':'#64748b'}">${margen!==null?escFmt(margen):'—'}</div>
    </div>
    <div style="padding:14px 16px;text-align:center">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:4px">PVP Sugerido</div>
      <div style="font-size:18px;font-weight:800;color:#475569">${pvpSugerido?escFmt(pvpSugerido):'—'}</div>
    </div>
  </div>
  <!-- TABLA INGREDIENTES -->
  <div style="padding:20px 28px">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:10px">Ingredientes</div>
    <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
      <thead><tr style="background:${ACCENT}">
        <th style="padding:9px 12px;text-align:left;font-size:11px;color:#fff;font-weight:700">Ingrediente</th>
        <th style="padding:9px 12px;text-align:center;font-size:11px;color:#fff;font-weight:700">Cantidad</th>
        <th style="padding:9px 12px;text-align:center;font-size:11px;color:#fff;font-weight:700">Merma</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;color:#fff;font-weight:700">Precio/u.</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;color:#fff;font-weight:700">Coste</th>
        <th style="padding:9px 12px;text-align:center;font-size:11px;color:#fff;font-weight:700">% s/total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f8fafc">
        <td colspan="4" style="padding:9px 12px;font-size:12px;font-weight:700;color:#475569;border-top:2px solid #e2e8f0">TOTAL</td>
        <td style="padding:9px 12px;font-size:14px;font-weight:800;color:#0f172a;text-align:right;border-top:2px solid #e2e8f0">${escFmt(coste)}</td>
        <td style="border-top:2px solid #e2e8f0"></td>
      </tr></tfoot>
    </table>
    ${elaboracionHTML}
  </div>
  <!-- PIE -->
  <div style="border-top:1px solid #e2e8f0;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;margin-top:8px">
    <span style="font-size:10px;color:#94a3b8;font-weight:600">O'CARRO GROUP · Escandallo</span>
    <span style="font-size:10px;color:#94a3b8">${new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</span>
  </div>
  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`;
  const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}
}

function escExportExcel(){
  if(typeof XLSX==='undefined'){toast('Librería Excel no disponible','#dc2626');return;}
  const nombre=document.getElementById('esc-nombre')?.value.trim()||'Escandallo';
  const categoria=document.getElementById('esc-categoria')?.value||'';
  const pvp=parseFloat(document.getElementById('esc-pvp')?.value)||0;
  const fcObj=parseFloat(document.getElementById('esc-fcobj')?.value)||30;
  const coste=_escIngs.reduce((s,i)=>s+escCosteFactor(i),0);
  const fcReal=pvp>0?(coste/pvp*100):null;

  const rows=[['Ingrediente','Proveedor','Cantidad','Unidad','Merma %','Precio/u. €','Coste real €']];
  _escIngs.forEach(ing=>{
    rows.push([
      ing.nombre,
      ing.proveedorNombre||'Libre',
      ing.cantidad,
      ing.unidad,
      parseFloat(ing.merma)||0,
      escLivePrice(ing),
      +escCosteFactor(ing).toFixed(4)
    ]);
  });
  rows.push([]);
  rows.push(['','','','','Coste total',coste,'']);
  rows.push(['','','','','PVP',pvp,'']);
  rows.push(['','','','','Food cost %',fcReal!==null?+(fcReal.toFixed(2)):'','']);
  rows.push(['','','','','FC objetivo %',fcObj,'']);
  rows.push(['','','','','Margen €',pvp>0?+(pvp-coste).toFixed(4):0,'']);

  const ws=XLSX.utils.aoa_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Escandallo');
  XLSX.writeFile(wb,(nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'_'))+'.xlsx');
}

function escImportarJSON(){
  document.getElementById('esc-import-input')?.click();
}

function escProcesarImport(input){
  const file=input.files[0];
  if(!file){return;}
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  const reader=new FileReader();
  reader.onload=async function(e){
    let datos;
    try{ datos=JSON.parse(e.target.result); }
    catch(err){ toast('El archivo no es un JSON válido','#dc2626'); return; }
    if(!Array.isArray(datos)||!datos.length){ toast('El archivo no contiene escandallos','#dc2626'); return; }

    const existentes=new Set(Object.values(_escAllData||{}).map(x=>(x.nombre||'').toLowerCase().trim()));
    const nuevos=datos.filter(d=>!existentes.has((d.nombre||'').toLowerCase().trim()));
    const duplicados=datos.length-nuevos.length;

    if(!nuevos.length){
      toast(`Todos los escandallos ya existen (${duplicados} duplicados omitidos)`,'#d97706');
      input.value=''; return;
    }

    const msg=duplicados>0
      ?`Se van a importar ${nuevos.length} escandallos (${duplicados} ya existían y se omiten). ¿Continuar?`
      :`Se van a importar ${nuevos.length} escandallos. ¿Continuar?`;
    if(!confirm(msg)){input.value='';return;}

    let ok=0,errors=0;
    toast(`Importando ${nuevos.length} escandallos...`,'#2563eb');
    for(const esc of nuevos){
      try{
        esc.updatedAt=Date.now();
        if(!esc.createdAt) esc.createdAt=Date.now();
        await fbDb.ref('escandallos').push().set(esc);
        ok++;
      }catch(err){ errors++; console.error('Error importando',esc.nombre,err); }
    }
    input.value='';
    if(errors) toast(`Importados ${ok} escandallos (${errors} errores)`,'#d97706');
    else toast(`${ok} escandallos importados correctamente`,'#16a34a');
  };
  reader.readAsText(file);
}

function escExportTodos(){
  if(typeof XLSX==='undefined'){toast('Librería Excel no disponible','#dc2626');return;}
  const localFiltro=document.getElementById('esc-local-filter')?.value||'';
  let todos=Object.values(_escAllData||{});
  if(!todos.length){toast('No hay escandallos guardados','#dc2626');return;}
  if(localFiltro) todos=todos.filter(e=>(e.restaurante||'global')===localFiltro);
  if(!todos.length){toast('No hay escandallos para este local','#f59e0b');return;}

  // Ordenar por nombre
  todos.sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'','es'));

  // Calcular coste con merma para cada escandallo
  function calcCoste(esc){
    return (esc.ingredientes||[]).reduce((s,ing)=>{
      // Precio vivo o guardado
      let p=parseFloat(ing.precioUnitario)||0;
      if(ing.proveedorId&&suppliers[ing.proveedorId]){
        const prod=(suppliers[ing.proveedorId].products||[]).find(x=>x.id===ing.productoId);
        if(prod) p=parseFloat(prod.price)||0;
      }
      const merma=parseFloat(ing.merma)||0;
      const factor=merma>0&&merma<100?1/(1-merma/100):1;
      return s+(parseFloat(ing.cantidad)||0)*p*factor;
    },0);
  }

  const ws_data=[
    ['PLATO','PRECIO COSTE + IVA','PRECIO VENTA OBJETIVO','%','PRECIO DE VENTA REAL','% REAL']
  ];
  todos.forEach((esc,i)=>{
    const row=i+2; // fila Excel (1 = cabecera)
    ws_data.push([
      esc.nombre||'',
      +calcCoste(esc).toFixed(4),
      {f:`B${row}*4`},       // precio objetivo (food cost 25%)
      {f:`B${row}/C${row}`}, // % food cost objetivo
      esc.precioVenta||0,
      {f:`IF(E${row}>0,B${row}/E${row},"")`} // % real
    ]);
  });

  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(ws_data);

  // Formato numérico para columnas %
  const range=XLSX.utils.decode_range(ws['!ref']);
  for(let r=1;r<=range.e.r;r++){
    const dCell=ws[XLSX.utils.encode_cell({r,c:3})]; // D
    const fCell=ws[XLSX.utils.encode_cell({r,c:5})]; // F
    if(dCell) dCell.z='0.00%';
    if(fCell) fCell.z='0.00%';
  }

  // Anchos de columna (en caracteres)
  ws['!cols']=[{wch:40},{wch:22},{wch:26},{wch:8},{wch:24},{wch:10}];

  XLSX.utils.book_append_sheet(wb,ws,'Escandallos');
  const fecha=new Date().toISOString().split('T')[0];
  const sufijo=localFiltro?'_'+localFiltro.replace(/[^a-zA-Z0-9]/g,'_'):'_todos';
  XLSX.writeFile(wb,`Escandallos${sufijo}_${fecha}.xlsx`);
  // PDF con todas las fichas (cada una en su página)
  const inner=todos.map((e,i)=>escPdfSection(e, i<todos.length-1)).join('');
  const w=window.open('','_blank');
  if(!w){ toast(`Excel exportado. Permite ventanas emergentes para el PDF.`,'#d97706',5000); return; }
  w.document.write(escPdfDoc('Escandallos '+fecha, inner));
  w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 600);
  toast(`${todos.length} escandallos exportados (Excel + PDF)`,'#16a34a',4000);
}

function escDelete(){
  if(!_escEditId||!confirm('¿Eliminar este escandallo?')) return;
  fbDb.ref('escandallos/'+_escEditId).remove().then(()=>{escCloseModal();toast('Escandallo eliminado','#888');});
}

/* ── Migrar recetas → escandallos ── */
async function escMigrarRecetas(){
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  if(!confirm('¿Fusionar todas las recetas en los escandallos?\n\nLas recetas con el mismo nombre se combinarán con su escandallo. Las que no tengan escandallo se crearán como nuevos escandallos.\n\nSe eliminarán todas las recetas de Firebase.')){return;}
  const [escSnap,recSnap]=await Promise.all([
    fbDb.ref('escandallos').once('value'),
    fbDb.ref('recetas').once('value')
  ]);
  const escandallos=escSnap.val()||{};
  const recetas=Object.entries(recSnap.val()||{});
  if(!recetas.length){toast('No hay recetas que migrar','#d97706');return;}
  const updates={};
  let migradas=0, nuevas=0;
  recetas.forEach(([rid,rec])=>{
    const nombre=(rec.nombre||'').toLowerCase().trim();
    // Buscar escandallo con mismo nombre
    const escEntry=Object.entries(escandallos).find(([,e])=>(e.nombre||'').toLowerCase().trim()===nombre);
    if(escEntry){
      const [eid]=escEntry;
      updates['escandallos/'+eid+'/temporada']=rec.temporada||[];
      updates['escandallos/'+eid+'/recetaSecciones']=rec.secciones||[];
      migradas++;
    } else {
      // Crear nuevo escandallo desde la receta
      const newKey=fbDb.ref('escandallos').push().key;
      updates['escandallos/'+newKey]={
        nombre:rec.nombre||'Sin nombre',
        categoria:rec.partida||'Otros',
        restaurante:'global',
        rendimiento:rec.rendimiento||1,
        rendimientoUnidad:rec.rendimientoUnidad||'rac.',
        precioVenta:0, iva:10, foodCostObjetivo:30,
        notas:'', alergenos:[],
        ingredientes:[],
        elaboracion:{texto:'',pasos:[]},
        temporada:rec.temporada||[],
        recetaSecciones:rec.secciones||[],
        createdAt:rec.createdAt||Date.now(),
        updatedAt:Date.now()
      };
      nuevas++;
    }
    updates['recetas/'+rid]=null; // borrar receta
  });
  await fbDb.ref().update(updates);
  toast(`Migración completa: ${migradas} fusionadas, ${nuevas} nuevas creadas`,'#16a34a');
}

/* ── Copiar escandallo para un local específico ── */
function escCopiarParaLocal(id){
  if(!_escAllData[id]){toast('Escandallo no encontrado','#dc2626');return;}
  const e=_escAllData[id];
  // Mostrar selector de local
  const rests=cfg.users.map(u=>u.restaurant);
  const sel=prompt('¿Para qué local?\n'+rests.map((r,i)=>`${i+1}. ${r}`).join('\n')+'\n\nEscribe el número:');
  if(!sel) return;
  const idx=parseInt(sel)-1;
  if(isNaN(idx)||idx<0||idx>=rests.length){toast('Local no válido','#dc2626');return;}
  const rest=rests[idx];
  if(!confirm(`¿Crear una copia de "${e.nombre}" para ${rest}?\nPodrás editarla de forma independiente.`)) return;
  const copia={...JSON.parse(JSON.stringify(e)),restaurante:rest,baseId:id,nombre:e.nombre+' ('+rest+')',createdAt:Date.now(),updatedAt:Date.now()};
  delete copia.id;
  fbDb.ref('escandallos').push(copia).then(()=>toast(`Copia creada para ${rest}`,'#16a34a')).catch(err=>toast('Error: '+err.message,'#dc2626'));
}
