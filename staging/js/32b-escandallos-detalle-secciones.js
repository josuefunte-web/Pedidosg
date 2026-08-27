/* ═══════════════ ESCANDALLOS: EDICIÓN DE SECCIONES DE RECETA (temporada, secciones, ingredientes por sección) ═══════════════ */
function escRenderTemporada(){
  const cont=document.getElementById('esc-temporada-btns');
  if(!cont) return;
  const MESES=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  cont.innerHTML=MESES.map(m=>{
    const on=_escTemporada.includes(m);
    return `<button type="button" onclick="escToggleMes('${m}')" style="cursor:pointer;border:1.5px solid ${on?'var(--pri)':'var(--brd)'};padding:3px 7px;border-radius:5px;font-size:11px;font-weight:700;background:${on?'var(--pri)':'var(--card)'};color:${on?'#fff':'var(--txt)'}">${m}</button>`;
  }).join('');
}
function escToggleMes(m){
  const i=_escTemporada.indexOf(m);
  if(i>=0) _escTemporada.splice(i,1); else _escTemporada.push(m);
  escRenderTemporada();
}
function escAddSeccion(){
  _escSecciones.push({titulo:'',ingredientes:[],pasos:[]});
  escRenderSecciones();
}
function escDelSeccion(si){
  _escSecciones.splice(si,1);
  escRenderSecciones();
}
function escAddIngSeccion(si){
  _escSecciones[si].ingredientes.push({cantidad:'',unidad:'',nombre:'',nota:''});
  escRenderSecciones();
}
function escDelIngSeccion(si,ii){
  _escSecciones[si].ingredientes.splice(ii,1);
  escRenderSecciones();
}
function escAddPasoSeccion(si){
  _escSecciones[si].pasos.push('');
  escRenderSecciones();
}
function escDelPasoSeccion(si,pi){
  _escSecciones[si].pasos.splice(pi,1);
  escRenderSecciones();
}
function escRenderSecciones(){
  const cont=document.getElementById('esc-secciones-list');
  if(!cont) return;
  if(!_escSecciones.length){
    cont.innerHTML=`<p style="color:var(--mut);font-size:12px;margin-bottom:4px">Sin secciones. Pulsa "+ Añadir sección" para empezar.</p>`;
    return;
  }
  cont.innerHTML=_escSecciones.map((sec,si)=>{
    const ings=(sec.ingredientes||[]).map((ing,ii)=>`
      <div style="display:grid;grid-template-columns:60px 60px 1fr 1fr auto;gap:4px;margin-bottom:4px;align-items:center">
        <input type="number" value="${ing.cantidad||''}" placeholder="Cant." min="0" step="0.001" style="padding:4px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)" oninput="_escSecciones[${si}].ingredientes[${ii}].cantidad=this.value"/>
        <input type="text" value="${ing.unidad||''}" placeholder="Ud." style="padding:4px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt)" oninput="_escSecciones[${si}].ingredientes[${ii}].unidad=this.value"/>
        <input type="text" value="${ing.nombre||''}" placeholder="Ingrediente" style="padding:4px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);font-weight:600" oninput="_escSecciones[${si}].ingredientes[${ii}].nombre=this.value"/>
        <input type="text" value="${ing.nota||''}" placeholder="Nota" style="padding:4px 6px;border:1.5px solid var(--brd);border-radius:6px;font-size:12px;background:var(--card);color:var(--txt);font-style:italic" oninput="_escSecciones[${si}].ingredientes[${ii}].nota=this.value"/>
        <button onclick="escDelIngSeccion(${si},${ii})" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:13px;padding:2px">✕</button>
      </div>`).join('');
    const pasos=(sec.pasos||[]).map((p,pi)=>`
      <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:5px">
        <span style="min-width:20px;height:20px;background:var(--pri);color:#fff;border-radius:50%;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:5px">${pi+1}</span>
        <input type="text" value="${p.replace(/"/g,'&quot;')}" placeholder="Paso ${pi+1}..." style="flex:1;padding:5px 8px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;background:var(--card);color:var(--txt)" oninput="_escSecciones[${si}].pasos[${pi}]=this.value"/>
        <button onclick="escDelPasoSeccion(${si},${pi})" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:13px;padding:2px;margin-top:4px">✕</button>
      </div>`).join('');
    return `<div style="background:var(--srf);border:1px solid var(--brd);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <input type="text" value="${(sec.titulo||'').replace(/"/g,'&quot;')}" placeholder="Nombre de sección (ej: Salsa, Guarnición...)" style="flex:1;padding:5px 8px;border:1.5px solid var(--brd);border-radius:7px;font-size:13px;font-weight:700;background:var(--card);color:var(--txt)" oninput="_escSecciones[${si}].titulo=this.value"/>
        <button onclick="escDelSeccion(${si})" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:14px;margin-left:8px;padding:2px" title="Eliminar sección">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);margin-bottom:6px">Ingredientes</div>
          ${ings||'<p style="font-size:12px;color:var(--mut);margin:0 0 6px">Sin ingredientes</p>'}
          <button class="btn btn-ghost btn-xs" onclick="escAddIngSeccion(${si})">+ Ingrediente</button>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);margin-bottom:6px">Pasos</div>
          ${pasos||'<p style="font-size:12px;color:var(--mut);margin:0 0 6px">Sin pasos</p>'}
          <button class="btn btn-ghost btn-xs" onclick="escAddPasoSeccion(${si})">+ Paso</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

