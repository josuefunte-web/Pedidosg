/* ═══════════════ VISTA LOCAL — ESCANDALLOS (read-only) ═══════════════ */
// Devuelve true si el escandallo tiene contenido de receta (texto, pasos antiguos o secciones)
function _escTieneReceta(e){
  if(!e) return false;
  const tieneElab=e.elaboracion&&(((e.elaboracion.texto||'').trim())||(e.elaboracion.pasos||[]).some(p=>p&&p.trim()));
  const tieneSec=(e.recetaSecciones||[]).some(s=>((s.titulo||'').trim())||(s.ingredientes||[]).some(i=>i.nombre&&i.nombre.trim())||(s.pasos||[]).some(p=>p&&p.trim()));
  return !!(tieneElab||tieneSec);
}
// HTML compacto de la receta para que el local la vea en pantalla (sin costes)
function escRecetaScreenHTML(e){
  if(!_escTieneReceta(e)) return '';
  const elab=e.elaboracion||{};
  let html='<div style="margin-top:8px;padding:10px;background:var(--srf);border-radius:8px;font-size:12px;color:var(--txt)">';
  html+='<strong style="display:block;margin-bottom:6px">📖 Elaboración</strong>';
  if((elab.texto||'').trim()) html+=`<div style="color:var(--mut);margin-bottom:8px">${elab.texto}</div>`;
  (elab.pasos||[]).filter(p=>p&&p.trim()).forEach((p,i)=>{ html+=`<div style="margin-bottom:3px">${i+1}. ${p}</div>`; });
  (e.recetaSecciones||[]).forEach(sec=>{
    const ings=(sec.ingredientes||[]).filter(i=>i.nombre&&i.nombre.trim());
    const pasos=(sec.pasos||[]).filter(p=>p&&p.trim());
    if(!((sec.titulo||'').trim()||ings.length||pasos.length)) return;
    html+='<div style="margin-top:8px">';
    if((sec.titulo||'').trim()) html+=`<div style="font-weight:700;color:var(--pri);margin-bottom:4px">${sec.titulo}</div>`;
    if(ings.length){ html+='<ul style="margin:0 0 6px 0;padding-left:16px;color:var(--mut)">'+ings.map(i=>`<li>${[i.cantidad,i.unidad].filter(Boolean).join(' ')} ${i.nombre}${i.nota?` (${i.nota})`:''}</li>`).join('')+'</ul>'; }
    pasos.forEach((p,i)=>{ html+=`<div style="margin-bottom:3px">${i+1}. ${p}</div>`; });
    html+='</div>';
  });
  html+='</div>';
  return html;
}
// Abre una hoja de receta imprimible para entregar al local (sin costes ni precios)
function escImprimirReceta(id){
  const e=_escAllData[id];
  if(!e){ toast('Receta no encontrada','#dc2626'); return; }
  if(!_escTieneReceta(e)){ toast('Este escandallo aún no tiene receta','#d97706'); return; }
  const ACCENT='#1a1a2e', ACCENT2='#e94560';
  const elab=e.elaboracion||{};
  let cuerpo='';
  if((elab.texto||'').trim()) cuerpo+=`<p style="font-size:13px;line-height:1.7;color:#334155;margin-bottom:14px">${elab.texto}</p>`;
  (elab.pasos||[]).filter(p=>p&&p.trim()).forEach((p,i)=>{
    cuerpo+=`<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start"><span style="min-width:24px;height:24px;border-radius:50%;background:${ACCENT};color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span><span style="font-size:13px;line-height:1.6;color:#334155;padding-top:3px">${p}</span></div>`;
  });
  (e.recetaSecciones||[]).forEach(sec=>{
    const ings=(sec.ingredientes||[]).filter(i=>i.nombre&&i.nombre.trim());
    const pasos=(sec.pasos||[]).filter(p=>p&&p.trim());
    if(!((sec.titulo||'').trim()||ings.length||pasos.length)) return;
    cuerpo+='<div style="margin-bottom:18px;page-break-inside:avoid">';
    if((sec.titulo||'').trim()) cuerpo+=`<div style="font-size:15px;font-weight:800;color:${ACCENT2};margin-bottom:10px;border-bottom:2px solid #f1f5f9;padding-bottom:5px">${sec.titulo}</div>`;
    if(ings.length) cuerpo+='<ul style="margin:0 0 12px 0;padding-left:20px">'+ings.map(i=>`<li style="font-size:13px;line-height:1.7;color:#334155">${[i.cantidad,i.unidad].filter(Boolean).join(' ')} <strong>${i.nombre}</strong>${i.nota?` <span style="color:#94a3b8">(${i.nota})</span>`:''}</li>`).join('')+'</ul>';
    pasos.forEach((p,i)=>{
      cuerpo+=`<div style="display:flex;gap:10px;margin-bottom:9px;align-items:flex-start"><span style="min-width:22px;height:22px;border-radius:50%;background:${ACCENT};color:#fff;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span><span style="font-size:13px;line-height:1.6;color:#334155;padding-top:2px">${p}</span></div>`;
    });
    cuerpo+='</div>';
  });
  const rendInfo=[e.rendimiento&&`Rinde: ${e.rendimiento} ${e.rendimientoUnidad||''}`.trim(),e.tiempoElaboracion&&`Tiempo: ${e.tiempoElaboracion} min`,e.temperatura&&`Servicio: ${e.temperatura}`].filter(Boolean);
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receta — ${e.nombre||''}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
  </head><body>
  <div style="background:${ACCENT};padding:24px 30px">
    <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:${ACCENT2};text-transform:uppercase;margin-bottom:6px">Receta de cocina</div>
    <div style="font-size:27px;font-weight:900;color:#fff">${e.nombre||'Sin nombre'}</div>
    ${e.categoria?`<div style="font-size:12px;color:#cbd5e1;margin-top:4px">${e.categoria}</div>`:''}
  </div>
  ${rendInfo.length?`<div style="display:flex;gap:18px;padding:12px 30px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;font-weight:600">${rendInfo.map(t=>`<span>${t}</span>`).join('')}</div>`:''}
  <div style="padding:22px 30px">${cuerpo||'<p style="color:#94a3b8">Sin pasos de elaboración.</p>'}</div>
  <div style="border-top:1px solid #e2e8f0;padding:10px 30px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
    <span>O'CARRO GROUP · Receta</span><span>${new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</span>
  </div>
  <script>window.onload=()=>{window.print()}<\/script></body></html>`;
  const w=window.open('','_blank'); if(w){ w.document.write(html); w.document.close(); }
  else toast('Permite las ventanas emergentes para imprimir','#d97706');
}
function vLocalEscandallos(){
  const rest=S.session.restaurant||'';
  // El local ve: sus propios escandallos + los globales (si no tiene copia propia del mismo baseId)
  const myEscs=Object.entries(_escAllData).filter(([,e])=>{
    const r=e.restaurante||'global';
    return r==='global'||r===rest;
  });
  // Para globales, si hay una copia local, mostrar solo la copia
  const baseIds=new Set(myEscs.filter(([,e])=>e.baseId&&e.restaurante===rest).map(([,e])=>e.baseId));
  const visible=myEscs.filter(([id,e])=>!(e.restaurante==='global'&&baseIds.has(id)));

  const myMenus=Object.entries(_menAllData).filter(([,m])=>{
    const r=m.restaurante||'global';
    return r==='global'||r===rest;
  });

  let html='<div class="card"><div class="card-t">Mis escandallos</div>';
  if(!visible.length){
    html+='<div style="color:var(--mut);font-size:13px;text-align:center;padding:16px">Aún no tienes escandallos asignados</div>';
  } else {
    html+=visible.map(([id,e])=>{
      const coste=escCosteTotal(e);
      const pvp=parseFloat(e.precioVenta)||0;
      const fcReal=pvp>0?(coste/pvp*100):null;
      const margen=pvp>0?(pvp-coste):null;
      const fcCls=fcReal===null?'':fcReal>35?'color:#dc2626':fcReal>30?'color:#d97706':'color:#16a34a';
      const expanded=S._escLocalExpanded[id]||false;
      const ings=e.ingredientes||[];
      const recetaScreen=escRecetaScreenHTML(e);
      const hasReceta=!!recetaScreen;
      const ingRows=ings.map(ing=>{
        const liveP=escLivePrice(ing);
        const merma=parseFloat(ing.merma)||0;
        const factor=1+(merma/100);
        const costeIng=liveP*(parseFloat(ing.cantidad)||0)*factor;
        return `<tr>
          <td style="padding:4px 6px;font-size:12px">${ing.nombre||'—'}</td>
          <td style="padding:4px 6px;font-size:12px;text-align:right">${ing.cantidad} ${ing.unidad||'u.'}</td>
          <td style="padding:4px 6px;font-size:12px;text-align:right">${merma>0?merma+'%':'—'}</td>
          <td style="padding:4px 6px;font-size:12px;text-align:right;font-weight:600">${escFmt(costeIng)}</td>
        </tr>`;
      }).join('');
      const detailHtml=expanded&&(ings.length||hasReceta)?`
        <div style="margin-top:10px;border-top:1px solid var(--brd);padding-top:10px">
          ${ings.length?`<table style="width:100%;border-collapse:collapse">
            <thead><tr style="font-size:11px;color:var(--mut)">
              <th style="padding:2px 6px;text-align:left;font-weight:600">Ingrediente</th>
              <th style="padding:2px 6px;text-align:right;font-weight:600">Cantidad</th>
              <th style="padding:2px 6px;text-align:right;font-weight:600">Merma</th>
              <th style="padding:2px 6px;text-align:right;font-weight:600">Coste</th>
            </tr></thead>
            <tbody>${ingRows}</tbody>
          </table>`:''}
          ${recetaScreen}
        </div>`:'';
      return `<div style="border:1.5px solid var(--brd);border-radius:10px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-weight:700">${e.nombre||'Sin nombre'}</div>
          <span class="badge" style="background:#f3f4f6;color:var(--txt)">${e.categoria||'Otros'}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:12px;text-align:center">
          <div><div style="color:var(--mut)">Coste</div><div style="font-weight:700">${escFmt(coste)}</div></div>
          <div><div style="color:var(--mut)">PVP</div><div style="font-weight:700">${pvp>0?escFmt(pvp):'—'}</div></div>
          <div><div style="color:var(--mut)">Food cost</div><div style="font-weight:700;${fcCls}">${fcReal!==null?fcReal.toFixed(1)+'%':'—'}</div></div>
        </div>
        ${margen!==null?`<div style="text-align:right;font-size:12px;margin-top:6px;color:var(--mut)">Margen: <strong style="color:var(--txt)">${escFmt(margen)}</strong></div>`:''}
        ${e.notas?`<div style="margin-top:6px;font-size:12px;color:var(--mut)"> ${e.notas}</div>`:''}
        ${(ings.length||hasReceta)?`<div style="margin-top:8px;display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" style="font-size:11px;flex:1" onclick="S._escLocalExpanded['${id}']=!S._escLocalExpanded['${id}'];render()">
            ${expanded?'▲ Ocultar':(ings.length&&hasReceta?'▼ Ver ingredientes y receta':ings.length?'▼ Ver ingredientes ('+ings.length+')':'▼ Ver receta')}
          </button>
          ${hasReceta?`<button class="btn btn-ghost btn-sm" style="font-size:11px;flex:1" onclick="escImprimirReceta('${id}')"> Imprimir receta</button>`:''}
        </div>`:''}
        ${detailHtml}
      </div>`;
    }).join('');
  }
  html+='</div>';

  if(myMenus.length){
    html+='<div class="card"><div class="card-t">Mis menús</div>';
    html+=myMenus.map(([,m])=>{
      const escs=(m.escandallos||[]).map(eid=>_escAllData[eid]).filter(Boolean);
      const costeTotal=escs.reduce((s,e)=>s+escCosteTotal(e),0);
      const pvp=parseFloat(m.pvp)||0;
      const margen=pvp>0?(pvp-costeTotal):null;
      return `<div style="border:1.5px solid var(--brd);border-radius:10px;padding:12px;margin-bottom:8px">
        <div style="font-weight:700;margin-bottom:8px">${m.nombre}</div>
        <div style="font-size:12px;color:var(--mut);margin-bottom:6px">${escs.map(e=>e.nombre).join(' · ')}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:12px;text-align:center">
          <div><div style="color:var(--mut)">Coste</div><div style="font-weight:700">${escFmt(costeTotal)}</div></div>
          <div><div style="color:var(--mut)">PVP</div><div style="font-weight:700">${pvp>0?escFmt(pvp):'—'}</div></div>
          <div><div style="color:var(--mut)">Margen</div><div style="font-weight:700">${margen!==null?escFmt(margen):'—'}</div></div>
        </div>
        ${m.notas?`<div style="margin-top:6px;font-size:12px;color:var(--mut)"> ${m.notas}</div>`:''}
      </div>`;
    }).join('');
    html+='</div>';
  }
  return html;
}

function escFmt(v){ return parseFloat(v||0).toFixed(2).replace('.',',')+' €'; }
