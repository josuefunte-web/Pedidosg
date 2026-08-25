/* ═══════════════ ESCANDALLOS: INGREDIENTES, CÁLCULO DE COSTE Y GUARDADO ═══════════════ */
function escLoadProds(){
  const pid=document.getElementById('esc-sel-prov').value;
  const sel=document.getElementById('esc-sel-prod');
  const srch=document.getElementById('esc-prod-search');
  const btnNew=document.getElementById('esc-btn-new-prod');
  const wrapNew=document.getElementById('esc-new-prod-wrap');
  sel.innerHTML='<option value="">-- Producto --</option>';
  if(wrapNew) wrapNew.style.display='none';
  if(pid==='__subesc__'){
    if(srch){srch.value='';srch.style.display='none';}
    if(btnNew) btnNew.style.display='none';
    sel.innerHTML='<option value="">-- Selecciona escandallo --</option>';
    Object.entries(_escAllData).filter(([id])=>id!==_escEditId).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||'','es')).forEach(([id,e])=>{
      const o=document.createElement('option');
      o.value=id; o.textContent=(e.nombre||'Sin nombre')+' ['+escFmt(escCosteTotal(e))+'/rac.]';
      o.dataset.name=e.nombre||'Sin nombre'; o.dataset.unit='rac.'; o.dataset.price='0';
      sel.appendChild(o);
    });
    return;
  }
  if(srch){srch.value='';srch.style.display=pid?'block':'none';}
  if(btnNew) btnNew.style.display=pid?'block':'none';
  if(!pid||!_escSupsCache[pid]) return;
  const prods=(Array.isArray(_escSupsCache[pid].products)?_escSupsCache[pid].products:Object.values(_escSupsCache[pid].products||[]));
  // Agrupar por categoría
  const byCat={};
  prods.forEach(p=>{ const c=p.category||'Otros'; if(!byCat[c])byCat[c]=[]; byCat[c].push(p); });
  const cats=[...PROD_CATS,...Object.keys(byCat).filter(c=>!PROD_CATS.includes(c))].filter(c=>byCat[c]);
  cats.forEach(cat=>{
    const grp=document.createElement('optgroup');
    grp.label=cat;
    byCat[cat].forEach(p=>{
      const o=document.createElement('option');
      o.value=p.id||p.name;
      const grInfo=p.pesoGr?` · ${p.pesoGr}gr`:'';
      o.textContent=`${p.name} (${parseFloat(p.price||0).toFixed(2)}€/${p.unit||'u.'}${grInfo})`;
      o.dataset.price=p.price||0; o.dataset.unit=p.unit||'u.'; o.dataset.name=p.name||''; o.dataset.gr=p.pesoGr||''; o.dataset.cat=cat;
      grp.appendChild(o);
    });
    sel.appendChild(grp);
  });
}
function escFilterProdsSearch(term){
  const sel=document.getElementById('esc-sel-prod');
  if(!sel)return;
  const q=term.toLowerCase().trim();
  Array.from(sel.options).forEach(o=>{
    if(!o.value){o.style.display='';return;}
    o.style.display=(!q||o.dataset.name.toLowerCase().includes(q))?'':'none';
  });
  // Auto-select if only one match
  const visible=Array.from(sel.options).filter(o=>o.value&&o.style.display!=='none');
  if(visible.length===1) sel.value=visible[0].value;
}
function escToggleNewProd(show){
  const wrap=document.getElementById('esc-new-prod-wrap');
  const btn=document.getElementById('esc-btn-new-prod');
  if(!wrap)return;
  wrap.style.display=show?'block':'none';
  if(btn) btn.style.display=show?'none':'block';
  if(show){
    const srch=document.getElementById('esc-prod-search');
    if(srch) document.getElementById('esc-np-name').value=srch.value||'';
    setTimeout(()=>document.getElementById('esc-np-name')?.focus(),50);
  }
}
function escCrearProd(){
  const pid=document.getElementById('esc-sel-prov').value;
  if(!pid){toast('Selecciona primero un proveedor','#dc2626');return;}
  const name=(document.getElementById('esc-np-name')?.value||'').trim();
  const unit=document.getElementById('esc-np-unit')?.value||'KG';
  const price=parseFloat(document.getElementById('esc-np-price')?.value)||0;
  const grRaw=document.getElementById('esc-np-gr')?.value;
  const pesoGr=grRaw&&!isNaN(parseInt(grRaw))?parseInt(grRaw):undefined;
  if(!name){toast('Escribe el nombre del producto','#dc2626');return;}
  if(!suppliers[pid]) suppliers[pid]=_escSupsCache[pid];
  if(!Array.isArray(suppliers[pid].products)) suppliers[pid].products=Object.values(suppliers[pid].products||{});
  const newId='p'+uid();
  const prod={id:newId,name,unit,price};
  if(pesoGr!==undefined) prod.pesoGr=pesoGr;
  suppliers[pid].products.push(prod);
  _escSupsCache[pid]=suppliers[pid];
  saveSups(pid);
  // Reload product list and select the new product
  escLoadProds();
  setTimeout(()=>{
    const sel=document.getElementById('esc-sel-prod');
    if(sel) sel.value=newId;
    escToggleNewProd(false);
    toast(`Producto "${name}" creado y seleccionado`,'#16a34a');
  },100);
}

function escAddIng(){
  const pid=document.getElementById('esc-sel-prov').value;
  const sel=document.getElementById('esc-sel-prod');
  const prodId=sel.value;
  const qty=parseFloat(document.getElementById('esc-sel-qty').value);
  const merma=parseFloat(document.getElementById('esc-sel-merma').value)||0;
  const libreNombre=(document.getElementById('esc-libre-nombre').value||'').trim();
  const librePrice=parseFloat(document.getElementById('esc-libre-precio').value)||0;
  if(!qty||qty<=0){toast('Introduce una cantidad válida','#dc2626');return;}

  if(pid==='__subesc__'){
    // Sub-elaboración
    if(!prodId){toast('Selecciona un escandallo','#dc2626');return;}
    const opt=sel.options[sel.selectedIndex];
    _escIngs.push({type:'subesc',escId:prodId,proveedorId:null,proveedorNombre:'Sub-elaboración',productoId:prodId,nombre:opt.dataset.name||opt.textContent.split(' [')[0],cantidad:qty,unidad:'rac.',precioUnitario:0,merma});
  } else if(libreNombre){
    // Ingrediente libre (sin proveedor)
    _escIngs.push({proveedorId:null,proveedorNombre:'Libre',productoId:null,nombre:libreNombre,cantidad:qty,unidad:'u.',precioUnitario:librePrice,merma});
  } else {
    // Ingrediente de proveedor
    if(!pid){toast('Selecciona un proveedor, un sub-escandallo o escribe un ingrediente libre','#dc2626');return;}
    if(!prodId){toast('Selecciona un producto','#dc2626');return;}
    const opt=sel.options[sel.selectedIndex];
    const prov=_escSupsCache[pid];
    _escIngs.push({proveedorId:pid,proveedorNombre:(prov?.name||pid),productoId:prodId,nombre:opt.dataset.name||opt.textContent,cantidad:qty,unidad:opt.dataset.unit||'u.',precioUnitario:parseFloat(opt.dataset.price)||0,merma});
  }
  document.getElementById('esc-sel-prov').value='';
  document.getElementById('esc-sel-prod').innerHTML='<option value="">-- Producto del proveedor --</option>';
  document.getElementById('esc-sel-qty').value='';
  document.getElementById('esc-sel-merma').value='';
  document.getElementById('esc-libre-nombre').value='';
  document.getElementById('esc-libre-precio').value='';
  escRenderIngs(); escRecalc();
}

function escQuitarIng(i){ _escIngs.splice(i,1); escRenderIngs(); escRecalc(); }
function escSetIngQty(i,val){ if(!_escIngs[i])return; const v=parseFloat(val); _escIngs[i].cantidad=isNaN(v)?0:v; escRenderIngs(); escRecalc(); }
function escSetIngMerma(i,val){ if(!_escIngs[i])return; let v=parseFloat(val); if(isNaN(v))v=0; v=Math.max(0,Math.min(99,v)); _escIngs[i].merma=v; escRenderIngs(); escRecalc(); }


function escLivePrice(ing, depth=0){
  // Sub-escandallo con fracción: coste = fraccion * costeTotal
  if(ing.type==='fracsubesc' && ing.escId && depth<5){
    const subEsc=_escAllData[ing.escId];
    if(subEsc) return escCosteTotal(subEsc, depth+1); // cantidad ya es la fracción
  }
  // Sub-escandallo clásico: coste por unidad de rendimiento
  if(ing.type==='subesc' && ing.escId && depth<5){
    const subEsc=_escAllData[ing.escId];
    if(subEsc){
      const rend=parseFloat(subEsc.rendimiento)||1;
      return escCosteTotal(subEsc, depth+1)/rend;
    }
  }
  if(ing.proveedorId===null) return parseFloat(ing.precioUnitario)||0; // libre o sub-esc no encontrado
  const sup=suppliers[ing.proveedorId];
  if(sup&&sup.products){
    const prod=(Array.isArray(sup.products)?sup.products:Object.values(sup.products)).find(p=>p.id===ing.productoId);
    if(prod) return parseFloat(prod.price)||0;
  }
  return parseFloat(ing.precioUnitario)||0;
}

function escCosteFactor(ing){
  // Coste real = precio * cantidad / (1 - merma/100)
  const merma=parseFloat(ing.merma)||0;
  const factor=merma>0&&merma<100?1/(1-merma/100):1;
  return escLivePrice(ing)*(parseFloat(ing.cantidad)||0)*factor;
}

function escFraccionTexto(val){
  const n=parseFloat(val);
  if(!n||!isFinite(n)) return '0';
  // Fracciones comunes
  const comunes={0.25:'1/4',0.5:'1/2',0.75:'3/4',0.33:'1/3',0.333:'1/3',0.67:'2/3',0.667:'2/3',0.2:'1/5',0.125:'1/8',0.1:'1/10'};
  const key=Math.round(n*1000)/1000;
  if(comunes[key]) return comunes[key];
  if(comunes[Math.round(n*100)/100]) return comunes[Math.round(n*100)/100];
  // Si es un porcentaje "redondo", mostrar como x/100 simplificado o %
  if(n<1) return (Math.round(n*1000)/10)+'%';
  return String(Math.round(n*1000)/1000);
}

function escRenderIngs(){
  const cont=document.getElementById('esc-ing-list');
  if(!cont) return;
  if(!_escIngs.length){cont.innerHTML='<p style="color:var(--mut);font-size:13px">Sin ingredientes aún</p>';return;}
  const totalCoste=_escIngs.reduce((s,ing)=>s+escCosteFactor(ing),0);
  cont.innerHTML=_escIngs.map((ing,i)=>{
    const liveP=escLivePrice(ing);
    const merma=parseFloat(ing.merma)||0;
    const costeReal=escCosteFactor(ing);
    const pct=totalCoste>0?(costeReal/totalCoste*100):0;
    const pctColor=pct>=40?'#dc2626':pct>=20?'#d97706':'#64748b';
    const changed=ing.proveedorId!==null&&Math.abs(liveP-(parseFloat(ing.precioUnitario)||0))>0.001;
    const priceTag=changed?`<span style="color:#d97706;font-size:10px" title="Precio actualizado desde tarifa">${escFmt(liveP)}</span>`:`${escFmt(liveP)}`;
    const mermaTag=merma>0?`<span style="color:#7c3aed;font-size:10px;margin-left:4px" title="Con merma del ${merma}%">${merma}%</span>`:'';
    const fracTexto=ing.type==='fracsubesc'?escFraccionTexto(ing.fraccion||ing.cantidad):'';
    const subEscTag=ing.type==='subesc'?'<span style="font-size:10px;color:#7c3aed;margin-left:4px;font-weight:700">[sub-elaboración]</span>'
      :ing.type==='fracsubesc'?`<span style="font-size:10px;color:#6366f1;margin-left:4px;font-weight:700">[${fracTexto} del escandallo]</span>`
      :'';
    const libre=(!ing.type&&ing.proveedorId===null)?'<span style="font-size:10px;color:#6b7280;margin-left:4px">[libre]</span>':'';
    const qtyCell=ing.type==='fracsubesc'
      ? `${fracTexto} × ${priceTag} total`
      : `<input type="number" value="${ing.cantidad}" min="0" step="0.001" onchange="escSetIngQty(${i},this.value)" onclick="event.stopPropagation()" style="width:64px;padding:3px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);text-align:right"/> ${ing.unidad} × ${priceTag}`;
    const mermaCell=`<input type="number" value="${ing.merma||0}" min="0" max="99" step="1" onchange="escSetIngMerma(${i},this.value)" onclick="event.stopPropagation()" title="% merma" style="width:46px;padding:3px 5px;border:1.5px solid var(--brd);border-radius:6px;font-size:11px;background:var(--card);color:var(--txt);text-align:right"/>%`;
    return `<div class="esc-ing-row">
      <span class="in">${ing.nombre}${subEscTag}${libre}</span>
      <span class="id">${qtyCell} <span style="margin-left:6px;color:var(--mut)">merma</span> ${mermaCell}</span>
      <span class="ic">${escFmt(costeReal)}</span>
      <span style="font-size:11px;font-weight:700;min-width:38px;text-align:right;color:${pctColor}">${pct.toFixed(1)}%</span>
      <button onclick="escQuitarIng(${i})" title="Eliminar">✕</button>
    </div>`;
  }).join('');
}

function escRecalc(){
  const coste=_escIngs.reduce((s,ing)=>s+escCosteFactor(ing),0);
  const pvpConIva=parseFloat(document.getElementById('esc-pvp')?.value)||0;
  const ivaPct=parseFloat(document.getElementById('esc-iva')?.value)||0;
  const fcObj=parseFloat(document.getElementById('esc-fcobj')?.value)||30;
  // IVA desglose
  const ivaFactor=1+(ivaPct/100);
  const pvpSinIva=pvpConIva>0?pvpConIva/ivaFactor:0;
  const ivaAmt=pvpConIva>0?pvpConIva-pvpSinIva:0;
  // Food cost se calcula sobre precio sin IVA
  const fcReal=pvpSinIva>0?(coste/pvpSinIva*100):null;
  // PVP sugerido: precio sin IVA = coste / (fcObj/100), luego con IVA
  const pvpSugSinIva=coste>0?(coste/(fcObj/100)):null;
  const pvpSug=pvpSugSinIva!==null?pvpSugSinIva*ivaFactor:null;
  const margen=pvpSinIva>0?(pvpSinIva-coste):null;
  const margenPct=pvpSinIva>0&&margen!==null?(margen/pvpSinIva*100):null;

  document.getElementById('ec-coste').textContent=escFmt(coste);
  const fcEl=document.getElementById('ec-fc');
  if(fcReal!==null){fcEl.textContent=fcReal.toFixed(1)+'%';fcEl.className=fcReal<=fcObj?'fc-ok':fcReal<=fcObj+5?'fc-warn':'fc-bad';}
  else{fcEl.textContent='— %';fcEl.className='';}
  // IVA rows
  const ivaPctEl=document.getElementById('ec-iva-pct');
  if(ivaPctEl) ivaPctEl.textContent=ivaPct;
  document.getElementById('ec-pvp-coniva').textContent=pvpConIva>0?escFmt(pvpConIva):'— €';
  document.getElementById('ec-iva-amt').textContent=pvpConIva>0?escFmt(ivaAmt):'— €';
  document.getElementById('ec-pvp-noiva').textContent=pvpSinIva>0?escFmt(pvpSinIva):'— €';
  document.getElementById('ec-pvpsug').textContent=pvpSug!==null?escFmt(pvpSug):'— €';
  document.getElementById('ec-margen').textContent=margen!==null?escFmt(margen):'— €';
  document.getElementById('ec-margenpct').textContent=margenPct!==null?margenPct.toFixed(1)+'%':'— %';
  // Actualizar alérgenos en tiempo real
  const alerEl=document.getElementById('esc-alergenos-display');
  if(alerEl){
    const present=alergenosFromIngs(_escIngs);
    if(!present.length){
      alerEl.innerHTML='<span style="color:var(--mut)">Ninguno detectado en ingredientes vinculados</span>';
    } else {
      alerEl.innerHTML=present.map(id=>{
        const a=ALERGENOS.find(x=>x.id===id);
        return `<span style="display:inline-block;background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600;margin:2px 3px 2px 0">${a?a.label:id}</span>`;
      }).join('');
    }
  }
}

function escSave(){
  if(!fbDb){toast('Sin conexión Firebase — espera un momento y vuelve a intentarlo','#dc2626');return;}
  const nombreEl=document.getElementById('esc-nombre');
  if(!nombreEl){toast('Error: recarga la página','#dc2626');return;}
  const nombre=nombreEl.value.trim();
  if(!nombre){toast('Escribe el nombre del plato','#dc2626');return;}
  try{
    const ingsWithLivePrice=_escIngs.map(ing=>({...ing,precioUnitario:escLivePrice(ing)}));
    const data={
      nombre,
      tipo:document.getElementById('esc-tipo')?.value||'final',
      categoria:document.getElementById('esc-categoria')?.value||'Otros',
      restaurante:document.getElementById('esc-local')?.value||'global',
      rendimiento:parseFloat(document.getElementById('esc-rend')?.value)||1,
      rendimientoUnidad:document.getElementById('esc-rend-unit')?.value||'rac.',
      precioVenta:parseFloat(document.getElementById('esc-pvp')?.value)||0,
      iva:parseFloat(document.getElementById('esc-iva')?.value)||0,
      foodCostObjetivo:parseFloat(document.getElementById('esc-fcobj')?.value)||30,
      notas:document.getElementById('esc-notas')?.value.trim()||'',
      tiempoElaboracion:parseFloat(document.getElementById('esc-tiempo')?.value)||null,
      temperatura:document.getElementById('esc-temp')?.value.trim()||'',
      alergenos:alergenosFromIngs(_escIngs),
      ingredientes:ingsWithLivePrice,
      elaboracion:{texto:_escElab.texto||'',pasos:_escElab.pasos.filter(p=>p.trim())},
      temporada:_escTemporada,
      recetaSecciones:_escSecciones.map(s=>({...s,ingredientes:(s.ingredientes||[]).filter(i=>i.nombre),pasos:(s.pasos||[]).filter(p=>p.trim())})),
      updatedAt:Date.now()
    };
    const ref=_escEditId?fbDb.ref('escandallos/'+_escEditId):fbDb.ref('escandallos').push();
    if(!_escEditId) data.createdAt=Date.now();
    ref.set(data)
      .then(()=>{escCloseModal();toast('Escandallo guardado','#16a34a');})
      .catch(e=>toast('Error al guardar: '+e.message,'#dc2626'));
  }catch(e){toast('Error: '+e.message,'#dc2626');console.error(e);}
}

