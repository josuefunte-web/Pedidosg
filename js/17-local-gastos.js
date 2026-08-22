/* ═══════════════ LOCAL GASTOS ═══════════════ */
function vLocalGastos(){
  const rest=S.session.restaurant;
  const now=new Date();
  const curKey=now.toISOString().slice(0,7); // 'YYYY-MM'
  const monthName=now.toLocaleString('es-ES',{month:'long',year:'numeric'});

  // Pedidos del mes (aprobados + recibidos)
  const monthOrders=orders.filter(o=>o.restaurant===rest&&(o.status==='approved'||o.status==='received')&&(o.createdAt||'').startsWith(curKey));
  const monthTotal=monthOrders.reduce((s,o)=>s+total(o),0);

  // Desglose por proveedor con productos
  const bySupMap={};
  monthOrders.forEach(o=>{
    if(!bySupMap[o.supId]){const sup=suppliers[o.supId]||{};bySupMap[o.supId]={name:sup.name||o.supId,emoji:sup.emoji||'',total:0,orders:0,prods:{}};}
    bySupMap[o.supId].total+=total(o);
    bySupMap[o.supId].orders++;
    (o.items||[]).forEach(it=>{
      if(!bySupMap[o.supId].prods[it.id]) bySupMap[o.supId].prods[it.id]={name:it.name,unit:it.unit,price:it.price,qty:0,cost:0};
      bySupMap[o.supId].prods[it.id].qty+=it.qty;
      bySupMap[o.supId].prods[it.id].cost+=(it.qty||0)*(it.price||0);
    });
  });
  const bySupList=Object.values(bySupMap).sort((a,b)=>b.total-a.total);
  if(!S.gastoExpanded) S.gastoExpanded={};

  const gastoHtml=monthTotal>0?`
    <div style="background:linear-gradient(135deg,var(--pri),#3b82f6);color:#fff;border-radius:14px;padding:20px;margin-bottom:16px;text-align:center">
      <div style="font-size:13px;opacity:.85;margin-bottom:4px">Gasto en ${monthName}</div>
      <div style="font-size:32px;font-weight:800">${fmt(monthTotal)}</div>
      <div style="font-size:12px;opacity:.75;margin-top:4px">${monthOrders.length} pedido${monthOrders.length!==1?'s':''}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      ${bySupList.map(s=>{
        const pct=monthTotal>0?Math.round(s.total/monthTotal*100):0;
        const supId=Object.keys(bySupMap).find(k=>bySupMap[k]===s);
        const expanded=S.gastoExpanded[supId];
        const prodRows=Object.values(s.prods).sort((a,b)=>b.cost-a.cost).map(p=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:1px solid var(--brd);font-size:12px">
            <span style="color:var(--txt)">${p.name} <span style="color:var(--mut)">(${p.qty} ${p.unit})</span></span>
            <span style="font-weight:600">${fmt(p.cost)}</span>
          </div>`).join('');
        return `<div style="background:var(--card);border:1px solid var(--brd);border-radius:10px;padding:12px 14px;cursor:pointer" onclick="S.gastoExpanded['${supId}']=!S.gastoExpanded['${supId}'];render()">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-weight:600">${s.emoji} ${s.name}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:700;color:var(--pri)">${fmt(s.total)}</span>
              <span style="font-size:12px;color:var(--mut)">${expanded?'▲':'▼'}</span>
            </div>
          </div>
          <div style="background:var(--brd);border-radius:4px;height:6px">
            <div style="background:var(--pri);border-radius:4px;height:6px;width:${pct}%"></div>
          </div>
          <div style="font-size:11px;color:var(--mut);margin-top:4px">${pct}% del total · ${s.orders} pedido${s.orders!==1?'s':''}</div>
          ${expanded?`<div style="margin-top:8px">${prodRows}</div>`:''}
        </div>`;
      }).join('')}
    </div>`
  :`<div class="empty" style="margin-bottom:20px"><div class="ei" style="font-size:36px;font-weight:800;color:var(--brd)">—</div><div class="et">Sin pedidos aprobados en ${monthName}</div></div>`;

  // Comparador de precios
  const sups=visibleSups();
  const search=(S.precioSearch||'').toLowerCase().trim();

  // Colectar todos los productos de todos los proveedores visibles
  const prodMap={}; // normName -> [{supId, supName, supEmoji, price, unit, origName}]
  sups.forEach(s=>{
    (s.products||[]).forEach(p=>{
      const norm=p.name.toLowerCase().trim();
      if(!prodMap[norm]) prodMap[norm]=[];
      prodMap[norm].push({supId:s.id,supName:s.name,supEmoji:s.emoji,price:p.price,unit:p.unit,origName:p.name});
    });
  });

  // Solo mostrar productos que aparecen en >1 proveedor O que coincidan con búsqueda
  let entries=Object.entries(prodMap);
  if(search) entries=entries.filter(([norm])=>norm.includes(search));
  else entries=entries.filter(([,list])=>list.length>1);
  entries.sort(([a],[b])=>a.localeCompare(b,'es'));

  const comparadorHtml=`
    <div class="sh">Comparador de precios</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Productos disponibles en varios proveedores. El más barato aparece destacado.</div>
    <div style="position:relative;margin-bottom:12px">
      <input type="text" placeholder="Buscar producto..." value="${S.precioSearch||''}"
        oninput="S.precioSearch=this.value;render()"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--brd);border-radius:8px;font-size:14px;background:var(--card);color:var(--txt);box-sizing:border-box"/>
    </div>
    ${entries.length?entries.map(([norm,list])=>{
      const sorted=[...list].sort((a,b)=>a.price-b.price);
      const minPrice=sorted[0].price;
      return `<div style="background:var(--card);border:1px solid var(--brd);border-radius:10px;padding:12px 14px;margin-bottom:8px">
        <div style="font-weight:600;margin-bottom:8px;text-transform:capitalize">${sorted[0].origName}</div>
        ${sorted.map((p,i)=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;${i<sorted.length-1?'border-bottom:1px solid var(--brd)':''}">
            <span style="font-size:13px">${p.supEmoji} ${p.supName}</span>
            <span style="display:flex;align-items:center;gap:6px">
              <span style="font-weight:700;color:${p.price===minPrice?'#16a34a':'var(--txt)'}">${fmt(p.price)}<span style="font-size:11px;font-weight:400;color:var(--mut)"> / ${p.unit}</span></span>
              ${p.price===minPrice&&list.length>1?'<span style="background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px">MEJOR PRECIO</span>':''}
            </span>
          </div>`).join('')}
      </div>`;
    }).join(''):`<div class="empty"><div class="ei"></div><div class="et">${search?'Sin resultados para "'+search+'"':'Sin productos en varios proveedores'}</div></div>`}`;

  return gastoHtml+comparadorHtml;
}
