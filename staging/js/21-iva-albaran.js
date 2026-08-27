/* ═══════════════ IVA POR LÍNEA ═══════════════ */
function albFindCatProd(it){
  const sup=suppliers[S.albSupId]; if(!sup) return null;
  const prods=Array.isArray(sup.products)?sup.products:Object.values(sup.products||{});
  const code=String(it.code||'').trim();
  const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
  return prods.find(p=>(code&&String(p.code||'').trim()===code)||norm(p.name)===norm(it.name))||null;
}
function albLineIva(it){
  if(it.iva!==undefined&&it.iva!==null&&it.iva!=='') return parseFloat(it.iva);
  const p=albFindCatProd(it); if(p&&p.iva!=null&&p.iva!=='') return parseFloat(p.iva);
  return 10; // por defecto 10%
}
function albSetIva(i,val){
  const iva=parseFloat(val); if(isNaN(iva)) return;
  S.albItems[i].iva=iva;
  // grabar el IVA en el catálogo del producto para la próxima vez
  const p=albFindCatProd(S.albItems[i]); if(p){ p.iva=iva; saveSups(S.albSupId); }
  render();
}
