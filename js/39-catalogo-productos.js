/* ═══════════════ CATÁLOGO DE PRODUCTOS ═══════════════ */
function prodSearchInput(el){
  S.prodSearch2=el.value;
  const pos=el.selectionStart;
  renderAdminContent();
  const ni=document.getElementById('prod-search-input');
  if(ni){ ni.focus(); try{ ni.setSelectionRange(pos,pos); }catch(e){} }
}

function vProductos(){
  const allSups=supList();
  if(!allSups.length) return `<div class="empty"><div class="ei"></div><div class="et">Sin proveedores configurados</div></div>`;

  // Filtros de estado
  if(!S.prodCatFilter) S.prodCatFilter='';
  if(!S.prodSupFilter) S.prodSupFilter='';
  if(!S.prodSearch2)   S.prodSearch2='';

  const supOpts=allSups.map(s=>`<option value="${s.id}"${S.prodSupFilter===s.id?' selected':''}>${s.emoji} ${s.name}</option>`).join('');
  const catOpts=PROD_CATS.map(c=>`<option value="${c}"${S.prodCatFilter===c?' selected':''}>${c}</option>`).join('');

  const filtersBar=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;align-items:center">
    <input type="text" id="prod-search-input" placeholder="Buscar producto o código..." value="${S.prodSearch2||''}"
      oninput="prodSearchInput(this)"
      style="flex:1;min-width:160px;padding:8px 12px;border:1.5px solid var(--brd);border-radius:9px;font-size:13px;background:var(--card);color:var(--txt)"/>
    <select onchange="S.prodSupFilter=this.value;renderAdminContent()"
      style="padding:8px 10px;border:1.5px solid var(--brd);border-radius:9px;font-size:13px;background:var(--card);color:var(--txt)">
      <option value="">Todos los proveedores</option>${supOpts}
    </select>
    <select onchange="S.prodCatFilter=this.value;renderAdminContent()"
      style="padding:8px 10px;border:1.5px solid var(--brd);border-radius:9px;font-size:13px;background:var(--card);color:var(--txt)">
      <option value="">Todas las categorías</option>${catOpts}
    </select>
    <button onclick="exportProductosExcel()" class="btn btn-ok btn-sm"
      style="white-space:nowrap"> Exportar Excel</button>
  </div>`;

  // Recopilar todos los productos con info de proveedor
  const term=(S.prodSearch2||'').toLowerCase().trim();
  const allProds=[];
  allSups.forEach(sup=>{
    if(S.prodSupFilter && sup.id!==S.prodSupFilter) return;
    (sup.products||[]).forEach(p=>{
      const cat=p.category||'Otros';
      if(S.prodCatFilter && cat!==S.prodCatFilter) return;
      if(term && !((p.name||'').toLowerCase().includes(term)||String(p.code||'').toLowerCase().includes(term))) return;
      allProds.push({...p, cat, supId:sup.id, supName:sup.name, supEmoji:sup.emoji});
    });
  });

  if(!allProds.length) return filtersBar+`<div class="empty"><div class="ei"></div><div class="et">Sin productos con esos filtros</div></div>`;

  // Agrupar por categoría
  const byCat={};
  allProds.forEach(p=>{ if(!byCat[p.cat])byCat[p.cat]=[]; byCat[p.cat].push(p); });
  const orderedCats=[...PROD_CATS,...Object.keys(byCat).filter(c=>!PROD_CATS.includes(c))].filter(c=>byCat[c]);

  const sections=orderedCats.map(cat=>{
    const color=catColor(cat);
    const rows=byCat[cat].map(p=>`
      <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--brd);transition:.15s" onmouseover="this.style.background='var(--srf)'" onmouseout="this.style.background=''">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--txt)">${p.name}</div>
          <div style="font-size:11px;color:var(--mut);margin-top:1px">${p.supEmoji} ${p.supName}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:14px;font-weight:700;color:var(--pri)">${fmt(p.price||0)}<span style="font-size:11px;font-weight:400;color:var(--mut)"> / ${p.unit||'u.'}</span></div>
          ${p.pesoGr?`<div style="font-size:11px;color:var(--mut)">${p.pesoGr} gr</div>`:''}
        </div>
      </div>`).join('');
    return `<div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
      <div style="padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--brd);background:${color}08">
        <div style="width:12px;height:12px;border-radius:50%;background:${color}"></div>
        <span style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${color}">${cat}</span>
        <span style="font-size:11px;color:var(--mut);margin-left:auto">${byCat[cat].length} producto${byCat[cat].length!==1?'s':''}</span>
      </div>
      ${rows}
    </div>`;
  }).join('');

  const total=allProds.length;
  return filtersBar+`<div style="font-size:13px;color:var(--mut);margin-bottom:12px">${total} producto${total!==1?'s':''} en ${orderedCats.length} categoría${orderedCats.length!==1?'s':''}</div>`+sections;
}

// Exporta todos los productos (nombre, precio, unidad, categoría, proveedor) a Excel.
// Respeta los filtros activos en la vista de Productos.
function exportProductosExcel(){
  const allSups=supList();
  const term=(S.prodSearch2||'').toLowerCase().trim();
  const rows=[];
  allSups.forEach(sup=>{
    if(S.prodSupFilter && sup.id!==S.prodSupFilter) return;
    (sup.products||[]).forEach(p=>{
      const cat=p.category||'Otros';
      if(S.prodCatFilter && cat!==S.prodCatFilter) return;
      if(term && !p.name.toLowerCase().includes(term)) return;
      rows.push({
        'Producto': p.name||'',
        'Precio (€)': p.price!=null?Number(p.price):'',
        'Unidad': p.unit||'',
        'Categoría': cat,
        'Proveedor': sup.name||''
      });
    });
  });
  if(!rows.length){ alert('No hay productos para exportar con los filtros actuales.'); return; }
  rows.sort((a,b)=> (a['Proveedor']||'').localeCompare(b['Proveedor']||'') || (a['Producto']||'').localeCompare(b['Producto']||''));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:32},{wch:12},{wch:10},{wch:18},{wch:24}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Productos');
  const fecha=new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb,`Productos_OCarro_${fecha}.xlsx`);
}
