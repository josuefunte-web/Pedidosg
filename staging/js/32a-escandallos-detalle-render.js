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

