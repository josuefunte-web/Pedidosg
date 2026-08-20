/* ═══════════════ NEW ALBARAN ═══════════════ */
function vAlbaranNew(){
  const isAdmin=S.session&&S.session.isAdmin;
  const sups=visibleSups();
  const baseTotal=S.albItems.reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
  const ivaTotal=S.albItems.reduce((s,it)=>{const b=(parseFloat(it.qty)||0)*(parseFloat(it.price)||0);return s+b*(albLineIva(it)/100);},0);
  const autoTotal=baseTotal+ivaTotal;
  const restSel=isAdmin?`<div class="fg"><label>Restaurante</label><select id="alb-rest" onchange="S.albRestaurant=this.value"><option value="">— Selecciona —</option>${cfg.users.map(u=>`<option value="${u.restaurant}" ${S.albRestaurant===u.restaurant?'selected':''}>${u.restaurant}</option>`).join('')}</select></div>`:'';
  const supSel=`<div class="fg"><label>Proveedor</label><select id="alb-sup" onchange="S.albSupId=this.value">${sups.map(s=>`<option value="${s.id}" ${S.albSupId===s.id?'selected':''}>${s.emoji} ${s.name}</option>`).join('')}</select></div>`;
  const itemsHtml=S.albItems.map((it,i)=>`
    <div class="item-entry">
      <button class="item-del" onclick="albDelItem(${i})">✕</button>
      <div class="three-col">
        <div class="fg" style="margin-bottom:6px"><label>Producto</label><input type="text" value="${it.name}" onchange="S.albItems[${i}].name=this.value" placeholder="Entrecot..."/></div>
        <div class="fg" style="margin-bottom:6px"><label>Código</label><input type="text" value="${it.code||''}" onchange="S.albItems[${i}].code=this.value" placeholder="B001"/></div>
        <div class="fg" style="margin-bottom:6px"><label>Unidad</label><select onchange="S.albItems[${i}].unit=this.value"><option ${it.unit==='KG'?'selected':''}>KG</option><option ${it.unit==='UN'?'selected':''}>UN</option><option ${it.unit==='L'?'selected':''}>L</option><option ${it.unit==='Caja'?'selected':''}>Caja</option></select></div>
        <div class="fg" style="margin-bottom:0"><label>Cantidad</label><input type="number" value="${it.qty}" step="0.1" min="0" onchange="S.albItems[${i}].qty=parseFloat(this.value)||0"/></div>
        <div class="fg" style="margin-bottom:0"><label>Precio €</label><input type="number" value="${it.price}" step="0.01" min="0" onchange="S.albItems[${i}].price=parseFloat(this.value)||0"/></div>
        <div class="fg" style="margin-bottom:0"><label>IVA %</label><input type="number" value="${albLineIva(it)}" step="1" min="0" onchange="albSetIva(${i},this.value)" title="Por defecto 10%. Si lo cambias se guarda para este producto."/></div>
        <div class="fg" style="margin-bottom:0;grid-column:1/-1"><label style="color:${it.incident?'#dc2626':'var(--mut)'}">Incidencia (opcional)</label><input type="text" value="${it.incident||''}" placeholder="Ej: Faltaban 2kg, producto en mal estado..." onchange="S.albItems[${i}].incident=this.value" style="${it.incident?'border-color:#dc2626;background:#fff5f5':''}"/></div>
        <div class="fg" style="margin-bottom:0"><label>Total € (IVA incl.)</label><input type="number" step="0.01" min="0" value="${((parseFloat(it.qty)||0)*(parseFloat(it.price)||0)*(1+albLineIva(it)/100)).toFixed(2)}" onchange="const t=parseFloat(this.value)||0;const f=1+albLineIva(S.albItems[${i}])/100;S.albItems[${i}].price=S.albItems[${i}].qty?(t/f/S.albItems[${i}].qty):0;render()" style="font-weight:600"/></div>
      </div>
    </div>`).join('');
  return `<div class="main">
    <div class="card">
      <div class="card-t">Nuevo Albarán</div>
      ${restSel}${supSel}
      <div class="fg"><label>Fecha</label><input type="date" id="alb-date" value="${S.albDate}" onchange="S.albDate=this.value"/></div>
      <div class="fg"><label>Foto del albarán</label>
        <div class="file-input-wrap"><div class="file-input-btn">Subir imagen, PDF o Excel</div><input type="file" accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv" onchange="handleAlbPhoto(this)"/></div>
        ${S.albCropping
          ? `<div style="font-size:13px;color:var(--mut);margin:8px 0 6px">Ajusta el recuadro: arrastra dentro para moverlo y usa los tiradores de las esquinas/lados para redimensionar. O dibuja uno nuevo arrastrando fuera.</div>
             <canvas id="crop-canvas" style="width:100%;border-radius:8px;cursor:crosshair;touch-action:none;border:2px dashed var(--pri)"></canvas>
             <div style="display:flex;gap:8px;margin-top:10px">
               <button class="btn btn-pri btn-sm" onclick="applyCrop()"> Aplicar recorte</button>
               <button class="btn btn-ghost btn-sm" onclick="cancelCrop()">Cancelar</button>
             </div>`
          : `${S.albPhoto&&S.albFileType==='image'
               ?`<img id="alb-img-preview" class="img-preview" style="display:block" src="${S.albPhoto}"/>`
               :S.albPhoto&&S.albFileType==='pdf'
               ?`<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--srf);border-radius:10px;margin-top:8px;border:1px solid var(--brd)"><span style="font-size:20px;color:var(--mut)">PDF</span><div><div style="font-weight:600;font-size:14px;color:var(--txt)">${S.albFileName||'documento.pdf'}</div><div style="font-size:12px;color:var(--mut)">PDF listo para analizar con IA</div></div></div>`
               :`<img id="alb-img-preview" class="img-preview" style="display:none" src=""/>`}
             <div id="ocr-progress" class="ocr-progress">Reconociendo texto...</div>
             ${S.albPhoto?`<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
               ${S.albFileType==='image'?`<button class="btn btn-ghost btn-sm" onclick="showCropUI()">Recortar imagen</button>`:''}
               <button class="btn btn-blue btn-sm" onclick="runOCR()">Reconocer con OCR</button>
             </div>`:''}` }
      </div>
    </div>
    <div class="sh">Productos del albarán</div>
    <div id="alb-items-list">${itemsHtml||`<div style="color:var(--mut);font-size:13px;text-align:center;padding:20px">Añade productos manualmente o usa OCR</div>`}</div>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px;justify-content:center" onclick="albAddItem()">+ Añadir línea</button>
    <div class="card" style="margin-top:14px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--mut);margin-bottom:4px"><span>Base imponible</span><span>${fmt(baseTotal)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--mut);margin-bottom:8px"><span>IVA</span><span>${fmt(ivaTotal)}</span></div>
      <div style="display:flex;align-items:flex-end;gap:10px">
        <div class="fg" style="flex:1;margin-bottom:0">
          <label style="font-weight:600;font-size:13px">Total albarán con IVA (€)</label>
          <input type="number" step="0.01" min="0" id="alb-total-input"
            value="${S.albTotalManual!==null?S.albTotalManual.toFixed(2):autoTotal.toFixed(2)}"
            oninput="S.albTotalManual=parseFloat(this.value)||0"
            style="font-size:18px;font-weight:700;${S.albTotalManual!==null?'border-color:var(--pri);':''}"/>
        </div>
        ${S.albTotalManual!==null?`<button class="btn btn-ghost btn-sm" style="margin-bottom:2px;white-space:nowrap" onclick="S.albTotalManual=null;render()">↺ Recalcular</button>`:''}
      </div>
      ${S.albTotalManual!==null?`<div style="font-size:12px;color:var(--mut);margin-top:6px">Total calculado por líneas: ${fmt(autoTotal)} · Total introducido manualmente: ${fmt(S.albTotalManual)}</div>`:`<div style="font-size:12px;color:var(--mut);margin-top:4px">Calculado de las líneas — puedes editarlo si el albarán del proveedor es diferente</div>`}
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-pri" onclick="saveAlbaran()">Guardar albarán</button>
      <button class="btn btn-ghost" onclick="${S.session&&S.session.isAdmin?'goAdmin()':'goOrder()'}">Cancelar</button>
    </div>
  </div>`;
}
