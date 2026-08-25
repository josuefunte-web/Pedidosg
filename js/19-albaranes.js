/* ═══════════════ ALBARANES ═══════════════ */
function vComprasProducto(){
  const sups=supList();
  const supSel=`<div class="fg" style="margin-bottom:0"><label>Proveedor</label><select onchange="S.comprasSup=this.value;renderAdminContent()"><option value="">Todos</option>${sups.map(s=>`<option value="${s.id}" ${S.comprasSup===s.id?'selected':''}>${s.emoji} ${s.name}</option>`).join('')}</select></div>`;
  const desde=`<div class="fg" style="margin-bottom:0"><label>Desde</label><input type="date" value="${S.comprasDesde||''}" onchange="S.comprasDesde=this.value;renderAdminContent()"/></div>`;
  const hasta=`<div class="fg" style="margin-bottom:0"><label>Hasta</label><input type="date" value="${S.comprasHasta||''}" onchange="S.comprasHasta=this.value;renderAdminContent()"/></div>`;
  const limpiar=(S.comprasSup||S.comprasDesde||S.comprasHasta)?`<button class="btn btn-ghost btn-sm" style="align-self:flex-end" onclick="S.comprasSup='';S.comprasDesde='';S.comprasHasta='';renderAdminContent()">Limpiar filtros</button>`:'';
  const exportar=`<button class="btn btn-ok btn-sm" style="align-self:flex-end;white-space:nowrap" onclick="exportComprasExcel()"> Exportar Excel</button>`;
  const filtros=`<div class="card" style="margin-bottom:14px"><div class="three-col" style="align-items:end">${supSel}${desde}${hasta}${exportar}${limpiar}</div></div>`;
  // Agregar por producto a partir de los PEDIDOS realizados (aprobados/recibidos)
  const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
  const agg={};
  const pedidosSet=new Set();
  (orders||[]).filter(o=>o.status==='approved'||o.status==='received').forEach(o=>{
    if(S.comprasSup && o.supId!==S.comprasSup) return;
    const fecha=(o.createdAt||'').slice(0,10);
    if(S.comprasDesde && fecha<S.comprasDesde) return;
    if(S.comprasHasta && fecha>S.comprasHasta) return;
    pedidosSet.add(o.id);
    (o.items||[]).forEach(it=>{
      if(!it.name) return;
      const qty=parseFloat(it.qty)||0;
      const importe=qty*(parseFloat(it.price)||0);
      const key=(String(it.code||'').trim())||norm(it.name);
      if(!agg[key]) agg[key]={name:it.name,code:it.code||'',unit:it.unit||'',supId:o.supId,qty:0,importe:0,veces:0,lastDate:fecha,lastPrice:parseFloat(it.price)||0};
      const g=agg[key];
      g.qty+=qty; g.importe+=importe; g.veces++;
      if(fecha>=(g.lastDate||'')){ g.lastDate=fecha; g.lastPrice=parseFloat(it.price)||0; g.name=it.name; g.unit=it.unit||g.unit; }
    });
  });
  const rows=Object.values(agg).sort((x,y)=>y.importe-x.importe);
  const totImporte=rows.reduce((s,r)=>s+r.importe,0);
  const totPedidos=pedidosSet.size;
  if(!rows.length) return filtros+`<div class="empty"><div class="ei"></div><div class="et">Sin compras en el periodo seleccionado</div></div>`;
  const trs=rows.map(r=>{
    const sup=suppliers[r.supId]||{name:'',emoji:''};
    return `<tr><td>${r.code?`<small style="color:var(--mut)">[${r.code}]</small> `:''}${r.name}</td><td style="font-size:12px;color:var(--mut)">${sup.emoji||''} ${sup.name||''}</td><td style="text-align:right">${r.qty.toFixed(2)} ${r.unit}</td><td style="text-align:right">${fmt(r.importe)}</td><td style="text-align:right">${r.veces}</td></tr>`;
  }).join('');
  const table=`<div class="card"><div class="card-t">Compras por producto</div>
    <div style="font-size:13px;color:var(--mut);margin-bottom:10px">${rows.length} producto${rows.length!==1?'s':''} · ${totPedidos} pedido${totPedidos!==1?'s':''} · Total gastado: <strong style="color:var(--txt)">${fmt(totImporte)}</strong></div>
    <div style="overflow-x:auto"><table class="spend-table"><tr><th>Producto</th><th>Proveedor</th><th style="text-align:right">Cantidad</th><th style="text-align:right">Importe</th><th style="text-align:right">Pedidos</th></tr>${trs}</table></div></div>`;
  return filtros+table;
}

function exportComprasExcel(){
  const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
  const agg={};
  (orders||[]).filter(o=>o.status==='approved'||o.status==='received').forEach(o=>{
    if(S.comprasSup && o.supId!==S.comprasSup) return;
    const fecha=(o.createdAt||'').slice(0,10);
    if(S.comprasDesde && fecha<S.comprasDesde) return;
    if(S.comprasHasta && fecha>S.comprasHasta) return;
    (o.items||[]).forEach(it=>{
      if(!it.name) return;
      const qty=parseFloat(it.qty)||0;
      const importe=qty*(parseFloat(it.price)||0);
      const key=(String(it.code||'').trim())||norm(it.name);
      if(!agg[key]) agg[key]={name:it.name,code:it.code||'',unit:it.unit||'',supId:o.supId,qty:0,importe:0,veces:0,lastDate:fecha,lastPrice:parseFloat(it.price)||0};
      const g=agg[key];
      g.qty+=qty; g.importe+=importe; g.veces++;
      if(fecha>=(g.lastDate||'')){ g.lastDate=fecha; g.lastPrice=parseFloat(it.price)||0; g.name=it.name; g.unit=it.unit||g.unit; }
    });
  });
  const list=Object.values(agg).sort((x,y)=>y.importe-x.importe);
  if(!list.length){ alert('No hay compras para exportar con los filtros actuales.'); return; }
  const rows=list.map(r=>({
    'Código': r.code||'',
    'Producto': r.name||'',
    'Proveedor': (suppliers[r.supId]||{}).name||'',
    'Cantidad': Number(r.qty.toFixed(2)),
    'Unidad': r.unit||'',
    'Importe (€)': Number(r.importe.toFixed(2)),
    'Pedidos': r.veces,
    'Último precio (€)': Number((r.lastPrice||0).toFixed(2)),
    'Última compra': r.lastDate||''
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:10},{wch:32},{wch:22},{wch:10},{wch:8},{wch:12},{wch:8},{wch:14},{wch:14}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Compras');
  const fecha=new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb,`Compras_por_producto_OCarro_${fecha}.xlsx`);
}

function vAlbaranes(){
  const btn=`<button class="btn btn-pri btn-sm" onclick="goAlbaranAdmin()" style="margin-bottom:14px">+ Nuevo albarán</button>`;
  const byRest={};
  orders.filter(o=>o.status==='approved'||o.status==='received').forEach(o=>{ if(!byRest[o.restaurant])byRest[o.restaurant]={ordered:0,received:0}; byRest[o.restaurant].ordered+=total(o); });
  albNotes.forEach(a=>{ if(!byRest[a.restaurant])byRest[a.restaurant]={ordered:0,received:0}; const calcT=(a.items||[]).reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0); byRest[a.restaurant].received+=(a.totalManual!=null?a.totalManual:calcT); });
  const tableRows=Object.entries(byRest).map(([rest,d])=>{
    const diff=d.received-d.ordered;
    const pct=d.ordered>0?((diff/d.ordered)*100).toFixed(1):'-';
    const cls=Math.abs(diff)<1?'diff-ok':diff>0?'diff-err':'diff-warn';
    return `<tr><td>${(rest||'').replace("",'')}</td><td>${fmt(d.ordered)}</td><td>${fmt(d.received)}</td><td class="${cls}">${diff>=0?'+':''}${fmt(diff)}${pct!=='-'?' ('+pct+'%)':''}</td></tr>`;
  }).join('');
  const table=tableRows?`<div class="card"><div class="card-t">Pedido vs Recibido por local</div><div style="overflow-x:auto"><table class="spend-table"><tr><th>Local</th><th>Pedido</th><th>Recibido</th><th>Diferencia</th></tr>${tableRows}</table></div></div>`:'';
  const notes=albNotes.length?albNotes.map(a=>albCard(a)).join(''):`<div class="empty"><div class="ei"></div><div class="et">Sin albaranes registrados</div></div>`;
  return btn+table+`<div class="sh">Albaranes</div>`+notes;
}

function goAlbaranAdmin(){ S.view='albaran-new';S.albItems=[];S.albRestaurant='';S.albSupId=supList()[0]?.id||'';S.albPhoto=null;S.albFileType=null;S.albFileName=null;S.albDate=new Date().toISOString().split('T')[0];S.albTotalManual=null;render(); }

function albCard(a){
  const sup=suppliers[a.supId]||{name:'?',emoji:'?'};
  const totCalc=(a.items||[]).reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
  const tot=a.totalManual!=null?a.totalManual:totCalc;
  const matchOrder=orders.find(o=>o.restaurant===a.restaurant&&o.supId===a.supId&&o.status==='approved');
  const matchingOrders=orders.filter(o=>(o.status==='approved'||o.status==='received')&&o.restaurant===a.restaurant&&o.supId===a.supId);
  const linkedOrder=a.orderId?orders.find(o=>o.id===a.orderId):null;
  const linkSection=a.orderId
    ? `<div style="font-size:12px;color:#16a34a;margin-top:6px"> Vinculado a pedido del ${fmtD(linkedOrder?linkedOrder.createdAt:'')}</div>`
    : matchingOrders.length
      ? `<select onchange="linkAlbToOrder('${a.id}',this.value)" style="font-size:12px;padding:4px 6px;border:1px solid var(--brd);border-radius:6px;background:var(--card);color:var(--txt);margin-top:6px;width:100%"><option value=""> Vincular a pedido…</option>${matchingOrders.map(o=>`<option value="${o.id}">Pedido ${fmtD(o.createdAt)} — ${fmt(total(o))}</option>`).join('')}</select>`
      : '';
  const hasIncidents=(a.items||[]).some(it=>it.incident);
  const rows=(a.items||[]).map(it=>`<div class="pr" style="${it.incident?'background:#fff5f5;border-radius:6px;padding:4px 6px;margin-bottom:2px':''}"><span class="pn">${it.code?`<small style="color:var(--mut)">[${it.code}]</small> `:''} ${it.name}${it.incident?`<div style="font-size:11px;color:#dc2626;margin-top:2px">${it.incident}</div>`:''}</span><span class="pq">${it.qty} ${it.unit}</span><span class="pp">${fmt((parseFloat(it.qty)||0)*(parseFloat(it.price)||0))}</span></div>`).join('');
  let cmp='';
  if(matchOrder){
    const cmpRows=(a.items||[]).map(ai=>{
      const oi=(matchOrder.items||[]).find(x=>x.name.toLowerCase()===ai.name.toLowerCase());
      if(!oi) return `<div class="cmp-cell cmp-warn"><div class="cmp-name">${ai.name}</div><div class="cmp-val">No estaba en el pedido</div></div>`;
      const qDiff=ai.qty-oi.qty;
      const cls=qDiff===0?'cmp-ok':Math.abs(qDiff/oi.qty)<0.05?'cmp-warn':'cmp-err';
      return `<div class="cmp-cell ${cls}"><div class="cmp-name">${ai.name}</div><div class="cmp-val">Pedido: ${oi.qty} · Recibido: ${ai.qty}${qDiff!==0?` (${qDiff>0?'+':''}${qDiff})`:' ✓'}</div></div>`;
    }).join('');
    cmp=`<div class="sh" style="margin-top:12px">Comparativa con pedido</div>${cmpRows}`;
  }
  return `<div class="alb-card">
    <div class="alb-hd">
      <div><div class="alb-rest">${a.restaurant}</div><div class="alb-info">${sup.emoji} ${sup.name} · ${new Date(a.date+'T00:00:00').toLocaleDateString('es-ES')}</div></div>
      <div style="display:flex;gap:6px">${hasIncidents?`<span class="badge" style="background:#dc2626;color:#fff">Incid.</span>`:''}<button class="btn btn-no btn-xs" onclick="delAlbF('${a.id}')"></button></div>
    </div>
    ${a.photo?`<img src="${a.photo}" class="alb-photo"/>`:''}
    <div class="pl">${rows}<div class="ptot">Total: ${fmt(tot)}${a.totalManual!=null?` <span style="font-size:11px;color:var(--mut);font-weight:400">(manual)</span>`:''}</div></div>
    ${cmp}
    ${linkSection}
  </div>`;
}

function delAlbF(id){ if(!confirm('¿Eliminar?'))return;deleteAlb(id);if(!fbDb){albNotes=albNotes.filter(a=>a.id!==id);}render(); }
function linkAlbToOrder(albId,orderId){
  if(!orderId) return;
  if(fbDb) fbDb.ref('albaranes/'+albId+'/orderId').set(orderId);
  const a=albNotes.find(x=>x.id===albId);if(a) a.orderId=orderId;
  renderAdminContent();
  toast(' Albarán vinculado al pedido','#16a34a');
}
