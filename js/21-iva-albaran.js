/* ═══════════════ IVA POR LÍNEA ═══════════════ */
// Versiones parametrizadas por supId (las usa también la importación por
// lotes de js/48-import-dia.js, donde cada borrador tiene su propio
// proveedor y no depende de S.albSupId).
function catProdFor(it, supId){
  const sup=suppliers[supId]; if(!sup) return null;
  const prods=Array.isArray(sup.products)?sup.products:Object.values(sup.products||{});
  const code=String(it.code||'').trim();
  const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
  return prods.find(p=>(code&&String(p.code||'').trim()===code)||norm(p.name)===norm(it.name))||null;
}
function lineIvaFor(it, supId){
  if(it.iva!==undefined&&it.iva!==null&&it.iva!=='') return parseFloat(it.iva);
  const p=catProdFor(it, supId); if(p&&p.iva!=null&&p.iva!=='') return parseFloat(p.iva);
  return 10; // por defecto 10%
}
function albFindCatProd(it){ return catProdFor(it, S.albSupId); }
function albLineIva(it){ return lineIvaFor(it, S.albSupId); }
function albSetIva(i,val){
  const iva=parseFloat(val); if(isNaN(iva)) return;
  S.albItems[i].iva=iva;
  // grabar el IVA en el catálogo del producto para la próxima vez
  const p=albFindCatProd(S.albItems[i]); if(p){ p.iva=iva; saveSups(S.albSupId); }
  render();
}
