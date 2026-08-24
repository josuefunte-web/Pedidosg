/* ═══════════════ COMPARATIVA PROVEEDORES ═══════════════ */
function vCompare(){
  const sups=supList();
  if(sups.length<2)return`<div class="empty"><div class="ei"></div><div class="et">Necesitas al menos 2 proveedores para comparar</div></div>`;
  const groups={};
  sups.forEach(sup=>{
    (sup.products||[]).forEach(p=>{
      const key=p.name.toLowerCase().trim();
      if(!groups[key])groups[key]={name:p.name,entries:{}};
      groups[key].entries[sup.id]={price:parseFloat(p.price)||0,unit:p.unit};
    });
  });
  const multi=Object.values(groups).filter(g=>Object.keys(g.entries).length>=2).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  if(!multi.length)return`<div class="empty"><div class="ei"></div><div class="et">No hay productos con el mismo nombre en varios proveedores</div></div>`;
  const headers=sups.map(s=>`<th style="text-align:right;padding:4px 8px 10px;font-size:11px;color:var(--mut);white-space:nowrap">${s.emoji} ${s.name}</th>`).join('');
  const rows=multi.map(g=>{
    const prices=Object.values(g.entries).map(e=>e.price).filter(p=>p>0);
    const minP=prices.length?Math.min(...prices):0;
    const cells=sups.map(sup=>{
      const e=g.entries[sup.id];
      if(!e)return`<td style="padding:6px 8px;text-align:right;color:var(--brd)">—</td>`;
      const cheap=e.price>0&&e.price===minP&&prices.filter(p=>p===minP).length<prices.length;
      return`<td style="padding:6px 8px;text-align:right;font-size:13px;${cheap?'color:#16a34a;font-weight:700':''}">${cheap?'':''}${fmt(e.price)}<span style="font-size:10px;color:var(--mut)">/${e.unit}</span></td>`;
    }).join('');
    return`<tr style="border-top:1px solid var(--brd)"><td style="padding:6px 4px 6px 0;font-size:13px">${g.name}</td>${cells}</tr>`;
  }).join('');
  return`<div class="card"><div class="card-t">Comparativa de precios entre proveedores</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:12px">= precio más bajo. Solo aparecen productos presentes en 2+ proveedores.</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr><th style="text-align:left;padding:4px 0 10px;font-size:11px;color:var(--mut)">Producto</th>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div></div>`;
}
