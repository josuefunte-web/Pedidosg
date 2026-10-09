/* ═══════════════ ESCANDALLOS: INGREDIENTES, CÁLCULO DE COSTE Y GUARDADO ═══════════════ */
function escQuitarIng(i){ _escIngs.splice(i,1); escRenderIngs(); escRecalc(); }
function escSetIngQty(i,val){ if(!_escIngs[i])return; const v=parseFloat(val); _escIngs[i].cantidad=isNaN(v)?0:v; escRenderIngs(); escRecalc(); }
function escSetIngIva(i,val){ if(!_escIngs[i])return; let v=parseFloat(val); if(isNaN(v))v=0; v=Math.max(0,Math.min(100,v)); _escIngs[i].iva=v; escRenderIngs(); escRecalc(); }
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
    if(prod){
      // Ingrediente guardado en KG: precio normalizado a KG (g, pesoGr, conversión)
      if(String(ing.unidad||'').toLowerCase()==='kg'&&typeof escKgPrice==='function'){
        const kg=escKgPrice(prod);
        if(kg.unit==='KG') return kg.price;
      }
      return parseFloat(prod.price)||0;
    }
  }
  return parseFloat(ing.precioUnitario)||0;
}

// IVA de la línea (%): por defecto 10. Las sub-elaboraciones ya arrastran el IVA
// de sus propios ingredientes, así que no se les vuelve a sumar.
function escIngIva(ing){
  if(ing.type==='subesc'||ing.type==='fracsubesc') return 0;
  const v=parseFloat(ing.iva);
  return isNaN(v)?10:v;
}

function escCosteFactor(ing){
  // Coste real = precio * cantidad / (1 - merma/100) * (1 + IVA/100)
  const merma=parseFloat(ing.merma)||0;
  const factor=merma>0&&merma<100?1/(1-merma/100):1;
  return escLivePrice(ing)*(parseFloat(ing.cantidad)||0)*factor*(1+escIngIva(ing)/100);
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

function escRowView(ing){
  // Cantidad "amigable": 0,25 KG se muestra como 250 g
  const opts=escUnitOpts(ing.unidad);
  const q=parseFloat(ing.cantidad)||0;
  const o=(opts.length>1&&opts[1].f<1&&q>0&&q<1)?opts[1]:opts[0];
  return {opts,cur:o,val:escFmtQty(q/o.f)};
}
function escRowQty(i){
  const ing=_escIngs[i]; if(!ing) return;
  const v=parseFloat(document.getElementById('ei-q-'+i)?.value);
  const f=parseFloat(document.getElementById('ei-u-'+i)?.value)||1;
  ing.cantidad=isNaN(v)?0:v*f;
  escRenderIngs(); escRecalc();
}

function escRenderIngs(){
  const cont=document.getElementById('esc-ing-list');
  if(!cont) return;
  if(!_escIngs.length){cont.innerHTML='<p style="color:var(--mut);font-size:13px">Sin ingredientes aún. Usa el buscador de arriba.</p>';return;}
  const totalCoste=_escIngs.reduce((s,ing)=>s+escCosteFactor(ing),0);
  cont.innerHTML=_escIngs.map((ing,i)=>{
    const liveP=escLivePrice(ing);
    const merma=parseFloat(ing.merma)||0;
    const costeReal=escCosteFactor(ing);
    const pct=totalCoste>0?(costeReal/totalCoste*100):0;
    const pctColor=pct>=40?'#dc2626':pct>=20?'#d97706':'#64748b';
    const changed=ing.proveedorId!==null&&Math.abs(liveP-(parseFloat(ing.precioUnitario)||0))>0.001;
    const priceTag=changed?`<span style="color:#d97706" title="Precio actualizado desde tarifa">${escFmt(liveP)}</span>`:escFmt(liveP);
    const fracTexto=ing.type==='fracsubesc'?escFraccionTexto(ing.fraccion||ing.cantidad):'';
    const tag=ing.type==='subesc'?'<span class="pk-chip pk-sub">sub-elaboración</span>'
      :ing.type==='fracsubesc'?`<span class="pk-chip pk-sub">${fracTexto} del escandallo</span>`
      :ing.proveedorId?`<span class="pk-chip">${escHtml(ing.proveedorNombre||'')}</span>`
      :'<span class="pk-chip">libre</span>';
    let qtyCell;
    if(ing.type==='fracsubesc'){
      qtyCell=`${fracTexto} × ${priceTag}`;
    } else {
      const v=escRowView(ing);
      const unitSel=v.opts.length>1
        ?`<select id="ei-u-${i}" onchange="escRowQty(${i})">${v.opts.map(o=>`<option value="${o.f}"${o===v.cur?' selected':''}>${escHtml(o.l)}</option>`).join('')}</select>`
        :`<input type="hidden" id="ei-u-${i}" value="1"/><span class="pk-mut">${escHtml(ing.unidad||'')}</span>`;
      qtyCell=`<input type="number" id="ei-q-${i}" value="${v.val}" min="0" step="0.001" onchange="escRowQty(${i})" onclick="event.stopPropagation()" class="ei-qty"/>${unitSel}<span class="pk-mut">× ${priceTag}/${escHtml(ing.unidad||'')}</span>`;
    }
    // ¿Hay el mismo producto más barato en otro proveedor?
    let altHint='', altPanel='';
    const alts=escAltsFor(ing);
    if(alts.length){
      const best=alts[0];
      if(best.price>0&&liveP>0&&best.price<liveP*0.98){
        altHint=`<button class="pk-alt-hint" onclick="escAltToggle(${i})" title="Ver alternativas">💡 −${Math.round((1-best.price/liveP)*100)}% en ${escHtml(best.sname)}</button>`;
      } else {
        altHint=`<button class="btn btn-ghost btn-xs" onclick="escAltToggle(${i})" title="Cambiar de proveedor">⇄</button>`;
      }
      if(_escPick.alt===i){
        altPanel=`<div class="pk-alt-panel">${alts.map((a,j)=>`<div class="pk-row" onclick="escAltSwap(${i},${j})"><span class="pk-name">${escHtml(a.name)}</span><span class="pk-chip">${escHtml((a.emoji||'')+a.sname)}</span><span class="pk-price">${escFmt(a.price)}/${escHtml(a.unit)}</span></div>`).join('')}</div>`;
      }
    }
    const mermaCell=`<input type="number" value="${ing.merma||0}" min="0" max="99" step="1" onchange="escSetIngMerma(${i},this.value)" onclick="event.stopPropagation()" title="% merma" class="ei-merma"/>%`;
    const ivaCell=(ing.type==='subesc'||ing.type==='fracsubesc')?''
      :`<span class="pk-mut">IVA</span> <input type="number" value="${escIngIva(ing)}" min="0" max="100" step="1" onchange="escSetIngIva(${i},this.value)" onclick="event.stopPropagation()" title="% IVA" class="ei-merma ei-iva"/>%`;
    return `<div class="esc-ing-row" style="flex-wrap:wrap">
      <span class="in">${escHtml(ing.nombre)} ${tag}</span>
      <span class="id">${qtyCell} <span class="pk-mut">merma</span> ${mermaCell} ${ivaCell}</span>
      <span class="ic">${escFmt(costeReal)}</span>
      <span style="font-size:11px;font-weight:700;min-width:38px;text-align:right;color:${pctColor}">${pct.toFixed(1)}%</span>
      ${altHint}
      <button onclick="escQuitarIng(${i})" title="Eliminar">✕</button>
      ${altPanel}
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

