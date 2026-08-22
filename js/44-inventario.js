/* ══════════════════════════════════════════════════════════
   INVENTARIO
══════════════════════════════════════════════════════════ */

function restKey(name){ return (name||'').replace(/[.#$\[\]/]/g,'_').replace(/\s+/g,'_'); }

function getInvItems(rest){
  const k=restKey(rest);
  return Object.values(inventory[k]||{}).sort((a,b)=>(a.category||'').localeCompare(b.category||'es')||(a.name||'').localeCompare(b.name||'es'));
}

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
  if(existingId){
    const it=(inventory[restKey(rest)]||{})[existingId]||{};
    S.invForm={name:it.name||'',unit:it.unit||'',qty:it.qty??'',minStock:it.minStock??'',category:it.category||'',price:it.price??''};
  } else {
    S.invForm={name:'',unit:'',qty:'',minStock:'',category:'',price:''};
  }
  render();
  setTimeout(()=>document.getElementById('inv-form-name')?.focus(),80);
}

function submitInvForm(rest){
  const name=(document.getElementById('inv-form-name')?.value||'').trim();
  const unit=(document.getElementById('inv-form-unit')?.value||'').trim();
  const qty=parseFloat(document.getElementById('inv-form-qty')?.value)||0;
  const minStock=parseFloat(document.getElementById('inv-form-min')?.value)||0;
  const category=(document.getElementById('inv-form-cat')?.value||'').trim();
  const price=parseFloat(document.getElementById('inv-form-price')?.value)||0;
  if(!name){ toast('Introduce un nombre','#dc2626'); return; }
  // Marcar como 'manual' si es nuevo — esto hace que aparezca en el inventario
  // aunque nunca se haya pedido (los importados sin flag manual solo se ven si
  // aparecen en algún pedido de este local).
  const isNew=!S.invEditId||S.invEditId==='new';
  const id=saveInvItem(rest,{...(S.invEditId&&S.invEditId!=='new'?{id:S.invEditId}:{}),name,unit,qty,minStock,category,price,...(isNew?{manual:true}:{})});
  if(!S.invEditId&&id){
    addInvMovement(rest,id,name,'ajuste',qty,'manual',null,'Alta de producto');
  } else if(S.invEditId){
    const old=(inventory[restKey(rest)]||{})[S.invEditId]||{};
    const diff=qty-(parseFloat(old.qty)||0);
    if(diff!==0) addInvMovement(rest,S.invEditId,name,diff>0?'entrada':'salida',Math.abs(diff),'manual',null,'Ajuste manual');
  }
  S.invEditId=null;
  S.invForm={name:'',unit:'',qty:'',minStock:'',category:'',price:''};
  toast('Producto guardado','#7c3aed');
  // Preservar scroll al guardar
  const _sv=window.scrollY;
  if(S.view==='admin') renderAdminContent();
  else { render(); requestAnimationFrame(()=>window.scrollTo(0,_sv)); }
}

function cancelInvForm(){
  S.invEditId=null;
  S.invForm={name:'',unit:'',qty:'',minStock:'',category:'',price:''};
  const _sv=window.scrollY;
  if(S.view==='admin') renderAdminContent();
  else { render(); requestAnimationFrame(()=>window.scrollTo(0,_sv)); }
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

  // Nombres de productos que este local ha pedido alguna vez (normalizados)
  const _norm=n=>(n||'').trim().toLowerCase();
  const orderedNames=new Set();
  orders.filter(o=>o.restaurant===rest&&o.status!=='rejected').forEach(o=>{
    (o.items||[]).forEach(it=>{ if(it.name) orderedNames.add(_norm(it.name)); });
  });

  // Un producto aparece en el inventario si:
  //   1. Está marcado como manual (añadido a mano por el usuario), O
  //   2. Se ha pedido alguna vez desde este local
  // Los productos importados masivamente que nunca se pidieron NO aparecen —
  // no se borran, solo se ocultan. En cuanto se pidan una vez, reaparecen.
  // Además se sigue ocultando lo de proveedores desactivados.
  const items=allItems.filter(it=>{
    const c=it.category||'Sin categoría';
    const supOk=!allSupCatNames.has(c) || activeSupCatNames.has(c);
    if(!supOk) return false;
    return it.manual===true || orderedNames.has(_norm(it.name));
  });
  const lowItems=items.filter(it=>(parseFloat(it.minStock)||0)>0&&(parseFloat(it.qty)||0)<=(parseFloat(it.minStock)||0));
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

  const alertBanner=lowItems.length?`<div class="banner" style="background:#fef3c7;border-color:#f59e0b;color:#92400e;margin-bottom:12px"><strong>${lowItems.length} producto${lowItems.length>1?'s':''} con stock bajo:</strong> ${lowItems.map(it=>`${it.name} (${parseFloat(it.qty)||0} ${it.unit||'ud'})`).join(', ')}</div>`:'';

  const isEditing=S.invEditId!==null;
  const editItem=isEditing&&S.invEditId!=='new'?(inventory[restKey(rest)]||{})[S.invEditId]:null;

  const formHtml=`<div class="card" style="margin-bottom:14px">
    <div style="font-weight:700;font-size:14px;margin-bottom:10px">${isEditing&&S.invEditId!=='new'?'Editar producto':' Añadir producto'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:12px;color:var(--mut)">Nombre</label><input id="inv-form-name" class="inp" value="${(S.invForm.name||'').replace(/"/g,'&quot;')}" placeholder="ej: Pechuga de pollo" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Unidad</label><input id="inv-form-unit" class="inp" value="${S.invForm.unit||''}" placeholder="Kg, L, ud…" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Cantidad actual</label><input id="inv-form-qty" class="inp" type="number" min="0" step="0.01" value="${S.invForm.qty??''}" placeholder="0" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Precio / unidad (€)</label><input id="inv-form-price" class="inp" type="number" min="0" step="0.01" value="${S.invForm.price??''}" placeholder="0.00" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Stock mínimo</label><input id="inv-form-min" class="inp" type="number" min="0" step="0.01" value="${S.invForm.minStock??''}" placeholder="0 = sin alerta" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Categoría</label><input id="inv-form-cat" class="inp" value="${S.invForm.category||''}" placeholder="ej: Carnes, Lácteos…" /></div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-acc btn-sm" onclick="submitInvForm('${rest.replace(/'/g,"\\'")}')">Guardar</button>
      <button class="btn btn-ghost btn-sm" onclick="cancelInvForm()">Cancelar</button>
    </div>
  </div>`;

  const movRows=(Object.values(inventoryMovements[restKey(rest)]||{})||[]).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50).map(m=>{
    const ico=m.type==='entrada'?'':m.type==='salida'?'':'';
    return `<tr><td>${ico} ${m.type}</td><td>${m.productName||m.productId}</td><td>${m.qty>0?'+':''}${m.qty}</td><td>${m.source==='pedido'?' Pedido':' Manual'}</td><td style="color:var(--mut)">${m.date?new Date(m.date).toLocaleDateString('es-ES'):''}</td></tr>`;
  }).join('');

  const totalValor=items.reduce((s,it)=>(parseFloat(it.qty)||0)*(parseFloat(it.price)||0)+s,0);
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
    <thead><tr><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Precio/ud</th><th>Valor</th><th>Mín.</th><th>Estado</th><th>Ajuste rápido</th><th></th></tr></thead>
    <tbody>${filteredItems.map(it=>{
      const low=(parseFloat(it.minStock)||0)>0&&(parseFloat(it.qty)||0)<=(parseFloat(it.minStock)||0);
      const qty=parseFloat(it.qty)||0;
      const price=parseFloat(it.price)||0;
      const valor=qty*price;
      return `<tr style="${low?'background:#fef9c3':''}">
        <td style="font-weight:600">${it.name}</td>
        <td style="color:var(--mut)">${it.category||'—'}</td>
        <td><strong>${qty}</strong> ${it.unit||'ud'}</td>
        <td style="color:var(--mut)">${price>0?fmt(price):'—'}</td>
        <td style="font-weight:${valor>0?'700':'400'}">${valor>0?fmt(valor):'—'}</td>
        <td style="color:var(--mut)">${parseFloat(it.minStock)||0} ${it.unit||'ud'}</td>
        <td>${low?'<span style="color:#d97706;font-weight:700">Bajo</span>':'<span style="color:#16a34a">OK</span>'}</td>
        <td><span style="display:flex;gap:4px;align-items:center">
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:16px" onclick="ajusteRapido('${rest.replace(/'/g,"\\'")}','${it.id}',-1)">−</button>
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:16px" onclick="ajusteRapido('${rest.replace(/'/g,"\\'")}','${it.id}',1)">+</button>
        </span></td>
        <td><span style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="openInvForm('${rest.replace(/'/g,"\\'")}','${it.id}')"></button>
          <button class="btn btn-no btn-sm" onclick="deleteInvItem('${rest.replace(/'/g,"\\'")}','${it.id}')"></button>
        </span></td>
      </tr>`;
    }).join('')}
    ${totalValor>0?`<tr style="background:var(--bg);font-weight:700"><td colspan="4" style="text-align:right;padding-right:8px">TOTAL</td><td>${fmt(totalValor)}</td><td colspan="4"></td></tr>`:''}
    </tbody></table>`
    :(items.length&&invQ?`${searchBox}<div class="empty" style="margin:0"><div class="et">Sin resultados para "<strong>${invQ}</strong>"</div></div>`
    :`<div class="empty"><div class="ei"></div><div class="et">Sin productos en el inventario de ${rest}</div></div>`);

  return `<div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:16px;font-weight:700">Inventario</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${items.length?`<button class="btn btn-acc btn-sm" onclick="exportInventoryExcel('${rest.replace(/'/g,"\\'")}',${S.invCat?JSON.stringify(S.invCat):'null'})">Exportar Excel${S.invCat?' ('+S.invCat+')':''}</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="importSupplierProducts('${rest.replace(/'/g,"\\'")}')"> Importar catálogo</button>
        <button class="btn btn-ghost btn-sm" onclick="openInvForm('${rest.replace(/'/g,"\\'")}','new')"> Producto</button>
      </div>
    </div>
    <div class="sup-tabs" style="margin-bottom:10px">${restTabs}</div>
    ${filteredCats.length>0?`<div class="sup-tabs" style="margin-bottom:14px;flex-wrap:wrap">${catTabs}</div>`:''}
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
  const lowItems=items.filter(it=>(parseFloat(it.minStock)||0)>0&&(parseFloat(it.qty)||0)<=(parseFloat(it.minStock)||0));
  const alertBanner=lowItems.length?`<div class="banner" style="background:#fef3c7;border-color:#f59e0b;color:#92400e;margin-bottom:12px"><strong>${lowItems.length} producto${lowItems.length>1?'s':''} con stock bajo:</strong> ${lowItems.map(it=>`${it.name} (${parseFloat(it.qty)||0} ${it.unit||'ud'})`).join(', ')}</div>`:'';
  const isEditing=S.invEditId!==null;

  const formHtml=`<div class="card" style="margin-bottom:14px">
    <div style="font-weight:700;font-size:14px;margin-bottom:10px">${S.invEditId&&S.invEditId!=='new'?'Editar producto':' Añadir producto'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:12px;color:var(--mut)">Nombre</label><input id="inv-form-name" class="inp" value="${(S.invForm.name||'').replace(/"/g,'&quot;')}" placeholder="ej: Pechuga de pollo" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Unidad</label><input id="inv-form-unit" class="inp" value="${S.invForm.unit||''}" placeholder="Kg, L, ud…" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Cantidad actual</label><input id="inv-form-qty" class="inp" type="number" min="0" step="0.01" value="${S.invForm.qty??''}" placeholder="0" /></div>
      <div><label style="font-size:12px;color:var(--mut)">Precio / unidad (€)</label><input id="inv-form-price" class="inp" type="number" min="0" step="0.01" value="${S.invForm.price??''}" placeholder="0.00" /></div>
      <div style="grid-column:1/-1"><label style="font-size:12px;color:var(--mut)">Categoría</label><input id="inv-form-cat" class="inp" value="${S.invForm.category||''}" placeholder="ej: Carnes, Lácteos…" /></div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-acc btn-sm" onclick="submitInvForm('${rest.replace(/'/g,"\\'")}')">Guardar</button>
      <button class="btn btn-ghost btn-sm" onclick="cancelInvForm()">Cancelar</button>
    </div>
  </div>`;

  const totalValorR=items.reduce((s,it)=>(parseFloat(it.qty)||0)*(parseFloat(it.price)||0)+s,0);
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
    <thead><tr><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Precio/ud</th><th>Valor</th><th>Estado</th><th>Ajuste rápido</th><th></th></tr></thead>
    <tbody>${filteredR.map(it=>{
      const low=(parseFloat(it.minStock)||0)>0&&(parseFloat(it.qty)||0)<=(parseFloat(it.minStock)||0);
      const qty=parseFloat(it.qty)||0;
      const price=parseFloat(it.price)||0;
      const valor=qty*price;
      return `<tr style="${low?'background:#fef9c3':''}">
        <td style="font-weight:600">${it.name}</td>
        <td style="color:var(--mut)">${it.category||'—'}</td>
        <td><strong>${qty}</strong> ${it.unit||'ud'}</td>
        <td style="color:var(--mut)">${price>0?fmt(price):'—'}</td>
        <td style="font-weight:${valor>0?'700':'400'}">${valor>0?fmt(valor):'—'}</td>
        <td>${low?'<span style="color:#d97706;font-weight:700">Bajo</span>':'<span style="color:#16a34a">OK</span>'}</td>
        <td><span style="display:flex;gap:4px;align-items:center">
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:16px" onclick="ajusteRapido('${rest.replace(/'/g,"\\'")}','${it.id}',-1)">−</button>
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:16px" onclick="ajusteRapido('${rest.replace(/'/g,"\\'")}','${it.id}',1)">+</button>
        </span></td>
        <td><button class="btn btn-ghost btn-sm" onclick="openInvForm('${rest.replace(/'/g,"\\'")}','${it.id}')">Editar</button></td>
      </tr>`;
    }).join('')}
    ${totalValorR>0?`<tr style="background:var(--bg);font-weight:700"><td colspan="4" style="text-align:right;padding-right:8px">TOTAL</td><td>${fmt(totalValorR)}</td><td colspan="3"></td></tr>`:''}
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
