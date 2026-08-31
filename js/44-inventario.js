/* ══════════════════════════════════════════════════════════
   INVENTARIO
══════════════════════════════════════════════════════════ */

function restKey(name){ return (name||'').replace(/[.#$\[\]/]/g,'_').replace(/\s+/g,'_'); }

function getInvItems(rest){
  const k=restKey(rest);
  return Object.values(inventory[k]||{}).sort((a,b)=>(a.category||'').localeCompare(b.category||'es')||(a.name||'').localeCompare(b.name||'es'));
}

// ── MULTI-UNIT SUPPORT ───────────────────────────────────────────────
// Un item de inventario puede tener cantidades en varias unidades a la vez
// (ej: 1 Caja + 3 UN + 0.3 KG del mismo producto). El campo `qtys` guarda
// un mapa {unidad: cantidad}. Se mantiene compatibilidad con items antiguos
// que solo tienen `qty` + `unit`: se leen como {[unit]: qty}.
const INV_COMMON_UNITS=['KG','L','UN','Caja','Bote','Bolsa','g'];

function invItemQtys(it){
  if(!it) return {};
  if(it.qtys && typeof it.qtys==='object'){
    const out={};
    Object.entries(it.qtys).forEach(([u,q])=>{ const n=parseFloat(q); if(!isNaN(n)&&n!==0) out[u]=n; });
    return out;
  }
  const q=parseFloat(it.qty)||0;
  if(q!==0 && it.unit) return {[it.unit]:q};
  return {};
}
// Cadena legible: "0.3 KG · 1 Caja · 3 UN"
function invItemQtysStr(it){
  const qtys=invItemQtys(it);
  const entries=Object.entries(qtys);
  if(!entries.length) return '0 '+(it.unit||'ud');
  return entries.map(([u,q])=>`${q} ${u}`).join(' · ');
}
// Busca el producto en el catálogo de un proveedor para obtener las
// conversiones y así calcular precio por cada unidad. Match por categoría
// (emoji+nombre) y nombre; fallback a cualquier proveedor.
function findSupProdForInvItem(it){
  if(!it||!it.name) return null;
  const nameNorm=(it.name||'').trim().toLowerCase();
  const cat=(it.category||'').trim();
  for(const sup of Object.values(suppliers)){
    const supCat=(sup.emoji?sup.emoji+' ':'')+sup.name;
    if(cat===supCat||cat===sup.name){
      const p=(sup.products||[]).find(pp=>(pp.name||'').trim().toLowerCase()===nameNorm);
      if(p) return p;
    }
  }
  for(const sup of Object.values(suppliers)){
    const p=(sup.products||[]).find(pp=>(pp.name||'').trim().toLowerCase()===nameNorm);
    if(p) return p;
  }
  return null;
}
// Valor total del item = suma para cada unidad de (qty × precio_por_esa_unidad).
// Precio por unidad se obtiene del catálogo aplicando las conversiones (via
// effectivePrice de helpers.js). Si el item no está en ningún catálogo,
// usa su price directo solo para su unit principal.
function invItemValue(it){
  const qtys=invItemQtys(it);
  const supProd=findSupProdForInvItem(it);
  let total=0;
  Object.entries(qtys).forEach(([u,q])=>{
    let price=0;
    if(supProd) price=effectivePrice(supProd,u);
    else if(u===(it.unit||'')) price=parseFloat(it.price)||0;
    total+=q*price;
  });
  return total;
}
// Cantidad total convertida a la unidad base del proveedor (para stock mínimo).
function invItemQtyInBase(it){
  const qtys=invItemQtys(it);
  const supProd=findSupProdForInvItem(it);
  const baseUnit=supProd?.unit||it.unit;
  let total=0;
  Object.entries(qtys).forEach(([u,q])=>{
    if(u===baseUnit){ total+=q; return; }
    const conv=(supProd?.conversions||[]).find(c=>c.fromUnit===u);
    if(conv&&parseFloat(conv.factor)>0) total+=q*parseFloat(conv.factor);
    else total+=q;
  });
  return total;
}
// ─────────────────────────────────────────────────────────────────────

function importSupplierProducts(rest){
  if(!fbDb){ toast('Sin conexión Firebase','#dc2626'); return; }
  const k=restKey(rest);
  const existing=inventory[k]||{};
  const existingNames=new Set(Object.values(existing).map(p=>(p.name||'').trim().toLowerCase()));
  let added=0;
  const batch={};
  // Solo importar productos de proveedores que estén habilitados para este local.
  // Antes se usaba supList() (todos), lo que hacía que aparecieran en el inventario
  // productos de proveedores que el admin había desactivado para ese restaurante.
  const restUserIds=(cfg.users||[]).filter(u=>{const rests=u.restaurants||[u.restaurant];return rests.includes(rest);}).map(u=>u.id);
  const allowedSups=supList().filter(s=>{
    const dis=s.disabledFor||[];
    // Un proveedor está habilitado para este local si al menos uno de los
    // userIds de ese local NO está en la lista de desactivados del proveedor.
    return restUserIds.length===0||restUserIds.some(uid=>!dis.includes(uid));
  });
  allowedSups.forEach(sup=>{
    (sup.products||[]).forEach(p=>{
      const nameNorm=(p.name||'').trim().toLowerCase();
      if(!nameNorm||existingNames.has(nameNorm)) return;
      const id='inv_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      batch[id]={id,name:p.name,unit:p.unit||'ud',qty:0,minStock:0,price:parseFloat(p.price)||0,category:sup.emoji+' '+sup.name,updatedAt:new Date().toISOString(),updatedBy:'Importación catálogo'};
      existingNames.add(nameNorm); // evitar duplicados dentro del mismo lote
      added++;
    });
  });
  if(!added){ toast('Todos los productos ya están en el inventario','#7c3aed'); return; }
  fbDb.ref('inventory/'+k).update(batch)
    .then(()=>toast(`${added} producto${added>1?'s':''} importado${added>1?'s':''} del catálogo`,'#16a34a'))
    .catch(e=>toast('Error: '+e.message,'#dc2626'));
}

function saveInvItem(rest, item){
  if(!fbDb){ toast('Sin conexión Firebase','#dc2626'); return; }
  const k=restKey(rest);
  const id=item.id||('inv_'+Date.now());
  const data={...item, id, updatedAt:new Date().toISOString(), updatedBy: S.session?.isAdmin?'Admin':(S.session?.name||rest)};
  fbDb.ref('inventory/'+k+'/'+id).set(data);
  return id;
}

function deleteInvItem(rest, id){
  if(!fbDb){ toast('Sin conexión Firebase','#dc2626'); return; }
  if(!confirm('¿Eliminar este producto del inventario?')) return;
  fbDb.ref('inventory/'+restKey(rest)+'/'+id).remove();
  toast('Producto eliminado','#dc2626');
}

function addInvMovement(rest, productId, productName, type, qty, source, orderId, note){
  if(!fbDb) return;
  const k=restKey(rest);
  const id='mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  fbDb.ref('inventoryMovements/'+k+'/'+id).set({
    id, productId, productName, type, qty, source:source||'manual',
    ...(orderId?{orderId}:{}), ...(note?{note}:{}),
    date: new Date().toISOString()
  });
}

function updateStockFromOrder(order, receivedItems){
  if(!fbDb||!order) return;
  const rest=order.restaurant;
  const k=restKey(rest);
  const items=receivedItems||order.items||[];
  const invNow=inventory[k]||{};
  const sup=suppliers[order.supId];
  items.forEach(it=>{
    if(it.recvStatus==='missing') return; // no añadir si no llegó
    let qty=parseFloat(it.qty)||0;
    if(qty<=0) return;
    // Localizar el producto en el catálogo del proveedor para conocer la
    // "unidad base" (la unidad en la que está registrado el precio).
    // TODO SIEMPRE se contabiliza en esa unidad base — así qty × precio es correcto.
    const supProd=(sup?.products||[]).find(p=>p.name&&p.name.trim().toLowerCase()===(it.name||it.product||'').trim().toLowerCase());
    const baseUnit=supProd?.unit||it.unit||'ud';
    // Si el usuario pidió en otra unidad (p.ej. Caja) y el precio está por KG,
    // convertir usando las conversiones definidas en el producto.
    // 1 Caja * factor(15) = 15 KG → se guardan 15 KG en el inventario.
    if(supProd && it.unit && it.unit!==baseUnit){
      const conv=(supProd.conversions||[]).find(c=>c.fromUnit===it.unit);
      if(conv && parseFloat(conv.factor)>0){ qty=qty*parseFloat(conv.factor); }
    }
    // Try to match by name
    const existing=Object.values(invNow).find(p=>p.name&&p.name.trim().toLowerCase()===((it.name||it.product||'').trim().toLowerCase()));
    if(existing){
      const newQty=(parseFloat(existing.qty)||0)+qty;
      fbDb.ref('inventory/'+k+'/'+existing.id+'/qty').set(newQty);
      fbDb.ref('inventory/'+k+'/'+existing.id+'/updatedAt').set(new Date().toISOString());
      // Si el item de inventario tenía una unidad distinta a la del precio,
      // corregirla ahora — mantener siempre la unidad base garantiza que la
      // valoración qty×precio sea consistente.
      if(existing.unit!==baseUnit){
        fbDb.ref('inventory/'+k+'/'+existing.id+'/unit').set(baseUnit);
      }
      addInvMovement(rest,existing.id,existing.name,'entrada',qty,'pedido',order.id);
    } else {
      // Create new product automatically — siempre en la unidad base del precio
      const id='inv_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
      const pData={id,name:it.name||it.product||'Producto',unit:baseUnit,qty,minStock:0,price:parseFloat(supProd?.price||it.price)||0,category:sup?sup.name:'General',updatedAt:new Date().toISOString(),updatedBy:'Pedido automático'};
      fbDb.ref('inventory/'+k+'/'+id).set(pData);
      addInvMovement(rest,id,pData.name,'entrada',qty,'pedido',order.id);
    }
  });
}

function exportInventoryExcel(rest, catFilter){
  if(typeof XLSX==='undefined'){ toast('Librería Excel no cargada','#dc2626'); return; }
  let items=getInvItems(rest).filter(it=>(parseFloat(it.qty)||0)>0);
  if(catFilter) items=items.filter(it=>(it.category||'Sin categoría')===catFilter);
  const wb=XLSX.utils.book_new();
  if(catFilter){
    // Una sola hoja con la categoría filtrada
    const rows=[['Producto','Categoría','Cantidad','Unidad','Precio/ud (€)','Valor total (€)','Stock mínimo','Estado','Última actualización']];
    let total=0;
    items.forEach(it=>{
      const low=(parseFloat(it.qty)||0)<=(parseFloat(it.minStock)||0)&&(parseFloat(it.minStock)||0)>0;
      const qty=parseFloat(it.qty)||0; const price=parseFloat(it.price)||0; const valor=qty*price; total+=valor;
      rows.push([it.name,it.category||'',qty,it.unit||'',price,valor,parseFloat(it.minStock)||0,low?'Bajo stock':'OK',it.updatedAt?new Date(it.updatedAt).toLocaleDateString('es-ES'):'']);
    });
    rows.push(['','','','','TOTAL',total,'','','']);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),catFilter.slice(0,31));
  } else {
    // Una hoja por proveedor/categoría + hoja resumen
    const allCats=[...new Set(items.map(it=>it.category||'Sin categoría'))].sort();
    const summaryRows=[['Proveedor/Categoría','Productos','Valor total (€)','Productos con stock bajo']];
    allCats.forEach(cat=>{
      const catItems=items.filter(it=>(it.category||'Sin categoría')===cat);
      const rows=[['Producto','Categoría','Cantidad','Unidad','Precio/ud (€)','Valor total (€)','Stock mínimo','Estado','Última actualización']];
      let total=0;
      catItems.forEach(it=>{
        const low=(parseFloat(it.qty)||0)<=(parseFloat(it.minStock)||0)&&(parseFloat(it.minStock)||0)>0;
        const qty=parseFloat(it.qty)||0; const price=parseFloat(it.price)||0; const valor=qty*price; total+=valor;
        rows.push([it.name,it.category||'',qty,it.unit||'',price,valor,parseFloat(it.minStock)||0,low?'Bajo stock':'OK',it.updatedAt?new Date(it.updatedAt).toLocaleDateString('es-ES'):'']);
      });
      rows.push(['','','','','TOTAL',total,'','','']);
      const lowCount=catItems.filter(it=>(parseFloat(it.minStock)||0)>0&&(parseFloat(it.qty)||0)<=(parseFloat(it.minStock)||0)).length;
      summaryRows.push([cat,catItems.length,total,lowCount]);
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),cat.replace(/[:\\\/\?\*\[\]]/g,'').slice(0,31));
    });
    // Hoja resumen al principio
    const wsSummary=XLSX.utils.aoa_to_sheet(summaryRows);
    wb.SheetNames.unshift('Resumen');
    wb.Sheets['Resumen']=wsSummary;
  }
  const suffix=catFilter?'_'+catFilter.replace(/[^a-zA-Z0-9]/g,'_'):'_todos_proveedores';
  XLSX.writeFile(wb,'inventario_'+restKey(rest)+suffix+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

function openInvForm(rest, existingId){
  S.invEditId=existingId||null;
  if(existingId&&existingId!=='new'){
    const it=(inventory[restKey(rest)]||{})[existingId]||{};
    // Si la categoría coincide con un proveedor real, preseleccionamos su id
    // en el desplegable; si no, cae en "otro" con el texto libre que tuviera.
    const matchSup=supList().find(s=>it.category===((s.emoji?s.emoji+' ':'')+s.name)||it.category===s.name);
    S.invForm={
      name:it.name||'',
      unit:it.unit||'',
      qtys:invItemQtys(it), // Multi-unit map — legacy items entran aquí normalizados
      minStock:it.minStock??'',
      category:it.category||'',
      price:it.price??'',
      supId:matchSup?matchSup.id:(it.category?'otro':''),
      supOther:matchSup?'':(it.category||'')
    };
  } else {
    S.invForm={name:'',unit:'',qtys:{},minStock:'',category:'',price:'',supId:'',supOther:''};
  }
  render();
  setTimeout(()=>document.getElementById('inv-form-name')?.focus(),80);
}

// Desplegable de proveedor para el alta manual de inventario. Si se elige
// "Proveedor no registrado" aparece un campo de texto libre — al guardar,
// ese producto se manda a la cola de revisión (pendingReview) para que un
// admin lo vincule a un proveedor real más tarde.
function _renderInvSupplierField(){
  const sups=supList();
  const cur=S.invForm.supId||'';
  return `<div>
    <label style="font-size:12px;color:var(--mut)">Proveedor</label>
    <select id="inv-form-sup" class="inp" onchange="S.invForm.supId=this.value;render()">
      <option value="">— Selecciona —</option>
      ${sups.map(s=>`<option value="${s.id}" ${cur===s.id?'selected':''}>${s.emoji?s.emoji+' ':''}${s.name}</option>`).join('')}
      <option value="otro" ${cur==='otro'?'selected':''}>Proveedor no registrado…</option>
    </select>
    ${cur==='otro'?`<input id="inv-form-sup-other" class="inp" style="margin-top:6px" value="${(S.invForm.supOther||'').replace(/"/g,'&quot;')}" oninput="S.invForm.supOther=this.value" placeholder="Nombre del proveedor (se revisará antes de darlo de alta)"/>`:''}
  </div>`;
}

function submitInvForm(rest){
  const name=(document.getElementById('inv-form-name')?.value||'').trim();
  const minStock=parseFloat(document.getElementById('inv-form-min')?.value)||0;
  const price=parseFloat(document.getElementById('inv-form-price')?.value)||0;
  const supId=document.getElementById('inv-form-sup')?.value||'';
  const supOther=(document.getElementById('inv-form-sup-other')?.value||'').trim();
  if(!name){ toast('Introduce un nombre','#dc2626'); return; }
  if(!supId){ toast('Selecciona el proveedor del producto','#dc2626'); return; }
  if(supId==='otro' && !supOther){ toast('Escribe el nombre del proveedor no registrado','#dc2626'); return; }
  const needsReview = supId==='otro';
  const sup = needsReview?null:suppliers[supId];
  const category = needsReview ? supOther : ((sup?.emoji?sup.emoji+' ':'')+(sup?.name||''));
  // Recolectar cantidades de todas las unidades del formulario multi-unit
  const qtys={};
  document.querySelectorAll('[data-inv-qty-unit]').forEach(el=>{
    const u=el.getAttribute('data-inv-qty-unit');
    const v=parseFloat(el.value);
    if(!isNaN(v)&&v!==0) qtys[u]=v;
  });
  // Determinar unit "principal" para compatibilidad con exportaciones y mostrar
  // primer valor. Se usa la primera unidad con cantidad no cero, o KG si vacío.
  const primaryUnit=Object.keys(qtys)[0]||'KG';
  const primaryQty=qtys[primaryUnit]||0;
  const isNew=!S.invEditId||S.invEditId==='new';
  const oldItem=(!isNew&&S.invEditId)?(inventory[restKey(rest)]||{})[S.invEditId]:null;
  const id=saveInvItem(rest,{
    ...(!isNew?{id:S.invEditId}:{}),
    name,
    unit:primaryUnit,
    qty:primaryQty, // Legacy — usado por código antiguo que aún lo lee
    qtys, // Fuente de verdad para multi-unit
    minStock,category,price,needsReview,
    manual:isNew?true:(oldItem?.manual===true)
  });
  if(needsReview && fbDb){
    const rid='pr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    fbDb.ref('pendingReview/'+rid).set({
      id:rid, type:'inventario', supName:supOther, name, price,
      unit:primaryUnit, restaurant:rest, invItemId:id,
      note:'Alta manual de inventario con proveedor no registrado',
      createdAt:new Date().toISOString(), createdBy:S.session?.name||rest
    });
    toast('Producto guardado — enviado a revisión para vincular el proveedor','#d97706',4500);
  }
  if(!S.invEditId&&id){
    // Registrar movimiento por cada unidad no cero
    Object.entries(qtys).forEach(([u,q])=>{
      addInvMovement(rest,id,name,'ajuste',q,'manual',null,'Alta de producto — '+u);
    });
  } else if(S.invEditId){
    // Diff por unidad
    const oldQtys=invItemQtys(oldItem||{});
    const allUnits=new Set([...Object.keys(oldQtys),...Object.keys(qtys)]);
    allUnits.forEach(u=>{
      const diff=(qtys[u]||0)-(oldQtys[u]||0);
      if(diff!==0) addInvMovement(rest,S.invEditId,name,diff>0?'entrada':'salida',Math.abs(diff),'manual',null,'Ajuste manual — '+u);
    });
  }
  S.invEditId=null;
  S.invForm={name:'',unit:'',qtys:{},minStock:'',category:'',price:'',supId:'',supOther:''};
  if(!needsReview) toast('Producto guardado','#7c3aed');
  const _sv=window.scrollY;
  if(S.view==='admin') renderAdminContent();
  else { render(); requestAnimationFrame(()=>window.scrollTo(0,_sv)); }
}

function cancelInvForm(){
  S.invEditId=null;
  S.invForm={name:'',unit:'',qtys:{},minStock:'',category:'',price:'',supId:'',supOther:''};
  const _sv=window.scrollY;
  if(S.view==='admin') renderAdminContent();
  else { render(); requestAnimationFrame(()=>window.scrollTo(0,_sv)); }
}

// Devuelve el HTML de la sección multi-unit del formulario. Muestra una fila
// por cada unidad común + las unidades que ya tenga el item aunque sean
// personalizadas + un botón para añadir una unidad manual.
function _renderInvQtysForm(){
  const currentQtys=(S.invForm&&S.invForm.qtys)||{};
  const extraUnits=Object.keys(currentQtys).filter(u=>!INV_COMMON_UNITS.includes(u));
  const allUnits=[...INV_COMMON_UNITS,...extraUnits];
  return `<div style="grid-column:1/-1">
    <label style="font-size:12px;color:var(--mut)">Cantidad actual (puedes tener varias unidades a la vez)</label>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-top:4px" id="inv-qtys-grid">
      ${allUnits.map(u=>{const v=currentQtys[u]!==undefined?currentQtys[u]:'';return `<div style="display:flex;align-items:center;gap:4px"><input type="number" min="0" step="0.001" value="${v}" data-inv-qty-unit="${u}" oninput="if(!S.invForm.qtys)S.invForm.qtys={};const n=parseFloat(this.value);if(!isNaN(n)&&n!==0)S.invForm.qtys['${u}']=n;else delete S.invForm.qtys['${u}']" placeholder="0" style="flex:1;padding:6px 8px;border:1.5px solid var(--brd);border-radius:8px;font-size:14px;background:var(--card);color:var(--txt);min-width:50px"/><span style="font-size:12px;color:var(--mut);font-weight:600;min-width:36px">${u}</span></div>`;}).join('')}
    </div>
    <div style="font-size:11px;color:var(--mut);margin-top:6px">Deja vacío o en 0 las unidades que no tengas. Ejemplo: 1 Caja + 3 UN + 0.3 KG</div>
  </div>`;
}

// ── Cola de revisión (productos/albaranes con proveedor o código sin
// reconocer, venidos de inventario manual o de la importación de Excel) ───
function _renderPendingReviewCard(){
  const list=Object.values(pendingReview||{});
  if(!list.length) return '';
  const rowFor=p=>{
    if(p.type==='excel-albaran-proveedor'){
      return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--brd)">
        <div style="flex:1;min-width:200px"><strong>${p.name}</strong> <span style="color:var(--mut);font-size:12px">— ${p.restaurant||''}</span><div style="font-size:12px;color:#92400e">Proveedor del Excel sin registrar: "${p.supName}" — ${p.note||''}</div></div>
        <button class="btn btn-ghost btn-xs" onclick="dismissPendingReview('${p.id}')">Descartar</button>
      </div>`;
    }
    if(p.type==='excel-albaran'){
      return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--brd)">
        <div style="flex:1;min-width:160px"><strong>${p.name||'(sin nombre)'}</strong> <span style="color:var(--mut);font-size:12px">— ${fmt(p.price||0)} · ${p.restaurant||''}</span><div style="font-size:12px;color:#92400e">Proveedor: ${p.supName} · ${p.note||''}</div></div>
        <input id="pr-code-${p.id}" value="${(p.code||'').replace(/"/g,'&quot;')}" placeholder="Código proveedor" style="width:120px;padding:5px 8px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)"/>
        <button class="btn btn-ok btn-xs" onclick="resolvePendingReview('${p.id}')">Crear/actualizar producto</button>
        <button class="btn btn-ghost btn-xs" onclick="dismissPendingReview('${p.id}')">Descartar</button>
      </div>`;
    }
    // type 'inventario': proveedor no registrado, hay que vincularlo a uno real
    return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--brd)">
      <div style="flex:1;min-width:160px"><strong>${p.name}</strong> <span style="color:var(--mut);font-size:12px">— ${fmt(p.price||0)}/${p.unit||'ud'} · ${p.restaurant||''}</span><div style="font-size:12px;color:#92400e">Proveedor propuesto: "${p.supName}"</div></div>
      <select id="pr-sup-${p.id}" style="padding:5px 8px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)">
        <option value="">Vincular a...</option>
        ${supList().map(s=>`<option value="${s.id}">${s.emoji?s.emoji+' ':''}${s.name}</option>`).join('')}
      </select>
      <input id="pr-code-${p.id}" placeholder="Código proveedor" style="width:110px;padding:5px 8px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)"/>
      <button class="btn btn-ok btn-xs" onclick="resolvePendingReview('${p.id}')">Vincular</button>
      <button class="btn btn-ghost btn-xs" onclick="dismissPendingReview('${p.id}')">Descartar</button>
    </div>`;
  };
  return `<div class="card" style="margin-bottom:14px;border-color:#f59e0b">
    <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#92400e">Cola de revisión (${list.length})</div>
    <div style="font-size:12px;color:var(--mut);margin-bottom:10px">Productos y proveedores sin reconocer, venidos de altas manuales o de importaciones de Excel.</div>
    ${list.map(rowFor).join('')}
  </div>`;
}
function resolvePendingReview(reviewId){
  const p=(pendingReview||{})[reviewId];
  if(!p){ toast('Esa revisión ya no existe','#dc2626'); return; }
  const code=(document.getElementById('pr-code-'+reviewId)?.value||'').trim();
  if(!code){ toast('El código de producto del proveedor es obligatorio','#dc2626'); return; }

  if(p.type==='excel-albaran'){
    const sup=findSupplierByName_(p.supName);
    if(!sup){ toast('El proveedor "'+p.supName+'" ya no existe','#dc2626'); return; }
    if(!Array.isArray(sup.products)) sup.products=Object.values(sup.products||{});
    const existing=sup.products.find(pp=>pp.code===code);
    if(existing){ existing.name=p.name||existing.name; existing.price=parseFloat(p.price)||existing.price; }
    else sup.products.push({id:'p'+uid(),name:p.name||'Producto',unit:'UN',price:parseFloat(p.price)||0,category:'Otros',code});
    saveSups(sup.id);
    if(fbDb) fbDb.ref('pendingReview/'+reviewId).remove();
    toast('Producto '+(existing?'actualizado':'creado')+' en '+sup.name,'#16a34a');
    renderAdminContent();
    return;
  }

  // type 'inventario'
  const supId=document.getElementById('pr-sup-'+reviewId)?.value||'';
  if(!supId){ toast('Elige a qué proveedor vincularlo','#dc2626'); return; }
  const sup=suppliers[supId];
  if(!sup){ toast('Proveedor no encontrado','#dc2626'); return; }
  if(!Array.isArray(sup.products)) sup.products=Object.values(sup.products||{});
  if(sup.products.some(pp=>pp.code===code)){ toast('Ese código ya lo usa otro producto de este proveedor','#dc2626'); return; }
  sup.products.push({id:'p'+uid(),name:p.name,unit:p.unit||'KG',price:parseFloat(p.price)||0,category:'Otros',code});
  saveSups(supId);
  if(fbDb && p.invItemId && p.restaurant){
    const k=restKey(p.restaurant);
    fbDb.ref('inventory/'+k+'/'+p.invItemId+'/category').set((sup.emoji?sup.emoji+' ':'')+sup.name);
    fbDb.ref('inventory/'+k+'/'+p.invItemId+'/needsReview').remove();
  }
  if(fbDb) fbDb.ref('pendingReview/'+reviewId).remove();
  toast('Producto vinculado a '+sup.name,'#16a34a');
  renderAdminContent();
}
function findSupplierByName_(name){
  const n=String(name||'').trim().toLowerCase();
  return supList().find(s=>(s.name||'').trim().toLowerCase()===n)||null;
}
function dismissPendingReview(reviewId){
  if(!confirm('¿Descartar esta revisión?')) return;
  if(fbDb) fbDb.ref('pendingReview/'+reviewId).remove();
  toast('Revisión descartada','#7c3aed');
  renderAdminContent();
}

function ajusteRapido(rest, id, delta){
  const k=restKey(rest);
  const it=(inventory[k]||{})[id];
  if(!it){ return; }
  const newQty=Math.max(0,(parseFloat(it.qty)||0)+delta);
  if(!fbDb) return;
  fbDb.ref('inventory/'+k+'/'+id+'/qty').set(newQty);
  fbDb.ref('inventory/'+k+'/'+id+'/updatedAt').set(new Date().toISOString());
  addInvMovement(rest,id,it.name,delta>0?'entrada':'salida',Math.abs(delta),'manual');
}

// ── Vista admin ──────────────────────────────────────────
function vInventario(){
  const allRests=Object.keys(cfg.users||{}).map(u=>{const ud=cfg.users[u];return ud.restaurants||[ud.restaurant||u];}).flat().filter((v,i,a)=>a.indexOf(v)===i).sort();
  const rest=S.invRest||allRests[0]||'';
  if(!S.invRest&&rest) S.invRest=rest;
  const allItems=getInvItems(rest);

  // Filtro por proveedores activos para este restaurante
  const restUserIds=(cfg.users||[]).filter(u=>{const rests=u.restaurants||[u.restaurant];return rests.includes(rest);}).map(u=>u.id);
  const activeSups=supList().filter(s=>{const dis=s.disabledFor||[];return restUserIds.length===0||restUserIds.some(uid=>!dis.includes(uid));});
  const activeSupCatNames=new Set(activeSups.map(s=>(s.emoji?s.emoji+' ':'')+s.name));
  const allSupCatNames=new Set(supList().map(s=>(s.emoji?s.emoji+' ':'')+s.name));

  // Nombres de productos que este local ha COMPRADO alguna vez
  // (aprobado, recibido o enviado — nunca 'pending' ni 'rejected').
  // Normalizamos como en el comparador: minúsculas + trim + tildes + espacios.
  const _norm=n=>(n||'').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s+/g,' ').trim();
  const orderedNames=new Set();
  orders.filter(o=>o.restaurant===rest && (o.status==='approved' || o.status==='received' || o.status==='sent'))
    .forEach(o=>{
      (o.items||[]).forEach(it=>{ if(it.name) orderedNames.add(_norm(it.name)); });
    });

  // FILTRO ESTRICTO PARA LA VISTA:
  // Solo aparecen productos que este local ya haya comprado, o que haya
  // añadido a mano al inventario. Los importados masivamente que nunca
  // se pidieron NO aparecen — no se borran, solo se ocultan. En cuanto
  // se pida uno por primera vez, reaparece automáticamente. Además se
  // sigue ocultando lo de proveedores desactivados.
  const items=allItems.filter(it=>{
    const c=it.category||'Sin categoría';
    const supOk=!allSupCatNames.has(c) || activeSupCatNames.has(c);
    if(!supOk) return false;
    return it.manual===true || orderedNames.has(_norm(it.name));
  });
  // Cuántos han quedado ocultos por no tener historial, para informar.
  const _hiddenNoHistory = allItems.filter(it=>{
    const c=it.category||'Sin categoría';
    const supOk=!allSupCatNames.has(c) || activeSupCatNames.has(c);
    return supOk && it.manual!==true && !orderedNames.has(_norm(it.name));
  }).length;
  const lowItems=items.filter(it=>(parseFloat(it.minStock)||0)>0&&invItemQtyInBase(it)<=(parseFloat(it.minStock)||0));
  // Incluir: categorías de proveedores activos + categorías manuales (no coinciden con ningún proveedor)
  const filteredCats=[...new Set(items.map(it=>it.category||'Sin categoría'))].filter(c=>!allSupCatNames.has(c)||activeSupCatNames.has(c)).sort();
  if(S.invCat&&!filteredCats.includes(S.invCat)) S.invCat=null;
  const catTabs=[
    `<button class="stab ${!S.invCat?'act':''}" onclick="S.invCat=null;render()"> Todos (${items.length})</button>`,
    ...filteredCats.map(c=>{
      const cnt=items.filter(it=>(it.category||'Sin categoría')===c).length;
      return `<button class="stab ${S.invCat===c?'act':''}" onclick="S.invCat='${c.replace(/'/g,"\\'")}';render()">${c} (${cnt})</button>`;
    })
  ].join('');

  const restTabs=allRests.map(r=>`<button class="stab ${rest===r?'act':''}" onclick="S.invRest='${r.replace(/'/g,"\\'")}';S.invEditId=null;S.invCat=null;render()">${r}</button>`).join('');

  const alertBanner=lowItems.length?`<div class="banner" style="background:#fef3c7;border-color:#f59e0b;color:#92400e;margin-bottom:12px"><strong>${lowItems.length} producto${lowItems.length>1?'s':''} con stock bajo:</strong> ${lowItems.map(it=>`${it.name} (${invItemQtysStr(it)})`).join(', ')}</div>`:'';

  const isEditing=S.invEditId!==null;
  const editItem=isEditing&&S.invEditId!=='new'?(inventory[restKey(rest)]||{})[S.invEditId]:null;

  const formHtml=`<div class="card" style="margin-bottom:14px">
    <div style="font-weight:700;font-size:14px;margin-bottom:10px">${isEditing&&S.invEditId!=='new'?'Editar producto':' Añadir producto'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:12px;color:var(--mut)">Nombre</label><input id="inv-form-name" class="inp" value="${(S.invForm.name||'').replace(/"/g,'&quot;')}" oninput="S.invForm.name=this.value" placeholder="ej: Pechuga de pollo" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Precio / unidad (€)</label><input id="inv-form-price" class="inp" type="number" min="0" step="0.01" value="${S.invForm.price??''}" oninput="S.invForm.price=this.value" placeholder="0.00" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Stock mínimo</label><input id="inv-form-min" class="inp" type="number" min="0" step="0.01" value="${S.invForm.minStock??''}" oninput="S.invForm.minStock=this.value" placeholder="0 = sin alerta" /></div>
      ${_renderInvSupplierField()}
      ${_renderInvQtysForm()}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-acc btn-sm" onclick="submitInvForm('${rest.replace(/'/g,"\\'")}')">Guardar</button>
      <button class="btn btn-ghost btn-sm" onclick="cancelInvForm()">Cancelar</button>
    </div>
  </div>`;

  const pendingReviewCard=_renderPendingReviewCard();

  const movRows=(Object.values(inventoryMovements[restKey(rest)]||{})||[]).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50).map(m=>{
    const ico=m.type==='entrada'?'':m.type==='salida'?'':'';
    return `<tr><td>${ico} ${m.type}</td><td>${m.productName||m.productId}</td><td>${m.qty>0?'+':''}${m.qty}</td><td>${m.source==='pedido'?' Pedido':' Manual'}</td><td style="color:var(--mut)">${m.date?new Date(m.date).toLocaleDateString('es-ES'):''}</td></tr>`;
  }).join('');

  const totalValor=items.reduce((s,it)=>invItemValue(it)+s,0);
  const totalItems=items.length;
  const summaryHtml=items.length?`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
    <div class="card" style="flex:1;min-width:130px;padding:12px 16px;text-align:center">
      <div style="font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px">Productos</div>
      <div style="font-size:22px;font-weight:800;color:var(--pri)">${totalItems}</div>
    </div>
    <div class="card" style="flex:1;min-width:130px;padding:12px 16px;text-align:center">
      <div style="font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px">Valor total stock</div>
      <div style="font-size:22px;font-weight:800;color:var(--pri)">${fmt(totalValor)}</div>
    </div>
    ${lowItems.length?`<div class="card" style="flex:1;min-width:130px;padding:12px 16px;text-align:center;border-color:#f59e0b">
      <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.5px">Stock bajo</div>
      <div style="font-size:22px;font-weight:800;color:#d97706">${lowItems.length}</div>
    </div>`:''}
  </div>`:'';

  const invQ=(S.invSearch||'').toLowerCase().trim();
  const catFiltered=S.invCat?items.filter(it=>(it.category||'Sin categoría')===S.invCat):items;
  const filteredItems=invQ?catFiltered.filter(it=>(it.name||'').toLowerCase().includes(invQ)||(it.category||'').toLowerCase().includes(invQ)):catFiltered;

  const searchBox=`<input type="text" value="${S.invSearch||''}" placeholder="Buscar producto o categoría..." oninput="S.invSearch=this.value;render()" style="width:100%;padding:9px 14px;border:1.5px solid var(--brd);border-radius:10px;font-size:14px;background:#fff;color:var(--txt);outline:none;margin-bottom:12px;box-sizing:border-box" onfocus="this.style.borderColor='var(--pri)'" onblur="this.style.borderColor='var(--brd)'"/>`;

  const table=filteredItems.length?`${searchBox}<table class="spend-table">
    <thead><tr><th>Producto</th><th>Categoría</th><th>Cantidades</th><th>Precio base</th><th>Valor</th><th>Mín.</th><th>Estado</th><th></th></tr></thead>
    <tbody>${filteredItems.map(it=>{
      const qtyBase=invItemQtyInBase(it);
      const low=(parseFloat(it.minStock)||0)>0&&qtyBase<=(parseFloat(it.minStock)||0);
      const price=parseFloat(it.price)||0;
      const valor=invItemValue(it);
      const supProd=findSupProdForInvItem(it);
      const priceUnit=supProd?.unit||it.unit||'ud';
      return `<tr style="${low?'background:#fef9c3':''}">
        <td style="font-weight:600">${it.name}</td>
        <td style="color:var(--mut)">${it.category||'—'}</td>
        <td>${invItemQtysStr(it)}</td>
        <td style="color:var(--mut)">${price>0?fmt(price)+'/'+priceUnit:'—'}</td>
        <td style="font-weight:${valor>0?'700':'400'}">${valor>0?fmt(valor):'—'}</td>
        <td style="color:var(--mut)">${parseFloat(it.minStock)||0} ${priceUnit}</td>
        <td>${low?'<span style="color:#d97706;font-weight:700">Bajo</span>':'<span style="color:#16a34a">OK</span>'}</td>
        <td><span style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="openInvForm('${rest.replace(/'/g,"\\'")}','${it.id}')">Editar</button>
          <button class="btn btn-no btn-sm" onclick="deleteInvItem('${rest.replace(/'/g,"\\'")}','${it.id}')"></button>
        </span></td>
      </tr>`;
    }).join('')}
    ${totalValor>0?`<tr style="background:var(--bg);font-weight:700"><td colspan="4" style="text-align:right;padding-right:8px">TOTAL</td><td>${fmt(totalValor)}</td><td colspan="3"></td></tr>`:''}
    </tbody></table>`
    :(items.length&&invQ?`${searchBox}<div class="empty" style="margin:0"><div class="et">Sin resultados para "<strong>${invQ}</strong>"</div></div>`
    :`<div class="empty"><div class="ei"></div><div class="et">Sin productos en el inventario de ${rest}</div></div>`);

  const hiddenChip = _hiddenNoHistory>0
    ? `<div class="inv-hidden-chip" title="Estos productos siguen guardados, solo se ocultan hasta que se pidan por primera vez">${_hiddenNoHistory} producto${_hiddenNoHistory===1?'':'s'} ocultos sin historial de compra</div>`
    : '';

  return `<div>
    <div class="inv-head">
      <div class="inv-head-l">
        <div class="inv-head-t">Inventario</div>
        <div class="inv-head-s">Solo se muestran productos que este local ha comprado alguna vez o ha añadido a mano.</div>
      </div>
      <div class="inv-head-r">
        <button class="btn btn-pri btn-sm" onclick="openInvForm('${rest.replace(/'/g,"\\'")}','new')">+ Añadir producto</button>
        <button class="btn btn-ghost btn-sm" onclick="importSupplierProducts('${rest.replace(/'/g,"\\'")}')">Importar catálogo</button>
        ${items.length?`<button class="btn btn-ghost btn-sm" onclick="exportInventoryExcel('${rest.replace(/'/g,"\\'")}',${S.invCat?JSON.stringify(S.invCat):'null'})">Exportar Excel${S.invCat?' ('+S.invCat+')':''}</button>`:''}
      </div>
    </div>
    ${hiddenChip}
    <div class="sup-tabs" style="margin-bottom:10px">${restTabs}</div>
    ${filteredCats.length>0?`<div class="sup-tabs" style="margin-bottom:14px;flex-wrap:wrap">${catTabs}</div>`:''}
    ${pendingReviewCard}
    ${alertBanner}
    ${summaryHtml}
    ${isEditing?formHtml:''}
    <div class="card" style="overflow-x:auto">${table}</div>
    <div style="margin-top:14px">
      <button class="btn btn-ghost btn-sm" onclick="S.invShowMov=!S.invShowMov;render()">${S.invShowMov?'▲ Ocultar':'▼ Ver'} historial de movimientos</button>
      ${S.invShowMov?`<div class="card" style="margin-top:10px;overflow-x:auto">
        <div style="font-weight:700;margin-bottom:8px">Historial (últimos 50)</div>
        ${movRows?`<table class="spend-table"><thead><tr><th>Tipo</th><th>Producto</th><th>Cant.</th><th>Origen</th><th>Fecha</th></tr></thead><tbody>${movRows}</tbody></table>`
        :'<div class="empty" style="margin:0"><div class="et">Sin movimientos aún</div></div>'}
      </div>`:''}
    </div>
  </div>`;
}

// ── Vista restaurante ─────────────────────────────────────
function vLocalInventario(rest){
  const allItems=getInvItems(rest);
  // Mismos dos filtros que en vInventario:
  //   1. Ocultar productos de proveedores desactivados para este local
  //   2. Mostrar solo productos manuales o pedidos alguna vez desde este local
  const restUserIds=(cfg.users||[]).filter(u=>{const rests=u.restaurants||[u.restaurant];return rests.includes(rest);}).map(u=>u.id);
  const activeSups=supList().filter(s=>{const dis=s.disabledFor||[];return restUserIds.length===0||restUserIds.some(uid=>!dis.includes(uid));});
  const activeSupCatNames=new Set(activeSups.map(s=>(s.emoji?s.emoji+' ':'')+s.name));
  const allSupCatNames=new Set(supList().map(s=>(s.emoji?s.emoji+' ':'')+s.name));
  const _norm=n=>(n||'').trim().toLowerCase();
  const orderedNames=new Set();
  orders.filter(o=>o.restaurant===rest&&o.status!=='rejected').forEach(o=>{
    (o.items||[]).forEach(it=>{ if(it.name) orderedNames.add(_norm(it.name)); });
  });
  const items=allItems.filter(it=>{
    const c=it.category||'Sin categoría';
    const supOk=!allSupCatNames.has(c) || activeSupCatNames.has(c);
    if(!supOk) return false;
    return it.manual===true || orderedNames.has(_norm(it.name));
  });
  const lowItems=items.filter(it=>(parseFloat(it.minStock)||0)>0&&invItemQtyInBase(it)<=(parseFloat(it.minStock)||0));
  const alertBanner=lowItems.length?`<div class="banner" style="background:#fef3c7;border-color:#f59e0b;color:#92400e;margin-bottom:12px"><strong>${lowItems.length} producto${lowItems.length>1?'s':''} con stock bajo:</strong> ${lowItems.map(it=>`${it.name} (${invItemQtysStr(it)})`).join(', ')}</div>`:'';
  const isEditing=S.invEditId!==null;

  const formHtml=`<div class="card" style="margin-bottom:14px">
    <div style="font-weight:700;font-size:14px;margin-bottom:10px">${S.invEditId&&S.invEditId!=='new'?'Editar producto':' Añadir producto'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:12px;color:var(--mut)">Nombre</label><input id="inv-form-name" class="inp" value="${(S.invForm.name||'').replace(/"/g,'&quot;')}" oninput="S.invForm.name=this.value" placeholder="ej: Pechuga de pollo" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Precio / unidad (€)</label><input id="inv-form-price" class="inp" type="number" min="0" step="0.01" value="${S.invForm.price??''}" oninput="S.invForm.price=this.value" placeholder="0.00" /></div>
      <div style="grid-column:1/-1">${_renderInvSupplierField()}</div>
      <div><label style="font-size:12px;color:var(--mut)">Stock mínimo</label><input id="inv-form-min" class="inp" type="number" min="0" step="0.01" value="${S.invForm.minStock??''}" oninput="S.invForm.minStock=this.value" placeholder="0 = sin alerta" /></div>
      <div></div>
      ${_renderInvQtysForm()}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-acc btn-sm" onclick="submitInvForm('${rest.replace(/'/g,"\\'")}')">Guardar</button>
      <button class="btn btn-ghost btn-sm" onclick="cancelInvForm()">Cancelar</button>
    </div>
  </div>`;

  const totalValorR=items.reduce((s,it)=>invItemValue(it)+s,0);
  const summaryRest=items.length?`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
    <div class="card" style="flex:1;min-width:120px;padding:12px 16px;text-align:center">
      <div style="font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px">Productos</div>
      <div style="font-size:22px;font-weight:800;color:var(--pri)">${items.length}</div>
    </div>
    <div class="card" style="flex:1;min-width:120px;padding:12px 16px;text-align:center">
      <div style="font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px">Valor total stock</div>
      <div style="font-size:22px;font-weight:800;color:var(--pri)">${fmt(totalValorR)}</div>
    </div>
    ${lowItems.length?`<div class="card" style="flex:1;min-width:120px;padding:12px 16px;text-align:center;border-color:#f59e0b">
      <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.5px">Stock bajo</div>
      <div style="font-size:22px;font-weight:800;color:#d97706">${lowItems.length}</div>
    </div>`:''}
  </div>`:'';

  const invQR=(S.invSearch||'').toLowerCase().trim();
  const filteredR=invQR?items.filter(it=>(it.name||'').toLowerCase().includes(invQR)||(it.category||'').toLowerCase().includes(invQR)):items;
  const searchBoxR=`<input type="text" value="${S.invSearch||''}" placeholder="Buscar producto o categoría..." oninput="S.invSearch=this.value;render()" style="width:100%;padding:9px 14px;border:1.5px solid var(--brd);border-radius:10px;font-size:14px;background:#fff;color:var(--txt);outline:none;margin-bottom:12px;box-sizing:border-box" onfocus="this.style.borderColor='var(--pri)'" onblur="this.style.borderColor='var(--brd)'"/>`;

  const table=filteredR.length?`${searchBoxR}<table class="spend-table">
    <thead><tr><th>Producto</th><th>Categoría</th><th>Cantidades</th><th>Precio base</th><th>Valor</th><th>Estado</th><th></th></tr></thead>
    <tbody>${filteredR.map(it=>{
      const qtyBase=invItemQtyInBase(it);
      const low=(parseFloat(it.minStock)||0)>0&&qtyBase<=(parseFloat(it.minStock)||0);
      const price=parseFloat(it.price)||0;
      const valor=invItemValue(it);
      const supProd=findSupProdForInvItem(it);
      const priceUnit=supProd?.unit||it.unit||'ud';
      return `<tr style="${low?'background:#fef9c3':''}">
        <td style="font-weight:600">${it.name}</td>
        <td style="color:var(--mut)">${it.category||'—'}</td>
        <td>${invItemQtysStr(it)}</td>
        <td style="color:var(--mut)">${price>0?fmt(price)+'/'+priceUnit:'—'}</td>
        <td style="font-weight:${valor>0?'700':'400'}">${valor>0?fmt(valor):'—'}</td>
        <td>${low?'<span style="color:#d97706;font-weight:700">Bajo</span>':'<span style="color:#16a34a">OK</span>'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="openInvForm('${rest.replace(/'/g,"\\'")}','${it.id}')">Editar</button></td>
      </tr>`;
    }).join('')}
    ${totalValorR>0?`<tr style="background:var(--bg);font-weight:700"><td colspan="4" style="text-align:right;padding-right:8px">TOTAL</td><td>${fmt(totalValorR)}</td><td colspan="2"></td></tr>`:''}
    </tbody></table>`
    :(items.length&&invQR?`${searchBoxR}<div class="empty" style="margin:0"><div class="et">Sin resultados para "<strong>${invQR}</strong>"</div></div>`
    :`<div class="empty"><div class="ei"></div><div class="et">Sin productos en el inventario aún.<br><br><button class="btn btn-acc btn-sm" onclick="openInvForm('${rest.replace(/'/g,"\\'")}','new')"> Añadir primero</button></div></div>`);

  return `<div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:16px;font-weight:700"> Mi inventario — ${rest}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="importSupplierProducts('${rest.replace(/'/g,"\\'")}')"> Importar catálogo</button>
        <button class="btn btn-acc btn-sm" onclick="openInvForm('${rest.replace(/'/g,"\\'")}','new')"> Añadir</button>
      </div>
    </div>
    ${alertBanner}
    ${summaryRest}
    ${isEditing?formHtml:''}
    <div class="card" style="overflow-x:auto">${table}</div>
  </div>`;
}
