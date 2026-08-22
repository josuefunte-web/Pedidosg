/* ═══════════════ MENÚS ═══════════════ */
function menRender(){
  const grid=document.getElementById('men-grid');
  if(!grid) return;
  const txt=(document.getElementById('men-search')?.value||'').toLowerCase();
  const local=document.getElementById('men-local-filter')?.value||'';
  const entries=Object.entries(_menAllData).filter(([,m])=>{
    return (!txt||m.nombre?.toLowerCase().includes(txt))&&(!local||m.restaurante===local||(m.restaurante||'global')==='global');
  }).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||'','es'));
  if(!entries.length){
    grid.innerHTML='<p style="color:var(--mut)">No hay menús. Crea el primero con "+ Nuevo menú".</p>';
    return;
  }
  const CURSOS=[
    {key:'pri',label:'Primeros',cats:['Primeros'],cls:'c-pri'},
    {key:'seg',label:'Segundos',cats:['Segundos','Carnes','Pescados'],cls:'c-seg'},
    {key:'pos',label:'Postres',cats:['Postres'],cls:'c-pos'},
    {key:'otr',label:'Otros',cats:['Entrantes','Bebidas','Otros'],cls:'c-otr'},
  ];
  grid.innerHTML=entries.map(([id,m])=>{
    const escs=(m.escandallos||[]).map(eid=>({id:eid,...(_escAllData[eid]||{})})).filter(e=>e.nombre);
    const costeTotal=escs.reduce((s,e)=>s+escCosteTotal(e),0);
    const pvp=parseFloat(m.pvp)||0;
    const fcReal=pvp>0?(costeTotal/pvp*100):null;
    const margen=pvp>0?(pvp-costeTotal):null;
    const margenPct=pvp>0&&margen!==null?(margen/pvp*100):null;
    const rest=m.restaurante||'global';
    const restBadge=rest==='global'
      ?`<span style="font-size:10px;background:#dbeafe;color:#1d4ed8;border-radius:10px;padding:1px 7px;font-weight:600">Global</span>`
      :`<span style="font-size:10px;background:#f3e8ff;color:#7c3aed;border-radius:10px;padding:1px 7px;font-weight:600">${rest}</span>`;
    const fcCls=fcReal===null?'esc-ok':fcReal>35?'esc-bad':fcReal>30?'esc-warn':'esc-ok';
    // Cursos con platos
    const cursoCols=CURSOS.map(curso=>{
      const platos=escs.filter(e=>{
        const cat=e.categoria||'Otros';
        return curso.cats.includes(cat);
      });
      const dishRows=platos.length
        ?platos.map(e=>`<div class="men-dish"><span class="men-dish-name">${e.nombre}</span><span class="men-dish-cost">${escFmt(escCosteTotal(e))}</span></div>`).join('')
        :`<div class="men-empty-course">—</div>`;
      return `<div class="men-course ${curso.cls}"><div class="men-course-title">${curso.label}</div>${dishRows}</div>`;
    }).join('');
    return `<div class="men-card" onclick="menOpenModal('${id}')">
      <div class="men-card-hd">
        <div>
          <div class="men-card-name">${m.nombre||'Sin nombre'}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${restBadge}${m.notas?`<span style="font-size:11px;color:var(--mut)">${m.notas}</span>`:''}</div>
        </div>
        <div class="esc-fc-ind ${fcCls}" style="position:relative;top:0;right:0;flex-shrink:0">${fcReal!==null?fcReal.toFixed(0)+'%':'—'}</div>
      </div>
      <div class="men-courses">${cursoCols}</div>
      <div class="men-stats">
        <div class="men-stat"><div class="k">Coste</div><div class="v">${escFmt(costeTotal)}</div></div>
        <div class="men-stat"><div class="k">PVP</div><div class="v">${pvp>0?escFmt(pvp):'—'}</div></div>
        <div class="men-stat"><div class="k">Margen</div><div class="v">${margen!==null?escFmt(margen):'—'}</div></div>
        <div class="men-stat"><div class="k">% Margen</div><div class="v">${margenPct!==null?margenPct.toFixed(1)+'%':'—'}</div></div>
      </div>
    </div>`;
  }).join('');
}

function menOpenModal(id=null){
  _menEditId=id;
  document.getElementById('men-modal-title').textContent=id?'Editar menú':'Nuevo menú';
  document.getElementById('men-btn-del').style.display=id?'':'none';
  if(id&&_menAllData[id]){
    const m=_menAllData[id];
    document.getElementById('men-nombre').value=m.nombre||'';
    document.getElementById('men-local').value=m.restaurante||'global';
    document.getElementById('men-pvp').value=m.pvp||'';
    document.getElementById('men-notas').value=m.notas||'';
    _menEscIds=[...(m.escandallos||[])];
  } else {
    document.getElementById('men-nombre').value='';
    document.getElementById('men-local').value='global';
    document.getElementById('men-pvp').value='';
    document.getElementById('men-notas').value='';
    _menEscIds=[];
  }
  menRenderSelector();
  document.getElementById('men-modal-ov').style.display='flex';
}
function menCloseModal(){ document.getElementById('men-modal-ov').style.display='none'; _menEditId=null; _menEscIds=[]; }

function menRenderSelector(){
  const cont=document.getElementById('men-esc-selector');
  if(!cont) return;
  const allEscs=Object.entries(_escAllData).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||'','es'));
  if(!allEscs.length){
    cont.innerHTML='<p style="color:var(--mut);font-size:13px;grid-column:1/-1">No hay escandallos. Crea alguno primero.</p>';
    return;
  }
  // Agrupar por categoría (usando ESC_CATS)
  const byCat={};
  allEscs.forEach(([id,e])=>{const c=e.categoria||'Otros';if(!byCat[c])byCat[c]=[];byCat[c].push([id,e]);});
  const orderedCats=[...ESC_CATS,...Object.keys(byCat).filter(c=>!ESC_CATS.includes(c))].filter(c=>byCat[c]);
  if(!orderedCats.length){
    cont.innerHTML='<p style="color:var(--mut);font-size:13px;grid-column:1/-1">No hay escandallos con categoría asignada.</p>';
    menUpdateCoste(); return;
  }
  cont.innerHTML=`<div style="display:flex;flex-direction:column;gap:14px;width:100%">${orderedCats.map(cat=>{
    const color=ESC_CAT_COLORS[cat]||'#64748b';
    const items=byCat[cat].map(([id,e])=>{
      const sel=_menEscIds.includes(id);
      const coste=escCosteTotal(e);
      return `<div class="men-sel-item${sel?' sel':''}" onclick="menToggleEsc('${id}')">
        <input type="checkbox" ${sel?'checked':''} style="pointer-events:none;accent-color:var(--pri);width:14px;height:14px;flex-shrink:0;margin-top:1px" readonly/>
        <div style="min-width:0">
          <div class="isn">${e.nombre}</div>
          <div class="isc">${escFmt(coste)}</div>
        </div>
      </div>`;
    }).join('');
    return `<div>
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${color};border-bottom:2px solid ${color}40;padding-bottom:4px;margin-bottom:8px">${cat}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">${items}</div>
    </div>`;
  }).join('')}</div>`;
  menUpdateCoste();
}
function menToggleEsc(id){
  const i=_menEscIds.indexOf(id);
  if(i>=0) _menEscIds.splice(i,1); else _menEscIds.push(id);
  menRenderSelector();
}
function menUpdateCoste(){
  const total=_menEscIds.reduce((s,id)=>{
    const e=_escAllData[id];
    return e?s+escCosteTotal(e):s;
  },0);
  const el=document.getElementById('men-coste-total');
  if(el) el.textContent=escFmt(total);
}
function menSave(){
  if(!fbDb){toast('Sin conexión Firebase','#dc2626');return;}
  const nombre=(document.getElementById('men-nombre')?.value||'').trim();
  if(!nombre){toast('Escribe el nombre del menú','#dc2626');return;}
  const data={
    nombre,
    restaurante:document.getElementById('men-local')?.value||'global',
    pvp:parseFloat(document.getElementById('men-pvp')?.value)||0,
    notas:document.getElementById('men-notas')?.value.trim()||'',
    escandallos:[..._menEscIds],
    updatedAt:Date.now()
  };
  const ref=_menEditId?fbDb.ref('menus/'+_menEditId):fbDb.ref('menus').push();
  if(!_menEditId) data.createdAt=Date.now();
  ref.set(data).then(()=>{menCloseModal();toast('Menú guardado','#16a34a');}).catch(e=>toast('Error: '+e.message,'#dc2626'));
}
function menExportPDF(){
  const nombre=(document.getElementById('men-nombre')?.value||'Menú').trim();
  const local=document.getElementById('men-local')?.value||'global';
  const pvp=parseFloat(document.getElementById('men-pvp')?.value)||0;
  const notas=(document.getElementById('men-notas')?.value||'').trim();
  const escs=_menEscIds.map(id=>_escAllData[id]).filter(Boolean);
  if(!escs.length){toast('Añade escandallos antes de exportar','#dc2626');return;}
  const costeTotal=escs.reduce((s,e)=>s+escCosteTotal(e),0);
  const fcReal=pvp>0?(costeTotal/pvp*100):null;
  const margen=pvp>0?(pvp-costeTotal):null;

  const escRows=escs.map(e=>{
    const coste=escCosteTotal(e);
    const ingsRows=(e.ingredientes||[]).map(ing=>{
      const liveP=escLivePrice(ing);
      const merma=parseFloat(ing.merma)||0;
      const costeIng=escCosteFactor(ing);
      return `<tr style="background:#fafafa">
        <td style="padding:4px 10px 4px 24px;font-size:12px;color:#555">${ing.nombre}${ing.proveedorId===null?' <em>(libre)</em>':''}</td>
        <td style="text-align:center;font-size:12px">${ing.cantidad} ${ing.unidad}</td>
        <td style="text-align:center;font-size:12px">${merma>0?merma+'%':'—'}</td>
        <td style="text-align:right;font-size:12px">${escFmt(liveP)}</td>
        <td style="text-align:right;font-size:12px;font-weight:600">${escFmt(costeIng)}</td>
      </tr>`;
    }).join('');
    return `<tr style="background:#f0f4ff">
        <td colspan="4" style="padding:8px 10px;font-weight:700;font-size:13px;color:#1a1a2e">${e.nombre} <span style="font-size:11px;font-weight:400;color:#888">${e.categoria||''}</span></td>
        <td style="text-align:right;padding:8px 10px;font-weight:700;font-size:13px">${escFmt(coste)}</td>
      </tr>${ingsRows}`;
  }).join('');

  const fcColor=fcReal===null?'#333':fcReal>35?'#dc2626':fcReal>30?'#d97706':'#16a34a';
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${nombre}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:28px;color:#111;max-width:800px;margin:0 auto}
    h1{font-size:24px;margin-bottom:2px;color:#1a1a2e}
    .meta{color:#666;font-size:13px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;font-size:12px}
    th:not(:first-child){text-align:center}th:last-child{text-align:right}
    td{border-bottom:1px solid #e5e7eb}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}
    .sum-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}
    .sum-label{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.4px}
    .sum-val{font-size:20px;font-weight:800;margin-top:4px}
    .notas{margin-top:14px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px}
    @media print{body{padding:10px}}
  </style></head><body>
  <h1>🍽 ${nombre}</h1>
  <div class="meta">${local!=='global'?''+local+' · ':''}${escs.length} platos · Generado ${new Date().toLocaleDateString('es-ES')}</div>
  <table>
    <thead><tr>
      <th>Plato / Ingrediente</th>
      <th style="text-align:center">Cantidad</th>
      <th style="text-align:center">Merma</th>
      <th style="text-align:right">Precio/u.</th>
      <th style="text-align:right">Coste</th>
    </tr></thead>
    <tbody>${escRows}</tbody>
    <tfoot><tr style="background:#1a1a2e;color:#fff">
      <td colspan="4" style="padding:10px;font-weight:700;font-size:14px">COSTE TOTAL DEL MENÚ</td>
      <td style="text-align:right;padding:10px;font-weight:800;font-size:16px">${escFmt(costeTotal)}</td>
    </tr></tfoot>
  </table>
  <div class="summary">
    <div class="sum-box"><div class="sum-label">Coste total</div><div class="sum-val">${escFmt(costeTotal)}</div></div>
    <div class="sum-box"><div class="sum-label">PVP menú</div><div class="sum-val">${pvp>0?escFmt(pvp):'—'}</div></div>
    <div class="sum-box"><div class="sum-label">Margen bruto</div><div class="sum-val">${margen!==null?escFmt(margen):'—'}</div></div>
    <div class="sum-box"><div class="sum-label">Food cost</div><div class="sum-val" style="color:${fcColor}">${fcReal!==null?fcReal.toFixed(1)+'%':'—'}</div></div>
  </div>
  ${notas?`<div class="notas"> ${notas}</div>`:''}
  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`;
  const w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Activa los popups para exportar el PDF','#d97706',4000);
}

function menDelete(){
  if(!_menEditId||!confirm('¿Eliminar este menú?')) return;
  fbDb.ref('menus/'+_menEditId).remove().then(()=>{menCloseModal();toast('Menú eliminado','#888');});
}
