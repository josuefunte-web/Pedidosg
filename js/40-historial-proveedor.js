/* ═══════════════ HISTORIAL POR PROVEEDOR ═══════════════ */
function vSupHistory(){
  const supIds=supList().map(s=>s.id);
  if(!supIds.length) return `<div class="empty"><div class="ei"></div><div class="et">Sin proveedores</div></div>`;
  const allOrd=orders.filter(o=>o.status==='approved'||o.status==='received');
  if(!allOrd.length) return `<div class="empty"><div class="ei" style="font-size:36px;font-weight:800;color:var(--brd)">—</div><div class="et">Sin pedidos aprobados aún</div></div>`;

  // Periodo selector
  if(!S.supHistPeriod) S.supHistPeriod='all';
  const now=new Date();
  const curMonth=now.toISOString().slice(0,7);
  const curYear=now.toISOString().slice(0,4);
  function inPeriod(o){
    const d=o.createdAt||'';
    if(S.supHistPeriod==='month') return d.startsWith(curMonth);
    if(S.supHistPeriod==='year')  return d.startsWith(curYear);
    return true;
  }
  const filtOrd=allOrd.filter(inPeriod);
  const periodLabel={'all':'Todo el historial','month':'Este mes','year':'Este año'}[S.supHistPeriod];
  const periodBar=`<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
    ${['all','month','year'].map(p=>`<button class="stab${S.supHistPeriod===p?' act':''}" onclick="S.supHistPeriod='${p}';renderAdminContent()">${{'all':'Todo','month':'Este mes','year':'Este año'}[p]}</button>`).join('')}
  </div>`;

  // Obtener todos los restaurantes con pedidos
  const allRests=[...new Set(filtOrd.map(o=>o.restaurant).filter(Boolean))].sort();

  const rows=supIds.map(sid=>{
    const sup=suppliers[sid];
    const supOrders=filtOrd.filter(o=>o.supId===sid);
    if(!supOrders.length) return '';
    const totalSpend=supOrders.reduce((s,o)=>s+total(o),0);
    const lastOrder=supOrders.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];

    // Gasto por local en este proveedor
    const byRest={};
    supOrders.forEach(o=>{
      if(!byRest[o.restaurant]) byRest[o.restaurant]=0;
      byRest[o.restaurant]+=total(o);
    });
    const restRows=Object.entries(byRest)
      .sort((a,b)=>b[1]-a[1])
      .map(([rest,amt])=>{
        const pct=totalSpend>0?Math.round(amt/totalSpend*100):0;
        return `<div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
            <span style="font-weight:600">${rest}</span>
            <span style="font-weight:700;color:var(--pri)">${fmt(amt)}<span style="font-size:11px;color:var(--mut);font-weight:400"> (${pct}%)</span></span>
          </div>
          <div style="background:var(--brd);border-radius:4px;height:5px">
            <div style="background:var(--pri);border-radius:4px;height:5px;width:${pct}%;transition:width .3s"></div>
          </div>
        </div>`;
      }).join('');

    // Top productos
    const prodMap={};
    supOrders.forEach(o=>(o.items||[]).forEach(it=>{
      if(!prodMap[it.name]) prodMap[it.name]={name:it.name,unit:it.unit,qty:0,spend:0};
      prodMap[it.name].qty+=parseFloat(it.qty)||0;
      prodMap[it.name].spend+=(parseFloat(it.qty)||0)*(parseFloat(it.price)||0);
    }));
    const topProds=Object.values(prodMap).sort((a,b)=>b.spend-a.spend).slice(0,4);
    const prodRows=topProds.map(p=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--brd)">
      <span style="color:var(--txt)">${p.name} <span style="color:var(--mut)">${p.qty%1===0?p.qty:p.qty.toFixed(1)} ${p.unit}</span></span>
      <span style="font-weight:600">${fmt(p.spend)}</span>
    </div>`).join('');

    const open=S.supHistOpen===sid;
    return `<div class="card" style="margin-bottom:12px;padding:0;overflow:hidden">
      <div style="padding:16px 18px;cursor:pointer;display:flex;align-items:center;gap:12px" onclick="S.supHistOpen=S.supHistOpen==='${sid}'?null:'${sid}';renderAdminContent()">
        <div style="font-size:28px;min-width:36px;text-align:center">${sup.emoji||''}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:16px">${sup.name}</div>
          <div style="font-size:12px;color:var(--mut);margin-top:2px">${supOrders.length} pedidos · ${Object.keys(byRest).length} locales · Último ${fmtD(lastOrder.createdAt)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:20px;font-weight:800;color:var(--pri)">${fmt(totalSpend)}</div>
          <div style="font-size:11px;color:var(--mut)">${periodLabel}</div>
        </div>
        <span style="color:var(--mut);font-size:16px;margin-left:4px">${open?'▲':'▼'}</span>
      </div>
      ${open?`<div style="border-top:1px solid var(--brd);padding:16px 18px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap">
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--mut);margin-bottom:10px">Gasto por local</div>
            ${restRows}
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--mut);margin-bottom:10px">Top productos</div>
            ${prodRows||'<div style="font-size:12px;color:var(--mut)">Sin datos</div>'}
          </div>
        </div>
      </div>`:''}
    </div>`;
  }).filter(Boolean).join('');

  if(!rows) return periodBar+`<div class="empty"><div class="ei" style="font-size:36px;font-weight:800;color:var(--brd)">—</div><div class="et">Sin pedidos en este período</div></div>`;
  const totalAll=filtOrd.reduce((s,o)=>s+total(o),0);
  return periodBar+`<div style="font-size:13px;color:var(--mut);margin-bottom:14px">Total comprado ${periodLabel.toLowerCase()}: <strong style="color:var(--pri)">${fmt(totalAll)}</strong></div>`+rows;
}
