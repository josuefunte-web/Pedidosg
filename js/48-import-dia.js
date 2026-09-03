/* ═══════════════ IMPORTAR PDF DEL DÍA (varios albaranes en un solo archivo) ═══════════════
 * Flujo: subir 1 PDF con los albaranes de todo el día para un local (pueden
 * ser de varios proveedores) → runAlbaranBatchImport() (js/22-recortador.js)
 * hace OCR + separa por albarán + extrae líneas de cada uno con IA → aquí se
 * revisan los borradores (S.albBatchDrafts) y se confirman uno a uno o todos
 * a la vez. Nada se guarda en firme sin pasar por esta pantalla.
 */
function handleAlbBatchFile(input){
  const file=input.files&&input.files[0]; if(!file) return;
  const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
  if(!isPdf){ toast('Sube un archivo PDF','#dc2626'); return; }
  const reader=new FileReader();
  reader.onload=e=>{ S.albBatchFile=e.target.result; S.albBatchFileName=file.name; render(); };
  reader.readAsDataURL(file);
}

function vAlbaranBatch(){
  if(S.albBatchDrafts.length) return vAlbaranBatchReview();
  const isAdmin=S.session&&S.session.isAdmin;
  const restSel=isAdmin
    ?`<div class="fg"><label>Local</label><select onchange="S.albBatchRestaurant=this.value"><option value="">— Selecciona —</option>${cfg.users.map(u=>`<option value="${u.restaurant}" ${S.albBatchRestaurant===u.restaurant?'selected':''}>${u.restaurant}</option>`).join('')}</select></div>`
    :'';
  return `<div class="main">
    <div class="card">
      <div class="card-t">Importar PDF del día</div>
      <div style="font-size:12px;color:var(--mut);margin-bottom:12px">Sube un único PDF con todos los albaranes recibidos hoy en este local, aunque sean de varios proveedores distintos. La IA separará cada albarán, intentará reconocer el proveedor y rellenará los productos. Después revisas cada uno antes de guardarlo — nada se registra automáticamente.</div>
      ${restSel}
      <div class="fg"><label>Fecha</label><input type="date" value="${S.albBatchDate}" onchange="S.albBatchDate=this.value"/></div>
      <div class="fg"><label>PDF con los albaranes del día</label>
        <div class="file-input-wrap"><div class="file-input-btn">Subir PDF</div><input type="file" accept="application/pdf,.pdf" onchange="handleAlbBatchFile(this)"/></div>
        ${S.albBatchFileName?`<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--srf);border-radius:10px;margin-top:8px;border:1px solid var(--brd)"><span style="font-size:20px;color:var(--mut)">PDF</span><div style="font-weight:600;font-size:14px;color:var(--txt)">${S.albBatchFileName}</div></div>`:''}
      </div>
      ${S.albBatchProcessing?`<div class="ocr-progress" style="display:block">${S.albBatchProgress||'Procesando...'}</div>`:''}
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-blue" ${S.albBatchProcessing||!S.albBatchFile?'disabled':''} onclick="runAlbaranBatchImport()">${S.albBatchProcessing?'Procesando...':'Analizar con IA'}</button>
        <button class="btn btn-ghost" onclick="${isAdmin?"S.adminTab='albaranes';goAdmin()":'goOrder()'}">Cancelar</button>
      </div>
    </div>
  </div>`;
}

function draftSetField(di,ii,field,val){
  const it=S.albBatchDrafts[di].items[ii]; if(!it) return;
  if(field==='qty'||field==='price') it[field]=parseFloat(val)||0;
  else it[field]=val;
  render();
}
function draftSetIva(di,ii,val){
  const iva=parseFloat(val); if(isNaN(iva)) return;
  const d=S.albBatchDrafts[di]; const it=d.items[ii]; if(!it) return;
  it.iva=iva;
  if(d.supId){ const p=catProdFor(it,d.supId); if(p){ p.iva=iva; saveSups(d.supId); } }
  render();
}
function draftAddItem(di){ S.albBatchDrafts[di].items.push({code:'',name:'',unit:'KG',qty:1,price:0}); render(); }
function draftDelItem(di,ii){ S.albBatchDrafts[di].items.splice(ii,1); render(); }
function draftSetSup(di,supId){ S.albBatchDrafts[di].supId=supId; render(); }
function draftDiscard(di){
  if(!confirm('¿Descartar este albarán detectado? No se guardará.')) return;
  S.albBatchDrafts.splice(di,1); render();
}
function draftConfirm(di){
  const d=S.albBatchDrafts[di]; if(!d) return;
  const rest=S.albBatchRestaurant;
  if(!rest){ toast('Selecciona el local arriba','#dc2626'); return; }
  const res=commitAlbaran({restaurant:rest,supId:d.supId,date:S.albBatchDate,items:d.items,photo:null,totalManual:null});
  if(!res.ok){ toast(res.msg,'#dc2626'); return; }
  S.albBatchDrafts.splice(di,1);
  toast('Albarán guardado','#16a34a');
  render();
}
function confirmAllReadyDrafts(){
  const rest=S.albBatchRestaurant;
  if(!rest){ toast('Selecciona el local arriba','#dc2626'); return; }
  let saved=0, skipped=0;
  for(let i=S.albBatchDrafts.length-1;i>=0;i--){
    const d=S.albBatchDrafts[i];
    if(!d.supId||!d.items.some(it=>it.name&&it.qty>0)){ skipped++; continue; }
    const res=commitAlbaran({restaurant:rest,supId:d.supId,date:S.albBatchDate,items:d.items,photo:null,totalManual:null});
    if(res.ok){ S.albBatchDrafts.splice(i,1); saved++; }
  }
  toast(`${saved} albarán${saved!==1?'es':''} guardado${saved!==1?'s':''}${skipped?` · ${skipped} pendiente${skipped!==1?'s':''} de revisar`:''}`, saved?'#16a34a':'#d97706',5000);
  render();
}

function vAlbaranBatchReview(){
  const isAdmin=S.session&&S.session.isAdmin;
  const restSel=isAdmin
    ?`<div class="fg"><label>Local</label><select onchange="S.albBatchRestaurant=this.value"><option value="">— Selecciona —</option>${cfg.users.map(u=>`<option value="${u.restaurant}" ${S.albBatchRestaurant===u.restaurant?'selected':''}>${u.restaurant}</option>`).join('')}</select></div>`
    :'';
  const cards=S.albBatchDrafts.map((d,di)=>{
    const total=d.items.reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
    const supOk=!!d.supId;
    const itemsHtml=d.items.map((it,ii)=>`
      <div class="item-entry">
        <button class="item-del" onclick="draftDelItem(${di},${ii})">✕</button>
        <div class="three-col">
          <div class="fg" style="margin-bottom:6px"><label>Producto</label><input type="text" value="${it.name||''}" onchange="draftSetField(${di},${ii},'name',this.value)" placeholder="Entrecot..."/></div>
          <div class="fg" style="margin-bottom:6px"><label>Código</label><input type="text" value="${it.code||''}" onchange="draftSetField(${di},${ii},'code',this.value)" placeholder="B001"/></div>
          <div class="fg" style="margin-bottom:6px"><label>Unidad</label><select onchange="draftSetField(${di},${ii},'unit',this.value)"><option ${it.unit==='KG'?'selected':''}>KG</option><option ${it.unit==='UN'?'selected':''}>UN</option><option ${it.unit==='L'?'selected':''}>L</option><option ${it.unit==='Caja'?'selected':''}>Caja</option></select></div>
          <div class="fg" style="margin-bottom:0"><label>Cantidad</label><input type="number" value="${it.qty}" step="0.1" min="0" onchange="draftSetField(${di},${ii},'qty',this.value)"/></div>
          <div class="fg" style="margin-bottom:0"><label>Precio €</label><input type="number" value="${it.price}" step="0.01" min="0" onchange="draftSetField(${di},${ii},'price',this.value)"/></div>
          <div class="fg" style="margin-bottom:0"><label>IVA %</label><input type="number" value="${d.supId?lineIvaFor(it,d.supId):(it.iva!=null&&it.iva!==''?it.iva:10)}" step="1" min="0" onchange="draftSetIva(${di},${ii},this.value)"/></div>
        </div>
      </div>`).join('');
    return `<div class="card" style="margin-bottom:14px;${supOk?'':'border-color:#d97706'}">
      <div class="card-t">Albarán ${di+1}${d.numero?` · Nº ${d.numero}`:''}${supOk?'':' · ⚠️ proveedor sin confirmar'}</div>
      ${d.supNameRaw||d.pages?.length?`<div style="font-size:12px;color:var(--mut);margin-bottom:8px">${d.supNameRaw?`Detectado en el PDF: "${d.supNameRaw}"`:'Proveedor no identificado en el PDF'}${d.pages&&d.pages.length?` · página${d.pages.length!==1?'s':''} ${d.pages.map(p=>p+1).join(', ')}`:''}</div>`:''}
      <div class="fg"><label>Proveedor</label><select onchange="draftSetSup(${di},this.value)"><option value="">— Selecciona —</option>${supList().map(s=>`<option value="${s.id}" ${d.supId===s.id?'selected':''}>${s.emoji} ${s.name}</option>`).join('')}</select></div>
      <div class="sh">Productos</div>
      <div>${itemsHtml||`<div style="color:var(--mut);font-size:13px;text-align:center;padding:14px">Sin productos reconocidos — añade manualmente o descarta este bloque</div>`}</div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;justify-content:center" onclick="draftAddItem(${di})">+ Añadir línea</button>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--mut);margin:10px 0"><span>Total (sin IVA)</span><span>${fmt(total)}</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-pri btn-sm" onclick="draftConfirm(${di})">Guardar este albarán</button>
        <button class="btn btn-ghost btn-sm" onclick="draftDiscard(${di})">Descartar</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="main">
    <div class="card" style="margin-bottom:14px">
      <div class="card-t">Revisa los albaranes detectados</div>
      <div style="font-size:12px;color:var(--mut);margin-bottom:10px">${S.albBatchDrafts.length} albarán${S.albBatchDrafts.length!==1?'es':''} encontrado${S.albBatchDrafts.length!==1?'s':''} en el PDF. Revisa proveedor y líneas antes de guardar — puedes corregir cualquier dato.</div>
      ${restSel}
      <div class="fg"><label>Fecha</label><input type="date" value="${S.albBatchDate}" onchange="S.albBatchDate=this.value"/></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ok btn-sm" onclick="confirmAllReadyDrafts()">Guardar todos los que tengan proveedor</button>
        <button class="btn btn-ghost btn-sm" onclick="${isAdmin?"S.adminTab='albaranes';goAdmin()":'goOrder()'}">Salir (descarta lo pendiente)</button>
      </div>
    </div>
    ${cards}
  </div>`;
}
