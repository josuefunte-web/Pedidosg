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
  const btn=`<button class="btn btn-pri btn-sm" onclick="goAlbaranAdmin()" style="margin-bottom:14px">+ Nuevo albarán</button>
  <button class="btn btn-blue btn-sm" onclick="goAlbaranBatch()" style="margin-bottom:14px;margin-left:8px" title="Sube un único PDF con todos los albaranes del día, de uno o varios proveedores">📄 Importar PDF del día</button>`;
  const importCard=`<div class="card" style="margin-bottom:14px">
    <div class="card-t">Importar albaranes históricos desde Excel</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Sube un .xlsx/.csv con columnas: Local, Proveedor, Nº Albarán, Día, Código, Artículo, Cantidad, Importe. Se crean los albaranes agrupados y se actualiza el código/precio de cada artículo en su proveedor. Las líneas cuyo proveedor o código no se reconozcan van a la cola de revisión.</div>
    <div class="file-input-wrap" style="max-width:360px">
      <div class="file-input-btn" style="padding:12px">Subir Excel de albaranes</div>
      <input type="file" accept=".xlsx,.xls,.csv" onchange="importAlbaranesExcel(this)"/>
    </div>
    <div id="alb-import-status" style="font-size:13px;margin-top:8px;color:var(--mut)"></div>
  </div>`;
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
  return btn+importCard+table+`<div class="sh">Albaranes</div>`+notes;
}

// ── Importación masiva de albaranes históricos desde Excel ─────────────────
// Columnas esperadas (nombres flexibles, se detectan por palabras clave):
// Local, Proveedor, Nº Albarán, Día, Código, Artículo/Descripción, Cantidad, Importe.
// Las filas se agrupan por (local, proveedor, nº albarán, día) en un albarán
// cada una. Por cada línea se busca el producto por código en el catálogo del
// proveedor: si existe se actualiza su precio (y nombre); si no existe, o si
// el proveedor del Excel no coincide con ninguno registrado, la línea se manda
// a la cola de revisión (pendingReview) en vez de crearse sola.
async function importAlbaranesExcel(input){
  const file=input.files&&input.files[0];
  if(!file) return;
  const setStatus=(msg,col)=>{ const el=document.getElementById('alb-import-status'); if(el){el.innerHTML=msg;el.style.color=col||'var(--mut)';} };
  setStatus('Leyendo archivo...');
  try{
    if(!window.XLSX){
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array',cellDates:true});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    if(!rows.length){ setStatus('El archivo está vacío o sin datos.','#dc2626'); return; }

    const sample=rows[0];
    const findKey=(...cands)=>{ for(const c of cands){ const k=Object.keys(sample).find(k=>k.toLowerCase().includes(c)); if(k) return k; } return null; };
    const localKey  = findKey('local','restaurante','tienda');
    const supKey    = findKey('proveedor','suministrador');
    const albNumKey = findKey('albarán','albaran','nº alb','n° alb','num alb');
    const dateKey   = findKey('día','dia','fecha');
    const codeKey   = findKey('código','codigo','ref','referencia');
    const nameKey   = findKey('artículo','articulo','descripci','desc','producto','nombre');
    const qtyKey    = findKey('cantidad','qty','uds','unidades');
    const importeKey= findKey('importe','total','monto');

    if(!localKey||!supKey||!nameKey||!qtyKey||!importeKey){
      setStatus('No se reconocen todas las columnas necesarias (Local, Proveedor, Artículo, Cantidad, Importe). Revisa los encabezados.','#dc2626');
      return;
    }
    const parseDate=v=>{
      if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
      const s=String(v||'').trim();
      if(!s) return new Date().toISOString().slice(0,10);
      const dm=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if(dm){ let [,d,m,y]=dm; if(y.length===2) y='20'+y; return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; }
      const d2=new Date(s); if(!isNaN(d2)) return d2.toISOString().slice(0,10);
      return new Date().toISOString().slice(0,10);
    };
    const normRest=v=>{
      const s=String(v||'').trim();
      const match=(cfg.users||[]).flatMap(u=>u.restaurants||[u.restaurant]).find(r=>(r||'').toLowerCase()===s.toLowerCase());
      return match||s;
    };
    const findSupplierByName=name=>{
      const n=String(name||'').trim().toLowerCase();
      if(!n) return null;
      return supList().find(s=>(s.name||'').trim().toLowerCase()===n)||null;
    };

    // Agrupar filas por local+proveedor+nº albarán+día
    const groups={};
    rows.forEach(r=>{
      const local=normRest(r[localKey]);
      const supName=String(r[supKey]||'').trim();
      const albNum=albNumKey?String(r[albNumKey]||'').trim():'';
      const date=parseDate(dateKey?r[dateKey]:'');
      const key=[local,supName,albNum,date].join('|');
      if(!groups[key]) groups[key]={local,supName,albNum,date,rows:[]};
      groups[key].rows.push(r);
    });

    let albCreated=0, prodUpdated=0, toReview=0, skippedGroups=0;
    const batch={};
    Object.values(groups).forEach(g=>{
      const sup=findSupplierByName(g.supName);
      if(!sup){
        // Proveedor del Excel no registrado — se manda una única revisión
        // por grupo en vez de crear un albarán huérfano.
        const rid='pr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
        fbDb && fbDb.ref('pendingReview/'+rid).set({
          id:rid, type:'excel-albaran-proveedor', supName:g.supName,
          name:`Albarán ${g.albNum||'s/n'} (${g.rows.length} líneas)`,
          restaurant:g.local, note:'Proveedor del Excel no coincide con ninguno registrado — regístralo y vuelve a importar.',
          createdAt:new Date().toISOString(), createdBy:S.session?.name||'Importación Excel'
        });
        skippedGroups++; toReview++;
        return;
      }
      if(!Array.isArray(sup.products)) sup.products=Object.values(sup.products||{});
      const items=g.rows.map(r=>{
        const name=String(r[nameKey]||'').trim();
        const code=codeKey?String(r[codeKey]||'').trim():'';
        const qty=parseFloat(String(r[qtyKey]||'0').replace(',','.'))||0;
        const importe=parseFloat(String(r[importeKey]||'0').replace(',','.'))||0;
        const price=qty>0?importe/qty:0;
        let needsReview=false;
        if(code){
          const prod=sup.products.find(p=>p.code===code);
          if(prod){ prod.name=name||prod.name; prod.price=price; prodUpdated++; }
          else { needsReview=true; }
        } else { needsReview=true; }
        if(needsReview){
          const rid='pr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+Math.random().toString(36).slice(2,4);
          fbDb && fbDb.ref('pendingReview/'+rid).set({
            id:rid, type:'excel-albaran', supName:sup.name, code, name, price,
            restaurant:g.local, note:`Albarán ${g.albNum||'s/n'} del ${g.date}`,
            createdAt:new Date().toISOString(), createdBy:S.session?.name||'Importación Excel'
          });
          toReview++;
        }
        return {name, code, unit:'UN', qty, price, ...(needsReview?{incident:'Pendiente de revisión'}:{})};
      });
      const albId='alb_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      batch[albId]={id:albId, restaurant:g.local, supId:sup.id, date:g.date, items, albNum:g.albNum||undefined, createdAt:new Date().toISOString(), source:'excel-import'};
      albCreated++;
      saveSups(sup.id);
    });

    if(fbDb){
      const writes=Object.entries(batch).map(([id,a])=>fbDb.ref('albaranes/'+id).set(a));
      await Promise.all(writes);
    }
    setStatus(`Importados ${albCreated} albarán(es), ${prodUpdated} producto(s) actualizados${toReview?`, ${toReview} línea(s)/grupo(s) enviados a revisión`:''}${skippedGroups?` (${skippedGroups} proveedor(es) sin registrar)`:''}.`,'#16a34a');
    toast(`${albCreated} albaranes importados`,'#16a34a',4500);
    input.value='';
  }catch(e){ setStatus('Error al leer el Excel: '+e.message,'#dc2626'); console.error(e); }
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
