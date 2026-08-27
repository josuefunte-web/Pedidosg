/* ═══════════════ PRESUPUESTOS ═══════════════ */
function saveBudget(key,val){
  const v=parseFloat(val)||0;
  budgets[key]=v;
  if(fbDb)fbDb.ref('budgets/'+key).set(v);
}
function vBudgets(){
  const now=new Date();
  const curKey=now.toISOString().slice(0,7);
  const curLabel=now.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const spendByRest={};
  orders.filter(o=>(o.status==='approved'||o.status==='received')&&(o.createdAt||'').startsWith(curKey)).forEach(o=>{spendByRest[o.restaurant]=(spendByRest[o.restaurant]||0)+total(o);});
  Object.values(extraExpenses).filter(ex=>(ex.date||ex.createdAt||'').startsWith(curKey)).forEach(ex=>{spendByRest[ex.restaurant]=(spendByRest[ex.restaurant]||0)+(parseFloat(ex.amount)||0);});
  const cards=cfg.users.map(u=>{
    const bKey=u.id+'_'+curKey;
    const limit=budgets[bKey]||0;
    const spent=spendByRest[u.restaurant]||0;
    const pct=limit>0?Math.min((spent/limit)*100,100):0;
    const over=limit>0&&spent>limit;
    const barCol=over?'#dc2626':pct>80?'#ca8a04':'#16a34a';
    const status=limit>0?(over?`<span style="color:#dc2626;font-weight:700">+${fmt(spent-limit)}</span>`:`<span style="color:#16a34a">${Math.round(pct)}%</span>`):'';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--brd)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.restaurant}</div>
        <div style="font-size:12px;color:var(--mut);margin-top:2px">${fmt(spent)} gastado${limit>0?' de '+fmt(limit):''} ${status}</div>
        ${limit>0?`<div style="background:var(--brd);border-radius:3px;height:4px;margin-top:5px"><div style="background:${barCol};width:${pct}%;height:4px;border-radius:3px"></div></div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <input type="number" value="${limit||''}" placeholder="—" step="50" min="0"
          style="width:80px;padding:4px 6px;border:1px solid var(--brd);border-radius:6px;font-size:13px;text-align:right"
          onchange="saveBudget('${bKey}',this.value)"/>
        <span style="font-size:11px;color:var(--mut)">€</span>
      </div>
    </div>`;
  }).join('');
  return `<div class="card">
    <div class="card-t">Presupuesto mensual — <span style="text-transform:capitalize">${curLabel}</span></div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:8px">Introduce el límite de compras para cada local. Se avisa si se supera al aprobar pedidos.</div>
    ${cards}
  </div>
  <div class="card" style="margin-top:14px">
    <div class="card-t"> Gasto vs Presupuesto (últimos 6 meses)</div>
    <div class="ch-wrap"><canvas id="budget-trend-chart"></canvas></div>
  </div>`;
}
